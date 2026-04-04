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
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


def is_configured() -> bool:
    return bool(GEMINI_API_KEY)


def _gemini_url() -> str:
    return f"{GEMINI_BASE}/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"


def _image_to_part(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    """Convert image bytes to Gemini inline_data part."""
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    return {"inline_data": {"mime_type": mime_type, "data": b64}}


async def describe_product(image_bytes: bytes, mime_type: str = "image/jpeg", product_name: str = "") -> str:
    """
    Analyze a product image and return a concise visual description.
    Used as context for image generation prompts.
    """
    prompt = f"""Describe this product image in a single paragraph (3-4 sentences max).
Focus ONLY on visual details useful for an AI image generator:
- Type of product (garment, accessory, etc.)
- Color, material, texture
- Shape, fit, silhouette
- Notable features (logo, pattern, hardware, stitching)
- How it looks when worn or displayed

Keep it factual and concise. No marketing language.
{f'Product name: {product_name}' if product_name else ''}

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
  "content_type": "UGC | editorial | product-ad | lifestyle | cinematic",
  "estimated_duration": "seconds",
  "key_insights": "what makes this content effective"
}}"""

    return await _call_vision(prompt, frame_images)


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
    prompt = f"""You are a creative strategist analyzing a video ad/content piece.

Watch the ENTIRE video carefully — visuals, audio, text on screen, pacing, everything.

{f'Source: {video_url}' if video_url else ''}
{f'Brand context for reference: {brand_context}' if brand_context else ''}

Provide a complete analysis:

1. SCRIPT/NARRATION: Transcribe or reconstruct what is being said (voiceover, dialogue, or on-screen text). Keep the original language.

2. SCENE BREAKDOWN: List each distinct scene/shot:
   - What's happening visually
   - Camera angle and movement
   - Duration estimate
   - Text or graphics on screen

3. VISUAL STYLE: Color palette (hex codes), lighting, aesthetic, transitions

4. AUDIO: Music style, voiceover tone, sound effects

5. STRUCTURE: Hook → Story → CTA breakdown, pacing

6. IMAGE PROMPTS: For each scene, write a Nano Banana 2 prompt (2-3 sentences, English) to recreate it

Respond with ONLY a JSON object:
{{
  "estimated_script": "full transcription/script",
  "scenes": [
    {{
      "frame": 1,
      "description": "what happens",
      "image_prompt": "Nano Banana prompt",
      "camera": "angle/movement",
      "mood": "atmosphere",
      "duration_estimate": "seconds"
    }}
  ],
  "style_guide": "overall visual style",
  "color_palette": ["#hex1", "#hex2"],
  "audio_description": "music and sound",
  "structure": "hook → story → cta",
  "content_type": "UGC | editorial | product-ad | lifestyle | cinematic",
  "estimated_duration": "total seconds",
  "key_insights": "what makes this effective"
}}"""

    return await _call_vision_with_video(prompt, video_bytes, mime_type)


async def _call_vision_with_video(prompt: str, video_bytes: bytes, mime_type: str) -> str:
    """Call Gemini with a video file."""
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY not configured")

    b64 = base64.b64encode(video_bytes).decode("utf-8")

    parts = [
        {"text": prompt},
        {"inline_data": {"mime_type": mime_type, "data": b64}},
    ]

    payload = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {
            "temperature": 0.4,
            "maxOutputTokens": 8000,
        },
    }

    async with httpx.AsyncClient(timeout=120) as client:
        res = await client.post(
            _gemini_url(),
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


async def _call_vision(prompt: str, images: list[tuple[bytes, str]]) -> str:
    """Call Gemini Vision with text prompt + images."""
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY not configured")

    parts = [{"text": prompt}]
    for img_bytes, mime in images:
        parts.append(_image_to_part(img_bytes, mime))

    payload = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {
            "temperature": 0.4,
            "maxOutputTokens": 4000,
        },
    }

    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(
            _gemini_url(),
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
