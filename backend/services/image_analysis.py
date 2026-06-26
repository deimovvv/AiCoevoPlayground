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
import json
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


async def describe_product_sheet(
    images: list[tuple[bytes, str]],
    direction: str = "",
    mode: str = "sheet",
) -> dict:
    """
    Cross-analyze 1-4 photos of the SAME product and return a structured brief used
    by the Product Sheet tool. Returns a dict the frontend can show/edit:
      {
        "name": short product name (≤ 6 words),
        "category": "footwear" | "garment" | "bottle" | ...,
        "summary": 1-2 sentence factual description (no marketing),
        "shape": silhouette / form description,
        "materials": ["leather", "rubber sole", ...],
        "colors": ["off-white #f5f0e6", "burgundy ~ #7a1f2a"] (specific shades),
        "scale": approximate real-world size hint,
        "packaging": packaging if visible, else empty,
        "distinctive_details": ["logo on tongue", "ridged sole", ...],
        "visible_views": ["front", "3/4", "side", ...] — angles ALREADY shown in refs,
        "missing_views": ["back", "top", ...] — angles NOT shown, to be inferred,
        "image_prompt": polished English prompt for Nano Banana to render the sheet
      }

    `mode`:
      - "sheet"   → infer/generate all canonical views (front, 3/4, back, side, top, hero, scale)
      - "details" → close-ups of texture / logo / labels / materials / connectors
    """
    if not images:
        raise RuntimeError("describe_product_sheet requires at least one image")

    mode = (mode or "sheet").lower()
    # The instructions for the `image_prompt` differ per mode — everything else (the
    # objective product facts) is identical. Keep the JSON shape stable so the frontend
    # can render one approval card regardless of mode.
    if mode == "details":
        prompt_instructions = (
            "MODE: 'details' — close-ups. Compose `image_prompt` to render a single image with "
            "MULTIPLE MACRO close-ups of the same product on a pure white background: texture / "
            "material macro, primary logo / branding close-up, label / tag close-up, stitching or "
            "joinery close-up, hardware / fastener / connector close-up. Each close-up must show "
            "the EXACT same product (consistent colors, materials, finish). No text labels on the "
            "image itself. Studio lighting, sharp focus."
        )
    else:
        prompt_instructions = (
            "MODE: 'sheet' — multi-view product sheet. Compose `image_prompt` to render a single "
            "seamless image on pure white background with these views of the SAME product: front "
            "elevation (center, large), 3/4 angle, back view, side profile, top-down view, hero "
            "shot (slight angle, premium feel), and a small scale reference (e.g. held in hand or "
            "next to a neutral cube). All views must show identical product features (same color, "
            "material, finish, hardware). No text, no labels, no grid lines."
        )

    direction_block = f"\n\nUSER DIRECTION (optional, weave in if relevant):\n{direction.strip()}" if direction.strip() else ""

    system = f"""You are analyzing {len(images)} photo(s) of the SAME product. Cross-reference all views to build a complete factual description suitable for an AI image generator.

{prompt_instructions}

CRITICAL — COLOR EXTRACTION:
The reference photos may be shot under DRAMATIC studio lighting (colored gels, warm/cool tints, harsh directional light, colored backgrounds like yellow/orange/red floors). DO NOT report colored highlights from the set lighting as the product's actual color. Infer the product's TRUE BASE COLOR as it would appear under neutral 5000K daylight on a pure white background. For example: a silver car shot under warm yellow studio light looks champagne/gold in the photo — but its true color is silver. Report the TRUE color, not the apparent color. When unsure, mark the color with "neutral lighting inferred: <color>" and add a note.

CRITICAL — classify each photo by view: for EACH photo (0-indexed), identify which view of the product it shows. Use ONE of these labels:
  - "front"    : straight front view, 0° (or close to it)
  - "back"     : straight back view, 180°
  - "side"     : strict side profile, 90° perpendicular
  - "3-4"      : three-quarter angle (between front and side)
  - "top"      : top-down / cenital view
  - "rear-3-4" : three-quarter angle from behind
  - "interior" : inside the product (dashboard, seats, cockpit, cavity)
  - "detail"   : macro close-up of texture/logo/hardware/component
  - "hero"     : composite/styled hero shot (multiple angles or non-standard)
  - "other"    : doesn't fit cleanly — packaging, lifestyle, etc.

Return ONLY a JSON object (no markdown, no preamble) with this exact shape:
{{
  "name": "≤6 words, no adjectives like 'beautiful'",
  "category": "footwear | garment | bottle | bag | accessory | electronics | beauty | food | vehicle | furniture | other",
  "summary": "1-2 factual sentences",
  "shape": "form / silhouette in one phrase",
  "materials": ["..."],
  "colors": ["specific named shades, include hex when confident — e.g. 'deep burgundy ~ #7a1f2a'"],
  "scale": "real-world size hint or empty string",
  "packaging": "packaging description or empty string",
  "distinctive_details": ["concrete features visible in the photos"],
  "photo_views": [
    {{"index": 0, "view": "front", "confidence": 0.95, "notes": "straight front view, headlights centered"}},
    {{"index": 1, "view": "side", "confidence": 0.90, "notes": "..."}}
  ],
  "visible_views": ["DERIVED from photo_views — list of unique view labels covered"],
  "missing_views": ["canonical views NOT covered by photos that the user might want for the sheet"],
  "image_prompt": "polished English prompt for Nano Banana 2 to render the {'sheet' if mode == 'sheet' else 'detail close-ups'}. Describe layout, lighting, what each view shows. Strictly factual about the product (use the materials/colors/details above). White background. No text overlays."
}}

The `photo_views` array MUST have exactly {len(images)} entries (one per input photo, in the same order they were sent). The `confidence` is 0.0-1.0 — be honest, set lower when the view is ambiguous.

Describe ONLY what you SEE across the photos — never invent features not visible.{direction_block}

Respond with the JSON only."""

    raw = await _call_vision(system, images)
    # Best-effort JSON extraction — Gemini occasionally wraps in ```json.
    text = (raw or "").strip()
    if text.startswith("```"):
        text = text.replace("```json", "").replace("```", "").strip()
    if not text.startswith("{"):
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end != -1:
            text = text[start:end + 1]
    import json as _json
    try:
        return _json.loads(text)
    except _json.JSONDecodeError as first_err:
        # Recuperación de JSON truncado — si Gemini cortó la respuesta a mitad de
        # un array/string, intentamos rescatar lo más posible cerrando brackets
        # abiertos. Mejor un brief parcial editable que un error fatal.
        try:
            recovered = _try_recover_truncated_json(text)
            return _json.loads(recovered)
        except Exception:
            pass
        raise RuntimeError(f"Failed to parse product-sheet brief JSON: {first_err}; raw={raw[:400]}")


def _try_recover_truncated_json(text: str) -> str:
    """Cierra brackets/strings abiertos para recuperar un JSON truncado. Best-effort."""
    # Si el último char es una coma, sacarla.
    s = text.rstrip().rstrip(",")
    # Contar brackets abiertos.
    in_string = False
    escape = False
    stack: list[str] = []
    for ch in s:
        if escape:
            escape = False
            continue
        if ch == "\\" and in_string:
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch in "{[":
            stack.append(ch)
        elif ch in "}]" and stack:
            stack.pop()
    # Si quedamos a media string, cerrarla
    if in_string:
        s += '"'
    # Cerrar brackets en orden inverso
    for opener in reversed(stack):
        s += "}" if opener == "{" else "]"
    return s


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


async def describe_consistency_subject(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    """
    Analyze a CONSISTENCY reference for Manual Lab: figure out, on its own, WHAT the user
    wants to keep identical (a face, a product, an object, an animal, a logo, a garment…)
    and exactly which features define it. Powers the 'smart consistency' flow — the user
    drops any image and the lock prompt is built to match whatever it is.

    Returns:
        {
          "kind": "face" | "product" | "garment" | "object" | "animal" | "logo" | "other",
          "label": "<2-4 word label in Spanish for the UI badge>",
          "lock": "<one English sentence: the identifying features to preserve exactly>"
        }
    """
    prompt = """You are setting up an IDENTITY/CONSISTENCY lock for an AI image editor. Look at this
image and decide what the SINGLE main subject is — the thing the user wants kept visually identical
across other images.

Return STRICT JSON:
{
  "kind": "face" | "product" | "garment" | "object" | "animal" | "logo" | "other",
  "label": "<2-4 words in Spanish naming the subject, e.g. 'cartera roja', 'cara mujer', 'silla de madera'>",
  "lock": "<ONE English sentence listing the concrete identifying features that MUST be preserved exactly>"
}

Rules:
- "kind": pick the best category for the dominant subject. A human face/person -> "face". A sellable
  item (bag, shoe, bottle, gadget) -> "product". Clothing worn or flat -> "garment". An inanimate thing
  (furniture, prop, vehicle) -> "object". An animal/pet -> "animal". A brand mark/icon/wordmark -> "logo".
- "lock": be concrete and specific to THIS subject — shape, color(s), materials, texture, distinctive
  marks, proportions, and (for a face) facial features, hair, skin tone, age. This is what defines it.
- Output ONLY the JSON, no markdown."""

    raw = await _call_vision(prompt, [(image_bytes, mime_type)])
    cleaned = raw.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned.replace("```json", "").replace("```", "").strip()
    elif cleaned.startswith("```"):
        cleaned = cleaned.replace("```", "").strip()

    import json as _json
    try:
        data = _json.loads(cleaned)
        kind = str(data.get("kind", "object")).strip().lower()
        if kind not in {"face", "product", "garment", "object", "animal", "logo", "other"}:
            kind = "object"
        return {
            "kind": kind,
            "label": str(data.get("label", "")).strip()[:40] or "elemento",
            "lock": str(data.get("lock", "")).strip(),
        }
    except _json.JSONDecodeError:
        return {"kind": "object", "label": "elemento", "lock": cleaned[:300]}


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


async def analyze_motion_from_video(
    video_bytes: bytes,
    mime_type: str = "video/mp4",
    image_context: str = "",
) -> dict:
    """Versión liviana de analyze_video_direct enfocada SOLO en motion para
    image-to-video. Devuelve sugerencias concretas listas para inyectarse al
    prompt de Kling. No hace el análisis pesado de Content Analyzer (script,
    narrative_shape, detected_assets, visual_signature). Diseñada para correr
    desde el step Animate del Fashion Reel / UGC donde el usuario querría
    "inspirar" el motion de un clip desde una referencia.
    """
    prompt = f"""You are a motion designer analyzing a reference video to suggest how to animate a STATIC image.

The user has a still image and wants to animate it. Watch this video carefully and extract the MOTION DNA you'd transfer to that still.

{f'CONTEXT of the static image to animate: {image_context}' if image_context else ''}

Focus EXCLUSIVELY on motion — ignore style, color, identity, location. Just movement.

Analyze:
1. Subject movement: how does the person/object move? (walks, rotates, dances, gestures, holds something)
2. Camera movement: static / push-in / pull-back / orbit / handheld / pan / tilt
3. Pacing: slow & smooth / dynamic & energetic / staccato / fluid
4. Loop behavior: does it cycle, or has a clear start-end?
5. Key gesture or signature beat (the "moment" that defines the clip)

Respond ONLY with a valid JSON object — no markdown, no extra text. Schema:
{{
  "motion": "2-3 sentence English description of the EXACT motion to apply. Concrete. Use verbs. Reference camera + subject + pacing. Example: 'Model walks slowly toward camera with hands relaxed at sides, slight head turn to the right at the end. Camera holds steady with a barely perceptible push-in. Smooth fluid pace, no cuts.'",
  "pacing": "slow | medium | dynamic",
  "camera": "static | push-in | pull-back | orbit | handheld | pan | tilt",
  "signature_beat": "one phrase capturing the defining moment, or empty string"
}}"""

    payload = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {"inline_data": {"mime_type": mime_type, "data": base64.b64encode(video_bytes).decode()}},
            ],
        }],
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 800},
    }

    headers = {"Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY}
    async with httpx.AsyncClient(timeout=180) as client:
        res = await client.post(_gemini_url(GEMINI_VIDEO_MODEL), headers=headers, json=payload)
        res.raise_for_status()
        result = res.json()
        candidates = result.get("candidates", [])
        if not candidates:
            raise Exception("No response from Gemini Vision")
        raw = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()

    # Parse JSON (best-effort cleanup of markdown fences if Gemini wraps the reply).
    clean = raw
    if clean.startswith("```json"):
        clean = clean.replace("```json", "").replace("```", "").strip()
    elif clean.startswith("```"):
        clean = clean.replace("```", "").strip()
    if not clean.startswith("{"):
        start = clean.find("{")
        if start != -1:
            clean = clean[start:]
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        return {"motion": raw, "pacing": "medium", "camera": "static", "signature_beat": ""}


async def curate_motion_prompt(user_text: str, scene_context: str = "") -> str:
    """Toma un texto libre del usuario (en cualquier idioma, posiblemente desordenado
    o coloquial) y lo convierte en un motion prompt limpio, en inglés, listo para
    inyectar a Kling V3 Pro. NO inventa motion — respeta literalmente la intención
    del usuario, solo la traduce y ordena.
    Ejemplos de input → output:
      "que agarre la cartera con energía" → "Model picks up the bag with energy,
        a confident grip and a slight upward gesture as she lifts it."
      "se da vuelta lentamente mirando a cámara" → "Model rotates slowly and
        glances back over her shoulder toward camera, holding eye contact at the
        end of the turn."
    """
    if not GEMINI_API_KEY:
        return user_text  # fail open: pasar tal cual
    prompt = f"""You are a motion prompt curator for AI video models (Kling V3 Pro).

Your job: take the user's raw instruction below (probably in Spanish, possibly informal) and rewrite it as a clean, concrete English motion prompt — 1-3 sentences.

RULES:
- Keep the user's intent EXACTLY. Do not invent new motions.
- Translate to English (Kling responds best to English).
- Use concrete verbs (walks, turns, grips, tilts, glances, push-in, dolly-back) instead of abstract adjectives.
- Reference SUBJECT motion and CAMERA motion when applicable.
- No flowery language. No marketing speak. Just motion.
- Output ONLY the curated prompt. No quotes, no preamble, no JSON.

{f'SCENE CONTEXT (for grounding): {scene_context}' if scene_context else ''}

USER INSTRUCTION:
{user_text}

CURATED MOTION PROMPT:"""
    headers = {"Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY}
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 250},
    }
    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(_gemini_url(), headers=headers, json=payload)
        res.raise_for_status()
        result = res.json()
        candidates = result.get("candidates", [])
        if not candidates:
            return user_text
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
    # Cap del flash subido de 4000 → 8000 porque el brief de product_sheet con 8 fotos
    # + classifications + materials/colors/distinctive_details arrays superaba el
    # límite y devolvía JSON truncado. Reportado: "Expecting value: line 14".
    is_pro = "pro" in model.lower()
    payload = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {
            "temperature": 0.4,
            "maxOutputTokens": 16000 if is_pro else 8000,
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
