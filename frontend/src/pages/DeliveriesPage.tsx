import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowRight, Check, ChevronDown, ChevronLeft, ChevronRight, CornerDownLeft, Download, Eye, ExternalLink, History, Loader2, Minus, Paperclip, Pencil, Plus, RotateCcw, Trash2, Upload, X } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import { useMe } from "../lib/useMe";
import { useConfirm } from "../lib/useConfirm";
import { DeliveryGroupPicker } from "../components/workspace/DeliveryGroupPicker";
import { SlideStage } from "../components/workspace/SlideStage";
import { NewVersionDialog } from "../components/workspace/NewVersionDialog";
import { VoiceNoteButton } from "../components/workspace/VoiceNoteButton";
import {
    approvedZipUrl, backendUrl, listDeliveries, getDelivery, createDelivery, setDeliveryStatus, addDeliveryComment, addDeliveryCommentRefs, addDeliveryVoiceComment, setDeliveryPlan, addDeliveryItems, deleteDeliveryItem, deleteDeliveryComment, newDeliveryRound, setDeliveryCommentInternal,
    toggleDeliveryComment, deleteDelivery, sendDelivery, setDeliveryGroup, toggleDeliveryItem, listCampaigns, type Campaign,
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
/** La fase en el circuito (brand-integrations §3), como se dice en pantalla. */
const PHASE: Record<string, string> = {
    en_desarrollo: "En desarrollo", por_revisar: "Por revisar", lista: "Lista para publicar",
    en_postiz: "En Postiz", publicada: "Publicada", pausada: "Pausada", descartada: "Descartada",
};
/** Cómo se llama el estado según quién mira. */
/** Mes › proyecto › entregas (ordenadas por etapa). El mes sale de cuándo llegó al cliente o se subió. */
function groupByMonth(list: DeliverySummary[], client: boolean) {
    const months = new Map<string, { key: string; label: string; blocks: Map<string, { key: string; campaign: string | null; items: DeliverySummary[] }> }>();
    for (const d of list) {
        const date = new Date((client ? d.sentAt : null) ?? d.createdAt ?? Date.now());
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const label = date.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
        if (!months.has(key)) months.set(key, { key, label, blocks: new Map() });
        const bkey = d.campaignId ?? `_suelta_${d.id}`;
        const blocks = months.get(key)!.blocks;
        if (!blocks.has(bkey)) blocks.set(bkey, { key: bkey, campaign: d.campaignName, items: [] });
        blocks.get(bkey)!.items.push(d);
    }
    return [...months.values()].sort((a, b) => b.key.localeCompare(a.key)).map((m) => ({
        ...m,
        blocks: [...m.blocks.values()].map((b) => ({ ...b, items: b.items.sort((x, y) => (x.stage ?? "").localeCompare(y.stage ?? "", undefined, { numeric: true })) })),
    }));
}

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

/** Un color fijo por persona (como en Figma): sale del mail, así es siempre el mismo. Texto blanco encima. */
// Bien distintos entre sí (tono y luz), todos con texto blanco legible encima.
const PERSON_COLORS = ["#2f6fdb", "#1f8a5b", "#c4572a", "#7b4fd6", "#c23a6b", "#6b5a1f", "#334155"];
function personColor(author: string | null): string {
    const a = (author ?? "").toLowerCase();
    let h = 0;
    for (let i = 0; i < a.length; i++) h = (h * 31 + a.charCodeAt(i)) >>> 0;
    return PERSON_COLORS[h % PERSON_COLORS.length];
}
/** «hace 5 min», «hace 3 h», «ayer 18:20», «21 oct 12:48». */
function stamp(iso: string | null): string {
    if (!iso) return "";
    const d = new Date(iso), now = new Date();
    const min = Math.round((now.getTime() - d.getTime()) / 60000);
    if (min < 1) return "recién";
    if (min < 60) return `hace ${min} min`;
    if (min < 6 * 60) return `hace ${Math.round(min / 60)} h`;
    const hm = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === now.toDateString()) return `hoy ${hm}`;
    if (d.toDateString() === y.toDateString()) return `ayer ${hm}`;
    return `${d.toLocaleDateString("es-AR", { day: "numeric", month: "short" })} ${hm}`;
}

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
    const [draftRefs, setDraftRefs] = useState<File[]>([]);   // referencias para adjuntar al comentario
    const refInput = useRef<HTMLInputElement>(null);
    const [focus, setFocus] = useState<string | null>(null);
    const [slide, setSlide] = useState<number | null>(null);   // null = la pieza entera; n = una lámina grande
    const [uploadTitle, setUploadTitle] = useState("");
    const [progress, setProgress] = useState<number | null>(null);   // subida en curso (0–1)
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [upCampaign, setUpCampaign] = useState("");
    const [upStage, setUpStage] = useState("");
    const [dialog, ask] = useConfirm();
    const [asking, setAsking] = useState(false);   // cliente: «Pedir cambios» abierto en el panel de la derecha
    const [askText, setAskText] = useState("");
    // Cliente: «Elegir cuáles» muestra un círculo en cada lámina para sacar las que no van (como elegir fotos).
    const [picking, setPicking] = useState(false);
    // Zoom de la pieza entera (como en Canva): null = que entren todas; un número = alto de cada lámina en vh, con scroll.
    // Sin elegir (undefined): hasta 4 láminas entran todas; con más, arranca a un tamaño que se ve, con scroll.
    const [zoomSet, setZoom] = useState<number | null | undefined>(undefined);
    // Proyectos plegables en la lista: lo que elige la persona; si no eligió, abierto si tiene pocas
    // entregas (≤ 3) o la que está abierta.
    const [fold, setFold] = useState<Record<string, boolean>>({});
    // Zoom de la lámina grande: 1 = entra entera; más, se recorre con scroll.
    const [slideZoom, setSlideZoom] = useState(1);
    const [tab, setTab] = useState<"revisar" | "aprobadas">("revisar");   // sólo cliente
    const fileRef = useRef<HTMLInputElement>(null);
    const addRef = useRef<HTMLInputElement>(null);   // «Sumar láminas» a la entrega abierta
    const [versionOpen, setVersionOpen] = useState(false); // «Nueva versión»: panel con láminas + qué cambiaron
    const [versionItem, setVersionItem] = useState<string | null>(null); // la lámina a reemplazar sola (null = todas)
    const [showPrev, setShowPrev] = useState(false);
    // Equipo: el comentario nuevo lo ve el cliente o queda entre el equipo. Por defecto: si la entrega ya se mandó, lo ve.
    const [forClient, setForClient] = useState<boolean | null>(null);
    // Una lámina de una versión anterior, abierta desde un comentario viejo.
    const [oldSlide, setOldSlide] = useState<{ itemId: string; url: string; kind: string; round: number; n: number } | null>(null);
    const [commentsInView, setCommentsInView] = useState(false);
    const brandRef = useRef(brandId);

    const refreshList = useCallback(async () => {
        if (!brandId) return;
        try { setList(await listDeliveries(brandId, vista)); } catch (e) { setError((e as Error).message); }
    }, [brandId, vista]);
    useEffect(() => { setList([]); refreshList(); }, [refreshList]);
    useEffect(() => {
        if (client || !brandId) return;
        let alive = true;
        listCampaigns(brandId).then((c) => alive && setCampaigns(c)).catch(() => {});
        return () => { alive = false; };
    }, [client, brandId]);

    const open = useCallback((id: string | null) => {
        setDraft(null); setDraftText(""); setSlide(null); setAsking(false); setAskText(""); setPicking(false); setZoom(undefined); setSlideZoom(1); setShowPrev(false); setOldSlide(null); setVersionItem(null); setDraftRefs([]);
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
    const sameAuthor = (a: string | null) => !!me.email && (a ?? "").toLowerCase() === me.email.toLowerCase();
    // El equipo borra cualquiera; el cliente, sólo los que escribió él.
    const canDeleteComment = (c: { internal: boolean; author: string | null }) =>
        !client || (!c.internal && !!me.email && (c.author ?? "").toLowerCase() === me.email.toLowerCase());
    const removeComment = async (commentId: string) => {
        if (!current || !(await ask({ title: "¿Borrar este comentario?", body: "Se borra también su punto en la imagen.", confirm: "Borrar", danger: true }))) return;
        run(async () => { await deleteDeliveryComment(current.id, commentId); await reload(current.id); });
    };
    const shown = client ? list.filter((d) => (tab === "aprobadas") === (d.status === "aprobada")) : list;
    // Agrupado: mes (de la fecha) › proyecto (si tiene) › entregas, por etapa.
    const groups = groupByMonth(shown, client);
    const usedStages = [...new Set(list.map((d) => d.stage).filter((s): s is string => !!s))];

    const comments = useMemo(() => {
        if (!current) return [];
        return [...current.comments].sort((a, b) =>
            Number(!!a.resolvedAt) - Number(!!b.resolvedAt) || (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
    }, [current]);
    const numberOf = useMemo(() => Object.fromEntries(comments.map((c, i) => [c.id, i + 1])), [comments]);
    const total = current?.items.length ?? 0;
    const zoom = zoomSet === undefined ? (total > 4 ? 46 : null) : zoomSet;

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
    // Una versión nueva puede tener menos láminas: si la abierta ya no existe, ir a la última.
    useEffect(() => {
        if (slide !== null && slide >= total) setSlide(total ? total - 1 : null);
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
            const visible = client || (forClient ?? current.visibility === "cliente");
            const c = await addDeliveryComment(current.id, { text: draftText, itemId, x: d?.x ?? null, y: d?.y ?? null, asClient: visible });
            if (draftRefs.length) await addDeliveryCommentRefs(current.id, c.id, draftRefs);
            setDraft(null); setDraftText(""); setDraftRefs([]);
            await reload(current.id);
        });
    };
    const saveVoice = (itemId: string, audio: Blob) => {
        if (!current) return;
        const d = draft?.itemId === itemId ? draft : null;
        const visible = client || (forClient ?? current.visibility === "cliente");
        return run(async () => {
            await addDeliveryVoiceComment(current.id, audio, { itemId, x: d?.x ?? null, y: d?.y ?? null, asClient: visible });
            setDraft(null);
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
            setProgress(0);
            const d = await createDelivery(brandId, title, slides, source, setProgress, { campaignId: upCampaign || null, stage: upStage.trim() || null }).finally(() => setProgress(null));
            setUploadTitle("");
            await refreshList(); open(d.id);
        });
    };

    return (
        <div className="h-full flex min-h-0">
            {dialog}
            {oldSlide && current && (
                <div className="fixed inset-0 z-[80] flex flex-col bg-black/85" role="dialog" aria-label={`Versión ${oldSlide.round}`} onClick={() => setOldSlide(null)}>
                    <div className="h-12 shrink-0 flex items-center gap-3 px-4 text-white text-[13px]">
                        <span className="px-2 py-0.5 rounded-[3px] bg-white/15">Versión {oldSlide.round} · anterior</span>
                        <span className="text-white/70">Lámina {String(oldSlide.n).padStart(2, "0")}</span>
                        <span className="flex-1" />
                        <button onClick={() => setOldSlide(null)} aria-label="Cerrar" className="w-8 h-8 flex items-center justify-center cursor-pointer"><X size={16} /></button>
                    </div>
                    <div className="flex-1 min-h-0 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
                        <span className="relative inline-block max-h-full">
                            <img src={backendUrl(oldSlide.url)} alt="" className="block max-h-[calc(100vh-6rem)] max-w-full w-auto rounded-[var(--radius-xs)]" />
                            {current.comments.filter((c) => c.itemId === oldSlide.itemId && c.x != null).map((c) => (
                                <span key={c.id} title={c.text} style={{ left: `${c.x! * 100}%`, top: `${c.y! * 100}%`, background: personColor(c.author) }}
                                    className="group/pin absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[11px] text-white ring-2 ring-white/70">
                                    {numberOf[c.id]}
                                    <span className="pointer-events-none absolute left-1/2 top-full mt-1.5 -translate-x-1/2 w-max max-w-[240px] px-2 py-1 rounded-[3px] bg-black/85 text-white text-[11px] leading-snug whitespace-normal opacity-0 group-hover/pin:opacity-100">{c.text}</span>
                                </span>
                            ))}
                        </span>
                    </div>
                </div>
            )}
            {/* ── Lista ── */}
            {/* Celular: o la lista o la entrega abierta. Escritorio: las dos. */}
            <aside className={`${selectedId ? "hidden md:flex" : "flex"} w-full md:w-[280px] shrink-0 md:border-r border-edge flex-col min-h-0`}>
                <div className="px-5 pt-6 pb-4 space-y-3">
                    <div className="flex items-baseline gap-2">
                        <h1 className="text-[15px] font-medium text-fg">{client ? (tab === "revisar" ? "Para revisar" : "Aprobadas") : "Entregas"}</h1>
                        <span className={`${mono} text-fg-faint`}>{shown.length}</span>
                        <span className="flex-1" />
                        {client && tab === "aprobadas" && shown.length > 0 && (
                            <a href={approvedZipUrl(activeBrand.id)} download title="Todo lo aprobado, en un zip, ordenado por proyecto y etapa"
                                className="flex items-center gap-1 text-[12px] text-fg-muted hover:text-fg no-underline"><Download size={12} /> Bajar todo</a>
                        )}
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
                                {progress !== null ? <><Loader2 size={13} className="animate-spin" /> {Math.round(progress * 100)}%</> : <><Upload size={13} /> Subir</>}
                            </button>
                            <input ref={fileRef} type="file" multiple hidden accept="image/*,video/*,.html,.htm"
                                onChange={(e) => { onUpload(e.target.files); e.target.value = ""; }} />
                        </div>
                    )}
                    {!client && brandId && (
                        <DeliveryGroupPicker variant="upload" brandId={brandId} campaigns={campaigns} onCampaigns={setCampaigns} ask={ask} onError={setError}
                            campaignId={upCampaign || null} stage={upStage || null} usedStages={usedStages}
                            onChange={(g) => { setUpCampaign(g.campaignId ?? ""); setUpStage(g.stage ?? ""); }} />
                    )}
                    {progress !== null && (
                        <div className="flex flex-col gap-1.5">
                            <div className="h-[3px] rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                                <div className="h-full bg-fg transition-[width] duration-200" style={{ width: `${Math.max(3, progress * 100)}%` }} />
                            </div>
                            <p className="text-[11px] text-fg-faint">{progress < 1 ? `Subiendo… ${Math.round(progress * 100)}%` : "Procesando…"}</p>
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
                    {groups.map((m) => (
                        <div key={m.key} className="mb-3">
                            <p className={`${mono} text-fg-faint px-2.5 pt-3 pb-1.5`}>{m.label}</p>
                            {m.blocks.map((b) => {
                                const fk = `${m.key}:${b.key}`;
                                const isOpen = !b.campaign || (fold[fk] ?? (b.items.length <= 3 || b.items.some((d) => d.id === selectedId)));
                                const ok = b.items.filter((d) => d.status === "aprobada").length;
                                const changes = b.items.filter((d) => d.status === "cambios").length;
                                const waitingN = b.items.filter((d) => d.status === "en_revision" && (client || d.visibility === "cliente")).length;
                                return (
                                <div key={b.key} className={b.campaign ? "group/p mb-1 ml-1 pl-2 border-l border-edge" : ""}>
                                    {b.campaign && (
                                        <div className="flex items-center">
                                        <button onClick={() => setFold((f) => ({ ...f, [fk]: !isOpen }))} aria-expanded={isOpen}
                                            className="flex-1 min-w-0 flex items-center gap-1.5 px-1.5 pt-1.5 pb-1.5 rounded-[var(--radius-sm)] text-left cursor-pointer hover:bg-surface-1">
                                            {isOpen ? <ChevronDown size={12} className="text-fg-faint shrink-0" /> : <ChevronRight size={12} className="text-fg-faint shrink-0" />}
                                            <span className="flex-1 min-w-0 text-[12px] text-fg truncate">{b.campaign}</span>
                                            <span className="shrink-0 text-[11px] text-fg-faint tabular-nums" title={`${b.items.length} piezas · ${ok} aprobadas${changes ? ` · ${changes} con cambios` : ""}${waitingN ? ` · ${waitingN} esperando` : ""}`}>
                                                {b.items.length}
                                                {ok > 0 && <span className="text-[var(--color-success)]"> · {ok}✓</span>}
                                                {changes > 0 && <span className="text-[var(--color-brand)]"> · {changes}</span>}
                                            </span>
                                        </button>
                                        {ok > 0 && (
                                            <a href={approvedZipUrl(activeBrand.id, { proyecto: b.key })} download title={`Bajar lo aprobado de «${b.campaign}» (zip)`} aria-label="Bajar lo aprobado del proyecto"
                                                className="shrink-0 w-6 h-6 flex items-center justify-center rounded-[var(--radius-sm)] text-fg-faint hover:text-fg hover:bg-surface-2 md:opacity-0 md:group-hover/p:opacity-100 focus:opacity-100">
                                                <Download size={12} />
                                            </a>
                                        )}
                                        </div>
                                    )}
                                    {isOpen && b.items.map((d) => (
                                        <button key={d.id} onClick={() => open(d.id)}
                                            className={`w-full flex gap-3 items-center p-2 rounded-[var(--radius-md)] text-left cursor-pointer transition-colors ${d.id === selectedId ? "bg-surface-2" : "hover:bg-surface-1"}`}>
                                            <div className="w-9 h-11 shrink-0 rounded-[var(--radius-xs)] bg-surface-2 overflow-hidden">
                                                {d.cover && <img src={backendUrl(d.cover)} alt="" className="w-full h-full object-cover" />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[13px] text-fg truncate">{d.stage ? <span className="text-fg-muted">{d.stage} · </span> : null}{d.title}</p>
                                                <p className={`${mono} text-fg-faint mt-1 flex items-center gap-1.5`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${d.visibility === "interna" && !client ? "bg-[var(--color-edge-strong)]" : DOT[d.status]}`} />
                                                    {stateLabel(d, mode)}
                                                    {d.status === "aprobada" && d.approvedItems != null && d.approvedItems < d.items && <span>· {d.approvedItems} de {d.items}</span>}
                                                    {d.openComments > 0 && <span className="text-fg-muted">· {d.openComments}</span>}
                                                </p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                );
                            })}
                        </div>
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
                                <h2 className="text-[15px] font-medium text-fg truncate">
                                    {(current.campaignName || current.stage) && <span className="text-fg-muted font-normal">{[current.campaignName, current.stage].filter(Boolean).join(" · ")} · </span>}
                                    {client ? current.title : (
                                        <button title="Cambiarle el nombre" className="group/t inline-flex items-center gap-1.5 cursor-pointer"
                                            onClick={async () => {
                                                const t = await ask({ title: "Nombre de la entrega", input: "Nombre", placeholder: current.title, confirm: "Guardar" });
                                                if (typeof t === "string") run(async () => { setCurrent(await setDeliveryGroup(current.id, { campaignId: current.campaignId, stage: current.stage, title: t })); await refreshList(); });
                                            }}>
                                            {current.title} <Pencil size={11} className="text-fg-faint opacity-0 group-hover/t:opacity-100" />
                                        </button>
                                    )}
                                </h2>
                                {!client && (
                                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-fg-muted">
                                        <span className="font-mono uppercase tracking-[0.06em] text-[10px]">{PHASE[current.phase ?? ""] ?? "—"}</span>
                                        <span className="text-fg-faint">·</span>
                                        <button className="cursor-pointer hover:text-fg" title="El ángulo de la estrategia al que responde"
                                            onClick={async () => {
                                                const a = await ask({ title: "Ángulo de la estrategia", input: "Ángulo", placeholder: current.angle ?? "ej. A · Institucional", confirm: "Guardar" });
                                                if (typeof a === "string") run(async () => { setCurrent(await setDeliveryPlan(current.id, { angle: a })); await refreshList(); });
                                            }}>
                                            {current.angle ? `Ángulo: ${current.angle}` : "Sin ángulo"}
                                        </button>
                                        {current.scheduledAt && <><span className="text-fg-faint">·</span><span className="tabular-nums">prevista {new Date(current.scheduledAt).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></>}
                                    </p>
                                )}
                                {current.round > 1 && (
                                    <p className="mt-1.5 flex flex-wrap items-center gap-2">
                                        <span className="h-6 px-2 inline-flex items-center rounded-[3px] bg-fg text-[var(--color-canvas)] text-[11px] font-medium">
                                            Versión {current.round}{current.status === "en_revision" ? " · nueva" : ""}
                                        </span>
                                        {(current.history?.length ?? 0) > 0 && (
                                            <button onClick={() => { setSlide(null); setShowPrev((v) => !v); }}
                                                className={`h-6 px-2 inline-flex items-center gap-1 rounded-[3px] border text-[11px] cursor-pointer ${showPrev ? "border-fg text-fg" : "border-edge text-fg-muted hover:text-fg"}`}>
                                                <History size={11} /> {showPrev ? "Ocultar la versión anterior" : "Ver la versión anterior"}
                                            </button>
                                        )}
                                    </p>
                                )}
                                {current.round > 1 && current.note && (
                                    <p className="mt-2 max-w-[640px] text-[13px] leading-snug text-fg">
                                        <span className="text-fg-muted">Qué cambiamos: </span>{current.note}
                                    </p>
                                )}
                                {(() => {
                                    // Cambió sólo una parte: decir cuáles, y que se pueda ir directo a cada una.
                                    const changed = current.items.map((x, i) => ({ x, i })).filter(({ x }) => x.changed === current.round);
                                    if (current.round < 2 || !changed.length || changed.length === total) return null;
                                    return (
                                        <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-fg-muted">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)]" />
                                            {changed.length === 1 ? "Cambió la lámina" : "Cambiaron las láminas"}
                                            {changed.map(({ i }) => (
                                                <button key={i} onClick={() => { setSlide(i); setDraft(null); }}
                                                    className="h-5 px-1.5 rounded-[3px] border border-[var(--color-brand)] text-fg tabular-nums cursor-pointer hover:bg-[var(--color-surface-2)]">
                                                    {String(i + 1).padStart(2, "0")}
                                                </button>
                                            ))}
                                            <span className="text-fg-faint">· las demás quedaron igual</span>
                                        </p>
                                    );
                                })()}
                                <p className="text-[11px] text-fg-faint mt-0.5 flex items-center gap-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full ${current.visibility === "interna" && !client ? "bg-[var(--color-edge-strong)]" : DOT[current.status]}`} />
                                    {stateLabel(current, mode)}
                                    {client
                                        ? <> · llegó el {when(current.sentAt ?? current.createdAt)}</>
                                        : <>{" "}· subida por {who(current.createdBy)} el {when(current.createdAt)}{current.sentAt && <> · mandada el {when(current.sentAt)}</>}</>}
                                    {current.approvedBy && <> · aprobó {who(current.approvedBy)}</>}
                                    {current.status === "aprobada" && current.items.some((x) => x.rejected) && <> · {current.items.filter((x) => !x.rejected).length} de {current.items.length} láminas</>}
                                </p>
                                {!client && (
                                    <div className="mt-2.5">
                                        <DeliveryGroupPicker brandId={current.brandId} campaigns={campaigns} onCampaigns={setCampaigns} ask={ask} onError={setError} disabled={busy}
                                            campaignId={current.campaignId} stage={current.stage} usedStages={usedStages}
                                            onChange={(g) => run(async () => { setCurrent(await setDeliveryGroup(current.id, g)); await refreshList(); })} />
                                    </div>
                                )}
                            </div>
                            <span className="hidden md:block flex-1" />
                            <div className="w-full md:w-auto flex flex-wrap items-center gap-2 [&>button]:flex-1 md:[&>button]:flex-none [&>button]:whitespace-nowrap [&>button]:justify-center">
                            {current.status === "aprobada" && (
                                <a href={approvedZipUrl(current.brandId, { entrega: current.id })} download title="Las piezas aprobadas en su calidad original, en un zip"
                                    className="h-8 px-3 flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-edge text-[12px] text-fg hover:border-fg no-underline">
                                    <Download size={12} /> Descargar
                                </a>
                            )}
                            {!client && current.source && (
                                <a href={backendUrl(current.source.url)} target="_blank" rel="noreferrer" title="El archivo editable de la pieza"
                                    className="flex items-center gap-1 text-[12px] text-fg-faint hover:text-fg">Fuente <ExternalLink size={11} /></a>
                            )}
                            {client ? (
                                <>
                                    {/* Se escribe en el panel de la derecha, mirando la pieza (no en un cartel encima). */}
                                    <button disabled={busy || asking} onClick={() => { setSlide(null); setDraft(null); setAsking(true); }}
                                        className="h-8 px-3 flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-edge text-[12px] text-fg-muted hover:text-fg cursor-pointer disabled:opacity-50">
                                        <RotateCcw size={12} /> {current.status === "cambios" ? "Pedir algo más" : "Pedir cambios"}
                                    </button>
                                    {current.status === "aprobada" && mayApprove && (
                                        <button disabled={busy} title="Volver a abrirla para cambiar qué láminas van"
                                            onClick={() => run(async () => { await setDeliveryStatus(current.id, "en_revision"); await reload(current.id); setPicking(total > 1); })}
                                            className="h-8 px-3 flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-edge text-[12px] text-fg-muted hover:text-fg cursor-pointer disabled:opacity-50">
                                            <RotateCcw size={12} /> Cambiar mi elección
                                        </button>
                                    )}
                                    {current.status !== "aprobada" && mayApprove && total > 1 && (
                                        <button disabled={busy} onClick={() => { setSlide(null); setPicking((p) => !p); }}
                                            className={`h-8 px-3 flex items-center gap-1.5 rounded-[var(--radius-sm)] border text-[12px] cursor-pointer disabled:opacity-50 ${picking ? "border-fg text-fg" : "border-edge text-fg-muted hover:text-fg"}`}>
                                            {picking ? "Listo" : "Elegir cuáles"}
                                        </button>
                                    )}
                                    {current.status !== "aprobada" && mayApprove && (
                                        <button disabled={busy} onClick={() => run(async () => { await setDeliveryStatus(current.id, "aprobada"); setPicking(false); await reload(current.id); })}
                                            className="h-8 px-3 flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-fg text-[var(--color-canvas)] text-[12px] font-medium cursor-pointer disabled:opacity-50">
                                            <Check size={12} /> {(() => { const k = current.items.filter((x) => !x.rejected).length; return k < current.items.length ? `Aprobar ${k} de ${current.items.length}` : current.items.length > 1 ? "Aprobar todo" : "Aprobar"; })()}
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
                                        onClick={async () => { if (await ask({ title: `¿Mandar «${current.title}» al cliente?`, body: "Desde ahora la ve en su espacio, sin los comentarios internos.", confirm: "Mandar" })) run(async () => { await sendDelivery(current.id); await reload(current.id); }); }}
                                        className="h-8 px-3 flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-fg text-[var(--color-canvas)] text-[12px] font-medium cursor-pointer disabled:opacity-50">
                                        Mandar al cliente <ArrowRight size={12} />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Link to={`/cliente/entregas?id=${current.id}`} className="flex items-center gap-1 text-[12px] text-fg-faint hover:text-fg no-underline"><Eye size={12} /> Como la ve el cliente</Link>
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
                                <button disabled={busy} onClick={() => { setVersionItem(null); setVersionOpen(true); }}
                                    title="Reemplaza TODAS las láminas. Para corregir una sola, usá el botón de subir sobre esa lámina"
                                    className="h-8 px-3 flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-edge text-[12px] text-fg-muted hover:text-fg cursor-pointer disabled:opacity-50">
                                    {progress !== null ? <><Loader2 size={12} className="animate-spin" /> {Math.round(progress * 100)}%</> : <><Upload size={12} /> Nueva versión de todo</>}
                                </button>
                            )}
                            {!client && versionOpen && (
                                <NewVersionDialog round={current.round + 1} progress={progress} onClose={() => { setVersionOpen(false); setVersionItem(null); }}
                                    lamina={versionItem ? String(current.items.findIndex((x) => x.id === versionItem) + 1).padStart(2, "0") : undefined}
                                    onSubmit={async (fs, note) => {
                                        setProgress(0);
                                        let d;
                                        try { d = await newDeliveryRound(current.id, fs, note, setProgress, versionItem ? [versionItem] : undefined); } finally { setProgress(null); }
                                        setVersionOpen(false); setVersionItem(null);
                                        setCurrent(d); await refreshList();
                                        if (await ask({ title: `¿Mandar la versión ${d.round} al cliente?`, body: "Le llega a revisar, con lo que cambiaron. Si preferís revisarla antes, después usás «Mandar al cliente».", confirm: "Mandar", cancel: "Después" })) {
                                            run(async () => { await sendDelivery(d.id); await reload(d.id); });
                                        }
                                    }} />
                            )}
                            {!client && (
                                <>
                                    <input ref={addRef} type="file" multiple hidden accept="image/*,video/*"
                                        onChange={(e) => {
                                            const fs = Array.from(e.target.files || []).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
                                            e.target.value = "";
                                            if (fs.length) run(async () => { setProgress(0); try { setCurrent(await addDeliveryItems(current.id, fs, setProgress)); await refreshList(); } finally { setProgress(null); } });
                                        }} />
                                </>
                            )}
                            {!client && (
                                <button disabled={busy} title="Borra la entrega entera: todas sus láminas, versiones y comentarios"
                                    onClick={async () => { if (await ask({ title: `¿Borrar la entrega entera «${current.title}»?`, body: `Se borran sus ${total} ${total === 1 ? "lámina" : "láminas"}${current.round > 1 ? `, sus ${current.round} versiones` : ""} y todos los comentarios. El proyecto no se toca. No se puede deshacer. (Para sacar una sola imagen, usá el tachito que aparece sobre esa lámina.)`, confirm: "Borrar la entrega", danger: true })) run(async () => { await deleteDelivery(current.id); open(null); await refreshList(); }); }}
                                    className="h-8 px-2.5 flex items-center gap-1.5 text-[12px] text-fg-faint hover:text-[var(--color-error)] cursor-pointer">
                                    <Trash2 size={12} /> Borrar entrega
                                </button>
                            )}
                            </div>
                        </header>

                        {slide === null ? (
                            /* ── Vista 1: la pieza entera, como en el canvas, + lo que pidieron ── */
                            <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
                            <div className="md:flex-1 min-w-0 md:overflow-auto bg-[var(--color-canvas)] flex flex-col">
                                {showPrev && current.history?.length ? (() => {
                                    const prev = current.history[current.history.length - 1];
                                    // Si sólo cambiaron algunas láminas, se comparan esas (con su número de siempre).
                                    const replaced = new Set(current.items.filter((x) => x.changed === current.round && x.prev).map((x) => x.prev!));
                                    const before = prev.items.map((it, i) => ({ it, i })).filter(({ it }) => !replaced.size || replaced.has(it.id));
                                    return (
                                        <div className="px-4 md:px-6 pt-5 pb-4 border-b border-edge bg-[var(--color-surface-1)]">
                                            <p className="text-[11px] text-fg-faint mb-2.5">Versión {prev.round} · antes{prev.note ? ` · ${prev.note}` : ""}</p>
                                            <div className="flex gap-2.5 overflow-x-auto">
                                                {before.map(({ it, i }) => (
                                                    <figure key={it.id} className="shrink-0">
                                                        {it.kind === "video"
                                                            ? <video src={backendUrl(it.preview || it.url)} poster={it.poster ? backendUrl(it.poster) : undefined} muted controls className="h-[26vh] w-auto rounded-[var(--radius-xs)] opacity-80" />
                                                            : <img src={backendUrl(it.url)} alt="" className="h-[26vh] w-auto rounded-[var(--radius-xs)] opacity-80" />}
                                                        <figcaption className="text-[10px] text-fg-faint mt-1">{String(i + 1).padStart(2, "0")}</figcaption>
                                                    </figure>
                                                ))}
                                            </div>
                                            <p className="text-[11px] text-fg-muted mt-2.5">Abajo, la versión {current.round}: la nueva{replaced.size ? ` (las demás láminas no cambiaron)` : ""}.</p>
                                        </div>
                                    );
                                })() : null}
                                {client && <p className="md:hidden px-4 pt-4 text-[12px] text-fg-muted">Tocá una lámina para verla grande y marcar algo puntual.</p>}
                                <div className="md:flex-1 flex items-center justify-center py-5 md:px-6 md:py-8">
                                    {/* Celular: láminas que se deslizan. Escritorio: todas en una fila. */}
                                    {/* Cada pieza usa el lugar que hay: alto hasta ~2/3 de la pantalla, ancho repartido. */}
                                    <div className={`w-full flex gap-3 ${total > 3 ? "md:gap-2.5" : "md:gap-5"} items-center overflow-x-auto snap-x px-4 ${zoom ? "md:justify-start md:pb-3" : "md:justify-center md:overflow-visible md:px-0"}`}>
                                        {(() => { const changed = current.items.filter((x) => x.changed === current.round).length; return current.items.map((it, i) => ({ it, i })).sort((a, b) => Number(!!b.it.rejected) - Number(!!a.it.rejected)).map(({ it, i }, k, arr) => {
                                            const pins = comments.filter((c) => c.itemId === it.id && c.round === current.round && c.x != null && !c.resolvedAt);
                                            // El círculo: el cliente eligiendo, o una lámina que ya sacó (el equipo la ve marcada).
                                            const canPick = client && current.status !== "aprobada" && total > 1;
                                            const showPick = (canPick && (picking || it.rejected)) || (!client && it.rejected);
                                            return (
                                                <div key={it.id}
                                                    className={`group text-left shrink-0 snap-center md:w-auto transition-all duration-300 ${it.rejected ? "w-[34vw] max-w-[150px] md:flex-none" : `w-[78vw] max-w-[360px] ${zoom ? "md:max-w-none md:flex-none" : "md:max-w-fit md:shrink md:flex-[1_1_0] md:min-w-0"}`} ${it.rejected && !arr[k + 1]?.it.rejected && k + 1 < arr.length ? "mr-3 md:mr-6 pr-3 md:pr-6 border-r border-dashed border-edge" : ""}`}>
                                                    <span className="relative block md:inline-block md:max-w-full">
                                                    <button onClick={() => { if (picking && canPick) run(async () => { setCurrent(await toggleDeliveryItem(current.id, it.id, vista)); await refreshList(); }); else { setSlide(i); setDraft(null); } }}
                                                        aria-label={picking && canPick ? (it.rejected ? "Volver a sumarla" : "Sacarla") : "Abrir para comentar"}
                                                        className={`relative block md:inline-block md:max-w-full transition-opacity ${picking && canPick ? "cursor-pointer" : "cursor-zoom-in"} ${it.rejected ? "opacity-35" : ""}`}>
                                                        {it.kind === "video"
                                                            ? <span className="relative block">
                                                                <video src={backendUrl(it.preview || it.url)} poster={it.poster ? backendUrl(it.poster) : undefined} muted preload="none" style={it.rejected ? { maxHeight: "24vh" } : zoom ? ({ "--z": `${zoom}vh` } as React.CSSProperties) : undefined} className={`block w-full md:w-auto md:max-w-full h-auto max-h-[66vh] ${zoom ? "md:max-h-[var(--z)]" : ""} rounded-[var(--radius-xs)] bg-surface-1 shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition-transform group-hover:-translate-y-0.5`} />
                                                                <span className="absolute left-2 bottom-2 px-1.5 py-0.5 rounded-[2px] bg-black/60 text-white font-mono text-[9px] uppercase tracking-[0.08em]">Video ▶</span>
                                                            </span>
                                                            : <img src={backendUrl(it.url)} alt={it.label} draggable={false} style={it.rejected ? { maxHeight: "24vh" } : zoom ? ({ "--z": `${zoom}vh` } as React.CSSProperties) : undefined} className={`block w-full md:w-auto md:max-w-full h-auto max-h-[66vh] ${zoom ? "md:max-h-[var(--z)]" : ""} rounded-[var(--radius-xs)] bg-surface-1 shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition-transform group-hover:-translate-y-0.5`} />}
                                                        {it.changed === current.round && current.round > 1 && changed < total && (
                                                            <>
                                                                <span aria-hidden className="lamina-nueva pointer-events-none absolute inset-0 rounded-[var(--radius-xs)] ring-2 ring-[var(--color-brand)]" />
                                                                <span className="absolute left-2.5 bottom-2.5 px-2 py-0.5 rounded-full bg-[var(--color-brand)] text-white text-[11px] font-medium shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
                                                                    Nueva · versión {current.round}
                                                                </span>
                                                            </>
                                                        )}
                                                        {pins.map((c) => (
                                                            <span key={c.id} style={{ left: `${c.x! * 100}%`, top: `${c.y! * 100}%`, background: personColor(c.author) }}
                                                                className="group/pin absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 hover:scale-125 transition-transform rounded-full flex items-center justify-center text-[9px] font-medium text-white ring-2 ring-white/70 z-10">
                                                                {numberOf[c.id]}
                                                                <span className="pointer-events-none absolute left-1/2 top-full mt-1.5 -translate-x-1/2 w-max max-w-[220px] px-2 py-1 rounded-[3px] bg-black/85 text-white text-[11px] font-normal leading-snug text-left whitespace-normal opacity-0 group-hover/pin:opacity-100 transition-opacity">{c.text}</span>
                                                            </span>
                                                        ))}
                                                    </button>
                                                    {!client && !it.rejected && (
                                                        <button disabled={busy} title="Nueva versión de esta lámina: las demás quedan como están" aria-label={`Nueva versión de la lámina ${i + 1}`}
                                                            onClick={() => { setVersionItem(it.id); setVersionOpen(true); }}
                                                            className={`absolute top-2.5 ${total > 1 ? "left-11" : "left-2.5"} w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer`}>
                                                            <Upload size={12} />
                                                        </button>
                                                    )}
                                                    {!client && total > 1 && (
                                                        <button disabled={busy} title="Sacar sólo esta lámina (la entrega sigue con las demás)" aria-label={`Sacar la lámina ${i + 1}`}
                                                            onClick={async () => { if (await ask({ title: `¿Sacar sólo la lámina ${String(i + 1).padStart(2, "0")}?`, body: `La entrega sigue con las otras ${total - 1} ${total - 1 === 1 ? "lámina" : "láminas"}. Sus comentarios quedan en el historial.`, confirm: "Sacar esta lámina", danger: true })) run(async () => { setCurrent(await deleteDeliveryItem(current.id, it.id)); await refreshList(); }); }}
                                                            className="absolute top-2.5 left-2.5 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer">
                                                            <Trash2 size={12} />
                                                        </button>
                                                    )}
                                                    {showPick && (
                                                        <button disabled={busy || !canPick} aria-pressed={!it.rejected}
                                                            aria-label={it.rejected ? `Volver a sumar la lámina ${i + 1}` : `Sacar la lámina ${i + 1}`}
                                                            onClick={() => run(async () => { setCurrent(await toggleDeliveryItem(current.id, it.id, vista)); await refreshList(); })}
                                                            className={`absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center ring-1 shadow-[0_2px_8px_rgba(0,0,0,0.35)] cursor-pointer disabled:cursor-default transition-colors ${it.rejected ? "bg-black/35 ring-white/80 text-transparent" : "bg-white ring-white text-black"}`}>
                                                            <Check size={14} strokeWidth={2.5} />
                                                        </button>
                                                    )}
                                                    </span>
                                                    <p className="text-[11px] text-fg-faint mt-2 flex items-center gap-1.5">
                                                        <span className="tabular-nums">{String(i + 1).padStart(2, "0")}</span> {it.label !== String(i + 1).padStart(2, "0") && it.label}
                                                        {pins.length > 0 && <span className="text-[var(--color-brand)]">· {pins.length}</span>}
                                                        {it.rejected && <span className="text-fg-muted">· {client ? "no va" : "el cliente la sacó"}</span>}
                                                    </p>
                                                </div>
                                            );
                                        }); })()}
                                        {!client && (
                                            <button disabled={busy} onClick={() => addRef.current?.click()} title="Sumar otra lámina a esta misma versión. Para una corrección, usá «Nueva versión»"
                                                className="shrink-0 self-stretch w-[110px] md:w-[130px] min-h-[180px] rounded-[var(--radius-xs)] border border-dashed border-[var(--color-edge-strong)] flex flex-col items-center justify-center gap-1.5 text-[12px] text-fg-muted hover:text-fg hover:border-fg cursor-pointer disabled:opacity-50">
                                                {progress !== null ? <><Loader2 size={15} className="animate-spin" /> {Math.round(progress * 100)}%</> : <><Plus size={15} /> Sumar lámina</>}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <footer className="px-6 py-3 border-t border-edge bg-surface-0 flex items-center gap-4">
                                    <p className={`text-[12px] shrink-0 ${picking ? "text-fg" : "text-fg-faint"}`}>
                                        {picking ? `Tocá las que no van · quedan ${current.items.filter((x) => !x.rejected).length} de ${total}`
                                        : comments.filter((c) => !c.resolvedAt).length
                                            ? `${comments.filter((c) => !c.resolvedAt).length === 1 ? "1 comentario abierto" : `${comments.filter((c) => !c.resolvedAt).length} comentarios abiertos`} · tocá una lámina para verla y comentar`
                                            : "Clic en una lámina para verla grande y comentar sobre ella."}
                                    </p>
                                    {current.note && current.round <= 1 && <p className="text-[12px] text-fg-muted truncate" title={current.note}>{current.note}</p>}
                                    <span className="flex-1" />
                                    <div className="hidden md:flex items-center gap-1 text-[12px] text-fg-muted shrink-0" aria-label="Zoom">
                                        <button onClick={() => setZoom((z) => Math.max(20, (z ?? 66) - 12))} aria-label="Achicar" className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-2 hover:text-fg cursor-pointer"><Minus size={13} /></button>
                                        <button onClick={() => setZoom(null)} title="Que entren todas" className={`h-7 px-2 rounded-[3px] cursor-pointer ${zoom ? "hover:text-fg" : "text-fg"}`}>{zoom ? `${Math.round((zoom / 66) * 100)}%` : "Ajustar"}</button>
                                        <button onClick={() => setZoom((z) => Math.min(84, (z ?? 54) + 12))} aria-label="Agrandar" className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-2 hover:text-fg cursor-pointer"><Plus size={13} /></button>
                                    </div>
                                </footer>
                            </div>
                            {comments.some((c) => !c.resolvedAt) && !asking && !commentsInView && (
                                <button onClick={() => document.getElementById("lo-que-pidieron")?.scrollIntoView({ behavior: "smooth" })}
                                    className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-30 h-10 px-4 rounded-full bg-fg text-[var(--color-canvas)] text-[13px] shadow-[0_6px_20px_rgba(0,0,0,0.3)] cursor-pointer">
                                    {comments.filter((c) => !c.resolvedAt).length} {comments.filter((c) => !c.resolvedAt).length === 1 ? "comentario" : "comentarios"} ↓
                                </button>
                            )}
                            {(() => {
                                // Lo que pidieron, sin entrar a cada lámina: abiertos, primero los del cliente.
                                const pending = comments.filter((c) => !c.resolvedAt);
                                if (!pending.length && !asking) return null;
                                const idx = Object.fromEntries(current.items.map((it, i) => [it.id, i]));
                                // Las láminas de las versiones anteriores, para que un comentario viejo no pierda a qué se refería.
                                const older: Record<string, { url: string; kind: string; round: number; n: number }> = {};
                                for (const h of current.history ?? []) h.items.forEach((x, k) => { older[x.id] = { url: x.poster || x.url, kind: x.kind, round: h.round, n: k + 1 }; });
                                const sendAsk = () => run(async () => {
                                    await addDeliveryComment(current.id, { text: askText.trim(), asClient: true });
                                    if (current.status !== "cambios") await setDeliveryStatus(current.id, "cambios");
                                    setAsking(false); setAskText("");
                                    await reload(current.id);
                                });
                                return (
                                    <aside id="lo-que-pidieron" ref={(el) => {
                                        if (!el || (el as HTMLElement & { _io?: boolean })._io) return;
                                        (el as HTMLElement & { _io?: boolean })._io = true;
                                        new IntersectionObserver(([e]) => setCommentsInView(e.isIntersecting), { threshold: 0.05 }).observe(el);
                                    }} className="w-full md:w-[320px] shrink-0 border-t md:border-t-0 md:border-l border-edge flex flex-col md:min-h-0 scroll-mt-4">
                                        {asking && (
                                            <div className="px-5 pt-5 pb-5 border-b border-edge flex flex-col gap-3">
                                                <p className="text-[15px] text-fg">¿Qué cambiarías?</p>
                                                <textarea value={askText} onChange={(e) => setAskText(e.target.value)} rows={4} autoFocus
                                                    placeholder="Ej: el texto más grande, otra foto en la lámina 3…"
                                                    onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && askText.trim()) sendAsk(); if (e.key === "Escape") setAsking(false); }}
                                                    className="px-3 py-2.5 rounded-[4px] border border-edge bg-[var(--color-surface-1)] text-[14px] leading-relaxed text-fg placeholder:text-fg-faint outline-none focus:border-fg/40 resize-none" />
                                                <p className="text-[12px] leading-relaxed text-fg-faint">Si es algo puntual, también podés tocar una lámina y marcar el lugar exacto.</p>
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => { setAsking(false); setAskText(""); }} className="h-8 px-3 text-[12px] text-fg-muted hover:text-fg cursor-pointer">Cancelar</button>
                                                    <button onClick={sendAsk} disabled={busy || !askText.trim()}
                                                        className="h-8 px-3.5 rounded-[var(--radius-sm)] bg-fg text-[var(--color-canvas)] text-[12px] font-medium cursor-pointer disabled:opacity-35">
                                                        {current.status === "cambios" ? "Sumar" : "Pedir cambios"}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {pending.length > 0 && <p className={`${mono} text-fg-faint px-5 pt-5 pb-3`}>
                                            {client ? "Tus comentarios" : "Lo que pidieron"} · {pending.length}
                                        </p>}
                                        <ol className="flex-1 overflow-y-auto px-2 pb-4">
                                            {pending.map((c) => {
                                                const i = c.itemId ? idx[c.itemId] : undefined;
                                                const old = c.itemId && i === undefined ? older[c.itemId] : undefined;
                                                const cur = i !== undefined ? current.items[i] : undefined;
                                                const thumb = cur ? (cur.poster || cur.url) : old?.url;
                                                const open = () => {
                                                    if (i !== undefined) { setSlide(i); setDraft(null); }
                                                    else if (old && c.itemId) setOldSlide({ itemId: c.itemId, ...old });
                                                };
                                                return (
                                                    <li key={c.id} className="group relative">
                                                        {canDeleteComment(c) && (
                                                            <button onClick={() => removeComment(c.id)} title="Borrar el comentario" aria-label="Borrar el comentario"
                                                                className="absolute top-2.5 right-2.5 w-6 h-6 flex items-center justify-center rounded-full text-fg-faint hover:text-[var(--color-error)] md:opacity-0 md:group-hover:opacity-100 cursor-pointer z-10"><Trash2 size={11} /></button>
                                                        )}
                                                        <button onClick={open} disabled={!thumb}
                                                            className="w-full text-left p-3 rounded-[var(--radius-md)] hover:bg-[var(--color-surface-1)] cursor-pointer disabled:cursor-default flex gap-3">
                                                            {thumb && (
                                                                <span className="relative shrink-0 w-11 h-14 rounded-[3px] overflow-hidden bg-surface-2">
                                                                    <img src={backendUrl(thumb)} alt="" className="w-full h-full object-cover" />
                                                                    {c.x != null && c.y != null && (
                                                                        <span style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, background: personColor(c.author) }}
                                                                            className="absolute w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-white" />
                                                                    )}
                                                                </span>
                                                            )}
                                                            <span className="flex-1 min-w-0">
                                                            <span className="text-[11px] text-fg-faint flex flex-wrap items-center gap-x-1.5 gap-y-0.5 whitespace-nowrap">
                                                                <span style={{ background: personColor(c.author) }} className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] text-white">{numberOf[c.id]}</span>
                                                                {i !== undefined ? `Lámina ${String(i + 1).padStart(2, "0")}` : old ? `Lámina ${String(old.n).padStart(2, "0")}` : "Toda la pieza"}
                                                                {" · "}{client ? (c.byClient ? (sameAuthor(c.author) ? "Vos" : who(c.author)) : "Coevo") : <span className={c.byClient ? "text-[var(--color-brand)]" : ""}>{c.internal ? `${who(c.author)} · interno` : c.byClient ? "cliente" : `${who(c.author)} · para el cliente`}</span>}
                                                                {c.round < current.round && ` · versión ${c.round}`}
                                                                {!client && c.kind && <span className="font-mono text-[10px] uppercase tracking-[0.06em]">· {c.kind}</span>}
                                                                <span className="ml-auto shrink-0 pr-6 tabular-nums">{stamp(c.createdAt)}</span>
                                                            </span>
                                                            <span className="block text-[13px] leading-relaxed text-fg mt-1.5">{c.text}</span>
                                                            {!!c.refs?.length && (
                                                                <span className="mt-1.5 flex items-center gap-1.5">
                                                                    {c.refs.map((r) => <img key={r.url} src={backendUrl(r.url)} alt={`Referencia: ${r.name}`} className="w-9 h-9 rounded-[3px] object-cover ring-1 ring-edge" />)}
                                                                    <span className="text-[11px] text-fg-faint">{c.refs.length === 1 ? "referencia" : `${c.refs.length} referencias`}</span>
                                                                </span>
                                                            )}
                                                            </span>
                                                        </button>
                                                        {c.audioUrl && <audio controls preload="none" src={backendUrl(c.audioUrl)} className="ml-3 mb-2 w-[calc(100%-1.5rem)] h-8" />}
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
                                const it = current.items[Math.min(slide, total - 1)];
                                if (!it) return null;
                                const here = comments.filter((c) => c.itemId === it.id);
                                const general = comments.filter((c) => !c.itemId);
                                return (
                                    <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
                                        <div className="md:flex-1 min-w-0 md:min-h-0 flex flex-col bg-[var(--color-canvas)]">
                                            <div className="px-4 md:px-6 py-3 flex items-center gap-3 text-[12px]">
                                                <button onClick={() => { setSlide(null); setDraft(null); setSlideZoom(1); }} className="text-fg-muted hover:text-fg cursor-pointer">← Toda la pieza</button>
                                                {it.changed === current.round && current.round > 1 && it.prev && (() => {
                                                    // La lámina que reemplazó: la señal y cómo era antes, al lado.
                                                    const h = current.history?.[current.history.length - 1];
                                                    const k = h?.items.findIndex((x) => x.id === it.prev) ?? -1;
                                                    const was = h && k >= 0 ? h.items[k] : null;
                                                    return (
                                                        <span className="flex items-center gap-2">
                                                            <span className="px-2 py-0.5 rounded-full bg-[var(--color-brand)] text-white text-[11px] font-medium">Nueva · versión {current.round}</span>
                                                            {was && <button onClick={() => setOldSlide({ itemId: was.id, url: was.poster || was.url, kind: was.kind, round: h!.round, n: k + 1 })}
                                                                className="text-fg-muted hover:text-fg cursor-pointer">Ver cómo era antes</button>}
                                                        </span>
                                                    );
                                                })()}
                                                {!client && (
                                                    <button disabled={busy} onClick={() => { setVersionItem(it.id); setVersionOpen(true); }}
                                                        title="Las demás láminas quedan como están" className="flex items-center gap-1 text-fg-muted hover:text-fg cursor-pointer">
                                                        <Upload size={12} /> Nueva versión de esta lámina
                                                    </button>
                                                )}
                                                {it.preview && (
                                                    <a href={backendUrl(it.url)} download title="Lo que se ve es una copia sobre cuadritos para el navegador; el original conserva la transparencia"
                                                        className="text-fg-faint hover:text-fg no-underline">Bajar el original (con transparencia)</a>
                                                )}
                                                <span className="flex-1" />
                                                <span className="flex items-center gap-0.5 text-fg-muted" aria-label="Zoom de la lámina">
                                                    <button onClick={() => setSlideZoom((z) => Math.max(1, Math.round((z - 0.5) * 10) / 10))} disabled={slideZoom <= 1} aria-label="Achicar"
                                                        className="w-7 h-7 flex items-center justify-center rounded-full hover:text-fg hover:bg-surface-2 disabled:opacity-30 cursor-pointer"><Minus size={13} /></button>
                                                    <button onClick={() => setSlideZoom(1)} title="Que entre entera · pellizcá el trackpad o ⌘ + rueda para hacer zoom donde está el mouse" className={`h-7 px-1.5 tabular-nums cursor-pointer ${slideZoom > 1 ? "hover:text-fg" : "text-fg"}`}>{slideZoom > 1 ? `${Math.round(slideZoom * 100)}%` : "Entera"}</button>
                                                    <button onClick={() => setSlideZoom((z) => Math.min(6, z + 0.5))} aria-label="Agrandar"
                                                        className="w-7 h-7 flex items-center justify-center rounded-full hover:text-fg hover:bg-surface-2 cursor-pointer"><Plus size={13} /></button>
                                                </span>
                                                <span className="w-px h-4 bg-[var(--color-edge)]" />
                                                <button disabled={slide === 0} onClick={() => { setSlide(slide - 1); setDraft(null); }}
                                                    className="w-7 h-7 flex items-center justify-center rounded-full text-fg-muted hover:text-fg hover:bg-surface-2 disabled:opacity-30 cursor-pointer"><ChevronLeft size={15} /></button>
                                                <span className="text-fg-faint tabular-nums">{slide + 1} / {total}</span>
                                                <button disabled={slide === total - 1} onClick={() => { setSlide(slide + 1); setDraft(null); }}
                                                    className="w-7 h-7 flex items-center justify-center rounded-full text-fg-muted hover:text-fg hover:bg-surface-2 disabled:opacity-30 cursor-pointer"><ChevronRight size={15} /></button>
                                            </div>
                                            {/* Mide el lugar y la imagen: siempre entra entera; con zoom se recorre con scroll. */}
                                            <div className="relative h-[62vh] md:h-auto md:flex-1 min-h-0 mx-4 md:mx-6 mb-4 md:mb-6">
                                                <SlideStage key={it.id} url={it.preview || it.url} kind={it.kind === "video" ? "video" : "image"} poster={it.poster} zoom={slideZoom} onZoom={setSlideZoom}
                                                    onPick={(e) => onPick(e, it.id)}>
                                                    {here.filter((c) => c.round === current.round && c.x != null).map((c) => (
                                                        <span key={c.id} onMouseEnter={() => setFocus(c.id)} onMouseLeave={() => setFocus(null)} onClick={(e) => e.stopPropagation()}
                                                            style={{ left: `${c.x! * 100}%`, top: `${c.y! * 100}%`, ...(c.resolvedAt ? {} : { background: personColor(c.author) }) }}
                                                            className={`absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium ring-2 ring-white/70 transition-transform
                                                                ${c.resolvedAt ? "bg-surface-3 text-fg-faint" : "text-white"} ${focus === c.id ? "scale-125" : ""}`}>
                                                            {numberOf[c.id]}
                                                            <span className={`pointer-events-none absolute left-1/2 top-full mt-1.5 -translate-x-1/2 w-max max-w-[240px] px-2 py-1 rounded-[3px] bg-black/85 text-white text-[11px] font-normal leading-snug text-left whitespace-normal transition-opacity ${focus === c.id ? "opacity-100" : "opacity-0"}`}>{c.text}</span>
                                                        </span>
                                                    ))}
                                                    {draft?.itemId === it.id && (
                                                        <span style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%` }}
                                                            className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 border-[var(--color-brand)] bg-black/40 animate-pulse" />
                                                    )}
                                                </SlideStage>
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
                                                {/* «Así, como esta»: una imagen de referencia junto al comentario. */}
                                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                                    {draftRefs.map((f, k) => (
                                                        <span key={k} className="relative w-11 h-11 rounded-[3px] overflow-hidden bg-[var(--color-surface-2)]">
                                                            <RefThumb file={f} />
                                                            <button onClick={() => setDraftRefs(draftRefs.filter((_, j) => j !== k))} aria-label={`Quitar ${f.name}`}
                                                                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer"><X size={9} /></button>
                                                        </span>
                                                    ))}
                                                    {draftRefs.length < 4 && (
                                                        <button onClick={() => refInput.current?.click()} className="h-7 px-2 flex items-center gap-1 rounded-[var(--radius-sm)] border border-dashed border-edge text-[11px] text-fg-muted hover:text-fg hover:border-fg cursor-pointer">
                                                            <Paperclip size={11} /> {draftRefs.length ? "Otra" : "Adjuntar referencia"}
                                                        </button>
                                                    )}
                                                    <VoiceNoteButton disabled={busy} onDone={(audio) => saveVoice(it.id, audio)} />
                                                    <input ref={refInput} type="file" accept="image/*" multiple hidden onChange={(e) => {
                                                        const fs = Array.from(e.target.files || []).filter((f) => f.type.startsWith("image/"));
                                                        e.target.value = "";
                                                        setDraftRefs((cur) => [...cur, ...fs].slice(0, 4));
                                                    }} />
                                                </div>
                                                {!client && (() => {
                                                    const visible = forClient ?? current.visibility === "cliente";
                                                    return (
                                                        <div className="flex gap-0.5 p-0.5 mt-2 bg-[var(--color-surface-2)] rounded-[4px] text-[11px]" role="radiogroup" aria-label="Quién lo ve">
                                                            {([[true, "Lo ve el cliente"], [false, "Sólo el equipo"]] as const).map(([v, l]) => (
                                                                <button key={l} role="radio" aria-checked={visible === v} onClick={() => setForClient(v)}
                                                                    className={`flex-1 h-6 rounded-[3px] cursor-pointer ${visible === v ? "bg-[var(--color-surface-1)] text-fg" : "text-fg-muted"}`}>{l}</button>
                                                            ))}
                                                        </div>
                                                    );
                                                })()}
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
                                                        <div className="text-[11px] text-fg-faint flex flex-wrap items-center gap-x-1.5 gap-y-1 whitespace-nowrap">
                                                            <span style={c.resolvedAt ? undefined : { background: personColor(c.author) }} className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${c.resolvedAt ? "bg-surface-3" : "text-white"}`}>{numberOf[c.id]}</span>
                                                            {client ? (c.byClient ? (sameAuthor(c.author) ? "Vos" : who(c.author)) : "Coevo") : who(c.author)}
                                                            {!client && <span className={c.byClient ? "text-[var(--color-brand)]" : ""}> · {c.internal ? "interno" : c.byClient ? "cliente" : "para el cliente"}</span>}
                                                            {!c.itemId && " · sobre toda la pieza"}{c.round < current.round && ` · versión ${c.round}`}{c.resolvedAt && " · resuelto"}
                                                            {!client && c.kind && <span className="font-mono text-[10px] uppercase tracking-[0.06em]">· {c.kind}</span>}
                                                            <span className="tabular-nums">· {stamp(c.createdAt)}</span>
                                                            <span className="flex-1" />
                                                            {!client && !c.byClient && (
                                                                <button onClick={() => run(async () => { await setDeliveryCommentInternal(current.id, c.id, !c.internal); await reload(current.id); })}
                                                                    title={c.internal ? "Que lo vea el cliente" : "Que lo vea sólo el equipo"}
                                                                    className="md:opacity-0 md:group-hover:opacity-100 h-5 px-1.5 rounded-[3px] border border-edge text-[10px] text-fg-muted hover:text-fg cursor-pointer">
                                                                    {c.internal ? "Mostrar al cliente" : "Ocultar al cliente"}
                                                                </button>
                                                            )}
                                                            {canDeleteComment(c) && (
                                                                <button onClick={() => removeComment(c.id)} title="Borrar el comentario"
                                                                    className="md:opacity-0 md:group-hover:opacity-100 text-fg-faint hover:text-[var(--color-error)] cursor-pointer"><Trash2 size={11} /></button>
                                                            )}
                                                            {!client && (
                                                                <button onClick={() => run(async () => { await toggleDeliveryComment(current.id, c.id); await reload(current.id); })}
                                                                    title={c.resolvedAt ? "Reabrir" : "Marcar resuelto"}
                                                                    className="opacity-0 group-hover:opacity-100 text-fg-faint hover:text-fg cursor-pointer">
                                                                    {c.resolvedAt ? <RotateCcw size={11} /> : <Check size={12} />}
                                                                </button>
                                                            )}
                                                        </div>
                                                        <p className={`text-[12px] text-fg mt-1.5 leading-relaxed ${c.resolvedAt ? "line-through decoration-fg/30" : ""}`}>{c.text}</p>
                                                        {c.audioUrl && <audio controls preload="none" src={backendUrl(c.audioUrl)} className="mt-1.5 w-full h-8" />}
                                                        {!!c.refs?.length && (
                                                            <span className="mt-1.5 flex gap-1.5">
                                                                {c.refs.map((r) => (
                                                                    <a key={r.url} href={backendUrl(r.url)} target="_blank" rel="noreferrer" title={`Referencia: ${r.name}`}
                                                                        className="w-12 h-12 rounded-[3px] overflow-hidden bg-[var(--color-surface-2)] ring-1 ring-edge hover:ring-fg">
                                                                        <img src={backendUrl(r.url)} alt={`Referencia: ${r.name}`} className="w-full h-full object-cover" />
                                                                    </a>
                                                                ))}
                                                            </span>
                                                        )}
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

/** Miniatura de un archivo todavía no subido (la referencia de un comentario). */
function RefThumb({ file }: { file: File }) {
    const url = useMemo(() => URL.createObjectURL(file), [file]);
    useEffect(() => () => URL.revokeObjectURL(url), [url]);
    return <img src={url} alt="" className="w-full h-full object-cover" />;
}
