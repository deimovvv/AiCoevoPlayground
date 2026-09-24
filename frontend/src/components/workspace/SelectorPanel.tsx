import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * SelectorPanel — la columna del MEDIO del workspace de tres columnas.
 * ────────────────────────────────────────────────────────────────────
 * Patrón tomado de Genera.Space (ver docs/dashboard-architecture-research.md §2.2):
 *
 *   ┌────────────┬──────────────────┬─────────────────────┐
 *   │ CONTROLES  │  SELECTOR        │      CANVAS         │
 *   │  (fijo)    │  (este componente)│   (persistente)     │
 *   │            │                  │                     │
 *   │ Campo A ───┼─→ opciones       │  resultados         │
 *   │ Campo B ───┼─→ opciones       │  aparecen acá       │
 *   └────────────┴──────────────────┴─────────────────────┘
 *
 * La regla que define el patrón: **el canvas NUNCA desaparece**. Tocás un campo
 * del panel de controles y el selector se abre al lado, empujando el canvas — no
 * navegás a otra pantalla ni se abre un modal que tape todo.
 *
 * Por qué EMPUJA y no tapa: mientras elegís una cara o una pose querés seguir
 * viendo lo que ya generaste, para comparar. Un overlay encima del canvas rompe
 * justamente eso.
 *
 * Es deliberadamente tonto: no sabe qué contiene. Lab, Campañas y las tools le
 * pasan sus propios hijos. Así el patrón se comparte sin duplicar lógica.
 */

export interface SelectorTab {
    id: string;
    label: string;
    icon?: React.ReactNode;
}

interface Props {
    /** null = cerrado. El padre controla qué campo lo abrió. */
    open: boolean;
    title: string;
    onClose: () => void;
    /** Pestañas opcionales (ej. Presets / Generados / Custom, como Genera). */
    tabs?: SelectorTab[];
    activeTab?: string;
    onTabChange?: (id: string) => void;
    /** Ancho en px. Default 320 — suficiente para una grilla de 3 columnas. */
    width?: number;
    children: React.ReactNode;
}

export function SelectorPanel({
    open, title, onClose, tabs, activeTab, onTabChange, width = 320, children,
}: Props) {
    // Escape cierra — es un panel, no una pantalla: salir tiene que ser barato.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    return (
        <aside
            // La transición es sobre `width`, no sobre transform: así el canvas se
            // reacomoda con el panel en vez de quedar tapado a mitad de camino.
            className={cn(
                "shrink-0 overflow-hidden flex flex-col bg-[var(--color-surface-0)]",
                "transition-[width] duration-200 ease-out",
                open ? "border-r border-[var(--color-edge-subtle)]" : "border-r-0",
            )}
            style={{ width: open ? width : 0 }}
            aria-hidden={!open}
        >
            {/* El contenido va en un div de ancho FIJO: sin esto, mientras el panel
                se anima el texto se reflowea y el cierre se ve como un salto. */}
            <div style={{ width }} className="flex flex-col h-full">
                <header className="flex items-center justify-between px-4 h-11 shrink-0 border-b border-[var(--color-edge-subtle)]">
                    <span className="text-[12px] font-medium tracking-[-0.01em]">{title}</span>
                    <button
                        onClick={onClose}
                        title="Cerrar (Esc)"
                        className="w-6 h-6 flex items-center justify-center rounded text-fg-faint hover:text-fg hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
                    >
                        <X size={13} />
                    </button>
                </header>

                {tabs && tabs.length > 0 && (
                    <div className="flex items-center gap-0.5 px-2 py-1.5 shrink-0 border-b border-[var(--color-edge-subtle)] overflow-x-auto no-scrollbar">
                        {tabs.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => onTabChange?.(t.id)}
                                className={cn(
                                    "flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer",
                                    activeTab === t.id
                                        ? "bg-[var(--color-surface-2)] text-fg"
                                        : "text-fg-muted hover:text-fg hover:bg-[var(--color-surface-1)]",
                                )}
                            >
                                {t.icon}
                                {t.label}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-3">{children}</div>
            </div>
        </aside>
    );
}

/**
 * Fila del panel de CONTROLES que abre un selector. El chevron rota cuando está
 * activa, así se ve de dónde salió el panel abierto.
 */
export function SelectorTrigger({
    label, value, thumb, active, onClick, icon,
}: {
    label: string;
    /** Resumen de lo elegido. Si está vacío, se muestra "Elegir". */
    value?: string;
    thumb?: string;
    active?: boolean;
    onClick: () => void;
    icon?: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center gap-2.5 px-3 h-11 rounded-[var(--radius-sm)] text-left transition-colors cursor-pointer border",
                active
                    ? "bg-[var(--color-surface-2)] border-[var(--color-edge-strong)]"
                    : "bg-[var(--color-surface-1)] border-[var(--color-edge)] hover:border-[var(--color-edge-strong)]",
            )}
        >
            {thumb ? (
                <img src={thumb} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
            ) : icon ? (
                <span className="w-7 h-7 flex items-center justify-center text-fg-muted shrink-0">{icon}</span>
            ) : null}
            <span className="flex-1 min-w-0">
                <span className="block text-[12px] font-medium leading-tight">{label}</span>
                <span className="block text-[11px] text-fg-faint leading-tight truncate">
                    {value || "Elegir"}
                </span>
            </span>
            <span
                className={cn(
                    "text-fg-faint text-[10px] transition-transform shrink-0",
                    active && "rotate-90",
                )}
            >
                ▸
            </span>
        </button>
    );
}
