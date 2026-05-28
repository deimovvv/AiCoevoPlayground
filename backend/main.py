"""
UGC Video Generation API
━━━━━━━━━━━━━━━━━━━━━━━━
Thin routing layer — all logic lives in services/.
"""

import os
import io
import json
import uuid
import asyncio
import tempfile
from pathlib import Path
from typing import Optional, Dict, List
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# ── Load .env ────────────────────────────────────────────────
load_dotenv()

# ── Services ─────────────────────────────────────────────────
from services import tts, heygen, copy_gen, brands
from services import stt
from services import fal_lipsync
from services import kling_video
from services import image_gen
from services import video_concat
from services import chat as chat_service
from services import prompt_builder
from services import heygen_avatar4
from services import fal_synclipsync
from services import image_analysis
from services import agent as agent_service
from services import gpt_image_gen
from services import video_download
from services import apify_tiktok
from services import instagram_scraper
from services import manual_lab
from services import asset_matcher
from services import seedance_video
from services import beeble_switchx

# ── Paths ────────────────────────────────────────────────────
(Path(__file__).parent / "tmp").mkdir(exist_ok=True)

# ── App ──────────────────────────────────────────────────────
app = FastAPI(title="UGC Video Generation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded avatar images as static files
app.mount("/static/avatars", StaticFiles(directory=str(brands.get_avatars_dir())), name="avatars")
app.mount("/static/ig-imports", StaticFiles(directory=str(instagram_scraper.get_ig_imports_dir())), name="ig-imports")

# Serve uploaded product images as static files
app.mount("/static/products", StaticFiles(directory=str(brands.get_products_dir())), name="products")


# ══════════════════════════════════════════════════════════════
#  Models
# ══════════════════════════════════════════════════════════════

class TTSRequest(BaseModel):
    text: str
    voice_id: Optional[str] = None
    model_id: str = "eleven_v3"
    output_format: str = "mp3_44100_128"
    # Voice settings (ElevenLabs voice_settings)
    stability: Optional[float] = 0.5              # "Natural" ≈ 0.5 (balance expresividad/estabilidad)
    similarity_boost: Optional[float] = 0.8       # fidelidad al clon
    style: Optional[float] = 0.0                  # exageración de estilo (0 = natural)
    use_speaker_boost: Optional[bool] = True
    speed: Optional[float] = 1.0                  # velocidad de reproducción (0.7–1.2)


class LipSyncRequest(BaseModel):
    talking_photo_id: str
    audio_url: Optional[str] = None
    title: str = "UGC Lip Sync"


class CreateBrandRequest(BaseModel):
    name: str
    brandContext: str = ""


class BrandFonts(BaseModel):
    headline: Optional[str] = None
    body: Optional[str] = None
    accent: Optional[str] = None

class BrandDNA(BaseModel):
    colors: Optional[list[dict]] = None          # [{name, hex, usage}]
    tone: Optional[list[str]] = None             # ["friendly", "confident", "premium"]
    audience: Optional[str] = None               # "Mujeres 25-40, urbanas, ..."
    keywords: Optional[list[str]] = None         # brand keywords
    personality: Optional[str] = None            # 2-3 sentence brand personality
    competitors: Optional[list[str]] = None      # known competitors
    unique_value: Optional[str] = None           # unique value proposition
    forbidden_words: Optional[list[str]] = None  # words the brand never uses (auto + manual)


class DesignSystem(BaseModel):
    photoStyle: Optional[str] = None             # Overall visual/photography style
    composition: Optional[str] = None            # Framing, layout, product placement
    colorTreatment: Optional[str] = None         # Saturation, filters, color grading
    lighting: Optional[str] = None               # Lighting direction
    visualDos: Optional[list[str]] = None        # What to ALWAYS show
    visualDonts: Optional[list[str]] = None      # What to NEVER show
    references: Optional[str] = None             # Reference brands/moodboard description
    # Campaign Guidelines — operational visual rules
    casting: Optional[str] = None                # Model casting style ("young woman, natural makeup, ...")
    preferred_locations: Optional[list[str]] = None  # ["urban street", "minimal interior", "studio"]
    product_presentation: Optional[str] = None   # How the product is shown (hero / lifestyle / detail)
    motion_rules: Optional[str] = None           # Pacing, camera, transitions for video


class BrandBusiness(BaseModel):
    """Commercial structure of the brand — how it operates and what it sells."""
    model: Optional[str] = None                  # ecommerce | saas | academy | service | subscription | marketplace | d2c | agency
    description: Optional[str] = None            # 2-3 frases: qué vende, a quién, cómo se monetiza
    value_prop: Optional[str] = None             # Propuesta de valor central en 1 frase
    target_market: Optional[str] = None          # B2C/B2B + demo + psicográfico
    revenue_streams: Optional[list[str]] = None  # ["Subscription", "Direct sales", "Courses"]


class BrandSource(BaseModel):
    """A single piece of brand context. The brand can have many sources combined."""
    id: str
    type: str                                    # "url" | "pdf" | "text" | "instagram" | "tiktok" | "reviews" | "audio_transcript"
    label: Optional[str] = None                  # Human-readable label
    url: Optional[str] = None                    # For url-type sources
    content: Optional[str] = None                # Extracted text content
    addedAt: Optional[str] = None


class BrandCompetitor(BaseModel):
    name: str
    url: Optional[str] = None                    # Their site / IG
    notes: Optional[str] = None                  # What they do well / how the brand differentiates


class UpdateBrandRequest(BaseModel):
    name: Optional[str] = None
    brandContext: Optional[str] = None
    fonts: Optional[BrandFonts] = None
    dna: Optional[BrandDNA] = None
    designSystem: Optional[DesignSystem] = None
    business: Optional[BrandBusiness] = None
    brandSources: Optional[list[BrandSource]] = None
    competitors: Optional[list[BrandCompetitor]] = None
    customerReviews: Optional[list[str]] = None    # Plain-text reviews / testimonials


class GenerateCopyRequest(BaseModel):
    productName: str = ""
    tone: str = "engaging"
    platform: str = "tiktok"
    language: str = "es"
    additionalNotes: str = ""
    count: int = 1
    narrativeMode: bool = False


class RegenerateSceneRequest(BaseModel):
    scenes: List[dict]          # full script (all scenes) for context
    targetIndex: int            # which scene to rewrite
    language: str = "es"
    videoObjective: str = ""
    productName: str = ""


class AddHeygenAvatarRequest(BaseModel):
    talkingPhotoId: str
    name: str
    previewUrl: str


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    brandId: str
    messages: List[ChatMessage]


class SaveGenerationRequest(BaseModel):
    brandId: Optional[str] = None  # null for brand-agnostic generations (Manual Lab)
    toolId: str
    title: str
    type: str  # "video" | "image" | "copy"
    status: str = "completed"
    thumbnailUrl: Optional[str] = None
    outputUrl: Optional[str] = None
    scenes: Optional[List[dict]] = None
    metadata: Optional[dict] = None
    pipelineState: Optional[dict] = None  # Full pipeline: {steps, config, curationSelections}


# ══════════════════════════════════════════════════════════════
#  Health
# ══════════════════════════════════════════════════════════════

@app.get("/")
def read_root():
    return {"message": "Morph API is running"}


@app.get("/health")
def health():
    return {
        "status": "ok",
        "elevenlabs_configured": tts.is_configured(),
        "heygen_configured": heygen.is_configured(),
        "fal_configured": fal_lipsync.is_configured(),
        "openai_configured": copy_gen.is_configured(),
    }


# ══════════════════════════════════════════════════════════════
#  Tools System
# ══════════════════════════════════════════════════════════════

TOOLS_DIR = Path(__file__).parent / "tools"
DATA_DIR = Path(__file__).parent / "data"
TOOLS_JOBS: Dict[str, dict] = {}
GENERATIONS_FILE = DATA_DIR / "generations.json"


def _load_generations() -> List[dict]:
    if not GENERATIONS_FILE.exists():
        with open(GENERATIONS_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)
        return []
    with open(GENERATIONS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_generations(gens: List[dict]):
    with open(GENERATIONS_FILE, "w", encoding="utf-8") as f:
        json.dump(gens, f, indent=2, ensure_ascii=False)


def _load_registry() -> List[dict]:
    reg_path = TOOLS_DIR / "registry.json"
    if not reg_path.exists():
        return []
    with open(reg_path, "r", encoding="utf-8") as f:
        return json.load(f)


def _load_tool_config(tool_id: str) -> Optional[dict]:
    config_path = TOOLS_DIR / tool_id / "config.json"
    if not config_path.exists():
        return None
    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/tools")
def list_tools():
    registry = _load_registry()
    tools = []
    for entry in registry:
        # "hidden" tools are degraded: kept in the registry + their files/prompts intact,
        # just not shown in Generate. Flip the flag in registry.json to bring one back.
        if entry.get("hidden"):
            continue
        config = _load_tool_config(entry["id"])
        tools.append({**entry, **(config or {})})
    return {"tools": tools}


@app.get("/api/tools/{tool_id}")
def get_tool(tool_id: str):
    reg_entry = next((t for t in _load_registry() if t["id"] == tool_id), None)
    if not reg_entry:
        raise HTTPException(status_code=404, detail=f"Tool '{tool_id}' not found")
    config = _load_tool_config(tool_id) or {}
    return {**reg_entry, **config}


@app.post("/api/tools/{tool_id}/run")
async def run_tool(tool_id: str):
    config = _load_tool_config(tool_id)
    if not config:
        raise HTTPException(status_code=404, detail=f"Tool '{tool_id}' not found")

    script_path = TOOLS_DIR / tool_id / config.get("script", "run.py")
    if not script_path.exists():
        raise HTTPException(status_code=404, detail=f"Script not found for tool '{tool_id}'")

    job_id = str(uuid.uuid4())[:12]
    TOOLS_JOBS[job_id] = {"id": job_id, "tool_id": tool_id, "status": "running", "result": None, "error": None}

    async def _execute():
        try:
            proc = await asyncio.create_subprocess_exec(
                "python", str(script_path),
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
                cwd=str(TOOLS_DIR / tool_id),
            )
            stdout, stderr = await proc.communicate()
            if proc.returncode == 0:
                TOOLS_JOBS[job_id]["status"] = "completed"
                try:
                    TOOLS_JOBS[job_id]["result"] = json.loads(stdout.decode())
                except json.JSONDecodeError:
                    TOOLS_JOBS[job_id]["result"] = stdout.decode()
            else:
                TOOLS_JOBS[job_id]["status"] = "failed"
                TOOLS_JOBS[job_id]["error"] = stderr.decode()[:500]
        except Exception as e:
            TOOLS_JOBS[job_id]["status"] = "failed"
            TOOLS_JOBS[job_id]["error"] = str(e)[:500]

    asyncio.create_task(_execute())
    return {"job_id": job_id, "status": "running"}


@app.get("/api/tools/jobs/{job_id}")
def get_job_status(job_id: str):
    job = TOOLS_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


# ══════════════════════════════════════════════════════════════
#  Brand CRUD
# ══════════════════════════════════════════════════════════════

@app.get("/api/brands")
def list_brands():
    return {"brands": brands.load_brands()}


@app.post("/api/brands")
def create_brand(req: CreateBrandRequest):
    all_brands = brands.load_brands()
    brand_id = brands.slugify(req.name)
    if brands.find_brand(all_brands, brand_id):
        raise HTTPException(status_code=409, detail=f"Brand '{brand_id}' already exists")

    brand = {
        "id": brand_id, "name": req.name, "brandContext": req.brandContext,
        "avatars": [], "voicePresets": [],
    }
    all_brands.append(brand)
    brands.save_brands(all_brands)
    return brand


@app.get("/api/brands/{brand_id}")
def get_brand(brand_id: str):
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    return brand


@app.patch("/api/brands/{brand_id}")
def update_brand(brand_id: str, req: UpdateBrandRequest):
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    if req.name is not None:
        brand["name"] = req.name
    if req.brandContext is not None:
        brand["brandContext"] = req.brandContext
    if req.fonts is not None:
        brand["fonts"] = req.fonts.model_dump(exclude_none=True)
    if req.dna is not None:
        brand["dna"] = req.dna.model_dump(exclude_none=True)
    if req.designSystem is not None:
        brand["designSystem"] = req.designSystem.model_dump(exclude_none=True)
    if req.business is not None:
        brand["business"] = req.business.model_dump(exclude_none=True)
    if req.brandSources is not None:
        brand["brandSources"] = [s.model_dump(exclude_none=True) for s in req.brandSources]
    if req.competitors is not None:
        brand["competitors"] = [c.model_dump(exclude_none=True) for c in req.competitors]
    if req.customerReviews is not None:
        brand["customerReviews"] = req.customerReviews
    brands.save_brands(all_brands)
    return brand


@app.post("/api/brands/{brand_id}/guidance/url")
async def add_guidance_from_url(brand_id: str, req: dict):
    """Scrape a URL and append extracted text to brand guidance."""
    from bs4 import BeautifulSoup

    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    url = req.get("url", "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            res = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
        if res.status_code != 200:
            raise Exception(f"HTTP {res.status_code}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch URL: {str(e)[:200]}")

    soup = BeautifulSoup(res.text, "html.parser")
    # Remove non-content elements
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript", "form", "iframe", "svg"]):
        tag.decompose()

    # Drop common UI/cart/checkout chrome by class/id keywords
    UI_KEYWORDS = [
        "cart", "carrito", "checkout", "menu", "navigation", "breadcrumb", "cookie",
        "newsletter", "popup", "modal", "social-icons", "share-buttons", "footer",
        "header", "sidebar", "drawer", "minicart",
    ]
    for el in list(soup.find_all(True)):
        attrs_text = " ".join([
            (el.get("class") and " ".join(el.get("class"))) or "",
            el.get("id") or "",
            el.get("role") or "",
            el.get("aria-label") or "",
        ]).lower()
        if any(kw in attrs_text for kw in UI_KEYWORDS):
            el.decompose()

    # Prefer the main content area if there is one
    main = soup.find("main") or soup.find(role="main") or soup.find("article") or soup
    raw_text = main.get_text(separator="\n", strip=True)

    # Filter out obvious noise lines (cart text, currency placeholders, "loading...", short fragments)
    NOISE_PATTERNS = [
        "carrito de compras", "agregado al carrito", "cookies", "código postal",
        "calcular envío", "no tenemos más stock", "$0,00", "ver carrito",
        "iniciar sesión", "crear cuenta", "navegando por este sitio",
    ]
    cleaned_lines = []
    seen = set()
    for line in raw_text.split("\n"):
        s = line.strip()
        if not s or len(s) < 3:
            continue
        sl = s.lower()
        # skip lines that match common noise
        if any(p in sl for p in NOISE_PATTERNS):
            continue
        # skip pure currency/numbers/single-char lines
        if all(c in "0123456789.,$ " for c in s):
            continue
        # dedupe lines (cart text often repeats)
        if s in seen:
            continue
        seen.add(s)
        cleaned_lines.append(s)

    text = "\n".join(cleaned_lines)[:15000].strip()

    if not text:
        raise HTTPException(status_code=422, detail="No content text found at URL after cleanup")

    # Dedupe at the URL level — if the URL was already added, replace its block instead of duplicating.
    current = brand.get("brandContext", "") or ""
    source_marker = f"[Source: {url}]"
    if source_marker in current:
        # Replace the previous block from this same URL
        import re as _re
        pattern = _re.compile(rf"\n*---\n*\[Source: {_re.escape(url)}\][\s\S]*?(?=\n*---\n*\[Source:|$)")
        current = pattern.sub("", current).strip()

    separator = "\n\n---\n\n" if current else ""
    brand["brandContext"] = current + separator + f"[Source: {url}]\n{text}"
    brands.save_brands(all_brands)
    return {"added_chars": len(text), "brand": brand}


@app.post("/api/brands/{brand_id}/guidance/pdf")
async def add_guidance_from_pdf(brand_id: str, file: UploadFile = File(...)):
    """Upload a PDF and append extracted text to brand guidance."""
    from PyPDF2 import PdfReader

    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="PDF too large (max 20MB)")

    try:
        reader = PdfReader(io.BytesIO(content))
        pages_text = []
        for page in reader.pages:
            t = page.extract_text()
            if t:
                pages_text.append(t.strip())
        text = "\n\n".join(pages_text)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse PDF: {str(e)[:200]}")

    if not text.strip():
        raise HTTPException(status_code=422, detail="No text content found in PDF")

    # Sanitize: PDFs often produce control chars, weird whitespace, broken ligatures.
    # Remove non-printable chars except common whitespace.
    import re as _re
    text = _re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", text)
    # Collapse runs of 3+ newlines to 2
    text = _re.sub(r"\n{3,}", "\n\n", text)
    # Collapse runs of spaces
    text = _re.sub(r" {2,}", " ", text)

    # Limit to ~25000 chars (was 15000 — many brand books are longer)
    text = text[:25000].strip()

    current = brand.get("brandContext", "")
    separator = "\n\n---\n\n" if current else ""
    brand["brandContext"] = current + separator + f"[Source: {file.filename}]\n{text}"
    brands.save_brands(all_brands)
    return {"added_chars": len(text), "pages": len(reader.pages), "brand": brand}


@app.post("/api/brands/{brand_id}/generate-dna")
async def generate_brand_dna(brand_id: str):
    """Analyze brand context with Gemini and extract structured Brand DNA."""
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    # Combine all available sources for richer extraction
    parts: list[str] = []
    base_context = brand.get("brandContext", "").strip()
    if base_context:
        parts.append("=== BRAND SYSTEM ===\n" + base_context)
    for src in brand.get("brandSources", []):
        body = src.get("content") or src.get("url") or ""
        if body:
            parts.append(f"=== SOURCE: {src.get('label') or src.get('type')} ===\n{body}")
    reviews = brand.get("customerReviews", [])
    if reviews:
        parts.append("=== CUSTOMER REVIEWS (real customer voice — extract real-world tone from here) ===\n" + "\n---\n".join(reviews))
    business = brand.get("business", {})
    if business.get("model") or business.get("description"):
        biz_lines = []
        if business.get("model"): biz_lines.append(f"Model: {business['model']}")
        if business.get("description"): biz_lines.append(f"Description: {business['description']}")
        if business.get("value_prop"): biz_lines.append(f"Value prop: {business['value_prop']}")
        if business.get("target_market"): biz_lines.append(f"Target: {business['target_market']}")
        parts.append("=== BUSINESS ===\n" + "\n".join(biz_lines))

    if not parts:
        raise HTTPException(status_code=400, detail="Brand has no context yet. Add Brand System, a source, or business info first.")

    full_context = ("\n\n".join(parts))[:50000]  # 50k cap (was 10k)

    # Include product/avatar info if available
    extras = []
    for p in brand.get("products", []):
        if p.get("name"):
            extras.append(f"Product: {p['name']} — {p.get('description', '')}")
    for a in brand.get("avatars", []):
        if a.get("name"):
            extras.append(f"Avatar/Model: {a['name']} — {a.get('description', '')}")
    extra_context = "\n".join(extras) if extras else ""

    system_prompt = """Sos un estratega de marca senior. Analizá TODA la información de la marca abajo (puede tener múltiples fuentes: web, IG, brand book, reviews, business) y extraé un Brand DNA estructurado.

BRAND CONTEXT:
""" + full_context + """

""" + (f"ASSETS:\n{extra_context}\n\n" if extra_context else "") + """━━━ REGLA CRÍTICA DE IDIOMA ━━━
1. DETECTÁ el idioma natural de la marca (ej: español rioplatense, español neutro, inglés, portugués) leyendo el Brand Context.
2. Respondé TODOS los campos de TEXTO en EL MISMO idioma de la marca.
3. NUNCA mezcles idiomas. Si la marca es argentina y vos respondés "Practical, no-nonsense friend" eso está MAL — debe ser "Un amigo práctico que va al grano".
4. Excepciones que SIEMPRE quedan en su forma estándar:
   - "tone" adjetivos: en idioma de la marca (ej: ["natural", "cercano", "directo"])
   - "business.model": SIEMPRE en inglés (es enum técnico — ecommerce/saas/academy/service/subscription/marketplace/d2c/agency)
   - "suggested_fonts": SIEMPRE nombres reales de Google Fonts (ej: "Playfair Display", "Inter")

Respondé con SOLO un objeto JSON:
{
  "colors": [
    {"name": "nombre del color en idioma de la marca", "hex": "#hexcode", "usage": "uso en idioma de la marca"},
    {"name": "...", "hex": "#hex", "usage": "..."}
  ],
  "tone": ["adjetivo1", "adjetivo2", "adjetivo3"],
  "audience": "Descripción del target — demografía, psicografía, 2-3 oraciones EN EL IDIOMA DE LA MARCA",
  "keywords": ["palabra1", "palabra2", "..."],
  "personality": "2-3 oraciones describiendo la personalidad de la marca como si fuera una persona, EN EL IDIOMA DE LA MARCA",
  "competitors": ["Competidor 1", "Competidor 2"],
  "unique_value": "1-2 oraciones — qué hace única a esta marca, EN EL IDIOMA DE LA MARCA",
  "forbidden_words": ["palabra1 que la marca NUNCA usa", "palabra2"],
  "business": {
    "model": "ecommerce | saas | academy | service | subscription | marketplace | d2c | agency",
    "description": "2-3 oraciones EN EL IDIOMA DE LA MARCA: qué vende, a quién, cómo se monetiza. Concreto, sin jerga corporativa.",
    "value_prop": "1 oración EN EL IDIOMA DE LA MARCA: por qué alguien compra.",
    "target_market": "B2C/B2B + demo + psicográfico. 1-2 oraciones EN EL IDIOMA DE LA MARCA.",
    "revenue_streams": ["Stream 1 EN IDIOMA DE LA MARCA", "Stream 2"]
  },
  "suggested_fonts": {
    "headline": "Nombre real de Google Font",
    "body": "Nombre real de Google Font"
  }
}

Reglas adicionales:
- Extraé hex codes desde cualquier color mencionado. Los hex codes son CRÍTICOS.
- Si no hay colores explícitos, INFERILOS desde la industria y el tono.
- Tone: 3-5 adjetivos sobre cómo comunica la marca.
- Audiencia: específica, nunca genérica.
- forbidden_words: extraé palabras prohibidas EXPLÍCITAS del brand book (ej: "revolucionario", "powered by AI"). Si no hay, devolvé [].
- Competidores: nombres concretos. Si no se mencionan, inferí desde la industria — pero CON NOMBRES REALES, no descripciones genéricas como "Local basic apparel stores".
- Si hay reviews de clientes, infería el tono desde AHÍ — esa es la voz real.
- business.model: SIEMPRE elegí el más cercano de la lista (en inglés porque es enum técnico).
- business: si no está explícito, INFERILO del contexto (productos, web copy, target).

EJEMPLO de respuesta correcta para una marca argentina (Taller Santa Clara):
{
  "tone": ["natural", "directo", "canchero", "orgánico"],
  "audience": "Argentinos 18-35 que buscan ropa funcional para todos los días sin gastar en branding. Priorizan el precio y la calidad consistente sobre las modas.",
  "personality": "Un amigo del barrio que te dice las cosas como son. Sin vueltas, sin esfuerzo, con humor seco. Te muestra lo que hay y te deja decidir.",
  "unique_value": "Remeras lisas de calidad consistente al precio más bajo del mercado. Una decisión inteligente, no una compra de marca.",
  "competitors": ["Bazar Americano", "Mistral", "Yagmour", "AY Not Dead"],
  ...
}"""

    content = ""
    try:
        print(f"[brand-dna] Sending {len(full_context)} chars of context to Gemini...")
        content = await copy_gen._call_gemini(system_prompt, "Generá el Brand DNA ahora.")
        content = content.strip()
        if content.startswith("```json"):
            content = content.replace("```json", "").replace("```", "").strip()
        elif content.startswith("```"):
            content = content.replace("```", "").strip()

        dna = json.loads(content)

        # Pull out business + fonts before saving DNA proper
        extracted_business = dna.pop("business", None) if isinstance(dna.get("business"), dict) else None
        extracted_fonts = dna.pop("suggested_fonts", None) if isinstance(dna.get("suggested_fonts"), dict) else None

        # Save to brand
        brand["dna"] = dna
        if extracted_fonts:
            brand["fonts"] = extracted_fonts
        if extracted_business:
            # Merge: don't blow away manual edits if the user already set business fields
            existing = brand.get("business", {}) or {}
            merged = {**extracted_business, **{k: v for k, v in existing.items() if v}}
            brand["business"] = merged
        brands.save_brands(all_brands)

        return {"dna": dna, "fonts": brand.get("fonts"), "business": brand.get("business"), "brand": brand}
    except json.JSONDecodeError as e:
        print(f"[brand-dna] JSON parse failed: {e}")
        print(f"[brand-dna] Raw response (first 1500 chars):\n{content[:1500]}")
        raise HTTPException(status_code=502, detail=f"Gemini devolvió JSON inválido. Probá de nuevo. Detalles en consola del backend.")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=502, detail=f"Gemini error: {str(e)[:300]}")


@app.post("/api/brands/{brand_id}/extract-design-system")
async def extract_design_system(brand_id: str):
    """Analyze brand context with Gemini and extract structured Design System for image/video tools."""
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    # Combine all available sources: Brand System + extra brand sources + reviews + competitors
    parts: list[str] = []
    base_context = brand.get("brandContext", "").strip()
    if base_context:
        parts.append("=== BRAND SYSTEM (main document) ===\n" + base_context)
    for src in brand.get("brandSources", []):
        label = src.get("label") or src.get("type", "source")
        body = src.get("content") or src.get("url") or ""
        if body:
            parts.append(f"=== SOURCE: {label} ({src.get('type')}) ===\n{body}")
    reviews = brand.get("customerReviews", [])
    if reviews:
        parts.append("=== CUSTOMER REVIEWS (real customer voice) ===\n" + "\n---\n".join(reviews))
    competitors = brand.get("competitors", [])
    if competitors:
        comp_lines = [f"- {c.get('name')}: {c.get('notes', '')}" for c in competitors]
        parts.append("=== COMPETITORS (for differentiation) ===\n" + "\n".join(comp_lines))
    business = brand.get("business", {})
    if business.get("model") or business.get("description"):
        biz_lines = []
        if business.get("model"): biz_lines.append(f"Model: {business['model']}")
        if business.get("description"): biz_lines.append(f"Description: {business['description']}")
        if business.get("value_prop"): biz_lines.append(f"Value prop: {business['value_prop']}")
        if business.get("target_market"): biz_lines.append(f"Target: {business['target_market']}")
        parts.append("=== BUSINESS ===\n" + "\n".join(biz_lines))

    if not parts:
        raise HTTPException(status_code=400, detail="La marca no tiene contexto todavía. Cargá Brand System, una fuente, o el modelo de negocio primero.")

    full_context = "\n\n".join(parts)
    # Increased budget to 50k chars (was 12k) — Brand System docs can be long.
    truncated_context = full_context[:50000]

    system_prompt = """Sos un director creativo experto en identidad visual de marca. Analizá TODO el contexto (puede tener múltiples fuentes: web, IG, brand book, reviews, competidores) y extraé el sistema de diseño visual — solo la parte que sirve para guiar la generación de imágenes y videos.

BRAND CONTEXT:
""" + truncated_context + """

━━━ REGLA CRÍTICA DE IDIOMA ━━━
DETECTÁ el idioma natural de la marca (español rioplatense / español neutro / inglés / portugués) y respondé TODOS los campos de TEXTO en ESE idioma. Si la marca es argentina, respondé en español rioplatense (voseo si aplica). NUNCA mezcles idiomas.

Respondé con SOLO un objeto JSON:
{
  "photoStyle": "2-4 oraciones describiendo el estilo visual general (lifestyle, editorial, documental, cartoon, etc.) — qué tipo de imágenes representan la marca",
  "composition": "1-3 oraciones sobre reglas de composición, framing, cómo se muestra el producto, integración en escena",
  "colorTreatment": "1-2 oraciones sobre tratamiento de color: saturación, filtros, color grading, contraste",
  "lighting": "1-2 oraciones sobre dirección de iluminación: natural, estudio, cálida, dramática, etc.",
  "visualDos": ["cosa1 que SIEMPRE se muestra", "cosa2", "cosa3"],
  "visualDonts": ["cosa1 que NUNCA se muestra", "cosa2", "cosa3"],
  "references": "1-2 oraciones mencionando marcas o referencias visuales admiradas, si se mencionan en el brief",
  "casting": "1-2 oraciones sobre cómo se ven los modelos típicos de la marca (edad, tipo, expresión, vestimenta)",
  "preferred_locations": ["locación tipo 1", "locación tipo 2", "locación tipo 3"],
  "product_presentation": "1-2 oraciones sobre cómo se muestra típicamente el producto (hero shot, lifestyle, detalle, packaging, etc.)",
  "motion_rules": "1-2 oraciones sobre ritmo y cámara para video (corte rápido tipo TikTok, plano sostenido editorial, dolly, handheld, etc.)"
}

Reglas:
- Extraé SOLO lo visual/fotográfico/operacional para producción. No voz, no messaging.
- Si el documento no menciona algo explícitamente, inferilo del posicionamiento e industria.
- visualDos y visualDonts: 3-5 items cada uno, concretos y accionables para un generador de imágenes.
- preferred_locations: 2-4 tipos de locación que sean coherentes con la marca.
- Mantené cada campo conciso — van a inyectarse en prompts."""

    content = ""
    try:
        print(f"[design-system] Sending {len(truncated_context)} chars of context to Gemini...")
        content = await copy_gen._call_gemini(system_prompt, "Extraé el design system ahora.")
        content = content.strip()
        if content.startswith("```json"):
            content = content.replace("```json", "").replace("```", "").strip()
        elif content.startswith("```"):
            content = content.replace("```", "").strip()

        design_system = json.loads(content)
        brand["designSystem"] = design_system
        brands.save_brands(all_brands)

        return {"designSystem": design_system, "brand": brand}
    except json.JSONDecodeError as e:
        print(f"[design-system] JSON parse failed: {e}")
        print(f"[design-system] Raw response (first 1500 chars):\n{content[:1500]}")
        raise HTTPException(status_code=502, detail=f"Gemini devolvió JSON inválido. Probá de nuevo. Detalles en consola del backend.")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=502, detail=f"Gemini error: {str(e)[:300]}")


@app.post("/api/brands/{brand_id}/extract-all")
async def extract_all_brand_knowledge(brand_id: str):
    """One-click extract: runs Brand DNA + Design System in sequence and returns combined results.
    This is what the user expects when they click '🪄 Extraer todo' from the unified Brand Knowledge card."""
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    results: dict = {"dna": None, "designSystem": None, "business": None, "fonts": None, "errors": []}

    # 1. Brand DNA
    try:
        dna_response = await generate_brand_dna(brand_id)
        if isinstance(dna_response, dict):
            results["dna"] = dna_response.get("dna")
            results["business"] = dna_response.get("business")
            results["fonts"] = dna_response.get("fonts")
    except HTTPException as e:
        results["errors"].append({"step": "brand_dna", "detail": e.detail})
    except Exception as e:
        results["errors"].append({"step": "brand_dna", "detail": str(e)[:300]})

    # 2. Design System (re-load brand because dna step may have updated it)
    try:
        ds_response = await extract_design_system(brand_id)
        if isinstance(ds_response, dict):
            results["designSystem"] = ds_response.get("designSystem")
    except HTTPException as e:
        results["errors"].append({"step": "design_system", "detail": e.detail})
    except Exception as e:
        results["errors"].append({"step": "design_system", "detail": str(e)[:300]})

    # Reload brand for the response
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    results["brand"] = brand
    return results


@app.delete("/api/brands/{brand_id}")
def delete_brand(brand_id: str):
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    for avatar in brand.get("avatars", []):
        filename = avatar.get("filename", "")
        if filename:
            img_path = brands.get_avatars_dir() / filename
            if img_path.exists() and img_path.is_file():
                img_path.unlink()
    for prod in brand.get("products", []):
        filename = prod.get("filename", "")
        if filename:
            img_path = brands.get_products_dir() / filename
            if img_path.exists() and img_path.is_file():
                img_path.unlink()
    all_brands = [b for b in all_brands if b["id"] != brand_id]
    brands.save_brands(all_brands)
    return {"ok": True}


# ══════════════════════════════════════════════════════════════
#  Script Generation (Gemini)
# ══════════════════════════════════════════════════════════════

@app.post("/api/brands/{brand_id}/generate-copy")
async def generate_copy(brand_id: str, req: GenerateCopyRequest):
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    brand_context = brand.get("brandContext", "")
    if not brand_context:
        raise HTTPException(status_code=400, detail="Brand context is empty. Add a brand description first.")

    # Build full prompt using PromptBuilder (3-layer system)
    extra_vars = {
        "video_objective": req.additionalNotes or "",
        "tone": req.tone,
        "platform": req.platform,
        "language": req.language,
    }
    built_prompt = prompt_builder.build_prompt("ugc_creator", brand, extra_vars)

    try:
        system_prompt_used = built_prompt or ""
        result = await copy_gen.generate_scripts(
            brand_context=brand_context,
            product_name=req.productName,
            tone=req.tone,
            platform=req.platform,
            language=req.language,
            video_objective=req.additionalNotes,
            prompt_override=system_prompt_used,
            narrative_mode=req.narrativeMode,
        )
        # result is [scenes, concept] or [scenes] for legacy
        scenes_raw = result[0] if result else []
        concept = result[1] if len(result) > 1 else ""

        # If no concept from Gemini (e.g. prompt_override used old format),
        # generate it as a separate quick call
        if not concept:
            concept = await copy_gen.generate_concept(
                brand_context=brand_context,
                product_name=req.productName or "",
                video_objective=req.additionalNotes or "",
                language=req.language or "es",
            )

        # Normalize field names so frontend always gets: id, title, script, image_prompt
        normalized = _normalize_script_response([scenes_raw])
        return {
            "scripts": [normalized] if normalized else [scenes_raw],
            "model": "gemini-2.5-flash",
            "brief": concept or None,
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.post("/api/brands/{brand_id}/regenerate-scene")
async def regenerate_scene_endpoint(brand_id: str, req: RegenerateSceneRequest):
    """Rewrite ONE scene of a UGC script, with the full script as context for coherence."""
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    if not copy_gen.is_configured():
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")
    try:
        return await copy_gen.regenerate_scene(
            brand_context=brand.get("brandContext", ""),
            scenes=req.scenes,
            target_index=req.targetIndex,
            language=req.language,
            video_objective=req.videoObjective,
            product_name=req.productName,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


class ChatScriptsRequest(BaseModel):
    messages: List[dict]


@app.post("/api/brands/{brand_id}/chat-scripts")
async def chat_scripts_endpoint(brand_id: str, req: ChatScriptsRequest):
    """Conversational UGC scriptwriter for the chat (writes/iterates scripts with brand context)."""
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    if not copy_gen.is_configured():
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")
    try:
        return await copy_gen.chat_scripts(brand.get("brandContext", ""), req.messages)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.post("/api/stt/transcribe")
async def stt_transcribe(audio: UploadFile = File(...), language: str = Form("es")):
    """Transcribe a recorded voice note to text (Gemini multimodal audio)."""
    if not stt.is_configured():
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")
    try:
        data = await audio.read()
        text = await stt.transcribe(data, audio.content_type or "audio/webm", language)
        return {"text": text}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


class SuggestObjectiveRequest(BaseModel):
    productName: str = ""
    language: str = "es"


@app.post("/api/brands/{brand_id}/suggest-objective")
async def suggest_objective(brand_id: str, req: SuggestObjectiveRequest):
    """Auto-generate a Video Objective based on brand context + product."""
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    brand_context = brand.get("brandContext", "")
    if not brand_context:
        raise HTTPException(status_code=400, detail="Brand context is empty.")

    # Enrich with brand assets
    variables = prompt_builder.build_context_variables(brand)
    for key in ["avatars", "products", "backgrounds", "voices"]:
        if variables.get(key):
            brand_context += f"\n\n{variables[key]}"

    try:
        objective = await copy_gen.suggest_objective(
            brand_context=brand_context,
            product_name=req.productName,
            language=req.language,
        )
        return {"objective": objective, "model": "gemini-2.5-flash"}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


# ══════════════════════════════════════════════════════════════
#  Avatar CRUD (per brand)
# ══════════════════════════════════════════════════════════════

@app.get("/api/brands/{brand_id}/avatars")
def list_avatars(brand_id: str):
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    return {"avatars": brand.get("avatars", [])}


@app.post("/api/brands/{brand_id}/avatars")
async def upload_avatar(
    brand_id: str,
    name: str = Form(...),
    description: str = Form(""),
    image: UploadFile = File(...),
    upload_to_heygen: bool = Form(True),
):
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    image_data = await image.read()
    if len(image_data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 10MB)")

    ext = Path(image.filename or "avatar.png").suffix or ".png"
    avatar_id = str(uuid.uuid4())[:8]
    filename = f"{brand_id}_{avatar_id}{ext}"
    filepath = brands.get_avatars_dir() / filename

    with open(filepath, "wb") as f:
        f.write(image_data)

    # Auto-describe with Gemini Vision if no description provided
    auto_description = description
    if not description.strip() and image_analysis.is_configured():
        try:
            ct = image.content_type or "image/jpeg"
            auto_description = await image_analysis.describe_avatar(image_data, ct, name)
            print(f"[avatar-upload] Auto-described: {auto_description[:80]}...")
        except Exception as e:
            print(f"[avatar-upload] Auto-describe failed: {e}")
            auto_description = ""

    avatar = {
        "id": avatar_id, "name": name, "description": auto_description,
        "filename": filename, "imageUrl": f"/static/avatars/{filename}",
        "talkingPhotoId": None, "heygenStatus": "pending",
    }

    if upload_to_heygen and heygen.is_configured():
        try:
            tp_id = await heygen.upload_talking_photo(image_data, filename, image.content_type or "image/jpeg")
            avatar["talkingPhotoId"] = tp_id
            avatar["heygenStatus"] = "ready"
        except Exception as e:
            avatar["heygenStatus"] = "failed"
            avatar["heygenError"] = str(e)[:200]
    elif not upload_to_heygen:
        avatar["heygenStatus"] = "skipped"

    if "avatars" not in brand:
        brand["avatars"] = []
    brand["avatars"].append(avatar)
    brands.save_brands(all_brands)
    return avatar


@app.post("/api/brands/{brand_id}/avatars/heygen")
def add_heygen_avatar(brand_id: str, req: AddHeygenAvatarRequest):
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    avatar = {
        "id": req.talkingPhotoId,
        "name": req.name,
        "filename": "",  # no local file
        "imageUrl": req.previewUrl,
        "talkingPhotoId": req.talkingPhotoId,
        "heygenStatus": "ready",
    }
    
    if "avatars" not in brand:
        brand["avatars"] = []
    brand["avatars"].append(avatar)
    brands.save_brands(all_brands)
    return avatar


@app.patch("/api/brands/{brand_id}/avatars/{avatar_id}/image")
async def replace_avatar_image(
    brand_id: str,
    avatar_id: str,
    image: UploadFile = File(...),
):
    """Replace the image of an existing avatar, keeping its ID and downstream references."""
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    avatar = next((a for a in brand.get("avatars", []) if a.get("id") == avatar_id), None)
    if not avatar:
        raise HTTPException(status_code=404, detail="Avatar not found")

    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    image_data = await image.read()
    if len(image_data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 10MB)")

    ext = Path(image.filename or "avatar.png").suffix or ".png"
    filename = f"{brand_id}_{avatar_id}{ext}"
    filepath = brands.get_avatars_dir() / filename

    # Remove previous file if extension changed
    old_filename = avatar.get("filename")
    if old_filename and old_filename != filename:
        old_path = brands.get_avatars_dir() / old_filename
        if old_path.exists():
            try: old_path.unlink()
            except Exception: pass

    with open(filepath, "wb") as f:
        f.write(image_data)

    avatar["filename"] = filename
    avatar["imageUrl"] = f"/static/avatars/{filename}"
    brands.save_brands(all_brands)
    return avatar


class UpdateAvatarRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


@app.patch("/api/brands/{brand_id}/avatars/{avatar_id}")
def update_avatar(brand_id: str, avatar_id: str, req: UpdateAvatarRequest):
    """Rename an avatar (and optionally update its description). Keeps ID + image."""
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    avatar = next((a for a in brand.get("avatars", []) if a.get("id") == avatar_id), None)
    if not avatar:
        raise HTTPException(status_code=404, detail="Avatar not found")
    if req.name is not None:
        name = req.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="El nombre no puede estar vacío")
        avatar["name"] = name
    if req.description is not None:
        avatar["description"] = req.description.strip()
    brands.save_brands(all_brands)
    return avatar


@app.delete("/api/brands/{brand_id}/avatars/{avatar_id}")
def delete_avatar(brand_id: str, avatar_id: str):
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    avatar = next((a for a in brand.get("avatars", []) if a["id"] == avatar_id), None)
    if not avatar:
        raise HTTPException(status_code=404, detail="Avatar not found")
    filename = avatar.get("filename", "")
    if filename:
        img_path = brands.get_avatars_dir() / filename
        if img_path.exists() and img_path.is_file():
            img_path.unlink()
    brand["avatars"] = [a for a in brand["avatars"] if a["id"] != avatar_id]
    brands.save_brands(all_brands)
    return {"ok": True}


@app.post("/api/brands/{brand_id}/avatars/{avatar_id}/retry-heygen")
async def retry_heygen_upload(brand_id: str, avatar_id: str):
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    avatar = next((a for a in brand.get("avatars", []) if a["id"] == avatar_id), None)
    if not avatar:
        raise HTTPException(status_code=404, detail="Avatar not found")
    if not heygen.is_configured():
        raise HTTPException(status_code=500, detail="HeyGen API key not configured")

    filepath = brands.get_avatars_dir() / avatar.get("filename", "")
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Avatar image file not found")

    with open(filepath, "rb") as f:
        image_data = f.read()

    try:
        tp_id = await heygen.upload_talking_photo(image_data, avatar["filename"], "image/png")
        avatar["talkingPhotoId"] = tp_id
        avatar["heygenStatus"] = "ready"
        avatar.pop("heygenError", None)
    except Exception as e:
        avatar["heygenStatus"] = "failed"
        avatar["heygenError"] = str(e)[:200]

    brands.save_brands(all_brands)
    return avatar


# ══════════════════════════════════════════════════════════════
#  Product CRUD (per brand)
# ══════════════════════════════════════════════════════════════

@app.get("/api/brands/{brand_id}/products")
def list_products(brand_id: str):
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    return {"products": brand.get("products", [])}


@app.post("/api/brands/{brand_id}/products")
async def upload_product(
    brand_id: str,
    name: str = Form(...),
    description: str = Form(""),
    image: UploadFile = File(...),
    type: str = Form(""),                 # physical | digital | course | service | subscription
    price: str = Form(""),                # "ARS 12.000" / "USD 29 / mes"
    url: str = Form(""),                  # link al producto
    category: str = Form(""),             # opcional, para catálogos grandes
):
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    ext = Path(image.filename or "product.png").suffix or ".png"
    product_id = str(uuid.uuid4())[:8]
    filename = f"{brand_id}_prod_{product_id}{ext}"
    filepath = brands.get_products_dir() / filename

    content = await image.read()
    with open(filepath, "wb") as f:
        f.write(content)

    # Auto-describe with Gemini Vision if no description provided
    auto_description = description
    if not description.strip() and image_analysis.is_configured():
        try:
            ct = image.content_type or "image/jpeg"
            auto_description = await image_analysis.describe_product(content, ct, name)
            print(f"[product-upload] Auto-described: {auto_description[:80]}...")
        except Exception as e:
            print(f"[product-upload] Auto-describe failed: {e}")
            auto_description = ""

    product = {
        "id": product_id,
        "name": name,
        "description": auto_description,
        "filename": filename,
        "imageUrl": f"/static/products/{filename}",
        "type": type or None,
        "price": price or None,
        "url": url or None,
        "category": category or None,
    }
    # Drop None values so we don't pollute the JSON
    product = {k: v for k, v in product.items() if v is not None}

    if "products" not in brand:
        brand["products"] = []
    brand["products"].append(product)
    brands.save_brands(all_brands)
    return product


class UpdateProductRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    price: Optional[str] = None
    url: Optional[str] = None
    category: Optional[str] = None


@app.patch("/api/brands/{brand_id}/products/{product_id}")
def update_product(brand_id: str, product_id: str, req: UpdateProductRequest):
    """Update product metadata (name, description, type, price, url, category) without re-uploading the image."""
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    product = next((p for p in brand.get("products", []) if p["id"] == product_id), None)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    updates = req.model_dump(exclude_none=True)
    product.update(updates)
    brands.save_brands(all_brands)
    return product


@app.post("/api/brands/{brand_id}/products/{product_id}/images")
async def add_product_image(
    brand_id: str,
    product_id: str,
    label: str = Form(""),
    image: UploadFile = File(...),
):
    """Add an extra photo to an existing product (up to 3 total)."""
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    product = next((p for p in brand.get("products", []) if p["id"] == product_id), None)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    existing_images = product.get("images", [])
    # Count total: main image + extras
    if len(existing_images) >= 2:
        raise HTTPException(status_code=400, detail="Maximum 3 images per product (1 main + 2 extra)")

    ext = Path(image.filename or "product.png").suffix or ".png"
    img_id = str(uuid.uuid4())[:8]
    filename = f"{brand_id}_prod_{product_id}_{img_id}{ext}"
    filepath = brands.get_products_dir() / filename

    content = await image.read()
    with open(filepath, "wb") as f:
        f.write(content)

    img_entry = {
        "filename": filename,
        "imageUrl": f"/static/products/{filename}",
        "label": label or f"Photo {len(existing_images) + 2}",
    }
    if "images" not in product:
        product["images"] = []
    product["images"].append(img_entry)
    brands.save_brands(all_brands)
    return product


@app.delete("/api/brands/{brand_id}/products/{product_id}")
def delete_product(brand_id: str, product_id: str):
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    product = next((p for p in brand.get("products", []) if p["id"] == product_id), None)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    filename = product.get("filename", "")
    if filename:
        img_path = brands.get_products_dir() / filename
        if img_path.exists() and img_path.is_file():
            img_path.unlink()
    brand["products"] = [p for p in brand["products"] if p["id"] != product_id]
    brands.save_brands(all_brands)
    return {"ok": True}


# ══════════════════════════════════════════════════════════════
#  Clothing API
# ══════════════════════════════════════════════════════════════

app.mount("/static/clothing", StaticFiles(directory=str(brands.get_clothing_dir())), name="clothing")

# Renders (FFmpeg output)
_renders_dir = DATA_DIR / "renders"
_renders_dir.mkdir(parents=True, exist_ok=True)
app.mount("/static/renders", StaticFiles(directory=str(_renders_dir)), name="renders")


@app.get("/api/brands/{brand_id}/clothing")
def list_clothing(brand_id: str):
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    return {"clothing": brand.get("clothing", [])}


@app.post("/api/brands/{brand_id}/clothing")
async def upload_clothing(
    brand_id: str,
    name: str = Form(...),
    description: str = Form(""),
    tags: str = Form(""),
    image: UploadFile = File(...),
):
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    image_data = await image.read()
    ext = Path(image.filename or "clothing.png").suffix or ".png"
    item_id = str(uuid.uuid4())[:8]
    filename = f"{brand_id}_cloth_{item_id}{ext}"
    filepath = brands.get_clothing_dir() / filename

    with open(filepath, "wb") as f:
        f.write(image_data)

    item = {
        "id": item_id,
        "name": name,
        "description": description,
        "tags": [t.strip() for t in tags.split(",") if t.strip()] if tags else [],
        "filename": filename,
        "imageUrl": f"/static/clothing/{filename}",
    }

    if "clothing" not in brand:
        brand["clothing"] = []
    brand["clothing"].append(item)
    brands.save_brands(all_brands)
    return item


@app.patch("/api/brands/{brand_id}/clothing/{item_id}")
def update_clothing(brand_id: str, item_id: str, req: UpdateAvatarRequest):
    """Rename a clothing item (and optionally update its description)."""
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    item = next((c for c in brand.get("clothing", []) if c.get("id") == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Clothing item not found")
    if req.name is not None:
        name = req.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="El nombre no puede estar vacío")
        item["name"] = name
    if req.description is not None:
        item["description"] = req.description.strip()
    brands.save_brands(all_brands)
    return item


@app.delete("/api/brands/{brand_id}/clothing/{item_id}")
def delete_clothing(brand_id: str, item_id: str):
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    item = next((c for c in brand.get("clothing", []) if c["id"] == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Clothing item not found")
    filename = item.get("filename", "")
    if filename:
        img_path = brands.get_clothing_dir() / filename
        if img_path.exists() and img_path.is_file():
            img_path.unlink()
    brand["clothing"] = [c for c in brand["clothing"] if c["id"] != item_id]
    brands.save_brands(all_brands)
    return {"ok": True}


# ══════════════════════════════════════════════════════════════
#  Backgrounds API
# ══════════════════════════════════════════════════════════════

app.mount("/static/backgrounds", StaticFiles(directory=str(brands.get_backgrounds_dir())), name="backgrounds")


@app.get("/api/brands/{brand_id}/backgrounds")
def list_backgrounds(brand_id: str):
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    return {"backgrounds": brand.get("backgrounds", [])}


@app.post("/api/brands/{brand_id}/backgrounds")
async def upload_background(
    brand_id: str,
    name: str = Form(...),
    description: str = Form(""),
    tags: str = Form(""),
    image: UploadFile = File(...),
):
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    image_data = await image.read()
    ext = Path(image.filename or "background.png").suffix or ".png"
    item_id = str(uuid.uuid4())[:8]
    filename = f"{brand_id}_bg_{item_id}{ext}"
    filepath = brands.get_backgrounds_dir() / filename

    with open(filepath, "wb") as f:
        f.write(image_data)

    item = {
        "id": item_id,
        "name": name,
        "description": description,
        "tags": [t.strip() for t in tags.split(",") if t.strip()] if tags else [],
        "filename": filename,
        "imageUrl": f"/static/backgrounds/{filename}",
    }

    if "backgrounds" not in brand:
        brand["backgrounds"] = []
    brand["backgrounds"].append(item)
    brands.save_brands(all_brands)
    return item


@app.patch("/api/brands/{brand_id}/backgrounds/{item_id}")
def update_background(brand_id: str, item_id: str, req: UpdateAvatarRequest):
    """Rename a background (and optionally update its description)."""
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    item = next((b for b in brand.get("backgrounds", []) if b.get("id") == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Background not found")
    if req.name is not None:
        name = req.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="El nombre no puede estar vacío")
        item["name"] = name
    if req.description is not None:
        item["description"] = req.description.strip()
    brands.save_brands(all_brands)
    return item


@app.delete("/api/brands/{brand_id}/backgrounds/{item_id}")
def delete_background(brand_id: str, item_id: str):
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    item = next((b for b in brand.get("backgrounds", []) if b["id"] == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Background not found")
    filename = item.get("filename", "")
    if filename:
        img_path = brands.get_backgrounds_dir() / filename
        if img_path.exists() and img_path.is_file():
            img_path.unlink()
    brand["backgrounds"] = [b for b in brand["backgrounds"] if b["id"] != item_id]
    brands.save_brands(all_brands)
    return {"ok": True}


# ══════════════════════════════════════════════════════════════
#  Brand Moodboard API
# ══════════════════════════════════════════════════════════════

app.mount("/static/moodboards", StaticFiles(directory=str(brands.get_moodboards_dir())), name="moodboards")


@app.get("/api/brands/{brand_id}/moodboards")
def list_moodboards(brand_id: str):
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    return {"moodboards": brand.get("moodboards", [])}


@app.post("/api/brands/{brand_id}/moodboards")
async def upload_moodboard(
    brand_id: str,
    name: str = Form(...),
    description: str = Form(""),
    image: UploadFile = File(...),
):
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    existing = brand.get("moodboards", [])
    if len(existing) >= 5:
        raise HTTPException(status_code=400, detail="Maximum 5 moodboards per brand")

    image_data = await image.read()
    ext = Path(image.filename or "moodboard.png").suffix or ".png"
    item_id = str(uuid.uuid4())[:8]
    filename = f"{brand_id}_mood_{item_id}{ext}"
    filepath = brands.get_moodboards_dir() / filename
    with open(filepath, "wb") as f:
        f.write(image_data)

    # Auto-describe moodboard with Gemini Vision if no description provided
    auto_desc = description
    if not auto_desc.strip() and image_analysis.is_configured():
        try:
            auto_desc = await image_analysis.describe_moodboard(
                image_data,
                mime_type=image.content_type or "image/jpeg",
                moodboard_name=name,
            )
        except Exception as e:
            print(f"[moodboard] Auto-description failed: {e}")
            auto_desc = ""

    item = {
        "id": item_id,
        "name": name,
        "description": auto_desc,
        "filename": filename,
        "imageUrl": f"/static/moodboards/{filename}",
    }
    if "moodboards" not in brand:
        brand["moodboards"] = []
    brand["moodboards"].append(item)
    brands.save_brands(all_brands)
    return item


@app.delete("/api/brands/{brand_id}/moodboards/{item_id}")
def delete_moodboard(brand_id: str, item_id: str):
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    item = next((m for m in brand.get("moodboards", []) if m["id"] == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Moodboard not found")
    filename = item.get("filename", "")
    if filename:
        img_path = brands.get_moodboards_dir() / filename
        if img_path.exists() and img_path.is_file():
            img_path.unlink()
    brand["moodboards"] = [m for m in brand["moodboards"] if m["id"] != item_id]
    brands.save_brands(all_brands)
    return {"ok": True}


# ══════════════════════════════════════════════════════════════
#  Look & Feel API — per-brand lighting / color-grade reference library.
#  Distinct from moodboards: these are applied as a relight/grade transfer
#  onto an input image (mainly in Manual Lab), not a style ref for fresh gen.
# ══════════════════════════════════════════════════════════════

app.mount("/static/lookandfeel", StaticFiles(directory=str(brands.get_lookandfeel_dir())), name="lookandfeel")


@app.get("/api/brands/{brand_id}/lookandfeel")
def list_lookandfeel(brand_id: str):
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    return {"lookAndFeel": brand.get("lookAndFeel", [])}


@app.post("/api/brands/{brand_id}/lookandfeel")
async def upload_lookandfeel(
    brand_id: str,
    name: str = Form(...),
    description: str = Form(""),
    image: UploadFile = File(...),
):
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    if len(brand.get("lookAndFeel", [])) >= 12:
        raise HTTPException(status_code=400, detail="Maximum 12 look & feel references per brand")

    image_data = await image.read()
    if len(image_data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 10MB)")
    ext = Path(image.filename or "lookfeel.png").suffix or ".png"
    item_id = str(uuid.uuid4())[:8]
    filename = f"{brand_id}_lf_{item_id}{ext}"
    filepath = brands.get_lookandfeel_dir() / filename
    with open(filepath, "wb") as f:
        f.write(image_data)

    item = {
        "id": item_id,
        "name": name,
        "description": description.strip(),
        "filename": filename,
        "imageUrl": f"/static/lookandfeel/{filename}",
    }
    if "lookAndFeel" not in brand:
        brand["lookAndFeel"] = []
    brand["lookAndFeel"].append(item)
    brands.save_brands(all_brands)
    return item


@app.patch("/api/brands/{brand_id}/lookandfeel/{item_id}")
def update_lookandfeel(brand_id: str, item_id: str, req: UpdateAvatarRequest):
    """Rename a look & feel reference (and optionally update its description)."""
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    item = next((m for m in brand.get("lookAndFeel", []) if m.get("id") == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Look & feel reference not found")
    if req.name is not None:
        name = req.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="El nombre no puede estar vacío")
        item["name"] = name
    if req.description is not None:
        item["description"] = req.description.strip()
    brands.save_brands(all_brands)
    return item


@app.delete("/api/brands/{brand_id}/lookandfeel/{item_id}")
def delete_lookandfeel(brand_id: str, item_id: str):
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    item = next((m for m in brand.get("lookAndFeel", []) if m["id"] == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Look & feel reference not found")
    filename = item.get("filename", "")
    if filename:
        img_path = brands.get_lookandfeel_dir() / filename
        if img_path.exists() and img_path.is_file():
            img_path.unlink()
    brand["lookAndFeel"] = [m for m in brand["lookAndFeel"] if m["id"] != item_id]
    brands.save_brands(all_brands)
    return {"ok": True}


@app.post("/api/brands/{brand_id}/lookandfeel/{item_id}/describe")
async def describe_lookandfeel_item(brand_id: str, item_id: str):
    """Analyze a look & feel reference into a text color-grade recipe (cached on the item).
    Powers the 'recipe' apply mode in Lab — apply the grade without passing the image."""
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    item = next((m for m in brand.get("lookAndFeel", []) if m.get("id") == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Look & feel reference not found")
    if item.get("description"):
        return {"description": item["description"]}  # cached
    if not image_analysis.is_configured():
        raise HTTPException(status_code=400, detail="Gemini no está configurado para analizar la referencia")
    filename = item.get("filename", "")
    path = brands.get_lookandfeel_dir() / filename
    if not filename or not path.exists():
        raise HTTPException(status_code=404, detail="Archivo de la referencia no encontrado")
    mime = "image/png" if filename.lower().endswith(".png") else "image/jpeg"
    try:
        recipe = await image_analysis.describe_lookandfeel(path.read_bytes(), mime)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"No se pudo analizar la referencia: {str(e)[:200]}")
    item["description"] = (recipe or "").strip()
    brands.save_brands(all_brands)
    return {"description": item["description"]}


@app.post("/api/lookandfeel/describe-upload")
async def describe_lookandfeel_upload(image: UploadFile = File(...)):
    """Analyze an ad-hoc (not saved to any brand) look & feel image into a color-grade recipe.
    Powers the 'recipe' mode when you upload a one-off reference in Manual Lab."""
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    if not image_analysis.is_configured():
        raise HTTPException(status_code=400, detail="Gemini no está configurado para analizar la referencia")
    data = await image.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 10MB)")
    try:
        recipe = await image_analysis.describe_lookandfeel(data, image.content_type or "image/jpeg")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"No se pudo analizar la referencia: {str(e)[:200]}")
    return {"description": (recipe or "").strip()}


# ══════════════════════════════════════════════════════════════
#  Brand Logo API
# ══════════════════════════════════════════════════════════════

app.mount("/static/logos", StaticFiles(directory=str(brands.get_logos_dir())), name="logos")


@app.post("/api/brands/{brand_id}/logo")
async def upload_logo(brand_id: str, image: UploadFile = File(...)):
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    image_data = await image.read()
    ext = Path(image.filename or "logo.png").suffix or ".png"
    filename = f"{brand_id}_logo{ext}"
    filepath = brands.get_logos_dir() / filename

    with open(filepath, "wb") as f:
        f.write(image_data)

    brand["logo"] = {
        "filename": filename,
        "imageUrl": f"/static/logos/{filename}",
    }
    brands.save_brands(all_brands)
    return brand["logo"]


@app.delete("/api/brands/{brand_id}/logo")
def delete_logo(brand_id: str):
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    logo = brand.get("logo")
    if logo and logo.get("filename"):
        img_path = brands.get_logos_dir() / logo["filename"]
        if img_path.exists():
            img_path.unlink()
    brand.pop("logo", None)
    brands.save_brands(all_brands)
    return {"ok": True}


# ══════════════════════════════════════════════════════════════
#  VOICE PRESETS
# ══════════════════════════════════════════════════════════════

class AddVoiceRequest(BaseModel):
    name: str
    voice_id: str


@app.get("/api/voices/system")
def list_system_voices():
    """Return system-level generic voices available to all brands."""
    voices_file = DATA_DIR / "system_voices.json"
    if voices_file.exists():
        import json
        return {"voices": json.loads(voices_file.read_text())}
    return {"voices": []}


@app.get("/api/brands/{brand_id}/voices")
def list_voices(brand_id: str):
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    return {"voices": brand.get("voicePresets", [])}


@app.post("/api/brands/{brand_id}/voices")
def add_voice(brand_id: str, req: AddVoiceRequest):
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    if not req.voice_id.strip():
        raise HTTPException(status_code=400, detail="Voice ID is required")

    if "voicePresets" not in brand:
        brand["voicePresets"] = []

    # Prevent duplicate voice IDs
    if any(v["id"] == req.voice_id.strip() for v in brand["voicePresets"]):
        raise HTTPException(status_code=409, detail="Voice ID already exists for this brand")

    voice = {"id": req.voice_id.strip(), "name": req.name.strip()}
    brand["voicePresets"].append(voice)
    brands.save_brands(all_brands)
    return voice


@app.delete("/api/brands/{brand_id}/voices/{voice_id}")
def delete_voice(brand_id: str, voice_id: str):
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    if not any(v["id"] == voice_id for v in brand.get("voicePresets", [])):
        raise HTTPException(status_code=404, detail="Voice not found")
    brand["voicePresets"] = [v for v in brand["voicePresets"] if v["id"] != voice_id]
    brands.save_brands(all_brands)
    return {"ok": True}


# ══════════════════════════════════════════════════════════════
#  Voice Design (text-to-voice) + Instant Voice Cloning
# ══════════════════════════════════════════════════════════════
#
# Two-step Voice Design flow (best per ElevenLabs):
#   1) POST /api/voices/design/previews → returns 3 preview audios
#   2) POST /api/voices/design/save     → promotes one preview to a permanent
#      voice in the user's ElevenLabs library
#
# Instant Voice Cloning (one-shot):
#   POST /api/voices/clone → uploads audio samples, returns voice_id


class VoiceDesignPreviewRequest(BaseModel):
    voice_description: str
    text: str
    auto_generate_text: Optional[bool] = False


@app.post("/api/voices/design/previews")
async def voice_design_previews(req: VoiceDesignPreviewRequest):
    """Generate preview voices from a text description (ElevenLabs Voice Design)."""
    if not tts.is_configured():
        raise HTTPException(status_code=500, detail="ELEVENLABS_API_KEY not configured")
    try:
        previews = tts.create_voice_previews(
            voice_description=req.voice_description,
            text=req.text,
            auto_generate_text=bool(req.auto_generate_text),
        )
        return {"previews": previews}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[voice-design] ERROR: {e}")
        raise HTTPException(status_code=502, detail=f"Voice design failed: {str(e)}")


class VoiceDesignSaveRequest(BaseModel):
    brand_id: str
    generated_voice_id: str
    name: str
    voice_description: str


@app.post("/api/voices/design/save")
async def voice_design_save(req: VoiceDesignSaveRequest):
    """Save a chosen preview as a permanent ElevenLabs voice and attach it to a brand."""
    if not tts.is_configured():
        raise HTTPException(status_code=500, detail="ELEVENLABS_API_KEY not configured")

    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, req.brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    try:
        voice_id = tts.save_designed_voice(
            generated_voice_id=req.generated_voice_id,
            voice_name=req.name,
            voice_description=req.voice_description,
        )
    except Exception as e:
        print(f"[voice-design-save] ERROR: {e}")
        raise HTTPException(status_code=502, detail=f"Voice save failed: {str(e)}")

    if not voice_id:
        raise HTTPException(status_code=502, detail="ElevenLabs did not return a voice_id")

    brand.setdefault("voicePresets", []).append({
        "id": voice_id,
        "name": req.name.strip(),
        "source": "designed",
    })
    brands.save_brands(all_brands)
    return {"id": voice_id, "name": req.name.strip(), "source": "designed"}


@app.post("/api/voices/clone")
async def voice_clone(
    brand_id: str = Form(...),
    name: str = Form(...),
    description: str = Form(""),
    files: list[UploadFile] = File(...),
):
    """Clone a voice from 1–10 uploaded audio samples (Instant Voice Cloning)."""
    if not tts.is_configured():
        raise HTTPException(status_code=500, detail="ELEVENLABS_API_KEY not configured")
    if not files:
        raise HTTPException(status_code=400, detail="Upload at least one audio file")
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 audio samples")

    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    samples: list[tuple[str, bytes, str]] = []
    for f in files:
        if not f or not f.filename:
            continue
        data = await f.read()
        samples.append((f.filename, data, f.content_type or "audio/mpeg"))

    if not samples:
        raise HTTPException(status_code=400, detail="No valid audio files received")

    try:
        voice_id = tts.clone_voice(
            voice_name=name,
            audio_files=samples,
            description=description or None,
        )
    except Exception as e:
        print(f"[voice-clone] ERROR: {e}")
        raise HTTPException(status_code=502, detail=f"Voice cloning failed: {str(e)}")

    if not voice_id:
        raise HTTPException(status_code=502, detail="ElevenLabs did not return a voice_id")

    brand.setdefault("voicePresets", []).append({
        "id": voice_id,
        "name": name.strip(),
        "source": "cloned",
    })
    brands.save_brands(all_brands)
    return {"id": voice_id, "name": name.strip(), "source": "cloned"}


# ══════════════════════════════════════════════════════════════
#  TTS
# ══════════════════════════════════════════════════════════════

@app.post("/api/tts")
async def text_to_speech(req: TTSRequest):
    """Generate speech from text — returns streaming audio."""
    try:
        audio_bytes = tts.generate_audio(
            text=req.text,
            voice_id=req.voice_id,
            model_id=req.model_id,
            output_format=req.output_format,
            stability=req.stability,
            similarity_boost=req.similarity_boost,
            style=req.style,
            use_speaker_boost=req.use_speaker_boost,
            speed=req.speed,
        )
        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=speech.mp3"},
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"TTS error: {str(e)}")


# ══════════════════════════════════════════════════════════════
#  Static Ad Templates
# ══════════════════════════════════════════════════════════════

@app.get("/api/tools/static-ad/templates")
def get_static_ad_templates():
    templates_file = Path(__file__).parent / "tools" / "static_ad" / "templates.json"
    if templates_file.exists():
        return {"templates": json.loads(templates_file.read_text())}
    return {"templates": []}


@app.get("/api/tools/carousel-creator/types")
def get_carousel_types():
    types_file = Path(__file__).parent / "tools" / "carousel_creator" / "carousel_types.json"
    if types_file.exists():
        return {"types": json.loads(types_file.read_text())}
    return {"types": []}


# ══════════════════════════════════════════════════════════════
#  Image Analysis (Gemini Vision)
# ══════════════════════════════════════════════════════════════

@app.post("/api/analyze/image")
async def analyze_image(
    image: UploadFile = File(...),
    type: str = Form("product"),
    name: str = Form(""),
):
    """Analyze an image with Gemini Vision and return a description."""
    if not image_analysis.is_configured():
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")
    try:
        data = await image.read()
        ct = image.content_type or "image/jpeg"
        if type == "avatar":
            desc = await image_analysis.describe_avatar(data, ct, name)
        else:
            desc = await image_analysis.describe_product(data, ct, name)
        return {"description": desc}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.post("/api/analyze/pose")
async def analyze_pose_reference(image: UploadFile = File(...)):
    """Analyze a reference image and extract ONLY pose/body position description (ignores style/lighting)."""
    if not image_analysis.is_configured():
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")
    try:
        data = await image.read()
        ct = image.content_type or "image/jpeg"
        pose_description = await image_analysis.analyze_pose(data, ct)
        return {"pose_description": pose_description}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.post("/api/analyze/reference")
async def analyze_reference_image(image: UploadFile = File(...)):
    """
    Classify an uploaded reference image to route it to the right slot.
    Returns: {type, confidence, description, suggested_slot}.
    """
    if not image_analysis.is_configured():
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")
    try:
        data = await image.read()
        ct = image.content_type or "image/jpeg"
        return await image_analysis.classify_reference(data, ct)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


# ══════════════════════════════════════════════════════════════
#  Instagram Scraper (via Apify)
# ══════════════════════════════════════════════════════════════

class InstagramScrapeRequest(BaseModel):
    url: str


@app.post("/api/integrations/instagram/scrape")
async def instagram_scrape_post(req: InstagramScrapeRequest):
    """Scrape an Instagram post (or carousel) via Apify and return normalized slides."""
    if not instagram_scraper.is_configured():
        raise HTTPException(status_code=500, detail="APIFY_API_KEY no configurado en backend/.env")
    try:
        raw = await instagram_scraper.scrape_post(req.url)
        normalized = await instagram_scraper.normalize_post(raw)
        return normalized
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=502, detail=f"Apify error: {str(e)[:300]}")


class InstagramReplicateRequest(BaseModel):
    url: str
    brandId: str


@app.post("/api/integrations/instagram/replicate-analysis")
async def instagram_replicate_analysis(req: InstagramReplicateRequest):
    """Scrape an IG carousel + analyze with Gemini Vision + return a brief that replicates
    the same narrative structure for the given brand."""
    if not instagram_scraper.is_configured():
        raise HTTPException(status_code=500, detail="APIFY_API_KEY no configurado")
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, req.brandId)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    try:
        # 1) Scrape
        raw = await instagram_scraper.scrape_post(req.url)
        normalized = await instagram_scraper.normalize_post(raw)

        # 2) Build a compact brand summary for the analyzer
        dna = brand.get("dna") or {}
        ds = brand.get("designSystem") or {}
        biz = brand.get("business") or {}
        summary_parts: list[str] = []
        if brand.get("name"): summary_parts.append(f"Marca: {brand['name']}")
        if biz.get("description"): summary_parts.append(f"Negocio: {biz['description']}")
        if biz.get("value_prop"): summary_parts.append(f"Value prop: {biz['value_prop']}")
        if dna.get("audience"): summary_parts.append(f"Audiencia: {dna['audience']}")
        if dna.get("tone"): summary_parts.append(f"Tono: {', '.join(dna['tone'])}")
        if dna.get("personality"): summary_parts.append(f"Personalidad: {dna['personality']}")
        if dna.get("forbidden_words"): summary_parts.append(f"Palabras prohibidas: {', '.join(dna['forbidden_words'])}")
        if ds.get("photoStyle"): summary_parts.append(f"Estilo visual: {ds['photoStyle']}")
        # Fallback: full brand context if DNA/DS are empty
        if not summary_parts and brand.get("brandContext"):
            summary_parts.append(brand["brandContext"][:6000])
        brand_summary = "\n".join(summary_parts)

        # 3) Detect language from brand summary (very rough — defaults to es)
        sample = brand_summary.lower()
        lang = "en" if (
            sample.count(" the ") + sample.count(" and ") + sample.count(" of ") > 6
            and sample.count(" de ") + sample.count(" la ") + sample.count(" el ") < 4
        ) else "es"

        # 4) Analyze with Gemini Vision
        analysis = await instagram_scraper.analyze_carousel_for_replication(
            normalized, brand_summary, lang
        )

        return {
            "scraped": normalized,
            **analysis,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=502, detail=f"Replicate analysis error: {str(e)[:300]}")


class InstagramProfileScrapeRequest(BaseModel):
    username_or_url: str
    posts_limit: int = 12


@app.post("/api/integrations/instagram/scrape-profile")
async def instagram_scrape_profile(req: InstagramProfileScrapeRequest):
    """Scrape recent posts from an IG profile — useful for brand source enrichment."""
    if not instagram_scraper.is_configured():
        raise HTTPException(status_code=500, detail="APIFY_API_KEY no configurado en backend/.env")
    try:
        items = await instagram_scraper.scrape_profile(req.username_or_url, req.posts_limit)
        normalized = []
        for it in items:
            normalized.append(await instagram_scraper.normalize_post(it))
        return {"posts": normalized, "count": len(normalized)}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=502, detail=f"Apify profile error: {str(e)[:300]}")


@app.post("/api/analyze/visual-guide")
async def analyze_visual_guide(
    images: list[UploadFile] = File(...),
    brand_context: str = Form(""),
):
    """Analyze multiple reference images and extract a visual style guide."""
    if not image_analysis.is_configured():
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")
    try:
        refs = []
        for img in images:
            data = await img.read()
            ct = img.content_type or "image/jpeg"
            refs.append((data, ct))
        guide = await image_analysis.extract_visual_guide(refs, brand_context)
        return {"visual_guide": guide}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


# ══════════════════════════════════════════════════════════════
#  Content Analyzer (Video Intelligence)
# ══════════════════════════════════════════════════════════════

@app.post("/api/analyze/video")
async def analyze_video(
    url: str = Form(""),
    video: UploadFile = File(None),
    brand_context: str = Form(""),
):
    """Analyze a video with Gemini Vision. Accepts URL or direct upload."""
    if not image_analysis.is_configured():
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

    video_bytes = None
    mime_type = "video/mp4"
    source_url = url
    work_dir = None

    try:
        if video and video.filename:
            # Direct upload
            video_bytes = await video.read()
            mime_type = video.content_type or "video/mp4"
            print(f"[content-analyzer] Uploaded video: {len(video_bytes) / 1024 / 1024:.1f}MB")
        elif url.strip():
            clean_url = url.strip()
            is_tiktok = "tiktok.com" in clean_url or "vm.tiktok.com" in clean_url

            if is_tiktok:
                # tikwm.com: free API, no auth, reliable TikTok downloads
                print(f"[content-analyzer] TikTok URL — using tikwm.com")
                dl = await video_download.download_tiktok_tikwm(clean_url)
                work_dir = dl.get("work_dir")
                video_path = Path(dl["path"])
                video_bytes = video_path.read_bytes()
                mime_type = "video/mp4"
                print(f"[content-analyzer] tikwm: {len(video_bytes) / 1024 / 1024:.1f}MB")
            else:
                # Download via yt-dlp (YouTube, Instagram, direct links)
                dl = await video_download.download_video(clean_url)
                work_dir = dl.get("work_dir")
                video_path = Path(dl["path"])
                video_bytes = video_path.read_bytes()
                ext = video_path.suffix.lower()
                mime_map = {".mp4": "video/mp4", ".webm": "video/webm", ".mkv": "video/x-matroska"}
                mime_type = mime_map.get(ext, "video/mp4")
                print(f"[content-analyzer] yt-dlp download: {len(video_bytes) / 1024 / 1024:.1f}MB")
        else:
            raise HTTPException(status_code=400, detail="Provide a video URL or upload a video file")

        # Send full video to Gemini
        analysis_raw = await image_analysis.analyze_video_direct(
            video_bytes, mime_type, source_url, brand_context
        )

        # Parse JSON
        clean = analysis_raw.strip()
        if clean.startswith("```json"):
            clean = clean.replace("```json", "").replace("```", "").strip()
        elif clean.startswith("```"):
            clean = clean.replace("```", "").strip()
        if not clean.startswith("{"):
            start = clean.find("{")
            if start != -1:
                clean = clean[start:]
        try:
            analysis = json.loads(clean)
        except json.JSONDecodeError:
            analysis = {"raw": analysis_raw}

        return {
            "analysis": analysis,
            "source_url": source_url,
            "video_size_mb": round(len(video_bytes) / 1024 / 1024, 1),
        }

    finally:
        if work_dir:
            import shutil
            shutil.rmtree(work_dir, ignore_errors=True)


# ══════════════════════════════════════════════════════════════
#  Asset Matcher — cross-reference detected_assets vs brand kit
# ══════════════════════════════════════════════════════════════

class MatchAssetsRequest(BaseModel):
    brandId: str
    detected: dict  # { persons: [...], outfits: [...], products: [...], locations: [...] }


@app.post("/api/analyze/match-assets")
async def analyze_match_assets(req: MatchAssetsRequest):
    """Given detected_assets + brand, suggest the best brand asset for each detection."""
    if not asset_matcher.is_configured():
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, req.brandId)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    try:
        matches = await asset_matcher.match_assets(req.detected, brand)
        return {"matches": matches}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Matcher error: {str(e)[:300]}")


class TikTokProfileRequest(BaseModel):
    profile_url: str
    limit: int = 10


@app.post("/api/tiktok/top-videos")
async def tiktok_top_videos(req: TikTokProfileRequest):
    """Scrape a TikTok profile and return top videos by engagement rate."""
    if not apify_tiktok.is_configured():
        raise HTTPException(status_code=500, detail="APIFY_API_KEY not configured")
    try:
        videos = await apify_tiktok.get_profile_top_videos(req.profile_url, req.limit)
        return {"videos": videos, "total": len(videos)}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.post("/api/tiktok/video-info")
async def tiktok_video_info(url: str = Form(...)):
    """Fetch metadata for a single TikTok video via Apify."""
    if not apify_tiktok.is_configured():
        raise HTTPException(status_code=500, detail="APIFY_API_KEY not configured")
    try:
        info = await apify_tiktok.get_video_info(url)
        return info
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.post("/api/tts/generate-and-upload")
async def tts_generate_and_upload(req: TTSRequest):
    """Generate TTS audio and upload to Fal Storage. Returns the Fal URL."""
    try:
        audio_bytes = tts.generate_audio(
            text=req.text,
            voice_id=req.voice_id,
            model_id=req.model_id,
            output_format=req.output_format,
            stability=req.stability,
            similarity_boost=req.similarity_boost,
            style=req.style,
            use_speaker_boost=req.use_speaker_boost,
            speed=req.speed,
        )
        # Upload to Fal Storage
        fal_url = await kling_video.upload_image(
            audio_bytes, "speech.mp3", "audio/mpeg"
        )
        return {"fal_url": fal_url, "size_bytes": len(audio_bytes)}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"TTS+Upload error: {str(e)}")


@app.post("/api/tts/generate-file")
async def tts_generate_file(req: TTSRequest):
    """Generate TTS audio and save to temp file."""
    try:
        audio_bytes = tts.generate_audio(
            text=req.text,
            voice_id=req.voice_id,
            model_id=req.model_id,
            output_format=req.output_format,
            stability=req.stability,
            similarity_boost=req.similarity_boost,
            style=req.style,
            use_speaker_boost=req.use_speaker_boost,
            speed=req.speed,
        )
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3", dir="./tmp")
        tmp.write(audio_bytes)
        tmp.close()
        return {"file_path": tmp.name, "size_bytes": len(audio_bytes)}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"TTS error: {str(e)}")


# ══════════════════════════════════════════════════════════════
#  HeyGen Routes
# ══════════════════════════════════════════════════════════════

@app.get("/api/heygen/talking-photos")
async def api_list_talking_photos():
    if not heygen.is_configured():
        raise HTTPException(status_code=500, detail="HeyGen API key not configured")
    try:
        photos = await heygen.list_talking_photos()
        return {"talking_photos": photos}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.post("/api/heygen/upload-talking-photo")
async def api_upload_talking_photo(image: UploadFile = File(...)):
    """Upload an image to HeyGen as a Photo Avatar."""
    if not heygen.is_configured():
        raise HTTPException(status_code=500, detail="HeyGen API key not configured")
    image_bytes = await image.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 10MB)")
    try:
        tp_id = await heygen.upload_talking_photo(
            image_bytes, image.filename or "photo.jpg", image.content_type or "image/jpeg",
        )
        return {"talking_photo_id": tp_id}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upload failed: {str(e)}")


@app.post("/api/heygen/generate-video")
async def api_generate_video(req: LipSyncRequest):
    if not heygen.is_configured():
        raise HTTPException(status_code=500, detail="HeyGen API key not configured")
    if not req.audio_url:
        raise HTTPException(status_code=400, detail="audio_url is required")
    try:
        video_id = await heygen.create_video(
            talking_photo_id=req.talking_photo_id,
            audio_url=req.audio_url,
            title=req.title,
        )
        return {"video_id": video_id, "status": "pending"}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/api/heygen/video-status/{video_id}")
async def api_video_status(video_id: str):
    if not heygen.is_configured():
        raise HTTPException(status_code=500, detail="HeyGen API key not configured")
    try:
        return await heygen.get_video_status(video_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


# ══════════════════════════════════════════════════════════════
#  Fal AI Lip Sync Routes
# ══════════════════════════════════════════════════════════════

@app.post("/api/fal/lipsync")
async def fal_create_lipsync(
    audio: UploadFile = File(...),
    video_url: str = Form(...),
    sync_mode: str = Form("cut_off"),
    title: str = Form("UGC Lip Sync"),
):
    """
    All-in-one Fal lip sync endpoint:
    1. Uploads audio to Fal storage
    2. Submits lip sync job with video_url + audio_url
    Returns request_id for status polling.
    """
    if not fal_lipsync.is_configured():
        raise HTTPException(status_code=500, detail="FAL_KEY not configured")

    audio_bytes = await audio.read()

    try:
        # Step 1: Upload audio to Fal storage
        audio_url = await fal_lipsync.upload_file_v2(
            audio_bytes,
            audio.filename or "audio.mp3",
            "audio/mpeg",
        )
        if not audio_url:
            raise Exception("No audio URL from Fal upload")

        # Step 2: Submit lip sync job
        request_id = await fal_lipsync.create_lipsync(
            video_url=video_url,
            audio_url=audio_url,
            sync_mode=sync_mode,
        )

        # If sync result (immediate)
        if request_id.startswith("SYNC:"):
            return {
                "request_id": request_id,
                "status": "completed",
                "video_url": request_id[5:],
            }

        return {"request_id": request_id, "status": "pending"}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Fal lip sync failed: {str(e)}")


@app.get("/api/fal/lipsync/{request_id}/status")
async def fal_lipsync_status(request_id: str):
    if not fal_lipsync.is_configured():
        raise HTTPException(status_code=500, detail="FAL_KEY not configured")
    try:
        return await fal_lipsync.get_status(request_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/api/fal/lipsync/{request_id}/result")
async def fal_lipsync_result(request_id: str):
    if not fal_lipsync.is_configured():
        raise HTTPException(status_code=500, detail="FAL_KEY not configured")
    try:
        return await fal_lipsync.get_result(request_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


# ══════════════════════════════════════════════════════════════
#  HeyGen Avatar 4 (via Fal) — Talking Head Video
# ══════════════════════════════════════════════════════════════

class HeyGenAvatar4Request(BaseModel):
    image_url: str
    prompt: str = ""
    voice: str = "Melissa"
    audio_url: str = ""
    expression: str = ""
    talking_style: str = "expressive"
    resolution: str = "720p"
    aspect_ratio: str = "9:16"


@app.post("/api/heygen-avatar4/create")
async def heygen_avatar4_create(req: HeyGenAvatar4Request):
    if not heygen_avatar4.is_configured():
        raise HTTPException(status_code=500, detail="FAL_KEY not configured")
    try:
        import base64 as _base64
        audio_url = req.audio_url
        image_url = req.image_url

        # If audio_url is a data URI, upload to Fal storage so HeyGen can fetch it
        if audio_url and audio_url.startswith("data:"):
            try:
                header, encoded = audio_url.split(",", 1)
                audio_bytes = _base64.b64decode(encoded)
                ct = header.split(";")[0].replace("data:", "") or "audio/mpeg"
                ext = ".mp3" if "mpeg" in ct else ".wav"
                audio_url = await kling_video.upload_image(audio_bytes, f"speech{ext}", ct)
                print(f"[heygen-avatar4] Uploaded data URI audio to Fal: {audio_url[:80]}")
            except Exception as e:
                print(f"[heygen-avatar4] Failed to upload data URI audio: {e}")

        # If image_url is a localhost/local URL, upload to Fal storage
        if image_url and ("localhost" in image_url or "127.0.0.1" in image_url or image_url.startswith("/static/")):
            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    img_resp = await client.get(image_url if image_url.startswith("http") else f"http://localhost:8000{image_url}")
                if img_resp.status_code == 200:
                    ct = img_resp.headers.get("content-type", "image/jpeg")
                    image_url = await kling_video.upload_image(img_resp.content, "avatar.jpg", ct)
                    print(f"[heygen-avatar4] Uploaded local image to Fal: {image_url[:80]}")
            except Exception as e:
                print(f"[heygen-avatar4] Failed to upload local image: {e}")

        request_id = await heygen_avatar4.create_video(
            image_url=image_url,
            prompt=req.prompt,
            voice=req.voice,
            audio_url=audio_url,
            expression=req.expression,
            talking_style=req.talking_style,
            resolution=req.resolution,
            aspect_ratio=req.aspect_ratio,
        )
        return {"request_id": request_id, "status": "pending"}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/api/heygen-avatar4/status/{request_id}")
async def heygen_avatar4_status(request_id: str):
    if not heygen_avatar4.is_configured():
        raise HTTPException(status_code=500, detail="FAL_KEY not configured")
    try:
        return await heygen_avatar4.get_status(request_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/api/heygen-avatar4/result/{request_id}")
async def heygen_avatar4_result(request_id: str):
    if not heygen_avatar4.is_configured():
        raise HTTPException(status_code=500, detail="FAL_KEY not configured")
    try:
        return await heygen_avatar4.get_result(request_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


# ══════════════════════════════════════════════════════════════
#  Sync Lipsync V3 (via Fal) — video + audio → lipsync video
# ══════════════════════════════════════════════════════════════

class SyncLipsyncRequest(BaseModel):
    video_url: str
    audio_url: str
    sync_mode: str = "cut_off"


@app.post("/api/synclipsync/create")
async def synclipsync_create(req: SyncLipsyncRequest):
    if not fal_synclipsync.is_configured():
        raise HTTPException(status_code=500, detail="FAL_KEY not configured")
    try:
        import base64 as _base64
        audio_url = req.audio_url
        # If audio is a data URI, upload to Fal storage first
        if audio_url and audio_url.startswith("data:"):
            try:
                header, encoded = audio_url.split(",", 1)
                audio_bytes = _base64.b64decode(encoded)
                ct = header.split(";")[0].replace("data:", "") or "audio/mpeg"
                ext = ".mp3" if "mpeg" in ct else ".wav"
                audio_url = await kling_video.upload_image(audio_bytes, f"speech{ext}", ct)
            except Exception as e:
                print(f"[synclipsync] Failed to upload data URI audio: {e}")
        request_id = await fal_synclipsync.create_lipsync(
            video_url=req.video_url,
            audio_url=audio_url,
            sync_mode=req.sync_mode,
        )
        return {"request_id": request_id, "status": "pending"}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/api/synclipsync/status/{request_id}")
async def synclipsync_status(request_id: str):
    if not fal_synclipsync.is_configured():
        raise HTTPException(status_code=500, detail="FAL_KEY not configured")
    try:
        return await fal_synclipsync.get_status(request_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/api/synclipsync/result/{request_id}")
async def synclipsync_result(request_id: str):
    if not fal_synclipsync.is_configured():
        raise HTTPException(status_code=500, detail="FAL_KEY not configured")
    try:
        return await fal_synclipsync.get_result(request_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


# ══════════════════════════════════════════════════════════════
#  Kling V2.6 Image-to-Video Routes (via Fal)
# ══════════════════════════════════════════════════════════════

class KlingFrameToFrameRequest(BaseModel):
    start_image_url: str
    end_image_url: str
    prompt: str = ""
    duration: str = "5"
    aspect_ratio: str = "9:16"
    model: Optional[str] = None  # v3-pro | v2-6-pro | v2-6-std | v2-5-turbo


@app.post("/api/kling/frame-to-frame")
async def kling_frame_to_frame(req: KlingFrameToFrameRequest):
    """Kling frame-to-frame: animate from start image to end image."""
    if not kling_video.is_configured():
        raise HTTPException(status_code=500, detail="FAL_KEY not configured")
    try:
        # Resolve local URLs
        resolved_start = req.start_image_url
        resolved_end = req.end_image_url

        static_dirs = {
            "/static/avatars/": brands.get_avatars_dir(),
            "/static/products/": brands.get_products_dir(),
            "/static/clothing/": brands.get_clothing_dir(),
            "/static/backgrounds/": brands.get_backgrounds_dir(),
        }

        for url_attr in ["start", "end"]:
            url = resolved_start if url_attr == "start" else resolved_end
            # Normalize full localhost URLs to /static/ path
            if "localhost" in url or "127.0.0.1" in url:
                for prefix in static_dirs:
                    if prefix in url:
                        url = url[url.index(prefix):]
                        break
            if url.startswith("/static/"):
                for prefix, directory in static_dirs.items():
                    if prefix in url:
                        filename = url.split(prefix)[-1]
                        local_path = directory / filename
                        if local_path.exists():
                            with open(local_path, "rb") as f:
                                img_bytes = f.read()
                            ext = local_path.suffix.lower()
                            ct_map = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}
                            fal_url = await kling_video.upload_image(img_bytes, local_path.name, ct_map.get(ext, "image/jpeg"))
                            if url_attr == "start":
                                resolved_start = fal_url
                            else:
                                resolved_end = fal_url
                        break

        # Submit to Kling V3 Pro with start + end frames
        payload = {
            "prompt": req.prompt,
            "start_image_url": resolved_start,
            "end_image_url": resolved_end,
            "duration": req.duration,
            "negative_prompt": "blur, distort, and low quality",
            "generate_audio": False,
            "cfg_scale": 0.5,
        }

        fal_path = kling_video.resolve_model(req.model)
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.post(
                f"https://queue.fal.run/{fal_path}",
                headers={"Authorization": f"Key {kling_video._get_key()}", "Content-Type": "application/json"},
                json=payload,
            )

        if res.status_code not in (200, 201):
            raise Exception(f"Kling submit failed ({res.status_code}): {res.text[:400]}")

        data = res.json()
        request_id = data.get("request_id")
        if not request_id:
            video_data = data.get("video", {})
            if video_data.get("url"):
                return {"request_id": f"SYNC:{video_data['url']}", "status": "completed"}
            raise Exception(f"No request_id: {data}")

        return {"request_id": request_id, "status": "pending"}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.post("/api/kling/image-to-video")
async def kling_create_video(
    image_url: str = Form(None),
    image: UploadFile = File(None),
    prompt: str = Form(None),
    duration: str = Form("10"),
    model: str = Form(None),  # v3-pro | v2-6-pro | v2-6-std | v2-5-turbo
):
    """
    Generate a short video from a static image using Kling V2.6.
    Accepts either an image_url OR an image file upload.
    Local/relative URLs are automatically uploaded to Fal storage.
    Returns request_id for status polling.
    """
    if not kling_video.is_configured():
        raise HTTPException(status_code=500, detail="FAL_KEY not configured")

    try:
        resolved_url = None

        # Case 1: Direct file upload
        if image:
            image_bytes = await image.read()
            resolved_url = await kling_video.upload_image(
                image_bytes,
                image.filename or "avatar.jpg",
                image.content_type or "image/jpeg",
            )

        # Case 2: image_url provided
        elif image_url:
            print(f"[kling-endpoint] Received image_url: {image_url}")
            # Check if it's a local/relative URL (not accessible from Fal servers)
            is_local = (
                image_url.startswith("/static/")
                or "localhost" in image_url
                or "127.0.0.1" in image_url
            )

            if is_local:
                # Resolve local path: extract filename from /static/avatars/xxx.png
                local_path = None
                if "/static/avatars/" in image_url:
                    filename = image_url.split("/static/avatars/")[-1]
                    local_path = brands.get_avatars_dir() / filename
                    print(f"[kling-endpoint] Resolved local path: {local_path} (exists: {local_path.exists()})")

                if local_path and local_path.exists():
                    with open(local_path, "rb") as f:
                        image_bytes = f.read()
                    # Detect content type from extension
                    ext = local_path.suffix.lower()
                    ct_map = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}
                    content_type = ct_map.get(ext, "image/jpeg")
                    print(f"[kling-endpoint] Uploading {len(image_bytes)} bytes to Fal storage...")
                    resolved_url = await kling_video.upload_image(
                        image_bytes, local_path.name, content_type,
                    )
                    print(f"[kling-endpoint] Got Fal URL: {resolved_url[:100] if resolved_url else 'None'}")
                else:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Local avatar image not found: {image_url}",
                    )
            else:
                # External URL — download and re-upload to ensure Fal can access it
                print(f"[kling-endpoint] Downloading external URL...")
                async with httpx.AsyncClient(timeout=30) as client:
                    resp = await client.get(image_url)
                if resp.status_code == 200:
                    resolved_url = await kling_video.upload_image(
                        resp.content, "avatar.jpg", resp.headers.get("content-type", "image/jpeg"),
                    )
                else:
                    # Try using the URL directly (might work for public URLs)
                    resolved_url = image_url

        if not resolved_url:
            raise HTTPException(status_code=400, detail="Either image_url or image file required")

        print(f"[kling-endpoint] Final resolved_url: {resolved_url[:100] if resolved_url else 'None'}")

        request_id = await kling_video.create_video(
            image_url=resolved_url,
            prompt=prompt,
            duration=duration,
            model=model,
        )

        print(f"[kling-endpoint] Got request_id: {request_id}")

        # Handle sync result
        if request_id.startswith("SYNC:"):
            return {
                "request_id": request_id,
                "status": "completed",
                "video_url": request_id[5:],
            }

        return {"request_id": request_id, "status": "pending"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[kling-endpoint] ERROR: {e}")
        raise HTTPException(status_code=502, detail=f"Kling video generation failed: {str(e)}")


@app.get("/api/kling/status/{request_id}")
async def kling_video_status(request_id: str):
    if not kling_video.is_configured():
        raise HTTPException(status_code=500, detail="FAL_KEY not configured")
    try:
        return await kling_video.get_status(request_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/api/kling/result/{request_id}")
async def kling_video_result(request_id: str):
    if not kling_video.is_configured():
        raise HTTPException(status_code=500, detail="FAL_KEY not configured")
    try:
        return await kling_video.get_result(request_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


# ══════════════════════════════════════════════════════════════
#  Seedance 2.0 — Reference-to-Video (via Fal)
# ══════════════════════════════════════════════════════════════
#  Multi-reference video generation. Takes N reference images + a prompt and
#  generates a video that integrates elements from all of them. Different from
#  Kling i2v (single start frame) — Seedance uses refs as visual guides.

class SeedanceRefToVideoRequest(BaseModel):
    prompt: str
    reference_image_urls: List[str] = []
    duration: str = "5"
    aspect_ratio: str = "9:16"
    resolution: Optional[str] = None
    # Optional audio for lipsync — when provided, Seedance generates the talking
    # head synced to the audio (replaces HeyGen/Fal lipsync for talking scenes).
    audio_urls: Optional[List[str]] = None
    reference_video_urls: Optional[List[str]] = None


@app.post("/api/seedance/reference-to-video")
async def seedance_create_rtv(req: SeedanceRefToVideoRequest):
    """Generate a video from N reference images + a prompt using Seedance 2.0."""
    if not seedance_video.is_configured():
        raise HTTPException(status_code=500, detail="FAL_KEY not configured")
    try:
        # Resolve every reference image to a Fal-hosted URL. Fal's `image_urls`
        # expects real URLs — data: blobs (uploads / generated results in the Lab)
        # must be uploaded to Fal storage, same as audio. Without this, multi-ref
        # requests fail because raw base64 data URLs are rejected.
        import base64
        resolved_urls: List[str] = []
        static_dirs = {
            "/static/avatars/": brands.get_avatars_dir(),
            "/static/products/": brands.get_products_dir(),
            "/static/clothing/": brands.get_clothing_dir(),
            "/static/backgrounds/": brands.get_backgrounds_dir(),
        }
        img_ext_map = {"image/png": ".png", "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/webp": ".webp"}
        for url in req.reference_image_urls:
            if not url:
                continue
            # data: URL → decode + upload to Fal
            if url.startswith("data:"):
                try:
                    header, b64 = url.split(",", 1)
                    mime = "image/png"
                    if ":" in header:
                        mime = header.split(":", 1)[1].split(";", 1)[0] or "image/png"
                    ext = img_ext_map.get(mime, ".png")
                    img_bytes = base64.b64decode(b64)
                    fal_url = await kling_video.upload_image(img_bytes, f"ref{ext}", mime)
                    resolved_urls.append(fal_url)
                    print(f"[seedance-endpoint] Resolved image data URL ({len(img_bytes)} bytes, {mime}) -> uploaded to Fal")
                except Exception as e:
                    print(f"[seedance-endpoint] FAILED to upload image data URL: {e}")
                continue
            resolved = url
            if "localhost" in url or "127.0.0.1" in url:
                for prefix in static_dirs:
                    if prefix in url:
                        resolved = url[url.index(prefix):]
                        break
            if resolved.startswith("/static/"):
                for prefix, directory in static_dirs.items():
                    if prefix in resolved:
                        filename = resolved.split(prefix)[-1]
                        local_path = directory / filename
                        if local_path.exists():
                            ext = local_path.suffix.lower()
                            ct_map = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}
                            with open(local_path, "rb") as f:
                                img_bytes = f.read()
                            resolved = await kling_video.upload_image(img_bytes, local_path.name, ct_map.get(ext, "image/jpeg"))
                        break
            resolved_urls.append(resolved)

        # Audio URLs — same resolution pattern as images. data: and local /static/
        # URLs need to be uploaded to Fal storage; external http(s) URLs pass through.
        resolved_audio_urls: Optional[List[str]] = None
        if req.audio_urls:
            import base64
            resolved_audio_urls = []
            for audio_url in req.audio_urls:
                if not audio_url:
                    continue
                if audio_url.startswith("data:"):
                    try:
                        header, b64 = audio_url.split(",", 1)
                        mime = "audio/mpeg"
                        if ";" in header:
                            mime = header.split(":", 1)[1].split(";", 1)[0] or "audio/mpeg"
                        ext_map = {"audio/mpeg": ".mp3", "audio/mp3": ".mp3", "audio/wav": ".wav", "audio/x-wav": ".wav", "audio/webm": ".webm", "audio/ogg": ".ogg", "audio/mp4": ".m4a"}
                        ext = ext_map.get(mime, ".mp3")
                        audio_bytes = base64.b64decode(b64)
                        fal_url = await kling_video.upload_image(audio_bytes, f"audio{ext}", mime)
                        resolved_audio_urls.append(fal_url)
                        print(f"[seedance-endpoint] Resolved audio data URL ({len(audio_bytes)} bytes, {mime}) -> uploaded to Fal")
                    except Exception as e:
                        print(f"[seedance-endpoint] FAILED to upload audio data URL: {e}")
                    continue
                # Local /static/renders/... or localhost URL → resolve to disk and upload
                is_local = "localhost" in audio_url or "127.0.0.1" in audio_url or audio_url.startswith("/static/")
                if is_local:
                    rel = audio_url[audio_url.index("/static/"):] if "/static/" in audio_url else audio_url
                    parts = rel.split("/static/", 1)[-1].split("/", 1)
                    if len(parts) == 2:
                        subdir, filename = parts
                        local_path = brands.DATA_DIR / subdir / filename
                        if local_path.exists():
                            ext = local_path.suffix.lower()
                            ct_map = {".mp3": "audio/mpeg", ".wav": "audio/wav", ".webm": "audio/webm", ".m4a": "audio/mp4", ".ogg": "audio/ogg"}
                            with open(local_path, "rb") as f:
                                audio_bytes = f.read()
                            fal_url = await kling_video.upload_image(audio_bytes, local_path.name, ct_map.get(ext, "audio/mpeg"))
                            resolved_audio_urls.append(fal_url)
                            print(f"[seedance-endpoint] Resolved local audio: {audio_url} -> uploaded to Fal")
                            continue
                    print(f"[seedance-endpoint] Local audio not found or unresolvable: {audio_url}")
                else:
                    resolved_audio_urls.append(audio_url)

        request_id = await seedance_video.create_reference_to_video(
            prompt=req.prompt,
            reference_image_urls=resolved_urls,
            duration=req.duration,
            aspect_ratio=req.aspect_ratio,
            resolution=req.resolution,
            audio_urls=resolved_audio_urls,
            reference_video_urls=req.reference_video_urls,
        )

        if request_id.startswith("SYNC:"):
            return {"request_id": request_id, "status": "completed", "video_url": request_id[5:]}
        return {"request_id": request_id, "status": "pending"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[seedance-endpoint] ERROR: {e}")
        raise HTTPException(status_code=502, detail=f"Seedance generation failed: {str(e)}")


@app.get("/api/seedance/status/{request_id}")
async def seedance_status(request_id: str):
    if not seedance_video.is_configured():
        raise HTTPException(status_code=500, detail="FAL_KEY not configured")
    try:
        return await seedance_video.get_status(request_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/api/seedance/result/{request_id}")
async def seedance_result(request_id: str):
    if not seedance_video.is_configured():
        raise HTTPException(status_code=500, detail="FAL_KEY not configured")
    try:
        return await seedance_video.get_result(request_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


# ══════════════════════════════════════════════════════════════
#  Video Swap (Beeble SwitchX) — keep the subject/motion of a source video,
#  swap a garment/product/background to a reference image, relight to match.
# ══════════════════════════════════════════════════════════════

@app.post("/api/video-swap/create")
async def video_swap_create(
    source_video: UploadFile = File(...),
    alpha_mode: str = Form("auto"),
    prompt: str = Form(""),
    reference_image: Optional[UploadFile] = File(None),
    alpha_mask: Optional[UploadFile] = File(None),
):
    """Upload assets to Beeble + start a SwitchX job. Returns job_id."""
    if not beeble_switchx.is_configured():
        raise HTTPException(status_code=500, detail="BEEBLE_API_KEY not configured")
    try:
        src_bytes = await source_video.read()
        src_ref = await beeble_switchx.upload_asset(
            src_bytes, source_video.filename or "source.mp4", source_video.content_type or "video/mp4"
        )

        ref_image_ref = None
        if reference_image and reference_image.filename:
            ri_bytes = await reference_image.read()
            ref_image_ref = await beeble_switchx.upload_asset(
                ri_bytes, reference_image.filename, reference_image.content_type or "image/png"
            )

        alpha_ref = None
        if alpha_mask and alpha_mask.filename:
            am_bytes = await alpha_mask.read()
            alpha_ref = await beeble_switchx.upload_asset(
                am_bytes, alpha_mask.filename, alpha_mask.content_type or "video/mp4"
            )

        job_id = await beeble_switchx.start_generation(
            source_video_ref=src_ref,
            alpha_mode=alpha_mode,
            reference_image_ref=ref_image_ref,
            alpha_mask_ref=alpha_ref,
            prompt=prompt or None,
        )
        return {"job_id": job_id, "status": "pending"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[video-swap] ERROR: {e}")
        raise HTTPException(status_code=502, detail=f"Video swap failed: {str(e)}")


@app.get("/api/video-swap/status/{job_id}")
async def video_swap_status(job_id: str):
    if not beeble_switchx.is_configured():
        raise HTTPException(status_code=500, detail="BEEBLE_API_KEY not configured")
    try:
        return await beeble_switchx.get_status(job_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.post("/api/lipsync")
async def create_lipsync(
    audio: UploadFile = File(...),
    talking_photo_id: str = Form(...),
    title: str = Form("UGC Lip Sync"),
):
    """
    All-in-one lip sync endpoint:
    1. Uploads the audio file to HeyGen as asset
    2. Creates a talking photo video with that audio
    Returns video_id for status polling.
    """
    if not heygen.is_configured():
        raise HTTPException(status_code=500, detail="HeyGen API key not configured")

    audio_bytes = await audio.read()

    try:
        # Step 1: Upload audio as asset
        asset = await heygen.upload_asset(audio_bytes, audio.filename or "audio.mp3", "audio/mpeg")
        audio_url = asset.get("url")
        if not audio_url:
            raise Exception(f"No audio URL from asset upload: {asset}")

        # Step 2: Create video
        video_id = await heygen.create_video(
            talking_photo_id=talking_photo_id,
            audio_url=audio_url,
            title=title,
        )
        return {"video_id": video_id, "status": "pending"}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Lip sync failed: {str(e)}")


# ══════════════════════════════════════════════════════════════
#  Image Generation / Edit (nano-banana-2/edit via Fal)
# ══════════════════════════════════════════════════════════════

@app.post("/api/image-gen/edit")
async def image_gen_edit(
    prompt: str = Form(...),
    image_urls: str = Form("[]"),  # JSON array of URLs
    image_files: Optional[list[UploadFile]] = File(None),
    aspect_ratio: str = Form("9:16"),
    resolution: str = Form("1K"),
    model: str = Form("nano-banana-2"),  # "nano-banana-2" | "gpt-image-2"
):
    """
    Generate/edit an image. Routes to different Fal models based on `model` param.
    - nano-banana-2 (default): multi-reference composition. Best when combining avatar + product + background.
    - gpt-image-2: single-base edit. Best when iterating on one image or precise edits.

    Accepts image URLs (JSON array) and/or uploaded files.
    Local URLs are auto-uploaded to Fal storage.
    Returns request_id for status polling.
    """
    if not image_gen.is_configured():
        raise HTTPException(status_code=500, detail="FAL_KEY not configured")

    import json

    try:
        import base64
        # Parse image URLs
        resolved_urls = []
        try:
            url_list = json.loads(image_urls)
            if isinstance(url_list, list):
                for url in url_list:
                    if not url:
                        continue

                    # Case A: data: URL (Manual Lab uploads / pasted images) — decode and
                    # upload to Fal storage. Fal models reject inline base64 over ~2MB and
                    # silently drop large refs, which is the bug Manual Lab was hitting.
                    if url.startswith("data:"):
                        try:
                            header, b64 = url.split(",", 1)
                            mime = "image/png"
                            if ";" in header:
                                mime = header.split(":", 1)[1].split(";", 1)[0] or "image/png"
                            ext_map = {"image/png": ".png", "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/webp": ".webp"}
                            ext = ext_map.get(mime, ".png")
                            img_bytes = base64.b64decode(b64)
                            fal_url = await kling_video.upload_image(img_bytes, f"upload{ext}", mime)
                            resolved_urls.append(fal_url)
                            print(f"[image-gen] Resolved data URL ({len(img_bytes)} bytes, {mime}) -> uploaded to Fal")
                        except Exception as e:
                            print(f"[image-gen] FAILED to upload data URL: {e}")
                        continue

                    # Case B: local static URL (brand kit asset) — resolve to disk, then upload to Fal
                    is_local = (
                        url.startswith("/static/")
                        or "localhost" in url
                        or "127.0.0.1" in url
                    )
                    if is_local:
                        local_path = None
                        static_dirs = {
                            "/static/avatars/": brands.get_avatars_dir(),
                            "/static/products/": brands.get_products_dir(),
                            "/static/clothing/": brands.get_clothing_dir(),
                            "/static/backgrounds/": brands.get_backgrounds_dir(),
                            "/static/moodboards/": brands.get_moodboards_dir(),
                            "/static/lookandfeel/": brands.get_lookandfeel_dir(),
                            "/static/logos/": brands.get_logos_dir(),
                        }
                        for prefix, directory in static_dirs.items():
                            if prefix in url:
                                filename = url.split(prefix)[-1]
                                local_path = directory / filename
                                break

                        if local_path and local_path.exists():
                            with open(local_path, "rb") as f:
                                img_bytes = f.read()
                            ext = local_path.suffix.lower()
                            ct_map = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}
                            fal_url = await kling_video.upload_image(img_bytes, local_path.name, ct_map.get(ext, "image/jpeg"))
                            resolved_urls.append(fal_url)
                            print(f"[image-gen] Resolved local: {url} -> uploaded to Fal")
                        else:
                            print(f"[image-gen] Local file not found or unresolvable: {url}")
                    else:
                        # Case C: external http(s) URL — Fal can fetch it directly
                        resolved_urls.append(url)
        except json.JSONDecodeError:
            # Single URL string
            if image_urls and image_urls != "[]":
                resolved_urls.append(image_urls)

        # Handle file uploads
        if image_files:
            for f in image_files:
                if f and f.filename:
                    file_bytes = await f.read()
                    fal_url = await kling_video.upload_image(
                        file_bytes, f.filename, f.content_type or "image/jpeg"
                    )
                    resolved_urls.append(fal_url)

        # Compact diagnostic: ref count + types + prompt length. Flags a "LOCAL!" ref that
        # Fal can't fetch (should never happen — everything is uploaded above).
        kinds = [
            "DATA" if u.startswith("data:") else ("FAL" if "fal" in u else ("LOCAL!" if (u.startswith("/static/") or "localhost" in u) else "EXT"))
            for u in resolved_urls
        ]
        print(f"[image-gen] {len(resolved_urls)} refs {kinds} · prompt_len={len(prompt)} · model={model}", flush=True)

        if model == "gpt-image-2":
            request_id = await gpt_image_gen.create_edit(
                image_urls=resolved_urls,
                prompt=prompt,
                aspect_ratio=aspect_ratio,
            )
            prefixed_id = f"gpt2:{request_id}"
        else:
            request_id = await image_gen.create_edit(
                image_urls=resolved_urls,
                prompt=prompt,
                aspect_ratio=aspect_ratio,
                resolution=resolution,
            )
            prefixed_id = request_id  # nano-banana-2 default (no prefix for back-compat)

        # Handle sync result
        if request_id.startswith("SYNC:"):
            return {
                "request_id": prefixed_id,
                "status": "completed",
                "image_url": request_id[5:],
            }

        return {"request_id": prefixed_id, "status": "pending"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"[image-gen] ERROR: {e}")
        raise HTTPException(status_code=502, detail=f"Image generation failed: {str(e)}")


@app.post("/api/image-gen/text-to-image")
async def image_gen_text_to_image(
    prompt: str = Form(...),
    aspect_ratio: str = Form("1:1"),
    resolution: str = Form("2K"),
    model: str = Form("nano-banana-2"),
):
    """Text-to-image. Routes by model (nano-banana-2 default, gpt-image-2 optional)."""
    if not image_gen.is_configured():
        raise HTTPException(status_code=500, detail="FAL_KEY not configured")
    try:
        print(f"[t2i] model={model}, prompt={prompt[:80]}, aspect={aspect_ratio}")
        if model == "gpt-image-2":
            request_id = await gpt_image_gen.create_text_to_image(
                prompt=prompt,
                aspect_ratio=aspect_ratio,
            )
            prefixed_id = f"gpt2:{request_id}"
        else:
            request_id = await image_gen.create_text_to_image(
                prompt=prompt,
                aspect_ratio=aspect_ratio,
                resolution=resolution,
            )
            prefixed_id = request_id
        if request_id.startswith("SYNC:"):
            return {"request_id": prefixed_id, "status": "completed", "image_url": request_id[5:]}
        return {"request_id": prefixed_id, "status": "pending"}
    except Exception as e:
        print(f"[t2i] ERROR: {e}")
        raise HTTPException(status_code=502, detail=f"Text-to-image failed: {str(e)}")


def _resolve_image_service(request_id: str):
    """Return (service_module, stripped_request_id) based on prefix."""
    if request_id.startswith("gpt2:"):
        return gpt_image_gen, request_id[len("gpt2:"):]
    return image_gen, request_id


@app.get("/api/image-gen/status/{request_id}")
async def image_gen_status(request_id: str):
    if not image_gen.is_configured():
        raise HTTPException(status_code=500, detail="FAL_KEY not configured")
    try:
        svc, rid = _resolve_image_service(request_id)
        return await svc.get_status(rid)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/api/image-gen/result/{request_id}")
async def image_gen_result(request_id: str):
    if not image_gen.is_configured():
        raise HTTPException(status_code=500, detail="FAL_KEY not configured")
    try:
        svc, rid = _resolve_image_service(request_id)
        result = await svc.get_result(rid)
        # If the service returned a structured failure, return it as 200 so the client
        # can surface the actual error instead of seeing an opaque 502.
        return result
    except Exception as e:
        # Only true network/transport errors reach here. Log + 502.
        import traceback
        print(f"[image-gen-result] EXCEPTION for {request_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=502, detail=str(e))


# ══════════════════════════════════════════════════════════════
#  Video Concat (FFmpeg)
# ══════════════════════════════════════════════════════════════

class ConcatRequest(BaseModel):
    video_urls: List[str]
    scripts: Optional[List[dict]] = None  # [{"text": "spoken text"}, ...] per segment
    add_subtitles: bool = True
    subtitle_engine: str = "auto"  # "auto" | "remotion" | "ffmpeg" | "none"

class OverlayAudioRequest(BaseModel):
    video_url: str
    audio_url: str

@app.post("/api/video/overlay-audio")
async def overlay_audio_endpoint(req: OverlayAudioRequest):
    """Overlay a TTS audio track onto a silent video (e.g. Kling creative shots)."""
    if not video_concat.is_configured():
        raise HTTPException(status_code=500, detail="FFmpeg not installed")
    try:
        renders_dir = Path("data/renders")
        renders_dir.mkdir(parents=True, exist_ok=True)
        result = await video_concat.overlay_audio(req.video_url, req.audio_url, str(renders_dir))
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.post("/api/video/concat")
async def concat_videos_endpoint(req: ConcatRequest):
    """Concatenate video URLs + burn subtitles."""
    if not video_concat.is_configured():
        raise HTTPException(status_code=500, detail="FFmpeg is not installed on the server")
    try:
        output_dir = str(DATA_DIR / "renders")
        result = await video_concat.concat_videos(
            req.video_urls,
            output_dir=output_dir,
            scripts=req.scripts,
            add_subtitles=req.add_subtitles,
            subtitle_engine=req.subtitle_engine,
        )
        output_path = result["output_path"]
        filename = os.path.basename(output_path)
        return {
            "video_url": f"/static/renders/{filename}",
            "duration": result["duration"],
            "size_bytes": result["size_bytes"],
            "num_segments": result["num_segments"],
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@app.get("/api/video/concat/check")
def check_ffmpeg():
    """Check if FFmpeg is available."""
    return {"available": video_concat.is_configured()}


# ══════════════════════════════════════════════════════════════
#  Generations CRUD
# ══════════════════════════════════════════════════════════════

@app.get("/api/generations")
def list_generations(brandId: Optional[str] = None):
    """List all generations, optionally filtered by brand.

    Special value brandId="__none__" returns only brand-agnostic generations
    (Manual Lab). Omitting brandId returns everything.
    """
    gens = _load_generations()
    if brandId == "__none__":
        gens = [g for g in gens if not g.get("brandId")]
    elif brandId:
        gens = [g for g in gens if g.get("brandId") == brandId]
    gens.sort(key=lambda g: g.get("createdAt", ""), reverse=True)
    return {"generations": gens}


@app.get("/api/generations/{gen_id}")
def get_generation(gen_id: str):
    gens = _load_generations()
    gen = next((g for g in gens if g["id"] == gen_id), None)
    if not gen:
        raise HTTPException(status_code=404, detail="Generation not found")
    return gen


@app.post("/api/generations")
async def create_generation(req: SaveGenerationRequest):
    """Save a completed generation."""
    gens = _load_generations()
    from datetime import datetime, timezone

    gen = {
        "id": f"gen_{uuid.uuid4().hex[:8]}",
        "brandId": req.brandId,
        "toolId": req.toolId,
        "title": req.title,
        "type": req.type,
        "status": req.status,
        "thumbnailUrl": req.thumbnailUrl,
        "outputUrl": req.outputUrl,
        "scenes": req.scenes or [],
        "metadata": req.metadata or {},
        "pipelineState": req.pipelineState,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    gens.append(gen)
    _save_generations(gens)
    return gen


# ══════════════════════════════════════════════════════════════
#  Client Review Links — share a generation for per-clip feedback
# ══════════════════════════════════════════════════════════════

REVIEWS_FILE = DATA_DIR / "reviews.json"


def _load_reviews() -> List[dict]:
    if not REVIEWS_FILE.exists():
        return []
    try:
        with open(REVIEWS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def _save_reviews(reviews: List[dict]):
    with open(REVIEWS_FILE, "w", encoding="utf-8") as f:
        json.dump(reviews, f, ensure_ascii=False, indent=2)


def _extract_clips(gen: dict) -> List[dict]:
    """Pull a flat list of reviewable clips (video/image + label) from a generation's scenes."""
    clips: List[dict] = []
    for i, s in enumerate(gen.get("scenes") or []):
        if not isinstance(s, dict):
            continue
        url = (s.get("videoUrl") or s.get("video_url") or s.get("url")
               or s.get("imageUrl") or s.get("image_url") or s.get("selectedUrl"))
        if not url:
            continue
        is_video = bool(s.get("videoUrl") or s.get("video_url")) or (isinstance(url, str) and url.lower().endswith((".mp4", ".webm", ".mov")))
        clips.append({
            "id": str(s.get("sceneId") or s.get("id") or f"clip_{i + 1}"),
            "label": str(s.get("title") or s.get("label") or f"Escena {i + 1}"),
            "url": url,
            "type": "video" if is_video else "image",
        })
    if not clips and gen.get("outputUrl"):
        clips.append({"id": "final", "label": "Video final", "url": gen["outputUrl"], "type": "video"})
    return clips


class CreateReviewRequest(BaseModel):
    generationId: str


class ReviewFeedbackRequest(BaseModel):
    clipId: str
    status: str = ""        # "approved" | "change" | ""
    comment: str = ""


@app.post("/api/reviews")
async def create_review(req: CreateReviewRequest):
    """Create a shareable review link for a generation (snapshots its clips)."""
    gens = _load_generations()
    gen = next((g for g in gens if g.get("id") == req.generationId), None)
    if not gen:
        raise HTTPException(status_code=404, detail="Generation not found")
    from datetime import datetime, timezone
    reviews = _load_reviews()
    # Reuse an existing review for this generation if present (so the link is stable).
    existing = next((r for r in reviews if r.get("generationId") == req.generationId), None)
    if existing:
        existing["clips"] = _extract_clips(gen)  # refresh clips (e.g. after a per-clip regen)
        existing["title"] = gen.get("title")
        existing["outputUrl"] = gen.get("outputUrl")
        _save_reviews(reviews)
        return existing
    review = {
        "token": f"rv_{uuid.uuid4().hex[:12]}",
        "generationId": req.generationId,
        "brandId": gen.get("brandId"),
        "title": gen.get("title"),
        "outputUrl": gen.get("outputUrl"),
        "clips": _extract_clips(gen),
        "feedback": {},
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    reviews.append(review)
    _save_reviews(reviews)
    return review


@app.get("/api/reviews")
def list_reviews():
    """All reviews — used to badge which generations have client feedback."""
    return {"reviews": _load_reviews()}


@app.get("/api/reviews/{token}")
def get_review(token: str):
    """Public: the client opens this with the token in the URL — no auth."""
    reviews = _load_reviews()
    review = next((r for r in reviews if r.get("token") == token), None)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    return review


@app.post("/api/reviews/{token}/feedback")
async def submit_review_feedback(token: str, req: ReviewFeedbackRequest):
    """Public: the client approves / requests changes per clip."""
    from datetime import datetime, timezone
    reviews = _load_reviews()
    review = next((r for r in reviews if r.get("token") == token), None)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    review.setdefault("feedback", {})[req.clipId] = {
        "status": req.status,
        "comment": req.comment,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    _save_reviews(reviews)
    return {"ok": True}


@app.get("/api/generations/{gen_id}/review")
def get_generation_review(gen_id: str):
    """Agency-side: the review (+ client feedback) for a generation, if one exists."""
    reviews = _load_reviews()
    review = next((r for r in reviews if r.get("generationId") == gen_id), None)
    return review or {}


def _ensure_review(gen: dict) -> dict:
    """Find or create the review record for a generation (refreshing its clips)."""
    from datetime import datetime, timezone
    reviews = _load_reviews()
    existing = next((r for r in reviews if r.get("generationId") == gen.get("id")), None)
    if existing:
        existing["clips"] = _extract_clips(gen)
        existing["title"] = gen.get("title")
        existing["outputUrl"] = gen.get("outputUrl")
        _save_reviews(reviews)
        return existing
    review = {
        "token": f"rv_{uuid.uuid4().hex[:12]}",
        "generationId": gen.get("id"),
        "brandId": gen.get("brandId"),
        "title": gen.get("title"),
        "outputUrl": gen.get("outputUrl"),
        "clips": _extract_clips(gen),
        "feedback": {},
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    reviews.append(review)
    _save_reviews(reviews)
    return review


# ══════════════════════════════════════════════════════════════
#  Client Portal — per-brand magic link, curated by the agency
# ══════════════════════════════════════════════════════════════

class PublishRequest(BaseModel):
    published: bool = True


@app.post("/api/generations/{gen_id}/publish")
async def publish_generation(gen_id: str, req: PublishRequest):
    """Agency: show/hide a generation in the client portal."""
    gens = _load_generations()
    gen = next((g for g in gens if g.get("id") == gen_id), None)
    if not gen:
        raise HTTPException(status_code=404, detail="Generation not found")
    gen["publishedToPortal"] = req.published
    _save_generations(gens)
    if req.published:
        _ensure_review(gen)  # so the portal has clips + a review token ready
    return {"ok": True, "published": req.published}


@app.post("/api/brands/{brand_id}/portal")
async def ensure_brand_portal(brand_id: str):
    """Agency: get (or create) the brand's client-portal magic link token."""
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    if not brand.get("portalToken"):
        brand["portalToken"] = f"pt_{uuid.uuid4().hex[:12]}"
        brands.save_brands(all_brands)
    return {"token": brand["portalToken"]}


@app.get("/api/portal/{token}")
def get_portal(token: str):
    """Public: the client opens /portal/{token} and sees the brand's PUBLISHED content."""
    all_brands = brands.load_brands()
    brand = next((b for b in all_brands if b.get("portalToken") == token), None)
    if not brand:
        raise HTTPException(status_code=404, detail="Portal not found")
    gens = [g for g in _load_generations()
            if g.get("brandId") == brand.get("id") and g.get("publishedToPortal") and g.get("status") == "completed"]
    gens.sort(key=lambda g: g.get("createdAt", ""), reverse=True)
    items = []
    for g in gens:
        review = _ensure_review(g)
        vals = list((review.get("feedback") or {}).values())
        items.append({
            "generationId": g.get("id"),
            "token": review.get("token"),
            "title": g.get("title"),
            "type": g.get("type"),
            "thumbnailUrl": g.get("thumbnailUrl"),
            "createdAt": g.get("createdAt"),
            "summary": {
                "total": len(review.get("clips") or []),
                "approved": sum(1 for v in vals if v.get("status") == "approved"),
                "changes": sum(1 for v in vals if v.get("status") == "change"),
            },
        })
    return {"brandName": brand.get("name"), "items": items}


@app.patch("/api/generations/{gen_id}")
async def update_generation(gen_id: str, req: SaveGenerationRequest):
    """Update an existing generation (for auto-save across pipeline steps)."""
    gens = _load_generations()
    idx = next((i for i, g in enumerate(gens) if g["id"] == gen_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Generation not found")
    existing = gens[idx]
    existing.update({
        "brandId": req.brandId,
        "toolId": req.toolId,
        "title": req.title,
        "type": req.type,
        "status": req.status,
        "thumbnailUrl": req.thumbnailUrl or existing.get("thumbnailUrl"),
        "outputUrl": req.outputUrl or existing.get("outputUrl"),
        "scenes": req.scenes if req.scenes is not None else existing.get("scenes", []),
        "metadata": req.metadata if req.metadata is not None else existing.get("metadata", {}),
        "pipelineState": req.pipelineState if req.pipelineState is not None else existing.get("pipelineState"),
    })
    gens[idx] = existing
    _save_generations(gens)
    return existing


@app.delete("/api/generations/{gen_id}")
def delete_generation(gen_id: str):
    gens = _load_generations()
    gen = next((g for g in gens if g["id"] == gen_id), None)
    if not gen:
        raise HTTPException(status_code=404, detail="Generation not found")
    gens = [g for g in gens if g["id"] != gen_id]
    _save_generations(gens)
    return {"ok": True}


# ══════════════════════════════════════════════════════════════
#  Response Normalizer — force consistent field names
# ══════════════════════════════════════════════════════════════

def _normalize_scene(scene: dict, index: int) -> dict:
    """Normalize a single scene/act from Gemini to canonical field names."""
    import re as _re

    def _str(val) -> str:
        """Safely convert a value to string, returning '' for None/falsy non-strings."""
        if val is None:
            return ""
        if isinstance(val, dict):
            # Handle {speaker: "...", dialogue: "..."} or {text: "..."} or {line: "..."}
            return str(
                val.get("dialogue") or val.get("text") or val.get("line")
                or val.get("speech") or val.get("copy") or val.get("narration")
                or next((v for v in val.values() if isinstance(v, str) and len(v) > 5), "")
            )
        if isinstance(val, list):
            # Handle [{speaker, dialogue}, ...] or ["line1", "line2"]
            parts = []
            for item in val:
                if isinstance(item, dict):
                    parts.append(_str(item))
                elif isinstance(item, str) and item:
                    parts.append(item)
            return " ".join(p for p in parts if p)
        return str(val)

    # Script text — try every known field name
    raw_script = (
        scene.get("script") or scene.get("spoken_script") or scene.get("speech")
        or scene.get("copy") or scene.get("text") or scene.get("audio")
        or scene.get("dialogue") or scene.get("narration") or scene.get("voiceover")
        or scene.get("voiceover_script") or scene.get("narration_text")
        or scene.get("action") or scene.get("spoken") or scene.get("line")
        or scene.get("lines") or ""
    )
    script = _str(raw_script)
    # Strip **Name:** or *Name:* or Name: speaker labels — ONLY at start of string (^ anchor)
    script = _re.sub(r'^\*{0,2}[\w\s]{1,30}\*{0,2}\s*:\s*', '', script).strip()
    # Strip remaining known prefixes like "AVATAR:", "OFF-CAMERA:" — ONLY at start
    script = _re.sub(
        r'^(AVATAR|OFF[- ]?CAMERA|ON[- ]?CAMERA|NARRATOR|SPEAKER)\s*:\s*',
        '', script, flags=_re.IGNORECASE
    ).strip()
    # Collapse multiple blank lines left by removed stage directions
    script = _re.sub(r'\n{3,}', '\n\n', script).strip()

    # Image prompt — try every known field name
    raw_image_prompt = (
        scene.get("image_prompt") or scene.get("visual_description")
        or scene.get("visuals") or scene.get("visual") or scene.get("visual_prompt")
        or scene.get("scene_description") or scene.get("setting") or scene.get("prompt") or ""
    )
    image_prompt = _str(raw_image_prompt)
    # Don't use numeric values (e.g. "scene": 1)
    if image_prompt and image_prompt.strip().isdigit():
        image_prompt = ""

    # Location — keep as separate field AND optionally append to image_prompt context
    location = _str(scene.get("location") or scene.get("ambiente") or "")

    # Background (optional, merge into image_prompt if separate and not already covered by location)
    bg = _str(scene.get("background") or "")
    if bg and image_prompt and bg not in image_prompt:
        image_prompt = f"{image_prompt}. Setting: {bg}"
    elif bg and not image_prompt:
        image_prompt = bg

    # Pass through AI-suggested scene type if present
    scene_type = scene.get("sceneType") or scene.get("scene_type") or "talking"
    if scene_type not in ("talking", "creative", "lifestyle", "sensorial", "product_reveal"):
        scene_type = "talking"

    result = {
        "id": str(scene.get("id") or scene.get("scene_number") or scene.get("scene") or f"act_{index + 1}"),
        "title": scene.get("title") or scene.get("act") or scene.get("scene_title") or f"Scene {index + 1}",
        "script": script,
        "image_prompt": image_prompt,
        "sceneType": scene_type,
    }
    if location:
        result["location"] = location
    return result


def _normalize_script_response(data) -> list:
    """Normalize a full script response — handles arrays, nested scenes, etc."""
    if isinstance(data, list):
        # Could be [[scenes]] or [scenes]
        if len(data) > 0 and isinstance(data[0], list):
            scenes = data[0]
        else:
            scenes = data
    elif isinstance(data, dict):
        if "scenes" in data:
            scenes = data["scenes"]
            if isinstance(scenes, list) and len(scenes) > 0 and isinstance(scenes[0], list):
                scenes = scenes[0]
        elif "frames" in data:
            # Video Ad Creator format
            return [
                {
                    "id": f"frame_{i + 1}",
                    "title": f"Frame {i + 1} — {f.get('scene_type', 'scene')}",
                    "script": f.get("script") or f.get("voiceover") or "",
                    "image_prompt": f.get("prompt") or f.get("image_prompt") or "",
                }
                for i, f in enumerate(data["frames"])
            ]
        else:
            return [_normalize_scene(data, 0)]
    else:
        return []

    return [_normalize_scene(s, i) for i, s in enumerate(scenes) if isinstance(s, dict)]


# ══════════════════════════════════════════════════════════════
#  Generic Tool Prompt Execution
# ══════════════════════════════════════════════════════════════

class ToolPromptRequest(BaseModel):
    brandId: str
    toolId: str
    extraVariables: Optional[Dict[str, str]] = None
    userMessage: str = ""


@app.post("/api/tools/generate-prompt")
async def generate_tool_prompt(req: ToolPromptRequest):
    """
    Build a prompt using PromptBuilder for any tool, send it to Gemini,
    and return the parsed JSON result.
    """
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, req.brandId)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    # Build prompt using 3-layer system
    built_prompt = prompt_builder.build_prompt(
        req.toolId, brand, req.extraVariables
    )
    if not built_prompt:
        raise HTTPException(
            status_code=404,
            detail=f"No prompt template found for tool '{req.toolId}'"
        )

    user_msg = req.userMessage or "Generate now."

    try:
        content = await copy_gen._call_gemini(built_prompt, user_msg)

        # Clean markdown wrappers
        content = content.strip()
        if content.startswith("```json"):
            content = content.replace("```json", "").replace("```", "").strip()
        elif content.startswith("```"):
            content = content.replace("```", "").strip()

        # Try to find JSON array if not starting with [
        if not content.startswith("[") and not content.startswith("{"):
            start = content.find("[")
            end = content.rfind("]")
            if start != -1 and end > start:
                content = content[start:end + 1]

        result = json.loads(content)

        # Only normalize for UGC-like tools (not video_ad_creator which has its own parser)
        # Only normalize for UGC script responses — skip tools that have their own parsers
        ugc_normalize_tools = {"ugc_creator"}
        if req.toolId in ugc_normalize_tools and isinstance(result, list) and len(result) > 0 and isinstance(result[0], (dict, list)):
            sample = result[0] if isinstance(result[0], dict) else (result[0][0] if isinstance(result[0], list) and result[0] else {})
            script_keys = {"script", "speech", "audio", "voiceover", "dialogue", "action", "visuals", "setting", "image_prompt"}
            if isinstance(sample, dict) and script_keys & set(sample.keys()):
                result = {"scenes": [_normalize_script_response(result)]}

        return {"result": result, "model": "gemini-2.5-flash"}
    except json.JSONDecodeError as jde:
        # Try to fix truncated JSON arrays
        print(f"[generate-prompt] JSON decode failed: {jde}. Content ends: ...{content[-100:] if content else 'empty'}")
        # Attempt: if it looks like a truncated array, close it
        trimmed = content.rstrip()
        if trimmed.startswith("[") and not trimmed.endswith("]"):
            # Find last complete object
            last_brace = trimmed.rfind("}")
            if last_brace > 0:
                try:
                    fixed = trimmed[:last_brace + 1] + "]"
                    result = json.loads(fixed)
                    print(f"[generate-prompt] Fixed truncated JSON: {len(result)} items")
                    return {"result": result, "model": "gemini-2.5-flash"}
                except json.JSONDecodeError:
                    pass
        return {"result": content, "raw": True, "model": "gemini-2.5-flash"}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


# ══════════════════════════════════════════════════════════════
#  Prompt Templates & Overrides
# ══════════════════════════════════════════════════════════════

@app.get("/api/prompts/templates")
def list_prompt_templates():
    """List all tools that have default prompt templates."""
    return {"templates": prompt_builder.list_tool_templates()}


@app.get("/api/prompts/templates/{tool_id}")
def get_prompt_template(tool_id: str):
    """Get the default prompt template for a tool."""
    from pathlib import Path as P
    path = P(__file__).parent / "tools" / tool_id / "default_prompt.txt"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"No template for tool '{tool_id}'")
    return {"tool_id": tool_id, "template": path.read_text(encoding="utf-8")}


@app.get("/api/brands/{brand_id}/prompts")
def get_brand_prompt_overrides(brand_id: str):
    """Get all prompt overrides for a brand."""
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    return {"overrides": prompt_builder.get_brand_overrides(brand)}


@app.put("/api/brands/{brand_id}/prompts/{tool_id}")
def set_brand_prompt_override(brand_id: str, tool_id: str, req: dict):
    """Set a prompt override for a specific tool on a brand."""
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    template = req.get("template", "").strip()
    if not template:
        raise HTTPException(status_code=400, detail="template is required")

    if "promptOverrides" not in brand:
        brand["promptOverrides"] = {}
    brand["promptOverrides"][tool_id] = template
    brands.save_brands(all_brands)
    return {"ok": True, "tool_id": tool_id}


@app.delete("/api/brands/{brand_id}/prompts/{tool_id}")
def delete_brand_prompt_override(brand_id: str, tool_id: str):
    """Remove a prompt override, reverting to default template."""
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    overrides = brand.get("promptOverrides", {})
    if tool_id in overrides:
        del overrides[tool_id]
        brand["promptOverrides"] = overrides
        brands.save_brands(all_brands)
    return {"ok": True}


@app.get("/api/action-presets")
def get_action_presets():
    """Return the global action presets library (all categories)."""
    presets_path = Path(__file__).parent / "data" / "action_presets.json"
    if not presets_path.exists():
        return {"categories": []}
    with open(presets_path) as f:
        return json.load(f)


@app.get("/api/brands/{brand_id}/actions")
def get_brand_actions(brand_id: str):
    """Return merged action list: global presets + brand-specific extraActions."""
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    presets_path = Path(__file__).parent / "data" / "action_presets.json"
    presets = json.load(open(presets_path)) if presets_path.exists() else {"categories": []}

    extra = brand.get("extraActions", [])
    if extra:
        presets["categories"].insert(0, {
            "id": "brand",
            "label": f"{brand.get('name', 'Brand')} — Acciones probadas",
            "actions": extra,
        })

    return presets


@app.put("/api/brands/{brand_id}/actions")
def save_brand_actions(brand_id: str, req: dict):
    """Save brand-specific extra actions."""
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    brand["extraActions"] = req.get("actions", [])
    brands.save_brands(all_brands)
    return {"ok": True}


@app.post("/api/brands/{brand_id}/prompts/{tool_id}/preview")
def preview_prompt(brand_id: str, tool_id: str, req: Optional[dict] = None):
    """Preview how a prompt will look after variable substitution."""
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    extra = req.get("extra_variables", {}) if req else {}
    result = prompt_builder.build_prompt(tool_id, brand, extra)
    if result is None:
        raise HTTPException(status_code=404, detail=f"No template for tool '{tool_id}'")
    return {"prompt": result, "tool_id": tool_id}


# ══════════════════════════════════════════════════════════════
#  Chat (Gemini)
# ══════════════════════════════════════════════════════════════

@app.post("/api/brands/{brand_id}/avatar-brief")
async def generate_avatar_brief(brand_id: str, req: dict = None):
    """Generate an avatar character brief using Gemini based on brand context."""
    if not copy_gen.is_configured():
        raise HTTPException(500, "GEMINI_API_KEY not configured")

    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(404, "Brand not found")

    direction = (req or {}).get("direction", "")
    extra_vars = {}
    if direction:
        extra_vars["user_direction"] = direction

    built_prompt = prompt_builder.build_prompt("avatar_creator", brand, extra_vars)

    user_msg = "Generate the avatar character brief now. Respond with ONLY a valid JSON object, nothing else."
    try:
        result_text = await copy_gen._call_gemini(built_prompt, user_msg)
    except Exception as e:
        raise HTTPException(502, f"Gemini error: {e}")

    # Clean response and extract JSON
    result_text = result_text.strip()
    if result_text.startswith("```json"):
        result_text = result_text.replace("```json", "").replace("```", "").strip()
    elif result_text.startswith("```"):
        result_text = result_text.replace("```", "").strip()

    if not result_text.startswith("{"):
        start = result_text.find("{")
        end = result_text.rfind("}")
        if start != -1 and end != -1:
            result_text = result_text[start:end + 1]

    try:
        return json.loads(result_text)
    except json.JSONDecodeError:
        raise HTTPException(500, f"Failed to parse avatar brief JSON: {result_text[:300]}")


@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    if not chat_service.is_configured():
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, req.brandId)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    try:
        messages = [{"role": m.role, "content": m.content} for m in req.messages]
        reply = await chat_service.chat(brand, messages)
        return {"reply": reply}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


class AgentResolveRequest(BaseModel):
    brandId: str
    brief: str
    # Multi-turn refinement — when provided, the agent applies the brief as a
    # delta to this prior config instead of resolving from scratch.
    previousConfig: Optional[dict] = None
    previousTool: Optional[str] = None


@app.post("/api/agent/resolve")
async def agent_resolve(req: AgentResolveRequest):
    """Resolve a natural-language brief into a tool + pre-filled ToolConfig.

    Multi-turn: when previousConfig + previousTool are provided, the brief is
    interpreted as a delta to apply, preserving unchanged fields.
    """
    if not agent_service.is_configured():
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, req.brandId)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    if not req.brief or not req.brief.strip():
        raise HTTPException(status_code=400, detail="Brief is empty")

    try:
        result = await agent_service.resolve_brief(
            brand,
            req.brief,
            previous_config=req.previousConfig,
            previous_tool=req.previousTool,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Agent error: {str(e)[:300]}")


# ══════════════════════════════════════════════════════════════
#  Manual Lab — tool suggestion (non-blocking)
# ══════════════════════════════════════════════════════════════

class ManualLabSuggestRequest(BaseModel):
    prompt: str
    mode: str = "image"  # "image" | "video"
    hasRefs: bool = False


@app.post("/api/manual/suggest-tool")
async def manual_lab_suggest(req: ManualLabSuggestRequest):
    """Given a free-form Manual Lab prompt, optionally suggest a structured pipeline."""
    if not manual_lab.is_configured():
        return {"tool_id": None, "reason": ""}
    try:
        return await manual_lab.suggest_tool(req.prompt, req.mode, req.hasRefs)
    except Exception:
        return {"tool_id": None, "reason": ""}


class ManualLabRefInput(BaseModel):
    tag: str
    label: str = ""
    url: str


class ManualLabEnhanceRequest(BaseModel):
    prompt: str
    refs: List[ManualLabRefInput] = []
    mode: str = "image"
    targetModel: str = "nano-banana-2"


@app.post("/api/manual/enhance-prompt")
async def manual_lab_enhance(req: ManualLabEnhanceRequest):
    """Take a casual user request + refs and rewrite as a polished prompt via Gemini Vision."""
    if not manual_lab.is_configured():
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")
    try:
        result = await manual_lab.enhance_prompt(
            user_input=req.prompt,
            refs=[r.model_dump() for r in req.refs],
            mode=req.mode,
            target_model=req.targetModel,
        )
        return {"enhanced": result.get("enhanced", ""), "interpretation": result.get("interpretation", "")}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Enhance error: {str(e)[:300]}")


# ══════════════════════════════════════════════════════════════
#  Download proxy — bypass CORS for cross-origin downloads
# ══════════════════════════════════════════════════════════════
#
# Browsers ignore the `download` attribute on <a> for cross-origin URLs that
# don't send `Content-Disposition: attachment`, and a JS fetch() blocked by
# CORS can't get the bytes either. So we proxy: backend fetches the file and
# streams it back with the right headers, browser downloads cleanly.
#
# Whitelist enforced to prevent open-proxy abuse.

ALLOWED_DOWNLOAD_HOSTS = {
    "fal.media", "v2.fal.media", "v3.fal.media", "v4.fal.media",
    "fal.run", "queue.fal.run", "rest.alpha.fal.ai",
    "fal-cdn.com", "fal-cdn.net",
    "storage.googleapis.com",
    "localhost", "127.0.0.1",
}


@app.get("/api/download")
async def download_proxy(url: str, filename: Optional[str] = None):
    """Stream a remote file back to the browser as an attachment download."""
    from urllib.parse import urlparse

    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if host not in ALLOWED_DOWNLOAD_HOSTS and not any(host.endswith("." + h) for h in ALLOWED_DOWNLOAD_HOSTS):
        raise HTTPException(status_code=400, detail=f"Host not allowed: {host}")

    # Default filename from URL path
    if not filename:
        filename = (parsed.path.rsplit("/", 1)[-1] or "download")
        if "." not in filename:
            filename += ".bin"

    try:
        client = httpx.AsyncClient(timeout=60, follow_redirects=True)
        resp = await client.get(url)
        if resp.status_code != 200:
            await client.aclose()
            raise HTTPException(status_code=resp.status_code, detail=f"Upstream error: {resp.status_code}")

        content_type = resp.headers.get("content-type", "application/octet-stream")
        content_length = resp.headers.get("content-length")

        async def stream():
            try:
                # We already loaded the body above (resp.content). For simplicity
                # yield in chunks. Large files (>50MB) would benefit from a real
                # streaming approach with client.stream(...) but Manual Lab outputs
                # are typically small (<20MB).
                data = resp.content
                chunk_size = 64 * 1024
                for i in range(0, len(data), chunk_size):
                    yield data[i:i + chunk_size]
            finally:
                await client.aclose()

        # Sanitize filename for header — strip newlines, quotes
        safe_name = filename.replace("\n", "").replace("\r", "").replace('"', "")
        # RFC 5987: `filename*` carries the full UTF-8 name (accents, spaces) for modern
        # browsers; the plain ASCII `filename` is a fallback for old ones.
        from urllib.parse import quote
        ascii_fallback = safe_name.encode("ascii", "ignore").decode("ascii").strip() or "download"
        headers = {
            "Content-Disposition": (
                f'attachment; filename="{ascii_fallback}"; '
                f"filename*=UTF-8''{quote(safe_name)}"
            ),
        }
        if content_length:
            headers["Content-Length"] = content_length

        return StreamingResponse(stream(), media_type=content_type, headers=headers)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Download proxy failed: {str(e)[:200]}")
