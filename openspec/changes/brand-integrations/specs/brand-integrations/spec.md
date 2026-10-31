## ADDED Requirements

### Requirement: Métricas de la marca que se actualizan solas
Una marca conectada a Meta SHALL mostrar en el dashboard sus métricas orgánicas y de anuncios,
sincronizadas a diario sin acción del operador.

#### Scenario: Marca nueva
- **WHEN** el operador conecta el Instagram y la cuenta de anuncios de una marca
- **THEN** al día siguiente el dashboard SHALL mostrar sus métricas reales
- **AND** SHALL seguir actualizándose cada día

### Requirement: Publicaciones programadas a la vista
Lo programado en Postiz para una marca SHALL verse en el dashboard con su estado y, una vez
publicado, con sus métricas.

### Requirement: Nada se publica sin confirmar
Mover o distribuir piezas en la vista semana/mes SHALL armar una propuesta; sólo una propuesta
confirmada por una persona SHALL programar publicaciones en Postiz.

#### Scenario: Semana armada
- **WHEN** Operación arrastra tres piezas aprobadas a la semana
- **THEN** Studio SHALL mostrar la propuesta sin tocar Postiz
- **AND** al confirmarla SHALL programar las tres y pasarlas a «en Postiz»

### Requirement: La pieza vuelve a la estrategia
Cada pieza SHALL llevar el ángulo de la estrategia de la marca al que responde, y el reporte del mes
SHALL mostrar las métricas sumadas por ángulo.

### Requirement: Feedback por audio
La marca y el equipo SHALL poder dejar una nota de voz sobre una pieza o una placa; Studio SHALL
guardarla con su transcripción como comentario de esa ronda.
