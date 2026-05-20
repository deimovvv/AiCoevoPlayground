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


# ══════════════════════════════════════════════════════════════
#  Voice Design (text-to-voice) — create voice from description
# ══════════════════════════════════════════════════════════════
#
# Two-step flow per ElevenLabs API:
#   1) text_to_voice.design(...) → returns N preview audios + generated_voice_ids
#   2) text_to_voice.create(generated_voice_id, name) → saves into the library
#      and returns a permanent voice_id (usable with generate_audio)


def create_voice_previews(
    voice_description: str,
    text: str,
    output_format: str = "mp3_44100_192",
    auto_generate_text: bool = False,
) -> list[dict]:
    """
    Generate voice previews from a text description. Returns a list of preview
    dicts: [{ "generated_voice_id": str, "audio_base_64": str (MP3 base64), "media_type": str }].

    voice_description: 20–1000 chars. Describe age, accent, tone, character.
        Examples:
        - "Hombre argentino de unos 30 años, voz canchera, tono medio, levemente rasposa"
        - "Female narrator, late 40s, warm and authoritative, slight British accent"
    text: 100–1000 chars. The text that gets spoken in each preview. Pick something
        representative of the brand voice so users can judge intonation.
    output_format: "mp3_44100_192" is highest mp3 quality. Other options include
        "mp3_44100_128", PCM, and µ-law. We use 192 for best preview fidelity.
    auto_generate_text: when True, ElevenLabs writes its own sample text from
        the description (useful when the description is rich but no sample given).
    """
    client = _get_client()

    # Defensive: ElevenLabs requires 20-1000 chars in description and 100-1000 in text.
    desc = (voice_description or "").strip()
    if len(desc) < 20:
        raise ValueError("voice_description must be at least 20 characters")
    sample = (text or "").strip()
    if len(sample) < 100:
        # CRITICAL: ElevenLabs decides the spoken language by the language of THIS text,
        # not the description. Padding with English used to make the preview speak in
        # English even when the user asked for a Spanish voice. Instead, repeat the
        # user's own text so the language stays consistent.
        if not sample:
            raise ValueError("text sample is required")
        repeated = sample
        while len(repeated) < 100:
            repeated = repeated + " " + sample
        sample = repeated[:1000]

    res = client.text_to_voice.create_previews(
        voice_description=desc,
        text=sample,
        output_format=output_format,
        auto_generate_text=auto_generate_text,
    )
    previews = getattr(res, "previews", None) or []
    out: list[dict] = []
    for p in previews:
        out.append({
            "generated_voice_id": getattr(p, "generated_voice_id", None),
            "audio_base_64": getattr(p, "audio_base_64", None),
            "media_type": getattr(p, "media_type", "audio/mpeg"),
            "duration_secs": getattr(p, "duration_secs", None),
        })
    return out


def save_designed_voice(
    generated_voice_id: str,
    voice_name: str,
    voice_description: str,
) -> str:
    """
    Promote one of the previews into a permanent voice in the user's ElevenLabs
    library. Returns the final voice_id (usable in generate_audio).
    """
    client = _get_client()
    desc = (voice_description or "").strip()
    if len(desc) < 20:
        desc = (desc + " — designed voice from Coevo Studio.")[:1000]

    res = client.text_to_voice.create_voice_from_preview(
        voice_name=voice_name.strip()[:100] or "Coevo Voice",
        voice_description=desc[:1000],
        generated_voice_id=generated_voice_id,
    )
    # Voice object — voice_id lives at the top level
    return getattr(res, "voice_id", None) or ""


# ══════════════════════════════════════════════════════════════
#  Instant Voice Cloning — clone a voice from audio samples
# ══════════════════════════════════════════════════════════════


def clone_voice(
    voice_name: str,
    audio_files: list[tuple[str, bytes, str]],
    description: Optional[str] = None,
) -> str:
    """
    Instant Voice Cloning: upload 1–10 audio samples, get back a voice_id.

    audio_files: list of (filename, bytes, content_type) tuples. ElevenLabs
        recommends 1–3 minutes of clean speech (no music/noise) for best
        results. Even 30 seconds works for instant clone.
    """
    if not audio_files:
        raise ValueError("clone_voice needs at least 1 audio sample")

    client = _get_client()
    # SDK accepts a list of tuples (filename, bytes, content_type) for multipart.
    files_payload: list = []
    for fname, fbytes, ctype in audio_files:
        files_payload.append((fname or "sample.mp3", fbytes, ctype or "audio/mpeg"))

    res = client.voices.add(
        name=voice_name.strip()[:100] or "Cloned Voice",
        files=files_payload,
        description=(description or "")[:500] or None,
    )
    return getattr(res, "voice_id", None) or ""
