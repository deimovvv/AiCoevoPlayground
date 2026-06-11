# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Coevo Studio** is an internal agency platform for managing multi-brand advertising and marketing content creation. The system is designed as a **context-aware content factory** where AI tools dynamically adapt to each brand's assets, prompts, and brand guidelines.

### Core Innovation

- When you select a brand, **all tools automatically inherit** that brand's context
- Assets (avatars, products, clothing) are uploaded once and reused across all tools
- Prompts are editable templates with variables via 3-layer PromptBuilder system
- The "multishot curation" approach generates multiple variations and selects the best before expensive animation

## Development Commands

### Frontend (React + Vite + TypeScript)
```bash
cd frontend
npm install                    # Install dependencies
npm run dev                    # Start dev server (http://localhost:5173)
npm run build                  # Build for production
npm run lint                   # Run ESLint
```

### Backend (FastAPI + Python)
```bash
cd backend
python -m venv .venv
source .venv/bin/activate               # macOS/Linux
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

## Architecture

### Tech Stack
- **Frontend**: React 19 + TypeScript 5.9 + Vite 8 Beta + Tailwind CSS v4 + React Router 7
- **Backend**: FastAPI + Python 3.11+ + Uvicorn
- **AI Services**:
  - **Gemini 2.5 Flash** — scripts, chat, prompt assembly, curation (planned)
  - **Nano Banana 2** via Fal — image generation & editing
  - **Kling V2.6** via Fal — image-to-video generation
  - **ElevenLabs** — text-to-speech, voice cloning
  - **Fal AI Fabric 1.0** — lip-sync from static images + audio
  - **HeyGen** — legacy talking photo lip-sync
  - **FFmpeg** — video concatenation

### Data Persistence (Phase 1)
- **No database** — JSON file-based storage
- **Storage structure**:
  ```
  backend/data/
    brands.json           # All brands (flat JSON array)
    avatars/              # Avatar image files
    products/             # Product image files
    clothing/             # Clothing image files
    renders/              # Generated video outputs
  ```

### Project Structure
```
frontend/src/
  pages/                    # Route-level components (15 pages)
    Home.tsx                  # Landing page
    Dashboard.tsx             # Brand list management
    Workspace.tsx             # Main workspace with ChatPanel
    BrandWorkspace.tsx        # Brand detail (avatars, scripts, gen board)
    BrandSettings.tsx         # Brand configuration
    GeneratePage.tsx           # Tool registry and launcher
    ToolRunPage.tsx            # Step-by-step pipeline execution
    ManualLab.tsx              # Brand-agnostic chat sandbox (Nano Banana + Kling, refs as image1/image2)
    ContentPage.tsx            # Content library
    GenerationPipeline.tsx     # Pipeline view
    ToolsPage.tsx              # Tool browser
    PipelineConfigPage.tsx     # Admin pipeline config
    IntegrationsPage.tsx       # Platform connections
    AutomationsPage.tsx        # Workflow automation
    PerformancePage.tsx        # Analytics dashboard
  components/
    ChatPanel.tsx              # AI chat with asset chips + tool actions
    BrandPanel.tsx             # Brand details side panel
    GenerationBoard.tsx        # Card-based generation history
    GenerationCard.tsx         # Individual generation card
    GenerationDetailDrawer.tsx # Generation detail view
    NewGenerationWizard.tsx    # New generation modal
    PipelineMonitor.tsx        # Real-time pipeline tracker
    PipelineTimeline.tsx       # Timeline visualization
    PromptsCard.tsx            # Prompt override management
    HeygenAvatarSelector.tsx   # HeyGen avatar selector
    ActivePipelineDrawer.tsx   # Active pipeline sidebar
    layout/                    # AppLayout, Sidebar, BrandSwitcher
    ui/                        # Button, Card, Input, Label, Textarea
  lib/
    api.ts                     # All backend API calls (40+ functions)
    BrandContext.tsx            # Global brand state provider
    utils.ts                   # cn() utility

backend/
  main.py                  # FastAPI app with 51 endpoints
  services/                # 11 service modules
    brands.py                # Brand CRUD + asset persistence
    chat.py                  # Gemini chat with brand context
    copy_gen.py              # Gemini script generation
    prompt_builder.py        # 3-layer prompt assembly
    tts.py                   # ElevenLabs TTS
    image_gen.py             # Nano Banana 2 via Fal
    kling_video.py           # Kling V2.6 via Fal
    manual_lab.py            # Manual Lab: Gemini-backed pipeline-suggestion service
    fal_lipsync.py           # Fal Fabric lip-sync
    heygen.py                # HeyGen integration (legacy)
    video_concat.py          # FFmpeg video concatenation
  tools/                   # 9 tool directories
    registry.json            # Tool registry (6 tools)
    ugc_creator/             # 8-step UGC pipeline
    ugc_multishot/           # Multishot image generation
    ad_creative/             # Ad creative generation
    social_post/             # Social media posts
    reel_creator/            # Short-form reels
    photo_multishot/         # Product photo variations
    chat/                    # Chat prompt template
    bg_remover/              # Background removal
    clip_generator/          # Clip generation
  data/                    # JSON storage + media files
```

## Core Concepts

### 1. Context-Aware Tools

**Every tool execution** follows this flow:
```
User selects tool within brand ->
PromptBuilder loads:
  - Tool prompt template (brand override or default)
  - Dynamic variables from brand (name, guidance, assets)
  - Conditional sections based on available data ->
Execute tool with generated prompt ->
Return job ID -> frontend polls for results
```

### 2. PromptBuilder (3-Layer System)

```
Layer 1: Tool Default     ->  backend/tools/{tool_id}/default_prompt.txt
Layer 2: Brand Override   ->  brand.promptOverrides[tool_id]
Layer 3: Dynamic Vars     ->  {brand_name}, {brand_guidance}, {avatars}, {products}, etc.
```

- Template variables: `{variable_name}`
- Conditional blocks: `{?var}...{/var}` (only included if variable is non-empty)

### 3. Asset Management

**Types**: Avatars (with descriptions/tags), Products, Clothing, Voice Presets

**Key**: Assets are uploaded once per brand and available to ALL tools automatically.

### 4. UGC Pipeline (7 Steps)

1. **Script** (Gemini 2.5 Flash or custom per scene with visual direction + shot type)
2. **Base Image** (Nano Banana 2) — Avatar + product + clothing + composition ref
3. **Multishot** (Nano Banana 2 x N) — Variations per scene
4. **Curation** — Manual selection + ImageEditPanel per variation
5. **Voice** (ElevenLabs v3) — TTS per scene, editable text, play/regen
6. **Lip-Sync** (HeyGen Avatar 4) — Uses voice step audio directly
7. **Render** (FFmpeg) — Dual output: with + without word-by-word subtitles

### 5. Async Job Pattern (Fal services)

```
POST submit -> request_id
GET poll status -> IN_QUEUE | IN_PROGRESS | COMPLETED
GET fetch result -> final URL
```

## Common Development Patterns

### Making API Calls
All backend communication goes through `frontend/src/lib/api.ts`. Always use exported functions rather than raw `fetch()`.

### Adding a New Service Integration
1. Create service file: `backend/services/new_service.py`
2. Define functions with `is_configured()` check
3. Import in `backend/services/__init__.py`
4. Add endpoints in `backend/main.py`
5. Add TypeScript types + functions in `frontend/src/lib/api.ts`

### Adding a New Tool
1. Create tool directory: `backend/tools/{tool_id}/`
2. Add `default_prompt.txt` with template variables
3. Register in `backend/tools/registry.json` with pipeline steps
4. Create frontend directory: `frontend/src/tools/{tool_id}/`
5. Create `index.ts` with ToolDefinition (schema + stepHandlers + approvalSteps + autoRunSteps)
6. Register in `frontend/src/tools/registry.ts`

## API Key Management

All API keys stored in `backend/.env`:
```
GEMINI_API_KEY=...
ELEVENLABS_API_KEY=...
FAL_KEY=...
HEYGEN_API_KEY=...     # optional
KLING_API_KEY=...      # optional
```

**CRITICAL**: Never commit `.env` or expose keys in code/logs.

## Current State

### Implemented
- Brand CRUD with rich configuration (context, DNA, assets, voices, prompts, fonts)
- Brand DNA: AI-extracted identity (colors, tone, audience, keywords, personality, competitors)
- Multi-photo products (up to 3 images per product: front, back, detail)
- Avatar, product, clothing, background, logo upload with auto-description (Gemini Vision)
- Voice presets with TTS preview playback
- AI Chat (Gemini 2.5 Flash) with brand context, asset chips
- 15+ registered tools (most active with full pipelines)
- UGC Creator: 7-step pipeline with custom scripts, shot selector, voice editing, dual render
- Video Ad Creator: 6-step pipeline with 10-frame storyboard, Kling V3 animation
- Static Ad: 40 templates with detailed composition prompts (hidden in Generate, kept on disk)
- Carousel Creator: 8 types, base_scene visual consistency system
- Ad Creative Lab: visual guide extraction + batch generation (hidden in Generate)
- Content Analyzer: video analysis with Gemini Vision
- Product Clip: frame-to-frame product videos
- Avatar Sheet (id `avatar_creator`): multi-view sheet — `create` from brief or `poses` from existing avatar
- Product Sheet: multi-view sheet (`sheet`) or detail close-ups (`details`) from 1-4 product photos
- Fashion Editorial: model + clothing + look&feel recipe → editorial variants with framing/lighting/vibe presets
- Ecommerce Batch (prototype, `/dashboard/ecommerce-batch`): drop folder of outfits + folder of poses, generate the full catalog. Visual flow ready; generation not wired yet
- Voice Lab (hidden, `/dashboard/voice-lab`): browser STT → Gemini → ElevenLabs → autoplay. Working but hidden from nav pending validation
- Manual Lab: brand-agnostic sandbox at `/dashboard/lab` — single split-layout page (sidebar control 420px + galería derecha estilo Freepik). v2 reemplazó a v1 (ver `decisions-log.md` 2026-06). El archivo legacy `ManualLab.tsx` queda en disco pero no se importa. Features clave: refs cuadrados con replace-in-place, @-mention popover, dictation es-AR, drawer derecho overlay con thumbs de sesión, lightbox con navegación entre variantes (← / → + descarga), bloques de generación con variantes lado a lado + acciones por variante en hover, Animar con prompt default + recomendador Gemini Vision.
- Look & Feel: color-grade transfer con tres caminos en panel (saved L&F / upload ad-hoc / receta a mano) y dos modos (Receta default — Gemini analiza a texto, no manda la imagen al generador / Imagen ref — flaky con Nano Banana, warned in UI).
- **Consistencia**: anchor de identidad/producto en Lab. Output = `[img1]` tal cual EXCEPTO el aspecto declarado (cara o producto) que se reemplaza para matchear la ref de consistencia. Tres caminos: avatar del Brand Kit (type avatar), producto del Brand Kit (type product), upload ad-hoc con botones separados por tipo. Una sola activa a la vez, badge "ID" burgundy en la card. Limitación: prompt engineering, no face-lock real (ver `decisions-log.md` 2026-06).
- Multi-foto por prenda (`ClothingItem.images[]`): igual que Products. Front + 2 extras (back / detail). Ecommerce Pack los consume con priorización smart por tipo de shot (front siempre, back/detail solo cuando el shot lo pide). Cap de 8 refs respeta el límite de Fal.
- Fashion Reel Looks mode multi-shot: cada outfit × cada shot tildado = una escena. `VIDEO_SHOT_CATALOG` con general / medium / detail / back. Cada shot tiene su propio motion hint en `handleAnimate` (detail = dolly-in lento, no sway de modelo).
- Multi-logo per brand: `brand.logos[]` (isotipo, logotipo, variants) + legacy `brand.logo` read-only
- ImageEditPanel: reusable edit component across all tools (product picker + quick actions)
- 3-layer prompt system with response normalizer
- Word-by-word karaoke subtitles (Remotion)
- All AI services: Gemini 2.5 Flash, Nano Banana 2, Kling V3 Pro, HeyGen Avatar 4, ElevenLabs v3
- FFmpeg video concatenation with dual output (subs + no subs)
- Brand guidance from URL scraping and PDF upload
- Brand switcher in sidebar with real-time sync
- Content library with generation history

### Planned
- Generation persistence (save full pipeline state per run)
- Content Calendar agent
- Client Portal (requires auth)
- Batch generation
- Authentication (Clerk/Auth0)
- Redis job queues
- PostgreSQL migration
- Cross-scene variation assignment in curation

## Important Notes

- **macOS/Linux Environment**: Primary development on macOS
- **CORS**: Backend allows all origins for local development
- **Static Files**: Backend serves `/static/avatars/`, `/static/products/`, `/static/clothing/`, `/static/backgrounds/`, `/static/renders/`
- **Async Execution**: Backend uses `asyncio` + `httpx` for external API calls (120s timeout for Gemini)
- **Type Safety**: Frontend uses TypeScript strictly — maintain type definitions
- **Dark Theme**: Pure black canvas (#000000) with warm burgundy accent (#c45830)
- **React Hooks Rule**: All `useState` calls must be before any conditional returns in components

## Documentation

- **[architecture.md](docs/architecture.md)**: System architecture, API endpoints, data structures
- **[tools.md](docs/tools.md)**: All 15 tools with pipelines, features, and status
- **[stack.md](docs/stack.md)**: Tech stack, services, environment setup
- **[pipeline.md](docs/pipeline.md)**: UGC pipeline flow, cost optimization, PromptBuilder
- **[product_vision_ux.md](docs/product_vision_ux.md)**: UX philosophy, user flows
- **[design.md](docs/design.md)**: Design system, color tokens, typography
- **[planning.md](docs/planning.md)**: Development roadmap (7 phases)
- **[pending-features.md](docs/pending-features.md)**: Backlog with detailed plans per feature
- **[decisions-log.md](docs/decisions-log.md)**: Chronological log of design/product decisions with rationale — read this when something in the codebase seems weird or when you're about to revisit a closed discussion
- **[setup.md](docs/setup.md)**: How to run locally, environment variables

## Common Debugging

- **Backend not starting**: Check `.env` has required API keys, restart uvicorn
- **Images not loading**: Verify static file mounts in `main.py`
- **Black screen on route**: Check React hooks are before conditional returns
- **Brand switcher not updating**: Ensure `refreshBrands()` is called after create/delete
- **Prompt not working**: Verify template variables match `build_context_variables()` output
