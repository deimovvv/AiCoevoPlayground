# modules — delta

## ADDED Requirements

### Requirement: Un módulo tiene un contrato fijo

Cada módulo SHALL declarar en un `modulo.json` sus casilleros de entrada, su cadena de capacidades,
su costo estimado y la skill que hace el trabajo.

#### Scenario: Correr un módulo desde Studio o desde el chat
- **WHEN** alguien corre un módulo con una marca y un brief, desde Studio o por el MCP (`correr_modulo`)
- **THEN** SHALL correr la misma cadena, con la misma memoria de la marca
- **AND** el resultado SHALL ser el mismo tipo de tomas en los dos casos

### Requirement: Todo lo aprobado llega a Entregas

#### Scenario: Aprobar una toma
- **WHEN** una persona aprueba una toma de cualquier módulo
- **THEN** la toma SHALL aparecer en Entregas de esa marca, con el brief que la produjo y su costo

### Requirement: El rechazo enseña

#### Scenario: El mismo motivo tres veces
- **WHEN** se rechazan tres tomas de una marca con el mismo motivo de la lista fija
- **THEN** Studio SHALL proponer una regla en Marca › Lo aprendido
- **AND** la regla SHALL aplicarse a todos los módulos de esa marca sólo después de que una persona la confirme

### Requirement: El pipeline se ve en nodos

#### Scenario: Ver cómo se hace una toma
- **WHEN** alguien abre un módulo
- **THEN** Studio SHALL mostrar su cadena como nodos, armada desde el `modulo.json`, sin dibujarla a mano
