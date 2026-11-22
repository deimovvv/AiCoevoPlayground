# Tareas — studio-en-claude

## 1 · Leer, con login
- [ ] 1.1 Tablas `oauth_clients`, `oauth_codes`, `oauth_tokens` (token con hash, mail, vence, último uso, cortado) — modelo + alembic
- [ ] 1.2 `backend/routers/oauth.py`: `/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server`, `/oauth/register` (registro dinámico), `/oauth/authorize` (detrás de Access: pantalla «Autorizar»), `/oauth/token` (código con PKCE S256 y refresh)
- [ ] 1.3 `access_guard.py`: las rutas abiertas de OAuth y `/mcp` pasan sin JWT de Access; `/mcp` exige Bearer válido y deja el mail del token en `scope.state` → `RoleGuard` aplica los roles de siempre
- [ ] 1.4 MCP: separar las herramientas en `tools.mjs` (las usan el local y el remoto); `http.mjs` con Streamable HTTP que reenvía el Bearer a la API
- [ ] 1.5 Servir el MCP: contenedor `mcp` en `docker-compose.prod.yml` y `/mcp` en la API que lo reenvía (sin tocar el túnel)
- [ ] 1.6 Pruebas: sin token → 401 y ningún dato; token de cliente → sólo sus marcas; token cortado → 401
- [ ] 1.7 Guía para Gonzalo: regla Bypass en Cloudflare Access y agregar el conector en claude.ai (`docs/guias/studio-en-claude.md`)
- [ ] 1.8 Deploy (con OK) y prueba real: Gonzalo pregunta por ALGÜNA desde claude.ai; después Keyla

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
