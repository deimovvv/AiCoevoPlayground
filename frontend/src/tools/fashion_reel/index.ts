/**
 * Fashion Reel — Tool Definition
 * ────────────────────────────────
 * Pipeline: script → base_image → multishot → animate → render
 *
 * Visual-only reel (no voice, no lipsync).
 * Story mode: 4-scene narrative (Hook → Movement → Showcase → Closer)
 * Looks mode: one scene per outfit
 */

import type { ToolDefinition } from "../types";
import { handleScript, handleBaseImage, handleMultishot, handleAnimate, handleRender } from "./handlers";

export const fashionReel: ToolDefinition = {
  schema: {
    showAvatar: true,
    avatarLabel: "Model",
    avatarSublabel: "The person in every frame",
    showProduct: true,
    productLabel: "Product",
    showClothing: true,
    clothingLabel: "Outfits / Garments",
    clothingSublabel: "Story: wardrobe for the reel — Looks: each item = one scene",
    showBackground: true,
    showMoodboard: true,
    showReference: true,
    showVoice: false,
    showTone: false,
    showPlatform: false,
    showLanguage: false,
    showVariations: false,
    showStyleRef: true,
    showAnimationEngine: true,
    objectiveLabel: "Direction / Mood",
    objectivePlaceholder: "Describe the mood, movement style, or creative direction. E.g., 'confident editorial walk', 'playful summer energy', 'dark moody fashion'...",
    showNotes: false,
  },
  stepHandlers: {
    script: handleScript,
    base_image: handleBaseImage,
    multishot: handleMultishot,
    animate: handleAnimate,
    render: handleRender,
  },
  approvalSteps: ["script", "base_image", "multishot", "animate"],
  autoRunSteps: ["base_image", "multishot", "render"],
};
