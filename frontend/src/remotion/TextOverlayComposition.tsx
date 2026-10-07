import { useEffect, useState } from "react";
import { AbsoluteFill, OffthreadVideo, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { TextLayer } from "../components/workspace/TextLayer";
import type { TextBlock, TextTheme } from "../components/workspace/textLayerModel";

export type TextOverlayProps = {
    videoUrl: string;
    blocks: TextBlock[];
    theme: TextTheme;
    /** URLs de Google Fonts — las MISMAS que cargó la vista previa (fontLoader.googleFontUrl). */
    fontUrls: string[];
    /** Nombres de familia, para esperar a que carguen antes del primer cuadro. */
    fontFamilies: string[];
};

/** Carga las fuentes de la marca y frena el render hasta que estén (si no, el primer
 *  cuadro sale con la tipografía del sistema). */
function useBrandFonts(urls: string[], families: string[]) {
    const [handle] = useState(() => delayRender("fuentes de la marca"));
    useEffect(() => {
        urls.forEach((href, i) => {
            const id = `brand-font-${i}`;
            if (document.getElementById(id)) return;
            const link = document.createElement("link");
            link.id = id;
            link.rel = "stylesheet";
            link.href = href;
            document.head.appendChild(link);
        });
        const loads = families.flatMap((f) => ["400", "600", "700", "800"].map((w) => document.fonts.load(`${w} 40px "${f}"`)));
        // Si una fuente no existe, no trabar el render: a los 8 s sigue con lo que haya.
        Promise.race([Promise.allSettled(loads), new Promise((r) => setTimeout(r, 8000))])
            .then(() => document.fonts.ready)
            .then(() => continueRender(handle));
    }, [urls, families, handle]);
}

/** El video editado + los textos de la marca, cuadro a cuadro. Mismo TextLayer que la vista previa. */
export function TextOverlayComposition({ videoUrl, blocks, theme, fontUrls, fontFamilies }: TextOverlayProps) {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    useBrandFonts(fontUrls, fontFamilies);
    return (
        <AbsoluteFill style={{ backgroundColor: "black" }}>
            <OffthreadVideo src={videoUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <TextLayer blocks={blocks} t={frame / fps} theme={theme} width={width} height={height} />
        </AbsoluteFill>
    );
}
