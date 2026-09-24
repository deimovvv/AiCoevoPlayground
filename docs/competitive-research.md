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

---

## Superside / Superspace (https://www.superside.com/enterprise)

- **Fecha de investigación:** 2026-08-25
- **Método:** fetch directo de 5 superficies públicas (enterprise, our-technology, llm-info, updates, help center "Intro to Superspace") + búsqueda. **NO** se usó el producto live.
- **Confianza:** ALTA en modelo de negocio y pricing (lo publican explícito), MEDIA en features de Superspace (todo viene de marketing y help center, no de docs técnicas), BAJA en métricas de eficiencia (self-reported).

### TL;DR — la lectura importante

**Superside NO vende software. Vende servicio creativo gestionado a $30k/mes, y Superspace es la capa de operación que hace ese servicio escalable, medible y difícil de abandonar.**

Es el caso grande que valida la tesis de Coevo (vender output, no SaaS horizontal) — pero ejecutado con 800 personas en 70 países. La plataforma no es el producto: es el *moat de retención* del servicio. Nadie compra Superspace; compran el equipo, y Superspace es donde el equipo se vuelve legible, auditable y renovable.

### 1. Modelo de negocio (lo publican explícito)

| Plan | Precio | Estructura |
|---|---|---|
| **Dedicated** | desde **$30.000/mes** (12 meses) + $1.000/mes software fee | equipo fijo armado alrededor de un use case; setup 3 semanas |
| **Flex** | **$20k–$50k/mes** (12 meses) + $1.000/mes software fee | equipo variable según demanda; presupuesto no usado rollea 3 meses |
| **High-Impact Projects** | desde **$50.000** | scope fijo, iniciativa puntual |

Todos incluyen usuarios ilimitados, storage y acceso full a la plataforma.

**El detalle que más importa: el software fee es $1.000/mes sobre un ticket de $30.000.** ~3%. La plataforma está deliberadamente subvaluada — su función es hacer el servicio pegajoso, no generar revenue. Es una decisión de packaging, no de pricing.

- Fundada 2015 como Konsus, rebrand a Superside en 2019. CEO Fredrik Thomassen.
- 800+ empleados / 70+ países / 500+ marcas / 200.000+ proyectos / 12.000+ proyectos "AI-powered".
- Clientes públicos: Figma, Reddit, Microsoft, Colgate-Palmolive, Grubhub, Pernod Ricard.
- Claims: "~35% más eficiencia en proyectos AI-powered", "94% ROI a 3 años y payback a 6 meses" (Forrester TEI, encargado por ellos). G2 4.5, Trustpilot 4.2.
- "90%+ de los creativos certificados en herramientas AI", "50+ AI-powered workflows" internos.

### 2. Superspace — anatomía

Superficies confirmadas:

| Superficie | Qué hace |
|---|---|
| **Briefing** | submit de proyectos en el workspace; el AI Briefing Agent completa el brief desde un pedido crudo |
| **Project Plan View** (feb 2026) | briefs + estimados + timelines + milestones en un dashboard; aprobación en un click; sync automático del brief |
| **Review de assets** | ver diseños/videos in-platform, anotaciones, **versionado**, feedback contextual, workflow de aprobación |
| **Chat por proyecto** | comunicación en contexto, reemplaza mail |
| **Account Analytics** (ene 2026) | balance, uso, timelines 3/6/12 meses, drilldown por equipo, forecasting |
| **Teams & roles** | crear equipos, asignar roles, **asignar presupuesto por equipo**, gasto en tiempo real |
| **Integraciones** | Slack, MS Teams, Asana, Jira, Monday, Wrike |
| **Superads** | analytics de creative performance (adquirido/lanzado nov 2024) |

### 3. Brand Brain — el componente a estudiar de verdad

Lo describen como "evolving intelligence layer" por cliente, que captura:

- guidelines, tono de voz, misión, mensajes, personas de audiencia
- **campañas pasadas, assets finales, referencias, feedback y datos de performance**
- **roles del equipo, preferencias individuales y flujos de aprobación**

Y alimenta con eso tanto a la plataforma **como a los creativos humanos asignados**.

Agentes que corren encima:
1. **AI Briefing Agent** — idea cruda → brief accionable, con specs y referencias sacadas del Brain
2. **AI Insights Agent** — consultar data de campañas y contenido sin buscar archivos
3. **Brand Models** — modelos visuales custom entrenados por marca, para explorar direcciones antes de producción
4. **Apps** (coming soon, mar 2026) — automatizar tareas repetitivas: resize, workflows de producción
5. **QA estructurado** antes de la revisión humana

**La diferencia real con el Brand Kit de Coevo no es la profundidad — es el loop.** El data model de Coevo es *más rico* en assets (multi-foto por producto y prenda, poses, look&feel, voice presets con clonado real, consistency anchor). Pero el Brain de Superside come **feedback y performance de proyectos pasados**, y eso compone con el tiempo. Coevo tiene 3.200 filas en `generations.json` y ninguna alimenta la próxima generación.

### 4. Comparativa Superside vs Coevo

| Dimensión | **Superside** | **Coevo** |
|---|---|---|
| Qué vende | Servicio gestionado $30k/mes; software como wrapper (3% del ticket) | Output de agencia; software interno sin pricing |
| Escala del delivery | 800 personas | equipo chico + pipelines automatizados |
| Capa de generación | Brand Models + image gen in-platform (poco detalle público) | **Mucho más profunda**: 15+ tools verticales, multi-shot, consistencia, look&feel, TTS con clonado |
| Capa de **operación** | **Completa**: intake → brief → plan → review → aprobación → budget → analytics | ❌ **Prácticamente ausente** |
| Brand context | Brand Brain con loop de feedback + performance | Brand Kit + DNA + Design System, **sin loop** |
| Versionado de assets | ✅ nativo | ❌ (spec'd en campaigns.md Fase 2) |
| Presupuesto / costo | Por equipo, tiempo real, forecasting | doc `pricing-credits.md`, **sin implementar** |
| Performance de las piezas | Superads | ❌ |
| Integraciones | Slack, Teams, Asana, Jira, Monday, Wrike | ❌ |
| Portal del cliente | Es *el* producto | `/portal/:token` a medias |

### 5. Plan priorizado para Coevo (uso interno primero)

El gap no está en la fábrica — está en la recepción, el mostrador y la contabilidad.

#### 🔴 ALTA — sin esto no podés "frontear" la operación
1. **Entidad `Request` / pedido.** Hoy todo arranca como una corrida de tool; no existe "pedido de un cliente". Es el eslabón que falta entre la operación real y la app. Se encaja con la entidad `Campaign` ya spec'd en [campaigns.md](campaigns.md) Fase 1 — no es trabajo nuevo, es priorizarlo.
2. **Costo real por pieza.** Cada job ya es una llamada a API con precio conocido (Kling V3 Pro 5s = $0.56). Agregar `cost` al registro de generación es un campo — y desbloquea la métrica que define si la tesis del negocio funciona: **COGS por pieza entregada**. Es la Fase 1 de `pricing-credits.md`, que ya está escrita y sin hacer.
3. **Loop de feedback → Brand Kit.** Tenés `reviews.json` (11 filas) y 3.200 generaciones. Que la selección/rechazo de una variante escriba de vuelta al Design System de la marca es lo que convierte al Brand Kit en un Brain.

#### 🟡 MEDIA
4. **Vista de estado tipo Project Plan** — qué está en curso, qué espera aprobación, qué se entregó. Hoy `GenerationBoard` es historial, no pipeline de trabajo.
5. **Versionado por imagen** (v1/v2/v3, revert) — [campaigns.md](campaigns.md) Fase 2.
6. **Portal del cliente v1 real** sobre `/portal/:token`, con aprobación y comentario contextual.

#### 🟢 BAJA — no copiar
7. **Integraciones con Asana/Jira/Monday.** Tienen sentido con clientes enterprise que ya viven ahí. Para la operación propia es overhead.
8. **Chat por proyecto.** Si el equipo es chico, WhatsApp/Slack ya lo resuelve.

### 6. El ángulo de financiación — lectura honesta

Superside levantó sobre el **servicio**, no sobre Superspace. Lo fundable de Coevo no es la tool: es la **evidencia de que la tool cambia la unidad económica de la agencia**. Eso son tres números, y hoy no se pueden calcular:

1. **COGS por pieza entregada** (requiere el punto 🔴2)
2. **Throughput por operador** — piezas/semana por persona (requiere 🔴1 para saber qué es "una pieza pedida")
3. **Margen bruto por cliente** — vs el ~40-60% típico de agencia

Con esos tres medidos sobre marcas reales durante un trimestre, tenés algo que un inversor no puede discutir y que Superside tardó 800 personas en construir. Sin ellos, es una demo linda.

**El otro activo que ya tenés y no estás usando: 3.200 generaciones reales sobre 13 marcas.** Eso es data de producción, no un deck. Instrumentarla es más barato que construir features nuevos.

### 7. Diferenciadores defendibles de Coevo vs Superside

1. **Verticalidad de moda/ecommerce** con profundidad que Superside no publica: Fashion Reel multi-shot con face anchor, Ecommerce Pack outfit × pose, consistency anchor, multi-foto por prenda
2. **Voice presets con clonado real** (ElevenLabs) — Superside no menciona audio propio
3. **Look & Feel transfer modo Receta** (Gemini Vision → texto)
4. **Costo marginal real por pieza** ≈ centavos vs un equipo humano de 800 personas — la ventaja estructural, si se mide
5. **Velocidad de iteración del producto**: acá una tool nueva es un directorio + un registry entry

### 8. Caveats

- ⚠️ **No usamos Superspace.** Todo viene de marketing, help center y `/llm-info`. La UI real, la calidad del Briefing Agent y qué tan "evolving" es el Brand Brain no están auditados.
- ⚠️ El **"~35% más eficiencia"** es self-reported. El estudio Forrester TEI fue **encargado por Superside** — es marketing con metodología, no auditoría independiente.
- ⚠️ **Brand Models** ("modelos visuales custom por marca") no aclara si es fine-tuning real o prompt/LoRA. Diferencia material para comparar contra el approach de Coevo.
- ⚠️ **Apps** figura como "coming soon" en el update de marzo 2026 — puede no existir todavía.
- ⚠️ Pricing a agosto 2026; los tiers de $30k/$20-50k pueden moverse.
- ⚠️ La comparación "Coevo tiene capa de generación más profunda" se apoya en que Superside **no publica** el detalle. Ausencia de evidencia ≠ evidencia de ausencia.

### 9. Preguntas abiertas

1. ¿**Brand Models** es fine-tuning real por marca? Si sí, es la pieza técnica más valiosa que tienen y la más cara de replicar.
2. ¿Cómo cierra el loop Brand Brain ↔ feedback? ¿Es RAG sobre proyectos pasados o hay algo estructurado?
3. ¿Qué % del delivery de Superside es realmente AI vs humano? "12.000 proyectos AI-powered" sobre 200.000 totales sugiere **~6%** — mucho menos "AI-first" que el marketing.
4. ¿El software fee de $1.000/mes se cobra aparte porque planean venderlo standalone en algún momento?
5. Con $30k/mes de piso: ¿qué pasa en el segmento de marcas que necesitan volumen pero no pueden pagar eso? Ese es el hueco donde entra Coevo.

### 10. Fuentes

- https://www.superside.com/enterprise
- https://www.superside.com/our-technology
- https://www.superside.com/llm-info (la más densa — la publican para LLMs)
- https://www.superside.com/updates
- https://help.superside.com/en/articles/13441460-intro-to-superspace
- https://help.superside.com/en/articles/13257393-what-is-superside

### 11. UI verificada por screenshots (2026-08-25)

Evidencia directa del walkthrough del producto — esto **corrige el caveat** de la sección 8 ("no vimos la UI"). Ya no es inferencia de marketing.

#### Home — el intake es un prompt, no un dashboard

La pantalla principal de un servicio de $30k/mes es **un campo de texto**: *"What can we do for you?"* con botón de **dictado** y flecha de submit, sobre una ilustración a página completa ("Brief in. Breathe out.", acreditada a una ilustradora del equipo).

Debajo, **prompt suggestions** en 3 cards con contador: `About Superside (8)` · `Project insights (5)` · `Create a brief`.

Y una sección "Let's get started": barra de progreso **"50% completed"** con checklist de onboarding ("Complete your profile — 1 min"), al lado de una card "Your Superside Team" con el PM asignado por nombre y foto + **saludo en video**.

#### Sidebar — Brand Brain es destino, no configuración

```
[+ Create new]
Home · Projects · Assets › · Brand Brain
── Favorite projects (5, con dot de color)
── Recents (con ícono por tipo de acción)
── Account
```

**`Brand Brain` es ítem de nav de primer nivel**, hermano de Home y Projects. No vive adentro de un settings.

#### Projects — trabajo y plata en la misma pantalla

- Header: `Display by Status` · buscar · ordenar · filtrar · **[Create project]**
- Chips de filtro: **`Action required`** · **`Unread message`** · Status · Collaborator · Deadline · Team
- Tabs: **List | Calendar**
- Agrupado por `Open (7)` / `Ideas (2)`. Cada fila: nombre + nº de piezas + **código de job** (345, 789654) + `Due in X days` + pill de estado (`In progress` / `Action required` / `Draft`) + inline un thumbnail con **"DESIGN DELIVERED · 2h · Waiting for approval"** y punto rojo.
- **Rail derecho: `ACCOUNT SUMMARY`** — presupuesto restante **por equipo**, en dólares, al lado del trabajo: Sales team $8.606 · Marketing team $26.589 · Operations $3.600.

#### Brand Brain — composición confirmada

La animación del video lo desglosa literal en cinco entradas:

`Your teams` (Sales 10 · Marketing GTM 8 · Brand 14 personas) → `Your Superside team` (humanos asignados con tags de rol: Graphic Designer, Creative Director) → `Your brand context` (stack de imágenes) → `Your guidelines` → **`Your past projects`** → **`Your feedback`**

Queda confirmado lo que se había inferido: **el feedback y los proyectos pasados son input de primera clase del Brain**, no un log.

#### Lecturas nuevas para Coevo

1. **El intake es una caja de texto con dictado.** No un formulario. Coevo ya tiene `ChatPanel` y dictado es-AR en Manual Lab v2 — la pieza existe, está en el lugar equivocado.
2. **El presupuesto vive al lado del trabajo**, no en una página de billing. Refuerza el costing layer: el número tiene que estar donde se decide, no en un reporte.
3. **Vocabulario de estado chico y accionable**: `Action required` / `In progress` / `Draft` / `Waiting for approval`. Todo el filtrado es "qué necesita algo de mí".
4. **El onboarding es una barra de progreso.** Los tiers de [client_onboarding.md](client_onboarding.md) son exactamente eso, pero en un markdown que el cliente nunca ve.
5. **Venden a los humanos a través del software** (PM con nombre, saludo en video, tags de rol, stack de avatares). Coevo tiene el problema inverso: casi no hay humanos. **No copiar el teatro humano** — sí copiar la claridad de "quién responde por esto".
6. **Tab Calendar** al lado de List — el Content Calendar que Coevo tiene en "Planned".

---

## Genera.Space (https://generaspace.ai/)

- **Fecha de investigación:** 2026-09-01 · verificación en vivo 2026-09-02
- **Método:** 4 streams paralelos (producto/pricing · empresa/founders · UX/tech · landscape), ~120 URLs, HTML crudo + CSS + bundles JS + headers HTTP, prensa primaria
- **Confianza:** ALTA en producto, pricing, stack y equipo (verificado en fuente primaria). NULA en funding (no existe evidencia pública). BAJA en claims de clientes autodeclarados.
- **Marcado:** `[V]` verificado en fuente primaria · `[I]` inferido

### TL;DR

Genera es el competidor frontal de la tesis "moda + e-commerce". No es una startup de AI que aprendió moda: es un **spin-off de OMEGARENDER**, estudio de visualización arquitectónica CGI (~150 personas, clientes Zaha Hadid / Foster + Partners / Gensler). Su ventaja es tratar la prenda como **render, no como generación** — proyectan la textura real del packshot sobre geometría generada y corrigen la divergencia con "automasking". Corren **pesos propios sobre GPU alquilada** (RunPod + Hostkey), no son orquestadores sobre Fal/Replicate.

Su punto ciego, admitido por escrito y verificado en vivo: **no tienen video**, y su roadmap lleva un mes vencido.

### 1. Identidad y equipo `[V]`

| Dato | Valor |
|---|---|
| Entidad legal | **Evolox, Inc.** |
| Origen | Spin-off de **OMEGARENDER** (visualización arquitectónica, ~150 personas, desde ~2015) |
| Lanzamiento | 19-feb-2025 |
| HQ declarado | New York — ⚠️ contradicho por señales EU/UK/UA (ver caveats) |
| Funding | ❌ **NO ENCONTRADO**. Crunchbase/Dealroom 403. `[I]` probable bootstrap con cash flow de Omegarender |

**Ejecutivos** ([/team](https://www.generaspace.ai/team)):

| Persona | Rol | Background |
|---|---|---|
| Artem Kupriianenko | Founder/CEO | Arquitecto; fundó OMEGARENDER; 15+ años CGI/hiperrealismo |
| Sofia Polyakova | COO | 10+ años en moda |
| Anton Averich | CTO | 13+ años SWE/ML — **Samsung, Skylum (Luminar)** |
| Oleksii Fedorenko | Head of AI Research | *"Pioneered proprietary garment replication technology"* |
| Daniil Khayrutdinov | Artistic Director | Moda + dirección de arte |
| Olga Vasenkova | Head of Content | 10+ años producción moda/film |

**Advisor:** Keiron Birch, ex-VP of Design de **Calvin Klein** — anunciado en el PR de feb-2025 pero ⚠️ **ya no figura en la página de equipo**.

### 2. Producto — módulos `[V]`

| # | Módulo | Estado (verificado 2026-09-02) |
|---|---|---|
| 01 | **PDP Module** | 🟢 LIVE — 5 imágenes on-model por SKU en ~20 min desde flat lay / ghost mannequin / tech pack |
| 02 | **Lookbook & Campaign** | 🟢 LIVE — set design custom, masters **6K print-grade** |
| 03 | **Face Builder** | 🔴 *"Coming soon — August 2026"* ⚠️ **VENCIDO** |
| 04 | **Video Module** | 🔴 *"Coming soon — August 2026"* ⚠️ **VENCIDO** |

Verificado en vivo el 2026-09-02: la home sigue diciendo "August 2026" para ambos.

**Autoconfesión textual** en su blog comparativo (21-ago-2026), sección *"What we don't do today, so you don't discover it later"*:
> *"There is no first-party Shopify app — enterprise integrations run through API & SDK. **The video module is still in development while competitors ship theirs.** There is no consumer try-on widget."*

⚠️ El PR de 2025 anunciaba **"AI Try-On"** como producto. En 2026 lo niegan explícitamente. Feature muerto o nunca shippeado.

### 3. El moat técnico — "100% clothing replication"

**Evidencia dura del stack de generación** `[V]` — [/security](https://generaspace.ai/security) lista subprocesadores nominalmente (única página donde legalmente deben decir la verdad):

| Proveedor | Rol declarado |
|---|---|
| **RunPod** | ***"compute for model workloads"*** |
| **Hostkey** | ***"compute and hosting"*** (bare-metal EU) |
| GCP + Firebase | hosting / application platform |
| Stripe | pagos |

**Cero rastro de fal.ai, Replicate, OpenAI, Stability o Midjourney** en 280 KB de bundles + HTML (grep verificado). Un orquestador sobre APIs no declara RunPod como subprocesador de *model workloads*.

**Arquitectura probable** `[I]`:
```
Packshot original (píxeles reales de la prenda)
  → generación de pose/cuerpo/escena
  → warp/proyección de la textura REAL sobre geometría generada
  → automasking: detecta divergencia vs. el packshot fuente y corrige
  → Enhance (artefactos) → Upscale → QA humano
```

El "100%" **no es propiedad del modelo generativo — es el resultado de un pipeline de saneamiento de 4 etapas con humano al final.** Prueba: existe un Enhancer dedicado a matar artefactos que ellos mismos enumeran (*"noise riding on skin, blotchy patches, texture that goes waxy"*), y una lección entera de **manual masking**. Nadie construye eso si la primera pasada sale limpia.

**El insight de fondo:** su ventaja no es mejor prompting, es **tratar la prenda como asset con textura a proyectar** (linaje UV/projection mapping de CGI arquitectónico), no como concepto a generar.

**Modelos AI = personas reales escaneadas** `[I fuerte]`. De [/blog/face-lab](https://www.generaspace.ai/blog/face-lab): *"Each run uses the next of the bodies of **the very people this face was cast from**"*. Y de [/blog/ai-model-roster](https://www.generaspace.ai/blog/ai-model-roster): *"consent and revenue terms are documented rather than implied"*. Por eso pueden garantizar consistencia y rights-cleared a la vez.

### 4. Face Lab — la pieza más copiable

Roster de **54 identidades numeradas** (`0065`, `0076`, `0086`…), no nombradas, todas fotografiadas en condiciones idénticas (fondo gris, luz plana, frontal, hombros descubiertos) para comparación tipo casting book. Diversidad como argumento comercial, no moral: vitiligo, albinismo, modelo maduro con barba gris, cinco tonos de pelirrojo. Justificación: *"A brand selling into three regions needs models those regions recognise."*

**Face Lab = 7 tabs:** Cast · Edit · Makeup · Tone · Refine · Body · Wardrobe/Shot.

Lo brillante del Cast: **no se promptea con texto — se suben referencias etiquetadas por propósito** ("labios y ojos de esta, nariz de aquella, corte de pelo de la tercera"). Filosofía citada:
> *"A reference is an instruction, not an atmosphere."*

Genera **9 caras candidatas simultáneas**, con grupos de cast por letra (A/B/C) para consistencia: *"image 400 has the same face as image 1 — same bone structure, same proportions, same skin."*

### 5. Pricing y unit economics `[V]`

| Plan | Precio | Créditos/mes | $/crédito |
|---|---|---|---|
| Starter | $29/mes | 75 (+75 bonus) | $0.39 |
| Pro | $99/mes | 300 | $0.33 |
| Ultra ⭐ | $199/mes | 650 | $0.30 |
| Enterprise | custom | 100.000+ img/mes | — |

- **Sin feature-gating entre tiers** — solo volumen. Todos incluyen PDP + Campaign + Smart Upload + modelos + colaboración.
- **Sin free trial, sin plan anual, sin rollover documentado.** Su propio blog comparativo lista free tiers de FASHN/WeShop/Modelia y para sí mismo solo pone "$29/mo".
- Créditos por operación: **Enhance = 2, Upscale = 10**. ❌ El costo de la **generación base no está publicado** — hueco real de transparencia.

**⚠️ Inconsistencia en el costo por imagen.** El claim de `/pricing` es **$0.25–1.50**, pero su propio home dice *"from $0.50"*, Forbes reporta $0.50–1.50, y su caso Vestira ($5–8 por SKU de 5 imágenes) da **$1.00–1.60/imagen**. **Usar $0.50–1.50 para modelar. El $0.25 no se sostiene ni en su propia comunicación.**

**Unidad comercial — el mejor movimiento del sitio:** **$5–8 por SKU** = 4 imágenes PDP + 1 de marketing, en ~20 min. Cotizan la unidad de negocio del cliente, no la unidad técnica.

**Su propio punto de quiebre declarado:** *"Genera starts earning its keep around 50 SKUs a season."*

### 6. Batch y servicio humano

- 5.000 SKUs en un batch simultáneo; 10.000 imágenes finales/24h; 100.000+/mes por marca `[claims propios]`
- ⚠️ Forbes reporta **2.000 imágenes/día**, que contradice el 10.000/24h del sitio
- **"Genera Trusted Partner"**: equipos humanos de producción y QA entrenados por Genera, que hacen full-cycle para clientes sin recursos internos

`[I]` **No es puro software — venden servicio disfrazado de SaaS.** Ese es el unit economics real del $1.50/imagen vs. el $0.04 de FASHN.

**El input que exigen para máxima fidelidad** ([/blog/fitting-photography-guidelines](https://www.generaspace.ai/blog/fitting-photography-guidelines)): 3 cámaras en eje recto, 18 frames por producto, modelo humano 175-180cm, focal 100mm+, f/8, 5500K, WebP 5000px sin retoque. `[I]` **No reemplazan la sesión de fotos — reemplazan la sesión cara por una técnica y barata.**

### 7. Clientes — lo verificado vs. lo fabricado

**❌ Case studies del sitio, probablemente ficción:** *Vestira* (5.000 SKUs/24h, quote de "Emma Collins"), *Velva* (print 3 días, quote de "Iris Lindqvist"), *Komod*, *Órra*. Ninguna existe como marca buscable. Sin logos, sin links, sin fotos. Nombres derivados del latín (*vestire* = vestir). **Tratar como copy, no como prueba.**

**✅ Clientes reales — están en Forbes, no en su sitio** ([Forbes abr-2026](https://malaysia.news.yahoo.com/genera-bets-replace-fashion-photoshoot-211110358.html)):
- **Le Coq Sportif** — quote on-the-record del CEO **Alexandre Fauvet**: *"What used to require a €5,000 photoshoot… can now be executed on demand."* Reemplazaron hasta **70%** del workflow tradicional
- **ECCO** · **Zalando** · **Ttswtrs**

⚠️ **El claim de clientes encogió: "60+ marcas" (feb-2025) → "25+ marcas" (2026).** O el 60 contaba pilots, o hubo churn.
⚠️ **LVMH / Karl Lagerfeld** aparecen en un snippet de búsqueda pero **NO están en la fuente primaria**. No usar.

### 8. Tech stack `[V]`

| Capa | Marketing site | App (`app.generaspace.ai`) |
|---|---|---|
| Framework | **Astro** + Tailwind v4 | **React + Vite** |
| UI | Inter var self-hosted | **MUI + Emotion** |
| Estado | — | **Zustand** |
| Backend/Auth | Cloudflare | **Firebase** (`genera-408110`) |
| API | — | REST propia + **SSE** (`/generation/events`) |
| Analytics | GTM/GA4/Meta/Pinterest | **PostHog EU** |
| Compute | — | **RunPod + Hostkey** |

**Postura de seguridad notable:** CSP estricta, `frame-ancestors 'none'`, HSTS 1 año, permissions-policy que apaga cámara/micrófono/geolocation. Poco común en marketing sites — señal de disciplina de ingeniería.

**Diferencia clave con Coevo:** SSE para progreso de generación. Coevo hace polling; para lotes de 5.000 SKUs el polling no escala.

### 9. Diseño visual `[V]`

Paleta extraída de `/_astro/BaseLayout.DkajShaW.css` — grises neutros + **un solo acento**:
```css
--color-paper: #020202   /* dark default */
--color-ink:   #ffffff
--color-rule:  #1f1f22
--color-accent: #095dff  /* azul eléctrico — único color */
```
Cero gradientes, cero púrpura-IA. **Azul frío = "infraestructura", no "herramienta creativa"** — contraste deliberado con el burgundy cálido `#c45830` de Coevo, que comunica agencia/craft.

Tipografía: **Inter Variable** con escala completa de line-height + letter-spacing por nivel (hero `.97`/`-.02em` … micro `1.3`/`.04em`), espaciado fluido con `clamp()` sin breakpoints, y un `--brand-baseline` que sugiere baseline grid real. `[I]` Se lee como *Vogue Business* diseñado por un equipo de dev tools — le habla al director de arte y al head of e-commerce ops a la vez.

### 10. Copy — el arsenal retórico

**El ataque central** ([/why-genera](https://generaspace.ai/why-genera)):
> *"Every tool on your shortlist makes an image. The question is what happens when you need five thousand of them, exact, by Friday."*

**La concesión que lo hace creíble** (sobre la foto tradicional):
> *"Still the right tool for one-off brand moments where the physical world is the point."*

No dicen "la foto murió". Dicen: la foto sirve para el momento de marca, **el catálogo es otro problema**. Desarma al director creativo defensivo y reencuadra hacia volumen, que es donde ganan.

**El cementerio de competidores** — tienen un post entero (*"HuHu AI Is Gone: 7 Best Alternatives"*) listando quién murió: HuHu AI (discontinuado), Lalaland (absorbida por Browzwear), ZMO.ai (sitio caído), Resleeve/Vmake (se fueron de moda), VModel (degradó su fashion studio). **Convierten la mortalidad del sector en argumento de permanencia.** SEO + FUD + prueba de solidez en un movimiento.

**Segmentación antes del pricing:** sección *"Who are you?"* → *"Three ways in"* (growing brand / enterprise / solo creator), cada uno con su propio precio y objeciones.

### 11. Comparativa Genera vs Coevo

| Dimensión | **Genera.Space** | **Coevo** |
|---|---|---|
| Fidelidad de prenda | **Pipeline propio: proyección + automasking + QA humano** | Prompt engineering (Consistencia) — ver `decisions-log.md` 2026-06 |
| Modelos de generación | **Pesos propios en GPU alquilada** | Orquestación (Nano Banana / Kling vía Fal) |
| **Video** | ❌ **prometido ago-2026, NO lanzó** | ✅ **Fashion Reel multi-shot, motion hints por toma, face anchor** |
| **Voz / audio** | ❌ inexistente | ✅ **ElevenLabs, voice presets, clonado, lip-sync** |
| Avatar/modelo | Casting book numerado, 54 IDs, personas reales escaneadas | Avatar Sheet + Consistencia (anchor, no face-lock) |
| Batch | 5.000 SKUs/job, folder import con reporte | Ecommerce Pack (flujo listo, generación sin cablear) |
| Progreso de jobs | **SSE** | Polling |
| Pricing | Público, por SKU ($5–8), $29–199/mes | Interno, sin pricing |
| Idioma / mercado | EN global, PR-driven, sin LATAM | **Español nativo, relación directa** |
| QA | Automasking + Trusted Partner (humanos) | Curación manual |
| Prueba social | Le Coq Sportif, ECCO, Zalando (vía Forbes) | Clara Ibarguren, PROMAN |

### 12. Plan priorizado para Coevo

#### 🔴 ALTA — robar ya, bajo esfuerzo
1. **Cotizar por unidad de negocio, no por imagen.** "$X por ficha de producto = N fotos + 1 de marketing". Aplica directo al proyecto Clara. Es el mejor movimiento comercial del sitio.
2. **Automasking propio.** Un paso que compara el output contra el packshot fuente y corrige la divergencia *antes* del QA humano. Es la respuesta real al problema de fidelidad, y es más barato que mejorar el generador. Ataca exactamente la limitación conocida de Consistencia.
3. **Avatar como objeto persistente numerado**, no parámetro por generación. ID estable en el brand kit + protocolo de captura estandarizado. Es la versión madura del anchor del Lab.
4. **Cast por referencias etiquetadas por propósito** ("boca de esta, nariz de aquella") en vez de prompt de texto, con N candidatos simultáneos tipo casting sheet. Aplicable a Avatar Sheet.

#### 🟡 MEDIA — producto
5. **Secuencia forzada Enhance → inspección → Upscale**, con costos distintos que enseñan el orden correcto vía pricing. Racional: *"upscaling multiplies whatever it is given — artefacts included."*
6. **SSE en vez de polling** para progreso de generación.
7. **Reporte de import por carpeta** (qué entró, qué falló, por qué) — la pieza que le falta a Ecommerce Batch.
8. **Roadmap público con estados** (Live / Coming soon) — pero solo si se cumplen las fechas. Genera muestra el costo de no cumplirlas.

#### ⚪ NO copiar
- **La paleta.** Su azul dice "infraestructura"; el burgundy de Coevo dice "agencia/craft", coherente con vender output y no SaaS horizontal.
- **Case studies inventados.** Le costó credibilidad verificable: los clientes reales (Le Coq Sportif, ECCO, Zalando) están en Forbes y no en su home, mientras el home tiene marcas fantasma.
- **Competir de frente en stills on-model.** Foso de VFX + servicio humano que Coevo no tiene.

### 13. Caveats

1. **Funding: cero evidencia.** No es prueba de que no exista, pero Crunchbase y Dealroom bloquearon con 403. ⚠️ **Falso positivo a descartar:** "Genera Raises $10M Seed" (First Round, ago-2026) es **genera.sh, otra empresa** — deployment de software enterprise.
2. **Huella de usuario independiente: nula.** Sin Product Hunt, sin G2, sin Capterra, sin Trustpilot, sin Reddit. Todo lo que se sabe del producto lo dicen ellos. Contrapeso: **blog semanal sin fallar los jueves**, último post 28-ago-2026 — eso no se finge.
3. **Prensa PR-driven** (tienen Head of PR). Forbes ×3, Vogue Business ×2, Le Monde, Hypebeast — pero ausencia total de TechCrunch/Sifted (cobertura editorial ganada).
4. **Jurisdicción opaca:** HQ "New York" en el PR, pero privacy policy GDPR/UK-first, PostHog EU, Hostkey EU, LinkedIn del founder en `pt.linkedin.com`, Omegarender registrada como LLP en Bradford UK, equipo con nombres ucranianos. `[I]` Evolox Inc es envoltura US para vender a marcas americanas.
5. **No se pudo evaluar el fidelity visual real** de las muestras (WebFetch no renderiza imágenes). La inferencia de calidad es indirecta.
6. **UI de la app no observable** — `app.generaspace.ai` es SPA cerrada tras login.

### 14. Preguntas abiertas

- ¿Qué modelo base usan? Cero evidencia en cualquier dirección, ni siquiera en su propio post comparativo.
- ¿Cuántos créditos cuesta una generación base? No publicado.
- ¿Sigue Keiron Birch (el ancla fashion) en la empresa?
- ¿Por qué los clientes reales de Forbes no están en su propia home?
- ¿Cuándo lanzan video? El roadmap lleva un mes vencido — **es la ventana de Coevo.**

### 15. Fuentes

[Home](https://generaspace.ai/) · [/pricing](https://generaspace.ai/pricing) · [/platform](https://generaspace.ai/platform) · [/why-genera](https://generaspace.ai/why-genera) · [/team](https://www.generaspace.ai/team) · [/security](https://generaspace.ai/security) ⭐ (subprocesadores) · [/blog/face-lab](https://www.generaspace.ai/blog/face-lab) · [/blog/ai-model-roster](https://www.generaspace.ai/blog/ai-model-roster) · [/blog/ai-image-enhancer](https://www.generaspace.ai/blog/ai-image-enhancer) · [/blog/fitting-photography-guidelines](https://www.generaspace.ai/blog/fitting-photography-guidelines) · [/blog/ai-fashion-photography-platforms-compared](https://www.generaspace.ai/blog/ai-fashion-photography-platforms-compared) · [Forbes abr-2026 (vía Yahoo)](https://malaysia.news.yahoo.com/genera-bets-replace-fashion-photoshoot-211110358.html) · [PRNewswire feb-2025](https://www.prnewswire.com/news-releases/genera-is-a-fashion-disruptor-revolutionizing-the-industrys-outdated-processes-with-innovative-ai-technology-302379714.html) · [FashionUnited](https://fashionunited.com/press/fashion/genera-is-a-fashion-disruptor-revolutionizing-the-industrys-outdated-processes-with-innovative-ai-technology/2025022064602) · [VivaTech — Kupriianenko](https://vivatech.com/speakers/6e62765c-9331-f011-8b3d-6045bd903b46) · [Omegarender](https://omegarender.com/company) · Artefactos: `/_astro/BaseLayout.DkajShaW.css`, `app.generaspace.ai/assets/index-tukvlXfL.js`, headers HTTP

---

## AI Fashion / Apparel Photography — Landscape completo (2026-09)

- **Fecha de investigación:** 2026-09-01
- **Método:** 3 streams paralelos, 100+ URLs, verificación en fuente primaria (sitios de producto, pricing pages, docs oficiales, HTTP status, certificados SSL, timestamps de build) + prensa de negocio. Marcado `[V]` verificado en fuente primaria / `[I]` inferido de terceros.
- **Confianza:** ALTA en pricing, estado de vida/muerte e integraciones (verificado en vivo). MEDIA en funding (Crunchbase/PitchBook/Tracxn devolvieron 403 en varios casos). BAJA en claims de clientes autodeclarados.

### TL;DR — las cinco conclusiones

1. **El on-model AI puro no sostuvo una compañía independiente.** De los 8 players "AI-fashion-specific" originales, **5 murieron, pivotaron o fueron absorbidos** entre 2024 y 2026. Ningún blog "best of 2026" lo menciona porque ninguno visita los sitios que rankea.
2. **Stills está commoditizado.** Piso real de mercado **$0.017–$1.50/imagen**. Photoroom vende on-model por API a **$0.10**. Competir por $/imagen es competir contra el costo marginal de Fal.
3. **Los gigantes fallan todos en el mismo punto: personas y prendas.** Shopify (1MP + watermark), Google (excluye on-model explícitamente en su doc), Amazon (no renderiza manos ni personas de forma confiable). La barrera no es precio ni distribución — es que el calce es un problema técnico distinto.
4. **Video de moda es el gap verificado.** Genera.Space **incumplió su fecha de agosto 2026** y sigue sin lanzar. Cero rondas de VC a players verticales de video de moda. Demanda probada (+30% conversión en PDP).
5. **LATAM no está vacío — está mal cubierto.** Hay rivales locales reales (Delfi, Estudio Atlas, Fitit, Vitriny). Lo que no existe: **video de moda self-serve en español con workflow nativo LATAM.**

### 1. El cementerio — quién murió o pivotó `[V]`

| Player | Estado Sep 2026 | Evidencia dura |
|---|---|---|
| **ZMO.ai** | **MUERTO como marca fashion** → Creati.studio (video social) | 301 redirect; **cert SSL vencido desde 2026-02-19** |
| **Deep Agency** | **CONGELADO desde feb 2024** | Build `1707801932` = 2024-02-13; `/pricing` es shell vacío de Nuxt |
| **Lalaland.ai** | **ABSORBIDO** en Browzwear (jul 2025) | 301 → browzwear.com; sin path self-serve |
| **Vue.ai / Mad Street Den** | **PIVOTÓ** a orquestación enterprise genérica | `/products/ai-model-imagery/` da **404**; logos hoy son banca y automotriz |
| **BetterStudio** | **PIVOTÓ** a calzado/3D scans | footer con copyright "2025" |
| **VModel.ai** | **PIVOTÓ** a API genérica (compite con Fal/Replicate) | `<title>Deploy and Run AI Models with an API</title>`; `/ai-clothes-changer/` da 404 |
| **Pixelcut** | **REBRAND** → Pixa (2026-03-03), horizontal no-fashion | pricing sin ninguna feature fashion |
| **Booth.ai** | **MUERTO** (may 2025) | dominio a la venta; YC W23, se quedó sin runway |
| **Stylized.ai** | **MUERTO** | 307 → GoDaddy "forsale" |
| **Photoshoot.ai** | **DUDOSO** | dominio raíz → app SPA vacía, sin landing ni pricing |

**Lectura:** ZMO levantó **$8M de Hillhouse** y su fundadora se fue a video social. Lalaland levantó ~$2-3M y terminó dentro de un PLM. Vue.ai levantó **$57M** y hoy vende IA a bancos con 37 empleados. Es el patrón más consistente de toda la investigación.

### 2. Los que están vivos — tabla maestra

| Player | Especialización | $/imagen (derivado) | Video | API | Shopify | Funding `[I]` | Clientes `[V]` |
|---|---|---|---|:--:|:--:|---|---|
| **Photoroom** 🇫🇷 | Producto general **+ on-model API real** | **$0.10** (API Plus) | ✅ Max+ | ✅ +MCP | ✅ | **$64M tot., ~$500M val.**, ~$94M ARR | — |
| **Flair.ai** 🇺🇸 | On-model + joyería, preserva patrones/logos | ~$0.25 | ✅ | ✅ Scale+ | — | — | **Shein, Bonobos, Samsonite, Amazon, JLo Beauty** |
| **Genera.Space** | On-model fashion end-to-end (PDP/lookbook) | $0.30–0.39/créd.; $0.25–1.50 claim | ❌ **prometido ago-2026, NO lanzó** | ✅ Ent. | — | **NO verificado** (el "$10M seed" es de genera.sh, otra empresa) | "60+ marcas" **sin nombrar en su propio PR** |
| **On-Model / PiktID** 🇦🇹 | Flat-to-model batch, 10.000 SKUs/job | no publicado | ❌ | ✅ SDKs | ❌ | — | **Zalando, Fruit of the Loom, Russell Athletic, Didriksons, KiK** |
| **Veesual** 🇫🇷 | VTO + on-model on-site (multi-sizing) | demo-only | ✅ (VidCap) | — | — | **$7.5M seed** (AXA VP + Techstars) | **Eileen Fisher, Adore Me, Claudie Pierlot, La Redoute** |
| **Caimera** 🇮🇳 | Sketch/flat-lay → on-model | $1.17 catálogo / $3.51 editorial | ✅ | ✅ | ✅ | $700K pre-seed | "20.000+ marcas" ⚠️ no creíble |
| **Modelia** 🇪🇸 | On-model stills, pricing transparente | **$0.10–0.24** | ✅ | ✅ | ✅ | **€1.03M seed** (jun 2026, Next Tier) | **Desigual, AWWG, Fútbol Emotion** |
| **Botika** | Flat-lay → on-model, Shopify-first | ~$0.05–0.09 | ✅ 5 créd. | — | ✅ | — | — |
| **SellerPic** | Marketplace sellers, el más barato | **$0.017–0.073** | ✅ +lip-sync | ✅ | ⚠️ | — | — |
| **Uwear.ai** | Enterprise PAYG, único con MCP | $0.10/créd. (`/model-rates` da 404) | ✅ | ✅ +MCP | — | — | — |
| **WearView** | ⚠️ **probable SEO farm** con producto real | $0.40 HD / $1.00 4K | ✅ | Ent. | — | — | ⚠️ testimonios fabricados |
| **Scayle Studios** (Zalando) | **Producción de catálogo + video 4K** | **€4-5/producto** | ✅ **4K nativo** | — | — | Zalando | About You (+9,2% GMV) |

### 3. Horizontales y la amenaza de commoditización

| Plataforma | Fondo/escena | Video | **On-model apparel** | Precio | Techo |
|---|:--:|:--:|:--:|---|---|
| **Shopify Magic** | ✅ | ❌ | ❌ | Gratis *("for a limited time")* | **1MP + watermark invisible, 1 escena por vez** `[V]` |
| **Google Product Studio** | ✅ | ✅ *(LATAM excluido)* | ❌ **explícito en su doc** | **Gratis** | no soporta manos ni personas |
| **Amazon Creative Studio** | ✅ | ✅ 6-15s | ❌ falla con personas | **Gratis** | cuero que parece vinilo `[I]` |
| **Meta Advantage+** | ✅ | ✅ | 🟡 VTO en test | Incluido en ads | ad creative, no catálogo |
| **Higgsfield** | ✅ | ✅✅ **líder video** | ❌ sin fidelidad de prenda | $19–99/mes | **$700M ARR, $5.4B val.** |
| **Freepik → Magnific** 🇪🇸 | ✅ | ✅ ~50% del revenue | ❌ | $9–250/mes | **$230M ARR, bootstrapped, oficina en Colombia** |

**Veredicto:** la capa de *fondo y escena de producto* está commoditizada a **$0** — ese negocio ya no existe standalone (es lo que mató a Booth y Stylized). Pero los cuatro gigantes fallan en el mismo punto exacto: **personas y prendas**. Google incluso *genera demanda* de on-model: para ser elegible en Virtual Try-On, el retailer **debe subir imágenes on-model de alta resolución ya hechas**. Google consume on-model, no lo produce.

**Riesgo a vigilar:** el "for a limited time" de Shopify y que Google ya regale video indican que la frontera sube.

### 4. Respuestas a las preguntas

**A) Precio de mercado y guerra de precios.** Rango **$0.017 → $4.50/imagen**, dos órdenes de magnitud. No es guerra de precios: es **segmentación** (marketplace sellers vs. editorial de marca). El benchmark a batir es **Photoroom a $0.10 vía API**. Referencia tradicional `[V]`: **$130–830 por outfit**, ~$46/imagen en volumen, shoot mid-tier de un día = **$12.700**. El multiplicador oculto: el costo efectivo termina siendo **2-3x el presupuestado**.

**B) ¿Quién gana?** **No hay líder claro en fashion puro** — y esa es la noticia. Por balance mandan los horizontales (Higgsfield $5.4B, Photoroom $500M, Magnific $230M ARR), ninguno especializado en calce. Los dos sobrevivientes creíbles del vertical ganaron por vías opuestas: **Veesual** vende conversión on-site (no imágenes) y **On-Model/PiktID** vende infraestructura batch por API. Ninguno compite por $/imagen.

**C) Qué está commoditizado y qué sigue difícil.** Commoditizado: fondos, escenas, upscaling, remoción de fondo — gratis en Shopify/Google/Amazon. **Sigue difícil y sigue siendo EL problema duro: la fidelidad de la prenda.** Falla documentada en patrones finos, texto y logos, drape de tela, y texturas que salen plásticas. Es la razón por la que Magnific, con $230M ARR y rentable, **eligió no construirlo** — un bootstrapped no deja plata en la mesa por descuido.

**D) ¿Video de moda? Espacio vacío — confirmado.** Genera.Space prometió video para **agosto 2026 y no lanzó** (su página seguía diciendo "coming soon" en septiembre). Botika lo trata como add-on a 5x el costo de una foto (techo ~200 videos/año en el plan de $100). **Cero rondas de VC a players verticales de video de moda** — todo el capital fue a stills y try-on. El único "video-first" (V4b.AI) opera como agencia con turnaround de 2-3 días. Los únicos con video de verdad integrado son Zalando/Scayle (solo EN/DE) y dos startups argentinas. Demanda probada: **+30% conversión en PDP, +94% con autoplay <30s, +225% add-to-cart**. Los modelos base (Kling, Veo 3.1, Seedance vía Fal) ya están disponibles y baratos.

**E) ¿LATAM/español? Hueco de posicionamiento, no geográfico.**
- **Delfi** 🇦🇷 (2024, 38 empleados) — el rival más directo: video + **Falabella, Ripley, Paula Cahen D'Anvers**, opera en 7 países. Modelo pesado: concierge con envío de prendas físicas.
- **Estudio Atlas** 🇦🇷 — self-serve, video UGC, **integrado a Tiendanube**, 250+ marcas pagas, levantando US$400K pre-seed.
- **Fitit** 🇺🇾 — bootstrapped, +1M usuarios, **Adidas, Crocs, Nike**; cambia ropa sobre modelos reales.
- **Vitriny / 1001 Clicks** 🇧🇷 — **R$ 3,68-4,78/imagen**, solo stills.
- **Modelia** 🇪🇸 — Desigual/AWWG, solo stills.
- Los globales con español (WearView, PromeAI) son **traducciones de UI, no productos localizados**. Solo FashionPro.ai tiene optimización real para Mercado Libre.
- Precedente validado: **Rokon** se construyó nativo en árabe/RTL para MENA. Nadie hizo eso para español a nivel de *workflow*.

**F) ¿Shopify/Amazon nativo?** Sí, y es gratis — pero **acotado a producto, no a on-model apparel**. Shopify: 1MP, una escena por vez, marca de agua invisible, sin video, y el "gratis" es explícitamente temporal. Google: gratis y con video, pero **excluye on-model en su documentación** y deja a LATAM fuera del video. Amazon: gratis pero no renderiza personas confiablemente. **Riesgo de commoditización para stills de producto: ALTO y ya consumado. Para on-model con calce: BAJO hoy.**

### 5. Lecturas para Coevo

1. **No competir por $/imagen en stills.** El piso lo fija el costo marginal de Fal. Cualquiera revende Nano Banana a $0.02.
2. **El gap defendible es la intersección video × español × calce.** Ninguno de los ~25 players analizados cubre los tres. Es exactamente donde apunta el stack existente: anchor de consistencia, multi-foto por prenda (`ClothingItem.images[]`), Fashion Reel multi-shot con face anchor.
3. **La fidelidad de prenda sigue siendo el foso.** Es lo que Google no hace, lo que Magnific decidió no construir, y lo que hace que Amazon convierta 8-15% peor. La limitación conocida de Consistencia (prompt engineering, no face-lock real — ver `decisions-log.md` 2026-06) es el punto exacto donde se define si hay producto o no.
4. **Vender resultado, no herramienta.** Veesual vende conversión, On-Model vende throughput por API. Los que venden "imágenes lindas" murieron.
5. **Benchmarking honesto:** usar solo **Veesual, On-Model, Caimera, Modelia y Scayle**. Descartar WearView (testimonios fabricados, logos de Amazon/SHEIN que son marketplaces de sus usuarios) y Caimera en volumen ("20.000+ marcas" con $700K levantados).
6. **Riesgo principal a monitorear: Scayle Studios.** Video 4K a €4-5/producto con respaldo Zalando y 80.000 outfits en 30 días. Hoy solo EN/DE. **Si localiza a español, cambia el tablero.**

### Fuentes contaminadas — no usar

Los "best of" que dominan la búsqueda están escritos por los propios competidores: `wearview.co/blog/*` (se rankea a sí mismo, testimonios falsos), `uwear.ai/blog/best-ai-fashion-generators`, `blendnow.com`, `metamodels.ai`, `aiorastudio.com`, más agregadores de afiliados (`nightjar.so`, `futurepedia.io`, `morphed.app`). **Los tres siguen listando Deep Agency, ZMO.ai y Lalaland como opciones vivas en artículos fechados 2026.**

Fuentes limpias usadas: sitios de producto y pricing pages (primaria), help.shopify.com, support.google.com/merchants, TechCrunch, WWD/Sourcing Journal, Forbes, Fortune, PRNewswire, FashionUnited, Silicon Canals, BoF, Sacra, Balderton, AVP, EU-Startups, La Nación, iProUP, El Observador, Cancillería Argentina.
