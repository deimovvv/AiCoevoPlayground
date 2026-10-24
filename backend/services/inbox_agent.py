"""
El agente ordena el material del cliente (openspec/changes/studio-v2 C.4)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cuando llega material a la Bandeja, mira las imágenes, la nota y los proyectos abiertos de la marca, y
propone: ¿va a la marca o a un proyecto?, ¿qué es cada imagen (moodboard, luz, locación, plano, pose,
cara, prenda, producto)?, ¿cuál no sirve? Sólo propone: el equipo lo ve ya elegido en la Bandeja y
confirma o corrige. Nunca incorpora solo.

LLM: `llm_router.call(provider="google")` con imágenes achicadas (Gemini de Coevo; si falla, Fal).
max_tokens alto a propósito: el modelo «piensa» dentro de ese límite; con 1500 volvía vacío.
"""
import asyncio
import io
import re
from typing import Optional
import logging
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

from db import engine
from db.models import InboxItem
from services import brands, campaigns as campaigns_service, llm_router
from services.brand_agent import _json

log = logging.getLogger("inbox_agent")
FILES_DIR = Path(__file__).parent.parent / "data" / "inbox"
MAX_IMAGES = 40   # un PDF de marca entra partido en páginas (services/pdf_pages.py)
TYPES = {
    "moodboard": "clima, estética, referencias de estilo o de otras marcas",
    "luz": "cómo está iluminada la foto, color, contraste (look & feel)",
    "locacion": "un lugar o fondo donde podría pasar la foto, sin persona protagonista",
    "plano": "un encuadre o movimiento de cámara de referencia (cómo filmar o fotografiar)",
    "pose": "una pose o postura de cuerpo de referencia",
    "cara": "una persona/modelo cuya cara se va a repetir (casting, avatar)",
    "prenda": "una prenda de la marca, sola o puesta, para mostrar el producto",
    "producto": "un producto que no es ropa (envase, accesorio, objeto)",
    "manual": "una página del manual de marca: logo y sus usos, paleta de colores, tipografías, reglas, tono de voz",
    "carrusel": "una pieza gráfica de referencia: carrusel, post, story, flyer o layout con texto y diseño",
}


def _small(path: Path) -> tuple:
    im = Image.open(path).convert("RGB")
    im.thumbnail((768, 768))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=82)
    return buf.getvalue(), "image/jpeg"


async def _propose(item: InboxItem) -> dict:
    images = [f for f in (item.files or []) if f["kind"] == "image"][:MAX_IMAGES]
    if not images:
        return {"status": "sin_imagenes"}
    brand = brands.find_brand(brands.load_brands(), item.brand_id) or {}
    projects = [c for c in campaigns_service.load_campaigns()
                if c.get("brandId") == item.brand_id and c.get("status") not in ("archived", "archivada")]
    pics = [_small(FILES_DIR / f["url"].split("/static/inbox/", 1)[1]) for f in images]
    pdf_note = ""
    if any(f.get("fromPdf") for f in images):
        pdf_note = ("\nVarias imágenes son PÁGINAS de un PDF de marca (dice «pág. N» en el nombre). Un PDF así suele mezclar "
                    "manual, moodboard y referencias: clasificá cada página por lo que muestra. Portadas, índices o páginas "
                    "de sólo texto sin valor visual: «descartar».\n")
        pdf_note += "\n".join(f'{n}. {f.get("name", "")}' for n, f in enumerate(images, 1)) + "\n"
    proj_txt = "\n".join(f'- id "{c["id"]}": {c.get("name") or "sin nombre"}. {(c.get("brief") or "")[:300]}' for c in projects[-15:]) or "(ninguno)"
    prompt = f"""Sos el asistente de una agencia de contenido de moda. La marca «{brand.get('name', item.brand_id)}» mandó material.
Nota del cliente: {item.note or '(sin nota)'}
Link: {item.link or '(sin link)'}
{pdf_note}
Proyectos abiertos de la marca:
{proj_txt}

Te paso {len(pics)} imágenes, numeradas 1 a {len(pics)} en el orden en que llegan.

Decidí:
1. Destino: "marca" si es material que vale para la marca en general (identidad, estilo de siempre, sus prendas o productos,
   sus caras), o el id de UN proyecto si la nota o las imágenes apuntan claramente a ese proyecto. Ante la duda, "marca".
2. Para cada imagen, un tipo de esta lista:
{chr(10).join(f'   - {k}: {v}' for k, v in TYPES.items())}
   o "descartar" si está repetida, es una captura sin valor de referencia, está borrosa o no tiene que ver.

Devolvé SÓLO este JSON:
{{"target": "marca" | "<id del proyecto>", "why": "una frase en castellano rioplatense, para el equipo, de por qué",
  "files": [{{"n": 1, "type": "<tipo o descartar>"}}, ...]}}
En "why": nombrá el proyecto por su nombre (nunca su id), decí «proyecto» (no «campaña»), y si lo que manda
contradice el brief del proyecto, avisalo."""
    data = {}
    for attempt in range(2):
        text = await llm_router.call(prompt + ("\n\nIMPORTANTE: JSON válido, sin texto alrededor." if attempt else ""),
                                     images=pics, task=llm_router.TASK_VISION_FAST, max_tokens=6000, timeout=120, provider="google")
        try:
            data = _json(text)
            break
        except Exception:
            if attempt:
                raise
    ids = {c["id"] for c in projects}
    target = data.get("target") if data.get("target") in ids else "marca"
    per, discard = {}, []
    for f in data.get("files") or []:
        try:
            url = images[int(f.get("n")) - 1]["url"]
        except (ValueError, TypeError, IndexError):
            continue
        t = f.get("type")
        if t == "descartar":
            discard.append(url)
        elif t in TYPES:
            per[url] = t
    out = {"status": "ok", "target": target, "why": (data.get("why") or "")[:300], "perFile": per, "discard": discard,
           "at": datetime.now(timezone.utc).isoformat()}
    identity = await _read_identity(item, brand, images, per)
    if identity:
        out["identity"] = identity
    return out


async def _read_identity(item: InboxItem, brand: dict, images: list, per: dict) -> Optional[dict]:
    """Si llegó un PDF de marca: lee su texto y las páginas del manual y propone la identidad. Sólo propone:
    el equipo la pasa a Marca con un botón (POST /api/inbox/{id}/identidad), y ahí sólo llena lo que está vacío."""
    folder = FILES_DIR / item.id
    text = "\n\n".join(t.read_text(encoding="utf-8")[:15000] for t in folder.glob("*.txt"))
    manual = [f for f in images if per.get(f["url"]) == "manual"][:8]
    if not text.strip() and not manual:
        return None
    pics = [_small(FILES_DIR / f["url"].split("/static/inbox/", 1)[1]) for f in manual]
    prompt = f"""Este es el sistema de marca de «{brand.get('name', item.brand_id)}» (texto del PDF y, si hay, imágenes de sus páginas de manual).
Extraé SÓLO lo que el material dice o muestra; no inventes. Lo que no esté, dejalo vacío.

TEXTO DEL PDF:
{text[:20000] or '(sin texto)'}

Devolvé SÓLO este JSON:
{{"contexto": "quién es la marca en 2-3 frases",
  "tono": ["3-5 adjetivos de cómo habla"], "nunca": ["palabras o expresiones que no usa"],
  "colores": [{{"name": "nombre", "hex": "#RRGGBB", "usage": "para qué se usa"}}],
  "tipografias": {{"headline": "fuente de títulos", "body": "fuente de texto"}},
  "estilo": "cómo se ven sus fotos e imágenes, en una o dos frases",
  "siempre": ["reglas visuales que siempre se cumplen"], "nunca_visual": ["lo que nunca se hace"]}}"""
    for attempt in range(2):
        try:
            raw = await llm_router.call(prompt + ("\n\nIMPORTANTE: JSON válido, sin texto alrededor." if attempt else ""),
                                        images=pics, task=llm_router.TASK_VISION_FAST if pics else llm_router.TASK_TEXT,
                                        max_tokens=6000, timeout=120, provider="google")
            data = _json(raw)
            break
        except Exception:
            if attempt:
                return None
    data["colores"] = [c for c in data.get("colores") or [] if isinstance(c, dict) and re.match(r"^#[0-9a-fA-F]{6}$", str(c.get("hex", "")))]
    keep = {k: v for k, v in data.items() if v}
    return keep or None


async def propose(item_id: str) -> dict:
    """Corre el agente sobre un envío y guarda la propuesta en el ítem. Nunca levanta: un error queda anotado."""
    engine()
    from db import _sessions  # se crea con engine()
    async with _sessions() as s:  # type: ignore[misc]
        item = await s.get(InboxItem, item_id)
        if not item:
            return {}
        try:
            out = await _propose(item)
        except Exception as ex:
            log.warning("inbox_agent %s: %s", item_id, ex)
            out = {"status": "error", "error": str(ex)[:200]}
        item.proposal = out
        await s.commit()
        return out


def propose_later(item_id: str) -> None:
    asyncio.get_running_loop().create_task(propose(item_id))
