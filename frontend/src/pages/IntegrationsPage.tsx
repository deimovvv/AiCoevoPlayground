import { ExternalLink, Check } from "lucide-react";
import { cn } from "../lib/utils";

interface Integration {
    id: string;
    name: string;
    description: string;
    icon: string;
    status: "connected" | "available" | "coming_soon";
    category: "social" | "ads" | "analytics" | "storage";
}

const INTEGRATIONS: Integration[] = [
    {
        id: "meta-ads",
        name: "Meta Ads",
        description: "Run and manage Facebook & Instagram ad campaigns directly",
        icon: "📘",
        status: "available",
        category: "ads",
    },
    {
        id: "instagram",
        name: "Instagram",
        description: "Publish posts, reels, and stories. Schedule content automatically",
        icon: "📸",
        status: "available",
        category: "social",
    },
    {
        id: "tiktok",
        name: "TikTok",
        description: "Publish videos and manage your TikTok Business account",
        icon: "🎵",
        status: "available",
        category: "social",
    },
    {
        id: "youtube",
        name: "YouTube",
        description: "Upload Shorts and videos to your channel",
        icon: "▶️",
        status: "coming_soon",
        category: "social",
    },
    {
        id: "google-ads",
        name: "Google Ads",
        description: "Create and manage Google Ads campaigns with AI-generated creatives",
        icon: "🔍",
        status: "coming_soon",
        category: "ads",
    },
    {
        id: "google-analytics",
        name: "Google Analytics",
        description: "Track content performance and conversions",
        icon: "📊",
        status: "coming_soon",
        category: "analytics",
    },
    {
        id: "shopify",
        name: "Shopify",
        description: "Sync products and create content for your store",
        icon: "🛒",
        status: "coming_soon",
        category: "storage",
    },
    {
        id: "google-drive",
        name: "Google Drive",
        description: "Auto-export generated content to Drive folders",
        icon: "📁",
        status: "coming_soon",
        category: "storage",
    },
];

export function IntegrationsPage() {
    const connected = INTEGRATIONS.filter((i) => i.status === "connected");
    const available = INTEGRATIONS.filter((i) => i.status === "available");
    const comingSoon = INTEGRATIONS.filter((i) => i.status === "coming_soon");

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-[22px] font-semibold text-fg tracking-tight">Integrations</h1>
                <p className="text-[14px] text-fg-muted mt-1">
                    Connect your accounts to publish content and track performance
                </p>
            </div>

            {/* Connected */}
            {connected.length > 0 && (
                <Section title="Connected">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {connected.map((i) => (
                            <IntegrationCard key={i.id} integration={i} />
                        ))}
                    </div>
                </Section>
            )}

            {/* Available */}
            <Section title="Available">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {available.map((i) => (
                        <IntegrationCard key={i.id} integration={i} />
                    ))}
                </div>
            </Section>

            {/* Coming Soon */}
            <Section title="Coming Soon">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {comingSoon.map((i) => (
                        <IntegrationCard key={i.id} integration={i} />
                    ))}
                </div>
            </Section>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-3">
            <h2 className="text-[13px] font-semibold text-fg-muted uppercase tracking-wider">{title}</h2>
            {children}
        </div>
    );
}

function IntegrationCard({ integration }: { integration: Integration }) {
    const { name, description, icon, status } = integration;

    return (
        <div className={cn(
            "bg-surface-1 border border-edge rounded-[var(--radius-md)] p-4 flex flex-col gap-3 transition-colors",
            status === "coming_soon" ? "opacity-50" : "hover:border-[var(--color-edge-strong)]"
        )}>
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">{icon}</span>
                    <div>
                        <h3 className="text-[14px] font-semibold text-fg">{name}</h3>
                    </div>
                </div>
                {status === "connected" && (
                    <div className="flex items-center gap-1 text-[var(--color-success)] text-[11px] font-medium">
                        <Check size={12} /> Connected
                    </div>
                )}
            </div>

            <p className="text-[12px] text-fg-muted leading-relaxed">{description}</p>

            <div className="mt-auto pt-1">
                {status === "connected" ? (
                    <button className="w-full px-3 py-2 text-[12px] font-medium text-fg-muted bg-surface-2 rounded-[var(--radius-sm)] hover:text-fg transition-colors cursor-pointer">
                        Manage
                    </button>
                ) : status === "available" ? (
                    <button className="w-full px-3 py-2 text-[12px] font-medium text-[var(--color-action-fg)] bg-[var(--color-action)] rounded-[var(--radius-sm)] hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-1.5">
                        <ExternalLink size={12} />
                        Connect
                    </button>
                ) : (
                    <div className="w-full px-3 py-2 text-[12px] font-medium text-fg-faint text-center">
                        Coming soon
                    </div>
                )}
            </div>
        </div>
    );
}
