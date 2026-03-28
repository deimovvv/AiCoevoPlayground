# Coevo Creative OS (AiCoevoPlayground)

**Internal agency platform for multi-brand AI-powered content creation**

## 🚀 Overview

Coevo Creative OS is a context-aware content generation platform designed for creative agencies. The system automatically adapts AI tools to each brand's unique context, including assets, prompts, briefs, and brand guidelines.

### Core Innovation

- **Context-Aware Architecture**: Select a brand → all tools inherit its context automatically
- **Multishot Curation**: Generate variations → AI selects best → animate only winner (60-70% cost savings)
- **Dynamic Prompts**: Editable templates with variables, not hardcoded strings
- **Asset Library**: Upload once, use everywhere across all tools

## 🛠️ Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4
- **Backend**: FastAPI + Python 3.11+
- **AI Services**:
  - Gemini 2.5 Flash (prompts, scripts, vision)
  - Nano Banana 2 (image generation)
  - ElevenLabs (text-to-speech)
  - Fal AI Fabric 1.0 (lip-sync)
  - Kling (video generation)

## 🏃‍♂️ Quick Start

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
.venv\Scripts\activate  # Windows
# or
source .venv/bin/activate  # macOS/Linux

pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

## 📁 Project Structure

```
├── frontend/              # React + Vite frontend
│   └── src/
│       ├── pages/        # Route components
│       ├── components/   # UI components
│       └── lib/          # API client
├── backend/              # FastAPI backend
│   ├── services/        # Business logic
│   ├── data/            # JSON storage (Phase 1)
│   └── tools/           # Modular tools system
└── docs/                # Documentation
    ├── architecture.md
    ├── stack.md
    ├── morfeo_pipeline.md
    └── product_vision_ux.md
```

## 🎯 Key Features

### Implemented ✅
- Brand CRUD operations
- Avatar & product upload
- Voice presets management
- Generation Board UI
- ElevenLabs TTS integration
- HeyGen & Fal Fabric lip-sync
- Gemini script generation

### In Progress 🚧
- Context-aware architecture
- Asset library system (clothing, backgrounds)
- Prompt management system
- Nano Banana 2 integration
- Multishot generation flow
- AI curation with Gemini Vision

### Planned 📋
- Full UGC pipeline
- Multishot Review Chamber UI
- Real-time job tracking
- AI Chat Assistant
- Brief management

## 📖 Documentation

- [Architecture Overview](docs/architecture.md) - System design, API endpoints, data structures
- [Tech Stack](docs/stack.md) - Technologies, setup, environment variables
- [Content Pipeline](docs/morfeo_pipeline.md) - Generation flows, optimization strategies
- [Product Vision](docs/product_vision_ux.md) - UX philosophy, user flows, UI components
- [Architecture Review](docs/architecture_review_2024.md) - Analysis & recommendations

## 🔧 Environment Variables

Create `backend/.env`:

```env
GEMINI_API_KEY=your_key_here
NANO_BANANA_API_KEY=your_key_here
ELEVENLABS_API_KEY=your_key_here
HEYGEN_API_KEY=your_key_here
FAL_KEY=your_key_here
KLING_API_KEY=your_key_here
```

## 🤝 Contributing

This is an internal Coevo project. For questions or contributions, please contact the development team.

## 📝 License

Proprietary - Coevo Agency

---

**Built with ❤️ by Coevo Team**