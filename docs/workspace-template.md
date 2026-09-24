# Workspace Template — el patrón de pantalla de Coevo Studio

Spec del layout que comparten (o deberían compartir) **todas** las pantallas donde
se genera contenido: Lab, Campañas, y las 17 tools.

**Estado:** propuesta. Implementado en Lab y Campañas; las tools siguen con el
layout viejo.
**Fecha:** 2026-09-21

---

## 1. El problema que resuelve

Hoy hay **tres layouts distintos** para hacer lo mismo:

| Pantalla | Cómo elegís un modelo / asset | Dónde ves el resultado |
|---|---|---|
| **Lab** ✅ | Panel del medio que empuja el canvas | Galería a la derecha, siempre visible |
| **Campañas** ✅ | Panel del medio que empuja el canvas | Canvas a la derecha, siempre visible |
| **Tools** (17) ❌ | Se despliega ABAJO, dentro del panel de config | Canvas, pero el wizard navega entre pasos |

Reportado por el usuario sobre Fashion Reel: *"los modelos se despliegan abajo,
no a la derecha, como estábamos hablando"*.

El costo: cada pantalla se aprende de nuevo, y cada mejora hay que hacerla tres veces.

---

## 2. El template

```
┌──────────────────────────────────────────────────────────────────────┐
│  ← [Nombre de la corrida]                        MARCA      ⚙  ✕     │  HEADER · 48px
├────────────┬──────────────┬──────────────────────────────────────────┤
│            │              │  Formato 9:16 4:5 · Resolución 2K · …    │  PARÁMETROS · 48px
│ CONTROLES  │  SELECTOR    ├──────────────────────────────────────────┤
│            │              │                                          │
│ Marca      │  ┌──┬──┬──┐  │   ┌─────────┐  ┌─────────┐               │
│ Producto ──┼─▶│  │  │  │  │   │         │  │         │               │
│ Prendas    │  ├──┼──┼──┤  │   │  pieza  │  │  pieza  │               │
│ Avatar     │  │  │  │  │  │   │         │  │         │               │
│ Iluminación│  └──┴──┴──┘  │   └─────────┘  └─────────┘               │
│ Tomas      │              │                                          │
│            │  (se abre    │   CANVAS — nunca desaparece              │
│            │   al tocar   │                                          │
│ ─────────  │   un campo)  │                                          │
│ Generar ▣3 │              │                                          │
│ ≈ créditos │   320px      │                                          │
└────────────┴──────────────┴──────────────────────────────────────────┘
   420px          (a pedido)              resto
```

### La regla que lo define

**El canvas NUNCA desaparece.** Tocás un campo del panel izquierdo y el selector
se abre *al lado*, empujando el canvas — no navegás a otra pantalla, no se abre un
modal que tape todo, y el selector no se despliega hacia abajo dentro del panel.

*Por qué empuja y no tapa:* mientras elegís una cara o una pose querés seguir
viendo lo que ya generaste, para comparar. Un overlay encima rompe justamente eso.

*Por qué al lado y no abajo:* desplegar dentro del panel empuja todo lo demás y
obliga a scrollear para volver al botón de generar. Es lo que pasa hoy en las tools.

---

## 3. Las cinco zonas

### 3.1 Header — 48px, todo el ancho
`← volver` · nombre editable de la corrida · marca activa · acciones (borrar, cerrar).
Nunca dentro del panel: el nombre de lo que estás haciendo es contexto de pantalla.

### 3.2 Controles — 420px, izquierda
Lo que define **QUÉ** se genera: brief, assets, tomas.
- Padding `px-5 py-5`, separación `space-y-6`
- Cada campo es una **fila de 44px** con thumb + label + valor (`SelectorTrigger`)
- Footer sticky con el botón principal y el costo estimado

### 3.3 Selector — 320px, se abre a pedido
`SelectorPanel`. **Un solo picker por vez**: el del campo que lo abrió.
Pestañas de origen cuando aplica (Presets del sistema / De la marca / Pinterest).
Escape cierra.

⚠️ **Las miniaturas arrancan ARRIBA, pegadas al header del panel.** Nada de título
grande ni descripción antes de la grilla: lo que se vino a hacer es elegir una
imagen, y si hay que scrollear para ver la primera fila el panel falló.

### 3.4 Parámetros — barra de 48px sobre el canvas
Lo que define **CÓMO** se genera: formato, resolución, variantes, duración.
Separado del brief a propósito — ref. panel RUN SETTINGS de Invent:
> *"Run parameters live here. What defines WHAT gets generated lives in the brief."*

Va como barra y no como cuarta columna para no robarle ancho a la galería.

### 3.5 Canvas — el resto
Las piezas generadas, con progreso y placeholders mientras salen.
Cada pieza en hover: **Editar** · **Animar** · **Descargar**.

⚠️ **Editar NO abre una pantalla completa nueva.** Abre el editor de inpaint
*dentro del canvas*: la pieza se agranda en su lugar, con el prompt abajo y el
lápiz encima. Sigue viéndose que estás en la misma corrida — no se pierde el
contexto de las otras piezas. (Hoy `EditOverlay` es `fixed inset-0`: eso hay
que corregirlo.)

---

## 4. Componentes que ya existen

| Componente | Qué hace | Dónde vive |
|---|---|---|
| `SelectorPanel` | La columna del medio | `components/workspace/` |
| `SelectorTrigger` | La fila que la abre | `components/workspace/` |
| `EditOverlay` | Editor a pantalla completa | `components/workspace/` |
| `MaskCanvas` | Selección por recuadro / varita / pincel | `components/workspace/` |
| `ImageEditPanel` | Prompt + referencias (variantes `bar` y `full`) | `components/` |
| `ChipRow` | Parámetros como chips | en `ManualLabV2`, **a extraer** |

⚠️ **`ChipRow` está duplicado**: una copia en Lab y otra (`Options`) en Campañas.
Hay que extraerlo a `components/workspace/` antes de que una tercera lo copie.

---

## 5. Cómo se aplica a una tool

Ejemplo con **Fashion Reel**, que hoy despliega los modelos abajo:

| Hoy | Con el template |
|---|---|
| Panel 440px con todo apilado | Controles 420px: Marca · Looks · Tomas · Motion |
| Selector de modelo desplegado abajo | `SelectorTrigger` "Modelo" → abre el selector al lado |
| Formato/duración dentro del panel | Barra de parámetros sobre el canvas |
| Wizard: script → base → multishot → animate | Canvas persistente, los pasos se ven como secciones |
| Tercer panel de 300px a la derecha | Se va: su contenido baja al canvas |

---

## 6. Lo que NO cambia

**El wizard no desaparece.** `ToolRunPage` (15.029 líneas) obliga a aprobar paso
por paso, y esa es una regla de trabajo del proyecto:
> *una toma → mostrar → confirmar → siguiente, NUNCA batchear*

Lo que se adopta es el **chrome** (dónde vive cada cosa), no el modelo de ejecución.
La aprobación por paso se mantiene adentro del canvas.

---

## 7. Orden de migración

| # | Qué | Por qué en ese orden |
|---|---|---|
| 1 | Extraer `ChipRow` a `components/workspace/` | Está duplicado; una tercera copia lo empeora |
| 2 | **Una** tool: Fashion Reel | Es la que disparó el reporte y tiene pipeline real: si funciona acá, funciona en cualquiera |
| 3 | Ecommerce Pack | La más usada en producción |
| 4 | El resto — sólo si 2 y 3 funcionan | 15.029 líneas: el riesgo es real |

⚠️ **No migrar las 17 de una.** Ya está decidido en `decisions-log.md` 2026-09.

---

## 8. Cuándo algo merece ser una TOOL

La pregunta de fondo: si Campaña ya genera imágenes con los assets de la marca,
¿para qué existe una tool aparte?

**Criterio propuesto:** una tool se justifica si tiene un **pipeline con pasos que
el operador aprueba**. Si es "llenar campos y generar", eso es una Campaña con otra
receta — no una tool.

| Tool | Pipeline | ¿Se justifica? |
|---|---|---|
| `fashion_reel` | script → base → multishot → animate → render | ✅ Pasos reales con aprobación entre medio |
| `ugc_creator` | 7 pasos con voz y lip-sync | ✅ |
| `ecommerce_pack` | multi-toma con curación por prenda | ✅ |
| `fashion_editorial` | `["generate_all"]` — **un solo paso** | ❌ Es un formulario con presets |

⚠️ **El pipeline NO se toca al migrar.** Fashion Reel genera la imagen base, después
los shots, después anima: ese orden es el producto. Lo que cambia es *dónde vive
cada control en la pantalla*, no qué hace ni en qué orden.

## 9. Preguntas abiertas

1. **¿Cuántas de las 17 tools pasan el criterio de §8?** Varias se solapan.
   Conviene saberlo antes de migrar.
2. **¿El canvas muestra los pasos o sólo el resultado final?** En el wizard actual
   cada paso tiene su propia vista. En el template hay un solo canvas — los pasos
   podrían ser secciones apiladas, pero hay que probarlo.
