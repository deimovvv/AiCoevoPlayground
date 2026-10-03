## Why

Ecommerce Pack es la tool más usada y corre todas las tomas de una, sin aprobación
(`approvalSteps: []`). El usuario ya lo pidió: *"generar de a UNA toma: una toma →
mostrar → confirmar → siguiente. NUNCA batchear."* Sigue siendo tool (decisión del
usuario 2026-09-25); lo que le falta son sus aprobaciones.

## What Changes

Cada toma se genera, se muestra y espera aprobación antes de la siguiente.

## Capabilities

### Modified Capabilities

- `tool-catalog`: Ecommerce Pack pasa a cumplir el criterio de tool.

## Impact

- `frontend/src/tools/ecommerce_pack/index.ts` (hoy un único `generate_all`).
- `backend/tools/registry.json`: pipeline por toma.
