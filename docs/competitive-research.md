# Competitive Research — AI Creative Platforms

Investigaciones verificadas sobre competidores y referentes del espacio "AI creative infrastructure for marketing". Cada entrada lista fuentes, claims verificados, caveats, y conclusiones accionables para Coevo Studio.

**Cómo usar este archivo.** Léelo cuando estés por decidir una dirección estratégica grande (qué adoptar, qué evitar, qué diferenciador defender). Cada sección tiene un plan priorizado al final. Si cambia algo del producto del competidor, actualizá la fecha de validación arriba y revalidá los caveats — la investigación es snapshot, no live.

---

## Pletor (https://www.pletor.ai/)

- **Fecha de investigación:** 2026-06-10
- **Método:** deep-research workflow — 6 ángulos, 22 fuentes fetcheadas, 83 claims extraídos, 25 verificados adversarialmente con voto 3-de-3 (23 confirmados, 2 refutados)
- **Confianza general:** ALTA en lo factual (producto, pricing, funding, founders), MEDIA en lo estratégico (recomendaciones para Coevo)

### TL;DR

Pletor es una startup francesa (París, ex-Alma) que se vende como **"AI Creative Infrastructure for Marketing Teams"** — NO es un editor, NO es un modelo, es una **capa de orquestación tipo canvas de nodos** que encadena modelos third-party (Nano Banana, Flux, Kling, Veo, Sora, Claude, GPT Image, Higgsfield, Seedance, Grok) sobre tres primitivas: **Flows** (pipelines visuales), **Brain** (memoria viva de marca) y **Agent** (chat / voz / API / Claude). Sobre eso, **Studio** (builder con nodos), **Apps** (deployment wrapper para no-técnicos) y **MCP hosted** (`https://api.pletor.ai/mcp`).

### 1. Producto

#### Tres primitivas arquitectónicas
1. **Flows** — pipelines de producción visuales encadenando modelos en un canvas. "Chain image, video, and text models on one canvas instead of stitching tools by hand."
2. **Brain** — memoria viva de marca: "brand rules, creative references, performance data, competitive signals, encoded in one living memory"
3. **Agent** — chat / voz / API / integración Claude como entry point

#### Sub-componentes
- **Studio** = constructor visual de agentes con nodos
- **Apps** = wrapper que envuelve un agente Studio en una UI no-técnica
- **Pletor MCP** = servidor HTTP hosted (no CLI local), accesible desde Claude / Codex / Cursor

#### Brand Nodes (lo más interesante)
Pletor parte el contexto de marca en **5 tipos de nodos discretos** que se insertan al workflow como bloques de primera clase:

| Nodo | Qué contiene |
|---|---|
| **Brand Context** | Texto: nombre, descripción, value prop, audiencia, positioning |
| **Visual References** | Uploads de imagen |
| **Brand Guidelines** | Do's / don'ts visuales y creativos |
| **Brand Voice** | Sample copy + frameworks de mensajería (TEXTO, no TTS) |
| **Brand Docs** | PDF / CSV / JSON / TXT |

**Importante**: en "App mode" se sirven **automáticamente como contexto**. El usuario final no los toca.

#### Deployment como Apps (5 pasos lineales)
1. Build agent en Studio
2. Click "Deploy as app"
3. Definir inputs (los user-prompt nodes se vuelven campos de la app, renombrables)
4. Elegir outputs visibles (qué generation nodes se muestran)
5. Setear nombre / descripción / visibilidad (Private / Workspace / Shared)

#### Use-cases declarados
Product imagery, Performance Ads, AI UGC, Creative Ops. Todo "on brand, at volume" desde briefs unificados.

#### Customers públicos mencionados
Fever, Dalma, BETC, Smartbox, Les Furets (claim no verificado independientemente).

### 2. Modelo de negocio

#### Pricing público

| Plan | Precio | Créditos | Equivalencia | MCP/API |
|---|---|---|---|---|
| **Free** | $0 (sin tarjeta) | 200 | — | ❌ |
| **Starter** | $19/mo ($182/año) | 1,000 | ≈250 imgs / 50 videos / 10 UGC | ✅ |
| **Builder** | $49/mo ($470/año) | 3,000 | ~750 imgs / 150 videos / 30 UGC | ✅ |
| **Studio** | $199/mo ($1,910/año) | 15,000 | ≈3,750 imgs / 750 videos / 150 UGC | ✅ |
| **Enterprise** | custom | — | — | ✅ |

- ~4 créditos por imagen Nano Banana
- **MCP NO está gateado a Enterprise** — viene desde el plan de $19
- Todos los planes pagos incluyen API + team invitations + unlimited chats

#### Funding
- **€2M seed** (≈$2.26M USD) — junio 2025
- **Lead**: Atlantic Labs
- **Co-investor**: Kima Ventures
- **Ángeles ejecutivos**:
  - Kieran Flanagan — SVP Marketing HubSpot, ex-CMO Zapier
  - Claude Alexandre — VP B2B Adobe
  - Antoine Le Nel — CMO Revolut
  - Antoine Pabst — ex-CEO Publicis Luxe
- **Scouts**: a16z y Sequoia (vía individuos del scout program, NO inversión directa de los funds)

#### Founders
- **Ferdinand Terme** — CEO. Ex-growth & expansión internacional en Alma (fintech francesa)
- **Maxime Fonsale** — CPO. Primer product hire en Alma, perfil diseño. Salió de Alma el mismo día que Terme
- **Antoine Sueur** — CTO. 5+ años trabajando en modelos de generación de imágenes desde 2019

HQ París. Conectados al ecosistema vía Station F y Roxanne Varza.

### 3. Tech y arquitectura inferida

#### No tienen modelo propio
Pletor es **100% orquestador** sobre APIs third-party. Tercer-party analysts (startuply.vc) lo confirma: "does not appear to have developed its own proprietary foundation model... operates as an orchestration platform."

#### Modelos enumerados en docs (con versiones específicas)
Veo 3.1, Seedance 2.0, Kling 3.0, Sora 2, Hailuo 2.3, Veed Fabric, Grok Imagine 1.5, Nano Banana, Flux, Higgsfield, Reve, GPT Image, Claude.

#### Stack inferido
- **Canvas de nodos** comparable estructuralmente a Zapier / N8N pero vertical-izado para creativo
- **Tipos de nodos**: AI nodes, Input nodes, Brand nodes, Composer, Logic nodes
- **MCP**: HTTP transport remoto en `https://api.pletor.ai/mcp` (no stdio local)
- **Patrón MCP**: conversacional — el agente externo recibe brief en lenguaje natural, fetch-ea contexto, arma parámetros, invoca workflows una o cien veces

#### Config MCP típica
```json
{"mcpServers":{"pletor":{"url":"https://api.pletor.ai/mcp"}}}
```

### 4. UX / Visual design (de lo que pudimos ver)

- **Acento terracota** `~#E2603A` (la misma familia que el `#C45830` de Coevo)
- **Sidebar dashboard** con jerarquía: My workspace → Home / Agents / Apps / Batch / Assets → RESOURCES (Templates / Learn / Explore) → Credits → Upgrade
- **Onboarding modal** con 3 CTAs jerárquicos:
  - Hero: "Build your first agent — tailored to your use case, guided, 5 min"
  - Secundario: "Start with an app — ready-to-use automations, no setup"
  - Secundario: "Explore Pletor first — see what's possible before you dive in"
- **Patrón "Type your prompt"** tipo barra de chat con chips de configuración (modelo, AR, créditos, batch size, draw)
- **Tipografía**: sans-serif limpia (probablemente Inter o Söhne)
- **Cards** con border-radius generoso, mucho aire, shadows muy sutiles

### 5. Comparativa Pletor vs Coevo

| Dimensión | **Pletor** | **Coevo** |
|---|---|---|
| Orquestación | Canvas visual de nodos (Zapier-like vertical) | Tools verticales hardcodeadas, pipelines fijos |
| Brand context | 5 nodos compositables, brand-as-first-class | PromptBuilder 3-capas + assets globales (más profundo en data model, menos compositable) |
| MCP / API | Productizado, hosted, $19/mo | ❌ No existe |
| Pricing | Tiers públicos con créditos | Interno, sin pricing |
| Modelos | Agnóstico via APIs (10+) | Agnóstico pero más concentrado (Gemini + Fal + ElevenLabs + HeyGen) |
| **Profundidad vertical** | Canvas genérico | **Multi-foto producto, Consistencia anchor, Fashion Reel multi-shot, Ecommerce Pack, Look & Feel transfer, Content Analyzer handoff** |
| Deployment para clientes | "Apps" wrapper + workspace sharing | ❌ No formal (Client Portal a medias) |
| TTS / voz | "Brand Voice" = texto de sample copy | **Voice presets con ElevenLabs + preview, clonado real** |

### 6. Plan priorizado para Coevo

#### 🔴 ALTA — wins de packaging sin perder identidad
1. **MCP server propio** que envuelva Fashion Reel + Ecommerce Pack + Avatar Sheet. Diferencial inmediato: las tools de Coevo son más opinated que un canvas genérico. Desde Claude el usuario invoca workflows ya probados.
2. **Brand Nodes visibles** en Brand Settings — 5 cards expandidas separadas (Context / Visual Refs / Guidelines / Voice / Docs), respetando la regla anti-collapsibles. Tu `PromptBuilder` 3-capas ya hace algo similar internamente; exponerlo es UX casi gratis.
3. **Pricing público con tiers + créditos** (incluso si interno). Da claridad de costo por output al cliente final de la agencia.

#### 🟡 MEDIA
4. **"Deploy as App"** pattern: tool + brand override → link compartible al cliente. Formalizar el Client Portal v1 como "App".
5. **Templates marketplace** tipo home Pletor (cards "Popular" / "New" / categorías).
6. **Onboarding modal** con 3 CTAs jerárquicos (Start with a tool / Build your own / Explore).

#### 🟢 BAJA — NO hacer
7. **Canvas de nodos genérico**. Costo alto y **va contra la tesis** de "tools verticales opinated" de Coevo. Manual Lab queda como sandbox sin necesidad de canvas.

### 7. Diferenciadores defendibles de Coevo (NO los pierdas)

Verificado: ninguno de estos aparece en docs públicas de Pletor con el nivel de granularidad de Coevo.

1. **Multi-foto por producto y por clothing** (front / back / detail) con priorización smart por shot
2. **Consistencia anchor** con identity badge ID burgundy (avatar / producto / upload ad-hoc)
3. **Look & Feel transfer modo Receta** (Gemini Vision → texto, sin pasar la imagen al generador) — más estable que image-ref con Nano Banana
4. **Fashion Reel multi-shot** (outfit × shot catalog con motion hints + face anchor)
5. **Ecommerce Pack** outfit-folder × pose-folder = catálogo full
6. **Content Analyzer con handoff** a otras tools (no es un analyzer aislado)
7. **UGC pipeline 7-pasos con curación intermedia** — ahorra costo Kling validando frames antes de animar
8. **Brand DNA extraído de URL/PDF** automáticamente
9. **Voice presets reales** con preview ElevenLabs (Pletor "Brand Voice" = texto de copy, NO TTS con clonación)

### 8. Caveats importantes

- ⚠️ **No probamos Pletor live**. Calidad real de outputs, latencia MCP, face-lock no auditados
- ⚠️ El **"10x productivity"** es marketing de founders sin auditoría independiente
- ⚠️ Hay un **thread BlackHatWorld** preguntando "anyone actually using it?" — la adopción real puede no estar tan validada como el packaging sugiere
- ⚠️ **"Brand Voice" en Pletor ≠ Voice presets en Coevo** — son conceptos distintos con mismo nombre
- ⚠️ **"Scouts a16z/Sequoia"** no es inversión directa de los funds — son individuos del scout program
- ⚠️ El claim refutado sobre MCP de Pletor "orquestando full production vs single model call" tuvo voto 1-2 — la diferenciación vs otros MCPs creativos NO está clara con evidencia pública
- ⚠️ Crunchbase clasifica la ronda como "Pre Seed" mientras Tech.eu / Tracxn / Golden la llaman "Seed" — diferencia definicional menor (monto y participantes coinciden)
- ⚠️ Pricing puede cambiar; los tiers $19/$49/$199 son a junio 2026
- ⚠️ La URL `/agents/apps` da 404; la canónica es `/automate/apps` — el sitio tiene rutas movidas

### 9. Preguntas abiertas (para evaluación futura)

1. ¿Cuál es la calidad real de los outputs de Pletor vs Coevo en escenarios verticales como ecommerce batch o fashion multi-shot? Necesita prueba lado-a-lado sobre los mismos assets de una marca real.
2. ¿Qué se ve realmente en la UI de Studio (canvas de nodos)? ¿Cuánto de la lógica está expuesta al usuario vs hidden?
3. ¿Cómo manejan retries, failure modes y costos por workflow run en Pletor? ¿Hay budget caps? ¿Cómo factura créditos cuando un Kling job falla a mitad de pipeline?
4. ¿Qué empresas customer-real publicadas (Fever, Dalma, BETC, Smartbox, Les Furets) usan qué tools? ¿Hay case studies con métricas reales (no "10x" marketing)?
5. Pletor tiene MCP hosted — ¿qué pasaría si Coevo lanza un MCP server propio expuesto a Claude Code? ¿Hay riesgo de canibalizar UI propia o es upside puro?
6. ¿Cuál es el ARPU real de Pletor? Con €2M seed y Starter de $19, ¿cuántos clientes pagos necesitan para hit milestones de Series A? Indicador de qué tan agresivos están con sales motion.

### 10. Fuentes primarias

- https://www.pletor.ai/ (homepage)
- https://www.pletor.ai/pricing (pricing público)
- https://www.pletor.ai/blog/pletor-mcp-orchestrate-your-workflows-with-agents-claude-codex (MCP launch post)
- https://docs.pletor.ai/ (docs index)
- https://docs.pletor.ai/build-agents/nodes/brand-nodes (Brand Nodes spec)
- https://docs.pletor.ai/automate/apps (Apps deployment)
- https://docs.pletor.ai/model-library/video-models (modelos video soportados)

### 11. Fuentes secundarias (validadas)

- https://tech.eu/2025/06/05/french-startup-pletor-bags-eur2m-to-bring-ai-agents-to-the-creative-stack/ — Tech press europeo, anuncio funding
- https://www.roundtable.eu/clients/ferdinand-terme-pletor — Entrevista founder
- https://nordic9.com/news/pletor-raised-2-million-in-a-seed-round-led-by-atlantic-labs-... — Database de funding
- Tracxn — Lista "$2.28M from 1 Seed round on Jun 03, 2025"

### 12. Stats del workflow

- **Ángulos**: 6 (producto, funding, stack técnico, UX, comparativas, validación adversarial)
- **Fuentes fetcheadas**: 22
- **Claims extraídos**: 83
- **Claims verificados adversarialmente**: 25
- **Confirmados**: 23 (≈92%)
- **Refutados / killed**: 2 (8%)
- **Agentes llamados**: 105
- **Duración**: ~9 minutos
