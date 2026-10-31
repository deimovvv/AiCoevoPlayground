## Why

Hoy cada generación recibe la cara de la modelo y las prendas **sueltas**, y el
modelo tiene que vestirla de nuevo en cada toma — cada vez un poco distinto. Es una
causa central del drift de identidad y de prenda.

El método de Mauro Arredondo (`mauroarredondo.com.ar/pagina-maestra`) lo resuelve
al revés: **arma el look una vez, lo aprueba y lo reusa.** Pedido del usuario
(2026-09-29):

> *"la ropa, el outfit para hacer una campaña: la hace como un vestuario sheet... y
> cuando vamos a usar a la modelo, le pone la ropa y hace un avatar sheet, pero con
> la ropa que querés. Deberíamos ver cada una de estas tools, que sea dinámica, según
> el caso, y que se entiendan los pasos."*

## What Changes

Un pipeline nuevo, **Casting**, con pasos que se aprueban:

1. **Outfit sheet** (opcional — se saltea si el look ya está armado): las prendas
   sueltas → el look completo sobre un cuerpo, con detalles.
2. **Character sheet con el outfit** (requerido): la modelo vestida con ese look,
   en varios ángulos, con un panel canónico que fija la identidad.
3. **Planos extra** (opcional): perfil, espalda, 3/4.
4. Se guarda en el Brand Kit como un **look aprobado**.

Campañas y Fashion Reel consumen el look aprobado en vez de prendas sueltas.
`avatar_creator` y `product_sheet` dejan de ser tools separadas y pasan a ser pasos
de este pipeline. La rama de producto suma **escala con medidas numéricas**
(mujer 170 cm, hombre 180 cm).

⚠️ **No se copian los prompts de Mauro**: son material de su curso. Se toma el
método (panel canónico, maniquí sin rasgos en el outfit sheet, medidas explícitas)
y se escriben prompts propios, validados generando.

## Capabilities

### New Capabilities

- `casting`: preparar y aprobar un look reusable antes de producir.

### Modified Capabilities

- `tool-catalog`: `avatar_creator` y `product_sheet` se absorben como pasos.

## Impact

- Nueva tool `frontend/src/tools/casting/` + entrada en `backend/tools/registry.json`.
- Brand Kit: un tipo de asset nuevo, "look aprobado".
- **A verificar antes de construir:** el runner de pipelines no tiene hoy el concepto
  de paso opcional (sólo `approvalSteps` y `autoRunSteps`).

## Aprendizajes de uso (2026-10-21, carruseles de Coevo)

Salieron de producir fichas fuera del Studio. Ver también la skill `avatar-sheet`
(`coevo-skills/skills/avatar-sheet`).

- **El character sheet es UNA sola imagen generada** con todas las vistas adentro
  (cuerpo entero frente/perfil/espalda, retrato, detalles, paleta). Generar 8 imágenes
  sueltas y componerlas cuesta ~9 veces más y la identidad deriva entre imágenes.
- **Para identidades usar GPT Image 2 en calidad alta.** Nano Banana 2 deja la piel
  plástica; GPT da poros, pecas y textura real. Costo ≈ USD 0,21 por ficha.
- **Prompt anti-plástico:** pedir poros visibles, piel mate, sin filtro de belleza,
  nitidez natural (sin sobre-enfoque).
- **Sin texto en la imagen:** las etiquetas de los paneles se agregan después.
- **QA obligatorio:** misma cara y misma ropa en todos los paneles (detalles como tachas
  en los puños derivan), manos, una sola persona, sin logos.
- **Las fotos del roster de Morph son generadas** y heredan su acabado: si la
  referencia ya es plástica, la ficha también. Conviene partir de la mejor foto
  disponible.
- **No encadenar ediciones** sobre una imagen ya editada: degrada la piel.
