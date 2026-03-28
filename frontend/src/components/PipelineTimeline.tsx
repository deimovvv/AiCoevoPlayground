/**
 * PipelineTimeline — Horizontal dot-line timeline for a generation card.
 * Shows each phase as a dot connected by lines.
 *
 * ●──●──◐──○──○
 */
import { Mic, Film, Video, Sparkles, CheckCircle2, Loader2 } from "lucide-react";

export type PhaseStatus = "pending" | "running" | "done" | "error";

export interface Phase {
    id: string;
    label: string;
    status: PhaseStatus;
    progress?: number; // 0-100 for running phases
}

interface Props {
    phases: Phase[];
    compact?: boolean; // for smaller card view
}

const phaseIcon = (id: string, size: number) => {
    switch (id) {
        case "script": return <Sparkles size={size} />;
        case "audio": return <Mic size={size} />;
        case "scene": return <Film size={size} />;
        case "lipsync": return <Video size={size} />;
        case "render": return <CheckCircle2 size={size} />;
        default: return <Sparkles size={size} />;
    }
};

export function PipelineTimeline({ phases, compact }: Props) {
    const dotSize = compact ? 28 : 32;
    const iconSize = compact ? 12 : 14;

    return (
        <div className="flex items-center gap-0 w-full">
            {phases.map((phase, idx) => {
                const isDone = phase.status === "done";
                const isRunning = phase.status === "running";
                const isError = phase.status === "error";

                // Color classes
                const dotBg = isDone
                    ? "bg-success/15 border-success/40"
                    : isRunning
                        ? "bg-warning/15 border-warning/40"
                        : isError
                            ? "bg-error/15 border-error/40"
                            : "bg-surface-2 border-edge";

                const dotText = isDone
                    ? "text-success"
                    : isRunning
                        ? "text-warning"
                        : isError
                            ? "text-error"
                            : "text-fg-faint";

                const lineColor = isDone
                    ? "bg-success/30"
                    : "bg-edge";

                return (
                    <div key={phase.id} className="flex items-center flex-1 min-w-0">
                        {/* Dot + Label column */}
                        <div className="flex flex-col items-center gap-1 group relative">
                            {/* Dot */}
                            <div
                                className={`flex items-center justify-center rounded-full border transition-all ${dotBg} ${dotText} ${isRunning ? "animate-pulse" : ""}`}
                                style={{ width: dotSize, height: dotSize }}
                            >
                                {isRunning ? (
                                    <Loader2 size={iconSize} className="animate-spin" />
                                ) : isDone ? (
                                    <CheckCircle2 size={iconSize} />
                                ) : (
                                    phaseIcon(phase.id, iconSize)
                                )}
                            </div>
                            {/* Label */}
                            {!compact && (
                                <span className={`text-[10px] font-medium tracking-wide whitespace-nowrap ${isDone ? "text-fg-secondary" : isRunning ? "text-warning" : "text-fg-faint"}`}>
                                    {phase.label}
                                </span>
                            )}
                            {/* Tooltip for compact */}
                            {compact && (
                                <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                    <span className="text-[10px] bg-surface-3 text-fg-secondary border border-edge px-1.5 py-0.5 rounded whitespace-nowrap">
                                        {phase.label}
                                    </span>
                                </div>
                            )}
                        </div>
                        {/* Connecting line */}
                        {idx < phases.length - 1 && (
                            <div className={`flex-1 h-[2px] mx-1 rounded-full transition-colors ${lineColor}`} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
