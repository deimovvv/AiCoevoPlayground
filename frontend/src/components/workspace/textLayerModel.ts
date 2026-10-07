/**
 * Modelo de la capa de texto del editor: tipos, estilos y animación. El dibujo está en
 * TextLayer.tsx (separado para que Vite pueda refrescar el componente en caliente).
 */
export type TextStyleId = "titulo" | "subtitulo" | "prenda" | "precio" | "cta";
export type TextPosition = "top" | "center" | "bottom";

/** Lo que se ve de un texto: contenido y aspecto. */
export interface TextContent {
    id: string;
    text: string;
    style: TextStyleId;
    position: TextPosition;
    /** "light" = letra blanca con sombra (fondos oscuros); "dark" = tinta negra sin sombra
     *  (fondos claros: ciclorama, estudio). Blanco sobre ciclorama no se lee. */
    tone?: TextTone;
}

/**
 * A qué está atado un texto. Así respeta los tiempos del video aunque se recorte o
 * reordene (igual que las notas, que guardan clip + momento del clip):
 *  - "clip":  sigue a su clip. Si el clip se mueve, el texto va con él.
 *  - "start": desde el inicio del video (un título de apertura).
 *  - "end":   pegado al final (el CTA de cierre), aunque el video cambie de largo.
 */
export type TextAnchor = { kind: "clip"; clipId: string } | { kind: "start" } | { kind: "end" };

/** Un texto como se GUARDA: anclado, no en segundos del video armado. */
export interface TextBlock extends TextContent {
    anchor: TextAnchor;
    /** clip → segundo del MATERIAL del clip donde empieza (recortar el inicio del clip no lo
     *  corre: queda pegado al mismo momento de la imagen) · start → segundos desde el inicio ·
     *  end → cuánto antes del final TERMINA (0 = justo al final). */
    offset: number;
    duration: number;
}

/** Un texto ubicado en el video armado: lo que dibuja TextLayer y graba el export. */
export interface PlacedText extends TextContent {
    start: number;
    end: number;
}

/** Tramo de un clip en el video armado (= TimelineEdit del editor). */
export interface ClipSpan { clipId: string; start: number; end: number }

/** Dónde quedó un texto después de recortes y reordenamientos. */
export type PlacementState =
    | "ok"
    | "trimmed"   // parte de su tramo quedó recortada: se muestra lo que queda
    | "cut"       // todo su tramo quedó fuera del recorte de su clip: no se ve
    | "orphan"    // se quitó su clip: no se ve
    | "outside";  // atado al inicio/final, pero el video quedó más corto: no se ve

export interface Placement { block: TextBlock; placed: PlacedText | null; state: PlacementState }

/** ¿Texto guardado antes de las anclas (con start/end en segundos del video)? */
export function isLegacyText(b: unknown): boolean {
    return !!b && typeof b === "object" && !("anchor" in b) && "start" in b;
}

/** Textos guardados antes de las anclas: pasan a "start" (el editor los migra a su clip). */
export function normalizeText(b: TextBlock | (TextContent & { start: number; end: number })): TextBlock {
    if ("anchor" in b && b.anchor) return b as TextBlock;
    const legacy = b as TextContent & { start: number; end: number };
    const { start, end, ...rest } = legacy;
    return { ...rest, anchor: { kind: "start" }, offset: start, duration: Math.max(0.3, end - start) };
}

const spanStarts = (edits: ClipSpan[]) => {
    const out: number[] = []; let acc = 0;
    for (const e of edits) { out.push(acc); acc += Math.max(0, e.end - e.start); }
    return { starts: out, total: acc };
};

/** Ubica cada texto en el video armado. Se recalcula con cada recorte o reordenamiento. */
export function placeTexts(blocks: TextBlock[], edits: ClipSpan[]): Placement[] {
    const { starts, total } = spanStarts(edits);
    const place = (b: TextBlock, start: number, end: number, state: PlacementState): Placement => {
        const s = Math.max(0, Math.min(start, total)), e = Math.max(s, Math.min(end, total));
        if (e - s < 0.05) return { block: b, placed: null, state: b.anchor.kind === "clip" ? "cut" : "outside" };
        return { block: b, placed: { ...contentOf(b), start: s, end: e }, state };
    };
    return blocks.map((raw) => {
        const b = normalizeText(raw);
        if (b.anchor.kind === "start") return place(b, b.offset, b.offset + b.duration, "ok");
        if (b.anchor.kind === "end") return place(b, total - b.offset - b.duration, total - b.offset, "ok");
        const clipId = b.anchor.clipId;
        const i = edits.findIndex((e) => e.clipId === clipId);
        if (i < 0) return { block: b, placed: null, state: "orphan" };
        const ed = edits[i];
        const from = b.offset, to = b.offset + b.duration;
        if (to <= ed.start || from >= ed.end) return { block: b, placed: null, state: "cut" };
        const visibleFrom = Math.max(from, ed.start);
        const start = starts[i] + (visibleFrom - ed.start);
        // Puede seguir sobre el clip de al lado: un texto no tiene por qué cortarse con el clip.
        return place(b, start, start + (to - visibleFrom), from < ed.start ? "trimmed" : "ok");
    });
}

function contentOf(b: TextBlock): TextContent {
    return { id: b.id, text: b.text, style: b.style, position: b.position, tone: b.tone };
}

/**
 * Re-ancla un texto a partir de dónde quedó en el video armado (después de arrastrarlo o
 * de cambiar su ancla). Con ancla "clip" toma el clip que está debajo de su inicio: así
 * un texto se puede pasar de un clip a otro arrastrándolo.
 */
export function anchorAt(b: TextBlock, kind: TextAnchor["kind"], start: number, end: number, edits: ClipSpan[]): TextBlock {
    const { starts, total } = spanStarts(edits);
    const duration = Math.max(0.3, end - start);
    if (kind === "start") return { ...b, anchor: { kind: "start" }, offset: start, duration };
    if (kind === "end") return { ...b, anchor: { kind: "end" }, offset: Math.max(0, total - end), duration };
    let i = starts.findIndex((s, k) => start >= s && start < s + (edits[k].end - edits[k].start));
    if (i < 0) i = edits.length - 1;
    const ed = edits[i];
    return { ...b, anchor: { kind: "clip", clipId: ed.clipId }, offset: ed.start + (start - starts[i]), duration };
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

/** Animación de un texto en el instante t: entra subiendo y enfocándose, sale con fundido. */
export function blockMotion(b: PlacedText, t: number): { opacity: number; y: number; blur: number } | null {
    if (t < b.start || t >= b.end) return null;
    const enter = easeOut((t - b.start) / ENTER);
    const exit = easeOut((b.end - t) / EXIT);
    return { opacity: Math.min(enter, exit), y: 22 * (1 - enter), blur: 10 * (1 - enter) };
}
