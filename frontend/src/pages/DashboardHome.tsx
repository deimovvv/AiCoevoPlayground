import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, Plus, Megaphone, Sparkles, Play, ChevronRight } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import { listCampaigns, type Campaign } from "../lib/api";
import { cn } from "../lib/utils";

// Tools destacadas — reusa los previews reales de public/previews. Editá para sumar/quitar.
const FEATURED_TOOLS: Array<{ id: string; name: string; tagline: string; src?: string; type?: "video" | "image"; gradient: string }> = [
  { id: "fashion_reel", name: "Fashion Reel", tagline: "Reels editoriales de moda", src: "/previews/agnatesttt.mp4", type: "video", gradient: "from-fuchsia-500/30 to-orange-500/25" },
  { id: "ecommerce_pack", name: "Ecommerce Pack", tagline: "Prenda sobre modelo + vistas", src: "/previews/eccomerce.png", type: "image", gradient: "from-amber-500/25 to-rose-500/20" },
  { id: "ugc_creator", name: "UGC Creator", tagline: "Avatars hablando a cámara", src: "/previews/ugccreator.mp4", type: "video", gradient: "from-violet-500/30 to-pink-500/20" },
  { id: "video_ad_creator", name: "Video Ad Creator", tagline: "Ads con storyboard IA", src: "/previews/videoadcreator.mp4", type: "video", gradient: "from-sky-500/25 to-indigo-500/25" },
  { id: "content_analyzer", name: "Content Analyzer", tagline: "Analizá un video y adaptalo", gradient: "from-emerald-500/25 to-teal-500/20" },
  { id: "static_ad", name: "Static Ad", tagline: "40 templates de creativos", src: "/previews/staticad.png", type: "image", gradient: "from-orange-500/25 to-red-500/20" },
];

const STATUS_LABEL: Record<Campaign["status"], { label: string; cls: string }> = {
  draft: { label: "Borrador", cls: "bg-surface-2 text-fg-muted" },
  generating: { label: "Generando", cls: "bg-[var(--color-action-muted)] text-[var(--color-action)]" },
  review: { label: "En revisión", cls: "bg-[var(--color-brand-subtle)] text-[var(--color-brand)]" },
  approved: { label: "Aprobada", cls: "bg-green-500/15 text-green-400" },
};

function Media({ src, type, className }: { src?: string; type?: "video" | "image"; className?: string }) {
  if (!src) return null;
  if (type === "video") return <video src={src} className={className} autoPlay muted loop playsInline preload="metadata" />;
  return <img src={src} alt="" className={className} loading="lazy" />;
}

export function DashboardHome() {
  const navigate = useNavigate();
  const { activeBrand } = useBrand();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    if (!activeBrand) return; // la sección de campañas ya está gateada por activeBrand
    let alive = true;
    listCampaigns(activeBrand.id)
      .then((cs) => { if (alive) setCampaigns(cs.slice(0, 3)); })
      .catch(() => { if (alive) setCampaigns([]); });
    return () => { alive = false; };
  }, [activeBrand]);

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10">
      {/* Greeting */}
      <div className="mb-10">
        <p className="text-[13px] text-fg-faint mb-1">Hola 👋</p>
        <h1 className="font-display text-[32px] md:text-[44px] font-semibold tracking-[-0.01em] leading-tight">
          Bienvenido a <span className="italic text-[var(--color-brand)]">Coevo</span>
        </h1>
        <p className="text-[14px] text-fg-muted mt-2">
          {activeBrand ? <>Trabajando sobre <span className="text-fg font-medium">{activeBrand.name}</span>. Elegí una tool o retomá una campaña.</> : "Elegí una marca en el switcher para empezar."}
        </p>
      </div>

      {/* Tools carousel */}
      <section className="mb-12">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-display text-[20px] md:text-[24px] font-semibold tracking-tight">Empezá con una tool</h2>
          <button onClick={() => navigate("/dashboard/generate")} className="flex items-center gap-1 text-[12px] text-fg-muted hover:text-fg cursor-pointer">Ver todas <ChevronRight size={13} /></button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1 no-scrollbar">
          {FEATURED_TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => navigate(`/dashboard/generate/${t.id}`)}
              className="group text-left shrink-0 w-[220px] rounded-[var(--radius-md)] border border-edge bg-surface-0 overflow-hidden hover:border-[var(--color-brand)] transition-colors cursor-pointer"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-surface-2">
                {t.src ? (
                  <Media src={t.src} type={t.type} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
                ) : (
                  <div className={cn("w-full h-full bg-gradient-to-br flex items-center justify-center", t.gradient)}>
                    <span className="text-[34px] font-bold text-white/70">{t.name[0]}</span>
                  </div>
                )}
                {t.type === "video" && <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center"><Play size={11} className="fill-white" /></span>}
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[13px] font-semibold">{t.name}</h3>
                  <ArrowRight size={13} className="text-fg-faint group-hover:text-[var(--color-brand)] group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-[11px] text-fg-muted leading-snug mt-0.5">{t.tagline}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Campañas recientes */}
      {activeBrand && (
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-display text-[20px] md:text-[24px] font-semibold tracking-tight">Campañas recientes</h2>
            <button onClick={() => navigate("/dashboard/campaigns")} className="flex items-center gap-1 text-[12px] text-fg-muted hover:text-fg cursor-pointer">Ver todas <ChevronRight size={13} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Nueva campaña */}
            <button onClick={() => navigate("/dashboard/campaigns/new")}
              className="rounded-[var(--radius-md)] border border-dashed border-edge hover:border-[var(--color-brand)] p-4 flex flex-col items-center justify-center gap-2 text-fg-muted hover:text-fg transition-colors cursor-pointer min-h-[110px]">
              <Plus size={20} /> <span className="text-[12px] font-medium">Nueva campaña</span>
            </button>
            {campaigns.map((c) => {
              const st = STATUS_LABEL[c.status] || STATUS_LABEL.draft;
              return (
                <button key={c.id} onClick={() => navigate(`/dashboard/campaigns/${c.id}`)}
                  className="group text-left rounded-[var(--radius-md)] border border-edge bg-surface-0 p-4 hover:border-[var(--color-brand)] transition-colors cursor-pointer">
                  <div className="flex items-start gap-2 mb-2">
                    <Megaphone size={15} className="text-[var(--color-brand)] shrink-0 mt-0.5" />
                    <h3 className="text-[13px] font-semibold leading-tight line-clamp-2">{c.name}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-medium", st.cls)}>{st.label}</span>
                    <span className="text-[10px] text-fg-faint">{c.pieces?.length || 0} pieza{(c.pieces?.length || 0) === 1 ? "" : "s"}</span>
                  </div>
                </button>
              );
            })}
            {campaigns.length === 0 && (
              <div className="sm:col-span-1 lg:col-span-3 flex items-center text-[12px] text-fg-faint px-1">
                <Sparkles size={13} className="mr-1.5 text-[var(--color-brand)]" /> Todavía no hay campañas para {activeBrand.name}. Creá la primera.
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
