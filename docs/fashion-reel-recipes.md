# Fashion Reel — Recetas de movimiento

Spec de cómo Fashion Reel deja de ser "campos vacíos que hay que saber llenar" y
pasa a ser **una galería de movimientos conocidos** derivados de video real.

**Estado:** propuesta, sin implementar.
**Fecha:** 2026-09-23
**Depende de:** [workspace-template.md](workspace-template.md) — la UI de acá es una
aplicación de ese patrón, no un layout nuevo.

---

## 1. El problema

Hoy Fashion Reel te da un panel de configuración y vos tenés que saber qué escribir
para que el resultado sea bueno. El conocimiento de "qué prompt de movimiento
funciona" vive en la cabeza del operador, no en el producto.

Consecuencias medidas sobre el catálogo de Koxis (septiembre 2026, 8 videos):

| | movimiento medio | variabilidad |
|---|---|---|
| Referencia de producción real | 22.1 | 8.8 |
| Catalogo05 (el mejor nuestro) | 26.4 | 9.5 |
| Catalogo08 (el peor) | 38.0 | 27.8 |

*(Medido como diferencia media de luminancia entre frames consecutivos, 10 muestras
por video. Método en §7.)*

La variabilidad es el dato que importa: **8.8 es una modelo girando a ritmo
constante; 27.8 son arranques y frenadas**. Eso es lo que hace que un video "se vea
generado". No es resolución — nuestros videos salen a 1072×1928 contra los 720×1280
de la referencia.

---

## 2. La inversión

> No configurás un video desde cero: **elegís un resultado conocido y lo completás.**

Una **receta** es un movimiento validado, derivado de un video real, que ya trae su
prompt resuelto. El usuario elige la receta; la tool le pide *sólo* los inputs que esa
receta necesita.

```
HOY                                CON RECETAS
┌────────────────┐                 ┌────────────────┐
│ Dirección  [ ] │                 │  ┌────┬────┐   │
│ Look & feel[ ] │                 │  │ 🎞 │ 🎞 │   │  elegís un movimiento
│ Tomas      [ ] │   ──────▶       │  ├────┼────┤   │
│ Motion     [ ] │                 │  │ 🎞 │ 🎞 │   │
│ Duración   [ ] │                 │  └────┴────┘   │
│ ...            │                 │                │
│                │                 │ Modelo    ▸    │  y sólo te pide
│ (¿qué escribo?)│                 │ Look      ▸    │  lo que ESA receta
└────────────────┘                 │ Fondo     ▸    │  necesita
                                   └────────────────┘
```

---

## 3. Qué es una receta

```ts
interface MotionRecipe {
  id: string;
  label: string;              // "Giro 360° en ciclorama"
  thumbUrl: string;           // frame del video de origen
  previewUrl?: string;        // loop corto, autoplay en hover

  /** De qué video real salió. Es la trazabilidad: si una receta deja de
   *  funcionar, hay que poder volver al material que la originó. */
  sourceVideo: string;
  sourceNote?: string;        // "Catalogo05, giro de blazer, 0:03-0:09"

  /** El prompt de movimiento, ya resuelto y validado generando. */
  motionPrompt: string;
  negativePrompt?: string;

  /** Qué le pide al usuario. La UI se arma de acá — no hay formulario fijo. */
  inputs: RecipeInput[];

  /** Parámetros que la receta fija y el usuario NO elige. */
  fixed: {
    model: VideoModelId;      // la receta sabe con qué modelo fue validada
    mode: "i2v" | "f2f";
    durationSec: number;
    aspectRatio: string;
  };

  /** Métrica esperada, para detectar degradación (ver §7). */
  expectedMotion?: { mean: number; std: number };
}

type RecipeInput =
  | { kind: "avatar";    label: string; required: true }
  | { kind: "clothing";  label: string; min: number; max: number }
  | { kind: "background"; label: string; required: boolean }
  | { kind: "text";      label: string; placeholder: string; required: boolean };
```

### La regla que la define

**Una receta trae su prompt resuelto.** Si el usuario tiene que escribir el
movimiento, no es una receta — es el formulario de hoy con una foto arriba.

El usuario aporta el **QUÉ** (modelo, prendas, fondo). La receta aporta el **CÓMO**.

---

## 4. La UI

Aplicación directa de [workspace-template.md](workspace-template.md) §2. No se
inventa layout nuevo.

```
┌──────────────────────────────────────────────────────────────────────┐
│  ← Catálogo Koxis · Septiembre              KOXIS         ⚙  ✕       │  HEADER 48px
├────────────┬──────────────┬──────────────────────────────────────────┤
│            │              │  1080p · 9:16 · 6s          (de la receta)│  PARÁMS 48px
│ CONTROLES  │  SELECTOR    ├──────────────────────────────────────────┤
│            │              │                                          │
│ Movimiento │  ┌──┬──┬──┐  │   ┌─────────┐  ┌─────────┐               │
│  Giro 360° │  │🎞│🎞│🎞│  │   │  clip   │  │  clip   │               │
│         ▸──┼─▶├──┼──┼──┤  │   │         │  │         │               │
│            │  │🎞│🎞│🎞│  │   └─────────┘  └─────────┘               │
│ Modelo   ▸ │  └──┴──┴──┘  │                                          │
│ Look     ▸ │              │   CANVAS — nunca desaparece              │
│ Fondo    ▸ │  (la grilla  │                                          │
│            │   del campo  │                                          │
│ ────────── │   que abrió) │                                          │
│ Generar ▣6 │              │                                          │
│ ≈ $0.90    │   320px      │                                          │
└────────────┴──────────────┴──────────────────────────────────────────┘
   420px                                  resto
```

### 4.1 La receta es una FILA, no un popup

**Movimiento es la primera fila del panel izquierdo** (`SelectorTrigger`), y abre su
grilla en la columna del medio — igual que Modelo, Avatares o Prendas. No hay modal.

*Por qué no un popup:* el §2 del template lo prohíbe explícitamente (*"no se abre un
modal que tape todo"*), y resuelve la objeción del usuario: *"si estás en la UI,
¿querés volver a elegir un preset con otro popup?"*. Con una fila no "volvés a
elegir" — cambiás un campo, como cualquier otro. El canvas sigue visible mientras
comparás.

Contraste con Higgsfield Marketing Studio, que es lo que NO hay que copiar: su
"Select template" es un modal que tapa todo y después obliga a un wizard de seis
pasos (Template → Image → Action → Audio text → Audio settings → Background) antes
de ver un solo resultado.

| | Popup (Higgsfield) | Fila + SelectorPanel |
|---|---|---|
| Cambiar de receta | reabrir modal, tapa todo | tocás una fila |
| Ver lo generado mientras elegís | no | **sí** |
| Patrón | nuevo, hay que aprenderlo | el mismo que el resto |

**Primer uso:** el `SelectorPanel` arranca **abierto** en Movimiento. Se consigue el
"elegí algo antes de empezar" sin modal y sin un estado especial — es el panel
normal, abierto.

Mientras no hay receta elegida, **los campos de abajo no existen**. No se muestran
deshabilitados: no están. No hay nada que configurar hasta que se sepa qué se va a
hacer.

### 4.2 Los inputs se arman de la receta

Cada `RecipeInput` es una fila de 44px (`SelectorTrigger`) que abre el selector en la
**columna del medio** — nunca hacia abajo.

> ⚠️ Esto ya se rompió una vez. Look & Feel y Consistencia se convirtieron a filas
> pero siguieron abriendo inline dentro del panel, contra el §2 del template.
> Reportado por el usuario: *"¿por qué tengo que estar aclarando esto?"*

### 4.3 Los parámetros los fija la receta

Formato, resolución, duración y modelo **vienen de la receta** y se muestran como
lectura en la barra de parámetros, no como selectores.

*Por qué:* una receta fue validada con una configuración concreta. Si el usuario le
cambia el modelo o la duración, deja de ser la receta validada y vuelve a ser una
generación a ciegas — que es exactamente lo que esto viene a resolver.

Un "Ajustar" discreto puede abrirlos para el operador avanzado, pero cerrado por
defecto y avisando que se sale de lo validado.

### 4.4 La galería de recetas REEMPLAZA los campos sueltos

No conviven. Si quedan los dos, vuelve la redundancia que ya costó curar en el panel
de Fashion Reel (dirección vs look&feel vs motion, tres campos pidiendo lo mismo).

---

### 4.5 Cuánto cambia la UI actual

Poco. El esqueleto (420px de controles · selector al medio · canvas) queda igual.
Los cambios reales son tres:

1. **Una fila nueva arriba** — "Movimiento", que abre la grilla de recetas.
2. **Los campos de abajo se arman de `recipe.inputs`** en vez de ser fijos. Ahí
   desaparece la redundancia ya diagnosticada del panel (dirección vs look&feel vs
   motion, tres campos pidiendo lo mismo).
3. **Los parámetros pasan a lectura** porque los fija la receta.

Es la misma pantalla con un campo más que gobierna a los otros.

---

## 5. Cómo se deriva una receta de un video

Este es el trabajo real, y no es gratis. Por receta:

1. **Elegir el fragmento** — un movimiento limpio, 4-8s, sin cortes.
2. **Describir el movimiento** en términos de cámara y sujeto, no de estética.
   Gemini Vision puede dar un primer borrador (`analyzeMotionFromVideo` ya existe en
   el Lab), pero se cura a mano.
3. **Escribir el `motionPrompt`** — afirmativo, sin listas de prohibiciones.
   *Lección del Pixel (2026-09-22): cargar el prompt de negativos ("NO star flares",
   "no morphing") empeoró el resultado — el modelo igual los incorpora. El prompt
   corto y anclado a la referencia funcionó mejor.*
4. **Generar y medir** contra la métrica de §7.
5. **Comparar con el video de origen.** Si la variabilidad se dispara, el prompt pide
   más movimiento del que la receta promete.

### Las primeras candidatas

| # | Origen | Movimiento | Estado |
|---|---|---|---|
| 1 | `ref.mp4` (~/Downloads, 2026-09-23) | Giro lento sobre ciclorama amarillo, modelo de perfil sosteniendo la solapa del blazer. 6.4s, 30fps | **pedido explícito del usuario** — derivar primero |
| 2 | `Catalogo05.mp4` (Koxis/Septiembre) | El de mejor métrica del set propio (mean 26.4 · std 9.5) | candidata |
| 3 | a definir | — | — |

⚠️ Sobre `ref.mp4`: es un archivo **descargado de internet**, re-encodeado (720×1280,
1.4 Mbps). No sirve para juzgar calidad de origen — el usuario lo aclaró. Sí sirve
como **referencia de movimiento**, que es lo único que la receta necesita: el
`motionPrompt` se deriva de cómo se mueve, no de cómo está comprimido.

Dos señales de que ese clip es producción real y no generación: **30fps** (Kling y
Seedance sacan 24) y manos correctas con agarre natural de la solapa. Eso lo hace
buena referencia — el objetivo de una receta es justamente parecerse a filmación.

### Cuántas recetas al inicio

**Tres. No veinte.**

Una galería de veinte donde doce dan resultados mediocres es peor que tres que salen
siempre bien: destruye la confianza en toda la galería, y el usuario deja de creerle
a las que sí funcionan.

---

## 6. Por qué esto y no un "Marketing Studio"

Higgsfield tiene presets genéricos (Product Shot, Motion, UGC, Ads). Su ventaja es la
amplitud del catálogo.

| | Higgsfield | Nosotros |
|---|---|---|
| Presets | genéricos, muchos | de moda, pocos y validados |
| Origen | prompt engineering | **video real de cliente** |
| Ventaja | catálogo amplio | material que ellos no tienen |

Competir en amplitud es competir contra su fortaleza con menos recursos. El material
de Koxis es algo que Higgsfield no puede replicar porque no tiene ni el cliente ni la
filmación.

Además, por el criterio del propio [workspace-template.md](workspace-template.md) §8
—*"una tool se justifica si tiene un pipeline con pasos que el operador aprueba"*— un
Marketing Studio genérico sería "llenar campos y generar", o sea una Campaña con otra
receta. El Fashion Reel de recetas sí es un pipeline.

---

## 7. Métrica de calidad

Para detectar cuándo una receta se degrada, y para comparar contra producción real.

```python
# diferencia media de luminancia entre frames consecutivos, 10 muestras
frames = sample(video, n=10, scale=160)
diffs  = [abs(frames[i+1] - frames[i]).mean() for i in range(9)]
mean, std = np.mean(diffs), np.std(diffs)
```

| Rango de `std` | Lectura |
|---|---|
| < 10 | movimiento constante — lee a producción real |
| 10-20 | aceptable |
| > 25 | arranques y frenadas — **lee a IA** |

Referencia de producción real medida: `mean 22.1 · std 8.8`.

⚠️ Es una métrica **cruda**: mide cambio de luminancia, no calidad percibida. Un corte
de escena o un cambio de luz la disparan sin que haya nada mal. Sirve para detectar
degradación en una receta conocida, no para juzgar un video nuevo en abstracto.

---

## 8. Lo no resuelto

| # | Qué | Por qué importa |
|---|---|---|
| 1 | **Frame-to-frame necesita imagen final** | Para un giro 360° no existe: hay que generarla. Cada receta f2f tiene que declarar cómo obtiene su frame final |
| 2 | **De dónde sale la imagen inicial** | Fashion Reel debería ser sólo video, pero obligar a saltar entre tools es peor. Falta el camino "traer imagen curada del Lab / Content" sin salir de la pantalla |
| 3 | **Quién carga los videos de referencia** | Hoy los pasa el usuario a mano. Si esto escala a SaaS hace falta una vía para que un cliente suba el suyo |
| 4 | **Modelo por receta** | Kling v3 Pro es el mejor candidato (1080p, mejor identidad, $0.56/5s vs $2.31 de Seedance 2.5), pero cada receta debería declarar con cuál fue validada |
| 5 | **Recetas por marca vs del sistema** | Una receta derivada de Koxis, ¿la ve otro cliente? Afecta el modelo de negocio si esto se vende |

---

## 9. Audiencia

Tres perfiles, en orden de llegada:

1. **Equipo Coevo** — produce el catálogo de Koxis y otros clientes. Hoy.
2. **Artistas de IA externos** — usan el producto para sus propias marcas.
3. **Cliente directo (SaaS)** — Koxis entra y se genera sus videos.

El diseño de recetas sirve a los tres porque **esconde la configuración sin quitar
control**: el operador avanzado puede abrir "Ajustar"; el cliente directo nunca
necesita verlo.

---

## 10. Orden de trabajo

1. Derivar **una** receta de un `Catalogo*.mp4` y validarla generando. Evidencia
   antes que infraestructura.
2. Si funciona: el tipo `MotionRecipe` y la galería en el panel.
3. Inputs dinámicos desde `recipe.inputs`.
4. Dos recetas más.
5. Recién ahí, evaluar si escala.

---

## 11. Corrección de fondo: no son "movimientos", son VIDEOS

Feedback del usuario (2026-09-23), que invalida la premisa con la que arrancó este
spec:

> *"lo que es movimiento no es solo movimiento, es el video. Puede ser otro video de
> 15 segundos que puede ser no modelo. Imagínate un pantalón que cae en una caja y se
> mete adentro de la caja. O un video en el que del lado izquierdo aparece una modelo
> cambiándose y del lado derecho el video dividido en dos."*

Una receta no es "una forma de mover la cámara". Es **un formato de video completo**:
qué se ve, cuántas tomas tiene, quién aparece (o si no aparece nadie), cómo está
compuesto el cuadro.

### Lo que esto cambia

| | Antes (equivocado) | Ahora |
|---|---|---|
| Nombre | "Movimiento" | **"Formato"** / "Tipo de video" |
| Alcance | cámara + ritmo | toda la pieza: tomas, sujeto, composición |
| Sujeto | siempre una modelo | puede no haber modelo (producto solo) |
| Tomas | una | **varias**, con orden |

### La consecuencia sobre las prendas

El usuario preguntó, y es la pregunta correcta:

> *"¿qué pasa si el clip que estamos usando es un video que tiene dos prendas
> diferentes? ¿hay dos modelos o es una sola modelo que se va cambiando?"*

**La receta lo declara.** No es "N prendas = N clips": cada receta dice cuántos looks
necesita y en qué toma entra cada uno. Un video de una modelo que se cambia pide
2 looks y 1 modelo. Un video de catálogo pide 1 look por clip y se repite.

```ts
// El input de prendas deja de ser un rango suelto y pasa a tener ROL:
| { kind: "clothing"; label: string; min: number; max: number;
    /** Qué papel cumple cada look dentro de la pieza. Sin esto no se sabe
     *  si 2 prendas son 2 clips o 2 tomas del MISMO clip. */
    role: "one-per-clip"      // catálogo: cada look es un video aparte
        | "sequence"          // la modelo se cambia dentro del mismo video
        | "single" }          // un solo look para toda la pieza
```

### Story / Looks a la luz de esto

`Story` (4 escenas con arco narrativo) **desaparece cuando hay receta**: la receta ya
define la secuencia de tomas, sacada del video real. Tener las dos cosas es dos
gobiernos para lo mismo.

`Looks` **no era un modo de movimiento sino una política de repetición** — cuántos
clips salen. Con recetas eso lo declara `role: "one-per-clip"`. El toggle se va; el
comportamiento se queda.

> ⚠️ El usuario pidió **no cerrarlo todavía**: *"dejémoslo, documentémoslo y después lo
> vamos viendo, pero pensémoslo, porque hay muchos videos"*. La decisión final se toma
> con el material a la vista, no antes.

---

## 12. El fondo

> *"Si vos le pasás el fondo, es la fuente de la verdad."*

Dos caminos, y la receta elige cuál:

| Camino | Cuándo | Qué manda |
|---|---|---|
| **Fondo del Brand Kit** | el usuario elige una imagen | **la imagen manda** — es la fuente de verdad |
| **Descrito en el prompt** | la receta lo trae ("ciclorama liso") | lo genera el modelo |

Si el usuario pasa una imagen de fondo, esa imagen gana sobre lo que diga el prompt de
la receta. Si no pasa nada, la receta lo resuelve con su propia descripción.

O sea: el campo Fondo aparece **sólo si la receta lo admite**, y cuando aparece es
opcional — pero si se completa, pisa.

---

## 13. Cómo se muestran 25-40 recetas

El usuario planteó el problema de escala:

> *"pensemos que puede haber 25 videos, ¿o 40? No estamos seguros."*
> *"lo único que sí está bueno es que esté como en loop en el preview... Tal vez me
> imagino que estén y que vos hacés clic y ahí sí se te arroja un pop-up en el que ves
> todos. A eso me refería con el pop-up: vos los ves sin el pop-up, pero por ahí
> querés ver todos."*

**Recomendación: tira horizontal + "Ver todos".**

```
┌────────────────────────────────────────┐
│ FORMATO                                │
│ ┌────┬────┬────┬────┐                  │
│ │ ▶  │ ▶  │ ▶  │ ▶  │  →  Ver todos    │
│ └────┴────┴────┴────┘                  │
│  los 4 más usados, en loop             │
└────────────────────────────────────────┘
```

- **En el panel:** una tira horizontal con los 4-6 más usados, **en loop**, siempre
  visibles. Se entiende que son videos y que son elegibles sin abrir nada.
- **"Ver todos":** abre la grilla completa en la **columna del medio** (el
  `SelectorPanel` de siempre), con filtros por tipo — con modelo / solo producto /
  multi-toma.

*Por qué no todos en el panel:* con 40 recetas el panel se vuelve un catálogo y hay que
scrollear para llegar a Generar.

*Por qué la columna del medio y no un modal:* es el patrón del template (§2), el canvas
sigue visible, y es donde ya abren Modelo y Prendas. Lo que el usuario llamó "pop-up"
se cumple igual —ver todos sin perder lo que estabas haciendo— sin tapar la pantalla.

⚠️ **Performance con 40 recetas:** sólo la tira visible reproduce. La grilla completa
carga JPEG y monta el `<video>` en hover (ya implementado en `RecipeGrid`). 40 thumbs
de 6 KB son 240 KB; 40 videos serían ~1 MB de más sin que nadie los mire.

---

## 14. Material pendiente

El usuario va a pedirle a Keila que baje **todos los videos que pasó Koxis** para
estudiarlos y derivar recetas. Hasta entonces, la única derivada es
`giro-ciclorama` y está **sin validar**.

Formatos que el usuario ya identificó como candidatos:

- Giro en ciclorama (ya derivado, sin validar)
- Producto solo, sin modelo — *"un pantalón que cae en una caja"*
- Pantalla partida — *"de un lado la modelo cambiándose, del otro otra cosa"*
- Modelo que se aleja del celular filmándose — *"el clásico"*
- Multi-look: la misma modelo con dos prendas distintas en tomas distintas

---

## 15. Quién crea las recetas (y cómo escala)

Pregunta del usuario (2026-09-23):

> *"¿yo te tengo que pasar los videos, vos tenés que armarlos, o juntos tenemos que
> armar dinámicamente los inputs? Para hacerlos escalables, ¿qué onda? ¿Los formatos
> los seteamos nosotros previamente en el desarrollo?"*

### Las dos opciones obvias, y por qué ninguna sirve sola

| Camino | Problema |
|---|---|
| **Hardcodear en desarrollo** | No escala. Cada formato depende de un dev, y un cliente SaaS no puede sumar los suyos |
| **100% dinámico** | Es Content Analyzer otra vez — ya existe (`backend/tools/content_analyzer/`) y no resolvió esto. **Analizar ≠ tener una receta que funciona** |

### La decisión: la máquina propone, el humano aprueba

```
video → análisis automático → BORRADOR de receta → curación humana → validar generando → catálogo
```

La receta se guarda como **dato** (JSON, como las marcas), no como código. El paso de
curación **no se puede automatizar**, y esa es la decisión de fondo:

> Una receta vale lo que vale su prompt **validado generando**. El análisis puede
> describir el video perfecto y aun así el prompt generar mal — el prompt que DESCRIBE
> no es el prompt que GENERA.
>
> Evidencia: en la prueba del Pixel (2026-09-22) el segundo prompt era más detallado y
> más preciso en su descripción, y produjo un resultado **peor** (el teléfono rotó y
> perdió un lente). Ver §5.3.

Si un usuario sube un video y el sistema arma una receta sin validar, se le entrega
algo que probablemente falle — y una galería con formatos que fallan destruye la
confianza en todos, incluidos los buenos (§5).

### Lo que ya existe y se reusa

`backend/tools/content_analyzer/default_prompt.txt` **ya extrae** lo que una receta
necesita: arco narrativo, pacing, trabajo de cámara, estilo visual, y sabe reemplazar
producto / personaje / vestuario por los del brand kit. **El 80% del derivador ya está
escrito** — falta la capa de curación y persistencia, no el análisis.

### Dos niveles de catálogo (y el camino a SaaS)

| Nivel | Quién lo crea | Quién lo ve |
|---|---|---|
| **Formatos del sistema** | equipo Coevo, validados | todas las marcas |
| **Formatos de la marca** | el cliente sube su video | sólo esa marca |

Esto resuelve la pregunta abierta de §8.5 (si una receta de Koxis la ve otro cliente):
**no**, salvo promoción explícita a formato del sistema.

### Orden recomendado

1. **Derivar `giro-ciclorama` A MANO y validarla generando.** Sin construir nada. Si el
   prompt no produce un giro parejo (std cerca de 8.8, §7), todo lo demás no importa —
   y se descubre por $0.67.
2. Si funciona: automatizar el borrador reusando Content Analyzer.
3. Recién después: UI para que un cliente suba su propio video.

⚠️ El paso 1 **no tiene infraestructura a propósito**. Es la evidencia antes que el
mecanismo.
