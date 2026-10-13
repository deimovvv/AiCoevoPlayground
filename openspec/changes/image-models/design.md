# Diseño — image-models

## Hallazgos (verificados 2026-10-13)

| | Hoy | Fuente |
|---|---|---|
| Endpoints de GPT | `fal-ai/gpt-image-2` y `/edit` (alias de `openai/gpt-image-2`); ambos existen | schema OpenAPI de Fal |
| Tamaño | Fal espera `image_size` (preset o `{width, height}`; múltiplos de 16, borde ≤ 3840, 655.360–8.294.400 px, proporción ≤ 3:1). El backend manda `size` → se ignora: t2i sale `landscape_4_3`, edit sale `auto` | schema + `gpt_image_gen.py` |
| Calidad | `low` / `medium` / `high` / `auto`, default de Fal `high`. El backend fija `high` | schema + código |
| Máscara | `mask_url` en `/edit` ✓ (lo que usa el backend) | schema |
| Costo registrado | `recordImage(resolution)` → siempre `nano-banana-2` | `costLedger.ts:82` |

### Precios de Fal por imagen (2026-10-13)

| Tamaño | low | medium | high |
|---|---|---|---|
| 1024×768 | 0,005 | 0,037 | 0,145 |
| 1024×1024 | 0,006 | 0,053 | 0,211 |
| 1024×1536 | 0,005 | 0,042 | 0,165 |
| 1920×1080 | 0,005 | 0,040 | 0,158 |
| 2560×1440 | 0,007 | 0,056 | 0,222 |
| 3840×2160 | 0,012 | 0,101 | 0,401 |

El precio sale de tokens, no de píxeles en línea recta (1024×1536 cuesta menos que 1024×1024). Se
usa la fila de la tabla con la cantidad de píxeles más cercana; si el tamaño no está en la tabla,
el costo se marca **estimado**.

Nano Banana 2: US$0,08 a 1K; 2K ×1,5; 4K ×2; 0,5K ×0,75 (sin cambios).

## Tamaño de GPT por formato y resolución

`image_size = {width, height}` calculado así: píxeles objetivo según resolución (0.5K = 655.360,
1K = 1.048.576, 2K = 2.359.296, 4K = 8.294.400), proporción del formato elegido, cada lado redondeado
a múltiplo de 16, borde máximo 3840, y se recorta a los límites de Fal. Ej.: 9:16 a 1K → 768×1360;
1:1 a 1K → 1024×1024; 16:9 a 2K → 2048×1152.

## La respuesta del backend

`/api/image-gen/edit` y `/text-to-image` devuelven además `meta: {model, quality, width, height}`
(GPT) o `meta: {model, resolution}` (Nano Banana). El frontend registra el costo con esos datos, así
el precio vive en un solo lugar (`pricing.ts`) y el tamaño en otro (el backend), sin duplicar cálculos.

## Lista única de modelos (`frontend/src/lib/imageModels.ts` + espejo en backend)

```ts
{ id: "nano-banana-2", label: "Nano Banana 2", provider: "fal", masks: false, textInImage: "regular",
  maxResolution: "4K", goodFor: "componer varias referencias, moda con calce", status: "estable" }
{ id: "gpt-image-2", label: "GPT Image 2", provider: "fal", masks: true, textInImage: "muy bueno",
  maxResolution: "4K", qualities: ["low","medium","high"], defaultQuality: "medium",
  goodFor: "texto dentro de la imagen, retoques con máscara, iterar una sola imagen", status: "estable" }
```

`status: "a prueba"` se muestra en las tools de moda con calce.

## Cómo quedó (2026-10-13)

- `frontend/src/lib/imageModels.ts`: la lista, `imageChoice(config)` y `imageModelOptions()`.
- `components/workspace/ImageModelPicker.tsx`: modelo + calidad (Borrador / Normal / Final = low / medium / high).
- `createImageEdit` / `createTextToImage` aceptan el modelo suelto o `{model, quality}`.
- Las tools pasan `imageChoice(config)` (Ecommerce Pack: `imageChoice(config, "ecomImageModel")`).
- Selector en 14 tools + Ecommerce Pack; "a prueba" en `FASHION_FIT_TOOLS`.

## Orden

1. Costo + backend (tamaño, calidad, `meta`). **Lo más urgente: hoy los números están mal.**
2. Lista única y selector en todas las tools de imagen.
3. Product Spotlight.
4. "A prueba" en moda.
