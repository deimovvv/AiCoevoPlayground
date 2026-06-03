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
| Carousel Creator | Images | Active |
| Product Spotlight | Images | Active |
| Avatar Sheet (was "Avatar Creator") | Images | Active (`create` + `poses` modes) |
| Product Sheet | Images | Active (`sheet` + `details` modes — multi-view from 1-4 photos) |
| Ecommerce Pack | Images | Active |
| Fashion Editorial | Images | Active (model + clothing + look&feel recipe → variants) |
| Ecommerce Batch | Images | **Prototype** — UI ready at `/dashboard/ecommerce-batch`, generation not wired yet |
| Video Swap | Video | Active |
| Voice Lab | Experimental | **Hidden from nav** — accessible by URL at `/dashboard/voice-lab` |
| Static Ad | Images | Degraded — hidden in Generate (files/prompts kept; statics now done in Manual Lab) |
| Ad Creative Lab | Images | Degraded — hidden in Generate (files/prompts kept; overlaps Static Ad) |
| Reel Creator | Video | Coming Soon |
| Background Remover | Images | Coming Soon |

**Rename history.** `Avatar Creator` → `Avatar Sheet` (display only — id `avatar_creator` kept for backwards compat with persisted generations).

**Fashion Editorial** se construyó en 2026-06 tras estar marcada como "removed" en una versión anterior de este doc. Tiene presets de framing / lighting / vibe y usa Look & Feel en modo receta.

**Voice Lab** (browser STT → Gemini → ElevenLabs → autoplay) se construyó como experimento y se ocultó del nav. Ver `decisions-log.md` 2026-06 para el racional.

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

**DB migration path** (staged — don't jump straight to Postgres):
1. **SQLite + SQLModel** first. Single file, real transactions (fixes the JSON race condition where two concurrent saves overwrite each other and lose generations), proper queries. Small step up from the current JSON layer, zero ops.
2. **Postgres** (managed — Supabase or Neon) once there's login / multi-user. Scales, and Supabase ships auth + Row Level Security for the Client Portal.

- Alembic migrations
- Generation data model: `generation → step → asset` (full provenance per AI image). See [pending-features.md](pending-features.md) #1.
- Media persistence: download Fal outputs to our own storage (disk → R2/S3), store the storage key in the DB instead of the third-party URL. See [pending-features.md](pending-features.md) #1.
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
