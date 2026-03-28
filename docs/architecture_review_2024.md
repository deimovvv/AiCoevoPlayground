# Architecture Review & Recommendations

**Fecha**: Marzo 2024
**Reviewer**: Claude (Architecture Analysis)
**Contexto**: Transición de "UGC Creator" a "Coevo Creative OS" como herramienta interna de agencia

---

## Executive Summary

El proyecto tiene una **arquitectura sólida y bien pensada**, especialmente la filosofía "context-aware" y el approach de "multishot curation". Las decisiones técnicas son acertadas para un MVP, pero hay áreas clave que necesitan atención para escalar.

**Fortalezas principales**:
- ✅ Context-aware architecture (herencia automática de contexto por marca)
- ✅ Multishot curation strategy (60-70% cost savings)
- ✅ Prompt templates con variables (no hardcoded)
- ✅ Asset library con metadata rica

**Áreas de mejora**:
- ⚠️ Data persistence (JSON → Database migration path)
- ⚠️ Versioning (assets, prompts, generations)
- ⚠️ Cost tracking & estimation
- ⚠️ Error recovery & resume capability

---

## 1. Arquitectura Core

### 1.1 Context-Aware System ⭐⭐⭐⭐⭐

**Lo que está bien**:
```python
# Cuando user ejecuta tool dentro de una marca:
brand_context = load_brand(brand_id)
  ├── brand_guidance.md
  ├── briefs/
  ├── prompts/{tool_id}.txt
  └── assets/ (avatars, products, clothing, backgrounds)

# Todos los tools heredan este contexto automáticamente
tool.execute(context=brand_context, selected_assets=...)
```

**Por qué es excelente**:
- Elimina copy-paste manual de prompts
- Garantiza consistency across todas las generaciones
- Single source of truth por marca
- Fácil de mantener y actualizar

**Riesgo actual**: Si el context loading falla, todo el sistema falla.

**Recomendación**:
```python
# Agregar fallback graceful
def load_brand_context(brand_id: str) -> BrandContext:
    try:
        context = _load_from_storage(brand_id)
        return context
    except FileNotFoundError:
        logger.error(f"Brand context not found: {brand_id}")
        return BrandContext.default()  # Minimal fallback
    except Exception as e:
        logger.error(f"Error loading context: {e}")
        raise BrandContextError(f"Could not load context for {brand_id}")
```

---

### 1.2 Multishot Curation Strategy ⭐⭐⭐⭐⭐

**Approach actual**:
```
Generate 5 images → AI curation (Gemini Vision) → Human review → Animate best
```

**Por qué es brillante**:
- Fal Fabric cuesta ~$0.50-1.00 por video
- Generar 1 imagen con Nano Banana cuesta ~$0.02
- Strategy actual: $0.10 (images) + $0.50 (1 animation) = **$0.60**
- Strategy alternativa (animate all): $0.10 + $2.50 (5 animations) = **$2.60**
- **Ahorro**: 77%

**Mejoras sugeridas**:

1. **Adaptive variation count** (no siempre 5):
```python
def calculate_variation_count(complexity: str, budget: float) -> int:
    """
    Simple scene + low budget → 3 variations
    Complex scene + high budget → 7 variations
    """
    if complexity == "simple":
        return 3
    elif complexity == "medium":
        return 5
    else:  # complex
        return min(7, int(budget / 0.02))  # Max based on budget
```

2. **AI confidence threshold**:
```python
# Si AI está MUY segura (score > 95), skip human review
# Si AI no está segura (score < 85), force human review
if ai_curation.confidence > 0.95 and user_settings.trust_ai:
    selected = ai_curation.winner
    skip_human_review = True
else:
    await request_human_review()
```

3. **Learning from human overrides**:
```python
# Track cuando humano rechaza AI pick
if human_selected != ai_selected:
    log_override(
        scene_type=scene.type,
        ai_pick=ai_selected,
        human_pick=human_selected,
        ai_reasoning=ai_curation.reasoning,
        human_feedback=optional_feedback
    )
    # Use esto para fine-tune AI curation prompts
```

---

### 1.3 Prompt Template System ⭐⭐⭐⭐

**Estructura actual**:
```
backend/tools/{tool_id}/default_prompt.txt        ← Global default
backend/data/brands/{id}/context/prompts/{tool_id}.txt  ← Brand override
```

**Variables disponibles**:
- `{brand_name}`, `{brand_guidance}`, `{avatar_description}`, etc.

**Lo que falta**: Validation & Testing

**Recomendación**: Agregar prompt validator

```python
class PromptTemplate:
    def __init__(self, template: str, tool_id: str):
        self.template = template
        self.tool_id = tool_id
        self.required_vars = self._extract_required_vars()

    def _extract_required_vars(self) -> set[str]:
        """Extract {variable} from template"""
        import re
        return set(re.findall(r'\{(\w+)\}', self.template))

    def validate(self, context: dict) -> tuple[bool, list[str]]:
        """Check if all required variables are in context"""
        missing = self.required_vars - set(context.keys())
        if missing:
            return False, list(missing)
        return True, []

    def render(self, context: dict) -> str:
        """Render template with context"""
        is_valid, missing = self.validate(context)
        if not is_valid:
            raise PromptValidationError(f"Missing variables: {missing}")

        return self.template.format(**context)

    def preview(self, sample_context: dict) -> str:
        """Preview with sample data"""
        return self.render(sample_context)
```

**UI Feature**: En Prompt Editor, botón "Test Prompt" que muestra preview con datos de ejemplo.

---

## 2. Data Architecture

### 2.1 Current State: JSON Files ⚠️

**Estructura actual**:
```
backend/data/brands/{brand-id}/
├── brand.json
├── context/
│   ├── brand_guidance.md
│   ├── briefs/
│   └── prompts/
├── assets/
│   ├── avatars/
│   ├── products/
│   ├── clothing/
│   └── backgrounds/
└── generations/
```

**Pros**:
- ✅ Simple para MVP
- ✅ No necesita DB setup
- ✅ Fácil de debuggear (cat file)
- ✅ Git-friendly (si quisieran versionar)

**Cons**:
- ❌ No concurrent writes (race conditions)
- ❌ No transactions (partial updates = corruption)
- ❌ No indexing (search es O(n))
- ❌ No relations (foreign keys, joins)
- ❌ Difícil de escalar (100+ brands, 1000+ generations)

**Límite aproximado**: ~50 brands, ~500 generations antes de tener problemas de performance.

---

### 2.2 Migration Path: JSON → PostgreSQL

**Cuándo migrar**: Cuando lleguen a ~20 brands o ~200 generations/month.

**Schema propuesta**:

```sql
-- Brands
CREATE TABLE brands (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    brand_context TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Assets (polymorphic)
CREATE TABLE assets (
    id TEXT PRIMARY KEY,
    brand_id TEXT REFERENCES brands(id) ON DELETE CASCADE,
    type TEXT NOT NULL,  -- 'avatar', 'product', 'clothing', 'background'
    filename TEXT NOT NULL,
    description TEXT,
    metadata JSONB,  -- Flexible: tags, mood, lighting, etc.
    version INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    image_url TEXT
);

CREATE INDEX idx_assets_brand_type ON assets(brand_id, type);

-- Prompts
CREATE TABLE prompts (
    id SERIAL PRIMARY KEY,
    brand_id TEXT REFERENCES brands(id) ON DELETE CASCADE,
    tool_id TEXT NOT NULL,
    template TEXT NOT NULL,
    version INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(brand_id, tool_id, version)
);

-- Generations
CREATE TABLE generations (
    id TEXT PRIMARY KEY,
    brand_id TEXT REFERENCES brands(id) ON DELETE CASCADE,
    tool_id TEXT NOT NULL,
    status TEXT NOT NULL,  -- 'queued', 'running', 'review', 'completed', 'failed'
    current_phase TEXT,
    phases JSONB,
    inputs JSONB,  -- Asset IDs, parameters
    outputs JSONB,  -- URLs, metadata
    cost_estimate DECIMAL(10,2),
    cost_actual DECIMAL(10,2),
    prompt_used TEXT,  -- Snapshot of prompt at generation time
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE INDEX idx_generations_brand_status ON generations(brand_id, status);
CREATE INDEX idx_generations_created_at ON generations(created_at DESC);

-- Human overrides (for AI learning)
CREATE TABLE ai_curation_overrides (
    id SERIAL PRIMARY KEY,
    generation_id TEXT REFERENCES generations(id),
    scene_id TEXT NOT NULL,
    ai_selected_variation INT,
    human_selected_variation INT,
    ai_score INT,
    ai_reasoning TEXT,
    human_feedback TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Ventajas**:
- ✅ Transactional writes
- ✅ Indexing para búsquedas rápidas
- ✅ Relations (FK constraints)
- ✅ Versioning built-in
- ✅ Analytics queries fáciles

**Migration strategy**:
1. Implementar DB schema
2. Escribir migration script: JSON → Postgres
3. Run ambos en paralelo (write to both)
4. Validate data integrity
5. Switch read to Postgres
6. Deprecate JSON writes

---

### 2.3 Asset Versioning 🆕

**Problema**: Si actualizan un avatar, ¿qué pasa con generaciones anteriores?

**Solución**: Version tracking

```python
class Asset:
    id: str
    brand_id: str
    type: str  # avatar, product, etc.
    filename: str
    description: str
    version: int  # NEW
    previous_version_id: str | None  # NEW
    is_active: bool  # NEW
    created_at: datetime

    def update(self, new_description: str, new_file: bytes | None = None):
        """Create new version instead of overwriting"""
        new_version = Asset(
            id=generate_id(),
            brand_id=self.brand_id,
            type=self.type,
            filename=f"{self.id}_v{self.version + 1}.png",
            description=new_description,
            version=self.version + 1,
            previous_version_id=self.id,
            is_active=True
        )

        # Deactivate old version
        self.is_active = False

        return new_version
```

**Benefit**: Poder reproducir generaciones antiguas con los assets exactos que se usaron.

---

## 3. Cost Management

### 3.1 Cost Estimation (Pre-Generation) 🆕

**Problema**: User no sabe cuánto va a costar una generación hasta que termina.

**Solución**: Cost calculator

```python
class CostEstimator:
    PRICES = {
        "gemini_flash_input_1k": 0.0001,
        "gemini_flash_output_1k": 0.0002,
        "nano_banana_image": 0.02,
        "elevenlabs_char": 0.00003,
        "fal_fabric_video": 0.50,
        "kling_video_5s": 0.15
    }

    def estimate_ugc_video(
        self,
        duration: int,
        num_scenes: int,
        variations_per_scene: int = 5
    ) -> CostBreakdown:
        """
        Estimate cost for UGC video generation
        """
        # Script generation
        script_tokens = num_scenes * 200  # ~200 tokens per scene
        script_cost = (script_tokens / 1000) * self.PRICES["gemini_flash_output_1k"]

        # Multishot image generation
        total_images = num_scenes * variations_per_scene
        image_cost = total_images * self.PRICES["nano_banana_image"]

        # AI curation
        curation_tokens = num_scenes * 500  # Vision analysis
        curation_cost = (curation_tokens / 1000) * self.PRICES["gemini_flash_output_1k"]

        # Audio
        chars_per_scene = duration / num_scenes * 150  # ~150 chars/second
        audio_cost = (chars_per_scene * num_scenes) * self.PRICES["elevenlabs_char"]

        # Lip-sync (only for selected images)
        lipsync_cost = num_scenes * self.PRICES["fal_fabric_video"]

        total = script_cost + image_cost + curation_cost + audio_cost + lipsync_cost

        return CostBreakdown(
            script=script_cost,
            images=image_cost,
            curation=curation_cost,
            audio=audio_cost,
            lipsync=lipsync_cost,
            total=total
        )
```

**UI Implementation**:
```typescript
// Before starting generation
const estimate = await api.estimateCost({
  toolId: 'ugc_video',
  duration: 30,
  scenes: 5,
  variations: 5
});

// Show confirmation modal
<ConfirmationModal>
  <h3>Cost Estimate</h3>
  <table>
    <tr><td>Script Generation</td><td>${estimate.script}</td></tr>
    <tr><td>Image Generation (25 images)</td><td>${estimate.images}</td></tr>
    <tr><td>AI Curation</td><td>${estimate.curation}</td></tr>
    <tr><td>Audio Generation</td><td>${estimate.audio}</td></tr>
    <tr><td>Lip-Sync Animation</td><td>${estimate.lipsync}</td></tr>
    <tr class="total"><td>Total</td><td><strong>${estimate.total}</strong></td></tr>
  </table>

  <p>This generation will cost approximately <strong>${estimate.total}</strong>.</p>
  <Button onClick={confirmGeneration}>Continue</Button>
  <Button variant="ghost" onClick={cancel}>Cancel</Button>
</ConfirmationModal>
```

---

### 3.2 Cost Tracking (Post-Generation) 📊

**Almacenar costs reales**:

```python
class Generation:
    id: str
    cost_estimate: Decimal  # From pre-generation estimation
    cost_actual: Decimal    # Actual cost after completion
    cost_breakdown: dict    # Detailed per-service costs

    def update_actual_cost(self):
        """Calculate actual cost from API usage"""
        costs = {
            "script": self._calculate_gemini_cost(self.script_tokens),
            "images": len(self.generated_images) * 0.02,
            "curation": self._calculate_gemini_vision_cost(self.curation_tokens),
            "audio": self._calculate_elevenlabs_cost(self.audio_chars),
            "lipsync": len(self.final_videos) * 0.50
        }

        self.cost_actual = sum(costs.values())
        self.cost_breakdown = costs
        self.cost_variance = self.cost_actual - self.cost_estimate
```

**Analytics Dashboard** (Future):
```sql
-- Average cost per tool
SELECT
    tool_id,
    COUNT(*) as generations,
    AVG(cost_actual) as avg_cost,
    SUM(cost_actual) as total_cost
FROM generations
WHERE status = 'completed'
GROUP BY tool_id;

-- Cost efficiency (estimate accuracy)
SELECT
    AVG(ABS(cost_actual - cost_estimate) / cost_estimate * 100) as avg_variance_pct
FROM generations
WHERE cost_estimate > 0;

-- Most expensive brands
SELECT
    brand_id,
    COUNT(*) as generations,
    SUM(cost_actual) as total_spent
FROM generations
GROUP BY brand_id
ORDER BY total_spent DESC
LIMIT 10;
```

---

## 4. Error Handling & Recovery

### 4.1 Current State: Basic Retry

```python
# services/copy_gen.py
async def generate_script(...):
    for attempt in range(3):  # Retry 3 times
        try:
            result = await gemini.generate(...)
            return result
        except Exception as e:
            if attempt == 2:
                raise
            await asyncio.sleep(2 ** attempt)  # Exponential backoff
```

**Problema**: Si falla en fase 3 de 6, el user pierde todo el progreso.

---

### 4.2 Checkpoint System 🆕

**Solución**: Guardar state después de cada fase exitosa

```python
class GenerationCheckpoint:
    generation_id: str
    phase: str  # 'script', 'multishot', 'curation', 'audio', 'lipsync', 'render'
    phase_output: dict
    created_at: datetime

# Guardar checkpoint
await checkpoint_manager.save(
    generation_id=gen.id,
    phase="multishot",
    output={
        "images": [...],
        "seeds": [...],
        "prompts_used": [...]
    }
)

# Resume desde checkpoint
def resume_generation(generation_id: str):
    """Resume from last successful checkpoint"""
    gen = load_generation(generation_id)
    last_checkpoint = checkpoint_manager.get_latest(generation_id)

    if not last_checkpoint:
        # Start from beginning
        return run_phase_script(gen)

    # Resume from next phase
    next_phase = get_next_phase(last_checkpoint.phase)
    return run_phase(gen, next_phase, previous_output=last_checkpoint.phase_output)
```

**UI Feature**: En generation card, si status = 'failed':
```typescript
<GenerationCard status="failed">
  <ErrorMessage>{error.message}</ErrorMessage>
  <Button onClick={() => resumeGeneration(gen.id)}>
    Resume from {lastCheckpoint.phase}
  </Button>
  <Button variant="ghost" onClick={() => retryGeneration(gen.id)}>
    Retry from beginning
  </Button>
</GenerationCard>
```

---

### 4.3 Graceful Degradation

**Principio**: Si un service falla, degrade gracefully en vez de crash

**Ejemplos**:

1. **AI Curation falla** → Show all variations al humano sin ranking
2. **Nano Banana rate limit** → Queue y retry con backoff
3. **Gemini Vision timeout** → Use simple heuristics (image size, brightness, etc.)

```python
async def curate_with_fallback(images: list[str]) -> CurationResult:
    try:
        # Try AI curation first
        return await gemini_vision.curate(images)
    except TimeoutError:
        logger.warning("Gemini Vision timeout, using heuristic fallback")
        return heuristic_curation(images)
    except Exception as e:
        logger.error(f"Curation failed: {e}")
        # Return all images without ranking
        return CurationResult(
            variations=[
                {"id": i, "score": None, "reasoning": None}
                for i, img in enumerate(images)
            ],
            winner=None,  # Force human selection
            fallback_used=True
        )
```

---

## 5. UX/UI Improvements

### 5.1 Quick Brand Switcher 🆕

**Problema**: Para cambiar de marca, user tiene que: Sidebar → Exit Brand → Dashboard → Click otra brand

**Solución**: Command palette (Cmd+K / Ctrl+K)

```typescript
// components/CommandPalette.tsx
function CommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Command>
        <CommandInput placeholder="Search brands, tools, generations..." />
        <CommandList>
          <CommandGroup heading="Brands">
            {brands.map(brand => (
              <CommandItem
                key={brand.id}
                onSelect={() => navigate(`/brands/${brand.id}`)}
              >
                🏢 {brand.name}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Tools">
            <CommandItem>🎨 Static Content</CommandItem>
            <CommandItem>🎬 Video Reel</CommandItem>
            <CommandItem>📹 UGC Video</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </Dialog>
  );
}
```

---

### 5.2 Inline Asset Search 🔍

**Problema**: En asset selector, si tienen 50+ avatars, es difícil encontrar el correcto

**Solución**: Search + filters

```typescript
<AssetSelector type="avatar">
  <SearchInput placeholder="Search avatars..." onChange={setQuery} />

  <FilterBar>
    <TagFilter tags={['masculino', 'femenino', '20s', '30s', '40s']} />
    <SortBy options={['Recent', 'Name', 'Most Used']} />
  </FilterBar>

  <AssetGrid>
    {filteredAvatars.map(avatar => (
      <AssetCard
        key={avatar.id}
        selected={selected === avatar.id}
        onClick={() => onSelect(avatar.id)}
      >
        <img src={avatar.imageUrl} />
        <h4>{avatar.name}</h4>
        <Tags>{avatar.tags}</Tags>
      </AssetCard>
    ))}
  </AssetGrid>
</AssetSelector>
```

---

### 5.3 AI-Assisted Prompt Writing 🤖

**Feature**: En Prompt Editor, AI sugiere mejoras

```typescript
<PromptEditor>
  <MonacoEditor value={prompt} onChange={setPrompt} />

  <Button onClick={async () => {
    const suggestions = await api.analyzePrompt(prompt);
    setSuggestions(suggestions);
  }}>
    ✨ Get AI Suggestions
  </Button>

  {suggestions && (
    <SuggestionPanel>
      <h4>AI Suggestions:</h4>
      {suggestions.map(s => (
        <Suggestion key={s.id}>
          <p>{s.reasoning}</p>
          <code>{s.improved_prompt}</code>
          <Button onClick={() => applysuggestion(s)}>Apply</Button>
        </Suggestion>
      ))}
    </SuggestionPanel>
  )}
</PromptEditor>
```

Backend:
```python
@app.post("/api/prompts/analyze")
async def analyze_prompt(prompt: str, tool_id: str):
    """Use Gemini to suggest prompt improvements"""
    analysis_prompt = f"""
    Analyze this prompt template for {tool_id}:

    {prompt}

    Suggest 2-3 improvements for:
    1. Clarity
    2. Specificity
    3. Variable usage
    4. Output quality

    Return as JSON.
    """

    result = await gemini.generate(analysis_prompt)
    return parse_suggestions(result)
```

---

### 5.4 Generation History Filters 📚

**Problema**: Con 100+ generaciones, es difícil encontrar una específica

**Solución**: Filtros + búsqueda semántica

```typescript
<GenerationHistory>
  <FilterBar>
    <Select label="Tool" options={['All', 'Static', 'Reel', 'UGC']} />
    <Select label="Status" options={['All', 'Running', 'Completed', 'Failed']} />
    <DateRange label="Date" />
    <AssetFilter label="Avatar" avatars={brandAvatars} />
  </FilterBar>

  <SearchInput
    placeholder="Search generations (e.g., 'videos with white t-shirt')"
    onSearch={semanticSearch}
  />

  <GenerationGrid>
    {filteredGenerations.map(gen => <GenerationCard {...gen} />)}
  </GenerationGrid>
</GenerationHistory>
```

Backend (semantic search con embeddings):
```python
# Future: Use vector DB (Pinecone, Weaviate)
@app.post("/api/generations/search")
async def semantic_search(query: str, brand_id: str):
    """Semantic search usando embeddings"""
    # Get query embedding
    query_embedding = await get_embedding(query)

    # Get all generations for brand
    generations = load_generations(brand_id)

    # Calculate similarity
    results = []
    for gen in generations:
        # Get embedding from cached metadata
        gen_embedding = gen.metadata.get("embedding")
        if not gen_embedding:
            # Generate on-the-fly (slow, should be cached)
            gen_text = f"{gen.tool_id} {gen.inputs} {gen.outputs}"
            gen_embedding = await get_embedding(gen_text)

        similarity = cosine_similarity(query_embedding, gen_embedding)
        if similarity > 0.7:  # Threshold
            results.append((gen, similarity))

    # Sort by similarity
    results.sort(key=lambda x: x[1], reverse=True)
    return [gen for gen, score in results[:20]]
```

---

## 6. Service Integrations

### 6.1 Nano Banana 2

**Status**: TODO

**Priority**: HIGH (es core para static content + UGC pipeline)

**Implementation checklist**:

```python
# backend/services/nano_banana.py

import httpx
import os

NANO_BANANA_API_KEY = os.getenv("NANO_BANANA_API_KEY")
NANO_BANANA_BASE_URL = "https://api.nanobanana.ai/v2"  # Verificar URL real

class NanoBananaService:
    def __init__(self):
        self.api_key = NANO_BANANA_API_KEY
        self.client = httpx.AsyncClient(
            base_url=NANO_BANANA_BASE_URL,
            headers={"Authorization": f"Bearer {self.api_key}"},
            timeout=120.0
        )

    async def generate_image(
        self,
        prompt: str,
        width: int = 1024,
        height: int = 1024,
        seed: int | None = None,
        num_variations: int = 1
    ) -> list[dict]:
        """Generate image(s) from prompt"""
        payload = {
            "prompt": prompt,
            "width": width,
            "height": height,
            "num_images": num_variations,
            "seed": seed
        }

        response = await self.client.post("/generate", json=payload)
        response.raise_for_status()

        result = response.json()
        return result["images"]  # [{url, seed}, ...]

    async def edit_image(
        self,
        image_url: str,
        mask_url: str,
        prompt: str
    ) -> dict:
        """Inpainting / image editing"""
        payload = {
            "image": image_url,
            "mask": mask_url,
            "prompt": prompt
        }

        response = await self.client.post("/edit", json=payload)
        response.raise_for_status()

        return response.json()

    def is_configured(self) -> bool:
        return bool(self.api_key)

# Export singleton
nano_banana = NanoBananaService()
```

**Testing strategy**:
1. Unit test con mocked responses
2. Integration test con API real (sandbox if available)
3. Load test para rate limits

**Cost tracking**:
```python
# Log cada llamada
async def generate_image(...):
    start = time.time()
    result = await nano_banana.generate_image(...)
    duration = time.time() - start

    # Log para analytics
    await log_api_call(
        service="nano_banana",
        endpoint="generate",
        cost=0.02 * num_variations,
        duration=duration,
        success=True
    )

    return result
```

---

### 6.2 Gemini Vision Curation

**Status**: TODO

**Priority**: HIGH (core del multishot pipeline)

**Implementation**:

```python
# backend/services/gemini_vision.py

async def curate_scene_variations(
    scene_id: str,
    scene_description: str,
    image_urls: list[str],
    brand_style_guide: str = ""
) -> CurationResult:
    """
    Analyze multiple image variations and select best one
    """

    prompt = f"""
    You are an expert photography director. Analyze these {len(image_urls)} variations
    of the same scene and select the best one.

    SCENE DESCRIPTION:
    {scene_description}

    BRAND STYLE GUIDE:
    {brand_style_guide}

    EVALUATION CRITERIA:
    1. Lighting & Exposure (0-100)
    2. Composition & Framing (0-100)
    3. Avatar Consistency (0-100) - face, clothing, pose
    4. Product Clarity (0-100) - if applicable
    5. Expression Appropriateness (0-100) - matches scene emotion
    6. Overall Naturalness (0-100)

    For each image, provide:
    - Overall score (weighted average)
    - Score breakdown
    - Brief reasoning (2-3 sentences)

    Then select the WINNER and explain why.

    Output as JSON:
    {{
      "variations": [
        {{
          "index": 0,
          "scores": {{"lighting": 85, "composition": 90, ...}},
          "overall_score": 88,
          "reasoning": "..."
        }},
        ...
      ],
      "winner": {{
        "index": 2,
        "confidence": 0.94,
        "reasoning": "..."
      }}
    }}
    """

    # Gemini Vision acepta múltiples imágenes
    response = await gemini.generate_content(
        prompt=prompt,
        images=image_urls,
        model="gemini-2.0-flash-thinking-exp-01-21"  # Best for vision + reasoning
    )

    result = parse_curation_response(response)
    return result
```

**Optimization**: Si hay muchas variaciones (7+), hacer curation en 2 pasadas:
1. Primera pasada: Quick scoring (top 3)
2. Segunda pasada: Detailed analysis de top 3

---

## 7. Deployment & Scaling

### 7.1 Current Setup (Local Dev)

```
Frontend: localhost:5173 (Vite dev server)
Backend: localhost:8000 (Uvicorn)
```

---

### 7.2 Production Setup (Recommended)

**Option A: Traditional (Railway/Render)**

```
Frontend:
  - Build: npm run build
  - Deploy: Vercel / Netlify
  - CDN: Cloudflare

Backend:
  - Server: Railway / Render
  - Workers: Celery + Redis (para jobs async)
  - Database: Neon / Supabase PostgreSQL
  - Storage: Cloudflare R2 / AWS S3

Monitoring:
  - Logs: Sentry
  - Metrics: Datadog / Grafana
  - Uptime: UptimeRobot
```

**Option B: Serverless (AWS)**

```
Frontend:
  - S3 + CloudFront
  - React SPA deployed a S3 bucket

Backend:
  - Lambda functions (via Mangum adapter para FastAPI)
  - API Gateway
  - RDS PostgreSQL
  - S3 para assets
  - SQS para job queue

Pros:
  - Pay per use
  - Auto-scaling
  - No server management

Cons:
  - Lambda cold starts
  - Más complejo setup
  - Debugging más difícil
```

**Recommendation**: Option A (Railway + Vercel) para MVP. Migrar a serverless cuando tengan 1000+ req/day.

---

### 7.3 Job Queue System (Redis + Celery)

**Why**: Long-running generations (5-10 min) no pueden bloquer FastAPI request.

**Architecture**:

```
FastAPI API
    ↓
   POST /api/brands/{id}/tools/ugc_video/run
    ↓
  Create job in Redis queue
    ↓
  Return job_id immediately (HTTP 202)
    ↓
Celery worker picks up job
    ↓
  Execute 6-phase pipeline
    ↓
  Update job status in DB
    ↓
Frontend polls GET /api/jobs/{job_id}
    ↓
  Shows real-time progress
```

**Implementation**:

```python
# backend/celery_app.py
from celery import Celery

celery_app = Celery(
    "coevo",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/0"
)

@celery_app.task(bind=True)
def run_ugc_pipeline(self, generation_id: str):
    """Celery task for UGC pipeline"""
    try:
        # Phase 1: Script
        self.update_state(state='RUNNING', meta={'phase': 'script', 'progress': 0})
        script = generate_script(generation_id)

        # Phase 2: Multishot
        self.update_state(state='RUNNING', meta={'phase': 'multishot', 'progress': 20})
        images = generate_multishot(generation_id, script)

        # Phase 3: Curation
        self.update_state(state='RUNNING', meta={'phase': 'curation', 'progress': 50})
        curated = curate_images(generation_id, images)

        # ... resto de fases

        return {"status": "completed", "output_url": final_video_url}

    except Exception as e:
        # Retry con exponential backoff
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))

# backend/main.py
@app.post("/api/brands/{brand_id}/tools/{tool_id}/run")
async def run_tool(brand_id: str, tool_id: str, params: dict):
    # Create generation record
    gen = create_generation(brand_id, tool_id, params)

    # Queue job
    task = run_ugc_pipeline.delay(gen.id)

    return {
        "job_id": task.id,
        "generation_id": gen.id,
        "status": "queued"
    }

@app.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str):
    task = celery_app.AsyncResult(job_id)
    return {
        "job_id": job_id,
        "status": task.state,
        "meta": task.info
    }
```

---

## 8. Testing Strategy

### 8.1 Current State

- ❌ No automated tests
- ✅ Manual testing only

### 8.2 Recommended Testing Pyramid

```
          E2E Tests (5%)
        ________________
       Integration Tests (15%)
      ______________________
     Unit Tests (80%)
    __________________________
```

**Unit Tests** (backend/tests/):
```python
# tests/test_prompt_template.py
def test_prompt_template_render():
    template = PromptTemplate(
        template="Generate video for {brand_name} with {product_name}",
        tool_id="ugc_video"
    )

    context = {
        "brand_name": "Taller Santa Clara",
        "product_name": "Remera Essential White"
    }

    result = template.render(context)
    assert result == "Generate video for Taller Santa Clara with Remera Essential White"

def test_prompt_template_missing_var():
    template = PromptTemplate(
        template="Generate video for {brand_name} with {product_name}",
        tool_id="ugc_video"
    )

    context = {"brand_name": "Taller Santa Clara"}  # Missing product_name

    with pytest.raises(PromptValidationError):
        template.render(context)

# tests/test_cost_estimator.py
def test_ugc_cost_estimation():
    estimator = CostEstimator()
    result = estimator.estimate_ugc_video(duration=30, num_scenes=5)

    assert result.total > 0
    assert result.script < result.total
    assert result.lipsync > result.curation  # Lipsync más caro que curation
```

**Integration Tests**:
```python
# tests/integration/test_brand_context.py
async def test_load_brand_context(test_client):
    # Create brand
    response = await test_client.post("/api/brands", json={
        "name": "Test Brand",
        "brandContext": "Test context"
    })
    brand_id = response.json()["id"]

    # Load context
    context = load_brand_context(brand_id)

    assert context.brand_id == brand_id
    assert context.brand_guidance is not None
    assert context.assets is not None

# tests/integration/test_nano_banana.py
@pytest.mark.integration
async def test_nano_banana_generate():
    """Integration test con API real (skip en CI)"""
    if not os.getenv("RUN_INTEGRATION_TESTS"):
        pytest.skip("Integration tests disabled")

    result = await nano_banana.generate_image(
        prompt="A man wearing a white t-shirt",
        num_variations=2
    )

    assert len(result) == 2
    assert result[0]["url"].startswith("https://")
```

**E2E Tests** (Playwright):
```typescript
// tests/e2e/ugc-generation.spec.ts
test('complete UGC video generation flow', async ({ page }) => {
  // Login y navigate to brand
  await page.goto('/dashboard/brands/taller-santa-clara');

  // Click "New Generation"
  await page.click('text=New Generation');
  await page.click('text=UGC Video');

  // Select assets
  await page.click('[data-testid="avatar-elias"]');
  await page.click('[data-testid="product-remera-white"]');

  // Start generation
  await page.click('text=Start Pipeline');

  // Wait for script phase
  await page.waitForSelector('text=Script Generation Complete');

  // Approve script
  await page.click('text=Approve & Continue');

  // Wait for multishot
  await page.waitForSelector('[data-testid="multishot-variations"]');

  // Select AI recommendation
  await page.click('[data-testid="use-ai-pick"]');

  // Continue through audio
  await page.click('text=Approve & Animate');

  // Wait for completion (with timeout)
  await page.waitForSelector('text=Completed', { timeout: 300000 });

  // Verify final video
  const videoUrl = await page.getAttribute('[data-testid="final-video"]', 'src');
  expect(videoUrl).toContain('.mp4');
});
```

---

## 9. Security Considerations

### 9.1 API Key Management ✅

**Current**: `.env` file (good para dev)

**Production**: Use secrets manager
- Railway: Built-in env vars
- AWS: Secrets Manager
- Vercel: Environment variables (encrypted)

**Never**:
- ❌ Commit `.env` to git
- ❌ Log API keys
- ❌ Expose keys en frontend
- ❌ Share keys en Slack/email

---

### 9.2 File Upload Security 🔒

**Current risk**: User puede subir cualquier archivo

**Mitigations**:

```python
# backend/services/upload_security.py
import magic
from PIL import Image

ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"]
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

async def validate_image_upload(file: UploadFile) -> tuple[bool, str]:
    """Validate uploaded image"""

    # Check file size
    file.file.seek(0, 2)  # Seek to end
    size = file.file.tell()
    file.file.seek(0)  # Reset

    if size > MAX_FILE_SIZE:
        return False, f"File too large: {size} bytes (max {MAX_FILE_SIZE})"

    # Check MIME type (no confiar en extension!)
    content = await file.read(2048)  # Read first 2KB
    mime = magic.from_buffer(content, mime=True)
    file.file.seek(0)  # Reset

    if mime not in ALLOWED_MIME_TYPES:
        return False, f"Invalid file type: {mime}"

    # Validate es imagen real (no malicious file disfrazado)
    try:
        img = Image.open(file.file)
        img.verify()  # Verifica integridad
        file.file.seek(0)
    except Exception as e:
        return False, f"Invalid image file: {str(e)}"

    return True, "OK"

# Usage en endpoint
@app.post("/api/brands/{id}/assets/avatars")
async def upload_avatar(file: UploadFile, ...):
    is_valid, error = await validate_image_upload(file)
    if not is_valid:
        raise HTTPException(400, detail=error)

    # Proceed with upload...
```

---

### 9.3 Rate Limiting 🚦

**Current**: None

**Recommendation**: Implement rate limiting

```python
# backend/middleware/rate_limit.py
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Apply to endpoints
@app.post("/api/brands/{id}/tools/{tool_id}/run")
@limiter.limit("10/minute")  # Max 10 generations per minute
async def run_tool(...):
    ...

@app.post("/api/brands/{id}/assets/avatars")
@limiter.limit("20/hour")  # Max 20 uploads per hour
async def upload_avatar(...):
    ...
```

---

## 10. Monitoring & Observability

### 10.1 Logging

**Current**: Basic Python logging

**Recommendation**: Structured logging

```python
# backend/logging_config.py
import structlog

structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Usage
logger.info(
    "generation_started",
    generation_id=gen.id,
    brand_id=gen.brand_id,
    tool_id=gen.tool_id,
    user_id=user.id
)
```

**Benefits**:
- JSON format → easy parsing
- Rich context (generation_id, brand_id, etc.)
- Compatible con log aggregators (Datadog, CloudWatch)

---

### 10.2 Metrics

**Key metrics to track**:

```python
# backend/metrics.py
from prometheus_client import Counter, Histogram, Gauge

# Generations
generation_started = Counter('generation_started_total', 'Generations started', ['tool_id', 'brand_id'])
generation_completed = Counter('generation_completed_total', 'Generations completed', ['tool_id', 'status'])
generation_duration = Histogram('generation_duration_seconds', 'Generation duration', ['tool_id', 'phase'])

# API calls
api_call_duration = Histogram('api_call_duration_seconds', 'External API call duration', ['service', 'endpoint'])
api_call_cost = Counter('api_call_cost_dollars', 'External API call cost', ['service'])

# Errors
errors_total = Counter('errors_total', 'Total errors', ['service', 'error_type'])

# Usage
generation_started.labels(tool_id='ugc_video', brand_id=brand.id).inc()
with generation_duration.labels(tool_id='ugc_video', phase='script').time():
    result = await generate_script(...)
```

**Dashboard** (Grafana):
- Generations per day (by tool)
- Average generation time (by phase)
- Error rate
- API costs per day
- Most active brands

---

## 11. Next Steps (Prioritized)

### Sprint 1 (Week 1-2): Asset Library System
- [ ] Backend: Clothing asset upload endpoint
- [ ] Backend: Background asset upload endpoint
- [ ] Backend: Asset metadata structure
- [ ] Frontend: AssetManager page (basic)
- [ ] Frontend: Asset upload forms
- [ ] Frontend: Asset grid display

**Deliverable**: User puede subir clothing + backgrounds, verlos en galería.

---

### Sprint 2 (Week 3-4): Context Loading + Prompt Management
- [ ] Backend: `load_brand_context()` function
- [ ] Backend: Prompt CRUD endpoints
- [ ] Backend: Prompt template validation
- [ ] Frontend: PromptEditor page
- [ ] Frontend: Monaco editor integration
- [ ] Frontend: Template variable preview

**Deliverable**: User puede editar prompts por brand, ver preview.

---

### Sprint 3 (Week 5-6): Nano Banana Integration
- [ ] Backend: `services/nano_banana.py`
- [ ] Backend: Generate image endpoint
- [ ] Backend: Cost tracking
- [ ] Test: Integration tests con API real
- [ ] Frontend: Static content tool UI
- [ ] Frontend: Result display

**Deliverable**: User puede generar static images usando context system.

---

### Sprint 4 (Week 7-8): Multishot Generation
- [ ] Backend: Generate N variations with different seeds
- [ ] Backend: Parallel API calls (asyncio.gather)
- [ ] Backend: Variation storage
- [ ] Frontend: Multishot result display
- [ ] Frontend: Variation selector UI

**Deliverable**: User puede generar múltiples variaciones, ver todas.

---

### Sprint 5 (Week 9-10): AI Curation
- [ ] Backend: `services/gemini_vision.py`
- [ ] Backend: Curation scoring logic
- [ ] Backend: Fallback heuristics
- [ ] Frontend: Multishot Review Chamber UI
- [ ] Frontend: AI recommendation display
- [ ] Frontend: Human override functionality

**Deliverable**: AI selecciona mejor variation, user puede override.

---

### Sprint 6 (Week 11-12): Full UGC Pipeline Backend
- [ ] Backend: Pipeline orchestration
- [ ] Backend: Phase state machine
- [ ] Backend: Checkpoint system
- [ ] Backend: Resume capability
- [ ] Test: End-to-end pipeline test
- [ ] Frontend: Pipeline monitor updates

**Deliverable**: Full UGC pipeline funciona end-to-end.

---

## Conclusion

**Strengths** ⭐⭐⭐⭐½:
- Context-aware architecture es innovadora y bien pensada
- Multishot curation strategy es cost-effective
- Prompt template system es flexible
- Asset library concept es solid

**Areas to Address**:
- Data persistence (migrate to DB when scaling)
- Versioning (assets, prompts, generations)
- Cost tracking & estimation
- Error recovery & checkpoints
- Testing strategy

**Overall Assessment**: El proyecto tiene **fundamentos muy sólidos**. Con las mejoras sugeridas (especialmente DB migration, versioning, y testing), va a escalar bien cuando tengan 10-20 brands activos generando contenido regularmente.

La arquitectura context-aware es el differentiator clave vs otras herramientas de generación. Mantené ese core concept y construí todo alrededor de eso.

**Recomendación**: Seguir el plan de sprints propuesto. No saltar directamente al UGC pipeline completo. Construir incrementalmente:
1. Assets → 2. Context → 3. Nano Banana → 4. Multishot → 5. Curation → 6. Full Pipeline

Esto permite validar cada pieza antes de armar el pipeline completo.
