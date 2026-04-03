/**
 * Remotion Render Script
 * ─────────────────────
 * Called from the backend via Node.js subprocess.
 * Renders the UGC composition with animated subtitles to MP4.
 *
 * Usage: npx tsx src/remotion/render.ts --props '{"scenes":[...]}' --output /path/to/output.mp4
 */

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";

interface RenderArgs {
  scenes: Array<{
    videoUrl: string;
    scriptText: string;
    durationInFrames: number;
  }>;
  outputPath: string;
}

async function main() {
  const args = process.argv.slice(2);
  const propsIdx = args.indexOf("--props");
  const outputIdx = args.indexOf("--output");

  if (propsIdx === -1 || outputIdx === -1) {
    console.error("Usage: npx tsx src/remotion/render.ts --props '{...}' --output /path/output.mp4");
    process.exit(1);
  }

  const props = JSON.parse(args[propsIdx + 1]);
  const outputPath = args[outputIdx + 1];

  console.log(`[remotion-render] Rendering ${props.scenes.length} scenes...`);

  // Bundle the Remotion project
  const bundleLocation = await bundle({
    entryPoint: path.resolve(__dirname, "index.ts"),
    webpackOverride: (config) => config,
  });

  const fps = 30;
  const totalDuration = props.scenes.reduce(
    (sum: number, s: { durationInFrames: number }) => sum + s.durationInFrames,
    0
  );

  // Select the composition
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "UGCVideo",
    inputProps: { scenes: props.scenes },
  });

  // Render
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
    inputProps: { scenes: props.scenes },
  });

  console.log(`[remotion-render] Done: ${outputPath}`);
  const stats = fs.statSync(outputPath);
  console.log(`[remotion-render] Size: ${(stats.size / 1024 / 1024).toFixed(1)}MB`);
}

main().catch((err) => {
  console.error("[remotion-render] Error:", err);
  process.exit(1);
});
