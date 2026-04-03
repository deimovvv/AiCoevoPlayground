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
    prompt = f"""You are a brand strategist analyzing visual references for an advertising campaign.

Analyze ALL the provided reference images and create a VISUAL GUIDE that captures the brand's visual identity.

{f'Brand context: {brand_context}' if brand_context else ''}

Your visual guide must include:

1. COLOR PALETTE: The dominant colors, accent colors, and how they're used (warm/cool, saturated/muted)
2. LIGHTING STYLE: Natural/studio, direction, mood, shadows, color temperature
3. COMPOSITION: Framing patterns, use of space, subject placement, angles
4. TEXTURE & MATERIAL: Surface qualities, fabric behavior, product presentation
5. MOOD & TONE: The overall feeling — luxury, casual, editorial, street, minimal, bold
6. TYPOGRAPHY HINTS: If visible — serif/sans, weight, placement
7. RECURRING ELEMENTS: Patterns, props, backgrounds, color blocking

Write this as a concise creative brief (1 paragraph per section, no bullet points).
This guide will be used to generate NEW images that match this exact visual style.

Respond in English."""

    return await _call_vision(prompt, reference_images)


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
            "maxOutputTokens": 2000,
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
