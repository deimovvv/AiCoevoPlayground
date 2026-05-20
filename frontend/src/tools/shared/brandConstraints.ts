/**
 * Brand Constraints — shared prompt clauses
 * ──────────────────────────────────────────
 * Generates the strict-rule clauses that should be appended to image-generation prompts:
 *   1. Setting override — pins a specific scene/location, overriding brand context
 *   2. Avatar lock — prevents the model from inventing other brand-context characters
 *   3. Palette constraint — restricts colors to the Brand DNA hex palette
 *
 * These clauses are appended at the END of the prompt because models pay extra attention
 * to the trailing instructions for hard constraints.
 */

import type { Brand, ToolConfig } from "../../lib/api";
import type { ToolConfig as Cfg } from "../types";

interface BrandLike {
  avatars?: Array<{ id: string }>;
  dna?: { colors?: Array<{ name?: string; hex?: string; usage?: string }> };
}

/**
 * Build the constraint clauses for an image generation prompt.
 * Pass an `extraNote` for tool-specific framing (e.g. "for this slide").
 */
export function buildBrandConstraints(
  brand: BrandLike | Brand,
  config: Pick<Cfg, "settingOverride" | "selectedAvatarId">,
  options: { tool: string; mentionsAvatar?: boolean; skipPalette?: boolean } = { tool: "image", mentionsAvatar: true }
): string {
  const settingOverride = (config.settingOverride || "").trim();
  const settingClause = settingOverride
    ? ` SETTING OVERRIDE — STRICT: the scene takes place in: ${settingOverride}. IGNORE any setting, location, or environment suggested by the brand description. The brand's usual context does NOT apply to this generation. Only this setting is allowed.`
    : "";

  const hasAvatar = !!(brand.avatars || []).find((a) => a.id === config.selectedAvatarId);
  const shouldLockAvatar = hasAvatar && options.mentionsAvatar !== false;
  const avatarLockClause = shouldLockAvatar
    ? ` AVATAR LOCK — STRICT: the ONLY person in this image is the selected brand avatar. Do NOT introduce any other models, characters, named persons, or roster figures from the brand context. The brand may mention other avatars by name in its description — they are NOT part of this generation.`
    : "";

  // Palette constraint can be skipped (e.g. when using an official brand template
  // where the colors should remain literal — no re-coloring with brand palette).
  let paletteClause = "";
  if (!options.skipPalette) {
    const dna = (brand as BrandLike).dna;
    const paletteHex = (dna?.colors || [])
      .map((c) => c.hex)
      .filter((h): h is string => !!h && /^#[0-9a-f]{3,8}$/i.test(h));
    paletteClause = paletteHex.length > 0
      ? ` PALETTE CONSTRAINT — STRICT: use ONLY these exact colors throughout the image: ${paletteHex.join(", ")}. NO other colors, NO gradients between non-listed colors. Reject any color suggestion from the prompt that isn't in this list.`
      : "";
  }

  return `${settingClause}${avatarLockClause}${paletteClause}`;
}

// ── Brand Context Builder (selective per tool) ─────────────────────
// Different tools need different subsets of the brand info. This helper
// builds the right blob to inject into image-generation prompts.

interface BrandContextBrand {
  business?: { model?: string; description?: string; value_prop?: string; target_market?: string };
  dna?: {
    tone?: string[];
    audience?: string;
    keywords?: string[];
    personality?: string;
    unique_value?: string;
    forbidden_words?: string[];
  };
  designSystem?: {
    photoStyle?: string;
    composition?: string;
    colorTreatment?: string;
    lighting?: string;
    visualDos?: string[];
    visualDonts?: string[];
    references?: string;
    casting?: string;
    preferred_locations?: string[];
    product_presentation?: string;
    motion_rules?: string;
  };
}

export type BrandFieldKey =
  | "business.model" | "business.description" | "business.value_prop" | "business.target_market"
  | "dna.tone" | "dna.audience" | "dna.keywords" | "dna.personality" | "dna.unique_value" | "dna.forbidden_words"
  | "ds.photoStyle" | "ds.composition" | "ds.colorTreatment" | "ds.lighting"
  | "ds.visualDos" | "ds.visualDonts" | "ds.references" | "ds.casting"
  | "ds.preferred_locations" | "ds.product_presentation" | "ds.motion_rules";

/** Select which Brand fields to inject for a given tool. */
export const TOOL_BRAND_FIELDS: Record<string, BrandFieldKey[]> = {
  static_ad: [
    "business.model", "business.value_prop",
    "dna.tone", "dna.forbidden_words",
    "ds.photoStyle", "ds.composition", "ds.colorTreatment", "ds.lighting",
    "ds.visualDos", "ds.visualDonts", "ds.product_presentation",
  ],
  carousel_creator: [
    "business.model", "dna.tone", "dna.forbidden_words",
    "ds.photoStyle", "ds.composition", "ds.colorTreatment", "ds.lighting",
    "ds.visualDos", "ds.visualDonts", "ds.product_presentation",
  ],
  ad_creative_lab: [
    "business.model", "business.value_prop",
    "dna.tone", "dna.forbidden_words",
    "ds.photoStyle", "ds.composition", "ds.colorTreatment", "ds.lighting",
    "ds.visualDos", "ds.visualDonts",
  ],
  product_spotlight: [
    "ds.photoStyle", "ds.composition", "ds.colorTreatment", "ds.lighting",
    "ds.product_presentation", "ds.visualDos", "ds.visualDonts",
  ],
  ugc_creator: [
    "business.model", "business.target_market",
    "dna.tone", "dna.audience", "dna.personality", "dna.forbidden_words",
    "ds.photoStyle", "ds.casting", "ds.lighting", "ds.preferred_locations",
    "ds.visualDos", "ds.visualDonts",
  ],
  video_ad_creator: [
    "business.model", "business.value_prop",
    "dna.tone", "dna.forbidden_words",
    "ds.photoStyle", "ds.composition", "ds.colorTreatment", "ds.lighting",
    "ds.casting", "ds.product_presentation", "ds.motion_rules",
    "ds.visualDos", "ds.visualDonts",
  ],
  product_clip: [
    "ds.photoStyle", "ds.composition", "ds.colorTreatment", "ds.lighting",
    "ds.product_presentation", "ds.motion_rules",
  ],
  fashion_reel: [
    "dna.tone", "dna.forbidden_words",
    "ds.photoStyle", "ds.casting", "ds.lighting", "ds.preferred_locations",
    "ds.motion_rules", "ds.visualDos", "ds.visualDonts",
  ],
  avatar_creator: [
    "ds.casting", "ds.photoStyle", "ds.colorTreatment",
  ],
};

const FIELD_LABEL: Record<BrandFieldKey, string> = {
  "business.model": "Business model",
  "business.description": "Business",
  "business.value_prop": "Value proposition",
  "business.target_market": "Target market",
  "dna.tone": "Brand tone",
  "dna.audience": "Audience",
  "dna.keywords": "Keywords",
  "dna.personality": "Brand personality",
  "dna.unique_value": "Unique value",
  "dna.forbidden_words": "Words the brand NEVER uses",
  "ds.photoStyle": "Photo style",
  "ds.composition": "Composition rules",
  "ds.colorTreatment": "Color treatment",
  "ds.lighting": "Lighting",
  "ds.visualDos": "Always show",
  "ds.visualDonts": "Never show",
  "ds.references": "Visual references",
  "ds.casting": "Model casting",
  "ds.preferred_locations": "Preferred locations",
  "ds.product_presentation": "Product presentation",
  "ds.motion_rules": "Motion rules",
};

function getField(brand: BrandContextBrand, key: BrandFieldKey): string | string[] | undefined {
  const [section, field] = key.split(".") as [string, string];
  const blob = section === "ds" ? brand.designSystem : section === "dna" ? brand.dna : brand.business;
  if (!blob) return undefined;
  return (blob as Record<string, unknown>)[field] as string | string[] | undefined;
}

/**
 * Build a tool-specific brand context block to prepend to image prompts.
 * Returns an empty string if there's nothing relevant.
 */
export function buildBrandContext(brand: BrandContextBrand | undefined, toolId: string): string {
  if (!brand) return "";
  const keys = TOOL_BRAND_FIELDS[toolId] || [];
  const lines: string[] = [];

  for (const key of keys) {
    const v = getField(brand, key);
    if (!v) continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      lines.push(`${FIELD_LABEL[key]}: ${v.join(", ")}`);
    } else if (typeof v === "string" && v.trim()) {
      lines.push(`${FIELD_LABEL[key]}: ${v.trim()}`);
    }
  }

  if (lines.length === 0) return "";
  return `\n\nBRAND CONTEXT (apply throughout):\n${lines.map((l) => `- ${l}`).join("\n")}`;
}

