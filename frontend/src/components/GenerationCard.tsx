/**
 * GenerationCard — Each generation shows its pipeline steps as horizontal mini-cards.
 */
import {
    Play, Download, Trash2, Clock, RotateCcw, ChevronRight, User, Package,
    FileText, Image, Mic, Video, Loader2, CheckCircle2, AlertCircle,
} from "lucide-react";

export interface GenerationScene {
    id: string;
    title: string;
    script: string;
    status: "pending" | "running" | "done" | "error";
    multishots: { url: string; isAiPick?: boolean }[];
    selectedShotIndex?: number;
}

export type Phase = {
    id: string;
    label: string;
    status: "pending" | "running" | "done" | "review" | "error";
    result?: string; // text or url
    error?: string;
    duration?: number;
};

export interface Generation {
    id: string;
    scriptText: string;
    clipCount: number;
    status: "draft" | "running" | "completed" | "failed";
    createdAt: string;
    avatarImageUrl?: string;
    avatarName?: string;
    productImageUrl?: string;
    productName?: string;
    finalVideoUrl?: string;
    phases: Phase[];
    scenes?: GenerationScene[];
    error?: string;
}

interface Props {
    generation: Generation;
    onDelete?: (id: string) => void;
    onRestart?: (id: string) => void;
    onClick?: (id: string) => void;
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

const STATUS_LABEL: Record<string, string> = {
    draft: "Borrador",
    running: "En proceso",
    completed: "Completado",
    failed: "Error",
};

// Icon for phase
const PHASE_ICON: Record<string, React.ReactNode> = {
    script: <FileText size={13} />,
    scene: <Image size={13} />,
    audio: <Mic size={13} />,
    lipsync: <Video size={13} />,
};

// Status styling for mini step cards
function getStepCardStyle(status: Phase["status"]) {
    switch (status) {
        case "done": return "border-success/30 bg-success/5";
        case "running": return "border-[var(--color-warm)]/40 bg-[var(--color-warm)]/5";
        case "review": return "border-warning/40 bg-warning/5";
        case "error": return "border-error/30 bg-error/5";
        default: return "border-edge bg-surface-1/30";
    }
}

function getStepIconStyle(status: Phase["status"]) {
    switch (status) {
        case "done": return "text-success";
        case "running": return "text-[var(--color-warm)]";
        case "review": return "text-warning";
        case "error": return "text-error";
        default: return "text-fg-faint";
    }
}

function StepStatusIcon({ status }: { status: Phase["status"] }) {
    switch (status) {
        case "done": return <CheckCircle2 size={12} className="text-success" />;
        case "running": return <Loader2 size={12} className="animate-spin text-[var(--color-warm)]" />;
        case "error": return <AlertCircle size={12} className="text-error" />;
        default: return null;
    }
}

export function GenerationCard({ generation, onDelete, onRestart, onClick }: Props) {
    const gen = generation;
    const progress = gen.phases.length > 0
        ? Math.round((gen.phases.filter(p => p.status === "done").length / gen.phases.length) * 100)
        : 0;

    return (
        <div
            className="group border border-edge hover:border-edge-strong rounded-[var(--radius-md)] bg-surface-0 overflow-hidden transition-all duration-150 cursor-pointer"
            onClick={() => onClick?.(gen.id)}
        >
            <div className="p-4 space-y-3">
                {/* Row 1: Status + Avatar + Time */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <span className="text-[11px] font-medium text-fg-muted bg-surface-1 border border-edge px-2 py-0.5 rounded">
                            {STATUS_LABEL[gen.status]}
                            {gen.status === "running" && <span className="ml-1.5 text-fg-faint">· {progress}%</span>}
                        </span>
                        {gen.avatarName && (
                            <span className="flex items-center gap-1 text-[11px] text-fg-faint">
                                <User size={10} /> {gen.avatarName}
                            </span>
                        )}
                        {gen.productName && (
                            <span className="flex items-center gap-1 text-[11px] text-fg-faint">
                                <Package size={10} /> {gen.productName}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-fg-faint flex items-center gap-1">
                            <Clock size={9} /> {timeAgo(gen.createdAt)}
                        </span>
                        <ChevronRight size={12} className="text-fg-faint group-hover:text-fg-muted transition-colors" />
                    </div>
                </div>

                {/* Row 2: Error if any */}
                {gen.error && (
                    <p className="text-[11px] text-error bg-error/5 border border-error/20 rounded-[var(--radius-sm)] px-2.5 py-1.5">
                        {gen.error}
                    </p>
                )}

                {/* Row 3: Horizontal Step Cards */}
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {gen.phases.map((phase) => (
                        <div
                            key={phase.id}
                            className={`flex-1 min-w-[110px] border rounded-[var(--radius-sm)] overflow-hidden transition-all ${getStepCardStyle(phase.status)}`}
                        >
                            {/* Step header */}
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-edge-subtle/50">
                                <span className={getStepIconStyle(phase.status)}>
                                    {PHASE_ICON[phase.id] || <FileText size={13} />}
                                </span>
                                <span className="text-[11px] font-medium text-fg truncate">{phase.label}</span>
                                <div className="ml-auto shrink-0">
                                    <StepStatusIcon status={phase.status} />
                                </div>
                            </div>

                            {/* Step content */}
                            <div className="px-2 py-1.5 min-h-[56px] flex items-center justify-center">
                                {/* Script: show text preview */}
                                {phase.id === "script" && phase.result && (phase.status === "done" || phase.status === "review") && (
                                    <p className="text-[10px] text-fg leading-snug line-clamp-3">{phase.result}</p>
                                )}

                                {/* Scene: show image thumbnail */}
                                {phase.id === "scene" && phase.result && (phase.status === "done" || phase.status === "review") && (
                                    <img src={phase.result} alt="Escena" className="w-full h-14 rounded-sm object-cover" />
                                )}

                                {/* Audio: show waveform-like indicator */}
                                {phase.id === "audio" && phase.result && (phase.status === "done" || phase.status === "review") && (
                                    <div className="flex items-center gap-1.5 w-full">
                                        <div className="w-7 h-7 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                                            <Play size={10} className="text-success ml-0.5" />
                                        </div>
                                        <div className="flex-1 flex items-end gap-px h-5">
                                            {[3, 5, 8, 4, 7, 3, 6, 4, 5, 7, 3, 5, 8, 4].map((h, i) => (
                                                <div key={i} className="flex-1 bg-success/30 rounded-sm" style={{ height: `${h * 2.2}px` }} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* LipSync: show video frame indicator */}
                                {phase.id === "lipsync" && phase.result && (phase.status === "done" || phase.status === "review") && (
                                    <div className="flex flex-col items-center gap-1">
                                        <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                                            <Play size={14} className="text-success ml-0.5" />
                                        </div>
                                        <span className="text-[9px] text-success">Video listo</span>
                                    </div>
                                )}

                                {/* Generic done without result */}
                                {phase.status === "done" && !phase.result && (
                                    <span className="text-[10px] text-success">✓ Listo</span>
                                )}

                                {phase.status === "running" && (
                                    <div className="flex flex-col items-center gap-1">
                                        <Loader2 size={14} className="animate-spin text-[var(--color-warm)]" />
                                        <span className="text-[9px] text-fg-faint">Procesando...</span>
                                    </div>
                                )}
                                {phase.status === "review" && !phase.result && (
                                    <span className="text-[10px] text-warning font-medium">Revisar</span>
                                )}
                                {phase.status === "error" && (
                                    <div className="flex flex-col items-center gap-0.5">
                                        <AlertCircle size={14} className="text-error" />
                                        <span className="text-[9px] text-error text-center">{phase.error || "Error"}</span>
                                    </div>
                                )}
                                {phase.status === "pending" && (
                                    <span className="text-[10px] text-fg-faint">Esperando</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Row 4: Footer */}
                <div className="flex items-center justify-between pt-0.5">
                    <span className="text-[10px] text-fg-faint font-mono">{gen.id}</span>
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        {gen.status === "completed" && gen.finalVideoUrl && (
                            <>
                                <a href={gen.finalVideoUrl} target="_blank" rel="noopener noreferrer">
                                    <button className="cursor-pointer flex items-center gap-1.5 h-7 px-2.5 rounded border border-edge bg-surface-0 text-[11px] font-medium text-fg-muted hover:text-fg hover:border-edge-strong transition-all">
                                        <Play size={11} /> Play
                                    </button>
                                </a>
                                <a href={gen.finalVideoUrl} download>
                                    <button className="cursor-pointer flex items-center gap-1 h-7 px-2 rounded border border-edge bg-surface-0 text-fg-faint hover:text-fg hover:border-edge-strong transition-all">
                                        <Download size={11} />
                                    </button>
                                </a>
                            </>
                        )}
                        {gen.status === "failed" && onRestart && (
                            <button
                                onClick={() => onRestart(gen.id)}
                                className="cursor-pointer flex items-center gap-1.5 h-7 px-2.5 rounded border border-edge bg-surface-0 text-[11px] font-medium text-fg-muted hover:text-fg hover:border-edge-strong transition-all"
                            >
                                <RotateCcw size={11} /> Reintentar
                            </button>
                        )}
                        {onDelete && (
                            <button
                                onClick={() => onDelete(gen.id)}
                                className="cursor-pointer flex items-center gap-1 h-7 px-2 rounded border border-edge bg-surface-0 text-fg-faint hover:text-fg hover:border-edge-strong transition-all opacity-0 group-hover:opacity-100"
                                title="Eliminar"
                            >
                                <Trash2 size={11} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
