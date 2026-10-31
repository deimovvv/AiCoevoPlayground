import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";

/**
 * Grabar una nota de voz para un comentario (changes/brand-integrations 4.1). Graba con el micrófono del
 * navegador y, al cortar, entrega el audio; quien la usa lo sube y Studio lo transcribe.
 */
export function VoiceNoteButton({ onDone, disabled }: { onDone: (audio: Blob) => Promise<void> | void; disabled?: boolean }) {
    const [state, setState] = useState<"idle" | "rec" | "saving">("idle");
    const [secs, setSecs] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const rec = useRef<MediaRecorder | null>(null);
    const chunks = useRef<Blob[]>([]);
    const timer = useRef<number | null>(null);

    useEffect(() => () => {
        if (timer.current) window.clearInterval(timer.current);
        rec.current?.stream.getTracks().forEach((t) => t.stop());
    }, []);

    const start = async () => {
        setError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const r = new MediaRecorder(stream);
            chunks.current = [];
            r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
            r.onstop = async () => {
                stream.getTracks().forEach((t) => t.stop());
                if (timer.current) window.clearInterval(timer.current);
                const blob = new Blob(chunks.current, { type: r.mimeType || "audio/webm" });
                if (!blob.size) { setState("idle"); return; }
                setState("saving");
                try { await onDone(blob); } finally { setState("idle"); }
            };
            rec.current = r;
            r.start();
            setSecs(0);
            timer.current = window.setInterval(() => setSecs((s) => s + 1), 1000);
            setState("rec");
        } catch {
            setError("No hay permiso para el micrófono.");
        }
    };

    if (state === "saving") {
        return <span className="h-7 px-2 flex items-center gap-1 text-[11px] text-fg-muted"><Loader2 size={11} className="animate-spin" /> Transcribiendo…</span>;
    }
    return (
        <>
            {state === "rec" ? (
                <button onClick={() => rec.current?.stop()}
                    className="h-7 px-2 flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-brand)] text-[11px] text-[var(--color-brand)] cursor-pointer">
                    <Square size={10} fill="currentColor" /> Cortar · {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
                </button>
            ) : (
                <button onClick={start} disabled={disabled} title="Grabar una nota de voz: se transcribe sola"
                    className="h-7 px-2 flex items-center gap-1 rounded-[var(--radius-sm)] border border-dashed border-edge text-[11px] text-fg-muted hover:text-fg hover:border-fg cursor-pointer disabled:opacity-30">
                    <Mic size={11} /> Nota de voz
                </button>
            )}
            {error && <span className="text-[11px] text-[var(--color-error)]">{error}</span>}
        </>
    );
}
