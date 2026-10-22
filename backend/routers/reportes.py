"""
Reporte del mes de una marca (openspec/changes/studio-v2 O.9)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Dos partes, y una tercera cuando haya Postiz:

1. **Producción** (lo calcula Studio): piezas mandadas y aprobadas en el mes, cuántas a la primera,
   cuántas con cambios, cuánto tardó el cliente en responder, láminas que sacó, material que mandó.
   Por proyecto.
2. **La lectura de Coevo**: unas líneas de qué funcionó y qué se hace el mes que viene. La escribe el
   equipo; se guarda en `data/reports.json` (fuera de git).
3. **Resultados en redes** (Postiz, O.6): todavía no. Se suma como un bloque más.

El equipo lo arma y lo publica; recién publicado lo ve el cliente (en /cliente/reporte). El costo de IA
y el margen NO van acá: son de Coevo (Resumen).
"""
import calendar
import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from db.models import Delivery, DeliveryComment, InboxItem
from services import brands as brands_service, campaigns as campaigns_service
from services.roles import can_see_brand, is_client

router = APIRouter(tags=["reportes"])
FILE = Path(__file__).parent.parent / "data" / "reports.json"
_lock = threading.Lock()


def _load() -> dict:
    with _lock:
        return json.loads(FILE.read_text(encoding="utf-8")) if FILE.exists() else {}


def _save(data: dict) -> None:
    with _lock:
        tmp = FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(FILE)


def _month(mes: Optional[str]) -> tuple:
    now = datetime.now(timezone.utc)
    try:
        y, m = (int(x) for x in (mes or now.strftime("%Y-%m")).split("-"))
        start = datetime(y, m, 1, tzinfo=timezone.utc)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="mes: AAAA-MM")
    end = datetime(y, m, calendar.monthrange(y, m)[1], 23, 59, 59, tzinfo=timezone.utc)
    return start.strftime("%Y-%m"), start, end


def _in(d: Optional[datetime], a: datetime, b: datetime) -> bool:
    return bool(d) and a <= d <= b


@router.get("/api/brands/{brand_id}/reporte")
async def get_report(brand_id: str, request: Request, mes: Optional[str] = None, s: AsyncSession = Depends(get_session)):
    brand = brands_service.find_brand(brands_service.load_brands(), brand_id)
    if not brand or not can_see_brand(request, brand_id):
        raise HTTPException(status_code=404, detail="No existe esa marca")
    key, a, b = _month(mes)
    saved = _load().get(brand_id, {}).get(key, {})
    if is_client(request) and not saved.get("publishedAt"):
        raise HTTPException(status_code=404, detail="El reporte de este mes todavía no está.")

    rows = (await s.execute(select(Delivery).where(Delivery.brand_id == brand_id))).scalars().all()
    sent = [d for d in rows if d.visibility == "cliente" and _in(d.sent_at, a, b)]
    approved = [d for d in rows if d.status == "aprobada" and _in(d.approved_at, a, b)]
    ids = [d.id for d in rows]
    comments = (await s.execute(select(DeliveryComment).where(DeliveryComment.delivery_id.in_(ids)))).scalars().all() if ids else []
    client_comments = [c for c in comments if not c.internal and _in(c.created_at, a, b)]
    asked_changes = {c.delivery_id for c in client_comments}
    first_try = [d for d in approved if d.round == 1 and d.id not in asked_changes]
    days = [(d.approved_at - d.sent_at).total_seconds() / 86400 for d in approved if d.sent_at and d.approved_at and d.approved_at >= d.sent_at]
    removed = sum(1 for d in approved for i in (d.items or []) if i.get("rejected"))
    material = (await s.execute(select(InboxItem).where(InboxItem.brand_id == brand_id))).scalars().all()
    material = [i for i in material if _in(i.created_at, a, b)]

    names = {c["id"]: c.get("name") for c in campaigns_service.load_campaigns() if c.get("brandId") == brand_id}
    by_project: dict = {}
    for d in {x.id: x for x in [*sent, *approved]}.values():
        p = by_project.setdefault(d.campaign_id or "", {"project": names.get(d.campaign_id) if d.campaign_id else None,
                                                        "sent": 0, "approved": 0, "changes": 0})
        p["sent"] += d in sent
        p["approved"] += d in approved
        p["changes"] += d.id in asked_changes

    return {
        "brand": brand.get("name") or brand_id, "month": key,
        "production": {
            "sent": len(sent), "approved": len(approved), "firstTry": len(first_try),
            "withChanges": len({d.id for d in rows if d.id in asked_changes and (d in sent or d in approved)}),
            "avgResponseDays": round(sum(days) / len(days), 1) if days else None,
            "removedSlides": removed, "clientComments": len(client_comments), "materialSent": len(material),
            "byProject": sorted(by_project.values(), key=lambda p: (p["project"] is None, p["project"] or "")),
        },
        "reading": saved.get("reading", ""),
        "publishedAt": saved.get("publishedAt"),
        "social": None,   # Postiz (O.6)
    }


class ReportIn(BaseModel):
    reading: str = ""
    publish: Optional[bool] = None   # True publica (lo ve el cliente), False lo vuelve borrador


@router.put("/api/brands/{brand_id}/reporte")
async def save_report(brand_id: str, req: ReportIn, request: Request, mes: Optional[str] = None):
    if is_client(request):
        raise HTTPException(status_code=403, detail="No tenés acceso a esto.")
    if not brands_service.find_brand(brands_service.load_brands(), brand_id):
        raise HTTPException(status_code=404, detail="No existe esa marca")
    key, _, _ = _month(mes)
    data = _load()
    cur = data.setdefault(brand_id, {}).setdefault(key, {})
    cur["reading"] = req.reading.strip()[:6000]
    if req.publish is True:
        cur["publishedAt"] = datetime.now(timezone.utc).isoformat()
    elif req.publish is False:
        cur.pop("publishedAt", None)
    _save(data)
    return {"reading": cur["reading"], "publishedAt": cur.get("publishedAt")}
