# Créditos & costos — modelo reseller (créditos sobre Fal + margen)

Cómo cobramos cuando la app sea client-facing, y qué construimos ahora. El patrón es el
de Higgsfield/Pletor: **créditos = abstracción sobre nuestro costo real de modelos + markup.**
Coevo tiene las cuentas (Fal/Gemini/ElevenLabs); el cliente ve "créditos"; nosotros pagamos
por atrás.

## El modelo
1. **1 crédito = $0.01** (ajustable). Cada operación cuesta N créditos, derivados del
   costo real del modelo × **markup** (nuestro margen).
   - Kling V3 Pro 5s (sin audio) nos cuesta **$0.56** → se cobra, ej., **~90 créditos**
     ($0.90) con markup ~1.6 → ~38% margen.
   - Imagen Nano Banana → M créditos. Análisis Gemini → ~0 (despreciable).
2. **Balance por cliente** (ledger). Al generar, **debitás**; si no alcanza, **bloqueás**.
3. **Top-up** (recarga con pago) suma créditos.

## Prerrequisitos (para el sistema COMPLETO, client-facing)
- **Auth / cuentas por cliente** — hoy NO existe (está en "Planned"). Es el bloqueante:
  sin cuentas no hay a quién debitarle.
- **Ledger de créditos** (balance + movimientos, en el backend).
- **Mapa de costos** (operación → créditos).
- **Top-up / pago** (Stripe / MercadoPago).

## Plan en 2 tiempos
- **Fase 1 (ahora, útil sin auth) — costing layer + estimador.** Un módulo `pricing.ts`
  con los precios reales (Kling/s, Nano/imagen…) + conversión a créditos con markup, y un
  **estimador de costo** por generación (badge "≈ N créditos / ~$X"). Sirve HOY para
  control de gasto interno y **es la misma base** que después debita al cliente.
- **Fase 2 (client-facing) — el sistema real.** Auth + ledger + debit-on-operation +
  top-up. El cliente ve créditos, nosotros pagamos Fal.

## Encaje con la arquitectura de nodos
Cada **primitiva de step declara su `cost`** (créditos) en el descriptor → el motor lo
suma por grafo → estima/debita. El costing layer es un campo más del nodo. Ver
`architecture-nodes.md`.

## Riesgos / reglas
- **Pre-pago, NO post-pago.** Fronteamos la factura de Fal — si abusan, perdemos. Créditos
  comprados por adelantado + **caps / rate-limit** por cliente.
- **Margen** = precio del crédito arriba del costo blended + overhead.
- **Costo variable** (3s vs 15s de video) → cobrar por **operación con costo fijo** (simple)
  o por costo real. Arrancamos con costo por operación.
- **ToS de Fal**: confirmar que permiten reventa vía plataforma antes de ir comercial.

## Estado

**Fase 1 completa (2026-08-25).**

- `lib/pricing.ts` — precios por unidad + créditos. **Nano Banana y Kling V3 Pro
  verificados contra Fal**; Kling V2.x, Seedance y ElevenLabs siguen estimados y están
  marcados como tales en el código.
- `lib/costLedger.ts` — registra el costo REAL de cada corrida. Se instrumentó en
  `lib/api.ts`, no en las tools: toda llamada a modelo pasa por ahí, así una tool nueva
  queda medida sola el día que se crea.
- `generations.json` — campos `cost` (el resumen del ledger) y `workStatus`.
- `/dashboard/trabajo` — la lista agrupada por estado con el costo en la fila y el gasto
  por marca en el rail.

**Corrección importante:** el precio de Nano Banana que había acá ($0.039/img) estaba
**3× por debajo** del real ($0.08 base, $0.12 en 2K). Todo estimado mostrado antes de esta
fecha subestimaba el costo.

**Limitación conocida del ledger:** adjudica por cercanía temporal, no por id de corrida.
Dos pipelines en paralelo en la misma pestaña pueden cruzar la atribución por pieza — el
total del período sigue bien. Se arregla cuando el motor de pipelines pase un runId.

**Sin costo histórico:** las ~3.200 generaciones anteriores no tienen `cost` y no se pueden
reconstruir con exactitud. La pantalla Trabajo las cuenta aparte en vez de asumir cero.

Fase 2 (auth + ledger por cliente + top-up) sigue esperando autenticación.
