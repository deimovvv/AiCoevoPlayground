## Why

Campañas genera imágenes sueltas. Cuando un pedido necesita video (un reel de
Fashion Reel, un clip de un sillón con Product Clip) no está claro dónde se hace
ni cómo vuelve al pedido. Duda del usuario (2026-10-03):

> *"¿qué pasaría si yo quisiera hacer videos más largos? Campaña entraría ahí, como
> product clip para muebles, un sillón. Pero si hago videos Fashion Reel, no sé si
> alcanza. ¿O campañas vos decís que sea más para imágenes y un video, como mucho?"*

Generar video largo dentro de Campañas reconstruiría Fashion Reel adentro de
Campañas (la duplicación que se viene sacando), y generar 12 clips de una sin
aprobar es caro — el usuario pidió *"una toma → mostrar → confirmar → siguiente"*.

## What Changes

La campaña pasa a ser **el centro del pedido**, en tres niveles:

- **Imágenes:** dentro de Campañas, como hoy.
- **Video corto:** botón "Animar" sobre una pieza ya aprobada (un clip de ~5 s), como en el Lab.
- **Video largo:** "Agregar video → Fashion Reel / Product Clip / UGC" abre la tool con
  el brief, la modelo, las prendas y el look de la campaña ya cargados. El resultado
  pasa por el editor (`shared-video-editor`) y **vuelve a la campaña como pieza**.

La campaña sigue viéndose como grilla de entregables, no como timeline.

**Estado: decidido** (usuario, 2026-10-03: *"Dale. Avancemos"*). Sin implementar.

**Ya existe y se reusa** (de `pending-features.md` §10d, archivado):
- `services/campaign_planner.py` ya devuelve `needs_video: true` cuando el brief pide
  reel o animación — hoy sólo lo avisa en pantalla, no lo produce.
- `campaign.generationIds` existe y está sin usar (las piezas viven en `campaign.pieces`).
- §10d ya había llegado a la misma conclusión: llevar a la tool con el contexto cargado
  es mucho más barato que ejecutarla por dentro, y respeta su curación.

## Capabilities

### New Capabilities

- `campaigns`: la campaña como contenedor de imagen y video, y puente hacia las tools.

### Modified Capabilities

_Ninguna todavía: `campaigns` no tiene spec vigente (el doc original
`docs/campaigns.md` está obsoleto y hay que reescribirlo desde el código)._

## Impact

- `frontend/src/pages/NewCampaignPage.tsx`, `CampaignDetailPage.tsx`, `WorkPage.tsx`
- `ToolRunPage.tsx`: recibir contexto precargado desde una campaña.
- Ya existe y se reusa: `CampaignPiece.type: "image" | "video"` y `history[]` de versiones.
