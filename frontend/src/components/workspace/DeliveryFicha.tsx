/**
 * La ficha de una pieza y «Cómo le fue» (sólo el equipo; el cliente no la ve).
 * La ficha es para retomar la pieza sin preguntar: pedido, referencias, modelo y prompts, costo, dónde está
 * el editable, voz, qué dijo el cliente. La escribe quien la hizo, a mano o desde Claude (`guardar_ficha`).
 * Se guarda al salir del campo. Montar con `key={delivery.id}` para que cambie de entrega limpio.
 */
import { useState } from "react";
import { saveDeliveryFicha, type Delivery } from "../../lib/api";

const FICHA_HINT = "Pedido · Referencias · Modelo y prompts · Costo · Editable (dónde está) · Voz · Qué dijo el cliente · Aprendido";

export function DeliveryFicha({ delivery, onSaved }: { delivery: Delivery; onSaved: (d: Delivery) => void }) {
    const [ficha, setFicha] = useState(delivery.ficha ?? "");
    const [results, setResults] = useState(delivery.results ?? "");
    const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

    const save = async (patch: { ficha?: string; results?: string }) => {
        const before = patch.ficha !== undefined ? delivery.ficha ?? "" : delivery.results ?? "";
        const after = (patch.ficha ?? patch.results ?? "").trim();
        if (after === before.trim()) return;
        setState("saving");
        try {
            onSaved(await saveDeliveryFicha(delivery.id, patch));
            setState("saved");
        } catch {
            setState("error");
        }
    };

    const area = "w-full px-2.5 py-2 text-[12px] leading-relaxed bg-transparent text-fg rounded-[2px] border border-edge outline-none focus:border-fg-muted resize-y";
    return (
        <div className="px-5 pt-4 pb-5 border-t border-edge flex flex-col gap-3">
            <div className="flex items-baseline gap-2">
                <p className="font-mono text-[10px] uppercase tracking-[.12em] text-fg-faint">Ficha · sólo el equipo</p>
                <span className="flex-1" />
                <span className={`text-[10.5px] ${state === "error" ? "text-[var(--color-error)]" : "text-fg-faint"}`}>
                    {state === "saving" ? "Guardando…" : state === "saved" ? "Guardada" : state === "error" ? "No se pudo guardar" : ""}
                </span>
            </div>
            <textarea value={ficha} onChange={(e) => setFicha(e.target.value)} onBlur={() => save({ ficha })}
                rows={ficha ? Math.min(12, ficha.split("\n").length + 1) : 3} placeholder={FICHA_HINT}
                aria-label="Ficha de la pieza" className={area} />
            <label className="flex flex-col gap-1.5">
                <span className="text-[11px] text-fg-muted">Cómo le fue</span>
                <textarea value={results} onChange={(e) => setResults(e.target.value)} onBlur={() => save({ results })}
                    rows={results ? Math.min(8, results.split("\n").length + 1) : 2}
                    placeholder="Alcance, mensajes, ventas, lo que dijo el cliente después de publicarla"
                    className={area} />
            </label>
        </div>
    );
}
