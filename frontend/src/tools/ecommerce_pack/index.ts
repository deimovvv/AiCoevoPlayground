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
import { createImageEdit, createTextToImage, pollImageGen, analyzePoseRefDecoys, cropImageTop } from "../../lib/api";

// Shot catalog. `onModel` shots feature the model wearing the garment; the rest are
// product-only packshots. Each entry's `framing` is appended to the studio prompt.
export const SHOT_CATALOG: Record<string, { label: string; onModel: boolean; framing: string }> = {
  model_front:  { label: "On-model · Frente",  onModel: true,  framing: "Full-body or 3/4-body FRONT view: the model faces the camera straight on, standing naturally, the full garment clearly visible." },
  model_34:     { label: "On-model · 3/4 (ángulo)", onModel: true, framing: "3/4 ANGLE view (this is a ROTATION, not a crop): full-length shot with the model's body turned about 45° to show the garment's front AND side. Keep the framing full-body." },
  model_american: { label: "On-model · Americano (plano medio)", onModel: true, framing: "AMERICAN / medium shot (this is a CROP, not a rotation): the bottom edge of the frame CUTS THE BODY at roughly mid-thigh — the feet, shoes and lower legs are OUT of frame. Framed from mid-thigh up, the garment's upper and mid section shown clearly. This is a medium catalog crop — NOT a full-body shot (do not show the whole body or the feet) and NOT a tight close-up." },
  model_back:   { label: "On-model · Espalda",  onModel: true,  framing: "BACK view: the model faces FULLY away from the camera, clearly showing the complete back of the garment. By default the head faces away and the face is NOT visible (a clean catalog back shot) — do NOT turn the head back to camera unless the pose says so." },
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
  // Receta "elevated ecommerce" dialada en el Lab (Koxis 2026-07): pared texturada + luz de
  // ventana suave y pareja + grade cálido true-to-color. Mata el look "pegada" del blanco
  // plano sin irse al editorial dramático (la prenda queda totalmente visible).
  plaster:   { label: "Pared texturada · luz natural", clause: "Textured warm light-grey plaster wall with subtle natural tonal variation as the background (NOT a seamless studio sweep). Soft, EVEN natural window daylight with gentle direction — well filled, NO deep shadows; the garment stays fully visible and evenly lit with clear fabric detail. Warm, natural, true-to-color grade — bright and clean, never moody, cold or clinical. The model stands close to the wall, grounded on a simple neutral floor. Elevated, realistic, natural e-commerce look — NOT flat high-key studio, NOT dramatic editorial." },
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
// Bajo contraste = el lever #1 de realismo (evita el look duro/AI). Sombras levantadas,
// altas controladas, transiciones suaves — como el ecommerce/editorial real (COS, Massimo
// Dutti). Se appendea a AMBOS bloques de luz. Pedido Koxis 2026-07.
const LOW_CONTRAST_GRADE = "Soft, LOW-CONTRAST tonal range: gently lifted shadows (no crushed blacks), controlled highlights (no blown whites), smooth natural tonal gradations on skin and fabric. Natural, flat, film-like editorial grade — NOT punchy, harsh or high-contrast.";
const CAMERA_LIGHTING = `Captured as a real photograph on a full-frame camera (Sony A7-class) with an 85mm prime lens at f/8 for edge-to-edge sharpness. Professional studio lighting: soft diffused key light from the front-right at 45°, a large fill light on the opposite side for even commercial illumination, neutral 5500K white balance. Clean editorial e-commerce lighting. ${LOW_CONTRAST_GRADE}`;
// Variante para el preset "plaster" (pared texturada): mismo cuerpo/lente pero luz de
// ventana natural y cálida en vez de key/fill de estudio neutro — así no pelea con el
// look warm del backdrop. Sin esto, el 5500K neutro tira la escena de vuelta a estudio.
const CAMERA_LIGHTING_NATURAL = `Captured as a real photograph on a full-frame camera (Sony A7-class) with an 85mm prime lens at f/8 for edge-to-edge sharpness. Soft, even NATURAL window daylight coming gently from one side, well filled so there are no deep shadows and the garment stays fully visible; warm natural white balance (~4800–5200K), realistic natural-light rendering — NOT hard studio key/fill, NOT clinical 5500K neutral. Natural, elevated e-commerce lighting. ${LOW_CONTRAST_GRADE}`;
// Negative prompt — el mayor lever de realismo en Nano Banana. Empuja fuera el look
// plástico/ilustración/AI y el over-retoque que delata la imagen generada.
const REALISM_NEGATIVES = "NEGATIVE (must NOT appear): illustration, 3D render, CGI, AI-generated look, plastic or waxy finish, over-retouched airbrushed perfection, oversaturated colors, harsh shadows projected on the backdrop wall.";
// Sombra de contacto sutil — aterriza al sujeto (modelo/producto) para que no quede
// flotando/recortado. Es la sombra de PISO, distinta de la proyectada en la pared
// (que sí evitamos). Pedido del usuario: las fotos e-commerce siempre deben tenerla.
const GROUNDING_SHADOW = "GROUND THE SUBJECT with a SUBTLE floor shadow: a faint, soft, diffused contact shadow directly beneath the feet (or the product's base) — like a gentle soft grey gradient on the floor, avoiding harsh lines — so the subject isn't floating. Keep it subtle and natural, NEVER heavy, dark, dramatic or directional. The shadow lives ONLY on the floor under the subject — NEVER cast across the body, garment, face or the backdrop wall.";
// Aislamiento del fondo — los assets (prenda/accesorio/producto) vienen fotografiados
// sobre SU propia superficie/color, y Nano Banana a veces adopta ese color de fondo.
// Reportado: "con studio seamless pero accesorios, el fondo toma el color del accesorio".
const BG_ISOLATION = "The background is ONLY the studio backdrop described above — do NOT adopt any background color, surface, gradient, table or setting from the garment / accessory / product reference photos. Those references are product cutouts on their own surfaces; take ONLY the item itself and completely ignore whatever is behind it.";
// Orientación de prenda — Nano Banana a veces da vuelta la remera (frente↔espalda).
// Lock explícito: la prenda se usa como en la foto de referencia.
const GARMENT_ORIENTATION = "Wear every garment in its CORRECT orientation, matching the garment reference exactly — prints, logos, buttons, zippers, pockets and necklines where they belong. In FRONT and 3/4 shots the front of the garment faces the camera; never reverse, mirror or show a garment's back unless this is explicitly a BACK shot.";

// Énfasis en piernas / tren inferior al copiar una pose. El fallo #1 de Nano Banana es
// copiar los brazos pero dejar las piernas en un parado default — este bloque le da a
// las piernas el mismo peso que a los brazos y lo dice explícitamente.
// Quiebre de cintura / contrapposto — se appendea a toda pose on-model para que la modelo
// no quede tiesa y frontal-plana. Pedido (Koxis 2026-07): "que quiebre más la cintura, más natural".
const POSE_NATURALNESS = "NATURAL WAIST BREAK (avoid stiff, square, evenly-weighted standing): the model clearly shifts weight onto one leg so the hips break and tilt into a soft contrapposto — one hip pushed out and slightly higher, the waist and spine gently S-curved, the shoulders subtly counter-angled to the hips. Effortless, relaxed, editorial-natural stance; never rigid or symmetric-frontal.";

const POSE_FULL_BODY = "Copy the pose of the WHOLE body from head to feet — the LEGS AND LOWER BODY are as important as the arms. Replicate the exact lower-body stance: which leg carries the weight, how much each knee is bent, whether the legs are together / apart / crossed / staggered, and how the feet are planted and angled. The single most common mistake is copying the arms while leaving the legs in a plain straight standing stance — do NOT do that; the legs must match the reference just as precisely as the upper body.";

// Consistencia de fondo entre etapas/shots — el backdrop es el MISMO estudio en todo el
// pack, sin variación de tono/gradiente/piso de una toma a otra.
const BG_CONSISTENCY = "BACKGROUND CONSISTENCY: the studio backdrop must stay IDENTICAL and uniform across every shot in this pack — same exact tone, same gradient, same floor. Do NOT invent, drift or vary the background between shots; it is always the same clean studio described above.";

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
    description: "Standing in clear contrapposto, weight firmly on the left leg, right hip pushed out and the waist breaking into a soft S-curve. Right hand resting lightly on right hip pocket, left arm hanging naturally at side. Shoulders back and relaxed, chest open. Head facing camera with relaxed, confident expression.",
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
  back_clean: {
    label: "Back · Limpia (catálogo)",
    description: "Body facing FULLY away from the camera, showing the COMPLETE back of the garment, clean and unobstructed. Head faces forward/away — NOT turned back to the camera, the face is NOT visible. Natural relaxed standing posture, both arms relaxed at the sides so they don't cover the garment. A clean catalog back shot focused entirely on the garment's back.",
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
  model_back:     ["back_clean", "back_over_shoulder", "back_hand_to_neck", "back_walk_away"],
};

// Close-ups: NO reciben pose preset. Las poses están escritas "full body in frame",
// que contradice un crop cerrado. Para estos planos manda el encuadre (la framing
// clause ya describe el crop y, en primer plano, la cara mirando a cámara).
const CLOSEUP_SHOTS = new Set(["model_detail", "model_closeup", "model_detail_lower"]);

// Shots on-model donde la CARA debe quedar en cuadro sí o sí. Si la pose ref viene
// recortada al cuello/pecho, NO copiamos ese crop — extendemos hacia arriba para no
// decapitar a la modelo. (detail / detail_lower / back no necesitan cara.) Reportado:
// pasaron una pose street-style cortada al cuello y salió sin cabeza.
const FACE_REQUIRED_SHOTS = new Set(["model_front", "model_34", "model_american", "model_closeup"]);
const FACE_MUST_STAY = "FRAMING OVERRIDE (mandatory for this shot): the model's HEAD and FACE must remain FULLY within the frame. If the pose / base reference is cropped tighter (head cut off, framed at the neck, shoulders or chest), do NOT copy that tight crop — pull the camera back and extend the framing UPWARD so the entire head and face are clearly visible. NEVER output a headless or decapitated shot.";

// Mensaje legible para la UI. createImageEdit tira el `detail` del backend (Fal key
// inválida, cuota, HEIC…); pollImageGen devuelve status "failed" con .error (política
// de contenido / caras). Así el usuario ve la causa SIN abrir la terminal.
function ecomErr(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return m.trim() || "Error desconocido en la generación.";
}
const POLL_FAILED_MSG = "Fal marcó la generación como fallida (probable política de contenido — caras — o el modelo no pudo generar). Probá otra pose/imagen o reintentá.";

/** Devuelve la descripción de la pose para una instancia de shot.
 *  - close-up → null (el encuadre manda; las poses full-body contradicen el crop).
 *  - "auto" → rota DENTRO del pool del encuadre por la variante (nth): variante #1
 *    = primera del pool, #2 = segunda, etc. → coherente con el plano y distinta por variante.
 *  - clave específica → esa pose fija (ignora el pool).
 *  - "upload" / "" / undefined → null (caller usa la pose ref imagen si la hay). */
function getPoseDescription(presetKey: string | undefined, shotId: string, nth: number): string | null {
  if (!presetKey || presetKey === "upload" || presetKey === "") return null;
  if (CLOSEUP_SHOTS.has(shotId)) return null;
  const base = presetKey === "auto"
    ? POSE_PRESETS[(POSE_POOLS[shotId] || POSE_KEYS)[nth % (POSE_POOLS[shotId] || POSE_KEYS).length]].description
    : POSE_PRESETS[presetKey]?.description || null;
  if (!base) return null;
  // Reforzamos el quiebre de cintura en toda pose de pie (las de espalda/caminando ya
  // implican dinámica, pero el S-curve les suma naturalidad igual).
  return `${base} ${POSE_NATURALNESS}`;
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
    || (config.selectedAvatarIds?.length ? (activeBrand.avatars || []).find((a) => (config.selectedAvatarIds ?? []).includes(a.id)) : undefined);
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
  // La sombra de contacto + el aislamiento de fondo van en TODOS los shots.
  const studioClause = `${studioClauseBase} ${GROUNDING_SHADOW} ${BG_ISOLATION} ${BG_CONSISTENCY}`;
  // El preset "plaster" usa luz de ventana natural; el resto, el estudio neutro de siempre.
  const cameraLighting = studioKey === "plaster" ? CAMERA_LIGHTING_NATURAL : CAMERA_LIGHTING;

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
  const generated: Record<string, { id: string; url: string; label: string; downloadName: string; prompt: string; status: string; error?: string }> = {};

  // Per-shot pose refs (subidas por el usuario una por cada shot tildado). Da
  // dinámica — pose distinta por front/back/detail en lugar de modelo duro.
  // Mapeo shotId → dataUrl. Tiene PRIORIDAD sobre la pose global (poseUrl).
  const ecomShotPoses = ((cfg.ecomShotPoses as Record<string, string>) || {});

  // Curación de pose refs con Gemini Vision (una vez por ref, cacheado): describe la
  // postura y NOMBRA los decoys (ropa/pelo/props/fondo) a ignorar. Nombrarlos puntual es
  // lo que evita que Nano Banana filtre la ropa de la pose ref (validado en el Lab).
  // Fail-open: si Gemini falla → {pose:"", ignore:""} y el prompt usa su genérico de siempre.
  const poseRefCuration = new Map<string, { pose: string; ignore: string }>();
  {
    const uniquePoseUrls = [...new Set([poseUrl, ...Object.values(ecomShotPoses)].filter(Boolean) as string[])];
    await Promise.all(uniquePoseUrls.map(async (u) => {
      poseRefCuration.set(u, await analyzePoseRefDecoys(u));
    }));
  }

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
    // ¿Este shot exige cara en cuadro? Si sí, ninguna pose ref puede decapitar.
    const faceRequired = FACE_REQUIRED_SHOTS.has(sid);
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
        const step1Prompt = `Professional e-commerce studio fashion photograph. Full-body shot of the IDENTITY person wearing the exact GARMENT(S) and ACCESSORIES from the references. ${studioClause} Clean composition, model facing the camera. ${cameraLighting} ${IDENTITY_LOCK} ${FACE_REALISM} ${FABRIC_REALISM} ${GARMENT_ORIENTATION} ${PIXEL_FIDELITY} ${REALISM_NEGATIVES}${NO_TEXT}\n\nREFERENCE IMAGES:\n${step1Desc.join("\n")}`;
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
- Background and studio lighting: keep the EXACT studio backdrop from image 1 — same tone, same gradient, same floor. Do NOT introduce, invent or drift to a different background.

TAKE FROM IMAGE 2 (the body POSTURE AND the framing — image 2 is the source of truth for how the shot looks):
- Overall body posture: stance, weight distribution, torso lean
- LEGS AND LOWER BODY (as important as the arms): the exact position of each leg — which leg bears the weight, how much each knee is bent, feet placement and angle, legs together / apart / crossed / staggered. Copy the lower body as precisely as the upper body; do NOT default to a plain straight-legged stance.
- Arm position and hand placement
- Torso angle and shoulder position
- Head tilt, head rotation, gaze direction
- Camera FRAMING and CROP: match image 2's EXACT zoom and distance. If image 2 is a full-body shot the output is full-body; if it is a waist-up / medium / close shot, the output is cropped the same way. Do NOT re-frame to a different crop.${faceRequired ? " EXCEPTION: never crop the model's head/face out — if image 2 cuts the head off, extend the framing upward so the whole face stays visible." : ""}

${POSE_FULL_BODY}${faceRequired ? `\n\n${FACE_MUST_STAY}` : ""}

CRITICAL — do NOT contaminate the output with anything from image 2 that is not pose- or framing-related:
- Tattoos visible on the model in image 2 → DO NOT add them to the output (the person in image 1 may have clean skin without tattoos)
- Jewelry, rings, bracelets, watches, earrings, necklaces shown on the model in image 2 → DO NOT add them
- Bags, purses, hats, caps, sunglasses, eyeglasses, scarves, belts, phones, cups, umbrellas or ANY prop/object held or worn in image 2 → DO NOT add them
- The background, room, wall, floor, props and scenery of image 2 → DO NOT keep any of it; the background comes ONLY from the studio backdrop in the prompt
- The LIGHTING, shadows, exposure and color/mood of image 2 → DO NOT copy. Image 2 may have dramatic, directional or harsh shadows on the body — those must NOT appear. The body is lit ONLY by image 1's soft, even studio light; the only shadow allowed is a subtle, soft shadow on the FLOOR beneath the feet. Image 2 contributes ONLY body geometry (posture) and camera framing — nothing about light, shadow or color.
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
        generated[inst.key] = { id: inst.key, url: url2, label: onModelLabelAnchor, downloadName: primaryGarmentName, prompt: step2Prompt, status: res2.status === "failed" ? "failed" : "done", error: res2.status === "failed" ? (res2.error || POLL_FAILED_MSG) : undefined };
      } catch (e) {
        generated[inst.key] = { id: inst.key, url: "", label: onModelLabelAnchor, downloadName: primaryGarmentName, prompt: "", status: "failed", error: ecomErr(e) };
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
      // Shot 2+ CON pose ref específica. PRIORIDAD INVERTIDA (validado en el Lab): el SUJETO
      // (persona + prenda + estudio) es el ANCHOR = Image 1 (fuente de verdad), y la pose ref
      // entra como Image 2 = SOLO postura + encuadre, con los decoys NOMBRADOS a ignorar.
      // Antes la pose ref era la "base image" (Image 1) y su ropa se filtraba — el fallo #1.
      const cur = poseRefCuration.get(instPoseRef) || { pose: "", ignore: "" };
      urls.push(anchorUrl);
      desc.push(`Image ${idx}: SUBJECT — the SOURCE OF TRUTH for WHO the person is, the EXACT garment(s) and accessories they wear, and the studio backdrop + lighting. The output MUST keep this exact person wearing this exact outfit on this exact studio. This is what the shot is OF.`);
      idx++;
      urls.push(instPoseRef);
      desc.push(`Image ${idx}: POSE REFERENCE — copy ONLY the body posture and the body ORIENTATION (which way the body is turned) from this image${cur.pose ? ` (${cur.pose})` : " (body position, stance, arm/hand placement, head tilt, gaze, and how the body is rotated)"}. Do NOT copy this image's framing/crop/zoom — the CROP is defined by the shot's FRAMING instruction in the prompt, which overrides this image. EVERYTHING ELSE in this image is a DECOY and must be COMPLETELY DISCARDED — it must NOT appear in the output: the person's face/hair/skin/identity, ALL their clothing${cur.ignore ? ` (specifically: ${cur.ignore})` : ""}, their accessories, anything they hold, and the background/setting. The person here is only a posing stand-in; take the posture and orientation, nothing else.`);
      idx++;
      // Avatar como fuente de identidad — DEBE ganar sobre la cara de la pose ref.
      if (avatar?.imageUrl) {
        urls.push(avatar.imageUrl);
        desc.push(`Image ${idx}: FACE REPLACEMENT (IDENTITY) — ABSOLUTE HIGHEST PRIORITY. The output face/head/hair MUST be this exact person, overriding whatever face is in the POSE reference. ${IDENTITY_LOCK} ${FACE_REALISM}`);
        idx++;
      }
      garmentUrls.forEach((u) => { urls.push(u); desc.push(`Image ${idx}: GARMENT REFERENCE — the model wears THIS exact item (this is the real product, NOT whatever the pose reference person wears). Pixel-perfect. ${PIXEL_FIDELITY}`); idx++; });
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
    // Cierre para pose-ref (prioridad invertida, estilo Lab): el SUBJECT (Image 1 / anchor)
    // manda persona + prenda + estudio; de la POSE ref sale SOLO postura + encuadre, y sus
    // decoys (nombrados por Gemini) se descartan. Reemplaza el viejo paradigma "editá la base".
    const poseCur = shotPoseUrl ? (poseRefCuration.get(shotPoseUrl) || { pose: "", ignore: "" }) : { pose: "", ignore: "" };
    const poseOverride = shotPoseUrl
      ? `

POSE-TRANSFER INSTRUCTIONS (keep the SUBJECT, borrow ONLY the pose):
- The output is a photorealistic e-commerce studio photo of the SUBJECT person wearing their EXACT garment(s) and accessories from the SUBJECT/GARMENT references, on the studio backdrop described above (${studioClause.trim()}).
- From the POSE REFERENCE, take ONLY the body POSTURE and body ORIENTATION: stance, torso angle, head tilt, gaze, arm and hand positions, LEG AND LOWER-BODY position (weight-bearing leg, knee bend, feet placement and angle — copy the legs as precisely as the arms, do NOT reset them to a plain straight stance). CRITICAL — reproduce the EXACT BODY ORIENTATION of the pose reference: if the person is turned to the side (de costado), in 3/4, in full profile or with their back to camera, the output MUST be turned the SAME way and the SAME amount, to the same side. Do NOT default the body to front-facing.${poseCur.pose ? ` The pose to reproduce: ${poseCur.pose}` : ""}
- The CROP / FRAMING comes from the FRAMING instruction at the TOP of this prompt (MANDATORY), NOT from the pose reference. If the shot is a medium/American crop, CUT the frame at mid-thigh even if the pose reference shows the full body; if it is a close-up, crop tighter. The shot's framing ALWAYS overrides the pose reference's framing.
- STRICTLY IGNORE everything else in the POSE reference — its clothing, hair, face, skin, accessories, props/objects held, and background are ALL a DECOY and must NOT appear in the output.${poseCur.ignore ? ` Specifically discard: ${poseCur.ignore}.` : ""} The garment the model wears comes ONLY from the GARMENT reference (the real product), never from the pose reference person.
- ${IDENTITY_LOCK}
- ${FACE_REALISM}
- ${GARMENT_ORIENTATION}
- Do NOT copy the POSE reference's LIGHTING, shadows, exposure or color cast. The output is lit by the clean studio light described above (soft, even); the only shadow is a subtle soft shadow on the FLOOR beneath the feet.${faceRequired ? " Never crop the model's head/face out — if the pose framing cuts the head off, extend the framing upward so the whole face stays visible." : ""} ${POSE_FULL_BODY}${faceRequired ? ` ${FACE_MUST_STAY}` : ""}`
      : "";
    // Si NO hay pose ref imagen, inyectamos un preset textual de pose (rota
    // entre 8 si "auto", o usa la elegida por el user). Eso evita que la
    // modelo quede dura/estática y le da variedad editorial a la galería.
    const poseDesc = !shotPoseUrl ? getPoseDescription(posePreset, sid, inst.nth) : null;
    const presetPoseClause = poseDesc ? ` POSE: ${poseDesc}` : "";
    const identityClause = avatar?.imageUrl ? `${IDENTITY_LOCK} ` : "";
    const prompt = `Professional e-commerce studio fashion photograph. ${studioClause} FRAMING (MANDATORY — defines the crop/zoom): ${shot.framing}${presetPoseClause} ${wardrobe}${cameraLighting} ${identityClause}${FACE_REALISM} ${FABRIC_REALISM} ${GARMENT_ORIENTATION} ${PIXEL_FIDELITY} ${REALISM_NEGATIVES}${NO_TEXT}${poseOverride}\n\nREFERENCE IMAGES:\n${desc.join("\n")}`;
    try {
      const job = urls.length ? await createImageEdit(urls, prompt, config.aspectRatio, config.resolution) : await createTextToImage(prompt, config.aspectRatio, config.resolution);
      const res = await pollImageGen(job.request_id);
      let url = res.image_url || "";
      // El anchor usa la imagen SIN recortar (consistencia de prenda/estudio); el recorte
      // es solo para el entregable.
      if (i === 0 && url) anchorUrl = url;
      // Post-crop determinístico para el americano: Nano Banana tira a cuerpo entero por
      // más que el prompt pida el corte. Lo recortamos a ~medio muslo garantizado.
      if (url && sid === "model_american") {
        url = await cropImageTop(url, 0.65);
      }
      // Label con nombre(s) de prenda(s) — el usuario quiere que el filename
      // descargado preserve el nombre del archivo original que cargó (ej. si
      // subiste "remera-roja.jpg", el output debería llamarse así, no "frente.png").
      // El name de cada garment viene del filename original via deriveAssetName.
      const garmentNames = garments.map((g) => g.name).filter(Boolean).join(" + ") || selectedProduct?.name || "";
      const onModelLabel = garmentNames ? `${shot.label}${vSuffix} · ${garmentNames}` : `${shot.label}${vSuffix}`;
      generated[inst.key] = { id: inst.key, url, label: onModelLabel, downloadName: primaryGarmentName, prompt, status: res.status === "failed" ? "failed" : "done", error: res.status === "failed" ? (res.error || POLL_FAILED_MSG) : undefined };
    } catch (e) {
      const garmentNames = garments.map((g) => g.name).filter(Boolean).join(" + ") || selectedProduct?.name || "";
      const onModelLabel = garmentNames ? `${shot.label}${vSuffix} · ${garmentNames}` : `${shot.label}${vSuffix}`;
      generated[inst.key] = { id: inst.key, url: "", label: onModelLabel, downloadName: primaryGarmentName, prompt, status: "failed", error: ecomErr(e) };
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

  const flatImages: Array<{ sid: string; id: string; url: string; label: string; downloadName: string; prompt: string; status: string; error?: string }> = [];
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
      const prompt = `Professional e-commerce product packshot of a single garment. ${studioClause} ${shot.framing} Show ONLY this one garment — no other clothing items. ${cameraLighting} ${FABRIC_REALISM} ${PIXEL_FIDELITY} ${REALISM_NEGATIVES}${NO_TEXT}\n\nREFERENCE IMAGES:\n${desc.join("\n")}`;
      try {
        const job = await createImageEdit(urls, prompt, config.aspectRatio, config.resolution);
        const res = await pollImageGen(job.request_id);
        flatImages.push({ sid, id, url: res.image_url || "", label, downloadName, prompt, status: res.status === "failed" ? "failed" : "done", error: res.status === "failed" ? (res.error || POLL_FAILED_MSG) : undefined });
      } catch (e) {
        flatImages.push({ sid, id, url: "", label, downloadName, prompt, status: "failed", error: ecomErr(e) });
        console.error(`[ecommerce_pack] flat ${id} failed:`, e);
      }
    });
  }));

  // Assemble in the user's shot order: on-model shots, then each flat shot's per-garment images.
  const images: Array<{ id: string; url: string; label: string; downloadName: string; prompt: string; status: string; error?: string }> = [];
  for (const sid of shots) {
    if (SHOT_CATALOG[sid]?.onModel) {
      // Todas las instancias de esta toma, en orden (#1, #2, …).
      onModelInstances.filter((inst) => inst.sid === sid).forEach((inst) => {
        if (generated[inst.key]) images.push(generated[inst.key]);
      });
    } else {
      flatImages.filter((im) => im.sid === sid).forEach(({ id, url, label, downloadName, prompt, status, error }) => images.push({ id, url, label, downloadName, prompt, status, error }));
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
