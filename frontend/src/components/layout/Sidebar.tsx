import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
    LayoutGrid, Wand2, FolderOpen, Settings,
    FlaskConical, Loader2, Moon, Sun, Megaphone, PanelLeft, Home,
} from "lucide-react";
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
}

const PRIMARY_NAV: NavItem[] = [
    { label: "Inicio", href: "/dashboard", exact: true, icon: <Home size={18} />, title: "Inicio — bienvenida, tools y campañas recientes" },
    { label: "Marcas", href: "/dashboard/brands", exact: true, icon: <LayoutGrid size={18} />, title: "Marcas — gestioná tus marcas y su brand kit" },
    { label: "Campañas", href: "/dashboard/campaigns", icon: <Megaphone size={18} />, title: "Campañas — trabajá contenido por campaña de la marca activa" },
    { label: "Generar", href: "/dashboard/generate", icon: <Wand2 size={18} />, title: "Generar — tools de generación de contenido" },
    { label: "Contenido", href: "/dashboard/content", exact: true, icon: <FolderOpen size={18} />, title: "Contenido — biblioteca de generaciones" },
];

const LAB_NAV: NavItem = {
    label: "Lab",
    href: "/dashboard/lab",
    exact: true,
    icon: <FlaskConical size={18} />,
    title: "Lab — sandbox SIN marca (Nano Banana + Kling/Seedance directo)",
};

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
                    title="Coevo Studio"
                >
                    <span className="w-2 h-2 rounded-full bg-[var(--color-action)] opacity-70 group-hover:opacity-100 transition-opacity shrink-0" />
                    {expanded && <span className="text-[13px] font-semibold text-fg">Coevo</span>}
                </Link>
                <button
                    onClick={toggleExpanded}
                    title={expanded ? "Colapsar sidebar" : "Expandir sidebar"}
                    className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-md)] text-fg-muted hover:text-fg hover:bg-[var(--color-surface-1)] transition-colors cursor-pointer shrink-0"
                >
                    <PanelLeft size={16} className={cn("transition-transform", expanded ? "" : "rotate-180")} />
                </button>
            </div>

            {/* Primary nav (brand flow) */}
            <nav className={cn("flex flex-col gap-1", expanded ? "items-stretch" : "items-center")}>
                {PRIMARY_NAV.map((item) => {
                    const active = isActive(item);
                    return (
                        <Link key={item.label} to={item.href} title={item.title} className={itemCls(active)}>
                            <span className="shrink-0 flex items-center justify-center w-5">{item.icon}</span>
                            {expanded && <span className="text-[13px] font-medium whitespace-nowrap">{item.label}</span>}
                        </Link>
                    );
                })}
            </nav>

            {/* Divider — Lab está fuera del brand flow */}
            <div className={cn("h-px bg-edge my-3", expanded ? "w-full" : "w-6 mx-auto")} />

            {/* Lab — sandbox brand-agnostic. Dot terracota cuando NO está activo. */}
            {(() => {
                const labActive = isActive(LAB_NAV);
                return (
                    <Link
                        to={LAB_NAV.href}
                        title={LAB_NAV.title}
                        className={cn(
                            "flex items-center rounded-[var(--radius-md)] transition-colors h-10",
                            expanded ? "gap-3 px-3 justify-start w-full" : "w-10 justify-center",
                            labActive ? "text-[var(--color-action-fg)] bg-[var(--color-action)]" : "text-fg-muted hover:text-fg hover:bg-[var(--color-surface-1)]",
                        )}
                    >
                        <span className="relative shrink-0 flex items-center justify-center w-5">
                            {LAB_NAV.icon}
                            {!labActive && !expanded && <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-[var(--color-action)]" />}
                        </span>
                        {expanded && <span className="text-[13px] font-medium">{LAB_NAV.label}</span>}
                    </Link>
                );
            })()}

            {/* Spacer — empuja brand+theme+settings al fondo */}
            <div className="flex-1" />

            {/* Active brand chip */}
            <div className={cn("mb-2 flex", expanded ? "items-center gap-2 px-1" : "justify-center")}>
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
