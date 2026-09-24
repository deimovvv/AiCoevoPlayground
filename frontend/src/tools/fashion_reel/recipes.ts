/**
 * Recetas de movimiento — Fashion Reel
 * ─────────────────────────────────────
 * Una receta es un movimiento VALIDADO derivado de video real, que ya trae su
 * prompt resuelto. El usuario aporta el QUÉ (modelo, prendas, fondo); la receta
 * aporta el CÓMO.
 *
 * Spec completo: docs/fashion-reel-recipes.md
 *
 * ⚠️ La regla que las define: una receta TRAE SU PROMPT. Si el usuario tiene que
 * escribir el movimiento, no es una receta — es el formulario de siempre con una
 * foto arriba.
 *
 * ⚠️ Estado: la #1 está derivada de un clip real pero NO validada generando.
 * `expectedMotion` queda en null hasta que se corra y se mida (spec §7).
 */

import type { KlingModel } from "../../lib/api";

/** Modelo de video con el que una receta fue validada. Se define acá y no se
 *  importa de ManualLabV2 porque una tool no debe depender de una página. */
type RecipeVideoModel = KlingModel | "seedance-2";

/** Qué le pide una receta al usuario. La UI se arma de acá — no hay form fijo. */
export type RecipeInput =
    | { kind: "avatar"; label: string; hint?: string; required: boolean }
    | { kind: "clothing"; label: string; hint?: string; min: number; max: number;
        /** Qué papel cumplen los looks DENTRO de la pieza. Sin esto no se sabe si
         *  2 prendas son 2 clips separados o 2 tomas del mismo video. §11 */
        role: "one-per-clip" | "sequence" | "single" }
    | { kind: "background"; label: string; hint?: string; required: boolean }
    | { kind: "text"; label: string; placeholder: string; required: boolean };

export interface MotionRecipe {
    id: string;
    label: string;
    /** Una línea. Se lee bajo el thumb en la grilla. */
    sub: string;
    /** JPEG chico — lo ÚNICO que carga en la grilla. */
    thumbUrl: string;
    /** Loop sin audio. Se monta SOLO en hover (ver RecipeGrid). */
    previewUrl?: string;

    /** Trazabilidad: si una receta deja de funcionar hay que poder volver al material. */
    sourceNote: string;

    /** El prompt de movimiento, ya resuelto. */
    motionPrompt: string;

    /** Lo que le pide al usuario. */
    inputs: RecipeInput[];

    /** Lo que la receta FIJA y el usuario no elige. */
    fixed: {
        model: RecipeVideoModel;
        mode: "i2v" | "f2f";
        durationSec: number;
        aspectRatio: string;
        resolution: string;
    };

    /** Métrica de referencia para detectar degradación (spec §7).
     *  null = todavía no validada generando. */
    expectedMotion: { mean: number; std: number } | null;
}

export const MOTION_RECIPES: MotionRecipe[] = [
    {
        id: "giro-ciclorama",
        label: "Giro en ciclorama",
        sub: "Vuelta lenta sobre fondo liso · 6s",
        thumbUrl: "/recipes/giro-ciclorama.jpg",
        previewUrl: "/recipes/giro-ciclorama.mp4",
        sourceNote:
            "ref-giro-ciclorama.mp4 — clip de referencia aportado por el usuario (2026-09-23). " +
            "Producción real: 30fps y manos correctas. El archivo está re-encodeado (720×1280, " +
            "1.4 Mbps) así que no sirve para juzgar calidad de origen, sólo movimiento.",
        // Afirmativo y corto. Lección del Pixel (2026-09-22): cargar el prompt de
        // negativos ("NO x, NO y") lo empeoró — el modelo igual los incorpora.
        motionPrompt:
            "The model turns slowly and continuously on the spot, a smooth unbroken rotation at " +
            "constant speed, showing the outfit from front to profile to back. Her weight stays " +
            "centered, arms relaxed, one hand lightly holding the edge of the garment. Hair moves " +
            "naturally with the turn. The camera is locked off on a tripod at chest height, framing " +
            "her full body against a seamless studio backdrop. Even, soft, diffused studio lighting " +
            "with no visible shadows on the background. The motion is even and unhurried throughout, " +
            "like a fashion e-commerce turntable shot.",
        inputs: [
            { kind: "avatar", label: "Modelo", hint: "quién gira", required: true },
            { kind: "clothing", label: "Prendas", hint: "un clip por look", min: 1, max: 6, role: "one-per-clip" },
            {
                kind: "text",
                label: "Color de fondo",
                placeholder: "ej: amarillo pastel, gris claro, blanco roto",
                required: false,
            },
        ],
        fixed: {
            // Kling v3 Pro: 1080p, mejor retención de identidad, $0.56 los 5s
            // (Seedance 2.5 tope 720p y ~$2.31). Ver docs/fashion-reel-recipes.md §8.
            model: "v3-pro",
            mode: "i2v",
            durationSec: 6,
            aspectRatio: "9:16",
            resolution: "1080p",
        },
        expectedMotion: null, // sin validar todavía
    },
    {
        id: "retrato-frontal",
        label: "Retrato frontal",
        sub: "Plano medio, fondo claro · 12s",
        thumbUrl: "/recipes/catalogo05.jpg",
        previewUrl: "/recipes/catalogo05.mp4",
        sourceNote: "Catalogo05.mp4 (Koxis/Septiembre). El de mejor métrica del set propio: mean 26.4 · std 9.5.",
        motionPrompt:
            "The model faces the camera in a medium shot, shoulders squared, making small natural " +
            "adjustments — a slight shift of weight, a calm breath, hair settling. Her gaze stays " +
            "toward the lens. The camera holds steady at chest height against a clean light backdrop, " +
            "soft even studio light. The movement is minimal and composed throughout.",
        inputs: [
            { kind: "avatar", label: "Modelo", hint: "quién aparece", required: true },
            { kind: "clothing", label: "Prendas", hint: "un clip por look", min: 1, max: 6, role: "one-per-clip" },
        ],
        fixed: { model: "v3-pro", mode: "i2v", durationSec: 6, aspectRatio: "9:16", resolution: "1080p" },
        expectedMotion: null,
    },
    {
        id: "secuencia-looks",
        label: "Secuencia de looks",
        sub: "Varias tomas, un look por toma · 20s",
        thumbUrl: "/recipes/catalogo07.jpg",
        previewUrl: "/recipes/catalogo07.mp4",
        sourceNote: "Catalogo07.mp4 (Koxis/Septiembre). Multi-toma: mean 37.3 · std 20.9 — la variabilidad alta viene de los cortes, no de movimiento errático.",
        motionPrompt:
            "A sequence of composed shots of the same model, one outfit per shot, each held steady " +
            "for a few seconds before cutting to the next. Within each shot the movement is minimal — " +
            "a turn of the shoulders, a step toward camera. Consistent studio lighting and backdrop " +
            "across all shots so the cuts feel like one session.",
        inputs: [
            { kind: "avatar", label: "Modelo", hint: "la misma en todas las tomas", required: true },
            { kind: "clothing", label: "Looks", hint: "una toma por look, en orden", min: 2, max: 6, role: "sequence" },
        ],
        fixed: { model: "v3-pro", mode: "i2v", durationSec: 6, aspectRatio: "9:16", resolution: "1080p" },
        expectedMotion: null,
    },
    {
        id: "detalle-prenda",
        label: "Detalle de prenda",
        sub: "Close-up de textura y caída · 12s",
        thumbUrl: "/recipes/catalogo01.jpg",
        previewUrl: "/recipes/catalogo01.mp4",
        sourceNote: "Catalogo01.mp4 (Koxis/Septiembre). mean 30.4 · std 14.7.",
        motionPrompt:
            "A slow push toward the garment detail — the weave of the fabric, a seam, a cuff, the way " +
            "the cloth falls. The model's face stays visible in the upper frame as an identity anchor, " +
            "slightly soft while the garment stays sharp. Camera moves gradually and evenly, no sudden " +
            "reframing. Soft directional studio light that reveals texture.",
        inputs: [
            { kind: "avatar", label: "Modelo", hint: "ancla de identidad", required: true },
            { kind: "clothing", label: "Prenda", hint: "la que se muestra en detalle", min: 1, max: 1, role: "single" },
        ],
        fixed: { model: "v3-pro", mode: "i2v", durationSec: 6, aspectRatio: "9:16", resolution: "1080p" },
        expectedMotion: null,
    },
];

/** Costo estimado de una receta, en USD. Tarifas verificadas en fal.ai (2026-09-23). */
const RATE_PER_SEC: Record<string, number> = {
    "v3-pro": 0.112,
    "v2-5-turbo": 0.07,
};

export function recipeCostUsd(r: MotionRecipe): number | null {
    const rate = RATE_PER_SEC[r.fixed.model];
    return rate == null ? null : rate * r.fixed.durationSec;
}
