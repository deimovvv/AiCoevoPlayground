/**
 * Video Ad Creator — Step Handlers
 * ─────────────────────────────────
 * Pipeline: script → images → review_images → voice → animate → render
 */

import type { StepHandler } from "../types";
import {
  generateToolPrompt, createImageEdit, createTextToImage, pollImageGen,
  generateTTSAndUpload, createKlingVideo, pollKlingVideo,
  concatVideos,
} from "../../lib/api";
import { buildBrandConstraints, buildBrandContext } from "../shared/brandConstraints";

// ── Visual styles available ─────────────────────────────

export const AD_STYLES = [
  { id: "photorealistic", label: "Photorealistic", desc: "Ultra-realistic commercial photography" },
  { id: "claymation", label: "Claymation", desc: "Stop-motion clay animation style" },
  { id: "2d_cartoon", label: "2D Cartoon", desc: "Flat illustrated cartoon style" },
  { id: "3d_render", label: "3D Render", desc: "Clean 3D product visualization" },
  { id: "cinematic", label: "Cinematic", desc: "Film-like dramatic lighting and composition" },
  { id: "minimal", label: "Minimal", desc: "Clean, white space, product-focused" },
  { id: "retro", label: "Retro/Vintage", desc: "Nostalgic film grain, warm tones" },
  { id: "custom", label: "Custom", desc: "Define your own style in creative direction" },
];

// ── Script — generate storyboard with Gemini ────────────

export const handleScript: StepHandler = async (ctx) => {
  const { activeBrand, config, tool } = ctx;
  const selectedProduct = (activeBrand.products || []).find((p) => p.id === config.selectedProductId);
  const selectedAvatar = activeBrand.avatars?.find((a) => a.id === config.selectedAvatarId);
  const selectedClothing = (activeBrand.clothing || []).filter((c) => config.selectedClothingIds.includes(c.id));

  const numScenes = 10;
  const duration = 40;
  const adStyle = config.adStyle || "photorealistic";
  const styleLabel = AD_STYLES.find((s) => s.id === adStyle)?.label || adStyle;

  const extraVars: Record<string, string> = {
    num_scenes: String(numScenes),
    duration: String(duration),
    language: config.language || "es",
    ad_style: `Style: ${styleLabel}. All frames must be rendered in this style consistently.`,
  };

  if (selectedProduct?.description) extraVars.product_description = selectedProduct.description;
  if (config.objective) extraVars.creative_direction = config.objective;
  if (config.notes) extraVars.user_notes = config.notes;
  if (selectedClothing.length > 0) {
    extraVars.selected_clothing = selectedClothing.map((c) => `- ${c.name}${c.description ? `: ${c.description}` : ""}`).join("\n");
  }

  let userMsg = `Generate a ${duration}-second video ad storyboard with ${numScenes} frames in ${styleLabel} style.`;
  if (selectedProduct) userMsg += `\nProduct: ${selectedProduct.name}`;
  if (selectedAvatar) {
    userMsg += `\nCharacter: ${selectedAvatar.name}${selectedAvatar.description ? ` — ${selectedAvatar.description}` : ""}`;
  } else {
    userMsg += `\nIMPORTANT: Invent a character for this ad. Describe them in detail in the first frame (age, appearance, style) and keep them EXACTLY the same in every frame. The character interacts with the product throughout the story.`;
  }
  if (selectedClothing.length > 0) userMsg += `\nThe character wears: ${selectedClothing.map((c) => c.name).join(", ")}`;
  if (config.objective) userMsg += `\nDirection: ${config.objective}`;

  const { result } = await generateToolPrompt(activeBrand.id, "video_ad_creator", userMsg, extraVars);

  // Parse frames array — handle string, array, or nested object
  const findArray = (obj: unknown): Array<Record<string, unknown>> => {
    // If it's a string, try to parse it
    if (typeof obj === "string") {
      try {
        const parsed = JSON.parse(obj);
        return findArray(parsed);
      } catch (e) {
        // JSON parse failed — try to extract array
        // Try to extract JSON array from the string
        const str = obj as string;
        const start = str.indexOf("[");
        const end = str.lastIndexOf("]");
        if (start !== -1 && end > start) {
          try {
            const extracted = JSON.parse(str.slice(start, end + 1));
            return findArray(extracted);
          } catch { /* */ }
        }
        return [];
      }
    }
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
    .map((f, i) => {
      // Image prompt — try every possible key
      const prompt = String(
        f.prompt || f.image_prompt || f.description || f.visual || f.visuals
        || f.visual_description || f.scene_description || f.setting || ""
      );
      // Script/voiceover — try every possible key
      let script = String(
        f.script || f.voiceover || f.speech || f.text || f.narration
        || f.audio || f.dialogue || f.voice || f.voice_over || f.copy || ""
      );
      // Clean prefixes
      script = script.replace(/^(NARRATOR|VO|VOICEOVER|VOICE|SFX)\s*(\([^)]*\)\s*)?:\s*/i, "").trim();

      return {
        frame: Number(f.frame || f.scene || f.number || f.scene_number) || i + 1,
        prompt,
        scene_type: String(f.scene_type || f.type || f.category || "story"),
        script,
        transition: String(f.transition || f.movement || f.camera_movement || "fade"),
        time: String(f.time || ""),
      };
    })
    .filter((f) => f.prompt.length > 5);

  if (frames.length === 0) throw new Error(`No frames generated. Raw: ${JSON.stringify(result)?.slice(0, 300)}`);

  return { result: { frames, style: styleLabel, numScenes }, needsApproval: true };
};

// ── Base Image — generate frame 1 only ──────────────────

export const handleBaseImage: StepHandler = async (ctx) => {
  const { activeBrand, config, getStepResult, setAudioCache } = ctx;
  const scriptData = getStepResult("script") as { frames: Array<{ prompt: string; frame: number; scene_type: string; script?: string }> } | undefined;
  if (!scriptData?.frames?.[0]) throw new Error("No storyboard found.");

  const firstFrame = scriptData.frames[0];
  const selectedProduct = (activeBrand.products || []).find((p) => p.id === config.selectedProductId);
  const selectedAvatar = activeBrand.avatars?.find((a) => a.id === config.selectedAvatarId);
  const selectedClothing = (activeBrand.clothing || []).filter((c) => config.selectedClothingIds.includes(c.id));
  const selectedBackground = (activeBrand.backgrounds || []).find((b) => b.id === config.selectedBackgroundId);
  const selectedMoodboard = (activeBrand.moodboards || []).find((m) => m.id === config.selectedMoodboardId);

  // Convert uploaded reference files (e.g. from chat handoff) to data URLs
  const refFiles = (config as { referenceImages?: File[] }).referenceImages || [];
  const uploadedRefDataUrls: string[] = [];
  for (const file of refFiles.slice(0, 3)) {
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      uploadedRefDataUrls.push(dataUrl);
    } catch { /* skip */ }
  }

  const referenceUrls: string[] = [];
  // Order: uploaded refs (user intent) > avatar > clothing > product > background > moodboard
  for (const u of uploadedRefDataUrls) referenceUrls.push(u);
  if (selectedAvatar?.imageUrl) referenceUrls.push(selectedAvatar.imageUrl);
  selectedClothing.forEach((c) => { if (c.imageUrl) referenceUrls.push(c.imageUrl); });
  if (selectedProduct?.imageUrl) referenceUrls.push(selectedProduct.imageUrl);
  if (selectedBackground?.imageUrl) referenceUrls.push(selectedBackground.imageUrl);
  if (selectedMoodboard?.imageUrl) referenceUrls.push(selectedMoodboard.imageUrl);

  const imageModel = (config as unknown as Record<string, unknown>).imageModel as "nano-banana-2" | "gpt-image-2" || "nano-banana-2";

  // Append brand context + constraints
  const constraints = buildBrandConstraints(activeBrand, config, { tool: "video_ad_creator", mentionsAvatar: !!selectedAvatar });
  const brandContextBlock = buildBrandContext(activeBrand, "video_ad_creator");
  const finalPrompt = `${firstFrame.prompt}${brandContextBlock}${constraints}`;
  console.log("[video_ad] FINAL PROMPT frame 1:", finalPrompt.slice(0, 1500));

  // Fallback to text-to-image when there are zero references (otherwise the edit
  // endpoint fails with 422 — at least one image URL required).
  const job = referenceUrls.length === 0
    ? await createTextToImage(finalPrompt, config.aspectRatio, config.resolution, imageModel)
    : await createImageEdit(referenceUrls, finalPrompt, config.aspectRatio, config.resolution, imageModel);
  const result = await pollImageGen(job.request_id);
  if (result.status === "failed") throw new Error(result.error || "Image generation failed");

  // Generate audio for frame 1 if script exists
  const voiceId = config.selectedVoiceId || activeBrand.voicePresets?.[0]?.id;
  if (firstFrame.script && voiceId) {
    try {
      const { generateTTS } = await import("../../lib/api");
      const ttsResult = await generateTTS({ text: firstFrame.script, voice_id: voiceId });
      setAudioCache(`frame_1`, { url: ttsResult.audioUrl, blob: ttsResult.audioBlob });
    } catch { /* non-blocking */ }
  }

  return {
    result: {
      url: result.image_url,
      prompt: firstFrame.prompt,
      frame: 1,
      scene_type: firstFrame.scene_type,
      scriptText: firstFrame.script || "",
    },
    needsApproval: true,
  };
};

// ── Images — generate frames 2-10 using base as reference ──

export const handleImages: StepHandler = async (ctx) => {
  const { config, getStepResult } = ctx;
  const scriptData = getStepResult("script") as { frames: Array<{ prompt: string; frame: number; scene_type: string }> } | undefined;
  if (!scriptData?.frames) throw new Error("No storyboard found.");

  const baseImage = getStepResult("base_image") as { url: string } | undefined;
  if (!baseImage?.url) throw new Error("No base image found. Approve frame 1 first.");

  // Generate frames SEQUENTIALLY — each uses the previous frame as reference
  // This creates a chain of visual consistency: F1→F2→F3→...
  const remainingFrames = scriptData.frames.slice(1);
  const generatedImages: Array<{ frame: number; url: string; prompt: string; scene_type: string; script: string; status: string }> = [];

  const imageModel = (config as unknown as Record<string, unknown>).imageModel as "nano-banana-2" | "gpt-image-2" || "nano-banana-2";

  let previousFrameUrl = baseImage.url;
  for (const frame of remainingFrames) {
    try {
      // Use base image (for overall style) + previous frame (for continuity)
      const refs = [previousFrameUrl, baseImage.url];
      const prompt = `Same visual style, same character, same product as the reference images. Smooth visual transition from the previous frame. ${frame.prompt}`;
      const job = await createImageEdit(refs, prompt, config.aspectRatio, config.resolution, imageModel);
      const result = await pollImageGen(job.request_id);
      const url = result.image_url || "";
      if (url) previousFrameUrl = url; // next frame uses this as reference
      generatedImages.push({
        frame: frame.frame, url, prompt: frame.prompt,
        scene_type: frame.scene_type, script: frame.script || "", status: url ? "done" : "failed",
      });
    } catch {
      generatedImages.push({
        frame: frame.frame, url: "", prompt: frame.prompt,
        scene_type: frame.scene_type, script: frame.script || "", status: "failed",
      });
    }
  }

  // Combine: frame 1 (base) + frames 2-10
  const allFrames = [
    {
      frame: 1, url: baseImage.url,
      prompt: scriptData.frames[0].prompt,
      scene_type: scriptData.frames[0].scene_type,
      script: scriptData.frames[0].script || "",
      status: "done",
    },
    ...generatedImages,
  ];

  // Generate audio for each frame
  const voiceId = config.selectedVoiceId || activeBrand.voicePresets?.[0]?.id;
  const framesWithAudio = await Promise.all(
    allFrames.map(async (f) => {
      if (!f.script?.trim() || !voiceId) return { ...f, audioUrl: "" };
      try {
        const { fal_url } = await generateTTSAndUpload({ text: f.script, voice_id: voiceId });
        return { ...f, audioUrl: fal_url };
      } catch {
        return { ...f, audioUrl: "" };
      }
    })
  );

  return { result: { images: framesWithAudio }, needsApproval: true };
};

// ── Voice — generate audio per frame ────────────────────

export const handleVoice: StepHandler = async (ctx) => {
  const { activeBrand, config, getStepResult } = ctx;
  const scriptData = getStepResult("script") as { frames: Array<{ frame: number; script: string }> } | undefined;
  if (!scriptData?.frames) throw new Error("No script found.");

  const voiceId = config.selectedVoiceId || activeBrand.voicePresets?.[0]?.id;
  if (!voiceId) throw new Error("No voice selected. Pick a voice in the form.");

  const audioSegments = [];
  for (const frame of scriptData.frames) {
    if (!frame.script?.trim()) {
      audioSegments.push({ frame: frame.frame, script: "", audioUrl: "" });
      continue;
    }
    try {
      const { fal_url } = await generateTTSAndUpload({ text: frame.script, voice_id: voiceId });
      audioSegments.push({ frame: frame.frame, script: frame.script, audioUrl: fal_url });
    } catch {
      audioSegments.push({ frame: frame.frame, script: frame.script, audioUrl: "" });
    }
  }

  return {
    result: { audioSegments },
    needsApproval: true,
  };
};

// ── Animate — Kling frame-to-frame ──────────────────────

export const handleAnimate: StepHandler = async (ctx) => {
  const { config, getStepResult } = ctx;
  const scriptData = getStepResult("script") as { frames: Array<{ transition: string; prompt: string; animationHint?: string }> } | undefined;
  const imageData = getStepResult("images") as { images: Array<{ frame: number; url: string }> } | undefined;

  if (!imageData?.images || !scriptData?.frames) throw new Error("No images or script found.");

  const successfulImages = imageData.images.filter((img) => img.url).sort((a, b) => a.frame - b.frame);
  if (successfulImages.length < 2) throw new Error("Need at least 2 images to animate.");

  // Animate pairs: frame1→frame2, frame2→frame3, etc.
  const segments = [];
  for (let i = 0; i < successfulImages.length - 1; i++) {
    const startImg = successfulImages[i];
    const endImg = successfulImages[i + 1];
    // Use the selected style for animation prompt
    const adStyle = config.adStyle || "photorealistic";
    const styleLabel = AD_STYLES.find((s) => s.id === adStyle)?.label || adStyle;
    // USER DIRECTION del usuario tipeada/inspirada en el step images. Si está,
    // se inyecta con marca de prioridad para que Kling la respete sobre la
    // descripción genérica del style.
    const startFrameData = scriptData.frames.find((f, idx) => idx === i);
    const userDirection = startFrameData?.animationHint?.trim()
      ? ` USER DIRECTION (priority): ${startFrameData.animationHint.trim()}.`
      : "";
    const animPrompt = `Create a seamless ${styleLabel} animated transition between the first shot and the second shot in a ${styleLabel} animation style with sound effects (no talking).${userDirection}`;

    try {
      const requestId = await createKlingFrameToFrame(
        startImg.url,
        endImg.url,
        animPrompt,
        "4",
        config.aspectRatio,
      );
      const result = await pollKlingVideo(requestId);
      segments.push({
        index: i,
        videoUrl: result.video_url || "",
        startFrame: startImg.frame,
        endFrame: endImg.frame,
        status: result.video_url ? "done" : "failed",
      });
    } catch {
      segments.push({ index: i, videoUrl: "", startFrame: startImg.frame, endFrame: endImg.frame, status: "failed" });
    }
  }

  return { result: { segments }, needsApproval: true };
};

// ── Render — concat all segments + voice + subtitles ────

export const handleRender: StepHandler = async (ctx) => {
  const { activeBrand, config, getStepResult, tool } = ctx;
  const animateData = getStepResult("animate") as { segments: Array<{ videoUrl: string }> } | undefined;
  const scriptData = getStepResult("script") as { frames: Array<{ script: string }> } | undefined;
  const imageData = getStepResult("images") as { images: Array<{ audioUrl?: string }> } | undefined;

  if (!animateData?.segments) throw new Error("No animated segments found.");

  const videoUrls = animateData.segments.filter((s) => s.videoUrl).map((s) => s.videoUrl);
  if (videoUrls.length === 0) throw new Error("No valid video segments.");

  const subtitleScripts = scriptData?.frames.map((f) => ({ text: f.script || "" })) || [];

  const result = await concatVideos(videoUrls, subtitleScripts, config.subtitleEngine !== "none", config.subtitleEngine);

  // Persistence handled by autoSaveStep in ToolRunPage — no manual saveGeneration here.

  return {
    result: {
      videoUrl: result.video_url,
      totalDuration: `${result.duration}s`,
      scenes: result.num_segments,
      format: "MP4 / H.264",
    },
  };
};

// ── Helper: Kling with start + end frame ────────────────

async function createKlingFrameToFrame(
  startImageUrl: string,
  endImageUrl: string,
  prompt: string,
  duration: string = "5",
  aspectRatio: string = "9:16",
): Promise<string> {
  const API_BASE = "http://127.0.0.1:8000";
  const res = await fetch(`${API_BASE}/api/kling/frame-to-frame`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      start_image_url: startImageUrl,
      end_image_url: endImageUrl,
      prompt,
      duration,
      aspect_ratio: aspectRatio,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `Kling frame-to-frame failed (${res.status})`);
  }
  const data = await res.json();
  return data.request_id;
}
