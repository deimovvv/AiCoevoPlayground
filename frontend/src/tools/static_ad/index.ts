/**
 * Static Ad — Tool Definition
 * ─────────────────────────────
 * Pipeline: prompt → generate_all
 *
 * Creates ready-to-publish static ads with product, copy, logo, and brand colors.
 * Generate_all creates the base image + variations in a single step.
 */

import type { ToolDefinition, StepHandler } from "../types";
import { generateToolPrompt, createImageEdit, createTextToImage, pollImageGen } from "../../lib/api";
import { buildBrandConstraints, buildBrandContext } from "../shared/brandConstraints";

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
  // Only one of these two branches is populated; the other stays empty so the template block is skipped
  if (selectedAvatar && selectedProduct) {
    if (config.productIsWorn) extraVars.product_is_worn = "true";
    else extraVars.product_is_not_worn = "true";
  }

  // If a template is selected, fetch it and include in the prompt
  const templateId = config.adTemplate;
  let templatePrompt = "";
  if (templateId) {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/tools/static-ad/templates");
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

  let userMsg = `Generate a static ad composition.${templatePrompt}

MANDATORY OUTPUT FORMAT:
- Respond with ONLY a JSON object (no markdown, no code fences, no commentary).
- Top-level keys MUST include: image_prompt, headline, subline, cta, colors.
- "image_prompt" is REQUIRED — a 3-5 sentence English description of the full ad composition.
- Do NOT wrap the response in extra objects (no {"ad_composition": {...}}, no arrays).`;
  if (selectedProduct) userMsg += `\nProduct: ${selectedProduct.name}`;
  if (selectedAvatar) userMsg += `\nModel: ${selectedAvatar.name}`;
  if (config.objective) userMsg += `\nDirection: ${config.objective}`;

  const { result } = await generateToolPrompt(activeBrand.id, "static_ad", userMsg, extraVars);
  console.log("[static_ad] raw result from Gemini:", JSON.stringify(result).slice(0, 600));

  let parsed = result as Record<string, unknown>;
  if (typeof result === "string") {
    try { parsed = JSON.parse(result as string); } catch { /* */ }
  }
  if (Array.isArray(parsed)) {
    parsed = (parsed as unknown as Array<Record<string, unknown>>)[0] || {};
  }
  // Robust unwrap: descend up to 2 levels of single-key nesting until we find the actual fields
  for (let depth = 0; depth < 2 && parsed && typeof parsed === "object"; depth++) {
    if ("image_prompt" in parsed || "headline" in parsed || "prompt" in parsed) break;
    const pk = Object.keys(parsed);
    const inner = pk[0] ? parsed[pk[0]] : undefined;
    if (pk.length === 1 && typeof inner === "object" && inner !== null && !Array.isArray(inner)) {
      parsed = inner as Record<string, unknown>;
    } else {
      break;
    }
  }
  // Field aliases — normalize common variants to image_prompt
  if (parsed && !parsed.image_prompt) {
    const alt = parsed.prompt || parsed.image || parsed.description || parsed.visual_prompt;
    if (typeof alt === "string" && alt.length > 0) parsed.image_prompt = alt;
  }

  if (!parsed?.image_prompt) {
    console.error("[static_ad] Could not extract image_prompt. Final shape:", JSON.stringify(parsed).slice(0, 600));
    throw new Error(`Gemini no devolvió un image_prompt válido. Apretá "Regenerate" para reintentar.`);
  }

  return { result: parsed, needsApproval: true };
};

// ── Generate All — base image + variations in one step ──

const handleGenerateAll: StepHandler = async (ctx) => {
  const { activeBrand, config, getStepResult, tool } = ctx;
  let promptResult = getStepResult("prompt") as Record<string, unknown> | undefined;

  // Robust unwrap: Gemini can return the prompt under various shapes
  // (raw {image_prompt}, wrapped {ad: {...}}, deeper nest, or array)
  if (promptResult) {
    if (Array.isArray(promptResult)) {
      promptResult = (promptResult as unknown as Array<Record<string, unknown>>)[0];
    }
    // Unwrap up to 2 levels of single-key wrapping
    for (let depth = 0; depth < 2 && promptResult; depth++) {
      const pk = Object.keys(promptResult);
      const inner = promptResult[pk[0]];
      if (pk.length === 1 && typeof inner === "object" && inner !== null && !Array.isArray(inner) && !("image_prompt" in promptResult)) {
        promptResult = inner as Record<string, unknown>;
      } else {
        break;
      }
    }
  }

  // Field aliases — Gemini sometimes uses 'prompt', 'image', 'description' instead of 'image_prompt'
  if (promptResult && !promptResult.image_prompt) {
    const alt = promptResult.prompt || promptResult.image || promptResult.description || promptResult.visual_prompt;
    if (typeof alt === "string" && alt.length > 0) {
      promptResult.image_prompt = alt;
    }
  }

  if (!promptResult?.image_prompt) {
    console.error("[static_ad] Could not find image_prompt in result. Got:", JSON.stringify(promptResult).slice(0, 500));
    throw new Error(`Gemini no devolvió un image_prompt. Apretá "Regenerate" en el step Prompt para reintentar.`);
  }

  const headline = String(promptResult.headline || "");
  const subline = String(promptResult.subline || "");
  const colors = String(promptResult.colors || "");
  const brandName = activeBrand.name || "";
  const includeCopy = config.includeCopy !== false;
  const copyClause = includeCopy
    ? `Text overlay reading "${headline}". Use brand colors: ${colors}. Place logo in a corner.`
    : `NO text overlay, NO headline, NO logo. Pure editorial image — the composition must speak for itself.`;
  // Hard rule to counter the "model with garment over shoulder" default
  const hasAvatar = !!(activeBrand.avatars || []).find((a) => a.id === config.selectedAvatarId);
  const hasProduct = !!(activeBrand.products || []).find((p) => p.id === config.selectedProductId);
  const interactionClause = hasAvatar && hasProduct
    ? (config.productIsWorn
        ? ` The model WEARS or HOLDS the product naturally (in use). `
        : ` CRITICAL: the model does NOT wear, hold, drape, or carry the product. The product is shown separately as the hero — on a surface, floating, or in a clean product shot area of the composition. The model is present for lifestyle context only, posing naturally without touching the product. Do NOT put the garment over the shoulder, do NOT hang it from the model, do NOT use merch-lookbook patterns. `)
    : "";
  const constraints = buildBrandConstraints(activeBrand, config, { tool: "static_ad", mentionsAvatar: hasAvatar });
  const brandContextBlock = buildBrandContext(activeBrand, "static_ad");

  const finalPrompt = `${promptResult.image_prompt}.${interactionClause}${brandContextBlock}${constraints}${copyClause} Match the style of the reference image. Professional ${includeCopy ? "ad" : "editorial shot"} for ${brandName}. IMPORTANT: Only include elements from the brand — reproduce the product EXACTLY as it appears in the reference photo. Do NOT add objects, props${includeCopy ? "" : ", text"}, or decorations that are not part of the brand.`;

  // DEBUG: log the final prompt that goes to the image model
  console.log("[static_ad] FINAL PROMPT:", finalPrompt.slice(0, 1500));

  const selectedProduct = (activeBrand.products || []).find((p) => p.id === config.selectedProductId);
  const selectedAvatar = activeBrand.avatars?.find((a) => a.id === config.selectedAvatarId);
  const selectedBackground = (activeBrand.backgrounds || []).find((bg) => bg.id === config.selectedBackgroundId);
  const selectedMoodboard = (activeBrand.moodboards || []).find((m) => m.id === config.selectedMoodboardId);
  const selectedClothing = (activeBrand.clothing || []).filter((c) => config.selectedClothingIds.includes(c.id));
  const logo = activeBrand.logo as { imageUrl: string } | undefined;

  // Build reference URLs + positional descriptions so Nano Banana knows what each image is
  const imageUrls: string[] = [];
  const refDescriptions: string[] = [];
  let imgIdx = 1;

  // Reference image (uploaded file) — interpretation depends on referenceMode.
  // In "style" mode this is the LOOK & FEEL reference (literal aesthetic to match).
  const refFiles = (config as { referenceImages?: File[] }).referenceImages || [];
  const refMode = (config as { referenceMode?: "style" | "composition" }).referenceMode || "style";
  for (const file of refFiles.slice(0, 1)) {
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    imageUrls.push(dataUrl);
    if (refMode === "composition") {
      refDescriptions.push(`Image ${imgIdx}: COMPOSITION REFERENCE — reproduce the SAME layout, framing, object placement, camera angle, AND the SAME setting/location/environment as this image. IMPORTANT: the scene context (indoor/outdoor, location type, time of day, surroundings) MUST match this reference — IGNORE any conflicting setting, location, or context coming from the brand description. The brand assets (product, avatar, clothing) go INTO this reference's scene, not into the brand's default setting. Keep brand colors/style where they don't conflict with the reference's composition.`);
    } else {
      refDescriptions.push(`Image ${imgIdx}: LOOK & FEEL REFERENCE — match this aesthetic LITERALLY: same color grading, lighting language, texture, contrast, and overall visual treatment. This is the final visual style the output must look like. Do NOT copy the layout/composition or the people in it — only the look & feel. Take ONLY the aesthetic.`);
    }
    imgIdx++;
  }

  // Pose reference — body position ONLY. Scoped so it doesn't bleed lighting/scene/style.
  const poseFiles = (config as { poseReference?: File[] }).poseReference || [];
  for (const file of poseFiles.slice(0, 1)) {
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    imageUrls.push(dataUrl);
    refDescriptions.push(`Image ${imgIdx}: POSE REFERENCE — copy ONLY the body position, limb placement, and camera framing/angle of the person in this image. Do NOT copy the lighting, background, scene, clothing, colors, styling, or identity — those come from the OTHER references. This image contributes pose and framing ONLY.`);
    imgIdx++;
  }

  // Avatar / model
  if (selectedAvatar?.imageUrl) {
    imageUrls.push(selectedAvatar.imageUrl);
    refDescriptions.push(`Image ${imgIdx}: MODEL "${selectedAvatar.name}" — use this EXACT person if the ad includes a person`);
    imgIdx++;
  }

  // Clothing (garments the model wears)
  for (const c of selectedClothing) {
    if (c.imageUrl) {
      imageUrls.push(c.imageUrl);
      refDescriptions.push(`Image ${imgIdx}: GARMENT "${c.name}"${c.description ? ` (${c.description})` : ""} — the model wears this EXACT item. Same color, cut, texture, fit.`);
      imgIdx++;
    }
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

  // Moodboard (visual style reference — placed before graphic assets so it influences overall mood)
  if (selectedMoodboard?.imageUrl) {
    imageUrls.push(selectedMoodboard.imageUrl);
    const moodName = selectedMoodboard.description || selectedMoodboard.name || "moodboard";
    refDescriptions.push(`Image ${imgIdx}: MOODBOARD — ART DIRECTION ONLY (${moodName}). Use it as broad creative guidance: styling direction, general mood, palette tendency, vibe. This is conceptual guidance, NOT a literal target — the literal aesthetic comes from the LOOK & FEEL reference (if present). Do NOT copy people, objects, or composition from the moodboard.`);
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
  const compositionOverride = refMode === "composition" && refFiles.length > 0
    ? `\n\nPRIORITY RULE: The COMPOSITION REFERENCE (Image 1) defines the scene's layout AND setting/environment. If the brand description suggests a different location or context (e.g. a workshop, studio, store), IGNORE that — stay in the scene shown by the reference image.`
    : "";
  const promptWithRefs = refDescriptions.length > 0
    ? `REFERENCE IMAGES:\n${refDescriptions.join("\n")}\n\n${finalPrompt}${compositionOverride}`
    : finalPrompt;

  // Generate base image — route by selected model. Fallback to text-to-image when no refs.
  const imageModel = (config as Record<string, unknown>).imageModel as "nano-banana-2" | "gpt-image-2" || "nano-banana-2";
  const baseJob = imageUrls.length === 0
    ? await createTextToImage(promptWithRefs, config.aspectRatio, config.resolution, imageModel)
    : await createImageEdit(imageUrls, promptWithRefs, config.aspectRatio, config.resolution, imageModel);
  const baseResult = await pollImageGen(baseJob.request_id);
  if (baseResult.status === "failed") throw new Error(baseResult.error || "Image generation failed");

  const baseUrl = baseResult.image_url || "";

  // ── BATCH MODE — generate N more ads, each with a different random template ──
  const batchSetting = (config as unknown as Record<string, unknown>).staticAdBatch as 1 | 3 | 5 | 10 | "all" | undefined;
  const isBatch = batchSetting && batchSetting !== 1;

  let extras: Array<{ id: string; url: string; label: string; templateId?: string; templateName?: string }> = [];

  if (isBatch) {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/tools/static-ad/templates");
      const data = await res.json();
      const allTemplates = (data.templates || []) as Array<{ id: string; name: string; category?: string; prompt: string; needs_person?: boolean }>;
      const categoryFilter = (config as unknown as Record<string, unknown>).staticAdCategory as string || "";
      const filtered = categoryFilter ? allTemplates.filter((t) => t.category === categoryFilter) : allTemplates;
      const targetCount = batchSetting === "all" ? filtered.length : Math.min(Number(batchSetting), filtered.length);
      // Random sample without replacement
      const shuffled = [...filtered].sort(() => Math.random() - 0.5);
      const chosen = shuffled.slice(0, targetCount);

      // Brand palette hex codes — used for color placeholder substitution
      const dna = (activeBrand as Record<string, unknown>).dna as { colors?: Array<{ hex?: string }> } | undefined;
      const paletteHex = (dna?.colors || []).map((c) => c.hex).filter((h): h is string => !!h && /^#[0-9a-f]{3,8}$/i.test(h));

      // Language for any text the image model needs to render
      const lang = config.language || "es";
      const langName: Record<string, string> = {
        es: "Spanish (Argentine voseo if appropriate)",
        en: "English",
        pt: "Portuguese",
        fr: "French",
        de: "German",
        it: "Italian",
      };
      const languageInstruction = `\n\nLANGUAGE — STRICT: ALL text content rendered in this image MUST be in ${langName[lang] || lang}. The brand voice is in this language. NEVER use English unless the brand is English-native.`;

      // Generate sequentially to avoid hammering the API
      for (let i = 0; i < chosen.length; i++) {
        const t = chosen[i];
        try {
          // Replace ALL bracketed placeholders with real data from Gemini's prompt step + brand assets.
          // The templates.json has examples in English — we substitute them with actual brand content
          // in the right language so the image model doesn't invent English copy.
          let tPrompt = t.prompt
            // Brand / product / person identifiers
            .replace(/\[YOUR PRODUCT[^\]]*\]/gi, selectedProduct?.name || "[the product]")
            .replace(/\[BRAND\]/gi, brandName)
            .replace(/\[PRODUCT\]/gi, selectedProduct?.name || "[the product]")
            .replace(/\[PERSON[^\]]*\]/gi, selectedAvatar?.name || selectedAvatar?.description || "[the person]")
            // Text content — use what Gemini already produced (in the right language)
            .replace(/\[YOUR HEADLINE[^\]]*\]/gi, headline || "[headline]")
            .replace(/\[HEADLINE[^\]]*\]/gi, headline || "[headline]")
            .replace(/\[YOUR SUBHEAD[^\]]*\]/gi, subline || "[subhead]")
            .replace(/\[SUBHEAD[^\]]*\]/gi, subline || "[subhead]")
            .replace(/\[SUBLINE[^\]]*\]/gi, subline || "[subline]")
            .replace(/\[YOUR OFFER[^\]]*\]/gi, headline || "[offer]")
            .replace(/\[OFFER[^\]]*\]/gi, headline || "[offer]")
            .replace(/\[OFFER DETAILS[^\]]*\]/gi, subline || "[details]")
            .replace(/\[CTA[^\]]*\]/gi, String(promptResult?.cta || "[CTA]"))
            .replace(/\[BAIT[^\]]*\]/gi, headline || "[hook]")
            .replace(/\[PUNCHLINE[^\]]*\]/gi, headline || "[punchline]")
            .replace(/\[PULL[- ]QUOTE[^\]]*\]/gi, headline || "[quote]")
            .replace(/\[PRESS QUOTE[^\]]*\]/gi, headline || "[quote]")
            .replace(/\[FULL QUOTE[^\]]*\]/gi, subline || "[quote]")
            .replace(/\[REVIEW TITLE[^\]]*\]/gi, headline || "[review]")
            .replace(/\[REVIEW BODY[^\]]*\]/gi, subline || "[review body]")
            .replace(/\[2-3 SENTENCE REVIEW[^\]]*\]/gi, subline || "[review]")
            .replace(/\[BENEFIT \d+[^\]]*\]/gi, "[benefit]")
            .replace(/\[STRENGTH \d+[^\]]*\]/gi, "[strength]")
            .replace(/\[WEAKNESS \d+[^\]]*\]/gi, "[weakness]")
            // Color tokens — use Brand DNA palette if available
            .replace(/\[PRIMARY BRAND COLOR[^\]]*\]/gi, paletteHex[0] || "[primary color]")
            .replace(/\[BRAND COLOR[^\]]*\]/gi, paletteHex[0] || "[brand color]")
            .replace(/\[CONTRAST COLOR[^\]]*\]/gi, paletteHex[1] || "[contrast color]")
            .replace(/\[CONTRAST TEXT[^\]]*\]/gi, paletteHex[1] || "[contrast]")
            .replace(/\[BACKGROUND[^\]]*\]/gi, paletteHex[0] || "[background]");
          // Compose: template instructions + language directive + brand constraints
          const batchPrompt = `${tPrompt}${languageInstruction}\n\nUse the brand's product, palette, and style.${interactionClause}${constraints}`;
          const job = imageUrls.length === 0
            ? await createTextToImage(batchPrompt, config.aspectRatio, config.resolution, imageModel)
            : await createImageEdit(imageUrls, batchPrompt, config.aspectRatio, config.resolution, imageModel);
          const result = await pollImageGen(job.request_id);
          extras.push({
            id: `batch_${t.id}`,
            url: result.image_url || "",
            label: t.name,
            templateId: t.id,
            templateName: t.name,
          });
        } catch (err) {
          console.warn(`[static_ad batch] template ${t.id} failed:`, err);
          extras.push({ id: `batch_${t.id}_failed`, url: "", label: `${t.name} (failed)`, templateId: t.id });
        }
      }
    } catch (err) {
      console.error("[static_ad batch] could not fetch templates:", err);
    }
  } else {
    // Original: generate variations using base as reference (numVariations - 1)
    const numVariations = config.numVariations || 3;
    const variations = await Promise.all(
      Array.from({ length: numVariations - 1 }, async (_, i) => {
        try {
          const varPrompt = `Image 1: the BASE AD — keep the same product, style, brand colors, brand identity. Only vary the composition and angle slightly. Do NOT add new elements.\n${refDescriptions.slice(1).map((d, ri) => d.replace(/^Image \d+/, `Image ${ri + 2}`)).join("\n")}\n\n${finalPrompt}`;
          const job = await createImageEdit([baseUrl, ...imageUrls.slice(refFiles.length > 0 ? 1 : 0)], varPrompt, config.aspectRatio, config.resolution, imageModel);
          const result = await pollImageGen(job.request_id);
          return { id: `var_${i + 2}`, url: result.image_url || "", label: `Variation ${i + 2}` };
        } catch {
          return { id: `var_${i + 2}`, url: "", label: `Variation ${i + 2}` };
        }
      })
    );
    extras = variations.filter((v) => v.url);
  }

  const allImages = [
    { id: "original", url: baseUrl, label: isBatch ? "Original (your selection)" : "Original" },
    ...extras.filter((v) => v.url),
  ];

  // Persistence is handled by the global autoSaveStep hook in ToolRunPage.

  const cta = String(promptResult.cta || "");
  return {
    result: { images: allImages, headline, subline, cta, colors, prompt: finalPrompt, batchMode: !!isBatch },
    needsApproval: false,
  };
};

export const staticAd: ToolDefinition = {
  schema: {
    showAvatar: true, avatarLabel: "Person",
    showProduct: true, productLabel: "Product",
    showClothing: true, clothingLabel: "Clothing", clothingSublabel: "multi-select — what the avatar wears",
    showBackground: true,
    showMoodboard: true,
    showReference: true,
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
