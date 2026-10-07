import { Composition } from "remotion";
import { UGCComposition, type UGCScene } from "./UGCComposition";
import { TextOverlayComposition, type TextOverlayProps } from "./TextOverlayComposition";

export function RemotionRoot() {
  return (
    <>
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
    {/* Editor de video: textos de la marca sobre el video editado. Tamaño y duración
        los fija render-text.mjs según el video real. */}
    <Composition
      id="TextOverlay"
      component={TextOverlayComposition}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ videoUrl: "", blocks: [], theme: { headline: "Inter", body: "Inter", accent: "#ffffff", accentInk: "#111111" }, fontUrls: [], fontFamilies: [] } as TextOverlayProps}
    />
    </>
  );
}
