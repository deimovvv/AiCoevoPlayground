# Tareas — image-models

Cada tarea cierra con `npm run build` y `npx tsc --noEmit -p tsconfig.app.json` en `frontend/`
(cero errores nuevos), commit y push a `main`. Nunca POST de prueba a Fal: encola y cobra.

## 1. Costo y backend
- [x] 1.1 `gpt_image_gen.py`: `image_size` como `{width, height}` por formato y resolución; `quality` con default `medium`; devolver el tamaño usado
- [x] 1.2 `main.py`: `quality` en `/edit` y `/text-to-image`; `meta` en la respuesta; `resolution` también para GPT
- [x] 1.3 `pricing.ts`: tabla de GPT Image 2 (2026-10-13) y `gptImageUsd(quality, w, h)`
- [x] 1.4 `costLedger.ts` + `api.ts`: registrar cada imagen con su modelo real (`gpt-image-2:<calidad>`), usando `meta`
- [x] 1.5 Actualizar `docs/negocio/pricing-credits.md` y `PRICE_NOTE`

## 2. Lista única y selector
- [x] 2.1 `lib/imageModels.ts` (y `ImageModel` deriva de ahí; borrar las copias en `tools/types.ts` y `ToolRunPage.tsx`)
- [x] 2.2 Lab y `ToolRunPage` leen las opciones de la lista; selector de calidad para GPT
- [x] 2.3 Selector en las tools que hoy no lo tienen (ver la lista en `design.md` de la revisión)
- [x] 2.4 Product Spotlight pasa `imageModel`
- [x] 2.5 "A prueba" en Fashion Reel, Ecommerce Pack y fichas

## Quedan en Nano Banana (decidido, 2026-10-13)
- `EntryFramePanel` (ToolRunPage): panel suelto sin config de tool; quitar a la persona de la escena.
- Campañas (`NewCampaignPage`, `CampaignDetailPage`): no tienen panel de configuración de imagen; va con `campaigns-as-hub`.
- Motor de nodos (`backend/nodes/primitives.py`, `screen_mockup/graph.json`): sólo Nano Banana.
- `ImageEditPanel`: elige solo — GPT si hay máscara, Nano si no.

## 3. Cierre
- [x] 3.1 `openspec archive image-models` (2026-10-17, a mano)
