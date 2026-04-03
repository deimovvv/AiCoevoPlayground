import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface SubtitleWordProps {
  text: string;
  startFrame: number;
  durationFrames: number;
  isActive: boolean;
}

export function SubtitleWord({ text, startFrame, durationFrames, isActive }: SubtitleWordProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const relativeFrame = frame - startFrame;

  // Scale in animation
  const scale = spring({
    frame: relativeFrame,
    fps,
    config: { damping: 12, stiffness: 200 },
  });

  // Fade out at end
  const opacity = interpolate(
    relativeFrame,
    [0, 3, durationFrames - 3, durationFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  if (relativeFrame < 0 || relativeFrame > durationFrames) return null;

  return (
    <span
      style={{
        display: "inline-block",
        transform: `scale(${isActive ? scale : 1})`,
        opacity,
        color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.6)",
        fontWeight: isActive ? 800 : 600,
        transition: "color 0.1s",
      }}
    >
      {text}{" "}
    </span>
  );
}
