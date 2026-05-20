"""
Instagram Scraper (via Apify)
─────────────────────────────
Wraps Apify's apify/instagram-scraper actor to extract Instagram posts —
including all images of carousel posts.

Docs: https://apify.com/apify/instagram-scraper

Pricing: ~$0.0025-0.005 per post. Free tier covers ~1000-2000 scrapes/month.

Note: scraped image URLs (instagram.fxxx.fbcdn.net) are CORS-blocked from the browser,
so we proxy-download them to disk and serve them as local /static/ig-imports/ URLs.
"""

import os
import json
import base64
import httpx
import hashlib
from pathlib import Path
from typing import Optional


GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
GEMINI_MODEL = "gemini-2.5-flash"


# ── Local image cache (avoids CORS issues + keeps a copy) ──────
IG_IMPORTS_DIR = Path(__file__).parent.parent / "data" / "ig-imports"
IG_IMPORTS_DIR.mkdir(parents=True, exist_ok=True)


def get_ig_imports_dir() -> Path:
    return IG_IMPORTS_DIR

APIFY_BASE = "https://api.apify.com/v2"
APIFY_ACTOR = "apify~instagram-scraper"
# Use run-sync-get-dataset-items to wait for the run to complete and get results back in one call.
# Default timeout is generous because IG scraping can take 15-60s.
APIFY_TIMEOUT_S = 90


def _get_token() -> str:
    return os.getenv("APIFY_API_KEY") or os.getenv("APIFY_TOKEN", "")


def is_configured() -> bool:
    return bool(_get_token())


async def scrape_post(url: str) -> dict:
    """
    Scrape a single Instagram post (or carousel).
    Returns the first matching item from the dataset.

    Output shape (carousel example):
    {
      "url": "https://instagram.com/p/XXX/",
      "type": "Sidecar",                  # "Sidecar" = carousel, "Image" = single, "Video" = reel
      "shortCode": "XXX",
      "displayUrl": "https://...",        # main thumbnail
      "images": ["url1", "url2", ...],    # carousel slides (only on Sidecar type)
      "videoUrl": "https://...",          # for video posts
      "caption": "...",
      "likesCount": 1234,
      "commentsCount": 56,
      "ownerUsername": "marca",
      "timestamp": "2026-...",
      "alt": "...",                       # accessibility text
    }
    """
    token = _get_token()
    if not token:
        raise RuntimeError("APIFY_API_KEY not configured. Add it to backend/.env.")

    if not url or "instagram.com" not in url:
        raise ValueError("Invalid Instagram URL")

    # Apify's instagram-scraper expects directUrls for individual post scraping
    payload = {
        "directUrls": [url],
        "resultsType": "details",
        "resultsLimit": 1,
        "addParentData": False,
    }

    endpoint = f"{APIFY_BASE}/acts/{APIFY_ACTOR}/run-sync-get-dataset-items?token={token}"
    print(f"[apify-ig] Scraping: {url}")

    async with httpx.AsyncClient(timeout=APIFY_TIMEOUT_S) as client:
        res = await client.post(endpoint, json=payload)

    # Apify returns 200 OR 201 for successful run-sync — both mean the run finished.
    if res.status_code not in (200, 201):
        body = res.text[:500]
        raise Exception(f"Apify scrape failed (HTTP {res.status_code}): {body}")

    items = res.json()
    if not isinstance(items, list) or len(items) == 0:
        raise Exception("Apify returned no items — the URL might be private or invalid")

    item = items[0]
    print(f"[apify-ig] Got post: type={item.get('type')}, "
          f"images={len(item.get('images', []))}, "
          f"shortCode={item.get('shortCode')}")
    return item


async def scrape_profile(username_or_url: str, posts_limit: int = 12) -> list[dict]:
    """
    Scrape recent posts from an Instagram profile.
    Useful for analyzing a brand's recent feed (visual consistency, captions, etc.)
    """
    token = _get_token()
    if not token:
        raise RuntimeError("APIFY_API_KEY not configured.")

    # Normalize: accept username or full URL
    if username_or_url.startswith("http"):
        url = username_or_url
    else:
        username = username_or_url.lstrip("@").strip()
        url = f"https://www.instagram.com/{username}/"

    payload = {
        "directUrls": [url],
        "resultsType": "posts",
        "resultsLimit": posts_limit,
        "addParentData": False,
    }

    endpoint = f"{APIFY_BASE}/acts/{APIFY_ACTOR}/run-sync-get-dataset-items?token={token}"
    print(f"[apify-ig] Scraping profile: {url} (limit {posts_limit})")

    async with httpx.AsyncClient(timeout=APIFY_TIMEOUT_S * 2) as client:
        res = await client.post(endpoint, json=payload)

    if res.status_code not in (200, 201):
        raise Exception(f"Apify profile scrape failed (HTTP {res.status_code}): {res.text[:500]}")

    items = res.json()
    if not isinstance(items, list):
        raise Exception("Apify returned unexpected shape for profile scrape")
    return items


async def _download_to_local(url: str, short_code: str, idx: int) -> Optional[str]:
    """Download an IG image URL to disk and return its public /static/ path.
    Returns None on failure (caller should fall back to the original URL)."""
    if not url:
        return None
    # Stable filename based on shortCode + index → idempotent across reruns
    sha = hashlib.md5(url.encode()).hexdigest()[:8]
    filename = f"{short_code}_{idx}_{sha}.jpg"
    local_path = IG_IMPORTS_DIR / filename
    if local_path.exists() and local_path.stat().st_size > 0:
        return f"/static/ig-imports/{filename}"
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            res = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
        if res.status_code != 200 or len(res.content) < 100:
            print(f"[ig-download] HTTP {res.status_code} for slide {idx}")
            return None
        local_path.write_bytes(res.content)
        return f"/static/ig-imports/{filename}"
    except Exception as e:
        print(f"[ig-download] failed for slide {idx}: {e}")
        return None


async def normalize_post(item: dict, download_locally: bool = True) -> dict:
    """
    Normalize an Apify Instagram post into a Coevo-friendly shape.
    Returns:
      {
        "url": str,
        "type": "carousel" | "image" | "video",
        "shortCode": str,
        "thumbnail": str,
        "slides": [{"url": str, "alt": str?}],  # for carousels — single-element array for single posts
        "videoUrl": str?,
        "caption": str,
        "username": str,
        "likesCount": int,
        "commentsCount": int,
      }
    """
    raw_type = (item.get("type") or "").lower()
    type_map = {"sidecar": "carousel", "image": "image", "video": "video"}
    norm_type = type_map.get(raw_type, "image")

    short_code = item.get("shortCode", "") or "unknown"
    raw_images = item.get("images") or []
    raw_urls: list[str] = []
    if isinstance(raw_images, list) and raw_images:
        for url in raw_images:
            if isinstance(url, str) and url:
                raw_urls.append(url)
    elif item.get("displayUrl"):
        raw_urls.append(item["displayUrl"])

    # Download each slide locally so the browser can fetch it without CORS issues
    slides: list[dict] = []
    if download_locally:
        for idx, url in enumerate(raw_urls):
            local = await _download_to_local(url, short_code, idx)
            slides.append({"url": local or url, "originalUrl": url, "local": bool(local)})
    else:
        slides = [{"url": u, "originalUrl": u, "local": False} for u in raw_urls]

    # Thumbnail: prefer the first locally-downloaded slide
    thumbnail = slides[0]["url"] if slides else (item.get("displayUrl", "") or "")

    return {
        "url": item.get("url", ""),
        "type": norm_type,
        "shortCode": short_code,
        "thumbnail": thumbnail,
        "slides": slides,
        "videoUrl": item.get("videoUrl"),
        "caption": item.get("caption", "") or "",
        "username": item.get("ownerUsername", "") or "",
        "likesCount": item.get("likesCount", 0) or 0,
        "commentsCount": item.get("commentsCount", 0) or 0,
        "timestamp": item.get("timestamp"),
        "alt": item.get("alt"),
    }


# ── Replicate analysis: send all carousel slides to Gemini Vision ──

async def analyze_carousel_for_replication(
    normalized_post: dict,
    brand_summary: str,
    brand_language: str = "es",
) -> dict:
    """
    Send all slides + caption + brand context to Gemini Vision and ask it to:
      1. Describe the narrative arc of the original carousel.
      2. Produce a structured brief that adapts the same arc to the brand.

    Returns:
      {
        "narrative": [{ "slide": int, "role": str, "describes": str, "text_seen": str }, ...],
        "brief": str,         # ready-to-paste Creative Direction
        "numSlides": int,
        "platform": "instagram",
        "sourceUsername": str,
        "sourceUrl": str,
      }
    """
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY not configured")

    slides = normalized_post.get("slides", [])
    if not slides:
        raise ValueError("No slides to analyze")

    # Read each slide image as bytes from disk (we already downloaded them locally)
    parts: list[dict] = []
    parts.append({"text": _build_replication_prompt(normalized_post, brand_summary, brand_language)})

    for i, s in enumerate(slides[:10]):  # cap at 10 to keep prompt size sane
        local_url = s.get("url", "")
        if local_url.startswith("/static/ig-imports/"):
            filename = local_url.replace("/static/ig-imports/", "")
            local_path = IG_IMPORTS_DIR / filename
            if local_path.exists():
                img_bytes = local_path.read_bytes()
                b64 = base64.b64encode(img_bytes).decode("utf-8")
                parts.append({"inline_data": {"mime_type": "image/jpeg", "data": b64}})

    payload = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 4000,
            "responseMimeType": "application/json",
        },
    }

    print(f"[ig-replicate] Analyzing {len(slides)} slides with Gemini Vision...")

    async with httpx.AsyncClient(timeout=120) as client:
        res = await client.post(
            f"{GEMINI_BASE}/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}",
            headers={"Content-Type": "application/json"},
            json=payload,
        )

    if res.status_code != 200:
        raise Exception(f"Gemini Vision error ({res.status_code}): {res.text[:400]}")

    result = res.json()
    candidates = result.get("candidates", [])
    if not candidates:
        raise Exception(f"No response from Gemini Vision: {result}")

    content = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
    if content.startswith("```json"):
        content = content.replace("```json", "").replace("```", "").strip()
    elif content.startswith("```"):
        content = content.replace("```", "").strip()

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as e:
        print(f"[ig-replicate] JSON parse failed: {e}")
        print(f"[ig-replicate] Raw: {content[:600]}")
        raise Exception(f"Gemini devolvió JSON inválido: {str(e)[:150]}")

    return {
        "narrative": parsed.get("narrative", []),
        "brief": parsed.get("brief", ""),
        "numSlides": parsed.get("numSlides", len(slides)),
        "platform": "instagram",
        "sourceUsername": normalized_post.get("username", ""),
        "sourceUrl": normalized_post.get("url", ""),
    }


def _build_replication_prompt(post: dict, brand_summary: str, lang: str) -> str:
    caption = (post.get("caption") or "")[:1500]
    username = post.get("username") or "@unknown"
    n_slides = len(post.get("slides") or [])
    return f"""Sos un creative director. Te paso {n_slides} slides de un carrusel de Instagram (en orden) + el caption original + el contexto de marca del CLIENTE para el que vas a replicar.

CARRUSEL ORIGINAL: @{username}
CAPTION ORIGINAL:
{caption}

CONTEXTO DE LA MARCA CLIENTE:
{brand_summary[:6000]}

TU TAREA:
1. Mirá los {n_slides} slides en orden y entendé la narrativa del carrusel original.
2. Para CADA slide devolvé:
   - rol narrativo (hook / problem / data / explanation / case / cta / etc.)
   - qué muestra visualmente el ORIGINAL (composición, no marca específica)
   - qué texto se ve en el ORIGINAL (si lo hay)
   - **adapted_for_brand**: qué debería decir/mostrar la MARCA CLIENTE en ese slide, adaptado a su mensaje y producto. NO copies el contenido del original.
3. Generá un BRIEF corto (tema + tono + CTA) que enmarque el carrusel para la marca cliente.
4. RESPETÁ EL IDIOMA DE LA MARCA CLIENTE en todo lo que escribas.

REGLA CRÍTICA DE IDIOMA: si el contexto de marca está en español, respondé en español (rioplatense si es argentino). Si está en inglés, respondé en inglés. NUNCA mezcles idiomas.

REGLA CRÍTICA: el campo `adapted_for_brand` es OBLIGATORIO en cada slide. No lo dejes vacío. Cada slide debe tener `visual` (qué se muestra) y `text` (qué texto va).

Respondé con SOLO un objeto JSON, sin texto adicional:
{{
  "narrative": [
    {{
      "slide": 1,
      "role": "hook",
      "describes": "Qué muestra el slide ORIGINAL visualmente",
      "text_seen": "Texto visible en el slide original",
      "adapted_for_brand": {{
        "visual": "Qué debería mostrar este slide para la marca cliente (composición, sujeto, encuadre)",
        "text": "Texto sugerido en el idioma de la marca, tono incluido"
      }}
    }}
    // ... un objeto por cada uno de los {n_slides} slides
  ],
  "brief": "Tema: ...\\nTono: ...\\nCTA final: ...",
  "numSlides": {n_slides}
}}"""

