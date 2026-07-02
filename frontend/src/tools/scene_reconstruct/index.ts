/**
 * Scene Reconstruct — Tool Definition
 * ───────────────────────────────────
 * Reconstruye una escena foto-real a partir de UNA imagen original (de la que saca
 * composición + luz) + N assets reales (ej. un auto). Encadena internamente el método
 * de reconstrucción para que el usuario solo suba inputs y dé Generar:
 *
 *   Fase 1 — Sketch: convierte la original en un boceto B&N de composición (estructura).
 *   Fase 2 — Luz: Gemini interpreta luz/color/mood de la original (limpio, dedicado).
 *   Fase 3 — Render: foto-real siguiendo la composición del sketch, con los assets reales
 *            y la luz interpretada.
 *
 * Pipeline: generate_all (single step).
 */

import type { ToolDefinition, StepHandler } from "../types";
import { createImageEdit, pollImageGen, describeSceneLighting } from "../../lib/api";

const SKETCH_PROMPT =
  "Convert this image into a rough BLACK-AND-WHITE pencil composition sketch: keep its exact layout, camera angle, placement of every element, perspective, depth and light direction — but render it as clean, loose pencil lines on white paper. NO color, NO photographic detail, NO textures. A concept/structure study.";

const NO_TEXT = " Single clean photograph. No text, no watermark, no logo overlay, no graphics.";

const handleGenerate: StepHandler = async (ctx) => {
  const { config, activeBrand } = ctx;
  const cfg = config as unknown as Record<string, unknown>;

  const original = (cfg.sceneOriginal as string) || "";
  const uploaded = ((cfg.sceneAssets as string[]) || []).filter(Boolean);
  // Assets de marca elegidos por id → resolvemos a su imageUrl cruda (el backend la
  // sube a Fal, igual que ecommerce_pack). Van primero para priorizar el producto real.
  const brandIds = ((cfg.sceneBrandAssetIds as string[]) || []);
  const brandUrls: string[] = [];
  for (const id of brandIds) {
    const p = activeBrand?.products?.find((x) => x.id === id);
    if (p?.imageUrl) { brandUrls.push(p.imageUrl); continue; }
    const c = activeBrand?.clothing?.find((x) => x.id === id);
    if (c?.imageUrl) brandUrls.push(c.imageUrl);
  }
  const assets = [...brandUrls, ...uploaded];
  const extraDirection = (config.objective || "").trim();

  if (!original) throw new Error("Subí la imagen ORIGINAL de la escena (de ahí salen composición y luz).");
  if (assets.length === 0) throw new Error("Subí al menos un ASSET real (ej. el auto) para poner en la escena.");

  const ar = config.aspectRatio || "4:5";
  const res = config.resolution || "2K";

  const images: Array<{ id: string; url: string; label: string; prompt: string; status: string }> = [];

  // ── Fase 1 — Sketch (composición) ──────────────────────────────────────
  let sketchUrl = "";
  try {
    const job = await createImageEdit([original], SKETCH_PROMPT, ar, res);
    const r = await pollImageGen(job.request_id);
    sketchUrl = r.image_url || "";
    if (sketchUrl) images.push({ id: "sketch", url: sketchUrl, label: "① Sketch · composición", prompt: SKETCH_PROMPT, status: "done" });
  } catch (e) {
    console.error("[scene_reconstruct] sketch failed:", e);
  }

  // ── Fase 2 — Luz (interpretada de la original, limpia) ──────────────────
  let lighting = "";
  try {
    lighting = ((await describeSceneLighting(original)).description || "").trim();
  } catch (e) {
    console.error("[scene_reconstruct] lighting extract failed:", e);
  }

  // ── Fase 3 — Render foto-real ───────────────────────────────────────────
  // Ancla de composición: el sketch si salió, si no la original directa.
  const compAnchor = sketchUrl || original;
  const renderRefs = [compAnchor, ...assets];
  const lightingLine = lighting
    ? `LIGHTING & COLOR (match this exactly, interpreted from the original scene): ${lighting}`
    : "LIGHTING & COLOR: reproduce the exact lighting, color palette and mood of the original scene faithfully.";
  const directionLine = extraDirection ? `\nAdditional direction: ${extraDirection}` : "";

  const renderPrompt =
    `Output: a finished PHOTOREALISTIC image that follows the EXACT composition of image 1 — the same layout, camera angle, framing, placement of every element, perspective, depth and direction of light. ` +
    `Image 1 is a rough SKETCH / structural guide: do NOT reproduce its pencil lines, its flatness or its lack of detail. Render a real, fully-detailed photographic image on that structure.\n` +
    `Take the actual subjects / products (their exact identity, shape, color, materials and details) from the OTHER reference images (image 2 onward) and place them exactly where image 1 indicates. Keep each product photographically identical to its reference.\n` +
    `${lightingLine}${directionLine}\n` +
    `Lock the composition of image 1 — change ONLY the rendering, making it photoreal, sharp and high-end. Avoid a 3D/CGI look.${NO_TEXT}`;

  try {
    const job = await createImageEdit(renderRefs, renderPrompt, ar, res);
    const r = await pollImageGen(job.request_id);
    const finalUrl = r.image_url || "";
    images.push({ id: "render", url: finalUrl, label: "② Reconstrucción", prompt: renderPrompt, status: finalUrl ? "done" : "failed" });
  } catch (e) {
    images.push({ id: "render", url: "", label: "② Reconstrucción", prompt: renderPrompt, status: "failed" });
    console.error("[scene_reconstruct] render failed:", e);
  }

  const successful = images.filter((im) => im.url).length;
  return {
    result: { images, successful, total: images.length },
    needsApproval: false,
  };
};

export const sceneReconstruct: ToolDefinition = {
  schema: {
    showAvatar: false,
    showProduct: false,
    showClothing: false,
    showBackground: false,
    showMoodboard: false,
    showReference: false,
    showVoice: false,
    showTone: false,
    showPlatform: false,
    showLanguage: false,
    showVariations: false,
    objectiveLabel: "Dirección extra (opcional)",
    objectivePlaceholder: "Opcional: algún ajuste de luz/color/mood que quieras forzar…",
    showNotes: false,
  },
  stepHandlers: {
    generate_all: handleGenerate,
  },
  approvalSteps: [],
  autoRunSteps: [],
};
