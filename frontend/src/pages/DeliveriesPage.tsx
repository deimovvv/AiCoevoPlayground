import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { Check, CornerDownLeft, ExternalLink, Loader2, RotateCcw, Trash2, Upload, X } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import {
    backendUrl, listDeliveries, getDelivery, createDelivery, setDeliveryStatus, addDeliveryComment,
    toggleDeliveryComment, deleteDelivery,
    type Delivery, type DeliveryStatus, type DeliverySummary,
} from "../lib/api";

/**
 * Entregas: lo que Coevo le entrega a la marca para revisar (openspec/changes/studio-v2 P.3–P.4).
 *
 * Las láminas en fila, como en el canvas donde se armó la pieza. Clic sobre una lámina = comentario
 * anclado a ese punto. Se pide cambios o se aprueba. Claude sube y corrige por el MCP `coevo-studio`
 * (subir_entrega · ver_entrega · nueva_ronda); acá sólo se mira y se comenta, no se edita.
 */

const STATUS: Record<DeliveryStatus, { label: string; dot: string }> = {
    en_revision: { label: "Para revisar", dot: "bg-[var(--color-warning)]" },
    cambios: { label: "Con cambios", dot: "bg-[var(--color-brand)]" },
    aprobada: { label: "Aprobada", dot: "bg-[var(--color-success)]" },
};

const mono = "font-mono text-[10px] uppercase tracking-[0.08em]";
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" }) : "");
const who = (a: string | null) => (!a ? "—" : a.startsWith("servicio:") ? "Claude" : a === "local" ? "local" : a.split("@")[0]);

interface Draft { itemId: string; x: number; y: number }

export function DeliveriesPage() {
    const { activeBrand, setActiveBrandId } = useBrand();
    const brandId = activeBrand?.id;
    const [params, setParams] = useSearchParams();
    const selectedId = params.get("id");
    const [list, setList] = useState<DeliverySummary[]>([]);
    const [current, setCurrent] = useState<Delivery | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [draftText, setDraftText] = useState("");
    const [focus, setFocus] = useState<string | null>(null);
    const [uploadTitle, setUploadTitle] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);
    const brandRef = useRef(brandId);

    const refreshList = useCallback(async () => {
        if (!brandId) return;
        try { setList(await listDeliveries(brandId)); } catch (e) { setError((e as Error).message); }
    }, [brandId]);
    useEffect(() => { setList([]); refreshList(); }, [refreshList]);

    const open = useCallback((id: string | null) => {
        setDraft(null); setDraftText("");
        setParams(id ? { id } : {}, { replace: true });
    }, [setParams]);

    // Abrir un link a una entrega (ej. el que devuelve Claude) cambia a la marca de esa entrega.
    useEffect(() => {
        if (!selectedId) { setCurrent(null); return; }
        let alive = true;
        getDelivery(selectedId).then((d) => {
            if (!alive) return;
            if (d.brandId !== brandRef.current) { brandRef.current = d.brandId; setActiveBrandId(d.brandId); }
            setCurrent(d);
        }).catch((e) => alive && setError(e.message));
        return () => { alive = false; };
    }, [selectedId, setActiveBrandId]);

    // Si después cambian la marca activa a mano, la entrega abierta (de otra marca) se cierra.
    useEffect(() => {
        if (brandId === brandRef.current) return;
        brandRef.current = brandId;
        if (current && current.brandId !== brandId) open(null);
    }, [brandId, current, open]);

    const run = async (fn: () => Promise<unknown>) => {
        setBusy(true); setError(null);
        try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    };
    const reload = async (id: string) => { setCurrent(await getDelivery(id)); await refreshList(); };

    const comments = useMemo(() => {
        if (!current) return [];
        const order = Object.fromEntries(current.items.map((it, i) => [it.id, i]));
        return [...current.comments].sort((a, b) =>
            Number(!!a.resolvedAt) - Number(!!b.resolvedAt) || b.round - a.round
            || (order[a.itemId ?? ""] ?? -1) - (order[b.itemId ?? ""] ?? -1));
    }, [current]);
    const labelOf = useMemo(() => Object.fromEntries((current?.items ?? []).map((it) => [it.id, it.label])), [current]);

    if (!activeBrand) {
        return <div className="h-full flex items-center justify-center text-[13px] text-fg-muted">Elegí una marca para ver sus entregas.</div>;
    }

    const onPick = (e: React.MouseEvent<HTMLDivElement>, itemId: string) => {
        const r = e.currentTarget.getBoundingClientRect();
        setDraft({ itemId, x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
        setDraftText("");
    };
    const saveDraft = () => {
        if (!current || !draftText.trim()) return;
        const d = draft;
        run(async () => {
            await addDeliveryComment(current.id, { text: draftText, itemId: d?.itemId ?? null, x: d?.x ?? null, y: d?.y ?? null });
            setDraft(null); setDraftText("");
            await reload(current.id);
        });
    };
    const onUpload = (files: FileList | null) => {
        if (!files?.length || !brandId) return;
        const all = Array.from(files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        const source = all.find((f) => /\.html?$/i.test(f.name)) ?? null;
        const slides = all.filter((f) => f !== source);
        if (!slides.length) { setError("Elegí al menos una imagen o un video."); return; }
        const title = uploadTitle.trim() || slides[0].name.replace(/\.[^.]+$/, "");
        run(async () => {
            const d = await createDelivery(brandId, title, slides, source);
            setUploadTitle("");
            await refreshList(); open(d.id);
        });
    };

    return (
        <div className="h-full flex min-h-0">
            {/* ── Lista ── */}
            <aside className="w-[280px] shrink-0 border-r border-edge flex flex-col min-h-0">
                <div className="px-5 pt-6 pb-4 space-y-3">
                    <div>
                        <h1 className="text-[15px] font-medium text-fg">Entregas</h1>
                        <p className={`${mono} text-fg-faint mt-1`}>{activeBrand.name} · {list.length}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <input value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="Título (opcional)"
                            className="flex-1 min-w-0 h-8 bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2.5 text-[12px] text-fg placeholder:text-fg-faint outline-none focus:border-fg/40" />
                        <button onClick={() => fileRef.current?.click()} disabled={busy} title="Subir láminas (en orden por nombre) y, si hay, el .html editable"
                            className="h-8 px-2.5 flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-edge text-[12px] text-fg-muted hover:text-fg cursor-pointer disabled:opacity-50">
                            <Upload size={13} /> Subir
                        </button>
                        <input ref={fileRef} type="file" multiple hidden accept="image/*,video/*,.html,.htm"
                            onChange={(e) => { onUpload(e.target.files); e.target.value = ""; }} />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto px-2 pb-4">
                    {list.length === 0 && (
                        <p className="px-3 py-6 text-[12px] text-fg-faint leading-relaxed">
                            Todavía no hay entregas. Subilas acá o pedile a Claude: <span className="text-fg-muted">"subí este carrusel a Entregas de {activeBrand.name}"</span>.
                        </p>
                    )}
                    {list.map((d) => (
                        <button key={d.id} onClick={() => open(d.id)}
                            className={`w-full flex gap-3 items-center p-2.5 rounded-[var(--radius-md)] text-left cursor-pointer transition-colors ${d.id === selectedId ? "bg-surface-2" : "hover:bg-surface-1"}`}>
                            <div className="w-10 h-12 shrink-0 rounded-[var(--radius-xs)] bg-surface-2 overflow-hidden">
                                {d.cover && <img src={backendUrl(d.cover)} alt="" className="w-full h-full object-cover" />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[13px] text-fg truncate">{d.title}</p>
                                <p className={`${mono} text-fg-faint mt-1 flex items-center gap-1.5`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS[d.status].dot}`} />
                                    {STATUS[d.status].label}
                                    {d.openComments > 0 && <span className="text-fg-muted">· {d.openComments}</span>}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            </aside>

            {/* ── Entrega ── */}
            <main className="flex-1 min-w-0 flex flex-col min-h-0">
                {error && (
                    <p className="mx-6 mt-4 text-[12px] text-[var(--color-error)] flex items-center gap-2">
                        {error} <button onClick={() => setError(null)} className="cursor-pointer"><X size={12} /></button>
                    </p>
                )}
                {!current ? (
                    <div className="flex-1 flex items-center justify-center text-[13px] text-fg-faint">
                        {selectedId ? <Loader2 size={16} className="animate-spin" /> : "Elegí una entrega."}
                    </div>
                ) : (
                    <>
                        <header className="px-6 pt-6 pb-4 flex flex-wrap items-end gap-x-6 gap-y-3">
                            <div className="min-w-0">
                                <h2 className="text-[18px] text-fg truncate">{current.title}</h2>
                                <p className={`${mono} text-fg-faint mt-1.5 flex items-center gap-2`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS[current.status].dot}`} />
                                    {STATUS[current.status].label} · ronda {current.round} · {current.items.length} láminas · {who(current.createdBy)} · {when(current.updatedAt)}
                                    {current.approvedBy && <> · aprobó {who(current.approvedBy)}</>}
                                </p>
                                {current.note && <p className="text-[12px] text-fg-muted mt-2 max-w-[640px]">{current.note}</p>}
                            </div>
                            <span className="flex-1" />
                            <div className="flex items-center gap-2">
                                {current.source && (
                                    <a href={backendUrl(current.source.url)} target="_blank" rel="noreferrer" title="La fuente editable (la corrige Claude)"
                                        className="h-8 px-3 flex items-center gap-1.5 text-[12px] text-fg-muted hover:text-fg">
                                        Fuente <ExternalLink size={11} />
                                    </a>
                                )}
                                {current.status !== "cambios" && (
                                    <button disabled={busy} onClick={() => run(async () => { setCurrent(await setDeliveryStatus(current.id, "cambios")); await refreshList(); })}
                                        className="h-8 px-3 flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-edge text-[12px] text-fg-muted hover:text-fg cursor-pointer disabled:opacity-50">
                                        <RotateCcw size={12} /> Pedir cambios
                                    </button>
                                )}
                                {current.status !== "aprobada" && (
                                    <button disabled={busy} onClick={() => run(async () => { setCurrent(await setDeliveryStatus(current.id, "aprobada")); await refreshList(); })}
                                        className="h-8 px-3 flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-fg text-[var(--color-canvas)] text-[12px] font-medium cursor-pointer disabled:opacity-50">
                                        <Check size={12} /> Aprobar
                                    </button>
                                )}
                                <button disabled={busy} title="Borrar la entrega"
                                    onClick={() => { if (window.confirm(`¿Borrar "${current.title}" y sus comentarios?`)) run(async () => { await deleteDelivery(current.id); open(null); await refreshList(); }); }}
                                    className="w-8 h-8 flex items-center justify-center text-fg-faint hover:text-[var(--color-error)] cursor-pointer">
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        </header>

                        <div className="flex-1 min-h-0 flex">
                            {/* Láminas en fila */}
                            <div className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden">
                                <div className="h-full flex items-center gap-3 px-6 pb-6">
                                    {current.items.map((it) => {
                                        const pins = comments.filter((c) => c.itemId === it.id && c.round === current.round && c.x != null);
                                        return (
                                            <figure key={it.id} className="shrink-0 flex flex-col">
                                                <div className="relative h-[min(46vh,460px)] cursor-crosshair select-none" onClick={(e) => onPick(e, it.id)}>
                                                    {it.kind === "video"
                                                        ? <video src={backendUrl(it.url)} controls className="h-full w-auto rounded-[var(--radius-xs)] bg-surface-1" />
                                                        : <img src={backendUrl(it.url)} alt={it.label} draggable={false} className="h-full w-auto rounded-[var(--radius-xs)] bg-surface-1" />}
                                                    {pins.map((c) => (
                                                        <span key={c.id} onMouseEnter={() => setFocus(c.id)} onMouseLeave={() => setFocus(null)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            style={{ left: `${c.x! * 100}%`, top: `${c.y! * 100}%` }}
                                                            className={`absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium ring-2 ring-black/30 transition-transform
                                                                ${c.resolvedAt ? "bg-surface-3 text-fg-faint" : "bg-[var(--color-brand)] text-[var(--color-brand-fg)]"} ${focus === c.id ? "scale-125" : ""}`}>
                                                            {comments.indexOf(c) + 1}
                                                        </span>
                                                    ))}
                                                    {draft?.itemId === it.id && (
                                                        <span style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%` }}
                                                            className="absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-[var(--color-brand)] bg-black/40 animate-pulse" />
                                                    )}
                                                </div>
                                                <figcaption className={`${mono} text-fg-faint mt-2`}>{it.label}</figcaption>
                                            </figure>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Comentarios */}
                            <aside className="w-[300px] shrink-0 border-l border-edge flex flex-col min-h-0">
                                <div className="p-4 border-b border-edge">
                                    <p className={`${mono} text-fg-faint mb-2`}>
                                        {draft ? `Comentario en ${labelOf[draft.itemId]}` : "Clic en una lámina para anclar · o sobre toda la entrega"}
                                    </p>
                                    <textarea value={draftText} onChange={(e) => setDraftText(e.target.value)} rows={3}
                                        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveDraft(); }}
                                        placeholder="Qué cambiarías…"
                                        className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2.5 py-2 text-[12px] text-fg placeholder:text-fg-faint outline-none focus:border-fg/40 resize-none" />
                                    <div className="flex items-center justify-end gap-2 mt-2">
                                        {draft && <button onClick={() => setDraft(null)} className="text-[11px] text-fg-faint hover:text-fg cursor-pointer">Soltar punto</button>}
                                        <button disabled={busy || !draftText.trim()} onClick={saveDraft}
                                            className="h-7 px-2.5 flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-edge text-[11px] text-fg-muted hover:text-fg cursor-pointer disabled:opacity-40">
                                            Comentar <CornerDownLeft size={11} />
                                        </button>
                                    </div>
                                </div>
                                <ol className="flex-1 overflow-y-auto p-2">
                                    {comments.length === 0 && <li className="px-2 py-4 text-[12px] text-fg-faint">Sin comentarios.</li>}
                                    {comments.map((c, i) => (
                                        <li key={c.id} onMouseEnter={() => setFocus(c.id)} onMouseLeave={() => setFocus(null)}
                                            className={`group p-2.5 rounded-[var(--radius-md)] ${focus === c.id ? "bg-surface-1" : ""} ${c.resolvedAt || c.round < current.round ? "opacity-50" : ""}`}>
                                            <div className={`${mono} text-fg-faint flex items-center gap-1.5`}>
                                                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${c.resolvedAt ? "bg-surface-3" : "bg-[var(--color-brand)] text-[var(--color-brand-fg)]"}`}>{i + 1}</span>
                                                {c.itemId ? labelOf[c.itemId] ?? `ronda ${c.round}` : "toda"} · {who(c.author)}
                                                {c.round < current.round && <> · r{c.round}</>}
                                                <span className="flex-1" />
                                                <button onClick={() => run(async () => { await toggleDeliveryComment(current.id, c.id); await reload(current.id); })}
                                                    title={c.resolvedAt ? "Reabrir" : "Marcar resuelto"}
                                                    className="opacity-0 group-hover:opacity-100 text-fg-faint hover:text-fg cursor-pointer">
                                                    {c.resolvedAt ? <RotateCcw size={11} /> : <Check size={12} />}
                                                </button>
                                            </div>
                                            <p className={`text-[12px] text-fg mt-1.5 leading-relaxed ${c.resolvedAt ? "line-through decoration-fg/30" : ""}`}>{c.text}</p>
                                        </li>
                                    ))}
                                </ol>
                            </aside>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
