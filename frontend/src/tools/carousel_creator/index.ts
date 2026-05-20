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
import { generateToolPrompt, createImageEdit, createTextToImage, pollImageGen } from "../../lib/api";
import { buildBrandConstraints, buildBrandContext } from "../shared/brandConstraints";

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

  const numSlides = (config as unknown as Record<string, unknown>).numSlides || 5;
  // CRITICAL: Gemini sometimes simplifies output to a single object when N is low.
  // Force the array shape with explicit instructions.
  let userMsg = `Generate a carousel ad with EXACTLY ${numSlides} DIFFERENT slides. Each slide must show different visual content (different angle, subject, scene, or framing) — NOT the same scene repeated.

MANDATORY OUTPUT FORMAT:
- Respond with ONLY a JSON object (no markdown, no code fences).
- The object MUST contain a key "slides" that is an ARRAY of EXACTLY ${numSlides} slide objects.
- Even if ${numSlides} is small (e.g. 2 or 3), you MUST return the array — do NOT return a single slide object.
- Each slide object must have: slide_number, role, headline, body, image_prompt, text_overlay.

If you return fewer than ${numSlides} slides or omit the "slides" array, the request fails.`;
  if (selectedProduct) userMsg += `\nProduct: ${selectedProduct.name}`;
  if (selectedAvatar) userMsg += `\nModel: ${selectedAvatar.name}`;
  if (config.objective) userMsg += `\nDirection: ${config.objective}`;

  const { result } = await generateToolPrompt(activeBrand.id, "carousel_creator", userMsg, extraVars);
  console.log("[carousel] raw result from Gemini:", JSON.stringify(result).slice(0, 800));

  let parsed: Record<string, unknown> = (result as Record<string, unknown>) || {};
  if (typeof result === "string") {
    try { parsed = JSON.parse(result as string); } catch { /* */ }
  }
  if (Array.isArray(parsed)) {
    parsed = { slides: parsed } as unknown as Record<string, unknown>;
  }

  // Robust unwrap — descend up to 2 levels of single-key nesting
  for (let depth = 0; depth < 2 && parsed && typeof parsed === "object"; depth++) {
    if ("slides" in parsed || "image_prompt" in parsed) break;
    const pk = Object.keys(parsed);
    const inner = pk[0] ? parsed[pk[0]] : undefined;
    if (pk.length === 1 && typeof inner === "object" && inner !== null) {
      if (Array.isArray(inner)) {
        parsed = { slides: inner } as Record<string, unknown>;
        break;
      }
      parsed = inner as Record<string, unknown>;
    } else {
      break;
    }
  }

  // Look for the slides array under any common alias
  if (!Array.isArray(parsed.slides)) {
    for (const alias of ["slides", "scenes", "items", "results", "carousel", "panels", "frames"]) {
      const v = parsed[alias];
      if (Array.isArray(v)) {
        parsed.slides = v;
        break;
      }
    }
  }

  // Recovery: bare single slide object (no array)
  if (!Array.isArray(parsed.slides) && parsed.image_prompt) {
    console.warn("[carousel] Gemini returned a bare single slide — wrapping into array");
    parsed = {
      base_scene: String(parsed.base_scene || parsed.visual_style || ""),
      colors: String(parsed.colors || ""),
      slides: [parsed],
    };
  }

  // If still no array, fail with the real shape so the user can see it
  if (!Array.isArray(parsed.slides)) {
    console.error("[carousel] Could not find slides array. Final shape:", JSON.stringify(parsed).slice(0, 800));
    const seenKeys = Object.keys(parsed).join(", ");
    throw new Error(`Gemini no devolvió un array de slides (recibió: { ${seenKeys} }). Apretá "Regenerate" para reintentar — si vuelve a pasar, abrí la consola para ver el shape real.`);
  }

  // Validate count
  const returnedSlides = parsed.slides as unknown[];
  if (returnedSlides.length === 0) {
    throw new Error(`Gemini devolvió 0 slides. Apretá "Regenerate" para reintentar.`);
  }
  if (returnedSlides.length < numSlides) {
    console.warn(`[carousel] Gemini returned ${returnedSlides.length} slides instead of ${numSlides} — proceeding with what we got`);
    // Don't throw — let the user proceed with fewer slides if Gemini was stingy.
    // The user can re-run if they really need more.
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
  const geminiBaseScene = String(promptResult?.base_scene || promptResult?.visual_style || "");
  const selectedProduct = (activeBrand.products || []).find((p) => p.id === config.selectedProductId);
  const selectedAvatar = activeBrand.avatars?.find((a) => a.id === config.selectedAvatarId);
  const selectedMoodboard = (activeBrand.moodboards || []).find((m) => m.id === config.selectedMoodboardId);

  // Build reference image URLs — product FIRST (highest priority for Nano Banana)
  const productUrl = selectedProduct?.imageUrl || "";
  const avatarUrl = selectedAvatar?.imageUrl || "";
  const moodboardUrl = selectedMoodboard?.imageUrl || "";
  const imageModel = (config as unknown as Record<string, unknown>).imageModel as "nano-banana-2" | "gpt-image-2" || "nano-banana-2";

  // Convert uploaded reference images (Files) to data URLs so they can be used as refs
  const refFiles = (config as { referenceImages?: File[] }).referenceImages || [];
  const refMode = (config as { referenceMode?: "style" | "composition" }).referenceMode || "style";
  const uploadedRefDataUrls: string[] = [];
  for (const file of refFiles.slice(0, 3)) {
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      uploadedRefDataUrls.push(dataUrl);
    } catch { /* skip bad file */ }
  }

  // Per-slide templates (IG replication flow): one composition reference per slide.
  // When present, slide i will use perSlideTemplateDataUrls[i] as its dedicated layout anchor
  // instead of sharing the same template across all slides.
  const perSlideFiles = (config as { perSlideTemplates?: File[] }).perSlideTemplates || [];
  const perSlideTemplateDataUrls: string[] = [];
  for (const file of perSlideFiles) {
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      perSlideTemplateDataUrls.push(dataUrl);
    } catch { perSlideTemplateDataUrls.push(""); }
  }
  const hasPerSlideTemplates = perSlideTemplateDataUrls.some(Boolean);
  if (hasPerSlideTemplates) {
    console.log(`[carousel] Per-slide templates available: ${perSlideTemplateDataUrls.filter(Boolean).length}/${perSlideTemplateDataUrls.length}`);
  }

  // ── Determine generation mode based on what the user provided ─────
  // TEMPLATE: visual reference (uploaded ref) → respect layout, vary content per slide
  // DESIGN_SYSTEM: no template but Design System cargado → coherent via shared rules + slide 1 as anchor
  // BASIC: nothing → free generation (worst coherence)
  const ds = (activeBrand as Record<string, unknown>).designSystem as Record<string, unknown> | undefined;
  const hasTemplate = uploadedRefDataUrls.length > 0;
  const hasDesignSystem = !!ds && (
    !!ds.photoStyle || !!ds.composition || !!ds.colorTreatment ||
    (Array.isArray(ds.visualDos) && (ds.visualDos as unknown[]).length > 0)
  );
  const mode: "TEMPLATE" | "DESIGN_SYSTEM" | "BASIC" =
    hasTemplate ? "TEMPLATE" : hasDesignSystem ? "DESIGN_SYSTEM" : "BASIC";

  // Build a baseScene appropriate to the mode
  const designSystemBaseScene = hasDesignSystem
    ? [
        ds!.photoStyle as string | undefined,
        ds!.composition as string | undefined,
        ds!.colorTreatment as string | undefined,
        ds!.lighting as string | undefined,
      ].filter(Boolean).join(" ")
    : "";

  // In TEMPLATE mode the visual anchor IS the user's template image — Gemini's invented
  // baseScene gets in the way. In DESIGN_SYSTEM mode we prefer the Design System over
  // Gemini's invention. Only BASIC mode falls back to Gemini's baseScene.
  const baseScene = mode === "TEMPLATE"
    ? "" // template is the anchor, no extra scene description needed
    : mode === "DESIGN_SYSTEM"
      ? designSystemBaseScene
      : geminiBaseScene;

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

    // Reference images — order depends on mode
    const imageUrls: string[] = [];
    // Track positions of each input so the prompt can reference them by number
    let templateIdx = 0;
    let avatarIdx = 0;
    let productIdx = 0;
    let prevSlideIdx = 0;
    let moodboardIdx = 0;
    if (mode === "TEMPLATE") {
      // Template = Image 1 (layout source, NOT subject source).
      // If per-slide templates are provided AND this slide has its own (IG replication flow),
      // use ONLY that one as the layout anchor — otherwise the model averages all 8 references
      // and every slide ends up looking like slide 1.
      const perSlideUrl = perSlideTemplateDataUrls[i] || "";
      if (hasPerSlideTemplates && perSlideUrl) {
        imageUrls.push(perSlideUrl);
        templateIdx = 1;
      } else {
        for (const u of uploadedRefDataUrls) imageUrls.push(u);
        if (uploadedRefDataUrls.length > 0) templateIdx = 1;
      }
      // Avatar comes BEFORE product so it has higher priority as the subject of the slide
      if (avatarUrl) { imageUrls.push(avatarUrl); avatarIdx = imageUrls.length; }
      if (productUrl) { imageUrls.push(productUrl); productIdx = imageUrls.length; }
      if (moodboardUrl) { imageUrls.push(moodboardUrl); moodboardIdx = imageUrls.length; }
    } else {
      // DESIGN_SYSTEM / BASIC: use slide 1 as visual anchor for slides 2+
      if (productUrl) { imageUrls.push(productUrl); productIdx = imageUrls.length; }
      if (i > 0 && firstSlideUrl) { imageUrls.push(firstSlideUrl); prevSlideIdx = imageUrls.length; }
      if (mentionsPerson && avatarUrl) { imageUrls.push(avatarUrl); avatarIdx = imageUrls.length; }
      if (moodboardUrl) { imageUrls.push(moodboardUrl); moodboardIdx = imageUrls.length; }
    }

    // Build the slide prompt — ordering matters: instructions about the template MUST come FIRST.
    // Models pay more attention to the start of the prompt; if Gemini's slide.image_prompt
    // (which doesn't know about the template) leads, it overrides the visual reference.
    let slidePrompt: string;

    // ── Text policy ──
    // Quick mode → image WITH text rendered (GPT Image 2 handles typography reasonably well).
    // Compose mode → image WITHOUT text (a separate HTML overlay applies brand fonts later).
    const isComposeMode = config.composeMode === "compose";
    const textPolicy = isComposeMode
      ? " No text, no typography, no captions, no headlines in the generated image — leave clean negative space."
      : (slide.headline
          ? ` Render this exact text overlay on the image: headline "${slide.headline}"${slide.body ? `, with secondary line "${slide.body}"` : ""}. Use clean, legible typography that matches the template's text style. Place it in the same area where the template shows its headline.`
          : "");

    if (mode === "TEMPLATE" && refMode === "composition") {
      // STRICT TEMPLATE MODE: re-anchor the entire prompt around Image 1.
      // Discard Gemini's slide.image_prompt — it describes scenes that don't match the template.
      // Note: language carefully avoids "replace face / same identity / exact person" — those phrases
      // trigger DALL-E 3 / GPT Image 2 content moderation as if we were doing identity swap.

      // The template can be a fashion/portrait shoot OR a graphic/info layout.
      // We infer by whether the user selected a brand avatar:
      //   - Avatar present  → fashion/portrait template → vary pose/framing of the model
      //   - No avatar       → graphic/info template → vary the content area, no model forced
      const isPortraitTemplate = avatarIdx > 0;

      const PORTRAIT_VARIATIONS = [
        "medium shot, three-quarter framing, subject facing forward with a relaxed neutral expression",
        "tight close-up portrait, head and shoulders only, subject looking off-camera",
        "full body wide shot, subject standing relaxed, more environment visible",
        "side profile, subject in profile against the same setting",
        "low angle, camera slightly below subject's eye level, looking up",
        "back-three-quarter angle, subject partially turned away, glancing back",
        "high angle from above, subject looking up to the camera",
        "candid mid-action shot, subject in mid-movement",
        "detail crop, focus on the upper torso and hands, face partially out of frame",
        "wide environmental shot, the figure smaller in the frame with significant negative space",
      ];

      // Graphic/info template variations — no person assumed, vary the content area instead
      const GRAPHIC_VARIATIONS = [
        "the main visual focus / hero element of the composition",
        "a different highlighted element or section, occupying the same area as the original hero",
        "a zoomed-in detail of one element from the template, framed within the same layout",
        "an alternative content variation in the same composition slot — different graphic or icon, same placement",
        "a complementary version with different supporting graphics or annotations, same overall layout",
        "the composition with the focal element shifted slightly within its frame, same overall layout",
        "an alternative color emphasis on the same elements (different accent area highlighted)",
        "a denser version with additional supporting visual details in the same layout",
        "a sparser version with more negative space, same composition skeleton",
        "an alternative scale of the central element within the same layout",
      ];

      const VARIATIONS = isPortraitTemplate ? PORTRAIT_VARIATIONS : GRAPHIC_VARIATIONS;
      const slideVariation = VARIATIONS[i] || `variation ${i + 1}`;

      // Per-slide template flow (IG replication): each slide has its OWN dedicated layout
      // reference, so we don't need hard-coded variation instructions — just tell the model
      // to follow this slide's specific template.
      const usingDedicatedTemplate = hasPerSlideTemplates && !!perSlideTemplateDataUrls[i];

      const subjectClause = isPortraitTemplate
        ? `The subject in this scene is the brand model shown in Image ${avatarIdx}. Use Image ${avatarIdx} as the visual reference for the subject's overall look.`
        : `Treat Image ${templateIdx} as a graphic/layout template — keep its composition structure, typography style, color blocking, and visual hierarchy. Do NOT introduce people if none appear in the template.`;
      const productClause = productIdx > 0
        ? ` Where a product appears, use the product from Image ${productIdx} (same shape, color, packaging).`
        : "";
      const moodClause = moodboardIdx > 0
        ? ` Image ${moodboardIdx} is a secondary mood reference for palette and feel.`
        : "";
      const slideRole = slide.role || `slide ${i + 1}`;
      const headlineHint = slide.headline ? ` This slide expresses: "${slide.headline}".` : "";

      const variationLine = usingDedicatedTemplate
        ? `Image ${templateIdx} is the layout reference for THIS specific slide (${i + 1} of ${slides.length}, ${slideRole}). Match its composition, framing, focal-element placement, and visual hierarchy. Each slide of this carousel has its OWN distinct layout — do not blend with sibling slides.`
        : isPortraitTemplate
          ? `For THIS specific slide (${i + 1} of ${slides.length}, ${slideRole}), use this exact shot: ${slideVariation}. This shot must be VISIBLY DIFFERENT from the other slides — different framing, pose, or angle than the template.`
          : `For THIS specific slide (${i + 1} of ${slides.length}, ${slideRole}), the central content is: ${slideVariation}. The composition STRUCTURE stays IDENTICAL to the template (same layout, typography placement) — only the content shown inside changes between slides.`;

      // Template color mode: "brand" → re-color with brand palette; "template" → keep template colors literal
      const colorMode = (config as unknown as Record<string, unknown>).templateColorMode as "brand" | "template" || "brand";
      const colorClause = colorMode === "template"
        ? `Reproduce the template's color palette LITERALLY — keep every color, gradient, and tonal value exactly as it appears in Image ${templateIdx}. This is an official brand template; its colors ARE the brand's colors for this carousel.`
        : `Use Image ${templateIdx} ONLY as the STRUCTURAL reference: same composition, same framing, same setting/location, same lighting direction, same overall spatial layout — but RE-COLOR the entire scene using the brand's color palette (defined below in PALETTE CONSTRAINT). Do NOT copy the template's colors. The template provides structure; the brand provides identity.`;

      slidePrompt = `${colorClause} ${subjectClause}${productClause}${moodClause} ${variationLine}${headlineHint}${textPolicy}`;
    } else if (mode === "TEMPLATE") {
      // STYLE mode for template: looser — match mood/color/lighting but composition can vary
      const styleClause = `Image ${templateIdx} defines the visual STYLE for this carousel — match its mood, color grading, lighting, grain, and typography style. Do not reproduce specific people or objects literally.`;
      const subjectClause = avatarIdx > 0
        ? ` The model is the brand model shown in Image ${avatarIdx} — use it as the visual reference for the model's look.`
        : "";
      const productClause = productIdx > 0 ? ` The product is from Image ${productIdx} — reproduce it exactly.` : "";
      const variationClause = ` This is slide ${i + 1} of ${slides.length}${slide.role ? ` (${slide.role})` : ""} — show different content from other slides.`;
      slidePrompt = `${styleClause}${subjectClause}${productClause}${variationClause} ${slide.image_prompt}.${textPolicy}`;
    } else if (mode === "DESIGN_SYSTEM") {
      const prevClause = prevSlideIdx > 0
        ? ` Image ${prevSlideIdx} is the previous slide of this carousel — keep the same visual language (palette, typography style, lighting feel) but show DIFFERENT content.`
        : "";
      slidePrompt = `${baseScene ? baseScene + ". " : ""}${slide.image_prompt}.${prevClause} This is slide ${i + 1} of ${slides.length}.${textPolicy}`;
    } else {
      // BASIC mode
      slidePrompt = `${baseScene ? baseScene + ". " : ""}${slide.image_prompt}.${textPolicy}`;
    }

    // Append brand context + constraints to the slide prompt
    // When the user opted to KEEP the template's literal colors (templateColorMode === "template"),
    // skip the palette constraint to avoid contradicting the "keep colors literal" instruction.
    const colorModeForConstraints = (config as unknown as Record<string, unknown>).templateColorMode as "brand" | "template" || "brand";
    const skipPalette = mode === "TEMPLATE" && refMode === "composition" && colorModeForConstraints === "template";
    const constraints = buildBrandConstraints(activeBrand, config, {
      tool: "carousel_creator",
      mentionsAvatar: avatarIdx > 0,
      skipPalette,
    });
    const brandContextBlock = i === 0 ? buildBrandContext(activeBrand, "carousel_creator") : ""; // only first slide carries the full block (others inherit via firstSlideUrl)
    slidePrompt = `${slidePrompt}${brandContextBlock}${constraints}`;
    if (i === 0) console.log("[carousel] FINAL PROMPT slide 1:", slidePrompt.slice(0, 1500));

    // Sanitize a prompt for retry after content moderation rejection.
    // GPT Image 2 (DALL-E 3) flags identity/face-related language. Strip it on retry.
    const sanitizeForRetry = (p: string): string => p
      .replace(/exact person|same face|same identity|same skin tone|same hair|replace.*subject|replace.*face/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    const runJob = async (prompt: string) => {
      const job = imageUrls.length === 0
        ? await createTextToImage(prompt, config.aspectRatio || "4:5", config.resolution, imageModel)
        : await createImageEdit(imageUrls, prompt, config.aspectRatio || "4:5", config.resolution, imageModel);
      return pollImageGen(job.request_id);
    };

    try {
      let result = await runJob(slidePrompt);

      // If content moderation rejected, retry once with a sanitized prompt
      const looksLikeContentBlock = result.status === "failed"
        && /content|policy|flagged|moderation|safety/i.test(result.error || "");
      if (looksLikeContentBlock) {
        console.warn(`[carousel] Slide ${i + 1} blocked by content checker, retrying with sanitized prompt`);
        const safer = sanitizeForRetry(slidePrompt);
        result = await runJob(safer);
      }

      if (result.status === "failed") {
        console.warn(`[carousel] Slide ${i + 1} failed: ${result.error}`);
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

  // Persistence handled by autoSaveStep in ToolRunPage — no manual saveGeneration here.

  return {
    result: {
      slides: generatedSlides,
      baseScene,
      prompt: promptResult,
      composeMode: config.composeMode || "quick",
    },
    needsApproval: false,
  };
};

export const carouselCreator: ToolDefinition = {
  schema: {
    showAvatar: true, avatarLabel: "Person", avatarSublabel: "optional — include talent",
    showProduct: true, productLabel: "Product",
    showClothing: false,
    showBackground: true,
    showMoodboard: true,
    showReference: true,
    showVoice: false,
    showTone: false,
    showPlatform: false,
    showLanguage: true,
    showVariations: false,
    objectiveLabel: "Creative Direction",
    objectivePlaceholder: "Curá el contenido — Gemini sigue tu estructura.\n\nEj:\nTema: lanzamiento campaña 'Restless Ambition'\nEstructura:\n  Slide 1: hook con el nombre de la colección\n  Slide 2: concepto / inspiración\n  Slide 3: hero shot del modelo\n  Slide 4: CTA + link\nDatos clave: la colección sale el 5 de mayo, exclusiva para 200 piezas\nTono: editorial cultural, voseo argentino",
    showNotes: false,
  },
  stepHandlers: {
    prompt: handlePrompt,
    generate_all: handleGenerateAll,
  },
  approvalSteps: ["prompt"],
  autoRunSteps: ["generate_all"],
};
