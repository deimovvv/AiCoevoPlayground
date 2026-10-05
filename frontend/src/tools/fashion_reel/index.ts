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

export { VIDEO_SHOT_CATALOG, DEFAULT_LOOKS_SHOTS } from "./shots";

export const fashionReel: ToolDefinition = {
  schema: {
    showAvatar: true,
    avatarLabel: "Model",
    avatarSublabel: "Modelo del reel",
    // Producto oculto — Fashion Reel es sobre outfits/looks, no product hero. Para
    // sumar cartera/lentes está la sección Accesorios. (Feedback usuario.)
    showProduct: false,
    showClothing: true,
    clothingLabel: "Prendas",
    clothingSublabel: "multi-select",
    showBackground: true,
    backgroundSublabel: "opcional · si vacío, se infiere",
    showMoodboard: false,  // apagado 2026-09-23: lo define la receta
    showReference: false,  // apagado 2026-09-23: lo define la receta
    showVoice: false,
    showSubtitles: false,
    showTone: false,
    showPlatform: false,
    showLanguage: false,
    showVariations: false,
    showStyleRef: false,  // apagado 2026-09-23: lo define la receta
    showAnimationEngine: true,
    // "Dirección del guion", no "mood": esto alimenta el SCRIPT (creative_direction),
    // mientras que el look visual lo maneja el campo Look & feel (styleRef).
    objectiveLabel: "Dirección del guion",
    objectivePlaceholder: "Qué pasa en el reel: ritmo, actitud, progresión. Ej: 'arranca quieta y va ganando confianza', 'energía de verano, movimiento suelto'. El look visual se define abajo en Look & feel.",
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
