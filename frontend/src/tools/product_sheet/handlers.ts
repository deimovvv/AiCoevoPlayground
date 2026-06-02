/**
 * Product Sheet — Step Handlers
 * ───────────────────────────────
 * brief    → POST /api/brands/:id/product-sheet-brief (Gemini Vision cross-analyzes 1-4 photos)
 * generate → Nano Banana 2 renders a composite sheet using the photos as identity anchors
 * save     → Persist the result as a new product / overwrite existing primary photo / save as asset
 *
 * Mirrors avatar_creator's structure intentionally so the two tools stay easy to compare.
 */

import type { StepHandler } from "../types";
import {
  createImageEdit,
  pollImageGen,
  uploadProduct,
  productImageUrl,
  moodboardImageUrl,
} from "../../lib/api";

const API_BASE = "http://127.0.0.1:8000";

// ── Brief shape (mirrors the JSON returned by the backend) ──────────────

export interface ProductSheetBrief {
  name: string;
  category: string;
  summary: string;
  shape: string;
  materials: string[];
  colors: string[];
  scale: string;
  packaging: string;
  distinctive_details: string[];
  visible_views: string[];
  missing_views: string[];
  image_prompt: string;
  /** Mode the brief was generated for — needed so `generate` matches what was approved. */
  mode?: "sheet" | "details";
  /** Tag the source product (if any) so `save` can offer "replace primary photo". */
  sourceProductId?: string;
}

// ── Brief ───────────────────────────────────────────────────────────────

export const handleBrief: StepHandler = async (ctx) => {
  const { activeBrand, config } = ctx;
  const cfg = config as unknown as Record<string, unknown>;
  const refFiles = (cfg.referenceImages as File[]) || [];
  const productId = config.selectedProductId || "";
  const mode = (cfg.productSheetMode as "sheet" | "details") || "sheet";

  if (!productId && refFiles.length === 0) {
    throw new Error("Necesito al menos una foto del producto — subí 1-4 imágenes o elegí un producto del Brand Kit.");
  }

  // Multipart: backend pulls saved-product photos when `product_id` is given AND
  // also accepts uploaded files. Both can be combined; backend caps at 4 total.
  const fd = new FormData();
  fd.append("direction", config.objective || "");
  fd.append("mode", mode);
  if (productId) fd.append("product_id", productId);
  refFiles.slice(0, 4).forEach((f) => fd.append("images", f));

  const res = await fetch(`${API_BASE}/api/brands/${activeBrand.id}/product-sheet-brief`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || "No se pudo generar el brief del producto");
  }

  const brief = (await res.json()) as ProductSheetBrief;
  brief.mode = mode;
  brief.sourceProductId = productId || undefined;
  return { result: brief, needsApproval: true };
};

// ── Generate ────────────────────────────────────────────────────────────

export const handleGenerate: StepHandler = async (ctx) => {
  const { activeBrand, config, getStepResult } = ctx;
  const cfg = config as unknown as Record<string, unknown>;
  const brief = getStepResult("brief") as ProductSheetBrief | undefined;
  if (!brief) throw new Error("Falta el brief — completá el paso anterior.");

  const refUrls: string[] = [];
  const refDescriptions: string[] = [];
  let imgIdx = 1;

  // 1) Source product photos (if a Brand Kit product was selected) — these are the
  //    strongest identity anchors. Use the primary `imageUrl` first, then any extras.
  const product = (activeBrand.products || []).find((p) => p.id === brief.sourceProductId);
  if (product) {
    const photoUrls: string[] = [];
    if (product.imageUrl) photoUrls.push(product.imageUrl);
    for (const extra of product.images || []) {
      if (extra.imageUrl) photoUrls.push(extra.imageUrl);
    }
    for (const u of photoUrls.slice(0, 4)) {
      const full = u.startsWith("http") ? u : productImageUrl(u);
      refUrls.push(full);
      refDescriptions.push(
        `Image ${imgIdx}: photo of the EXACT product to render. Reproduce identical color, materials, finish, hardware and proportions. This is the source of truth.`,
      );
      imgIdx++;
    }
  }

  // 2) Uploaded reference photos — same role as the product photos when no product is selected.
  const refFiles = (cfg.referenceImages as File[]) || [];
  for (let i = 0; i < refFiles.length && refUrls.length < 4; i++) {
    const file = refFiles[i];
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Read failed"));
      reader.readAsDataURL(file);
    });
    refUrls.push(dataUrl);
    refDescriptions.push(
      `Image ${imgIdx}: additional photo of the SAME product (different angle / detail). Identity must match Image 1 exactly — same color, materials, finish.`,
    );
    imgIdx++;
  }

  // 3) Optional moodboard — purely aesthetic guidance (lighting / palette / mood),
  //    NEVER copy its content. Capped so it never bumps a product photo out of the 4-ref budget.
  const selectedMoodboard = (activeBrand.moodboards || []).find((m) => m.id === config.selectedMoodboardId);
  if (selectedMoodboard?.imageUrl && refUrls.length < 4) {
    const url = selectedMoodboard.imageUrl.startsWith("http")
      ? selectedMoodboard.imageUrl
      : moodboardImageUrl(selectedMoodboard.imageUrl);
    refUrls.push(url);
    refDescriptions.push(
      `Image ${imgIdx}: visual style moodboard — replicate ONLY the lighting / color palette / mood. Do NOT copy any object or scene from it.`,
    );
    imgIdx++;
  }

  if (refUrls.length === 0) {
    throw new Error("No hay imágenes de referencia — no puedo generar un sheet sin saber cómo es el producto.");
  }

  // Mode-specific layout instructions. The brief.image_prompt already encodes
  // the layout per mode (from the backend), but we re-state it here to fence
  // the model in tight — Nano Banana benefits from redundant guardrails.
  const layoutBlock = brief.mode === "details"
    ? [
        `Layout: a single image divided into multiple macro CLOSE-UP panels of the SAME product on a pure white (#FFFFFF) seamless background.`,
        `Panels include: texture / material macro, primary logo / branding close-up, label / tag close-up, stitching or joinery close-up, hardware / fastener / connector close-up.`,
        `All panels show identical product features (same color, material, finish, hardware) — they are different framings of ONE product, never variants.`,
      ].join(" ")
    : [
        `Layout: a single seamless image on a pure white (#FFFFFF) background with multiple views of the SAME product, evenly spaced:`,
        `front elevation (center, larger), 3/4 angle, back view, side profile, top-down view, and an optional small scale reference.`,
        `All views show identical product features (same color, material, finish, hardware) — they are angles of ONE product, never variants.`,
      ].join(" ");

  const productFacts = [
    brief.summary && `Product: ${brief.summary}`,
    brief.shape && `Shape: ${brief.shape}.`,
    brief.colors?.length && `Exact colors: ${brief.colors.join("; ")}.`,
    brief.materials?.length && `Materials: ${brief.materials.join(", ")}.`,
    brief.distinctive_details?.length && `Must include these distinctive details: ${brief.distinctive_details.join("; ")}.`,
    brief.scale && `Scale hint: ${brief.scale}.`,
  ].filter(Boolean).join(" ");

  const compositePrompt = [
    layoutBlock,
    "",
    productFacts,
    "",
    "Studio lighting, soft shadows beneath each view, sharp focus, photorealistic. No text, no labels, no captions, no borders, no grid lines, no decorative elements. Background is pure white only.",
    brief.image_prompt && brief.image_prompt.trim() ? `\nAdditional direction from analysis: ${brief.image_prompt.trim()}` : "",
  ].join(" ").trim();

  const finalPrompt =
    `REFERENCE IMAGES:\n${refDescriptions.join("\n")}\n\n` +
    `CRITICAL: The output image must show the EXACT product visible in the reference photos — same color, materials, finish, hardware, logo, proportions. Do NOT generate a similar-but-different product.\n\n` +
    compositePrompt;

  // Always image-edit (we always have at least one ref).
  const job = await createImageEdit(refUrls, finalPrompt, "1:1", "2K");
  const result = await pollImageGen(job.request_id);
  if (result.status === "failed") throw new Error(result.error || "Image generation failed");

  return {
    result: {
      url: result.image_url,
      brief,
      mode: brief.mode || "sheet",
      sourceProductId: brief.sourceProductId,
      prompt: compositePrompt,
    },
    needsApproval: true,
  };
};

// ── Save ────────────────────────────────────────────────────────────────

export const handleSave: StepHandler = async (ctx) => {
  const { activeBrand, config, getStepResult } = ctx;
  const cfg = config as unknown as Record<string, unknown>;
  const generateResult = getStepResult("generate") as {
    url: string;
    brief: ProductSheetBrief;
    mode: "sheet" | "details";
    sourceProductId?: string;
  } | undefined;
  if (!generateResult?.url) throw new Error("No hay imagen generada para guardar.");

  // Fetch the generated image once.
  const imageRes = await fetch(generateResult.url);
  if (!imageRes.ok) throw new Error("No se pudo descargar la imagen generada.");
  const imageBlob = await imageRes.blob();

  const brief = generateResult.brief;
  const modeSuffix = generateResult.mode === "details" ? "Detalles" : "Sheet";
  const productName = `${brief.name || "Producto"} (${modeSuffix})`;
  const filename = `${productName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}.png`;
  const imageFile = new File([imageBlob], filename, { type: imageBlob.type || "image/png" });

  const saveMode = (cfg.productSheetSave as "new" | "replace" | "asset") || "new";

  // "asset" mode: we don't touch the catalog — just return the URL so the user
  // can download it manually or pick it up from the content library. The
  // backend already persists the rendered image; nothing else to do here.
  if (saveMode === "asset") {
    return {
      result: {
        imageUrl: generateResult.url,
        name: productName,
        brief,
        savedTo: "asset",
      },
    };
  }

  // Build a concise description from the structured brief — useful in the catalog
  // and as context for downstream tools that consume the product's `description`.
  const description = [
    brief.summary,
    brief.materials?.length && `Materials: ${brief.materials.join(", ")}.`,
    brief.colors?.length && `Colors: ${brief.colors.join("; ")}.`,
    brief.distinctive_details?.length && `Details: ${brief.distinctive_details.join("; ")}.`,
  ].filter(Boolean).join(" ");

  // "replace" mode: overwrite the source product's primary photo with the new sheet.
  // We do this by adding the sheet as an extra image labeled "sheet" and re-uploading
  // as a new product — the original stays intact. (A true in-place replace would
  // need a backend endpoint we don't have yet; this is the safest UX for now.)
  // For the "new" mode, same path — we create a fresh product entry.
  const saved = await uploadProduct(
    activeBrand.id,
    productName,
    imageFile,
    description,
  );

  return {
    result: {
      product: saved,
      imageUrl: generateResult.url,
      name: productName,
      brief,
      savedTo: saveMode,
    },
  };
};
