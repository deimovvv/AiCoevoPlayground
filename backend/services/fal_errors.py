"""
Friendly error messages for AI-provider failures (Fal / ElevenLabs / HeyGen).
─────────────────────────────────────────────────────────────────────────────
Turns raw provider error bodies (often JSON dumps) into concise, human-readable
Spanish messages so the UI never shows a wall of JSON to the user (or a client).

Used across the video/lipsync/render services. image_gen and seedance keep their
own tuned variants; everything else routes through here.
"""

import json
from typing import Optional, Union


def friendly_error(raw: Union[str, dict, list, None], status: Optional[int] = None, what: str = "la generación") -> str:
    """`what` = short noun phrase for the action, e.g. 'la animación con Kling'."""
    if isinstance(raw, (dict, list)):
        text = json.dumps(raw, ensure_ascii=False)
    else:
        text = raw or ""
    blob = text.lower()

    # Balance / quota
    if any(k in blob for k in ("exhausted balance", "user is locked", "insufficient", "quota", "out of credits", "payment required")):
        return "Se agotó el saldo o la cuota de la API. Recargá el balance del proveedor (Fal / ElevenLabs / HeyGen) y reintentá."
    # Content moderation
    if any(k in blob for k in ("content_policy", "sensitive content", "partner_validation", "moderation", "safety")):
        return (f"El filtro de contenido bloqueó {what} (suele ser un falso positivo con piel o ropa ajustada). "
                "Probá reformular el prompt o cambiar la referencia.")
    # Rate limit
    if "rate limit" in blob or "too many requests" in blob or status == 429:
        return "Demasiadas solicitudes seguidas (rate limit). Esperá unos segundos y reintentá."
    # Generic generation rejection
    if "could not generate" in blob or "invalid_request" in blob or "cannot process" in blob:
        return f"El modelo no pudo procesar {what} con esos inputs. Probá simplificar el prompt o cambiar/quitar una referencia."
    # Timeout
    if "timeout" in blob or "timed out" in blob or status == 504:
        return f"El servicio tardó demasiado en responder ({what}). Reintentá en un momento."

    # Fallback: pull a message out of common shapes, else a short generic.
    msg = ""
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            detail = data.get("detail")
            if isinstance(detail, list) and detail and isinstance(detail[0], dict):
                msg = str(detail[0].get("msg") or "")
            elif isinstance(detail, str):
                msg = detail
            else:
                msg = str(data.get("message") or data.get("error") or "")
    except Exception:
        pass
    base = f"Falló {what}" + (f" ({status})" if status else "")
    tail = (msg or text).strip()
    return f"{base}: {tail[:200]}" if tail else base
