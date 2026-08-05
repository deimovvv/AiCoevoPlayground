"""
Nano Banana 2 via Google Gemini API (direct) — services/nanobanana_google.py
────────────────────────────────────────────────────────────────────────────
Alternative provider to the Fal-hosted nano-banana-2. Same underlying model
(Nano Banana 2 = gemini-3.1-flash-image) but called DIRECTLY against Google's
Generative Language API with our own key (Monks GCP project, paid tier).

Why REST (not the google-genai SDK): the SDK ignores `imageSize` and always
returns 1024px. The REST endpoint honors imageSize ("2K"/"4K"), so we go REST
for every resolution — and avoid adding a new pip dependency.

Interface mirrors gpt_image_gen so main.py can route by `model` with the same
SYNC:-prefix pattern (Google is synchronous → one call returns the image).

Key: NANOBANANA_API_KEY (never hardcode; .env local, secret in prod).
Docs: https://ai.google.dev/gemini-api/docs/image-generation
"""

import os
import base64
import httpx
from typing import Optional, Tuple

MODEL = "gemini-3.1-flash-image"  # Nano Banana 2
_ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"

# Placeholders we treat as "not configured" so a stray value doesn't cause 400s.
_PLACEHOLDERS = {"", "...", "changeme", "your-key", "your_api_key", "placeholder"}


def _get_key() -> str:
    return (os.getenv("NANOBANANA_API_KEY") or "").strip()


def is_configured() -> bool:
    return _get_key().lower() not in _PLACEHOLDERS


# Our resolution labels → Google imageSize. Google honors "1K"/"2K"/"4K";
# anything smaller (0.5K) just uses 1K (1024). Omitting imageSize == 1024.
def _image_size(resolution: str) -> Optional[str]:
    r = (resolution or "1K").upper()
    if r in ("2K", "4K"):
        return r
    return None  # 1K / 0.5K → default 1024, no imageSize field


async def _fetch_image_bytes(url: str) -> Optional[Tuple[bytes, str]]:
    """Download a ref URL to (bytes, mime). Fal/http URLs only — the endpoint has
    already resolved data:/local refs to hosted URLs before calling us."""
    try:
        async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
            r = await client.get(url)
        if r.status_code != 200:
            print(f"[nb-google] ref fetch {r.status_code} for {url[:80]}")
            return None
        mime = r.headers.get("content-type", "image/png").split(";")[0].strip()
        if not mime.startswith("image/"):
            mime = "image/png"
        return r.content, mime
    except Exception as e:
        print(f"[nb-google] ref fetch failed ({url[:80]}): {e}")
        return None


async def _generate(prompt: str, image_urls: list[str], aspect_ratio: str, resolution: str) -> str:
    """Core call. Builds the parts (text + inline ref images), hits the REST endpoint,
    extracts the PNG bytes, uploads to storage, returns 'SYNC:<url>'.
    Raises with a readable message on safety-block / empty output."""
    key = _get_key()
    if not is_configured():
        raise Exception("NANOBANANA_API_KEY no configurada")

    parts: list[dict] = [{"text": prompt}]
    for url in (image_urls or []):
        got = await _fetch_image_bytes(url)
        if not got:
            continue
        img_bytes, mime = got
        parts.append({"inline_data": {"mime_type": mime, "data": base64.b64encode(img_bytes).decode("ascii")}})

    image_config: dict = {"aspectRatio": aspect_ratio or "1:1"}
    size = _image_size(resolution)
    if size:
        image_config["imageSize"] = size

    body = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "responseModalities": ["IMAGE"],
            "imageConfig": image_config,
        },
    }

    print(f"[nb-google] generate · refs={len(parts) - 1} · aspect={aspect_ratio} · size={size or '1K'} · prompt_len={len(prompt)}", flush=True)

    async with httpx.AsyncClient(timeout=300) as client:
        res = await client.post(_ENDPOINT, params={"key": key}, json=body)

    if res.status_code not in (200, 201):
        raise Exception(f"Google image gen HTTP {res.status_code}: {res.text[:400]}")

    data = res.json()

    # Safety / empty-output handling — output can legitimately come back with no image.
    candidates = data.get("candidates") or []
    if not candidates:
        fb = data.get("promptFeedback") or {}
        reason = fb.get("blockReason") or "sin candidatos"
        raise Exception(f"Google no devolvió imagen (posible bloqueo de safety): {reason}")

    png_bytes = None
    for part in (candidates[0].get("content", {}).get("parts") or []):
        inline = part.get("inlineData") or part.get("inline_data")
        if inline and inline.get("data"):
            png_bytes = base64.b64decode(inline["data"])
            break

    if not png_bytes:
        finish = candidates[0].get("finishReason", "")
        raise Exception(f"Google no devolvió bytes de imagen (finishReason={finish or 'desconocido'})")

    # Host the result so the frontend gets a URL (same flow as every other provider).
    from services import kling_video  # lazy import → evita ciclos al cargar el módulo
    hosted_url = await kling_video.upload_image(png_bytes, "nbg.png", "image/png")
    return f"SYNC:{hosted_url}"


# ══════════════════════════════════════════════════════════════
#  Interfaz espejo de gpt_image_gen (create_edit / create_text_to_image / status / result)
# ══════════════════════════════════════════════════════════════

async def create_edit(image_urls: list[str], prompt: str, aspect_ratio: str = "9:16", resolution: str = "1K") -> str:
    if not image_urls:
        # Sin refs = generación desde texto (mismo endpoint).
        return await _generate(prompt, [], aspect_ratio, resolution)
    return await _generate(prompt, image_urls, aspect_ratio, resolution)


async def create_text_to_image(prompt: str, aspect_ratio: str = "1:1", resolution: str = "2K") -> str:
    return await _generate(prompt, [], aspect_ratio, resolution)


async def get_status(request_id: str) -> dict:
    # Google es sincrónico → el request_id ya es 'SYNC:<url>'.
    if request_id.startswith("SYNC:"):
        return {"request_id": request_id, "status": "completed", "image_url": request_id[5:], "error": None}
    return {"request_id": request_id, "status": "unknown", "image_url": None, "error": "id no-SYNC inesperado para nano-banana-google"}


async def get_result(request_id: str) -> dict:
    if request_id.startswith("SYNC:"):
        return {"request_id": request_id, "status": "completed", "image_url": request_id[5:], "error": None}
    return {"request_id": request_id, "status": "failed", "image_url": None, "error": "id no-SYNC inesperado para nano-banana-google"}
