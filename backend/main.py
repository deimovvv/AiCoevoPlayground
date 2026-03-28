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
    voice_id: str | None = None
    model_id: str = "eleven_multilingual_v2"
    output_format: str = "mp3_44100_128"


class LipSyncRequest(BaseModel):
    talking_photo_id: str
    audio_url: str | None = None
    title: str = "UGC Lip Sync"


class CreateBrandRequest(BaseModel):
    name: str
    brandContext: str = ""


class UpdateBrandRequest(BaseModel):
    name: str | None = None
    brandContext: str | None = None


class GenerateCopyRequest(BaseModel):
    productName: str = ""
    tone: str = "engaging"
    platform: str = "tiktok"
    language: str = "es"
    additionalNotes: str = ""
    count: int = 1


class AddHeygenAvatarRequest(BaseModel):
    talkingPhotoId: str
    name: str
    previewUrl: str


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
TOOLS_JOBS: dict[str, dict] = {}


def _load_registry() -> list[dict]:
    reg_path = TOOLS_DIR / "registry.json"
    if not reg_path.exists():
        return []
    with open(reg_path, "r", encoding="utf-8") as f:
        return json.load(f)


def _load_tool_config(tool_id: str) -> dict | None:
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
    config = _load_tool_config(tool_id)
    if not config:
        raise HTTPException(status_code=404, detail=f"Tool '{tool_id}' not found")
    reg_entry = next((t for t in _load_registry() if t["id"] == tool_id), {})
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
    brands.save_brands(all_brands)
    return brand


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

    try:
        scripts = await copy_gen.generate_scripts(
            brand_context=brand_context,
            product_name=req.productName,
            tone=req.tone,
            platform=req.platform,
            language=req.language,
            video_objective=req.additionalNotes,
        )
        return {"scripts": scripts, "model": "gemini-2.0-flash"}
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

    avatar = {
        "id": avatar_id, "name": name, "filename": filename,
        "imageUrl": f"/static/avatars/{filename}",
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

    product = {
        "id": product_id,
        "name": name,
        "filename": filename,
        "imageUrl": f"/static/products/{filename}",
    }

    if "products" not in brand:
        brand["products"] = []
    brand["products"].append(product)
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
        )
        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=speech.mp3"},
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"TTS error: {str(e)}")


@app.post("/api/tts/generate-file")
async def tts_generate_file(req: TTSRequest):
    """Generate TTS audio and save to temp file."""
    try:
        audio_bytes = tts.generate_audio(
            text=req.text,
            voice_id=req.voice_id,
            model_id=req.model_id,
            output_format=req.output_format,
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
#  Kling V2.6 Image-to-Video Routes (via Fal)
# ══════════════════════════════════════════════════════════════

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
    image_files: list[UploadFile] = File(None),
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
                        # Try to resolve local avatar path
                        if "/static/avatars/" in url:
                            filename = url.split("/static/avatars/")[-1]
                            local_path = brands.get_avatars_dir() / filename
                            if local_path.exists():
                                with open(local_path, "rb") as f:
                                    img_bytes = f.read()
                                ext = local_path.suffix.lower()
                                ct_map = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}
                                fal_url = await kling_video.upload_image(img_bytes, local_path.name, ct_map.get(ext, "image/jpeg"))
                                resolved_urls.append(fal_url)
                            else:
                                print(f"[image-gen] Local file not found: {local_path}")
                        else:
                            print(f"[image-gen] Skipping unresolvable local URL: {url}")
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

        if not resolved_urls:
            raise HTTPException(status_code=400, detail="At least one image is required")

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
