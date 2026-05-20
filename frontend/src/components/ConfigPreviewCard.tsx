/**
 * ConfigPreviewCard — shows the agent's resolved (tool + config) as a compact
 * card with asset thumbnails, scene count, engine, etc. + two CTAs:
 *   - "Ajustar en form": navigates to the tool page with the config pre-filled
 *   - "Generar": auto-runs the pipeline from the tool page
 *
 * Used after a multi-turn `resolveAgentBrief` in ChatPanel so the user sees the
 * config building up across turns and can launch without ever opening the form.
 */

import { useNavigate } from "react-router";
import { Sparkles, ChevronRight, Play, Settings } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import { avatarImageUrl, productImageUrl, clothingImageUrl, backgroundImageUrl } from "../lib/api";
import { TOOL_DEFINITIONS } from "../tools/registry";

const CHAT_HANDOFF_KEY = "coevo-chat-handoff";

interface ConfigPreviewCardProps {
    resolved: {
        tool: string;
        config: Record<string, unknown>;
        reasoning?: string;
        warnings?: string[];
    };
    /** When true, "Generar" auto-runs the pipeline (sets ?autoStart=1 in URL). */
    autoStartOnGenerate?: boolean;
}

export function ConfigPreviewCard({ resolved, autoStartOnGenerate = true }: ConfigPreviewCardProps) {
    const { activeBrand } = useBrand();
    const navigate = useNavigate();

    const cfg = resolved.config;
    const toolMeta = TOOL_DEFINITIONS[resolved.tool];

    // Resolve assets from IDs in config → readable cards
    const avatarId = (cfg.selectedAvatarId as string | null) || (cfg.selectedAvatarIds as string[] | undefined)?.[0] || null;
    const productId = (cfg.selectedProductId as string | null) || (cfg.selectedProductIds as string[] | undefined)?.[0] || null;
    const clothingIds = (cfg.selectedClothingIds as string[] | undefined) || [];
    const backgroundId = cfg.selectedBackgroundId as string | null;

    const avatar = avatarId ? activeBrand?.avatars?.find((a) => a.id === avatarId) : null;
    const product = productId ? activeBrand?.products?.find((p) => p.id === productId) : null;
    const clothing = (activeBrand?.clothing || []).filter((c) => clothingIds.includes(c.id));
    const background = backgroundId ? activeBrand?.backgrounds?.find((b) => b.id === backgroundId) : null;

    // Derived metadata
    const ugcMode = cfg.ugcMode as string | undefined;
    const engine = cfg.animationEngine as string | undefined;
    const visualStyle = cfg.visualStyle as string | undefined;
    const objective = cfg.objective as string | undefined;
    const customScript = cfg.customScript as string | undefined;
    let sceneCount: number | null = null;
    if (customScript) {
        try {
            const parsed = JSON.parse(customScript);
            if (Array.isArray(parsed)) sceneCount = parsed.length;
        } catch { /* ignore */ }
    }
    const videoDuration = cfg.videoDuration as string | undefined;

    const writeHandoff = (autoStart: boolean) => {
        sessionStorage.setItem(
            CHAT_HANDOFF_KEY,
            JSON.stringify({
                from: "chat",
                mode: "auto",
                brief: objective || "",
                tool: resolved.tool,
                config: cfg,
                reasoning: resolved.reasoning,
                warnings: resolved.warnings,
                autoStart,
            }),
        );
    };

    const handleAdjust = () => {
        writeHandoff(false);
        navigate(`/dashboard/generate/${resolved.tool}`);
    };

    const handleGenerate = () => {
        writeHandoff(autoStartOnGenerate);
        navigate(`/dashboard/generate/${resolved.tool}${autoStartOnGenerate ? "?autoStart=1" : ""}`);
    };

    return (
        <div className="bg-surface-0 border border-[var(--color-warm-muted)] rounded-[var(--radius-md)] p-4 space-y-3 mt-2">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-[var(--color-warm)]" />
                    <span className="text-[12px] font-semibold text-fg">
                        {toolMeta?.schema.objectiveLabel ? toolMeta.schema.objectiveLabel.replace(/\s*\(.+\)$/, "") : resolved.tool}
                    </span>
                </div>
                <span className="text-[10px] text-fg-faint">{resolved.tool}</span>
            </div>

            {/* Reasoning */}
            {resolved.reasoning && (
                <p className="text-[11px] text-fg-muted leading-relaxed">{resolved.reasoning}</p>
            )}

            {/* Asset chips */}
            <div className="flex flex-wrap gap-1.5">
                {avatar && (
                    <Chip imageUrl={avatar.imageUrl ? avatarImageUrl(avatar.imageUrl) : undefined} label={avatar.name} kind="avatar" />
                )}
                {product && (
                    <Chip imageUrl={product.imageUrl ? productImageUrl(product.imageUrl) : undefined} label={product.name} kind="product" />
                )}
                {clothing.slice(0, 3).map((c) => (
                    <Chip key={c.id} imageUrl={c.imageUrl ? clothingImageUrl(c.imageUrl) : undefined} label={c.name} kind="clothing" />
                ))}
                {clothing.length > 3 && (
                    <span className="text-[10px] px-2 py-1 bg-surface-1 rounded-full text-fg-faint">+{clothing.length - 3}</span>
                )}
                {background && (
                    <Chip imageUrl={background.imageUrl ? backgroundImageUrl(background.imageUrl) : undefined} label={background.name} kind="bg" />
                )}
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap gap-2 text-[10px]">
                {ugcMode && <Pill label={`Modo: ${ugcMode}`} />}
                {engine && <Pill label={`Motor: ${engine === "seedance" ? "Seedance" : "Kling"}`} />}
                {visualStyle && <Pill label={`Estilo: ${visualStyle}`} />}
                {videoDuration && <Pill label={`${videoDuration}s`} />}
                {sceneCount !== null && <Pill label={`${sceneCount} escenas`} />}
            </div>

            {/* Warnings (if any) */}
            {resolved.warnings && resolved.warnings.length > 0 && (
                <ul className="text-[10px] text-warning space-y-0.5">
                    {resolved.warnings.map((w, i) => (
                        <li key={i}>⚠ {w}</li>
                    ))}
                </ul>
            )}

            {/* CTAs */}
            <div className="flex items-center gap-2 pt-1">
                <button
                    onClick={handleAdjust}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-1 border border-edge text-fg-muted hover:text-fg hover:bg-surface-2 text-[11px] cursor-pointer"
                >
                    <Settings size={11} /> Ajustar en form
                </button>
                <button
                    onClick={handleGenerate}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--color-warm)] text-[var(--color-warm-fg)] hover:bg-[var(--color-warm-strong)] text-[11px] font-semibold cursor-pointer shadow-sm ml-auto"
                >
                    <Play size={11} fill="currentColor" /> Generar
                    <ChevronRight size={11} />
                </button>
            </div>
        </div>
    );
}

function Chip({ imageUrl, label, kind }: { imageUrl?: string; label: string; kind: string }) {
    return (
        <div className="flex items-center gap-1.5 bg-surface-1 border border-edge rounded-full pl-0.5 pr-2 py-0.5 text-[10px]" title={`${kind}: ${label}`}>
            {imageUrl ? (
                <img src={imageUrl} alt={label} className="w-5 h-5 object-cover rounded-full" />
            ) : (
                <span className="w-5 h-5 bg-surface-2 rounded-full" />
            )}
            <span className="text-fg-muted max-w-[120px] truncate">{label}</span>
        </div>
    );
}

function Pill({ label }: { label: string }) {
    return (
        <span className="px-2 py-0.5 rounded-full bg-surface-1 border border-edge-subtle text-fg-muted">{label}</span>
    );
}
