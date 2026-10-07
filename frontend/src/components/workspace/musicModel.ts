/**
 * Pista de música del editor. Está atada al video ENTERO (no a un clip): siempre va de 0
 * al final, y en cada export se ajusta al largo que tenga el video. La mezcla la hace
 * backend/services/audio_mix.py.
 */

export interface MusicTrack {
    url: string;
    name: string;
    /** Desde qué segundo del tema arranca (para saltear una intro larga). */
    start: number;
    /** 0–1.5. 0.6 = presente sin tapar. */
    volume: number;
    /** Segundos de fade al final del video. */
    fadeOut: number;
    /** Golpes del tema en tiempo del video (0 = donde arranca la música). */
    beats?: number[];
    bpm?: number | null;
}

export const MUSIC_DEFAULTS = { start: 0, volume: 0.6, fadeOut: 1.5 };

/** Estilos de Lyria pensados para moda (backend/services/music_gen.py MOOD_PROMPTS). */
export const MUSIC_MOODS: Array<[string, string]> = [
    ["editorial", "Editorial"],
    ["lujo", "Lujo"],
    ["urbano", "Urbano"],
    ["energia", "Energía"],
];
/** Lyria 2 por Fal: $0.10 cada 30 s de música (verificado en music_gen.py). */
export const MUSIC_GEN_COST = 0.1;

interface Span { clipId: string; start: number; end: number }

/**
 * Ajusta los cortes al ritmo: el final de cada clip se corre al golpe ANTERIOR más
 * cercano (recortar sólo acorta un clip). No se toca un corte si eso dejara el clip más
 * corto que `minLen`, ni si el golpe está a más de `maxShave` segundos. Los cortes se
 * recalculan en orden, porque acortar un clip corre todos los que vienen después.
 */
export function snapCutsToBeats(edits: Span[], beats: number[], minLen = 0.8, maxShave = 0.6): { edits: Span[]; moved: number } {
    if (!beats.length) return { edits, moved: 0 };
    let acc = 0, moved = 0;
    const out = edits.map((e) => {
        const len = e.end - e.start;
        const cut = acc + len;
        const prev = beats.filter((b) => b <= cut + 1e-3 && b - acc >= minLen && cut - b <= maxShave);
        const target = prev.length ? prev[prev.length - 1] : null;
        if (target != null && cut - target > 0.02) {
            moved++;
            const n = { ...e, end: e.start + (target - acc) };
            acc = target;
            return n;
        }
        acc = cut;
        return e;
    });
    return { edits: out, moved };
}

/** Volumen de la vista previa en el instante t: el del tema con el fade de salida aplicado. */
export function musicGainAt(m: MusicTrack, t: number, total: number): number {
    const fadeFrom = total - m.fadeOut;
    const fade = m.fadeOut > 0 && t > fadeFrom ? Math.max(0, (total - t) / m.fadeOut) : 1;
    return Math.max(0, Math.min(1, m.volume)) * fade;
}
