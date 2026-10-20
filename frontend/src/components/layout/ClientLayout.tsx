import { Link, Outlet, useLocation } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useBrand } from "../../lib/BrandContext";
import { useMe } from "../../lib/useMe";
import { cn } from "../../lib/utils";

/**
 * Lo que ve el cliente (openspec/changes/studio-v2 §11): una barra mínima con su marca y nada del
 * menú de Studio. Un cliente (rol, §3) entra directo acá y sólo con sus marcas. Para el equipo es
 * una vista previa (franja negra arriba) con la marca activa.
 */

const TABS = [
    { label: "Inicio", to: "/cliente", exact: true },
    { label: "Entregas", to: "/cliente/entregas", exact: false },
    { label: "Mandar material", to: "/cliente/material", exact: false },
    { label: "Mi marca", to: "/cliente/marca", exact: false },
    { label: "Equipo", to: "/cliente/personas", exact: false },
];

export function ClientLayout() {
    const { activeBrand, brands, setActiveBrandId } = useBrand();
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
            <header className="h-14 shrink-0 flex items-center gap-3 md:gap-7 px-4 md:px-6 border-b border-edge bg-[var(--color-canvas)]">
                <span className="shrink-0 whitespace-nowrap text-[15px] tracking-[-0.02em] text-fg">
                    <span className="text-[19px] font-semibold tracking-[-0.045em]">coevo</span>
                    <span className="text-fg-faint"> × </span>
                    {!preview && brands.length > 1 ? (
                        <select value={activeBrand?.id ?? ""} onChange={(e) => setActiveBrandId(e.target.value)} aria-label="Marca"
                            className="bg-transparent text-fg text-[15px] outline-none cursor-pointer">
                            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    ) : activeBrand?.name ?? ""}
                </span>
                <nav className="flex-1 min-w-0 flex items-center gap-1 h-full overflow-x-auto" aria-label="Secciones">
                    {TABS.map((t) => {
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
                {!preview && <span className="hidden md:block shrink-0 text-[12px] text-fg-faint">{me.email}</span>}
            </header>
            <main className="flex-1 min-h-0 overflow-hidden">
                <Outlet />
            </main>
        </div>
    );
}
