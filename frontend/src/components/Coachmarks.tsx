import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, X } from "lucide-react";

export interface CoachStep {
  /** CSS selector del elemento a resaltar (ej. '[data-tour="nav-inicio"]'). */
  target: string;
  title: string;
  body: string;
}

/**
 * Coachmarks — tour first-run reusable (spotlight + tooltip paso a paso).
 * ──────────────────────────────────────────────────────────────────────
 * Arranca automáticamente si `storageKey` no está en localStorage. Recorre los steps
 * resaltando cada target. Se puede reusar para el "¿Cómo funciona?" de cada tool
 * pasándole otros steps + otro storageKey.
 *
 * Pasá `force` para arrancarlo aunque ya se haya visto ("ver tour de nuevo").
 */
export function Coachmarks({ steps, storageKey, force, onDone }: {
  steps: CoachStep[];
  storageKey: string;
  force?: boolean;
  onDone?: () => void;
}) {
  const [active, setActive] = useState(false);
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Arranque: si no se vio (o force), tras un delay para que el layout se asiente.
  useEffect(() => {
    if (!force && localStorage.getItem(storageKey)) return;
    const t = setTimeout(() => { setIdx(0); setActive(true); }, force ? 0 : 700);
    return () => clearTimeout(t);
  }, [storageKey, force]);

  const finish = useCallback(() => {
    localStorage.setItem(storageKey, "1");
    setActive(false);
    onDone?.();
  }, [storageKey, onDone]);

  // Recalcula el rect del target del step actual (y en resize/scroll). Si el target no
  // existe, saltea al siguiente (no rompe el tour).
  useEffect(() => {
    if (!active) return;
    const step = steps[idx];
    const el = step ? document.querySelector(step.target) : null;
    if (!el) {
      // Target no encontrado → saltear (diferido para no setear estado síncrono en el effect).
      const t = setTimeout(() => { if (idx < steps.length - 1) setIdx((i) => i + 1); else finish(); }, 0);
      return () => clearTimeout(t);
    }
    const update = () => setRect((el as HTMLElement).getBoundingClientRect());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [active, idx, steps, finish]);

  if (!active || !rect) return null;
  const step = steps[idx];
  const last = idx === steps.length - 1;

  // Tooltip a la derecha del target (el sidebar está a la izquierda); clampeado al viewport.
  const TW = 300, PAD = 12;
  let left = rect.right + PAD;
  if (left + TW > window.innerWidth - 8) left = Math.max(8, rect.left - TW - PAD);
  const top = Math.min(Math.max(12, rect.top - 4), window.innerHeight - 200);

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      {/* Catcher — bloquea la app durante el tour (clic afuera no hace nada). */}
      <div className="absolute inset-0" />
      {/* Spotlight — oscurece todo menos el target (via box-shadow gigante). */}
      <div
        className="absolute rounded-[10px] transition-all duration-300 pointer-events-none"
        style={{
          top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.66)",
          outline: "2px solid var(--color-brand)", outlineOffset: "2px",
        }}
      />
      {/* Tooltip */}
      <div
        className="absolute w-[300px] rounded-[var(--radius-md)] border border-[var(--glass-border)] bg-surface-1 backdrop-blur-xl p-4 shadow-2xl"
        style={{ top, left }}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-[16px] font-semibold text-fg leading-tight">{step.title}</h3>
          <button onClick={finish} title="Saltar" className="text-fg-faint hover:text-fg cursor-pointer shrink-0"><X size={15} /></button>
        </div>
        <p className="text-[12px] text-fg-muted leading-snug mt-1.5">{step.body}</p>
        <div className="flex items-center justify-between mt-4">
          <span className="text-[11px] text-fg-faint tabular-nums">{idx + 1} de {steps.length}</span>
          <div className="flex items-center gap-2">
            {!last && <button onClick={finish} className="text-[12px] text-fg-muted hover:text-fg cursor-pointer">Saltar</button>}
            <button
              onClick={() => last ? finish() : setIdx((i) => i + 1)}
              className="flex items-center gap-1.5 px-3.5 h-8 rounded-full bg-[var(--color-brand)] text-[var(--color-brand-fg)] text-[12px] font-semibold hover:opacity-90 cursor-pointer"
            >
              {last ? "Listo" : "Siguiente"} {!last && <ArrowRight size={13} />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
