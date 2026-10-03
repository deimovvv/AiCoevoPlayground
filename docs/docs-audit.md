# Auditoría de documentación — 2026-10-03

> ✅ **Ejecutada el mismo día.** CLAUDE.md achicado; 10 docs archivados en
> `docs/archive/`; `stack.md` y `tools.md` borrados; `design` + `design_language`
> fusionados en `openspec/specs/design-system`; `pending-features` reemplazado por
> `backlog.md`; correcciones puntuales en 7 docs; `decisions-log` con índice de
> vigentes y entradas superadas marcadas. Código muerto: 18 archivos, 19 funciones de
> `api.ts`, `generate_batch` y 15 endpoints. Lo de abajo es el diagnóstico original.

Los 30 docs de `docs/` + `CLAUDE.md`, contrastados contra el código. Objetivo:
gastar menos tokens por sesión, que lo que lea un agente sea cierto, y dejar
todo listo para migrar a **OpenSpec**.

**Método:** dos lecturas en paralelo contra `frontend/src` y `backend/`, más
verificación directa de los conteos y de los hallazgos de mayor impacto.

---

## 1. El costo

| | Tokens | Cuándo se paga |
|---|---|---|
| `CLAUDE.md` | **~4.500** | **en cada sesión**, la use o no |
| Todo `docs/` | ~93.500 | cuando un agente abre un doc |

**El ahorro grande está en CLAUDE.md**, no en `docs/`. Hoy describe un sistema
que ya no existe:

| CLAUDE.md dice | El código dice |
|---|---|
| 15 páginas | 29 |
| 51 endpoints | 196 |
| 11 servicios | 39 |
| registry de 6 tools | 17 tools, 19 entradas en `registry.json` |
| Kling V2.6 | Kling V3 Pro por defecto |
| acento burgundy `#c45830`, canvas `#000000` | rosa `#ff5f8f`, canvas `#0b0b0c` |
| UGC de 7 pasos | 6 |
| Client Portal "planeado, requiere auth" | existe, por token |

Le faltan Seedance/kie.ai, Veo, `llm_router`, Campañas, el Portal, el ledger de
costos y el motor de nodos. Y el índice de docs (~35 líneas) no hace falta en
cada sesión.

**Propuesta: CLAUDE.md de ~900 tokens** con sólo lo que un agente necesita
siempre — qué es, comandos, 5 gotchas del mapa, reglas duras, y punteros a
[MAP.md](MAP.md) y `openspec/`. Ahorro: ~3.600 tokens por sesión.

---

## 2. Veredicto por documento

**Acción:** `C` conservar · `A` actualizar · `F` fusionar · `Ar` archivar · `B` borrar

### Se reemplazan por el mapa
| Doc | Estado | Acción | Por qué |
|---|---|---|---|
| `architecture.md` | desactualizado | **F → MAP + project.md** | dice ManualLab v1, 11 de 39 servicios, sin kie/Veo/Campañas |
| `stack.md` | desactualizado y duplicado | **B** | todo lo que tiene está en CLAUDE.md, architecture y setup |
| `planning.md` | **obsoleto** | **Ar** | roadmap de junio; el portal que planea ya existe |
| `product_vision_ux.md` | desactualizado | **F → MAP**, flujos a **Ar** | flujos de una navegación que ya no existe |
| `tools.md` | desactualizado | **B** (lo reemplaza `tools-audit.md` + MAP) | dice 11 tools; dice que Fashion Editorial "nunca se implementó" |
| `pipeline.md` | desactualizado | **A → un spec por tool** | lipsync sólo HeyGen; faltan 8 tools; documenta Static Ad oculto |

### Diseño: dos docs que se contradicen
| Doc | Estado | Acción |
|---|---|---|
| `design.md` | se contradice: encabezado rosa, cuerpo burgundy; radios viejos | **F con design_language → `specs/design-system`** |
| `design_language.md` | dice acción "lime `#BCFC11`" (es `#F5F5F5`); primitivos que no existen | **F** (idem) |

### Specs de capacidad (van a `openspec/specs/`)
| Doc | Estado | Acción | Destino |
|---|---|---|---|
| `workspace-template.md` | desactualizado | **A** | `specs/workspace-layout` |
| `video-ad-creator.md` | vigente | **C**, absorbe lo vigente de `video-dialogue-pipeline` | `specs/video-ad-creator` |
| `campaigns.md` | **obsoleto** | **Ar** y reescribir desde el código | `specs/campaigns` |
| `architecture-nodes.md` | vigente (fases 0–2 hechas) | **dividir** | hecho → `specs/node-engine`; resto → `changes/` |
| `pricing-credits.md` | vigente | **dividir** | fase 1 → `specs/cost-tracking`; fase 2 → `changes/client-credits` |

`workspace-template.md` dice que las tools siguen con el layout viejo
(Fashion Reel y Ecommerce Pack ya están migrados) y su tabla §8 quedó con el
markdown roto.

### Propuestas (van a `openspec/changes/`)
| Doc | Estado | Acción | Destino |
|---|---|---|---|
| `fashion-reel-recipes.md` | dice "sin implementar"; la UI existe | **A** el estado | `changes/fashion-reel-format-recipes` |
| `video-editor.md` | vigente | **C** | `changes/shared-video-editor` |
| `video-dialogue-pipeline.md` | desactualizado; se pisa con video-ad-creator | **F** gotchas → video-ad-creator; resto → change | `changes/video-ad-per-shot-selector` |
| `pending-features.md` | mezcla hecho con pendiente | **dividir; borrar lo hecho** | un `changes/<nombre>` por ítem abierto |
| `frontera-diseno-infra.md` | parcial | **dividir y Ar** | recetas → change; el proceso entre chats queda fuera |
| `dashboard-architecture-research.md` | **obsoleto** como propuesta (casi todo hecho) | **Ar** | quedan abiertas: login, "¿campaña = proyecto?" |

`pending-features.md` lista como pendientes cosas que ya existen: el portal de
cliente, la persistencia de pipeline, el renderer de Remotion
(`subtitle_render.py`), el Lab estilo Freepik. Tiene dos secciones "8".

### Historia y decisiones
| Doc | Estado | Acción |
|---|---|---|
| `decisions-log.md` | vigente como bitácora, **con entradas superadas sin marcar** | **partir en ADRs** con `status: superseded-by` + índice de vigentes |
| `tools-audit.md` | desactualizado (Fashion Editorial ya se ejecutó) | **A**, después el criterio → `specs/tool-catalog` y el resto **Ar** |

Entradas del log que contradicen decisiones posteriores sin decirlo: Fraunces
(hoy Instrument Serif), paleta burgundy (hoy rosa), "Coevo World" (eliminado),
"Fashion Editorial decidido, NO ejecutado" (ejecutado en `b42fde6`).

### Fuera de OpenSpec (negocio, research, operativos)
| Doc | Estado | Acción |
|---|---|---|
| `competitive-research.md` | vigente | **C** |
| `market-positioning.md` | vigente | **C** |
| `financial-model.md` | vigente, plantea el SaaS como plan | **C** con nota: el SaaS es etapa posterior |
| `video-ad-production-sop.md` | vigente | **C** (SOP); su tabla de gaps → change |
| `client_onboarding.md` | vigente | **C** (SOP) |
| `onboarding.md` | vigente, 2 nombres viejos | **A** dos líneas ("Trabajo" → Campañas; "Coevo Studio" → Generar) |
| `setup.md` | costos viejos | **A** (sacar la tabla de costos) |
| `ugc-audio.md` | desactualizado (precios de Fal, falta Veo) | **A** o **F** con talking-head-tests |
| `ugc-talking-head-tests.md` | vigente | **C** como histórico |

### Nuevos
| Doc | |
|---|---|
| [MAP.md](MAP.md) | el overview: estado actual + proyección funcional. Borrador de `openspec/project.md` |
| `docs-audit.md` | este archivo |

---

## 3. Resumen

| Acción | Docs |
|---|---|
| Conservar | 8 |
| Actualizar | 7 |
| Fusionar / dividir | 10 |
| Archivar | 3 |
| **Borrar** | **2** (`stack.md`, `tools.md`) |
| **Total** | **30** |

Pocos se borran del todo: la mayoría tiene algo vigente adentro. El problema no
es que sobren docs, es que **mezclan lo hecho con lo propuesto y lo vigente con
lo histórico**. Eso es exactamente lo que OpenSpec separa.

---

## 4. Bugs del producto encontrados al auditar

| | Qué | Evidencia |
|---|---|---|
| 1 | ~~Veo probablemente falla en UGC Creator~~ **Descartado** | Se apoyaba en que `GEMINI_API_KEY` da 403. Verificado el 2026-10-03: **ya no da 403**, genera texto OK y ve los 3 modelos Veo. El dato viejo venía de septiembre |
| 2 | La receta de Fashion Reel no llega al generador | `recipe` es estado local (`ToolRunPage.tsx:956`); `fashion_reel/handlers.ts` no la lee |
| 3 | `pricing.ts:34` cotiza `v2-6-std` | ese endpoint no existe en Fal (404) |

---

## 5. Cómo se mapea a OpenSpec

```
openspec/
├── project.md              ← MAP.md + lo global de CLAUDE.md (stack, convenciones)
├── specs/                  ← LO QUE EL SISTEMA HACE HOY
│   ├── workspace-layout/      (workspace-template.md)
│   ├── design-system/         (design.md + design_language.md)
│   ├── tool-catalog/          (criterio de tools-audit.md)
│   ├── campaigns/             (reescrito desde el código)
│   ├── video-ad-creator/      (video-ad-creator.md)
│   ├── node-engine/           (architecture-nodes.md, fases 0–2)
│   ├── cost-tracking/         (pricing-credits.md, fase 1)
│   └── <una por tool>/        (pipeline.md repartido)
├── changes/                ← LO PROPUESTO
│   ├── fashion-reel-format-recipes/
│   ├── shared-video-editor/
│   ├── campaigns-as-hub/      (falta escribir)
│   ├── casting/               (falta escribir)
│   ├── ecommerce-pack-gates/
│   └── … (uno por ítem abierto de pending-features)
└── archive/                ← LO HECHO Y LO VIEJO
    └── planning.md, campaigns.md, dashboard-architecture-research.md, ADRs superados

docs/                       ← FUERA DE OPENSPEC
    MAP.md (hasta migrar), negocio, research, SOPs
```

**Lo que más le sirve a OpenSpec de entrada:** que `specs/` tenga **sólo lo
vigente**. Hoy un agente que abre `pending-features.md` no puede saber qué de
eso ya existe; en OpenSpec, lo que está en `specs/` existe y lo que está en
`changes/` no.

---

## 6. Código muerto

Inventario de sólo lectura, verificado con controles (archivos que sabemos vivos
dan ≥1 importador; los muertos dan 0). **Nada se borró.**

### Riesgo BAJO — ~9.300 líneas

El 93% son 18 archivos completos de frontend que nadie importa:

| Qué | Líneas | Nota |
|---|---|---|
| `pages/ManualLab.tsx` | 2.246 | Lab v1. Import **comentado** en `App.tsx:27` |
| `pages/BrandWorkspace.tsx` | 2.195 | sin ruta, sin importador |
| …y los 6 componentes que sólo usa él: `NewGenerationWizard`, `PipelineMonitor`, `GenerationDetailDrawer`, `GenerationBoard`, `GenerationCard`, `HeygenAvatarSelector` | 2.384 | se van juntos |
| `ActivePipelineDrawer`, `BrandPanel`, `PipelineTimeline` | 968 | sin importador |
| `layout/TopNav`, `layout/BrandSwitcher` | 351 | `AppLayout` usa `Sidebar` + `BrandPicker` |
| `pages/DashboardOverview`, `CampaignsPage`, `Workspace` | 363 | `/dashboard/campanas` lo sirve `WorkPage`, no `CampaignsPage` |
| `ui/section.tsx`, `ui/card.tsx` | 157 | |
| ~19 exports de `lib/api.ts` sin uso | ~300 | |
| ~12 endpoints de `main.py` que sólo llama código muerto | ~310 | heygen talking-photos, `/api/lipsync`, suggest-tool… |
| `content_analyzer.generate_batch` | ~50 | no está en el pipeline del backend |

### Riesgo MEDIO / ALTO — no tocar sin decidir

| Qué | Por qué no |
|---|---|
| `heygen.py` | **sigue vivo**: el upload de avatar sube a HeyGen por defecto (`main.py:1576`). Hay que cortar ese default primero |
| Tools ocultas (`static_ad`, `ad_creative_lab`, `fashion_editorial`, ~1.540 líneas) | `ToolRunPage` importa constantes de `fashion_editorial`; `content_analyzer` lanza `ad_creative_lab`; `agent.py` y `manual_lab.py` todavía las recomiendan |
| Consistencia en `ManualLabV2.tsx` | pausada a propósito |
| Motor de nodos (`/api/nodes`, `/api/graph/*`) | Fase 1, agregado a propósito |
| `backend/tools/` sin registro (`ugc_multishot`, `reel_creator`…) | `prompt_builder` las lista por `iterdir()` |
| `/api/maintenance/convert-heic`, `/api/llm/health` | se pueden llamar a mano |

**Falso positivo descartado:** `backend/tools/chat` parece huérfano pero lo usa
`prompt_builder.build_prompt("chat", …)`. Ningún servicio de `backend/services/`
está huérfano.

### Orden de limpieza sugerido

1. Los 18 archivos de frontend (riesgo bajo, no tocan código vivo). Build verde = listo.
2. Los exports de `api.ts` y endpoints que quedan huérfanos después del paso 1.
3. `generate_batch` de content_analyzer.
4. Recién con decisión: HeyGen legacy y las tools ocultas.

Cada paso es un commit propio, para poder revertir uno sin tocar los otros.
