/**
 * Avatar Creator — Step Handlers
 * ────────────────────────────────
 * brief    → Gemini generates character description from brand context
 * generate → Nano Banana generates composite reference sheet (body + face angles)
 * save     → Downloads image + uploads as brand avatar
 */

import type { StepHandler } from "../types";
import { createTextToImage, pollImageGen, uploadAvatar } from "../../lib/api";

const API_BASE = "http://localhost:8000";

// ── Avatar style configs ─────────────────────────────────────

export const AVATAR_STYLES = [
  {
    id: "realistic",
    label: "Realistic",
    desc: "Looks like a real person — photorealistic photography",
    stylePrompt: "photorealistic, professional photography, natural skin texture, real person",
  },
  {
    id: "editorial",
    label: "Editorial",
    desc: "Stylized but photorealistic — high-fashion look",
    stylePrompt: "fashion editorial photography, high-end styled, editorial aesthetic, premium",
  },
  {
    id: "3d",
    label: "3D Render",
    desc: "CGI character — Pixar/game style",
    stylePrompt: "3D render, CGI character, smooth surfaces, stylized 3D, cinematic render",
  },
  {
    id: "illustrated",
    label: "Illustrated",
    desc: "2D illustration — editorial and clean",
    stylePrompt: "2D illustration, editorial illustration, clean lines, graphic style, flat colors",
  },
  {
    id: "anime",
    label: "Anime",
    desc: "Japanese animation style",
    stylePrompt: "anime art style, manga aesthetic, Japanese animation, cel-shaded",
  },
  {
    id: "cinematic",
    label: "Cinematic",
    desc: "Film-quality dramatic photography",
    stylePrompt: "cinematic photography, dramatic lighting, film grain, movie still",
  },
] as const;

export type AvatarStyleId = typeof AVATAR_STYLES[number]["id"];

export interface AvatarBrief {
  name: string;
  age: string;
  gender: string;
  ethnicity: string;
  physical: string;
  style: string;
  personality: string;
  mood: string;
  image_prompt: string;
  avatarStyle?: AvatarStyleId;
}

// ── Brief ────────────────────────────────────────────────────

export const handleBrief: StepHandler = async (ctx) => {
  const { activeBrand, config } = ctx;
  const direction = config.objective || "";

  const res = await fetch(`${API_BASE}/api/brands/${activeBrand.id}/avatar-brief`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ direction }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || "Failed to generate avatar brief");
  }

  const brief: AvatarBrief = await res.json();
  // Attach the selected style (default: realistic)
  brief.avatarStyle = ((config as Record<string, unknown>).avatarStyle as AvatarStyleId) || "realistic";

  return { result: brief, needsApproval: true };
};

// ── Generate ─────────────────────────────────────────────────

export const handleGenerate: StepHandler = async (ctx) => {
  const { config, getStepResult } = ctx;

  const brief = getStepResult("brief") as AvatarBrief | undefined;
  if (!brief) throw new Error("No avatar brief found. Complete the Brief step first.");

  const styleId = brief.avatarStyle || ((config as Record<string, unknown>).avatarStyle as AvatarStyleId) || "realistic";
  const styleConfig = AVATAR_STYLES.find((s) => s.id === styleId) || AVATAR_STYLES[0];

  // Build composite reference sheet prompt
  const characterDesc = brief.image_prompt || [
    `${brief.gender}, ${brief.age} years old, ${brief.ethnicity}`,
    brief.physical,
    `wearing ${brief.style}`,
    `expression: ${brief.mood}`,
  ].filter(Boolean).join(". ");

  const compositePrompt = [
    `Character reference sheet on pure white background.`,
    `Single seamless image with multiple views of the same person:`,
    `full body front view (center, standing, natural pose),`,
    `face close-up portrait (left side),`,
    `three-quarter face angle (right side),`,
    `side profile view (far right).`,
    ``,
    `Character: ${characterDesc}.`,
    ``,
    `Style: ${styleConfig.stylePrompt}.`,
    `Pure white (#FFFFFF) seamless background. Studio lighting, clean and professional.`,
    `All views show the EXACT same person with consistent features.`,
    `Hands are empty — no objects, no props, no products, no bags, no phones, nothing held in hands.`,
    `No text, no labels, no borders, no grid lines.`,
  ].join(" ");

  const job = await createTextToImage(compositePrompt, "1:1", "2K");
  const result = await pollImageGen(job.request_id);

  if (result.status === "failed") throw new Error(result.error || "Image generation failed");

  return {
    result: {
      url: result.image_url,
      brief,
      styleId,
      styleLabel: styleConfig.label,
      prompt: compositePrompt,
    },
    needsApproval: true,
  };
};

// ── Save ─────────────────────────────────────────────────────

export const handleSave: StepHandler = async (ctx) => {
  const { activeBrand, getStepResult } = ctx;

  const generateResult = getStepResult("generate") as { url: string; brief: AvatarBrief; styleLabel: string } | undefined;
  if (!generateResult?.url) throw new Error("No generated image found.");

  const brief = generateResult.brief;
  const avatarName = `${brief.name || "Avatar"} (${generateResult.styleLabel || "AI"})`;

  // Fetch the image and convert to File for upload
  const imageRes = await fetch(generateResult.url);
  if (!imageRes.ok) throw new Error("Failed to fetch generated image for saving.");

  const imageBlob = await imageRes.blob();
  const imageFile = new File([imageBlob], `${avatarName.toLowerCase().replace(/\s+/g, "_")}.png`, {
    type: imageBlob.type || "image/png",
  });

  const description = [
    brief.age ? `${brief.gender}, ${brief.age}` : brief.gender,
    brief.ethnicity,
    brief.physical,
    `Style: ${brief.style}`,
    `Personality: ${brief.personality}`,
  ].filter(Boolean).join(". ");

  const savedAvatar = await uploadAvatar(
    activeBrand.id,
    avatarName,
    imageFile,
    true, // upload to HeyGen for lipsync
    description,
  );

  return {
    result: {
      avatar: savedAvatar,
      imageUrl: generateResult.url,
      name: avatarName,
      brief,
    },
  };
};
