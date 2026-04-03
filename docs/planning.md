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
- 9 registered tools (6 active, 3 coming soon)
- PromptBuilder 3-layer system (default → brand override → dynamic vars)
- AI Chat with Gemini, brand context, asset chips
- Brand switcher in sidebar
- Tool-specific form schemas (different inputs per tool)

---

## Phase 4 — Full Pipeline Integration (Complete)

**Goal**: All AI services wired end-to-end.

- Gemini 2.5 Flash: script generation with brand-aware prompts
- Nano Banana 2: image generation with multi-reference (avatar + clothing + product + background)
- ElevenLabs: TTS with custom voice IDs per brand
- HeyGen Avatar 4 (via Fal): lip-sync video from image + audio
- FFmpeg: video concatenation + word-by-word subtitles
- Human-in-the-loop: script review, base image review, test video, manual curation
- Inline asset upload from pipeline form (clothing, backgrounds)
- Audio generation + Fal Storage upload via backend endpoint
- Content library with real generations

**Current tools**:

| Tool | Category | Status |
|------|----------|--------|
| UGC Creator | Video | Active (8-step pipeline) |
| Product Spotlight | Images | Active |
| Fashion Editorial | Images | Active |
| Fashion Reels | Video | Active |
| Product Photos | Images | Active |
| Ad Creative | Images | Active |
| Social Post | Copy | Active |
| Reel Creator | Video | Coming Soon |
| Background Remover | Images | Coming Soon |

---

## Phase 5 — Polish + Deploy (Next)

**Goal**: Production-ready for internal team use.

**TODO**:
- End-to-end UGC pipeline test (script → render with real video output)
- Content page: download, preview, delete generations
- Storage abstraction (Local → Cloudflare R2) for deploy
- Basic auth (Clerk or shared password) for team access
- Deploy: Vercel (frontend) + Render (backend)
- Clean up error handling and retry UX

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
