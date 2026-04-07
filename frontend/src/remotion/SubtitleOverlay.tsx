import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export interface SubtitleChunk {
  text: string;
  startFrame: number;
  endFrame: number;
}

interface SubtitleOverlayProps {
  chunks: SubtitleChunk[];
}

export function SubtitleOverlay({ chunks }: SubtitleOverlayProps) {
  const frame = useCurrentFrame();
  const { fps: _fps } = useVideoConfig();

  const activeChunk = chunks.find(
    (c) => frame >= c.startFrame && frame <= c.endFrame
  );

  if (!activeChunk) return null;

  const relFrame = frame - activeChunk.startFrame;
  const duration = activeChunk.endFrame - activeChunk.startFrame;

  // Gentle fade in/out — minimal, no bounce
  const opacity = interpolate(
    relFrame,
    [0, 2, duration - 2, duration],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Very subtle scale — 0.97 → 1.0
  const scale = interpolate(
    relFrame,
    [0, 3],
    [0.97, 1],
    { extrapolateRight: "clamp" }
  );

  return (
    <div
      style={{
        position: "absolute",
        bottom: "28%",
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "0 32px",
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          opacity,
          textAlign: "center",
        }}
      >
        <span
          style={{
            display: "inline-block",
            fontSize: 64,
            fontWeight: 800,
            fontFamily: "Inter, system-ui, sans-serif",
            color: "#FFFFFF",
            textShadow:
              "0 2px 8px rgba(0,0,0,0.7), 0 1px 2px rgba(0,0,0,0.9)",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            textTransform: "uppercase",
          }}
        >
          {activeChunk.text}
        </span>
      </div>
    </div>
  );
}
