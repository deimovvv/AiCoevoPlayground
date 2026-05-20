/**
 * Avatar Creator — Tool Definition
 * ──────────────────────────────────
 * 3-step pipeline: brief → generate → save
 * Generates AI avatars from brand context + style selection.
 */

import type { ToolDefinition } from "../types";
import { handleBrief, handleGenerate, handleSave } from "./handlers";

export const avatarCreator: ToolDefinition = {
  schema: {
    // showAvatar is overridden to true by ToolRunPage when avatarToolMode === "poses"
    showAvatar: false,
    avatarLabel: "Avatar base",
    avatarSublabel: "El avatar del Brand Kit sobre el que se genera la pose sheet",
    showProduct: false,
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
    objectiveLabel: "Avatar Direction",
    objectivePlaceholder: "Optional: describe what you're looking for. E.g., 'confident young woman for Gen Z streetwear brand' or 'professional man 30-40 for a fintech service'...",
    inputsHint: "Subí imágenes de referencia (cara, vibe, fotos similares) para que Nano Banana las use como guía. Elegí un moodboard del Brand Kit para fijar la estética visual.",
  },
  stepHandlers: {
    brief: handleBrief,
    generate: handleGenerate,
    save: handleSave,
  },
  approvalSteps: ["brief", "generate"],
  autoRunSteps: ["save"],
};
