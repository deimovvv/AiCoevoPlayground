"""
Subtitle Render Service
━━━━━━━━━━━━━━━━━━━━━━
Renders final video with animated subtitles.

Strategy:
  - Local: Remotion renderer (animated subtitles, needs Chromium)
  - Deploy: FFmpeg drawtext fallback (simple subtitles)

The service auto-detects which renderer is available.
"""

import json
import shutil
import asyncio
from pathlib import Path
from typing import List, Optional


FRONTEND_DIR = Path(__file__).parent.parent.parent / "frontend"


def _remotion_available() -> bool:
    """Check if Remotion renderer + Node.js are available."""
    if not shutil.which("node"):
        return False
    render_script = FRONTEND_DIR / "src" / "remotion" / "render-video.mjs"
    return render_script.exists()


async def render_with_remotion(
    video_urls: List[str],
    scripts: List[str],
    durations: List[float],
    output_path: str,
) -> bool:
    """
    Render video with Remotion (animated subtitles).
    Returns True if successful, False if failed (caller should fallback to FFmpeg).
    """
    if not _remotion_available():
        return False

    render_script = FRONTEND_DIR / "src" / "remotion" / "render-video.mjs"

    cmd = [
        "node",
        str(render_script),
        "--videos", json.dumps(video_urls),
        "--scripts", json.dumps(scripts),
        "--durations", json.dumps(durations),
        "--output", output_path,
    ]

    print(f"[subtitle-render] Running Remotion renderer...")
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(FRONTEND_DIR),
        )
        stdout, stderr = await proc.communicate()

        if stdout:
            for line in stdout.decode().strip().split("\n"):
                print(f"[remotion] {line}")
        if stderr:
            for line in stderr.decode().strip().split("\n")[-5:]:
                print(f"[remotion-err] {line}")

        if proc.returncode == 0 and Path(output_path).exists():
            print(f"[subtitle-render] Remotion render successful")
            return True
        else:
            print(f"[subtitle-render] Remotion failed (exit {proc.returncode}), will fallback to FFmpeg")
            return False

    except Exception as e:
        print(f"[subtitle-render] Remotion error: {e}, will fallback to FFmpeg")
        return False


def get_renderer_info() -> dict:
    """Return info about which renderer is available."""
    return {
        "remotion_available": _remotion_available(),
        "ffmpeg_available": shutil.which("ffmpeg") is not None,
        "node_available": shutil.which("node") is not None,
    }
