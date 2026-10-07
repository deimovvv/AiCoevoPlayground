"""
Capa de texto del editor de video
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Graba los textos de la marca (título, prenda, precio, CTA, subtítulo) sobre el video ya
editado. El dibujo lo hace el MISMO componente React que la vista previa del editor
(`frontend/src/components/workspace/TextLayer.tsx`), montado en Remotion cuadro a cuadro
(`frontend/src/remotion/render-text.mjs`). Lo que se ve en el editor es lo que se graba.

El tamaño y la duración salen del video real (ffprobe): el texto se compone sobre el
cuadro verdadero, no sobre uno supuesto.
"""

import asyncio
import json
import shutil
import tempfile
import uuid
from pathlib import Path
from typing import List, Optional

FRONTEND_DIR = Path(__file__).parent.parent.parent / "frontend"
RENDER_SCRIPT = FRONTEND_DIR / "src" / "remotion" / "render-text.mjs"
RENDERS_DIR = Path(__file__).parent.parent / "data" / "renders"
LOCAL_BASE = "http://127.0.0.1:8000"


def is_configured() -> bool:
    return bool(shutil.which("node")) and bool(shutil.which("ffprobe")) and RENDER_SCRIPT.exists()


async def _probe(url: str) -> dict:
    proc = await asyncio.create_subprocess_exec(
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height:format=duration", "-of", "json", url,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    out, err = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(f"No pude leer el video: {err.decode()[-300:]}")
    data = json.loads(out.decode())
    st = (data.get("streams") or [{}])[0]
    return {"width": int(st["width"]), "height": int(st["height"]), "duration": float(data["format"]["duration"])}


async def render_text_overlay(
    video_url: str,
    blocks: List[dict],
    theme: dict,
    font_families: Optional[List[str]] = None,
    font_urls: Optional[List[str]] = None,
) -> dict:
    """Devuelve {"video_url": "/static/renders/...", "duration": s}."""
    if not is_configured():
        raise RuntimeError("Falta node, ffprobe o el script de Remotion para grabar los textos")
    src = f"{LOCAL_BASE}{video_url}" if video_url.startswith("/") else video_url
    info = await _probe(src)
    # h264 pide lados pares.
    width, height = info["width"] - info["width"] % 2, info["height"] - info["height"] % 2

    RENDERS_DIR.mkdir(parents=True, exist_ok=True)
    out = RENDERS_DIR / f"text_{uuid.uuid4().hex[:8]}.mp4"
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
        json.dump({
            "videoUrl": src, "blocks": blocks, "theme": theme, "fontFamilies": font_families or [], "fontUrls": font_urls or [],
            "width": width, "height": height, "duration": info["duration"], "output": str(out),
        }, f)
        job_path = f.name

    try:
        proc = await asyncio.create_subprocess_exec(
            "node", str(RENDER_SCRIPT), "--job", job_path,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, cwd=str(FRONTEND_DIR),
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0 or not out.exists():
            tail = (stderr.decode() or stdout.decode())[-500:]
            raise RuntimeError(f"Remotion no pudo grabar los textos: {tail}")
    finally:
        Path(job_path).unlink(missing_ok=True)

    return {"video_url": f"/static/renders/{out.name}", "duration": round(info["duration"], 2)}
