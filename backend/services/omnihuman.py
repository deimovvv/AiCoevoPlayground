"""
ByteDance OmniHuman v1.5 (via Fal) — talking-character desde imagen + audio
──────────────────────────────────────────────────────────────────────────
Audio-driven: toma una imagen (rostro real o ilustrado — funciona sobre papel/
juguete) + audio de ElevenLabs y anima la boca sincronizada al audio. A diferencia
de Veo (prompt-driven), NO necesita cara grande ni prompt de diálogo, pero anima
UNA sola cara por clip y deja el fondo quieto. Ver docs/video-dialogue-pipeline.md.

v1.5 (no v1): soporta audios largos (hasta ~60s) y resolución 720p/1080p.
v1 truncaba audios >~5s y taggeaba mal la rotación.

REST flow (Fal queue): submit → poll status → fetch result.
El audio se sube con fal_lipsync.upload_file_v2 (misma CDN de Fal).
"""

import httpx
from services.fal_errors import friendly_error
from services.fal_lipsync import _get_key, _headers, is_configured, upload_file_v2  # noqa: F401

FAL_BASE = "https://queue.fal.run"
FAL_MODEL = "fal-ai/bytedance/omnihuman/v1.5"   # full path for submit
FAL_MODEL_BASE = "fal-ai/bytedance"             # base for status/result


async def create_talking_video(
    image_url: str,
    audio_url: str,
    resolution: str = "720p",
) -> str:
    """Submit an OmniHuman talking-video job. Returns request_id for polling."""
    payload = {
        "image_url": image_url,
        "audio_url": audio_url,
        "resolution": resolution,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(f"{FAL_BASE}/{FAL_MODEL}", headers=_headers(), json=payload)

    if res.status_code not in (200, 201):
        raise Exception(friendly_error(res.text, res.status_code, "OmniHuman"))

    data = res.json()
    request_id = data.get("request_id")
    if not request_id:
        video_data = data.get("video", {})
        if video_data.get("url"):
            return f"SYNC:{video_data['url']}"
        raise Exception(f"No request_id in OmniHuman response: {data}")
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
        raise Exception(friendly_error(res.text, res.status_code, "OmniHuman"))

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
        raise Exception(friendly_error(res.text, res.status_code, "OmniHuman"))

    data = res.json()
    video_data = data.get("video", {})
    return {
        "request_id": request_id,
        "status": "completed",
        "video_url": video_data.get("url"),
        "duration": video_data.get("duration"),
        "error": None,
    }
