/**
 * Capa de texto del editor — la `render(t)` de los textos.
 *
 * Un solo componente dibuja los textos para un instante `t`. Lo usan:
 *  - la vista previa del editor (encima del reproductor, con el `t` del video), y
 *  - el export (Remotion lo monta sobre el video con `t = cuadro / fps` y lo graba).
 * Mismo código en los dos lados: lo que se ve es lo que se graba.
 *
 * Es el método de las skills de Coevo (pipeline-contenido, experiencia-viva): el texto
 * es código que dibuja cada cuadro, no un texto quemado por el generador (que lo deforma).
 * Reglas tomadas de pipeline-contenido/LEARNINGS.md (piezas reales, 2026-10):
 *  - entrada sin rebote: sube + desenfoque → nítido;
 *  - ancho máximo 940 px (en un cuadro de 1080), una palabra larga achica la letra;
 *  - precio grande (≥ 34 px) y con alto contraste; cifras en número;
 *  - la posición se decide viendo el video (por eso arriba / centro / abajo, a elegir).
 *
 * Sin imports de Remotion ni de la app: tiene que poder bundlearse solo. Tipos, estilos y
 * animación viven en textLayerModel.ts.
 */
import type { CSSProperties } from "react";
import { DESIGN_W, MAX_TEXT_W, blockMotion, type TextBlock, type TextStyleId, type TextPosition, type TextTheme } from "./textLayerModel";

function baseSize(style: TextStyleId): number {
    return { titulo: 92, subtitulo: 58, prenda: 66, precio: 104, cta: 50 }[style];
}

/** Una palabra larga achica la letra para que entre en 940 px (aprox. 0.58 em por letra). */
function fitSize(text: string, style: TextStyleId): number {
    const base = baseSize(style);
    const longest = text.split(/\s+/).reduce((m, w) => Math.max(m, w.length), 1);
    return Math.max(34, Math.min(base, MAX_TEXT_W / (longest * 0.58)));
}

function blockStyle(b: TextBlock, theme: TextTheme): CSSProperties {
    const size = fitSize(b.text, b.style);
    const dark = b.tone === "dark";
    const ink = dark ? "#111111" : "#ffffff";
    const shadow = dark ? "none" : "0 3px 18px rgba(0,0,0,.45), 0 1px 3px rgba(0,0,0,.35)";
    switch (b.style) {
        case "titulo":
            return { fontFamily: theme.headline, fontSize: size, fontWeight: 700, lineHeight: 1.02, letterSpacing: "-0.01em", color: ink, textShadow: shadow };
        case "subtitulo":
            return { fontFamily: theme.body, fontSize: size, fontWeight: 600, lineHeight: 1.12, color: ink, textShadow: shadow, WebkitTextStroke: dark ? undefined : "1.5px rgba(0,0,0,.35)" };
        case "prenda":
            return { fontFamily: theme.headline, fontSize: size, fontWeight: 500, lineHeight: 1.05, color: ink, textShadow: shadow };
        case "precio":
            return { fontFamily: theme.headline, fontSize: size, fontWeight: 800, lineHeight: 1, color: dark ? ink : theme.accent, textShadow: shadow, fontVariantNumeric: "tabular-nums" };
        case "cta":
            return { fontFamily: theme.body, fontSize: size, fontWeight: 700, lineHeight: 1, color: theme.accentInk, background: theme.accent, padding: "28px 52px", borderRadius: 999 };
    }
}

/** Zonas seguras de Reels/TikTok: abajo deja el 24 % (botones y caption). Arriba al 9 %:
 *  al 13 % tapaba la cara en planos enteros de moda (probado 2026-10-07). */
const POS: Record<TextPosition, CSSProperties> = {
    top: { top: "9%" },
    center: { top: "50%", transform: "translateY(-50%)" },
    bottom: { bottom: "24%" },
};

/**
 * Dibuja los textos visibles en `t`. Ocupa todo el contenedor; `width` es el ancho real
 * en píxeles del contenedor (para escalar desde el cuadro de diseño de 1080).
 */
export function TextLayer({ blocks, t, theme, width, height, selectedId }: {
    blocks: TextBlock[];
    t: number;
    theme: TextTheme;
    width: number;
    height: number;
    /** Sólo vista previa: el bloque que se está editando (se muestra completo y marcado). */
    selectedId?: string | null;
}) {
    const k = width / DESIGN_W;
    const designH = height / k;
    return (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
            <div style={{ position: "absolute", left: 0, top: 0, width: DESIGN_W, height: designH, transform: `scale(${k})`, transformOrigin: "0 0" }}>
                {blocks.map((b) => {
                    // El texto que se está editando se ve completo, esté donde esté el cabezal:
                    // si no, recién creado (t = su inicio) arrancaría invisible.
                    const m = b.id === selectedId ? { opacity: 1, y: 0, blur: 0 } : blockMotion(b, t);
                    if (!m || !b.text.trim()) return null;
                    const pos = POS[b.position];
                    return (
                        <div key={b.id} style={{ position: "absolute", left: 0, right: 0, display: "flex", justifyContent: "center", ...pos }}>
                            <div style={{
                                maxWidth: MAX_TEXT_W, textAlign: "center", whiteSpace: "pre-wrap", overflowWrap: "break-word",
                                opacity: m.opacity, translate: `0 ${m.y}px`, filter: m.blur > 0.05 ? `blur(${m.blur}px)` : undefined,
                                outline: selectedId === b.id ? "2px dashed rgba(255,255,255,.6)" : undefined, outlineOffset: 12,
                                ...blockStyle(b, theme),
                            }}>
                                {b.text}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
