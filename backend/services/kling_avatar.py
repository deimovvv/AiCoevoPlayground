"""
Kling AI Avatar v2 (via Fal) — talking-character desde imagen + audio
─────────────────────────────────────────────────────────────────────
Audio-driven como OmniHuman (anima la boca al audio, una cara por clip, fondo
quieto), pero MÁS BARATO: v2 standard ~$0.056/s vs $0.16/s de OmniHuman v1.5.
El clip dura lo que el audio. Ver docs/video-dialogue-pipeline.md.

Tiers: `standard` (barato, default) | `pro` (~$0.115/s, más calidad).
REST flow (Fal queue). El audio se sube con fal_lipsync.upload_file_v2.
"""

import httpx
from services.fal_errors import friendly_error
from services.fal_lipsync import _get_key, _headers, is_configured, upload_file_v2  # noqa: F401

FAL_BASE = "https://queue.fal.run"
FAL_MODELS = {
    "standard": "fal-ai/kling-video/ai-avatar/v2/standard",
    "pro": "fal-ai/kling-video/ai-avatar/v2/pro",
}
FAL_MODEL_BASE = "fal-ai/kling-video"  # base for status/result


def resolve_model(tier: str = "standard") -> str:
    return FAL_MODELS.get(tier, FAL_MODELS["standard"])


async def create_talking_video(
    image_url: str,
    audio_url: str,
    tier: str = "standard",
) -> str:
    """Submit a Kling AI Avatar job. Returns request_id for polling."""
    payload = {"image_url": image_url, "audio_url": audio_url}
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(f"{FAL_BASE}/{resolve_model(tier)}", headers=_headers(), json=payload)

    if res.status_code not in (200, 201):
        raise Exception(friendly_error(res.text, res.status_code, "Kling AI Avatar"))

    data = res.json()
    request_id = data.get("request_id")
    if not request_id:
        video_data = data.get("video", {})
        if video_data.get("url"):
            return f"SYNC:{video_data['url']}"
        raise Exception(f"No request_id in Kling Avatar response: {data}")
    return request_id


async def get_status(request_id: str) -> dict:
    if request_id.startswith("SYNC:"):
        return {"request_id": request_id, "status": "completed", "video_url": request_id[5:], "error": None}

    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.get(
            f"{FAL_BASE}/{FAL_MODEL_BASE}/requests/{request_id}/status",
            headers=_headers(), params={"logs": "true"},
        )
    if res.status_code not in (200, 202):
        raise Exception(friendly_error(res.text, res.status_code, "Kling AI Avatar"))

    data = res.json()
    status_map = {"IN_QUEUE": "pending", "IN_PROGRESS": "processing", "COMPLETED": "completed", "FAILED": "failed"}
    return {
        "request_id": request_id,
        "status": status_map.get(data.get("status", "UNKNOWN").upper(), "unknown"),
        "video_url": None,
        "logs": [l.get("message", "") for l in data.get("logs", [])],
        "error": data.get("error"),
    }


async def get_result(request_id: str) -> dict:
    if request_id.startswith("SYNC:"):
        return {"request_id": request_id, "status": "completed", "video_url": request_id[5:], "error": None}

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.get(f"{FAL_BASE}/{FAL_MODEL_BASE}/requests/{request_id}", headers=_headers())
    if res.status_code not in (200, 202):
        raise Exception(friendly_error(res.text, res.status_code, "Kling AI Avatar"))

    data = res.json()
    video_data = data.get("video", {})
    return {
        "request_id": request_id,
        "status": "completed",
        "video_url": video_data.get("url"),
        "duration": video_data.get("duration"),
        "error": None,
    }
