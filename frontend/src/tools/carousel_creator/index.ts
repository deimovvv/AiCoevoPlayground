/**
 * Carousel Creator — Tool Definition
 * ────────────────────────────────────
 * Pipeline: prompt → generate_all
 *
 * Creates multi-slide carousel ads with cohesive visual style.
 * Prompt step generates copy + image prompts for all slides.
 * Generate_all creates images sequentially using first slide as style reference.
 */

import type { ToolDefinition, StepHandler } from "../types";
import { generateToolPrompt, createImageEdit, pollImageGen, saveGeneration } from "../../lib/api";

// ── Prompt — generates slide copy + image prompts ──────────

const handlePrompt: StepHandler = async (ctx) => {
  const { activeBrand, config, tool } = ctx;
  const selectedProduct = (activeBrand.products || []).find((p) => p.id === config.selectedProductId);
  const selectedAvatar = activeBrand.avatars?.find((a) => a.id === config.selectedAvatarId);
  const logo = activeBrand.logo as { imageUrl: string } | undefined;

  const extraVars: Record<string, string> = { language: config.language || "es" };
  if (selectedProduct?.description) extraVars.product_description = selectedProduct.description;
  if (config.objective) extraVars.creative_direction = config.objective;
  if (logo) extraVars.logo_info = "Brand logo is available as a reference image.";

  // Fetch carousel type structure if selected
  const carouselType = (config as unknown as Record<string, unknown>).carouselType as string || "";
  let typePrompt = "";
  if (carouselType) {
    try {
      const res = await fetch("http://localhost:8000/api/tools/carousel-creator/types");
      const data = await res.json();
      const cType = (data.types || []).find((t: { id: string }) => t.id === carouselType);
      if (cType) {
        const slideStructure = cType.structure
          .map((s: { role: string; label: string; hint: string }, i: number) =>
            `Slide ${i + 1} (${s.role}): ${s.hint}`
          )
          .join("\n");
        typePrompt = `\n\nCREATE A "${cType.name.toUpperCase()}" CAROUSEL WITH ${cType.slides} SLIDES:\n${slideStructure}`;
      }
    } catch { /* silent */ }
  }

  const numSlides = (config as unknown as Record<string, unknown>).numSlides || 5;
  let userMsg = `Generate EXACTLY ${numSlides} slides for a carousel ad. No more, no less.${typePrompt}\nRespond with ONLY a JSON object.`;
  if (selectedProduct) userMsg += `\nProduct: ${selectedProduct.name}`;
  if (selectedAvatar) userMsg += `\nModel: ${selectedAvatar.name}`;
  if (config.objective) userMsg += `\nDirection: ${config.objective}`;

  const { result } = await generateToolPrompt(activeBrand.id, "carousel_creator", userMsg, extraVars);
  let parsed = result as Record<string, unknown>;
  if (typeof result === "string") {
    try { parsed = JSON.parse(result as string); } catch { /* */ }
  }
  // If Gemini returned an array directly, wrap it as { slides: [...] }
  if (Array.isArray(parsed)) {
    parsed = { slides: parsed } as unknown as Record<string, unknown>;
  }
  // Unwrap if Gemini wraps in a single-key object
  const pKeys = Object.keys(parsed);
  if (pKeys.length === 1 && typeof parsed[pKeys[0]] === "object" && parsed[pKeys[0]] !== null && !Array.isArray(parsed[pKeys[0]])) {
    parsed = parsed[pKeys[0]] as Record<string, unknown>;
  }

  return { result: parsed, needsApproval: true };
};

// ── Generate All — create all slide images sequentially ────

const handleGenerateAll: StepHandler = async (ctx) => {
  const { activeBrand, config, getStepResult, tool } = ctx;
  let promptResult = getStepResult("prompt") as Record<string, unknown> | undefined;

  // Unwrap if still wrapped
  if (promptResult) {
    const pk = Object.keys(promptResult);
    if (pk.length === 1 && typeof promptResult[pk[0]] === "object" && promptResult[pk[0]] !== null && !Array.isArray(promptResult[pk[0]])) {
      promptResult = promptResult[pk[0]] as Record<string, unknown>;
    }
  }

  const slides = (promptResult?.slides || []) as Array<Record<string, string>>;
  if (slides.length === 0) throw new Error("No slides found in prompt result.");

  // base_scene is the visual DNA shared by ALL slides — background, lighting, color grade
  const baseScene = String(promptResult?.base_scene || promptResult?.visual_style || "");
  const selectedProduct = (activeBrand.products || []).find((p) => p.id === config.selectedProductId);
  const selectedAvatar = activeBrand.avatars?.find((a) => a.id === config.selectedAvatarId);
  const logo = activeBrand.logo as { imageUrl: string } | undefined;

  // Build reference image URLs — product FIRST (highest priority for Nano Banana)
  const productUrl = selectedProduct?.imageUrl || "";
  const avatarUrl = selectedAvatar?.imageUrl || "";
  const logoUrl = logo?.imageUrl || "";
  const productName = selectedProduct?.name || "the product";

  // Generate slides sequentially — each uses the first slide as style reference
  const generatedSlides: Array<{
    id: string;
    url: string;
    label: string;
    headline: string;
    body: string;
    role: string;
  }> = [];

  let firstSlideUrl = "";

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const mentionsPerson = /person|model|hand|holding|selfie|lifestyle/i.test(slide.image_prompt || "");

    // Reference images — same approach as UGC: product always included, keep it simple
    const imageUrls: string[] = [];
    if (productUrl) imageUrls.push(productUrl);
    if (i > 0 && firstSlideUrl) imageUrls.push(firstSlideUrl);
    if (mentionsPerson && avatarUrl) imageUrls.push(avatarUrl);

    // Keep prompt clean — Gemini's image_prompt already describes the product
    // Don't overload with extra instructions (UGC works because it sends just the prompt)
    const slidePrompt = `${baseScene}. ${slide.image_prompt}. No text or typography in the image.`;


    try {
      const job = await createImageEdit(imageUrls, slidePrompt, config.aspectRatio || "4:5", config.resolution);
      const result = await pollImageGen(job.request_id);

      if (result.status === "failed") {
        generatedSlides.push({
          id: `slide_${i + 1}`,
          url: "",
          label: `Slide ${i + 1}`,
          headline: slide.headline || "",
          body: slide.body || "",
          role: slide.role || "",
        });
        continue;
      }

      const url = result.image_url || "";
      if (i === 0) firstSlideUrl = url;

      generatedSlides.push({
        id: `slide_${i + 1}`,
        url,
        label: `Slide ${i + 1} — ${slide.role || ""}`,
        headline: slide.headline || "",
        body: slide.body || "",
        role: slide.role || "",
      });
    } catch {
      generatedSlides.push({
        id: `slide_${i + 1}`,
        url: "",
        label: `Slide ${i + 1}`,
        headline: slide.headline || "",
        body: slide.body || "",
        role: slide.role || "",
      });
    }
  }

  // Save to content library
  try {
    await saveGeneration({
      brandId: activeBrand.id,
      toolId: tool.id,
      title: `Carousel — ${selectedProduct?.name || "Campaign"} — ${new Date().toLocaleDateString()}`,
      type: "image",
      thumbnailUrl: firstSlideUrl,
      scenes: generatedSlides.map((s) => ({ id: s.id, title: s.label, imageUrl: s.url })),
      metadata: { numSlides: generatedSlides.length, baseScene },
    });
  } catch { /* silent */ }

  return {
    result: {
      slides: generatedSlides,
      baseScene,
      prompt: promptResult,
    },
    needsApproval: false,
  };
};

export const carouselCreator: ToolDefinition = {
  schema: {
    showAvatar: true, avatarLabel: "Person", avatarSublabel: "optional — include talent",
    showProduct: true, productLabel: "Product",
    showClothing: false,
    showBackground: false,
    showVoice: false,
    showTone: false,
    showPlatform: false,
    showLanguage: true,
    showVariations: false,
    objectiveLabel: "Creative Direction",
    objectivePlaceholder: "Describe the carousel theme. E.g., 'educational tips about skincare', 'before/after transformation'...",
    showNotes: false,
  },
  stepHandlers: {
    prompt: handlePrompt,
    generate_all: handleGenerateAll,
  },
  approvalSteps: ["prompt"],
  autoRunSteps: ["generate_all"],
};
