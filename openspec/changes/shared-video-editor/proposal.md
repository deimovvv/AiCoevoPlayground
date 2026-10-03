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

**Antecedente** (`pending-features.md` §12, archivado): ya se había propuesto un editor
"ligero" post-render. Suma ideas que el diseño nuevo no tenía: **overlay de música**,
**editor de subtítulos** y **elegir el frame de portada**. Van a la segunda etapa.

⚠️ **Contradicción a resolver:** §12 excluía importar videos externos y el timeline. El
diseño nuevo sí tiene timeline y abre videos sueltos (Content, Lab, campañas). Se
mantiene el diseño nuevo — es lo que se conversó por último — pero los videos sin
pipeline no se pueden regenerar, sólo recortar y comentar. §12 también pedía como
prerequisito que las generaciones guarden su estado completo (escenas, audio, subtítulos):
hoy está parcial (`data/pipeline_states/`).

## Capabilities

### New Capabilities

- `video-editor`: revisar, recortar, comentar y regenerar clips en un timeline.

## Impact

- Componente nuevo en `frontend/src/components/workspace/`.
- Backend: recortes en `services/video_concat.py`.
- Reusa `history[]` de las piezas de campaña para versionar clips regenerados.
