# video-generation Specification

## Purpose
Qué modelos de video ofrece la plataforma, por qué proveedor se generan y cómo se
muestra su costo. Precios verificados en fal.ai y kie.ai entre el 2026-09-25 y el
2026-10-01.

## Requirements

### Requirement: Seedance se genera siempre por kie.ai

Toda generación con Seedance SHALL hacerse por la API de kie.ai, en cualquier
pantalla que la use (Lab, Fashion Reel, UGC, Video Ad Creator).

Decisión del usuario (2026-10-01): *"cuando usemos Seedance, te conectes a la API de
kie siempre"*. kie es ~33% más barato que Fal en 720p ($0.315/s vs $0.473/s) y
ofrece 1080p, que Fal no tiene para Seedance 2.5.

#### Scenario: Generar con Seedance en 1080p

- **WHEN** el usuario elige Seedance 2.5 en 1080p
- **THEN** el video SHALL generarse por kie.ai
- **AND** el costo estimado SHALL calcularse con la tarifa de kie ($0.79/s)

#### Scenario: Falta la key de kie

- **GIVEN** que `KIE_API_KEY` no está configurada
- **WHEN** se pide un video con Seedance
- **THEN** SHALL generarse por Fal como alternativa

#### Scenario: Un video en curso durante un cambio de proveedor

- **GIVEN** un video que se encoló por Fal antes de que kie pasara a ser el default
- **WHEN** el sistema consulta su estado
- **THEN** SHALL seguir resolviéndolo por Fal hasta que termine

### Requirement: Cada modelo muestra su costo antes de generar

El selector de modelo de video SHALL mostrar el costo aproximado de 5 segundos en
cada opción, y el panel SHALL mostrar el costo estimado de la corrida antes de
generar.

#### Scenario: Elegir modelo sabiendo cuánto cuesta

- **WHEN** el usuario abre el selector de modelo de video
- **THEN** cada opción SHALL mostrar su costo aproximado por 5 segundos

### Requirement: Lo que el modelo no acepta no se ofrece

La interfaz SHALL ofrecer sólo los parámetros que el modelo elegido acepta de verdad.

#### Scenario: Aspect ratio en Kling

- **GIVEN** que Kling infiere el aspect ratio de la imagen inicial e ignora el parámetro
- **WHEN** el usuario elige un modelo Kling
- **THEN** el campo de aspect ratio SHALL mostrarse como "de la imagen", no como un selector

#### Scenario: Resolución que el modelo no tiene

- **WHEN** un modelo no ofrece cierta resolución
- **THEN** esa resolución SHALL no aparecer en el selector
