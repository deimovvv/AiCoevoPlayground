import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, FileText, Film, Link2, X } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import { MAX_UPLOAD_MB, backendUrl, listInbox, sendMaterial, type InboxItem } from "../lib/api";

/**
 * «Mandar material» del cliente (studio-v2 §12/§15). Cero fricción: suelta lo que tenga (fotos,
 * PDF, video), pega un link si es pesado, y si quiere dice para qué es. No elige tipos ni bloques:
 * lo ordena el equipo. Una columna, líneas finas, pensada primero para el celular.
 */

const mono = "font-mono text-[10px] uppercase tracking-[0.09em]";
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" }) : "");
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(n > 10 * 1024 * 1024 ? 0 : 1)} MB`;

export function ClienteMaterialPage() {
    const { activeBrand } = useBrand();
    const brandId = activeBrand?.id;
    const [files, setFiles] = useState<File[]>([]);
    const [link, setLink] = useState("");
    const [note, setNote] = useState("");
    const [progress, setProgress] = useState<number | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [sent, setSent] = useState(false);
    const [over, setOver] = useState(false);
    const [history, setHistory] = useState<InboxItem[]>([]);
    const ref = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!brandId) return;
        let alive = true;
        listInbox(brandId).then((h) => alive && setHistory(h)).catch(() => {});
        return () => { alive = false; };
    }, [brandId]);

    const add = (list: FileList | null) => { if (list) { setFiles((f) => [...f, ...Array.from(list)].slice(0, 100)); setSent(false); setErr(null); } };
    const send = async () => {
        if (!brandId) return;
        setErr(null); setProgress(0);
        try {
            const item = await sendMaterial(brandId, { files, link: link.trim(), note: note.trim() }, setProgress);
            setHistory((h) => [item, ...h]);
            setFiles([]); setLink(""); setNote(""); setSent(true);
        } catch (e) { setErr((e as Error).message); } finally { setProgress(null); }
    };
    const busy = progress !== null;
    const ready = files.length > 0 || link.trim() || note.trim();
    const total = files.reduce((n, f) => n + f.size, 0);

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-[620px] mx-auto px-5 py-10 md:py-16 flex flex-col">
                <p className={`${mono} text-fg-faint`}>Mandar material · {activeBrand?.name}</p>
                <h1 className="mt-3 text-[30px] md:text-[36px] leading-[1.05] font-light tracking-[-0.035em] text-fg">Lo que tengas, como lo tengas.</h1>
                <p className="mt-3 text-[14px] leading-relaxed text-fg-muted">Fotos, referencias, un PDF, productos nuevos. Nosotros lo ordenamos y te avisamos.</p>

                <button type="button" onClick={() => ref.current?.click()} disabled={busy}
                    onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
                    onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
                    className={`mt-10 h-[120px] rounded-[4px] border border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${over ? "border-fg bg-[var(--color-surface-1)]" : "border-[var(--color-edge-strong)] hover:border-fg"}`}>
                    <span className="text-[14px] text-fg">Elegí o soltá archivos</span>
                    <span className="text-[12px] text-fg-faint">Fotos, PDF o video · hasta {MAX_UPLOAD_MB} MB por envío</span>
                </button>
                <input ref={ref} type="file" multiple accept="image/*,video/*,application/pdf" hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />

                {files.length > 0 && (
                    <div className="mt-3 flex flex-col">
                        <div className="flex gap-1.5 overflow-x-auto pb-1">
                            {files.map((f, i) => (
                                <figure key={i} className="group relative shrink-0 w-16 h-20 rounded-[2px] overflow-hidden bg-[var(--color-surface-2)] flex items-center justify-center">
                                    {f.type.startsWith("image/")
                                        ? <img src={URL.createObjectURL(f)} alt={f.name} className="w-full h-full object-cover" />
                                        : f.type.startsWith("video/") ? <Film size={16} className="text-fg-muted" /> : <FileText size={16} className="text-fg-muted" />}
                                    {!busy && (
                                        <button onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Quitar ${f.name}`}
                                            className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer"><X size={10} /></button>
                                    )}
                                </figure>
                            ))}
                        </div>
                        <p className="mt-1.5 text-[11px] text-fg-faint">{files.length} {files.length === 1 ? "archivo" : "archivos"} · {mb(total)}</p>
                    </div>
                )}

                <div className="mt-8 flex flex-col">
                    <label className="flex flex-col gap-1 py-3 border-t border-edge">
                        <span className={`${mono} text-fg-faint flex items-center gap-1.5`}><Link2 size={11} /> Link (opcional)</span>
                        <input type="url" value={link} onChange={(e) => setLink(e.target.value)} disabled={busy} placeholder="Drive, Pinterest, WeTransfer…"
                            className="h-9 bg-transparent text-[15px] text-fg placeholder:text-fg-faint outline-none" />
                    </label>
                    <label className="flex flex-col gap-1 py-3 border-t border-b border-edge">
                        <span className={`${mono} text-fg-faint`}>¿Para qué es? (opcional)</span>
                        <textarea value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} rows={2} placeholder="Ej: para la campaña de otoño, quiero esta luz"
                            className="bg-transparent text-[15px] leading-relaxed text-fg placeholder:text-fg-faint outline-none resize-none" />
                    </label>
                </div>

                {busy && (
                    <div className="mt-6 flex flex-col gap-1.5">
                        <div className="h-[2px] bg-[var(--color-surface-2)] overflow-hidden">
                            <div className="h-full bg-fg transition-[width] duration-200" style={{ width: `${Math.max(2, progress! * 100)}%` }} />
                        </div>
                        <p className="text-[12px] text-fg-muted">{progress! < 1 ? `Subiendo… ${Math.round(progress! * 100)}%` : "Guardando…"}</p>
                    </div>
                )}
                {err && <p className="mt-5 text-[13px] text-[var(--color-error)]">{err}</p>}
                {sent && !busy && <p className="mt-5 text-[13px] text-fg">Listo, nos llegó. Te avisamos cuando lo sumemos.</p>}

                <div className="mt-6">
                    <button onClick={send} disabled={!ready || busy}
                        className="h-11 px-6 flex items-center gap-2 rounded-[4px] bg-[var(--color-action)] text-[var(--color-action-fg)] text-[14px] cursor-pointer disabled:opacity-30">
                        Mandar <ArrowUpRight size={14} />
                    </button>
                </div>

                <section className="mt-16">
                    <p className={`${mono} text-fg-faint pb-3`}>Lo que mandaste</p>
                    {history.length === 0 && <p className="py-4 border-t border-edge text-[13px] text-fg-faint">Todavía nada.</p>}
                    {history.map((h) => {
                        const thumbs = h.files.filter((f) => f.kind === "image").slice(0, 3);
                        return (
                            <div key={h.id} className="flex items-center gap-3 py-3.5 border-t border-edge">
                                <div className="flex gap-1 shrink-0">
                                    {thumbs.length ? thumbs.map((f) => <img key={f.url} src={backendUrl(f.url)} alt="" className="w-9 h-11 object-cover rounded-[2px]" />)
                                        : <span className="w-9 h-11 rounded-[2px] bg-[var(--color-surface-2)] flex items-center justify-center">{h.link ? <Link2 size={13} className="text-fg-muted" /> : <FileText size={13} className="text-fg-muted" />}</span>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] text-fg truncate">{h.note || (h.files.length ? `${h.files.length} archivos` : h.link)}</p>
                                    <p className="text-[12px] text-fg-faint truncate">
                                        {when(h.createdAt)} · {h.status === "nuevo" ? "lo estamos revisando" : h.result}
                                    </p>
                                </div>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${h.status === "incorporado" ? "bg-[var(--color-success)]" : h.status === "nuevo" ? "bg-[var(--color-warning)]" : "bg-[var(--color-edge-strong)]"}`} />
                            </div>
                        );
                    })}
                </section>
            </div>
        </div>
    );
}
