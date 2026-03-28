/**
 * ActivePipelineDrawer — A slide-over panel that shows a live pipeline execution.
 * Each step displays its status, result (script text, audio player, image, video),
 * and QA approve/retry controls before advancing to the next stage.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import {
    X, FileText, Image, Mic, Video, Loader2, CheckCircle2,
    AlertCircle, ThumbsUp, RotateCcw, Play, Pause, Package, User, ChevronDown, ChevronUp,
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
    result?: string; // text/url result
    error?: string;
    duration?: number; // seconds
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

export function ActivePipelineDrawer({
    isOpen, onClose, launchData, brandId, voiceId,
    talkingPhotoId, lipsyncEngine, onComplete,
}: Props) {
    const [steps, setSteps] = useState<PipelineStepState[]>([]);
    const [currentStep, setCurrentStep] = useState(-1);
    const [expandedStep, setExpandedStep] = useState<string | null>(null);
    const abortRef = useRef(false);

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
                label: "Generación de Guion",
                description: "Gemini genera el script UGC basado en Brand DNA + producto + objetivo",
                icon: <FileText size={16} />,
                status: "pending",
            },
            {
                id: "image",
                label: "Composición Visual",
                description: "Nano Banana combina avatar + producto en una escena",
                icon: <Image size={16} />,
                status: "pending",
            },
            {
                id: "audio",
                label: "Locución (TTS)",
                description: "ElevenLabs genera el voiceover con la voz seleccionada",
                icon: <Mic size={16} />,
                status: "pending",
            },
            {
                id: "lipsync",
                label: "Lip Sync Video",
                description: lipsyncEngine === "heygen"
                    ? "HeyGen anima el avatar con el audio generado"
                    : "Fabric 1.0 aplica lip sync al avatar",
                icon: <Video size={16} />,
                status: "pending",
            },
        ];

        setSteps(initialSteps);
        setCurrentStep(0);
        setExpandedStep("script");
        setGeneratedScript("");
        setGeneratedImageUrl(null);
        setAudioUrl(null);
        setGeneratedVideoUrl(null);
    }, [launchData, isOpen, lipsyncEngine]);

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
            setExpandedStep("script");
        } catch (err: any) {
            updateStep("script", { status: "error", error: err.message || "Failed to generate script" });
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
                updateStep("image", { status: "error", error: "No images available for compositing" });
                return;
            }

            const prompt = `UGC video scene: ${launchData.productName}. ${generatedScript.substring(0, 200)}. Photorealistic, high quality, 9:16 portrait.`;

            const result = await createImageEdit(imageUrls, prompt);

            if (abortRef.current) return;

            if (result.status === "completed" && result.image_url) {
                const elapsed = (Date.now() - startTime) / 1000;
                setGeneratedImageUrl(result.image_url);
                updateStep("image", {
                    status: "review",
                    result: result.image_url,
                    duration: Math.round(elapsed * 10) / 10,
                });
                setExpandedStep("image");
                return;
            }

            // Poll for completion
            updateStep("image", { status: "running", description: "Generando imagen... (30-60s)" });
            const finalResult = await pollImageGen(result.request_id, (status) => {
                updateStep("image", { description: `Estado: ${status.status}...` });
            });

            if (abortRef.current) return;

            if (finalResult.status === "completed" && finalResult.image_url) {
                const elapsed = (Date.now() - startTime) / 1000;
                setGeneratedImageUrl(finalResult.image_url);
                updateStep("image", {
                    status: "review",
                    result: finalResult.image_url,
                    duration: Math.round(elapsed * 10) / 10,
                });
                setExpandedStep("image");
            } else {
                throw new Error(finalResult.error || "Image generation failed");
            }
        } catch (err: any) {
            updateStep("image", { status: "error", error: err.message || "Image generation failed" });
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

            const audioBlob = result.audioBlob;
            const url = URL.createObjectURL(audioBlob);
            const elapsed = (Date.now() - startTime) / 1000;
            setAudioUrl(url);
            updateStep("audio", {
                status: "review",
                result: url,
                duration: Math.round(elapsed * 10) / 10,
            });
            setExpandedStep("audio");
        } catch (err: any) {
            updateStep("audio", { status: "error", error: err.message || "Audio generation failed" });
        }
    }, [generatedScript, voiceId, updateStep]);

    // ── Step 4: Lip Sync ──
    const runLipSync = useCallback(async () => {
        if (!audioUrl || !talkingPhotoId) {
            updateStep("lipsync", { status: "error", error: "Missing audio or avatar for lip sync" });
            return;
        }
        updateStep("lipsync", { status: "running" });
        const startTime = Date.now();

        try {
            // For HeyGen lip sync, we'd need to fetch the audio blob from the URL
            // For now, mark as pending since this depends on the audio blob
            updateStep("lipsync", { status: "running", description: "Iniciando lip sync..." });

            // TODO: Full lip sync integration
            // This would involve creating the lip sync job and polling for completion
            // For now, show a simulated completion after a delay
            await new Promise(resolve => setTimeout(resolve, 3000));

            if (abortRef.current) return;

            const elapsed = (Date.now() - startTime) / 1000;
            updateStep("lipsync", {
                status: "review",
                result: "Lip sync completed (demo)",
                duration: Math.round(elapsed * 10) / 10,
            });
            setExpandedStep("lipsync");
        } catch (err: any) {
            updateStep("lipsync", { status: "error", error: err.message || "Lip sync failed" });
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
            setExpandedStep(steps[stepIndex + 1].id);
        } else {
            // All done!
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
        if (audioPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setAudioPlaying(!audioPlaying);
    };

    const handleClose = () => {
        abortRef.current = true;
        if (audioRef.current) {
            audioRef.current.pause();
        }
        onClose();
    };

    if (!isOpen || !launchData) return null;

    const allDone = steps.length > 0 && steps.every(s => s.status === "done");
    const progress = steps.length ? Math.round((steps.filter(s => s.status === "done").length / steps.length) * 100) : 0;

    return (
        <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

            <div className="relative w-full max-w-2xl h-full bg-surface-0 shadow-2xl border-l border-edge flex flex-col animate-in slide-in-from-right-full duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-edge shrink-0">
                    <div>
                        <h2 className="text-[18px] font-semibold text-fg tracking-tight">Pipeline en Ejecución</h2>
                        <div className="flex items-center gap-3 mt-1.5">
                            <span className="flex items-center gap-1.5 text-[12px] text-fg-faint">
                                <User size={11} /> {launchData.avatarName}
                            </span>
                            <span className="flex items-center gap-1.5 text-[12px] text-fg-faint">
                                <Package size={11} /> {launchData.productName}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                allDone
                                    ? "bg-success/10 text-success"
                                    : "bg-warning/10 text-warning"
                            }`}>
                                {allDone ? "Completado" : `${progress}%`}
                            </span>
                        </div>
                    </div>
                    <button onClick={handleClose} className="cursor-pointer w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-2 text-fg-muted hover:text-fg transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Progress bar */}
                <div className="h-1 bg-surface-2 shrink-0">
                    <div
                        className="h-full bg-[var(--color-warm)] transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Steps List */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    {steps.map((step) => {
                        const isExpanded = expandedStep === step.id;
                        const statusIcon = step.status === "done"
                            ? <CheckCircle2 size={16} className="text-success" />
                            : step.status === "running"
                                ? <Loader2 size={16} className="animate-spin text-[var(--color-warm)]" />
                                : step.status === "review"
                                    ? <ThumbsUp size={16} className="text-warning" />
                                    : step.status === "error"
                                        ? <AlertCircle size={16} className="text-error" />
                                        : <div className="w-4 h-4 rounded-full border-2 border-edge" />;

                        return (
                            <div
                                key={step.id}
                                className={`border rounded-[var(--radius-md)] overflow-hidden transition-all ${
                                    step.status === "review"
                                        ? "border-warning/40 bg-warning/5"
                                        : step.status === "error"
                                            ? "border-error/40 bg-error/5"
                                            : step.status === "done"
                                                ? "border-success/20 bg-surface-0"
                                                : "border-edge bg-surface-0"
                                }`}
                            >
                                {/* Step header */}
                                <button
                                    onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                                    className="cursor-pointer w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-1/50 transition-colors"
                                >
                                    {statusIcon}
                                    <div className="flex-1 text-left min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[13px] font-medium text-fg">{step.label}</span>
                                            {step.duration && (
                                                <span className="text-[10px] text-fg-faint">{step.duration}s</span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-fg-faint truncate">{step.description}</p>
                                    </div>
                                    {isExpanded ? <ChevronUp size={14} className="text-fg-faint" /> : <ChevronDown size={14} className="text-fg-faint" />}
                                </button>

                                {/* Expanded content */}
                                {isExpanded && (
                                    <div className="px-4 pb-4 space-y-3 border-t border-edge-subtle">
                                        {/* ── Script result ── */}
                                        {step.id === "script" && generatedScript && (
                                            <div className="mt-3">
                                                <p className="text-[11px] text-fg-faint mb-2 uppercase tracking-wider">Guion generado</p>
                                                <div className="bg-surface-1 border border-edge rounded-[var(--radius-sm)] p-3">
                                                    <p className="text-[13px] text-fg leading-relaxed whitespace-pre-wrap">{generatedScript}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* ── Image result ── */}
                                        {step.id === "image" && generatedImageUrl && (
                                            <div className="mt-3">
                                                <p className="text-[11px] text-fg-faint mb-2 uppercase tracking-wider">Imagen generada</p>
                                                <div className="rounded-[var(--radius-md)] overflow-hidden border border-edge max-w-[280px]">
                                                    <img src={generatedImageUrl} alt="Generated scene" className="w-full aspect-[9/16] object-cover" />
                                                </div>
                                            </div>
                                        )}

                                        {/* ── Audio result ── */}
                                        {step.id === "audio" && audioUrl && (
                                            <div className="mt-3">
                                                <p className="text-[11px] text-fg-faint mb-2 uppercase tracking-wider">Audio generado</p>
                                                <audio ref={audioRef} src={audioUrl} onEnded={() => setAudioPlaying(false)} className="hidden" />
                                                <div className="flex items-center gap-3 bg-surface-1 border border-edge rounded-[var(--radius-md)] p-3">
                                                    <button
                                                        onClick={toggleAudio}
                                                        className="cursor-pointer w-10 h-10 rounded-full bg-[var(--color-warm)] text-white flex items-center justify-center hover:opacity-90 transition-opacity shrink-0"
                                                    >
                                                        {audioPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                                                    </button>
                                                    <div className="flex-1">
                                                        <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                                                            <div className={`h-full bg-[var(--color-warm)] rounded-full ${audioPlaying ? "animate-pulse w-2/3" : "w-0"} transition-all`} />
                                                        </div>
                                                        <p className="text-[10px] text-fg-faint mt-1">Reproducir para revisar</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* ── Video result ── */}
                                        {step.id === "lipsync" && step.status === "review" && (
                                            <div className="mt-3">
                                                <p className="text-[11px] text-fg-faint mb-2 uppercase tracking-wider">Lip sync generado</p>
                                                <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-4 text-center">
                                                    <Video size={24} className="text-fg-faint mx-auto mb-2" />
                                                    <p className="text-[12px] text-fg-muted">Video lip sync listo para revisión</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* ── Error ── */}
                                        {step.error && (
                                            <div className="mt-3 flex items-start gap-2 bg-error/5 border border-error/20 rounded-[var(--radius-sm)] p-3">
                                                <AlertCircle size={14} className="text-error mt-0.5 shrink-0" />
                                                <p className="text-[12px] text-error">{step.error}</p>
                                            </div>
                                        )}

                                        {/* ── Running indicator ── */}
                                        {step.status === "running" && (
                                            <div className="mt-3 flex items-center gap-2 py-3">
                                                <Loader2 size={14} className="animate-spin text-[var(--color-warm)]" />
                                                <span className="text-[12px] text-fg-muted">Procesando...</span>
                                            </div>
                                        )}

                                        {/* ── Action buttons ── */}
                                        {step.status === "review" && (
                                            <div className="mt-3 flex items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    className="gap-1.5 h-8 px-4 text-[12px] bg-success hover:bg-success/90 text-white"
                                                    onClick={() => handleApprove(step.id)}
                                                >
                                                    <ThumbsUp size={12} /> Aprobar y continuar
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-1.5 h-8 px-3 text-[12px]"
                                                    onClick={() => handleRetry(step.id)}
                                                >
                                                    <RotateCcw size={12} /> Reintentar
                                                </Button>
                                            </div>
                                        )}

                                        {step.status === "error" && (
                                            <div className="mt-3">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-1.5 h-8 px-3 text-[12px]"
                                                    onClick={() => handleRetry(step.id)}
                                                >
                                                    <RotateCcw size={12} /> Reintentar
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* All done celebration */}
                    {allDone && (
                        <div className="mt-6 text-center py-8 border border-success/20 rounded-[var(--radius-md)] bg-success/5">
                            <CheckCircle2 size={32} className="text-success mx-auto mb-3" />
                            <h3 className="text-[16px] font-semibold text-fg">¡Pipeline Completado!</h3>
                            <p className="text-[13px] text-fg-muted mt-1">Todos los pasos se ejecutaron correctamente.</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-edge bg-surface-0 shrink-0 flex items-center justify-between">
                    <Button variant="ghost" onClick={handleClose} className="text-fg-secondary">
                        {allDone ? "Cerrar" : "Cancelar"}
                    </Button>
                    {allDone && (
                        <Button className="gap-2" variant="default">
                            <Play size={14} /> Ver Video Final
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
