import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router";
import {
    LayoutGrid, Wand2, FolderOpen, Settings,
    FlaskConical, Moon, Sun, PanelLeft, Home, Compass, ListTodo } from "lucide-react";
import { useBrand } from "../../lib/BrandContext";
import { fetchInboxCount } from "../../lib/api";
import { useTheme } from "../../lib/theme";
import { cn } from "../../lib/utils";
import { BrandPicker } from "./BrandPicker";


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
 * Navegación PLANA — un solo nivel (2026-09-20).
 *
 * Reemplaza la navegación de dos niveles World → Studio (decisions-log 2026-08).
 * El motivo, del usuario: *"Cuando entrás, lo primero que tenemos que ver es Coevo
 * Studio, porque es la herramienta que está dentro. No tengo que entrar dos veces."*
 *
 * El problema de los dos niveles era que caías en la capa de gestión y las tools
 * —donde se trabaja— quedaban un click más adentro, detrás de un modelo mental
 * ("World contiene Studio") que la UI nunca explicaba.
 *
 * Referencia: Flora usa un sidebar plano sin niveles (ver
 * docs/dashboard-architecture-research.md §2.1).
 *
 * El orden importa: OPERAR arriba (qué hay que hacer), PRODUCIR abajo (con qué
 * hacerlo). Separados por un divider, no por un nivel de navegación.
 */
const OPERAR_NAV: NavItem[] = [
    { label: "Inicio", href: "/dashboard", exact: true, icon: <Home size={18} />, title: "Inicio — pedí algo nuevo y mirá qué está pendiente", tour: "nav-inicio" },
    { label: "Campañas", href: "/dashboard/campanas", exact: true, icon: <ListTodo size={18} />, title: "Campañas — qué está en curso, qué espera aprobación y qué costó", tour: "nav-campanas" },
    { label: "Marcas", href: "/dashboard/brands", exact: true, icon: <LayoutGrid size={18} />, title: "Marcas — gestioná tus marcas y su brand kit" },
];

const PRODUCIR_NAV: NavItem[] = [
    { label: "Generar", href: "/dashboard/generate", icon: <Wand2 size={18} />, title: "Generar — tools de generación de contenido", tour: "nav-generar" },
    { label: "Contenido", href: "/dashboard/content", exact: true, icon: <FolderOpen size={18} />, title: "Contenido — biblioteca de generaciones" },
    { label: "Lab", href: "/dashboard/lab", exact: true, icon: <FlaskConical size={18} />, title: "Lab — sandbox SIN marca (Nano Banana + Kling/Seedance directo)" },
];

const SETTINGS_NAV: NavItem[] = [
    { label: "Ajustes", href: "/dashboard/settings", exact: true, icon: <Settings size={15} /> },
];

// Rutas con panel propio a la izquierda: acá el sidebar se colapsa solo.
const WORKSURFACE_ROUTES = [
    "/dashboard/campaigns/new",
    "/dashboard/lab",
    "/dashboard/ecommerce-batch",
    "/dashboard/generate/",
];

export function Sidebar() {
    const location = useLocation();
    const { activeBrand } = useBrand();
    const { theme, toggle: toggleTheme } = useTheme();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const settingsRef = useRef<HTMLDivElement>(null);
    // Sidebar colapsable — icon-only (60px) ↔ con labels (200px). Persistido.
    const [expanded, setExpanded] = useState(() => localStorage.getItem("sidebarExpanded") === "1");

    // En las pantallas que ya tienen su propio panel de trabajo a la izquierda
    // (crear campaña, Lab, Ecommerce Batch), dos paneles apilados son ruido: el
    // sidebar se achica solo. No pisa tu preferencia — al salir vuelve a como
    // lo tenías.
    const worksurface = WORKSURFACE_ROUTES.some((r) => location.pathname.startsWith(r));
    const showExpanded = expanded && !worksurface;
    // Cuánto espera una acción nuestra. Sin esto, un pedido del cliente entraba a Campañas
    // y no había ninguna señal de que había llegado — reportado por el usuario.
    const [inbox, setInbox] = useState(0);
    const toggleExpanded = () => setExpanded((v) => { const nv = !v; localStorage.setItem("sidebarExpanded", nv ? "1" : "0"); return nv; });

    useEffect(() => {
        if (!activeBrand) { setInbox(0); return; }
        let alive = true;
        const tick = () => fetchInboxCount(activeBrand.id)
            .then((c) => { if (alive) setInbox(c.total); })
            .catch(() => { if (alive) setInbox(0); });
        tick();
        // Un pedido puede entrar mientras la pestaña está abierta.
        const id = setInterval(tick, 60_000);
        return () => { alive = false; clearInterval(id); };
    }, [activeBrand?.id, location.pathname]);

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
        showExpanded ? "gap-3 px-3 justify-start w-full" : "w-10 justify-center",
        active ? "text-fg bg-[var(--color-surface-2)]" : "text-fg-muted hover:text-fg hover:bg-[var(--color-surface-1)]",
    );

    return (
        <aside className={cn(
            "h-full border-r border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl flex flex-col py-3 shrink-0 z-30 transition-[width] duration-200",
            showExpanded ? "w-[200px] px-2 items-stretch" : "w-[60px] items-center",
        )}>
            {/* Top: home + toggle colapsar/expandir */}
            <div className={cn("flex items-center mb-3", showExpanded ? "justify-between" : "flex-col gap-1")}>
                {/* El logo vuelve SIEMPRE al home de la web (`/`). Antes iba a
                    /dashboard/brands y no había forma de salir del dashboard.
                    Ya no alterna World/Studio: con la nav plana no hay "nivel"
                    que señalar — el nombre del producto es uno solo. */}
                <Link
                    to="/"
                    className={cn("flex items-center gap-2 rounded-[var(--radius-md)] hover:bg-[var(--color-surface-1)] transition-colors group", showExpanded ? "px-2 py-1.5 flex-1" : "w-9 h-9 justify-center")}
                    title="Coevo Studio — ir al inicio"
                >
                    <span className="w-2 h-2 rounded-full bg-[var(--color-action)] opacity-70 group-hover:opacity-100 transition-opacity shrink-0" />
                    {showExpanded && (
                        <span className="text-[13px] font-semibold text-fg whitespace-nowrap">
                            Coevo <span className="text-fg-muted font-normal">Studio</span>
                        </span>
                    )}
                </Link>
                <button
                    onClick={toggleExpanded}
                    title={showExpanded ? "Colapsar sidebar" : "Expandir sidebar"}
                    className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-md)] text-fg-muted hover:text-fg hover:bg-[var(--color-surface-1)] transition-colors cursor-pointer shrink-0"
                >
                    <PanelLeft size={16} className={cn("transition-transform", showExpanded ? "" : "rotate-180")} />
                </button>
            </div>

            {/* Nav PLANA — un solo nivel. Arriba operar, abajo producir. */}
            <nav className={cn("flex flex-col gap-1", showExpanded ? "items-stretch" : "items-center")}>
                {OPERAR_NAV.map((item) => {
                    const badge = item.href === "/dashboard/campanas" ? inbox : 0;
                    return (
                        <Link key={item.label} to={item.href} title={item.title} data-tour={item.tour} className={itemCls(isActive(item))}>
                            <span className="relative shrink-0 flex items-center justify-center w-5">
                                {item.icon}
                                {badge > 0 && !showExpanded && (
                                    <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-[var(--color-action)]" />
                                )}
                            </span>
                            {showExpanded && <span className="text-[13px] font-medium whitespace-nowrap">{item.label}</span>}
                            {showExpanded && badge > 0 && (
                                <span className="ml-auto text-[10px] font-semibold tabular-nums bg-[var(--color-action)] text-[var(--color-action-fg)] rounded-full px-1.5 py-[1px]">
                                    {badge}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            <div className={cn("h-px bg-edge my-3", showExpanded ? "w-full" : "w-6 mx-auto")} />

            <nav className={cn("flex flex-col gap-1", showExpanded ? "items-stretch" : "items-center")}>
                {PRODUCIR_NAV.map((item) => (
                    <Link key={item.label} to={item.href} title={item.title} data-tour={item.tour} className={itemCls(isActive(item))}>
                        <span className="shrink-0 flex items-center justify-center w-5">{item.icon}</span>
                        {showExpanded && <span className="text-[13px] font-medium whitespace-nowrap">{item.label}</span>}
                    </Link>
                ))}
            </nav>

            {/* Spacer — empuja brand+theme+settings al fondo */}
            <div className="flex-1" />

            {/* Active brand chip */}
            {/* Selector de marca. Antes era un link que te sacaba a /dashboard/brands:
                para cambiar de marca había que abandonar la pantalla en la que estabas.
                Ahora despliega y cambia el contexto en el lugar, desde donde sea. */}
            <div data-tour="brand-chip" className="mb-2">
                <BrandPicker collapsed={!showExpanded} />
            </div>

            {/* Theme + Settings */}
            <div className={cn("flex", showExpanded ? "items-center gap-1" : "flex-col items-center gap-1")}>
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

