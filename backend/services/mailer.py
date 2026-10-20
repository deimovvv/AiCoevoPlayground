"""
Avisos por mail (openspec/changes/studio-v2 C.5 y §11)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Para que nadie tenga que entrar a mirar si hay algo:

- al cliente: «tenés algo para revisar» (una entrega mandada), «sumamos tu material», y la
  invitación cuando se le da acceso;
- al equipo: «<marca> aprobó / pidió cambios / comentó», «<marca> mandó material».

Sale por Resend (`RESEND_API_KEY`, `MAIL_FROM` en backend/.env; el dominio se verifica en Resend con
registros DNS). **Sin key no se manda nada**: se anota en el log y la app sigue igual.
Cada mail sale en segundo plano: un error de Resend nunca rompe lo que hizo la persona.

Comentarios del cliente: no es un mail por comentario. Se juntan por entrega y salen en uno solo a
los 2 minutos, o antes si el cliente aprueba o pide cambios (ese mail los incluye).
"""

import asyncio
import html
import logging
import os
from typing import Dict, Iterable, List, Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Membership, User
from services import brands as brands_service
from services.roles import admin_emails

log = logging.getLogger("mailer")
COMMENT_WAIT_SECS = 120
_pending: Dict[str, dict] = {}       # delivery_id → {"comments": [...], "task": Task, ...}


def app_url(path: str = "") -> str:
    return os.getenv("APP_URL", "https://app.coevoagency.com").rstrip("/") + path


def brand_name(brand_id: str) -> str:
    b = brands_service.find_brand(brands_service.load_brands(), brand_id)
    return (b or {}).get("name") or brand_id


def is_person(email: Optional[str]) -> bool:
    """El autor es una persona con mail (no Claude por token, no el dev local)."""
    return bool(email) and "@" in email and not email.startswith("servicio:")


# ── Destinatarios ─────────────────────────────────────────────────────────

async def client_emails(s: AsyncSession, brand_id: str) -> List[str]:
    q = select(User.email).join(Membership, Membership.user_id == User.id).where(
        Membership.brand_id == brand_id, User.role == "cliente", User.disabled_at.is_(None))
    return sorted({e for (e,) in (await s.execute(q)).all()})


async def team_emails(s: AsyncSession) -> List[str]:
    q = select(User.email).where(User.role.in_(("admin", "equipo")), User.disabled_at.is_(None))
    return sorted({e for (e,) in (await s.execute(q)).all()} | admin_emails())


# ── Envío ─────────────────────────────────────────────────────────────────

def _html(title: str, lines: Iterable[str], cta: Optional[str], url: Optional[str], quotes: Iterable[str] = ()) -> str:
    e = html.escape
    body = "".join(f'<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#3a3833">{e(l)}</p>' for l in lines)
    body += "".join(
        f'<p style="margin:0 0 10px;padding:10px 14px;border-left:2px solid #d9d5cc;font-size:14px;line-height:1.5;color:#3a3833">{e(q)}</p>'
        for q in quotes)
    button = (f'<p style="margin:24px 0 0"><a href="{e(url)}" style="display:inline-block;padding:12px 22px;background:#1a1916;'
              f'color:#f6f4ef;border-radius:4px;font-size:14px;text-decoration:none">{e(cta)}</a></p>') if cta and url else ""
    return (
        '<div style="background:#f6f4ef;padding:32px 16px;font-family:-apple-system,Helvetica,Arial,sans-serif">'
        '<div style="max-width:520px;margin:0 auto;background:#fdfcf9;border:1px solid #e6e2d9;border-radius:6px;padding:32px">'
        '<p style="margin:0 0 28px;font:11px/1 ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:#8a867c">Coevo Studio</p>'
        f'<h1 style="margin:0 0 16px;font-size:24px;line-height:1.15;font-weight:400;letter-spacing:-.02em;color:#1a1916">{e(title)}</h1>'
        f'{body}{button}</div>'
        '<p style="max-width:520px;margin:16px auto 0;font-size:11px;color:#8a867c">Te llega porque trabajás con Coevo en app.coevoagency.com.</p>'
        '</div>')


async def _post(to: str, subject: str, html_body: str, text: str) -> None:
    key = os.getenv("RESEND_API_KEY")
    if not key:
        log.info("[mail sin RESEND_API_KEY] a %s · %s", to, subject)
        return
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.post("https://api.resend.com/emails", headers={"Authorization": f"Bearer {key}"}, json={
                "from": os.getenv("MAIL_FROM", "Coevo Studio <studio@coevoagency.com>"),
                "to": [to], "subject": subject, "html": html_body, "text": text})
        if r.status_code >= 300:
            log.warning("Resend %s a %s: %s", r.status_code, to, r.text[:300])
    except Exception as ex:   # un mail que no sale nunca rompe la app
        log.warning("No salió el mail a %s: %s", to, ex)


def send(to: Iterable[str], subject: str, title: str, lines: Iterable[str] = (),
         cta: Optional[str] = None, url: Optional[str] = None, quotes: Iterable[str] = (), skip: Optional[str] = None) -> None:
    """Manda en segundo plano, un mail por persona (nadie ve el mail de otro). `skip`: quien lo hizo."""
    lines, quotes = list(lines), list(quotes)
    body = _html(title, lines, cta, url, quotes)
    text = "\n\n".join([title, *lines, *quotes, f"{cta}: {url}" if cta and url else ""]).strip()
    for addr in {a.strip().lower() for a in to if a and "@" in a} - {(skip or "").lower()}:
        asyncio.get_running_loop().create_task(_post(addr, subject, body, text))


# ── Lo que hace el cliente en una entrega ─────────────────────────────────

def client_comment(delivery_id: str, brand_id: str, title: str, author: str, text: str, team: List[str]) -> None:
    """Junta los comentarios del cliente y los manda en un solo mail a los 2 minutos."""
    p = _pending.setdefault(delivery_id, {"comments": [], "task": None})
    p.update(brand_id=brand_id, title=title, author=author, team=team)
    p["comments"].append(text)
    if not p["task"]:
        p["task"] = asyncio.get_running_loop().create_task(_flush_later(delivery_id))


async def _flush_later(delivery_id: str) -> None:
    await asyncio.sleep(COMMENT_WAIT_SECS)
    client_decision(delivery_id, None, None, None, None, None)


def client_decision(delivery_id: str, status: Optional[str], brand_id: Optional[str], title: Optional[str],
                    author: Optional[str], team: Optional[List[str]]) -> None:
    """El cliente aprobó o pidió cambios (o se cumplió la espera de los comentarios): un mail al equipo."""
    p = _pending.pop(delivery_id, None) or {"comments": []}
    task = p.get("task")
    if task and task is not asyncio.current_task():
        task.cancel()
    brand_id, title = brand_id or p.get("brand_id"), title or p.get("title")
    author, team = author or p.get("author"), team if team is not None else p.get("team") or []
    if not brand_id:
        return
    marca, n = brand_name(brand_id), len(p["comments"])
    if status == "aprobada":
        subject, head = f"{marca} aprobó «{title}»", f"{marca} aprobó «{title}»."
    elif status == "cambios":
        subject, head = f"{marca} pidió cambios en «{title}»", f"{marca} pidió cambios en «{title}»."
    elif n:
        subject, head = f"{marca} comentó «{title}»", f"{marca} dejó {n} {'comentario' if n == 1 else 'comentarios'} en «{title}»."
    else:
        return
    send(team, subject, head, [f"Lo hizo {author}."] if is_person(author) else [], "Ver la entrega",
         app_url(f"/dashboard/entregas?id={delivery_id}"), quotes=p["comments"][-8:])
