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
    if len(system_prompt) > 4000:
        system_prompt = system_prompt[:4000] + "\n\n[... truncated for length ...]"

    full_text = f"{system_prompt}\n\n---\n\n{user_msg}"
    print(f"[gemini] Sending prompt ({len(full_text)} chars)")

    payload = {
        "contents": [
            {"role": "user", "parts": [{"text": f"{system_prompt}\n\n---\n\n{user_msg}"}]}
        ],
        "generationConfig": {
            "temperature": 0.8,
            "maxOutputTokens": 8000,
            "responseMimeType": "application/json",
        },
        "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_ONLY_HIGH"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_ONLY_HIGH"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_ONLY_HIGH"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_ONLY_HIGH"},
        ],
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
) -> list[dict]:
    """
    Generate a UGC video script with 4 scenes using Gemini.
    If prompt_override is provided (from PromptBuilder), use that as the system prompt.
    Returns a list containing the parsed JSON scenes array.
    """
    if prompt_override:
        system_prompt = prompt_override
    else:
        lang_instruction = "Write the 'script' field in Spanish." if language == "es" else "Write the 'script' field in English."
        system_prompt = f"""You are an expert UGC video director.

BRAND CONTEXT:
---
{brand_context}
---

Create EXACTLY 4 scenes: Hook, Story 1, Story 2, CTA.
{lang_instruction} Tone: {tone}. Platform: {platform}.
Return ONLY a valid JSON array. Keys: "id", "title", "script", "image_prompt"."""

    user_msg = "Generate the UGC video script now. Respond with ONLY a JSON array, nothing else."
    if product_name:
        user_msg += f"\nProduct: {product_name}"
    if video_objective:
        user_msg += f"\nVIDEO OBJECTIVE:\n{video_objective}"
    user_msg += "\n\nREMINDER: Your response must be ONLY a JSON array starting with [ and ending with ]. No text before or after."

    content = await _call_gemini(system_prompt, user_msg)

    # Clean up — extract JSON array from whatever Gemini returns
    # Remove markdown wrappers
    content = content.strip()
    if content.startswith("```json"):
        content = content.replace("```json", "").replace("```", "").strip()
    elif content.startswith("```"):
        content = content.replace("```", "").strip()

    # If Gemini returned markdown/text instead of JSON, try to find JSON array inside
    if not content.startswith("["):
        start = content.find("[")
        end = content.rfind("]")
        if start != -1 and end != -1 and end > start:
            content = content[start:end + 1]

    try:
        scenes = json.loads(content)
        return [scenes]
    except json.JSONDecodeError as e:
        raise Exception(f"Failed to parse JSON script: {str(e)}. Received: {content[:200]}")
