import { useState } from "react";
import { Check, Download, Maximize2, MessageSquare, RotateCcw, Upload } from "lucide-react";
import { backendUrl, type Delivery, type DeliveryItem } from "../../lib/api";

/**
 * Vista de storyboard dentro de Entregas (openspec/changes/storyboard-y-mesas, paso 1).
 *
 * Los cuadros van numerados (#1, #2…) y agrupados por clip, con su tiempo y qué pasa en cada uno. Cada
 * cuadro tiene su estado: aprobado, pide cambio o nuevo en esta ronda. Al tocarlo se abre la lámina
 * grande de Entregas, que ya tiene la charla del cuadro (comentarios, pines y flechas). Las guías 9:16 y
 * 4:5 muestran qué parte del cuadro queda en cada medida.
 */

type Guide = null | "916" | "45";

// Ancho de la guía sobre un cuadro 16:9 (alto completo): 9:16 → 9/16·9/16 ≈ 31,6 %; 4:5 → 4/5·9/16 = 45 %.
const GUIDE: Record<"916" | "45", { w: number; color: string; label: string }> = {
    "916": { w: 31.64, color: "#d0533f", label: "9:16" },
    "45": { w: 45, color: "#3d63b8", label: "4:5" },
};

function groupsOf(items: DeliveryItem[]) {
    const out: { clip: string | null; list: { it: DeliveryItem; i: number }[] }[] = [];
    items.forEach((it, i) => {
        const clip = it.clip ?? null;
        const last = out[out.length - 1];
        if (last && last.clip === clip) last.list.push({ it, i });
        else out.push({ clip, list: [{ it, i }] });
    });
    return out;
}

export function StoryboardView({ d, client, mayApprove, busy, openComments, onOpen, onState, onReplace }: {
    d: Delivery;
    client: boolean;
    mayApprove: boolean;
    busy: boolean;
    /** Comentarios abiertos de cada cuadro en esta ronda (por id). */
    openComments: Record<string, number>;
    onOpen: (index: number) => void;
    onState: (itemId: string, state: "ok" | "cambio" | null) => void;
    /** Equipo: reemplazar la imagen de un cuadro (versión de una sola lámina). */
    onReplace?: (itemId: string) => void;
}) {
    const [guide, setGuide] = useState<Guide>(null);
    const items = d.items;
    const ok = items.filter((x) => x.state === "ok").length;
    const changes = items.filter((x) => x.state === "cambio").length;
    const fresh = d.round > 1 ? items.filter((x) => x.changed === d.round).length : 0;
    const closed = d.status === "aprobada";

    return (
        <div className="flex-1 min-h-0 overflow-y-auto bg-[var(--color-canvas)] px-4 md:px-6 py-5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="h-1 w-40 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                    <div className="h-full bg-[var(--color-success)]" style={{ width: `${(ok / Math.max(1, items.length)) * 100}%` }} />
                </div>
                <p className="text-[12px] text-fg-muted tabular-nums">
                    {ok} de {items.length} aprobados{changes > 0 && ` · ${changes} con cambios`}{fresh > 0 && ` · ${fresh} ${fresh === 1 ? "nuevo" : "nuevos"} en esta ronda`}
                </p>
                <span className="flex-1" />
                <div className="flex rounded-[var(--radius-sm)] border border-edge overflow-hidden text-[12px] bg-surface-1">
                    {([null, "916", "45"] as Guide[]).map((g) => (
                        <button key={g ?? "full"} onClick={() => setGuide(g)}
                            className={`h-7 px-2.5 cursor-pointer border-r border-edge last:border-0 ${guide === g ? "bg-fg text-[var(--color-canvas)]" : "text-fg-muted hover:text-fg"}`}>
                            {g ? `ver ${GUIDE[g].label}` : "16:9"}
                        </button>
                    ))}
                </div>
            </div>

            {groupsOf(items).map((g, k) => (
                <section key={k} className="mt-6">
                    {g.clip && <h3 className="text-[13px] font-medium text-fg mb-2.5">{g.clip}</h3>}
                    <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
                        {g.list.map(({ it, i }) => {
                            const isNew = d.round > 1 && it.changed === d.round;
                            const n = openComments[it.id] ?? 0;
                            return (
                                <div key={it.id} className="group rounded-[var(--radius-md)] border border-edge bg-surface-1 overflow-hidden hover:border-fg/40 transition-colors">
                                    <div className="relative aspect-video bg-[var(--color-surface-2)]">
                                        <button onClick={() => onOpen(i)} aria-label={`Abrir el cuadro ${it.label}`} className="absolute inset-0 cursor-zoom-in">
                                            {it.kind === "video"
                                                ? <video src={backendUrl(it.preview || it.url)} poster={it.poster ? backendUrl(it.poster) : undefined} muted preload="none" className="w-full h-full object-cover" />
                                                : <img src={backendUrl(it.url)} alt={it.label} loading="lazy" className="w-full h-full object-cover" />}
                                        </button>
                                        {guide && (
                                            <span aria-hidden className="pointer-events-none absolute inset-y-0 border-[1.5px]"
                                                style={{ left: `${(100 - GUIDE[guide].w) / 2}%`, width: `${GUIDE[guide].w}%`, borderColor: GUIDE[guide].color }} />
                                        )}
                                        <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-[3px] bg-black/75 text-white font-mono text-[10px]">{it.label}</span>
                                        {it.state === "ok" && <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-white/90 text-[var(--color-success)] font-mono text-[10px]">✓ aprobado</span>}
                                        {it.state === "cambio" && <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-white/90 text-[var(--color-brand)] font-mono text-[10px]">pide cambio</span>}
                                        {!it.state && isNew && <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-white/90 text-fg-muted font-mono text-[10px]">nuevo</span>}
                                        <span className="absolute right-2 bottom-2 flex gap-1 md:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                            <button onClick={() => onOpen(i)} title="Ver grande y comentar" aria-label="Ver grande"
                                                className="h-7 w-7 flex items-center justify-center rounded-[5px] bg-white/95 border border-edge text-fg hover:border-fg cursor-pointer"><Maximize2 size={12} /></button>
                                            <a href={backendUrl(it.url)} download title="Descargar este cuadro" aria-label="Descargar"
                                                className="h-7 w-7 flex items-center justify-center rounded-[5px] bg-white/95 border border-edge text-fg hover:border-fg"><Download size={12} /></a>
                                            {!client && onReplace && (
                                                <button onClick={() => onReplace(it.id)} disabled={busy} title="Reemplazar la imagen de este cuadro (la anterior queda en la versión de antes)"
                                                    className="h-7 px-2 flex items-center gap-1 rounded-[5px] bg-white/95 border border-edge text-fg text-[11px] hover:border-fg cursor-pointer disabled:opacity-50"><Upload size={11} /> Reemplazar</button>
                                            )}
                                        </span>
                                    </div>
                                    <div className="px-3 py-2.5 flex gap-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] text-fg leading-snug">{it.caption || <span className="text-fg-faint">Sin descripción</span>}</p>
                                            {it.time && <p className="mt-0.5 font-mono text-[10px] text-fg-faint">{it.time}</p>}
                                        </div>
                                        <button onClick={() => onOpen(i)} title="Comentarios de este cuadro"
                                            className={`shrink-0 self-start flex items-center gap-1 text-[11px] cursor-pointer ${n ? "text-fg" : "text-fg-faint hover:text-fg"}`}>
                                            <MessageSquare size={12} /> {n || ""}
                                        </button>
                                    </div>
                                    {!closed && mayApprove && (
                                        <div className="px-3 pb-3 flex gap-1.5">
                                            <button disabled={busy} onClick={() => onState(it.id, it.state === "cambio" ? null : "cambio")}
                                                className={`flex-1 h-7 flex items-center justify-center gap-1 rounded-[var(--radius-sm)] border text-[11px] cursor-pointer disabled:opacity-50 ${it.state === "cambio" ? "border-[var(--color-brand)] text-[var(--color-brand)]" : "border-edge text-fg-muted hover:text-fg"}`}>
                                                <RotateCcw size={11} /> Pedir cambio
                                            </button>
                                            <button disabled={busy} onClick={() => onState(it.id, it.state === "ok" ? null : "ok")}
                                                className={`flex-1 h-7 flex items-center justify-center gap-1 rounded-[var(--radius-sm)] border text-[11px] cursor-pointer disabled:opacity-50 ${it.state === "ok" ? "border-[var(--color-success)] text-[var(--color-success)]" : "border-edge text-fg-muted hover:text-fg"}`}>
                                                <Check size={11} /> Aprobar
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            ))}
        </div>
    );
}
