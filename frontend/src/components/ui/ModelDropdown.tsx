import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "../../lib/utils";

// ── ModelDropdown ─────────────────────────────────────────────────────
// Dropdown fino y moderno para selección de modelo (Nano Banana / GPT Image,
// Kling V3 Pro / V2.6 Pro / Seedance, etc). Reemplaza el patrón "grid de
// cards grandes" que comía altura vertical innecesaria.
//
// Diseñado para vivir en sidebars angostos (~440px) donde cada píxel de
// altura cuenta. Collapsed = una sola línea con label + chevron. Expandido =
// popover con label arriba + sub debajo de cada opción + check en la activa.
//
// Uso:
//   <ModelDropdown
//     value={model}
//     onChange={setModel}
//     options={[
//       { id: "nano-banana-2", label: "Nano Banana 2", sub: "Multi-ref · Gemini" },
//       { id: "gpt-image-2",   label: "GPT Image 2",   sub: "Base + edit · OpenAI" },
//     ]}
//   />

export interface ModelOption<T extends string = string> {
    id: T;
    label: string;
    /** Línea descriptiva debajo del label en la opción expandida. Opcional. */
    sub?: string;
    /** Si está presente, deshabilita la opción y muestra el texto como tooltip. */
    disabled?: string;
    /** Icon antes del label (opcional). */
    icon?: React.ReactNode;
}

export function ModelDropdown<T extends string>({
    value,
    onChange,
    options,
    label,
    placeholder = "Seleccionar…",
    fullWidth = true,
    className,
}: {
    value: T;
    onChange: (next: T) => void;
    options: Array<ModelOption<T>>;
    /** Label arriba del control. Si no lo pasás, no se muestra (asumís que el
     *  contenedor ya tiene su propio título). */
    label?: string;
    placeholder?: string;
    fullWidth?: boolean;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Click outside cierra el popover. Pattern habitual.
    useEffect(() => {
        function onClick(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        if (open) document.addEventListener("mousedown", onClick);
        return () => document.removeEventListener("mousedown", onClick);
    }, [open]);

    // Escape cierra.
    useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open]);

    const current = options.find((o) => o.id === value);

    return (
        <div ref={containerRef} className={cn("relative", fullWidth && "w-full", className)}>
            {label && (
                <span className="block text-[10px] font-bold text-fg-faint uppercase tracking-widest mb-1.5">
                    {label}
                </span>
            )}
            <button
                onClick={() => setOpen((v) => !v)}
                className={cn(
                    "w-full flex items-center justify-between gap-2 px-3 py-2 text-[12px] rounded-[var(--radius-sm)] border transition-colors cursor-pointer",
                    open
                        ? "border-[var(--color-action)] bg-surface-1"
                        : "border-edge bg-surface-0 hover:border-edge-strong"
                )}
                aria-expanded={open}
                aria-haspopup="listbox"
            >
                <span className="flex items-center gap-2 min-w-0">
                    {current?.icon}
                    <span className="font-medium text-fg truncate">
                        {current?.label || placeholder}
                    </span>
                </span>
                <ChevronDown
                    size={13}
                    className={cn("text-fg-faint shrink-0 transition-transform", open && "rotate-180")}
                />
            </button>

            {open && (
                <div
                    role="listbox"
                    className="absolute z-30 mt-1 w-full bg-[var(--glass-bg)] backdrop-blur-xl border border-edge rounded-[var(--radius-md)] shadow-2xl overflow-hidden"
                >
                    {options.map((opt) => {
                        const active = opt.id === value;
                        const disabled = !!opt.disabled;
                        return (
                            <button
                                key={opt.id}
                                role="option"
                                aria-selected={active}
                                disabled={disabled}
                                title={opt.disabled}
                                onClick={() => {
                                    if (disabled) return;
                                    onChange(opt.id);
                                    setOpen(false);
                                }}
                                className={cn(
                                    "w-full flex items-start justify-between gap-2 px-3 py-2 text-left transition-colors",
                                    disabled
                                        ? "opacity-40 cursor-not-allowed"
                                        : active
                                            ? "bg-[var(--color-action-subtle)] cursor-pointer"
                                            : "hover:bg-surface-2 cursor-pointer"
                                )}
                            >
                                <span className="flex items-start gap-2 min-w-0">
                                    {opt.icon && <span className="mt-0.5 shrink-0">{opt.icon}</span>}
                                    <span className="min-w-0">
                                        <span className={cn("block text-[12px] font-medium truncate", active ? "text-fg" : "text-fg-secondary")}>
                                            {opt.label}
                                        </span>
                                        {opt.sub && (
                                            <span className="block text-[10px] text-fg-faint truncate mt-0.5">
                                                {opt.sub}
                                            </span>
                                        )}
                                    </span>
                                </span>
                                {active && (
                                    <Check size={13} className="text-[var(--color-action)] shrink-0 mt-1" />
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
