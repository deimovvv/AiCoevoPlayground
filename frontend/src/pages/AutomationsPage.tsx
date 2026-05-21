import { Zap, Plus, Clock, Calendar, ArrowRight, Play, Pause } from "lucide-react";
import { cn } from "../lib/utils";

interface Automation {
    id: string;
    name: string;
    trigger: string;
    action: string;
    schedule?: string;
    active: boolean;
    lastRun?: string;
}

const MOCK_AUTOMATIONS: Automation[] = [
    {
        id: "1",
        name: "Weekly Instagram Reel",
        trigger: "Every Monday 10:00 AM",
        action: "Generate UGC reel and publish to Instagram",
        schedule: "weekly",
        active: true,
        lastRun: "3 days ago",
    },
    {
        id: "2",
        name: "Product Launch Posts",
        trigger: "New product added",
        action: "Generate 3 social posts + 1 reel",
        active: false,
        lastRun: "Never",
    },
];

export function AutomationsPage() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-[22px] font-semibold text-fg tracking-tight">Automations</h1>
                    <p className="text-[14px] text-fg-muted mt-1">
                        Set up automated content creation and publishing workflows
                    </p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-[var(--color-action-fg)] bg-[var(--color-action)] rounded-[var(--radius-sm)] hover:opacity-90 transition-opacity cursor-pointer">
                    <Plus size={14} />
                    New Automation
                </button>
            </div>

            {/* Automations list */}
            <div className="space-y-3">
                {MOCK_AUTOMATIONS.map((auto) => (
                    <AutomationCard key={auto.id} automation={auto} />
                ))}
            </div>

            {/* Empty state for when there are no automations */}
            {MOCK_AUTOMATIONS.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Zap size={40} className="text-fg-faint mb-3" />
                    <p className="text-[14px] text-fg-muted">No automations yet</p>
                    <p className="text-[13px] text-fg-faint mt-1">
                        Create your first automation to streamline content creation
                    </p>
                </div>
            )}

            {/* Templates */}
            <div className="space-y-3 pt-4">
                <h2 className="text-[13px] font-semibold text-fg-muted uppercase tracking-wider">Templates</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                        { name: "Weekly Content Calendar", desc: "Auto-generate a week of social posts every Sunday", icon: <Calendar size={16} /> },
                        { name: "Post-to-Reel Pipeline", desc: "Convert top-performing posts into video reels", icon: <Play size={16} /> },
                        { name: "Scheduled Publishing", desc: "Queue content and publish at optimal times", icon: <Clock size={16} /> },
                    ].map((tmpl) => (
                        <div
                            key={tmpl.name}
                            className="bg-surface-1 border border-dashed border-edge rounded-[var(--radius-md)] p-4 hover:border-[var(--color-edge-strong)] transition-colors cursor-pointer"
                        >
                            <div className="flex items-center gap-2.5 mb-2">
                                <div className="text-fg-muted">{tmpl.icon}</div>
                                <h3 className="text-[13px] font-semibold text-fg">{tmpl.name}</h3>
                            </div>
                            <p className="text-[12px] text-fg-muted">{tmpl.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function AutomationCard({ automation }: { automation: Automation }) {
    return (
        <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-4 flex items-center gap-4">
            {/* Status indicator */}
            <div className={cn(
                "w-2 h-2 rounded-full shrink-0",
                automation.active ? "bg-[var(--color-success)]" : "bg-fg-faint"
            )} />

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <h3 className="text-[14px] font-semibold text-fg">{automation.name}</h3>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[12px] text-fg-muted">
                    <span>{automation.trigger}</span>
                    <ArrowRight size={10} className="text-fg-faint" />
                    <span>{automation.action}</span>
                </div>
            </div>

            {/* Last run */}
            <div className="text-[11px] text-fg-faint shrink-0">
                Last: {automation.lastRun}
            </div>

            {/* Toggle */}
            <button className={cn(
                "p-2 rounded-[var(--radius-sm)] transition-colors cursor-pointer",
                automation.active
                    ? "text-[var(--color-success)] bg-[rgba(61,191,138,0.1)] hover:bg-[rgba(61,191,138,0.15)]"
                    : "text-fg-faint bg-surface-2 hover:bg-surface-3"
            )}>
                {automation.active ? <Pause size={14} /> : <Play size={14} />}
            </button>
        </div>
    );
}
