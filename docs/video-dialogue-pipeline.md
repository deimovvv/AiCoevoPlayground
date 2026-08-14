# Pipeline de video con diálogo — spec + aprendizajes (validado en PROMAN)

> Destilado de la sesión de PROMAN (guiones 3 "El vivero de la abuela" y 4 "Diez kilómetros del Pechocho"), Ago 2026.
> Es el **spec** del selector por-plano del Video Ad Creator y la guía de costos. Ver también [`video-ad-production-sop.md`](video-ad-production-sop.md) (método del operador) y [`pricing-credits.md`](pricing-credits.md).

## El problema central: labios que se muevan bien
Ningún modelo mueve labios bien en **plano general con caras chicas** (juguete/papel o foto). Lo aprendido, en orden:

- **Kling image-to-video**: mueve fondo/ambiente, **nunca labios**. (El campo correcto en Fal es `image_url`, no `start_image_url` — bug del código, ver abajo.)
- **sync-lipsync v2 pro**: falla sobre estilizado (papel/juguete) — no mueve la boca.
- **OmniHuman** (v1/v1.5): **sí mueve labios** sobre cualquier cara (incluso papel/juguete), pero **congela el fondo** y agarra **una sola cara por clip** (no alterna entre speakers). v1 trunca audios >~5s y taggea mal la rotación; **usar v1.5** (hasta 60s, 720/1080p).
- **Veo 3.1** (lite/fast): mueve labios **+ fondo**, pero **solo si la cara es grande (close-up)** y le pedís por prompt *"que [personaje] diga: '…'"*. En plano general con caras chicas, no anima la boca.

### La regla de oro
**El diálogo se filma en CLOSE-UP del que habla.** Cara grande → cualquier modelo de labios funciona. Cortar entre close-up de A (su línea) y close-up de B (su línea) es **plano-contraplano**, lenguaje normal de diálogo — NO se lee como "cambio de escena". Lo que se ve mal es usar dos **planos generales distintos** para las dos líneas.

## Modos de diálogo (elegibles por escena)
| Modo | Cómo | Lips | Cuándo |
|---|---|---|---|
| **A) Plano-contraplano** (default) | close-up de A (su línea) → close-up de B (su línea), anclados al master | **exactos** (una cara c/u) | la mayoría de los diálogos |
| **B) Un solo plano secuencial** | Veo: *"primero habla A (mueve boca) '…', después B (mueve boca) '…'"* + ElevenLabs encima por tiempo | aproximados | cuando no querés cortar / interacción física entre los dos |

- **Un solo speaker** en el plano → OmniHuman v1.5 o Veo lite directo (una cara, audio/prompt).
- **Plano sin diálogo** (ambiente, establishing, insert, de espaldas, voz en off) → **Kling turbo** (movimiento, sin labios) + voz en off mezclada con FFmpeg.

## Selector por plano (lo que se construye en el tool)
Dos perillas por plano en el paso **Animar**:
1. **Modelo**: Kling turbo · Veo 3.1 lite · Veo 3.1 fast · OmniHuman v1.5 · Kling AI Avatar std.
2. **Modo diálogo**: 1 speaker · plano-contraplano (A) · secuencial (B).

**Routing default** (para no pensar cada plano):
| Tipo de plano | Default |
|---|---|
| Sin diálogo (ambiente/establishing/insert/espaldas/VO) | **Kling turbo** |
| Close-up con diálogo (1 speaker) | **Veo 3.1 lite** |
| Cara estilizada difícil / donde Veo falla | **OmniHuman v1.5** (o Kling Avatar std) |
| Diálogo de a dos | **Modo A** (plano-contraplano) por default; **B** opcional |

## Consistencia = master-reference (`@img1`)
Todos los planos (establishing + close-ups) se **anclan a una imagen master** de la escena → mismo personaje, misma ropa, mismo fondo, misma luz. Sin esto, cada close-up drifta. Es la Fase 6→7 del SOP.

## La voz: SIEMPRE ElevenLabs
- La voz sale de **ElevenLabs** (acento LATAM/mexicano), nunca la nativa de Veo/Seedance (tira a neutro/inglés).
- **OmniHuman/Kling Avatar** (audio-driven): le pasás el audio de ElevenLabs y ya sincroniza — el output trae la voz.
- **Veo** (prompt-driven): genera su audio (se descarta), y le **mezclás ElevenLabs encima** timeado a la duración del clip.
- IDs PROMAN: mujer `kl7d390GatBPfqhRTyAl`, hombre `HMMu0XoIm7ib2e6V02E3`. (Falta voz de niño/adolescente — clonar para Emiliano/Fernanda.)

## Costos reales (Fal, Ago 2026)
| Modelo | $/seg | Duración | Mueve labios |
|---|---|---|---|
| **Veo 3.1 lite** 720p sin audio | **$0.03** | flexible | ✅ (prompt, cara grande) |
| Veo 3.1 lite 720p con audio | $0.05 | flexible | ✅ |
| **Kling AI Avatar v2 std** | **$0.056** | = audio | ✅ (audio) |
| Kling AI Avatar v2 pro | $0.115 | = audio | ✅ |
| sync-lipsync v2 pro | $0.083 | = video | ❌ sobre estilizado |
| **Kling v2.5 turbo** | ~$0.07 ($0.35/5s +$0.07/s) | 5/10s | ❌ (solo fondo) |
| OmniHuman v1 | $0.14 | ≤~5s | ✅ (trunca largo) |
| Veo 3.1 fast | $0.15 | 8s fijos | ✅ (prompt, cara grande) |
| **OmniHuman v1.5** | $0.16 | ≤60s | ✅ (cualquier cara, fondo quieto) |
| Seedance ref-to-video | ~$0.30 | — | regenera voz (evitar) |
| ElevenLabs TTS | ~$0.15/1k car | — | — |

**Referencia:** un video de ~40s con OmniHuman (diálogo) + Kling (ambiente) ≈ **$5-6**. El mismo con **Kling AI Avatar std / Veo lite** ≈ **$2-2.5**. Elegir modelo por plano es lo que baja el costo.

## Gotchas técnicos (ya resueltos — no repetir)
- **Kling Fal exige `image_url`** (no `start_image_url`). Con el campo mal, el job rebota al instante (inference ~0.02s, error 422) y no se cobra. → Fix pendiente en `backend/services/kling_video.py`.
- **OmniHuman v1** trunca audios largos y taggea `rotation=-90` (sale de costado al concatenar). → Usar **v1.5 720p**.
- **Concatenar mp3 de ElevenLabs con `ffmpeg concat -c copy`** deja mal la duración en el header → OmniHuman procesa solo la primera línea. → **Re-encodear** con el filtro concat + `libmp3lame`.
- **Concat de clips con distinta orientación/metadata**: normalizar SIEMPRE con `scale=720:1280,setsar=1,fps=30` por clip antes de concatenar; verificar el output con un frame extraído.
- Jobs que fallan (bug, saldo agotado, transitorios) **no se cobran**.

## Pipeline validado (end-to-end)
```
Guión → por escena, por SPEAKER:
  1. Master-ref de la escena (Fase 6, se aprueba)
  2. Frames anclados al master: establishing (wide) + close-up de cada speaker
  3. Animar por plano (selector):
       - close-up con diálogo → Veo lite / OmniHuman v1.5 (labios)
       - ambiente/insert/espaldas/VO → Kling turbo
       - diálogo de a dos → modo A (contraplano) o B (Veo secuencial)
  4. Voz ElevenLabs (audio-driven ya sincroniza; Veo → mezclar encima)
  5. Concat normalizado (scale 720x1280 + setsar + fps) → verificar orientación
```
