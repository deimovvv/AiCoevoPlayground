"""
Seedance 2.0 Reference-to-Video Service (via Fal AI)
─────────────────────────────────────────────────────
ByteDance Seedance 2.0 in "reference-to-video" mode: takes N reference images
+ a prompt and generates a video that integrates elements from all of them.

Different from Kling's image-to-video (which uses ONE image as start frame) —
this is multi-reference conditioning, well suited to "avatar + product + scene"
generation where multiple inputs need to coexist in the output.

REST pattern (same as Kling / all Fal queue-based models):
  1. Submit job → request_id
  2. Poll status → IN_QUEUE | IN_PROGRESS | COMPLETED
  3. Fetch result → final video URL
"""

import os
import json
import httpx
from typing import List, Optional, Union

FAL_BASE = "https://queue.fal.run"
FAL_MODEL = "bytedance/seedance-2.0/reference-to-video"
# Status endpoint uses the same path prefix
FAL_MODEL_BASE = "bytedance/seedance-2.0"


def _get_key() -> str:
    return os.getenv("FAL_KEY", "")


def _headers() -> dict:
    return {
        "Authorization": f"Key {_get_key()}",
        "Content-Type": "application/json",
    }


def is_configured() -> bool:
    return bool(_get_key())


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
