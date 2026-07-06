import { useNavigate } from "react-router";
import { ArrowRight, Sparkles, Play } from "lucide-react";

/**
 * Home — landing / showcase.
 * ──────────────────────────
 * Look comercial: muro de OUTPUTS reales (no texto). Para sumar/cambiar piezas,
 * dropeá el archivo en `public/previews/` y editá SHOWCASE / TOOL_CARDS abajo.
 * Los `.mp4` autoplay muteados en loop; las imágenes van estáticas. `badge` es opcional.
 */

const HERO_MEDIA = { src: "/previews/agnatesttt.mp4", type: "video" as const };

// Grilla de piezas destacadas — mezclá vertical/horizontal. Editá acá para sumar más.
const SHOWCASE: Array<{ src: string; type: "video" | "image"; label: string; span?: string }> = [
  { src: "/previews/eccomerce.png", type: "image", label: "Ecommerce Pack" },
  { src: "/previews/ugccreator.mp4", type: "video", label: "UGC Creator" },
  { src: "/previews/videoadcreator.mp4", type: "video", label: "Video Ad" },
  { src: "/previews/staticad.png", type: "image", label: "Static Ad" },
  { src: "/previews/avatar.png", type: "image", label: "Avatar Sheet" },
];

// Tool cards con preview + tagline + badge opcional. Placeholder-friendly: si no hay
// media todavía, se cae a un gradiente con la inicial.
const TOOL_CARDS: Array<{ id: string; name: string; tagline: string; src?: string; type?: "video" | "image"; badge?: string; gradient: string }> = [
  { id: "fashion_reel", name: "Fashion Reel", tagline: "Reels editoriales de moda sin guion", src: "/previews/agnatesttt.mp4", type: "video", badge: "Nuevo", gradient: "from-fuchsia-500/30 to-orange-500/25" },
  { id: "ecommerce_pack", name: "Ecommerce Pack", tagline: "Prenda sobre modelo + vistas, en estudio", src: "/previews/eccomerce.png", type: "image", badge: "Popular", gradient: "from-amber-500/25 to-rose-500/20" },
  { id: "ugc_creator", name: "UGC Creator", tagline: "Avatars hablando a cámara, listos para publicar", src: "/previews/ugccreator.mp4", type: "video", gradient: "from-violet-500/30 to-pink-500/20" },
  { id: "video_ad_creator", name: "Video Ad Creator", tagline: "Video ads con storyboard generado por IA", src: "/previews/videoadcreator.mp4", type: "video", gradient: "from-sky-500/25 to-indigo-500/25" },
  { id: "content_analyzer", name: "Content Analyzer", tagline: "Analizá un video y adaptalo a tu marca", badge: "Nuevo", gradient: "from-emerald-500/25 to-teal-500/20" },
  { id: "static_ad", name: "Static Ad", tagline: "40 templates de creativos estáticos", src: "/previews/staticad.png", type: "image", gradient: "from-orange-500/25 to-red-500/20" },
];

function Media({ src, type, className }: { src?: string; type?: "video" | "image"; className?: string }) {
  if (!src) return null;
  if (type === "video") {
    return <video src={src} className={className} autoPlay muted loop playsInline preload="metadata" />;
  }
  return <img src={src} alt="" className={className} loading="lazy" />;
}

export function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-fg overflow-x-hidden">
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-70"
        style={{ background: "radial-gradient(60% 45% at 50% 0%, rgba(196,88,48,0.18), transparent 70%), radial-gradient(40% 30% at 85% 20%, rgba(120,90,255,0.12), transparent 70%)" }}
      />

      {/* Nav */}
      <nav className="sticky top-0 z-30 flex items-center justify-between px-6 md:px-10 h-16 border-b border-edge/60 backdrop-blur-md bg-[var(--color-canvas)]/70">
        <div className="flex items-center gap-2.5">
          <img src="/ISO-COEVO-BLANCO.png" alt="Coevo" className="h-6 w-auto" />
          <span className="text-[14px] font-semibold tracking-tight">Coevo Studio</span>
        </div>
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-1.5 px-4 h-9 rounded-full bg-[var(--color-action)] text-[var(--color-action-fg)] text-[13px] font-semibold hover:opacity-90 transition-opacity cursor-pointer"
        >
          Abrir Dashboard <ArrowRight size={14} />
        </button>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 md:px-10 pt-16 md:pt-24 pb-12 grid md:grid-cols-[1.1fr_0.9fr] gap-10 md:gap-14 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-edge bg-surface-1/60 text-[11px] font-medium text-fg-muted mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] animate-pulse" />
            AI CONTENT FACTORY
          </div>
          <h1 className="font-display text-[44px] md:text-[68px] leading-[1.0] font-semibold tracking-[-0.01em]">
            Del brief al video
            <br />
            <span className="text-[var(--color-brand)] italic">listo para publicar</span>
          </h1>
          <p className="mt-6 text-[15px] md:text-[17px] text-fg-muted leading-relaxed max-w-lg">
            La IA escribe el guion, genera las imágenes, clona la voz y renderiza el corte final.
            Multi-marca, multi-tool, en minutos.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2 px-6 h-12 rounded-full bg-[var(--color-brand)] text-[var(--color-brand-fg)] text-[14px] font-semibold hover:opacity-90 transition-opacity cursor-pointer shadow-[0_8px_30px_-8px_var(--color-brand)]"
            >
              Empezar a crear <ArrowRight size={16} />
            </button>
            <button
              onClick={() => navigate("/dashboard/generate")}
              className="flex items-center gap-2 px-6 h-12 rounded-full border border-edge bg-surface-1/50 text-[14px] font-semibold text-fg hover:border-[var(--color-brand)] transition-colors cursor-pointer"
            >
              Explorar tools <Sparkles size={14} />
            </button>
          </div>
        </div>

        {/* Hero media — pieza real destacada (9:16) */}
        <div className="relative mx-auto w-full max-w-[300px]">
          <div className="absolute -inset-4 rounded-[32px] bg-[var(--color-brand)]/20 blur-3xl -z-10" />
          <div className="relative aspect-[9/16] rounded-[24px] overflow-hidden border border-edge shadow-2xl bg-surface-1">
            <Media src={HERO_MEDIA.src} type={HERO_MEDIA.type} className="w-full h-full object-cover" />
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-[10px] font-medium">
              <Play size={10} className="fill-white" /> Fashion Reel
            </div>
          </div>
        </div>
      </section>

      {/* Showcase — muro de outputs reales */}
      <section className="max-w-6xl mx-auto px-6 md:px-10 py-10">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="font-display text-[22px] md:text-[28px] font-semibold tracking-tight">Hecho con Coevo</h2>
          <span className="text-[12px] text-fg-faint">Piezas reales generadas por la plataforma</span>
        </div>
        <div className="columns-2 md:columns-3 gap-3 [column-fill:_balance]">
          {SHOWCASE.map((item) => (
            <div key={item.src} className="group relative mb-3 break-inside-avoid rounded-[16px] overflow-hidden border border-edge bg-surface-1">
              <Media src={item.src} type={item.type} className="w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="absolute bottom-2.5 left-2.5 text-white text-[11px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Tools */}
      <section className="max-w-6xl mx-auto px-6 md:px-10 py-12">
        <h2 className="font-display text-[22px] md:text-[28px] font-semibold tracking-tight mb-5">Las tools</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TOOL_CARDS.map((t) => (
            <button
              key={t.id}
              onClick={() => navigate("/dashboard/generate")}
              className="group text-left rounded-[18px] border border-edge bg-surface-0 overflow-hidden hover:border-[var(--color-brand)] transition-colors cursor-pointer"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-surface-2">
                {t.src ? (
                  <Media src={t.src} type={t.type} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${t.gradient} flex items-center justify-center`}>
                    <span className="text-[40px] font-bold text-white/70">{t.name[0]}</span>
                  </div>
                )}
                {t.badge && (
                  <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-[var(--color-brand)] text-[var(--color-brand-fg)] text-[9px] font-bold uppercase tracking-wide">{t.badge}</span>
                )}
              </div>
              <div className="p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[14px] font-semibold">{t.name}</h3>
                  <ArrowRight size={14} className="text-fg-faint group-hover:text-[var(--color-brand)] group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-[12px] text-fg-muted leading-snug mt-1">{t.tagline}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="max-w-6xl mx-auto px-6 md:px-10 py-16">
        <div className="relative rounded-[28px] border border-edge overflow-hidden p-10 md:p-16 text-center bg-surface-1">
          <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: "radial-gradient(50% 60% at 50% 0%, rgba(196,88,48,0.22), transparent 70%)" }} />
          <h2 className="font-display relative text-[28px] md:text-[42px] font-semibold tracking-tight">Tu próxima campaña, en minutos</h2>
          <p className="relative mt-3 text-[15px] text-fg-muted max-w-md mx-auto">Elegí una marca, elegí una tool, y dejá que la IA haga el resto.</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="relative mt-7 inline-flex items-center gap-2 px-7 h-12 rounded-full bg-[var(--color-brand)] text-[var(--color-brand-fg)] text-[14px] font-semibold hover:opacity-90 transition-opacity cursor-pointer"
          >
            Abrir Dashboard <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-edge/60 py-8 px-6 md:px-10 flex items-center justify-center gap-2 text-[12px] text-fg-faint">
        <span>Coevo Studio</span>
        <span>·</span>
        <span>AI Content Platform</span>
      </footer>
    </div>
  );
}
