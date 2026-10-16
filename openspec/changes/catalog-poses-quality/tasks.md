## 1. Poses

- [ ] 1.1 Rehacer las 18 poses de muñeco de madera (medio, inferior, detalle) como maniquí de tienda, mujer y hombre (~US$2–3).
- [x] 1.2 Librería global de poses de Coevo (mujer/hombre × plano) servida por el backend: `backend/data/system/poses.json` + `poses/{mujer,hombre}/*.webp`, `GET /api/system/poses?gender=&plano=&shot=`, `fetchSystemPoses` en `api.ts` (2026-10-16). Falta sumar la de la marca encima en el selector (1.3).
- [ ] 1.3 Selector de pose por toma en el Ecommerce Pack, filtrado por plano y género.
- [ ] 1.4 Set de ~10 poses editoriales por género (sentada en cubo, apoyada, caminando, sobre el hombro).

## 2. Estilo de la ficha

- [ ] 2.1 Control "Catálogo / Editorial" que fija fondo, luz y set de poses.

## 3. Prompts y salida

- [ ] 3.1 Encuadre al principio del prompt y rol de cada imagen.
- [ ] 3.2 Recortar la cara de la persona en las referencias de prenda (detección de cara + recorte).
- [ ] 3.3 Estiradas: "foto nueva, no editar la referencia" + largo por proporciones.
- [ ] 3.4 Export al doble del tamaño de la web.

## 4. Video de ficha (Fashion Reel)

- [ ] 4.1 Receta "video de ficha": general + detalle + medio, 4 s c/u, Kling V3 Pro, prompts de acción, control de movimiento.

## 5. Prueba con el usuario

- [ ] 5.1 Rehacer el caso short + body desde la app y compararlo con el del script.
