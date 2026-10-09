"""
Proyectos del editor de video (`timeline.json` en una carpeta)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Un proyecto es una carpeta con `timeline.json` (formato en
openspec/changes/archive/2026-10-09-editor-timeline-project/design.md). Lo escriben Claude (desde una skill)
y el editor (desde la UI): los dos editan el MISMO archivo.

- Sólo se abren carpetas dentro de las raíces permitidas; los archivos se resuelven dentro
  de la carpeta del proyecto (sin `..` ni symlinks hacia afuera).
- Nada se copia a backend/data/: el export se escribe en `<proyecto>/export/`. Importa
  porque se usa con material de terceros (End Cards es de Monks).
- Starlette 0.36 no sirve rangos HTTP, y sin rangos el <video> no puede saltar: los
  archivos se sirven con un endpoint propio que sí los soporta (`file_response`).
"""

import asyncio
import json
import os
import re
import time
import uuid
from pathlib import Path
from typing import List, Optional

HOME = Path.home()
ALLOWED_ROOTS = [HOME / "Downloads", HOME / "Documents", HOME / "Desktop", HOME / "cov"]
PROJECT_FILE = "timeline.json"
NOTES_FILE = "notas.md"
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp"}
IMAGE_DEFAULT_SECS = 3.0


class ProjectError(ValueError):
    pass


def resolve_dir(path: str) -> Path:
    d = Path(path).expanduser().resolve()
    if not any(d == r.resolve() or r.resolve() in d.parents for r in ALLOWED_ROOTS):
        raise ProjectError("Esa carpeta no está permitida. Usá una dentro de Descargas, Documentos, Escritorio o ~/cov.")
    if not d.is_dir():
        raise ProjectError(f"No existe la carpeta: {d}")
    return d


def resolve_file(project_dir: Path, rel: str) -> Path:
    f = (project_dir / rel).resolve()
    if project_dir not in f.parents and f != project_dir:
        raise ProjectError("Ese archivo está fuera del proyecto.")
    if not f.is_file():
        raise ProjectError(f"No existe: {rel}")
    return f


async def _duration(f: Path) -> Optional[float]:
    if f.suffix.lower() in IMAGE_EXT:
        return None
    proc = await asyncio.create_subprocess_exec(
        "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f),
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    out, _ = await proc.communicate()
    try:
        return round(float(out.decode().strip()), 3)
    except ValueError:
        return None


async def load(path: str) -> dict:
    """{"dir", "project", "mtime", "media": {ruta: duración|None}, "notes": str}."""
    d = resolve_dir(path)
    pf = d / PROJECT_FILE
    if not pf.is_file():
        raise ProjectError(f"La carpeta no tiene {PROJECT_FILE}.")
    try:
        project = json.loads(pf.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise ProjectError(f"{PROJECT_FILE} no es JSON válido: {e}")
    rels = set()
    for s in project.get("segments", []):
        for k in ("src", "voice", "overlay"):
            if s.get(k):
                rels.add(s[k])
    media = {}
    for rel in sorted(rels):
        try:
            media[rel] = await _duration(resolve_file(d, rel))
        except ProjectError:
            media[rel] = "missing"
    notes = (d / NOTES_FILE).read_text(encoding="utf-8") if (d / NOTES_FILE).is_file() else ""
    return {"dir": str(d), "project": project, "mtime": pf.stat().st_mtime, "media": media, "notes": notes}


def mtime(path: str) -> float:
    pf = resolve_dir(path) / PROJECT_FILE
    return pf.stat().st_mtime if pf.is_file() else 0.0


def save(path: str, project: dict, base_mtime: Optional[float] = None) -> dict:
    """Guarda el proyecto. Si `base_mtime` no coincide, alguien (Claude) lo cambió después
    de que la UI lo abrió: no se pisa, se avisa."""
    d = resolve_dir(path)
    pf = d / PROJECT_FILE
    if base_mtime is not None and pf.is_file() and abs(pf.stat().st_mtime - base_mtime) > 0.001:
        raise ProjectError("conflicto: timeline.json cambió en disco (¿lo editó Claude?). Recargá antes de guardar.")
    if pf.is_file():
        (d / f".{PROJECT_FILE}.prev").write_text(pf.read_text(encoding="utf-8"), encoding="utf-8")
    tmp = d / f".{PROJECT_FILE}.{uuid.uuid4().hex[:6]}.tmp"
    tmp.write_text(json.dumps(project, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, pf)
    return {"mtime": pf.stat().st_mtime}


def _fmt(t: float) -> str:
    return f"{int(t // 60)}:{t % 60:04.1f}"


def save_notes(path: str, notes: List[dict]) -> dict:
    """Escribe `notas.md` con el formato de la guía de edición: momento — qué cambiar.
    Se reescribe entero desde las notas del editor (son la fuente)."""
    d = resolve_dir(path)
    lines = [
        "# Notas del editor",
        "",
        "Cada línea: momento en el video armado · tramo — qué cambiar.",
        "Cambiá sólo lo anotado y dejá todo lo demás exactamente como está.",
        "",
    ]
    for n in sorted(notes, key=lambda x: x.get("t", 0)):
        state = {"regenerated": " (hecho)", "rule": " (regla)"}.get(n.get("status", ""), "")
        text = re.sub(r"\s+", " ", str(n.get("text", ""))).strip()
        lines.append(f"- {_fmt(float(n.get('t', 0)))} · {n.get('segment', '')} — {text}{state}")
    (d / NOTES_FILE).write_text("\n".join(lines) + "\n", encoding="utf-8")
    return {"count": len(notes)}


# ── Export ────────────────────────────────────────────────────────────────

async def _run(*args: str) -> None:
    proc = await asyncio.create_subprocess_exec(*args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    _, err = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(err.decode()[-500:])


async def render(path: str, segments: List[dict]) -> dict:
    """Arma el video del proyecto con FFmpeg. `segments` ya viene RESUELTO por el editor
    (orden y recortes de la UI): [{src, in, duration, voice?, overlay?}].

    Por tramo: fuente desde `in`, escalada y centrada sobre el fondo, congelando el último
    cuadro si es más corta que el tramo, rótulo encima, y su locución (o silencio) con el
    mismo largo exacto. Después se concatenan. Salida: <proyecto>/export/.
    """
    d = resolve_dir(path)
    project = json.loads((d / PROJECT_FILE).read_text(encoding="utf-8"))
    W, H = int(project.get("width", 1080)), int(project.get("height", 1920))
    fps = int(project.get("fps", 30))
    bg = str(project.get("background", "#000000")).lstrip("#")
    out_dir = d / "export"
    work = out_dir / f".work_{uuid.uuid4().hex[:6]}"
    work.mkdir(parents=True, exist_ok=True)
    parts = []
    try:
        for i, s in enumerate(segments):
            dur = float(s["duration"])
            src = resolve_file(d, s["src"])
            is_img = src.suffix.lower() in IMAGE_EXT
            args = ["ffmpeg", "-v", "error", "-y"]
            if is_img:
                args += ["-loop", "1", "-t", f"{dur:.3f}", "-i", str(src)]
            else:
                args += ["-ss", f"{float(s.get('in', 0)):.3f}", "-i", str(src)]
            n_in = 1
            ov = resolve_file(d, s["overlay"]) if s.get("overlay") else None
            if ov:
                args += ["-loop", "1", "-t", f"{dur:.3f}", "-i", str(ov)]; ov_idx = n_in; n_in += 1
            voice = resolve_file(d, s["voice"]) if s.get("voice") else None
            if voice:
                args += ["-i", str(voice)]; a_idx = n_in; n_in += 1
            else:
                args += ["-f", "lavfi", "-t", f"{dur:.3f}", "-i", "anullsrc=r=48000:cl=stereo"]; a_idx = n_in; n_in += 1
            v = (f"[0:v]scale={W}:{H}:force_original_aspect_ratio=decrease,"
                 f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color=0x{bg},fps={fps},"
                 f"tpad=stop_mode=clone:stop_duration={dur:.3f},trim=duration={dur:.3f},setpts=PTS-STARTPTS")
            if ov:
                v += f"[base];[{ov_idx}:v]scale={W}:{H}[ov];[base][ov]overlay=0:0:shortest=0,trim=duration={dur:.3f}"
            v += "[v]"
            a = f"[{a_idx}:a]aresample=48000,aformat=channel_layouts=stereo,apad,atrim=duration={dur:.3f},asetpts=PTS-STARTPTS[a]"
            part = work / f"p{i:03d}.mp4"
            args += ["-filter_complex", f"{v};{a}", "-map", "[v]", "-map", "[a]", "-r", str(fps),
                     "-c:v", "libx264", "-crf", "19", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
                     "-t", f"{dur:.3f}", str(part)]
            await _run(*args)
            parts.append(part)
        lst = work / "lista.txt"
        lst.write_text("".join(f"file '{p.name}'\n" for p in parts))
        out = out_dir / f"edit_{time.strftime('%Y%m%d-%H%M%S')}.mp4"
        await _run("ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst),
                   "-c", "copy", "-movflags", "+faststart", str(out))
    finally:
        for p in work.glob("*"):
            p.unlink()
        work.rmdir()
    dur = await _duration(out)
    return {"file": str(out.relative_to(d)), "duration": dur}


def file_response(project_dir_path: str, rel: str, range_header: Optional[str]):
    """Sirve un archivo del proyecto con soporte de rangos (206), para poder saltar."""
    from fastapi.responses import Response
    import mimetypes
    f = resolve_file(resolve_dir(project_dir_path), rel)
    size = f.stat().st_size
    ctype = mimetypes.guess_type(str(f))[0] or "application/octet-stream"
    headers = {"Accept-Ranges": "bytes", "Cache-Control": "no-cache"}
    m = re.match(r"bytes=(\d*)-(\d*)", range_header or "")
    if not m:
        headers["Content-Length"] = str(size)
        return Response(f.read_bytes(), media_type=ctype, headers=headers)
    start = int(m.group(1)) if m.group(1) else max(0, size - int(m.group(2) or 0))
    end = int(m.group(2)) if m.group(1) and m.group(2) else size - 1
    end = min(end, size - 1, start + 8 * 1024 * 1024 - 1)   # tramos de 8 MB como máximo
    with open(f, "rb") as fh:
        fh.seek(start)
        data = fh.read(end - start + 1)
    headers.update({"Content-Range": f"bytes {start}-{end}/{size}", "Content-Length": str(len(data))})
    return Response(data, status_code=206, media_type=ctype, headers=headers)
