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

- [ ] 4.1 Login y permisos por marca (antes de usuarios externos).
