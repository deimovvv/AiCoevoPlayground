## ADDED Requirements

### Requirement: Pose curada por toma
Cada toma on-model del Ecommerce Pack SHALL generarse con una pose de referencia elegida de la
librería de Coevo (o de la marca), filtrada por el plano de la toma y el género de la modelo.

#### Scenario: Elegir la pose del plano medio
- **GIVEN** una ficha con modelo mujer
- **WHEN** el operador abre el selector de pose de la toma "Plano medio"
- **THEN** SHALL ver sólo las poses de plano medio de mujer, en miniatura
- **AND** la imagen generada SHALL copiar esa pose

### Requirement: Estilo Catálogo o Editorial
La ficha SHALL tener un control "Catálogo / Editorial" que cambie juntos el fondo, la luz y el set
de poses, sin cambiar la prenda ni el calce.

#### Scenario: Pasar a Editorial
- **WHEN** el operador elige "Editorial"
- **THEN** las tomas SHALL ofrecer poses con actitud (sentada, apoyada, caminando)
- **AND** el fondo y la luz SHALL cambiar en todas las tomas por igual

### Requirement: La persona de la foto de prenda no entra
Si la foto de la prenda la muestra puesta en una persona, el sistema SHALL quitar su cara antes de
usarla como referencia, y la modelo del resultado SHALL ser la del avatar sheet.

#### Scenario: Body fotografiado puesto
- **WHEN** la referencia del body es una foto de una chica con el body puesto
- **THEN** la referencia que llega al generador SHALL estar recortada debajo del mentón
