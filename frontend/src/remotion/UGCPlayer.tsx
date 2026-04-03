import { Player } from "@remotion/player";
import { UGCComposition, type UGCScene } from "./UGCComposition";

interface UGCPlayerProps {
  scenes: UGCScene[];
  width?: number;
  height?: number;
}

/**
 * Remotion Player wrapper for previewing UGC videos with animated subtitles.
 * Used in the render step and content detail drawer.
 */
export function UGCPlayer({ scenes, width = 360, height = 640 }: UGCPlayerProps) {
  const fps = 30;
  const totalDuration = scenes.reduce((sum, s) => sum + s.durationInFrames, 0);

  if (totalDuration === 0 || scenes.length === 0) {
    return (
      <div
        style={{ width, height, backgroundColor: "#111", borderRadius: 8 }}
        className="flex items-center justify-center"
      >
        <p className="text-[12px] text-fg-faint">No video data</p>
      </div>
    );
  }

  return (
    <Player
      component={UGCComposition}
      inputProps={{ scenes }}
      durationInFrames={totalDuration}
      fps={fps}
      compositionWidth={1080}
      compositionHeight={1920}
      style={{
        width,
        height,
        borderRadius: 8,
        overflow: "hidden",
      }}
      controls
      autoPlay={false}
    />
  );
}
