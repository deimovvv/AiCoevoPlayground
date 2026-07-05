# Campañas (Campaign flow) — spec

Adaptación del flujo **"Invent"** (proyecto cliente confidencial, Flask) a NUESTRO stack
(FastAPI + React). No se copia código de Invent — se adaptan patrones generales.

Objetivo: dar a la agencia (y después a las marcas, vía Portal) un **contenedor de
Campaña** para trabajar contenido de punta a punta — imágenes → checkpoint humano →
video → voz → export — reusando lo que ya existe.

---

## Journey desde NUESTRA UI

1. **Sidebar → "Campañas"** — scopeado a la marca activa. Lista de campañas + [Nueva campaña].
2. **Nueva campaña** (form, reusa el Brand Kit):
   - Nombre · **Producto** (grilla de products de la marca) · **Shot list** (Que decida la
     IA / Elegir estilos / toma custom) · **Referencias** (dropdown Moodboard + Pose) ·
     **Variantes/toma** (1–4) · **Aspect** (16:9 / 9:16 multi) · **Resolución** (1k/2k/4k).
3. **Pipeline con progreso** (job full-screen): Strategy → Creative (imgs+copy) → AutoQA →
   ⏸ checkpoint "Revisar imágenes".
4. **Checkpoint / Revisar** (reusa content rail + ImageEditPanel): grilla de imágenes con
   Editar (+ upload ref) / Regenerar / Versiones / Match Lighting / Animar / ⭐ / zoom.
   Revisás copy → **Aprobar**.
5. **Post-aprobación**: Video (Kling) + Voz (ElevenLabs).
6. **Detalle de campaña**: piezas agrupadas + Export (render_payload).
7. **Portal cliente** (`/portal/:token`, ya existe): la marca ve las piezas aprobadas.

---

## Mapeo Invent → nuestro codebase

| Pieza Invent | En nuestro código | Estado |
|---|---|---|
| Campaign Settings (products+cat, brief, moodboard, poses, L&F, fonts) | Brand Kit (`brands.py`, BrandSettings) | ✅ reusar |
| Generación i2i con refs de producto | tools + Manual Lab (`image_gen.py`) | ✅ reusar |
| N variantes / AR / resolución | Lab | ✅ reusar |
| Upload & Swap (product swap) | Consistencia | ✅ reusar |
| Animate + sugerir cámara | Fashion Reel/Lab (`curateMotionPrompt`) | ✅ reusar |
| Voz | ElevenLabs (`tts.py`) | ✅ reusar |
| Match Lighting | Look & Feel | ✅ reusar |
| Edit con instrucción + ref | `ImageEditPanel` (ya soporta upload) | ✅ reusar |
| Grilla de resultados | content rail (`ToolRunPage`) | ✅ reusar |
| Portal del cliente | `PortalPage` (`/portal/:token`) | ✅ reusar |
| **AutoQA consistencia + auto-repair** | — | ❌ **Fase 0** |
| **Entidad Campaign + orquestador con checkpoint** | — | ❌ Fase 1 |
| **Versiones por imagen (revert/undo)** | — | ❌ Fase 2 |
| **StrategyAgent (brief → shot list + copy)** | parcial (`copy_gen`, brief→brand) | ⚠️ Fase 2 |
| **Export render_payload.json** | — | ❌ Fase 2 |
| Copy to Figma / Fonts | — | ❌ descartado (no hace falta) |

---

## Fases

### Fase 0 — AutoQA de consistencia de producto (independiente, mayor ROI)
No depende de Campañas — mejora TODAS las tools ya. Resuelve la pelea de fidelidad
(producto/cara mal renderizados).

- Servicio `product_qa.py`: Gemini Vision compara una imagen GENERADA contra la(s)
  referencia(s) del producto → verdict estructurado `{ ok, severity, issues[], fix_hint }`.
  Category-aware (un reloj se chequea distinto que una remera).
- Endpoint `POST /api/qa/product-consistency` (imagen + refs + categoría).
- Frontend: `checkProductConsistency()` en `api.ts`; badge "✓ producto OK / ⚠ revisar"
  en las cards generadas, con botón "Auto-reparar" (regenera re-inyectando la ref).

### Fase 1 — Entidad Campaign + orquestador con checkpoint
- Entidad `Campaign` (`backend/data/campaigns.json`): `{ id, brandId, name, brief,
  productIds, moodboardId, poseId, shotPlan, aspectRatios[], resolution, status, createdAt }`.
- CRUD + tag `campaignId` en las generaciones (`generations.json`).
- Nav "Campañas" (lista bajo la marca) + New Campaign form + Campaign detail.
- Orquestador por etapas con checkpoint humano (imgs → ⏸aprobar → video+voz), progreso 0–100.

### Fase 2 — Versiones + StrategyAgent + export
- Versiones por imagen en `ImageEditPanel` (v1,v2,v3… revert/undo).
- StrategyAgent: brief PDF → shot list + copy pre-aprobado + disclaimers.
- Export `render_payload_{campaignId}.json` (video + copy + traducciones + disclaimers +
  productId + AR).

---

## Principios
- **Reusar, no reescribir**: la generación ya funciona; Campaña es orquestación + organización.
- **Curado primero**: la agencia genera; la marca VE en el Portal. Acceso directo de la
  marca a generar = fase posterior, con límites (costo/calidad).
- **Confidencialidad**: se adaptan patrones de Invent, no su código.
