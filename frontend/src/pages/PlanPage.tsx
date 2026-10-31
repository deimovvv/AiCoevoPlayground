import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
 * El plan de una marca (changes/brand-integrations §3): un calendario de verdad. La semana tiene horas: soltar
 * una pieza en un horario le pone fecha y hora; tocarla deja elegir hora y redes. El mes muestra las piezas con
 * su imagen. «Distribuir» llena los días libres con lo aprobado. Todo es una propuesta: no se publica nada
 * hasta confirmar (y mandar a Postiz es 3.5).
 */

type View = "semana" | "mes" | "tablero" | "aprendizaje";
const PHASES: { id: DeliveryPhase; label: string }[] = [
    { id: "en_desarrollo", label: "En desarrollo" },
    { id: "por_revisar", label: "Por revisar" },
    { id: "lista", label: "Lista" },
    { id: "en_postiz", label: "En Postiz" },
    { id: "publicada", label: "Publicada" },
];
const DAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const FIRST_HOUR = 7, LAST_HOUR = 23, ROW = 64;   // la semana: de 7 a 23, 64 px por hora
const DEFAULT_HOUR = 13;                         // al soltar en el mes o al distribuir
const CARD_H = ROW * 2.25;                       // cada pieza ocupa ~2 h de alto: que la imagen se vea

/** Piezas que se pisan en un día van una al lado de la otra (como un calendario): carril y cuántos hay. */
function lanes(items: DeliverySummary[]) {
    const pos = (d: DeliverySummary) => { const t = new Date(d.scheduledAt!); return (t.getHours() + t.getMinutes() / 60 - FIRST_HOUR) * ROW; };
    const out = new Map<string, { lane: number; of: number }>();
    let group: { d: DeliverySummary; lane: number }[] = [], groupEnd = -Infinity, ends: number[] = [];
    const flush = () => { const of = Math.max(1, ...group.map((g) => g.lane + 1)); group.forEach((g) => out.set(g.d.id, { lane: g.lane, of })); };
    for (const d of items) {
        const top = pos(d);
        if (top >= groupEnd) { flush(); group = []; ends = []; }
        let lane = ends.findIndex((e) => e <= top);
        if (lane < 0) { lane = ends.length; ends.push(0); }
        ends[lane] = top + CARD_H;
        group.push({ d, lane });
        groupEnd = Math.max(groupEnd, top + CARD_H);
    }
    flush();
    return out;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const monthKey = (d: Date) => dayKey(d).slice(0, 7);
function startOfWeek(d: Date) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x;
}
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const tentative = (d: DeliverySummary) => d.phase !== "lista" && d.phase !== "en_postiz" && d.phase !== "publicada";
const locked = (d: DeliverySummary) => d.phase === "en_postiz" || d.phase === "publicada";
const channelNames = (cs?: Channel[]) => (cs ?? []).map((c) => CHANNELS.find((x) => x.id === c)?.label ?? c).join(" · ");

export function PlanPage() {
    const { activeBrand, refreshBrands } = useBrand();
    const navigate = useNavigate();
    const [dialog, ask] = useConfirm();
    const [view, setView] = useState<View>("semana");
    const [list, setList] = useState<DeliverySummary[]>([]);
    const [anchor, setAnchor] = useState(() => new Date());
    const [error, setError] = useState<string | null>(null);
    const [over, setOver] = useState<string | null>(null);
    const [sel, setSel] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [now, setNow] = useState(() => new Date());
    const scroller = useRef<HTMLDivElement | null>(null);
    const brandId = activeBrand?.id;

    const load = useCallback(async () => {
        if (!brandId) return;
        try { setList(await listDeliveries(brandId)); setError(null); } catch (e) { setError((e as Error).message); }
    }, [brandId]);
    useEffect(() => { load(); }, [load]);
    useEffect(() => { const t = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(t); }, []);
    // La semana abre en la mañana, no a la medianoche.
    useEffect(() => { if (view === "semana" && scroller.current) scroller.current.scrollTop = (9 - FIRST_HOUR) * ROW; }, [view, brandId]);

    const strategy = activeBrand?.strategy;
    const byDay = useMemo(() => {
        const m = new Map<string, DeliverySummary[]>();
        for (const d of list) {
            if (!d.scheduledAt || d.phase === "descartada") continue;
            const k = dayKey(new Date(d.scheduledAt));
            m.set(k, [...(m.get(k) ?? []), d].sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? "")));
        }
        return m;
    }, [list]);
    const unscheduled = list.filter((d) => !d.scheduledAt && (d.phase === "lista" || d.phase === "por_revisar" || d.phase === "en_desarrollo"));

    const fail = (e: unknown) => setError((e as Error).message);
    const plan = (id: string, p: { scheduledAt?: string | null; channels?: Channel[] }) => setDeliveryPlan(id, p).then(load).catch(fail);
    const dropAt = (when: Date, id: string) => { setOver(null); plan(id, { scheduledAt: when.toISOString() }); };

    if (!activeBrand) return <div className="h-full flex items-center justify-center text-[13px] text-fg-muted">Elegí una marca.</div>;

    // Lo que dice la estrategia para el mes que se ve; si no dice nada, lo próximo que viene.
    const mk = monthKey(anchor);
    const moment = strategy?.calendar?.find((m) => m.when === mk) ?? null;
    const nextMoment = moment ? null : strategy?.calendar?.filter((m) => /^\d{4}-\d{2}$/.test(m.when) && m.when > mk).sort((a, b) => a.when.localeCompare(b.when))[0] ?? null;
    const weekStart = startOfWeek(anchor);
    const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const gridStart = startOfWeek(monthStart);
    const weeks = Math.ceil((((monthStart.getDay() + 6) % 7) + new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate()) / 7);
    const step = (n: number) => setAnchor((a) => view === "mes" ? new Date(a.getFullYear(), a.getMonth() + n, 1) : addDays(a, 7 * n));
    const title = view === "mes"
        ? cap(anchor.toLocaleDateString("es-AR", { month: "long", year: "numeric" }))
        : `${weekStart.getDate()} – ${addDays(weekStart, 6).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}`;

    /** Lo aprobado sin fecha va a los días hábiles libres que se ven, desde mañana; primero lo del ángulo del mes. */
    const distribute = async () => {
        const t = new Date(); const tomorrow = addDays(new Date(t.getFullYear(), t.getMonth(), t.getDate()), 1);
        const days = (view === "semana"
            ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
            : Array.from({ length: 31 }, (_, i) => addDays(monthStart, i)).filter((d) => d.getMonth() === monthStart.getMonth()))
            .filter((d) => d >= tomorrow && d.getDay() !== 0 && d.getDay() !== 6 && !(byDay.get(dayKey(d))?.length));
        const ready = list.filter((d) => d.phase === "lista" && !d.scheduledAt)
            .sort((a, b) => Number(b.angle === moment?.angle) - Number(a.angle === moment?.angle));
        const n = Math.min(days.length, ready.length);
        if (!ready.length) { setNotice("No hay piezas aprobadas sin fecha."); return; }
        if (!n) { setNotice("No quedan días hábiles libres en lo que estás viendo."); return; }
        try {
            for (let i = 0; i < n; i++) {
                const d = days[i];
                await setDeliveryPlan(ready[i].id, { scheduledAt: new Date(d.getFullYear(), d.getMonth(), d.getDate(), DEFAULT_HOUR).toISOString() });
            }
            setNotice(`Propuse fecha para ${n} ${n === 1 ? "pieza" : "piezas"}. Nada se publica hasta confirmar.`);
            await load();
        } catch (e) { fail(e); }
    };
    const selected = list.find((d) => d.id === sel) ?? null;
    const drag = (d: DeliverySummary) => ({
        draggable: !locked(d),
        onDragStart: (e: React.DragEvent) => { e.dataTransfer.setData("text/plain", d.id); e.dataTransfer.effectAllowed = "move"; },
    });

    /** La pieza en la semana: la imagen manda; abajo, hora, título y redes. */
    const WeekCard = ({ d, lane = 0, of = 1 }: { d: DeliverySummary; lane?: number; of?: number }) => {
        const at = new Date(d.scheduledAt!);
        const top = Math.max(0, Math.min((LAST_HOUR - FIRST_HOUR) * ROW - CARD_H, (at.getHours() + at.getMinutes() / 60 - FIRST_HOUR) * ROW));
        const narrow = of > 1;
        return (
            <div {...drag(d)} onClick={() => setSel(d.id)}
                style={{ top, height: CARD_H, left: `calc(${(lane / of) * 100}% + 3px)`, width: `calc(${100 / of}% - 6px)` }}
                className={`absolute z-10 flex ${narrow ? "flex-col" : ""} gap-2 p-1.5 rounded-[var(--radius-md)] overflow-hidden cursor-pointer bg-surface-1 shadow-[var(--shadow-card)]
                    ${sel === d.id ? "ring-2 ring-fg" : "ring-1 ring-edge hover:ring-fg/40"} ${tentative(d) ? "opacity-80 [background-image:repeating-linear-gradient(135deg,transparent_0_6px,var(--color-accent-muted)_6px_7px)]" : ""}`}>
                {d.cover && <img src={backendUrl(d.cover)} alt="" className={narrow ? "w-full min-h-0 flex-1 rounded-[4px] object-cover object-top" : "h-full aspect-[4/5] shrink-0 rounded-[4px] object-cover"} />}
                <span className={`min-w-0 flex flex-col ${narrow ? "" : "flex-1"}`}>
                    <span className="text-[11px] tabular-nums text-fg-muted">{hhmm(d.scheduledAt!)}{tentative(d) && " · tentativa"}</span>
                    <span className={`mt-0.5 text-[12px] leading-snug text-fg ${narrow ? "truncate" : "line-clamp-3"}`}>{d.title}</span>
                    <span className={`${narrow ? "hidden" : "mt-auto"} text-[10px] text-fg-faint truncate`}>{d.channels?.length ? channelNames(d.channels) : "sin red"}</span>
                </span>
            </div>
        );
    };

    /** La pieza en el mes y en la lista: miniatura con imagen. */
    const MiniCard = ({ d, big }: { d: DeliverySummary; big?: boolean }) => (
        <div {...drag(d)} onClick={() => setSel(d.id)} title={d.title}
            className={`flex items-center gap-2 p-1 rounded-[var(--radius-sm)] cursor-pointer bg-surface-1 ${sel === d.id ? "ring-2 ring-fg" : "ring-1 ring-edge hover:ring-fg/40"} ${tentative(d) ? "opacity-80" : ""}`}>
            {d.cover && <img src={backendUrl(d.cover)} alt="" className={`${big ? "w-12 h-[60px]" : "w-7 h-9"} shrink-0 rounded-[3px] object-cover`} />}
            <span className="min-w-0 flex-1">
                {d.scheduledAt && <span className="block text-[10px] tabular-nums text-fg-faint">{hhmm(d.scheduledAt)}</span>}
                <span className={`block ${big ? "text-[12px] line-clamp-2" : "text-[11px] truncate"} text-fg leading-snug`}>{d.title}</span>
                {big && <span className="block text-[10px] text-fg-faint truncate">{d.angle ?? "sin ángulo"}</span>}
            </span>
        </div>
    );

    const today = dayKey(now);
    const days7 = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    return (
        <div className="h-full flex flex-col min-h-0">
            {dialog}
            {confirming && (
                <ConfirmWeekDialog brandId={activeBrand.id} label={title}
                    start={view === "mes" ? monthStart : weekStart}
                    end={view === "mes" ? new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1) : addDays(weekStart, 7)}
                    onClose={() => setConfirming(false)} onDone={load} />
            )}

            {/* Cabecera: la estrategia arriba, una sola línea de controles abajo. */}
            <header className="px-5 md:px-8 pt-5 pb-4 border-b border-edge">
                <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                    <div className="min-w-0 flex-1">
                        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-faint">Plan · {activeBrand.name}</p>
                        <h1 className="mt-1 text-[26px] leading-tight text-fg">
                            {strategy?.claim ?? "Sin estrategia cargada"}
                            {strategy?.hashtag && <span className="text-fg-muted"> {strategy.hashtag}</span>}
                        </h1>
                    </div>
                    <div className="flex gap-0.5 p-0.5 bg-[var(--color-surface-2)] rounded-[6px] text-[12px]" role="tablist">
                        {(["semana", "mes", "tablero", "aprendizaje"] as View[]).map((v) => (
                            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
                                className={`h-8 px-3.5 rounded-[5px] cursor-pointer ${view === v ? "bg-[var(--color-surface-1)] text-fg shadow-[var(--shadow-card)]" : "text-fg-muted hover:text-fg"}`}>{cap(v)}</button>
                        ))}
                    </div>
                    <Link to="/dashboard/entregas" className="h-8 flex items-center text-[12px] text-fg-muted hover:text-fg no-underline">Entregas →</Link>
                </div>
                {(view === "semana" || view === "mes") && (
                    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                        <div className="flex items-center">
                            <button onClick={() => step(-1)} aria-label="Anterior" className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] text-fg-muted hover:text-fg hover:bg-[var(--color-surface-2)] cursor-pointer"><ChevronLeft size={16} /></button>
                            <button onClick={() => step(1)} aria-label="Siguiente" className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] text-fg-muted hover:text-fg hover:bg-[var(--color-surface-2)] cursor-pointer"><ChevronRight size={16} /></button>
                        </div>
                        <span className="text-[18px] text-fg">{title}</span>
                        <button onClick={() => setAnchor(new Date())} className="h-7 px-2.5 rounded-[var(--radius-sm)] border border-edge text-[11px] text-fg-muted hover:text-fg cursor-pointer">Hoy</button>
                        <span className="text-[12px] text-fg-muted truncate max-w-[640px]">
                            {moment ? <><span className="text-fg">{moment.angle ?? "—"}</span> · {moment.what}</>
                                : nextMoment ? <>Este mes no tiene ángulo. Desde {cap(new Date(`${nextMoment.when}-02`).toLocaleDateString("es-AR", { month: "long" }))}: <span className="text-fg">{nextMoment.angle}</span> · {nextMoment.what}</>
                                : strategy ? "La estrategia no dice nada para este mes." : "Sin estrategia: cargala en la ficha de la marca."}
                        </span>
                        <span className="flex-1" />
                        {notice && <span className="text-[11px] text-fg-muted">{notice}</span>}
                        <button onClick={distribute} title="Pone lo aprobado sin fecha en los días hábiles libres, primero lo del ángulo del mes"
                            className="h-8 px-3 rounded-[var(--radius-sm)] border border-edge text-[12px] text-fg-muted hover:text-fg hover:border-fg cursor-pointer">Distribuir</button>
                        <button onClick={() => setConfirming(true)} title="Ver lo que sale y programarlo en Postiz"
                            className="h-8 px-3.5 rounded-[var(--radius-sm)] bg-fg text-[var(--color-canvas)] text-[12px] cursor-pointer">Confirmar {view === "mes" ? "el mes" : "la semana"}</button>
                    </div>
                )}
                {error && <p className="mt-2 text-[12px] text-[var(--color-error)]">{error}</p>}
            </header>

            {view === "aprendizaje" ? (
                <LearningView brand={activeBrand} ask={ask} onBrandChanged={refreshBrands} />
            ) : view === "tablero" ? (
                <div className="flex-1 min-h-0 overflow-x-auto">
                    <div className="h-full grid grid-cols-[repeat(5,minmax(220px,1fr))]">
                        {PHASES.map((ph) => {
                            const items = list.filter((d) => d.phase === ph.id);
                            return (
                                <section key={ph.id} className="flex flex-col min-h-0 border-r border-edge">
                                    <p className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.08em] text-fg-faint">{ph.label} · {items.length}</p>
                                    <div className="flex-1 overflow-y-auto px-3 pb-4 flex flex-col gap-3">
                                        {items.map((d) => (
                                            <button key={d.id} onClick={() => navigate(`/dashboard/entregas?id=${d.id}`)}
                                                className="text-left rounded-[var(--radius-md)] overflow-hidden bg-surface-1 ring-1 ring-edge hover:ring-fg/40 cursor-pointer">
                                                {d.cover && <img src={backendUrl(d.cover)} alt="" className="w-full aspect-[4/5] object-cover" />}
                                                <span className="block p-2.5">
                                                    <span className="block text-[12px] text-fg leading-snug line-clamp-2">{d.title}</span>
                                                    <span className="block mt-1 text-[10px] text-fg-faint truncate">{d.angle ?? "sin ángulo"}{d.scheduledAt && ` · ${new Date(d.scheduledAt).toLocaleDateString("es-AR", { day: "numeric", month: "short" })} ${hhmm(d.scheduledAt)}`}</span>
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="flex-1 min-h-0 flex">
                    <div className="flex-1 min-w-0 flex flex-col min-h-0">
                        {view === "semana" ? (
                            <>
                                {/* Encabezado de días */}
                                <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-edge">
                                    <span />
                                    {days7.map((d) => {
                                        const k = dayKey(d); const isToday = k === today;
                                        return (
                                            <div key={k} className="px-3 py-2.5 border-l border-edge flex items-baseline gap-2">
                                                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-faint">{DAYS[(d.getDay() + 6) % 7]}</span>
                                                <span className={`text-[22px] leading-none tabular-nums ${isToday ? "text-[var(--color-brand)]" : "text-fg"}`}>{d.getDate()}</span>
                                                {!!byDay.get(k)?.length && <span className="ml-auto text-[10px] text-fg-faint">{byDay.get(k)!.length}</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                                {/* La grilla de horas: soltar en un horario le pone ese día y esa hora (cada media hora). */}
                                <div ref={scroller} className="flex-1 min-h-0 overflow-y-auto">
                                    <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] relative" style={{ height: (LAST_HOUR - FIRST_HOUR) * ROW }}>
                                        <div className="relative">
                                            {Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => (
                                                <span key={i} style={{ top: i * ROW - 7 }} className="absolute right-2 text-[10px] tabular-nums text-fg-faint">{i ? `${String(FIRST_HOUR + i).padStart(2, "0")}:00` : ""}</span>
                                            ))}
                                        </div>
                                        {days7.map((day) => {
                                            const k = dayKey(day);
                                            return (
                                                <div key={k} className={`relative border-l border-edge ${over === k ? "bg-[var(--color-brand-subtle)]" : ""}`}
                                                    style={{ backgroundImage: `repeating-linear-gradient(to bottom, var(--color-edge-subtle) 0 1px, transparent 1px ${ROW}px)` }}
                                                    onDragOver={(e) => { e.preventDefault(); setOver(k); }}
                                                    onDragLeave={() => setOver((o) => (o === k ? null : o))}
                                                    onDrop={(e) => {
                                                        e.preventDefault();
                                                        const id = e.dataTransfer.getData("text/plain"); if (!id) return;
                                                        const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                                                        const half = Math.max(0, Math.round((y / ROW) * 2) / 2);
                                                        const h = Math.min(LAST_HOUR - 1, FIRST_HOUR + Math.floor(half));
                                                        dropAt(new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, half % 1 ? 30 : 0), id);
                                                    }}>
                                                    {k === today && now.getHours() >= FIRST_HOUR && now.getHours() < LAST_HOUR && (
                                                        <span style={{ top: (now.getHours() + now.getMinutes() / 60 - FIRST_HOUR) * ROW }}
                                                            className="absolute left-0 right-0 z-20 h-px bg-[var(--color-brand)] before:absolute before:-left-1 before:-top-1 before:w-2 before:h-2 before:rounded-full before:bg-[var(--color-brand)]" />
                                                    )}
                                                    {(() => { const items = byDay.get(k) ?? []; const L = lanes(items); return items.map((d) => <WeekCard key={d.id} d={d} {...L.get(d.id)} />); })()}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 min-h-0 flex flex-col">
                                <div className="grid grid-cols-7 border-b border-edge">
                                    {DAYS.map((d) => <span key={d} className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-fg-faint border-l border-edge first:border-l-0">{d}</span>)}
                                </div>
                                <div className="flex-1 min-h-0 grid grid-cols-7" style={{ gridTemplateRows: `repeat(${weeks}, minmax(120px, 1fr))` }}>
                                    {Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i)).map((day) => {
                                        const k = dayKey(day); const items = byDay.get(k) ?? [];
                                        const inMonth = day.getMonth() === monthStart.getMonth();
                                        return (
                                            <div key={k} onDragOver={(e) => { e.preventDefault(); setOver(k); }} onDragLeave={() => setOver((o) => (o === k ? null : o))}
                                                onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (id) dropAt(new Date(day.getFullYear(), day.getMonth(), day.getDate(), DEFAULT_HOUR), id); }}
                                                className={`min-h-0 overflow-hidden flex flex-col gap-1 p-1.5 border-l border-b border-edge [&:nth-child(7n+1)]:border-l-0 ${over === k ? "bg-[var(--color-brand-subtle)]" : ""} ${inMonth ? "" : "bg-[var(--color-surface-2)]/40"}`}>
                                                <span className={`px-1 text-[12px] tabular-nums ${k === today ? "text-[var(--color-brand)]" : inMonth ? "text-fg-muted" : "text-fg-faint/60"}`}>{day.getDate()}</span>
                                                {items.slice(0, 3).map((d) => <MiniCard key={d.id} d={d} />)}
                                                {items.length > 3 && <span className="px-1 text-[10px] text-fg-faint">+{items.length - 3} más</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    <aside className="w-[320px] shrink-0 border-l border-edge flex flex-col min-h-0">
                        {selected && (
                            <div className="border-b border-edge bg-surface-1">
                                {selected.cover && <img src={backendUrl(selected.cover)} alt="" className="w-full aspect-[16/10] object-cover object-top" />}
                                <div className="p-4">
                                    <div className="flex items-start gap-2">
                                        <span className="flex-1 min-w-0">
                                            <span className="block text-[14px] text-fg leading-snug">{selected.title}</span>
                                            <span className="block mt-0.5 text-[11px] text-fg-faint">{selected.angle ?? "sin ángulo"}{tentative(selected) && " · todavía no aprobada"}</span>
                                        </span>
                                        <button onClick={() => setSel(null)} aria-label="Cerrar" className="text-fg-faint hover:text-fg cursor-pointer">×</button>
                                    </div>
                                    <div className="mt-4"><PublishControls d={selected} onChange={(p) => plan(selected.id, p)} /></div>
                                    <div className="mt-4 flex items-center gap-3">
                                        <button onClick={() => navigate(`/dashboard/entregas?id=${selected.id}`)} className="text-[12px] text-fg-muted hover:text-fg cursor-pointer">Abrir la entrega →</button>
                                        <span className="flex-1" />
                                        {selected.scheduledAt && !locked(selected) && (
                                            <button onClick={() => plan(selected.id, { scheduledAt: null })} className="text-[11px] text-fg-faint hover:text-fg cursor-pointer">Sacar la fecha</button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="flex-1 min-h-0 overflow-y-auto">
                            <p className="px-4 pt-4 font-mono text-[10px] uppercase tracking-[0.08em] text-fg-faint">Sin fecha · {unscheduled.length}</p>
                            <p className="px-4 pt-1 pb-3 text-[11px] text-fg-faint leading-snug">Arrastralas a un día y un horario. Es una propuesta: no se publica nada.</p>
                            <div className="px-3 pb-4 flex flex-col gap-2">
                                {unscheduled.map((d) => <MiniCard key={d.id} d={d} big />)}
                            </div>
                            {strategy?.angles?.length ? (
                                <div className="border-t border-edge px-4 py-4">
                                    <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-faint">Ángulos</p>
                                    <ul className="mt-2 flex flex-col gap-1.5">
                                        {strategy.angles.map((a) => {
                                            const n = list.filter((d) => d.angle === a.name && d.phase !== "descartada").length;
                                            const isMonth = a.name === (moment ?? nextMoment)?.angle;
                                            return (
                                                <li key={a.name} title={a.purpose} className="flex items-center gap-2 text-[12px]">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${isMonth ? "bg-[var(--color-brand)]" : n ? "bg-[var(--color-warm)]" : "bg-[var(--color-edge-strong)]"}`} />
                                                    <span className={`flex-1 truncate ${isMonth ? "text-fg" : "text-fg-muted"}`}>{a.name}</span>
                                                    <span className="tabular-nums text-fg-faint">{n}</span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            ) : null}
                        </div>
                    </aside>
                </div>
            )}
        </div>
    );
}
