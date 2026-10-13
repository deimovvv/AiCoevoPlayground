"""
Image Generation / Edit Service (via Fal AI — openai/gpt-image-2)
────────────────────────────────────────────────────────────────
Alternative to nano-banana-2 for cases where editing a SINGLE base image
matters more than composing multiple references.

Docs: https://fal.ai/models/openai/gpt-image-2/edit/api

Strengths: sharp edits, text respect, better for iterating on one image.
Trade-offs: less flexible than nano-banana when combining many refs.
"""

from typing import Optional
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


# Tamaño de salida. Fal espera `image_size` (NO `size`, que ignora en silencio: hasta el
# 2026-10-13 todo salía 1024×768 en t2i). Acepta {width, height} con estos límites
# (schema OpenAPI de Fal, 2026-10-13): múltiplos de 16, borde ≤ 3840, proporción ≤ 3:1,
# entre 655.360 y 8.294.400 píxeles. Ver openspec/changes/image-models/design.md.
_PIXELS_BY_RESOLUTION = {
    "0.5K": 655_360,
    "1K": 1_048_576,
    "2K": 2_359_296,
    "4K": 8_294_400,
}
_MIN_PIXELS, _MAX_PIXELS, _MAX_EDGE = 655_360, 8_294_400, 3840
QUALITIES = ("low", "medium", "high")
DEFAULT_QUALITY = "medium"


def _ratio(aspect_ratio: str) -> float:
    try:
        w, h = (float(x) for x in aspect_ratio.split(":"))
        r = w / h
    except Exception:
        r = 9 / 16
    return min(max(r, 1 / 3), 3.0)


def size_for(aspect_ratio: str = "9:16", resolution: str = "1K") -> dict:
    """{width, height} para el formato y la resolución pedidos, dentro de los límites de Fal."""
    r = _ratio(aspect_ratio)
    px = _PIXELS_BY_RESOLUTION.get(str(resolution).upper(), _PIXELS_BY_RESOLUTION["1K"])
    w = (px * r) ** 0.5
    h = w / r
    scale = min(1.0, _MAX_EDGE / max(w, h))
    w, h = w * scale, h * scale

    def snap(v: float) -> int:
        return max(16, int(round(v / 16)) * 16)

    w, h = snap(w), snap(h)
    # Redondear puede dejarlo apenas fuera de rango: se corrige de a 16 px.
    while w * h > _MAX_PIXELS or max(w, h) > _MAX_EDGE:
        w, h = (w - 16, h) if w >= h else (w, h - 16)
    while w * h < _MIN_PIXELS:
        w, h = (w + 16, h) if w <= h else (w, h + 16)
    return {"width": w, "height": h}


def normalize_quality(quality: Optional[str]) -> str:
    return quality if quality in QUALITIES else DEFAULT_QUALITY


# ══════════════════════════════════════════════════════════════
#  Edit: modify a base image (with optional additional refs)
# ══════════════════════════════════════════════════════════════

async def create_edit(
    image_urls: list[str],
    prompt: str,
    aspect_ratio: str = "9:16",
    num_images: int = 1,
    quality: str = DEFAULT_QUALITY,
    mask_url: Optional[str] = None,
    resolution: str = "1K",
) -> str:
    """
    Submit a GPT Image 2 edit job.

    image_urls: reference images. The FIRST image is treated as the BASE to edit;
                additional images act as references/context.
    prompt: editing instructions in natural language.
    quality: "low" | "medium" | "high" (default medium; high ≈ 4× el costo)
    resolution: "0.5K" | "1K" | "2K" | "4K" — junto con aspect_ratio define image_size
    mask_url: máscara para EDICIÓN LOCAL — sólo se regenera lo que la máscara marca,
              el resto de la imagen queda intacto. PNG donde las zonas TRANSPARENTES
              son las editables. Es la razón por la que las ediciones puntuales van
              por GPT Image y no por Nano Banana: Nano Banana NO acepta máscara
              (verificado 2026-09-21, ver docs/pending-features.md §14).
    """
    if not image_urls:
        raise ValueError("GPT Image 2 edit requires at least one reference image")

    size = size_for(aspect_ratio, resolution)
    payload = {
        "prompt": prompt,
        "image_urls": image_urls,
        "image_size": size,
        "num_images": num_images,
        "quality": normalize_quality(quality),
        "output_format": "png",
    }
    if mask_url:
        payload["mask_url"] = mask_url

    print(f"[gpt-image-2] Submitting edit to {FAL_MODEL} (size={size}, quality={payload['quality']}, refs={len(image_urls)})")
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
    quality: str = DEFAULT_QUALITY,
    resolution: str = "1K",
) -> str:
    """Generate an image from prompt alone (no references)."""
    size = size_for(aspect_ratio, resolution)
    payload = {
        "prompt": prompt,
        "image_size": size,
        "num_images": num_images,
        "quality": normalize_quality(quality),
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
