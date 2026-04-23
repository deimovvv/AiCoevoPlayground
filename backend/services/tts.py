"""
ElevenLabs TTS Service
──────────────────────
Generates speech audio from text using the ElevenLabs API.
Default model: eleven_v3 (better emotion + Spanish).
"""

import os
from typing import Optional
from elevenlabs import ElevenLabs, VoiceSettings

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
    stability: Optional[float] = 0.5,
    similarity_boost: Optional[float] = 0.8,
    style: Optional[float] = 0.0,
    use_speaker_boost: Optional[bool] = True,
    speed: Optional[float] = 1.0,
) -> bytes:
    """
    Generate speech audio from text.

    Voice settings (ElevenLabs voice_settings):
      - stability: 0.0–1.0. "Natural" ≈ 0.5. Lower = more expressive, higher = monotone.
      - similarity_boost: 0.0–1.0. Higher = more faithful to voice clone.
      - style: 0.0–1.0. Emotion exaggeration. 0 = natural.
      - use_speaker_boost: boolean. Enhance speaker clarity.
      - speed: 0.7–1.2. Playback speed multiplier.

    Returns raw audio bytes (MP3).
    """
    client = _get_client()
    voice = voice_id or DEFAULT_VOICE_ID

    voice_settings = VoiceSettings(
        stability=stability if stability is not None else 0.5,
        similarity_boost=similarity_boost if similarity_boost is not None else 0.8,
        style=style if style is not None else 0.0,
        use_speaker_boost=use_speaker_boost if use_speaker_boost is not None else True,
        speed=speed if speed is not None else 1.0,
    )

    audio_gen = client.text_to_speech.convert(
        voice_id=voice,
        text=text,
        model_id=model_id,
        output_format=output_format,
        voice_settings=voice_settings,
    )

    return b"".join(audio_gen)


def is_configured() -> bool:
    return ELEVENLABS_API_KEY is not None
