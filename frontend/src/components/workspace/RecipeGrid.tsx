import { useRef, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";
import type { MotionRecipe } from "../../tools/fashion_reel/recipes";

/**
 * RecipeGrid — la grilla de recetas de movimiento.
 * ────────────────────────────────────────────────
 * Vive DENTRO del SelectorPanel (columna del medio), igual que los avatares o
 * las prendas. No es un modal: ver docs/fashion-reel-recipes.md §4.1 —
 * "no se abre un modal que tape todo" (workspace-template §2).
 *
 * PERFORMANCE — la grilla carga sólo los JPEG (~6 KB cada uno). El `<video>` se
 * MONTA en hover y se DESMONTA al salir, así que una grilla de 20 recetas no
 * descarga 20 videos: descarga 20 thumbs de 6 KB.
 */

export function RecipeGrid({
    recipes, selectedId, onSelect,
}: {
    recipes: MotionRecipe[];
    selectedId: string | null;
    onSelect: (r: MotionRecipe) => void;
}) {
    const [hovered, setHovered] = useState<string | null>(null);

    return (
        <div className="grid grid-cols-2 gap-2">
            {recipes.map((r) => (
                <RecipeCard
                    key={r.id}
                    recipe={r}
                    selected={selectedId === r.id}
                    hovered={hovered === r.id}
                    onEnter={() => setHovered(r.id)}
                    onLeave={() => setHovered((cur) => (cur === r.id ? null : cur))}
                    onClick={() => onSelect(r)}
                />
            ))}
        </div>
    );
}

function RecipeCard({
    recipe, selected, hovered, onEnter, onLeave, onClick,
}: {
    recipe: MotionRecipe;
    selected: boolean;
    hovered: boolean;
    onEnter: () => void;
    onLeave: () => void;
    onClick: () => void;
}) {
    const vidRef = useRef<HTMLVideoElement | null>(null);

    return (
        <button
            onClick={onClick}
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            title={recipe.sub}
            className={cn(
                "group relative rounded-[var(--radius-sm)] overflow-hidden border-2 transition-colors cursor-pointer text-left bg-[var(--color-surface-1)]",
                selected
                    ? "border-[var(--color-brand)]"
                    : "border-transparent hover:border-[var(--color-edge-strong)]",
            )}
        >
            <div className="relative aspect-[9/16] overflow-hidden">
                <img
                    src={recipe.thumbUrl}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover"
                />
                {/* Sólo existe mientras el mouse está encima — ver nota de performance. */}
                {hovered && recipe.previewUrl && (
                    <video
                        ref={vidRef}
                        src={recipe.previewUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                )}

                {selected && (
                    <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[var(--color-brand)] text-[var(--color-brand-fg)] flex items-center justify-center shadow">
                        <Check size={12} />
                    </span>
                )}

                {/* Sin validar todavía: que se vea, para no prometer de más. */}
                {recipe.expectedMotion == null && (
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-[var(--radius-xs)] bg-black/65 backdrop-blur text-[8px] uppercase tracking-wide font-semibold text-white/85">
                        sin validar
                    </span>
                )}

                <span className="absolute inset-x-0 bottom-0 px-2 pt-4 pb-1.5 bg-gradient-to-t from-black/85 to-transparent">
                    <span className="block text-[11px] font-medium text-white leading-tight truncate">
                        {recipe.label}
                    </span>
                    <span className="block text-[9px] text-white/65 leading-tight truncate">
                        {recipe.sub}
                    </span>
                </span>
            </div>
        </button>
    );
}

/**
 * RecipeStrip — la tira horizontal que vive EN el panel izquierdo.
 * ────────────────────────────────────────────────────────────────
 * Muestra los primeros formatos reproduciéndose en loop, para que se entienda
 * sin abrir nada que (a) son videos y (b) son elegibles. "Ver todos" abre la
 * grilla completa en la columna del medio.
 *
 * PERFORMANCE — sólo los de la tira reproducen. Con 40 recetas en catálogo, acá
 * se montan 4 videos de ~25 KB; el resto vive en la grilla, que carga JPEG y
 * monta el video únicamente en hover. Ver docs/fashion-reel-recipes.md §13.
 */
export function RecipeStrip({
    recipes, selectedId, onSelect, onSeeAll, visible = 4,
}: {
    recipes: MotionRecipe[];
    selectedId: string | null;
    onSelect: (r: MotionRecipe) => void;
    onSeeAll: () => void;
    visible?: number;
}) {
    const shown = recipes.slice(0, visible);
    const rest = recipes.length - shown.length;

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-fg-faint">
                    Formato
                </span>
                <button
                    onClick={onSeeAll}
                    className="text-[10px] text-fg-muted hover:text-fg transition-colors cursor-pointer"
                >
                    Ver todos{rest > 0 ? ` (${recipes.length})` : ""}
                </button>
            </div>

            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {shown.map((r) => {
                    const on = selectedId === r.id;
                    return (
                        <button
                            key={r.id}
                            onClick={() => onSelect(r)}
                            title={`${r.label} — ${r.sub}`}
                            className={cn(
                                "relative shrink-0 w-[68px] aspect-[9/16] rounded-[var(--radius-sm)] overflow-hidden border-2 transition-colors cursor-pointer bg-[var(--color-surface-1)]",
                                on ? "border-[var(--color-brand)]" : "border-transparent hover:border-[var(--color-edge-strong)]",
                            )}
                        >
                            {/* En loop siempre: es lo que hace evidente que son videos. */}
                            {r.previewUrl ? (
                                <video
                                    src={r.previewUrl}
                                    poster={r.thumbUrl}
                                    autoPlay loop muted playsInline
                                    className="absolute inset-0 w-full h-full object-cover"
                                />
                            ) : (
                                <img src={r.thumbUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                            )}
                            {on && (
                                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[var(--color-brand)] text-[var(--color-brand-fg)] flex items-center justify-center">
                                    <Check size={9} />
                                </span>
                            )}
                            <span className="absolute inset-x-0 bottom-0 px-1 pt-3 pb-0.5 bg-gradient-to-t from-black/85 to-transparent">
                                <span className="block text-[8px] font-medium text-white leading-tight truncate">
                                    {r.label}
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
