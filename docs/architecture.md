# Coevo Creative OS — Architecture

**Coevo Creative OS** is an internal agency platform for managing multi-brand advertising and marketing content creation.

The system provides context-aware AI tools that adapt dynamically to each brand's assets, prompts, briefs, and brand guidelines.

---

## System Overview

```
Frontend (React 19 + Vite 8)
    | HTTP/REST
Backend (FastAPI + Python 3.11+)
    |-- Brand Context Management
    |   |-- Brand Guidance Documents (text, URL scraping, PDF upload)
    |   |-- Dynamic Prompt Library (3-layer system)
    |   +-- PromptBuilder Service (template + variables)
    |-- Asset Library (per brand)
    |   |-- Avatars/Characters (with descriptions + HeyGen sync)
    |   |-- Products
    |   |-- Clothing/Wardrobe
    |   +-- Backgrounds/Scenes (planned)
    |-- Tools System (context-aware, registry-based)
    |   |-- UGC Creator (8-phase video pipeline)
    |   |-- Ad Creative
    |   |-- Social Post
    |   |-- Product Photos (Multishot)
    |   |-- Reel Creator (coming soon)
    |   +-- Background Remover (coming soon)
    |-- AI Chat Assistant
    |   +-- Multi-turn Gemini chat with brand context
    +-- AI Services
        |-- Gemini 2.5 Flash (scripts, chat, curation)
        |-- Nano Banana 2 via Fal (image generation/editing)
        |-- Kling V2.6 via Fal (image-to-video)
        |-- ElevenLabs (TTS / voice cloning)
        |-- Fal Fabric 1.0 (lip-sync from static images)
        |-- HeyGen (legacy talking photo lip-sync)
        +-- FFmpeg (video concatenation)
```

---

## Core Concept: Context-Aware Architecture

**Every tool automatically inherits the selected brand's context.** When working within a brand, all tools have access to:
- Brand guidance documents
- Asset library (avatars, products, clothing)
- Brand-specific prompt templates (or defaults)
- Voice presets (ElevenLabs)

This eliminates manual re-configuration and ensures brand consistency across all generated content.

### Three-Layer Prompt System

The `PromptBuilder` service resolves prompts via:

1. **Layer 1 — Tool Default Template**: `backend/tools/{tool_id}/default_prompt.txt`
2. **Layer 2 — Brand Override**: stored per brand (optional)
3. **Layer 3 — Dynamic Variables**: injected from brand assets/config

Template variables include: `{brand_name}`, `{brand_guidance}`, `{avatars}`, `{products}`, `{clothing}`, `{voices}`, and custom per-tool variables. Conditional blocks via `{?var}...{/var}` syntax.

---

## Frontend Architecture

### Pages & Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | `Home` | Landing page |
| `/dashboard` | `Workspace` | Main workspace with ChatPanel |
| `/dashboard/brands` | `Dashboard` | Brand list + CRUD |
| `/dashboard/brands/:brandId` | `BrandWorkspace` | Brand detail (avatars, scripts, generation board) |
| `/dashboard/brand` | `BrandSettings` | Brand configuration (context, assets, voices, prompts) |
| `/dashboard/generate` | `GeneratePage` | Tool registry with category filters |
| `/dashboard/generate/:toolId` | `ToolRunPage` | Tool execution with step-by-step pipeline |
| `/dashboard/content` | `ContentPage` | Content library (generated assets) |
| `/dashboard/integrations` | `IntegrationsPage` | Platform connections (Meta, TikTok, etc.) |
| `/dashboard/automations` | `AutomationsPage` | Workflow automation builder |
| `/dashboard/performance/organic` | `PerformancePage` | Social metrics dashboard |
| `/dashboard/performance/ads` | `PerformancePage` | Ads campaign ROI |
| `/dashboard/pipeline` | `PipelineConfigPage` | Admin pipeline configuration |
| `/dashboard/tools/images` | `ToolsPage` | Image tools browser |
| `/dashboard/tools/video` | `ToolsPage` | Video tools browser |

### Layout

- `AppLayout` wraps all `/dashboard/*` routes with sidebar + content area
- `Sidebar` shows navigation sections: Chat/Generate/Content, Brand/Settings/Integrations, Performance
- `BrandSwitcher` dropdown in sidebar for switching between brands
- `BrandProvider` context provides global brand state with `refreshBrands()`

### Key Libraries

- React 19 + React Router 7
- Tailwind CSS v4
- Lucide React (icons)
- Remotion (video player components)
- Custom design token system (`index.css`)

---

## Backend Architecture

### Services Layer (`backend/services/`)

| Service | File | Purpose |
|---------|------|---------|
| Brands | `brands.py` | Brand CRUD, avatar/product/clothing persistence (JSON-based) |
| Chat | `chat.py` | Multi-turn Gemini chat with brand context |
| Script Gen | `copy_gen.py` | UGC script generation + video objective suggestions |
| PromptBuilder | `prompt_builder.py` | 3-layer prompt assembly with template variables |
| TTS | `tts.py` | ElevenLabs text-to-speech |
| Image Gen | `image_gen.py` | Nano Banana 2 image generation/editing via Fal |
| Kling Video | `kling_video.py` | Kling V2.6 image-to-video via Fal |
| Fal Lip-sync | `fal_lipsync.py` | Fal Fabric 1.0 lip-sync (video + audio) |
| HeyGen | `heygen.py` | Legacy HeyGen talking photo integration |
| Video Concat | `video_concat.py` | FFmpeg video concatenation |

### API Endpoints (51 total)

#### Brand Management
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/brands` | List all brands |
| POST | `/api/brands` | Create brand |
| GET | `/api/brands/{id}` | Get brand details |
| PATCH | `/api/brands/{id}` | Update brand (name, context, voices) |
| DELETE | `/api/brands/{id}` | Delete brand |
| POST | `/api/brands/{id}/guidance/url` | Scrape URL for brand guidance |
| POST | `/api/brands/{id}/guidance/pdf` | Upload PDF for brand guidance |

#### Asset Management
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/brands/{id}/avatars` | List avatars |
| POST | `/api/brands/{id}/avatars` | Upload avatar image |
| POST | `/api/brands/{id}/avatars/heygen` | Add HeyGen talking photo |
| DELETE | `/api/brands/{id}/avatars/{avatar_id}` | Delete avatar |
| POST | `/api/brands/{id}/avatars/{avatar_id}/retry-heygen` | Retry HeyGen upload |
| GET/POST/DELETE | `/api/brands/{id}/products/...` | Product CRUD |
| GET/POST/DELETE | `/api/brands/{id}/clothing/...` | Clothing CRUD |

#### Tool System
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/tools` | List all tools from registry |
| GET | `/api/tools/{tool_id}` | Get tool details |
| POST | `/api/tools/{tool_id}/run` | Execute tool (returns job_id) |
| GET | `/api/tools/jobs/{job_id}` | Check job status |

#### Prompt Management
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/prompts/templates` | List all tool templates |
| GET | `/api/prompts/templates/{tool_id}` | Get template for tool |
| GET | `/api/brands/{id}/prompts` | Get brand overrides |
| PUT | `/api/brands/{id}/prompts/{tool_id}` | Set prompt override |
| DELETE | `/api/brands/{id}/prompts/{tool_id}` | Remove override |
| POST | `/api/brands/{id}/prompts/{tool_id}/preview` | Preview interpolated prompt |

#### AI Services
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/chat` | Gemini chat with brand context |
| POST | `/api/tts` | Generate speech (streaming audio) |
| POST | `/api/tts/generate-file` | Generate TTS to temp file |
| POST | `/api/image-gen/edit` | Nano Banana 2 image generation |
| GET | `/api/image-gen/status/{id}` | Check image gen status |
| GET | `/api/image-gen/result/{id}` | Get image result |
| POST | `/api/kling/image-to-video` | Kling video generation |
| GET | `/api/kling/status/{id}` | Check Kling status |
| GET | `/api/kling/result/{id}` | Get Kling result |
| POST | `/api/fal/lipsync` | Fal lip-sync job |
| GET | `/api/fal/lipsync/{id}/status` | Check Fal status |
| GET | `/api/fal/lipsync/{id}/result` | Get Fal result |
| POST | `/api/video/concat` | FFmpeg video concatenation |
| GET | `/api/video/concat/check` | Check FFmpeg availability |

#### Copy Generation
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/brands/{id}/generate-copy` | Generate UGC scripts |
| POST | `/api/brands/{id}/suggest-objective` | Auto-generate video objective |

#### HeyGen (Legacy)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/heygen/talking-photos` | List talking photos |
| POST | `/api/heygen/upload-talking-photo` | Upload talking photo |
| POST | `/api/heygen/generate-video` | Generate HeyGen video |
| GET | `/api/heygen/video-status/{id}` | Check video status |
| POST | `/api/lipsync` | Create lip-sync via HeyGen |

---

## Data Persistence

### Current (Phase 1) — JSON File Storage

```
backend/data/
  brands.json              <- All brands data (flat JSON array)
  avatars/                 <- Avatar image files
  products/                <- Product image files
  clothing/                <- Clothing image files
  renders/                 <- Generated render outputs
```

### Brand Data Structure

```json
{
  "id": "taller-santa-clara",
  "name": "Taller Santa Clara",
  "brandContext": "Marca de ropa artesanal argentina...",
  "avatars": [
    {
      "id": "unique-id",
      "name": "Elias",
      "description": "Hombre de 32 anos...",
      "filename": "stored-filename.jpeg",
      "imageUrl": "/static/avatars/filename.jpeg",
      "talkingPhotoId": "heygen-id or null",
      "heygenStatus": "skipped|pending|completed|failed"
    }
  ],
  "voicePresets": [
    { "id": "elevenlabs-voice-id", "name": "Voice Name" }
  ],
  "products": [
    {
      "id": "unique-id",
      "name": "Product Name",
      "description": "...",
      "filename": "stored-filename.jpeg",
      "imageUrl": "/static/products/filename.jpeg"
    }
  ],
  "clothing": []
}
```

---

## Tools System

### Registry (`backend/tools/registry.json`)

| Tool ID | Name | Category | Status | Pipeline |
|---------|------|----------|--------|----------|
| `ugc_creator` | UGC Creator | video | active | script -> base_image -> multishot -> curation -> voice -> lipsync -> subtitles -> render |
| `photo_multishot` | Product Photos | images | active | prompt -> generate |
| `ad_creative` | Ad Creative | images | active | copy -> image -> compose |
| `social_post` | Social Post | copy | active | caption -> image |
| `reel_creator` | Reel Creator | video | coming_soon | script -> scenes -> music -> subtitles -> render |
| `bg_remover` | Background Remover | images | coming_soon | remove |

### Tool Prompt Templates

Each tool can have:
- Default template: `backend/tools/{tool_id}/default_prompt.txt`
- Brand override: stored in brand data

Current tools with templates: `ugc_creator`, `ugc_multishot`, `ad_creative`, `social_post`, `reel_creator`, `chat`, `photo_multishot`

---

## Environment Variables

All API keys in `backend/.env`:

| Variable | Service |
|----------|---------|
| `GEMINI_API_KEY` | Google Gemini 2.5 Flash |
| `ELEVENLABS_API_KEY` | ElevenLabs TTS |
| `FAL_KEY` | Fal AI (Nano Banana, Kling, Fabric) |
| `HEYGEN_API_KEY` | HeyGen (legacy) |
| `KLING_API_KEY` | Kling (if direct, not via Fal) |

---

## Scalability Strategy

### Current (Phase 1)
- Single-process FastAPI with uvicorn
- JSON file-based storage
- In-memory job tracking
- Local FFmpeg for video concat

### Future (Phase 2-3)
- Redis queue for job management
- Celery workers for parallel execution
- S3-compatible storage for media
- PostgreSQL for structured data + prompt versioning
- WebSocket for real-time updates
