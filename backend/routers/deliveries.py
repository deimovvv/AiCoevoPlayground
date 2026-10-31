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
import tempfile
import unicodedata
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
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
AUDIO_EXT = {".webm", ".m4a", ".mp3", ".wav", ".ogg", ".mp4"}
# Después de aprobada (changes/brand-integrations §3). en_postiz y publicada las pone la integración con Postiz.
PUBLISH_STATES = {"pausada", "descartada", "en_postiz", "publicada"}
CHANNELS = ["instagram", "tiktok", "linkedin", "youtube", "facebook", "x", "threads"]
COMMENT_KINDS = {"texto", "color", "encuadre", "tono", "dato", "imagen", "otro"}
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
        if s["ext"] in VIDEO_EXT:
            import asyncio
            await asyncio.to_thread(_make_preview, FILES_DIR / s["url"].split("/static/deliveries/", 1)[1])
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


# Lo que Chrome reproduce sin problema. ProRes (con o sin transparencia), DNxHD y compañía no: para esos se
# arma una copia para ver (MP4 H.264) y el original queda para bajar.
PLAYABLE = {"h264", "vp8", "vp9", "av1"}


def _make_preview(path: Path) -> None:
    """Si el video no se puede ver en el navegador (ej. ProRes 4444 de After Effects), arma `<nombre>.preview.mp4`
    sobre un fondo de cuadritos (así se ve qué es transparente) y rehace la portada desde ahí."""
    import json as _json
    import subprocess
    try:
        info = _json.loads(subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,pix_fmt,width,height",
             "-of", "json", str(path)], capture_output=True, text=True, timeout=30).stdout or "{}")
        st = (info.get("streams") or [{}])[0]
    except Exception:
        return
    codec, fmt = st.get("codec_name", ""), st.get("pix_fmt", "")
    alpha = fmt.startswith(("yuva", "rgba", "argb", "bgra", "abgr", "gbrap", "ya"))
    if codec in PLAYABLE and not alpha:
        return
    w, h = int(st.get("width") or 720), int(st.get("height") or 1280)
    out = path.with_name(path.stem + ".preview.mp4")
    bg = f"color=c=gray:s={w}x{h},format=yuv420p,geq=lum='if(mod(floor(X/24)+floor(Y/24),2),205,236)':cb=128:cr=128"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(path), "-f", "lavfi", "-i", bg,
                    "-filter_complex", "[1:v][0:v]overlay=shortest=1,format=yuv420p[v]", "-map", "[v]", "-map", "0:a?",
                    "-c:v", "libx264", "-crf", "20", "-preset", "veryfast", "-c:a", "aac", "-movflags", "+faststart", str(out)],
                   timeout=600, check=False)
    if out.exists():
        poster = path.with_name(path.stem + ".poster.jpg")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "0.5", "-i", str(out), "-frames:v", "1",
                        "-vf", "scale=720:-2", "-q:v", "4", str(poster)], timeout=30, check=False)


def _preview(url: str) -> Optional[str]:
    rel = url.split("/static/deliveries/", 1)[-1]
    src = FILES_DIR / rel
    out = src.with_name(src.stem + ".preview.mp4")
    return f"/static/deliveries/{out.relative_to(FILES_DIR).as_posix()}" if out.exists() else None


def _items(d: Delivery) -> list:
    return [{**it, "poster": _poster(it["url"]), "preview": _preview(it["url"])} if it.get("kind") == "video" else it
            for it in (d.items or [])]


def _phase(d: Delivery) -> str:
    """Dónde está la pieza en el circuito: en_desarrollo → por_revisar → lista → en_postiz → publicada
    (+ pausada, descartada). Sale de visibilidad, estado y estado de publicación."""
    if d.publish_state in PUBLISH_STATES:
        return d.publish_state
    if d.status == "aprobada":
        return "lista"
    return "por_revisar" if d.visibility == "cliente" else "en_desarrollo"


def _comment(c: DeliveryComment, clients: Optional[set] = None) -> dict:
    """`byClient`: lo escribió alguien del cliente (no Coevo). Sin la lista de clientes, se deduce de `internal`."""
    by_client = (c.author or "").lower() in clients if clients is not None else not c.internal
    return {
        "id": c.id, "itemId": c.item_id, "x": c.x, "y": c.y, "text": c.text, "author": c.author, "internal": c.internal,
        "byClient": by_client and not c.internal,
        "round": c.round, "resolvedAt": _iso(c.resolved_at), "createdAt": _iso(c.created_at),
        "refs": c.refs or [], "kind": c.kind, "audioUrl": c.audio_url,
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
        "angle": d.angle, "phase": _phase(d), "publishState": d.publish_state,
        "scheduledAt": _iso(d.scheduled_at), "publishedAt": _iso(d.published_at), "channels": d.channels or [],
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
        "history": [{**h, "items": [{**i, "poster": _poster(i["url"]), "preview": _preview(i["url"])} if i.get("kind") == "video" else i for i in h.get("items") or []]}
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


def _slug(text: str) -> str:
    """Nombre de archivo legible y seguro en cualquier sistema: sin tildes, sin barras, con guiones."""
    t = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^A-Za-z0-9]+", "-", t).strip("-")[:60] or "sin-nombre"


@router.get("/api/brands/{brand_id}/deliveries/aprobadas")
async def download_approved(brand_id: str, request: Request, entrega: Optional[str] = None, proyecto: Optional[str] = None,
                            s: AsyncSession = Depends(get_session)):
    """Lo aprobado, en un zip (studio-v2 4.4): los originales (el video con su transparencia), sin las láminas que el
    cliente dijo «esta no», ordenado en Proyecto/Etapa/ y con nombres `Marca_Entrega_vN_01.ext`.
    `entrega`: una sola · `proyecto`: un proyecto (`sin` = las que no tienen) · nada: todo lo aprobado de la marca."""
    brand = _require_brand(brand_id)
    if not can_see_brand(request, brand_id):
        raise HTTPException(status_code=404, detail="No existe esa marca")
    q = select(Delivery).where(Delivery.brand_id == brand_id, Delivery.status == "aprobada")
    if is_client(request):
        q = q.where(Delivery.visibility == "cliente")
    if entrega:
        q = q.where(Delivery.id == entrega)
    elif proyecto == "sin":
        q = q.where(Delivery.campaign_id.is_(None))
    elif proyecto:
        q = q.where(Delivery.campaign_id == proyecto)
    rows = (await s.execute(q.order_by(Delivery.created_at))).scalars().all()
    names = _campaign_names()
    marca = _slug(brand.get("name") or brand_id)
    tmp = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
    count = 0
    # Sin comprimir: imágenes y video ya vienen comprimidos; así arma rápido aunque haya video pesado.
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_STORED) as z:
        for d in rows:
            folder = "/".join(_slug(x) for x in (names.get(d.campaign_id) or "Sin proyecto", d.stage) if x)
            n = 0
            for it in d.items or []:
                if it.get("rejected"):
                    continue
                src = FILES_DIR / it["url"].split("/static/deliveries/", 1)[-1]
                if not src.is_file():
                    continue
                n += 1
                z.write(src, f"{folder}/{marca}_{_slug(d.title)}_v{d.round}_{n:02d}{src.suffix.lower()}")
                count += 1
    tmp.close()
    if not count:
        Path(tmp.name).unlink(missing_ok=True)
        raise HTTPException(status_code=404, detail="No hay piezas aprobadas para bajar")
    label = _slug(rows[0].title) if entrega and rows else (_slug(names.get(proyecto) or "") if proyecto and proyecto != "sin" else "aprobadas")
    return FileResponse(tmp.name, media_type="application/zip", filename=f"{marca}_{label}.zip",
                        background=BackgroundTask(lambda: Path(tmp.name).unlink(missing_ok=True)))


@router.post("/api/brands/{brand_id}/deliveries")
async def create_delivery(
    brand_id: str, request: Request,
    title: str = Form(...), kind: str = Form("carrusel"), note: Optional[str] = Form(None),
    template: Optional[str] = Form(None), labels: Optional[str] = Form(None, description="etiquetas separadas por |"),
    campaignId: Optional[str] = Form(None), stage: Optional[str] = Form(None),
    angle: Optional[str] = Form(None, description="ángulo de la estrategia de la marca"),
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
                 campaign_id=_check_campaign(campaignId, brand_id), stage=(stage or "").strip()[:60] or None,
                 angle=(angle or "").strip()[:120] or None)
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
    replace: Optional[str] = Form(None),
    files: List[UploadFile] = File(...), source: Optional[UploadFile] = File(None),
    s: AsyncSession = Depends(get_session),
):
    """Nueva versión de las láminas (después de aplicar comentarios). Vuelve a 'en revisión'.
    Las láminas viejas quedan en disco: los comentarios de la ronda anterior siguen apuntando ahí.
    Con `replace` (ids separados por «|», uno por archivo) sólo cambian esas láminas, en su lugar;
    las demás pasan iguales a la versión nueva (Keila, 2026-10-28: corregir una de un editorial de varias)."""
    d = await _get(s, delivery_id)
    ids = [x for x in (replace or "").split("|") if x]
    if ids:
        current_ids = {i["id"] for i in (d.items or [])}
        if len(ids) != len(files) or not set(ids) <= current_ids:
            raise HTTPException(status_code=400, detail="Una lámina nueva por cada lámina a reemplazar")
    nxt = d.round + 1
    # La versión que se reemplaza queda en el historial (sin las marcas de «esta no»), para comparar.
    prev = {"round": d.round, "items": [{k: v for k, v in i.items() if k != "rejected"} for i in (d.items or [])],
            "note": d.note, "sentAt": _iso(d.sent_at), "at": datetime.now(timezone.utc).isoformat()}
    d.history = [*(d.history or []), prev]
    if ids:
        old = {i["id"]: i for i in (d.items or [])}
        new = await _store_items(d.id, nxt, files, [old[x].get("label", "") for x in ids])
        by_old = {x: {**n, "prev": x, "changed": nxt} for x, n in zip(ids, new)}
        items = [by_old.get(i["id"]) or {k: v for k, v in i.items() if k not in ("changed", "prev")} for i in (d.items or [])]
    else:
        items = await _store_items(d.id, nxt, files, (labels or "").split("|"))
    if source and source.filename:
        st = await _store(d.id, nxt, source, SOURCE_EXT)
        d.source = {"url": st["url"], "name": st["name"]}
    d.items, d.round, d.status = items, nxt, "en_revision"
    if note and note.strip():
        # «Qué cambiamos»: un comentario de Coevo que el cliente ve junto a la versión nueva.
        which = ""
        if ids:
            pos = [str(k + 1).zfill(2) for k, i in enumerate(items) if i.get("changed") == nxt]
            which = f", lámina {', '.join(pos)}" if len(pos) < len(items) else ""
        c = DeliveryComment(delivery_id=d.id, text=f"Versión {nxt}{which}: {note.strip()}"[:4000], author=_who(request),
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


class PlanIn(BaseModel):
    angle: Optional[str] = None          # "" lo saca
    publishState: Optional[str] = None   # pausada · descartada · "" (vuelve a su fase)
    scheduledAt: Optional[datetime] = None
    channels: Optional[List[str]] = None  # redes donde sale; [] las saca


@router.post("/api/deliveries/{delivery_id}/plan")
async def set_plan(delivery_id: str, req: PlanIn, request: Request, s: AsyncSession = Depends(get_session)):
    """Ángulo, pausa/descarte y fecha prevista de una entrega (equipo). Sólo cambia lo que viene.
    Fijar una fecha NO programa nada en Postiz: eso pasa recién al confirmar la semana (brand-integrations 3.5)."""
    if is_client(request):
        raise HTTPException(status_code=403, detail="No tenés acceso a esto.")
    d = await _get(s, delivery_id)
    sent = req.model_fields_set
    if "angle" in sent:
        d.angle = (req.angle or "").strip()[:120] or None
    if "publishState" in sent:
        st = (req.publishState or "").strip() or None
        if st not in (None, "pausada", "descartada"):
            raise HTTPException(status_code=400, detail="A mano sólo se puede pausar o descartar")
        if d.publish_state in ("en_postiz", "publicada"):
            raise HTTPException(status_code=400, detail="Ya está en Postiz: cambiarla allá")
        d.publish_state = st
    if "scheduledAt" in sent:
        d.scheduled_at = req.scheduledAt
    if "channels" in sent:
        bad = [c for c in (req.channels or []) if c not in CHANNELS]
        if bad:
            raise HTTPException(status_code=400, detail=f"Red desconocida: {', '.join(bad)}")
        d.channels = [c for c in CHANNELS if c in (req.channels or [])] or None
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
    kind: Optional[str] = None


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
                        text=text[:4000], author=_who(request), round=d.round, internal=not req.asClient,
                        kind=req.kind if req.kind in COMMENT_KINDS else None)
    c.id = f"dc_{uuid.uuid4().hex[:12]}"
    s.add(c)
    if d.status == "aprobada":
        d.status, d.approved_by, d.approved_at = "cambios", None, None
    await s.commit()
    if is_client(request):
        mailer.client_comment(d.id, d.brand_id, d.title, c.author, c.text, await mailer.team_emails(s))
    return _comment(c)


VOICE_PROMPT = (
    "Es una nota de voz de alguien revisando una pieza de contenido (carrusel, video o imagen) de una marca. "
    "Transcribila literal, en el idioma en que habla, sin resumir ni corregir. Después clasificá qué tipo de "
    "corrección pide: texto (el copy), color, encuadre, tono, dato (un dato o cifra), imagen (cambiar la foto o el "
    "dibujo) u otro. Respondé SÓLO un JSON: {\"texto\": \"...\", \"tipo\": \"...\"}"
)


@router.post("/api/deliveries/{delivery_id}/comments/audio")
async def add_voice_comment(
    delivery_id: str, request: Request,
    audio: UploadFile = File(...), itemId: Optional[str] = Form(None),
    x: Optional[float] = Form(None), y: Optional[float] = Form(None), asClient: bool = Form(False),
    s: AsyncSession = Depends(get_session),
):
    """Nota de voz sobre la entrega o una lámina (brand-integrations 4.1): se guarda el audio, Gemini lo
    transcribe y clasifica, y queda como comentario. Si la transcripción falla, el comentario queda igual
    con el audio, para escucharlo."""
    import json as _json
    from services import llm_router
    d = await _get(s, delivery_id)
    if is_client(request):
        if not can_see_brand(request, d.brand_id):
            raise HTTPException(status_code=404, detail="No existe esa entrega")
        asClient = True
    if asClient and d.visibility != "cliente":
        raise HTTPException(status_code=404, detail="No existe esa entrega")
    if itemId and itemId not in {i["id"] for i in d.items or []}:
        raise HTTPException(status_code=400, detail="Esa lámina no es de la ronda actual")
    st = await _store(d.id, d.round, audio, AUDIO_EXT)
    path = FILES_DIR / st["url"].split("/static/deliveries/", 1)[1]
    mime = audio.content_type if (audio.content_type or "").startswith("audio/") else \
        {".m4a": "audio/mp4", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg"}.get(st["ext"], "audio/webm")
    text, kind = "(nota de voz sin transcribir)", None
    try:
        raw = await llm_router.call_audio(VOICE_PROMPT, path.read_bytes(), mime=mime)
        m = re.search(r"\{.*\}", raw or "", re.S)
        out = _json.loads(m.group(0)) if m else {"texto": raw}
        text = (out.get("texto") or "").strip() or text
        kind = out.get("tipo") if out.get("tipo") in COMMENT_KINDS else None
    except Exception as e:
        print(f"[deliveries] nota de voz sin transcribir ({d.id}): {type(e).__name__}: {str(e)[:200]}")
    clamp = lambda v: None if v is None else min(1.0, max(0.0, float(v)))
    c = DeliveryComment(delivery_id=d.id, item_id=itemId, x=clamp(x), y=clamp(y), text=text[:4000],
                        author=_who(request), round=d.round, internal=not asClient, kind=kind, audio_url=st["url"])
    c.id = f"dc_{uuid.uuid4().hex[:12]}"
    s.add(c)
    if d.status == "aprobada":
        d.status, d.approved_by, d.approved_at = "cambios", None, None
    await s.commit()
    if is_client(request):
        mailer.client_comment(d.id, d.brand_id, d.title, c.author, c.text, await mailer.team_emails(s))
    return _comment(c)


MAX_REFS = 4


@router.post("/api/deliveries/{delivery_id}/comments/{comment_id}/refs")
async def add_comment_refs(delivery_id: str, comment_id: str, request: Request,
                           files: List[UploadFile] = File(...), s: AsyncSession = Depends(get_session)):
    """Adjuntar imágenes de referencia a un comentario (studio-v2 4.6). Las sube quien lo escribió
    (o el equipo); quedan junto a la ronda y las skills las leen con `ver_entrega`."""
    d = await _get(s, delivery_id)
    c = await s.get(DeliveryComment, comment_id)
    if not c or c.delivery_id != d.id:
        raise HTTPException(status_code=404, detail="No existe ese comentario")
    if is_client(request) and (not can_see_brand(request, d.brand_id) or (c.author or "").lower() != _who(request).lower()):
        raise HTTPException(status_code=403, detail="Sólo quien escribió el comentario puede sumarle referencias")
    refs = list(c.refs or [])
    if len(refs) + len(files) > MAX_REFS:
        raise HTTPException(status_code=400, detail=f"Hasta {MAX_REFS} referencias por comentario")
    for f in files:
        st = await _store(d.id, c.round, f, IMAGE_EXT)
        refs.append({"url": st["url"], "name": st["name"]})
    c.refs = refs
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


class CommentVisibilityIn(BaseModel):
    internal: Optional[bool] = None
    kind: Optional[str] = None      # tipo de corrección; "" lo saca


@router.patch("/api/deliveries/{delivery_id}/comments/{comment_id}")
async def set_comment_visibility(delivery_id: str, comment_id: str, req: CommentVisibilityIn, request: Request,
                                 s: AsyncSession = Depends(get_session)):
    """Equipo: pasar un comentario a «lo ve el cliente» o a «sólo el equipo», y/o fijar su tipo de corrección."""
    if is_client(request):
        raise HTTPException(status_code=403, detail="No tenés acceso a esto.")
    c = await s.get(DeliveryComment, comment_id)
    if not c or c.delivery_id != delivery_id:
        raise HTTPException(status_code=404, detail="No existe ese comentario")
    if req.internal is not None:
        c.internal = req.internal
    if req.kind is not None:
        if req.kind and req.kind not in COMMENT_KINDS:
            raise HTTPException(status_code=400, detail=f"tipo debe ser uno de {sorted(COMMENT_KINDS)}")
        c.kind = req.kind or None
    await s.commit()
    return _comment(c)
