"""
Brand & Avatar Persistence Service
───────────────────────────────────
JSON-based storage for brands, avatars, and voice presets.
"""

import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Dict

DATA_DIR = Path(__file__).parent.parent / "data"
BRANDS_FILE = DATA_DIR / "brands.json"
# Red de seguridad: cada save deja una copia con timestamp acá (rotando las últimas N).
# Si brands.json llega a faltar, load_brands restaura del backup más reciente en vez de
# reseedear vacío — evita exactamente la pérdida de marcas que pasó (2026-07).
BRAND_BACKUPS_DIR = DATA_DIR / "backups"
_MAX_BRAND_BACKUPS = 30
AVATARS_DIR = DATA_DIR / "avatars"

PRODUCTS_DIR = DATA_DIR / "products"
CLOTHING_DIR = DATA_DIR / "clothing"
BACKGROUNDS_DIR = DATA_DIR / "backgrounds"
POSES_DIR = DATA_DIR / "poses"   # librería de poses de referencia por marca (Ecommerce Pack)
LOGOS_DIR = DATA_DIR / "logos"
MOODBOARDS_DIR = DATA_DIR / "moodboards"
LOOKANDFEEL_DIR = DATA_DIR / "lookandfeel"
VOICE_LAB_DIR = DATA_DIR / "voice_lab"   # ephemeral TTS clips from /api/voice/turn

# Ensure directories exist
DATA_DIR.mkdir(exist_ok=True)
AVATARS_DIR.mkdir(exist_ok=True)
PRODUCTS_DIR.mkdir(exist_ok=True)
CLOTHING_DIR.mkdir(exist_ok=True)
BACKGROUNDS_DIR.mkdir(exist_ok=True)
POSES_DIR.mkdir(exist_ok=True)
LOGOS_DIR.mkdir(exist_ok=True)
MOODBOARDS_DIR.mkdir(exist_ok=True)
LOOKANDFEEL_DIR.mkdir(exist_ok=True)
VOICE_LAB_DIR.mkdir(exist_ok=True)
BRAND_BACKUPS_DIR.mkdir(parents=True, exist_ok=True)


def _backup_brands_file() -> None:
    """Copia el brands.json ACTUAL (si existe y no está vacío) a backups/ con timestamp,
    antes de que save_brands lo pise. Rota manteniendo los últimos _MAX_BRAND_BACKUPS.
    Best-effort: nunca rompe el save si algo falla."""
    try:
        if not BRANDS_FILE.exists() or BRANDS_FILE.stat().st_size < 10:
            return
        ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        dest = BRAND_BACKUPS_DIR / f"brands-{ts}.json"
        if not dest.exists():
            shutil.copy2(BRANDS_FILE, dest)
        backups = sorted(BRAND_BACKUPS_DIR.glob("brands-*.json"))
        for old in backups[:-_MAX_BRAND_BACKUPS]:
            old.unlink(missing_ok=True)
    except Exception as e:
        print(f"[brands] backup falló (no crítico): {e}")


def _latest_brand_backup() -> Optional[Path]:
    backups = sorted(BRAND_BACKUPS_DIR.glob("brands-*.json"))
    return backups[-1] if backups else None


SANDBOX_BRAND = {
    "id": "__sandbox__",
    "name": "Sandbox",
    "isSandbox": True,
    "brandContext": "Generic sandbox for quick generation and testing. No specific brand guidelines — just generate.",
    "avatars": [],
    "voicePresets": [],
    "products": [],
    "clothing": [],
    "backgrounds": [],
    "poses": [],
    "moodboards": [],
    "lookAndFeel": [],
}


def load_brands() -> List[dict]:
    """Load brands from JSON file. Seeds with default if empty. Always ensures Sandbox exists."""
    if not BRANDS_FILE.exists():
        # RED DE SEGURIDAD: antes de reseedear vacío, intentar restaurar del backup más
        # reciente. Esto evita la pérdida de marcas: si el archivo desaparece (borrado,
        # crash mid-write, etc.), volvés al último estado bueno en vez de a una marca vacía.
        backup = _latest_brand_backup()
        if backup is not None:
            shutil.copy2(backup, BRANDS_FILE)
            print(f"[brands] brands.json faltaba — RESTAURADO del backup {backup.name}")
            with open(BRANDS_FILE, "r", encoding="utf-8") as f:
                loaded = json.load(f)
        else:
            default = [{
                "id": "taller-santa-clara",
                "name": "Taller Santa Clara",
                "brandContext": "Taller Santa Clara es una marca de ropa artesanal argentina. Fabrican remeras, polos y prendas básicas con algodón orgánico de alta calidad. Su tono es cercano, auténtico y aspiracional. Target: hombres 25-40, urbanos, que valoran la calidad y el diseño simple. Estilo de comunicación: directo, cálido, con un toque de craft/artesanal. Usan español rioplatense.",
                "avatars": [],
                "voicePresets": [
                    {"id": "POQuTryNv2hmgg36pjcD", "name": "Elías"}
                ],
            }]
            save_brands(default)
            loaded = default
    else:
        with open(BRANDS_FILE, "r", encoding="utf-8") as f:
            loaded = json.load(f)

    # Always ensure Sandbox exists (never persisted — injected at load time)
    if not any(b["id"] == "__sandbox__" for b in loaded):
        loaded = [SANDBOX_BRAND] + loaded
    return loaded


def save_brands(brands: List[dict]):
    """Save brands to JSON file. Never persists the sandbox brand.
    Antes de pisar, deja un backup con timestamp del estado anterior (rotando)."""
    _backup_brands_file()
    real = [b for b in brands if b["id"] != "__sandbox__"]
    with open(BRANDS_FILE, "w", encoding="utf-8") as f:
        json.dump(real, f, indent=2, ensure_ascii=False)


def find_brand(brands: List[dict], brand_id: str) -> Optional[dict]:
    return next((b for b in brands if b["id"] == brand_id), None)


def slugify(name: str) -> str:
    """Simple slug generator."""
    slug = name.lower().strip()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug.strip('-')


def get_avatars_dir() -> Path:
    return AVATARS_DIR


def get_products_dir() -> Path:
    return PRODUCTS_DIR


def get_clothing_dir() -> Path:
    return CLOTHING_DIR


def get_backgrounds_dir() -> Path:
    return BACKGROUNDS_DIR


def get_poses_dir() -> Path:
    return POSES_DIR


def get_logos_dir() -> Path:
    return LOGOS_DIR


def get_moodboards_dir() -> Path:
    return MOODBOARDS_DIR


def get_lookandfeel_dir() -> Path:
    return LOOKANDFEEL_DIR


def get_voice_lab_dir() -> Path:
    return VOICE_LAB_DIR
