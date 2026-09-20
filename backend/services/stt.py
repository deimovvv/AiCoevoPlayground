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

from . import llm_router

GEMINI_MODEL = "gemini-2.5-flash"   # legacy, el modelo real lo decide llm_router


def is_configured() -> bool:
    return bool(llm_router.google_key())


async def transcribe(audio_bytes: bytes, mime: str = "audio/webm", language: str = "es") -> str:
    """Transcribe audio bytes to text. Returns the plain transcription."""
    if not llm_router.google_key():
        raise RuntimeError("Falta una key de Google (NANOBANANA_API_KEY o GEMINI_API_KEY)")
    if not audio_bytes:
        return ""

    instruction = (
        "Transcribí este audio EXACTAMENTE, en español rioplatense (Argentina), respetando la jerga y el tono. "
        "Devolvé SOLO la transcripción, sin comillas, sin comentarios, sin etiquetas."
        if language == "es"
        else "Transcribe this audio EXACTLY. Return ONLY the transcription, no quotes, no commentary."
    )
    text = await llm_router.call_audio(instruction, audio_bytes, mime)
    # Gemini a veces envuelve la transcripcion en comillas.
    return text.strip().strip('"').strip("'").strip()
