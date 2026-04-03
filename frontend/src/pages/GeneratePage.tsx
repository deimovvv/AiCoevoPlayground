import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Sparkles,
  Video,
  Camera,
  Megaphone,
  Share2,
  Film,
  Eraser,
  Clock,
  ChevronRight,
  Loader2,
  Wand2,
} from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import { cn } from "../lib/utils";

// ── Tool registry type ─────────────────────────────────────

interface ToolEntry {
  id: string;
  name: string;
  category: "video" | "images" | "copy";
  description: string;
  icon: string;
  status: "active" | "coming_soon";
  pipeline: string[];
}

const ICON_MAP: Record<string, React.ReactNode> = {
  video: <Video size={20} />,
  camera: <Camera size={20} />,
  megaphone: <Megaphone size={20} />,
  share: <Share2 size={20} />,
  film: <Film size={20} />,
  eraser: <Eraser size={20} />,
};

const CATEGORY_COLORS: Record<string, string> = {
  video: "bg-purple-500/10 text-purple-400",
  images: "bg-blue-500/10 text-blue-400",
  copy: "bg-emerald-500/10 text-emerald-400",
};

const CATEGORY_LABELS: Record<string, string> = {
  video: "Video",
  images: "Images",
  copy: "Copy",
};

export function GeneratePage() {
  const { activeBrand } = useBrand();
  const navigate = useNavigate();
  const [tools, setTools] = useState<ToolEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "video" | "images" | "copy">("all");

  useEffect(() => {
    fetch("http://localhost:8000/api/tools")
      .then((r) => r.json())
      .then((data) => {
        setTools(data.tools || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filteredTools = filter === "all" ? tools : tools.filter((t) => t.category === filter);
  const categories = [...new Set(tools.map((t) => t.category))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={20} className="animate-spin text-fg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-fg tracking-tight flex items-center gap-2.5">
            <Wand2 size={22} className="text-[var(--color-warm)]" />
            Generate
          </h1>
          <p className="text-[14px] text-fg-muted mt-1">
            {activeBrand
              ? `Create content for ${activeBrand.name} using AI-powered tools`
              : "Select a brand to start generating content"}
          </p>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter("all")}
          className={cn(
            "px-3 py-1.5 text-[12px] font-medium rounded-[var(--radius-sm)] transition-colors cursor-pointer",
            filter === "all"
              ? "bg-surface-2 text-fg"
              : "text-fg-muted hover:text-fg hover:bg-surface-1"
          )}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat as typeof filter)}
            className={cn(
              "px-3 py-1.5 text-[12px] font-medium rounded-[var(--radius-sm)] transition-colors cursor-pointer",
              filter === cat
                ? "bg-surface-2 text-fg"
                : "text-fg-muted hover:text-fg hover:bg-surface-1"
            )}
          >
            {CATEGORY_LABELS[cat] || cat}
          </button>
        ))}
      </div>

      {/* Tools grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTools.map((tool) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            disabled={!activeBrand || tool.status !== "active"}
            onClick={() => navigate(`/dashboard/generate/${tool.id}`)}
          />
        ))}
      </div>

      {filteredTools.length === 0 && (
        <div className="text-center py-16 text-fg-muted text-[14px]">
          No tools available in this category.
        </div>
      )}
    </div>
  );
}

function ToolCard({
  tool,
  disabled,
  onClick,
}: {
  tool: ToolEntry;
  disabled: boolean;
  onClick: () => void;
}) {
  const isComingSoon = tool.status === "coming_soon";

  return (
    <button
      onClick={onClick}
      disabled={disabled || isComingSoon}
      className={cn(
        "group text-left border border-edge rounded-[var(--radius-md)] p-5 transition-all duration-150 cursor-pointer",
        disabled || isComingSoon
          ? "bg-surface-0 opacity-50 cursor-not-allowed"
          : "bg-surface-0 hover:bg-surface-1 hover:border-[var(--color-edge-strong)] hover:shadow-[0_2px_12px_rgba(0,0,0,0.3)]"
      )}
    >
      {/* Top row: icon + badge */}
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-[var(--radius-md)] bg-surface-2 flex items-center justify-center text-fg-muted group-hover:text-fg transition-colors">
          {ICON_MAP[tool.icon] || <Sparkles size={20} />}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-[10px] font-medium px-2 py-0.5 rounded-full",
              CATEGORY_COLORS[tool.category] || "bg-surface-2 text-fg-faint"
            )}
          >
            {CATEGORY_LABELS[tool.category] || tool.category}
          </span>
          {isComingSoon && (
            <span className="text-[10px] font-medium text-fg-faint bg-surface-2 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Clock size={9} /> Soon
            </span>
          )}
        </div>
      </div>

      {/* Name + description */}
      <h3 className="text-[15px] font-semibold text-fg mb-1.5">{tool.name}</h3>
      <p className="text-[12px] text-fg-muted leading-relaxed mb-4">
        {tool.description}
      </p>

      {/* Pipeline steps preview */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {tool.pipeline.map((step, i) => (
          <span key={step} className="flex items-center gap-1">
            <span className="text-[10px] font-medium text-fg-faint bg-surface-2 px-2 py-0.5 rounded">
              {step}
            </span>
            {i < tool.pipeline.length - 1 && (
              <ChevronRight size={9} className="text-fg-faint" />
            )}
          </span>
        ))}
      </div>
    </button>
  );
}
