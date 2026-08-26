# Coevo Studio — Decisions Log

Bitácora cronológica de **decisiones de diseño / producto** que no son obvias en el código.
El "qué" está en el repo. Este archivo guarda el "por qué" y el "qué considerás antes de cambiarlo".

Cada entrada tiene fecha, contexto, decisión tomada, alternativas descartadas y "qué pasó después".

---

## 2026-06 — Voice Lab (oculto del nav)

**Contexto.** Se construyó un prototipo de conversación por voz: browser STT → Gemini → ElevenLabs → autoplay. Funcional, pero no validado con usuarios reales. El piloto reveló que la latencia (1-2s por turno) y la dependencia del navegador (no anda en Firefox) lo vuelven más curiosidad que herramienta de trabajo.

**Decisión.** Mantener todo el código vivo pero **ocultar el pill del TopNav**. Acceso solo por URL directa `/dashboard/voice-lab`. Patrón análogo al que ya se aplicó a Performance / Integraciones / Automatizaciones.

**Lo que se conserva** (para no perder trabajo):
- `frontend/src/pages/VoiceLab.tsx`
- Ruta + `FULL_BLEED_ROUTES` en AppLayout
- Backend: `POST /api/voice/turn`, `chat_voice()` helper, static mount `/static/voice-lab/`
- Auto-cleanup server-side: mantiene los últimos 40 clips, el resto se borra

**Por qué oculto y no eliminado.** Si en algún momento aparece un caso de uso real (ej. brainstorming en voz alta durante un live con cliente), está a un commit de volver. Costo cero de mantenerlo dormido.

**Cuándo reactivar.** Cuando exista un caso concreto y validado. No antes.

---

## 2026-06 — Avatar Creator → Avatar Sheet (rename)

**Contexto.** El nombre "Avatar Creator" sugería que el tool crea personajes nuevos. En realidad lo que produce es una **sheet multi-vista** (cara + 3/4 + perfil + cuerpo) — sea desde brief o desde un avatar guardado. El nombre confundía.

**Decisión.** Renombre solo del display name a "Avatar Sheet". El `id` del tool sigue siendo `avatar_creator` para no romper datos persistidos (generaciones que tienen `toolId: "avatar_creator"`).

**Implicancia.** El registry backend tiene el nombre nuevo. Toda generación nueva se persiste con el id viejo. Compatibilidad hacia atrás intacta.

---

## 2026-06 — Product Sheet (tool nueva)

**Contexto.** El usuario pidió poder pasar 1-4 fotos de un producto y obtener una sheet multi-vista (front / 3-4 / back / side / top / hero / scale) similar a la del avatar, o close-ups de detalles (textura / logo / etiqueta / hardware).

**Decisión.** Tool nueva (`product_sheet`), no agregar tercer modo al Avatar Sheet.

**Por qué tool nueva en vez de modo del Avatar:**
1. **Lenguaje del prompt es ortogonal.** Persona pide *features / pose / identity*. Producto pide *front/back/top/3-4/side/detail/scale*. Mezclarlos en un mismo handler genera ramas `if mode === "product"` que se rompen cada update.
2. **Avatar ya tiene 2 modos** (`create` / `poses`). Un tercero lo convierte en selector de tools dentro de un tool.
3. **Discovery.** Cuando buscás "product sheet" no vas a ir a Avatar Sheet. Y al revés.
4. **Inputs distintos.** Avatar acepta 1 avatar guardado. Product Sheet acepta producto guardado (con sus 1-3 fotos) **o** 1-4 fotos sueltas, mezclables.

**Resistencia a la tentación.** No "que avatar acepte productos también". Si en el futuro aparece otro dominio (vehículo, espacio, packaging plano), tool paralela nueva.

**Pendiente.** El modo "replace primary photo" del producto quedó fuera de la UI por seguridad — sobrescribir productos existentes sin undo claro es peligroso. Si se necesita, agregar `PATCH /api/brands/:id/products/:pid/primary-image` con confirmación explícita.

---

## 2026-06 — Look & Feel: "Receta" como default + modo "Imagen ref" desaconsejado

**Contexto.** El feature de Look & Feel transfiere paleta / mood de una referencia a una imagen base. Se construyeron dos modos:
- **Imagen ref**: pasa la imagen del L&F como referencia a Nano Banana + prompt restrictivo.
- **Receta**: Gemini Vision analiza la imagen una vez y produce un texto de color-grade. La imagen del L&F NO se manda al generador.

**El problema.** Nano Banana 2 con dos refs **suele devolver la imagen del L&F** en vez de aplicar el grade — sin importar cuán restrictivo sea el prompt. Es un límite del modelo, no del prompt.

**Decisión.**
1. **Receta es el default.** Click en L&F → analiza + aplica directo, sin modal intermedio.
2. **Imagen ref queda como segunda opción** con un cartel amarillo explícito: *"Nano Banana puede devolverte la imagen del look&feel en vez de aplicarla. Si pasa, cambiá a Receta."*
3. **Se eliminó el modal de "elegir receta vs prompt manual"** — agregaba fricción sin valor.

**Por qué no eliminar Imagen ref del todo.** Hay un caso donde gana: cuando el color es muy específico (un teal exacto, un undertone particular) y Gemini no logra describirlo bien con palabras. Vale como escape hatch para usuarios expertos.

---

## 2026-06 — Manual Lab: tags `[imgN]` en vez de `[imageN]`

**Contexto.** Inicialmente el Lab usaba `[image1]`, `[image2]` para referenciar imágenes en el prompt. El usuario lo encontraba largo de escribir.

**Decisión.** Cambio a `[img1]`, `[img2]`, `[imgN]`. 25 reemplazos en frontend + backend. Más corto, sigue siendo claro.

---

## 2026-06 — Multi-logo por marca (isotipo / logotipo / variantes)

**Contexto.** El modelo de datos viejo asumía un solo logo por marca (`brand.logo`). Las marcas reales tienen isotipo + logotipo horizontal + versiones dark/light.

**Decisión.** Agregar `brand.logos[]` con `{id, name, filename, imageUrl}` (cada logo con su nombre). Mantener `brand.logo` (singular) leyéndose como legacy read-only en UI.

**Por qué no migrar el legacy automático.** Hubiera requerido elegir nombre arbitrario ("Logo principal" o el filename) y descartar el campo. Mejor mostrarlo como "Logo" sin renombre y dejar que el usuario decida si lo borra cuando suba uno nuevo con nombre proper.

---

## 2026-06 — `localhost` → `127.0.0.1` (frontend)

**Contexto.** Tras una sesión de debugging, descubrimos que el usuario tenía Docker escuchando en `*:8000` (IPv6 dual-stack) y uvicorn en `127.0.0.1:8000` (IPv4). El browser resuelve `localhost` priorizando IPv6 (`::1`) → cae en Docker → 404. El backend de Coevo nunca recibe la request.

**Decisión.** Replace global `http://localhost:8000` → `http://127.0.0.1:8000` en 47 ocurrencias del frontend. Fuerza IPv4 explícito, esquiva el conflicto.

**Deuda técnica.** 47 hardcodes es una bomba de tiempo. Cuando haya espacio: centralizar en `import.meta.env.VITE_API_BASE` y leerla con `import.meta.env`. Permite cambiar la URL sin tocar código, y desploys distintos (dev/staging/prod) sin branches.

---

## 2026-06 — Manual Lab: `ensureHostedRefUrl` antes de Kling/Seedance

**Contexto.** Fal/Kling rechaza `data:image/...;base64,...` largos con error `URL too long`. Cuando el Lab pasa una generación reciente (data URL embebido) como ref para animar, el job falla.

**Decisión.** Helper `ensureHostedRefUrl(url, filename)`:
- Si la URL ya es `http(s)://...` → pasa intacta (caso común: gens previas servidas por backend).
- Si es `data:...` → se sube a Fal Storage con `POST /api/upload-to-fal` y devuelve la URL pública corta.

Se aplica antes de invocar Kling i2v / Kling f2f / Seedance rtv.

**Pendiente.** Audio refs de Seedance siguen siendo `data:` URLs. Si aparece el mismo error con audio, replicar el patrón con mime de audio.

---

## 2026-06 — Ecommerce Batch (prototipo visual antes de generar)

**Contexto.** Caso de uso: cliente manda carpeta con 50 outfits, quiero generar todas las fotos de catálogo de una sin subir prendas una por una.

**Decisión arquitectónica.** Página standalone (`/dashboard/ecommerce-batch`), **NO** dentro del flujo `brief → generate → save` del ToolRunPage. Razón: el batch no encaja en steps secuenciales, es un dashboard.

**Mecanismo de integración con el grid de Generate.** Campo opcional `route?: string` en el registry entry. Si está, el card navega ahí; si no, default al ToolRunPage. Patrón generalizable para futuras tools no-stepped.

**Decisión de UX.** El prototipo **no genera todavía**. Solo muestra el desglose (cuántas imágenes saldrían, costo estimado, ETA). Por qué: el flow de batch tiene 4 decisiones de diseño (canónicas vs hero, tipos de prenda, estrategia de pose, persistencia) que necesitan validación con el usuario tocando la UI antes de invertir en backend de orquestación.

**Decisiones de UX pendientes** (a confirmar con el usuario antes de cablear el backend):
1. **Esquema canónicas + hero**, o pool único con randomización imperfecta. Recomendado: canónicas + hero (separa "vista estándar de catálogo" de "hero shot").
2. **Tipos de prenda**: vos los marcás manual, o Gemini Vision clasifica auto. Recomendado: Gemini Vision + override manual.
3. **Preset Coevo de poses canónicas**. Recomendado: sí (deja arrancar día 1 sin que el cliente mande poses).
4. **Pose como texto vs como imagen-ref**. Recomendado: texto (Gemini Vision analiza cada pose una vez, cachea; sin leak de fondo / luz de la foto de pose).

**Backend no se construye hasta que el usuario valide la UX.** El botón "Generar" hoy es un `alert()` con el breakdown.

---

## 2026-06 — Lab UX: hacer 3 mejoras quirúrgicas antes de rediseñar

**Contexto.** El usuario mostró Freepik/Morph como inspiración y propuso rediseñar el Lab a sidebar izquierda (controles) + galería derecha (scroll vertical). Razón: el layout actual es denso y perdés contexto.

**Mi recomendación honesta.** **No copiar Freepik directamente.** Tres razones:

1. **Freepik/Morph resuelven un problema más chico**: "1 modelo + 1 prompt + muchas generaciones". El Lab tiene más cosas (imagen+video con submodos, 7 tipos de assets, look&feel, audio refs, modos tal-cual/curar). Apilar todo eso en un sidebar de 400px = scroll interno = peor que la disposición actual.
2. **El Lab tiene narrativa conversacional** (encadenás "Use as ref", iterás sobre la generación anterior). Esa es una feature, no un bug. Freepik no la tiene.
3. **El usuario es operador profesional**, no casual. La densidad visual de Freepik está bien para alguien que entra, genera 2 imágenes y se va. Para iteración intensiva, la conversación pesa más.

**Decisión.** Plan progresivo de 3 niveles:

**Nivel 1 — Ganancias rápidas (sin cambio de layout):**
- Refs más grandes (60 → 90-100px) — perdés noción de qué tenés cargado hoy.
- Prompt textarea grande y resizable (6 rows default + `resize-y`).
- Asset picker que se abre **inline** cuando activás "Usar assets de marca", no en panel separado.

Estimado: ~2 horas. Cero riesgo.

**Nivel 2 — Reorganización (si Nivel 1 no alcanza):**
- Galería como drawer derecho colapsable (no fijo).
- Zona principal horizontal con refs + prompt + controles + chat.
- Mantiene la narrativa conversacional.

Estimado: ~3-4 horas. Riesgo medio (refactor de JSX grande).

**Nivel 3 — Rediseño completo Freepik-style (solo si Nivel 2 tampoco alcanza):**
- Sidebar izquierda fija con controles.
- Galería vertical infinita.
- Pierde la narrativa conversacional.

Estimado: ~1-2 días. Riesgo alto (cambio de paradigma).

**Por qué progresivo y no big-bang.** Lab tiene 2000+ líneas, vos generás todos los días en él. Romperlo en un refactor masivo te bloquea trabajo. Mejor cambios incrementales que ves de inmediato y revertís si no te gustan.

**Aprobado por el usuario el 2026-06-03.** Arrancar por Nivel 1.

---

## Pendientes a discutir

### Kayla (colaboradora) no recibe updates

**Síntoma reportado por el usuario:** Kayla descarga el repo y le faltan detalles — específicamente, cosas relacionadas con prompts y sugerencias.

**Hipótesis principal.** Nuestros commits viven en `feat/voice-lab-product-sheet`, no en `main`. Si ella hace `git pull` sobre main, no recibe nada nuevo desde el merge del último PR. Necesita o:
- Hacer `git checkout feat/voice-lab-product-sheet && git pull`
- O mergear la rama a main (después del review).

**Hipótesis secundarias a verificar.**
- `.claude/settings.local.json` (gitignored intencionalmente) puede contener config de skills / prompts que no se replica.
- `backend/.env` (gitignored) no se replica (esperado — debe poner sus propias keys).
- Algún archivo que olvidé stagear en commits anteriores.

**Pendiente.** Revisar con el usuario:
1. ¿En qué branch está Kayla?
2. ¿Qué "detalles" específicos le faltan? (citar ejemplo concreto)
3. Decidir si mergeamos la rama a main o si Kayla cambia de rama.

---

## 2026-06 — Lab v2 reemplaza a Lab v1 (kill switch)

**Contexto.** Después de iterar v2 durante varios días (sidebar split + galería derecha + SessionDrawer + Consistencia + dictation + drawer derecho overlay), v2 ya cubre el 80% de v1 con UX mejor. v1 quedó como ruido en el TopNav.

**Decisión.** `/dashboard/lab` ahora renderiza `ManualLabV2`. `/dashboard/lab-v2` queda como alias. El pill "v2" del TopNav se eliminó. El link "Volver a v1" del header del Lab se eliminó. El archivo `ManualLab.tsx` **queda en disco** pero no se importa — restore es 3 minutos si hace falta.

**Lo que v2 perdió respecto a v1** (pendiente de portar bajo demanda):
- Copiloto deslizable
- Audio refs para Seedance rtv (lipsync con voz)
- Anchor mode con sticky chip "Editando esta imagen"
- Pipeline suggestion banner
- Batch mode "a cada imagen"

**Lo que v2 ganó respecto a v1**:
- Sidebar control + galería derecha (split layout estilo Freepik)
- Bloques de generación con variantes lado a lado
- Variantes con sus propias acciones en hover (sin ambigüedad)
- Lightbox con navegación entre variantes (teclado ← / → + flechas en pantalla + descarga)
- Dictation (Web Speech API → es-AR → appendea al prompt)
- Refs con replace-in-place (mantiene el `[imgN]`, no perdés menciones del prompt)
- Look & Feel con 3 caminos (saved / upload / receta a mano)
- **Consistencia** — anchor de identidad o producto (ver entrada propia)
- Drawer derecho overlay con thumbs de la sesión
- @-mention popover en el prompt
- Animar con prompt default + recomendador Gemini Vision

---

## 2026-06 — Consistencia (anchor por tipo: avatar o producto)

**Contexto.** El usuario pidió un equivalente de Look & Feel pero para identidad: "tengo una foto de un modelo pero le quiero pasar una foto buena de la cara para que ajuste consistencia". Mi primera versión declaró "esta imagen es la ground truth de identidad" sin diferenciar el TIPO de cosa anclada.

**Decisión.** Distinguir el tipo (`avatar` vs `product`) y construir prompts distintos. Modelo mental:

> Output = `[img1]` tal cual, **excepto** el aspecto declarado (cara o producto) que se reemplaza para matchear la ref de consistencia.

Tres caminos en el panel:
1. Avatares guardados → tipo `avatar` (reemplaza cara/identidad)
2. Productos guardados → tipo `product` (reemplaza producto)
3. Subir ad-hoc → DOS botones (Cara / Producto) para que el usuario declare el tipo

Solo una ref de consistencia activa a la vez (la nueva reemplaza la anterior). Marcada con badge "ID" burgundy + border doble en la card.

**Limitación honesta.** Nano Banana 2 no tiene face/subject conditioning real. Es prompt engineering agresivo. Para identity preservation 100% hay que migrar a Flux Kontext, Higgsfield, etc. (cambio de provider, no de prompt).

---

## 2026-06 — Multi-foto por prenda (ClothingItem)

**Contexto.** `ClothingItem` solo tenía `imageUrl`. Para Ecommerce Pack significaba que el modelo veía la prenda solo desde un ángulo → cuando renderizaba la espalda o un detalle, se la inventaba. `Product` ya tenía `images[]` (multi-foto).

**Decisión.** Extender `ClothingItem` con `images?: Array<{filename, imageUrl, label?}>` (front + 2 extras). Endpoint nuevo `POST /api/brands/:id/clothing/:cid/images`. UI en Brand Settings replica el patrón de Products.

**Ecommerce Pack lo consume con priorización smart por tipo de shot**: front siempre va; back/detail van solo cuando el shot lo pide. Cap de 8 refs respeta el límite de Fal.

---

## 2026-06 — Fashion Reel Looks mode con shots seleccionables (multi-shot por outfit)

**Contexto.** Looks mode generaba **una escena por outfit** con un cycle rotativo de framings (close-up / medium / full-body / medium-close). Para video catálogo profesional ("modelo con fondo estudio, plano general + plano detalle por cada outfit") faltaba poder elegir QUÉ planos generar por look.

**Decisión.** `VIDEO_SHOT_CATALOG` con 4 shots (`general`, `medium`, `detail`, `back`). Cada outfit × cada shot tildado = una escena. Defaults: `general + detail`. Cada shot tiene su propio `motion` que `handleAnimate` inyecta (ej. `detail` = dolly-in lento, no sway de modelo).

**Pipeline reusado**: `handleBaseImage` / `handleMultishot` ahora hacen lookup del outfit por `scene.garmentId` (no más `slice(i, i+1)` que asumía 1 escena = 1 outfit). El render concatena en el orden del array.

**No incluido** (deliberado): shots de lifestyle (caminando, sentado, etc.). El usuario los pidió fuera por ahora — se introducen junto con pose-ref por shot cuando llegue ese sprint.

---

## 2026-06 — Surfaces dark con más contraste + paleta brand burgundy + light mode menos blanco

**Contexto.** El cambio anterior a "off-white minimal" había aplastado toda jerarquía. Las cards se confundían con el bg. El usuario reportó "todo muy liso". En light mode, el blanco puro cansaba la vista.

**Decisión.** Tres cambios en `index.css`:
1. **Surfaces dark mode**: más separación entre niveles (`canvas #060608 → surface-3 #3c3c45`). Cards "flotan" sobre bg.
2. **Brand burgundy** (`#C45830`): acento secundario para hover de pills, border de variante activa, badges, focus rings. **No** se usa como fill en CTA primario (Generar sigue blanco).
3. **Light mode**: canvas y surfaces en grises finos (`#e5e5e8 → #d4d4d7`). Las cards distinguen por contraste, no por blancura.

**Burgundy se eligió** porque está en los docs de marca de Coevo. La alternativa era naranja vivo `#E07B3C` — descartada por menos editorial.

---

## 2026-06 — Anti-OOM: limpieza de 649 MB de data URLs + saneamiento al persistir

**Contexto.** Lab v2 reventaba con "Aw, Snap! Error 5" al cargar. Diagnóstico: `backend/data/generations.json` tenía **649.8 MB** de data URLs base64 acumuladas en `metadata.refs[].url`. Cada vez que el browser hacía fetch del histórico, OOM instantáneo.

**Decisión y ejecución.**
1. **Script de limpieza** ejecutado: 171 data URLs reemplazadas por strings vacíos. Archivo pasó de ~650 MB → 4.3 MB. Backup en `generations.json.before_oom_cleanup`.
2. **`sanitizeRefsForPersist` en client**: al guardar nueva generación, descarta `data:` URLs antes de mandar al backend. Solo persiste URLs `http(s)://`.
3. **Load del Lab v2**: descarta `refs` (no las trae a memoria) + cap a 20 generaciones + filtro por `toolId === "manual_lab"` (antes traía generaciones de TODAS las tools, contaminando + cargando todo).

**Lo que se perdió**: si tocás "Regenerar" en una generación antigua del histórico, las refs vienen vacías y tenés que volver a subirlas. Tradeoff razonable — la galería no se rompe con la deuda histórica.

---

## 2026-06 — ToolRunPage gigante (DEUDA UX abierta)

**Contexto.** Las páginas de tools (`/dashboard/generate/<tool>`) acumularon mucho durante 2025-2026: brief box, Coevo Agent, mode toggle, visual style, references, allow faces, tabs de assets, ajustes técnicos en desplegable, motor de video, duración, direction, setting, style ref. Para configurar Fashion Reel hay que scrollear 3 veces. Cada sección es su propia card. Ajustes técnicos están detrás de un desplegable que casi nadie abre.

**Diagnóstico**: arquitectura visual heredada de v1 del Lab (cards apiladas verticales). El Lab v2 demostró que el patrón **sidebar control 420px + área principal** funciona mejor para flujos densos.

**Decisión.** Replicar el layout split de Lab v2 en `ToolRunPage`. Sidebar izquierdo con TODA la config compacta; área principal con steps del pipeline + resultado.

**Pendiente** — el diseño concreto se discute en un sprint dedicado. Las dimensiones son grandes (ToolRunPage tiene 6000+ líneas, lógica de 10+ tools). Approach progresivo: arrancar por Fashion Reel y Ecommerce Pack (las más usadas) y migrar las otras tools una por una.

**No aplicar a todas las tools indiscriminadamente** — Content Analyzer, Avatar Sheet, Product Sheet tienen flujos lineales que el layout actual cubre bien. El split solo gana en tools con muchos parámetros (Fashion Reel, Ecommerce Pack, Video Ad Creator).

---

## 2026-07 — Dirección estética "fina" (serif + glass + image-first, dark-first)

**Contexto.** La app se sentía más "herramienta de dev" que producto premium (ref: Pletor).
Faltaba refinamiento visual en las superficies de marca.

**Decisiones.**
1. **Serif de display Fraunces** (`--font-display`, utility `font-display`) para titulares
   (Home, Dashboard Home, Campañas). Inter se queda en UI/body. El serif es el 80% de la
   sensación "editorial". Descartado Instrument Serif (menos carácter).
2. **Cards image-first**: la imagen llena la card, gradiente oscuro abajo, label encima
   (el patrón de las category cards de Pletor). Aplicado en Home, Dashboard Home, Campañas,
   y el `ToolCard` del Generate (ya lo era).
3. **Glassmorphism selectivo** con los tokens `--glass-*` existentes (bg/border/sheen).
   Solo en superficies de marca con un fondo detrás para frostear. **NO** en las tools de
   trabajo densas (glass sobre config = ilegible + choca con "todo visible").
4. **Profundidad dark = glow, no sombra.** Halos del burgundy detrás de heros/saludos.

**Enviado.** Landing showcase, Dashboard Home (saludo glass + carousel image-first +
campañas), sidebar colapsable, onboarding tour (`<Coachmarks>` reusable), "¿Cómo
funciona?" por tool (`<ToolHelpButton>` data-driven).

**Qué pasó después.** La galería de use-cases en Generate (carousels agrupados) se
**revirtió**: el `ToolCard` (pensado para grid) colapsa dentro de un carousel flex → filas
vacías. Aprendizaje: **para un carousel, card propia con altura fija**, no reusar el de grid.

**Límite.** El "fino" va en brand surfaces (Home/Dashboard/Campañas/Portal). Las tools de
trabajo se quedan **densas y funcionales** (ver 2026-06 "todo visible / no colapsables").

---

## 2026-07 — Campañas + arquitectura de nodos + framing Studio/App

**Contexto.** El usuario quiere dar acceso a marcas para trabajar por campañas, y notó que
cada tool "es como un canvas" (pipeline de steps) — ref al node-canvas de Pletor.

**Decisiones.**
1. **Campañas** = contenedor por marca (setup con assets del brand kit → generar piezas
   in-place → revisar → [futuro: aprobar → video+voz]). Entidad + CRUD + UI. Adapta
   patrones de "Invent" (proyecto cliente confidencial, NO copiar su código). Spec:
   `docs/campaigns.md`.
2. **Arquitectura de nodos** como cura de la deuda del monolito (`ToolRunPage` +
   `tool.id === "..."`). Investigación del landscape (n8n/ComfyUI/Langflow/Dify) →
   **primitivas de step tipadas + renderer genérico**, **stacked-steps primero** (canvas
   React Flow después como renderer aditivo), **ejecución backend**, migración
   **tool-por-tool detrás de un adapter**. Plan completo: `docs/architecture-nodes.md`.
3. **Framing Studio vs App**: dos renderers sobre UN grafo. **App** (cliente corre un form
   simple → output) = App-first, es lo que ya somos. **Studio** (agencia compone) = Fase
   posterior. NO invertir el orden (canvas-first = anti-pattern del research).

**Modelo de negocio (avalado):** vender OUTPUT (servicio productizado, vertical
moda/ecommerce), NO SaaS horizontal. El moat es workflow + criterio + brand context, no la
IA (todo corre sobre modelos commodity).

---

## 2026-07 — Build de producción: `vite build` (type-check separado)

**Contexto.** `npm run build` (`tsc -b && vite build`) fallaba por **204 errores de tipo
pre-existentes** (mayormente `noUnusedLocals` + accesos dinámicos a `config`), acumulados
hace tiempo. El dev anda perfecto (esbuild ignora tipos); solo el gate de `tsc` trababa el
deploy.

**Decisión.** `build` → `vite build` (siempre produce `dist/` deployable). `typecheck` →
`tsc -b` (script nuevo, opcional/CI). La deuda de 204 errores queda como limpieza dedicada
(empezar por los ~66 `TS2339` reales, que sí pueden esconder bugs — los "unused" son ruido).

**No es código roto**: la app corre. Es deuda de estrictez.

---

## 2026-08 — Coevo World: Studio pasa a ser un lugar adentro, no la app entera

**Contexto.** Estudiando Superspace (Superside) quedó claro que lo que le falta a Coevo no
es capa de generación — esa es más profunda que la de ellos — sino **capa de operación**:
qué se pidió, en qué estado está, qué costó, qué devolvió el cliente. Ver
`competitive-research.md` § Superside, sección 11 (UI verificada por screenshots).

**Decisión.** Se envuelve la app en un shell llamado **Coevo World** (nombre provisorio;
se descartó "Coevo Space"). La fábrica de tools sigue igual y pasa a ser **un item del
sidebar** — se entra a ella desde un pedido y se vuelve con una pieza que tiene costo y
estado. Alrededor: Trabajo, Brand Brain, Clientes.

**Regla de arquitectura (importante).** La capa de operación vive en rutas y módulos
propios que CONSUMEN las tools. Ni una línea adentro de `ToolRunPage.tsx` — con 14.910
líneas, meterle esto es matarlo.

**Alternativa descartada.** Construir un producto aparte ("Coevo Brains"). Tendría que
leer marcas, assets, generaciones y costos, que viven todos acá → problema de sincronización
permanente. Lo que hace valioso a Superspace es justamente estar soldado a donde el trabajo
pasa.

**Qué se construyó primero.** El costing layer real (`lib/costLedger.ts`) y la pantalla
`/dashboard/trabajo`. El razonamiento del orden: la calidad se puede mejorar cuando sea,
pero **cada pieza generada sin registrar su costo es un dato irrecuperable**.

**Dato que apareció en el camino.** El `pricing.ts` que existía estimaba Nano Banana a
$0.039/imagen. El real es $0.08 base y **$0.12 en 2K** — el estimador que ya se mostraba en
Campañas venía 3× por debajo.

---

## 2026-08 — Accesos al portal: un link por persona, no cuentas (todavía)

**Contexto.** El portal pasó a ser de dos vías: el cliente además de aprobar, pide. Ahí
apareció la pregunta de login. Hasta ese momento había **un token por marca**, así que
todos los que tuvieran el link eran "el cliente".

**Decisión.** Un token por **persona** (`brand.portalAccess[]` con nombre, email opcional
y fecha de revocación). Mismo link mágico, cero infraestructura de auth, pero:
- el `requestedBy` de un pedido sale del LINK, no de lo que tipee el cliente
- se le puede cortar el acceso a uno sin romperle el link a los demás
- revocar no borra: queda la fecha, así los pedidos viejos siguen diciendo quién los mandó

El token legacy por marca se sigue aceptando para no romper links ya repartidos, y la
pantalla de Clientes lo muestra advirtiendo que los pedidos que entren por ahí van sin
nombre.

**Alternativa descartada (por ahora): cuentas de verdad.** Email+password propio queda
descartado directamente — mantener reset, verificación y sesiones no aporta nada que Clerk
no dé. Clerk entra cuando pase **una** de estas tres: que el cliente suba sus propios
assets, que haya que cobrarle, o que distintas personas necesiten permisos distintos
(uno aprueba, otro solo mira). Sus "organizations" mapean uno a uno con las marcas.

**Por qué no adelantarlo.** Mientras el cliente solo mire, comente y pida, el link con
nombre da el 90% de lo que se quiere del login a un costo de casi cero.

---

## 2026-08 — El cliente no encarga trabajo: deja notas

**Contexto.** El portal se había construido con una caja de "pedí lo que necesites" que
creaba una campaña directamente. El usuario lo frenó: *"esto de pedí no tiene sentido, se
supone que hay una instancia de briefing, reuniones"*. Tenía razón, y era un error de
modelo, no de diseño.

**El problema.** Esa caja implica que el cliente puede encargar trabajo como quien pide un
delivery: sin brief, sin scope, sin presupuesto acordado. Superside puede tenerla porque
atrás hay un contrato de $30k/mes con horas ya compradas — el pedido se descuenta de una
bolsa. Coevo no tiene esa bolsa, así que la caja prometía algo que el modelo comercial no
puede sostener.

**Decisión.**
- La **campaña sigue siendo el resultado del briefing**, del lado de la agencia. Eso ya
  existía (`NewCampaignPage` con brief, productos, shot plan) — solo estaba mal que el
  cliente pudiera saltearse la instancia.
- Lo que el cliente escribe es una **nota** (`brand.portalNotes[]`), no una orden. Llega a
  Trabajo bajo "Dijo el cliente", con la aclaración de que no es trabajo hasta definirlo
  juntos, y se marca como conversada.
- El portal deja de girar alrededor de pedir y pasa a girar alrededor del **plan**: las
  campañas briefeadas con su estado en lenguaje de cliente.

**Cómo entra el trabajo, confirmado con el usuario:** por campaña puntual, briefeada
cuando surge. No hay plan mensual fijo — por eso el portal lista campañas y no un
calendario.

**Cuándo se revisaría.** Si alguna vez hay retainer con horas contratadas, la caja de
pedido directo vuelve a tener sentido: ahí el pedido se descuenta de algo acordado.

---

## Cómo usar este archivo

- **Agregar entrada cuando.** Tomamos una decisión que: (a) descarta otra opción razonable, (b) no es obvia leyendo el código, (c) podría confundir a otro dev futuro o re-discutir en 3 meses.
- **No agregar entrada cuando.** Es un bugfix, refactor mecánico, o algo trivial.
- **Formato.** Fecha YYYY-MM, título, contexto, decisión, alternativas descartadas, "qué pasó después" si aplica.
- **Linkear.** Cuando una entrada nueva revisita una vieja, citar la fecha de la vieja.
