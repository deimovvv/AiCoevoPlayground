## 1. Proyectos por marca

- [ ] 1.1 Proyecto de video guardado por marca en el servidor (mismo `timeline.json`).
- [ ] 1.2 "Nuevo video" desde la biblioteca de la marca (Contenido + Brand Kit + subidas).
- [ ] 1.3 "Abrir en editor" al final de las tools de video y desde Contenido / Lab / Campañas.
- [ ] 1.4 API para que Claude lea y escriba un proyecto del servidor (no sólo carpetas locales).

## 2. Plantillas

- [ ] 2.1 "Guardar como plantilla": forma sin material, sin marca.
- [ ] 2.2 Usar una plantilla en otra marca (toma su tipografía, colores y logo).
- [ ] 2.3 El reel de Morph (`reel-marca`) como primera plantilla.

## 3. Bloques animados

- [ ] 3.1 Feed, grilla que se aleja, palabra gigante, tiras, cierre con logo + CTA.
- [ ] 3.2 Motor: decidir si los bloques se graban con Remotion (como los textos) o HyperFrames.

## 4. Skills

- [ ] 4.1 `explicar-herramienta`, `reel-marca`, `grabar-web` escriben `timeline.json` (sesión coevo-skills).

## 5. Ya pendientes

- [ ] 5.1 Editor en Product Clip y Video Ad Creator. (UGC: en espera.)
- [ ] 5.2 Frame de portada.
- [ ] 5.3 Subtítulos palabra por palabra desde la voz. (En espera con UGC.)
- [ ] 5.4 Corte automático de talking heads con aprobación del texto.
- [ ] 5.5 "Animar con IA": el modelo escribe los gráficos con el design system de la marca.

## 6. Timeline generativo y sección Videos

- [ ] 6.1 Formato: el tramo admite `gen` (`kind` image|video|block, `model`, `prompt`, `refs`, `aspect`, `duration`, `status` pendiente|generando|listo|error, `cost`, `versions`). Hasta que entre al contrato, las skills lo escriben como `_gen` (campo propio que el editor conserva).
- [x] 6.2 Primer caso a mano: `~/cov/reels/catalogo-morph/video-catalogo/{16x9,9x16}/timeline.json` con tramos pendientes, abierto en el editor.
- [ ] 6.3 "Regenerar con prompt" en cualquier tramo con `gen` (costo a la vista, versión anterior guardada y comparable).
- [ ] 6.4 `reel-marca` escribe el plan (brief + inputs → tramos pendientes) y genera en orden de dependencia.
- [ ] 6.5 Un proyecto con dos formatos (16:9 y 9:16): tramos generados nativos por formato, bloques reacomodados, voz por formato.
- [ ] 6.6 Bloques del caso catálogo en Remotion: flash (2 cuadros blancos + foto final), grilla que explota, proceso en tres columnas.
- [ ] 6.7 Sección **Videos** en la barra lateral (por marca): proyectos, "Nuevo video", plantillas.

## Pruebas pagas pendientes (hacerlas CON el usuario, no correrlas solo)

- [ ] Generar música con Lyria desde el panel ($0.10).
- [ ] Regenerar un clip desde una nota ($0.45, Kling V3 Pro 4 s).
- [ ] A/B de recetas Kling vs Seedance copiando el movimiento (~$1.81, `fashion-reel-format-recipes` 3.1).
