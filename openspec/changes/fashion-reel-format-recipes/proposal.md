## Why

Fashion Reel pide campos vacíos (dirección, look, tomas, movimiento) y el
conocimiento de qué funciona vive en la cabeza del operador. Elegir un **formato de
video conocido** y completarlo invierte eso.

## What Changes

Una galería de formatos derivados de video real (giro en ciclorama, retrato frontal,
secuencia de looks, detalle de prenda). Cada formato trae su prompt resuelto y
declara qué inputs pide. Diseño completo: `docs/fashion-reel-recipes.md`.

**Estado:** la UI está hecha (tira en loop, grilla, inputs filtrados). **Falta lo
central:** el prompt de la receta no llega al generador — `recipe` es estado local de
`ToolRunPage` y `fashion_reel/handlers.ts` no lo lee.

## Capabilities

### New Capabilities

- `fashion-reel-formats`: generar un reel a partir de un formato validado.

## Impact

- `frontend/src/tools/fashion_reel/recipes.ts`, `handlers.ts`, `ToolRunPage.tsx`.
