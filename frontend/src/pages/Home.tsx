import { useNavigate } from "react-router";
import { ArrowRight, Sparkles, Mic, Video, Brain, Layers } from "lucide-react";

export function Home() {
    const navigate = useNavigate();

    return (
        <div className="home-root">
            {/* ── Ambient glow ── */}
            <div className="home-glow" />

            {/* ── Nav ── */}
            <nav className="home-nav">
                <div className="home-nav-brand">
                    <div className="home-nav-icon">◆</div>
                    <span>Coevo Studio</span>
                </div>
                <button onClick={() => navigate("/dashboard")} className="home-nav-cta">
                    Abrir Dashboard <ArrowRight size={14} />
                </button>
            </nav>

            {/* ── Hero ── */}
            <section className="home-hero">
                <div className="home-badge">
                    <span className="home-badge-dot" />
                    COEVO STUDIO
                </div>

                <h1 className="home-title">
                    <span className="home-title-light">AI-Powered</span>
                    <br />
                    <span className="home-title-bold">Content Factory</span>
                    <br />
                    <span className="home-title-serif">for brands & agencies</span>
                </h1>

                <p className="home-subtitle">
                    Del brief al video UGC listo para publicar en minutos.
                    <br />
                    La IA escribe el guión, genera las imágenes, clona la voz y renderiza el corte final.
                </p>

                <div className="home-cta-row">
                    <button onClick={() => navigate("/dashboard")} className="home-btn-primary">
                        Empezar a crear <ArrowRight size={15} />
                    </button>
                    <button onClick={() => navigate("/dashboard/generate")} className="home-btn-outline">
                        Explorar tools
                        <Sparkles size={13} />
                    </button>
                </div>
            </section>

            {/* ── Features strip ── */}
            <section className="home-features">
                {[
                    { icon: <Brain size={20} />, title: "Brand Context", desc: "Cada tool se adapta a tu marca" },
                    { icon: <Mic size={20} />, title: "Voice Cloning", desc: "ElevenLabs TTS con tu voz" },
                    { icon: <Video size={20} />, title: "Avatar Videos", desc: "Lip-sync desde una foto" },
                    { icon: <Layers size={20} />, title: "Multi-Tool", desc: "UGC, editorial, reels, ads" },
                ].map((f) => (
                    <div key={f.title} className="home-feature-card">
                        <div className="home-feature-icon">{f.icon}</div>
                        <h3>{f.title}</h3>
                        <p>{f.desc}</p>
                    </div>
                ))}
            </section>

            {/* ── Footer ── */}
            <footer className="home-footer">
                <span>Coevo Studio</span>
                <span className="home-footer-dot">·</span>
                <span>AI Content Platform</span>
            </footer>
        </div>
    );
}
