# Estado

> Lo que está pasando ahora en este proyecto (no cómo se trabaja: eso es CLAUDE.md).
> Cada sesión lo lee al empezar y lo actualiza al cerrar. Lo completa la próxima sesión de acá.

## Ahora (2026-10-25)
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
6. Notas de reunión automáticas → Notion → Studio (falta saber plan de Notion y si las reuniones son por Meet o Zoom).

## Usa de otros / les da
- Usa: `coevo-skills` (sistema de trabajo, skills), Claude Design (design systems), `morph-site` (fuentes y manual de Morph).
- Da: el MCP `coevo-studio` (memoria de marca, entregas, archivos) a cualquier Claude del equipo.

## Avisos de otros proyectos
> Se leen primero. Al resolver uno: marcarlo [x] y decir qué se hizo, o borrarlo si no aplica.

- [ ] 2026-10-26 · de alguna-web · **El archivo de ALGÜNA puede usar el patrón de Studio.** Tras la llamada del
  26/10, ALGÜNA suma tesorería (cajas, gastos), facturación por ARCA y precios con reglas a ventas y stock.
  Gonzalo plantea que lo central es el backend y el archivo. Propuesta en alguna-web: base propia en Postgres +
  API + un MCP `alguna` (como `coevo-studio`) para que cada Claude del equipo cargue y consulte; Notion pasa a
  ser vista/documentos, no la fuente. Base separada de la de Studio (datos financieros de otra organización),
  mismo stack. Reemplaza la idea de «alguna-panel sobre Airtable» del aviso de abajo. Decide alguna-web con Gonzalo.
- [ ] 2026-10-25 · de coevo-skills · `backend/services/instagram_scraper.py`: `GEMINI_MODEL =
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
- [ ] 2026-10-26 · de coevo-skills · **Modelos de Gemini a un solo lugar.** El chequeo encontró
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
- [ ] 2026-10-27 · de coevo-skills · **ALGÜNA (`alkura`) tiene identidad vieja en Studio.** «identidad_grafica»
  dice Merriweather/Inter y otra paleta; lo vigente es el design system de Claude Design
  (https://claude.ai/artifact/2MFXakLjjF3e992iLZJitq: papel, tinta, verde; Creato Display, IBM Plex Mono, Courier;
  reels con cortes secos a 24 fps) y la skill `alguna-web/.claude/skills/alguna-design-system`. Que la marca en
  Studio apunte ahí en vez de copiar valores (una copia envejece). De paso: id `alkura` → `alguna`.
