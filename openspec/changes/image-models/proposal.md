## Why

GPT Image 2 ya se puede elegir en el Lab y en cuatro tools (Static Ad, Carousel, Ad Creative Lab,
Product Spotlight) y se usa solo para retocar con máscara, pero la integración está a medias. Pedido
del usuario (2026-10-13): *"Quiero que en lab o en todas las herramientas que podemos elegir modelo
de imagen, podamos elegir también este nuevo modelo de fal."* Y sobre el plan propuesto: *"SI"*.

Revisión del código del 2026-10-13 (detalle en `design.md`):

- **El costo miente:** toda imagen de GPT se registra como Nano Banana y a su precio.
- **El tamaño se ignora:** el backend manda `size`, pero Fal espera `image_size`. Una imagen de
  GPT sin referencias sale siempre 1024×768 (el default de Fal), elijas el formato que elijas.
- **La calidad es siempre "high"** (~US$0,21 la imagen cuadrada), cuatro veces la media (~US$0,05).
- **Product Spotlight** muestra el selector de modelo pero no lo usa.
- **No hay una lista única de modelos:** las opciones se repiten en cada pantalla, y ~12 tools
  generan siempre con Nano Banana sin dejar elegir.

## What Changes

1. **Costo correcto**: GPT Image 2 se registra como `gpt-image-2`, con el precio de Fal según calidad y tamaño.
2. **Tamaño y calidad correctos en el backend**: `image_size` como `{width, height}` según formato y
   resolución; `quality` elegible, por defecto **medium**; la respuesta dice qué tamaño y calidad usó.
3. **Una lista única de modelos de imagen** (frontend y backend) con nombre, proveedor, precio,
   capacidades (máscara, texto en la imagen, resolución máxima) y para qué conviene.
4. **Selector de modelo y calidad en todas las tools de imagen**, leyendo de esa lista.
5. **Product Spotlight** usa el modelo elegido.
6. **Moda con calce** (Fashion Reel, Ecommerce Pack, fichas): GPT aparece marcado "a prueba"
   hasta la A/B con prendas reales (`docs/decisions-log.md`, 2026-10).

## Capabilities

### New Capabilities

- `image-generation`: qué modelos de imagen ofrece la plataforma, cómo se eligen, cómo se calcula y registra su costo.

### Modified Capabilities

Ninguna.

## Impact

- Backend: `services/gpt_image_gen.py`, endpoints `/api/image-gen/edit` y `/text-to-image` en `main.py`.
- Frontend: `lib/pricing.ts`, `lib/costLedger.ts`, `lib/api.ts`; nuevo `lib/imageModels.ts`; Lab,
  `ToolRunPage` y los handlers de cada tool de imagen.
- Cambiar la calidad por defecto de high a medium baja el costo ~4× y puede bajar el detalle: las
  tools que necesiten finales piden `high` explícito.
