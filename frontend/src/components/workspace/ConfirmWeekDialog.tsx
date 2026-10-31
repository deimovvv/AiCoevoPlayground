import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { CHANNELS, confirmPlan } from "../../lib/api";
import type { PlanConfirm } from "../../lib/api";

/**
 * Confirmar lo previsto en un rango (brand-integrations 3.5): muestra qué sale, cuándo y dónde, y qué no
 * está listo. Recién al confirmar se programa en Postiz. Sin Postiz conectado no cambia nada y lo dice.
 */
export function ConfirmWeekDialog({ brandId, start, end, label, onClose, onDone }: {
    brandId: string; start: Date; end: Date; label: string; onClose: () => void; onDone: () => void;
}) {
    const [data, setData] = useState<PlanConfirm | null>(null);
    const [result, setResult] = useState<PlanConfirm | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Las fechas llegan nuevas en cada render: depender de su valor, no del objeto.
    const [s0, e0] = [start.getTime(), end.getTime()];
    useEffect(() => {
        confirmPlan(brandId, new Date(s0), new Date(e0), true).then(setData).catch((e) => setError((e as Error).message));
    }, [brandId, s0, e0]);

    const go = async () => {
        setBusy(true);
        try { const r = await confirmPlan(brandId, start, end); setResult(r); if (!r.pending) onDone(); }
        catch (e) { setError((e as Error).message); }
        finally { setBusy(false); }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={onClose}>
            <div className="w-full max-w-[560px] max-h-[80vh] flex flex-col bg-surface-1 rounded-[var(--radius-lg)] shadow-[var(--shadow-modal)]" onClick={(e) => e.stopPropagation()}>
                <header className="px-5 pt-4 pb-3 flex items-start gap-3 border-b border-edge">
                    <div className="flex-1">
                        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-faint">Confirmar · {label}</p>
                        <h2 className="mt-1 text-[18px] text-fg">Lo que sale</h2>
                    </div>
                    <button onClick={onClose} aria-label="Cerrar" className="text-fg-faint hover:text-fg cursor-pointer"><X size={14} /></button>
                </header>
                <div className="flex-1 overflow-y-auto px-5 py-3">
                    {error && <p className="text-[12px] text-[var(--color-error)]">{error}</p>}
                    {!data && !error && <p className="text-[12px] text-fg-muted flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Armando el resumen…</p>}
                    {data && data.items.length === 0 && <p className="text-[12px] text-fg-muted">No hay nada con fecha en este rango.</p>}
                    {data && data.items.length > 0 && (
                        <ol className="flex flex-col divide-y divide-[var(--color-edge-subtle)]">
                            {data.items.map((i) => (
                                <li key={i.id} className="py-2.5 flex gap-3">
                                    <span className="w-24 shrink-0 text-[11px] text-fg-muted tabular-nums">
                                        {i.scheduledAt && new Date(i.scheduledAt).toLocaleString("es-AR", { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}
                                    </span>
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-[13px] text-fg">{i.title}</span>
                                        <span className="block text-[11px] text-fg-faint">
                                            {i.channels.length ? i.channels.map((c) => CHANNELS.find((x) => x.id === c)?.label ?? c).join(", ") : "—"}
                                            {i.angle && ` · ${i.angle}`}
                                        </span>
                                        {i.problems.length > 0 && <span className="block mt-0.5 text-[11px] text-[var(--color-brand)]">{i.problems.join(" · ")}</span>}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    )}
                    {result?.pending === "postiz" && (
                        <p className="mt-3 p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] text-[12px] text-fg-muted leading-relaxed">
                            <span className="text-fg">Postiz todavía no está conectado.</span> No se programó nada: queda pendiente
                            (cuenta de Postiz con las redes de la marca y su API key en el servidor).
                        </p>
                    )}
                    {result?.pending === "postiz-sin-construir" && (
                        <p className="mt-3 p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] text-[12px] text-fg-muted">Postiz está conectado, pero mandar los posts todavía no está construido. No se programó nada.</p>
                    )}
                </div>
                <footer className="px-5 py-3 flex items-center gap-3 border-t border-edge">
                    <p className="flex-1 text-[11px] text-fg-faint">
                        {data ? `${data.ready} de ${data.items.length} ${data.items.length === 1 ? "lista" : "listas"} para programar. Lo que no está aprobado o no tiene red no sale.` : ""}
                        {data && !data.postiz && " · Postiz sin conectar."}
                    </p>
                    <button onClick={onClose} className="h-8 px-3 text-[12px] text-fg-muted hover:text-fg cursor-pointer">Cancelar</button>
                    <button onClick={go} disabled={busy || !data?.ready || !!result}
                        className="h-8 px-3 flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-fg text-[var(--color-canvas)] text-[12px] cursor-pointer disabled:opacity-30">
                        {busy && <Loader2 size={12} className="animate-spin" />} Programar {data?.ready ?? ""} en Postiz
                    </button>
                </footer>
            </div>
        </div>
    );
}
