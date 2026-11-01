"""
Inicio del equipo (2026-10-31): lo primero que se ve al entrar a Studio.

Dos cosas, para todo el equipo (no sólo admin, y sin plata: eso queda en el Resumen):
- **Te toca:** lo que espera a Coevo o se está demorando, de todas las marcas, lo más urgente primero.
- **Las marcas**, agrupadas como en el selector (plan mensual · proyectos · por cargar), cada una con
  las tapas de sus últimas piezas y una línea de cómo viene.

Reusa los criterios del semáforo (`routers/semaforo.py`) para que las dos pantallas digan lo mismo.
"""
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from db.models import Delivery, InboxItem
from routers.deliveries import _phase, _poster
from routers.semaforo import _days, _hace
from services import brands as brands_service
from services.roles import is_client

router = APIRouter(tags=["inicio"])


def _cover(d: Delivery) -> Optional[str]:
    it = (d.items or [None])[0]
    if not it:
        return None
    return (it.get("poster") or _poster(it["url"])) if it.get("kind") == "video" else it.get("url")


def _loaded(b: dict) -> bool:
    """Mismo criterio que el selector de marca (BrandPicker.isLoaded)."""
    assets = sum(len(b.get(k) or []) for k in ("avatars", "products", "clothing", "moodboards", "logos"))
    return assets > 0 or bool(b.get("logo") or b.get("strategy") or b.get("designSystemUrl")) \
        or len((b.get("brandContext") or "").strip()) > 40


@router.get("/api/inicio")
async def inicio(request: Request, s: AsyncSession = Depends(get_session)):
    if is_client(request):
        raise HTTPException(status_code=403, detail="No tenés acceso a esto.")
    now = datetime.now(timezone.utc)
    month0 = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    deliveries = (await s.execute(select(Delivery).order_by(Delivery.updated_at.desc()))).scalars().all()
    inbox = (await s.execute(select(InboxItem).where(InboxItem.status == "nuevo"))).scalars().all()

    today: List[dict] = []
    rows: List[dict] = []
    for b in brands_service.load_brands():
        if b.get("isSandbox"):
            continue
        bid, name = b["id"], b.get("name") or b["id"]
        mine = [d for d in deliveries if d.brand_id == bid]

        def add(kind: str, urgency: int, title: str, detail: str, href: str, cover: Optional[str] = None):
            today.append({"kind": kind, "urgency": urgency, "brandId": bid, "brandName": name,
                          "title": title, "detail": detail, "href": href, "cover": cover})

        for d in mine:
            if d.status == "cambios":
                age = _days(d.updated_at, now)
                add("cambios", 0 if age >= 2 else 1, d.title, f"pidió cambios · {_hace(age)}", f"/dashboard/entregas?id={d.id}", _cover(d))
            elif d.visibility == "cliente" and d.status == "en_revision" and _days(d.sent_at, now) >= 4:
                add("esperando", 3, d.title, f"esperando al cliente · {_hace(_days(d.sent_at, now))}", f"/dashboard/entregas?id={d.id}", _cover(d))
            elif d.visibility == "interna" and d.status != "aprobada" and _phase(d) not in ("pausada", "descartada") \
                    and _days(d.created_at, now) >= 3:
                add("sin_mandar", 2, d.title, f"sin mandar al cliente · {_hace(_days(d.created_at, now))}", f"/dashboard/entregas?id={d.id}", _cover(d))
        for i in inbox:
            if i.brand_id == bid:
                age = _days(i.created_at, now)
                img = next((f["url"] for f in (i.files or []) if f.get("kind") == "image"), None)
                add("material", 0 if age >= 3 else 1, (i.note or "Material nuevo")[:90],
                    f"mandó material · {_hace(age)}", f"/dashboard/bandeja?marca={bid}", img)

        live = [d for d in mine if _phase(d) != "descartada"]
        approved = [d for d in live if d.status == "aprobada"]
        covers = [c for c in (_cover(d) for d in (approved + [d for d in live if d not in approved])) if c][:4]
        if len(covers) < 4:   # sin piezas todavía: sus propias imágenes (moodboard, prendas, caras, productos)
            for k in ("moodboards", "lookAndFeel", "clothing", "avatars", "products"):
                covers += [x.get("imageUrl") for x in (b.get(k) or []) if x.get("imageUrl") and x.get("imageUrl") not in covers]
            covers = covers[:4]
        upcoming = sorted([d for d in live if d.scheduled_at and d.scheduled_at >= now and not d.published_at],
                          key=lambda d: d.scheduled_at)
        waiting = sum(1 for d in mine if d.visibility == "cliente" and d.status == "en_revision")
        changes = sum(1 for d in mine if d.status == "cambios")
        group = "cargar" if not _loaded(b) else "plan" if b.get("workType") == "plan" else "proyectos"
        logo = ((b.get("logos") or [{}])[0].get("imageUrl") or (b.get("logo") or {}).get("imageUrl"))
        last = max((d.updated_at for d in mine if d.updated_at), default=None)
        rows.append({
            "id": bid, "name": name, "logo": logo, "group": group, "covers": covers,
            "pieces": len(live), "approvedThisMonth": sum(1 for d in approved if d.approved_at and d.approved_at >= month0),
            "waiting": waiting, "changes": changes, "newMaterial": sum(1 for i in inbox if i.brand_id == bid),
            "next": {"title": upcoming[0].title, "at": upcoming[0].scheduled_at.isoformat()} if upcoming else None,
            "lastActivity": last.isoformat() if last else None,
        })

    today.sort(key=lambda t: t["urgency"])
    rows.sort(key=lambda r: (r["lastActivity"] is None, -(datetime.fromisoformat(r["lastActivity"]).timestamp() if r["lastActivity"] else 0)))
    return {"today": today[:12], "todayTotal": len(today), "brands": rows}
