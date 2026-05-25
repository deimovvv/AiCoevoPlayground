"""
Speech-to-Text Service (via Gemini, multimodal audio)
──────────────────────────────────────────────────────
Transcribes a short voice note to text. Uses Gemini 2.5 Flash (already integrated,
handles Argentine/rioplatense Spanish + jerga well in context). No extra dependency.

Used by the chat mic button: record → POST audio → transcription → fills the input.
"""

import os
import base64
import httpx

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


def is_configured() -> bool:
    return bool(GEMINI_API_KEY)


async def transcribe(audio_bytes: bytes, mime: str = "audio/webm", language: str = "es") -> str:
    """Transcribe audio bytes to text. Returns the plain transcription."""
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY not configured")
    if not audio_bytes:
        return ""

    instruction = (
        "Transcribí este audio EXACTAMENTE, en español rioplatense (Argentina), respetando la jerga y el tono. "
        "Devolvé SOLO la transcripción, sin comillas, sin comentarios, sin etiquetas."
        if language == "es"
        else "Transcribe this audio EXACTLY. Return ONLY the transcription, no quotes, no commentary."
    )
    b64 = base64.b64encode(audio_bytes).decode("ascii")
    payload = {
        "contents": [{
            "role": "user",
            "parts": [
                {"inlineData": {"mimeType": mime, "data": b64}},
                {"text": instruction},
            ],
        }],
        "generationConfig": {"temperature": 0.0, "maxOutputTokens": 2000},
    }
    url = f"{GEMINI_BASE}/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(url, headers={"Content-Type": "application/json"}, json=payload)
    if res.status_code != 200:
        raise Exception(f"STT error ({res.status_code}): {res.text[:300]}")
    data = res.json()
    candidates = data.get("candidates", [])
    if not candidates:
        return ""
    parts = candidates[0].get("content", {}).get("parts", [{}])
    text = "".join(p.get("text", "") for p in parts).strip()
    # Strip wrapping quotes Gemini sometimes adds
    return text.strip().strip('"').strip("'").strip()
