import type { ReactNode } from "react";

/**
 * Molde de las pantallas del cliente (Mandar algo, Calendario, Equipo): el mismo corte que su Inicio.
 * A la izquierda, qué es esta pantalla (título grande, para qué sirve, algo de apoyo); a la derecha, lo
 * que se hace. Antes eran una columna de 620px centrada: en la compu quedaba un formulario perdido en
 * el medio. En el celular se apila igual que antes.
 */

const mono = "font-mono text-[10px] uppercase tracking-[0.09em]";

export function ClientPageShell({ kicker, title, lead, aside, children }: {
    kicker?: string; title: string; lead: ReactNode; aside?: ReactNode; children: ReactNode;
}) {
    return (
        <div className="h-full overflow-y-auto lg:overflow-hidden lg:grid lg:grid-cols-[minmax(360px,34%)_minmax(0,1fr)]">
            <section className="flex flex-col px-6 md:px-12 py-10 lg:py-14 lg:min-h-0 lg:overflow-y-auto lg:border-r border-edge">
                {kicker && <p className={`${mono} text-fg-faint mb-6`}>{kicker}</p>}
                <h1 className="text-[36px] md:text-[48px] leading-[0.98] font-light tracking-[-0.045em] text-fg">{title}</h1>
                <div className="mt-4 text-[16px] leading-snug text-fg-muted max-w-[380px]">{lead}</div>
                {aside && <div className="mt-10 lg:mt-auto lg:pt-10">{aside}</div>}
            </section>
            <section className="px-6 md:px-12 pb-14 lg:py-14 lg:min-h-0 lg:overflow-y-auto">
                {children}
            </section>
        </div>
    );
}
