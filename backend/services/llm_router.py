"""
LLM Router — un proveedor por TAREA, no uno para todo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Por qué existe
──────────────
En 2026-09 el proyecto de Google de la GEMINI_API_KEY recibió
`403 PERMISSION_DENIED — "Your project has been denied access"`. Como el modelo
estaba hardcodeado en 5 servicios, se cayeron A LA VEZ: análisis de pose,
auto-describe de assets, chat de marca, guiones, dictado y "Curar con Gemini".
Seis features, un solo punto de falla. Ver decisions-log 2026-09.

Peor: `analyze_pose_ref` es fail-open a propósito (para no romper la generación),
así que devolvía `framing:""` EN SILENCIO y el síntoma se leía como "la pose no
se respeta" en vez de "el proveedor está caído".

Qué resuelve
────────────
1. Un punto único de salida a cualquier LLM.
2. El modelo se elige POR TAREA, no por archivo. Describir una prenda, redactar
   un prompt y analizar un video son trabajos distintos y no piden el mismo
   modelo ni el mismo precio.
3. Config en runtime (env), no hardcodeada: cambiar de modelo o de proveedor es
   una variable, no una cirugía de 5 archivos.
4. Fallback declarativo: si el proveedor primario falla, cae al siguiente en vez
   de tumbar la feature.

Qué NO resuelve (a propósito)
─────────────────────────────
El ENCUADRE de una foto (full-body / medio / cintura-abajo) no debería pedirse a
un LLM: es geometría, no semántica. Se resuelve con keypoints por código —
determinístico, gratis y sin proveedor. No agregar una TASK para eso.

Proveedores
───────────
- google : API directa de Gemini (generativelanguage). La que se bloqueó.
- fal    : router de fal (openrouter/router/vision). Corre Claude, GPT, Gemini,
           Qwen y otros con la FAL_KEY que ya usamos en 10+ servicios. No
           requiere credencial nueva.
"""

from __future__ import annotations

import os
import json
import base64
import httpx

# ── Tareas ────────────────────────────────────────────────────────────────
# Cada una describe un TRABAJO, no un modelo. El modelo se resuelve abajo y se
# puede pisar por env sin tocar código.
TASK_VISION_FAST = "vision_fast"    # describir prenda/avatar, clasificar, leer pose
TASK_VISION_VIDEO = "vision_video"  # motion, escenas, razonamiento multi-frame
TASK_WRITE_PROMPT = "write_prompt"  # "Curar con Gemini", afilar instrucción de edición
TASK_TEXT = "text"                  # chat de marca, guiones, copys

# ── Config por defecto ────────────────────────────────────────────────────
# Racional de cada elección:
#  vision_fast  : alto volumen (se llama por cada asset). Sonnet 5 da el mejor
#                 razonamiento visual por precio ($2/$10 por M tokens).
#  write_prompt : bajo volumen (1 por generación) pero define la calidad de la
#                 imagen que sale. Acá conviene pagar el mejor modelo.
#  vision_video : el más caro y el menos usado.
#  text         : conversación y copys.
_DEFAULTS = {
    TASK_VISION_FAST:  ("fal", "anthropic/claude-sonnet-5"),
    TASK_VISION_VIDEO: ("google", "gemini-3.1-pro-preview"),
    TASK_WRITE_PROMPT: ("fal", "anthropic/claude-opus-5"),
    TASK_TEXT:         ("fal", "anthropic/claude-sonnet-5"),
}

# Orden de fallback: si el primario falla, se prueba el siguiente.
_FALLBACK_ORDER = ["fal", "google"]

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
FAL_VISION_URL = "https://fal.run/openrouter/router/vision"


def _env(key: str, default: str = "") -> str:
    """Lee del entorno EN CADA LLAMADA, no al importar.

    Importante: image_analysis.py leía GEMINI_API_KEY a nivel de módulo, así que
    cambiar el .env no surtía efecto hasta reiniciar el proceso. Con un backend
    que corrió 9 días, eso significó editar la key y no ver ningún cambio.
    """
    return os.getenv(key, default) or default


def resolve(task: str) -> tuple[str, str]:
    """Devuelve (proveedor, modelo) para una tarea.

    Se puede pisar por env sin tocar código:
        LLM_VISION_FAST_PROVIDER=google
        LLM_VISION_FAST_MODEL=gemini-2.5-flash
    """
    provider, model = _DEFAULTS.get(task, _DEFAULTS[TASK_VISION_FAST])
    prefix = f"LLM_{task.upper()}"
    return _env(f"{prefix}_PROVIDER", provider), _env(f"{prefix}_MODEL", model)


def available_providers() -> list[str]:
    """Proveedores que tienen credencial cargada AHORA."""
    out = []
    if _env("FAL_KEY"):
        out.append("fal")
    if _env("GEMINI_API_KEY"):
        out.append("google")
    return out


def is_configured() -> bool:
    return bool(available_providers())


# ── Backends ──────────────────────────────────────────────────────────────

async def _call_google(prompt: str, images, model: str, max_tokens: int, timeout: int) -> str:
    key = _env("GEMINI_API_KEY")
    if not key:
        raise RuntimeError("GEMINI_API_KEY no configurada")

    parts = [{"text": prompt}]
    for img_bytes, mime in images:
        parts.append({"inline_data": {"mime_type": mime,
                                      "data": base64.b64encode(img_bytes).decode()}})
    payload = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": max_tokens},
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        res = await client.post(f"{GEMINI_BASE}/{model}:generateContent?key={key}",
                                headers={"Content-Type": "application/json"}, json=payload)
    if res.status_code != 200:
        raise Exception(f"Google ({res.status_code}): {res.text[:300]}")
    cands = res.json().get("candidates", [])
    if not cands:
        raise Exception("Google no devolvió candidatos")
    return cands[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()


async def _call_fal(prompt: str, images, model: str, max_tokens: int, timeout: int) -> str:
    key = _env("FAL_KEY")
    if not key:
        raise RuntimeError("FAL_KEY no configurada")

    # El router de fal toma las imágenes como data URLs en image_urls.
    image_urls = [
        f"data:{mime};base64,{base64.b64encode(b).decode()}"
        for b, mime in images
    ]
    payload = {"model": model, "prompt": prompt, "max_tokens": max_tokens}
    if image_urls:
        payload["image_urls"] = image_urls

    async with httpx.AsyncClient(timeout=timeout) as client:
        res = await client.post(FAL_VISION_URL,
                                headers={"Authorization": f"Key {key}",
                                         "Content-Type": "application/json"},
                                json=payload)
    if res.status_code != 200:
        raise Exception(f"Fal ({res.status_code}): {res.text[:300]}")
    d = res.json()
    # El router normaliza a {output} pero toleramos las otras formas conocidas.
    for k in ("output", "text", "response"):
        if isinstance(d.get(k), str) and d[k].strip():
            return d[k].strip()
    if isinstance(d.get("choices"), list) and d["choices"]:
        msg = d["choices"][0].get("message", {})
        if isinstance(msg.get("content"), str):
            return msg["content"].strip()
    raise Exception(f"Fal: respuesta inesperada: {json.dumps(d)[:200]}")


_BACKENDS = {"google": _call_google, "fal": _call_fal}


async def call(
    prompt: str,
    images: list[tuple[bytes, str]] | None = None,
    task: str = TASK_VISION_FAST,
    max_tokens: int | None = None,
    timeout: int | None = None,
) -> str:
    """Punto único de salida a un LLM.

    Elige proveedor+modelo según la tarea y, si el primario falla, cae al
    siguiente disponible. Levanta excepción solo si fallan TODOS — así un
    bloqueo de proveedor degrada la feature en vez de tumbar la plataforma.
    """
    images = images or []
    provider, model = resolve(task)
    is_heavy = task == TASK_VISION_VIDEO or "opus" in model.lower() or "pro" in model.lower()
    max_tokens = max_tokens or (16000 if is_heavy else 8000)
    timeout = timeout or (180 if is_heavy else 60)

    # primario primero, después el resto de los que tengan credencial
    order = [provider] + [p for p in _FALLBACK_ORDER
                          if p != provider and p in available_providers()]
    errors = []
    for p in order:
        backend = _BACKENDS.get(p)
        if not backend:
            continue
        # El modelo configurado vale SOLO para su proveedor: un id de Gemini no
        # existe en fal y viceversa. Al caer a otro, se usa su equivalente.
        use_model = model if p == provider else _fallback_model(p, task)
        try:
            return await backend(prompt, images, use_model, max_tokens, timeout)
        except Exception as e:
            errors.append(f"{p}: {str(e)[:160]}")
            print(f"[llm_router] {task} falló en {p} ({use_model}) → {str(e)[:160]}", flush=True)
    raise Exception(f"Todos los proveedores fallaron para '{task}' — " + " | ".join(errors))


def _fallback_model(provider: str, task: str) -> str:
    """Modelo equivalente cuando caemos a un proveedor que no es el primario."""
    if provider == "google":
        return "gemini-3.1-pro-preview" if task == TASK_VISION_VIDEO else "gemini-2.5-flash"
    return "anthropic/claude-sonnet-5"


async def health() -> dict:
    """Estado real de cada proveedor — para diagnosticar sin leer logs.

    Nace del incidente de 2026-09: el análisis devolvía vacío en silencio y no
    había forma de saber si estaba caído o si el prompt era malo.
    """
    out = {}
    for p in ("fal", "google"):
        if p not in available_providers():
            out[p] = {"ok": False, "error": "sin credencial"}
            continue
        try:
            txt = await _BACKENDS[p]("Responde solo: OK", [], _fallback_model(p, TASK_TEXT), 20, 30)
            out[p] = {"ok": True, "respuesta": txt[:40]}
        except Exception as e:
            out[p] = {"ok": False, "error": str(e)[:200]}
    out["tareas"] = {t: {"proveedor": resolve(t)[0], "modelo": resolve(t)[1]}
                     for t in (TASK_VISION_FAST, TASK_VISION_VIDEO, TASK_WRITE_PROMPT, TASK_TEXT)}
    return out
