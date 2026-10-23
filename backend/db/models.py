"""Tablas de la base. Cada cambio acá necesita su migración: `alembic revision --autogenerate`."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, func
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
    # interna: sólo la ve el equipo (Claude sube acá) · cliente: se la mandamos (studio-v2 §11)
    visibility: Mapped[str] = mapped_column(String(10), default="interna", server_default="interna")
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # Agrupación (studio-v2 §16): el mes sale de la fecha; la campaña y la etapa son opcionales.
    campaign_id: Mapped[Optional[str]] = mapped_column(String(40), nullable=True, index=True)
    stage: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)      # ej. "01 Fotos", "02 Video"
    # items: [{id, url, kind, label, rejected?}] — rejected = el cliente dijo «esta no»
    items: Mapped[list] = mapped_column(JSONB, default=list)
    source: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    # Versiones anteriores: [{round, items, note, sentAt, at}] — para que el cliente compare con la nueva.
    history: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
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
    # Interno = del equipo; el cliente no lo ve.
    internal: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    round: Mapped[int] = mapped_column(Integer, default=1)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    """Quién puede entrar y con qué rol (openspec/changes/studio-v2 §3). La identidad es el mail que
    firma Cloudflare Access; acá no hay contraseñas.
    admin: todo + gestiona accesos · equipo: todas las marcas · cliente: sólo sus marcas (memberships)."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: _id("us"))
    email: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    role: Mapped[str] = mapped_column(String(10), default="cliente")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    disabled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class Membership(Base):
    """Qué marcas ve un cliente, si puede aprobar (si no, sólo comenta) y si suma gente de su marca
    (el contacto principal: invita y saca a su equipo desde /cliente/personas)."""

    __tablename__ = "memberships"

    user_id: Mapped[str] = mapped_column(String(40), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    brand_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    can_approve: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    can_invite: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")


class InboxItem(Base):
    """Material que manda el cliente (studio-v2 §12 y §15): lo que tenga, como lo tenga.
    No entra directo a la marca: el equipo lo revisa y lo incorpora (a la marca o a una campaña)."""

    __tablename__ = "inbox_items"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: _id("ib"))
    brand_id: Mapped[str] = mapped_column(String(80), index=True)
    campaign_id: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    files: Mapped[list] = mapped_column(JSONB, default=list)      # [{url, name, kind: image|video|pdf|other}]
    link: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(String(4000), nullable=True)
    author: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    # nuevo → incorporado | descartado
    status: Mapped[str] = mapped_column(String(12), default="nuevo", server_default="nuevo")
    result: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)   # qué se hizo, para el cliente
    # Lo que propone el agente (services/inbox_agent.py): {status, target, why, perFile, discard} — el equipo confirma.
    proposal: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
