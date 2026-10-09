# video-editor Specification

## Purpose
El editor de video de Coevo Studio: **monta** un video con material que ya existe —lo que
salió de una tool o lo que armó Claude desde una skill— y lo deja listo para publicar.
Es uno solo para todo (ver el mapa tool / editor / skill en `docs/MAP.md`).

Componentes: `frontend/src/components/workspace/VideoTimeline.tsx` (el editor),
`TextLayer.tsx` + `textLayerModel.ts` (textos), `MusicPanel.tsx` + `musicModel.ts` (música),
`editorProjectModel.ts` (proyectos). Formato y API: [reference.md](reference.md).
Historia: `openspec/changes/archive/2026-10-09-shared-video-editor/` y
`…-editor-timeline-project/`.

## Requirements

### Requirement: Ver y editar el video como pieza
El editor SHALL mostrar los tramos en un timeline, reproducirlos en orden, y permitir
recortarlos, reordenarlos y quitarlos sin renderizar (el reproductor reproduce las fuentes;
FFmpeg corre sólo al exportar).

#### Scenario: Recortar y exportar
- **WHEN** el operador recorta un tramo de 4,0 a 3,5 s y exporta
- **THEN** el video exportado SHALL durar 0,5 s menos, con el recorte exacto

### Requirement: Notas por momento
El operador SHALL poder anotar qué cambiar en un instante del video; la nota SHALL quedar
atada al tramo y a su momento. En una tool, SHALL poder regenerar sólo ese tramo (con su
costo a la vista) y guardar la corrección como regla de la marca. En un proyecto, las notas
SHALL escribirse en `notas.md` para que Claude las aplique.

### Requirement: Textos anclados con la tipografía de la marca
Los textos (título, subtítulo, prenda, precio, CTA) SHALL tomar fuente y acento de la marca
del run, y SHALL anclarse a su tramo, al inicio o al final del video, de modo que sigan a su
tramo al recortar o reordenar. El mismo componente SHALL dibujarlos en la vista previa y en
el export (lo que se ve es lo que se graba).

#### Scenario: Reordenar con textos
- **WHEN** un tramo con un texto atado pasa al primer lugar
- **THEN** el texto SHALL moverse con él
- **AND** un CTA atado al final SHALL quedar pegado al cierre aunque el video cambie de largo

### Requirement: Música atada al video entero
La música SHALL ir de punta a punta del video y ajustarse a su largo en cada export, con
volumen, segundo de inicio del tema y fade final, y SHALL bajar bajo la voz si la hay.
El operador SHALL poder ajustar los cortes al ritmo (cada corte al golpe anterior, sólo acortando).

### Requirement: Revisión automática del export
Después de exportar con textos, el sistema SHALL avisar si un texto tapa una cara, toca un
borde o cae en la franja de botones de Reels/TikTok, con una miniatura; la revisión SHALL
marcarse desactualizada si el video cambia después.

### Requirement: Proyectos que editan Claude y la UI
El editor SHALL abrir un proyecto `timeline.json` de una carpeta permitida, guardar los
cambios de la UI en el mismo archivo conservando los campos que no conoce, recargarse si el
archivo cambia en disco, y no pisar un cambio de Claude (conflicto → recargar).

#### Scenario: Tramo con locución
- **WHEN** un tramo tiene `voice` y `extra`
- **THEN** SHALL durar lo que la voz más `extra`, con silencio al final
- **AND** si su fuente es más corta, SHALL congelarse su último cuadro, igual en vista previa y export

### Requirement: Marca del run
Todo lo que actúa sobre el contenido de un run (regenerar, reglas, autoguardado, textos)
SHALL usar la marca dueña del run, no la marca activa del selector.
