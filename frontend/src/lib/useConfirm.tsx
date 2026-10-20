import { useCallback, useRef, useState, type ReactNode } from "react";

/**
 * Cartel propio para confirmar o pedir un texto, con el estilo de Studio (en vez de los
 * window.confirm / prompt del navegador: «app.coevoagency.com says…»).
 *
 *   const [dialog, ask] = useConfirm();
 *   if (await ask({ title: "¿Mandar al cliente?", confirm: "Mandar" })) …
 *   const nombre = await ask({ title: "Nueva campaña", input: "Nombre" });   // string | null
 *   …   return <>{dialog} …</>
 */

interface Ask {
    title: string;
    body?: ReactNode;
    confirm?: string;
    cancel?: string;
    danger?: boolean;
    /** Si viene, pide un texto: es el rótulo del campo. */
    input?: string;
    placeholder?: string;
    multiline?: boolean;
}

export function useConfirm(): [ReactNode, (a: Ask) => Promise<string | boolean | null>] {
    const [open, setOpen] = useState<Ask | null>(null);
    const [text, setText] = useState("");
    const resolver = useRef<(v: string | boolean | null) => void>(() => {});

    const ask = useCallback((a: Ask) => new Promise<string | boolean | null>((resolve) => {
        resolver.current = resolve;
        setText("");
        setOpen(a);
    }), []);
    const close = (v: string | boolean | null) => { setOpen(null); resolver.current(v); };
    const ok = () => close(open?.input ? (text.trim() || null) : true);

    const dialog = open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={open.title}
            onKeyDown={(e) => { if (e.key === "Escape") close(open.input ? null : false); }}>
            <button aria-label="Cancelar" onClick={() => close(open.input ? null : false)} className="absolute inset-0 bg-black/40 backdrop-blur-[2px] cursor-default" />
            <div className="relative w-full max-w-[420px] rounded-[6px] border border-edge bg-[var(--color-canvas)] shadow-[var(--shadow-modal)] p-6 flex flex-col gap-4">
                <h2 className="text-[17px] tracking-[-0.015em] text-fg">{open.title}</h2>
                {open.body && <div className="text-[13px] leading-relaxed text-fg-muted">{open.body}</div>}
                {open.input && (
                    <label className="flex flex-col gap-1.5 text-[12px] text-fg-muted">
                        {open.input}
                        {open.multiline
                            ? <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder={open.placeholder}
                                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ok(); }}
                                className="px-3 py-2.5 rounded-[4px] border border-edge bg-[var(--color-surface-1)] text-[14px] text-fg outline-none focus:border-fg/40 resize-none" />
                            : <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={open.placeholder}
                                onKeyDown={(e) => { if (e.key === "Enter") ok(); }}
                                className="h-10 px-3 rounded-[4px] border border-edge bg-[var(--color-surface-1)] text-[14px] text-fg outline-none focus:border-fg/40" />}
                    </label>
                )}
                <div className="flex justify-end gap-2 pt-1">
                    <button onClick={() => close(open.input ? null : false)} className="h-9 px-3 text-[13px] text-fg-muted hover:text-fg cursor-pointer">{open.cancel ?? "Cancelar"}</button>
                    <button autoFocus={!open.input} onClick={ok} disabled={!!open.input && !text.trim()}
                        className={`h-9 px-4 rounded-[4px] text-[13px] cursor-pointer disabled:opacity-35 ${open.danger ? "bg-[var(--color-error)] text-white" : "bg-[var(--color-action)] text-[var(--color-action-fg)]"}`}>
                        {open.confirm ?? "Confirmar"}
                    </button>
                </div>
            </div>
        </div>
    ) : null;
    return [dialog, ask];
}
