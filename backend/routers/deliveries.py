"""
Entregas: lo que Coevo le entrega a una marca para revisar (openspec/changes/studio-v2 P.3).

Una entrega es una pieza (carrusel, video, imágenes) con sus láminas en orden y, si hay, su
fuente editable (ej. el HTML del carrusel). Se comenta lámina por lámina, anclando un punto;
se pide cambios o se aprueba. Claude sube y corrige desde el MCP `coevo-studio`.

Archivos: backend/data/deliveries/<id>/ (R2 cuando esté, infra-v1 3.1), servidos en
/static/deliveries/<id>/<archivo>, detrás del mismo login que todo lo demás.
Autor: el mail que firmó Cloudflare Access (o `servicio:<token>` para Claude); en dev, "local".

Dos pasos (studio-v2 §11): toda entrega nace `interna` (la ve el equipo; Claude sube acá).
"Mandar al cliente" la pasa a `cliente`. La vista del cliente (`?vista=cliente`) sólo ve lo
mandado y los comentarios no internos. Una ronda nueva vuelve a `interna`: el equipo la revisa
antes de volver a mandarla. Hasta que haya roles (studio-v2 §3), la vista la elige la pantalla.
"""
import re
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from db.models import Delivery, DeliveryComment
from services import brands

router = APIRouter(tags=["deliveries"])
FILES_DIR = Path(__file__).parent.parent / "data" / "deliveries"
FILES_DIR.mkdir(parents=True, exist_ok=True)
KINDS = {"carrusel", "video", "imagenes"}
STATUSES = {"en_revision", "cambios", "aprobada"}
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
VIDEO_EXT = {".mp4", ".mov", ".webm"}
SOURCE_EXT = {".html", ".json", ".zip"}
MAX_FILE = 200 * 1024 * 1024


def _who(request: Request) -> str:
    return (request.scope.get("state") or {}).get("access_email") or "local"


def _iso(d: Optional[datetime]) -> Optional[str]:
    return d.isoformat() if d else None


def _require_brand(brand_id: str) -> dict:
    b = brands.find_brand(brands.load_brands(), brand_id)
    if not b:
        raise HTTPException(status_code=404, detail=f"No existe la marca {brand_id}")
    return b


def _safe_name(name: str) -> str:
    stem = Path(name or "archivo").name
    return re.sub(r"[^A-Za-z0-9._-]+", "-", stem).strip("-") or "archivo"


async def _store(delivery_id: str, round_: int, f: UploadFile, allowed: set) -> dict:
    ext = Path(f.filename or "").suffix.lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"Tipo de archivo no admitido: {f.filename}")
    d = FILES_DIR / delivery_id / f"r{round_}"
    d.mkdir(parents=True, exist_ok=True)
    out = d / f"{uuid.uuid4().hex[:6]}_{_safe_name(f.filename)}"
    size = 0
    with open(out, "wb") as fh:
        while chunk := await f.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_FILE:
                fh.close(); out.unlink()
                raise HTTPException(status_code=413, detail=f"{f.filename} pesa más de 200 MB")
            fh.write(chunk)
    rel = out.relative_to(FILES_DIR).as_posix()
    return {"url": f"/static/deliveries/{rel}", "name": f.filename, "ext": ext}


async def _store_items(delivery_id: str, round_: int, files: List[UploadFile], labels: List[str]) -> list:
    items = []
    for i, f in enumerate(files):
        s = await _store(delivery_id, round_, f, IMAGE_EXT | VIDEO_EXT)
        items.append({
            "id": uuid.uuid4().hex[:8], "url": s["url"],
            "kind": "video" if s["ext"] in VIDEO_EXT else "image",
            "label": labels[i] if i < len(labels) and labels[i] else f"{i + 1:02d}",
        })
    return items


def _comment(c: DeliveryComment) -> dict:
    return {
        "id": c.id, "itemId": c.item_id, "x": c.x, "y": c.y, "text": c.text, "author": c.author, "internal": c.internal,
        "round": c.round, "resolvedAt": _iso(c.resolved_at), "createdAt": _iso(c.created_at),
    }


def _summary(d: Delivery, open_comments: int = 0) -> dict:
    return {
        "id": d.id, "brandId": d.brand_id, "title": d.title, "kind": d.kind, "status": d.status,
        "visibility": d.visibility, "sentAt": _iso(d.sent_at),
        "round": d.round, "items": len(d.items or []), "cover": (d.items or [{}])[0].get("url"),
        "openComments": open_comments, "createdBy": d.created_by,
        "approvedBy": d.approved_by, "approvedAt": _iso(d.approved_at),
        "createdAt": _iso(d.created_at), "updatedAt": _iso(d.updated_at),
    }


async def _get(s: AsyncSession, delivery_id: str) -> Delivery:
    d = await s.get(Delivery, delivery_id)
    if not d:
        raise HTTPException(status_code=404, detail="No existe esa entrega")
    return d


async def _full(s: AsyncSession, d: Delivery, client: bool = False) -> dict:
    rows = (await s.execute(
        select(DeliveryComment).where(DeliveryComment.delivery_id == d.id).order_by(DeliveryComment.created_at)
    )).scalars().all()
    if client:
        rows = [c for c in rows if not c.internal]
    return {
        **_summary(d, sum(1 for c in rows if not c.resolved_at)),
        "items": d.items or [], "source": d.source, "note": d.note, "template": d.template,
        "comments": [_comment(c) for c in rows],
    }


# ── Entregas ──────────────────────────────────────────────────────────────

@router.get("/api/brands/{brand_id}/deliveries")
async def list_deliveries(brand_id: str, vista: Optional[str] = None, s: AsyncSession = Depends(get_session)):
    """`vista=cliente`: sólo lo mandado al cliente, contando sólo sus comentarios."""
    _require_brand(brand_id)
    client = vista == "cliente"
    q = select(Delivery).where(Delivery.brand_id == brand_id)
    if client:
        q = q.where(Delivery.visibility == "cliente")
    rows = (await s.execute(q.order_by(Delivery.updated_at.desc()))).scalars().all()
    open_by = {}
    if rows:
        cq = select(DeliveryComment).where(
            DeliveryComment.delivery_id.in_([d.id for d in rows]), DeliveryComment.resolved_at.is_(None))
        if client:
            cq = cq.where(DeliveryComment.internal.is_(False))
        for c in (await s.execute(cq)).scalars():
            open_by[c.delivery_id] = open_by.get(c.delivery_id, 0) + 1
    return [_summary(d, open_by.get(d.id, 0)) for d in rows]


@router.post("/api/brands/{brand_id}/deliveries")
async def create_delivery(
    brand_id: str, request: Request,
    title: str = Form(...), kind: str = Form("carrusel"), note: Optional[str] = Form(None),
    template: Optional[str] = Form(None), labels: Optional[str] = Form(None, description="etiquetas separadas por |"),
    files: List[UploadFile] = File(...), source: Optional[UploadFile] = File(None),
    s: AsyncSession = Depends(get_session),
):
    """Sube una entrega: `files` son las láminas EN ORDEN; `source`, la fuente editable."""
    _require_brand(brand_id)
    if kind not in KINDS:
        raise HTTPException(status_code=400, detail=f"kind debe ser uno de {sorted(KINDS)}")
    if not files:
        raise HTTPException(status_code=400, detail="Una entrega necesita al menos una lámina")
    d = Delivery(brand_id=brand_id, title=title.strip()[:200], kind=kind, status="en_revision",
                 note=note, template=template, round=1, created_by=_who(request), items=[])
    d.id = f"dl_{uuid.uuid4().hex[:12]}"
    try:
        d.items = await _store_items(d.id, 1, files, (labels or "").split("|"))
        if source and source.filename:
            st = await _store(d.id, 1, source, SOURCE_EXT)
            d.source = {"url": st["url"], "name": st["name"]}
        s.add(d)
        await s.commit()
    except Exception:
        shutil.rmtree(FILES_DIR / d.id, ignore_errors=True)
        raise
    await s.refresh(d)
    return await _full(s, d)


@router.get("/api/deliveries/{delivery_id}")
async def get_delivery(delivery_id: str, vista: Optional[str] = None, s: AsyncSession = Depends(get_session)):
    d = await _get(s, delivery_id)
    if vista == "cliente" and d.visibility != "cliente":
        raise HTTPException(status_code=404, detail="No existe esa entrega")
    return await _full(s, d, client=vista == "cliente")


@router.post("/api/deliveries/{delivery_id}/send")
async def send_to_client(delivery_id: str, s: AsyncSession = Depends(get_session)):
    """Mandar al cliente: desde acá la ve, en revisión, sin los comentarios internos."""
    d = await _get(s, delivery_id)
    d.visibility, d.status, d.sent_at = "cliente", "en_revision", datetime.now(timezone.utc)
    d.approved_by = d.approved_at = None
    await s.commit()
    await s.refresh(d)
    return await _full(s, d)


@router.post("/api/deliveries/{delivery_id}/round")
async def new_round(
    delivery_id: str, request: Request,
    note: Optional[str] = Form(None), labels: Optional[str] = Form(None),
    files: List[UploadFile] = File(...), source: Optional[UploadFile] = File(None),
    s: AsyncSession = Depends(get_session),
):
    """Nueva versión de las láminas (después de aplicar comentarios). Vuelve a 'en revisión'.
    Las láminas viejas quedan en disco: los comentarios de la ronda anterior siguen apuntando ahí."""
    d = await _get(s, delivery_id)
    nxt = d.round + 1
    items = await _store_items(d.id, nxt, files, (labels or "").split("|"))
    if source and source.filename:
        st = await _store(d.id, nxt, source, SOURCE_EXT)
        d.source = {"url": st["url"], "name": st["name"]}
    d.items, d.round, d.status = items, nxt, "en_revision"
    d.visibility = "interna"   # el equipo la revisa antes de volver a mandarla
    d.approved_by = d.approved_at = None
    if note:
        d.note = note
    await s.commit()
    await s.refresh(d)
    return await _full(s, d)


class StatusIn(BaseModel):
    status: str


@router.post("/api/deliveries/{delivery_id}/status")
async def set_status(delivery_id: str, req: StatusIn, request: Request, s: AsyncSession = Depends(get_session)):
    if req.status not in STATUSES:
        raise HTTPException(status_code=400, detail=f"status debe ser uno de {sorted(STATUSES)}")
    d = await _get(s, delivery_id)
    d.status = req.status
    if req.status == "aprobada":
        d.approved_by, d.approved_at = _who(request), datetime.now(timezone.utc)
    else:
        d.approved_by = d.approved_at = None
    await s.commit()
    await s.refresh(d)
    return await _full(s, d)


@router.delete("/api/deliveries/{delivery_id}")
async def delete_delivery(delivery_id: str, s: AsyncSession = Depends(get_session)):
    d = await _get(s, delivery_id)
    await s.delete(d)
    await s.commit()
    shutil.rmtree(FILES_DIR / delivery_id, ignore_errors=True)
    return {"ok": True}


# ── Comentarios ───────────────────────────────────────────────────────────

class CommentIn(BaseModel):
    text: str
    # Desde la vista del cliente: no es interno. Con roles lo va a decidir el usuario, no la pantalla.
    asClient: bool = False
    itemId: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None


@router.post("/api/deliveries/{delivery_id}/comments")
async def add_comment(delivery_id: str, req: CommentIn, request: Request, s: AsyncSession = Depends(get_session)):
    d = await _get(s, delivery_id)
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="El comentario está vacío")
    if req.asClient and d.visibility != "cliente":
        raise HTTPException(status_code=404, detail="No existe esa entrega")
    if req.itemId and req.itemId not in {i["id"] for i in d.items or []}:
        raise HTTPException(status_code=400, detail="Esa lámina no es de la ronda actual")
    clamp = lambda v: None if v is None else min(1.0, max(0.0, float(v)))
    c = DeliveryComment(delivery_id=d.id, item_id=req.itemId, x=clamp(req.x), y=clamp(req.y),
                        text=text[:4000], author=_who(request), round=d.round, internal=not req.asClient)
    c.id = f"dc_{uuid.uuid4().hex[:12]}"
    s.add(c)
    if d.status == "aprobada":
        d.status, d.approved_by, d.approved_at = "cambios", None, None
    await s.commit()
    return _comment(c)


@router.post("/api/deliveries/{delivery_id}/comments/{comment_id}/resolve")
async def resolve_comment(delivery_id: str, comment_id: str, s: AsyncSession = Depends(get_session)):
    c = await s.get(DeliveryComment, comment_id)
    if not c or c.delivery_id != delivery_id:
        raise HTTPException(status_code=404, detail="No existe ese comentario")
    c.resolved_at = None if c.resolved_at else datetime.now(timezone.utc)
    await s.commit()
    return _comment(c)
