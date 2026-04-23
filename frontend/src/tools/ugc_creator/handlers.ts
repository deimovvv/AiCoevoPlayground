/**
 * UGC Creator — Step Handlers
 * ────────────────────────────
 * Each handler is an async function that receives StepContext
 * and returns { result, needsApproval? }.
 */

import type { StepHandler } from "../types";
import {
  generateCopy, generateTTS, generateTTSAndUpload,
  createImageEdit, createTextToImage, pollImageGen,
  createHeyGenAvatar4, pollHeyGenAvatar4,
  createSyncLipsync, pollSyncLipsync,
  createKlingVideo, createKlingFrameToFrame, pollKlingVideo,
  overlayAudio,
  concatVideos, saveGeneration,
  analyzePoseReference,
  backgroundImageUrl,
} from "../../lib/api";
import { resolveSceneBackground } from "../shared/resolveBackground";

// ── Visual Style Prompts ─────────────────────────────────

const VISUAL_STYLE_PROMPTS: Record<string, string> = {
  iphone: "FORMAT: Vertical 9:16, shot on iPhone, handheld — slight natural camera shake implied, NOT a tripod shot. LIGHTING: available natural light, slightly imperfect, real-room ambiance — no studio setup, no professional lighting rigs, no even fill light. STYLE: authentic UGC selfie-style, real skin texture with natural imperfections, slightly warm color temperature, everyday real-world setting. NOT cinematic, NOT commercial photography, NOT perfectly composed. Looks like a real person filmed this at home.",
  cinematic: "FORMAT: Vertical 9:16, anamorphic lens. LIGHTING: dramatic, directional side lighting, film-quality. STYLE: cinematic, shallow depth of field, movie-grade color.",
  studio: "FORMAT: Vertical 9:16, studio setup. LIGHTING: professional 3-point lighting, clean and even. STYLE: clean commercial photography, sharp detail.",
  custom: "",
};

const getVisualStyle = (config: Record<string, unknown>): string => {
  const style = (config.visualStyle as string) || "iphone";
  if (style === "custom") return (config.visualStyleCustom as string) || VISUAL_STYLE_PROMPTS.iphone;
  return VISUAL_STYLE_PROMPTS[style] ?? VISUAL_STYLE_PROMPTS.iphone;
};

// ── Entry Hook Prompts (image generation — creates the start frame) ──────────

const HOOK_PROMPTS: Record<string, string> = {
  distracted: "Same person, same clothing, same setting. Person looking slightly off to the side, caught mid-thought, relaxed posture. Just before making eye contact with camera.",
  "empty-room": "REFERENCE IMAGE IS THE ROOM: Reproduce the reference background image with maximum fidelity. Same camera angle, same perspective, same furniture placement, same wall colors, same lighting, same decor — exactly as shown. The space must be completely EMPTY — no person, no hands, no body parts. Do NOT change the environment in any way.",
  "walks-in": "Same setting. Person entering frame from the left side, mid-step, body partially in shot. Only shoulder and arm visible, movement implied. Same clothing.",
  "looks-down": "Same person, same clothing, same setting. Person looking down at something off-screen, head slightly tilted. Caught before making eye contact with camera.",
  "phone-flip": "Back of a smartphone filling most of the frame, held by someone about to flip to selfie camera mode. Casual grip, natural hand, blurred background of the same setting.",
};

// ── Hook Kling Motion Prompts (animation — describes movement from entry frame to base image) ──

const HOOK_MOTION_PROMPTS: Record<string, string> = {
  distracted: "Person gradually turns their head and gaze toward camera, making direct eye contact. Smooth natural transition from looking away to facing forward. Subtle body language shift from distracted to engaged.",
  "empty-room": "Person walks naturally into the empty room from off-frame, enters the space confidently, and settles into position facing camera. Smooth fluid entry motion.",
  "walks-in": "Person walks into frame from the side with natural stride, moves to center position, and turns to face camera directly. Continuous natural walking motion.",
  "looks-down": "Person slowly lifts their gaze from below, head rising naturally until making direct eye contact with camera. Smooth unhurried upward head movement.",
  "phone-flip": "Smooth flip of phone from back-camera to front-camera selfie mode, transitioning to reveal the person's face looking directly into lens.",
};

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
    type CustomScene = { script: string; visual: string; sceneType?: string; location?: string; product?: boolean; avatar?: boolean };
    let entries: CustomScene[] = [];
    try {
      const parsed = JSON.parse(customScript);
      if (Array.isArray(parsed)) {
        entries = parsed
          .map((s: string | CustomScene) => typeof s === "string" ? { script: s, visual: "" } : s)
          .filter((s: CustomScene) => s.script?.trim());
      }
    } catch {
      // Parse custom script text — supports formats:
      // Format A: "1\nScript: ...\nVisual: ...\n\n2\nScript: ...\nVisual: ..."
      // Format B: "Script: ...\nVisual: ...\n\nScript: ...\nVisual: ..."
      // Format C: one line per scene (no labels)
      const raw = customScript.trim();
      const lines = raw.split("\n");

      // Collect scenes by walking lines and grouping by scene number or blank-line separator
      let currentScript = "";
      let currentVisual = "";
      const flush = () => {
        if (currentScript.trim()) {
          entries.push({ script: currentScript.trim(), visual: currentVisual.trim() });
        }
        currentScript = "";
        currentVisual = "";
      };

      let lastField: "script" | "visual" | null = null;

      for (const line of lines) {
        const trimmed = line.trim();

        // Scene number line (e.g. "1", "2", "3") — starts a new scene
        if (/^\d+$/.test(trimmed)) {
          flush();
          lastField = null;
          continue;
        }

        // Blank line — starts a new scene if we have content
        if (!trimmed) {
          if (currentScript) flush();
          lastField = null;
          continue;
        }

        // "Script: ..." line
        if (/^script\s*:/i.test(trimmed)) {
          if (currentScript && !lastField) flush(); // new scene without number/blank separator
          currentScript = trimmed.replace(/^script\s*:\s*/i, "");
          lastField = "script";
          continue;
        }

        // "Visual: ..." line
        if (/^visual\s*:/i.test(trimmed)) {
          currentVisual = trimmed.replace(/^visual\s*:\s*/i, "");
          lastField = "visual";
          continue;
        }

        // Continuation line — append to last field
        if (lastField === "visual") {
          currentVisual += " " + trimmed;
        } else if (lastField === "script") {
          currentScript += " " + trimmed;
        } else {
          // No labels — treat as script line (Format C)
          currentScript = trimmed;
          lastField = "script";
        }
      }
      flush();
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

      // Auto-select shot based on scene position — each scene gets a different shot
      const autoShot = (visual: string, isFirst: boolean, isLast: boolean, sceneIdx: number): string => {
        const v = visual.toLowerCase();
        // Only use product-specific shots if there's actually a product
        if (selectedProduct) {
          if (v.includes("solo producto") || v.includes("product only") || v.includes("sin persona")) return SHOT_MAP["product-only"];
          if (v.includes("manos") || v.includes("hands")) return SHOT_MAP["hands"];
        }
        if (v.includes("cuerpo entero") || v.includes("full body") || v.includes("outfit")) return SHOT_MAP["full-body"];
        if (v.includes("close-up")) return SHOT_MAP["close-up"];
        // Default progression
        const progression = selectedProduct && config.productIsWorn
          ? ["medium", "medium-close", "full-body", "close-up"]
          : selectedProduct
          ? ["medium-close", "medium", "close-up", "medium"]
          : ["medium-close", "close-up", "medium", "full-body"]; // no product: face/body focused
        if (isFirst) return SHOT_MAP[progression[0]];
        if (isLast) return SHOT_MAP["medium"];
        return SHOT_MAP[progression[sceneIdx % progression.length]];
      };

      const bgNote = selectedBackground?.description || selectedBackground?.name || "";

      const customScenes = entries.map((entry: CustomScene, i: number) => {
        const useAvatar = entry.avatar !== false; // default true if not specified
        const stylePrompt = getVisualStyle(config as unknown as Record<string, unknown>);
        let imagePrompt: string;

        if (!useAvatar) {
          // No-avatar scene: pure text-to-image prompt — no identity context injected
          imagePrompt = entry.visual?.trim()
            ? `${entry.visual.trim()}. ${stylePrompt}`
            : `${selectedProduct ? selectedProduct.name + " product shot" : "lifestyle scene"}. ${stylePrompt}`;
        } else {
          const bgContext = bgNote ? `in ${bgNote}` : `in ${bgDesc}`;
          const clothingDesc = selectedClothing.length > 0
            ? `wearing ${selectedClothing.map((c) => c.name).join(" and ")}`
            : "";
          const productInteraction = selectedProduct
            ? (config.productIsWorn ? `wearing ${selectedProduct.name}` : `holding ${selectedProduct.name}`)
            : "";

          // Resolve shot type — avoid product-specific shots when no product selected
          const shotKey = (entry as CustomScene & { shot?: string }).shot || "auto";
          const safeShot = !selectedProduct && (shotKey === "product-only" || shotKey === "hands") ? "auto" : shotKey;
          const shotDesc = safeShot === "auto"
            ? autoShot(entry.visual || "", i === 0, i === entries.length - 1, i)
            : (SHOT_MAP[safeShot] || SHOT_MAP["medium"]);

          if (entry.visual?.trim()) {
            const identityCtx = [avatarDesc, clothingDesc].filter(Boolean).join(", ");
            imagePrompt = `${identityCtx ? identityCtx + ". " : ""}${entry.visual.trim()}. ${shotDesc}. ${stylePrompt}`;
          } else {
            const descParts = [
              avatarDesc,
              `looking directly at camera ${bgContext}`,
              clothingDesc,
              productInteraction,
            ].filter(Boolean);
            imagePrompt = `${descParts.join(", ")}. ${shotDesc}. ${stylePrompt}`;
          }
        }

        return {
          id: `act_${i + 1}`,
          title: i === 0 ? "Hook" : i === entries.length - 1 ? "CTA" : `Scene ${i + 1}`,
          script: entry.script.trim(),
          image_prompt: imagePrompt,
          ...(entry.sceneType ? { sceneType: entry.sceneType } : {}),
          ...(entry.location ? { location: entry.location } : {}),
          ...(typeof entry.product === "boolean" ? { _showProduct: entry.product } : {}),
          ...(entry.avatar === false ? { _useAvatar: false } : {}),
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
  } else {
    notes += `\n\nNO PHYSICAL PRODUCT: The avatar is promoting a service, brand, or concept — not a physical item to hold or show. Write a natural, conversational UGC script focused on storytelling, personal experience, and brand values. The avatar should look and gesture naturally, no product in hand.`;
  }
  if (config.notes) notes += `\n${config.notes}`;

  // Duration → max words per scene (Spanish: ~2.5 words/second)
  const totalSeconds = parseInt((config as Record<string, unknown>).videoDuration as string || "30");
  const numScenes = 4;
  const maxWordsPerScene = Math.round(totalSeconds / numScenes * 2.5);
  notes += `\n\nDURATION CONSTRAINT: The total video must be approximately ${totalSeconds} seconds. Each scene script must be MAXIMUM ${maxWordsPerScene} spoken words. Count words carefully and keep scripts short and punchy. Do NOT exceed this limit.`;

  const ugcMode = (config as Record<string, unknown>).ugcMode as "standard" | "narrative" || "standard";
  const result = await generateCopy(activeBrand.id, {
    productName: selectedProduct?.name || "",
    tone: config.tone as "engaging" | "professional" | "casual" | "funny",
    platform: config.platform as "tiktok" | "instagram" | "youtube",
    language: config.language as "es" | "en",
    additionalNotes: notes,
    narrativeMode: ugcMode === "narrative",
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
  const selectedBackground = resolveSceneBackground(firstScene, config, activeBrand);
  const selectedMoodboard = (activeBrand.moodboards || []).find((m) => m.id === config.selectedMoodboardId);
  const selectedClothingItems = (activeBrand.clothing || []).filter((c) => config.selectedClothingIds.includes(c.id));

  const baseVisualStyle = getVisualStyle(config as unknown as Record<string, unknown>);
  const noTextSuffix = " Single continuous frame. NO split screen, NO collage, NO grid, NO multiple panels, NO text, NO watermarks, NO overlays.";

  // ── No-avatar scene: skip all ref images, use text-to-image ──
  if (firstScene._useAvatar === false) {
    const prompt = `${firstScene.image_prompt} ${baseVisualStyle}${noTextSuffix}`;
    const job = await createTextToImage(prompt, config.aspectRatio, config.resolution);
    const result = await pollImageGen(job.request_id);
    if (result.status === "failed") throw new Error(result.error || "Image generation failed");
    return {
      result: {
        url: result.image_url!,
        prompt: firstScene.image_prompt,
        scriptText: firstScene.script,
        inputs: { avatar: null, product: null, clothing: [], background: null },
      },
      needsApproval: true,
    };
  }

  const imageUrls: string[] = [];

  // Avatar FIRST (face/identity — highest priority)
  if (selectedAvatar?.imageUrl) imageUrls.push(selectedAvatar.imageUrl);

  // Composition reference SECOND (pose reference — optional)
  const refFiles = (config as { referenceImages?: File[] }).referenceImages || [];
  let poseDescription = "";
  for (const file of refFiles.slice(0, 1)) {
    // Convert to data URL for nano-banana (visual reference, still passed as image)
    const refDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    imageUrls.push(refDataUrl);

    // Also analyze pose with Gemini — extract body positions only (ignores style/lighting)
    try {
      const analysis = await analyzePoseReference(file);
      poseDescription = analysis.pose_description;
    } catch {
      // Non-blocking — if pose analysis fails, fall back to generic description
    }
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
  if (selectedMoodboard?.imageUrl) imageUrls.push(selectedMoodboard.imageUrl);

  // Build prompt with positional references so Nano Banana knows what each image is
  let prompt = firstScene.image_prompt;
  const refDescriptions: string[] = [];
  let imgIdx = 1;

  if (selectedAvatar?.imageUrl) {
    refDescriptions.push(`Image ${imgIdx}: the person's face and body — use this EXACT person`);
    imgIdx++;
  }
  if (refFiles.length > 0) {
    const poseNote = poseDescription
      ? `pose reference — replicate ONLY the body positions and camera framing: ${poseDescription}`
      : `pose reference — match the body positions and camera framing`;
    refDescriptions.push(`Image ${imgIdx}: ${poseNote}`);
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
  if (selectedMoodboard?.imageUrl) {
    const moodName = selectedMoodboard.description || selectedMoodboard.name || "visual style";
    refDescriptions.push(`Image ${imgIdx}: visual style moodboard — replicate this aesthetic, color palette, lighting, and mood (${moodName}). Do NOT copy people or objects literally.`);
    imgIdx++;
  }

  if (refDescriptions.length > 0) {
    prompt = `REFERENCE IMAGES:\n${refDescriptions.join("\n")}\n\n${prompt}`;
  }
  prompt += ` ${baseVisualStyle}${noTextSuffix}`;

  const job = await createImageEdit(imageUrls, prompt, config.aspectRatio, config.resolution);
  const result = await pollImageGen(job.request_id);
  if (result.status === "failed") throw new Error(result.error || "Image generation failed");

  const baseImageUrl = result.image_url!;

  // ── Auto-generate entry frame hook if configured ──────
  let entryFrameUrl: string | undefined;
  const cfgRaw = config as Record<string, unknown>;
  const hookType = (cfgRaw.hookType as string) || "none";
  const hookMode = (cfgRaw.hookMode as string) || "standard";
  const foohPrompt = (cfgRaw.foohPrompt as string) || "";

  if (hookType !== "none" && baseImageUrl) {
    if (hookMode === "fooh" && foohPrompt.trim()) {
      // FOOH mode: pure text-to-image, no avatar references — surrealist scene
      const foohJob = await createTextToImage(
        `${foohPrompt.trim()} ${baseVisualStyle} Single continuous frame. NO split screen, NO collage, NO grid, NO multiple panels, NO text, NO watermarks, NO overlays.`,
        config.aspectRatio,
        config.resolution,
      );
      const foohResult = await pollImageGen(foohJob.request_id);
      if (foohResult.status === "failed") throw new Error(`FOOH hook frame generation failed: ${foohResult.error || "unknown"}`);
      if (foohResult.image_url) entryFrameUrl = foohResult.image_url;
    } else if (hookType === "empty-room") {
      // Use the background asset directly — it IS the empty room.
      // No generation needed; any generative model would drift from the reference.
      if (selectedBackground?.imageUrl) {
        entryFrameUrl = backgroundImageUrl(selectedBackground.imageUrl);
      }
    } else {
      const hookPosePrompt = HOOK_PROMPTS[hookType];
      if (hookPosePrompt) {
        const hookJob = await createImageEdit(
          [baseImageUrl],
          `${hookPosePrompt} ${baseVisualStyle} Single continuous frame. NO split screen, NO collage, NO grid, NO multiple panels, NO text, NO watermarks, NO overlays.`
        );
        const hookResult = await pollImageGen(hookJob.request_id);
        if (hookResult.status === "failed") throw new Error(`Hook frame generation failed: ${hookResult.error || "unknown"}`);
        if (hookResult.image_url) entryFrameUrl = hookResult.image_url;
      }
    }
  }

  return {
    result: {
      url: baseImageUrl,
      prompt: firstScene.image_prompt,
      scriptText: firstScene.script,
      ...(entryFrameUrl ? { entryFrameUrl } : {}),
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
  const { activeBrand, config, getStepResult, getScriptScenes } = ctx;
  const scenes = getScriptScenes(); // already includes sceneType and user edits
  if (scenes.length === 0) throw new Error("No script scenes found.");

  const baseImageResult = getStepResult("base_image") as { url: string; entryFrameUrl?: string } | undefined;
  if (!baseImageResult?.url) throw new Error("Base image not found.");

  const selectedProduct = (activeBrand.products || []).find((p) => p.id === config.selectedProductId);
  const NUM_VARIATIONS = 2;

  // Build sceneType map from getScriptScenes (includes user overrides)
  const sceneTypeMap: Record<string, "talking" | "creative"> = {};
  const productOnlyMap: Record<string, boolean> = {};
  scenes.forEach((s) => {
    sceneTypeMap[s.id] = (s.sceneType as "talking" | "creative") || "talking";
    // Detect "product only" shot type injected by the shot type selector
    productOnlyMap[s.id] = /product only|no person|solo producto/i.test(s.image_prompt || "");
  });

  // Talking scenes: camera angle variations — person ALWAYS looks directly at camera
  const CAMERA_VARIATIONS = [
    { label: "Close-up", desc: "Tight close-up, face fills 60% of frame. EYES LOCKED ON CAMERA, speaking directly to viewer. Shot on 50mm f/1.4, very shallow depth of field, natural skin texture." },
    { label: "Medium close", desc: "Medium close-up, chest and face visible. LOOKING DIRECTLY INTO LENS, engaged and expressive. Shot on 50mm f/1.8, warm natural light." },
    { label: "Low angle", desc: "Camera positioned lower, looking slightly up at subject. DIRECT EYE CONTACT with camera, confident and authoritative. Shot on 24mm f/2.0, product held up toward camera." },
    { label: "Product forward", desc: "Product held toward camera, person LOOKING DIRECTLY AT VIEWER. Subject slightly stepped back. Shot on 85mm f/1.8, product sharp in foreground." },
    { label: "Side turn", desc: "Body angled to side but HEAD AND EYES turned fully toward camera. Direct gaze, natural expression. Shot on 35mm f/2.0, rule of thirds framing." },
    { label: "Lean in", desc: "Person leaning slightly forward, close to camera, EYES FIXED ON LENS, intimate and direct. Shot on 35mm f/1.4, close personal framing." },
  ];

  // Creative scenes: action/product-interaction variations (voiceover plays over scene)
  const productName = selectedProduct?.name || "the product";
  const ACTION_VARIATIONS = [
    { label: "Usando producto", desc: `Close-up of hands actively applying or using ${productName}. Ultra-realistic, product clearly visible and in use, 85mm macro, extreme shallow depth of field. Person NOT looking at camera — focused on action.` },
    { label: "Lifestyle", desc: `Person in natural lifestyle context interacting with ${productName} — pouring, applying, holding up. Medium shot, candid organic feel, 35mm f/2.0. Eyes on the product, not on camera.` },
    { label: "Detalle producto", desc: `Extreme close-up of ${productName} showing texture, finish, packaging and branding. Product centered or held prominently. 100mm macro style. No face needed.` },
    { label: "Resultado", desc: `Person showing the visible result or transformation from using ${productName}. Satisfied or surprised expression, before/after implied. Medium close-up 50mm f/1.4. Authentic emotion.` },
    { label: "Ambiente", desc: `Wide lifestyle scene — person using ${productName} in a beautifully lit environment. Context-rich, editorial feel, 24mm f/2.8 wide angle. Brand aesthetic matches surroundings.` },
    { label: "Mano producto", desc: `Product held up close to camera against clean background, person's hand and wrist visible. Studio-quality lighting, sharp product detail. Shot on 85mm f/2.0.` },
  ];

  const ugcMode = (config as Record<string, unknown>).ugcMode as "standard" | "narrative" || "standard";
  const isNarrativeMode = ugcMode === "narrative";

  // Scene 1 = base image directly (always talking — hook scene)
  // Carry over entryFrameUrl so it propagates to curation and lipsync
  const scene1Type: "talking" | "creative" = sceneTypeMap[scenes[0].id] || "talking";
  const multishotResults: Array<{
    sceneId: string; title: string; sceneType: "talking" | "creative";
    variations: Array<{ id: string; url: string; label: string; prompt: string }>;
    entryFrameUrl?: string;
    hookVideoUrl?: string;
  }> = [{
    sceneId: scenes[0].id,
    title: scenes[0].title,
    sceneType: scene1Type,
    variations: [{ id: `${scenes[0].id}_v1`, url: baseImageResult.url, label: "Base image", prompt: "" }],
    ...(baseImageResult.entryFrameUrl ? { entryFrameUrl: baseImageResult.entryFrameUrl } : {}),
  }];

  // Standard mode: same person + same location throughout
  // Narrative mode: same person + clothes, but location CHANGES per scene
  const consistency = isNarrativeMode
    ? "SAME EXACT person, same clothes, same hair as the reference image. The setting/location CHANGES — follow the scene prompt for the new environment."
    : "Same EXACT person, same clothes, same background/environment as image 1. Do NOT change the setting or location.";

  // Narrative mode: extended scene type variations
  const NARRATIVE_VARIATIONS: Record<string, Array<{ label: string; desc: string }>> = {
    lifestyle: [
      { label: "Lifestyle v1", desc: `Person in natural lifestyle context interacting with ${productName}. Candid, organic feel — NOT looking at camera. 35mm f/2.0 medium shot.` },
      { label: "Lifestyle v2", desc: `Candid moment of person using ${productName} in daily routine. Soft natural light, environment tells the story. Eyes on the action, not camera.` },
    ],
    sensorial: [
      { label: "Sensorial v1", desc: `Extreme close-up of ${productName} — texture, surface, packaging detail. 100mm macro, ultra-sharp, beautiful lighting. Evokes touch and smell.` },
      { label: "Sensorial v2", desc: `Close-up of the result of using ${productName} — skin, fabric, surface transformation. 85mm macro, shallow depth of field, warm light.` },
    ],
    product_reveal: [
      { label: "Product reveal v1", desc: `${productName} naturally integrated in the scene — on a surface, in the environment. Person nearby but not holding it. Organic product placement.` },
      { label: "Product reveal v2", desc: `${productName} in the foreground, slightly blurred person visible behind. Elegant product-forward composition, 85mm f/1.8.` },
    ],
  };

  const totalScenes = scenes.length; // includes scene 0

  const remainingResults = await Promise.all(
    scenes.slice(1).map(async (scene, sceneIdx) => {
      const sceneType = sceneTypeMap[scene.id] || "talking";
      const noAvatar = scene._useAvatar === false;
      const narrativeSceneType = (scene as Record<string, unknown>).narrativeSceneType as string | undefined || sceneType;
      const isProductOnly = productOnlyMap[scene.id] || false;
      const sceneDirection = scene.image_prompt || "";
      const sceneLocation = (scene as Record<string, unknown>).location as string || "";
      const cleanDirection = sceneDirection.replace(/Shot on \d+mm[^.]*\.|Shot from [^.]*\.|product only[^.]*\.|no person[^.]*/gi, "").trim();

      // Per-scene background: override base image reference when set specifically
      const sceneBackground = resolveSceneBackground(scene, config, activeBrand);

      // Location prompt: prefer per-scene background description > narrative location > nothing
      let locationContext = "";
      if (sceneBackground && scene.backgroundId !== undefined) {
        // Scene has EXPLICIT background (not inherited from config) — make it dominant
        const bgDesc = sceneBackground.description || sceneBackground.name;
        locationContext = `SETTING: ${bgDesc}. This scene takes place in this EXACT location, NOT in the same setting as scene 1. `;
      } else if (scene.backgroundId === null) {
        // Explicitly no background — let Nano Banana generate from prompt only
        locationContext = sceneLocation ? `SETTING: ${sceneLocation}. ` : "";
      } else if (isNarrativeMode && sceneLocation) {
        locationContext = `SETTING: ${sceneLocation}. `;
      }

      // Narrative mode: frame-in / frame-out transition hints
      // Talking scenes receive a cut — they need a strong frame-IN (avatar arriving/beginning to speak)
      // Creative/sensorial/lifestyle scenes need a frame-OUT that bridges to the next scene
      let frameNote = "";
      if (isNarrativeMode) {
        const sceneAbsIdx = sceneIdx + 1; // absolute index in scenes array (0-based)
        const isLastScene = sceneAbsIdx === totalScenes - 1;
        const prevSceneId = scenes[sceneAbsIdx - 1]?.id;
        const prevType = prevSceneId ? (sceneTypeMap[prevSceneId] || "talking") : "talking";
        const nextSceneId = scenes[sceneAbsIdx + 1]?.id;
        const nextType = nextSceneId ? (sceneTypeMap[nextSceneId] || "talking") : null;

        if (sceneType === "talking") {
          // This talking scene receives a cut from the previous scene
          // Avatar should look like they're MID-ARRIVAL — beginning of the moment, not the end
          // Keep it subtle so it doesn't override the avatar reference
          frameNote = isLastScene
            ? "Composition: avatar centered, slight forward lean, warm closing energy. "
            : "Composition: avatar mid-arrival, slight forward lean, beginning of a moment. ";
        } else if (!isLastScene && nextType === "talking") {
          // Creative scene before a talking scene: energy/gaze directed toward camera
          frameNote = "FRAME-OUT: Final composition has subject's gaze, hand, or energy slightly directed toward camera — natural visual bridge to direct address in next scene. ";
        } else if (prevType === "talking") {
          // Creative scene right after a talking scene: picks up that energy
          frameNote = "FRAME-IN: Scene opens mid-action, as if continuing from a previous moment of energy. ";
        }
      }

      // Decide whether to include the product image as a reference for this scene.
      // Product appears when: product-only shot, talking scene, last scene (CTA),
      // scene explicitly requests it (_showProduct: true), or visual direction mentions the product.
      // Lifestyle / emotional scenes (park, kitchen activity) should NOT have product forced in.
      const sceneShowProduct = (scene as Record<string, unknown>)._showProduct as boolean | undefined;
      const productMentionedInDirection = selectedProduct
        ? cleanDirection.toLowerCase().includes(selectedProduct.name.toLowerCase()) ||
          cleanDirection.toLowerCase().includes("product") ||
          cleanDirection.toLowerCase().includes("bottle") ||
          cleanDirection.toLowerCase().includes("frasco") ||
          cleanDirection.toLowerCase().includes("producto")
        : false;
      const includeProduct = selectedProduct?.imageUrl && (
        isProductOnly ||
        sceneType === "talking" ||
        sceneIdx === scenes.slice(1).length - 1 || // last scene
        sceneShowProduct === true ||
        (sceneShowProduct !== false && productMentionedInDirection)
      );

      // Per-scene background image reference (only when scene has an EXPLICIT backgroundId)
      const hasExplicitSceneBg = scene.backgroundId !== undefined && scene.backgroundId !== null && !!sceneBackground?.imageUrl;
      const sceneBgRef: string[] = hasExplicitSceneBg ? [sceneBackground!.imageUrl] : [];

      const sceneRefs: string[] = isProductOnly
        ? (selectedProduct?.imageUrl ? [selectedProduct.imageUrl, ...sceneBgRef] : [baseImageResult.url, ...sceneBgRef])
        : includeProduct
          ? [baseImageResult.url, selectedProduct!.imageUrl, ...sceneBgRef]
          : [baseImageResult.url, ...sceneBgRef];

      const variations = await Promise.all(
        Array.from({ length: NUM_VARIATIONS }, async (_, vi) => {
          let prompt: string;

          const noText = "Single continuous frame. NO split screen, NO collage, NO grid, NO multiple panels, NO text, NO watermarks, NO overlays. ";
          const styleBlock = getVisualStyle(config as Record<string, unknown>) + " ";

          // Build reference header so model knows what each reference image is
          const bgRefLine = hasExplicitSceneBg
            ? `Image ${includeProduct ? 3 : 2}: the setting/location — place the person INSIDE this environment, match the lighting and ambiance of this reference.\n`
            : "";
          const refHeader = isProductOnly
            ? ""
            : includeProduct
              ? `REFERENCE IMAGES:\nImage 1: the person — use this EXACT face, hair, body, clothing.\nImage 2: "${productName}" — use this EXACT product, same packaging, same color, same design.\n${bgRefLine}\n`
              : `REFERENCE IMAGES:\nImage 1: the person — use this EXACT face, hair, body, clothing.\n${bgRefLine}\n`;

          // When a specific visual direction is provided (>40 chars), it's intentional and detailed —
          // use it directly without overriding with generic camera/action variations.
          // Generic variations are only used as fallback when no direction is given.
          const hasSpecificDirection = cleanDirection.length > 40;

          if (noAvatar) {
            // No-avatar scene: text-to-image, no person reference injected
            // Use the visual direction directly with product context if needed
            const productCtx = includeProduct ? `${productName} visible in the scene. ` : "";
            prompt = `${locationContext}${cleanDirection}. ${productCtx}${styleBlock}${noText}`;
          } else if (isProductOnly) {
            // Product-only: clean product studio shot, no person
            const productShots = [
              `${cleanDirection || `${productName} product shot`}. Clean studio background, product centered, sharp detail, professional lighting, 85mm macro. NO PERSON in frame. ${noText}`,
              `${cleanDirection || `${productName} flat lay`}. Overhead flat-lay on elegant surface, ${productName} surrounded by complementary props. NO PERSON in frame. ${noText}`,
            ];
            prompt = productShots[vi % productShots.length];
          } else if (hasSpecificDirection) {
            // Specific visual direction — respect it exactly, no generic variation override
            // Still enforce consistency (same person) and style, but no camera/action suffix
            const eyeContact = sceneType === "talking"
              ? "Person looks DIRECTLY INTO CAMERA, engaged and present. "
              : "";
            prompt = `${refHeader}${frameNote}${locationContext}${cleanDirection}. ${eyeContact}${consistency} ${styleBlock}${noText}`;
          } else if (isNarrativeMode && narrativeSceneType in NARRATIVE_VARIATIONS) {
            // Narrative scene types: lifestyle, sensorial, product_reveal
            const pool = NARRATIVE_VARIATIONS[narrativeSceneType];
            const variant = pool[vi % pool.length];
            prompt = `${refHeader}${frameNote}${locationContext}${variant.desc} ${consistency} ${styleBlock}${noText}`;
          } else if (sceneType === "creative") {
            const pool = ACTION_VARIATIONS;
            const idx = (sceneIdx * NUM_VARIATIONS + vi) % pool.length;
            const variant = pool[idx];
            prompt = `${refHeader}${frameNote}${locationContext}${variant.desc} ${consistency} ${styleBlock}${noText}`;
          } else {
            // Talking: always direct eye contact to camera
            const pool = CAMERA_VARIATIONS;
            const idx = (sceneIdx * NUM_VARIATIONS + vi) % pool.length;
            const variant = pool[idx];
            prompt = `${refHeader}${frameNote}${locationContext}${variant.desc} ${consistency} ${styleBlock}${noText}`;
          }

          const job = noAvatar
            ? await createTextToImage(prompt, config.aspectRatio, config.resolution)
            : await createImageEdit(sceneRefs, prompt, config.aspectRatio, config.resolution);
          const pollResult = await pollImageGen(job.request_id);
          let label: string;
          if (isProductOnly) {
            label = `Producto v${vi + 1}`;
          } else if (isNarrativeMode && narrativeSceneType in NARRATIVE_VARIATIONS) {
            label = NARRATIVE_VARIATIONS[narrativeSceneType][vi % NARRATIVE_VARIATIONS[narrativeSceneType].length].label;
          } else if (sceneType === "creative") {
            label = ACTION_VARIATIONS[(sceneIdx * NUM_VARIATIONS + vi) % ACTION_VARIATIONS.length].label;
          } else {
            label = CAMERA_VARIATIONS[(sceneIdx * NUM_VARIATIONS + vi) % CAMERA_VARIATIONS.length].label;
          }
          return { id: `${scene.id}_v${vi + 1}`, url: pollResult.image_url || "", label, prompt };
        })
      );
      return { sceneId: scene.id, title: scene.title, sceneType: isProductOnly ? "creative" as const : sceneType, variations };
    })
  );
  multishotResults.push(...remainingResults);

  // ── Hook video: generate Kling f2f for scene 1 if entry frame exists ──
  // Run in parallel with f2f analysis so it doesn't block
  const scene1 = multishotResults[0];
  const hookType = (config as Record<string, unknown>).hookType as string || "none";
  const hookMode = (config as Record<string, unknown>).hookMode as string || "standard";
  // Use entry frame whenever one exists — either from config hookType or manual generation
  if (scene1?.entryFrameUrl) {
    const isFooh = hookMode === "fooh";
    const motionPrompt = isFooh
      ? "Surrealist scene dissolves and transitions into a real-world UGC setting. Smooth cinematic transition, visual energy flowing from the fantastical into the personal. The world shifts from extraordinary to intimate."
      : (HOOK_MOTION_PROMPTS[hookType] || "Person naturally arrives into position, settles, and faces camera directly. Smooth fluid entry.");
    const hookJob = await createKlingFrameToFrame({
      start_image_url: scene1.entryFrameUrl,
      end_image_url: scene1.variations[0].url,
      prompt: motionPrompt + " Natural fluid movement, single continuous shot, photorealistic.",
      duration: "3",
    });
    const hookResult = await pollKlingVideo(hookJob.request_id);
    if (hookResult.status === "failed") throw new Error(`Hook video generation failed: ${hookResult.error || "unknown"}`);
    if (hookResult.video_url) scene1.hookVideoUrl = hookResult.video_url;
  }

  // ── Intelligent frame-to-frame suggestion per scene ──────
  // Analyze adjacent creative scene pairs and suggest f2f when it makes narrative sense.
  // Rules:
  //   - Only creative scenes can have f2f
  //   - If next scene is talking → single frame (visual cut is natural)
  //   - If both creative → compare location/setting keywords; suggest f2f when they share the same space
  const getLocationKeywords = (text: string): Set<string> => {
    const stopwords = new Set(["that", "this", "with", "from", "into", "over", "same", "exact", "very", "natural", "shot", "close", "medium", "ultra", "frame", "image"]);
    return new Set(
      text.toLowerCase().split(/\W+/).filter(w => w.length > 4 && !stopwords.has(w))
    );
  };

  for (let i = 0; i < multishotResults.length; i++) {
    const curr = multishotResults[i] as typeof multishotResults[0] & { frameToFrame?: boolean; frameToFrameNote?: string };
    if (curr.sceneType !== "creative") continue;

    const next = multishotResults[i + 1] as (typeof multishotResults[0] & { frameToFrame?: boolean }) | undefined;
    if (!next) {
      // Last scene — no next scene to transition to
      curr.frameToFrame = false;
      curr.frameToFrameNote = "Last scene — single frame";
      continue;
    }

    if (next.sceneType !== "creative") {
      // Talking scene follows — visual cut is cleaner
      curr.frameToFrame = false;
      curr.frameToFrameNote = "Talking scene follows — single frame recommended";
      continue;
    }

    // Both creative — check location/setting similarity
    const currScene = scenes.find(s => s.id === curr.sceneId);
    const nextScene = scenes.find(s => s.id === next.sceneId);
    const currWords = getLocationKeywords(currScene?.image_prompt || "");
    const nextWords = getLocationKeywords(nextScene?.image_prompt || "");
    const shared = [...currWords].filter(w => nextWords.has(w));

    if (shared.length >= 2) {
      curr.frameToFrame = true;
      curr.frameToFrameNote = `Same setting (${shared.slice(0, 2).join(", ")}) — frame-to-frame suggested`;
    } else {
      curr.frameToFrame = false;
      curr.frameToFrameNote = "Different settings — single frame recommended";
    }
  }

  return { result: multishotResults, needsApproval: true };
};

// ── Curation (manual — returns immediately) ──────────────

export const handleCuration: StepHandler = async () => {
  // Curation is handled by the UI — no backend logic
  return { result: null };
};

// ── Voice ────────────────────────────────────────────────

/** Measure duration of an audio blob in seconds using the Web Audio API */
function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.addEventListener("loadedmetadata", () => {
      URL.revokeObjectURL(url);
      resolve(isFinite(audio.duration) ? audio.duration : 0);
    });
    audio.addEventListener("error", () => { URL.revokeObjectURL(url); resolve(0); });
  });
}

export const handleVoice: StepHandler = async (ctx) => {
  const { activeBrand, config, getScriptScenes, setAudioCache } = ctx;
  const scenes = getScriptScenes();
  const voiceId = config.selectedVoiceId || activeBrand.voicePresets?.[0]?.id;

  // Voice settings from config — applied to every scene
  const voiceOpts = {
    stability: config.voiceStability,
    similarity_boost: config.voiceSimilarityBoost,
    style: config.voiceStyle,
    speed: config.voiceSpeed,
    use_speaker_boost: config.voiceSpeakerBoost,
  };

  const voiceResults: Array<{ sceneId: string; title: string; script: string; audioUrl: string; falUrl: string; durationSecs: number }> = [];

  for (const scene of scenes) {
    if (scene.script) {
      // Generate TTS and upload to Fal in one call — so lipsync can reuse the fal_url
      const { fal_url } = await generateTTSAndUpload({ text: scene.script, voice_id: voiceId, ...voiceOpts });
      // Also generate local audio for playback preview
      const ttsResult = await generateTTS({ text: scene.script, voice_id: voiceId, ...voiceOpts });
      setAudioCache(scene.id, { url: ttsResult.audioUrl, blob: ttsResult.audioBlob });
      const durationSecs = await getAudioDuration(ttsResult.audioBlob);
      voiceResults.push({
        sceneId: scene.id,
        title: scene.title,
        script: scene.script,
        audioUrl: ttsResult.audioUrl,
        falUrl: fal_url,
        durationSecs,
      });
    }
  }

  return { result: voiceResults, needsApproval: true };
};

// ── Lipsync ──────────────────────────────────────────────
// Supports two methods for talking scenes:
//   "heygen"      → static image + audio → HeyGen Avatar 4
//   "synclipsync" → static image → Kling → Sync Lipsync V3
// Creative scenes always use Kling only (single-frame or frame-to-frame).

export const handleLipsync: StepHandler = async (ctx) => {
  const { activeBrand, config, getStepResult, getScriptScenes } = ctx;

  const lipsyncMethod = (config as Record<string, unknown>).lipsyncMethod as "heygen" | "synclipsync" || "heygen";

  // Read selections from multishot approval
  const multishotResult = getStepResult("multishot") as { selections?: Array<{ sceneId: string; title: string; selectedUrl: string }> } | Array<{ sceneId: string; title: string; selectedUrl: string }> | undefined;
  const curationData = multishotResult && "selections" in (multishotResult as Record<string, unknown>)
    ? (multishotResult as { selections: Array<{ sceneId: string; title: string; selectedUrl: string }> }).selections
    : (getStepResult("curation") as Array<{ sceneId: string; title: string; selectedUrl: string }> | undefined);

  if (!curationData) throw new Error("No curated images found. Approve the Multishot step first.");

  // Per-scene frame-to-frame and entry frame from multishot data (set by user in shots step)
  type MultishotScene = { sceneId: string; frameToFrame?: boolean; entryFrameUrl?: string; hookVideoUrl?: string };
  const rawMultishotData = Array.isArray(getStepResult("multishot"))
    ? (getStepResult("multishot") as MultishotScene[])
    : [];
  const getSceneF2F = (sceneId: string) =>
    rawMultishotData.find(s => s.sceneId === sceneId)?.frameToFrame ?? false;
  const getEntryFrame = (sceneId: string) =>
    rawMultishotData.find(s => s.sceneId === sceneId)?.entryFrameUrl;
  const getHookVideo = (sceneId: string) =>
    rawMultishotData.find(s => s.sceneId === sceneId)?.hookVideoUrl;

  const voiceData = getStepResult("voice") as Array<{
    sceneId: string; script: string; audioUrl: string; falUrl: string; durationSecs?: number;
  }> | undefined;

  const scenes = getScriptScenes();
  const heygenAR = config.aspectRatio === "4:5" ? "9:16" : config.aspectRatio;
  const heygenRes = config.resolution === "4K" || config.resolution === "2K" ? "1080p" : "720p";

  // Build scene type map from script result (normalized in DoneStep)
  const scriptResult = getStepResult("script") as Record<string, unknown> | undefined;
  const rawScenes = scriptResult?.scenes
    ? ((scriptResult.scenes as Array<Array<Record<string, unknown>>>)[0] || [])
    : [];
  const sceneTypeMap: Record<string, "talking" | "creative"> = {};
  rawScenes.forEach((s) => {
    const id = String(s.id || "");
    sceneTypeMap[id] = (s.sceneType as "talking" | "creative") || "talking";
  });

  // Suffix applied to ALL Kling prompts — ensures natural motion, prevents split/double image artifacts
  const KLING_MOTION_SUFFIX = " Natural fluid movement, organic motion, single continuous shot, one person only, no split screen, no duplicate frames, photorealistic, subtle camera movement.";

  // Hook type for entry frame motion prompt
  const hookType = (config as Record<string, unknown>).hookType as string || "none";

  // Helper: animate with Kling — uses per-scene f2f flag from multishot data
  const animateWithKling = async (
    scene: { sceneId: string; title: string; selectedUrl: string },
    sceneIdx: number,
    imagePrompt: string,
    startFrameOverride?: string, // optional: use this as start frame instead of scene.selectedUrl
    durationOverride?: string,
  ): Promise<string> => {
    const prompt = imagePrompt + KLING_MOTION_SUFFIX;
    const useF2F = getSceneF2F(scene.sceneId);
    const startFrame = startFrameOverride || scene.selectedUrl;
    const duration = durationOverride || "5";

    if (startFrameOverride || useF2F) {
      // Frame-to-frame: startFrame → end frame
      const endFrame = startFrameOverride
        ? scene.selectedUrl                          // entry frame → in-position image
        : curationData[sceneIdx + 1]?.selectedUrl;  // scene → next scene
      if (endFrame && endFrame !== startFrame) {
        const job = await createKlingFrameToFrame({
          start_image_url: startFrame,
          end_image_url: endFrame,
          prompt,
          duration,
        });
        const result = await pollKlingVideo(job.request_id);
        if (result.status !== "failed" && result.video_url) return result.video_url;
        // Fall through to single-frame on failure
      }
    }
    // Single-frame (default or fallback)
    const job = await createKlingVideo(startFrame, prompt, duration);
    const result = await pollKlingVideo(job.request_id);
    if (result.status === "failed") throw new Error(`Kling failed for "${scene.title}"`);
    return result.video_url || scene.selectedUrl;
  };

  // Helper: get or generate hook intro video (entry frame → base image, 3s, no audio)
  // Reuses hookVideoUrl from multishot if already generated there — skips regeneration
  const generateHookVideo = async (
    scene: { sceneId: string; title: string; selectedUrl: string },
  ): Promise<string | undefined> => {
    // Reuse if already generated in Shots step
    const existing = getHookVideo(scene.sceneId);
    if (existing) return existing;
    // Fallback: generate now (e.g. if multishot was skipped or hook added later)
    const entryFrame = getEntryFrame(scene.sceneId);
    if (!entryFrame) return undefined;
    const motionPrompt = HOOK_MOTION_PROMPTS[hookType] ||
      "Person naturally arrives into position, settles, and faces camera directly. Smooth fluid entry.";
    try {
      const job = await createKlingFrameToFrame({
        start_image_url: entryFrame,
        end_image_url: scene.selectedUrl,
        prompt: motionPrompt + KLING_MOTION_SUFFIX,
        duration: "3",
      });
      const result = await pollKlingVideo(job.request_id);
      if (result.status !== "failed" && result.video_url) return result.video_url;
    } catch { /* hook is optional, don't break the pipeline */ }
    return undefined;
  };

  const lipsyncResults: Array<{
    sceneId: string; title: string; scriptText: string;
    videoUrl: string; hookVideoUrl?: string; imageUrl: string; sceneType: string;
  }> = [];

  for (let i = 0; i < curationData.length; i++) {
    const scene = curationData[i];
    let sceneType = sceneTypeMap[scene.sceneId] || "talking";

    const scriptScene = scenes.find((s) => s.id === scene.sceneId) || scenes[i];

    // Avatar OFF → force creative lipsync path (Kling + audio overlay), no face-lipsync
    const sceneUseAvatar = (scriptScene as { _useAvatar?: boolean } | undefined)?._useAvatar;
    if (sceneUseAvatar === false && sceneType === "talking") {
      sceneType = "creative";
    }

    const voiceEntry = Array.isArray(voiceData)
      ? voiceData.find((v) => v.sceneId === scene.sceneId) || voiceData[i]
      : undefined;
    const scriptText = voiceEntry?.script || scriptScene?.script || "";
    // Talking scenes without audio are skipped — creative scenes always get animated (no audio needed)
    if (!scriptText && sceneType !== "creative") continue;

    const falAudioUrl = voiceEntry?.falUrl;
    // Talking scene missing audio = hard error. Creative scenes can proceed without audio.
    if (!falAudioUrl && sceneType !== "creative") {
      throw new Error(`No audio found for "${scene.title}". Complete the Voice step first.`);
    }
    const klingPrompt = scriptScene?.image_prompt || (scriptText ? `${scriptText} — cinematic, smooth motion` : "Smooth cinematic motion, natural movement");

    // Pick Kling clip duration: round audio up to nearest Kling step (5 or 10s). Visual-only → 5s.
    const audioDuration = voiceEntry?.durationSecs ?? 0;
    const klingDuration: string = audioDuration > 5 ? "10" : "5";

    // ── Hook intro video: always runs for scene 1 when entry frame exists ──
    // Independent of lipsync method — generates a short f2f clip (entry → base image)
    // that gets prepended to the lipsync video in render
    const hookVideoUrl = i === 0 ? await generateHookVideo(scene) : undefined;

    // ── Creative scene: Kling → optional FFmpeg audio overlay ──────
    if (sceneType === "creative") {
      const klingVideoUrl = await animateWithKling(scene, i, klingPrompt, undefined, klingDuration);
      // If no audio (empty script scene), use Kling video as-is
      if (!falAudioUrl) {
        lipsyncResults.push({
          sceneId: scene.sceneId,
          title: scene.title,
          scriptText: "",
          videoUrl: klingVideoUrl.startsWith("http") ? klingVideoUrl : `http://localhost:8000${klingVideoUrl}`,
          hookVideoUrl,
          imageUrl: scene.selectedUrl,
          sceneType: "creative",
        });
        continue;
      }
      const overlayResult = await overlayAudio(
        klingVideoUrl.startsWith("http") ? klingVideoUrl : `http://localhost:8000${klingVideoUrl}`,
        falAudioUrl,
      );
      lipsyncResults.push({
        sceneId: scene.sceneId,
        title: scene.title,
        scriptText,
        videoUrl: overlayResult.video_url.startsWith("http")
          ? overlayResult.video_url
          : `http://localhost:8000${overlayResult.video_url}`,
        hookVideoUrl,
        imageUrl: scene.selectedUrl,
        sceneType: "creative",
      });
      continue;
    }

    // ── Talking scene: método elegido ─────────────────────
    if (lipsyncMethod === "synclipsync") {
      // Kling: single-frame body motion (no f2f here — hook is handled separately above)
      const klingVideoUrl = await animateWithKling(
        scene, i,
        "Subtle natural body movement, gentle breathing, slight head sway, relaxed gestures. Neutral closed mouth expression. No speaking, no lip movement.",
        undefined,
        klingDuration,
      );
      const lipsyncJob = await createSyncLipsync({
        video_url: klingVideoUrl.startsWith("http") ? klingVideoUrl : `http://localhost:8000${klingVideoUrl}`,
        audio_url: falAudioUrl!,
        sync_mode: "cut_off",
      });
      const lipsyncResult = await pollSyncLipsync(lipsyncJob.request_id);
      if (lipsyncResult.status === "failed") throw new Error(`Sync Lipsync failed for "${scene.title}"`);
      lipsyncResults.push({
        sceneId: scene.sceneId,
        title: scene.title,
        scriptText,
        videoUrl: lipsyncResult.video_url || klingVideoUrl,
        hookVideoUrl,
        imageUrl: scene.selectedUrl,
        sceneType: "talking",
      });
    } else {
      // HeyGen Avatar 4 (default)
      const job = await createHeyGenAvatar4({
        image_url: scene.selectedUrl,
        audio_url: falAudioUrl!,
        talking_style: "expressive",
        aspect_ratio: heygenAR,
        resolution: heygenRes,
      });
      const result = await pollHeyGenAvatar4(job.request_id);
      if (result.status === "failed") throw new Error(result.error || `Lip-sync failed for "${scene.title}"`);
      lipsyncResults.push({
        sceneId: scene.sceneId,
        title: scene.title,
        scriptText,
        videoUrl: result.video_url || scene.selectedUrl,
        hookVideoUrl,
        imageUrl: scene.selectedUrl,
        sceneType: "talking",
      });
    }
  }

  return { result: lipsyncResults, needsApproval: true };
};

// ── Render (FFmpeg concat + subtitles) ───────────────────

export const handleRender: StepHandler = async (ctx) => {
  const { activeBrand, config, getStepResult, getScriptScenes, tool } = ctx;
  const lipsyncData = getStepResult("lipsync") as Array<{
    sceneId: string; title: string; scriptText?: string; videoUrl: string; hookVideoUrl?: string;
  }> | undefined;

  if (!lipsyncData || lipsyncData.length === 0) throw new Error("No lip-sync videos found.");

  const scriptScenes = getScriptScenes();

  // Build video list: prepend hookVideoUrl (no subtitle) before scene 1 lipsync if present
  const videoUrls: string[] = [];
  const subtitleScripts: { text: string }[] = [];
  for (const seg of lipsyncData) {
    if (seg.hookVideoUrl) {
      videoUrls.push(seg.hookVideoUrl);
      subtitleScripts.push({ text: "" }); // hook plays silently — no subtitle
    }
    videoUrls.push(seg.videoUrl);
    const scene = scriptScenes.find((s) => s.id === seg.sceneId);
    subtitleScripts.push({ text: seg.scriptText || scene?.script || "" });
  }

  if (videoUrls.length === 0) throw new Error("No valid video URLs.");

  // Generate both versions: with and without subtitles
  const [resultWithSubs, resultNoSubs] = await Promise.all([
    concatVideos(videoUrls, subtitleScripts, true, config.subtitleEngine === "none" ? "auto" : config.subtitleEngine),
    concatVideos(videoUrls, subtitleScripts, false, "none"),
  ]);

  // Save to content library with full pipeline state
  const selectedProduct = (activeBrand.products || []).find((p) => p.id === config.selectedProductId);
  const baseImg = getStepResult("base_image") as { url: string } | undefined;
  try {
    const allSteps = ctx.getAllSteps?.() || [];
    await saveGeneration({
      brandId: activeBrand.id,
      toolId: tool.id,
      title: `UGC — ${selectedProduct?.name || "Video"} — ${new Date().toLocaleDateString()}`,
      type: "video",
      status: "completed",
      thumbnailUrl: baseImg?.url,
      outputUrl: resultWithSubs.video_url,
      scenes: scriptScenes.map((s) => ({ id: s.id, title: s.title, script: s.script })),
      metadata: { language: config.language, numScenes: scriptScenes.length, duration: resultWithSubs.duration },
      pipelineState: {
        steps: allSteps,
        config: { ...config, referenceImages: undefined, graphicAssets: undefined }, // strip File objects
        curationSelections: ctx.curationSelections || {},
      },
    });
  } catch { /* silent */ }

  const fps = 30;
  const avgDuration = (resultWithSubs.duration / lipsyncData.length) * fps;
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
      videoUrl: resultWithSubs.video_url,
      videoUrlNoSubs: resultNoSubs.video_url,
      totalDuration: `${resultWithSubs.duration}s`,
      scenes: resultWithSubs.num_segments,
      format: "MP4 / H.264",
      resolution: "1080x1920 (9:16)",
      sizeBytes: resultWithSubs.size_bytes,
      subtitleEngine: config.subtitleEngine,
      remotionScenes,
    },
  };
};
