## 1. Construir
- [x] 1.1 Modelo `BrandStrategy` + `strategy` en `UpdateBrandRequest` y en el PATCH.
- [x] 1.2 Bloque `estrategia` en el MCP (`brandBlocks`, `BLOQUES`).

## 2. Desplegar y cargar
- [ ] 2.1 Desplegar en el servidor (`git pull && docker compose -f docker-compose.prod.yml up -d --build`).
- [ ] 2.2 Cargar la estrategia de Mi Saluteca desde `spec-campana-mi-saluteca.md`.
- [ ] 2.3 Verificar con `ver_marca(mi-saluteca, estrategia)`.

## 3. Después (otros changes)
- [ ] 3.1 Verla y editarla en Studio → Marca (chat de diseño).
- [ ] 3.2 La skill `carrusel` lee el bloque `estrategia` y elige el ángulo antes del guion.
