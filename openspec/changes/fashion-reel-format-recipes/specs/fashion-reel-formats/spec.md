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
