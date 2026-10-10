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

## 5. Producción (design.md: ≈ US$26/mes)

- [ ] 5.0 Decidir: DigitalOcean (US$24) o Hetzner (€19,49). Cuentas a nombre de Coevo.
- [ ] 5.1 Imagen Docker del backend (FastAPI + FFmpeg + Node/Remotion).
- [ ] 5.2 Servidor con Docker Compose: API + Postgres + tarea diaria; backups diarios a R2.
- [ ] 5.3 Frontend en Cloudflare Pages; dominio propio.
- [ ] 5.4 Verificar la licencia de Remotion para el tamaño del equipo (si es paga: HyperFrames).
- [ ] 5.5 Claude no corre en producción: subir proyectos locales a la marca (puente) en vez de llamar a la API.
