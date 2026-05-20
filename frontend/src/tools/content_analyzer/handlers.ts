/**
 * Content Analyzer — Step Handlers
 * ──────────────────────────────────
 * Pipeline: analyze → adapt → generate_batch
 */

import type { StepHandler } from "../types";
import { generateToolPrompt, createImageEdit, pollImageGen, matchDetectedAssets, type DetectedAssets } from "../../lib/api";

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

// ── Map Assets — cross-reference detected assets vs brand kit ──
// Replaces the upfront avatar/product/clothing/background selectors. The
// analyzer extracts what's in the video, this step asks the matcher to
// suggest the closest brand asset for each detection.

export const handleMapAssets: StepHandler = async (ctx) => {
  const { activeBrand, getStepResult } = ctx;

  const analyzeData = getStepResult("analyze") as { analysis: Record<string, unknown> } | undefined;
  if (!analyzeData?.analysis) throw new Error("No analysis found — analyze must run first.");

  const detected = (analyzeData.analysis.detected_assets as DetectedAssets) || {};

  // Empty detection? Skip the matcher call.
  const hasAnything =
    (detected.persons?.length || 0) +
    (detected.outfits?.length || 0) +
    (detected.products?.length || 0) +
    (detected.locations?.length || 0) > 0;

  if (!hasAnything) {
    return {
      result: {
        detected,
        matches: { persons: [], outfits: [], products: [], locations: [] },
        confirmations: {},
        skipped: true,
      },
      needsApproval: true,
    };
  }

  const { matches } = await matchDetectedAssets({ brandId: activeBrand.id, detected });

  // Initial confirmations = each suggested_brand_id pre-selected (user can change in the UI)
  const confirmations: Record<string, string | null> = {};
  for (const cat of ["persons", "outfits", "products", "locations"] as const) {
    for (const m of matches[cat] || []) {
      confirmations[`${cat}:${m.detected_id}`] = m.suggested_brand_id;
    }
  }

  return {
    result: { detected, matches, confirmations },
    needsApproval: true,
  };
};

// ── Adapt — use analysis to create content for YOUR brand ──

export const handleAdapt: StepHandler = async (ctx) => {
  const { activeBrand, config, getStepResult, tool } = ctx;

  const analyzeData = getStepResult("analyze") as { analysis: Record<string, unknown> } | undefined;
  if (!analyzeData?.analysis) throw new Error("No analysis found.");

  // Pull confirmed mappings from the Map Assets step. These are the user-blessed
  // detected_id → brand_id assignments. We use them to (a) seed the asset lists
  // adapt will use, and (b) inject a strict per-scene mapping rule so Gemini doesn't
  // drift (e.g., script saying "buzo" but image_prompt showing a tee).
  interface MapMatch { detected_id: string; description: string; scenes: number[]; suggested_brand_id: string | null }
  interface MapResult {
    matches?: { persons?: MapMatch[]; outfits?: MapMatch[]; products?: MapMatch[]; locations?: MapMatch[] };
    confirmations?: Record<string, string | null>;
    overrides?: Record<string, string>;
    roles?: Record<string, "hero" | "wardrobe">;
  }
  const mapStep = getStepResult("map_assets") as MapResult | undefined;
  const confirmations = mapStep?.confirmations || {};
  const overrides = mapStep?.overrides || {};
  const roles = mapStep?.roles || {};

  const confirmedIdsFor = (cat: "persons" | "outfits" | "products" | "locations"): string[] => {
    const out: string[] = [];
    for (const [key, value] of Object.entries(confirmations)) {
      if (key.startsWith(cat + ":") && value) out.push(value);
    }
    return Array.from(new Set(out));
  };

  const mappedAvatarIds = confirmedIdsFor("persons");
  const mappedClothingIds = confirmedIdsFor("outfits");
  const mappedProductIds = confirmedIdsFor("products");
  const mappedBackgroundIds = confirmedIdsFor("locations");

  // The matcher now cross-references garments against BOTH clothing and products
  // (a t-shirt the brand sells might be cataloged in either bucket). So a confirmed
  // "outfit" id can point to a clothing OR a product asset, and vice versa. Resolve
  // each confirmed id against both pools so nothing is silently dropped.
  const clothingPool = activeBrand.clothing || [];
  const productPool = activeBrand.products || [];
  const findInEither = (id: string) =>
    clothingPool.find((c) => c.id === id) || productPool.find((p) => p.id === id);

  // Prefer Map-Assets-confirmed IDs over the old upfront-selector IDs (legacy).
  const selectedAvatars = mappedAvatarIds.length
    ? (activeBrand.avatars || []).filter((a) => mappedAvatarIds.includes(a.id))
    : (config.selectedAvatarIds?.length)
      ? (activeBrand.avatars || []).filter((a) => config.selectedAvatarIds.includes(a.id))
      : config.selectedAvatarId ? [activeBrand.avatars?.find((a) => a.id === config.selectedAvatarId)].filter(Boolean) : [];

  // Resolve mapped product ids across both pools (garment cataloged as product OR clothing).
  const selectedProducts = mappedProductIds.length
    ? mappedProductIds.map(findInEither).filter((x): x is NonNullable<typeof x> => Boolean(x))
    : (config.selectedProductIds?.length)
      ? (activeBrand.products || []).filter((p) => config.selectedProductIds.includes(p.id))
      : config.selectedProductId ? [(activeBrand.products || []).find((p) => p.id === config.selectedProductId)].filter(Boolean) : [];
  // Resolve mapped outfit ids across both pools too.
  const selectedClothing = mappedClothingIds.length
    ? mappedClothingIds.map(findInEither).filter((x): x is NonNullable<typeof x> => Boolean(x))
    : (activeBrand.clothing || []).filter((c) => config.selectedClothingIds.includes(c.id));
  void mappedBackgroundIds;

  // Build per-detection rewrite directives so Gemini knows EXACTLY what to swap in.
  // For each detected outfit/product the user mapped to a brand asset, emit:
  //   "Source had <detected_description> in scenes [1,2]; in the adapted output use
  //    <brand_asset_name> (<brand_asset_description>) — both the script AND the
  //    image_prompt of those scenes MUST reference THIS asset, never the original."
  const buildRewriteRules = (
    cat: "outfits" | "products",
    brandList: typeof selectedClothing | typeof selectedProducts,
  ): string => {
    const matches = mapStep?.matches?.[cat] || [];
    const lines: string[] = [];
    for (const m of matches) {
      const brandId = confirmations[`${cat}:${m.detected_id}`];
      if (!brandId) continue;
      const brandAsset = brandList.find((b) => b && b.id === brandId);
      if (!brandAsset) continue;
      const brandDesc = brandAsset.description ? ` (${brandAsset.description})` : "";
      const sceneList = m.scenes?.length ? `scenes ${m.scenes.join(", ")}` : "all relevant scenes";
      lines.push(
        `- The source video showed "${m.description}" in ${sceneList}. In your output you MUST replace it with "${brandAsset.name}"${brandDesc}. ` +
        `BOTH the script and the image_prompt of those scenes MUST reference "${brandAsset.name}" — never the original "${m.description}". ` +
        `Maintain the SAME role (held/worn/featured/foreground) the original asset had in each scene.`
      );
    }
    return lines.join("\n");
  };

  const outfitRules = buildRewriteRules("outfits", selectedClothing);
  const productRules = buildRewriteRules("products", selectedProducts);

  // Text-override rules: for any detected item the user edited (e.g. changed
  // "bikini" → "vestido largo", or "dark beach at night" → "sunny beach by day"),
  // emit a directive so the adapt step keeps the reference structure but applies
  // the user's change. Works for ALL categories — including locations/outfits where
  // the brand kit is empty and there's no asset to map to.
  const buildOverrideRules = (): string => {
    const lines: string[] = [];
    const catLabels: Record<string, string> = {
      persons: "persona", outfits: "outfit/vestuario", products: "producto", locations: "locación/fondo",
    };
    for (const [key, newText] of Object.entries(overrides)) {
      if (!newText?.trim()) continue;
      const [cat, ...idParts] = key.split(":");
      const detectedId = idParts.join(":");
      const catMatches = (mapStep?.matches?.[cat as keyof NonNullable<MapResult["matches"]>] || []) as MapMatch[];
      const match = catMatches.find((m) => m.detected_id === detectedId);
      const original = match?.description || "(elemento original)";
      const sceneList = match?.scenes?.length ? `escenas ${match.scenes.join(", ")}` : "las escenas relevantes";
      const label = catLabels[cat] || cat;
      lines.push(
        `- En ${sceneList}, el video original mostraba como ${label}: "${original}". ` +
        `En TU versión, cambialo por: "${newText.trim()}". ` +
        `Mantené la MISMA estructura, encuadre y rol que tenía en el original, pero aplicá este cambio TANTO en el script como en el image_prompt de esas escenas.`
      );
    }
    return lines.join("\n");
  };
  const overrideRules = buildOverrideRules();

  // Role rules: hero garments get featured/close-up treatment; wardrobe garments are
  // worn as styling/context. Default inferred (products=hero, outfits=wardrobe) but the
  // user may have flipped any in the Map Assets step.
  const buildRoleRules = (): string => {
    const heroLines: string[] = [];
    const wardrobeLines: string[] = [];
    for (const cat of ["outfits", "products"] as const) {
      const catMatches = (mapStep?.matches?.[cat] || []) as MapMatch[];
      for (const m of catMatches) {
        const explicit = roles[`${cat}:${m.detected_id}`];
        const role = explicit || (cat === "products" ? "hero" : "wardrobe");
        const label = m.description || "(prenda)";
        if (role === "hero") heroLines.push(`"${label}"`);
        else wardrobeLines.push(`"${label}"`);
      }
    }
    const lines: string[] = [];
    if (heroLines.length) {
      lines.push(
        `- PRODUCTOS PROTAGONISTAS (hero): ${heroLines.join(", ")}. Estos son el FOCO del contenido — ` +
        `dales close-ups, planos de detalle, y que el script los mencione/destaque. Son lo que se está vendiendo.`
      );
    }
    if (wardrobeLines.length) {
      lines.push(
        `- WARDROBE / STYLING: ${wardrobeLines.join(", ")}. La modelo los usa para completar el look, ` +
        `pero NO son el foco — van naturales, sin close-ups dedicados, el script no se centra en ellos.`
      );
    }
    return lines.join("\n");
  };
  const roleRules = buildRoleRules();

  const allRewriteRules = [outfitRules, productRules, overrideRules, roleRules].filter(Boolean).join("\n");

  const extraVars: Record<string, string> = {
    video_analysis: JSON.stringify(analyzeData.analysis),
    language: config.language || "es",
  };
  if (config.objective) extraVars.creative_direction = config.objective;
  if (allRewriteRules) extraVars.asset_swap_rules = allRewriteRules;

  let userMsg = "Adapt this video content for my brand. Respond with ONLY a JSON object.";
  if (selectedProducts.length > 0) userMsg += `\nMy products: ${selectedProducts.map((p) => p?.name).join(", ")}`;
  if (selectedAvatars.length > 0) userMsg += `\nMy characters: ${selectedAvatars.map((a) => `${a?.name}${a?.description ? ` (${a.description})` : ""}`).join(", ")}`;
  if (selectedClothing.length > 0) userMsg += `\nGarments: ${selectedClothing.map((c) => c.name).join(", ")}`;
  if (allRewriteRules) {
    userMsg += `\n\nSTRICT ASSET-SWAP RULES (user-confirmed mappings — every scene's script AND image_prompt must comply):\n${allRewriteRules}`;
  }

  const { result } = await generateToolPrompt(activeBrand.id, "content_analyzer", userMsg, extraVars);

  // Parse — handle string, markdown fences, or already-parsed object
  let parsed: Record<string, unknown> = {};
  const raw = typeof result === "string" ? result : JSON.stringify(result);
  console.log("[adapt] raw result (first 500):", raw.slice(0, 500));

  // Strip markdown code fences
  let clean = raw.trim();
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  }
  // Find first { ... } block
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    try {
      parsed = JSON.parse(clean.slice(start, end + 1));
    } catch {
      // JSON might be truncated — walk backwards to find last complete object
      let tryEnd = end;
      while (tryEnd > start) {
        try {
          parsed = JSON.parse(clean.slice(start, tryEnd + 1));
          break;
        } catch {
          tryEnd = clean.lastIndexOf("}", tryEnd - 1);
        }
      }
      if (Object.keys(parsed).length === 0) {
        console.warn("[adapt] parse failed. End chars:", clean.slice(-200));
        throw new Error(`JSON truncado o inválido. Final: ...${clean.slice(-150)}`);
      }
    }
  } else {
    throw new Error(`Gemini no devolvió JSON válido. Respuesta: ${clean.slice(0, 200)}`);
  }

  // Find scenes array — search recursively up to 2 levels deep
  function findScenesArray(obj: Record<string, unknown>): Array<Record<string, unknown>> | null {
    if (Array.isArray(obj.scenes) && obj.scenes.length > 0) return obj.scenes as Array<Record<string, unknown>>;
    for (const val of Object.values(obj)) {
      if (val && typeof val === "object" && !Array.isArray(val)) {
        const nested = val as Record<string, unknown>;
        if (Array.isArray(nested.scenes) && nested.scenes.length > 0) return nested.scenes as Array<Record<string, unknown>>;
        // any array of objects with script/voiceover/image_prompt fields
        for (const v2 of Object.values(nested)) {
          if (Array.isArray(v2) && v2.length > 0 && typeof v2[0] === "object") return v2 as Array<Record<string, unknown>>;
        }
      }
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object") return val as Array<Record<string, unknown>>;
    }
    return null;
  }
  const scenes = (findScenesArray(parsed) ?? []) as Array<Record<string, string>>;
  const nestedObj = Object.values(parsed).find(v => v && typeof v === "object" && !Array.isArray(v)) as Record<string, unknown> | undefined;
  console.log("[adapt] nested keys:", nestedObj ? Object.keys(nestedObj) : "none");
  console.log("[adapt] scenes found:", scenes.length, "first:", JSON.stringify(scenes[0]));

  // Top-level may be nested under video_adaptation or similar
  const root = (Object.values(parsed).find(v => v && typeof v === "object" && !Array.isArray(v)) as Record<string, unknown> | undefined) ?? parsed;

  // Extract a flat string from a value that might be nested (object with text/value, array of strings, etc.)
  const lang = config.language || "es";
  const extractStr = (val: unknown): string => {
    if (!val) return "";
    if (typeof val === "string") return val;
    if (typeof val === "number") return String(val);
    if (Array.isArray(val)) {
      return val.map((v) => extractStr(v)).filter(Boolean).join(" / ");
    }
    if (typeof val === "object") {
      const o = val as Record<string, unknown>;
      // Prefer the configured language when Gemini nests bilingual objects
      const preferred = lang === "es"
        ? (o.spanish || o.es || o.texto || o.text || o.value || o.content || o.script || o.voiceover || o.narration || o.english || o.en)
        : (o.english || o.en || o.text || o.value || o.content || o.script || o.voiceover || o.narration || o.spanish || o.es);
      if (preferred) return extractStr(preferred);
      return Object.values(o).filter((v): v is string => typeof v === "string").join(" ").trim();
    }
    return String(val);
  };

  // Extract adapted_script — may be array of objects or plain string
  const rawAdaptedScript = root.adapted_script || root.script || root.full_script || parsed.adapted_script || parsed.script || "";
  const adaptedScript = Array.isArray(rawAdaptedScript)
    ? (rawAdaptedScript as unknown[]).map((v) => extractStr(v)).filter(Boolean).join("\n")
    : extractStr(rawAdaptedScript);

  return {
    result: {
      adaptedScript,
      scenes: scenes.map((s: Record<string, unknown>, i) => {
        // audio_elements may be nested: { voice_over, music, ... }
        const audio = (s.audio_elements && typeof s.audio_elements === "object")
          ? s.audio_elements as Record<string, unknown>
          : null;
        const rawVO = extractStr(audio?.voice_over || audio?.voiceover || audio?.narration || "");
        // Strip "VO (Maya, tono relatable): " style prefixes
        const cleanVO = rawVO.replace(/^(?:VO|vo|V\.O\.|narrador|voiceover)[^:]*:\s*['"«»""]?/i, "").replace(/['"»""]$/, "").trim();

        if (i === 0) console.log("[adapt-scene0] audio:", JSON.stringify(audio), "cleanVO:", cleanVO.slice(0, 100));

        // Collect all string values — sort by length to separate VO (short) from image prompts (long)
        const allStrings = Object.values(s)
          .map((v) => extractStr(v))
          .filter((v) => v.length > 5)
          .map(v => v.replace(/^(?:VO|vo|V\.O\.|narrador|voiceover)[^:]*:\s*['"«»""]?/i, "").replace(/['"»""]$/, "").trim());
        const shortStrings = allStrings.filter(v => v.length <= 120).sort((a, b) => b.length - a.length);
        const longStrings = allStrings.filter(v => v.length > 120).sort((a, b) => b.length - a.length);

        // Extract script — handle nested objects
        let script = extractStr(
          s.script || s.voiceover || s.audio_narration || s.narration || s.dialogue ||
          s.text || s.copy || s.caption || s.speech || s.on_screen_text || cleanVO || ""
        );
        let imagePrompt = extractStr(
          s.image_prompt || s.prompt || s.visual_prompt || s.visuals ||
          s.visual_description || s.image_description || s.visual || s.description || s.scene_description || ""
        );

        // Strip bilingual suffixes: "texto // translation" or "[English: ...]"
        const stripBilingual = (t: string) => t
          .replace(/\s*\/\/\s*.+$/, "")                                              // "es // en"
          .replace(/\s*[\[(][A-Za-záéíóúÁÉÍÓÚñÑ]+:\s*['"]?[^'"\]\)]+['"]?[\]\)]/g, "") // [English: ...]
          .trim();
        script = stripBilingual(script);

        // If script is suspiciously long (>120 chars) it's probably an image prompt — swap
        if (!imagePrompt && script.length > 120) {
          imagePrompt = script;
          script = shortStrings[0] || "";
        }
        // If imagePrompt is still empty, use the longest string we found
        if (!imagePrompt) imagePrompt = longStrings[0] || shortStrings[1] || "";
        // If script is still empty, use the shortest non-visual string
        if (!script) script = shortStrings[0] || "";

        return {
          frame: Number(s.frame || s.scene_number || s.id) || i + 1,
          script,
          imagePrompt,
          sceneType: String(s.scene_type || s.type || s.shot_type || "story"),
        };
      }),
      styleNotes: extractStr(root.style_notes || root.style || root.visual_style || parsed.style_notes || ""),
    },
    needsApproval: true,
  };
};

// ── Route — passthrough; UI decides where to send the content ──

export const handleRoute: StepHandler = async (ctx) => {
  const analyzeResult = ctx.getStepResult("analyze");
  const adaptResult = ctx.getStepResult("adapt");
  return {
    result: { analyzeResult, adaptResult },
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

  // Persistence handled by autoSaveStep in ToolRunPage — no manual saveGeneration here.

  return {
    result: { images, successful: successful.length, total: images.length },
    needsApproval: false,
  };
};
