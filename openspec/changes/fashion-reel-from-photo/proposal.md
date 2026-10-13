## Why

Pedido del usuario (2026-10-13):

> *"en Fashion Reel, importarle una sola imagen y que te anime la imagen… que vos
> puedas, a partir de una imagen, generar los otros shots"*

Hoy Fashion Reel siempre arranca de la modelo y las prendas del Brand Kit y **genera**
la imagen base. Si ya tenés una foto que te gusta (de una sesión real, del Lab, de una
campaña), no hay forma de partir de ella: hay que reconstruirla con assets.

## What Changes

**Modo "desde una foto".** Subís una imagen y tildás *"Usar esta foto como base"*:

- La foto **es el cuadro 1**, tal cual — no se genera, no hay drift.
- Los otros planos (general, medio, detalle, espalda — los de "Secuencia de planos")
  se generan **anclados a la foto**: misma persona, misma ropa, mismo lugar y luz;
  cambian solo pose y encuadre.
- Después cada cuadro se anima como siempre (Kling / Seedance) y se arma el reel.
- No hace falta modelo ni prendas del Brand Kit. Al tildar, la tool pasa a modo
  **Looks**, que es donde se elige la secuencia de planos.

**Casi todo ya existía y se reusa:**
- El multishot ya ancla cada escena a la imagen base (`CONSISTENCY ANCHOR`), y su loop
  arranca en la escena 2, así que el cuadro 1 nunca se regenera.
- UGC Creator ya tenía el mismo mecanismo (`ugcBaseFromUpload`).

**Lo que se tocó:**
- `handleScript`: con foto y sin prendas, una escena por plano elegido. Va antes de la
  receta de formato, que exige prendas y cortaba.
- `handleBaseImage`: devuelve la foto subida, sin generar.
- `handleMultishot`: en Looks sin prendas, el ancla pasa a ser de consistencia. Antes
  decía *"solo cambia el OUTFIT, a las prendas de abajo"*, y sin prendas el modelo
  habría inventado ropa.
- `ToolRunPage`: la casilla de UGC se extiende a Fashion Reel. Solo condición y texto,
  sin lógica nueva.

## Capabilities

### New Capabilities

- `fashion-reel`: el modo desde una foto. (Fashion Reel no tenía spec; las recetas de
  formato viven en `changes/fashion-reel-format-recipes`.)

## Impact

- `frontend/src/tools/fashion_reel/handlers.ts`, `frontend/src/pages/ToolRunPage.tsx`.
- Costo: una imagen menos que el flujo normal (el cuadro 1 no se genera).
- **Límite conocido:** las recetas de formato no aplican en este modo (piden prendas
  para armar las escenas). Si se elige receta y foto a la vez, manda la foto.
