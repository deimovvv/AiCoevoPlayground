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
- Assets disponibles (avatars, productos, ropa)
- Prompts customizados por herramienta
- Voice presets

**Resultado**: Seleccionar assets -> generar -> revisar. Listo.

### 2. Asset Library como Single Source of Truth
Subir asset una vez, usar en todas las herramientas:
- **Avatars**: Personas/modelos con descripciones detalladas
- **Products**: Productos con imagenes
- **Clothing**: Wardrobe options para avatars
- **Voices**: Voice presets de ElevenLabs

### 3. Prompts as Templates, Not Hardcode
Los prompts son plantillas editables con variables:
```
Default: "Generate a UGC video for {brand_name} featuring {product_name}..."
Override: "Crea un video UGC bien argento para {brand_name}..."
```
Cada marca puede customizar el "lenguaje" de la IA sin tocar codigo.

### 4. Multishot Before Animation
Generar opciones, curar la mejor, y solo despues animar:
```
Generate 5 imagenes -> AI + Human curan la mejor -> Animar solo esa
```
Ahorro: ~60-70% en costos de animacion.

### 5. Human-in-the-Loop
La IA propone, el humano decide. Checkpoints en cada fase del pipeline.

---

## User Flows Actuales

### Flow 1: Dashboard -> Brand Management

```
/ (Home) -> /dashboard (Workspace con Chat)
         -> /dashboard/brands (lista de marcas)
         -> Click marca -> /dashboard/brands/:id (BrandWorkspace)
```

Dashboard muestra cards de marcas con conteo de avatars y voces. CRUD completo (crear, editar, eliminar). Brand switcher en sidebar para cambio rapido.

### Flow 2: AI Chat Assistant

```
/dashboard (Workspace) -> ChatPanel
```

- Chat multi-turn con Gemini 2.5 Flash
- Contexto de marca inyectado automaticamente (avatars, productos, voces, brand guidance)
- Asset chips colapsables debajo del input (avatars, products, voices)
  - Maximo 3 visibles, "+N more" para expandir
  - Click inserta `[avatar: Name]` en el mensaje
- Tool quick actions: UGC Creator, Ad Creative, Social Post, All Tools
- Historial de chats por marca (localStorage)

### Flow 3: Brand Configuration

```
/dashboard/brand -> BrandSettings
```

- Editar brand context (textarea)
- Subir brand guidance desde URL o PDF
- Gestionar avatars (subir imagen, nombre, descripcion, sync HeyGen)
- Gestionar productos (subir imagen, nombre, descripcion)
- Gestionar clothing items
- Voice presets con preview (play button para escuchar sample TTS)
- Prompt overrides por herramienta (PromptsCard)

### Flow 4: Content Generation

```
/dashboard/generate -> GeneratePage (tool registry)
                    -> Click tool -> /dashboard/generate/:toolId (ToolRunPage)
```

**GeneratePage**: Grid de tools con filtro por categoria (images, video, copy). Status badges (active, coming_soon).

**ToolRunPage** (step-by-step pipeline):
1. ConfigPanel: seleccionar avatar, producto, voz, parametros
2. Steps verticales con progresion automatica
3. Cada step muestra estado (idle, running, done, error)
4. Resultados ricos por tipo (imagenes, audio waveforms, video players)
5. Mock Preview disponible para visualizar sin APIs

### Flow 5: Prompt Editing

```
/dashboard/brand -> PromptsCard
```

- Ver prompts default de cada herramienta
- Crear overrides por marca
- Preview de prompt interpolado con variables
- Reset a default

---

## Componentes Clave

### ChatPanel
- Area de mensajes con bubbles (usuario/AI)
- Input con textarea auto-resize
- Asset chip groups colapsables (AssetChipGroup)
- Tool quick actions
- Sidebar de historial de chats

### ToolRunPage
- Header con nombre de tool y acciones (Mock Preview)
- ConfigPanel para parametros
- Pipeline vertical de steps
- DoneStep con resultados ricos por tipo

### BrandSettings
- Tabs: Context, Avatars, Products, Clothing, Voices, Prompts
- Upload con preview
- Voice preview con play/stop

### GenerationBoard
- Card-based view de generaciones
- Status badges por fase
- Timeline visual de progreso

---

## UI/UX Principles

1. **Dark Editorial** — Pure black canvas, neutral grays, warm burgundy accent
2. **Content-First** — Assets y outputs son lo mas grande visualmente
3. **Progressive Disclosure** — Empty states con CTAs claros, wizards para flujos complejos
4. **Real-Time Feedback** — Spinners, progress indicators, phase timelines
5. **Collapsible Sections** — Para listas largas (asset chips, sidebar navigation)

---

## Performance Considerations

- Lazy load de imagenes en grids
- Job polling cada 2s durante generacion activa
- Brand context cacheado en BrandProvider (React Context)
- Chat history en localStorage
- Async job pattern: submit -> poll status -> fetch result

---

## Mobile Support

Desktop-first. Mobile no es prioridad para Phase 1.
