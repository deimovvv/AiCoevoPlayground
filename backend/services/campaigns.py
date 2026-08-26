"""
Campaigns Service
━━━━━━━━━━━━━━━━━
Almacenamiento JSON de Campañas (contenedor por marca para trabajar contenido de punta a
punta). Espeja el patrón de brands.py. Ver docs/campaigns.md.

Una Campaña agrupa: settings (producto + refs + formato) + las piezas generadas + estado.
La generación en sí la hacen las tools/Lab existentes; acá solo se organiza.
"""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

DATA_DIR = Path(__file__).parent.parent / "data"
CAMPAIGNS_FILE = DATA_DIR / "campaigns.json"

DATA_DIR.mkdir(exist_ok=True)

# Estados del ciclo de vida de una campaña.
STATUSES = ("draft", "generating", "review", "approved")


def load_campaigns() -> List[dict]:
    if not CAMPAIGNS_FILE.exists():
        return []
    try:
        with open(CAMPAIGNS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception:
        return []


def save_campaigns(campaigns: List[dict]) -> None:
    with open(CAMPAIGNS_FILE, "w", encoding="utf-8") as f:
        json.dump(campaigns, f, indent=2, ensure_ascii=False)


def find_campaign(campaigns: List[dict], campaign_id: str) -> Optional[dict]:
    return next((c for c in campaigns if c.get("id") == campaign_id), None)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_campaign(payload: dict) -> dict:
    """Arma una campaña nueva con defaults sanos a partir del payload del form."""
    return {
        "id": f"camp_{uuid.uuid4().hex[:12]}",
        "brandId": payload.get("brandId", ""),
        "name": (payload.get("name") or "Campaña sin nombre").strip(),
        "brief": payload.get("brief", ""),
        "productIds": payload.get("productIds", []) or [],
        "moodboardId": payload.get("moodboardId"),
        "poseId": payload.get("poseId"),
        # Más assets de la marca que la campaña puede usar como refs.
        "avatarId": payload.get("avatarId"),
        "clothingIds": payload.get("clothingIds", []) or [],
        "backgroundId": payload.get("backgroundId"),
        "lookFeelId": payload.get("lookFeelId"),
        # "ai" = la IA decide el shot list · "manual" = estilos elegidos por el usuario.
        "shotPlan": payload.get("shotPlan", "ai"),
        "customShots": payload.get("customShots", []) or [],
        "variationsPerShot": max(1, min(4, int(payload.get("variationsPerShot", 1) or 1))),
        "aspectRatios": payload.get("aspectRatios", ["9:16"]) or ["9:16"],
        "resolution": payload.get("resolution", "2K"),
        "status": "draft",
        # De dónde vino el pedido: "agency" (lo cargamos nosotros) o "portal" (lo pidió el
        # cliente desde su link). Los del portal entran a Trabajo exigiendo acción.
        "source": payload.get("source", "agency"),
        "requestedBy": payload.get("requestedBy"),
        # Ids de generaciones que pertenecen a esta campaña (se linkean al generar).
        "generationIds": [],
        # Piezas generadas dentro de la campaña: { id, url, type, aspectRatio, prompt, status }.
        "pieces": [],
        "createdAt": _now(),
        "updatedAt": _now(),
    }


# Campos que el cliente puede editar vía PATCH.
_EDITABLE = {
    "name", "brief", "productIds", "moodboardId", "poseId", "shotPlan",
    "customShots", "variationsPerShot", "aspectRatios", "resolution",
    "status", "generationIds", "pieces",
    # Costo real de los modelos que consumió la campaña. Las piezas de campaña no son
    # generaciones, así que necesitan su propio registro. Ver lib/costLedger.ts.
    "cost",
    # De dónde salió el pedido: "agency" (lo cargamos nosotros) o "portal" (lo pidió el
    # cliente desde su link). Un pedido del cliente entra a Trabajo exigiendo acción.
    "source", "requestedBy",
    "avatarId", "clothingIds", "backgroundId", "lookFeelId",
}


def apply_update(campaign: dict, patch: dict) -> dict:
    for k, v in patch.items():
        if k in _EDITABLE:
            campaign[k] = v
    if "variationsPerShot" in patch:
        campaign["variationsPerShot"] = max(1, min(4, int(patch.get("variationsPerShot") or 1)))
    if patch.get("status") and patch["status"] not in STATUSES:
        campaign["status"] = "draft"
    campaign["updatedAt"] = _now()
    return campaign
