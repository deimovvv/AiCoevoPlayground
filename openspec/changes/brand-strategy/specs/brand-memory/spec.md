## ADDED Requirements

### Requirement: La estrategia es parte de la memoria de la marca

La marca SHALL poder guardar su estrategia (claim, enemigo, ángulos y calendario) en Studio, y las
skills SHALL leerla con `ver_marca` antes de producir.

#### Scenario: Una skill produce desde un ángulo

- **WHEN** una skill pide `ver_marca(marca, bloque="estrategia")`
- **THEN** SHALL recibir el claim, el enemigo, los ángulos y el calendario vigentes
- **AND** SHALL recibir de dónde salió esa estrategia (`fuente`)

#### Scenario: Marca sin estrategia

- **WHEN** la marca todavía no tiene estrategia cargada
- **THEN** el bloque SHALL decirlo (`falta`) en vez de venir vacío en silencio
