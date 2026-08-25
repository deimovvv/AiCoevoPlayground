import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
    LayoutGrid, Wand2, FolderOpen, Settings,
    FlaskConical, Loader2, Moon, Sun, Megaphone, PanelLeft, Home, Compass, ListTodo, ArrowLeft, ChevronRight } from "lucide-react";
import { useBrand } from "../../lib/BrandContext";
import { useTheme } from "../../lib/theme";
import { cn } from "../../lib/utils";

const API_BASE = "http://127.0.0.1:8000";

// ── Sidebar (Left Rail) ──────────────────────────────────────────
// 60px-wide vertical rail con icon-only nav. Reemplaza al TopNav horizontal
// para liberar altura vertical y componer mejor con las tools (que tienen su
// propio sidebar de config de 440px). Mantiene la jerarquía: brand flow arriba,
// Lab separado por divider, brand chip + theme + settings al fondo.
//
// El archivo TopNav.tsx queda en disco por si querés revertir. AppLayout es
// quien decide quién se renderiza.

interface NavItem {
    label: string;
    href: string;
    exact?: boolean;
    icon: React.ReactNode;
    title?: string;
    tour?: string; // data-tour para el onboarding (Coachmarks)
}

/**
 * Navegación de DOS NIVELES (ver docs/decisions-log.md 2026-08 — Coevo World).
 *
 *   Coevo World  → la operación: qué se pidió, en qué estado está, qué costó
 *   Coevo Studio → la fábrica: las tools, el contenido, el sandbox
 *
 * Se entra al Studio desde un item del World y se vuelve con un "atrás". El sidebar
 * cambia de set según la ruta, así nunca ves las dos cosas mezcladas.
 */
const WORLD_NAV: NavItem[] = [
    { label: "Inicio", href: "/dashboard", exact: true, icon: <Home size={18} />, title: "Inicio — pedí algo nuevo y mirá qué está pendiente", tour: "nav-inicio" },
    { label: "Trabajo", href: "/dashboard/trabajo", exact: true, icon: <ListTodo size={18} />, title: "Trabajo — qué está en curso, qué espera aprobación y qué costó" },
    { label: "Marcas", href: "/dashboard/brands", exact: true, icon: <LayoutGrid size={18} />, title: "Marcas — gestioná tus marcas y su brand kit" },
    { label: "Campañas", href: "/dashboard/campaigns", icon: <Megaphone size={18} />, title: "Campañas — trabajá contenido por campaña de la marca activa", tour: "nav-campanas" },
];

/** La puerta a la fábrica. Se pinta con el acento porque abre otro NIVEL, no otra página. */
const STUDIO_ENTRY: NavItem = {
    label: "Coevo Studio",
    href: "/dashboard/generate",
    icon: <Wand2 size={18} />,
    title: "Coevo Studio — las herramientas de generación",
    tour: "nav-generar",
};

const STUDIO_NAV: NavItem[] = [
    { label: "Generar", href: "/dashboard/generate", icon: <Wand2 size={18} />, title: "Generar — tools de generación de contenido" },
    { label: "Contenido", href: "/dashboard/content", exact: true, icon: <FolderOpen size={18} />, title: "Contenido — biblioteca de generaciones" },
    { label: "Lab", href: "/dashboard/lab", exact: true, icon: <FlaskConical size={18} />, title: "Lab — sandbox SIN marca (Nano Banana + Kling/Seedance directo)" },
];

/** Rutas que viven adentro del Studio — definen en qué nivel está parado el sidebar. */
const STUDIO_PREFIXES = [
    "/dashboard/generate", "/dashboard/content", "/dashboard/lab", "/dashboard/lab-v2",
    "/dashboard/voice-lab", "/dashboard/ecommerce-batch", "/dashboard/tools", "/dashboard/pipeline",
];

const SETTINGS_NAV: NavItem[] = [
    { label: "Ajustes", href: "/dashboard/settings", exact: true, icon: <Settings size={15} /> },
];

export function Sidebar() {
    const location = useLocation();
    const navigate = useNavigate();
    const { activeBrand, loading } = useBrand();
    const { theme, toggle: toggleTheme } = useTheme();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const settingsRef = useRef<HTMLDivElement>(null);
    // Sidebar colapsable — icon-only (60px) ↔ con labels (200px). Persistido.
    const [expanded, setExpanded] = useState(() => localStorage.getItem("sidebarExpanded") === "1");
    const toggleExpanded = () => setExpanded((v) => { const nv = !v; localStorage.setItem("sidebarExpanded", nv ? "1" : "0"); return nv; });

    useEffect(() => {
        function onClick(e: MouseEvent) {
            if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
                setSettingsOpen(false);
            }
        }
        if (settingsOpen) document.addEventListener("mousedown", onClick);
        return () => document.removeEventListener("mousedown", onClick);
    }, [settingsOpen]);

    const isActive = (item: NavItem) =>
        item.exact
            ? location.pathname === item.href
            : location.pathname === item.href || location.pathname.startsWith(item.href + "/");

    const isSettingsActive = SETTINGS_NAV.some((i) => location.pathname === i.href);

    /** ¿Estamos adentro de la fábrica? Define qué set de nav se muestra. */
    const inStudio = STUDIO_PREFIXES.some(
        (p) => location.pathname === p || location.pathname.startsWith(p + "/"),
    );

    const itemCls = (active: boolean) => cn(
        "flex items-center rounded-[var(--radius-md)] transition-colors h-10",
        expanded ? "gap-3 px-3 justify-start w-full" : "w-10 justify-center",
        active ? "text-fg bg-[var(--color-surface-2)]" : "text-fg-muted hover:text-fg hover:bg-[var(--color-surface-1)]",
    );

    return (
        <aside className={cn(
            "h-full border-r border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl flex flex-col py-3 shrink-0 z-30 transition-[width] duration-200",
            expanded ? "w-[200px] px-2 items-stretch" : "w-[60px] items-center",
        )}>
            {/* Top: home + toggle colapsar/expandir */}
            <div className={cn("flex items-center mb-3", expanded ? "justify-between" : "flex-col gap-1")}>
                <Link
                    to="/dashboard/brands"
                    className={cn("flex items-center gap-2 rounded-[var(--radius-md)] hover:bg-[var(--color-surface-1)] transition-colors group", expanded ? "px-2 py-1.5 flex-1" : "w-9 h-9 justify-center")}
                    title={inStudio ? "Coevo Studio" : "Coevo World"}
                >
                    <span className="w-2 h-2 rounded-full bg-[var(--color-action)] opacity-70 group-hover:opacity-100 transition-opacity shrink-0" />
                    {expanded && (
                        <span className="text-[13px] font-semibold text-fg whitespace-nowrap">
                            Coevo <span className="text-fg-muted font-normal">{inStudio ? "Studio" : "World"}</span>
                        </span>
                    )}
                </Link>
                <button
                    onClick={toggleExpanded}
                    title={expanded ? "Colapsar sidebar" : "Expandir sidebar"}
                    className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-md)] text-fg-muted hover:text-fg hover:bg-[var(--color-surface-1)] transition-colors cursor-pointer shrink-0"
                >
                    <PanelLeft size={16} className={cn("transition-transform", expanded ? "" : "rotate-180")} />
                </button>
            </div>

            {/* Nav — cambia de nivel según dónde estás parado (World ↔ Studio) */}
            {inStudio ? (
                <>
                    <button
                        onClick={() => navigate("/dashboard")}
                        title="Volver a Coevo World"
                        className={cn(
                            "flex items-center rounded-[var(--radius-md)] transition-colors h-9 mb-2 cursor-pointer",
                            "text-fg-muted hover:text-fg hover:bg-[var(--color-surface-1)]",
                            expanded ? "gap-2 px-3 justify-start w-full" : "w-10 justify-center",
                        )}
                    >
                        <ArrowLeft size={15} className="shrink-0" />
                        {expanded && <span className="text-[12px] font-medium">Coevo World</span>}
                    </button>
                    <nav className={cn("flex flex-col gap-1", expanded ? "items-stretch" : "items-center")}>
                        {STUDIO_NAV.map((item) => (
                            <Link key={item.label} to={item.href} title={item.title} data-tour={item.tour} className={itemCls(isActive(item))}>
                                <span className="shrink-0 flex items-center justify-center w-5">{item.icon}</span>
                                {expanded && <span className="text-[13px] font-medium whitespace-nowrap">{item.label}</span>}
                            </Link>
                        ))}
                    </nav>
                </>
            ) : (
                <>
                    <nav className={cn("flex flex-col gap-1", expanded ? "items-stretch" : "items-center")}>
                        {WORLD_NAV.map((item) => (
                            <Link key={item.label} to={item.href} title={item.title} data-tour={item.tour} className={itemCls(isActive(item))}>
                                <span className="shrink-0 flex items-center justify-center w-5">{item.icon}</span>
                                {expanded && <span className="text-[13px] font-medium whitespace-nowrap">{item.label}</span>}
                            </Link>
                        ))}
                    </nav>

                    <div className={cn("h-px bg-edge my-3", expanded ? "w-full" : "w-6 mx-auto")} />

                    {/* Puerta al Studio — acentuada porque abre otro nivel, no otra página */}
                    <Link
                        to={STUDIO_ENTRY.href}
                        title={STUDIO_ENTRY.title}
                        data-tour={STUDIO_ENTRY.tour}
                        className={cn(
                            "flex items-center rounded-[var(--radius-md)] transition-colors h-10",
                            "border border-[var(--color-action)] bg-[var(--color-action-muted)] text-fg hover:bg-[var(--color-action)] hover:text-[var(--color-action-fg)]",
                            expanded ? "gap-3 px-3 justify-start w-full" : "w-10 justify-center",
                        )}
                    >
                        <span className="shrink-0 flex items-center justify-center w-5">{STUDIO_ENTRY.icon}</span>
                        {expanded && (
                            <>
                                <span className="text-[13px] font-medium whitespace-nowrap">{STUDIO_ENTRY.label}</span>
                                <ChevronRight size={13} className="ml-auto opacity-60 shrink-0" />
                            </>
                        )}
                    </Link>
                </>
            )}

            {/* Spacer — empuja brand+theme+settings al fondo */}
            <div className="flex-1" />

            {/* Active brand chip */}
            <div data-tour="brand-chip" className={cn("mb-2 flex", expanded ? "items-center gap-2 px-1" : "justify-center")}>
                {loading ? (
                    <div className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-1 text-fg-muted shrink-0">
                        <Loader2 size={12} className="animate-spin" />
                    </div>
                ) : (
                    <BrandAvatar brand={activeBrand} onClick={() => navigate("/dashboard/brands")} />
                )}
                {expanded && !loading && <span className="text-[12px] text-fg-muted truncate">{activeBrand?.name || "Sin marca"}</span>}
            </div>

            {/* Theme + Settings */}
            <div className={cn("flex", expanded ? "items-center gap-1" : "flex-col items-center gap-1")}>
            <button
                onClick={toggleTheme}
                className="w-9 h-9 flex items-center justify-center rounded-[var(--radius-md)] text-fg-muted hover:text-fg hover:bg-[var(--color-surface-1)] transition-colors cursor-pointer shrink-0"
                title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            >
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Settings — popover abre hacia la derecha */}
            <div ref={settingsRef} className="relative">
                <button
                    onClick={() => setSettingsOpen(!settingsOpen)}
                    className={cn(
                        "w-9 h-9 flex items-center justify-center rounded-[var(--radius-md)] transition-colors cursor-pointer",
                        settingsOpen || isSettingsActive
                            ? "text-fg bg-[var(--color-surface-2)]"
                            : "text-fg-muted hover:text-fg hover:bg-[var(--color-surface-1)]"
                    )}
                    title="Ajustes"
                >
                    <Settings size={16} />
                </button>

                {settingsOpen && (
                    <div className="absolute bottom-0 left-full ml-2 w-56 bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] rounded-[var(--radius-md)] shadow-2xl overflow-hidden z-40">
                        <div className="py-1">
                            {SETTINGS_NAV.map((item) => {
                                const active = location.pathname === item.href;
                                return (
                                    <Link
                                        key={item.label}
                                        to={item.href}
                                        onClick={() => setSettingsOpen(false)}
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-2 text-[13px] transition-colors",
                                            active
                                                ? "text-fg bg-[var(--color-surface-2)]"
                                                : "text-fg-secondary hover:text-fg hover:bg-[var(--color-surface-1)]"
                                        )}
                                    >
                                        {item.icon}
                                        {item.label}
                                    </Link>
                                );
                            })}
                            {/* Ver tour de nuevo — limpia la key del onboarding y recarga
                                en /dashboard (donde viven los targets del tour). */}
                            <button
                                onClick={() => {
                                    localStorage.removeItem("coevo-tour-dashboard-v1");
                                    window.location.assign("/dashboard");
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-fg-secondary hover:text-fg hover:bg-[var(--color-surface-1)] transition-colors cursor-pointer"
                            >
                                <Compass size={15} />
                                Ver tour de nuevo
                            </button>
                        </div>
                    </div>
                )}
            </div>
            </div>
        </aside>
    );
}

// ── Brand Avatar ─────────────────────────────────────────────────
// Versión circular del BrandChip de TopNav: solo el avatar (sin nombre ni
// chevron) porque en vertical no entra. Click navega a /dashboard/brands
// que es donde está el listado completo + crear nueva. Tooltip muestra el
// nombre activo para que no quede ambiguo.

function BrandAvatar({ brand, onClick }: { brand: ReturnType<typeof useBrand>["activeBrand"]; onClick: () => void }) {
    const isSandbox = brand?.id === "__sandbox__";
    const hasLogo = !!brand?.logo?.imageUrl;
    const initials = brand?.name
        ? brand.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
        : "?";
    const primaryColor = brand?.dna?.colors?.[0]?.hex;

    return (
        <button
            onClick={onClick}
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 overflow-hidden border border-[var(--glass-border)] hover:border-[var(--glass-border-hover)] transition-colors cursor-pointer"
            title={brand?.name ? `Marca activa: ${brand.name} — click para ver todas` : "Ver todas las marcas"}
            style={{ backgroundColor: !isSandbox && !hasLogo ? (primaryColor || "var(--color-action-muted)") : undefined }}
        >
            {hasLogo && brand ? (
                <img
                    src={`${API_BASE}${brand.logo!.imageUrl}`}
                    alt={brand.name}
                    className="w-full h-full object-contain bg-white p-0.5"
                />
            ) : isSandbox ? (
                <FlaskConical size={13} className="text-fg-faint" />
            ) : (
                <span
                    className="text-[11px] font-bold leading-none"
                    style={{ color: primaryColor ? "#fff" : "var(--color-action)" }}
                >
                    {initials}
                </span>
            )}
        </button>
    );
}
