import type { ToolDefinition } from "../types";
import { handlePrompt, handleGenerate, handleVariations } from "../product_spotlight/handlers";

export const fashionEditorial: ToolDefinition = {
  schema: {
    showAvatar: true, avatarLabel: "Model / Avatar", avatarSublabel: "The model for the editorial",
    showProduct: true, productLabel: "Accessories / Product",
    showClothing: true, clothingLabel: "Garments", clothingSublabel: "multi-select — each garment is styled",
    showBackground: true,
    showVoice: false, showTone: false, showPlatform: false, showLanguage: false, showVariations: true,
    objectiveLabel: "Pose Direction",
    objectivePlaceholder: "Describe the pose and mood...",
    showNotes: false,
    showLocationRef: true, showStyleRef: true,
  },
  stepHandlers: { prompt: handlePrompt, generate: handleGenerate, variations: handleVariations },
  approvalSteps: ["prompt", "generate"],
};
