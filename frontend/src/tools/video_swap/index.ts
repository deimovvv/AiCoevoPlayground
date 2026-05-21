/**
 * Video Swap — Tool Definition
 * ──────────────────────────────
 * Single-step tool: source video + reference (new look) → Beeble SwitchX swap.
 * Keeps subject/motion of the user's OWN video, swaps a garment/product/background
 * to a reference image, relighting to blend.
 */

import type { ToolDefinition } from "../types";
import { handleSwap } from "./handlers";

export const videoSwap: ToolDefinition = {
  schema: {
    showAvatar: false,
    // Product / clothing can be used as the "reference" (new look) if no upload.
    showProduct: true, productLabel: "Producto (referencia del nuevo look)",
    showClothing: true, clothingLabel: "Prenda (referencia del nuevo look)",
    showBackground: false,
    showMoodboard: false,
    showReference: true,
    showVoice: false,
    showTone: false,
    showPlatform: false,
    showLanguage: false,
    showVariations: false,
    objectiveLabel: "Qué cambiar / cómo (opcional)",
    objectivePlaceholder: "Ej: 'cambiar la remera por la bordó, misma caída, luz cálida' — guía corta, el modelo se basa en tu video",
    showNotes: false,
  },
  stepHandlers: {
    swap: handleSwap,
  },
  approvalSteps: ["swap"],
  autoRunSteps: [],
};
