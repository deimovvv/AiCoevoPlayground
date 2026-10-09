## Context

Una receta hoy **describe** el movimiento con texto (`motionPrompt`) y Kling lo
interpreta. El usuario preguntó (2026-10-05) si con **Seedance por kie.ai** podía
salir "mucho más pro".

## Hallazgo: Seedance puede COPIAR el movimiento de un video real

Seedance 2.5 reference-to-video acepta videos de referencia, y según la doc del
modelo (fal.ai, verificado 2026-10-05) se usan *"for motion style, editing, and
extension"*, *"preserving original motion and camera work"*. Su ejemplo:

> *"The woman from [Image1], wearing the jacket from [Image2], performs the dance
> from [Video1] on the rooftop from [Image3]"*

Aplicado a una receta:

```
[Image1] la modelo (imagen base ya aprobada)
[Image2] la prenda
[Image3] el fondo que eligió el usuario
[Video1] EL VIDEO REAL del que salió la receta  ← el movimiento, copiado
```

Es el cambio de fondo: **de describir el movimiento a copiarlo.** La receta deja
de depender de que el prompt esté bien escrito — que era el riesgo principal
(lección del Pixel: un prompt más detallado salió peor).

## Ya soportado en el código

`reference_video_urls` llega de punta a punta: `api.ts` (`referenceVideoUrls`) →
`main.py` (`SeedanceRefToVideoRequest`) → `seedance_video._kie_create`
(`reference_video_urls`). No hace falta infraestructura nueva.

## Comparación para un giro de 6 s

| | Kling V3 Pro (hoy) | Seedance 2.5 por kie, con video de ref. |
|---|---|---|
| Movimiento | descripto en texto | **copiado del video real** |
| Resolución | 1080p | 720p ($0.19/s) · 1080p ($0.475/s) |
| Costo del video | $0.67 | **$1.14** (720p) · $2.85 (1080p) |
| Identidad de la modelo | la mejor documentada | a medir |
| Filtro de contenido | permisivo | **falsos positivos con piel y ropa ajustada** (ver `_friendly_error`) — riesgo real en moda |

Con video de entrada, kie cobra **menos** por segundo que sin video (720p: $0.19
vs $0.315), así que el costo extra frente a Kling es menor de lo que parece.

## Decisiones de diseño

**Mantener la aprobación de la imagen base.** Seedance permite ir directo de
referencias a video, pero eso salta la aprobación del still y obliga a pagar
video sin haber visto nada. La imagen base aprobada entra como `[Image1]`: el
operador sigue aprobando antes de gastar en video.

**El motor lo declara cada receta.** Ya existe `fixed.model`; una receta con
`sourceVideoUrl` y `fixed.model: "seedance-2-5"` usa la rama Seedance del
generador (ya existe en `handleAnimate`). Las recetas sin video siguen en Kling.

## Riesgos / trade-offs

- **Identidad:** Kling es el mejor documentado en no cambiar la cara. Seedance hay
  que medirlo.
- **Filtro de contenido de Seedance:** falsos positivos con piel, pelo y ropa
  ajustada — justo moda. Puede rechazar clips válidos.
- **Requisitos del video de referencia:** mp4/mov, 480p–720p, entre 409.600 y
  927.408 píxeles en total (720×1280 entra justo), 24–60 fps, 2–30 s. Las previews
  de la UI (360p) **no sirven**: hay que guardar el video original, en una URL pública.
- **Origen del video:** `ref.mp4` se bajó de internet. Para piezas de cliente,
  derivar recetas de material propio o licenciado (los videos de Koxis).
- **Sintaxis del prompt:** la doc de fal usa `[Image1]` / `[Video1]`; confirmar
  que kie acepta la misma notación en la primera corrida.

## Plan de validación

Una prueba A/B con el mismo still aprobado y el giro en ciclorama:
Kling V3 Pro ($0.67) contra Seedance por kie con `[Video1]` = `ref.mp4` a 720p
($1.14). Total ≈ **$1.81**. Medir la variabilidad de movimiento (§7 de
`docs/producto/fashion-reel-recipes.md`; la referencia real da std 8.8), la identidad y si
el filtro rechaza algo. Requiere aprobación del usuario: es gasto real.
