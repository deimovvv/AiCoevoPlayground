import { Link, Outlet, useLocation } from "react-router";
import { ArrowLeft, Moon, Sun } from "lucide-react";
import { useBrand } from "../../lib/BrandContext";
import { useTheme } from "../../lib/theme";
import { useMe } from "../../lib/useMe";
import { cn } from "../../lib/utils";
import { BrandPicker } from "./BrandPicker";
import { ClientGuide } from "./ClientGuide";

/**
 * Lo que ve el cliente (openspec/changes/studio-v2 §11): una barra mínima con su marca y nada del
 * menú de Studio. Un cliente (rol, §3) entra directo acá y sólo con sus marcas. Para el equipo es
 * una vista previa (franja negra arriba) con la marca activa.
 */

// «Calendario» sólo si la marca tiene el plan mensual (operacion.md §1c): a una marca de proyectos
// no se le programa nada, así que no tiene qué ver ahí.
const TABS = [
    { label: "Inicio", to: "/cliente", exact: true },
    { label: "Entregas", to: "/cliente/entregas", exact: false },
    { label: "Calendario", to: "/cliente/calendario", exact: false, plan: true },
    { label: "Mandar algo", to: "/cliente/material", exact: false },
    { label: "Mi marca", to: "/cliente/marca", exact: false },
    { label: "Equipo", to: "/cliente/personas", exact: false },
];

export function ClientLayout() {
    const { activeBrand, brands } = useBrand();
    const { theme, toggle } = useTheme();
    const me = useMe();
    const preview = me.role !== "cliente";
    const { pathname } = useLocation();
    return (
        <div className="flex flex-col h-screen w-full overflow-hidden">
            {preview && <div className="h-8 shrink-0 flex items-center justify-center gap-3 bg-[var(--color-fg)] text-[var(--color-canvas)] text-[12px]">
                <span>Vista de cliente · así ve {activeBrand?.name ?? "la marca"} su espacio</span>
                <Link to="/dashboard/entregas" className="flex items-center gap-1 underline underline-offset-2 text-[var(--color-canvas)]">
                    <ArrowLeft size={12} /> Volver a Studio
                </Link>
            </div>}
            {/* Escritorio: una fila. Celular: marca arriba y las secciones abajo, con desplazamiento lateral (como TopBar). */}
            <header className="shrink-0 flex flex-wrap md:flex-nowrap items-center gap-x-3 md:gap-x-7 px-4 md:px-6 md:h-14 border-b border-edge bg-[var(--color-canvas)]">
                <span className="h-14 flex-1 md:flex-none shrink-0 flex items-center gap-2 whitespace-nowrap text-[15px] tracking-[-0.02em] text-fg">
                    <span className="text-[19px] font-semibold tracking-[-0.045em]">coevo</span>
                    <span className="text-fg-faint">×</span>
                    {/* El equipo, en la vista previa, cambia de marca sin volver a Studio; un cliente con una sola marca ve su nombre. */}
                    {preview || brands.length > 1 ? <BrandPicker top client /> : activeBrand?.name ?? ""}
                </span>
                <nav className="order-last md:order-none w-full md:w-auto md:flex-1 min-w-0 flex items-center gap-1 h-11 md:h-full overflow-x-auto -mx-1 md:mx-0 border-t border-edge md:border-0" aria-label="Secciones">
                    {TABS.filter((t) => !t.plan || activeBrand?.workType === "plan").map((t) => {
                        const on = t.exact ? pathname === t.to : pathname.startsWith(t.to);
                        return (
                            <Link key={t.to} to={t.to} aria-current={on ? "page" : undefined}
                                className={cn("h-full shrink-0 flex items-center px-3 text-[13px] no-underline border-b-[1.5px]",
                                    on ? "text-fg border-fg" : "text-fg-faint border-transparent hover:text-fg")}>
                                {t.label}
                            </Link>
                        );
                    })}
                </nav>
                <ClientGuide auto={!preview} />
                <button onClick={toggle} aria-label={theme === "light" ? "Pasar a modo oscuro" : "Pasar a modo claro"}
                    className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-fg-faint hover:text-fg hover:bg-[var(--color-surface-2)] cursor-pointer">
                    {theme === "light" ? <Moon size={15} /> : <Sun size={15} />}
                </button>
                {!preview && <span className="hidden md:block shrink-0 text-[12px] text-fg-faint">{me.email}</span>}
            </header>
            <main className="flex-1 min-h-0 overflow-hidden">
                <Outlet />
            </main>
        </div>
    );
}
