"""
Image Generation / Edit Service (via Fal AI — openai/gpt-image-2)
────────────────────────────────────────────────────────────────
Alternative to nano-banana-2 for cases where editing a SINGLE base image
matters more than composing multiple references.

Docs: https://fal.ai/models/openai/gpt-image-2/edit/api

Strengths: sharp edits, text respect, better for iterating on one image.
Trade-offs: less flexible than nano-banana when combining many refs.
"""

import os
import httpx

FAL_BASE = "https://queue.fal.run"
FAL_MODEL = "fal-ai/gpt-image-2/edit"
FAL_T2I_MODEL = "fal-ai/gpt-image-2"
FAL_MODEL_BASE = "fal-ai/gpt-image-2"


def _get_key() -> str:
    return os.getenv("FAL_KEY", "")


def _headers() -> dict:
    return {
        "Authorization": f"Key {_get_key()}",
        "Content-Type": "application/json",
    }


def is_configured() -> bool:
    return bool(_get_key())


# Map our aspect ratio labels to GPT Image 2 size strings.
# GPT Image 2 accepts: "1024x1024", "1536x1024" (landscape), "1024x1536" (portrait).
_SIZE_BY_ASPECT = {
    "1:1": "1024x1024",
    "16:9": "1536x1024",
    "9:16": "1024x1536",
    "4:5": "1024x1536",  # closest portrait
}


def _size_for(aspect_ratio: str) -> str:
    return _SIZE_BY_ASPECT.get(aspect_ratio, "1024x1536")


# ══════════════════════════════════════════════════════════════
#  Edit: modify a base image (with optional additional refs)
# ══════════════════════════════════════════════════════════════

async def create_edit(
    image_urls: list[str],
    prompt: str,
    aspect_ratio: str = "9:16",
    num_images: int = 1,
    quality: str = "high",
) -> str:
    """
    Submit a GPT Image 2 edit job.

    image_urls: reference images. The FIRST image is treated as the BASE to edit;
                additional images act as references/context.
    prompt: editing instructions in natural language.
    quality: "low" | "medium" | "high" | "auto"
    """
    if not image_urls:
        raise ValueError("GPT Image 2 edit requires at least one reference image")

    size = _size_for(aspect_ratio)
    payload = {
        "prompt": prompt,
        "image_urls": image_urls,
        "size": size,
        "num_images": num_images,
        "quality": quality,
        "output_format": "png",
    }

    print(f"[gpt-image-2] Submitting edit to {FAL_MODEL} (size={size}, refs={len(image_urls)})")
    print(f"[gpt-image-2] Prompt: {prompt[:120]}")

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            f"{FAL_BASE}/{FAL_MODEL}",
            headers=_headers(),
            json=payload,
        )

    if res.status_code not in (200, 201):
        print(f"[gpt-image-2] Submit FAILED: {res.text[:500]}")
        raise Exception(f"GPT Image 2 submit failed ({res.status_code}): {res.text[:400]}")

    data = res.json()
    request_id = data.get("request_id")
    if not request_id:
        images = data.get("images", [])
        if images and images[0].get("url"):
            return f"SYNC:{images[0]['url']}"
        raise Exception(f"No request_id in gpt-image-2 response: {data}")

    print(f"[gpt-image-2] Got request_id: {request_id}")
    return request_id


# ══════════════════════════════════════════════════════════════
#  Text-to-image: generate from prompt only (no refs)
# ══════════════════════════════════════════════════════════════

async def create_text_to_image(
    prompt: str,
    aspect_ratio: str = "9:16",
    num_images: int = 1,
    quality: str = "high",
) -> str:
    """Generate an image from prompt alone (no references)."""
    size = _size_for(aspect_ratio)
    payload = {
        "prompt": prompt,
        "size": size,
        "num_images": num_images,
        "quality": quality,
        "output_format": "png",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            f"{FAL_BASE}/{FAL_T2I_MODEL}",
            headers=_headers(),
            json=payload,
        )

    if res.status_code not in (200, 201):
        raise Exception(f"GPT Image 2 t2i submit failed ({res.status_code}): {res.text[:400]}")

    data = res.json()
    request_id = data.get("request_id")
    if not request_id:
        images = data.get("images", [])
        if images and images[0].get("url"):
            return f"SYNC:{images[0]['url']}"
        raise Exception(f"No request_id in gpt-image-2 t2i response: {data}")

    return request_id


# ══════════════════════════════════════════════════════════════
#  Poll status + fetch result (shared with nano-banana pattern)
# ══════════════════════════════════════════════════════════════

async def get_status(request_id: str) -> dict:
    if request_id.startswith("SYNC:"):
        return {"request_id": request_id, "status": "completed", "image_url": request_id[5:], "error": None}

    url = f"{FAL_BASE}/{FAL_MODEL_BASE}/requests/{request_id}/status"
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.get(url, headers=_headers(), params={"logs": "true"})

    if res.status_code not in (200, 202):
        raise Exception(f"GPT Image 2 status failed ({res.status_code}): {res.text[:300]}")

    data = res.json()
    status_raw = data.get("status", "UNKNOWN").upper()
    status_map = {"IN_QUEUE": "pending", "IN_PROGRESS": "processing", "COMPLETED": "completed", "FAILED": "failed"}
    return {
        "request_id": request_id,
        "status": status_map.get(status_raw, "unknown"),
        "image_url": None,
        "logs": [l.get("message", "") for l in data.get("logs", [])],
        "error": data.get("error"),
    }


async def get_result(request_id: str) -> dict:
    if request_id.startswith("SYNC:"):
        return {"request_id": request_id, "status": "completed", "image_url": request_id[5:], "error": None}

    url = f"{FAL_BASE}/{FAL_MODEL_BASE}/requests/{request_id}"
    print(f"[gpt-image-2] Fetching result for {request_id}")
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.get(url, headers=_headers())

    print(f"[gpt-image-2] Result HTTP {res.status_code}, body preview: {res.text[:500]}")

    if res.status_code not in (200, 202):
        # Don't raise — return a structured failure so the caller surfaces the real error
        return {
            "request_id": request_id,
            "status": "failed",
            "image_url": None,
            "error": f"Fal returned HTTP {res.status_code}: {res.text[:300]}",
        }

    try:
        data = res.json()
    except Exception as e:
        return {
            "request_id": request_id,
            "status": "failed",
            "image_url": None,
            "error": f"Could not parse Fal response: {e}",
        }

    images = data.get("images", [])
    image_url = images[0].get("url") if images else None

    # Surface the actual reason when no image came back
    error_msg = None
    if not image_url:
        error_msg = (
            data.get("error")
            or data.get("detail")
            or data.get("message")
            or f"No image in result. Full response keys: {list(data.keys())}"
        )
        print(f"[gpt-image-2] FAILED for {request_id}: {error_msg}")
        print(f"[gpt-image-2] Full response: {data}")

    return {
        "request_id": request_id,
        "status": "completed" if image_url else "failed",
        "image_url": image_url,
        "error": error_msg,
    }
