## ADDED Requirements

### Requirement: La campaña reúne imagen y video

Una campaña SHALL contener piezas de imagen y de video del mismo pedido, en una sola grilla.

#### Scenario: Animar una pieza aprobada

- **WHEN** el usuario toca "Animar" sobre una imagen de la campaña
- **THEN** SHALL generarse un clip corto de esa imagen
- **AND** el clip SHALL sumarse como pieza nueva sin reemplazar la imagen

### Requirement: El video largo se hace en la tool, con el contexto de la campaña

La campaña SHALL lanzar las tools de video con su contexto precargado, en vez de
generar video largo por su cuenta.

#### Scenario: Agregar un reel a la campaña

- **WHEN** el usuario elige "Agregar video → Fashion Reel" desde una campaña
- **THEN** Fashion Reel SHALL abrirse con el brief, la modelo, las prendas y el look de la campaña
- **AND** al exportar, el video SHALL volver a la campaña como pieza
