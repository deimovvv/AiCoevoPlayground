import { CHANNELS } from "../../lib/api";
import type { Channel, DeliverySummary } from "../../lib/api";

/** "2026-11-04T16:00:00+00:00" → "2026-11-04T13:00" en la hora local, para un <input type="datetime-local">. */
function toLocalInput(iso: string | null | undefined) {
    if (!iso) return "";
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Cuándo y dónde sale una pieza (changes/brand-integrations §3): fecha y hora, y redes. Es una propuesta:
 * no programa nada en Postiz hasta que se confirma la semana.
 */
export function PublishControls({ d, onChange, disabled }: {
    d: Pick<DeliverySummary, "scheduledAt" | "channels" | "phase">;
    onChange: (p: { scheduledAt?: string | null; channels?: Channel[] }) => void;
    disabled?: boolean;
}) {
    const locked = disabled || d.phase === "en_postiz" || d.phase === "publicada";
    const on = new Set(d.channels ?? []);
    return (
        <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-[11px] text-fg-muted">
                <span className="w-12 shrink-0">Cuándo</span>
                <input type="datetime-local" step={900} disabled={locked} value={toLocalInput(d.scheduledAt)}
                    onChange={(e) => onChange({ scheduledAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    className="h-7 px-2 bg-surface-1 border border-edge rounded-[var(--radius-sm)] text-[12px] text-fg outline-none focus:border-fg/40 disabled:opacity-50" />
            </label>
            <div className="flex items-start gap-2 text-[11px] text-fg-muted">
                <span className="w-12 shrink-0 pt-1">Dónde</span>
                <div className="flex flex-wrap gap-1">
                    {CHANNELS.map((c) => (
                        <button key={c.id} disabled={locked} aria-pressed={on.has(c.id)}
                            onClick={() => onChange({ channels: CHANNELS.map((x) => x.id).filter((x) => (x === c.id ? !on.has(x) : on.has(x))) })}
                            className={`h-6 px-2 rounded-full border text-[11px] cursor-pointer disabled:cursor-default ${on.has(c.id) ? "border-fg bg-fg text-[var(--color-canvas)]" : "border-edge text-fg-muted hover:text-fg"}`}>
                            {c.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
