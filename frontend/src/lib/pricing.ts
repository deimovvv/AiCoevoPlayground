/**
 * Pricing / créditos — costing layer (ver docs/pricing-credits.md).
 * ──────────────────────────────────────────────────────────────────
 * Convierte operaciones (imágenes, video) a costo en USD y a CRÉDITOS (con markup).
 * Base del estimador de costo (hoy) y del debit por cliente (futuro, con auth).
 *
 * Los precios unitarios son AJUSTABLES. El de Kling viene del dato real de Fal (V3 Pro,
 * sin audio = $0.112/s). El de Nano Banana es un estimado — actualizar con el valor real.
 */

// Costos reales por unidad (USD).
export const UNIT_USD = {
  nanoImage: 0.039,        // Nano Banana 2 por imagen (ESTIMADO — confirmar con Fal).
  klingPerSecond: 0.112,   // Kling V3 Pro image-to-video, sin audio.
};

// 1 crédito = $0.01. Markup = margen sobre el costo real.
export const CREDIT_USD = 0.01;
export const MARKUP = 1.6; // ~38% de margen

/** USD (nuestro costo) → créditos que le cobramos al cliente (con markup, redondeado arriba). */
export function usdToCredits(usd: number): number {
  return Math.max(1, Math.ceil((usd * MARKUP) / CREDIT_USD));
}

/** Costo (USD) de N imágenes Nano Banana. */
export function imagesUsd(n: number): number {
  return UNIT_USD.nanoImage * Math.max(0, n);
}

/** Costo (USD) de N clips de video de `seconds` segundos c/u (Kling). */
export function videoUsd(seconds: number, clips = 1): number {
  return UNIT_USD.klingPerSecond * Math.max(0, seconds) * Math.max(0, clips);
}

/** Formatea un costo para la UI: "≈ 62 créditos · ~$0.39". */
export function formatCost(usd: number): { credits: number; usd: number; label: string } {
  const credits = usdToCredits(usd);
  return { credits, usd, label: `≈ ${credits} créditos · ~$${usd.toFixed(2)}` };
}
