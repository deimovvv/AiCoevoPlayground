"""
Accesos: quién entra a Studio y con qué rol (openspec/changes/studio-v2 §3, `services/roles.py`).

`/api/me` lo usa la pantalla para saber qué mostrar. El resto es sólo para admin.
Recordatorio: para que un cliente pueda entrar, su mail también tiene que estar en la policy de
Cloudflare Access (Access controls → Policies). Esta tabla decide QUÉ ve; Access, SI entra.
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from db.models import Membership, User
from services import brands as brands_service, mailer
from services.roles import ROLES, admin_emails, invalidate, user_of

router = APIRouter(tags=["users"])


def _require_admin(request: Request) -> None:
    if user_of(request).get("role") != "admin":
        raise HTTPException(status_code=403, detail="Sólo un admin gestiona los accesos.")


@router.get("/api/me")
async def me(request: Request):
    u = user_of(request)
    names = {b["id"]: b["name"] for b in brands_service.load_brands()}
    brands = u.get("brands")
    return {
        "email": u.get("email"), "name": u.get("name"), "role": u.get("role"),
        "brands": None if brands is None else [{"id": b, "name": names.get(b, b), "canApprove": b in (u.get("approve") or [])} for b in brands],
    }


async def _out(s: AsyncSession, u: User) -> dict:
    ms = (await s.execute(select(Membership).where(Membership.user_id == u.id))).scalars().all()
    return {
        "id": u.id, "email": u.email, "name": u.name, "role": u.role,
        "disabled": u.disabled_at is not None, "fromEnv": u.email in admin_emails(),
        "brands": [{"id": m.brand_id, "canApprove": m.can_approve} for m in ms],
    }


@router.get("/api/users")
async def list_users(request: Request, s: AsyncSession = Depends(get_session)):
    _require_admin(request)
    rows = (await s.execute(select(User).order_by(User.role, User.email))).scalars().all()
    return [await _out(s, u) for u in rows]


class BrandAccess(BaseModel):
    id: str
    canApprove: bool = True


class UserIn(BaseModel):
    email: str
    name: Optional[str] = None
    role: str = "cliente"
    brands: List[BrandAccess] = []
    disabled: bool = False


async def _save(s: AsyncSession, u: User, req: UserIn) -> None:
    if req.role not in ROLES:
        raise HTTPException(status_code=400, detail=f"role: {', '.join(ROLES)}")
    known = {b["id"] for b in brands_service.load_brands()}
    bad = [b.id for b in req.brands if b.id not in known]
    if bad:
        raise HTTPException(status_code=400, detail=f"No existen estas marcas: {', '.join(bad)}")
    if req.role == "cliente" and not req.brands:
        raise HTTPException(status_code=400, detail="Un cliente necesita al menos una marca.")
    u.name, u.role = (req.name or None), req.role
    u.disabled_at = datetime.now(timezone.utc) if req.disabled else None
    await s.execute(delete(Membership).where(Membership.user_id == u.id))
    if req.role == "cliente":
        for b in req.brands:
            s.add(Membership(user_id=u.id, brand_id=b.id, can_approve=b.canApprove))
    await s.commit()
    invalidate(u.email)


@router.post("/api/users")
async def create_user(req: UserIn, request: Request, s: AsyncSession = Depends(get_session)):
    _require_admin(request)
    email = req.email.strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Ese mail no es válido.")
    if (await s.execute(select(User).where(User.email == email))).scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Ese mail ya tiene acceso: editalo en la lista.")
    u = User(email=email, role=req.role)
    u.id = f"us_{uuid.uuid4().hex[:12]}"
    s.add(u)
    await s.flush()
    await _save(s, u, req)
    if not req.disabled:
        client = req.role == "cliente"
        names = [mailer.brand_name(b.id) for b in req.brands]
        mailer.send([email], "Tu acceso a Coevo Studio", "Ya tenés acceso a Coevo Studio.", [
            f"Ahí vas a ver lo que hacemos para {', '.join(names)}: aprobarlo o pedirnos cambios, y mandarnos material."
            if client else "Es donde trabajamos las marcas de Coevo.",
            f"Entrá con este mail ({email}): con Google, o con el código que te llega al mail.",
        ], "Entrar", mailer.app_url("/cliente" if client else "/dashboard"))
    return await _out(s, u)


@router.put("/api/users/{user_id}")
async def update_user(user_id: str, req: UserIn, request: Request, s: AsyncSession = Depends(get_session)):
    _require_admin(request)
    u = await s.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="No existe ese usuario")
    if u.email == user_of(request).get("email") and (req.role != "admin" or req.disabled):
        raise HTTPException(status_code=400, detail="No podés sacarte el rol de admin a vos mismo.")
    await _save(s, u, req)
    return await _out(s, u)
