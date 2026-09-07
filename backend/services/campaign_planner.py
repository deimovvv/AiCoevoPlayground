"""
Campaign Planner — del brief al plan de tomas
──────────────────────────────────────────────
La campaña te pedía un brief y después no lo usaba: handleGenerate armaba UN
prompt genérico ("Professional advertising campaign photograph...") y lo repetía
por cada formato × variante. O sea que escribías "necesito 3 fotos de la remera
lila" y salían N veces la misma foto, sin relación con lo que pediste.

Este servicio es la pieza que faltaba en el medio: lee el brief en tus palabras
más los assets elegidos, y devuelve un PLAN de tomas concretas — cada una con su
propósito y su prompt listo para generar.

Devuelve el plan, no genera nada. La generación la dispara el frontend después de
que vos lo aprobás, que es donde recién se gasta plata.
"""

import json
from typing import List, Optional

from .copy_gen import _call_gemini, is_configured  # noqa: F401  (is_configured se re-exporta)

# Tope de tomas por plan. No es técnico: es para que un brief ambicioso
# ("todo el catálogo") no se traduzca en una factura sorpresa.
MAX_SHOTS = 12


SYSTEM = """Sos director de arte de una agencia de contenido publicitario.

Recibís un pedido en las palabras del cliente y el CATÁLOGO COMPLETO de assets de
la marca. Tu trabajo es leer el pedido y dejar el pedido ARMADO: qué assets usar,
en qué formatos, y qué tomas generar.

REGLAS

1. ASSETS — elegí del catálogo los que el pedido menciona o implica. Cruzá por
   nombre, descripción y tags. Si el pedido dice "remeras A27", buscá esa prenda
   en el catálogo y devolvé su id. Si menciona modelo/persona sin nombrar a nadie,
   elegí un avatar. Si menciona fondo estudio y hay un fondo así, usalo.
   Devolvé SOLO ids que estén en el catálogo. Si no encontrás algo, no lo inventes.

2. FORMATOS — deducilos del destino. Reel/TikTok/story = 9:16. Feed de Instagram
   = 4:5. Ecommerce/ficha = 4:5. Web/YouTube = 16:9. Si no se deduce, 4:5.

3. VIDEO — si el pedido pide reel, video o animación, marcá "needs_video": true.
   Las tomas igual se planifican como imágenes (son los cuadros de partida).

4. TOMAS — respetá la cantidad que el pedido menciona. Si no dice ninguna,
   proponé entre 3 y 6. Cada toma tiene que ser VISUALMENTE DISTINTA: cambiá
   encuadre, ángulo o intención. Nunca repitas la misma foto.

5. El campo `prompt` va en INGLÉS y es lo que recibe el modelo de imagen:
   encuadre, pose, luz y fondo, concreto. `label` y `why` van en ESPAÑOL
   RIOPLATENSE, cortos, para que se entienda de un vistazo.

6. Si el pedido es ambiguo, resolvelo con el criterio más habitual del rubro y
   dejá constancia en `assumptions`.

Respondé SOLO con este JSON, sin texto alrededor:

{
  "interpretation": "una frase: qué entendiste que hay que hacer",
  "assumptions": ["lo que asumiste porque el pedido no lo decía"],
  "needs_video": false,
  "aspect_ratios": ["9:16"],
  "assets": {
    "clothingIds": [], "productIds": [], "avatarId": null,
    "backgroundId": null, "moodboardId": null, "lookFeelId": null, "poseId": null
  },
  "asset_reasons": ["por qué elegiste cada asset, en una línea cada uno"],
  "shots": [
    {
      "id": "shot_1",
      "label": "Plano general de frente",
      "why": "la foto principal de la ficha",
      "framing": "full_body | medium | detail | back | flat_lay | lifestyle",
      "prompt": "texto en inglés para el modelo de imagen"
    }
  ]
}"""


def _catalog(brand: dict) -> str:
    """El catálogo COMPLETO de la marca, con ids, para que el modelo pueda elegir.

    Antes se le pasaba solo lo que la campaña ya tenía seleccionado — o sea que no
    podía proponer nada. Ahora ve todo el banco y elige.
    """
    lines: List[str] = []

    def block(items, title, limit=40):
        if not items:
            return
        lines.append(f"\n{title}:")
        for i in items[:limit]:
            desc = (i.get("description") or "").strip().replace("\n", " ")
            tags = ", ".join(i.get("tags") or [])
            extra = " · ".join(x for x in (desc[:90], tags) if x)
            lines.append(f"  - id={i.get('id')} | {i.get('name') or '(sin nombre)'}" + (f" | {extra}" if extra else ""))

    block(brand.get("clothing"), "PRENDAS")
    block(brand.get("products"), "PRODUCTOS")
    block(brand.get("avatars"), "MODELOS (avatares)")
    block(brand.get("backgrounds"), "FONDOS")
    block(brand.get("moodboards"), "MOODBOARDS")
    block(brand.get("lookAndFeel"), "LOOK & FEEL")
    block(brand.get("poses"), "POSES")

    return "\n".join(lines) or "(la marca no tiene assets cargados)"


def _valid_ids(brand: dict) -> dict:
    """Ids que existen de verdad, por tipo — para descartar lo que el modelo invente."""
    return {k: {i.get("id") for i in (brand.get(k) or [])}
            for k in ("clothing", "products", "avatars", "backgrounds", "moodboards", "lookAndFeel", "poses")}


async def plan_campaign(brand: dict, brief: str, hints: Optional[dict] = None) -> dict:
    """Lee el brief y deja el pedido armado: assets, formatos y tomas.

    `hints` son las elecciones que el usuario YA hizo a mano — se le pasan al
    modelo como contexto, pero el frontend es el que decide si las respeta o las
    pisa. Acá solo proponemos.

    Nunca lanza: si Gemini falla, devuelve un plan mínimo degradado. El formulario
    tiene que poder seguir funcionando aunque el intérprete no esté.
    """
    brief = (brief or "").strip()
    hints = hints or {}

    user_msg = (
        f"MARCA: {brand.get('name', '(sin nombre)')}\n"
        f"{('CONTEXTO DE MARCA: ' + brand['guidance'][:1200]) if brand.get('guidance') else ''}\n\n"
        f"PEDIDO DEL CLIENTE:\n{brief or '(sin pedido — proponé un set estándar con los assets principales)'}\n\n"
        f"CATÁLOGO DE LA MARCA:{_catalog(brand)}\n\n"
        f"MÁXIMO DE TOMAS: {MAX_SHOTS}"
    )
    if hints:
        user_msg += f"\n\nEL USUARIO YA ELIGIÓ (respetalo salvo que contradiga el pedido): {json.dumps(hints, ensure_ascii=False)}"

    try:
        data = json.loads(await _call_gemini(SYSTEM, user_msg))
    except Exception as e:
        print(f"[campaign_planner] fallback, no se pudo interpretar: {e}")
        return {
            "interpretation": brief[:180] or "Set estándar con los assets de la marca",
            "assumptions": ["No se pudo interpretar el pedido automáticamente — completá el resto a mano."],
            "needs_video": False,
            "aspect_ratios": ["4:5"],
            "assets": {},
            "asset_reasons": [],
            "shots": [{
                "id": "shot_1", "label": "Toma principal", "why": "plano base",
                "framing": "full_body",
                "prompt": "Full-body editorial photograph, model centered, studio lighting, clean background.",
            }],
            "degraded": True,
        }

    # El modelo puede inventar ids. Nos quedamos solo con los que existen —
    # un id fantasma haría que el formulario muestre un asset que no está.
    valid = _valid_ids(brand)
    raw_assets = data.get("assets") or {}
    assets: dict = {}
    for field, pool in (("clothingIds", "clothing"), ("productIds", "products")):
        ids = [i for i in (raw_assets.get(field) or []) if i in valid[pool]]
        if ids:
            assets[field] = ids
    for field, pool in (("avatarId", "avatars"), ("backgroundId", "backgrounds"),
                        ("moodboardId", "moodboards"), ("lookFeelId", "lookAndFeel"), ("poseId", "poses")):
        one = raw_assets.get(field)
        if one and one in valid[pool]:
            assets[field] = one

    shots = [s for s in (data.get("shots") or []) if isinstance(s, dict) and s.get("prompt")][:MAX_SHOTS]
    for i, sh in enumerate(shots, 1):
        sh.setdefault("id", f"shot_{i}")
        sh.setdefault("label", f"Toma {i}")
        sh.setdefault("framing", "medium")
        sh.setdefault("why", "")

    ratios = [r for r in (data.get("aspect_ratios") or []) if r in ("9:16", "4:5", "1:1", "16:9")] or ["4:5"]

    return {
        "interpretation": data.get("interpretation") or "",
        "assumptions": data.get("assumptions") or [],
        "needs_video": bool(data.get("needs_video")),
        "aspect_ratios": ratios,
        "assets": assets,
        "asset_reasons": data.get("asset_reasons") or [],
        "shots": shots,
    }
