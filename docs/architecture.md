# Coevo Studio — Architecture

## Overview

Coevo Studio is an internal agency platform for AI-powered content creation. Brands onboard once with assets (avatars, products, clothing, backgrounds, voices, logo), and all tools inherit that brand context automatically.

## System Architecture

```
Browser (React 19 + Vite 8)
  |
  | HTTP (REST API)
  |
FastAPI (Python 3.11+)
  |
  |--- Gemini 2.5 Flash (scripts, prompts, Brand DNA, analysis)
  |--- Nano Banana 2 via Fal (image generation/editing)
  |--- Kling V3 Pro via Fal (video animation, frame-to-frame)
  |--- HeyGen Avatar 4 via Fal (lip-sync from image + audio)
  |--- ElevenLabs v3 (text-to-speech, voice cloning)
  |--- FFmpeg (video concatenation, subtitles)
```

## Data Persistence (Phase 1 — JSON)

```
backend/data/
  brands.json           # All brands with assets, DNA, config
  generations.json      # Content library entries
  avatars/              # Avatar image files
  products/             # Product image files (main + up to 2 extras per product)
  clothing/             # Clothing image files
  backgrounds/          # Background image files
  renders/              # Generated video outputs
```

## Frontend Structure

```
frontend/src/
  pages/                    # 15 route-level components
    ToolRunPage.tsx            # Pipeline orchestrator (5700+ lines)
    BrandSettings.tsx          # Brand config: assets, DNA, prompts, voices
    GeneratePage.tsx            # Tool launcher with hover previews
    ContentPage.tsx            # Content library
    Dashboard.tsx              # Brand list
    ...
  components/
    ImageEditPanel.tsx         # Reusable: product picker + quick actions + prompt
    ChatPanel.tsx              # AI chat with brand context
    layout/                    # AppLayout, Sidebar, BrandSwitcher
    ui/                        # Primitives
  tools/                    # Modular tool definitions (1 dir per tool)
    registry.ts                # toolId -> ToolDefinition
    types.ts                   # StepHandler, ToolConfig, ScriptScene, etc.
    ugc_creator/               # Handlers + views
    video_ad_creator/
    static_ad/
    carousel_creator/
    ad_creative_lab/
    content_analyzer/
    product_clip/
    product_spotlight/
    fashion_editorial/
    fashion_reels/
    shared/
  remotion/                 # Video preview
    SubtitleOverlay.tsx        # Word-by-word karaoke
    UGCComposition.tsx
    UGCPlayer.tsx
  lib/
    api.ts                     # 78 API call functions
    BrandContext.tsx            # Global brand state
```

## Backend Structure

```
backend/
  main.py                  # FastAPI: 78 endpoints + response normalizer
  services/                # 11 service modules
    copy_gen.py              # Gemini (scripts, prompts, DNA)
    prompt_builder.py        # 3-layer prompt assembly
    image_gen.py             # Nano Banana 2
    image_analysis.py        # Gemini Vision
    kling_video.py           # Kling V3 Pro
    heygen_avatar4.py        # HeyGen Avatar 4
    tts.py                   # ElevenLabs v3
    fal_lipsync.py           # Fal Fabric lip-sync
    video_concat.py          # FFmpeg
    brands.py                # Brand CRUD
    chat.py                  # Gemini chat
  tools/                   # 15 tool directories
    registry.json            # Tool definitions
    ugc_creator/             # default_prompt.txt
    static_ad/               # default_prompt.txt + templates.json (40 templates)
    carousel_creator/        # default_prompt.txt + carousel_types.json (8 types)
    ...
```

## Key Patterns

### PromptBuilder (3-Layer)
```
Layer 1: Tool Default     ->  tools/{tool_id}/default_prompt.txt
Layer 2: Brand Override   ->  brand.promptOverrides[tool_id]
Layer 3: Dynamic Vars     ->  {brand_name}, {brand_guidance}, {avatars}, etc.
```

### Response Normalizer
Backend normalizes Gemini's inconsistent field names before sending to frontend:
- `audio/speech/voiceover/dialogue/action` -> `script`
- `visuals/visual/setting/scene_description` -> `image_prompt`
- Cleans prefixes like `AVATAR:`, `OFF-CAMERA:`
- Auto-fixes truncated JSON arrays

### ImageEditPanel (Shared Component)
Reusable across all tools for editing generated images:
- Quick actions: Fix Product, Fix Clothing, Warmer Light, Show Product
- Product image picker with auto-selection
- Free-form prompt input
- Used in: UGC, Static Ad, Carousel, Ad Creative Lab, Video Ad Creator

### Async Job Pattern
```
POST submit -> request_id
poll status -> IN_QUEUE | IN_PROGRESS | COMPLETED
GET result -> final URL
```

### Brand DNA
AI-extracted structured identity: colors (with hex), tone, audience, keywords, personality, competitors, unique value, suggested fonts. Generated from brand guidance (URL/PDF) via Gemini.

## Brand Data Model

```json
{
  "id": "string",
  "name": "string",
  "brandContext": "guidance text (from URL scrape, PDF, manual)",
  "dna": { "colors": [], "tone": [], "audience": "", "keywords": [], "personality": "", "competitors": [], "unique_value": "" },
  "fonts": { "headline": "Google Font", "body": "Google Font" },
  "avatars": [{ "id", "name", "description", "imageUrl" }],
  "products": [{ "id", "name", "description", "imageUrl", "images": [{ "imageUrl", "label" }] }],
  "clothing": [{ "id", "name", "description", "imageUrl" }],
  "backgrounds": [{ "id", "name", "description", "imageUrl" }],
  "voicePresets": [{ "id", "name" }],
  "logo": { "filename", "imageUrl" },
  "promptOverrides": { "tool_id": "custom prompt text" }
}
```
