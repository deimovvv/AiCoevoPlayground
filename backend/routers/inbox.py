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
from services import brands, campaigns as campaigns_service, inbox_agent, mailer
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
    # Páginas de un PDF de marca: las del manual (logo, colores, reglas) y las referencias de carruseles / piezas.
    "manual": ("manualPages", brands.get_manual_dir, "/static/manualpages"),
    "carrusel": ("carouselRefs", brands.get_carousel_dir, "/static/carouselrefs"),
}
# Lo mismo, en una CAMPAÑA (tipos de campaign.inputs).
CAMPAIGN_TYPE = {"moodboard": "moodboard", "luz": "lookfeel", "locacion": "background", "pose": "pose",
                 "plano": "plano", "cara": "avatar", "prenda": "clothing", "producto": "product",
                 "manual": "reference", "carrusel": "reference"}
LABEL = {"moodboard": "moodboard", "luz": "luz", "locacion": "locación", "pose": "poses", "plano": "planos",
         "cara": "caras", "prenda": "prendas", "producto": "productos",
         "manual": "páginas del manual", "carrusel": "referencias de carrusel"}


def _who(request: Request) -> str:
    return (request.scope.get("state") or {}).get("access_email") or "local"


def _kind(ext: str) -> str:
    return "image" if ext in IMAGE_EXT else "video" if ext in VIDEO_EXT else "pdf" if ext == ".pdf" else "other"


def _out(i: InboxItem) -> dict:
    return {
        "id": i.id, "brandId": i.brand_id, "campaignId": i.campaign_id, "files": i.files or [], "link": i.link,
        "note": i.note, "author": i.author, "status": i.status, "result": i.result, "proposal": i.proposal,
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
            if ext == ".pdf":
                # Un PDF de marca trae todo junto: se parte en páginas para que cada una vaya a su lugar.
                import asyncio
                from services import pdf_pages
                try:
                    pages, text = await asyncio.to_thread(pdf_pages.split, folder / name, folder, Path(name).stem)
                except Exception:
                    pages, text = [], ""
                for pg in pages:
                    saved.append({"url": f"/static/inbox/{item.id}/{pg['filename']}", "kind": "image",
                                  "name": f"{f.filename} · pág. {pg['page']}", "fromPdf": f.filename, "page": pg["page"]})
                if text:
                    (folder / f"{Path(name).stem}.txt").write_text(text, encoding="utf-8")
        item.files = saved
        s.add(item)
        await s.commit()
    except Exception:
        shutil.rmtree(folder, ignore_errors=True)
        raise
    if any(f["kind"] == "image" for f in saved):
        inbox_agent.propose_later(item.id)   # propone destino y tipos mientras el equipo no lo mira
    if is_client(request):
        marca = mailer.brand_name(brand_id)
        what = [f"{len(saved)} {'archivo' if len(saved) == 1 else 'archivos'}"] if saved else []
        what += ["un link"] if item.link else []
        mailer.send(await mailer.team_emails(s), f"{marca} mandó material", f"{marca} mandó material.",
                    [f"{(' y '.join(what) or 'una nota').capitalize()}, de {item.author}."], "Ordenarlo",
                    mailer.app_url(f"/dashboard/bandeja?marca={brand_id}"), quotes=[item.note] if item.note else [])
    return _out(item)


@router.get("/api/brands/{brand_id}/inbox")
async def list_material(brand_id: str, request: Request, s: AsyncSession = Depends(get_session)):
    if not can_see_brand(request, brand_id):
        raise HTTPException(status_code=404, detail="No existe esa marca")
    rows = (await s.execute(select(InboxItem).where(InboxItem.brand_id == brand_id).order_by(InboxItem.created_at.desc()))).scalars().all()
    return [_out(i) for i in rows]


class IncorporateIn(BaseModel):
    # "marca" o el id de un proyecto
    target: str = "marca"
    # adónde va cada imagen: un tipo para todas, o uno por url
    type: str = "moodboard"
    perFile: dict = {}
    discard: List[str] = []   # urls que no se incorporan


@router.post("/api/inbox/{item_id}/incorporar")
async def incorporate(item_id: str, req: IncorporateIn, request: Request, s: AsyncSession = Depends(get_session)):
    """El equipo suma las imágenes a la marca o a un proyecto. El resto (PDF, video, link) queda acá."""
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
            raise HTTPException(status_code=404, detail="Ese proyecto no es de esta marca")
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
        where = f"el proyecto «{c.get('name')}»"
    item.status = "incorporado"
    item.result = f"{sum(counts.values())} sumadas a {where} ({', '.join(f'{n} {LABEL.get(t, t)}' for t, n in counts.items())})"
    await s.commit()
    if mailer.is_person(item.author):
        mailer.send([item.author], "Sumamos tu material", "Sumamos lo que nos mandaste.",
                    [f"{item.result[0].upper()}{item.result[1:]}.", "Ya lo usamos para lo que viene."],
                    "Ver tu marca", mailer.app_url("/cliente/marca"), skip=_who(request))
    return _out(item)


@router.post("/api/inbox/{item_id}/proponer")
async def propose(item_id: str, request: Request, s: AsyncSession = Depends(get_session)):
    """Que el agente (re)proponga destino y tipos ahora (si no llegó a hacerlo o falló)."""
    if is_client(request):
        raise HTTPException(status_code=403, detail="No tenés acceso a esto.")
    if not await s.get(InboxItem, item_id):
        raise HTTPException(status_code=404, detail="No existe")
    await inbox_agent.propose(item_id)
    s.expire_all()
    return _out(await s.get(InboxItem, item_id))


@router.post("/api/inbox/{item_id}/identidad")
async def apply_identity(item_id: str, request: Request, s: AsyncSession = Depends(get_session)):
    """Pasa a Marca la identidad que el agente leyó del PDF: sólo llena lo que está vacío y lo marca como
    «propuesto» (se aprueba en Marca, como lo de «Armar con el agente»). Nunca pisa lo que ya está cargado."""
    import re as _re
    import time
    if is_client(request):
        raise HTTPException(status_code=403, detail="No tenés acceso a esto.")
    item = await s.get(InboxItem, item_id)
    ident = ((item.proposal or {}).get("identity") if item else None) or {}
    if not ident:
        raise HTTPException(status_code=400, detail="No hay identidad leída en este envío.")
    all_b = brands.load_brands()
    br = brands.find_brand(all_b, item.brand_id)
    empty = lambda v: v is None or v == "" or v == [] or v == {}
    dna, ds, touched = dict(br.get("dna") or {}), dict(br.get("designSystem") or {}), set()
    if empty(br.get("brandContext")) and ident.get("contexto"):
        br["brandContext"] = ident["contexto"]; touched.add("quien")
    for src, dst in (("tono", "tone"), ("nunca", "forbidden_words")):
        if empty(dna.get(dst)) and ident.get(src):
            dna[dst] = ident[src]; touched.add("quien")
    if empty(dna.get("colors")) and ident.get("colores"):
        dna["colors"] = [c for c in ident["colores"] if _re.match(r"^#[0-9a-fA-F]{6}$", c.get("hex", ""))]; touched.add("identidad")
    fonts = {k: v for k, v in (ident.get("tipografias") or {}).items() if v}
    if fonts and not any((br.get("fonts") or {}).get(k) for k in ("headline", "body")):
        br["fonts"] = {**(br.get("fonts") or {}), **fonts}; touched.add("identidad")
    for src, dst in (("estilo", "photoStyle"), ("siempre", "visualDos"), ("nunca_visual", "visualDonts")):
        if empty(ds.get(dst)) and ident.get(src):
            ds[dst] = ident[src]; touched.add("foto")
    br["dna"], br["designSystem"] = dna, ds
    agent = dict(br.get("agent") or {})
    blocks = {**(agent.get("blocks") or {}), **{k: "propuesto" for k in touched}}
    br["agent"] = {**agent, "blocks": blocks, "lastRun": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    brands.save_brands(all_b)
    item.proposal = {**(item.proposal or {}), "identityApplied": sorted(touched)}
    await s.commit()
    return {"touched": sorted(touched)}


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
