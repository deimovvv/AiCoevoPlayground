/**
 * Content Analyzer — Tool Definition
 * ────────────────────────────────────
 * Pipeline: analyze → adapt → generate_batch
 *
 * Analyze any video content, extract its structure and style,
 * then recreate similar content with your brand's assets.
 */

import type { ToolDefinition } from "../types";
import { handleAnalyze, handleMapAssets, handleAdapt, handleRoute, handleGenerateBatch } from "./handlers";

export const contentAnalyzer: ToolDefinition = {
  schema: {
    // Asset detection + mapping replaces these upfront selectors. The analyzer
    // detects what's in the video and the Map Assets step lets the user confirm
    // the mapping to their brand kit — once, after seeing the analysis.
    showAvatar: false,
    showProduct: false,
    showClothing: false,
    showBackground: false,
    showMoodboard: false,
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
    map_assets: handleMapAssets,
    adapt: handleAdapt,
    route: handleRoute,
    generate_batch: handleGenerateBatch,
  },
  approvalSteps: ["analyze", "map_assets", "adapt"],
  // map_assets is auto-run after analyze approval (the matcher runs without user input,
  // but the result panel needs approval to confirm the mappings)
  autoRunSteps: ["map_assets", "adapt", "route"],
};
