/**
 * Ad Creative Lab — Tool Definition
 * ───────────────────────────────────
 * Pipeline: visual_guide → prompts → generate_batch → review
 *
 * Generates brand-consistent ad creatives from reference images.
 * Upload references → analyze visual style → generate prompts → batch generate → review & iterate.
 */

import type { ToolDefinition } from "../types";
import { handleVisualGuide, handlePrompts, handleGenerateBatch, handleReview } from "./handlers";

export const adCreativeLab: ToolDefinition = {
  schema: {
    showAvatar: true, avatarLabel: "Model / Avatar", avatarSublabel: "optional — include for fashion/lifestyle",
    showProduct: true, productLabel: "Product",
    showClothing: true, clothingLabel: "Garments", clothingSublabel: "what the model wears",
    showBackground: true,
    showVoice: false,
    showTone: false,
    showPlatform: false,
    showLanguage: false,
    showVariations: true,
    objectiveLabel: "Creative Direction (optional)",
    objectivePlaceholder: "Optional — leave empty to let the references guide the style. Or add direction like 'street style for summer', 'editorial minimal', 'luxury lookbook'...",
    showNotes: false,
  },
  stepHandlers: {
    visual_guide: handleVisualGuide,
    prompts: handlePrompts,
    generate_batch: handleGenerateBatch,
    review: handleReview,
  },
  approvalSteps: ["visual_guide"],
  autoRunSteps: ["prompts", "generate_batch"],
};
