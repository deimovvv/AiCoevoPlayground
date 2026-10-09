/**
 * Traducción entre un proyecto `timeline.json` y el editor (VideoTimeline).
 * Formato: openspec/changes/editor-timeline-project/design.md.
 *
 * Ida: cada tramo → un clip con su largo (voz + extra, o duration, o out−in…) y un recorte.
 * Vuelta: el orden y los recortes de la UI → los mismos campos del tramo, conservando todo
 * lo que el editor no conoce (Claude puede sumar los suyos).
 *
 * Sin imports de la app: se prueba solo.
 */

export interface Seg {
    id: string;
    src: string;
    in?: number;
    out?: number;
    duration?: number;
    voice?: string;
    extra?: number;
    overlay?: string;
    label?: string;
    [k: string]: unknown;
}
export type Media = Record<string, number | null | "missing">;

const IMAGE_RE = /\.(png|jpe?g|webp)$/i;
export const isImageSrc = (src: string) => IMAGE_RE.test(src);
const num = (v: unknown): number | undefined => (typeof v === "number" && isFinite(v) ? v : undefined);
const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Largo de un tramo: duration · voz + extra · out − in · archivo − in · imagen 3 s. */
export function segLength(s: Seg, media: Media): number {
    if (num(s.duration)) return s.duration!;
    const voice = s.voice ? num(media[s.voice]) : undefined;
    if (voice != null) return r3(voice + (num(s.extra) ?? 0));
    const start = num(s.in) ?? 0;
    if (num(s.out) != null) return Math.max(0.1, s.out! - start);
    if (isImageSrc(s.src)) return 3;
    const file = num(media[s.src]);
    return file != null ? Math.max(0.1, file - start) : 3;
}

export interface ClipEdit { clipId: string; start: number; end: number }

/** Los recortes con que abre el editor: el tramo tal como está en el archivo. */
export function segmentsToEdits(segs: Seg[], media: Media): ClipEdit[] {
    return segs.map((s) => {
        const start = num(s.in) ?? 0;
        return { clipId: s.id, start, end: r3(start + segLength(s, media)) };
    });
}

/**
 * Vuelta: lo que hizo la UI (orden, recortes, tramos quitados) → tramos del archivo.
 * Se escribe el campo que expresa la intención, como lo escribiría Claude:
 * con voz → `extra` (o `duration` si el tramo quedó más corto que la voz); imagen →
 * `duration`; video sin voz → `out`.
 */
export function editsToSegments(segs: Seg[], edits: ClipEdit[], media: Media): Seg[] {
    const byId = Object.fromEntries(segs.map((s) => [s.id, s]));
    return edits.filter((e) => byId[e.clipId]).map((e) => {
        const s: Seg = { ...byId[e.clipId] };
        const len = r3(e.end - e.start);
        if (!isImageSrc(s.src)) s.in = r3(e.start);
        const voice = s.voice ? num(media[s.voice]) : undefined;
        delete s.duration;
        if (voice != null) {
            if (len >= voice - 0.01) { const x = r3(len - voice); if (x > 0.01) s.extra = x; else delete s.extra; }
            else { s.duration = len; delete s.extra; }       // más corto que su voz: la voz se corta
        } else if (isImageSrc(s.src)) {
            s.duration = len;
        } else {
            s.out = r3(e.start + len);
        }
        return s;
    });
}

/** Momento de una nota en el video armado (para notas.md). */
export function noteTime(clipId: string, clipOffset: number, edits: ClipEdit[]): number {
    let acc = 0;
    for (const e of edits) {
        if (e.clipId === clipId) return r3(acc + Math.max(0, Math.min(clipOffset, e.end) - e.start));
        acc += e.end - e.start;
    }
    return 0;
}
