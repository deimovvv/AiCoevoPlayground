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

  const selectedClothing = (activeBrand.clothing || []).filter(
    (c) => config.selectedClothingIds.includes(c.id)
  );

  // Custom script bypass — skip Gemini, use user's script directly
  const customScript = (config as Record<string, unknown>).customScript as string || "";
  if (customScript.trim()) {
    type CustomScene = { script: string; visual: string };
    let entries: CustomScene[] = [];
    try {
      const parsed = JSON.parse(customScript);
      if (Array.isArray(parsed)) {
        entries = parsed
          .map((s: string | CustomScene) => typeof s === "string" ? { script: s, visual: "" } : s)
          .filter((s: CustomScene) => s.script?.trim());
      }
    } catch {
      entries = customScript.trim().split("\n")
        .filter((l: string) => l.trim())
        .map((l: string) => ({ script: l.trim(), visual: "" }));
    }

    if (entries.length > 0) {
      const avatarDesc = selectedAvatar?.description || selectedAvatar?.name || "Person";
      const productDesc = selectedProduct ? `${selectedProduct.name} visible in frame.` : "";
      const bgDesc = selectedBackground?.description || selectedBackground?.name || "studio setting";
      const objective = config.objective || "";

      // Shot types with descriptions
      const SHOT_MAP: Record<string, string> = {
        "auto": "", // resolved below
        "close-up": "Shot on 50mm f/1.4, tight close-up, face fills 60% of frame",
        "medium": "Shot on 35mm f/1.8, medium shot, waist up, product clearly visible",
        "medium-close": "Shot on 50mm f/1.8, medium-close, chest up, product at chest height",
        "full-body": "Shot on 35mm f/2.8, full body visible, head to toe, showing outfit completely",
        "wide": "Shot on 24mm f/2.8, wide shot, person and environment visible",
        "product-only": "Shot on 85mm f/2.0, close-up of product only, no person, shallow depth of field",
        "hands": "Shot on 50mm f/2.0, close-up of hands interacting with product, face partially visible",
        "overhead": "Shot from directly above, overhead flat-lay angle, product and hands visible",
      };

      // Auto-select shot based on scene context
      const autoShot = (visual: string, isFirst: boolean, isLast: boolean): string => {
        const v = visual.toLowerCase();
        if (v.includes("solo producto") || v.includes("product only") || v.includes("sin persona")) return SHOT_MAP["product-only"];
        if (v.includes("cuerpo entero") || v.includes("full body") || v.includes("outfit")) return SHOT_MAP["full-body"];
        if (v.includes("manos") || v.includes("hands") || v.includes("close-up")) return SHOT_MAP["hands"];
        if (config.productIsWorn) return isFirst ? SHOT_MAP["medium"] : SHOT_MAP["full-body"];
        if (selectedProduct) return isFirst ? SHOT_MAP["medium-close"] : SHOT_MAP["medium"];
        return isFirst ? SHOT_MAP["close-up"] : SHOT_MAP["medium"];
      };

      const bgNote = selectedBackground?.description || selectedBackground?.name || "";

      const customScenes = entries.map((entry: CustomScene, i: number) => {
        let imagePrompt: string;
        const bgContext = bgNote ? `in ${bgNote}` : `in ${bgDesc}`;
        const clothingDesc = selectedClothing.length > 0
          ? `wearing ${selectedClothing.map((c) => c.name).join(" and ")}`
          : "";
        const productInteraction = selectedProduct
          ? (config.productIsWorn ? `wearing ${selectedProduct.name}` : `holding ${selectedProduct.name}`)
          : "";

        // Resolve shot type
        const shotKey = (entry as CustomScene & { shot?: string }).shot || "auto";
        const shotDesc = shotKey === "auto"
          ? autoShot(entry.visual || "", i === 0, i === entries.length - 1)
          : (SHOT_MAP[shotKey] || SHOT_MAP["medium"]);

        if (entry.visual?.trim()) {
          imagePrompt = `${entry.visual.trim()}. ${shotDesc}, natural warm lighting, vertical 9:16, ultra-realistic.`;
        } else {
          imagePrompt = `${avatarDesc} looking directly at camera ${bgContext}, ${clothingDesc}${clothingDesc && productInteraction ? ", " : ""}${productInteraction}. ${shotDesc}, natural warm lighting, vertical 9:16, ultra-realistic.`;
        }

        return {
          id: `act_${i + 1}`,
          title: i === 0 ? "Hook" : i === entries.length - 1 ? "CTA" : `Scene ${i + 1}`,
          script: entry.script.trim(),
          image_prompt: imagePrompt,
        };
      });
      return {
        result: { scenes: [customScenes], brief: "Custom script (user-provided)" },
        needsApproval: true,
      };
    }
  }

  let notes = config.objective;
  if (selectedAvatar) {
    notes += `\nAVATAR: ${selectedAvatar.name}`;
    if (selectedAvatar.description) notes += ` — ${selectedAvatar.description}`;
  }
  if (selectedBackground) {
    notes += `\nBACKGROUND/SETTING: ${selectedBackground.name}`;
    if (selectedBackground.description) notes += ` — ${selectedBackground.description}`;
  }
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

  // Avatar FIRST (face/identity — highest priority)
  if (selectedAvatar?.imageUrl) imageUrls.push(selectedAvatar.imageUrl);

  // Composition reference SECOND (pose/setting — optional)
  const refFiles = (config as { referenceImages?: File[] }).referenceImages || [];
  let refDataUrl = "";
  for (const file of refFiles.slice(0, 1)) {
    refDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    imageUrls.push(refDataUrl);
  }

  // Then clothing, product
  if (config.productIsWorn) {
    if (selectedProduct?.imageUrl) imageUrls.push(selectedProduct.imageUrl);
    selectedClothingItems.forEach((c) => { if (c.imageUrl) imageUrls.push(c.imageUrl); });
  } else {
    selectedClothingItems.forEach((c) => { if (c.imageUrl) imageUrls.push(c.imageUrl); });
    if (selectedProduct?.imageUrl) imageUrls.push(selectedProduct.imageUrl);
  }
  // Pass ALL product images if available (front, back, detail)
  if (selectedProduct?.images) {
    for (const img of selectedProduct.images) {
      if (img.imageUrl) imageUrls.push(img.imageUrl);
    }
  }
  if (selectedBackground?.imageUrl) imageUrls.push(selectedBackground.imageUrl);

  // Build prompt with positional references so Nano Banana knows what each image is
  let prompt = firstScene.image_prompt;
  const refDescriptions: string[] = [];
  let imgIdx = 1;

  if (selectedAvatar?.imageUrl) {
    refDescriptions.push(`Image ${imgIdx}: the person's face and body — use this EXACT person`);
    imgIdx++;
  }
  if (refFiles.length > 0) {
    refDescriptions.push(`Image ${imgIdx}: composition/pose reference — match this setting and pose`);
    imgIdx++;
  }
  if (config.productIsWorn && selectedProduct?.imageUrl) {
    refDescriptions.push(`Image ${imgIdx}: "${selectedProduct.name}" — the person WEARS this exact garment. Reproduce it identically: same color, same design, same fit`);
    imgIdx++;
  }
  for (const c of selectedClothingItems) {
    if (c.imageUrl) {
      refDescriptions.push(`Image ${imgIdx}: "${c.name}" — the person WEARS this exact clothing item`);
      imgIdx++;
    }
  }
  if (!config.productIsWorn && selectedProduct?.imageUrl) {
    refDescriptions.push(`Image ${imgIdx}: "${selectedProduct.name}" — the person HOLDS or SHOWS this exact product`);
    imgIdx++;
  }
  if (selectedProduct?.images) {
    for (const img of selectedProduct.images) {
      if (img.imageUrl) {
        refDescriptions.push(`Image ${imgIdx}: additional view of "${selectedProduct.name}"`);
        imgIdx++;
      }
    }
  }
  if (selectedBackground?.imageUrl) {
    const bgName = selectedBackground.description || selectedBackground.name || "background";
    refDescriptions.push(`Image ${imgIdx}: background/environment — place the person IN this exact setting (${bgName})`);
    imgIdx++;
  }

  if (refDescriptions.length > 0) {
    prompt = `REFERENCE IMAGES:\n${refDescriptions.join("\n")}\n\n${prompt}`;
  }

  console.log(`[base_image] refs: ${imageUrls.length}, avatar: ${!!selectedAvatar?.imageUrl}, product: ${!!selectedProduct?.imageUrl}, bg: ${!!selectedBackground?.imageUrl}, refFiles: ${refFiles.length}`);
  console.log(`[base_image] prompt: ${prompt.slice(0, 200)}...`);
  const job = await createImageEdit(imageUrls, prompt, config.aspectRatio, config.resolution);
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

  const voiceResults: Array<{ sceneId: string; title: string; script: string; audioUrl: string; duration: string }> = [];

  for (const scene of scenes) {
    if (audioCache[scene.id]) {
      voiceResults.push({
        sceneId: scene.id,
        title: scene.title,
        script: scene.script,
        audioUrl: audioCache[scene.id].url,
        duration: "cached",
      });
    } else if (scene.script) {
      const ttsResult = await generateTTS({ text: scene.script, voice_id: voiceId });
      setAudioCache(scene.id, { url: ttsResult.audioUrl, blob: ttsResult.audioBlob });
      voiceResults.push({
        sceneId: scene.id,
        title: scene.title,
        script: scene.script,
        audioUrl: ttsResult.audioUrl,
        duration: "generated",
      });
    }
  }

  return { result: voiceResults, needsApproval: true };
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
