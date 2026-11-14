/**
 * Motivos de rechazo de moda (openspec/changes/modulos 0.2 y C.5).
 * Se eligen con un toque en el lienzo de Campaña; el backend los cuenta en Aprendizaje junto con
 * las correcciones de Entregas, y tres del mismo motivo proponen una regla de la marca.
 */
export const REJECT_REASONS = [
    { id: "cara", label: "Cara" },
    { id: "calce", label: "Calce" },
    { id: "prenda", label: "Prenda distinta" },
    { id: "pose", label: "Pose" },
    { id: "luz", label: "Luz" },
    { id: "fondo", label: "Fondo" },
] as const;

export type RejectReason = (typeof REJECT_REASONS)[number]["id"];

export const REJECT_LABEL: Record<string, string> = Object.fromEntries(REJECT_REASONS.map((r) => [r.id, r.label]));
