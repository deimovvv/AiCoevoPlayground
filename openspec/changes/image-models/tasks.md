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
- [ ] 2.1 `lib/imageModels.ts` (y `ImageModel` deriva de ahí; borrar las copias en `tools/types.ts` y `ToolRunPage.tsx`)
- [ ] 2.2 Lab y `ToolRunPage` leen las opciones de la lista; selector de calidad para GPT
- [ ] 2.3 Selector en las tools que hoy no lo tienen (ver la lista en `design.md` de la revisión)
- [ ] 2.4 Product Spotlight pasa `imageModel`
- [ ] 2.5 "A prueba" en Fashion Reel, Ecommerce Pack y fichas

## 3. Cierre
- [ ] 3.1 `openspec archive image-models`
