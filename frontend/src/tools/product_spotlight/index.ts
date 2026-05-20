import type { ToolDefinition } from "../types";
import { handlePrompt, handleGenerate, handleVariations } from "./handlers";

export const productSpotlight: ToolDefinition = {
  schema: {
    showAvatar: false, showProduct: true, productLabel: "Product",
    showClothing: false, showBackground: true,
    showMoodboard: true, showReference: true,
    showVoice: false, showTone: false, showPlatform: false, showLanguage: false, showVariations: true,
    objectiveLabel: "Setting Description",
    objectivePlaceholder: "Describe the desired setting...",
    showNotes: false,
  },
  stepHandlers: { prompt: handlePrompt, generate: handleGenerate, variations: handleVariations },
  approvalSteps: ["prompt", "generate"],
};
