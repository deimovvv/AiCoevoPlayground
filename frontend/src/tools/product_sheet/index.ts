/**
 * Product Sheet — Tool Definition
 * ─────────────────────────────────
 * 3-step pipeline: brief → generate → save.
 *
 * Filosofía del recipe (inspirado en lo que el usuario hacía por fuera de la app):
 * en lugar de generar una imagen COMPOSITE con todas las vistas, generamos UNA
 * imagen POR VISTA seleccionada — cada una con el mismo `PRODUCT_BASE_PROMPT`
 * (que fija identidad del producto + estudio cyclorama + iluminación + cámara)
 * y un `composition` específico por ángulo. Resultado: cada vista sale limpia,
 * con su propio aspect ratio óptimo, y Nano Banana no se confunde tratando de
 * meter 6 vistas en un solo frame.
 *
 * Inputs:
 *   - Un Producto del Brand Kit (usa sus fotos como referencia, hasta 8), OR
 *   - 1-8 fotos uploaded.
 *   - Cuantos más ángulos provistos, menos inventa Nano Banana.
 */

import type { ToolDefinition } from "../types";
import { handleBrief, handleGenerate, handleSave } from "./handlers";

/** Base prompt común a TODAS las vistas — fija identidad del producto, estudio
 *  cyclorama, iluminación, cámara y estilo. Cada vista suma su `composition`. */
export const PRODUCT_BASE_PROMPT = `Reference images show the EXACT product to render. Preserve EXACTLY the shape, stance, proportions, color, finish, materials, hardware, badging, logos, branding, and overall identity from the references. Do NOT alter any of these elements. Pure white seamless cyclorama studio background, no environment, no props, no plants, no people, no text, no horizon line. Soft even diffused studio lighting from above and the sides, no harsh shadows, no harsh contrast, with a subtle soft contact shadow directly beneath the product to anchor it to the ground. Camera locked-off, medium telephoto lens, no distortion, sharp focus throughout, deep depth of field. Clean catalog product photography style, photorealistic, hyperrealistic detail. Do NOT add lens flares, motion blur, chrome highlights, decorative reflections, dramatic shadows, or any background elements beyond pure white.`;

/** Fidelidad anti-invención — se concatena al base prompt cuando el usuario
 *  pide una vista que NO está cubierta por las refs (ej. back con solo frente).
 *  Le pide a Nano Banana inferir MÍNIMAMENTE, no embellecer. */
export const PRODUCT_FIDELITY_RULES = `FIDELITY RULES: (1) The output MUST show the EXACT product from the references — same color, materials, finish, hardware, logo, proportions. NEVER generate a similar-but-different product. (2) ONLY use angles and details actually visible across the references. (3) When inferring an angle not directly photographed (e.g. inferring back from front + side), keep the inference MINIMAL and grounded: same color, same material, same proportions, no embellishment, no invented details. (4) If a view cannot be safely inferred, prefer a less ambitious framing over inventing.`;

export interface ProductView {
  /** Display label (Spanish) shown in the UI checkbox. */
  label: string;
  /** Short description shown under the label. */
  hint: string;
  /** English composition instruction appended to the base prompt for this view. */
  composition: string;
  /** Aspect ratio optimal for this view ("16:9" / "4:3" / "1:1" / "9:16"). */
  aspectRatio: "16:9" | "4:3" | "1:1" | "9:16";
  /** If true, marked by default when the tool opens. */
  defaultEnabled: boolean;
}

/** Catálogo de vistas. Genérico para CUALQUIER producto (auto, electro, mueble,
 *  botella). El recipe que el usuario probó por fuera era específico para autos
 *  pero la estructura es universal: hero 3/4, perfil, frente, trasera, top. */
export const PRODUCT_VIEW_CATALOG: Record<string, ProductView> = {
  hero_34: {
    label: "Hero 3/4 frontal",
    hint: "Vista principal, el producto en tres cuartos.",
    composition: "Product centered in three-quarter front view, oriented slightly toward the right side of the frame so both the front and the right side are clearly visible. Camera at eye-level relative to the product center.",
    aspectRatio: "16:9",
    defaultEnabled: true,
  },
  side: {
    label: "Perfil 90°",
    hint: "Costado estricto, 90° perpendicular.",
    composition: "Product centered in strict side profile view at exactly 90 degrees perpendicular to the camera, the full length visible from one end to the other. If the product has wheels or a base on both sides, both should be on the same plane. Camera at eye-level relative to the product center.",
    aspectRatio: "16:9",
    defaultEnabled: true,
  },
  front: {
    label: "Frente directo",
    hint: "0°, perfectamente simétrico.",
    composition: "Product centered in strict front view at 0 degrees, perfectly symmetrical. Camera at eye-level, perpendicular to the front face of the product.",
    aspectRatio: "4:3",
    defaultEnabled: true,
  },
  back: {
    label: "Trasera directa",
    hint: "180°, perfectamente simétrico. Solo si tenés foto trasera.",
    composition: "Product centered in strict rear view at 180 degrees, perfectly symmetrical. Camera at eye-level, perpendicular to the back face of the product.",
    aspectRatio: "4:3",
    defaultEnabled: false,
  },
  top: {
    label: "Cenital (top-down)",
    hint: "Visto desde arriba, 90° hacia el suelo.",
    composition: "Product centered in pure top-down bird's-eye view, camera oriented straight down at 90 degrees toward the ground. The full top silhouette is visible — every horizontal surface, edges, and outline.",
    aspectRatio: "16:9",
    defaultEnabled: false,
  },
};

export const DEFAULT_PRODUCT_VIEWS = Object.entries(PRODUCT_VIEW_CATALOG)
  .filter(([, v]) => v.defaultEnabled)
  .map(([k]) => k);

export const productSheet: ToolDefinition = {
  schema: {
    showAvatar: false,
    showProduct: true,
    productLabel: "Producto base (opcional)",
    productSublabel: "Si elegís uno del Brand Kit, usa sus fotos como referencia. Podés sumar más fotos arriba.",
    showClothing: false,
    showBackground: false,
    showMoodboard: true,
    showReference: true,
    showVoice: false,
    showTone: false,
    showPlatform: false,
    showLanguage: false,
    showVariations: false,
    showNotes: false,
    objectiveLabel: "Dirección (opcional)",
    objectivePlaceholder: "Opcional: lo que querés enfatizar. Ej. 'mostrar el logo bien grande', 'incluir vista del culo de la botella', 'ángulo más editorial'…",
    inputsHint: "Subí hasta 8 fotos del producto (front, back, detail, packaging) o elegí un producto guardado del Brand Kit. Una imagen por vista seleccionada, no una composite.",
  },
  stepHandlers: {
    brief: handleBrief,
    generate: handleGenerate,
    save: handleSave,
  },
  approvalSteps: ["brief", "generate"],
  autoRunSteps: ["save"],
};
