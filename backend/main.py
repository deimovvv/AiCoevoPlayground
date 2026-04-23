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
from services import fal_lipsync
from services import kling_video
from services import image_gen
from services import video_concat
from services import chat as chat_service
from services import prompt_builder
from services import heygen_avatar4
from services import fal_synclipsync
from services import image_analysis
from services import video_download
from services import apify_tiktok

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


class DesignSystem(BaseModel):
    photoStyle: Optional[str] = None             # Overall visual/photography style
    composition: Optional[str] = None            # Framing, layout, product placement
    colorTreatment: Optional[str] = None         # Saturation, filters, color grading
    lighting: Optional[str] = None               # Lighting direction
    visualDos: Optional[list[str]] = None        # What to ALWAYS show
    visualDonts: Optional[list[str]] = None      # What to NEVER show
    references: Optional[str] = None             # Reference brands/moodboard description

class UpdateBrandRequest(BaseModel):
    name: Optional[str] = None
    brandContext: Optional[str] = None
    fonts: Optional[BrandFonts] = None
    dna: Optional[BrandDNA] = None
    designSystem: Optional[DesignSystem] = None


class GenerateCopyRequest(BaseModel):
    productName: str = ""
    tone: str = "engaging"
    platform: str = "tiktok"
    language: str = "es"
    additionalNotes: str = ""
    count: int = 1
    narrativeMode: bool = False


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
    brandId: str
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
    # Remove scripts, styles, nav, footer
    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()
    text = soup.get_text(separator="\n", strip=True)
    # Limit to ~8000 chars
    text = text[:8000].strip()

    if not text:
        raise HTTPException(status_code=422, detail="No text content found at URL")

    current = brand.get("brandContext", "")
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

    # Limit to ~15000 chars
    text = text[:15000].strip()

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

    context = brand.get("brandContext", "").strip()
    if not context:
        raise HTTPException(status_code=400, detail="Brand has no context yet. Add guidance from URL or PDF first.")

    # Include product/avatar info if available
    extras = []
    for p in brand.get("products", []):
        if p.get("name"):
            extras.append(f"Product: {p['name']} — {p.get('description', '')}")
    for a in brand.get("avatars", []):
        if a.get("name"):
            extras.append(f"Avatar/Model: {a['name']} — {a.get('description', '')}")
    extra_context = "\n".join(extras) if extras else ""

    system_prompt = """You are a brand strategist. Analyze the brand information below and extract a structured Brand DNA.

BRAND CONTEXT:
""" + context[:10000] + """

""" + (f"ASSETS:\n{extra_context}\n\n" if extra_context else "") + """Respond with ONLY a JSON object:
{
  "colors": [
    {"name": "Primary", "hex": "#hex_code", "usage": "backgrounds, headers"},
    {"name": "Secondary", "hex": "#hex_code", "usage": "accents, CTAs"},
    {"name": "Neutral", "hex": "#hex_code", "usage": "text, borders"}
  ],
  "tone": ["adjective1", "adjective2", "adjective3"],
  "audience": "Target audience description — demographics, psychographics, 2-3 sentences",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "personality": "2-3 sentences describing the brand's personality as if it were a person",
  "competitors": ["competitor1", "competitor2", "competitor3"],
  "unique_value": "1-2 sentences — what makes this brand different from competitors",
  "suggested_fonts": {
    "headline": "Google Font name for headlines",
    "body": "Google Font name for body text"
  }
}

Rules:
- Extract colors from any hex codes, color names, or brand guidelines mentioned
- If no colors are explicitly mentioned, INFER them from the brand's industry and tone
- Tone should be 3-5 adjectives describing how the brand communicates
- Be specific about the audience — not generic
- If competitors aren't mentioned, infer likely competitors from the industry"""

    try:
        content = await copy_gen._call_gemini(system_prompt, "Generate the Brand DNA now.")
        content = content.strip()
        if content.startswith("```json"):
            content = content.replace("```json", "").replace("```", "").strip()
        elif content.startswith("```"):
            content = content.replace("```", "").strip()

        dna = json.loads(content)

        # Save to brand
        brand["dna"] = dna
        # Also save suggested fonts if present
        if dna.get("suggested_fonts"):
            brand["fonts"] = dna.pop("suggested_fonts")
        brands.save_brands(all_brands)

        return {"dna": dna, "fonts": brand.get("fonts"), "brand": brand}
    except json.JSONDecodeError:
        return {"dna": None, "raw": content, "error": "Failed to parse DNA — raw response returned"}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gemini error: {str(e)[:200]}")


@app.post("/api/brands/{brand_id}/extract-design-system")
async def extract_design_system(brand_id: str):
    """Analyze brand context with Gemini and extract structured Design System for image/video tools."""
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    context = brand.get("brandContext", "").strip()
    if not context:
        raise HTTPException(status_code=400, detail="La marca no tiene contexto todavía. Agregá guidance desde URL o PDF primero.")

    system_prompt = """Sos un director creativo experto en identidad visual de marca. Analizá el documento de marca y extraé el sistema de diseño visual — solo la parte que sirve para guiar la generación de imágenes y videos.

BRAND CONTEXT:
""" + context[:12000] + """

Respondé con SOLO un objeto JSON en español:
{
  "photoStyle": "2-4 oraciones describiendo el estilo visual general (lifestyle, editorial, documental, etc.) — qué tipo de imágenes representan la marca",
  "composition": "1-3 oraciones sobre reglas de composición, framing, cómo se muestra el producto, integración en escena",
  "colorTreatment": "1-2 oraciones sobre tratamiento de color: saturación, filtros, color grading, contraste",
  "lighting": "1-2 oraciones sobre dirección de iluminación: natural, estudio, cálida, dramática, etc.",
  "visualDos": ["cosa1 que SIEMPRE se muestra", "cosa2", "cosa3"],
  "visualDonts": ["cosa1 que NUNCA se muestra", "cosa2", "cosa3"],
  "references": "1-2 oraciones mencionando marcas o referencias visuales admiradas, si se mencionan en el brief"
}

Reglas:
- Extraé SOLO lo visual/fotográfico. No voz, no messaging, no audiencia.
- Si el documento no menciona algo explícitamente, inferilo del posicionamiento e industria.
- visualDos y visualDonts: 3-5 items cada uno, concretos y accionables para un generador de imágenes.
- Mantené cada campo conciso — van a inyectarse en prompts."""

    try:
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
    except json.JSONDecodeError:
        return {"designSystem": None, "raw": content, "error": "Failed to parse design system — raw response returned"}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gemini error: {str(e)[:200]}")


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
        return {"objective": objective, "model": "gemini-2.0-flash"}
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
    }

    if "products" not in brand:
        brand["products"] = []
    brand["products"].append(product)
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


@app.patch("/api/brands/{brand_id}/products/{product_id}")
def update_product(brand_id: str, product_id: str, req: dict):
    all_brands = brands.load_brands()
    brand = brands.find_brand(all_brands, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    product = next((p for p in brand.get("products", []) if p["id"] == product_id), None)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if "name" in req:
        product["name"] = req["name"]
    if "description" in req:
        product["description"] = req["description"]
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

    item = {
        "id": item_id,
        "name": name,
        "description": description,
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

        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.post(
                f"https://queue.fal.run/fal-ai/kling-video/v3/pro/image-to-video",
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
):
    """
    Generate/edit an image using nano-banana-2/edit.
    Accepts image URLs (JSON array) and/or uploaded files.
    Local URLs are auto-uploaded to Fal storage.
    Returns request_id for status polling.
    """
    if not image_gen.is_configured():
        raise HTTPException(status_code=500, detail="FAL_KEY not configured")

    import json

    try:
        # Parse image URLs
        resolved_urls = []
        try:
            url_list = json.loads(image_urls)
            if isinstance(url_list, list):
                for url in url_list:
                    if not url:
                        continue
                    # Check if local URL needs uploading
                    is_local = (
                        url.startswith("/static/")
                        or "localhost" in url
                        or "127.0.0.1" in url
                    )
                    if is_local:
                        # Resolve any /static/ path to local file
                        local_path = None
                        static_dirs = {
                            "/static/avatars/": brands.get_avatars_dir(),
                            "/static/products/": brands.get_products_dir(),
                            "/static/clothing/": brands.get_clothing_dir(),
                            "/static/backgrounds/": brands.get_backgrounds_dir(),
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

        print(f"[image-gen] Resolved {len(resolved_urls)} image URLs")
        print(f"[image-gen] Prompt: {prompt[:100]}")

        request_id = await image_gen.create_edit(
            image_urls=resolved_urls,
            prompt=prompt,
            aspect_ratio=aspect_ratio,
            resolution=resolution,
        )

        # Handle sync result
        if request_id.startswith("SYNC:"):
            return {
                "request_id": request_id,
                "status": "completed",
                "image_url": request_id[5:],
            }

        return {"request_id": request_id, "status": "pending"}

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
):
    """Text-to-image using nano-banana-2 (no reference images needed)."""
    if not image_gen.is_configured():
        raise HTTPException(status_code=500, detail="FAL_KEY not configured")
    try:
        print(f"[t2i] prompt={prompt[:80]}, aspect={aspect_ratio}, res={resolution}")
        request_id = await image_gen.create_text_to_image(
            prompt=prompt,
            aspect_ratio=aspect_ratio,
            resolution=resolution,
        )
        if request_id.startswith("SYNC:"):
            return {"request_id": request_id, "status": "completed", "image_url": request_id[5:]}
        return {"request_id": request_id, "status": "pending"}
    except Exception as e:
        print(f"[t2i] ERROR: {e}")
        raise HTTPException(status_code=502, detail=f"Text-to-image failed: {str(e)}")


@app.get("/api/image-gen/status/{request_id}")
async def image_gen_status(request_id: str):
    if not image_gen.is_configured():
        raise HTTPException(status_code=500, detail="FAL_KEY not configured")
    try:
        return await image_gen.get_status(request_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/api/image-gen/result/{request_id}")
async def image_gen_result(request_id: str):
    if not image_gen.is_configured():
        raise HTTPException(status_code=500, detail="FAL_KEY not configured")
    try:
        return await image_gen.get_result(request_id)
    except Exception as e:
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
    """List all generations, optionally filtered by brand."""
    gens = _load_generations()
    if brandId:
        gens = [g for g in gens if g.get("brandId") == brandId]
    # Sort by createdAt descending
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
