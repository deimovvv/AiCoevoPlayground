/**
 * Ecommerce Pack — Tool Definition
 * ─────────────────────────────────
 * Pipeline: generate_all (single step)
 *
 * Generates a consistent e-commerce product shot set for ONE garment: on-model
 * studio shots (front / 3-4 / back / detail) + flat product-only views, with the
 * garment kept pixel-exact across every shot. On-model shots are anchored to the
 * first generated frame so the model + garment + studio stay consistent.
 */

import type { ToolDefinition, StepHandler } from "../types";
import { createImageEdit, createTextToImage, pollImageGen } from "../../lib/api";

// Shot catalog. `onModel` shots feature the model wearing the garment; the rest are
// product-only packshots. Each entry's `framing` is appended to the studio prompt.
export const SHOT_CATALOG: Record<string, { label: string; onModel: boolean; framing: string }> = {
  model_front:  { label: "On-model · Frente",  onModel: true,  framing: "Full-body or 3/4-body FRONT view: the model faces the camera straight on, standing naturally, the full garment clearly visible." },
  model_34:     { label: "On-model · 3/4",      onModel: true,  framing: "3/4 ANGLE view: the model's body turned about 45°, showing the garment's front and side." },
  model_back:   { label: "On-model · Espalda",  onModel: true,  framing: "BACK view: the model faces away from the camera, clearly showing the back of the garment." },
  model_detail: { label: "On-model · Detalle",  onModel: true,  framing: "Tight CLOSE-UP on the garment as worn (fabric, texture, print, stitching, logo) — crop to the chest/torso area, no face needed." },
  flat_front:   { label: "Flat · Frente",       onModel: false, framing: "Product-only PACKSHOT: the garment presented flat/ghost-mannequin facing FRONT, centered. NO person, NO model, NO body — only the garment." },
  flat_back:    { label: "Flat · Espalda",      onModel: false, framing: "Product-only PACKSHOT of the garment's BACK, centered. NO person, NO model — only the garment." },
  flat_detail:  { label: "Flat · Detalle",      onModel: false, framing: "Product-only MACRO close-up of the garment's fabric, stitching, label or print. NO person — only the garment." },
};

export const DEFAULT_SHOTS = ["model_front", "model_back", "model_detail", "flat_front"];

// Studio backdrop presets. "custom" falls back to the Setting Description (objective).
export const STUDIO_STYLES: Record<string, { label: string; clause: string }> = {
  white:     { label: "Blanco seamless", clause: "Seamless pure white studio background (#ffffff), soft even high-key e-commerce lighting, crisp and clean, no harsh shadows on the backdrop." },
  grey:      { label: "Gris estudio",    clause: "Light grey seamless studio backdrop, soft directional studio lighting with a subtle gradient, premium catalog look." },
  beige:     { label: "Beige cálido",    clause: "Warm beige / cream studio backdrop, soft natural-feeling light, refined editorial e-commerce look." },
  editorial: { label: "Editorial",       clause: "Editorial studio on a neutral backdrop, soft directional key light with gentle controlled shadows, fashion-magazine treatment." },
  custom:    { label: "Custom",          clause: "" },
};

const PIXEL_FIDELITY = "Reproduce the EXACT color, shade, fabric, print, stitching and proportions from the garment reference pixels. Do NOT lighten, darken, restyle or invent details — the garment image is authoritative.";
const NO_TEXT = " Single clean photograph. No text, no watermark, no logo overlay, no graphics, no collage, no split panels.";

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

  const garments = (activeBrand.clothing || []).filter((c) => config.selectedClothingIds.includes(c.id));
  const selectedProduct = (activeBrand.products || []).find((p) => p.id === config.selectedProductId);
  const garmentUrls = garments.map((g) => g.imageUrl).filter(Boolean);
  if (selectedProduct?.imageUrl && garmentUrls.length === 0) garmentUrls.push(selectedProduct.imageUrl);
  if (garmentUrls.length === 0) throw new Error("Elegí al menos una prenda (o un producto) para generar la ficha.");

  const avatar = activeBrand.avatars?.find((a) => a.id === config.selectedAvatarId)
    || (config.selectedAvatarIds?.length ? (activeBrand.avatars || []).find((a) => config.selectedAvatarIds.includes(a.id)) : undefined);
  const moodboard = (activeBrand.moodboards || []).find((m) => m.id === config.selectedMoodboardId);

  const studioKey = (cfg.studioStyle as string) || "white";
  const studioClause = studioKey === "custom"
    ? (config.objective?.trim() || STUDIO_STYLES.white.clause)
    : (STUDIO_STYLES[studioKey]?.clause || STUDIO_STYLES.white.clause);

  const shots = ((Array.isArray(cfg.ecomShots) && (cfg.ecomShots as string[]).length) ? (cfg.ecomShots as string[]) : DEFAULT_SHOTS)
    .filter((s) => SHOT_CATALOG[s]);

  // Look & feel reference (uploaded image) — lighting/aesthetic only.
  const refFiles = ((cfg.referenceImages as File[]) || []).filter((f) => f && typeof f.type === "string" && f.type.startsWith("image/"));
  let lookFeelUrl: string | undefined;
  for (const f of refFiles.slice(0, 1)) lookFeelUrl = await fileToDataUrl(f);

  // Pose reference (uploaded image) — body position only, applied to the on-model anchor.
  const poseFiles = ((cfg.poseReference as File[]) || []).filter((f) => f && typeof f.type === "string" && f.type.startsWith("image/"));
  let poseUrl: string | undefined;
  for (const f of poseFiles.slice(0, 1)) poseUrl = await fileToDataUrl(f);

  // Style refs (look&feel + moodboard) appended after the content refs, numbered from `start`.
  const styleRefs = (start: number): { urls: string[]; desc: string[] } => {
    const urls: string[] = []; const desc: string[] = []; let idx = start;
    if (lookFeelUrl) { urls.push(lookFeelUrl); desc.push(`Image ${idx}: LOOK & FEEL — match this color grading, lighting and overall treatment ONLY. Do NOT copy its content, layout or people.`); idx++; }
    if (moodboard?.imageUrl) { urls.push(moodboard.imageUrl); desc.push(`Image ${idx}: ART DIRECTION moodboard — aesthetic/palette reference ONLY, do not copy literally.`); idx++; }
    return { urls, desc };
  };

  const onModelShots = shots.filter((s) => SHOT_CATALOG[s].onModel);
  const flatShots = shots.filter((s) => !SHOT_CATALOG[s].onModel);
  const generated: Record<string, { id: string; url: string; label: string; prompt: string; status: string }> = {};

  // ── On-model shots — sequential, anchored to the first for consistency ──
  let anchorUrl: string | undefined;
  for (let i = 0; i < onModelShots.length; i++) {
    const sid = onModelShots[i];
    const shot = SHOT_CATALOG[sid];
    const urls: string[] = []; const desc: string[] = []; let idx = 1;
    if (i === 0 || !anchorUrl) {
      if (avatar?.imageUrl) { urls.push(avatar.imageUrl); desc.push(`Image ${idx}: IDENTITY — use this exact person's face, hair and body. Take ONLY the identity — IGNORE their clothing, background and pose.`); idx++; }
      garmentUrls.forEach((u) => { urls.push(u); desc.push(`Image ${idx}: GARMENT — the model WEARS this exact item. ${PIXEL_FIDELITY}`); idx++; });
      if (poseUrl) { urls.push(poseUrl); desc.push(`Image ${idx}: POSE REFERENCE — copy ONLY the body position, stance and camera framing from this image. Do NOT copy its clothing, lighting, background or the identity of anyone in it.`); idx++; }
    } else {
      urls.push(anchorUrl); desc.push(`Image ${idx}: ANCHOR — keep the SAME model, SAME garment, SAME studio and lighting as this frame. Change ONLY the camera angle / pose as described.`); idx++;
      garmentUrls.forEach((u) => { urls.push(u); desc.push(`Image ${idx}: GARMENT — same exact item. ${PIXEL_FIDELITY}`); idx++; });
    }
    const sr = styleRefs(idx); urls.push(...sr.urls); desc.push(...sr.desc);
    const wardrobe = avatar?.imageUrl ? "WARDROBE OVERRIDE: the model must be RE-DRESSED in the GARMENT reference; completely ignore any clothing in the identity photo. " : "";
    const prompt = `Professional e-commerce studio fashion photograph. ${studioClause} ${shot.framing} ${wardrobe}${PIXEL_FIDELITY}${NO_TEXT}\n\nREFERENCE IMAGES:\n${desc.join("\n")}`;
    try {
      const job = urls.length ? await createImageEdit(urls, prompt, config.aspectRatio, config.resolution) : await createTextToImage(prompt, config.aspectRatio, config.resolution);
      const res = await pollImageGen(job.request_id);
      const url = res.image_url || "";
      if (i === 0 && url) anchorUrl = url;
      generated[sid] = { id: sid, url, label: shot.label, prompt, status: res.status === "failed" ? "failed" : "done" };
    } catch (e) {
      generated[sid] = { id: sid, url: "", label: shot.label, prompt, status: "failed" };
      console.error(`[ecommerce_pack] ${sid} failed:`, e);
    }
  }

  // ── Flat product-only shots — ONE per garment (Option A). Each selected garment gets
  // its own packshot views, so "remera + pantalón" → remera frente/espalda + pantalón
  // frente/espalda. Falls back to the product when no clothing is selected. ──
  const flatSubjects = garments.length
    ? garments.map((g) => ({ id: g.id, name: g.name, url: g.imageUrl })).filter((s) => s.url)
    : (selectedProduct?.imageUrl ? [{ id: selectedProduct.id, name: selectedProduct.name, url: selectedProduct.imageUrl }] : []);

  const flatImages: Array<{ sid: string; id: string; url: string; label: string; prompt: string; status: string }> = [];
  await Promise.all(flatShots.flatMap((sid) => {
    const shot = SHOT_CATALOG[sid];
    return flatSubjects.map(async (subj) => {
      const desc: string[] = []; let idx = 1;
      const urls: string[] = [];
      urls.push(subj.url); desc.push(`Image ${idx}: GARMENT — reproduce THIS exact item. ${PIXEL_FIDELITY}`); idx++;
      const sr = styleRefs(idx); urls.push(...sr.urls); desc.push(...sr.desc);
      const label = flatSubjects.length > 1 ? `${shot.label} · ${subj.name}` : shot.label;
      const id = flatSubjects.length > 1 ? `${sid}__${subj.id}` : sid;
      const prompt = `Professional e-commerce product packshot of a single garment. ${studioClause} ${shot.framing} Show ONLY this one garment — no other clothing items. ${PIXEL_FIDELITY}${NO_TEXT}\n\nREFERENCE IMAGES:\n${desc.join("\n")}`;
      try {
        const job = await createImageEdit(urls, prompt, config.aspectRatio, config.resolution);
        const res = await pollImageGen(job.request_id);
        flatImages.push({ sid, id, url: res.image_url || "", label, prompt, status: res.status === "failed" ? "failed" : "done" });
      } catch (e) {
        flatImages.push({ sid, id, url: "", label, prompt, status: "failed" });
        console.error(`[ecommerce_pack] flat ${id} failed:`, e);
      }
    });
  }));

  // Assemble in the user's shot order: on-model shots, then each flat shot's per-garment images.
  const images: Array<{ id: string; url: string; label: string; prompt: string; status: string }> = [];
  for (const sid of shots) {
    if (SHOT_CATALOG[sid]?.onModel) {
      if (generated[sid]) images.push(generated[sid]);
    } else {
      flatImages.filter((im) => im.sid === sid).forEach(({ id, url, label, prompt, status }) => images.push({ id, url, label, prompt, status }));
    }
  }
  const successful = images.filter((im) => im.url).length;

  return {
    result: { images, successful, total: images.length },
    needsApproval: false,
  };
};

export const ecommercePack: ToolDefinition = {
  schema: {
    showAvatar: true, avatarLabel: "Modelo (opcional)",
    showProduct: true, productLabel: "Producto (opcional)",
    showClothing: true, clothingLabel: "Prenda", clothingSublabel: "la prenda de la ficha — multi-select para un set",
    showBackground: false,
    showMoodboard: true,
    showReference: true,
    showVoice: false, showTone: false, showPlatform: false, showLanguage: false,
    showVariations: false,
    objectiveLabel: "Estilo de estudio (custom)",
    objectivePlaceholder: "Solo si elegís estilo 'Custom': describí el fondo/luz que querés…",
    showNotes: false,
  },
  stepHandlers: {
    generate_all: handleGenerate,
  },
  approvalSteps: [],
  autoRunSteps: [],
};
