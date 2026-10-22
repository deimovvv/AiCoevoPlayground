"""
Traer referencias de afuera a la memoria de la marca (openspec/changes/studio-v2 M.6)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pinterest: se pega el link de un tablero y se arma un moodboard con nombre (o luz, o locación), en
la marca o en un proyecto. Se lee el feed público del tablero (`<tablero>.rss`, sin login): trae los
últimos 25 pines, en 736 px. Cada imagen queda con `board` (el nombre del tablero) y `source` (el link),
así en Marca se agrupan por tablero y se sabe de dónde vino cada una.
Drive (catálogo desde una carpeta compartida) va después: necesita la API de Drive en el proyecto de Coevo.
"""
import html
import re
import uuid
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from routers.inbox import BRAND_DEST, CAMPAIGN_TYPE, CAMPAIGN_UPLOADS
from services import brands, campaigns as campaigns_service
from services.roles import is_client

router = APIRouter(tags=["importar"])
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"}
MAX_PINS = 25


class PinterestIn(BaseModel):
    url: str
    board: Optional[str] = None        # nombre del tablero en Studio; si no, el de Pinterest
    dest: str = "moodboard"            # moodboard | luz | locacion
    campaignId: Optional[str] = None   # si viene, va al proyecto en vez de a la marca


async def _board_feed(url: str) -> str:
    """Link de tablero (pinterest.com/usuario/tablero, ar.pinterest…, pin.it/…) → URL de su feed."""
    url = url.strip()
    if not url.startswith("http"):
        url = "https://" + url
    async with httpx.AsyncClient(timeout=20, follow_redirects=True, headers=UA) as c:
        if "pin.it/" in url:
            url = str((await c.get(url)).url)
    parts = [p for p in urlparse(url).path.split("/") if p]
    if "pinterest." not in urlparse(url).netloc or len(parts) < 2 or parts[0] in ("pin", "search", "ideas"):
        raise HTTPException(status_code=400, detail="Pegá el link de un TABLERO de Pinterest (pinterest.com/usuario/tablero), no de un pin suelto.")
    return f"https://www.pinterest.com/{parts[0]}/{parts[1]}.rss"


@router.post("/api/brands/{brand_id}/import/pinterest")
async def import_pinterest(brand_id: str, req: PinterestIn, request: Request):
    if is_client(request):
        raise HTTPException(status_code=403, detail="No tenés acceso a esto.")
    if req.dest not in ("moodboard", "luz", "locacion"):
        raise HTTPException(status_code=400, detail="Destino: moodboard, luz o locacion")
    all_b = brands.load_brands()
    b = brands.find_brand(all_b, brand_id)
    if not b:
        raise HTTPException(status_code=404, detail="No existe esa marca")
    if b.get("isSandbox"):
        raise HTTPException(status_code=400, detail="La marca de prueba no guarda imágenes: elegí una marca.")

    feed = await _board_feed(req.url)
    async with httpx.AsyncClient(timeout=30, follow_redirects=True, headers=UA) as c:
        r = await c.get(feed)
        if r.status_code != 200:
            raise HTTPException(status_code=400, detail="No pude leer ese tablero: ¿es público?")
        xml = r.text
        title = html.unescape((re.search(r"<channel>\s*<title>(.*?)</title>", xml, re.S) or [None, ""])[1]).strip()
        urls = []
        for m in re.finditer(r"https://i\.pinimg\.com/\d+x/[0-9a-f/]+\.(?:jpg|png|webp)", html.unescape(xml)):
            u = re.sub(r"/\d+x/", "/736x/", m.group(0))
            if u not in urls:
                urls.append(u)
        urls = urls[:MAX_PINS]
        if not urls:
            raise HTTPException(status_code=400, detail="Ese tablero no tiene imágenes públicas.")
        imgs = []
        for u in urls:
            x = await c.get(u)
            if x.status_code == 200 and x.headers.get("content-type", "").startswith("image/"):
                imgs.append((x.content, "." + u.rsplit(".", 1)[1]))

    board = (req.board or title or "Pinterest").strip()[:80]
    source = req.url.strip()
    now = datetime.now(timezone.utc).isoformat()
    if req.campaignId:
        items = campaigns_service.load_campaigns()
        camp = campaigns_service.find_campaign(items, req.campaignId)
        if not camp or camp.get("brandId") != brand_id:
            raise HTTPException(status_code=404, detail="Ese proyecto no es de esta marca")
        new = []
        CAMPAIGN_UPLOADS.mkdir(parents=True, exist_ok=True)
        for data, ext in imgs:
            fname = f"pin_{camp['id']}_{uuid.uuid4().hex[:8]}{ext}"
            (CAMPAIGN_UPLOADS / fname).write_bytes(data)
            new.append({"id": f"cin_{uuid.uuid4().hex[:8]}", "url": f"/static/campaign-uploads/{fname}",
                        "type": CAMPAIGN_TYPE[req.dest], "name": board, "filename": fname, "uploadedAt": now,
                        "board": board, "source": source})
        camp["inputs"] = (camp.get("inputs") or []) + new
        campaigns_service.apply_update(camp, {"inputs": camp["inputs"]})
        campaigns_service.save_campaigns(items)
    else:
        key, folder_fn, prefix = BRAND_DEST[req.dest]
        for data, ext in imgs:
            nid = uuid.uuid4().hex[:8]
            fname = f"{brand_id}_pin_{nid}{ext}"
            (folder_fn() / fname).write_bytes(data)
            b.setdefault(key, []).append({"id": nid, "name": board, "description": f"Pinterest · {board}",
                                          "filename": fname, "imageUrl": f"{prefix}/{fname}", "board": board, "source": source})
        brands.save_brands(all_b)
    return {"board": board, "count": len(imgs), "of": len(urls), "target": req.campaignId or "marca"}
