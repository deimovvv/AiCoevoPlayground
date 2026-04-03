# /check-env

Verify that all required environment variables are configured for Coevo Creative OS.

## Steps

1. Check if `backend/.env` exists. If not, print a warning and show the required template:
   ```
   GEMINI_API_KEY=your_key
   ELEVENLABS_API_KEY=your_key
   FAL_KEY=your_key
   HEYGEN_API_KEY=optional
   KLING_API_KEY=optional
   ```

2. If `backend/.env` exists, read it and check for each key:
   - `GEMINI_API_KEY` — required (chat, scripts, prompt generation)
   - `ELEVENLABS_API_KEY` — required (TTS voice generation)
   - `FAL_KEY` — required (image gen, lip-sync, Kling video)
   - `HEYGEN_API_KEY` — optional (legacy lip-sync)
   - `KLING_API_KEY` — optional (direct Kling, fallback if FAL_KEY has issues)

3. Print a status table:
   - ✓ KEY_NAME — set
   - ✗ KEY_NAME — MISSING (required)
   - ○ KEY_NAME — not set (optional)

4. If any required key is missing, tell the user which services will not work:
   - No GEMINI_API_KEY → Chat, Script generation, Prompt Builder all broken
   - No ELEVENLABS_API_KEY → TTS/Voice step will fail
   - No FAL_KEY → Image generation, Lip-sync, Kling video all broken

5. Do NOT print the actual key values — only confirm if they are set or not.
