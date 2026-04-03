# Coevo Creative OS

**Internal agency platform for multi-brand AI-powered content creation**

## Overview

Coevo Creative OS is a context-aware content generation platform designed for creative agencies. The system automatically adapts AI tools to each brand's unique context, including assets, prompts, and brand guidelines.

### Core Innovation

- **Context-Aware Architecture**: Select a brand and all tools inherit its context automatically
- **Multishot Curation**: Generate variations, AI selects best, animate only the winner (60-70% cost savings)
- **Dynamic Prompts**: 3-layer template system with editable variables, not hardcoded strings
- **Asset Library**: Upload once, use everywhere across all tools

## Tech Stack

- **Frontend**: React 19 + TypeScript 5.9 + Vite 8 + Tailwind CSS v4 + React Router 7
- **Backend**: FastAPI + Python 3.11+ + Uvicorn
- **AI Services**:
  - Gemini 2.5 Flash (scripts, chat, prompt assembly)
  - Nano Banana 2 via Fal (image generation)
  - Kling V2.6 via Fal (image-to-video)
  - ElevenLabs (text-to-speech)
  - Fal AI Fabric 1.0 (lip-sync)
  - FFmpeg (video concatenation)

## Quick Start

### Frontend
```bash
cd frontend
npm install
npm run dev  # http://localhost:5173
```

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

## Project Structure

```
frontend/src/
  pages/              # 14 route-level components
  components/         # 11 feature + 5 UI + 3 layout components
  lib/                # API client, BrandContext, utilities
backend/
  services/           # 11 service modules
  tools/              # 9 tool directories with configs/prompts
  data/               # JSON storage + media files
docs/                 # Architecture, stack, pipeline, design, vision
```

## Key Features

### Implemented
- Brand CRUD with rich configuration
- Avatar, product, and clothing upload
- Voice presets with preview playback
- AI Chat (Gemini 2.5 Flash) with brand context and asset chips
- 6 registered tools (4 active, 2 coming soon)
- UGC Creator with 8-step pipeline (script, image, multishot, curation, voice, lipsync, subtitles, render)
- 3-layer prompt system (defaults, brand overrides, dynamic variables)
- Mock preview mode for pipeline visualization
- ElevenLabs TTS, Nano Banana 2, Kling V2.6, Fal Fabric lip-sync integrations
- FFmpeg video concatenation
- Brand guidance from URL scraping and PDF upload

### In Progress
- Gemini Vision curation (currently auto-selects first variation)
- Subtitles pipeline step
- Content library with real generations
- End-to-end pipeline testing

## Documentation

- [Architecture](docs/architecture.md) — System design, API endpoints, data structures
- [Tools Reference](docs/tools.md) — All 9 tools: prompts, pipelines, inputs, rules
- [Tech Stack](docs/stack.md) — Technologies, services, environment setup
- [Content Pipeline](docs/morfeo_pipeline.md) — Generation flows, cost optimization
- [Product Vision](docs/product_vision_ux.md) — UX philosophy, user flows, UI components
- [Design System](docs/design.md) — Colors, typography, layout, components
- [Development Planning](docs/planning.md) — Phased roadmap
- [Architecture Review](docs/architecture_review_2024.md) — Analysis and recommendations

## Environment Variables

Create `backend/.env`:

```env
GEMINI_API_KEY=your_key
ELEVENLABS_API_KEY=your_key
FAL_KEY=your_key
HEYGEN_API_KEY=optional
KLING_API_KEY=optional
```

## License

Proprietary - Coevo Agency
