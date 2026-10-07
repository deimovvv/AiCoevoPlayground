import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, SkipBack, Download, Loader2, X, RotateCcw, MessageSquare, Sparkles, BookmarkPlus, Undo2, Type, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { TextLayer } from "./TextLayer";
import { TEXT_STYLES, TEXT_POSITIONS, type TextBlock, type TextStyleId, type TextPosition, type TextTheme } from "./textLayerModel";

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

/** Un comentario sobre un momento del video. Etapa 3 del editor. */
export interface TimelineComment {
    id: string;
    clipId: string;
    /** Segundos dentro del clip ORIGINAL — sobrevive a recortes y reordenamientos. */
    clipOffset: number;
    text: string;
    /** open · regenerated (se regeneró el clip con esto) · rule (se guardó como regla) */
    status: "open" | "regenerated" | "rule";
    createdAt: string;
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
    comments = [], onCommentsChange, onRegenerate, onRestore, versionsOf, onSaveRule, costFor, durationOptions,
    textBlocks = [], onTextBlocksChange, textTheme,
}: {
    clips: TimelineClip[];
    /** Edición guardada de una sesión anterior (si la hay). */
    initialEdits?: TimelineEdit[];
    /** Se llama al SOLTAR cada cambio (no en cada movimiento): para persistir. */
    onEditsCommit?: (edits: TimelineEdit[]) => void;
    /** Exportar. `edited` = false si no hubo cambios (se puede bajar el MP4 existente).
     *  `texts` = la capa de texto a grabar encima (vacía = sin textos). */
    onExport?: (edits: TimelineEdit[], edited: boolean, texts: TextBlock[]) => Promise<void> | void;

    // ── Etapa 3: comentar y regenerar ──
    comments?: TimelineComment[];
    onCommentsChange?: (c: TimelineComment[]) => void;
    /** Regenera SÓLO ese clip con la indicación. `durationSec` permite alargarlo. */
    onRegenerate?: (clipId: string, direction: string, durationSec?: number) => Promise<void>;
    /** Vuelve a la versión anterior del clip. */
    onRestore?: (clipId: string) => void;
    /** Cuántas versiones anteriores tiene cada clip (0 = es el original). */
    versionsOf?: (clipId: string) => number;
    /** Guarda el texto como regla de movimiento de la MARCA (lo decide el operador). */
    onSaveRule?: (text: string) => Promise<void>;
    /** Costo de regenerar un clip de N segundos, para mostrarlo ANTES de confirmar. */
    costFor?: (secs: number) => number | null;
    /** Duraciones que acepta el modelo elegido (para alargar). */
    durationOptions?: string[];

    // ── Capa de texto (TextLayer.tsx): misma render(t) en la vista previa y en el export ──
    textBlocks?: TextBlock[];
    onTextBlocksChange?: (b: TextBlock[]) => void;
    /** Tipografía y color de la marca del run. Sin theme no se muestra la pista de texto. */
    textTheme?: TextTheme;
}) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const trackRef = useRef<HTMLDivElement | null>(null);
    const pendingSeek = useRef<number | null>(null);
    const wantPlay = useRef(false);

    // ── Duración original de cada clip (metadata, sin bajar el video entero) ──
    // Se guarda por URL, no por clip: un clip regenerado cambia de video y puede
    // durar distinto (si se alargó). La URL nueva mide su propia duración.
    const [durByUrl, setDurByUrl] = useState<Record<string, number>>({});
    useEffect(() => {
        let cancelled = false;
        clips.forEach((c) => {
            if (durByUrl[c.videoUrl]) return;
            const v = document.createElement("video");
            v.preload = "metadata";
            v.src = c.videoUrl;
            v.onloadedmetadata = () => {
                if (cancelled) return;
                const d = isFinite(v.duration) ? v.duration : 0;
                setDurByUrl((prev) => ({ ...prev, [c.videoUrl]: d }));
                v.removeAttribute("src");
            };
        });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clips]);
    const srcDur = useMemo(() => Object.fromEntries(clips.map((c) => [c.id, durByUrl[c.videoUrl] || 0])), [clips, durByUrl]);
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

    // Clip regenerado (cambió su video): su recorte vuelve a la duración completa del
    // video nuevo. Se espera a conocer esa duración antes de tocarlo.
    const lastUrl = useRef<Record<string, string>>({});
    useEffect(() => {
        if (!edits.length) { clips.forEach((c) => { lastUrl.current[c.id] ||= c.videoUrl; }); return; }
        const changed = clips.filter((c) => lastUrl.current[c.id] && lastUrl.current[c.id] !== c.videoUrl && srcDur[c.id] > 0);
        clips.forEach((c) => { lastUrl.current[c.id] ||= c.videoUrl; });
        if (!changed.length) return;
        changed.forEach((c) => { lastUrl.current[c.id] = c.videoUrl; });
        commit(edits.map((e) => changed.some((c) => c.id === e.clipId) ? { ...e, start: 0, end: srcDur[e.clipId] } : e));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clips, srcDur]);

    // ── Tiempo ──
    const lens = edits.map((e) => Math.max(0, e.end - e.start));
    const total = lens.reduce((a, b) => a + b, 0);
    const starts = lens.map((_, i) => lens.slice(0, i).reduce((a, b) => a + b, 0));
    const [active, setActive] = useState(0);
    const [clipTime, setClipTime] = useState(0);   // tiempo DENTRO del tramo (0 = su start)
    const [playing, setPlaying] = useState(false);
    // Proporción real del video: el recuadro de la vista previa (y los textos) la siguen.
    const [videoAR, setVideoAR] = useState(9 / 16);
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
        if (v.videoWidth && v.videoHeight) setVideoAR(v.videoWidth / v.videoHeight);
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

    // ── Scrub: arrastrar el cabezal (o la regla) para recorrer el video ──
    const scrubbing = useRef(false);
    const timeAt = (clientX: number) => {
        const r = trackRef.current?.getBoundingClientRect();
        return r && total ? ((clientX - r.left) / r.width) * total : 0;
    };
    const onScrubDown = (e: React.PointerEvent) => {
        if (!ready || !total) return;
        e.preventDefault(); e.stopPropagation();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        scrubbing.current = true;
        // Mientras se recorre, el video queda en pausa mostrando el cuadro de ese instante.
        videoRef.current?.pause(); setPlaying(false); wantPlay.current = false;
        seekTo(timeAt(e.clientX));
    };
    const onScrubMove = (e: React.PointerEvent) => { if (scrubbing.current) seekTo(timeAt(e.clientX)); };
    const onScrubUp = () => { scrubbing.current = false; };

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
        try { await onExport(edits, edited, textBlocks); } finally { setExporting(false); }
    };

    // ── Comentar y regenerar (etapa 3) ──
    const [draft, setDraft] = useState("");
    const [regenSecs, setRegenSecs] = useState("");
    const [busy, setBusy] = useState<string | null>(null);        // clipId regenerándose
    const [savingRule, setSavingRule] = useState<string | null>(null);
    const [regenError, setRegenError] = useState<string | null>(null);

    /** Dónde cae un comentario en el timeline actual (o null si su tramo quedó recortado). */
    const commentGlobal = (c: TimelineComment): number | null => {
        const i = edits.findIndex((e) => e.clipId === c.clipId);
        if (i < 0) return null;
        const e = edits[i];
        if (c.clipOffset < e.start || c.clipOffset > e.end) return starts[i];
        return starts[i] + (c.clipOffset - e.start);
    };

    const setComments = (n: TimelineComment[]) => onCommentsChange?.(n);
    const curDur = cur ? srcDur[cur.clipId] : 0;
    const regenDur = Number(regenSecs) || Math.round(curDur) || undefined;
    const regenCost = regenDur && costFor ? costFor(regenDur) : null;

    const addComment = async (andRegenerate: boolean) => {
        if (!cur || !draft.trim()) return;
        const c: TimelineComment = {
            id: `c_${Date.now()}`,
            clipId: cur.clipId,
            clipOffset: cur.start + clipTime,
            text: draft.trim(),
            status: "open",
            createdAt: new Date().toISOString(),
        };
        const list = [...comments, c];
        setComments(list);
        setDraft("");
        if (andRegenerate) await regenerate(c, list);
    };

    const regenerate = async (c: TimelineComment, list = comments) => {
        if (!onRegenerate || busy) return;
        setBusy(c.clipId); setRegenError(null);
        videoRef.current?.pause(); setPlaying(false); wantPlay.current = false;
        try {
            await onRegenerate(c.clipId, c.text, regenDur);
            setComments(list.map((x) => (x.id === c.id ? { ...x, status: "regenerated" } : x)));
        } catch (e) {
            setRegenError(e instanceof Error ? e.message : "No se pudo regenerar el clip");
        } finally {
            setBusy(null);
        }
    };

    const saveRule = async (c: TimelineComment) => {
        if (!onSaveRule) return;
        setSavingRule(c.id);
        try {
            await onSaveRule(c.text);
            setComments(comments.map((x) => (x.id === c.id ? { ...x, status: "rule" } : x)));
        } finally { setSavingRule(null); }
    };

    // ── Capa de texto ──
    const texts = textBlocks;
    const [selText, setSelText] = useState<string | null>(null);
    const sel = texts.find((b) => b.id === selText) || null;
    const setTexts = (n: TextBlock[]) => onTextBlocksChange?.(n);
    const patchText = (id: string, patch: Partial<TextBlock>) => setTexts(texts.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    const addText = (style: TextStyleId = "titulo") => {
        const def = TEXT_STYLES[style];
        const start = Math.min(globalTime, Math.max(0, total - 0.5));
        const b: TextBlock = {
            id: `t_${Date.now()}`, start, end: Math.min(total, start + def.defaultSecs),
            text: "", style, position: def.defaultPosition, tone: "light",
        };
        setTexts([...texts, b]);
        setSelText(b.id);
    };
    const removeText = (id: string) => { setTexts(texts.filter((b) => b.id !== id)); setSelText(null); };

    // Mover / estirar un texto en su pista (cuerpo = mover, bordes = inicio / fin).
    const textTrackRef = useRef<HTMLDivElement | null>(null);
    const tdrag = useRef<{ id: string; mode: "move" | "start" | "end"; x0: number; s0: number; e0: number; pxPerSec: number } | null>(null);
    const [draftTexts, setDraftTexts] = useState<TextBlock[] | null>(null);
    const shownTexts = draftTexts || texts;
    const onTextDown = (e: React.PointerEvent, b: TextBlock, mode: "move" | "start" | "end") => {
        e.stopPropagation(); e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        const w = textTrackRef.current?.getBoundingClientRect().width || 1;
        tdrag.current = { id: b.id, mode, x0: e.clientX, s0: b.start, e0: b.end, pxPerSec: w / (total || 1) };
        setSelText(b.id);
        setDraftTexts(texts);
    };
    const onTextMove = (e: React.PointerEvent) => {
        const d = tdrag.current;
        if (!d) return;
        const dt = (e.clientX - d.x0) / d.pxPerSec;
        const len = d.e0 - d.s0;
        let start = d.s0, end = d.e0;
        if (d.mode === "move") { start = Math.max(0, Math.min(d.s0 + dt, total - len)); end = start + len; }
        if (d.mode === "start") start = Math.max(0, Math.min(d.s0 + dt, d.e0 - 0.3));
        if (d.mode === "end") end = Math.min(total, Math.max(d.e0 + dt, d.s0 + 0.3));
        setDraftTexts(texts.map((b) => (b.id === d.id ? { ...b, start, end } : b)));
        seekTo(d.mode === "end" ? end - 0.05 : start + 0.4);   // el video muestra dónde cae el texto
    };
    const onTextUp = () => {
        if (!tdrag.current) return;
        tdrag.current = null;
        if (draftTexts) setTexts(draftTexts);
        setDraftTexts(null);
    };

    // Vista previa fluida: timeupdate llega ~4 veces por segundo; la animación del texto
    // necesita el tiempo de cada cuadro mientras reproduce.
    const [smoothT, setSmoothT] = useState<number | null>(null);
    useEffect(() => {
        if (!playing || !texts.length) { setSmoothT(null); return; }
        let raf = 0;
        const tick = () => {
            const v = videoRef.current;
            if (v && cur) setSmoothT((starts[active] || 0) + Math.max(0, v.currentTime - cur.start));
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playing, active, cur?.start, texts.length]);
    const previewT = smoothT ?? globalTime;

    // Tamaño real del video en pantalla, para escalar los textos desde el cuadro de 1080.
    const stageRef = useRef<HTMLDivElement | null>(null);
    const [stage, setStage] = useState({ w: 0, h: 0 });
    useEffect(() => {
        const el = stageRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([e]) => setStage({ w: e.contentRect.width, h: e.contentRect.height }));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // ── Teclado: espacio = play/pausa · supr/borrar = quitar el texto elegido o el clip activo ──
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
            if (e.code === "Space") { e.preventDefault(); togglePlay(); }
            if (e.key === "Escape") setSelText(null);
            if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); if (sel) removeText(sel.id); else remove(active); }
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
            {/* ── Reproductor + comentarios ───────────────── */}
            <div className="flex gap-5 items-start">
            <div className="flex-1 min-w-0 flex justify-center relative">
                <div ref={stageRef} className="relative h-[58vh] max-h-[640px]" style={{ aspectRatio: videoAR }}>
                <video
                    key={activeClip?.videoUrl}
                    ref={videoRef}
                    src={activeClip?.videoUrl}
                    onLoadedMetadata={onLoaded}
                    onTimeUpdate={onTimeUpdate}
                    onEnded={next}
                    onClick={togglePlay}
                    playsInline
                    className="w-full h-full object-cover rounded-[var(--radius-md)] bg-black cursor-pointer"
                />
                {textTheme && texts.length > 0 && stage.w > 0 && (
                    <div className="absolute inset-0 rounded-[var(--radius-md)] overflow-hidden pointer-events-none">
                        <TextLayer blocks={shownTexts} t={previewT} theme={textTheme} width={stage.w} height={stage.h} selectedId={playing ? null : selText} />
                    </div>
                )}
                </div>
                {busy && cur && busy === cur.clipId && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-sm)] bg-black/70 text-[11px] text-white">
                            <Loader2 size={12} className="animate-spin" /> Regenerando este clip…
                        </span>
                    </div>
                )}
            </div>

            {sel && textTheme ? (
                <aside className="w-[264px] shrink-0 flex flex-col gap-4 self-stretch border-l border-edge pl-5">
                    <div className="flex items-center gap-1.5">
                        <Type size={12} className="text-fg-muted" />
                        <span className="text-[12px] font-medium text-fg">Texto</span>
                        <span className="text-[10px] tabular-nums text-fg-faint">{fmt(sel.start)}–{fmt(sel.end)}</span>
                        <span className="flex-1" />
                        <button onClick={() => setSelText(null)} className="text-[11px] text-fg-muted hover:text-fg cursor-pointer">Listo</button>
                    </div>
                    <div className="rounded-[var(--radius-sm)] border border-edge bg-surface-1 focus-within:border-fg/40 transition-colors">
                        <textarea
                            autoFocus
                            value={sel.text}
                            onChange={(e) => patchText(sel.id, { text: e.target.value })}
                            rows={3}
                            placeholder={sel.style === "precio" ? "Ej.: $ 48.900" : sel.style === "cta" ? "Ej.: Comprá online" : "Escribí el texto"}
                            className="w-full bg-transparent border-0 px-2.5 py-2 text-[13px] text-fg placeholder:text-fg-faint outline-none resize-none"
                        />
                    </div>
                    <TextChips label="Estilo" value={sel.style}
                        options={(Object.keys(TEXT_STYLES) as TextStyleId[]).map((k) => [k, TEXT_STYLES[k].label])}
                        onChange={(v) => patchText(sel.id, { style: v as TextStyleId, position: TEXT_STYLES[v as TextStyleId].defaultPosition })} />
                    <TextChips label="Posición" value={sel.position}
                        options={(Object.keys(TEXT_POSITIONS) as TextPosition[]).map((k) => [k, TEXT_POSITIONS[k]])}
                        onChange={(v) => patchText(sel.id, { position: v as TextPosition })} />
                    <TextChips label="Tono" value={sel.tone || "light"}
                        options={[["light", "Claro"], ["dark", "Oscuro"]]}
                        onChange={(v) => patchText(sel.id, { tone: v as "light" | "dark" })} />
                    <p className="text-[10px] text-fg-faint leading-snug">
                        Claro para fondos oscuros, oscuro para estudio o ciclorama. Corré el texto en su pista
                        para cambiar cuándo aparece; los bordes cambian cuánto dura.
                    </p>
                    <button onClick={() => removeText(sel.id)}
                        className="flex items-center gap-1.5 text-[11px] text-fg-faint hover:text-fg cursor-pointer self-start">
                        <Trash2 size={11} /> Quitar este texto
                    </button>
                </aside>
            ) : onCommentsChange && (
                <aside className="w-[264px] shrink-0 flex flex-col gap-4 self-stretch border-l border-edge pl-5">
                    {/* Comentar en el instante actual */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-1.5">
                            <MessageSquare size={12} className="text-fg-muted" />
                            <span className="text-[12px] font-medium text-fg">Notas</span>
                        </div>
                        <p className="text-[11px] text-fg-faint leading-snug">
                            Pausá donde algo no está bien y escribí qué cambiar. La nota queda en ese instante.
                        </p>
                        <div className="rounded-[var(--radius-sm)] border border-edge bg-surface-1 focus-within:border-fg/40 transition-colors">
                            <div className="flex items-center gap-1.5 px-2.5 pt-2 text-[10px] text-fg-muted">
                                <span className="tabular-nums">En {fmt(globalTime)}</span>
                                <span className="text-fg-faint truncate">· {activeClip ? cleanTitle(activeClip.title) : ""}</span>
                            </div>
                            <textarea
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); addComment(false); } }}
                                rows={3}
                                placeholder="Ej.: que gire más lento, sin mover la cámara"
                                className="w-full bg-transparent border-0 px-2.5 py-1.5 text-[12px] text-fg placeholder:text-fg-faint outline-none resize-none"
                            />
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button onClick={() => addComment(false)} disabled={!draft.trim()}
                                className="h-7 px-1 text-[11px] text-fg-muted hover:text-fg disabled:opacity-30 cursor-pointer">
                                Anotar
                            </button>
                            <span className="flex-1" />
                            {onRegenerate && (
                                <button onClick={() => addComment(true)} disabled={!draft.trim() || !!busy}
                                    title="Vuelve a animar SÓLO este clip con tu indicación. El resto no se toca."
                                    className="flex items-center gap-1.5 h-7 px-1 text-[11px] text-fg hover:opacity-70 disabled:opacity-30 cursor-pointer">
                                    <Sparkles size={11} />
                                    Regenerar este clip{regenCost != null ? ` · $${regenCost.toFixed(2)}` : ""}
                                </button>
                            )}
                        </div>
                        {onRegenerate && durationOptions && durationOptions.length > 0 && (
                            <label className="flex items-center gap-2 text-[10px] text-fg-faint" title="Más largo que el actual = alargar el clip">
                                Duración
                                <select value={regenSecs || String(Math.round(curDur) || durationOptions[0])}
                                    onChange={(e) => setRegenSecs(e.target.value)}
                                    className="h-6 bg-surface-1 border border-edge rounded-[var(--radius-xs)] text-[10px] text-fg px-1.5 outline-none">
                                    {durationOptions.map((d) => <option key={d} value={d}>{d} s</option>)}
                                </select>
                            </label>
                        )}
                        {onRegenerate && (
                            <p className="text-[10px] text-fg-faint leading-snug">
                                Anotar la guarda para después. Regenerar vuelve a animar sólo este clip con tu nota.
                            </p>
                        )}
                        {regenError && <p className="text-[10px] text-[var(--color-error)] leading-snug">{regenError}</p>}
                    </div>

                    {/* Lista */}
                    <div className="flex-1 overflow-y-auto divide-y divide-edge">
                        {comments.length === 0 && (
                            <p className="pt-3 text-[11px] text-fg-faint leading-relaxed">
                                Todavía no hay notas.
                            </p>
                        )}
                        {[...comments].reverse().map((c) => {
                            const g = commentGlobal(c);
                            const clip = byId[c.clipId];
                            return (
                                <div key={c.id} className="group py-2.5 space-y-1.5">
                                    <div className="flex items-center gap-1.5 text-[10px]">
                                        <button onClick={() => g != null && seekTo(g)} disabled={g == null}
                                            className="tabular-nums text-fg-muted hover:text-fg cursor-pointer disabled:cursor-default">
                                            {g != null ? fmt(g) : "—"}
                                        </button>
                                        <span className="text-fg-faint truncate">{clip ? cleanTitle(clip.title) : "clip quitado"}</span>
                                        <span className="flex-1" />
                                        {c.status === "regenerated" && <span className="text-fg-faint">regenerado</span>}
                                        {c.status === "rule" && <span className="text-fg-faint">regla de la marca</span>}
                                        <button onClick={() => setComments(comments.filter((x) => x.id !== c.id))} title="Borrar comentario"
                                            className="text-fg-faint hover:text-fg opacity-0 group-hover:opacity-100 cursor-pointer">
                                            <X size={11} />
                                        </button>
                                    </div>
                                    <p className="text-[12px] text-fg leading-snug">{c.text}</p>
                                    <div className="flex items-center gap-1">
                                        {onRegenerate && clip && (
                                            <button onClick={() => regenerate(c)} disabled={!!busy}
                                                className="flex items-center gap-1 h-5 pr-2 text-[10px] text-fg-faint hover:text-fg disabled:opacity-40 cursor-pointer">
                                                {busy === c.clipId ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                                                {busy === c.clipId ? "Regenerando…" : "Regenerar"}
                                            </button>
                                        )}
                                        {onSaveRule && c.status !== "rule" && (
                                            <button onClick={() => saveRule(c)} disabled={savingRule === c.id}
                                                title="Suma este comentario a las reglas de movimiento de la marca: lo leen TODOS sus próximos videos."
                                                className="flex items-center gap-1 h-5 pr-2 text-[10px] text-fg-faint hover:text-fg disabled:opacity-40 cursor-pointer">
                                                {savingRule === c.id ? <Loader2 size={10} className="animate-spin" /> : <BookmarkPlus size={10} />}
                                                Regla de la marca
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </aside>
            )}
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
                {cur && versionsOf && versionsOf(cur.clipId) > 0 && onRestore && (
                    <button onClick={() => onRestore(cur.clipId)} title="Volver a la versión anterior de este clip"
                        className="flex items-center gap-1 h-7 px-2 rounded-[var(--radius-xs)] text-[10px] text-fg-faint hover:text-fg border border-edge cursor-pointer">
                        <Undo2 size={11} /> v{versionsOf(cur.clipId) + 1} · volver a la anterior
                    </button>
                )}
                <div className="flex-1" />
                {textTheme && onTextBlocksChange && (
                    <button onClick={() => addText()} disabled={!ready} title="Suma un texto en este instante"
                        className="flex items-center gap-1.5 h-8 px-2.5 rounded-[var(--radius-sm)] text-[11px] text-fg-muted hover:text-fg cursor-pointer disabled:opacity-40">
                        <Type size={12} /> Texto
                    </button>
                )}
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
              <div className="relative">
                {/* Regla: también se arrastra para recorrer el video */}
                <div
                    className="relative h-4 mb-1 cursor-ew-resize select-none"
                    onPointerDown={onScrubDown}
                    onPointerMove={onScrubMove}
                    onPointerUp={onScrubUp}
                >
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

                                {busy === ed.clipId && (
                                    <div className="absolute inset-0 z-20 bg-black/55 flex items-center justify-center">
                                        <Loader2 size={13} className="animate-spin text-white" />
                                    </div>
                                )}

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

                </div>

                {/* Pista de texto: cada texto es una barra (cuerpo = mover, bordes = duración) */}
                {textTheme && onTextBlocksChange && (
                    <div ref={textTrackRef} className="relative h-6 mt-1 rounded-[var(--radius-xs)] bg-surface-1/60 select-none"
                        onDoubleClick={(e) => {
                            const r = textTrackRef.current?.getBoundingClientRect();
                            if (r && total) { seekTo(((e.clientX - r.left) / r.width) * total); addText(); }
                        }}>
                        {shownTexts.length === 0 && (
                            <button onClick={() => addText()} className="absolute inset-0 text-left px-2 text-[10px] text-fg-faint hover:text-fg cursor-pointer">
                                + Texto · título, prenda, precio, CTA
                            </button>
                        )}
                        {total > 0 && shownTexts.map((b) => (
                            <div key={b.id}
                                onPointerDown={(e) => onTextDown(e, b, "move")} onPointerMove={onTextMove} onPointerUp={onTextUp}
                                onClick={(e) => e.stopPropagation()}
                                title={`${TEXT_STYLES[b.style].label} · ${fmt(b.start)}–${fmt(b.end)}`}
                                className={cn(
                                    "absolute top-0.5 bottom-0.5 rounded-[var(--radius-xs)] px-2 flex items-center text-[10px] truncate cursor-grab touch-none",
                                    b.id === selText ? "bg-fg text-[var(--color-canvas)]" : "bg-surface-3 text-fg-muted hover:text-fg",
                                )}
                                style={{ left: `${(b.start / total) * 100}%`, width: `${((b.end - b.start) / total) * 100}%` }}>
                                <span className="truncate pointer-events-none">{b.text || TEXT_STYLES[b.style].label}</span>
                                {(["start", "end"] as const).map((side) => (
                                    <span key={side}
                                        onPointerDown={(e) => onTextDown(e, b, side)} onPointerMove={onTextMove} onPointerUp={onTextUp}
                                        className={cn("absolute top-0 bottom-0 w-1.5 cursor-ew-resize", side === "start" ? "left-0" : "right-0")} />
                                ))}
                            </div>
                        ))}
                    </div>
                )}

                {/* Marcas de los comentarios sobre la regla */}
                {ready && total > 0 && comments.map((c) => {
                    const g = commentGlobal(c);
                    if (g == null) return null;
                    return (
                        <button key={c.id} onClick={() => seekTo(g)} title={c.text}
                            className="absolute top-0 z-20 -translate-x-1/2 w-1.5 h-1.5 mt-1 rounded-full bg-fg-muted hover:bg-fg cursor-pointer"
                            style={{ left: `${(g / total) * 100}%` }} />
                    );
                })}

                {/* Cabezal: cruza regla y pista. La manija de arriba se agarra y arrastra. */}
                {ready && total > 0 && (
                    <div
                        className="absolute top-0 bottom-0 z-30 -translate-x-1/2 flex flex-col items-center"
                        style={{ left: `${(globalTime / total) * 100}%` }}
                    >
                        <div
                            onPointerDown={onScrubDown}
                            onPointerMove={onScrubMove}
                            onPointerUp={onScrubUp}
                            title="Arrastrá para recorrer el video"
                            className="w-2.5 h-3 rounded-[2px] bg-fg cursor-ew-resize shrink-0 touch-none"
                        />
                        <div className="w-px flex-1 bg-fg pointer-events-none" />
                    </div>
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

/** Fila de opciones chicas (estilo, posición, tono) — monocromo, sin desplegables. */
function TextChips({ label, value, options, onChange }: {
    label: string; value: string; options: Array<[string, string]>; onChange: (v: string) => void;
}) {
    return (
        <div className="space-y-1.5">
            <span className="text-[10px] text-fg-faint">{label}</span>
            <div className="flex flex-wrap gap-1">
                {options.map(([id, text]) => (
                    <button key={id} onClick={() => onChange(id)}
                        className={cn(
                            "h-6 px-2 rounded-[var(--radius-xs)] text-[11px] border cursor-pointer transition-colors",
                            value === id ? "border-fg/60 text-fg bg-surface-2" : "border-edge text-fg-muted hover:text-fg",
                        )}>
                        {text}
                    </button>
                ))}
            </div>
        </div>
    );
}
