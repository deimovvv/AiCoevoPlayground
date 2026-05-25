"""
HeyGen Avatar 4 Service (via Fal AI)
─────────────────────────────────────
Generates talking-head videos from a static image + text/audio.
Uses the Fal queue pattern (submit → poll → result).

Replaces the old Fal Fabric lip-sync with HeyGen's superior avatar animation.
"""

import os
import httpx
from services.fal_errors import friendly_error

FAL_BASE = "https://queue.fal.run"
FAL_MODEL = "fal-ai/heygen/avatar4/image-to-video"       # Submit endpoint
FAL_MODEL_BASE = "fal-ai/heygen"                         # Status/result endpoint


def _get_key() -> str:
    return os.getenv("FAL_KEY", "")


def _headers() -> dict:
    return {
        "Authorization": f"Key {_get_key()}",
        "Content-Type": "application/json",
    }


def is_configured() -> bool:
    key = _get_key()
    return key is not None and len(key) > 0


async def create_video(
    image_url: str,
    prompt: str = "",
    voice: str = "Melissa",
    audio_url: str = "",
    expression: str = "",
    talking_style: str = "expressive",
    resolution: str = "720p",
    aspect_ratio: str = "9:16",
    caption: bool = False,
) -> str:
    """
    Submit a HeyGen Avatar 4 job via Fal.
    Returns a request_id for status polling.

    Either provide `prompt` (text the avatar speaks) or `audio_url` (lip-sync to audio).
    """
    payload: dict = {
        "image_url": image_url,
        "talking_style": talking_style,
        "resolution": resolution,
        "aspect_ratio": aspect_ratio,
        "caption": caption,
    }

    if audio_url:
        payload["audio_url"] = audio_url
    elif prompt:
        payload["prompt"] = prompt
        if voice:
            payload["voice"] = voice

    if expression:
        payload["expression"] = expression

    print(f"[heygen-avatar4] Submitting job...")
    print(f"[heygen-avatar4] Image: {image_url[:80]}")
    print(f"[heygen-avatar4] Mode: {'audio_url' if audio_url else 'prompt'}")

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            f"{FAL_BASE}/{FAL_MODEL}",
            headers=_headers(),
            json=payload,
        )

    print(f"[heygen-avatar4] Submit response: {res.status_code}")

    if res.status_code not in (200, 201):
        print(f"[heygen-avatar4] Submit FAILED: {res.text[:500]}")
        raise Exception(friendly_error(res.text, res.status_code, "el lip-sync con HeyGen"))

    data = res.json()
    request_id = data.get("request_id")
    print(f"[heygen-avatar4] Got request_id: {request_id}")

    if not request_id:
        video = data.get("video", {})
        if video.get("url"):
            return f"SYNC:{video['url']}"
        raise Exception(f"No request_id in response: {data}")

    return request_id


async def get_status(request_id: str) -> dict:
    """Check the status of a HeyGen Avatar 4 job."""
    if request_id.startswith("SYNC:"):
        return {
            "request_id": request_id,
            "status": "completed",
            "video_url": request_id[5:],
        }

    url = f"{FAL_BASE}/{FAL_MODEL_BASE}/requests/{request_id}/status"

    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.get(url, headers=_headers(), params={"logs": "true"})

    if res.status_code not in (200, 202):
        raise Exception(f"Status check failed ({res.status_code}): {res.text[:300]}")

    data = res.json()
    status_raw = data.get("status", "UNKNOWN").upper()
    status_map = {
        "IN_QUEUE": "pending",
        "IN_PROGRESS": "processing",
        "COMPLETED": "completed",
        "FAILED": "failed",
    }

    return {
        "request_id": request_id,
        "status": status_map.get(status_raw, "unknown"),
        "video_url": None,
        "error": data.get("error"),
    }


async def get_result(request_id: str) -> dict:
    """Fetch the final result of a completed HeyGen Avatar 4 job."""
    if request_id.startswith("SYNC:"):
        return {
            "request_id": request_id,
            "status": "completed",
            "video_url": request_id[5:],
        }

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.get(
            f"{FAL_BASE}/{FAL_MODEL_BASE}/requests/{request_id}",
            headers=_headers(),
        )

    if res.status_code not in (200, 202):
        raise Exception(f"Result fetch failed ({res.status_code}): {res.text[:300]}")

    data = res.json()
    video = data.get("video", {})

    return {
        "request_id": request_id,
        "status": "completed",
        "video_url": video.get("url"),
        "content_type": video.get("content_type"),
        "file_size": video.get("file_size"),
        "error": None,
    }
