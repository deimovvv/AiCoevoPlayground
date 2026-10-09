# Auditoría de tools — ¿cuáles se justifican?

Las 17 tools registradas, medidas contra el criterio de
[workspace-template.md](workspace-template.md) §8:

> *"Una tool se justifica si tiene un **pipeline con pasos que el operador aprueba**.
> Si es 'llenar campos y generar', eso es una Campaña con otra receta."*

**Fecha:** 2026-09-25 · **Método:** lectura de los 17 `index.ts` + `registry.json`.
Ninguna conclusión es de memoria: `approvalSteps` es el dato que decide.

---

## 1. Cómo leer esto

El dato que clasifica es **`approvalSteps`**: pasos donde el operador mira el
resultado intermedio y decide si sigue. No cuenta:

- **Ver** pasos pasar (`autoRunSteps` sin approval) — es un progress bar
- **Checkboxes en el formulario** — es configuración, no curación
- **Pasos internos del handler** que el operador nunca ve

⚠️ **Gotcha de arquitectura:** el ORDEN de los pasos lo define el backend
(`registry.json.pipeline`), pero las APROBACIONES el frontend (`approvalSteps`).
Un handler que existe en el front pero no está en el pipeline del backend es
**código muerto** — pasa con `content_analyzer.generate_batch`.

---

## 2. La tabla

| tool | pasos | approvals | genera | veredicto |
|---|---|---|---|---|
| `ugc_creator` | 6 | **5** | video + audio | **TOOL** |
| `video_ad_creator` | 8 | **7** | video + audio | **TOOL** |
| `fashion_reel` | 5 | **4** | video | **TOOL** |
| `product_clip` | 5 | **4** | video | **TOOL** |
| `content_analyzer` | 4 | **3** | análisis + ruteo | **TOOL** |
| `avatar_creator` | 3 | **2** | imagen | **TOOL** |
| `product_sheet` | 3 | **2** | imagen | **TOOL** |
| `product_spotlight` | 3 | **2** | imagen | **TOOL** (frontera) |
| `video_swap` | 1 | 1 | video (edita) | **DUDOSA** |
| `carousel_creator` | 2 | 1 | imagen | **DUDOSA** |
| `ecommerce_pack` | **1** | **0** | imagen | **TOOL** — decisión del usuario, le faltan los gates |
| `fashion_editorial` | **1** | **0** | imagen | **PRESET** |
| `scene_reconstruct` | **1** | **0** | imagen | **PRESET** |
| `screen_mockup` | 2 | **0** | imagen | **PRESET** |
| `fooh_subway` | 3 | **0** | imagen | **PRESET** |
| `static_ad` | 2 | 1 | imagen | **MUERTA** (`hidden`) |
| `ad_creative_lab` | 4 | 1 | imagen | **MUERTA** (`hidden`) |

**Totales:** 9 tools reales · 4 presets de Campañas · 2 dudosas · 2 muertas.

---

## 3. El conflicto: Ecommerce Pack

**`ecommerce_pack` no pasa el criterio** — `approvalSteps: []`, `autoRunSteps: []`,
`needsApproval: false`. Y es, según `decisions-log.md`, **la más usada en producción**.

> ⚠️ El §8 de `workspace-template.md` afirmaba que sí se justificaba ("multi-toma con
> curación por prenda ✅"). **Era falso, escrito sin leer el código.** Corregido el
> 2026-09-25. Lo que se llamaba "curación" son checkboxes de tomas en el formulario.

**RESUELTO (2026-09-25, decisión del usuario):** *"Commerce pack, sí, dejémoslo como una
tool"*. No se migra. Queda como tool y lo que falta es implementarle los gates que el
usuario ya pidió: una toma → mostrar → confirmar → siguiente, nunca batchear.

**El razonamiento original, que queda como referencia:** si el preset de
Campañas no cubre lo que Ecommerce Pack hace hoy, **se revisa el criterio, no la tool**.
Un criterio que te obliga a degradar tu flujo más usado está mal formulado.

Hay una tercera lectura posible: Ecommerce Pack **debería** tener aprobaciones y no las
tiene. El usuario ya pidió *"generar de a UNA toma: una toma → mostrar → confirmar →
siguiente, NUNCA batchear"* (ver memoria del proyecto). Eso es exactamente un
`approvalStep` por toma. Bajo esa lectura no es un preset mal clasificado: es **una tool
real a la que le falta implementar sus gates**.

---

## 3b. Por qué Fashion Editorial sí y Ecommerce Pack no

Los dos tienen `approvalSteps: []`, pero no son el mismo caso:

| | Fashion Editorial | Ecommerce Pack |
|---|---|---|
| Qué produce | N variantes de **una** toma | **varias tomas** distintas de un producto |
| Aprobaciones que *debería* tener | ninguna — es una receta | **una por toma** (pedido del usuario) |
| Mecanismo | 12 cláusulas de prompt + inputs del kit | pipeline multi-toma con priorización de refs |
| ¿Campañas ya hace esto? | **sí** — mismos inputs, y su preset de iluminación ya inyecta fragmentos de prompt igual (`NewCampaignPage.tsx:470`) | no |

Fashion Editorial es **una receta sin pipeline**: no hay nada intermedio que aprobar
porque es un solo disparo. Ecommerce Pack es **un pipeline sin gates implementados**:
sí hay algo que aprobar entre toma y toma, sólo que hoy no se pregunta.

Por eso uno se convierte en preset y el otro se arregla.

---

## 4. Nada cae en "preset de Fashion Reel"

Categoría vacía. Todo lo que genera video —`ugc_creator`, `video_ad_creator`,
`fashion_reel`, `product_clip`— tiene 4 o más aprobaciones. La única de un paso es
`video_swap`, que **no genera** video: edita uno que vos subís.

Consecuencia: la migración a presets es **sólo hacia Campañas**. Fashion Reel no recibe
tools; recibe recetas derivadas de video real
(ver [fashion-reel-recipes.md](fashion-reel-recipes.md)).

---

## 5. Hallazgos colaterales

| # | Qué | Dónde |
|---|---|---|
| 1 | **Código muerto**: `content_analyzer.generate_batch` (~40 líneas) está en `stepHandlers` pero NO en el pipeline del backend → nunca se invoca | `content_analyzer/handlers.ts` |
| 2 | `content_analyzer` tiene pasos en `autoRunSteps` **y** en `approvalSteps` a la vez — arranca solo pero pide aprobar el resultado. Intencional, pero rompe la lectura naive de "autoRun = sin operador" | `content_analyzer/index.ts` |
| 3 | El gating de visibilidad vive **sólo en el backend** (`main.py` L407-418 saltea `hidden: true`). `GeneratePage` no filtra por su cuenta | `backend/main.py` |
| 4 | `ecommerce_batch` existe en el backend pero no en el registry del front: tiene ruta propia (`/dashboard/ecommerce-batch`) y queda fuera del criterio por diseño | `registry.json` |
| 5 | `product_spotlight` es la única sin `autoRunSteps` → todos sus pasos son manuales, lo que la hace más gated de lo que su estructura sugiere | `product_spotlight/index.ts` |

---

## 6. Qué haría con esto

**No migrar las 5 de golpe.** El orden que minimiza riesgo:

1. ✅ **`fashion_editorial` — HECHO** (commit `b42fde6`): oculta, sus cláusulas en
   `data/system/framing.json` y `vibe.json`. Era
   el caso más limpio y sus 12 cláusulas de prompt son el activo a preservar.
2. **`screen_mockup`, `fooh_subway`, `scene_reconstruct`** — los tres son presets claros
   y de bajo uso. Migración mecánica.
3. **`ecommerce_pack` al final, y con la decisión tomada** — o se le implementan los
   gates que el usuario ya pidió (una toma → confirmar → siguiente), o se revisa el
   criterio. No se migra a ciegas.
4. **Las dudosas y muertas** (`video_swap`, `carousel_creator`, `static_ad`,
   `ad_creative_lab`) — decidir si vuelven o se borran. Dos ya están ocultas, así que
   nadie las va a extrañar.

**Lo que NO hay que perder en ninguna migración:** las cláusulas de prompt. Son el
trabajo real acumulado; el andamiaje de pipeline se reescribe en una tarde.
