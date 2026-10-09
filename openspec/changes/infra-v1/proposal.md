## Why

Tres cosas que el usuario quiere piden el mismo salto: videos guardados por marca en el
servidor, métricas que se actualizan solas (Postiz) y que otras personas usen la app.
Hoy todo son archivos JSON en `backend/data/` (5 GB con los medios) y no hay usuarios.

> *"Empecemos, sí, quiero empezar, recontra."* (usuario, 2026-10-09)

## What Changes

**Stack (decidido 2026-10-09):**

| Pieza | Elección | Por qué |
|---|---|---|
| API | **FastAPI** (se queda) | ya son 6.500 líneas + 43 servicios; maneja bien esperar a Fal/kie/ElevenLabs. Pasar a Flask (como Google-App) es reescribir sin ganar nada |
| Base de datos | **PostgreSQL** | la estándar; JSON flexible (`jsonb`) para `timeline.json`, y tablas para lo demás |
| Acceso a la base | **SQLAlchemy 2.0** (async, driver asyncpg) | el mismo que usa Google-App, independiente del framework |
| Migraciones | **Alembic** | versiona los cambios de tablas (lo que Flask-Migrate envuelve en Google-App) |
| Archivos | **Cloudflare R2** en producción, disco local en desarrollo | la salida de datos (cada vez que alguien mira un video) es **gratis** en R2; en Google Cloud Storage cuesta ~$0.12/GB. Coevo sirve video todo el día |
| Desarrollo local | Postgres 16 en Docker (`docker-compose.yml`, puerto 5433) | sin instalar nada en la Mac |
| Producción | a decidir (Cloud Run + Cloud SQL en un proyecto de GCP **de Coevo**, o similar) | nunca el proyecto de Monks |

**Orden — migrar de a una, nada de golpe:**
1. Base + migraciones + primera tabla: **proyectos de video por marca** (su `timeline.json`).
2. "Nuevo video" en la UI, guardando en la base.
3. Capa de archivos (local → R2) para lo nuevo; los 5 GB actuales se mudan después.
4. Usuarios y login, antes de que entre alguien de afuera.
5. Tablas de métricas + sincronización diaria (Postiz).
6. Marcas, generaciones y campañas pasan de JSON a la base, una por vez.

## Capabilities

### New Capabilities
- `data-platform`: base de datos, migraciones y almacenamiento de archivos.

## Impact

- `backend/db/` (motor, modelos), `backend/alembic/`, `docker-compose.yml`.
- `DATABASE_URL` en `backend/.env` (desarrollo: el Postgres de Docker).
- Los JSON siguen funcionando hasta que cada parte se migre.
