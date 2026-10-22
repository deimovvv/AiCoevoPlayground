"""
Roles: quién entra y qué puede tocar (openspec/changes/studio-v2 §3)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
La identidad la da Cloudflare Access (`access_guard.py` deja el mail en `scope.state`). Acá se le
asigna un rol con la tabla `users`:

- **admin**: todo, y gestiona los accesos. Los mails de `ADMIN_EMAILS` (backend/.env, separados por
  coma) son admin siempre y se crean solos la primera vez que entran.
- **equipo**: todas las marcas y todas las pantallas.
- **cliente**: sólo sus marcas (`memberships`) y sólo lo que le toca: ver sus entregas, comentar,
  aprobar (si `can_approve`), ver su marca, y sumar o sacar gente de su marca (si `can_invite`). El SERVIDOR le bloquea todo lo demás; no alcanza
  con esconderlo en la pantalla.
- Un mail que pasó Access pero no está en `users` (o está dado de baja): no ve datos ("pedí acceso").
- Token de servicio (Claude, `servicio:...`): equipo. Sin Access (dev local): admin.
"""

import os
import re
import time
from typing import Optional

from sqlalchemy import select
from starlette.responses import JSONResponse

from db import engine
from db.models import Membership, User

ROLES = ("admin", "equipo", "cliente")
_CACHE_SECS = 20
_cache: dict = {}

# Lo único que puede pedir un cliente (método, ruta). Lo que no está acá, 403.
CLIENT_ALLOWED = [
    ("GET", re.compile(r"^/api/me$")),
    ("GET", re.compile(r"^/api/brands$")),
    ("GET", re.compile(r"^/api/brands/(?P<brand>[^/]+)$")),
    ("GET", re.compile(r"^/api/brands/(?P<brand>[^/]+)/deliveries$")),
    ("GET", re.compile(r"^/api/deliveries/[^/]+$")),
    ("POST", re.compile(r"^/api/deliveries/[^/]+/comments$")),
    ("DELETE", re.compile(r"^/api/deliveries/[^/]+/comments/[^/]+$")),
    ("POST", re.compile(r"^/api/deliveries/[^/]+/status$")),
    ("POST", re.compile(r"^/api/deliveries/[^/]+/items/[^/]+/toggle$")),
    ("GET", re.compile(r"^/api/brands/(?P<brand>[^/]+)/inbox$")),
    ("POST", re.compile(r"^/api/brands/(?P<brand>[^/]+)/inbox$")),
    ("GET", re.compile(r"^/api/brands/(?P<brand>[^/]+)/people$")),
    ("POST", re.compile(r"^/api/brands/(?P<brand>[^/]+)/people$")),
    ("DELETE", re.compile(r"^/api/brands/(?P<brand>[^/]+)/people/[^/]+$")),
]


def admin_emails() -> set:
    return {e.strip().lower() for e in os.getenv("ADMIN_EMAILS", "").split(",") if e.strip()}


def invalidate(email: Optional[str] = None) -> None:
    if email:
        _cache.pop(email.lower(), None)
    else:
        _cache.clear()


async def resolve(email: Optional[str]) -> Optional[dict]:
    """{email, role, brands, approve} o None si no tiene acceso."""
    if email is None:          # sin Cloudflare Access (dev local)
        return {"email": "local", "role": "admin", "brands": None, "approve": None}
    if email.startswith("servicio:"):
        return {"email": email, "role": "equipo", "brands": None, "approve": None}
    key = email.lower()
    hit = _cache.get(key)
    if hit and hit[0] > time.time():
        return hit[1]
    engine()
    from db import _sessions  # se crea con engine()
    async with _sessions() as s:  # type: ignore[misc]
        u = (await s.execute(select(User).where(User.email == key))).scalar_one_or_none()
        if u is None and key in admin_emails():
            u = User(email=key, role="admin")
            u.id = f"us_{os.urandom(6).hex()}"
            s.add(u)
            await s.commit()
        if u is None or u.disabled_at is not None:
            out = None
        elif u.role == "cliente":
            rows = (await s.execute(select(Membership).where(Membership.user_id == u.id))).scalars().all()
            out = {"email": key, "role": "cliente", "name": u.name,
                   "brands": [m.brand_id for m in rows], "approve": [m.brand_id for m in rows if m.can_approve],
                   "invite": [m.brand_id for m in rows if m.can_invite]}
        else:
            out = {"email": key, "role": u.role, "name": u.name, "brands": None, "approve": None}
    _cache[key] = (time.time() + _CACHE_SECS, out)
    return out


def user_of(request) -> dict:
    return (request.scope.get("state") or {}).get("user") or {"email": "local", "role": "admin", "brands": None}


def is_client(request) -> bool:
    return user_of(request).get("role") == "cliente"


def can_see_brand(request, brand_id: str) -> bool:
    brands = user_of(request).get("brands")
    return brands is None or brand_id in brands


def can_approve(request, brand_id: str) -> bool:
    u = user_of(request)
    return u.get("role") != "cliente" or brand_id in (u.get("approve") or [])


def can_invite(request, brand_id: str) -> bool:
    u = user_of(request)
    return u.get("role") != "cliente" or brand_id in (u.get("invite") or [])


class RoleGuard:
    """Va DESPUÉS de AccessGuard (adentro): ya está el mail verificado en scope.state."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["path"] == "/api/health":
            return await self.app(scope, receive, send)
        email = (scope.get("state") or {}).get("access_email")
        user = await resolve(email)
        path, method = scope["path"], scope["method"]
        data = path.startswith("/api/") or path.startswith("/static/")
        if user is None:
            # La pantalla (el HTML) se puede cargar: muestra "pedí acceso" al leer /api/me.
            if path == "/api/me":
                return await JSONResponse({"email": email, "role": None})(scope, receive, send)
            if data:
                return await JSONResponse({"detail": "Tu mail no tiene acceso a Coevo Studio. Pedíselo a Coevo."}, status_code=403)(scope, receive, send)
            return await self.app(scope, receive, send)
        scope.setdefault("state", {})["user"] = user
        if user["role"] == "cliente" and path.startswith("/api/"):
            ok = False
            for m, rx in CLIENT_ALLOWED:
                hit = rx.match(path)
                if hit and m == method:
                    brand = hit.groupdict().get("brand")
                    ok = brand is None or brand in user["brands"]
                    break
            if not ok:
                return await JSONResponse({"detail": "No tenés acceso a esto."}, status_code=403)(scope, receive, send)
        return await self.app(scope, receive, send)
