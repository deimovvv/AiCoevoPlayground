import { useState, useEffect, useRef } from "react";
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
  Loader2,
} from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import { cn } from "../lib/utils";

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
  video: <Video size={18} />,
  camera: <Camera size={18} />,
  megaphone: <Megaphone size={18} />,
  share: <Share2 size={18} />,
  film: <Film size={18} />,
  eraser: <Eraser size={18} />,
  sparkles: <Sparkles size={18} />,
};

const TOOL_PREVIEW_MEDIA: Record<string, { url: string; type: "image" | "video" }> = {
  video_ad_creator: { url: "/previews/videoadcreator.mp4", type: "video" },
  ugc_creator: { url: "/previews/ugccreator.mp4", type: "video" },
  static_ad: { url: "/previews/staticad.png", type: "image" },
};

// Punchy tagline per tool — overrides description on card
const TOOL_TAGLINES: Record<string, string> = {
  ugc_creator: "Avatars hablando a cámara, listos para publicar",
  video_ad_creator: "Video ads con storyboard generado por IA",
  static_ad: "40 templates de creativos estáticos",
  carousel_creator: "Carruseles consistentes para IG y LinkedIn",
  fashion_reel: "Reels editoriales de moda sin guion",
  fashion_editorial: "Fotografía editorial de alta gama",
  product_clip: "Clips de producto frame-by-frame",
  product_spotlight: "Fotografía profesional en contexto",
  ad_creative_lab: "Batch de creativos desde referencias",
  avatar_creator: "Avatars nuevos para tu marca",
  content_analyzer: "Analizá un video y adaptálo a tu marca",
};

// Subtle gradient per tool for fallback previews (when no media)
const TOOL_GRADIENTS: Record<string, string> = {
  ugc_creator: "from-purple-500/30 via-pink-500/20 to-orange-500/30",
  video_ad_creator: "from-blue-500/30 via-indigo-500/20 to-purple-500/30",
  static_ad: "from-amber-500/30 via-orange-500/20 to-red-500/30",
  carousel_creator: "from-emerald-500/30 via-teal-500/20 to-cyan-500/30",
  fashion_reel: "from-fuchsia-500/30 via-pink-500/20 to-rose-500/30",
  fashion_editorial: "from-neutral-500/30 via-stone-500/20 to-zinc-500/30",
  product_clip: "from-sky-500/30 via-blue-500/20 to-indigo-500/30",
  product_spotlight: "from-yellow-500/30 via-amber-500/20 to-orange-500/30",
  ad_creative_lab: "from-violet-500/30 via-purple-500/20 to-fuchsia-500/30",
  avatar_creator: "from-rose-500/30 via-pink-500/20 to-fuchsia-500/30",
  content_analyzer: "from-green-500/30 via-emerald-500/20 to-teal-500/30",
};

const CATEGORY_LABELS: Record<string, string> = {
  video: "Video",
  images: "Imágenes",
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
    <div className="space-y-10">
      {/* Hero Header — editorial */}
      <div className="space-y-3">
        <h1 className="text-[36px] font-bold text-fg tracking-[-0.03em] leading-none">
          Generá contenido.
        </h1>
        <p className="text-[15px] text-fg-muted max-w-2xl leading-relaxed">
          {activeBrand
            ? <>Elegí una tool para crear contenido para <span className="text-fg font-medium">{activeBrand.name}</span>. La IA produce, vos dirigís.</>
            : "Seleccioná una marca para empezar a generar contenido."}
        </p>
      </div>

      {/* Category filter — pill container */}
      <div className="inline-flex items-center gap-1 bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] rounded-full p-1">
        {(["all", ...categories] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat as typeof filter)}
            className={cn(
              "px-4 py-1.5 text-[12px] font-medium rounded-full transition-all cursor-pointer",
              filter === cat
                ? "bg-[var(--color-warm)] text-[var(--color-warm-fg)] shadow-sm"
                : "text-fg-muted hover:text-fg"
            )}
          >
            {cat === "all" ? "Todas" : CATEGORY_LABELS[cat] || cat}
          </button>
        ))}
      </div>

      {/* Tools grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
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
          No hay tools disponibles en esta categoría.
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
  const media = TOOL_PREVIEW_MEDIA[tool.id];
  const tagline = TOOL_TAGLINES[tool.id] || tool.description;
  const gradient = TOOL_GRADIENTS[tool.id] || "from-surface-2 via-surface-1 to-surface-0";
  const [hover, setHover] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || media?.type !== "video") return;
    if (hover) {
      v.currentTime = 0;
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [hover, media]);

  return (
    <button
      onClick={onClick}
      disabled={disabled || isComingSoon}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn(
        "glass-sheen group text-left rounded-[var(--radius-lg)] overflow-hidden transition-all duration-500 relative flex flex-col",
        "bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)]",
        disabled || isComingSoon
          ? "opacity-50 cursor-not-allowed"
          : "hover:border-[var(--glass-border-hover)] hover:shadow-[0_24px_60px_-20px_rgba(250,205,234,0.15)] hover:-translate-y-1 cursor-pointer"
      )}
    >
      {/* Preview — dominant hero */}
      <div className="relative aspect-[4/5] overflow-hidden bg-black">
        {/* Gradient background (always present, softens when media loads) */}
        <div className={cn("absolute inset-0 bg-gradient-to-br", gradient)} />

        {/* Big icon watermark (visible when no media) */}
        {!media && (
          <div className="absolute inset-0 flex items-center justify-center text-white/20">
            <div className="scale-[4]">{ICON_MAP[tool.icon] || <Sparkles size={18} />}</div>
          </div>
        )}

        {/* Media */}
        {media?.type === "video" && (
          <video
            ref={videoRef}
            src={media.url}
            muted
            loop
            playsInline
            preload="metadata"
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
              hover ? "opacity-100" : "opacity-80"
            )}
          />
        )}
        {media?.type === "image" && (
          <img
            src={media.url}
            alt={tool.name}
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-transform duration-500",
              hover && !disabled && "scale-105"
            )}
          />
        )}

        {/* Dark gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />

        {/* Top badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/80 bg-black/40 backdrop-blur px-2 py-0.5 rounded-full">
            {CATEGORY_LABELS[tool.category] || tool.category}
          </span>
          {isComingSoon && (
            <span className="text-[9px] font-semibold uppercase tracking-wider text-white bg-white/20 backdrop-blur px-2 py-0.5 rounded-full flex items-center gap-1">
              <Clock size={9} />
              Pronto
            </span>
          )}
        </div>

        {/* Bottom: name + tagline */}
        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
          <h3 className="text-[18px] font-bold tracking-tight leading-tight mb-1">
            {tool.name}
          </h3>
          <p className="text-[12px] text-white/80 leading-snug line-clamp-2">
            {tagline}
          </p>
        </div>

        {/* Play indicator on video hover */}
        {media?.type === "video" && !hover && !disabled && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/15 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="white"><path d="M5 3l8 5-8 5z" /></svg>
          </div>
        )}
      </div>
    </button>
  );
}
