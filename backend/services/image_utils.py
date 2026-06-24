"""
Image upload normalization
──────────────────────────
Convierte uploads en formatos que el browser no puede renderizar (HEIC/HEIF,
típico de iPhone) a JPEG estándar antes de guardarlos en disco.

Por qué importa: Chrome/Firefox no soportan HEIC nativamente — si dejamos el
archivo crudo en disk, el <img> del UI muestra el placeholder roto. Además,
modelos como Nano Banana 2 esperan PNG/JPEG/WEBP, así que la conversión también
evita errores en runtime cuando esa foto se usa como ref de generación.

Uso típico desde un endpoint de upload:

    from services.image_utils import normalize_image_bytes

    data = await image.read()
    data, ext = normalize_image_bytes(data, image.filename, image.content_type)
    # data es JPEG si el original era HEIC, sino se devuelve sin tocar.

Si pillow-heif no está instalado, el helper degrada con un warning y devuelve
los bytes crudos (la app sigue andando pero el HEIC no se va a renderizar).
"""

from __future__ import annotations
from pathlib import Path
from typing import Optional, Tuple
import io
import logging

log = logging.getLogger(__name__)

# Intentamos registrar el opener de HEIF al import time. Si falla (libheif no
# disponible en el sistema, lib no instalada), seguimos andando — la conversión
# se omite y los bytes se devuelven crudos.
_HEIF_OK = False
try:
    from pillow_heif import register_heif_opener  # type: ignore
    register_heif_opener()
    _HEIF_OK = True
except Exception as e:  # noqa: BLE001
    log.warning("pillow-heif no disponible — los uploads HEIC no se convertirán: %s", e)

try:
    from PIL import Image  # type: ignore
    _PIL_OK = True
except Exception as e:  # noqa: BLE001
    log.warning("Pillow no disponible — la conversión de imágenes está deshabilitada: %s", e)
    _PIL_OK = False


# Extensiones que el browser puede renderizar directo. Las demás (HEIC, HEIF,
# AVIF en algunos browsers viejos) se convierten a JPEG.
_BROWSER_OK_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"}

# Extensiones que sabemos que necesitan conversión.
_NEEDS_CONVERT_EXTS = {".heic", ".heif"}

# Extensiones de imagen que aceptamos (todas las que el helper puede normalizar).
# Para Windows: el browser no asocia HEIC a image/* y manda application/octet-stream,
# así que la validación por content-type sola rechazaría el upload. Si la extensión
# del filename está acá, lo dejamos pasar aunque el content-type sea raro.
_VALID_IMAGE_EXTS = _BROWSER_OK_EXTS | _NEEDS_CONVERT_EXTS | {".avif", ".bmp", ".tiff", ".tif"}


def is_image_upload(content_type: Optional[str], filename: Optional[str]) -> bool:
    """
    Determina si un upload es una imagen aceptable. Acepta de dos formas:
    1. content_type empieza con "image/" (caso típico macOS/Linux).
    2. filename tiene una extensión de imagen conocida (rescata Windows con HEIC,
       donde el browser manda application/octet-stream).
    """
    if content_type and content_type.lower().startswith("image/"):
        return True
    if filename:
        ext = Path(filename).suffix.lower()
        if ext in _VALID_IMAGE_EXTS:
            return True
    return False


def _ext_from_filename(filename: Optional[str]) -> str:
    """Extrae la extensión en lowercase. '.png' por default si no hay nombre."""
    if not filename:
        return ".png"
    suf = Path(filename).suffix.lower()
    return suf or ".png"


def _ext_from_content_type(content_type: Optional[str]) -> Optional[str]:
    """Mapeo simple content-type → extensión. None si no lo reconocemos."""
    if not content_type:
        return None
    ct = content_type.lower().split(";")[0].strip()
    return {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
        "image/heic": ".heic",
        "image/heif": ".heif",
    }.get(ct)


def normalize_image_bytes(
    data: bytes,
    filename: Optional[str] = None,
    content_type: Optional[str] = None,
) -> Tuple[bytes, str]:
    """
    Devuelve (bytes_normalizados, extensión_final).

    - Si el upload es HEIC/HEIF y pillow-heif está disponible, convierte a JPEG.
    - Si el upload ya es JPEG/PNG/WEBP/GIF, lo devuelve sin tocar.
    - Si el upload es algo raro y no podemos convertir, lo devuelve sin tocar
      (con un warning en logs).

    La extensión devuelta SIEMPRE incluye el punto (".jpg", ".png", etc.) para
    que el caller la concatene directo al filename de destino.
    """
    # Determinamos la extensión: primero el filename, después el content-type.
    # Esto cubre el caso donde el OS asigna content-type genérico (application/octet-stream)
    # pero el filename sí trae .heic.
    ext = _ext_from_filename(filename)
    if ext == ".png" and content_type:
        # default fallback — probemos derivar del content-type por si el filename no tenía suffix.
        ct_ext = _ext_from_content_type(content_type)
        if ct_ext:
            ext = ct_ext

    needs_convert = ext in _NEEDS_CONVERT_EXTS

    if not needs_convert:
        # Browser-friendly: no tocamos. (Si la extensión es algo nuevo que no
        # conocemos pero el browser lo entiende, mejor no romperlo.)
        return data, ext

    # HEIC/HEIF → JPEG
    if not _HEIF_OK or not _PIL_OK:
        log.warning(
            "Upload HEIC sin pillow-heif/Pillow disponibles — guardando crudo (no se va a "
            "renderizar en browsers). Instalá `pillow-heif` y `Pillow` en el backend."
        )
        return data, ext

    try:
        img = Image.open(io.BytesIO(data))
        # JPEG no soporta canal alpha — si la imagen lo tiene (puede pasar con HEIF), lo aplanamos
        # contra blanco para no perder el sujeto.
        if img.mode in ("RGBA", "LA"):
            bg = Image.new("RGB", img.size, (255, 255, 255))
            bg.paste(img, mask=img.split()[-1])
            img = bg
        elif img.mode != "RGB":
            img = img.convert("RGB")

        out = io.BytesIO()
        # quality=90 es el sweet spot del ratio tamaño/calidad para fotos producto.
        # optimize=True hace una segunda pasada de Huffman sin re-encode — ~5-8% más chico.
        img.save(out, format="JPEG", quality=90, optimize=True)
        return out.getvalue(), ".jpg"
    except Exception as e:  # noqa: BLE001
        log.exception("Falló la conversión HEIC → JPEG, guardando crudo: %s", e)
        return data, ext
