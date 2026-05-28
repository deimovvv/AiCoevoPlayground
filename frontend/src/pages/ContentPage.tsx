import { FolderOpen, Image, Video, FileText, Search, Grid3X3, List, Trash2, ExternalLink, Loader2, X, Download, Pencil, Share2, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "react-router";
import { useBrand } from "../lib/BrandContext";
import { fetchGenerations, deleteGeneration, createReview, getGenerationReview, listReviews, ensureBrandPortal, setGenerationPublished } from "../lib/api";
import type { Generation, ReviewData } from "../lib/api";
import { cn } from "../lib/utils";
import { downloadFile } from "../lib/download";

const API_BASE = "http://localhost:8000";

type ContentType = "all" | "image" | "video" | "copy";
type StatusFilter = "all" | "draft" | "completed";
type ViewMode = "grid" | "list";

export function ContentPage() {
    const { activeBrand } = useBrand();
    const [filter, setFilter] = useState<ContentType>("all");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [view, setView] = useState<ViewMode>("grid");
    const [search, setSearch] = useState("");
    const [generations, setGenerations] = useState<Generation[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [selectedGen, setSelectedGen] = useState<Generation | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [reviewsByGen, setReviewsByGen] = useState<Record<string, ReviewData>>({});

    useEffect(() => {
        if (!activeBrand) return;
        setLoading(true);
        fetchGenerations(activeBrand.id)
            .then(setGenerations)
            .catch(() => setGenerations([]))
            .finally(() => setLoading(false));
        // Reviews (for the "cliente revisó" badges) — one fetch, mapped by generation.
        listReviews().then((rs) => {
            const map: Record<string, ReviewData> = {};
            for (const r of rs) map[r.generationId] = r;
            setReviewsByGen(map);
        }).catch(() => setReviewsByGen({}));
    }, [activeBrand?.id]);

    const [portalCopied, setPortalCopied] = useState(false);
    const [portalUrl, setPortalUrl] = useState<string | null>(null);
    const copyPortalLink = async () => {
        if (!activeBrand) return;
        try {
            const { token } = await ensureBrandPortal(activeBrand.id);
            const url = `${window.location.origin}/portal/${token}`;
            setPortalUrl(url);
            try { await navigator.clipboard.writeText(url); } catch { /* clipboard blocked */ }
            setPortalCopied(true);
            setTimeout(() => setPortalCopied(false), 2500);
        } catch (e) {
            console.error("[portal] link failed:", e);
        }
    };

    // Summary of client feedback for a generation, or null if none yet.
    const reviewSummary = (genId: string): { approved: number; changes: number } | null => {
        const r = reviewsByGen[genId];
        const fb = r?.feedback ? Object.values(r.feedback) : [];
        if (fb.length === 0) return null;
        return {
            approved: fb.filter((v) => v.status === "approved").length,
            changes: fb.filter((v) => v.status === "change").length,
        };
    };

    const handleDelete = async (id: string) => {
        setDeleting(id);
        try {
            await deleteGeneration(id);
            setGenerations((prev) => prev.filter((g) => g.id !== id));
        } catch {
            console.error("Delete failed");
        } finally {
            setDeleting(null);
        }
    };

    const filtered = generations.filter((g) => {
        if (filter !== "all" && g.type !== filter) return false;
        if (statusFilter === "draft" && g.status === "completed") return false;
        if (statusFilter === "completed" && g.status !== "completed") return false;
        if (search && !g.title.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const draftCount = generations.filter((g) => g.status !== "completed").length;

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-[22px] font-semibold text-fg tracking-tight">Contenido</h1>
                    <p className="text-[14px] text-fg-muted mt-1">
                        Todo el contenido generado para {activeBrand?.name || "tu marca"}
                    </p>
                </div>
                {activeBrand && (
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <button
                            onClick={copyPortalLink}
                            title="Link del portal del cliente — ve todo lo que publiques para esta marca"
                            className="flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-sm)] text-[12px] font-medium border border-edge text-fg-muted hover:text-fg hover:border-[var(--color-action)] cursor-pointer transition-colors"
                        >
                            {portalCopied ? <Check size={14} /> : <Share2 size={14} />}
                            {portalCopied ? "¡Link copiado!" : "Portal del cliente"}
                        </button>
                        {portalUrl && (
                            <a
                                href={portalUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-[var(--color-action)] hover:underline max-w-[260px] truncate"
                                title={`Abrir portal: ${portalUrl}`}
                            >
                                Abrir portal ↗
                            </a>
                        )}
                    </div>
                )}
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px] max-w-md relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-faint" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar contenido..."
                        className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] pl-9 pr-3 py-2 text-[13px] text-fg outline-none focus:border-[var(--color-edge-focus)] transition-colors"
                    />
                </div>

                <div className="flex bg-surface-1 border border-edge rounded-[var(--radius-sm)] p-0.5">
                    {([
                        { value: "all" as const, label: "Todo" },
                        { value: "image" as const, label: "Imágenes", icon: <Image size={12} /> },
                        { value: "video" as const, label: "Videos", icon: <Video size={12} /> },
                        { value: "copy" as const, label: "Copy", icon: <FileText size={12} /> },
                    ]).map((t) => (
                        <button
                            key={t.value}
                            onClick={() => setFilter(t.value)}
                            className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-sm)] text-[12px] font-medium transition-colors cursor-pointer",
                                filter === t.value
                                    ? "bg-surface-2 text-fg"
                                    : "text-fg-muted hover:text-fg"
                            )}
                        >
                            {t.icon}
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="flex bg-surface-1 border border-edge rounded-[var(--radius-sm)] p-0.5">
                    {([
                        { value: "all" as const, label: "Todos" },
                        { value: "draft" as const, label: `En proceso${draftCount > 0 ? ` (${draftCount})` : ""}` },
                        { value: "completed" as const, label: "Terminados" },
                    ]).map((t) => (
                        <button
                            key={t.value}
                            onClick={() => setStatusFilter(t.value)}
                            className={cn(
                                "px-2.5 py-1.5 rounded-[var(--radius-sm)] text-[12px] font-medium transition-colors cursor-pointer",
                                statusFilter === t.value
                                    ? "bg-surface-2 text-fg"
                                    : "text-fg-muted hover:text-fg"
                            )}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="flex bg-surface-1 border border-edge rounded-[var(--radius-sm)] p-0.5">
                    <button
                        onClick={() => setView("grid")}
                        className={cn(
                            "p-1.5 rounded-[var(--radius-sm)] transition-colors cursor-pointer",
                            view === "grid" ? "bg-surface-2 text-fg" : "text-fg-muted hover:text-fg"
                        )}
                    >
                        <Grid3X3 size={14} />
                    </button>
                    <button
                        onClick={() => setView("list")}
                        className={cn(
                            "p-1.5 rounded-[var(--radius-sm)] transition-colors cursor-pointer",
                            view === "list" ? "bg-surface-2 text-fg" : "text-fg-muted hover:text-fg"
                        )}
                    >
                        <List size={14} />
                    </button>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 size={20} className="animate-spin text-fg-muted" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <FolderOpen size={40} className="text-fg-faint mb-3" />
                    <p className="text-[14px] text-fg-muted">
                        {generations.length === 0 ? "Todavía no hay contenido" : "Sin resultados"}
                    </p>
                    <p className="text-[13px] text-fg-faint mt-1">
                        {generations.length === 0
                            ? "Corré un pipeline desde Generar para crear contenido"
                            : "Probá otro filtro o término de búsqueda"
                        }
                    </p>
                </div>
            ) : view === "grid" ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {filtered.map((gen) => (
                        <ContentCard
                            key={gen.id}
                            gen={gen}
                            review={reviewSummary(gen.id)}
                            deleting={deleting === gen.id}
                            onDelete={() => setConfirmDeleteId(gen.id)}
                            onClick={() => setSelectedGen(gen)}
                        />
                    ))}
                </div>
            ) : (
                <div className="space-y-1">
                    {filtered.map((gen) => (
                        <ContentRow
                            key={gen.id}
                            gen={gen}
                            review={reviewSummary(gen.id)}
                            deleting={deleting === gen.id}
                            onDelete={() => setConfirmDeleteId(gen.id)}
                            onClick={() => setSelectedGen(gen)}
                        />
                    ))}
                </div>
            )}

            {/* Generation Detail Drawer */}
            {selectedGen && (
                <GenerationDrawer
                    gen={selectedGen}
                    onClose={() => setSelectedGen(null)}
                    onDelete={() => setConfirmDeleteId(selectedGen.id)}
                />
            )}

            {/* Delete confirmation modal */}
            {confirmDeleteId && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmDeleteId(null)} />
                    <div className="relative bg-surface-0 border border-edge rounded-[var(--radius-md)] p-6 max-w-sm w-full mx-4 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-error-muted flex items-center justify-center shrink-0">
                                <Trash2 size={18} className="text-error" />
                            </div>
                            <div>
                                <h3 className="text-[14px] font-semibold text-fg">¿Eliminar generación?</h3>
                                <p className="text-[12px] text-fg-muted mt-0.5">This action cannot be undone.</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-4 py-2 text-[13px] text-fg-muted hover:text-fg bg-surface-2 rounded-[var(--radius-sm)] transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    handleDelete(confirmDeleteId);
                                    setConfirmDeleteId(null);
                                    if (selectedGen?.id === confirmDeleteId) setSelectedGen(null);
                                }}
                                className="px-4 py-2 text-[13px] font-medium text-white bg-[var(--color-error)] hover:opacity-90 rounded-[var(--radius-sm)] transition-colors cursor-pointer"
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function resolveMediaUrl(url?: string): string | undefined {
    if (!url) return undefined;
    if (url.startsWith("http") || url.startsWith("data:") || url.startsWith("blob:")) return url;
    return `${API_BASE}${url}`;
}

function ContentCard({ gen, review, deleting, onDelete, onClick }: { gen: Generation; review?: { approved: number; changes: number } | null; deleting: boolean; onDelete: () => void; onClick: () => void }) {
    const typeIcon = {
        image: <Image size={16} />,
        video: <Video size={16} />,
        copy: <FileText size={16} />,
    };

    const date = new Date(gen.createdAt).toLocaleDateString();
    const thumbUrl = resolveMediaUrl(gen.thumbnailUrl);

    return (
        <div onClick={onClick} className="bg-surface-1 border border-edge rounded-[var(--radius-md)] overflow-hidden group hover:border-[var(--color-edge-strong)] transition-colors cursor-pointer">
            {/* Thumbnail */}
            <div className="aspect-[4/3] bg-surface-2 flex items-center justify-center text-fg-faint relative overflow-hidden">
                {thumbUrl ? (
                    <img src={thumbUrl} alt={gen.title} className="w-full h-full object-cover" />
                ) : (
                    typeIcon[gen.type]
                )}
                {/* Client review badge */}
                {review && (
                    <div className={cn(
                        "absolute top-2 left-2 text-[9px] font-semibold px-1.5 py-0.5 rounded-full backdrop-blur flex items-center gap-1",
                        review.changes > 0 ? "bg-[var(--color-warning)]/90 text-black" : "bg-[var(--color-success)]/90 text-white",
                    )} title="Feedback del cliente">
                        👁 {review.approved}✓{review.changes > 0 ? ` · ${review.changes}✎` : ""}
                    </div>
                )}
                {/* Overlay actions */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {gen.outputUrl && (
                        <a
                            href={gen.outputUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                        >
                            <ExternalLink size={14} className="text-white" />
                        </a>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        disabled={deleting}
                        className="p-2 bg-white/20 rounded-full hover:bg-error-muted transition-colors cursor-pointer"
                    >
                        {deleting ? (
                            <Loader2 size={14} className="text-white animate-spin" />
                        ) : (
                            <Trash2 size={14} className="text-white" />
                        )}
                    </button>
                </div>
            </div>
            <div className="p-3 space-y-1.5">
                <p className="text-[13px] font-medium text-fg truncate">{gen.title}</p>
                <div className="flex items-center justify-between">
                    <span className="text-[11px] text-fg-faint">{date}</span>
                    <span className={cn(
                        "text-[10px] font-medium px-1.5 py-0.5 rounded",
                        gen.status === "completed"
                            ? "bg-success-muted text-success"
                            : "bg-warning-muted text-warning"
                    )}>
                        {gen.status === "completed" ? "Terminado" : "En proceso"}
                    </span>
                </div>
                {gen.metadata && (
                    <div className="flex gap-1.5 flex-wrap">
                        {gen.metadata.platform != null && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-surface-2 rounded text-fg-faint">
                                {`${gen.metadata.platform}`}
                            </span>
                        )}
                        {gen.metadata.numScenes != null && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-surface-2 rounded text-fg-faint">
                                {`${gen.metadata.numScenes}`} scenes
                            </span>
                        )}
                        {gen.metadata.duration != null && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-surface-2 rounded text-fg-faint">
                                {`${gen.metadata.duration}`}s
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function ContentRow({ gen, review, deleting, onDelete, onClick }: { gen: Generation; review?: { approved: number; changes: number } | null; deleting: boolean; onDelete: () => void; onClick: () => void }) {
    const typeIcon = {
        image: <Image size={14} />,
        video: <Video size={14} />,
        copy: <FileText size={14} />,
    };
    const date = new Date(gen.createdAt).toLocaleDateString();
    const thumbUrl = resolveMediaUrl(gen.thumbnailUrl);

    return (
        <div onClick={onClick} className="flex items-center gap-3 px-4 py-3 bg-surface-1 border border-edge rounded-[var(--radius-sm)] hover:border-[var(--color-edge-strong)] transition-colors group cursor-pointer">
            {thumbUrl ? (
                <div className="w-10 h-10 rounded overflow-hidden shrink-0">
                    <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                </div>
            ) : (
                <div className="text-fg-muted">{typeIcon[gen.type]}</div>
            )}
            <p className="flex-1 text-[13px] font-medium text-fg truncate">{gen.title}</p>
            {review && (
                <span className={cn(
                    "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                    review.changes > 0 ? "bg-[var(--color-warning)]/20 text-warning" : "bg-success-muted text-success",
                )} title="Feedback del cliente">
                    👁 {review.approved}✓{review.changes > 0 ? ` ${review.changes}✎` : ""}
                </span>
            )}
            <span className="text-[11px] text-fg-faint">{date}</span>
            <span className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 rounded",
                gen.status === "completed"
                    ? "bg-success-muted text-success"
                    : "bg-warning-muted text-warning"
            )}>
                {gen.status}
            </span>
            {gen.outputUrl && (
                <a
                    href={gen.outputUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-fg-faint hover:text-fg transition-colors opacity-0 group-hover:opacity-100"
                >
                    <ExternalLink size={12} />
                </a>
            )}
            <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                disabled={deleting}
                className="p-1.5 text-fg-faint hover:text-error transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
            >
                {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            </button>
        </div>
    );
}

// ── Generation Detail Drawer ──────────────────────────────

function GenerationDrawer({ gen, onClose, onDelete }: { gen: Generation; onClose: () => void; onDelete: () => void }) {
    const date = new Date(gen.createdAt).toLocaleDateString("es-AR", {
        year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

    const [sharing, setSharing] = useState(false);
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [clientReview, setClientReview] = useState<ReviewData | null>(null);
    useEffect(() => { getGenerationReview(gen.id).then(setClientReview).catch(() => {}); }, [gen.id]);
    const [published, setPublished] = useState<boolean>(!!(gen as unknown as { publishedToPortal?: boolean }).publishedToPortal);
    const [publishing, setPublishing] = useState(false);
    const togglePublish = async () => {
        setPublishing(true);
        try { const r = await setGenerationPublished(gen.id, !published); setPublished(r.published); }
        catch (e) { console.error("[portal] publish failed:", e); }
        finally { setPublishing(false); }
    };
    const clientFeedback = clientReview?.feedback ? Object.entries(clientReview.feedback).filter(([, v]) => v.status) : [];
    const handleShareReview = async () => {
        setSharing(true);
        try {
            const review = await createReview(gen.id);
            const url = `${window.location.origin}/review/${review.token}`;
            setShareUrl(url);
            try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* clipboard blocked */ }
        } catch (e) {
            console.error("[review] share failed:", e);
        } finally {
            setSharing(false);
        }
    };

    const fullVideoUrl = gen.outputUrl
        ? gen.outputUrl.startsWith("http") ? gen.outputUrl : `${API_BASE}${gen.outputUrl}`
        : null;

    const fullThumbUrl = gen.thumbnailUrl
        ? gen.thumbnailUrl.startsWith("http") ? gen.thumbnailUrl : `${API_BASE}${gen.thumbnailUrl}`
        : null;

    return (
        <div className="fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60" onClick={onClose} />

            {/* Drawer */}
            <div className="absolute right-0 top-0 bottom-0 w-full max-w-lg bg-surface-0 border-l border-edge overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-surface-0 border-b border-edge px-6 py-4 flex items-center justify-between z-10">
                    <div>
                        <h2 className="text-[16px] font-semibold text-fg">{gen.title}</h2>
                        <p className="text-[12px] text-fg-faint mt-0.5">{date}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-fg-muted hover:text-fg transition-colors cursor-pointer">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Video / Image preview */}
                    {gen.type === "video" && fullVideoUrl ? (
                        (() => {
                            // Defensive: some old generations have an image URL stored as outputUrl
                            // (bug fixed forward, but pre-existing data is stuck). Detect by extension
                            // and render an image instead of spinning the <video> tag forever.
                            const looksLikeImage = /\.(png|jpe?g|webp|gif)(\?|$)/i.test(fullVideoUrl);
                            if (looksLikeImage) {
                                return (
                                    <div className="rounded-[var(--radius-md)] overflow-hidden border border-edge bg-surface-2">
                                        <img src={fullVideoUrl} alt={gen.title} className="w-full" />
                                        <p className="text-[10px] text-fg-faint p-2 italic">
                                            ⚠ Esta generación se guardó con un archivo de imagen, no video. (Bug histórico — las nuevas se guardan bien.)
                                        </p>
                                    </div>
                                );
                            }
                            return (
                                <div className="rounded-[var(--radius-md)] overflow-hidden border border-edge bg-black">
                                    <video src={fullVideoUrl} controls preload="metadata" className="w-full" />
                                </div>
                            );
                        })()
                    ) : fullThumbUrl ? (
                        <div className="rounded-[var(--radius-md)] overflow-hidden border border-edge">
                            <img src={fullThumbUrl} alt={gen.title} className="w-full" />
                        </div>
                    ) : null}

                    {/* Status + Type */}
                    <div className="flex items-center gap-3">
                        <span className={cn(
                            "text-[11px] font-medium px-2 py-1 rounded",
                            gen.status === "completed"
                                ? "bg-success-muted text-success"
                                : "bg-warning-muted text-warning"
                        )}>
                            {gen.status}
                        </span>
                        <span className="text-[11px] text-fg-faint px-2 py-1 bg-surface-2 rounded">{gen.type}</span>
                        <span className="text-[11px] text-fg-faint px-2 py-1 bg-surface-2 rounded">{gen.toolId}</span>
                    </div>

                    {/* Continue / Open in tool */}
                    {gen.pipelineState ? (
                        <Link
                            to={`/dashboard/generate/${gen.toolId}?gen=${gen.id}`}
                            className="flex items-center justify-center gap-2 w-full py-2.5 bg-[var(--color-action)] hover:opacity-90 text-[var(--color-action-fg)] font-semibold rounded-[var(--radius-sm)] text-[13px] transition-opacity cursor-pointer"
                        >
                            <Pencil size={13} />
                            {gen.status === "completed" ? "Abrir en el tool" : "Continuar edición"}
                        </Link>
                    ) : (
                        <div
                            className="flex flex-col items-center justify-center gap-0.5 w-full py-2 bg-surface-2 border border-edge rounded-[var(--radius-sm)] text-[12px] text-fg-faint"
                            title="Esta generación es anterior al sistema de auto-save. Solo vista."
                        >
                            <span className="font-medium">Generación antigua</span>
                            <span className="text-[10px]">Sin estado guardado — solo vista</span>
                        </div>
                    )}

                    {/* Client review + portal */}
                    {gen.status === "completed" && (
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleShareReview}
                                    disabled={sharing}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-edge hover:border-[var(--color-action)] text-fg-muted hover:text-fg font-medium rounded-[var(--radius-sm)] text-[13px] cursor-pointer disabled:opacity-50 transition-colors"
                                >
                                    {sharing ? <Loader2 size={13} className="animate-spin" /> : copied ? <Check size={13} /> : <Share2 size={13} />}
                                    {copied ? "¡Copiado!" : "Compartir review"}
                                </button>
                                <button
                                    onClick={togglePublish}
                                    disabled={publishing}
                                    title={published ? "Visible en el portal del cliente — click para ocultar" : "Publicar al portal del cliente (lo ve junto al resto de su contenido)"}
                                    className={cn(
                                        "flex items-center justify-center gap-2 py-2.5 px-3 rounded-[var(--radius-sm)] text-[13px] font-medium cursor-pointer disabled:opacity-50 transition-colors border",
                                        published ? "bg-[var(--color-action-subtle)] border-[var(--color-action-muted)] text-fg" : "border-edge text-fg-muted hover:text-fg hover:border-[var(--color-action)]",
                                    )}
                                >
                                    {publishing ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                    {published ? "En el portal" : "Publicar al portal"}
                                </button>
                            </div>
                            {shareUrl && (
                                <p className="text-[10px] text-fg-faint break-all">
                                    <a href={shareUrl} target="_blank" rel="noreferrer" className="hover:text-fg underline">{shareUrl}</a>
                                </p>
                            )}
                        </div>
                    )}

                    {/* Client feedback (from the review link) */}
                    {clientFeedback.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-[11px] font-semibold text-fg-faint uppercase tracking-wider flex items-center gap-1.5">
                                Feedback del cliente
                                <span className="text-[var(--color-success)]">{clientFeedback.filter(([, v]) => v.status === "approved").length} ✓</span>
                                {clientFeedback.some(([, v]) => v.status === "change") && (
                                    <span className="text-warning">{clientFeedback.filter(([, v]) => v.status === "change").length} cambios</span>
                                )}
                            </h3>
                            <div className="space-y-1.5">
                                {(clientReview?.clips || []).map((clip) => {
                                    const fb = clientReview?.feedback?.[clip.id];
                                    if (!fb || !fb.status) return null;
                                    const isChange = fb.status === "change";
                                    return (
                                        <div key={clip.id} className={cn(
                                            "rounded-[var(--radius-sm)] border px-3 py-2",
                                            isChange ? "border-[var(--color-warning)]/40 bg-[var(--color-warning)]/5" : "border-edge bg-surface-1",
                                        )}>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[11px] font-medium text-fg flex-1 truncate">{clip.label}</span>
                                                <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wide font-semibold", isChange ? "bg-[var(--color-warning)] text-black" : "bg-success-muted text-success")}>
                                                    {isChange ? "✎ cambio" : "✓ aprobado"}
                                                </span>
                                            </div>
                                            {fb.comment && <p className="text-[11px] text-fg-muted leading-snug mt-1">"{fb.comment}"</p>}
                                        </div>
                                    );
                                })}
                            </div>
                            {clientFeedback.some(([, v]) => v.status === "change") && gen.pipelineState && (
                                <p className="text-[10px] text-fg-faint">Abrí en el tool para regenerar los clips con cambios.</p>
                            )}
                        </div>
                    )}

                    {/* Metadata */}
                    {gen.metadata && Object.keys(gen.metadata).length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-[11px] font-semibold text-fg-faint uppercase tracking-wider">Details</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.entries(gen.metadata).map(([key, value]) => (
                                    <div key={key} className="bg-surface-1 rounded-[var(--radius-sm)] px-3 py-2">
                                        <div className="text-[10px] text-fg-faint capitalize">{key.replace(/([A-Z])/g, " $1")}</div>
                                        <div className="text-[12px] text-fg font-medium">{`${value}`}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Scenes / Creatives */}
                    {gen.scenes && gen.scenes.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-[11px] font-semibold text-fg-faint uppercase tracking-wider">
                                {gen.type === "image" ? "Creativos" : "Escenas"} ({gen.scenes.length})
                            </h3>
                            {gen.scenes.some((s) => s.imageUrl) ? (
                                <div className="grid grid-cols-2 gap-2">
                                    {gen.scenes.map((scene, i) => {
                                        const sceneImg = resolveMediaUrl(scene.imageUrl);
                                        return (
                                        <div key={scene.id || i} className="space-y-1 group/img">
                                            {sceneImg && (
                                                <div className="aspect-square rounded-[var(--radius-sm)] overflow-hidden border border-edge relative cursor-pointer"
                                                    onClick={() => downloadFile(sceneImg!, `creative_${i + 1}.png`)}
                                                    title="Descargar"
                                                >
                                                    <img src={sceneImg} alt={scene.title || `${i + 1}`} className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/30 transition-colors flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                downloadFile(sceneImg!, `creative_${i + 1}.png`);
                                                            }}
                                                            className="opacity-0 group-hover/img:opacity-100 p-1.5 bg-white/20 rounded-full hover:bg-white/40 transition-all cursor-pointer"
                                                        >
                                                            <Download size={12} className="text-white" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                            <p className="text-[10px] text-fg-muted text-center">{scene.title || `Scene ${i + 1}`}</p>
                                        </div>
                                    );
                                    })}
                                </div>
                            ) : (
                                gen.scenes.map((scene, i) => (
                                    <div key={scene.id || i} className="bg-surface-1 rounded-[var(--radius-sm)] px-4 py-3">
                                        <div className="text-[12px] text-fg font-medium">{scene.title || `Scene ${i + 1}`}</div>
                                        {scene.script && (
                                            <p className="text-[11px] text-fg-muted mt-1 leading-relaxed">{`${scene.script}`}</p>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2 border-t border-edge">
                        {fullVideoUrl && (
                            <a
                                href={fullVideoUrl}
                                download={`${gen.title.replace(/[^a-zA-Z0-9]/g, "_")}.mp4`}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[13px] font-medium text-[var(--color-action-fg)] bg-[var(--color-action)] rounded-[var(--radius-sm)] hover:opacity-90 transition-opacity cursor-pointer"
                            >
                                <Download size={14} />
                                Download
                            </a>
                        )}
                        {gen.pipelineState && (
                            <Link
                                to={`/dashboard/generate/${gen.toolId}?gen=${gen.id}`}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[13px] font-medium text-fg bg-surface-2 hover:bg-surface-3 rounded-[var(--radius-sm)] transition-colors cursor-pointer"
                            >
                                <Pencil size={14} />
                                Continue editing
                            </Link>
                        )}
                        <button
                            onClick={onDelete}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 text-[13px] font-medium text-fg-muted bg-surface-2 hover:bg-error-muted hover:text-error rounded-[var(--radius-sm)] transition-colors cursor-pointer"
                        >
                            <Trash2 size={14} />
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
