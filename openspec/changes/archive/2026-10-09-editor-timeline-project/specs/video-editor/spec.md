## ADDED Requirements

### Requirement: Abrir un proyecto de video desde una carpeta
El editor SHALL abrir un proyecto descripto por `timeline.json` en una carpeta local permitida,
mostrar sus tramos, textos y música en pistas, y reproducirlo.

#### Scenario: Proyecto escrito por una skill
- **WHEN** el operador abre una carpeta con `timeline.json`
- **THEN** el editor muestra cada tramo con su fuente, locución y rótulo, en orden
- **AND** cada tramo con `voice` dura lo que dura esa locución

#### Scenario: Claude cambia el proyecto
- **WHEN** `timeline.json` cambia en disco mientras el editor está abierto
- **THEN** el editor recarga el proyecto sin perder la posición del cabezal

### Requirement: La UI y Claude editan el mismo archivo
Los cambios hechos en el editor SHALL guardarse en el mismo `timeline.json`, conservando los
campos que el editor no conoce, y las notas por momento SHALL guardarse en `notas.md`.

#### Scenario: Nota para Claude
- **WHEN** el operador anota "subir el rótulo" en 0:12.4
- **THEN** `notas.md` suma una línea con el momento, el tramo y el texto

### Requirement: Tramos de imagen y fuentes cortas
Un tramo MAY ser una imagen fija; si la fuente de un tramo es más corta que su duración, se
SHALL congelar su último cuadro, igual en la vista previa y en el export.

#### Scenario: Placa final
- **WHEN** un tramo tiene `src` de imagen y `voice`
- **THEN** se muestra la imagen durante lo que dura la voz
