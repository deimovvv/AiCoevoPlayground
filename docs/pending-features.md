# Coevo Studio — Pending Features

Features discussed and planned but not yet implemented.

---

## 1. Generation Persistence (requires PostgreSQL)

**Problem:** Currently generations save only the final result (title, thumbnail, video URL, scripts). The full pipeline state (base image, multishot variations, curation selections, audio files, prompts used) is lost when you leave the page.

**What needs to happen:**
- Save complete pipeline state per generation (every step result)
- Store audio files (ElevenLabs) locally or in R2
- Store intermediate images (base image, multishot variations)
- Save curation selections, config used, prompt overrides
- Allow re-opening a generation and resuming/editing from any step
- Delete files from disk when deleting a generation from UI

**When:** After PostgreSQL migration (Phase 6 in planning.md)

---

## 2. UGC Pipeline Fixes

- Multishot step sometimes shows "error" even when images generated (visual bug — step stays red)
- Subtitles with Remotion renderer not connected to download (only preview)
- Video download from Content page needs full URL resolution
- Lipsync: all 4 scenes sometimes get same audio (scene ID mismatch)

---

## 3. Content Page Improvements

- View all generations (not just last one) — verify save works for every run
- Download individual assets (images, audio, video per scene)
- Re-run a generation from Content page (load config + pipeline state)
- Batch download all assets as ZIP
- Filter by date, tool, status

---

## 4. Storage & Deploy

- Storage abstraction (Local → Cloudflare R2)
- PostgreSQL in Docker (replace JSON files)
- Alembic migrations
- Basic auth (Clerk or shared password)
- Deploy: Vercel (frontend) + Render (backend)

---

## 5. Remotion Renderer for Download

- Currently: FFmpeg burns simple subtitles, Remotion only for preview
- Goal: Remotion renderer exports video with animated subtitles for download
- Requires: Chromium on server (local OK, deploy needs Lambda or dedicated server)
- Workaround for deploy: Remotion Lambda (AWS)

---

## 6. Ad Research Tool

- Meta Ad Library API integration
- Scrape competitor ads by keyword/brand
- "Use as inspiration" → launch pipeline with ad as style reference
- TikTok Creative Center integration (scraping)

---

## 7. Platform Integrations

- Meta Graph API for Instagram/Facebook publish (requires app approval)
- TikTok Content Posting API
- Performance tracking (pull analytics from platforms)
- OAuth flow for brand authorization

---

## 8. UX Improvements

- Brand context URL scraper needs better filtering (currently scrapes UI junk)
- Auto-describe existing products/avatars (re-analyze button)
- Prompt versioning (track changes to tool prompts over time)
- Keyboard shortcuts in pipeline (Enter to approve, R to regenerate)
