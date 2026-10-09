import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { FolderOpen, Loader2, RefreshCw, ExternalLink } from "lucide-react";
import {
    loadEditorProject, editorProjectMtime, saveEditorProject, saveEditorNotes, exportEditorProject,
    editorFileUrl, uploadMusic, detectMusicBeats,
    type EditorProjectLoad, type EditorProject,
} from "../lib/api";
import { VideoTimeline, type TimelineClip, type TimelineComment, type ExportQa } from "../components/workspace/VideoTimeline";
import { exportSignature, type TextBlock, type TextTheme } from "../components/workspace/textLayerModel";
import type { MusicTrack } from "../components/workspace/musicModel";
import { segLength, segmentsToEdits, editsToSegments, noteTime, isImageSrc, type Seg, type ClipEdit } from "../components/workspace/editorProjectModel";
import { loadBrandFonts, googleFontUrl, getCanvasFontFamily } from "../tools/shared/fontLoader";

/**
 * Editor de un proyecto `timeline.json` en una carpeta local.
 * openspec/changes/archive/2026-10-09-editor-timeline-project — Claude (desde una skill) y esta pantalla editan
 * el MISMO archivo: lo que se cambia acá se guarda ahí; si Claude lo cambia, se recarga.
 * Las notas por momento van a `notas.md` de la carpeta, para que Claude las lea.
 */
export function EditorProjectPage() {
    const [params, setParams] = useSearchParams();
    const path = params.get("path") || "";
    const [draftPath, setDraftPath] = useState(path);
    const [data, setData] = useState<EditorProjectLoad | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [version, setVersion] = useState(0);          // remonta el editor al recargar
    const [exported, setExported] = useState<{ file: string; duration: number } | null>(null);
    const [qa, setQa] = useState<ExportQa | null>(null);
    const mtimeRef = useRef(0);
    const saving = useRef(false);
    const editsRef = useRef<ClipEdit[]>([]);

    const load = useCallback(async (why?: string) => {
        if (!path) return;
        setLoading(true); setError(null);
        try {
            const r = await loadEditorProject(path);
            mtimeRef.current = r.mtime;
            editsRef.current = segmentsToEdits(r.project.segments as Seg[], r.media);
            setData(r); setVersion((v) => v + 1);
            if (why) setNotice(why);
        } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo abrir el proyecto");
        } finally { setLoading(false); }
    }, [path]);
    useEffect(() => { load(); }, [load]);

    // Si Claude cambia timeline.json, se recarga (se mira la fecha cada 2 s).
    useEffect(() => {
        if (!path || !data) return;
        const id = setInterval(async () => {
            if (saving.current) return;
            try {
                const m = await editorProjectMtime(path);
                if (m > mtimeRef.current + 0.001) load("timeline.json cambió en disco (¿lo editó Claude?) — se recargó.");
            } catch { /* carpeta no disponible: se reintenta */ }
        }, 2000);
        return () => clearInterval(id);
    }, [path, data, load]);

    const project = data?.project;
    const save = useCallback(async (patch: Partial<EditorProject>) => {
        if (!data || !project) return;
        const next = { ...project, ...patch };
        saving.current = true;
        try {
            const r = await saveEditorProject(path, next, mtimeRef.current);
            mtimeRef.current = r.mtime;
            setData({ ...data, project: next, mtime: r.mtime });
        } catch (e) {
            const err = e as Error & { conflict?: boolean };
            if (err.conflict) load("Claude cambió el proyecto mientras editabas: se recargó su versión. Rehacé el último cambio.");
            else setError(err.message);
        } finally { saving.current = false; }
    }, [data, project, path, load]);

    // ── Proyecto → editor ──
    const fileUrl = useCallback((rel: string) => (data ? editorFileUrl(data.dir, rel) : rel), [data]);
    const clips: TimelineClip[] = useMemo(() => (project?.segments as Seg[] | undefined || []).map((s) => {
        const img = isImageSrc(s.src);
        return {
            id: s.id, title: s.label || s.src, kind: img ? "image" : "video",
            videoUrl: fileUrl(s.src), imageUrl: img ? fileUrl(s.src) : undefined,
            in: img ? 0 : s.in ?? 0, length: segLength(s, data!.media),
            voiceUrl: s.voice ? fileUrl(s.voice) : undefined,
            overlayUrl: s.overlay ? fileUrl(s.overlay) : undefined,
        };
    }), [project, data, fileUrl]);
    const initialEdits = useMemo(() => (project ? segmentsToEdits(project.segments as Seg[], data!.media) : []), [project, data]);

    const theme = useMemo((): { theme: TextTheme; fontFamilies: string[]; fontUrls: string[] } => {
        const f = loadBrandFonts({ headline: project?.theme?.headline || "Inter", body: project?.theme?.body || "Inter" });
        const families = [...new Set([getCanvasFontFamily(f.headline), getCanvasFontFamily(f.body)])];
        const accent = project?.theme?.accent || "#ffffff";
        return { theme: { headline: f.headline, body: f.body, accent, accentInk: "#111111" }, fontFamilies: families, fontUrls: families.map(googleFontUrl) };
    }, [project?.theme]);

    // ── Editor → proyecto ──
    const onEditsCommit = (edits: ClipEdit[]) => {
        editsRef.current = edits;
        if (!project) return;
        save({ segments: editsToSegments(project.segments as Seg[], edits, data!.media) });
    };
    const onCommentsChange = (c: TimelineComment[]) => {
        save({ notes: c });
        saveEditorNotes(path, c.map((n) => ({
            t: noteTime(n.clipId, n.clipOffset, editsRef.current), segment: n.clipId, text: n.text, status: n.status,
        }))).catch(() => setNotice("No se pudo escribir notas.md"));
    };

    const onExport = async (edits: ClipEdit[], _edited: boolean, texts: Parameters<NonNullable<Parameters<typeof VideoTimeline>[0]["onExport"]>>[2]) => {
        if (!project || !data) return;
        const segs = editsToSegments(project.segments as Seg[], edits, data.media);
        const r = await exportEditorProject({
            path,
            segments: edits.map((e, i) => ({
                src: segs[i].src, in: e.start, duration: e.end - e.start,
                voice: segs[i].voice, overlay: segs[i].overlay,
            })),
            texts, theme: theme.theme, fontFamilies: theme.fontFamilies, fontUrls: theme.fontUrls,
            music: project.music || undefined,
        });
        setExported({ file: r.file, duration: r.duration });
        setQa(r.qa ? {
            checked: r.qa.checked, sig: exportSignature(edits, texts), at: new Date().toISOString(),
            issues: r.qa.issues.map((i) => ({ ...i, thumbUrl: i.thumbFile ? editorFileUrl(data.dir, i.thumbFile) : i.thumbUrl })),
        } : null);
        window.open(editorFileUrl(data.dir, r.file), "_blank");
    };

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-[1500px] mx-auto px-6 py-5 space-y-4">
                <header className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0">
                        <h1 className="text-[15px] font-medium text-fg truncate">{project?.title || "Editor de video"}</h1>
                        <p className="text-[11px] text-fg-faint truncate">
                            {data ? `${data.dir} · timeline.json` : "Abrí la carpeta de un proyecto con timeline.json"}
                        </p>
                    </div>
                    <span className="flex-1" />
                    <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); setParams(draftPath ? { path: draftPath } : {}); }}>
                        <input value={draftPath} onChange={(e) => setDraftPath(e.target.value)} placeholder="~/Downloads/mi-proyecto"
                            className="w-[340px] h-8 bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2.5 text-[12px] text-fg placeholder:text-fg-faint outline-none focus:border-fg/40" />
                        <button type="submit" className="flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-sm)] border border-edge text-[12px] text-fg-muted hover:text-fg cursor-pointer">
                            <FolderOpen size={13} /> Abrir
                        </button>
                        {data && (
                            <button type="button" onClick={() => load("Recargado.")} title="Recargar timeline.json"
                                className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] text-fg-muted hover:text-fg cursor-pointer">
                                <RefreshCw size={13} />
                            </button>
                        )}
                    </form>
                </header>

                {notice && (
                    <p className="text-[11px] text-fg-muted border-l-2 border-fg/30 pl-2 flex items-center gap-2">
                        {notice}
                        <button onClick={() => setNotice(null)} className="text-fg-faint hover:text-fg cursor-pointer">cerrar</button>
                    </p>
                )}
                {error && <p className="text-[12px] text-[var(--color-error)]">{error}</p>}
                {loading && !data && <p className="flex items-center gap-2 text-[12px] text-fg-muted"><Loader2 size={13} className="animate-spin" /> Abriendo…</p>}

                {data && project && clips.length > 0 && (
                    <>
                        <VideoTimeline
                            key={version}
                            clips={clips}
                            initialEdits={initialEdits}
                            onEditsCommit={onEditsCommit}
                            onExport={onExport}
                            comments={(project.notes as TimelineComment[] | undefined) || []}
                            onCommentsChange={onCommentsChange}
                            textBlocks={(project.texts as TextBlock[] | undefined) || []}
                            onTextBlocksChange={(b) => save({ texts: b })}
                            textTheme={theme.theme}
                            music={(project.music as MusicTrack | null | undefined) ?? null}
                            onMusicChange={(m) => save({ music: m })}
                            onUploadMusic={uploadMusic}
                            onDetectBeats={detectMusicBeats}
                            qa={qa}
                            aspect={project.width / project.height}
                            background={project.background || "#000000"}
                        />
                        <p className="text-[11px] text-fg-faint leading-relaxed">
                            Los cambios se guardan en <span className="text-fg-muted">timeline.json</span> y las notas en{" "}
                            <span className="text-fg-muted">notas.md</span>, en la misma carpeta. Para que Claude las aplique:
                            <span className="text-fg-muted"> "leé notas.md y aplicalas en timeline.json"</span>.
                            {exported && (
                                <>
                                    {" "}· Último export:{" "}
                                    <a href={editorFileUrl(data.dir, exported.file)} target="_blank" rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-fg-muted hover:text-fg underline decoration-fg/20 underline-offset-2">
                                        {exported.file} ({exported.duration?.toFixed(1)} s) <ExternalLink size={10} />
                                    </a>
                                </>
                            )}
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
