/**
 * Aprobar o rechazar una pieza, con el motivo de moda (openspec/changes/modulos C.5).
 * Siempre a la vista debajo de la pieza: un toque aprueba; rechazar abre los motivos ahí mismo.
 * El rechazo con motivo es lo que enseña: se cuenta en Aprendizaje y, repetido, se vuelve regla.
 */
import { useState } from "react";
import { Check, X } from "lucide-react";
import { REJECT_REASONS, REJECT_LABEL } from "../../lib/rejectReasons";

export function PieceVerdict({ verdict, reason, delivered, onChange }: {
    verdict?: "ok" | "no" | null;
    reason?: string | null;
    /** Ya está en una entrega: no se cambia desde acá. */
    delivered?: boolean;
    onChange: (v: { verdict: "ok" | "no" | null; rejectReason: string | null }) => void;
}) {
    const [choosing, setChoosing] = useState(false);

    if (delivered) {
        return <div className="px-2 py-1.5 text-[11px] text-fg-muted flex items-center gap-1"><Check size={12} /> En Entregas</div>;
    }
    if (choosing) {
        return (
            <div className="px-2 py-1.5 flex flex-wrap gap-1 items-center">
                <span className="text-[10.5px] text-fg-muted mr-0.5">¿Qué falla?</span>
                {REJECT_REASONS.map((r) => (
                    <button key={r.id} type="button"
                        onClick={() => { onChange({ verdict: "no", rejectReason: r.id }); setChoosing(false); }}
                        className="h-6 px-2 text-[11px] rounded-[2px] border border-edge text-fg cursor-pointer hover:border-fg-muted">
                        {r.label}
                    </button>
                ))}
                <button type="button" onClick={() => setChoosing(false)} aria-label="Cancelar"
                    className="h-6 w-6 flex items-center justify-center text-fg-muted cursor-pointer"><X size={12} /></button>
            </div>
        );
    }
    const btn = "h-6 px-2 text-[11px] rounded-[2px] border cursor-pointer flex items-center gap-1";
    return (
        <div className="px-2 py-1.5 flex items-center gap-1">
            <button type="button" onClick={() => onChange({ verdict: verdict === "ok" ? null : "ok", rejectReason: null })}
                className={btn} style={verdict === "ok"
                    ? { background: "var(--color-fg)", color: "var(--color-canvas)", borderColor: "var(--color-fg)" }
                    : { borderColor: "var(--color-edge)", color: "var(--color-fg)" }}>
                <Check size={12} /> {verdict === "ok" ? "Aprobada" : "Aprobar"}
            </button>
            {verdict === "no" ? (
                <button type="button" onClick={() => onChange({ verdict: null, rejectReason: null })} title="Deshacer el rechazo"
                    className={btn} style={{ borderColor: "var(--color-danger, #b4453f)", color: "var(--color-danger, #b4453f)" }}>
                    <X size={12} /> {reason ? REJECT_LABEL[reason] ?? reason : "Rechazada"}
                </button>
            ) : (
                <button type="button" onClick={() => setChoosing(true)} className={btn}
                    style={{ borderColor: "var(--color-edge)", color: "var(--color-fg-muted)" }}>
                    <X size={12} /> Rechazar
                </button>
            )}
        </div>
    );
}
