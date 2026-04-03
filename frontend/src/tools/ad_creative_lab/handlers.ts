/**
 * Ad Creative Lab — Step Handlers
 * ────────────────────────────────
 * Pipeline: visual_guide → prompts → generate_batch → review
 */

import type { StepHandler } from "../types";
import {
  generateToolPrompt, createImageEdit, pollImageGen, saveGeneration,
} from "../../lib/api";

const API_BASE = "http://localhost:8000";

// ── Visual Guide — analyze references with Gemini Vision ──

export const handleVisualGuide: StepHandler = async (ctx) => {
  const { activeBrand, config } = ctx;
  const brandContext = activeBrand.brandContext || "";

  // Use uploaded reference images from the form
  const refFiles = (config as { referenceImages?: File[] }).referenceImages || [];

  // Fallback to brand assets if no references uploaded
  const imageBlobs: Array<{ blob: Blob; name: string }> = [];

  if (refFiles.length > 0) {
    for (const file of refFiles) {
      imageBlobs.push({ blob: file, name: file.name });
    }
  } else {
    // Collect brand images as fallback references
    const imageUrls: string[] = [];
    for (const avatar of activeBrand.avatars || []) {
      if (avatar.imageUrl) imageUrls.push(avatar.imageUrl);
    }
    for (const product of activeBrand.products || []) {
      if (product.imageUrl) imageUrls.push(product.imageUrl);
    }
    for (const clothing of activeBrand.clothing || []) {
      if (clothing.imageUrl) imageUrls.push(clothing.imageUrl);
    }

    for (const url of imageUrls.slice(0, 8)) {
      try {
        const fullUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;
        const resp = await fetch(fullUrl);
        if (resp.ok) {
          const blob = await resp.blob();
          imageBlobs.push({ blob, name: url.split("/").pop() || "image.jpg" });
        }
      } catch { /* skip */ }
    }
  }

  if (imageBlobs.length === 0) {
    throw new Error("Upload reference images in the form, or add assets to Brand Kit first.");
  }

  const uploadFormData = new FormData();
  uploadFormData.append("brand_context", brandContext);
  for (const img of imageBlobs) {
    uploadFormData.append("images", img.blob, img.name);
  }

  const res = await fetch(`${API_BASE}/api/analyze/visual-guide`, {
    method: "POST",
    body: uploadFormData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || "Visual guide generation failed");
  }

  const data = await res.json();

  return {
    result: {
      visualGuide: data.visual_guide,
      numReferences: imageBlobs.length,
      // Store reference preview URLs for the review step
      referenceUrls: refFiles.length > 0
        ? refFiles.map((f) => URL.createObjectURL(f))
        : imageBlobs.map((b) => URL.createObjectURL(b.blob)),
      referenceBlobs: imageBlobs.map((b) => b.blob),
    },
    needsApproval: true,
  };
};

// ── Prompts — generate N creative prompts ─────────────────

export const handlePrompts: StepHandler = async (ctx) => {
  const { activeBrand, config, getStepResult, tool } = ctx;

  const visualGuideData = getStepResult("visual_guide") as { visualGuide: string } | undefined;
  if (!visualGuideData?.visualGuide) throw new Error("No visual guide found. Run the Visual Guide step first.");

  const selectedProduct = (activeBrand.products || []).find((p) => p.id === config.selectedProductId);

  const numPrompts = config.numVariations || 6;

  const selectedAvatar = activeBrand.avatars?.find((a) => a.id === config.selectedAvatarId);
  const selectedBackground = (activeBrand.backgrounds || []).find((bg) => bg.id === config.selectedBackgroundId);
  const selectedClothing = (activeBrand.clothing || []).filter((c) => config.selectedClothingIds.includes(c.id));

  const extraVars: Record<string, string> = {
    visual_guide: visualGuideData.visualGuide,
    num_prompts: String(numPrompts),
  };

  if (selectedProduct?.description) {
    extraVars.product_description = selectedProduct.description;
  }
  if (config.objective) {
    extraVars.creative_direction = config.objective;
  }
  if (config.notes) {
    extraVars.user_notes = config.notes;
  }
  if (selectedBackground) {
    extraVars.selected_background = `${selectedBackground.name}${selectedBackground.description ? `: ${selectedBackground.description}` : ""}`;
  }
  if (selectedClothing.length > 0) {
    extraVars.selected_clothing = selectedClothing.map((c) => `- ${c.name}${c.description ? `: ${c.description}` : ""}`).join("\n");
  }

  // Determine campaign type
  const isFashion = !!selectedAvatar;
  const hasClothingOnly = !selectedProduct && selectedClothing.length > 0;
  const allowFaces = (config as { allowFaces?: boolean }).allowFaces !== false;

  let campaignType = "product";
  if (isFashion && selectedClothing.length > 0) campaignType = "fashion";
  else if (isFashion) campaignType = "lifestyle";
  else if (hasClothingOnly) campaignType = "fashion";

  let userMsg = `Generate ${numPrompts} diverse ${campaignType} creative prompts.`;

  if (!allowFaces) {
    userMsg += "\nIMPORTANT: Do NOT include any human faces, people, or body parts in the prompts. Product/garment only — no models, no hands, no silhouettes.";
  }

  if (selectedProduct) userMsg += `\nProduct: ${selectedProduct.name}${selectedProduct.description ? ` — ${selectedProduct.description}` : ""}`;

  if (selectedAvatar) userMsg += `\nModel: ${selectedAvatar.name}${selectedAvatar.description ? ` — ${selectedAvatar.description}` : ""}`;

  if (selectedClothing.length > 0) {
    userMsg += `\nGarments the model wears: ${selectedClothing.map((c) => `${c.name}${c.description ? ` (${c.description})` : ""}`).join(", ")}`;
    if (!selectedProduct) {
      userMsg += "\nThe garments ARE the product being promoted. The model wears them and the campaign is about these clothes.";
    }
  }

  if (config.objective) userMsg += `\nCreative direction: ${config.objective}`;

  const { result } = await generateToolPrompt(activeBrand.id, "ad_creative_lab", userMsg, extraVars);

  // Parse: result should be an array of { prompt, style, angle }
  let prompts: Array<{ prompt: string; style: string; angle: string }> = [];
  if (Array.isArray(result)) {
    prompts = result as Array<{ prompt: string; style: string; angle: string }>;
  } else if (typeof result === "object" && result !== null) {
    // Gemini might wrap it
    const r = result as Record<string, unknown>;
    if (Array.isArray(r.prompts)) prompts = r.prompts as Array<{ prompt: string; style: string; angle: string }>;
  }

  if (prompts.length === 0) {
    throw new Error("No prompts generated. Try a different creative direction.");
  }

  return {
    result: { prompts, visualGuide: visualGuideData.visualGuide },
    needsApproval: true,
  };
};

// ── Generate Batch — Nano Banana x N ──────────────────────

export const handleGenerateBatch: StepHandler = async (ctx) => {
  const { activeBrand, config, getStepResult, tool } = ctx;

  const promptsData = getStepResult("prompts") as {
    prompts: Array<{ prompt: string; style: string; angle: string }>;
  } | undefined;

  if (!promptsData?.prompts?.length) throw new Error("No prompts found.");

  const selectedProduct = (activeBrand.products || []).find((p) => p.id === config.selectedProductId);
  const selectedAvatar = activeBrand.avatars?.find((a) => a.id === config.selectedAvatarId);
  const selectedClothing = (activeBrand.clothing || []).filter((c) => config.selectedClothingIds.includes(c.id));
  const selectedBackground = (activeBrand.backgrounds || []).find((bg) => bg.id === config.selectedBackgroundId);

  // Collect reference images: avatar → clothing → product → background
  // At minimum we need clothing OR product as reference
  const referenceUrls: string[] = [];
  if (selectedAvatar?.imageUrl) referenceUrls.push(selectedAvatar.imageUrl);
  selectedClothing.forEach((c) => { if (c.imageUrl) referenceUrls.push(c.imageUrl); });
  if (selectedProduct?.imageUrl) referenceUrls.push(selectedProduct.imageUrl);
  if (selectedBackground?.imageUrl) referenceUrls.push(selectedBackground.imageUrl);

  if (referenceUrls.length === 0) {
    throw new Error("Select at least a product or garments as reference.");
  }

  // Generate one image per prompt
  const results = await Promise.all(
    promptsData.prompts.map(async (p, i) => {
      try {
        const job = await createImageEdit(referenceUrls, p.prompt, config.aspectRatio, config.resolution);
        const result = await pollImageGen(job.request_id);
        return {
          id: `creative_${i + 1}`,
          url: result.image_url || "",
          prompt: p.prompt,
          style: p.style,
          angle: p.angle,
          status: result.status === "failed" ? "failed" : "done",
        };
      } catch (err) {
        return {
          id: `creative_${i + 1}`,
          url: "",
          prompt: p.prompt,
          style: p.style,
          angle: p.angle,
          status: "failed",
        };
      }
    })
  );

  const successful = results.filter((r) => r.status === "done" && r.url);

  // Save to content library
  try {
    await saveGeneration({
      brandId: activeBrand.id,
      toolId: tool.id,
      title: `Ad Creatives — ${selectedProduct?.name || "Campaign"} — ${new Date().toLocaleDateString()}`,
      type: "image",
      thumbnailUrl: successful[0]?.url,
      scenes: successful.map((r) => ({ id: r.id, title: r.style, imageUrl: r.url })),
      metadata: {
        numGenerated: results.length,
        numSuccessful: successful.length,
        aspectRatio: config.aspectRatio,
        resolution: config.resolution,
      },
    });
  } catch { /* silent */ }

  return {
    result: { creatives: results, totalGenerated: results.length, successful: successful.length },
    needsApproval: true,
  };
};

// ── Review — manual (handled by UI) ──────────────────────

export const handleReview: StepHandler = async () => {
  return { result: null };
};
