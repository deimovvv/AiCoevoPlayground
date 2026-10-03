## ADDED Requirements

### Requirement: Ecommerce Pack aprueba toma por toma

Ecommerce Pack SHALL generar una toma por vez y esperar la aprobación del operador
antes de generar la siguiente.

#### Scenario: Aprobar la primera toma

- **WHEN** termina la primera toma
- **THEN** el operador SHALL verla y aprobarla o regenerarla
- **AND** la segunda toma SHALL generarse recién después de aprobar la primera
