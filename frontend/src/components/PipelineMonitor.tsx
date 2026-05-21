/**
 * PipelineMonitor — Horizontal inline pipeline view.
 * Each step is a column: step name on top, result card below.
 * Flows left-to-right, scrollable horizontally.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import {
    X, FileText, Image, Mic, Video, Loader2, CheckCircle2,
    AlertCircle, ThumbsUp, RotateCcw, Play, Pause, Package, User,
    ChevronRight,
} from "lucide-react";
import { Button } from "./ui/button";
import {
    generateCopy, generateTTS, createImageEdit, pollImageGen,
} from "../lib/api";

// ── Types ──

export interface WizardLaunchResult {
    avatarId: string;
    avatarName: string;
    avatarImageUrl?: string;
    productId: string;
    productName: string;
    productImageUrl?: string;
    videoObjective: string;
}

type StepStatus = "pending" | "running" | "done" | "review" | "error";

interface PipelineStepState {
    id: string;
    label: string;
    description: string;
    icon: React.ReactNode;
    status: StepStatus;
    result?: string;
    error?: string;
    duration?: number;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    launchData: WizardLaunchResult | null;
    brandId: string;
    voiceId: string;
    talkingPhotoId?: string;
    lipsyncEngine: "heygen" | "fabric";
    onComplete?: (finalVideoUrl: string) => void;
}

export function PipelineMonitor({
    isOpen, onClose, launchData, brandId, voiceId,
    talkingPhotoId, lipsyncEngine, onComplete,
}: Props) {
    const [steps, setSteps] = useState<PipelineStepState[]>([]);
    const [currentStep, setCurrentStep] = useState(-1);
    const abortRef = useRef(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Audio state
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [audioPlaying, setAudioPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Script result
    const [generatedScript, setGeneratedScript] = useState("");

    // Image result
    const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

    // Video result
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);

    // Initialize steps when launchData changes
    useEffect(() => {
        if (!launchData || !isOpen) return;
        abortRef.current = false;

        const initialSteps: PipelineStepState[] = [
            {
                id: "script",
                label: "Guion",
                description: "Gemini genera el script UGC",
                icon: <FileText size={18} />,
                status: "pending",
            },
            {
                id: "image",
                label: "Composición",
                description: "Nano Banana — avatar + producto",
                icon: <Image size={18} />,
                status: "pending",
            },
            {
                id: "audio",
                label: "Locución",
                description: "ElevenLabs TTS",
                icon: <Mic size={18} />,
                status: "pending",
            },
            {
                id: "lipsync",
                label: "Lip Sync",
                description: lipsyncEngine === "heygen" ? "HeyGen" : "Fabric 1.0",
                icon: <Video size={18} />,
                status: "pending",
            },
        ];

        setSteps(initialSteps);
        setCurrentStep(0);
        setGeneratedScript("");
        setGeneratedImageUrl(null);
        setAudioUrl(null);
        setGeneratedVideoUrl(null);
    }, [launchData, isOpen, lipsyncEngine]);

    // Auto-scroll to active step
    useEffect(() => {
        if (currentStep >= 0 && scrollRef.current) {
            const cards = scrollRef.current.children;
            const activeCard = cards[currentStep] as HTMLElement;
            if (activeCard) {
                activeCard.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
            }
        }
    }, [currentStep]);

    // Update step helper
    const updateStep = useCallback((id: string, patch: Partial<PipelineStepState>) => {
        setSteps(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
    }, []);

    // ── Step 1: Generate Script ──
    const runScriptGeneration = useCallback(async () => {
        if (!launchData || !brandId) return;
        updateStep("script", { status: "running" });
        const startTime = Date.now();

        try {
            const result = await generateCopy(brandId, {
                productName: launchData.productName,
                tone: "engaging",
                platform: "tiktok",
                language: "es",
                additionalNotes: launchData.videoObjective,
                count: 1,
            });

            if (abortRef.current) return;
            const script = result.scripts[0] || "Script generation returned empty.";
            const elapsed = (Date.now() - startTime) / 1000;
            setGeneratedScript(script);
            updateStep("script", {
                status: "review",
                result: script,
                duration: Math.round(elapsed * 10) / 10,
            });
        } catch (err: any) {
            updateStep("script", { status: "error", error: err.message || "Failed" });
        }
    }, [launchData, brandId, updateStep]);

    // ── Step 2: Generate Image ──
    const runImageGeneration = useCallback(async () => {
        if (!launchData) return;
        updateStep("image", { status: "running" });
        const startTime = Date.now();

        try {
            const imageUrls: string[] = [];
            if (launchData.avatarImageUrl) imageUrls.push(launchData.avatarImageUrl);
            if (launchData.productImageUrl) imageUrls.push(launchData.productImageUrl);

            if (imageUrls.length === 0) {
                updateStep("image", { status: "error", error: "No hay imágenes disponibles" });
                return;
            }

            const prompt = `UGC video scene: ${launchData.productName}. ${generatedScript.substring(0, 200)}. Photorealistic, high quality, 9:16 portrait.`;
            const result = await createImageEdit(imageUrls, prompt);

            if (abortRef.current) return;

            if (result.status === "completed" && result.image_url) {
                const elapsed = (Date.now() - startTime) / 1000;
                setGeneratedImageUrl(result.image_url);
                updateStep("image", { status: "review", result: result.image_url, duration: Math.round(elapsed * 10) / 10 });
                return;
            }

            updateStep("image", { description: "Generando... (30-60s)" });
            const finalResult = await pollImageGen(result.request_id, (status) => {
                updateStep("image", { description: `${status.status}...` });
            });

            if (abortRef.current) return;

            if (finalResult.status === "completed" && finalResult.image_url) {
                const elapsed = (Date.now() - startTime) / 1000;
                setGeneratedImageUrl(finalResult.image_url);
                updateStep("image", { status: "review", result: finalResult.image_url, duration: Math.round(elapsed * 10) / 10 });
            } else {
                throw new Error(finalResult.error || "Image generation failed");
            }
        } catch (err: any) {
            updateStep("image", { status: "error", error: err.message || "Failed" });
        }
    }, [launchData, generatedScript, updateStep]);

    // ── Step 3: Generate Audio ──
    const runAudioGeneration = useCallback(async () => {
        if (!generatedScript) return;
        updateStep("audio", { status: "running" });
        const startTime = Date.now();

        try {
            const result = await generateTTS({
                text: generatedScript,
                voice_id: voiceId,
            });

            if (abortRef.current) return;

            const url = URL.createObjectURL(result.audioBlob);
            const elapsed = (Date.now() - startTime) / 1000;
            setAudioUrl(url);
            updateStep("audio", { status: "review", result: url, duration: Math.round(elapsed * 10) / 10 });
        } catch (err: any) {
            updateStep("audio", { status: "error", error: err.message || "Failed" });
        }
    }, [generatedScript, voiceId, updateStep]);

    // ── Step 4: Lip Sync ──
    const runLipSync = useCallback(async () => {
        if (!audioUrl || !talkingPhotoId) {
            updateStep("lipsync", { status: "error", error: "Falta audio o avatar" });
            return;
        }
        updateStep("lipsync", { status: "running" });
        const startTime = Date.now();

        try {
            updateStep("lipsync", { description: "Iniciando lip sync..." });
            // TODO: Full integration
            await new Promise(resolve => setTimeout(resolve, 3000));
            if (abortRef.current) return;

            const elapsed = (Date.now() - startTime) / 1000;
            updateStep("lipsync", { status: "review", result: "demo", duration: Math.round(elapsed * 10) / 10 });
        } catch (err: any) {
            updateStep("lipsync", { status: "error", error: err.message || "Failed" });
        }
    }, [audioUrl, talkingPhotoId, updateStep]);

    // ── Run current step ──
    useEffect(() => {
        if (currentStep < 0 || !launchData) return;
        const step = steps[currentStep];
        if (!step || step.status !== "pending") return;

        switch (step.id) {
            case "script": runScriptGeneration(); break;
            case "image": runImageGeneration(); break;
            case "audio": runAudioGeneration(); break;
            case "lipsync": runLipSync(); break;
        }
    }, [currentStep, steps, launchData, runScriptGeneration, runImageGeneration, runAudioGeneration, runLipSync]);

    // ── Actions ──
    const handleApprove = (stepId: string) => {
        updateStep(stepId, { status: "done" });
        const stepIndex = steps.findIndex(s => s.id === stepId);
        if (stepIndex < steps.length - 1) {
            setCurrentStep(stepIndex + 1);
        } else {
            onComplete?.(generatedVideoUrl || "");
        }
    };

    const handleRetry = (stepId: string) => {
        updateStep(stepId, { status: "pending", error: undefined, result: undefined });
        const stepIndex = steps.findIndex(s => s.id === stepId);
        setCurrentStep(stepIndex);
    };

    const toggleAudio = () => {
        if (!audioRef.current) return;
        if (audioPlaying) audioRef.current.pause();
        else audioRef.current.play();
        setAudioPlaying(!audioPlaying);
    };

    const handleClose = () => {
        abortRef.current = true;
        if (audioRef.current) audioRef.current.pause();
        onClose();
    };

    if (!isOpen || !launchData) return null;

    const allDone = steps.length > 0 && steps.every(s => s.status === "done");
    const progress = steps.length ? Math.round((steps.filter(s => s.status === "done").length / steps.length) * 100) : 0;

    // Status styling
    const getStatusColor = (status: StepStatus) => {
        switch (status) {
            case "done": return "border-success/40 bg-success/5";
            case "running": return "border-[var(--color-action)]/40 bg-[var(--color-action)]/5";
            case "review": return "border-warning/40 bg-warning/5";
            case "error": return "border-error/40 bg-error/5";
            default: return "border-edge bg-surface-1/30";
        }
    };

    const getStepDotStyle = (status: StepStatus) => {
        switch (status) {
            case "done": return "bg-success text-white";
            case "running": return "bg-[var(--color-action)] text-[var(--color-action-fg)]";
            case "review": return "bg-warning text-black";
            case "error": return "bg-error text-white";
            default: return "bg-surface-2 text-fg-faint border border-edge";
        }
    };

    return (
        <div className="border border-edge rounded-[var(--radius-lg)] bg-surface-0 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-edge">
                <div className="flex items-center gap-4">
                    <div>
                        <h3 className="text-[15px] font-semibold text-fg">Pipeline en Ejecución</h3>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="flex items-center gap-1.5 text-[11px] text-fg-faint">
                                <User size={10} /> {launchData.avatarName}
                            </span>
                            <span className="flex items-center gap-1.5 text-[11px] text-fg-faint">
                                <Package size={10} /> {launchData.productName}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-[var(--color-action)] rounded-full transition-all duration-500"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <span className={`text-[11px] font-bold ${allDone ? "text-success" : "text-fg-muted"}`}>
                            {allDone ? "✓ Listo" : `${progress}%`}
                        </span>
                    </div>
                    <button onClick={handleClose} className="cursor-pointer w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-surface-2 text-fg-faint hover:text-fg transition-colors">
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Horizontal Steps */}
            <div className="overflow-x-auto" ref={scrollRef}>
                <div className="flex gap-0 p-5 min-w-max">
                    {steps.map((step, idx) => (
                        <div key={step.id} className="flex items-start">
                            {/* Step Column */}
                            <div className="flex flex-col items-center w-[280px]">
                                {/* Step indicator dot + label */}
                                <div className="flex flex-col items-center gap-2 mb-3">
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${getStepDotStyle(step.status)}`}>
                                        {step.status === "running" ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : step.status === "done" ? (
                                            <CheckCircle2 size={16} />
                                        ) : step.status === "review" ? (
                                            <ThumbsUp size={14} />
                                        ) : step.status === "error" ? (
                                            <AlertCircle size={16} />
                                        ) : (
                                            step.icon
                                        )}
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[13px] font-semibold text-fg">{step.label}</p>
                                        <p className="text-[10px] text-fg-faint">{step.description}</p>
                                        {step.duration && (
                                            <p className="text-[10px] text-fg-faint mt-0.5">{step.duration}s</p>
                                        )}
                                    </div>
                                </div>

                                {/* Result Card */}
                                <div className={`w-full border rounded-[var(--radius-md)] overflow-hidden transition-all min-h-[180px] flex flex-col ${getStatusColor(step.status)}`}>
                                    {/* ── Pending ── */}
                                    {step.status === "pending" && (
                                        <div className="flex-1 flex items-center justify-center p-4">
                                            <p className="text-[12px] text-fg-faint">Esperando...</p>
                                        </div>
                                    )}

                                    {/* ── Running ── */}
                                    {step.status === "running" && (
                                        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-2">
                                            <Loader2 size={20} className="animate-spin text-[var(--color-action)]" />
                                            <p className="text-[12px] text-fg-muted">Procesando...</p>
                                        </div>
                                    )}

                                    {/* ── Script result ── */}
                                    {step.id === "script" && generatedScript && (step.status === "review" || step.status === "done") && (
                                        <div className="p-3 flex-1 flex flex-col">
                                            <p className="text-[11px] text-fg leading-relaxed line-clamp-6 flex-1">{generatedScript}</p>
                                        </div>
                                    )}

                                    {/* ── Image result ── */}
                                    {step.id === "image" && generatedImageUrl && (step.status === "review" || step.status === "done") && (
                                        <div className="p-3 flex-1 flex items-center justify-center">
                                            <img src={generatedImageUrl} alt="Generated" className="max-h-[200px] rounded-[var(--radius-sm)] object-contain" />
                                        </div>
                                    )}

                                    {/* ── Audio result ── */}
                                    {step.id === "audio" && audioUrl && (step.status === "review" || step.status === "done") && (
                                        <div className="p-3 flex-1 flex flex-col items-center justify-center gap-2">
                                            <audio ref={audioRef} src={audioUrl} onEnded={() => setAudioPlaying(false)} className="hidden" />
                                            <button
                                                onClick={toggleAudio}
                                                className="cursor-pointer w-12 h-12 rounded-full bg-[var(--color-action)] text-[var(--color-action-fg)] flex items-center justify-center hover:opacity-90 transition-opacity"
                                            >
                                                {audioPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                                            </button>
                                            <div className="w-full max-w-[200px]">
                                                <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                                                    <div className={`h-full bg-[var(--color-action)] rounded-full ${audioPlaying ? "animate-pulse w-2/3" : "w-0"} transition-all`} />
                                                </div>
                                                <p className="text-[10px] text-fg-faint mt-1 text-center">{audioPlaying ? "Reproduciendo..." : "Escuchar audio"}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Lip Sync result ── */}
                                    {step.id === "lipsync" && (step.status === "review" || step.status === "done") && (
                                        <div className="p-3 flex-1 flex flex-col items-center justify-center gap-2">
                                            <Video size={24} className="text-fg-muted" />
                                            <p className="text-[12px] text-fg-muted">Video listo</p>
                                        </div>
                                    )}

                                    {/* ── Error ── */}
                                    {step.status === "error" && (
                                        <div className="p-3 flex-1 flex flex-col items-center justify-center gap-2">
                                            <AlertCircle size={20} className="text-error" />
                                            <p className="text-[11px] text-error text-center leading-snug">{step.error}</p>
                                        </div>
                                    )}

                                    {/* ── Action buttons ── */}
                                    {(step.status === "review" || step.status === "error") && (
                                        <div className="border-t border-edge-subtle px-3 py-2 flex items-center gap-2 shrink-0">
                                            {step.status === "review" && (
                                                <button
                                                    onClick={() => handleApprove(step.id)}
                                                    className="cursor-pointer flex-1 flex items-center justify-center gap-1.5 h-7 rounded-[var(--radius-sm)] bg-success text-white text-[11px] font-medium hover:bg-success/90 transition-colors"
                                                >
                                                    <ThumbsUp size={11} /> Aprobar
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleRetry(step.id)}
                                                className="cursor-pointer flex items-center justify-center gap-1.5 h-7 px-3 rounded-[var(--radius-sm)] border border-edge bg-surface-0 text-[11px] font-medium text-fg-muted hover:text-fg hover:border-edge-strong transition-all"
                                            >
                                                <RotateCcw size={11} /> Reintentar
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Arrow connector */}
                            {idx < steps.length - 1 && (
                                <div className="flex items-center justify-center px-3 pt-14 shrink-0">
                                    <div className={`flex items-center ${
                                        steps[idx + 1].status !== "pending" ? "text-fg-muted" : "text-edge"
                                    }`}>
                                        <div className={`w-8 h-px ${
                                            steps[idx + 1].status !== "pending" ? "bg-fg-muted" : "bg-edge"
                                        }`} />
                                        <ChevronRight size={14} />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* All done */}
            {allDone && (
                <div className="px-5 py-4 border-t border-edge flex items-center justify-between bg-success/5">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-success" />
                        <span className="text-[13px] font-medium text-fg">¡Pipeline Completado!</span>
                    </div>
                    <Button size="sm" className="gap-2 h-8" variant="default">
                        <Play size={12} /> Ver Video Final
                    </Button>
                </div>
            )}
        </div>
    );
}
