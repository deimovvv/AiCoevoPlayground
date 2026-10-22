"""
Agente de marca (openspec/changes/studio-v2 §7, M.3)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Arma la memoria de una marca solo: lee su web y su Instagram, y propone cada bloque.
Una persona revisa y aprueba bloque por bloque en Marca. Corre en el servidor (sin la Mac).

Pasos (cada uno se ve en la pantalla mientras corre):
  1. Leer la web             (httpx + BeautifulSoup)
  2. Leer el Instagram       (Apify, 12 posteos: textos + fotos)
  3. Quién es                (texto: contexto, tono, qué nunca dice) — criterio de la skill auditoria-creativa
  4. Identidad gráfica       (colores y tipografías, mirando las fotos)
  5. Dirección de foto       (estilo, luz, composición, siempre / nunca, mirando las fotos)
  6. Referencias             (hasta 6 fotos del Instagram al moodboard)

Regla: **no pisa lo que ya está cargado.** Sólo llena lo vacío y marca cada bloque que tocó como
`propuesto` en `brand.agent.blocks`, hasta que alguien lo apruebe.
LLM: `llm_router.call` (Gemini de Coevo o Fal; nunca una key de Monks).
"""
import asyncio
import json
import re
import time
import uuid
from typing import Dict, List, Optional

import httpx

from services import brands, instagram_scraper, llm_router

# Estado de cada corrida, por marca (en memoria: un solo proceso, como services/jobs.py).
RUNS: Dict[str, dict] = {}


class _Skip(Exception):
    pass

STEPS = [
    ("web", "Leer la web"),
    ("instagram", "Leer el Instagram"),
    ("quien", "Quién es"),
    ("identidad", "Identidad gráfica"),
    ("foto", "Dirección de foto"),
    ("refs", "Referencias al moodboard"),
]

CRITERIO = """Criterio de Coevo (aplicalo, no lo cites):
- Lo que una marca DICE vs lo que HACE: describí lo que hace, con evidencia de lo que leíste.
- Nada de frases de agencia ("innovadora", "de calidad", "experiencia única"). Concreto o nada.
- El tono se dice en adjetivos que un redactor pueda usar (ej. "seco, frontal, con humor").
- "Nunca dice": palabras o clichés que la marca evita o que la harían sonar genérica.
- Todo en español rioplatense, salvo que la marca hable en otro idioma."""


def state(brand_id: str) -> Optional[dict]:
    return RUNS.get(brand_id)


def _step(run: dict, key: str, status: str, note: str = "") -> None:
    for s in run["steps"]:
        if s["key"] == key:
            s["status"], s["note"] = status, note[:200]


def _json(text: str) -> dict:
    m = re.search(r"\{.*\}", text or "", re.S)
    if not m:
        raise ValueError("La respuesta no trajo JSON")
    raw = m.group(0)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Los errores típicos del modelo: comas de más antes de ] o }.
        return json.loads(re.sub(r",\s*([\]}])", r"\1", raw))


async def _read_web(url: str) -> str:
    from bs4 import BeautifulSoup
    if not url.startswith("http"):
        url = "https://" + url
    # Encabezados de navegador: varios hostings (ej. el de Hostinger, «hcdn») devuelven 403 a lo que no parece uno.
    headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
               "Accept": "text/html,application/xhtml+xml", "Accept-Language": "es-AR,es;q=0.9,en;q=0.8"}
    async with httpx.AsyncClient(timeout=25, follow_redirects=True, headers=headers) as c:
        r = await c.get(url)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    for t in soup(["script", "style", "noscript", "svg"]):
        t.decompose()
    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    meta = " ".join(m.get("content", "") for m in soup.find_all("meta") if m.get("name") in ("description", "og:description") or m.get("property") == "og:description")
    body = re.sub(r"\s+", " ", soup.get_text(" ", strip=True))
    return f"{title}\n{meta}\n{body}"[:14000]


async def _read_instagram(handle: str) -> tuple:
    """(textos, [(bytes, mime)] hasta 6 fotos, [url local por foto])."""
    items = await instagram_scraper.scrape_profile(handle, posts_limit=12)
    captions, imgs, saved = [], [], []
    for it in items:
        if it.get("caption"):
            captions.append(it["caption"][:400])
    for it in items:
        if len(imgs) >= 6:
            break
        try:
            post = await instagram_scraper.normalize_post(it, download_locally=True)
        except Exception:
            continue
        local = (post.get("slides") or [{}])[0].get("url") or post.get("thumbnail")
        if not local or not local.startswith("/static/ig-imports/"):
            continue
        path = instagram_scraper.get_ig_imports_dir() / local.rsplit("/", 1)[1]
        if path.is_file():
            imgs.append((path.read_bytes(), "image/jpeg"))
            saved.append(str(path))
    return "\n---\n".join(captions)[:6000], imgs, saved


async def _ask(prompt: str, images=None) -> dict:
    task = llm_router.TASK_VISION_FAST if images else llm_router.TASK_TEXT
    # Gemini de Coevo primero (barato); si falla, el router cae a Fal. Si el JSON viene roto, un reintento.
    for attempt in range(2):
        text = await llm_router.call(prompt + ("\n\nIMPORTANTE: devolvé JSON válido, sin texto alrededor." if attempt else ""),
                                     images=images or [], task=task, max_tokens=4000, timeout=90, provider="google")
        try:
            return _json(text)
        except (ValueError, json.JSONDecodeError):
            if attempt:
                raise ValueError("El modelo no devolvió JSON válido dos veces seguidas")
    return {}


def _empty(v) -> bool:
    return v in (None, "", [], {}) or (isinstance(v, dict) and not any(v.values()))


async def _run(brand_id: str, web: Optional[str], instagram: Optional[str]) -> None:
    run = RUNS[brand_id]
    web_text, ig_text, ig_imgs, ig_paths = "", "", [], []
    touched: List[str] = []

    # 1-2. Leer
    if web:
        _step(run, "web", "running")
        try:
            web_text = await _read_web(web)
            _step(run, "web", "done", f"{len(web_text):,} caracteres".replace(",", "."))
        except Exception as e:
            _step(run, "web", "error", f"No se pudo leer: {str(e)[:120]}")
    else:
        _step(run, "web", "skipped", "Sin web")
    if instagram:
        _step(run, "instagram", "running")
        try:
            if not instagram_scraper.is_configured():
                raise RuntimeError("Falta APIFY_API_KEY en el servidor")
            ig_text, ig_imgs, ig_paths = await _read_instagram(instagram)
            _step(run, "instagram", "done", f"{len(ig_imgs)} fotos y sus textos")
        except Exception as e:
            _step(run, "instagram", "error", str(e)[:160])
    else:
        _step(run, "instagram", "skipped", "Sin Instagram")

    b = brands.find_brand(brands.load_brands(), brand_id) or {}
    material = "\n\n".join(x for x in [
        f"=== WEB ===\n{web_text}" if web_text else "",
        f"=== INSTAGRAM (textos de los últimos posteos) ===\n{ig_text}" if ig_text else "",
        f"=== LO QUE YA TENEMOS ===\n{b.get('brandContext', '')}" if b.get("brandContext") else "",
    ] if x)
    if not material and not ig_imgs:
        for k in ("quien", "identidad", "foto", "refs"):
            _step(run, k, "skipped", "No hubo material para leer")
        run["status"] = "error"
        run["error"] = "No se pudo leer ni la web ni el Instagram."
        return

    # 3. Quién es
    _step(run, "quien", "running")
    quien = {}
    try:
        quien = await _ask(f"""Sos estratega creativo de Coevo. Leé el material de la marca "{b.get('name')}" y describila.
{CRITERIO}

Devolvé SOLO JSON:
{{"contexto": "3-5 oraciones: qué hace, para quién, qué la hace distinta (concreto)",
  "propuesta": "una oración: por qué la elige la gente",
  "tono": ["3-5 adjetivos"], "nunca": ["3-6 palabras o clichés que evita"],
  "palabras_clave": ["5-10"], "personalidad": "1-2 oraciones", "audiencia": "1-2 oraciones"}}

{material}""")
        _step(run, "quien", "done", (quien.get("propuesta") or "")[:140])
    except Exception as e:
        _step(run, "quien", "error", str(e)[:160])

    # 4-5. Identidad y dirección de foto (mirando las fotos)
    look = {}
    if not ig_imgs:
        _step(run, "identidad", "skipped", "Sin fotos para mirar: pasale el Instagram")
        _step(run, "foto", "skipped", "Sin fotos para mirar: pasale el Instagram")
    else:
        _step(run, "identidad", "running")
        _step(run, "foto", "running")
    try:
        if not ig_imgs:
            raise _Skip()
        look = await _ask(f"""Sos director de arte de Coevo. Mirá las fotos de la marca "{b.get('name')}" (su Instagram) y el texto.
{CRITERIO}
Describí lo que SE VE, no lo que la marca dice de sí misma.

Devolvé SOLO JSON:
{{"colores": [{{"name": "nombre", "hex": "#rrggbb", "usage": "dónde aparece"}}] (4-6),
  "tipografias": {{"headline": "fuente de Google Fonts más parecida a sus títulos", "body": "idem textos"}},
  "estilo": "2-4 oraciones: estilo de foto (editorial, documental, estudio…)",
  "luz": "1-2 oraciones", "composicion": "1-2 oraciones", "color": "1-2 oraciones de tratamiento de color",
  "casting": "1-2 oraciones", "siempre": ["3-5"], "nunca": ["3-5"]}}

{material[:5000]}""", images=ig_imgs[:6])
        _step(run, "identidad", "done", " · ".join(c.get("hex", "") for c in look.get("colores", [])[:6]))
        _step(run, "foto", "done", (look.get("estilo") or "")[:140])
    except _Skip:
        pass
    except Exception as e:
        _step(run, "identidad", "error", str(e)[:160])
        _step(run, "foto", "error", str(e)[:160])

    # Guardar: sólo lo vacío
    all_b = brands.load_brands()
    br = brands.find_brand(all_b, brand_id)
    dna = dict(br.get("dna") or {})
    ds = dict(br.get("designSystem") or {})
    if quien:
        if _empty(br.get("brandContext")) and quien.get("contexto"):
            br["brandContext"] = quien["contexto"]
        bus = dict(br.get("business") or {})
        if _empty(bus.get("value_prop")) and quien.get("propuesta"):
            bus["value_prop"] = quien["propuesta"]
            br["business"] = bus
        for src, dst in (("tono", "tone"), ("nunca", "forbidden_words"), ("palabras_clave", "keywords"),
                         ("personalidad", "personality"), ("audiencia", "audience")):
            if _empty(dna.get(dst)) and quien.get(src):
                dna[dst] = quien[src]
        touched.append("quien")
    if look:
        if _empty(dna.get("colors")) and look.get("colores"):
            dna["colors"] = [c for c in look["colores"] if re.match(r"^#[0-9a-fA-F]{6}$", c.get("hex", ""))]
            touched.append("identidad")
        if _empty(br.get("fonts")) and look.get("tipografias"):
            br["fonts"] = {k: v for k, v in look["tipografias"].items() if v}
            if "identidad" not in touched:
                touched.append("identidad")
        for src, dst in (("estilo", "photoStyle"), ("luz", "lighting"), ("composicion", "composition"),
                         ("color", "colorTreatment"), ("casting", "casting"), ("siempre", "visualDos"), ("nunca", "visualDonts")):
            if _empty(ds.get(dst)) and look.get(src):
                ds[dst] = look[src]
        touched.append("foto")
    br["dna"], br["designSystem"] = dna, ds

    # 6. Referencias: hasta 6 fotos del Instagram al moodboard (si hay lugar)
    _step(run, "refs", "running")
    added = 0
    moods = br.setdefault("moodboards", [])
    for p in ig_paths:
        if len(moods) >= 24:
            break
        from pathlib import Path
        data = Path(p).read_bytes()
        item_id = uuid.uuid4().hex[:8]
        filename = f"{brand_id}_mood_{item_id}.jpg"
        (brands.get_moodboards_dir() / filename).write_bytes(data)
        moods.append({"id": item_id, "name": "Instagram", "description": "Traída por el agente de marca",
                      "filename": filename, "imageUrl": f"/static/moodboards/{filename}"})
        added += 1
    _step(run, "refs", "done" if added else "skipped", f"{added} fotos al moodboard" if added else "Sin fotos para sumar")

    agent = dict(br.get("agent") or {})
    blocks = dict(agent.get("blocks") or {})
    for k in touched:
        blocks[k] = "propuesto"
    br["agent"] = {**agent, "blocks": blocks, "lastRun": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                   "sources": {"web": web, "instagram": instagram}}
    brands.save_brands(all_b)
    run["status"] = "done"
    run["touched"] = touched


def start(brand_id: str, web: Optional[str], instagram: Optional[str]) -> dict:
    cur = RUNS.get(brand_id)
    if cur and cur["status"] == "running":
        return cur
    RUNS[brand_id] = {"status": "running", "started": time.time(), "error": None, "touched": [],
                      "steps": [{"key": k, "label": l, "status": "pending", "note": ""} for k, l in STEPS]}

    async def wrap():
        try:
            await _run(brand_id, web, instagram)
        except Exception as e:  # noqa: BLE001 — el error se muestra en la pantalla
            RUNS[brand_id].update(status="error", error=str(e)[:300])

    asyncio.create_task(wrap())
    return RUNS[brand_id]


def approve(brand_id: str, block: str) -> dict:
    all_b = brands.load_brands()
    br = brands.find_brand(all_b, brand_id)
    blocks = dict((br.get("agent") or {}).get("blocks") or {})
    blocks.pop(block, None)
    br["agent"] = {**(br.get("agent") or {}), "blocks": blocks}
    brands.save_brands(all_b)
    return br
