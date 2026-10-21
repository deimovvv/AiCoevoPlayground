import { Link, useLocation } from "react-router";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../lib/theme";
import { useMe } from "../../lib/useMe";
import { BrandPicker } from "./BrandPicker";
import { cn } from "../../lib/utils";

/**
 * Barra de arriba (openspec/changes/studio-v2 §2): reemplaza al sidebar.
 *
 * Primero la marca (Coevo es multimarca: todo lo de abajo es de la marca elegida), después
 * las cuatro secciones. Lo que antes tenía entrada propia (Campañas, Generar, Contenido, Lab,
 * Editor) vive adentro de Producción; Marcas, en el selector de marca.
 * Prototipo: https://claude.ai/artifact/GKyzyZTpzo4fCZWWaErPYJ
 */

interface Section { label: string; href: string; match: string[] }

const SECTIONS: Section[] = [
    { label: "Marca", href: "/dashboard/marca", match: ["/dashboard/marca", "/dashboard/brand", "/dashboard/brands"] },
    {
        label: "Producción", href: "/dashboard/produccion",
        match: ["/dashboard/produccion", "/dashboard/generate", "/dashboard/campanas", "/dashboard/campaigns",
            "/dashboard/content", "/dashboard/lab", "/dashboard/editor", "/dashboard/ecommerce-batch", "/dashboard/voice-lab",
            "/dashboard/chat", "/dashboard/tools", "/dashboard/pipeline"],
    },
    { label: "Entregas", href: "/dashboard/entregas", match: ["/dashboard/entregas"] },
    { label: "Reportes", href: "/dashboard/performance/organic", match: ["/dashboard/performance", "/dashboard/integrations", "/dashboard/automations"] },
];

export function TopBar() {
    const { pathname } = useLocation();
    const { theme, toggle } = useTheme();
    const me = useMe();
    const active = SECTIONS.find((s) => s.match.some((m) => pathname === m || pathname.startsWith(m + "/")));

    return (
        // Escritorio: una fila. Celular: marca arriba y las secciones abajo, con desplazamiento lateral.
        <header className="shrink-0 border-b border-edge bg-[var(--color-canvas)] flex flex-wrap items-center gap-x-6 px-4 md:px-6 md:h-14 md:flex-nowrap">
            <div className="h-14 flex items-center gap-4 md:gap-6 flex-1 md:flex-none min-w-0">
                <Link to="/dashboard/marca" className="text-[19px] font-semibold tracking-[-0.045em] text-fg no-underline">coevo</Link>
                <BrandPicker top />
            </div>
            <div className="h-14 flex items-center gap-4 md:order-last md:ml-auto">
                {me.role === "admin"
                    ? <>
                        <Link to="/dashboard/semaforo" className={cn("text-[12px] no-underline", pathname === "/dashboard/semaforo" ? "text-fg" : "text-fg-faint hover:text-fg")}>Semáforo</Link>
                        <Link to="/dashboard/accesos" className={cn("text-[12px] no-underline", pathname === "/dashboard/accesos" ? "text-fg" : "text-fg-faint hover:text-fg")}>Accesos</Link>
                    </>
                    : <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-faint">Equipo</span>}
                <span className="hidden lg:inline text-[12px] text-fg-faint max-w-[200px] truncate" title={me.email ?? ""}>{me.email === "local" ? "local" : me.email?.split("@")[0]}</span>
                <button onClick={toggle} aria-label={theme === "light" ? "Pasar a modo oscuro" : "Pasar a modo claro"}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-fg-faint hover:text-fg hover:bg-[var(--color-surface-2)] cursor-pointer">
                    {theme === "light" ? <Moon size={15} /> : <Sun size={15} />}
                </button>
            </div>
            <nav className="w-full md:w-auto h-11 md:h-14 flex items-center gap-1 overflow-x-auto -mx-1 md:mx-0 border-t border-edge md:border-0" aria-label="Secciones">
                {SECTIONS.map((s) => (
                    <Link key={s.label} to={s.href}
                        aria-current={active === s ? "page" : undefined}
                        className={cn(
                            "h-full shrink-0 flex items-center px-3 text-[13px] no-underline border-b-[1.5px] transition-colors",
                            active === s ? "text-fg border-fg" : "text-fg-faint border-transparent hover:text-fg"
                        )}>
                        {s.label}
                    </Link>
                ))}
            </nav>
        </header>
    );
}
