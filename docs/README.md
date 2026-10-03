# Documentación — índice

**Empezá por [MAP.md](MAP.md)**: qué hace la app hoy y hacia dónde va.
El estado de cada doc (vigente, desactualizado, a archivar) está en
[docs-audit.md](docs-audit.md).

> Este índice vivía en `CLAUDE.md`, que se carga en cada sesión. Se movió acá
> el 2026-10-03 para ahorrar tokens: un agente lo abre sólo cuando lo necesita.

---

## Para orientarse
| Doc | Qué es |
|---|---|
| [MAP.md](MAP.md) | **el mapa**: estado actual + proyección funcional |
| [decisions-log.md](decisions-log.md) | por qué algo está como está — leer antes de reabrir una discusión |
| [setup.md](setup.md) | correrlo en local, variables de entorno, debugging |
| [onboarding.md](onboarding.md) | guía para alguien que entra al proyecto |
| [docs-audit.md](docs-audit.md) | estado de cada doc + código muerto + mapeo a OpenSpec |

## Producto y specs
| Doc | Qué es |
|---|---|
| [workspace-template.md](workspace-template.md) | el patrón de pantalla compartido (controles · selector · canvas) |
| [tools-audit.md](tools-audit.md) | qué tools se justifican, contra el criterio "pipeline con aprobaciones" |
| [fashion-reel-recipes.md](fashion-reel-recipes.md) | recetas de formato derivadas de video real (propuesta, UI hecha) |
| [video-editor.md](video-editor.md) | editor con timeline que reemplaza el Render (propuesta) |
| [video-ad-creator.md](video-ad-creator.md) | spec del Video Ad Creator |
| [video-dialogue-pipeline.md](video-dialogue-pipeline.md) | diálogo por plano, lip-sync, costos |
| [architecture-nodes.md](architecture-nodes.md) | motor de nodos (fases 0–2 hechas) |
| [pricing-credits.md](pricing-credits.md) | créditos y ledger de costos |
| [backlog.md](backlog.md) | ideas y features sin trabajar; lo que se empieza pasa a `openspec/changes/` |

## Diseño
Sistema de diseño → `openspec/specs/design-system/spec.md`. Fuente de verdad de los
tokens: `frontend/src/index.css`.

## Negocio
| Doc | Qué es |
|---|---|
| [market-positioning.md](market-positioning.md) | nicho: video × español × calce |
| [competitive-research.md](competitive-research.md) | competidores verificados |
| [financial-model.md](financial-model.md) | márgenes, descarte, "turista de IA" |
| [client_onboarding.md](client_onboarding.md) | qué pedirle a un cliente nuevo |

## Video, audio y operación
| Doc | Qué es |
|---|---|
| [video-ad-production-sop.md](video-ad-production-sop.md) | SOP del operador (PROMAN) |
| [ugc-audio.md](ugc-audio.md) | voz rioplatense: por qué ElevenLabs y no audio nativo |
| [ugc-talking-head-tests.md](ugc-talking-head-tests.md) | pruebas de lip-sync |

## Specs (OpenSpec)
| Dónde | Qué |
|---|---|
| `openspec/specs/` | lo que el sistema hace hoy: workspace-layout, tool-catalog, video-generation, design-system |
| `openspec/changes/` | lo propuesto: campaigns-as-hub, casting, shared-video-editor, fashion-reel-format-recipes, ecommerce-pack-gates |

## Archivo — histórico, no usar como fuente
[archive/](archive/): `planning`, `campaigns` (spec original), `architecture`,
`product_vision_ux`, `pipeline`, `design`, `design_language`,
`dashboard-architecture-research`, `frontera-diseno-infra`,
`pending-features-2026-09`. Reemplazados por [MAP.md](MAP.md), `openspec/` y
[backlog.md](backlog.md). Borrados: `stack.md`, `tools.md` (estaban en git).
