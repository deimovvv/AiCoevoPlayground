/**
 * Screen Mockup — Tool Definition
 * ────────────────────────────────
 * Subís tu UI (screenshot de la pantalla) + describís la escena → foto lifestyle con tu
 * app/software mostrándose en un dispositivo real (celular / laptop / tablet), en contexto.
 * Cubre "Mobile screen mockups" y "SaaS screen mockups" (ref: Pletor) con un solo tool —
 * el dispositivo sale de la descripción de escena.
 *
 * Pipeline: generate_all (single step), pero internamente son DOS pasos (técnica de Pletor):
 *   1. Escena con el dispositivo mostrando una PANTALLA VERDE croma (text-to-image).
 *   2. Reemplazar el verde por tu UI, encajada con perspectiva/reflejos (image-edit).
 * El chroma verde le da al modelo un target plano y perfecto donde encajar la UI → pantalla
 * nítida y sin deformar, en vez de pedirle inventar escena + encajar UI de un solo tiro (flaky).
 *
 * Input = referenceImages[0] (la UI) + objective (escena).
 */

import type { ToolDefinition, StepHandler } from "../types";
import { createImageEdit, createTextToImage, pollImageGen } from "../../lib/api";

const NO_TEXT = " Single clean photograph. No added captions, no watermark, no text overlay.";

const fileToDataUrl = (f: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(f);
  });

// Paso 1 — foto de la escena con el device mostrando una pantalla verde croma limpia.
// Exportado para que el panel muestre/edite el prompt por defecto (loop tipo Pletor).
export const greenScreenPrompt = (scene: string) =>
  `Professional lifestyle product photograph. Scene: ${scene}. ` +
  `A real device (phone, laptop or tablet — whichever fits the scene) is prominently featured with its screen facing the camera. ` +
  `The device screen is displaying a SOLID BRIGHT CHROMA-KEY GREEN (#00d000), completely flat, evenly lit, with NO content, ` +
  `no icons and no reflections over the green area — a clean green screen ready for compositing. ` +
  `Everything else — the device bezel and frame, the person, the environment and the lighting — is fully photorealistic and natural. ` +
  `Sharp, natural lighting, high-end commercial quality.${NO_TEXT}`;

// Paso 2 — reemplazar el verde por la UI real, encajada con perspectiva y reflejos.
export const compositePrompt =
  `Image 1 is a photograph of a device with a solid green chroma-key screen. Image 2 is a user-interface screenshot. ` +
  `Replace ONLY the green screen area of the device in image 1 with the EXACT UI from image 2. ` +
  `Fit the UI precisely to the screen shape: correct perspective, rounded corners, edge-to-edge. Keep the UI pixel-faithful ` +
  `(identical layout, colors, text and elements — do not redraw or restyle it). Add subtle, realistic screen glare and reflection ON TOP of the UI. ` +
  `Do NOT change anything else in the photograph — the person, environment, lighting and device frame stay identical. Photorealistic result.${NO_TEXT}`;

type SceneImg = { id: string; url: string; label: string; prompt: string; status: string };

// ── Paso 1: escena con pantalla verde ──────────────────────
// Genera N escenas (una por variación) con el device mostrando un chroma verde limpio.
// Se ven en el stepper como el paso "Escena base" — el usuario ve el pipeline ejecutándose.
const handleScene: StepHandler = async (ctx) => {
  const { config } = ctx;
  const cfg = config as unknown as Record<string, unknown>;

  const files = ((cfg.referenceImages as File[]) || []).filter((f) => f && typeof f.type === "string" && f.type.startsWith("image/"));
  if (files.length === 0) throw new Error("Subí tu UI (screenshot de la pantalla) como referencia.");

  const scene = (config.objective || "").trim() || "a person using the device in a modern, natural real-world setting";
  const ar = config.aspectRatio || "4:5";
  const res = config.resolution || "2K";
  const variations = Math.max(1, Math.min(4, config.numVariations || 1));
  // Override editable desde el panel (vacío = automático desde la escena). Loop tipo Pletor.
  const override = (cfg.stepPrompts as Record<string, string> | undefined)?.scene?.trim();
  const prompt = override || greenScreenPrompt(scene);

  const images: SceneImg[] = [];
  for (let i = 0; i < variations; i++) {
    try {
      const job = await createTextToImage(prompt, ar, res);
      const r = await pollImageGen(job.request_id);
      images.push({ id: `scene_${i}`, url: r.image_url || "", label: `Escena base #${i + 1}`, prompt, status: r.image_url ? "done" : "failed" });
    } catch (e) {
      images.push({ id: `scene_${i}`, url: "", label: `Escena base #${i + 1}`, prompt, status: "failed" });
      console.error(`[screen_mockup/scene] #${i + 1} failed:`, e);
    }
  }
  return { result: { images, successful: images.filter((im) => im.url).length, total: images.length }, needsApproval: false };
};

// ── Paso 2: componer la UI sobre el verde ──────────────────
// Lee las escenas verdes del paso anterior y reemplaza el chroma por la UI real.
const handleComposite: StepHandler = async (ctx) => {
  const { config } = ctx;
  const cfg = config as unknown as Record<string, unknown>;

  const files = ((cfg.referenceImages as File[]) || []).filter((f) => f && typeof f.type === "string" && f.type.startsWith("image/"));
  if (files.length === 0) throw new Error("Subí tu UI (screenshot de la pantalla) como referencia.");
  const uiUrl = await fileToDataUrl(files[0]);

  const ar = config.aspectRatio || "4:5";
  const res = config.resolution || "2K";
  const sceneResult = ctx.getStepResult("scene") as { images?: SceneImg[] } | undefined;
  const scenes = (sceneResult?.images || []).filter((s) => s.url);
  if (scenes.length === 0) throw new Error("No hay escena base para componer (el paso anterior no generó ninguna).");

  // Override editable desde el panel (vacío = prompt de composición por defecto).
  const compPrompt = (cfg.stepPrompts as Record<string, string> | undefined)?.composite?.trim() || compositePrompt;

  const images: SceneImg[] = [];
  for (let i = 0; i < scenes.length; i++) {
    try {
      const job = await createImageEdit([scenes[i].url, uiUrl], compPrompt, ar, res);
      const r = await pollImageGen(job.request_id);
      images.push({
        id: `mockup_${i}`,
        url: r.image_url || "",
        label: `Mockup #${i + 1}`,
        prompt: `${scenes[i].prompt}\n\n— compositing —\n${compPrompt}`,
        status: r.image_url ? "done" : "failed",
      });
    } catch (e) {
      images.push({ id: `mockup_${i}`, url: "", label: `Mockup #${i + 1}`, prompt: compPrompt, status: "failed" });
      console.error(`[screen_mockup/composite] #${i + 1} failed:`, e);
    }
  }
  return { result: { images, successful: images.filter((im) => im.url).length, total: images.length }, needsApproval: false };
};

export const screenMockup: ToolDefinition = {
  schema: {
    showAvatar: false,
    showProduct: false,
    showClothing: false,
    showBackground: false,
    showMoodboard: false,
    showReference: true,
    showVoice: false,
    showTone: false,
    showPlatform: false,
    showLanguage: false,
    showVariations: true,
    objectiveLabel: "Escena / dispositivo",
    objectivePlaceholder: 'Ej: "persona mirando su celular en una terraza de París" · "laptop en un café moderno" · "tablet sobre un escritorio minimalista". Mencioná el dispositivo (celular / laptop / tablet).',
    showNotes: false,
  },
  stepHandlers: {
    scene: handleScene,
    generate_all: handleComposite,
  },
  approvalSteps: [],
  // El paso de composición corre solo apenas termina la escena — el usuario ve ambos
  // pasos en el stepper, sin tener que apretar Run dos veces.
  autoRunSteps: ["generate_all"],
};
