# Coevo Studio — Pending Features

Features discussed and planned but not yet implemented.

---

## 1. Generation Persistence

**Problem:** Pipeline state is lost when leaving the page. Only the final result saves — and it saves the *Fal URL*, not the file (`create_generation` stores `outputUrl` as-is into `generations.json`).

**Need:**
- Save complete pipeline state per generation (every step result)
- Store intermediate images, audio files
- Re-open a generation and resume/edit from any step
- Delete associated files when deleting a generation

**Data model (when this moves off flat JSON):**
```
generation     the run: brand, tool, date, status
  └─ step       each pipeline step (script, base, multishot, voice, render…)
       └─ asset     EACH generated image / video / audio
            id, type, prompt, model, params (json),
            refs            (input images used),
            storageKey      (OUR stored file),
            sourceUrl       (original Fal URL — audit only),
            parentAssetId   (which asset it derived from — edit/variant chains),
            createdAt
```
Keeps full provenance per AI image (which prompt + model + ref produced it, and what it derived from) and lets curation reconstruct variant/edit chains.

**Media persistence (consideration — deferred):** Fal output URLs are a third-party CDN, not our system of record; they can be purged over time even when Fal itself is healthy. To *guarantee* every step is saved, download each output to our own storage at save time and persist `storageKey`, keeping `sourceUrl` for audit only. Not urgent — current usage relies on Fal URLs directly and that's acceptable for now.

---

## 2. Agentic Mode (Content Agent)

**Concept:** En vez de navegar tools manualmente, describís la necesidad en lenguaje natural y el agente decide qué tool usar, selecciona los assets correctos de la marca, y ejecuta el pipeline.

**Ejemplo:**
```
"Haceme un avatar vendiendo el servicio de consultoría, tono profesional, en español"
  → Agente decide: UGC Creator
  → Selecciona: avatar con perfil profesional, sin producto, voz adecuada
  → Ejecuta pipeline completo
  → Resultado en content library
```

**Arquitectura:**
- Claude API con `tool_use` como orquestador (reemplaza Gemini en ese modo)
- Toggle "Agent Mode" en el ChatPanel existente — sin nueva página ni nueva infraestructura
- Cada pipeline mapeado como una skill (JSON schema) que Claude puede llamar
- El agente corre contra los mismos endpoints REST que usa la UI — sin cambios en el backend
- Contexto de marca inyectado al inicio: avatars con IDs, productos con IDs, voces — Claude resuelve los IDs desde la descripción del usuario

**Granularidad de skills: por pipeline completo (no por step)**
```
Skill: run_ugc_creator(avatar_id, product_id, voice_id, notes)
Skill: run_static_ad(product_id, template_id, notes)
Skill: run_fashion_reel(avatar_ids[], clothing_ids[], mode, notes)
Skill: run_carousel(product_ids[], type, notes)
Skill: run_video_ad(avatar_id, product_id, voice_id, notes)
```
Skills por step (script specialist, image specialist, etc.) → fase posterior, cuando necesitás pipelines custom que no existen todavía.

**Ejemplo de skill definition:**
```json
{
  "name": "run_ugc_creator",
  "description": "Crea un video UGC con avatar hablando a cámara vendiendo un producto. Usar para testimoniales, demos, reviews.",
  "input_schema": {
    "avatar_id": "string — ID del avatar a usar",
    "product_id": "string — ID del producto (opcional)",
    "voice_id": "string — ID de la voz ElevenLabs",
    "notes": "string — instrucciones de tono, estilo, idioma"
  }
}
```

**Checkpoint: uno al final, no por step**
- El agente corre el pipeline completo
- Presenta el resultado en el chat
- El usuario aprueba o pide ajustes en lenguaje natural

**Lo que NO hay que construir:**
- Los pipelines (ya existen)
- La lógica de selección de tool (Claude lo decide)
- Nuevo backend (para la opción A — ver abajo)

**Constraint técnico importante:**
Los pipelines actuales se orquestan desde el frontend (`ToolRunPage` corre cada step con aprobación humana). NO hay un endpoint backend tipo `POST /api/generate/ugc_creator` que corra el pipeline completo. Esto afecta el scope.

**Dos caminos posibles:**

### Opción A — Agent "navegador" (1-2 días)
El agente entiende el pedido, elige la tool, resuelve los asset IDs, y redirige a `ToolRunPage` con la config pre-cargada. El usuario revisa y corre el pipeline manualmente.
- **Valor:** saltás el setup (navegar + elegir tool + configurar assets)
- **Lo que hay que construir:**
  - Service `agent.py` con Claude API + tool_use
  - 5-6 skill schemas
  - Glue code que traduce skill call → navegación + config pre-cargada (sessionStorage, mismo pattern que Content Analyzer handoff)
  - Toggle "Agent Mode" en el ChatPanel
- **Pipeline intacto:** el usuario sigue teniendo control total de cada step

### Opción B — Agent "ejecutor" (1-2 semanas)
El agente corre el pipeline completo de punta a punta, sin navegación.
- **Requiere:**
  - Endpoints backend que orquesten todos los steps de cada pipeline (nueva capa)
  - Manejo de estado async multi-step en el backend (job queue implícito)
  - UI de progreso en el chat (streaming de updates mientras corre cada step)
  - Checkpoint único al final (aprobación del resultado completo)

**Recomendación: A primero.** Captura el 80% del valor con el 20% del trabajo. Las skills definidas en A se reutilizan 1:1 en B cuando se justifique.

**Cuándo:** Después de que los pipelines sean estables (Phase 5). No tiene sentido agentizar pipelines que fallan manualmente.

**Relación con Automation:** El mismo agente que corre desde el chat puede correr desde un cron. Para automation de verdad (sin usuario mirando), necesitás la Opción B — el pipeline corre solo en backend sin frontend abierto.

---

## 3. Automation / Scheduled Generation

**Concepto:** Generación automática de contenido según un calendario o trigger, sin intervención manual en la ejecución.

**Flujo realista:**
```
Calendario editorial
  → Instrucción pre-cargada: "Lunes 9am — UGC para [Marca], producto: [X], tono: verano"
      ↓ cron dispara
  Backend ejecuta pipeline en background (independiente del frontend)
      ↓
  Notificación: "Tu contenido está listo para revisar"
      ↓
  Aprobás → content library / publicación
```

**Variantes:**
- **Genera + notifica**: automático, vos aprobás antes de publicar (recomendado)
- **Totalmente autónomo**: genera y publica sin intervención (riesgoso sin revisión)
- **Prepara borradores**: deja piezas listas en library para que vos decidás cuándo despachar

**Lo que falta en infraestructura actual:**
| Necesidad | Estado |
|-----------|--------|
| Cron / scheduler | No existe |
| Job queue con retry y estado | No existe — pipelines son síncronos en el request HTTP |
| Notificaciones (email/Slack/in-app) | No existe |
| Calendario editorial | No existe |
| Publicación directa (Meta, TikTok) | No existe |

**Problema crítico:** Hoy los pipelines viven en el request del frontend — si el frontend no está abierto, no hay generación. Para automation, el pipeline necesita correr completamente en el backend.

**Prerequisito:** Resolver publicación directa a redes primero. Si igual publicás a mano, la automation solo ahorra el click de "correr pipeline" — valor limitado.

**Orden lógico:** Publicación directa → Automation → Agentic autónomo

---

## 4. Content Calendar

- Vista de calendario (grilla 7 cols / mes)
- Cargar instrucción por día: tool + brief + assets → se guarda como "job programado"
- Click en día pasado → abre generación existente
- Click en día futuro → configura el job
- Integración con Automation para disparar automáticamente

---

## 5. Platform Integrations (Publish)

- Meta Graph API (Instagram/Facebook publish)
- TikTok Content Posting API
- Performance tracking (pull analytics post-publicación)
- Meta Ad Library / TikTok Creative Center (competitor research)

---

## 6. URL Extraction en Generación

**Problema:** Hoy el contexto de marca viene del brand kit. Pero a veces necesitás contexto específico para un run: URL de producto, landing de campaña, brief online.

**Need:**
- Campo "Context URL" en ConfigPanel de cada tool
- Gemini extrae: descripción del producto, mensajes clave, tono, pricing, features
- Se inyecta como contexto adicional en ese run (sin modificar el brand kit)
- Útil para: página de producto nueva, brief de campaña, referencia de competidor

---

## 7. Brand & Design System desde URL (Auto-onboarding)

**Concepto:** Pasás la URL de una marca y el sistema genera automáticamente su brand guidance y design system estructurado — sin que el usuario tenga que completar nada manualmente.

**Flujo:**
```
URL de la marca (sitio, landing, Instagram, etc.)
  → Gemini scrappea contenido + analiza estructura visual
  → Claude Design analiza screenshots/logo → infiere paleta, tipografía, estilo
  → Output estructurado:
      - brandContext (tono, audiencia, propuesta de valor)
      - DNA (colores con hex, keywords, personalidad, tono)
      - Design system: estilo fotográfico, reglas visuales, tipografías
      - Moodboard sugerido (imágenes representativas del estilo)
```

**Output primario: datos estructurados** que alimentan directamente los campos del brand kit — no un PDF. El PDF es un export de eso, útil para compartir con el cliente.

**Por qué Claude Design agrega valor:** Gemini puede extraer texto y colores básicos, pero Claude Design puede analizar screenshots/logo e inferir la sensación visual de la marca — editorial vs. masivo, premium vs. accesible, etc. Especialmente útil cuando no hay brand guidelines formales.

**Casos de uso:**
- Cliente nuevo sin brand guidelines → onboarding en minutos
- Análisis de competidor → entender su sistema visual
- Marca personal (founder) → extraer identidad de su presencia online

**Prerequisito:** Campos de design system en brand kit (ver feature anterior).

---

## 8. Design System en Brand Kit

**Concepto:** Campos estructurados de identidad visual por marca, que se inyectan en los prompts de generación de imágenes.

**Campos accionables (alimentan IA):**
- Paleta de colores (hex) → contexto en Static Ad, Carousel, image gen
- Estilo fotográfico (texto libre) → referencia visual en todos los image steps
- Tipografías preferidas → relevante para Static Ad con texto
- Reglas de voz/tono → enriquece copy generation

**Campos de referencia (documentación):**
- Spacing/grid, breakpoints, component specs → útil cuando se genere código/diseño

---

## 8. Client Portal

- Vista separada para clientes (sin acceso a tools)
- Workflow de aprobación: borrador → revisión → aprobado → publicado
- Comentarios por pieza
- Requiere autenticación (Clerk/Auth0)

---

## 9. Deploy & Infrastructure

- Vercel (frontend) + Render/Railway (backend)
- Cloudflare R2 o S3 para media storage (reemplaza filesystem local)
- PostgreSQL (reemplaza JSON files)
- Auth básica para acceso del equipo

---

## 10. UX Polish

- Prompt versioning (track changes over time)
- Keyboard shortcuts (Enter to approve, R to regen)
- Loading states on image edit (overlay on image)
- Cross-scene variation assignment en curation

---

## 11. Remotion Export

- Actualmente: FFmpeg burns subtítulos simples, Remotion solo para preview
- Goal: Remotion exporta video con subtítulos animados word-by-word
- Requiere: Chromium en servidor

---

## 12. Video Editor (capa post-render)

**Concepto:** Editor "ligero" para refinar un video ya generado sin re-correr el pipeline completo. NO es un timeline multi-track tipo CapCut — es una capa de refinamiento sobre el output de las tools de video (UGC Creator, Video Ad Creator, Fashion Reel, Product Clip).

**Flujo:**
```
/dashboard/content → click en una generación de video → "Editar"
  → /dashboard/edit/:generationId
  → Editor abre con el video + sus escenas + audio + subtítulos
  → Ajustes disponibles (ver abajo)
  → Re-render con FFmpeg → nueva versión guardada
```

**Features del editor (ordenadas por ROI):**

| Feature | Valor | Esfuerzo |
|---|---|---|
| **Swap de escena puntual** (regenerar solo 1 escena) | Muy alto | Bajo (ya casi existe en pipeline) |
| **Overlay de música** (pick track + volumen + fade in/out) | Alto | Bajo |
| **Editor de subtítulos** (texto, timing, estilo) | Alto | Medio |
| **Trim/reordenar escenas** generadas | Alto | Medio |
| **Selector de cover/thumbnail** (qué frame usar para el preview) | Medio | Bajo |
| **Split/merge de clips** | Bajo | Alto |
| **Transiciones entre escenas** | Bajo | Alto |

**Lo que NO hace:**
- Import de videos externos
- Multi-track timeline
- Keyframes / animación manual
- Efectos / filtros / color grading
- Cualquier cosa que CapCut/Premiere hace mejor

Si el equipo necesita esas capacidades, exporta de Coevo y edita en CapCut/Descript.

**Arquitectura:**
- Nueva página `/dashboard/edit/:generationId`
- Lee la generación (escenas, audio URL, subtítulos SRT) desde `generations.json`
- Cada tipo de edit es independiente — no hay "pipeline" secuencial, son toggles
- Re-render on-demand con FFmpeg (concatenación + música + subs nuevos)
- Guarda nueva versión como generation separada (history)

**Prerequisito:** Feature #1 (Generation Persistence) — necesitás que las generaciones guarden todo su estado (escenas individuales, audio, subs) para poder editarlas después.

**Cuándo:** Después de Phase 5. Es polish, no funcionalidad core. Los pipelines tienen que estar sólidos antes de sumar refinement layer.
