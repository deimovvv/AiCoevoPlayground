/**
 * Avatar Creator — Tool Definition
 * ──────────────────────────────────
 * 3-step pipeline: brief → generate → save
 * Generates AI avatars from brand context + style selection.
 */

import type { ToolDefinition } from "../types";
import { handleBrief, handleGenerate, handleSave } from "./handlers";

// ── Catálogo de vistas para la pose sheet ────────────────────────────
// Cada vista es una "ventana" del composite reference sheet que arma Nano
// Banana. El usuario tilda las que quiere y el handler construye el prompt
// del composite SOLO con esas vistas. Por categorías para que sea claro:
//   body_*  → cuerpo entero o medio cuerpo
//   face_*  → primer plano de cara (para detalle de features)
//   extra_* → vistas de detalle (manos, expresiones específicas)
export const AVATAR_VIEWS: Record<string, { label: string; group: "body" | "face" | "extra"; prompt: string }> = {
  body_front:   { label: "Cuerpo · Frente",   group: "body", prompt: "full body front view (standing, natural pose, arms relaxed at sides)" },
  body_34:      { label: "Cuerpo · 3/4",       group: "body", prompt: "full body three-quarter angle view (body turned ~30°, full visible)" },
  body_side:    { label: "Cuerpo · Perfil",    group: "body", prompt: "full body side profile view (90° turn, full silhouette visible)" },
  body_back:    { label: "Cuerpo · Espalda",   group: "body", prompt: "full body back view (facing away from camera, full back visible)" },
  face_front:   { label: "Cara · Frente",      group: "face", prompt: "tight face close-up portrait, front view (head and shoulders, eyes forward)" },
  face_34:      { label: "Cara · 3/4",         group: "face", prompt: "tight face close-up portrait, three-quarter angle (head turned ~30°)" },
  face_side:    { label: "Cara · Perfil",      group: "face", prompt: "tight face profile portrait (90° head turn, full side of face visible)" },
  face_topdown: { label: "Cara · Picado",      group: "face", prompt: "face close-up from a slightly high angle (camera looking down ~15°)" },
  extra_hands:  { label: "Detalle · Manos",    group: "extra", prompt: "close-up of the person's hands (palms or detail of fingers, neutral pose)" },
  extra_smile:  { label: "Expresión · Sonrisa", group: "extra", prompt: "face close-up with a natural soft smile (different mood from the other views)" },
};

export const DEFAULT_AVATAR_VIEWS = ["body_front", "face_front", "face_34", "face_side"];

export const avatarCreator: ToolDefinition = {
  schema: {
    // showAvatar is overridden to true by ToolRunPage when avatarToolMode === "poses"
    showAvatar: false,
    avatarLabel: "Avatar base",
    avatarSublabel: "El avatar del Brand Kit sobre el que se genera la pose sheet",
    showProduct: false,
    showClothing: false,
    showBackground: false,
    showMoodboard: true,
    showReference: true,
    showVoice: false,
    showTone: false,
    showPlatform: false,
    showLanguage: false,
    showVariations: false,
    showNotes: false,
    objectiveLabel: "Avatar Direction",
    objectivePlaceholder: "Optional: describe what you're looking for. E.g., 'confident young woman for Gen Z streetwear brand' or 'professional man 30-40 for a fintech service'...",
    inputsHint: "Subí imágenes de referencia (cara, vibe, fotos similares) para que Nano Banana las use como guía. Elegí un moodboard del Brand Kit para fijar la estética visual.",
  },
  stepHandlers: {
    brief: handleBrief,
    generate: handleGenerate,
    save: handleSave,
  },
  approvalSteps: ["brief", "generate"],
  autoRunSteps: ["save"],
};
