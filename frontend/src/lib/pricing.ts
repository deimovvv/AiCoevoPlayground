/**
 * Pricing / créditos — costing layer (ver docs/pricing-credits.md).
 * ──────────────────────────────────────────────────────────────────
 * Convierte operaciones (imágenes, video, voz) a costo en USD y a CRÉDITOS (con markup).
 * Base del estimador de costo (antes de correr) y del costo REAL registrado por corrida
 * (ver `costLedger.ts`, que consume estas funciones).
 *
 * PRECIOS VERIFICADOS EN FAL — 2026-08-25. Todos son "subject to change" del lado de Fal;
 * cuando cambien, se toca SOLO este archivo.
 *   · Nano Banana 2 ....... $0.08 / imagen (1K). 2K ×1.5, 4K ×2, 0.5K ×0.75
 *   · Kling V3 Pro ........ $0.112 / seg (sin audio) · $0.168 (con audio)
 * ESTIMADOS (pendientes de confirmar contra factura):
 *   · Kling V2.6 / V2.5, Seedance, ElevenLabs
 */

export type Resolution = "0.5K" | "1K" | "2K" | "4K";

/** Multiplicador de Nano Banana por resolución de salida (dato de Fal). */
const RES_MULTIPLIER: Record<Resolution, number> = {
  "0.5K": 0.75,
  "1K": 1,
  "2K": 1.5,
  "4K": 2,
};

/** Costos reales por unidad (USD). */
export const UNIT_USD = {
  /** Nano Banana 2 — precio base por imagen a 1K. Verificado 2026-08-25. */
  nanoImageBase: 0.08,
  /** Kling image-to-video, USD por segundo, por modelo. V3 Pro verificado. */
  klingPerSecond: {
    "v3-pro": 0.112,
    "v2-6-pro": 0.098,   // estimado
    "v2-6-std": 0.049,   // estimado
    "v2-5-turbo": 0.049, // estimado
  } as Record<string, number>,
  /** Seedance reference-to-video, USD por segundo. Estimado. */
  seedancePerSecond: 0.06,
  /** ElevenLabs TTS, USD por cada 1.000 caracteres. Estimado. */
  ttsPer1kChars: 0.18,
  /** Gemini (guiones, análisis, descripciones) — despreciable a nuestro volumen. */
  gemini: 0,
};

/** Fallback cuando llega un modelo de Kling que no está en la tabla. */
const KLING_FALLBACK = UNIT_USD.klingPerSecond["v3-pro"];

// 1 crédito = $0.01. Markup = margen sobre el costo real.
export const CREDIT_USD = 0.01;
export const MARKUP = 1.6; // ~38% de margen

/** USD (nuestro costo) → créditos que le cobramos al cliente (con markup, redondeado arriba). */
export function usdToCredits(usd: number): number {
  return Math.max(1, Math.ceil((usd * MARKUP) / CREDIT_USD));
}

/** Costo (USD) de UNA imagen Nano Banana a la resolución dada. */
export function imageUsd(resolution: Resolution | string = "2K"): number {
  const mult = RES_MULTIPLIER[(resolution as Resolution)] ?? RES_MULTIPLIER["1K"];
  return UNIT_USD.nanoImageBase * mult;
}

/** Costo (USD) de N imágenes Nano Banana a la misma resolución. */
export function imagesUsd(n: number, resolution: Resolution | string = "2K"): number {
  return imageUsd(resolution) * Math.max(0, n);
}

/** Costo (USD) de N clips de Kling de `seconds` segundos c/u. */
export function videoUsd(seconds: number, clips = 1, model = "v3-pro"): number {
  const rate = UNIT_USD.klingPerSecond[model] ?? KLING_FALLBACK;
  return rate * Math.max(0, seconds) * Math.max(0, clips);
}

/** Costo (USD) de N clips de Seedance de `seconds` segundos c/u. */
export function seedanceUsd(seconds: number, clips = 1): number {
  return UNIT_USD.seedancePerSecond * Math.max(0, seconds) * Math.max(0, clips);
}

/** Costo (USD) de sintetizar `chars` caracteres con ElevenLabs. */
export function ttsUsd(chars: number): number {
  return (UNIT_USD.ttsPer1kChars * Math.max(0, chars)) / 1000;
}

/** Formatea un costo para la UI: "≈ 62 créditos · ~$0.39". */
export function formatCost(usd: number): { credits: number; usd: number; label: string } {
  const credits = usdToCredits(usd);
  return { credits, usd, label: `≈ ${credits} créditos · ~$${usd.toFixed(2)}` };
}

/** Formatea SOLO nuestro costo real, sin markup — para las vistas internas. */
export function formatUsd(usd: number): string {
  return `$${usd.toFixed(2)}`;
}
