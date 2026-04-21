/**
 * UGC Creator — Tool Definition
 * ──────────────────────────────
 * 6-step pipeline: script → base_image → multishot → voice → lipsync → render
 * Multishot generates variations AND lets you select/edit (replaces old curation step).
 */

import type { ToolDefinition } from "../types";
import {
  handleScript, handleBaseImage, handleMultishot,
  handleVoice, handleLipsync, handleRender,
} from "./handlers";

export const ugcCreator: ToolDefinition = {
  schema: {
    showAvatar: true, avatarLabel: "Avatar", avatarSublabel: "Who appears in the video",
    showProduct: true, productLabel: "Product",
    showClothing: true, clothingLabel: "Clothing", clothingSublabel: "optional, multi-select",
    showBackground: true,
    showVoice: true, showTone: false, showPlatform: false, showLanguage: true, showVariations: false,
    showStyleRef: true,
    objectiveLabel: "Video Objective",
    objectivePlaceholder: "Describe what you want to achieve...",
    showNotes: false,
  },
  stepHandlers: {
    script: handleScript,
    base_image: handleBaseImage,
    multishot: handleMultishot,
    voice: handleVoice,
    lipsync: handleLipsync,
    render: handleRender,
  },
  approvalSteps: ["script", "base_image", "multishot", "voice", "lipsync"],
  autoRunSteps: ["base_image", "multishot", "render"],
};
