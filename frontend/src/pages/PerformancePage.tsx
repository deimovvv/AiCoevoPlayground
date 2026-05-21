import { TrendingUp, Target, ArrowUpRight, ArrowDownRight, Eye, Heart, MessageCircle, Share2, DollarSign, MousePointerClick, Users } from "lucide-react";
import { cn } from "../lib/utils";
import { useBrand } from "../lib/BrandContext";

type Tab = "organic" | "ads";

export function PerformancePage({ tab }: { tab: Tab }) {
    const { activeBrand } = useBrand();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-[22px] font-semibold text-fg tracking-tight">
                    {tab === "organic" ? "Organic Performance" : "Ads Performance"}
                </h1>
                <p className="text-[14px] text-fg-muted mt-1">
                    {tab === "organic"
                        ? `Track organic reach and engagement for ${activeBrand?.name || "your brand"}`
                        : `Monitor ad campaigns and ROI for ${activeBrand?.name || "your brand"}`
                    }
                </p>
            </div>

            {/* Connect CTA */}
            <div className="bg-surface-1 border border-dashed border-edge rounded-[var(--radius-md)] p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center mx-auto mb-3">
                    {tab === "organic" ? <TrendingUp size={20} className="text-fg-muted" /> : <Target size={20} className="text-fg-muted" />}
                </div>
                <p className="text-[14px] text-fg font-medium">
                    {tab === "organic"
                        ? "Connect your social accounts to see organic metrics"
                        : "Connect Meta Ads to see campaign performance"
                    }
                </p>
                <p className="text-[13px] text-fg-muted mt-1 mb-4">
                    Go to Integrations to connect your accounts
                </p>
                <button className="px-4 py-2 text-[13px] font-medium text-[var(--color-action-fg)] bg-[var(--color-action)] rounded-[var(--radius-sm)] hover:opacity-90 transition-opacity cursor-pointer">
                    Set up Integrations
                </button>
            </div>

            {/* Preview metrics (mock/placeholder) */}
            <div className="space-y-4 opacity-50 pointer-events-none">
                <h2 className="text-[13px] font-semibold text-fg-muted uppercase tracking-wider">
                    Preview — {tab === "organic" ? "Last 30 Days" : "Active Campaigns"}
                </h2>

                {tab === "organic" ? (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <MetricCard label="Impressions" value="12.4K" change={+8.2} icon={<Eye size={14} />} />
                            <MetricCard label="Engagement" value="1,847" change={+12.5} icon={<Heart size={14} />} />
                            <MetricCard label="Comments" value="234" change={-3.1} icon={<MessageCircle size={14} />} />
                            <MetricCard label="Shares" value="89" change={+22.0} icon={<Share2 size={14} />} />
                        </div>

                        {/* Chart placeholder */}
                        <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-[13px] font-semibold text-fg">Engagement Over Time</h3>
                            </div>
                            <div className="h-48 flex items-end justify-between gap-1.5 px-2">
                                {Array.from({ length: 30 }, (_, i) => (
                                    <div
                                        key={i}
                                        className="flex-1 bg-[var(--color-action-muted)] rounded-t-sm"
                                        style={{ height: `${20 + Math.random() * 80}%` }}
                                    />
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <MetricCard label="Spend" value="$1,247" change={+5.0} icon={<DollarSign size={14} />} />
                            <MetricCard label="Clicks" value="3,891" change={+15.3} icon={<MousePointerClick size={14} />} />
                            <MetricCard label="CTR" value="2.4%" change={+0.3} icon={<Target size={14} />} />
                            <MetricCard label="Conversions" value="47" change={+8.7} icon={<Users size={14} />} />
                        </div>

                        {/* Campaigns placeholder */}
                        <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] overflow-hidden">
                            <div className="px-4 py-3 border-b border-edge">
                                <h3 className="text-[13px] font-semibold text-fg">Campaigns</h3>
                            </div>
                            <div className="divide-y divide-edge-subtle">
                                {["Spring Collection Launch", "Retargeting - Cart Abandon", "Brand Awareness Q1"].map((name) => (
                                    <div key={name} className="px-4 py-3 flex items-center justify-between">
                                        <span className="text-[13px] text-fg">{name}</span>
                                        <span className="text-[11px] text-fg-faint">—</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function MetricCard({
    label,
    value,
    change,
    icon,
}: {
    label: string;
    value: string;
    change: number;
    icon: React.ReactNode;
}) {
    const isPositive = change >= 0;

    return (
        <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-4">
            <div className="flex items-center justify-between mb-2">
                <div className="text-fg-muted">{icon}</div>
                <div className={cn(
                    "flex items-center gap-0.5 text-[11px] font-medium",
                    isPositive ? "text-[var(--color-success)]" : "text-[var(--color-error)]"
                )}>
                    {isPositive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                    {Math.abs(change)}%
                </div>
            </div>
            <p className="text-[20px] font-semibold text-fg">{value}</p>
            <p className="text-[11px] text-fg-faint mt-0.5">{label}</p>
        </div>
    );
}
