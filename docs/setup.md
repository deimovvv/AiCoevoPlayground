# Setup — Coevo Creative OS

## Prerequisites

- **Node.js** 18+
- **Python** 3.11+
- **FFmpeg** (`brew install ffmpeg`)

## 1. Backend

```bash
cd backend

# Create virtual environment (first time only)
python -m venv .venv

# Activate
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env with your API keys
cp .env.example .env
# Edit .env and add your keys
```

### .env required keys

```
GEMINI_API_KEY=your_gemini_key          # Script generation, chat, prompts
ELEVENLABS_API_KEY=your_elevenlabs_key  # TTS voice generation
FAL_KEY=your_fal_key                    # Image gen (Nano Banana), lip-sync (HeyGen Avatar 4), Kling video
```

### .env optional keys

```
HEYGEN_API_KEY=your_heygen_key          # Legacy HeyGen (not needed if using Fal)
```

### Start backend

```bash
cd backend
source .venv/bin/activate
python -m uvicorn main:app --reload --port 8000
```

Backend runs at: http://localhost:8000
API docs at: http://localhost:8000/docs

## 2. Frontend

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Start dev server
npm run dev
```

Frontend runs at: http://localhost:5173

## 3. Quick start (both at once)

Terminal 1:
```bash
cd backend && source .venv/bin/activate && python -m uvicorn main:app --reload --port 8000
```

Terminal 2:
```bash
cd frontend && npm run dev
```

Or use the Claude Code slash command:
```
/dev-start
```

## 4. Verify everything works

1. Open http://localhost:5173
2. Check backend: http://localhost:8000/api/brands should return JSON
3. Check API keys: use `/check-env` in Claude Code

## Services & costs

| Service | What it does | Cost |
|---------|-------------|------|
| Gemini 2.5 Flash | Scripts, chat, prompt generation | Free tier / pay per token |
| ElevenLabs | TTS voice generation | Free tier: 10k chars/month |
| Fal AI — Nano Banana 2 | Image generation/editing | ~$0.01/image |
| Fal AI — HeyGen Avatar 4 | Talking head video | ~$0.10/second |
| Fal AI — Kling V2.6 | Image-to-video animation | ~$0.05/video |
| FFmpeg | Video concatenation + subtitles | Free (local) |

## File structure

```
backend/
  .env                 # API keys (never commit)
  .venv/               # Python virtual environment
  main.py              # FastAPI app
  services/            # AI service integrations
  tools/               # Tool prompt templates
  data/                # JSON storage + media files
    brands.json
    avatars/
    products/
    clothing/
    backgrounds/
    renders/

frontend/
  src/
    pages/             # Route components
    components/        # Shared components
    lib/               # API client, context, utils
```

## Common issues

- **Backend won't start**: Check `.env` has all required keys, check Python venv is activated
- **Images not loading**: Backend must be running, check static file mounts
- **Gemini PROHIBITED_CONTENT**: Brand context may have scraped web junk — clean it in Brand Kit
- **HeyGen wrong voice**: Make sure audio is generated via `/api/tts/generate-and-upload` (backend uploads to Fal)
- **Nano Banana 422**: Prompt too complex — keep image prompts to 2-3 sentences max
