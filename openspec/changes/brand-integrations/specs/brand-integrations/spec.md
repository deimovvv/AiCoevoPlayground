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
