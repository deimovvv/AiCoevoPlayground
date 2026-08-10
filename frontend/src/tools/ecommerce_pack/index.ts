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
import { createImageEdit, createTextToImage, pollImageGen, analyzePoseRefDecoys, repaintBgToColor, type ImageModel } from "../../lib/api";

// Shot catalog. `onModel` shots feature the model wearing the garment; the rest are
// product-only packshots. Each entry's `framing` is appended to the studio prompt.
export const SHOT_CATALOG: Record<string, { label: string; onModel: boolean; framing: string }> = {
  model_front:  { label: "On-model · Frente",  onModel: true,  framing: "Full-body or 3/4-body FRONT view: the model faces the camera straight on, standing naturally, the full garment clearly visible." },
  model_34:     { label: "On-model · 3/4 (ángulo)", onModel: true, framing: "3/4 ANGLE view (this is a ROTATION, not a crop): full-length shot with the model's body turned about 45° to show the garment's front AND side. Keep the framing full-body." },
  model_side:   { label: "On-model · Costado (perfil)", onModel: true, framing: "SIDE / PROFILE view (this is a ROTATION, not a crop): full-length shot with the model turned to a FULL 90° side profile (facing left or right), showing the garment's silhouette and side seam from the side. The head is in profile, gaze forward or softly toward the camera, in a natural relaxed stance. Keep the framing FULL-BODY, feet included." },
  model_american: { label: "On-model · Americano", onModel: true, framing: "AMERICAN shot (this is a CROP, not a rotation): the bottom edge of the frame CUTS THE BODY at roughly the KNEE — the lower legs, ankles and feet are OUT of frame. Framed from the knees up, showing the head, torso and most of the trousers/skirt down to the knee. This is NOT a full-body shot (do not show the feet) and NOT a waist-up medium shot." },
  model_medium: { label: "On-model · Plano medio", onModel: true, framing: "MEDIUM shot (plano medio — this is a CROP, not a rotation): the bottom edge of the frame CUTS THE BODY at roughly the WAIST / hips — framed from the waist up, showing the head, torso and the upper/mid section of the garment. NOT full-body, NOT down to the thighs or knees, and NOT a tight close-up." },
  model_back:   { label: "On-model · Espalda",  onModel: true,  framing: "BACK view: the model faces FULLY away from the camera, clearly showing the complete back of the garment. By default the head faces away and the face is NOT visible (a clean catalog back shot) — do NOT turn the head back to camera unless the pose says so." },
  model_detail: { label: "On-model · Detalle prenda", onModel: true, framing: "Tight CLOSE-UP on the garment as worn (fabric, texture, print, stitching, logo) — crop to the chest/torso area, no face needed." },
  model_detail_lower: { label: "On-model · Detalle inferior", onModel: true, framing: "LOWER-BODY close-up: framed from roughly the waist down to mid-calf or the shoes, showing the bottom garment (trousers, skirt, shorts) — its fabric, fit, drape, hem and length — plus footwear if it is part of the look. No face in frame." },
  model_custom: { label: "On-model · Pose custom", onModel: true, framing: "CUSTOM POSE shot: the exact body posture, camera ANGLE and FRAMING/CROP are taken ENTIRELY from the attached POSE REFERENCE — reproduce that pose and framing precisely, with no fixed preset framing of its own. (If no pose reference is attached, default to a natural full-body front stance.)" },
  flat_front:   { label: "Flat · Frente",       onModel: false, framing: "Product-only PACKSHOT: the garment presented flat/ghost-mannequin facing FRONT, centered. NO person, NO model, NO body — only the garment." },
  flat_back:    { label: "Flat · Espalda",      onModel: false, framing: "Product-only PACKSHOT of the garment's BACK, centered. NO person, NO model — only the garment." },
  flat_detail:  { label: "Flat · Detalle",      onModel: false, framing: "Product-only MACRO close-up of the garment's fabric, stitching, label or print. NO person — only the garment." },
};

export const DEFAULT_SHOTS = ["model_front", "model_back", "model_detail", "flat_front"];

// Studio backdrop presets. "custom" falls back to the Setting Description (objective).
export const STUDIO_STYLES: Record<string, { label: string; clause: string }> = {
  white:     { label: "Blanco seamless", clause: "STUDIO BACKGROUND COLOR — CRITICAL AND EXACT: the ENTIRE seamless backdrop must be the precise flat color HEX #ededed (RGB 237, 237, 237) — a soft warm-neutral LIGHT GREY. It is NOT white, NOT off-white, NOT ivory, NOT #FFFFFF, NOT #F5F5F5 — it is specifically #ededed light grey. Paint the whole background with this single uniform #ededed value edge to edge: perfectly FLAT and EVEN, NO gradient, NO vertical or corner falloff, NO vignette, NO brighter or whiter zones, NO hotspot, NO visible seams. Meter the exposure so the backdrop stays exactly at #ededed light grey and is NEVER washed out toward white or overexposed. The model sits naturally in this #ededed studio, evenly lit, never pasted or floating, with no harsh projected shadows on the wall." },
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

// Nota: el fondo default del preset "white" ya NO depende de un archivo (antes fondoUGC.png).
// El seamless de estudio se genera sintético en el backend (composite-bg, background_color) y
// la modelo se recorta + compone encima. Ver compositeToSeamless en el handler.

const PIXEL_FIDELITY = "COLOR FIDELITY IS CRITICAL — reproduce the EXACT color of the garment from its reference pixels: the SAME hue, shade, saturation and tone, matched faithfully (a navy stays that exact navy, an olive that exact olive, a beige that exact beige). Do NOT shift, warm, cool, wash out, mute, desaturate, tint, lighten or darken the color — the garment reference is the absolute AUTHORITY on color. Also reproduce the exact fabric, print, stitching, trims and proportions; do NOT restyle or invent details.";
const NO_TEXT = " Single clean photograph. No text, no watermark, no logo overlay, no graphics, no collage, no split panels.";

// Identidad y realismo — NO NEGOCIABLES en todos los on-model shots.
// La consistencia SIEMPRE tiene que ser el avatar (modelo) que el usuario eligió,
// nunca la persona que aparezca en una pose ref / base image. Reportado: "le pasé
// una pose para On Model Detail y no respetó la modelo principal".
const IDENTITY_LOCK = "IDENTITY LOCK (NON-NEGOTIABLE — top priority over everything else): the person in the output MUST be the EXACT same individual as the IDENTITY reference image. Photographically RECOGNIZABLE as that person: identical face geometry, eyes, eye color, eyebrows, nose shape, mouth/lips, jawline, cheekbones, skin tone, age, freckles/marks, hair color and hairstyle. Do NOT average, idealize, beautify, age, de-age, restyle or swap to any other face. If ANY base image, pose reference, garment photo or accessory photo shows a DIFFERENT person, that person's face, hair and identity are completely IRRELEVANT and MUST be fully discarded and replaced by the IDENTITY reference. The identity must stay perfectly consistent across every shot in the pack.";
// La cara TIENE que verse ultra realista — pedido explícito del usuario.
// Detalle/close-up SIN cara en cuadro: igual es la MISMA modelo del resto del pack. Reportado
// (Koxis): "el detalle salió con otro pelo". El pelo/piel/cuerpo visibles deben matchear.
const IDENTITY_DETAIL = "SAME MODEL IN DETAIL/CROPPED SHOTS (mandatory): even though the face may be out of frame, this is the EXACT SAME person as every other shot in the pack. Any visible HAIR (exact same color, length, texture and hairstyle), skin tone, hands, body type and skin marks MUST be identical to the identity/anchor. Do NOT change the hair, do NOT generate a different-looking or different-haired person — only the crop changes, the model stays the same.";

const FACE_REALISM = "ULTRA-PHOTOREALISTIC face and skin (CRITICAL): real human skin with visible pores, fine natural texture and true-to-life subsurface scattering — but CLEAN and EVEN in tone. NO blotches, NO patches, NO mottling, NO redness, NO discoloration, NO acne, NO rash and NO spots or marks that are not present in the identity reference; the complexion stays smooth and uniform across the face, neck and body. Absolutely NO smoothing, NO airbrushing, NO plastic/waxy/doll-like/CGI/3D-render/AI-generated look. Eyes razor-sharp and in focus with natural catchlights and real moisture; natural eyelashes and eyebrows. Skin tones natural, even and consistent, no over-saturation. Rendered like a real high-end editorial photograph shot on a full-frame camera with an 85mm prime lens, professional studio lighting, true photographic detail.";
// La textura de la tela también tiene que verse real (pedido del usuario).
const FABRIC_REALISM = "ULTRA-REALISTIC fabric and garment texture: render the true weave, knit, grain and material of each garment — visible threads, stitching, seams, hems, ribbing, wrinkles and natural folds where the cloth drapes and creases on the body. Cotton looks like cotton, denim like denim, knit like knit, leather like leather. Accurate sheen/matte response to the studio light, realistic micro-shadows in the folds. NO flat, painted, plastic or over-smoothed fabric; NO invented patterns. Crisp, high-resolution photographic detail across the whole garment.";
// Spec de cámara/luz — fija una captura fotográfica concreta (no "render"). f/8 da
// nitidez de borde a borde para e-commerce; 5500K neutro + setup de 2 luces evita el
// look plano/CGI. Aportado por el usuario a partir de un prompt de referencia que funcionaba.
// Bajo contraste = el lever #1 de realismo (evita el look duro/AI). Sombras levantadas,
// altas controladas, transiciones suaves — como el ecommerce/editorial real (COS, Massimo
// Dutti). Se appendea a AMBOS bloques de luz. Pedido Koxis 2026-07.
const LOW_CONTRAST_GRADE = "Soft, LOW-CONTRAST tonal range: gently lifted shadows (no crushed blacks), controlled highlights (no blown whites), smooth natural tonal gradations on skin and fabric. Natural, flat, film-like editorial grade — NOT punchy, harsh or high-contrast. IMPORTANT: this low contrast applies to TONE/BRIGHTNESS only — keep every COLOR true, accurate and properly saturated to the garment reference; do NOT desaturate, mute, wash out or colour-shift the garments.";
const CAMERA_LIGHTING = `Captured as a real photograph on a full-frame camera (Sony A7-class) with an 85mm prime lens at f/8 for edge-to-edge sharpness. SOFT, GENTLE studio lighting that gives SUBTLE three-dimensional volume without ever looking dramatic: a soft broad key light slightly favoring one side, with a generous soft fill, so the face and body get gentle modeling and form — a hint of soft shadow under the jaw, soft tonal falloff wrapping around the body — but are NEVER flat, front-on and dimensionless, and NEVER strongly side-lit, moody or high-contrast. Keep this SAME soft lighting setup and direction CONSISTENT across every shot in the pack (a full-body general shot and a close-up must share the same light). Shadows soft and low-contrast, garment fully visible with its detail readable. Neutral-to-slightly-warm white balance (~5200K). ${LOW_CONTRAST_GRADE}`;
// Variante para el preset "plaster" (pared texturada): mismo cuerpo/lente pero luz de
// ventana natural y cálida en vez de key/fill de estudio neutro — así no pelea con el
// look warm del backdrop. Sin esto, el 5500K neutro tira la escena de vuelta a estudio.
const CAMERA_LIGHTING_NATURAL = `Captured as a real photograph on a full-frame camera (Sony A7-class) with an 85mm prime lens at f/8 for edge-to-edge sharpness. Soft NATURAL window daylight gently favoring one side, giving SUBTLE three-dimensional volume (a hint of soft shadow under the jaw, gentle falloff around the body) — soft-filled so the shadows are never deep, hard or dramatic and the garment stays fully visible, and NEVER flat, even, front-on or dimensionless. Keep the SAME soft light direction CONSISTENT across every shot in the pack. Warm natural white balance (~4800–5200K), realistic natural-light rendering — NOT hard studio key/fill, NOT clinical 5500K neutral. Natural, elevated, dimensional e-commerce lighting. ${LOW_CONTRAST_GRADE}`;
// Negative prompt — el mayor lever de realismo en Nano Banana. Empuja fuera el look
// plástico/ilustración/AI y el over-retoque que delata la imagen generada.
const REALISM_NEGATIVES = "NEGATIVE (must NOT appear): illustration, 3D render, CGI, AI-generated look, plastic or waxy finish, over-retouched airbrushed perfection, garment colors that DRIFT from the reference (washed-out, desaturated, muted, faded, over-saturated, tinted, warmed or cooled — the color must match the garment reference exactly), harsh shadows projected on the backdrop wall, cut-out / pasted-on / composited subject with hard edges, subject that looks stuck onto a flat white background, strong or marked floor shadow gradient, pure clinical #FFFFFF background, FLAT dimensionless front-on lighting with no form or volume, evenly-lit face with no modeling shadow, oversized or enlarged head, bobblehead proportions, head too big for the body, disproportionate head-to-body ratio, dwarfed / foreshortened or too-short body, top-heavy anatomy, blotchy / patchy / mottled / uneven / discolored skin, skin spots, blemishes, acne or marks not present in the identity reference.";
// Proporciones humanas — el fix al feedback "cabeza grande / cuerpo desproporcionado".
// Aparece sobre todo con pose ref: la foto de identidad suele ser un primer plano de cara y,
// con el prompting fuerte de fidelidad facial + el re-encuadre del pose-transfer, Nano
// sobre-pesa la cabeza. Este clause fuerza la relación cabeza-cuerpo realista.
const BODY_PROPORTIONS = "NATURAL HUMAN PROPORTIONS (critical): render a realistic, anatomically correct adult with a normal head-to-body ratio — the head is roughly one-seventh to one-eighth of the full standing height. Do NOT enlarge the head or shrink the body: no oversized/large head, no bobblehead effect, no top-heavy figure, no dwarfed or foreshortened torso and legs. The head must stay in correct proportion to the neck, shoulders, torso, arms and legs; a full-body model must read as a tall, well-proportioned fashion model with long, natural limbs — the face stays perfectly recognizable WITHOUT scaling the head up.";
// Sombra de contacto sutil — aterriza al sujeto (modelo/producto) para que no quede
// flotando/recortado. Es la sombra de PISO, distinta de la proyectada en la pared
// (que sí evitamos). Pedido del usuario: las fotos e-commerce siempre deben tenerla.
const GROUNDING_SHADOW = "GROUND THE SUBJECT with a SUBTLE, SOFT, REALISTIC contact shadow on the floor where the feet (or product base) meet it — natural and clearly present (so the subject is grounded, never floating), but soft-edged and gentle, gently spreading and fading to one side as real diffused studio light would cast it. NOT harsh, dark, dramatic, hard-edged or high-contrast; NOT a marked grey gradient sweeping across the whole floor. The shadow lives ONLY on the floor around and behind the feet — NEVER across the body, garment, face or the backdrop wall.";
// Flat / packshot: la prenda está APOYADA (flat-lay / ghost), no de pie — no lleva la
// contact shadow de pies ni una sombra proyectada. Fondo limpio y parejo, sin sombra.
const FLAT_NO_SHADOW = "The garment is presented as a clean flat-lay / ghost packshot lying on the surface — it is NOT a standing figure, so it casts NO grounding shadow, NO drop shadow and NO projected shadow. Keep the background perfectly clean, uniform and even, with no shadow, no contact-shadow gradient and no dark falloff anywhere around the garment.";
// Aislamiento del fondo — los assets (prenda/accesorio/producto) vienen fotografiados
// sobre SU propia superficie/color, y Nano Banana a veces adopta ese color de fondo.
// Reportado: "con studio seamless pero accesorios, el fondo toma el color del accesorio".
const BG_ISOLATION = "BACKGROUND SOURCE (critical): the output background comes ONLY from the studio backdrop described above (and from the BACKGROUND reference image if one is provided). Do NOT adopt the background from ANY other reference — especially NOT the background behind the person in the IDENTITY / model photo (ignore its wall, studio, color, gradient or setting completely), and NOT the surfaces behind the garment / accessory / product cutouts. From the identity photo take ONLY the person; from the product photos take ONLY the item; the backdrop is never inherited from them.";
// Orientación de prenda — Nano Banana a veces da vuelta la remera (frente↔espalda).
// Lock explícito: la prenda se usa como en la foto de referencia.
const GARMENT_ORIENTATION = "Wear every garment in its CORRECT orientation, matching the garment reference exactly — prints, logos, buttons, zippers, pockets and necklines where they belong. In FRONT and 3/4 shots the front of the garment faces the camera; never reverse, mirror or show a garment's back unless this is explicitly a BACK shot.";

// Énfasis en piernas / tren inferior al copiar una pose. El fallo #1 de Nano Banana es
// copiar los brazos pero dejar las piernas en un parado default — este bloque le da a
// las piernas el mismo peso que a los brazos y lo dice explícitamente.
// Quiebre de cintura / contrapposto — se appendea a toda pose on-model para que la modelo
// no quede tiesa y frontal-plana. Pedido (Koxis 2026-07): "que quiebre más la cintura, más natural".
const POSE_NATURALNESS = "NATURAL, RELAXED STANCE — never stiff, rigid, square, tense, robotic or symmetric-frontal, never like an ID/passport photo. The model clearly shifts weight onto ONE leg (the other knee soft/relaxed) so the hips break naturally with an easy, believable asymmetry, relaxed shoulders and a subtle natural micro-lean; arms and hands fall naturally (a hand may rest lightly in a pocket, at the hip, or loose at the side). Make it GENDER-APPROPRIATE: for a woman, a soft waist break / gentle contrapposto (one hip clearly out, waist softly S-curved); for a MAN, still a clear relaxed weight-shift with a SUBTLE hip break (one hip a touch higher, weight on one leg, a casual lean) — masculine and at ease, just NOT a pronounced feminine S-curve. Either way the body must NOT be square, upright-symmetric or frozen. Effortless, candid, editorial — like a real person standing casually.";

const POSE_FULL_BODY = "Copy the LOWER-BODY pose as precisely as the arms — the legs and feet: which leg carries the weight, how much each knee is bent, whether the legs are together / apart / crossed / staggered, and how the feet are planted and angled (to the extent the legs are visible within THIS shot's framing). The single most common mistake is copying the arms while leaving the legs in a plain straight standing stance — do NOT do that; match the leg posture too. This is about the LEG POSTURE, NOT about forcing the whole body into frame — respect the shot's crop (if the framing is waist-down or a lower-body detail, do NOT add the torso/head to show the full body).";

// Fidelidad de pose como prioridad #1 (pedido Koxis: "afiná para que se acerque más").
// Nano Banana tiende a "neutralizar" la pose hacia un parado frontal default; esto le exige
// una copia LITERAL, tipo reenactment, sin suavizar ni simplificar la postura de la ref.
const POSE_FIDELITY = "POSE FIDELITY IS THE TOP PRIORITY of this generation — treat it like a faithful reenactment / motion-capture of the reference stance. Match the body geometry EXACTLY: every joint angle, the torso lean and rotation, shoulder line, hip tilt, the exact bend of each elbow and knee, hand and finger placement, foot position and where the gaze points. Do NOT soften, average, simplify, tidy up or default the pose back toward a plain symmetric frontal catalog stance. If the reference pose is dynamic, asymmetric, walking, leaning or unusual, reproduce that dynamism precisely — a viewer should recognize it as the SAME pose.";

// La rigidez que se ve NO es la geometría de la pose (esa hay que copiarla EXACTA), es el RENDER
// de madera/maniquí de Nano. Esto ataca el render: cuerpo vivo, sin tocar la geometría de la pose.
// Energía natural GENERAL — aplica a todo shot on-model (con pose ref o preset) sin dictar
// una postura específica, así no pelea con una pose ref. Pedido recurrente: "salen rígidos".
const NATURAL_ENERGY = "The model looks RELAXED, natural and at ease — candid, effortless editorial energy, loose relaxed shoulders, soft natural hands and a believable casual attitude, as if caught mid-moment rather than posing. NEVER stiff, rigid, tense, square, robotic, wooden, forced or like a passport photo.";
// Modo POSE ESTRICTA (toggle): cuando hay pose ref, copiala EXACTA sin naturalizar. Reemplaza
// a NATURAL_ENERGY para ese shot — el usuario quiere "la pose que paso, tal cual, sin que la
// afloje". Fidelidad de pose por encima de la naturalidad.
const STRICT_POSE = "STRICT POSE MODE — reproduce the POSE REFERENCE EXACTLY, joint by joint, like a 1:1 motion-capture / rotoscope: copy the precise angle of every limb, the torso lean and rotation, the hip and shoulder line, the hand and finger placement, the head tilt and gaze, and the exact leg/foot stance — with NO softening, NO relaxing, NO naturalising, NO reinterpretation and NO averaging toward a default catalog stance. The output stance must be indistinguishable from the reference pose. Fidelity to the pose OVERRIDES any tendency to make it look more relaxed or natural.";
const POSE_INHABIT = "RENDER the body as a REAL, LIVING person — natural flesh, muscle tone, soft realistic skin and believable weight, so it reads alive and photographed, NOT a wooden, plastic, stiff, frozen or mannequin-like AI copy. Do NOT loosen, soften or alter the pose's geometry itself — keep the exact stance from the reference; only the rendering must look natural and alive, never wooden.";
// Dos casos que hacían colapsar la pose a un parado rígido y frontal: (1) poses "apoyado
// contra la pared" — en el estudio no hay pared, así que el modelo se enderezaba y perdía el
// recline + el cruce de piernas; (2) refs de pose que son SILUETA/outline, difíciles de leer.
const POSE_SUPPORT_AND_SILHOUETTE = "IMPORTANT — do NOT collapse the pose into a plain upright stance. If the pose reference shows the person LEANING on a wall, ledge or surface that is NOT present in this studio, reproduce the SAME body geometry as a FREE-STANDING pose: keep the torso lean/tilt, the crossed or staggered legs, the ankle cross, the hip/weight shift and the relaxed slouch EXACTLY — you may plant the weight-bearing foot so the figure is self-supporting, but do NOT straighten up, do NOT square the shoulders to camera and do NOT lose the lean or the leg-cross just because there is nothing to lean on. If the pose reference is a SILHOUETTE, outline or flat low-detail shape, read the body geometry from its CONTOUR — limb angles, crossed legs, hip and shoulder line, torso lean, head tilt — and reproduce that stance precisely. The output must keep the reference's relaxed, casual, asymmetric energy, never a stiff frontal catalog stance.";

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
    description: "Standing naturally with weight shifted onto one leg (the other knee softly relaxed), a subtle easy asymmetry — for a woman a gentle waist break, for a man a casual grounded weight-shift. One hand resting lightly at the hip/pocket, the other arm hanging naturally at the side. Shoulders relaxed. Head facing camera with a relaxed, confident, effortless expression.",
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

  // ── FEMENINO · PLANOS AMERICANOS (medium/waist-up) — cool, cancheras, naturales.
  // Curadas 1×1 de las refs de Koxis (2026-07). Editorial off-duty, nunca tiesas.
  am_hands_on_hips: { label: "Am · Manos en cintura", description: "Medium shot, framed from mid-thigh up. Both hands resting on the hips/waistband, elbows relaxed out to the sides, weight shifted onto one leg so the hips break naturally. Head dipped slightly, soft cool gaze just off-camera. Effortless, confident, candid-between-shots energy." },
  am_hand_pocket_cocked: { label: "Am · Mano bolsillo, cadera", description: "Medium shot. One hand slipped into the front pocket, the opposite hip cocked out, the other arm hanging loose and relaxed. Shoulders easy, chin level, casual cool gaze to camera. Unposed street-editorial feel." },
  am_one_hand_hip: { label: "Am · Una mano a la cadera", description: "Medium shot. One hand resting on the hip, the other arm relaxed at the side, weight clearly on one leg with a soft waist break. Head turned slightly, relaxed confident expression. Elegant and natural." },
  am_arm_across_lapel: { label: "Am · Brazo cruzado/solapa", description: "Medium shot. One hand in the pocket, the other arm crossing softly over the front of the body to hold the opposite lapel or forearm, shoulders relaxed. Cool composed editorial gaze — refined and understated." },
  am_hands_pockets_tilt: { label: "Am · Manos bolsillos, tilt", description: "Medium shot. Both hands in the front pockets, shoulders loose and dropped, head tilted gently to one side. Relaxed, oversized, off-duty cool with a soft natural gaze." },
  am_adjust_neckline: { label: "Am · Ajustando cuello", description: "Medium shot. One hand raised near the collar/neckline as if lightly adjusting it, the other arm relaxed, chin lifted a touch, gaze away. Chic, graceful, in-motion feel." },
  am_profile_hand_hip: { label: "Am · Perfil, mano cadera", description: "Medium shot, body in soft 3/4-to-profile. One hand on the hip, neck long, weight forward on the front leg, looking down or away with a calm elongated line. Editorial and poised." },
  am_crossed_soft: { label: "Am · Brazos cruzados suave", description: "Medium shot. Arms loosely folded at the waist (relaxed, not tight), weight on one leg, one foot slightly turned out. Chin a touch up, relaxed direct gaze. Grounded, confident, natural." },

  // ── FEMENINO · PLANOS ENTEROS (full body) — random pero curadas, naturales.
  fb_walk_stride: { label: "Full · Caminando", description: "Full body, mid-stride walking toward the camera, one leg forward with a soft knee bend and the back foot pushing off. Arms swinging naturally and relaxed, subtle forward lean, candid cool expression — captured in motion." },
  fb_straight_minimal: { label: "Full · Minimal recta", description: "Full body, standing tall and relaxed facing camera, arms hanging naturally at the sides, feet close together or with one ankle slightly crossed in front. Clean, minimal, quietly confident, soft natural gaze." },
  fb_hands_pockets_lean: { label: "Full · Manos bolsillos, lean", description: "Full body, both hands tucked in the front pockets, weight shifted onto one leg with a relaxed hip and a gentle lean. Shoulders easy, head slightly tilted, casual off-duty cool." },
  fb_hand_pocket_relaxed: { label: "Full · Una mano bolsillo", description: "Full body, one hand in the front pocket, the other arm loose at the side, weight on one leg. Relaxed elongated posture, calm natural gaze — effortless catalog cool." },
  fb_hands_pockets_down: { label: "Full · Manos bolsillos, cabeza baja", description: "Full body, both hands in pockets, head dipped slightly down, weight even but soft. Understated, quietly moody-cool, natural." },
  fb_wide_relaxed: { label: "Full · Relajada abierta", description: "Full body, standing with feet a touch apart and weight easy, one hand grazing the hip or thigh, the other relaxed. Long natural line, soft confident expression." },
  fb_wrap_waist: { label: "Full · Manos a la cintura", description: "Full body, hands meeting softly at the waist as if lightly holding or tying the garment, weight on one leg, shoulders relaxed, elongated. Graceful and natural." },

  // ── MASCULINO · PLANOS AMERICANOS — grounded, squared shoulders, casual cool.
  // SIN waist break, SIN cadera afuera, SIN S-curve (eso lee femenino). Peso firme, postura sólida.
  amm_hands_pockets: { label: "Am(H) · Manos bolsillos", description: "Medium shot, mid-thigh up. Both hands in the front pockets, shoulders relaxed, weight clearly shifted onto ONE leg with a subtle masculine hip break (one hip a touch higher, the other knee soft) and an easy casual lean. Chin level, calm confident gaze. Relaxed, natural, masculine cool — not stiff or square." },
  amm_one_hand_pocket: { label: "Am(H) · Una mano bolsillo", description: "Medium shot, mid-thigh up. ONE hand slipped into the front pocket (thumb often left out), the other arm hanging naturally at the side. Weight clearly shifted onto ONE leg with a subtle relaxed hip break and an easy casual lean (the other knee soft) — never square or stiff-frontal. Shoulders relaxed, calm direct gaze. Clean, minimal, effortless menswear." },
  amm_arms_crossed: { label: "Am(H) · Brazos cruzados", description: "Medium shot. Arms crossed over the chest, loose and relaxed (not tense or puffed), shoulders broad and squared, feet planted. Direct grounded gaze, quietly confident." },
  amm_hand_pocket_lean: { label: "Am(H) · Mano bolsillo, lean", description: "Medium shot. One hand in the pocket, a slight relaxed lean of the torso, shoulders dropped and easy, weight on one leg. Casual off-duty masculine cool, natural gaze." },
  amm_adjust_sleeve: { label: "Am(H) · Ajustando manga", description: "Medium shot. One hand adjusting the opposite cuff/sleeve across the front, head dipped slightly toward the hands, shoulders relaxed. Focused, candid, understated." },
  amm_hand_neck: { label: "Am(H) · Mano a la nuca", description: "Medium shot. One hand raised to the back of the neck/head in a relaxed candid gesture, the other at the side, weight easy. Natural, unposed, cool." },
  amm_profile_pockets: { label: "Am(H) · Perfil, bolsillos", description: "Medium shot, body in soft 3/4-to-profile. Hands in the front pockets, shoulders squared, weight forward on the front leg, looking off-camera. Grounded, editorial, masculine." },
  amm_thumbs_pockets: { label: "Am(H) · Pulgares en bolsillos", description: "Medium shot. Thumbs hooked over the edge of the front pockets, fingers relaxed, shoulders broad and easy, solid stance. Confident, casual, grounded." },

  // ── MASCULINO · PLANOS ENTEROS — full body, grounded y natural.
  fbm_walk: { label: "Full(H) · Caminando", description: "Full body, mid-stride walking toward camera, natural masculine gait — one leg forward with a soft knee bend, back foot pushing off, arms swinging relaxed (or one hand in pocket). Solid, easy, cool in motion." },
  fbm_straight: { label: "Full(H) · Relajada natural", description: "Full body facing camera, weight clearly shifted onto ONE leg (the other knee soft and relaxed) so the hips break subtly — an easy casual masculine stance with a slight lean, shoulders relaxed. Arms loose at the sides, calm natural direct gaze. Effortless clean menswear — natural, never square, upright-symmetric or stiff." },
  fbm_hands_pockets: { label: "Full(H) · Manos bolsillos", description: "Full body, both hands tucked in the front pockets (thumbs sometimes out), weight clearly on ONE leg with a subtle relaxed hip break and easy lean, shoulders relaxed. Casual, minimal, masculine cool, calm gaze — not stiff or frontal-square." },
  fbm_one_pocket: { label: "Full(H) · Una mano bolsillo", description: "Full body facing camera, ONE hand slipped into the front pocket, the other arm hanging naturally at the side, weight clearly shifted onto one leg with a subtle relaxed hip break and casual lean (the other knee soft). Shoulders relaxed, calm direct gaze — the classic effortless menswear pose, natural not rigid." },
  fbm_back_pockets: { label: "Full(H) · Espalda, manos bolsillos", description: "Full body, back to the camera showing the full back of the garment, both hands relaxed in the front (or back) pockets so the arms don't cover the garment, standing grounded and upright, hair natural. Clean masculine back shot; head faces away, face not needed." },
  fbm_arms_crossed: { label: "Full(H) · Brazos cruzados", description: "Full body, standing with arms crossed over the chest (relaxed), feet planted shoulder-width, shoulders broad. Grounded, confident, direct." },
  fbm_lean_relaxed: { label: "Full(H) · Lean relajado", description: "Full body, weight on one leg with a slight relaxed lean, one hand in the pocket, the other loose, shoulders dropped. Casual, cool, masculine." },
  fbm_hand_neck: { label: "Full(H) · Mano a la nuca", description: "Full body, one hand raised to the back of the neck in a relaxed candid gesture, the other in a pocket or at the side, weight easy. Natural, unposed." },
};

export const DEFAULT_POSE_PRESET = "auto";
const POSE_KEYS = Object.keys(POSE_PRESETS);

// Pools de poses por tipo de plano — la rotación "auto" elige DENTRO del pool
// correcto para el encuadre, no una pose al azar. Garantiza coherencia: un plano
// de espalda nunca recibe una pose frontal, los back shots mantienen la cara
// visible (over-shoulder), y el americano prioriza poses de manos/torso que leen
// bien en un crop medio. Si un shot no está mapeado, cae al rol completo.
// "auto" rota DENTRO del pool correcto para el encuadre Y el GÉNERO. Las poses femeninas leen
// mal en un hombre (waist break, cadera) y viceversa → pools separados. El género se elige con
// un checkbox en el tool (config.ecomGender). Back es neutro (sirve para ambos).
const POSE_POOLS_FEMALE: Record<string, string[]> = {
  model_front:    ["fb_straight_minimal", "fb_hands_pockets_lean", "fb_hand_pocket_relaxed", "fb_walk_stride", "fb_hands_pockets_down", "fb_wide_relaxed", "fb_wrap_waist"],
  model_34:       ["am_profile_hand_hip", "profile_34", "fb_hands_pockets_lean", "fb_hand_pocket_relaxed", "fb_walk_stride"],
  model_side:     ["profile_34", "am_profile_hand_hip", "fb_hands_pockets_lean", "fb_hand_pocket_relaxed", "fb_walk_stride"],
  model_american: ["am_hands_on_hips", "am_hand_pocket_cocked", "am_one_hand_hip", "am_arm_across_lapel", "am_hands_pockets_tilt", "am_adjust_neckline", "am_profile_hand_hip", "am_crossed_soft"],
  model_medium:   ["am_hands_on_hips", "am_hand_pocket_cocked", "am_one_hand_hip", "am_arm_across_lapel", "am_hands_pockets_tilt", "am_adjust_neckline", "am_crossed_soft"],
  model_back:     ["back_clean", "back_over_shoulder", "back_hand_to_neck", "back_walk_away"],
};
const POSE_POOLS_MALE: Record<string, string[]> = {
  model_front:    ["fbm_one_pocket", "fbm_hands_pockets", "fbm_straight", "fbm_walk", "fbm_lean_relaxed", "fbm_arms_crossed", "fbm_hand_neck"],
  model_34:       ["amm_profile_pockets", "fbm_one_pocket", "fbm_hands_pockets", "fbm_walk"],
  model_side:     ["amm_profile_pockets", "fbm_one_pocket", "fbm_hands_pockets", "fbm_lean_relaxed", "fbm_walk"],
  model_american: ["amm_one_hand_pocket", "amm_hands_pockets", "amm_hand_pocket_lean", "amm_thumbs_pockets", "amm_arms_crossed", "amm_profile_pockets", "amm_adjust_sleeve", "amm_hand_neck"],
  model_medium:   ["amm_one_hand_pocket", "amm_hands_pockets", "amm_hand_pocket_lean", "amm_thumbs_pockets", "amm_arms_crossed", "amm_adjust_sleeve", "amm_hand_neck"],
  model_back:     ["fbm_back_pockets", "back_clean", "back_walk_away"],
};

// Close-ups: NO reciben pose preset. Las poses están escritas "full body in frame",
// que contradice un crop cerrado. Para estos planos manda el encuadre (la framing
// clause ya describe el crop y, en primer plano, la cara mirando a cámara).
const CLOSEUP_SHOTS = new Set(["model_detail", "model_detail_lower"]);

// Variedad para "On-model · Detalle prenda" (model_detail): rota entre tipos de detalle cool
// (curados del board de refs de Koxis) en vez de siempre el mismo close-up frontal de pecho.
// Con "auto" y cantidad >1, cada instancia toma uno distinto. Todos son close-ups (sin cara
// necesaria), enfocados en la prenda como se usa.
const DETAIL_FRAMINGS: string[] = [
  "Tight CLOSE-UP on the garment as worn, cropped to the CHEST / UPPER TORSO — show the fabric, texture, print, neckline, collar and stitching. No face needed.",
  "CLOSE-UP on the SIDE / shoulder of the garment in soft profile: the shoulder line, sleeve head, side seam and a bit of the neckline, with hair falling naturally. Crop tight to that area, no face needed.",
  "CLOSE-UP on a FASTENING detail: the model's hands lightly holding or adjusting a button / zip / tie at the front, showing the closure, cuffs and any worn jewelry (ring, bracelet). Crop to the hands and the garment front, no face.",
  "CLOSE-UP on the WAIST / HIP area from a slight side-back angle: the waistband, belt, pocket and how the garment meets the trousers, one hand resting near the hip. Crop tight to the waist zone, no face.",
  "CLOSE-UP on the BACK detail of the garment: the back neckline, seam, tie or opening, hair swept to one side, maybe a hand resting on the opposite arm. Crop tight to the upper back, no face.",
  "CLOSE-UP on a SLEEVE / CUFF detail as worn: the forearm and cuff, the hand relaxed or tucked into a pocket, fabric texture and any trim. Crop to that area, no face.",
];

// Shots on-model donde la CARA debe quedar en cuadro sí o sí. Si la pose ref viene
// recortada al cuello/pecho, NO copiamos ese crop — extendemos hacia arriba para no
// decapitar a la modelo. (detail / detail_lower / back no necesitan cara.) Reportado:
// pasaron una pose street-style cortada al cuello y salió sin cabeza.
const FACE_REQUIRED_SHOTS = new Set(["model_front", "model_34", "model_side", "model_american", "model_medium"]);
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
function getPoseDescription(presetKey: string | undefined, shotId: string, nth: number, gender: "male" | "female" = "female"): string | null {
  if (!presetKey || presetKey === "upload" || presetKey === "") return null;
  if (CLOSEUP_SHOTS.has(shotId)) return null;
  const pools = gender === "male" ? POSE_POOLS_MALE : POSE_POOLS_FEMALE;
  const pool = pools[shotId] || POSE_KEYS;
  const base = presetKey === "auto"
    ? POSE_PRESETS[pool[nth % pool.length]].description
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
  // Proveedor del modelo de imagen (selector). Default temporal: Nano Banana vía Google
  // directo (cuenta Monks). "nano-banana-2" = el de siempre por Fal. Ver ecomImageModel.
  const imageModel = ((cfg.ecomImageModel as string) || "nano-banana-google") as ImageModel;
  // Pose en 1 paso (toggle): en vez de vestir → transferir (2 calls), compone identidad +
  // pose + prendas en UNA sola call. Más rápido/barato. DEFAULT 1 paso (el 2-pasos cuesta el
  // doble) — solo va a 2-pasos si el flag es explícitamente false. Ver branch i===0 y 2-step.
  const poseSinglePass = cfg.ecomPoseSinglePass !== false;

  // Separación productos vs accesorios — el usuario marca cuáles son "Solo styling"
  // (zapatillas, collar, gorra) en la UI. Esos NO generan flats propios pero SÍ
  // se usan como ref visual en on-model para que el outfit quede completo.
  const accessoryIds = (cfg.ecomAccessoryIds as string[]) || [];
  const allSelectedClothing = (activeBrand.clothing || []).filter((c) => config.selectedClothingIds.includes(c.id));
  const garments = allSelectedClothing.filter((c) => !accessoryIds.includes(c.id));
  const accessories = allSelectedClothing.filter((c) => accessoryIds.includes(c.id));
  const selectedProduct = (activeBrand.products || []).find((p) => p.id === config.selectedProductId);
  // PRODUCTO PRINCIPAL (hero): cuál prenda es el foco de la ficha. Si está seteado, los flats
  // muestran SOLO el hero, el detalle apunta al hero, y el on-model prioriza que se vea bien.
  // Si no, comportamiento clásico (todo el look). Ver heroFocusClause / flatGarments / detalle.
  const heroClothingId = (config as unknown as { ecomHeroClothingId?: string }).ecomHeroClothingId || "";
  const heroGarment = heroClothingId ? garments.find((g) => g.id === heroClothingId) : undefined;
  const heroFocusClause = heroGarment
    ? ` HERO PRODUCT — this shot primarily showcases the "${heroGarment.name}": keep it clearly visible, well-framed and in sharp focus; any other garments/accessories are secondary styling and must not steal focus from it.`
    : "";
  // Para el on-model: usamos TODAS las prendas (productos + accesorios) — el modelo
  // tiene que verse vestido con el outfit completo, no solo el producto principal.
  const garmentUrls = garments.map((g) => g.imageUrl).filter(Boolean);
  const accessoryUrls = accessories.map((a) => a.imageUrl).filter(Boolean);
  // Foto de ESPALDA de cada garment (extra con label "back"/"espalda"/"atrás"). Se pasa como
  // ref de garment SOLO en el shot on-model de espalda, para que Nano renderice la parte de
  // atrás REAL de la prenda en vez de inventarla desde el frente. Reportado: "le subí la foto
  // de atrás y no la respetó" — el on-model nunca la consumía (solo el flat).
  const backPhotoOf = (g: { images?: Array<{ imageUrl?: string; label?: string }> }): string | undefined =>
    (g.images || []).find((im) => im.imageUrl && /back|espalda|atr[aá]s|dorso/.test((im.label || "").toLowerCase()))?.imageUrl || undefined;
  const garmentBackUrls = garments.map(backPhotoOf).filter((u): u is string => !!u);
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
  // Género del modelo (checkbox en el tool) → habilita el set de poses correcto. Default femenino.
  const ecomGender: "male" | "female" = (cfg.ecomGender as string) === "male" ? "male" : "female";
  // Fondo por FOTO (dataUrl) — gana sobre todo: el modelo se ubica en esa escena.
  const userBgUrl = (cfg.ecomBackgroundImage as string) || undefined;
  // Default: para el preset "white" sin fondo custom, usamos el seamless real que le gustó a
  // Koxis (pasado como imagen ref, no como texto). El upload del usuario siempre gana.
  const usingDefaultBg = !userBgUrl && studioKey === "white";
  const bgImageUrl = userBgUrl;   // solo el upload del usuario
  // REPINTADO de fondo (no composite/recorte): Nano genera todo (modelo + fondo gris + sombra
  // natural), y después repintamos SOLO los píxeles del fondo al #ededed EXACTO — sin recortar
  // a la persona (sin halo) y conservando la sombra (se desplaza el tono del fondo, no se rellena
  // plano). Garantiza #ededed idéntico en todos los shots. Solo con el fondo default, on-model.
  const STUDIO_BG_COLOR = "#ededed";
  const compositeToSeamless = async (imgUrl: string): Promise<string> =>
    (usingDefaultBg && imgUrl) ? await repaintBgToColor(imgUrl, STUDIO_BG_COLOR) : imgUrl;
  let studioClauseBase: string;
  if (bgImageUrl) {
    studioClauseBase = usingDefaultBg
      ? "Use the EXACT studio backdrop shown in the BACKGROUND reference image — a soft, homogeneous light grey-white seamless studio sweep. Match its exact tone, its subtle natural gradient and its gentle floor sweep; the backdrop is flat and even, never pure #FFFFFF and never blown-out. The model stands ON this seamless studio backdrop, evenly lit and embedded in the same soft light — never cut-out, pasted-on or floating."
      : "Place the model in the exact BACKGROUND / setting shown in the BACKGROUND reference image — same scene, surface, colors and lighting. The model stands naturally within that environment.";
  } else if (studioKey === "color") {
    const color = ((cfg.ecomStudioColor as string) || "#efefef").trim();
    studioClauseBase = `Seamless solid ${color} studio background — uniform and clean, soft even studio lighting, no gradient and no other objects on the backdrop.`;
  } else if (studioKey === "custom") {
    studioClauseBase = config.objective?.trim() || STUDIO_STYLES.white.clause;
  } else {
    studioClauseBase = STUDIO_STYLES[studioKey]?.clause || STUDIO_STYLES.white.clause;
  }
  // La sombra de contacto + el aislamiento de fondo van en los shots ON-MODEL (la modelo
  // está de pie). Los flats van APOYADOS → sin grounding shadow (ver studioClauseFlat).
  const studioClause = `${studioClauseBase} ${GROUNDING_SHADOW} ${BG_ISOLATION} ${BG_CONSISTENCY}`;
  const studioClauseFlat = `${studioClauseBase} ${FLAT_NO_SHADOW} ${BG_ISOLATION} ${BG_CONSISTENCY}`;
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
    if (bgImageUrl) { urls.push(bgImageUrl); desc.push(`Image ${idx}: BACKGROUND (CRITICAL — this defines the ENTIRE backdrop of the output). The output background MUST BE this exact studio backdrop, reproduced faithfully — same tone, same subtle gradient, same floor sweep and horizon line. Place the model in front of it. Do NOT replace it with a plain flat white, a pure #FFFFFF, or a different/invented studio; do NOT simplify or brighten it away. It contains NO person — copy only the backdrop.`); idx++; }
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
  const poseRefCuration = new Map<string, { pose: string; ignore: string; framing: string }>();
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
    // ¿Es el shot on-model de espalda? Si sí, inyectamos la foto de atrás real de la prenda.
    const isBackShot = sid === "model_back";
    // Agrega la(s) foto(s) de espalda de la prenda como ref de garment SOLO en el shot de
    // espalda. Devuelve el nuevo idx. Sin esto, la parte de atrás de la prenda se inventa.
    const pushGarmentBacks = (urlArr: string[], descArr: string[], nextIdx: number): number => {
      if (!isBackShot) return nextIdx;
      for (const u of garmentBackUrls) {
        urlArr.push(u);
        descArr.push(`Image ${nextIdx}: GARMENT BACK VIEW — the ACTUAL back of this same product. This IS a BACK shot: render the garment's back to MATCH this reference exactly (its real pockets, seams, waistband, yoke, wash and colour). Do NOT invent the back from the front view. ${PIXEL_FIDELITY}`);
        nextIdx++;
      }
      return nextIdx;
    };

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
    if (i === 0 && shotPoseUrl && !poseSinglePass) {
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
        const step1Prompt = `Professional e-commerce studio fashion photograph. Full-body shot of the IDENTITY person wearing the exact GARMENT(S) and ACCESSORIES from the references. ${BODY_PROPORTIONS} ${NATURAL_ENERGY} ${studioClause} Clean composition, model facing the camera. ${cameraLighting} ${IDENTITY_LOCK} ${FACE_REALISM} ${FABRIC_REALISM} ${GARMENT_ORIENTATION} ${PIXEL_FIDELITY} ${REALISM_NEGATIVES}${NO_TEXT}\n\nREFERENCE IMAGES:\n${step1Desc.join("\n")}`;
        // Step 1 es INTERMEDIO (solo alimenta al pose-transfer del step 2, que es el
        // entregable). No gastamos 4K acá: si el user pidió 4K, el vestir va en 2K y el
        // step 2 sí en 4K. Ahorra ~mitad del costo/tiempo del 4K sin perder la imagen final.
        const step1Res = config.resolution === "4K" ? "2K" : config.resolution;
        const job1 = await createImageEdit(step1Urls, step1Prompt, config.aspectRatio, step1Res, imageModel);
        const res1 = await pollImageGen(job1.request_id);
        const dressedAvatar = res1.image_url || "";
        if (!dressedAvatar) throw new Error("Step 1 (dressing) returned no image");

        // ── Step 2: POSE TRANSFER — SOLO 2 imágenes ──────────────────────
        // Patrón clásico de Nano Banana: 1 modelo + 1 pose ref → mismo modelo
        // en la nueva pose. Prompt MUY explícito separando qué viene de cada
        // imagen — el modelo tiende a "agarrar todo" de la pose ref (incluyendo
        // ropa y fondo), por eso enumeramos exhaustivamente qué tomar de cada una.
        const step2Urls = bgImageUrl ? [dressedAvatar, shotPoseUrl, bgImageUrl] : [dressedAvatar, shotPoseUrl];
        const step2Prompt = `This is a POSE TRANSFER. ${POSE_FIDELITY} ${POSE_INHABIT} ${POSE_SUPPORT_AND_SILHOUETTE}

${bgImageUrl ? "Three images:" : "Two images:"}

IMAGE 1 — the source. It contains the person, their identity and their outfit${bgImageUrl ? "" : " and the studio"}.
IMAGE 2 — the pose reference. ONLY a body posture reference. EVERYTHING ELSE in image 2 (clothing, accessories, jewelry, tattoos, piercings, makeup, skin marks, hair, identity, background, lighting, styling) is completely IRRELEVANT and must be IGNORED.${bgImageUrl ? "\nIMAGE 3 — the BACKGROUND reference: the EXACT studio backdrop the output must sit on (a soft, homogeneous light grey-white seamless studio sweep with its gentle floor sweep). Reproduce its tone, gradient and floor exactly. It contains NO person." : ""}

TAKE FROM IMAGE 1 (do NOT change any of this):
- Face, hair, skin tone, head shape, age
- Skin condition (smooth/clean) — same exact skin as image 1, NO new tattoos, NO new birthmarks, NO new piercings, NO new jewelry that isn't already in image 1
- Every single garment the person is wearing (top, bottom, layers) — colors, patterns, fabric, fit, cut, length
- Every accessory that exists in image 1 (scarves, necklaces, bags, belts, hats, shoes, jewelry) — exactly as they appear
- Background and studio lighting: ${bgImageUrl ? "the studio backdrop MUST be IDENTICAL to IMAGE 3 (the background reference) — same exact tone, same gradient, same floor sweep and horizon position. Do NOT invent a new backdrop or drift from image 3" : "keep the EXACT studio backdrop from image 1 — same tone, same gradient, same floor. Do NOT introduce, invent or drift to a different background"}. The backdrop must stay pixel-consistent across every shot in the pack.

TAKE FROM IMAGE 2 (the body POSTURE AND the framing — image 2 is the source of truth for how the shot looks):
- Overall body posture: stance, weight distribution, torso lean
- LEGS AND LOWER BODY (as important as the arms): the exact position of each leg — which leg bears the weight, how much each knee is bent, feet placement and angle, legs together / apart / crossed / staggered. Copy the lower body as precisely as the upper body; do NOT default to a plain straight-legged stance.
- Arm position and hand placement
- Torso angle and shoulder position
- Head tilt, head rotation, gaze direction
- ${CLOSEUP_SHOTS.has(sid)
      ? `Camera FRAMING: this is a TIGHT GARMENT CLOSE-UP — ${shot.framing} KEEP this close crop. Take ONLY the body orientation/angle from image 2, NOT its framing; do NOT open the shot to full body.`
      : `Camera FRAMING and CROP: match image 2's EXACT zoom and distance. If image 2 is a full-body shot the output is full-body; if it is a waist-up / medium / close shot, the output is cropped the same way. Do NOT re-frame to a different crop.${faceRequired ? " EXCEPTION: never crop the model's head/face out — if image 2 cuts the head off, extend the framing upward so the whole face stays visible." : ""}`}

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

Output: the person from image 1, EXACTLY as they appear in image 1 (same skin, same jewelry, same clothing, same accessories, same face), re-posed to match the body geometry of image 2. The face must stay perfectly recognizable as the person in image 1 — do NOT let image 2's face leak in. ${BODY_PROPORTIONS} ${FACE_REALISM} ${PIXEL_FIDELITY} ${REALISM_NEGATIVES}${NO_TEXT}`;
        const job2 = await createImageEdit(step2Urls, step2Prompt, config.aspectRatio, config.resolution, imageModel);
        const res2 = await pollImageGen(job2.request_id);
        const url2 = res2.image_url || "";
        if (url2) anchorUrl = url2;   // anchor RAW (contexto para shots siguientes)
        const deliver2 = url2 ? await compositeToSeamless(url2) : url2;
        generated[inst.key] = { id: inst.key, url: deliver2, label: onModelLabelAnchor, downloadName: primaryGarmentName, prompt: step2Prompt, status: res2.status === "failed" ? "failed" : "done", error: res2.status === "failed" ? (res2.error || POLL_FAILED_MSG) : undefined };
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
      // Pose en 1 paso: la pose ref entra en ESTA misma call (después de IDENTITY, antes de las
      // prendas). El branch 2-pasos ya salió arriba (continue), así que si hay shotPoseUrl acá
      // es porque el toggle "1 paso" está activo (o es un shot 2+ que ya usa otro branch).
      if (shotPoseUrl) {
        const curSP = poseRefCuration.get(shotPoseUrl) || { pose: "", ignore: "", framing: "" };
        urls.push(shotPoseUrl);
        desc.push(`Image ${idx}: POSE REFERENCE — copy ONLY the body posture, body orientation and camera framing${curSP.pose ? ` (${curSP.pose})` : ""}. EVERYTHING ELSE in this image is a DECOY and must be COMPLETELY DISCARDED — its clothing${curSP.ignore ? ` (specifically: ${curSP.ignore})` : ""}, face, hair, skin, identity, accessories, props and background must NOT appear in the output. The person's identity comes ONLY from the IDENTITY image; the garments come ONLY from the GARMENT reference(s).`);
        idx++;
      }
      garmentUrls.forEach((u) => { urls.push(u); desc.push(`Image ${idx}: GARMENT (hero product) — the model WEARS this exact item. ${PIXEL_FIDELITY}`); idx++; });
      idx = pushGarmentBacks(urls, desc, idx);
      accessoryUrls.forEach((u) => { urls.push(u); desc.push(`Image ${idx}: STYLING ACCESSORY — the model also wears/has this exact item as part of the complete outfit. ${PIXEL_FIDELITY}`); idx++; });
    } else if (instPoseRef) {
      // Shot 2+ CON pose ref específica. PRIORIDAD INVERTIDA (validado en el Lab): el SUJETO
      // (persona + prenda + estudio) es el ANCHOR = Image 1 (fuente de verdad), y la pose ref
      // entra como Image 2 = SOLO postura + encuadre, con los decoys NOMBRADOS a ignorar.
      // Antes la pose ref era la "base image" (Image 1) y su ropa se filtraba — el fallo #1.
      const cur = poseRefCuration.get(instPoseRef) || { pose: "", ignore: "", framing: "" };
      urls.push(anchorUrl);
      desc.push(`Image ${idx}: SUBJECT — the SOURCE OF TRUTH for WHO the person is, the EXACT garment(s) and accessories they wear, and the studio backdrop + lighting. The output MUST keep this exact person wearing this exact outfit on this exact studio. This is what the shot is OF.`);
      idx++;
      urls.push(instPoseRef);
      desc.push(CLOSEUP_SHOTS.has(sid)
        ? `Image ${idx}: POSE REFERENCE — copy ONLY the body POSTURE and body ORIENTATION (which way the body is turned)${cur.pose ? ` (${cur.pose})` : ""}. This IS a TIGHT GARMENT CLOSE-UP shot: KEEP the close crop defined by this shot's framing — do NOT copy the framing/zoom/distance from this pose image and do NOT open the shot to full body or medium just because the pose image shows more of the body. EVERYTHING ELSE in this image is a DECOY and must be COMPLETELY DISCARDED — the person's face/hair/skin/identity, ALL their clothing${cur.ignore ? ` (specifically: ${cur.ignore})` : ""}, their accessories, anything they hold, and the background/setting. Take posture and orientation only, nothing else.`
        : `Image ${idx}: POSE REFERENCE — copy the body posture, the body ORIENTATION (which way the body is turned) AND the camera FRAMING/CROP from this image${cur.pose ? ` (${cur.pose})` : " (body position, stance, arm/hand placement, head tilt, gaze, how the body is rotated, and how tightly the shot is cropped)"}. This image is the SOURCE OF TRUTH for the crop/zoom: if it is a medium / waist-up shot, output the same medium crop (do NOT extend to full body). EVERYTHING ELSE in this image is a DECOY and must be COMPLETELY DISCARDED — it must NOT appear in the output: the person's face/hair/skin/identity, ALL their clothing${cur.ignore ? ` (specifically: ${cur.ignore})` : ""}, their accessories, anything they hold, and the background/setting. The person here is only a posing stand-in; take the posture, orientation and framing, nothing else.`);
      idx++;
      // Avatar como fuente de identidad — DEBE ganar sobre la cara de la pose ref.
      if (avatar?.imageUrl) {
        urls.push(avatar.imageUrl);
        desc.push(`Image ${idx}: FACE REPLACEMENT (IDENTITY) — ABSOLUTE HIGHEST PRIORITY. The output face/head/hair MUST be this exact person, overriding whatever face is in the POSE reference. ${IDENTITY_LOCK} ${FACE_REALISM}`);
        idx++;
      }
      garmentUrls.forEach((u) => { urls.push(u); desc.push(`Image ${idx}: GARMENT REFERENCE — the model wears THIS exact item (this is the real product, NOT whatever the pose reference person wears). Pixel-perfect. ${PIXEL_FIDELITY}`); idx++; });
      idx = pushGarmentBacks(urls, desc, idx);
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
      idx = pushGarmentBacks(urls, desc, idx);
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
    const poseCur = shotPoseUrl ? (poseRefCuration.get(shotPoseUrl) || { pose: "", ignore: "", framing: "" }) : { pose: "", ignore: "", framing: "" };
    // Prioridad de pose AL FRENTE del prompt (primacy) — con pose ref, el modelo tiende a
    // diluirla entre las demás refs (sobre todo en single-pass). Este lead + el poseOverride del
    // final la martillan por los dos lados. Incluye la descripción granular que sacó Gemini.
    const posePriorityLead = shotPoseUrl
      ? `POSE FIDELITY IS THE #1 PRIORITY of this shot (second only to keeping the exact identity): reproduce the POSE REFERENCE's body posture, orientation and every limb placement EXACTLY — a faithful motion-capture of that stance, not an approximation. Do NOT default to a plain symmetric frontal stance.${poseCur.pose ? ` The exact pose to reproduce: ${poseCur.pose}` : ""} `
      : "";
    // Los shots de detalle/close-up conservan SIEMPRE su encuadre cerrado — la pose ref NO los
    // abre a cuerpo entero (solo aporta orientación/postura). Ver framingClause abajo.
    const poseFramesShot = !!shotPoseUrl && !CLOSEUP_SHOTS.has(sid);
    const poseOverride = shotPoseUrl
      ? `

POSE-TRANSFER INSTRUCTIONS (keep the SUBJECT, borrow ONLY the pose):
- The output is a photorealistic e-commerce studio photo of the SUBJECT person wearing their EXACT garment(s) and accessories from the SUBJECT/GARMENT references, on the studio backdrop described above (${studioClause.trim()}).
- From the POSE REFERENCE, take ONLY the body POSTURE and body ORIENTATION: stance, torso angle, head tilt, gaze, arm and hand positions, LEG AND LOWER-BODY position (weight-bearing leg, knee bend, feet placement and angle — copy the legs as precisely as the arms, do NOT reset them to a plain straight stance). CRITICAL — reproduce the EXACT BODY ORIENTATION of the pose reference: if the person is turned to the side (de costado), in 3/4, in full profile or with their back to camera, the output MUST be turned the SAME way and the SAME amount, to the same side. Do NOT default the body to front-facing.${poseCur.pose ? ` The pose to reproduce: ${poseCur.pose}` : ""}
- ${poseFramesShot
      ? "The CROP / FRAMING comes from the POSE REFERENCE — it is the SOURCE OF TRUTH for the crop/zoom/distance. Reproduce the EXACT framing of the pose reference: if it is a medium / waist-up / American shot, crop the SAME way (do NOT extend to full body); if it is a LOWER-BODY / waist-DOWN crop (framed from the waist or hips down to the legs/feet, or a close detail of the bottom garment), output that SAME lower-body crop — do NOT add the torso or head and do NOT expand to full body; if it is full-body, output full-body; if it is tighter, crop tighter. Match the pose reference's zoom, distance and WHERE ON THE BODY it is cropped, precisely." + (faceRequired ? " Only exception: never crop the head/face out — if the pose ref cuts the head off, extend upward just enough to keep the whole face visible." : "")
      : "The CROP / FRAMING is defined by THIS shot's FRAMING instruction above (a tight garment close-up) — KEEP that close crop. The pose reference contributes ONLY body orientation/angle, NOT the framing: do NOT open the shot to full body just because the pose reference shows more of the body."}
- STRICTLY IGNORE everything else in the POSE reference — its clothing, hair, face, skin, accessories, props/objects held, and background are ALL a DECOY and must NOT appear in the output.${poseCur.ignore ? ` Specifically discard: ${poseCur.ignore}.` : ""} The garment the model wears comes ONLY from the GARMENT reference (the real product), never from the pose reference person.
- ${IDENTITY_LOCK}
- ${FACE_REALISM}
- ${GARMENT_ORIENTATION}
- Do NOT copy the POSE reference's LIGHTING, shadows, exposure or color cast. The output is lit by the clean studio light described above (soft, even); the only shadow is a subtle soft shadow on the FLOOR beneath the feet.${faceRequired ? " Never crop the model's head/face out — if the pose framing cuts the head off, extend the framing upward so the whole face stays visible." : ""} ${POSE_FIDELITY} ${POSE_INHABIT} ${POSE_FULL_BODY} ${POSE_SUPPORT_AND_SILHOUETTE}${faceRequired ? ` ${FACE_MUST_STAY}` : ""}
- ${BODY_PROPORTIONS}`
      : "";
    // Si NO hay pose ref imagen, inyectamos un preset textual de pose (rota
    // entre 8 si "auto", o usa la elegida por el user). Eso evita que la
    // modelo quede dura/estática y le da variedad editorial a la galería.
    const poseDesc = !shotPoseUrl ? getPoseDescription(posePreset, sid, inst.nth, ecomGender) : null;
    const presetPoseClause = poseDesc ? ` POSE: ${poseDesc}` : "";
    const identityClause = avatar?.imageUrl ? `${IDENTITY_LOCK} ` : "";
    // Encuadre: si hay pose ref imagen, ELLA manda el crop (pedido Koxis: "la pose es fuente
    // de verdad, aunque sea un americano; si la ref es plano medio, hacelo plano medio"). Sin
    // pose ref, manda el framing del preset del shot.
    // EXCEPCIÓN: los shots de DETALLE/close-up (model_detail, closeup, detail_lower) SIEMPRE
    // conservan su encuadre cerrado — la pose ref NO debe abrirlos a cuerpo entero. Bug reportado:
    // "en detalle prenda le pasé una pose y me generó cuerpo entero de perfil".
    // (poseFramesShot ya está definido arriba, junto al poseOverride.)
    // "Detalle prenda" con auto y sin pose ref → rota entre los tipos de detalle curados
    // (side, fastening, waist, back, sleeve…) en vez de siempre el mismo close-up de pecho.
    const detailFramingBase = (sid === "model_detail" && posePreset === "auto" && !shotPoseUrl)
      ? DETAIL_FRAMINGS[inst.nth % DETAIL_FRAMINGS.length]
      : shot.framing;
    // Si hay hero product y es un detalle, el close-up es DEL hero (no de otra prenda del look).
    // Con HERO en un close-up, el hero MANDA el encuadre (no el "chest/torso" default de
    // model_detail, que apuntaba al medio aunque el hero fuera el pantalón). Encuadre decisivo
    // según DÓNDE vive la prenda hero. Reportado: "le dije pantalón y el detalle salió al medio".
    const effectiveFraming = (heroGarment && CLOSEUP_SHOTS.has(sid))
      ? `Tight CLOSE-UP detail OF the "${heroGarment.name}" specifically — this close-up is OF that exact product and NOTHING else. Crop TIGHTLY to that garment's most relevant detail (its own fabric, weave, seam, pocket, closure, waistband, hem, cuff or trim). Frame it WHERE that garment actually sits on the body: if it is a LOWER-BODY garment (trousers, pants, shorts, skirt) crop to the WAIST / HIP / THIGH area and do NOT crop to the chest; if it is an UPPER-BODY garment crop to the chest/torso; if footwear, crop to the feet. Do NOT default to the chest when the hero garment is not on the upper body. No face needed.`
      : detailFramingBase;
    const framingClause = poseFramesShot
      ? `FRAMING (MANDATORY — the POSE REFERENCE image is the SOURCE OF TRUTH for the crop/zoom): reproduce the EXACT camera framing, distance and crop of the pose reference. If the pose reference is a medium / waist-up / American shot, the output is cropped the SAME way — do NOT extend down to full body. If it is full-body, output full-body.${faceRequired ? " Only exception: never crop the head/face out — if the pose ref cuts the head, extend upward just enough to keep the whole face visible." : ""}`
      : `FRAMING (MANDATORY — defines the crop/zoom): ${effectiveFraming}`;
    const detailIdentityClause = !faceRequired ? `${IDENTITY_DETAIL} ` : "";
    // La toma "Pose custom" (model_custom) sigue la pose ref EXACTA (sin naturalizar); el resto,
    // energía natural. Es la toma dedicada a "seguí la pose tal cual la paso".
    const naturalOrStrict = (sid === "model_custom" && shotPoseUrl) ? STRICT_POSE : NATURAL_ENERGY;
    const prompt = `Professional e-commerce studio fashion photograph. ${posePriorityLead}${BODY_PROPORTIONS} ${naturalOrStrict} ${studioClause} ${framingClause}${presetPoseClause} ${wardrobe}${cameraLighting} ${identityClause}${detailIdentityClause}${FACE_REALISM} ${FABRIC_REALISM} ${GARMENT_ORIENTATION} ${PIXEL_FIDELITY} ${REALISM_NEGATIVES}${heroFocusClause}${NO_TEXT}${poseOverride}\n\nREFERENCE IMAGES:\n${desc.join("\n")}`;
    try {
      const job = urls.length ? await createImageEdit(urls, prompt, config.aspectRatio, config.resolution, imageModel) : await createTextToImage(prompt, config.aspectRatio, config.resolution, imageModel);
      const res = await pollImageGen(job.request_id);
      let url = res.image_url || "";
      if (i === 0 && url) anchorUrl = url;
      // SIN post-crop: el encuadre lo resuelve Nano NATIVO desde el prompt + la pose ref pasada
      // como input (como en el Lab). Recortar tiraba resolución (4K → ~2.4K) y calidad. La
      // fidelidad de encuadre ahora depende del prompt/framingClause y de la imagen de referencia.
      // Composite sobre el seamless real (fondo consistente) — solo con el fondo default.
      url = await compositeToSeamless(url);
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
  // Con hero seteado, los flats son SOLO del hero (ficha de un producto). Sin hero, todos.
  const flatGarments = heroGarment ? garments.filter((g) => g.id === heroGarment.id) : garments;
  const flatSubjects = flatGarments.length
    ? flatGarments.map((g) => ({ id: g.id, name: g.name, url: g.imageUrl, source: g }))
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
      const prompt = `Professional e-commerce product packshot of a single garment. ${studioClauseFlat} ${shot.framing} Show ONLY this one garment — no other clothing items. ${cameraLighting} ${FABRIC_REALISM} ${PIXEL_FIDELITY} ${REALISM_NEGATIVES}${NO_TEXT}\n\nREFERENCE IMAGES:\n${desc.join("\n")}`;
      try {
        const job = await createImageEdit(urls, prompt, config.aspectRatio, config.resolution, imageModel);
        const res = await pollImageGen(job.request_id);
        // MISMO fondo que los on-model: el flat también pasa por el repintado/aplanado a #ededed
        // (BiRefNet toma la prenda como foreground, el resto se lleva a #ededed exacto). Sin esto,
        // el flat quedaba con el fondo crudo de Nano y no matcheaba con las tomas on-model.
        const flatUrl = await compositeToSeamless(res.image_url || "");
        flatImages.push({ sid, id, url: flatUrl, label, downloadName, prompt, status: res.status === "failed" ? "failed" : "done", error: res.status === "failed" ? (res.error || POLL_FAILED_MSG) : undefined });
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
