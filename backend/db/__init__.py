"""
Base de datos de Coevo Studio (openspec/changes/infra-v1).

PostgreSQL vía SQLAlchemy 2.0 async (driver asyncpg). Las tablas se crean y cambian SÓLO con
migraciones de Alembic (`backend/alembic/`), nunca con `create_all`.

    DATABASE_URL=postgresql+asyncpg://usuario:clave@host:puerto/base   (backend/.env)

Sin DATABASE_URL usa el Postgres de desarrollo de `docker-compose.yml` (127.0.0.1:5433).
Los JSON de `backend/data/` siguen funcionando: cada parte se muda a la base de a una.
"""
import os
from typing import AsyncIterator, Optional

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

DEV_URL = "postgresql+asyncpg://coevo:coevo@127.0.0.1:5433/coevo_studio"


class Base(DeclarativeBase):
    pass


_engine: Optional[AsyncEngine] = None
_sessions: Optional[async_sessionmaker] = None


def database_url() -> str:
    return os.getenv("DATABASE_URL") or DEV_URL


def engine() -> AsyncEngine:
    global _engine, _sessions
    if _engine is None:
        _engine = create_async_engine(database_url(), pool_pre_ping=True)
        _sessions = async_sessionmaker(_engine, expire_on_commit=False)
    return _engine


async def get_session() -> AsyncIterator[AsyncSession]:
    """Dependencia de FastAPI: una sesión por pedido."""
    engine()
    async with _sessions() as s:  # type: ignore[misc]
        yield s
