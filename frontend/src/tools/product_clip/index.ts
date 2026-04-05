/**
 * Product Clip — Tool Definition
 * ────────────────────────────────
 * Pipeline: script → base_image → images → animate → render
 * Short product video (10-15s). No people. Product only.
 */

import type { ToolDefinition } from "../types";
import { handleScript, handleBaseImage, handleImages, handleAnimate, handleRender } from "./handlers";

export const productClip: ToolDefinition = {
  schema: {
    showAvatar: false,
    showProduct: true, productLabel: "Product",
    showClothing: false,
    showBackground: false,
    showVoice: false,
    showTone: false,
    showPlatform: false,
    showLanguage: false,
    showVariations: true,
    objectiveLabel: "Creative Direction (optional)",
    objectivePlaceholder: "E.g., 'luxury reveal, dark background, dramatic lighting' or leave empty...",
    showNotes: false,
  },
  stepHandlers: {
    script: handleScript,
    base_image: handleBaseImage,
    images: handleImages,
    animate: handleAnimate,
    render: handleRender,
  },
  approvalSteps: ["script", "base_image", "images", "animate"],
  autoRunSteps: ["images", "render"],
};
