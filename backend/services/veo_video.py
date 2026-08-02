"""
Google Veo 3.1 — Image-to-Video con audio nativo (vía Gemini API)
────────────────────────────────────────────────────────────────
Veo genera video + voz nativa en una sola pasada desde una imagen inicial + prompt.
A diferencia de Seedance, NO tiene el filtro de caras agresivo → acepta un retrato
(real o IA) como frame inicial y anima a la persona hablando. Ver docs/ugc-talking-head-tests.md.

Flujo REST (long-running operation):
  1. POST :predictLongRunning  → operation name
  2. GET  /{operation}          → poll hasta done:true
  3. Descargar el video de la Files API (la key va como HEADER, no query param)
"""

import os
import base64
import httpx
from typing import Optional, Tuple

BASE = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_MODEL = "veo-3.1-generate-preview"       # calidad; fast/lite disponibles
FAST_MODEL = "veo-3.1-fast-generate-preview"


def _key() -> str:
    return os.getenv("GEMINI_API_KEY", "")


def is_configured() -> bool:
    return bool(_key())


async def create_image_to_video(
    prompt: str,
    image_bytes: bytes,
    image_mime: str = "image/jpeg",
    aspect_ratio: str = "9:16",
    model: str = DEFAULT_MODEL,
    negative_prompt: Optional[str] = None,
) -> str:
    """Envía un job image-to-video. Devuelve el operation name (para pollear)."""
    b64 = base64.b64encode(image_bytes).decode()
    params: dict = {"aspectRatio": aspect_ratio, "personGeneration": "allow_adult"}
    if negative_prompt:
        params["negativePrompt"] = negative_prompt
    body = {
        "instances": [{"prompt": prompt, "image": {"bytesBase64Encoded": b64, "mimeType": image_mime}}],
        "parameters": params,
    }
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(f"{BASE}/models/{model}:predictLongRunning", params={"key": _key()}, json=body)
    if r.status_code != 200:
        raise Exception(f"Veo submit failed ({r.status_code}): {r.text[:400]}")
    op = r.json().get("name")
    if not op:
        raise Exception(f"Veo: no operation name in response: {r.json()}")
    return op


async def create_text_to_video(
    prompt: str,
    aspect_ratio: str = "9:16",
    model: str = DEFAULT_MODEL,
    negative_prompt: Optional[str] = None,
) -> str:
    """Text-to-video (sin imagen). Devuelve operation name."""
    params: dict = {"aspectRatio": aspect_ratio, "personGeneration": "allow_adult"}
    if negative_prompt:
        params["negativePrompt"] = negative_prompt
    body = {"instances": [{"prompt": prompt}], "parameters": params}
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(f"{BASE}/models/{model}:predictLongRunning", params={"key": _key()}, json=body)
    if r.status_code != 200:
        raise Exception(f"Veo submit failed ({r.status_code}): {r.text[:400]}")
    op = r.json().get("name")
    if not op:
        raise Exception(f"Veo: no operation name in response: {r.json()}")
    return op


def _find_video(obj) -> Optional[Tuple[str, str]]:
    """Busca recursivamente ('uri', url) o ('b64', data) en la respuesta de la operación."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in ("uri", "videoUri") and isinstance(v, str):
                return ("uri", v)
            if k == "bytesBase64Encoded" and isinstance(v, str):
                return ("b64", v)
            r = _find_video(v)
            if r:
                return r
    elif isinstance(obj, list):
        for x in obj:
            r = _find_video(x)
            if r:
                return r
    return None


def _rai_reason(response: dict) -> Optional[str]:
    """Si Veo filtró el contenido (RAI), devuelve el motivo; si no, None."""
    gvr = (response or {}).get("generateVideoResponse", {}) if isinstance(response, dict) else {}
    if gvr.get("raiMediaFilteredCount"):
        reasons = gvr.get("raiMediaFilteredReasons") or []
        return (reasons[0] if reasons else "Veo filtró el contenido (RAI).")[:400]
    return None


async def get_status(operation: str) -> dict:
    """Poll de la operación. Estados: processing | completed | failed."""
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(f"{BASE}/{operation}", params={"key": _key()})
    if r.status_code != 200:
        # Transitorio — mantener vivo el job
        return {"status": "processing", "video_url": None, "error": None}
    d = r.json()
    if not d.get("done"):
        return {"status": "processing", "video_url": None, "error": None}
    if d.get("error"):
        return {"status": "failed", "video_url": None, "error": str(d["error"])[:400]}
    # Completó pero puede haber filtrado el contenido (RAI) → no hay video, es un fallo.
    rai = _rai_reason(d.get("response", {}))
    if rai:
        return {"status": "failed", "video_url": None, "error": rai}
    return {"status": "completed", "video_url": None, "error": None}


async def download_result(operation: str) -> bytes:
    """Descarga los bytes del video de una operación completada.
    La Files API de Gemini requiere la key como HEADER (x-goog-api-key), no query param."""
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.get(f"{BASE}/{operation}", params={"key": _key()})
    d = r.json()
    v = _find_video(d.get("response", {}))
    if not v:
        raise Exception("Veo: no video en la respuesta de la operación")
    kind, val = v
    if kind == "b64":
        return base64.b64decode(val)
    # uri → descargar con la key como header + seguir redirects
    async with httpx.AsyncClient(timeout=180, follow_redirects=True) as c:
        dl = await c.get(val, headers={"x-goog-api-key": _key()})
    if dl.status_code != 200 or not dl.content:
        raise Exception(f"Veo: descarga falló ({dl.status_code})")
    return dl.content
