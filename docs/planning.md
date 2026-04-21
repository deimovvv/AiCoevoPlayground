# Coevo Studio — Development Planning

---

## Phase 1 — Internal MVP (Complete)

**Goal**: Working system to generate UGC videos for one brand.

- Brand management (create, configure, delete)
- ElevenLabs TTS integration
- HeyGen Talking Photo lip-sync (legacy)
- Multi-segment generation pipeline
- Brand workspace with avatars and voice presets

---

## Phase 2 — Multi-Brand + Dashboard (Complete)

**Goal**: Support multiple brands with proper dashboard.

- Dashboard with brand cards and CRUD
- Brand configuration (context, assets, voices, prompts)
- Voice presets per brand with preview + upload custom voice IDs
- Product, clothing, background asset upload
- Dark editorial design system
- Brand guidance from URL scraping and PDF upload

---

## Phase 3 — Tools System + Context Architecture (Complete)

**Goal**: Modular creative tools with context-aware prompt system.

- Tools registry (`registry.json` + prompt templates)
- PromptBuilder 3-layer system (default → brand override → dynamic vars)
- AI Chat with Gemini, brand context, asset chips
- Brand switcher in sidebar
- Tool-specific form schemas (different inputs per tool)

---

## Phase 4 — Full Pipeline Integration (Complete)

**Goal**: All AI services wired end-to-end, full tool suite.

- Gemini 2.5 Flash: script generation, video analysis, prompt assembly
- Nano Banana 2: image generation with multi-reference (avatar + clothing + product + background + moodboard)
- ElevenLabs: TTS with custom voice IDs per brand
- HeyGen Avatar 4 (via Fal): lip-sync video from image + audio
- FFmpeg: video concatenation + word-by-word subtitles
- Human-in-the-loop: script review, base image review, manual curation
- Content Analyzer: video analysis + adapt + route pipeline
- Brand DNA: AI-extracted identity from URL/PDF
- Moodboards: visual style references per brand (up to 5, one active per tool)
- Sandbox brand: always-available workspace for quick generation
- Prompt templates grouped by tool category in BrandSettings

**Current tools**:

| Tool | Category | Status |
|------|----------|--------|
| UGC Creator | Video | Active (6-step pipeline) |
| Video Ad Creator | Video | Active (6-step pipeline) |
| Fashion Reel | Video | Active (5-step, Story + Looks modes) |
| Product Clip | Video | Active |
| Content Analyzer | Images → Routes | Active |
| Static Ad | Images | Active |
| Carousel Creator | Images | Active |
| Ad Creative Lab | Images | Active |
| Product Spotlight | Images | Active |
| Fashion Editorial | Images | Active |
| Avatar Creator | Images | Active |
| Reel Creator | Video | Coming Soon |
| Background Remover | Images | Coming Soon |

---

## Phase 5 — Polish + Deploy (Next)

**Goal**: Production-ready for internal team use.

**TODO**:
- End-to-end pipeline test across all active tools
- Content page: download, preview, delete generations
- Storage abstraction (Local → Cloudflare R2 or S3) for deploy
- Basic auth (Clerk or shared password) for team access
- Deploy: Vercel (frontend) + Render/Railway (backend)
- Clean up error handling and retry UX
- Design system fields in brand kit (color palette, typography, photo style, voice/tone rules)

---

## Phase 6 — Database + Scale

**Goal**: Handle multiple brands, many generations, team collaboration.

- PostgreSQL in Docker (replace JSON files)
- Alembic migrations
- Redis job queues for background processing
- Batch generation (multiple videos at once)
- Generation search/filter/pagination
- Usage analytics per brand

---

## Phase 7 — Client Dashboard + Automation

**Goal**: Allow brands to self-serve, reduce manual intervention.

- Authentication per user/brand (Clerk or Supabase Auth)
- Brand-specific dashboards
- Auto-select assets from brand context
- WebSocket real-time job updates
- Semi-autonomous content factory
- Platform integrations (Meta, TikTok publish)
