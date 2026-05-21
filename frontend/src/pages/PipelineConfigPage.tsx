/**
 * PipelineConfigPage — Admin panel for pipeline configuration.
 * Shows all prompts/instructions used by each tool, scene structure,
 * and global settings. Clean, monochrome design.
 */
import { useState } from "react";
import {
    Save, Loader2, ChevronDown, Cpu,
    ToggleLeft, ToggleRight
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { cn } from "../lib/utils";

// ── Pipeline Tool definitions with their actual prompts ──
interface PipelineTool {
    id: string;
    name: string;
    service: string;
    step: number;
    description: string;
    prompt: string;
    editable: boolean;
}

const PIPELINE_TOOLS: PipelineTool[] = [
    {
        id: "script_gen",
        name: "Generador de Guion",
        service: "Gemini 2.0 Flash",
        step: 1,
        description: "Genera el guion segmentado en 3-4 actos con prompts de imagen por escena.",
        prompt: `You are an expert UGC (User Generated Content) video director for short-form platforms.

BRAND CONTEXT (Use this to shape tone, vocabulary, messaging, and visual aesthetics):
---
{brand_context}
---

RULES:
- Outline a UGC video in 3 or 4 distinct scenes/acts.
- Keep the script short, natural, and highly engaging.
- Ensure the final scene includes a clear Call to Action (CTA) as requested.
- Strictly follow the user's VIDEO OBJECTIVE below.

OUTPUT FORMAT:
Return ONLY a valid JSON array of objects representing the scenes (3 or 4 scenes total).
Each object must have:
- "id": string (e.g. "scene_1")
- "title": string (e.g. "Acto 1: Hook")
- "script": string (The exact spoken text, 1-2 sentences)
- "image_prompt": string (A detailed prompt to generate the scene visually)`,
        editable: true,
    },
    {
        id: "objective_gen",
        name: "Sugeridor de Objetivo",
        service: "Gemini 2.0 Flash",
        step: 0,
        description: "Auto-genera el 'Objetivo del Guión' a partir de marca + producto.",
        prompt: `You are a creative strategist for UGC (User Generated Content) video campaigns.

BRAND CONTEXT:
---
{brand_context}
---

TASK:
Generate a concise "Video Objective" paragraph (3-5 lines max) describing the narrative purpose of a UGC video.
Include: target audience hook, how the product is shown, and what the Call to Action should be.
Be creative but concise.
Return ONLY the objective paragraph, nothing else.`,
        editable: true,
    },
    {
        id: "image_gen",
        name: "Generador de Imágenes",
        service: "Fal AI — nano-banana-2/edit",
        step: 2,
        description: "Genera/edita imágenes de escena usando avatar + producto + prompt.",
        prompt: `API Endpoint: fal-ai/nano-banana-2/edit
Parámetros por defecto:
- aspect_ratio: "9:16" (vertical para reels/TikTok)
- resolution: "1K"
- num_images: 1 por llamada (x3 para multishot)
- output_format: "png"
- safety_tolerance: "4"

Recibe: image_urls (avatar + producto) + prompt (generado por el guion)
Devuelve: imagen compositada lista para lip-sync`,
        editable: false,
    },
    {
        id: "multishot",
        name: "Curaduría Multishot",
        service: "Gemini Vision",
        step: 3,
        description: "Evalúa variaciones de imagen y selecciona la mejor toma.",
        prompt: `[Próximamente] Gemini Vision analiza N variaciones de la misma escena.

Criterios de evaluación:
- Iluminación y composición natural
- Consistencia del rostro del avatar
- Integración del producto en la escena
- Engagement visual (¿la imagen detiene el scroll?)

Output: Score 1-10 por imagen + recomendación de la ganadora.`,
        editable: true,
    },
    {
        id: "tts",
        name: "Voz / TTS",
        service: "ElevenLabs",
        step: 4,
        description: "Genera la locución del guion con voz clonada o seleccionada.",
        prompt: `Modelo: eleven_multilingual_v2
Formato: mp3_44100_128
Voice ID: configurable por marca/avatar

El texto del script de cada escena se envía directamente.
No requiere prompt adicional.`,
        editable: false,
    },
    {
        id: "lipsync",
        name: "Lip-Sync",
        service: "Fabric 1.0 (Fal AI)",
        step: 5,
        description: "Anima la imagen estática ganadora con el audio generado.",
        prompt: `Modelo: fal-ai/lipsync/v2
Input: imagen estática (ganadora del multishot) + audio (ElevenLabs)
Sync mode: "cut_off"

Toma la imagen aprobada por el humano + el audio del TTS,
y sintetiza el movimiento natural de cabeza y labios.
No requiere prompt de texto, solo los dos archivos.`,
        editable: false,
    },
];

// ── Scene structure defaults ──
const DEFAULT_SCENES = [
    { id: 1, tag: "Hook", description: "máx 8 palabras, genera curiosidad" },
    { id: 2, tag: "Story", description: "contexto, uso del producto, relato creíble" },
    { id: 3, tag: "Twist", description: "giro opcional conectado con la historia" },
    { id: 4, tag: "CTA", description: "llamado a la acción, dirigir a la web" },
];

// ── Collapsible Prompt Card ──
function PromptCard({ tool }: { tool: PipelineTool }) {
    const [open, setOpen] = useState(false);
    const [prompt, setPrompt] = useState(tool.prompt);

    return (
        <div className="border border-edge rounded-[var(--radius-md)] bg-surface-0 overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="cursor-pointer w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-surface-1/40 transition-colors"
            >
                <span className="text-[11px] font-mono text-fg-faint w-5 shrink-0 text-[var(--color-action)]">{tool.step}</span>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                        <h3 className="text-[14px] font-medium text-fg">{tool.name}</h3>
                        <span className="text-[11px] text-fg-faint font-mono">· {tool.service}</span>
                    </div>
                    <p className="text-[12px] text-fg-faint mt-0.5">{tool.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {tool.editable && (
                        <span className="text-[10px] text-fg-faint border border-edge px-2 py-0.5 rounded">editable</span>
                    )}
                    <ChevronDown
                        size={14}
                        className={cn("text-fg-faint transition-transform duration-200", open && "rotate-180")}
                    />
                </div>
            </button>

            <div className={cn(
                "overflow-hidden transition-all duration-300",
                open ? "max-h-[600px]" : "max-h-0"
            )}>
                <div className="px-5 pb-5 space-y-2 border-t border-edge">
                    <div className="pt-3">
                        {tool.editable ? (
                            <Textarea
                                className="min-h-[220px] text-[12px] leading-relaxed bg-surface-1 border-edge resize-y font-mono"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                            />
                        ) : (
                            <pre className="text-[12px] leading-relaxed text-fg-muted bg-surface-1 border border-edge rounded-[var(--radius-md)] p-4 whitespace-pre-wrap font-mono">
                                {prompt}
                            </pre>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Main Page ──
export default function PipelineConfigPage() {
    const [scenes, setScenes] = useState(DEFAULT_SCENES);
    const [pipelineAuto, setPipelineAuto] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        await new Promise(resolve => setTimeout(resolve, 800));
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div className="space-y-10 max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-[var(--radius-md)] bg-surface-1 border border-edge flex items-center justify-center">
                        <Cpu size={18} className="text-fg-muted" />
                    </div>
                    <div>
                        <h1 className="text-[20px] font-semibold text-fg tracking-tight">Control del Pipeline</h1>
                        <p className="text-[13px] text-fg-faint mt-0.5">Prompts, estructura y herramientas</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setPipelineAuto(!pipelineAuto)}
                        className={cn(
                            "cursor-pointer flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] border text-[13px] font-medium transition-all",
                            pipelineAuto
                                ? "border-[var(--color-action)]/30 bg-[var(--color-action-muted)] text-fg"
                                : "border-edge bg-surface-0 text-fg-muted"
                        )}
                    >
                        {pipelineAuto ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        {pipelineAuto ? "Activo" : "Pausado"}
                    </button>
                    <Button onClick={handleSave} disabled={saving} className="gap-2 h-9 px-4">
                        {saving ? (
                            <><Loader2 size={13} className="animate-spin" /> Guardando...</>
                        ) : saved ? (
                            <>Guardado ✓</>
                        ) : (
                            <><Save size={13} /> Guardar</>
                        )}
                    </Button>
                </div>
            </div>

            {/* Section 1: Scene Structure */}
            <div className="space-y-3">
                <p className="text-[11px] font-medium tracking-widest uppercase text-fg-faint px-1">
                    Estructura — {scenes.length} escenas
                </p>
                <div className="grid grid-cols-4 gap-3">
                    {scenes.map((scene) => (
                        <div
                            key={scene.id}
                            className="border border-edge rounded-[var(--radius-md)] bg-surface-0 p-4 space-y-2 group"
                        >
                            <span className="text-[11px] font-semibold text-fg-secondary">
                                {scene.id}. {scene.tag}
                            </span>
                            <textarea
                                value={scene.description}
                                onChange={(e) => {
                                    setScenes(prev => prev.map(s =>
                                        s.id === scene.id ? { ...s, description: e.target.value } : s
                                    ));
                                }}
                                rows={2}
                                className="w-full bg-transparent text-[13px] text-fg-muted leading-relaxed resize-none focus:outline-none focus:text-fg transition-colors"
                                placeholder="Descripción..."
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Section 2: Tool Prompts */}
            <div className="space-y-3">
                <p className="text-[11px] font-medium tracking-widest uppercase text-fg-faint px-1">
                    Herramientas — Prompts e Instrucciones
                </p>
                <div className="space-y-2">
                    {PIPELINE_TOOLS.map(tool => (
                        <PromptCard key={tool.id} tool={tool} />
                    ))}
                </div>
            </div>
        </div>
    );
}
