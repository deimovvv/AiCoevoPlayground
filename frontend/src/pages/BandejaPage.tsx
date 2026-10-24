import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ExternalLink, FileText, Film, Loader2, Sparkles, Upload } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import {
    applyInboxIdentity, backendUrl, discardInbox, incorporateInbox, listCampaigns, listInbox, proposeInbox, sendMaterial,
    type Campaign, type InboxDest, type InboxItem, type PdfIdentity,
} from "../lib/api";

/**
 * Material del cliente (equipo, studio-v2 §12/§15): lo que mandó, y adónde va cada imagen.
 * Destino: la marca o un proyecto. Tipo: uno para todas, y se puede cambiar por imagen o descartar.
 * Un PDF de marca llega partido en páginas (cada una se ordena como una imagen) y el agente lee su identidad:
 * colores, tipografías, tono; «Pasar a Marca» la deja como propuesta. Video y links quedan acá para abrirlos.
 */

const DEST: Array<[InboxDest, string]> = [
    ["moodboard", "Moodboard"], ["luz", "Luz"], ["locacion", "Locación"], ["plano", "Plano"], ["pose", "Pose"],
    ["cara", "Cara"], ["prenda", "Prenda"], ["producto", "Producto"], ["manual", "Manual"], ["carrusel", "Carrusel"],
];

/** Lo que el agente leyó del PDF de marca, y el botón para pasarlo a Marca como propuesta. */
function IdentityRead({ itemId, ident, applied, onApplied }: { itemId: string; ident: PdfIdentity; applied?: string[]; onApplied: (t: string[]) => void }) {
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const fonts = [ident.tipografias?.headline, ident.tipografias?.body].filter(Boolean);
    return (
        <div className="mt-4 p-4 rounded-[4px] border border-edge bg-[var(--color-surface-1)] flex flex-col gap-2.5">
            <p className="text-[12px] text-fg-muted flex items-center gap-1.5"><Sparkles size={12} className="text-[var(--color-brand)]" /> Lo que el agente leyó del manual</p>
            {ident.contexto && <p className="text-[13px] leading-relaxed text-fg">{ident.contexto}</p>}
            {ident.colores?.length ? (
                <div className="flex flex-wrap gap-2">
                    {ident.colores.map((c) => (
                        <span key={c.hex} title={c.usage} className="flex items-center gap-1.5 text-[11px] text-fg-muted">
                            <span className="w-4 h-4 rounded-[3px] border border-edge" style={{ background: c.hex }} />{c.name} <span className="font-mono">{c.hex}</span>
                        </span>
                    ))}
                </div>
            ) : null}
            <p className="text-[12px] text-fg-muted">
                {fonts.length ? <>Tipografías: <span className="text-fg">{fonts.join(" / ")}</span>. </> : null}
                {ident.tono?.length ? <>Tono: <span className="text-fg">{ident.tono.join(", ")}</span>. </> : null}
                {ident.nunca?.length ? <>Nunca dice: <span className="text-fg">{ident.nunca.join(", ")}</span>.</> : null}
            </p>
            {ident.siempre?.length || ident.nunca_visual?.length ? (
                <p className="text-[12px] text-fg-muted">
                    {ident.siempre?.length ? <>Siempre: <span className="text-fg">{ident.siempre.join(" · ")}</span>. </> : null}
                    {ident.nunca_visual?.length ? <>Nunca: <span className="text-fg">{ident.nunca_visual.join(" · ")}</span>.</> : null}
                </p>
            ) : null}
            <div className="flex items-center gap-3 pt-1">
                {applied ? (
                    <span className="text-[12px] text-fg">{applied.length ? "Pasado a Marca como propuesta: aprobalo en Marca." : "Marca ya tenía todo cargado: no se pisó nada."}</span>
                ) : (
                    <button disabled={busy} onClick={async () => { setBusy(true); setErr(null); try { onApplied((await applyInboxIdentity(itemId)).touched); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } }}
                        className="h-8 px-3 rounded-[4px] border border-edge text-[12px] text-fg hover:border-fg cursor-pointer disabled:opacity-40">
                        {busy ? "Pasando…" : "Pasar a Marca como propuesta"}
                    </button>
                )}
                <span className="text-[11px] text-fg-faint">Sólo llena lo que está vacío; no pisa nada.</span>
                {err && <span className="text-[12px] text-[var(--color-error)]">{err}</span>}
            </div>
        </div>
    );
}
const mono = "font-mono text-[10px] uppercase tracking-[0.09em]";
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
const who = (a: string | null) => (!a ? "—" : a.startsWith("servicio:") ? "Claude" : a.split("@")[0]);

function Item({ it, campaigns, onDone }: { it: InboxItem; campaigns: Campaign[]; onDone: (x: InboxItem) => void }) {
    const images = it.files.filter((f) => f.kind === "image");
    const others = it.files.filter((f) => f.kind !== "image");
    const [applied, setApplied] = useState<string[] | undefined>(it.proposal?.identityApplied);
    // El agente tarda: mientras no hay propuesta, no se puede sumar (si no, todo entra como «moodboard»).
    const waitingAgent = it.status === "nuevo" && it.files.some((f) => f.kind === "image") && !it.proposal;
    // Arranca con lo que propuso el agente (si hay); el equipo confirma o corrige.
    const p = it.proposal?.status === "ok" ? it.proposal : null;
    const [target, setTarget] = useState(p?.target ?? "marca");
    const [type, setType] = useState<InboxDest>("moodboard");
    const [per, setPer] = useState<Record<string, InboxDest>>(p?.perFile ?? {});
    const [off, setOff] = useState<string[]>(p?.discard ?? []);
    const [busy, setBusy] = useState(false);
    const [thinking, setThinking] = useState(false);
    // Cuando la propuesta llega (la Bandeja se actualiza sola), elegir lo que propuso.
    const [seen, setSeen] = useState(!!p);
    if (p && !seen) { setSeen(true); setTarget(p.target ?? "marca"); setPer(p.perFile ?? {}); setOff(p.discard ?? []); }
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
                    {thinking || waitingAgent ? <span className="flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" /> El agente lo está mirando… (un PDF tarda hasta un minuto)</span>
                        : p ? <span>El agente lo dejó elegido{p.why ? `: ${p.why}` : "."} Revisalo y sumalo, o cambiá lo que no va. <button onClick={ask} className="underline underline-offset-2 cursor-pointer">Volver a proponer</button></span>
                            : <span>{it.proposal?.status === "error" ? "El agente no pudo mirarlo. " : ""}<button onClick={ask} className="underline underline-offset-2 text-fg cursor-pointer">Que lo ordene el agente</button></span>}
                </p>
            )}
            {p?.identity && <IdentityRead itemId={it.id} ident={p.identity} applied={applied} onApplied={setApplied} />}
            {(it.link || others.length > 0) && (
                <div className="flex flex-wrap gap-3 mt-3 text-[12px]">
                    {it.link && <a href={it.link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-fg underline underline-offset-2">Link del cliente <ExternalLink size={11} /></a>}
                    {others.map((f) => (
                        <a key={f.url} href={backendUrl(f.url)} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-fg-muted hover:text-fg">
                            {f.kind === "video" ? <Film size={12} /> : <FileText size={12} />} {f.name}
                            {f.kind === "pdf" && images.some((x) => x.fromPdf === f.name) && <span className="text-fg-faint">· partido en {images.filter((x) => x.fromPdf === f.name).length} páginas</span>}
                        </a>
                    ))}
                </div>
            )}
            {images.length > 0 && (
                <div className="flex gap-2 overflow-x-auto mt-4 pb-1">
                    {images.map((f) => {
                        const isOff = off.includes(f.url);
                        return (
                            <figure key={f.url} className={`shrink-0 ${f.fromPdf ? "w-[230px]" : "w-[132px]"} flex flex-col gap-1.5`}>
                                <button disabled={done} onClick={() => setOff(isOff ? off.filter((u) => u !== f.url) : [...off, f.url])} title={isOff ? "Sumar" : "Descartar esta"}
                                    className={`relative ${f.fromPdf ? "h-[140px]" : "h-[165px]"} rounded-[2px] overflow-hidden cursor-pointer ${isOff ? "opacity-30" : ""}`}>
                                    <img src={backendUrl(f.url)} alt={f.name} className={`w-full h-full ${f.fromPdf ? "object-contain bg-[var(--color-surface-2)]" : "object-cover"}`} />
                                    {f.page && <span className="absolute left-1 top-1 px-1 rounded-[2px] bg-black/60 text-white text-[10px]">pág. {f.page}</span>}
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
                            <button disabled={busy || waitingAgent || thinking || off.length === images.length} title={waitingAgent ? "Esperá a que el agente termine" : undefined}
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

    const pdfRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState<number | null>(null);
    const [upErr, setUpErr] = useState<string | null>(null);
    const uploadPdf = async (list: FileList | null) => {
        const f = list?.[0];
        if (!f || !brandId) return;
        setUpErr(null); setUploading(0);
        try {
            const it = await sendMaterial(brandId, { files: [f], note: `PDF de marca: ${f.name}` }, setUploading);
            setItems((l) => [it, ...(l || [])]);
        } catch (e) { setUpErr((e as Error).message); } finally { setUploading(null); }
    };
    const pending = (items || []).filter((i) => i.status === "nuevo");
    const anyWaiting = pending.some((i) => !i.proposal && i.files.some((f) => f.kind === "image"));
    useEffect(() => {
        if (!anyWaiting || !brandId) return;
        const t = setInterval(() => { listInbox(brandId).then(setItems).catch(() => {}); }, 4000);
        return () => clearInterval(t);
    }, [anyWaiting, brandId]);
    const past = (items || []).filter((i) => i.status !== "nuevo");
    return (
        <div className="max-w-[1200px] mx-auto px-4 md:px-10 py-8 pb-20">
            <Link to="/dashboard/produccion" className="text-[12px] text-fg-muted hover:text-fg no-underline">← Producción</Link>
            <p className={`${mono} text-fg-faint mt-8`}>{activeBrand?.name}</p>
            <h1 className="mt-2 text-[40px] leading-none tracking-[-0.035em] text-fg">Material del cliente</h1>
            <p className="mt-3 text-[13px] text-fg-muted max-w-[560px]">Lo que mandó el cliente. El agente propone si va a la marca o a un proyecto y qué es cada imagen; vos revisás y lo sumás. El cliente ve que lo incorporaste.</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
                <button onClick={() => pdfRef.current?.click()} disabled={uploading !== null}
                    className="h-9 px-3.5 flex items-center gap-1.5 rounded-[4px] border border-edge text-[13px] text-fg hover:border-fg cursor-pointer disabled:opacity-50">
                    {uploading !== null ? <><Loader2 size={13} className="animate-spin" /> {uploading < 1 ? `Subiendo ${Math.round(uploading * 100)}%` : "Separando páginas…"}</> : <><Upload size={13} /> Subir un PDF de marca</>}
                </button>
                <span className="text-[12px] text-fg-faint">Manual, moodboard, referencias: todo junto. Se separa en páginas y el agente ordena cada una y lee la identidad.</span>
                <input ref={pdfRef} type="file" accept="application/pdf" hidden onChange={(e) => { uploadPdf(e.target.files); e.target.value = ""; }} />
                {upErr && <span className="text-[12px] text-[var(--color-error)]">{upErr}</span>}
            </div>
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
