# Modelo económico — proyección del producto

Proyección para el SaaS de producción de contenido de moda. Números de costo variable **verificados en fal.ai (2026-09-02)**; los de equipo e infraestructura son estimaciones de mercado marcadas como tales.

**Última revisión:** 2026-09-02

---

## ⚠️ El hallazgo principal, antes que nada

**A $3.50 por SKU, el negocio no cierra por volumen de marcas chicas.**

Una marca que produce 30 SKUs/mes factura **$105/mes**. Con un backend dev ($2.500/mes), hacen falta **38 marcas de ese tamaño** solo para cubrir costos. Con equipo completo, **99 marcas**.

Eso no es un problema de costos — el margen bruto es excelente (69%). **Es un problema de ticket.** El precio por SKU está pensado para competir con Genera, pero Genera le vende a marcas de 50+ SKUs por temporada. Vos apuntás a marcas más chicas, que por definición generan menos.

Y hay un segundo problema que lo agrava: con ticket de $105 y el churn típico de un producto AI-native de precio bajo (6-8% mensual), el **LTV/CAC da 2.6-3.0× — por debajo del mínimo sostenible de 3:1**. No se pueden comprar clientes.

**La conclusión operativa: el abono mensual no es una opción, es una condición necesaria.** Ver §5b y §6.

---

## 1. Costo variable — verificado

Precios reales de los modelos que usa el stack ([fal.ai](https://fal.ai/models), consultado 2026-09-02):

| Modelo | Precio | Unidad |
|---|---|---|
| **Nano Banana 2** | **$0.08** | por imagen 1K |
| Nano Banana 2 @ 2K | $0.12 | 1.5× el estándar |
| Nano Banana 2 @ 4K | $0.16 | 2× el estándar |
| Nano Banana 2 @ 0.5K | $0.06 | 0.75× el estándar |
| **Kling 2.6 Pro** (sin audio) | **$0.07** | por segundo |
| Kling 2.6 Pro (audio nativo) | $0.14 | por segundo |
| Kling 2.6 Pro (audio + voz) | $0.168 | por segundo |
| BiRefNet v2 (rembg) | ~$0 | por segundo de cómputo |
| **Cloudflare R2** | **$0.015/GB-mes** | **egreso gratis** ← clave |

**R2 sin costo de egreso es importante:** servir catálogos de imágenes desde S3 costaría cientos de dólares por mes en transferencia. R2 lo hace $0.

### Costo por SKU

Asumiendo **1.6× de descarte en imágenes** (se generan ~8 para entregar 5) y 1.3× en video:

| Paquete | Composición | Costo real | Margen a $3.50 | Margen a $4.50 |
|---|---|---|---|---|
| **Básico** | 4 fotos 1K | **$0.51** | $2.99 (85%) | $3.99 (89%) |
| **Estándar** | 5 fotos 1K + video 5s | **$1.10** | $2.40 (69%) | $3.40 (76%) |
| **Premium** | 5 fotos 2K + video 5s | **$1.42** | $2.08 (60%) | $3.08 (69%) |
| **Premium+** | 6 fotos 2K + video 10s | **$2.06** | $1.44 (41%) | $2.44 (54%) |

**Lecturas:**
- El margen bruto es sano en todos los escenarios. **El costo variable no es el problema.**
- El video es lo que más pesa: pasar de 5s a 10s duplica el costo de video y baja el margen de 69% a 41%.
- ⚠️ **Premium+ a $3.50 es peligroso**: 41% de margen no absorbe soporte, reintentos extra ni QA humano.
- El factor de descarte es la variable oculta más sensible. Si en vez de 1.6× resulta ser 3× (curación exigente), el Estándar sube a **$1.66** y el margen cae a 53%.

---

## 2. Costos fijos por fase

Sueldos **verificados**: [Sysarmy 2026.1](https://sysarmy.com/blog/posts/resultados-de-la-encuesta-de-sueldos-2026-1/) (n=4.939, medianas brutas a enero 2026) y [Howdy ago-2026](https://www.howdy.com/blog/argentina-software-engineer-salary-hiring-cost-benchmarks-2026).

### El costo real de un backend dev en Argentina

| Modalidad | Semi-senior | Senior | Nota |
|---|---|---|---|
| **Relación de dependencia** (pesos) | ARS $2.502.000 bruto ≈ **USD 1.670** | ARS $3.500.000 ≈ **USD 2.335** | ⚠️ **×1.5 de cargas sociales** → costo real USD 2.500 / 3.500 |
| **Contractor en USD** (compite con exterior) | **USD 2.800-3.750** | **USD 4.250-6.875** | Sin cargas, pero pide más neto |
| Vía agencia de staffing | USD 6.500-8.000 | USD 8.000-10.000 | Incluye margen de la agencia |

⚠️ **La brecha es de 2×** entre contratar en pesos y contratar en USD. Sysarmy reporta que el mismo perfil varía hasta 44% según si cobra en pesos o dolarizado. **Es la decisión de costo más importante del plan.**

Otros roles ⚠️ (fuentes más débiles — no existe un sysarmy de marketing):
- Marketing digital full-time: **USD 600-1.000/mes**
- Community manager: USD 335-535/mes
- Diseñador UI freelance: **USD 15-30/hora** ✅ (Coderhouse, sep-2026)

### Escenarios

| Fase | Infra | Dev (costo real) | Marketing | Tools | **Total/mes** |
|---|---|---|---|---|---|
| **F1 — Solo vos** | $80 | — | — | $50 | **$130** |
| **F2 — dev en pesos** | $150 | $2.500 | — | $80 | **$2.730** |
| **F2b — dev en USD** | $150 | $3.500 | — | $80 | **$3.730** |
| **F3 — + marketing** | $250 | $2.500 | $800 | $120 | **$3.670** |
| **F4 — equipo completo** | $400 | $3.500 | $1.500 | $200 | **$5.600** |

## 3. Break-even (paquete Estándar, $3.50, margen $2.40)

| Fase | SKU/mes necesarios | Marcas chicas (30/mes) | Marcas medias (80/mes) | Marcas grandes (200/mes) |
|---|---|---|---|---|
| **F1** | 54 | **2** | 1 | 1 |
| **F2** | 1.138 | **38** | 14 | 6 |
| **F3** | 1.821 | **61** | 23 | 9 |
| **F4** | 2.958 | **99** | 37 | 15 |

### Ingreso por marca

| Tamaño | SKU/mes | Factura | Margen bruto |
|---|---|---|---|
| Chica | 30 | **$105** | $72 |
| Media | 80 | **$280** | $192 |
| Grande | 200 | **$700** | $480 |

**El número incómodo: $105/mes por marca chica.** Es un ticket de herramienta de productividad individual, no de software B2B. Con ese ticket, adquirir clientes por marketing pago casi nunca cierra — el CAC se come el LTV.

---

## 4. La conclusión que sale de los números

**F1 es rentable desde hoy.** Con 2 marcas chicas ya cubrís costos. Podés operar indefinidamente sin invertir, mejorando el producto con los clientes que ya tenés.

**F2 es el salto peligroso.** Contratar un dev multiplica el break-even por 21 (de 54 a 1.138 SKU/mes). Ese salto solo se justifica si:
- Ya tenés demanda que no podés atender (lista de espera real), **o**
- Entra una ronda que financie el hueco, **o**
- Cambiás el modelo de ingreso (§6)

**F3 y F4 no se sostienen con marcas chicas a $3.50.** 61 y 99 marcas son metas de años, no de meses.

---

## 5. Escenarios

### Bootstrapped
- Quedarse en F1 hasta 5-8 marcas
- Reinvertir margen en el producto
- El dev entra cuando el margen bruto mensual supere los $3.000 (≈1.250 SKU/mes)
- **Ventaja:** cero riesgo, control total
- **Costo:** lento; si Genera u otro lanza antes, se pierde la ventana

### Con ronda seed
Para financiar F3 durante 18 meses:
- Quema mensual: ~$4.370 fijos + sueldo founder
- 18 meses ≈ **$120-150K** más buffer
- **Ronda razonable: USD 200-300K** (pre-seed / angel)
- ⚠️ **No se puede levantar hoy:** falta la evidencia de que alguien usa la herramienta sin vos operando

---

## 5b. 🔴 El dato que decide todo: LTV/CAC y el "AI tourist"

[ChartMogul](https://chartmogul.com/reports/saas-retention-the-ai-churn-wave/) midió ~200 empresas AI-native a fines de 2025:

| Plan | NRR |
|---|---|
| **< USD 50/mes** | **32%** 🔴 |
| > USD 250/mes | 85% ✅ |

Es el efecto **"AI tourist"**: gente que se suscribe por curiosidad a una herramienta de IA barata, prueba y se va. **Un producto AI-native de ticket bajo debe modelar churn en el extremo alto: 6-8% mensual, no 3%.**

### Qué pasa al cruzarlo con CAC

Benchmarks verificados: CAC self-serve mediano **USD 702**; para eCommerce SaaS **~USD 299**. Uso **USD 400** (conservador para ticket bajo).

| Modelo | ARPA | Churn | Vida | LTV | **LTV/CAC** | Payback |
|---|---|---|---|---|---|---|
| **Pago x SKU** (30 SKU/mes) | $105 | 7% | 14 m | $1.035 | **2.6×** 🔴 | 5.5 m |
| **Pago x SKU** (churn 6.1%) | $105 | 6.1% | 16 m | $1.188 | **3.0×** ⚠️ | 5.5 m |
| **Abono $250** | $250 | 3.5% | 29 m | $4.929 | **12.3×** ✅ | 2.3 m |
| **Abono $400** | $400 | 2.5% | 40 m | $11.040 | **27.6×** ✅ | 1.4 m |
| **Agencia $700** | $700 | 2.5% | 40 m | $19.320 | **48.3×** ✅ | 0.8 m |

**El mínimo sostenible es 3:1, y para SMB con churn alto se recomienda 4:1.**

🔴 **El modelo de pago por SKU no llega al mínimo.** A 2.6-3.0× no se puede adquirir clientes pagando — cada cliente nuevo cuesta casi lo que deja.

✅ **El abono mensual lo resuelve por dos vías a la vez:** sube el ARPA y baja el churn (planes caros retienen 85% vs 32%). Pasar de $105/SKU a $250/abono no mejora el ratio 2.4× — lo mejora **4.7×**, porque las dos variables se mueven juntas.

**Esto convierte el abono mensual de "buena idea" en condición necesaria.**

Otros benchmarks verificados ([Aleph × Benchmarkit 2026](https://www.getaleph.com/answers/cac-payback-period-saas-2026), 342 empresas):
- Payback mediano ACV < USD 5K: **11 meses** · SaaS vertical: 18 meses
- LTV/CAC SaaS **vertical: 5.6×** vs horizontal 4.1× — los verticales retienen mejor
- Conversión visita → trial: **2-5%** · trial → pago self-serve: **3-5%** (con tarjeta requerida: 15-25%)

## 6. Las salidas (ninguna es bajar el precio)

El problema es el ticket, no el costo. Cuatro caminos, no excluyentes:

### A. Abono mensual, no pago por SKU 🔴 el más importante
En vez de $3.50/SKU, un plan de **$150-400/mes** con cupo de SKUs incluido.
- Convierte $105 variables en ingreso **recurrente y previsible**
- Sube el ticket promedio 2-4×
- Es lo que hace Genera ($29/$99/$199) y todo el sector
- **Con abonos de $250, el break-even de F2 son ~11 marcas, no 38**

### B. Agencias como canal principal
Una agencia que produce para 10 marcas consume como marca grande. **Un cliente agencia ≈ 7 marcas chicas**, con un solo proceso de venta y soporte.
- F2 con agencias: **6 clientes** en vez de 38
- Es la fila que Genera no atiende (ver `market-positioning.md` §11)

### C. Tier operado con precio de servicio
El SKU terminado con dirección de arte no vale $3.50 — vale lo que vale una agencia. Ahí el precio es por proyecto o retainer, no por unidad.

### D. Subir el paquete básico
Si el Básico (4 fotos, sin video) cuesta $0.51 y se vende a $3.50, hay margen de 85%. **Vender el video como upsell** en vez de incluirlo protege el margen y crea un motivo de upgrade.

---

## 7. Sensibilidad — qué rompe el modelo

| Variable | Hoy | Si empeora | Impacto |
|---|---|---|---|
| **Descarte de imágenes** | 1.6× | 3× | Margen Estándar 69% → 53% |
| **Precio Nano Banana** | $0.08 | $0.16 | Margen Estándar 69% → 51% |
| **Duración de video** | 5s | 10s | Margen 69% → 41% |
| **SKU/mes por marca** | 30 | 15 | Break-even F2: 38 → 76 marcas |
| **Churn mensual** | — | >5% | Con ticket de $105 el CAC no se recupera |

**La variable más sensible es el volumen por marca**, y es la única que no controlás. Por eso el abono mensual (§6A) es tan importante: desacopla el ingreso del volumen que produce el cliente.

---

## 8. Recomendación

1. **Quedarse en F1** hasta tener 5-8 marcas pagando. Ya es rentable.
2. **Cambiar a abono mensual antes de escalar.** Es el cambio de mayor impacto de todo el documento y no cuesta nada implementar.
3. **Perseguir agencias, no solo marcas.** Un cliente agencia vale 7 marcas chicas.
4. **No contratar marketing hasta F2 superado.** Con ticket de $105 el CAC no cierra; los primeros clientes salen de la red.
5. **El backend dev entra cuando el margen bruto mensual supere $3.000**, o cuando haya demanda desatendida documentada.

---

## 9. Datos que faltan

- **SKU/mes reales por marca** — el número más importante del modelo, y es el único que hay que medir con los clientes actuales
- **Factor de descarte real** — cuántas imágenes se generan por cada una entregada
- **Cuántas horas de operación humana lleva un SKU hoy** — define si el tier operado es rentable
- Sueldos verificados y costos de infra con proveedores reales (las cifras de §2 son estimaciones)
