# Spec delta — mesas

## ADDED Requirements

### Requirement: Mesas de una campaña
Una campaña SHALL tener mesas: espacios de trabajo con nombre, dueño y, opcionalmente, los cuadros del storyboard
que trabajan. Todo el equipo SHALL ver todas las mesas; el cliente SHALL NOT verlas.

#### Scenario: Cliente
- **WHEN** un usuario con rol cliente abre la campaña
- **THEN** no ve mesas ni variantes, sólo sus entregas

### Requirement: Lo generado queda atado al cuadro
Una imagen subida a una mesa «para el #N», desde la app o desde el MCP, SHALL quedar agrupada en el #N y aparecer
primero al reemplazar ese cuadro en el storyboard.

#### Scenario: Desde Claude
- **WHEN** Claude llama a `subir_a_mesa` con `para_cuadro: 5` y una nota
- **THEN** las imágenes aparecen en el grupo #5 de la mesa, con la nota como lo que hizo Claude

### Requirement: Orden al reemplazar
El panel «Reemplazar» del cuadro #N SHALL mostrar primero lo marcado para #N, después lo elegido (★) en las mesas de
la campaña y al final el resto, sin cargar todo de entrada.
