import { Composition } from "remotion";
import { UGCComposition, type UGCScene } from "./UGCComposition";

export function RemotionRoot() {
  return (
    <Composition
      id="UGCVideo"
      component={UGCComposition}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        scenes: [] as UGCScene[],
      }}
    />
  );
}
