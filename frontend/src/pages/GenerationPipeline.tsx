import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router";
import { Button } from "../components/ui/button";
import {
    ArrowLeft, Play, CheckCircle2, Loader2, Circle,
    Sparkles, Mic, Video, Film, SplitSquareHorizontal,
    Image, ChevronDown, ChevronUp,
} from "lucide-react";

// --- Types ---
type StepStatus = "idle" | "running" | "done" | "error";

interface PipelineStep {
    id: string;
    label: string;
    description: string;
    icon: React.ReactNode;
    status: StepStatus;
    result?: string;
    duration?: number;
}

interface ScriptSegment {
    id: number;
    text: string;
}

// --- Mock Data ---
const MOCK_FULL_SCRIPT =
    "Are you looking for everyday t-shirts? Taller Santa Clara has the best fit for your daily routine. Our organic cotton feels incredible on your skin.";

function splitScript(script: string, parts: number): ScriptSegment[] {
    if (parts === 1) return [{ id: 1, text: script }];
    const sentences = script.match(/[^.!?]+[.!?]+/g) || [script];
    const segments: ScriptSegment[] = [];
    const perPart = Math.ceil(sentences.length / parts);
    for (let i = 0; i < parts; i++) {
        const chunk = sentences.slice(i * perPart, (i + 1) * perPart).join("").trim();
        if (chunk) segments.push({ id: i + 1, text: chunk });
    }
    return segments;
}

// --- Mock Timers ---
function useMockPipeline() {
    const [steps, setSteps] = useState<PipelineStep[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [currentStep, setCurrentStep] = useState(-1);

    const initSteps = useCallback((segments: ScriptSegment[]): PipelineStep[] => {
        const base: PipelineStep[] = [];

        if (segments.length > 1) {
            base.push({
                id: "split",
                label: "Script Splitting",
                description: `Splitting script into ${segments.length} segments`,
                icon: <SplitSquareHorizontal size={18} />,
                status: "idle",
            });
        }

        base.push({
            id: "image",
            label: "Image Generation",
            description: "Generating product visuals with Nano Banana 2",
            icon: <Image size={18} />,
            status: "idle",
        });

        segments.forEach((seg) => {
            base.push({
                id: `audio-${seg.id}`,
                label: segments.length > 1 ? `Audio — Segment ${seg.id}` : "Voice Generation",
                description: `ElevenLabs: "${seg.text.slice(0, 50)}..."`,
                icon: <Mic size={18} />,
                status: "idle",
            });
        });

        segments.forEach((seg) => {
            base.push({
                id: `lipsync-${seg.id}`,
                label: segments.length > 1 ? `Lip Sync — Segment ${seg.id}` : "Lip Sync Video",
                description: "HeyGen avatar synced with audio",
                icon: <Video size={18} />,
                status: "idle",
            });
        });

        base.push({
            id: "render",
            label: "Final Render",
            description: segments.length > 1
                ? "FFmpeg: stitching all clips into 9:16 final video"
                : "FFmpeg: exporting 9:16 final video",
            icon: <Film size={18} />,
            status: "idle",
        });

        return base;
    }, []);

    const start = useCallback((segments: ScriptSegment[]) => {
        const initial = initSteps(segments);
        setSteps(initial);
        setCurrentStep(0);
        setIsRunning(true);
    }, [initSteps]);

    // Advance mock steps
    useEffect(() => {
        if (!isRunning || currentStep < 0 || currentStep >= steps.length) return;

        // Mark current as running
        setSteps((prev) =>
            prev.map((s, i) => (i === currentStep ? { ...s, status: "running" } : s))
        );

        const mockDurations: Record<string, number> = {
            split: 800,
            image: 2500,
            render: 2000,
        };

        const id = steps[currentStep]?.id || "";
        const baseDuration = id.startsWith("audio")
            ? 1800
            : id.startsWith("lipsync")
                ? 3000
                : mockDurations[id] || 1500;

        const duration = baseDuration + Math.random() * 500;

        const timer = setTimeout(() => {
            setSteps((prev) =>
                prev.map((s, i) =>
                    i === currentStep
                        ? { ...s, status: "done", duration: Math.round(duration / 1000 * 10) / 10 }
                        : s
                )
            );
            if (currentStep + 1 < steps.length) {
                setCurrentStep((c) => c + 1);
            } else {
                setIsRunning(false);
            }
        }, duration);

        return () => clearTimeout(timer);
    }, [isRunning, currentStep, steps.length]);

    const isDone = !isRunning && steps.length > 0 && steps.every((s) => s.status === "done");

    return { steps, start, isRunning, isDone };
}

// --- Component ---
export function GenerationPipeline() {
    const { brandId } = useParams();
    const [clipCount, setClipCount] = useState<1 | 2 | 3>(1);
    const [segments, setSegments] = useState<ScriptSegment[]>(splitScript(MOCK_FULL_SCRIPT, 1));
    const [started, setStarted] = useState(false);
    const [showSegments, setShowSegments] = useState(false);
    const { steps, start, isRunning, isDone } = useMockPipeline();

    const handleClipChange = (count: 1 | 2 | 3) => {
        setClipCount(count);
        setSegments(splitScript(MOCK_FULL_SCRIPT, count));
    };

    const handleStart = () => {
        setStarted(true);
        start(segments);
    };

    const statusIcon = (status: StepStatus) => {
        switch (status) {
            case "done":
                return <CheckCircle2 size={18} className="text-success" />;
            case "running":
                return <Loader2 size={18} className="text-primary-accent animate-spin" />;
            case "error":
                return <Circle size={18} className="text-error" />;
            default:
                return <Circle size={18} className="text-border-color" />;
        }
    };

    const progress = steps.length > 0
        ? Math.round((steps.filter((s) => s.status === "done").length / steps.length) * 100)
        : 0;

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            {/* Header */}
            <div>
                <Link
                    to={`/dashboard/brands/${brandId}`}
                    className="text-sm font-medium text-text-secondary hover:text-text-primary flex items-center gap-1 w-fit mb-2"
                >
                    <ArrowLeft size={16} /> Back to Workspace
                </Link>
                <h1 className="text-[28px] font-bold tracking-tight text-text-primary">
                    Generation Pipeline
                </h1>
                <p className="text-text-secondary text-sm mt-1">
                    Simulate the full UGC video generation flow.
                </p>
            </div>

            {/* Script Preview */}
            <div className="border border-border rounded-xl bg-card-bg shadow-sm overflow-hidden">
                <div className="p-5 border-b border-border">
                    <p className="text-xs uppercase tracking-wider text-text-secondary font-medium mb-2">Script</p>
                    <p className="text-sm text-text-primary leading-relaxed">{MOCK_FULL_SCRIPT}</p>
                </div>

                {/* Clip Split Option */}
                <div className="p-5 border-b border-border bg-primary-bg/50">
                    <p className="text-xs uppercase tracking-wider text-text-secondary font-medium mb-3">
                        Clip Mode
                    </p>
                    <div className="flex gap-3">
                        {([1, 2, 3] as const).map((n) => (
                            <button
                                key={n}
                                onClick={() => handleClipChange(n)}
                                disabled={started}
                                className={`cursor-pointer flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-all ${clipCount === n
                                    ? "border-primary-accent bg-primary-accent/5 text-primary-accent"
                                    : "border-border bg-card-bg text-text-secondary hover:text-text-primary hover:border-text-secondary"
                                    } ${started ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                                <div className="flex flex-col items-center gap-1">
                                    <SplitSquareHorizontal size={20} />
                                    <span>{n === 1 ? "Single Clip" : `${n} Segments`}</span>
                                    <span className="text-xs font-normal">
                                        {n === 1 ? "One continuous video" : `Split into ${n} parts, then stitch`}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Segment Preview */}
                {clipCount > 1 && (
                    <div className="px-5 py-3 border-b border-border">
                        <button
                            onClick={() => setShowSegments(!showSegments)}
                            className="cursor-pointer flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors w-full"
                        >
                            {showSegments ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            <span className="font-medium">Preview {segments.length} segments</span>
                        </button>
                        {showSegments && (
                            <div className="mt-3 space-y-2">
                                {segments.map((seg) => (
                                    <div
                                        key={seg.id}
                                        className="flex gap-3 items-start p-3 rounded-lg bg-primary-bg border border-border"
                                    >
                                        <span className="text-xs font-bold text-primary-accent bg-primary-accent/10 rounded px-2 py-0.5 shrink-0">
                                            #{seg.id}
                                        </span>
                                        <p className="text-sm text-text-primary leading-relaxed">{seg.text}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Start Button */}
                {!started && (
                    <div className="p-5">
                        <Button
                            className="w-full flex items-center justify-center gap-2 h-12 text-base"
                            variant="default"
                            onClick={handleStart}
                        >
                            <Play size={18} /> Start Generation Pipeline
                        </Button>
                    </div>
                )}
            </div>

            {/* Pipeline Steps */}
            {started && (
                <div className="border border-border rounded-xl bg-card-bg shadow-sm overflow-hidden">
                    {/* Progress bar */}
                    <div className="p-5 border-b border-border">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-text-primary">
                                {isDone ? "✅ Pipeline Complete" : isRunning ? "Processing…" : "Ready"}
                            </span>
                            <span className="text-sm font-medium text-primary-accent">{progress}%</span>
                        </div>
                        <div className="h-2 bg-primary-bg rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary-accent rounded-full transition-all duration-500"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    {/* Steps */}
                    <div className="divide-y divide-border">
                        {steps.map((step) => (
                            <div
                                key={step.id}
                                className={`flex items-center gap-4 px-5 py-4 transition-colors ${step.status === "running" ? "bg-primary-accent/5" : ""
                                    }`}
                            >
                                <div className="shrink-0">{statusIcon(step.status)}</div>
                                <div className="shrink-0 w-8 h-8 bg-primary-bg border border-border rounded-lg flex items-center justify-center text-text-secondary">
                                    {step.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-text-primary">{step.label}</p>
                                    <p className="text-xs text-text-secondary truncate">{step.description}</p>
                                </div>
                                {step.duration && (
                                    <span className="text-xs text-text-secondary font-mono shrink-0">
                                        {step.duration}s
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Final Result */}
                    {isDone && (
                        <div className="p-5 border-t border-border bg-success/5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
                                    <Film size={20} className="text-success" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-text-primary">final_output.mp4</p>
                                    <p className="text-xs text-text-secondary">9:16 vertical • Ready for download</p>
                                </div>
                                <Button variant="default" className="flex gap-2 items-center">
                                    <Sparkles size={16} /> Download
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
