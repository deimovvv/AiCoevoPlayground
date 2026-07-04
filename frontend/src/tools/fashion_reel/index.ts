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
// `motion` queda como fallback; `motionVariants` es la lista que rota por escena para
// que dos clips del MISMO plano (ej. dos "general") NO salgan con el idéntico movimiento.
// El handler elige motionVariants[nth % length] según la Nº ocurrencia de ese shot.
export const VIDEO_SHOT_CATALOG: Record<string, { label: string; framing: string; motion: string; motionVariants: string[] }> = {
  general: {
    label: "Plano general",
    framing: "FULL-BODY vertical 9:16: the model stands centered, facing camera, the full outfit clearly visible from head to toe. Face fully visible — identity anchored.",
    motion: "Subtle, almost static — micro-movements only (breathing, slow weight shift, soft sway). Camera mostly still with a barely perceptible push-in. Face stays in frame throughout.",
    motionVariants: [
      "Subtle, almost static — micro-movements only (breathing, slow weight shift, soft sway). Camera mostly still with a barely perceptible push-in. Face stays in frame throughout.",
      "Slow, smooth camera orbit a few degrees around the model while she holds a confident stance; gentle hair movement. Face stays in frame the whole time.",
      "The model shifts her weight from one leg to the other and lets her hands settle naturally; camera holds with a very slow push-in. Face visible throughout.",
      "Slow camera pull-back that reveals the full look head-to-toe as the model gives a soft, confident chin lift. Face in frame.",
    ],
  },
  medium: {
    label: "Plano medio",
    framing: "MEDIUM (half-body) vertical 9:16: framing from the hips up, the model facing camera, the upper portion of the outfit (top, jacket, accessories) clearly visible. Face fully visible — identity anchored.",
    motion: "Gentle camera arc around the subject OR slow subject rotation showing the front and 3/4 of the outfit. Face stays visible at all times. No sudden moves.",
    motionVariants: [
      "Gentle camera arc around the subject showing the front and 3/4 of the outfit. Face stays visible at all times. No sudden moves.",
      "The model slowly turns her torso from front to a 3/4 angle and back, showcasing the top/jacket; camera steady. Face visible throughout.",
      "Slow push-in to the upper body as the model adjusts her posture and gives a confident look to camera. Face visible.",
      "Soft handheld drift with a subtle hair flick as the model settles into her pose; camera reframes slightly. Face visible.",
    ],
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
    motionVariants: [
      "Slow dolly-in toward the garment detail with the face remaining in frame the whole time. Subtle pull-back at the end that brings the face into sharper focus. Face never leaves frame.",
      "The model's hand rises to lightly touch or adjust the garment detail (collar, cuff, zipper pull, pocket) while the camera holds close; face stays visible in the upper frame.",
      "A slow pan across the garment texture and hardware, ending with a gentle tilt up to the model's face. Face never leaves frame.",
      "Micro rack-focus from the fabric detail to the model's face and back, with minimal body movement. Face stays in frame.",
    ],
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
    motionVariants: [
      "The model holds the over-the-shoulder pose with a slight head turn back-and-forth. Face stays visible. NO full back-turn. Camera may slowly orbit a few degrees.",
      "The model glances back over her shoulder, hair sweeping softly, then settles; camera slowly pushes in on the back of the outfit. Face stays visible in 3/4 view.",
      "Slow camera orbit from the side toward the back while the model keeps her face turned to the lens over her shoulder. Never a full back-turn; face stays visible.",
    ],
  },
};

export const DEFAULT_LOOKS_SHOTS = ["general", "detail"];

export const fashionReel: ToolDefinition = {
  schema: {
    showAvatar: true,
    avatarLabel: "Model",
    avatarSublabel: "Modelo del reel",
    // Producto oculto — Fashion Reel es sobre outfits/looks, no product hero. Para
    // sumar cartera/lentes está la sección Accesorios. (Feedback usuario.)
    showProduct: false,
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
