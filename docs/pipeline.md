# Coevo Studio — Content Generation Pipeline

---

## Vision General

El pipeline esta disenado como una **"Content Factory Context-Aware"** donde cada herramienta hereda automaticamente el contexto de la marca seleccionada (assets, prompts, brand guidance).

### Filosofia Core

1. **Context-First**: Toda generacion usa el contexto completo de la marca
2. **Asset-Driven**: Los assets (avatar, producto, ropa, fondo) son los inputs visuales
3. **Multishot Curation**: Generar variaciones y que el usuario elija la mejor
4. **Human-in-the-Loop**: Puntos de revision humana en pasos clave (script, base image, curation)
5. **Test Before Commit**: Test video en base image antes de gastar en multishot/lipsync
6. **Cost-Efficient**: Solo animar las tomas aprobadas

---

## UGC Creator — Pipeline Completo

### Flow

```
Form (avatar + product + clothing + background + voice + objective)
    ↓
1. Script (Gemini) → review/approve
    ↓ auto
2. Base Image (Nano Banana 2) → review/edit/test video/approve
    ↓ auto
3. Multishot (Nano Banana 2 x scenes) → 
    ↓
4. Curation (manual selection + listen audio) → approve
    ↓ auto
5. Voice (ElevenLabs - genera faltantes)
    ↓ auto
6. Lipsync (HeyGen Avatar 4 via Fal)
    ↓ auto
7. Render (FFmpeg concat + subtitulos)
    ↓
8. Video final con player + download
```

### Fase 1: Script Generation (Gemini 2.5 Flash)

**Servicio**: `copy_gen.py` + `prompt_builder.py`

**Inputs**: Brand context, avatar, producto, ropa, fondo, objetivo del video

**Proceso**: 
- PromptBuilder ensambla el prompt de 3 capas (default → brand override → variables)
- Gemini genera 4 actos: Hook → Story 1 → Story 2 → CTA
- Cada acto tiene: script (texto hablado) + image_prompt (para Nano Banana)

**Output**: JSON array con `id`, `title`, `script`/`speech`, `image_prompt`

**Review**: El usuario ve el guion completo + el image prompt de la Scene 1. Puede aprobar o regenerar.

### Fase 2: Base Image (Nano Banana 2/edit via Fal)

**Servicio**: `image_gen.py`

**Inputs** (en orden):
- Image 1: Avatar (cara/cuerpo)
- Image 2: Clothing (ropa que lleva puesta)
- Image 3: Product (lo que muestra/sostiene)
- Image 4: Background (si hay)
- Prompt: el `image_prompt` de Scene 1

Si `productIsWorn = true`: product va como image 2 (ropa) en vez de image 3.

**Proceso**: Nano Banana genera una imagen combinando todas las referencias

**Review**: 
- El usuario ve la imagen + inputs usados (con thumbnails)
- Puede **Edit** (mandar instrucciones a Nano Banana)
- Puede **Listen** (escuchar el audio de Scene 1 generado con ElevenLabs)
- Puede **Test video** (mandar imagen + audio a HeyGen para ver como queda animado)
- Puede **Regenerar** o **Aprobar**

### Fase 3: Multishot (Nano Banana 2 x variaciones)

**Referencia**: Solo la base image aprobada (1 imagen)

**Proceso**:
- Scene 1 = base image directa (sin variaciones)
- Scenes 2-4 = 2 variaciones cada una con diferentes angulos de camara
- Cada variacion define: lens, depth of field, composicion, pose
- Siempre: misma persona, misma ropa, mismo producto, misma iluminacion

**Variaciones**:
| Tipo | Lens | Descripcion |
|------|------|-------------|
| Tight close-up | 50mm f/1.4 | Face fills frame, shallow DoF |
| Medium wide | 35mm f/1.8 | Torso + environment, off-center |
| Low angle | 24mm f/2.0 | Camera baja, autoridad |
| Product focus | 85mm f/1.8 | Producto en foco, persona blurred |
| Side angle | 35mm f/2.0 | Rule of thirds, cuerpo angulado |
| Over shoulder | 28mm f/2.8 | Como filmado por amigo |

### Fase 4: Curation (Manual)

**UI**: Por cada escena:
- El script text de la escena
- Boton **Listen** (genera TTS on-demand con ElevenLabs, voice ID del form)
- Boton **Regenerate audio**
- Grid de variaciones clickeables para seleccionar
- **Edit** por variacion (manda a Nano Banana con instrucciones)
- **Regenerate** por variacion

**Approve**: Guarda las selecciones + avanza automaticamente a voice + lipsync

### Fase 5: Voice (ElevenLabs)

**Servicio**: `tts.py` + endpoint `/api/tts/generate-and-upload`

**Proceso**: Genera audios faltantes (los que no se generaron en curation)

### Fase 6: Lip-Sync (HeyGen Avatar 4 via Fal)

**Servicio**: `heygen_avatar4.py`

**Proceso por escena**:
1. Backend genera TTS con ElevenLabs (voice ID seleccionado)
2. Backend sube audio a Fal Storage (con FAL_KEY)
3. Manda a HeyGen: `image_url` + `audio_url` + `talking_style: "expressive"`
4. HeyGen genera video con lip-sync

**Output**: Video por escena con la persona hablando

### Fase 7: Render (FFmpeg)

**Servicio**: `video_concat.py`

**Proceso**:
1. Descarga todos los videos de HeyGen
2. Normaliza a H.264/AAC/30fps
3. Concatena con FFmpeg
4. Agrega subtitulos word-by-word (3 palabras cada chunk, estilo TikTok)
5. Genera video final

**Output**: MP4 con player + boton Download

---

## Otras Tools

### Product Spotlight / Fashion Editorial
Pipeline: `prompt → generate → variations`
- Prompt step: Gemini genera image_prompt usando PromptBuilder
- Generate step: Nano Banana crea la imagen
- Variations step: N variaciones de la aprobada

### Fashion Reels
Pipeline: `script → base_image → multishot → curation → animate`
- Similar a UGC pero el animate step usa Kling V2.6 en vez de HeyGen

### Ad Creative / Social Post / Product Photos
Pipeline: `prompt → generate` o `caption → image`
- Mas simples, 2-3 pasos

---

## PromptBuilder (3 Capas)

```
Layer 1: Tool Default     →  backend/tools/{tool_id}/default_prompt.txt
Layer 2: Brand Override   →  brand.promptOverrides[tool_id]  (desde Brand Kit)
Layer 3: Dynamic Vars     →  {brand_name}, {avatars}, {products}, etc.
```

### Variables Disponibles

| Variable | Source |
|----------|--------|
| `{brand_name}` | Brand name |
| `{brand_guidance}` | Brand context |
| `{avatars}` | Lista de avatares |
| `{products}` | Lista de productos |
| `{clothing}` | Lista de ropa |
| `{backgrounds}` | Lista de fondos |
| `{voices}` | Lista de voice presets |
| `{video_objective}` | Objetivo del video (del form) |
| `{selected_clothing}` | Ropa seleccionada (para tools con prompt step) |
| `{selected_background}` | Fondo seleccionado |
| `{selected_accessory}` | Accesorio seleccionado |
| `{pose_direction}` | Direccion de pose (fashion editorial) |
| `{location_reference}` | Referencia de locacion |
| `{style_reference}` | Referencia de estilo |

### Bloques Condicionales

```
{?clothing}
━━━ WARDROBE ━━━
{clothing}
{/clothing}
```

Solo se incluye si la variable tiene contenido.

---

## Cost Strategy

| Fase | Costo | Nota |
|------|-------|------|
| Script | Bajo | Gemini 2.5 Flash |
| Base Image | ~$0.01 | Nano Banana 2 |
| Multishot (6 imgs) | ~$0.06 | Nano Banana 2 x 6 |
| Voice (4 scenes) | Bajo | ElevenLabs |
| Lipsync (4 scenes) | ~$0.40/s x 4 | HeyGen Avatar 4 — el mas caro |
| Render | Gratis | FFmpeg local |

**Ahorro**: Test video en base image antes de multishot. Solo animar tomas aprobadas.
