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
import httpx
from typing import List, Optional

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
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.get(url, headers=_headers(), params={"logs": "true"})

    if res.status_code not in (200, 202):
        raise Exception(f"Seedance status check failed ({res.status_code}): {res.text[:300]}")

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
        return {"request_id": request_id, "status": "failed", "video_url": None, "error": res.text[:300]}

    data = res.json()
    video = data.get("video") or {}
    video_url = video.get("url") if isinstance(video, dict) else None
    return {
        "request_id": request_id,
        "status": "completed" if video_url else "failed",
        "video_url": video_url,
        "error": None if video_url else f"No video URL in response: {str(data)[:200]}",
    }
