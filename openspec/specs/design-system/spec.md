# design-system Specification

## Purpose
El sistema visual de Coevo Studio: paleta, tipografía, radios y el rol de cada
color. **La fuente de verdad es `frontend/src/index.css`**; este spec registra las
reglas y por qué existen, no duplica todos los tokens.

Reemplaza a `docs/design.md` y `docs/design_language.md` (archivados el
2026-10-03): se contradecían entre sí y con el código — burgundy vs rosa, un acento
"lime" que no existe, radios viejos.

Valores verificados en `index.css` el 2026-10-03:

| Token | Valor |
|---|---|
| `--color-canvas` | `#0b0b0c` |
| `--color-surface-0…3` | `#141416` · `#1c1c1f` · `#26262a` · `#323238` |
| `--color-fg` · `-muted` · `-faint` | `#f4f4f5` · `#9a9aa2` · `#74747c` |
| `--color-edge` · `-subtle` · `-strong` | blanco al 14% · 8% · 24% |
| `--color-action` | `#F5F5F5` (CTA primario) |
| `--color-brand` | `#ff5f8f` (señal) |
| `--radius-xs…xl` | 4 · 6 · 10 · 14 · 18 px |
| `--font-sans` · `--font-display` | Inter · Instrument Serif |

## Requirements

### Requirement: El rosa es una señal, no un relleno

El acento `--color-brand` SHALL usarse sólo para marcar estado: lo activo, lo
seleccionado, lo nuevo, lo que está en curso y el foco. El botón primario SHALL usar
`--color-action` (off-white), no el rosa.

#### Scenario: Elegir un ítem en una grilla

- **WHEN** el usuario selecciona una miniatura
- **THEN** el borde de la miniatura SHALL pasar a `--color-brand`

#### Scenario: Botón principal

- **WHEN** una pantalla muestra su acción principal (ej. Generar)
- **THEN** el botón SHALL usar `--color-action` con texto oscuro

### Requirement: Los controles tienen contorno visible

Los bordes de controles SHALL mantenerse en `--color-edge` (14%) o más fuerte. Bajarlos
al nivel de la landing (9%/5%) hizo que inputs, selects y chips se perdieran contra el
fondo (probado y revertido en septiembre de 2026).

#### Scenario: Un input sobre el canvas

- **WHEN** un input, select o chip se dibuja sobre `--color-canvas` o una superficie
- **THEN** su contorno SHALL distinguirse a simple vista

### Requirement: Instrument Serif sólo en su peso único

`--font-display` SHALL usarse en un solo peso (400). Aplicarle negrita fuerza una
negrita sintética que deforma las letras.

#### Scenario: Un título en serif

- **WHEN** un título usa `font-display`
- **THEN** SHALL renderizarse sin `font-semibold` ni `font-bold`

### Requirement: Radios chicos, sin píldoras

Chips, tabs y botones sobre imagen SHALL usar `--radius-xs` (4 px) en lugar de
`rounded-full`. La píldora llena se lee como "botón de juguete" y compite con el
contenido (pedido del usuario, septiembre de 2026).

#### Scenario: Toggle Imagen / Video

- **WHEN** se muestra un toggle de modo
- **THEN** la opción activa SHALL marcarse con una superficie apenas elevada, no con un bloque blanco sólido
