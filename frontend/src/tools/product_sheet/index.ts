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
export const PRODUCT_BASE_PROMPT = `THIS IS A TECHNICAL DOCUMENTATION TASK, NOT CREATIVE REINTERPRETATION. The reference images show the EXACT product to reproduce. Your ONLY job is to redraw THIS SAME PRODUCT under different lighting — do NOT redesign it.

NON-NEGOTIABLE IDENTITY PRESERVATION: copy LITERALLY from the references — same exact body shape and silhouette, same exact headlight design and shape, same exact grille/front face, same exact wheel design (same spoke pattern, same rim), same exact taillight design, same exact badge and logo positions, same exact proportions, same exact color (the TRUE color as defined in the brief, NOT the apparent color under colored studio lighting in the photos). Do NOT "improve" the design, do NOT add chrome trim that isn't there, do NOT change the headlight signature, do NOT alter the wheel design.

LIGHTING TRANSFORMATION: the reference photos may have dramatic colored studio lighting (warm yellow gels, orange floors, harsh side light, deep shadows). IGNORE the lighting and background of the references — only extract the product itself and re-render it under NEUTRAL even softbox lighting at 5000K daylight on pure white cyclorama. The product's color must read as its TRUE color (the one declared in the brief, not the tinted apparent color from the source photos).

BACKGROUND AND CAMERA: pure white seamless cyclorama studio background (#FFFFFF), no environment, no props, no plants, no people, no text, no horizon line, no colored floors. Soft even diffused softbox lighting from above and both sides, no harsh shadows, no harsh contrast, with a subtle soft contact shadow directly beneath the product to anchor it to the ground. Camera locked-off, medium telephoto lens, no distortion, sharp focus throughout, deep depth of field. Clean catalog product photography style, photorealistic, hyperrealistic detail.

PROHIBITED: lens flares, motion blur, dramatic chrome highlights, decorative reflections, dramatic shadows, colored gels, orange/yellow/red tints, any background elements beyond pure white, any creative reinterpretation of the product's form.`;

/** Fidelidad anti-invención — se concatena al base prompt cuando el usuario
 *  pide una vista que NO está cubierta por las refs (ej. back con solo frente).
 *  Le pide a Nano Banana inferir MÍNIMAMENTE, no embellecer. */
export const PRODUCT_FIDELITY_RULES = `FIDELITY RULES (NON-NEGOTIABLE — these override all other instructions):

(1) The output MUST show the EXACT product from the references. Same body shape, same headlights, same grille, same wheels (same spoke pattern), same taillights, same badging, same proportions. NEVER generate a similar-but-different product. Do NOT redesign or "improve" any element.

(2) COLOR FIDELITY: use the TRUE color of the product as defined in the brief (e.g. "silver", "white"), NOT the apparent color under the source photos' studio lighting. If the references show a silver car under warm yellow stage light (making it appear champagne), the output must still be SILVER — the white cyclorama lighting will reveal the true silver. Never copy a colored tint from the source lighting.

(3) ONLY use angles and details actually visible across the references. NEVER invent.

(4) When inferring an angle not directly photographed (e.g. inferring back from front + side), keep the inference MINIMAL and grounded: same color, same material, same proportions, no embellishment, no invented details.

(5) If a view cannot be safely inferred, prefer a less ambitious framing over inventing.

(6) IF THERE IS ANY CONFLICT between "preserve product identity" and "create a pretty studio shot" — IDENTITY WINS. This is a technical reference sheet, not a marketing render.`;

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
    // Moodboard NO va en Product Sheet — el objetivo es fidelidad al producto real,
    // no estilo libre. Inyectar moodboard como "ART DIRECTION reference" hace que
    // Nano Banana se desvíe de la verdad del producto. Si el usuario quiere matizar
    // estética (lighting / palette / mood), tiene el campo "Dirección" abajo en texto.
    showMoodboard: false,
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
  // Brief y Generate requieren approval (revisás análisis de Gemini + composite
  // antes de guardar). PERO el step Generate arranca SOLO cuando aprobás el brief
  // — no hay que apretar "Run" otra vez. autoRunSteps incluye generate y save.
  approvalSteps: ["brief", "generate"],
  autoRunSteps: ["generate", "save"],
};
