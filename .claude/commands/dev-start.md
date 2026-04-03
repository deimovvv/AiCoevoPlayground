# /dev-start

Start the full Coevo Creative OS dev stack: backend (FastAPI) + frontend (Vite).

## Steps

1. Check if backend `.venv` exists at `backend/.venv`. If not, tell the user to run `python -m venv .venv` and `pip install -r requirements.txt` first.

2. Check if `backend/.env` exists. If not, warn: "Missing backend/.env — create it with GEMINI_API_KEY, ELEVENLABS_API_KEY, FAL_KEY before starting."

3. Start the backend in the background:
   ```
   cd backend && source .venv/bin/activate && python -m uvicorn main:app --reload --port 8000
   ```

4. Start the frontend in the background:
   ```
   cd frontend && npm run dev
   ```

5. Print:
   - Backend: http://localhost:8000
   - Frontend: http://localhost:5173
   - API docs: http://localhost:8000/docs
