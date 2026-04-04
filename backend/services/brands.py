"""
Brand & Avatar Persistence Service
───────────────────────────────────
JSON-based storage for brands, avatars, and voice presets.
"""

import json
import re
from pathlib import Path
from typing import List, Optional, Dict

DATA_DIR = Path(__file__).parent.parent / "data"
BRANDS_FILE = DATA_DIR / "brands.json"
AVATARS_DIR = DATA_DIR / "avatars"

PRODUCTS_DIR = DATA_DIR / "products"
CLOTHING_DIR = DATA_DIR / "clothing"
BACKGROUNDS_DIR = DATA_DIR / "backgrounds"
LOGOS_DIR = DATA_DIR / "logos"

# Ensure directories exist
DATA_DIR.mkdir(exist_ok=True)
AVATARS_DIR.mkdir(exist_ok=True)
PRODUCTS_DIR.mkdir(exist_ok=True)
CLOTHING_DIR.mkdir(exist_ok=True)
BACKGROUNDS_DIR.mkdir(exist_ok=True)
LOGOS_DIR.mkdir(exist_ok=True)


def load_brands() -> List[dict]:
    """Load brands from JSON file. Seeds with default if empty."""
    if not BRANDS_FILE.exists():
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
        return default
    with open(BRANDS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_brands(brands: List[dict]):
    """Save brands to JSON file."""
    with open(BRANDS_FILE, "w", encoding="utf-8") as f:
        json.dump(brands, f, indent=2, ensure_ascii=False)


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


def get_logos_dir() -> Path:
    return LOGOS_DIR
