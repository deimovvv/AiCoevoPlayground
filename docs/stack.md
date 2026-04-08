# Coevo Studio — Tech Stack

## Frontend
- **React 19** + **TypeScript 5.9** + **Vite 8 Beta**
- **Tailwind CSS v4** (design tokens, semantic utilities)
- **React Router 7**
- **Remotion** (animated subtitle preview, UGC player)
- **Lucide React** (icons)

## Backend
- **FastAPI** + **Python 3.11+** + **Uvicorn**
- JSON file-based storage (Phase 1)

## AI Services
| Service | Provider | Use |
|---------|----------|-----|
| Scripts, prompts, DNA, analysis | **Gemini 2.5 Flash** | Text generation, structured output |
| Image generation | **Nano Banana 2** via Fal | Reference-based image creation |
| Video animation | **Kling V3 Pro** via Fal | Image-to-video, frame-to-frame |
| Lip-sync | **HeyGen Avatar 4** via Fal | Image + audio -> talking video |
| Text-to-speech | **ElevenLabs v3** | Voice generation, multilingual |
| Lip-sync (legacy) | **Fal Fabric** | Alternative lip-sync |
| Video processing | **FFmpeg** | Concatenation, subtitles |
| Image analysis | **Gemini Vision** | Product/avatar auto-description |

## Environment Variables

```env
GEMINI_API_KEY=...         # Required — Gemini 2.5 Flash
ELEVENLABS_API_KEY=...     # Required — ElevenLabs TTS
FAL_KEY=...                # Required — Fal AI (Nano Banana, Kling, HeyGen Avatar 4)
HEYGEN_API_KEY=...         # Optional — HeyGen legacy
KLING_API_KEY=...          # Optional — Kling legacy
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
- **Frontend** (24 packages): react, react-dom, react-router, tailwindcss, remotion, lucide-react, clsx, tailwind-merge
- **Backend**: fastapi, uvicorn, httpx, elevenlabs, google-generativeai, PyPDF2, beautifulsoup4, python-multipart
