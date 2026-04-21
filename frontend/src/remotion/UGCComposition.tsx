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

    // Word-by-word karaoke style — 1 word per chunk
    const words = scene.scriptText.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      frameOffset += scene.durationInFrames;
      continue;
    }
    const groups = words;

    // Each word gets equal time
    const framesPerWord = Math.floor(scene.durationInFrames / words.length);
    let chunkOffset = frameOffset;

    for (let i = 0; i < groups.length; i++) {
      const dur = i === groups.length - 1
        ? scene.durationInFrames - (chunkOffset - frameOffset)  // last word gets remaining frames
        : framesPerWord;
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
