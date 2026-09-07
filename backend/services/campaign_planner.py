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

Recibís un pedido en las palabras del cliente y el inventario de assets
disponibles de la marca. Tu trabajo es convertir ese pedido en un PLAN DE TOMAS
concreto y ejecutable.

REGLAS

1. Respetá la cantidad que el pedido menciona. Si dice "3 fotos", son 3 tomas.
   Si no dice ninguna cantidad, proponé entre 3 y 6 según lo que pida.
2. Cada toma tiene que ser VISUALMENTE DISTINTA de las otras: cambiá el encuadre,
   el ángulo o la intención. Nunca repitas la misma foto.
3. Usá SOLO los assets que te paso. No inventes productos ni prendas que no estén.
4. El campo `prompt` va en INGLÉS y es lo que recibe el modelo de imagen: describí
   encuadre, pose, luz y fondo. Sé específico y concreto.
5. Los campos `label` y `why` van en ESPAÑOL RIOPLATENSE, cortos, para que el
   cliente entienda de un vistazo qué es cada toma.
6. Si el pedido es ambiguo, resolvelo con el criterio más habitual del rubro y
   dejá constancia en `assumptions`.

Respondé SOLO con este JSON, sin texto alrededor:

{
  "interpretation": "una frase: qué entendiste que hay que hacer",
  "assumptions": ["lo que asumiste porque el pedido no lo decía"],
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


def _inventory(brand: dict, campaign: dict) -> str:
    """Lo que la marca tiene disponible, filtrado a lo que la campaña eligió."""
    lines: List[str] = []

    def names(items, ids, kind):
        if not items:
            return
        chosen = [i for i in items if not ids or i.get("id") in ids]
        if chosen:
            lines.append(f"{kind}: " + ", ".join(
                f"{i.get('name') or i.get('id')}"
                + (f" ({i['description'][:70]})" if i.get("description") else "")
                for i in chosen[:10]
            ))

    names(brand.get("products"), campaign.get("productIds") or [], "Productos")
    names(brand.get("clothing"), campaign.get("clothingIds") or [], "Prendas")

    avatar_id = campaign.get("avatarId")
    if avatar_id:
        av = next((a for a in (brand.get("avatars") or []) if a.get("id") == avatar_id), None)
        if av:
            lines.append(f"Modelo: {av.get('name')}" + (f" — {av.get('description','')[:90]}" if av.get("description") else ""))

    if campaign.get("backgroundId"):
        lines.append("Hay un fondo de referencia elegido.")
    if campaign.get("moodboardId"):
        lines.append("Hay un moodboard de referencia elegido.")
    if campaign.get("lookFeelId"):
        lines.append("Hay una referencia de look & feel (color grade) elegida.")

    return "\n".join(lines) or "(sin assets seleccionados)"


async def plan_campaign(brand: dict, campaign: dict) -> dict:
    """Convierte el brief de una campaña en un plan de tomas.

    Devuelve {interpretation, assumptions, shots[]}. Si Gemini falla o contesta
    algo que no parsea, devuelve un plan mínimo de una toma en vez de romper:
    la campaña siempre tiene que poder avanzar.
    """
    brief = (campaign.get("brief") or "").strip()
    ratios = campaign.get("aspectRatios") or ["4:5"]
    variations = campaign.get("variationsPerShot") or 1

    user_msg = (
        f"MARCA: {brand.get('name', '(sin nombre)')}\n"
        f"{('CONTEXTO DE MARCA: ' + brand['guidance'][:1200]) if brand.get('guidance') else ''}\n\n"
        f"PEDIDO DEL CLIENTE:\n{brief or '(sin brief — proponé un set estándar para los assets elegidos)'}\n\n"
        f"ASSETS DISPONIBLES:\n{_inventory(brand, campaign)}\n\n"
        f"FORMATOS: {', '.join(ratios)}\n"
        f"VARIANTES POR TOMA: {variations}\n"
        f"MÁXIMO DE TOMAS: {MAX_SHOTS}"
    )

    try:
        raw = await _call_gemini(SYSTEM, user_msg)
        data = json.loads(raw)
    except Exception as e:
        print(f"[campaign_planner] fallback, el plan no se pudo generar: {e}")
        return {
            "interpretation": brief[:180] or "Set estándar para los assets elegidos",
            "assumptions": ["No se pudo interpretar el pedido automáticamente — revisá las tomas a mano."],
            "shots": [{
                "id": "shot_1",
                "label": "Toma principal",
                "why": "plano base",
                "framing": "full_body",
                "prompt": "Full-body editorial photograph, model centered, studio lighting, clean background.",
            }],
            "degraded": True,
        }

    shots = [s for s in (data.get("shots") or []) if isinstance(s, dict) and s.get("prompt")][:MAX_SHOTS]
    for i, s in enumerate(shots, 1):
        s.setdefault("id", f"shot_{i}")
        s.setdefault("label", f"Toma {i}")
        s.setdefault("framing", "medium")
        s.setdefault("why", "")

    return {
        "interpretation": data.get("interpretation") or "",
        "assumptions": data.get("assumptions") or [],
        "shots": shots,
    }
