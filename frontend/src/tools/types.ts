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
  numVariations: 3,
  locationRef: "",
  styleRef: "",
  productIsWorn: false,
  aspectRatio: "9:16",
  resolution: "1K",
  subtitleEngine: "auto",
  adStyle: "photorealistic",
  referenceImages: [],
  allowFaces: true,
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
