"""
FLUX 3 Image-to-Video (vía Fal)
────────────────────────────────
El modelo de video de Black Forest Labs. Toma UNA imagen y la anima.

Verificado en fal.ai el 2026-09-25:
  · endpoint: blackforestlabs/flux-3/image-to-video  (OJO: no es fal-ai/)
  · precio:   $0.17/seg a 720p · $0.29/seg a 1080p
  · entrada:  una sola imagen (no multi-referencia)

Contra los otros del catálogo, a 5 segundos:
  Kling V3 Std $0.42 · Kling V3 Pro $0.56 · FLUX 3 720p $0.85 · Seedance 2.5 $2.36

Mismo patrón de cola que el resto de Fal: submit → poll status → fetch result.
⚠️ Los endpoints de Fal devuelven status_url/response_url SIN el sufijo de ruta:
armarlas a mano da 405. Hay que usar las que vienen en la respuesta del submit.
"""
import os
import asyncio
import httpx
from typing import Optional

FAL_BASE = "https://queue.fal.run"
FAL_MODEL = "blackforestlabs/flux-3/image-to-video"


def _get_key() -> str:
    """Lectura perezosa para que un hot-reload tome la key nueva."""
    return os.getenv("FAL_KEY", "")


def is_configured() -> bool:
    return bool(_get_key())


def _headers() -> dict:
    return {"Authorization": f"Key {_get_key()}", "Content-Type": "application/json"}


# $/segundo por resolución (fal.ai, 2026-09-25).
RATE_PER_SEC = {"720p": 0.17, "1080p": 0.29}


def estimate_cost(resolution: str, duration_sec: float) -> Optional[float]:
    rate = RATE_PER_SEC.get(resolution)
    return None if rate is None else rate * duration_sec


async def create_video(
    image_url: str,
    prompt: Optional[str] = None,
    duration: str = "5",
    resolution: str = "720p",
) -> str:
    """
    Encola un job y devuelve el request_id (o 'SYNC:<url>' si respondió directo).

    FLUX 3 acepta UNA sola imagen — a diferencia de Seedance, que toma hasta 30
    referencias. Si hacen falta varias, este no es el modelo.
    """
    if not is_configured():
        raise RuntimeError("FAL_KEY no configurada")

    payload: dict = {"image_url": image_url, "duration": duration, "resolution": resolution}
    if prompt:
        payload["prompt"] = prompt

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(f"{FAL_BASE}/{FAL_MODEL}", headers=_headers(), json=payload)

    if res.status_code not in (200, 201):
        raise Exception(f"FLUX 3 submit falló ({res.status_code}): {res.text[:300]}")

    data = res.json()
    request_id = data.get("request_id")
    if not request_id:
        video = data.get("video") or {}
        if video.get("url"):
            return f"SYNC:{video['url']}"
        raise Exception(f"FLUX 3 no devolvió request_id: {data}")
    return request_id


async def poll_until_done(request_id: str, timeout_sec: int = 600) -> str:
    """Espera el resultado y devuelve la URL del video."""
    if request_id.startswith("SYNC:"):
        return request_id[5:]

    base = f"{FAL_BASE}/{FAL_MODEL.rsplit('/', 1)[0]}/requests/{request_id}"
    async with httpx.AsyncClient(timeout=30) as client:
        for _ in range(timeout_sec // 4):
            await asyncio.sleep(4)
            st = await client.get(f"{base}/status", headers=_headers())
            if st.status_code >= 500:
                continue  # hipo de Fal: seguir esperando, no abortar
            status = (st.json() or {}).get("status")
            if status == "COMPLETED":
                break
            if status in ("FAILED", "ERROR"):
                raise Exception(f"FLUX 3 falló: {st.text[:300]}")
        else:
            raise Exception("FLUX 3 timeout")

        res = await client.get(base, headers=_headers())
        video = (res.json() or {}).get("video") or {}
        url = video.get("url")
        if not url:
            raise Exception(f"FLUX 3 no devolvió video: {res.text[:300]}")
        return url
