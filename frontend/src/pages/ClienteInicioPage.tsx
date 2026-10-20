import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import { useMe } from "../lib/useMe";
import { backendUrl, listDeliveries, listInbox, type DeliverySummary, type InboxItem } from "../lib/api";

/**
 * Inicio del cliente (studio-v2 §11): lo que le importa al entrar, nada más.
 * Qué espera su respuesta · qué se hizo este mes · lo que mandó · su marca.
 */

const mono = "font-mono text-[10px] uppercase tracking-[0.09em]";

function greeting(name?: string | null) {
    const h = new Date().getHours();
    const g = h < 13 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches";
    return name ? `${g}, ${name.split(" ")[0]}.` : `${g}.`;
}

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

    // Links viejos a una entrega (/cliente?id=…) van a Entregas.
    const id = params.get("id");
    if (id) return <Navigate to={`/cliente/entregas?id=${id}${params.get("lamina") ? `&lamina=${params.get("lamina")}` : ""}`} replace />;

    const list = deliveries || [];
    const waiting = list.filter((d) => d.status !== "aprobada");
    const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
    const thisMonth = list.filter((d) => new Date(d.sentAt ?? d.createdAt ?? 0) >= month);
    const approved = thisMonth.filter((d) => d.status === "aprobada").length;
    const monthName = new Date().toLocaleDateString("es-AR", { month: "long" });
    const pendingMaterial = inbox.filter((i) => i.status === "nuevo").length;

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-[1100px] mx-auto px-5 md:px-10 py-10 md:py-16">
                <p className={`${mono} text-fg-faint`}>{activeBrand?.name} · {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}</p>
                <h1 className="mt-3 text-[34px] md:text-[48px] leading-[1.02] font-light tracking-[-0.04em] text-fg">
                    {greeting(me.name)}<br />
                    <span className="text-fg-muted">
                        {deliveries === null ? "…"
                            : waiting.length === 0 ? "No hay nada esperando tu respuesta."
                                : waiting.length === 1 ? "Hay una pieza esperando tu respuesta."
                                    : `Hay ${waiting.length} piezas esperando tu respuesta.`}
                    </span>
                </h1>

                {/* Lo que espera respuesta */}
                {waiting.length > 0 && (
                    <section className="mt-10 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                        {waiting.slice(0, 6).map((d) => (
                            <Link key={d.id} to={`/cliente/entregas?id=${d.id}`} className="group no-underline flex flex-col gap-3">
                                <div className="aspect-[4/5] rounded-[3px] overflow-hidden bg-[var(--color-surface-2)]">
                                    {d.cover && <img src={backendUrl(d.cover)} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />}
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-[15px] text-fg truncate">{d.stage ? <span className="text-fg-muted">{d.stage} · </span> : null}{d.title}</span>
                                        <span className="block text-[12px] text-fg-faint mt-0.5">
                                            {d.campaignName ? `${d.campaignName} · ` : ""}{d.items} {d.items === 1 ? "pieza" : "láminas"}{d.status === "cambios" ? " · pediste cambios" : ""}
                                        </span>
                                    </span>
                                    <span className="text-[13px] text-fg flex items-center gap-1 group-hover:gap-2 transition-[gap]">Revisar <ArrowRight size={13} /></span>
                                </div>
                            </Link>
                        ))}
                    </section>
                )}

                {/* El mes, lo que mandó, su marca */}
                <section className="mt-14 grid grid-cols-1 md:grid-cols-3 border-t border-edge">
                    <Link to="/cliente/entregas" className="no-underline py-6 md:pr-8 border-b md:border-b-0 md:border-r border-edge flex flex-col gap-2 group">
                        <span className={`${mono} text-fg-faint`}>Este mes · {monthName}</span>
                        <span className="text-[30px] font-light tracking-[-0.03em] text-fg">{approved} <span className="text-fg-faint text-[18px]">aprobadas de {thisMonth.length}</span></span>
                        <span className="text-[13px] text-fg-muted group-hover:text-fg">Ver todas las entregas →</span>
                    </Link>
                    <Link to="/cliente/material" className="no-underline py-6 md:px-8 border-b md:border-b-0 md:border-r border-edge flex flex-col gap-2 group">
                        <span className={`${mono} text-fg-faint`}>Material</span>
                        <span className="text-[17px] leading-snug text-fg">¿Tenés fotos, productos nuevos o referencias?</span>
                        <span className="text-[13px] text-fg-muted group-hover:text-fg flex items-center gap-1">
                            Mandanos lo que tengas <ArrowUpRight size={13} />{pendingMaterial ? <span className="text-fg-faint"> · {pendingMaterial} en revisión</span> : null}
                        </span>
                    </Link>
                    <Link to="/cliente/marca" className="no-underline py-6 md:pl-8 flex flex-col gap-2 group">
                        <span className={`${mono} text-fg-faint`}>Tu marca</span>
                        <span className="text-[17px] leading-snug text-fg">Así entendemos tu marca: colores, fotos, quiénes aparecen.</span>
                        <span className="text-[13px] text-fg-muted group-hover:text-fg">Revisar →</span>
                    </Link>
                </section>

                <p className="mt-10 text-[12px] text-fg-faint">El reporte de {monthName} llega a fin de mes, como una entrega.</p>
            </div>
        </div>
    );
}
