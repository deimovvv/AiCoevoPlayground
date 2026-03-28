# Coevo Creative OS — Tech Stack

**Coevo Creative OS** is an internal agency platform for multi-brand advertising and marketing content generation.

---

## Frontend

| Technology       | Version  | Purpose                          |
|------------------|----------|----------------------------------|
| React            | 19       | UI framework                     |
| Vite             | 8 Beta   | Build tool & dev server          |
| TypeScript       | 5.9      | Type safety                      |
| Tailwind CSS     | 4.x      | Utility-first styling            |
| React Router     | 7.x      | Client-side routing              |
| Lucide React     | Latest   | Icon library                     |
| Inter (Google)   | —        | Primary font                     |

### Component Architecture

- Custom design token system via `@theme` in `index.css`
- Tailwind `@utility` directives for token-based classes
- Reusable UI components (`Button`, `Input`, `Label`, `Select`)
- Page components organized by workflow:
  - `Dashboard` — Brand list management
  - `BrandWorkspace` — Main brand context hub
  - `AssetManager` — Upload & manage brand assets
  - `PromptEditor` — Edit tool prompts per brand
  - `ChatAssistant` — AI chat with tool capabilities
- Layout components (`AppLayout`, `Sidebar`)

---

## Backend

| Technology       | Purpose                          |
|------------------|----------------------------------|
| FastAPI          | REST API framework               |
| Uvicorn          | ASGI server                      |
| Python 3.11+     | Runtime                          |
| httpx            | Async HTTP client (external APIs)|
| asyncio          | Async subprocess execution       |
| python-multipart | File upload support              |
| python-dotenv    | Environment variable management  |

### Data Persistence

- **JSON file-based** — No database (Phase 1)
- Brand configs in `backend/data/brands/{id}/brand.json`
- Asset storage in `backend/data/brands/{id}/assets/`
- Context docs in `backend/data/brands/{id}/context/`
- Tool prompts in `backend/data/brands/{id}/context/prompts/`
- Generation history in `backend/data/brands/{id}/generations/`

### Future (Phase 2-3)
- PostgreSQL for structured data + prompt versioning
- Redis for job queue management
- S3-compatible storage (Cloudflare R2 / AWS S3)
- Vector database (Pinecone / Weaviate) for semantic search

---

## AI Services

| Service            | Model/API        | Purpose                          |
|--------------------|------------------|----------------------------------|
| Gemini             | 2.5 Flash        | Prompt generation, brief interpretation, script writing, image curation (Vision) |
| Nano Banana        | Nano Banana 2    | Image generation & editing       |
| Kling              | Latest           | Video generation (B-roll, scenes)|
| ElevenLabs         | Multilingual V2  | Text-to-speech, voice cloning    |
| HeyGen             | Talking Photos   | Talking photo lip-sync (legacy)  |
| Fal AI             | Fabric 1.0       | Advanced lip-sync from static images |

### AI Service Architecture

**Context-Aware Prompt Generation Flow:**
```
Brand Context + Tool Template + Asset Descriptions
    ↓
Gemini 2.5 Flash
    ↓
Final Prompt (optimized for target service)
    ↓
Nano Banana 2 / Kling / etc.
```

---

## Tools System

### Tool Categories

1. **Static Content Generation**
   - Service: Nano Banana 2
   - Inputs: Avatar, product, clothing (optional), background (optional)
   - Output: High-quality static images for ads/posts

2. **Video Reels**
   - Services: Kling + FFmpeg
   - Inputs: Avatar, product, scene description
   - Output: Short-form vertical video content

3. **UGC Videos**
   - Services: Gemini → Nano Banana → ElevenLabs → Fal Fabric → FFmpeg
   - Pipeline: Script → Multishot → Curation → Audio → Lip-sync → Render
   - Output: Talking-head UGC video

4. **Custom Tools** (Future)
   - Background removal, style transfer, batch processing, etc.

### Tool Execution Model

- Tools registered in `backend/tools/registry.json`
- Each tool has `config.json` defining parameters
- Execution via async FastAPI endpoints
- Job tracking in-memory (future: Redis queue)
- Results cached per brand/generation

---

## Development

| Tool             | Purpose                          |
|------------------|----------------------------------|
| VS Code          | Code editor                      |
| Claude Code      | AI development assistant         |
| Git + GitHub     | Version control                  |
| npm              | Frontend package management      |
| pip / venv       | Backend package management       |

---

## Environment Variables

All API keys stored in `backend/.env`:

| Variable              | Service         |
|-----------------------|-----------------|
| `GEMINI_API_KEY`      | Gemini          |
| `NANO_BANANA_API_KEY` | Nano Banana 2   |
| `ELEVENLABS_API_KEY`  | ElevenLabs      |
| `HEYGEN_API_KEY`      | HeyGen          |
| `FAL_KEY`             | Fal AI (Fabric) |
| `KLING_API_KEY`       | Kling           |

---

## Running Locally

### Frontend
```bash
cd frontend
npm install
npm run dev          # → http://localhost:5173
```

### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
source .venv/bin/activate # macOS/Linux
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

---

## Asset Management

### Supported Asset Types

1. **Avatars/Characters**
   - Format: PNG, JPG (recommended: PNG with transparency)
   - Metadata: Description, tags, style notes
   - Used for: All content generation tools

2. **Products**
   - Format: PNG (transparent background preferred)
   - Metadata: Product name, category
   - Used for: Product placement in scenes

3. **Clothing/Wardrobe**
   - Format: PNG, JPG
   - Metadata: Description, style, color
   - Used for: Avatar wardrobe customization

4. **Backgrounds/Scenes**
   - Format: PNG, JPG
   - Metadata: Scene type, mood, lighting
   - Used for: Scene composition, optional backgrounds

### Asset Upload Flow

```
User uploads asset via Brand Workspace
    ↓
Backend stores in /data/brands/{id}/assets/{type}/
    ↓
User adds description & tags
    ↓
Metadata saved to asset_metadata.json
    ↓
Asset available in all tools for that brand
```

---

## Prompt Management System

### Structure

- **Default Prompts**: Shipped with each tool (`backend/tools/{tool_id}/default_prompt.txt`)
- **Brand Overrides**: Stored per brand (`backend/data/brands/{id}/context/prompts/{tool_id}.txt`)
- **Template Variables**: `{brand_name}`, `{avatar_description}`, `{product_name}`, etc.

### Prompt Editor UI

Located at `/dashboard/brands/{id}/prompts`:
- List all tools with prompts
- Edit prompt templates with syntax highlighting
- Preview variables that will be interpolated
- Reset to default option

---

## Chat Assistant Integration

### Architecture

```
User message in chat
    ↓
Intent detection (Gemini)
    ↓
Identify tool(s) needed
    ↓
Load brand context
    ↓
Execute tool(s) with context
    ↓
Return results + conversational response
```

### Capabilities

- Natural language tool invocation
- Multi-tool orchestration
- Asset recommendations
- Brief interpretation
- Campaign ideation

---

## Future Enhancements

| Area               | Technology Options          |
|--------------------|-----------------------------|
| Authentication     | Clerk / Supabase Auth       |
| Database           | PostgreSQL (Supabase/Neon)  |
| Job Queue          | Redis + Celery / BullMQ     |
| Storage            | Cloudflare R2 / AWS S3      |
| Real-time Updates  | WebSocket / Server-Sent Events |
| Analytics          | PostHog / Mixpanel          |
| Monitoring         | Sentry / Datadog            |
| Deployment         | Vercel (FE) + Railway (BE)  |
| CDN                | Cloudflare                  |
| Vector Search      | Pinecone / Weaviate         |
