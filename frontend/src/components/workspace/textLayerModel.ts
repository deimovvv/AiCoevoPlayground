/**
 * Modelo de la capa de texto del editor: tipos, estilos y animación. El dibujo está en
 * TextLayer.tsx (separado para que Vite pueda refrescar el componente en caliente).
 */
export type TextStyleId = "titulo" | "subtitulo" | "prenda" | "precio" | "cta";
export type TextPosition = "top" | "center" | "bottom";

export interface TextBlock {
    id: string;
    /** Segundos en el timeline EDITADO (después de recortes y orden). */
    start: number;
    end: number;
    text: string;
    style: TextStyleId;
    position: TextPosition;
    /** "light" = letra blanca con sombra (fondos oscuros); "dark" = tinta negra sin sombra
     *  (fondos claros: ciclorama, estudio). Blanco sobre ciclorama no se lee. */
    tone?: TextTone;
}

export type TextTone = "light" | "dark";

/** Tipografía y color de la marca, ya resueltos (nombres CSS de familia). */
export interface TextTheme {
    headline: string;
    body: string;
    /** Color de acento (precio, fondo del CTA). */
    accent: string;
    /** Color del texto sobre el acento. */
    accentInk: string;
}

export const TEXT_STYLES: Record<TextStyleId, { label: string; defaultPosition: TextPosition; defaultSecs: number }> = {
    titulo: { label: "Título", defaultPosition: "top", defaultSecs: 2.5 },
    subtitulo: { label: "Subtítulo", defaultPosition: "bottom", defaultSecs: 2 },
    prenda: { label: "Prenda", defaultPosition: "bottom", defaultSecs: 2.5 },
    precio: { label: "Precio", defaultPosition: "bottom", defaultSecs: 2.5 },
    cta: { label: "CTA", defaultPosition: "bottom", defaultSecs: 2.5 },
};

export const TEXT_POSITIONS: Record<TextPosition, string> = { top: "Arriba", center: "Centro", bottom: "Abajo" };

/** Ancho de diseño: todo se compone en un cuadro de 1080 px de ancho y se escala. */
export const DESIGN_W = 1080;
export const MAX_TEXT_W = 940;
const ENTER = 0.35;
const EXIT = 0.25;

const easeOut = (x: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);

/** Elige el acento de la paleta de la marca: el primer color que no sea casi negro ni casi blanco. */
export function pickAccent(hexes: string[]): { accent: string; accentInk: string } {
    const lum = (hex: string) => {
        const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
        if (!m) return -1;
        const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const accent = hexes.find((h) => { const l = lum(h); return l > 0.12 && l < 0.88; }) || "#ffffff";
    return { accent, accentInk: lum(accent) > 0.55 ? "#111111" : "#ffffff" };
}

/** Animación de un bloque en el instante t: entra subiendo y enfocándose, sale con fundido. */
export function blockMotion(b: TextBlock, t: number): { opacity: number; y: number; blur: number } | null {
    if (t < b.start || t >= b.end) return null;
    const enter = easeOut((t - b.start) / ENTER);
    const exit = easeOut((b.end - t) / EXIT);
    return { opacity: Math.min(enter, exit), y: 22 * (1 - enter), blur: 10 * (1 - enter) };
}
