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
