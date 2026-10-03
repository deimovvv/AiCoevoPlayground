# Frontera entre diseño e infraestructura

**Por qué existe este doc.** El rediseño del dashboard (ver
`dashboard-architecture-research.md`) y el trabajo de motor (modelos, calce,
voz, costos) avanzan en paralelo, en conversaciones distintas. Se tocan en tres
puntos concretos. Si nadie escribe el contrato, los dos lados asumen cosas
distintas y el trabajo se pisa.

**Fecha:** 2026-09-20
**Estado:** contrato propuesto. Lo que dice "ya existe" está verificado en código.

---

## Quién decide qué

| Dominio | Decide | Ejemplos |
|---|---|---|
| **Pantalla** | chat de diseño | sidebar, layout de 3 columnas, lenguaje visual, login, nombres visibles de tools |
| **Motor** | chat de infra | qué modelo corre cada tarea, pose/calce/encuadre, pipeline de voz, costo real por pieza |
| **Frontera** | acordado acá | qué datos expone el backend, cómo se guarda una Receta, de dónde sale el número del botón |

Regla simple para desempatar: **si cambia lo que el usuario VE pero no lo que el
sistema HACE, es diseño. Si cambia lo que el sistema hace aunque se vea igual,
es infra.**

---

## Punto de contacto 1 — El costo en el botón (`Generar ▣ 3`)

**Ya existe la mitad.** `frontend/src/lib/pricing.ts` se describe a sí mismo como
*"base del estimador de costo (antes de correr) y del costo REAL registrado por
corrida"*. Convierte operaciones a USD y a créditos con markup (1 crédito =
$0.01). `costLedger.ts` ya registra el costo real, instrumentado en `lib/api.ts`
— no en las tools, así que una tool nueva queda medida sola.

**Lo que falta es solo llamarlo antes de generar, no calcularlo.**

Contrato:
- El botón pide el estimado a `pricing.ts` con la config actual (cantidad de
  tomas × variantes × modelo × resolución).
- Diseño decide cómo se muestra (créditos, USD, ícono).
- Infra garantiza que el estimado use los mismos precios que el cobro real.

⚠️ **Precisión honesta:** el estimado no puede ser exacto. El ledger *"adjudica
por cercanía temporal, no por id de corrida"* (ver `pricing-credits.md`), y hay
descarte real (1.6× imágenes / 1.3× video según `financial-model.md`). El número
del botón es **lo que cuesta un intento**, no lo que va a costar la pieza
terminada. Si el diseño lo muestra como promesa, miente.

---

## Punto de contacto 2 — Recetas (el `Looks` de Genera)

**Punto de partida existente:** `brands.py` ya tiene `"lookAndFeel": []` en el
esquema de marca, y hay tooling de Look & Feel (tres caminos: guardado / upload
ad-hoc / receta a mano, ver `decisions-log` 2026-06). Una Receta es esa idea
**extendida más allá del color-grade**.

Qué guarda una Receta, propuesto:

```
{
  id, name,
  brandId,
  cast: [avatarId],           // qué modelo(s)
  location: assetId | prompt, // dónde
  lookAndFeel: lookFeelId,    // luz y color (lo que ya existe)
  shots: [shotId],            // qué tomas
  engine: "seedance"|"kling", // palanca costo/calidad
}
```

**Por qué importa para producción, no solo para UI.** Con una cuenta mensual
(ej. una marca con 3 líneas de producto y públicos distintos), cada línea
necesita su combinación fija. Sin Recetas, cada pieza se configura de nuevo y la
consistencia depende de la memoria del operador. **Es un requisito de
producción que se ve como feature de UI.**

Contrato:
- Diseño decide cómo se crean, se eligen y se muestran.
- Infra define el esquema y garantiza que aplicar una Receta produzca el mismo
  resultado que configurar a mano.
- **Abierto:** ¿la Receta vive en la marca (como `lookAndFeel`) o en la campaña?
  Precedente aplicable: *"Todo lo que es de una marca vive adentro de la marca"*
  (decisions-log 2026-08) → sugiere que va en la marca.

---

## Punto de contacto 3 — Estado de las piezas en el canvas

**Ya existe entero.** No hay que construirlo:

- `workStatus` por generación: `draft | in_progress | review | sent | changes | approved`
  (`main.py:235`)
- `_sync_work_status_from_review()` — un "change" del cliente pasa la pieza a
  `changes`; todos los clips aprobados → `approved` (`main.py:5065`)
- Inbox con contador de lo que exige atención: `workStatus in ("review","changes")`
  (`main.py:5260`)
- Portal del cliente con links por persona y aprobación por clip

Contrato:
- El canvas lee `workStatus` y lo muestra. No inventa estados nuevos.
- Si diseño necesita un estado que no está en esa lista, **es un cambio de
  modelo** y se discute acá, no se agrega en el frontend.

---

## Lo que NO es frontera (para no perder tiempo discutiéndolo dos veces)

**Decisiones ya cerradas en `decisions-log.md` que el rediseño debe respetar:**

1. **Marcas arriba, no adentro de la campaña** (2026-08): *"Todo lo que es de una
   marca vive adentro de la marca; el nav de afuera es la operación"*. Genera lo
   hace distinto porque no tiene clientes recurrentes.
2. **La capa de operación vive en módulos propios que CONSUMEN las tools. Ni una
   línea dentro de `ToolRunPage.tsx`** (2026-08) — 14.910 líneas, meterle esto lo
   mata.
3. **App-first, Studio después** (2026-07): *"NO invertir el orden"*.
4. **El cliente no encarga trabajo: deja notas** (2026-08).

**Sobre migrar el wizard al layout de 3 columnas** (pregunta abierta #1 del doc de
dashboard): son 17 tools con `stepHandlers`. Recomendación de infra: **migrar UNA
y medir**, no las 17. El wizard tiene una virtud que el canvas no — obliga a
aprobar por paso, que es la regla de trabajo ya establecida (*"una toma →
mostrar → confirmar → siguiente, NUNCA batchear"*, memoria del proyecto).

---

## Higiene pendiente del catálogo de tools

Detectado al revisar nombres. No es urgente pero ensucia la elección:

| Tool | Estado real | Acción sugerida |
|---|---|---|
| `fashion_reel` | ✅ activa | Renombrar: el nombre la encierra en moda pero sirve para cualquier producto |
| `fashion_reels` (plural) | 🗑️ **código muerto** | Borrar — tiene `index.ts` que no importa nadie |
| `reel_creator` | ⏳ `status: "coming_soon"` | Decidir: implementar o sacar del registro |
| `product_clip` | ✅ activa | Sin cambios — video sin personas, bien diferenciada |
| `ugc_creator` | ✅ activa | Sin cambios — video con persona hablando |

Corrección a una lectura apresurada: **no hay tres tools que se pisen.** Hay dos
activas y bien diferenciadas (con personas / sin personas), una muerta y un
placeholder.

`ecommerce_pack` está bien nombrada: dice qué entrega.

---

## Cómo se sincronizan los dos chats

1. **Este documento es el punto de encuentro.** Si un lado cambia algo que el
   otro asume, se actualiza acá primero.
2. **Decisiones que cierran van al `decisions-log.md`**, no a este doc. Acá vive
   el contrato vigente, no la historia.
3. **Ante duda de a quién le toca:** si cambia lo que el usuario ve pero no lo
   que el sistema hace → diseño. Si cambia lo que el sistema hace aunque se vea
   igual → infra.
