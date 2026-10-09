"""
Proyectos de video por marca, en la base (openspec/changes/infra-v1 · video-editor-next).

El `timeline` es el mismo formato que `timeline.json` (openspec/specs/video-editor/reference.md).
Guardar exige la `version` con la que se abrió: si otro guardó antes, 409 y no se pisa.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from db.models import VideoProject
from services import brands

router = APIRouter(tags=["video-projects"])
SOURCES = {"blank", "library", "tool", "template", "folder"}


def _summary(p: VideoProject) -> dict:
    segs = (p.timeline or {}).get("segments") or []
    return {
        "id": p.id, "brandId": p.brand_id, "title": p.title, "version": p.version,
        "source": p.source, "sourceRef": p.source_ref, "segments": len(segs),
        "createdAt": p.created_at.isoformat() if p.created_at else None,
        "updatedAt": p.updated_at.isoformat() if p.updated_at else None,
    }


def _full(p: VideoProject) -> dict:
    return {**_summary(p), "timeline": p.timeline}


def _require_brand(brand_id: str) -> dict:
    b = brands.find_brand(brands.load_brands(), brand_id)
    if not b:
        raise HTTPException(status_code=404, detail=f"No existe la marca {brand_id}")
    return b


@router.get("/api/brands/{brand_id}/video-projects")
async def list_projects(brand_id: str, s: AsyncSession = Depends(get_session)):
    _require_brand(brand_id)
    rows = (await s.execute(
        select(VideoProject).where(VideoProject.brand_id == brand_id).order_by(VideoProject.updated_at.desc())
    )).scalars().all()
    return [_summary(p) for p in rows]


class ProjectCreate(BaseModel):
    title: Optional[str] = None
    timeline: Optional[dict] = None
    source: str = "blank"
    source_ref: Optional[str] = None


@router.post("/api/brands/{brand_id}/video-projects")
async def create_project(brand_id: str, req: ProjectCreate, s: AsyncSession = Depends(get_session)):
    brand = _require_brand(brand_id)
    if req.source not in SOURCES:
        raise HTTPException(status_code=400, detail=f"source inválido: {req.source}")
    timeline = req.timeline or {"version": 1, "width": 1080, "height": 1920, "fps": 30, "segments": [], "texts": [], "music": None}
    p = VideoProject(
        brand_id=brand_id, title=req.title or f"Video de {brand.get('name', brand_id)}",
        timeline=timeline, source=req.source, source_ref=req.source_ref,
    )
    s.add(p)
    await s.commit()
    await s.refresh(p)
    return _full(p)


async def _get(s: AsyncSession, project_id: str) -> VideoProject:
    p = await s.get(VideoProject, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="No existe el proyecto")
    return p


@router.get("/api/video-projects/{project_id}")
async def get_project(project_id: str, s: AsyncSession = Depends(get_session)):
    return _full(await _get(s, project_id))


class ProjectSave(BaseModel):
    version: int
    timeline: Optional[dict] = None
    title: Optional[str] = None


@router.put("/api/video-projects/{project_id}")
async def save_project(project_id: str, req: ProjectSave, s: AsyncSession = Depends(get_session)):
    values = {"version": VideoProject.version + 1}
    if req.timeline is not None:
        values["timeline"] = req.timeline
    if req.title is not None:
        values["title"] = req.title
    # Un solo UPDATE condicionado a la versión: dos guardados a la vez no se pisan.
    res = await s.execute(
        update(VideoProject)
        .where(VideoProject.id == project_id, VideoProject.version == req.version)
        .values(**values)
        .returning(VideoProject.id)
    )
    if res.scalar_one_or_none() is None:
        await s.rollback()
        current = await s.get(VideoProject, project_id)
        if not current:
            raise HTTPException(status_code=404, detail="No existe el proyecto")
        raise HTTPException(status_code=409, detail=f"conflicto: el proyecto ya va por la versión {current.version}. Recargá antes de guardar.")
    await s.commit()
    return _full(await _get(s, project_id))


@router.delete("/api/video-projects/{project_id}")
async def delete_project(project_id: str, s: AsyncSession = Depends(get_session)):
    res = await s.execute(delete(VideoProject).where(VideoProject.id == project_id).returning(VideoProject.id))
    if res.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="No existe el proyecto")
    await s.commit()
    return {"deleted": project_id}
