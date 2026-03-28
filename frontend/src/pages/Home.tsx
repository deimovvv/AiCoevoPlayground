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
                    <span>Morph</span>
                </div>
                <button onClick={() => navigate("/dashboard")} className="home-nav-cta">
                    Open Dashboard <ArrowRight size={14} />
                </button>
            </nav>

            {/* ── Hero ── */}
            <section className="home-hero">
                <div className="home-badge">
                    <span className="home-badge-dot" />
                    MORPH · AI Pipeline
                </div>

                <h1 className="home-title">
                    <span className="home-title-light">Multi-Agent</span>
                    <br />
                    <span className="home-title-bold">Creative Pipeline</span>
                    <br />
                    <span className="home-title-serif">for AI Avatars</span>
                </h1>

                <p className="home-subtitle">
                    From brand brief to lip-synced avatar video in minutes.
                    <br />
                    AI writes the script, clones the voice, and renders the final cut.
                </p>

                <div className="home-cta-row">
                    <button onClick={() => navigate("/dashboard")} className="home-btn-primary">
                        Start Creating <ArrowRight size={15} />
                    </button>
                    <button className="home-btn-outline">
                        Watch Demo
                        <Sparkles size={13} />
                    </button>
                </div>
            </section>

            {/* ── Features strip ── */}
            <section className="home-features">
                {[
                    { icon: <Brain size={20} />, title: "Brand DNA", desc: "Internal AI prompt per brand" },
                    { icon: <Mic size={20} />, title: "Voice Clone", desc: "ElevenLabs TTS integration" },
                    { icon: <Video size={20} />, title: "Lip Sync", desc: "HeyGen talking photo avatars" },
                    { icon: <Layers size={20} />, title: "Multi-Segment", desc: "Split & stitch pipeline" },
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
                <span>Morph</span>
                <span className="home-footer-dot">·</span>
                <span>AI Creative Suite</span>
            </footer>
        </div>
    );
}
