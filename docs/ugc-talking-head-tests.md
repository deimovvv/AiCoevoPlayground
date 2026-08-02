# UGC Talking-Head — Bitácora de pruebas (modelos, procedimientos, resultados)

Registro de TODOS los tests que hicimos para el video UGC "persona hablando a cámara"
(caso testigo: **aviso UTN Mendoza — Tecnicatura en Programación**), para ir acumulando
evidencia y quedarnos con el mejor pipeline.

> Complementa `docs/ugc-audio.md` (research de audio/voz). Este doc es la **bitácora práctica**
> con archivos concretos y veredictos. Fecha de arranque: 2026-07-28.

---

## TL;DR — dónde estamos

- **La cara/persona y la voz son CAPAS SEPARADAS.** Cada una con la herramienta que es buena
  para eso. Ese es el hallazgo que ordena todo.
- **Seedance 2.0 NO acepta caras fotorrealistas** (reales o IA hiperrealistas) — filtro de
  ByteDance a nivel modelo, pega en Fal, Replicate y Magnific por igual. Y su **voz nativa
  destroza el español** ("tecnicaduga", "medoja", acento colombiano).
- **OmniHuman (ByteDance vía Fal) SÍ toma tu cara exacta** sin filtro, y hace lip-sync a
  cualquier audio → es el motor de talking-head.
- **La voz porteña/argentina sale de ElevenLabs** (pronuncia bien + acento controlable).
- **El "suena a estudio / no a exterior" se arregla en la mezcla** (worldizing: ambiente + EQ),
  no dejando que el modelo de video genere la voz.
- **Pipeline ganador actual:** `OmniHuman + ElevenLabs (voz argentina) + ElevenLabs Sound-Gen
  (ambiente) + FFmpeg (worldizing)`. Archivo: `FINAL_utn_sofia_ambiente.mp4`.
- **A probar en serio:** **Google Veo 3** (test del papá funcionó bien — 2 imágenes
  presentadora+fondo + voz nativa argentina). Puede simplificar todo si acepta la cara.

---

## Modelos y su rol

| Rol | Herramienta | Endpoint / modelo | Nota |
|---|---|---|---|
| Talking-head (cara+lipsync) | **OmniHuman** (ByteDance) | `fal-ai/bytedance/omnihuman` | Imagen+audio→video. Sin filtro de caras. $0.14/s. Imagen debe ir en **JPEG** (PNG crudo = 403). |
| Voz | **ElevenLabs** | `eleven_v3` TTS | Pronuncia bien el español, acento controlable. Voz "Sofía" (arg.) elegida. |
| Ambiente | **ElevenLabs Sound-Gen** | `/v1/sound-generation` | Cama de sonido de campus. |
| Lip-sync video+audio | **Sync Lipsync V3** | `fal-ai/sync-lipsync/v3` | Re-sincroniza boca de un video a un audio nuevo (para el híbrido). |
| Video generativo (escena) | **Seedance 2.0** | `bytedance/seedance-2.0/*` | Genial para escena/b-roll SIN cara reconocible. Bloquea caras. |
| Candidato a evaluar | **Google Veo 3** | (a definir: Fal `fal-ai/veo3` / Google) | Audio nativo + 2 imágenes. Test del papá OK. |
| Mezcla / worldizing | **FFmpeg** | — | EQ + eco + mezcla de ambiente. |

---

## Bitácora de pruebas

| # | Enfoque | Modelo(s) | Resultado | Archivo (en ~/Downloads) |
|---|---|---|---|---|
| 1 | Talking-head, avatar Koxis (cara close-up) | OmniHuman | ✅ Identidad perfecta, lip-sync ok | `omnihuman_koxis.mp4` |
| 2 | Talking-head, chica UTN + voz Algaia | OmniHuman + ElevenLabs (Algaia) | ✅ Cara perfecta ❌ voz "estudio", neutra | `omnihuman_utn.mp4` |
| 3 | Seedance ref-to-video nativo (sin audio) | Seedance | ❌ Filtro / voz nativa mala | — |
| 4 | Seedance text-to-video, persona generada | Seedance t2v | ✅ Visual lindo ❌ no es tu chica, acento flojo | `seedance_t2v_mendoza.mp4` |
| 5 | Seedance t2v aviso UTN (voz nativa) | Seedance t2v | ❌ "tecnicaduga", "medoja", acento colombiano, "UTN" garabateado | `seedance_utn_programacion.mp4` |
| 6 | Subir cara real/IA hiperrealista a Seedance | Seedance (Fal / Magnific start-image / Magnific character-ref / Replicate) | ❌ **Bloqueado en las 4 vías** ("Content moderated by Seedance") | — |
| 7 | Híbrido: video Seedance + voz ElevenLabs | Seedance t2v + ElevenLabs + Sync Lipsync V3 | ✅ Palabras correctas ⚠️ video estirado (audio 22s > clip 15s) | `hibrido_seedance_porteno.mp4` |
| 8 | Muestras de voz argentina | ElevenLabs (Sofía, Melody) | ✅ Argentinas de verdad; **Sofía elegida** | `voz_Sofia_AR.mp3`, `voz_Melody_AR.mp3` |
| 9 | **FINAL** cara exacta + voz Sofía + ambiente | OmniHuman + ElevenLabs + Sound-Gen + FFmpeg | ✅ Producto completo (a validar mezcla) | `FINAL_utn_sofia_ambiente.mp4` |
| 10 | Veo 3, 2 imágenes + voz nativa | Google Veo 3 | 🟡 Test del papá "funcionó bastante bien" — **a reproducir/medir** | (del papá) |

---

## Hallazgos clave

1. **Filtro de caras de Seedance = a nivel modelo (ByteDance).** Es un clasificador de
   **fotorrealismo** (no de "persona real"): una cara IA demasiado realista se bloquea igual
   que una foto. No hay flag para desactivarlo en Fal/Replicate. La única vía "real person"
   sancionada es verificación de liveness (apps de ByteDance / nodo ComfyUI "Real Human"), o
   el consentimiento de Freepik para imágenes que *pasen* el umbral. La imagen `referenciaclaude.png`
   puntúa demasiado "foto" → bloquea en todos lados.

2. **OmniHuman no tiene ese filtro** — toma la cara exacta. Es el motor correcto para
   "mi personaje puntual hablando".

3. **La voz nunca del modelo de video** (para acento regional). Seedance/Veo nativo no clavan
   porteño/argentino y pueden pronunciar mal. ElevenLabs sí. (Ver `docs/ugc-audio.md`.)

4. **"Suena a estudio" se arregla worldizeando**, no generando la voz en el modelo. Es lo que
   hace la producción pro (ADR + diseño de sonido).

5. **OmniHuman: la imagen va en JPEG.** PNG crudo → HTTP 403 en el submit.

6. **Timing:** los clips de Seedance topan a 15s; guiones largos (~20s) hay que **partir en
   escenas** (Hook + CTA) o el remap estira el video.

---

## Receta actual (pipeline ganador) — 5 pasos

Caso: cara exacta (personaje IA que no se regenera) + voz argentina + ambiente.

1. **Voz (ElevenLabs)** — TTS del guión, voz "Sofía" (`h60rOzgfLmYsntfqgGu2`), `eleven_v3`,
   `stability=0.45, style=0.3, speed=1.0`.
2. **Imagen** — `referenciaclaude.png` → **convertir a JPEG** → subir a Fal storage.
3. **OmniHuman (Fal)** — `image_url` + `audio_url` → video con lip-sync. Sin filtro.
4. **Ambiente (ElevenLabs Sound-Gen)** — prompt de campus, duración = largo del video.
5. **Worldizing + mezcla (FFmpeg)**:
   - Voz: `highpass=95Hz` + compresor suave + `aecho=0.8:0.85:38:0.12` + `treble=+2dB`.
   - Ambiente: `volume=0.16` + `lowpass=8.5kHz` (queda detrás).
   - `amix` de ambas → re-mux al video (`-c:v copy`, audio AAC).

Costo aprox por clip: OmniHuman ~$2.7 (19s) + ElevenLabs (centavos).

Script de referencia: `scratchpad/final_utn.py` (sesión 2026-07-28).

---

## Candidato a probar: Google Veo 3

El papá lo probó con **2 imágenes (presentadora + fondo UTN)** y **voz nativa argentina**, y
"funcionó bastante bien". Si Veo:
- acepta la cara (¿tiene su propio filtro? ¿consentimiento?),
- compone persona + fondo real de forma creíble,
- y su voz nativa argentina es aceptable (o le pasamos audio),

…podría ser el camino más simple (todo en un modelo). **Pendiente:** reproducirlo, medir
calidad de voz/acento vs. ElevenLabs, y ver si acepta `referenciaclaude.png` sin bloqueo.

### Prompt de Veo (del papá) — referencia
> Crear un video publicitario vertical 9:16, ~20s. Usar 2 imágenes: (1) presentadora exacta,
> (2) fondo UTN exacto. Conservar identidad de la mujer y el lugar real; eliminar limpiamente
> la persona sentada a la derecha; adaptar a 9:16; colocar a la mujer al pie de las escaleras,
> integrada con perspectiva/luz/sombras; cámara a la altura de los ojos tipo selfie; animar solo
> lo necesario para hablar (lip-sync, parpadeo, micro-movimientos); voz femenina joven argentina,
> natural, ~0.95×, con pausas; guión exacto (ver abajo); dejar aire arriba/abajo para logo+subtítulos.
> _(Prompt completo guardado en la conversación / a pegar acá si se estandariza.)_

### Guión testigo (UTN Programación)
> "¿Te apasiona la tecnología? En la UTN Mendoza estudiá la Tecnicatura Universitaria en
> Programación. Dos años con inteligencia artificial como eje en todas las materias. Formación
> real, pensada para las necesidades del mercado actual. Tu futuro en programación empieza acá.
> ¡Inscribite!"

---

## Estado de integración (2026-07-29)

**Veo 3.1 quedó WIREADO al UGC Creator** (opción de motor, no reestructura el pipeline):

- Backend: `services/veo_video.py` + endpoints `/api/veo/image-to-video` y `/api/veo/poll`
  (al completar descarga el video y lo sirve en `/static/renders/`). Validado e2e:
  submit → poll → completed (~40s) → video servido HTTP 200 con audio.
- Frontend: `api.ts` (`createVeoVideo`/`pollVeoVideo`), `handlers.ts` (rama Veo en escenas
  habladas, voz nativa, saltea ElevenLabs), `ToolRunPage.tsx` (Veo en selector Animación +
  campo de acento; **se sacaron los 3 modos Seedance de voz** por muertos).
- **Uso:** en UGC Creator, elegir **Veo 3.1** como Animación → el paso de Voz se saltea →
  cada escena hablada la genera Veo con voz nativa argentina.

### Gotchas de Veo (importantes)
- **Usar el modelo DEFAULT (`veo-3.1-generate-preview`), NO el fast.** El fast
  (`veo-3.1-fast-generate-preview`) **filtra el audio por RAI** ("issue with the audio /
  safety filters") → no genera. La integración usa default (`fast:false`).
- Clips de **~8s**. Guion largo (~20s) → partir en Hook + CTA (varios clips) y unir.
- La descarga de la Files API pide la key como **header** `x-goog-api-key` (no query param),
  y sigue redirects. Por eso el backend proxya el video en vez de exponer la URI de Google.
- Filtro de caras: **Veo SÍ acepta** el retrato hiperrealista que Seedance bloquea.

## Próximos pasos

- [ ] Escuchar/comparar el audio nativo de Veo vs. la voz Sofía (ElevenLabs) — cuál gana para porteño.
- [ ] Validar la mezcla del `FINAL_utn_sofia_ambiente.mp4` (ambiente + worldizing) con el oído.
- [ ] Partir guiones largos en **Hook + CTA** (2 escenas) para el tope de ~8-15s de los modelos.
- [ ] Decidir si conviene **clonar** una voz porteña real (vs. Sofía de librería o voz nativa de Veo).
- [ ] Evaluar si Veo también debería animar las escenas **creativas/b-roll** (hoy caen a Kling).
