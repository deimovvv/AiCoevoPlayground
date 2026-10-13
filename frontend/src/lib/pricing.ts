/**
 * Pricing / créditos — costing layer (ver docs/negocio/pricing-credits.md).
 * ──────────────────────────────────────────────────────────────────
 * Convierte operaciones (imágenes, video, voz) a costo en USD y a CRÉDITOS (con markup).
 * Base del estimador de costo (antes de correr) y del costo REAL registrado por corrida
 * (ver `costLedger.ts`, que consume estas funciones).
 *
 * PRECIOS VERIFICADOS EN FAL — 2026-08-25. Todos son "subject to change" del lado de Fal;
 * cuando cambien, se toca SOLO este archivo.
 *   · Nano Banana 2 ....... $0.08 / imagen (1K). 2K ×1.5, 4K ×2, 0.5K ×0.75
 *   · GPT Image 2 ......... por calidad y tamaño, tabla `GPT_IMAGE_TABLE` (verificada 2026-10-13)
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

export type GptQuality = "low" | "medium" | "high";

/** GPT Image 2 por Fal — USD por imagen según tamaño y calidad (fal.ai/models/fal-ai/gpt-image-2,
 *  verificado 2026-10-13). El precio sale de tokens: no crece en línea recta con los píxeles
 *  (1024×1536 cuesta menos que 1024×1024). Ver openspec/changes/image-models/design.md. */
const GPT_IMAGE_TABLE: { w: number; h: number; low: number; medium: number; high: number }[] = [
  { w: 1024, h: 768, low: 0.005, medium: 0.037, high: 0.145 },
  { w: 1024, h: 1024, low: 0.006, medium: 0.053, high: 0.211 },
  { w: 1024, h: 1536, low: 0.005, medium: 0.042, high: 0.165 },
  { w: 1920, h: 1080, low: 0.005, medium: 0.040, high: 0.158 },
  { w: 2560, h: 1440, low: 0.007, medium: 0.056, high: 0.222 },
  { w: 3840, h: 2160, low: 0.012, medium: 0.101, high: 0.401 },
];

/** Costo de UNA imagen de GPT Image 2. `exact` = el tamaño está en la tabla de Fal; si no,
 *  se usa la fila más cercana en píxeles y el costo es estimado. */
export function gptImageUsd(
  quality: GptQuality | string = "medium",
  width = 1024,
  height = 1024,
): { usd: number; exact: boolean } {
  const q: GptQuality = quality === "low" || quality === "high" ? quality : "medium";
  const px = width * height;
  const exactRow = GPT_IMAGE_TABLE.find(
    (r) => (r.w === width && r.h === height) || (r.w === height && r.h === width),
  );
  const row =
    exactRow ??
    GPT_IMAGE_TABLE.reduce((best, r) =>
      Math.abs(r.w * r.h - px) < Math.abs(best.w * best.h - px) ? r : best,
    );
  return { usd: row[q], exact: Boolean(exactRow) };
}

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
