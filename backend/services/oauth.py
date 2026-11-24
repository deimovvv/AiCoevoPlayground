"""
Tokens para conectar Claude (openspec/changes/studio-en-claude)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Lo comparten el router de OAuth (`routers/oauth.py`) y la traba de la app (`access_guard.py`).

- Los tokens empiezan con `stk_` (Studio token) y se guardan sólo como sha256.
- Un token válido = no vencido, no cortado, y la persona sigue teniendo acceso (eso lo decide `roles.py`
  después, con su mail, como para cualquiera que entra por la pantalla).
- `last_used_at` se actualiza como mucho una vez por minuto, para no escribir en cada pedido.
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select

ACCESS_TTL = timedelta(hours=1)
REFRESH_TTL = timedelta(days=30)
CODE_TTL = timedelta(minutes=10)
PREFIX = "stk_"


def now() -> datetime:
    return datetime.now(timezone.utc)


def new_secret(prefix: str = PREFIX) -> str:
    return prefix + secrets.token_urlsafe(32)


def digest(secret: str) -> str:
    return hashlib.sha256(secret.encode()).hexdigest()


def bearer_of(headers) -> Optional[str]:
    """El token `stk_` del header Authorization, o None si no hay (o es otra cosa)."""
    auth = headers.get("authorization") or ""
    if auth[:7].lower() != "bearer ":
        return None
    tok = auth[7:].strip()
    return tok if tok.startswith(PREFIX) else None


async def email_for_token(token: str) -> Optional[str]:
    """El mail de quien autorizó ese token, o None si no sirve."""
    from db import engine
    from db.models import OAuthToken
    engine()
    from db import _sessions  # se crea con engine()
    async with _sessions() as s:  # type: ignore[misc]
        t = (await s.execute(select(OAuthToken).where(OAuthToken.access_hash == digest(token)))).scalar_one_or_none()
        if t is None or t.revoked_at is not None or t.access_expires_at <= now():
            return None
        if t.last_used_at is None or now() - t.last_used_at > timedelta(minutes=1):
            t.last_used_at = now()
            await s.commit()
        return t.email
