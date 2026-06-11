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
  createKlingFrameToFrame,
  createSeedanceReferenceToVideo, pollSeedanceVideo,
  concatVideos,
  analyzePoseReference,
  avatarImageUrl, clothingImageUrl, productImageUrl, backgroundImageUrl,
} from "../../lib/api";
import type { KlingModel } from "../../lib/api";
import { VIDEO_SHOT_CATALOG, DEFAULT_LOOKS_SHOTS } from "./index";

const VISUAL_STYLE_PROMPTS: Record<string, string> = {
  editorial: "FORMAT: Vertical 9:16, shot on 35mm film look. LIGHTING: soft directional natural light, fashion editorial quality. STYLE: high-fashion, minimal, sophisticated — sharp detail, clean backgrounds.",
  cinematic: "FORMAT: Vertical 9:16, anamorphic lens. LIGHTING: dramatic, directional side lighting, film-quality. STYLE: cinematic, shallow depth of field, movie-grade color.",
  iphone: "FORMAT: Vertical 9:16, shot on iPhone, handheld — slight natural camera shake implied, NOT a tripod shot. LIGHTING: available natural light, slightly imperfect, real-room ambiance — no studio setup, no professional lighting rigs, no even fill light. STYLE: authentic UGC selfie-style, real skin texture with natural imperfections, slightly warm color temperature, everyday real-world setting. NOT cinematic, NOT commercial photography, NOT perfectly composed. Looks like a real person filmed this at home.",
  studio: "FORMAT: Vertical 9:16, studio setup. LIGHTING: professional 3-point lighting, clean and even. STYLE: clean commercial photography, sharp detail.",
};

const getVisualStyle = (cfg: Record<string, unknown>): string => {
  const style = (cfg.visualStyle as string) || "iphone";
  if (style === "custom") return (cfg.visualStyleCustom as string) || VISUAL_STYLE_PROMPTS.iphone;
  return VISUAL_STYLE_PROMPTS[style] ?? VISUAL_STYLE_PROMPTS.iphone;
};

/**
 * "Look & feel" guidance prepended to every scene prompt:
 *  1. User's typed Style Reference (styleRef field) wins — explicit override
 *  2. Else, the analyzer's visual_signature (from Content Analyzer handoff)
 *  3. Else, empty (just the preset stylePrompt carries the look)
 * Returns a single sentence/paragraph to prepend OR empty string.
 */
const getLookSignature = (cfg: Record<string, unknown>): string => {
  const userOverride = (cfg.styleRef as string)?.trim();
  if (userOverride) return `LOOK & FEEL (user reference, takes priority): ${userOverride}.`;
  const sig = (cfg.visualSignature as string)?.trim();
  if (sig) {
    const extras: string[] = [];
    const lighting = (cfg.lightingStyle as string)?.trim();
    const palette = (cfg.paletteTemperature as string)?.trim();
    const framing = (cfg.framingSignature as string)?.trim();
    if (lighting) extras.push(`Lighting: ${lighting}.`);
    if (palette) extras.push(`Palette: ${palette}.`);
    if (framing) extras.push(`Framing: ${framing}.`);
    return `LOOK & FEEL (replicate the source video's cinematic DNA): ${sig}${extras.length ? " " + extras.join(" ") : ""}`;
  }
  return "";
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

    // Location injection — prioridad de origen:
    //   1) locationPreset (chip de escenario) si != "brand"  → texto fijo agresivo
    //   2) settingOverride (textarea "Setting / Locación")    → texto del usuario
    //   3) selectedBackground del Brand Kit                   → name + description
    //   4) nada                                                → Nano Banana infiere
    // Antes solo se inyectaba (2)+(3); el usuario reportó que el background del
    // Brand Kit no funcionaba ("estudio blanco salió como casa") porque el name
    // del background no era suficientemente explícito. Los presets fijos resuelven
    // ese caso: tipean texto explícito que Nano Banana SÍ respeta.
    const LOCATION_PRESETS: Record<string, string> = {
      studio_white: "professional photo studio with seamless infinite WHITE backdrop, even softbox lighting, no shadows on the background, clean fashion catalog aesthetic. NOT a room with white walls — a true cyclorama studio with pure white seamless paper.",
      studio_black: "professional photo studio with seamless infinite BLACK backdrop, dramatic side lighting, deep shadows on the background, editorial fashion aesthetic.",
      street: "urban street environment, real outdoor city, golden hour natural light, candid documentary fashion feel.",
      natural: "outdoor natural environment, soft diffused daylight, organic textures, lifestyle fashion feel.",
    };
    const presetKey = (cfg.locationPreset as string) || "brand";
    const presetText = LOCATION_PRESETS[presetKey];

    const selectedBackgroundForPrompt = (activeBrand.backgrounds || []).find((bg) => bg.id === config.selectedBackgroundId);
    const settingOverride = (cfg.settingOverride as string)?.trim();
    const locationLine = presetText
      ? `SETTING (LOCKED): ${presetText} This is the EXACT environment for every scene — do NOT invent another. Ignore any conflicting environment cues from the reference images.`
      : settingOverride
        ? `SETTING: ${settingOverride}. This is the EXACT environment for every scene — do NOT invent another.`
        : selectedBackgroundForPrompt
          ? `SETTING: ${selectedBackgroundForPrompt.name}${selectedBackgroundForPrompt.description ? ` — ${selectedBackgroundForPrompt.description}` : ""}. This is the EXACT environment for every scene — do NOT invent another. The location reference image takes priority over any other inferred setting.`
          : "";

    // Shots seleccionados por look. Si el usuario no marcó nada, defaults a general+detail.
    // Cada outfit × cada shot = una escena. El orden en `looksShots` es el orden en el
    // video final (todos los shots del outfit 1, después todos los del outfit 2, etc.).
    const looksShotsRaw = (cfg.looksShots as string[]) || DEFAULT_LOOKS_SHOTS;
    const looksShots = looksShotsRaw.filter((s) => VIDEO_SHOT_CATALOG[s]);
    const shots = looksShots.length > 0 ? looksShots : DEFAULT_LOOKS_SHOTS;

    const scenes: Array<{
      id: string;
      title: string;
      script: string;
      image_prompt: string;
      sceneType: "creative";
      shot: string;
      note: string;
      /** Link al outfit usado en esta escena — el resto del pipeline (base_image,
       *  multishot) lo consume para saber qué garment renderizar en cada escena. */
      garmentId?: string;
      shotId?: string;
    }> = [];

    for (let oi = 0; oi < selectedClothing.length; oi++) {
      const garment = selectedClothing[oi];
      const garmentLabel = `${garment.name}${garment.description ? ` (${garment.description})` : ""}`;
      for (let si = 0; si < shots.length; si++) {
        const shotId = shots[si];
        const shotMeta = VIDEO_SHOT_CATALOG[shotId];
        scenes.push({
          id: `look_${oi + 1}_${shotId}`,
          title: `${garment.name} · ${shotMeta.label}`,
          script: "",
          // El image_prompt arranca con el framing del shot + la consigna del look +
          // la location forzada (settingOverride o background). base_image /
          // multishot lo expanden con la prenda real y el background como refs.
          image_prompt: `${shotMeta.framing} ${avatarDesc} wearing ${garmentLabel}. Confident fashion presence.${locationLine ? ` ${locationLine}` : ""}`,
          sceneType: "creative",
          shot: shotId,
          note: `${garment.name} — ${shotMeta.label}`,
          garmentId: garment.id,
          shotId,
        });
      }
    }

    return {
      result: { scenes },
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

  // When a brand background is selected, lock the location so Gemini's
  // image_prompt for every scene happens INSIDE that environment.
  const selectedBackground = (activeBrand.backgrounds || []).find((bg) => bg.id === config.selectedBackgroundId);
  const locationLockLine = selectedBackground
    ? `LOCATION (locked): ${selectedBackground.name}${selectedBackground.description ? ` — ${selectedBackground.description}` : ""}\nIMPORTANT: ALL scenes take place in THIS EXACT location. Do NOT invent other settings. What changes per scene is the model's pose, action, framing and angle — NOT the environment.`
    : "";

  const modeLabel = reelMode === "looks" ? "Looks (one scene per outfit)" : "Story (Hook → Movement → Showcase → Closer)";
  const userMsg = [
    `Generate a Fashion Reel in ${modeLabel} mode. Respond with ONLY a JSON array.`,
    selectedAvatars[0] ? `Model: ${selectedAvatars[0]!.name}` : "",
    selectedClothing.length > 0 ? `Outfits: ${selectedClothing.map((c) => c.name).join(", ")}` : "",
    selectedProducts[0] ? `Feature: ${selectedProducts[0]!.name}` : "",
    config.objective ? `Direction: ${config.objective}` : "",
    locationLockLine,
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

  // Looks mode: first scene = first scene's clothing (lookup por garmentId si existe,
  // sino al primer outfit para compat con scenes viejas). Story mode: all clothing.
  const allClothing = (activeBrand.clothing || []).filter((c) => config.selectedClothingIds.includes(c.id));
  const lookupClothing = (garmentId?: string) => garmentId
    ? allClothing.find((c) => c.id === garmentId)
    : undefined;
  const firstSceneClothing = lookupClothing(firstScene.garmentId);
  const sceneClothing = reelMode === "looks"
    ? (firstSceneClothing ? [firstSceneClothing] : allClothing.slice(0, 1))
    : allClothing;

  const stylePrompt = getVisualStyle(cfg);

  // Assemble reference images in PRIORITY order, then cap the total. Nano Banana 2
  // rejects a job ("Could not generate images with the given prompts and images")
  // when handed too many references to combine — easy to hit when the Content Analyzer
  // maps several garments + products on top of avatar + background + pose. Keep the
  // highest-value refs: identity → garments → location → product → pose.
  const MAX_BASE_REFS = 6;
  type RefCandidate = { url: string; label: string; priority: number };
  const candidates: RefCandidate[] = [];

  if (selectedAvatar?.imageUrl) {
    candidates.push({
      url: selectedAvatar.imageUrl,
      priority: 0,
      label: `IDENTITY SOURCE — use this EXACT person's face, features, skin tone, hair and body. Take ONLY the identity from this image — IGNORE its background, lighting, clothing, and pose.`,
    });
  }

  // Only real images can be pose references — filter out any non-image File (e.g. a video
  // left over from a Content Analyzer run) so we never send a video to Nano Banana.
  const refFiles = ((cfg.referenceImages as File[]) || []).filter((f) => f && typeof f.type === "string" && f.type.startsWith("image/"));
  let poseDescription = "";
  for (const file of refFiles.slice(0, 1)) {
    const refDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    try { const analysis = await analyzePoseReference(file); poseDescription = analysis.pose_description; } catch { /* non-blocking */ }
    // SCOPED pose label: take ONLY body position + camera framing. Explicitly exclude
    // everything else so Nano Banana doesn't copy the pose image's lighting, scene,
    // clothing, or the identity of whoever is in it.
    candidates.push({
      url: refDataUrl,
      priority: 4,
      label: `POSE REFERENCE — copy ONLY the body position, limb placement, and camera framing/angle${poseDescription ? ` (${poseDescription})` : ""}. ` +
        `Do NOT copy the lighting, background, scene, clothing, colors, styling, or the identity of any person in this image — those come from the OTHER references. This image contributes pose and framing ONLY.`,
    });
  }

  sceneClothing.forEach((c) => {
    if (c.imageUrl) candidates.push({ url: c.imageUrl, priority: 1, label: `GARMENT — the model WEARS this exact item. Reproduce its exact color, fabric, cut and details. Take ONLY the garment — ignore the background/person/pose in this image.` });
  });
  selectedProducts.filter(Boolean).forEach((p) => {
    if (p?.imageUrl) candidates.push({ url: p.imageUrl, priority: 3, label: `PRODUCT — the model holds/features this. Reproduce it exactly. Take ONLY the product — ignore the background/person in this image.` });
  });
  // Si el usuario eligió un preset de escenario (Estudio blanco, etc.), el preset
  // gana y NO incluimos el background del Brand Kit como ref — agregaría una señal
  // visual contradictoria. Solo incluimos el background ref cuando el preset es "brand".
  const locationPresetKeyBase = (cfg.locationPreset as string) || "brand";
  // Background ad-hoc (dataURL) viene del Content Analyzer Mapeo. Tiene prioridad
  // sobre el selectedBackground del Brand Kit — el usuario lo subió específicamente
  // para esta corrida. Reportado: "Content Analyzer no me permitió ponerle el fondo".
  const adHocBackgroundUrl = (cfg.adHocBackgroundUrl as string) || "";
  if (adHocBackgroundUrl && locationPresetKeyBase === "brand") {
    candidates.push({ url: adHocBackgroundUrl, priority: 2, label: `LOCATION + LIGHTING SOURCE — place the model INSIDE this exact environment. Match walls, props, perspective, time of day, AND take the lighting direction/quality from THIS image. Take ONLY the environment — ignore any people in it.` });
  } else if (selectedBackground?.imageUrl && locationPresetKeyBase === "brand") {
    candidates.push({ url: selectedBackground.imageUrl, priority: 2, label: `LOCATION + LIGHTING SOURCE — place the model INSIDE this exact environment. Match walls, props, perspective, time of day, AND take the lighting direction/quality from THIS image (not from the pose or identity refs). Take ONLY the environment — ignore any people in it.` });
  }

  // Keep the top MAX_BASE_REFS by priority (lower = more important), then restore
  // assembly order so the "Image N" numbering reads naturally.
  const kept = candidates
    .map((c, i) => ({ c, i }))
    .sort((a, b) => a.c.priority - b.c.priority || a.i - b.i)
    .slice(0, MAX_BASE_REFS)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.c);

  if (kept.length < candidates.length) {
    console.warn(`[fashion_reel] base image: capped references ${candidates.length} → ${kept.length} (dropped ${candidates.length - kept.length} lowest-priority to avoid Nano Banana rejection)`);
  }

  const imageUrls: string[] = kept.map((c) => c.url);
  const refDescriptions: string[] = kept.map((c, i) => `Image ${i + 1}: ${c.label}`);

  // When 3+ references are present, prepend an explicit role hierarchy so the model
  // knows which image "owns" each aspect and doesn't blend conflicting sources.
  const roleHierarchy = imageUrls.length >= 3
    ? `REFERENCE ROLES — each image contributes ONE thing, do not blend their other attributes:\n` +
      `• Identity (face/body) → from the IDENTITY SOURCE image only\n` +
      `• Pose & framing → from the POSE REFERENCE image only\n` +
      `• Garments → from the GARMENT image(s) only\n` +
      `• Product → from the PRODUCT image(s) only\n` +
      `• Location + lighting → from the LOCATION image only\n` +
      `• Overall aesthetic / color grade → from the look signature text below\n` +
      `If two images disagree on an attribute, follow the label that OWNS that attribute.\n\n`
    : "";

  // Wardrobe override — fires whenever there's BOTH an identity ref and a garment ref,
  // regardless of how many images (the role hierarchy above only kicks in at 3+). When
  // the avatar photo is a full/half-body shot (or a pose sheet) the model otherwise
  // copies ITS clothing and ignores the selected garment. This forces a re-dress.
  const hasIdentity = kept.some((c) => c.priority === 0);
  const hasGarment = kept.some((c) => c.priority === 1);
  const wardrobeOverride = hasIdentity && hasGarment
    ? `WARDROBE OVERRIDE (critical): the model must be RE-DRESSED in the GARMENT reference image(s). ` +
      `Completely IGNORE and REPLACE whatever clothing the person is wearing in the IDENTITY SOURCE image — that image provides face and body ONLY, never the outfit. The final clothing comes 100% from the GARMENT reference(s).\n\n`
    : "";

  const lookSignature = getLookSignature(cfg);
  let prompt = firstScene.image_prompt;
  if (refDescriptions.length > 0) prompt = `${roleHierarchy}${wardrobeOverride}REFERENCE IMAGES:\n${refDescriptions.join("\n")}\n\n${prompt}`;
  if (lookSignature) prompt = `${lookSignature}\n\n${prompt}`;
  prompt += ` ${stylePrompt}${NO_TEXT_SUFFIX}`;

  const job = imageUrls.length > 0
    ? await createImageEdit(imageUrls, prompt, config.aspectRatio, config.resolution)
    : await createTextToImage(prompt, config.aspectRatio, config.resolution);
  const result = await pollImageGen(job.request_id);
  if (result.status === "failed") throw new Error(result.error || "Image generation failed");

  // Entry hook: when enabled, generate an EMPTY version of scene 1 (same background,
  // same lighting, NO model) so the animate step can f2f from empty → model entering.
  // The empty frame is derived from the SAME base composition for background consistency.
  let entryFrameUrl: string | undefined;
  const entryHook = (cfg.entryHook as boolean) === true;
  if (entryHook) {
    if (selectedBackground?.imageUrl) {
      // Best case: the brand background IS the empty scene — use it directly (zero drift).
      entryFrameUrl = selectedBackground.imageUrl.startsWith("http")
        ? selectedBackground.imageUrl
        : backgroundImageUrl(selectedBackground.imageUrl);
    } else {
      // No background asset → generate an empty version of the base image (remove the person).
      try {
        const emptyJob = await createImageEdit(
          [result.image_url!],
          `Reproduce this EXACT scene — same background, same lighting, same perspective, same props — but COMPLETELY EMPTY: no person, no model, no body parts, no hands. The space is empty, ready for someone to walk in. ${stylePrompt}${NO_TEXT_SUFFIX}`,
          config.aspectRatio,
          config.resolution,
        );
        const emptyResult = await pollImageGen(emptyJob.request_id);
        if (emptyResult.image_url) entryFrameUrl = emptyResult.image_url;
      } catch { /* entry hook is optional — don't break the pipeline */ }
    }
  }

  return {
    result: {
      url: result.image_url!,
      prompt: firstScene.image_prompt,
      ...(entryFrameUrl ? { entryFrameUrl } : {}),
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

  // Same cap as the base step. NOTE: the avatar photo is intentionally NOT included here.
  // Every scene is anchored to scene 1 (or the previous frame), which already carries the
  // model's identity AND the correct outfit. Re-adding the avatar photo would inject ITS
  // clothing as a competing signal — that's exactly why scenes 2+ were coming out wearing
  // the avatar's clothes instead of the selected outfit. `reserve` leaves room for the
  // anchor ref. Priority: garment → location → product.
  const MAX_SCENE_REFS = 6;
  const buildCappedRefs = (clothingItems: typeof allClothing, reserve = 0): { urls: string[]; desc: string } => {
    type RefCandidate = { url: string; label: string; priority: number };
    const cands: RefCandidate[] = [];
    clothingItems.forEach((c) => { if (c.imageUrl) cands.push({ url: c.imageUrl, priority: 1, label: `"${c.name}" — the model WEARS this EXACT garment (color, fabric, cut, print). This is the outfit, NOT whatever clothing may appear in the anchor frame's source.` }); });
    // Mismo criterio que handleBaseImage: si hay preset de escenario distinto de
    // "brand", no incluimos el background del Brand Kit como ref (gana el preset).
    const locationPresetKeyScene = (cfg.locationPreset as string) || "brand";
    // Background ad-hoc del Content Analyzer tiene prioridad sobre el del Brand Kit.
    const adHocBgScene = (cfg.adHocBackgroundUrl as string) || "";
    if (adHocBgScene && locationPresetKeyScene === "brand") {
      cands.push({ url: adHocBgScene, priority: 2, label: `LOCATION ANCHOR — every scene MUST take place in this EXACT environment. Same walls, same props, same lighting direction, same perspective, same time of day. Only the pose and framing change between scenes.` });
    } else if (selectedBackground?.imageUrl && locationPresetKeyScene === "brand") {
      cands.push({ url: selectedBackground.imageUrl, priority: 2, label: `LOCATION ANCHOR — every scene MUST take place in this EXACT environment. Same walls, same props, same lighting direction, same perspective, same time of day. Only the pose and framing change between scenes.` });
    }
    selectedProducts.filter(Boolean).forEach((p) => { if (p?.imageUrl) cands.push({ url: p!.imageUrl, priority: 3, label: `"${p!.name}"` }); });

    const budget = Math.max(1, MAX_SCENE_REFS - reserve);
    const kept = cands
      .map((c, i) => ({ c, i }))
      .sort((a, b) => a.c.priority - b.c.priority || a.i - b.i)
      .slice(0, budget)
      .sort((a, b) => a.i - b.i)
      .map((x) => x.c);
    return {
      urls: kept.map((c) => c.url),
      desc: kept.map((c, i) => `Image ${i + 1}: ${c.label}`).join("\n"),
    };
  };

  // Chain mode: when the analyzer flagged state_continuity (transformation videos
  // like paint, makeup, getting wet), each scene chains from the PREVIOUS scene's
  // result instead of the base image. That carries forward progressing visual state.
  const stateContinuity = (cfg.stateContinuity as boolean) === true;
  const statefulElements = Array.isArray(cfg.statefulElements) ? (cfg.statefulElements as string[]) : [];
  const statefulList = statefulElements.length > 0
    ? `Progressing elements that MUST persist and accumulate from the previous frame: ${statefulElements.join(", ")}.`
    : "";

  const multishotResults: Array<{
    sceneId: string; title: string; sceneType: "creative";
    variations: Array<{ id: string; url: string; label: string; prompt: string }>;
  }> = [{
    sceneId: scenes[0].id,
    title: scenes[0].title,
    sceneType: "creative",
    variations: [{ id: `${scenes[0].id}_v1`, url: baseImageResult.url, label: "Base frame", prompt: scenes[0].image_prompt }],
  }];

  // The "previous frame" anchor for chain mode — starts as the base image,
  // then advances to each scene's chosen variation as we generate.
  let previousFrameUrl = baseImageResult.url;

  for (let i = 1; i < scenes.length; i++) {
    const scene = scenes[i];
    // Looks mode con shots: la escena trae su `garmentId` (set en handleScript).
    // El lookup por id devuelve EL outfit correcto sin importar el orden — una
    // misma prenda puede aparecer en varias escenas (general / detail / back).
    // Fallback al viejo `slice(i, i+1)` para scripts legacy sin garmentId.
    const sceneGarment = scene.garmentId
      ? allClothing.find((c) => c.id === scene.garmentId)
      : undefined;
    let sceneClothing = reelMode === "looks"
      ? (sceneGarment ? [sceneGarment] : allClothing.slice(i, i + 1))
      : allClothing;
    if (reelMode === "looks" && sceneClothing.length === 0 && allClothing.length > 0) {
      sceneClothing = allClothing.slice(-1); // reuse the last garment rather than none
    }
    // Always anchor each scene to a reference frame so the model/outfit/setting stay
    // consistent across scenes (the #1 cause of drift was generating scenes 2+ from the
    // brand assets alone, with no anchor). Chain mode advances the anchor to the previous
    // scene for state propagation; otherwise we anchor to the base image (scene 1) — a
    // stable reference that doesn't accumulate drift. Reserve 1 slot for the anchor.
    const anchorUrl = stateContinuity ? previousFrameUrl : baseImageResult.url;
    const { urls: baseRefUrls, desc: baseRefDesc } = buildCappedRefs(sceneClothing, 1);
    const refUrls = [anchorUrl, ...baseRefUrls];

    const anchorHeader = stateContinuity
      ? `Image 1: PREVIOUS FRAME — this is the immediate prior scene. The model must look IDENTICAL in identity, clothing fit, AND all progressing state. ${statefulList} The new scene only changes pose, action and framing — every stateful element CARRIES FORWARD and may continue to progress as described below.\n`
      : reelMode === "looks"
        ? `Image 1: MODEL + SCENE ANCHOR — keep the SAME person (face, hair, body) and the SAME location, lighting and overall styling as this frame. Only the OUTFIT changes, to the garment reference(s) listed below.\n`
        : `Image 1: CONSISTENCY ANCHOR — keep this frame's EXACT model, outfit, hair, styling, location and lighting. ONLY the pose, gesture and camera framing change between scenes — do NOT change the clothing or the person.\n`;

    // Re-number the rest of the refs starting at 2 (the anchor is always Image 1).
    const restDesc = baseRefDesc.replace(/Image (\d+):/g, (_m, n) => `Image ${parseInt(n, 10) + 1}:`);

    const fullRefDesc = (anchorHeader + restDesc).trim();
    const lookSignature = getLookSignature(cfg);
    const variations: Array<{ id: string; url: string; label: string; prompt: string }> = [];

    for (let v = 0; v < 2; v++) {
      const varHint = REEL_VARIATIONS[v % REEL_VARIATIONS.length];
      let prompt = scene.image_prompt;
      if (fullRefDesc) prompt = `REFERENCE IMAGES:\n${fullRefDesc}\n\n${prompt}`;
      if (lookSignature) prompt = `${lookSignature}\n\n${prompt}`;
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

    // Advance the chain: use the first successful variation as the anchor for the next scene
    if (stateContinuity) {
      const firstGood = variations.find((va) => va.url);
      if (firstGood) previousFrameUrl = firstGood.url;
    }
  }

  return { result: multishotResults, needsApproval: true };
};

// ── Animate — Kling image-to-video per curated frame ─────

export const handleAnimate: StepHandler = async (ctx) => {
  const { activeBrand, config, getStepResult, getScriptScenes } = ctx;
  const cfg = config as unknown as Record<string, unknown>;

  const curationSelections = ctx.curationSelections || {};
  const rawMultishot = getStepResult("multishot") as
    | Array<{ sceneId: string; title: string; variations: Array<{ id: string; url: string }> }>
    | { variations?: Array<{ sceneId: string; title: string; variations: Array<{ id: string; url: string }> }> }
    | undefined;
  const multishotData = Array.isArray(rawMultishot)
    ? rawMultishot
    : rawMultishot?.variations;
  const scriptScenes = getScriptScenes();

  if (!multishotData?.length) throw new Error("No shots found.");

  const framesToAnimate = multishotData.map((scene) => {
    const selectedVariationId = curationSelections[scene.sceneId];
    const selected = selectedVariationId
      ? scene.variations.find((v) => v.id === selectedVariationId)
      : scene.variations[0];
    const scriptScene = scriptScenes.find((s) => s.id === scene.sceneId) as (typeof scriptScenes[0] & { note?: string; animationHint?: string }) | undefined;
    return {
      sceneId: scene.sceneId,
      title: scene.title,
      imageUrl: selected?.url || scene.variations[0]?.url || "",
      note: scriptScene?.note || "",
      // Pasado para que el motion del VIDEO_SHOT_CATALOG sustituya al genérico
      // (ej. el shot "detail" pide un dolly-in, no un sway de modelo).
      shotId: scriptScene?.shotId,
      // Instrucción del usuario tipeada durante curación (step Shots). Se inyecta
      // al motionPrompt junto con el motion del catálogo. Ej. "agarra la cartera
      // con energía". Permite anticipar la intención sin tener que animar primero.
      animationHint: scriptScene?.animationHint?.trim() || "",
    };
  }).filter((f) => f.imageUrl);

  if (!framesToAnimate.length) throw new Error("No valid images to animate.");

  // Build the static brand-asset URL list once — used by Seedance as additional refs
  // beyond the curated scene image (which is also passed). The full set lets Seedance
  // anchor on the avatar's face, the actual product/clothing, and the location.
  const engine = (cfg.animationEngine as "kling" | "seedance") || "kling";
  const brandRefUrls: string[] = [];
  if (engine === "seedance") {
    const selectedAvatarIds = (cfg.selectedAvatarIds as string[]) || [];
    const selectedAvatar = selectedAvatarIds.length
      ? (activeBrand.avatars || []).find((a) => selectedAvatarIds.includes(a.id))
      : activeBrand.avatars?.find((a) => a.id === config.selectedAvatarId);
    if (selectedAvatar?.imageUrl) brandRefUrls.push(avatarImageUrl(selectedAvatar.imageUrl));

    const selectedProductIds = (cfg.selectedProductIds as string[]) || [];
    const selectedProducts = selectedProductIds.length
      ? (activeBrand.products || []).filter((p) => selectedProductIds.includes(p.id))
      : config.selectedProductId ? [(activeBrand.products || []).find((p) => p.id === config.selectedProductId)].filter(Boolean) : [];
    for (const p of selectedProducts) {
      if (p?.imageUrl) brandRefUrls.push(productImageUrl(p.imageUrl));
    }

    const selectedClothing = (activeBrand.clothing || []).filter((c) => config.selectedClothingIds.includes(c.id));
    for (const c of selectedClothing) {
      if (c.imageUrl) brandRefUrls.push(clothingImageUrl(c.imageUrl));
    }

    const selectedBackground = (activeBrand.backgrounds || []).find((bg) => bg.id === config.selectedBackgroundId);
    if (selectedBackground?.imageUrl) brandRefUrls.push(backgroundImageUrl(selectedBackground.imageUrl));
  }

  // Creative mode controls how each frame becomes a clip:
  //   - "single-frame"    → each curated image is animated in place (model moves within frame)
  //   - "frame-to-frame"  → each clip morphs from this scene's image to the NEXT scene's image
  //                         (catalog/lookbook flow — look A transitions into look B)
  //   - "single-frame" (default) → cada plano se anima en su lugar (sway/pelo/pose).
  //                                  Cada clip es independiente y respeta el motion del shot.
  //   - "frame-to-frame"          → cada clip es un morph del plano N al plano N+1.
  //                                  Útil para catálogos / lookbooks con transiciones.
  // El modo "auto" se eliminó — antes forzaba f2f en Looks mode sin que el usuario lo
  // viera, y la decisión quedaba escondida. Ahora es elección consciente desde el bloque
  // "Movimiento de cada clip" en Fashion Reel (Looks + Kling).
  // Seedance no tiene path f2f → siempre single-frame (reference-to-video).
  const reelMode = (cfg.reelMode as string) || "story";
  const rawCreativeMode = (cfg.creativeMode as string) || "single-frame";
  const useF2F = engine === "kling" && rawCreativeMode === "frame-to-frame";
  const klingModel = ((cfg.videoModel as KlingModel) || "v3-pro") as KlingModel;
  // Duración por clip — Kling V3 Pro acepta "5" o "10". Default 5s.
  const clipDuration = ((cfg.clipDuration as string) === "10" ? "10" : "5") as "5" | "10";
  // Debug log para troubleshooting del modo de clip. Si f2f no funciona, abrir la
  // consola del browser y ver estos valores — ayuda a distinguir entre "config
  // no se guardó" vs "lógica del handler no entra en la rama f2f".
  console.log("[fashion_reel.animate]", {
    engine, reelMode, rawCreativeMode, useF2F, klingModel, clipDuration,
    frameCount: framesToAnimate.length,
  });

  // Entry hook: the base_image step may have generated an empty-scene frame. When present,
  // scene 1 animates as a f2f from the EMPTY scene → the model present (model walks in).
  const baseStep = getStepResult("base_image") as { entryFrameUrl?: string } | undefined;
  const entryFrameUrl = (cfg.entryHook as boolean) === true ? baseStep?.entryFrameUrl : undefined;

  const animatedResults: Array<{ sceneId: string; title: string; videoUrl: string; imageUrl: string; mode?: string; motionPrompt?: string }> = [];

  for (let i = 0; i < framesToAnimate.length; i++) {
    const frame = framesToAnimate[i];
    // Debug: log para cada frame qué rama va a tomar (entry hook / seedance / f2f / single).
    const willTakeF2F = useF2F && i < framesToAnimate.length - 1 && engine === "kling";
    console.log(`[fashion_reel.animate frame ${i}]`, {
      sceneId: frame.sceneId,
      title: frame.title,
      willTakeF2F,
      isLast: i === framesToAnimate.length - 1,
      hasEntry: i === 0 && !!entryFrameUrl,
    });
    // Motion específico del shot (general/medium/detail/back) si vino del catalog;
    // sino caemos al genérico. Cada shot tiene su propia receta de movimiento
    // (ej. detail = dolly-in lento sobre el textil, no sway de modelo).
    const shotMotion = frame.shotId ? VIDEO_SHOT_CATALOG[frame.shotId]?.motion : undefined;
    // USER DIRECTION — la instrucción que el usuario tipeó en curación. Si está,
    // se inyecta con marca clara para que Kling sepa que es la prioridad. La idea
    // es enriquecer (no reemplazar) el motion del catálogo, así el "detail" sigue
    // haciendo dolly-in pero también incorpora "agarra la cartera con energía".
    const userDirection = frame.animationHint
      ? ` USER DIRECTION (priority): ${frame.animationHint}.`
      : "";
    const motionPrompt = shotMotion
      ? `${shotMotion} ${frame.note ? `Context: ${frame.note}.` : ""}${userDirection} Vertical 9:16.`
      : frame.note
        ? `Fashion model: ${frame.note}.${userDirection} Smooth, natural, confident movement. Vertical 9:16.`
        : `Fashion model subtle natural movement — slight sway, confident pose, hair movement.${userDirection} Vertical 9:16.`;

    try {
      let videoUrl = "";
      let clipMode = "single";
      let usedPrompt = motionPrompt;

      // Scene 1 + entry hook: f2f from the empty scene to the model present.
      if (i === 0 && entryFrameUrl && engine === "kling") {
        const entryPrompt = "The space starts empty. The fashion model walks in naturally from off-frame, enters the scene confidently, and settles into the final pose facing camera. Smooth fluid entrance. Background stays consistent. Vertical 9:16.";
        usedPrompt = entryPrompt;
        try {
          const job = await createKlingFrameToFrame({
            start_image_url: entryFrameUrl,
            end_image_url: frame.imageUrl,
            prompt: entryPrompt,
            duration: clipDuration,
            model: klingModel,
          });
          const r = await pollKlingVideo(job.request_id);
          if (r.video_url) {
            animatedResults.push({ sceneId: frame.sceneId, title: frame.title, videoUrl: r.video_url, imageUrl: frame.imageUrl, mode: "entry", motionPrompt: entryPrompt });
            continue;
          }
        } catch { /* fall through to normal animation if entry f2f fails */ }
      }

      if (engine === "seedance") {
        // Seedance multi-ref: the curated scene image goes FIRST (anchors composition),
        // then the brand assets. Capped at 6 refs total to stay within Fal's limits.
        const refs = [frame.imageUrl, ...brandRefUrls].slice(0, 6);
        const job = await createSeedanceReferenceToVideo({
          prompt: motionPrompt,
          referenceImageUrls: refs,
          duration: clipDuration,
        });
        const result = job.video_url
          ? { status: "completed", video_url: job.video_url }
          : await pollSeedanceVideo(job.request_id);
        videoUrl = result.video_url || "";
      } else if (useF2F && i < framesToAnimate.length - 1) {
        // Frame-to-frame: morph from this scene's image to the next scene's image.
        // The last frame has no "next" → falls through to single-frame below.
        const next = framesToAnimate[i + 1];
        const transitionPrompt = `Fashion catalog transition: model smoothly shifts from one pose/look to the next. ${frame.note ? frame.note + ". " : ""}Seamless, elegant, confident. Vertical 9:16.`;
        usedPrompt = transitionPrompt;
        const job = await createKlingFrameToFrame({
          start_image_url: frame.imageUrl,
          end_image_url: next.imageUrl,
          prompt: transitionPrompt,
          duration: clipDuration,
          model: klingModel,
        });
        const result = await pollKlingVideo(job.request_id);
        videoUrl = result.video_url || "";
        clipMode = "f2f";
      } else {
        const job = await createKlingVideo(frame.imageUrl, motionPrompt, "5", klingModel);
        const result = await pollKlingVideo(job.request_id);
        videoUrl = result.video_url || "";
      }
      animatedResults.push({ sceneId: frame.sceneId, title: frame.title, videoUrl, imageUrl: frame.imageUrl, mode: clipMode, motionPrompt: usedPrompt });
    } catch {
      animatedResults.push({ sceneId: frame.sceneId, title: frame.title, videoUrl: "", imageUrl: frame.imageUrl, mode: "single", motionPrompt });
    }
  }

  return { result: animatedResults, needsApproval: true };
};

// ── Render — FFmpeg concat, no subtitles ─────────────────

export const handleRender: StepHandler = async (ctx) => {
  const { activeBrand, config, getStepResult, getScriptScenes, tool } = ctx;
  const cfg = config as unknown as Record<string, unknown>;
  // animate result is wrapped after approval (same pattern as multishot) —
  // handle both shapes.
  const rawAnimate = getStepResult("animate") as
    | Array<{ sceneId: string; title: string; videoUrl: string; imageUrl: string }>
    | { variations?: Array<{ sceneId: string; title: string; videoUrl: string; imageUrl: string }> }
    | undefined;
  const animateData = Array.isArray(rawAnimate)
    ? rawAnimate
    : rawAnimate?.variations;

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

  // Persistence handled by autoSaveStep in ToolRunPage — no manual saveGeneration here.

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
