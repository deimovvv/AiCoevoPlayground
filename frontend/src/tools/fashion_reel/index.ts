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

/**
 * Video shot catalog para Looks mode — análogo al SHOT_CATALOG de Ecommerce Pack
 * pero adaptado a video (cada shot tiene su intención de framing + sugerencia de
 * movimiento). Para cada outfit seleccionado el usuario decide qué shots quiere
 * generar; el render final concatena en el orden del array `looksShots` × outfits.
 *
 * `framing` → se inyecta en el image_prompt del script.
 * `motion`  → se inyecta en el animate_prompt como motion hint.
 *
 * Mantenido a propósito SIN shots de "lifestyle" (caminando / sentado / etc.) —
 * ese set se introduce más adelante junto con un panel de pose-ref por shot.
 */
export const VIDEO_SHOT_CATALOG: Record<string, { label: string; framing: string; motion: string }> = {
  general: {
    label: "Plano general",
    framing: "FULL-BODY vertical 9:16: the model stands centered, facing camera, the full outfit clearly visible from head to toe. Face fully visible — identity anchored.",
    motion: "Subtle, almost static — micro-movements only (breathing, slow weight shift, soft sway). Camera mostly still with a barely perceptible push-in. Face stays in frame throughout.",
  },
  medium: {
    label: "Plano medio",
    framing: "MEDIUM (half-body) vertical 9:16: framing from the hips up, the model facing camera, the upper portion of the outfit (top, jacket, accessories) clearly visible. Face fully visible — identity anchored.",
    motion: "Gentle camera arc around the subject OR slow subject rotation showing the front and 3/4 of the outfit. Face stays visible at all times. No sudden moves.",
  },
  detail: {
    // Identity-safe detail shot: showcases the garment texture/stitching/hardware
    // WHILE keeping the model's face in frame as anchor. The old "MACRO without face"
    // version made identity drift in video — Kling/Nano Banana had no anchor between
    // frames so the model came out "not her" in detail shots. Now the detail is part
    // of a tight half-body composition where the face stays visible (upper frame,
    // even if soft-focus). Sharp on the garment, but identity preserved.
    label: "Plano detalle",
    framing: "TIGHT MEDIUM CLOSE-UP vertical 9:16: framing the upper torso and the relevant garment detail (chest area, neckline, lapel, sleeve cuff, pocket, fabric texture, logo, hardware) — the model's FACE IS VISIBLE in the upper portion of the frame. Sharp focus on the garment detail; the face can be slightly softer but NEVER cropped out. Identity anchored by the face throughout.",
    motion: "Slow dolly-in toward the detail with the face REMAINING in frame the whole time. Optional: subtle pull-back or pan up at the end that brings the face into sharper focus. Face never leaves frame.",
  },
  back: {
    // Identity-safe back shot: showcases how the outfit sits at the back (cut, drape,
    // back graphics) WITHOUT the model fully facing away — the model glances back over
    // her shoulder so her face stays in frame. The previous "full back turn" version
    // broke identity in video — the morph between front-facing and full-back frames
    // had no face anchor for identity continuity, so the model came out "not her" on
    // the rotation. Now we always keep the face visible via the over-the-shoulder pose.
    label: "De espalda",
    framing: "THREE-QUARTER BACK / OVER-THE-SHOULDER vertical 9:16: the model is positioned with her back 3/4 toward camera BUT glancing back over her shoulder toward the lens — her face is clearly visible in profile or 3/4 view. The back of the outfit (cut, drape, back graphics, fit) is the focus, but identity is ANCHORED by the face. NEVER fully facing away — the face must always remain visible enough to recognize her.",
    motion: "Subtle: model holds the over-the-shoulder pose with a slight head turn back-and-forth. Face stays visible throughout. NO full back-turn. Camera may slowly orbit a few degrees but the face never leaves frame.",
  },
};

export const DEFAULT_LOOKS_SHOTS = ["general", "detail"];

export const fashionReel: ToolDefinition = {
  schema: {
    showAvatar: true,
    avatarLabel: "Model",
    avatarSublabel: "Modelo del reel",
    showProduct: true,
    productLabel: "Producto",
    showClothing: true,
    clothingLabel: "Outfits",
    clothingSublabel: "multi-select",
    showBackground: true,
    backgroundSublabel: "opcional · si vacío, se infiere",
    showMoodboard: true,
    showReference: true,
    showVoice: false,
    showSubtitles: false,
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
