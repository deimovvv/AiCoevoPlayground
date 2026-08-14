"""
Google Lyria 2 (via Fal) — música instrumental de fondo
────────────────────────────────────────────────────────
Genera un bed instrumental para "fondear" el video sin protagonismo. El mood
sale del brief/guión (Gemini) o se elige a mano. La mezcla con ducking (bajar la
música cuando hay voz) se hace en el paso de render con FFmpeg sidechain — acá
solo se genera el track. Ver docs/video-dialogue-pipeline.md.

$0.10 / 30s. Output: WAV url. REST flow (Fal queue): submit → poll → result.
"""

import httpx
from services.fal_errors import friendly_error
from services.fal_lipsync import _get_key, _headers, is_configured  # noqa: F401

FAL_BASE = "https://queue.fal.run"
FAL_MODEL = "fal-ai/lyria2"
FAL_MODEL_BASE = "fal-ai/lyria2"

# Presets de mood — instrumental, background, sin voz (feedback del cliente PROMAN).
MOOD_PROMPTS = {
    "alegre": (
        "Traditional Mexican instrumental, warm acoustic guitars, gentle vihuela and "
        "light trumpet with a mariachi/norteño feel, upbeat but soft and warm, folk "
        "documentary background bed, fully instrumental, no vocals, no singing."
    ),
    "problematica": (
        "Soft documentary underscore, ambient piano and warm strings, contemplative and "
        "hopeful, low-key podcast-style background bed that accompanies without taking over, "
        "slow tempo, fully instrumental, no vocals, no singing."
    ),
    "neutral": (
        "Gentle instrumental background bed, warm and understated, subtle acoustic textures, "
        "documentary underscore, fully instrumental, no vocals, no singing."
    ),
}
DEFAULT_NEGATIVE = "vocals, singing, lyrics, spoken word, rap, harsh, distorted, aggressive drums"


def build_prompt(mood: str = "neutral", custom: str = "") -> str:
    """Prompt final: preset por mood + extra opcional del usuario."""
    base = MOOD_PROMPTS.get((mood or "neutral").lower(), MOOD_PROMPTS["neutral"])
    return f"{base} {custom.strip()}".strip() if custom.strip() else base


async def create_music(prompt: str, negative_prompt: str = DEFAULT_NEGATIVE, seed: int = None) -> str:
    """Submit a Lyria music job. Returns request_id for polling."""
    payload = {"prompt": prompt, "negative_prompt": negative_prompt}
    if seed is not None:
        payload["seed"] = seed
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(f"{FAL_BASE}/{FAL_MODEL}", headers=_headers(), json=payload)

    if res.status_code not in (200, 201):
        raise Exception(friendly_error(res.text, res.status_code, "la música (Lyria)"))

    data = res.json()
    request_id = data.get("request_id")
    if not request_id:
        audio = data.get("audio", {})
        if audio.get("url"):
            return f"SYNC:{audio['url']}"
        raise Exception(f"No request_id in Lyria response: {data}")
    return request_id


async def get_status(request_id: str) -> dict:
    if request_id.startswith("SYNC:"):
        return {"request_id": request_id, "status": "completed", "audio_url": request_id[5:], "error": None}

    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.get(
            f"{FAL_BASE}/{FAL_MODEL_BASE}/requests/{request_id}/status",
            headers=_headers(), params={"logs": "true"},
        )
    if res.status_code not in (200, 202):
        raise Exception(friendly_error(res.text, res.status_code, "la música (Lyria)"))

    data = res.json()
    status_map = {"IN_QUEUE": "pending", "IN_PROGRESS": "processing", "COMPLETED": "completed", "FAILED": "failed"}
    return {
        "request_id": request_id,
        "status": status_map.get(data.get("status", "UNKNOWN").upper(), "unknown"),
        "audio_url": None,
        "error": data.get("error"),
    }


async def get_result(request_id: str) -> dict:
    if request_id.startswith("SYNC:"):
        return {"request_id": request_id, "status": "completed", "audio_url": request_id[5:], "error": None}

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.get(f"{FAL_BASE}/{FAL_MODEL_BASE}/requests/{request_id}", headers=_headers())
    if res.status_code not in (200, 202):
        raise Exception(friendly_error(res.text, res.status_code, "la música (Lyria)"))

    data = res.json()
    audio = data.get("audio", {})
    return {
        "request_id": request_id,
        "status": "completed",
        "audio_url": audio.get("url"),
        "error": None,
    }
