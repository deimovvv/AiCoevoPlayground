/**
 * Content Analyzer — Tool Definition
 * ────────────────────────────────────
 * Pipeline: analyze → adapt → generate_batch
 *
 * Analyze any video content, extract its structure and style,
 * then recreate similar content with your brand's assets.
 */

import type { ToolDefinition } from "../types";
import { handleAnalyze, handleAdapt, handleGenerateBatch } from "./handlers";

export const contentAnalyzer: ToolDefinition = {
  schema: {
    showAvatar: true, avatarLabel: "Characters", avatarSublabel: "multi-select — people in the scene",
    multiAvatar: true,
    showProduct: true, productLabel: "Products",
    multiProduct: true,
    showClothing: true, clothingLabel: "Garments", clothingSublabel: "multi-select",
    showBackground: false,
    showVoice: false,
    showTone: false,
    showPlatform: false,
    showLanguage: true,
    showVariations: false,
    objectiveLabel: "Video URL (optional)",
    objectivePlaceholder: "Paste URL here... or upload a video file below (recommended)",
    showNotes: false,
  },
  stepHandlers: {
    analyze: handleAnalyze,
    adapt: handleAdapt,
    generate_batch: handleGenerateBatch,
  },
  approvalSteps: ["analyze", "adapt"],
  autoRunSteps: ["adapt", "generate_batch"],
};
