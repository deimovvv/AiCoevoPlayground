"""
Feedback loop — convierte devoluciones del cliente en reglas de dirección de arte.
──────────────────────────────────────────────────────────────────────────────────
El Brand Kit sabe lo que la marca DICE de sí misma (extraído de su web, su brief).
Esto agrega lo que la marca aprendió TRABAJANDO: por qué rechazó las piezas que rechazó.

Es la mitad que faltaba. Ver docs/competitive-research.md § Superside — su Brand Brain come
"past projects + feedback", y ese loop es lo único que tienen y nosotros no.

Flujo:
  1. Juntar las devoluciones con status "change" de una marca (reviews.json)
  2. Pasárselas a Gemini junto con la dirección de arte vigente
  3. Devolver reglas PROPUESTAS, cada una apuntando a un campo concreto y citando su
     evidencia. El usuario acepta o descarta — el sistema nunca escribe solo.

Por qué nunca escribe solo: un cliente de mal humor no puede reescribir la marca. Y con
pocas devoluciones esto es lectura, no estadística — conviene que pase por un humano.
"""

from typing import Any, Dict, List, Optional
import json

from services import copy_gen

# Campos de dirección de arte sobre los que se puede proponer. Coincide con
# DesignSystem en main.py y con ART_FIELDS en BrandBrainPage.tsx.
ART_FIELDS = [
    "casting", "photoStyle", "lighting", "composition", "colorTreatment",
    "preferred_locations", "product_presentation", "motion_rules",
    "visualDos", "visualDonts",
]

# Con menos devoluciones que esto no vale la pena molestar a Gemini: una sola queja
# suelta no es un patrón, es una anécdota.
MIN_FEEDBACK = 2


def collect_change_feedback(reviews: List[dict], brand_id: str) -> List[Dict[str, Any]]:
    """Devoluciones con pedido de cambio de una marca, ordenadas de nueva a vieja."""
    out: List[Dict[str, Any]] = []
    for rev in reviews:
        if rev.get("brandId") != brand_id:
            continue
        for clip_id, fb in (rev.get("feedback") or {}).items():
            if fb.get("status") != "change":
                continue
            out.append({
                "title": rev.get("title") or "",
                "clip": clip_id,
                "comment": (fb.get("comment") or "").strip(),
                "at": fb.get("updatedAt") or "",
            })
    out.sort(key=lambda x: x["at"], reverse=True)
    return out


def _build_prompt(brand: dict, feedback: List[Dict[str, Any]]) -> str:
    ds = brand.get("designSystem") or {}
    current_lines = []
    for key in ART_FIELDS:
        val = ds.get(key)
        if isinstance(val, list):
            val = " · ".join(str(v) for v in val if v)
        if val:
            current_lines.append(f"- {key}: {val}")
    current = "\n".join(current_lines) or "(la marca todavía no tiene dirección de arte cargada)"

    fb_lines = []
    for f in feedback:
        comment = f["comment"] or "(sin comentario escrito — solo marcó 'cambiar')"
        fb_lines.append(f'- [{f["at"][:10]}] sobre "{f["title"]}": "{comment}"')
    fb_text = "\n".join(fb_lines)

    return f"""Sos el director de arte de la marca "{brand.get('name')}". Tu trabajo acá es MUY acotado: mirar las devoluciones que dio el cliente sobre piezas ya entregadas y proponer reglas concretas para que las próximas no repitan el mismo error.

DIRECCIÓN DE ARTE VIGENTE:
{current}

DEVOLUCIONES DEL CLIENTE (pedidos de cambio, {len(feedback)} en total):
{fb_text}

Respondé SOLO con un objeto JSON:
{{
  "proposals": [
    {{
      "field": "uno de: {', '.join(ART_FIELDS)}",
      "rule": "la regla, en una o dos oraciones, escrita como instrucción de producción — así como está va a inyectarse en un prompt de generación",
      "evidence": ["cita textual de la devolución 1", "cita textual de la devolución 2"],
      "reasoning": "una oración explicando por qué esas devoluciones llevan a esta regla"
    }}
  ]
}}

REGLAS ESTRICTAS:
- Máximo 3 propuestas. Si solo hay UNA cosa clara, devolvé UNA. Calidad, no cantidad.
- Toda propuesta necesita al menos 2 devoluciones que la respalden. Si un comentario es único y aislado, NO propongas nada por él.
- `evidence` son CITAS TEXTUALES de los comentarios de arriba. No inventes ni parafrasees.
- Si las devoluciones son demasiado vagas para sacar una regla (ej. solo dicen "mejorar"), devolvé `{{"proposals": []}}`. Es una respuesta correcta y preferible a inventar.
- La regla tiene que COMPLEMENTAR lo que ya dice la dirección de arte vigente, no contradecirla sin motivo. Si la contradice, decilo en el `reasoning`.
- Escribí en el mismo idioma que las devoluciones (español rioplatense si están en español).
- NADA de generalidades tipo "mejorar la calidad". Concreto y accionable para un generador de imágenes o video."""


async def propose_rules(brand: dict, reviews: List[dict]) -> Dict[str, Any]:
    """
    Analiza las devoluciones de una marca y propone reglas de dirección de arte.

    Devuelve `{proposals: [...], feedbackCount, skipped?}`. `skipped` explica por qué no
    hay propuestas cuando no las hay — es distinto "no hay datos" de "los datos no alcanzan".
    """
    feedback = collect_change_feedback(reviews, brand.get("id"))

    if len(feedback) < MIN_FEEDBACK:
        return {
            "proposals": [],
            "feedbackCount": len(feedback),
            "skipped": (
                "Todavía no hay devoluciones con pedidos de cambio para esta marca."
                if not feedback
                else f"Hay una sola devolución. Con menos de {MIN_FEEDBACK} no se puede distinguir un patrón de una anécdota."
            ),
        }

    content = ""
    try:
        content = (await copy_gen._call_gemini(_build_prompt(brand, feedback), "Proponé las reglas ahora.")).strip()
        if content.startswith("```"):
            content = content.replace("```json", "").replace("```", "").strip()
        data = json.loads(content)
    except json.JSONDecodeError:
        print(f"[feedback-loop] JSON inválido de Gemini: {content[:600]}")
        raise ValueError("Gemini devolvió JSON inválido. Probá de nuevo.")

    proposals = [p for p in (data.get("proposals") or []) if p.get("field") in ART_FIELDS and p.get("rule")]

    return {
        "proposals": proposals[:3],
        "feedbackCount": len(feedback),
        "skipped": None if proposals else "Gemini leyó las devoluciones pero no encontró un patrón lo bastante claro como para proponer una regla.",
    }


def apply_rule(brand: dict, field: str, rule: str) -> Optional[dict]:
    """
    Escribe una regla aceptada en la dirección de arte de la marca. Muta `brand` in-place
    y devuelve el designSystem resultante.

    Los campos de lista (visualDos / visualDonts) reciben un item nuevo; los de texto se
    APENDEAN, no se pisan — la regla aprendida se suma a lo que la marca ya declaraba.
    """
    if field not in ART_FIELDS:
        return None
    ds = dict(brand.get("designSystem") or {})
    current = ds.get(field)

    if field in ("visualDos", "visualDonts", "preferred_locations"):
        items = list(current) if isinstance(current, list) else ([current] if current else [])
        if rule not in items:
            items.append(rule)
        ds[field] = items
    else:
        text = (current or "").strip() if isinstance(current, str) else ""
        ds[field] = f"{text} {rule}".strip() if text else rule

    brand["designSystem"] = ds
    return ds
