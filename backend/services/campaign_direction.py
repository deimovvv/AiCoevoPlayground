"""
Campaign Direction — la Dirección creativa de una campaña
──────────────────────────────────────────────────────────
Lee el MOODBOARD y la referencia de LIGHTING (más el brief, si hay) y devuelve una
dirección estructurada: paleta, estilo fotográfico, entorno, pose, mood y luz.

Por qué existe (openspec/specs/campaigns):
- El moodboard llegaba al generador como "una imagen más" y nadie lo interpretaba.
  Ahora se LEE acá y al generador le llega solo texto: así no copia la foto, que es
  el riesgo de mandar un collage como referencia. Patrón tomado de Invent.
- Sin brief no había estrategia (el planner lee solo texto). Esto funciona con
  imágenes solas.
- La referencia de luz aporta SOLO luz. Invent lo probó el 2026-09-29: de una
  referencia de "look" se transfiere la luz, y el grade casi no suma.

Devuelve la dirección, no genera nada. Corre una vez por combinación de
referencias y se cachea, así que regenerar no la vuelve a pagar.
"""

import hashlib
import json
from typing import Dict, List, Optional

from . import llm_router
from .manual_lab import _fetch_image_bytes

# Cache en memoria por combinación de referencias + brief. Se pierde al reiniciar,
# lo cual está bien: es un análisis barato de rehacer, no un dato del usuario.
_CACHE: Dict[str, dict] = {}


PROMPT = """You are the art director of a high-end advertising production. You are
reading the visual references of a campaign BEFORE the shoot, to write the creative
direction the photographers will follow.

{refs_block}

{brief_block}

Rules:
- A MOODBOARD is a board of MANY references read TOGETHER as one direction. Describe
  the shared world: the overall mood, the palette tendency, the photographic style,
  the kind of environment and the attitude of the poses. Do NOT describe any single
  image in it, and do NOT invent details that are not on the board.
- A LIGHTING reference contributes ONLY its light: source, time of day, direction,
  hardness, temperature, fill, contrast, shadows, backlight. Describe it like a
  director of photography briefing the gaffer. Do NOT take its composition, subject,
  location or colour grade.
- Keep every field inside its own domain, because each field is applied separately
  and the campaign can override some of them with other references:
  * "photography_style" = camera, lens, framing, depth of field, realism, retouch.
    NEVER mention the backdrop, set, walls, floor, location or its colours.
  * "lighting" = the light only: source, direction, hardness, temperature,
    contrast, shadows. NEVER mention the backdrop or the set it falls on.
  * "environment" = the only field that describes the place/set.
  * "palette" = colours of the world (styling, objects, set).
- If there is a lighting reference, "lighting" comes from it. If not, describe the
  light of the moodboard.
{background_rule}
- If there is no moodboard, leave palette/photography_style/environment/pose/mood
  empty and only fill lighting (and summary_es).
- English for every field except summary_es, which is Rioplatense Spanish, two or
  three short sentences, written for the creative who will approve it.

Reply ONLY with this JSON, no text around it:
{{
  "summary_es": "",
  "palette": ["#hex", "..."],
  "photography_style": "",
  "environment": "",
  "pose": "",
  "mood": "",
  "lighting": ""
}}"""


def _cache_key(images: List[tuple], brief: str, fixed_background: bool = False) -> str:
    h = hashlib.sha256()
    h.update(b"bg" if fixed_background else b"nobg")
    for data, role in images:
        h.update(role.encode())
        h.update(hashlib.sha256(data).digest())
    h.update((brief or "").encode())
    return h.hexdigest()


def _parse(raw: str) -> dict:
    text = (raw or "").strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
    s, e = text.find("{"), text.rfind("}")
    if s == -1 or e <= s:
        raise ValueError("el modelo no devolvió JSON")
    data = json.loads(text[s:e + 1])
    palette = [p for p in (data.get("palette") or []) if isinstance(p, str) and p.startswith("#")][:6]
    return {
        "summary_es": str(data.get("summary_es") or "").strip(),
        "palette": palette,
        "photography_style": str(data.get("photography_style") or "").strip(),
        "environment": str(data.get("environment") or "").strip(),
        "pose": str(data.get("pose") or "").strip(),
        "mood": str(data.get("mood") or "").strip(),
        "lighting": str(data.get("lighting") or "").strip(),
    }


async def build_direction(
    moodboard_url: Optional[str],
    lighting_url: Optional[str],
    brief: str = "",
    fixed_background: bool = False,
) -> dict:
    """Lee las referencias y devuelve la dirección.

    Nunca lanza: si algo falla devuelve {ok: False, reason}. El frontend lo muestra
    y degrada a mandar el moodboard como imagen. Fallar en silencio fue lo que hizo
    que el análisis de pose caído se leyera como "la pose no se respeta" (2026-09).
    """
    if not moodboard_url and not lighting_url:
        return {"ok": False, "reason": "No hay moodboard ni referencia de luz para leer."}

    images: List[tuple] = []   # (bytes, mime)
    labels: List[str] = []
    roles: List[tuple] = []    # (bytes, role) para la cache
    try:
        if moodboard_url:
            data, mime = await _fetch_image_bytes(moodboard_url)
            images.append((data, mime))
            roles.append((data, "moodboard"))
            labels.append(f"Image {len(images)}: MOODBOARD")
        if lighting_url:
            data, mime = await _fetch_image_bytes(lighting_url)
            images.append((data, mime))
            roles.append((data, "lighting"))
            labels.append(f"Image {len(images)}: LIGHTING reference")
    except Exception as e:
        return {"ok": False, "reason": f"No se pudo leer una referencia: {str(e)[:160]}"}

    key = _cache_key(roles, brief, fixed_background)
    if key in _CACHE:
        return {**_CACHE[key], "cached": True}

    prompt = PROMPT.format(
        refs_block="References attached, in order:\n" + "\n".join(labels),
        brief_block=(f"Campaign brief (context, may be empty):\n{brief.strip()}" if brief.strip()
                     else "There is no written brief: work from the references alone."),
        # Prueba 2026-10-12: con un fondo elegido, el blanco infinito del moodboard se
        # coló por el estilo, la paleta y la luz y le ganó al fondo en las 3 tiradas.
        background_rule=("- This campaign uses its OWN fixed background photo as the set. Leave "
                         "\"environment\" EMPTY and keep the set out of every other field: the "
                         "moodboard gives the attitude and the photographic language, never the place."
                         if fixed_background else ""),
    )
    try:
        raw = await llm_router.call(prompt, images, task=llm_router.TASK_WRITE_PROMPT)
        direction = _parse(raw)
    except Exception as e:
        # Incluye el caso de un filtro de contenido (fotos de gente joven en el
        # moodboard): el modelo se niega o no devuelve JSON.
        print(f"[campaign_direction] fallo: {str(e)[:200]}", flush=True)
        return {"ok": False, "reason": f"No se pudo analizar: {str(e)[:160]}"}

    result = {
        "ok": True,
        **direction,
        "lighting_source": "reference" if lighting_url else ("moodboard" if moodboard_url else "none"),
        "has_moodboard": bool(moodboard_url),
    }
    _CACHE[key] = result
    return result
