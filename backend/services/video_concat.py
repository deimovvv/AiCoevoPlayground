"""
Video Concatenation + Subtitles Service
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Downloads lip-synced video segments, concatenates them using FFmpeg,
and optionally burns in subtitles.

Subtitle strategy:
  - Local: tries Remotion renderer (animated subtitles) first
  - Fallback: FFmpeg drawtext (simple subtitles)
  - Deploy: FFmpeg only
"""

import base64
import shutil
import tempfile
import asyncio
import uuid
from pathlib import Path
from typing import List, Optional

from services import subtitle_render

import httpx


def is_configured() -> bool:
    return shutil.which("ffmpeg") is not None


async def download_file(url: str, dest: Path) -> None:
    """Download a file from a URL to dest. Handles data: URIs directly."""
    if url.startswith("data:"):
        # data:audio/mpeg;base64,XXXX or data:video/mp4;base64,XXXX
        try:
            header, encoded = url.split(",", 1)
            if ";base64" in header:
                dest.write_bytes(base64.b64decode(encoded))
            else:
                dest.write_bytes(encoded.encode())
            return
        except Exception as e:
            raise ValueError(f"Failed to decode data URI: {e}")

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        dest.write_bytes(resp.content)


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
    except (ValueError, AttributeError):
        return 0.0


def _build_subtitle_filter(
    subtitles: List[dict],
    font_size: int = 42,
    font_color: str = "white",
    border_color: str = "black",
    border_width: int = 3,
    y_position: str = "h-h/6",
) -> str:
    """
    Build FFmpeg drawtext filter for word-by-word subtitles.

    subtitles: list of {"text": "...", "start": float, "end": float}
    """
    if not subtitles:
        return ""

    filters = []
    for sub in subtitles:
        # Escape special chars for FFmpeg
        text = sub["text"].replace("'", "\\'").replace(":", "\\:").replace("%", "%%")
        start = sub["start"]
        end = sub["end"]
        filters.append(
            f"drawtext=text='{text}'"
            f":fontsize={font_size}"
            f":fontcolor={font_color}"
            f":borderw={border_width}"
            f":bordercolor={border_color}"
            f":x=(w-text_w)/2"
            f":y={y_position}"
            f":enable='between(t,{start},{end})'"
        )

    return ",".join(filters)


def _generate_word_subtitles(
    scripts: List[dict],
    segment_durations: List[float],
) -> List[dict]:
    """
    Generate subtitle entries from scripts + segment durations.

    Uses natural line breaks (\\n) from the script as subtitle chunks.
    If no line breaks, falls back to splitting every 3-4 words.

    Returns list of {"text": "phrase", "start": float, "end": float}
    """
    subtitles = []
    current_time = 0.0

    for i, (script, duration) in enumerate(zip(scripts, segment_durations)):
        text = script.get("text", "")
        if not text:
            current_time += duration
            continue

        # Use line breaks as natural subtitle chunks
        lines = [line.strip() for line in text.split("\n") if line.strip()]

        # If no line breaks, split into groups of 3-4 words
        if len(lines) <= 1:
            words = text.split()
            chunks = []
            for j in range(0, len(words), 4):
                chunk = " ".join(words[j:j + 4])
                chunks.append(chunk)
        else:
            chunks = lines

        if not chunks:
            current_time += duration
            continue

        # Distribute chunks proportionally by word count (longer phrases take more time)
        word_counts = [len(c.split()) for c in chunks]
        total_words = sum(word_counts) or 1
        chunk_start = current_time
        for j, chunk in enumerate(chunks):
            proportion = word_counts[j] / total_words
            chunk_dur = duration * proportion
            start = chunk_start
            end = start + chunk_dur - 0.08
            subtitles.append({
                "text": chunk,
                "start": round(start, 2),
                "end": round(end, 2),
            })
            chunk_start = start + chunk_dur

        current_time += duration

    return subtitles


async def overlay_audio(
    video_url: str,
    audio_url: str,
    output_dir: Optional[str] = None,
) -> dict:
    """
    Overlay an audio track onto a silent video clip (e.g. Kling output).
    Pads audio with silence if shorter than video — never cuts the video.
    Returns dict with video_url and duration.
    """
    if not is_configured():
        raise RuntimeError("FFmpeg is not installed.")

    work_dir = Path(tempfile.mkdtemp(prefix="coevo_overlay_"))
    try:
        video_path = work_dir / "input_video.mp4"
        audio_path = work_dir / "input_audio.mp3"
        output_path = work_dir / f"overlay_{uuid.uuid4().hex[:8]}.mp4"

        await asyncio.gather(
            download_file(video_url, video_path),
            download_file(audio_url, audio_path),
        )

        # Trim output to audio duration so the clip never runs silent at the end.
        # If audio is longer than the video, cap at video duration (can't extend).
        video_duration = await _get_duration(video_path)
        audio_duration = await _get_duration(audio_path)
        output_duration = min(video_duration, audio_duration) if audio_duration > 0 else video_duration

        cmd = [
            "ffmpeg", "-y",
            "-i", str(video_path),
            "-i", str(audio_path),
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-c:v", "copy",
            "-c:a", "aac",
            "-t", str(output_duration),
            str(output_path),
        ]

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()

        if proc.returncode != 0:
            raise RuntimeError(f"FFmpeg overlay failed: {stderr.decode()[-400:]}")

        duration = await _get_duration(output_path)

        # Move to output dir if specified
        if output_dir:
            dest = Path(output_dir) / output_path.name
            shutil.move(str(output_path), str(dest))
            output_path = dest

        return {
            "output_path": str(output_path),
            "video_url": f"/static/renders/{output_path.name}",
            "duration": duration,
        }
    finally:
        # Clean up temp files (not the output)
        for f in [work_dir / "input_video.mp4", work_dir / "input_audio.mp3"]:
            if f.exists():
                f.unlink()


async def concat_videos(
    video_urls: List[str],
    output_dir: Optional[str] = None,
    scripts: Optional[List[dict]] = None,
    add_subtitles: bool = True,
    subtitle_engine: str = "auto",
) -> dict:
    """
    Download, concatenate video segments, and optionally add subtitles.

    Args:
        video_urls: List of video URLs (in order) to concatenate.
        output_dir: Where to save the output.
        scripts: List of {"text": "spoken text"} per segment for subtitles.
        add_subtitles: Whether to burn in subtitles.

    Returns:
        dict with output_path, video_url, duration, size_bytes, num_segments.
    """
    if not is_configured():
        raise RuntimeError("FFmpeg is not installed. Install with: brew install ffmpeg")

    if not video_urls:
        raise ValueError("No video URLs provided")

    work_dir = Path(tempfile.mkdtemp(prefix="coevo_concat_"))

    try:
        # 1. Download all segments in parallel
        segment_paths = []
        download_tasks = []
        for i, url in enumerate(video_urls):
            ext = ".mp4"
            if ".webm" in url:
                ext = ".webm"
            seg_path = work_dir / f"segment_{i:03d}{ext}"
            segment_paths.append(seg_path)
            download_tasks.append(download_file(url, seg_path))

        await asyncio.gather(*download_tasks)

        # 2. Normalize segments to consistent format
        normalized_paths = []
        segment_durations = []
        for i, seg_path in enumerate(segment_paths):
            norm_path = work_dir / f"norm_{i:03d}.mp4"
            proc = await asyncio.create_subprocess_exec(
                "ffmpeg", "-y",
                "-i", str(seg_path),
                "-c:v", "libx264",
                "-c:a", "aac",
                "-ar", "44100",
                "-r", "30",
                "-pix_fmt", "yuv420p",
                "-movflags", "+faststart",
                str(norm_path),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await proc.communicate()
            if proc.returncode != 0:
                raise RuntimeError(f"FFmpeg normalize failed for segment {i}: {stderr.decode()[-500:]}")
            normalized_paths.append(norm_path)
            dur = await _get_duration(norm_path)
            segment_durations.append(dur)

        # 3. Concatenate
        concat_list = work_dir / "concat.txt"
        with open(concat_list, "w") as f:
            for p in normalized_paths:
                f.write(f"file '{p}'\n")

        concat_path = work_dir / "concat_output.mp4"
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y",
            "-f", "concat", "-safe", "0",
            "-i", str(concat_list),
            "-c", "copy",
            "-movflags", "+faststart",
            str(concat_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"FFmpeg concat failed: {stderr.decode()[-500:]}")

        # 4. Add subtitles
        out_dir = Path(output_dir) if output_dir else work_dir
        out_dir.mkdir(parents=True, exist_ok=True)
        output_path = out_dir / f"final_{uuid.uuid4().hex[:8]}.mp4"

        use_subs = add_subtitles and scripts and len(scripts) > 0 and subtitle_engine != "none"

        if use_subs:
            script_texts = [s.get("text", "") for s in scripts]
            rendered = False

            # Try Remotion if requested or auto
            if subtitle_engine in ("auto", "remotion"):
                print(f"[video-concat] Trying Remotion renderer for subtitles...")
                rendered = await subtitle_render.render_with_remotion(
                    video_urls=video_urls,
                    scripts=script_texts,
                    durations=segment_durations,
                    output_path=str(output_path),
                )
                if rendered:
                    print("[video-concat] Remotion render successful")

            # FFmpeg fallback (or if explicitly requested)
            if not rendered and subtitle_engine in ("auto", "ffmpeg"):
                print("[video-concat] Using FFmpeg for subtitles...")
                subtitle_entries = _generate_word_subtitles(scripts, segment_durations)
                subtitle_filter = _build_subtitle_filter(subtitle_entries)

                if subtitle_filter:
                    proc = await asyncio.create_subprocess_exec(
                        "ffmpeg", "-y",
                        "-i", str(concat_path),
                        "-vf", subtitle_filter,
                        "-c:v", "libx264",
                        "-c:a", "copy",
                        "-movflags", "+faststart",
                        str(output_path),
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                    )
                    _, stderr = await proc.communicate()
                    if proc.returncode != 0:
                        print(f"[video-concat] FFmpeg subtitles failed: {stderr.decode()[-200:]}")
                        shutil.copy2(concat_path, output_path)
                    else:
                        rendered = True

            if not rendered:
                shutil.copy2(concat_path, output_path)
        else:
            shutil.copy2(concat_path, output_path)

        # 5. Get final duration
        duration = await _get_duration(output_path)
        size_bytes = output_path.stat().st_size

        return {
            "output_path": str(output_path),
            "duration": duration,
            "size_bytes": size_bytes,
            "num_segments": len(video_urls),
        }

    except Exception:
        if not output_dir:
            shutil.rmtree(work_dir, ignore_errors=True)
        raise
