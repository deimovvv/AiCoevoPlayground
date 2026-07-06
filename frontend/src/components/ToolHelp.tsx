import { useState } from "react";
import { createPortal } from "react-dom";
import { HelpCircle, X, Check } from "lucide-react";

// Tips por tool (opcional). Fallback genérico si el tool no tiene entrada. Data-driven:
// sumar una tool = agregar (o no) una línea acá. Sin escribir tours a mano.
const TOOL_TIPS: Record<string, string[]> = {
  ecommerce_pack: [
    "Si pasás una pose, define la postura Y el encuadre — el plano lo manda la pose.",
    "Los accesorios se suben aparte; los flats no se generan para ellos.",
    "Para fidelidad de producto, sumá varias fotos (frente/atrás/detalle).",
  ],
  fashion_reel: [
    "Cada plano de la secuencia puede tener su instrucción (ej. 'sentada en una silla').",
    "La duración por clip aparece al elegir Kling en Motor de video.",
    "El primer plano es la fuente de verdad: ancla identidad y estética.",
  ],
  content_analyzer: [
    "Instagram por URL suele fallar (bloquea): bajá el reel y usá 'Upload Video'.",
    "Elegí el Nº de escenas para condensar un video largo sin cortarlo.",
  ],
  ugc_creator: ["El avatar habla a cámara; la voz se clona con ElevenLabs."],
  screen_mockup: [
    "Subí un screenshot limpio y nítido de tu UI (alta resolución).",
    "Mencioná el dispositivo en la escena: 'celular', 'laptop' o 'tablet'.",
    "Si la pantalla sale imperfecta, regenerá o subí una UI más nítida.",
  ],
};

const GENERIC_TIPS = [
  "Elegí la marca activa arriba — la tool hereda su brand kit.",
  "Podés editar cada resultado (subir una imagen de referencia si faltó algo).",
];

/**
 * ToolHelpButton — botón "?" + modal "¿Cómo funciona?" para una tool.
 * Data-driven: recibe nombre/descripción/inputs (derivados del schema) y saca los tips
 * del registry por id. Escala a todas las tools sin contenido a mano.
 */
export function ToolHelpButton({ toolId, name, description, inputs }: {
  toolId: string;
  name: string;
  description?: string;
  inputs: string[];
}) {
  const [open, setOpen] = useState(false);
  const tips = TOOL_TIPS[toolId] || GENERIC_TIPS;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="¿Cómo funciona?"
        className="w-8 h-8 flex items-center justify-center rounded-full text-fg-faint hover:text-fg hover:bg-surface-2 transition-colors cursor-pointer"
      >
        <HelpCircle size={16} />
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[90] bg-black/70 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--glass-border)] bg-surface-1 backdrop-blur-xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ boxShadow: "inset 0 1px 0 var(--glass-sheen), 0 30px 80px -30px rgba(0,0,0,0.7)" }}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-brand)]">¿Cómo funciona?</span>
                <h2 className="font-display text-[22px] font-semibold text-fg leading-tight mt-0.5">{name}</h2>
              </div>
              <button onClick={() => setOpen(false)} className="text-fg-faint hover:text-fg cursor-pointer shrink-0"><X size={17} /></button>
            </div>

            {description && <p className="text-[13px] text-fg-muted leading-relaxed">{description}</p>}

            {inputs.length > 0 && (
              <div className="mt-4">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-fg-faint">Qué necesita</span>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {inputs.map((i) => (
                    <span key={i} className="text-[11px] px-2.5 py-1 rounded-full border border-edge bg-surface-0 text-fg-muted">{i}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-fg-faint">Tips</span>
              <ul className="mt-2 space-y-1.5">
                {tips.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-fg-muted leading-snug">
                    <Check size={13} className="text-[var(--color-brand)] shrink-0 mt-0.5" /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
