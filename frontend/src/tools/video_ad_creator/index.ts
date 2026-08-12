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
  handleScript, handleBaseImage, handleImages,
  handleVoice, handleAnimate, handleRender,
} from "./handlers";

export const videoAdCreator: ToolDefinition = {
  schema: {
    showAvatar: true, avatarLabel: "Character", avatarSublabel: "optional — include talent in the ad",
    showProduct: true, productLabel: "Product",
    showClothing: true, clothingLabel: "Prendas", clothingSublabel: "what the character wears",
    showBackground: true,
    showMoodboard: true,
    showReference: true,
    showVoice: true,
    showTone: false,
    showPlatform: false,
    showLanguage: true,
    showVariations: false,
    objectiveLabel: "Brief / guión del proyecto",
    objectivePlaceholder: "Pegá el brief, el guión o de qué se trata el proyecto. La IA lo interpreta, propone el personaje y arma el storyboard alrededor de esto. Ej: 'Lanzamiento de una bebida energética natural para runners; tono fresco y aspiracional; protagonista mujer 28 corriendo al amanecer...'",
    showNotes: false,
  },
  stepHandlers: {
    script: handleScript,
    base_image: handleBaseImage,
    images: handleImages,
    voice: handleVoice,
    animate: handleAnimate,
    render: handleRender,
  },
  approvalSteps: ["script", "base_image", "images", "voice", "animate"],
  autoRunSteps: ["images", "voice", "render"],
};
