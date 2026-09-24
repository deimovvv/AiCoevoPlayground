import { useEffect, useState } from "react";
import { X, Brush, SlidersHorizontal } from "lucide-react";
import { ImageEditPanel } from "../ImageEditPanel";
import { MaskCanvas } from "./MaskCanvas";
import { cn } from "../../lib/utils";

/**
 * EditOverlay — abrir una pieza para editarla, A PANTALLA COMPLETA.
 * ──────────────────────────────────────────────────────────────────
 * Antes cada pantalla montaba el `ImageEditPanel` dentro de un contenedor de
 * 420px: la imagen quedaba diminuta y pintar una zona precisa era imposible.
 * Y estaba duplicado en tres lugares, así que cada uno se fue desincronizando.
 *
 * Layout: la IMAGEN manda (ocupa el espacio disponible) y los controles viven en
 * una columna fija a la derecha. Es la misma lógica del workspace de 3 columnas —
 * lo que se mira grande, lo que se toca al costado.
 *
 * El brush de máscara vive adentro del `ImageEditPanel`, así que acá no hay
 * lógica de edición: este componente sólo resuelve el ENCUADRE.
 */

interface Props {
    imageUrl: string;
    aspectRatio?: string;
    resolution?: string;
    /** Título opcional — nombre de la pieza o de la toma. */
    title?: string;
    onImageUpdated: (newUrl: string) => void;
    onClose: () => void;
}

export function EditOverlay({
    imageUrl, aspectRatio = "9:16", resolution = "1K", title, onImageUpdated, onClose,
}: Props) {
    /** Máscara de edición local. Vive acá —y no dentro del panel— porque se pinta
     *  sobre la imagen GRANDE del centro, que es la única superficie donde una
     *  zona puntual se puede marcar con precisión. */
    const [mask, setMask] = useState<string | null>(null);
    const [masking, setMasking] = useState(false);
    /** Panel de referencias y atajos. Cerrado por defecto: el gesto principal es
     *  escribir en la barra de abajo. */
    const [optionsOpen, setOptionsOpen] = useState(false);
    /** Guía de los modos de selección. Se descarta con "Entendido". */
    const [showHint, setShowHint] = useState(true);

    // Escape cierra, y el scroll del fondo se bloquea mientras está abierto.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex flex-col bg-[var(--color-canvas)]"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <header className="shrink-0 h-12 px-5 flex items-center justify-between border-b border-edge">
                <span className="text-[13px] font-medium text-fg">
                    {title || "Editar pieza"}
                </span>
                <button
                    onClick={onClose}
                    title="Cerrar (Esc)"
                    className="w-7 h-7 flex items-center justify-center rounded-md text-fg-muted hover:text-fg hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
                >
                    <X size={15} />
                </button>
            </header>

            {/* Controles a la IZQUIERDA (como el resto de la app: panel izquierdo,
                lienzo a la derecha). Antes estaban a la derecha y rompía con el
                patrón del Lab y de Campañas. */}
            <div className="flex-1 flex min-h-0 flex-row-reverse">
                {/* Columna principal: imagen arriba, prompt abajo — el gesto
                    central del editor es escribir qué cambiar. Ref: Pics. */}
                <div className="flex-1 min-w-0 min-h-0 flex flex-col">
                    <div className="flex-1 min-h-0 relative flex items-center justify-center overflow-hidden">
                        {masking ? (
                            <MaskCanvas imageUrl={imageUrl} onMaskChange={setMask} />
                        ) : (
                            <img
                                src={imageUrl}
                                alt=""
                                className="max-w-[calc(100%-3rem)] max-h-[calc(100%-3rem)] object-contain rounded-[var(--radius-sm)]"
                            />
                        )}

                        {/* Lápiz — sobre la imagen, como en cualquier editor. */}
                        <button
                            onClick={() => setMasking((v) => { if (v) setMask(null); return !v; })}
                            title={masking ? "Salir de la selección" : "Seleccionar una zona para editar sólo eso"}
                            className={cn(
                                "absolute top-4 left-4 z-10 w-9 h-9 rounded-md flex items-center justify-center transition-colors cursor-pointer border shadow-lg",
                                masking
                                    ? "bg-[var(--color-brand)] border-[var(--color-brand)] text-[var(--color-brand-fg)]"
                                    : "bg-[var(--color-surface-2)] border-[var(--color-edge-strong)] text-fg hover:bg-[var(--color-surface-3)]",
                            )}
                        >
                            <Brush size={14} />
                        </button>
                        {mask && (
                            <span className="absolute top-4 left-[3.75rem] z-10 h-9 px-2.5 rounded-md flex items-center text-[11px] font-medium border border-[var(--color-edge-strong)] bg-[var(--color-surface-2)] text-fg">
                                zona marcada
                            </span>
                        )}

                        {/* Guía de los modos — se muestra al entrar a la selección y
                            se descarta. Sin esto, los tres modos viven en tooltips que
                            hay que descubrir. Ref: el tooltip de Pics. */}
                        {masking && showHint && (
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-3.5 h-10 rounded-lg border border-[var(--color-edge-strong)] bg-[var(--color-surface-2)] shadow-lg">
                                <span className="text-[11.5px] text-fg">
                                    Arrastrá un recuadro, tocá un objeto, o pintá a mano.
                                </span>
                                <button
                                    onClick={() => setShowHint(false)}
                                    className="text-[11px] font-medium text-[var(--color-brand)] hover:opacity-70 cursor-pointer"
                                >
                                    Entendido
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Prompt — ancho, centrado, debajo de la imagen. */}
                    <div className="shrink-0 px-6 pb-5 pt-1">
                        <div className="max-w-2xl mx-auto">
                            <ImageEditPanel
                                variant="bar"
                                imageUrl={imageUrl}
                                aspectRatio={aspectRatio}
                                resolution={resolution}
                                onImageUpdated={onImageUpdated}
                                mask={mask}
                                masking={masking}
                                onToggleMask={() => { /* el control está sobre la imagen */ }}
                            />

                            {/* Referencias del kit y resolución — bajo el prompt, no en
                                una columna aparte. Se despliegan sólo si hacen falta. */}
                            <button
                                onClick={() => setOptionsOpen((v) => !v)}
                                className="mx-auto mt-2 flex items-center gap-1 text-[11px] text-fg-faint hover:text-fg transition-colors cursor-pointer"
                            >
                                <SlidersHorizontal size={11} />
                                {optionsOpen ? "Ocultar referencias" : "Sumar una referencia"}
                            </button>
                            {optionsOpen && (
                                <div className="mt-2 max-h-[34vh] overflow-y-auto rounded-xl border border-edge">
                                    <ImageEditPanel
                                        imageUrl={imageUrl}
                                        aspectRatio={aspectRatio}
                                        resolution={resolution}
                                        onImageUpdated={onImageUpdated}
                                        mask={mask}
                                        masking={masking}
                                        onToggleMask={() => { /* el control está sobre la imagen */ }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
