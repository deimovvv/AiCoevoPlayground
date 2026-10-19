import { Link, Outlet, useLocation } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useBrand } from "../../lib/BrandContext";
import { cn } from "../../lib/utils";

/**
 * Lo que ve el cliente (openspec/changes/studio-v2 §11): una barra mínima con su marca y nada del
 * menú de Studio. Hoy es una VISTA PREVIA para el equipo (mismo login, la marca activa); cuando
 * haya roles (§3), el cliente entra directo acá y sólo con sus marcas.
 */

const TABS = [
    { label: "Entregas", to: "/cliente", exact: true },
    { label: "Mi marca", to: "/cliente/marca", exact: false },
];

export function ClientLayout() {
    const { activeBrand } = useBrand();
    const { pathname } = useLocation();
    return (
        <div className="flex flex-col h-screen w-full overflow-hidden">
            <div className="h-8 shrink-0 flex items-center justify-center gap-3 bg-[var(--color-fg)] text-[var(--color-canvas)] text-[12px]">
                <span>Vista de cliente · así ve {activeBrand?.name ?? "la marca"} su espacio</span>
                <Link to="/dashboard/entregas" className="flex items-center gap-1 underline underline-offset-2 text-[var(--color-canvas)]">
                    <ArrowLeft size={12} /> Volver a Studio
                </Link>
            </div>
            <header className="h-14 shrink-0 flex items-center gap-7 px-6 border-b border-edge bg-[var(--color-canvas)]">
                <span className="text-[15px] tracking-[-0.02em] text-fg">
                    <span className="text-[19px] font-semibold tracking-[-0.045em]">coevo</span>
                    <span className="text-fg-faint"> × </span>{activeBrand?.name ?? ""}
                </span>
                <nav className="flex items-center gap-1 h-full" aria-label="Secciones">
                    {TABS.map((t) => {
                        const on = t.exact ? pathname === t.to : pathname.startsWith(t.to);
                        return (
                            <Link key={t.to} to={t.to} aria-current={on ? "page" : undefined}
                                className={cn("h-full flex items-center px-3 text-[13px] no-underline border-b-[1.5px]",
                                    on ? "text-fg border-fg" : "text-fg-faint border-transparent hover:text-fg")}>
                                {t.label}
                            </Link>
                        );
                    })}
                </nav>
            </header>
            <main className="flex-1 min-h-0 overflow-hidden">
                <Outlet />
            </main>
        </div>
    );
}
