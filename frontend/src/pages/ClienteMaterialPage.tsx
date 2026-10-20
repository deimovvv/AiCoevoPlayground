import { useEffect, useRef, useState } from "react";
import { FileText, Film, Link2, Loader2, Upload, X } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import { backendUrl, listInbox, sendMaterial, type InboxItem } from "../lib/api";

/**
 * «Mandar material» del cliente (studio-v2 §12/§15). Cero fricción: suelta lo que tenga (fotos,
 * PDF, video), pega un link si es pesado, y si quiere dice para qué es. No elige tipos ni bloques:
 * lo ordena el equipo. Pensado primero para el celular (fotos desde la galería o la cámara).
 */

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" }) : "");

export function ClienteMaterialPage() {
    const { activeBrand } = useBrand();
    const brandId = activeBrand?.id;
    const [files, setFiles] = useState<File[]>([]);
    const [link, setLink] = useState("");
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
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

    const add = (list: FileList | null) => { if (list) setFiles((f) => [...f, ...Array.from(list)].slice(0, 100)); setSent(false); };
    const send = async () => {
        if (!brandId) return;
        setBusy(true); setErr(null);
        try {
            const item = await sendMaterial(brandId, { files, link: link.trim(), note: note.trim() });
            setHistory((h) => [item, ...h]);
            setFiles([]); setLink(""); setNote(""); setSent(true);
        } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
    };
    const ready = files.length > 0 || link.trim() || note.trim();

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-[1100px] mx-auto px-4 md:px-10 py-8 md:py-12 grid gap-12 grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                <section className="flex flex-col gap-5">
                    <div>
                        <h1 className="text-[34px] md:text-[44px] leading-[1.02] tracking-[-0.035em] text-fg">Mandanos material</h1>
                        <p className="mt-3 text-[14px] leading-relaxed text-fg-muted max-w-[460px]">
                            Lo que tengas, como lo tengas: fotos, referencias, un PDF, productos nuevos. Nosotros lo ordenamos.
                        </p>
                    </div>

                    <button type="button" onClick={() => ref.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
                        onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
                        className={`min-h-[180px] rounded-[6px] border-[1.5px] border-dashed flex flex-col items-center justify-center gap-2 px-6 text-center cursor-pointer transition-colors ${over ? "border-fg bg-[var(--color-surface-2)]" : "border-[var(--color-edge-strong)] hover:border-fg"}`}>
                        <Upload size={22} className="text-fg-muted" />
                        <span className="text-[16px] text-fg">Elegí o soltá archivos</span>
                        <span className="text-[12px] text-fg-faint">Fotos, PDF o video · hasta 100 por vez</span>
                    </button>
                    <input ref={ref} type="file" multiple accept="image/*,video/*,application/pdf" hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />

                    {files.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {files.map((f, i) => (
                                <figure key={i} className="relative shrink-0 w-20 h-24 rounded-[3px] overflow-hidden bg-[var(--color-surface-2)] flex items-center justify-center">
                                    {f.type.startsWith("image/")
                                        ? <img src={URL.createObjectURL(f)} alt={f.name} className="w-full h-full object-cover" />
                                        : f.type.startsWith("video/") ? <Film size={18} className="text-fg-muted" /> : <FileText size={18} className="text-fg-muted" />}
                                    <button onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Quitar ${f.name}`}
                                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer"><X size={11} /></button>
                                </figure>
                            ))}
                        </div>
                    )}

                    <label className="flex flex-col gap-1.5 text-[12px] text-fg-muted">
                        <span className="flex items-center gap-1.5"><Link2 size={12} /> ¿Es pesado o está en otro lado? Pegá el link</span>
                        <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Drive, Pinterest, WeTransfer, Instagram…"
                            className="h-11 px-3 rounded-[4px] border border-edge bg-[var(--color-surface-1)] text-[14px] text-fg outline-none focus:border-fg/40" />
                    </label>
                    <label className="flex flex-col gap-1.5 text-[12px] text-fg-muted">
                        ¿Para qué es? (opcional)
                        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Ej: para la campaña de otoño, quiero esta luz"
                            className="px-3 py-2.5 rounded-[4px] border border-edge bg-[var(--color-surface-1)] text-[14px] text-fg outline-none focus:border-fg/40 resize-none" />
                    </label>
                    {err && <p className="text-[13px] text-[var(--color-error)]">{err}</p>}
                    {sent && <p className="text-[13px] text-[var(--color-success)]">Listo, nos llegó. Te avisamos cuando lo sumemos.</p>}
                    <button onClick={send} disabled={!ready || busy}
                        className="self-start h-12 px-7 flex items-center gap-2 rounded-[4px] bg-[var(--color-action)] text-[var(--color-action-fg)] text-[15px] cursor-pointer disabled:opacity-35">
                        {busy ? <><Loader2 size={15} className="animate-spin" /> Mandando…</> : "Mandar"}
                    </button>
                </section>

                <section className="flex flex-col">
                    <h2 className="text-[18px] text-fg pb-3 border-b border-edge">Lo que mandaste</h2>
                    {history.length === 0 && <p className="py-4 text-[13px] text-fg-faint">Todavía nada.</p>}
                    {history.map((h) => {
                        const thumbs = h.files.filter((f) => f.kind === "image").slice(0, 3);
                        return (
                            <div key={h.id} className="flex gap-3 py-4 border-b border-edge">
                                <div className="flex gap-1 shrink-0">
                                    {thumbs.length ? thumbs.map((f) => <img key={f.url} src={backendUrl(f.url)} alt="" className="w-11 h-14 object-cover rounded-[2px]" />)
                                        : <span className="w-11 h-14 rounded-[2px] bg-[var(--color-surface-2)] flex items-center justify-center">{h.link ? <Link2 size={14} className="text-fg-muted" /> : <FileText size={14} className="text-fg-muted" />}</span>}
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col gap-1">
                                    <span className="text-[13px] text-fg truncate">{h.note || (h.files.length ? `${h.files.length} archivos` : h.link)}</span>
                                    <span className="text-[12px] text-fg-faint">{when(h.createdAt)}{h.files.length ? ` · ${h.files.length} archivos` : ""}{h.link ? " · link" : ""}</span>
                                    <span className={`text-[12px] ${h.status === "incorporado" ? "text-[var(--color-success)]" : h.status === "descartado" ? "text-fg-faint" : "text-[var(--color-warning)]"}`}>
                                        {h.status === "nuevo" ? "◐ Lo estamos revisando" : h.status === "incorporado" ? `● ${h.result}` : h.result}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </section>
            </div>
        </div>
    );
}
