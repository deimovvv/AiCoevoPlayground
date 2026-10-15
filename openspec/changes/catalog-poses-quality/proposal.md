## Why

Rehacer las fotos y el video de `morphaiagency.com/catalogo` (2026-10-15) dejó claro que lo que
Morph vende en Catálogo (fotos on-model con poses curadas, variantes, video de ficha) todavía se
hace mejor por script que desde Coevo Studio:

> *"no me gusta tanto la pose. hacela más natural"* · *"está pésima la foto… no me acuerdo si
> habíamos generado las fotos de los maniquíes con diferentes poses, para que tengamos el
> selector de poses en el e-commerce pack"* · *"¿y qué pasa si quieren otra foto, más
> editorial?"* · *"todos estos aprendizajes los tengamos tanto en fashion reels como en
> e-commerce pack"* — usuario, 2026-10-15

Las poses curadas existen (`~/Documents/POSES-MUJER`, `POSES-HOMBRE`: 28–29 cada una, por plano)
pero la app sólo tiene una librería por marca, y sólo Garçon cargó 10.

## What Changes

1. **Librería de poses de Coevo**, no por marca: mujer y hombre, por plano (cuerpo entero, medio,
   inferior, detalle). La librería de cada marca queda arriba como extra. Las poses de medio,
   inferior y detalle hoy son muñeco de madera: se rehacen como maniquí de tienda, igual que las
   de cuerpo entero.
2. **Selector de pose por toma** en el Ecommerce Pack: cada toma muestra las poses de su plano y
   del género de la modelo, en miniatura.
3. **Estilo de la ficha: Catálogo / Editorial.** Un solo control que cambia fondo, luz y set de
   poses juntos. Editorial = fondo con textura o set simple, luz con dirección, poses con actitud
   (sentada en un cubo, apoyada, caminando). La prenda y el calce siguen mandando; una campaña con
   escenario completo sigue siendo Campañas.
4. **Lo aprendido, dentro de los prompts de la tool:** encuadre al principio; rol de cada imagen;
   recortar la cara de la persona real en las fotos de prenda; estiradas que no copian la
   referencia y respetan el largo; accesorio sólo en cuerpo entero y plano medio.
5. **Salida al doble del tamaño de la web** (4K → 1800×2234 para 900×1117).
6. **Video de ficha en Fashion Reel:** tres planos (general, detalle, medio) de 4 s con Kling V3
   Pro, prompts de acción concreta (no "movimiento sutil") y control de movimiento; el accesorio no
   cambia de tamaño (se pide en el prompt y se revisa).

Caso de referencia: `~/cov/reels/catalogo-morph/v2/` (script `gen.py`, prompts por toma) y la
skill `generar-imagenes` (sección "Ficha e-commerce con modelo").

## Capabilities

### New Capabilities
- `catalog-photo`: fotos de ficha on-model con poses curadas y estilo Catálogo/Editorial.

## Impact

- `frontend/src/tools/ecommerce_pack/index.ts` (selector de pose, estilo, prompts).
- `backend/data/poses/` → librería global (assets de Coevo, no datos de cliente).
- `frontend/src/tools/fashion_reel/` (receta "video de ficha" en tres planos).
- Depende de `ecommerce-pack-gates` (de a una toma con aprobación).
