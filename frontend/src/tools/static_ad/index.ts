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

  // If a template is selected, fetch it and include in the prompt
  const templateId = config.adTemplate;
  let templatePrompt = "";
  if (templateId) {
    try {
      const res = await fetch("http://localhost:8000/api/tools/static-ad/templates");
      const data = await res.json();
      const template = (data.templates || []).find((t: { id: string }) => t.id === templateId);
      if (template) {
        let tPrompt = template.prompt || "";
        if (tPrompt) {
          // Pre-fill obvious placeholders with actual brand/product data
          const brandName = activeBrand.name || "";
          const productName = selectedProduct?.name || "";
          const productDesc = selectedProduct?.description || "";
          tPrompt = tPrompt
            .replace(/\[YOUR PRODUCT[^\]]*\]/gi, productName || "[YOUR PRODUCT]")
            .replace(/\[BRAND\]/gi, brandName)
            .replace(/\[PRODUCT\]/gi, productName || "[PRODUCT]")
            .replace(/\[PERSON[^\]]*\]/gi, selectedAvatar?.name || selectedAvatar?.description || "[PERSON]");
          templatePrompt = `\n\nUSE THIS EXACT AD TEMPLATE COMPOSITION:\n${tPrompt}`;
        } else {
          templatePrompt = `\n\nUSE THIS SPECIFIC AD TEMPLATE:\nTemplate: ${template.name}\nFormat: ${template.aspect_ratio}\nDescription: ${template.description}\nGenerate an ad following this exact format and style.`;
        }
        // Override aspect ratio from template
        if (template.aspect_ratio) extraVars.template_aspect_ratio = template.aspect_ratio;
      }
    } catch { /* silent */ }
  }

  let userMsg = `Generate a static ad composition.${templatePrompt} Respond with ONLY a JSON object.`;
  if (selectedProduct) userMsg += `\nProduct: ${selectedProduct.name}`;
  if (selectedAvatar) userMsg += `\nModel: ${selectedAvatar.name}`;
  if (config.objective) userMsg += `\nDirection: ${config.objective}`;

  const { result } = await generateToolPrompt(activeBrand.id, "static_ad", userMsg, extraVars);
  let parsed = result as Record<string, unknown>;
  if (typeof result === "string") {
    try { parsed = JSON.parse(result as string); } catch { /* */ }
  }
  // Unwrap if Gemini wraps in a single-key object (e.g. {"ad_composition": {...}})
  const pKeys = Object.keys(parsed);
  if (pKeys.length === 1 && typeof parsed[pKeys[0]] === "object" && parsed[pKeys[0]] !== null && !Array.isArray(parsed[pKeys[0]])) {
    parsed = parsed[pKeys[0]] as Record<string, unknown>;
  }

  return { result: parsed, needsApproval: true };
};

// ── Generate All — base image + variations in one step ──

const handleGenerateAll: StepHandler = async (ctx) => {
  const { activeBrand, config, getStepResult, tool } = ctx;
  let promptResult = getStepResult("prompt") as Record<string, unknown> | undefined;
  // Unwrap if still wrapped (e.g. {"ad_composition": {...}})
  if (promptResult) {
    const pk = Object.keys(promptResult);
    if (pk.length === 1 && typeof promptResult[pk[0]] === "object" && promptResult[pk[0]] !== null && !Array.isArray(promptResult[pk[0]])) {
      promptResult = promptResult[pk[0]] as Record<string, unknown>;
    }
  }
  if (!promptResult?.image_prompt) throw new Error("No image prompt found.");

  const headline = String(promptResult.headline || "");
  const subline = String(promptResult.subline || "");
  const colors = String(promptResult.colors || "");
  const brandName = activeBrand.name || "";
  const finalPrompt = `${promptResult.image_prompt}. Text overlay reading "${headline}". Use brand colors: ${colors}. Match the style of the reference image. Place logo in a corner. Professional ad for ${brandName}. IMPORTANT: Only include elements from the brand — reproduce the product EXACTLY as it appears in the reference photo. Do NOT add objects, props, text, or decorations that are not part of the brand.`;

  const selectedProduct = (activeBrand.products || []).find((p) => p.id === config.selectedProductId);
  const selectedAvatar = activeBrand.avatars?.find((a) => a.id === config.selectedAvatarId);
  const selectedBackground = (activeBrand.backgrounds || []).find((bg) => bg.id === config.selectedBackgroundId);
  const logo = activeBrand.logo as { imageUrl: string } | undefined;

  // Build reference URLs + positional descriptions so Nano Banana knows what each image is
  const imageUrls: string[] = [];
  const refDescriptions: string[] = [];
  let imgIdx = 1;

  // Style reference (uploaded file)
  const refFiles = (config as { referenceImages?: File[] }).referenceImages || [];
  for (const file of refFiles.slice(0, 1)) {
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    imageUrls.push(dataUrl);
    refDescriptions.push(`Image ${imgIdx}: STYLE REFERENCE — match this mood, color grading, and composition`);
    imgIdx++;
  }

  // Avatar / model
  if (selectedAvatar?.imageUrl) {
    imageUrls.push(selectedAvatar.imageUrl);
    refDescriptions.push(`Image ${imgIdx}: MODEL "${selectedAvatar.name}" — use this EXACT person if the ad includes a person`);
    imgIdx++;
  }

  // Product
  if (selectedProduct?.imageUrl) {
    imageUrls.push(selectedProduct.imageUrl);
    refDescriptions.push(`Image ${imgIdx}: PRODUCT "${selectedProduct.name}"${selectedProduct.description ? ` (${selectedProduct.description})` : ""} — reproduce this EXACT product, same shape, colors, labels, packaging`);
    imgIdx++;
  }
  // Extra product images
  if (selectedProduct?.images) {
    for (const img of selectedProduct.images) {
      if (img.imageUrl) {
        imageUrls.push(img.imageUrl);
        refDescriptions.push(`Image ${imgIdx}: additional view of "${selectedProduct.name}"`);
        imgIdx++;
      }
    }
  }

  // Background
  if (selectedBackground?.imageUrl) {
    imageUrls.push(selectedBackground.imageUrl);
    const bgDesc = selectedBackground.description || selectedBackground.name || "background";
    refDescriptions.push(`Image ${imgIdx}: BACKGROUND/SETTING — use this as the ad background (${bgDesc})`);
    imgIdx++;
  }

  // Graphic assets (uploaded files)
  const graphicFiles = (config as { graphicAssets?: File[] }).graphicAssets || [];
  for (const file of graphicFiles) {
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    imageUrls.push(dataUrl);
    refDescriptions.push(`Image ${imgIdx}: GRAPHIC ASSET — incorporate this element into the ad`);
    imgIdx++;
  }

  // Logo
  if (logo?.imageUrl && graphicFiles.length === 0) {
    imageUrls.push(logo.imageUrl);
    refDescriptions.push(`Image ${imgIdx}: BRAND LOGO — place in a corner of the ad`);
    imgIdx++;
  }

  // Prepend reference descriptions to the prompt so Nano Banana knows what each image is
  const promptWithRefs = refDescriptions.length > 0
    ? `REFERENCE IMAGES:\n${refDescriptions.join("\n")}\n\n${finalPrompt}`
    : finalPrompt;

  // Generate base image
  const baseJob = await createImageEdit(imageUrls, promptWithRefs, config.aspectRatio, config.resolution);
  const baseResult = await pollImageGen(baseJob.request_id);
  if (baseResult.status === "failed") throw new Error(baseResult.error || "Image generation failed");

  const baseUrl = baseResult.image_url || "";

  // Generate variations using base as reference
  const numVariations = config.numVariations || 3;
  const variations = await Promise.all(
    Array.from({ length: numVariations - 1 }, async (_, i) => {
      try {
        const varPrompt = `Image 1: the BASE AD — keep the same product, style, brand colors, brand identity. Only vary the composition and angle slightly. Do NOT add new elements.\n${refDescriptions.slice(1).map((d, ri) => d.replace(/^Image \d+/, `Image ${ri + 2}`)).join("\n")}\n\n${finalPrompt}`;
        const job = await createImageEdit([baseUrl, ...imageUrls.slice(refFiles.length > 0 ? 1 : 0)], varPrompt, config.aspectRatio, config.resolution);
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
    showAvatar: true, avatarLabel: "Person",
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
