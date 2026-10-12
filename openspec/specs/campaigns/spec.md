# campaigns Specification

## Purpose
Cómo una campaña combina sus referencias (moodboard, fondo, pose, luz, modelo,
producto/prenda y brief) para que el resultado sea predecible: cada referencia tiene
un solo dominio y el input específico le gana al moodboard en el suyo. Nace de
`changes/archive/2026-10-12-campaigns-creative-direction`. La parte de video
(animar una pieza, lanzar tools con contexto) la suma `changes/campaigns-as-hub`.

## Requirements

### Requirement: Cada referencia tiene un solo dominio

Cada referencia de una campaña SHALL aportar al generador solo lo de su dominio:
fondo → el lugar, pose → postura y encuadre, Lighting → la luz, modelo → identidad,
producto/prenda → fidelidad, moodboard → mood, paleta y estilo.

#### Scenario: El fondo se usa literal

- **WHEN** la campaña tiene un fondo
- **THEN** el fondo SHALL mandarse al generador como imagen con la orden de usarlo exacto
- **AND** el entorno que sugiera el moodboard NO SHALL aplicarse

#### Scenario: El input específico gana sobre el moodboard

- **WHEN** la campaña tiene moodboard y además pose, fondo o Lighting
- **THEN** en ese dominio SHALL mandar el input específico y no lo que se derive del moodboard

### Requirement: El moodboard se lee, no se copia

El moodboard SHALL analizarse antes de generar y llegar al generador solo como
texto. La imagen del moodboard NO SHALL mandarse al generador, salvo como
degradación cuando el análisis falla.

#### Scenario: Moodboard analizado

- **WHEN** la campaña tiene moodboard
- **THEN** SHALL producirse una Dirección creativa con paleta, estilo, entorno, pose, mood y luz
- **AND** el prompt SHALL incluir esa dirección en vez de la imagen

#### Scenario: El análisis falla

- **WHEN** el modelo de visión rechaza o no puede leer el moodboard
- **THEN** la pantalla SHALL avisarlo
- **AND** la generación SHALL seguir mandando el moodboard como imagen con su instrucción de rol

### Requirement: La Dirección creativa es visible y no requiere brief

La Dirección creativa SHALL mostrarse antes de generar y SHALL producirse aunque
no haya brief, solo a partir de las referencias.

#### Scenario: Campaña sin brief

- **WHEN** el usuario elige moodboard y referencias pero no escribe brief
- **THEN** la Dirección creativa SHALL generarse igual y verse antes de apretar Generar

### Requirement: La luz tiene un solo dueño

Lighting SHALL ser un único control con dos fuentes que se excluyen: un preset del
sistema o una imagen de referencia. La referencia aporta solo la luz (fuente,
dirección, dureza, temperatura, contraste, sombras), sin color grade.

#### Scenario: Elegir una fuente reemplaza a la otra

- **WHEN** hay un preset de Lighting elegido y el usuario elige una imagen de referencia
- **THEN** el preset SHALL deseleccionarse

### Requirement: Con fondo propio, nada del moodboard describe el lugar

Cuando la campaña tiene fondo, la Dirección creativa SHALL pedirse sabiendo que hay
fondo, para que deje el entorno vacío y no describa el set en el estilo ni en la luz.
El prompt SHALL nombrar el fondo al principio (lo primero pesa más) y SHALL omitir la
paleta y la luz derivadas del moodboard. Una luz elegida a propósito (preset o
referencia) sí se aplica.

#### Scenario: Moodboard de estudio blanco con fondo de taller

- **WHEN** el moodboard muestra un estudio blanco infinito y el fondo elegido es un taller oscuro
- **THEN** la imagen SHALL salir en el taller, con su arquitectura, tonos y luz
- **AND** del moodboard SHALL tomarse solo la actitud, el mood y el lenguaje fotográfico

Validado 2026-10-12 (Taller Santa Clara). Sin este requisito, el blanco del moodboard
se colaba por el estilo, la paleta y la luz y le ganaba al fondo en 3 de 3 tiradas.
Con él, el fondo salió literal en 2 de 2.
