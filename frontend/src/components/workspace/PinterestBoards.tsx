/**
 * Los tableros de Pinterest de la marca dentro de un selector (changes/modulos · Campaña).
 * ────────────────────────────────────────────────────────────────────────────────────────
 * Los tableros se importan a Marca (`importar.py`) y quedan como imágenes con `board`; acá se
 * agrupan por tablero. Dos modos, según el campo:
 *   · `board` — el tablero ENTERO es la elección (moodboard: se lee junto, como un mundo).
 *   · `image` — se abre el tablero y se elige UNA imagen (luz, locación, pose: un solo dominio).
 * Pegar un link trae el tablero a la marca, así lo ven todos los playbooks, no sólo esta campaña.
 */
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { importPinterest, type PinterestDest } from "../../lib/api";

export interface BoardImage { id: string; name: string; imageUrl: string; board?: string; source?: string }

/** Imágenes agrupadas por tablero, en el orden en que se importaron. */
function groupBoards(items: BoardImage[]): Array<{ name: string; items: BoardImage[] }> {
    const out = new Map<string, BoardImage[]>();
    items.forEach((it) => { if (it.board) out.set(it.board, [...(out.get(it.board) || []), it]); });
    return [...out].map(([name, list]) => ({ name, items: list }));
}

export function PinterestBoards({ brandId, dest, items, thumb, mode, selectedBoard, selectedId, onPickBoard, onPickImage, onImported }: {
    brandId: string;
    dest: PinterestDest;
    items: BoardImage[];
    thumb: (url: string) => string;
    mode: "board" | "image";
    selectedBoard?: string | null;
    selectedId?: string | null;
    onPickBoard?: (board: string | null) => void;
    onPickImage?: (id: string | null) => void;
    /** Después de importar: recargar la marca para que aparezca el tablero. */
    onImported: () => Promise<void>;
}) {
    const boards = groupBoards(items);
    const [open, setOpen] = useState<string | null>(null);
    const [url, setUrl] = useState("");
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

    const bring = async () => {
        if (!url.trim() || busy) return;
        setBusy(true); setMsg(null);
        try {
            const r = await importPinterest(brandId, { url: url.trim(), dest });
            await onImported();
            setUrl("");
            setOpen(r.board);
            setMsg({ ok: true, text: r.added ? `«${r.board}»: ${r.added} imágenes nuevas.` : `«${r.board}» ya estaba al día.` });
        } catch (e) {
            setMsg({ ok: false, text: e instanceof Error ? e.message : "No se pudo traer el tablero" });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
                <div className="flex gap-1.5">
                    <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && bring()}
                        placeholder="Link de un tablero público" aria-label="Link de un tablero de Pinterest"
                        className="flex-1 min-w-0 h-8 px-2.5 text-[12px] bg-transparent text-fg rounded-[2px] border border-edge outline-none focus:border-fg-muted" />
                    <button onClick={bring} disabled={busy || !url.trim()}
                        className="h-8 px-3 text-[12px] rounded-[2px] border border-edge text-fg cursor-pointer disabled:opacity-40 flex items-center gap-1.5">
                        {busy && <Loader2 size={12} className="animate-spin" />}{busy ? "Trayendo" : "Traer"}
                    </button>
                </div>
                <p className={`text-[11px] ${msg && !msg.ok ? "text-[var(--color-error)]" : "text-fg-faint"}`}>
                    {msg?.text ?? "Trae los últimos 25 pines. Queda en Marca, para todas las campañas."}
                </p>
            </div>

            {boards.length === 0 && <p className="text-[11.5px] text-fg-faint py-4 text-center">Todavía no hay tableros acá.</p>}

            {boards.map((bd) => {
                const on = mode === "board" && selectedBoard === bd.name;
                const expanded = mode === "image" && open === bd.name;
                return (
                    <div key={bd.name} className="flex flex-col gap-2">
                        <button type="button"
                            onClick={() => mode === "board" ? onPickBoard?.(on ? null : bd.name) : setOpen(expanded ? null : bd.name)}
                            className="text-left cursor-pointer rounded-[2px] p-1.5 -m-1.5"
                            style={{ boxShadow: on ? "0 0 0 1px var(--color-action)" : undefined }}>
                            <span className="grid grid-cols-4 gap-1">
                                {bd.items.slice(0, 4).map((it) => (
                                    <img key={it.id} src={thumb(it.imageUrl)} alt="" className="w-full aspect-[4/5] object-cover rounded-[2px] bg-[var(--color-surface-1)]" />
                                ))}
                            </span>
                            <span className="flex items-baseline gap-2 mt-1.5">
                                <span className="text-[12px] text-fg truncate">{bd.name}</span>
                                <span className="font-mono text-[10px] text-fg-faint">{bd.items.length}</span>
                                <span className="flex-1" />
                                <span className="text-[11px] text-fg-muted">
                                    {mode === "board" ? (on ? "Elegido" : "Usar el tablero") : expanded ? "Cerrar" : "Elegir una"}
                                </span>
                            </span>
                        </button>
                        {expanded && (
                            <div className="grid grid-cols-4 gap-1">
                                {bd.items.map((it) => {
                                    const sel = selectedId === it.id;
                                    return (
                                        <button key={it.id} type="button" title={it.name} onClick={() => onPickImage?.(sel ? null : it.id)}
                                            className="cursor-pointer rounded-[2px] overflow-hidden"
                                            style={{ boxShadow: sel ? "0 0 0 2px var(--color-action)" : undefined }}>
                                            <img src={thumb(it.imageUrl)} alt={it.name} className="w-full aspect-[4/5] object-cover" />
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
