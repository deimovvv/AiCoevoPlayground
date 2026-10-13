/**
 * Modelos de imagen — la ÚNICA lista. Lab, tools y backend leen de acá
 * (openspec/changes/image-models). Sumar un modelo = sumar una entrada; los precios viven en
 * `pricing.ts`. No importa nada de `api.ts` (evita ciclos de import: pantalla negra en dev).
 */
import type { ModelOption } from "../components/ui/ModelDropdown";

export type ImageQuality = "low" | "medium" | "high";

export interface ImageModelInfo {
  id: "nano-banana-2" | "gpt-image-2";
  label: string;
  /** Una línea: para qué conviene. Se muestra en el selector. */
  goodFor: string;
  provider: "fal";
  /** Acepta máscara para retocar una zona. */
  masks: boolean;
  /** Tiene calidades (low/medium/high) que cambian precio y detalle. */
  qualities: readonly ImageQuality[] | null;
  /** Precio orientativo para el selector (el registro real usa `pricing.ts`). */
  priceHint: string;
}

export const IMAGE_MODELS: readonly ImageModelInfo[] = [
  {
    id: "nano-banana-2",
    label: "Nano Banana 2",
    goodFor: "Combinar varias referencias: persona + producto + fondo",
    provider: "fal",
    masks: false,
    qualities: null,
    priceHint: "US$0,08 a 1K · 0,12 a 2K",
  },
  {
    id: "gpt-image-2",
    label: "GPT Image 2",
    goodFor: "Texto dentro de la imagen, retoques puntuales, iterar sobre una base",
    provider: "fal",
    masks: true,
    qualities: ["low", "medium", "high"],
    priceHint: "~US$0,05 en medium · ×4 en high",
  },
] as const;

export type ImageModel = ImageModelInfo["id"];

export const DEFAULT_IMAGE_MODEL: ImageModel = "nano-banana-2";
export const DEFAULT_IMAGE_QUALITY: ImageQuality = "medium";

/** Lo que se le pasa a `createImageEdit` / `createTextToImage`. */
export interface ImageChoice {
  model: ImageModel;
  /** Sólo para modelos con calidades. Sin valor, el backend usa medium. */
  quality?: ImageQuality | null;
}

export const QUALITY_LABELS: Record<ImageQuality, string> = {
  low: "Borrador",
  medium: "Normal",
  high: "Final",
};

/** Tools de moda con calce: GPT queda "a prueba" hasta la A/B con prendas reales
 *  (docs/decisions-log.md, 2026-10). */
export const FASHION_FIT_TOOLS = ["fashion_reel", "ecommerce_pack", "fashion_editorial"] as const;

export function isImageModel(x: unknown): x is ImageModel {
  return IMAGE_MODELS.some((m) => m.id === x);
}

export function imageModelInfo(id: string | null | undefined): ImageModelInfo {
  return IMAGE_MODELS.find((m) => m.id === id) ?? IMAGE_MODELS[0]!;
}

export function imageModelLabel(id: string | null | undefined): string {
  return imageModelInfo(id).label;
}

/** Normaliza lo que venga de una config guardada. "nano-banana-google" (Google directo con la
 *  key de Monks, eliminado 2026-10-06) y cualquier valor desconocido pasan a Nano Banana 2. */
export function toImageModel(x: unknown): ImageModel {
  return isImageModel(x) ? x : DEFAULT_IMAGE_MODEL;
}

/** Elección de modelo y calidad desde la config de una tool (`imageModel` / `imageQuality`).
 *  `modelKey` permite leer otra clave (Ecommerce Pack guarda `ecomImageModel`). */
export function imageChoice(
  config: object | null | undefined,
  modelKey = "imageModel",
): ImageChoice {
  const c = (config ?? {}) as Record<string, unknown>;
  const model = toImageModel(c[modelKey]);
  const q = c.imageQuality;
  const quality = q === "low" || q === "medium" || q === "high" ? q : null;
  return { model, quality: imageModelInfo(model).qualities ? quality : null };
}

/** Opciones para `ModelDropdown`. En tools de moda con calce, GPT va marcado "a prueba". */
export function imageModelOptions(opts: { fashionFit?: boolean } = {}): ModelOption<ImageModel>[] {
  return IMAGE_MODELS.map((m) => ({
    id: m.id,
    label: opts.fashionFit && m.id === "gpt-image-2" ? `${m.label} · a prueba` : m.label,
    sub:
      opts.fashionFit && m.id === "gpt-image-2"
        ? "Sin probar todavía con prendas reales: revisá el calce"
        : `${m.goodFor} · ${m.priceHint}`,
  }));
}
