# Coevo Studio — Mapa

**El documento de entrada.** Qué es la app, qué hace hoy, y hacia dónde va en
funcionalidad. Si hay que leer un solo archivo para orientarse, es este.

**Actualizado:** 2026-10-03 · **Verificado contra el código** (no de memoria).

> Reemplaza como overview a `architecture.md`, `planning.md`, `product_vision_ux.md`
> y `pipeline.md` (en `docs/archive/`) y a `stack.md` y `tools.md` (borrados).
> Lo que el sistema hace, en detalle, está en `openspec/specs/`; lo propuesto, en
> `openspec/changes/`.

---

## 1. Qué es

Plataforma interna de Coevo para producir contenido de marca con IA — foco en
**moda en video, en español, con calce real** (ver
[market-positioning.md](market-positioning.md)). Cada marca carga sus assets
una vez (modelos, prendas, productos, fondos, looks) y todas las herramientas
los heredan.

Primero se usa para **vender output** a clientes (Koxis, PROMAN). El SaaS para
artistas de IA y marcas es una etapa posterior, no el plan actual.

---

## 2. Las pantallas (lo que ve el usuario)

| Sidebar | Ruta | Qué hace |
|---|---|---|
| **Inicio** | `/dashboard` | home |
| **Campañas** | `/dashboard/campanas` | el pedido de un cliente: brief → plan de tomas → piezas. Contenedor de entregables, imagen y video |
| **Marcas** | `/dashboard/brands` | Brand Kit: assets, DNA, voces, logos, looks |
| **Generar** | `/dashboard/generate` | catálogo de tools con pipeline |
| **Contenido** | `/dashboard/content` | biblioteca de todo lo generado |
| **Lab** | `/dashboard/lab` | sandbox libre de imagen y video (`ManualLabV2.tsx`) |
| **Ajustes** | | |

Fuera del sidebar: **Portal de cliente** (por token, sin login) para que el
cliente revise y apruebe piezas.

---

## 3. Arquitectura en una pantalla

```
FRONTEND  React 19 + Vite + Tailwind v4          BACKEND  FastAPI (Python 3.9 en el venv)
  pages/ (29)                                      main.py — 196 endpoints, 6.616 líneas
  tools/<id>/ (17) ── handlers por paso            services/ (39)
  lib/api.ts ── TODO pasa por acá                  tools/registry.json ── orden de pasos
  components/workspace/ ── patrón compartido       data/ ── JSON, sin base de datos
         │                                                │
         └────────────── HTTP 127.0.0.1:8000 ─────────────┘
                                                          │
                ┌────────────┬──────────────┬─────────────┼──────────────┐
              Fal          kie.ai        Google        ElevenLabs     OpenAI
         Kling, FLUX 3,   Seedance     Gemini (texto,    voz        GPT Image
         Nano Banana,   (siempre acá)  visión), Veo
         lip-sync, SAM2
```

**Gotchas que cuestan caro:**
- `ToolRunPage.tsx` tiene **15.291 líneas**. No sumarle lógica nueva: extraer a
  `components/workspace/` o a `tools/<id>/`.
- Una tool se registra en **dos lados**: `frontend/src/tools/registry.ts` (los
  handlers y aprobaciones) y `backend/tools/registry.json` (el orden de pasos y
  `hidden`). Un paso que esté en uno y no en el otro es código muerto.
- Las keys de Google: `llm_router.py` prefiere `NANOBANANA_API_KEY` y cae a
  `GEMINI_API_KEY`. Las dos generan OK (verificado 2026-10-03); el 403 de
  septiembre ya no está. `veo_video.py` usa `GEMINI_API_KEY` y ve los modelos Veo.

---

## 4. Estado actual por capacidad

`✅` funciona · `◐` parcial · `○` propuesto, sin implementar · `✕` a sacar

### Plataforma
| Capacidad | | Notas |
|---|---|---|
| Brand Kit (assets, DNA, multi-foto por prenda, logos) | ✅ | |
| Campañas: brief → plan → piezas, con `history[]` por pieza | ✅ | |
| Portal de cliente por token + reviews | ✅ | sin login de usuarios |
| Ledger de costos (estimador por corrida) | ✅ | `lib/pricing.ts`, `costLedger.ts` |
| Persistencia del estado de pipeline | ◐ | `data/pipeline_states/` |
| Login / multi-usuario | ○ | |
| Base de datos | ○ | hoy JSON en `backend/data/` |

### Patrón de pantalla — [workspace-template.md](workspace-template.md)
| | | |
|---|---|---|
| Controles · selector al costado · canvas que no desaparece | ✅ | Lab, Campañas, Fashion Reel, Ecommerce Pack |
| Parámetros abajo del panel, junto a Generar | ✅ | Lab, Campañas |
| Resto de las tools | ○ | siguen con el layout viejo |
| `EditOverlay` dentro del canvas (hoy pantalla completa) | ○ | |

### Lab
| | | |
|---|---|---|
| Imagen y video, refs con `@img1`, dictado, Look & Feel | ✅ | |
| Inpaint con máscara (caja / varita SAM2 / pincel) | ✅ | sólo GPT Image |
| Consistencia (anclar identidad) | ⏸ | pausada a propósito; la lógica sigue en el código |

### Tools — [tools-audit.md](tools-audit.md)
| Tool | | Nota |
|---|---|---|
| `ugc_creator` | ✅ | 6 pasos, 5 aprobaciones |
| `video_ad_creator` | ✅ | 8 pasos, 7 aprobaciones |
| `fashion_reel` | ✅ | + recetas de formato en UI (◐, ver §5) |
| `product_clip` | ✅ | |
| `content_analyzer` | ✅ | |
| `avatar_creator` · `product_sheet` · `product_spotlight` | ✅ | |
| `ecommerce_pack` | ◐ | la más usada; **le faltan las aprobaciones por toma** |
| `video_swap` · `carousel_creator` | ? | dudosas: definir si quedan |
| `scene_reconstruct` · `screen_mockup` · `fooh_subway` | ✕ | pasan a presets de Campañas |
| `fashion_editorial` | ✕ | **hecho**: oculta, sus cláusulas en `data/system/` |
| `static_ad` · `ad_creative_lab` | ✕ | ocultas; a borrar |

### Modelos (verificados en septiembre–octubre)
| Uso | Modelo | Vía |
|---|---|---|
| Imagen | Nano Banana 2 · GPT Image 2 | Fal · OpenAI |
| Video, default | **Kling V3 Pro** ($0.56 / 5s) | Fal |
| Video, más barato | Kling V3 Std · V2.6 Pro · V2.5 Turbo | Fal |
| Video, multi-referencia | **Seedance 2.5** (hasta 1080p) | **kie.ai, siempre** |
| Video, nuevo | FLUX 3 (una imagen) | Fal |
| Voz | ElevenLabs (español rioplatense) | |
| Lip-sync | Sync Lipsync v3 · HeyGen · OmniHuman | Fal / HeyGen |

**Candidatos a migrar** (research 2026-09-25): GPT Image 2.5 Flare — mejor
rankeado que lo que usamos, más barato y con máscara. FASHN para fidelidad de
estampado.

---

## 5. Hacia dónde va (funcionalidad)

La dirección de fondo: **menos tools, más pipelines con pasos que aprobás, y que
cada corrección enseñe al sistema.** Tres capas:

```
  PREPARAR           PRODUCIR                    TERMINAR            ENTREGAR
  ────────           ────────                    ────────            ────────
  Casting  ───────▶  Campañas (imagen) ───┐
  (look aprobado)    Fashion Reel  ───────┼───▶  Editor de video ──▶ Campaña ──▶ Portal
                     Product Clip  ───────┤      (timeline +                     del cliente
                     UGC / Video Ad ──────┘       comentarios)
```

### Las propuestas abiertas, en orden de dependencia

Cada una tiene su change en `openspec/changes/` (proposal · tasks · spec delta).

| # | Cambio | Qué resuelve | Spec | Estado |
|---|---|---|---|---|
| 1 | **Recetas de formato en Fashion Reel** | elegís un video conocido y lo completás, en vez de llenar campos | [fashion-reel-recipes.md](fashion-reel-recipes.md) | ◐ UI hecha; **el prompt de la receta no llega al handler** |
| 2 | **Editor de video compartido** | reemplaza el Render ciego de las 4 tools de video; un comentario regenera sólo ese clip | [video-editor.md](video-editor.md) | ○ |
| 3 | **Campañas como centro del pedido** | imagen adentro; video corto animando una pieza; video largo lanzando la tool con todo precargado, y vuelve a la campaña | `openspec/changes/campaigns-as-hub` | ○ decidido, sin implementar |
| 4 | **Casting** | armar el look una vez (outfit sheet → character sheet con ropa) y reusarlo; ataca el drift de identidad y prenda | `openspec/changes/casting` | ○ absorbe `avatar_creator` y `product_sheet` |
| 5 | **Gates de Ecommerce Pack** | una toma → mostrar → confirmar → siguiente | [tools-audit.md](tools-audit.md) §3 | ○ |
| 6 | **Presets de Campañas** | migrar scene_reconstruct, screen_mockup, fooh_subway | [tools-audit.md](tools-audit.md) | ○ |
| 7 | **Capa de marca por código** | precio, prenda, logo animado sobre el video; el texto generativo se deforma | [video-editor.md](video-editor.md) §6 | ○ después del editor |

**El ciclo que conecta todo:** las recetas proponen, el editor muestra, el
comentario corrige y queda guardado en la receta. Es el mismo principio en
recetas, editor y casting: *la máquina propone, el humano aprueba, y lo aprobado
se reusa.*

---

## 6. Dónde está cada cosa

| Para saber… | Leer |
|---|---|
| Por qué algo está como está | [decisions-log.md](decisions-log.md) |
| El patrón de pantalla | [workspace-template.md](workspace-template.md) |
| Qué tools se justifican | [tools-audit.md](tools-audit.md) |
| Cómo correrlo en local | [setup.md](setup.md) |
| Mercado, competencia, números | [market-positioning.md](market-positioning.md) · [competitive-research.md](competitive-research.md) · [financial-model.md](financial-model.md) |
| El estado de cada doc | [docs-audit.md](docs-audit.md) |
