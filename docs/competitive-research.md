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
