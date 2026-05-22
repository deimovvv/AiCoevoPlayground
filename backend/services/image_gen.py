"""
Image Generation / Edit Service (via Fal AI — nano-banana-2)
─────────────────────────────────────────────────────────────
- nano-banana-2/edit  → image editing (requires reference images)
- nano-banana-2       → text-to-image (prompt only, no reference images)

Both share the same status/result base URL: queue.fal.run/fal-ai/nano-banana-2/requests/...
Uses the Fal queue pattern (submit → poll → result).
"""

import os
import json
import httpx
from typing import Union

FAL_BASE = "https://queue.fal.run"
FAL_MODEL = "fal-ai/nano-banana-2/edit"  # Image edit (requires image_urls)
FAL_T2I_MODEL = "fal-ai/nano-banana-2"   # Text-to-image (prompt only)
FAL_MODEL_BASE = "fal-ai/nano-banana-2"  # Shared base for status/result polling


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


def _friendly_error(raw: Union[str, dict, list]) -> str:
    """
    Turn a raw Fal/Nano-Banana error body into a concise, human-readable message.
    The common one here is `invalid_request` / "Could not generate images with the
    given prompts and images" — a generation rejection, usually from an over-long or
    contradictory prompt, a reference image that can't be combined, or content moderation.
    """
    if not raw:
        return "No se generó ninguna imagen."

    data = raw if isinstance(raw, (dict, list)) else None
    text = raw if isinstance(raw, str) else json.dumps(raw, ensure_ascii=False)
    if data is None:
        try:
            data = json.loads(text)
        except Exception:
            data = None

    msg, etype = "", ""
    if isinstance(data, dict):
        detail = data.get("detail")
        if isinstance(detail, list) and detail and isinstance(detail[0], dict):
            msg = str(detail[0].get("msg") or "")
            etype = str(detail[0].get("type") or "")
        elif isinstance(detail, str):
            msg = detail
        else:
            msg = str(data.get("message") or data.get("error") or "")

    blob = f"{msg} {etype} {text}".lower()
    if "could not generate" in blob or "invalid_request" in blob:
        return (
            "Nano Banana no pudo generar la imagen con ese prompt + referencias. Suele pasar "
            "cuando el prompt es muy largo o contradictorio, una referencia no se puede combinar, "
            "o el filtro de contenido la bloqueó. Probá: simplificar el prompt, quitar/cambiar "
            "alguna referencia, o reintentar."
        )
    if "content_policy" in blob or "sensitive content" in blob:
        return (
            "El filtro de contenido bloqueó la imagen generada (suele ser falso positivo con "
            "piel o ropa ajustada). Probá reformular el prompt o cambiar la referencia."
        )
    return (msg or text)[:300]


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
        raise Exception(_friendly_error(res.text))

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

    # Status uses the base model path (without /edit)
    url = f"{FAL_BASE}/{FAL_MODEL_BASE}/requests/{request_id}/status"
    print(f"[image-gen] Checking status: {url}")

    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.get(
            url,
            headers=_headers(),
            params={"logs": "true"},
        )

    print(f"[image-gen] Status response: {res.status_code} - {res.text[:200]}")

    if res.status_code not in (200, 202):
        raise Exception(_friendly_error(res.text))

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
            f"{FAL_BASE}/{FAL_MODEL_BASE}/requests/{request_id}",
            headers=_headers(),
        )

    if res.status_code not in (200, 202):
        raise Exception(_friendly_error(res.text))

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


# ══════════════════════════════════════════════════════════════
#  Text-to-image (nano-banana-2 — prompt only, no reference images)
# ══════════════════════════════════════════════════════════════

async def create_text_to_image(
    prompt: str,
    aspect_ratio: str = "1:1",
    resolution: str = "2K",
    num_images: int = 1,
) -> str:
    """
    Submit a text-to-image job to nano-banana-2 (base model, no images required).
    Returns a request_id for status polling — same get_status/get_result functions work
    because both models share the same FAL_MODEL_BASE URL.
    """
    payload = {
        "prompt": prompt,
        "aspect_ratio": aspect_ratio,
        "resolution": resolution,
        "num_images": num_images,
        "output_format": "png",
        "safety_tolerance": "4",
    }

    print(f"[image-gen/t2i] Submitting nano-banana-2 text-to-image job...")
    print(f"[image-gen/t2i] Prompt: {prompt[:120]}")

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            f"{FAL_BASE}/{FAL_T2I_MODEL}",
            headers=_headers(),
            json=payload,
        )

    print(f"[image-gen/t2i] Submit response: {res.status_code}")

    if res.status_code not in (200, 201):
        print(f"[image-gen/t2i] FAILED: {res.text[:500]}")
        raise Exception(_friendly_error(res.text))

    data = res.json()
    request_id = data.get("request_id")

    if not request_id:
        images = data.get("images", [])
        if images and images[0].get("url"):
            return f"SYNC:{images[0]['url']}"
        raise Exception(f"No request_id in t2i response: {data}")

    # No special prefix needed — get_status/get_result use the same FAL_MODEL_BASE
    return request_id
