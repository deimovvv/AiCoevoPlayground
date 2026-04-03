import { FolderOpen, Image, Video, FileText, Search, Grid3X3, List, Trash2, ExternalLink, Loader2, X, Download } from "lucide-react";
import { useState, useEffect } from "react";
import { useBrand } from "../lib/BrandContext";
import { fetchGenerations, deleteGeneration } from "../lib/api";
import type { Generation } from "../lib/api";
import { cn } from "../lib/utils";

const API_BASE = "http://localhost:8000";

type ContentType = "all" | "image" | "video" | "copy";
type ViewMode = "grid" | "list";

export function ContentPage() {
    const { activeBrand } = useBrand();
    const [filter, setFilter] = useState<ContentType>("all");
    const [view, setView] = useState<ViewMode>("grid");
    const [search, setSearch] = useState("");
    const [generations, setGenerations] = useState<Generation[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [selectedGen, setSelectedGen] = useState<Generation | null>(null);

    useEffect(() => {
        if (!activeBrand) return;
        setLoading(true);
        fetchGenerations(activeBrand.id)
            .then(setGenerations)
            .catch(() => setGenerations([]))
            .finally(() => setLoading(false));
    }, [activeBrand?.id]);

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
        if (search && !g.title.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-[22px] font-semibold text-fg tracking-tight">Content</h1>
                <p className="text-[14px] text-fg-muted mt-1">
                    All generated content for {activeBrand?.name || "your brand"}
                </p>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px] max-w-md relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-faint" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search content..."
                        className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] pl-9 pr-3 py-2 text-[13px] text-fg outline-none focus:border-[var(--color-edge-focus)] transition-colors"
                    />
                </div>

                <div className="flex bg-surface-1 border border-edge rounded-[var(--radius-sm)] p-0.5">
                    {([
                        { value: "all" as const, label: "All" },
                        { value: "image" as const, label: "Images", icon: <Image size={12} /> },
                        { value: "video" as const, label: "Videos", icon: <Video size={12} /> },
                        { value: "copy" as const, label: "Copy", icon: <FileText size={12} /> },
                    ]).map((t) => (
                        <button
                            key={t.value}
                            onClick={() => setFilter(t.value)}
                            className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-[3px] text-[12px] font-medium transition-colors cursor-pointer",
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
                    <button
                        onClick={() => setView("grid")}
                        className={cn(
                            "p-1.5 rounded-[3px] transition-colors cursor-pointer",
                            view === "grid" ? "bg-surface-2 text-fg" : "text-fg-muted hover:text-fg"
                        )}
                    >
                        <Grid3X3 size={14} />
                    </button>
                    <button
                        onClick={() => setView("list")}
                        className={cn(
                            "p-1.5 rounded-[3px] transition-colors cursor-pointer",
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
                        {generations.length === 0 ? "No content yet" : "No matches"}
                    </p>
                    <p className="text-[13px] text-fg-faint mt-1">
                        {generations.length === 0
                            ? "Run a pipeline from Generate to create content"
                            : "Try a different filter or search term"
                        }
                    </p>
                </div>
            ) : view === "grid" ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {filtered.map((gen) => (
                        <ContentCard
                            key={gen.id}
                            gen={gen}
                            deleting={deleting === gen.id}
                            onDelete={() => handleDelete(gen.id)}
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
                            deleting={deleting === gen.id}
                            onDelete={() => handleDelete(gen.id)}
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
                    onDelete={() => { handleDelete(selectedGen.id); setSelectedGen(null); }}
                />
            )}
        </div>
    );
}

function ContentCard({ gen, deleting, onDelete, onClick }: { gen: Generation; deleting: boolean; onDelete: () => void; onClick: () => void }) {
    const typeIcon = {
        image: <Image size={16} />,
        video: <Video size={16} />,
        copy: <FileText size={16} />,
    };

    const date = new Date(gen.createdAt).toLocaleDateString();

    return (
        <div onClick={onClick} className="bg-surface-1 border border-edge rounded-[var(--radius-md)] overflow-hidden group hover:border-[var(--color-edge-strong)] transition-colors cursor-pointer">
            {/* Thumbnail */}
            <div className="aspect-[4/3] bg-surface-2 flex items-center justify-center text-fg-faint relative overflow-hidden">
                {gen.thumbnailUrl ? (
                    <img src={gen.thumbnailUrl} alt={gen.title} className="w-full h-full object-cover" />
                ) : (
                    typeIcon[gen.type]
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
                        onClick={onDelete}
                        disabled={deleting}
                        className="p-2 bg-white/20 rounded-full hover:bg-red-500/60 transition-colors cursor-pointer"
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
                            ? "bg-[rgba(61,191,138,0.1)] text-[var(--color-success)]"
                            : "bg-[rgba(228,171,27,0.1)] text-[var(--color-warning)]"
                    )}>
                        {gen.status}
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

function ContentRow({ gen, deleting, onDelete, onClick }: { gen: Generation; deleting: boolean; onDelete: () => void; onClick: () => void }) {
    const typeIcon = {
        image: <Image size={14} />,
        video: <Video size={14} />,
        copy: <FileText size={14} />,
    };
    const date = new Date(gen.createdAt).toLocaleDateString();

    return (
        <div onClick={onClick} className="flex items-center gap-3 px-4 py-3 bg-surface-1 border border-edge rounded-[var(--radius-sm)] hover:border-[var(--color-edge-strong)] transition-colors group cursor-pointer">
            {gen.thumbnailUrl ? (
                <div className="w-10 h-10 rounded overflow-hidden shrink-0">
                    <img src={gen.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                </div>
            ) : (
                <div className="text-fg-muted">{typeIcon[gen.type]}</div>
            )}
            <p className="flex-1 text-[13px] font-medium text-fg truncate">{gen.title}</p>
            <span className="text-[11px] text-fg-faint">{date}</span>
            <span className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 rounded",
                gen.status === "completed"
                    ? "bg-[rgba(61,191,138,0.1)] text-[var(--color-success)]"
                    : "bg-[rgba(228,171,27,0.1)] text-[var(--color-warning)]"
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
                className="p-1.5 text-fg-faint hover:text-red-400 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
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
                        <div className="rounded-[var(--radius-md)] overflow-hidden border border-edge bg-black">
                            <video src={fullVideoUrl} controls className="w-full" />
                        </div>
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
                                ? "bg-[rgba(61,191,138,0.1)] text-[var(--color-success)]"
                                : "bg-[rgba(228,171,27,0.1)] text-[var(--color-warning)]"
                        )}>
                            {gen.status}
                        </span>
                        <span className="text-[11px] text-fg-faint px-2 py-1 bg-surface-2 rounded">{gen.type}</span>
                        <span className="text-[11px] text-fg-faint px-2 py-1 bg-surface-2 rounded">{gen.toolId}</span>
                    </div>

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

                    {/* Scenes */}
                    {gen.scenes && gen.scenes.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-[11px] font-semibold text-fg-faint uppercase tracking-wider">Scenes</h3>
                            {gen.scenes.map((scene, i) => (
                                <div key={scene.id || i} className="bg-surface-1 rounded-[var(--radius-sm)] px-4 py-3">
                                    <div className="text-[12px] text-fg font-medium">{scene.title || `Scene ${i + 1}`}</div>
                                    {scene.script && (
                                        <p className="text-[11px] text-fg-muted mt-1 leading-relaxed">{`${scene.script}`}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2 border-t border-edge">
                        {fullVideoUrl && (
                            <a
                                href={fullVideoUrl}
                                download={`${gen.title.replace(/[^a-zA-Z0-9]/g, "_")}.mp4`}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[13px] font-medium text-white bg-[var(--color-warm)] rounded-[var(--radius-sm)] hover:opacity-90 transition-opacity cursor-pointer"
                            >
                                <Download size={14} />
                                Download
                            </a>
                        )}
                        <button
                            onClick={onDelete}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 text-[13px] font-medium text-fg-muted bg-surface-2 hover:bg-red-500/10 hover:text-red-400 rounded-[var(--radius-sm)] transition-colors cursor-pointer"
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
