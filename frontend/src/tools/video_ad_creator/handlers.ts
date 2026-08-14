/**
 * Video Ad Creator — Step Handlers
 * ─────────────────────────────────
 * Pipeline: script → images → review_images → voice → animate → render
 */

import type { StepHandler } from "../types";
import {
  generateToolPrompt, createImageEdit, createTextToImage, pollImageGen,
  generateTTSAndUpload, pollKlingVideo,
  createVeoVideo, pollVeoVideo,
  createSeedanceReferenceToVideo, pollSeedanceVideo,
  createFalLipSync, pollFalLipSync,
  concatVideos,
} from "../../lib/api";
import { buildBrandConstraints, buildBrandContext } from "../shared/brandConstraints";

// ── Visual styles available ─────────────────────────────

// `prompt` = descripción rica del estilo que se inyecta en la generación (no solo el label),
// para que Nano lo renderice bien. Los artesanales van primero (los que le gustan al cliente).
export const AD_STYLES: Array<{ id: string; label: string; desc: string; prompt?: string }> = [
  { id: "playmobil", label: "Playmobil", desc: "Figuras Playmobil de juguete", prompt: "Playmobil toy style: glossy plastic Playmobil figures with their signature simple painted faces, cylindrical bodies, C-shaped hands and molded helmet hair, tiny toy props and playsets, bright saturated toy colours, shot like a real macro photo of a Playmobil diorama with soft toy-photography lighting and shallow depth of field" },
  { id: "knitted", label: "Tejido / Lana", desc: "Todo tejido a mano (lana/fieltro)", prompt: "everything hand-knitted and needle-felted in wool and yarn: a cozy crochet miniature world with visible wool stitches and fuzzy fiber texture, soft felted characters and knitted scenery, warm handmade craft look, soft natural daylight" },
  { id: "paper_craft", label: "Papel recortado", desc: "Collage de papel a mano", prompt: "cut-paper collage / layered torn-paper craft: everything built from textured coloured paper layered by hand, visible paper edges and fibers, a handmade papercraft diorama, warm tactile storybook feel, soft even lighting" },
  { id: "claymation", label: "Claymation", desc: "Stop-motion en arcilla", prompt: "claymation / stop-motion clay style: characters and sets sculpted from modeling clay with visible fingerprints and clay texture, charming Aardman-like look, soft studio lighting" },
  { id: "3d_render", label: "3D Render (Pixar)", desc: "CGI estilizado tipo Pixar", prompt: "clean stylized 3D render, Pixar/Disney-like, soft global illumination, rounded appealing character design, vibrant but tasteful colours" },
  { id: "vfx_promo", label: "VFX Promo", desc: "Pulido, VFX + texto animado", prompt: "polished high-energy commercial look with cinematic VFX: glowing particles and light streaks, bold animated gold 3D text overlays, vibrant saturated color grade, dynamic" },
  { id: "photorealistic", label: "Photorealistic", desc: "Foto real, look comercial", prompt: "ultra-realistic commercial photography, natural lighting, sharp detail, filmic color grade" },
  { id: "2d_cartoon", label: "2D Cartoon", desc: "Animación 2D plana ilustrada", prompt: "flat 2D illustrated cartoon style, clean vector-like shapes, bold outlines, bright flat colours" },
  { id: "cinematic", label: "Cinematic", desc: "Fílmico, luz dramática", prompt: "cinematic film look, dramatic directional lighting, shallow depth of field, moody filmic grade, 35mm feel" },
  { id: "minimal", label: "Minimal", desc: "Limpio, mucho aire", prompt: "clean minimal style, lots of negative space, soft even lighting, muted refined palette, product-focused" },
  { id: "retro", label: "Retro/Vintage", desc: "Grano de film, tonos cálidos", prompt: "nostalgic retro/vintage look, film grain, warm faded tones, 70s-80s aesthetic" },
  { id: "custom", label: "Custom", desc: "Definí tu estilo en el brief", prompt: "" },
];

// ── Script — generate storyboard with Gemini ────────────

// Auto-asigna una voz del Brand Kit a cada personaje leyendo su descripción (edad/género).
// Es una SUGERENCIA: el usuario la confirma/cambia en el paso Script. Así el guión "manda"
// y el form no obliga a elegir una voz global. Match por nombre del preset (Nenita/Mujer/Hombre…).
function autoAssignVoices(
  characters: Array<{ name: string; description: string }>,
  presets: Array<{ id: string; name: string }>,
): Record<string, string> {
  if (!characters.length || !presets.length) return {};
  const byName = (kw: string) => presets.find((p) => p.name.toLowerCase().includes(kw))?.id;
  const map: Record<string, string> = {};
  for (const c of characters) {
    const t = `${c.name} ${c.description}`.toLowerCase();
    const ageM = t.match(/\b(\d{1,2})\s*años?\b/) || t.match(/\((\d{1,2})\)/);
    const age = ageM ? parseInt(ageM[1], 10) : null;
    const isChild = (age !== null && age <= 14) || /\b(niñ[oa]|nen[ae]|chic[oa]|adolescente|peque)\b/.test(t);
    const isFemale = /\b(niña|nena|mujer|señora|doña|abuela|madre|mam[áa]|hija|chica|biólog|supervisora|gu[íi]a)\b/.test(t);
    const isMale = /\b(niño|nene|hombre|señor|\bdon\b|abuelo|padre|pap[áa]|hijo|capit[áa]n|ingenier|t[ée]cnic|guardaparque)\b/.test(t);
    const isOld = (age !== null && age >= 60) || /\b(abuel[oa]|ancian[oa]|viej[oa]|mayor|grande)\b/.test(t);
    let vid: string | undefined;
    if (isChild) vid = byName("nen") || byName("niñ") || byName("nena");
    else if (isFemale && !isMale) vid = byName("mujer");
    else if (isMale && isOld) vid = byName("grande") || byName("hombre");
    else if (isMale) vid = presets.find((p) => /hombre/.test(p.name.toLowerCase()) && !/grande/.test(p.name.toLowerCase()))?.id || byName("hombre");
    else vid = byName("mujer") || byName("hombre");
    if (vid && c.name) map[c.name] = vid;
  }
  return map;
}

export const handleScript: StepHandler = async (ctx) => {
  const { activeBrand, config } = ctx;
  const selectedProduct = (activeBrand.products || []).find((p) => p.id === config.selectedProductId);
  const selectedAvatar = activeBrand.avatars?.find((a) => a.id === config.selectedAvatarId);
  const selectedClothing = (activeBrand.clothing || []).filter((c) => config.selectedClothingIds.includes(c.id));

  const numScenes = 10;
  const duration = 40;
  const adStyle = config.adStyle || "photorealistic";
  const styleDef = AD_STYLES.find((s) => s.id === adStyle);
  const styleLabel = styleDef?.label || adStyle;
  const stylePrompt = styleDef?.prompt || styleLabel;

  const extraVars: Record<string, string> = {
    num_scenes: String(numScenes),
    duration: String(duration),
    language: config.language || "es",
    ad_style: `${styleLabel} — ${stylePrompt}. EVERY frame's visual prompt must describe the scene in THIS exact style, consistently. Do NOT drift to photorealism unless the style IS photorealistic.`,
  };

  if (selectedProduct?.description) extraVars.product_description = selectedProduct.description;
  // El campo objective ahora es el BRIEF del proyecto — lo pasamos como {brief} (fuente de
  // verdad del guión) y también como creative_direction para back-compat del template.
  if (config.objective) { extraVars.brief = config.objective; extraVars.creative_direction = config.objective; }
  if (config.notes) extraVars.user_notes = config.notes;
  if (selectedClothing.length > 0) {
    extraVars.selected_clothing = selectedClothing.map((c) => `- ${c.name}${c.description ? `: ${c.description}` : ""}`).join("\n");
  }

  let userMsg = `Turn the BRIEF/GUIÓN into a ~${duration}s video ad storyboard in ${styleLabel} style. If the brief is ALREADY a written scene-by-scene script (scene markers + dialogue), INGEST it: one frame per scene, dialogue VERBATIM as the voiceover, extract speaker + location, keep characters consistent. If it is a loose brief, GENERATE ~6-8 frames and write the voiceover yourself.`;
  if (selectedProduct) userMsg += `\nProduct: ${selectedProduct.name}`;
  if (selectedAvatar) {
    userMsg += `\nCharacter: ${selectedAvatar.name}${selectedAvatar.description ? ` — ${selectedAvatar.description}` : ""}`;
  } else {
    userMsg += `\nIMPORTANT: Invent a character for this ad. Describe them in detail in the first frame (age, appearance, style) and keep them EXACTLY the same in every frame. The character interacts with the product throughout the story.`;
  }
  if (selectedClothing.length > 0) userMsg += `\nThe character wears: ${selectedClothing.map((c) => c.name).join(", ")}`;
  if (config.objective) userMsg += `\nDirection: ${config.objective}`;

  const { result } = await generateToolPrompt(activeBrand.id, "video_ad_creator", userMsg, extraVars);

  // Parse frames array — handle string, array, or nested object
  const findArray = (obj: unknown): Array<Record<string, unknown>> => {
    // If it's a string, try to parse it
    if (typeof obj === "string") {
      try {
        const parsed = JSON.parse(obj);
        return findArray(parsed);
      } catch (e) {
        // JSON parse failed — try to extract array
        // Try to extract JSON array from the string
        const str = obj as string;
        const start = str.indexOf("[");
        const end = str.lastIndexOf("]");
        if (start !== -1 && end > start) {
          try {
            const extracted = JSON.parse(str.slice(start, end + 1));
            return findArray(extracted);
          } catch { /* */ }
        }
        return [];
      }
    }
    if (Array.isArray(obj)) return obj;
    if (typeof obj === "object" && obj !== null) {
      for (const val of Object.values(obj as Record<string, unknown>)) {
        if (Array.isArray(val)) return val;
      }
    }
    return [];
  };

  // rawFrames: preferimos la clave "frames" del objeto (se setea abajo al parsear obj).
  // findArray queda como FALLBACK para el shape viejo (array crudo). Bug corregido: antes
  // findArray agarraba "el primer array que encuentra" y, cuando el guión devolvía
  // characters ANTES que frames, tomaba los PERSONAJES como si fueran los frames (fichas
  // de personaje, diálogo vacío).
  let rawFrames: Array<Record<string, unknown>> = [];

  // Interpretación del brief + personaje propuesto por Gemini (vienen junto a "frames" en el
  // objeto). Los surfaceamos en el gate de aprobación del script para que el usuario confirme.
  let interpretation = "", character = "";
  let characters: Array<{ name: string; description: string }> = [];
  try {
    const raw = typeof result === "string" ? result : JSON.stringify(result);
    const s = raw.indexOf("{"), e = raw.lastIndexOf("}");
    if (s !== -1 && e > s) {
      const obj = JSON.parse(raw.slice(s, e + 1)) as Record<string, unknown>;
      interpretation = String(obj.interpretation || "");
      character = String(obj.character || "");
      // Los frames REALES: la clave "frames" del objeto (no el primer array que aparezca).
      if (Array.isArray(obj.frames)) rawFrames = obj.frames as Array<Record<string, unknown>>;
      if (Array.isArray(obj.characters)) {
        characters = (obj.characters as Array<Record<string, unknown>>)
          .map((c) => ({ name: String(c.name || "").trim(), description: String(c.description || "").trim() }))
          .filter((c) => c.name || c.description);
      }
    }
  } catch { /* result puede venir como array crudo (shape viejo) — sin interpretación */ }

  // Fallback: shape viejo (array crudo sin objeto {frames}).
  if (rawFrames.length === 0) rawFrames = findArray(result);

  const frames = rawFrames
    .map((f, i) => {
      // Image prompt — try every possible key
      const prompt = String(
        f.prompt || f.image_prompt || f.description || f.visual || f.visuals
        || f.visual_description || f.scene_description || f.setting || ""
      );
      // Script/voiceover — try every possible key
      let script = String(
        f.script || f.voiceover || f.speech || f.text || f.narration
        || f.audio || f.dialogue || f.voice || f.voice_over || f.copy || ""
      );
      // Clean prefixes
      script = script.replace(/^(NARRATOR|VO|VOICEOVER|VOICE|SFX)\s*(\([^)]*\)\s*)?:\s*/i, "").trim();

      return {
        frame: Number(f.frame || f.scene || f.number || f.scene_number) || i + 1,
        prompt,
        scene_type: String(f.scene_type || f.type || f.category || "story"),
        script,
        // Ingesta de guión: quién habla (para asignar voz por personaje) + locación (para
        // consistencia de escenario entre escenas que se repiten).
        speaker: String(f.speaker || f.character || f.who || "").trim(),
        location: String(f.location || f.setting || f.scene_location || "").trim(),
        transition: String(f.transition || f.movement || f.camera_movement || "fade"),
        time: String(f.time || ""),
      };
    })
    .filter((f) => f.prompt.length > 5);

  if (frames.length === 0) throw new Error(`No frames generated. Raw: ${JSON.stringify(result)?.slice(0, 300)}`);

  // Auto-sugerencia de voz por personaje (del Brand Kit). El usuario la confirma/cambia
  // en el paso Script — reemplaza al selector de voz global del form.
  const voiceMap = autoAssignVoices(characters, activeBrand.voicePresets || []);

  // numScenes = cantidad real de escenas (variable: guión ingerido = N escenas del guión).
  return { result: { frames, style: styleLabel, numScenes: frames.length, interpretation, character, characters, voiceMap }, needsApproval: true };
};

// ── Character — genera el personaje MAESTRO (confirmás antes de las escenas) ──
// Del `character` que propuso el brief + una referencia opcional (avatar del Brand Kit o
// imagen subida). Esta imagen se ancla como identidad en base_image + todos los frames →
// mismo personaje en todas las escenas (el corazón del estilo mascot/UGC).

export const handleCharacter: StepHandler = async (ctx) => {
  const { activeBrand, config, getStepResult } = ctx;
  const scriptData = getStepResult("script") as { character?: string; characters?: Array<{ name: string; description: string }> } | undefined;

  // Lista de personajes a generar. Multi-personaje: el guión devuelve `characters` (Pedro,
  // Mariana, …). Fallback: un solo personaje desde el string `character`.
  const list = (scriptData?.characters && scriptData.characters.length)
    ? scriptData.characters
    : [{ name: "", description: (scriptData?.character || "").trim() }];

  const selectedAvatar = activeBrand.avatars?.find((a) => a.id === config.selectedAvatarId);

  // Referencias opcionales: imágenes subidas + avatar del Brand Kit. Se aplican SOLO al PRIMER
  // personaje (asumimos que la ref es del protagonista) — el resto sale de su descripción.
  const refFiles = (config as { referenceImages?: File[] }).referenceImages || [];
  const uploadedRefDataUrls: string[] = [];
  for (const file of refFiles.slice(0, 2)) {
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      uploadedRefDataUrls.push(dataUrl);
    } catch { /* skip */ }
  }
  const protagonistRefs: string[] = [];
  for (const u of uploadedRefDataUrls) protagonistRefs.push(u);
  if (selectedAvatar?.imageUrl) protagonistRefs.push(selectedAvatar.imageUrl);

  const imageModel = (config as unknown as Record<string, unknown>).imageModel as "nano-banana-2" | "gpt-image-2" || "nano-banana-2";
  const adStyle = config.adStyle || "photorealistic";
  const styleDef = AD_STYLES.find((s) => s.id === adStyle);
  const styleLabel = styleDef?.label || adStyle;
  const stylePrompt = styleDef?.prompt || styleLabel;

  const generated: Array<{ name: string; url: string; description: string }> = [];
  for (let i = 0; i < list.length; i++) {
    const ch = list[i];
    const chRefs = i === 0 ? protagonistRefs : [];   // refs solo para el protagonista
    const desc = ch.description || ch.name || (chRefs.length ? "the character shown in the reference image(s)" : "the main character of the ad");
    const prompt = `Master CHARACTER REFERENCE${ch.name ? ` of "${ch.name}"` : ""} in this style: ${stylePrompt}. A clean, full-figure, front-facing portrait of ${desc}. Neutral light-grey seamless studio background, soft even lighting, sharp and clear, the WHOLE character visible and well framed, rendered fully in the ${styleLabel} style. This is the DEFINITIVE reference reused to keep the EXACT SAME character (same design, colors, proportions, features) across every scene.${chRefs.length ? " Base the character on the reference image(s) provided — keep their identity/design." : ""}`;
    try {
      const job = chRefs.length === 0
        ? await createTextToImage(prompt, config.aspectRatio, config.resolution, imageModel)
        : await createImageEdit(chRefs, prompt, config.aspectRatio, config.resolution, imageModel);
      const res = await pollImageGen(job.request_id);
      if (res.image_url) generated.push({ name: ch.name, url: res.image_url, description: ch.description });
    } catch { /* si un personaje falla, seguimos con los demás */ }
  }

  if (generated.length === 0) throw new Error("Character generation failed");

  // url/description del primero = back-compat (base_image/images anclan a `characters` si existe).
  return { result: { characters: generated, url: generated[0].url, description: generated[0].description }, needsApproval: true };
};

// ── Base Image — generate frame 1 only ──────────────────

// Fondo por escena: solo se ancla una FOTO REAL cuando la escena MUESTRA la planta
// (verdad visual). El resto de locaciones (bahía, manglar, panga, orilla, centro comunitario…)
// las imagina la IA desde el prompt + el contexto de marca — NO se fuerza una imagen. El fondo
// manual del config, si el usuario lo eligió, sigue como override. Ver docs/video-dialogue-pipeline.md.
const PLANT_SCENE_KW = /(planta|fertilizante|construcci|domo|contenedor|gr[úu]a|torre industrial|f[áa]brica|CERREY|refiner)/i;
function plantBackgroundUrls(text: string, brand: { backgrounds?: Array<{ name?: string; imageUrl?: string }> }): string[] {
  if (!PLANT_SCENE_KW.test(text || "")) return [];
  return (brand.backgrounds || [])
    .filter((b) => /planta/i.test(b.name || "") && !!b.imageUrl)
    .slice(0, 2)
    .map((b) => b.imageUrl as string);
}

export const handleBaseImage: StepHandler = async (ctx) => {
  const { activeBrand, config, getStepResult, setAudioCache } = ctx;
  const scriptData = getStepResult("script") as { frames: Array<{ prompt: string; frame: number; scene_type: string; script?: string }> } | undefined;
  if (!scriptData?.frames?.[0]) throw new Error("No storyboard found.");

  const firstFrame = scriptData.frames[0];
  const selectedProduct = (activeBrand.products || []).find((p) => p.id === config.selectedProductId);
  const selectedAvatar = activeBrand.avatars?.find((a) => a.id === config.selectedAvatarId);
  const selectedClothing = (activeBrand.clothing || []).filter((c) => config.selectedClothingIds.includes(c.id));
  const selectedBackground = (activeBrand.backgrounds || []).find((b) => b.id === config.selectedBackgroundId);
  const selectedMoodboard = (activeBrand.moodboards || []).find((m) => m.id === config.selectedMoodboardId);

  // Convert uploaded reference files (e.g. from chat handoff) to data URLs
  const refFiles = (config as { referenceImages?: File[] }).referenceImages || [];
  const uploadedRefDataUrls: string[] = [];
  for (const file of refFiles.slice(0, 3)) {
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      uploadedRefDataUrls.push(dataUrl);
    } catch { /* skip */ }
  }

  const referenceUrls: string[] = [];
  // PERSONAJES MAESTROS (paso character) — anclamos SOLO los que aparecen en este frame (por
  // nombre en el prompt/speaker). Identidad #1 para que salgan idénticos en toda la historia.
  const charStep = getStepResult("character") as { characters?: Array<{ name: string; url: string }>; url?: string } | undefined;
  const allChars = charStep?.characters?.length ? charStep.characters : (charStep?.url ? [{ name: "", url: charStep.url }] : []);
  const charUrlsFor = (text: string): string[] => {
    const t = (text || "").toLowerCase();
    const matched = allChars.filter((c) => c.name && t.includes(c.name.toLowerCase()));
    return Array.from(new Set((matched.length ? matched : allChars).map((c) => c.url).filter(Boolean))).slice(0, 3);
  };
  for (const u of charUrlsFor(`${firstFrame.prompt} ${(firstFrame as { speaker?: string }).speaker || ""}`)) referenceUrls.push(u);
  // Order: uploaded refs (user intent) > avatar > clothing > product > background > moodboard
  for (const u of uploadedRefDataUrls) referenceUrls.push(u);
  if (selectedAvatar?.imageUrl && !referenceUrls.includes(selectedAvatar.imageUrl)) referenceUrls.push(selectedAvatar.imageUrl);
  selectedClothing.forEach((c) => { if (c.imageUrl) referenceUrls.push(c.imageUrl); });
  if (selectedProduct?.imageUrl) referenceUrls.push(selectedProduct.imageUrl);
  // Fondo por escena (auto): la planta real se ancla SOLO si el frame 1 la muestra.
  for (const u of plantBackgroundUrls(`${firstFrame.prompt} ${(firstFrame as { location?: string }).location || ""}`, activeBrand)) {
    if (!referenceUrls.includes(u)) referenceUrls.push(u);
  }
  if (selectedBackground?.imageUrl && !referenceUrls.includes(selectedBackground.imageUrl)) referenceUrls.push(selectedBackground.imageUrl);
  if (selectedMoodboard?.imageUrl) referenceUrls.push(selectedMoodboard.imageUrl);

  const imageModel = (config as unknown as Record<string, unknown>).imageModel as "nano-banana-2" | "gpt-image-2" || "nano-banana-2";

  // Append brand context + constraints
  const constraints = buildBrandConstraints(activeBrand, config, { tool: "video_ad_creator", mentionsAvatar: !!selectedAvatar });
  const brandContextBlock = buildBrandContext(activeBrand, "video_ad_creator");
  const finalPrompt = `${firstFrame.prompt}${brandContextBlock}${constraints}`;
  console.log("[video_ad] FINAL PROMPT frame 1:", finalPrompt.slice(0, 1500));

  // Fallback to text-to-image when there are zero references (otherwise the edit
  // endpoint fails with 422 — at least one image URL required).
  const job = referenceUrls.length === 0
    ? await createTextToImage(finalPrompt, config.aspectRatio, config.resolution, imageModel)
    : await createImageEdit(referenceUrls, finalPrompt, config.aspectRatio, config.resolution, imageModel);
  const result = await pollImageGen(job.request_id);
  if (result.status === "failed") throw new Error(result.error || "Image generation failed");

  // Generate audio for frame 1 if script exists
  const voiceId = config.selectedVoiceId || activeBrand.voicePresets?.[0]?.id;
  if (firstFrame.script && voiceId) {
    try {
      const { generateTTS } = await import("../../lib/api");
      const ttsResult = await generateTTS({ text: firstFrame.script, voice_id: voiceId });
      setAudioCache(`frame_1`, { url: ttsResult.audioUrl, blob: ttsResult.audioBlob });
    } catch { /* non-blocking */ }
  }

  return {
    result: {
      url: result.image_url,
      prompt: firstFrame.prompt,
      frame: 1,
      scene_type: firstFrame.scene_type,
      scriptText: firstFrame.script || "",
    },
    needsApproval: true,
  };
};

// ── Images — generate frames 2-10 using base as reference ──

export const handleImages: StepHandler = async (ctx) => {
  const { config, getStepResult, activeBrand } = ctx;
  const scriptData = getStepResult("script") as { frames: Array<{ prompt: string; frame: number; scene_type: string; script?: string }> } | undefined;
  if (!scriptData?.frames) throw new Error("No storyboard found.");

  const baseImage = getStepResult("base_image") as { url: string } | undefined;
  if (!baseImage?.url) throw new Error("No base image found. Approve frame 1 first.");

  // Generate frames SEQUENTIALLY — each uses the previous frame as reference
  // This creates a chain of visual consistency: F1→F2→F3→...
  const remainingFrames = scriptData.frames.slice(1);
  const generatedImages: Array<{ frame: number; url: string; prompt: string; scene_type: string; script: string; status: string }> = [];

  const imageModel = (config as unknown as Record<string, unknown>).imageModel as "nano-banana-2" | "gpt-image-2" || "nano-banana-2";

  // Personajes maestros (paso character) — se anclan por frame SOLO los que aparecen en él.
  const charStep = getStepResult("character") as { characters?: Array<{ name: string; url: string }>; url?: string } | undefined;
  const allChars = charStep?.characters?.length ? charStep.characters : (charStep?.url ? [{ name: "", url: charStep.url }] : []);
  const charUrlsFor = (text: string): string[] => {
    const t = (text || "").toLowerCase();
    const matched = allChars.filter((c) => c.name && t.includes(c.name.toLowerCase()));
    return Array.from(new Set((matched.length ? matched : allChars).map((c) => c.url).filter(Boolean))).slice(0, 3);
  };

  let previousFrameUrl = baseImage.url;
  for (const frame of remainingFrames) {
    try {
      // SOP Fase 7: la escena MASTER (@img1) va PRIMERA y lockea locación/paleta/estilo/luz.
      // Luego identidad de personaje, y el frame previo al final para continuidad suave (keyframes de video).
      const chUrls = charUrlsFor(`${frame.prompt} ${(frame as { speaker?: string }).speaker || ""}`)
        .filter((u) => u !== baseImage.url && u !== previousFrameUrl);
      // Fondo por escena: si ESTA escena muestra la planta, anclamos la foto real; si no, imaginativo.
      const plantBg = plantBackgroundUrls(`${frame.prompt} ${(frame as { location?: string }).location || ""}`, activeBrand);
      const refs = Array.from(new Set([baseImage.url, ...chUrls, ...plantBg, previousFrameUrl]));
      const prompt = `The FIRST reference is the approved MASTER scene — match it EXACTLY: same location and environment, same color palette and saturation, same lighting direction and quality, same visual style/medium. This is a NEW shot within that SAME world, not a different place. Keep the SAME character(s) — identical identity, design, colors — as the character reference(s). Smooth visual continuity with the previous frame (no hard jumps in framing). New shot: ${frame.prompt}`;
      const job = await createImageEdit(refs, prompt, config.aspectRatio, config.resolution, imageModel);
      const result = await pollImageGen(job.request_id);
      const url = result.image_url || "";
      if (url) previousFrameUrl = url; // next frame uses this as reference
      generatedImages.push({
        frame: frame.frame, url, prompt: frame.prompt,
        scene_type: frame.scene_type, script: frame.script || "", status: url ? "done" : "failed",
      });
    } catch {
      generatedImages.push({
        frame: frame.frame, url: "", prompt: frame.prompt,
        scene_type: frame.scene_type, script: frame.script || "", status: "failed",
      });
    }
  }

  // Combine: frame 1 (base) + frames 2-10
  const allFrames = [
    {
      frame: 1, url: baseImage.url,
      prompt: scriptData.frames[0].prompt,
      scene_type: scriptData.frames[0].scene_type,
      script: scriptData.frames[0].script || "",
      status: "done",
    },
    ...generatedImages,
  ];

  // Generate audio for each frame — voz por personaje (voiceMap[speaker]) o la global.
  const defaultVoice = config.selectedVoiceId || activeBrand.voicePresets?.[0]?.id;
  const voiceMap = (scriptData as { voiceMap?: Record<string, string> }).voiceMap || (config as unknown as { voiceMap?: Record<string, string> }).voiceMap || {};
  const speakerByFrame = new Map(scriptData.frames.map((fr) => [fr.frame, String((fr as { speaker?: string }).speaker || "")]));
  const framesWithAudio = await Promise.all(
    allFrames.map(async (f) => {
      const speaker = speakerByFrame.get(f.frame) || "";
      const vId = (speaker && voiceMap[speaker.trim()]) || defaultVoice;
      if (!f.script?.trim() || !vId) return { ...f, audioUrl: "", speaker };
      try {
        const { fal_url } = await generateTTSAndUpload({ text: f.script, voice_id: vId });
        return { ...f, audioUrl: fal_url, speaker };
      } catch {
        return { ...f, audioUrl: "", speaker };
      }
    })
  );

  return { result: { images: framesWithAudio }, needsApproval: true };
};

// ── Voice — generate audio per frame ────────────────────

export const handleVoice: StepHandler = async (ctx) => {
  const { activeBrand, config, getStepResult } = ctx;
  const scriptData = getStepResult("script") as { frames: Array<{ frame: number; script: string; speaker?: string }>; voiceMap?: Record<string, string> } | undefined;
  if (!scriptData?.frames) throw new Error("No script found.");

  // Voz por PERSONAJE: cada speaker (Pedro/Mariana/…) puede tener su voz de ElevenLabs.
  // El mapa se asigna en el paso Script (voiceMap por speaker); fallback: la voz global.
  const defaultVoice = config.selectedVoiceId || activeBrand.voicePresets?.[0]?.id;
  const voiceMap = scriptData.voiceMap || (config as unknown as { voiceMap?: Record<string, string> }).voiceMap || {};
  const voiceFor = (speaker?: string): string | undefined =>
    (speaker && voiceMap[speaker.trim()]) || defaultVoice;
  if (!defaultVoice && Object.keys(voiceMap).length === 0) throw new Error("No voice selected. Pick a voice (or assign voices per character).");

  const audioSegments = [];
  for (const frame of scriptData.frames) {
    const vId = voiceFor(frame.speaker);
    if (!frame.script?.trim() || !vId) {
      audioSegments.push({ frame: frame.frame, script: frame.script || "", audioUrl: "", speaker: frame.speaker || "" });
      continue;
    }
    try {
      const { fal_url } = await generateTTSAndUpload({ text: frame.script, voice_id: vId });
      audioSegments.push({ frame: frame.frame, script: frame.script, audioUrl: fal_url, speaker: frame.speaker || "" });
    } catch {
      audioSegments.push({ frame: frame.frame, script: frame.script, audioUrl: "", speaker: frame.speaker || "" });
    }
  }

  return {
    result: { audioSegments },
    needsApproval: true,
  };
};

// ── Animate — Kling frame-to-frame ──────────────────────

export const handleAnimate: StepHandler = async (ctx) => {
  const { config, getStepResult } = ctx;
  const scriptData = getStepResult("script") as { frames: Array<{ transition: string; prompt: string; animationHint?: string }> } | undefined;
  const imageData = getStepResult("images") as { images: Array<{ frame: number; url: string }> } | undefined;

  if (!imageData?.images || !scriptData?.frames) throw new Error("No images or script found.");

  const successfulImages = imageData.images.filter((img) => img.url).sort((a, b) => a.frame - b.frame);
  if (successfulImages.length < 1) throw new Error("Need at least 1 image to animate.");

  const adStyle = config.adStyle || "photorealistic";
  const styleLabel = AD_STYLES.find((s) => s.id === adStyle)?.label || adStyle;
  // Selector de modelo de video. "kling" = frame-to-frame (transición entre keyframes);
  // "veo-fast" / "seedance" = image-to-video (movimiento por keyframe). Default kling
  // (comportamiento actual). Veo 3.1 Fast = mucho más barato (ver pricing).
  const videoProvider = (config as unknown as { videoProvider?: string }).videoProvider || "kling";

  // Prompt de animación por segmento — inyecta la USER DIRECTION del step images si existe.
  const animPromptFor = (i: number, mode: "transition" | "shot"): string => {
    const fd = scriptData.frames.find((_f, idx) => idx === i);
    const dir = fd?.animationHint?.trim() ? ` USER DIRECTION (priority): ${fd.animationHint.trim()}.` : "";
    const subject = mode === "transition" ? "transition between the first shot and the second shot" : "shot with subtle cinematic motion";
    return `Create a seamless ${styleLabel} animated ${subject} in a ${styleLabel} animation style with sound effects (no talking).${dir}`;
  };

  const segments: Array<{ index: number; videoUrl: string; startFrame: number; endFrame: number; status: string }> = [];

  if (videoProvider === "kling") {
    // Kling frame-to-frame: pares frame1→frame2, frame2→frame3, …
    if (successfulImages.length < 2) throw new Error("Kling (frame-to-frame) needs at least 2 images.");
    for (let i = 0; i < successfulImages.length - 1; i++) {
      const startImg = successfulImages[i];
      const endImg = successfulImages[i + 1];
      try {
        const requestId = await createKlingFrameToFrame(startImg.url, endImg.url, animPromptFor(i, "transition"), "4", config.aspectRatio);
        const result = await pollKlingVideo(requestId);
        segments.push({ index: i, videoUrl: result.video_url || "", startFrame: startImg.frame, endFrame: endImg.frame, status: result.video_url ? "done" : "failed" });
      } catch {
        segments.push({ index: i, videoUrl: "", startFrame: startImg.frame, endFrame: endImg.frame, status: "failed" });
      }
    }
  } else {
    // Veo 3.1 Fast / Seedance: image-to-video, un segmento por keyframe.
    for (let i = 0; i < successfulImages.length; i++) {
      const img = successfulImages[i];
      try {
        let videoUrl = "";
        if (videoProvider === "seedance") {
          const { request_id } = await createSeedanceReferenceToVideo({ prompt: animPromptFor(i, "shot"), referenceImageUrls: [img.url], aspectRatio: config.aspectRatio, duration: "5" });
          const result = await pollSeedanceVideo(request_id);
          videoUrl = result.video_url || "";
        } else {
          // veo-fast (default no-kling)
          const { operation } = await createVeoVideo({ prompt: animPromptFor(i, "shot"), image: img.url, aspectRatio: config.aspectRatio, fast: true });
          const result = await pollVeoVideo(operation);
          videoUrl = result.video_url || "";
        }
        segments.push({ index: i, videoUrl, startFrame: img.frame, endFrame: img.frame, status: videoUrl ? "done" : "failed" });
      } catch {
        segments.push({ index: i, videoUrl: "", startFrame: img.frame, endFrame: img.frame, status: "failed" });
      }
    }
  }

  return { result: { segments }, needsApproval: true };
};

// ── Lipsync — Fal Fabric: pega la voz de ElevenLabs sobre los clips animados ──
// Fabric sincroniza labios sobre un VIDEO (por eso va DESPUÉS de animate). Para cada segmento
// cuya escena tiene diálogo + audio, aplica el lip-sync; las escenas B-roll pasan tal cual.

export const handleLipsync: StepHandler = async (ctx) => {
  const { getStepResult } = ctx;
  const animateData = getStepResult("animate") as { segments: Array<{ index: number; videoUrl: string; startFrame: number; endFrame: number; status: string }> } | undefined;
  if (!animateData?.segments) throw new Error("No hay clips animados. Corré 'animate' primero.");

  // Audio por frame — del paso voice; fallback al audio embebido en images.
  const voiceData = getStepResult("voice") as { audioSegments?: Array<{ frame: number; audioUrl: string }> } | undefined;
  const imagesData = getStepResult("images") as { images?: Array<{ frame: number; audioUrl?: string }> } | undefined;
  const audioByFrame = new Map<number, string>();
  (voiceData?.audioSegments || []).forEach((a) => { if (a.audioUrl) audioByFrame.set(a.frame, a.audioUrl); });
  (imagesData?.images || []).forEach((f) => { if (f.audioUrl && !audioByFrame.has(f.frame)) audioByFrame.set(f.frame, f.audioUrl); });

  const segments: Array<{ index: number; videoUrl: string; startFrame: number; endFrame: number; status: string; lipsyncUrl: string; audioUrl: string }> = [];
  for (const seg of animateData.segments) {
    const audioUrl = audioByFrame.get(seg.startFrame) || "";
    // Sin video o sin audio (B-roll / escena sin diálogo) → pasa tal cual.
    if (!seg.videoUrl || !audioUrl) {
      segments.push({ ...seg, lipsyncUrl: "", audioUrl });
      continue;
    }
    try {
      const audioBlob = await fetch(audioUrl).then((r) => r.blob());
      const created = await createFalLipSync(audioBlob, seg.videoUrl, "cut_off");
      const finalUrl = created.video_url || (await pollFalLipSync(created.request_id)).video_url || "";
      segments.push({ ...seg, lipsyncUrl: finalUrl, audioUrl });
    } catch {
      segments.push({ ...seg, lipsyncUrl: "", audioUrl });
    }
  }

  return { result: { segments }, needsApproval: true };
};

// ── Render — concat all segments + voice + subtitles ────

export const handleRender: StepHandler = async (ctx) => {
  const { config, getStepResult } = ctx;
  // Preferimos los segmentos del lip-sync (con la boca sincronizada); fallback a los de animate.
  const lipsyncData = getStepResult("lipsync") as { segments: Array<{ videoUrl: string; lipsyncUrl?: string }> } | undefined;
  const animateData = getStepResult("animate") as { segments: Array<{ videoUrl: string }> } | undefined;
  const scriptData = getStepResult("script") as { frames: Array<{ script: string }> } | undefined;

  const sourceSegments = lipsyncData?.segments
    ? lipsyncData.segments.map((s) => ({ videoUrl: s.lipsyncUrl || s.videoUrl }))
    : animateData?.segments;
  if (!sourceSegments) throw new Error("No animated segments found.");

  const videoUrls = sourceSegments.filter((s) => s.videoUrl).map((s) => s.videoUrl);
  if (videoUrls.length === 0) throw new Error("No valid video segments.");

  const subtitleScripts = scriptData?.frames.map((f) => ({ text: f.script || "" })) || [];

  const result = await concatVideos(videoUrls, subtitleScripts, config.subtitleEngine !== "none", config.subtitleEngine);

  // Persistence handled by autoSaveStep in ToolRunPage — no manual saveGeneration here.

  return {
    result: {
      videoUrl: result.video_url,
      totalDuration: `${result.duration}s`,
      scenes: result.num_segments,
      format: "MP4 / H.264",
    },
  };
};

// ── Helper: Kling with start + end frame ────────────────

async function createKlingFrameToFrame(
  startImageUrl: string,
  endImageUrl: string,
  prompt: string,
  duration: string = "5",
  aspectRatio: string = "9:16",
): Promise<string> {
  const API_BASE = "http://127.0.0.1:8000";
  const res = await fetch(`${API_BASE}/api/kling/frame-to-frame`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      start_image_url: startImageUrl,
      end_image_url: endImageUrl,
      prompt,
      duration,
      aspect_ratio: aspectRatio,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `Kling frame-to-frame failed (${res.status})`);
  }
  const data = await res.json();
  return data.request_id;
}
