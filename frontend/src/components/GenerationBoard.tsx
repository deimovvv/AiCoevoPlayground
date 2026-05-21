/**
 * GenerationBoard — Kanban-style board.
 * Columns: Brief/Guión → Personaje → Multishot → Video Listo → Publicado
 * Cards sit in the column matching their current pipeline stage.
 */
import { useState } from "react";
import { Film, Plus, FileText, User as UserIcon, Image, Video, Send, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { type Generation } from "./GenerationCard";
import { GenerationDetailDrawer } from "./GenerationDetailDrawer";
import { Button } from "./ui/button";

// ── Pipeline columns ──
const COLUMNS = [
    { id: "script", label: "Brief / Guión", icon: <FileText size={14} />, color: "var(--color-action)" },
    { id: "scene",  label: "Personaje",     icon: <UserIcon size={14} />, color: "#6ee7b7" },
    { id: "multishot", label: "Multishot",  icon: <Image size={14} />,    color: "#fbbf24" },
    { id: "lipsync",  label: "Video Listo", icon: <Video size={14} />,    color: "#34d399" },
    { id: "published", label: "Publicado",  icon: <Send size={14} />,     color: "#60a5fa" },
];

// Determine which column a generation belongs in
function getColumnId(gen: Generation): string {
    if (gen.status === "completed") return "lipsync";
    if (gen.status === "failed") {
        // Put in the column of the failed phase
        const failedPhase = gen.phases.find(p => p.status === "error");
        return failedPhase?.id || "script";
    }
    // Running: find current active phase
    const running = gen.phases.find(p => p.status === "running");
    if (running) {
        // Special: if scene phase running, put in "multishot"
        if (running.id === "scene") return "multishot";
        return running.id;
    }
    // Review: find phase awaiting review
    const review = gen.phases.find(p => p.status === "review");
    if (review) return review.id;
    // Fallback: last done phase
    const donePhases = gen.phases.filter(p => p.status === "done");
    if (donePhases.length > 0) return donePhases[donePhases.length - 1].id;
    return "script";
}

// Get a display image for the card (scene image > avatar image > product image)
function getCardImage(gen: Generation): string | undefined {
    // Best: a scene/composition result
    const scenePhase = gen.phases.find(p => p.id === "scene");
    if (scenePhase?.result && scenePhase.result.startsWith("http")) return scenePhase.result;
    // Fallback: avatar image
    if (gen.avatarImageUrl) return gen.avatarImageUrl;
    // Fallback: product image
    if (gen.productImageUrl) return gen.productImageUrl;
    return undefined;
}

// ── Mock data ──
export const MOCK_GENERATIONS: Generation[] = [
    {
        id: "gen_8f3a1b",
        scriptText: "¿Sabías que el 90% de la gente usa la remera equivocada para su tipo de cuerpo? Taller Santa Clara diseña prendas que destacan tu mejor versión.",
        clipCount: 1,
        status: "completed",
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        avatarName: "María",
        productName: "Remera Oversize",
        finalVideoUrl: "https://example.com/final-v01.mp4",
        phases: [
            { id: "script", label: "Guion", status: "done", result: "¿Sabías que el 90% de la gente usa la remera equivocada para su tipo de cuerpo?" },
            { id: "scene", label: "Escenas", status: "done", result: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=600&fit=crop" },
            { id: "audio", label: "Audio", status: "done", result: "audio_ready" },
            { id: "lipsync", label: "Lip Sync", status: "done", result: "video_ready" },
        ],
    },
    {
        id: "gen_c92d4e",
        scriptText: "Upgrade your wardrobe with our new summer collection. Fresh colors, same premium quality you love.",
        clipCount: 2,
        status: "running",
        createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        avatarName: "Carlos",
        productName: "Summer Collection",
        phases: [
            { id: "script", label: "Guion", status: "done", result: "Upgrade your wardrobe with our new summer collection." },
            { id: "scene", label: "Multishot", status: "running" },
            { id: "audio", label: "Audio", status: "pending" },
            { id: "lipsync", label: "Lip Sync", status: "pending" },
        ],
        scenes: [
            {
                id: "scene_1", title: "Acto 1: Hook",
                script: "Upgrade your wardrobe with our new summer collection.",
                status: "done",
                multishots: [
                    { url: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=600&fit=crop", isAiPick: true },
                    { url: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=400&h=600&fit=crop" },
                    { url: "https://images.unsplash.com/photo-1434389678121-6b2a095066a3?w=400&h=600&fit=crop" }
                ],
                selectedShotIndex: 0
            },
            {
                id: "scene_2", title: "Acto 2: Story",
                script: "Fresh colors, same premium quality you love.",
                status: "running",
                multishots: [
                    { url: "https://images.unsplash.com/photo-1503342394128-c104d54dba01?w=400&h=600&fit=crop" },
                    { url: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=400&h=600&fit=crop", isAiPick: true },
                    { url: "https://images.unsplash.com/photo-1529551739587-e242c564971d?w=400&h=600&fit=crop" }
                ],
                selectedShotIndex: 1
            }
        ]
    },
    {
        id: "gen_a1f2b3",
        scriptText: "Behind the scenes: how we source our organic cotton to make the softest t-shirts you'll ever wear.",
        clipCount: 1,
        status: "running",
        createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        avatarName: "Elías",
        productName: "Organic Cotton",
        phases: [
            { id: "script", label: "Guion", status: "done", result: "Behind the scenes: how we source our organic cotton." },
            { id: "scene", label: "Escenas", status: "done", result: "https://images.unsplash.com/photo-1503342394128-c104d54dba01?w=400&h=600&fit=crop" },
            { id: "audio", label: "Audio", status: "running" },
            { id: "lipsync", label: "Lip Sync", status: "pending" },
        ],
    },
    {
        id: "gen_774d2a",
        scriptText: "Last chance! 20% off all basic tees this weekend only. Go to the link in bio.",
        clipCount: 1,
        status: "failed",
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        avatarName: "Sofía",
        productName: "Basic Tees",
        error: "Fabric 1.0 API timeout — el servicio de lip-sync no respondió a tiempo.",
        phases: [
            { id: "script", label: "Guion", status: "done", result: "Last chance! 20% off all basic tees this weekend only." },
            { id: "scene", label: "Escenas", status: "done", result: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=400&h=600&fit=crop" },
            { id: "audio", label: "Audio", status: "done", result: "audio_ready" },
            { id: "lipsync", label: "Lip Sync", status: "error", error: "Fabric 1.0 API timeout" },
        ],
    },
];

interface Props {
    generations?: Generation[];
    onNewGeneration?: () => void;
    activePipeline?: React.ReactNode;
}

export function GenerationBoard({ onNewGeneration, generations = MOCK_GENERATIONS, activePipeline }: Props) {
    const [selectedGenId, setSelectedGenId] = useState<string | null>(null);

    // Group generations by column
    const columnGens: Record<string, Generation[]> = {};
    COLUMNS.forEach(c => { columnGens[c.id] = []; });
    generations.forEach(gen => {
        const colId = getColumnId(gen);
        // Map some phase IDs to column IDs
        const mappedColId = colId === "audio" ? "multishot" : colId;
        if (columnGens[mappedColId]) {
            columnGens[mappedColId].push(gen);
        } else {
            columnGens["script"].push(gen);
        }
    });

    const handleSaveContent = (id: string, newScript: string, selectedImage: number) => {
        console.log("[board] Save:", id, newScript, selectedImage);
    };

    const selectedGen = generations.find(g => g.id === selectedGenId) || null;

    return (
        <div className="flex flex-col h-full space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[var(--radius-md)] bg-surface-1 border border-edge flex items-center justify-center">
                        <Film size={18} className="text-fg-muted" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-[18px] font-semibold text-fg leading-tight">Producción</h2>
                            <span className="text-[12px] text-fg-faint font-medium">{generations.length} runs</span>
                        </div>
                    </div>
                </div>
                {onNewGeneration && (
                    <Button size="sm" variant="default" className="flex items-center gap-2 h-9 px-4" onClick={onNewGeneration}>
                        <Plus size={14} /> Nueva Generación
                    </Button>
                )}
            </div>

            {/* Active Pipeline */}
            {activePipeline && (
                <div className="w-full">{activePipeline}</div>
            )}

            {/* Kanban Columns */}
            <div className="flex-1 overflow-x-auto pb-4">
                <div className="flex gap-3 min-w-max h-full">
                    {COLUMNS.map((col, colIdx) => {
                        const gens = columnGens[col.id];
                        return (
                            <div key={col.id} className="flex flex-col w-[220px] shrink-0">
                                {/* Column header */}
                                <div className="flex items-center gap-2 px-2 py-2 mb-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                                    <span className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">{col.label}</span>
                                    <span className="text-[10px] text-fg-faint ml-auto">{gens.length}</span>
                                </div>

                                {/* Column cards */}
                                <div className="flex-1 space-y-2 min-h-[200px]">
                                    {/* + New card button only in first column */}
                                    {colIdx === 0 && onNewGeneration && (
                                        <button
                                            onClick={onNewGeneration}
                                            className="cursor-pointer w-full border border-edge border-dashed rounded-[var(--radius-md)] p-4 flex items-center justify-center gap-2 text-fg-faint hover:text-fg-muted hover:border-edge-strong transition-all"
                                        >
                                            <Plus size={14} />
                                            <span className="text-[11px] font-medium">Nueva tarjeta</span>
                                        </button>
                                    )}

                                    {gens.map(gen => (
                                        <KanbanCard
                                            key={gen.id}
                                            generation={gen}
                                            onClick={() => setSelectedGenId(gen.id)}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <GenerationDetailDrawer
                generation={selectedGen}
                isOpen={!!selectedGenId}
                onClose={() => setSelectedGenId(null)}
                onSaveContent={handleSaveContent}
            />
        </div>
    );
}

// ── Kanban Card ──
function KanbanCard({ generation, onClick }: { generation: Generation; onClick: () => void }) {
    const gen = generation;
    const image = getCardImage(gen);
    const isRunning = gen.status === "running";
    const isFailed = gen.status === "failed";
    const isDone = gen.status === "completed";

    return (
        <div
            onClick={onClick}
            className={`cursor-pointer group border rounded-[var(--radius-md)] overflow-hidden bg-surface-0 transition-all duration-150 hover:shadow-lg hover:border-edge-strong ${
                isFailed ? "border-error/30" : "border-edge"
            }`}
        >
            {/* Image */}
            {image ? (
                <div className="relative aspect-[3/4] overflow-hidden bg-surface-2">
                    <img src={image} alt={gen.avatarName || ""} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />

                    {/* Status overlay */}
                    {isRunning && (
                        <div className="absolute top-2 right-2">
                            <span className="flex items-center gap-1 bg-[var(--color-action)]/90 text-white text-[9px] font-bold px-2 py-1 rounded-full backdrop-blur-sm">
                                <Loader2 size={10} className="animate-spin" /> generando
                            </span>
                        </div>
                    )}
                    {isFailed && (
                        <div className="absolute top-2 right-2">
                            <span className="flex items-center gap-1 bg-error/90 text-white text-[9px] font-bold px-2 py-1 rounded-full backdrop-blur-sm">
                                <AlertCircle size={10} /> error
                            </span>
                        </div>
                    )}
                    {isDone && (
                        <div className="absolute top-2 right-2">
                            <span className="flex items-center gap-1 bg-success/90 text-white text-[9px] font-bold px-2 py-1 rounded-full backdrop-blur-sm">
                                <CheckCircle2 size={10} /> listo
                            </span>
                        </div>
                    )}
                </div>
            ) : (
                <div className="aspect-[3/4] bg-surface-1 flex items-center justify-center">
                    <UserIcon size={24} className="text-fg-faint" />
                </div>
            )}

            {/* Info */}
            <div className="p-2.5 space-y-1">
                <div className="flex items-center gap-1.5">
                    {gen.avatarName && (
                        <span className="text-[12px] font-medium text-fg">{gen.productName || gen.avatarName}</span>
                    )}
                </div>
                <p className="text-[10px] text-fg-faint leading-snug line-clamp-2">
                    {gen.scriptText}
                </p>
                <div className="flex items-center justify-between pt-1">
                    <span className="text-[9px] text-fg-faint font-mono">{gen.id.slice(0, 10)}</span>
                    <span className="text-[9px] text-fg-faint">{timeAgo(gen.createdAt)}</span>
                </div>
            </div>
        </div>
    );
}

function timeAgo(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "ahora";
    if (diffMin < 60) return `${diffMin}m`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays}d`;
}
