/**
 * GenerationDetailDrawer — Morfeo-style 3-column layout.
 * Left:   Product + Avatar + Voice
 * Center: Brief / Situación
 * Right:  Guión dividido en actos
 */
import { useState, useEffect } from "react";
import {
    X, RefreshCw, Save, User, Package, Mic, Play, Pause,
    CheckCircle2, Loader2, AlertCircle, ChevronRight,
    Sparkles, FileText, Image, Video, Volume2,
} from "lucide-react";
import { type Generation } from "./GenerationCard";
import { Button } from "./ui/button";

interface Props {
    generation: Generation | null;
    isOpen: boolean;
    onClose: () => void;
    onSaveContent: (id: string, newScript: string, selectedImage: number) => void;
}

const STATUS_LABELS: Record<string, string> = {
    completed: "Completado",
    running: "En proceso",
    failed: "Error",
    draft: "Borrador",
};

const STATUS_DOT: Record<string, string> = {
    completed: "bg-success",
    running: "bg-[var(--color-warm)] animate-pulse",
    failed: "bg-error",
    draft: "bg-fg-faint",
};

export function GenerationDetailDrawer({ generation, isOpen, onClose, onSaveContent }: Props) {
    const [scriptDraft, setScriptDraft] = useState("");
    const [selectedShots, setSelectedShots] = useState<Record<string, number>>({});

    useEffect(() => {
        if (generation) {
            setScriptDraft(generation.scriptText || "");
            const initialShots: Record<string, number> = {};
            generation.scenes?.forEach(scene => {
                initialShots[scene.id] = scene.selectedShotIndex ?? 0;
            });
            setSelectedShots(initialShots);
        }
    }, [generation]);

    if (!isOpen || !generation) return null;

    const gen = generation;
    const scriptPhase = gen.phases.find(p => p.id === "script");
    const scenePhase = gen.phases.find(p => p.id === "scene");
    const audioPhase = gen.phases.find(p => p.id === "audio");
    const lipsyncPhase = gen.phases.find(p => p.id === "lipsync");

    const handleSave = () => {
        onSaveContent(gen.id, scriptDraft, 0);
        onClose();
    };

    // Parse script into acts (split by newlines or manually structured)
    const scriptActs = parseScriptActs(gen.scriptText);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal — Wide 3-column layout */}
            <div className="relative w-full max-w-[1200px] max-h-[90vh] bg-surface-0 shadow-2xl border border-edge rounded-[var(--radius-lg)] flex flex-col overflow-hidden">

                {/* ── Header ── */}
                <div className="flex items-center justify-between px-6 py-3.5 border-b border-edge shrink-0">
                    <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[gen.status] || "bg-fg-faint"}`} />
                        <h2 className="text-[16px] font-semibold text-fg">
                            {gen.productName || "Generación"}
                        </h2>
                        <span className="text-[11px] text-fg-faint">·</span>
                        <span className="text-[11px] text-fg-faint">{STATUS_LABELS[gen.status]}</span>
                        <span className="text-[11px] text-fg-faint">·</span>
                        <span className="text-[11px] font-mono text-fg-faint">{gen.id}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Mode toggles like Morfeo: Manual / Paso a paso / Full auto */}
                        <div className="flex items-center border border-edge rounded-[var(--radius-sm)] overflow-hidden">
                            <button className="cursor-pointer px-3 py-1.5 text-[10px] font-medium bg-surface-1 text-fg border-r border-edge">
                                ⏸ Manual
                            </button>
                            <button className="cursor-pointer px-3 py-1.5 text-[10px] font-medium text-fg-faint hover:text-fg hover:bg-surface-1/50 transition-colors border-r border-edge">
                                → Paso a paso
                            </button>
                            <button className="cursor-pointer px-3 py-1.5 text-[10px] font-medium text-fg-faint hover:text-fg hover:bg-surface-1/50 transition-colors">
                                ⚡ Full auto
                            </button>
                        </div>
                        <button
                            onClick={onClose}
                            className="cursor-pointer w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-2 text-fg-muted hover:text-fg transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* ── 3-Column Content ── */}
                <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-[280px_1fr_1fr] min-h-full divide-x divide-edge">

                        {/* ═══ LEFT COLUMN: Product + Avatar + Voice ═══ */}
                        <div className="p-5 space-y-5 bg-surface-1/20">
                            {/* Product */}
                            <div>
                                <label className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider">Producto</label>
                                {gen.productImageUrl ? (
                                    <div className="mt-2 border border-edge rounded-[var(--radius-md)] overflow-hidden bg-surface-0">
                                        <img
                                            src={gen.productImageUrl}
                                            alt={gen.productName || "Producto"}
                                            className="w-full aspect-square object-cover"
                                        />
                                        <div className="px-3 py-2 border-t border-edge">
                                            <p className="text-[12px] text-fg font-medium">{gen.productName}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-2 border border-edge border-dashed rounded-[var(--radius-md)] p-6 flex flex-col items-center gap-2">
                                        <Package size={20} className="text-fg-faint" />
                                        <p className="text-[11px] text-fg-faint">{gen.productName || "Sin producto"}</p>
                                    </div>
                                )}
                            </div>

                            {/* Avatar / Personaje Generado */}
                            <div>
                                <label className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider">Personaje Generado</label>
                                {gen.avatarImageUrl ? (
                                    <div className="mt-2 border border-edge rounded-[var(--radius-md)] overflow-hidden bg-surface-0">
                                        <img
                                            src={gen.avatarImageUrl}
                                            alt={gen.avatarName || "Avatar"}
                                            className="w-full aspect-[3/4] object-cover"
                                        />
                                        <div className="px-3 py-2 border-t border-edge flex items-center gap-2">
                                            <span className="text-[11px] text-fg-faint">→ Personaje</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-2 border border-edge border-dashed rounded-[var(--radius-md)] p-6 flex flex-col items-center gap-2">
                                        <User size={20} className="text-fg-faint" />
                                        <p className="text-[11px] text-fg-faint">{gen.avatarName || "Sin avatar"}</p>
                                    </div>
                                )}
                            </div>

                            {/* Voice selection */}
                            <div>
                                <label className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider">Voz</label>
                                <div className="mt-2 space-y-1.5">
                                    <VoiceOption name="Mariana" selected={false} />
                                    <VoiceOption name="Emi" selected={false} />
                                    <VoiceOption name="Franco" subtitle="Natural" selected={true} />
                                </div>
                            </div>

                            {/* Multishot preview (if scenes done) */}
                            {gen.scenes && gen.scenes.length > 0 && (
                                <div>
                                    <label className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider">Escenas Seleccionadas</label>
                                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                                        {gen.scenes.map((scene) => {
                                            const shotIdx = selectedShots[scene.id] ?? 0;
                                            const shot = scene.multishots[shotIdx];
                                            return shot ? (
                                                <div key={scene.id} className="border border-edge rounded-[var(--radius-sm)] overflow-hidden">
                                                    <img src={shot.url} alt={scene.title} className="w-full aspect-[9/16] object-cover" />
                                                </div>
                                            ) : null;
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ═══ CENTER COLUMN: Brief ═══ */}
                        <div className="p-5 space-y-6">
                            <label className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider">Brief</label>

                            {/* Personaje description */}
                            <BriefSection
                                label="PERSONAJE"
                                content={`${gen.avatarName || "Personaje"} presenta ${gen.productName || "el producto"} para una audiencia de redes sociales.`}
                            />

                            {/* Hook */}
                            <BriefSection
                                label="HOOK"
                                content={scriptActs.hook || "Se generará con el guion..."}
                            />

                            {/* Situación */}
                            <BriefSection
                                label="SITUACIÓN"
                                content={gen.scriptText || "Pendiente de generación..."}
                                large
                            />

                            {/* Humor / Angle */}
                            <BriefSection
                                label="ÁNGULO"
                                content="El tono es casual y directo, como si le hablaras a un amigo. El producto se presenta como parte natural de la rutina."
                            />
                        </div>

                        {/* ═══ RIGHT COLUMN: Guión por actos ═══ */}
                        <div className="p-5 space-y-5">
                            <label className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider">Guión</label>

                            <ActLine label="HOOK" content={scriptActs.hook} />
                            <ActLine label="STORY 1" content={scriptActs.story1} />
                            <ActLine label="STORY 2" content={scriptActs.story2} />
                            <ActLine label="PLOT TWIST" content={scriptActs.plotTwist} />
                            <ActLine label="CTA" content={scriptActs.cta} />

                            {/* Audio status */}
                            {audioPhase && (audioPhase.status === "done" || audioPhase.status === "review") && (
                                <div className="border-t border-edge pt-4 mt-4">
                                    <label className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider">Audio</label>
                                    <div className="mt-2 flex items-center gap-3 border border-edge rounded-[var(--radius-sm)] p-3 bg-surface-0">
                                        <button className="cursor-pointer w-8 h-8 rounded-full bg-[var(--color-warm)] text-white flex items-center justify-center hover:opacity-90 shrink-0">
                                            <Play size={12} className="ml-0.5" />
                                        </button>
                                        <div className="flex-1 flex items-end gap-px h-4">
                                            {[3, 5, 8, 4, 7, 3, 6, 8, 5, 7, 3, 9, 5, 4, 7, 6, 3, 8, 5].map((h, i) => (
                                                <div key={i} className="flex-1 bg-[var(--color-warm)]/30 rounded-sm" style={{ height: `${h * 1.5}px` }} />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Video status */}
                            {lipsyncPhase && (lipsyncPhase.status === "done" || lipsyncPhase.status === "review") && (
                                <div className="border-t border-edge pt-4">
                                    <label className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider">Video Final</label>
                                    <div className="mt-2 border border-success/30 bg-success/5 rounded-[var(--radius-md)] p-4 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                                            <Play size={14} className="text-success ml-0.5" />
                                        </div>
                                        <div>
                                            <p className="text-[12px] text-success font-medium">Video listo</p>
                                            <p className="text-[10px] text-fg-faint">Listo para publicar</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {lipsyncPhase && lipsyncPhase.status === "error" && (
                                <div className="border-t border-edge pt-4">
                                    <div className="border border-error/30 bg-error/5 rounded-[var(--radius-md)] p-3 flex items-center gap-2">
                                        <AlertCircle size={14} className="text-error shrink-0" />
                                        <p className="text-[11px] text-error">{lipsyncPhase.error || gen.error || "Error en lip sync"}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Footer ── */}
                <div className="px-6 py-3 border-t border-edge bg-surface-0 shrink-0 flex items-center justify-between">
                    <Button variant="ghost" onClick={onClose} className="text-fg-muted text-[12px]">
                        Cerrar
                    </Button>
                    <div className="flex items-center gap-2">
                        {gen.status === "completed" ? (
                            <Button className="gap-2 h-8 text-[12px]" variant="default">
                                <RefreshCw size={13} /> Re-generar
                            </Button>
                        ) : (
                            <Button onClick={handleSave} className="gap-2 h-8 text-[12px]" variant="default">
                                <Save size={13} /> Guardar Cambios
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Helper Components ──

function VoiceOption({ name, subtitle, selected }: { name: string; subtitle?: string; selected: boolean }) {
    return (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-[var(--radius-sm)] border cursor-pointer transition-all ${
            selected
                ? "border-[var(--color-warm)] bg-[var(--color-warm)]/5"
                : "border-edge hover:border-edge-strong bg-surface-0"
        }`}>
            <div className={`w-2 h-2 rounded-full shrink-0 ${selected ? "bg-[var(--color-warm)]" : "bg-fg-faint/30"}`} />
            <span className={`text-[12px] font-medium ${selected ? "text-fg" : "text-fg-muted"}`}>{name}</span>
            {subtitle && <span className="text-[10px] text-fg-faint ml-auto">{subtitle}</span>}
        </div>
    );
}

function BriefSection({ label, content, large }: { label: string; content: string; large?: boolean }) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider">{label}</span>
                <button className="cursor-pointer text-fg-faint hover:text-fg transition-colors ml-auto">
                    <RefreshCw size={11} />
                </button>
            </div>
            <p className={`text-fg leading-relaxed ${large ? "text-[13px]" : "text-[13px]"}`}>
                {content}
            </p>
        </div>
    );
}

function ActLine({ label, content }: { label: string; content?: string }) {
    return (
        <div className="space-y-1">
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider">{label}</span>
                <div className="flex items-center gap-1 ml-auto">
                    <button className="cursor-pointer text-fg-faint hover:text-fg transition-colors" title="Re-generar">
                        <RefreshCw size={11} />
                    </button>
                </div>
            </div>
            <p className="text-[13px] text-fg leading-relaxed">
                {content || <span className="text-fg-faint italic">Pendiente...</span>}
            </p>
        </div>
    );
}

// ── Script Parser ──
// Splits a script into acts. If the script is a single block, distributes into acts.
function parseScriptActs(script: string) {
    if (!script) return { hook: "", story1: "", story2: "", plotTwist: "", cta: "" };

    // Try splitting by sentences
    const sentences = script.match(/[^.!?]+[.!?]+/g) || [script];

    if (sentences.length >= 5) {
        return {
            hook: sentences[0].trim(),
            story1: sentences[1].trim(),
            story2: sentences[2].trim(),
            plotTwist: sentences.slice(3, -1).join(" ").trim(),
            cta: sentences[sentences.length - 1].trim(),
        };
    }

    if (sentences.length >= 3) {
        return {
            hook: sentences[0].trim(),
            story1: sentences[1].trim(),
            story2: "",
            plotTwist: "",
            cta: sentences[sentences.length - 1].trim(),
        };
    }

    return {
        hook: sentences[0]?.trim() || "",
        story1: sentences[1]?.trim() || "",
        story2: "",
        plotTwist: "",
        cta: "",
    };
}
