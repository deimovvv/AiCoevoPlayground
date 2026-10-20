import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import { useMe } from "../lib/useMe";
import { backendUrl, listDeliveries, listInbox, type DeliverySummary, type InboxItem } from "../lib/api";

/**
 * Inicio del cliente (studio-v2 §11). Imagen primero: el cliente ve SU contenido.
 * Izquierda: saludo, qué espera su respuesta y los accesos. Derecha: mosaico con las piezas del mes
 * (estado en cada una); si todavía no hay, las imágenes de su marca. Misma estética que la portada.
 */

const mono = "font-mono text-[10px] uppercase tracking-[0.1em]";

function greeting(name?: string | null) {
    const h = new Date().getHours();
    const g = h < 13 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches";
    return name ? `${g}, ${name.split(" ")[0]}` : g;
}
const STATE: Record<string, string> = { en_revision: "Para revisar", cambios: "Con cambios", aprobada: "Aprobada" };

export function ClienteInicioPage() {
    const { activeBrand } = useBrand();
    const me = useMe();
    const [params] = useSearchParams();
    const brandId = activeBrand?.id;
    const [deliveries, setDeliveries] = useState<DeliverySummary[] | null>(null);
    const [inbox, setInbox] = useState<InboxItem[]>([]);

    useEffect(() => {
        if (!brandId) return;
        let alive = true;
        listDeliveries(brandId, "cliente").then((d) => alive && setDeliveries(d)).catch(() => alive && setDeliveries([]));
        listInbox(brandId).then((x) => alive && setInbox(x)).catch(() => {});
        return () => { alive = false; };
    }, [brandId]);

    const id = params.get("id");
    if (id) return <Navigate to={`/cliente/entregas?id=${id}${params.get("lamina") ? `&lamina=${params.get("lamina")}` : ""}`} replace />;

    const list = deliveries || [];
    const waiting = list.filter((d) => d.status !== "aprobada");
    const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
    const thisMonth = list.filter((d) => new Date(d.sentAt ?? d.createdAt ?? 0) >= month);
    const approved = thisMonth.filter((d) => d.status === "aprobada").length;
    const monthName = new Date().toLocaleDateString("es-AR", { month: "long" });
    const pendingMaterial = inbox.filter((i) => i.status === "nuevo").length;

    // Mosaico: primero lo que espera respuesta, después lo del mes, después lo anterior.
    const pieces = [...waiting, ...list.filter((d) => d.status === "aprobada")].filter((d) => d.cover).slice(0, 9);
    // Sin piezas todavía: las imágenes de su marca (moodboard, luz, caras, catálogo).
    const b = activeBrand;
    const brandImgs = b ? [...(b.moodboards || []), ...(b.lookAndFeel || []), ...(b.avatars || []), ...(b.clothing || []), ...(b.products || [])]
        .map((x) => x.imageUrl).filter((u, i, a) => u && a.indexOf(u) === i).slice(0, 9) as string[] : [];

    return (
        <div className="h-full overflow-y-auto lg:overflow-hidden lg:grid lg:grid-cols-[minmax(360px,34%)_minmax(0,1fr)]">
            {/* ── Texto ── */}
            <section className="flex flex-col px-6 md:px-12 py-10 lg:py-14 lg:min-h-0 lg:overflow-y-auto">
                <p className={`${mono} text-fg-faint`}>{b?.name} · {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}</p>
                <h1 className="mt-6 text-[40px] md:text-[54px] leading-[0.98] font-light tracking-[-0.045em] text-fg">{greeting(me.name)}.</h1>
                <p className="mt-4 text-[17px] leading-snug text-fg-muted max-w-[380px]">
                    {deliveries === null ? "…"
                        : waiting.length === 0 ? "Estás al día: no hay nada esperando tu respuesta."
                            : waiting.length === 1 ? "Tenés una pieza para revisar."
                                : `Tenés ${waiting.length} piezas para revisar.`}
                </p>
                {waiting.length > 0 && (
                    <Link to={`/cliente/entregas?id=${waiting[0].id}`}
                        className="mt-7 self-start h-12 px-6 flex items-center gap-2.5 rounded-[4px] bg-[var(--color-action)] text-[var(--color-action-fg)] text-[14px] no-underline">
                        Revisar ahora <ArrowRight size={15} />
                    </Link>
                )}

                <span className="flex-1 min-h-10" />

                <nav className="flex flex-col border-t border-edge" aria-label="Accesos">
                    <Link to="/cliente/entregas" className="group flex items-baseline gap-3 py-4 border-b border-edge no-underline">
                        <span className={`${mono} text-fg-faint w-24 shrink-0`}>{monthName}</span>
                        <span className="flex-1 text-[15px] text-fg">{approved} aprobadas <span className="text-fg-faint">de {thisMonth.length}</span></span>
                        <ArrowRight size={14} className="text-fg-faint group-hover:text-fg" />
                    </Link>
                    <Link to="/cliente/material" className="group flex items-baseline gap-3 py-4 border-b border-edge no-underline">
                        <span className={`${mono} text-fg-faint w-24 shrink-0`}>Material</span>
                        <span className="flex-1 text-[15px] text-fg">Mandanos lo que tengas{pendingMaterial ? <span className="text-fg-faint"> · {pendingMaterial} en revisión</span> : null}</span>
                        <ArrowUpRight size={14} className="text-fg-faint group-hover:text-fg" />
                    </Link>
                    <Link to="/cliente/marca" className="group flex items-baseline gap-3 py-4 border-b border-edge no-underline">
                        <span className={`${mono} text-fg-faint w-24 shrink-0`}>Tu marca</span>
                        <span className="flex-1 text-[15px] text-fg">Así la entendemos</span>
                        <ArrowRight size={14} className="text-fg-faint group-hover:text-fg" />
                    </Link>
                </nav>
                <p className="mt-5 text-[12px] text-fg-faint">El reporte de {monthName} llega a fin de mes.</p>
            </section>

            {/* ── Imagen ── */}
            <section className="relative min-h-[60vh] lg:min-h-0 lg:h-full overflow-hidden bg-[var(--color-surface-2)]">
                {pieces.length > 0 ? (
                    <div className="absolute inset-0 grid gap-1.5 p-1.5" style={{ gridTemplateColumns: `repeat(${pieces.length > 4 ? 3 : 2}, minmax(0, 1fr))`, gridAutoRows: "minmax(0, 1fr)" }}>
                        {pieces.map((d) => (
                            <Link key={d.id} to={`/cliente/entregas?id=${d.id}`} className="group relative overflow-hidden no-underline">
                                <img src={backendUrl(d.cover!)} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                                <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
                                <span className="absolute left-3 right-3 bottom-3 flex items-end gap-2 text-white">
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-[13px] truncate">{d.title}</span>
                                        <span className="block font-mono text-[9.5px] uppercase tracking-[0.1em] text-white/70 mt-0.5">{STATE[d.status]}</span>
                                    </span>
                                    {d.status !== "aprobada" && <span className="w-2 h-2 mb-1 rounded-full bg-[#e5483a]" />}
                                </span>
                            </Link>
                        ))}
                    </div>
                ) : brandImgs.length > 0 ? (
                    <>
                        <div className="absolute inset-0 grid grid-cols-3 gap-1.5 p-1.5" style={{ gridAutoRows: "minmax(0, 1fr)" }}>
                            {brandImgs.map((u, i) => <img key={i} src={backendUrl(u)} alt="" className="w-full h-full object-cover" />)}
                        </div>
                        <span className="absolute inset-0 bg-black/35" />
                        <span className="absolute left-6 bottom-6 right-6 text-white">
                            <span className={`${mono} text-white/70`}>Tu marca</span>
                            <span className="block mt-1 text-[20px] font-light tracking-[-0.02em]">Acá van a aparecer las piezas que hagamos para vos.</span>
                        </span>
                    </>
                ) : null}
            </section>
        </div>
    );
}
