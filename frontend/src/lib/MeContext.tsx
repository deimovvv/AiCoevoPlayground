import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router";
import { fetchMe, type Me } from "./api";
import { MeContext, useMe } from "./useMe";

/**
 * Quién está mirando (studio-v2 §3). El rol lo decide el servidor (`/api/me`); acá sólo se usa
 * para llevar a cada uno a su lugar. Esconder algo en la pantalla NO es la seguridad: el servidor
 * ya le bloquea al cliente todo lo que no le toca (backend/services/roles.py).
 */

export function MeProvider({ children }: { children: ReactNode }) {
    const [me, setMe] = useState<Me | null>(null);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        fetchMe().then(setMe).catch(() => setFailed(true));
    }, []);
    if (failed) return <Centered>No se pudo conectar con Coevo Studio. Probá recargar.</Centered>;
    if (!me) return <Centered>Cargando…</Centered>;
    if (!me.role) return <NoAccess email={me.email} />;
    return <MeContext.Provider value={me}>{children}</MeContext.Provider>;
}

/** Studio (equipo y admin). Un cliente que cae acá va a su vista. */
export function TeamOnly({ children }: { children: ReactNode }) {
    const me = useMe();
    if (me.role === "cliente") return <Navigate to="/cliente" replace />;
    return <>{children}</>;
}

function Centered({ children }: { children: ReactNode }) {
    return <div className="h-screen flex items-center justify-center bg-[var(--color-canvas)] text-[14px] text-fg-muted px-6 text-center">{children}</div>;
}

function NoAccess({ email }: { email: string | null }) {
    return (
        <Centered>
            <div className="max-w-[420px] flex flex-col gap-3 items-center">
                <span className="text-[19px] font-semibold tracking-[-0.045em] text-fg">coevo</span>
                <p className="text-[17px] text-fg">Tu mail todavía no tiene acceso.</p>
                <p className="text-[13px] leading-relaxed">
                    Entraste como <span className="text-fg">{email ?? "—"}</span>. Pedile a Coevo que te dé acceso a tu marca y volvé a entrar.
                </p>
                {/* Cierra la sesión de Cloudflare Access: vuelve al login para elegir otro mail. */}
                <a href="/cdn-cgi/access/logout" className="mt-3 h-10 px-5 flex items-center rounded-[4px] border border-edge text-[13px] text-fg no-underline hover:border-fg">
                    Entrar con otro mail
                </a>
            </div>
        </Centered>
    );
}
