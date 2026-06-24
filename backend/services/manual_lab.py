"""
Manual Lab — Tool Suggestion Service
─────────────────────────────────────
Lightweight Gemini call that, given a free-form prompt the user is about to send
to Nano Banana / Kling, decides whether one of the structured pipelines would
serve them better. Non-blocking: returns either a tool_id + reason, or null.
"""

import base64
import json
from typing import Optional

import httpx

from services.copy_gen import _call_gemini
from services.image_analysis import _call_vision


SUGGESTABLE_TOOLS = {
    "ugc_creator": "UGC video with avatar talking to camera. Lip-sync, multi-scene. Pick this when the user wants someone speaking on camera, testimonials, product demos with voice, reviews.",
    "video_ad_creator": "Storyboard-driven video ad. Multi-frame animated with Kling. Pick when user wants a cinematic ad with multiple shots and a narrative arc.",
    "fashion_reel": "Fashion/lifestyle reel — pure movement, no dialogue. Pick when user wants a model walking/posing across multiple shots, lookbook vibes, fashion editorial.",
    "product_clip": "Frame-to-frame product video. No people. Pick when user wants e-commerce product motion, packshot animations, Amazon-style.",
    "static_ad": "Single static ad creative with composition templates. Pick when user wants ONE polished still ad for Meta/IG.",
    "carousel_creator": "Multi-slide carousel (3-6 slides). Pick when user mentions a carousel, swipe, or multi-slide post.",
    "ad_creative_lab": "Batch of N ad creatives from a visual guide. Pick when user wants multiple variants for A/B testing.",
    "product_spotlight": "Professional product photography variations. Pick when user wants product images in context with N variants.",
}


def is_configured() -> bool:
    import os
    return bool(os.getenv("GEMINI_API_KEY"))


async def suggest_tool(prompt: str, mode: str, has_refs: bool) -> dict:
    """
    Returns: {"tool_id": str | None, "reason": str}

    None means "stay in Manual Lab — no pipeline is a clearly better fit".
    Only suggest when the match is strong; otherwise return null.
    """
    if not prompt or not prompt.strip():
        return {"tool_id": None, "reason": ""}

    tools_block = "\n".join([f"- {tid}: {desc}" for tid, desc in SUGGESTABLE_TOOLS.items()])

    system_prompt = f"""You decide whether a user's free-form image/video generation request would be better served by one of the structured pipelines below, or by staying in Manual Lab (one-off generation).

Manual Lab is good for: single shots, exploring an idea, quick edits, mixing arbitrary references. The user IS already in Manual Lab — you should ONLY suggest a pipeline when the match is *strong and obvious*. Otherwise return null.

Available pipelines:
{tools_block}

User mode: {mode} (image or video)
Has reference images attached: {has_refs}

Respond with JSON ONLY in this exact shape:
{{"tool_id": "<one of the ids above, or null>", "reason": "<one short sentence explaining why, in Spanish>"}}

Rules:
- Set tool_id to null unless the user's prompt clearly describes a multi-step or multi-shot output that Manual Lab cannot handle in one shot.
- Single image, single shot, single edit → ALWAYS null.
- Single short video clip from one image → ALWAYS null (Manual Lab handles this).
- Mentions of "carrusel", "carousel", "múltiples slides", "swipe" → carousel_creator.
- Mentions of "ugc", "testimonio", "hablando a cámara", "lip sync", "voiceover" → ugc_creator.
- Mentions of "reel", "lookbook", "modelo caminando", "varias poses", "moda" → fashion_reel.
- Mentions of "ad", "anuncio cinematográfico", "storyboard", "varias tomas" → video_ad_creator.
- Mentions of "producto rotando", "packshot animado", "frame to frame" → product_clip.
- Mentions of "varios variantes", "A/B test", "batch de creatividades" → ad_creative_lab.
"""

    user_msg = f"User prompt: {prompt.strip()[:1500]}"

    try:
        raw = await _call_gemini(system_prompt, user_msg)
    except Exception:
        return {"tool_id": None, "reason": ""}

    clean = raw.strip().replace("```json", "").replace("```", "").strip()
    try:
        data = json.loads(clean)
    except Exception:
        return {"tool_id": None, "reason": ""}

    tool_id = data.get("tool_id")
    if tool_id and tool_id not in SUGGESTABLE_TOOLS:
        tool_id = None
    return {
        "tool_id": tool_id,
        "reason": str(data.get("reason", ""))[:240],
    }


# ══════════════════════════════════════════════════════════════
#  Prompt Enhancement (Gemini Vision)
# ══════════════════════════════════════════════════════════════

ENHANCE_SYSTEM_PROMPT_IMAGE = """You are an expert image-editing prompt engineer for {model_name}.

The user will give you a casual request in any language, optionally referencing attached images by [imageN] tokens. The attached images are passed to you as inline content in the same order as their tags. You can SEE them — describe what you see when relevant.

Your job: rewrite the user's request as a polished, specific image-generation prompt that {model_name} will execute well.

OUTPUT FORMAT (exactly):
- First line: `QUÉ ENTENDÍ: <una frase corta en español resumiendo qué entendiste del pedido del usuario y qué vas a cambiar/hacer>`.
- Then a new line, and then ONLY the final prompt text in English — no quotes, no other preamble.

How {model_name} reads its reference images (follow this exactly):
{model_rules}

How {model_name} responds best — apply this craft when writing the prompt:
{model_playbook}

Rules:
- Reference images by "Image 1", "Image 2", etc. (matching the position they were attached). Replace any [imgN] or [imageN] tokens in the user's text with "Image N".
- Start with a short "REFERENCE IMAGES:" block listing each image's role (e.g. "Image 1: the woman to feature", "Image 2: the garment to put on her") IF there are references. Skip the block if no references.
- Be photographic and concrete: lighting, composition, framing, pose, materials, surface, depth.
- If the user asks to change visible text (e.g. "que diga X en vez de Y"), be explicit: "Replace the text 'Y' (currently visible on the {{element}}) with 'X', preserving the original typography, color, weight, and placement."
- If the user mentions framing/cropping ("que se vea entera", "full body", "tight crop"), be explicit about it.
- Preserve the user's intent — DO NOT invent unrequested elements (background changes, mood, props) unless the user asked.
- Output language: English (target models perform better in English) UNLESS the user wrote a long Spanish creative brief that should keep its character.
- Aim for 1-3 sentences for simple edits, 3-6 sentences for complex composites. Don't pad.
- End with terse style hints if missing: photorealistic, sharp focus, natural lighting — only when relevant.
"""

# How each image model consumes multi-image references. Built from each model's docs
# (Gemini/Nano Banana: peers; GPT Image: first image = base). Add new models here —
# the enhancer wires the matching block into the system prompt per target_model.
MODEL_REF_RULES = {
    "nano-banana-2": (
        "Every reference image is an EQUAL PEER (supports up to ~14 images) — there is NO fixed 'base' image. "
        "Give each image an explicit role and spell out exactly what to take from each, and how they relate "
        "(e.g. \"keep the person and face from Image 1, put the garment from Image 2 on them, use Image 3 for the background\"). "
        "It fuses references well, so be concrete about every image's contribution."
    ),
    "gpt-image-2": (
        "The FIRST image (Image 1) is the BASE that gets edited — it is preserved with the most fidelity, "
        "especially faces. Image 2 and beyond are references/context only, NOT edited. "
        "So phrase the prompt as editing Image 1 (\"Edit Image 1: ...\") and pull specifics from the others "
        "(\"using Image 2 as the color/style reference\", \"add the product shown in Image 3\"). "
        "The main subject / identity / face must be Image 1 — never put the base anywhere but first."
    ),
}


def _model_rules_for(target_model: str) -> str:
    return MODEL_REF_RULES.get(target_model, MODEL_REF_RULES["nano-banana-2"])


# Playbook por modelo — el "craft" que aprendimos de cada generador, MÁS ALLÁ de
# cómo consume las referencias (eso vive en MODEL_REF_RULES). Es la única fuente de
# verdad de cómo promptear bien cada modelo; el curador la inyecta según target_model.
# Mantener en sync con los principios aplicados en los templates de los tools
# (ej. CAMERA_LIGHTING / REALISM_NEGATIVES en frontend/src/tools/ecommerce_pack).
MODEL_PLAYBOOK = {
    "nano-banana-2": (
        "- Use concrete PHOTOGRAPHIC language (camera body, lens, aperture, lighting direction, "
        "color temperature in Kelvin, backdrop) — it outperforms vague adjectives like 'beautiful' or 'professional'.\n"
        "- Strong NEGATIVES work well: when realism matters, explicitly forbid illustration, 3D/CGI render, "
        "AI-generated look, plastic/waxy skin, over-retouched airbrushed perfection and oversaturated colors.\n"
        "- For real skin/fabric, name the texture (visible pores, fine skin texture, fabric weave, stitching, "
        "natural folds) and forbid smoothing/airbrushing — it defaults to a soft plastic look otherwise.\n"
        "- For identity/faces, put the identity reference FIRST and demand photographic fidelity; it tends to "
        "average or idealize faces when the identity is just one reference among many.\n"
        "- Pose transfer works best with exactly TWO images (subject + pose reference) plus an explicit instruction "
        "to take ONLY body posture and framing from the pose ref and ignore its face, clothing and background.\n"
        "- Known weak spots — compensate, don't lean on them: it UNDER-applies a color grade asked by text alone "
        "(be forceful and concrete if a grade is needed), and a light 'enhance/upscale' edit returns a near-identical "
        "image (it does not synthesize new detail), so bake realism into the generation itself."
    ),
    "gpt-image-2": (
        "- It follows instructions literally and in order — write clear, declarative, well-structured prompts.\n"
        "- It renders legible TEXT/typography far better than most models — when the user wants words in the image, "
        "spell them out exactly and describe their placement, weight and color.\n"
        "- Be explicit about what to keep vs change; it preserves the first (base) image strongly."
    ),
}


def _model_playbook_for(target_model: str) -> str:
    return MODEL_PLAYBOOK.get(target_model, MODEL_PLAYBOOK["nano-banana-2"])


ENHANCE_SYSTEM_PROMPT_VIDEO = """You are an expert motion-prompt engineer for Kling V3 Pro (image-to-video).

The user gives a casual request describing how a static image (Image 1, attached) should animate. Produce a tight motion prompt that Kling will execute well.

OUTPUT FORMAT (exactly):
- First line: `QUÉ ENTENDÍ: <una frase corta en español de qué movimiento vas a aplicar>`.
- Then a new line, and then ONLY the final motion prompt in English — no quotes, no other preamble.

Rules:
- Describe MOTION, not the scene: what moves, how it moves, camera behavior.
- Be concrete: "subtle hair sway, fabric flowing left, slow push-in by camera" beats "dynamic motion".
- 1-2 short sentences max. Kling prefers terse motion prompts.
- Output in English.
- If the user mentions a vibe (cinematic, calm, dramatic), include it.
"""


async def _fetch_image_bytes(url: str) -> tuple[bytes, str]:
    """Resolve an image URL (http://, https://, /static/..., or data:) to (bytes, mime)."""
    if url.startswith("data:"):
        # data:image/png;base64,XXXX
        header, _, b64 = url.partition(",")
        mime = header.split(";")[0].split(":", 1)[-1] or "image/png"
        return base64.b64decode(b64), mime

    fetch_url = url
    if url.startswith("/static/"):
        fetch_url = f"http://localhost:8000{url}"

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.get(fetch_url)
        res.raise_for_status()
        mime = res.headers.get("content-type", "image/jpeg").split(";")[0]
        return res.content, mime


# Prompt interpretation/curation benefits from the stronger model (better at nuanced edits
# like "más porosa", "sin tocar el fondo"). Kept separate from the fast 2.5-flash used elsewhere.
ENHANCE_MODEL = "gemini-3.1-pro-preview"


def _split_interpretation(raw: str) -> tuple[str, str]:
    """The model starts its output with a 'QUÉ ENTENDÍ: ...' line (Spanish gloss of what it
    understood), then the final prompt. Returns (interpretation_es, prompt). Falls back to
    ('', raw) if the marker is absent."""
    text = (raw or "").strip()
    lines = text.split("\n")
    if lines:
        head = lines[0].strip()
        if head.upper().startswith("QUÉ ENTENDÍ") or head.upper().startswith("QUE ENTENDI"):
            interp = head.split(":", 1)[1].strip() if ":" in head else ""
            prompt = "\n".join(lines[1:]).strip()
            if prompt[:3] in ("---", "==="):  # drop an optional separator line
                prompt = prompt.split("\n", 1)[1].strip() if "\n" in prompt else ""
            return interp, prompt
    return "", text


async def enhance_prompt(
    user_input: str,
    refs: list[dict],  # [{tag, label, url}]
    mode: str = "image",  # "image" | "video"
    target_model: str = "nano-banana-2",
) -> dict:
    """Take a casual user request + reference images and produce a polished prompt for the
    target model. Returns {"enhanced": <english prompt>, "interpretation": <spanish gloss>}."""
    user_input = (user_input or "").strip()
    if not user_input:
        # Video + an image but no text → recommend a motion from the image itself.
        if mode == "video" and refs:
            user_input = "Recommend a tasteful, natural animation for this image. Decide the motion yourself based on what you see."
        else:
            return {"enhanced": "", "interpretation": ""}

    # Try to fetch each ref's bytes for Vision input — skip refs we can't resolve
    images: list[tuple[bytes, str]] = []
    resolved_refs: list[dict] = []
    for r in refs[:6]:  # cap to 6 to keep latency reasonable
        url = r.get("url", "")
        if not url:
            continue
        try:
            data, mime = await _fetch_image_bytes(url)
            images.append((data, mime))
            resolved_refs.append(r)
        except Exception as e:
            print(f"[manual-enhance] Skipping ref {r.get('tag')}: {e}")

    model_name = "Nano Banana 2" if target_model == "nano-banana-2" else "GPT Image 2"
    # Image enhancer is model-aware (per-model reference rules); video is Kling-only.
    if mode == "image":
        system = ENHANCE_SYSTEM_PROMPT_IMAGE.format(
            model_name=model_name,
            model_rules=_model_rules_for(target_model),
            model_playbook=_model_playbook_for(target_model),
        )
    else:
        system = ENHANCE_SYSTEM_PROMPT_VIDEO

    refs_block = ""
    if resolved_refs:
        refs_block = "Attached reference images (in order):\n" + "\n".join(
            f"- [{r.get('tag')}] {r.get('label', '')}" for r in resolved_refs
        )

    full_prompt = f"{system}\n\n{refs_block}\n\nUser request:\n{user_input}\n\nOutput:".strip()

    if not images:
        # No images resolved — fall back to text-only Gemini (fast model is fine here).
        raw = await _call_gemini(system, f"{refs_block}\n\nUser request:\n{user_input}\n\nOutput:")
    else:
        raw = await _call_vision(full_prompt, images, model=ENHANCE_MODEL)

    interpretation, enhanced = _split_interpretation(raw)
    return {"enhanced": enhanced, "interpretation": interpretation}

