# Tareas — studio-en-claude

## 1 · Leer, con login
- [x] 1.1 (2026-11-24) Tablas `oauth_clients`, `oauth_codes`, `oauth_tokens` (token con hash, mail, vence, último uso, cortado) — modelo + alembic
- [x] 1.2 (2026-11-24) `backend/routers/oauth.py`: `/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server`, `/oauth/register` (registro dinámico), `/oauth/authorize` (detrás de Access: pantalla «Autorizar»), `/oauth/token` (código con PKCE S256 y refresh)
- [x] 1.3 (2026-11-24) `access_guard.py`: las rutas abiertas de OAuth y `/mcp` pasan sin JWT de Access; `/mcp` exige Bearer válido y deja el mail del token en `scope.state` → `RoleGuard` aplica los roles de siempre
- [x] 1.4 (2026-11-24) MCP: separar las herramientas en `tools.mjs` (las usan el local y el remoto); `http.mjs` con Streamable HTTP que reenvía el Bearer a la API
- [x] 1.5 (2026-11-24) Servir el MCP: contenedor `mcp` en `docker-compose.prod.yml` (`mcp/coevo-studio/Dockerfile`) y `/mcp` en la API que lo reenvía (sin tocar el túnel). Sin sesión: cada pedido arma su servidor, respuestas JSON
- [x] 1.6 (2026-11-24) Pruebas: sin token → 401 y ningún dato; token de cliente → sólo sus marcas; token cortado → 401. `backend/scripts/probar_conector.py` (17 chequeos), más cliente aislado (MCP y API directa, no escribe) y modo producción con Access (`/api`, `/oauth/authorize` y `/dashboard` siguen en 403; descubrimiento 200; `/mcp` 401)
- [x] 1.7 (2026-11-24) Guía para Gonzalo: regla Bypass en Cloudflare Access y agregar el conector en claude.ai (`docs/guias/studio-en-claude.md`)
- [x] 1.8a Deploy (2026-11-24, backup `~/backups/pre-studio-en-claude-20261124-1248.sql.gz`): API, migración y contenedor `mcp` arriba; afuera `/mcp` 401, descubrimiento 200, `/api` 302
- [ ] 1.8b Gonzalo suma `oauth/authorize` a la app de Access de Studio (guía) → y prueba real: Gonzalo pregunta por ALGÜNA desde claude.ai; después Keyla

## 2 · Links de cada marca
- [ ] 2.1 Tipo «estrategia/system» en Archivos (`backend/main.py:146`)
- [ ] 2.2 `ver_links` y `guardar_link` (actualiza si coincide url o título), en el local y el remoto
- [ ] 2.3 Pasar los 20 links de `morph-site/LINKS.md` y avisar a autopoiesis

## 3 · Escribir (sólo equipo)
- [ ] 3.1 Herramientas de escritura en el remoto, bloqueadas para clientes
- [ ] 3.2 `bajar_archivo` → en el remoto, links firmados por un rato

## 4 · Accesos
- [ ] 4.1 Ajustes → «Claude conectado»: quién, último uso, «Cortar»
- [ ] 4.2 Apagar el token de servicio donde ya no haga falta
