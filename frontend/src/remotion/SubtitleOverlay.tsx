import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

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
  const { fps } = useVideoConfig();

  const activeChunk = chunks.find(
    (c) => frame >= c.startFrame && frame <= c.endFrame
  );

  if (!activeChunk) return null;

  const relFrame = frame - activeChunk.startFrame;
  const duration = activeChunk.endFrame - activeChunk.startFrame;

  // Bounce scale — overshoots then settles
  const scale = spring({
    frame: relFrame,
    fps,
    config: { damping: 8, stiffness: 180, mass: 0.6 },
  });

  // Slide up from below
  const translateY = interpolate(relFrame, [0, 5], [30, 0], {
    extrapolateRight: "clamp",
  });

  // Fade in fast, fade out at end
  const opacity = interpolate(
    relFrame,
    [0, 3, duration - 4, duration],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Split text into words for individual word animation
  const words = activeChunk.text.split(/\s+/);

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
          transform: `scale(${scale}) translateY(${translateY}px)`,
          opacity,
          textAlign: "center",
          maxWidth: "85%",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0 10px",
        }}
      >
        {words.map((word, i) => {
          // Stagger each word slightly
          const wordDelay = i * 2;
          const wordRelFrame = relFrame - wordDelay;

          const wordScale = spring({
            frame: Math.max(0, wordRelFrame),
            fps,
            config: { damping: 10, stiffness: 250, mass: 0.5 },
          });

          const wordOpacity = interpolate(
            wordRelFrame,
            [-1, 1],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );

          // Current word highlight — the last word to appear gets highlighted
          const isHighlighted = wordRelFrame > 0 && wordRelFrame < 8;

          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                transform: `scale(${wordScale})`,
                opacity: wordOpacity,
                fontSize: 52,
                fontWeight: 900,
                fontFamily: "Inter, system-ui, sans-serif",
                color: isHighlighted ? "#FFD700" : "#FFFFFF",
                textShadow:
                  "0 3px 12px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,1), 2px 2px 0 rgba(0,0,0,0.8)",
                letterSpacing: "-0.03em",
                lineHeight: 1.15,
                textTransform: "uppercase",
                transition: "color 0.15s",
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </div>
  );
}
