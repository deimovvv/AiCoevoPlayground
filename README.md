# Coevo Studio

**Internal agency platform for multi-brand AI-powered content creation.**

Select a brand and every tool inherits its context — assets, brand DNA, voice, prompts. The AI produces; you direct.

---

## What it does

Coevo Studio is a context-aware content factory. Upload a brand's assets once (avatars, products, clothing, backgrounds, logos, moodboards) and they become available to **every** tool automatically. Tools generate multiple variations, you curate the best, and only the winner gets the expensive animation pass.

### Core ideas

- **Context-aware tools** — pick a brand, all tools inherit its assets + guidelines.
- **3-layer prompts** — tool default → brand override → dynamic variables. Editable, not hardcoded.
- **Multishot curation** — generate variations, select the best, then animate.
- **Chat-first config** — describe what you want in plain language; an agent builds the tool config for you.

---

## Tech stack

- **Frontend** — React 19 + TypeScript 5.9 + Vite 8 + Tailwind CSS v4 + React Router 7
- **Backend** — FastAPI + Python 3.11+ + Uvicorn
- **Storage** — JSON files + local media (no database in Phase 1)
- **AI services**
  - **Gemini 2.5 Flash** — scripts, chat, prompt assembly, brand DNA, agent config
  - **Nano Banana 2** (via Fal) — image generation & editing
  - **GPT Image** — image editing
  - **Kling V3 Pro / V2.5 Turbo** (via Fal) — image-to-video & frame-to-frame
  - **Seedance 2.0** (via Fal) — reference-to-video with multi-ref + audio lipsync
  - **ElevenLabs** — text-to-speech, Voice Design, instant voice cloning
  - **HeyGen Avatar 4** — talking-photo lip-sync
  - **Beeble SwitchX** — video-to-video swap (garment/product/background)
  - **FFmpeg** — video concatenation + word-by-word subtitles

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js     | 20+     | for the frontend (Vite) |
| Python      | 3.11+   | for the backend (FastAPI) |
| FFmpeg      | any recent | required for video render/concat — `brew install ffmpeg` on macOS |
| Git         | any     | to clone |

---

## Quick start

### 1. Clone

```bash
git clone <repo-url>
cd AiCoevoPlayground
```

### 2. Configure API keys

Create `backend/.env` (see [`backend/.env.example`](backend/.env.example)):

```env
# Required
GEMINI_API_KEY=...        # Google AI Studio
FAL_KEY=...               # fal.ai — image + video generation
ELEVENLABS_API_KEY=...    # ElevenLabs — voices

# Optional
HEYGEN_API_KEY=...        # HeyGen — talking-photo lip-sync
BEEBLE_API_KEY=...        # Beeble SwitchX — Video Swap tool
BEEBLE_API_BASE=...       # Beeble API base URL (if non-default)
APIFY_API_KEY=...         # Apify — Instagram scraping (Content Analyzer imports)
```

> **Never commit `.env`.** It is gitignored. API keys are billed to whoever owns them.

### 3. Install dependencies

```bash
# Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate          # macOS/Linux
pip install -r requirements.txt
cd ..

# Frontend
cd frontend
npm install
cd ..
```

### 4. Run

One command starts both servers with prefixed logs (Ctrl+C stops both):

```bash
./dev.sh                 # backend :8000 + frontend :5173
./dev.sh backend         # backend only
./dev.sh frontend        # frontend only
```

Or run them manually:

```bash
# Terminal 1 — backend
cd backend && source .venv/bin/activate
python -m uvicorn main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend && npm run dev
```

Open **http://localhost:5173**.

---

## Tools

11 active tools plus a brand-agnostic sandbox (Manual Lab).

| Tool | Category | What it does |
|------|----------|--------------|
| **UGC Creator** | video | Avatars talking to camera — script → base image → multishot → voice → lip-sync → render (with/without subtitles). Per-clip editing. |
| **Video Ad Creator** | video | Cinematic ads — storyboard, keyframes, frame-to-frame Kling animation, voiceover, render. |
| **Fashion Reel** | video | Editorial fashion reels, no talking. Story mode or Looks mode. Auto/manual frame-to-frame. Per-clip animate editing. |
| **Product Clip** | video | Short product videos, no people — frame-to-frame product motion. |
| **Video Swap** | video | Swap garment/product/background in **your own** video, keep subject + motion (Beeble SwitchX). |
| **Static Ad** | images | Ready-to-publish static ads — 40 composition templates. |
| **Carousel Creator** | images | Multi-slide carousels with consistent visual story. |
| **Product Spotlight** | images | Professional product photography in context. |
| **Ad Creative Lab** | images | Batch creatives from reference images + visual-guide extraction. |
| **Avatar Creator** | images | Generate new brand avatars or pose sheets for existing ones. |
| **Content Analyzer** | images | Analyze any video, extract script/scenes/style, map to your brand assets, recreate. |
| **Manual Lab** | sandbox | Brand-agnostic chat: direct Nano Banana 2 + Kling + Seedance with `[image1]`/`[image2]` ref tagging, multi-turn chaining, gallery. At `/dashboard/lab`. |

See [`docs/tools.md`](docs/tools.md) for full pipelines, inputs, and rules.

---

## Project structure

```
frontend/src/
  pages/              # route-level views (Generate, ToolRun, BrandSettings, ManualLab, ...)
  components/         # feature + layout + ui primitives
  tools/              # per-tool: index.ts (schema/handlers) + handlers.ts
  lib/                # api.ts (backend client), BrandContext, utils
backend/
  main.py             # FastAPI app — all endpoints
  services/           # AI integrations (gemini, fal, elevenlabs, heygen, beeble, ffmpeg, agent, ...)
  tools/              # registry.json + per-tool default_prompt.txt
  data/               # JSON storage + brand media (see "Data" below)
docs/                 # architecture, tools, stack, pipeline, design, onboarding
dev.sh                # local dev runner (backend + frontend)
```

---

## Data & what ships in the repo

Brand context assets **are tracked** so a clone arrives ready to use:

- ✅ `backend/data/brands.json` — all brand configs
- ✅ `backend/data/avatars/`, `products/`, `clothing/`, `backgrounds/`, `moodboards/`, `logos/` — brand-context media

Heavy generated output and runtime files are **gitignored**:

- ❌ `backend/data/renders/` — generated videos (can reach GBs)
- ❌ `backend/data/generations.json` — generation history
- ❌ `backend/data/ig-imports/`, `backend/tmp/` — transient

---

## Adding a new tool

1. `backend/tools/{tool_id}/default_prompt.txt` — prompt template with `{variables}` and `{?cond}...{/cond}` blocks.
2. Register in `backend/tools/registry.json` with its pipeline steps.
3. `frontend/src/tools/{tool_id}/index.ts` — `ToolDefinition` (schema + step handlers).
4. Register in `frontend/src/tools/registry.ts`.

---

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — system design, API endpoints, data structures
- [`docs/tools.md`](docs/tools.md) — all tools: prompts, pipelines, inputs, rules
- [`docs/stack.md`](docs/stack.md) — technologies, services, environment
- [`docs/pipeline.md`](docs/pipeline.md) — generation flows, cost optimization, PromptBuilder
- [`docs/client_onboarding.md`](docs/client_onboarding.md) — what to request from clients (brand brief, assets)
- [`docs/design_language.md`](docs/design_language.md) — design system, tokens, components
- [`docs/product_vision_ux.md`](docs/product_vision_ux.md) — UX philosophy, user flows

---

## Notes

- **No auth yet.** Don't expose the app publicly without a gate — there's no login and API calls bill the configured keys.
- **macOS/Linux** is the primary dev environment.
- **CORS** allows all origins for local development.

## License

Proprietary — Coevo Agency
