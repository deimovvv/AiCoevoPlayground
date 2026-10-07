## 1. Sólo lectura

- [x] 1.1 Editor dentro del Render de Fashion Reel: reproductor + timeline + exportar.
      `components/workspace/VideoTimeline.tsx`, encendido con `USE_TIMELINE`. El reproductor
      reproduce los CLIPS en secuencia (no el MP4 pegado) para que recortar/reordenar se vea al
      instante en la etapa 2. **Falta verlo en el navegador** con una corrida real.

## 2. Editar

- [x] 2.1 Recortar inicio y fin; reordenar; borrar. Exportar con los cambios (`trims` en
      `video_concat.concat_videos`, probado con FFmpeg real: 6.04 s esperado, 6.07 s obtenido).
      La edición se guarda en el resultado del Render. **Falta probarlo en el navegador.**
- [x] 2.2 Comentarios por timestamp.
- [x] 2.3 Regenerar un clip desde su comentario — tocando SÓLO ese clip (design.md §1).
- [x] 2.4b Alargar un clip = regenerarlo con más duración. Volver a la versión anterior (`history`).
      Probado con fetch interceptado (10/10): receta + indicación + regla de marca + duración + modelo,
      en Kling y Seedance. **Falta probarlo en el navegador con una regeneración real (cuesta).**
- [x] 2.4 "Guardar como regla de la marca" → `brand.designSystem.motion_rules` (design.md §2).

## 2b. Pulido (2026-10-06)

- [x] Refresh vuelve al editor si el Render está hecho (antes abría Shots con el form abierto).
- [x] Notas: título, caja visible con el instante, ejemplo y qué hace cada botón.
- [x] Prueba en el navegador (Playwright, 2026-10-06): recarga → editor, nota, recorte (4.0 → 3.5 s),
      exportar (11.6 s exactos). Sin errores de consola. **Falta: regenerar un clip real ($0.45).**
- [x] Bug: notas, recortes y clips regenerados NO se guardaban — el autoguardado sólo miraba qué
      pasos tenían resultado, no su contenido. Ahora compara contenido, con debounce de 600 ms.
- [x] Bug: abrir un run con otra marca activa le cambiaba la marca al run. Ahora se guarda con la suya.
- [x] Exportar reintenta la descarga de clips (un corte de red de Fal daba 502).
- [x] Exportar guarda el video editado como el del run (Contenido muestra ése); el original queda
      en `originalVideoUrl`.
- [x] Marca del run (`lib/RunBrandContext.tsx`): regenerar, "regla de la marca" y autoguardar usan
      la marca DUEÑA del run, no la activa. Probado con Koxis activa sobre un run de Geely.

## 3. Extender

- [ ] 3.1 Las otras 3 tools de video.
- [ ] 3.2 "Abrir en editor" desde Content, Lab y piezas de campaña.

## 4. Segunda etapa (del antecedente §12)

- [ ] 4.1 Overlay de música (pista, volumen, fade).
- [x] 4.2 Capa de texto manual (2026-10-07): pista "Texto" con bloques — título, subtítulo, prenda,
      precio, CTA · arriba / centro / abajo · tono claro / oscuro. `TextLayer.tsx` es la `render(t)`:
      la misma en la vista previa (encima del reproductor) y en el export (Remotion,
      `remotion/render-text.mjs` ← `services/text_overlay.py` ← `POST /api/video/text-overlay`).
      Fuente y acento de la marca del run. Probado en navegador y con export real (design.md §8).
      **Falta:** subtítulos automáticos desde la voz (alineación forzada de ElevenLabs).
- [ ] 4.2b "Animar con IA": Sonnet/Opus 5.5 escribe la composición HTML de gráficos con el
      design system de la marca; se corrige con las notas. Probar HyperFrames acá (design.md §7, nivel 2).
- [ ] 4.3 Elegir el frame de portada.
- [ ] 4.4 Control de calidad post-export: 3 frames, cara tapada / texto cortado (design.md §4).
- [ ] 4.5 Corte automático de talking heads con aprobación del texto antes de cortar (design.md §3).
