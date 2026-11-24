"""
OAuth para conectar Claude (openspec/changes/studio-en-claude, paso 1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Studio hace de servidor OAuth 2.1 chico para que claude.ai y Claude Code usen el MCP (`/mcp`) con el
login de cada persona. No hay contraseñas nuevas: la pantalla «Autorizar» está detrás de Cloudflare
Access, así que quien autoriza es el mail que ya entra a Studio, con su rol de siempre.

Recorrido:
1. Claude pide `/mcp` sin token → 401 que apunta a `/.well-known/oauth-protected-resource`.
2. Lee `/.well-known/oauth-authorization-server` y se registra solo en `/oauth/register`.
3. Abre `/oauth/authorize` en el navegador de la persona → login de Cloudflare (Google o PIN) →
   «Claude quiere ver tus marcas» → Autorizar → vuelve a Claude con un código de un solo uso.
4. Cambia el código por un token en `/oauth/token` (PKCE S256). El token dura 1 h; el refresh, 30 días.

Abiertas en Cloudflare Access (claude.ai llama desde la nube de Anthropic, sin login): los dos
`/.well-known/...`, `/oauth/register` y `/oauth/token`. Ninguna devuelve datos de marcas.
`/oauth/authorize` NO se abre: ahí entra la persona.
"""

import base64
import hashlib
import hmac
import html
import os
from typing import List, Optional
from urllib.parse import urlencode, urlparse

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from db.models import OAuthClient, OAuthCode, OAuthToken
from services import oauth as tk
from services.roles import resolve

router = APIRouter()


def public_base(request: Request) -> str:
    """La dirección pública de Studio (detrás del túnel el pedido llega por http, pero afuera es https)."""
    env = os.getenv("STUDIO_PUBLIC_URL", "").strip().rstrip("/")
    if env:
        return env
    host = request.headers.get("host") or request.url.netloc
    local = host.startswith(("127.0.0.1", "localhost"))
    return f"{'http' if local else 'https'}://{host}"


def _err(error: str, desc: str, status: int = 400) -> JSONResponse:
    return JSONResponse({"error": error, "error_description": desc}, status_code=status)


# ── Descubrimiento ──────────────────────────────────────────────────────────────────────────────

def _resource_meta(request: Request) -> dict:
    base = public_base(request)
    return {"resource": f"{base}/mcp", "authorization_servers": [base], "bearer_methods_supported": ["header"],
            "resource_name": "Coevo Studio"}


@router.get("/.well-known/oauth-protected-resource")
@router.get("/.well-known/oauth-protected-resource/mcp")
async def protected_resource(request: Request):
    return _resource_meta(request)


@router.get("/.well-known/oauth-authorization-server")
@router.get("/.well-known/oauth-authorization-server/mcp")
async def authorization_server(request: Request):
    base = public_base(request)
    return {
        "issuer": base,
        "authorization_endpoint": f"{base}/oauth/authorize",
        "token_endpoint": f"{base}/oauth/token",
        "registration_endpoint": f"{base}/oauth/register",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "code_challenge_methods_supported": ["S256"],
        "token_endpoint_auth_methods_supported": ["none"],
        "scopes_supported": ["studio"],
    }


# ── Registro dinámico ───────────────────────────────────────────────────────────────────────────

def redirect_allowed(uri: str) -> bool:
    """Sólo vuelve a Claude (claude.ai / claude.com) o a la propia compu (Claude Code)."""
    try:
        u = urlparse(uri)
    except ValueError:
        return False
    if u.scheme == "https" and (u.hostname or "") in ("claude.ai", "claude.com", "www.claude.ai", "www.claude.com"):
        return True
    return u.scheme == "http" and (u.hostname or "") in ("localhost", "127.0.0.1")


class RegisterIn(BaseModel):
    redirect_uris: List[str]
    client_name: Optional[str] = None


@router.post("/oauth/register")
async def register(req: RegisterIn, s: AsyncSession = Depends(get_session)):
    uris = [u for u in req.redirect_uris if isinstance(u, str)]
    if not uris or not all(redirect_allowed(u) for u in uris):
        return _err("invalid_redirect_uri", "Sólo se aceptan direcciones de Claude o de la propia compu.")
    c = OAuthClient(name=(req.client_name or "")[:200] or None, redirect_uris=uris)
    s.add(c)
    await s.commit()
    return JSONResponse({
        "client_id": c.id, "client_name": c.name, "redirect_uris": uris,
        "grant_types": ["authorization_code", "refresh_token"], "response_types": ["code"],
        "token_endpoint_auth_method": "none",
    }, status_code=201)


# ── Autorizar (detrás de Cloudflare Access) ─────────────────────────────────────────────────────

def _csrf(email: str, client_id: str, redirect_uri: str, challenge: str) -> str:
    """Firma el formulario de «Autorizar»: sólo vale para esa persona, esa app y ese pedido."""
    key = (os.getenv("OAUTH_SECRET") or os.getenv("CF_ACCESS_AUD") or "coevo-dev").encode()
    msg = "|".join([email, client_id, redirect_uri, challenge]).encode()
    return hmac.new(key, msg, hashlib.sha256).hexdigest()


def _page(title: str, body: str, status: int = 200) -> HTMLResponse:
    # Design system de Coevo: papel, tinta, grises fríos, Instrument Sans + Geist Mono.
    return HTMLResponse(f"""<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>{html.escape(title)} · Coevo Studio</title>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500&family=Geist+Mono&display=swap" rel="stylesheet">
<style>
:root{{--bg:#f3f4f3;--ink:#131416;--mute:#6b6e73;--edge:#dcdee1}}
*{{box-sizing:border-box}}body{{margin:0;min-height:100dvh;display:grid;place-items:center;background:var(--bg);color:var(--ink);
font-family:"Instrument Sans",system-ui,sans-serif;-webkit-font-smoothing:antialiased;padding:24px}}
main{{width:100%;max-width:420px}}.mono{{font-family:"Geist Mono",monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--mute)}}
h1{{font-weight:400;font-size:30px;line-height:1.1;letter-spacing:-.03em;margin:14px 0 12px}}p{{color:var(--mute);line-height:1.5;margin:0 0 10px;font-size:15px}}
b{{color:var(--ink);font-weight:500}}.row{{display:flex;gap:10px;margin-top:26px}}
button{{height:44px;padding:0 18px;border-radius:2px;font:500 14px "Instrument Sans",sans-serif;cursor:pointer;border:1px solid var(--ink)}}
.go{{background:var(--ink);color:var(--bg)}}.no{{background:transparent;color:var(--ink);border-color:var(--edge)}}
</style></head><body><main><div class="mono">coevo · studio</div>{body}</main></body></html>""", status_code=status)


async def _check_authorize(s: AsyncSession, client_id: str, redirect_uri: str, response_type: str,
                           code_challenge: str, code_challenge_method: str):
    c = await s.get(OAuthClient, client_id) if client_id else None
    if c is None:
        return None, "Esta app no está registrada. Volvé a agregar el conector."
    if redirect_uri not in (c.redirect_uris or []):
        return None, "La dirección de vuelta no coincide con la registrada."
    if response_type != "code" or code_challenge_method != "S256" or not code_challenge:
        return None, "Pedido incompleto (falta PKCE S256)."
    return c, None


def _who(request: Request) -> Optional[str]:
    """El mail que firmó Cloudflare Access; en local (sin Access) vale «local»."""
    st = request.scope.get("state") or {}
    if not os.getenv("CF_ACCESS_TEAM", "").strip():
        return st.get("access_email") or "local"
    return st.get("access_email")


@router.get("/oauth/authorize")
async def authorize_page(request: Request, client_id: str = "", redirect_uri: str = "", response_type: str = "",
                         code_challenge: str = "", code_challenge_method: str = "", state: str = "",
                         s: AsyncSession = Depends(get_session)):
    c, problem = await _check_authorize(s, client_id, redirect_uri, response_type, code_challenge, code_challenge_method)
    if problem:
        return _page("No se pudo conectar", f"<h1>No se pudo conectar</h1><p>{html.escape(problem)}</p>", 400)
    email = _who(request)
    user = await resolve(None if email == "local" else email)
    if not email or email.startswith("servicio:") or user is None:
        return _page("Sin acceso", "<h1>Tu mail no tiene acceso a Studio</h1><p>Pedíselo a Coevo y volvé a conectar.</p>", 403)
    app_name = html.escape(c.name or "Claude")
    sees = "todas las marcas" if user.get("brands") is None else ("tu marca" if len(user["brands"]) == 1 else "tus marcas")
    hidden = "".join(f'<input type="hidden" name="{k}" value="{html.escape(v)}">' for k, v in {
        "client_id": client_id, "redirect_uri": redirect_uri, "code_challenge": code_challenge, "state": state,
        "csrf": _csrf(email, client_id, redirect_uri, code_challenge)}.items())
    return _page("Conectar Claude", f"""<h1>{app_name} quiere entrar a Studio con tu cuenta</h1>
<p>Vas a entrar como <b>{html.escape(email)}</b>.</p>
<p>Va a poder ver lo mismo que vos en Studio: {sees}, sus entregas y sus campañas. Nada más. Lo podés cortar cuando quieras.</p>
<form method="post" action="/oauth/authorize">{hidden}<div class="row">
<button class="go" type="submit" name="decision" value="ok">Autorizar</button>
<button class="no" type="submit" name="decision" value="no">Cancelar</button></div></form>""")


@router.post("/oauth/authorize")
async def authorize_decide(request: Request, client_id: str = Form(""), redirect_uri: str = Form(""),
                           code_challenge: str = Form(""), state: str = Form(""), csrf: str = Form(""),
                           decision: str = Form("no"), s: AsyncSession = Depends(get_session)):
    c, problem = await _check_authorize(s, client_id, redirect_uri, "code", code_challenge, "S256")
    if problem:
        return _page("No se pudo conectar", f"<h1>No se pudo conectar</h1><p>{html.escape(problem)}</p>", 400)
    email = _who(request)
    if not email or not hmac.compare_digest(csrf, _csrf(email, client_id, redirect_uri, code_challenge)):
        return _page("No se pudo conectar", "<h1>No se pudo conectar</h1><p>El pedido venció. Volvé a intentar desde Claude.</p>", 400)
    sep = "&" if "?" in redirect_uri else "?"
    if decision != "ok":
        return RedirectResponse(f"{redirect_uri}{sep}{urlencode({'error': 'access_denied', 'state': state})}", status_code=302)
    if await resolve(None if email == "local" else email) is None:
        return _page("Sin acceso", "<h1>Tu mail no tiene acceso a Studio</h1>", 403)
    code = tk.new_secret("sco_")
    s.add(OAuthCode(code_hash=tk.digest(code), client_id=c.id, email=email, redirect_uri=redirect_uri,
                    challenge=code_challenge, expires_at=tk.now() + tk.CODE_TTL))
    await s.commit()
    return RedirectResponse(f"{redirect_uri}{sep}{urlencode({'code': code, 'state': state})}", status_code=302)


# ── Token ───────────────────────────────────────────────────────────────────────────────────────

def _pkce_ok(verifier: str, challenge: str) -> bool:
    calc = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    return bool(verifier) and hmac.compare_digest(calc, challenge)


async def _issue(s: AsyncSession, client_id: str, email: str) -> JSONResponse:
    access, refresh = tk.new_secret(), tk.new_secret("str_")
    s.add(OAuthToken(client_id=client_id, email=email, access_hash=tk.digest(access), refresh_hash=tk.digest(refresh),
                     access_expires_at=tk.now() + tk.ACCESS_TTL, refresh_expires_at=tk.now() + tk.REFRESH_TTL))
    await s.commit()
    return JSONResponse({"access_token": access, "token_type": "Bearer", "expires_in": int(tk.ACCESS_TTL.total_seconds()),
                         "refresh_token": refresh, "scope": "studio"}, headers={"Cache-Control": "no-store"})


@router.post("/oauth/token")
async def token(grant_type: str = Form(""), code: str = Form(""), redirect_uri: str = Form(""),
                client_id: str = Form(""), code_verifier: str = Form(""), refresh_token: str = Form(""),
                s: AsyncSession = Depends(get_session)):
    if grant_type == "authorization_code":
        row = await s.get(OAuthCode, tk.digest(code)) if code else None
        if (row is None or row.used_at is not None or row.expires_at <= tk.now()
                or row.client_id != client_id or row.redirect_uri != redirect_uri):
            return _err("invalid_grant", "El código no sirve (vencido, usado o de otra app).")
        if not _pkce_ok(code_verifier, row.challenge):
            return _err("invalid_grant", "PKCE no coincide.")
        row.used_at = tk.now()
        email = "local" if row.email == "local" else row.email
        return await _issue(s, row.client_id, email)
    if grant_type == "refresh_token":
        t = (await s.execute(select(OAuthToken).where(OAuthToken.refresh_hash == tk.digest(refresh_token or "-")))).scalar_one_or_none()
        if t is None or t.revoked_at is not None or t.refresh_expires_at <= tk.now() or (client_id and t.client_id != client_id):
            return _err("invalid_grant", "El acceso venció o se cortó. Volvé a conectar.")
        if await resolve(None if t.email == "local" else t.email) is None:
            return _err("invalid_grant", "Tu mail ya no tiene acceso a Studio.")
        t.revoked_at = tk.now()          # el refresh rota: el viejo deja de servir
        return await _issue(s, t.client_id, t.email)
    return _err("unsupported_grant_type", "Sólo authorization_code y refresh_token.")
