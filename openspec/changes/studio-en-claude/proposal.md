# studio-en-claude — Studio desde cualquier Claude, con el login de cada uno

**Estado:** propuesto (2026-11-22). Gonzalo dio el OK para arrancar («vamos de a pasos, pero re bien»).
Resuelve los avisos del 2026-11-09 (MCP sólo local, urgente) y del 2026-11-20 (links de cada marca).

## Por qué

La memoria de cada marca vive en Studio, pero hoy sólo la lee **Claude Code en una compu que tenga la
llave**: `mcp/coevo-studio/server.mjs` corre local (stdio) con un token de servicio de Cloudflare Access
que ve **todas** las marcas como «equipo». Pasa esto:

- Keyla arma carruseles de ALGÜNA en claude.ai y no tiene de dónde sacar la voz, la identidad ni las reglas.
- Un cliente no puede preguntarle a su Claude «¿qué tengo para aprobar?».
- Cada sesión publica links (informes, systems, propuestas) y nadie los anota: se pierden.

## Qué cambia

**Un solo Studio, al que se conecta cualquier Claude.**

| Dónde | Para qué | Cómo se conecta |
|---|---|---|
| claude.ai (web, desktop) | Escribir, armar carruseles, leer la marca, revisar entregas | Conector personalizado `https://app.coevoagency.com/mcp`; cada uno entra con su login de Studio |
| Claude Code (compu) | Construir: webs, Studio, scripts, video | El mismo conector (`claude mcp add --transport http`) o, mientras tanto, el MCP local de siempre |
| Claude Code web (claude.ai/code) | Claude Code sin instalar, sobre un repo de GitHub | Usa los conectores de claude.ai de cada uno |

1. **El MCP se publica por HTTP** en `app.coevoagency.com/mcp` (Streamable HTTP), con las mismas
   herramientas que el local, escritas una sola vez (`studio.mjs` + `tools.mjs`); el local (stdio) sigue
   andando para quien ya lo usa.
2. **Login con OAuth, usando el login que ya existe.** Studio hace de servidor OAuth chico
   (registro dinámico, PKCE). Al conectar, claude.ai abre `app.coevoagency.com/oauth/authorize`, que
   está detrás de Cloudflare Access: la persona entra como siempre (Google o PIN por mail), ve
   «Claude quiere ver tus marcas en Studio» y autoriza. El token queda atado a **su mail**.
3. **Los roles de siempre** (`services/roles.py`): cada llamada del MCP pasa por los mismos permisos que
   la app. Equipo ve todo; un cliente ve sólo sus marcas y sólo lo que ya puede ver en la pantalla.
   No hay permisos nuevos que mantener.
4. **Links de cada marca** (aviso del 20/11): `ver_links(marca)` y `guardar_link(marca, titulo, url,
   tipo, cliente=false)`, que **actualiza si ya existe la misma url o el mismo título** (un documento,
   un link). Se guardan en Marca → Archivos; se suma el tipo «estrategia/system».
5. **Ver y cortar accesos**: en Ajustes, quién conectó Claude, cuándo lo usó por última vez, y «Cortar».

## Por pasos (cada uno se prueba antes del siguiente)

1. **Leer, con login** — `listar_marcas`, `ver_marca`, `ver_entregas`, `ver_entrega`, `ver_campanas`,
   `ver_campana`, `ver_poses`. Prueba: Gonzalo conecta claude.ai y le pregunta por ALGÜNA; después Keyla.
2. **Links** — `ver_links` y `guardar_link`, en el remoto y en el local. Se pasan los 20 links de Morph.
3. **Escribir** (sólo equipo) — subir entrega, nueva ronda, ficha, resolver comentarios, renombrar.
4. **Ajustes → Claude conectado** y apagar el token de servicio donde ya no haga falta.

## Qué NO cambia

- La app, sus pantallas y su login. Cloudflare Access sigue delante de todo lo demás.
- El MCP local sigue andando (stdio + token de servicio) hasta que todos usen el remoto.
- Generar imagen y video **no** entra acá: es el paso siguiente (Studio genera del lado del servidor
  con sus llaves, y el conector lo ofrece), así nadie necesita llaves en su compu ni en claude.ai.
- `bajar_archivo` queda sólo en el local (en claude.ai no hay disco): el remoto da links.

## Lo que hay que tocar fuera del código (lo hace Gonzalo, con guía paso a paso)

- **Cloudflare Access** (corregido el 24/11, medido en producción): la app de Access cubre rutas, no el
  dominio entero, así que `/mcp`, `/oauth/token`, `/oauth/register` y `/.well-known/oauth-*` ya llegan
  abiertas (y Studio las traba con su token). Lo que hay que hacer es **sumar `oauth/authorize`** a la app
  de Access de Studio, para que ahí entre la persona con su login.
- **claude.ai:** agregar el conector (en el plan Team lo agrega el dueño una vez y cada uno se loguea).

## Riesgos

- **Abrir rutas en Access.** Mitigación: la app las vuelve a trabar sola (como `access_guard.py` hoy):
  `/mcp` sin token válido → 401; los tokens se guardan con hash, vencen (1 h, con refresh de 30 días)
  y se cortan desde Ajustes. Pruebas automáticas de que sin token no sale ningún dato.
- **Que un cliente vea de más.** Mitigación: el MCP no tiene permisos propios; pasa por `RoleGuard` con el
  mail del token. Prueba con un usuario cliente antes de abrirlo a clientes.
- **Algo de claude.ai que no esté documentado** (transporte exacto, la app del celular). Mitigación:
  el paso 1 se prueba con Gonzalo antes de contárselo al equipo.

## Verificado (2026-11-18, documentación oficial)

- claude.ai acepta MCP remotos con OAuth como conector personalizado (Free con uno; Pro, Max, Team,
  Enterprise). En Team lo agrega el dueño y cada usuario se conecta con su cuenta.
  support.claude.com/en/articles/11175166
- Claude Code: `claude mcp add --transport http`, con OAuth, o `.mcp.json` en el repo. code.claude.com/docs/en/mcp
- Claude Code web usa los conectores de claude.ai. code.claude.com/docs/en/claude-code-on-the-web
- **Sin confirmar:** si el conector se agrega desde la app del celular.
