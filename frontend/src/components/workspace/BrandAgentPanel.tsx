import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Minus, X } from "lucide-react";
import { getBrandAgent, startBrandAgent, type AgentRun, type Brand } from "../../lib/api";

/**
 * El agente de marca (studio-v2 M.3): le das la web y el Instagram, lee todo y propone los
 * bloques de la memoria. Se ve paso por paso mientras trabaja. No pisa lo que ya está cargado;
 * lo que propone queda «propuesto · revisar» en Marca hasta que alguien lo aprueba.
 */

const mono = "font-mono text-[10px] uppercase tracking-[0.09em]";
const input = "w-full h-10 px-3 rounded-[4px] border border-edge bg-[var(--color-surface-1)] text-[13px] text-fg outline-none focus:border-fg/40";

export function BrandAgentPanel({ brand, onClose, onChanged }: { brand: Brand; onClose: () => void; onChanged: () => Promise<void> }) {
    const src = brand.brandSources || [];
    const [web, setWeb] = useState(brand.agent?.sources?.web || src.find((s) => s.type === "url")?.url || "");
    const [ig, setIg] = useState(brand.agent?.sources?.instagram || src.find((s) => s.type === "instagram")?.url || "");
    const [run, setRun] = useState<AgentRun | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const refreshed = useRef(false);

    // Si ya hay una corrida en curso (o recién terminada), se muestra.
    useEffect(() => { getBrandAgent(brand.id).then((r) => { if (r.status !== "idle") setRun(r); }).catch(() => {}); }, [brand.id]);

    useEffect(() => {
        if (run?.status !== "running") return;
        const t = setInterval(async () => {
            try {
                const r = await getBrandAgent(brand.id);
                setRun(r);
                if (r.status === "done" && !refreshed.current) { refreshed.current = true; await onChanged(); }
            } catch { /* reintenta */ }
        }, 1500);
        return () => clearInterval(t);
    }, [run?.status, brand.id, onChanged]);

    const go = async () => {
        setErr(null); refreshed.current = false;
        try { setRun(await startBrandAgent(brand.id, { web: web.trim(), instagram: ig.trim() })); } catch (e) { setErr((e as Error).message); }
    };
    const busy = run?.status === "running";

    return (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-label="Agente de marca">
            <button aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/25 cursor-default" />
            <aside className="relative w-full max-w-[480px] h-full bg-[var(--color-canvas)] border-l border-edge flex flex-col shadow-[var(--shadow-modal)]">
                <header className="h-16 shrink-0 flex items-center gap-3 px-6 border-b border-edge">
                    <div className="min-w-0">
                        <p className={`${mono} text-fg-faint`}>{brand.name}</p>
                        <h2 className="text-[17px] text-fg">Agente de marca</h2>
                    </div>
                    <span className="flex-1" />
                    <button onClick={onClose} aria-label="Cerrar" className="w-9 h-9 flex items-center justify-center rounded-full text-fg-muted hover:text-fg hover:bg-[var(--color-surface-2)] cursor-pointer"><X size={16} /></button>
                </header>

                <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
                    <p className="text-[14px] leading-relaxed text-fg-muted">
                        Lee la web y el Instagram de la marca y arma su memoria: quién es, su identidad, cómo se ven sus fotos y las referencias.
                        Lo que ya está cargado no lo toca. Lo que propone queda para que lo revises.
                    </p>
                    <label className="flex flex-col gap-1.5 text-[12px] text-fg-muted">Web
                        <input value={web} onChange={(e) => setWeb(e.target.value)} disabled={busy} placeholder="marca.com" className={input} />
                    </label>
                    <label className="flex flex-col gap-1.5 text-[12px] text-fg-muted">Instagram
                        <input value={ig} onChange={(e) => setIg(e.target.value)} disabled={busy} placeholder="@marca" className={input} />
                    </label>

                    {run && run.steps.length > 0 && (
                        <ol className="border-t border-edge">
                            {run.steps.map((s, i) => (
                                <li key={s.key} className="flex gap-3 py-3 border-b border-edge">
                                    <span className={`${mono} w-6 pt-0.5 text-fg-faint`}>{String(i + 1).padStart(2, "0")}</span>
                                    <span className="flex-1 min-w-0">
                                        <span className={`block text-[14px] ${s.status === "pending" ? "text-fg-faint" : "text-fg"}`}>{s.label}</span>
                                        {s.note && <span className={`block text-[12px] mt-0.5 ${s.status === "error" ? "text-[var(--color-error)]" : "text-fg-muted"}`}>{s.note}</span>}
                                    </span>
                                    <span className="w-5 pt-0.5 flex justify-end">
                                        {s.status === "running" && <Loader2 size={14} className="animate-spin text-fg" />}
                                        {s.status === "done" && <Check size={14} className="text-[var(--color-success)]" />}
                                        {s.status === "error" && <X size={14} className="text-[var(--color-error)]" />}
                                        {s.status === "skipped" && <Minus size={14} className="text-fg-faint" />}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    )}
                    {run?.status === "done" && (
                        <p className="text-[13px] leading-relaxed text-fg">
                            Listo. {run.touched?.length ? "Los bloques que propuso quedaron marcados «propuesto · revisar» en Marca: abrilos, corregí lo que haga falta y aprobalos." : "No había nada vacío para completar."}
                        </p>
                    )}
                    {(err || run?.error) && <p className="text-[12px] text-[var(--color-error)]">{err || run?.error}</p>}
                </div>

                <footer className="h-16 shrink-0 flex items-center justify-end gap-3 px-6 border-t border-edge">
                    {run?.status === "done"
                        ? <button onClick={onClose} className="h-9 px-4 rounded-[4px] bg-[var(--color-action)] text-[var(--color-action-fg)] text-[13px] cursor-pointer">Ver la marca</button>
                        : (
                            <button onClick={go} disabled={busy || (!web.trim() && !ig.trim())}
                                className="h-9 px-4 flex items-center gap-2 rounded-[4px] bg-[var(--color-action)] text-[var(--color-action-fg)] text-[13px] cursor-pointer disabled:opacity-40">
                                {busy ? <><Loader2 size={13} className="animate-spin" /> Trabajando…</> : "Armar la marca"}
                            </button>
                        )}
                </footer>
            </aside>
        </div>
    );
}
