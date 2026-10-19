import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useBrand } from "../lib/BrandContext";
import { backendUrl, fetchGenerations, listDeliveries, type DeliverySummary, type Generation } from "../lib/api";

/**
 * Producción (openspec/changes/studio-v2 §1): hacer algo nuevo para la marca y ver qué espera
 * una decisión. Las tools son acciones, no ítems de menú. Carruseles y piezas gráficas se hacen
 * con Claude (skills) y llegan a Entregas.
 */

const mono = "font-mono text-[10px] uppercase tracking-[0.08em]";

const ACTIONS = [
    { title: "Reel de un look", tool: "Fashion Reel", to: "/dashboard/generate/fashion_reel" },
    { title: "Fichas de catálogo", tool: "Ecommerce Pack", to: "/dashboard/generate/ecommerce_pack" },
    { title: "Persona a cámara", tool: "UGC", to: "/dashboard/generate/ugc_creator" },
    { title: "Aviso con guion", tool: "Video Ad Creator", to: "/dashboard/generate/video_ad_creator" },
];
const TOOL_NAME: Record<string, string> = Object.fromEntries(ACTIONS.map((a) => [a.to.split("/").pop()!, a.tool]));
const RECENT_DAYS = 30;

const ago = (iso: string) => {
    const d = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
    return d <= 0 ? "hoy" : d === 1 ? "ayer" : `hace ${d} días`;
};
const usd = (n: number) => `US$ ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Summary { open: Generation[]; monthCost: number; monthCount: number }

/** Corridas abiertas recientes y gasto del mes (se calcula al llegar los datos, no en cada render). */
function summarize(list: Generation[]): Summary {
    const since = Date.now() - RECENT_DAYS * 86400000;
    const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
    const thisMonth = list.filter((g) => new Date(g.createdAt) >= month);
    return {
        open: list.filter((g) => g.status === "in_progress" && new Date(g.createdAt).getTime() >= since).slice(0, 8),
        monthCost: thisMonth.reduce((s, g) => s + (g.cost?.usd ?? 0), 0),
        monthCount: thisMonth.length,
    };
}

export function ProduccionPage() {
    const { activeBrand } = useBrand();
    const brandId = activeBrand?.id;
    const [summary, setSummary] = useState<Summary | null>(null);
    const [deliveries, setDeliveries] = useState<DeliverySummary[]>([]);

    useEffect(() => {
        if (!brandId) return;
        let alive = true;
        fetchGenerations(brandId).then((g) => alive && setSummary(summarize(g))).catch(() => alive && setSummary(summarize([])));
        listDeliveries(brandId).then((d) => alive && setDeliveries(d)).catch(() => alive && setDeliveries([]));
        return () => { alive = false; };
    }, [brandId]);

    const { open = [], monthCost = 0, monthCount = 0 } = summary ?? {};
    const waiting = deliveries.filter((d) => d.status !== "aprobada");

    if (!activeBrand) return <p className="text-[14px] text-fg-muted">Elegí una marca arriba.</p>;

    return (
        <div className="flex flex-col gap-10">
            <section className="flex flex-col gap-3.5">
                <p className={`${mono} text-fg-faint`}>Hacer algo nuevo para {activeBrand.name}</p>
                <div className="grid gap-2.5 grid-cols-2 lg:grid-cols-5">
                    {ACTIONS.map((a) => (
                        <Link key={a.to} to={a.to}
                            className="h-[76px] px-4 flex flex-col justify-center gap-1 rounded-[var(--radius-md)] border border-edge bg-[var(--color-surface-1)] hover:border-[var(--color-edge-strong)] no-underline">
                            <span className="text-[15px] font-medium text-fg">{a.title}</span>
                            <span className="text-[12px] text-fg-faint">{a.tool}</span>
                        </Link>
                    ))}
                    <Link to="/dashboard/editor"
                        className="h-[76px] px-4 flex flex-col justify-center gap-1 rounded-[var(--radius-md)] bg-[var(--color-action)] no-underline">
                        <span className="text-[15px] font-medium text-[var(--color-action-fg)]">Montar un video</span>
                        <span className="text-[12px] text-[var(--color-action-fg)] opacity-60">Editor · con lo que ya hay</span>
                    </Link>
                </div>
                <p className="text-[12px] text-fg-muted">
                    Carruseles y piezas gráficas se hacen con Claude (skills) y llegan a <Link to="/dashboard/entregas" className="text-fg">Entregas</Link>.
                </p>
            </section>

            <div className="grid gap-10 grid-cols-1 lg:grid-cols-2">
                <section className="flex flex-col">
                    <div className="flex items-baseline gap-2.5 pb-2.5 border-b border-edge">
                        <h2 className="text-[20px] text-fg">Espera una respuesta</h2>
                        <span className="font-mono text-[11px] text-[var(--color-brand)]">{waiting.length || ""}</span>
                    </div>
                    {waiting.length === 0 && <p className="py-4 text-[13px] text-fg-faint">Nada pendiente en Entregas.</p>}
                    {waiting.map((d) => (
                        <Link key={d.id} to={`/dashboard/entregas?id=${d.id}`}
                            className="flex items-center gap-4 py-3 border-b border-[var(--color-edge-subtle)] no-underline">
                            <span className="w-12 h-[60px] shrink-0 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] overflow-hidden">
                                {d.cover && <img src={backendUrl(d.cover)} alt="" className="w-full h-full object-cover" />}
                            </span>
                            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                                <span className="text-[14px] text-fg truncate">{d.title}</span>
                                <span className="text-[12px] text-fg-faint">
                                    {d.status === "cambios" ? "Pidieron cambios" : "Para revisar"}
                                    {d.openComments ? ` · ${d.openComments} comentarios` : ""} · {d.updatedAt ? ago(d.updatedAt) : ""}
                                </span>
                            </span>
                            <span className="text-[12px] text-fg">Revisar →</span>
                        </Link>
                    ))}
                </section>

                <section className="flex flex-col">
                    <div className="flex items-baseline gap-2.5 pb-2.5 border-b border-edge">
                        <h2 className="text-[20px] text-fg">Sin terminar</h2>
                        <span className="font-mono text-[11px] text-fg-faint">{open.length || ""}</span>
                        <span className="flex-1" />
                        <span className={`${mono} text-fg-faint`}>Este mes · {monthCount} corridas · {usd(monthCost)}</span>
                    </div>
                    {summary === null && <p className="py-4 text-[13px] text-fg-faint">Cargando…</p>}
                    {summary !== null && open.length === 0 && <p className="py-4 text-[13px] text-fg-faint">No hay corridas abiertas en los últimos {RECENT_DAYS} días.</p>}
                    {open.map((g) => (
                        <Link key={g.id} to={`/dashboard/generate/${g.toolId}?gen=${g.id}`}
                            className="flex items-center gap-4 py-3 border-b border-[var(--color-edge-subtle)] no-underline">
                            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                                <span className="text-[14px] text-fg truncate">{g.title}</span>
                                <span className="text-[12px] text-fg-faint">{TOOL_NAME[g.toolId] ?? g.toolId} · {ago(g.createdAt)}</span>
                            </span>
                            {g.cost?.usd ? <span className="font-mono text-[11px] text-fg-muted">{usd(g.cost.usd)}</span> : null}
                            <span className="text-[12px] text-fg">Seguir →</span>
                        </Link>
                    ))}
                </section>
            </div>

            <p className="text-[12px] text-fg-muted flex flex-wrap gap-x-4 gap-y-1">
                <span className="text-fg-faint">También:</span>
                <Link to="/dashboard/campanas" className="text-fg-muted hover:text-fg">Campañas</Link>
                <Link to="/dashboard/content" className="text-fg-muted hover:text-fg">Todo lo producido</Link>
                <Link to="/dashboard/generate" className="text-fg-muted hover:text-fg">Todas las tools</Link>
                <Link to="/dashboard/lab" className="text-fg-muted hover:text-fg">Lab (sin marca)</Link>
            </p>
        </div>
    );
}
