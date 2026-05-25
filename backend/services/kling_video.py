"""
Kling V2.6 Image-to-Video Service (via Fal AI)
────────────────────────────────────────────────
Generates a short video from a static image using Kling V2.6 Pro.
Used as a pre-step for Fal lip sync — creates a natural-motion
base video from an avatar photo.

REST API (Fal queue pattern):
  1. Submit job with image URL + prompt
  2. Poll status
  3. Fetch result video URL
"""

import os
import httpx
from typing import Dict, Optional
from services.fal_errors import friendly_error

FAL_BASE = "https://queue.fal.run"
FAL_MODEL = "fal-ai/kling-video/v3/pro/image-to-video"  # Default — full path for submit
FAL_MODEL_BASE = "fal-ai/kling-video"  # Base model for status/result (no subpath per Fal docs)

# Kling model variants exposed to the frontend. Add more as Fal releases them.
KLING_MODELS: Dict[str, str] = {
    "v3-pro":      "fal-ai/kling-video/v3/pro/image-to-video",
    "v2-6-pro":    "fal-ai/kling-video/v2.6/pro/image-to-video",
    "v2-6-std":    "fal-ai/kling-video/v2.6/standard/image-to-video",
    "v2-5-turbo":  "fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
}


def resolve_model(model_id: Optional[str]) -> str:
    """Map a frontend-friendly model id to its full Fal path. Falls back to default."""
    if not model_id:
        return FAL_MODEL
    return KLING_MODELS.get(model_id, FAL_MODEL)


def _get_key() -> str:
    """Lazy read of FAL_KEY so hot-reloads pick it up."""
    return os.getenv("FAL_KEY", "")


def _headers() -> dict:
    return {
        "Authorization": f"Key {_get_key()}",
        "Content-Type": "application/json",
    }


def is_configured() -> bool:
    key = _get_key()
    return key is not None and len(key) > 0


# Default prompt for UGC avatar videos — natural body movement, ready for lip sync overlay
DEFAULT_PROMPT = (
    "A person looking at the camera in a selfie-style UGC video. "
    "Natural subtle body movement: gentle breathing, slight head sway, relaxed shoulder motion. "
    "Friendly, calm energy. Closed mouth, neutral expression. "
    "Soft hand and arm movement as if at rest between sentences. "
    "Well-lit, casual setting. Single continuous shot, one person only. "
    "Photorealistic, high quality, 9:16 vertical portrait, smooth natural motion."
)

DEFAULT_NEGATIVE = (
    "blur, distortion, low quality, watermark, text, subtitles, "
    "split screen, double image, duplicate person, mirrored frame, two people, cloned figure, "
    "tiled image, collage, grid, multiple panels, "
    "morphing face, melting skin, warped features, extra limbs, deformed hands, "
    "frozen, completely static, stiff, no movement, "
    "excessive shake, jitter, fast zoom, unnatural motion, jerky movement, "
    "black bars, letterbox, pillarbox"
)


# ══════════════════════════════════════════════════════════════
#  Image Upload (to Fal storage)
# ══════════════════════════════════════════════════════════════

async def upload_image(image_bytes: bytes, filename: str, content_type: str = "image/jpeg") -> str:
    """
    Upload an image to Fal storage and return a public URL.
    Falls back to base64 data URI for small images.
    """
    import base64

    # Try REST upload first
    try:
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

            async with httpx.AsyncClient(timeout=120) as client:
                await client.put(
                    upload_url,
                    content=image_bytes,
                    headers={"Content-Type": content_type},
                )
            print(f"[kling] Image uploaded to Fal: {file_url}")
            return file_url
    except Exception as e:
        print(f"[kling] Fal upload failed, using base64 fallback: {e}")

    # Fallback: base64 data URI
    if len(image_bytes) < 10 * 1024 * 1024:
        b64 = base64.b64encode(image_bytes).decode()
        return f"data:{content_type};base64,{b64}"

    raise Exception("Failed to upload image to Fal storage")


# ══════════════════════════════════════════════════════════════
#  Image-to-Video Job
# ══════════════════════════════════════════════════════════════

async def create_video(
    image_url: str,
    prompt: Optional[str] = None,
    duration: str = "10",
    negative_prompt: Optional[str] = None,
    aspect_ratio: str = "9:16",
    model: Optional[str] = None,
    end_image_url: Optional[str] = None,
) -> str:
    """
    Submit an image-to-video (or frame-to-frame, if end_image_url given) job
    to Kling via Fal. Returns a request_id for status polling.

    `model` is a friendly id (`v3-pro`, `v2-6-pro`, ...) — see KLING_MODELS.
    """
    fal_path = resolve_model(model)

    payload = {
        "prompt": prompt or DEFAULT_PROMPT,
        "start_image_url": image_url,
        "duration": duration,
        "negative_prompt": negative_prompt or DEFAULT_NEGATIVE,
        "generate_audio": False,  # We'll add audio via lip sync later
    }
    if end_image_url:
        payload["end_image_url"] = end_image_url

    print(f"[kling] Submitting job to {fal_path}...")
    print(f"[kling] Image URL (first 100 chars): {image_url[:100]}")

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            f"{FAL_BASE}/{fal_path}",
            headers=_headers(),
            json=payload,
        )

    print(f"[kling] Submit response: {res.status_code}")

    if res.status_code not in (200, 201):
        print(f"[kling] Submit FAILED: {res.text[:500]}")
        raise Exception(friendly_error(res.text, res.status_code, "la animación con Kling"))

    data = res.json()
    request_id = data.get("request_id")
    print(f"[kling] Got request_id: {request_id}")

    if not request_id:
        # Sync response — immediate result
        video_data = data.get("video", {})
        if video_data.get("url"):
            return f"SYNC:{video_data['url']}"
        raise Exception(f"No request_id in Kling response: {data}")

    return request_id


async def get_status(request_id: str) -> dict:
    """Check the status of a Kling video job."""
    if request_id.startswith("SYNC:"):
        return {
            "request_id": request_id,
            "status": "completed",
            "video_url": request_id[5:],
            "error": None,
        }

    url = f"{FAL_BASE}/{FAL_MODEL_BASE}/requests/{request_id}/status"
    print(f"[kling] Checking status: {url}")

    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.get(
            url,
            headers=_headers(),
            params={"logs": "true"},
        )

    print(f"[kling] Status response: {res.status_code} - {res.text[:200]}")

    if res.status_code not in (200, 202):
        raise Exception(friendly_error(res.text, res.status_code, "la animación con Kling"))

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
        "logs": [l.get("message", "") for l in data.get("logs", [])],
        "error": data.get("error"),
    }


async def get_result(request_id: str) -> dict:
    """Fetch the final result of a completed Kling video job."""
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
        raise Exception(friendly_error(res.text, res.status_code, "la animación con Kling"))

    data = res.json()
    video_data = data.get("video", {})

    return {
        "request_id": request_id,
        "status": "completed",
        "video_url": video_data.get("url"),
        "duration": video_data.get("duration"),
        "file_size": video_data.get("file_size"),
        "error": None,
    }
