# Coevo Creative OS — Content Generation Pipeline

Este documento describe la arquitectura del pipeline de generación de contenido adaptado para Coevo Creative OS como herramienta interna de agencia.

---

## Visión General

El pipeline está diseñado como una **"Fábrica de Contenido Context-Aware"** donde cada herramienta hereda automáticamente el contexto de la marca seleccionada (assets, prompts, brand guidance, briefs).

### Filosofía Core

1. **Context-First**: Toda generación usa el contexto completo de la marca
2. **Asset-Driven**: Los assets (avatar, producto, ropa, fondo) son dinámicos y seleccionables
3. **Multishot Curation**: Generar múltiples variaciones y seleccionar la mejor antes de animación
4. **Human-in-the-Loop**: Puntos de revisión humana en pasos clave
5. **Cost-Efficient**: Gastar recursos de procesamiento solo en contenido curado

---

## Tipos de Herramientas

### 1. Static Content Generation
**Para**: Posts de redes sociales, ads estáticos

**Pipeline**:
```
Brand Context Loading
    ↓
User selects:
  - Avatar (from brand's avatars)
  - Product (from brand's products)
  - Clothing (optional, from brand's wardrobe)
  - Background (optional, from brand's backgrounds)
    ↓
Gemini generates prompt using:
  - Tool template for static content
  - Brand guidance
  - Asset descriptions
    ↓
Nano Banana 2 generates image
    ↓
Human review & approval
    ↓
Output: High-quality static image
```

**Inputs Dinámicos**:
- Avatar con descripción ("Modelo masculino 30 años, casual urbano")
- Producto con nombre y categoría
- Ropa (opcional): descripción del outfit
- Fondo (opcional): escena o background precargado

**Output**: Imagen estática de alta calidad lista para publicación

---

### 2. Video Reels
**Para**: Reels de Instagram/TikTok con producto

**Pipeline**:
```
Brand Context Loading
    ↓
User selects:
  - Avatar
  - Product
  - Scene type (lifestyle, demo, unboxing, etc.)
    ↓
Gemini generates:
  - Video concept
  - Scene descriptions
  - Motion prompts
    ↓
Kling generates video clips
    ↓
FFmpeg composes final reel:
  - Add transitions
  - Add captions (optional)
  - Add music (optional)
    ↓
Human review & approval
    ↓
Output: 15-30s vertical video
```

**Inputs Dinámicos**:
- Avatar
- Producto
- Tipo de escena
- Duración target
- Música/audio (opcional)

**Output**: Video reel vertical listo para publicación

---

### 3. UGC Videos (Full Pipeline)
**Para**: Videos de tipo "user-generated content" con avatar hablando

Este es el pipeline más complejo y sigue la metodología Morfeo mejorada.

#### Fase 1: Script Generation (Gemini 2.5 Flash)

**Inputs**:
- Brand guidance document
- Active campaign brief (si existe)
- Producto a promocionar
- Avatar seleccionado
- Duración target

**Proceso**:
```
Gemini recibe prompt estructurado:
  "Genera un guión UGC de {duration} segundos para {brand_name}.

   Brand Context:
   {brand_guidance}

   Campaign Brief:
   {active_brief}

   Producto: {product_name} - {product_description}
   Avatar: {avatar_description}

   Estructura requerida (5 actos):
   1. Hook (3s) - Gancho de alto impacto
   2. Story 1 (5-7s) - Desarrollo del problema/contexto
   3. Story 2 (5-7s) - Producto como solución
   4. Plot Twist (3-5s) - Giro viral
   5. CTA (2-3s) - Llamado a la acción"
```

**Output**:
```json
{
  "scenes": [
    {
      "act": "hook",
      "duration": 3,
      "script": "¿Sabías que el 80% de las remeras pierden forma después del primer lavado?",
      "visualPrompt": "Close-up del avatar con expresión sorprendida, sosteniendo remera deformada"
    },
    {
      "act": "story1",
      "duration": 6,
      "script": "Yo probé decenas de marcas hasta que encontré Taller Santa Clara.",
      "visualPrompt": "Avatar en su closet mostrando diferentes remeras"
    },
    // ... más escenas
  ]
}
```

#### Fase 2: Multishot Image Generation (Nano Banana 2)

**Para cada escena del guión**:

1. **Generate Base Prompt**:
```
Gemini toma:
  - Visual prompt de la escena
  - Avatar description
  - Clothing description (si aplica)
  - Background preference (si aplica)
  - Product placement instructions
  - Brand visual style guide

→ Genera prompt optimizado para Nano Banana 2
```

2. **Generate Multiple Shots** (3-5 variaciones por escena):
```
Para cada escena:
  - Seed variation 1: ángulo frontal
  - Seed variation 2: ángulo 3/4
  - Seed variation 3: close-up
  - Seed variation 4: plano medio
  - (opcional) Seed variation 5: wide shot
```

**Output por escena**: 3-5 imágenes estáticas de alta calidad

#### Fase 3: AI Curation (Gemini Vision)

**Propósito**: Actuar como "Director de Fotografía" y seleccionar la mejor toma

**Proceso**:
```
Para cada set de variaciones:
  1. Gemini Vision analiza todas las imágenes
  2. Evalúa:
     - Iluminación y exposición
     - Composición y framing
     - Consistencia del avatar
     - Naturalidad de la pose
     - Claridad del producto
     - Expresión facial apropiada para el momento narrativo
  3. Asigna score a cada imagen (0-100)
  4. Selecciona la "toma ganadora"
  5. Explica el razonamiento
```

**Output**:
```json
{
  "scene_id": "hook",
  "winner": {
    "variation": 2,
    "score": 94,
    "reasoning": "Mejor iluminación facial, expresión natural, producto visible sin ser intrusivo"
  },
  "alternatives": [
    {"variation": 1, "score": 87, "reasoning": "..."},
    {"variation": 3, "score": 82, "reasoning": "..."}
  ]
}
```

**Human Checkpoint**:
- UI muestra todas las variaciones
- Destaca visualmente la selección de la IA
- Usuario puede:
  - ✅ Aprobar selección de IA
  - 🔄 Elegir otra variación
  - 🔁 Regenerar solo esta escena
  - ❌ Cancelar y revisar guión

#### Fase 4: Audio Generation (ElevenLabs)

**Para cada escena**:

1. Tomar script text de la escena
2. Usar voice preset de la marca (configurado previamente)
3. Generar audio con ElevenLabs
4. Guardar audio file por escena

**Output**: Audio MP3 por cada escena

#### Fase 5: Lip-Sync Animation (Fal Fabric 1.0)

**Clave**: Solo se anima la imagen curada ganadora de cada escena

**Proceso por escena**:
```
Input:
  - Imagen estática curada (de Fase 3)
  - Audio generado (de Fase 4)

Fal Fabric 1.0:
  - Analiza la imagen base
  - Sincroniza movimiento de labios con audio
  - Anima cabeza y expresiones faciales
  - Mantiene consistencia del avatar

Output:
  - Video segment (3-7s) con lip-sync perfecto
```

**Ventaja**: No se gasta procesamiento pesado en variaciones descartadas

#### Fase 6: Final Assembly (FFmpeg)

**Combinar todos los segmentos**:

```python
# Pseudo-código del proceso
segments = [
  "scene_hook_lipsync.mp4",     # 3s
  "scene_story1_lipsync.mp4",   # 6s
  "scene_story2_lipsync.mp4",   # 6s
  "scene_twist_lipsync.mp4",    # 4s
  "scene_cta_lipsync.mp4"       # 3s
]

ffmpeg.concat(segments)
  .add_transitions(crossfade=0.3)
  .add_captions(optional)
  .add_background_music(optional, volume=0.2)
  .render("final_ugc_video.mp4")
```

**Output**: Video UGC completo listo para publicación (20-30s)

---

## Brand Context Integration

### Cómo cada herramienta accede al contexto

**Backend Flow**:
```python
# Cuando user ejecuta tool dentro de una marca
@app.post("/api/brands/{brand_id}/tools/{tool_id}/run")
async def run_tool_with_context(brand_id: str, tool_id: str, params: dict):
    # 1. Load full brand context
    brand = load_brand(brand_id)
    brand_guidance = load_file(f"data/brands/{brand_id}/context/brand_guidance.md")
    active_brief = load_latest_brief(brand_id)  # optional

    # 2. Load tool-specific prompt template
    tool_prompt = load_tool_prompt(brand_id, tool_id)  # brand override or default

    # 3. Load selected assets
    avatar = brand.assets.avatars[params["avatar_id"]]
    product = brand.assets.products[params["product_id"]]
    clothing = brand.assets.clothing[params.get("clothing_id")]  # optional
    background = brand.assets.backgrounds[params.get("background_id")]  # optional

    # 4. Generate final prompt with Gemini
    final_prompt = await gemini_generate_prompt(
        template=tool_prompt,
        brand_name=brand.name,
        brand_guidance=brand_guidance,
        active_brief=active_brief,
        avatar_description=avatar.description,
        product_name=product.name,
        clothing_description=clothing.description if clothing else None,
        background_description=background.description if background else None,
        **params
    )

    # 5. Execute tool with generated prompt
    job_id = await execute_tool(tool_id, final_prompt, assets)

    return {"job_id": job_id, "status": "queued"}
```

### Asset Description Best Practices

**Avatars**:
```json
{
  "id": "avatar_elias",
  "filename": "elias_buzo_gris.png",
  "description": "Hombre de 32 años, argentino, piel morena clara, barba corta prolijada, cabello castaño corto con flequillo natural, viste buzo gris liso de algodón, estilo casual urbano, expresión amigable y cercana",
  "tags": ["masculino", "30s", "casual", "urbano", "argentino"],
  "imageUrl": "/static/brands/taller-santa-clara/avatars/avatar_elias.png"
}
```

**Products**:
```json
{
  "id": "prod_remera_blanca",
  "filename": "remera_blanca_basica.png",
  "name": "Remera Essential White",
  "category": "remeras",
  "description": "Remera blanca de algodón orgánico, fit regular, cuello redondo clásico, textura suave y durable",
  "imageUrl": "/static/brands/taller-santa-clara/products/remera_blanca.png"
}
```

**Clothing/Wardrobe**:
```json
{
  "id": "outfit_buzo_gris",
  "filename": "buzo_gris.png",
  "description": "Buzo gris medio de algodón, cuello redondo, fit relajado, estilo minimalista",
  "tags": ["buzo", "gris", "casual"],
  "imageUrl": "/static/brands/taller-santa-clara/clothing/buzo_gris.png"
}
```

**Backgrounds**:
```json
{
  "id": "bg_living_natural",
  "filename": "living_luz_natural.jpg",
  "description": "Living moderno con luz natural, paredes blancas, piso de madera clara, plantas, estilo minimalista escandinavo",
  "mood": "cálido, natural, acogedor",
  "lighting": "luz natural suave desde ventana lateral",
  "imageUrl": "/static/brands/taller-santa-clara/backgrounds/living_natural.jpg"
}
```

---

## Prompt Management System

### Default Tool Prompts

Cada tool tiene un prompt template default en:
```
backend/tools/{tool_id}/default_prompt.txt
```

Ejemplo para UGC Video:
```
You are creating a UGC video script for {brand_name}.

BRAND CONTEXT:
{brand_guidance}

CAMPAIGN BRIEF:
{active_brief}

AVATAR:
{avatar_description}

PRODUCT:
Name: {product_name}
Description: {product_description}

Generate a {duration}-second UGC script following the 5-act Morfeo structure:
1. Hook (3s) - High-impact opening that stops scrolling
2. Story 1 (5-7s) - Problem or context setup
3. Story 2 (5-7s) - Product as solution
4. Plot Twist (3-5s) - Unexpected viral moment
5. CTA (2-3s) - Clear call to action

For each act, provide:
- Script text (what avatar says)
- Visual prompt (scene description for image generation)
- Duration in seconds

Output as JSON.
```

### Brand-Specific Overrides

Brands pueden customizar prompts en:
```
backend/data/brands/{brand_id}/context/prompts/{tool_id}.txt
```

Si existe override, se usa ese. Si no, se usa default.

**Prompt Editor UI** (`/dashboard/brands/{id}/prompts`) permite:
- Ver todos los prompts de tools
- Editar con syntax highlighting
- Ver variables disponibles
- Preview de cómo se interpola
- Reset a default

---

## Human Review Checkpoints

### 1. After Script Generation
- Review del guión completo
- Editar texto si es necesario
- Aprobar para continuar a imagen

### 2. After Multishot Curation
- Ver todas las variaciones por escena
- Ver recomendación de IA
- Elegir alternativa o aprobar
- Regenerar escenas individuales si es necesario

### 3. After Audio Generation
- Escuchar audio de cada segmento
- Regenerar con diferente voice preset si es necesario

### 4. Before Final Render
- Preview de todos los segmentos animados
- Aprobar orden y transiciones
- Configurar música/captions opcionales

---

## Cost Optimization Strategy

### Principio: "Curar antes de procesar"

1. **Script Generation**: Barato (Gemini)
2. **Image Generation**: Moderado (Nano Banana × múltiples variaciones)
3. **AI Curation**: Barato (Gemini Vision)
4. **Human Review**: Gratis (tiempo humano)
5. **Lip-Sync Animation**: **Caro** (Fal Fabric) → **Solo para imágenes curadas**
6. **Final Render**: Barato (FFmpeg local)

**Ahorro**: No animamos variaciones descartadas, ahorrando ~60-70% en costos de Fal

---

## Error Handling & Retries

### Retry Strategy por Fase

- **Script Gen**: Si falla, retry automático × 2
- **Image Gen**: Si falla una variación, continuar con las demás
- **AI Curation**: Si falla, mostrar todas las opciones al humano
- **Audio Gen**: Retry automático × 3 (ElevenLabs es confiable)
- **Lip-Sync**: Retry manual solo (caro, usuario decide)
- **Final Render**: Retry automático local

### Job Status Tracking

```json
{
  "job_id": "job_abc123",
  "brand_id": "taller-santa-clara",
  "tool_id": "ugc_video",
  "status": "running",  // queued | running | review | completed | failed
  "current_phase": "multishot_generation",
  "phases": {
    "script": {
      "status": "completed",
      "completedAt": "2024-03-20T10:15:00Z",
      "data": {...}
    },
    "multishot": {
      "status": "running",
      "progress": 67,  // 2 de 3 escenas completadas
      "scenes": [
        {"id": "hook", "status": "completed", "variations": 5},
        {"id": "story1", "status": "completed", "variations": 5},
        {"id": "story2", "status": "running", "variations": 2}
      ]
    },
    "curation": {"status": "pending"},
    "audio": {"status": "pending"},
    "lipsync": {"status": "pending"},
    "render": {"status": "pending"}
  },
  "outputs": {
    "script": {...},
    "images": [...],
    "curated": [...],
    "audio": [...],
    "videos": [...],
    "final": null
  },
  "error": null
}
```

---

## UI Components for Pipeline

### Generation Board
- Card-based view de todas las generaciones
- Status badges por fase
- Timeline visual de progreso
- Quick actions (view, retry, delete)

### Multishot Review Chamber
- Grid layout de variaciones por escena
- AI recommendation destacada visualmente
- Score + reasoning visible
- Human override buttons

### Pipeline Monitor
- Real-time progress tracker
- Phase-by-phase breakdown
- Error display with retry options
- Estimated time remaining

---

## Next Steps

Ver [planning.md](planning.md) para roadmap de implementación por fases.
