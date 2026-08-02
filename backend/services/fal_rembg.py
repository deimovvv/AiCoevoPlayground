"""
Background removal (BiRefNet vía Fal) — recorta el sujeto con matte de alpha (incluye pelo fino).
Para el composite determinístico del Ecommerce Pack: recortamos la modelo y la pegamos sobre el
seamless real, así el fondo es 100% consistente sin depender de que Nano lo respete.
"""
import os
import httpx
from typing import Optional, Tuple

FAL_MODEL = "fal-ai/birefnet/v2"   # mejor calidad de bordes/pelo para personas
FAL_BASE = "https://fal.run"


def _key() -> str:
    return os.getenv("FAL_KEY", "")


def is_configured() -> bool:
    return bool(_key())


def _find_image_url(obj) -> Optional[str]:
    """Busca recursivamente una url de imagen en la respuesta de Fal."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "url" and isinstance(v, str):
                return v
            r = _find_image_url(v)
            if r:
                return r
    elif isinstance(obj, list):
        for x in obj:
            r = _find_image_url(x)
            if r:
                return r
    return None


async def remove_background(image_url: str) -> str:
    """Recibe una URL pública de imagen → devuelve URL de PNG transparente (sujeto recortado)."""
    headers = {"Authorization": f"Key {_key()}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=120) as c:
        r = await c.post(f"{FAL_BASE}/{FAL_MODEL}", headers=headers, json={"image_url": image_url})
    if r.status_code not in (200, 201):
        raise Exception(f"BiRefNet failed ({r.status_code}): {r.text[:300]}")
    url = _find_image_url(r.json())
    if not url:
        raise Exception(f"BiRefNet: no image url in response: {str(r.json())[:200]}")
    return url
