# Editor de video — timeline compartido

Un solo editor con timeline, que reemplaza el paso **Render** de las tools de video y
también se abre con cualquier video suelto.

**Estado:** propuesta, sin implementar.
**Fecha:** 2026-10-03
**Depende de:** [workspace-template.md](workspace-template.md) (el canvas nunca desaparece) ·
[fashion-reel-recipes.md](fashion-reel-recipes.md) (los comentarios validan recetas) ·
[tools-audit.md](tools-audit.md) (por qué no es una tool).

**Referencia:** el editor "Rubric" de Jay E (RoboNuggets), visto en *"Turn Claude Into a
Video Editing GENIUS"*: timeline con clips, script sincronizado y comentarios por
timestamp que vuelven a Claude para corregir y calibrar la skill.

---

## 1. El problema

Las 4 tools que generan video terminan igual:

| Tool | Pipeline |
|---|---|
| `fashion_reel` | script → base_image → multishot → animate → **render** |
| `product_clip` | script → base_image → images → animate → **render** |
| `ugc_creator` | script → base_image → multishot → voice → lipsync → **render** |
| `video_ad_creator` | script → character → base_image → images → voice → animate → lipsync → **render** |

Y ese **render es ciego**: `video_concat.concat_videos` pega los clips en el orden en que
salieron. No se puede:

- ver los clips **juntos**, como pieza, antes de exportar
- recortar el inicio o el final de un clip
- reordenar, o sacar uno que salió mal
- decir *"este clip, corregilo"* sin regenerar la corrida entera

Fashion Reel en modo Looks arma *outfit × tomas = escenas* y las concatena sin que las
veas en conjunto. Cualquier corrección es volver atrás en el wizard.

---

## 2. La decisión: un editor, dos puertas

**No va dentro de cada tool** — serían 4 copias, el mismo error que el `Control` duplicado
de Campañas (ver `decisions-log.md`).

**No es una tool** — por el criterio de `tools-audit.md` no genera nada: es la etapa
final de lo que generan las otras.

Es un **componente compartido** (como `SelectorPanel`), con dos entradas:

| Puerta | Cuándo | Qué carga |
|---|---|---|
| **Paso Render de cada tool** | terminó de generar | los clips de esa corrida, en orden, en el timeline |
| **"Abrir en editor"** | desde Content o el Lab | cualquier video suelto |

El editor **reemplaza** el paso Render: en vez de "Render → MP4", es *"acá están tus
clips en un timeline → ajustá → exportá"*.

---

### 2b. Y Campañas: es el destino, no un timeline

Las campañas **ya admiten piezas de video** (`CampaignPiece.type: "image" | "video"`), y
`CampaignDetailPage.tsx` lo dice explícito: *"si un video conviene hacerlo en otro lado,
igual pertenece a este pedido"*. La campaña no genera video; es **donde termina**.

| | Rol con el editor |
|---|---|
| Tools de video | **origen** — su Render abre el editor con los clips |
| Campaña | **destino** — lo que se exporta queda como pieza de video de la campaña |
| Campaña | **puerta** — una pieza de video de la campaña se abre en el editor para otra vuelta |

```
Campaña Koxis Septiembre
   └─ Fashion Reel genera los clips
         └─ Render = editor (recortar, comentar, regenerar)
               └─ Exportar → vuelve a la campaña como pieza
                     └─ "Abrir en editor" desde la campaña → otra vuelta
```

⚠️ **La campaña NO se vuelve un timeline.** Es un conjunto de entregables (ej. 12 piezas
en 9:16, 4:5 y 1:1 que se publican por separado), no una secuencia: se ve como grilla.
Forzarla a timeline rompe las dos cosas.

**Reusar `history[]`.** Las piezas de campaña ya guardan versiones: regenerar empuja la
URL actual a `history` en vez de pisarla. El editor necesita exactamente eso al regenerar
un clip — se usa el mismo mecanismo, no uno nuevo. Resuelve además el punto 3 de §8: si
el clip regenerado sale peor, se vuelve al anterior.

---

## 3. Lo que lo diferencia: el comentario va al clip correcto

En el editor de Jay, los comentarios vuelven a Claude como **texto**. En Coevo pueden
hacer algo que él no puede, porque **cada clip sabe de dónde salió**:

```ts
// Ya existe hoy en fashion_reel/handlers.ts
{ sceneId, title, videoUrl, imageUrl, shotId }
```

Entonces un comentario no es una nota suelta, es una **acción sobre el pipeline**:

```
Comentás sobre el clip 3, en 0:02: "menos movimiento, se le deforma la mano"
   → se regenera SOLO el paso `animate` de la escena 3
   → con el prompt corregido por el comentario
   → el clip nuevo reemplaza al viejo en el mismo lugar del timeline
```

Y el comentario **se guarda en la receta que generó ese clip**. Así las recetas se validan
con uso real, que es justo lo que les falta (todas están "sin validar", ver
`fashion-reel-recipes.md` §7).

Es el mismo ciclo que mostraba Jay —cada corrección hace mejor al siguiente video— pero
atado a la estructura del pipeline en vez de a un chat.

---

## 4. La pantalla

Aplica el principio del template —**el canvas nunca desaparece**— con una zona distinta:
acá el canvas es el reproductor y el control principal es el timeline.

```
┌──────────────────────────────────────────────────────────────────────┐
│  ← Fashion Reel · Koxis Septiembre                   ⚙  Exportar     │  HEADER
├──────────────────────────────────────────────┬───────────────────────┤
│                                              │  COMENTARIOS          │
│              ┌──────────────┐                │                       │
│              │              │                │  0:02 · clip 3        │
│              │  REPRODUCTOR │                │  menos movimiento,    │
│              │    9:16      │                │  se deforma la mano   │
│              │              │                │  [Regenerar clip]     │
│              └──────────────┘                │                       │
│         ▶  0:04.2 / 0:18.0     1×           │  + comentar acá       │
├──────────────────────────────────────────────┴───────────────────────┤
│  ✂ Cortar   ⎌ Deshacer   ⊟ Ocultar cortes          0:18 · −  Ajustar + │  BARRA
│  0:00      0:04      0:08      0:12      0:16                         │
│  ┃▓▓▓▓▓▓▓▓┃▓▓▓▓▓▓┃▓▓▓▓▓▓▓▓▓▓┃▓▓▓▓▓▓┃                                  │  VIDEO
│  ┃clip 1  ┃clip 2┃ clip 3 ● ┃clip 4┃                                  │
│  ┃∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿┃                                  │  AUDIO
└──────────────────────────────────────────────────────────────────────┘
```

- **Reproductor** arriba al centro. Es el canvas.
- **Comentarios** a la derecha, ordenados por timestamp. Cada uno con su acción.
- **Timeline** abajo, con los clips como miniaturas y la forma de onda del audio.
- El `●` en el clip 3 marca que tiene un comentario pendiente.

---

## 5. Primera versión — qué entra

| Capacidad | Por qué entra ya |
|---|---|
| Reproductor con scrub | es el canvas |
| Clips en orden, como miniaturas | ver la pieza entera es el problema #1 |
| Recortar inicio / fin de un clip | lo más pedido; sin regenerar nada |
| Reordenar y borrar clips | idem |
| Comentar en un timestamp | la base del ciclo de corrección |
| **Regenerar ese clip** desde el comentario | lo que lo diferencia (§3) |
| Exportar | ya existe: `video_concat.concat_videos` |

## 6. Para después

| Capacidad | Nota |
|---|---|
| Capa de texto y gráficos de marca (precio, nombre de prenda, logo) | video por código (HTML/JS → render cuadro a cuadro), con el design system de la marca. Resuelve que el texto en video generativo se deforma. **Plan en dos niveles (manual → IA) y Remotion vs HyperFrames:** `openspec/changes/archive/2026-10-09-shared-video-editor/design.md` §7 |
| Varias pistas de audio (voz + música) | `video_concat.overlay_audio` ya mezcla una |
| Transiciones | |
| Corte automático de talking heads (tomas falsas, silencios) | transcripción con `services/stt.py`; para UGC |
| Script sincronizado al lado, como en el editor de Jay | para UGC y Video Ad, que tienen guion hablado |

---

## 7. Por qué tiene potencia

No es una feature para Fashion Reel: es **la salida común de todo el video** de Coevo.

1. **Lo usan las 4 tools de video** desde el día uno, y Lab/Content por la segunda puerta.
2. **Cierra el ciclo de las recetas.** Hoy no hay forma de validarlas con uso real; con el
   editor, cada comentario es un dato sobre qué funciona.
3. **Baja el costo de corregir.** Hoy un error en un clip = volver atrás en el wizard.
   Con el editor = regenerar un clip (~$0.56 en Kling V3 Pro) en vez de la corrida.
4. **Es la base de la capa de marca.** Los overlays por código necesitan un timeline donde
   vivir; sin editor no tienen dónde ir.
5. **Es lo que se ve en una demo.** Para el escenario SaaS / artistas de IA, un timeline
   con comentarios que corrigen solos es lo que hace que esto parezca un producto y no
   una colección de generadores.

---

## 8. Lo no resuelto

| # | Qué | Por qué importa |
|---|---|---|
| 1 | **¿El editor persiste?** | Si cerrás la pestaña a mitad de edición, ¿se pierde? Hoy los pipelines persisten por paso; el estado del timeline (recortes, orden, comentarios) necesita su propio lugar |
| 2 | **Recortar en el front o en el backend** | Previsualizar recortes es fácil en el navegador; exportar requiere FFmpeg en el backend con los mismos puntos |
| 3 | **Regenerar un clip cambia su duración** | Si el clip nuevo dura distinto, ¿se mueven los de después? Probablemente sí, y los recortes del clip viejo se descartan. La versión anterior no se pierde: queda en `history[]` (§2b) |
| 4 | **Clips sin pipeline** (puerta 2) | Un video suelto no tiene `sceneId`: se puede comentar y recortar, pero no "regenerar". La UI tiene que mostrarlo |
| 5 | **Audio de UGC** | En UGC la voz va sincronizada con los labios; recortar un clip corta la frase. Puede necesitar bloquear el recorte en clips con lip-sync |

---

## 9. Orden de trabajo

1. **Editor de sólo lectura** dentro del Render de **Fashion Reel**: reproductor + timeline
   con los clips + exportar. Sin recortes todavía. Prueba que el componente entra en el
   pipeline sin romperlo.
2. Recortar, reordenar, borrar.
3. Comentarios por timestamp.
4. **Regenerar clip desde el comentario** — la parte que lo diferencia.
5. Las otras 3 tools de video.
6. Segunda puerta: "Abrir en editor" desde Content, Lab y las piezas de video de una **campaña**.
   Exportar desde una corrida que pertenece a una campaña → la pieza vuelve a esa campaña.
7. Recién ahí, la capa de marca por código (§6).
