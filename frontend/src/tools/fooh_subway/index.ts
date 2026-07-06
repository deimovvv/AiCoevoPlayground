/**
 * FOOH Subway Ads — Tool Definition
 * ──────────────────────────────────
 * Fake-Out-Of-Home: tu ad puesto en un billboard de una estación de metro, foto-real.
 * Ref: Pletor "FOOH subway ads". Misma familia que Screen Mockup — técnica de panel verde.
 *
 * Pipeline (3 pasos visibles):
 *   1. poster       → genera el ad (de tu producto + vibe del brief) · o traés el tuyo (upload).
 *   2. scene        → estación de metro con un BILLBOARD en VERDE croma (text-to-image).
 *   3. generate_all → encaja el poster en el billboard verde → mockup FOOH final (image-edit).
 *
 * El verde croma le da al modelo un target plano donde encajar el poster → billboard nítido,
 * en vez de pedirle inventar estación + encajar ad de un solo tiro (flaky).
 */

import type { ToolDefinition, StepHandler } from "../types";
import { createImageEdit, createTextToImage, pollImageGen } from "../../lib/api";

const NO_TEXT = " Photorealistic photograph. No added captions, no watermark, no text overlay beyond the ad itself.";

const fileToDataUrl = (f: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(f);
  });

// Paso 1 — poster del ad a partir del producto. Exportado para el editor de prompts por paso.
export const posterPrompt = (vibe: string, productName: string) =>
  `Design a bold, modern out-of-home advertising poster featuring ${productName || "the product shown in image 1"}. ` +
  `Campaign vibe: ${vibe || "premium, clean, high-impact"}. The product is the hero, striking commercial layout, ` +
  `strong brand aesthetic, portrait poster format suitable for a subway billboard. Photorealistic product, ` +
  `confident negative space, magazine-grade art direction.${NO_TEXT}`;

// Paso 2 — estación de metro con el billboard en verde croma limpio.
export const subwayScenePrompt = (vibe: string) =>
  `Photorealistic wide photograph of a modern subway / metro station. ${vibe || "clean contemporary station, natural crowd"}. ` +
  `On a wall there is a LARGE advertising billboard / backlit light box, and its panel is filled with a SOLID BRIGHT ` +
  `CHROMA-KEY GREEN (#00d000): completely flat, evenly lit, unobstructed and with NO content — a clean green panel ready ` +
  `for compositing. Everything else is fully photorealistic: commuters, tiled walls, depth, reflections and natural station ` +
  `lighting. The green billboard is clearly visible and prominent in frame.${NO_TEXT}`;

// Paso 3 — encajar el poster en el billboard verde.
export const foohCompositePrompt =
  `Image 1 is a photograph of a subway station with a solid green chroma-key billboard panel. Image 2 is an advertising poster. ` +
  `Replace ONLY the green billboard panel in image 1 with the EXACT poster from image 2. Fit the poster precisely to the ` +
  `billboard: correct perspective, scale and edges. Keep the poster faithful (same layout, colors, product and text). Add subtle, ` +
  `realistic station lighting, backlit glow and reflections onto the poster surface so it looks genuinely printed/backlit in place. ` +
  `Do NOT change anything else — commuters, architecture and lighting stay identical. Photorealistic out-of-home advertising mockup.${NO_TEXT}`;

type Img = { id: string; url: string; label: string; prompt: string; status: string };

const validImages = (arr: unknown): File[] =>
  ((arr as File[]) || []).filter((f) => f && typeof f.type === "string" && f.type.startsWith("image/"));

// ── Paso 1: poster ─────────────────────────────────────────
const handlePoster: StepHandler = async (ctx) => {
  const { config, activeBrand } = ctx;
  const cfg = config as unknown as Record<string, unknown>;
  const vibe = (config.objective || "").trim();
  const ar = "4:5"; // formato poster/billboard (portrait), independiente del frame de la escena
  const res = config.resolution || "2K";

  // Camino "traé tu poster": si el usuario subió su ad, lo usamos tal cual (passthrough).
  const uploaded = validImages(cfg.referenceImages);
  if (uploaded.length > 0) {
    const url = await fileToDataUrl(uploaded[0]);
    return { result: { images: [{ id: "poster_0", url, label: "Tu ad", prompt: "(poster provisto por el usuario)", status: "done" }], source: "upload" }, needsApproval: false };
  }

  // Generar el poster desde el producto del Brand Kit (+ logo si hay).
  const product = (activeBrand.products || []).find((p) => p.id === config.selectedProductId);
  if (!product?.imageUrl) throw new Error("Elegí un producto del Brand Kit, o subí tu propio ad/poster como referencia.");

  const refs: string[] = [product.imageUrl];
  const brand = activeBrand as unknown as { logos?: Array<{ imageUrl?: string }>; logo?: string };
  const logoUrl = brand.logos?.find((l) => l.imageUrl)?.imageUrl || brand.logo;
  if (logoUrl) refs.push(logoUrl);

  const override = (cfg.stepPrompts as Record<string, string> | undefined)?.poster?.trim();
  const prompt = override || posterPrompt(vibe, product.name || "");
  try {
    const job = await createImageEdit(refs, prompt, ar, res);
    const r = await pollImageGen(job.request_id);
    if (!r.image_url) throw new Error("el poster no devolvió imagen");
    return { result: { images: [{ id: "poster_0", url: r.image_url, label: "Poster", prompt, status: "done" }], source: "generated" }, needsApproval: false };
  } catch (e) {
    console.error("[fooh_subway/poster] failed:", e);
    return { result: { images: [{ id: "poster_0", url: "", label: "Poster", prompt, status: "failed" }], source: "generated" }, needsApproval: false };
  }
};

// ── Paso 2: escena de metro con billboard verde ────────────
const handleScene: StepHandler = async (ctx) => {
  const { config } = ctx;
  const cfg = config as unknown as Record<string, unknown>;
  const vibe = (config.objective || "").trim();
  const ar = config.aspectRatio || "16:9";
  const res = config.resolution || "2K";
  const variations = Math.max(1, Math.min(4, config.numVariations || 1));

  const override = (cfg.stepPrompts as Record<string, string> | undefined)?.scene?.trim();
  const prompt = override || subwayScenePrompt(vibe);

  const images: Img[] = [];
  for (let i = 0; i < variations; i++) {
    try {
      const job = await createTextToImage(prompt, ar, res);
      const r = await pollImageGen(job.request_id);
      images.push({ id: `scene_${i}`, url: r.image_url || "", label: `Estación #${i + 1}`, prompt, status: r.image_url ? "done" : "failed" });
    } catch (e) {
      images.push({ id: `scene_${i}`, url: "", label: `Estación #${i + 1}`, prompt, status: "failed" });
      console.error(`[fooh_subway/scene] #${i + 1} failed:`, e);
    }
  }
  return { result: { images, source: "generated", successful: images.filter((im) => im.url).length, total: images.length }, needsApproval: false };
};

// ── Paso 3: componer el poster en el billboard ─────────────
const handleComposite: StepHandler = async (ctx) => {
  const { config } = ctx;
  const cfg = config as unknown as Record<string, unknown>;
  const ar = config.aspectRatio || "16:9";
  const res = config.resolution || "2K";

  const posterResult = ctx.getStepResult("poster") as { images?: Img[] } | undefined;
  const posterUrl = (posterResult?.images || []).find((p) => p.url)?.url;
  if (!posterUrl) throw new Error("No hay poster para componer (el paso 1 no generó ninguno).");

  const sceneResult = ctx.getStepResult("scene") as { images?: Img[] } | undefined;
  const scenes = (sceneResult?.images || []).filter((s) => s.url);
  if (scenes.length === 0) throw new Error("No hay escena de metro para componer (el paso 2 no generó ninguna).");

  const compPrompt = (cfg.stepPrompts as Record<string, string> | undefined)?.composite?.trim() || foohCompositePrompt;

  const images: Img[] = [];
  for (let i = 0; i < scenes.length; i++) {
    try {
      const job = await createImageEdit([scenes[i].url, posterUrl], compPrompt, ar, res);
      const r = await pollImageGen(job.request_id);
      images.push({ id: `mockup_${i}`, url: r.image_url || "", label: `FOOH #${i + 1}`, prompt: `${scenes[i].prompt}\n\n— compositing —\n${compPrompt}`, status: r.image_url ? "done" : "failed" });
    } catch (e) {
      images.push({ id: `mockup_${i}`, url: "", label: `FOOH #${i + 1}`, prompt: compPrompt, status: "failed" });
      console.error(`[fooh_subway/composite] #${i + 1} failed:`, e);
    }
  }
  return { result: { images, successful: images.filter((im) => im.url).length, total: images.length }, needsApproval: false };
};

export const foohSubway: ToolDefinition = {
  schema: {
    showAvatar: false,
    showProduct: true,
    productLabel: "Producto a anunciar",
    productSublabel: "El producto del Brand Kit que protagoniza el ad (si no subís tu propio poster)",
    showClothing: false,
    showBackground: false,
    showMoodboard: false,
    showReference: true,
    showVoice: false,
    showTone: false,
    showPlatform: false,
    showLanguage: false,
    showVariations: true,
    objectiveLabel: "Vibe del ad + estación",
    objectivePlaceholder: 'Ej: "lanzamiento de sneakers, estación de metro de Tokyo de noche, neón" · "perfume premium, metro de París, elegante y minimalista".',
    showNotes: false,
  },
  stepHandlers: {
    poster: handlePoster,
    scene: handleScene,
    generate_all: handleComposite,
  },
  approvalSteps: [],
  // scene corre solo tras poster, y composite tras scene — el usuario ve los 3 pasos pasar.
  autoRunSteps: ["scene", "generate_all"],
};
