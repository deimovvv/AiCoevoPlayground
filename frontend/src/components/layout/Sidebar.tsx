import { useState } from "react";
import { LayoutDashboard, Settings, Diamond, Wrench, Image, Video, ChevronDown, Layers, Settings2 } from "lucide-react";
import { Link, useLocation } from "react-router";
import { cn } from "../../lib/utils";

export function Sidebar() {
    const location = useLocation();
    const [toolsOpen, setToolsOpen] = useState(
        location.pathname.startsWith("/dashboard/tools")
    );

    const menu = [
        { label: "Dashboard", href: "/dashboard", exact: true, icon: <LayoutDashboard size={18} /> },
        { label: "Brands", href: "/dashboard/brands", exact: false, icon: <Layers size={18} /> },
        { label: "Pipeline", href: "/dashboard/pipeline", exact: true, icon: <Settings2 size={18} /> },
    ];

    const toolsSubMenu = [
        { label: "Images", href: "/dashboard/tools/images", icon: <Image size={16} /> },
        { label: "Video", href: "/dashboard/tools/video", icon: <Video size={16} /> },
    ];

    const bottomMenu = [
        { label: "Settings", href: "/dashboard/settings", icon: <Settings size={18} /> },
    ];

    const isToolsActive = location.pathname.startsWith("/dashboard/tools");

    return (
        <div className="w-56 border-r border-edge h-full bg-surface-0 flex flex-col hidden md:flex">
            {/* Brand */}
            <div className="px-4 py-5 border-b border-edge">
                <Link to="/" className="flex items-center gap-2 group">
                    <div className="w-7 h-7 rounded-[var(--radius-sm)] bg-[var(--color-warm-muted)] flex items-center justify-center">
                        <Diamond size={15} className="text-[var(--color-warm)]" />
                    </div>
                    <span className="font-semibold text-[15px] text-fg tracking-tight group-hover:text-fg-secondary transition-colors">Morph</span>
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-3 space-y-1">
                {/* Main menu items */}
                {menu.map((item) => {
                    const isActive = item.exact
                        ? location.pathname === item.href
                        : location.pathname === item.href || location.pathname.startsWith(item.href + "/");
                    return (
                        <Link
                            key={item.label}
                            to={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] text-[14px] font-medium transition-colors duration-150",
                                isActive
                                    ? "bg-surface-2 text-fg"
                                    : "text-fg-muted hover:text-fg hover:bg-surface-1"
                            )}
                        >
                            <div className={cn(isActive ? "text-fg" : "text-fg-muted")}>
                                {item.icon}
                            </div>
                            {item.label}
                        </Link>
                    );
                })}

                {/* Tools dropdown */}
                <div>
                    <button
                        onClick={() => setToolsOpen(!toolsOpen)}
                        className={cn(
                            "cursor-pointer w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] text-[14px] font-medium transition-colors duration-150",
                            isToolsActive
                                ? "bg-surface-2 text-fg"
                                : "text-fg-muted hover:text-fg hover:bg-surface-1"
                        )}
                    >
                        <div className={cn(isToolsActive ? "text-fg" : "text-fg-muted")}>
                            <Wrench size={18} />
                        </div>
                        <span className="flex-1 text-left">Tools</span>
                        <ChevronDown
                            size={13}
                            className={cn(
                                "text-fg-faint transition-transform duration-200",
                                toolsOpen && "rotate-180"
                            )}
                        />
                    </button>

                    {/* Submenu */}
                    <div
                        className={cn(
                            "overflow-hidden transition-all duration-200",
                            toolsOpen ? "max-h-40 mt-0.5" : "max-h-0"
                        )}
                    >
                        <div className="ml-4 pl-3 border-l border-edge space-y-0.5">
                            {toolsSubMenu.map((sub) => {
                                const isSubActive = location.pathname === sub.href;
                                return (
                                    <Link
                                        key={sub.label}
                                        to={sub.href}
                                        className={cn(
                                            "flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius-sm)] text-[13px] font-medium transition-colors duration-150",
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

                {/* Bottom items */}
                {bottomMenu.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                        <Link
                            key={item.label}
                            to={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] text-[14px] font-medium transition-colors duration-150",
                                isActive
                                    ? "bg-surface-2 text-fg"
                                    : "text-fg-muted hover:text-fg hover:bg-surface-1"
                            )}
                        >
                            <div className={cn(isActive ? "text-fg" : "text-fg-muted")}>
                                {item.icon}
                            </div>
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-edge">
                <div className="text-[11px] text-fg-faint font-mono">v1.0.0</div>
            </div>
        </div>
    );
}
