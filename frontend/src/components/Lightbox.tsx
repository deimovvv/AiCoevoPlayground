import { useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Ver una imagen en grande. Compartido — antes cada pantalla tenía su propia copia
 * (ToolRunPage la repite en varios lugares) y Campañas no tenía ninguna.
 *
 * Con `items` + `index` navega entre varias con ← / →. Sin eso, muestra una sola.
 * ESC o click afuera cierra.
 */
export function Lightbox({
  url,
  items,
  index = 0,
  caption,
  onClose,
  onNavigate,
}: {
  /** Imagen a mostrar cuando no hay navegación. */
  url?: string | null;
  /** Lista para navegar con flechas. Si viene, manda sobre `url`. */
  items?: Array<{ url: string; caption?: string }>;
  index?: number;
  caption?: string;
  onClose: () => void;
  onNavigate?: (next: number) => void;
}) {
  const list = items && items.length ? items : url ? [{ url, caption }] : [];
  const i = Math.min(Math.max(index, 0), Math.max(list.length - 1, 0));
  const current = list[i];
  const canNav = list.length > 1 && !!onNavigate;

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (canNav && e.key === "ArrowRight") onNavigate!((i + 1) % list.length);
      else if (canNav && e.key === "ArrowLeft") onNavigate!((i - 1 + list.length) % list.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, canNav, i, list.length, onClose, onNavigate]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-8 cursor-zoom-out"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        title="Cerrar (ESC)"
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
      >
        <X size={18} />
      </button>

      {canNav && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onNavigate!((i - 1 + list.length) % list.length); }}
            title="Anterior (←)"
            className="absolute left-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onNavigate!((i + 1) % list.length); }}
            title="Siguiente (→)"
            className="absolute right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}

      <figure className="max-w-full max-h-full flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <img
          src={current.url}
          alt={current.caption || "vista ampliada"}
          className="max-w-[88vw] max-h-[82vh] object-contain rounded-[4px] cursor-default"
        />
        {(current.caption || canNav) && (
          <figcaption className="text-[12px] text-white/70 text-center">
            {current.caption}
            {canNav && <span className="ml-2 text-white/40">{i + 1} / {list.length}</span>}
          </figcaption>
        )}
      </figure>
    </div>
  );
}
