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

From the repo root:
```bash
./dev.sh
```

Starts backend (`:8000`) and frontend (`:5173`) together with prefixed logs. Ctrl+C kills both. Variants:
```bash
./dev.sh backend      # only backend
./dev.sh frontend     # only frontend
BACKEND_PORT=8001 FRONTEND_PORT=5174 ./dev.sh   # custom ports
```

### Double-click launchers (sin terminal)
- **macOS** → doble click en **`start-mac.command`** (corre `dev.sh`). La 1ª vez: click derecho → Abrir, para saltar el aviso de Gatekeeper.
- **Windows** → doble click en **`start-windows.bat`** (abre backend y frontend en dos ventanas; cerralas para frenar).

Ambos requieren el setup previo (venv del backend + `npm install`).

Manual two-terminal flow (if `dev.sh` doesn't fit your setup):

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

## Servicios y costos

Los costos cambian seguido y esta tabla se desactualizaba (decía Kling V2.6 a
$0.05 y Nano Banana a $0.01). Fuentes que se mantienen:

- **Tarifas que usa la app:** `frontend/src/lib/pricing.ts` y `VIDEO_RATE_PER_SEC`
  en `frontend/src/pages/ManualLabV2.tsx`.
- **Modelos y proveedores:** [MAP.md](MAP.md) §4 y
  `openspec/specs/video-generation/spec.md`.

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

---

## Debugging frecuente

- **Backend not starting**: Check `.env` has required API keys, restart uvicorn
- **Images not loading**: Verify static file mounts in `main.py`
- **Black screen on route**: Check React hooks are before conditional returns
- **Brand switcher not updating**: Ensure `refreshBrands()` is called after create/delete
- **Prompt not working**: Verify template variables match `build_context_variables()` output
- **Abre otra web en el puerto**: otro proyecto (MONKS/Google-App) le robó el 5180. Coevo usa `strictPort`, así que falla en vez de saltar. Ver `lsof -iTCP:5180`
- **`python-dotenv could not parse`**: hay una línea sin `NOMBRE=` en `backend/.env`
