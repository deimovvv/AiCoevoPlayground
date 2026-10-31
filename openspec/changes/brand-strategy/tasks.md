## 1. Construir
- [x] 1.1 Modelo `BrandStrategy` + `strategy` en `UpdateBrandRequest` y en el PATCH.
- [x] 1.2 Bloque `estrategia` en el MCP (`brandBlocks`, `BLOQUES`).

## 2. Desplegar y cargar
- [x] 2.1 Desplegar en el servidor (`git pull && docker compose -f docker-compose.prod.yml up -d --build`).
- [x] 2.2 Cargar la estrategia de Mi Saluteca desde `spec-campana-mi-saluteca.md`.
- [x] 2.3 Verificar con `ver_marca(mi-saluteca, estrategia)`.

## 3. Después (otros changes)
- [~] 3.1 Verla en Studio: el Plan muestra claim, ángulo del mes y ángulos (2026-10-31). Falta editarla en Marca.
- [ ] 3.2 La skill `carrusel` lee el bloque `estrategia` y elige el ángulo antes del guion.
