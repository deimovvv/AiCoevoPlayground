# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Coevo Creative OS** is an internal agency platform for managing multi-brand advertising and marketing content creation. The system is designed as a **context-aware content factory** where AI tools dynamically adapt to each brand's assets, prompts, briefs, and brand guidelines.

### Core Innovation

Unlike traditional creative tools that require manual prompt configuration for every generation, Coevo Creative OS uses a **context-first architecture**:
- When you select a brand, **all tools automatically inherit** that brand's context
- Assets (avatars, products, clothing, backgrounds) are uploaded once and reused across all tools
- Prompts are editable templates with variables, not hardcoded
- The "multishot curation" approach generates multiple variations and AI selects the best before expensive animation

## Development Commands

### Frontend (React + Vite + TypeScript)
```bash
cd frontend
npm install                    # Install dependencies
npm run dev                    # Start dev server (http://localhost:5173)
npm run build                  # Build for production
npm run lint                   # Run ESLint
npm run preview                # Preview production build
```

### Backend (FastAPI + Python)
```bash
cd backend
python -m venv .venv                    # Create virtual environment (first time only)
.venv\Scripts\activate                  # Windows activation
source .venv/bin/activate               # macOS/Linux activation
pip install -r requirements.txt         # Install dependencies
python -m uvicorn main:app --reload --port 8000    # Start dev server
```

## Architecture

### Tech Stack
- **Frontend**: React 19 + TypeScript + Vite 8 Beta + Tailwind CSS v4 + React Router 7
- **Backend**: FastAPI + Python 3.11+ + Uvicorn
- **AI Services**:
  - **Gemini 2.5 Flash** (prompt generation, brief interpretation, scripts, image curation with Vision)
  - **Nano Banana 2** (image generation & editing)
  - **Kling** (video generation for reels)
  - **ElevenLabs** (text-to-speech, voice cloning)
  - **Fal AI Fabric 1.0** (advanced lip-sync from static images)
  - **HeyGen** (legacy talking photo lip-sync)

### Data Persistence (Phase 1)
- **No database** — JSON file-based storage
- **Per-brand folder structure**:
  ```
  backend/data/brands/{brand-id}/
  ├── brand.json                  # Core config
  ├── context/
  │   ├── brand_guidance.md       # Brand guidelines document
  │   ├── briefs/                 # Campaign briefs
  │   └── prompts/                # Tool-specific prompt overrides
  ├── assets/
  │   ├── avatars/                # Avatar images + metadata
  │   ├── products/               # Product images
  │   ├── clothing/               # Wardrobe items
  │   └── backgrounds/            # Scene backgrounds
  └── generations/                # Generated content history
  ```

### Project Structure
```
frontend/src/
├── pages/              # Route-level components
│   ├── Dashboard.tsx           # Brand list management
│   ├── BrandWorkspace.tsx      # Main brand context hub
│   ├── AssetManager.tsx        # Upload & manage brand assets (TODO)
│   ├── PromptEditor.tsx        # Edit tool prompts (TODO)
│   └── ChatAssistant.tsx       # AI chat interface (TODO)
├── components/
│   ├── GenerationBoard.tsx         # Card-based generation history
│   ├── GenerationCard.tsx          # Individual generation card
│   ├── NewGenerationWizard.tsx     # Modal for new generations
│   ├── PipelineMonitor.tsx         # Real-time pipeline tracker
│   ├── layout/                     # AppLayout + Sidebar
│   └── ui/                         # Reusable primitives
└── lib/
    └── api.ts                      # All backend API calls

backend/
├── main.py             # FastAPI app with all endpoints
├── services/           # Modular business logic
│   ├── brands.py       # Brand CRUD + context management
│   ├── copy_gen.py     # Gemini script generation
│   ├── tts.py          # ElevenLabs TTS
│   ├── heygen.py       # HeyGen integration
│   ├── fal_lipsync.py  # Fal Fabric lip-sync
│   ├── kling_video.py  # Kling video generation
│   └── image_gen.py    # Nano Banana integration (TODO)
├── data/brands/{id}/   # Per-brand storage
└── tools/              # Modular tools system
```

## Core Concepts

### 1. Context-Aware Tools

**Every tool execution** follows this flow:
```
User selects tool within brand →
Backend loads:
  - Brand guidance document
  - Active campaign brief (optional)
  - Tool prompt template (custom or default)
  - Selected assets (avatar, product, clothing, background) →
Gemini generates final prompt using template + context →
Execute tool (Nano Banana / Kling / etc.) →
Return job ID → frontend polls for results
```

### 2. Asset Management

**Asset Types**:
1. **Avatars**: People/models with detailed descriptions
   - Required metadata: name, description, tags
   - Example: "Hombre de 32 años, argentino, piel morena clara, barba corta, casual urbano"

2. **Products**: Products with transparent PNGs
   - Required metadata: name, category, description

3. **Clothing/Wardrobe**: Outfit options for avatars
   - Required metadata: description, tags

4. **Backgrounds**: Scene images or backgrounds
   - Required metadata: description, mood, lighting

**Key Insight**: Assets are uploaded once per brand and available to ALL tools automatically.

### 3. Prompt System

**Structure**:
- Default prompts: `backend/tools/{tool_id}/default_prompt.txt`
- Brand overrides: `backend/data/brands/{brand_id}/context/prompts/{tool_id}.txt`

**Template Variables**:
- `{brand_name}`
- `{brand_guidance}`
- `{active_brief}`
- `{avatar_description}`
- `{product_name}`
- `{clothing_description}`
- `{background_description}`
- Custom variables per tool

**Example**:
```
You are creating a UGC video for {brand_name}.

BRAND CONTEXT:
{brand_guidance}

AVATAR:
{avatar_description}

PRODUCT:
{product_name}

Generate a 30-second UGC script...
```

### 4. Generation Pipeline (UGC Videos)

**6-Phase Morfeo Pipeline**:

1. **Script Generation** (Gemini 2.5) → 5-act structure (Hook → Story → Story → Twist → CTA)
2. **Multishot Image Gen** (Nano Banana 2) → 3-5 variations per scene
3. **AI Curation** (Gemini Vision) → Selects best shot per scene
4. **Audio Generation** (ElevenLabs) → TTS per scene
5. **Lip-Sync Animation** (Fal Fabric 1.0) → Only curated images (cost optimization!)
6. **Final Render** (FFmpeg) → Combine segments with transitions

**Key Optimization**: By generating multiple image variations and selecting the best BEFORE animating, we save 60-70% on expensive lip-sync costs.

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
2. Add `config.json` with parameters definition
3. Add `default_prompt.txt` with template
4. Register in `backend/tools/registry.json`
5. Implement execution logic in `backend/services/`
6. Add frontend UI in tool selection flow

### Adding a New Asset Type
1. Update brand data structure in `backend/services/brands.py`
2. Add storage directory in `backend/data/brands/{id}/assets/{type}/`
3. Create upload endpoint in `backend/main.py`
4. Add TypeScript types in `frontend/src/lib/api.ts`
5. Add UI for upload + selection in `AssetManager.tsx`

## API Key Management

All API keys stored in `backend/.env`:
```
GEMINI_API_KEY=...
NANO_BANANA_API_KEY=...
ELEVENLABS_API_KEY=...
HEYGEN_API_KEY=...
FAL_KEY=...
KLING_API_KEY=...
```

**CRITICAL**: Never commit `.env` or expose keys in code/logs.

## Current State & Roadmap

### Implemented (Phase 1)
- ✅ Brand CRUD (create, list, delete)
- ✅ Avatar upload + HeyGen sync
- ✅ Product upload
- ✅ Voice presets per brand
- ✅ Generation Board UI (with mock data)
- ✅ ElevenLabs TTS integration
- ✅ HeyGen talking photo integration
- ✅ Fal Fabric lip-sync integration
- ✅ Kling video generation integration
- ✅ Gemini script generation

### In Progress (Phase 2)
- 🚧 Context-aware architecture refactor
- 🚧 Asset library system (clothing, backgrounds)
- 🚧 Prompt management system
- 🚧 Nano Banana 2 integration
- 🚧 Multishot generation flow
- 🚧 AI curation (Gemini Vision)

### Planned (Phase 3)
- 📋 Asset Manager UI
- 📋 Prompt Editor UI
- 📋 Full UGC pipeline backend
- 📋 Multishot Review Chamber UI
- 📋 Real-time job status with WebSocket
- 📋 Brief management
- 📋 AI Chat Assistant

### Future (Phase 4+)
- 📋 Batch generation
- 📋 Scheduling & auto-publish
- 📋 Team collaboration
- 📋 Analytics dashboard
- 📋 Client-facing dashboards

## Important Notes

- **Windows Environment**: Developed on Windows (use backslashes in some paths)
- **No Git Repository**: Currently not initialized as git repo
- **CORS**: Backend allows all origins for local development
- **Static Files**: Backend serves `/static/avatars/` and `/static/products/`
- **Async Execution**: Backend uses `asyncio` for external API calls
- **Type Safety**: Frontend uses TypeScript strictly — maintain type definitions
- **Dark Theme**: Pure black canvas (#000000) with warm burgundy accent (#c45830)

## Design System

- **Colors**: Dark editorial with neutral grays + warm burgundy accent
- **Typography**: Inter font, sizes 11-22px
- **Layout**: Fixed sidebar (200px) + content area (pure black canvas)
- **Spacing**: 4px base grid
- **Border radius**: 6px (sm), 8px (md), 12px (lg)

## Testing Strategy

Currently: Manual testing

Future phases:
- Unit tests for services (pytest)
- Integration tests for pipelines
- E2E tests for critical flows (Playwright)
- Visual regression tests for UI components

## Documentation

- **[architecture.md](docs/architecture.md)**: Full system architecture, API endpoints, data structures
- **[stack.md](docs/stack.md)**: Tech stack details, development setup, environment variables
- **[morfeo_pipeline.md](docs/morfeo_pipeline.md)**: Detailed pipeline flows, cost optimization, error handling
- **[product_vision_ux.md](docs/product_vision_ux.md)**: Product philosophy, user flows, UI components
- **[design.md](docs/design.md)**: Design system, color tokens, typography
- **[planning.md](docs/planning.md)**: Development roadmap, phase breakdown

## Quick Reference

### Typical Workflows

**Create new brand**:
1. POST `/api/brands` with name + brandContext
2. System creates folder structure automatically
3. Returns brand object with ID

**Upload avatar**:
1. POST `/api/brands/{id}/avatars` with image file + description
2. Image stored in `data/brands/{id}/assets/avatars/`
3. Metadata saved to brand.json
4. Optional: Create HeyGen talking photo

**Generate UGC video** (future):
1. POST `/api/brands/{brand_id}/tools/ugc_video/run` with asset IDs
2. Backend loads full context + generates prompts
3. Executes 6-phase pipeline
4. Returns job_id
5. Frontend polls GET `/api/jobs/{job_id}` for status
6. Human reviews at checkpoints
7. Final video saved to generations/

### Common Debugging

**Backend not starting**: Check `.env` has all required API keys
**Images not loading**: Verify static file mount in `main.py`
**Generation stuck**: Check job status in backend logs
**Prompt not working**: Verify template variables match available context

---

**For new contributors**: Start by reading [architecture.md](docs/architecture.md) for system overview, then [product_vision_ux.md](docs/product_vision_ux.md) for UX flows.
