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
import { PRODUCT_BASE_PROMPT, PRODUCT_FIDELITY_RULES, PRODUCT_VIEW_CATALOG, DEFAULT_PRODUCT_VIEWS } from "./index";

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

  // Cap subido de 4 → 8 refs para soportar productos complejos (autos, electros)
  // que necesitan muchos ángulos para que Nano Banana no invente vistas. 8 está
  // dentro de los límites de la API; los 8 viajan como image_edit refs.
  const MAX_REFS = 8;

  // 1) Source product photos (if a Brand Kit product was selected) — these are the
  //    strongest identity anchors. Use the primary `imageUrl` first, then any extras
  //    con sus labels para que el prompt diga EXACTAMENTE qué ángulo es cada uno.
  const product = (activeBrand.products || []).find((p) => p.id === brief.sourceProductId);
  if (product) {
    type LabeledPhoto = { url: string; label?: string };
    const photos: LabeledPhoto[] = [];
    if (product.imageUrl) photos.push({ url: product.imageUrl, label: "main view" });
    for (const extra of product.images || []) {
      if (extra.imageUrl) photos.push({ url: extra.imageUrl, label: extra.label });
    }
    for (const p of photos.slice(0, MAX_REFS)) {
      const full = p.url.startsWith("http") ? p.url : productImageUrl(p.url);
      refUrls.push(full);
      const labelPart = p.label ? ` (this photo shows: ${p.label})` : "";
      refDescriptions.push(
        `Image ${imgIdx}: photo of the EXACT product to render${labelPart}. Reproduce identical color, materials, finish, hardware and proportions. This is the source of truth — never invent angles or details not visible across the reference photos.`,
      );
      imgIdx++;
    }
  }

  // 2) Uploaded reference photos — same role as the product photos when no product is selected.
  const refFiles = (cfg.referenceImages as File[]) || [];
  for (let i = 0; i < refFiles.length && refUrls.length < MAX_REFS; i++) {
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
  //    NEVER copy its content. Capped al mismo MAX_REFS para que no robe un slot
  //    a una foto de producto.
  const selectedMoodboard = (activeBrand.moodboards || []).find((m) => m.id === config.selectedMoodboardId);
  if (selectedMoodboard?.imageUrl && refUrls.length < MAX_REFS) {
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

  // Productos facts — descripción densa que se inyecta en cada prompt para que
  // Nano Banana refuerce identidad además de las imágenes ref.
  const productFacts = [
    brief.summary && `Product: ${brief.summary}.`,
    brief.shape && `Shape: ${brief.shape}.`,
    brief.colors?.length && `Exact colors: ${brief.colors.join("; ")}.`,
    brief.materials?.length && `Materials: ${brief.materials.join(", ")}.`,
    brief.distinctive_details?.length && `Distinctive details: ${brief.distinctive_details.join("; ")}.`,
    brief.scale && `Scale hint: ${brief.scale}.`,
  ].filter(Boolean).join(" ");

  const refBlock = `REFERENCE IMAGES:\n${refDescriptions.join("\n")}`;
  const directionExtra = brief.image_prompt?.trim()
    ? `\nAdditional direction from analysis: ${brief.image_prompt.trim()}`
    : "";

  // ── DETAILS MODE: keep the old composite (close-ups don't benefit from per-view) ──
  if (brief.mode === "details") {
    const layoutBlock = `Layout: a single image divided into multiple macro CLOSE-UP panels of the SAME product on a pure white (#FFFFFF) seamless background. Panels include: texture / material macro, primary logo / branding close-up, label / tag close-up, stitching or joinery close-up, hardware / fastener / connector close-up. All panels show identical product features — different framings of ONE product, never variants.`;
    const compositePrompt = [layoutBlock, "", productFacts, "", PRODUCT_BASE_PROMPT, directionExtra].join(" ").trim();
    const finalPrompt = `${refBlock}\n\n${PRODUCT_FIDELITY_RULES}\n\n${compositePrompt}`;
    const job = await createImageEdit(refUrls, finalPrompt, "1:1", "2K");
    const result = await pollImageGen(job.request_id);
    if (result.status === "failed") throw new Error(result.error || "Image generation failed");
    return {
      result: {
        // Compat: dejamos `url` (formato viejo) para que UI legacy siga funcionando,
        // y también `views[]` con una sola entrada para el nuevo render multi-vista.
        url: result.image_url,
        views: [{ key: "details", label: "Detalles", url: result.image_url, aspectRatio: "1:1", prompt: compositePrompt }],
        brief,
        mode: "details" as const,
        sourceProductId: brief.sourceProductId,
        prompt: compositePrompt,
      },
      needsApproval: true,
    };
  }

  // ── SHEET MODE: generate ONE image per selected view ────────────────────
  //
  // Filosofía (inspirada en el recipe del usuario): cada vista = base_prompt común
  // + composition específico + aspect ratio óptimo. Nano Banana se enfoca en una
  // sola vista por imagen, sale más fiel y limpia que un composite con 6 vistas.
  const requestedViews = (cfg.productSheetViews as string[]) || DEFAULT_PRODUCT_VIEWS;
  const validViews = requestedViews.filter((k) => PRODUCT_VIEW_CATALOG[k]);
  const selectedViews = validViews.length > 0 ? validViews : DEFAULT_PRODUCT_VIEWS;

  type ViewResult = { key: string; label: string; url: string; aspectRatio: string; prompt: string; error?: string };
  const views: ViewResult[] = [];

  for (const viewKey of selectedViews) {
    const viewMeta = PRODUCT_VIEW_CATALOG[viewKey];
    const viewPrompt = [
      PRODUCT_BASE_PROMPT,
      "",
      `VIEW SPECIFIC: ${viewMeta.composition}`,
      "",
      productFacts,
      directionExtra,
    ].join(" ").trim();
    const finalPrompt = `${refBlock}\n\n${PRODUCT_FIDELITY_RULES}\n\n${viewPrompt}`;

    try {
      const job = await createImageEdit(refUrls, finalPrompt, viewMeta.aspectRatio, "2K");
      const result = await pollImageGen(job.request_id);
      if (result.status === "failed" || !result.image_url) {
        views.push({ key: viewKey, label: viewMeta.label, url: "", aspectRatio: viewMeta.aspectRatio, prompt: viewPrompt, error: result.error || "generation failed" });
      } else {
        views.push({ key: viewKey, label: viewMeta.label, url: result.image_url, aspectRatio: viewMeta.aspectRatio, prompt: viewPrompt });
      }
    } catch (e) {
      views.push({ key: viewKey, label: viewMeta.label, url: "", aspectRatio: viewMeta.aspectRatio, prompt: viewPrompt, error: e instanceof Error ? e.message : "failed" });
    }
  }

  const firstOk = views.find((v) => v.url);
  if (!firstOk) {
    throw new Error("Todas las vistas fallaron al generar. Revisá las imágenes de referencia y el brief.");
  }

  return {
    result: {
      // Backwards compat: `url` apunta a la primera vista exitosa para que el UI
      // legacy (que solo lee `url`) muestre algo. Multi-view UI lee `views[]`.
      url: firstOk.url,
      views,
      brief,
      mode: "sheet" as const,
      sourceProductId: brief.sourceProductId,
      prompt: views[0]?.prompt || "",
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
    views?: Array<{ key: string; label: string; url: string; aspectRatio: string }>;
    brief: ProductSheetBrief;
    mode: "sheet" | "details";
    sourceProductId?: string;
  } | undefined;
  if (!generateResult?.url) throw new Error("No hay imagen generada para guardar.");

  const brief = generateResult.brief;
  const modeSuffix = generateResult.mode === "details" ? "Detalles" : "Sheet";
  const productName = `${brief.name || "Producto"} (${modeSuffix})`;

  // Selección de vistas a guardar — todas las exitosas del views[] (o si es legacy
  // sin views[], usa solo `url`). La PRIMERA vista exitosa va como main; el resto
  // como extras del producto generado.
  const allViews = (generateResult.views || []).filter((v) => v.url);
  const viewsToSave = allViews.length > 0
    ? allViews
    : [{ key: "main", label: "Main", url: generateResult.url, aspectRatio: "1:1" }];

  const saveMode = (cfg.productSheetSave as "new" | "replace" | "asset") || "new";

  // "asset" mode: we don't touch the catalog — just return the URLs so the user
  // can download them manually or pick them up from the content library.
  if (saveMode === "asset") {
    return {
      result: {
        imageUrl: generateResult.url,
        views: viewsToSave,
        name: productName,
        brief,
        savedTo: "asset",
      },
    };
  }

  // Build a concise description from the structured brief.
  const description = [
    brief.summary,
    brief.materials?.length && `Materials: ${brief.materials.join(", ")}.`,
    brief.colors?.length && `Colors: ${brief.colors.join("; ")}.`,
    brief.distinctive_details?.length && `Details: ${brief.distinctive_details.join("; ")}.`,
  ].filter(Boolean).join(" ");

  // Helper para convertir una URL de view → File listo para upload.
  const fetchAsFile = async (url: string, name: string): Promise<File> => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`No se pudo descargar la vista ${name}`);
    const blob = await r.blob();
    const filename = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}.png`;
    return new File([blob], filename, { type: blob.type || "image/png" });
  };

  // Primera vista = main del producto generado
  const mainFile = await fetchAsFile(viewsToSave[0].url, `${productName}_${viewsToSave[0].label}`);
  const saved = await uploadProduct(activeBrand.id, productName, mainFile, description);

  // Resto de las vistas se agregan como extras (max 10 total — el cap del backend).
  // Si una falla, no rompe el save general (la vista 1 ya está persistida).
  const { addProductImage } = await import("../../lib/api");
  for (let i = 1; i < viewsToSave.length && i < 10; i++) {
    const v = viewsToSave[i];
    try {
      const extraFile = await fetchAsFile(v.url, `${productName}_${v.label}`);
      await addProductImage(activeBrand.id, saved.id, extraFile, v.label);
    } catch (e) {
      console.warn(`[product_sheet] failed to attach view "${v.label}":`, e);
    }
  }

  return {
    result: {
      product: saved,
      imageUrl: generateResult.url,
      views: viewsToSave,
      name: productName,
      brief,
      savedTo: saveMode,
    },
  };
};
