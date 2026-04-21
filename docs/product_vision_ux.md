# Coevo Creative OS — Product Vision & UX

**Coevo Creative OS** es la herramienta interna de Coevo (agencia) para gestionar la creacion de contenido publicitario y marketing para multiples marcas cliente.

---

## Proposito Core

Transformar a Coevo en una **agencia potenciada por IA** donde:
- Los creativos se enfocan en estrategia y direccion
- La IA ejecuta la produccion tecnica (generacion de imagenes, videos, scripts)
- El equipo revisa y aprueba contenido de alta calidad en minutos (no horas/dias)
- Cada marca tiene su propio "contexto" que hace que las herramientas generen contenido consistente

---

## Filosofia de Producto

### 1. Context-Aware Everything
Cuando trabajas dentro de una marca, **todo** conoce el contexto:
- Brand guidance (tono, estilo, target)
- Assets disponibles (avatars, productos, ropa, fondos, moodboards)
- Prompts customizados por herramienta
- Voice presets

**Resultado**: Seleccionar assets → generar → revisar. Listo.

### 2. Asset Library como Single Source of Truth
Subir asset una vez, usar en todas las herramientas:
- **Avatars**: Personas/modelos con descripciones detalladas
- **Products**: Productos con imágenes (principal + hasta 2 extras)
- **Clothing**: Wardrobe options para avatars
- **Backgrounds**: Escenarios/settings para UGC y editoriales
- **Moodboards**: Referencias visuales de estilo (hasta 5 por marca, uno activo a la vez)
- **Voices**: Voice presets de ElevenLabs

### 3. Prompts as Templates, Not Hardcode
Los prompts son plantillas editables con variables:
```
Default: "Generate a UGC video for {brand_name} featuring {product_name}..."
Override: "Crea un video UGC bien argento para {brand_name}..."
```
Cada marca puede customizar el "lenguaje" de la IA sin tocar codigo. Templates agrupados por categoría (Video / Images / Other) en BrandSettings.

### 4. Multishot Before Animation
Generar opciones, curar la mejor, y solo despues animar:
```
Generate N imagenes → Human selecciona la mejor → Animar solo esa
```
Ahorro: ~60-70% en costos de animacion.

### 5. Human-in-the-Loop
La IA propone, el humano decide. Checkpoints en cada fase del pipeline.

### 6. Sandbox para Exploración
Una marca Sandbox siempre disponible para probar tools o generar contenido rápido sin configurar una marca cliente.

---

## User Flows Actuales

### Flow 1: Dashboard → Brand Management

```
/ (Home) → /dashboard (Workspace con Chat)
          → /dashboard/brands (lista de marcas)
          → Click marca → /dashboard/brands/:id (BrandWorkspace)
```

Dashboard muestra cards de marcas con conteo de avatars y voces. CRUD completo (crear, editar, eliminar). Brand switcher en sidebar — marcas reales arriba, Sandbox separado al fondo.

### Flow 2: AI Chat Assistant

```
/dashboard (Workspace) → ChatPanel
```

- Chat multi-turn con Gemini 2.5 Flash
- Contexto de marca inyectado automaticamente (avatars, productos, voces, brand guidance)
- Asset chips colapsables debajo del input
- Historial de chats por marca (localStorage)

### Flow 3: Brand Configuration

```
/dashboard/brand → BrandSettings
```

- Editar brand context (textarea)
- Subir brand guidance desde URL o PDF
- Brand DNA: colores, tono, audiencia, keywords, personalidad (generado por Gemini)
- Gestionar avatars, productos, clothing, backgrounds, moodboards
- Logo upload
- Voice presets con preview
- Prompt overrides por herramienta (agrupados por categoría: Video / Images / Other)

### Flow 4: Content Generation

```
/dashboard/generate → GeneratePage (tool registry)
                    → Click tool → /dashboard/generate/:toolId (ToolRunPage)
```

**GeneratePage**: Grid de tools con filtro por categoria (video, images). Status badges (active, coming_soon).

**ToolRunPage** (step-by-step pipeline):
1. ConfigPanel: seleccionar avatar, producto, clothing, background, moodboard, voz, parametros
2. Steps verticales con progresion automatica
3. Cada step muestra estado (idle, running, done, error)
4. Resultados ricos por tipo (imagenes, audio waveforms, video players)

### Flow 5: Content Analyzer → Route

```
/dashboard/generate/content_analyzer
  → Analyze (video upload or URL)
  → Adapt (brand-specific scenes)
  → Route panel:
      - Scene preview (script + image prompt por escena)
      - Tool suggestion auto-detected (dance → Fashion Reel, UGC → UGC Creator, etc.)
      - Click tool → navigate with sessionStorage handoff
  → Destination tool pre-loaded with adapted script + assets
```

### Flow 6: Prompt Editing

```
/dashboard/brand → PromptsCard
```

- Templates agrupados: Video (UGC Creator, Video Ad Creator, Fashion Reel, Product Clip) / Images (Static Ad, Carousel, Ad Creative Lab, etc.) / Other (Chat)
- Ver prompts default de cada herramienta
- Crear overrides por marca
- Preview de prompt interpolado con variables
- Reset a default

---

## Componentes Clave

### ChatPanel
- Area de mensajes con bubbles (usuario/AI)
- Input con textarea auto-resize
- Asset chip groups colapsables
- Sidebar de historial de chats

### ToolRunPage
- Header con nombre de tool
- ConfigPanel para parametros (assets, moodboard, settings)
- Pipeline vertical de steps con auto-run
- DoneStep con resultados ricos por tipo

### BrandSettings
- Context, DNA, Avatars, Products, Clothing, Backgrounds, Moodboards, Voices, Prompts
- Upload con preview
- Voice preview con play/stop

### PromptsCard
- Templates agrupados por categoria (Video / Images / Other)
- Expand/collapse por tool
- Edit + Preview + Reset

---

## UI/UX Principles

1. **Dark Editorial** — Pure black canvas, neutral grays, warm burgundy accent
2. **Content-First** — Assets y outputs son lo mas grande visualmente
3. **Progressive Disclosure** — Empty states con CTAs claros
4. **Real-Time Feedback** — Spinners, progress indicators
5. **Collapsible Sections** — Para listas largas

---

## Performance Considerations

- Lazy load de imagenes en grids
- Job polling cada 2s durante generacion activa
- Brand context cacheado en BrandProvider (React Context)
- Chat history en localStorage
- Async job pattern: submit → poll status → fetch result

---

## Mobile Support

Desktop-first. Mobile no es prioridad para Phase 1.
