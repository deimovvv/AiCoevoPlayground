## ADDED Requirements

### Requirement: El formato elegido define cómo se mueve el video

Cuando el usuario elige un formato, el video generado SHALL seguir el movimiento de
ese formato sin que el usuario tenga que escribirlo.

#### Scenario: Generar con un formato

- **WHEN** el usuario elige "Giro en ciclorama", una modelo y un look, y genera
- **THEN** la animación SHALL usar el prompt de movimiento del formato

#### Scenario: Sólo se piden los inputs del formato

- **WHEN** hay un formato elegido
- **THEN** el panel SHALL mostrar sólo los inputs que ese formato declara

### Requirement: El fondo lo elige el usuario

El fondo del video SHALL ser el que elige el usuario; la receta SHALL aportar un fondo
por defecto sólo si el usuario no elige ninguno.

#### Scenario: Fondo blanco con el formato giro

- **WHEN** el usuario elige "Giro en ciclorama" y un fondo blanco
- **THEN** el video SHALL salir con el movimiento del giro sobre fondo blanco

#### Scenario: Cuatro looks en un formato de un clip por look

- **WHEN** el usuario elige "Giro en ciclorama" y 4 looks
- **THEN** SHALL generarse 4 clips, uno por look, con el mismo movimiento

### Requirement: El usuario elige el modelo de video

Con una receta activa, el usuario SHALL poder elegir el modelo de video entre todos los
disponibles. La receta SHALL pre-cargar su modelo y duración recomendados, sin impedir
cambiarlos.

#### Scenario: Cambiar Kling por Seedance en un formato

- **GIVEN** el formato "Giro en ciclorama", que recomienda Kling V3 Pro
- **WHEN** el usuario elige Seedance 2.5 en el selector de modelo
- **THEN** el video SHALL generarse con Seedance por kie.ai, con el movimiento del formato
- **AND** el costo mostrado SHALL ser el de Seedance
