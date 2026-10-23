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
from services import brands, campaigns as campaigns_service, mailer
from services.roles import can_approve, can_see_brand, is_client

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


def _poster(url: str) -> Optional[str]:
    """Portada de un video de la entrega: un cuadro con FFmpeg, junto al archivo (se hace una vez).
    Sin esto, en la lista y en la vista de la pieza el video se ve como una imagen rota."""
    rel = url.split("/static/deliveries/", 1)[-1]
    src = FILES_DIR / rel
    out = src.with_name(src.stem + ".poster.jpg")
    if not out.exists() and src.is_file():
        import subprocess
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "0.5", "-i", str(src), "-frames:v", "1",
                        "-vf", "scale=720:-2", "-q:v", "4", str(out)], timeout=30, check=False)
    return f"/static/deliveries/{out.relative_to(FILES_DIR).as_posix()}" if out.exists() else None


def _items(d: Delivery) -> list:
    return [{**it, "poster": _poster(it["url"])} if it.get("kind") == "video" else it for it in (d.items or [])]


def _comment(c: DeliveryComment, clients: Optional[set] = None) -> dict:
    """`byClient`: lo escribió alguien del cliente (no Coevo). Sin la lista de clientes, se deduce de `internal`."""
    by_client = (c.author or "").lower() in clients if clients is not None else not c.internal
    return {
        "id": c.id, "itemId": c.item_id, "x": c.x, "y": c.y, "text": c.text, "author": c.author, "internal": c.internal,
        "byClient": by_client and not c.internal,
        "round": c.round, "resolvedAt": _iso(c.resolved_at), "createdAt": _iso(c.created_at),
    }


def _campaign_names() -> dict:
    return {c["id"]: c.get("name") for c in campaigns_service.load_campaigns()}


def _summary(d: Delivery, open_comments: int = 0, names: Optional[dict] = None) -> dict:
    items = d.items or []
    return {
        "id": d.id, "brandId": d.brand_id, "title": d.title, "kind": d.kind, "status": d.status,
        # Agrupación: mes (de la fecha, en el frontend) › proyecto (opcional) › etapa (opcional).
        "campaignId": d.campaign_id, "campaignName": (names if names is not None else _campaign_names()).get(d.campaign_id) if d.campaign_id else None,
        "stage": d.stage,
        "approvedItems": sum(1 for i in items if not i.get("rejected")) if d.status == "aprobada" else None,
        "visibility": d.visibility, "sentAt": _iso(d.sent_at),
        "round": d.round, "items": len(d.items or []),
        "cover": (lambda first: (first.get("poster") or (_poster(first["url"]) if first.get("kind") == "video" else first.get("url"))) if first else None)((d.items or [None])[0]),
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
        "items": _items(d), "source": d.source, "note": d.note, "template": d.template,
        "comments": [_comment(c, {e.lower() for e in await mailer.client_emails(s, d.brand_id)}) for c in rows],
        # Versiones anteriores para comparar; el cliente sólo ve las que se le mandaron.
        "history": [{**h, "items": [{**i, "poster": _poster(i["url"])} if i.get("kind") == "video" else i for i in h.get("items") or []]}
                    for h in (d.history or []) if not client or h.get("sentAt")],
    }


# ── Entregas ──────────────────────────────────────────────────────────────

@router.get("/api/brands/{brand_id}/deliveries")
async def list_deliveries(brand_id: str, request: Request, vista: Optional[str] = None, s: AsyncSession = Depends(get_session)):
    """`vista=cliente`: sólo lo mandado al cliente, contando sólo sus comentarios. Un cliente siempre la tiene."""
    _require_brand(brand_id)
    client = vista == "cliente" or is_client(request)
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
    names = _campaign_names()
    return [_summary(d, open_by.get(d.id, 0), names) for d in rows]


@router.post("/api/brands/{brand_id}/deliveries")
async def create_delivery(
    brand_id: str, request: Request,
    title: str = Form(...), kind: str = Form("carrusel"), note: Optional[str] = Form(None),
    template: Optional[str] = Form(None), labels: Optional[str] = Form(None, description="etiquetas separadas por |"),
    campaignId: Optional[str] = Form(None), stage: Optional[str] = Form(None),
    files: List[UploadFile] = File(...), source: Optional[UploadFile] = File(None),
    s: AsyncSession = Depends(get_session),
):
    """Sube una entrega: `files` son las láminas EN ORDEN; `source`, la fuente editable.
    `campaignId` y `stage` (ej. "01 Fotos") son opcionales: agrupan la entrega."""
    _require_brand(brand_id)
    if kind not in KINDS:
        raise HTTPException(status_code=400, detail=f"kind debe ser uno de {sorted(KINDS)}")
    if not files:
        raise HTTPException(status_code=400, detail="Una entrega necesita al menos una lámina")
    d = Delivery(brand_id=brand_id, title=title.strip()[:200], kind=kind, status="en_revision",
                 note=note, template=template, round=1, created_by=_who(request), items=[],
                 campaign_id=_check_campaign(campaignId, brand_id), stage=(stage or "").strip()[:60] or None)
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
async def get_delivery(delivery_id: str, request: Request, vista: Optional[str] = None, s: AsyncSession = Depends(get_session)):
    d = await _get(s, delivery_id)
    client = vista == "cliente" or is_client(request)
    if client and (d.visibility != "cliente" or not can_see_brand(request, d.brand_id)):
        raise HTTPException(status_code=404, detail="No existe esa entrega")
    return await _full(s, d, client=client)


@router.post("/api/deliveries/{delivery_id}/send")
async def send_to_client(delivery_id: str, s: AsyncSession = Depends(get_session)):
    """Mandar al cliente: desde acá la ve, en revisión, sin los comentarios internos. Le llega un mail."""
    d = await _get(s, delivery_id)
    d.visibility, d.status, d.sent_at = "cliente", "en_revision", datetime.now(timezone.utc)
    d.approved_by = d.approved_at = None
    await s.commit()
    await s.refresh(d)
    again = d.round > 1
    mailer.send(await mailer.client_emails(s, d.brand_id),
                f"{'Versión corregida' if again else 'Para revisar'}: {d.title}",
                f"Tenés {'la versión corregida de ' if again else ''}«{d.title}» para revisar.",
                [f"Es de {mailer.brand_name(d.brand_id)}. Podés aprobarla o pedirnos cambios, lámina por lámina."],
                "Revisar", mailer.app_url(f"/cliente/entregas?id={d.id}"))
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
    # La versión que se reemplaza queda en el historial (sin las marcas de «esta no»), para comparar.
    prev = {"round": d.round, "items": [{k: v for k, v in i.items() if k != "rejected"} for i in (d.items or [])],
            "note": d.note, "sentAt": _iso(d.sent_at), "at": datetime.now(timezone.utc).isoformat()}
    d.history = [*(d.history or []), prev]
    items = await _store_items(d.id, nxt, files, (labels or "").split("|"))
    if source and source.filename:
        st = await _store(d.id, nxt, source, SOURCE_EXT)
        d.source = {"url": st["url"], "name": st["name"]}
    d.items, d.round, d.status = items, nxt, "en_revision"
    if note and note.strip():
        # «Qué cambiamos»: un comentario de Coevo que el cliente ve junto a la versión nueva.
        c = DeliveryComment(delivery_id=d.id, text=f"Versión {nxt}: {note.strip()}"[:4000], author=_who(request),
                            round=nxt, internal=False)
        c.id = f"dc_{uuid.uuid4().hex[:12]}"
        s.add(c)
    d.visibility = "interna"   # el equipo la revisa antes de volver a mandarla
    d.approved_by = d.approved_at = None
    if note:
        d.note = note
    await s.commit()
    await s.refresh(d)
    return await _full(s, d)


def _check_campaign(campaign_id: Optional[str], brand_id: str) -> Optional[str]:
    if not campaign_id:
        return None
    c = campaigns_service.find_campaign(campaigns_service.load_campaigns(), campaign_id)
    if not c or c.get("brandId") != brand_id:
        raise HTTPException(status_code=400, detail="Ese proyecto no es de esta marca")
    return campaign_id


class GroupIn(BaseModel):
    campaignId: Optional[str] = None
    stage: Optional[str] = None
    title: Optional[str] = None      # si viene, renombra la entrega


@router.patch("/api/deliveries/{delivery_id}")
async def set_group(delivery_id: str, req: GroupIn, request: Request, s: AsyncSession = Depends(get_session)):
    """Proyecto, etapa y título de una entrega (equipo)."""
    if is_client(request):
        raise HTTPException(status_code=403, detail="No tenés acceso a esto.")
    d = await _get(s, delivery_id)
    d.campaign_id = _check_campaign(req.campaignId, d.brand_id)
    d.stage = (req.stage or "").strip()[:60] or None
    if req.title is not None:
        if not req.title.strip():
            raise HTTPException(status_code=400, detail="El título no puede quedar vacío")
        d.title = req.title.strip()[:200]
    await s.commit()
    await s.refresh(d)
    return await _full(s, d)


@router.post("/api/deliveries/{delivery_id}/items")
async def add_items(delivery_id: str, request: Request, files: List[UploadFile] = File(...), s: AsyncSession = Depends(get_session)):
    """Sumar láminas a la ronda actual (equipo): otra imagen al lado, o la versión corregida de una
    para que el cliente compare. Si ya estaba aprobada, vuelve a «en revisión»."""
    if is_client(request):
        raise HTTPException(status_code=403, detail="No tenés acceso a esto.")
    d = await _get(s, delivery_id)
    start = len(d.items or [])
    new = await _store_items(d.id, d.round, files, [])
    for i, it in enumerate(new):
        it["label"] = f"{start + i + 1:02d}"
    d.items = [*(d.items or []), *new]
    if d.status == "aprobada":
        d.status, d.approved_by, d.approved_at = "en_revision", None, None
    await s.commit()
    await s.refresh(d)
    return await _full(s, d)


@router.delete("/api/deliveries/{delivery_id}/items/{item_id}")
async def remove_item(delivery_id: str, item_id: str, request: Request, s: AsyncSession = Depends(get_session)):
    """Sacar una lámina de la ronda actual (equipo). El archivo queda en disco por si tenía comentarios."""
    if is_client(request):
        raise HTTPException(status_code=403, detail="No tenés acceso a esto.")
    d = await _get(s, delivery_id)
    items = [i for i in (d.items or []) if i["id"] != item_id]
    if len(items) == len(d.items or []):
        raise HTTPException(status_code=404, detail="Esa lámina no es de la ronda actual")
    if not items:
        raise HTTPException(status_code=400, detail="Tiene que quedar al menos una lámina. Para sacar todo, borrá la entrega.")
    d.items = items
    await s.commit()
    await s.refresh(d)
    return await _full(s, d)


@router.delete("/api/proyectos/{campaign_id}")
async def delete_project(campaign_id: str, request: Request, s: AsyncSession = Depends(get_session)):
    """Borrar un proyecto (equipo). Sus entregas no se borran: quedan sin proyecto."""
    if is_client(request):
        raise HTTPException(status_code=403, detail="No tenés acceso a esto.")
    items = campaigns_service.load_campaigns()
    if not campaigns_service.find_campaign(items, campaign_id):
        raise HTTPException(status_code=404, detail="No existe ese proyecto")
    rows = (await s.execute(select(Delivery).where(Delivery.campaign_id == campaign_id))).scalars().all()
    for d in rows:
        d.campaign_id = None
    await s.commit()
    campaigns_service.save_campaigns([c for c in items if c.get("id") != campaign_id])
    return {"ok": True, "deliveriesFreed": len(rows)}


@router.post("/api/deliveries/{delivery_id}/items/{item_id}/toggle")
async def toggle_item(delivery_id: str, item_id: str, request: Request, s: AsyncSession = Depends(get_session)):
    """«Esta no» / «esta sí» en una lámina, antes de aprobar (el cliente elige 6 de 9)."""
    d = await _get(s, delivery_id)
    if is_client(request) and (d.visibility != "cliente" or not can_see_brand(request, d.brand_id)):
        raise HTTPException(status_code=404, detail="No existe esa entrega")
    if d.status == "aprobada":
        raise HTTPException(status_code=400, detail="Ya está aprobada: pedí cambios para modificarla.")
    items = [dict(i) for i in d.items or []]
    hit = next((i for i in items if i["id"] == item_id), None)
    if not hit:
        raise HTTPException(status_code=404, detail="Esa lámina no es de la ronda actual")
    hit["rejected"] = not hit.get("rejected")
    if all(i.get("rejected") for i in items):
        raise HTTPException(status_code=400, detail="Tiene que quedar al menos una. Si no va ninguna, pedí cambios.")
    d.items = items   # reasignar: JSONB no detecta cambios internos
    await s.commit()
    await s.refresh(d)
    return await _full(s, d, client=is_client(request))


class StatusIn(BaseModel):
    status: str


@router.post("/api/deliveries/{delivery_id}/status")
async def set_status(delivery_id: str, req: StatusIn, request: Request, s: AsyncSession = Depends(get_session)):
    if req.status not in STATUSES:
        raise HTTPException(status_code=400, detail=f"status debe ser uno de {sorted(STATUSES)}")
    d = await _get(s, delivery_id)
    if is_client(request):
        if d.visibility != "cliente" or not can_see_brand(request, d.brand_id):
            raise HTTPException(status_code=404, detail="No existe esa entrega")
        # «Cambiar mi elección»: sólo puede volver a «en revisión» algo que él mismo aprobó.
        if req.status == "en_revision" and (d.status != "aprobada" or not can_approve(request, d.brand_id)):
            raise HTTPException(status_code=400, detail="Sólo se puede reabrir una entrega aprobada.")
        if req.status == "aprobada" and not can_approve(request, d.brand_id):
            raise HTTPException(status_code=403, detail="Podés comentar, pero aprobar lo hace otra persona de tu marca.")
    d.status = req.status
    if req.status == "aprobada":
        d.approved_by, d.approved_at = _who(request), datetime.now(timezone.utc)
    else:
        d.approved_by = d.approved_at = None
    await s.commit()
    await s.refresh(d)
    if is_client(request) and req.status in ("aprobada", "cambios"):
        mailer.client_decision(d.id, req.status, d.brand_id, d.title, _who(request), await mailer.team_emails(s))
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
    if is_client(request):
        if not can_see_brand(request, d.brand_id):
            raise HTTPException(status_code=404, detail="No existe esa entrega")
        req.asClient = True   # lo que escribe un cliente nunca es interno
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
    if is_client(request):
        mailer.client_comment(d.id, d.brand_id, d.title, c.author, c.text, await mailer.team_emails(s))
    return _comment(c)


@router.post("/api/deliveries/{delivery_id}/comments/{comment_id}/resolve")
async def resolve_comment(delivery_id: str, comment_id: str, s: AsyncSession = Depends(get_session)):
    c = await s.get(DeliveryComment, comment_id)
    if not c or c.delivery_id != delivery_id:
        raise HTTPException(status_code=404, detail="No existe ese comentario")
    c.resolved_at = None if c.resolved_at else datetime.now(timezone.utc)
    await s.commit()
    return _comment(c)


@router.delete("/api/deliveries/{delivery_id}/comments/{comment_id}")
async def delete_comment(delivery_id: str, comment_id: str, request: Request, s: AsyncSession = Depends(get_session)):
    """Borrar un comentario (y su punto). El equipo, cualquiera; un cliente, sólo los suyos."""
    c = await s.get(DeliveryComment, comment_id)
    if not c or c.delivery_id != delivery_id:
        raise HTTPException(status_code=404, detail="No existe ese comentario")
    if is_client(request) and (c.internal or (c.author or "").lower() != (_who(request) or "").lower()):
        raise HTTPException(status_code=403, detail="Sólo podés borrar tus comentarios.")
    await s.delete(c)
    await s.commit()
    return {"ok": True}
