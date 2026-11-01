import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useBrand } from "../lib/BrandContext";
import { CHANNELS, backendUrl, listDeliveries, type DeliverySummary } from "../lib/api";

/**
 * Calendario del cliente (brand-integrations §3, sólo marcas con plan mensual). Se mira, no se
 * edita: las fechas las arma el equipo en Studio. El cliente ve qué sale, cuándo y dónde, y si algo
 * no le sirve lo dice en la pieza. Es la «cola de publicaciones» que NORA le muestra a sus marcas.
 */

const mono = "font-mono text-[10px] uppercase tracking-[0.09em]";
const DAY = 86_400_000;
const startOfWeek = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const fmtDay = (d: Date) => d.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });
const fmtHour = (d: Date) => d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
const channelLabel = (id: string) => CHANNELS.find((c) => c.id === id)?.label ?? id;

function weekTitle(start: Date, now: Date) {
    const diff = Math.round((start.getTime() - startOfWeek(now).getTime()) / (7 * DAY));
    if (diff === 0) return "Esta semana";
    if (diff === 1) return "La semana que viene";
    return `Semana del ${start.toLocaleDateString("es-AR", { day: "numeric", month: "long" })}`;
}

export function ClienteCalendarioPage() {
    const { activeBrand } = useBrand();
    const brandId = activeBrand?.id;
    const [list, setList] = useState<DeliverySummary[] | null>(null);

    useEffect(() => {
        if (!brandId) return;
        let alive = true;
        setList(null);
        listDeliveries(brandId, "cliente").then((d) => alive && setList(d)).catch(() => alive && setList([]));
        return () => { alive = false; };
    }, [brandId]);

    const now = new Date();
    const { weeks, done } = useMemo(() => {
        const items = list ?? [];
        const upcoming = items.filter((d) => d.scheduledAt && !d.publishedAt && d.phase !== "descartada")
            .sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!));
        const byWeek = new Map<number, DeliverySummary[]>();
        for (const d of upcoming) {
            const k = startOfWeek(new Date(d.scheduledAt!)).getTime();
            byWeek.set(k, [...(byWeek.get(k) ?? []), d]);
        }
        return {
            weeks: [...byWeek.entries()].map(([k, items]) => ({ start: new Date(k), items })),
            done: items.filter((d) => d.publishedAt).sort((a, b) => b.publishedAt!.localeCompare(a.publishedAt!)).slice(0, 6),
        };
    }, [list]);

    const Row = ({ d, at }: { d: DeliverySummary; at: string }) => {
        const when = new Date(at);
        return (
            <Link to={`/cliente/entregas?id=${d.id}`}
                className="group flex items-center gap-4 py-3 border-t border-edge no-underline hover:bg-[var(--color-surface-1)] -mx-3 px-3 rounded-[var(--radius-sm)] transition-colors">
                <div className="w-[92px] shrink-0">
                    <p className="text-[13px] text-fg capitalize">{fmtDay(when)}</p>
                    <p className="font-mono text-[11px] text-fg-faint">{fmtHour(when)}</p>
                </div>
                <div className="w-12 h-[60px] shrink-0 rounded-[2px] overflow-hidden bg-[var(--color-surface-2)]">
                    {d.cover && <img src={backendUrl(d.cover)} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[14px] text-fg truncate group-hover:underline underline-offset-2">{d.title}</p>
                    <p className="text-[12px] text-fg-faint truncate">
                        {[d.angle, (d.channels ?? []).map(channelLabel).join(" · ")].filter(Boolean).join(" — ") || "Red a definir"}
                    </p>
                </div>
                {d.phase === "por_revisar" && <span className={`${mono} shrink-0 text-[var(--color-warning)]`}>Falta tu ok</span>}
            </Link>
        );
    };

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-[720px] mx-auto px-5 py-10 md:py-16 flex flex-col">
                <p className={`${mono} text-fg-faint`}>Calendario · {activeBrand?.name}</p>
                <h1 className="mt-3 text-[30px] md:text-[36px] leading-[1.05] font-light tracking-[-0.035em] text-fg">Lo que sale y cuándo.</h1>
                <p className="mt-3 text-[14px] leading-relaxed text-fg-muted max-w-[52ch]">
                    Las fechas las armamos nosotros según la estrategia. Si un día no te sirve o una pieza todavía no la aprobaste, decilo en la pieza y la movemos.
                </p>

                {list === null && <p className="mt-12 text-[13px] text-fg-faint">Cargando…</p>}
                {list && weeks.length === 0 && (
                    <p className="mt-12 py-4 border-t border-edge text-[13px] text-fg-faint">Todavía no hay nada con fecha. Cuando armemos la semana, aparece acá.</p>
                )}
                {weeks.map((w) => (
                    <section key={w.start.getTime()} className="mt-12">
                        <div className="flex items-baseline justify-between pb-2">
                            <h2 className="text-[17px] text-fg">{weekTitle(w.start, now)}</h2>
                            <span className={`${mono} text-fg-faint`}>{w.items.length} {w.items.length === 1 ? "pieza" : "piezas"}</span>
                        </div>
                        {w.items.map((d) => <Row key={d.id} d={d} at={d.scheduledAt!} />)}
                    </section>
                ))}

                {done.length > 0 && (
                    <section className="mt-16">
                        <p className={`${mono} text-fg-faint pb-2`}>Ya salió</p>
                        {done.map((d) => <Row key={d.id} d={d} at={d.publishedAt!} />)}
                    </section>
                )}
            </div>
        </div>
    );
}
