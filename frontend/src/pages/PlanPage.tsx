import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import { CHANNELS, backendUrl, listDeliveries, setDeliveryPlan } from "../lib/api";
import type { Channel, DeliveryPhase, DeliverySummary } from "../lib/api";
import { PublishControls } from "../components/workspace/PublishControls";
import { ConfirmWeekDialog } from "../components/workspace/ConfirmWeekDialog";
import { LearningView } from "../components/workspace/LearningView";
import { useConfirm } from "../lib/useConfirm";

/**
 * El plan de una marca (changes/brand-integrations §3): las piezas por fase (tablero), y lo que sale cada
 * semana y cada mes, con el ángulo que toca según la estrategia. Arrastrar una pieza a un día le pone fecha
 * prevista; tocarla deja elegir hora y redes; «Distribuir» llena los días libres con lo aprobado. Todo es una
 * propuesta: no publica nada (confirmar y mandar a Postiz es 3.5).
 */

type View = "tablero" | "semana" | "mes" | "aprendizaje";
const PHASES: { id: DeliveryPhase; label: string }[] = [
    { id: "en_desarrollo", label: "En desarrollo" },
    { id: "por_revisar", label: "Por revisar" },
    { id: "lista", label: "Lista" },
    { id: "en_postiz", label: "En Postiz" },
    { id: "publicada", label: "Publicada" },
];
const DAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const HOUR = 13; // hora por defecto al soltar una pieza en un día

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const monthKey = (d: Date) => dayKey(d).slice(0, 7);
function startOfWeek(d: Date) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x;
}
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export function PlanPage() {
    const { activeBrand, refreshBrands } = useBrand();
    const [dialog, ask] = useConfirm();
    const [confirming, setConfirming] = useState(false);
    const navigate = useNavigate();
    const [view, setView] = useState<View>("semana");
    const [list, setList] = useState<DeliverySummary[]>([]);
    const [anchor, setAnchor] = useState(() => new Date());
    const [error, setError] = useState<string | null>(null);
    const [over, setOver] = useState<string | null>(null);
    const [sel, setSel] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const brandId = activeBrand?.id;

    const load = useCallback(async () => {
        if (!brandId) return;
        try { setList(await listDeliveries(brandId)); setError(null); } catch (e) { setError((e as Error).message); }
    }, [brandId]);
    useEffect(() => { load(); }, [load]);

    const strategy = activeBrand?.strategy;
    const momentOf = useCallback((d: Date) => strategy?.calendar?.find((m) => m.when === monthKey(d)) ?? null, [strategy]);
    const byDay = useMemo(() => {
        const m = new Map<string, DeliverySummary[]>();
        for (const d of list) {
            if (!d.scheduledAt || d.phase === "descartada") continue;
            const k = dayKey(new Date(d.scheduledAt));
            m.set(k, [...(m.get(k) ?? []), d]);
        }
        return m;
    }, [list]);
    // Lo que se puede poner en el calendario: lo aprobado sin fecha, y lo que está en camino (con fecha tentativa).
    const unscheduled = list.filter((d) => !d.scheduledAt && (d.phase === "lista" || d.phase === "por_revisar" || d.phase === "en_desarrollo"));

    const drop = (day: Date, id: string) => {
        setOver(null);
        const when = new Date(day.getFullYear(), day.getMonth(), day.getDate(), HOUR);
        setDeliveryPlan(id, { scheduledAt: when.toISOString() }).then(load).catch((e) => setError((e as Error).message));
    };
    const plan = (id: string, p: { scheduledAt?: string | null; channels?: Channel[] }) =>
        setDeliveryPlan(id, p).then(load).catch((e) => setError((e as Error).message));
    const unschedule = (id: string) => setDeliveryPlan(id, { scheduledAt: null }).then(load).catch((e) => setError((e as Error).message));

    if (!activeBrand) return <div className="h-full flex items-center justify-center text-[13px] text-fg-muted">Elegí una marca.</div>;

    const Card = ({ d, compact }: { d: DeliverySummary; compact?: boolean }) => (
        <div draggable={d.phase !== "en_postiz" && d.phase !== "publicada"}
            onDragStart={(e) => e.dataTransfer.setData("text/plain", d.id)}
            onClick={() => setSel(d.id)}
            title={d.phase === "lista" ? "Arrastrala a un día" : "Todavía no está aprobada: la fecha es tentativa"}
            className={`group flex gap-2 p-1.5 rounded-[var(--radius-sm)] bg-surface-1 border ${sel === d.id ? "border-fg" : "border-edge"} hover:border-fg/30 cursor-pointer ${d.phase !== "lista" && d.phase !== "en_postiz" && d.phase !== "publicada" ? "border-dashed" : ""}`}>
            {d.cover && <img src={backendUrl(d.cover)} alt="" className={`${compact ? "w-6 h-8" : "w-9 h-11"} shrink-0 rounded-[2px] object-cover`} />}
            <span className="min-w-0 flex-1">
                <span className="block text-[12px] text-fg leading-snug line-clamp-2">{d.title}</span>
                {!compact && <span className="block mt-0.5 text-[10px] text-fg-faint truncate">{d.angle ?? "sin ángulo"}</span>}
                {d.scheduledAt && (
                    <span className="block mt-0.5 text-[10px] text-fg-muted tabular-nums truncate">
                        {new Date(d.scheduledAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}
                        {d.channels?.length ? ` · ${d.channels.map((c) => CHANNELS.find((x) => x.id === c)?.label ?? c).join(", ")}` : " · sin red"}
                    </span>
                )}
            </span>
            {d.scheduledAt && d.phase !== "en_postiz" && d.phase !== "publicada" && (
                <button onClick={(e) => { e.stopPropagation(); unschedule(d.id); }} title="Sacarle la fecha"
                    className="self-start text-[11px] text-fg-faint hover:text-fg opacity-0 group-hover:opacity-100 cursor-pointer">×</button>
            )}
        </div>
    );

    const dayCell = (day: Date, inMonth = true, tall = false) => {
        const k = dayKey(day);
        const items = byDay.get(k) ?? [];
        const today = k === dayKey(new Date());
        return (
            <div key={k} onDragOver={(e) => { e.preventDefault(); setOver(k); }} onDragLeave={() => setOver((o) => (o === k ? null : o))}
                onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (id) drop(day, id); }}
                className={`flex flex-col gap-1.5 p-2 border-r border-b border-edge ${tall ? "min-h-[320px]" : "min-h-[110px]"} ${over === k ? "bg-[var(--color-brand-subtle)]" : ""} ${inMonth ? "" : "opacity-40"}`}>
                <span className={`text-[11px] tabular-nums ${today ? "text-[var(--color-brand)]" : "text-fg-faint"}`}>
                    {tall && `${DAYS[(day.getDay() + 6) % 7]} `}{day.getDate()}
                </span>
                {items.map((d) => <Card key={d.id} d={d} compact={!tall} />)}
            </div>
        );
    };

    const moment = momentOf(anchor);
    /** Lo aprobado sin fecha va a los días hábiles libres que se ven, desde mañana; primero lo del ángulo del mes. */
    const distribute = async () => {
        const tomorrow = addDays(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()), 1);
        const days = (view === "semana"
            ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i))
            : Array.from({ length: 31 }, (_, i) => addDays(new Date(anchor.getFullYear(), anchor.getMonth(), 1), i)).filter((d) => d.getMonth() === anchor.getMonth()))
            .filter((d) => d >= tomorrow && d.getDay() !== 0 && d.getDay() !== 6 && !(byDay.get(dayKey(d))?.length));
        const ready = list.filter((d) => d.phase === "lista" && !d.scheduledAt)
            .sort((a, b) => Number(b.angle === moment?.angle) - Number(a.angle === moment?.angle));
        const n = Math.min(days.length, ready.length);
        if (!ready.length) { setNotice("No hay piezas aprobadas sin fecha."); return; }
        if (!n) { setNotice("No quedan días hábiles libres en lo que estás viendo."); return; }
        try {
            for (let i = 0; i < n; i++) {
                const day = days[i];
                await setDeliveryPlan(ready[i].id, { scheduledAt: new Date(day.getFullYear(), day.getMonth(), day.getDate(), HOUR).toISOString() });
            }
            setNotice(`Propuse fecha para ${n} ${n === 1 ? "pieza" : "piezas"}. Revisalas: nada se publica hasta confirmar.`);
            await load();
        } catch (e) { setError((e as Error).message); }
    };
    const selected = list.find((d) => d.id === sel) ?? null;
    const weekStart = startOfWeek(anchor);
    const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const gridStart = startOfWeek(monthStart);
    const step = (n: number) => setAnchor((a) => view === "mes" ? new Date(a.getFullYear(), a.getMonth() + n, 1) : addDays(a, 7 * n));
    const title = view === "mes"
        ? (([m, ...r]) => m.toUpperCase() + r.join(""))(anchor.toLocaleDateString("es-AR", { month: "long", year: "numeric" }))
        : `${weekStart.toLocaleDateString("es-AR", { day: "numeric", month: "short" })} – ${addDays(weekStart, 6).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}`;

    return (
        <div className="h-full flex flex-col min-h-0">
            <header className="px-4 md:px-6 py-4 border-b border-edge flex flex-wrap items-end gap-x-6 gap-y-3">
                <div className="min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-faint">Plan · {activeBrand.name}</p>
                    <h1 className="mt-1 text-[22px] text-fg">
                        {strategy?.claim ?? "Sin estrategia cargada"}
                        {strategy?.hashtag && <span className="text-fg-muted"> {strategy.hashtag}</span>}
                    </h1>
                    {(view === "semana" || view === "mes") && (
                        <p className="mt-1 text-[12px] text-fg-muted max-w-[720px]">
                            {moment ? <>Este mes: <span className="text-fg">{moment.angle ?? "—"}</span> · {moment.what}</>
                                : strategy ? "La estrategia no dice nada para este mes." : <>Cargala en la ficha de la marca (o pedile a Claude el spec de campaña).</>}
                        </p>
                    )}
                </div>
                <span className="flex-1" />
                <div className="flex gap-0.5 p-0.5 bg-[var(--color-surface-2)] rounded-[5px] text-[12px]" role="tablist">
                    {(["tablero", "semana", "mes", "aprendizaje"] as View[]).map((v) => (
                        <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
                            className={`h-7 px-3 rounded-[4px] capitalize cursor-pointer ${view === v ? "bg-[var(--color-surface-1)] text-fg" : "text-fg-muted"}`}>{v}</button>
                    ))}
                </div>
                <Link to="/dashboard/entregas" className="text-[12px] text-fg-muted hover:text-fg no-underline">Entregas →</Link>
            </header>
            {error && <p className="px-6 py-2 text-[12px] text-[var(--color-error)]">{error}</p>}

            {dialog}
            {confirming && (
                <ConfirmWeekDialog brandId={activeBrand.id} label={title}
                    start={view === "mes" ? monthStart : weekStart}
                    end={view === "mes" ? new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1) : addDays(weekStart, 7)}
                    onClose={() => setConfirming(false)} onDone={load} />
            )}
            {view === "aprendizaje" ? (
                <LearningView brand={activeBrand} ask={ask} onBrandChanged={refreshBrands} />
            ) : view === "tablero" ? (
                <div className="flex-1 min-h-0 overflow-x-auto">
                    <div className="h-full grid grid-cols-[repeat(5,minmax(200px,1fr))]">
                        {PHASES.map((ph) => {
                            const items = list.filter((d) => d.phase === ph.id);
                            return (
                                <section key={ph.id} className="flex flex-col min-h-0 border-r border-edge">
                                    <p className="px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-fg-faint">{ph.label} · {items.length}</p>
                                    <div className="flex-1 overflow-y-auto px-2 pb-3 flex flex-col gap-1.5">
                                        {items.map((d) => <Card key={d.id} d={d} />)}
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                    {list.some((d) => d.phase === "pausada" || d.phase === "descartada") && (
                        <p className="px-4 py-2 text-[11px] text-fg-faint">
                            Pausadas: {list.filter((d) => d.phase === "pausada").length} · Descartadas: {list.filter((d) => d.phase === "descartada").length}
                        </p>
                    )}
                </div>
            ) : (
                <div className="flex-1 min-h-0 flex">
                    <div className="flex-1 min-w-0 overflow-y-auto">
                        <div className="px-4 py-2 flex items-center gap-2 border-b border-edge">
                            <button onClick={() => step(-1)} aria-label="Anterior" className="w-7 h-7 flex items-center justify-center text-fg-muted hover:text-fg cursor-pointer"><ChevronLeft size={14} /></button>
                            <button onClick={() => step(1)} aria-label="Siguiente" className="w-7 h-7 flex items-center justify-center text-fg-muted hover:text-fg cursor-pointer"><ChevronRight size={14} /></button>
                            <span className="text-[13px] text-fg">{title}</span>
                            <button onClick={() => setAnchor(new Date())} className="ml-2 text-[11px] text-fg-faint hover:text-fg cursor-pointer">Hoy</button>
                            <span className="flex-1" />
                            {notice && <span className="text-[11px] text-fg-muted">{notice}</span>}
                            <button onClick={distribute} title="Pone lo aprobado sin fecha en los días hábiles libres, primero lo del ángulo del mes"
                                className="h-7 px-3 rounded-[var(--radius-sm)] border border-edge text-[12px] text-fg-muted hover:text-fg hover:border-fg cursor-pointer">Distribuir</button>
                            <button onClick={() => setConfirming(true)} title="Ver lo que sale y programarlo en Postiz"
                                className="h-7 px-3 rounded-[var(--radius-sm)] bg-fg text-[var(--color-canvas)] text-[12px] cursor-pointer">Confirmar {view === "mes" ? "el mes" : "la semana"}</button>
                        </div>
                        {view === "mes" && (
                            <div className="grid grid-cols-7 border-l border-edge">
                                {DAYS.map((d) => <span key={d} className="px-2 py-1.5 font-mono text-[10px] uppercase text-fg-faint border-r border-b border-edge">{d}</span>)}
                            </div>
                        )}
                        <div className="grid grid-cols-7 border-l border-edge">
                            {view === "semana"
                                ? Array.from({ length: 7 }, (_, i) => dayCell(addDays(weekStart, i), true, true))
                                : Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
                                    .filter((d, i) => i < 35 || d.getMonth() === monthStart.getMonth())
                                    .map((d) => dayCell(d, d.getMonth() === monthStart.getMonth()))}
                        </div>
                    </div>
                    <aside className="w-[300px] shrink-0 border-l border-edge flex flex-col min-h-0">
                        {selected && (
                            <div className="p-3 border-b border-edge bg-surface-1">
                                <div className="flex items-start gap-2">
                                    {selected.cover && <img src={backendUrl(selected.cover)} alt="" className="w-9 h-11 rounded-[2px] object-cover" />}
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-[13px] text-fg leading-snug">{selected.title}</span>
                                        <span className="block text-[10px] text-fg-faint">{selected.angle ?? "sin ángulo"}</span>
                                    </span>
                                    <button onClick={() => setSel(null)} aria-label="Cerrar" className="text-fg-faint hover:text-fg cursor-pointer">×</button>
                                </div>
                                <div className="mt-3">
                                    <PublishControls d={selected} onChange={(p) => plan(selected.id, p)} />
                                </div>
                                <button onClick={() => navigate(`/dashboard/entregas?id=${selected.id}`)} className="mt-3 text-[11px] text-fg-muted hover:text-fg cursor-pointer">Abrir la entrega →</button>
                            </div>
                        )}
                        <p className="px-3 pt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-fg-faint">Sin fecha · {unscheduled.length}</p>
                        <p className="px-3 pt-1 pb-2 text-[11px] text-fg-faint leading-snug">Arrastralas a un día. La fecha es una propuesta: no se publica nada.</p>
                        <div className="flex-1 overflow-y-auto px-2 pb-3 flex flex-col gap-1.5">
                            {unscheduled.map((d) => <Card key={d.id} d={d} />)}
                        </div>
                        {strategy?.angles?.length ? (
                            <div className="border-t border-edge px-3 py-3">
                                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-faint">Ángulos</p>
                                <ul className="mt-1.5 flex flex-col gap-1">
                                    {strategy.angles.map((a) => {
                                        const n = list.filter((d) => d.angle === a.name && d.phase !== "descartada").length;
                                        return <li key={a.name} title={a.purpose} className="flex text-[11px]"><span className="flex-1 text-fg-muted truncate">{a.name}</span><span className="tabular-nums text-fg-faint">{n}</span></li>;
                                    })}
                                </ul>
                            </div>
                        ) : null}
                    </aside>
                </div>
            )}
        </div>
    );
}
