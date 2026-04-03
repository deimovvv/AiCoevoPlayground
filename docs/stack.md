# Coevo Studio — Tech Stack

---

## Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2 | UI framework |
| Vite | 8.0 Beta | Build tool & dev server |
| TypeScript | 5.9 | Type safety |
| Tailwind CSS | 4.2 | Utility-first styling |
| React Router | 7.13 | Client-side routing |
| Lucide React | 0.576 | Icon library |
| Remotion | 4.0 | Video player (future: render) |
| clsx + tailwind-merge | — | Conditional class composition |
| Inter (Google) | — | Primary font |

### Component Architecture

- Custom design token system via `@theme` in `index.css`
- Tailwind `@utility` directives for token-based classes
- Reusable UI components: `Button`, `Input`, `Label`, `Card`, `Textarea`
- Page components organized by workflow:
  - `Dashboard` — Brand list management
  - `Workspace` — Main workspace with AI chat
  - `BrandSettings` — Brand configuration (context, assets, voices, prompts)
  - `GeneratePage` — Tool registry and launcher
  - `ToolRunPage` — Step-by-step pipeline execution
  - `ContentPage` — Content library
- Layout: `AppLayout` + `Sidebar` + `BrandSwitcher`
- State: `BrandProvider` context for global brand state (persists to localStorage)

---

## Backend

| Technology | Purpose |
|------------|---------|
| FastAPI | REST API framework |
| Uvicorn | ASGI server |
| Python 3.11+ | Runtime |
| httpx | Async HTTP client (external APIs) |
| asyncio | Async subprocess execution (FFmpeg) |
| python-multipart | File upload support |
| python-dotenv | Environment variable management |
| beautifulsoup4 | URL scraping for brand guidance |
| PyPDF2 | PDF text extraction for brand guidance |

### Services Architecture

| Service | File | Dependencies |
|---------|------|-------------|
| Brand Persistence | `brands.py` | JSON file storage |
| Chat | `chat.py` | Gemini 2.5 Flash |
| Script Generation | `copy_gen.py` | Gemini 2.5 Flash |
| Prompt Assembly | `prompt_builder.py` | Template system |
| Text-to-Speech | `tts.py` | ElevenLabs API |
| Image Generation | `image_gen.py` | Fal AI (Nano Banana 2/edit) |
| Video Generation | `kling_video.py` | Fal AI (Kling V2.6) |
| Lip-Sync (legacy) | `fal_lipsync.py` | Fal AI (Fabric 1.0) |
| Lip-Sync (current) | `heygen_avatar4.py` | Fal AI (HeyGen Avatar 4) |
| Talking Photos (legacy) | `heygen.py` | HeyGen API direct |
| Video Concat + Subtitles | `video_concat.py` | FFmpeg (local) |

### Data Persistence (Phase 1 — Current)

- **JSON file-based** — No database
- `backend/data/brands.json` — All brands in flat array
- `backend/data/generations.json` — Generation history
- `backend/data/avatars/` — Avatar image files
- `backend/data/products/` — Product image files
- `backend/data/clothing/` — Clothing image files
- `backend/data/backgrounds/` — Background image files
- `backend/data/renders/` — Generated video outputs

### Future Infrastructure

| Phase | What | Why |
|-------|------|-----|
| Phase 2 | PostgreSQL (Docker) | Structured data, search, pagination |
| Phase 2 | Storage abstraction (Local → R2) | Deploy-ready, scalable media storage |
| Phase 3 | Alembic migrations | Schema versioning |
| Phase 3 | Redis job queues | Background processing |

---

## AI Services

| Service | Model/API | Purpose | Cost |
|---------|-----------|---------|------|
| Google Gemini | 2.5 Flash | Scripts, chat, prompt assembly | Free tier / pay per token |
| Nano Banana 2 | via Fal AI | Image generation & editing | ~$0.01/image |
| HeyGen Avatar 4 | via Fal AI | Talking head lip-sync video | ~$0.10/second |
| ElevenLabs | Multilingual V2 | Text-to-speech, voice cloning | Free tier: 10k chars/month |
| Kling | V2.6 Pro via Fal | Image-to-video animation | ~$0.05/video |
| FFmpeg | Local binary | Video concat + subtitle burn | Free |

### Nano Banana 2 Prompting

- Receives reference images + text prompt
- References by image number: "the person in image 1", "the clothing in image 2"
- OR by descriptive name: "Elias wearing the black hoodie"
- Images passed in order: avatar → clothing → product → background
- Keep prompts to 2-3 sentences for best results

### HeyGen Avatar 4 Flow

```
ElevenLabs (voice ID) → audio MP3
    ↓
Backend uploads to Fal Storage (FAL_KEY)
    ↓
HeyGen Avatar 4 (image_url + audio_url) → animated video
```

### Async Job Pattern (all Fal services)

```
POST submit job → returns request_id
GET poll status → IN_QUEUE | IN_PROGRESS | COMPLETED
GET fetch result → final URL

Note: Submit endpoint and status/result endpoint may use different base paths.
Example: submit to fal-ai/nano-banana-2/edit, poll from fal-ai/nano-banana-2
```

---

## Tools System

### Registered Tools

| ID | Name | Category | Status | Pipeline Steps |
|----|------|----------|--------|---------------|
| `ugc_creator` | UGC Creator | video | active | script, base_image, multishot, curation, voice, lipsync, subtitles, render |
| `product_spotlight` | Product Spotlight | images | active | prompt, generate, variations |
| `fashion_editorial` | Fashion Editorial | images | active | prompt, generate, variations |
| `fashion_reels` | Fashion Reels | video | active | script, base_image, multishot, curation, animate |
| `photo_multishot` | Product Photos | images | active | prompt, generate |
| `ad_creative` | Ad Creative | images | active | prompt, generate |
| `social_post` | Social Post | copy | active | caption, image |
| `reel_creator` | Reel Creator | video | coming_soon | script, scenes, music, subtitles, render |
| `bg_remover` | Background Remover | images | coming_soon | remove |

### Tool Execution Model

- Tools registered in `backend/tools/registry.json`
- Each tool has `default_prompt.txt` (template with `{variables}` and `{?conditional}` blocks)
- Brand-level prompt overrides in `brand.promptOverrides[tool_id]`
- Dynamic variables injected from brand assets via `PromptBuilder`
- Tool-specific config schemas in frontend define which form fields to show

---

## Environment Variables

All API keys in `backend/.env`:

| Variable | Service | Required |
|----------|---------|----------|
| `GEMINI_API_KEY` | Google Gemini 2.5 Flash | Yes |
| `ELEVENLABS_API_KEY` | ElevenLabs TTS | Yes |
| `FAL_KEY` | Fal AI (Nano Banana, HeyGen Avatar 4, Kling) | Yes |
| `HEYGEN_API_KEY` | HeyGen direct API (legacy) | Optional |

---

## Running Locally

See [setup.md](setup.md) for full instructions.

```bash
# Terminal 1: Backend
cd backend && source .venv/bin/activate && python -m uvicorn main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend && npm run dev
```
