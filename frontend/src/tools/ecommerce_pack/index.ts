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
  model_american: { label: "On-model · Americano", onModel: true, framing: "AMERICAN / medium shot: the bottom edge of the frame CUTS THE BODY at the knee or mid-thigh — the feet, shoes and lower legs are OUT of frame. Framed from roughly mid-thigh up, the model facing the camera, the garment's upper and mid section shown clearly. This is a medium catalog crop — NOT a full-body shot (do not show the whole body or the feet) and NOT a tight close-up." },
  model_back:   { label: "On-model · Espalda",  onModel: true,  framing: "BACK view: the model faces away from the camera, clearly showing the back of the garment." },
  model_detail: { label: "On-model · Detalle prenda", onModel: true, framing: "Tight CLOSE-UP on the garment as worn (fabric, texture, print, stitching, logo) — crop to the chest/torso area, no face needed." },
  model_closeup: { label: "On-model · Primer plano", onModel: true, framing: "PORTRAIT close-up showing BOTH the model's FACE and the garment together: head-and-chest crop (roughly from mid-chest up), the face clearly visible, sharp and in focus, looking toward the camera, alongside the top of the garment — neckline, collar, shoulders and the fabric at the chest — plus any worn accessories (earrings, necklace, scarf). This is NOT a face-only beauty headshot: a meaningful part of the garment MUST be in frame." },
  model_detail_lower: { label: "On-model · Detalle inferior", onModel: true, framing: "LOWER-BODY close-up: framed from roughly the waist down to mid-calf or the shoes, showing the bottom garment (trousers, skirt, shorts) — its fabric, fit, drape, hem and length — plus footwear if it is part of the look. No face in frame." },
  flat_front:   { label: "Flat · Frente",       onModel: false, framing: "Product-only PACKSHOT: the garment presented flat/ghost-mannequin facing FRONT, centered. NO person, NO model, NO body — only the garment." },
  flat_back:    { label: "Flat · Espalda",      onModel: false, framing: "Product-only PACKSHOT of the garment's BACK, centered. NO person, NO model — only the garment." },
  flat_detail:  { label: "Flat · Detalle",      onModel: false, framing: "Product-only MACRO close-up of the garment's fabric, stitching, label or print. NO person — only the garment." },
};

export const DEFAULT_SHOTS = ["model_front", "model_back", "model_detail", "flat_front"];

// Studio backdrop presets. "custom" falls back to the Setting Description (objective).
export const STUDIO_STYLES: Record<string, { label: string; clause: string }> = {
  white:     { label: "Blanco seamless", clause: "Clean, seamless, pure white cyclorama studio background with a very subtle, soft grey gradient on the floor. Bright, diffused, soft high-key studio lighting like natural overcast daylight. Bright and airy, high-end commercial look. Keep the backdrop WALL clean — no harsh projected shadows on the wall (the soft floor shadow below is intended)." },
  grey:      { label: "Gris estudio",    clause: "Light grey seamless studio backdrop, soft directional studio lighting with a subtle gradient, premium catalog look." },
  beige:     { label: "Beige cálido",    clause: "Warm beige / cream studio backdrop, soft natural-feeling light, refined editorial e-commerce look." },
  editorial: { label: "Editorial",       clause: "Editorial studio on a neutral backdrop, soft directional key light with gentle controlled shadows, fashion-magazine treatment." },
  color:     { label: "Color sólido",    clause: "" },  // el handler arma la clause con ecomStudioColor
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
// La textura de la tela también tiene que verse real (pedido del usuario).
const FABRIC_REALISM = "ULTRA-REALISTIC fabric and garment texture: render the true weave, knit, grain and material of each garment — visible threads, stitching, seams, hems, ribbing, wrinkles and natural folds where the cloth drapes and creases on the body. Cotton looks like cotton, denim like denim, knit like knit, leather like leather. Accurate sheen/matte response to the studio light, realistic micro-shadows in the folds. NO flat, painted, plastic or over-smoothed fabric; NO invented patterns. Crisp, high-resolution photographic detail across the whole garment.";
// Spec de cámara/luz — fija una captura fotográfica concreta (no "render"). f/8 da
// nitidez de borde a borde para e-commerce; 5500K neutro + setup de 2 luces evita el
// look plano/CGI. Aportado por el usuario a partir de un prompt de referencia que funcionaba.
const CAMERA_LIGHTING = "Captured as a real photograph on a full-frame camera (Sony A7-class) with an 85mm prime lens at f/8 for edge-to-edge sharpness. Professional studio lighting: soft diffused key light from the front-right at 45°, a large fill light on the opposite side for even commercial illumination, neutral 5500K white balance. Clean editorial e-commerce lighting.";
// Negative prompt — el mayor lever de realismo en Nano Banana. Empuja fuera el look
// plástico/ilustración/AI y el over-retoque que delata la imagen generada.
const REALISM_NEGATIVES = "NEGATIVE (must NOT appear): illustration, 3D render, CGI, AI-generated look, plastic or waxy finish, over-retouched airbrushed perfection, oversaturated colors, harsh shadows projected on the backdrop wall.";
// Sombra de contacto sutil — aterriza al sujeto (modelo/producto) para que no quede
// flotando/recortado. Es la sombra de PISO, distinta de la proyectada en la pared
// (que sí evitamos). Pedido del usuario: las fotos e-commerce siempre deben tenerla.
const GROUNDING_SHADOW = "GROUND THE SUBJECT with a soft floor shadow: a clearly visible but subtle, faint, diffused contact shadow directly beneath the subject (the model's feet, or the product's base) — like a soft grey gradient on the floor, avoiding harsh lines — so the subject is grounded and NOT floating or cut-out. This floor shadow is intended even with bright high-key lighting; do not wash it out. Floor shadow only; keep the backdrop wall clean.";
// Orientación de prenda — Nano Banana a veces da vuelta la remera (frente↔espalda).
// Lock explícito: la prenda se usa como en la foto de referencia.
const GARMENT_ORIENTATION = "Wear every garment in its CORRECT orientation, matching the garment reference exactly — prints, logos, buttons, zippers, pockets and necklines where they belong. In FRONT and 3/4 shots the front of the garment faces the camera; never reverse, mirror or show a garment's back unless this is explicitly a BACK shot.";

// Prompt del botón "Mejorar texturas + 4K" — pasa la imagen YA generada de vuelta
// por Nano Banana en modo edit a 4K. Mejora SOLO la nitidez/textura de piel y tela;
// NO recompone, NO cambia identidad, ropa, pose, fondo ni encuadre.
export const ENHANCE_TEXTURE_PROMPT = `Enhance and upscale THIS photograph to crisp 4K production quality. This is a DETAIL/TEXTURE ENHANCEMENT PASS — do NOT change the composition, identity, face, garment, pose, framing or background in any way. Keep the image pixel-identical in layout; only refine micro-detail and resolution.
${FACE_REALISM}
${FABRIC_REALISM}
Add true photographic sharpness and fine detail to skin and fabric, remove any softness, blur, plastic smoothing or AI-render look. The result must look like the same photo captured by a higher-end camera at higher resolution — same scene, more real, more detailed.${NO_TEXT}`;

// ── Catálogo de poses preset ─────────────────────────────────────────
// 8 poses descritas en texto detallado — alternativa al pose transfer
// con imagen (que en Nano Banana no llega a pixel-perfect). El texto va
// al prompt del step 1 (vestir) y la pose se genera directamente, sin
// step 2. Resultado: 1 sola generación por shot, sin contaminación visual,
// pose natural y editorial. "auto" rota entre las 8 — una por shot.
export const POSE_PRESETS: Record<string, { label: string; description: string }> = {
  natural_front: {
    label: "Natural Front",
    description: "Standing in slight contrapposto, weight on left leg, right hip pushed out subtly. Right hand resting lightly on right hip pocket, left arm hanging naturally at side. Shoulders back and relaxed, chest open. Head facing camera with relaxed, confident expression.",
  },
  walking: {
    label: "Walking",
    description: "Mid-step walking pose, left leg forward with knee slightly bent, right foot pushing off the ground behind. Arms swinging naturally — left arm slightly back, right arm slightly forward. Subtle forward lean of the torso, head turned slightly toward camera, candid energetic expression.",
  },
  hand_in_pocket: {
    label: "Hand in Pocket",
    description: "Standing relaxed, right hand inserted in trouser pocket up to the wrist, left arm hanging naturally at the side with hand relaxed. Weight slightly on right leg, left foot a bit forward. Head turned 10-15° to the left, gaze just off-camera, soft engaged expression.",
  },
  arms_crossed: {
    label: "Arms Crossed",
    description: "Standing front-facing, arms crossed at chest level — loose and natural, not tight. Weight on right leg, left foot slightly forward and turned out. Chin slightly up, direct gaze to camera, confident grounded expression.",
  },
  profile_34: {
    label: "Profile 3/4",
    description: "Body angled 30-40° to the camera's right (left shoulder forward), head turned back fully toward the camera. Both arms relaxed at sides, hands open. Weight slightly forward on right leg, posture elongated, neck long. Direct camera gaze, refined editorial energy.",
  },
  looking_down: {
    label: "Looking Down",
    description: "Standing centered and grounded, both hands resting in front (one hand lightly holding the other wrist OR fingers loosely interlaced). Head tilted down about 20°, gaze toward floor or hands, soft contemplative expression. Weight evenly distributed, posture tall.",
  },
  back_over_shoulder: {
    label: "Back · Over Shoulder",
    description: "Body facing away from the camera, showing the back of the garment in full. Head turned back over the right shoulder, gaze toward the camera, hair flowing naturally. Both arms relaxed at sides, weight on left leg. Editorial back view with personality.",
  },
  hands_in_back_pockets: {
    label: "Hands in Back Pockets",
    description: "Standing front-facing, both hands tucked into back trouser pockets, elbows pointed slightly back exposing the silhouette of the top. Weight on left leg, shoulders relaxed. Chin slightly up, soft confident gaze to camera.",
  },
  back_hand_to_neck: {
    label: "Back · Hand to Neck",
    description: "Body facing away from the camera, showing the full back of the garment. Head turned back over the LEFT shoulder toward the camera, right hand raised to lightly touch the back of the neck/hairline, left arm relaxed at side. The face stays clearly visible in three-quarter back view. Editorial, elongated posture.",
  },
  back_walk_away: {
    label: "Back · Walking Away",
    description: "Walking away from the camera mid-step, showing the back of the garment in natural motion. Head turned back over the right shoulder with a relaxed glance toward the camera so the face stays visible. Arms swinging naturally, weight shifting forward.",
  },
};

export const DEFAULT_POSE_PRESET = "auto";
const POSE_KEYS = Object.keys(POSE_PRESETS);

// Pools de poses por tipo de plano — la rotación "auto" elige DENTRO del pool
// correcto para el encuadre, no una pose al azar. Garantiza coherencia: un plano
// de espalda nunca recibe una pose frontal, los back shots mantienen la cara
// visible (over-shoulder), y el americano prioriza poses de manos/torso que leen
// bien en un crop medio. Si un shot no está mapeado, cae al rol completo.
const POSE_POOLS: Record<string, string[]> = {
  model_front:    ["natural_front", "hand_in_pocket", "arms_crossed", "hands_in_back_pockets", "looking_down", "walking"],
  model_34:       ["profile_34", "natural_front", "hand_in_pocket", "arms_crossed"],
  model_american: ["hand_in_pocket", "arms_crossed", "hands_in_back_pockets", "natural_front", "looking_down"],
  model_back:     ["back_over_shoulder", "back_hand_to_neck", "back_walk_away"],
};

// Close-ups: NO reciben pose preset. Las poses están escritas "full body in frame",
// que contradice un crop cerrado. Para estos planos manda el encuadre (la framing
// clause ya describe el crop y, en primer plano, la cara mirando a cámara).
const CLOSEUP_SHOTS = new Set(["model_detail", "model_closeup", "model_detail_lower"]);

/** Devuelve la descripción de la pose para una instancia de shot.
 *  - close-up → null (el encuadre manda; las poses full-body contradicen el crop).
 *  - "auto" → rota DENTRO del pool del encuadre por la variante (nth): variante #1
 *    = primera del pool, #2 = segunda, etc. → coherente con el plano y distinta por variante.
 *  - clave específica → esa pose fija (ignora el pool).
 *  - "upload" / "" / undefined → null (caller usa la pose ref imagen si la hay). */
function getPoseDescription(presetKey: string | undefined, shotId: string, nth: number): string | null {
  if (!presetKey || presetKey === "upload" || presetKey === "") return null;
  if (CLOSEUP_SHOTS.has(shotId)) return null;
  if (presetKey === "auto") {
    const pool = POSE_POOLS[shotId] || POSE_KEYS;
    return POSE_PRESETS[pool[nth % pool.length]].description;
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
  // Fondo por FOTO (dataUrl) — gana sobre todo: el modelo se ubica en esa escena.
  const bgImageUrl = (cfg.ecomBackgroundImage as string) || undefined;
  let studioClauseBase: string;
  if (bgImageUrl) {
    studioClauseBase = "Place the model in the exact BACKGROUND / setting shown in the BACKGROUND reference image — same scene, surface, colors and lighting. The model stands naturally within that environment.";
  } else if (studioKey === "color") {
    const color = ((cfg.ecomStudioColor as string) || "#efefef").trim();
    studioClauseBase = `Seamless solid ${color} studio background — uniform and clean, soft even studio lighting, no gradient and no other objects on the backdrop.`;
  } else if (studioKey === "custom") {
    studioClauseBase = config.objective?.trim() || STUDIO_STYLES.white.clause;
  } else {
    studioClauseBase = STUDIO_STYLES[studioKey]?.clause || STUDIO_STYLES.white.clause;
  }
  // La sombra de contacto va en TODOS los shots (on-model y flat) — aterriza al sujeto.
  const studioClause = `${studioClauseBase} ${GROUNDING_SHADOW}`;

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
    if (bgImageUrl) { urls.push(bgImageUrl); desc.push(`Image ${idx}: BACKGROUND — use THIS exact scene/setting/surface as the background and place the model within it; match its colors and lighting. Do NOT copy any person from this image.`); idx++; }
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

  // Cantidad por toma on-model — el usuario puede pedir N variantes del mismo
  // plano (ej. Americano ×2). Cada instancia = una generación. La rotación de
  // poses (auto) las diferencia para que no salgan gemelas. Cap 1..4.
  const shotCounts = (cfg.ecomShotCounts as Record<string, number>) || {};
  const onModelInstances: Array<{ key: string; sid: string; nth: number; count: number }> = [];
  for (const sid of onModelShots) {
    const count = Math.max(1, Math.min(4, Math.round(shotCounts[sid] || 1)));
    for (let n = 0; n < count; n++) {
      onModelInstances.push({ key: n === 0 ? sid : `${sid}__v${n + 1}`, sid, nth: n, count });
    }
  }

  // ── On-model shots — sequential, anchored to the first for consistency ──
  let anchorUrl: string | undefined;
  for (let i = 0; i < onModelInstances.length; i++) {
    const inst = onModelInstances[i];
    const sid = inst.sid;
    const shot = SHOT_CATALOG[sid];
    // Sufijo para el label cuando hay cantidad >1 ("#2", "#3"…).
    const vSuffix = inst.count > 1 ? ` #${inst.nth + 1}` : "";
    // La pose ref del shot SOLO aplica a la 1ª instancia; las extra rotan pose
    // (si compartieran la misma ref saldrían idénticas, anulando la cantidad).
    const instPoseRef = inst.nth === 0 ? ecomShotPoses[sid] : undefined;
    // Pose ref específica de este shot — si existe, gana sobre la global.
    const shotPoseUrl = instPoseRef || poseUrl;

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
      const onModelLabelAnchor = garmentNamesAnchor ? `${shot.label}${vSuffix} · ${garmentNamesAnchor}` : `${shot.label}${vSuffix}`;
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
        const step1Prompt = `Professional e-commerce studio fashion photograph. Full-body shot of the IDENTITY person wearing the exact GARMENT(S) and ACCESSORIES from the references. ${studioClause} Clean composition, model facing the camera. ${CAMERA_LIGHTING} ${IDENTITY_LOCK} ${FACE_REALISM} ${FABRIC_REALISM} ${GARMENT_ORIENTATION} ${PIXEL_FIDELITY} ${REALISM_NEGATIVES}${NO_TEXT}\n\nREFERENCE IMAGES:\n${step1Desc.join("\n")}`;
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

TAKE FROM IMAGE 2 (the body POSTURE AND the framing — image 2 is the source of truth for how the shot looks):
- Body posture: stance, weight distribution, leg position
- Arm position and hand placement
- Torso angle and shoulder position
- Head tilt, head rotation, gaze direction
- Camera FRAMING and CROP: match image 2's EXACT zoom and distance. If image 2 is a full-body shot the output is full-body; if it is a waist-up / medium / close shot, the output is cropped the same way. Do NOT re-frame to a different crop.

CRITICAL — do NOT contaminate the output with anything from image 2 that is not pose- or framing-related:
- Tattoos visible on the model in image 2 → DO NOT add them to the output (the person in image 1 may have clean skin without tattoos)
- Jewelry, rings, bracelets, watches, earrings, necklaces shown on the model in image 2 → DO NOT add them
- Bags, purses, hats, caps, sunglasses, eyeglasses, scarves, belts, phones, cups, umbrellas or ANY prop/object held or worn in image 2 → DO NOT add them
- The background, room, wall, floor, props and scenery of image 2 → DO NOT keep any of it; the background comes ONLY from the studio backdrop in the prompt
- Clothing of the model in image 2 (vest, scarf, sandals, etc) → DO NOT add it
- Makeup, lipstick, eye makeup of the model in image 2 → DO NOT apply
- Piercings, body marks, scars of the model in image 2 → DO NOT add
- Hair style/color of image 2 → DO NOT change image 1's hair

The output person's skin, accessories, jewelry, tattoos, piercings, and clothing must match IMAGE 1 ONLY. If image 1 has no tattoos, the output has no tattoos. If image 1 has no jewelry, the output has no jewelry.

Output: the person from image 1, EXACTLY as they appear in image 1 (same skin, same jewelry, same clothing, same accessories, same face), re-posed to match the body geometry of image 2. The face must stay perfectly recognizable as the person in image 1 — do NOT let image 2's face leak in. ${FACE_REALISM} ${PIXEL_FIDELITY} ${REALISM_NEGATIVES}${NO_TEXT}`;
        const job2 = await createImageEdit(step2Urls, step2Prompt, config.aspectRatio, config.resolution);
        const res2 = await pollImageGen(job2.request_id);
        const url2 = res2.image_url || "";
        if (url2) anchorUrl = url2;
        generated[inst.key] = { id: inst.key, url: url2, label: onModelLabelAnchor, downloadName: primaryGarmentName, prompt: step2Prompt, status: res2.status === "failed" ? "failed" : "done" };
      } catch (e) {
        generated[inst.key] = { id: inst.key, url: "", label: onModelLabelAnchor, downloadName: primaryGarmentName, prompt: "", status: "failed" };
        console.error(`[ecommerce_pack] ${inst.key} (2-step) failed:`, e);
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
    } else if (instPoseRef) {
      // Shot 2+ CON pose ref específica: pose ref como base + anchor de shot 1
      // + avatar ORIGINAL como segunda fuente de identidad (doble anclaje de cara).
      urls.push(instPoseRef);
      desc.push(`Image ${idx}: BASE IMAGE (edit this) — start from this exact image and KEEP its body POSTURE AND its FRAMING: body position, stance, arm/hand placement, head tilt, gaze direction, AND the exact camera framing/crop/zoom (full-body, medium, close, etc.). This base image is the source of truth for the pose AND how the shot is framed — do NOT re-pose and do NOT re-frame. The PERSON shown in this base image is a stand-in: their face, head, hair, skin and identity are IRRELEVANT and MUST be fully replaced by the FACE REPLACEMENT (IDENTITY) reference below. The BACKGROUND / environment / room / floor / wall / lighting color of this base image are ALSO IRRELEVANT and MUST be fully discarded and replaced by the studio backdrop described in the prompt — do NOT keep the pose reference's background. REPLACE all the clothing (top AND bottom), the face/head AND the background as specified below.`);
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
- The output MUST be the BASE IMAGE re-posed body, with these changes:
  1) ALL the clothing of the person is REPLACED by the WARDROBE REPLACEMENT garment(s) — top AND bottom (trousers/skirt/shorts) AND layers. The trousers/pants/bottoms and top visible in the base image are IRRELEVANT and must NOT survive; every garment comes ONLY from the WARDROBE/GARMENT references.
  1b) REMOVE any accessory, prop or object in the BASE IMAGE that is NOT one of the provided ACCESSORY references — bag, purse, handbag, backpack, hat, cap, beanie, sunglasses, eyeglasses, scarf, belt, watch, bracelet, rings, necklace, earrings, gloves, phone, cup, bottle, umbrella, chair or anything held or worn. The model carries/wears ONLY the specified garments and accessory references — nothing from the base image's styling survives.
  2) The face/head/hair is REPLACED by the FACE REPLACEMENT (IDENTITY) reference — this is MANDATORY. Keep ONLY the head position, tilt and gaze from the BASE IMAGE; everything about WHO the face is comes from the FACE REPLACEMENT (IDENTITY) image, NOT from the base image. The base image person is a stand-in and their face must NOT survive into the output.
  3) Any specified ACCESSORY REPLACEMENT is added/replaced in its natural body location.
  4) The BACKGROUND / setting is REPLACED by the studio backdrop described at the top of this prompt (${studioClause.trim()}). Completely DISCARD the pose reference's environment — its room, floor, wall, props, colors and ambient lighting tint must NOT appear in the output. The final background is a clean studio backdrop, never the location from the pose reference.
- ${IDENTITY_LOCK}
- ${FACE_REALISM}
- ${GARMENT_ORIENTATION}
- PRESERVE from the BASE IMAGE both the body POSTURE and the FRAMING: pose, stance, limb and hand positions, torso angle, head tilt, gaze, AND the exact camera framing/crop/zoom/distance (full-body, medium, close, etc.). The base image is the source of truth for the pose AND the framing — do NOT re-pose and do NOT re-frame to a different crop. ONLY the background and color cast must NOT be copied (those come from the studio backdrop in the prompt).
- The garment/accessory reference photos contain models in OTHER poses and OTHER backgrounds — those models, faces, poses and backgrounds are IRRELEVANT. They exist ONLY to define what the clothing/accessory looks like.
- Treat this like a Photoshop edit on a model cutout: same body POSTURE and same framing/crop as the base image, but re-dressed, re-faced to the IDENTITY person, and placed on the clean studio backdrop.`
      : "";
    // Si NO hay pose ref imagen, inyectamos un preset textual de pose (rota
    // entre 8 si "auto", o usa la elegida por el user). Eso evita que la
    // modelo quede dura/estática y le da variedad editorial a la galería.
    const poseDesc = !shotPoseUrl ? getPoseDescription(posePreset, sid, inst.nth) : null;
    const presetPoseClause = poseDesc ? ` POSE: ${poseDesc}` : "";
    const identityClause = avatar?.imageUrl ? `${IDENTITY_LOCK} ` : "";
    const prompt = `Professional e-commerce studio fashion photograph. ${studioClause} FRAMING (MANDATORY — defines the crop/zoom): ${shot.framing}${presetPoseClause} ${wardrobe}${CAMERA_LIGHTING} ${identityClause}${FACE_REALISM} ${FABRIC_REALISM} ${GARMENT_ORIENTATION} ${PIXEL_FIDELITY} ${REALISM_NEGATIVES}${NO_TEXT}${poseOverride}\n\nREFERENCE IMAGES:\n${desc.join("\n")}`;
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
      const onModelLabel = garmentNames ? `${shot.label}${vSuffix} · ${garmentNames}` : `${shot.label}${vSuffix}`;
      generated[inst.key] = { id: inst.key, url, label: onModelLabel, downloadName: primaryGarmentName, prompt, status: res.status === "failed" ? "failed" : "done" };
    } catch (e) {
      const garmentNames = garments.map((g) => g.name).filter(Boolean).join(" + ") || selectedProduct?.name || "";
      const onModelLabel = garmentNames ? `${shot.label}${vSuffix} · ${garmentNames}` : `${shot.label}${vSuffix}`;
      generated[inst.key] = { id: inst.key, url: "", label: onModelLabel, downloadName: primaryGarmentName, prompt, status: "failed" };
      console.error(`[ecommerce_pack] ${inst.key} failed:`, e);
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
      const prompt = `Professional e-commerce product packshot of a single garment. ${studioClause} ${shot.framing} Show ONLY this one garment — no other clothing items. ${CAMERA_LIGHTING} ${FABRIC_REALISM} ${PIXEL_FIDELITY} ${REALISM_NEGATIVES}${NO_TEXT}\n\nREFERENCE IMAGES:\n${desc.join("\n")}`;
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
      // Todas las instancias de esta toma, en orden (#1, #2, …).
      onModelInstances.filter((inst) => inst.sid === sid).forEach((inst) => {
        if (generated[inst.key]) images.push(generated[inst.key]);
      });
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
