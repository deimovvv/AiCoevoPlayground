# workspace-layout Specification

## Purpose
El patrón de pantalla compartido por las pantallas donde se genera contenido: un
panel de controles, un selector que se abre al costado y un canvas que nunca
desaparece. Detalle y motivación en `docs/workspace-template.md`.

Implementado en: Lab, Campañas, Fashion Reel, Ecommerce Pack. El resto de las
tools sigue con el layout anterior (ver change `workspace-template-tools-migration`
cuando exista).

## Requirements

### Requirement: El canvas nunca desaparece

Las pantallas de generación SHALL mantener visible el canvas con lo generado
mientras el usuario configura o elige assets.

#### Scenario: Elegir un asset sin perder lo generado

- **WHEN** el usuario toca una fila de selección (Modelo, Prendas, Fondo, Look & Feel, Formato)
- **THEN** la grilla de opciones SHALL abrirse en una columna al costado del panel
- **AND** esa columna SHALL empujar el canvas en vez de taparlo
- **AND** las piezas ya generadas SHALL seguir visibles

#### Scenario: Ningún selector se despliega hacia abajo

- **WHEN** una fila de selección se abre
- **THEN** sus opciones SHALL aparecer en la columna del costado, nunca desplegadas dentro del panel izquierdo

### Requirement: Filas de selección compartidas

Toda fila que abra un selector SHALL usar el componente compartido `SelectorTrigger`
de `components/workspace/`, con el mismo alto y el mismo comportamiento en todas
las pantallas.

#### Scenario: Selección múltiple visible

- **WHEN** el usuario elige más de un ítem en un campo multi-select
- **THEN** la fila SHALL mostrar hasta 3 miniaturas apiladas y la cantidad elegida

### Requirement: Parámetros junto al botón de generar

Los parámetros de corrida (formato, resolución, variantes, duración) SHALL vivir
en el panel izquierdo, arriba del botón Generar, y no arriba del canvas.

#### Scenario: Ajustar el formato antes de generar

- **WHEN** el usuario quiere cambiar el aspect ratio
- **THEN** SHALL encontrarlo en el panel izquierdo, junto al costo estimado y al botón Generar
