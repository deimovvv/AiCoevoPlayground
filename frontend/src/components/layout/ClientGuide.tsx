import { useEffect, useState } from "react";
import { X } from "lucide-react";

/**
 * «¿Cómo funciona?» para el cliente (studio-v2): lo que puede hacer en su espacio, en cinco pasos.
 * Se abre solo la primera vez (se recuerda en este navegador) y después queda en la barra.
 * Cuando haya un video corto del recorrido, va en VIDEO_URL.
 */

const KEY = "coevo-cliente-guia-v1";
const VIDEO_URL: string | null = null;

const STEPS: Array<[string, string]> = [
    ["Revisá", "En Entregas está lo que te mandamos. Tocá una lámina para verla grande y tocá un punto de la imagen para dejar un comentario justo ahí."],
    ["Aprobá", "«Aprobar todo» si va todo. Si alguna no va: «Elegir cuáles», sacá las que no y «Aprobar 3 de 4». Si te arrepentís, «Cambiar mi elección»."],
    ["Pedí cambios", "«Pedir cambios» y escribí qué cambiarías. Te avisamos por mail cuando esté la versión nueva."],
    ["Mandanos material", "En «Mandar material»: fotos, un PDF, un link de Drive o Pinterest, o una nota. Lo ordenamos nosotros."],
    ["Tu marca y tu equipo", "En «Mi marca» ves cómo la entendemos. En «Equipo» ves quién tiene acceso (y, si sos el contacto principal, sumás gente)."],
];

function read(): boolean {
    try { return localStorage.getItem(KEY) === "1"; } catch { return true; }
}
function mark() {
    try { localStorage.setItem(KEY, "1"); } catch { /* sin almacenamiento: se vuelve a mostrar, no pasa nada */ }
}

export function ClientGuide({ auto }: { auto: boolean }) {
    const [open, setOpen] = useState(false);
    useEffect(() => {
        if (auto && !read()) {
            const t = setTimeout(() => setOpen(true), 600);
            return () => clearTimeout(t);
        }
    }, [auto]);
    const close = () => { mark(); setOpen(false); };

    return (
        <>
            <button onClick={() => setOpen(true)} className="shrink-0 text-[12px] text-fg-faint hover:text-fg cursor-pointer">¿Cómo funciona?</button>
            {open && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Cómo funciona"
                    onKeyDown={(e) => { if (e.key === "Escape") close(); }}>
                    <button aria-label="Cerrar" onClick={close} className="absolute inset-0 bg-black/40 backdrop-blur-[2px] cursor-default" />
                    <div className="relative w-full max-w-[520px] max-h-[90vh] overflow-y-auto rounded-[6px] border border-edge bg-[var(--color-canvas)] shadow-[var(--shadow-modal)]">
                        <header className="flex items-start gap-3 px-6 pt-6">
                            <div className="flex-1">
                                <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-fg-faint">Tu espacio con Coevo</p>
                                <h2 className="mt-2 text-[24px] leading-tight font-light tracking-[-0.03em] text-fg">Cómo funciona</h2>
                            </div>
                            <button onClick={close} aria-label="Cerrar" className="w-8 h-8 flex items-center justify-center text-fg-faint hover:text-fg cursor-pointer"><X size={15} /></button>
                        </header>
                        {VIDEO_URL && <video src={VIDEO_URL} controls playsInline className="mt-5 w-full bg-black" />}
                        <ol className="px-6 pt-4 pb-2">
                            {STEPS.map(([t, d], i) => (
                                <li key={t} className="flex gap-4 py-3.5 border-b border-edge last:border-0">
                                    <span className="font-mono text-[11px] text-fg-faint pt-0.5 w-5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                                    <span>
                                        <span className="block text-[14px] text-fg">{t}</span>
                                        <span className="block mt-1 text-[13px] leading-relaxed text-fg-muted">{d}</span>
                                    </span>
                                </li>
                            ))}
                        </ol>
                        <footer className="px-6 pb-6 pt-2 flex justify-end">
                            <button onClick={close} className="h-10 px-5 rounded-[4px] bg-[var(--color-action)] text-[var(--color-action-fg)] text-[13px] cursor-pointer">Entendido</button>
                        </footer>
                    </div>
                </div>
            )}
        </>
    );
}
