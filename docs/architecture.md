# Coevo Creative OS — Architecture

**Coevo Creative OS** is an internal agency platform for managing multi-brand advertising and marketing content creation.

The system provides context-aware AI tools that adapt dynamically to each brand's assets, prompts, briefs, and brand guidelines.

---

## System Overview

```
Frontend (React + Vite)
    ↓ HTTP/REST
Backend (FastAPI)
    ├── Brand Context Management
    │   ├── Brand Guidance Documents
    │   ├── Briefs & Campaign Context
    │   └── Dynamic Prompt Library
    ├── Asset Library (per brand)
    │   ├── Avatars/Characters (with descriptions)
    │   ├── Products
    │   ├── Clothing/Wardrobe
    │   └── Backgrounds/Scenes
    ├── Tools System (context-aware)
    │   ├── Static Content Generation
    │   ├── Video Reels
    │   ├── UGC Videos
    │   └── Custom Tools
    ├── AI Chat Assistant
    │   └── Tool orchestration & context retrieval
    └── AI Services
        ├── Gemini 2.5 Flash (prompt gen, brief interpretation, scripts)
        ├── Nano Banana 2 (image generation/editing)
        ├── Kling (video generation)
        ├── ElevenLabs (TTS / voice cloning)
        └── HeyGen / Fal Fabric 1.0 (talking photo lip-sync)
```

---

## Core Concept: Context-Aware Architecture

**Every tool automatically inherits the selected brand's context.** When working within "Taller Santa Clara", all tools have access to:
- Brand guidance documents
- Campaign briefs
- Asset library (avatars, products, clothing, backgrounds)
- Brand-specific prompt templates
- Voice and visual style presets

This eliminates manual re-configuration and ensures brand consistency across all generated content.

---

## Frontend Architecture

### Pages & Routes

| Route                              | Component            | Purpose                          |
|------------------------------------|----------------------|----------------------------------|
| `/`                                | `Home`               | Landing page                     |
| `/dashboard`                       | `DashboardOverview`  | Agency overview + brand stats    |
| `/dashboard/brands`                | `Dashboard`          | Brand list + CRUD                |
| `/dashboard/brands/:brandId`       | `BrandWorkspace`     | **Brand context hub** (main workspace) |
| `/dashboard/brands/:brandId/assets` | `AssetManager`      | Upload & manage brand assets     |
| `/dashboard/brands/:brandId/prompts` | `PromptEditor`     | Edit tool prompts for this brand |
| `/dashboard/brands/:brandId/tools` | `BrandTools`         | Access tools in brand context    |
| `/dashboard/chat`                  | `ChatAssistant`      | AI chat with tool capabilities   |

### Layout

- `AppLayout` wraps all `/dashboard/*` routes with sidebar + content area
- `Sidebar` shows current brand context at the top when inside a brand workspace
- Brand context badge displays current brand name/logo throughout the workflow

### Key Libraries

- React 19 + React Router 7
- Tailwind CSS v4
- Lucide React (icons)
- Custom design token system (`index.css`)

---

## Backend Architecture

### API Layer (FastAPI)

FastAPI application at `backend/main.py` exposing:

#### Brand Endpoints

| Method | Endpoint                        | Purpose                          |
|--------|---------------------------------|----------------------------------|
| GET    | `/api/brands`                   | List all brands                  |
| POST   | `/api/brands`                   | Create brand                     |
| GET    | `/api/brands/{id}`              | Get brand details + all context  |
| PUT    | `/api/brands/{id}`              | Update brand settings            |
| DELETE | `/api/brands/{id}`              | Delete brand                     |
| GET    | `/api/brands/{id}/context`      | Get full brand context (guidance, briefs) |
| PUT    | `/api/brands/{id}/context`      | Update brand guidance documents  |

#### Asset Management Endpoints

| Method | Endpoint                                      | Purpose                          |
|--------|-----------------------------------------------|----------------------------------|
| GET    | `/api/brands/{id}/assets`                     | List all assets for brand        |
| POST   | `/api/brands/{id}/assets/avatars`             | Upload avatar with description   |
| POST   | `/api/brands/{id}/assets/products`            | Upload product image             |
| POST   | `/api/brands/{id}/assets/clothing`            | Upload clothing/wardrobe item    |
| POST   | `/api/brands/{id}/assets/backgrounds`         | Upload background/scene          |
| PUT    | `/api/brands/{id}/assets/{type}/{asset_id}`   | Update asset metadata            |
| DELETE | `/api/brands/{id}/assets/{type}/{asset_id}`   | Delete asset                     |

#### Prompt Management Endpoints

| Method | Endpoint                                      | Purpose                          |
|--------|-----------------------------------------------|----------------------------------|
| GET    | `/api/brands/{id}/prompts`                    | List all tool prompts for brand  |
| GET    | `/api/brands/{id}/prompts/{tool_id}`          | Get prompt template for tool     |
| PUT    | `/api/brands/{id}/prompts/{tool_id}`          | Update prompt template           |
| POST   | `/api/brands/{id}/prompts/{tool_id}/reset`    | Reset to default prompt          |

#### Tool Execution Endpoints

| Method | Endpoint                                      | Purpose                          |
|--------|-----------------------------------------------|----------------------------------|
| GET    | `/api/tools`                                  | List all available tools         |
| GET    | `/api/tools/{tool_id}`                        | Get tool configuration           |
| POST   | `/api/brands/{brand_id}/tools/{tool_id}/run`  | Execute tool with brand context  |
| GET    | `/api/jobs/{job_id}`                          | Check job status & results       |

#### AI Chat Endpoints

| Method | Endpoint                                      | Purpose                          |
|--------|-----------------------------------------------|----------------------------------|
| POST   | `/api/chat`                                   | Send message to AI assistant     |
| POST   | `/api/chat/brands/{brand_id}`                 | Chat with brand context          |
| GET    | `/api/chat/sessions`                          | List chat sessions               |

---

## Data Persistence

### Brand Context Storage

```
backend/data/brands/{brand-id}/
├── brand.json                  ← Core brand config
├── context/
│   ├── brand_guidance.md       ← Brand guidelines document
│   ├── briefs/                 ← Campaign briefs
│   │   ├── brief_2024_q1.md
│   │   └── brief_2024_q2.md
│   └── prompts/                ← Tool-specific prompt overrides
│       ├── ugc_video.txt
│       ├── static_content.txt
│       └── video_reels.txt
├── assets/
│   ├── avatars/                ← Avatar images
│   │   ├── avatar_001.png
│   │   └── avatar_001.json     ← Metadata: description, tags
│   ├── products/               ← Product images
│   ├── clothing/               ← Wardrobe items
│   └── backgrounds/            ← Scene backgrounds
└── generations/                ← Generated content history
    └── gen_abc123/
        ├── metadata.json
        ├── outputs/
        └── logs/
```

### Brand Data Structure

```json
{
  "id": "taller-santa-clara",
  "name": "Taller Santa Clara",
  "brandContext": "Marca de ropa artesanal argentina...",
  "assets": {
    "avatars": [
      {
        "id": "avatar_001",
        "filename": "avatar_001.png",
        "description": "Modelo masculino 30 años, estilo casual urbano",
        "tags": ["masculino", "casual", "30s"],
        "imageUrl": "/static/brands/taller-santa-clara/avatars/avatar_001.png"
      }
    ],
    "products": [...],
    "clothing": [...],
    "backgrounds": [...]
  },
  "voicePresets": [...],
  "defaultPrompts": {
    "ugc_video": "custom override or null for default",
    "static_content": null,
    "video_reels": "custom override..."
  }
}
```

---

## Tools System Architecture

### Tool Types

1. **Static Content Generation** (Nano Banana 2)
   - Inputs: Avatar, product, background (optional), clothing (optional)
   - Output: High-quality static images for ads/posts

2. **Video Reels** (Kling + composition)
   - Inputs: Avatar, product, scene description
   - Output: Short-form video content

3. **UGC Videos** (Full pipeline: Gemini → Nano Banana → Fabric → FFmpeg)
   - Inputs: Avatar, clothing (optional), product, background (optional)
   - Phases: Script → Multishot → Curation → Audio → Lip-sync → Render
   - Output: Talking-head UGC video

### Tool Execution Flow

```
User selects tool within Brand Workspace
    ↓
Tool UI presents dynamic form:
    - Avatar selector (from brand's avatars)
    - Product selector (from brand's products)
    - Clothing selector (optional, from brand's wardrobe)
    - Background selector (optional, from brand's backgrounds)
    ↓
Backend loads brand context:
    - Brand guidance
    - Tool-specific prompt template (or default)
    - Selected assets
    ↓
Gemini generates final prompt using:
    - Tool prompt template
    - Brand context
    - Asset descriptions
    - User parameters
    ↓
Execute tool with generated prompt
    ↓
Return job ID → frontend polls for results
```

### Dynamic Prompt Generation

Instead of hardcoded prompts, each tool uses a **template + brand context** approach:

**Example: UGC Video Tool Prompt Template**
```
You are creating a UGC video for {brand_name}.

Brand Context:
{brand_guidance}

Available Assets:
- Avatar: {avatar_description}
- Product: {product_name}
- Clothing: {clothing_description}
- Background: {background_description}

Campaign Brief:
{active_brief}

Generate a 5-act script following the Morfeo structure...
```

---

## AI Chat Assistant

### Purpose
- Natural language interface for tool execution
- Can reference and orchestrate multiple tools
- Understands brand context automatically

### Example Interactions

**User**: "Crea un reel para el nuevo buzo de Taller Santa Clara"

**Assistant**:
1. Detects brand context (Taller Santa Clara)
2. Loads brand guidance + product catalog
3. Identifies "Video Reels" tool
4. Asks: "¿Qué avatar quieres usar?" (shows avatars)
5. Executes tool with context
6. Returns result with preview

---

## Generation Pipeline (UGC Videos)

Enhanced Morfeo pipeline with brand context:

1. **Script Generation** (Gemini 2.5)
   - Uses brand guidance + brief + product info
   - Generates 5-act structure

2. **Multishot Image Generation** (Nano Banana 2)
   - For each scene: generate 3+ variations
   - Uses avatar description + clothing + product + background
   - Dynamic composition based on brand style

3. **AI Curation** (Gemini Vision)
   - Analyzes all shots
   - Selects best option per scene
   - Human review checkpoint

4. **Audio Generation** (ElevenLabs)
   - Uses brand's voice presets
   - Generates audio per scene

5. **Lip-sync Animation** (Fal Fabric 1.0)
   - Takes curated static image + audio
   - Generates talking video

6. **Final Render** (FFmpeg)
   - Combines all scenes
   - Adds transitions/effects

---

## Environment Variables

| Variable              | Service         |
|-----------------------|-----------------|
| `GEMINI_API_KEY`      | Gemini          |
| `NANO_BANANA_API_KEY` | Nano Banana 2   |
| `ELEVENLABS_API_KEY`  | ElevenLabs      |
| `HEYGEN_API_KEY`      | HeyGen          |
| `FAL_KEY`             | Fal AI (Fabric) |
| `KLING_API_KEY`       | Kling           |

---

## Scalability Strategy

### Current (Phase 1)
- Single-process FastAPI
- JSON file-based storage
- In-memory job tracking

### Future (Phase 2-3)
- Redis queue for job management
- Celery workers for parallel execution
- S3-compatible storage for media
- PostgreSQL for structured data + prompt versioning
- WebSocket for real-time updates
- Vector database for semantic search of briefs/assets
