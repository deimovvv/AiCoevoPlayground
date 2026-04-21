"""
Sync Lipsync V3 Service (via Fal AI)
─────────────────────────────────────
Generates lip-synced video from an existing video + audio track.
Uses the Fal queue pattern (submit → poll → result).

Wraps fal-ai/sync-lipsync/v3 which accepts a video_url and audio_url.
sync_mode controls how the audio/video duration mismatch is handled:
  cut_off  — truncate at the shorter duration (default)
  loop     — loop the shorter media
  bounce   — loop with reverse on each cycle
  silence  — pad with silence / freeze frame
  remap    — stretch/compress to match durations
"""

import os
import httpx

FAL_BASE = "https://queue.fal.run"
FAL_MODEL = "fal-ai/sync-lipsync/v3"        # Submit endpoint
FAL_MODEL_BASE = "fal-ai/sync-lipsync"       # Status/result endpoint


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


async def create_lipsync(
    video_url: str,
    audio_url: str,
    sync_mode: str = "cut_off",
) -> str:
    """
    Submit a Sync Lipsync V3 job via Fal.
    Returns a request_id for status polling.

    sync_mode options: cut_off, loop, bounce, silence, remap.
    """
    payload = {
        "video_url": video_url,
        "audio_url": audio_url,
        "sync_mode": sync_mode,
    }

    print(f"[sync-lipsync] Submitting job...")
    print(f"[sync-lipsync] Video: {video_url[:80]}")
    print(f"[sync-lipsync] Audio: {audio_url[:80]}")
    print(f"[sync-lipsync] sync_mode: {sync_mode}")

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            f"{FAL_BASE}/{FAL_MODEL}",
            headers=_headers(),
            json=payload,
        )

    print(f"[sync-lipsync] Submit response: {res.status_code}")

    if res.status_code not in (200, 201):
        print(f"[sync-lipsync] Submit FAILED: {res.text[:500]}")
        raise Exception(f"Sync Lipsync submit failed ({res.status_code}): {res.text[:400]}")

    data = res.json()
    request_id = data.get("request_id")
    print(f"[sync-lipsync] Got request_id: {request_id}")

    if not request_id:
        video = data.get("video", {})
        if video.get("url"):
            return f"SYNC:{video['url']}"
        raise Exception(f"No request_id in response: {data}")

    return request_id


async def get_status(request_id: str) -> dict:
    """Check the status of a Sync Lipsync V3 job."""
    if request_id.startswith("SYNC:"):
        return {
            "request_id": request_id,
            "status": "completed",
            "video_url": request_id[5:],
            "error": None,
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
    """Fetch the final result of a completed Sync Lipsync V3 job."""
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
    }
