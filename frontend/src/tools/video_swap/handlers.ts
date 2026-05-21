/**
 * Video Swap — Step Handler
 * ───────────────────────────
 * Single step: take the user's SOURCE VIDEO + a reference image (the new look)
 * and run Beeble SwitchX to swap the targeted element while keeping subject/motion.
 * The reference image can be an uploaded file OR a brand product/clothing image.
 */

import type { StepHandler } from "../types";
import { createVideoSwap, pollVideoSwap, productImageUrl, clothingImageUrl } from "../../lib/api";

// Resolve a brand asset URL → File (fetch the image so we can upload it to Beeble).
async function urlToFile(url: string, name: string): Promise<File | null> {
  try {
    const full = url.startsWith("http") ? url : `http://localhost:8000${url}`;
    const res = await fetch(full);
    const blob = await res.blob();
    return new File([blob], name, { type: blob.type || "image/png" });
  } catch {
    return null;
  }
}

export const handleSwap: StepHandler = async (ctx) => {
  const { activeBrand, config } = ctx;
  const cfg = config as unknown as Record<string, unknown>;

  const sourceVideo = (cfg.sourceVideo as File[] | undefined)?.[0];
  if (!sourceVideo) throw new Error("Subí el video fuente (tu propio video) para hacer el swap.");

  const alphaMode = (cfg.alphaMode as "auto" | "select" | "fill" | "custom") || "auto";

  // Reference image (the new look): uploaded file first, else a selected brand
  // product, else a selected clothing item.
  let referenceImage: File | null = (cfg.referenceImages as File[] | undefined)?.[0] || null;
  if (!referenceImage && config.selectedProductId) {
    const p = (activeBrand.products || []).find((x) => x.id === config.selectedProductId);
    if (p?.imageUrl) referenceImage = await urlToFile(productImageUrl(p.imageUrl), `${p.name}.png`);
  }
  if (!referenceImage && config.selectedClothingIds?.length) {
    const c = (activeBrand.clothing || []).find((x) => config.selectedClothingIds.includes(x.id));
    if (c?.imageUrl) referenceImage = await urlToFile(clothingImageUrl(c.imageUrl), `${c.name}.png`);
  }

  // Custom mask (only for alpha_mode === "custom") — read from poseReference slot reuse? No:
  // a dedicated mask isn't part of the simple flow; "custom" expects the user to upload one.
  // For now we don't surface a mask uploader — auto/select/fill cover the common cases.

  const job = await createVideoSwap({
    sourceVideo,
    alphaMode,
    prompt: config.objective || undefined,
    referenceImage,
  });

  const result = job.video_url
    ? { status: "completed", video_url: job.video_url }
    : await pollVideoSwap(job.job_id);

  if (result.status === "failed" || !result.video_url) {
    throw new Error(result.error || "El video swap falló.");
  }

  return {
    result: { url: result.video_url, type: "video" },
    needsApproval: true,
  };
};
