"""
Gemini Chat Service
───────────────────
Multi-turn chat with brand context injected as system prompt.
Uses PromptBuilder for dynamic prompt assembly.
"""

import os
import httpx
from typing import List, Dict

from services.prompt_builder import build_chat_system_prompt

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


def is_configured() -> bool:
    return bool(GEMINI_API_KEY)


def _gemini_url() -> str:
    return f"{GEMINI_BASE}/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"


async def chat(
    brand: dict,
    messages: List[Dict[str, str]],
) -> str:
    """
    Send a multi-turn chat to Gemini with brand context.
    messages: list of {"role": "user"|"assistant", "content": "..."}
    Returns the assistant's reply text.
    """
    if not GEMINI_API_KEY:
        raise RuntimeError("Gemini API key not configured. Add GEMINI_API_KEY to your .env file.")

    system_prompt = build_chat_system_prompt(brand)

    # Build Gemini contents array: system context as first user message, then conversation
    contents = []

    # Inject system prompt as the first user turn
    contents.append({
        "role": "user",
        "parts": [{"text": system_prompt + "\n\n---\n\nAcknowledge that you understand the brand context. Be brief."}],
    })
    contents.append({
        "role": "model",
        "parts": [{"text": "Understood. I'm ready to help with creative tasks for this brand."}],
    })

    # Append conversation history
    for msg in messages:
        role = "model" if msg["role"] == "assistant" else "user"
        contents.append({
            "role": role,
            "parts": [{"text": msg["content"]}],
        })

    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": 0.85,
            "maxOutputTokens": 4000,
        },
    }

    async with httpx.AsyncClient(timeout=90) as client:
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

    text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
    return text
