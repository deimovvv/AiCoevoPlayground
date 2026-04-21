/**
 * Fashion Reel — Step Handlers
 * ─────────────────────────────
 * Pipeline: script → base_image → multishot → animate → render
 *
 * Visual-only reel (no voice, no lipsync).
 * Story mode: 4 narrative scenes (Hook → Movement → Showcase → Closer)
 * Looks mode: one scene per outfit (each clothing item = one look)
 */

import type { StepHandler } from "../types";
import {
  generateToolPrompt,
  createImageEdit, createTextToImage, pollImageGen,
  createKlingVideo, pollKlingVideo,
  concatVideos, saveGeneration,
  analyzePoseReference,
} from "../../lib/api";

const VISUAL_STYLE_PROMPTS: Record<string, string> = {
  editorial: "FORMAT: Vertical 9:16, shot on 35mm film look. LIGHTING: soft directional natural light, fashion editorial quality. STYLE: high-fashion, minimal, sophisticated — sharp detail, clean backgrounds.",
  cinematic: "FORMAT: Vertical 9:16, anamorphic lens. LIGHTING: dramatic, directional side lighting, film-quality. STYLE: cinematic, shallow depth of field, movie-grade color.",
  iphone: "FORMAT: Vertical 9:16, shot on iPhone. LIGHTING: available natural light, real-world ambiance. STYLE: authentic UGC feel, real skin texture, slightly warm color temperature.",
  studio: "FORMAT: Vertical 9:16, studio setup. LIGHTING: professional 3-point lighting, clean and even. STYLE: clean commercial photography, sharp detail.",
};

const getVisualStyle = (cfg: Record<string, unknown>): string => {
  const style = (cfg.visualStyle as string) || "editorial";
  if (style === "custom") return (cfg.visualStyleCustom as string) || VISUAL_STYLE_PROMPTS.editorial;
  return VISUAL_STYLE_PROMPTS[style] ?? VISUAL_STYLE_PROMPTS.editorial;
};

const NO_TEXT_SUFFIX = " Single continuous frame. NO split screen, NO collage, NO grid, NO text, NO watermarks, NO overlays.";

// ── Script ───────────────────────────────────────────────

export const handleScript: StepHandler = async (ctx) => {
  const { activeBrand, config } = ctx;
  const cfg = config as unknown as Record<string, unknown>;

  const selectedAvatarIds = (cfg.selectedAvatarIds as string[]) || [];
  const selectedProductIds = (cfg.selectedProductIds as string[]) || [];
  const reelMode = (cfg.reelMode as string) || "story";

  const selectedAvatars = selectedAvatarIds.length
    ? (activeBrand.avatars || []).filter((a) => selectedAvatarIds.includes(a.id))
    : config.selectedAvatarId ? [activeBrand.avatars?.find((a) => a.id === config.selectedAvatarId)].filter(Boolean) : [];
  const selectedProducts = selectedProductIds.length
    ? (activeBrand.products || []).filter((p) => selectedProductIds.includes(p.id))
    : config.selectedProductId ? [(activeBrand.products || []).find((p) => p.id === config.selectedProductId)].filter(Boolean) : [];
  const selectedClothing = (activeBrand.clothing || []).filter((c) => config.selectedClothingIds.includes(c.id));

  // Custom script bypass
  const customScript = (cfg.customScript as string) || "";
  if (customScript.trim()) {
    type CustomScene = { id?: string; title?: string; visual?: string; shot?: string; note?: string };
    let entries: CustomScene[] = [];
    try {
      const parsed = JSON.parse(customScript);
      if (Array.isArray(parsed)) entries = parsed;
    } catch { /* not JSON */ }
    if (entries.length > 0) {
      return {
        result: {
          scenes: entries.map((e, i) => ({
            id: e.id || `act_${i + 1}`,
            title: e.title || `Scene ${i + 1}`,
            script: "",
            image_prompt: e.visual || "",
            sceneType: "creative" as const,
            shot: e.shot || "medium",
            note: e.note || "",
          })),
        },
        needsApproval: true,
      };
    }
  }

  // Looks mode with clothing: generate scenes directly from each clothing item
  if (reelMode === "looks" && selectedClothing.length > 0) {
    const avatarDesc = selectedAvatars[0]
      ? `${selectedAvatars[0]!.name}${selectedAvatars[0]!.description ? `: ${selectedAvatars[0]!.description}` : ""}`
      : "the model";
    const SHOT_CYCLE = ["close-up", "medium", "full-body", "medium-close"] as const;
    return {
      result: {
        scenes: selectedClothing.map((garment, i) => ({
          id: `look_${i + 1}`,
          title: garment.name,
          script: "",
          image_prompt: `${avatarDesc} wearing ${garment.name}${garment.description ? ` (${garment.description})` : ""}. Confident fashion pose, vertical 9:16 frame.`,
          sceneType: "creative" as const,
          shot: SHOT_CYCLE[i % SHOT_CYCLE.length],
          note: `Look ${i + 1}: ${garment.name}`,
        })),
      },
      needsApproval: true,
    };
  }

  // Story mode — use Gemini
  const extraVars: Record<string, string> = { reel_mode: reelMode };
  if (reelMode === "story") extraVars.reel_mode_story = "true";
  if (reelMode === "looks") extraVars.reel_mode_looks = "true";
  if (config.objective) extraVars.creative_direction = config.objective;

  const avatarLines = selectedAvatars.filter(Boolean).map((a) => `${a!.name}${a!.description ? `: ${a!.description}` : ""}`).join("\n");
  const productLines = selectedProducts.filter(Boolean).map((p) => `${p!.name}${p!.description ? `: ${p!.description}` : ""}`).join("\n");
  const clothingLines = selectedClothing.map((c) => `${c.name}${c.description ? `: ${c.description}` : ""}`).join("\n");
  if (avatarLines) extraVars.avatars = avatarLines;
  if (productLines) extraVars.products = productLines;
  if (clothingLines) extraVars.clothing = clothingLines;

  const modeLabel = reelMode === "looks" ? "Looks (one scene per outfit)" : "Story (Hook → Movement → Showcase → Closer)";
  const userMsg = [
    `Generate a Fashion Reel in ${modeLabel} mode. Respond with ONLY a JSON array.`,
    selectedAvatars[0] ? `Model: ${selectedAvatars[0]!.name}` : "",
    selectedClothing.length > 0 ? `Outfits: ${selectedClothing.map((c) => c.name).join(", ")}` : "",
    selectedProducts[0] ? `Feature: ${selectedProducts[0]!.name}` : "",
    config.objective ? `Direction: ${config.objective}` : "",
  ].filter(Boolean).join("\n");

  const { result } = await generateToolPrompt(activeBrand.id, "fashion_reel", userMsg, extraVars);

  const raw = typeof result === "string" ? result : JSON.stringify(result);
  const clean = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  const arrStart = clean.indexOf("[");
  const arrEnd = clean.lastIndexOf("]");

  let parsed: Array<Record<string, unknown>> = [];
  if (arrStart !== -1 && arrEnd !== -1) {
    try { parsed = JSON.parse(clean.slice(arrStart, arrEnd + 1)); } catch { /* fall through */ }
  }
  if (!parsed.length) throw new Error("Gemini no devolvió escenas válidas.");

  return {
    result: {
      scenes: parsed.map((s, i) => ({
        id: String(s.id || `act_${i + 1}`),
        title: String(s.title || `Scene ${i + 1}`),
        script: "",
        image_prompt: String(s.visual || s.image_prompt || s.prompt || ""),
        sceneType: "creative" as const,
        shot: String(s.shot || "medium"),
        note: String(s.note || ""),
      })),
    },
    needsApproval: true,
  };
};

// ── Base Image ───────────────────────────────────────────

export const handleBaseImage: StepHandler = async (ctx) => {
  const { activeBrand, config, getScriptScenes } = ctx;
  const cfg = config as unknown as Record<string, unknown>;
  const scenes = getScriptScenes();
  const firstScene = scenes[0];
  if (!firstScene) throw new Error("No scenes found.");

  const selectedAvatarIds = (cfg.selectedAvatarIds as string[]) || [];
  const selectedProductIds = (cfg.selectedProductIds as string[]) || [];
  const reelMode = (cfg.reelMode as string) || "story";

  const selectedAvatar = selectedAvatarIds.length
    ? (activeBrand.avatars || []).find((a) => selectedAvatarIds.includes(a.id))
    : activeBrand.avatars?.find((a) => a.id === config.selectedAvatarId);
  const selectedProducts = selectedProductIds.length
    ? (activeBrand.products || []).filter((p) => selectedProductIds.includes(p.id))
    : config.selectedProductId ? [(activeBrand.products || []).find((p) => p.id === config.selectedProductId)].filter(Boolean) : [];
  const selectedBackground = (activeBrand.backgrounds || []).find((bg) => bg.id === config.selectedBackgroundId);

  // Looks mode: first scene = first clothing item. Story mode: all clothing
  const allClothing = (activeBrand.clothing || []).filter((c) => config.selectedClothingIds.includes(c.id));
  const sceneClothing = reelMode === "looks" ? allClothing.slice(0, 1) : allClothing;

  const stylePrompt = getVisualStyle(cfg);
  const imageUrls: string[] = [];
  const refDescriptions: string[] = [];
  let imgIdx = 1;

  if (selectedAvatar?.imageUrl) {
    imageUrls.push(selectedAvatar.imageUrl);
    refDescriptions.push(`Image ${imgIdx}: the model's face and body — use this EXACT person`);
    imgIdx++;
  }

  const refFiles = (cfg.referenceImages as File[]) || [];
  let poseDescription = "";
  for (const file of refFiles.slice(0, 1)) {
    const refDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    imageUrls.push(refDataUrl);
    try { const analysis = await analyzePoseReference(file); poseDescription = analysis.pose_description; } catch { /* non-blocking */ }
    refDescriptions.push(`Image ${imgIdx}: ${poseDescription ? `pose reference — ${poseDescription}` : "pose reference"}`);
    imgIdx++;
  }

  sceneClothing.forEach((c) => {
    if (c.imageUrl) { imageUrls.push(c.imageUrl); refDescriptions.push(`Image ${imgIdx}: "${c.name}" — model WEARS this`); imgIdx++; }
  });
  selectedProducts.filter(Boolean).forEach((p) => {
    if (p?.imageUrl) { imageUrls.push(p.imageUrl); refDescriptions.push(`Image ${imgIdx}: "${p!.name}" — model holds/features`); imgIdx++; }
  });
  if (selectedBackground?.imageUrl) {
    imageUrls.push(selectedBackground.imageUrl);
    refDescriptions.push(`Image ${imgIdx}: background/environment`);
    imgIdx++;
  }

  let prompt = firstScene.image_prompt;
  if (refDescriptions.length > 0) prompt = `REFERENCE IMAGES:\n${refDescriptions.join("\n")}\n\n${prompt}`;
  prompt += ` ${stylePrompt}${NO_TEXT_SUFFIX}`;

  const job = imageUrls.length > 0
    ? await createImageEdit(imageUrls, prompt, config.aspectRatio, config.resolution)
    : await createTextToImage(prompt, config.aspectRatio, config.resolution);
  const result = await pollImageGen(job.request_id);
  if (result.status === "failed") throw new Error(result.error || "Image generation failed");

  return {
    result: {
      url: result.image_url!,
      prompt: firstScene.image_prompt,
      inputs: {
        avatar: selectedAvatar ? { name: selectedAvatar.name, imageUrl: selectedAvatar.imageUrl } : null,
        clothing: sceneClothing.map((c) => ({ name: c.name, imageUrl: c.imageUrl })),
        product: selectedProducts[0] ? { name: selectedProducts[0]!.name, imageUrl: selectedProducts[0]!.imageUrl } : null,
        background: selectedBackground ? { name: selectedBackground.name, imageUrl: selectedBackground.imageUrl } : null,
      },
    },
    needsApproval: true,
  };
};

// ── Multishot ────────────────────────────────────────────

export const handleMultishot: StepHandler = async (ctx) => {
  const { activeBrand, config, getStepResult, getScriptScenes } = ctx;
  const cfg = config as unknown as Record<string, unknown>;
  const scenes = getScriptScenes();
  if (!scenes.length) throw new Error("No scenes found.");

  const baseImageResult = getStepResult("base_image") as { url: string } | undefined;
  if (!baseImageResult?.url) throw new Error("Base image not found.");

  const selectedAvatarIds = (cfg.selectedAvatarIds as string[]) || [];
  const selectedProductIds = (cfg.selectedProductIds as string[]) || [];
  const reelMode = (cfg.reelMode as string) || "story";

  const selectedAvatar = selectedAvatarIds.length
    ? (activeBrand.avatars || []).find((a) => selectedAvatarIds.includes(a.id))
    : activeBrand.avatars?.find((a) => a.id === config.selectedAvatarId);
  const selectedProducts = selectedProductIds.length
    ? (activeBrand.products || []).filter((p) => selectedProductIds.includes(p.id))
    : config.selectedProductId ? [(activeBrand.products || []).find((p) => p.id === config.selectedProductId)].filter(Boolean) : [];
  const selectedBackground = (activeBrand.backgrounds || []).find((bg) => bg.id === config.selectedBackgroundId);
  const allClothing = (activeBrand.clothing || []).filter((c) => config.selectedClothingIds.includes(c.id));

  const stylePrompt = getVisualStyle(cfg);

  const REEL_VARIATIONS = [
    { label: "Alt pose", desc: "Same scene, slightly different body position — weight shift, head angle." },
    { label: "Movement implied", desc: "Same setup with implied motion — fabric flowing, mid-gesture." },
  ];

  const buildRefs = (clothingItems: typeof allClothing): string[] => {
    const urls: string[] = [];
    if (selectedAvatar?.imageUrl) urls.push(selectedAvatar.imageUrl);
    clothingItems.forEach((c) => { if (c.imageUrl) urls.push(c.imageUrl); });
    selectedProducts.filter(Boolean).forEach((p) => { if (p?.imageUrl) urls.push(p.imageUrl); });
    if (selectedBackground?.imageUrl) urls.push(selectedBackground.imageUrl);
    return urls;
  };

  const buildRefDesc = (clothingItems: typeof allClothing): string => {
    const lines: string[] = [];
    let idx = 1;
    if (selectedAvatar?.imageUrl) { lines.push(`Image ${idx}: same model`); idx++; }
    clothingItems.forEach((c) => { if (c.imageUrl) { lines.push(`Image ${idx}: "${c.name}" — wears this`); idx++; } });
    selectedProducts.filter(Boolean).forEach((p) => { if (p?.imageUrl) { lines.push(`Image ${idx}: "${p!.name}"`); idx++; } });
    if (selectedBackground?.imageUrl) { lines.push(`Image ${idx}: background`); idx++; }
    return lines.join("\n");
  };

  const multishotResults: Array<{
    sceneId: string; title: string; sceneType: "creative";
    variations: Array<{ id: string; url: string; label: string; prompt: string }>;
  }> = [{
    sceneId: scenes[0].id,
    title: scenes[0].title,
    sceneType: "creative",
    variations: [{ id: `${scenes[0].id}_v1`, url: baseImageResult.url, label: "Base frame", prompt: scenes[0].image_prompt }],
  }];

  for (let i = 1; i < scenes.length; i++) {
    const scene = scenes[i];
    // Looks mode: each scene gets its specific clothing item
    const sceneClothing = reelMode === "looks" ? allClothing.slice(i, i + 1) : allClothing;
    const refUrls = buildRefs(sceneClothing);
    const refDesc = buildRefDesc(sceneClothing);
    const variations: Array<{ id: string; url: string; label: string; prompt: string }> = [];

    for (let v = 0; v < 2; v++) {
      const varHint = REEL_VARIATIONS[v % REEL_VARIATIONS.length];
      let prompt = scene.image_prompt;
      if (refDesc) prompt = `REFERENCE IMAGES:\n${refDesc}\n\n${prompt}`;
      prompt += ` ${varHint.desc} ${stylePrompt}${NO_TEXT_SUFFIX}`;

      try {
        const job = refUrls.length > 0
          ? await createImageEdit(refUrls, prompt, config.aspectRatio, config.resolution)
          : await createTextToImage(prompt, config.aspectRatio, config.resolution);
        const result = await pollImageGen(job.request_id);
        variations.push({ id: `${scene.id}_v${v + 1}`, url: result.image_url || "", label: varHint.label, prompt: scene.image_prompt });
      } catch {
        variations.push({ id: `${scene.id}_v${v + 1}`, url: "", label: varHint.label, prompt: scene.image_prompt });
      }
    }

    multishotResults.push({ sceneId: scene.id, title: scene.title, sceneType: "creative", variations });
  }

  return { result: multishotResults, needsApproval: true };
};

// ── Animate — Kling image-to-video per curated frame ─────

export const handleAnimate: StepHandler = async (ctx) => {
  const { getStepResult, getScriptScenes } = ctx;

  const curationSelections = ctx.curationSelections || {};
  const multishotData = getStepResult("multishot") as Array<{
    sceneId: string; title: string;
    variations: Array<{ id: string; url: string }>;
  }> | undefined;
  const scriptScenes = getScriptScenes();

  if (!multishotData?.length) throw new Error("No shots found.");

  const framesToAnimate = multishotData.map((scene) => {
    const selectedVariationId = curationSelections[scene.sceneId];
    const selected = selectedVariationId
      ? scene.variations.find((v) => v.id === selectedVariationId)
      : scene.variations[0];
    const scriptScene = scriptScenes.find((s) => s.id === scene.sceneId) as (typeof scriptScenes[0] & { note?: string }) | undefined;
    return {
      sceneId: scene.sceneId,
      title: scene.title,
      imageUrl: selected?.url || scene.variations[0]?.url || "",
      note: scriptScene?.note || "",
    };
  }).filter((f) => f.imageUrl);

  if (!framesToAnimate.length) throw new Error("No valid images to animate.");

  const animatedResults: Array<{ sceneId: string; title: string; videoUrl: string; imageUrl: string }> = [];

  for (const frame of framesToAnimate) {
    const motionPrompt = frame.note
      ? `Fashion model: ${frame.note}. Smooth, natural, confident movement. Vertical 9:16.`
      : "Fashion model subtle natural movement — slight sway, confident pose, hair movement. Vertical 9:16.";

    try {
      const job = await createKlingVideo(frame.imageUrl, motionPrompt, "5");
      const result = await pollKlingVideo(job.request_id);
      animatedResults.push({ sceneId: frame.sceneId, title: frame.title, videoUrl: result.video_url || "", imageUrl: frame.imageUrl });
    } catch {
      animatedResults.push({ sceneId: frame.sceneId, title: frame.title, videoUrl: "", imageUrl: frame.imageUrl });
    }
  }

  return { result: animatedResults, needsApproval: true };
};

// ── Render — FFmpeg concat, no subtitles ─────────────────

export const handleRender: StepHandler = async (ctx) => {
  const { activeBrand, config, getStepResult, getScriptScenes, tool } = ctx;
  const cfg = config as unknown as Record<string, unknown>;
  const animateData = getStepResult("animate") as Array<{ sceneId: string; title: string; videoUrl: string; imageUrl: string }> | undefined;

  if (!animateData?.length) throw new Error("No animated segments found.");

  const videoUrls = animateData.filter((s) => s.videoUrl).map((s) => s.videoUrl);
  if (!videoUrls.length) throw new Error("All animations failed.");

  const result = await concatVideos(videoUrls, [], false, "none");
  const scriptScenes = getScriptScenes();
  const selectedAvatarIds = (cfg.selectedAvatarIds as string[]) || [];
  const selectedAvatar = selectedAvatarIds.length
    ? (activeBrand.avatars || []).find((a) => selectedAvatarIds.includes(a.id))
    : activeBrand.avatars?.find((a) => a.id === config.selectedAvatarId);
  const baseImg = getStepResult("base_image") as { url: string } | undefined;
  const reelMode = (cfg.reelMode as string) || "story";

  try {
    await saveGeneration({
      brandId: activeBrand.id,
      toolId: tool.id,
      title: `Fashion Reel — ${selectedAvatar?.name || activeBrand.name} — ${reelMode === "looks" ? "Looks" : "Story"} — ${new Date().toLocaleDateString()}`,
      type: "video",
      status: "completed",
      thumbnailUrl: baseImg?.url,
      outputUrl: result.video_url,
      scenes: scriptScenes.map((s) => ({ id: s.id, title: s.title, script: s.script })),
      metadata: { numScenes: scriptScenes.length, duration: result.duration, reelMode },
    });
  } catch { /* silent */ }

  return {
    result: {
      videoUrl: result.video_url,
      totalDuration: `${result.duration}s`,
      scenes: result.num_segments,
      format: "MP4 / H.264",
      resolution: "1080x1920 (9:16)",
    },
  };
};
