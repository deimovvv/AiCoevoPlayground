# Coevo Studio — Architecture

## Overview

Coevo Studio is an internal agency platform for AI-powered content creation. Brands onboard once with assets (avatars, products, clothing, backgrounds, moodboards, voices, logo), and all tools inherit that brand context automatically.

## System Architecture

```
Browser (React 19 + Vite 8)
  |
  | HTTP (REST API)
  |
FastAPI (Python 3.11+)
  |
  |--- Gemini 2.5 Flash (scripts, prompts, Brand DNA, video analysis)
  |--- Nano Banana 2 via Fal (image generation/editing)
  |--- Kling via Fal (video animation, frame-to-frame)
  |--- HeyGen Avatar 4 via Fal (lip-sync from image + audio)
  |--- ElevenLabs v3 (text-to-speech, voice cloning)
  |--- FFmpeg (video concatenation, subtitles)
```

## Data Persistence (Phase 1 — JSON)

```
backend/data/
  brands.json           # All brands with assets, DNA, config (Sandbox never persisted)
  generations.json      # Content library entries
  avatars/              # Avatar image files
  products/             # Product image files (main + up to 2 extras per product)
  clothing/             # Clothing image files
  backgrounds/          # Background image files
  moodboards/           # Moodboard image files (up to 5 per brand)
  logos/                # Brand logo files
  renders/              # Generated video outputs
```

## Frontend Structure

```
frontend/src/
  pages/
    ToolRunPage.tsx            # Pipeline orchestrator — all tool pipelines
    BrandSettings.tsx          # Brand config: assets, DNA, prompts, voices, moodboards
    GeneratePage.tsx            # Tool launcher with hover previews
    ContentPage.tsx            # Content library
    Dashboard.tsx              # Brand list
    ...
  components/
    ImageEditPanel.tsx         # Reusable: product picker + quick actions + prompt
    ChatPanel.tsx              # AI chat with brand context
    PromptsCard.tsx            # Prompt templates grouped by tool category
    layout/                    # AppLayout, Sidebar, BrandSwitcher
    ui/                        # Primitives
  tools/                    # Modular tool definitions (1 dir per tool)
    registry.ts                # toolId -> ToolDefinition
    types.ts                   # StepHandler, ToolConfig, ScriptScene, etc.
    ugc_creator/               # Handlers + views
    video_ad_creator/
    fashion_reel/
    product_clip/
    content_analyzer/
    static_ad/                # degraded (hidden in Generate; files kept)
    carousel_creator/
    ad_creative_lab/          # degraded (hidden in Generate; files kept)
    product_spotlight/
    avatar_creator/
    ecommerce_pack/
    shared/
  remotion/                 # Video preview
    SubtitleOverlay.tsx        # Word-by-word karaoke
    UGCComposition.tsx
    UGCPlayer.tsx
  lib/
    api.ts                     # All API call functions + types
    BrandContext.tsx            # Global brand state
```

## Backend Structure

```
backend/
  main.py                  # FastAPI: endpoints + response normalizer
  services/
    copy_gen.py              # Gemini (scripts, prompts, DNA)
    prompt_builder.py        # 3-layer prompt assembly
    image_gen.py             # Nano Banana 2
    image_analysis.py        # Gemini Vision (video + image analysis)
    kling_video.py           # Kling image-to-video
    heygen_avatar4.py        # HeyGen Avatar 4 lip-sync
    tts.py                   # ElevenLabs v3
    fal_lipsync.py           # Fal Fabric lip-sync (alternative)
    video_concat.py          # FFmpeg
    brands.py                # Brand CRUD + Sandbox injection
    chat.py                  # Gemini chat
  tools/                   # Active tool directories
    registry.json            # Tool definitions (11 active, 2 coming_soon)
    ugc_creator/             # default_prompt.txt
    video_ad_creator/
    fashion_reel/
    product_clip/
    content_analyzer/
    static_ad/               # default_prompt.txt + templates.json (40 templates) — degraded (hidden)
    carousel_creator/        # default_prompt.txt + carousel_types.json (8 types)
    ad_creative_lab/         # degraded (hidden)
    product_spotlight/
    avatar_creator/
    ecommerce_pack/
    video_swap/
```

## Key Patterns

### PromptBuilder (3-Layer)
```
Layer 1: Tool Default     ->  tools/{tool_id}/default_prompt.txt
Layer 2: Brand Override   ->  brand.promptOverrides[tool_id]
Layer 3: Dynamic Vars     ->  {brand_name}, {brand_guidance}, {avatars}, etc.
```

### Sandbox Brand
Auto-created on every `load_brands()` call, never persisted to JSON. Always available as `id: "__sandbox__"`. Allows quick generation without setting up a client brand. Shown separately in the BrandSwitcher with a flask icon.

### Moodboards
Up to 5 visual style reference images per brand. One can be active per tool run (`selectedMoodboardId` in ToolConfig). Passed to Nano Banana as the last reference image with the label: *"visual style moodboard — replicate this aesthetic, color palette, lighting, and mood"*.

### Response Normalizer
Backend normalizes Gemini's inconsistent field names before sending to frontend:
- `audio/speech/voiceover/dialogue/action` → `script`
- `visuals/visual/setting/scene_description` → `image_prompt`
- Cleans prefixes like `AVATAR:`, `OFF-CAMERA:`
- Auto-fixes truncated JSON arrays

### ImageEditPanel (Shared Component)
Reusable across all tools for editing generated images:
- Quick actions: Fix Product, Fix Clothing, Warmer Light, Show Product
- Product image picker with auto-selection
- Free-form prompt input
- Used in: UGC, Static Ad, Carousel, Ad Creative Lab, Video Ad Creator

### Content Analyzer Handoff
After adapt step, user selects destination tool. Data transferred via `sessionStorage`:
- `adaptData` (scenes with script + imagePrompt)
- `analyzeData` (content_type, style_guide, key_insights)
- `contentMode` ("visual" or "voiceover")
- All asset IDs: `selectedAvatarIds`, `selectedProductIds`, `selectedClothingIds`, `selectedBackgroundId`, `selectedMoodboardId`

### Async Job Pattern (Fal services)
```
POST submit -> request_id
poll status -> IN_QUEUE | IN_PROGRESS | COMPLETED
GET result -> final URL
```

### Media Downloads (centralized)
Every "download" action in the app goes through one helper — `frontend/src/lib/download.ts` → `downloadFile(url, filename)` — which hits the backend proxy `GET /api/download?url=&filename=`.

Why a proxy: Fal CDN URLs are cross-origin and send no `Content-Disposition`, so a plain `<a download>` is ignored and the file **opens in a new tab instead of saving**; a client-side `fetch()` is blocked by CORS. The proxy fetches server-side (no CORS) and streams the file back as an attachment (RFC 5987 `filename*` so accents/spaces survive). `blob:`/`data:` URLs download directly (same-origin) and skip the proxy. Allowed hosts are whitelisted in `ALLOWED_DOWNLOAD_HOSTS` (Fal, Google Storage, localhost).

In Manual Lab the output inherits the source image's filename: the input ref's `baseName` is propagated through edit / use-as-ref / animate chains.

### Manual Lab (brand-agnostic generation sandbox)
A standalone page (`/dashboard/lab`) that bypasses the pipeline/curation system entirely. It lets internal users hit Nano Banana 2 / Kling V3 directly with chat-style references, optionally using brand assets but never requiring a brand.

- Frontend: `frontend/src/pages/ManualLab.tsx`. Maintains references as `RefImage[]` (`tag: "image1"|"image2"|…`, url, source). On submit, `[imageN]` tokens in the prompt are rewritten to `Image N` and a `REFERENCE IMAGES:` block is prepended — same convention used by `fashion_reel/handlers.ts:buildRefDesc`.
- Backend: re-uses existing `/api/image-gen/edit`, `/api/image-gen/text-to-image`, `/api/kling/image-to-video`. Two new pieces:
  - `services/manual_lab.py` — Gemini-backed tool suggestion (`suggest_tool`) that decides if the prompt is better served by a structured pipeline.
  - `POST /api/manual/suggest-tool` (body: `{prompt, mode, hasRefs}`) → `{tool_id, reason}`. Non-blocking; returns `{tool_id: null}` on any error.
- Persistence: results are saved as standard `Generation` rows with `toolId="manual_lab"`. `SaveGenerationRequest.brandId` is now `Optional[str]`. The list endpoint accepts `brandId=__none__` to fetch only Manual Lab (brand-agnostic) entries.

## Brand Data Model

```json
{
  "id": "string",
  "name": "string",
  "brandContext": "guidance text (from URL scrape, PDF, manual)",
  "dna": {
    "colors": [{ "name": "...", "hex": "#...", "usage": "..." }],
    "tone": [],
    "audience": "",
    "keywords": [],
    "personality": "",
    "competitors": [],
    "unique_value": ""
  },
  "fonts": { "headline": "Google Font", "body": "Google Font" },
  "avatars": [{ "id", "name", "description", "imageUrl" }],
  "products": [{ "id", "name", "description", "imageUrl", "images": [{ "imageUrl", "label" }] }],
  "clothing": [{ "id", "name", "description", "imageUrl" }],
  "backgrounds": [{ "id", "name", "description", "imageUrl" }],
  "moodboards": [{ "id", "name", "description", "imageUrl" }],
  "voicePresets": [{ "id", "name" }],
  "logo": { "filename", "imageUrl" },
  "promptOverrides": { "tool_id": "custom prompt text" }
}
```

Note: Sandbox brand (`id: "__sandbox__"`) always has `"isSandbox": true` and is never written to `brands.json`.

## ToolConfig (Frontend State Per Tool Run)

Key fields in `ToolConfig` (types.ts):
```typescript
selectedAvatarId: string | null
selectedAvatarIds: string[]        // multi-select
selectedProductId: string | null
selectedProductIds: string[]
selectedClothingIds: string[]
selectedBackgroundId: string | null
selectedMoodboardId: string | null  // one active moodboard at a time
selectedVoiceId: string | null
aspectRatio, resolution, language, objective, notes, ...
```
