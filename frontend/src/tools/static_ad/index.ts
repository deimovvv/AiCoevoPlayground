/**
 * Static Ad — Tool Definition
 * ─────────────────────────────
 * Pipeline: prompt → generate_all
 *
 * Creates ready-to-publish static ads with product, copy, logo, and brand colors.
 * Generate_all creates the base image + variations in a single step.
 */

import type { ToolDefinition, StepHandler } from "../types";
import { generateToolPrompt, createImageEdit, pollImageGen, saveGeneration } from "../../lib/api";

// ── Prompt — generates copy + image prompt ──────────────

const handlePrompt: StepHandler = async (ctx) => {
  const { activeBrand, config, tool } = ctx;
  const selectedProduct = (activeBrand.products || []).find((p) => p.id === config.selectedProductId);
  const selectedAvatar = activeBrand.avatars?.find((a) => a.id === config.selectedAvatarId);
  const logo = activeBrand.logo as { imageUrl: string } | undefined;

  const extraVars: Record<string, string> = { language: config.language || "es" };
  if (selectedProduct?.description) extraVars.product_description = selectedProduct.description;
  if (config.objective) extraVars.creative_direction = config.objective;
  if (logo) extraVars.logo_info = "Brand logo is available as a reference image.";

  let userMsg = "Generate a static ad composition. Respond with ONLY a JSON object.";
  if (selectedProduct) userMsg += `\nProduct: ${selectedProduct.name}`;
  if (selectedAvatar) userMsg += `\nModel: ${selectedAvatar.name}`;
  if (config.objective) userMsg += `\nDirection: ${config.objective}`;

  const { result } = await generateToolPrompt(activeBrand.id, "static_ad", userMsg, extraVars);
  let parsed = result as Record<string, unknown>;
  if (typeof result === "string") {
    try { parsed = JSON.parse(result as string); } catch { /* */ }
  }

  return { result: parsed, needsApproval: true };
};

// ── Generate All — base image + variations in one step ──

const handleGenerateAll: StepHandler = async (ctx) => {
  const { activeBrand, config, getStepResult, tool } = ctx;
  const promptResult = getStepResult("prompt") as Record<string, unknown> | undefined;
  if (!promptResult?.image_prompt) throw new Error("No image prompt found.");

  const headline = String(promptResult.headline || "");
  const subline = String(promptResult.subline || "");
  const colors = String(promptResult.colors || "");
  const finalPrompt = `${promptResult.image_prompt}. Text overlay reading "${headline}". Use brand colors: ${colors}. Match the style of the reference image. Place logo in a corner. Professional ad.`;

  const selectedProduct = (activeBrand.products || []).find((p) => p.id === config.selectedProductId);
  const selectedAvatar = activeBrand.avatars?.find((a) => a.id === config.selectedAvatarId);
  const logo = activeBrand.logo as { imageUrl: string } | undefined;

  // Build reference URLs
  const imageUrls: string[] = [];
  const refFiles = (config as { referenceImages?: File[] }).referenceImages || [];
  for (const file of refFiles.slice(0, 1)) {
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    imageUrls.push(dataUrl);
  }
  if (selectedAvatar?.imageUrl) imageUrls.push(selectedAvatar.imageUrl);
  if (selectedProduct?.imageUrl) imageUrls.push(selectedProduct.imageUrl);
  const graphicFiles = (config as { graphicAssets?: File[] }).graphicAssets || [];
  for (const file of graphicFiles) {
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    imageUrls.push(dataUrl);
  }
  if (logo?.imageUrl && graphicFiles.length === 0) imageUrls.push(logo.imageUrl);

  // Generate base image
  const baseJob = await createImageEdit(imageUrls, finalPrompt, config.aspectRatio, config.resolution);
  const baseResult = await pollImageGen(baseJob.request_id);
  if (baseResult.status === "failed") throw new Error(baseResult.error || "Image generation failed");

  const baseUrl = baseResult.image_url || "";

  // Generate variations using base as reference
  const numVariations = config.numVariations || 3;
  const variations = await Promise.all(
    Array.from({ length: numVariations - 1 }, async (_, i) => {
      try {
        const varPrompt = `Same product, same style, same brand colors. Vary the composition and angle slightly. ${finalPrompt}`;
        const job = await createImageEdit([baseUrl, ...imageUrls.slice(1)], varPrompt, config.aspectRatio, config.resolution);
        const result = await pollImageGen(job.request_id);
        return { id: `var_${i + 2}`, url: result.image_url || "", label: `Variation ${i + 2}` };
      } catch {
        return { id: `var_${i + 2}`, url: "", label: `Variation ${i + 2}` };
      }
    })
  );

  const allImages = [
    { id: "original", url: baseUrl, label: "Original" },
    ...variations.filter((v) => v.url),
  ];

  // Save to content
  try {
    await saveGeneration({
      brandId: activeBrand.id,
      toolId: tool.id,
      title: `Static Ad — ${selectedProduct?.name || "Campaign"} — ${new Date().toLocaleDateString()}`,
      type: "image",
      thumbnailUrl: baseUrl,
      scenes: allImages.map((img) => ({ id: img.id, title: img.label, imageUrl: img.url })),
      metadata: { headline, subline, numVariations: allImages.length },
    });
  } catch { /* silent */ }

  return {
    result: { images: allImages, headline, subline, prompt: finalPrompt },
    needsApproval: false,
  };
};

export const staticAd: ToolDefinition = {
  schema: {
    showAvatar: true, avatarLabel: "Person", avatarSublabel: "optional — include talent",
    showProduct: true, productLabel: "Product",
    showClothing: false,
    showBackground: true,
    showVoice: false,
    showTone: false,
    showPlatform: false,
    showLanguage: true,
    showVariations: true,
    objectiveLabel: "Creative Direction",
    objectivePlaceholder: "Describe the ad style. E.g., 'luxury minimal', 'vibrant summer promo'...",
    showNotes: false,
  },
  stepHandlers: {
    prompt: handlePrompt,
    generate_all: handleGenerateAll,
  },
  approvalSteps: ["prompt"],
  autoRunSteps: ["generate_all"],
};
