"""
Gemini Script Generation Service
─────────────────────────────────
Generates UGC video scripts using Gemini with brand context.
"""

import os
import json
import httpx

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


def is_configured() -> bool:
    return bool(GEMINI_API_KEY)


def _gemini_url(model: str = GEMINI_MODEL) -> str:
    return f"{GEMINI_BASE}/{model}:generateContent?key={GEMINI_API_KEY}"


async def _call_gemini(system_prompt: str, user_msg: str) -> str:
    """Send a request to Gemini and return the text response."""
    if not GEMINI_API_KEY:
        raise RuntimeError("Gemini API key not configured. Add GEMINI_API_KEY to your .env file.")

    # Truncate very long prompts to avoid Gemini content filters on scraped web content
    if len(system_prompt) > 15000:
        system_prompt = system_prompt[:15000] + "\n\n[... truncated for length ...]"

    full_text = f"{system_prompt}\n\n---\n\n{user_msg}"
    print(f"[gemini] Sending prompt ({len(full_text)} chars)")

    payload = {
        "contents": [
            {"role": "user", "parts": [{"text": f"{system_prompt}\n\n---\n\n{user_msg}"}]}
        ],
        "generationConfig": {
            "temperature": 0.8,
            "maxOutputTokens": 16000,
            "responseMimeType": "application/json",
        },
        "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_ONLY_HIGH"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_ONLY_HIGH"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_ONLY_HIGH"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_ONLY_HIGH"},
        ],
    }

    async with httpx.AsyncClient(timeout=120) as client:
        res = await client.post(
            _gemini_url(),
            headers={"Content-Type": "application/json"},
            json=payload,
        )

    if res.status_code != 200:
        raise Exception(f"Gemini error ({res.status_code}): {res.text[:300]}")

    result = res.json()
    candidates = result.get("candidates", [])
    if not candidates:
        raise Exception(f"No candidates in Gemini response: {result}")

    content = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
    return content


# ══════════════════════════════════════════════════════════════
#  Suggest Video Objective (auto-generate the creative brief)
# ══════════════════════════════════════════════════════════════

async def suggest_objective(
    brand_context: str,
    product_name: str = "",
    language: str = "es",
) -> str:
    lang_instruction = "Responde en español." if language == "es" else "Respond in English."

    system_prompt = f"""You are a creative strategist for UGC (User Generated Content) video campaigns.

BRAND CONTEXT:
---
{brand_context}
---

TASK:
Generate a concise "Video Objective" paragraph (3-5 lines max) describing the narrative purpose of a UGC video.
Include: target audience hook, how the product is shown, and what the Call to Action should be.
Be creative but concise.
{lang_instruction}
Return ONLY the objective paragraph, nothing else."""

    user_msg = f"Generate a video objective"
    if product_name:
        user_msg += f" for the product: {product_name}"

    return await _call_gemini(system_prompt, user_msg)


# ══════════════════════════════════════════════════════════════
#  Generate Concept (creative brief summary — 2-3 sentences)
# ══════════════════════════════════════════════════════════════

async def generate_concept(
    brand_context: str,
    product_name: str = "",
    video_objective: str = "",
    language: str = "es",
) -> str:
    """
    Generate a narrative creative concept for the UGC video (3-5 sentences).
    Covers the emotional hook, problem, solution, brand POV, and CTA.
    """
    lang_instruction = "Escribe ÚNICAMENTE en español. Sin palabras en inglés." if language == "es" else "Write ONLY in English."
    product_line = f"Producto: {product_name}." if product_name else ""
    objective_line = f"Objetivo del video: {video_objective}" if video_objective else ""

    system_prompt = f"""Eres un director creativo senior especializado en UGC y performance marketing.
Tu trabajo es escribir la "sinopsis narrativa" del video — un párrafo de 4 a 5 oraciones escrito como pitch de historia, no como brief de marketing.

La sinopsis debe leer como si estuvieras contando la historia del video:
- Quién es el personaje (nombre, situación concreta, contexto del día)
- Cuál es su problema real y cómo lo vive emocionalmente
- El momento en que descubre o usa el producto — el punto de giro
- Qué cambia concreto y emocionalmente en su vida
- Cómo cierra el video y qué queda en la mente del espectador

Ejemplo de tono: "Valentina es una mamá que trabaja desde casa y lleva semanas sin que su ropa huela realmente limpia. Un día, su vecina le pasa America Fresh y el resultado la deja sin palabras — su ropa sale impecable y con una fragancia que dura todo el día. Valentina ahora no concibe el lavado sin él, y al final del video invita a sus seguidoras a encontrarlo en PriceSmart."

{lang_instruction}
Devuelve SOLO la sinopsis. Sin títulos, sin bullets, sin markdown."""

    user_msg = f"""Contexto de marca:
{brand_context[:1000]}

{product_line}
{objective_line}

Escribe la sinopsis narrativa ahora."""

    try:
        raw = await _call_gemini(system_prompt, user_msg)
        # Gemini with JSON mime type may wrap in quotes — strip if so
        raw = raw.strip().strip('"').strip("'").strip()
        return raw
    except Exception:
        return ""


# ══════════════════════════════════════════════════════════════
#  Generate Script (4 scenes with pro image prompts)
# ══════════════════════════════════════════════════════════════

async def generate_scripts(
    brand_context: str,
    video_objective: str = "",
    product_name: str = "",
    tone: str = "engaging",
    platform: str = "tiktok",
    language: str = "es",
    prompt_override: str = "",
    narrative_mode: bool = False,
) -> list[dict]:
    """
    Generate a story-driven UGC video script with 4 scenes using Gemini.
    Narrative-first approach: define a character + story arc, then write scenes as story beats.
    Returns [scenes_list, concept_string].
    """
    lang_instruction = (
        "Escribe el campo 'script' y el campo 'concept' ÚNICAMENTE en español. Sin palabras en inglés."
        if language == "es"
        else "Write the 'script' field and 'concept' field ONLY in English."
    )

    if prompt_override:
        base_prompt = prompt_override
    else:
        base_prompt = f"""Eres un director creativo y guionista especializado en UGC de performance.

CONTEXTO DE MARCA:
---
{brand_context}
---

PLATAFORMA: {platform} | TONO: {tone}
"""

    # Always append the narrative-first storytelling rules
    system_prompt = base_prompt + f"""
━━━ ENFOQUE NARRATIVO (OBLIGATORIO) ━━━

PASO 1 — DISEÑA EL PERSONAJE Y SU HISTORIA:
Antes de escribir los scripts, define mentalmente:
• ¿Quién es el personaje? (nombre, situación concreta, contexto del día)
• ¿Cuál es su problema real y cómo lo siente emocionalmente?
• ¿Cómo descubre el producto? ¿Qué pasa exactamente cuando lo prueba?
• ¿Cuál es la transformación específica que vive?
Esta historia interna es lo que da coherencia y autenticidad a los 4 beats.

PASO 2 — ESCRIBE LOS 4 BEATS COMO MOMENTOS DE ESA HISTORIA:
• Beat 1 (Gancho): El personaje EN su problema — específico, visceral, relatable. No menciones el producto.
• Beat 2 (Descubrimiento): El momento en que encuentra/prueba el producto — el punto de giro. Solo este instante.
• Beat 3 (Transformación): El resultado real y emocional — qué cambió en su vida. Concreto, no genérico.
• Beat 4 (CTA): Invitación natural, como si le hablara a un amigo. Dónde conseguirlo.

REGLAS DE ESCRITURA:
- Cada beat = UN momento específico. Sin resúmenes. Sin repetir lo del beat anterior.
- Frases cortas, lenguaje real de persona. Nada de marketing copy genérico.
- El script de cada escena debe sonar como algo que alguien diría EN ESE MOMENTO, no una presentación.
- {lang_instruction}

━━━ TIPOS DE ESCENA ━━━
- "talking": el avatar habla directo a cámara (gancho, CTA, confesión personal, testimonio)
- "creative": toma de acción donde el script es VOICEOVER (usando el producto, mostrando resultado, manos interactuando, ambiente)
- Beats 1 y 4 son SIEMPRE "talking". Beats 2 y 3 PUEDEN ser "creative" si la acción lo amerita.

━━━ CAMPO "avatar" POR ESCENA ━━━
Cada escena lleva el campo "avatar" (boolean) que controla si se usa la foto del avatar como referencia o generación pura de texto-a-imagen:
- avatar: true  → La persona/avatar APARECE en pantalla. Usar para: talking, lifestyle con avatar visible, resultado con la persona presente.
- avatar: false → La persona NO aparece o no es relevante. Usar para: macro de producto, close-up de manos, plano de habitación/ambiente sin cara, escena surrealista/conceptual, ropa doblada, B-roll de producto.

REGLAS:
- "talking" → siempre avatar: true
- "creative" donde la persona es el sujeto principal → avatar: true
- Macro, close-up de manos, B-roll de producto, ambiente sin persona, escena surrealista → avatar: false

━━━ FORMATO DE SALIDA (OBLIGATORIO) ━━━
Devuelve SOLO este JSON, sin texto antes ni después:
{{
  "concept": "Sinopsis narrativa de 4-5 oraciones: quién es el personaje, cuál es su situación concreta, cómo descubre el producto, qué cambia en su vida, y cómo cierra el video. Escrito como pitch de historia, no como brief de marketing.",
  "scenes": [
    {{"id": "act_1", "title": "...", "script": "...", "image_prompt": "Descripción visual cinematográfica ESPECÍFICA: ambiente, postura de la persona, acción concreta, objeto en mano, encuadre.", "sceneType": "talking", "avatar": true}},
    {{"id": "act_2", "title": "...", "script": "...", "image_prompt": "descripción visual específica y cinematográfica", "sceneType": "talking|creative", "avatar": true}},
    ... (continuá con tantas escenas como pida el brief — mínimo 4, sin límite máximo)
  ]
}}
NÚMERO DE ESCENAS: Si el brief especifica una estructura (5 actos, 7 pasos, etc.), generá ESE número exacto de escenas."""

    # Narrative/cinematic mode: multiple locations, 4-type scene taxonomy
    if narrative_mode:
        system_prompt += """

━━━ MODO NARRATIVO CINEMATOGRÁFICO (ACTIVADO) ━━━

Este video viaja entre MÚLTIPLES LOCACIONES — como un cortometraje. Cada beat ocurre en un ambiente distinto.

TIPOS DE ESCENA para los beats 2 y 3 (en vez de "creative"):
- "lifestyle": toma de vida cotidiana, el avatar interactúa con el producto SIN hablar directamente a cámara.
- "sensorial": close-up de textura/detalle del producto. El script es VOICEOVER que describe la sensación.
- "product_reveal": producto integrado en el ambiente naturalmente. El script es VOICEOVER descriptivo.
Beat 1 y Beat 4 siguen siendo "talking".

REGLA CRÍTICA: TODOS los beats deben tener un campo "script" con texto COMPLETO para grabar como voiceover.
Para lifestyle/sensorial/product_reveal el avatar no mira a cámara, pero el "script" es la narración en off.
NUNCA dejes el campo "script" vacío — hasta los beats visuales necesitan su voz en off.

CAMPO "location" OBLIGATORIO en cada escena — descripción cinematográfica específica:
Ejemplos: "lavandería con luz de tarde, tiles blancos, vapor saliendo de la secadora" /
"balcón con atardecer, ropa colgada moviéndose con la brisa" /
"baño con espejo empañado, luz cálida, productos sobre la repisa".
Cada escena en una locación DIFERENTE.

Agrega el campo "location" a cada escena en el JSON."""

    scene_type_values = '"talking"|"lifestyle"|"sensorial"|"product_reveal"' if narrative_mode else '"talking"|"creative"'
    location_field = '\n    "location": "descripción cinematográfica del ambiente",' if narrative_mode else ''

    user_msg = f"""Genera el guion UGC ahora.

IMPORTANTE: Devuelve EXACTAMENTE este formato JSON, sin wrappers adicionales, sin campos extra:
{{
  "concept": "sinopsis narrativa del video en 4-5 oraciones",
  "scenes": [
    {{"id": "act_1", "title": "...", "script": "texto hablado completo aquí", "image_prompt": "descripción visual cinematográfica específica de lo que se ve en pantalla",{location_field} "sceneType": "talking", "avatar": true}},
    {{"id": "act_2", "title": "...", "script": "texto hablado o voiceover completo aquí", "image_prompt": "descripción visual específica",{location_field} "sceneType": {scene_type_values}, "avatar": true}},
    ... (tantas escenas como pida la estructura del brief, mínimo 4)
  ]
}}

REGLAS PARA image_prompt:
- Describe exactamente lo que se ve en pantalla: ambiente, postura de la persona, acción concreta, objeto en mano, encuadre sugerido
- Sé específico: "Person at laundry area pulls gym shirt from basket, brings it to face and sniffs, slightly disappointed expression" — NO: "persona con ropa"
- Para escenas "creative" (sin lipsync): describí la acción o detalle del producto con precisión cinematográfica
- Para escenas "talking": describí postura, ambiente y si el avatar sostiene algo

El campo "script" NUNCA puede estar vacío — es el texto que el avatar habla o narra en off."""
    if product_name:
        user_msg += f"\nProducto: {product_name}"
    if video_objective:
        # Detect if this is a structured brief (contains act/scene structure keywords)
        structure_keywords = ["acto", "act", "escena", "hook", "gancho", "estructura", "step", "beat", "cierre", "cta", "transición"]
        is_structured_brief = any(kw in video_objective.lower() for kw in structure_keywords)
        if is_structured_brief:
            user_msg += f"""\n\nBRIEF ESTRUCTURADO (SIGUE ESTA ESTRUCTURA EXACTAMENTE):
{video_objective}

IMPORTANTE: Este brief define la estructura de actos del video. Cada escena que generes debe corresponder a uno de esos actos en orden. Respetá el número de escenas implícito en la estructura. Si dice "5 actos", generá 5 escenas. Si dice "gancho → problema → demo → resultado → CTA", esas son las 5 escenas en ese orden."""
        else:
            user_msg += f"\nOBJETIVO DEL VIDEO:\n{video_objective}"

    content = await _call_gemini(system_prompt, user_msg)

    # Clean markdown wrappers
    content = content.strip()
    if content.startswith("```json"):
        content = content.replace("```json", "").replace("```", "").strip()
    elif content.startswith("```"):
        content = content.replace("```", "").strip()

    print(f"[copy_gen] Raw response (first 1200 chars):\n{content[:1200]}")

    # Try parsing as object with concept + scenes
    try:
        parsed = json.loads(content)
        print(f"[copy_gen] Parsed keys: {list(parsed.keys()) if isinstance(parsed, dict) else type(parsed)}")
        if isinstance(parsed, dict):
            # Unwrap single-key wrappers like {"video_script": {...}} or {"script": {...}}
            scenes_container = parsed
            if "scenes" not in parsed and len(parsed) == 1:
                inner = list(parsed.values())[0]
                if isinstance(inner, dict) and "scenes" in inner:
                    scenes_container = inner
            if "scenes" in scenes_container:
                scenes = scenes_container["scenes"]
                concept = scenes_container.get("concept") or scenes_container.get("brief") or parsed.get("concept") or ""
                first = scenes[0] if scenes else {}
                print(f"[copy_gen] Scenes count: {len(scenes)}, first scene keys: {list(first.keys())}")
                print(f"[copy_gen] First scene script raw: {repr(first.get('script') or first.get('spoken_script') or first.get('voiceover') or 'MISSING')[:120]}")
                return [scenes, concept]
        if isinstance(parsed, list):
            # Old format fallback — just scenes array, no concept
            return [parsed, ""]
    except json.JSONDecodeError:
        pass

    # Last resort: extract JSON array
    start = content.find("[")
    end = content.rfind("]")
    if start != -1 and end != -1 and end > start:
        try:
            scenes = json.loads(content[start:end + 1])
            return [scenes, ""]
        except json.JSONDecodeError:
            pass

    raise Exception(f"Failed to parse script response. Received: {content[:200]}")
