import { useEffect, useMemo, useRef, useState } from "react";
import { Film, Loader2, Upload, X } from "lucide-react";

/**
 * «Nueva versión» de una entrega, en un solo panel y en orden: 1) las láminas corregidas (se eligen o se
 * sueltan, con vista previa), 2) qué cambiaron (lo ve el cliente), 3) subir. Antes el selector de archivos
 * se abría solo y después aparecía un cartel pidiendo un comentario: no se entendía qué se estaba subiendo.
 */
export function NewVersionDialog({ round, lamina, onClose, onSubmit, progress }: {
    round: number;
    /** Versión de una sola lámina («04»): se sube un archivo y las demás quedan como están. */
    lamina?: string;
    onClose: () => void;
    onSubmit: (files: File[], note: string) => Promise<void>;
    progress: number | null;
}) {
    const [files, setFiles] = useState<File[]>([]);
    const [note, setNote] = useState("");
    const [over, setOver] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const ref = useRef<HTMLInputElement>(null);
    const busy = progress !== null;

    const add = (list: FileList | null) => {
        const fs = Array.from(list || []).filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
        if (lamina) { if (fs[0]) setFiles([fs[0]]); return; }
        setFiles((cur) => [...cur, ...fs].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })));
    };
    const previews = useMemo(() => files.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : null)), [files]);
    useEffect(() => () => previews.forEach((u) => u && URL.revokeObjectURL(u)), [previews]);

    const go = async () => {
        setErr(null);
        try { await onSubmit(files, note); } catch (e) { setErr((e as Error).message); }
    };

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Versión ${round}`}>
            <button aria-label="Cerrar" onClick={() => !busy && onClose()} className="absolute inset-0 bg-black/40 backdrop-blur-[2px] cursor-default" />
            <div className="relative w-full max-w-[560px] max-h-[90vh] overflow-y-auto rounded-[6px] border border-edge bg-[var(--color-canvas)] shadow-[var(--shadow-modal)] p-6 flex flex-col gap-5">
                <div className="flex items-start gap-3">
                    <div className="flex-1">
                        <h2 className="text-[17px] text-fg">{lamina ? `Nueva versión de la lámina ${lamina}` : `Subir la versión ${round}`}</h2>
                        <p className="mt-1 text-[13px] text-fg-muted">{lamina
                            ? `Reemplaza sólo esta lámina; las demás pasan iguales a la versión ${round}. La anterior queda para que el cliente compare.`
                            : "Las láminas nuevas reemplazan a las actuales. La versión anterior queda para que el cliente compare."}</p>
                    </div>
                    <button onClick={onClose} disabled={busy} aria-label="Cerrar" className="w-8 h-8 flex items-center justify-center text-fg-faint hover:text-fg cursor-pointer"><X size={15} /></button>
                </div>

                <section className="flex flex-col gap-2">
                    <p className="text-[12px] text-fg-muted">1 · {lamina ? "La lámina corregida" : "Las láminas corregidas"}</p>
                    <button type="button" onClick={() => ref.current?.click()} disabled={busy}
                        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
                        onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
                        className={`h-24 rounded-[4px] border border-dashed flex flex-col items-center justify-center gap-1 text-[13px] cursor-pointer transition-colors ${over ? "border-fg bg-[var(--color-surface-2)] text-fg" : "border-[var(--color-edge-strong)] text-fg-muted hover:text-fg hover:border-fg"}`}>
                        <Upload size={16} /> {lamina ? (files.length ? "Elegir otra" : "Elegí o soltá la imagen / video") : files.length ? "Sumar más" : "Elegí o soltá las imágenes / videos"}
                        {!lamina && <span className="text-[11px] text-fg-faint">Van en el orden del nombre del archivo (01, 02…)</span>}
                    </button>
                    <input ref={ref} type="file" multiple={!lamina} hidden accept="image/*,video/*" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
                    {files.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {files.map((f, i) => (
                                <figure key={i} className="relative shrink-0 w-20">
                                    <span className="block w-20 h-24 rounded-[3px] overflow-hidden bg-[var(--color-surface-2)] flex items-center justify-center">
                                        {previews[i] ? <img src={previews[i]!} alt="" className="w-full h-full object-cover" /> : <Film size={16} className="text-fg-muted" />}
                                    </span>
                                    <figcaption className="mt-1 text-[10px] text-fg-faint truncate">{lamina ?? String(i + 1).padStart(2, "0")} · {f.name}</figcaption>
                                    {!busy && (
                                        <button onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Quitar ${f.name}`}
                                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer"><X size={10} /></button>
                                    )}
                                </figure>
                            ))}
                        </div>
                    )}
                </section>

                <section className="flex flex-col gap-2">
                    <p className="text-[12px] text-fg-muted">2 · Qué cambiaron <span className="text-fg-faint">(lo ve el cliente junto a la versión nueva)</span></p>
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} disabled={busy}
                        placeholder="Ej: los globos más grandes y la pose más para atrás, como pidieron."
                        className="px-3 py-2.5 rounded-[4px] border border-edge bg-[var(--color-surface-1)] text-[14px] text-fg placeholder:text-fg-faint outline-none focus:border-fg/40 resize-none" />
                </section>

                {busy && (
                    <div className="flex flex-col gap-1.5">
                        <div className="h-[3px] rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                            <div className="h-full bg-fg transition-[width] duration-200" style={{ width: `${Math.max(3, progress! * 100)}%` }} />
                        </div>
                        <p className="text-[12px] text-fg-muted">{progress! < 1 ? `Subiendo… ${Math.round(progress! * 100)}%` : "Guardando…"}</p>
                    </div>
                )}
                {err && <p className="text-[12px] text-[var(--color-error)]">{err}</p>}

                <div className="flex justify-end gap-2">
                    <button onClick={onClose} disabled={busy} className="h-9 px-3 text-[13px] text-fg-muted hover:text-fg cursor-pointer">Cancelar</button>
                    <button onClick={go} disabled={busy || !files.length}
                        className="h-9 px-4 flex items-center gap-1.5 rounded-[4px] bg-[var(--color-action)] text-[var(--color-action-fg)] text-[13px] cursor-pointer disabled:opacity-35">
                        {busy && <Loader2 size={13} className="animate-spin" />} {lamina ? `Subir la lámina ${lamina}` : `Subir versión ${round}`}
                    </button>
                </div>
            </div>
        </div>
    );
}
