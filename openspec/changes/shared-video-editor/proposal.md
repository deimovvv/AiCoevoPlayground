## Why

Las 4 tools de video terminan en un paso **Render** ciego: concatena los clips en el
orden en que salieron, sin poder verlos juntos, recortarlos ni corregir uno sin
rehacer la corrida. Referencia: el editor "Rubric" de RoboNuggets, con timeline y
comentarios por timestamp.

## What Changes

Un editor con timeline, compartido, que **reemplaza el paso Render** de
`fashion_reel`, `product_clip`, `ugc_creator` y `video_ad_creator`, y que también se
abre con cualquier video desde Content, el Lab o una campaña.

Lo que lo diferencia: cada clip sabe de qué escena salió, así que **un comentario
regenera sólo ese clip** y queda guardado en la receta que lo generó.

Diseño completo: `docs/video-editor.md`.

## Capabilities

### New Capabilities

- `video-editor`: revisar, recortar, comentar y regenerar clips en un timeline.

## Impact

- Componente nuevo en `frontend/src/components/workspace/`.
- Backend: recortes en `services/video_concat.py`.
- Reusa `history[]` de las piezas de campaña para versionar clips regenerados.
