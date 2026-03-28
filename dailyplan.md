# UGC Creator — Generation Board (Backend Plan)

> **Status**: 🟡 Phase 1 (UI) in progress — Backend next  
> **Last updated**: 2026-03-17

---

## 1. Data Model — `Generation`

Each video generation is stored as a JSON object with the following shape:

```json
{
  "id": "gen_abc12345",
  "brandId": "taller-santa-clara",
  "createdAt": "2026-03-17T00:15:00Z",
  "updatedAt": "2026-03-17T00:18:30Z",
  "scriptText": "¿Buscás remeras de algodón?...",
  "clipCount": 2,
  "lipsyncEngine": "fal",
  "voiceId": "EXAVITQu4vr4xnSDxMaL",
  "klingDuration": "5",
  "status": "running",
  "currentPhase": "scene",
  "phases": {
    "script":   { "status": "done", "completedAt": "..." },
    "audio":    { "status": "done", "completedAt": "...", "urls": ["https://...mp3"] },
    "scene":    { "status": "running", "progress": 67 },
    "lipsync":  { "status": "pending" },
    "render":   { "status": "pending" }
  },
  "avatarId": "abc123",
  "avatarImageUrl": "/static/avatars/taller_abc.png",
  "finalVideoUrl": null,
  "error": null
}
```

### Key fields:
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique ID (uuid prefix) |
| `brandId` | string | Brand slug |
| `scriptText` | string | Full script text |
| `clipCount` | number | 1, 2, or 3 segments |
| `status` | enum | `draft` \| `running` \| `completed` \| `failed` |
| `currentPhase` | string | Which phase is active |
| `phases` | object | Per-phase status tracking |
| `finalVideoUrl` | string? | URL when completed |

---

## 2. Storage — `data/generations.json`

Same pattern as `data/brands.json` — a flat JSON array. Per-brand filtering at API level.

```
backend/data/generations.json
```

---

## 3. API Endpoints

### CRUD
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/brands/{id}/generations` | List all generations for a brand |
| `POST` | `/api/brands/{id}/generations` | Create new generation (returns `id`) |
| `GET` | `/api/generations/{gen_id}` | Get single generation + status |
| `PATCH` | `/api/generations/{gen_id}` | Update phase status (internal) |
| `DELETE` | `/api/generations/{gen_id}` | Delete a generation |

### Pipeline trigger
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/generations/{gen_id}/start` | Start the pipeline (kicks off phases) |

### Phase callbacks (internal)
Each existing endpoint (TTS, Kling, Fal, etc.) will accept an optional `generation_id` + `phase` query param to auto-update the generation record when done.

---

## 4. Implementation Order

- [ ] **Phase 1** — UI: Generation Board component (cards + timeline) — _in progress_
- [ ] **Phase 2** — Backend: `generations.json` storage + CRUD endpoints
- [ ] **Phase 3** — Connect UI to backend: fetch generations, create on "New Script"
- [ ] **Phase 4** — Pipeline integration: update generation phases as steps complete
- [ ] **Phase 5** — Polish: filtering, sorting, video preview inline

---

## 5. Frontend Architecture

```
components/
  GenerationBoard.tsx      ← NEW: the board with cards
  GenerationCard.tsx        ← NEW: individual card with timeline dots
  PipelineTimeline.tsx      ← NEW: horizontal dot-line timeline

pages/
  BrandWorkspace.tsx        ← Replace SCRIPTS table with <GenerationBoard />
```
