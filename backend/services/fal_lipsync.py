"""
Fal AI Lip Sync Service
───────────────────────
Uses fal-ai/sync-lipsync/v2/pro for high-quality lip sync.

Unlike HeyGen (image + audio → video), Fal takes:
  video + audio → lip-synced video

REST API flow:
  1. Upload audio to Fal storage
  2. Submit lip sync job (queue)
  3. Poll status until completed
  4. Return result video URL
"""

import os
import httpx
from services.fal_errors import friendly_error
import asyncio

FAL_BASE = "https://queue.fal.run"
FAL_MODEL = "fal-ai/sync-lipsync/v2/pro"  # Full path for submit
FAL_MODEL_BASE = "fal-ai/sync-lipsync"  # Base model for status/result


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


# ══════════════════════════════════════════════════════════════
#  File Upload (to Fal storage)
# ══════════════════════════════════════════════════════════════

async def upload_file(file_bytes: bytes, filename: str, content_type: str = "audio/mpeg") -> str:
    """
    Upload a file to Fal's storage.
    Returns a publicly accessible URL for the uploaded file.
    """
    async with httpx.AsyncClient(timeout=120) as client:
        res = await client.post(
            "https://fal.run/fal-ai/fal-storage/upload",
            headers={"Authorization": f"Key {_get_key()}"},
            files={"file": (filename, file_bytes, content_type)},
        )

    if res.status_code != 200:
        # Fallback: try the REST upload endpoint
        async with httpx.AsyncClient(timeout=120) as client:
            res = await client.put(
                f"https://fal.run/storage/upload/{filename}",
                headers={
                    "Authorization": f"Key {FAL_API_KEY}",
                    "Content-Type": content_type,
                },
                content=file_bytes,
            )

    if res.status_code != 200:
        raise Exception(f"Fal file upload failed ({res.status_code}): {res.text[:300]}")

    data = res.json()
    return data.get("url") or data.get("file_url") or data.get("access_url", "")


async def upload_file_v2(file_bytes: bytes, filename: str, content_type: str = "audio/mpeg") -> str:
    """
    Upload a file to Fal's CDN storage using the REST endpoint.
    Returns a publicly accessible URL.
    """
    # Step 1: Initiate upload
    async with httpx.AsyncClient(timeout=60) as client:
        init_res = await client.post(
            "https://rest.alpha.fal.ai/storage/upload/initiate",
            headers={"Authorization": f"Key {_get_key()}"},
            json={"file_name": filename, "content_type": content_type},
        )

    if init_res.status_code == 200:
        init_data = init_res.json()
        upload_url = init_data.get("upload_url")
        file_url = init_data.get("file_url")

        # Step 2: Upload to presigned URL
        async with httpx.AsyncClient(timeout=120) as client:
            await client.put(
                upload_url,
                content=file_bytes,
                headers={"Content-Type": content_type},
            )
        return file_url

    # Fallback: use data URI for small files (< 10MB)
    if len(file_bytes) < 10 * 1024 * 1024:
        import base64
        b64 = base64.b64encode(file_bytes).decode()
        return f"data:{content_type};base64,{b64}"

    raise Exception(f"Fal storage upload failed ({init_res.status_code}): {init_res.text[:300]}")


# ══════════════════════════════════════════════════════════════
#  Lip Sync Job
# ══════════════════════════════════════════════════════════════

async def create_lipsync(
    video_url: str,
    audio_url: str,
    sync_mode: str = "cut_off",
) -> str:
    """
    Submit a lip sync request to the Fal queue.
    Returns a request_id for status polling.
    """
    payload = {
        "video_url": video_url,
        "audio_url": audio_url,
        "sync_mode": sync_mode,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            f"{FAL_BASE}/{FAL_MODEL}",
            headers=_headers(),
            json=payload,
        )

    if res.status_code not in (200, 201):
        raise Exception(friendly_error(res.text, res.status_code, "el lip-sync"))

    data = res.json()
    request_id = data.get("request_id")
    if not request_id:
        # If sync response (immediate result), return directly
        video_data = data.get("video", {})
        if video_data.get("url"):
            return f"SYNC:{video_data['url']}"
        raise Exception(f"No request_id in Fal response: {data}")

    return request_id


async def get_status(request_id: str) -> dict:
    """
    Check the status of a Fal lip sync job.
    Returns {status, video_url, logs, error}.
    """
    # Handle synchronous results
    if request_id.startswith("SYNC:"):
        return {
            "request_id": request_id,
            "status": "completed",
            "video_url": request_id[5:],
            "error": None,
        }

    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.get(
            f"{FAL_BASE}/{FAL_MODEL_BASE}/requests/{request_id}/status",
            headers=_headers(),
            params={"logs": "true"},
        )

    if res.status_code not in (200, 202):
        raise Exception(friendly_error(res.text, res.status_code, "el lip-sync"))

    data = res.json()
    status_raw = data.get("status", "UNKNOWN").upper()

    # Map Fal statuses to our standard ones
    status_map = {
        "IN_QUEUE": "pending",
        "IN_PROGRESS": "processing",
        "COMPLETED": "completed",
        "FAILED": "failed",
    }
    status = status_map.get(status_raw, "unknown")

    return {
        "request_id": request_id,
        "status": status,
        "video_url": None,  # Only available when fetching result
        "logs": [l.get("message", "") for l in data.get("logs", [])],
        "error": data.get("error"),
    }


async def get_result(request_id: str) -> dict:
    """
    Fetch the completed result of a Fal lip sync job.
    Returns {request_id, status, video_url, error}.
    """
    # Handle synchronous results
    if request_id.startswith("SYNC:"):
        return {
            "request_id": request_id,
            "status": "completed",
            "video_url": request_id[5:],
            "error": None,
        }

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.get(
            f"{FAL_BASE}/{FAL_MODEL_BASE}/requests/{request_id}",
            headers=_headers(),
        )

    if res.status_code not in (200, 202):
        raise Exception(friendly_error(res.text, res.status_code, "el lip-sync"))

    data = res.json()
    video_data = data.get("video", {})

    return {
        "request_id": request_id,
        "status": "completed",
        "video_url": video_data.get("url"),
        "duration": video_data.get("duration"),
        "error": None,
    }
