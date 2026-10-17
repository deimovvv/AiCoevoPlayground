"""
Traba de Cloudflare Access en la propia app
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
En producción, Cloudflare Access pide el login antes de dejar pasar a app.<dominio> y
agrega a cada pedido un JWT firmado (header `Cf-Access-Jwt-Assertion`, cookie
`CF_Authorization`). Este middleware lo verifica: si falta o no es válido, 403.

Así, si Access queda mal configurado (pasó el 2026-10-17: el túnel se abrió y la app quedó
pública), la app no muestra nada igual.

- `CF_ACCESS_TEAM` (ej. `dawn-credit-95f3`): activa la traba. Sin ella (dev local) no hace nada.
- `CF_ACCESS_AUD`: el "Application Audience (AUD) Tag" de la app de Access. Si está, sólo
  vale un token emitido para ESA app.
- `/api/health` queda abierto (no devuelve datos).
"""

import logging
import os
from typing import Optional

import jwt
from starlette.concurrency import run_in_threadpool
from starlette.requests import Request
from starlette.responses import PlainTextResponse

log = logging.getLogger("access_guard")
OPEN_PATHS = {"/api/health"}


class AccessGuard:
    def __init__(self, app):
        self.app = app
        self.team = os.getenv("CF_ACCESS_TEAM", "").strip()
        self.aud = os.getenv("CF_ACCESS_AUD", "").strip() or None
        self.issuer = f"https://{self.team}.cloudflareaccess.com"
        self.jwks = jwt.PyJWKClient(f"{self.issuer}/cdn-cgi/access/certs", cache_keys=True) if self.team else None
        if self.team:
            log.warning("Access guard activo (team=%s, aud=%s)", self.team, "sí" if self.aud else "NO — falta CF_ACCESS_AUD")

    def _verify(self, token: str) -> dict:
        key = self.jwks.get_signing_key_from_jwt(token).key
        return jwt.decode(
            token, key, algorithms=["RS256"], issuer=self.issuer,
            audience=self.aud, options={"verify_aud": bool(self.aud)},
        )

    async def __call__(self, scope, receive, send):
        if not self.team or scope["type"] not in ("http", "websocket") or scope["path"] in OPEN_PATHS:
            return await self.app(scope, receive, send)
        req = Request(scope)
        token: Optional[str] = req.headers.get("cf-access-jwt-assertion") or req.cookies.get("CF_Authorization")
        if token:
            try:
                claims = await run_in_threadpool(self._verify, token)
                scope.setdefault("state", {})["access_email"] = claims.get("email")
                return await self.app(scope, receive, send)
            except Exception as e:  # firma, vencimiento, emisor o audiencia
                log.warning("Access: token rechazado en %s: %s", scope["path"], e)
        if scope["type"] == "websocket":
            return await send({"type": "websocket.close", "code": 1008})
        return await PlainTextResponse("Acceso restringido.", status_code=403)(scope, receive, send)
