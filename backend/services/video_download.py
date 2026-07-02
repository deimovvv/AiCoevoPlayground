"""
Video Download Service
━━━━━━━━━━━━━━━━━━━━━
Downloads videos from URLs (TikTok, YouTube, Instagram, direct links).
Extracts frames for Gemini Vision analysis.
"""

import tempfile
import subprocess
import shutil
import asyncio
import httpx
from pathlib import Path
from typing import Optional


def is_configured() -> bool:
    """Check if yt-dlp is available."""
    return shutil.which("yt-dlp") is not None


def _is_tiktok(url: str) -> bool:
    return "tiktok.com" in url or "vm.tiktok.com" in url


async def _run_ytdlp(cmd: list, work_dir: Path, timeout: int = 90) -> tuple[int, str]:
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        # Ej: --cookies-from-browser dispara el prompt de Keychain en macOS y queda
        # bloqueado esperando la contraseña. Matamos el proceso y devolvemos error para
        # que el request NO se cuelgue (antes → "Failed to fetch" en el front).
        try:
            proc.kill()
            await proc.wait()
        except Exception:
            pass
        return 1, "yt-dlp timed out (posible prompt de credenciales del navegador bloqueando la descarga)"
    return proc.returncode, stderr.decode() if stderr else ""


async def download_tiktok_tikwm(url: str) -> dict:
    """
    Download TikTok video via tikwm.com API (free, no auth required).
    Returns same dict format as download_video().
    """
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://www.tikwm.com/api/",
            data={"url": url, "hd": "1"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        resp.raise_for_status()
        data = resp.json()

    if data.get("code") != 0:
        raise Exception(f"tikwm error: {data.get('msg', 'unknown')}")

    vdata = data.get("data") or {}
    play_url = vdata.get("play") or vdata.get("wmplay") or ""
    if not play_url:
        raise Exception("tikwm no devolvió URL de video")

    print(f"[video-download] tikwm resolved: {play_url[:80]}")
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        dl = await client.get(play_url)
        dl.raise_for_status()
        video_bytes = dl.content

    work_dir = Path(tempfile.mkdtemp(prefix="coevo_dl_"))
    output_path = work_dir / "video.mp4"
    output_path.write_bytes(video_bytes)

    size_bytes = len(video_bytes)
    print(f"[video-download] tikwm done: {size_bytes / 1024 / 1024:.1f}MB")
    return {
        "path": str(output_path),
        "duration": vdata.get("duration", 0),
        "size_bytes": size_bytes,
        "work_dir": str(work_dir),
    }


async def download_video(url: str, max_duration: int = 120) -> dict:
    """
    Download a video from URL using yt-dlp.
    For TikTok: tries impersonation first, then browser cookies as fallback.
    Returns path to downloaded file + metadata.
    """
    work_dir = Path(tempfile.mkdtemp(prefix="coevo_dl_"))
    output_path = work_dir / "video.mp4"

    base_args = [
        "--no-playlist",
        "--max-filesize", "100M",
        "-f", "best[ext=mp4]/best",
        "-o", str(output_path),
    ]

    # IMPORTANTE (macOS): --cookies-from-browser dispara el prompt de Keychain
    # ("yt-dlp wants to access Chrome Safe Storage") y BLOQUEA el request → "Failed to
    # fetch". Por eso lo usamos SOLO para TikTok (que sin cookies no baja y donde el
    # impersonate suele resolver antes). Para Instagram / YouTube: impersonate + plano,
    # sin cookies-from-browser → nunca dispara el Keychain. IG que exige login → falla
    # limpio → el usuario usa "Upload Video".
    if _is_tiktok(url):
        attempts: list[list[str]] = [
            ["yt-dlp", "--impersonate", "chrome", *base_args, url],
            ["yt-dlp", "--cookies-from-browser", "chrome", *base_args, url],
            ["yt-dlp", "--cookies-from-browser", "firefox", *base_args, url],
            ["yt-dlp", *base_args, url],
        ]
    else:
        attempts = [
            ["yt-dlp", "--impersonate", "chrome", *base_args, url],
            ["yt-dlp", *base_args, url],  # plano (YouTube público, etc.)
        ]

    last_error = ""
    for cmd in attempts:
        print(f"[video-download] Trying: {' '.join(cmd[:4])}... {url[:60]}")
        returncode, stderr = await _run_ytdlp(cmd, work_dir)
        if returncode == 0:
            break
        last_error = stderr[-400:]
        print(f"[video-download] Attempt failed: {last_error[-120:]}")
    else:
        # All attempts failed
        if _is_tiktok(url):
            raise Exception(
                "TikTok bloqueó la descarga directa. "
                "Descargá el video manualmente (app TikTok → Guardar, o snaptik.app) "
                "y subilo como archivo usando el botón 'Upload Video' de abajo."
            )
        if "instagram.com" in url:
            raise Exception(
                "Instagram no permite bajar el reel por URL (exige login y bloquea descargas "
                "anónimas). Descargá el reel a tu compu y subilo con el botón 'Upload Video' de "
                "abajo — así funciona siempre. URLs de TikTok y YouTube sí andan directo."
            )
        raise Exception(f"Download failed: {last_error}")

    if not output_path.exists():
        # yt-dlp might use different extension
        for f in work_dir.iterdir():
            if f.suffix in (".mp4", ".webm", ".mkv"):
                output_path = f
                break

    if not output_path.exists():
        raise Exception("No video file found after download")

    # Get duration
    duration = await _get_duration(output_path)
    size_bytes = output_path.stat().st_size

    print(f"[video-download] Downloaded: {duration}s, {size_bytes / 1024 / 1024:.1f}MB")

    return {
        "path": str(output_path),
        "duration": duration,
        "size_bytes": size_bytes,
        "work_dir": str(work_dir),
    }


async def extract_frames(video_path: str, num_frames: int = 10) -> list[str]:
    """
    Extract evenly-spaced frames from a video using FFmpeg.
    Returns list of frame image paths.
    """
    video = Path(video_path)
    if not video.exists():
        raise Exception(f"Video not found: {video_path}")

    frames_dir = video.parent / "frames"
    frames_dir.mkdir(exist_ok=True)

    # Get duration
    duration = await _get_duration(video)
    if duration <= 0:
        raise Exception("Could not determine video duration")

    # Calculate interval
    interval = duration / num_frames

    # Extract frames
    frame_paths = []
    for i in range(num_frames):
        timestamp = i * interval
        frame_path = frames_dir / f"frame_{i:03d}.jpg"

        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y",
            "-ss", str(timestamp),
            "-i", str(video),
            "-frames:v", "1",
            "-q:v", "2",
            str(frame_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await proc.communicate()

        if frame_path.exists():
            frame_paths.append(str(frame_path))

    print(f"[video-download] Extracted {len(frame_paths)} frames")
    return frame_paths


async def _get_duration(path: Path) -> float:
    proc = await asyncio.create_subprocess_exec(
        "ffprobe", "-v", "quiet",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(path),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await proc.communicate()
    try:
        return round(float(stdout.decode().strip()), 1)
    except:
        return 0.0
