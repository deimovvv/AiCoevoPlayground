# Arquitectura de nodos / steps componibles — investigación y plan

Objetivo: entender qué conviene ANTES de comprometer un refactor. Motivado por el
node-canvas de Pletor (Brief → Creative brief → Persona → Visual → Reframe, cada nodo
con su modelo + Run + output, y "Deploy App"). Nuestras tools ya son pipelines de steps;
la diferencia es que están hardcodeadas.

> Estado: COMPLETO — para revisar en frío antes de comprometer el refactor. Incluye la
> investigación del landscape (n8n / ComfyUI / Langflow / Flowise / Rivet / Dify) y la
> recomendación final. Es un plan, no código.

---

## 1. Diagnóstico — por qué el modelo actual no escala

Hoy una tool es **código bespoke**:
- `frontend/src/tools/{id}/index.ts` → `ToolDefinition` (schema + `stepHandlers` + `approvalSteps` + `autoRunSteps`).
- `frontend/src/pages/ToolRunPage.tsx` → **~13k líneas** con condicionales `tool.id === "..."` sembrados por todos lados (config UI a medida por tool).
- `backend/tools/registry.json` + `default_prompt.txt` por tool.

Síntomas de que no escala:
- Sumar una tool = escribir una tool entera (handlers + UI custom + registry).
- El monolito `ToolRunPage` concentra la UI de TODAS las tools → frágil, difícil de testear.
- **La deuda de tipos** (204 errores en `npm run build`, ver `package.json` split de build) es
  consecuencia directa: accesos dinámicos a `config` + UI acoplada.

## 1b. Framing "Studio vs App" (dos renderers, un grafo)

Pletor tiene dos superficies sobre el MISMO modelo de grafo:
- **App** = una composición **publicada**, expuesta como un **form simple** (corré → output).
  El cliente/operador vive acá. **Nuestras tools ya son "Apps"** (Generate → form → run).
- **Studio** = el **canvas** donde se **compone** una app desde primitivas. La agencia/power
  vive acá. Es Fase 4/5.

No son dos sistemas: es una arquitectura (nodos) con dos vistas. Consecuencia estratégica:
**somos App-first (correcto)**, el Studio es la capa de poder que se construye después. NO
invertir el orden (canvas-first = anti-pattern). Encaja con los dos audiences del negocio:
cliente = Apps (curado, vende output), agencia = Studio (compone). Un "App" publicado =
un grafo con su form auto-generado (Fase 5).

## 2. Target — primitivas de step + renderer genérico

La lección del node-canvas NO es "dibujar cablecitos". Es la **arquitectura**:

1. **Primitivas de step tipadas y reusables** — registro de tipos de nodo con interfaz
   estándar: `{ id, type, inputs (tipados), config, run(ctx) → output, outputType }`.
   Ej: `gemini-text`, `nano-image`, `kling-video`, `reframe`, `voice`, `concat`.
2. **Tool = composición (DATA)** — una lista ordenada de steps + wiring de inputs, no un
   archivo de handlers. Serializable a JSON.
3. **Renderer genérico** — UNA UI que dibuja cualquier tool desde su composición
   (inputs de cada step renderizados desde su schema). Mata los `{tool.id === "..."}`.
4. **Outputs intermedios + re-run por step** — ya existe en parte (checkpoint de Campañas);
   formalizarlo por step.
5. **Modelo por step** — cada nodo elige su modelo (ya empezado con Kling/Seedance,
   `klingDurationOptions`, etc.).
6. **Compose → Deploy** — una composición se vuelve app reusable → conecta con el modelo
   de negocio (vender output/apps) y con Campañas/Invent.

### Lo que YA tenemos (no arrancamos de cero)
- `stepHandlers` por tool = el 60% de "primitivas de step" (ya hay una noción de step con
  `run`, `getStepResult`, `needsApproval`).
- El checkpoint humano (Campañas) = el patrón de "pausar entre nodos".
- Registry de tools + previews.

## 3. Decisiones — RESUELTAS por la investigación
- **Canvas visual vs. stacked-steps** → **stacked-steps PRIMERO**, pero modelando el dato
  como grafo completo (nodos + edges tipados) desde el día 1. Nuestras 15 tools son casi
  todas lineales (script → image → … → render); el canvas drag-and-wire es overhead para
  flujos lineales y para operadores que no son power-users de grafos. El canvas se agrega
  DESPUÉS como **renderer adicional sobre el mismo dato**, no como reescritura. (Dify hace
  exactamente este híbrido por esta razón.)
- **Librería (cuando vayamos a canvas)** → **React Flow (`@xyflow/react`)** + Zustand. Es
  el stack de Langflow (React + FastAPI = igual al nuestro). Descartar litegraph
  (canvas-2D, DX vieja) y rete.js (ecosistema chico).
- **Ejecución** → **backend (FastAPI), siempre.** Los steps llaman Fal/Gemini/ElevenLabs/
  FFmpeg — jobs largos, con keys, cacheables. Calza con nuestro patrón async actual; el
  motor es solo un orquestador sobre los service calls que ya tenemos. El front queda como
  editor + poller (como hoy).

## 4. Fases (incremental — migrar tool-por-tool detrás de un adapter)
- **Fase 0 — Modelo + registry (sin cambio de UI). ✅ HECHO (2026-07).** Vive en
  `backend/nodes/`: `types.py` (PortType tipado + ParamSpec + NodeDescriptor con el split
  descriptor/`execute` de n8n), `registry.py` (`NODE_REGISTRY` + `register`/`get_node`/
  `list_nodes`), `primitives.py` (7 primitivas envolviendo los services que YA existen:
  `prompt_assemble`, `nano_image`, `nano_image_edit`, `kling_video`, `voice_tts`,
  `fal_lipsync`, `video_concat`). Ports tipados (IMAGE/IMAGE[]/VIDEO/AUDIO/TEXT/PROMPT/
  BRAND_CONTEXT/ANY). Descriptor serializable a JSON (data pura, sin `execute`). Cero
  cambio de comportamiento: no está cableado a ninguna tool ni a `main.py` todavía — es
  solo el catálogo. Pendiente inmediato de Fase 1: `GET /api/nodes` (catálogo) + el motor.
- **Fase 1 — Motor + serialización. ✅ HECHO (2026-07).** `backend/nodes/engine.py`:
  `run_graph(graph, ctx, cache)` — deserializa → topo sort (Kahn, detecta refs colgadas y
  ciclos) → corre cada nodo pasando outputs tipados por los edges. Formato JSON del grafo
  (nodes con `inputs` = ref `{node,port}` o valor estático). **Caché por hash de nodo**:
  `_hash_node(type+params+inputs)`; en re-run, los nodos sin cambios devuelven cacheado y
  NO se re-ejecutan (verificado: cambiar un nodo re-corre SOLO ese nodo). Endpoints en
  `main.py` (aditivos): `GET /api/nodes` (catálogo) + `POST /api/graph/run` (runner, con
  `cache_key` para skip-por-hash entre requests + `brand_id` para el `BRAND_CONTEXT`).
- **Fase 2 — Una tool como data + renderer stacked genérico.** Elegir la tool lineal más
  simple (ej. `photo_multishot`), escribirla como grafo JSON, y construir el renderer
  stacked-steps schema-driven (el inspector de cada nodo se genera del schema;
  `ImageEditPanel`/asset-pickers se vuelven **widget types** reusables). Camino nuevo
  funcionando al lado del viejo.
- **Fase 3 — Adapter + port tool-por-tool.** Flag por tool: `graph` (nuevo) o `legacy`
  (viejo). Migrar de a una, borrando sus `tool.id === "..."` a medida que pasan. El
  monolito se achica monótonamente; nada se rompe de golpe.
- **Fase 4 — Canvas + branching (solo cuando haga falta).** React Flow sobre el MISMO
  dato, para tools con paralelo/branch (fan-out de variaciones, render condicional).
  Stacked y canvas conviven como dos vistas de un modelo.
- **Fase 5 — Publish as app.** "Publicar grafo → endpoint API + form UI auto-generado
  desde los input ports expuestos + embed". Es la superficie **client-facing** y sale casi
  gratis una vez que las tools son data → tu modelo de negocio (vender apps/output).

## 5. UX backlog relacionado (del análisis de Pletor)
- **Sidebar colapsable** — ✅ hecho (icon-only ↔ labels, persistido).
- **Display de créditos/uso** — mostrar créditos/costo estimado en el sidebar (como el
  "85" de Pletor). Pendiente. Bajo esfuerzo.
- **Tutorial por tool** — una forma de ver un mini-tutorial/coach-mark de cada tool
  (qué hace, qué inputs, ejemplo). Pendiente. Se puede combinar con el onboarding
  first-run ("5 OF 8").
- **Onboarding first-run** (coach-marks) — pendiente, ya priorizado.

### Ecosistema Pletor a modelar (refs del usuario)
- **Galería de Templates / Use-cases** — modal navegable de tools presentadas como
  templates con before→after + badges Popular/New + filtros (Level/Industry/Sort/Search)
  + carousel de "Use cases" (Product imagery / Static Ads / UGC / Brand assets /
  Automations). **Es el payoff directo de "tool = composición (data)"**: una vez que las
  tools son data, esta galería sale casi gratis. Ya tenemos proto-versión (registry +
  cards image-first en Generate). Alto valor comercial (browsing de capacidades).
- **Centro de aprendizaje / onboarding** — "Become an expert": progreso gamificado
  ("Apprentice 1/3" con pasos: generá tu primer visual → conectá tus primeros nodos →
  completá el tour, con reward "+100"), sección "Tutorials" (video cards con tabs
  Foundations/Intermediate/Advanced + duración), y "Recently on X" (novedades). Unifica
  el **onboarding first-run + el tutorial por tool** que pidió el usuario. Fase propia.
- **Toolbar del canvas** — rail flotante: + Add node / Assets / Templates / Learn / Ask
  AI (con tooltips). Chrome del canvas visual → va con Fase C.

## 6. Landscape — hallazgos (n8n / ComfyUI / Langflow / Flowise / Rivet / Dify)

Todos los serios ejecutan **en backend** con **topological sort**. Los pilares a copiar:

| De… | Patrón a adoptar |
|---|---|
| **n8n** | **Descriptor de nodo (data pura) + `execute()` separado.** El nodo es un JSON serializable (id, ports tipados, schema de params) + una fn de ejecución. Es EL cambio que convierte "sumar tool = escribir tool" en "sumar step = registrar una primitiva". Mata los `tool.id === "..."`. |
| **ComfyUI** | **Ports tipados como constraint duro** (vocabulario chico: `IMAGE`, `IMAGE[]`, `VIDEO`, `AUDIO`, `TEXT`, `PROMPT`, `BRAND_CONTEXT`, `ANY`) → el renderer genérico valida el wiring sin código por-tool. **+ caché de output por hash** (re-run de un solo nodo). |
| **ComfyUI/Langflow** | **Input rendering schema-driven**: cada param declara `{type, default, min/max, options, upload, multiline}` → un form renderer genérico dibuja el control. Así se borra la UI bespoke por-tool. Nuestro `ImageEditPanel`/asset-pickers = widget types reusables. |
| **Langflow** | Stack **React Flow (`@xyflow/react`) + Zustand + FastAPI** — igual al nuestro. |
| **Dify** | **DSL (YAML/JSON) del grafo** = versionado, diff, clonar tool, artefacto shippable. **+ "publish → API endpoint + web app + embed"** = el path directo a vender apps sin software por-cliente. |

Nuestro **PromptBuilder (3 capas)** encaja como un nodo `PromptAssemble` (toma
`BRAND_CONTEXT` + template + vars → emite `PROMPT`). El brand context viaja como `ctx`
inyectado o port tipado.

### Anti-patterns a evitar (del reporte)
- **Canvas-first vanity** — meses de UX drag-and-wire para flujos lineales que nadie cablea a mano. Motor + stacked primero.
- **Ejecución en el front** — nunca orquestar Fal/Gemini desde el browser (keys, timeouts, sin caché).
- **`ANY` en todo** — perdés la validación de conexiones (el valor de ComfyUI son los tipos estrictos).
- **Nodos demasiado granulares** — grain = un step con sentido (una call a Fal, un prompt assembly), no una op por nodo.
- **Set de nodos fijo/no extensible** (limitación de Dify) — el registry ES el punto de extensión: sumar step = registrar descriptor + execute, nunca parchear el motor.
- **Rewrite big-bang del monolito** — migrar tool-por-tool detrás del adapter.

### Fuentes
n8n ([node types](https://deepwiki.com/n8n-io/n8n/4.1-node-type-system-and-registration), [data structure](https://docs.n8n.io/data/data-structure/)), ComfyUI ([node system](https://deepwiki.com/Comfy-Org/ComfyUI/2.4-node-system), [execution engine](https://deepwiki.com/hiddenswitch/ComfyUI/3.1-execution-engine)), Langflow ([execution](https://deepwiki.com/langflow-ai/langflow/4.4-flow-execution-engine), [import/export](https://docs.langflow.org/concepts-flows-import)), Rivet ([executors](https://rivet.ironcladapp.com/docs/user-guide/executors)), Dify ([GraphEngine](https://github.com/langgenius/dify/discussions/26138), [DSL](https://github.com/langgenius/dify/discussions/9007)), UX canvas-vs-stacked ([Krea](https://www.krea.ai/index/top-node-based-ai-workflow-apps)).

---

**Bottom line:** adoptar el **split descriptor/execute de n8n + ports tipados y caché de
ComfyUI + stack React Flow/FastAPI de Langflow + DSL-y-publish de Dify.** Modelar el grafo
como dato YA, renderizar **stacked-steps primero**, ejecutar en **backend**, migrar
**tool-por-tool detrás de un adapter**. El canvas visual es un renderer aditivo, nunca una
reescritura.
