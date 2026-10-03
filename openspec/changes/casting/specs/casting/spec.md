## ADDED Requirements

### Requirement: El look se arma una vez y se reusa

El sistema SHALL permitir armar un look (modelo + outfit), aprobarlo y guardarlo para
que las producciones posteriores lo usen tal cual.

#### Scenario: Armar el look desde prendas sueltas

- **GIVEN** fotos de prendas sueltas de una marca
- **WHEN** el usuario corre Casting
- **THEN** SHALL ver el outfit armado y aprobarlo antes de vestir a la modelo
- **AND** SHALL ver a la modelo vestida en varios ángulos y aprobarla
- **AND** el resultado SHALL guardarse como look aprobado en el Brand Kit

#### Scenario: El look ya está armado

- **WHEN** el usuario ya tiene el outfit resuelto
- **THEN** SHALL poder saltear el paso de outfit sheet

#### Scenario: Producir con un look aprobado

- **WHEN** una campaña o un reel usa un look aprobado
- **THEN** SHALL recibir el look como una sola referencia en vez de la cara y las prendas sueltas
