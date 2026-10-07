import { useRef, useState } from "react";
import { Loader2, Music2, Upload, Sparkles, Trash2, AudioWaveform } from "lucide-react";
import { cn } from "../../lib/utils";
import { MUSIC_DEFAULTS, MUSIC_GEN_COST, MUSIC_MOODS, type MusicTrack } from "./musicModel";

/**
 * Panel lateral de la pista de música del editor (se abre al costado, como el de texto).
 * Sin música: subir un tema o generarlo con IA (Lyria, con el costo a la vista).
 * Con música: volumen, desde qué segundo arranca el tema, fade al final y ajustar los
 * cortes al ritmo.
 */
export function MusicPanel({ music, onChange, onUpload, onGenerate, onSnap, beatsLoading, onClose }: {
    music: MusicTrack | null;
    onChange: (m: MusicTrack | null) => void;
    onUpload?: (file: File) => Promise<{ url: string; name: string }>;
    onGenerate?: (mood: string) => Promise<{ url: string; name: string }>;
    /** Ajusta los cortes de los clips al ritmo. Devuelve cuántos cortes se movieron. */
    onSnap?: () => number;
    beatsLoading?: boolean;
    onClose: () => void;
}) {
    const fileRef = useRef<HTMLInputElement | null>(null);
    const [busy, setBusy] = useState<null | "upload" | "generate">(null);
    const [error, setError] = useState<string | null>(null);
    const [mood, setMood] = useState(MUSIC_MOODS[0][0]);
    const [snapMsg, setSnapMsg] = useState<string | null>(null);

    const take = async (kind: "upload" | "generate", job: () => Promise<{ url: string; name: string }>) => {
        setBusy(kind); setError(null); setSnapMsg(null);
        try {
            const r = await job();
            onChange({ url: r.url, name: r.name, ...MUSIC_DEFAULTS });
        } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo cargar la música");
        } finally { setBusy(null); }
    };

    return (
        <aside className="w-[264px] shrink-0 flex flex-col gap-4 self-stretch border-l border-edge pl-5">
            <div className="flex items-center gap-1.5">
                <Music2 size={12} className="text-fg-muted" />
                <span className="text-[12px] font-medium text-fg">Música</span>
                <span className="flex-1" />
                <button onClick={onClose} className="text-[11px] text-fg-muted hover:text-fg cursor-pointer">Listo</button>
            </div>
            <p className="text-[11px] text-fg-faint leading-snug">
                Va de punta a punta del video y se ajusta a su largo en cada export. Si hay voz, baja sola debajo.
            </p>

            {/* Elegir el tema: siempre visible, también para cambiarlo */}
            <div className="space-y-2">
                <input ref={fileRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f && onUpload) take("upload", () => onUpload(f)); }} />
                {onUpload && (
                    <button onClick={() => fileRef.current?.click()} disabled={!!busy}
                        className="w-full flex items-center gap-2 h-8 px-2.5 rounded-[var(--radius-sm)] border border-edge text-[11px] text-fg-muted hover:text-fg hover:border-edge-strong cursor-pointer disabled:opacity-40">
                        {busy === "upload" ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                        {music ? "Cambiar por un tema propio" : "Subir un tema"}
                    </button>
                )}
                {onGenerate && (
                    <div className="space-y-1.5">
                        <span className="text-[10px] text-fg-faint">o generarla con IA (Lyria, instrumental)</span>
                        <div className="flex flex-wrap gap-1">
                            {MUSIC_MOODS.map(([id, label]) => (
                                <button key={id} onClick={() => setMood(id)}
                                    className={cn("h-6 px-2 rounded-[var(--radius-xs)] text-[11px] border cursor-pointer",
                                        mood === id ? "border-fg/60 text-fg bg-surface-2" : "border-edge text-fg-muted hover:text-fg")}>
                                    {label}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => take("generate", () => onGenerate(mood))} disabled={!!busy}
                            className="flex items-center gap-1.5 h-7 text-[11px] text-fg hover:opacity-70 cursor-pointer disabled:opacity-40">
                            {busy === "generate" ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                            {busy === "generate" ? "Generando… (~1 min)" : `Generar · $${MUSIC_GEN_COST.toFixed(2)}`}
                        </button>
                    </div>
                )}
                {error && <p className="text-[10px] text-[var(--color-error)] leading-snug">{error}</p>}
            </div>

            {music && (
                <div className="space-y-3 border-t border-edge pt-3">
                    <p className="text-[12px] text-fg truncate" title={music.name}>{music.name}</p>
                    <label className="block space-y-1">
                        <span className="flex justify-between text-[10px] text-fg-faint">
                            Volumen <span className="tabular-nums">{Math.round(music.volume * 100)}%</span>
                        </span>
                        <input type="range" min={0} max={1} step={0.05} value={music.volume}
                            onChange={(e) => onChange({ ...music, volume: Number(e.target.value) })}
                            className="w-full accent-[var(--color-fg)]" />
                    </label>
                    <label className="flex items-center justify-between gap-2 text-[10px] text-fg-faint">
                        Empieza en el segundo del tema
                        <input type="number" min={0} step={0.5} value={music.start}
                            onChange={(e) => onChange({ ...music, start: Math.max(0, Number(e.target.value) || 0), beats: undefined, bpm: undefined })}
                            className="w-16 h-6 bg-surface-1 border border-edge rounded-[var(--radius-xs)] px-1.5 text-[11px] text-fg tabular-nums outline-none" />
                    </label>
                    <div className="space-y-1">
                        <span className="text-[10px] text-fg-faint">Fade al final</span>
                        <div className="flex gap-1">
                            {[0, 1, 1.5, 2, 3].map((s) => (
                                <button key={s} onClick={() => onChange({ ...music, fadeOut: s })}
                                    className={cn("h-6 px-2 rounded-[var(--radius-xs)] text-[11px] border cursor-pointer tabular-nums",
                                        music.fadeOut === s ? "border-fg/60 text-fg bg-surface-2" : "border-edge text-fg-muted hover:text-fg")}>
                                    {s === 0 ? "No" : `${s} s`}
                                </button>
                            ))}
                        </div>
                    </div>
                    {onSnap && (
                        <div className="space-y-1">
                            <button onClick={() => { const n = onSnap(); setSnapMsg(n ? `Se movieron ${n} ${n === 1 ? "corte" : "cortes"} al golpe anterior.` : "Los cortes ya caen en el ritmo (o moverlos dejaría clips muy cortos)."); }}
                                disabled={beatsLoading || !music.beats?.length}
                                className="flex items-center gap-1.5 h-7 text-[11px] text-fg hover:opacity-70 cursor-pointer disabled:opacity-40">
                                {beatsLoading ? <Loader2 size={11} className="animate-spin" /> : <AudioWaveform size={11} />}
                                {beatsLoading ? "Leyendo el ritmo…" : `Ajustar los cortes al ritmo${music.bpm ? ` · ${Math.round(music.bpm)} BPM` : ""}`}
                            </button>
                            <p className="text-[10px] text-fg-faint leading-snug">
                                {snapMsg || "Cada corte entre clips pasa al golpe anterior más cercano (sólo acorta)."}
                            </p>
                        </div>
                    )}
                    <button onClick={() => onChange(null)}
                        className="flex items-center gap-1.5 text-[11px] text-fg-faint hover:text-fg cursor-pointer">
                        <Trash2 size={11} /> Quitar la música
                    </button>
                </div>
            )}
        </aside>
    );
}
