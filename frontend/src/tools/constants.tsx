/**
 * Coevo Studio — Tool Constants
 * ──────────────────────────────
 * Step metadata, tool icons, fallback definitions.
 */

import {
  Type, ImageIcon, Camera, Video, Mic, Film, Sparkles,
  Eye, Scissors, Palette, Wand2, Megaphone, Share2, Eraser,
  ListChecks,
} from "lucide-react";
import type { ToolEntry } from "./types";

// ── Step metadata (label, icon, description) ─────────────

export const STEP_META: Record<
  string,
  { label: string; icon: React.ReactNode; description: string }
> = {
  brief: { label: "Brief", icon: <Sparkles size={15} />, description: "Generate avatar character brief from brand context" },
  save: { label: "Save to Brand", icon: <Camera size={15} />, description: "Save generated avatar to brand library" },
  script: { label: "Script", icon: <Type size={15} />, description: "Generate the script/copy using AI" },
  base_image: { label: "Base Image", icon: <ImageIcon size={15} />, description: "Generate and approve the hero image for scene 1" },
  multishot: { label: "Multishot", icon: <Camera size={15} />, description: "Generate variations for all scenes from approved base" },
  images: { label: "Images", icon: <ImageIcon size={15} />, description: "Generate image variations for each scene" },
  image: { label: "Image", icon: <ImageIcon size={15} />, description: "Generate the visual creative" },
  curation: { label: "Curation", icon: <Eye size={15} />, description: "Select and reorder the best shots for your video" },
  voice: { label: "Voice", icon: <Mic size={15} />, description: "Generate voiceover with text-to-speech" },
  lipsync: { label: "Lip-Sync", icon: <Video size={15} />, description: "Animate the image with lip-sync" },
  subtitles: { label: "Subtitles", icon: <Type size={15} />, description: "Auto-generate subtitles overlay" },
  render: { label: "Render", icon: <Film size={15} />, description: "Combine all elements into final output" },
  prompt: { label: "Prompt", icon: <Wand2 size={15} />, description: "Generate image prompts from brand context" },
  generate: { label: "Generate", icon: <Sparkles size={15} />, description: "Run the AI generation" },
  copy: { label: "Copy", icon: <Type size={15} />, description: "Generate ad copy and headlines" },
  compose: { label: "Compose", icon: <Palette size={15} />, description: "Compose the final ad creative" },
  caption: { label: "Caption", icon: <Type size={15} />, description: "Generate social media caption" },
  scenes: { label: "Scenes", icon: <ListChecks size={15} />, description: "Generate scene descriptions" },
  music: { label: "Music", icon: <Mic size={15} />, description: "Select music mood and track" },
  remove: { label: "Remove BG", icon: <Scissors size={15} />, description: "AI background removal" },
  variations: { label: "Variations", icon: <Camera size={15} />, description: "Generate multiple variations for selection" },
  animate: { label: "Animate", icon: <Video size={15} />, description: "Animate frames with Kling for smooth transitions" },
  visual_guide: { label: "Visual Guide", icon: <Palette size={15} />, description: "Analyze reference images to extract brand visual style" },
  prompts: { label: "Prompts", icon: <Wand2 size={15} />, description: "Generate creative prompts from visual guide + product" },
  generate_batch: { label: "Generate", icon: <Sparkles size={15} />, description: "Generate all ad creatives from prompts" },
  generate_all: { label: "Generate", icon: <Sparkles size={15} />, description: "Generate image + variations" },
  analyze: { label: "Analyze", icon: <Eye size={15} />, description: "Download and analyze video content with AI" },
  adapt: { label: "Adapt", icon: <Wand2 size={15} />, description: "Adapt content for your brand" },
  review: { label: "Review", icon: <Eye size={15} />, description: "Review, edit, and iterate on generated creatives" },
};

// ── Tool category icons ──────────────────────────────────

export const TOOL_ICONS: Record<string, React.ReactNode> = {
  video: <Video size={20} />,
  camera: <Camera size={20} />,
  megaphone: <Megaphone size={20} />,
  share: <Share2 size={20} />,
  film: <Film size={20} />,
  eraser: <Eraser size={20} />,
  sparkles: <Sparkles size={20} />,
};

// ── Fallback tool definitions ────────────────────────────

export const FALLBACK_TOOLS: Record<string, ToolEntry> = {
  ugc_creator: { id: "ugc_creator", name: "UGC Creator", category: "video", description: "Create complete UGC videos.", icon: "video", status: "active", pipeline: ["script", "base_image", "multishot", "voice", "lipsync", "render"] },
  product_spotlight: { id: "product_spotlight", name: "Product Spotlight", category: "images", description: "Professional product photography.", icon: "camera", status: "active", pipeline: ["prompt", "generate", "variations"] },
  fashion_editorial: { id: "fashion_editorial", name: "Fashion Editorial", category: "images", description: "High-end fashion editorial.", icon: "sparkles", status: "active", pipeline: ["prompt", "generate", "variations"] },
  fashion_reel: { id: "fashion_reel", name: "Fashion Reel", category: "video", description: "Visual fashion/lifestyle reels.", icon: "film", status: "active", pipeline: ["script", "base_image", "multishot", "animate", "render"] },
  ad_creative_lab: { id: "ad_creative_lab", name: "Ad Creative Lab", category: "images", description: "Generate brand-consistent ad creatives.", icon: "sparkles", status: "active", pipeline: ["visual_guide", "prompts", "generate_batch"] },
};
