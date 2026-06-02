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
  createSeedanceReferenceToVideo, pollSeedanceVideo,
  overlayAudio,
  concatVideos,
  analyzePoseReference,
  avatarImageUrl, clothingImageUrl, productImageUrl, backgroundImageUrl,
} from "../../lib/api";
import { buildBrandConstraints, buildBrandContext } from "../shared/brandConstraints";
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

  // Custom script bypass — skip Gemini, use user's script directly.
  // Coerce defensively: the agent's response sometimes lands here as an actual
  // array (parsed JSON) instead of a stringified one — when that happens, we
  // re-stringify so the existing JSON.parse path below works untouched. Also
  // handle the case where the field is missing or already an object.
  const rawCustomScript = (config as unknown as Record<string, unknown>).customScript;
  const customScript: string = typeof rawCustomScript === "string"
    ? rawCustomScript
    : Array.isArray(rawCustomScript)
      ? JSON.stringify(rawCustomScript)
      : rawCustomScript && typeof rawCustomScript === "object"
        ? JSON.stringify(rawCustomScript)
        : "";
  if (customScript.trim()) {
    type CustomScene = { script: string; visual: string; sceneType?: string; location?: string; product?: boolean; avatar?: boolean; backgroundId?: string | null; shot?: string; title?: string };
    let entries: CustomScene[] = [];
    try {
      const parsed = JSON.parse(customScript);
      if (Array.isArray(parsed)) {
        entries = parsed
          .map((s: string | CustomScene) => typeof s === "string" ? { script: s, visual: "" } : s)
          // Keep scenes that have ANY signal: script text, OR sceneType=creative (silent b-roll
          // legitimately has empty script), OR a visual direction (agent scaffold).
          .filter((s: CustomScene) =>
            s.script?.trim() ||
            s.sceneType === "creative" ||
            s.visual?.trim()
          );
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
      // Use the AI-extracted visual description (neutral, pixel-accurate) instead of the
      // user-typed product name. User names like "remera azul clarito" bias the model's
      // color decisions when the actual reference image is a different shade.
      const productDesc = selectedProduct
        ? `${selectedProduct.description || "the product"} visible in frame — match the reference exactly.`
        : "";
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
            : `${selectedProduct ? (selectedProduct.description || "product") + " — product shot, match the reference exactly" : "lifestyle scene"}. ${stylePrompt}`;
        } else {
          const bgContext = bgNote ? `in ${bgNote}` : `in ${bgDesc}`;
          // Use neutral pointer for clothing too — user-typed names with color/style adjectives bias the model.
          const clothingDesc = selectedClothing.length > 0
            ? `wearing the clothing item${selectedClothing.length > 1 ? "s" : ""} shown in the reference image${selectedClothing.length > 1 ? "s" : ""} exactly as pictured`
            : "";
          const productInteraction = selectedProduct
            ? (config.productIsWorn
                ? "wearing the garment shown in the product reference image, exact color and design"
                : "holding the product shown in the product reference image, exact color and design")
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
          title: entry.title?.trim() || (i === 0 ? "Hook" : i === entries.length - 1 ? "CTA" : `Scene ${i + 1}`),
          script: entry.script.trim(),
          image_prompt: imagePrompt,
          ...(entry.sceneType ? { sceneType: entry.sceneType } : {}),
          ...(entry.location ? { location: entry.location } : {}),
          ...(typeof entry.product === "boolean" ? { _showProduct: entry.product } : {}),
          ...(entry.avatar === false ? { _useAvatar: false } : {}),
          // Pass-through per-scene background override from the agent / custom script.
          // undefined = inherit global, null = no background, string = explicit override.
          ...(entry.backgroundId !== undefined ? { backgroundId: entry.backgroundId } : {}),
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
    // Hard directive: with a brand background selected, every scene must happen
    // INSIDE this location. Without this clause, Gemini tends to invent varied
    // locations per scene (park, kitchen, street, etc.) which then make the
    // image-gen step drift from the visual location anchor.
    notes += `\nIMPORTANT: ALL SCENES TAKE PLACE IN THIS EXACT LOCATION. Do NOT invent other settings (park, kitchen, beach, office, outdoor, etc.). Every scene's image_prompt must describe action that happens INSIDE this setting only — what changes per scene is the avatar's action, framing, and angle, NOT the location.`;
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

  // CRITICAL: never include the user-typed product/clothing NAME in the reference
  // description — color adjectives in names ("remera azul clarito", "buzo bordó") bias
  // Nano Banana away from the actual pixels. Use neutral pointers ("the garment shown
  // in this reference") and let the image speak for itself. The fidelity clause forces
  // the model to honor the visual over any text.
  const PIXEL_FIDELITY = "CRITICAL: reproduce the EXACT color, shade, fabric, print, stitching, and proportions from the reference pixels. Do NOT lighten, darken, saturate, or stylize. If color descriptors in the text appear to conflict with the reference image, the IMAGE IS ALWAYS AUTHORITATIVE.";

  // Build references as a priority-ordered candidate list, then cap the total. Nano
  // Banana rejects jobs with too many refs ("Could not generate images..."), easy to
  // hit once product sub-images + moodboard + background stack up. Priority (lower =
  // kept first): identity → product → clothing → background → pose → moodboard → extra
  // product views.
  const MAX_BASE_REFS = 6;
  type RefCandidate = { url: string; label: string; priority: number };
  const candidates: RefCandidate[] = [];

  if (selectedAvatar?.imageUrl) {
    candidates.push({ url: selectedAvatar.imageUrl, priority: 0, label: `the person's face and body — use this EXACT person` });
  }

  // Composition / pose reference (optional) — also analyzed by Gemini for body positions.
  // Only real images can be pose references — filter out any non-image File (e.g. a video
  // left over from a Content Analyzer run) so we never send a video to Nano Banana.
  const refFiles = ((config as { referenceImages?: File[] }).referenceImages || []).filter((f) => f && typeof f.type === "string" && f.type.startsWith("image/"));
  let poseDescription = "";
  for (const file of refFiles.slice(0, 1)) {
    const refDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    try { const analysis = await analyzePoseReference(file); poseDescription = analysis.pose_description; } catch { /* non-blocking */ }
    const poseNote = poseDescription
      ? `pose reference — replicate ONLY the body positions and camera framing: ${poseDescription}`
      : `pose reference — match the body positions and camera framing`;
    candidates.push({ url: refDataUrl, priority: 4, label: poseNote });
  }

  // Product (hero) + clothing (worn). Push order respects productIsWorn for readable numbering.
  if (config.productIsWorn) {
    if (selectedProduct?.imageUrl) candidates.push({ url: selectedProduct.imageUrl, priority: 1, label: `the garment shown in this reference — the person WEARS it. ${PIXEL_FIDELITY}` });
    selectedClothingItems.forEach((c) => { if (c.imageUrl) candidates.push({ url: c.imageUrl, priority: 2, label: `the clothing item shown in this reference — the person WEARS it exactly as pictured. ${PIXEL_FIDELITY}` }); });
  } else {
    selectedClothingItems.forEach((c) => { if (c.imageUrl) candidates.push({ url: c.imageUrl, priority: 2, label: `the clothing item shown in this reference — the person WEARS it exactly as pictured. ${PIXEL_FIDELITY}` }); });
    if (selectedProduct?.imageUrl) candidates.push({ url: selectedProduct.imageUrl, priority: 1, label: `the product shown in this reference — the person HOLDS or SHOWS it. ${PIXEL_FIDELITY}` });
  }
  // Extra product views (back/detail) — lowest priority, dropped first if over budget.
  if (selectedProduct?.images) {
    for (const img of selectedProduct.images) {
      if (img.imageUrl) candidates.push({ url: img.imageUrl, priority: 6, label: `additional view of the same product — confirms color, fabric, and proportions from another angle. Use this to reinforce pixel-exact matching of the product across the scene.` });
    }
  }
  if (selectedBackground?.imageUrl) {
    const bgName = selectedBackground.description || selectedBackground.name || "background";
    candidates.push({ url: selectedBackground.imageUrl, priority: 3, label: `background/environment — place the person IN this exact setting (${bgName})` });
  }
  if (selectedMoodboard?.imageUrl) {
    const moodName = selectedMoodboard.description || selectedMoodboard.name || "visual style";
    candidates.push({ url: selectedMoodboard.imageUrl, priority: 5, label: `visual style moodboard — replicate this aesthetic, color palette, lighting, and mood (${moodName}). Do NOT copy people or objects literally.` });
  }

  const kept = candidates
    .map((c, i) => ({ c, i }))
    .sort((a, b) => a.c.priority - b.c.priority || a.i - b.i)
    .slice(0, MAX_BASE_REFS)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.c);
  if (kept.length < candidates.length) {
    console.warn(`[ugc] base image: capped references ${candidates.length} → ${kept.length} (dropped ${candidates.length - kept.length} lowest-priority to avoid Nano Banana rejection)`);
  }

  const imageUrls: string[] = kept.map((c) => c.url);
  let prompt = firstScene.image_prompt;
  const refDescriptions: string[] = kept.map((c, i) => `Image ${i + 1}: ${c.label}`);
  // Wardrobe override — when there's an identity ref AND a worn garment, force the model
  // to be re-dressed in the garment and ignore the clothing in the avatar photo (critical
  // when the avatar is a full-body shot or pose sheet that already shows an outfit).
  const hasIdentity = kept.some((c) => c.priority === 0);
  const hasWornGarment = kept.some((c) => c.priority === 2) || (config.productIsWorn === true && kept.some((c) => c.priority === 1));
  const wardrobeOverride = hasIdentity && hasWornGarment
    ? `WARDROBE OVERRIDE (critical): the person must be RE-DRESSED in the garment/clothing reference image(s). ` +
      `Completely IGNORE and REPLACE whatever clothing the person wears in their identity photo — that image is for face and body ONLY, never the outfit. The final clothing comes 100% from the garment reference(s).\n\n`
    : "";
  if (refDescriptions.length > 0) {
    prompt = `${wardrobeOverride}REFERENCE IMAGES:\n${refDescriptions.join("\n")}\n\n${prompt}`;
  }
  prompt += ` ${baseVisualStyle}${noTextSuffix}`;

  // Brand context + constraints
  const constraints = buildBrandConstraints(activeBrand, config, { tool: "ugc_creator", mentionsAvatar: !!selectedAvatar });
  const brandContextBlock = buildBrandContext(activeBrand, "ugc_creator");
  prompt = `${prompt}${brandContextBlock}${constraints}`;
  console.log("[ugc] FINAL PROMPT base_image:", prompt.slice(0, 1500));

  const job = imageUrls.length === 0
    ? await createTextToImage(prompt, config.aspectRatio, config.resolution)
    : await createImageEdit(imageUrls, prompt, config.aspectRatio, config.resolution);
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

  // Location consistency policy:
  //  - If user selected a brand background at config level → LOCK it across all
  //    scenes regardless of mode. Selecting a background is an explicit choice
  //    that overrides narrative mode's "location varies" behavior. If the user
  //    wants per-scene locations in narrative mode, they can set per-scene
  //    backgroundId overrides on individual scenes.
  //  - Standard mode (no global bg): same as base image.
  //  - Narrative mode (no global bg): location changes per scene prompt.
  const hasGlobalLocationAnchor = !!(activeBrand.backgrounds || []).find(
    (bg) => bg.id === config.selectedBackgroundId
  )?.imageUrl;
  const consistency = hasGlobalLocationAnchor
    ? "Same EXACT person, same clothes, same EXACT location as the LOCATION ANCHOR reference image. Do NOT change the setting — every scene takes place INSIDE this same environment, only the action and framing change."
    : isNarrativeMode
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

      // Location prompt resolution (in priority order):
      //   1. Per-scene EXPLICIT override (`scene.backgroundId === "xxx"`) → that bg is dominant
      //   2. Scene EXPLICITLY disabled (`scene.backgroundId === null`) → text-only, fall back to sceneLocation text
      //   3. Default (`scene.backgroundId === undefined`) + brand bg selected → use brand bg as the universal anchor
      //   4. Narrative mode with sceneLocation text but no brand bg → use the text
      let locationContext = "";
      if (sceneBackground && scene.backgroundId !== undefined && scene.backgroundId !== null) {
        // Case 1: per-scene override
        const bgDesc = sceneBackground.description || sceneBackground.name;
        locationContext = `SETTING: ${bgDesc}. This scene takes place in this EXACT location, NOT in the same setting as scene 1. `;
      } else if (scene.backgroundId === null) {
        // Case 2: explicitly no bg
        locationContext = sceneLocation ? `SETTING: ${sceneLocation}. ` : "";
      } else if (sceneBackground) {
        // Case 3: inherited from config — this is the "user selected one global background" case.
        // Before this fix, this branch fell through and locationContext stayed empty, so the prompt
        // body could describe arbitrary locations and fight the LOCATION ANCHOR ref.
        const bgDesc = sceneBackground.description || sceneBackground.name;
        locationContext = `SETTING: ${bgDesc}. This scene takes place INSIDE this exact environment — same walls, same props, same lighting direction. `;
      } else if (isNarrativeMode && sceneLocation) {
        // Case 4: narrative location text only
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

      // LOCATION ANCHOR (Nivel 1 consistency fix): pass the background asset on EVERY scene
      // — not just when there's a per-scene override — so the model has a strong reference
      // for the environment and doesn't drift across multishots. Skip only when the scene
      // explicitly opted out with backgroundId=null (text-only mode).
      const useLocationAnchor = scene.backgroundId !== null && !!sceneBackground?.imageUrl;
      const hasExplicitSceneBg = scene.backgroundId !== undefined && scene.backgroundId !== null && !!sceneBackground?.imageUrl;
      const sceneBgRef: string[] = useLocationAnchor ? [sceneBackground!.imageUrl] : [];

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

          // Build reference header so model knows what each reference image is.
          // The LOCATION ANCHOR wording is the Nivel 1 consistency fix — explicitly demands
          // the model preserve walls / props / lighting / perspective across multishots,
          // because by default Nano Banana treats backgrounds as soft context and drifts.
          let bgRefLine = "";
          if (useLocationAnchor) {
            const bgIdx = includeProduct ? 3 : 2;
            if (hasExplicitSceneBg) {
              // Per-scene override — this is intentionally a DIFFERENT location than scene 1
              bgRefLine = `Image ${bgIdx}: LOCATION — place the person INSIDE this exact environment. Match walls, props, lighting direction, and perspective.\n`;
            } else {
              // Default brand background — must stay IDENTICAL across all scenes
              bgRefLine = `Image ${bgIdx}: LOCATION ANCHOR — this scene MUST take place in this EXACT environment. Same walls, same props, same lighting direction, same perspective, same time of day. The person can move and pose differently, but the location is FIXED across every scene.\n`;
            }
          }
          const refHeader = isProductOnly
            ? ""
            : includeProduct
              ? `REFERENCE IMAGES:\nImage 1: the person — use this EXACT face, hair, body, clothing.\nImage 2: "${productName}" — use this EXACT product, same packaging, same color, same design.\n${bgRefLine}\n`
              : `REFERENCE IMAGES:\nImage 1: the person — use this EXACT face, hair, body, clothing.\n${bgRefLine}\n`;

          // When a specific visual direction is provided (>40 chars), it's intentional and detailed —
          // use it directly without overriding with generic camera/action variations.
          // Generic variations are only used as fallback when no direction is given.
          const hasSpecificDirection = cleanDirection.length > 40;

          // Mouth-state clause for non-talking scenes: in creative / lifestyle / sensorial
          // / product_reveal scenes the avatar must NEVER appear speaking. Without this,
          // Nano Banana often renders an open mouth / mid-speech expression because the
          // base image (scene 1, usually talking) has that posture as anchor.
          const mouthClause = (sceneType !== "talking" && !isProductOnly && !noAvatar)
            ? "MOUTH CLOSED — the avatar is NOT speaking in this scene. Calm neutral expression, soft natural smile, or a genuine natural laugh ONLY if it fits the moment. NO open mouth, NO mid-word lip shape, NO talking gesture, NO speech bubble pose. "
            : "";

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
            prompt = `${refHeader}${frameNote}${locationContext}${cleanDirection}. ${eyeContact}${mouthClause}${consistency} ${styleBlock}${noText}`;
          } else if (isNarrativeMode && narrativeSceneType in NARRATIVE_VARIATIONS) {
            // Narrative scene types: lifestyle, sensorial, product_reveal — always non-talking
            const pool = NARRATIVE_VARIATIONS[narrativeSceneType];
            const variant = pool[vi % pool.length];
            prompt = `${refHeader}${frameNote}${locationContext}${variant.desc} ${mouthClause}${consistency} ${styleBlock}${noText}`;
          } else if (sceneType === "creative") {
            const pool = ACTION_VARIATIONS;
            const idx = (sceneIdx * NUM_VARIATIONS + vi) % pool.length;
            const variant = pool[idx];
            prompt = `${refHeader}${frameNote}${locationContext}${variant.desc} ${mouthClause}${consistency} ${styleBlock}${noText}`;
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
  // Skip entirely when engine is Seedance — Seedance uses multi-ref, doesn't do f2f.
  // Showing the f2f badge with Seedance is confusing because nothing in the pipeline
  // honors it downstream.
  const animationEngineForF2F = ((config as unknown as Record<string, unknown>).animationEngine as "kling" | "seedance") || "kling";
  if (animationEngineForF2F === "seedance") {
    for (const r of multishotResults) {
      (r as typeof r & { frameToFrame?: boolean; frameToFrameNote?: string }).frameToFrame = false;
      (r as typeof r & { frameToFrame?: boolean; frameToFrameNote?: string }).frameToFrameNote = "Seedance engine — multi-ref instead of f2f";
    }
    return { result: multishotResults, needsApproval: true };
  }

  // Kling-only: analyze adjacent creative scene pairs and suggest f2f when it makes narrative sense.
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
// Lipsync for talking scenes:
//   - HeyGen Avatar 4 (default when engine=Kling): static image + audio → talking head
//   - Seedance: when engine=seedance, lipsync happens unified inside the animation step
//     and this handler is bypassed.
// Sync Lipsync V3 ("synclipsync") was an alternative method — removed from the UI,
// kept here as a legacy code path so old generations don't break, but new runs always
// resolve to "heygen".
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
  // Multishot result shape evolves: Array<MultishotScene> before approval, { variations, selections } after.
  // We need to unwrap `variations` when it's the post-approval object to retain hookVideoUrl/entryFrameUrl.
  type MultishotScene = { sceneId: string; frameToFrame?: boolean; entryFrameUrl?: string; hookVideoUrl?: string };
  const msResult = getStepResult("multishot");
  const rawMultishotData: MultishotScene[] = Array.isArray(msResult)
    ? (msResult as MultishotScene[])
    : Array.isArray((msResult as { variations?: MultishotScene[] } | undefined)?.variations)
      ? ((msResult as { variations: MultishotScene[] }).variations)
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

  // Animation engine — "kling" (default) or "seedance" (multi-reference)
  const animationEngine = ((config as unknown as Record<string, unknown>).animationEngine as "kling" | "seedance") || "kling";

  // Brand asset URLs for Seedance multi-ref (computed once). The curated scene image
  // is always passed first; these brand refs go after to give Seedance extra anchors.
  const buildBrandRefs = (): string[] => {
    if (animationEngine !== "seedance") return [];
    const cfg = config as unknown as Record<string, unknown>;
    const urls: string[] = [];
    const selectedAvatarIds = (cfg.selectedAvatarIds as string[]) || [];
    const selectedAvatar = selectedAvatarIds.length
      ? (activeBrand.avatars || []).find((a) => selectedAvatarIds.includes(a.id))
      : activeBrand.avatars?.find((a) => a.id === config.selectedAvatarId);
    if (selectedAvatar?.imageUrl) urls.push(avatarImageUrl(selectedAvatar.imageUrl));

    const selectedProductIds = (cfg.selectedProductIds as string[]) || [];
    const selectedProducts = selectedProductIds.length
      ? (activeBrand.products || []).filter((p) => selectedProductIds.includes(p.id))
      : config.selectedProductId ? [(activeBrand.products || []).find((p) => p.id === config.selectedProductId)].filter(Boolean) : [];
    for (const p of selectedProducts) {
      if (p?.imageUrl) urls.push(productImageUrl(p.imageUrl));
    }

    const selectedClothing = (activeBrand.clothing || []).filter((c) => config.selectedClothingIds.includes(c.id));
    for (const c of selectedClothing) {
      if (c.imageUrl) urls.push(clothingImageUrl(c.imageUrl));
    }

    const selectedBackground = (activeBrand.backgrounds || []).find((bg) => bg.id === config.selectedBackgroundId);
    if (selectedBackground?.imageUrl) urls.push(backgroundImageUrl(selectedBackground.imageUrl));
    return urls;
  };
  const brandRefUrls = buildBrandRefs();

  // Helper: animate a scene — dispatches by engine.
  //   - Kling (default): single-frame i2v OR frame-to-frame between adjacent scenes.
  //   - Seedance: ref-to-video with the curated scene image + all brand assets as refs.
  //               Ignores f2f and startFrameOverride (Seedance doesn't use them).
  const animateScene = async (
    scene: { sceneId: string; title: string; selectedUrl: string },
    sceneIdx: number,
    imagePrompt: string,
    startFrameOverride?: string,
    durationOverride?: string,
  ): Promise<string> => {
    const prompt = imagePrompt + KLING_MOTION_SUFFIX;
    const duration = durationOverride || "5";

    if (animationEngine === "seedance") {
      // Cap refs at 6 to stay within Fal's reasonable limits
      const refs = [scene.selectedUrl, ...brandRefUrls].slice(0, 6);
      try {
        const job = await createSeedanceReferenceToVideo({
          prompt,
          referenceImageUrls: refs,
          duration,
        });
        const result = job.video_url
          ? { status: "completed", video_url: job.video_url }
          : await pollSeedanceVideo(job.request_id);
        if (result.status !== "failed" && result.video_url) return result.video_url;
        throw new Error(`Seedance failed for "${scene.title}"`);
      } catch (e) {
        console.warn(`[ugc] Seedance failed for ${scene.title}, falling back to Kling:`, e);
        // Fall through to Kling below
      }
    }

    // Kling path (default or Seedance fallback)
    const useF2F = getSceneF2F(scene.sceneId);
    const startFrame = startFrameOverride || scene.selectedUrl;

    if (startFrameOverride || useF2F) {
      const endFrame = startFrameOverride
        ? scene.selectedUrl
        : curationData[sceneIdx + 1]?.selectedUrl;
      if (endFrame && endFrame !== startFrame) {
        const job = await createKlingFrameToFrame({
          start_image_url: startFrame,
          end_image_url: endFrame,
          prompt,
          duration,
        });
        const result = await pollKlingVideo(job.request_id);
        if (result.status !== "failed" && result.video_url) return result.video_url;
      }
    }
    const job = await createKlingVideo(startFrame, prompt, duration);
    const result = await pollKlingVideo(job.request_id);
    if (result.status === "failed") throw new Error(`Animation failed for "${scene.title}"`);
    return result.video_url || scene.selectedUrl;
  };

  // Backwards-compat alias — some callsites still reference animateWithKling by name
  const animateWithKling = animateScene;

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

    // Match audio STRICTLY by sceneId. The old `|| voiceData[i]` index fallback was
    // always misaligned when a non-talking (creative) scene sat between talking ones:
    // voiceData only holds the talking scenes' audios, so voiceData[i] grabbed the wrong
    // scene's audio (the creative clip ended up playing the next talking scene's audio,
    // and the last clips repeated). A creative scene legitimately has no audio → silent.
    const voiceEntry = Array.isArray(voiceData)
      ? voiceData.find((v) => v.sceneId === scene.sceneId)
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

    // CREATIVE-scene anti-talking clause: when an scene is creative (b-roll), the
    // avatar must NOT appear to be speaking or looking at camera. Without this,
    // both Kling and Seedance often render the avatar with subtle mouth movement
    // and direct gaze — which clashes with the next/prev talking scene that already
    // has the avatar addressing camera. The b-roll should feel like a moment OF
    // ACTION, not a paused take.
    const CREATIVE_NO_TALK_CLAUSE = " IMPORTANT: The person is NOT speaking, NOT looking directly at the camera. Mouth is closed (or naturally relaxed if mid-action). Gaze is on the activity / object / off-camera — NEVER on the lens. This is a b-roll moment, not a to-camera moment.";
    const klingPromptForCreative = klingPrompt + CREATIVE_NO_TALK_CLAUSE;

    // Pick Kling clip duration: round audio up to nearest Kling step (5 or 10s). Visual-only → 5s.
    const audioDuration = voiceEntry?.durationSecs ?? 0;
    const klingDuration: string = audioDuration > 5 ? "10" : "5";

    // ── Hook intro video: always runs for scene 1 when entry frame exists ──
    // Independent of lipsync method — generates a short f2f clip (entry → base image)
    // that gets prepended to the lipsync video in render
    const hookVideoUrl = i === 0 ? await generateHookVideo(scene) : undefined;

    // ── Creative scene: Kling/Seedance → optional FFmpeg audio overlay ──────
    if (sceneType === "creative") {
      const klingVideoUrl = await animateWithKling(scene, i, klingPromptForCreative, undefined, klingDuration);
      // If no audio (empty script scene), use Kling video as-is
      if (!falAudioUrl) {
        lipsyncResults.push({
          sceneId: scene.sceneId,
          title: scene.title,
          scriptText: "",
          videoUrl: klingVideoUrl.startsWith("http") ? klingVideoUrl : `http://127.0.0.1:8000${klingVideoUrl}`,
          hookVideoUrl,
          imageUrl: scene.selectedUrl,
          sceneType: "creative",
        });
        continue;
      }
      const overlayResult = await overlayAudio(
        klingVideoUrl.startsWith("http") ? klingVideoUrl : `http://127.0.0.1:8000${klingVideoUrl}`,
        falAudioUrl,
      );
      lipsyncResults.push({
        sceneId: scene.sceneId,
        title: scene.title,
        scriptText,
        videoUrl: overlayResult.video_url.startsWith("http")
          ? overlayResult.video_url
          : `http://127.0.0.1:8000${overlayResult.video_url}`,
        hookVideoUrl,
        imageUrl: scene.selectedUrl,
        sceneType: "creative",
      });
      continue;
    }

    // ── Talking scene: método elegido ─────────────────────
    // PRIORITY: when animationEngine = "seedance" AND we have audio, route through
    // Seedance — it handles both the visual generation AND the lipsync in one pass.
    // Unified engine = better cross-scene consistency (same model = same look across
    // talking and creative scenes).
    if (animationEngine === "seedance" && falAudioUrl) {
      // Build refs: curated scene image first (composition anchor) + brand refs (avatar / product / clothing / bg)
      const refs = [scene.selectedUrl, ...brandRefUrls].slice(0, 6);
      try {
        const seedancePrompt = scriptScene?.image_prompt
          ? `${scriptScene.image_prompt}. The character is speaking the provided audio with natural lipsync, expressive face, calm body posture.`
          : `Person speaking to camera in the same setting and outfit as the reference. Natural lipsync to the audio. Subtle body movement, expressive face.`;
        const job = await createSeedanceReferenceToVideo({
          prompt: seedancePrompt,
          referenceImageUrls: refs,
          audioUrls: [falAudioUrl],
          duration: klingDuration,
        });
        const result = job.video_url
          ? { status: "completed", video_url: job.video_url }
          : await pollSeedanceVideo(job.request_id);
        if (result.status !== "failed" && result.video_url) {
          lipsyncResults.push({
            sceneId: scene.sceneId,
            title: scene.title,
            scriptText,
            videoUrl: result.video_url,
            hookVideoUrl,
            imageUrl: scene.selectedUrl,
            sceneType: "talking",
          });
          continue;
        }
        // Fall through to HeyGen on failure
        console.warn(`[ugc] Seedance lipsync failed for ${scene.title}, falling back to ${lipsyncMethod}`);
      } catch (e) {
        console.warn(`[ugc] Seedance lipsync error, falling back:`, e);
      }
    }

    if (lipsyncMethod === "synclipsync") {
      // Kling: single-frame body motion (no f2f here — hook is handled separately above)
      const klingVideoUrl = await animateWithKling(
        scene, i,
        "Subtle natural body movement, gentle breathing, slight head sway, relaxed gestures. Neutral closed mouth expression. No speaking, no lip movement.",
        undefined,
        klingDuration,
      );
      const lipsyncJob = await createSyncLipsync({
        video_url: klingVideoUrl.startsWith("http") ? klingVideoUrl : `http://127.0.0.1:8000${klingVideoUrl}`,
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

  // Persistence handled by autoSaveStep in ToolRunPage — no manual saveGeneration here.

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
