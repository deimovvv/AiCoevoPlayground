import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, SkipBack, Download, Loader2, X, RotateCcw } from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * VideoTimeline — el editor de video.
 * ───────────────────────────────────
 * Reemplaza la vista del paso Render en las tools de video: los clips en un
 * timeline, reproducidos en orden, y editables.
 *
 * Spec: openspec/changes/shared-video-editor · docs/video-editor.md
 *
 * Etapa 1: reproducir y navegar.  Etapa 2 (esta): recortar · reordenar · borrar ·
 * exportar con los cambios.  Etapa 3: comentar en un timestamp → regenerar el clip.
 *
 * DECISIÓN DE ARQUITECTURA — el reproductor reproduce los CLIPS en secuencia, no el
 * MP4 pegado. Por eso recortar y reordenar se ven al instante, sin render: FFmpeg
 * corre sólo al exportar (con los recortes, ver services/video_concat.py `trims`).
 *
 * Recortar sólo ACORTA un clip: para alargarlo hay que regenerarlo (etapa 3).
 */

export interface TimelineClip {
    id: string;
    title: string;
    videoUrl: string;
    /** Miniatura del clip (el frame base). */
    imageUrl?: string;
}

/** Un tramo del timeline: qué clip, y desde/hasta dónde (segundos del clip original). */
export interface TimelineEdit {
    clipId: string;
    start: number;
    end: number;
}

/** Duración mínima de un clip recortado: más corto que esto no se lee como plano. */
const MIN_LEN = 0.5;

const cleanTitle = (t: string) => {
    const parts = t.split("·").map((x) => x.trim()).filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 1] : t;
};

const fmt = (t: number) => {
    if (!isFinite(t) || t < 0) t = 0;
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    return `${m}:${s.toFixed(1).padStart(4, "0")}`;
};

/** Cuadros por clip que se extraen una sola vez. Alcanza para que la tira se lea
 *  como video; más sería tiempo de carga sin ganancia visible a esta altura. */
const FRAMES_PER_CLIP = 14;

/**
 * Cuadros reales del clip, a lo largo de su duración. Se extraen una vez (video
 * oculto → seek → canvas) y se cachean por URL. Los videos vienen del storage de
 * Fal (otro origen): el canvas queda "tainted", que impide EXPORTARLO a imagen pero
 * no MOSTRARLO — y acá sólo se muestra.
 */
const frameCache = new Map<string, Promise<HTMLCanvasElement[]>>();
function extractFrames(url: string): Promise<HTMLCanvasElement[]> {
    const hit = frameCache.get(url);
    if (hit) return hit;
    const job = new Promise<HTMLCanvasElement[]>((resolve) => {
        const v = document.createElement("video");
        v.muted = true; v.preload = "auto"; v.playsInline = true; v.src = url;
        const out: HTMLCanvasElement[] = [];
        v.onloadedmetadata = async () => {
            const d = isFinite(v.duration) ? v.duration : 0;
            const h = 88, w = Math.max(1, Math.round(h * (v.videoWidth / (v.videoHeight || 1))));
            for (let k = 0; k < FRAMES_PER_CLIP; k++) {
                const t = Math.min(d - 0.05, ((k + 0.5) / FRAMES_PER_CLIP) * d);
                await new Promise<void>((ok) => { v.onseeked = () => ok(); v.currentTime = Math.max(0, t); });
                const c = document.createElement("canvas");
                c.width = w; c.height = h;
                c.getContext("2d")?.drawImage(v, 0, 0, w, h);
                out.push(c);
            }
            v.removeAttribute("src");
            resolve(out);
        };
        v.onerror = () => resolve(out);
    });
    frameCache.set(url, job);
    return job;
}

/** La tira de un tramo: cuadros del rango [start, end] del clip, a lo ancho del bloque. */
function Filmstrip({ url, srcDuration, start, end }: { url: string; srcDuration: number; start: number; end: number }) {
    const ref = useRef<HTMLCanvasElement | null>(null);
    const [frames, setFrames] = useState<HTMLCanvasElement[]>([]);
    const [size, setSize] = useState({ w: 0, h: 0 });

    useEffect(() => { let on = true; extractFrames(url).then((f) => { if (on) setFrames(f); }); return () => { on = false; }; }, [url]);
    useEffect(() => {
        const el = ref.current?.parentElement;
        if (!el) return;
        const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        const c = ref.current;
        if (!c || !frames.length || !size.w || !srcDuration) return;
        const dpr = window.devicePixelRatio || 1;
        c.width = Math.round(size.w * dpr); c.height = Math.round(size.h * dpr);
        const ctx = c.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, size.w, size.h);
        const fw = size.h * (frames[0].width / frames[0].height);
        const slots = Math.max(1, Math.ceil(size.w / fw));
        for (let k = 0; k < slots; k++) {
            // Qué instante del clip representa este casillero, DENTRO del tramo recortado.
            const t = start + ((k + 0.5) / slots) * (end - start);
            const idx = Math.min(frames.length - 1, Math.max(0, Math.floor((t / srcDuration) * frames.length)));
            ctx.drawImage(frames[idx], k * fw, 0, fw, size.h);
        }
    }, [frames, size, start, end, srcDuration]);

    return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

export function VideoTimeline({
    clips, initialEdits, onEditsCommit, onExport,
}: {
    clips: TimelineClip[];
    /** Edición guardada de una sesión anterior (si la hay). */
    initialEdits?: TimelineEdit[];
    /** Se llama al SOLTAR cada cambio (no en cada movimiento): para persistir. */
    onEditsCommit?: (edits: TimelineEdit[]) => void;
    /** Exportar. `edited` = false si no hubo cambios (se puede bajar el MP4 existente). */
    onExport?: (edits: TimelineEdit[], edited: boolean) => Promise<void> | void;
}) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const trackRef = useRef<HTMLDivElement | null>(null);
    const pendingSeek = useRef<number | null>(null);
    const wantPlay = useRef(false);

    // ── Duración original de cada clip (metadata, sin bajar el video entero) ──
    const [srcDur, setSrcDur] = useState<Record<string, number>>({});
    useEffect(() => {
        let cancelled = false;
        clips.forEach((c) => {
            const v = document.createElement("video");
            v.preload = "metadata";
            v.src = c.videoUrl;
            v.onloadedmetadata = () => {
                if (cancelled) return;
                const d = isFinite(v.duration) ? v.duration : 0;
                setSrcDur((prev) => ({ ...prev, [c.id]: d }));
                v.removeAttribute("src");
            };
        });
        return () => { cancelled = true; };
    }, [clips]);
    const ready = clips.every((c) => srcDur[c.id] > 0);
    const byId = useMemo(() => Object.fromEntries(clips.map((c) => [c.id, c])), [clips]);

    // ── La edición: lista de tramos, en el orden en que se reproducen ──
    const original = useCallback((): TimelineEdit[] =>
        clips.map((c) => ({ clipId: c.id, start: 0, end: srcDur[c.id] || 0 })), [clips, srcDur]);
    const [edits, setEdits] = useState<TimelineEdit[]>([]);
    useEffect(() => {
        if (!ready || edits.length) return;
        const saved = (initialEdits || []).filter((e) => byId[e.clipId]);
        setEdits(saved.length ? saved : original());
    }, [ready, initialEdits, byId, original, edits.length]);

    const edited = useMemo(() => {
        const o = original();
        return edits.length !== o.length || edits.some((e, i) =>
            e.clipId !== o[i].clipId || Math.abs(e.start - o[i].start) > 0.01 || Math.abs(e.end - o[i].end) > 0.01);
    }, [edits, original]);

    const commit = (n: TimelineEdit[]) => { setEdits(n); onEditsCommit?.(n); };

    // ── Tiempo ──
    const lens = edits.map((e) => Math.max(0, e.end - e.start));
    const total = lens.reduce((a, b) => a + b, 0);
    const starts = lens.map((_, i) => lens.slice(0, i).reduce((a, b) => a + b, 0));
    const [active, setActive] = useState(0);
    const [clipTime, setClipTime] = useState(0);   // tiempo DENTRO del tramo (0 = su start)
    const [playing, setPlaying] = useState(false);
    const cur = edits[active];
    const globalTime = (starts[active] || 0) + clipTime;

    const seekTo = useCallback((t: number) => {
        if (!edits.length || !total) return;
        const c = Math.max(0, Math.min(t, total - 0.01));
        let i = starts.findIndex((s, k) => c >= s && c < s + lens[k]);
        if (i < 0) i = edits.length - 1;
        const offset = c - starts[i];
        if (i === active && videoRef.current) {
            videoRef.current.currentTime = edits[i].start + offset;
        } else {
            pendingSeek.current = edits[i].start + offset;
            setActive(i);
        }
        setClipTime(offset);
    }, [edits, total, starts, lens, active]);

    const onLoaded = () => {
        const v = videoRef.current;
        if (!v || !cur) return;
        v.currentTime = pendingSeek.current ?? cur.start;
        pendingSeek.current = null;
        if (wantPlay.current) v.play().catch(() => setPlaying(false));
    };

    const next = () => {
        if (active < edits.length - 1) {
            wantPlay.current = playing;
            pendingSeek.current = null;
            setActive(active + 1);
            setClipTime(0);
        } else {
            wantPlay.current = false;
            videoRef.current?.pause();
            setPlaying(false);
        }
    };

    const onTimeUpdate = () => {
        const v = videoRef.current;
        if (!v || !cur) return;
        // El tramo termina en su `end`, no en el final del archivo.
        if (playing && v.currentTime >= cur.end - 0.04) { next(); return; }
        setClipTime(Math.max(0, v.currentTime - cur.start));
    };

    const togglePlay = () => {
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) { wantPlay.current = true; v.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); }
        else { wantPlay.current = false; v.pause(); setPlaying(false); }
    };

    // ── Recortar: arrastrar las manijas de un tramo ──
    const drag = useRef<{ i: number; side: "start" | "end"; x0: number; v0: number; pxPerSec: number } | null>(null);
    const [trimming, setTrimming] = useState<number | null>(null);

    const onHandleDown = (e: React.PointerEvent, i: number, side: "start" | "end") => {
        e.stopPropagation();
        e.preventDefault();
        const w = trackRef.current?.getBoundingClientRect().width || 1;
        drag.current = { i, side, x0: e.clientX, v0: edits[i][side], pxPerSec: w / (total || 1) };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        videoRef.current?.pause(); setPlaying(false); wantPlay.current = false;
        setTrimming(i);
        if (i !== active) { pendingSeek.current = edits[i][side]; setActive(i); }
    };
    const onHandleMove = (e: React.PointerEvent) => {
        const d = drag.current;
        if (!d) return;
        const ed = edits[d.i];
        const max = srcDur[ed.clipId] || ed.end;
        let val = d.v0 + (e.clientX - d.x0) / d.pxPerSec;
        val = d.side === "start"
            ? Math.max(0, Math.min(val, ed.end - MIN_LEN))
            : Math.min(max, Math.max(val, ed.start + MIN_LEN));
        setEdits((prev) => prev.map((x, k) => (k === d.i ? { ...x, [d.side]: val } : x)));
        // El reproductor muestra el cuadro exacto donde se está cortando.
        if (videoRef.current) videoRef.current.currentTime = val;
        setClipTime(d.side === "start" ? 0 : val - ed.start);
    };
    const onHandleUp = () => {
        if (!drag.current) return;
        drag.current = null;
        setTrimming(null);
        onEditsCommit?.(edits);
    };

    // ── Reordenar: arrastrar un tramo ──
    const [dragFrom, setDragFrom] = useState<number | null>(null);
    const [dropAt, setDropAt] = useState<number | null>(null);
    const onDrop = (to: number) => {
        if (dragFrom == null || dragFrom === to) { setDragFrom(null); setDropAt(null); return; }
        const n = [...edits];
        const [moved] = n.splice(dragFrom, 1);
        n.splice(to, 0, moved);
        commit(n);
        setActive(to); setClipTime(0); pendingSeek.current = null;
        setDragFrom(null); setDropAt(null);
    };

    // ── Quitar ──
    const remove = (i: number) => {
        if (edits.length <= 1) return;   // siempre queda al menos un clip
        const n = edits.filter((_, k) => k !== i);
        commit(n);
        setActive(Math.min(i, n.length - 1)); setClipTime(0); pendingSeek.current = null;
    };

    const reset = () => { commit(original()); setActive(0); setClipTime(0); pendingSeek.current = null; };

    // ── Exportar ──
    const [exporting, setExporting] = useState(false);
    const doExport = async () => {
        if (!onExport) return;
        setExporting(true);
        try { await onExport(edits, edited); } finally { setExporting(false); }
    };

    // ── Teclado: espacio = play/pausa · supr/borrar = quitar el clip activo ──
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA") return;
            if (e.code === "Space") { e.preventDefault(); togglePlay(); }
            if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); remove(active); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    const tickStep = total <= 12 ? 1 : total <= 40 ? 2 : 5;
    const ticks = total ? Array.from({ length: Math.floor(total / tickStep) + 1 }, (_, i) => i * tickStep) : [];

    if (!clips.length) return null;
    const activeClip = cur ? byId[cur.clipId] : undefined;

    return (
        <div className="space-y-3">
            {/* ── Reproductor ─────────────────────────────── */}
            <div className="flex justify-center">
                <video
                    key={activeClip?.videoUrl}
                    ref={videoRef}
                    src={activeClip?.videoUrl}
                    onLoadedMetadata={onLoaded}
                    onTimeUpdate={onTimeUpdate}
                    onEnded={next}
                    onClick={togglePlay}
                    playsInline
                    className="h-[46vh] max-h-[520px] aspect-[9/16] object-contain rounded-[var(--radius-md)] border border-edge bg-black cursor-pointer"
                />
            </div>

            {/* ── Barra ───────────────────────────────────── */}
            <div className="flex items-center gap-2">
                <button onClick={() => { wantPlay.current = playing; seekTo(0); }} title="Al principio"
                    className="w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface-2 cursor-pointer">
                    <SkipBack size={14} />
                </button>
                <button onClick={togglePlay} title={playing ? "Pausa (espacio)" : "Reproducir (espacio)"}
                    className="w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center bg-surface-2 text-fg hover:bg-surface-3 cursor-pointer">
                    {playing ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <span className="text-[11px] tabular-nums text-fg-muted">
                    {fmt(globalTime)} <span className="text-fg-faint">/ {ready ? fmt(total) : "…"}</span>
                </span>
                <span className="text-[11px] text-fg-faint truncate">
                    {activeClip ? cleanTitle(activeClip.title) : ""}
                    {trimming != null && cur && ` · ${fmt(cur.start)}–${fmt(cur.end)}`}
                </span>
                <div className="flex-1" />
                {edited && (
                    <button onClick={reset} title="Volver a los clips originales"
                        className="flex items-center gap-1.5 h-8 px-2.5 rounded-[var(--radius-sm)] text-[11px] text-fg-faint hover:text-fg cursor-pointer">
                        <RotateCcw size={12} /> Restablecer
                    </button>
                )}
                {onExport && (
                    <button onClick={doExport} disabled={exporting || !ready}
                        className="flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-sm)] text-[12px] text-fg-muted border border-edge hover:text-fg hover:border-edge-strong cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-wait">
                        {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                        {exporting ? "Exportando…" : "Exportar"}
                    </button>
                )}
            </div>

            {/* ── Timeline ────────────────────────────────── */}
            <div className="space-y-1">
                <div className="relative h-4">
                    {ticks.map((t) => (
                        <span key={t} className="absolute top-0 text-[9px] tabular-nums text-fg-faint -translate-x-1/2"
                            style={{ left: `${(t / total) * 100}%` }}>
                            {fmt(t).replace(/\.\d$/, "")}
                        </span>
                    ))}
                </div>

                <div
                    ref={trackRef}
                    onClick={(e) => {
                        if (drag.current || !total || !trackRef.current) return;
                        const r = trackRef.current.getBoundingClientRect();
                        seekTo(((e.clientX - r.left) / r.width) * total);
                    }}
                    className="relative flex h-11 gap-0.5 cursor-pointer select-none"
                >
                    {edits.map((ed, i) => {
                        const c = byId[ed.clipId];
                        const isActive = i === active;
                        return (
                            <div
                                key={`${ed.clipId}_${i}`}
                                draggable={trimming == null}
                                onDragStart={(e) => { setDragFrom(i); e.dataTransfer.effectAllowed = "move"; }}
                                onDragOver={(e) => { e.preventDefault(); setDropAt(i); }}
                                onDragLeave={() => setDropAt((d) => (d === i ? null : d))}
                                onDrop={(e) => { e.preventDefault(); onDrop(i); }}
                                onDragEnd={() => { setDragFrom(null); setDropAt(null); }}
                                title={`${cleanTitle(c?.title || "")} · ${fmt(ed.end - ed.start)} — arrastrá para mover, bordes para recortar`}
                                className={cn(
                                    "group relative overflow-hidden rounded-[var(--radius-xs)] bg-surface-1 transition-[box-shadow,opacity]",
                                    isActive ? "ring-1 ring-fg/70" : "opacity-70 hover:opacity-100",
                                    dragFrom === i && "opacity-30",
                                    dropAt === i && dragFrom !== i && "ring-1 ring-fg",
                                )}
                                style={{ flexGrow: lens[i] || 1, flexBasis: 0, minWidth: 28 }}
                            >
                                {/* Tira de cuadros reales del tramo. Mientras se extraen, la
                                    miniatura del frame base ocupa el lugar. */}
                                {c?.imageUrl && (
                                    <img src={c.imageUrl} alt="" draggable={false}
                                        className="absolute left-0 top-0 h-full w-auto object-cover pointer-events-none" />
                                )}
                                {c && srcDur[c.id] > 0 && (
                                    <Filmstrip url={c.videoUrl} srcDuration={srcDur[c.id]} start={ed.start} end={ed.end} />
                                )}

                                {/* Manijas de recorte: una en cada borde */}
                                {(["start", "end"] as const).map((side) => (
                                    <div
                                        key={side}
                                        onPointerDown={(e) => onHandleDown(e, i, side)}
                                        onPointerMove={onHandleMove}
                                        onPointerUp={onHandleUp}
                                        onClick={(e) => e.stopPropagation()}
                                        title={side === "start" ? "Recortar el inicio" : "Recortar el final"}
                                        className={cn(
                                            "absolute top-0 bottom-0 w-2 cursor-ew-resize flex items-center justify-center z-10",
                                            side === "start" ? "left-0" : "right-0",
                                            trimming === i || isActive ? "bg-fg/25" : "bg-transparent group-hover:bg-fg/20",
                                        )}
                                    >
                                        <span className="w-px h-4 bg-fg/80" />
                                    </div>
                                ))}

                                {/* Quitar */}
                                {edits.length > 1 && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); remove(i); }}
                                        title="Quitar este clip (supr)"
                                        className="absolute top-0.5 right-2.5 z-20 w-4 h-4 rounded-[var(--radius-xs)] bg-black/60 text-white/80 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                    >
                                        <X size={10} />
                                    </button>
                                )}
                            </div>
                        );
                    })}

                    {ready && total > 0 && (
                        <div className="pointer-events-none absolute -top-1 -bottom-1 w-px bg-fg z-30"
                            style={{ left: `${(globalTime / total) * 100}%` }} />
                    )}
                </div>

                <div className="flex gap-0.5">
                    {edits.map((ed, i) => (
                        <span key={`${ed.clipId}_${i}_n`}
                            className={cn("text-[10px] truncate px-0.5", i === active ? "text-fg" : "text-fg-faint")}
                            style={{ flexGrow: lens[i] || 1, flexBasis: 0, minWidth: 28 }}>
                            {cleanTitle(byId[ed.clipId]?.title || "")}
                            {srcDur[ed.clipId] && lens[i] < srcDur[ed.clipId] - 0.05 ? " · recortado" : ""}
                        </span>
                    ))}
                </div>

                <p className="text-[10px] text-fg-faint pt-0.5">
                    Arrastrá los bordes de un clip para recortarlo · arrastralo para moverlo · supr para quitarlo.
                    Para alargar un clip hay que regenerarlo.
                </p>
            </div>
        </div>
    );
}
