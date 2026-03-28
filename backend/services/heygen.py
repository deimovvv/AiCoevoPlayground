"""
HeyGen Video Service
────────────────────
Handles all HeyGen API interactions:
  - Upload assets (images, audio)
  - Create photo-to-video lip sync
  - Poll video status
  - List/manage talking photos
"""

import os
import httpx

HEYGEN_API_KEY = os.getenv("HEYGEN_API_KEY")
HEYGEN_BASE = "https://api.heygen.com"
HEYGEN_UPLOAD_BASE = "https://upload.heygen.com"


def _headers() -> dict:
    return {"X-Api-Key": HEYGEN_API_KEY}


def is_configured() -> bool:
    return HEYGEN_API_KEY is not None


# ══════════════════════════════════════════════════════════════
#  Asset Upload
# ══════════════════════════════════════════════════════════════

async def upload_asset(
    file_bytes: bytes,
    filename: str,
    content_type: str = "audio/mpeg",
) -> dict:
    """
    Upload a media file (image/audio/video) to HeyGen.
    Uses the special upload.heygen.com endpoint with raw binary payload.
    Returns {"url": "...", "asset_id": "..."}.
    """
    headers = {**_headers(), "Content-Type": content_type}
    
    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(
            f"{HEYGEN_UPLOAD_BASE}/v1/asset",
            headers=headers,
            content=file_bytes,
        )

    if res.status_code != 200:
        raise Exception(f"HeyGen asset upload failed ({res.status_code}): {res.text[:300]}")

    data = res.json().get("data", {})
    return {
        "url": data.get("url"),
        "asset_id": data.get("id") or data.get("asset_id"),
        "image_key": data.get("image_key"),
    }


# ══════════════════════════════════════════════════════════════
#  Talking Photo Upload (Photo Avatar)
# ══════════════════════════════════════════════════════════════

async def upload_talking_photo(
    image_bytes: bytes,
    filename: str,
    content_type: str = "image/jpeg",
) -> str:
    """
    Upload an image to HeyGen as a Photo Avatar.
    Steps:
      1. Upload image as asset → get image_key
      2. Create photo avatar group → get talking_photo_id
    Returns the talking_photo_id.
    """
    # Step 1: Upload as asset
    asset = await upload_asset(image_bytes, filename, content_type)
    image_key = asset.get("image_key")
    if not image_key:
        raise Exception(f"No image_key from asset upload: {asset}")

    # Step 2: Create photo avatar group
    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(
            f"{HEYGEN_BASE}/v2/photo_avatar/avatar_group/create",
            headers={**_headers(), "Content-Type": "application/json"},
            json={"name": filename, "image_key": image_key},
        )

    if res.status_code != 200:
        raise Exception(f"HeyGen avatar group create failed ({res.status_code}): {res.text[:300]}")

    data = res.json().get("data", {})
    tp_id = (
        data.get("talking_photo_id")
        or data.get("avatar_id")
        or data.get("id")
        or data.get("group_id")
    )
    if not tp_id:
        raise Exception(f"No talking_photo_id in response: {res.json()}")

    return tp_id


# ══════════════════════════════════════════════════════════════
#  Video Generation (Lip Sync)
# ══════════════════════════════════════════════════════════════

async def create_video(
    talking_photo_id: str,
    audio_url: str,
    title: str = "UGC Lip Sync",
    width: int = 720,
    height: int = 1280,
) -> str:
    """
    Create a lip sync video with a talking photo + audio.
    Returns the video_id for status polling.
    """
    payload = {
        "title": title,
        "video_inputs": [
            {
                "character": {
                    "type": "talking_photo",
                    "talking_photo_id": talking_photo_id,
                },
                "voice": {
                    "type": "audio",
                    "audio_url": audio_url,
                },
            }
        ],
        "dimension": {"width": width, "height": height},
        # Avatar IV engine → "More expressive motion" (2x credit cost)
        "use_avatar_iv_model": True,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            f"{HEYGEN_BASE}/v2/video/generate",
            headers={**_headers(), "Content-Type": "application/json"},
            json=payload,
        )

    if res.status_code != 200:
        raise Exception(f"HeyGen video generate failed ({res.status_code}): {res.text[:300]}")

    result = res.json()
    video_id = result.get("data", {}).get("video_id")
    if not video_id:
        raise Exception(f"No video_id in response: {result}")

    return video_id


# ══════════════════════════════════════════════════════════════
#  Video Status Polling
# ══════════════════════════════════════════════════════════════

async def get_video_status(video_id: str) -> dict:
    """
    Check the status of a HeyGen video generation job.
    Returns {video_id, status, video_url, thumbnail_url, duration, error}.
    """
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.get(
            f"{HEYGEN_BASE}/v1/video_status.get",
            headers=_headers(),
            params={"video_id": video_id},
        )

    if res.status_code != 200:
        raise Exception(f"HeyGen status check failed ({res.status_code}): {res.text[:300]}")

    data = res.json().get("data", {})
    err_obj = data.get("error")
    err_msg = err_obj.get("message", str(err_obj)) if isinstance(err_obj, dict) else err_obj

    return {
        "video_id": video_id,
        "status": data.get("status", "unknown"),
        "video_url": data.get("video_url"),
        "thumbnail_url": data.get("thumbnail_url"),
        "duration": data.get("duration"),
        "error": err_msg,
    }


# ══════════════════════════════════════════════════════════════
#  List Talking Photos
# ══════════════════════════════════════════════════════════════

async def list_talking_photos() -> list[dict]:
    """
    List all available talking photos from HeyGen.
    Returns list of {id, name, preview}.
    """
    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.get(
            f"{HEYGEN_BASE}/v2/avatars",
            headers=_headers(),
        )

    if res.status_code != 200:
        raise Exception(f"HeyGen list avatars failed ({res.status_code}): {res.text[:300]}")

    data = res.json().get("data", {})
    talking_photos = data.get("talking_photos", [])

    return [
        {
            "id": tp.get("talking_photo_id"),
            "name": tp.get("talking_photo_name", "Unnamed"),
            "preview": tp.get("preview_image_url"),
        }
        for tp in talking_photos[:100]
    ]
