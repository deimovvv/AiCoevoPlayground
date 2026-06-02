"""
Gemini Chat Service
───────────────────
Multi-turn chat with brand context injected as system prompt. Supports image
attachments per message for visual brainstorming (Gemini Vision multimodal).
Uses PromptBuilder for dynamic prompt assembly.
"""

import json
import os
import re
import httpx
from typing import List, Dict

from services.prompt_builder import build_chat_system_prompt

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


def is_configured() -> bool:
    return bool(GEMINI_API_KEY)


def _gemini_url() -> str:
    return f"{GEMINI_BASE}/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"


def _image_to_part(img: dict) -> dict:
    """Build a Gemini inline_data part from an image dict {data, mime}.
    `data` may be a raw base64 string or a full data: URL — both are handled."""
    data = (img.get("data") or "").strip()
    mime = img.get("mime") or "image/jpeg"
    if data.startswith("data:"):
        header, _, b64 = data.partition(",")
        mime = (header.split(";")[0].split(":", 1)[-1]) or mime
        data = b64
    return {"inline_data": {"mime_type": mime, "data": data}}


def _msg_parts(msg: dict) -> list:
    """Parts list for one chat message — text first, then any attached images."""
    parts: list = []
    text = msg.get("content") or ""
    if text:
        parts.append({"text": text})
    for img in (msg.get("images") or [])[:4]:  # cap at 4 imgs/msg to keep payload sane
        try:
            parts.append(_image_to_part(img))
        except Exception as e:
            print(f"[chat] skipping bad image: {e}")
    if not parts:
        parts.append({"text": ""})  # Gemini requires at least one part
    return parts


async def chat(
    brand: dict,
    messages: List[Dict],
) -> str:
    """
    Send a multi-turn chat to Gemini with brand context.
    messages: list of {"role": "user"|"assistant", "content": "...", "images"?: [{data,mime}]}
    Returns the assistant's reply text.
    """
    if not GEMINI_API_KEY:
        raise RuntimeError("Gemini API key not configured. Add GEMINI_API_KEY to your .env file.")

    system_prompt = build_chat_system_prompt(brand)

    # Build Gemini contents array: system context as first user message, then conversation
    contents = []

    # Inject system prompt as the first user turn
    contents.append({
        "role": "user",
        "parts": [{"text": system_prompt + "\n\n---\n\nAcknowledge that you understand the brand context. Be brief."}],
    })
    contents.append({
        "role": "model",
        "parts": [{"text": "Understood. I'm ready to help with creative tasks for this brand."}],
    })

    # Append conversation history (text + any attached images)
    for msg in messages:
        role = "model" if msg["role"] == "assistant" else "user"
        contents.append({
            "role": role,
            "parts": _msg_parts(msg),
        })

    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": 0.85,
            "maxOutputTokens": 4000,
        },
    }

    async with httpx.AsyncClient(timeout=90) as client:
        res = await client.post(
            _gemini_url(),
            headers={"Content-Type": "application/json"},
            json=payload,
        )

    if res.status_code != 200:
        raise Exception(f"Gemini error ({res.status_code}): {res.text[:300]}")

    result = res.json()
    candidates = result.get("candidates", [])
    if not candidates:
        raise Exception(f"No candidates in Gemini response: {result}")

    text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
    return text


# ══════════════════════════════════════════════════════════════
#  chat_prompts — Gemini suggests image prompt candidates from the conversation
#  + attached refs. Returns {reply: <Spanish chat reply>, prompts: [{title, prompt, why?}]}
#  Prompts stay model-agnostic (no "Image 1" hard-coding) — the Lab's Preparar
#  adapts them when refs are added (text-to-image vs image-to-image).
# ══════════════════════════════════════════════════════════════

PROMPTS_SYSTEM_TEMPLATE = """You are a creative director that brainstorms IMAGE PROMPTS for the brand based on the user's request and any attached reference images they show you in the chat.

BRAND CONTEXT (tone, references, what NOT to do):
---
{brand_context}
---

You output candidates that will be tested in an image generator (Nano Banana 2 / GPT Image 2). The user may use them as text-to-image OR pass references along — so write FLEXIBLE creative directions, not hard-coded "Image 1: ..." legends. The Lab adapts the structure when references are attached.

Read the conversation. Consider any images the user attached as visual references for the brief. If the user is asking for prompts, propose 1-3 distinct angles (different vibes / framings / lighting / palettes). If the user is iterating (e.g. "más oscuro", "más editorial"), refine the previous direction instead of starting from scratch.

Return ONLY a JSON object (no markdown, no preamble), with this shape:
{{
  "reply": "una respuesta corta y canchera en español (Argentina), 1-2 frases — resumí qué dirección le diste y mandalo a probar las cards",
  "prompts": [
    {{
      "title": "título corto en español (≤6 palabras)",
      "prompt": "the polished IMAGE prompt in ENGLISH — concrete, photographic, no quotes, no preamble. Includes lighting, mood, composition, color when relevant. Do NOT write 'Image 1: ...' legends.",
      "why": "una línea en español explicando el ángulo (≤120 chars)"
    }}
  ]
}}"""


async def chat_prompts(brand: dict, messages: List[Dict]) -> dict:
    """Suggest 1-3 image prompt candidates based on the chat + any attached refs.
    Output JSON: {reply, prompts:[{title, prompt, why?}]}. Falls back to {reply, prompts:[]}
    on parse failure (the chat surfaces the reply text)."""
    if not GEMINI_API_KEY:
        raise RuntimeError("Gemini API key not configured.")

    brand_context = (brand or {}).get("brandContext", "") or "(no specific brand context — use a tasteful default editorial look)"
    system = PROMPTS_SYSTEM_TEMPLATE.format(brand_context=brand_context)

    contents = []
    contents.append({"role": "user", "parts": [{"text": system + "\n\nAcknowledge briefly and wait for the conversation."}]})
    contents.append({"role": "model", "parts": [{"text": "Listo, mostrame el chat."}]})
    # Append the live conversation (text + images)
    for msg in messages or []:
        role = "model" if msg.get("role") == "assistant" else "user"
        contents.append({"role": role, "parts": _msg_parts(msg)})
    contents.append({"role": "user", "parts": [{"text": "Devolvé SOLO el JSON con 'reply' y 'prompts' como te indiqué. Nada antes, nada después."}]})

    payload = {
        "contents": contents,
        "generationConfig": {"temperature": 0.85, "maxOutputTokens": 2000, "responseMimeType": "application/json"},
    }

    async with httpx.AsyncClient(timeout=90) as client:
        res = await client.post(_gemini_url(), headers={"Content-Type": "application/json"}, json=payload)

    if res.status_code != 200:
        raise Exception(f"Gemini error ({res.status_code}): {res.text[:300]}")

    raw = res.json().get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
    clean = raw.replace("```json", "").replace("```", "").strip()
    obj: dict = {}
    try:
        obj = json.loads(clean)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", clean, re.DOTALL)
        if m:
            try:
                obj = json.loads(m.group(0))
            except json.JSONDecodeError:
                obj = {}
    if not isinstance(obj, dict):
        obj = {}

    reply = (obj.get("reply") or "").strip() or "Te dejo unas opciones para probar:"
    raw_prompts = obj.get("prompts") or []
    prompts: list = []
    for p in raw_prompts if isinstance(raw_prompts, list) else []:
        if not isinstance(p, dict):
            continue
        prompt_text = (p.get("prompt") or "").strip()
        if not prompt_text:
            continue
        prompts.append({
            "title": (p.get("title") or "Variante").strip()[:80],
            "prompt": prompt_text,
            "why": ((p.get("why") or "").strip()[:240]) or None,
        })

    return {"reply": reply, "prompts": prompts[:3]}


# ══════════════════════════════════════════════════════════════
#  chat_voice — short, conversational, spoken-aloud replies.
#  Used by the Voice Lab (browser STT → Gemini → ElevenLabs TTS).
#  Forbids markdown, lists, code blocks — the reply gets sent to TTS as-is.
# ══════════════════════════════════════════════════════════════

VOICE_SYSTEM_TEMPLATE = """Sos un asistente de voz para el equipo creativo de una marca. La persona te habla por micrófono y tu respuesta se va a sintetizar con ElevenLabs y reproducir en voz alta. Reglas duras:

- Hablá en español rioplatense, natural, canchero pero claro. Tuteá.
- MÁXIMO 2-3 frases por turno. Si te piden algo largo, resumí y ofrecé profundizar.
- PROHIBIDO: markdown, asteriscos, bullets, listas numeradas, bloques de código, emojis. Texto plano que se pueda leer en voz alta tal cual.
- No leas URLs literales — parafraseá ("podés verlo en su sitio").
- Si no entendiste lo que dijo el usuario (parece transcripción rota), pedile que repita en una frase, sin disculparte de más.

CONTEXTO DE MARCA (usalo cuando aplique, no lo recites):
---
{brand_context}
---
"""


async def chat_voice(brand: dict, messages: List[Dict]) -> str:
    """Generate a short spoken reply for the Voice Lab. Returns plain text — caller pipes to TTS."""
    if not GEMINI_API_KEY:
        raise RuntimeError("Gemini API key not configured.")

    brand_context = (brand or {}).get("brandContext", "") or "(sin marca activa — respondé como asistente creativo genérico)"
    system = VOICE_SYSTEM_TEMPLATE.format(brand_context=brand_context)

    contents = []
    contents.append({"role": "user", "parts": [{"text": system + "\n\nConfirmá brevemente que entendiste el rol y esperá la primera consigna por voz."}]})
    contents.append({"role": "model", "parts": [{"text": "Listo, decime."}]})
    for msg in messages or []:
        role = "model" if msg.get("role") == "assistant" else "user"
        contents.append({"role": role, "parts": _msg_parts(msg)})

    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": 0.7,
            # Keep replies short — they get spoken aloud. ~800 tokens ≈ a long minute of audio.
            "maxOutputTokens": 800,
        },
    }

    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(_gemini_url(), headers={"Content-Type": "application/json"}, json=payload)

    if res.status_code != 200:
        raise Exception(f"Gemini error ({res.status_code}): {res.text[:300]}")

    text = res.json().get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
    # Strip any markdown the model leaked despite the system prompt — TTS reads everything.
    text = re.sub(r"[*_`]+", "", text)
    text = re.sub(r"^\s*[-•]\s+", "", text, flags=re.MULTILINE)
    return text.strip() or "Perdón, no me salió. ¿Me lo repetís?"
