# Coevo Studio — Pending Features

Features discussed and planned but not yet implemented.

---

## 1. Generation Persistence

**Problem:** Pipeline state is lost when leaving the page. Only final result saves.

**Need:**
- Save complete pipeline state per generation (every step result)
- Store intermediate images, audio files
- Re-open a generation and resume/edit from any step
- Delete associated files when deleting a generation

---

## 2. Content Calendar Agent

- "Give me 30 days of content for Instagram" -> generates plan with format mix
- Click on any day -> opens the tool with brief pre-loaded
- Grid calendar view (7 cols)

---

## 3. Client Portal

- Separate view for clients (no access to tools)
- Approval workflow: draft -> review -> approved -> published
- Comments per piece
- Requires authentication (Clerk/Auth0)

---

## 4. Deploy & Infrastructure

- Vercel (frontend) + Render (backend)
- Cloudflare R2 for media storage
- PostgreSQL (replace JSON files)
- Basic auth

---

## 5. Curation Improvements

- Cross-scene variation assignment (use a variation from scene 2 in scene 3)
- Regenerate base image from curation (go back without losing progress)

---

## 6. Remotion Renderer for Export

- Currently: FFmpeg burns simple subtitles, Remotion only for preview
- Goal: Remotion exports video with animated word-by-word subtitles
- Requires: Chromium on server

---

## 7. Platform Integrations

- Meta Graph API (Instagram/Facebook publish)
- TikTok Content Posting API
- Performance tracking (pull analytics)
- Meta Ad Library / TikTok Creative Center (competitor research)

---

## 8. UX Polish

- Prompt versioning (track changes over time)
- Keyboard shortcuts (Enter to approve, R to regen)
- Brand context URL scraper filtering improvements
- Loading states on image edit (overlay on image)
