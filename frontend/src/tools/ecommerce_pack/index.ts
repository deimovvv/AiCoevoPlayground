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

// Identidad y realismo — NO NEGOCIABLES en todos los on-model shots.
// La consistencia SIEMPRE tiene que ser el avatar (modelo) que el usuario eligió,
// nunca la persona que aparezca en una pose ref / base image. Reportado: "le pasé
// una pose para On Model Detail y no respetó la modelo principal".
const IDENTITY_LOCK = "IDENTITY LOCK (NON-NEGOTIABLE — top priority over everything else): the person in the output MUST be the EXACT same individual as the IDENTITY reference image. Photographically RECOGNIZABLE as that person: identical face geometry, eyes, eye color, eyebrows, nose shape, mouth/lips, jawline, cheekbones, skin tone, age, freckles/marks, hair color and hairstyle. Do NOT average, idealize, beautify, age, de-age, restyle or swap to any other face. If ANY base image, pose reference, garment photo or accessory photo shows a DIFFERENT person, that person's face, hair and identity are completely IRRELEVANT and MUST be fully discarded and replaced by the IDENTITY reference. The identity must stay perfectly consistent across every shot in the pack.";
// La cara TIENE que verse ultra realista — pedido explícito del usuario.
const FACE_REALISM = "ULTRA-PHOTOREALISTIC face and skin (CRITICAL): real human skin with visible pores, fine natural texture, subtle realistic imperfections and true-to-life subsurface scattering. Absolutely NO smoothing, NO airbrushing, NO plastic/waxy/doll-like/CGI/3D-render/AI-generated look. Eyes razor-sharp and in focus with natural catchlights and real moisture; natural eyelashes and eyebrows. Skin tones natural and even, no over-saturation. Rendered like a real high-end editorial photograph shot on a full-frame camera with an 85mm prime lens, professional studio lighting, true photographic detail.";

// ── Catálogo de poses preset ─────────────────────────────────────────
// 8 poses descritas en texto detallado — alternativa al pose transfer
// con imagen (que en Nano Banana no llega a pixel-perfect). El texto va
// al prompt del step 1 (vestir) y la pose se genera directamente, sin
// step 2. Resultado: 1 sola generación por shot, sin contaminación visual,
// pose natural y editorial. "auto" rota entre las 8 — una por shot.
export const POSE_PRESETS: Record<string, { label: string; description: string }> = {
  natural_front: {
    label: "Natural Front",
    description: "Standing in slight contrapposto, weight on left leg, right hip pushed out subtly. Right hand resting lightly on right hip pocket, left arm hanging naturally at side. Shoulders back and relaxed, chest open. Head facing camera with relaxed, confident expression. Full body in frame.",
  },
  walking: {
    label: "Walking",
    description: "Mid-step walking pose, left leg forward with knee slightly bent, right foot pushing off the ground behind. Arms swinging naturally — left arm slightly back, right arm slightly forward. Subtle forward lean of the torso, head turned slightly toward camera, candid energetic expression. Full body in frame.",
  },
  hand_in_pocket: {
    label: "Hand in Pocket",
    description: "Standing relaxed, right hand inserted in trouser pocket up to the wrist, left arm hanging naturally at the side with hand relaxed. Weight slightly on right leg, left foot a bit forward. Head turned 10-15° to the left, gaze just off-camera, soft engaged expression. Full body in frame.",
  },
  arms_crossed: {
    label: "Arms Crossed",
    description: "Standing front-facing, arms crossed at chest level — loose and natural, not tight. Weight on right leg, left foot slightly forward and turned out. Chin slightly up, direct gaze to camera, confident grounded expression. Full body in frame.",
  },
  profile_34: {
    label: "Profile 3/4",
    description: "Body angled 30-40° to the camera's right (left shoulder forward), head turned back fully toward the camera. Both arms relaxed at sides, hands open. Weight slightly forward on right leg, posture elongated, neck long. Direct camera gaze, refined editorial energy. Full body in frame.",
  },
  looking_down: {
    label: "Looking Down",
    description: "Standing centered and grounded, both hands resting in front (one hand lightly holding the other wrist OR fingers loosely interlaced). Head tilted down about 20°, gaze toward floor or hands, soft contemplative expression. Weight evenly distributed, posture tall. Full body in frame.",
  },
  back_over_shoulder: {
    label: "Back · Over Shoulder",
    description: "Body facing away from the camera, showing the back of the garment in full. Head turned back over the right shoulder, gaze toward the camera, hair flowing naturally. Both arms relaxed at sides, weight on left leg. Editorial back view with personality. Full body in frame.",
  },
  hands_in_back_pockets: {
    label: "Hands in Back Pockets",
    description: "Standing front-facing, both hands tucked into back trouser pockets, elbows pointed slightly back exposing the silhouette of the top. Weight on left leg, shoulders relaxed. Chin slightly up, soft confident gaze to camera. Full body in frame.",
  },
};

export const DEFAULT_POSE_PRESET = "auto";
const POSE_KEYS = Object.keys(POSE_PRESETS);

/** Devuelve la descripción de la pose para un shot dado.
 *  - "auto" → rota: shot 0 = natural_front, shot 1 = walking, etc.
 *  - clave específica → devuelve esa pose.
 *  - "upload" / "" / undefined → null (caller usa la pose ref imagen si la hay). */
function getPoseDescription(presetKey: string | undefined, shotIndex: number): string | null {
  if (!presetKey || presetKey === "upload" || presetKey === "") return null;
  if (presetKey === "auto") {
    return POSE_PRESETS[POSE_KEYS[shotIndex % POSE_KEYS.length]].description;
  }
  return POSE_PRESETS[presetKey]?.description || null;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

/**
 * Selecciona las fotos relevantes de una prenda según el tipo de shot que se está
 * generando. Cada prenda puede tener hasta 3 fotos (main + back + detail).
 *
 *  - shots "back" → priorizamos back + main (en ese orden) — la espalda necesita ver la espalda.
 *  - shots "detail" → priorizamos detail + main.
 *  - shots normales (front, 3/4) → main + back si entra.
 *
 * La heurística mira el `label` de cada extra (case-insensitive, contiene "back" o "detail").
 * Si no hay match, las extras se agregan por orden hasta `cap`.
 */
function selectGarmentPhotos(
  garment: { imageUrl: string; images?: Array<{ imageUrl: string; label?: string }> },
  shotType: "front" | "back" | "detail" | "any",
  cap = 2,
): string[] {
  const urls: string[] = [];
  const extras = (garment.images || []).filter((e) => e.imageUrl);
  const findByLabel = (kw: string) => extras.find((e) => (e.label || "").toLowerCase().includes(kw));
  const back = findByLabel("back") || findByLabel("espalda");
  const detail = findByLabel("detail") || findByLabel("detalle") || findByLabel("close");

  // Priorizamos según el shot.
  const main = garment.imageUrl;
  if (shotType === "back") {
    if (back?.imageUrl) urls.push(back.imageUrl);
    if (main && !urls.includes(main)) urls.push(main);
  } else if (shotType === "detail") {
    if (detail?.imageUrl) urls.push(detail.imageUrl);
    if (main && !urls.includes(main)) urls.push(main);
  } else {
    if (main) urls.push(main);
    if (back?.imageUrl && !urls.includes(back.imageUrl)) urls.push(back.imageUrl);
  }
  // Rellenamos con los extras restantes (sin duplicados) hasta cap.
  for (const e of extras) {
    if (urls.length >= cap) break;
    if (e.imageUrl && !urls.includes(e.imageUrl)) urls.push(e.imageUrl);
  }
  return urls.slice(0, cap);
}

const handleGenerate: StepHandler = async (ctx) => {
  const { activeBrand, config } = ctx;
  const cfg = config as unknown as Record<string, unknown>;

  // Separación productos vs accesorios — el usuario marca cuáles son "Solo styling"
  // (zapatillas, collar, gorra) en la UI. Esos NO generan flats propios pero SÍ
  // se usan como ref visual en on-model para que el outfit quede completo.
  const accessoryIds = (cfg.ecomAccessoryIds as string[]) || [];
  const allSelectedClothing = (activeBrand.clothing || []).filter((c) => config.selectedClothingIds.includes(c.id));
  const garments = allSelectedClothing.filter((c) => !accessoryIds.includes(c.id));
  const accessories = allSelectedClothing.filter((c) => accessoryIds.includes(c.id));
  const selectedProduct = (activeBrand.products || []).find((p) => p.id === config.selectedProductId);
  // Para el on-model: usamos TODAS las prendas (productos + accesorios) — el modelo
  // tiene que verse vestido con el outfit completo, no solo el producto principal.
  const garmentUrls = garments.map((g) => g.imageUrl).filter(Boolean);
  const accessoryUrls = accessories.map((a) => a.imageUrl).filter(Boolean);
  const allOnModelUrls = [...garmentUrls, ...accessoryUrls];
  if (selectedProduct?.imageUrl && allOnModelUrls.length === 0) allOnModelUrls.push(selectedProduct.imageUrl);
  if (allOnModelUrls.length === 0) throw new Error("Elegí al menos una prenda (o un producto) para generar la ficha.");

  // ── Nombre de descarga ───────────────────────────────────────────────
  // Pedido del usuario: cada imagen descargada se llama EXACTAMENTE como la
  // prenda de input. On-model con varias prendas → la "prenda de arriba"
  // (top). Flats → cada flat usa el nombre de su prenda. Sin shot label,
  // sin prefijo de marca: el nombre crudo de la prenda.
  const TOP_KEYWORDS = /\b(remera|t-?shirt|camiseta|camisa|top|sweater|hoodie|buzo|polera|tank|blusa|campera|jacket|saco|abrigo|chaqueta|crop|musculosa|chomba|polo|cardigan|chaleco)\b/i;
  const isTopGarment = (g: { name?: string; tags?: string[] }) =>
    TOP_KEYWORDS.test(g.name || "") || (g.tags || []).some((t) => TOP_KEYWORDS.test(t));
  // Nombre de la prenda principal para on-model: la prenda de arriba si la hay,
  // si no la primera seleccionada, si no el producto.
  const primaryGarmentName =
    (garments.find(isTopGarment)?.name)
    || garments[0]?.name
    || selectedProduct?.name
    || "";

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
  const generated: Record<string, { id: string; url: string; label: string; downloadName: string; prompt: string; status: string }> = {};

  // Per-shot pose refs (subidas por el usuario una por cada shot tildado). Da
  // dinámica — pose distinta por front/back/detail en lugar de modelo duro.
  // Mapeo shotId → dataUrl. Tiene PRIORIDAD sobre la pose global (poseUrl).
  const ecomShotPoses = ((cfg.ecomShotPoses as Record<string, string>) || {});

  // Pose preset elegido (texto descriptivo de Gemini Vision-style). Si el
  // usuario subió pose ref imagen, esa gana. Default "auto" = rota entre las 8.
  const posePreset = (cfg.ecomPosePreset as string) || DEFAULT_POSE_PRESET;

  // ── On-model shots — sequential, anchored to the first for consistency ──
  let anchorUrl: string | undefined;
  for (let i = 0; i < onModelShots.length; i++) {
    const sid = onModelShots[i];
    const shot = SHOT_CATALOG[sid];
    // Pose ref específica de este shot — si existe, gana sobre la global.
    const shotPoseUrl = ecomShotPoses[sid] || poseUrl;

    // ── 2-step approach cuando hay pose ref + es el shot inicial ──────────
    // Inversión clave (después de probar al revés y fallar):
    //   Step 1 → VESTIR primero (composición tradicional: avatar + ropa + accs).
    //            Sin pose específica — el modelo genera un outfit en cualquier
    //            pose. Lo importante: que la cara + ropa + accs queden bien.
    //   Step 2 → POSE TRANSFER puro con SOLO 2 imágenes (outfit del step 1 +
    //            pose ref). Es el patrón clásico que funciona en Nano Banana:
    //            "agarrá esta modelo + ponele esta pose". Solo 2 refs = el modelo
    //            no se confunde.
    // Trade-off: 2× costo + 2× tiempo por shot inicial. Vale la pena para que
    // la pose se respete.
    if (i === 0 && shotPoseUrl) {
      const garmentNamesAnchor = garments.map((g) => g.name).filter(Boolean).join(" + ") || selectedProduct?.name || "";
      const onModelLabelAnchor = garmentNamesAnchor ? `${shot.label} · ${garmentNamesAnchor}` : shot.label;
      try {
        // ── Step 1: VESTIR — composición tradicional, sin pose específica ─
        // Avatar + todos los garments + accessories. Estudio neutro, framing libre.
        // El modelo resuelve "mostrá esta persona vestida con esta ropa" — fácil.
        const step1Urls: string[] = [];
        const step1Desc: string[] = [];
        let idx1 = 1;
        if (avatar?.imageUrl) {
          step1Urls.push(avatar.imageUrl);
          step1Desc.push(`Image ${idx1}: IDENTITY (HIGHEST PRIORITY — the person in the output MUST be this exact individual) — same face, eyes, eye color, eyebrows, nose, mouth, jawline, skin tone, age, freckles/marks, hair color and hair style. The output face must be photographically RECOGNIZABLE as the same individual across all shots. Do NOT generalize, idealize or stylize. IGNORE only their clothing/background/pose.`);
          idx1++;
        }
        garmentUrls.forEach((u) => {
          step1Urls.push(u);
          step1Desc.push(`Image ${idx1}: GARMENT — the person WEARS this exact item. Same design, color, fabric, fit, details. IGNORE any other person/pose in this photo. ${PIXEL_FIDELITY}`);
          idx1++;
        });
        accessoryUrls.forEach((u) => {
          step1Urls.push(u);
          step1Desc.push(`Image ${idx1}: ACCESSORY — the person also wears/has this exact item integrated into the outfit (shoes on feet, scarf around neck, belt on waist, etc.). IGNORE any other person/pose in this photo. ${PIXEL_FIDELITY}`);
          idx1++;
        });
        // Style refs (look&feel + moodboard) opcionales — afinan estética.
        const sr1 = styleRefs(idx1); step1Urls.push(...sr1.urls); step1Desc.push(...sr1.desc);
        const step1Prompt = `Professional e-commerce studio fashion photograph. Full-body shot of the IDENTITY person wearing the exact GARMENT(S) and ACCESSORIES from the references. ${studioClause} Clean composition, model facing the camera. ${IDENTITY_LOCK} ${FACE_REALISM} ${PIXEL_FIDELITY}${NO_TEXT}\n\nREFERENCE IMAGES:\n${step1Desc.join("\n")}`;
        const job1 = await createImageEdit(step1Urls, step1Prompt, config.aspectRatio, config.resolution);
        const res1 = await pollImageGen(job1.request_id);
        const dressedAvatar = res1.image_url || "";
        if (!dressedAvatar) throw new Error("Step 1 (dressing) returned no image");

        // ── Step 2: POSE TRANSFER — SOLO 2 imágenes ──────────────────────
        // Patrón clásico de Nano Banana: 1 modelo + 1 pose ref → mismo modelo
        // en la nueva pose. Prompt MUY explícito separando qué viene de cada
        // imagen — el modelo tiende a "agarrar todo" de la pose ref (incluyendo
        // ropa y fondo), por eso enumeramos exhaustivamente qué tomar de cada una.
        const step2Urls = [dressedAvatar, shotPoseUrl];
        const step2Prompt = `This is a POSE TRANSFER. Two images:

IMAGE 1 — the source. It contains the person, their identity, their outfit and the studio.
IMAGE 2 — the pose reference. ONLY a body posture reference. EVERYTHING ELSE in image 2 (clothing, accessories, jewelry, tattoos, piercings, makeup, skin marks, hair, identity, background, lighting, styling) is completely IRRELEVANT and must be IGNORED.

TAKE FROM IMAGE 1 (do NOT change any of this):
- Face, hair, skin tone, head shape, age
- Skin condition (smooth/clean) — same exact skin as image 1, NO new tattoos, NO new birthmarks, NO new piercings, NO new jewelry that isn't already in image 1
- Every single garment the person is wearing (top, bottom, layers) — colors, patterns, fabric, fit, cut, length
- Every accessory that exists in image 1 (scarves, necklaces, bags, belts, hats, shoes, jewelry) — exactly as they appear
- Background and studio lighting

TAKE FROM IMAGE 2 (ONLY these, ignore everything else):
- Body posture: stance, weight distribution, leg position
- Arm position and hand placement
- Torso angle and shoulder position
- Head tilt, head rotation, gaze direction
- Overall camera framing, crop and perspective

CRITICAL — do NOT contaminate the output with anything from image 2 that is not pose-related:
- Tattoos visible on the model in image 2 → DO NOT add them to the output (the person in image 1 may have clean skin without tattoos)
- Jewelry, rings, bracelets, watches, earrings, necklaces shown on the model in image 2 → DO NOT add them
- Clothing of the model in image 2 (vest, scarf, sandals, etc) → DO NOT add it
- Makeup, lipstick, eye makeup of the model in image 2 → DO NOT apply
- Piercings, body marks, scars of the model in image 2 → DO NOT add
- Hair style/color of image 2 → DO NOT change image 1's hair

The output person's skin, accessories, jewelry, tattoos, piercings, and clothing must match IMAGE 1 ONLY. If image 1 has no tattoos, the output has no tattoos. If image 1 has no jewelry, the output has no jewelry.

Output: the person from image 1, EXACTLY as they appear in image 1 (same skin, same jewelry, same clothing, same accessories, same face), re-posed to match the body geometry of image 2. The face must stay perfectly recognizable as the person in image 1 — do NOT let image 2's face leak in. ${FACE_REALISM} ${PIXEL_FIDELITY}${NO_TEXT}`;
        const job2 = await createImageEdit(step2Urls, step2Prompt, config.aspectRatio, config.resolution);
        const res2 = await pollImageGen(job2.request_id);
        const url2 = res2.image_url || "";
        if (url2) anchorUrl = url2;
        generated[sid] = { id: sid, url: url2, label: onModelLabelAnchor, downloadName: primaryGarmentName, prompt: step2Prompt, status: res2.status === "failed" ? "failed" : "done" };
      } catch (e) {
        generated[sid] = { id: sid, url: "", label: onModelLabelAnchor, downloadName: primaryGarmentName, prompt: "", status: "failed" };
        console.error(`[ecommerce_pack] ${sid} (2-step) failed:`, e);
      }
      continue; // saltea el flow 1-step
    }

    const urls: string[] = []; const desc: string[] = []; let idx = 1;
    if (i === 0 || !anchorUrl) {
      // Sin pose ref — flow original de composición (todas las refs en una sola call).
      // IDENTITY va PRIMERO con instrucciones explícitas de fidelidad — Nano Banana
      // tiende a "promediar" caras cuando el avatar es una ref más entre muchas.
      if (avatar?.imageUrl) { urls.push(avatar.imageUrl); desc.push(`Image ${idx}: IDENTITY (HIGHEST PRIORITY — the person in the output MUST be this exact person) — use this exact face, eyes, eye color, eyebrows, nose, mouth, jawline, skin tone, age, freckles/marks, hair color, hair style, and body proportions. The output face must be photographically RECOGNIZABLE as the same individual. Do NOT generalize, idealize, beautify, age, de-age or stylize the face. IGNORE only their clothing, background and pose.`); idx++; }
      garmentUrls.forEach((u) => { urls.push(u); desc.push(`Image ${idx}: GARMENT (hero product) — the model WEARS this exact item. ${PIXEL_FIDELITY}`); idx++; });
      accessoryUrls.forEach((u) => { urls.push(u); desc.push(`Image ${idx}: STYLING ACCESSORY — the model also wears/has this exact item as part of the complete outfit. ${PIXEL_FIDELITY}`); idx++; });
    } else if (ecomShotPoses[sid]) {
      // Shot 2+ CON pose ref específica: pose ref como base + anchor de shot 1
      // + avatar ORIGINAL como segunda fuente de identidad (doble anclaje de cara).
      urls.push(ecomShotPoses[sid]);
      desc.push(`Image ${idx}: BASE IMAGE (edit this) — start from this exact image and KEEP pixel-perfect ONLY its geometry: body position, stance, arm/hand placement, head tilt, gaze direction, camera framing, crop and perspective. The PERSON shown in this base image is a stand-in: their face, head, hair, skin and identity are IRRELEVANT and MUST be fully replaced by the FACE REPLACEMENT (IDENTITY) reference below. The BACKGROUND / environment / room / floor / wall / lighting color of this base image are ALSO IRRELEVANT and MUST be fully discarded and replaced by the studio backdrop described in the prompt — do NOT keep the pose reference's background. REPLACE the clothing, the face/head AND the background as specified below.`);
      idx++;
      urls.push(anchorUrl);
      desc.push(`Image ${idx}: WARDROBE + STUDIO SOURCE — the clothing, accessories, studio look and lighting must match THIS image exactly. Apply them to the person in the BASE IMAGE.`);
      idx++;
      // Avatar como fuente de identidad — DEBE ganar sobre la cara de la pose ref.
      // Sin esto, Nano Banana conserva la cara de la persona en la pose ref.
      if (avatar?.imageUrl) {
        urls.push(avatar.imageUrl);
        desc.push(`Image ${idx}: FACE REPLACEMENT (IDENTITY) — ABSOLUTE HIGHEST PRIORITY. The output face/head/hair MUST be this exact person, overriding whatever face is in the BASE IMAGE. ${IDENTITY_LOCK} ${FACE_REALISM}`);
        idx++;
      }
      garmentUrls.forEach((u) => { urls.push(u); desc.push(`Image ${idx}: GARMENT REFERENCE — same exact item. Pixel-perfect. ${PIXEL_FIDELITY}`); idx++; });
      accessoryUrls.forEach((u) => { urls.push(u); desc.push(`Image ${idx}: ACCESSORY REFERENCE — same exact complement. ${PIXEL_FIDELITY}`); idx++; });
    } else {
      // Shot 2+ SIN pose ref: anchor del shot 1 + avatar ORIGINAL como refuerzo
      // de identidad (mismo problema de drift de cara).
      urls.push(anchorUrl); desc.push(`Image ${idx}: ANCHOR — keep the SAME garment, SAME accessories, SAME studio and lighting as this frame. Change ONLY the camera angle / pose as described.`); idx++;
      if (avatar?.imageUrl) {
        urls.push(avatar.imageUrl);
        desc.push(`Image ${idx}: IDENTITY ANCHOR (HIGHEST PRIORITY for face/hair) — the output face must be photographically RECOGNIZABLE as THIS exact person: same eyes, eye color, eyebrows, nose, mouth, jawline, skin tone, age, freckles/marks, hair color and hair style. Do NOT generalize or stylize between shots.`);
        idx++;
      }
      garmentUrls.forEach((u) => { urls.push(u); desc.push(`Image ${idx}: GARMENT (hero product) — same exact item. ${PIXEL_FIDELITY}`); idx++; });
      accessoryUrls.forEach((u) => { urls.push(u); desc.push(`Image ${idx}: STYLING ACCESSORY — same exact complement, identical to anchor. ${PIXEL_FIDELITY}`); idx++; });
    }
    const sr = styleRefs(idx); urls.push(...sr.urls); desc.push(...sr.desc);
    // En pose-anchor mode las instrucciones de wardrobe ya viven en el cierre del
    // prompt (poseOverride) de forma mucho más estructurada. Solo dejamos el
    // override para el caso sin pose-anchor donde el avatar puede tener ropa propia.
    const wardrobe = (!shotPoseUrl && avatar?.imageUrl)
      ? "WARDROBE OVERRIDE: the model must be RE-DRESSED in the GARMENT reference; completely ignore any clothing in the identity photo. "
      : "";
    // Pose override final — si hay pose ref, repetimos la instrucción al final del
    // prompt para que Nano Banana le dé prioridad. Sin esto, el modelo a veces ignora
    // la pose ref enterrada en medio de los REFERENCE IMAGES y usa una pose default.
    // Reportado: "le pasé una pose y no me la respetó".
    // Cierre del prompt — dos paradigmas distintos según haya pose-anchor o no.
    // Con pose-anchor: el modelo está EDITANDO la BASE IMAGE, no componiendo.
    // Sin pose-anchor: composición tradicional con refs.
    const poseOverride = shotPoseUrl
      ? `

EDIT INSTRUCTIONS (this is an image edit, not a composition):
- The output MUST be the BASE IMAGE with only these changes:
  1) The clothing of the person is REPLACED by the WARDROBE REPLACEMENT garment(s).
  2) The face/head/hair is REPLACED by the FACE REPLACEMENT (IDENTITY) reference — this is MANDATORY. Keep ONLY the head position, tilt and gaze from the BASE IMAGE; everything about WHO the face is comes from the FACE REPLACEMENT (IDENTITY) image, NOT from the base image. The base image person is a stand-in and their face must NOT survive into the output.
  3) Any specified ACCESSORY REPLACEMENT is added/replaced in its natural body location.
  4) The BACKGROUND / setting is REPLACED by the studio backdrop described at the top of this prompt (${studioClause.trim()}). Completely DISCARD the pose reference's environment — its room, floor, wall, props, colors and ambient lighting tint must NOT appear in the output. The final background is a clean studio backdrop, never the location from the pose reference.
- ${IDENTITY_LOCK}
- ${FACE_REALISM}
- PRESERVE from the BASE IMAGE ONLY the geometry: pose, stance, body position, framing, crop, perspective. Do NOT re-pose, do NOT re-frame, do NOT change the camera angle. Do NOT preserve its background, scene or color cast.
- The garment/accessory reference photos contain models in OTHER poses and OTHER backgrounds — those models, faces, poses and backgrounds are IRRELEVANT. They exist ONLY to define what the clothing/accessory looks like.
- Treat this like a Photoshop edit on a model cutout: same body and same pose, but re-dressed, re-faced to the IDENTITY person, and placed on the clean studio backdrop.`
      : "";
    // Si NO hay pose ref imagen, inyectamos un preset textual de pose (rota
    // entre 8 si "auto", o usa la elegida por el user). Eso evita que la
    // modelo quede dura/estática y le da variedad editorial a la galería.
    const poseDesc = !shotPoseUrl ? getPoseDescription(posePreset, i) : null;
    const presetPoseClause = poseDesc ? ` POSE: ${poseDesc}` : "";
    const identityClause = avatar?.imageUrl ? `${IDENTITY_LOCK} ` : "";
    const prompt = `Professional e-commerce studio fashion photograph. ${studioClause} ${shot.framing}${presetPoseClause} ${wardrobe}${identityClause}${FACE_REALISM} ${PIXEL_FIDELITY}${NO_TEXT}${poseOverride}\n\nREFERENCE IMAGES:\n${desc.join("\n")}`;
    try {
      const job = urls.length ? await createImageEdit(urls, prompt, config.aspectRatio, config.resolution) : await createTextToImage(prompt, config.aspectRatio, config.resolution);
      const res = await pollImageGen(job.request_id);
      const url = res.image_url || "";
      if (i === 0 && url) anchorUrl = url;
      // Label con nombre(s) de prenda(s) — el usuario quiere que el filename
      // descargado preserve el nombre del archivo original que cargó (ej. si
      // subiste "remera-roja.jpg", el output debería llamarse así, no "frente.png").
      // El name de cada garment viene del filename original via deriveAssetName.
      const garmentNames = garments.map((g) => g.name).filter(Boolean).join(" + ") || selectedProduct?.name || "";
      const onModelLabel = garmentNames ? `${shot.label} · ${garmentNames}` : shot.label;
      generated[sid] = { id: sid, url, label: onModelLabel, downloadName: primaryGarmentName, prompt, status: res.status === "failed" ? "failed" : "done" };
    } catch (e) {
      const garmentNames = garments.map((g) => g.name).filter(Boolean).join(" + ") || selectedProduct?.name || "";
      const onModelLabel = garmentNames ? `${shot.label} · ${garmentNames}` : shot.label;
      generated[sid] = { id: sid, url: "", label: onModelLabel, downloadName: primaryGarmentName, prompt, status: "failed" };
      console.error(`[ecommerce_pack] ${sid} failed:`, e);
    }
  }

  // ── Flat product-only shots — ONE per garment. Cada garment puede tener hasta 3 fotos
  // (main + back + detail); seleccionamos las más relevantes según el shot type para que
  // el modelo entienda mejor el producto. Ej: en flat_back priorizamos la foto de back si existe.
  const flatSubjects = garments.length
    ? garments.map((g) => ({ id: g.id, name: g.name, url: g.imageUrl, source: g }))
        .filter((s) => s.url)
    : (selectedProduct?.imageUrl
        ? [{ id: selectedProduct.id, name: selectedProduct.name, url: selectedProduct.imageUrl, source: selectedProduct }]
        : []);

  // Mapeo de shot id → tipo lógico que entiende selectGarmentPhotos.
  const flatShotType = (sid: string): "front" | "back" | "detail" | "any" =>
    sid.includes("back") ? "back" :
    sid.includes("detail") ? "detail" :
    sid.includes("front") ? "front" : "any";

  const flatImages: Array<{ sid: string; id: string; url: string; label: string; downloadName: string; prompt: string; status: string }> = [];
  await Promise.all(flatShots.flatMap((sid) => {
    const shot = SHOT_CATALOG[sid];
    const shotType = flatShotType(sid);
    return flatSubjects.map(async (subj) => {
      const desc: string[] = []; let idx = 1;
      const urls: string[] = [];
      // Multi-foto smart: para flat_back agarrá la foto de espalda + main; para detail, detail + main.
      // Para front/any, solo la principal (no necesita más contexto).
      const photos = subj.source && "images" in subj.source
        ? selectGarmentPhotos(subj.source as { imageUrl: string; images?: Array<{ imageUrl: string; label?: string }> }, shotType, 2)
        : [subj.url];
      photos.forEach((u, i) => {
        const role = i === 0
          ? `GARMENT (primary view)`
          : `GARMENT (additional view — same exact item, different angle for context)`;
        urls.push(u);
        desc.push(`Image ${idx}: ${role} — reproduce THIS exact item. ${PIXEL_FIDELITY}`);
        idx++;
      });
      const sr = styleRefs(idx); urls.push(...sr.urls); desc.push(...sr.desc);
      // Siempre incluir nombre de la prenda (no solo cuando hay >1) para que
      // el filename descargado preserve el nombre original del archivo cargado.
      const label = subj.name ? `${shot.label} · ${subj.name}` : shot.label;
      // Flat = una prenda específica → su nombre crudo es el nombre de descarga.
      const downloadName = subj.name || primaryGarmentName;
      const id = flatSubjects.length > 1 ? `${sid}__${subj.id}` : sid;
      const prompt = `Professional e-commerce product packshot of a single garment. ${studioClause} ${shot.framing} Show ONLY this one garment — no other clothing items. ${PIXEL_FIDELITY}${NO_TEXT}\n\nREFERENCE IMAGES:\n${desc.join("\n")}`;
      try {
        const job = await createImageEdit(urls, prompt, config.aspectRatio, config.resolution);
        const res = await pollImageGen(job.request_id);
        flatImages.push({ sid, id, url: res.image_url || "", label, downloadName, prompt, status: res.status === "failed" ? "failed" : "done" });
      } catch (e) {
        flatImages.push({ sid, id, url: "", label, downloadName, prompt, status: "failed" });
        console.error(`[ecommerce_pack] flat ${id} failed:`, e);
      }
    });
  }));

  // Assemble in the user's shot order: on-model shots, then each flat shot's per-garment images.
  const images: Array<{ id: string; url: string; label: string; downloadName: string; prompt: string; status: string }> = [];
  for (const sid of shots) {
    if (SHOT_CATALOG[sid]?.onModel) {
      if (generated[sid]) images.push(generated[sid]);
    } else {
      flatImages.filter((im) => im.sid === sid).forEach(({ id, url, label, downloadName, prompt, status }) => images.push({ id, url, label, downloadName, prompt, status }));
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
    showClothing: true, clothingLabel: "Prendas", clothingSublabel: "productos a vender — generan flats individuales",
    showBackground: false,
    // Moodboard sacado de Ecommerce Pack — ya existe "Referencia Look & Feel"
    // (showReference) que cumple la misma función. Tener ambos confundía.
    showMoodboard: false,
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
