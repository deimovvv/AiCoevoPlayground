# Estado

> Lo que está pasando ahora en este proyecto (no cómo se trabaja: eso es CLAUDE.md).
> Cada sesión lo lee al empezar y lo actualiza al cerrar. Lo completa la próxima sesión de acá.

Temas: plataforma, portal de clientes, créditos, producción de contenido, agentes, marcas
Ideas leídas: la-observacion-es-dato, linea-base-antes-de-intervenir, criterio-y-regla

## Ahora (2026-10-31)
- **Circuito de una pieza** en producción: estrategia → ángulo → Plan (calendario) → Entregas (voz, comentarios que se
  clasifican solos) → Aprendizaje (reglas). Cada marca es **proyectos** (Koxis) o **plan mensual** (Mi Saluteca).
- **Vista de cliente curada:** calendario de sólo lectura (plan), «Mandar algo» con el circuito a la vista, selector de
  marca por tipo de trabajo, claro/oscuro. Guía para Gonzalo: `docs/guias/probar-el-circuito.md` (bloques 0 y 0b).
- **Inicio del equipo** en `/dashboard` (Te toca + marcas con fotos por tipo de trabajo). Sigue: arranque guiado de
  una marca nueva (M.14) y Marcas con los mismos grupos. Postiz en pausa (Gonzalo no lo paga hasta saber dónde aplicarlo).
- Pendiente grande: Postiz (`changes/brand-integrations` §5) y que las skills usen ángulo y reglas (5.4, aviso en coevo-skills).

## Antes (2026-10-25)
- **Marca** ya tiene: visor de imágenes en grande en todos lados, «Archivos» (links de trabajo de cada
  marca con «lo ve el cliente»; el MCP los da) y design system por marca en Claude Design
  (Morph y ALGÜNA hechos; Studio guarda sólo el link).
- **Entregas** se usa en serio con Koxis (Keila): versiones, comentarios por persona, zoom, video ProRes.
- Pendientes de producto en `openspec/changes/studio-v2/tasks.md` (M.11 PDF v2, M.12 instructivos, O.6 Postiz…).

## Próximo, en orden
1. Cerrar `coevo-skills/SISTEMA.md` (la pregunta abierta: hogar de la voz y del design system de cada marca).
2. Ordenar Descargas con la skill `archivos` (plan esperando el OK de Gonzalo).
3. M.11 PDF de marca v2 + «Juntar en un tablero».
4. M.12 instructivos (cuando las pantallas estén quietas).
5. **E-commerce:** skill `ficha-ecommerce` hecha (2026-10-27, coevo-skills; la carpeta `Coevo-Ecommerce` se perdió y las reglas salieron
   de la memoria). Falta el piloto con una prenda real. Después: «Qué es Coevo Studio» para Facu (su rama de diseño empieza por
   la vista del cliente) y la puerta con piezas reales; el inicio de /estudio va en coevo-web (aviso dejado).
6. **De NORA, en orden:** O.12 números de Coevo (a la primera, costo por pieza, volumen) → M.13 reglas de marca que se
   chequean solas → O.6 publicar y medir (Postiz). Ver `docs/negocio/que-es-coevo-studio.md`.
7. **De la reunión del 28/10** (`docs/negocio/reuniones/2026-10-28-estrategia.md`): Studio cómodo en celular; versiones
   anteriores en grande en Entregas; onboarding de cliente (qué pedimos, qué respondemos); Studio integral, no sólo moda.
8. **Modelo de negocio** (`docs/negocio/modelo-de-negocio.md`, propuesta): pauta como módulo aparte (NORA: desde USD 400), medición por plan, auditoría → onboarding → plan; decidir 5 puntos.
9. **Onboarding** (`docs/negocio/onboarding-cliente.md`, propuesta) y **M.14** Marca con texto primero y la lista del arranque (con la rama de Facu).
10. Notas de reunión automáticas → Notion → Studio (falta saber plan de Notion y si las reuniones son por Meet o Zoom).

## Usa de otros / les da
- Usa: `coevo-skills` (sistema de trabajo, skills), Claude Design (design systems), `morph-site` (fuentes y manual de Morph).
- Da: el MCP `coevo-studio` (memoria de marca, entregas, archivos) a cualquier Claude del equipo.

- 2026-11-02 · **Marca de demo en producción:** `austral-automotores` (inventada, plan mensual, 5 piezas propias y 2 comentarios de prueba). Sirve para grabar Studio; aparece en el Inicio del equipo, los clientes no la ven. Backup previo en el VPS: `backend/data/brands.backup-demo-austral-1793641588.json`.

- 2026-11-03 · **Archivos de Claude Design: regla de tres por marca** (`docs/producto/operacion.md` §10). Coevo ya tiene ficha con el sistema v3 y «Coevo · Design system» (https://claude.ai/artifact/FBsSPDZAPy4ER3vhD7YkKo, privado). Coevo y ALGÜNA quedaron con los nombres nuevos; faltan «Foundation ALGÜNA», las demás marcas y qué archivos se comparten con quién.

## Avisos de otros proyectos
- [ ] 2026-11-03 · de coevo-web · **Coevo como marca en Studio, y acceso limitado para el equipo.** Gonzalo quiere que
  alguien del equipo arme propuestas desde su propio Claude, con la marca de Coevo, sin tocar código. Hoy no alcanza: el
  MCP usa una sola llave de servicio (según su README, ve todas las marcas y escribe en Entregas), se instala por
  máquina y no tiene nada para propuestas. Propuesta: (1) cargar a Coevo como marca: sistema visual (fuente:
  `coevo-web/docs/design-system.md`, acá sólo el link o lo que el MCP necesite), voz y reglas de propuestas; (2) acceso
  por persona, sólo lectura y sólo esa marca, sin el que no se le da la conexión; (3) ver si puede ser un conector
  remoto para su cuenta de Claude, no una instalación local. La receta es la skill `propuesta` de coevo-skills (borrador del 3/11), que ya lee `ver_marca`. El
  3/11 `listar_marcas` dio «fetch failed» desde esta compu y no se pudo confirmar si Coevo ya está cargada: revisar.
  Decide esta sesión con Gonzalo.
- [ ] 2026-11-03 · de gonzalo-cortez (Ego Trip) · **Estudiar el circuito con CapCut como etapa.** Gonzalo pide estudiarlo. Ego vende CapCut, así que la app propuesta no reemplazaría la edición: guion y piezas (Studio) → editar en CapCut → subir el video exportado → crítica con comentarios por minuto → publicar → pegar el link. Sin conector: se pasa por archivos, porque CapCut no tiene API oficial encontrada. Responder: ¿cuánto de Plan, Entregas y comentarios clasificados sirve para un usuario que edita y sube su video?, ¿es otro producto o el mismo circuito?, ¿dónde correría un render en servidor (HyperFrames: Chrome + FFmpeg)? La parte de motor y plantillas se estudia en `coevo-skills`. Contexto: `~/cov/archivos/decime-ego/estrategia/final/ego-trip.html`. Decide Gonzalo.
- [ ] 2026-11-03 · de coevo-web · **Referencias de historias en Studio.** Gonzalo imagina la parte automática de las historias sobre un Drive o Pinterest de referencias, y supone que con Studio. Método de Morfeo: carpetas por tipo (llamado directo, personal, resultados, recurso, nutrición), Claude analiza y propone tres ganchos, y una persona elige. Para acá: proponer dónde viven esas referencias por marca, y cómo se ven las secuencias en Entregas y Plan. Base: `coevo-web/docs/sistema-coevo.md`.
- [ ] 2026-11-02 · de coevo-web · **Línea base y medición.** Propuesta de cómo se mide en `coevo-web/docs/sistema-coevo.md`, y `/es/concesionarias` ya la promete con la lista del arranque. Para acá: decidir dónde guarda Studio el número de partida y la anotación por pieza, y alinear `docs/negocio/onboarding-cliente.md`.
- [ ] 2026-11-02 · de coevo-web · **Postiz sale de pausa; Composio entra.** Gonzalo: «vamos a usar Postiz, es clave que la usemos, y Composio y esas herramientas». Cambia lo de «no lo paga hasta saber dónde aplicarlo». Para acá: retomar 5.1 a 5.3 de `brand-integrations` y decir qué necesita (costo de la cuenta, con OK de Gonzalo antes de pagar) y evaluar qué conectaría Composio. Base: `coevo-web/docs/sistema-coevo.md`.
- [ ] 2026-11-02 · de coevo-web · **Coevo es un solo sistema: leer y responder.** Gonzalo quiere que los chats de Studio, onboarding, skills y coevo-web interpreten lo mismo. Página base, en propuesta: `coevo-web/docs/sistema-coevo.md`. Para acá: confirmar qué funciona hoy en la app para mostrarlo en la web (comentar en un segundo exacto, aprobar desde el celular, regla tras correcciones repetidas, publicación con Postiz en pausa) y alinear `docs/negocio/onboarding-cliente.md`. Anotar la respuesta en ese documento.
- [ ] 2026-11-02 · de coevo-web (chat general) · **Onboarding de Studio: secuencia con OK de Gonzalo, a probar.** Está en `coevo-web/docs/recorrido-cliente.md`: cinco momentos del día 0 al 14, y dónde sale cada uno de los siete datos. Alinear `docs/negocio/onboarding-cliente.md`, incluido el primer mensaje fijo, que todavía manda a todos a la auditoría. Sin decidir: dónde guarda la ficha de Studio la línea base, el permiso de caso y quién aprueba.
- [x] 2026-11-02 · de coevo-web (chat general) · **El formulario quedó más corto.** Criterio de Gonzalo: rápido y sin espantar. Pide nombre, WhatsApp, marca, web o Instagram, áreas y un mensaje opcional (`coevo-web/app/[locale]/empezar/`, sin publicar). Las preguntas de `docs/negocio/formulario-inicial.md` pasan a ser la guía de la charla: alinear ese doc y el paso 1 de `onboarding-cliente.md`. → Hecho el 2/11: `formulario-inicial.md` pasó a guía de la charla y el paso 1 apunta al recorrido.
- [x] 2026-11-01 · de coevo-web (chat general) · **El recorrido del cliente se decide en `coevo-web/docs/recorrido-cliente.md`.** Gonzalo decidió dos puertas: Studio (charla → arranque → pilotos → plan, sin auditoría obligatoria) y Consultoría (charla → auditoría paga → presentación). `docs/negocio/onboarding-cliente.md` hoy pone la auditoría como paso de todos: alinearlo. El formulario queda sólo para quien llega solo y con menos preguntas; no construirlo hasta que se decida la tabla. → Hecho el 2/11: `onboarding-cliente.md` y `formulario-inicial.md` alineados a las dos puertas.
- [ ] 2026-11-01 · de alguna-web · **Onboarding, primera prueba con ALGÜNA: qué corregir en `docs/negocio/onboarding-cliente.md`.** Comparación hecha antes de mandar el mensaje; falta sumar qué le cuesta al cliente cuando responda. **Sobró:** de 11 pedidos, 5 sólo necesitan respuesta del cliente (logo en vector, referencias, quién aprueba, persona a cámara, Meta); el resto ya estaba en el repo, `alguna-sistema` o `~/cov/archivos`. Conviene un paso previo: «revisar qué tenemos» antes de armar la lista. **Costó:** `ver_marca` da vacíos logos, páginas del manual y catálogo aunque el material existe en otro lado, y da una identidad vieja (colores, Merriweather/Inter) junto al link del design system vigente, sin marcar cuál manda. **Casos que el doc no cubre:** (1) «Sin la auditoría no hay arranque», pero ALGÜNA tiene auditorías en su repo y Studio dice «falta estrategia»; falta decir qué vale como auditoría. (2) La línea base pide números al cliente, pero las ventas de ALGÜNA viven en `alguna-sistema` y no entran a Studio (`docs/limites.md`). (3) «Quién aprueba» no prevé ausencias: Fran está a distancia hasta el 26/11 y el equipo decidió publicar si ella no llega a revisar. (4) El permiso de voz de Francesca está registrado «vía Gonzalo», no por escrito como pide el doc. **Sin verificar:** si ALGÜNA ya tiene acceso al portal para «Mandar material».
- [x] 2026-11-01 · de alguna-web · **Referencias de marca en el arranque.** Gonzalo quiere que todo proyecto nuevo arranque igual: en el onboarding (`docs/negocio/onboarding-cliente.md`, «Mandar material») y en «Para completar» de la ficha (M.14), pedir una sola vez un link de referencias (Pinterest o Drive) con 10 a 20 imágenes y una línea de qué gusta de cada una. El link se guarda en Archivos y lo da `ver_marca`; no hace falta una función nueva ni copiar las imágenes. Opcional, nunca bloquea el arranque. Lo que pide a las skills va en el aviso de coevo-skills. → Hecho el 1/11: fila opcional en «Para completar», tipo «Referencias» en Archivos, explicación en «Mandar algo» y fila en el onboarding.
- [ ] 2026-11-01 · de coevo-web · **Permiso de caso y línea base en el onboarding.** Mateo Maffia (biblioteca: casos-de-exito-como-contenido-diario) sostiene que los casos venden más que lo viral; está dicho, no medido. Sin número de antes y permiso del cliente no hay caso. Se propone que Studio los pida al sumar una marca. Decide la sesión de este proyecto con Gonzalo.
- [ ] 2026-10-31 · de alguna-sistema · **ALGÜNA va a correr en el VPS, separado de Studio.** `alguna-sistema` (Next 16 +
  Postgres 16) va a tener su propio compose en el VPS de Hostinger, con base, usuario, dominio (`panel.algasalguna.com`)
  y claves propias. No comparte nada con la base de Studio. Necesita dos cosas de acá: (1) **backups fuera del VPS** (el
  pendiente "urgente" de `decisions-log.md`): conviene resolverlo para los dos sistemas a la vez; (2) un hostname más en
  el Cloudflare Tunnel y una política de Access "Equipo ALGÜNA". Studio sigue guardando a ALGÜNA sólo como marca
  cliente (contenido); ventas y plata de ALGÜNA no entran a Studio. Ver `~/cov/alguna-sistema/docs/limites.md`.
> Se leen primero. Al resolver uno: marcarlo [x] y decir qué se hizo, o borrarlo si no aplica.
- [ ] 2026-10-31 · de MiSaluteca-app · **Ficha de Mi Saluteca: revisar la regla «no interpretar resultados».** Gonzalo
  decidió que interpretar con responsabilidad (qué mide cada valor y cuáles quedan fuera del rango del propio
  laboratorio, sin diagnóstico, con preguntas para el médico) pasa a ser parte del producto, como hace Salutia. La
  ficha dice «Evitar: interpretar resultados» y «No se toca: interpretación de valores»: hay que preguntarle al
  cliente por qué está esa regla y, si cambia, validarlo con un abogado antes de que el contenido lo diga. Mientras,
  el contenido no promete interpretación. Además: Mi Saluteca **no tiene Instagram** todavía (lo crea el cliente).
- [ ] 2026-10-30 · de MiSaluteca-app · **Consultoría estratégica integral: Studio como su hogar.** Primera
  corrida con un cliente de punta a punta: `/auditoria-creativa` hecha (`MiSaluteca-app/docs/auditoria-mi-saluteca.md`),
  después vienen `/mapa-de-mercado` → `/design-system` → `/spec-campana`. Gonzalo quiere que esto sea una
  oferta de Coevo que el equipo pueda correr. Lo que pide de Studio: (1) que la ficha de marca guarde la
  síntesis estratégica (la tensión en una frase, el tipo de brecha, el usuario objetivo, **qué no se toca** y
  la pregunta abierta al cliente), así carrusel, reel y pipeline-contenido la leen con `ver_marca` en vez de
  rearmarla en cada skill. Hoy el perfil de Mi Saluteca dice "design system: falta → borrador"; (2) un tipo
  de entrega "consultoría" (las 6 láminas de la auditoría y después el spec) para que el cliente la apruebe y
  comente en Entregas; (3) marcar en la ficha si la marca maneja datos sensibles (salud, finanzas): la
  auditoría encontró un tema de coherencia en privacidad que es primero legal y después creativo (detalle en
  el doc, no acá). Decide Studio con Gonzalo.
  **Actualización 2026-10-31:** la cadena está completa en `MiSaluteca-app/docs/`: auditoría, mapa de mercado
  (hay un gemelo, **Salutia**, lanzado en 09/2026, con 2 personas y 17 seguidores en LinkedIn), spec de
  campaña (claim «¿Quién ve los estudios de tu familia?») y design system **A · Carpeta**, que eligió
  Gonzalo: papel cálido `#F6F3EC`, océano `#2F416A`, verde `#7ABB85` solo en formas, `#37703F` para "en
  orden", Inter por rol y el wordmark real; modo oscuro en carbón cálido. Hoja para aprobar:
  `docs/design/identidad-y-tokens.html`. Según la decisión de Studio del 21/10 ("el diseño gráfico por
  marca lo hace Claude Design"), el paso que falta es **publicar este sistema como Design System de la
  marca en Claude Design** y guardar el link en la ficha. Así `/carrusel` y el resto dejan de marcar
  "borrador". La ficha de Mi Saluteca tiene que pasar a la paleta Carpeta y sacar el teal. Punto de
  vuelta del repo: tag `antes-design-system`.
- [ ] 2026-10-30 · de coevo-web · **Carruseles y Coevo Studio.** Se va a crear la skill «carrusel» en coevo-skills (estudio en `coevo-skills/estudios/carrusel/aprendizaje.md`): marca como datos + salida dinámica (código, imagen generada, Canva, Studio). Pregunta para acá: ¿el Studio comparte la ficha de marca y las plantillas de placa con la skill, o solo recibe las entregas para aprobar? Ver también la skill de NORA en `coevo-skills/estudios/carrusel/fuentes/`.
- [ ] 2026-10-27 · de coevo-skills · **Informe del mes contra la línea base (aprendizaje IA Partner).** Agustín Medina vende
  "diagnóstico → línea base → priorizar → construir → informe mensual". Si coevo-web suma la línea base a la oferta,
  el portal de Studio es donde se ve: una vista por marca con los números de antes y los del mes. También su
  **agente híbrido** (la IA entiende, el código decide lo que cuesta plata) es la regla para créditos y cobros.
  Ideas: biblioteca `linea-base-antes-de-intervenir`, `criterio-y-regla`.

- [ ] 2026-10-26 · de alguna-web · **El archivo de ALGÜNA puede usar el patrón de Studio.** Tras la llamada del
  26/10, ALGÜNA suma tesorería (cajas, gastos), facturación por ARCA y precios con reglas a ventas y stock.
  Gonzalo plantea que lo central es el backend y el archivo. Propuesta en alguna-web: base propia en Postgres +
  API + un MCP `alguna` (como `coevo-studio`) para que cada Claude del equipo cargue y consulte; Notion pasa a
  ser vista/documentos, no la fuente. Base separada de la de Studio (datos financieros de otra organización),
  mismo stack. Reemplaza la idea de «alguna-panel sobre Airtable» del aviso de abajo. Decide alguna-web con Gonzalo.
- [x] 2026-10-25 · de coevo-skills · `backend/services/instagram_scraper.py`: `GEMINI_MODEL =
  "gemini-2.5-flash"` escrito a mano (Google ya retiró gemini-2.5-pro para cuentas nuevas) →
  usar el alias `gemini-flash-latest`. Y la key va en la URL (`?key=`): pasarla al header
  `x-goog-api-key`, así no aparece en logs ni en mensajes de error.
- [x] 2026-10-25 · de coevo-skills · **carpeta-coevo** y **mapa** son el mismo sistema. Leído: la
  carpeta-coevo propuesta acá quedó como skill `archivos`; el sistema se decide en `coevo-skills/SISTEMA.md`.
- [ ] 2026-10-25 · de coevo-skills · **ALGÜNA como caso de éxito de Coevo Studio.** Gonzalo quiere
  que ALGÜNA tenga "su propio Studio": memoria de marca (voz, design system), contenido y además
  operación (ventas, stock por ciudad, bitácora). Propuesta: no forkear Studio; ALGÜNA es una
  marca más adentro (voz y design system acá, con hogar único), y la operación arranca como app
  aparte (`alguna-panel` sobre Airtable) linkeada desde «Archivos». Si funciona y se repite en
  otras marcas, pasa a ser un módulo de Studio. A decidir: hoy la voz de ALGÜNA vive en
  `alguna-web/.claude/skills/alguna-voice/`; ¿el hogar de la voz es Studio o la skill?
- [ ] 2026-10-25 · de coevo-skills · **Un solo nombre por marca: el id de Studio.** Regla nueva en
  `coevo-skills/SISTEMA.md`: skills = cómo se hace (git); marca = datos en Studio (`ver_marca`);
  las carpetas `~/cov/archivos/<id>/` usan el id de Studio. Para hacer acá:
  (1) ALGÜNA tiene id **`alkura`** → pasarlo a **`alguna`** (las carpetas ya usan `alguna`).
  (2) Marcas sin contexto ni ADN: Geely, Garcon Garcia, Clara Ibarguren, Cascara; Posadas La Manso
  sin ADN. (3) Faltan: Giumati, Lastre; ¿Kooris es "Koxis" (id `koxis`)? Confirmar con Gonzalo.
  (4) La voz de ALGÜNA hoy vive en `alguna-web/.claude/skills/alguna-voice/`: pasarla al ADN de la
  marca en Studio (es dato, no skill).
- [x] 2026-10-26 · de coevo-skills · **Modelos de Gemini a un solo lugar.** El chequeo encontró
  `gemini-2.5-flash` escrito a mano en `backend/main.py` y 8 archivos más (y `gemini-2.5-pro` en
  otros). Pasar todo a una variable (`GEMINI_MODEL`, vacía = `gemini-flash-latest`) en
  `llm_router.py`. Correr `python3 ~/.claude/skills/chequeo/scripts/chequeo.py` para ver la lista.
- [ ] 2026-10-26 · de coevo-skills · **Benchmark: Genera.space (competidor directo en moda).** Lo que
  hacen y Studio no: escenas guardadas como preset (luz+cámara+estilo, un clic por prenda), brief en
  partes (pose / luz / cámara separadas), edición por componentes de la prenda (cuero, herrajes,
  costuras) con retoque manual, poses desde Pinterest, "sin prompts" para el usuario, foto→video en
  el mismo flujo. Detalle y fuentes: `~/cov/biblioteca/preguntas/que-hace-genera-space-que-studio-no.md`.
  Decidir cuáles entran al backlog de Studio (escenas guardadas y brief en partes parecen las más
  baratas y de más impacto).
- [x] 2026-10-27 · de coevo-skills · **ALGÜNA (`alkura`) tiene identidad vieja en Studio.** «identidad_grafica»
  dice Merriweather/Inter y otra paleta; lo vigente es el design system de Claude Design
  (https://claude.ai/artifact/2MFXakLjjF3e992iLZJitq: papel, tinta, verde; Creato Display, IBM Plex Mono, Courier;
  reels con cortes secos a 24 fps) y la skill `alguna-web/.claude/skills/alguna-design-system`. Que la marca en
  Studio apunte ahí en vez de copiar valores (una copia envejece). De paso: id `alkura` → `alguna`. → Identidad corregida el 1/11 (copia en `~/cov/archivos/alguna/_studio-backups/`). No se hizo: el cambio de id; se copiaron valores además del link.
