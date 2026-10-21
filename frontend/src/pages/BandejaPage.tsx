import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ExternalLink, FileText, Film, Loader2, Sparkles } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import {
    backendUrl, discardInbox, incorporateInbox, listCampaigns, listInbox, proposeInbox,
    type Campaign, type InboxDest, type InboxItem,
} from "../lib/api";

/**
 * Material del cliente (equipo, studio-v2 §12/§15): lo que mandó, y adónde va cada imagen.
 * Destino: la marca o un proyecto. Tipo: uno para todas, y se puede cambiar por imagen o descartar.
 * PDF, video y links quedan acá para abrirlos (no entran a la memoria).
 */

const DEST: Array<[InboxDest, string]> = [
    ["moodboard", "Moodboard"], ["luz", "Luz"], ["locacion", "Locación"], ["plano", "Plano"], ["pose", "Pose"],
    ["cara", "Cara"], ["prenda", "Prenda"], ["producto", "Producto"],
];
const mono = "font-mono text-[10px] uppercase tracking-[0.09em]";
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
const who = (a: string | null) => (!a ? "—" : a.startsWith("servicio:") ? "Claude" : a.split("@")[0]);

function Item({ it, campaigns, onDone }: { it: InboxItem; campaigns: Campaign[]; onDone: (x: InboxItem) => void }) {
    const images = it.files.filter((f) => f.kind === "image");
    const others = it.files.filter((f) => f.kind !== "image");
    // Arranca con lo que propuso el agente (si hay); el equipo confirma o corrige.
    const p = it.proposal?.status === "ok" ? it.proposal : null;
    const [target, setTarget] = useState(p?.target ?? "marca");
    const [type, setType] = useState<InboxDest>("moodboard");
    const [per, setPer] = useState<Record<string, InboxDest>>(p?.perFile ?? {});
    const [off, setOff] = useState<string[]>(p?.discard ?? []);
    const [busy, setBusy] = useState(false);
    const [thinking, setThinking] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const run = async (fn: () => Promise<InboxItem>) => { setBusy(true); setErr(null); try { onDone(await fn()); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
    const done = it.status !== "nuevo";
    const ask = async () => {
        setThinking(true); setErr(null);
        try {
            const x = await proposeInbox(it.id);
            const q = x.proposal?.status === "ok" ? x.proposal : null;
            if (q) { setTarget(q.target ?? "marca"); setPer(q.perFile ?? {}); setOff(q.discard ?? []); }
            else setErr(x.proposal?.error || "El agente no pudo proponer");
            onDone(x);
        } catch (e) { setErr((e as Error).message); } finally { setThinking(false); }
    };

    return (
        <article className={`py-6 border-t border-edge ${done ? "opacity-55" : ""}`}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-[15px] text-fg">{it.note || "Sin nota"}</span>
                <span className="text-[12px] text-fg-faint">{who(it.author)} · {when(it.createdAt)}</span>
                <span className="flex-1" />
                {done && <span className={`${mono} text-fg-faint`}>{it.status} · {it.result}</span>}
            </div>
            {!done && images.length > 0 && (
                <p className="mt-3 flex items-start gap-2 text-[12px] leading-relaxed text-fg-muted">
                    <Sparkles size={12} className="mt-[3px] shrink-0 text-[var(--color-brand)]" />
                    {thinking ? <span className="flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" /> El agente lo está mirando…</span>
                        : p ? <span>El agente lo dejó elegido{p.why ? `: ${p.why}` : "."} Revisalo y sumalo, o cambiá lo que no va. <button onClick={ask} className="underline underline-offset-2 cursor-pointer">Volver a proponer</button></span>
                            : <span>{it.proposal?.status === "error" ? "El agente no pudo mirarlo. " : ""}<button onClick={ask} className="underline underline-offset-2 text-fg cursor-pointer">Que lo ordene el agente</button></span>}
                </p>
            )}
            {(it.link || others.length > 0) && (
                <div className="flex flex-wrap gap-3 mt-3 text-[12px]">
                    {it.link && <a href={it.link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-fg underline underline-offset-2">Link del cliente <ExternalLink size={11} /></a>}
                    {others.map((f) => (
                        <a key={f.url} href={backendUrl(f.url)} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-fg-muted hover:text-fg">
                            {f.kind === "video" ? <Film size={12} /> : <FileText size={12} />} {f.name}
                        </a>
                    ))}
                </div>
            )}
            {images.length > 0 && (
                <div className="flex gap-2 overflow-x-auto mt-4 pb-1">
                    {images.map((f) => {
                        const isOff = off.includes(f.url);
                        return (
                            <figure key={f.url} className="shrink-0 w-[132px] flex flex-col gap-1.5">
                                <button disabled={done} onClick={() => setOff(isOff ? off.filter((u) => u !== f.url) : [...off, f.url])} title={isOff ? "Sumar" : "Descartar esta"}
                                    className={`relative h-[165px] rounded-[2px] overflow-hidden cursor-pointer ${isOff ? "opacity-30" : ""}`}>
                                    <img src={backendUrl(f.url)} alt={f.name} className="w-full h-full object-cover" />
                                    {isOff && <span className="absolute inset-0 flex items-center justify-center text-[11px] text-white bg-black/40">descartada</span>}
                                </button>
                                {!done && !isOff && (
                                    <select value={per[f.url] ?? type} onChange={(e) => setPer({ ...per, [f.url]: e.target.value as InboxDest })} aria-label="Tipo"
                                        className="h-7 px-1.5 rounded-[3px] border border-edge bg-[var(--color-surface-1)] text-[11px] text-fg cursor-pointer">
                                        {DEST.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                                    </select>
                                )}
                            </figure>
                        );
                    })}
                </div>
            )}
            {!done && (
                <div className="flex flex-wrap items-center gap-2 mt-4">
                    {images.length > 0 && (
                        <>
                            <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Destino"
                                className="h-9 px-2 rounded-[4px] border border-edge bg-[var(--color-surface-1)] text-[13px] text-fg cursor-pointer">
                                <option value="marca">A la marca</option>
                                {campaigns.map((c) => <option key={c.id} value={c.id}>Al proyecto · {c.name}</option>)}
                            </select>
                            <select value={type} onChange={(e) => { setType(e.target.value as InboxDest); setPer({}); }} aria-label="Tipo para todas"
                                className="h-9 px-2 rounded-[4px] border border-edge bg-[var(--color-surface-1)] text-[13px] text-fg cursor-pointer">
                                {DEST.map(([k, l]) => <option key={k} value={k}>Todas como {l.toLowerCase()}</option>)}
                            </select>
                            <button disabled={busy || off.length === images.length}
                                onClick={() => run(() => incorporateInbox(it.id, { target, type, perFile: per, discard: off }))}
                                className="h-9 px-4 rounded-[4px] bg-[var(--color-action)] text-[var(--color-action-fg)] text-[13px] cursor-pointer disabled:opacity-40">
                                Sumar {images.length - off.length}
                            </button>
                        </>
                    )}
                    <button disabled={busy} onClick={() => run(() => discardInbox(it.id))} className="h-9 px-3 text-[13px] text-fg-muted hover:text-fg cursor-pointer">
                        {images.length ? "Descartar todo" : "Marcar como visto"}
                    </button>
                    {err && <span className="text-[12px] text-[var(--color-error)]">{err}</span>}
                </div>
            )}
        </article>
    );
}

export function BandejaPage() {
    const { activeBrand, setActiveBrandId } = useBrand();
    const brandId = activeBrand?.id;
    const [items, setItems] = useState<InboxItem[] | null>(null);
    const [params, setParams] = useSearchParams();
    // ?marca=<id> abre la bandeja de esa marca (el link del mail «mandó material»).
    const wanted = params.get("marca");
    useEffect(() => {
        if (!wanted) return;
        setActiveBrandId(wanted);
        setParams({}, { replace: true });
    }, [wanted, setActiveBrandId, setParams]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);

    useEffect(() => {
        if (!brandId) return;
        let alive = true;
        listInbox(brandId).then((x) => alive && setItems(x)).catch(() => alive && setItems([]));
        listCampaigns(brandId).then((c) => alive && setCampaigns(c)).catch(() => {});
        return () => { alive = false; };
    }, [brandId]);

    const pending = (items || []).filter((i) => i.status === "nuevo");
    const past = (items || []).filter((i) => i.status !== "nuevo");
    return (
        <div className="max-w-[1200px] mx-auto px-4 md:px-10 py-8 pb-20">
            <Link to="/dashboard/produccion" className="text-[12px] text-fg-muted hover:text-fg no-underline">← Producción</Link>
            <p className={`${mono} text-fg-faint mt-8`}>{activeBrand?.name}</p>
            <h1 className="mt-2 text-[40px] leading-none tracking-[-0.035em] text-fg">Material del cliente</h1>
            <p className="mt-3 text-[13px] text-fg-muted max-w-[560px]">Lo que mandó el cliente. El agente propone si va a la marca o a un proyecto y qué es cada imagen; vos revisás y lo sumás. El cliente ve que lo incorporaste.</p>
            <div className="mt-8">
                {items === null && <p className="text-[13px] text-fg-faint">Cargando…</p>}
                {items !== null && pending.length === 0 && <p className="py-6 border-t border-edge text-[13px] text-fg-faint">No hay material nuevo.</p>}
                {pending.map((it) => <Item key={it.id} it={it} campaigns={campaigns} onDone={(x) => setItems((l) => (l || []).map((y) => (y.id === x.id ? x : y)))} />)}
                {past.length > 0 && <p className={`${mono} text-fg-faint mt-10 mb-2`}>Ya revisado</p>}
                {past.map((it) => <Item key={it.id} it={it} campaigns={campaigns} onDone={() => {}} />)}
            </div>
        </div>
    );
}
