# Studio desde Claude (claude.ai y Claude Code)

Cambio: `openspec/changes/studio-en-claude`. Qué es: cualquier persona del equipo (o un cliente) conecta su
Claude a Studio con **su login de siempre** y Claude ve lo mismo que esa persona ve en la app.

## Cómo funciona (en una línea por pieza)

- `https://app.coevoagency.com/mcp` — el conector. Sin token responde 401 y le dice a Claude dónde loguearse.
- `/oauth/authorize` — la pantalla «Autorizar». Está detrás de Cloudflare Access: entrás con Google o PIN.
- El token queda atado a tu mail; cada pedido pasa por los roles de siempre (`backend/services/roles.py`).
  Equipo ve todo; un cliente sólo su marca. El MCP no tiene permisos propios.
- Paso 1 (hoy): sólo leer — `listar_marcas`, `ver_marca`, `ver_entregas`, `ver_entrega`, `ver_campanas`,
  `ver_campana`, `ver_poses`. El MCP local (Claude Code con la llave) sigue con todas.
- Piezas: `backend/routers/oauth.py` (login), `backend/routers/mcp_remote.py` (`/mcp`),
  `backend/services/oauth.py` (tokens), `mcp/coevo-studio/http.mjs` (el MCP por HTTP; herramientas en `tools.mjs`).

## Lo que hace Gonzalo una sola vez: abrir las rutas del conector en Cloudflare

claude.ai llama desde la nube de Anthropic y no puede pasar el login de Cloudflare. Hay que dejar pasar
**sólo** estas rutas (ninguna devuelve datos sin token; la app las vuelve a trabar sola):

1. Cloudflare → **Zero Trust** → **Access** → **Applications** → **Add an application** → **Self-hosted**.
2. Nombre: `Studio · conector Claude`.
3. En **Public hostname** agregar una línea por ruta, todas con el dominio `app.coevoagency.com`:
   - `mcp`
   - `oauth/token`
   - `oauth/register`
   - `.well-known/oauth-authorization-server`
   - `.well-known/oauth-protected-resource`
4. **Policy** → nombre `Abierto, lo traba la app` → **Action: Bypass** → Include: **Everyone**.
5. Guardar. **No** agregar `oauth/authorize`: esa queda con el login.

Para comprobar (desde cualquier compu, sin login):
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://app.coevoagency.com/.well-known/oauth-authorization-server   # 200
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://app.coevoagency.com/mcp                              # 401
curl -s -o /dev/null -w "%{http_code}\n" https://app.coevoagency.com/api/brands                               # 302 (sigue con login)
```

> A verificar en el primer intento: que Cloudflare tome la regla más específica (la ruta) por encima de
> la app general de `app.coevoagency.com`. Si el `curl` de `/mcp` da 302, avisar.

## Conectar claude.ai

1. claude.ai → **Configuración** → **Conectores** → **Agregar conector personalizado**.
2. Nombre `Coevo Studio`, URL `https://app.coevoagency.com/mcp`. Sin client id ni secreto (se registra solo).
3. **Conectar** → se abre Studio → entrás → **Autorizar**.
4. Probar en un chat: «¿Qué marcas tengo en Studio?» y «¿Qué dice la memoria de ALGÜNA sobre la voz?».

En el plan Team lo agrega el dueño una vez y cada persona hace sólo el paso 3.

## Conectar Claude Code (opcional; el local de siempre sigue andando)

```bash
claude mcp add --transport http coevo-studio-web https://app.coevoagency.com/mcp
# dentro de Claude Code: /mcp → coevo-studio-web → autenticar (abre el navegador)
```

## Probar en local

```bash
./dev.sh backend                                   # o uvicorn en :8001 si el 8000 está ocupado
cd mcp/coevo-studio && MCP_PORT=3011 STUDIO_API_URL=http://127.0.0.1:8001 node http.mjs
cd backend && MCP_UPSTREAM=http://127.0.0.1:3011 ...  # la API tiene que saber dónde está el MCP
.venv/bin/python scripts/probar_conector.py        # 17 chequeos: registro, autorizar, PKCE, token, MCP, refresh
```

## Cortar un acceso

Hasta que esté Ajustes → «Claude conectado» (paso 4): en la base, `UPDATE oauth_tokens SET revoked_at = now()
WHERE email = '…';`. Si una persona pierde el acceso a Studio, el token deja de servir solo al renovar (1 h).
