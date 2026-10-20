"""
Material que manda el cliente (openspec/changes/studio-v2 §12 y §15).

Objetivo: la menor fricción posible. El cliente suelta lo que tenga (fotos, PDF, video) o pega un
link, y escribe, si quiere, para qué es. No elige tipos ni bloques: eso lo hace el equipo.
Nada entra directo a la marca: queda «nuevo» hasta que el equipo lo incorpora (a la marca o a una
campaña) o lo descarta; el cliente ve el estado.

Archivos en data/inbox/<id>/, servidos en /static/inbox/ (detrás del login).
"""
import re
import shutil
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from db.models import InboxItem
from services import brands, campaigns as campaigns_service
from services.roles import can_see_brand, is_client

router = APIRouter(tags=["inbox"])
FILES_DIR = Path(__file__).parent.parent / "data" / "inbox"
FILES_DIR.mkdir(parents=True, exist_ok=True)
CAMPAIGN_UPLOADS = Path(__file__).parent.parent / "data" / "campaign_uploads"
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".heic", ".heif"}
VIDEO_EXT = {".mp4", ".mov", ".webm", ".m4v"}
MAX_FILE = 200 * 1024 * 1024
MAX_FILES = 100

# Adónde va una imagen de la bandeja en la MARCA: lista del brand, carpeta y prefijo de URL.
BRAND_DEST = {
    "moodboard": ("moodboards", brands.get_moodboards_dir, "/static/moodboards"),
    "luz": ("lookAndFeel", brands.get_lookandfeel_dir, "/static/lookandfeel"),
    "locacion": ("backgrounds", brands.get_backgrounds_dir, "/static/backgrounds"),
    "pose": ("poses", brands.get_poses_dir, "/static/poses"),
    "plano": ("shotRefs", brands.get_shotrefs_dir, "/static/shotrefs"),
    "cara": ("avatars", brands.get_avatars_dir, "/static/avatars"),
    "prenda": ("clothing", brands.get_clothing_dir, "/static/clothing"),
    "producto": ("products", brands.get_products_dir, "/static/products"),
}
# Lo mismo, en una CAMPAÑA (tipos de campaign.inputs).
CAMPAIGN_TYPE = {"moodboard": "moodboard", "luz": "lookfeel", "locacion": "background", "pose": "pose",
                 "plano": "plano", "cara": "avatar", "prenda": "clothing", "producto": "product"}
LABEL = {"moodboard": "moodboard", "luz": "luz", "locacion": "locación", "pose": "poses", "plano": "planos",
         "cara": "caras", "prenda": "prendas", "producto": "productos"}


def _who(request: Request) -> str:
    return (request.scope.get("state") or {}).get("access_email") or "local"


def _kind(ext: str) -> str:
    return "image" if ext in IMAGE_EXT else "video" if ext in VIDEO_EXT else "pdf" if ext == ".pdf" else "other"


def _out(i: InboxItem) -> dict:
    return {
        "id": i.id, "brandId": i.brand_id, "campaignId": i.campaign_id, "files": i.files or [], "link": i.link,
        "note": i.note, "author": i.author, "status": i.status, "result": i.result,
        "createdAt": i.created_at.isoformat() if i.created_at else None,
    }


@router.post("/api/brands/{brand_id}/inbox")
async def send_material(
    brand_id: str, request: Request,
    note: Optional[str] = Form(None), link: Optional[str] = Form(None), campaignId: Optional[str] = Form(None),
    files: List[UploadFile] = File(default=[]),
    s: AsyncSession = Depends(get_session),
):
    if not brands.find_brand(brands.load_brands(), brand_id) or not can_see_brand(request, brand_id):
        raise HTTPException(status_code=404, detail="No existe esa marca")
    files = [f for f in files if f and f.filename]
    if not files and not (link or "").strip() and not (note or "").strip():
        raise HTTPException(status_code=400, detail="Mandá al menos un archivo, un link o una nota.")
    if len(files) > MAX_FILES:
        raise HTTPException(status_code=400, detail=f"Hasta {MAX_FILES} archivos por envío. Para más, mandá un link de Drive.")
    item = InboxItem(brand_id=brand_id, campaign_id=None if is_client(request) else (campaignId or None),
                     link=(link or "").strip()[:1000] or None, note=(note or "").strip()[:4000] or None,
                     author=_who(request), status="nuevo", files=[])
    item.id = f"ib_{uuid.uuid4().hex[:12]}"
    folder = FILES_DIR / item.id
    folder.mkdir(parents=True, exist_ok=True)
    saved = []
    try:
        for f in files:
            ext = Path(f.filename).suffix.lower()
            name = f"{uuid.uuid4().hex[:6]}_{re.sub(r'[^A-Za-z0-9._-]+', '-', Path(f.filename).name)[:80]}"
            size = 0
            with open(folder / name, "wb") as fh:
                while chunk := await f.read(1024 * 1024):
                    size += len(chunk)
                    if size > MAX_FILE:
                        raise HTTPException(status_code=413, detail=f"{f.filename} pesa más de 200 MB: mandalo por link.")
                    fh.write(chunk)
            saved.append({"url": f"/static/inbox/{item.id}/{name}", "name": f.filename, "kind": _kind(ext)})
        item.files = saved
        s.add(item)
        await s.commit()
    except Exception:
        shutil.rmtree(folder, ignore_errors=True)
        raise
    return _out(item)


@router.get("/api/brands/{brand_id}/inbox")
async def list_material(brand_id: str, request: Request, s: AsyncSession = Depends(get_session)):
    if not can_see_brand(request, brand_id):
        raise HTTPException(status_code=404, detail="No existe esa marca")
    rows = (await s.execute(select(InboxItem).where(InboxItem.brand_id == brand_id).order_by(InboxItem.created_at.desc()))).scalars().all()
    return [_out(i) for i in rows]


class IncorporateIn(BaseModel):
    # "marca" o el id de una campaña
    target: str = "marca"
    # adónde va cada imagen: un tipo para todas, o uno por url
    type: str = "moodboard"
    perFile: dict = {}
    discard: List[str] = []   # urls que no se incorporan


@router.post("/api/inbox/{item_id}/incorporar")
async def incorporate(item_id: str, req: IncorporateIn, request: Request, s: AsyncSession = Depends(get_session)):
    """El equipo suma las imágenes a la marca o a una campaña. El resto (PDF, video, link) queda acá."""
    if is_client(request):
        raise HTTPException(status_code=403, detail="No tenés acceso a esto.")
    item = await s.get(InboxItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="No existe")
    images = [f for f in (item.files or []) if f["kind"] == "image" and f["url"] not in set(req.discard)]
    if not images:
        raise HTTPException(status_code=400, detail="No hay imágenes para incorporar")
    counts: dict = {}
    if req.target == "marca":
        all_b = brands.load_brands()
        b = brands.find_brand(all_b, item.brand_id)
        for f in images:
            t = req.perFile.get(f["url"], req.type)
            if t not in BRAND_DEST:
                raise HTTPException(status_code=400, detail=f"Destino inválido: {t}")
            key, folder_fn, prefix = BRAND_DEST[t]
            src = FILES_DIR / f["url"].split("/static/inbox/", 1)[1]
            nid = uuid.uuid4().hex[:8]
            fname = f"{item.brand_id}_in_{nid}{src.suffix.lower()}"
            shutil.copyfile(src, folder_fn() / fname)
            entry = {"id": nid, "name": Path(f["name"]).stem[:60], "description": "Lo mandó el cliente",
                     "filename": fname, "imageUrl": f"{prefix}/{fname}"}
            b.setdefault(key, []).append(entry)
            counts[t] = counts.get(t, 0) + 1
        brands.save_brands(all_b)
        where = "tu marca"
    else:
        items = campaigns_service.load_campaigns()
        c = campaigns_service.find_campaign(items, req.target)
        if not c or c.get("brandId") != item.brand_id:
            raise HTTPException(status_code=404, detail="Esa campaña no es de esta marca")
        new = []
        for f in images:
            t = req.perFile.get(f["url"], req.type)
            src = FILES_DIR / f["url"].split("/static/inbox/", 1)[1]
            fname = f"in_{c['id']}_{uuid.uuid4().hex[:8]}{src.suffix.lower()}"
            shutil.copyfile(src, CAMPAIGN_UPLOADS / fname)
            new.append({"id": f"cin_{uuid.uuid4().hex[:8]}", "url": f"/static/campaign-uploads/{fname}",
                        "type": CAMPAIGN_TYPE.get(t, "reference"), "name": Path(f["name"]).stem[:80],
                        "filename": f["name"], "uploadedAt": item.created_at.isoformat() if item.created_at else None})
            counts[t] = counts.get(t, 0) + 1
        c["inputs"] = (c.get("inputs") or []) + new
        campaigns_service.apply_update(c, {"inputs": c["inputs"]})
        campaigns_service.save_campaigns(items)
        where = f"la campaña «{c.get('name')}»"
    item.status = "incorporado"
    item.result = f"{sum(counts.values())} sumadas a {where} ({', '.join(f'{n} {LABEL.get(t, t)}' for t, n in counts.items())})"
    await s.commit()
    return _out(item)


@router.post("/api/inbox/{item_id}/descartar")
async def discard(item_id: str, request: Request, s: AsyncSession = Depends(get_session)):
    if is_client(request):
        raise HTTPException(status_code=403, detail="No tenés acceso a esto.")
    item = await s.get(InboxItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="No existe")
    item.status, item.result = "descartado", "Lo revisamos: no lo sumamos esta vez"
    await s.commit()
    return _out(item)
