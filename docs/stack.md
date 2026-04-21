# Coevo Studio — Tech Stack

## Frontend
- **React 19** + **TypeScript 5.9** + **Vite 8 Beta**
- **Tailwind CSS v4** (design tokens, semantic utilities)
- **React Router 7**
- **Remotion** (animated subtitle preview, UGC player)
- **Lucide React** (icons)

## Backend
- **FastAPI** + **Python 3.11+** + **Uvicorn**
- JSON file-based storage (Phase 1 — see planning.md for PostgreSQL migration)

## AI Services

| Service | Provider | Use |
|---------|----------|-----|
| Scripts, prompts, DNA, analysis | **Gemini 2.5 Flash** | Text generation, structured output |
| Image generation | **Nano Banana 2** via Fal | Reference-based image creation |
| Video animation | **Kling** via Fal | Image-to-video, frame-to-frame |
| Lip-sync | **HeyGen Avatar 4** via Fal | Image + audio → talking video |
| Lip-sync (alternative) | **Fal Fabric 1.0** | Alternative lip-sync pipeline |
| Text-to-speech | **ElevenLabs v3** | Voice generation, multilingual |
| Video processing | **FFmpeg** | Concatenation, subtitles |
| Image/video analysis | **Gemini Vision** | Product/avatar auto-description, video analysis |
| TikTok scraping | **Apify** (clockworks/tiktok-scraper) | Profile top videos by engagement |
| TikTok download | **tikwm.com** | Video download (no auth) |

## Environment Variables

```env
GEMINI_API_KEY=...         # Required — Gemini 2.5 Flash + Vision
ELEVENLABS_API_KEY=...     # Required — ElevenLabs TTS
FAL_KEY=...                # Required — Fal AI (Nano Banana, Kling, HeyGen Avatar 4, Fabric)
APIFY_API_KEY=...          # Optional — TikTok profile scraping
HEYGEN_API_KEY=...         # Optional — HeyGen legacy (not used in active pipeline)
KLING_API_KEY=...          # Optional — Kling legacy (not used in active pipeline)
```

## Development

```bash
# Frontend
cd frontend && npm install && npm run dev    # http://localhost:5173

# Backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

## Build
```bash
cd frontend && npm run build    # Output: frontend/dist/
```

## Key Dependencies
- **Frontend**: react, react-dom, react-router, tailwindcss, remotion, lucide-react, clsx, tailwind-merge
- **Backend**: fastapi, uvicorn, httpx, elevenlabs, google-generativeai, PyPDF2, beautifulsoup4, python-multipart
