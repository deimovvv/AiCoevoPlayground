/**
 * Screen Mockup — Tool Definition
 * ────────────────────────────────
 * Subís tu UI (screenshot de la pantalla) + describís la escena → foto lifestyle con tu
 * app/software mostrándose en un dispositivo real (celular / laptop / tablet), en contexto.
 * Cubre "Mobile screen mockups" y "SaaS screen mockups" (ref: Pletor) con un solo tool —
 * el dispositivo sale de la descripción de escena.
 *
 * Pipeline: generate_all (single step). Input = referenceImages[0] (la UI) + objective (escena).
 */

import type { ToolDefinition, StepHandler } from "../types";
import { createImageEdit, pollImageGen } from "../../lib/api";

const NO_TEXT = " Single clean photograph. No added captions, no watermark, no UI overlay beyond the app screen itself.";

const fileToDataUrl = (f: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(f);
  });

const handleGenerate: StepHandler = async (ctx) => {
  const { config } = ctx;
  const cfg = config as unknown as Record<string, unknown>;

  const files = ((cfg.referenceImages as File[]) || []).filter((f) => f && typeof f.type === "string" && f.type.startsWith("image/"));
  if (files.length === 0) throw new Error("Subí tu UI (screenshot de la pantalla) como referencia.");
  const uiUrl = await fileToDataUrl(files[0]);

  const scene = (config.objective || "").trim() || "a person using the device in a modern, natural real-world setting";
  const ar = config.aspectRatio || "4:5";
  const res = config.resolution || "2K";
  const variations = Math.max(1, Math.min(4, config.numVariations || 1));

  const prompt =
    `Professional lifestyle product mockup photograph. Scene: ${scene}. ` +
    `A real device (phone, laptop or tablet — whichever fits the scene) is shown with its SCREEN clearly visible, ` +
    `displaying the EXACT user interface from the reference image (image 1). Reproduce the UI pixel-faithfully: same ` +
    `layout, colors, text and elements, fit correctly to the screen with realistic perspective, subtle screen glare ` +
    `and reflections, and the correct device bezel/frame. The UI must look genuinely displayed on the screen (not a flat paste). ` +
    `Photorealistic, sharp, natural lighting, high-end commercial quality.${NO_TEXT}`;

  const images: Array<{ id: string; url: string; label: string; prompt: string; status: string }> = [];
  for (let i = 0; i < variations; i++) {
    try {
      const job = await createImageEdit([uiUrl], prompt, ar, res);
      const r = await pollImageGen(job.request_id);
      images.push({ id: `mockup_${i}`, url: r.image_url || "", label: `Mockup #${i + 1}`, prompt, status: r.image_url ? "done" : "failed" });
    } catch (e) {
      images.push({ id: `mockup_${i}`, url: "", label: `Mockup #${i + 1}`, prompt, status: "failed" });
      console.error(`[screen_mockup] #${i + 1} failed:`, e);
    }
  }

  const successful = images.filter((im) => im.url).length;
  return { result: { images, successful, total: images.length }, needsApproval: false };
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
    generate_all: handleGenerate,
  },
  approvalSteps: [],
  autoRunSteps: [],
};
