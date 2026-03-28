# Coevo Creative OS — Product Vision & UX

**Coevo Creative OS** es la herramienta interna de Coevo (agencia) para gestionar la creación de contenido publicitario y marketing para múltiples marcas cliente.

---

## Propósito Core

Transformar a Coevo en una **agencia potenciada por IA** donde:
- Los creativos se enfocan en estrategia y dirección
- La IA ejecuta la producción técnica (generación de imágenes, videos, scripts)
- El equipo revisa y aprueba contenido de alta calidad en minutos (no horas/días)
- Cada marca tiene su propio "contexto" que hace que las herramientas generen contenido consistente

---

## Filosofía de Producto

### 1. Context-Aware Everything
**Principio**: No más copy-paste de prompts ni configuración manual repetitiva.

Cuando trabajas dentro de "Taller Santa Clara", **todo** conoce el contexto:
- Brand guidance (tono, estilo, target)
- Assets disponibles (avatars, productos, ropa, fondos)
- Briefs activos de campañas
- Prompts customizados por herramienta

**Resultado**: Click → select assets → generate → review. Listo.

### 2. Asset Library como Single Source of Truth
**Principio**: Subir asset una vez, usar en todas las herramientas.

Cada marca tiene su biblioteca de assets:
- **Avatars**: Personas/modelos con descripciones detalladas
- **Products**: Productos con PNG transparente
- **Clothing**: Wardrobe options para avatars
- **Backgrounds**: Escenas y fondos pre-aprobados

**Beneficio**: Consistency automática + reutilización eficiente.

### 3. Prompts as Templates, Not Hardcode
**Principio**: Los prompts son plantillas editables con variables.

```
Default prompt:
"Generate a UGC video for {brand_name} featuring {product_name}..."

Custom override (por marca):
"Creá un video UGC bien argento para {brand_name}. Vas a hablar del {product_name}..."
```

**Beneficio**: Cada marca puede customizar el "lenguaje" de la IA sin tocar código.

### 4. Multishot Before Animation
**Principio**: Generar opciones, curar la mejor, y solo después animar.

Pipeline tradicional (caro):
```
Generate 1 video → Review → Si está mal, regenerar todo
```

Pipeline Coevo (eficiente):
```
Generate 5 imágenes → AI + Human curan la mejor → Animar solo esa
```

**Ahorro**: ~60-70% en costos de animación.

### 5. Human-in-the-Loop, Not Full Automation
**Principio**: La IA propone, el humano decide.

Checkpoints humanos:
- ✅ Aprobar guión generado
- ✅ Elegir mejor toma (multishot curation)
- ✅ Aprobar audio
- ✅ Aprobar video final

**Beneficio**: Control de calidad + aprendizaje continuo del equipo.

---

## User Flows

### Flow 1: Onboarding de Nueva Marca

```
1. Dashboard → "Nueva Marca"
2. Ingresa nombre: "Taller Santa Clara"
3. Sube logo (opcional)
4. Pega URL de website (opcional, para auto-extract brand guidance)
5. O escribe brand guidance manualmente:
   "Marca de ropa artesanal argentina, tono cercano..."
6. Sistema crea:
   - Brand ID (slug)
   - Carpeta de assets
   - Prompts default para todas las tools
7. → Redirect a Brand Workspace (empty state)
```

### Flow 2: Gestión de Assets

```
Brand Workspace → Tab "Assets"

├── Avatars
│   ├── [Empty state] "Sube tu primer avatar"
│   ├── Click "Upload"
│   ├── Select image (PNG/JPG)
│   ├── Form:
│   │   - Nombre del avatar: "Elías"
│   │   - Descripción: "Hombre de 32 años, argentino, casual urbano..."
│   │   - Tags: masculino, 30s, casual
│   ├── Save
│   └── Avatar aparece en galería

├── Products
│   └── [Similar flow, pero más simple: nombre + imagen]

├── Clothing
│   └── [Similar: descripción del outfit]

└── Backgrounds
    └── [Similar: descripción de la escena + mood + lighting]
```

### Flow 3: Crear Contenido Static (Quick Example)

```
Brand Workspace → "Nueva Generación" → "Static Content"

Form:
├── Select Avatar: [Grid de avatars de la marca]
├── Select Product: [Grid de productos]
├── Clothing (optional): [Dropdown o ninguno]
├── Background (optional): [Grid o ninguno]
├── Additional notes: "Foto lifestyle, outdoor, luz natural"
└── [Generate]

Backend:
1. Load brand guidance
2. Load tool prompt (static_content)
3. Gemini builds final prompt con todas las variables
4. Nano Banana 2 generates image
5. Job ID → Frontend polls status

Result:
├── Image preview
├── [Download] button
└── [Regenerate] button
```

### Flow 4: Crear UGC Video (Full Pipeline)

```
Brand Workspace → "Nueva Generación" → "UGC Video"

Wizard Step 1 - Setup:
├── Select Avatar
├── Select Product
├── Clothing (optional)
├── Duration: 20s / 30s / 45s
├── Campaign brief (optional textarea)
└── [Start Pipeline]

Step 2 - Script Review (after ~10s):
├── Shows generated 5-act script
├── User can edit cada línea
├── [Approve & Continue] → goes to multishot

Step 3 - Multishot Generation (after ~2 min):
├── Shows 3-5 variations per scene
├── AI recommendation highlighted
├── User can:
│   ├── Click otra variación to select
│   ├── [Regenerate Scene] solo esa escena
│   └── [Approve All] to continue
└── [Continue to Audio]

Step 4 - Audio Review (after ~30s):
├── Audio player per scene
├── [Play] buttons
└── [Approve & Animate] (caro, confirmar)

Step 5 - Lip-Sync Animation (after ~5 min):
├── Progress bar
├── When done: video preview per scene
└── [Render Final Video]

Step 6 - Final Result:
├── Full video preview
├── [Download MP4]
├── [Share Link]
└── Save to brand's generation history
```

### Flow 5: Editar Prompts de Tools

```
Brand Workspace → Tab "Prompts"

List de tools:
├── Static Content
│   ├── Status: Using default prompt
│   └── [Edit]
├── Video Reels
│   ├── Status: Custom override active
│   └── [Edit]
└── UGC Video
    ├── Status: Using default prompt
    └── [Edit]

Click [Edit] → Opens Prompt Editor:
├── Monaco editor (syntax highlighting)
├── Available variables panel:
│   - {brand_name}
│   - {avatar_description}
│   - {product_name}
│   - etc.
├── [Preview] button (shows interpolated example)
├── [Reset to Default] button
└── [Save] button
```

### Flow 6: AI Chat Assistant (Future)

```
Global sidebar → Chat icon

Chat window opens:
User: "Crea un reel para el nuevo buzo de Taller Santa Clara"

AI:
1. Detects brand context (Taller Santa Clara)
2. Detects intent (create video reel)
3. Loads brand assets
4. Asks: "¿Qué avatar querés usar?" [shows avatar grid]
5. User selects avatar
6. AI: "Perfecto. Iniciando generación de reel..."
7. Executes "Video Reels" tool behind the scenes
8. Returns: "Listo! Tu reel está generándose. Te aviso cuando esté."
9. [View Generation] button
```

**Benefit**: Natural language interface para todos los workflows.

---

## UI/UX Principles

### 1. Dark Editorial Design
- Pure black canvas background (#000000)
- Neutral grays for surfaces (#141414, #1c1c1c)
- Warm burgundy accent (#c45830) para brand identity
- Zero blue — solo neutrales + warm accent

### 2. Content-First Layout
- Assets y outputs son lo más grande visualmente
- Minimal chrome/UI
- Generaciones mostradas como cards grandes con previews

### 3. Clear Hierarchy
```
Dashboard (overview)
  └── Brand Workspace (context hub)
      ├── Assets (library)
      ├── Generations (history)
      ├── Prompts (templates editor)
      └── Settings (brand config)
```

### 4. Progressive Disclosure
- Empty states con clear CTAs
- Wizards para flujos complejos (UGC video)
- Forms simples para flujos quick (static content)

### 5. Real-Time Feedback
- Job status polling
- Progress indicators
- Phase-by-phase timeline
- Error messages con retry options

---

## Key UI Components

### Brand Context Badge
**Where**: Sidebar top, cuando estás dentro de un brand workspace

```
┌─────────────────────┐
│ 🏢 Taller Santa Clara │
│ ↗ Exit to Dashboard  │
└─────────────────────┘
```

### Asset Selector Grid
**Usage**: When selecting avatar/product/etc en tool forms

```
┌────────┬────────┬────────┐
│ [IMG]  │ [IMG]  │ [IMG]  │
│ Elías  │ María  │ Carlos │
│ ✓      │        │        │
└────────┴────────┴────────┘
```

### Generation Card
**Usage**: Brand Workspace generations history

```
┌─────────────────────────────────┐
│ UGC Video - Remera White        │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━    │ 85% Complete
│                                 │
│ Script → Multishot → Curation  │
│   ✓        ✓          ⟳        │ (live progress)
│                                 │
│ [View Details] [Cancel]         │
└─────────────────────────────────┘
```

### Multishot Review Chamber
**Usage**: AI curation step con human override

```
┌────────────────────────────────────────┐
│ Scene 1: Hook                          │
│ AI Recommendation: Variation 2 (94/100)│
│                                        │
│ ┌───────┬───────┬───────┬───────┐    │
│ │ Var 1 │ Var 2 │ Var 3 │ Var 4 │    │
│ │ [IMG] │ [IMG] │ [IMG] │ [IMG] │    │
│ │ 87/100│ 94/100│ 82/100│ 79/100│    │
│ │       │  ✓ AI │       │       │    │
│ └───────┴───────┴───────┴───────┘    │
│                                        │
│ Reasoning: "Mejor iluminación facial, │
│ expresión natural, producto visible"   │
│                                        │
│ [Use AI Pick] [Override →]             │
│ [Regenerate Scene]                     │
└────────────────────────────────────────┘
```

### Prompt Editor
**Usage**: Brand workspace → Prompts tab

```
┌──────────────────────────────────────┐
│ UGC Video Prompt Template            │
│ Status: Using default                │
│ ──────────────────────────────────── │
│                                      │
│ [Monaco Editor]                      │
│ You are creating a UGC video for    │
│ {brand_name}.                        │
│                                      │
│ BRAND CONTEXT:                       │
│ {brand_guidance}                     │
│ ...                                  │
│                                      │
│ ──────────────────────────────────── │
│ Available Variables:                 │
│ • {brand_name}                       │
│ • {avatar_description}               │
│ • {product_name}                     │
│ • {duration}                         │
│ ...                                  │
│                                      │
│ [Preview] [Reset to Default] [Save] │
└──────────────────────────────────────┘
```

---

## Empty States

### Brand Workspace - No Assets
```
┌────────────────────────────────┐
│         📦                      │
│   No assets uploaded yet       │
│                                │
│ Upload your first avatar or    │
│ product to start generating    │
│ content.                       │
│                                │
│   [Upload Avatar]              │
│   [Upload Product]             │
└────────────────────────────────┘
```

### Brand Workspace - No Generations
```
┌────────────────────────────────┐
│         🎬                      │
│   No content generated yet     │
│                                │
│ Start by creating your first   │
│ static image or video.         │
│                                │
│   [Static Content]             │
│   [Video Reel]                 │
│   [UGC Video]                  │
└────────────────────────────────┘
```

---

## Mobile Experience

**Strategy**: Desktop-first, mobile secondary.

Mobile layout (future):
- Sidebar collapses to hamburger menu
- Asset grids become single column
- Generation cards stack vertically
- Multishot review shows one variation at a time (swipe)

---

## Performance Considerations

### Asset Loading
- Lazy load images in grids
- Thumbnail previews (200x200) for asset selectors
- Full resolution only on demand

### Job Polling
- Poll every 2s during active generation
- Exponential backoff when idle
- WebSocket upgrade in future phases

### Caching
- Cache brand context in session storage
- Cache asset metadata in IndexedDB (future)
- Cache generation history (paginated)

---

## Accessibility

- Keyboard navigation for all workflows
- ARIA labels para asset grids
- Alt text for all generated content
- High contrast mode compatible (dark theme already high contrast)

---

## Metrics & Analytics (Future)

Track:
- Generation success rate por tool
- Average time per phase
- Most used assets per brand
- Cost per generation (API usage)
- Human override rate en AI curation

---

## Next Phase Features

### Phase 2
- Real-time collaboration (multiple users en brand workspace)
- Comments on generations
- Approval workflows
- Version history

### Phase 3
- Batch generation (multiple videos at once)
- Scheduling & auto-publish
- A/B testing de variations
- Analytics dashboard per brand

### Phase 4
- API pública para clientes
- White-label brand dashboard
- Marketplace de prompts y assets
- Team permissions & roles