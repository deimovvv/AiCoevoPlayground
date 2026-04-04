import { useState } from "react";
import {
    MessageSquare,
    Settings,
    Wand2,
    ChevronDown,
    Palette,
    FolderOpen,
    Plug,
    BarChart3,
    TrendingUp,
    Target,
    Zap,
} from "lucide-react";
import { Link, useLocation } from "react-router";
import { cn } from "../../lib/utils";
import { BrandSwitcher } from "./BrandSwitcher";

interface MenuItem {
    label: string;
    href: string;
    exact?: boolean;
    icon: React.ReactNode;
}

interface MenuSection {
    title?: string;
    items: MenuItem[];
    collapsible?: {
        label: string;
        icon: React.ReactNode;
        items: MenuItem[];
    };
}

export function Sidebar() {
    const location = useLocation();
    const [perfOpen, setPerfOpen] = useState(
        location.pathname.startsWith("/dashboard/performance")
    );

    const sections: MenuSection[] = [
        {
            items: [
                { label: "Brand Kit", href: "/dashboard/brand", exact: true, icon: <Palette size={18} /> },
                { label: "Generate", href: "/dashboard/generate", icon: <Wand2 size={18} /> },
                { label: "Content", href: "/dashboard/content", exact: true, icon: <FolderOpen size={18} /> },
            ],
        },
        {
            title: "SETTINGS",
            items: [
                { label: "Integrations", href: "/dashboard/integrations", exact: true, icon: <Plug size={18} /> },
                { label: "Automations", href: "/dashboard/automations", exact: true, icon: <Zap size={18} /> },
            ],
        },
        {
            title: "MARKETING",
            items: [],
            collapsible: {
                label: "Performance",
                icon: <BarChart3 size={18} />,
                items: [
                    { label: "Organic", href: "/dashboard/performance/organic", icon: <TrendingUp size={16} /> },
                    { label: "Ads", href: "/dashboard/performance/ads", icon: <Target size={16} /> },
                ],
            },
        },
    ];

    const isActive = (item: MenuItem) =>
        item.exact
            ? location.pathname === item.href
            : location.pathname === item.href || location.pathname.startsWith(item.href + "/");

    const isPerfActive = location.pathname.startsWith("/dashboard/performance");

    return (
        <div className="w-56 border-r border-edge h-full bg-surface-0 flex flex-col hidden md:flex">
            {/* Brand Switcher */}
            <BrandSwitcher />

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-4">
                {sections.map((section, sIdx) => (
                    <div key={sIdx} className="space-y-1">
                        {section.title && (
                            <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-fg-faint tracking-widest uppercase">
                                {section.title}
                            </div>
                        )}

                        {/* Regular items */}
                        {section.items.map((item) => (
                            <NavLink key={item.label} item={item} active={isActive(item)} />
                        ))}

                        {/* Collapsible (Performance) */}
                        {section.collapsible && (
                            <CollapsibleNav
                                label={section.collapsible.label}
                                icon={section.collapsible.icon}
                                items={section.collapsible.items}
                                open={perfOpen}
                                onToggle={() => setPerfOpen(!perfOpen)}
                                parentActive={isPerfActive}
                                pathname={location.pathname}
                            />
                        )}
                    </div>
                ))}
            </nav>

            {/* Footer */}
            <div className="border-t border-edge">
                <div className="p-3">
                    <NavLink
                        item={{ label: "Settings", href: "/dashboard/settings", icon: <Settings size={18} /> }}
                        active={location.pathname === "/dashboard/settings"}
                    />
                </div>
                <div className="px-4 py-2 border-t border-edge-subtle">
                    <div className="text-[10px] text-fg-faint font-mono">Coevo Studio v1.0</div>
                </div>
            </div>
        </div>
    );
}

function NavLink({ item, active }: { item: MenuItem; active: boolean }) {
    return (
        <Link
            to={item.href}
            className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-[var(--radius-sm)] text-[13px] font-medium transition-colors duration-150",
                active
                    ? "bg-surface-2 text-fg"
                    : "text-fg-muted hover:text-fg hover:bg-surface-1"
            )}
        >
            <div className={cn(active ? "text-fg" : "text-fg-muted")}>{item.icon}</div>
            {item.label}
        </Link>
    );
}

function CollapsibleNav({
    label,
    icon,
    items,
    open,
    onToggle,
    parentActive,
    pathname,
}: {
    label: string;
    icon: React.ReactNode;
    items: MenuItem[];
    open: boolean;
    onToggle: () => void;
    parentActive: boolean;
    pathname: string;
}) {
    return (
        <div>
            <button
                onClick={onToggle}
                className={cn(
                    "cursor-pointer w-full flex items-center gap-3 px-3 py-2 rounded-[var(--radius-sm)] text-[13px] font-medium transition-colors duration-150",
                    parentActive
                        ? "bg-surface-2 text-fg"
                        : "text-fg-muted hover:text-fg hover:bg-surface-1"
                )}
            >
                <div className={cn(parentActive ? "text-fg" : "text-fg-muted")}>{icon}</div>
                <span className="flex-1 text-left">{label}</span>
                <ChevronDown
                    size={12}
                    className={cn(
                        "text-fg-faint transition-transform duration-200",
                        open && "rotate-180"
                    )}
                />
            </button>

            <div
                className={cn(
                    "overflow-hidden transition-all duration-200",
                    open ? "max-h-40 mt-0.5" : "max-h-0"
                )}
            >
                <div className="ml-4 pl-3 border-l border-edge space-y-0.5">
                    {items.map((sub) => {
                        const isSubActive = pathname === sub.href;
                        return (
                            <Link
                                key={sub.label}
                                to={sub.href}
                                className={cn(
                                    "flex items-center gap-2.5 px-2.5 py-1.5 rounded-[var(--radius-sm)] text-[12px] font-medium transition-colors duration-150",
                                    isSubActive
                                        ? "text-fg bg-surface-1"
                                        : "text-fg-muted hover:text-fg hover:bg-surface-1"
                                )}
                            >
                                <div className={cn(isSubActive ? "text-fg" : "text-fg-faint")}>
                                    {sub.icon}
                                </div>
                                {sub.label}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
