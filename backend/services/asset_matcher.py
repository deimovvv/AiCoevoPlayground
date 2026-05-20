"""
Asset Matcher
─────────────
Cross-references detected_assets from Content Analyzer against the user's
brand kit (avatars, products, clothing, backgrounds, moodboards) and returns
suggestions with confidence scores.

Used to power the Map Assets confirmation screen in CA: instead of the user
picking blindly upfront, the analyzer detects what's in the video and the
matcher proposes the closest brand asset for each.
"""

import json
from typing import Any, Dict, List, Optional

from services.copy_gen import _call_gemini


def is_configured() -> bool:
    import os
    return bool(os.getenv("GEMINI_API_KEY"))


def _brand_assets_summary(brand: dict) -> Dict[str, List[Dict[str, str]]]:
    """Flatten brand kit into compact lookup tables for the matcher."""
    return {
        "avatars": [
            {"id": a.get("id", ""), "name": a.get("name", ""), "description": (a.get("description") or "")[:300]}
            for a in (brand.get("avatars") or [])
        ],
        "products": [
            {"id": p.get("id", ""), "name": p.get("name", ""), "description": (p.get("description") or "")[:300]}
            for p in (brand.get("products") or [])
        ],
        "clothing": [
            {"id": c.get("id", ""), "name": c.get("name", ""), "description": (c.get("description") or "")[:300]}
            for c in (brand.get("clothing") or [])
        ],
        "backgrounds": [
            {"id": b.get("id", ""), "name": b.get("name", ""), "description": (b.get("description") or "")[:300]}
            for b in (brand.get("backgrounds") or [])
        ],
    }


async def match_assets(detected: dict, brand: dict) -> dict:
    """
    Given detected_assets from the analyzer + the brand, ask Gemini to suggest
    the best match per detected entry. Returns a dict mirroring detected_assets
    shape with suggested_brand_id + confidence + reason added per entry.

    Output shape:
    {
      "persons": [{"detected_id": "...", "description": "...", "scenes": [...],
                   "suggested_brand_id": "..." | null, "confidence": 0.0-1.0,
                   "reason": "short explanation"}],
      "outfits": [...],
      "products": [...],
      "locations": [...]
    }

    If a category in the brand kit has zero assets, every detected entry returns
    null suggested_brand_id with confidence 0.
    """
    brand_assets = _brand_assets_summary(brand)

    # Candidate pools per detected category. CLOTHING BRANDS catalog garments in EITHER
    # the clothing OR the products bucket (a t-shirt they sell might live in "products",
    # while a t-shirt the model just wears lives in "clothing"). So for garment-like
    # detections we search BOTH pools — otherwise the user's remera-in-products never
    # matches a detected outfit, and they see a false "brand kit vacío".
    def _pool(*cats: str) -> List[Dict[str, str]]:
        seen: set = set()
        merged: List[Dict[str, str]] = []
        for cat in cats:
            for a in brand_assets.get(cat, []):
                if a["id"] and a["id"] not in seen:
                    seen.add(a["id"])
                    merged.append(a)
        return merged

    candidate_pools = {
        "persons": _pool("avatars"),
        "outfits": _pool("clothing", "products"),   # garments can be in either bucket
        "products": _pool("products", "clothing"),  # and vice versa
        "locations": _pool("backgrounds"),
    }

    # If brand has zero assets in a category, we can skip Gemini for that group entirely
    result: Dict[str, List[Dict[str, Any]]] = {}

    # Prepare a single combined Gemini call (more efficient than 4 separate calls)
    pairs_to_match: Dict[str, Dict[str, Any]] = {}
    for det_cat in ("persons", "outfits", "products", "locations"):
        detected_list = detected.get(det_cat) or []
        brand_list = candidate_pools[det_cat]
        result[det_cat] = []
        if not detected_list:
            continue
        # If no candidate assets at all (across both pools), null suggestion
        if not brand_list:
            human_label = {
                "persons": "avatares", "products": "productos o prendas",
                "outfits": "prendas o productos", "locations": "fondos",
            }.get(det_cat, det_cat)
            for d in detected_list:
                result[det_cat].append({
                    "detected_id": d.get("id", ""),
                    "description": d.get("description", ""),
                    "scenes": d.get("scenes", []),
                    "suggested_brand_id": None,
                    "confidence": 0.0,
                    "reason": f"Tu brand kit no tiene {human_label} cargados — agregá uno desde Brand Kit",
                })
            continue
        pairs_to_match[det_cat] = {"detected": detected_list, "brand": brand_list}

    if not pairs_to_match:
        return result

    # Build a single matching prompt
    system_prompt = """You are a visual-asset matcher.

For each detected asset, pick the SINGLE best match from the user's brand kit (or null if no asset is a reasonable fit). Compare using BOTH the name AND the description — many brand assets have empty descriptions, so use the name as the primary signal in that case (e.g. a clothing item named "Remera negra" is clearly a black t-shirt; "Jean azul" is blue jeans).

Match criteria per category:
  - persons → match by gender, age range, build, hair, vibe. Identity exact-match is not required — closest persona.
  - outfits → match by main garments + colors + style. ALWAYS try to find a partial match (same GARMENT TYPE counts even if color differs slightly). A "Remera bordó" (burgundy t-shirt) IS a valid candidate for a detected "cream cotton tee" — they're both basic t-shirts. Don't be too strict.
  - products → match by what the product IS first, then color/finish.
  - locations → match by space type + visual character (workshop ≠ kitchen, even if both indoor).

Output ONLY a JSON object with this shape (one key per detected category present in the input):

{
  "persons": [
    {"detected_id": "person_1", "suggested_brand_id": "<id from brand.avatars or null>", "confidence": 0.0-1.0, "reason": "one short sentence"}
  ],
  "outfits": [...],
  "products": [...],
  "locations": [...]
}

Confidence rules:
  - 0.85+ = strong match (same type, similar key attributes)
  - 0.6-0.84 = plausible (same type, some attributes differ — e.g. same garment type, different color)
  - 0.3-0.59 = weak but plausible (loose category match) — STILL return the id, just with low confidence so the user sees the suggestion
  - <0.3 → only then set suggested_brand_id to null

Default attitude: when in doubt, SUGGEST a match with low confidence rather than null. The user can override it. Suggesting "nothing" when there's a plausible candidate (a t-shirt detected vs a t-shirt in the kit, different colors) is the WORST outcome — the user is forced to pick manually even though the kit has something usable.

Do not invent IDs that aren't in the brand kit.
"""

    user_payload = {
        "detected": {cat: data["detected"] for cat, data in pairs_to_match.items()},
        "brand_kit": {cat: data["brand"] for cat, data in pairs_to_match.items()},
    }
    user_msg = "Match each detected asset to the best brand asset. JSON only.\n\n" + json.dumps(user_payload, indent=2)

    try:
        raw = await _call_gemini(system_prompt, user_msg)
    except Exception as e:
        print(f"[asset-matcher] Gemini error: {e}")
        # Fallback: return null suggestions for all
        for det_cat, data in pairs_to_match.items():
            for d in data["detected"]:
                result[det_cat].append({
                    "detected_id": d.get("id", ""),
                    "description": d.get("description", ""),
                    "scenes": d.get("scenes", []),
                    "suggested_brand_id": None,
                    "confidence": 0.0,
                    "reason": "Matcher failed — pick manually",
                })
        return result

    clean = raw.strip().replace("```json", "").replace("```", "").strip()
    try:
        parsed = json.loads(clean)
    except json.JSONDecodeError:
        print(f"[asset-matcher] JSON parse failed. Raw: {raw[:300]}")
        parsed = {}

    # Merge parsed back into result, preserving description + scenes from detected
    for det_cat, data in pairs_to_match.items():
        parsed_cat = parsed.get(det_cat, [])
        # Build a lookup by detected_id from Gemini's output
        by_id = {p.get("detected_id"): p for p in parsed_cat if isinstance(p, dict)}
        # Validate suggested_brand_id is actually in the brand kit for that category
        valid_brand_ids = {b["id"] for b in data["brand"]}
        for d in data["detected"]:
            did = d.get("id", "")
            match = by_id.get(did, {})
            suggested = match.get("suggested_brand_id")
            if suggested and suggested not in valid_brand_ids:
                suggested = None  # Gemini hallucinated an id — discard
            result[det_cat].append({
                "detected_id": did,
                "description": d.get("description", ""),
                "scenes": d.get("scenes", []),
                "suggested_brand_id": suggested,
                "confidence": float(match.get("confidence") or 0.0),
                "reason": str(match.get("reason") or ""),
            })

    return result
