import { AbsoluteFill, Sequence, OffthreadVideo } from "remotion";
import { SubtitleOverlay, type SubtitleChunk } from "./SubtitleOverlay";

export interface UGCScene {
  videoUrl: string;
  scriptText: string;
  durationInFrames: number;
}

interface UGCCompositionProps {
  scenes: UGCScene[];
  fps?: number;
}

/**
 * Generate subtitle chunks from scenes.
 * Splits each script into 2-4 word groups and distributes them
 * across the scene duration.
 */
function generateChunks(scenes: UGCScene[]): SubtitleChunk[] {
  const chunks: SubtitleChunk[] = [];
  let frameOffset = 0;

  for (const scene of scenes) {
    if (!scene.scriptText.trim()) {
      frameOffset += scene.durationInFrames;
      continue;
    }

    // Use natural line breaks as subtitle chunks
    const lines = scene.scriptText.split("\n").map((l) => l.trim()).filter(Boolean);

    let groups: string[];
    if (lines.length > 1) {
      // Use line breaks from script
      groups = lines;
    } else {
      // Split by natural punctuation first, then by word limit
      // Split on . ! ? , ; — and keep groups under 6 words
      const raw = scene.scriptText
        .split(/(?<=[.!?;,…])\s+/)
        .map((s) => s.trim())
        .filter(Boolean);

      groups = [];
      for (const segment of raw) {
        const words = segment.split(/\s+/);
        if (words.length <= 6) {
          groups.push(segment);
        } else {
          // Too long — split at ~5 words on word boundary
          for (let i = 0; i < words.length; i += 5) {
            groups.push(words.slice(i, i + 5).join(" "));
          }
        }
      }
      // If nothing was split (no punctuation), fall back to 5-word chunks
      if (groups.length <= 1) {
        const words = scene.scriptText.split(/\s+/).filter(Boolean);
        groups = [];
        for (let i = 0; i < words.length; i += 5) {
          groups.push(words.slice(i, i + 5).join(" "));
        }
      }
    }

    // Distribute proportionally by word count
    const wordCounts = groups.map((g) => g.split(/\s+/).length);
    const totalWords = wordCounts.reduce((a, b) => a + b, 0) || 1;
    let chunkOffset = frameOffset;

    for (let i = 0; i < groups.length; i++) {
      const proportion = wordCounts[i] / totalWords;
      const dur = Math.floor(scene.durationInFrames * proportion);
      chunks.push({ text: groups[i], startFrame: chunkOffset, endFrame: chunkOffset + dur - 2 });
      chunkOffset += dur;
    }

    frameOffset += scene.durationInFrames;
  }

  return chunks;
}

export function UGCComposition({ scenes }: UGCCompositionProps) {
  const chunks = generateChunks(scenes);

  let frameOffset = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {scenes.map((scene, i) => {
        const from = frameOffset;
        frameOffset += scene.durationInFrames;

        return (
          <Sequence key={i} from={from} durationInFrames={scene.durationInFrames}>
            <AbsoluteFill>
              <OffthreadVideo
                src={scene.videoUrl}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            </AbsoluteFill>
          </Sequence>
        );
      })}

      {/* Subtitle overlay spans the entire composition */}
      <AbsoluteFill>
        <SubtitleOverlay chunks={chunks} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
