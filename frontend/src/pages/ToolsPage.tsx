import { useState, useEffect } from "react";
import { useLocation } from "react-router";
import { Sparkles, Eraser, Film, Image, Video, Play, ChevronRight, Clock, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";

interface ToolConfig {
    id: string;
    name: string;
    category: "images" | "video";
    description: string;
    icon: string;
    status: "active" | "coming_soon";
    params?: ToolParam[];
}

interface ToolParam {
    key: string;
    type: "file" | "number" | "text" | "textarea" | "select";
    label: string;
    required?: boolean;
    default?: any;
    min?: number;
    max?: number;
    placeholder?: string;
    helpText?: string;
    accept?: string;
    options?: { value: string; label: string }[];
}

const ICON_MAP: Record<string, React.ReactNode> = {
    sparkles: <Sparkles size={18} />,
    eraser: <Eraser size={18} />,
    film: <Film size={18} />,
};

export default function ToolsPage() {
    const location = useLocation();
    const [tools, setTools] = useState<ToolConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTool, setSelectedTool] = useState<ToolConfig | null>(null);

    const routeCategory = location.pathname.includes("/tools/video") ? "video" : "images";
    const categoryLabel = routeCategory === "video" ? "Video" : "Images";
    const CategoryIcon = routeCategory === "video" ? Video : Image;

    useEffect(() => {
        fetch("http://127.0.0.1:8000/api/tools")
            .then((r) => r.json())
            .then((data) => {
                setTools(data.tools || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const filteredTools = tools.filter((t) => t.category === routeCategory);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={20} className="animate-spin text-fg-muted" />
            </div>
        );
    }

    return (
        <div className="p-8 max-w-5xl">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-2.5 mb-1">
                    <CategoryIcon size={20} className="text-fg-muted" />
                    <h1 className="text-[22px] font-bold tracking-tight text-fg">
                        {categoryLabel} Tools
                    </h1>
                </div>
                <p className="text-[13px] text-fg-muted mt-1">
                    AI-powered {categoryLabel.toLowerCase()} tools. Select a tool to configure and run.
                </p>
            </div>

            {/* Tools Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredTools.map((tool) => (
                    <button
                        key={tool.id}
                        onClick={() => tool.status === "active" && setSelectedTool(tool)}
                        disabled={tool.status !== "active"}
                        className={`cursor-pointer group text-left border border-edge rounded-[var(--radius-md)] p-4 transition-all duration-150 ${tool.status === "active"
                                ? "bg-surface-0 hover:bg-surface-1 hover:border-edge-strong"
                                : "bg-surface-0 opacity-50 cursor-not-allowed"
                            }`}
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-surface-2 flex items-center justify-center text-fg-muted group-hover:text-fg transition-colors">
                                {ICON_MAP[tool.icon] || <Sparkles size={18} />}
                            </div>
                            {tool.status === "coming_soon" ? (
                                <span className="text-[10px] font-medium text-fg-faint bg-surface-2 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Clock size={10} /> Soon
                                </span>
                            ) : (
                                <ChevronRight
                                    size={14}
                                    className="text-fg-faint group-hover:text-fg-secondary group-hover:translate-x-0.5 transition-all"
                                />
                            )}
                        </div>
                        <div className="text-[14px] font-semibold text-fg mb-1">{tool.name}</div>
                        <div className="text-[12px] text-fg-muted leading-relaxed line-clamp-2">
                            {tool.description}
                        </div>
                    </button>
                ))}
            </div>

            {filteredTools.length === 0 && (
                <div className="text-center py-16 text-fg-muted text-[14px]">
                    No {categoryLabel.toLowerCase()} tools available yet.
                </div>
            )}

            {/* Tool Detail Modal */}
            {selectedTool && (
                <ToolDetailModal
                    tool={selectedTool}
                    onClose={() => setSelectedTool(null)}
                />
            )}
        </div>
    );
}

function ToolDetailModal({
    tool,
    onClose,
}: {
    tool: ToolConfig;
    onClose: () => void;
}) {
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [running, setRunning] = useState(false);

    useEffect(() => {
        const defaults: Record<string, any> = {};
        tool.params?.forEach((p) => {
            if (p.default !== undefined) defaults[p.key] = p.default;
        });
        setFormData(defaults);
    }, [tool]);

    const handleRun = async () => {
        setRunning(true);
        try {
            const res = await fetch(`http://127.0.0.1:8000/api/tools/${tool.id}/run`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });
            const data = await res.json();
            console.log("Job started:", data);
        } catch (err) {
            console.error(err);
        } finally {
            setRunning(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-surface-0 border border-edge rounded-[var(--radius-lg)] w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-edge">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-surface-2 flex items-center justify-center text-fg-muted">
                            {ICON_MAP[tool.icon] || <Sparkles size={18} />}
                        </div>
                        <div>
                            <h3 className="text-[15px] font-semibold text-fg">{tool.name}</h3>
                            <p className="text-[12px] text-fg-muted">{tool.description}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="cursor-pointer w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors text-lg"
                    >
                        ×
                    </button>
                </div>

                {/* Form */}
                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                    {tool.params?.map((param) => (
                        <div key={param.key} className="space-y-1.5">
                            <label className="text-[12px] font-medium text-fg-secondary">
                                {param.label}
                                {param.required && <span className="text-error ml-1">*</span>}
                            </label>

                            {param.type === "file" && (
                                <input
                                    type="file"
                                    accept={param.accept}
                                    className="w-full text-[13px] text-fg-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-[var(--radius-sm)] file:border file:border-edge file:text-[12px] file:font-medium file:bg-surface-2 file:text-fg file:cursor-pointer hover:file:bg-surface-3"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) setFormData((prev) => ({ ...prev, [param.key]: file }));
                                    }}
                                />
                            )}

                            {param.type === "number" && (
                                <input
                                    type="number"
                                    min={param.min}
                                    max={param.max}
                                    value={formData[param.key] ?? param.default ?? ""}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            [param.key]: parseInt(e.target.value),
                                        }))
                                    }
                                    className="w-full h-8 px-3 py-1 rounded-[var(--radius-sm)] border border-edge bg-control text-[13px] text-fg focus:outline-none focus:border-[var(--color-edge-focus)]"
                                />
                            )}

                            {param.type === "text" && (
                                <input
                                    type="text"
                                    placeholder={param.placeholder}
                                    value={formData[param.key] ?? ""}
                                    onChange={(e) =>
                                        setFormData((prev) => ({ ...prev, [param.key]: e.target.value }))
                                    }
                                    className="w-full h-8 px-3 py-1 rounded-[var(--radius-sm)] border border-edge bg-control text-[13px] text-fg placeholder:text-fg-faint focus:outline-none focus:border-[var(--color-edge-focus)]"
                                />
                            )}

                            {param.type === "textarea" && (
                                <textarea
                                    placeholder={param.placeholder}
                                    value={formData[param.key] ?? ""}
                                    rows={3}
                                    onChange={(e) =>
                                        setFormData((prev) => ({ ...prev, [param.key]: e.target.value }))
                                    }
                                    className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-edge bg-control text-[13px] text-fg placeholder:text-fg-faint resize-none focus:outline-none focus:border-[var(--color-edge-focus)]"
                                />
                            )}

                            {param.type === "select" && (
                                <select
                                    value={formData[param.key] ?? param.default ?? ""}
                                    onChange={(e) =>
                                        setFormData((prev) => ({ ...prev, [param.key]: e.target.value }))
                                    }
                                    className="w-full h-8 px-3 rounded-[var(--radius-sm)] border border-edge bg-control text-[13px] text-fg focus:outline-none focus:border-[var(--color-edge-focus)]"
                                >
                                    {param.options?.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            )}

                            {param.helpText && (
                                <p className="text-[11px] text-fg-faint">{param.helpText}</p>
                            )}
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 p-4 border-t border-edge">
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleRun} disabled={running}>
                        {running ? (
                            <>
                                <Loader2 size={14} className="animate-spin mr-1.5" />
                                Running...
                            </>
                        ) : (
                            <>
                                <Play size={13} className="mr-1.5" />
                                Run Tool
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
