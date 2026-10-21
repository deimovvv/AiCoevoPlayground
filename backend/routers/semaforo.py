"""
Semáforo y ficha comercial (openspec/changes/studio-v2 O.7) — sólo admin
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Una fila por marca con un color y el porqué, para ver de un vistazo cuál necesita atención:

- rojo: le toca a Coevo y se está demorando (cambios pedidos, material sin ordenar), o el margen es bajo,
  o el mes viene muy atrasado contra el pack;
- amarillo: espera al cliente hace días, o algo para vigilar;
- verde: nada pendiente.

Ficha comercial: fee, moneda, piezas por mes del pack, servicios, contacto y facturación. Vive en
`data/commercial.json` (fuera de git), NO en brands.json: así nunca viaja en lo que ve el cliente.
El margen = fee − costo de IA del mes (lo que ya mide Studio). Las horas del equipo no entran todavía (O.4).
"""
import calendar
import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from db.models import Delivery, InboxItem
from services import brands as brands_service, generations as generations_service
from services.roles import user_of

router = APIRouter(tags=["semaforo"])
FILE = Path(__file__).parent.parent / "data" / "commercial.json"
_lock = threading.Lock()


def _require_admin(request: Request) -> None:
    if user_of(request).get("role") != "admin":
        raise HTTPException(status_code=403, detail="Esto lo ve sólo un admin.")


def _load() -> dict:
    with _lock:
        if not FILE.exists():
            return {"usdArs": None, "brands": {}}
        return json.loads(FILE.read_text(encoding="utf-8"))


def _save(data: dict) -> None:
    with _lock:
        tmp = FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(FILE)


# ── Ficha comercial ───────────────────────────────────────────────────────

class Commercial(BaseModel):
    fee: Optional[float] = None
    currency: str = "ARS"                 # ARS | USD
    piecesPerMonth: Optional[int] = None  # el pack: cuántas piezas por mes
    services: str = ""                    # ej. "fotos de catálogo + 4 reels"
    since: Optional[str] = None           # cliente desde (AAAA-MM)
    contactName: str = ""
    contactEmail: str = ""
    contactPhone: str = ""
    billingName: str = ""                 # razón social
    billingTaxId: str = ""                # CUIT
    billingNotes: str = ""                # condición de IVA, mail de facturas, etc.


@router.get("/api/brands/{brand_id}/comercial")
async def get_commercial(brand_id: str, request: Request):
    _require_admin(request)
    return Commercial(**_load()["brands"].get(brand_id, {})).model_dump()


@router.put("/api/brands/{brand_id}/comercial")
async def put_commercial(brand_id: str, req: Commercial, request: Request):
    _require_admin(request)
    if not brands_service.find_brand(brands_service.load_brands(), brand_id):
        raise HTTPException(status_code=404, detail="No existe esa marca")
    if req.currency not in ("ARS", "USD"):
        raise HTTPException(status_code=400, detail="Moneda: ARS o USD")
    data = _load()
    data["brands"][brand_id] = req.model_dump()
    _save(data)
    return req.model_dump()


class Rate(BaseModel):
    usdArs: Optional[float] = None


@router.put("/api/semaforo/dolar")
async def put_rate(req: Rate, request: Request):
    """El dólar con el que se compara un fee en pesos contra el costo de IA (que está en USD)."""
    _require_admin(request)
    data = _load()
    data["usdArs"] = req.usdArs
    _save(data)
    return {"usdArs": req.usdArs}


# ── Semáforo ──────────────────────────────────────────────────────────────

def _days(d: Optional[datetime], now: datetime) -> int:
    return int((now - d).total_seconds() // 86400) if d else 0


def _ts(iso: Optional[str]) -> Optional[datetime]:
    try:
        d = datetime.fromisoformat((iso or "").replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


@router.get("/api/semaforo")
async def semaforo(request: Request, s: AsyncSession = Depends(get_session)):
    _require_admin(request)
    now = datetime.now(timezone.utc)
    month0 = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    days_in_month = calendar.monthrange(now.year, now.month)[1]
    data = _load()
    rate = data.get("usdArs")
    deliveries = (await s.execute(select(Delivery))).scalars().all()
    inbox = (await s.execute(select(InboxItem).where(InboxItem.status == "nuevo"))).scalars().all()
    cost: dict = {}
    for g in generations_service.load_generations():
        d = _ts(g.get("createdAt"))
        if g.get("brandId") and d and d >= month0:
            cost[g["brandId"]] = cost.get(g["brandId"], 0.0) + float((g.get("cost") or {}).get("usd") or 0)

    rows: List[dict] = []
    for b in brands_service.load_brands():
        if b.get("isSandbox"):
            continue
        bid = b["id"]
        mine = [d for d in deliveries if d.brand_id == bid]
        waiting = [d for d in mine if d.visibility == "cliente" and d.status == "en_revision"]
        changes = [d for d in mine if d.status == "cambios"]
        unsent = [d for d in mine if d.visibility == "interna" and d.status != "aprobada"]
        approved = [d for d in mine if d.status == "aprobada" and d.approved_at and d.approved_at >= month0]
        new_mat = [i for i in inbox if i.brand_id == bid]
        com = data["brands"].get(bid) or {}
        usd = round(cost.get(bid, 0.0), 2)

        red, yellow = [], []
        if changes:
            age = max(_days(d.updated_at, now) for d in changes)
            (red if age >= 2 else yellow).append(f"{len(changes)} con cambios pedidos: le toca a Coevo" + (f" (hace {age} días)" if age else ""))
        if new_mat:
            age = max(_days(i.created_at, now) for i in new_mat)
            (red if age >= 3 else yellow).append(f"material del cliente sin ordenar" + (f" hace {age} días" if age else ""))
        if waiting:
            age = max(_days(d.sent_at, now) for d in waiting)
            if age >= 4:
                yellow.append(f"{len(waiting)} esperando al cliente hace {age} días")
        if unsent:
            age = max(_days(d.created_at, now) for d in unsent)
            if age >= 3:
                yellow.append(f"{len(unsent)} sin mandar al cliente hace {age} días")

        margin = None
        fee = com.get("fee")
        if fee:
            fee_usd = fee if com.get("currency") == "USD" else (fee / rate if rate else None)
            if fee_usd:
                margin = round((fee_usd - usd) / fee_usd, 3)
                if margin < 0.3:
                    red.append(f"margen {round(margin * 100)}% (costo de IA US$ {usd:.0f})")
                elif margin < 0.5:
                    yellow.append(f"margen {round(margin * 100)}%")
        pieces = com.get("piecesPerMonth")
        if pieces and now.day > 7:
            expected = pieces * now.day / days_in_month
            if len(approved) < expected * 0.4:
                red.append(f"{len(approved)} de {pieces} piezas aprobadas y ya es día {now.day}")
            elif len(approved) < expected * 0.7:
                yellow.append(f"{len(approved)} de {pieces} piezas aprobadas, un poco atrás")

        rows.append({
            "id": bid, "name": b.get("name") or bid, "logo": ((b.get("logos") or [{}])[0].get("imageUrl") or (b.get("logo") or {}).get("imageUrl")),
            "color": "rojo" if red else "amarillo" if yellow else "verde", "reasons": red + yellow,
            "waiting": len(waiting), "changes": len(changes), "unsent": len(unsent), "newMaterial": len(new_mat),
            "approvedThisMonth": len(approved), "piecesPerMonth": pieces,
            "costUsd": usd, "fee": fee, "currency": com.get("currency") if fee else None, "margin": margin,
            "hasCommercial": bool(com),
        })
    order = {"rojo": 0, "amarillo": 1, "verde": 2}
    rows.sort(key=lambda r: (order[r["color"]], r["name"].lower()))
    return {"usdArs": rate, "month": now.strftime("%Y-%m"), "brands": rows}
