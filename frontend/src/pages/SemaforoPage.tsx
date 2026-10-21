import { useEffect, useState } from "react";
import { Link } from "react-router";
import { X } from "lucide-react";
import {
    backendUrl, getCommercial, getSemaforo, saveCommercial, setUsdArs,
    type Commercial, type Semaforo, type SemaforoBrand,
} from "../lib/api";

/**
 * Semáforo (studio-v2 O.7, sólo admin): todas las marcas de un vistazo, cada una con su color y el
 * porqué. Tocar una abre su ficha comercial (fee, pack, contacto, facturación), que es lo que deja
 * calcular el margen: fee − costo de IA del mes. Nada de esto lo ve el cliente.
 */

const mono = "font-mono text-[10px] uppercase tracking-[0.09em]";
const DOT = { rojo: "bg-[#d4402b]", amarillo: "bg-[#d9a21b]", verde: "bg-[#3f9b5a]" } as const;
const usd = (n: number) => `US$ ${n.toLocaleString("es-AR", { maximumFractionDigits: n < 10 ? 2 : 0 })}`;
const money = (n: number, c: string | null) => (c === "USD" ? usd(n) : `$ ${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`);
const input = "h-9 px-3 rounded-[4px] border border-edge bg-[var(--color-surface-1)] text-[13px] text-fg outline-none focus:border-fg/40";

function Ficha({ brand, onClose, onSaved }: { brand: SemaforoBrand; onClose: () => void; onSaved: () => void }) {
    const [c, setC] = useState<Commercial | null>(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    useEffect(() => {
        let alive = true;
        getCommercial(brand.id).then((x) => alive && setC(x)).catch((e) => alive && setErr(e.message));
        return () => { alive = false; };
    }, [brand.id]);
    const set = (k: keyof Commercial, v: string | number | null) => setC((x) => (x ? { ...x, [k]: v } : x));
    const save = async () => {
        if (!c) return;
        setBusy(true); setErr(null);
        try { await saveCommercial(brand.id, c); onSaved(); onClose(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
    };
    const text = (k: keyof Commercial, label: string, ph = "") => (
        <label className="flex flex-col gap-1.5 text-[12px] text-fg-muted">{label}
            <input value={(c?.[k] as string) ?? ""} onChange={(e) => set(k, e.target.value)} placeholder={ph} className={`${input} w-full min-w-0`} />
        </label>
    );

    return (
        <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-[420px] bg-[var(--color-canvas)] border-l border-edge shadow-[var(--shadow-modal)] flex flex-col">
            <header className="h-14 shrink-0 flex items-center gap-3 px-5 border-b border-edge">
                <span className={`w-2 h-2 rounded-full ${DOT[brand.color]}`} />
                <p className="flex-1 text-[15px] text-fg truncate">{brand.name} · ficha comercial</p>
                <button onClick={onClose} aria-label="Cerrar" className="w-8 h-8 flex items-center justify-center text-fg-faint hover:text-fg cursor-pointer"><X size={15} /></button>
            </header>
            {!c ? <p className="p-5 text-[13px] text-fg-faint">{err ?? "Cargando…"}</p> : (
                <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
                    <p className={`${mono} text-fg-faint`}>Lo que paga</p>
                    <div className="flex gap-2">
                        <label className="flex-1 flex flex-col gap-1.5 text-[12px] text-fg-muted">Fee por mes
                            <input type="number" min={0} value={c.fee ?? ""} onChange={(e) => set("fee", e.target.value === "" ? null : Number(e.target.value))} className={input} />
                        </label>
                        <label className="w-[96px] flex flex-col gap-1.5 text-[12px] text-fg-muted">Moneda
                            <select value={c.currency} onChange={(e) => set("currency", e.target.value)} className={`${input} cursor-pointer`}>
                                <option value="ARS">ARS</option><option value="USD">USD</option>
                            </select>
                        </label>
                    </div>
                    <div className="flex gap-2">
                        <label className="flex-1 flex flex-col gap-1.5 text-[12px] text-fg-muted">Piezas por mes (el pack)
                            <input type="number" min={0} value={c.piecesPerMonth ?? ""} onChange={(e) => set("piecesPerMonth", e.target.value === "" ? null : Number(e.target.value))} className={input} />
                        </label>
                        <label className="w-[130px] flex flex-col gap-1.5 text-[12px] text-fg-muted">Cliente desde
                            <input type="month" value={c.since ?? ""} onChange={(e) => set("since", e.target.value || null)} className={input} />
                        </label>
                    </div>
                    {text("services", "Qué incluye", "Ej: 12 fotos de catálogo + 4 reels")}

                    <p className={`${mono} text-fg-faint pt-3`}>Contacto</p>
                    {text("contactName", "Nombre")}
                    <div className="flex gap-2">
                        <div className="flex-1 min-w-0">{text("contactEmail", "Mail")}</div>
                        <div className="flex-1 min-w-0">{text("contactPhone", "Teléfono")}</div>
                    </div>

                    <p className={`${mono} text-fg-faint pt-3`}>Facturación</p>
                    {text("billingName", "Razón social")}
                    {text("billingTaxId", "CUIT")}
                    {text("billingNotes", "Notas", "Condición de IVA, mail para facturas…")}
                    {err && <p className="text-[12px] text-[var(--color-error)]">{err}</p>}
                </div>
            )}
            <footer className="shrink-0 px-5 py-4 border-t border-edge flex justify-end gap-2">
                <button onClick={onClose} className="h-9 px-3 text-[13px] text-fg-muted hover:text-fg cursor-pointer">Cancelar</button>
                <button onClick={save} disabled={busy || !c} className="h-9 px-4 rounded-[4px] bg-[var(--color-action)] text-[var(--color-action-fg)] text-[13px] cursor-pointer disabled:opacity-40">Guardar</button>
            </footer>
        </aside>
    );
}

export function SemaforoPage() {
    const [data, setData] = useState<Semaforo | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [open, setOpen] = useState<SemaforoBrand | null>(null);
    const [rate, setRate] = useState("");
    const load = () => getSemaforo().then((d) => { setData(d); setRate(d.usdArs ? String(d.usdArs) : ""); }).catch((e) => setErr(e.message));
    useEffect(() => { load(); }, []);
    const monthName = data ? new Date(`${data.month}-02`).toLocaleDateString("es-AR", { month: "long" }) : "";
    const count = (c: SemaforoBrand["color"]) => data?.brands.filter((b) => b.color === c).length ?? 0;
    const needsRate = data?.brands.some((b) => b.fee && b.currency === "ARS") && !data?.usdArs;

    return (
        <div className="pb-16">
            {open && <Ficha brand={open} onClose={() => setOpen(null)} onSaved={load} />}
            <p className={`${mono} text-fg-faint`}>Semáforo · {monthName}</p>
            <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-4">
                <h1 className="text-[40px] leading-none tracking-[-0.035em] text-fg">Cómo viene cada marca</h1>
                {data && (
                    <p className="flex items-center gap-4 text-[13px] text-fg-muted pb-1">
                        <span className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${DOT.rojo}`} />{count("rojo")}</span>
                        <span className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${DOT.amarillo}`} />{count("amarillo")}</span>
                        <span className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${DOT.verde}`} />{count("verde")}</span>
                    </p>
                )}
                <span className="flex-1" />
                <label className="flex items-center gap-2 text-[12px] text-fg-muted pb-1" title="Para comparar un fee en pesos con el costo de IA, que está en dólares">
                    Dólar
                    <input type="number" min={0} value={rate} onChange={(e) => setRate(e.target.value)} placeholder="ARS por USD"
                        onBlur={() => { const v = rate === "" ? null : Number(rate); if (v !== (data?.usdArs ?? null)) setUsdArs(v).then(load); }}
                        className={`w-[110px] ${input} ${needsRate ? "border-[#d9a21b]" : ""}`} />
                </label>
            </div>
            <p className="mt-4 max-w-[620px] text-[13px] leading-relaxed text-fg-muted">
                Rojo: le toca a Coevo y se está demorando, el margen es bajo o el mes viene atrasado. Amarillo: espera al cliente o hay que vigilarlo.
                Tocá una marca para cargar su fee y su pack: con eso aparece cuánto deja.
            </p>
            {err && <p className="mt-4 text-[13px] text-[var(--color-error)]">{err}</p>}

            <div className="mt-8 border-t border-edge">
                <div className={`hidden md:grid grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)_110px_100px_120px_80px] gap-4 px-2 py-2.5 border-b border-edge ${mono} text-fg-faint`}>
                    <span>Marca</span><span>Qué pasa</span><span>Este mes</span><span>Costo IA</span><span>Fee</span><span>Margen</span>
                </div>
                {data === null && !err && <p className="py-5 text-[13px] text-fg-faint">Cargando…</p>}
                {data?.brands.map((b) => (
                    <button key={b.id} onClick={() => setOpen(b)}
                        className="w-full grid grid-cols-[auto_minmax(0,1fr)] md:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)_110px_100px_120px_80px] gap-x-4 gap-y-1.5 items-center px-2 py-4 border-b border-edge text-left cursor-pointer hover:bg-[var(--color-surface-1)]">
                        <span className="flex items-center gap-3 min-w-0">
                            <span className={`w-2.5 h-2.5 shrink-0 rounded-full ${DOT[b.color]}`} />
                            {b.logo ? <img src={backendUrl(b.logo)} alt="" className="w-6 h-6 shrink-0 rounded-[3px] object-contain bg-[var(--color-surface-2)]" /> : null}
                            <span className="text-[14px] text-fg truncate">{b.name}</span>
                        </span>
                        <span className="text-[13px] text-fg-muted md:truncate">
                            {b.reasons.length ? b.reasons.join(" · ") : <span className="text-fg-faint">Todo al día</span>}
                        </span>
                        <span className="col-span-2 md:col-span-1 flex md:contents gap-4 text-[12px] md:text-[13px] text-fg-muted pl-[22px] md:pl-0">
                            <span className="tabular-nums">{b.approvedThisMonth}{b.piecesPerMonth ? ` de ${b.piecesPerMonth}` : ""} aprob.</span>
                            <span className="tabular-nums">{b.costUsd ? usd(b.costUsd) : "—"}</span>
                            <span className="tabular-nums">{b.fee ? money(b.fee, b.currency) : <span className="text-fg-faint">cargar</span>}</span>
                            <span className={`tabular-nums ${b.margin != null && b.margin < 0.3 ? "text-[#d4402b]" : "text-fg"}`}>{b.margin != null ? `${Math.round(b.margin * 100)}%` : "—"}</span>
                        </span>
                    </button>
                ))}
            </div>
            {data && data.brands.some((b) => b.reasons.length) && (
                <p className="mt-5 text-[12px] text-fg-faint">
                    Para resolverlo: <Link to="/dashboard/entregas" className="text-fg-muted hover:text-fg">Entregas</Link> ·{" "}
                    <Link to="/dashboard/produccion" className="text-fg-muted hover:text-fg">Producción</Link>
                </p>
            )}
        </div>
    );
}
