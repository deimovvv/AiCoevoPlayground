## ADDED Requirements

### Requirement: Un reel puede partir de una foto

Fashion Reel SHALL poder usar una foto subida por el usuario como cuadro 1, sin
generarlo, y generar los demás planos anclados a ella.

#### Scenario: Foto como base, sin assets del Brand Kit

- **WHEN** el usuario sube una foto, tilda "Usar esta foto como base" y no elige modelo ni prendas
- **THEN** el cuadro 1 SHALL ser la foto, sin modificar
- **AND** SHALL generarse una escena por cada plano de "Secuencia de planos"

#### Scenario: Los otros planos conservan persona, ropa y lugar

- **WHEN** se generan los planos 2 en adelante desde la foto
- **THEN** cada uno SHALL mantener la persona, la ropa, el lugar y la luz de la foto
- **AND** solo SHALL cambiar la pose y el encuadre
