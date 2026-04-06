"""
ElevenLabs TTS Service
──────────────────────
Generates speech audio from text using the ElevenLabs API.
"""

import os
from typing import Optional
from elevenlabs import ElevenLabs

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
DEFAULT_VOICE_ID = os.getenv("VOICE_ID_ELIAS", "POQuTryNv2hmgg36pjcD")

_client: Optional[ElevenLabs] = None


def _get_client() -> ElevenLabs:
    global _client
    if _client is None:
        if not ELEVENLABS_API_KEY:
            raise RuntimeError("ElevenLabs API key not configured. Set ELEVENLABS_API_KEY in .env.")
        _client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
    return _client


def generate_audio(
    text: str,
    voice_id: Optional[str] = None,
    model_id: str = "eleven_v3",
    output_format: str = "mp3_44100_128",
) -> bytes:
    """
    Generate speech audio from text.
    Returns raw audio bytes (MP3).
    """
    client = _get_client()
    voice = voice_id or DEFAULT_VOICE_ID

    audio_gen = client.text_to_speech.convert(
        voice_id=voice,
        text=text,
        model_id=model_id,
        output_format=output_format,
    )

    # Collect all chunks into bytes
    return b"".join(audio_gen)


def is_configured() -> bool:
    return ELEVENLABS_API_KEY is not None
