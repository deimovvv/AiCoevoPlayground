/**
 * Graba la capa de texto del editor sobre el video editado (composición "TextOverlay").
 * Lo llama el backend (services/text_overlay.py).
 *
 *   node src/remotion/render-text.mjs --job /ruta/job.json
 *
 * job.json: { videoUrl, blocks, theme, fontUrls, fontFamilies, width, height, duration, fps?, output }
 * El tamaño y la duración salen del video real (ffprobe en el backend): el texto se
 * compone sobre el cuadro verdadero, sea 9:16, 4:5 o 16:9.
 */
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const i = process.argv.indexOf("--job");
  if (i === -1) throw new Error("Falta --job <archivo.json>");
  const job = JSON.parse(readFileSync(process.argv[i + 1], "utf8"));
  const fps = job.fps || 30;
  const inputProps = { videoUrl: job.videoUrl, blocks: job.blocks, theme: job.theme, fontUrls: job.fontUrls || [], fontFamilies: job.fontFamilies || [] };

  const serveUrl = await bundle({ entryPoint: path.resolve(__dirname, "index.ts") });
  const composition = await selectComposition({ serveUrl, id: "TextOverlay", inputProps });
  await renderMedia({
    composition: {
      ...composition,
      fps,
      width: job.width,
      height: job.height,
      durationInFrames: Math.max(1, Math.round(job.duration * fps)),
    },
    serveUrl,
    codec: "h264",
    crf: 16,
    outputLocation: job.output,
    inputProps,
    onProgress: ({ progress }) => {
      const p = Math.round(progress * 100);
      if (p % 20 === 0) console.log(`[text-overlay] ${p}%`);
    },
  });
  console.log(`[text-overlay] listo: ${job.output}`);
}

main().catch((err) => {
  console.error("[text-overlay] Error:", err.message);
  process.exit(1);
});
