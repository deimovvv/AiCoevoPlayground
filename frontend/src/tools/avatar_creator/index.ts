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
    showAvatar: false,
    showProduct: false,
    showClothing: false,
    showBackground: false,
    showVoice: false,
    showTone: false,
    showPlatform: false,
    showLanguage: false,
    showVariations: false,
    showNotes: false,
    objectiveLabel: "Avatar Direction",
    objectivePlaceholder: "Optional: describe what you're looking for. E.g., 'confident young woman for Gen Z streetwear brand' or 'professional man 30-40 for a fintech service'...",
  },
  stepHandlers: {
    brief: handleBrief,
    generate: handleGenerate,
    save: handleSave,
  },
  approvalSteps: ["brief", "generate"],
  autoRunSteps: ["save"],
};
