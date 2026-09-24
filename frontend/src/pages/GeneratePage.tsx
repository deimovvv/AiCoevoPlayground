import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
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
  Quote,
} from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import { cn } from "../lib/utils";
import { TOOL_PREVIEW_MEDIA } from "../lib/toolPreviews";

interface ToolEntry {
  id: string;
  name: string;
  category: "video" | "images" | "copy";
  description: string;
  icon: string;
  status: "active" | "coming_soon";
  pipeline: string[];
  /** Optional custom route for tools that have their own page outside ToolRunPage
   *  (e.g. batch flows that don't fit the brief→generate→save pipeline). */
  route?: string;
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

// Punchy tagline per tool — overrides description on card
const TOOL_TAGLINES: Record<string, string> = {
  ugc_creator: "Avatars hablando a cámara, listos para publicar",
  video_ad_creator: "Video ads con storyboard generado por IA",
  static_ad: "40 templates de creativos estáticos",
  carousel_creator: "Carruseles consistentes para IG y LinkedIn",
  fashion_reel: "Reels editoriales de moda sin guion",
  product_clip: "Clips de producto frame-by-frame",
  product_spotlight: "Fotografía profesional en contexto",
  ad_creative_lab: "Batch de creativos desde referencias",
  avatar_creator: "Crear nuevos avatars o generar pose sheets para los que ya tenés",
  content_analyzer: "Analizá un video y adaptálo a tu marca",
  video_swap: "Cambiá ropa, producto o fondo en TU video — sin perder el movimiento",
  ecommerce_pack: "Ficha de producto: prenda sobre modelo + vistas, en estudio",
  fashion_editorial: "Editorial de moda: modelo + prenda, look de revista. Brief en español → variantes",
  ecommerce_batch: "Batch: drop carpeta de outfits + poses, generá todas las fotos de catálogo de una",
  product_sheet: "Sheet del producto: vistas múltiples o close-ups, desde 1-4 fotos",
  screen_mockup: "Tu app/UI en un dispositivo real, en contexto lifestyle",
  fooh_subway: "Tu ad en un billboard de metro, foto-real (FOOH)",
};

/**
 * Fondo de fallback cuando una tool no tiene preview (o el archivo 404ea).
 *
 * Antes era un gradiente de color SATURADO distinto por tool (fucsia, lima, cian,
 * violeta...). Con 17 tools en grilla eso se leía como un arcoíris y ensuciaba las
 * piezas reales que tienen al lado. Ahora es escala de grises fría: el único color
 * del catálogo lo ponen las fotos.
 */
const TOOL_GRADIENTS: Record<string, string> = {};
const FALLBACK_GRADIENT = "from-white/[0.06] via-white/[0.03] to-transparent";

const CATEGORY_LABELS: Record<string, string> = {
  video: "Video",
  images: "Imágenes",
  copy: "Copy",
};

// Use-cases (cara "App" tipo Pletor) — agrupan las tools por caso de uso. El orden define
// las filas. Tools no mapeadas caen en "Más tools".
const USE_CASES: Array<{ key: string; label: string; toolIds: string[] }> = [
  { key: "fashion", label: "Moda & editorial", toolIds: ["fashion_reel", "fashion_editorial"] },
  { key: "ecommerce", label: "Ecommerce & producto", toolIds: ["ecommerce_pack", "ecommerce_batch", "product_sheet", "product_clip", "product_spotlight"] },
  { key: "ugc", label: "UGC & avatares", toolIds: ["ugc_creator", "avatar_creator"] },
  { key: "ads", label: "Ads & creativos", toolIds: ["video_ad_creator", "static_ad", "fooh_subway", "ad_creative_lab", "carousel_creator"] },
  { key: "adapt", label: "Analizar & adaptar", toolIds: ["content_analyzer", "video_swap"] },
];

/**
 * Card de los carruseles por use-case (vista "Todas").
 *
 * Comparte el lenguaje del `ToolCard` de grilla: la IMAGEN es la card, el chrome se
 * corre. Antes era 210×280px fijo con glass-border y radio grande — al lado de la
 * grilla filtrada (cards grandes) se veía como otro producto.
 *
 * Sigue con ancho fijo porque vive en un flex row horizontal, pero subió de 210 a
 * 268px y la proporción pasó a 3:4, la misma de la grilla.
 */
function ToolTile({ tool, disabled, onClick }: { tool: ToolEntry; disabled: boolean; onClick: () => void }) {
  const media = TOOL_PREVIEW_MEDIA[tool.id];
  const tagline = TOOL_TAGLINES[tool.id] || tool.description;
  const gradient = TOOL_GRADIENTS[tool.id] || FALLBACK_GRADIENT;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group relative shrink-0 w-[268px] h-[357px] rounded-[var(--radius-md)] overflow-hidden transition-all duration-300",
        "bg-[var(--color-surface-0)] border border-[var(--color-edge-subtle)]",
        disabled ? "opacity-40 cursor-not-allowed" : "hover:border-[var(--color-edge)] cursor-pointer",
      )}
    >
      {/* Fallback: si el preview falta o 404ea, queda el fondo neutro con la inicial. */}
      <div className={cn("absolute inset-0 bg-gradient-to-br flex items-center justify-center", gradient)}>
        <span className="text-[44px] font-light text-white/12">{tool.name[0]}</span>
      </div>
      {media?.type === "video" ? (
        <video src={media.url} autoPlay muted loop playsInline preload="metadata" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" onError={(e) => { (e.currentTarget as HTMLVideoElement).style.display = "none"; }} />
      ) : media?.type === "image" ? (
        <img src={media.url} alt={tool.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
      ) : null}
      {/* Velo SOLO abajo — a pantalla completa apagaba la foto. */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
      <span className="absolute top-3 left-3 text-[10px] font-medium uppercase tracking-[0.12em] text-white/60 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
        {CATEGORY_LABELS[tool.category] || tool.category}
      </span>
      <div className="absolute inset-x-0 bottom-0 p-4 text-left">
        <h3 className="text-[15px] font-medium text-white tracking-[-0.01em] leading-tight">{tool.name}</h3>
        <p className="mt-1 text-[11.5px] text-white/55 leading-snug line-clamp-2">{tagline}</p>
      </div>
    </button>
  );
}


export function GeneratePage() {
  const { activeBrand } = useBrand();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ask = searchParams.get("ask")?.trim() || "";
  // Id del pedido, si venimos de uno. Viaja en la URL hasta la tool para que las piezas
  // que salgan vuelvan a colgar del pedido (ver tools/shared/autoSave.ts).
  const campaignId = searchParams.get("campaign") || "";
  const openTool = (tool: { id: string; route?: string }) => {
    const base = tool.route || `/dashboard/generate/${tool.id}`;
    navigate(campaignId ? `${base}?campaign=${encodeURIComponent(campaignId)}` : base);
  };
  const [tools, setTools] = useState<ToolEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "video" | "images" | "copy">("all");

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/tools")
      .then((r) => r.json())
      .then((data) => {
        setTools(data.tools || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filteredTools = filter === "all" ? tools : tools.filter((t) => t.category === filter);
  // Tools with a real preview (photo/video) go first — they read better in the grid.
  const orderedTools = [...filteredTools].sort(
    (a, b) => (TOOL_PREVIEW_MEDIA[b.id] ? 1 : 0) - (TOOL_PREVIEW_MEDIA[a.id] ? 1 : 0),
  );
  const categories = [...new Set(tools.map((t) => t.category))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={20} className="animate-spin text-fg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-9">
      {/* Pedido que viene del intake de Inicio. Todavía no existe la entidad "pedido"
          (docs/campaigns.md Fase 1), así que se muestra como intención mientras elegís
          la tool — pero NO se pierde por el camino. */}
      {ask && (
        <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-action)] bg-[var(--color-action-muted)] px-4 py-3">
          <Quote size={14} className="text-[var(--color-action)] shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-[.12em] text-fg-muted">Tu pedido</p>
            <p className="text-[13.5px] text-fg mt-0.5">{ask}</p>
          </div>
          <span className="ml-auto text-[11px] text-fg-muted shrink-0">Elegí con qué tool arrancarlo</span>
        </div>
      )}

      {/* Hero Header — editorial, with manifesto eyebrow */}
      <div className="space-y-3">
        <h1 className="text-[26px] md:text-[30px] font-medium text-fg tracking-[-0.03em] leading-[1.05]">
          Generá contenido
        </h1>
        <p className="text-[13px] text-fg-muted max-w-xl leading-relaxed">
          {activeBrand
            ? <>Elegí una tool para crear contenido para <span className="text-fg">{activeBrand.name}</span>. La IA produce, vos dirigís.</>
            : "Seleccioná una marca para empezar a generar contenido."}
        </p>
      </div>

      {/* Category filter — refined neutral active state (no pink everywhere) */}
      <div className="inline-flex items-center gap-1 bg-[var(--color-surface-0)] border border-[var(--color-edge-subtle)] rounded-[var(--radius-sm)] p-0.5">
        {(["all", ...categories] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat as typeof filter)}
            className={cn(
              "px-3.5 py-1.5 text-[12px] font-medium rounded-[4px] transition-all cursor-pointer",
              filter === cat
                ? "bg-fg text-[var(--color-canvas)]"
                : "text-fg-muted hover:text-fg hover:bg-surface-2"
            )}
          >
            {cat === "all" ? "Todas" : CATEGORY_LABELS[cat] || cat}
          </button>
        ))}
      </div>

      {/* "Todas" → galería de use-cases (carousels con ToolTile de altura fija).
          Con filtro activo → grid plano con el ToolCard grande. */}
      {filter === "all" ? (
        (() => {
          const tile = (tool: ToolEntry) => (
            <ToolTile key={tool.id} tool={tool} disabled={!activeBrand || tool.status !== "active"} onClick={() => openTool(tool)} />
          );
          const mappedIds = new Set(USE_CASES.flatMap((u) => u.toolIds));
          const rest = orderedTools.filter((t) => !mappedIds.has(t.id));
          return (
            <div className="space-y-9">
              {USE_CASES.map((uc) => {
                const ucTools = uc.toolIds.map((id) => orderedTools.find((t) => t.id === id)).filter(Boolean) as ToolEntry[];
                if (ucTools.length === 0) return null;
                return (
                  <section key={uc.key}>
                    <h2 className="text-[12px] font-medium uppercase tracking-[0.14em] text-fg-muted mb-3">{uc.label}</h2>
                    <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 no-scrollbar">{ucTools.map(tile)}</div>
                  </section>
                );
              })}
              {rest.length > 0 && (
                <section>
                  <h2 className="text-[12px] font-medium uppercase tracking-[0.14em] text-fg-muted mb-3">Más tools</h2>
                  <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 no-scrollbar">{rest.map(tile)}</div>
                </section>
              )}
            </div>
          );
        })()
      ) : (
        // Menos columnas = cards MÁS GRANDES. A 4 columnas la preview quedaba chica y
        // las piezas no se leían. El aire ahora lo da la imagen, no el gap.
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {orderedTools.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              disabled={!activeBrand || tool.status !== "active"}
              onClick={() => openTool(tool)}
            />
          ))}
        </div>
      )}

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
  const gradient = TOOL_GRADIENTS[tool.id] || FALLBACK_GRADIENT;
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
        // Minimal: sin glass-sheen ni blur. La card es la IMAGEN; el chrome se corre.
        // El glow verde lima del hover salió — era un acento que ya no existe en la paleta.
        "group text-left rounded-[var(--radius-md)] overflow-hidden transition-all duration-300 relative flex flex-col",
        "bg-[var(--color-surface-0)] border border-[var(--color-edge-subtle)]",
        disabled || isComingSoon
          ? "opacity-40 cursor-not-allowed"
          : "hover:border-[var(--color-edge)] cursor-pointer"
      )}
    >
      {/* Preview — dominant hero */}
      <div className="relative aspect-[3/4] overflow-hidden bg-[var(--color-canvas)]">
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
              "absolute inset-0 w-full h-full object-cover transition-transform duration-500",
              hover && "scale-[1.03]"
            )}
            onError={(e) => { (e.currentTarget as HTMLVideoElement).style.display = "none"; }}
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
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        )}

        {/* Dark gradient overlay for text readability */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

        {/* Top badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/60 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
            {CATEGORY_LABELS[tool.category] || tool.category}
          </span>
          {isComingSoon && (
            <span className="text-[9px] font-semibold uppercase tracking-wider text-white bg-white/20 backdrop-blur px-2 py-0.5 rounded-full flex items-center gap-1">
              <Clock size={9} />
              Pronto
            </span>
          )}
        </div>

        {/* Bottom: name + tagline + lime "Generar" affordance on hover (action signal) */}
        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
          <h3 className="text-[15px] font-medium tracking-[-0.01em] leading-tight">
            {tool.name}
          </h3>
          <p className="mt-1 text-[11.5px] text-white/55 leading-snug line-clamp-2">
            {tagline}
          </p>
          {!disabled && !isComingSoon && (
            <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-white/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              Generar
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
