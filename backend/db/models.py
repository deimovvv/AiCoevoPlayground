"""Tablas de la base. Cada cambio acá necesita su migración: `alembic revision --autogenerate`."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from db import Base


def _id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


class VideoProject(Base):
    """Un video del editor, dentro de una marca. `timeline` es el mismo formato que el
    `timeline.json` de las carpetas (openspec/specs/video-editor/reference.md)."""

    __tablename__ = "video_projects"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: _id("vp"))
    brand_id: Mapped[str] = mapped_column(String(80), index=True)
    title: Mapped[str] = mapped_column(String(200), default="Video sin título")
    timeline: Mapped[dict] = mapped_column(JSONB, default=dict)
    # Sube en cada guardado: si alguien guarda sobre una versión vieja, se rechaza (409).
    version: Mapped[int] = mapped_column(Integer, default=1)
    # Cómo nació: library (biblioteca de la marca) · tool · template · folder · blank
    source: Mapped[str] = mapped_column(String(20), default="blank")
    source_ref: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
