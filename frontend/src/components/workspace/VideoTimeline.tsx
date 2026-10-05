import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, SkipBack, Download } from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * VideoTimeline — el editor de video, primera etapa (sólo lectura).
 * ──────────────────────────────────────────────────────────────────
 * Reemplaza la vista del paso Render en las tools de video: en vez de un MP4 ya
 * pegado, muestra los clips en un timeline y los reproduce en orden.
 *
 * Spec: openspec/changes/shared-video-editor · docs/video-editor.md
 *
 * DECISIÓN DE ARQUITECTURA — el reproductor reproduce los CLIPS en secuencia, no el
 * video concatenado. En esta etapa da igual, pero en la siguiente (recortar,
 * reordenar) cada cambio se ve al instante en el navegador; si dependiera del MP4
 * pegado, cada cambio exigiría un render de FFmpeg para poder verse. FFmpeg queda
 * para exportar.
 *
 * Etapas siguientes (tasks.md del change): recortar · reordenar · comentar en un
 * timestamp · regenerar sólo ese clip.
 */

export interface TimelineClip {
    id: string;
    title: string;
    videoUrl: string;
    /** Miniatura del clip (el frame base). Si falta, el bloque va sin imagen. */
    imageUrl?: string;
}

const fmt = (t: number) => {
    if (!isFinite(t) || t < 0) t = 0;
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    return `${m}:${s.toFixed(1).padStart(4, "0")}`;
};

export function VideoTimeline({
    clips, exportUrl, onExport,
}: {
    clips: TimelineClip[];
    /** El MP4 final ya renderizado, para exportar. */
    exportUrl?: string;
    onExport?: () => void;
}) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const trackRef = useRef<HTMLDivElement | null>(null);
    /** Seek pendiente: al cambiar de clip hay que esperar a que cargue para ubicarlo. */
    const pendingSeek = useRef<number | null>(null);
    const wantPlay = useRef(false);

    const [durations, setDurations] = useState<number[]>(() => clips.map(() => 0));
    const [active, setActive] = useState(0);
    const [clipTime, setClipTime] = useState(0);
    const [playing, setPlaying] = useState(false);

    // Duración de cada clip: se lee la metadata sin bajar el video entero.
    useEffect(() => {
        let cancelled = false;
        setDurations(clips.map(() => 0));
        clips.forEach((c, i) => {
            const v = document.createElement("video");
            v.preload = "metadata";
            v.src = c.videoUrl;
            v.onloadedmetadata = () => {
                if (cancelled) return;
                const d = isFinite(v.duration) ? v.duration : 0;
                setDurations((prev) => prev.map((x, j) => (j === i ? d : x)));
                v.removeAttribute("src");
            };
        });
        return () => { cancelled = true; };
    }, [clips]);

    const total = useMemo(() => durations.reduce((a, b) => a + b, 0), [durations]);
    const starts = useMemo(() => durations.map((_, i) => durations.slice(0, i).reduce((a, b) => a + b, 0)), [durations]);
    const globalTime = (starts[active] || 0) + clipTime;
    const ready = durations.length > 0 && durations.every((d) => d > 0);

    /** Ir a un instante del timeline completo: elige el clip y el offset dentro de él. */
    const seekTo = useCallback((t: number) => {
        if (!ready) return;
        const clamped = Math.max(0, Math.min(t, total - 0.01));
        let i = starts.findIndex((s, k) => clamped >= s && clamped < s + durations[k]);
        if (i < 0) i = clips.length - 1;
        const offset = clamped - starts[i];
        if (i === active && videoRef.current) {
            videoRef.current.currentTime = offset;
            setClipTime(offset);
        } else {
            pendingSeek.current = offset;
            setActive(i);
            setClipTime(offset);
        }
    }, [ready, total, starts, durations, clips.length, active]);

    // Al cambiar de clip: aplicar el seek pendiente y seguir reproduciendo si venía sonando.
    const onLoaded = () => {
        const v = videoRef.current;
        if (!v) return;
        if (pendingSeek.current != null) { v.currentTime = pendingSeek.current; pendingSeek.current = null; }
        if (wantPlay.current) v.play().catch(() => setPlaying(false));
    };

    const onEnded = () => {
        if (active < clips.length - 1) {
            wantPlay.current = true;
            pendingSeek.current = 0;
            setActive(active + 1);
            setClipTime(0);
        } else {
            wantPlay.current = false;
            setPlaying(false);
        }
    };

    const togglePlay = () => {
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) { wantPlay.current = true; v.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); }
        else { wantPlay.current = false; v.pause(); setPlaying(false); }
    };

    const restart = () => { wantPlay.current = playing; seekTo(0); };

    const onTrackClick = (e: React.MouseEvent) => {
        const el = trackRef.current;
        if (!el || !total) return;
        const r = el.getBoundingClientRect();
        seekTo(((e.clientX - r.left) / r.width) * total);
    };

    // Espacio = play/pausa. Sólo si el foco no está en un campo de texto.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            if (e.code === "Space" && tag !== "INPUT" && tag !== "TEXTAREA") { e.preventDefault(); togglePlay(); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    // Marcas de la regla: cada 1, 2 o 5 s según el largo total.
    const step = total <= 12 ? 1 : total <= 40 ? 2 : 5;
    const ticks = total ? Array.from({ length: Math.floor(total / step) + 1 }, (_, i) => i * step) : [];

    if (!clips.length) return null;

    return (
        <div className="space-y-3">
            {/* ── Reproductor ─────────────────────────────── */}
            <div className="flex justify-center">
                <video
                    key={clips[active]?.videoUrl}
                    ref={videoRef}
                    src={clips[active]?.videoUrl}
                    onLoadedMetadata={onLoaded}
                    onTimeUpdate={(e) => setClipTime((e.target as HTMLVideoElement).currentTime)}
                    onEnded={onEnded}
                    onPause={() => { if (!wantPlay.current) setPlaying(false); }}
                    onClick={togglePlay}
                    playsInline
                    className="h-[46vh] max-h-[520px] aspect-[9/16] object-contain rounded-[var(--radius-md)] border border-edge bg-black cursor-pointer"
                />
            </div>

            {/* ── Barra ───────────────────────────────────── */}
            <div className="flex items-center gap-2">
                <button
                    onClick={restart}
                    title="Al principio"
                    className="w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface-2 cursor-pointer"
                >
                    <SkipBack size={14} />
                </button>
                <button
                    onClick={togglePlay}
                    title={playing ? "Pausa (espacio)" : "Reproducir (espacio)"}
                    className="w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center bg-surface-2 text-fg hover:bg-surface-3 cursor-pointer"
                >
                    {playing ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <span className="text-[11px] tabular-nums text-fg-muted">
                    {fmt(globalTime)} <span className="text-fg-faint">/ {ready ? fmt(total) : "…"}</span>
                </span>
                <span className="text-[11px] text-fg-faint truncate">
                    · clip {active + 1} de {clips.length}: {clips[active]?.title}
                </span>
                <div className="flex-1" />
                {exportUrl && (
                    <button
                        onClick={onExport}
                        className="flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-sm)] text-[12px] font-medium bg-[var(--color-action)] text-[var(--color-action-fg)] hover:opacity-90 cursor-pointer"
                    >
                        <Download size={13} /> Exportar
                    </button>
                )}
            </div>

            {/* ── Timeline ────────────────────────────────── */}
            <div className="rounded-[var(--radius-md)] border border-edge bg-surface-0 p-2 space-y-1.5">
                {/* Regla */}
                <div className="relative h-4">
                    {ticks.map((t) => (
                        <span
                            key={t}
                            className="absolute top-0 text-[9px] tabular-nums text-fg-faint -translate-x-1/2"
                            style={{ left: `${(t / total) * 100}%` }}
                        >
                            {fmt(t).replace(/\.\d$/, "")}
                        </span>
                    ))}
                </div>

                {/* Pista de video: cada bloque ancho ∝ su duración */}
                <div ref={trackRef} onClick={onTrackClick} className="relative flex h-16 gap-px cursor-pointer select-none">
                    {clips.map((c, i) => (
                        <div
                            key={c.id}
                            title={`${c.title} · ${durations[i] ? fmt(durations[i]) : "…"}`}
                            className={cn(
                                "relative overflow-hidden rounded-[var(--radius-xs)] border-2 bg-surface-2",
                                i === active ? "border-[var(--color-brand)]" : "border-transparent",
                            )}
                            style={{ flexGrow: durations[i] || 1, flexBasis: 0, minWidth: 28 }}
                        >
                            {c.imageUrl && (
                                <div
                                    className="absolute inset-0 bg-repeat-x bg-contain opacity-80"
                                    style={{ backgroundImage: `url(${c.imageUrl})` }}
                                />
                            )}
                            <span className="absolute left-1 bottom-0.5 right-1 text-[9px] font-medium text-white truncate drop-shadow">
                                {i + 1}. {c.title}
                            </span>
                        </div>
                    ))}
                    {/* Cabezal */}
                    {ready && (
                        <div
                            className="pointer-events-none absolute -top-1 -bottom-1 w-0.5 bg-[var(--color-brand)]"
                            style={{ left: `${(globalTime / total) * 100}%` }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
