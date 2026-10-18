# image-generation Specification

## Purpose
Qué modelos de imagen ofrece la plataforma (Nano Banana 2 y GPT Image 2, por Fal), cómo se elige
formato y calidad, y cómo se registra su costo. Archivado de `changes/image-models` el 2026-10-17.

## Requirements
### Requirement: El costo de cada imagen se registra con su modelo real

Cada imagen generada o editada SHALL registrarse en el ledger de costos con el modelo que la generó
y su precio: Nano Banana 2 por resolución; GPT Image 2 por calidad y tamaño, según la tabla de Fal.

#### Scenario: Una imagen con GPT

- **GIVEN** que el usuario genera una imagen 1:1 con GPT Image 2 en calidad medium
- **WHEN** termina la generación
- **THEN** el ledger SHALL sumar US$0,053 bajo `gpt-image-2:medium`
- **AND** no SHALL sumar nada bajo `nano-banana-2`

#### Scenario: Tamaño fuera de la tabla

- **WHEN** GPT genera un tamaño que no figura en la tabla de Fal
- **THEN** el costo SHALL usar la fila más cercana en píxeles y marcarse como estimado

### Requirement: GPT Image 2 respeta el formato elegido

Las imágenes de GPT Image 2 SHALL generarse con el formato y la resolución elegidos, enviados a
Fal como `image_size` `{width, height}` dentro de sus límites.

#### Scenario: Vertical sin referencias

- **GIVEN** que el usuario elige 9:16 a 1K con GPT Image 2 y sin referencias
- **WHEN** se genera la imagen
- **THEN** SHALL salir vertical, 768×1360

### Requirement: La calidad de GPT es elegible y por defecto media

Toda generación con GPT Image 2 SHALL aceptar calidad `low`, `medium` o `high`; si no se indica,
SHALL usarse `medium`.

#### Scenario: Sin elegir calidad

- **WHEN** una tool pide una imagen a GPT Image 2 sin indicar calidad
- **THEN** SHALL generarse en `medium`

### Requirement: Una sola lista de modelos de imagen

Todas las pantallas que permiten elegir modelo de imagen SHALL leer las opciones de una única lista
con nombre, proveedor, precio, capacidades y para qué conviene cada modelo.

#### Scenario: Sumar un modelo

- **WHEN** se agrega un modelo a la lista
- **THEN** SHALL aparecer en el Lab y en todas las tools de imagen sin tocar cada pantalla

### Requirement: Elegir modelo en todas las tools de imagen

Toda tool que genera imágenes SHALL dejar elegir el modelo, salvo que su pipeline lo fije por una
razón documentada. En las tools de moda con calce, GPT Image 2 SHALL marcarse "a prueba".

#### Scenario: Product Spotlight con GPT

- **GIVEN** Product Spotlight con GPT Image 2 elegido
- **WHEN** genera
- **THEN** la imagen SHALL generarse con GPT Image 2
