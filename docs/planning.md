# Morph — Development Planning

Development follows a phased approach. The goal is to build a working internal creative OS first, then evolve into a client-facing product.

---

## Phase 1 — Internal MVP ✅ (Complete)

**Goal**: Create a working system to generate UGC videos for one brand.

**Delivered**:
- Brand management (create, configure, delete)
- Script input and multi-segment splitting
- ElevenLabs TTS integration
- HeyGen Talking Photo lip-sync
- Multi-segment generation pipeline with QA checkpoints
- Brand workspace with avatars and voice presets

**Example brand**: Taller Santa Clara

---

## Phase 2 — Multi-Brand + Dashboard ✅ (Complete)

**Goal**: Support multiple brands with a proper dashboard structure.

**Delivered**:
- Dashboard overview with stats (Brands, Tools, Avatars)
- Separate Brands page with full CRUD
- Brand configuration panel
- Voice presets per brand
- HeyGen avatar sync per brand
- Brand DNA (AI-generated brand context via OpenAI)
- Dark editorial design system with warm burgundy accent

---

## Phase 3 — Tools System ✅ (In Progress)

**Goal**: Modular creative tools beyond video generation.

**Delivered**:
- Tools backend architecture (registry, configs, job execution)
- Tools API endpoints (list, config, run, status)
- Frontend Tools page with category filtering (Images/Video)
- Dynamic form generation from config.json
- Collapsible Tools sidebar navigation

**Current tools**:
| Tool               | Category | Status       |
|--------------------|----------|--------------|
| Photo → Multi-Shot | Images   | Active       |
| Background Remover | Images   | Coming Soon  |
| Clip Generator     | Video    | Coming Soon  |

**TODO**:
- Implement `run.py` scripts for each tool
- Job status polling on frontend
- Result display (image galleries, video previews)

---

## Phase 4 — Batch Video Generation

**Goal**: Generate multiple videos at once.

**Features**:
- Script tables with batch upload
- Batch execution with progress tracking
- Error handling and retry
- Weekly production workflow automation

**Target**: 24+ videos per month per brand

---

## Phase 5 — Client Dashboard

**Goal**: Allow brands to self-serve.

**Features**:
- Authentication (Clerk or Supabase Auth)
- Brand-specific dashboard
- Script upload and management
- Video library with downloads
- Usage analytics

---

## Phase 6 — Automation & Scaling

**Goal**: Reduce manual intervention and handle volume.

**Features**:
- AI script generation from Brand DNA
- Auto-select avatars and styles
- Redis queue workers for parallel processing
- S3 storage for media assets
- PostgreSQL for structured data
- WebSocket real-time job updates

**Deliverable**: Semi-autonomous UGC video factory.