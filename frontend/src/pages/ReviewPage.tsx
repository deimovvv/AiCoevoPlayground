/**
 * ReviewPage — public, no-auth client review of a generation.
 * ─────────────────────────────────────────────────────────────
 * The client opens /review/:token (link shared by the agency), sees each clip and
 * approves or requests a change per clip. Feedback is saved and surfaces back to the
 * agency in Contenido. Standalone layout (no app nav) — works locally and, once the app
 * is deployed, with the public URL unchanged.
 */

import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router";
import { Check, X, Loader2, MessageSquare, Maximize2, ChevronLeft, ChevronRight } from "lucide-react";
import { getReview, submitReviewFeedback, type ReviewData } from "../lib/api";

const resolveUrl = (u: string) => (u && u.startsWith("http") ? u : `http://127.0.0.1:8000${u}`);

export function ReviewPage() {
  const { token } = useParams();
  const [review, setReview] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Local feedback state (seeded from the saved review) so the UI is snappy.
  const [feedback, setFeedback] = useState<Record<string, { status: string; comment: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  // Lightbox: index del clip abierto en fullscreen. null = cerrado.
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    getReview(token)
      .then((r) => {
        setReview(r);
        const seed: Record<string, { status: string; comment: string }> = {};
        for (const [k, v] of Object.entries(r.feedback || {})) seed[k] = { status: v.status, comment: v.comment };
        setFeedback(seed);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar"))
      .finally(() => setLoading(false));
  }, [token]);

  // Cierra el lightbox y navega entre clips con flechas / ESC.
  const closeLightbox = useCallback(() => setLightboxIdx(null), []);
  const navLightbox = useCallback((dir: 1 | -1) => {
    setLightboxIdx((cur) => {
      if (cur === null || !review) return cur;
      const total = review.clips.length;
      return (cur + dir + total) % total;
    });
  }, [review]);

  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowLeft") navLightbox(-1);
      else if (e.key === "ArrowRight") navLightbox(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIdx, closeLightbox, navLightbox]);

  const save = async (clipId: string, status: string, comment: string) => {
    if (!token) return;
    setFeedback((f) => ({ ...f, [clipId]: { status, comment } }));
    setSavingId(clipId);
    try {
      await submitReviewFeedback(token, clipId, status, comment);
    } catch { /* keep local state; let them retry */ }
    finally { setSavingId(null); }
  };

  // Gradient sutil consistente con ToolRunPage / Lab v2 — radial centrado arriba
  // con surface-0 que apenas se asoma del canvas. Es la impronta visual del producto.
  const gradientBg = "radial-gradient(ellipse 50% 30% at 50% 0%, var(--color-surface-0), var(--color-canvas) 80%)";

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: gradientBg }}><Loader2 className="animate-spin text-fg-muted" /></div>;
  }
  if (error || !review) {
    return <div className="min-h-screen flex items-center justify-center text-fg-muted text-[14px]" style={{ background: gradientBg }}>{error || "Review no encontrada"}</div>;
  }

  const approved = review.clips.filter((c) => feedback[c.id]?.status === "approved").length;
  const changes = review.clips.filter((c) => feedback[c.id]?.status === "change").length;

  return (
    <div className="min-h-screen text-fg" style={{ background: gradientBg }}>
      {/* Header — sticky, eyebrow en burgundy (era off-white), contador de cambios en
          burgundy (era amarillo warning que rompía la estética del producto). */}
      <div className="border-b border-edge sticky top-0 bg-[var(--color-canvas)]/85 backdrop-blur z-10">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-brand)]">Review</p>
            <h1 className="text-[18px] font-bold tracking-tight leading-tight">{review.title || "Contenido para revisar"}</h1>
          </div>
          <div className="text-[11px] text-fg-muted text-right shrink-0">
            <span className="text-[var(--color-success)] font-semibold">{approved} ✓</span>
            {changes > 0 && <span className="text-[var(--color-brand)] font-semibold ml-2">{changes} cambios</span>}
            <div className="text-fg-faint">{review.clips.length} clips</div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-6 space-y-6">
        <p className="text-[13px] text-fg-muted">Mirá cada clip y marcá <strong className="text-fg">Aprobar</strong> o <strong className="text-fg">Pedir cambio</strong>. Si pedís un cambio, contanos qué ajustar.</p>

        {review.clips.map((clip, i) => {
          const fb = feedback[clip.id] || { status: "", comment: "" };
          return (
            <div key={clip.id} className="bg-surface-1 border border-edge rounded-[var(--radius-md)] overflow-hidden">
              <div className="px-4 py-2.5 border-b border-edge flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-fg">{i + 1}. {clip.label}</span>
                {savingId === clip.id && <Loader2 size={12} className="animate-spin text-fg-faint" />}
              </div>
              <div className="bg-black flex items-center justify-center relative group">
                {clip.type === "video" ? (
                  // Video usa controls nativos para play/scrub. El botón flotante
                  // de la esquina permite abrir el lightbox sin que pelearse con
                  // los controles del video.
                  <video src={resolveUrl(clip.url)} controls playsInline className="max-h-[60vh] w-full object-contain" />
                ) : (
                  // Imagen: click en cualquier parte abre el lightbox.
                  <img
                    src={resolveUrl(clip.url)}
                    alt={clip.label}
                    onClick={() => setLightboxIdx(i)}
                    className="max-h-[60vh] w-full object-contain cursor-zoom-in"
                  />
                )}
                <button
                  type="button"
                  onClick={() => setLightboxIdx(i)}
                  title="Ver en grande"
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <Maximize2 size={14} />
                </button>
              </div>
              <div className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => save(clip.id, fb.status === "approved" ? "" : "approved", fb.comment)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[var(--radius-sm)] text-[12px] font-semibold cursor-pointer transition-colors border ${fb.status === "approved" ? "bg-[var(--color-success)] text-white border-[var(--color-success)]" : "border-edge text-fg-muted hover:text-fg hover:border-edge-strong"}`}
                  >
                    <Check size={14} /> Aprobar
                  </button>
                  <button
                    onClick={() => save(clip.id, fb.status === "change" ? "" : "change", fb.comment)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[var(--radius-sm)] text-[12px] font-semibold cursor-pointer transition-colors border ${fb.status === "change" ? "bg-[var(--color-brand)] text-[var(--color-brand-fg)] border-[var(--color-brand)] shadow-[0_0_14px_-4px_var(--color-brand-muted)]" : "border-edge text-fg-muted hover:text-fg hover:border-edge-strong"}`}
                  >
                    <X size={14} /> Pedir cambio
                  </button>
                </div>
                {fb.status === "change" && (
                  <div className="flex items-start gap-2">
                    <MessageSquare size={13} className="text-fg-faint mt-2 shrink-0" />
                    <textarea
                      defaultValue={fb.comment}
                      onBlur={(e) => save(clip.id, "change", e.target.value)}
                      placeholder="¿Qué querés cambiar de este clip? (ej: 'muy rápido', 'cambiá el color del fondo')"
                      rows={2}
                      className="flex-1 text-[12px] text-fg bg-surface-2 border border-edge rounded-[var(--radius-sm)] px-2.5 py-1.5 outline-none focus:border-[var(--color-edge-focus)] resize-none"
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <p className="text-[11px] text-fg-faint text-center py-4">Tu feedback se guarda solo. Podés cerrar y volver con este mismo link.</p>
      </div>

      {/* Lightbox fullscreen — abre al click en el media o en el botón Maximize2.
          Imagen/video se muestran a ~90vh con padding alrededor. Cierra con ESC,
          backdrop click o el botón X. Navega con ← → cuando hay varios clips. */}
      {lightboxIdx !== null && review.clips[lightboxIdx] && (() => {
        const clip = review.clips[lightboxIdx];
        const hasMultiple = review.clips.length > 1;
        return (
          <div
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-150"
            onClick={closeLightbox}
          >
            {/* Header chip con número de clip + label */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur border border-white/15 rounded-full px-3 py-1.5 text-[11px] text-white font-medium pointer-events-none">
              {lightboxIdx + 1} / {review.clips.length} · {clip.label}
            </div>

            {/* Close — top right */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
              title="Cerrar (ESC)"
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur flex items-center justify-center text-white cursor-pointer transition-colors"
            >
              <X size={18} />
            </button>

            {/* Prev / Next */}
            {hasMultiple && (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); navLightbox(-1); }}
                  title="Anterior (←)"
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur flex items-center justify-center text-white cursor-pointer transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); navLightbox(1); }}
                  title="Siguiente (→)"
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur flex items-center justify-center text-white cursor-pointer transition-colors"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}

            {/* Media — stop propagation para que click en la imagen no cierre */}
            <div onClick={(e) => e.stopPropagation()} className="max-w-[95vw] max-h-[90vh] flex items-center justify-center">
              {clip.type === "video" ? (
                <video src={resolveUrl(clip.url)} controls autoPlay playsInline className="max-w-full max-h-[90vh] object-contain" />
              ) : (
                <img src={resolveUrl(clip.url)} alt={clip.label} className="max-w-full max-h-[90vh] object-contain" />
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
