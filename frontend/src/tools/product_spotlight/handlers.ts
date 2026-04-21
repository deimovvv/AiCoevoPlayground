/**
 * Product Spotlight — Step Handlers
 * ──────────────────────────────────
 * Reusable by fashion_editorial and other image tools.
 */

import type { StepHandler } from "../types";
import { generateToolPrompt, createImageEdit, pollImageGen, saveGeneration } from "../../lib/api";

// ── Prompt (Gemini via PromptBuilder) ────────────────────

export const handlePrompt: StepHandler = async (ctx) => {
  const { activeBrand, config, tool } = ctx;
  const selectedProduct = (activeBrand.products || []).find((p) => p.id === config.selectedProductId);
  const selectedAvatar = activeBrand.avatars?.find((a) => a.id === config.selectedAvatarId);
  const selectedBackground = (activeBrand.backgrounds || []).find((bg) => bg.id === config.selectedBackgroundId);

  const extraVars: Record<string, string> = {};
  if (config.objective) extraVars.video_objective = config.objective;
  if (config.notes) extraVars.user_notes = config.notes;
  if (config.tone) extraVars.tone = config.tone;
  if (config.platform) extraVars.platform = config.platform;
  if (config.language) extraVars.language = config.language;

  const objectiveKey: Record<string, string> = {
    fashion_editorial: "pose_direction",
    product_spotlight: "setting_description",
  };
  const key = objectiveKey[tool.id];
  if (key && config.objective) extraVars[key] = config.objective;

  if (selectedProduct) {
    let str = selectedProduct.name;
    if (selectedProduct.description) str += `: ${selectedProduct.description}`;
    extraVars.selected_accessory = str;
  }
  if (selectedAvatar) {
    let str = selectedAvatar.name;
    if (selectedAvatar.description) str += `: ${selectedAvatar.description}`;
    extraVars.selected_avatar = str;
  }
  if (config.locationRef) extraVars.location_reference = config.locationRef;
  if (config.styleRef) extraVars.style_reference = config.styleRef;

  const selectedClothing = (activeBrand.clothing || []).filter((c) => config.selectedClothingIds.includes(c.id));
  if (selectedClothing.length > 0) {
    extraVars.selected_clothing = selectedClothing.map((c) => `- ${c.name}${c.description ? `: ${c.description}` : ""}`).join("\n");
  }
  if (selectedBackground) {
    let bgStr = selectedBackground.name;
    if (selectedBackground.description) bgStr += `: ${selectedBackground.description}`;
    extraVars.selected_background = bgStr;
  }

  let userMsg = "Generate now.";
  if (selectedProduct) userMsg = `Product: ${selectedProduct.name}`;
  if (config.objective) userMsg += `\n${config.objective}`;
  if (config.notes) userMsg += `\n${config.notes}`;

  const { result } = await generateToolPrompt(activeBrand.id, tool.id, userMsg, extraVars);
  return { result, needsApproval: true };
};

// ── Generate (Nano Banana from prompt result) ────────────

export const handleGenerate: StepHandler = async (ctx) => {
  const { activeBrand, config, getStepResult } = ctx;
  const promptResult = getStepResult("prompt") as { image_prompt: string; title?: string } | undefined;
  if (!promptResult?.image_prompt) throw new Error("No image prompt found.");

  const selectedAvatar = activeBrand.avatars?.find((a) => a.id === config.selectedAvatarId);
  const selectedProduct = (activeBrand.products || []).find((p) => p.id === config.selectedProductId);
  const selectedBackground = (activeBrand.backgrounds || []).find((bg) => bg.id === config.selectedBackgroundId);
  const selectedMoodboard = (activeBrand.moodboards || []).find((m) => m.id === config.selectedMoodboardId);
  const selClothing = (activeBrand.clothing || []).filter((c) => config.selectedClothingIds.includes(c.id));

  const imageUrls: string[] = [];
  if (selectedAvatar?.imageUrl) imageUrls.push(selectedAvatar.imageUrl);
  selClothing.forEach((c) => { if (c.imageUrl) imageUrls.push(c.imageUrl); });
  if (selectedProduct?.imageUrl) imageUrls.push(selectedProduct.imageUrl);
  if (selectedBackground?.imageUrl) imageUrls.push(selectedBackground.imageUrl);
  if (selectedMoodboard?.imageUrl) imageUrls.push(selectedMoodboard.imageUrl);

  let finalPrompt = promptResult.image_prompt;
  if (selectedMoodboard) {
    finalPrompt += ` Visual style moodboard reference: replicate the aesthetic, color palette, and mood of the style reference image.`;
  }

  const job = await createImageEdit(imageUrls, finalPrompt, config.aspectRatio, config.resolution);
  const result = await pollImageGen(job.request_id);
  if (result.status === "failed") throw new Error(result.error || "Image generation failed");

  return {
    result: { url: result.image_url, prompt: finalPrompt, title: promptResult.title || "Generated" },
    needsApproval: true,
  };
};

// ── Variations ───────────────────────────────────────────

export const handleVariations: StepHandler = async (ctx) => {
  const { activeBrand, config, getStepResult, tool } = ctx;
  const genResult = getStepResult("generate") as { url: string; prompt: string } | undefined;
  if (!genResult) throw new Error("No base image found.");

  const selectedProduct = (activeBrand.products || []).find((p) => p.id === config.selectedProductId);
  const selectedAvatar = activeBrand.avatars?.find((a) => a.id === config.selectedAvatarId);

  const referenceUrls = [genResult.url];
  if (selectedAvatar?.imageUrl) referenceUrls.push(selectedAvatar.imageUrl);
  if (selectedProduct?.imageUrl) referenceUrls.push(selectedProduct.imageUrl);

  const variations = await Promise.all(
    Array.from({ length: config.numVariations }, async (_, vi) => {
      const prompt = `Maintain the same subject, style, and quality. Vary the angle, composition, or subtle details. ${genResult.prompt}`;
      const job = await createImageEdit(referenceUrls, prompt, config.aspectRatio, config.resolution);
      const result = await pollImageGen(job.request_id);
      return { id: `var_${vi + 1}`, url: result.image_url || "", label: `Variation ${vi + 1}` };
    })
  );

  const allVariations = [{ id: "original", url: genResult.url, label: "Original" }, ...variations];

  // Save to content library
  try {
    await saveGeneration({
      brandId: activeBrand.id,
      toolId: tool.id,
      title: `${tool.name} — ${selectedProduct?.name || "Photo"} — ${new Date().toLocaleDateString()}`,
      type: "image",
      thumbnailUrl: genResult.url,
      scenes: allVariations.map((v) => ({ id: v.id, title: v.label, imageUrl: v.url })),
      metadata: { numVariations: allVariations.length },
    });
  } catch { /* silent */ }

  return { result: allVariations };
};
