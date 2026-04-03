/**
 * Standalone Remotion Video Renderer
 * ───────────────────────────────────
 * Renders UGC videos with animated subtitles.
 * Called from Python backend as subprocess.
 *
 * Usage:
 *   node src/remotion/render-video.mjs \
 *     --videos '["url1","url2"]' \
 *     --scripts '["text1","text2"]' \
 *     --durations '[5.2, 4.1]' \
 *     --output /path/to/output.mp4
 */

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArg(args, flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
}

async function main() {
  const args = process.argv.slice(2);

  const videosJson = parseArg(args, "--videos");
  const scriptsJson = parseArg(args, "--scripts");
  const durationsJson = parseArg(args, "--durations");
  const outputPath = parseArg(args, "--output");

  if (!videosJson || !scriptsJson || !outputPath) {
    console.error("Missing required args: --videos, --scripts, --output");
    process.exit(1);
  }

  const videoUrls = JSON.parse(videosJson);
  const scripts = JSON.parse(scriptsJson);
  const durations = durationsJson ? JSON.parse(durationsJson) : videoUrls.map(() => 5);

  const fps = 30;
  const scenes = videoUrls.map((url, i) => ({
    videoUrl: url,
    scriptText: scripts[i] || "",
    durationInFrames: Math.round((durations[i] || 5) * fps),
  }));

  const totalDuration = scenes.reduce((sum, s) => sum + s.durationInFrames, 0);

  console.log(`[remotion] Rendering ${scenes.length} scenes, ${totalDuration} frames...`);

  // Bundle
  console.log("[remotion] Bundling...");
  const bundleLocation = await bundle({
    entryPoint: path.resolve(__dirname, "index.ts"),
  });

  // Select composition
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "UGCVideo",
    inputProps: { scenes },
  });

  // Render
  console.log("[remotion] Rendering video...");
  await renderMedia({
    composition: {
      ...composition,
      durationInFrames: totalDuration,
      fps,
      width: 1080,
      height: 1920,
    },
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: outputPath,
    inputProps: { scenes },
    onProgress: ({ progress }) => {
      if (Math.round(progress * 100) % 10 === 0) {
        console.log(`[remotion] Progress: ${Math.round(progress * 100)}%`);
      }
    },
  });

  console.log(`[remotion] Done: ${outputPath}`);
}

main().catch((err) => {
  console.error("[remotion] Error:", err.message);
  process.exit(1);
});
