"""
Accesos: quién entra a Studio y con qué rol (openspec/changes/studio-v2 §3, `services/roles.py`).

`/api/me` lo usa la pantalla para saber qué mostrar. `/api/users` es sólo para admin.
`/api/brands/{marca}/people`: la gente de una marca. La ve cualquiera de esa marca; la cambia el
equipo o el contacto principal del cliente (`can_invite`), que así suma a su equipo sin pedírselo
a Coevo. No puede sacar a otro contacto principal, ni a sí mismo, ni reactivar a quien Coevo dio de baja.
Recordatorio: para que un cliente pueda entrar, la policy de Cloudflare Access tiene que dejarlo
pasar (Include: Everyone). Esta tabla decide QUÉ ve.
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
from services.roles import ROLES, admin_emails, can_invite, can_see_brand, invalidate, user_of

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
        "brands": None if brands is None else [{"id": b, "name": names.get(b, b), "canApprove": b in (u.get("approve") or []),
                                         "canInvite": b in (u.get("invite") or [])} for b in brands],
    }


async def _out(s: AsyncSession, u: User) -> dict:
    ms = (await s.execute(select(Membership).where(Membership.user_id == u.id))).scalars().all()
    return {
        "id": u.id, "email": u.email, "name": u.name, "role": u.role,
        "disabled": u.disabled_at is not None, "fromEnv": u.email in admin_emails(),
        "brands": [{"id": m.brand_id, "canApprove": m.can_approve, "canInvite": m.can_invite} for m in ms],
    }


@router.get("/api/users")
async def list_users(request: Request, s: AsyncSession = Depends(get_session)):
    _require_admin(request)
    rows = (await s.execute(select(User).order_by(User.role, User.email))).scalars().all()
    return [await _out(s, u) for u in rows]


class BrandAccess(BaseModel):
    id: str
    canApprove: bool = True
    canInvite: bool = False


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
            s.add(Membership(user_id=u.id, brand_id=b.id, can_approve=b.canApprove, can_invite=b.canInvite))
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


# ── La gente de una marca (el cliente suma a su equipo) ───────────────────

class PersonIn(BaseModel):
    email: str
    name: Optional[str] = None
    canApprove: bool = False


def _brand_or_404(request: Request, brand_id: str) -> str:
    b = brands_service.find_brand(brands_service.load_brands(), brand_id)
    if not b or not can_see_brand(request, brand_id):
        raise HTTPException(status_code=404, detail="No existe esa marca")
    return b.get("name") or brand_id


def _require_invite(request: Request, brand_id: str) -> None:
    if not can_invite(request, brand_id):
        raise HTTPException(status_code=403, detail="Sumar gente lo hace el contacto principal de tu marca.")


@router.get("/api/brands/{brand_id}/people")
async def list_people(brand_id: str, request: Request, s: AsyncSession = Depends(get_session)):
    _brand_or_404(request, brand_id)
    me_email = user_of(request).get("email")
    rows = (await s.execute(
        select(User, Membership).join(Membership, Membership.user_id == User.id)
        .where(Membership.brand_id == brand_id, User.role == "cliente", User.disabled_at.is_(None))
        .order_by(Membership.can_invite.desc(), User.email))).all()
    return [{"id": u.id, "email": u.email, "name": u.name, "canApprove": m.can_approve,
             "canInvite": m.can_invite, "isMe": u.email == me_email} for u, m in rows]


@router.post("/api/brands/{brand_id}/people")
async def add_person(brand_id: str, req: PersonIn, request: Request, s: AsyncSession = Depends(get_session)):
    marca = _brand_or_404(request, brand_id)
    _require_invite(request, brand_id)
    email = req.email.strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Ese mail no es válido.")
    u = (await s.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if (u and u.role != "cliente") or email in admin_emails():
        raise HTTPException(status_code=409, detail="Ese mail es del equipo de Coevo.")
    if u and u.disabled_at is not None:
        raise HTTPException(status_code=409, detail="Ese mail está dado de baja: pedíselo a Coevo.")
    if u and await s.get(Membership, (u.id, brand_id)):
        raise HTTPException(status_code=409, detail="Ya está en tu marca.")
    if not u:
        u = User(email=email, name=(req.name or "").strip()[:120] or None, role="cliente")
        u.id = f"us_{uuid.uuid4().hex[:12]}"
        s.add(u)
        await s.flush()
    s.add(Membership(user_id=u.id, brand_id=brand_id, can_approve=req.canApprove, can_invite=False))
    await s.commit()
    invalidate(email)
    by = user_of(request)
    who = by.get("name") or by.get("email")
    by_client = by.get("role") == "cliente"
    mailer.send([email], f"Te sumaron a {marca} en Coevo Studio", f"{who if by_client else 'Coevo'} te sumó a {marca} en Coevo Studio.", [
        "Ahí vas a ver lo que hace Coevo para la marca" + (": aprobarlo o pedir cambios, y mandar material." if req.canApprove else ", comentarlo y mandar material."),
        f"Entrá con este mail ({email}): con Google, o con el código que te llega al mail.",
    ], "Entrar", mailer.app_url("/cliente"))
    if by_client:
        mailer.send(await mailer.team_emails(s), f"{marca}: {who} sumó a {email}", f"{who} sumó a {email} a {marca}.",
                    ["Puede aprobar." if req.canApprove else "Sólo comenta."], "Ver accesos", mailer.app_url("/dashboard/accesos"))
    return {"id": u.id, "email": u.email, "name": u.name, "canApprove": req.canApprove, "canInvite": False, "isMe": False}


@router.delete("/api/brands/{brand_id}/people/{user_id}")
async def remove_person(brand_id: str, user_id: str, request: Request, s: AsyncSession = Depends(get_session)):
    _brand_or_404(request, brand_id)
    _require_invite(request, brand_id)
    u = await s.get(User, user_id)
    m = await s.get(Membership, (user_id, brand_id))
    if not u or not m:
        raise HTTPException(status_code=404, detail="No está en esta marca")
    if user_of(request).get("role") == "cliente":
        if u.email == user_of(request).get("email"):
            raise HTTPException(status_code=400, detail="No podés sacarte a vos: pedíselo a Coevo.")
        if m.can_invite:
            raise HTTPException(status_code=403, detail="A otro contacto principal lo saca Coevo.")
    await s.delete(m)
    await s.commit()
    invalidate(u.email)
    return {"ok": True}
