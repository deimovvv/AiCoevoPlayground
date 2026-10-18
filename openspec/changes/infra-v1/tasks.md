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

- [x] 4.1 **(hecho 2026-10-17: Access con PIN por mail + el backend verifica el JWT, `services/access_guard.py`)** **PRIMERO, antes de exponer nada** (hay datos reales de clientes): Cloudflare Access (login con Google)
      delante de app y API. El túnel no se publica sin esto. Confirmar el límite gratis.
- [ ] 4.2 ~~Clientes con cuenta propia: Supabase Auth o Clerk~~ → reemplazado por roles sobre Access (`changes/studio-v2`).
- [ ] 4.4 Abrir sólo `/portal/*` y `/api/portal/*` por fuera de Access (el token del link es la llave) mientras existan links de portal.
- [ ] 4.5 Backups de la base y de `backend/data/` a R2 (hoy quedan en el mismo VPS).
- [ ] 4.3 **Token de servicio de Cloudflare Access** para Claude Code, scripts y skills: que Claude escriba
      directo en los proyectos del servidor (`PUT /api/video-projects/{id}` con versión), no sólo "subir".
      Es lo que cierra "todo nace como skill y vive en la app" (pedido de la otra sesión, 2026-10-16).

## 5. Producción (design.md: ≈ US$10–17/mes)

- [x] 5.0 Servidor: **Hostinger VPS KVM 2** (decidido 2026-10-13). El plan actual del usuario es hosting compartido → contratar el VPS aparte. Cuenta de Coevo.
- [x] 5.1 `Dockerfile` (Python 3.11 + FFmpeg + Node/Remotion + OpenCV): probado en local, graba textos en el contenedor.
- [x] 5.2 **Servidor andando (2026-10-16)**: Hostinger KVM 2 (Ubuntu 26.04, IP 2.24.88.211, usuario `coevo`, plan de
      1 mes para probar). Sólo SSH con llave (root y contraseña bloqueados), firewall (sólo SSH), fail2ban,
      actualizaciones automáticas, Docker 29 + 4 GB swap. Repo con deploy key de sólo lectura. api + db + backup
      diario arriba; 3,5 GB de datos subidos (sin backups viejos). Probado por túnel SSH privado: dashboard, editor
      de un run real y export con trabajos de fondo. **Nada publicado todavía** (falta 4.1). Backups a R2: con Cloudflare.
- [x] 5.3 Frontend: lo sirve el backend desde la MISMA dirección (`Dockerfile` lo compila; `main.py` al final),
      un solo login de Cloudflare protege todo. La dirección del backend también es configurable (`VITE_API_BASE`, `lib/config.ts`; 23 archivos tenían
      `127.0.0.1:8000` escrito a mano). Falta el dominio.
- [x] 5.4 Licencia de Remotion verificada: gratis hasta 3 empleados; si no, US$0,01/render con mínimo US$100/mes →
      reemplazar el render de textos antes de que el equipo pase de 3.
- [ ] 5.5 Claude no corre en producción (no se paga API de Anthropic): trabaja en la Mac con su suscripción y
      escribe en el servidor con el token de 4.3. El "subir a la marca" queda sólo para material local suelto.
- [x] 5.6 Pasos largos como trabajos de fondo (`services/jobs.py`, `POST /api/jobs/{tipo}`): pegar clips, textos,
      música, revisión y export de proyectos. Cloudflare corta los pedidos de más de ~100 s.
      Probado en el contenedor: export completo de un run, sin errores.
- [x] 5.7 `GET /api/health` (la raíz "/" es del frontend).
- [x] 5.8 Auditoría de rutas que esperan > 100 s dentro del pedido (2026-10-16). Generación con Kling, Seedance y
      Fal: ya responde enseguida y el navegador pregunta (sin cambios). Pasadas a trabajos de fondo:
      `/api/flux3/result` (esperaba hasta 10 min), `/api/analyze/video` y `/api/analyze/motion` (`?async=1`).
- [ ] 5.9 Antes de publicar: esconder las tools sin uso (`registry.json`) — lo hace la otra sesión.
- [ ] 5.10 El criterio como datos que sirve el servidor (poses, bloques de prompt, reglas), así skills y app
      leen lo mismo.

## Después (no bloquea el deploy)

- Mudar los 5 GB de `backend/data/` a R2.

