"""
Gemini Script Generation Service
─────────────────────────────────
Generates UGC video scripts using Gemini with brand context.
"""

import os
import json
import random
import httpx

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-2.5-flash"  # reverted from 3-flash — verify exact 3.x name before upgrading
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


def is_configured() -> bool:
    return bool(GEMINI_API_KEY)


def _gemini_url(model: str = GEMINI_MODEL) -> str:
    return f"{GEMINI_BASE}/{model}:generateContent?key={GEMINI_API_KEY}"


async def _call_gemini(system_prompt: str, user_msg: str) -> str:
    """Send a request to Gemini and return the text response."""
    if not GEMINI_API_KEY:
        raise RuntimeError("Gemini API key not configured. Add GEMINI_API_KEY to your .env file.")

    # Gemini 2.5 Flash handles ~1M input tokens (~3M chars) fine. The old hard cap of 15k
    # was destroying brand context for long docs. We allow up to 200k now, and if we have
    # to truncate we preserve the END of the prompt (where JSON templates live) by cutting
    # from the MIDDLE — we keep the first 60% and the last 40% so the schema/rules survive.
    MAX_PROMPT_CHARS = 200_000
    if len(system_prompt) > MAX_PROMPT_CHARS:
        head_len = int(MAX_PROMPT_CHARS * 0.6)
        tail_len = MAX_PROMPT_CHARS - head_len - 100  # buffer for the marker
        head = system_prompt[:head_len]
        tail = system_prompt[-tail_len:]
        system_prompt = f"{head}\n\n[... middle truncated due to length, {len(system_prompt) - MAX_PROMPT_CHARS} chars cut ...]\n\n{tail}"
        print(f"[gemini] Prompt truncated from {head_len + tail_len + (len(system_prompt) - MAX_PROMPT_CHARS)} to {len(system_prompt)} chars (kept head+tail)")

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
━━━ REGLA #0 — LA MARCA MANDA (LEÉ ESTO PRIMERO) ━━━
El CONTEXTO DE MARCA de arriba es la fuente de verdad. Antes de escribir:
• Si la marca define una ESTRUCTURA propia (ej. "Hook → Desarrollo → CTA"), seguí ESA, no el arco de abajo.
• Si la marca lista HOOKS o FRASES CLAVE, esas son tu materia prima. Elegí UN hook DISTINTO en cada video y desarrollalo; integrá frases clave de la marca con naturalidad.
• Respetá el tono de la marca al pie de la letra (incluyendo los ejemplos de tono que dé) y evitá TODO lo que la marca marque como "no hacer".
• Si la marca es de venta directa / showcase (precio, uso diario, simplicidad), NO la fuerces a un arco de "transformación personal" — mostrá producto + razón + CTA, en su voz.

ROTACIÓN OBLIGATORIA (anti-repetición): cada generación tiene que sentirse NUEVA.
• Nunca reuses el mismo gancho ni la misma frase de apertura de un video a otro.
• Rotá el CONCEPTO que ataca el video (precio / multiplicidad / uso diario / simplicidad / resolución de problema / etc. — elegí UNO distinto cada vez).
• Variá la estructura y el ritmo. Dos videos de la misma marca NO deben sonar calcados.

━━━ ENFOQUE NARRATIVO (DEFAULT — usalo solo si la marca NO define su propia estructura) ━━━

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
- Las URLs escribilas de forma NATURAL (ej: "tallerdesantaclara.com.ar"), NUNCA fonética ("punto com punto ar") — el sistema las convierte solo para el audio.
- {lang_instruction}

━━━ LONGITUD DEL SCRIPT POR ESCENA (CRÍTICO) ━━━
Cada escena en UGC dura entre 4 y 8 segundos. A ritmo de habla natural eso son
~10–22 palabras MÁXIMO por escena. Reglas duras:
- Talking scene: 1 a 2 frases cortas. Nunca más de 22 palabras.
- CTA: 1 frase + URL/lugar. Nunca más de 18 palabras.
- Creative scene (voiceover): 1 frase corta de voz en off (~5-12 palabras) que hace AVANZAR el mensaje. Dejala vacía SOLO si el brief pide explícitamente que sea muda.
- Si el contenido no entra, CORTÁ — no comprimas todo en una sola escena. Mejor
  sumar otra escena que escribir un párrafo. La gente NO habla en párrafos.

ANTI-CRAMMING (CRÍTICO — esto es lo que más se rompe):
- UNA sola idea por escena. Si una escena tiene 2+ ideas, está MAL → repartilas o sumá escenas.
- El CTA va SOLO en su escena, NUNCA pegado a un value prop. "Entrá a la web" no comparte escena con "es de calidad / te llevás varias".
- NO amontones las frases clave de la marca: usá 1 (máx 2) por escena, repartidas entre escenas. No metas calidad + precio + multiplicidad + CTA juntas.
- Si una escena es muda/b-roll, NO traslades su "texto faltante" a la escena siguiente. Mantené CADA escena talking corta. Si falta lugar para el mensaje, AGREGÁ una escena (podés hacer 4-5).
- Antes de cerrar: releé cada escena. Si alguna se lee como párrafo o repite ideas de otra, reescribila más corta o partila.

EJEMPLOS DE LONGITUD (muestran solo el RITMO — NO copies estas palabras; usá SIEMPRE el tono, los hooks y las frases de la marca):
- BIEN (Hook): una sola frase corta y provocativa que frena el scroll (~8-14 palabras).
- BIEN (CTA): una frase + dónde conseguirlo (~8-12 palabras).
- MAL (un párrafo de 40+ palabras que mete todo junto): → CORTALO en varias escenas. La gente NO habla en párrafos.
IMPORTANTE: los hooks y frases reales salen del CONTEXTO DE MARCA, no de este prompt. Si la marca da ejemplos de tono, sonás como ESOS, no como estos.

━━━ TIPOS DE ESCENA ━━━
- "talking": el avatar habla directo a cámara (gancho, CTA, confesión personal, testimonio)
- "creative": toma de acción donde el script es VOZ EN OFF CORTA (usando el producto, manos, ambiente). Por defecto LLEVA una frase de voz en off que hace avanzar el mensaje — NO la dejes muda salvo pedido explícito del brief. Una escena muda en el medio deja un hueco y empuja todo el texto a la escena siguiente (mal).
- Beats 1 y 4 (gancho y CTA) son SIEMPRE "talking", a cámara.
- Si hay mucho mensaje, hacé 4-5 escenas cortas en vez de 3 escenas cargadas. Mejor más escenas livianas que una escena párrafo.

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

    # Random creative-angle seed — forces each run to take a fresh approach so videos for
    # the same brand don't come out calcados. Combined with the brand's own hooks (REGLA #0)
    # this is the main anti-repetition lever.
    _ANGLES = [
        "abrí con una afirmación contraintuitiva que desafíe lo que la gente asume",
        "arrancá a mitad de pensamiento, como si la cámara te agarró ya hablando",
        "abrí con un momento mínimo y cotidiano que el viewer reconozca al toque",
        "abrí con la pregunta que el viewer se está haciendo en silencio",
        "reaccioná al producto como si lo vieras por primera vez",
        "abrí con un shock de número / precio",
        "usá el ángulo 'nadie habla de esto'",
        "señalá un error común que la gente comete",
        "compará con la alternativa obvia y mostrá por qué esto gana",
        "abrí con una mini-confesión personal",
    ]
    user_msg += (
        f"\n\nÁNGULO CREATIVO PARA ESTE VIDEO (para que NO se parezca a otros de la marca): "
        f"{random.choice(_ANGLES)}. Aplicá este ángulo en el tono y con los hooks de la marca — "
        f"nunca de forma literal ni genérica."
    )

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


async def regenerate_scene(
    brand_context: str,
    scenes: list[dict],
    target_index: int,
    language: str = "es",
    video_objective: str = "",
    product_name: str = "",
) -> dict:
    """
    Regenerate ONE scene's script + image_prompt, given the FULL script as context so the
    new version stays coherent with the other scenes (no repetition, same arc, same tone).
    Returns {"script": str, "image_prompt": str}.
    """
    lang = "en español rioplatense" if language == "es" else "in English"
    lines: list[str] = []
    for i, s in enumerate(scenes or []):
        mark = "   ←★ REESCRIBIR SOLO ESTA" if i == target_index else ""
        st = s.get("sceneType") or "talking"
        scr = (s.get("script") or "").replace("\n", " ").strip()
        vis = (s.get("image_prompt") or s.get("visual") or "").strip()[:160]
        lines.append(f"[{i}] ({st}){mark}\n    script: \"{scr}\"\n    visual: {vis}")
    script_block = "\n".join(lines)

    objective_block = f"\nOBJETIVO/BRIEF DEL VIDEO:\n{video_objective}\n" if video_objective else ""
    product_block = f"\nProducto: {product_name}" if product_name else ""

    system_prompt = f"""Eres guionista UGC de performance. Te paso el guion COMPLETO de un video y reescribís SOLO la escena marcada con ★, manteniéndola coherente con el resto.

CONTEXTO DE MARCA:
---
{brand_context}
---
{objective_block}{product_block}

GUION COMPLETO (las otras escenas son tu CONTEXTO — NO las toques):
{script_block}

REGLAS:
- Reescribí SOLO la escena [{target_index}] (la marcada con ★).
- Coherencia total con las demás: seguí el hilo, NO repitas lo que ya dicen las otras escenas, respetá el tono y los hooks de la marca.
- Dame una versión claramente DISTINTA a la actual (fresca), no la misma con otras palabras.
- Si la escena es "talking": texto hablado corto (1-2 frases, máx ~22 palabras).
- Si es "creative": "script" es voz en off opcional (vacío si es b-roll mudo); "image_prompt" describe la acción visual concreta.
- Escribí el campo "script" {lang}.
- Las URLs escribilas de forma NATURAL (ej: tallerdesantaclara.com.ar), nunca fonética — el sistema las convierte para el audio.

Devolvé SOLO este JSON, sin texto antes ni después:
{{"script": "...", "image_prompt": "..."}}"""

    raw = await _call_gemini(system_prompt, f"Reescribí la escena [{target_index}]. Solo JSON.")
    clean = raw.strip().replace("```json", "").replace("```", "").strip()
    obj: dict = {}
    try:
        obj = json.loads(clean)
    except json.JSONDecodeError:
        import re
        m = re.search(r"\{.*\}", clean, re.DOTALL)
        if m:
            try:
                obj = json.loads(m.group(0))
            except json.JSONDecodeError:
                obj = {}
    if not isinstance(obj, dict):
        obj = {}
    return {
        "script": str(obj.get("script") or ""),
        "image_prompt": str(obj.get("image_prompt") or obj.get("visual") or ""),
    }


async def chat_scripts(brand_context: str, messages: list[dict], language: str = "es") -> dict:
    """
    Conversational UGC scriptwriter. Given the chat conversation, writes a NEW script or
    ITERATES the previous one based on the user's last message ("más corto", "cambiá el
    hook", "metele una de b-roll"). Returns {"reply": str, "scenes": [...]}.
    """
    lang = "en español rioplatense (Argentina)" if language == "es" else "in English"
    convo = "\n".join(
        f"{'USUARIO' if (m.get('role') == 'user') else 'VOS'}: {m.get('content', '')}"
        for m in (messages or [])[-12:]
    )

    system_prompt = f"""Sos un guionista UGC de performance que CHARLA con el usuario en un chat y le escribe / itera guiones para la marca.

CONTEXTO DE MARCA (fuente de verdad — tono, hooks, frases, qué NO hacer):
---
{brand_context}
---

REGLAS DE ESCRITURA (CRÍTICAS):
- Tono, hooks y frases SIEMPRE de la marca. Si la marca lista hooks/frases clave, ROTÁ — usá uno DISTINTO cada vez, no repitas el mismo gancho.
- UNA idea por escena. Frases cortas. Talking ≤22 palabras, CTA ≤18, creative (voz en off) ~5-12.
- El CTA va SOLO en su escena, nunca pegado a un value prop. No amontones frases clave.
- Beat 1 = "talking" (gancho a cámara). Las "creative" llevan voz en off CORTA (mudas solo si lo piden).
- Si no entra, SUMÁ escenas (3-6 cortas). Nada de párrafos.
- URLs naturales (ej: tallerdesantaclara.com.ar) — la app las convierte para el audio.

ESTÁS EN UNA CONVERSACIÓN. Interpretá lo ÚLTIMO que pidió el usuario:
- Pide un guion nuevo / ideas → escribí uno fresco (ángulo distinto a lo ya hablado).
- Pide cambios sobre el guion anterior ("más corto", "otro hook", "metele b-roll", "sacá el CTA") → devolvé el guion ACTUALIZADO completo.

CONVERSACIÓN:
{convo}

Devolvé SOLO este JSON, sin texto antes ni después:
{{"reply": "respuesta corta y canchera al usuario, 1-2 frases ({lang})", "scenes": [
  {{"title": "Hook", "script": "...", "image_prompt": "descripción visual concreta", "sceneType": "talking"}}
]}}"""

    raw = await _call_gemini(system_prompt, "Respondé al usuario y escribí/actualizá el guion. Solo JSON.")
    clean = raw.strip().replace("```json", "").replace("```", "").strip()
    obj: dict = {}
    try:
        obj = json.loads(clean)
    except json.JSONDecodeError:
        import re
        m = re.search(r"\{.*\}", clean, re.DOTALL)
        if m:
            try:
                obj = json.loads(m.group(0))
            except json.JSONDecodeError:
                obj = {}
    if not isinstance(obj, dict):
        obj = {}

    raw_scenes = obj.get("scenes") or []
    scenes: list[dict] = []
    for i, s in enumerate(raw_scenes if isinstance(raw_scenes, list) else []):
        if not isinstance(s, dict):
            continue
        scenes.append({
            "id": s.get("id") or f"act_{i + 1}",
            "title": str(s.get("title") or f"Escena {i + 1}"),
            "script": str(s.get("script") or ""),
            "image_prompt": str(s.get("image_prompt") or s.get("visual") or ""),
            "sceneType": "creative" if str(s.get("sceneType")) == "creative" else "talking",
        })
    return {"reply": str(obj.get("reply") or "Te dejé un guion abajo."), "scenes": scenes}
