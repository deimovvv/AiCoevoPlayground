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
5. Notas de reunión automáticas → Notion → Studio (falta saber plan de Notion y si las reuniones son por Meet o Zoom).

## Usa de otros / les da
- Usa: `coevo-skills` (sistema de trabajo, skills), Claude Design (design systems), `morph-site` (fuentes y manual de Morph).
- Da: el MCP `coevo-studio` (memoria de marca, entregas, archivos) a cualquier Claude del equipo.

## Avisos de otros proyectos
> Se leen primero. Al resolver uno: marcarlo [x] y decir qué se hizo, o borrarlo si no aplica.

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
