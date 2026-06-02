/**
 * ReviewPage — public, no-auth client review of a generation.
 * ─────────────────────────────────────────────────────────────
 * The client opens /review/:token (link shared by the agency), sees each clip and
 * approves or requests a change per clip. Feedback is saved and surfaces back to the
 * agency in Contenido. Standalone layout (no app nav) — works locally and, once the app
 * is deployed, with the public URL unchanged.
 */

import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { Check, X, Loader2, MessageSquare } from "lucide-react";
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

  const save = async (clipId: string, status: string, comment: string) => {
    if (!token) return;
    setFeedback((f) => ({ ...f, [clipId]: { status, comment } }));
    setSavingId(clipId);
    try {
      await submitReviewFeedback(token, clipId, status, comment);
    } catch { /* keep local state; let them retry */ }
    finally { setSavingId(null); }
  };

  if (loading) {
    return <div className="min-h-screen bg-[var(--color-canvas)] flex items-center justify-center"><Loader2 className="animate-spin text-fg-muted" /></div>;
  }
  if (error || !review) {
    return <div className="min-h-screen bg-[var(--color-canvas)] flex items-center justify-center text-fg-muted text-[14px]">{error || "Review no encontrada"}</div>;
  }

  const approved = review.clips.filter((c) => feedback[c.id]?.status === "approved").length;
  const changes = review.clips.filter((c) => feedback[c.id]?.status === "change").length;

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-fg">
      {/* Header */}
      <div className="border-b border-edge sticky top-0 bg-[var(--color-canvas)]/95 backdrop-blur z-10">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-action)]">Review</p>
            <h1 className="text-[18px] font-bold tracking-tight leading-tight">{review.title || "Contenido para revisar"}</h1>
          </div>
          <div className="text-[11px] text-fg-muted text-right shrink-0">
            <span className="text-[var(--color-success)] font-semibold">{approved} ✓</span>
            {changes > 0 && <span className="text-warning font-semibold ml-2">{changes} cambios</span>}
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
              <div className="bg-black flex items-center justify-center">
                {clip.type === "video" ? (
                  <video src={resolveUrl(clip.url)} controls playsInline className="max-h-[60vh] w-full object-contain" />
                ) : (
                  <img src={resolveUrl(clip.url)} alt={clip.label} className="max-h-[60vh] w-full object-contain" />
                )}
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
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[var(--radius-sm)] text-[12px] font-semibold cursor-pointer transition-colors border ${fb.status === "change" ? "bg-[var(--color-warning)] text-black border-[var(--color-warning)]" : "border-edge text-fg-muted hover:text-fg hover:border-edge-strong"}`}
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
    </div>
  );
}
