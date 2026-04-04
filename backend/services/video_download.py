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
from pathlib import Path
from typing import Optional


def is_configured() -> bool:
    """Check if yt-dlp is available."""
    return shutil.which("yt-dlp") is not None


async def download_video(url: str, max_duration: int = 120) -> dict:
    """
    Download a video from URL using yt-dlp.
    Returns path to downloaded file + metadata.
    """
    work_dir = Path(tempfile.mkdtemp(prefix="coevo_dl_"))
    output_path = work_dir / "video.mp4"

    cmd = [
        "yt-dlp",
        "--no-playlist",
        "--max-filesize", "100M",
        "-f", "best[ext=mp4]/best",
        "-o", str(output_path),
        url,
    ]

    print(f"[video-download] Downloading: {url[:80]}")

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()

    if proc.returncode != 0:
        error_msg = stderr.decode()[-300:] if stderr else "Unknown error"
        raise Exception(f"Download failed: {error_msg}")

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
