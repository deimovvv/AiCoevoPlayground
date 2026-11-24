"""
`/mcp`: el MCP de Studio para claude.ai y Claude Code (openspec/changes/studio-en-claude, paso 1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Las herramientas viven en Node (`mcp/coevo-studio/http.mjs`, mismas que el MCP local). La API sólo:
- sin token válido → 401 con la dirección del login (así Claude abre «Autorizar»);
- con token → reenvía el pedido tal cual al MCP, que llama a la API con ese mismo token, y `roles.py`
  decide qué ve esa persona. El MCP no tiene permisos propios.

No hace falta tocar el túnel de Cloudflare: todo entra por la API. `MCP_UPSTREAM` dice dónde corre el
Node (en producción, el contenedor `mcp`; en local, `http://127.0.0.1:3001`).
"""

import os

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response

from routers.oauth import public_base

router = APIRouter()
UPSTREAM = os.getenv("MCP_UPSTREAM", "http://127.0.0.1:3001").rstrip("/")
_PASS = ("content-type", "accept", "authorization", "mcp-protocol-version", "mcp-session-id", "last-event-id")


def _unauthorized(request: Request) -> JSONResponse:
    meta = f"{public_base(request)}/.well-known/oauth-protected-resource"
    return JSONResponse({"detail": "Conectá Claude con tu cuenta de Studio."}, status_code=401,
                        headers={"WWW-Authenticate": f'Bearer resource_metadata="{meta}"'})


@router.api_route("/mcp", methods=["GET", "POST", "DELETE"])
async def mcp(request: Request):
    # AccessGuard ya validó el token si vino uno; si no vino, acá se corta.
    if not (request.scope.get("state") or {}).get("via_token"):
        return _unauthorized(request)
    headers = {k: v for k, v in request.headers.items() if k.lower() in _PASS}
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.request(request.method, f"{UPSTREAM}/mcp", content=await request.body(), headers=headers)
    except httpx.HTTPError:
        return JSONResponse({"detail": "El MCP de Studio no está respondiendo."}, status_code=502)
    out = {k: v for k, v in r.headers.items() if k.lower() in ("content-type", "mcp-session-id", "cache-control")}
    return Response(content=r.content, status_code=r.status_code, headers=out)
