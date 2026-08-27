/**
 * Cost Ledger — costo REAL por corrida (ver docs/pricing-credits.md).
 * ────────────────────────────────────────────────────────────────────
 * `pricing.ts` estima ANTES de correr. Esto registra lo que efectivamente se consumió.
 *
 * Cómo funciona, y por qué así: cada llamada a un modelo pasa sí o sí por `lib/api.ts`
 * (createImageEdit, createKlingVideo, …). Ahí se llama a `recordOp()` — así ninguna tool
 * necesita instrumentarse a mano, y una tool nueva queda medida sola el día que se crea.
 *
 * Las operaciones caen en un buffer "pendiente". Cuando `saveGeneration` /
 * `updateGeneration` persisten una corrida, `claimFor(genId)` le adjudica todo lo
 * pendiente y devuelve el acumulado de esa generación.
 *
 * LIMITACIÓN CONOCIDA: la adjudicación es por cercanía temporal, no por id de corrida —
 * si se corren DOS pipelines en paralelo en la misma pestaña, el costo puede caer en la
 * generación equivocada. El total del período sigue siendo correcto; la atribución por
 * pieza no. Se arregla cuando el motor de pipelines pase un runId a través de api.ts.
 */

import { imageUsd, videoUsd, seedanceUsd, ttsUsd, UNIT_USD } from "./pricing";

export type OpKind = "image" | "video" | "tts";

export interface CostOp {
  kind: OpKind;
  /** Modelo/endpoint concreto — "nano-banana-2", "kling:v3-pro", "seedance", "elevenlabs". */
  model: string;
  usd: number;
  /** Unidades: imágenes, segundos de video, caracteres de voz. */
  units: number;
  /** false cuando el precio usado todavía no está confirmado contra factura. */
  verified: boolean;
  at: string;
}

export interface CostSummary {
  usd: number;
  images: number;
  videoClips: number;
  videoSeconds: number;
  ttsChars: number;
  /** USD por modelo — para ver qué parte de la corrida se comió el presupuesto. */
  byModel: Record<string, number>;
  /** true si TODO el costo salió de precios verificados. */
  verified: boolean;
}

const EMPTY: CostSummary = {
  usd: 0, images: 0, videoClips: 0, videoSeconds: 0, ttsChars: 0, byModel: {}, verified: true,
};

/** Precios confirmados contra la página de Fal (2026-08-25). El resto es estimado. */
const VERIFIED_MODELS = new Set(["nano-banana-2", "kling:v3-pro"]);

let pending: CostOp[] = [];
const totals = new Map<string, CostOp[]>();

function summarize(ops: CostOp[]): CostSummary {
  const s: CostSummary = { ...EMPTY, byModel: {} };
  for (const op of ops) {
    s.usd += op.usd;
    s.byModel[op.model] = (s.byModel[op.model] || 0) + op.usd;
    if (!op.verified) s.verified = false;
    if (op.kind === "image") s.images += op.units;
    if (op.kind === "video") { s.videoClips += 1; s.videoSeconds += op.units; }
    if (op.kind === "tts") s.ttsChars += op.units;
  }
  s.usd = Math.round(s.usd * 10000) / 10000;
  return s;
}

function push(kind: OpKind, model: string, usd: number, units: number) {
  if (!(usd > 0) && kind !== "tts") return;
  pending.push({
    kind, model, usd, units,
    verified: VERIFIED_MODELS.has(model),
    at: new Date().toISOString(),
  });
}

/** Una imagen generada/editada con Nano Banana. */
export function recordImage(resolution = "2K", count = 1) {
  push("image", "nano-banana-2", imageUsd(resolution) * count, count);
}

/** Un clip de Kling. `duration` en segundos (string o number, como llega de la UI). */
export function recordKling(duration: string | number, model = "v3-pro") {
  const secs = Number(duration) || 0;
  push("video", `kling:${model}`, videoUsd(secs, 1, model), secs);
}

/** Un clip de Seedance. */
export function recordSeedance(duration: string | number) {
  const secs = Number(duration) || 0;
  push("video", "seedance", seedanceUsd(secs, 1), secs);
}

/** Una síntesis de voz de ElevenLabs. */
export function recordTts(chars: number) {
  push("tts", "elevenlabs", ttsUsd(chars), chars);
}

/** Lo consumido y todavía no adjudicado a ninguna generación. */
export function pendingSummary(): CostSummary {
  return summarize(pending);
}

/**
 * Adjudica todo lo pendiente a `genId` y devuelve el acumulado TOTAL de esa generación
 * (lo de antes + lo recién adjudicado). Idempotente: si no hay pendientes, no suma nada.
 */
export function claimFor(genId: string): CostSummary {
  if (pending.length > 0) {
    const prev = totals.get(genId) || [];
    totals.set(genId, [...prev, ...pending]);
    pending = [];
  }
  return summarize(totals.get(genId) || []);
}

/** El acumulado de una generación, sin adjudicar nada nuevo. */
export function summaryFor(genId: string): CostSummary {
  return summarize(totals.get(genId) || []);
}

/** Descarta lo pendiente — para cuando una corrida se abandona antes de guardarse. */
export function discardPending() {
  pending = [];
}

/** Precios usados, para mostrarlos en la UI sin re-importar pricing. */
export const PRICE_NOTE =
  `Nano Banana $${UNIT_USD.nanoImageBase.toFixed(2)}/img (1K, ×1.5 en 2K) · ` +
  `Kling V3 Pro $${UNIT_USD.klingPerSecond["v3-pro"]}/seg`;
