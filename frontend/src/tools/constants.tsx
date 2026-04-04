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
  ugc_creator: { id: "ugc_creator", name: "UGC Creator", category: "video", description: "Create complete UGC videos.", icon: "video", status: "active", pipeline: ["script", "base_image", "multishot", "curation", "voice", "lipsync", "render"] },
  product_spotlight: { id: "product_spotlight", name: "Product Spotlight", category: "images", description: "Professional product photography.", icon: "camera", status: "active", pipeline: ["prompt", "generate", "variations"] },
  fashion_editorial: { id: "fashion_editorial", name: "Fashion Editorial", category: "images", description: "High-end fashion editorial.", icon: "sparkles", status: "active", pipeline: ["prompt", "generate", "variations"] },
  fashion_reels: { id: "fashion_reels", name: "Fashion Reels", category: "video", description: "Outfit-transition reels.", icon: "film", status: "active", pipeline: ["script", "base_image", "multishot", "curation", "animate"] },
  ad_creative_lab: { id: "ad_creative_lab", name: "Ad Creative Lab", category: "images", description: "Generate brand-consistent ad creatives.", icon: "sparkles", status: "active", pipeline: ["visual_guide", "prompts", "generate_batch"] },
  photo_multishot: { id: "photo_multishot", name: "Product Photos", category: "images", description: "Product photo variations.", icon: "camera", status: "active", pipeline: ["prompt", "generate"] },
  ad_creative: { id: "ad_creative", name: "Ad Creative", category: "images", description: "Ad creatives with copy.", icon: "megaphone", status: "active", pipeline: ["prompt", "generate"] },
  social_post: { id: "social_post", name: "Social Post", category: "copy", description: "Social media posts.", icon: "share", status: "active", pipeline: ["caption", "image"] },
};
