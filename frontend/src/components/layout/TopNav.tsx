import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
    LayoutGrid, Wand2, FolderOpen, BarChart3, Settings,
    Plug, Zap, ChevronDown, FlaskConical, Loader2, MessageSquare, Moon, Sun,
} from "lucide-react";
import { useBrand } from "../../lib/BrandContext";
import { useTheme } from "../../lib/theme";
import { cn } from "../../lib/utils";

const API_BASE = "http://localhost:8000";

interface NavItem {
    label: string;
    href: string;
    exact?: boolean;
    icon: React.ReactNode;
}

const PRIMARY_NAV: NavItem[] = [
    { label: "Marcas", href: "/dashboard/brands", exact: true, icon: <LayoutGrid size={15} /> },
    { label: "Chat", href: "/dashboard/chat", exact: true, icon: <MessageSquare size={15} /> },
    { label: "Generar", href: "/dashboard/generate", icon: <Wand2 size={15} /> },
    { label: "Contenido", href: "/dashboard/content", exact: true, icon: <FolderOpen size={15} /> },
    { label: "Performance", href: "/dashboard/performance/organic", icon: <BarChart3 size={15} /> },
];

const SETTINGS_NAV: NavItem[] = [
    { label: "Integraciones", href: "/dashboard/integrations", exact: true, icon: <Plug size={14} /> },
    { label: "Automatizaciones", href: "/dashboard/automations", exact: true, icon: <Zap size={14} /> },
    { label: "Ajustes", href: "/dashboard/settings", exact: true, icon: <Settings size={14} /> },
];

export function TopNav() {
    const location = useLocation();
    const navigate = useNavigate();
    const { activeBrand, loading } = useBrand();
    const { theme, toggle: toggleTheme } = useTheme();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const settingsRef = useRef<HTMLDivElement>(null);

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
            : location.pathname === item.href || location.pathname.startsWith(item.href.replace(/\/organic$|\/ads$/, "") + "/");

    const isPerfActive = location.pathname.startsWith("/dashboard/performance");
    const isSettingsActive = SETTINGS_NAV.some((i) => location.pathname === i.href);

    return (
        <header className="h-14 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl flex items-center px-6 gap-6 shrink-0 sticky top-0 z-30">
            {/* Logo */}
            <Link to="/dashboard/brands" className="flex items-center gap-2.5 cursor-pointer group">
                <img
                    src="/ISO-COEVO-BLANCO.png"
                    alt="Coevo"
                    className="w-7 h-7 object-contain coevo-logo"
                />
                <span className="text-[15px] font-bold text-fg tracking-[-0.02em] group-hover:text-[var(--color-warm-strong)] transition-colors lowercase">
                    coevo studio
                </span>
            </Link>

            {/* Primary nav */}
            <nav className="flex items-center gap-0.5 flex-1">
                {PRIMARY_NAV.map((item) => {
                    const active = item.label === "Performance" ? isPerfActive : isActive(item);
                    return (
                        <Link
                            key={item.label}
                            to={item.href}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-full transition-colors",
                                active
                                    ? "text-fg bg-[var(--color-surface-2)]"
                                    : "text-fg-muted hover:text-fg hover:bg-[var(--color-surface-1)]"
                            )}
                        >
                            {item.icon}
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            {/* Right side: brand chip + settings */}
            <div className="flex items-center gap-2">
                {/* Active brand chip */}
                {loading ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-1 rounded-full text-fg-muted">
                        <Loader2 size={12} className="animate-spin" />
                        <span className="text-[12px]">Cargando...</span>
                    </div>
                ) : (
                    <BrandChip brand={activeBrand} onClick={() => navigate("/dashboard/brands")} />
                )}

                {/* Theme toggle */}
                <button
                    onClick={toggleTheme}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-fg-muted hover:text-fg hover:bg-[var(--color-surface-1)] transition-colors cursor-pointer"
                    title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                >
                    {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
                </button>

                {/* Settings menu */}
                <div ref={settingsRef} className="relative">
                    <button
                        onClick={() => setSettingsOpen(!settingsOpen)}
                        className={cn(
                            "w-8 h-8 flex items-center justify-center rounded-full transition-colors cursor-pointer",
                            settingsOpen || isSettingsActive
                                ? "text-fg bg-[var(--color-surface-2)]"
                                : "text-fg-muted hover:text-fg hover:bg-[var(--color-surface-1)]"
                        )}
                        title="Ajustes"
                    >
                        <Settings size={15} />
                    </button>

                    {settingsOpen && (
                        <div className="absolute top-full right-0 mt-1 w-56 bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] rounded-[var(--radius-md)] shadow-2xl overflow-hidden z-40">
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
        </header>
    );
}

function BrandChip({ brand, onClick }: { brand: ReturnType<typeof useBrand>["activeBrand"]; onClick: () => void }) {
    const isSandbox = brand?.id === "__sandbox__";
    const hasLogo = !!brand?.logo?.imageUrl;
    const initials = brand?.name
        ? brand.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
        : "?";
    const primaryColor = brand?.dna?.colors?.[0]?.hex;

    return (
        <button
            onClick={onClick}
            className="flex items-center gap-2 pl-1 pr-3 py-1 bg-[var(--glass-bg)] backdrop-blur-xl hover:bg-[var(--glass-bg-hover)] border border-[var(--glass-border)] hover:border-[var(--glass-border-hover)] rounded-full transition-all cursor-pointer group"
            title="Ver todas las marcas"
        >
            <div
                className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center shrink-0 overflow-hidden",
                    isSandbox && "bg-surface-2"
                )}
                style={{ backgroundColor: !isSandbox ? (primaryColor || "var(--color-warm-muted)") : undefined }}
            >
                {hasLogo && brand ? (
                    <img
                        src={`${API_BASE}${brand.logo!.imageUrl}`}
                        alt={brand.name}
                        className="w-full h-full object-contain bg-white p-0.5"
                    />
                ) : isSandbox ? (
                    <FlaskConical size={10} className="text-fg-faint" />
                ) : (
                    <span
                        className="text-[9px] font-bold leading-none"
                        style={{ color: primaryColor ? "#fff" : "var(--color-warm)" }}
                    >
                        {initials}
                    </span>
                )}
            </div>
            <span className="text-[12px] font-medium text-fg max-w-[140px] truncate">
                {brand?.name ?? "Sin marca"}
            </span>
            <ChevronDown size={11} className="text-fg-faint group-hover:text-fg-muted transition-colors" />
        </button>
    );
}
