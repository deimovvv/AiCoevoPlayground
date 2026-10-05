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

## Quién decide qué (acordado con el usuario, 2026-10-05)

| Lo decide la receta | Lo decide el usuario |
|---|---|
| Movimiento y cámara (`motionPrompt`) | Modelo |
| Cantidad de clips (según el `role` de las prendas) | Prendas |
| Encuadre de la imagen base | **Fondo** — si lo elige, es la fuente de verdad |
| | **Modelo de video y duración** — la receta los *sugiere* (los pre-carga); el usuario los cambia |

Corrección del usuario (2026-10-05): *"debo poder seleccionar qué modelo quiero: si es
Seedance o si es Kling, o si agrego más"*. La receta no fija el modelo: lo recomienda.

Cantidad de clips con 4 looks: giro y retrato → 4 clips (uno por look); secuencia →
1 video con 4 tomas; detalle → 1 clip (una sola prenda).

⚠️ **A corregir al conectar:** los `motionPrompt` actuales traen el fondo pegado
("seamless studio backdrop", "clean light backdrop") y el giro tiene su propio campo
"Color de fondo" que duplica el selector de Fondo. El prompt de la receta debe
describir **sólo movimiento y cámara**; el fondo sale del selector del usuario, y si no
elige ninguno, de un default de la receta.

## Capabilities

### New Capabilities

- `fashion-reel-formats`: generar un reel a partir de un formato validado.

## Impact

- `frontend/src/tools/fashion_reel/recipes.ts`, `handlers.ts`, `ToolRunPage.tsx`.
