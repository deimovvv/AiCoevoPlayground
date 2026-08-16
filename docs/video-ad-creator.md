# Video Ad Creator — estado as-built (Ago 2026)

> Cómo funciona HOY el Video Ad Creator después del rework de Ago 2026 (sesión PROMAN).
> Diseño/decisiones: [`video-dialogue-pipeline.md`](video-dialogue-pipeline.md) (spec) · [`video-ad-production-sop.md`](video-ad-production-sop.md) (método del operador) · [`pricing-credits.md`](pricing-credits.md) (costos).

## Idea
Pegás un **brief o un guión escena-por-escena** → la IA interpreta, propone personajes, arma el storyboard, genera imágenes consistentes, voz por personaje, anima con labios, música y subtítulos. **Brief-first**: casi todo se deriva del guión + el Brand System; los selectores son overrides.

## Pipeline (8 pasos)
`script → character → base_image → images → voice → animate → lipsync → render`

1. **Script** (`handleScript`, Gemini + `backend/tools/video_ad_creator/default_prompt.txt`)
   - Detecta si es **guión ingerido** (escenas + diálogo) o **brief suelto**.
   - Guión → **un frame por TURNO de diálogo** (plano-contraplano): cada línea = su frame, close-up del que habla, alternando. Un guión de 40s ≈ 8-14 frames (no 3). Diálogo **verbatim**.
   - Devuelve `frames[]` (prompt visual, script=línea, speaker, location, scene_type) + `characters[]` + `interpretation` + **`voiceMap`** (auto-asigna una voz del Brand Kit por personaje según edad/género — Nenita para niños, Mujer, Hombre, Hombre grande).
   - Bug corregido: antes tomaba "el primer array" y agarraba `characters` como frames (fichas de personaje, diálogo vacío) → ahora toma `frames` explícito.
2. **Character** (`handleCharacter`): genera una **referencia maestra por personaje** (gate de aprobación).
3. **Imagen base** (`handleBaseImage`): master de la escena 1 = **`@img1`** que ancla todo (gate). Fase 6 del SOP.
4. **Imágenes** (`handleImages`): cada frame anclado al master (identidad/estilo/paleta consistentes).
   - **Fondo por escena**: si la escena muestra la **planta** (keywords planta/domos/contenedores/grúas/CERREY…) ancla las **fotos reales** del Brand Kit; el resto lo **imagina** desde el prompt + Brand Context (no se fuerza imagen).
   - Botón **"Descargar todas · ZIP"** (escenas en orden).
5. **Voz** (`handleVoice`/`handleImages`): TTS ElevenLabs por personaje (`voiceMap[speaker]`), acento mexicano. "PRÓMAN" con acento en la O.
6. **Animate** (`handleAnimate`) — **rework Ago 2026**: **un clip por toma** (NO frame-to-frame).
   - Toma con **diálogo de personaje** (audio + speaker ≠ narrador) → **OmniHuman v1.5 / Kling Avatar** (audio-driven, labios sincronizados, duración = el audio). Modelo elegible: `config.talkingModel`.
   - Toma **ambiente/insert/narrador** → **Kling image-to-video** (movimiento sutil).
7. **Lipsync** (`handleLipsync`): **passthrough** — las tomas de diálogo ya vienen con labios+audio; no se re-aplica sync-lipsync (que fallaba sobre estilizado).
8. **Render** (`handleRender`): concat de las tomas + **música Lyria** con **ducking** bajo la voz + **subtítulos** (con/sin).

## Selectores del form (config)
- **Estilo visual**: Playmobil / Papel / Claymation / 2D Cartoon / Photorealistic / … / **Custom** (el texto describe el estilo y ES la guía — `config.notes`).
- **Modelo de labios (diálogo)**: OmniHuman v1.5 · Kling Avatar Std · Kling Avatar Pro (`config.talkingModel`).
- **Música de fondo**: Auto (infiere el mood del guión+interpretación) · Alegre (mexicana) · Reflexiva (underscore) · Neutral · Sin música · **+ prompt custom** (`config.musicMood` / `config.musicPrompt`).
- **Subtítulos**: Con (FFmpeg) · Con (Remotion) · Auto · Sin (`config.subtitleEngine`).
- **AR / Resolución / Duración / Idioma**. La **voz global se eliminó** (es por personaje).
- Secciones de assets (Personaje/Producto/Prendas/Fondo/Moodboard) = **overrides opcionales** (colapsados); muestran los assets del Brand Kit para elegir.

## Modelos y costos (Fal, Ago 2026)
| Modelo | Uso | $/s |
|---|---|---|
| OmniHuman v1.5 | labios, cualquier estilo | $0.16 |
| Kling AI Avatar std / pro | labios, más barato | $0.056 / $0.115 |
| Kling v2.5-turbo (image-to-video) | ambiente | ~$0.07 |
| Lyria 2 | música instrumental | $0.10/30s |
| ElevenLabs | voz | ~$0.15/1k car |
| Nano Banana 2 | imágenes | ~$0.039/img |

Video ~40s: **~$5-8** con OmniHuman en diálogo, **~$2.5-3** con Kling Avatar Std. Ver [`video-dialogue-pipeline.md`](video-dialogue-pipeline.md).

## Brand System (marca "Mexico" = PROMAN)
Cargado vía API: **brandContext** (cliente, mensaje, tono, estilo por-campaña, locaciones + marcadores geográficos, la planta real, personajes arquetipo, guardrails Pechocho=delfín / no logos-texto, PRÓMAN), **8 voces** ElevenLabs (incl. Nenita), **5 backgrounds** (fotos reales de la planta). El estilo NO se fuerza desde el contexto — lo manda la corrida (Estilo/Reference).

## Servicios backend nuevos
`omnihuman.py` (fal-ai/bytedance/omnihuman/v1.5) · `kling_avatar.py` (fal-ai/kling-video/ai-avatar/v2) · `music_gen.py` (fal-ai/lyria2). Endpoints: `/api/fal/talking`, `/api/music`. `video_concat.concat_videos` acepta `background_music_url` (mix con ducking, guardado). Fix `kling_video`: `image_url` (no `start_image_url`).

## Gotchas / pendientes
- **Consistencia de ROPA**: el master mantiene la cara pero la vestimenta puede driftar entre tomas — falta anclar la ropa.
- **Editar con referencia**: subir una ref para "corregir ropa" no aplica bien + falta **etiquetar** la ref (a quién refiere, tipo @-mention).
- **Costo/tiempo**: ~10 tomas OmniHuman = ~20-25 min de animate. Usar Kling Avatar Std para abaratar.
- **Dev local**: el backend Coevo corre en **:8001** (el :8000 lo ocupa otra app Flask del usuario); `frontend/src/lib/api.ts` tiene un cambio LOCAL a :8001 que NO se commitea (revertir a :8000 antes de commitear).

## PRs de la sesión (Ago 2026)
#109 spec · #110 servicios talking · #111 Lyria · #112 voz auto por personaje · #113 fondo por escena · #114 fix parseo frames · #115 fix estilo Custom · #116 ZIP + tabs · #117 audio player · #118 contraplano · #119 animate rework + música + fix Kling · #120 selectores (modelo/música/subs).
