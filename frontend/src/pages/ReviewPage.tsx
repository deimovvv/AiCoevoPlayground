/**
 * ReviewPage — el cliente mira una entrega y decide. Pública, sin auth.
 * ──────────────────────────────────────────────────────────────────────
 * Rehecha entera: antes era un formulario oscuro con dos botones del mismo peso (uno
 * naranja fuerte) y un campo de comentario SIEMPRE abierto. Lo que se ve ahora:
 *
 *   · La pieza ocupa la pantalla, sobre fondo oscuro. Es el único lugar del portal donde
 *     el oscuro suma: hace que la imagen respire.
 *   · Al costado, UNA pregunta — "¿Sale así?" — con Aprobar sólido y Pedir un cambio en
 *     outline. Una decisión, no dos botones compitiendo.
 *   · El comentario aparece SOLO si pide el cambio. Antes estaba siempre abierto,
 *     pidiendo que escriba algo aunque fuera a aprobar.
 *   · "3 de 12 · siguiente": revisar doce piezas sin saber cuántas faltan es lo que hace
 *     que el cliente abandone a la mitad.
 */

import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router";
import { Check, Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { getReview, submitReviewFeedback, type ReviewData } from "../lib/api";

const API = "http://127.0.0.1:8000";
const resolveUrl = (u: string) => (u && u.startsWith("http") ? u : `${API}${u}`);

/** Misma paleta clara del portal — es la misma casa. */
const C = {
  bg: "#faf8f6",
  stage: "#141210",
  card: "#ffffff",
  ink: "#1a1817",
  ink2: "#6b6560",
  ink3: "#9c948d",
  line: "#e4dfda",
  ok: "#3f8f6d",
};

export function ReviewPage() {
  const { token } = useParams();
  const [review, setReview] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, { status: string; comment: string }>>({});
  const [saving, setSaving] = useState(false);
  /** Índice del clip que se está mirando. Se revisa de a uno, no en una lista larga. */
  const [idx, setIdx] = useState(0);
  /** Se abre el comentario solo cuando eligió pedir un cambio. */
  const [asking, setAsking] = useState(false);
  const [draft, setDraft] = useState("");

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

  const clips = review?.clips || [];
  const clip = clips[idx];
  const current = clip ? feedback[clip.id] : undefined;

  const go = useCallback((dir: 1 | -1) => {
    setAsking(false); setDraft("");
    setIdx((i) => Math.min(clips.length - 1, Math.max(0, i + dir)));
  }, [clips.length]);

  const save = async (status: "approved" | "change", comment: string) => {
    if (!token || !clip) return;
    setSaving(true);
    setFeedback((prev) => ({ ...prev, [clip.id]: { status, comment } }));
    try {
      await submitReviewFeedback(token, clip.id, status, comment);
    } catch { /* queda marcado local; se reintenta al volver a elegir */ }
    setSaving(false);
    setAsking(false); setDraft("");
    // Avanzar solo es útil si queda algo por delante.
    if (idx < clips.length - 1) setTimeout(() => go(1), 350);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (asking) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, asking]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
        <Loader2 className="animate-spin" style={{ color: C.ink3 }} />
      </div>
    );
  }
  if (error || !review || !clip) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-2 px-6 text-center" style={{ background: C.bg, color: C.ink }}>
        <p className="text-[15px] font-medium">{error || "No encontramos esta entrega"}</p>
        <p className="text-[13px]" style={{ color: C.ink3 }}>Revisá el link o pedile uno nuevo a tu agencia.</p>
      </div>
    );
  }

  const reviewed = Object.values(feedback).filter((f) => f.status).length;
  const decided = current?.status;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ background: C.bg, color: C.ink }}>
      {/* ── La pieza. Fondo oscuro: el único lugar del portal donde suma. ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 min-h-[52vh]" style={{ background: C.stage }}>
        {clip.type === "video" ? (
          <video
            key={clip.id}
            src={resolveUrl(clip.url)}
            controls
            playsInline
            className="max-h-[76vh] max-w-full rounded-[6px]"
          />
        ) : (
          <img key={clip.id} src={resolveUrl(clip.url)} alt={clip.label} className="max-h-[76vh] max-w-full object-contain rounded-[6px]" />
        )}
      </div>

      {/* ── La decisión ── */}
      <aside
        className="w-full lg:w-[340px] shrink-0 px-8 py-9 flex flex-col"
        style={{ borderLeft: `1px solid ${C.line}` }}
      >
        <p className="text-[9.5px] font-mono uppercase tracking-[.16em]" style={{ color: C.ink3 }}>
          {review.title || "Entrega"}
        </p>
        <h1 className="font-display text-[21px] mt-2 tracking-[-.01em]">{clip.label}</h1>
        <p className="text-[12px] mt-1.5" style={{ color: C.ink2 }}>
          {clip.type === "video" ? "Video" : "Imagen"}
        </p>

        {asking ? (
          <>
            <p className="text-[13.5px] font-medium mt-8 mb-3">¿Qué habría que ajustar?</p>
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              placeholder="Contanos con tus palabras — la luz, la pose, el encuadre…"
              className="w-full rounded-[8px] px-3.5 py-3 text-[13.5px] outline-none resize-none"
              style={{ background: C.card, border: `1px solid ${C.line}`, color: C.ink }}
            />
            <button
              onClick={() => save("change", draft.trim())}
              disabled={!draft.trim() || saving}
              className="w-full mt-2.5 py-2.5 rounded-[8px] text-[13px] font-semibold cursor-pointer disabled:opacity-40"
              style={{ background: C.ink, color: "#fff" }}
            >
              {saving ? "Guardando…" : "Enviar el cambio"}
            </button>
            <button
              onClick={() => { setAsking(false); setDraft(""); }}
              className="w-full mt-2 py-2.5 rounded-[8px] text-[13px] cursor-pointer"
              style={{ border: `1px solid ${C.line}`, color: C.ink2 }}
            >
              Volver
            </button>
          </>
        ) : decided ? (
          <>
            <p className="flex items-center gap-2 text-[13.5px] font-medium mt-8" style={{ color: decided === "approved" ? C.ok : C.ink }}>
              <Check size={14} /> {decided === "approved" ? "Aprobada" : "Pediste un cambio"}
            </p>
            {current?.comment && (
              <p className="text-[13px] mt-2.5 leading-relaxed" style={{ color: C.ink2 }}>“{current.comment}”</p>
            )}
            <button
              onClick={() => setFeedback((p) => { const n = { ...p }; delete n[clip.id]; return n; })}
              className="text-[12px] mt-4 underline cursor-pointer self-start"
              style={{ color: C.ink3 }}
            >
              Cambiar mi respuesta
            </button>
          </>
        ) : (
          <>
            <p className="text-[13.5px] font-medium mt-8 mb-3">¿Sale así?</p>
            <button
              onClick={() => save("approved", "")}
              disabled={saving}
              className="w-full py-2.5 rounded-[8px] text-[13px] font-semibold cursor-pointer disabled:opacity-50"
              style={{ background: C.ink, color: "#fff" }}
            >
              Aprobar
            </button>
            <button
              onClick={() => setAsking(true)}
              className="w-full mt-2 py-2.5 rounded-[8px] text-[13px] cursor-pointer"
              style={{ border: `1px solid ${C.line}`, color: C.ink2 }}
            >
              Pedir un cambio
            </button>
            <p className="text-[12px] mt-5 leading-relaxed" style={{ color: C.ink3 }}>
              Si pedís un cambio te vamos a preguntar qué ajustar. Lo que escribas queda guardado y
              lo usamos para las próximas piezas de la marca.
            </p>
          </>
        )}

        {/* ── Avance ── */}
        <div className="mt-auto pt-6 flex items-center gap-3 text-[12px]" style={{ borderTop: `1px solid ${C.line}`, color: C.ink3 }}>
          <button
            onClick={() => go(-1)}
            disabled={idx === 0}
            className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer disabled:opacity-30"
            style={{ border: `1px solid ${C.line}` }}
          >
            <ArrowLeft size={12} />
          </button>
          <span>
            <b style={{ color: C.ink2, fontWeight: 500 }}>{idx + 1}</b> de {clips.length}
            {reviewed > 0 && ` · ${reviewed} revisadas`}
          </span>
          <button
            onClick={() => go(1)}
            disabled={idx >= clips.length - 1}
            className="ml-auto flex items-center gap-1.5 h-7 px-3 rounded-full cursor-pointer disabled:opacity-30"
            style={{ border: `1px solid ${C.line}`, color: C.ink2 }}
          >
            Siguiente <ArrowRight size={12} />
          </button>
        </div>
      </aside>
    </div>
  );
}
