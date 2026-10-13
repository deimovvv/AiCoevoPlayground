## 1. Base

- [x] 1.1 Postgres 16 en Docker (`docker-compose.yml`, 127.0.0.1:5433); `dev.sh` lo levanta.
- [x] 1.2 SQLAlchemy 2.0.48 async + asyncpg 0.30 + Alembic 1.16, fijadas en requirements.txt.
- [x] 1.3 Primera tabla `video_projects` (migración `28e004089ec4`).
- [x] 1.4 `routers/video_projects.py`: listar / crear / leer / guardar (409 si la versión es vieja) / borrar.

## 2. Nuevo video

- [ ] 2.1 "Nuevo video" en la marca: elegir material de Contenido y Brand Kit.
- [ ] 2.2 El editor abre y guarda proyectos de la base (además de carpetas locales).

## 3. Archivos

- [ ] 3.1 Capa de almacenamiento: disco local (dev) / R2 (prod).
- [ ] 3.2 Mudar `backend/data/` (5 GB) — después.

## 4. Usuarios

- [ ] 4.1 Equipo: Cloudflare Access (login con Google) delante de app y API. Confirmar el límite gratis.
- [ ] 4.2 Clientes con cuenta propia (portal): Supabase Auth o Clerk — después.

## 5. Producción (design.md: ≈ US$10–17/mes)

- [x] 5.0 Servidor: **Hostinger VPS KVM 2** (decidido 2026-10-13). El plan actual del usuario es hosting compartido → contratar el VPS aparte. Cuenta de Coevo.
- [x] 5.1 `Dockerfile` (Python 3.11 + FFmpeg + Node/Remotion + OpenCV): probado en local, graba textos en el contenedor.
- [~] 5.2 `docker-compose.prod.yml` (api + db + backup diario + túnel de Cloudflare) listo; falta el VPS. Backups a R2: cuando exista Cloudflare.
- [~] 5.3 Frontend: la dirección del backend ya es configurable (`VITE_API_BASE`, `lib/config.ts`; 23 archivos tenían
      `127.0.0.1:8000` escrito a mano). Falta Cloudflare Pages + dominio.
- [x] 5.4 Licencia de Remotion verificada: gratis hasta 3 empleados; si no, US$0,01/render con mínimo US$100/mes →
      reemplazar el render de textos antes de que el equipo pase de 3.
- [ ] 5.5 Claude no corre en producción: subir proyectos locales a la marca (puente) en vez de llamar a la API.
