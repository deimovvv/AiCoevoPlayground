/**
 * Coevo Studio — Tool Registry
 * ─────────────────────────────
 * Maps toolId → ToolDefinition.
 * Adding a new tool = create directory + add one line here.
 */

import type { ToolDefinition } from "./types";
import { ugcCreator } from "./ugc_creator";
import { productSpotlight } from "./product_spotlight";
import { fashionEditorial } from "./fashion_editorial";
import { fashionReels } from "./fashion_reels";
import { adCreativeLab } from "./ad_creative_lab";

export const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  ugc_creator: ugcCreator,
  product_spotlight: productSpotlight,
  fashion_editorial: fashionEditorial,
  fashion_reels: fashionReels,
  ad_creative_lab: adCreativeLab,

  // Tools that reuse product_spotlight handlers with different schemas
  photo_multishot: productSpotlight,
  ad_creative: {
    ...productSpotlight,
    schema: {
      ...productSpotlight.schema,
      showAvatar: true, avatarLabel: "Avatar", avatarSublabel: "optional — include talent",
      showTone: true, showPlatform: true, showVariations: true,
      objectiveLabel: "Campaign Brief",
      objectivePlaceholder: "Describe the campaign objective...",
      showNotes: true,
    },
  },
  social_post: {
    ...productSpotlight,
    schema: {
      ...productSpotlight.schema,
      showAvatar: true, avatarLabel: "Avatar", avatarSublabel: "optional",
      showTone: true, showPlatform: true, showLanguage: true, showVariations: false,
      objectiveLabel: "Post Brief",
      objectivePlaceholder: "What do you want to communicate?...",
    },
  },
};
