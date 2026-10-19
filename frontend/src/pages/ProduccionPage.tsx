import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useBrand } from "../lib/BrandContext";
import { backendUrl, fetchGenerations, fetchToolPreviews, listDeliveries, type DeliverySummary, type Generation, type ToolPreview } from "../lib/api";

/**
 * Producción (openspec/changes/studio-v2 §1): hacer algo nuevo para la marca y ver qué espera
 * una decisión. Las tools son acciones, no ítems de menú. Carruseles y piezas gráficas se hacen
 * con Claude (skills) y llegan a Entregas.
 */

const mono = "font-mono text-[10px] uppercase tracking-[0.08em]";

const ACTIONS = [
    { id: "fashion_reel", title: "Reel de un look", tool: "Fashion Reel", to: "/dashboard/generate/fashion_reel" },
    { id: "ecommerce_pack", title: "Fichas de catálogo", tool: "Ecommerce Pack", to: "/dashboard/generate/ecommerce_pack" },
    { id: "ugc_creator", title: "Persona a cámara", tool: "UGC", to: "/dashboard/generate/ugc_creator" },
    { id: "video_ad_creator", title: "Aviso con guion", tool: "Video Ad Creator", to: "/dashboard/generate/video_ad_creator" },
    { id: "manual_lab", title: "Probar suelto", tool: "Lab · sin marca", to: "/dashboard/lab" },
];
const TOOL_NAME: Record<string, string> = Object.fromEntries(ACTIONS.map((a) => [a.id, a.tool]));

/** Tarjeta de una tool con su última pieza real: quieta hasta pasar el mouse, ahí se reproduce. */
/** Portadas propias en la estética de Coevo (flash, oficina de noche, 35 mm), una por tool.
 *  Se ven cuando la marca todavía no hizo nada con esa tool: nunca el trabajo de otra marca. */
const COEVO_COVER: Record<string, string> = {
    fashion_reel: "/hero/tools/coevo/fashion-reel.webp",
    ecommerce_pack: "/hero/tools/coevo/ecommerce-pack.webp",
    ugc_creator: "/hero/tools/coevo/ugc-creator.webp",
    video_ad_creator: "/hero/tools/coevo/video-ad-creator.webp",
    manual_lab: "/hero/tools/coevo/manual-lab.webp",
};

/** Tarjeta de una tool: la última pieza de ESTA marca (el video al pasar el mouse) o la portada de Coevo. */
function ToolCard({ a, preview, brandName }: { a: typeof ACTIONS[number]; preview?: ToolPreview; brandName: string }) {
    const [hover, setHover] = useState(false);
    const [broken, setBroken] = useState(false);
    const own = !!preview?.own && !broken;
    const cover = COEVO_COVER[a.id];
    const still = own ? backendUrl(preview!.kind === "video" ? (preview!.poster ?? "") : preview!.url) : cover;
    const playing = own && hover && preview!.kind === "video";
    return (
        <Link to={a.to} className="group flex flex-col gap-2.5 no-underline w-[62vw] max-w-[260px] md:w-auto md:max-w-none shrink-0 snap-start md:min-h-0"
            onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
            <div className="relative aspect-[4/5] md:aspect-auto md:flex-1 md:min-h-0 overflow-hidden rounded-[3px] bg-[var(--color-surface-2)]">
                {still
                    ? <img src={still} alt="" loading="lazy" onError={() => setBroken(true)} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
                    // Video propio sin portada (los del Lab, en Fal): el cuadro sale del video.
                    : own && <video src={`${backendUrl(preview!.url)}#t=0.5`} muted playsInline preload="metadata" onError={() => setBroken(true)} className="absolute inset-0 w-full h-full object-cover" />}
                {playing && <video src={backendUrl(preview!.url)} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" />}
                {own && (
                    <span className="absolute left-2 bottom-2 px-1.5 py-0.5 rounded-[2px] bg-black/55 text-white font-mono text-[9px] uppercase tracking-[0.08em]">
                        Último de {brandName}{preview!.kind === "video" && " · ▶"}
                    </span>
                )}
            </div>
            <span className="flex flex-col gap-0.5">
                <span className="text-[14px] text-fg group-hover:underline underline-offset-4 decoration-1">{a.title}</span>
                <span className="text-[12px] text-fg-faint">{a.tool}</span>
            </span>
        </Link>
    );
}

/** «Montar un video»: un timeline en miniatura (cuadro arriba, pistas abajo, cabezal rojo),
 *  armado con las portadas de Coevo. Dibujo, sin generar nada: se entiende qué es de un vistazo. */
const WAVE = [6, 12, 9, 16, 11, 7, 14, 18, 10, 6, 13, 17, 9, 12, 7, 15, 10, 8, 14, 11, 6, 12, 16, 9];
function EditorCard() {
    const clips = ["fashion_reel", "ugc_creator", "ecommerce_pack", "video_ad_creator"].map((k) => COEVO_COVER[k]);
    return (
        <Link to="/dashboard/editor" className="group flex flex-col gap-2.5 no-underline w-[62vw] max-w-[260px] md:w-auto md:max-w-none shrink-0 snap-start md:min-h-0">
            <div className="relative aspect-[4/5] md:aspect-auto md:flex-1 md:min-h-0 rounded-[3px] bg-[#141414] overflow-hidden flex flex-col p-3 gap-2.5">
                {/* el cuadro */}
                <div className="relative flex-1 min-h-0 rounded-[2px] overflow-hidden bg-black">
                    <img src={clips[1]} alt="" className="absolute inset-0 w-full h-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-[1.03]" />
                    <span className="absolute left-2 right-2 bottom-2 text-center text-white text-[11px] font-medium tracking-[-0.01em] drop-shadow">Nos quedamos con una.</span>
                    <span className="absolute top-1.5 right-2 font-mono text-[9px] text-white/70">00:06</span>
                </div>
                {/* las pistas */}
                <div className="relative shrink-0 flex flex-col gap-1">
                    <div className="flex gap-[2px] h-7">
                        {clips.map((c, i) => (
                            <img key={i} src={c} alt="" className="h-full object-cover rounded-[1px]" style={{ flex: [1.4, 1, 0.8, 1.2][i] }} />
                        ))}
                    </div>
                    <div className="flex gap-1 h-2.5">
                        <span className="rounded-[1px] bg-[#c8402a]/80" style={{ flex: 1.2 }} />
                        <span style={{ flex: 0.6 }} />
                        <span className="rounded-[1px] bg-white/35" style={{ flex: 1.6 }} />
                        <span style={{ flex: 1 }} />
                    </div>
                    <div className="flex items-center gap-[2px] h-4">
                        {WAVE.map((h, i) => <span key={i} className="flex-1 rounded-full bg-white/30" style={{ height: h }} />)}
                    </div>
                    {/* cabezal */}
                    <span className="absolute -top-1 bottom-0 left-[38%] w-px bg-[#e5483a] transition-[left] duration-[1500ms] ease-out group-hover:left-[72%]" />
                    <span className="absolute -top-1.5 left-[38%] -translate-x-1/2 w-1.5 h-1.5 rotate-45 bg-[#e5483a] transition-[left] duration-[1500ms] ease-out group-hover:left-[72%]" />
                </div>
            </div>
            <span className="flex flex-col gap-0.5">
                <span className="text-[14px] text-fg group-hover:underline underline-offset-4 decoration-1">Montar un video</span>
                <span className="text-[12px] text-fg-faint">Editor · clips, textos y música</span>
            </span>
        </Link>
    );
}

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
    const [previews, setPreviews] = useState<Record<string, ToolPreview>>({});

    useEffect(() => {
        if (!brandId) return;
        let alive = true;
        fetchGenerations(brandId).then((g) => alive && setSummary(summarize(g))).catch(() => alive && setSummary(summarize([])));
        listDeliveries(brandId).then((d) => alive && setDeliveries(d)).catch(() => alive && setDeliveries([]));
        fetchToolPreviews(brandId).then((p) => alive && setPreviews(p));
        return () => { alive = false; };
    }, [brandId]);

    const { open = [], monthCost = 0, monthCount = 0 } = summary ?? {};
    const waiting = deliveries.filter((d) => d.status !== "aprobada");

    if (!activeBrand) return <p className="p-8 text-[14px] text-fg-muted">Elegí una marca arriba.</p>;

    return (
        // Pantalla entera: las tools llenan la parte de arriba (≈60 %), las listas abajo.
        <div className="md:h-full flex flex-col gap-8 px-4 py-6 md:px-10 md:py-8 md:min-h-0">
            <section className="flex flex-col gap-3.5 md:flex-[1.5] md:min-h-0">
                <p className={`${mono} text-fg-faint`}>Hacer algo nuevo para {activeBrand.name}</p>
                <div className="flex md:grid gap-4 md:grid-cols-6 overflow-x-auto md:overflow-visible snap-x -mx-4 px-4 md:mx-0 md:px-0 md:flex-1 md:min-h-0">
                    {ACTIONS.map((a) => <ToolCard key={a.id} a={a} preview={previews[a.id]} brandName={activeBrand.name} />)}
                    <EditorCard />
                </div>
                <p className="text-[12px] text-fg-muted">
                    Carruseles y piezas gráficas se hacen con Claude (skills) y llegan a <Link to="/dashboard/entregas" className="text-fg">Entregas</Link>.
                </p>
            </section>

            <div className="grid gap-10 grid-cols-1 lg:grid-cols-2 md:flex-1 md:min-h-0">
                <section className="flex flex-col md:min-h-0 md:overflow-y-auto">
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

                <section className="flex flex-col md:min-h-0 md:overflow-y-auto">
                    <div className="flex flex-wrap items-baseline gap-2.5 pb-2.5 border-b border-edge">
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

            <p className="shrink-0 text-[12px] text-fg-muted flex flex-wrap gap-x-4 gap-y-1">
                <span className="text-fg-faint">También:</span>
                <Link to="/dashboard/campanas" className="text-fg-muted hover:text-fg">Campañas</Link>
                <Link to="/dashboard/content" className="text-fg-muted hover:text-fg">Todo lo producido</Link>
                <Link to="/dashboard/generate" className="text-fg-muted hover:text-fg">Todas las tools</Link>
            </p>
        </div>
    );
}
