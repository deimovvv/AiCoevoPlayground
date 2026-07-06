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
    <div className="relative max-w-6xl mx-auto p-6 md:p-10">
      {/* Ambiente rico detrás — le da al glass algo que frostear (warm burgundy + cool). */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] -z-10"
        style={{ background: "radial-gradient(45% 90% at 12% 0%, rgba(196,88,48,0.22), transparent 65%), radial-gradient(40% 80% at 85% 5%, rgba(120,110,220,0.16), transparent 65%), radial-gradient(60% 60% at 50% 40%, rgba(196,88,48,0.06), transparent 70%)" }} />

      {/* Greeting — panel de glass (frosted) flotando sobre el ambiente. */}
      <div
        className="mb-10 rounded-[var(--radius-lg)] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl px-6 py-6 md:px-8 md:py-7"
        style={{ boxShadow: "inset 0 1px 0 var(--glass-sheen), 0 20px 60px -30px rgba(0,0,0,0.6)" }}
      >
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
              className="group relative shrink-0 w-[200px] aspect-[3/4] rounded-[var(--radius-md)] overflow-hidden border border-edge hover:border-[var(--color-brand)] transition-colors cursor-pointer bg-surface-2"
            >
              {t.src ? (
                <Media src={t.src} type={t.type} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              ) : (
                <div className={cn("absolute inset-0 bg-gradient-to-br flex items-center justify-center", t.gradient)}>
                  <span className="text-[40px] font-bold text-white/70">{t.name[0]}</span>
                </div>
              )}
              {/* Gradiente oscuro para legibilidad del label sobre la imagen. */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
              {t.type === "video" && <span className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center"><Play size={11} className="fill-white" /></span>}
              <div className="absolute inset-x-0 bottom-0 p-3 text-left">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-[14px] font-semibold text-white leading-tight">{t.name}</h3>
                  <ArrowRight size={14} className="text-white/80 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="text-[11px] text-white/70 leading-snug mt-0.5">{t.tagline}</p>
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Nueva campaña */}
            <button onClick={() => navigate("/dashboard/campaigns/new")}
              className="aspect-[4/3] rounded-[var(--radius-md)] border border-dashed border-edge hover:border-[var(--color-brand)] flex flex-col items-center justify-center gap-2 text-fg-muted hover:text-fg transition-colors cursor-pointer">
              <Plus size={20} /> <span className="text-[12px] font-medium">Nueva campaña</span>
            </button>
            {campaigns.map((c) => {
              const st = STATUS_LABEL[c.status] || STATUS_LABEL.draft;
              const cover = c.pieces?.find((p) => p.url)?.url;
              return (
                <button key={c.id} onClick={() => navigate(`/dashboard/campaigns/${c.id}`)}
                  className="group relative aspect-[4/3] rounded-[var(--radius-md)] overflow-hidden border border-edge hover:border-[var(--color-brand)] transition-colors cursor-pointer bg-surface-1">
                  {cover ? (
                    <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center"><Megaphone size={22} className="text-fg-faint" /></div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3 text-left">
                    <h3 className="text-[13px] font-semibold text-white leading-tight line-clamp-2">{c.name}</h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-medium", st.cls)}>{st.label}</span>
                      <span className="text-[10px] text-white/70">{c.pieces?.length || 0} pieza{(c.pieces?.length || 0) === 1 ? "" : "s"}</span>
                    </div>
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
