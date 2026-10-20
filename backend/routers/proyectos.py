"""
Videos online (studio-v2): «Nuevo video» en la app → subís los clips → el editor los abre.

Un proyecto es una carpeta en el servidor con su `timeline.json` (el mismo formato que las carpetas
locales que arma Claude): data/projects/<marca>/<id>/. Así el editor, el export y la revisión
automática funcionan igual que en local. Los clips se suben de a uno (Cloudflare corta en 100 MB).
"""
import json
import re
import time
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from services import brands
from services.editor_project import IMAGE_EXT, PROJECT_FILE, SERVER_PROJECTS, _duration
from services.roles import is_client

router = APIRouter(tags=["proyectos"])
VIDEO_EXT = {".mp4", ".mov", ".webm", ".m4v"}
AUDIO_EXT = {".mp3", ".wav", ".m4a", ".aac"}


def _team(request: Request) -> None:
    if is_client(request):
        raise HTTPException(status_code=403, detail="No tenés acceso a esto.")


def _folder(brand_id: str, pid: str) -> Path:
    if not re.fullmatch(r"vp_[0-9a-f]{10}", pid) or not re.fullmatch(r"[a-z0-9_-]{1,80}", brand_id):
        raise HTTPException(status_code=404, detail="No existe ese video")
    d = SERVER_PROJECTS / brand_id / pid
    if not (d / PROJECT_FILE).is_file():
        raise HTTPException(status_code=404, detail="No existe ese video")
    return d


@router.get("/api/brands/{brand_id}/videos")
def list_videos(brand_id: str, request: Request):
    _team(request)
    out = []
    for d in sorted((SERVER_PROJECTS / brand_id).glob("vp_*"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            t = json.loads((d / PROJECT_FILE).read_text(encoding="utf-8"))
        except Exception:
            continue
        segs = t.get("segments") or []
        out.append({"id": d.name, "path": str(d), "title": t.get("title"), "segments": len(segs),
                    "cover": next((s["src"] for s in segs if Path(s["src"]).suffix.lower() in IMAGE_EXT), None),
                    "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime((d / PROJECT_FILE).stat().st_mtime))})
    return out


@router.post("/api/brands/{brand_id}/videos")
def create_video(brand_id: str, request: Request, title: str = Form("Video sin título"),
                 width: int = Form(1080), height: int = Form(1920)):
    _team(request)
    if not brands.find_brand(brands.load_brands(), brand_id):
        raise HTTPException(status_code=404, detail="No existe esa marca")
    pid = f"vp_{uuid.uuid4().hex[:10]}"
    d = SERVER_PROJECTS / brand_id / pid
    d.mkdir(parents=True)
    (d / PROJECT_FILE).write_text(json.dumps({
        "version": 1, "title": title.strip()[:120] or "Video sin título", "width": width, "height": height,
        "fps": 30, "background": "#000000", "segments": [],
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"id": pid, "path": str(d)}


@router.post("/api/brands/{brand_id}/videos/{pid}/clips")
async def add_clip(brand_id: str, pid: str, request: Request, file: UploadFile = File(...)):
    """Suma un clip (video o imagen) al final del timeline. Se sube de a uno."""
    _team(request)
    d = _folder(brand_id, pid)
    ext = Path(file.filename or "").suffix.lower()
    if ext not in VIDEO_EXT | IMAGE_EXT:
        raise HTTPException(status_code=400, detail=f"Tipo no admitido: {file.filename}")
    name = f"{uuid.uuid4().hex[:6]}_{re.sub(r'[^A-Za-z0-9._-]+', '-', Path(file.filename).name)[:80]}"
    (d / "media").mkdir(exist_ok=True)
    with open(d / "media" / name, "wb") as fh:
        while chunk := await file.read(1024 * 1024):
            fh.write(chunk)
    rel = f"media/{name}"
    t = json.loads((d / PROJECT_FILE).read_text(encoding="utf-8"))
    seg = {"id": f"s{len(t['segments']) + 1:02d}_{uuid.uuid4().hex[:4]}", "src": rel, "label": Path(file.filename).stem[:60]}
    if ext in IMAGE_EXT:
        seg["duration"] = 3
    else:
        dur = await _duration(d / rel)
        if dur:
            seg["out"] = dur
    t["segments"].append(seg)
    (d / PROJECT_FILE).write_text(json.dumps(t, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"segment": seg, "count": len(t["segments"])}
