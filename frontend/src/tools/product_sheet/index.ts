/**
 * Product Sheet — Tool Definition
 * ─────────────────────────────────
 * Sibling of Avatar Sheet but for objects. 3-step pipeline mirrors the avatar one
 * so it's mentally easy to navigate: brief → generate → save.
 *
 * Two modes (chosen via config.productSheetMode):
 *   - "sheet"   → multi-view product sheet on white background (front / 3-4 / back / side / top / hero / scale)
 *   - "details" → macro close-ups of the same product (texture, logo, label, hardware, stitching)
 *
 * Inputs:
 *   - A saved Product from the Brand Kit (uses its multi-photo `images[]`), OR
 *   - 1-4 uploaded reference photos.
 *   - Both work together: saved photos go in first, then uploaded extras fill remaining slots (cap 4).
 */

import type { ToolDefinition } from "../types";
import { handleBrief, handleGenerate, handleSave } from "./handlers";

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
    inputsHint: "Subí 1-4 fotos del producto (front, back, detail, packaging) o elegí un producto guardado del Brand Kit. Gemini las cruza y arma un brief para que Nano Banana genere la sheet.",
  },
  stepHandlers: {
    brief: handleBrief,
    generate: handleGenerate,
    save: handleSave,
  },
  approvalSteps: ["brief", "generate"],
  autoRunSteps: ["save"],
};
