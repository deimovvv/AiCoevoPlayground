/**
 * Content Analyzer — Step Handlers
 * ──────────────────────────────────
 * Pipeline: analyze → adapt → generate_batch
 */

import type { StepHandler } from "../types";
import { generateToolPrompt, createImageEdit, pollImageGen, saveGeneration } from "../../lib/api";

const API_BASE = "http://localhost:8000";

// ── Analyze — download + extract frames + Gemini Vision ──

export const handleAnalyze: StepHandler = async (ctx) => {
  const { activeBrand, config } = ctx;

  const videoUrl = config.objective?.trim() || "";
  const videoFiles = (config as { referenceImages?: File[] }).referenceImages || [];
  const videoFile = videoFiles[0];

  if (!videoUrl && !videoFile) throw new Error("Enter a video URL or upload a video file.");

  const formData = new FormData();
  if (videoFile) {
    formData.append("video", videoFile);
  }
  if (videoUrl) {
    formData.append("url", videoUrl);
  }
  formData.append("brand_context", activeBrand.brandContext || "");

  const res = await fetch(`${API_BASE}/api/analyze/video`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || "Video analysis failed");
  }

  const data = await res.json();

  return {
    result: {
      analysis: data.analysis,
      videoDuration: data.video_duration,
      numFrames: data.num_frames,
      sourceUrl: videoUrl,
    },
    needsApproval: true,
  };
};

// ── Adapt — use analysis to create content for YOUR brand ──

export const handleAdapt: StepHandler = async (ctx) => {
  const { activeBrand, config, getStepResult, tool } = ctx;

  const analyzeData = getStepResult("analyze") as { analysis: Record<string, unknown> } | undefined;
  if (!analyzeData?.analysis) throw new Error("No analysis found.");

  const selectedAvatars = (config.selectedAvatarIds?.length)
    ? (activeBrand.avatars || []).filter((a) => config.selectedAvatarIds.includes(a.id))
    : config.selectedAvatarId ? [activeBrand.avatars?.find((a) => a.id === config.selectedAvatarId)].filter(Boolean) : [];
  const selectedProducts = (config.selectedProductIds?.length)
    ? (activeBrand.products || []).filter((p) => config.selectedProductIds.includes(p.id))
    : config.selectedProductId ? [(activeBrand.products || []).find((p) => p.id === config.selectedProductId)].filter(Boolean) : [];
  const selectedClothing = (activeBrand.clothing || []).filter((c) => config.selectedClothingIds.includes(c.id));

  const extraVars: Record<string, string> = {
    video_analysis: JSON.stringify(analyzeData.analysis),
    language: config.language || "es",
  };
  if (config.objective) extraVars.creative_direction = config.objective;

  let userMsg = "Adapt this video content for my brand. Respond with ONLY a JSON object.";
  if (selectedProducts.length > 0) userMsg += `\nMy products: ${selectedProducts.map((p) => p?.name).join(", ")}`;
  if (selectedAvatars.length > 0) userMsg += `\nMy characters: ${selectedAvatars.map((a) => `${a?.name}${a?.description ? ` (${a.description})` : ""}`).join(", ")}`;
  if (selectedClothing.length > 0) userMsg += `\nGarments: ${selectedClothing.map((c) => c.name).join(", ")}`;

  const { result } = await generateToolPrompt(activeBrand.id, "content_analyzer", userMsg, extraVars);

  // Parse
  let parsed = result as Record<string, unknown>;
  if (typeof result === "string") {
    try { parsed = JSON.parse(result as string); } catch { /* */ }
  }

  // Find scenes array
  let scenes: Array<Record<string, string>> = [];
  if (Array.isArray(parsed.scenes)) {
    scenes = parsed.scenes as Array<Record<string, string>>;
  } else {
    for (const val of Object.values(parsed)) {
      if (Array.isArray(val)) { scenes = val; break; }
    }
  }

  return {
    result: {
      adaptedScript: String(parsed.adapted_script || parsed.script || ""),
      scenes: scenes.map((s, i) => ({
        frame: Number(s.frame) || i + 1,
        script: String(s.script || s.voiceover || s.text || ""),
        imagePrompt: String(s.image_prompt || s.prompt || ""),
        sceneType: String(s.scene_type || s.type || "story"),
      })),
      styleNotes: String(parsed.style_notes || parsed.style || ""),
    },
    needsApproval: true,
  };
};

// ── Generate Batch — create images from adapted prompts ──

export const handleGenerateBatch: StepHandler = async (ctx) => {
  const { activeBrand, config, getStepResult, tool } = ctx;

  const adaptData = getStepResult("adapt") as {
    scenes: Array<{ frame: number; imagePrompt: string; script: string; sceneType: string }>;
  } | undefined;
  if (!adaptData?.scenes?.length) throw new Error("No adapted scenes found.");

  // Multi-select: use arrays if available, fallback to single
  const selectedAvatars = (config.selectedAvatarIds?.length)
    ? (activeBrand.avatars || []).filter((a) => config.selectedAvatarIds.includes(a.id))
    : config.selectedAvatarId ? [activeBrand.avatars?.find((a) => a.id === config.selectedAvatarId)].filter(Boolean) : [];
  const selectedProducts = (config.selectedProductIds?.length)
    ? (activeBrand.products || []).filter((p) => config.selectedProductIds.includes(p.id))
    : config.selectedProductId ? [(activeBrand.products || []).find((p) => p.id === config.selectedProductId)].filter(Boolean) : [];

  const referenceUrls: string[] = [];
  selectedAvatars.forEach((a) => { if (a?.imageUrl) referenceUrls.push(a.imageUrl); });
  selectedProducts.forEach((p) => { if (p?.imageUrl) referenceUrls.push(p.imageUrl); });

  const images = await Promise.all(
    adaptData.scenes.map(async (scene) => {
      try {
        const job = await createImageEdit(referenceUrls, scene.imagePrompt, config.aspectRatio, config.resolution);
        const result = await pollImageGen(job.request_id);
        return {
          frame: scene.frame,
          url: result.image_url || "",
          prompt: scene.imagePrompt,
          script: scene.script,
          sceneType: scene.sceneType,
          status: result.status === "failed" ? "failed" : "done",
        };
      } catch {
        return { frame: scene.frame, url: "", prompt: scene.imagePrompt, script: scene.script, sceneType: scene.sceneType, status: "failed" };
      }
    })
  );

  const successful = images.filter((img) => img.url);

  // Save to content
  try {
    await saveGeneration({
      brandId: activeBrand.id,
      toolId: tool.id,
      title: `Content Analyzer — ${selectedProduct?.name || "Campaign"} — ${new Date().toLocaleDateString()}`,
      type: "image",
      thumbnailUrl: successful[0]?.url,
      scenes: successful.map((img) => ({ id: `frame_${img.frame}`, title: `Frame ${img.frame}`, imageUrl: img.url, script: img.script })),
      metadata: { numFrames: images.length, successful: successful.length },
    });
  } catch { /* silent */ }

  return {
    result: { images, successful: successful.length, total: images.length },
    needsApproval: false,
  };
};
