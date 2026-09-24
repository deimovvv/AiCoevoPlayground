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

## 10b. Manual Lab — UX refactor (3 niveles, aprobado 2026-06-03)

**Contexto.** El layout actual del Lab es denso y se pierde contexto: thumbs de refs muy chicos, prompt textarea apretada, asset picker que abre en panel separado. El usuario propuso copiar Freepik/Morph (sidebar izq + galería der), pero ese rediseño total tiene riesgo alto y descarta la narrativa conversacional del Lab. Decisión: plan progresivo.

Ver `decisions-log.md` 2026-06 para el racional completo.

### Nivel 1 — Ganancias rápidas (siguiente sprint, ~2h, riesgo cero)

- [ ] Refs más grandes: 60px → 90-100px. Que se entienda qué tenés cargado de un vistazo.
- [ ] Prompt textarea grande y resizable: 6 rows por default, `resize-y` nativo. Hoy desalienta escribir bien.
- [ ] Asset picker **inline** cuando se activa "Usar assets de marca", no en panel flotante.

Estos tres son ortogonales al layout. Se hacen en el Lab actual sin romper nada.

### Nivel 2 — Reorganización (solo si Nivel 1 no alcanza, ~4h, riesgo medio)

- [ ] Galería como drawer derecho colapsable (no fijo).
- [ ] Zona principal horizontal con refs + prompt + controles + chat.
- [ ] Mantiene la narrativa conversacional (encadenamiento "Use as ref").

### Nivel 3 — Rediseño completo Freepik-style (solo si Nivel 2 no alcanza, ~1-2 días, riesgo alto)

- [ ] Sidebar izquierda fija con TODOS los controles.
- [ ] Galería vertical infinita a la derecha.
- [ ] Pierde la narrativa de "chat" actual.

**Por qué progresivo.** Lab tiene 2000+ líneas y el usuario genera todos los días en él. Un big-bang refactor bloquea trabajo varios días. Mejor iterar: ves el cambio en una sesión, decidís si seguís.

**Quedan congelados durante este refactor:**
- Look & Feel (estable, no tocar)
- Manual Lab "Tal cual" / "Curar con Gemini" toggle (estable)
- Tags `[imgN]` (estable, no cambiar a otra convención)

---

## 10c. Ecommerce Batch — cablear el backend de generación

**Contexto.** Existe el prototipo visual en `/dashboard/ecommerce-batch`. Drop de carpetas + counter de costo + breakdown. El botón "Generar" hoy es un `alert()`. Falta el orquestador.

**Decisiones de UX a confirmar antes de cablear** (ver `decisions-log.md` 2026-06):
- [ ] Esquema canónicas + hero vs pool único.
- [ ] Tipo de prenda: manual vs Gemini Vision auto.
- [ ] Preset Coevo de poses canónicas (deja arrancar día 1 sin que el cliente mande poses).
- [ ] Pose como texto vs imagen-ref.

**Cuando esté decidido, el backend necesita:**
- Endpoint `POST /api/ecommerce-batch/run` — recibe outfits + poses + config, devuelve `batch_id`.
- Cola de jobs con concurrency limitada (3-4 paralelos, sino Fal rate-limits).
- WebSocket o polling para progress por celda (N×K celdas).
- Endpoint `GET /api/ecommerce-batch/:id` — estado actual + URLs de resultados.
- Persistencia: cada celda como `Generation` separada con `parentAssetId` apuntando al outfit source.
- Cancel: poder abortar un batch en curso (importante por costo).

**Pre-cost estimate.** Mostrar el costo en USD **antes** de disparar. Sin eso vas a generar batches sin querer. Ya está en el prototipo, mantener en la versión final.

**No requiere:** infraestructura nueva. Es un wrapper sobre `createImageEdit` que ya existe.

---

## 10d. Campañas — cerrar el circuito con las tools

**Estado.** El flujo de campaña quedó rehecho en septiembre 2026 (ver commits
`65dcc26`, `1e94b03`, `29d6b83`, `c3af59b`). Lo que YA funciona:

- Panel + lienzo en una sola pantalla (forma tomada del módulo de campaña de
  Genera Space; ver `competitive-research.md`). Botón de generar siempre visible
  con contador de piezas y costo.
- El brief se interpreta solo mientras escribís — `services/campaign_planner.py`
  lee el texto y devuelve tomas concretas, formatos deducidos del destino
  (reel → 9:16, feed → 4:5) y los assets elegidos del banco de la marca.
- Se puede adjuntar el PDF del cliente (`POST /api/campaigns/brief-from-file`)
  en vez de transcribirlo.
- Los assets NO se vuelven a pedir: salen de la marca y se muestran como
  miniaturas, editables si hace falta.

**El agujero que queda: campañas y tools son dos formas de producir que no se
hablan.**

```
CAMPAÑAS                          TOOLS
brief → plan → piezas             elegís tool → pipeline → pieza
  └─ sólo imágenes sueltas          └─ reels, UGC, catálogos, ecommerce
```

La campaña sabe interpretar un brief pero `handleGenerate` en
`CampaignDetailPage` arma un prompt genérico y llama a `createImageEdit`
directo. Las tools saben hacer reels y UGC pero no saben nada de campañas.
Hoy hay puentes de navegación entre las dos (`d5996a0`) pero nada más.

**Lo que falta para cerrarlo:**

- [ ] El planner devuelve `needs_video: true` cuando el brief menciona reel o
      animación — **hoy sólo lo avisa en pantalla, no lo produce**. Es el caso
      más visible: escribís "un reel corto para el lanzamiento" y salen fotos.
- [ ] Que cada toma del plan declare **qué tool la ejecuta** (`fashion_reel`,
      `ecommerce_pack`, `ugc_creator`, o generación directa) en vez de asumir
      imagen suelta. El planner ya tiene el catálogo de la marca; le falta el
      catálogo de tools.
- [ ] Disparar la tool desde la campaña y que la generación resultante quede
      colgada de ella (`campaign.generationIds` existe y está sin usar — las
      piezas viven en `campaign.pieces`).
- [ ] Al volver de la tool, que la pieza aparezca en la campaña sin pasos
      manuales.

**Decisión pendiente:** ¿la campaña ejecuta la tool por dentro (sin salir de la
pantalla) o te lleva a la tool con el contexto cargado? La segunda es mucho más
barata y respeta que las tools ya tienen su propio pipeline con curación.

**No requiere:** infraestructura nueva. El planner y las tools ya existen; falta
el mapeo entre uno y otras.

---

## 10e. Campañas — estados que significan algo

**Problema.** Nada impide que una campaña pase a `review` sin tener una sola
pieza. Pasó: en agosto había 4 campañas en "En revisión" con cero piezas
generadas — no había nada que revisar. Hoy (sept 2026) ya no quedan así, pero
la regla sigue sin existir, así que puede volver a pasar.

- [ ] Regla dura: no se puede pasar a `review` sin al menos una pieza.
- [ ] `generationIds` quedó huérfano (las piezas viven en `pieces`). O se usa o
      se saca del modelo.
- [ ] Las campañas sin nombre se llamaban todas "Campaña sin nombre" — ya se
      arregló tomando la primera línea del brief, pero las viejas quedaron así.
      Falta una migración que las renombre.

---

## 10f. Modo claro — auditar el resto de la app

**Contexto.** Todo el desarrollo reciente se probó en modo oscuro. Cuando se
miró en claro aparecieron problemas acumulados: crema demasiado amarillo, bordes
invisibles (0.025 de opacidad), fondos de estado que teñían media pantalla.
Arreglado en `60ff48c` y `c3af59b` para Campañas.

- [ ] Revisar el resto de las pantallas en claro — sobre todo Brand Settings,
      ToolRunPage y Manual Lab, que son las más densas.
- [ ] Verificar contraste en ambos temas al tocar color, no sólo en uno.

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

---

## 13. ToolRunPage rediseño — layout split (aprobado 2026-06)

**Contexto.** Las páginas de tools acumularon mucho durante 2025-2026: brief box, Coevo Agent, mode toggle, visual style, references, allow faces, tabs de assets, ajustes técnicos en desplegable, motor de video, duración, direction, setting, style ref. Para Fashion Reel hay que scrollear 3 veces. Ajustes técnicos están detrás de un desplegable que casi nadie abre.

El Lab v2 demostró que `sidebar control 420px + área principal` funciona mejor para flujos densos. La idea es replicar ese patrón en `ToolRunPage`.

**Decisiones a confirmar antes de codear** (ver decisions-log.md 2026-06 — entrada "ToolRunPage gigante (DEUDA UX abierta)"):

- ¿Migrar **todas** las tools o solo las densas (Fashion Reel + Ecommerce Pack + Video Ad Creator)? Mi voto: progresivo desde las densas.
- ¿`Coevo Agent` / brief box queda dentro del sidebar (compacto) o queda arriba a pantalla completa como hoy? Mi voto: dentro del sidebar plegable, no full-width.
- ¿El **pipeline de steps** queda en sidebar o en área principal? Mi voto: vivir del lado principal (es el contenido), no del control.
- ¿Mantenemos el `Manage Prompt` / `Generar` arriba a la derecha o los movemos al footer del sidebar (como en Lab v2)? Mi voto: footer del sidebar, sticky.

**Riesgo.** ToolRunPage tiene 6000+ líneas y lógica condicional por toolId (`tool.id === "ugc_creator"`, etc.). El refactor no se hace en un solo commit. Approach: ir tool por tool, manteniendo el layout viejo para las no migradas.

**Por qué no aplicar a todas las tools indiscriminadamente:** Content Analyzer, Avatar Sheet, Product Sheet tienen flujos lineales que el layout actual cubre bien. El split solo gana en tools con muchos parámetros.

**Cuándo:** Antes del rollout interno definitivo. Cuanto más esperemos, más se nota la inconsistencia entre Lab v2 (nuevo layout) y todas las tools (viejo layout).

---

## 14. Selección por objeto y máscara — capacidad TRANSVERSAL

**Anotado 2026-09-20.** Surgió trabajando en Lab, pero **no es una feature del Lab**.
Es una capacidad del núcleo de edición que debería estar disponible en todas las tools.

### El problema concreto

Hoy `ImageEditPanel` edita **solo por instrucción de texto**: *"cambiá el televisor"*.
El modelo tiene que adivinar a qué televisor te referís, y con varios objetos similares
en escena falla. No hay forma de **señalar dónde**.

Lo que pide el usuario, textual:

> *"Quiero marcarle dónde quiero que me esté poniendo los modulares. Que pase el puntero
> y, si toco el televisor, se seleccione solo, porque tiene un sistema que lo reconoce, y
> eso se lo pasa como una capa."*

Eso es **segmentación interactiva** (hover → objeto reconocido → click → máscara), lo que
Photoshop llama "Selección de objetos". El modelo de referencia es **SAM** (Segment Anything).

### Estado actual — verificado 2026-09-20

| Pieza | Estado |
|---|---|
| Máscaras / segmentación en backend | ❌ **no existe** |
| `ImageEditPanel` (416 líneas) | Solo texto. Sin canvas, sin brush, sin máscara |
| Alcance del panel | ⚠️ **solo `ToolRunPage`** — el Lab NO lo usa |
| `birefnet/v2` vía Fal | ✅ existe, pero es *remove background*: separa sujeto/fondo, no objetos arbitrarios |

### Por qué es transversal, no de una tool

Sirve en todos lados donde hoy se edita a ciegas:

- **Lab** — el caso que lo disparó
- **Ecommerce Pack** — corregir una prenda sin tocar el resto
- **Fashion Editorial** — cambiar un elemento de escenografía
- **Consistencia** — apuntar a *qué* aspecto anclar, en vez de describirlo
- **AutoQA de producto** — recortar la zona con falla y re-generar solo eso

Y habilita algo que hoy no se puede: **edición local de verdad**, sin que el modelo
re-dibuje la imagen entera y cambie cosas que nadie pidió (el failure mode
documentado en la skill `generar-imagenes`).

### Arquitectura propuesta — tres capas

```
1. SERVICIO           backend/services/segmentation.py
                      SAM vía Fal. Entrada: imagen + punto (x,y) o caja.
                      Salida: máscara PNG + bounding box.

2. COMPONENTE         frontend/src/components/MaskCanvas.tsx
                      Canvas sobre la imagen. Modos:
                        · hover+click  → segmentación automática (SAM)
                        · brush        → pintar a mano, para lo que SAM no agarra
                        · caja         → seleccionar región rectangular
                      Salida: máscara como dataURL.

3. INTEGRACIÓN        ImageEditPanel consume MaskCanvas.
                      La máscara viaja junto a la instrucción al generador
                      (inpainting con máscara, no re-generación completa).
```

**La clave del diseño:** el servicio y el componente no saben nada de tools. Una tool
nueva que quiera máscaras pide `<MaskCanvas>` y listo — igual que hoy hereda el contexto
de marca sin configurarlo.

### Orden de implementación

| Paso | Qué | Por qué en ese orden |
|---|---|---|
| 1 | `segmentation.py` + endpoint | Sin el servicio no hay nada que probar |
| 2 | `MaskCanvas` con brush manual | El brush funciona sin SAM — valor inmediato, riesgo cero |
| 3 | Hover + click con SAM | La parte "mágica", encima de algo que ya funciona |
| 4 | Cablear a `ImageEditPanel` | Llega a todas las tools de `ToolRunPage` de una |
| 5 | Llevar `ImageEditPanel` al Lab | ⚠️ hoy el Lab NO lo usa — es trabajo aparte |

### ✅ IMPLEMENTADO 2026-09-21 — brush manual + máscara real

**El hallazgo que lo destrabó:** Nano Banana 2 **no** acepta máscara, pero **GPT Image 2 SÍ**
(`mask_url` en su API de `/edit`, verificado). Como ya estaba integrado, no hubo que sumar
ningún modelo al stack.

Lo construido:
- `components/workspace/MaskCanvas.tsx` — pintás sobre la imagen con el mouse. Dos capas de
  canvas: una para lo que VES (trazo rosa) y otra para lo que se MANDA (PNG blanco con
  agujeros transparentes, que es el formato que espera `mask_url`). Pincel ajustable,
  deshacer con historial de 20 pasos, limpiar.
- `gpt_image_gen.create_edit(..., mask_url=)` y el parámetro en `POST /api/image-gen/edit`.
  La máscara llega como data URL y se sube a Fal storage, igual que las refs.
- `ImageEditPanel` — botón "Editar sólo una zona". **Con máscara fuerza `gpt-image-2`**,
  porque por Nano Banana la edición saldría global.

Como el panel lo usan todas las pantallas, la capacidad llegó a las tools y a campañas de una.

**Lo que falta (fase 2): segmentación automática.** Hoy la marca se produce a mano con el
brush. El paso siguiente es click sobre un objeto → SAM genera la silueta → se pinta sola.
Para el modelo es lo mismo: cambia sólo cómo se produce la máscara, no qué se le manda.

### ⚠️ Contexto: Nano Banana 2 NO acepta máscara (verificado 2026-09-21)

Su API de `/edit` acepta `prompt`, `image_urls`, `resolution`, `aspect_ratio`, `system_prompt`…
pero **ningún parámetro de inpainting ni `mask_url`**. Verificado en fal.ai/models/fal-ai/nano-banana-2/edit/api.

Eso descarta el camino obvio (mandar imagen + máscara y pedir que respete la región).

**La salida, propuesta por el usuario y es la buena:** mandar **la imagen con la marca PINTADA
encima**. El modelo ve dónde señalaste sin necesitar un parámetro de máscara — la señal viaja
en los píxeles. Dos formas de producir esa marca:

1. **Brush manual** — el usuario pinta la zona con el mouse.
2. **Click sobre el objeto** — segmentación automática (SAM) genera la silueta y el front la
   pinta. Es lo mismo para el modelo; cambia sólo cómo se produce la marca.

El front compone `imagen + overlay` en un `<canvas>` y manda ESA imagen. Ventaja: no agrega
modelos al stack ni depende de que el generador soporte inpainting.

**A verificar antes de construir:** si GPT Image 2 (el otro modelo ya integrado) acepta máscara
de verdad — la API de OpenAI sí tiene `mask` en su endpoint de edits. Si la ruta de Fal lo expone,
sería la opción limpia para ediciones locales precisas.

### Dependencias y preguntas abiertas

- **¿Qué modelo de SAM en Fal?** Hay que verificar qué endpoints de segmentación
  ofrece y a qué costo por llamada. No está investigado.
- **¿El generador soporta inpainting con máscara?** Nano Banana 2 acepta imágenes de
  referencia, pero hay que confirmar si acepta un canal de máscara o si hay que
  componer el resultado a mano (generar + pegar la región con la máscara).
- **Costo:** cada hover que dispare SAM es una llamada. Conviene segmentar al click,
  no al hover, o cachear la respuesta por imagen.
- **Relación con el layout de 3 columnas** (`dashboard-architecture-research.md`):
  el canvas con máscara es justamente lo que justifica un canvas persistente. Las dos
  cosas se refuerzan.

### Cuándo

**No ahora.** El usuario fue explícito: *"no quiero que nos centremos en esto, pero que
esté proyectado escalablemente en base al orden que le queremos dar"*.

Entra después del orden acordado en `dashboard-architecture-research.md` §5b
(costo en el botón → login → sidebar → recetas → layout 3 columnas). Encaja
naturalmente con el paso 5.
