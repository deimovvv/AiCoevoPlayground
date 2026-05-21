/**
 * Coevo Studio — Tool Registry
 * ─────────────────────────────
 * Maps toolId → ToolDefinition.
 * Adding a new tool = create directory + add one line here.
 */

import type { ToolDefinition } from "./types";
import { ugcCreator } from "./ugc_creator";
import { productSpotlight } from "./product_spotlight";
import { adCreativeLab } from "./ad_creative_lab";
import { videoAdCreator } from "./video_ad_creator";
import { staticAd } from "./static_ad";
import { contentAnalyzer } from "./content_analyzer";
import { productClip } from "./product_clip";
import { carouselCreator } from "./carousel_creator";
import { avatarCreator } from "./avatar_creator";
import { fashionReel } from "./fashion_reel";
import { videoSwap } from "./video_swap";

export const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  avatar_creator: avatarCreator,
  fashion_reel: fashionReel,
  video_swap: videoSwap,
  ugc_creator: ugcCreator,
  product_spotlight: productSpotlight,
  ad_creative_lab: adCreativeLab,
  video_ad_creator: videoAdCreator,
  static_ad: staticAd,
  content_analyzer: contentAnalyzer,
  product_clip: productClip,
  carousel_creator: carouselCreator,
};
