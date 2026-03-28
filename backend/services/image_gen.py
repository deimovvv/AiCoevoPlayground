"""
Image Generation / Edit Service (via Fal AI — nano-banana-2/edit)
─────────────────────────────────────────────────────────────────
Generates or edits images using reference images (avatar + product/background).
Uses the Fal queue pattern (submit → poll → result).

Typical use-case:
  - Pass avatar photo + product photo
  - Prompt: "Person holding the product in a modern kitchen"
  - Result: composite image ready for Kling video generation
"""

import os
import httpx

FAL_BASE = "https://queue.fal.run"
FAL_MODEL = "fal-ai/nano-banana-2/edit"


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


# ══════════════════════════════════════════════════════════════
#  Submit image edit job
# ══════════════════════════════════════════════════════════════

async def create_edit(
    image_urls: list[str],
    prompt: str,
    aspect_ratio: str = "9:16",
    resolution: str = "1K",
    num_images: int = 1,
) -> str:
    """
    Submit an image-edit job to nano-banana-2/edit via Fal.
    Returns a request_id for status polling.
    
    image_urls: list of image URLs (avatar, product, background, etc.)
    prompt: description of what to create
    """
    payload = {
        "prompt": prompt,
        "image_urls": image_urls,
        "aspect_ratio": aspect_ratio,
        "resolution": resolution,
        "num_images": num_images,
        "output_format": "png",
        "safety_tolerance": "4",
        "limit_generations": True,
    }

    print(f"[image-gen] Submitting job to {FAL_MODEL}...")
    print(f"[image-gen] Prompt: {prompt[:100]}")
    print(f"[image-gen] Image URLs: {len(image_urls)} images")

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            f"{FAL_BASE}/{FAL_MODEL}",
            headers=_headers(),
            json=payload,
        )

    print(f"[image-gen] Submit response: {res.status_code}")

    if res.status_code not in (200, 201):
        print(f"[image-gen] Submit FAILED: {res.text[:500]}")
        raise Exception(f"Image gen submit failed ({res.status_code}): {res.text[:400]}")

    data = res.json()
    request_id = data.get("request_id")
    print(f"[image-gen] Got request_id: {request_id}")

    if not request_id:
        # Sync response — immediate result
        images = data.get("images", [])
        if images and images[0].get("url"):
            return f"SYNC:{images[0]['url']}"
        raise Exception(f"No request_id in image-gen response: {data}")

    return request_id


# ══════════════════════════════════════════════════════════════
#  Check status
# ══════════════════════════════════════════════════════════════

async def get_status(request_id: str) -> dict:
    """Check the status of an image-gen job."""
    if request_id.startswith("SYNC:"):
        return {
            "request_id": request_id,
            "status": "completed",
            "image_url": request_id[5:],
            "error": None,
        }

    # nano-banana-2 uses the edit subpath for status too
    url = f"{FAL_BASE}/{FAL_MODEL}/requests/{request_id}/status"
    print(f"[image-gen] Checking status: {url}")

    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.get(
            url,
            headers=_headers(),
            params={"logs": "true"},
        )

    print(f"[image-gen] Status response: {res.status_code} - {res.text[:200]}")

    if res.status_code not in (200, 202):
        raise Exception(f"Image gen status check failed ({res.status_code}): {res.text[:300]}")

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
        "image_url": None,
        "logs": [l.get("message", "") for l in data.get("logs", [])],
        "error": data.get("error"),
    }


# ══════════════════════════════════════════════════════════════
#  Fetch result
# ══════════════════════════════════════════════════════════════

async def get_result(request_id: str) -> dict:
    """Fetch the final result of a completed image-gen job."""
    if request_id.startswith("SYNC:"):
        return {
            "request_id": request_id,
            "status": "completed",
            "image_url": request_id[5:],
            "error": None,
        }

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.get(
            f"{FAL_BASE}/{FAL_MODEL}/requests/{request_id}",
            headers=_headers(),
        )

    if res.status_code not in (200, 202):
        raise Exception(f"Image gen result fetch failed ({res.status_code}): {res.text[:300]}")

    data = res.json()
    images = data.get("images", [])

    return {
        "request_id": request_id,
        "status": "completed",
        "image_url": images[0].get("url") if images else None,
        "images": [{"url": img.get("url"), "width": img.get("width"), "height": img.get("height")} for img in images],
        "description": data.get("description", ""),
        "error": None,
    }
