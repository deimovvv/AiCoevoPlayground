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
  /** Gemini auto-classification de cada foto input. Array en el ORDEN en que se
   *  enviaron al backend (product photos del Brand Kit primero, luego uploads).
   *  Lo usamos en handleGenerate para etiquetar cada ref con su vista específica:
   *  "Image 3 is the BACK view — use this for the back panel of the composite". */
  photo_views?: Array<{ index: number; view: string; confidence?: number; notes?: string }>;
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

  // Gemini classifies each input photo via brief.photo_views (mapping foto → view).
  // El index en photo_views matchea el ORDEN en que las fotos viajaron al backend:
  // primero las del Brand Kit (main + extras), después las uploaded.
  const photoViews = brief.photo_views || [];
  const viewForPhoto = (idx: number): { view?: string; confidence?: number } => {
    const pv = photoViews.find((p) => p.index === idx);
    return pv ? { view: pv.view, confidence: pv.confidence } : {};
  };
  // Convierte el label de view de Gemini a un texto descriptivo human-readable que
  // Nano Banana entienda como "esta foto es la fuente canónica de ESTA vista".
  const viewToHumanReadable = (view?: string): string => {
    if (!view) return "";
    const map: Record<string, string> = {
      front: "FRONT view (0°)",
      back: "BACK view (180°)",
      side: "SIDE profile (90°)",
      "3-4": "THREE-QUARTER front angle",
      "rear-3-4": "THREE-QUARTER rear angle",
      top: "TOP-DOWN view (cenital)",
      interior: "INTERIOR view",
      detail: "macro DETAIL close-up",
      hero: "composite hero shot",
      other: "additional view",
    };
    return map[view] || view.toUpperCase();
  };

  // Track de qué view ya tenemos cubierta por foto canonical — usado para decir a
  // Nano Banana "para la vista X, usá EXACTAMENTE Image N como source".
  const photoIndexByView: Record<string, number> = {}; // view → imgIdx (1-based)
  let photoCounter = 0; // 0-based input index para matching con photo_views

  // 1) Source product photos (if a Brand Kit product was selected) — these are the
  //    strongest identity anchors.
  const product = (activeBrand.products || []).find((p) => p.id === brief.sourceProductId);
  if (product) {
    type Photo = { url: string };
    const photos: Photo[] = [];
    if (product.imageUrl) photos.push({ url: product.imageUrl });
    for (const extra of product.images || []) {
      if (extra.imageUrl) photos.push({ url: extra.imageUrl });
    }
    for (const p of photos.slice(0, MAX_REFS)) {
      const full = p.url.startsWith("http") ? p.url : productImageUrl(p.url);
      refUrls.push(full);
      const cls = viewForPhoto(photoCounter);
      const viewHR = viewToHumanReadable(cls.view);
      const confTag = cls.confidence !== undefined ? ` (Gemini confidence: ${Math.round(cls.confidence * 100)}%)` : "";
      if (cls.view && cls.view !== "other") {
        // Etiquetado por Gemini → instrucción explícita de uso canónico
        if (!photoIndexByView[cls.view]) photoIndexByView[cls.view] = imgIdx;
        refDescriptions.push(
          `Image ${imgIdx}: CANONICAL ${viewHR} of the product${confTag}. USE THIS EXACT image as the source for the ${cls.view} panel in the output composite. Do NOT alter or invent the ${cls.view}. Reproduce identical color, materials, finish, hardware and proportions.`,
        );
      } else {
        refDescriptions.push(
          `Image ${imgIdx}: photo of the EXACT product to render. Reproduce identical color, materials, finish, hardware and proportions. Source of truth — never invent angles or details not visible across the reference photos.`,
        );
      }
      imgIdx++;
      photoCounter++;
    }
  }

  // 2) Uploaded reference photos — Gemini también las clasificó por orden.
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
    const cls = viewForPhoto(photoCounter);
    const viewHR = viewToHumanReadable(cls.view);
    const confTag = cls.confidence !== undefined ? ` (Gemini confidence: ${Math.round(cls.confidence * 100)}%)` : "";
    if (cls.view && cls.view !== "other") {
      if (!photoIndexByView[cls.view]) photoIndexByView[cls.view] = imgIdx;
      refDescriptions.push(
        `Image ${imgIdx}: CANONICAL ${viewHR} of the product${confTag}. USE THIS EXACT image as the source for the ${cls.view} panel in the output composite. Do NOT alter or invent the ${cls.view}.`,
      );
    } else {
      refDescriptions.push(
        `Image ${imgIdx}: additional photo of the SAME product (different angle / detail). Identity must match Image 1 exactly — same color, materials, finish.`,
      );
    }
    imgIdx++;
    photoCounter++;
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

  // ── SHEET MODE: COMPOSITE de TODAS las vistas en UNA imagen ──────────────
  //
  // Filosofía corregida: Product Sheet es CONTEXTO de marca para otras tools,
  // no output final. Necesita UNA imagen integral con múltiples vistas (estilo
  // ortographic projection sheet de fabricantes de autos) para que el usuario
  // pueda alimentarla como ref en Fashion Reel, Ecommerce Pack, etc.
  //
  // El usuario reportó: "me generó solamente una vista y debería verse algo
  // más integral... tiene que ser una foto con múltiples vistas como composite".
  //
  // Internamente seguimos usando el catálogo de vistas tildables (hero_34, side,
  // front, back, top) — el usuario elige cuáles entran al composite. Layout
  // adaptativo según la cantidad.
  const requestedViews = (cfg.productSheetViews as string[]) || DEFAULT_PRODUCT_VIEWS;
  const validViews = requestedViews.filter((k) => PRODUCT_VIEW_CATALOG[k]);
  const selectedViewKeys = validViews.length > 0 ? validViews : DEFAULT_PRODUCT_VIEWS;
  const selectedViews = selectedViewKeys.map((k) => ({ key: k, ...PRODUCT_VIEW_CATALOG[k] }));

  // Aspect ratio: RESPETAR el del usuario (config.aspectRatio del select de
  // Ajustes técnicos). Si no eligió uno, fallback al adaptativo según cantidad.
  // El usuario reportó: "le pedí 16:9 pero me hizo 1:1" — mi código lo pisaba.
  const userAR = (config.aspectRatio as "16:9" | "1:1" | "4:3" | "9:16") || "";
  const n = selectedViews.length;
  let canvasAR: "16:9" | "1:1" | "4:3" | "9:16" = userAR
    || (n === 4 ? "1:1" : "16:9");

  // Layout del grid se adapta a (cantidad de vistas, AR elegido). Para 9:16
  // vertical apilamos en columna; para horizontal usamos filas según count.
  const viewList = selectedViews.map((v, i) => `(${i + 1}) ${v.label}: ${v.composition}`).join("\n  ");
  let gridDesc = "";
  if (canvasAR === "9:16") {
    gridDesc = `${n}×1 VERTICAL STACK (views from top to bottom)`;
  } else if (n === 1) {
    gridDesc = "single view filling the frame";
  } else if (n === 2) {
    gridDesc = "1×2 grid (views side by side)";
  } else if (n === 3) {
    gridDesc = "1×3 grid (views in a single row, left-to-right)";
  } else if (n === 4) {
    gridDesc = canvasAR === "1:1" ? "2×2 grid (top row two views, bottom row two views)" : "1×4 grid (all in single row)";
  } else {
    gridDesc = "2×3 grid (top row first 3 views, bottom row remaining views)";
  }

  // Mapping explícito vista del catálogo → Image canónica. El catálogo usa keys
  // como hero_34/side/front/back/top. Las photo_views de Gemini usan front/side/
  // back/top/3-4/etc. Hacemos un mapeo permisivo: hero_34 acepta "3-4", "front" o
  // "rear-3-4"; side acepta "side"; front acepta "front"; back acepta "back";
  // top acepta "top". Si la vista NO tiene foto, se le dice a Nano Banana que
  // infiera MÍNIMAMENTE desde las que sí están.
  const viewKeyToPhotoCanonical = (catKey: string): string[] => {
    const map: Record<string, string[]> = {
      hero_34: ["3-4", "rear-3-4", "front"],
      side: ["side"],
      front: ["front"],
      back: ["back"],
      top: ["top"],
    };
    return map[catKey] || [];
  };

  const viewToImageMapping: string[] = [];
  const missingViews: string[] = [];
  for (const v of selectedViews) {
    const acceptedPhotoLabels = viewKeyToPhotoCanonical(v.key);
    const matchedPhotoIdx = acceptedPhotoLabels
      .map((label) => photoIndexByView[label])
      .find((idx) => idx !== undefined);
    if (matchedPhotoIdx !== undefined) {
      viewToImageMapping.push(`  • For the "${v.label}" panel → USE Image ${matchedPhotoIdx} as the canonical source. Reproduce it faithfully without altering color, body shape, lights, badging, or proportions.`);
    } else {
      missingViews.push(v.label);
      viewToImageMapping.push(`  • For the "${v.label}" panel → NO canonical photo provided. Infer MINIMALLY from the available reference images (especially Images of the same product). Keep color, materials, proportions identical to the references. Do NOT invent decorative details, badges, or features that aren't visible somewhere in the references.`);
    }
  }

  const missingWarning = missingViews.length > 0
    ? `\n\nNOTE: ${missingViews.length} view(s) without canonical photos: ${missingViews.join(", ")}. For these, infer minimally — never invent features.`
    : "";

  let layoutDesc = `Layout: a single composite image with ${n} view(s) of the SAME product arranged in a ${gridDesc} on a pure white (#FFFFFF) seamless cyclorama background, evenly spaced. Views in order:\n  ${viewList}\n\nVIEW-TO-IMAGE MAPPING (CRITICAL):\n${viewToImageMapping.join("\n")}${missingWarning}\n\nALL views in the composite must show identical product features (same color, materials, finish, hardware, logo, proportions) — they are different angles of ONE product, never variants. No borders, no grid lines, no text, no labels between views — only clean white space separates them.`;

  const compositePrompt = [
    layoutDesc,
    "",
    productFacts,
    "",
    PRODUCT_BASE_PROMPT,
    directionExtra,
  ].join(" ").trim();
  const finalPrompt = `${refBlock}\n\n${PRODUCT_FIDELITY_RULES}\n\n${compositePrompt}`;

  const job = await createImageEdit(refUrls, finalPrompt, canvasAR, "2K");
  const result = await pollImageGen(job.request_id);
  if (result.status === "failed" || !result.image_url) {
    throw new Error(result.error || "Image generation failed");
  }

  return {
    result: {
      url: result.image_url,
      // Compat con UI multi-view: 1 sola entrada con el composite. La galería
      // muestra una sola tile grande con la composite — sigue funcionando.
      views: [{ key: "composite", label: `Sheet integral (${n} vistas)`, url: result.image_url, aspectRatio: canvasAR, prompt: compositePrompt }],
      brief,
      mode: "sheet" as const,
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
