# Coevo Creative OS — Tools Reference

Documentacion completa de todas las herramientas de generacion de contenido.

Cada tool usa el sistema **PromptBuilder de 3 capas**:
1. **Default Template** — `backend/tools/{tool_id}/default_prompt.txt`
2. **Brand Override** — editable desde Brand Kit > Prompts
3. **Dynamic Variables** — inyectadas automaticamente: `{brand_name}`, `{avatars}`, `{products}`, `{clothing}`, `{backgrounds}`, `{voices}`, etc.

---

## Tools Activas

### 1. UGC Creator

| | |
|---|---|
| **ID** | `ugc_creator` |
| **Categoria** | Video |
| **Pipeline** | Script → Base Image → Multishot → Curation → Voice → Lip-Sync → Subtitles → Render |
| **Servicios** | Gemini 2.5 Flash, Nano Banana 2, ElevenLabs, Kling V2.6, Fal Fabric 1.0, FFmpeg |

**Que hace**: Genera un video UGC completo de principio a fin. Desde el guion hasta el video final renderizado con lip-sync.

**Flujo**:
1. **Script** — Gemini genera 4 escenas (Hook, Story 1, Story 2, CTA) con script hablado + image prompt ultra-detallado. El usuario **revisa y aprueba** el guion antes de continuar.
2. **Base Image** — Nano Banana genera la imagen de la escena 1 usando avatar + producto + fondo como referencia.
3. **Multishot** — Genera imagenes para las escenas 2, 3, 4 usando la base image como referencia visual para consistencia.
4. **Curation** — Selecciona la mejor variacion por escena (actualmente auto-selecciona, Gemini Vision planned).
5. **Voice** — ElevenLabs genera audio TTS por cada escena con la voz seleccionada del brand kit.
6. **Lip-Sync** — Kling genera video base → Fal Fabric sincroniza labios con audio.
7. **Subtitles** — (Planned) Overlay de subtitulos desde el script.
8. **Render** — FFmpeg concatena todos los segmentos en un video final MP4.

**Inputs del usuario**:
- Avatar (del brand kit)
- Producto (del brand kit)
- Background/Fondo (del brand kit, opcional)
- Voz (voice preset del brand kit)
- Objetivo del video (texto libre)
- Tono (engaging, casual, professional, funny, inspirational)
- Plataforma (Instagram, TikTok, YouTube Shorts, Facebook)
- Idioma (Espanol, English)
- Numero de variaciones para multishot

**Reglas del prompt**:
- Image prompts SIEMPRE en ingles
- 5-8 oraciones por image prompt con: descripcion fisica exacta del sujeto, ropa, pose, gesto, angulo de camara, framing, iluminacion, entorno, paleta de colores
- Estetica iPhone-shot, ultra-realista, 4K, skin texture visible, shallow depth of field
- El sujeto SIEMPRE mira a camara (eye contact)
- Producto claramente visible cuando se presenta

**Output**: Video MP4 vertical (9:16) de 15-30 segundos, guardado en Content Library.

---

### 2. Product Spotlight

| | |
|---|---|
| **ID** | `product_spotlight` |
| **Categoria** | Images |
| **Pipeline** | Prompt → Generate → Variations |
| **Servicios** | Gemini 2.5 Flash, Nano Banana 2 |

**Que hace**: Fotografia profesional de producto en contexto. Coloca tu producto en cualquier setting con iluminacion y composicion de estudio.

**Flujo**:
1. **Prompt** — Gemini genera un prompt de fotografia comercial profesional. El usuario revisa y aprueba.
2. **Generate** — Nano Banana crea la imagen base usando producto + fondo como referencia.
3. **Variations** — Genera N variaciones con diferentes angulos y composiciones.

**Inputs del usuario**:
- Producto (del brand kit)
- Background/Fondo (del brand kit, opcional)
- Descripcion del setting (texto libre, ej: "mesa rustica en cafe con luz de manana")
- Numero de variaciones

**Reglas del prompt**:
- El producto es el HEROE de la imagen
- Composicion profesional: rule of thirds, golden ratio, negative space para texto
- Iluminacion de estudio: soft key light, fill, rim light, consistent color temperature
- Texturas exactas del material: trama de tela, grano de cuero, brillo metalico
- Calidad 8K de fotografia comercial
- Suitable para e-commerce, social media, y print advertising

**Output**: Imagen hero + variaciones, guardadas en Content Library.

---

### 3. Fashion Editorial

| | |
|---|---|
| **ID** | `fashion_editorial` |
| **Categoria** | Images |
| **Pipeline** | Prompt → Generate → Variations |
| **Servicios** | Gemini 2.5 Flash, Nano Banana 2 |

**Que hace**: Fotografia editorial de moda de alto nivel. Avatar + garments + direccion de pose con iluminacion y styling profesional.

**Flujo**:
1. **Prompt** — Gemini genera un prompt editorial con 8-12 oraciones de detalle.
2. **Generate** — Nano Banana crea la foto editorial usando avatar + clothing como referencia.
3. **Variations** — Genera N variaciones manteniendo consistencia visual.

**Inputs del usuario**:
- Avatar/Modelo (del brand kit)
- Clothing/Garments (del brand kit)
- Producto/Accesorios (del brand kit, opcional)
- Background/Location (del brand kit, opcional)
- Direccion de pose (texto libre, ej: "confident power stance, hand in pocket")
- Referencia de logo de marca (opcional)

**Reglas del prompt**:
- Poses naturales, editoriales — NO stock photography
- Body language que cuenta una historia: poder, ease, movimiento, contemplacion
- Eye contact con camara O gaze direction intencional
- Manos naturales: holding something, resting, gesturing subtly
- Garments deben verse styled by a professional fashion stylist
- Fabric behavior natural: peso, draping, creasing, movimiento
- Iluminacion profesional de moda: Rembrandt, butterfly, split, o natural editorial
- Entorno clean, intencional, editorial — nunca cluttered
- Skin texture real con poros visibles, subtle imperfections
- Calidad 8K de fotografia de campana de moda
- Indistinguible de una foto real de campana de moda

**Output**: Foto editorial + variaciones, guardadas en Content Library.

---

### 4. Fashion Reels

| | |
|---|---|
| **ID** | `fashion_reels` |
| **Categoria** | Video |
| **Pipeline** | Script → Base Image → Multishot → Curation → Animate |
| **Servicios** | Gemini 2.5 Flash, Nano Banana 2, Kling V2.6 |

**Que hace**: Reels de transicion de outfits: misma modelo, mismo lugar, multiples looks. Multishot + animacion Kling para contenido de moda.

**Flujo**:
1. **Script** — Gemini planea 3-6 looks (uno por outfit disponible). Cada look tiene descripcion del outfit + image prompt con consistencia de modelo y locacion.
2. **Base Image** — Genera la imagen del Look 1 como referencia visual.
3. **Multishot** — Genera imagenes para los demas looks usando Look 1 como referencia para mantener consistencia total.
4. **Curation** — Selecciona el mejor frame por look.
5. **Animate** — Kling V2.6 anima cada frame con movimiento sutil (sway, pose transition) para crear el efecto de transicion de outfits.

**Inputs del usuario**:
- Avatar/Modelo (del brand kit)
- Clothing items (del brand kit — cada item = un look)
- Background/Location (del brand kit o descripcion)
- Referencia de spot (imagen, opcional)
- Numero de variaciones

**Reglas del prompt**:
- La modelo se ve IDENTICA en cada frame (misma cara, body type, skin tone, pelo)
- Solo cambia el outfit entre shots
- Misma posicion corporal relativa a camara (variaciones sutiles de pose)
- Misma distancia y angulo de camara en todos los frames
- Iluminacion CONSISTENTE en todos los frames
- Full body o 3/4 shot — MISMO framing en cada frame
- Color grading consistente (mismo edit/look)
- Vertical 9:16 para Reels/TikTok
- Calidad 8K de campana de moda

**Output**: Video reel con transiciones de outfits animadas, guardado en Content Library.

---

### 5. Product Photos (Photo Multishot)

| | |
|---|---|
| **ID** | `photo_multishot` |
| **Categoria** | Images |
| **Pipeline** | Prompt → Generate |
| **Servicios** | Gemini 2.5 Flash, Nano Banana 2 |

**Que hace**: Genera multiples variaciones creativas de fotos de producto desde una imagen base.

**Reglas del prompt**:
- Genera N conceptos distintos de foto
- Varia en: angulo, iluminacion, styling, mood, composicion
- Incluye al menos un lifestyle shot y un studio shot limpio
- Image prompts detallados (lighting setup, camera angle, surface material, color palette)

**Output**: Array de variaciones de imagen.

---

### 6. Ad Creative

| | |
|---|---|
| **ID** | `ad_creative` |
| **Categoria** | Images |
| **Pipeline** | Prompt → Generate |
| **Servicios** | Gemini 2.5 Flash, Nano Banana 2 |

**Que hace**: Genera creatividades publicitarias con copy + imagen + composicion.

**Reglas del prompt**:
- Cada variacion incluye: headline, body copy, CTA, e image prompt
- Copy conciso y apropiado para la plataforma
- Image prompt describe la composicion completa del ad (product placement, text overlay areas, background)
- Mantiene brand voice e identidad visual

**Output**: Creatividad publicitaria con copy + imagen.

---

### 7. Social Post

| | |
|---|---|
| **ID** | `social_post` |
| **Categoria** | Copy |
| **Pipeline** | Caption → Image |
| **Servicios** | Gemini 2.5 Flash, Nano Banana 2 |

**Que hace**: Genera captions e imagenes para posts de redes sociales.

**Reglas del prompt**:
- Captions nativos de la plataforma (no corporativos, no salesy)
- 5-10 hashtags relevantes
- Image prompt visualmente compelling
- Mantiene el tono y voz de la marca

**Output**: Caption con hashtags + imagen.

---

## Tools Coming Soon

### 8. Reel Creator

| | |
|---|---|
| **ID** | `reel_creator` |
| **Categoria** | Video |
| **Pipeline** | Script → Scenes → Music → Subtitles → Render |
| **Estado** | Coming Soon |

**Que hace**: Crea reels de video cortos con escenas, musica y subtitulos.

---

### 9. Background Remover

| | |
|---|---|
| **ID** | `bg_remover` |
| **Categoria** | Images |
| **Pipeline** | Remove |
| **Estado** | Coming Soon |

**Que hace**: Remueve el fondo de fotos de producto usando segmentacion AI.

---

## Sistema de Prompts

### 3 Capas de Resolucion

```
Layer 1: Tool Default     →  backend/tools/{tool_id}/default_prompt.txt
Layer 2: Brand Override   →  brand.promptOverrides[tool_id] (editable en Brand Kit)
Layer 3: Dynamic Vars     →  {brand_name}, {brand_guidance}, {avatars}, {products}, etc.
```

### Variables Disponibles

| Variable | Descripcion |
|----------|-------------|
| `{brand_name}` | Nombre de la marca |
| `{brand_guidance}` | Texto de brand context |
| `{avatars}` | Lista formateada de avatars con descripciones y tags |
| `{products}` | Lista formateada de productos |
| `{clothing}` | Lista formateada de ropa/wardrobe |
| `{backgrounds}` | Lista formateada de fondos/escenarios |
| `{voices}` | Lista de voice presets |
| `{video_objective}` | Objetivo del video (pasado por el usuario) |
| `{tone}` | Tono seleccionado |
| `{platform}` | Plataforma target |
| `{language}` | Idioma del script |
| `{num_variations}` | Numero de variaciones a generar |

### Bloques Condicionales

Solo se incluyen si la variable tiene contenido:

```
{?avatars}
AVATARS DISPONIBLES:
{avatars}
{/avatars}
```

### Editar Prompts por Marca

En Brand Kit → Prompts, se puede:
- Ver el prompt default de cada tool
- Crear un override especifico para la marca
- Preview del prompt interpolado con las variables reales
- Reset a default

---

## Endpoint Generico

`POST /api/tools/generate-prompt` funciona con **cualquier tool**:

```json
{
  "brandId": "taller-santa-clara",
  "toolId": "product_spotlight",
  "userMessage": "Product: Hoodie Chocolate\nSetting: rustic cafe table with morning light",
  "extraVariables": {
    "tone": "warm",
    "platform": "instagram"
  }
}
```

Respuesta:
```json
{
  "result": {
    "image_prompt": "An exquisitely composed 3/4 shot of a Hoodie Chocolate...",
    "title": "Hoodie Chocolate - Morning Cafe"
  },
  "model": "gemini-2.5-flash"
}
```

---

## Reglas Globales de Image Prompts

Todas las tools comparten estas reglas para image prompts:

1. **Siempre en ingles** — los modelos de imagen funcionan mejor con prompts en ingles
2. **Ultra-realista** — 4K/8K detail, natural skin texture con poros visibles, no AI artifacts
3. **Sin manos deformadas** — especificar posicion natural de manos
4. **Fabric physics reales** — peso, draping, tension, light interaction
5. **Iluminacion profesional** — siempre especificar tipo, direccion, temperatura de color
6. **Composicion intencional** — shot type, camera angle, depth of field, framing
7. **Eye contact** — en UGC y editorial, el sujeto mira a camara (salvo indicacion contraria)
8. **Vertical 9:16** — para contenido de video/reels
