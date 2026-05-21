"""
Beeble SwitchX Service (Video Swap)
────────────────────────────────────
SwitchX is a video-to-video model: it KEEPS the subject/motion from a source video
(using the original pixels) and SWAPS a chosen element (garment, product, background)
to match a reference image, relighting to blend. Far higher fidelity than text-to-video
because it composites over the real footage.

Flow (per Beeble docs — developer.beeble.ai):
  1. Create upload URL  → PUT each asset (source_video, reference_image, alpha_mask)
  2. Start Generation   → returns job_id  (alpha_mode + prompt + uploaded asset refs)
  3. Poll Get Job Status → pending | processing | completed | failed
  4. Download result video URL

NOTE: the exact endpoint paths / field names below follow the documented flow but
should be confirmed against the live Beeble API reference + your API key. Anything
that needs confirming is marked CONFIRM.
"""

import os
import httpx
from typing import Optional

# CONFIRM: base URL from Beeble dashboard. Override via env if different.
BEEBLE_BASE = os.getenv("BEEBLE_API_BASE", "https://api.beeble.ai/v1")


def _get_key() -> str:
    return os.getenv("BEEBLE_API_KEY", "")


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {_get_key()}",
        "Content-Type": "application/json",
    }


def is_configured() -> bool:
    return bool(_get_key())


async def upload_asset(file_bytes: bytes, filename: str, content_type: str) -> str:
    """
    Upload one asset to Beeble storage. Two-step per docs:
      1) POST create upload URL → { upload_url, file_id/file_url }
      2) PUT the bytes to upload_url
    Returns the file reference (id or url) to link in Start Generation.
    """
    async with httpx.AsyncClient(timeout=60) as client:
        # 1) create upload URL  (CONFIRM path: /uploads)
        init = await client.post(
            f"{BEEBLE_BASE}/uploads",
            headers=_headers(),
            json={"filename": filename, "content_type": content_type},
        )
        if init.status_code not in (200, 201):
            raise Exception(f"Beeble create-upload failed ({init.status_code}): {init.text[:300]}")
        data = init.json()
        upload_url = data.get("upload_url") or data.get("uploadUrl")
        file_ref = data.get("file_id") or data.get("file_url") or data.get("id") or data.get("fileUrl")
        if not upload_url or not file_ref:
            raise Exception(f"Beeble upload response missing url/ref: {data}")

    # 2) PUT the file bytes to the signed URL
    async with httpx.AsyncClient(timeout=180) as client:
        put = await client.put(upload_url, content=file_bytes, headers={"Content-Type": content_type})
        if put.status_code not in (200, 201, 204):
            raise Exception(f"Beeble file PUT failed ({put.status_code}): {put.text[:200]}")

    return str(file_ref)


async def start_generation(
    source_video_ref: str,
    alpha_mode: str = "auto",
    reference_image_ref: Optional[str] = None,
    alpha_mask_ref: Optional[str] = None,
    prompt: Optional[str] = None,
) -> str:
    """
    Start a SwitchX job. Returns job_id.

    alpha_mode: "auto" (AI masks foreground) | "select" (mask first frame, AI propagates)
                | "fill" (keep everything, no mask) | "custom" (full custom mask video)
    """
    payload: dict = {
        "source_video": source_video_ref,
        "alpha_mode": alpha_mode,
    }
    if reference_image_ref:
        payload["reference_image"] = reference_image_ref
    if alpha_mask_ref:
        payload["alpha_mask"] = alpha_mask_ref
    if prompt:
        payload["prompt"] = prompt

    async with httpx.AsyncClient(timeout=30) as client:
        # CONFIRM path: /switchx/generate
        res = await client.post(f"{BEEBLE_BASE}/switchx/generate", headers=_headers(), json=payload)
    if res.status_code not in (200, 201):
        raise Exception(f"Beeble start-generation failed ({res.status_code}): {res.text[:400]}")
    data = res.json()
    job_id = data.get("job_id") or data.get("id") or data.get("jobId")
    if not job_id:
        raise Exception(f"Beeble start-generation: no job_id in response: {data}")
    return str(job_id)


async def get_status(job_id: str) -> dict:
    """Poll a job. Returns {status, video_url, error}."""
    async with httpx.AsyncClient(timeout=15) as client:
        # CONFIRM path: /jobs/{id}
        res = await client.get(f"{BEEBLE_BASE}/jobs/{job_id}", headers=_headers())
    if res.status_code != 200:
        return {"job_id": job_id, "status": "failed", "video_url": None, "error": res.text[:300]}
    data = res.json()
    raw = (data.get("status") or "").lower()
    status_map = {
        "queued": "pending", "pending": "pending", "waiting": "pending",
        "processing": "processing", "running": "processing", "in_progress": "processing",
        "completed": "completed", "succeeded": "completed", "success": "completed", "done": "completed",
        "failed": "failed", "error": "failed",
    }
    status = status_map.get(raw, raw or "unknown")
    # result URL can come in a few shapes
    video_url = (
        data.get("output_url") or data.get("video_url") or data.get("result_url")
        or (data.get("output") or {}).get("url") if isinstance(data.get("output"), dict) else None
    ) or data.get("output_url") or data.get("video_url")
    return {
        "job_id": job_id,
        "status": status,
        "video_url": video_url,
        "error": data.get("error"),
    }
