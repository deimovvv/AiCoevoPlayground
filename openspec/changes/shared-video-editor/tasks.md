## 1. Sólo lectura

- [x] 1.1 Editor dentro del Render de Fashion Reel: reproductor + timeline + exportar.
      `components/workspace/VideoTimeline.tsx`, encendido con `USE_TIMELINE`. El reproductor
      reproduce los CLIPS en secuencia (no el MP4 pegado) para que recortar/reordenar se vea al
      instante en la etapa 2. **Falta verlo en el navegador** con una corrida real.

## 2. Editar

- [x] 2.1 Recortar inicio y fin; reordenar; borrar. Exportar con los cambios (`trims` en
      `video_concat.concat_videos`, probado con FFmpeg real: 6.04 s esperado, 6.07 s obtenido).
      La edición se guarda en el resultado del Render. **Falta probarlo en el navegador.**
- [ ] 2.2 Comentarios por timestamp.
- [ ] 2.3 Regenerar un clip desde su comentario — tocando SÓLO ese clip (design.md §1).
- [ ] 2.4 "Guardar como regla de la marca" → `brand.designSystem.motion_rules` (design.md §2).

## 3. Extender

- [ ] 3.1 Las otras 3 tools de video.
- [ ] 3.2 "Abrir en editor" desde Content, Lab y piezas de campaña.

## 4. Segunda etapa (del antecedente §12)

- [ ] 4.1 Overlay de música (pista, volumen, fade).
- [ ] 4.2 Editor de subtítulos (texto, timing, estilo).
- [ ] 4.3 Elegir el frame de portada.
- [ ] 4.4 Control de calidad post-export: 3 frames, cara tapada / texto cortado (design.md §4).
- [ ] 4.5 Corte automático de talking heads con aprobación del texto antes de cortar (design.md §3).
