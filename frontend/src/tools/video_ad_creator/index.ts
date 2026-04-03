/**
 * Video Ad Creator — Tool Definition
 * ────────────────────────────────────
 * Pipeline: script → images → review_images → voice → animate → render
 *
 * Creates cinematic video ads from product/avatar + style selection.
 * Generates 10 keyframes, animates frame-to-frame with Kling, adds voiceover.
 */

import type { ToolDefinition } from "../types";
import {
  handleScript, handleImages, handleReviewImages,
  handleVoice, handleAnimate, handleRender,
} from "./handlers";

export const videoAdCreator: ToolDefinition = {
  schema: {
    showAvatar: true, avatarLabel: "Character", avatarSublabel: "optional — include talent in the ad",
    showProduct: true, productLabel: "Product",
    showClothing: true, clothingLabel: "Garments", clothingSublabel: "what the character wears",
    showBackground: false,
    showVoice: true,
    showTone: false,
    showPlatform: false,
    showLanguage: true,
    showVariations: false,
    objectiveLabel: "Creative Direction",
    objectivePlaceholder: "Describe the ad concept. E.g., 'luxury product reveal, dramatic lighting, premium feel' or 'fun casual ad, bright colors, young audience'...",
    showNotes: false,
  },
  stepHandlers: {
    script: handleScript,
    images: handleImages,
    review_images: handleReviewImages,
    voice: handleVoice,
    animate: handleAnimate,
    render: handleRender,
  },
  approvalSteps: ["script", "images"],
  autoRunSteps: ["images", "voice", "animate", "render"],
};
