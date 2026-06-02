/**
 * Coevo Studio — Tool System Types
 * ─────────────────────────────────
 * Shared types for the modular tool pipeline system.
 */

import type { Brand } from "../lib/api";

// ── Pipeline Step Types ──────────────────────────────────

export type StepStatus = "pending" | "active" | "running" | "review" | "done" | "error";

export interface StepState {
  id: string;
  status: StepStatus;
  result?: unknown;
  error?: string;
}

// ── Tool Entry (from backend registry.json) ──────────────

export interface ToolEntry {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  status: string;
  pipeline: string[];
}

// ── Tool Config (form state) ─────────────────────────────

export interface ToolConfig {
  selectedAvatarId: string | null;
  selectedProductId: string | null;
  selectedClothingIds: string[];
  selectedBackgroundId: string | null;
  selectedMoodboardId: string | null;
  selectedVoiceId: string | null;
  objective: string;
  tone: string;
  platform: string;
  language: string;
  notes: string;
  numVariations: number;
  locationRef: string;
  styleRef: string;
  productIsWorn: boolean;
  aspectRatio: string;
  resolution: string;
  subtitleEngine: "auto" | "remotion" | "ffmpeg" | "none";
  adStyle: string;
  referenceImages: File[];
  allowFaces: boolean;
  // ElevenLabs voice settings (global per pipeline run)
  voiceStability: number;           // 0.0–1.0, 0.5 = "Natural"
  voiceSimilarityBoost: number;     // 0.0–1.0, 0.8 default
  voiceStyle: number;               // 0.0–1.0, 0 = natural. Subir para más emoción.
  voiceSpeed: number;               // 0.7–1.2, 1.0 = normal
  voiceSpeakerBoost: boolean;       // true por default
  // Image model selection — nano-banana-2 (multi-ref composition) vs gpt-image-2 (single-base edit)
  imageModel: "nano-banana-2" | "gpt-image-2";
  // How the uploaded Reference Image should be interpreted
  referenceMode: "style" | "composition";
  // Static Ad: include copy/headline overlay or leave clean (editorial mode)
  includeCopy: boolean;
  // Avatar tool: "create" new from brand context | "poses" = generate pose sheet for an existing avatar
  avatarToolMode: "create" | "poses";
  // Avatar tool (poses mode): what to do after generating — "new" saves as new avatar, "replace" overwrites the source avatar
  avatarPosesSave: "new" | "replace";
  // Product Sheet tool: "sheet" = multi-view (front/3-4/back/side/top/hero) | "details" = macro close-ups (texture/logo/label/hardware)
  productSheetMode: "sheet" | "details";
  // Product Sheet: what to do with the result on save — "new" creates a new product entry, "replace" overwrites the source product's primary photo, "asset" saves without touching the catalog
  productSheetSave: "new" | "replace" | "asset";
  // Compose mode (Carousel/Static Ad): "quick" = text in image (fast) | "compose" = clean image + HTML overlay with brand fonts (perfect typography)
  composeMode: "quick" | "compose";
  // Selected overlay template id when composeMode = "compose"
  overlayTemplate: string;
  // Setting/Location override — when set, OVERRIDES any setting inferred from brand context.
  // Use to break out of a brand's default scenario for a specific generation.
  // Example: brand context says "workshop", but for this run you want "outdoor street, sunset".
  settingOverride: string;
  // Static Ad: how many ads to generate when batch mode is on
  staticAdBatch: 1 | 3 | 5 | 10 | "all";
  // Static Ad batch: optional category filter ("" = all categories)
  staticAdCategory: string;
  // Carousel: when a template is uploaded, decide if colors come from the brand or stay literal from the template
  // "brand" → re-color with brand palette (default — for inspiration templates from other brands)
  // "template" → keep template colors literal (for official brand templates)
  templateColorMode: "brand" | "template";
  // Video animation engine — controls how the `animate` step turns scene images into video.
  //   "kling" → Kling V3 Pro image-to-video (single frame as start). Current default.
  //   "seedance" → Seedance 2.0 reference-to-video (multi-ref: avatar + product + clothing + bg).
  //                Better consistency when there are several brand assets to integrate.
  //                Only affects creative/b-roll scenes in UGC (talking scenes still use lipsync).
  animationEngine: "kling" | "seedance";
  // Carousel: optional per-slide template references. When length matches numSlides, the handler
  // uses perSlideTemplates[i] as the unique layout reference for slide i (instead of the same
  // template for all slides). Used by the IG replication flow so each slide follows its
  // corresponding original slide's composition. Empty/undefined → fall back to referenceImages.
  perSlideTemplates?: File[];
}

export const DEFAULT_CONFIG: ToolConfig = {
  selectedAvatarId: null,
  selectedProductId: null,
  selectedClothingIds: [],
  selectedBackgroundId: null,
  selectedMoodboardId: null,
  selectedVoiceId: null,
  objective: "",
  tone: "engaging",
  platform: "instagram",
  language: "es",
  notes: "",
  numVariations: 1,
  locationRef: "",
  styleRef: "",
  productIsWorn: false,
  aspectRatio: "9:16",
  resolution: "1K",
  subtitleEngine: "auto",
  adStyle: "photorealistic",
  referenceImages: [],
  allowFaces: true,
  voiceStability: 0.5,
  voiceSimilarityBoost: 0.8,
  voiceStyle: 0.0,
  voiceSpeed: 1.0,
  voiceSpeakerBoost: true,
  imageModel: "nano-banana-2",
  referenceMode: "style",
  includeCopy: true,
  avatarToolMode: "create",
  avatarPosesSave: "new",
  productSheetMode: "sheet",
  productSheetSave: "new",
  composeMode: "quick",
  overlayTemplate: "editorial_bottom",
  settingOverride: "",
  staticAdBatch: 1,
  staticAdCategory: "",
  templateColorMode: "brand",
  animationEngine: "kling",
};

// ── Tool Config Schema (what the form shows) ─────────────

export interface ToolSchema {
  showAvatar: boolean;
  avatarLabel?: string;
  avatarSublabel?: string;
  showProduct: boolean;
  productLabel?: string;
  productSublabel?: string;
  showClothing: boolean;
  clothingLabel?: string;
  clothingSublabel?: string;
  showBackground: boolean;
  backgroundSublabel?: string;
  showMoodboard: boolean;
  /** Reference image upload (style/composition ref). Universal for all image/video tools. */
  showReference?: boolean;
  showVoice: boolean;
  showTone: boolean;
  showPlatform: boolean;
  showLanguage: boolean;
  showVariations: boolean;
  objectiveLabel: string;
  objectivePlaceholder: string;
  showNotes: boolean;
  showLocationRef?: boolean;
  showStyleRef?: boolean;
  multiAvatar?: boolean;
  multiProduct?: boolean;
  /** Show the animation engine selector (Kling vs Seedance). Only for video tools with an `animate` step. */
  showAnimationEngine?: boolean;
  /** Describes what inputs are available and how they affect the output */
  inputsHint?: string;
}

// ── Script Scene (normalized) ────────────────────────────

export interface ScriptScene {
  id: string;
  title: string;
  script: string;
  image_prompt: string;
  sceneType?: string;
  location?: string;
  /** Background asset ID override per scene. If undefined/null → use config.selectedBackgroundId global. If "none" → force no background (text-only) */
  backgroundId?: string | null;
  _showProduct?: boolean;
  /** false = skip avatar references, use text-to-image for this scene */
  _useAvatar?: boolean;
}

/** Normalize a raw scene object from Gemini (handles field name inconsistencies) */
export function normalizeScene(s: Record<string, string>, index: number): ScriptScene {
  console.log(`[normalizeScene ${index}] keys:`, Object.keys(s), "values:", JSON.stringify(s).slice(0, 300));
  return {
    id: s.id || `act_${index + 1}`,
    title: s.title || s.act || `Scene ${index + 1}`,
    script: s.script || s.speech || s.copy || s.text || s.audio || s.dialogue || s.narration || s.voiceover || "",
    image_prompt: s.image_prompt || s.visuals || s.visual || s.visual_prompt || s.scene_description || "",
    backgroundId: undefined,
  };
}

/** Extract normalized scenes from a script step result */
export function extractScenes(result: unknown): ScriptScene[] {
  if (!result) return [];
  const raw = result as Record<string, unknown>;
  let rawArr: Array<Record<string, string>> = [];

  if (raw.scenes) {
    rawArr = ((raw.scenes as Array<Array<Record<string, string>>>)[0]) || [];
  } else if (Array.isArray(result)) {
    rawArr = (result as Array<Array<Record<string, string>>>)[0] || [];
  }

  return rawArr.map((s, i) => normalizeScene(s, i));
}

// ── Audio Cache ──────────────────────────────────────────

export interface AudioCacheEntry {
  url: string;
  blob: Blob;
}

// ── Step Context (passed to handlers) ────────────────────

export interface StepContext {
  activeBrand: Brand;
  config: ToolConfig;
  tool: ToolEntry;
  getStepResult: (stepId: string) => unknown;
  getScriptScenes: () => ScriptScene[];
  audioCache: Record<string, AudioCacheEntry>;
  setAudioCache: (sceneId: string, entry: AudioCacheEntry) => void;
  /** Get all steps with their results — for saving pipeline state */
  getAllSteps?: () => Array<{ id: string; status: string; result?: unknown }>;
  /** Curation selections — for saving pipeline state */
  curationSelections?: Record<string, string>;
}

// ── Step Handler ─────────────────────────────────────────

export type StepHandler = (ctx: StepContext) => Promise<{
  result: unknown;
  needsApproval?: boolean;
  autoRunNext?: boolean;
}>;

// ── Step View Component ──────────────────────────────────

export interface StepViewProps {
  result: unknown;
  config: ToolConfig;
  allSteps: StepState[];
  audioCache: Record<string, AudioCacheEntry>;
  getScriptScenes: () => ScriptScene[];
  onAudioCached?: (sceneId: string, url: string, blob: Blob) => void;
  voiceId?: string | null;
}

export type StepViewComponent = React.ComponentType<StepViewProps>;

// ── Tool Definition ──────────────────────────────────────

export interface ToolDefinition {
  /** Config panel schema — which fields to show */
  schema: ToolSchema;

  /** Step handlers — stepId → async function */
  stepHandlers: Record<string, StepHandler>;

  /** Custom "done/review" views per step — stepId → component */
  stepViews?: Record<string, StepViewComponent>;

  /** Steps that need manual approval (shows Approve button) */
  approvalSteps?: string[];

  /** Steps that auto-run after previous step completes */
  autoRunSteps?: string[];

  /** Custom approve logic per step */
  onApprove?: Record<string, (ctx: StepContext) => unknown>;
}
