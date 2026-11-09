"""
Traer referencias de afuera a la memoria de la marca (openspec/changes/studio-v2 M.6 · changes/modulos 1.0)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pinterest: se pega el link de un tablero público y sus imágenes quedan como moodboard con nombre (o luz,
locación o pose), en la marca o en un proyecto. Se lee el feed público del tablero (`<tablero>.rss`, sin
login ni app de Pinterest): trae los últimos 25 pines. Cada imagen se baja en tamaño original (achicada a
2048 px del lado largo) y, si Pinterest no la tiene, en 736 px.

Cada imagen guarda `board` (nombre del tablero), `source` (el link) y `pin` (la ruta de la imagen en
Pinterest). Con `pin`, volver a traer el mismo tablero suma sólo los pines nuevos: así se actualiza.
Conectar una cuenta (tableros privados, más de 25 pines) pide una app aprobada por Pinterest: va aparte.
"""
import asyncio
import html
import io
import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from urllib.parse import urlparse

import httpx
from PIL import Image
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from routers.inbox import BRAND_DEST, CAMPAIGN_TYPE, CAMPAIGN_UPLOADS
from services import brands, campaigns as campaigns_service
from services.roles import is_client

router = APIRouter(tags=["importar"])
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"}
MAX_PINS = 25
PARALLEL = 6
DESTS = ("moodboard", "luz", "locacion", "pose")
PIN_IMG = re.compile(r"https://i\.pinimg\.com/[^/\s\"]+/([0-9a-f]{2}/[0-9a-f]{2}/[0-9a-f]{2}/[0-9a-f]+\.(?:jpg|png|webp))")
SIZES = ("originals", "736x")
MAX_SIDE = 2048  # alcanza como referencia; un original de Pinterest puede pesar varios MB


class PinterestIn(BaseModel):
    url: str
    board: Optional[str] = None        # nombre del tablero en Studio; si no, el de Pinterest
    dest: str = "moodboard"            # moodboard | luz | locacion | pose
    campaignId: Optional[str] = None   # si viene, va al proyecto en vez de a la marca


def board_feed_url(url: str) -> str:
    """Link de un tablero (pinterest.com/usuario/tablero, ar.pinterest…) → URL de su feed. Sin red."""
    url = url.strip()
    if not url.startswith("http"):
        url = "https://" + url
    parsed = urlparse(url)
    parts = [p for p in parsed.path.split("/") if p]
    if "pinterest." not in parsed.netloc or len(parts) < 2 or parts[0] in ("pin", "search", "ideas"):
        raise HTTPException(status_code=400, detail="Pegá el link de un TABLERO de Pinterest (pinterest.com/usuario/tablero), no de un pin suelto.")
    return f"https://www.pinterest.com/{parts[0]}/{parts[1]}.rss"


def parse_feed(xml: str) -> Tuple[str, List[str]]:
    """Feed del tablero → (título, rutas de las imágenes sin tamaño, en orden y sin repetir)."""
    text = html.unescape(xml)
    m = re.search(r"<channel>\s*<title>(.*?)</title>", text, re.S)
    title = (m.group(1) if m else "").strip()
    pins: List[str] = []
    for found in PIN_IMG.finditer(text):
        if found.group(1) not in pins:
            pins.append(found.group(1))
    return title, pins[:MAX_PINS]


async def _resolve(client: httpx.AsyncClient, url: str) -> str:
    """Los links cortos (pin.it/…) redirigen al tablero."""
    if "pin.it/" in url:
        return str((await client.get(url if url.startswith("http") else "https://" + url)).url)
    return url


async def _download(client: httpx.AsyncClient, pin: str, gate: asyncio.Semaphore) -> Optional[Tuple[str, bytes]]:
    """Una imagen del pin, en el tamaño más grande que haya. None si no se pudo."""
    async with gate:
        for size in SIZES:
            try:
                r = await client.get(f"https://i.pinimg.com/{size}/{pin}")
            except httpx.HTTPError:
                continue
            if r.status_code == 200 and r.headers.get("content-type", "").startswith("image/"):
                return pin, _fit(r.content)
    return None


def _fit(data: bytes) -> bytes:
    """Achica a MAX_SIDE del lado largo si hace falta, en el mismo formato. Si no se puede abrir, la deja igual."""
    try:
        im = Image.open(io.BytesIO(data))
        if max(im.size) <= MAX_SIDE:
            return data
        fmt = im.format or "JPEG"
        im.thumbnail((MAX_SIDE, MAX_SIDE))
        if fmt == "JPEG" and im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        out = io.BytesIO()
        im.save(out, fmt, quality=90) if fmt in ("JPEG", "WEBP") else im.save(out, fmt)
        return out.getvalue()
    except Exception:
        return data


def _known_pins(items: Optional[list]) -> set:
    return {it["pin"] for it in (items or []) if it.get("pin")}


@router.post("/api/brands/{brand_id}/import/pinterest")
async def import_pinterest(brand_id: str, req: PinterestIn, request: Request):
    if is_client(request):
        raise HTTPException(status_code=403, detail="No tenés acceso a esto.")
    if req.dest not in DESTS:
        raise HTTPException(status_code=400, detail="Destino: moodboard, luz, locacion o pose")
    b = brands.find_brand(brands.load_brands(), brand_id)
    if not b:
        raise HTTPException(status_code=404, detail="No existe esa marca")
    if b.get("isSandbox"):
        raise HTTPException(status_code=400, detail="La marca de prueba no guarda imágenes: elegí una marca.")
    if req.campaignId:
        camp = campaigns_service.find_campaign(campaigns_service.load_campaigns(), req.campaignId)
        if not camp or camp.get("brandId") != brand_id:
            raise HTTPException(status_code=404, detail="Ese proyecto no es de esta marca")
        known = _known_pins(camp.get("inputs"))
    else:
        known = _known_pins(b.get(BRAND_DEST[req.dest][0]))

    async with httpx.AsyncClient(timeout=30, follow_redirects=True, headers=UA) as client:
        feed = board_feed_url(await _resolve(client, req.url.strip()))
        r = await client.get(feed)
        if r.status_code != 200:
            raise HTTPException(status_code=400, detail="Pinterest no deja leer ese tablero. Abrí el link en una ventana privada: si no ves las imágenes, sigue en secreto. También podés subirlas acá arriba.")
        title, pins = parse_feed(r.text)
        if not pins:
            raise HTTPException(status_code=400, detail="Ese tablero no tiene imágenes públicas.")
        fresh = [p for p in pins if p not in known]
        gate = asyncio.Semaphore(PARALLEL)
        got = [x for x in await asyncio.gather(*(_download(client, p, gate) for p in fresh)) if x]
    if fresh and not got:
        raise HTTPException(status_code=502, detail="Pinterest no devolvió ninguna imagen. Probá de nuevo en un rato.")

    board = (req.board or title or "Pinterest").strip()[:80]
    source = req.url.strip()
    # Se vuelve a leer recién ahora: la descarga tarda y otro cambio pudo guardarse mientras tanto.
    if req.campaignId:
        _save_to_campaign(req, brand_id, got, board, source)
    else:
        _save_to_brand(req, brand_id, got, board, source)
    return {"board": board, "added": len(got), "skipped": len(pins) - len(fresh),
            "failed": len(fresh) - len(got), "target": req.campaignId or "marca"}


def _ext(pin: str) -> str:
    return "." + pin.rsplit(".", 1)[1]


def _save_to_campaign(req: PinterestIn, brand_id: str, got: list, board: str, source: str) -> None:
    items = campaigns_service.load_campaigns()
    camp = campaigns_service.find_campaign(items, req.campaignId)
    if not camp or camp.get("brandId") != brand_id:
        raise HTTPException(status_code=404, detail="Ese proyecto no es de esta marca")
    CAMPAIGN_UPLOADS.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).isoformat()
    new = []
    for pin, data in got:
        fname = f"pin_{camp['id']}_{uuid.uuid4().hex[:8]}{_ext(pin)}"
        (CAMPAIGN_UPLOADS / fname).write_bytes(data)
        new.append({"id": f"cin_{uuid.uuid4().hex[:8]}", "url": f"/static/campaign-uploads/{fname}",
                    "type": CAMPAIGN_TYPE[req.dest], "name": board, "filename": fname, "uploadedAt": now,
                    "board": board, "source": source, "pin": pin})
    campaigns_service.apply_update(camp, {"inputs": (camp.get("inputs") or []) + new})
    campaigns_service.save_campaigns(items)


def _save_to_brand(req: PinterestIn, brand_id: str, got: list, board: str, source: str) -> None:
    all_b = brands.load_brands()
    b = brands.find_brand(all_b, brand_id)
    if not b:
        raise HTTPException(status_code=404, detail="No existe esa marca")
    key, folder_fn, prefix = BRAND_DEST[req.dest]
    for pin, data in got:
        nid = uuid.uuid4().hex[:8]
        fname = f"{brand_id}_pin_{nid}{_ext(pin)}"
        (folder_fn() / fname).write_bytes(data)
        b.setdefault(key, []).append({"id": nid, "name": board, "description": f"Pinterest · {board}", "filename": fname,
                                      "imageUrl": f"{prefix}/{fname}", "board": board, "source": source, "pin": pin})
    brands.save_brands(all_b)
