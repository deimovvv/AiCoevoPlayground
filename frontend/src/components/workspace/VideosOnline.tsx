import { useEffect, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { useBrand } from "../../lib/BrandContext";
import { addServerVideoClip, createServerVideo, listServerVideos, type ServerVideo } from "../../lib/api";

/**
 * Videos de la marca en el servidor (studio-v2): «Nuevo video» → elegís los clips → se suben de a uno
 * y el editor abre el proyecto. Es lo que permite usar el editor desde app.coevoagency.com, donde las
 * carpetas de la Mac no existen.
 */

const mono = "font-mono text-[10px] uppercase tracking-[0.09em]";
const FORMATS = [
    { label: "Vertical 9:16", width: 1080, height: 1920 },
    { label: "Horizontal 16:9", width: 1920, height: 1080 },
    { label: "Cuadrado 1:1", width: 1080, height: 1080 },
    { label: "4:5", width: 1080, height: 1350 },
];
const when = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });

export function VideosOnline({ onOpen }: { onOpen: (path: string) => void }) {
    const { activeBrand } = useBrand();
    const brandId = activeBrand?.id;
    const [videos, setVideos] = useState<ServerVideo[] | null>(null);
    const [title, setTitle] = useState("");
    const [fmt, setFmt] = useState(0);
    const [status, setStatus] = useState<string | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const ref = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!brandId) return;
        let alive = true;
        listServerVideos(brandId).then((v) => alive && setVideos(v)).catch(() => alive && setVideos([]));
        return () => { alive = false; };
    }, [brandId]);

    const create = async (list: FileList | null) => {
        const files = Array.from(list || []).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        if (!brandId || !files.length) return;
        setErr(null);
        try {
            const v = await createServerVideo(brandId, title.trim() || files[0].name.replace(/\.[^.]+$/, ""), FORMATS[fmt]);
            for (let i = 0; i < files.length; i++) {
                await addServerVideoClip(brandId, v.id, files[i], (p) => setStatus(`Subiendo clip ${i + 1} de ${files.length} · ${Math.round(p * 100)}%`));
            }
            setStatus(null);
            onOpen(v.path);
        } catch (e) { setErr((e as Error).message); setStatus(null); }
    };

    return (
        <div className="grid gap-10 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] pt-4">
            <section>
                <p className={`${mono} text-fg-faint pb-3`}>Videos de {activeBrand?.name}</p>
                {videos === null && <p className="py-4 border-t border-edge text-[13px] text-fg-faint">Cargando…</p>}
                {videos?.length === 0 && <p className="py-4 border-t border-edge text-[13px] text-fg-faint">Todavía no hay videos. Armá uno subiendo clips.</p>}
                {videos?.map((v) => (
                    <button key={v.id} onClick={() => onOpen(v.path)}
                        className="w-full flex items-center gap-4 py-3.5 border-t border-edge text-left cursor-pointer hover:bg-[var(--color-surface-1)] px-2">
                        <span className="flex-1 min-w-0">
                            <span className="block text-[14px] text-fg truncate">{v.title}</span>
                            <span className="block text-[12px] text-fg-faint">{v.segments} {v.segments === 1 ? "tramo" : "tramos"} · {when(v.updatedAt)}</span>
                        </span>
                        <span className="text-[12px] text-fg">Abrir →</span>
                    </button>
                ))}
            </section>

            <aside className="flex flex-col gap-4">
                <p className="text-[15px] text-fg">Nuevo video</p>
                <label className="flex flex-col gap-1.5 text-[12px] text-fg-muted">Nombre
                    <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Recorrido de Studio"
                        className="h-9 px-3 rounded-[4px] border border-edge bg-[var(--color-surface-1)] text-[13px] text-fg outline-none focus:border-fg/40" />
                </label>
                <div className="flex flex-wrap gap-1.5">
                    {FORMATS.map((f, i) => (
                        <button key={f.label} onClick={() => setFmt(i)}
                            className={`h-8 px-3 rounded-full border text-[12px] cursor-pointer ${fmt === i ? "border-fg bg-fg text-[var(--color-canvas)]" : "border-edge text-fg-muted hover:text-fg"}`}>
                            {f.label}
                        </button>
                    ))}
                </div>
                <button onClick={() => ref.current?.click()} disabled={!!status}
                    className="h-28 rounded-[4px] border border-dashed border-[var(--color-edge-strong)] flex flex-col items-center justify-center gap-1.5 text-[13px] text-fg-muted hover:text-fg hover:border-fg cursor-pointer disabled:cursor-default">
                    {status ? <><Loader2 size={16} className="animate-spin" /> {status}</> : <><Upload size={16} /> Elegí los clips (videos o imágenes)</>}
                    {!status && <span className="text-[11px] text-fg-faint">Quedan en el orden del nombre · hasta 95 MB cada uno</span>}
                </button>
                <input ref={ref} type="file" multiple accept="video/*,image/*" hidden onChange={(e) => { create(e.target.files); e.target.value = ""; }} />
                {err && <p className="text-[12px] text-[var(--color-error)]">{err}</p>}
            </aside>
        </div>
    );
}
