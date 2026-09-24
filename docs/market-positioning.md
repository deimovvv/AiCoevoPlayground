# Market Positioning — dónde juega Coevo y por qué

Documento de estrategia de mercado. Responde tres preguntas: **qué nicho**, **contra quién**, y **con qué ventaja**. Se apoya en la investigación de `competitive-research.md` (Genera.Space + landscape completo, 2026-09).

**Cómo usar este archivo.** Léelo antes de decidir a qué cliente perseguir, qué feature priorizar, o cómo cotizar. Si un dato de competencia cambia, actualizá primero `competitive-research.md` y después revisá si mueve alguna conclusión de acá.

**Última revisión:** 2026-09-02

---

## TL;DR

El nicho correcto **no es "fotos de moda con AI"**. Ese mercado tiene piso de precio en $0.017/imagen, un foso técnico de VFX que Coevo no tiene, y cinco cadáveres recientes.

El nicho correcto es la intersección **video × español × calce**. Ninguno de los ~25 players analizados cubre los tres.

---

## 1. La corrección al análisis inicial

El análisis de partida rankeaba: (1) e-commerce/retail, (2) moda, (3) UGC/performance D2C — ordenado por **tamaño de mercado**. La investigación obliga a re-rankear por **dónde se puede ganar**, que no es lo mismo.

### Lo que el análisis original tenía bien
- Los tres son el mismo océano visto desde tres ángulos: marcas que venden producto físico online y necesitan contenido visual constante.
- UGC no es un vertical, es un **caso de uso transversal**. Correcto y sub-explotado en el propio análisis.
- "Entrar por moda, expandir a e-commerce" es la forma correcta de la jugada.

### Lo que estaba mal
1. **Rankeó por tamaño, no por ventaja.** Si la jugada es entrar por moda, moda es #1. La exigencia estética que se presentaba como desventaja de moda es en realidad **el foso** — es lo que impide que el segmento se commoditice.
2. **"79% de las marcas ya usa video con AI" se leyó como oportunidad.** Es lo contrario: si ya lo usan, ya se lo compran a otro. El pitch no es "esto existe", es "esto es mejor que lo que ya tenés". Mercado más difícil, no más fácil.
3. **Faltaba la mitad de la foto: la oferta.** Dimensionaba demanda sin nombrar un solo competidor. En un mercado con cinco muertos recientes, eso es el error caro.
4. **El dato de devoluciones (25-40%) estaba mal usado.** Es el único ROI que se paga solo en plata dura — pero reducir devoluciones requiere **virtual try-on** (el cliente ve *su* calce), que es un producto adyacente, no el de Coevo. No mezclarlos.
5. **El cierre era triunfalista.** Inmobiliaria y concesionarias se descartaron por ausencia de datos citados, que no es lo mismo que datos en contra.

---

## 2. El cementerio — la evidencia que reencuadra todo

De los 8 players "AI-fashion-specific" originales, **5 murieron, pivotaron o fueron absorbidos** entre 2024 y 2026:

| Player | Estado | Capital levantado |
|---|---|---|
| ZMO.ai | Muerto como marca fashion → video social | **$8M (Hillhouse)** |
| Lalaland.ai | Absorbido por Browzwear | ~$2-3M |
| Vue.ai | Pivotó a IA para bancos, 37 empleados | **$57M** |
| Deep Agency | Congelado desde feb-2024 | — |
| Booth.ai / Stylized.ai | Muertos, dominio a la venta | YC W23 |

**La lectura:** el on-model AI puro no sostuvo una compañía independiente. Levantar capital no salvó a ninguno. Y ningún artículo "best of 2026" lo menciona porque ninguno visita los sitios que rankea — **tres de esos listados siguen recomendando players muertos**.

Esto no dice "no entrar". Dice: **entrar por donde no entraron ellos.**

---

## 3. El ranking corregido

### 🥇 #1 — Moda / indumentaria con calce
**Por qué es #1 y no #2:** el foso. La fidelidad de prenda es el problema técnico que Google excluye explícitamente de su documentación, que hace que Amazon convierta 8-15% peor, y que **Magnific ($230M ARR, bootstrapped, rentable) eligió no construir**. Un bootstrapped no deja plata en la mesa por descuido — la dejó porque es difícil.

La exigencia estética de moda no es una desventaja: es la barrera que impide que el segmento caiga a $0.02.

**Ventaja de Coevo:** Morph, más el trabajo de fichas Clara con calce real documentado (ver `project_clara_ecommerce`).

### 🥈 #2 — UGC / performance para D2C
**Por qué sube al #2:** recurrencia estructural. El dolor se repite cada dos semanas por definición — siempre hace falta creativa nueva para testear. No hay que convencer de la necesidad, se renueva sola.

**Ventaja de Coevo:** el pipeline ya existe (UGC Creator 7 pasos, voz ElevenLabs, lip-sync). Es el único competidor analizado con **voz y audio** en el stack.

### 🥉 #3 — E-commerce genérico
**Por qué baja al #3:** es el mercado total, pero también el más commoditizado. Es adónde se expande, no por dónde se entra.

---

## 4. El gap de entrada: video × español × calce

> ⚠️ **Revisado 2026-09-02.** Video y español son **cuñas de entrada, no fosos**. Genera tiene video en desarrollo (cuando salga tendrá proyección de textura encima) y ya opera en Europa, así que puede cerrar ambos. Sirven para golpear la puerta ahora; la ventaja durable está en §11 (agencia propia como design partner, el mercado <50 SKUs que Genera declina, agencias como capa de cliente, costos LATAM).

Tres condiciones, ninguna cubierta por los tres a la vez:

### Video de moda — hueco verificado
- **Genera.Space prometió su módulo de video para agosto 2026 y no lanzó.** Verificado en vivo el 2026-09-02: la home sigue diciendo *"Coming soon — August 2026"*. Su propio blog lo admite: *"The video module is still in development while competitors ship theirs."*
- **Cero rondas de VC a players verticales de video de moda.** Todo el capital fue a stills y try-on.
- Botika lo trata como add-on a 5x el costo de una foto (techo ~200 videos/año en su plan de $100).
- El único "video-first" (V4b.AI) opera como agencia, turnaround 2-3 días.
- **Demanda probada:** +30% conversión en PDP, +94% con autoplay <30s, +225% add-to-cart.
- Los modelos base (Kling, Veo 3.1, Seedance vía Fal) ya están disponibles y baratos.

### Español — hueco de posicionamiento, no geográfico
⚠️ **LATAM no está vacío.** Rivales locales reales:

| Player | País | Qué hace | Clientes |
|---|---|---|---|
| **Delfi** | 🇦🇷 2024, 38 empleados | **Video**, opera en 7 países | Falabella, Ripley, Paula Cahen D'Anvers |
| **Estudio Atlas** | 🇦🇷 | Self-serve, video UGC, integrado a **Tiendanube** | 250+ marcas pagas |
| **Fitit** | 🇺🇾 bootstrapped | Cambia ropa sobre modelos reales, +1M usuarios | Nike, Adidas, Crocs |
| **Vitriny** | 🇧🇷 | Solo stills, R$3,68-4,78/img | — |
| **Modelia** | 🇪🇸 €1.03M seed | Solo stills | Desigual, AWWG |

**Delfi es el rival más directo** — ya hace video y ya tiene retail grande. Su debilidad: modelo pesado (concierge con envío de prendas físicas), que no escala igual.

Lo que **no existe**: video de moda **self-serve en español con workflow nativo LATAM**. Los globales con español (WearView, PromeAI) son traducciones de UI, no productos localizados. Precedente validado: Rokon se construyó nativo en árabe/RTL para MENA.

### Calce — el foso que hay que cruzar
Acá está el problema honesto de Coevo: **Consistencia es prompt engineering, no face-lock real** (documentado en `decisions-log.md` 2026-06). Genera resolvió esto con proyección de textura + automasking sobre pesos propios. Ese es el punto exacto donde se define si hay producto defendible o no.

---

## 5. Precio de mercado — no competir acá

| Player | $/imagen |
|---|---|
| SellerPic | **$0.017–0.073** |
| Botika | ~$0.05–0.09 |
| FASHN AI | $0.075 API · **<$0.04 a volumen** |
| **Photoroom (benchmark)** | **$0.10 API** |
| Modelia | $0.10–0.24 |
| Flair.ai | ~$0.25 |
| Caimera | $1.17 catálogo / $3.51 editorial |
| **Genera.Space** | **$0.50–1.50** |
| Scayle (Zalando) | €4-5/producto (video 4K) |

Rango total: **$0.017 → $4.50**, dos órdenes de magnitud. **No es guerra de precios — es segmentación** (marketplace sellers vs. editorial de marca).

**Referencia tradicional:** $130-830 por outfit; shoot mid-tier de un día = $12.700. El costo efectivo termina siendo 2-3x el presupuestado.

**Conclusión:** el piso lo fija el costo marginal de Fal. Cualquiera revende Nano Banana a $0.02. **Competir por $/imagen es competir contra el costo marginal de un proveedor de infraestructura.**

---

## 6. Amenaza de commoditización

| Plataforma | Fondo/escena | Video | **On-model apparel** | Precio |
|---|:--:|:--:|:--:|---|
| Shopify Magic | ✅ | ❌ | ❌ | Gratis *("limited time")* |
| Google Product Studio | ✅ | ✅ *(LATAM excluido)* | ❌ **explícito en su doc** | Gratis |
| Amazon Creative Studio | ✅ | ✅ | ❌ falla con personas | Gratis |
| Higgsfield | ✅ | ✅✅ | ❌ sin fidelidad de prenda | $19-99/mes |

**Veredicto:** la capa de fondo/escena está commoditizada a **$0** — ese negocio ya no existe standalone (mató a Booth y Stylized). Pero los cuatro gigantes fallan en el mismo punto: **personas y prendas**.

Dato clave: Google **consume** on-model, no lo produce. Para ser elegible en Virtual Try-On, el retailer debe subir imágenes on-model de alta resolución ya hechas. **Google genera demanda del producto de Coevo.**

- Riesgo para stills de producto: **ALTO, ya consumado**
- Riesgo para on-model con calce: **BAJO hoy**

---

## 7. La jugada

**Entrar por moda con video en español. Expandir a e-commerce general.**

1. **No competir por $/imagen en stills.** Terreno perdido de antemano.
2. **Cotizar por unidad de negocio del cliente**, no por generación. "$X por ficha de producto = N fotos + 1 video + 1 pieza de marketing". Es el mejor movimiento comercial de Genera y aplica directo al proyecto Clara.
3. **Vender resultado, no herramienta.** Veesual vende conversión on-site; On-Model/PiktID vende throughput por API. **Los que vendieron "imágenes lindas" murieron.**
4. **Atacar el calce como problema de ingeniería**, no de prompting. Automasking (comparar output contra el packshot fuente y corregir divergencia antes del QA) es el paso concreto — más barato que mejorar el generador.
5. **Video como cuña de entrada, no como identidad.** Hoy Genera no lo tiene y lo admite por escrito — sirve para abrir la puerta. Pero lo tiene en desarrollo, así que no se construye la marca encima.
6. **Apuntar al mercado que Genera declina.** Su punto de quiebre declarado es ~50 SKUs por temporada. La marca de 20 SKUs con 4 drops al año no es su cliente y no lo va a ser.
7. **Las agencias son la capa de cliente que nadie atiende.** Venderle a quien produce para marcas (tipo Delfi) no es competir con Genera — es estar en otra capa. Ver §11.

---

## 8. Riesgos a monitorear

| Riesgo | Señal de alarma | Impacto |
|---|---|---|
| **Scayle Studios (Zalando)** | Si localiza a español | 🔴 Cambia el tablero: video 4K a €4-5/producto, 80.000 outfits en 30 días, respaldo Zalando. Hoy solo EN/DE |
| **Genera lanza video** | Roadmap se descongela | 🟠 Cierra la ventana principal. Lleva 1 mes vencido |
| **Delfi levanta y se vuelve self-serve** | Ronda anunciada | 🟠 Rival directo con retail grande ya cerrado |
| **Shopify sube la frontera** | Se va el *"for a limited time"*, sube de 1MP, agrega video | 🟠 Su gratuidad es explícitamente temporal |
| **Calce no se resuelve** | Consistencia sigue siendo prompt engineering | 🔴 Riesgo interno, el más grave: sin foso técnico no hay producto defendible |

---

## 9. Benchmarking honesto

**Usar como referencia:** Veesual, On-Model/PiktID, Caimera, Modelia, Scayle, Genera.Space, Delfi.

**Descartar:** WearView (testimonios fabricados; los logos de Amazon/SHEIN son marketplaces de sus usuarios, no clientes), Caimera en volumen ("20.000+ marcas" con $700K levantados no cierra).

**Fuentes contaminadas** — los "best of" que dominan la búsqueda están escritos por los propios competidores (`wearview.co/blog/*`, `uwear.ai/blog/*`, `blendnow.com`, `metamodels.ai`) más agregadores de afiliados. Tres de ellos siguen listando Deep Agency, ZMO.ai y Lalaland como opciones vivas en artículos fechados 2026.

---

## 10. Preguntas abiertas

- ¿Se puede resolver el calce sin pesos propios? Genera usa GPU alquilada con modelo propio. ¿Alcanza con automasking sobre Nano Banana?
- ¿Cuál es la unidad de cotización correcta para video? Genera cotiza por SKU de stills; nadie publica precio de video de moda por unidad.
- ¿Delfi es competidor o comparable? Su modelo concierge sugiere que el mercado LATAM todavía pide servicio, no self-serve.
- ¿Vale construir try-on? Es el único ROI que se paga solo (devoluciones 25-40%), pero es producto adyacente y hay players dedicados.

---

## 11. Estructura de marcas y modelo de negocio

Definido en conversación 2026-09-02. Reemplaza la idea previa de "Coevo Studio" como marca única.

### Las tres entidades

| Entidad | Función | Le habla a | Quién la dirige |
|---|---|---|---|
| **Coevo** | Holding. Dueña de la IP, factura. **No es marca comercial** | Nadie / inversores | Facu (hermano) |
| **[nombre nuevo]** | El producto SaaS | Marcas y agencias | Gonzalo, full-time |
| **Morph** | Agencia creativa de moda. **Design partner y caso de éxito** | Marcas de moda premium | Keila |

**Por qué el producto necesita nombre propio:**
- "Morph" está saturado en la categoría (Morphic, Morphstudio.xyz, morphed.app aparecen en el propio research)
- Morph es marca de **criterio** (dirección de arte); un SaaS es marca de **capacidad**. Mezclarlas debilita las dos
- "Coevo Fashion" hereda el problema de que el producto no es el holding, y encierra en un vertical del que se quiere poder salir

**Morph no opera la herramienta como servicio de la tool.** Si el tier operado necesita equipo, va bajo la marca del producto. Morph queda como criterio creativo puro.

### El hallazgo que reencuadra el mercado: las agencias como cliente

Si agencias tipo **Delfi** contratan la herramienta para producirle a sus clientes, el producto **no compite con Genera — está en otra capa**. Genera le vende a marcas; el producto le vendería a quienes producen para marcas.

Consecuencia: **Morph deja de ser una excepción rara en la estructura y pasa a ser el arquetipo del cliente.** Herramienta construida por una agencia de moda para su propio dolor; hay cientos de agencias en LATAM con el mismo problema.

### Tres niveles de precio (estructural, no opcional)

| Cliente | Modelo | Referencia |
|---|---|---|
| Marca chica | Self-serve por créditos | **$3.5-4.5/SKU** |
| Marca mediana | Operado: fee + producción | Más alto, con servicio incluido |
| **Agencia (white-label)** | Volumen / reventa | Menor por unidad, mucho más volumen |

⚠️ **La tercera fila es la que Genera no atiende** y puede ser la que sostenga el negocio.

### Advertencia de pricing

Genera cobra **$5-8/SKU que el cliente opera** (el cliente sube packshots según su guía de fitting, castea, revisa, corrige, aprueba). Es precio de **insumo**.

Un SKU **terminado** —donde la agencia hace todo el trabajo— es otro producto y no se compara directo. **Vender terminado por debajo del precio de insumo de Genera es un error de pricing, no una ventaja competitiva.**

Y el costo marginal juega en contra: Genera corre pesos propios en GPU alquilada; Coevo paga API por generación. **No se puede ganar por precio contra una estructura de costos mejor.**

### El argumento "por qué nosotros y no Genera"

Estado honesto de los diferenciadores:

| Diferencial | Durabilidad |
|---|---|
| **Video** | ⚠️ **Temporal.** Genera lo tiene en desarrollo; cuando salga tendrá proyección de textura encima. Sirve de cuña de entrada, **no de identidad** |
| **Español / LATAM** | ⚠️ **Temporal.** Genera ya está en Europa (Le Coq Sportif, ECCO, Zalando); traducir UI les cuesta semanas |
| **Agencia propia como design partner** | ✅ **Durable.** Genera tuvo que inventar case studies (Vestira, Velva no existen). No se compra rápido |
| **El mercado que Genera declina** | ✅ **Durable.** Su punto de quiebre declarado: *"empieza a rendir alrededor de 50 SKUs por temporada"*. La marca de 20 SKUs no es su cliente y no lo va a ser |
| **Agencias como capa de cliente** | ✅ **Durable.** No está en su modelo |
| **Estructura de costos argentina** | ✅ **Durable.** No es idioma, es operación |

### Secuencia de inversión

Orden recomendado, contra el riesgo documentado de que este sector mata empresas financiadas (ZMO $8M, Vue.ai $57M, Booth.ai/YC):

1. ✅ **Backend dev** — única inversión que compra evidencia. Sin producto no hay qué validar
2. ⏸️ **Marketing** — todavía no. Los primeros 5-10 clientes salen de la red y de Morph. Recién con 3 marcas usándola solas se sabe qué comunicar
3. 🤔 **Socio** — vale más si trae clientes de moda o distribución en agencias que un empleado de marketing

### Qué falta antes de levantar ronda

**El dato que no existe: ninguna marca usó la herramienta sin Gonzalo operando.** Un inversor pregunta eso primero. Sin esa evidencia, el pitch se cae en la primera pregunta técnica — no por cómo está contado, sino porque no está probado.

Conseguirlo es barato: 2-3 marcas del pipeline actual de Morph, acceso directo, medir si la usan solas. El resultado define el negocio:
- **La usan solas** → hay SaaS, hay ronda
- **Quieren el resultado terminado** → hay agencia con ventaja tecnológica (más margen, menos competencia, no levanta ronda)
