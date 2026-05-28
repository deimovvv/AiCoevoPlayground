"""
Image Analysis Service (Gemini Vision)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Analyzes uploaded images using Gemini 2.5 Flash (multimodal).

Used for:
- Auto-describing products on upload
- Auto-describing avatars on upload
- Extracting visual guides from reference images (Ad Creative Lab)
"""

import os
import base64
import httpx
from pathlib import Path

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-2.5-flash"                # image vision + fast tasks
GEMINI_VIDEO_MODEL = "gemini-3.1-pro-preview"    # video analysis (motion, scene manifests, multi-frame reasoning)
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


def is_configured() -> bool:
    return bool(GEMINI_API_KEY)


def _gemini_url(model: str = GEMINI_MODEL) -> str:
    return f"{GEMINI_BASE}/{model}:generateContent?key={GEMINI_API_KEY}"


def _image_to_part(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    """Convert image bytes to Gemini inline_data part."""
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    return {"inline_data": {"mime_type": mime_type, "data": b64}}


async def describe_product(image_bytes: bytes, mime_type: str = "image/jpeg", product_name: str = "") -> str:
    """
    Analyze a product image and return a concise visual description.
    Used as context for image generation prompts.

    IMPORTANT: we deliberately do NOT pass the user-typed product_name to the analyzer.
    User-typed names often contain color adjectives ("remera azul clarito", "buzo bordó")
    that would BIAS Gemini's analysis — the model would describe the product through the
    lens of the name instead of the actual pixels. The description must come from the
    image alone so downstream generation reproduces the real color, not the named one.
    """
    _ = product_name  # intentionally ignored — kept in signature for backwards compat
    prompt = """Describe this product image in a single paragraph (3-4 sentences max).
Focus ONLY on visual details useful for an AI image generator:
- Type of product (garment, accessory, etc.)
- Color (be SPECIFIC: name the exact shade and saturation — "medium dusty blue, slightly
  desaturated", "deep burgundy with a brown undertone", not just "blue" or "red")
- Material, fabric weave, texture
- Shape, fit, silhouette
- Notable features (logo, pattern, hardware, stitching)
- How it looks when worn or displayed

Keep it factual and concise. No marketing language. Describe ONLY what you SEE in the pixels.

Respond in English."""

    return await _call_vision(prompt, [(image_bytes, mime_type)])


async def describe_avatar(image_bytes: bytes, mime_type: str = "image/jpeg", avatar_name: str = "") -> str:
    """
    Analyze an avatar/person image and return a visual description.
    Used to maintain consistency across generated images.
    """
    prompt = f"""Describe this person's appearance in a single paragraph (3-4 sentences max).
Focus ONLY on physical details useful for an AI image generator to recreate this exact person:
- Age range, gender, ethnicity
- Hair: color, length, style
- Facial features: face shape, facial hair, distinguishing features
- Body type, build
- Skin tone

Keep it factual. No personality traits or emotions.
{f'Name: {avatar_name}' if avatar_name else ''}

Respond in English."""

    return await _call_vision(prompt, [(image_bytes, mime_type)])


async def classify_reference(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    """
    Classify an uploaded reference image by its primary subject.
    Used to route the upload to the right slot (product / avatar / background / moodboard).

    Returns:
        {
            "type": "product" | "person" | "scene" | "abstract" | "mixed",
            "confidence": 0.0-1.0,
            "description": "short description of what's in the image",
            "suggested_slot": "product" | "avatar" | "background" | "moodboard" | "reference",
        }
    """
    prompt = """Analyze this image and classify it for a content generation platform.

Return STRICT JSON with:
{
  "type": "product" | "person" | "scene" | "abstract" | "mixed",
  "confidence": <0.0-1.0>,
  "description": "<1 sentence describing what's in the image>",
  "suggested_slot": "product" | "avatar" | "background" | "moodboard" | "reference"
}

Classification rules:
- "product": single object/product in focus (clothing, packaging, accessory, gadget) — suggested_slot: "product"
- "person": single human subject dominates the frame (portrait, model shot) — suggested_slot: "avatar"
- "scene": a location or environment (landscape, interior, street) with no clear subject — suggested_slot: "background"
- "abstract": texture, pattern, color swatch, mood collage — suggested_slot: "moodboard"
- "mixed": person wearing product in context, or multiple subjects — suggested_slot: "reference" (for composition/style inspiration)

Confidence: how sure you are about the classification (use 0.95 for obvious, 0.6 for ambiguous, etc.)
Description: ONE short sentence, factual.

Respond with ONLY the JSON, no markdown."""

    raw = await _call_vision(prompt, [(image_bytes, mime_type)])
    # Strip code fences if present
    cleaned = raw.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned.replace("```json", "").replace("```", "").strip()
    elif cleaned.startswith("```"):
        cleaned = cleaned.replace("```", "").strip()

    import json as _json
    try:
        return _json.loads(cleaned)
    except _json.JSONDecodeError:
        # Fallback: treat as generic reference
        return {
            "type": "mixed",
            "confidence": 0.5,
            "description": cleaned[:200],
            "suggested_slot": "reference",
        }


async def describe_moodboard(image_bytes: bytes, mime_type: str = "image/jpeg", moodboard_name: str = "") -> str:
    """
    Analyze a moodboard image and return a concise visual-style description.
    Used as context when this moodboard is used as reference for image generation.
    """
    prompt = f"""Analyze this moodboard image and describe its VISUAL STYLE in 2-3 sentences.
Focus ONLY on style cues useful for an AI image generator to replicate this aesthetic:
- Color palette (dominant colors, temperature, mood)
- Lighting style (natural/studio, direction, hardness, time of day feel)
- Composition tendencies (minimalist, busy, editorial, lifestyle, studio)
- Texture/grain/post-processing (film, digital, matte, vibrant)
- Overall mood / vibe (moody, airy, premium, raw, commercial, etc.)

Do NOT describe specific people, products, or objects. ONLY the stylistic DNA.
Keep it factual and usable as a style prompt.
{f'Moodboard name: {moodboard_name}' if moodboard_name else ''}

Respond in English."""

    return await _call_vision(prompt, [(image_bytes, mime_type)])


async def describe_lookandfeel(image_bytes: bytes, mime_type: str = "image/jpeg") -> str:
    """
    Analyze a reference image into a reusable COLOR-GRADE / MOOD recipe — pure color
    treatment, ZERO scene content. Used to apply a brand 'look & feel' to another image
    WITHOUT passing the reference itself, so no objects/sky/scenery leak into the result.
    """
    prompt = """Analyze ONLY the color grade and mood of this image and output a reusable COLOR-TREATMENT RECIPE.
Describe, compactly:
- color palette (dominant colors with rough hex, and any color cast)
- white balance / color temperature (warm vs cool, kelvin feel)
- shadow tint and highlight tint
- contrast and saturation level
- film / post characteristics: grain, halation/bloom, vignette, matte vs punchy, dynamic range
- overall mood / atmosphere in a few words

STRICT: do NOT mention or describe ANY object, person, sky, clouds, scenery, location or composition.
Output ONLY the color/light treatment, as a compact comma-separated recipe an AI image editor can apply as a grade. One paragraph, no preamble.

Respond in English."""

    return await _call_vision(prompt, [(image_bytes, mime_type)])


async def extract_visual_guide(
    reference_images: list[tuple[bytes, str]],
    brand_context: str = "",
) -> str:
    """
    Analyze multiple brand reference images and extract a visual style guide.
    Used by Ad Creative Lab to generate on-brand creatives.

    reference_images: list of (image_bytes, mime_type) tuples
    """
    prompt = f"""You are an expert art director analyzing reference images to create a detailed visual production guide.

Study EVERY reference image carefully. Extract the EXACT visual DNA — not generic descriptions, but specific, actionable details that an AI image generator needs to recreate this exact style.

{f'Brand context: {brand_context}' if brand_context else ''}

For EACH of these categories, provide SPECIFIC details (not vague words like "modern" or "clean"):

COLOR PALETTE:
- List exact colors you see (e.g., "desaturated sage green #8B9B7A", "warm cream #F5E6D3")
- How are colors distributed? (dominant vs accent, percentage)
- Color temperature: warm/cool/neutral, and how consistent across images
- Any color grading or film look? (matte, faded blacks, crushed shadows, lifted highlights)

LIGHTING:
- Light source: window, studio softbox, golden hour, overcast, mixed?
- Direction: front, side, back, overhead, 45-degree?
- Quality: hard shadows or soft diffused? Contrast ratio?
- Special: rim light, hair light, practical lights, neon, reflected light?
- Color of light: warm tungsten, cool daylight, mixed?

CAMERA & COMPOSITION:
- Common focal lengths: wide (24mm), normal (50mm), telephoto (85mm+)?
- Depth of field: deep (everything sharp) or shallow (blurred background)?
- Framing: centered, rule of thirds, tight crop, lots of negative space?
- Angles: eye level, slightly above, low angle, overhead?
- Any distinctive composition patterns across images?

TEXTURES & MATERIALS:
- Surface quality of products/garments: matte, glossy, textured, smooth?
- How does fabric behave: structured, flowing, wrinkled, pressed?
- Background surfaces: concrete, wood, fabric, seamless paper?

MOOD & ATMOSPHERE:
- One sentence: what feeling do ALL these images share?
- Is it aspirational, raw, editorial, street, cozy, luxurious, minimal?
- Energy level: calm/static or dynamic/movement?

ENVIRONMENT:
- Indoor/outdoor/studio?
- Specific setting elements that repeat
- Props, set dressing, background elements

Write each section as 2-3 specific sentences. Be PRECISE — this guide will directly control how new images are generated. Vague descriptions produce vague images.

Respond in English."""

    return await _call_vision(prompt, reference_images)


async def analyze_video_frames(
    frame_images: list[tuple[bytes, str]],
    video_url: str = "",
    brand_context: str = "",
) -> str:
    """
    Analyze extracted video frames to reverse-engineer the content.
    Returns structured analysis: script, scenes, style, transitions.
    """
    prompt = f"""You are a creative strategist analyzing a video ad/content piece frame by frame.

These frames are extracted from a video in sequential order. Analyze the COMPLETE content.

{f'Source: {video_url}' if video_url else ''}
{f'Brand context: {brand_context}' if brand_context else ''}

Analyze and provide:

1. SCRIPT/NARRATION: What is being said or communicated? Reconstruct the likely voiceover or caption text for each scene. Write in the same language as the original content.

2. SCENE BREAKDOWN: For each frame/scene:
   - What's happening visually
   - Camera angle and movement
   - Lighting and mood
   - Subject/product placement
   - Text or graphics on screen

3. VISUAL STYLE:
   - Color palette (specific hex codes)
   - Lighting approach
   - Overall aesthetic (UGC, editorial, cinematic, etc.)
   - Transitions between scenes

4. STRUCTURE:
   - Hook (how it grabs attention)
   - Story arc
   - CTA (call to action)
   - Pacing (fast cuts, slow reveals, etc.)

5. IMAGE PROMPTS: For each frame, write a Nano Banana 2 image prompt (2-3 sentences, English) that would recreate a similar scene. These prompts should be ready to use for image generation.

6. NARRATIVE SHAPE & CONTINUITY (CRITICAL — used to decide how downstream tools generate the reel):
   Pick ONE narrative_shape that best fits:
     - "transformation": something on/about the subject progressively changes across scenes (paint application, makeup, getting wet, ripping, dirt accumulating, hair color change, outfit progressively assembled). State CARRIES FORWARD.
     - "showcase": multiple independent looks/angles of essentially the same subject — lookbook, product variants, multiple outfits. Each scene is self-contained.
     - "story": narrative sequence across distinct moments/locations — day in life, journey, story arc. Persona stays the same, environment and time may change.
     - "cyclic": dance, looping action, rhythmic repetition. Each cycle returns to the start state.
   Set state_continuity: true ONLY for "transformation" (and sometimes "story"). false otherwise.
   List stateful_elements: visual elements that PROGRESS or PERSIST across scenes (e.g., ["body paint accumulating", "hair getting wetter", "shirt unbuttoning"]). Empty array if none.

7. VISUAL SIGNATURE (CRITICAL — what makes this video LOOK the way it does):
   Write in English a dense 4-6 sentence paragraph capturing the cinematic DNA of the source.
   Include EVERYTHING specific: apparent focal length, precise lighting direction (key from camera-left/right/back), color temperature (warm 3200K vs cool 5600K vs daylight), palette (desaturated muted earth vs vibrant high-contrast vs pastel), film/digital look (35mm grain vs clean digital vs anamorphic crush), composition pattern (centered vs rule-of-thirds vs negative-space-heavy), depth of field (deep vs shallow), atmospheric texture (haze, dust, lens flare, bokeh), motion language (locked tripod vs handheld micro-jitter vs gimbal float).
   NO GENERIC ADJECTIVES. Concrete and replicable. This paragraph is prepended to EVERY image prompt that recreates the video.
   Also extract separately:
     - lighting_style: one technical sentence about lighting
     - palette_temperature: one of "warm" | "cool" | "neutral" | "high-contrast" | "desaturated"
     - framing_signature: one sentence about the dominant framing pattern

8. DETECTED ASSETS (CRITICAL — for mapping against the user's brand kit):
   Enumerate EVERYTHING that appears in the video that the user might want to replace/map to their brand assets:
     - persons: each distinct person. description (gender, age range, build, hair, ethnicity, vibe) + scenes (which scenes show them).
     - outfits: break each look into its INDIVIDUAL GARMENT PIECES — one entry per garment, NOT one lumped "jacket + top + jeans" entry. Detect separately: top (t-shirt/blouse/etc), bottom (jeans/skirt/pants), outerwear (jacket/coat), footwear, and notable accessories. WHY: brands catalog garments separately (a t-shirt as one item, jeans as another), so each detected piece must map to its own brand item. description = the single garment + its color/material. scenes = where it appears. Example: a look with a white jacket, white top and blue jeans → THREE entries: "white button-up jacket", "white basic top", "blue wide-leg jeans".
     - products: physical products featured (not passive decor). description = what it is + colors + relative size. scenes = where it appears.
     - locations: distinct environments. If video has multiple locations, one entry each. description = type of space + key visual features.
   If a category has nothing, return empty array. All descriptions in ENGLISH so the matcher can cross-reference with the (English) brand kit.

Respond in English.

FORMAT: Respond with ONLY a JSON object:
{{
  "estimated_script": "full reconstructed script/narration",
  "scenes": [
    {{
      "frame": 1,
      "description": "what's happening",
      "image_prompt": "Nano Banana prompt to recreate this scene",
      "camera": "angle/movement",
      "mood": "lighting/atmosphere"
    }}
  ],
  "style_guide": "overall visual style description",
  "color_palette": ["#hex1", "#hex2"],
  "structure": "hook → story → cta breakdown",
  "content_type": "UGC | editorial | product-ad | lifestyle | cinematic | dance | transformation | movement | fashion-movement",
  "estimated_duration": "seconds",
  "key_insights": "what makes this content effective",
  "narrative_shape": "transformation | showcase | story | cyclic",
  "state_continuity": true,
  "stateful_elements": ["element 1 that progresses", "element 2"],
  "visual_signature": "dense English paragraph capturing the cinematic DNA",
  "lighting_style": "one technical sentence",
  "palette_temperature": "warm | cool | neutral | high-contrast | desaturated",
  "framing_signature": "one sentence about dominant framing",
  "detected_assets": {{
    "persons": [{{"id": "person_1", "description": "...", "scenes": [1,2]}}],
    "outfits": [{{"id": "outfit_1", "description": "...", "scenes": [1,2]}}],
    "products": [{{"id": "product_1", "description": "...", "scenes": [3]}}],
    "locations": [{{"id": "location_1", "description": "...", "scenes": [1,2,3]}}]
  }}
}}"""

    # Video frame analysis benefits from the pro model (multi-frame reasoning,
    # motion inference, manifest extraction).
    return await _call_vision(prompt, frame_images, model=GEMINI_VIDEO_MODEL)


async def analyze_video_direct(
    video_bytes: bytes,
    mime_type: str = "video/mp4",
    video_url: str = "",
    brand_context: str = "",
) -> str:
    """
    Send a complete video directly to Gemini for analysis.
    Gemini sees the full video — visual, audio, text on screen.
    """
    prompt = f"""Eres un estratega creativo analizando un video de contenido o publicidad.

Mirá el video COMPLETO con atención — visuales, audio, texto en pantalla, ritmo, todo.

{f'Fuente: {video_url}' if video_url else ''}
{f'Contexto de marca: {brand_context}' if brand_context else ''}

Analizá en detalle:

1. GUIÓN/NARRACIÓN: Transcribí o reconstruí lo que se dice (voiceover, diálogo, texto en pantalla). Mantené el idioma original del video.

2. ESCENAS: Para cada plano o escena distinta:
   - Qué pasa visualmente
   - Ángulo y movimiento de cámara
   - Duración estimada
   - Texto o gráficos en pantalla

3. ESTILO VISUAL: Paleta de colores (hex), iluminación, estética, transiciones

4. AUDIO: Estilo musical, tono del voiceover, efectos de sonido

5. ESTRUCTURA: Desglose Hook → Historia → CTA, ritmo y pacing

6. PROMPTS DE IMAGEN: Para cada escena, escribí un prompt Nano Banana 2 (2-3 oraciones, en INGLÉS) para recrearla

7. FORMA NARRATIVA Y CONTINUIDAD (CRÍTICO — define cómo encadenar las generaciones):
   Elegí UN narrative_shape:
     - "transformation": algo del sujeto progresa entre escenas (pintura, makeup, mojarse, romperse la ropa, ensuciarse, cambio de pelo, outfit que se va armando). El estado SE ACUMULA.
     - "showcase": múltiples looks/ángulos independientes del mismo sujeto — lookbook, variantes, varios outfits. Cada escena es self-contained.
     - "story": secuencia narrativa con momentos/locaciones distintas — día en la vida, viaje, arco. La persona se mantiene, ambiente y tiempo pueden cambiar.
     - "cyclic": baile, acción en loop, repetición rítmica. Cada ciclo vuelve al estado inicial.
   state_continuity: true SOLO para "transformation" (y a veces "story"). false en el resto.
   stateful_elements: lista de cosas visuales que PROGRESAN o PERSISTEN a través de las escenas (ej: ["body paint accumulating", "hair getting wetter", "shirt unbuttoning"]). Lista vacía si no hay.

8. VISUAL SIGNATURE (CRÍTICO — lo que hace al video VERSE como se ve):
   Escribí en INGLÉS un párrafo denso de 4-6 oraciones con la ADN cinematográfica del source.
   Incluí TODO lo específico: focal length aparente, lighting direction precisa (key light from camera-left/right/back), color temperature (warm 3200K vs cool 5600K vs daylight), palette (desaturated muted earth tones vs vibrant high-contrast vs pastel), film/digital look (35mm film grain vs clean digital vs anamorphic crush), composition pattern (centered subject vs rule-of-thirds vs negative-space-heavy), depth of field (deep focus vs shallow), atmospheric texture (haze, dust, lens flare, bokeh), motion language (locked tripod vs handheld micro-jitter vs gimbal float).
   NO ADJETIVOS GENÉRICOS. Concreto y replicable. Este párrafo se va a prepend en CADA prompt de imagen que recree el video.
   También extraé por separado:
     - lighting_style: una frase técnica sobre iluminación (ej: "soft key from camera-left, no fill, deep shadows on right side, 4500K daylight")
     - palette_temperature: "warm" | "cool" | "neutral" | "high-contrast" | "desaturated"
     - framing_signature: una frase sobre el patrón de encuadre dominante

9. DETECTED ASSETS (CRÍTICO — para mapear contra el brand kit del usuario):
   Enumerá TODO lo que aparece en el video que el usuario podría querer reemplazar/mapear a sus assets:
     - persons: distintas personas que aparecen. Cada una con description (género, edad aproximada, build, pelo, etnia, vibe) y scenes (qué escenas la muestran).
     - outfits: separá cada look en sus PRENDAS INDIVIDUALES — una entry por prenda, NO una sola entry "campera + remera + jean". Detectá por separado: parte de arriba (remera/blusa/etc), parte de abajo (jean/pollera/pantalón), abrigo (campera/tapado), calzado, y accesorios notables. POR QUÉ: las marcas catalogan las prendas por separado (la remera es un item, el jean otro), así cada prenda detectada mapea a su propio item del kit. Description = la prenda sola + su color/material. Scenes = en qué escenas aparece. Ejemplo: un look con campera blanca, remera blanca y jean azul → TRES entries: "white button-up jacket", "white basic top", "blue wide-leg jeans".
     - products: productos físicos featured en el video (no decoración pasiva). Description = qué es + colores + tamaño relativo. Scenes = en qué escenas aparece.
     - locations: ambientes distintos. Si el video tiene varias locaciones, una entry por cada una. Description = qué tipo de espacio + características visuales clave.
   Si una categoría no tiene nada (ej: no hay productos, o hay sólo 1 outfit), devolvé array vacío o con 1 entry.
   Todas las descriptions en INGLÉS para que el matcher después las cruce con el brand kit que está en inglés.

Respondé con SOLO un objeto JSON válido. Empezá con {{ y terminá con }}.
Los campos "key_insights", "structure", "style_guide" deben estar en español.
Los "image_prompt" de cada escena deben estar en inglés.
Los "stateful_elements" deben estar en INGLÉS (van directo al prompt de Nano Banana).

{{
  "estimated_script": "transcripción completa del guión",
  "scenes": [
    {{
      "frame": 1,
      "description": "qué pasa en esta escena",
      "image_prompt": "Nano Banana prompt in English, 2-3 sentences",
      "camera": "ángulo y movimiento",
      "mood": "atmósfera y emoción",
      "duration_estimate": "segundos estimados"
    }}
  ],
  "style_guide": "estilo visual general en español",
  "color_palette": ["#hex1", "#hex2"],
  "audio_description": "descripción de música y sonido en español",
  "structure": "hook → historia → cta en español",
  "content_type": "UGC | editorial | product-ad | lifestyle | cinematic | dance | transformation | movement | fashion-movement",
  "estimated_duration": "duración total en segundos",
  "key_insights": "por qué funciona este contenido — en español",
  "narrative_shape": "transformation | showcase | story | cyclic",
  "state_continuity": true,
  "stateful_elements": ["element 1 in English", "element 2 in English"],
  "visual_signature": "dense English paragraph capturing the cinematic DNA of the source — focal length, lighting direction, color temperature, palette, film/digital look, composition pattern, depth of field, atmospheric texture, motion language. Concrete and replicable, no generic adjectives.",
  "lighting_style": "single technical sentence about lighting in English",
  "palette_temperature": "warm | cool | neutral | high-contrast | desaturated",
  "framing_signature": "single sentence about the dominant framing pattern in English",
  "detected_assets": {{
    "persons": [
      {{"id": "person_1", "description": "young woman 25-30, brown wavy hair, latina, athletic build, casual vibe", "scenes": [1,2,3,4]}}
    ],
    "outfits": [
      {{"id": "outfit_1", "description": "cream oversized cotton tee, blue baggy jeans", "scenes": [1,2]}}
    ],
    "products": [
      {{"id": "product_1", "description": "small clear glass perfume bottle with silver cap, 50ml size", "scenes": [3]}}
    ],
    "locations": [
      {{"id": "location_1", "description": "textile workshop with industrial sewing machines, fluorescent overhead lighting, racks of folded shirts", "scenes": [1,2,3,4]}}
    ]
  }}
}}"""

    return await _call_vision_with_video(prompt, video_bytes, mime_type)


async def _call_vision_with_video(prompt: str, video_bytes: bytes, mime_type: str) -> str:
    """Call Gemini with a video file. Uses the video-specific pro model."""
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY not configured")

    b64 = base64.b64encode(video_bytes).decode("utf-8")

    parts = [
        {"text": prompt},
        {"inline_data": {"mime_type": mime_type, "data": b64}},
    ]

    # Gemini 3.x Pro consumes "thinking tokens" internally before producing visible
    # output — so we need a larger budget AND longer timeout for video analysis to
    # complete reliably.
    payload = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {
            "temperature": 0.4,
            "maxOutputTokens": 16000,
        },
    }

    async with httpx.AsyncClient(timeout=300) as client:
        res = await client.post(
            _gemini_url(GEMINI_VIDEO_MODEL),
            headers={"Content-Type": "application/json"},
            json=payload,
        )

    if res.status_code != 200:
        raise Exception(f"Gemini Vision error ({res.status_code}): {res.text[:300]}")

    result = res.json()
    candidates = result.get("candidates", [])
    if not candidates:
        raise Exception("No response from Gemini Vision")

    return candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()


async def analyze_pose(image_bytes: bytes, mime_type: str = "image/jpeg") -> str:
    """
    Analyze a reference image and extract ONLY pose/body position description.
    Ignores lighting, style, colors, background — just the physical poses.
    Used so multi-person reference images can guide generation without confusing the model.
    """
    prompt = """Analyze this image and describe ONLY the body poses and positions of the people in it.

Focus exclusively on:
- Number of people and their relative positioning (side by side, facing each other, etc.)
- Body posture and stance of each person (standing, leaning, arms raised, etc.)
- Camera framing (full body, half body / waist-up, close-up, etc.)
- Camera angle (eye-level, slight low angle, overhead, etc.)
- Hand and arm positions (arm extended, hand raised, holding something near chest, etc.)
- Head/face direction (looking at camera, looking sideways, etc.)
- Energy/dynamism of the pose (relaxed, dynamic, candid, posed, etc.)

Do NOT describe: lighting, colors, clothing style, background, facial features, mood, aesthetic, or anything unrelated to body positioning.

Return a single concise paragraph (2-4 sentences) suitable for use as a pose reference in an image generation prompt. Start directly with the description, no preamble."""

    return await _call_vision(prompt, [(image_bytes, mime_type)])


async def _call_vision(prompt: str, images: list[tuple[bytes, str]], model: str = GEMINI_MODEL) -> str:
    """Call Gemini Vision with text prompt + images."""
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY not configured")

    parts = [{"text": prompt}]
    for img_bytes, mime in images:
        parts.append(_image_to_part(img_bytes, mime))

    # 3.x Pro models reserve tokens for internal "thinking" — bump budgets when using one.
    is_pro = "pro" in model.lower()
    payload = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {
            "temperature": 0.4,
            "maxOutputTokens": 16000 if is_pro else 4000,
        },
    }
    timeout = 180 if is_pro else 60

    async with httpx.AsyncClient(timeout=timeout) as client:
        res = await client.post(
            _gemini_url(model),
            headers={"Content-Type": "application/json"},
            json=payload,
        )

    if res.status_code != 200:
        raise Exception(f"Gemini Vision error ({res.status_code}): {res.text[:300]}")

    result = res.json()
    candidates = result.get("candidates", [])
    if not candidates:
        raise Exception("No response from Gemini Vision")

    return candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
