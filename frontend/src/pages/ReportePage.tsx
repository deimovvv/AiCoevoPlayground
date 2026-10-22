import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import { getReport, saveReport, type MonthReport } from "../lib/api";

/**
 * Reporte del mes de una marca (studio-v2 O.9). Equipo: lo arma (la producción la calcula Studio; la
 * lectura la escribe Coevo) y lo publica. Cliente: lo lee, una vez publicado. Resultados en redes
 * llegan con Postiz (O.6). El costo de IA no va acá: es de Coevo (Resumen).
 */

const mono = "font-mono text-[10px] uppercase tracking-[0.1em]";
const thisMonth = () => new Date().toISOString().slice(0, 7);
const shift = (m: string, n: number) => { const d = new Date(`${m}-15T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };
const monthName = (m: string) => new Date(`${m}-15T00:00:00Z`).toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "UTC" });

function Stat({ n, label, hint }: { n: string | number; label: string; hint?: string }) {
    return (
        <div className="flex flex-col gap-1 py-4 border-t border-edge">
            <span className="text-[34px] leading-none font-light tracking-[-0.03em] text-fg tabular-nums">{n}</span>
            <span className="text-[13px] text-fg">{label}</span>
            {hint && <span className="text-[12px] text-fg-faint">{hint}</span>}
        </div>
    );
}

export function ReportePage({ mode = "equipo" }: { mode?: "equipo" | "cliente" }) {
    const client = mode === "cliente";
    const { activeBrand } = useBrand();
    const brandId = activeBrand?.id;
    const [month, setMonth] = useState(thisMonth);
    const [r, setR] = useState<MonthReport | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [reading, setReading] = useState("");
    const [busy, setBusy] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (!brandId) return;
        let alive = true;
        setR(null); setErr(null);
        getReport(brandId, month).then((x) => { if (!alive) return; setR(x); setReading(x.reading); setSaved(false); })
            .catch((e) => alive && setErr((e as Error).message));
        return () => { alive = false; };
    }, [brandId, month]);

    const save = async (publish?: boolean) => {
        if (!brandId) return;
        setBusy(true); setErr(null);
        try {
            const x = await saveReport(brandId, month, { reading, publish });
            setR((cur) => (cur ? { ...cur, reading: x.reading, publishedAt: x.publishedAt } : cur));
            setSaved(true);
        } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
    };

    const p = r?.production;
    const pct = p && p.approved ? Math.round((p.firstTry / p.approved) * 100) : null;

    return (
        <div className="h-full overflow-y-auto">
            <div className={`max-w-[880px] mx-auto ${client ? "px-5 py-10 md:py-14" : "pb-16"} flex flex-col`}>
                <div className="flex items-center gap-3">
                    <p className={`${mono} text-fg-faint flex-1`}>Reporte · {activeBrand?.name}</p>
                    <button onClick={() => setMonth(shift(month, -1))} aria-label="Mes anterior" className="w-8 h-8 flex items-center justify-center rounded-full text-fg-muted hover:text-fg hover:bg-[var(--color-surface-2)] cursor-pointer"><ChevronLeft size={15} /></button>
                    <button onClick={() => setMonth(shift(month, 1))} disabled={month >= thisMonth()} aria-label="Mes siguiente" className="w-8 h-8 flex items-center justify-center rounded-full text-fg-muted hover:text-fg hover:bg-[var(--color-surface-2)] cursor-pointer disabled:opacity-30"><ChevronRight size={15} /></button>
                </div>
                <h1 className="mt-3 text-[36px] md:text-[44px] leading-none font-light tracking-[-0.04em] text-fg first-letter:uppercase">{monthName(month)}</h1>
                {!client && r && (
                    <p className="mt-3 text-[13px] text-fg-muted">
                        {r.publishedAt ? `Publicado el ${new Date(r.publishedAt).toLocaleDateString("es-AR", { day: "numeric", month: "long" })}: el cliente lo ve en su espacio.` : "Borrador: el cliente todavía no lo ve."}
                    </p>
                )}

                {err && <p className="mt-8 text-[14px] text-fg-muted">{err}</p>}
                {!r && !err && <p className="mt-8 text-[13px] text-fg-faint">Cargando…</p>}

                {r && p && (
                    <>
                        <section className="mt-10">
                            <p className={`${mono} text-fg-faint pb-3`}>Producción</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8">
                                <Stat n={p.sent} label="piezas mandadas" />
                                <Stat n={p.approved} label="aprobadas" hint={pct != null ? `${pct}% a la primera` : undefined} />
                                <Stat n={p.withChanges} label="con cambios pedidos" />
                                <Stat n={p.avgResponseDays != null ? `${p.avgResponseDays}` : "—"} label="días hasta aprobar" hint="promedio" />
                            </div>
                            <p className="mt-4 text-[13px] text-fg-muted">
                                {p.clientComments} {p.clientComments === 1 ? "comentario" : "comentarios"}{p.removedSlides ? ` · ${p.removedSlides} láminas que no fueron` : ""} · {p.materialSent} {p.materialSent === 1 ? "envío de material" : "envíos de material"}
                            </p>
                        </section>

                        {p.byProject.length > 0 && (
                            <section className="mt-10">
                                <p className={`${mono} text-fg-faint pb-3`}>Por proyecto</p>
                                {p.byProject.map((x) => (
                                    <div key={x.project ?? "_"} className="grid grid-cols-[minmax(0,1fr)_repeat(3,72px)] gap-3 py-3 border-t border-edge text-[13px] tabular-nums">
                                        <span className="text-fg truncate">{x.project ?? "Sin proyecto"}</span>
                                        <span className="text-fg-muted text-right">{x.sent} mand.</span>
                                        <span className="text-fg-muted text-right">{x.approved} aprob.</span>
                                        <span className="text-fg-muted text-right">{x.changes} camb.</span>
                                    </div>
                                ))}
                            </section>
                        )}

                        <section className="mt-10">
                            <p className={`${mono} text-fg-faint pb-3`}>La lectura de Coevo</p>
                            {client ? (
                                <p className="text-[16px] leading-relaxed text-fg whitespace-pre-line">{r.reading || "—"}</p>
                            ) : (
                                <>
                                    <textarea value={reading} onChange={(e) => { setReading(e.target.value); setSaved(false); }} rows={6}
                                        placeholder="Qué funcionó este mes, qué aprendimos de lo que pidió cambiar, y qué hacemos el mes que viene."
                                        className="w-full px-4 py-3 rounded-[4px] border border-edge bg-[var(--color-surface-1)] text-[15px] leading-relaxed text-fg placeholder:text-fg-faint outline-none focus:border-fg/40 resize-y" />
                                    <div className="mt-3 flex items-center gap-3">
                                        <span className="flex-1 text-[12px] text-fg-faint">{saved ? "Guardado." : ""}</span>
                                        <button onClick={() => save()} disabled={busy} className="h-9 px-3 text-[13px] text-fg-muted hover:text-fg cursor-pointer">Guardar</button>
                                        {r.publishedAt
                                            ? <button onClick={() => save(false)} disabled={busy} className="h-9 px-4 rounded-[4px] border border-edge text-[13px] text-fg cursor-pointer">Despublicar</button>
                                            : <button onClick={() => save(true)} disabled={busy || !reading.trim()} className="h-9 px-4 rounded-[4px] bg-[var(--color-action)] text-[var(--color-action-fg)] text-[13px] cursor-pointer disabled:opacity-40">Publicar para el cliente</button>}
                                    </div>
                                </>
                            )}
                        </section>

                        {!client && (
                            <section className="mt-10 py-5 px-5 rounded-[4px] border border-dashed border-edge">
                                <p className={`${mono} text-fg-faint`}>Resultados en redes</p>
                                <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">
                                    Seguidores, alcance e interacciones del mes, y qué pieza funcionó mejor. Llegan solos cuando conectemos Postiz; hasta entonces, si los tenés, sumalos en la lectura.
                                </p>
                            </section>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
