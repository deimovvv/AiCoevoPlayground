# Documentación — índice

**Empezá por [MAP.md](MAP.md)**: qué hace la app hoy y hacia dónde va.

**Cómo está ordenado (2026-10-09):** lo que el sistema hace hoy → `openspec/specs/`; lo que se
está construyendo → `openspec/changes/`; acá, todo lo demás, en tres carpetas:
`negocio/` (precios, mercado, competencia, clientes) · `producto/` (diseño y auditorías) ·
`guias/` (cómo hacer). Lo viejo, en `archive/`.
El estado de cada doc (vigente, desactualizado, a archivar) está en
[docs-audit.md](archive/docs-audit.md).

> Este índice vivía en `CLAUDE.md`, que se carga en cada sesión. Se movió acá
> el 2026-10-03 para ahorrar tokens: un agente lo abre sólo cuando lo necesita.

---

## Para orientarse
| Doc | Qué es |
|---|---|
| [MAP.md](MAP.md) | **el mapa**: estado actual + proyección funcional |
| [decisions-log.md](decisions-log.md) | por qué algo está como está — leer antes de reabrir una discusión |
| [setup.md](guias/setup.md) | correrlo en local, variables de entorno, debugging |
| [onboarding.md](guias/onboarding.md) | guía para alguien que entra al proyecto |
| [produccion.md](guias/produccion.md) | llevarlo a producción: Hostinger VPS + Cloudflare, paso a paso, quién hace qué |
| [como-funciona-studio-online.md](guias/como-funciona-studio-online.md) | **para aprender**: servidor, túnel, Access, el sello (JWT), la base, el MCP y el circuito de una entrega, sin tecnicismos |
| [postiz-y-pauta.md](guias/postiz-y-pauta.md) | publicar vs pautar, Postiz en una frase, quién paga qué, cómo se conecta un cliente |
| [docs-audit.md](archive/docs-audit.md) | estado de cada doc + código muerto + mapeo a OpenSpec |

## Producto y specs
| Doc | Qué es |
|---|---|
| [operacion.md](producto/operacion.md) | **borrador**: formatos que ofrecemos vs skills que los hacen, y el día a día de quien opera una marca |
| [workspace-template.md](producto/workspace-template.md) | el patrón de pantalla compartido (controles · selector · canvas) |
| [tools-audit.md](producto/tools-audit.md) | qué tools se justifican, contra el criterio "pipeline con aprobaciones" |
| [fashion-reel-recipes.md](producto/fashion-reel-recipes.md) | recetas de formato derivadas de video real (propuesta, UI hecha) |
| [video-editor.md](producto/video-editor.md) | diseño original del editor. **Lo vigente:** `openspec/specs/video-editor/` (contrato + referencia de `timeline.json` y API) |
| [video-ad-creator.md](producto/video-ad-creator.md) | spec del Video Ad Creator |
| [video-dialogue-pipeline.md](producto/video-dialogue-pipeline.md) | diálogo por plano, lip-sync, costos |
| [architecture-nodes.md](producto/architecture-nodes.md) | motor de nodos (fases 0–2 hechas) |
| [pricing-credits.md](negocio/pricing-credits.md) | créditos y ledger de costos |
| [backlog.md](backlog.md) | ideas y features sin trabajar; lo que se empieza pasa a `openspec/changes/` |

## Diseño
Sistema de diseño → `openspec/specs/design-system/spec.md`. Fuente de verdad de los
tokens: `frontend/src/index.css`.

## Negocio
| Doc | Qué es |
|---|---|
| [que-es-coevo-studio.md](negocio/que-es-coevo-studio.md) | qué es Studio y cómo se presenta (resultado · portal · motor) |
| [onboarding-cliente.md](negocio/onboarding-cliente.md) | el onboarding de un cliente: etapas, qué le pedimos, qué le respondemos, la lista del arranque (propuesta) |
| [modelo-de-negocio.md](negocio/modelo-de-negocio.md) | pauta como módulo, medición por plan, recorrido de venta y cómo se conecta cada línea (propuesta) |
| [market-positioning.md](negocio/market-positioning.md) | nicho: video × español × calce |
| [competitive-research.md](negocio/competitive-research.md) · [rumbo-2026-2028.md](negocio/rumbo-2026-2028.md) · [estrategia-motor.md](negocio/estrategia-motor.md) | competidores verificados |
| [financial-model.md](negocio/financial-model.md) | márgenes, descarte, "turista de IA" |
| [producto-propio.md](negocio/producto-propio.md) | ¿un producto que otros usen solos? opciones, gatillos y cómo probarlo |
| [client_onboarding.md](negocio/client_onboarding.md) | qué pedirle a un cliente nuevo |

## Video, audio y operación
| Doc | Qué es |
|---|---|
| [video-ad-production-sop.md](guias/video-ad-production-sop.md) | SOP del operador (PROMAN) |
| [ugc-audio.md](guias/ugc-audio.md) | voz rioplatense: por qué ElevenLabs y no audio nativo |
| [ugc-talking-head-tests.md](producto/ugc-talking-head-tests.md) | pruebas de lip-sync |

## Specs (OpenSpec)
| Dónde | Qué |
|---|---|
| `openspec/specs/` | lo que el sistema hace hoy: workspace-layout, tool-catalog, video-generation, design-system |
| `openspec/changes/` | lo que se está construyendo; estado de cada uno en [changes/README.md](../openspec/changes/README.md) (máx. 3 activos) |

## Archivo — histórico, no usar como fuente
[archive/](archive): `planning`, `campaigns` (spec original), `architecture`,
`product_vision_ux`, `pipeline`, `design`, `design_language`,
`dashboard-architecture-research`, `frontera-diseno-infra`,
`pending-features-2026-09`. Reemplazados por [MAP.md](MAP.md), `openspec/` y
[backlog.md](backlog.md). Borrados: `stack.md`, `tools.md` (estaban en git).
