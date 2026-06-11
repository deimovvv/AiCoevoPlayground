/**
 * Avatar Creator — Step Handlers
 * ────────────────────────────────
 * brief    → Gemini generates character description from brand context
 * generate → Nano Banana generates composite reference sheet (body + face angles)
 * save     → Downloads image + uploads as brand avatar
 */

import type { StepHandler } from "../types";
import { createTextToImage, createImageEdit, pollImageGen, uploadAvatar, replaceAvatarImage, avatarImageUrl, moodboardImageUrl } from "../../lib/api";

const API_BASE = "http://127.0.0.1:8000";

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

  // Poses mode: skip brief generation. Use the existing avatar's info as the "brief"
  if (config.avatarToolMode === "poses") {
    const source = activeBrand.avatars?.find((a) => a.id === config.selectedAvatarId);
    if (!source) throw new Error("Seleccioná un avatar del Brand Kit para generar su pose sheet.");
    const brief: AvatarBrief = {
      name: source.name || "Avatar",
      age: "",
      gender: "",
      ethnicity: "",
      physical: source.description || "",
      style: "",
      personality: "",
      mood: "",
      image_prompt: `The EXACT same person as the reference avatar — keep identical facial features, skin tone, hair, age, and body proportions. ${source.description ? `Description: ${source.description}.` : ""}`,
      avatarStyle: ((config as unknown as Record<string, unknown>).avatarStyle as AvatarStyleId) || "realistic",
    };
    return { result: brief, needsApproval: true };
  }

  // Enrich the direction sent to Gemini with moodboard description (if picked) so
  // the brief is visually informed even before the image-gen step.
  let direction = (config.objective || "").trim();
  const selectedMoodboard = (activeBrand.moodboards || []).find((m) => m.id === config.selectedMoodboardId);
  if (selectedMoodboard?.description) {
    direction += `${direction ? "\n\n" : ""}Visual style moodboard: ${selectedMoodboard.description}`;
  }
  const refFiles = ((config as unknown as Record<string, unknown>).referenceImages as File[]) || [];
  if (refFiles.length > 0) {
    direction += `${direction ? "\n\n" : ""}User-supplied reference images: ${refFiles.length} attached (used in the image-gen step).`;
  }

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
  brief.avatarStyle = ((config as unknown as Record<string, unknown>).avatarStyle as AvatarStyleId) || "realistic";

  return { result: brief, needsApproval: true };
};

// ── Generate ─────────────────────────────────────────────────

export const handleGenerate: StepHandler = async (ctx) => {
  const { activeBrand, config, getStepResult } = ctx;

  const brief = getStepResult("brief") as AvatarBrief | undefined;
  if (!brief) throw new Error("No avatar brief found. Complete the Brief step first.");

  // "inherit" is a special value: user wants the new avatar to copy the aesthetic
  // of the reference (existing avatar in poses mode, or first user-uploaded image).
  // When inherit is selected we skip the hardcoded style prompt and instead tell
  // the model to match the reference's photographic look exactly.
  const rawStyle = brief.avatarStyle || ((config as unknown as Record<string, unknown>).avatarStyle as string) || (config.avatarToolMode === "poses" ? "inherit" : "realistic");
  const inheritStyle = rawStyle === "inherit";
  const styleConfig = inheritStyle
    ? { id: "inherit" as const, label: "Heredado del referente", stylePrompt: "" }
    : (AVATAR_STYLES.find((s) => s.id === rawStyle) || AVATAR_STYLES[0]);

  // Build composite reference sheet prompt
  const characterDesc = brief.image_prompt || [
    `${brief.gender}, ${brief.age} years old, ${brief.ethnicity}`,
    brief.physical,
    `wearing ${brief.style}`,
    `expression: ${brief.mood}`,
  ].filter(Boolean).join(". ");

  // Style line: when inheriting, do NOT inject a stylePrompt — instead instruct
  // the model to match the reference image's aesthetic exactly (medium, grain,
  // color treatment, lighting style). When a specific style is chosen, use its
  // stylePrompt to override the reference's look.
  const styleLine = inheritStyle
    ? `Style: match the EXACT photographic / visual style of the reference image — same medium (photo / 3D / illustration / anime — whatever the reference is), same grain, same color treatment, same lighting language, same overall aesthetic. Do NOT impose a different style. The reference defines the look.`
    : `Style: ${styleConfig.stylePrompt}.`;

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
    styleLine,
    `Pure white (#FFFFFF) seamless background. Studio lighting, clean and professional.`,
    `All views show the EXACT same person with consistent features.`,
    `Hands are empty — no objects, no props, no products, no bags, no phones, nothing held in hands.`,
    // Clothing safeguard — sin esta línea Nano Banana suele sacar modelos en ropa interior
    // o con muy poca ropa, especialmente en modo poses cuando el brief no especifica outfit.
    // Forzamos prendas básicas neutras a menos que el brief.style mande otra cosa.
    `The person is FULLY CLOTHED in neutral everyday clothing — basic plain t-shirt or top + neutral pants or jeans, consistent across all views. NEVER in underwear, NEVER nude, NEVER in lingerie or swimwear (unless explicitly requested in the character description above).`,
    `No text, no labels, no borders, no grid lines.`,
  ].join(" ");

  // Collect optional references — moodboard (Brand Kit) + user-uploaded files.
  const cfg = config as unknown as Record<string, unknown>;
  const selectedMoodboard = (activeBrand.moodboards || []).find((m) => m.id === config.selectedMoodboardId);
  const refFiles = (cfg.referenceImages as File[]) || [];

  const refUrls: string[] = [];
  const refDescriptions: string[] = [];
  let imgIdx = 1;

  // Poses mode: the source avatar is always Image 1 (identity anchor).
  // Create mode: no avatar anchor — refs are pure style/inspiration.
  if (config.avatarToolMode === "poses") {
    const source = activeBrand.avatars?.find((a) => a.id === config.selectedAvatarId);
    if (!source?.imageUrl) throw new Error("El avatar seleccionado no tiene imagen.");
    const url = source.imageUrl.startsWith("http") ? source.imageUrl : avatarImageUrl(source.imageUrl);
    refUrls.push(url);
    refDescriptions.push(`Image ${imgIdx}: reference photo of "${source.name}" — reproduce the SAME person (same face, same skin tone, same hair, same age, same body proportions).`);
    imgIdx++;
  }

  // User-uploaded reference images.
  // In `create` mode (no source avatar yet), the FIRST user ref is treated as
  // the identity anchor — Nano Banana must clone the face/features. Extra refs
  // are secondary identity reinforcement (different angles or lookalikes).
  // In `poses` mode the source avatar already anchors identity, so user refs
  // are extra visual guidance (clothing/pose vibe).
  const inPosesMode = config.avatarToolMode === "poses";
  const userRefFirst = !inPosesMode;
  for (let i = 0; i < Math.min(refFiles.length, 4); i++) {
    const file = refFiles[i];
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Read failed"));
      reader.readAsDataURL(file);
    });
    refUrls.push(dataUrl);

    let desc: string;
    if (userRefFirst && i === 0) {
      // Strong identity anchor — this is what fixes "match exactly the reference"
      desc = `Image ${imgIdx}: PRIMARY IDENTITY REFERENCE — the avatar MUST look exactly like the person in this photo. Match the face, facial features (eyes, nose, mouth, jaw), skin tone, hair color and style, age, and body proportions PRECISELY. Do not invent a different person. The output must be recognizable as the same individual.`;
    } else if (userRefFirst) {
      desc = `Image ${imgIdx}: additional identity reference (same person as Image 1, different angle/expression) — reinforce the match.`;
    } else {
      desc = `Image ${imgIdx}: user-supplied reference — use as visual guide for facial features, vibe, clothing or pose direction.`;
    }
    refDescriptions.push(desc);
    imgIdx++;
  }

  // Moodboard for aesthetic / color palette / mood (NOT identity)
  if (selectedMoodboard?.imageUrl) {
    const url = selectedMoodboard.imageUrl.startsWith("http") ? selectedMoodboard.imageUrl : moodboardImageUrl(selectedMoodboard.imageUrl);
    refUrls.push(url);
    refDescriptions.push(`Image ${imgIdx}: visual style moodboard — replicate the aesthetic, color palette, lighting, and mood. NOT the people in it — just the overall visual feel.`);
    imgIdx++;
  }

  // Build the final prompt with reference images block (when present).
  // When there's an identity anchor (poses source OR a user-supplied first ref in create mode),
  // prepend a hard instruction so Nano Banana doesn't drift to a generic person.
  const hasIdentityAnchor = inPosesMode || (userRefFirst && refFiles.length > 0);
  const identityClause = hasIdentityAnchor
    ? `\n\nCRITICAL IDENTITY CONSTRAINT: The person in ALL views of the reference sheet must be the SAME individual as Image 1 — same face, same features, same age, same skin tone, same hair, same body proportions. Do NOT generate a different or generic person. The textual character description below is secondary to the visual identity reference.\n`
    : "";
  const finalPrompt = refDescriptions.length > 0
    ? `REFERENCE IMAGES:\n${refDescriptions.join("\n")}${identityClause}\n${compositePrompt}`
    : compositePrompt;

  // If we have any refs (poses, uploaded, or moodboard) → image edit. Else text-to-image.
  const job = refUrls.length > 0
    ? await createImageEdit(refUrls, finalPrompt, "1:1", "2K")
    : await createTextToImage(finalPrompt, "1:1", "2K");
  const result = await pollImageGen(job.request_id);

  if (result.status === "failed") throw new Error(result.error || "Image generation failed");

  return {
    result: {
      url: result.image_url,
      brief,
      styleId: rawStyle,
      styleLabel: styleConfig.label,
      prompt: compositePrompt,
      mode: config.avatarToolMode || "create",
      sourceAvatarId: config.avatarToolMode === "poses" ? config.selectedAvatarId : undefined,
    },
    needsApproval: true,
  };
};

// ── Save ─────────────────────────────────────────────────────

export const handleSave: StepHandler = async (ctx) => {
  const { activeBrand, config, getStepResult } = ctx;

  const generateResult = getStepResult("generate") as {
    url: string;
    brief: AvatarBrief;
    styleLabel: string;
    mode?: "create" | "poses";
    sourceAvatarId?: string;
  } | undefined;
  if (!generateResult?.url) throw new Error("No generated image found.");

  // Fetch the image once — used in both branches
  const imageRes = await fetch(generateResult.url);
  if (!imageRes.ok) throw new Error("Failed to fetch generated image for saving.");
  const imageBlob = await imageRes.blob();

  // Poses mode + replace: overwrite the source avatar's image, keep its id
  if (generateResult.mode === "poses" && config.avatarPosesSave === "replace" && generateResult.sourceAvatarId) {
    const imageFile = new File([imageBlob], `avatar_pose_sheet.png`, { type: imageBlob.type || "image/png" });
    const updated = await replaceAvatarImage(activeBrand.id, generateResult.sourceAvatarId, imageFile);
    return {
      result: {
        avatar: updated,
        imageUrl: generateResult.url,
        name: updated.name as string || "Avatar",
        brief: generateResult.brief,
        replaced: true,
      },
    };
  }

  // Otherwise save as a new avatar (create flow, or poses flow with "save as new")
  const brief = generateResult.brief;
  const styleSuffix = generateResult.mode === "poses" ? "Pose Sheet" : (generateResult.styleLabel || "AI");
  const avatarName = `${brief.name || "Avatar"} (${styleSuffix})`;
  const imageFile = new File([imageBlob], `${avatarName.toLowerCase().replace(/\s+/g, "_")}.png`, {
    type: imageBlob.type || "image/png",
  });

  const description = [
    brief.age ? `${brief.gender}, ${brief.age}` : brief.gender,
    brief.ethnicity,
    brief.physical,
    brief.style && `Style: ${brief.style}`,
    brief.personality && `Personality: ${brief.personality}`,
  ].filter(Boolean).join(". ");

  const savedAvatar = await uploadAvatar(
    activeBrand.id,
    avatarName,
    imageFile,
    true,
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
