# Backlog

Ideas y features **sin trabajar todavía**. Cuando una se empieza, pasa a
`openspec/changes/<nombre>/` y sale de acá.

> Reemplaza a `pending-features.md` (archivado el 2026-10-03 en
> [archive/pending-features-2026-09.md](archive/pending-features-2026-09.md),
> con el detalle completo de cada ítem). Ese doc mezclaba lo hecho con lo
> pendiente: un agente no podía saber qué ya existía.

**Actualizado:** 2026-10-03

---

## En curso → `openspec/changes/`

| Change | Absorbe de pending-features |
|---|---|
| `campaigns-as-hub` | §10d Campañas: cerrar el circuito con las tools |
| `shared-video-editor` | §12 Video Editor post-render |
| `fashion-reel-format-recipes` | — |
| `casting` | — |
| `ecommerce-pack-gates` | — |

## Pendiente

| # | Qué | Nota |
|---|---|---|
| 1 | **Persistencia completa de generaciones** | parcial: `data/pipeline_states/`. Falta guardar escenas, audio y subtítulos — lo necesita el editor |
| 2 | **Modo agente** | existe un resolver con Gemini (`services/agent.py`); falta el ejecutor |
| 3 | **Automatización / generación programada** | |
| 4 | **Calendario de contenido** | |
| 5 | **Publicar en plataformas** (Instagram, TikTok) | |
| 6 | **Extraer de URL al generar** | |
| 7 | **Auto-onboarding de marca desde URL** | parcial: existe scraping de guidelines |
| 8 | **Design system de la marca en el Brand Kit** | se cruza con la capa de marca por código (`video-editor.md` §6) |
| 9 | **Deploy e infraestructura** | hoy todo corre local |
| 10 | **Ecommerce Batch: cablear el backend** | el botón todavía es un `alert()` (`EcommerceBatch.tsx`) |
| 11 | **Campañas: estados que signifiquen algo** | |
| 12 | **Modo claro: auditar el resto de la app** | |
| 13 | **Selección por objeto: lo que falta** | caja, varita (SAM2) y pincel ya están; quedan las preguntas abiertas de §14 del archivo |
| 14 | **Login / multi-usuario** | el portal funciona por token, sin cuentas |

## Ya hecho (estaba como pendiente)

Portal de cliente (por token) · Lab estilo Freepik (v2) · renderer de Remotion
(`subtitle_render.py`) · layout split de ToolRunPage (lo resolvió el
workspace-template) · máscara por caja, varita y pincel.
