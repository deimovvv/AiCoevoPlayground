"""Tablas de la base. Cada cambio acá necesita su migración: `alembic revision --autogenerate`."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, func
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


class Delivery(Base):
    """Una entrega a la marca: un carrusel, un video, imágenes (openspec/changes/studio-v2 P.3).

    `items` son las láminas en orden: [{id, url, kind: image|video, label}]. `source` es la fuente
    editable (ej. el HTML del carrusel) para que Claude corrija sobre la misma pieza. Cada vez que
    se reemplazan las láminas sube `round`: los comentarios quedan atados a la ronda que vieron.
    """

    __tablename__ = "deliveries"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: _id("dl"))
    brand_id: Mapped[str] = mapped_column(String(80), index=True)
    title: Mapped[str] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(String(20), default="carrusel")      # carrusel · video · imagenes
    # en_revision → cambios (alguien pidió cambios) → en_revision (nueva ronda) → aprobada
    status: Mapped[str] = mapped_column(String(20), default="en_revision")
    items: Mapped[list] = mapped_column(JSONB, default=list)
    source: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    template: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    round: Mapped[int] = mapped_column(Integer, default=1)
    created_by: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    approved_by: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class DeliveryComment(Base):
    """Un comentario sobre una lámina, opcionalmente anclado a un punto (x, y de 0 a 1)."""

    __tablename__ = "delivery_comments"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: _id("dc"))
    delivery_id: Mapped[str] = mapped_column(String(40), ForeignKey("deliveries.id", ondelete="CASCADE"), index=True)
    item_id: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)   # sin lámina = sobre toda la entrega
    x: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    y: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    text: Mapped[str] = mapped_column(String(4000))
    author: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    round: Mapped[int] = mapped_column(Integer, default=1)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
