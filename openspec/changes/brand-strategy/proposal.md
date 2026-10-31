## Why

Las skills producen leyendo la memoria de la marca en Studio (`ver_marca`): quién es, su voz, su
identidad. Pero la **estrategia** (claim, enemigo, ángulos, calendario) vive en un markdown dentro del
repo de cada marca (ej. `MiSaluteca-app/docs/spec-campana-mi-saluteca.md`). Studio no la conoce.

Consecuencia: la rutina semanal que propone el spec de Mi Saluteca lee la ficha y el design system,
pero **no los ángulos**. Salen piezas que no responden a ninguna estrategia, y lo que dice la marca en
la reunión no tiene dónde volver.

Es la palanca de `docs/producto/operacion.md` §11: sin estrategia como dato no existe el modo sistema.

## What Changes

- La marca suma un bloque **`strategy`**: `claim`, `enemy`, `angles[]` (nombre, para qué, ejemplos),
  `calendar[]` (cuándo, qué, ángulo), `neverAutomate[]`, `source` (de dónde salió) y `updatedAt`.
- `PATCH /api/brands/{id}` acepta `strategy`.
- El MCP `coevo-studio` devuelve un bloque nuevo, **`estrategia`**, en `ver_marca`.
- Se carga la de Mi Saluteca desde su spec de campaña.

**Fuera de este change:** la pantalla para verla y editarla en Studio (le toca al chat de diseño,
`docs/frontera-diseno-infra.md`) y escribirla desde el MCP (`operacion.md` §11.3).

## Capabilities

### New Capabilities
- `brand-memory`: qué guarda Studio de cada marca y cómo lo leen las skills (empieza por la estrategia).

## Impact

- `backend/main.py` (modelo + PATCH), `mcp/coevo-studio/studio.mjs` y `server.mjs` (bloque nuevo).
- Datos: `brands.json` del servidor. Requiere desplegar (`git pull` + `docker compose … up -d --build`).
