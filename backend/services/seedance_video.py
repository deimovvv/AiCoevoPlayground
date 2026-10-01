"""
Seedance Reference-to-Video — vía kie.ai (default) o Fal (fallback)
───────────────────────────────────────────────────────────────────
ByteDance Seedance en modo "reference-to-video": N imágenes de referencia + prompt
→ un video que integra todo. Distinto de Kling i2v (UNA imagen como primer frame):
esto es multi-referencia, para "avatar + producto + escena" a la vez.

PROVEEDOR — decisión del usuario (2026-10-01): *"cuando usemos Seedance, te conectes
a la API de kie siempre"*. kie.ai es el default si hay KIE_API_KEY; Fal queda sólo
como fallback si la key falta.

Por qué kie (verificado en kie.ai/seedance-2-5 y fal.ai, 2026-10-01), Seedance 2.5,
sin video de referencia:
            Fal          kie.ai
  480p   $0.221/s     $0.140/s   (-37%)
  720p   $0.473/s     $0.315/s   (-33%)
  1080p  no existe    $0.790/s   ← kie lo ofrece, Fal no
Con video de referencia kie baja aún más (480p $0.085/s · 720p $0.190/s · 1080p $0.475/s).

Contrato kie (docs.kie.ai/market/bytedance/seedance-2-5 + market/common/get-task-detail):
  POST /api/v1/jobs/createTask   {model, input:{prompt, reference_image_urls, ...}}
  GET  /api/v1/jobs/recordInfo?taskId=…   state: waiting|queuing|generating|success|fail
  resultJson es un STRING con JSON adentro: {"resultUrls": [...]}

Los request_id de kie llevan prefijo "kie:" — así un job de Fal que ya estaba en curso
cuando se hizo el cambio sigue resolviéndose por su camino, sin romperse.
"""

import os
import json
import httpx
from typing import List, Optional, Union

FAL_BASE = "https://queue.fal.run"
# Seedance 2.5 reemplaza a 2.0 (verificado en fal.ai 2026-09-25). Tope 720p.
# El 2.0 queda accesible por SEEDANCE_MODELS para no romper corridas viejas.
FAL_MODEL = "bytedance/seedance-2.5/reference-to-video"
SEEDANCE_MODELS = {
    "seedance-2-5":     "bytedance/seedance-2.5/reference-to-video",
    "seedance-2-5-i2v": "bytedance/seedance-2.5/image-to-video",
    "seedance-2":       "bytedance/seedance-2.0/reference-to-video",
}
# Status endpoint uses the same path prefix
FAL_MODEL_BASE = "bytedance/seedance-2.5"


KIE_BASE = "https://api.kie.ai"
KIE_MODEL = "bytedance/seedance-2-5"
KIE_PREFIX = "kie:"


def _kie_key() -> str:
    return os.getenv("KIE_API_KEY", "")


def _use_kie() -> bool:
    """kie.ai es el default para Seedance; Fal sólo si no hay key de kie."""
    return bool(_kie_key())


def _kie_headers() -> dict:
    return {"Authorization": f"Bearer {_kie_key()}", "Content-Type": "application/json"}


def _get_key() -> str:
    return os.getenv("FAL_KEY", "")


def _headers() -> dict:
    return {
        "Authorization": f"Key {_get_key()}",
        "Content-Type": "application/json",
    }


def is_configured() -> bool:
    return bool(_kie_key() or _get_key())


def _friendly_error(raw: Union[str, dict, list]) -> str:
    """
    Turn a raw Fal error body into a concise, human-readable message.
    Specifically catches ByteDance/Seedance content-moderation rejections
    (content_policy_violation / partner_validation_failed / "sensitive content"),
    which are frequent false positives on people, hair, skin or fitted clothing.
    """
    if not raw:
        return "Seedance no devolvió ningún video."

    data = raw if isinstance(raw, (dict, list)) else None
    text = raw if isinstance(raw, str) else json.dumps(raw, ensure_ascii=False)
    if data is None:
        try:
            data = json.loads(text)
        except Exception:
            data = None

    # Extract the first {msg,type} out of Fal's {"detail":[{...}]} shape
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
    if "content_policy" in blob or "sensitive content" in blob or "partner_validation" in blob:
        return (
            "El filtro de contenido de Seedance marcó el video generado como sensible "
            "(suele ser un falso positivo con piel, pelo o ropa ajustada). Probá: reformular "
            "el prompt evitando describir el cuerpo, cambiar la imagen de referencia, o animar "
            "con Kling en su lugar."
        )
    return (msg or text)[:300]


async def _kie_create(
    prompt: str,
    reference_image_urls: List[str],
    duration: str,
    aspect_ratio: Optional[str],
    resolution: Optional[str],
    audio_urls: Optional[List[str]],
    reference_video_urls: Optional[List[str]],
    generate_audio: Optional[bool],
) -> str:
    """Encola en kie.ai y devuelve 'kie:<taskId>'."""
    inp: dict = {"prompt": prompt}
    if reference_image_urls:
        inp["reference_image_urls"] = reference_image_urls
    if reference_video_urls:
        inp["reference_video_urls"] = reference_video_urls
    if audio_urls:
        inp["reference_audio_urls"] = audio_urls
    # kie pide duración ENTERA en [4, 30]; el front manda string ("5").
    try:
        inp["duration"] = max(4, min(30, int(float(duration))))
    except (TypeError, ValueError):
        inp["duration"] = 5
    if resolution:
        inp["resolution"] = resolution            # 480p | 720p | 1080p
    if aspect_ratio:
        inp["aspect_ratio"] = aspect_ratio
    # Misma regla que en Fal: si el usuario trae audio, que no se pise con uno generado.
    if generate_audio is not None:
        inp["generate_audio"] = generate_audio
    elif audio_urls:
        inp["generate_audio"] = False

    print(f"[seedance-kie] createTask {KIE_MODEL} · {len(reference_image_urls or [])} imgs · "
          f"{inp.get('resolution', 'default')} · {inp['duration']}s")
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(f"{KIE_BASE}/api/v1/jobs/createTask",
                                headers=_kie_headers(), json={"model": KIE_MODEL, "input": inp})
    data = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
    # kie responde 200 con un `code` propio adentro: hay que mirar los dos.
    if res.status_code != 200 or data.get("code") != 200:
        raise Exception(f"kie.ai Seedance falló ({res.status_code}): {res.text[:300]}")
    task_id = (data.get("data") or {}).get("taskId")
    if not task_id:
        raise Exception(f"kie.ai no devolvió taskId: {res.text[:300]}")
    return f"{KIE_PREFIX}{task_id}"


async def _kie_record(task_id: str) -> dict:
    """Consulta el task en kie y lo traduce al formato que ya consume el front."""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.get(f"{KIE_BASE}/api/v1/jobs/recordInfo",
                                   headers=_kie_headers(), params={"taskId": task_id})
    except Exception as e:
        # Transitorio: que el poller reintente en vez de abortar un job vivo.
        print(f"[seedance-kie] recordInfo transitorio (reintenta): {e}")
        return {"status": "processing", "video_url": None, "error": None}

    if res.status_code >= 500:
        return {"status": "processing", "video_url": None, "error": None}
    body = res.json() if res.status_code == 200 else {}
    d = body.get("data") or {}
    state = d.get("state")

    if state == "success":
        url = None
        try:
            # resultJson es un STRING con JSON adentro, no un objeto.
            url = (json.loads(d.get("resultJson") or "{}").get("resultUrls") or [None])[0]
        except Exception:
            pass
        if url:
            return {"status": "completed", "video_url": url, "error": None}
        return {"status": "failed", "video_url": None, "error": "kie.ai terminó sin URL de video"}
    if state == "fail":
        return {"status": "failed", "video_url": None,
                "error": _friendly_error(d.get("failMsg") or d.get("failCode") or res.text)}
    if state in ("waiting", "queuing"):
        return {"status": "pending", "video_url": None, "error": None}
    if state == "generating":
        return {"status": "processing", "video_url": None, "error": None}
    if res.status_code != 200 or body.get("code") not in (200, None):
        return {"status": "failed", "video_url": None, "error": f"kie.ai recordInfo: {res.text[:200]}"}
    return {"status": "processing", "video_url": None, "error": None}


async def create_reference_to_video(
    prompt: str,
    reference_image_urls: List[str],
    duration: str = "5",
    aspect_ratio: str = "9:16",
    resolution: Optional[str] = None,
    audio_urls: Optional[List[str]] = None,
    reference_video_urls: Optional[List[str]] = None,
    generate_audio: Optional[bool] = None,
) -> str:
    """
    Submit a reference-to-video job. Returns request_id (or SYNC: URL).

    Args:
      reference_image_urls: visual reference images (avatar, product, scene).
          Maps to Fal's `image_urls`. Reference them in the prompt as
          @Image1, @Image2 (in array order).
      audio_urls: optional audio inputs. When provided, Seedance lip-syncs the
          avatar to the audio — replaces HeyGen/Fal lipsync for talking scenes.
          NOTE: if audio is provided, at least one ref image or video is required.
      reference_video_urls: optional reference videos (motion/style refs).
          Maps to Fal's `video_urls`. Reference as @Video1, @Video2.
      generate_audio: when audio_urls is empty, this controls whether Seedance
          generates its own audio (default true per Fal). Pass False to mute.
    """
    if not reference_image_urls and not reference_video_urls:
        raise Exception("Seedance reference-to-video needs at least 1 reference image or video")

    if _use_kie():
        return await _kie_create(prompt, reference_image_urls, duration, aspect_ratio,
                                 resolution, audio_urls, reference_video_urls, generate_audio)
    # ── Fallback: Fal (sólo si no hay KIE_API_KEY) ──

    payload: dict = {
        "prompt": prompt,
        "image_urls": reference_image_urls or [],
        "duration": duration,
        "aspect_ratio": aspect_ratio,
    }
    if resolution:
        payload["resolution"] = resolution
    if audio_urls:
        payload["audio_urls"] = audio_urls
        # When user supplies audio they almost always want it played back —
        # force-disable generate_audio so Seedance doesn't overlay its own track.
        if generate_audio is None:
            payload["generate_audio"] = False
    if reference_video_urls:
        payload["video_urls"] = reference_video_urls
    if generate_audio is not None:
        payload["generate_audio"] = generate_audio

    print(f"[seedance-rtv] Submitting to {FAL_MODEL}")
    print(f"[seedance-rtv]   refs: {len(reference_image_urls or [])} images, {len(reference_video_urls or [])} videos, {len(audio_urls or [])} audio")
    print(f"[seedance-rtv]   prompt: {prompt[:100]}")

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            f"{FAL_BASE}/{FAL_MODEL}",
            headers=_headers(),
            json=payload,
        )

    print(f"[seedance-rtv] Submit response: {res.status_code}")

    if res.status_code not in (200, 201):
        print(f"[seedance-rtv] Submit FAILED: {res.text[:500]}")
        raise Exception(f"Seedance submit failed ({res.status_code}): {res.text[:400]}")

    data = res.json()
    request_id = data.get("request_id")
    if not request_id:
        # Sync response — immediate result
        video_data = data.get("video", {})
        if video_data.get("url"):
            return f"SYNC:{video_data['url']}"
        raise Exception(f"No request_id in Seedance response: {data}")
    return request_id


async def get_status(request_id: str) -> dict:
    if request_id.startswith(KIE_PREFIX):
        r = await _kie_record(request_id[len(KIE_PREFIX):])
        return {"request_id": request_id, **r}
    if request_id.startswith("SYNC:"):
        return {"request_id": request_id, "status": "completed", "video_url": request_id[5:], "error": None}

    url = f"{FAL_BASE}/{FAL_MODEL_BASE}/requests/{request_id}/status"
    try:
        # No logs=true — we don't use the logs and the payload can grow large and slow.
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.get(url, headers=_headers())
    except Exception as e:
        # Transient network/timeout — keep the job alive so the poller retries
        # instead of aborting a generation that's still running on Fal.
        print(f"[seedance] status transient error (will retry): {e}")
        return {"request_id": request_id, "status": "processing", "video_url": None, "error": None}

    if res.status_code >= 500:
        # Fal-side hiccup — also transient; keep polling.
        print(f"[seedance] status {res.status_code} (transient, will retry)")
        return {"request_id": request_id, "status": "processing", "video_url": None, "error": None}

    if res.status_code not in (200, 202):
        # A blocked/failed job often surfaces its reason here (e.g. content policy).
        return {"request_id": request_id, "status": "failed", "video_url": None, "error": _friendly_error(res.text)}

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
        "error": None,
    }


async def get_result(request_id: str) -> dict:
    if request_id.startswith(KIE_PREFIX):
        r = await _kie_record(request_id[len(KIE_PREFIX):])
        return {"request_id": request_id, **r}
    if request_id.startswith("SYNC:"):
        return {"request_id": request_id, "status": "completed", "video_url": request_id[5:], "error": None}

    url = f"{FAL_BASE}/{FAL_MODEL_BASE}/requests/{request_id}"
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.get(url, headers=_headers())

    if res.status_code != 200:
        return {"request_id": request_id, "status": "failed", "video_url": None, "error": _friendly_error(res.text)}

    data = res.json()
    video = data.get("video") or {}
    video_url = video.get("url") if isinstance(video, dict) else None
    return {
        "request_id": request_id,
        "status": "completed" if video_url else "failed",
        "video_url": video_url,
        "error": None if video_url else _friendly_error(data),
    }
