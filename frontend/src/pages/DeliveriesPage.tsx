import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowRight, Check, ChevronLeft, ChevronRight, CornerDownLeft, Eye, ExternalLink, Loader2, RotateCcw, Trash2, Upload, X } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import { useMe } from "../lib/useMe";
import {
    backendUrl, listDeliveries, getDelivery, createDelivery, setDeliveryStatus, addDeliveryComment,
    toggleDeliveryComment, deleteDelivery, sendDelivery,
    type Delivery, type DeliveryStatus, type DeliverySummary,
} from "../lib/api";

/**
 * Entregas: lo que Coevo le entrega a la marca para revisar (openspec/changes/studio-v2 P.3–P.4).
 *
 * Dos vistas: la pieza entera (todas las láminas en una fila, como en el canvas donde se armó) y una
 * lámina grande, donde se comenta (clic = comentario anclado a ese punto; ← → para pasar). Se pide cambios o se aprueba. Claude sube y corrige por el MCP `coevo-studio`
 * (subir_entrega · ver_entrega · nueva_ronda); acá sólo se mira y se comenta, no se edita.
 *
 * Dos modos (studio-v2 §11). Equipo: ve todo; una entrega nace interna y se "manda al cliente".
 * Cliente (/cliente): sólo lo mandado, sin comentarios internos; aprueba o pide cambios.
 */

type Mode = "equipo" | "cliente";
const DOT: Record<DeliveryStatus, string> = {
    en_revision: "bg-[var(--color-warning)]",
    cambios: "bg-[var(--color-brand)]",
    aprobada: "bg-[var(--color-success)]",
};
/** Cómo se llama el estado según quién mira. */
function stateLabel(d: { status: DeliveryStatus; visibility: "interna" | "cliente" }, mode: Mode): string {
    if (d.status === "aprobada") return "Aprobada";
    if (mode === "cliente") return d.status === "cambios" ? "Pediste cambios" : "Para revisar";
    if (d.visibility === "interna") return d.status === "cambios" ? "Interna · otra vuelta" : "Interna";
    return d.status === "cambios" ? "El cliente pidió cambios" : "Con el cliente";
}

const mono = "font-mono text-[10px] uppercase tracking-[0.08em]";
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" }) : "");
const who = (a: string | null) => (!a ? "—" : a.startsWith("servicio:") ? "Claude" : a === "local" ? "local" : a.split("@")[0]);

interface Draft { itemId: string; x: number; y: number }

export function DeliveriesPage({ mode = "equipo" }: { mode?: Mode }) {
    const client = mode === "cliente";
    const me = useMe();
    const vista = client ? "cliente" as const : undefined;
    const { activeBrand, setActiveBrandId } = useBrand();
    const brandId = activeBrand?.id;
    // Un cliente sin permiso de aprobar sólo comenta (el servidor también lo frena).
    const mayApprove = !client || !me.brands || me.brands.some((b) => b.id === brandId && b.canApprove);
    const [params, setParams] = useSearchParams();
    const selectedId = params.get("id");
    const [list, setList] = useState<DeliverySummary[]>([]);
    const [current, setCurrent] = useState<Delivery | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [draftText, setDraftText] = useState("");
    const [focus, setFocus] = useState<string | null>(null);
    const [slide, setSlide] = useState<number | null>(null);   // null = la pieza entera; n = una lámina grande
    const [uploadTitle, setUploadTitle] = useState("");
    const [tab, setTab] = useState<"revisar" | "aprobadas">("revisar");   // sólo cliente
    const fileRef = useRef<HTMLInputElement>(null);
    const brandRef = useRef(brandId);

    const refreshList = useCallback(async () => {
        if (!brandId) return;
        try { setList(await listDeliveries(brandId, vista)); } catch (e) { setError((e as Error).message); }
    }, [brandId, vista]);
    useEffect(() => { setList([]); refreshList(); }, [refreshList]);

    const open = useCallback((id: string | null) => {
        setDraft(null); setDraftText(""); setSlide(null);
        setParams(id ? { id } : {}, { replace: true });
    }, [setParams]);

    // Abrir un link a una entrega (ej. el que devuelve Claude) cambia a la marca de esa entrega.
    useEffect(() => {
        if (!selectedId) { setCurrent(null); return; }
        let alive = true;
        getDelivery(selectedId, vista).then((d) => {
            if (!alive) return;
            if (d.brandId !== brandRef.current) { brandRef.current = d.brandId; setActiveBrandId(d.brandId); }
            setCurrent(d);
            // ?lamina=3 abre esa lámina (links a un comentario puntual).
            const n = Number(new URLSearchParams(window.location.search).get("lamina"));
            if (n >= 1 && n <= d.items.length) setSlide(n - 1);
        }).catch((e) => alive && setError(e.message));
        return () => { alive = false; };
    }, [selectedId, setActiveBrandId, vista]);

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
    const reload = async (id: string) => { setCurrent(await getDelivery(id, vista)); await refreshList(); };
    const shown = client ? list.filter((d) => (tab === "aprobadas") === (d.status === "aprobada")) : list;

    const comments = useMemo(() => {
        if (!current) return [];
        const order = Object.fromEntries(current.items.map((it, i) => [it.id, i]));
        return [...current.comments].sort((a, b) =>
            Number(!!a.resolvedAt) - Number(!!b.resolvedAt) || b.round - a.round
            || (order[a.itemId ?? ""] ?? -1) - (order[b.itemId ?? ""] ?? -1));
    }, [current]);
    const numberOf = useMemo(() => Object.fromEntries(comments.map((c, i) => [c.id, i + 1])), [comments]);
    const total = current?.items.length ?? 0;

    // Lámina abierta: ← → para pasar, Esc para volver a la pieza (salvo escribiendo un comentario).
    useEffect(() => {
        if (slide === null) return;
        const onKey = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement)?.tagName === "TEXTAREA" || (e.target as HTMLElement)?.tagName === "INPUT") return;
            if (e.key === "Escape") { setSlide(null); setDraft(null); }
            if (e.key === "ArrowRight") { setSlide((n) => (n === null ? n : Math.min(total - 1, n + 1))); setDraft(null); }
            if (e.key === "ArrowLeft") { setSlide((n) => (n === null ? n : Math.max(0, n - 1))); setDraft(null); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [slide, total]);

    if (!activeBrand) {
        return <div className="h-full flex items-center justify-center text-[13px] text-fg-muted">Elegí una marca para ver sus entregas.</div>;
    }

    const onPick = (e: React.MouseEvent<HTMLDivElement>, itemId: string) => {
        const r = e.currentTarget.getBoundingClientRect();
        setDraft({ itemId, x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
        setDraftText("");
    };
    const saveDraft = (itemId: string) => {
        if (!current || !draftText.trim()) return;
        const d = draft?.itemId === itemId ? draft : null;
        run(async () => {
            await addDeliveryComment(current.id, { text: draftText, itemId, x: d?.x ?? null, y: d?.y ?? null, asClient: client });
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
            {/* Celular: o la lista o la entrega abierta. Escritorio: las dos. */}
            <aside className={`${selectedId ? "hidden md:flex" : "flex"} w-full md:w-[280px] shrink-0 md:border-r border-edge flex-col min-h-0`}>
                <div className="px-5 pt-6 pb-4 space-y-3">
                    <div className="flex items-baseline gap-2">
                        <h1 className="text-[15px] font-medium text-fg">{client ? (tab === "revisar" ? "Para revisar" : "Aprobadas") : "Entregas"}</h1>
                        <span className={`${mono} text-fg-faint`}>{shown.length}</span>
                        <span className="flex-1" />
                        {!client && (
                            <Link to="/cliente" title="Ver lo que ve el cliente de esta marca"
                                className="flex items-center gap-1 text-[12px] text-fg-faint hover:text-fg no-underline"><Eye size={12} /> Ver como cliente</Link>
                        )}
                    </div>
                    {client ? (
                        <div className="flex gap-1 p-0.5 bg-[var(--color-surface-2)] rounded-[5px] text-[12px]">
                            {(["revisar", "aprobadas"] as const).map((t) => (
                                <button key={t} onClick={() => { setTab(t); open(null); }}
                                    className={`flex-1 h-7 rounded-[4px] cursor-pointer ${tab === t ? "bg-[var(--color-surface-1)] text-fg" : "text-fg-muted"}`}>
                                    {t === "revisar" ? "Para revisar" : "Aprobadas"}
                                </button>
                            ))}
                        </div>
                    ) : (
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
                    )}
                </div>
                <div className="flex-1 overflow-y-auto px-2 pb-4">
                    {shown.length === 0 && (
                        <p className="px-3 py-6 text-[12px] text-fg-faint leading-relaxed">
                            {client ? (tab === "revisar" ? "No hay nada esperando tu respuesta." : "Todavía no aprobaste piezas.")
                                : <>Todavía no hay entregas. Subilas acá o pedile a Claude: <span className="text-fg-muted">"subí este carrusel a Entregas de {activeBrand.name}"</span>.</>}
                        </p>
                    )}
                    {shown.map((d) => (
                        <button key={d.id} onClick={() => open(d.id)}
                            className={`w-full flex gap-3 items-center p-2.5 rounded-[var(--radius-md)] text-left cursor-pointer transition-colors ${d.id === selectedId ? "bg-surface-2" : "hover:bg-surface-1"}`}>
                            <div className="w-10 h-12 shrink-0 rounded-[var(--radius-xs)] bg-surface-2 overflow-hidden">
                                {d.cover && <img src={backendUrl(d.cover)} alt="" className="w-full h-full object-cover" />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[13px] text-fg truncate">{d.title}</p>
                                <p className={`${mono} text-fg-faint mt-1 flex items-center gap-1.5`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${d.visibility === "interna" && !client ? "bg-[var(--color-edge-strong)]" : DOT[d.status]}`} />
                                    {stateLabel(d, mode)}
                                    {d.openComments > 0 && <span className="text-fg-muted">· {d.openComments}</span>}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            </aside>

            {/* ── Entrega ── */}
            <main className={`${selectedId ? "flex" : "hidden md:flex"} flex-1 min-w-0 flex-col min-h-0`}>
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
                        <header className="px-4 md:px-6 py-3 md:py-4 flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-edge">
                            <button onClick={() => open(null)} className="md:hidden text-[13px] text-fg-muted cursor-pointer">← Entregas</button>
                            <div className="min-w-0 w-full md:w-auto order-first md:order-none">
                                <h2 className="text-[15px] font-medium text-fg truncate">{current.title}</h2>
                                <p className="text-[11px] text-fg-faint mt-0.5 flex items-center gap-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full ${current.visibility === "interna" && !client ? "bg-[var(--color-edge-strong)]" : DOT[current.status]}`} />
                                    {stateLabel(current, mode)}
                                    {current.round > 1 && <> · versión {current.round}</>}
                                    {client
                                        ? <> · llegó el {when(current.sentAt ?? current.createdAt)}</>
                                        : <>{" "}· subida por {who(current.createdBy)} el {when(current.createdAt)}{current.sentAt && <> · mandada el {when(current.sentAt)}</>}</>}
                                    {current.approvedBy && <> · aprobó {who(current.approvedBy)}</>}
                                </p>
                            </div>
                            <span className="hidden md:block flex-1" />
                            <div className="w-full md:w-auto flex items-center gap-2 [&>button]:flex-1 md:[&>button]:flex-none">
                            {!client && current.source && (
                                <a href={backendUrl(current.source.url)} target="_blank" rel="noreferrer" title="El archivo editable de la pieza"
                                    className="flex items-center gap-1 text-[12px] text-fg-faint hover:text-fg">Fuente <ExternalLink size={11} /></a>
                            )}
                            {client ? (
                                <>
                                    {current.status !== "cambios" && (
                                        <button disabled={busy} onClick={() => run(async () => { await setDeliveryStatus(current.id, "cambios"); await reload(current.id); })}
                                            className="h-8 px-3 flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-edge text-[12px] text-fg-muted hover:text-fg cursor-pointer disabled:opacity-50">
                                            <RotateCcw size={12} /> Pedir cambios
                                        </button>
                                    )}
                                    {current.status !== "aprobada" && mayApprove && (
                                        <button disabled={busy} onClick={() => run(async () => { await setDeliveryStatus(current.id, "aprobada"); await reload(current.id); })}
                                            className="h-8 px-3 flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-fg text-[var(--color-canvas)] text-[12px] font-medium cursor-pointer disabled:opacity-50">
                                            <Check size={12} /> Aprobar
                                        </button>
                                    )}
                                </>
                            ) : current.visibility === "interna" ? (
                                <>
                                    {current.status !== "cambios" && (
                                        <button disabled={busy} title="Que Claude o el equipo la corrijan antes de mandarla"
                                            onClick={() => run(async () => { await setDeliveryStatus(current.id, "cambios"); await reload(current.id); })}
                                            className="h-8 px-3 flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-edge text-[12px] text-fg-muted hover:text-fg cursor-pointer disabled:opacity-50">
                                            <RotateCcw size={12} /> Pedir otra vuelta
                                        </button>
                                    )}
                                    <button disabled={busy} title="El cliente la ve desde ahora, sin los comentarios internos"
                                        onClick={() => { if (window.confirm(`¿Mandar "${current.title}" al cliente?`)) run(async () => { await sendDelivery(current.id); await reload(current.id); }); }}
                                        className="h-8 px-3 flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-fg text-[var(--color-canvas)] text-[12px] font-medium cursor-pointer disabled:opacity-50">
                                        Mandar al cliente <ArrowRight size={12} />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Link to={`/cliente?id=${current.id}`} className="flex items-center gap-1 text-[12px] text-fg-faint hover:text-fg no-underline"><Eye size={12} /> Como la ve el cliente</Link>
                                    {current.status !== "aprobada" && (
                                        <button disabled={busy} title="Si el cliente la aprobó por otro lado (WhatsApp, reunión)"
                                            onClick={() => run(async () => { await setDeliveryStatus(current.id, "aprobada"); await reload(current.id); })}
                                            className="h-8 px-3 flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-edge text-[12px] text-fg-muted hover:text-fg cursor-pointer disabled:opacity-50">
                                            <Check size={12} /> Marcar aprobada
                                        </button>
                                    )}
                                </>
                            )}
                            {!client && (
                                <button disabled={busy} title="Borrar la entrega"
                                    onClick={() => { if (window.confirm(`¿Borrar "${current.title}" y sus comentarios?`)) run(async () => { await deleteDelivery(current.id); open(null); await refreshList(); }); }}
                                    className="w-8 h-8 flex items-center justify-center text-fg-faint hover:text-[var(--color-error)] cursor-pointer">
                                    <Trash2 size={13} />
                                </button>
                            )}
                            </div>
                        </header>

                        {slide === null ? (
                            /* ── Vista 1: la pieza entera, como en el canvas, + lo que pidieron ── */
                            <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
                            <div className="md:flex-1 min-w-0 md:overflow-auto bg-[var(--color-canvas)] flex flex-col">
                                <div className="md:flex-1 flex items-center justify-center py-5 md:p-10">
                                    {/* Celular: láminas que se deslizan. Escritorio: todas en una fila. */}
                                    <div style={{ ["--cols" as string]: Math.min(total, 6) }}
                                        className="w-full flex md:grid gap-3 md:gap-4 items-center overflow-x-auto md:overflow-visible snap-x px-4 md:px-0 md:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))] md:max-w-[calc(var(--cols)*300px)]">
                                        {current.items.map((it, i) => {
                                            const pins = comments.filter((c) => c.itemId === it.id && c.round === current.round && c.x != null && !c.resolvedAt);
                                            return (
                                                <button key={it.id} onClick={() => { setSlide(i); setDraft(null); }} title="Abrir para comentar"
                                                    className="group text-left cursor-zoom-in w-[78vw] max-w-[360px] md:w-auto md:max-w-none shrink-0 snap-center">
                                                    <div className="relative">
                                                        {it.kind === "video"
                                                            ? <video src={backendUrl(it.url)} muted className="w-full h-auto max-h-[64vh] object-contain rounded-[var(--radius-xs)] bg-surface-1 transition-transform group-hover:-translate-y-0.5" />
                                                            : <img src={backendUrl(it.url)} alt={it.label} draggable={false} className="w-full h-auto max-h-[64vh] object-contain rounded-[var(--radius-xs)] bg-surface-1 shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition-transform group-hover:-translate-y-0.5" />}
                                                        {pins.map((c) => (
                                                            <span key={c.id} style={{ left: `${c.x! * 100}%`, top: `${c.y! * 100}%` }}
                                                                className="absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-medium bg-[var(--color-brand)] text-[var(--color-brand-fg)] ring-2 ring-black/30">
                                                                {numberOf[c.id]}
                                                            </span>
                                                        ))}
                                                    </div>
                                                    <p className="text-[11px] text-fg-faint mt-2 flex items-center gap-1.5">
                                                        <span className="tabular-nums">{String(i + 1).padStart(2, "0")}</span> {it.label !== String(i + 1).padStart(2, "0") && it.label}
                                                        {pins.length > 0 && <span className="text-[var(--color-brand)]">· {pins.length}</span>}
                                                    </p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <footer className="px-6 py-3 border-t border-edge bg-surface-0 flex items-center gap-4">
                                    <p className="text-[12px] text-fg-faint shrink-0">
                                        {comments.filter((c) => !c.resolvedAt).length
                                            ? `${comments.filter((c) => !c.resolvedAt).length === 1 ? "1 comentario abierto" : `${comments.filter((c) => !c.resolvedAt).length} comentarios abiertos`} · tocá una lámina para verla y comentar`
                                            : "Clic en una lámina para verla grande y comentar sobre ella."}
                                    </p>
                                    {current.note && <p className="text-[12px] text-fg-muted truncate" title={current.note}>{current.note}</p>}
                                </footer>
                            </div>
                            {(() => {
                                // Lo que pidieron, sin entrar a cada lámina: abiertos, primero los del cliente.
                                const pending = comments.filter((c) => !c.resolvedAt)
                                    .sort((a, b) => Number(a.internal) - Number(b.internal));
                                if (!pending.length) return null;
                                const idx = Object.fromEntries(current.items.map((it, i) => [it.id, i]));
                                return (
                                    <aside className="w-full md:w-[320px] shrink-0 border-t md:border-t-0 md:border-l border-edge flex flex-col md:min-h-0">
                                        <p className={`${mono} text-fg-faint px-5 pt-5 pb-3`}>
                                            {client ? "Tus comentarios" : "Lo que pidieron"} · {pending.length}
                                        </p>
                                        <ol className="flex-1 overflow-y-auto px-2 pb-4">
                                            {pending.map((c) => {
                                                const i = c.itemId ? idx[c.itemId] : undefined;
                                                return (
                                                    <li key={c.id}>
                                                        <button onClick={() => { if (i !== undefined) { setSlide(i); setDraft(null); } }}
                                                            disabled={i === undefined}
                                                            className="w-full text-left p-3 rounded-[var(--radius-md)] hover:bg-[var(--color-surface-1)] cursor-pointer disabled:cursor-default">
                                                            <span className="text-[11px] text-fg-faint flex items-center gap-1.5">
                                                                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] bg-[var(--color-brand)] text-[var(--color-brand-fg)]">{numberOf[c.id]}</span>
                                                                {i !== undefined ? `Lámina ${String(i + 1).padStart(2, "0")}` : "Toda la pieza"}
                                                                {" · "}{client ? (c.internal ? "Coevo" : "Vos") : <span className={c.internal ? "" : "text-[var(--color-brand)]"}>{c.internal ? `${who(c.author)} · interno` : "cliente"}</span>}
                                                                {c.round < current.round && ` · versión ${c.round}`}
                                                            </span>
                                                            <span className="block text-[13px] leading-relaxed text-fg mt-1.5">{c.text}</span>
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ol>
                                    </aside>
                                );
                            })()}
                            </div>
                        ) : (
                            /* ── Vista 2: una lámina grande + sus comentarios ── */
                            (() => {
                                const it = current.items[slide];
                                const here = comments.filter((c) => c.itemId === it.id);
                                const general = comments.filter((c) => !c.itemId);
                                return (
                                    <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
                                        <div className="md:flex-1 min-w-0 flex flex-col bg-[var(--color-canvas)]">
                                            <div className="px-6 py-3 flex items-center gap-3 text-[12px]">
                                                <button onClick={() => { setSlide(null); setDraft(null); }} className="text-fg-muted hover:text-fg cursor-pointer">← Toda la pieza</button>
                                                <span className="flex-1" />
                                                <button disabled={slide === 0} onClick={() => { setSlide(slide - 1); setDraft(null); }}
                                                    className="w-7 h-7 flex items-center justify-center rounded-full text-fg-muted hover:text-fg hover:bg-surface-2 disabled:opacity-30 cursor-pointer"><ChevronLeft size={15} /></button>
                                                <span className="text-fg-faint tabular-nums">{slide + 1} / {total}</span>
                                                <button disabled={slide === total - 1} onClick={() => { setSlide(slide + 1); setDraft(null); }}
                                                    className="w-7 h-7 flex items-center justify-center rounded-full text-fg-muted hover:text-fg hover:bg-surface-2 disabled:opacity-30 cursor-pointer"><ChevronRight size={15} /></button>
                                            </div>
                                            <div className="h-[62vh] md:h-auto md:flex-1 min-h-0 flex items-center justify-center px-4 md:px-6 pb-4 md:pb-6">
                                                <div className="relative h-full max-h-full cursor-crosshair select-none" onClick={(e) => onPick(e, it.id)}>
                                                    {it.kind === "video"
                                                        ? <video src={backendUrl(it.url)} controls className="h-full w-auto max-w-full object-contain rounded-[var(--radius-xs)]" />
                                                        : <img src={backendUrl(it.url)} alt={it.label} draggable={false} className="h-full w-auto max-w-full object-contain rounded-[var(--radius-xs)] shadow-[0_8px_30px_rgba(0,0,0,0.35)]" />}
                                                    {here.filter((c) => c.round === current.round && c.x != null).map((c) => (
                                                        <span key={c.id} onMouseEnter={() => setFocus(c.id)} onMouseLeave={() => setFocus(null)} onClick={(e) => e.stopPropagation()}
                                                            style={{ left: `${c.x! * 100}%`, top: `${c.y! * 100}%` }}
                                                            className={`absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium ring-2 ring-black/30 transition-transform
                                                                ${c.resolvedAt ? "bg-surface-3 text-fg-faint" : "bg-[var(--color-brand)] text-[var(--color-brand-fg)]"} ${focus === c.id ? "scale-125" : ""}`}>
                                                            {numberOf[c.id]}
                                                        </span>
                                                    ))}
                                                    {draft?.itemId === it.id && (
                                                        <span style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%` }}
                                                            className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 border-[var(--color-brand)] bg-black/40 animate-pulse" />
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <aside className="w-full md:w-[320px] shrink-0 border-t md:border-t-0 md:border-l border-edge flex flex-col md:min-h-0">
                                            <div className="p-4">
                                                <p className="text-[13px] text-fg">{it.label}</p>
                                                <p className="text-[11px] text-fg-faint mt-0.5">
                                                    {draft ? "Escribí el comentario para el punto marcado." : "Hacé clic sobre la lámina para marcar un punto, o comentá la lámina entera."}
                                                </p>
                                                <textarea value={draftText} onChange={(e) => setDraftText(e.target.value)} rows={3} autoFocus={!!draft}
                                                    key={draft ? `${draft.x}-${draft.y}` : "libre"}
                                                    onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveDraft(it.id); }}
                                                    placeholder="Qué cambiarías…"
                                                    className="w-full mt-3 bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2.5 py-2 text-[12px] text-fg placeholder:text-fg-faint outline-none focus:border-fg/40 resize-none" />
                                                <div className="flex items-center justify-end gap-3 mt-2">
                                                    {draft && <button onClick={() => setDraft(null)} className="text-[11px] text-fg-faint hover:text-fg cursor-pointer">Quitar punto</button>}
                                                    <button disabled={busy || !draftText.trim()} onClick={() => saveDraft(it.id)}
                                                        className="h-7 px-3 flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-fg text-[var(--color-canvas)] text-[11px] font-medium cursor-pointer disabled:opacity-30">
                                                        Comentar <CornerDownLeft size={11} />
                                                    </button>
                                                </div>
                                            </div>
                                            <ol className="flex-1 overflow-y-auto px-2 pb-4 border-t border-edge pt-2">
                                                {here.length === 0 && <li className="px-2 py-3 text-[12px] text-fg-faint">Sin comentarios en esta lámina.</li>}
                                                {[...here, ...general].map((c) => (
                                                    <li key={c.id} onMouseEnter={() => setFocus(c.id)} onMouseLeave={() => setFocus(null)}
                                                        className={`group p-2.5 rounded-[var(--radius-md)] ${focus === c.id ? "bg-surface-1" : ""} ${c.resolvedAt || c.round < current.round ? "opacity-50" : ""}`}>
                                                        <div className="text-[11px] text-fg-faint flex items-center gap-1.5">
                                                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${c.resolvedAt ? "bg-surface-3" : "bg-[var(--color-brand)] text-[var(--color-brand-fg)]"}`}>{numberOf[c.id]}</span>
                                                            {client ? (c.internal ? "Coevo" : "Vos") : who(c.author)}
                                                            {!client && <span className={c.internal ? "" : "text-[var(--color-brand)]"}> · {c.internal ? "interno" : "cliente"}</span>}
                                                            {!c.itemId && " · sobre toda la pieza"}{c.round < current.round && ` · versión ${c.round}`}{c.resolvedAt && " · resuelto"}
                                                            <span className="flex-1" />
                                                            {!client && (
                                                                <button onClick={() => run(async () => { await toggleDeliveryComment(current.id, c.id); await reload(current.id); })}
                                                                    title={c.resolvedAt ? "Reabrir" : "Marcar resuelto"}
                                                                    className="opacity-0 group-hover:opacity-100 text-fg-faint hover:text-fg cursor-pointer">
                                                                    {c.resolvedAt ? <RotateCcw size={11} /> : <Check size={12} />}
                                                                </button>
                                                            )}
                                                        </div>
                                                        <p className={`text-[12px] text-fg mt-1.5 leading-relaxed ${c.resolvedAt ? "line-through decoration-fg/30" : ""}`}>{c.text}</p>
                                                    </li>
                                                ))}
                                            </ol>
                                        </aside>
                                    </div>
                                );
                            })()
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
