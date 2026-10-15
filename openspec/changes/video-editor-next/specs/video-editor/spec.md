## ADDED Requirements

### Requirement: Video nuevo dentro de una marca
Un video nuevo SHALL crearse dentro de una marca, con material de su biblioteca, y SHALL
tomar tipografía, colores y logo de su Brand Kit sin que el operador los elija.

#### Scenario: Armar un video con material existente
- **WHEN** el operador elige "Nuevo video" en la marca Koxis y marca 4 clips de Contenido
- **THEN** el editor SHALL abrir un proyecto con esos 4 tramos en ese orden
- **AND** los textos SHALL usar la tipografía y el acento de Koxis

### Requirement: Plantillas de estilo
El operador SHALL poder guardar un video como plantilla: su forma sin su material y sin su
marca, para usarla con otro material y otra marca.

#### Scenario: Reusar un estilo en otra marca
- **WHEN** se usa la plantilla "Reel de marca" en Geely
- **THEN** SHALL aparecer la misma estructura con los huecos vacíos
- **AND** el look SHALL ser el de Geely, no el de la marca de origen

### Requirement: Tramos generados que se regeneran desde el timeline
Un tramo generado SHALL guardar cómo se hizo (modelo, prompt, referencias, formato, duración,
costo) y SHALL poder regenerarse desde el editor cambiando el prompt, con el costo a la vista
antes de confirmar y la versión anterior guardada.

#### Scenario: Cambiar un plano por prompt
- **GIVEN** un tramo de Seedance de 4 s en 1080p
- **WHEN** el operador edita su prompt y elige "Regenerar"
- **THEN** SHALL ver el costo (US$3,16) antes de confirmar
- **AND** al terminar SHALL poder comparar la versión nueva con la anterior y quedarse con una

### Requirement: Del brief al plan
A partir de un brief y sus inputs, el sistema SHALL armar un proyecto con todos los tramos en
estado pendiente y SHALL generarlos en orden de dependencia (las imágenes antes que los videos
que las usan como referencia).

#### Scenario: Video catálogo
- **WHEN** se pide el video catálogo con un avatar sheet y dos prendas
- **THEN** el proyecto SHALL listar las fotos finales y los planos de video como pendientes
- **AND** ningún plano de video SHALL generarse antes que las fotos que usa

### Requirement: Un proyecto, dos formatos
Un proyecto SHALL poder exportarse en 16:9 y 9:16; los tramos generados SHALL generarse nativos
en cada formato (sin recortar uno del otro) y la voz SHALL poder ir sólo en uno.

#### Scenario: Hero sin voz y pauta con voz
- **WHEN** se exporta el video catálogo
- **THEN** SHALL salir un 16:9 sin voz para la web y un 9:16 con voz para pauta
