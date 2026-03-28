"""
Gemini Script Generation Service
─────────────────────────────────
Generates UGC video scripts using Gemini with brand context.
Also can auto-generate "Video Objectives" from brand + product info.
"""

import os
import json
import httpx

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-2.0-flash"
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


def is_configured() -> bool:
    return bool(GEMINI_API_KEY)


def _gemini_url(model: str = GEMINI_MODEL) -> str:
    return f"{GEMINI_BASE}/{model}:generateContent?key={GEMINI_API_KEY}"


async def _call_gemini(system_prompt: str, user_msg: str) -> str:
    """Send a request to Gemini and return the text response."""
    if not GEMINI_API_KEY:
        raise RuntimeError("Gemini API key not configured. Add GEMINI_API_KEY to your .env file.")

    payload = {
        "contents": [
            {"role": "user", "parts": [{"text": f"{system_prompt}\n\n---\n\n{user_msg}"}]}
        ],
        "generationConfig": {
            "temperature": 0.8,
            "maxOutputTokens": 2000,
        }
    }

    async with httpx.AsyncClient(timeout=60) as client:
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
    """
    Auto-generate a 'Video Objective' paragraph based on brand + product.
    The user can then edit it before generating the full script.
    """
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
#  Generate Script (3-4 scenes with image prompts)
# ══════════════════════════════════════════════════════════════

async def generate_scripts(
    brand_context: str,
    video_objective: str = "",
    product_name: str = "",
    tone: str = "engaging",
    platform: str = "tiktok",
    language: str = "es",
) -> list[dict]:
    """
    Generate a UGC video script with 3-4 scenes using Gemini.
    Returns a list containing the parsed JSON scenes array.
    """
    lang_instruction = "Responde en español." if language == "es" else "Respond in English."

    system_prompt = f"""You are an expert UGC (User Generated Content) video director for short-form platforms.

BRAND CONTEXT (Use this to shape tone, vocabulary, messaging, and visual aesthetics):
---
{brand_context}
---

RULES:
- Outline a UGC video in 3 or 4 distinct scenes/acts.
- Keep the script short, natural, and highly engaging.
- Ensure the final scene includes a clear Call to Action (CTA) as requested.
- Strictly follow the user's VIDEO OBJECTIVE below.
- {lang_instruction}
- Tone: {tone}

OUTPUT FORMAT:
Return ONLY a valid JSON array of objects representing the scenes (3 or 4 scenes total). Do not return markdown blocks like ```json.
Each object must have:
- "id": string (e.g. "scene_1")
- "title": string (e.g. "Acto 1: Hook")
- "script": string (The exact spoken text, 1-2 sentences)
- "image_prompt": string (A highly detailed image generation prompt to create the scene visually. Incorporate brand context and product details).

Example:
[
  {{"id": "scene_1", "title": "Acto 1: Hook", "script": "...", "image_prompt": "..."}},
  ...
]"""

    user_msg = f"Write a 3-4 act UGC script."
    if product_name:
        user_msg += f" \nProduct: {product_name}"
    if video_objective:
        user_msg += f"\nVIDEO OBJECTIVE / NARRATIVE PURPOSE:\n{video_objective}"

    content = await _call_gemini(system_prompt, user_msg)

    # Clean up possible markdown wrappers
    if content.startswith("```json"):
        content = content.replace("```json", "").replace("```", "").strip()
    elif content.startswith("```"):
        content = content.replace("```", "").strip()

    try:
        scenes = json.loads(content)
        return [scenes]
    except json.JSONDecodeError as e:
        raise Exception(f"Failed to parse JSON script: {str(e)}. Received: {content[:200]}")
