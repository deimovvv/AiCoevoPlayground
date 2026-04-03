# Coevo Studio — Refactor Plan: Modular Tool System

## Objetivo

Convertir `ToolRunPage.tsx` (3500+ líneas, todo hardcodeado) en un sistema modular donde agregar una tool nueva = crear 1 directorio + 1 línea en registry.

---

## Estado Actual

### Completado

- `tools/types.ts` — tipos compartidos, normalizeScene, extractScenes, StepHandler, ToolDefinition
- `tools/constants.tsx` — STEP_META, TOOL_ICONS, FALLBACK_TOOLS
- `tools/usePipelineState.ts` — hook custom con todo el state del pipeline
- `tools/registry.ts` — mapa toolId → ToolDefinition
- `tools/ugc_creator/` — handlers (7 steps) + index con schema
- `tools/product_spotlight/` — handlers reutilizables (prompt, generate, variations)
- `tools/fashion_editorial/` — reutiliza product_spotlight + schema propio
- `tools/fashion_reels/` — reutiliza ugc_creator + animate propio

### Pendiente

1. **Refactorizar ToolRunPage.tsx** para usar el registry
2. **Extraer shared components** a `tools/shared/`
3. **Crear Ad Creative Lab** como tool nueva
4. **Extraer step views** por tool

---

## Arquitectura Target

```
frontend/src/
  pages/
    ToolRunPage.tsx                 # ~200 líneas, solo orquestación

  tools/
    types.ts                        # Tipos compartidos
    constants.tsx                   # Metadata de steps, iconos
    registry.ts                     # toolId → ToolDefinition
    usePipelineState.ts             # Hook con state del pipeline

    shared/
      ConfigPanel.tsx               # Form genérico basado en schema
      StepPanel.tsx                 # Header de step (run/approve/regen)
      AssetSelector.tsx             # Grid de assets con upload inline
      CurationPanel.tsx             # Selección manual de variaciones
      InfoPill.tsx                  # Helper UI

    ugc_creator/
      index.ts                      # { schema, stepHandlers, approvalSteps, autoRunSteps }
      handlers.ts                   # handleScript, handleBaseImage, handleMultishot, etc.
      views/                        # Componentes de visualización por step
        ScriptDoneView.tsx
        BaseImageDoneView.tsx
        LipsyncDoneView.tsx
        RenderDoneView.tsx

    product_spotlight/
      index.ts
      handlers.ts                   # handlePrompt, handleGenerate, handleVariations (reutilizables)

    fashion_editorial/
      index.ts                      # Reutiliza product_spotlight handlers

    fashion_reels/
      index.ts                      # Reutiliza ugc_creator handlers + animate

    ad_creative_lab/
      index.ts
      handlers.ts                   # handleVisualGuide, handlePrompts, handleGenerateBatch
      views/
        VisualGuideView.tsx
        ReviewView.tsx
```

---

## Cómo funciona

### ToolDefinition

```typescript
interface ToolDefinition {
  schema: ToolSchema;                           // Qué campos muestra el form
  stepHandlers: Record<string, StepHandler>;    // stepId → async handler
  stepViews?: Record<string, StepViewComponent>; // stepId → componente de vista
  approvalSteps?: string[];                     // Steps que requieren Approve
  autoRunSteps?: string[];                      // Steps que se auto-ejecutan
}
```

### StepHandler

```typescript
type StepHandler = (ctx: StepContext) => Promise<{
  result: unknown;
  needsApproval?: boolean;
  autoRunNext?: boolean;
}>;
```

### StepContext

```typescript
interface StepContext {
  activeBrand: Brand;
  config: ToolConfig;
  tool: ToolEntry;
  getStepResult: (stepId: string) => unknown;
  getScriptScenes: () => ScriptScene[];
  audioCache: Record<string, AudioCacheEntry>;
  setAudioCache: (sceneId: string, entry: AudioCacheEntry) => void;
}
```

### ToolRunPage refactorizado (~200 líneas)

```typescript
const handleRunStep = async (stepIndex: number) => {
  const step = steps[stepIndex];
  const toolDef = TOOL_DEFINITIONS[tool.id];
  const handler = toolDef?.stepHandlers[step.id];
  
  if (!handler) { advanceStep(stepIndex); return; }

  setStepRunning(stepIndex);
  try {
    const ctx = { activeBrand, config, tool, getStepResult, getScriptScenes, audioCache, setAudioCache };
    const { result, needsApproval } = await handler(ctx);
    advanceStep(stepIndex, result, { needsApproval });
    
    // Auto-run next if configured
    if (toolDef.autoRunSteps?.includes(steps[stepIndex + 1]?.id)) {
      setTimeout(() => handleRunStep(stepIndex + 1), 100);
    }
  } catch (err) {
    failStep(stepIndex, err instanceof Error ? err.message : "Step failed");
  }
};
```

---

## Agregar una tool nueva (después del refactor)

### 1. Backend

```bash
# Crear directorio y prompt
mkdir backend/tools/story_generator
# Escribir default_prompt.txt
# Registrar en registry.json
```

### 2. Frontend

```typescript
// tools/story_generator/index.ts
import { handlePrompt, handleGenerate } from "../product_spotlight/handlers";

export const storyGenerator: ToolDefinition = {
  schema: { showProduct: true, showVariations: false, ... },
  stepHandlers: {
    prompt: handlePrompt,
    generate: handleGenerate,
  },
  approvalSteps: ["prompt"],
};
```

```typescript
// tools/registry.ts — agregar 1 línea
import { storyGenerator } from "./story_generator";
export const TOOL_DEFINITIONS = {
  ...existing,
  story_generator: storyGenerator,
};
```

**Sin tocar ToolRunPage.tsx.**

---

## Plan de migración (incremental)

### Fase 1 — Extraer shared components
- [ ] Mover AssetSelector a tools/shared/
- [ ] Mover CurationPanel a tools/shared/
- [ ] Mover InfoPill a tools/shared/
- [ ] ToolRunPage re-importa, mismo comportamiento

### Fase 2 — Conectar registry a ToolRunPage
- [ ] Reemplazar handleRunStep if/else con registry lookup
- [ ] Reemplazar TOOL_SCHEMAS inline con registry schemas
- [ ] Verificar que todas las tools siguen funcionando

### Fase 3 — Extraer step views
- [ ] Mover ScriptDoneView, BaseImageDoneView, etc. a views/ por tool
- [ ] Conectar vía toolDef.stepViews
- [ ] DoneStep se vuelve un dispatcher genérico

### Fase 4 — Ad Creative Lab
- [ ] Crear handlers (visual_guide, prompts, generate_batch, review)
- [ ] Crear views
- [ ] Registrar en registry
- [ ] Funciona sin tocar ToolRunPage

### Fase 5 — Cleanup
- [ ] ToolRunPage < 250 líneas
- [ ] Eliminar código muerto
- [ ] Verificar end-to-end todas las tools

---

## Beneficios

| Antes | Después |
|-------|---------|
| 1 archivo de 3500 líneas | ~15 archivos de 100-300 líneas |
| Agregar tool = editar mega-archivo | Agregar tool = 1 directorio + 1 línea |
| Handlers mezclados con UI | Lógica separada de presentación |
| Schemas hardcodeados | Cada tool define su propio schema |
| Steps no reutilizables | handlePrompt, handleGenerate reutilizables |
