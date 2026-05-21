import { useState, useEffect } from "react";
import { Link } from "react-router";
import {
    ArrowRight, Image, Video, Wrench, Sparkles,
    Loader2, FolderOpen, Layers,
} from "lucide-react";
import { fetchBrands, type Brand } from "../lib/api";

interface ToolEntry {
    id: string;
    name: string;
    category: string;
    status: string;
    icon: string;
}

export function DashboardOverview() {
    const [brands, setBrands] = useState<Brand[]>([]);
    const [tools, setTools] = useState<ToolEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetchBrands().catch(() => []),
            fetch("http://localhost:8000/api/tools")
                .then((r) => r.json())
                .then((d) => d.tools || [])
                .catch(() => []),
        ]).then(([b, t]) => {
            setBrands(b);
            setTools(t);
            setLoading(false);
        });
    }, []);

    const imageTools = tools.filter((t) => t.category === "images");
    const videoTools = tools.filter((t) => t.category === "video");
    const activeTools = tools.filter((t) => t.status === "active").length;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={20} className="animate-spin text-fg-muted" />
            </div>
        );
    }

    return (
        <div className="relative p-8 max-w-6xl">
            {/* Ambient warm glow — matches Home */}
            <div
                className="pointer-events-none absolute -top-32 left-1/3 w-[600px] h-[400px] -translate-x-1/2 z-0"
                style={{
                    background: `radial-gradient(ellipse at center, rgba(196,88,48,0.08) 0%, rgba(140,50,30,0.03) 50%, transparent 75%)`,
                }}
            />

            {/* Header */}
            <div className="relative z-10 mb-8">
                <h1 className="text-[22px] font-bold tracking-tight text-fg">Dashboard</h1>
                <p className="text-[13px] text-fg-muted mt-1">
                    Overview of your brands, tools, and creative pipeline.
                </p>
            </div>

            {/* Stats Row */}
            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
                <StatCard
                    label="Brands"
                    value={brands.length}
                    icon={<Layers size={16} />}
                    href="/dashboard/brands"
                    warm
                />
                <StatCard
                    label="Active Tools"
                    value={activeTools}
                    icon={<Wrench size={16} />}
                    href="/dashboard/tools/images"
                />
                <StatCard
                    label="Total Avatars"
                    value={brands.reduce((sum, b) => sum + (b.avatars?.length || 0), 0)}
                    icon={<Sparkles size={16} />}
                    href="/dashboard/brands"
                />
            </div>

            {/* Brands Section */}
            <div className="relative z-10">
                <Section
                    title="Brands"
                    subtitle={`${brands.length} brand${brands.length !== 1 ? "s" : ""} configured`}
                    href="/dashboard/brands"
                    icon={<FolderOpen size={15} className="text-[var(--color-action)]" />}
                >
                    {brands.length === 0 ? (
                        <div className="text-[13px] text-fg-faint py-6 text-center">
                            No brands yet.{" "}
                            <Link to="/dashboard/brands" className="text-fg-secondary hover:text-fg underline">
                                Add your first brand
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {brands.slice(0, 3).map((brand) => (
                                <Link
                                    key={brand.id}
                                    to={`/dashboard/brands/${brand.id}`}
                                    className="group flex items-center gap-3 p-3 rounded-[var(--radius-sm)] bg-surface-1 hover:bg-surface-2 border border-transparent hover:border-edge transition-all"
                                >
                                    <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-action-muted)] flex items-center justify-center">
                                        <Layers size={14} className="text-[var(--color-action)]" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[13px] font-medium text-fg truncate">{brand.name}</div>
                                        <div className="text-[11px] text-fg-faint">
                                            {brand.avatars?.length || 0} avatars · {brand.voicePresets?.length || 0} voices
                                        </div>
                                    </div>
                                    <ArrowRight size={13} className="text-fg-faint group-hover:text-[var(--color-action)] group-hover:translate-x-0.5 transition-all shrink-0" />
                                </Link>
                            ))}
                        </div>
                    )}
                    {brands.length > 3 && (
                        <Link
                            to="/dashboard/brands"
                            className="block text-center text-[12px] text-fg-muted hover:text-[var(--color-action)] mt-3 transition-colors"
                        >
                            View all {brands.length} brands →
                        </Link>
                    )}
                </Section>
            </div>

            {/* Tools Sections */}
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                <Section
                    title="Image Tools"
                    subtitle={`${imageTools.length} tool${imageTools.length !== 1 ? "s" : ""}`}
                    href="/dashboard/tools/images"
                    icon={<Image size={15} className="text-fg-muted" />}
                >
                    {imageTools.length === 0 ? (
                        <div className="text-[13px] text-fg-faint py-4 text-center">No image tools.</div>
                    ) : (
                        <div className="space-y-1">
                            {imageTools.map((tool) => (
                                <ToolRow key={tool.id} tool={tool} category="images" />
                            ))}
                        </div>
                    )}
                </Section>

                <Section
                    title="Video Tools"
                    subtitle={`${videoTools.length} tool${videoTools.length !== 1 ? "s" : ""}`}
                    href="/dashboard/tools/video"
                    icon={<Video size={15} className="text-fg-muted" />}
                >
                    {videoTools.length === 0 ? (
                        <div className="text-[13px] text-fg-faint py-4 text-center">No video tools.</div>
                    ) : (
                        <div className="space-y-1">
                            {videoTools.map((tool) => (
                                <ToolRow key={tool.id} tool={tool} category="video" />
                            ))}
                        </div>
                    )}
                </Section>
            </div>
        </div>
    );
}

/* ── Sub-components ──────────────────────────────────────── */

function StatCard({
    label,
    value,
    icon,
    href,
    warm,
}: {
    label: string;
    value: number;
    icon: React.ReactNode;
    href: string;
    warm?: boolean;
}) {
    return (
        <Link
            to={href}
            className="group flex items-center gap-4 p-4 rounded-[var(--radius-md)] border border-edge bg-surface-0 hover:border-edge-strong transition-all"
        >
            <div
                className={`w-9 h-9 rounded-[var(--radius-sm)] flex items-center justify-center transition-colors ${warm
                        ? "bg-[var(--color-action-muted)] text-[var(--color-action)]"
                        : "bg-surface-2 text-fg-muted group-hover:text-fg"
                    }`}
            >
                {icon}
            </div>
            <div>
                <div className="text-[22px] font-bold text-fg leading-none">{value}</div>
                <div className="text-[11px] text-fg-muted font-medium mt-0.5">{label}</div>
            </div>
        </Link>
    );
}

function Section({
    title,
    subtitle,
    href,
    icon,
    children,
}: {
    title: string;
    subtitle: string;
    href: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="border border-edge rounded-[var(--radius-md)] bg-surface-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-edge">
                <div className="flex items-center gap-2">
                    {icon}
                    <div>
                        <span className="text-[13px] font-semibold text-fg">{title}</span>
                        <span className="text-[11px] text-fg-faint ml-2">{subtitle}</span>
                    </div>
                </div>
                <Link
                    to={href}
                    className="text-[11px] text-fg-muted hover:text-[var(--color-action)] flex items-center gap-1 transition-colors"
                >
                    View all <ArrowRight size={11} />
                </Link>
            </div>
            <div className="p-3">{children}</div>
        </div>
    );
}

function ToolRow({ tool, category }: { tool: ToolEntry; category: string }) {
    const isActive = tool.status === "active";
    return (
        <Link
            to={`/dashboard/tools/${category}`}
            className={`group flex items-center gap-3 px-3 py-2 rounded-[var(--radius-sm)] transition-all ${isActive ? "hover:bg-surface-1" : "opacity-50"
                }`}
        >
            <div className="w-6 h-6 rounded-[var(--radius-sm)] bg-surface-2 flex items-center justify-center text-fg-muted">
                <Wrench size={12} />
            </div>
            <span className="text-[12px] font-medium text-fg flex-1">{tool.name}</span>
            {!isActive && (
                <span className="text-[10px] text-fg-faint bg-surface-2 px-1.5 py-0.5 rounded-full">Soon</span>
            )}
        </Link>
    );
}
