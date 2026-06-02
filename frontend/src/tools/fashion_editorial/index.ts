/**
 * Fashion Editorial — Tool Definition
 * ────────────────────────────────────
 * Pipeline: generate_all (single step)
 *
 * Editorial fashion stills (NOT e-commerce). You pick the model (avatar) + garment(s),
 * choose framing / lighting / vibe presets, optionally a moodboard (art direction) and a
 * Look & Feel reference (analyzed into a color-grade recipe, so no scene leaks), and write
 * a free-form brief IN SPANISH. Gemini interprets the brief + references and builds the
 * polished English prompt; then N variations are generated with Nano Banana 2 to pick from.
 */

import type { ToolDefinition, StepHandler } from "../types";
import { createImageEdit, pollImageGen, enhanceManualPrompt, describeLookAndFeelUpload } from "../../lib/api";

// Single-select presets. Each clause is fed to Gemini as creative direction.
export const EDITORIAL_FRAMINGS: Record<string, { label: string; clause: string }> = {
  full_body:      { label: "Cuerpo entero",  clause: "Full-body editorial framing, the whole look visible head to toe." },
  three_quarter:  { label: "3/4",            clause: "Three-quarter body framing, dynamic editorial crop." },
  portrait:       { label: "Retrato",        clause: "Tight beauty/portrait framing, face and upper garment, shallow depth of field." },
  detail:         { label: "Detalle",        clause: "Close-up detail of the garment as worn — fabric, texture, accessories." },
};

export const EDITORIAL_LIGHTING: Record<string, { label: string; clause: string }> = {
  dramatic:    { label: "Dramática",     clause: "Dramatic directional hard light with deep controlled shadows, high-contrast editorial mood." },
  soft:        { label: "Suave natural", clause: "Soft natural diffused light, gentle shadows, airy and clean." },
  high_key:    { label: "High-key",      clause: "Bright high-key lighting, minimal shadows, fresh and luminous." },
  golden:      { label: "Golden hour",   clause: "Warm golden-hour light, long soft shadows, cinematic warmth." },
  flash:       { label: "Flash directo", clause: "On-camera direct flash, hard falloff, raw street/editorial flash look." },
};

export const EDITORIAL_VIBES: Record<string, { label: string; clause: string }> = {
  magazine:  { label: "Revista",     clause: "High-fashion magazine editorial aesthetic, shot on medium format, refined retouch." },
  street:    { label: "Street",      clause: "Street-style editorial, urban environment, candid energy." },
  studio:    { label: "Estudio",     clause: "Minimal studio editorial on a clean seamless backdrop, sculptural." },
  cinematic: { label: "Cinemático",  clause: "Cinematic editorial, filmic color, atmospheric and moody." },
  vintage:   { label: "Vintage film", clause: "Analog film editorial, subtle grain and halation, nostalgic palette." },
};

export const DEFAULT_FRAMING = "full_body";
export const DEFAULT_LIGHTING = "dramatic";
export const DEFAULT_VIBE = "magazine";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

const handleGenerate: StepHandler = async (ctx) => {
  const { activeBrand, config } = ctx;
  const cfg = config as unknown as Record<string, unknown>;

  // ── Resolve content references ──
  const avatar = activeBrand.avatars?.find((a) => a.id === config.selectedAvatarId)
    || (config.selectedAvatarIds?.length ? (activeBrand.avatars || []).find((a) => config.selectedAvatarIds.includes(a.id)) : undefined);
  const garments = (activeBrand.clothing || []).filter((c) => config.selectedClothingIds.includes(c.id));
  const selectedProduct = (activeBrand.products || []).find((p) => p.id === config.selectedProductId);
  const garmentUrls = garments.map((g) => g.imageUrl).filter(Boolean) as string[];
  if (selectedProduct?.imageUrl && garmentUrls.length === 0) garmentUrls.push(selectedProduct.imageUrl);
  const moodboard = (activeBrand.moodboards || []).find((m) => m.id === config.selectedMoodboardId);

  if (!avatar?.imageUrl && garmentUrls.length === 0) {
    throw new Error("Elegí al menos un modelo (avatar) o una prenda para la editorial.");
  }

  // ── Look & Feel → color-grade RECIPE (text), never passed as an image (no scene leak) ──
  const refFiles = ((cfg.referenceImages as File[]) || []).filter((f) => f && typeof f.type === "string" && f.type.startsWith("image/"));
  let recipe = "";
  if (refFiles[0]) {
    try { recipe = (await describeLookAndFeelUpload(refFiles[0])).description?.trim() || ""; }
    catch (e) { console.warn("[fashion_editorial] look&feel recipe failed:", e); }
  }

  // ── Presets ──
  const framing = EDITORIAL_FRAMINGS[(cfg.editorialFraming as string)] || EDITORIAL_FRAMINGS[DEFAULT_FRAMING];
  const lighting = EDITORIAL_LIGHTING[(cfg.editorialLighting as string)] || EDITORIAL_LIGHTING[DEFAULT_LIGHTING];
  const vibe = EDITORIAL_VIBES[(cfg.editorialVibe as string)] || EDITORIAL_VIBES[DEFAULT_VIBE];
  const briefES = (config.objective || "").trim();

  // ── Build refs for the generator + the enhancer (same order = consistent "Image N") ──
  const refs: Array<{ tag: string; label: string; url: string }> = [];
  let idx = 1;
  if (avatar?.imageUrl) {
    refs.push({ tag: `image${idx}`, label: "the MODEL — use her exact face, hair and body; IGNORE the clothing in her photo, she will be fully re-dressed", url: avatar.imageUrl });
    idx++;
  }
  garmentUrls.forEach((u) => {
    refs.push({ tag: `image${idx}`, label: "GARMENT the model must WEAR — keep its exact color, fabric, print, stitching and proportions (the garment image is authoritative)", url: u });
    idx++;
  });
  if (moodboard?.imageUrl) {
    refs.push({ tag: `image${idx}`, label: "ART-DIRECTION moodboard — aesthetic / palette / mood reference ONLY, do not copy its content or people", url: moodboard.imageUrl });
    idx++;
  }

  // ── Seed → Gemini interprets the Spanish brief + refs into the final English prompt ──
  const dress = avatar?.imageUrl
    ? `Dress the model (Image 1) in the garment${garmentUrls.length > 1 ? "s" : ""}; keep her identity and re-dress her completely.`
    : "Feature the garment on a fitting model.";
  const seed = [
    "Editorial fashion photograph, high-end magazine quality.",
    dress,
    framing.clause,
    lighting.clause,
    vibe.clause,
    recipe ? `Color grade / mood: ${recipe}` : "",
    "Keep the garment pixel-exact. No text, no watermark, no logo overlay, no collage.",
    briefES ? `Direction from the user (written in Spanish — interpret it faithfully): ${briefES}` : "",
  ].filter(Boolean).join(" ");

  let prompt = seed;
  let interpretation = "";
  try {
    const enh = await enhanceManualPrompt({ prompt: seed, refs, mode: "image", targetModel: "nano-banana-2" });
    if (enh.enhanced) prompt = enh.enhanced;
    interpretation = enh.interpretation || "";
  } catch (e) {
    console.warn("[fashion_editorial] enhance failed, using seed prompt:", e);
  }

  // ── Generate N variations in parallel (same prompt, different seeds) ──
  const n = Math.max(1, Math.min(6, config.numVariations || 3));
  const refUrls = refs.map((r) => r.url);
  const runOne = async (): Promise<string> => {
    const job = await createImageEdit(refUrls, prompt, config.aspectRatio, config.resolution, "nano-banana-2");
    const res = await pollImageGen(job.request_id);
    if (res.status === "failed" || !res.image_url) throw new Error(res.error || "Image generation failed");
    return res.image_url;
  };
  const settled = await Promise.allSettled(Array.from({ length: n }, runOne));
  const images = settled.map((s, i) => ({
    id: `editorial_${i + 1}`,
    url: s.status === "fulfilled" ? s.value : "",
    label: `Variante ${i + 1}`,
    prompt,
    status: s.status === "fulfilled" ? "done" : "failed",
  }));
  const successful = images.filter((im) => im.url).length;
  if (successful === 0) throw new Error("No se pudo generar ninguna variante. Probá de nuevo o ajustá el brief.");

  return {
    result: { images, successful, total: images.length, interpretation, prompt },
    needsApproval: false,
  };
};

export const fashionEditorial: ToolDefinition = {
  schema: {
    showAvatar: true, avatarLabel: "Modelo",
    showProduct: true, productLabel: "Producto (opcional)",
    showClothing: true, clothingLabel: "Prenda", clothingSublabel: "la prenda que lleva la modelo — multi-select para un look completo",
    showBackground: false,
    showMoodboard: true,
    showReference: true,
    showVoice: false, showTone: false, showPlatform: false, showLanguage: false,
    showVariations: true,
    objectiveLabel: "Tu pedido (en español)",
    objectivePlaceholder: "Escribí en español lo que querés: la pose, la actitud, el ambiente, los colores… Gemini lo interpreta y arma el prompt.",
    showNotes: false,
  },
  stepHandlers: {
    generate_all: handleGenerate,
  },
  approvalSteps: [],
  autoRunSteps: [],
};
