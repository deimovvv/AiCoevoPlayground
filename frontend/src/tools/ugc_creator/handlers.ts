/**
 * UGC Creator — Step Handlers
 * ────────────────────────────
 * Each handler is an async function that receives StepContext
 * and returns { result, needsApproval? }.
 */

import type { StepHandler } from "../types";
import {
  generateCopy, generateTTS, generateTTSAndUpload,
  createImageEdit, pollImageGen,
  createHeyGenAvatar4, pollHeyGenAvatar4,
  concatVideos, saveGeneration,
} from "../../lib/api";

// ── Script ───────────────────────────────────────────────

export const handleScript: StepHandler = async (ctx) => {
  const { activeBrand, config } = ctx;
  const selectedProduct = (activeBrand.products || []).find(
    (p) => p.id === config.selectedProductId
  );
  const selectedAvatar = activeBrand.avatars?.find(
    (a) => a.id === config.selectedAvatarId
  );
  const selectedBackground = (activeBrand.backgrounds || []).find(
    (bg) => bg.id === config.selectedBackgroundId
  );

  let notes = config.objective;
  if (selectedAvatar) {
    notes += `\nAVATAR: ${selectedAvatar.name}`;
    if (selectedAvatar.description) notes += ` — ${selectedAvatar.description}`;
  }
  if (selectedBackground) {
    notes += `\nBACKGROUND/SETTING: ${selectedBackground.name}`;
    if (selectedBackground.description) notes += ` — ${selectedBackground.description}`;
  }
  const selectedClothing = (activeBrand.clothing || []).filter(
    (c) => config.selectedClothingIds.includes(c.id)
  );
  if (selectedClothing.length > 0) {
    notes += `\nCLOTHING TO WEAR:`;
    selectedClothing.forEach((c) => {
      notes += `\n- ${c.name}`;
      if (c.description) notes += `: ${c.description}`;
    });
    notes += `\nThe avatar MUST be wearing these specific clothing items in every scene.`;
  }
  if (selectedProduct) {
    notes += `\n\nPRODUCT TO PROMOTE: ${selectedProduct.name}`;
    if (selectedProduct.description) notes += ` — ${selectedProduct.description}`;
    if (config.productIsWorn) {
      notes += `\nIMPORTANT: The avatar IS WEARING the product. Do NOT show it in hands.`;
    } else {
      notes += `\nThe avatar shows/holds this product in their hands. It must be visible, unfolded, and extended.`;
    }
  }
  if (config.notes) notes += `\n${config.notes}`;

  const result = await generateCopy(activeBrand.id, {
    productName: selectedProduct?.name || "",
    tone: config.tone as "engaging" | "professional" | "casual" | "funny",
    platform: config.platform as "tiktok" | "instagram" | "youtube",
    language: config.language as "es" | "en",
    additionalNotes: notes,
  });

  return { result: { scenes: result.scripts, brief: result.brief }, needsApproval: true };
};

// ── Base Image ───────────────────────────────────────────

export const handleBaseImage: StepHandler = async (ctx) => {
  const { activeBrand, config, getScriptScenes, setAudioCache } = ctx;
  const scenes = getScriptScenes();
  const firstScene = scenes[0];
  if (!firstScene) throw new Error("No script scenes found.");

  const selectedProduct = (activeBrand.products || []).find((p) => p.id === config.selectedProductId);
  const selectedAvatar = activeBrand.avatars?.find((a) => a.id === config.selectedAvatarId);
  const selectedBackground = (activeBrand.backgrounds || []).find((bg) => bg.id === config.selectedBackgroundId);
  const selectedClothingItems = (activeBrand.clothing || []).filter((c) => config.selectedClothingIds.includes(c.id));

  const imageUrls: string[] = [];
  if (config.productIsWorn) {
    if (selectedAvatar?.imageUrl) imageUrls.push(selectedAvatar.imageUrl);
    if (selectedProduct?.imageUrl) imageUrls.push(selectedProduct.imageUrl);
    selectedClothingItems.forEach((c) => { if (c.imageUrl) imageUrls.push(c.imageUrl); });
  } else {
    if (selectedAvatar?.imageUrl) imageUrls.push(selectedAvatar.imageUrl);
    selectedClothingItems.forEach((c) => { if (c.imageUrl) imageUrls.push(c.imageUrl); });
    if (selectedProduct?.imageUrl) imageUrls.push(selectedProduct.imageUrl);
  }
  if (selectedBackground?.imageUrl) imageUrls.push(selectedBackground.imageUrl);

  const job = await createImageEdit(imageUrls, firstScene.image_prompt, config.aspectRatio, config.resolution);
  const result = await pollImageGen(job.request_id);
  if (result.status === "failed") throw new Error(result.error || "Image generation failed");

  // Generate audio for Scene 1 for test video
  const voiceId = config.selectedVoiceId || activeBrand.voicePresets?.[0]?.id;
  if (firstScene.script && voiceId) {
    try {
      const ttsResult = await generateTTS({ text: firstScene.script, voice_id: voiceId });
      setAudioCache(firstScene.id, { url: ttsResult.audioUrl, blob: ttsResult.audioBlob });
    } catch { /* non-blocking */ }
  }

  return {
    result: {
      url: result.image_url,
      prompt: firstScene.image_prompt,
      scriptText: firstScene.script,
      inputs: {
        avatar: selectedAvatar ? { name: selectedAvatar.name, imageUrl: selectedAvatar.imageUrl } : null,
        product: selectedProduct ? { name: selectedProduct.name, imageUrl: selectedProduct.imageUrl } : null,
        clothing: selectedClothingItems.map((c) => ({ name: c.name, imageUrl: c.imageUrl })),
        background: selectedBackground ? { name: selectedBackground.name, imageUrl: selectedBackground.imageUrl } : null,
      },
    },
    needsApproval: true,
  };
};

// ── Multishot ────────────────────────────────────────────

export const handleMultishot: StepHandler = async (ctx) => {
  const { config, getStepResult, getScriptScenes } = ctx;
  const scenes = getScriptScenes();
  if (scenes.length === 0) throw new Error("No script scenes found.");

  const baseImageResult = getStepResult("base_image") as { url: string } | undefined;
  if (!baseImageResult?.url) throw new Error("Base image not found.");

  const referenceUrls: string[] = [baseImageResult.url];
  const NUM_VARIATIONS = 2;

  const MOMENTS = [
    { label: "Tight close-up", desc: "Same person, same clothes, same product as image 1. Tight close-up from a different angle, face fills frame. Shot on 50mm f/1.4, very shallow depth of field, natural skin texture. Eyes locked on camera." },
    { label: "Medium wide", desc: "Same person, same clothes, same product as image 1. Camera pulled back to medium-wide, showing full torso and surroundings. Shot on 35mm f/1.8, relaxed posture. Off-center framing, eye contact." },
    { label: "Low angle", desc: "Same person, same clothes, same product as image 1. Camera positioned lower, looking slightly up. Shot on 24mm f/2.0, product held up to camera, confident expression." },
    { label: "Product focus", desc: "Same person as image 1, slightly blurred in background. Product in sharp focus in foreground, held toward camera. Shot on 85mm f/1.8, extreme shallow depth of field." },
    { label: "Side angle", desc: "Same person, same clothes, same product as image 1. Camera moved to the side, body angled but eyes on camera. Shot on 35mm f/2.0, rule of thirds composition." },
    { label: "Over shoulder", desc: "Same person, same clothes, same product as image 1. Camera behind and over one shoulder, subject looking back at camera. Shot on 28mm f/2.8, handheld feel." },
  ];

  // Scene 1 = base image directly
  const multishotResults: Array<{
    sceneId: string; title: string;
    variations: Array<{ id: string; url: string; label: string; prompt: string }>;
  }> = [{
    sceneId: scenes[0].id,
    title: scenes[0].title,
    variations: [{ id: `${scenes[0].id}_v1`, url: baseImageResult.url, label: "Base image", prompt: "" }],
  }];

  // Scenes 2+
  const remainingResults = await Promise.all(
    scenes.slice(1).map(async (scene, sceneIdx) => {
      const variations = await Promise.all(
        Array.from({ length: NUM_VARIATIONS }, async (_, vi) => {
          const momentIdx = (sceneIdx * NUM_VARIATIONS + vi) % MOMENTS.length;
          const moment = MOMENTS[momentIdx];
          const prompt = `${moment.desc}. Natural lighting, ${config.aspectRatio} aspect ratio, ultra-realistic.`;
          const job = await createImageEdit(referenceUrls, prompt, config.aspectRatio, config.resolution);
          const result = await pollImageGen(job.request_id);
          return { id: `${scene.id}_v${vi + 1}`, url: result.image_url || "", label: moment.label, prompt };
        })
      );
      return { sceneId: scene.id, title: scene.title, variations };
    })
  );
  multishotResults.push(...remainingResults);

  return { result: multishotResults };
};

// ── Curation (manual — returns immediately) ──────────────

export const handleCuration: StepHandler = async () => {
  // Curation is handled by the UI — no backend logic
  return { result: null };
};

// ── Voice ────────────────────────────────────────────────

export const handleVoice: StepHandler = async (ctx) => {
  const { activeBrand, config, getScriptScenes, audioCache, setAudioCache } = ctx;
  const scenes = getScriptScenes();
  const voiceId = config.selectedVoiceId || activeBrand.voicePresets?.[0]?.id;

  for (const scene of scenes) {
    if (!audioCache[scene.id]) {
      const ttsResult = await generateTTS({ text: scene.script, voice_id: voiceId });
      setAudioCache(scene.id, { url: ttsResult.audioUrl, blob: ttsResult.audioBlob });
    }
  }

  return { result: { generated: true }, autoRunNext: true };
};

// ── Lipsync (HeyGen Avatar 4) ────────────────────────────

export const handleLipsync: StepHandler = async (ctx) => {
  const { activeBrand, config, getStepResult, getScriptScenes } = ctx;
  const curationData = getStepResult("curation") as Array<{
    sceneId: string; title: string; selectedUrl: string;
  }> | undefined;

  if (!curationData) throw new Error("No curated images found.");

  const scenes = getScriptScenes();
  const voiceId = config.selectedVoiceId || activeBrand.voicePresets?.[0]?.id;
  const heygenAR = config.aspectRatio === "4:5" ? "9:16" : config.aspectRatio;
  const heygenRes = config.resolution === "4K" || config.resolution === "2K" ? "1080p" : "720p";

  const lipsyncResults = [];
  for (let i = 0; i < curationData.length; i++) {
    const scene = curationData[i];
    const scriptScene = scenes.find((s) => s.id === scene.sceneId) || scenes[i];
    const scriptText = scriptScene?.script || "";
    if (!scriptText) continue;

    const { fal_url: falAudioUrl } = await generateTTSAndUpload({
      text: scriptText,
      voice_id: voiceId,
    });

    const job = await createHeyGenAvatar4({
      image_url: scene.selectedUrl,
      audio_url: falAudioUrl,
      talking_style: "expressive",
      aspect_ratio: heygenAR,
      resolution: heygenRes,
    });
    const result = await pollHeyGenAvatar4(job.request_id);
    if (result.status === "failed") throw new Error(result.error || `Lip-sync failed for ${scene.title}`);

    lipsyncResults.push({
      sceneId: scene.sceneId,
      title: scene.title,
      scriptText,
      videoUrl: result.video_url || scene.selectedUrl,
      imageUrl: scene.selectedUrl,
    });
  }

  return { result: lipsyncResults, needsApproval: true };
};

// ── Render (FFmpeg concat + subtitles) ───────────────────

export const handleRender: StepHandler = async (ctx) => {
  const { activeBrand, config, getStepResult, getScriptScenes, tool } = ctx;
  const lipsyncData = getStepResult("lipsync") as Array<{
    sceneId: string; title: string; scriptText?: string; videoUrl: string;
  }> | undefined;

  if (!lipsyncData || lipsyncData.length === 0) throw new Error("No lip-sync videos found.");

  const videoUrls = lipsyncData.map((s) => s.videoUrl).filter(Boolean);
  if (videoUrls.length === 0) throw new Error("No valid video URLs.");

  const scriptScenes = getScriptScenes();
  const subtitleScripts = lipsyncData.map((seg) => {
    const scene = scriptScenes.find((s) => s.id === seg.sceneId);
    return { text: seg.scriptText || scene?.script || "" };
  });

  const result = await concatVideos(
    videoUrls, subtitleScripts,
    config.subtitleEngine !== "none",
    config.subtitleEngine,
  );

  // Save to content library
  const selectedProduct = (activeBrand.products || []).find((p) => p.id === config.selectedProductId);
  const baseImg = getStepResult("base_image") as { url: string } | undefined;
  try {
    await saveGeneration({
      brandId: activeBrand.id,
      toolId: tool.id,
      title: `UGC — ${selectedProduct?.name || "Video"} — ${new Date().toLocaleDateString()}`,
      type: "video",
      status: "completed",
      thumbnailUrl: baseImg?.url,
      outputUrl: result.video_url,
      scenes: scriptScenes.map((s) => ({ id: s.id, title: s.title, script: s.script })),
      metadata: { language: config.language, numScenes: scriptScenes.length, duration: result.duration },
    });
  } catch { /* silent */ }

  const fps = 30;
  const avgDuration = (result.duration / lipsyncData.length) * fps;
  const remotionScenes = lipsyncData.map((seg) => {
    const scene = scriptScenes.find((s) => s.id === seg.sceneId);
    return {
      videoUrl: seg.videoUrl,
      scriptText: seg.scriptText || scene?.script || "",
      durationInFrames: Math.round(avgDuration),
    };
  });

  return {
    result: {
      videoUrl: result.video_url,
      totalDuration: `${result.duration}s`,
      scenes: result.num_segments,
      format: "MP4 / H.264",
      resolution: "1080x1920 (9:16)",
      sizeBytes: result.size_bytes,
      subtitleEngine: config.subtitleEngine,
      remotionScenes,
    },
  };
};
