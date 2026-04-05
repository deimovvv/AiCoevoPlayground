/**
 * Product Clip — Step Handlers
 * ──────────────────────────────
 * Pipeline: script → base_image → images → animate → render
 * Short product video (10-15s), no people, product-only.
 */

import type { StepHandler } from "../types";
import {
  generateToolPrompt, createImageEdit, pollImageGen,
  concatVideos, saveGeneration,
} from "../../lib/api";

const API_BASE = "http://localhost:8000";

// ── Script — generate 3-4 frame storyboard ──────────────

export const handleScript: StepHandler = async (ctx) => {
  const { activeBrand, config, tool } = ctx;
  const selectedProduct = (activeBrand.products || []).find((p) => p.id === config.selectedProductId);

  const numScenes = config.numVariations || 3;
  const extraVars: Record<string, string> = {
    num_scenes: String(numScenes),
    language: config.language || "es",
  };

  if (selectedProduct?.description) extraVars.product_description = selectedProduct.description;
  if (config.objective) extraVars.creative_direction = config.objective;

  let userMsg = `Generate a ${numScenes}-frame product clip storyboard.`;
  if (selectedProduct) userMsg += `\nProduct: ${selectedProduct.name}`;
  if (config.objective) userMsg += `\nDirection: ${config.objective}`;

  const { result } = await generateToolPrompt(activeBrand.id, "product_clip", userMsg, extraVars);

  // Parse
  const findArray = (obj: unknown): Array<Record<string, unknown>> => {
    if (Array.isArray(obj)) return obj;
    if (typeof obj === "object" && obj !== null) {
      for (const val of Object.values(obj as Record<string, unknown>)) {
        if (Array.isArray(val)) return val;
      }
    }
    return [];
  };

  const rawFrames = findArray(result);
  const frames = rawFrames
    .map((f, i) => ({
      frame: Number(f.frame || f.scene || f.number) || i + 1,
      prompt: String(f.prompt || f.image_prompt || f.description || ""),
      camera: String(f.camera || f.angle || ""),
      transition: String(f.transition || f.movement || "fade"),
    }))
    .filter((f) => f.prompt.length > 5);

  if (frames.length === 0) throw new Error(`No frames generated. Result: ${JSON.stringify(result)?.slice(0, 200)}`);

  return { result: { frames, numScenes }, needsApproval: true };
};

// ── Base Image — generate frame 1 with product + reference ──

export const handleBaseImage: StepHandler = async (ctx) => {
  const { activeBrand, config, getStepResult } = ctx;
  const scriptData = getStepResult("script") as { frames: Array<{ prompt: string }> } | undefined;
  if (!scriptData?.frames?.[0]) throw new Error("No storyboard found.");

  const selectedProduct = (activeBrand.products || []).find((p) => p.id === config.selectedProductId);

  // References: style reference + product
  const imageUrls: string[] = [];

  // Reference image from form
  const refFiles = (config as { referenceImages?: File[] }).referenceImages || [];
  for (const file of refFiles.slice(0, 1)) {
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    imageUrls.push(dataUrl);
  }

  if (selectedProduct?.imageUrl) imageUrls.push(selectedProduct.imageUrl);

  const job = await createImageEdit(imageUrls, scriptData.frames[0].prompt, config.aspectRatio, config.resolution);
  const result = await pollImageGen(job.request_id);
  if (result.status === "failed") throw new Error(result.error || "Image generation failed");

  return {
    result: { url: result.image_url, prompt: scriptData.frames[0].prompt, frame: 1 },
    needsApproval: true,
  };
};

// ── Images — generate remaining frames from base ────────

export const handleImages: StepHandler = async (ctx) => {
  const { config, getStepResult, activeBrand } = ctx;
  const scriptData = getStepResult("script") as { frames: Array<{ prompt: string; frame: number; camera: string }> } | undefined;
  if (!scriptData?.frames) throw new Error("No storyboard found.");

  const baseImage = getStepResult("base_image") as { url: string } | undefined;
  if (!baseImage?.url) throw new Error("No base image found.");

  const remainingFrames = scriptData.frames.slice(1);

  // Sequential generation for consistency
  const generatedImages: Array<{ frame: number; url: string; prompt: string; status: string }> = [];
  let previousUrl = baseImage.url;

  for (const frame of remainingFrames) {
    try {
      const prompt = `Same product, same style, same lighting as image 1. Smooth transition from previous frame. ${frame.prompt}`;
      const job = await createImageEdit([previousUrl, baseImage.url], prompt, config.aspectRatio, config.resolution);
      const result = await pollImageGen(job.request_id);
      const url = result.image_url || "";
      if (url) previousUrl = url;
      generatedImages.push({ frame: frame.frame, url, prompt: frame.prompt, status: url ? "done" : "failed" });
    } catch {
      generatedImages.push({ frame: frame.frame, url: "", prompt: frame.prompt, status: "failed" });
    }
  }

  const allFrames = [
    { frame: 1, url: baseImage.url, prompt: scriptData.frames[0].prompt, status: "done" },
    ...generatedImages,
  ];

  return { result: { images: allFrames }, needsApproval: true };
};

// ── Animate — Kling frame-to-frame ──────────────────────

export const handleAnimate: StepHandler = async (ctx) => {
  const { config, getStepResult } = ctx;
  const imageData = getStepResult("images") as { images: Array<{ frame: number; url: string }> } | undefined;
  if (!imageData?.images) throw new Error("No images found.");

  const successfulImages = imageData.images.filter((img) => img.url).sort((a, b) => a.frame - b.frame);
  if (successfulImages.length < 2) throw new Error("Need at least 2 images to animate.");

  const { pollKlingVideo, createKlingVideo } = await import("../../lib/api");
  const isFrameToFrame = config.animationMode !== "image-to-video";

  const segments = [];

  if (isFrameToFrame) {
    // Frame-to-frame: smooth transitions between consecutive frames
    for (let i = 0; i < successfulImages.length - 1; i++) {
      const startImg = successfulImages[i];
      const endImg = successfulImages[i + 1];
      try {
        const res = await fetch(`${API_BASE}/api/kling/frame-to-frame`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            start_image_url: startImg.url,
            end_image_url: endImg.url,
            prompt: "Smooth cinematic product transition, elegant camera movement, no people",
            duration: "4",
            aspect_ratio: config.aspectRatio,
          }),
        });
        if (!res.ok) throw new Error("Kling failed");
        const { request_id } = await res.json();
        const result = await pollKlingVideo(request_id);
        segments.push({ index: i, videoUrl: result.video_url || "", startFrame: startImg.frame, endFrame: endImg.frame, status: result.video_url ? "done" : "failed" });
      } catch {
        segments.push({ index: i, videoUrl: "", startFrame: startImg.frame, endFrame: endImg.frame, status: "failed" });
      }
    }
  } else {
    // Image-to-video: each frame animated independently (cut transitions)
    for (let i = 0; i < successfulImages.length; i++) {
      const img = successfulImages[i];
      try {
        const job = await createKlingVideo(img.url, "Subtle cinematic product movement, elegant rotation or zoom, no people", "4");
        const result = await pollKlingVideo(job.request_id);
        segments.push({ index: i, videoUrl: result.video_url || "", startFrame: img.frame, endFrame: img.frame, status: result.video_url ? "done" : "failed" });
      } catch {
        segments.push({ index: i, videoUrl: "", startFrame: img.frame, endFrame: img.frame, status: "failed" });
      }
    }
  }

  return { result: { segments }, needsApproval: true };
};

// ── Render — concat segments ────────────────────────────

export const handleRender: StepHandler = async (ctx) => {
  const { activeBrand, config, getStepResult, tool } = ctx;
  const animateData = getStepResult("animate") as { segments: Array<{ videoUrl: string }> } | undefined;
  if (!animateData?.segments) throw new Error("No animated segments.");

  const videoUrls = animateData.segments.filter((s) => s.videoUrl).map((s) => s.videoUrl);
  if (videoUrls.length === 0) throw new Error("No video segments.");

  const result = await concatVideos(videoUrls, undefined, false);

  const selectedProduct = (activeBrand.products || []).find((p) => p.id === config.selectedProductId);
  try {
    await saveGeneration({
      brandId: activeBrand.id,
      toolId: tool.id,
      title: `Product Clip — ${selectedProduct?.name || "Product"} — ${new Date().toLocaleDateString()}`,
      type: "video",
      status: "completed",
      outputUrl: result.video_url,
      metadata: { duration: result.duration, numSegments: result.num_segments },
    });
  } catch { /* silent */ }

  return {
    result: {
      videoUrl: result.video_url,
      totalDuration: `${result.duration}s`,
      scenes: result.num_segments,
      format: "MP4 / H.264",
    },
  };
};
