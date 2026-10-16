# Producción — Hostinger VPS + Cloudflare

Decisión y números: `openspec/changes/infra-v1/design.md`. Esto es el paso a paso.

```
 Cloudflare Access ─ login del equipo con Google (gratis, a confirmar hasta 50)
 Cloudflare Tunnel ─ HTTPS sin abrir puertos
        │
 Hostinger VPS KVM 2 (2 vCPU · 8 GB) ─ docker-compose.prod.yml
   api (FastAPI + FFmpeg + Remotion, y el frontend en la misma dirección)
   db (Postgres 16) · backup diario
        │
 Cloudflare R2 ── videos y backups (a mudar)
```

## Lo que hace el usuario (compras y cuentas, todo a nombre de Coevo)

1. Hostinger → Dev tools → VPS → **KVM 2**, Ubuntu 24.04.
2. Comprar el dominio (ej. `coevo-studio.com`).
3. Cuenta de **Cloudflare** de Coevo; pasar el dominio a Cloudflare (nameservers).
4. Pegar en el panel del VPS la **llave SSH pública** que genera Claude en la Mac.

## Lo que hace Claude (con acceso SSH)

1. En el VPS: Docker, firewall (sólo SSH), usuario sin root, actualizaciones automáticas.
2. Clonar el repo y crear **directo en el servidor** (nunca en git):
   - `backend/.env`: las keys de la app (Fal, kie, ElevenLabs, Gemini de Coevo…).
   - `.env` en la raíz: `DB_PASSWORD` y `CLOUDFLARE_TUNNEL_TOKEN` (los lee Docker Compose).
3. `docker compose -f docker-compose.prod.yml up -d --build` → api + db + backup.
4. Copiar `backend/data/` (5 GB) al servidor (`rsync`), hasta mudarlo a R2.
5. Cloudflare: crear el túnel, `CLOUDFLARE_TUNNEL_TOKEN` en el `.env`,
   `docker compose -f docker-compose.prod.yml --profile tunnel up -d`.
6. Cloudflare Access: permitir sólo los mails del equipo, para la app y la API.
7. El frontend no va aparte: viene compilado en la imagen y lo sirve la API (una sola dirección).

## Verificado en local (2026-10-13)

La imagen (`Dockerfile`, 1,6 GB) arranca, aplica migraciones, tiene FFmpeg 5.1, Node 18,
OpenCV y el modelo de caras, y **graba textos con Remotion** (12 s un clip de 4 s, con la
tipografía de la marca).

## Licencia de Remotion — decidir antes de que el equipo pase de 3

Gratis para empresas de **hasta 3 empleados** (LICENSE.md de Remotion). Si no: plan
"Automators" (render automático desde el servidor) = **US$0,01 por render, mínimo US$100/mes**.
Alternativa sin costo: grabar los textos con Chromium + FFmpeg directo (el `TextLayer` es React
común) o HyperFrames (Apache 2.0).

## Estado (2026-10-16)

Servidor `srv2067398.hstgr.cloud` (2.24.88.211), usuario `coevo`, llave `~/.ssh/coevo_vps` en la Mac de Gonzalo.
App en `~/coevo-studio`. Entrar: `ssh -i ~/.ssh/coevo_vps coevo@2.24.88.211`. Probar sin publicar:
`ssh -i ~/.ssh/coevo_vps -N -L 8020:127.0.0.1:8000 coevo@2.24.88.211` y abrir http://localhost:8020.
Falta: Cloudflare (dominio, túnel, Access).

## Operación

- Actualizar: `git pull && docker compose -f docker-compose.prod.yml up -d --build`.
- Backups: `./backups/` (14 días). Restaurar: `gunzip -c archivo | docker compose exec -T db psql -U coevo coevo_studio`.
- Logs: `docker compose -f docker-compose.prod.yml logs -f api`.
