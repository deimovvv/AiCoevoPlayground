# Dashboard — research de arquitectura y propuesta

Documento de trabajo para decidir **la estructura de navegación y el layout** de Coevo Studio.
Reúne lo observado en competidores (verificado en capturas de sus apps reales, no en su marketing),
el diagnóstico de lo que tenemos hoy, y una propuesta con sus preguntas abiertas.

**Estado:** propuesta, NO implementado. Nada de esto está en código todavía.
**Fecha:** 2026-09-20 · **corregido 2026-09-20** tras el doc de infra (`design-infra-boundary.md`)
**Para:** discutir antes de tocar la UI.

> ⚠️ **Corrección importante.** La primera versión de este doc daba por inexistentes
> tres cosas que **ya están construidas y verificadas en código**: el cálculo de costo
> (`pricing.ts` + `costLedger.ts`), el estado de las piezas (`workStatus` + inbox +
> portal), y la decisión de dónde viven las Marcas (cerrada en `decisions-log.md`
> 2026-08). Ver §3 y §5.

---

## 1. El problema que dispara todo esto

Citando al usuario:

> *"Cuando entrás, lo primero que tenemos que ver es Coevo Studio, porque es la herramienta que está dentro. No tengo que entrar dos veces."*

> *"Eso de que Coevo Studio está dentro de Coevo World, eso no queda claro. Tiene que ser más concreto, más ordenado, mucho más claro."*

**Hoy el dashboard tiene dos niveles** (`Sidebar.tsx`, constante `inStudio`):

| Nivel | Qué contiene |
|---|---|
| **Coevo World** | Inicio · Campañas · Marcas |
| **Coevo Studio** | Generar · Contenido · Lab |

El sidebar cambia de contenido según dónde estés parado. Consecuencias:

1. Entrás al dashboard y caés en la capa de **gestión**; las **tools** —donde se trabaja— están un click más adentro.
2. El modelo mental "World contiene Studio" no está explicado en ningún lado de la UI.
3. La única señal de en qué nivel estás es el sufijo del logo (World/Studio).

---

## 2. Cómo lo resuelven los competidores `[V]` verificado en sus apps

### 2.1 Flora — sidebar plano, sin niveles

Capturado de la app real (usuario logueado como "Coevo Agency"):

```
Back to Home          ← ítem propio, siempre visible
New project
Create      [New]
Generate
Home                  ← activo
Projects
Library          >
Tools       [New] >
Techniques
Community
MCP         [New]
... More         >
─────────
Pinned           >
Recents
  Project 2
  Project 1
─────────
C  Coevo Agency...    ← cuenta, abajo de todo
```

- **Un solo nivel.** No hay "entrar dos veces".
- **`Back to Home`** existe como ítem explícito arriba de todo.
- Badges verdes `New` (`#22C55E`) marcan lo nuevo.
- Área principal: banner de novedad → **Recent projects** → **From the community** con buscador.
- Las tarjetas dicen *"Edited today by Coevo Agency"*; hay placeholders con borde punteado para proyectos sin miniatura.

**Distinción útil:** `Create` (empezar algo guiado) vs `Generate` (prompt suelto, sandbox).

### 2.2 Genera.Space — tres columnas, el canvas nunca se va

Capturado de `app.generaspace.ai/campaign-project/LoN6ABC5U3wmOV40Yj1I`:

```
┌────────────┬──────────────────┬─────────────────────┐
│   BRIEF    │   SELECTOR       │      CANVAS         │
│   ~20%     │   ~30%           │      ~50%           │
│            │  (se despliega)  │                     │
│ Model    ──┼─→ grilla 3×6     │   "No heroes yet"   │
│ Garments   │   18 caras       │                     │
│ Looks      │                  │                     │
│ Advanced   │  ó, si tocás     │                     │
│  ├ Pose  ──┼─→ [Presets |     │                     │
│  └ Lighting│    Generated |   │                     │
│            │    Pinterest |   │                     │
│ ⚙ Generate │    Custom]       │                     │
│      ▣ 1   │   20 poses 4×5   │                     │
└────────────┴──────────────────┴─────────────────────┘
```

Header: `[logo] Projects / Private Prawn` ··· `Upgrade` · `↑ Export campaign` · `✦` · `🔔 3` · avatar.

**Lo importante:**

- **Un proyecto = una campaña.** La URL lo dice: `/campaign-project/<id>`. Nombre autogenerado tipo Figma (*"Private Prawn"*).
- **El panel del medio se despliega sobre el canvas** al elegir Model o Pose. **No hay wizard de pasos, no se navega a otra pantalla.**
- **`Generate ▣ 1`** — el costo en créditos está ANTES de apretar.
- **`Looks`** = recetas guardadas *"saved from shots you like"*.
- **`Pinterest`** como fuente de poses, junto a Presets / Generated / Custom.
- El vacío dice **"No heroes yet"**, no "sin resultados": le pusieron nombre a la pieza principal.
- Paleta: fondo `#171717`, paneles `#262626`, acento azul `#1890FF`.

---

## 3. Diagnóstico de lo que tenemos

| Aspecto | Coevo hoy | Flora / Genera |
|---|---|---|
| Niveles de nav | **2** (World → Studio) | **1**, plano |
| Volver al home de la web | ❌ no existía (arreglado 2026-09-20) | `Back to Home` explícito |
| Ejecución de una tool | **Wizard paso a paso** (`ToolRunPage`) | Panel + canvas, sin navegar |
| Contenedor de trabajo | Campañas y tools **separados** | Proyecto = campaña = workspace |
| Costo antes de generar | ⚠️ **calculado, no mostrado** — `pricing.ts` ya existe | `Generate ▣ 1` |
| Estado de las piezas | ✅ **ya existe completo** — `workStatus`, 6 estados + inbox + portal | — |
| Recetas guardadas | Look & Feel (parcial) | `Looks`, first-class |
| Login | ❌ no existe | sí |

**Verificado en código (2026-09-20):**
- `frontend/src/lib/pricing.ts` — `UNIT_USD`, `MARKUP = 1.6`, `usdToCredits()`, `formatCost()`
- `frontend/src/lib/costLedger.ts` — registra el costo real, instrumentado en `lib/api.ts`
- `backend/main.py:237` — `workStatus`: `draft|in_progress|review|sent|changes|approved`
- `backend/main.py:5065` — `_sync_work_status_from_review()` propaga los cambios del cliente
- `backend/main.py:5260` — inbox con contador de lo que exige atención

---

## 4. Propuesta

### 4.1 Sidebar plano — eliminar World/Studio

```
← Ir al sitio            ← vuelve a la landing pública
＋ Nueva campaña         ← acción primaria

Inicio
Campañas
Marcas
─────────
Generar                  ← las tools, visibles de una
Contenido
Lab
─────────
Recientes
  Campaña PROMAN
  Fichas Clara
─────────
C  Coevo Agency          ← cuenta
```

Decisiones tomadas con el usuario:
- **Sin "Pinned"** — no aporta con pocos proyectos.
- **`Lab` se queda con ese nombre** — es el equivalente al `Generate` de Flora (prompt suelto sin marca).
- **No hace falta un "Create" aparte** — lo que falta no es un ítem nuevo, es que las tools se vean sin entrar dos veces.

### 4.2 "Nueva campaña" = el workspace

Unifica dos cosas que hoy están separadas: **Campaña** (contenedor) y **ToolRunPage** (ejecución).

```
Header:  [logo] Campañas / <nombre>        Exportar · 🔔 · avatar

┌────────────┬──────────────────┬─────────────────────┐
│   BRIEF    │   SELECTOR       │      CANVAS         │
│            │  (al demanda)    │                     │
│ Marca      │                  │  grilla de piezas   │
│ Producto   │  se abre al      │  generadas          │
│ Prendas    │  tocar un campo  │                     │
│ Avatar     │  del brief       │  vacío:             │
│ Look&Feel  │                  │  "Todavía no hay    │
│ Tomas      │                  │   piezas"           │
│            │                  │                     │
│ Generar ▣3 │                  │                     │
└────────────┴──────────────────┴─────────────────────┘
```

Lo que se adopta de Genera:
1. **El canvas nunca se va** — el selector se despliega encima, no reemplaza la pantalla.
2. **Costo en el botón** — `Generar ▣ 3` antes de apretar. Ya existe el cálculo (`pricing.ts`); falta llamarlo.
   ⚠️ **No puede presentarse como promesa.** El ledger adjudica por cercanía temporal y hay descarte real (1.6× imágenes / 1.3× video, `financial-model.md`). El número es **lo que cuesta un intento**, no la pieza terminada — hay que decirlo en la UI.
3. **Recetas guardadas** — extender Look & Feel a "Recetas" (prenda + tomas + luz), que es también el *preset por línea de producto* que necesita Pampero.

### 4.3 Login

No existe y es **bloqueante** para que entre el equipo (Keila y quien se sume). Mínimo viable para uso interno: una contraseña compartida. Multi-usuario real viene después.

---

## 5. Preguntas abiertas — para resolver en la discusión

1. **¿Qué pasa con el wizard actual (`ToolRunPage`)?** ⚠️ **`ToolRunPage.tsx` tiene 15.029 líneas** y hay una decisión previa de no tocarlo (`decisions-log` 2026-08).
   Recomendación de infra, que comparto: **migrar UNA tool y medir, no las 17**. El wizard tiene una virtud que el canvas no — obliga a aprobar por paso, que es la regla de trabajo ya establecida (*una toma → mostrar → confirmar → siguiente, nunca batchear*).
   **Matiz mío:** wizard y canvas no son excluyentes. Se puede adoptar el *chrome* (panel fijo + canvas persistente) manteniendo la aprobación por paso adentro. Y la prueba debería ser **una tool nueva FUERA de `ToolRunPage`**, no una migración dentro de ese archivo.
2. **¿Campaña y proyecto son lo mismo?** La propuesta asume que sí (como Genera). Si no, hace falta una tercera entidad.
3. **¿Dónde entran las tools sueltas?** Si todo es una campaña, ¿cómo generás una foto rápida sin crear una? ¿Ese es el rol del Lab?
4. ~~**¿"Marcas" arriba o adentro de la campaña?**~~ ✅ **CERRADA** — `decisions-log.md:465` (2026-08): *"Todo lo que es de una marca vive adentro de la marca; el nav de afuera es la operación"*. Marcas va arriba. Genera lo hace distinto porque no tiene clientes recurrentes.
5. **¿Vistas nuevas que faltan?** Detectadas hasta ahora: **Login**, y posiblemente una vista de **Cliente/Portal** para Pampero.
6. **¿El dashboard adopta el lenguaje visual de la landing nueva?** (negro frío `#0b0b0c`, rosa `#ff5f8f` como señal, tipografía chica). Hoy el dashboard usa burgundy `#c45830` sobre `#070606`.

---

## 5b. Orden de trabajo — revisado con lo que ya existe

Al verificar que el costo y los estados ya están construidos, el orden cambia:
lo barato y desbloqueante primero.

| # | Qué | Esfuerzo | Por qué primero |
|---|---|---|---|
| 1 | **Costo en el botón** | Horas | El cálculo ya existe; es llamarlo. Valor inmediato |
| 2 | **Login** | Días | Es lo único que bloquea a que entre el equipo |
| 3 | **Sidebar plano** | Días | Quita el "entrar dos veces" |
| 4 | **Recetas** | Días | Extiende `lookAndFeel`; requisito de producción para cuentas mensuales |
| 5 | **Layout 3 columnas** | 1-2 semanas | Una tool NUEVA fuera de `ToolRunPage`, para medir antes de comprometerse |
| 6 | **Migrar las 2-3 tools más usadas** | 1-2 semanas | Solo si el paso 5 funciona |

⚠️ **Las 17 tools NO se migran.** `ToolRunPage.tsx` (15.029 líneas) se queda con el wizard
para el resto. No hay razón para que todas se vean igual — y el wizard tiene una virtud
propia: obliga a aprobar paso por paso, que es la regla de trabajo del proyecto
(*una toma → mostrar → confirmar → siguiente*).

---

## 6. Qué ya se hizo (no discutir de nuevo)

- ✅ El logo del sidebar vuelve a `/` (la landing). Antes iba a `/dashboard/brands` y no había salida del dashboard.
- ✅ El sufijo World/Studio sigue siendo dinámico, marcado en el código como pendiente de esta decisión.
- ✅ Landing pública rehecha con lenguaje screen-UI (ref. Flora). Ver `frontend/src/pages/Home.tsx`.
- ✅ Vite fijado al puerto **5180** con `strictPort` (el 5173 lo tomaba `MONKS/Google-App`).
- ✅ **Higiene del catálogo de tools** (2026-09-20), verificada antes de borrar:
  - `frontend/src/tools/fashion_reels/` (plural) — borrado. Un `index.ts` que no importaba nadie.
  - `backend/tools/fashion_reels/` — borrado. No estaba en `registry.json`.
  - `reel_creator` — sacado de `registry.json` (estaba `coming_soon` y sin frontend). El `default_prompt.txt` queda en disco por si se implementa.
  - Registry: 20 → 19 tools.
  - `fashion_reel` y `product_clip` y `ugc_creator` **se quedan**: están bien diferenciadas (con personas / sin personas).

---

## 7. Método y confianza

- Las capturas de Flora y Genera son de **sus apps reales, logueadas** — no de su marketing.
- Analizadas con la skill `ver-imagenes` (Gemini 3.1 Pro), que transcribe etiquetas literales.
- ⚠️ Las proporciones en píxeles son **estimadas por el modelo de visión**, no medidas.
- ⚠️ Los hex de color son aproximaciones visuales.
- El research de negocio de Genera (pricing, funding, moat técnico) está en `docs/competitive-research.md`.
