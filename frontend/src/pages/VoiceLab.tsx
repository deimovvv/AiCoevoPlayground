/**
 * Voice Lab — experimental real-time-ish voice conversation.
 *
 * Pipeline per turn:
 *   1. Browser mic → Web Speech API (webkitSpeechRecognition) transcribes in real time.
 *   2. On stop (user clicks again OR auto-pause), we send the transcript + chat history
 *      to /api/voice/turn.
 *   3. Backend pipes through Gemini (chat_voice) for a short conversational reply,
 *      then ElevenLabs for TTS, returns { reply, audioUrl }.
 *   4. We autoplay the audio and append the assistant message to the thread.
 *
 * Constraints we accept on purpose for v0:
 *   - STT is browser-only (Chrome/Edge/Safari). Firefox = button is disabled with a hint.
 *   - No streaming TTS — we wait for the full MP3, then play. Feels like ~1-2s latency.
 *   - Conversation lives in component state only; no persistence yet.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, Loader2, Trash2, Volume2, AlertTriangle, FlaskConical } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import { voiceTurn, voiceLabAudioUrl, type VoiceTurnMessage } from "../lib/api";
import { cn } from "../lib/utils";

// ── Web Speech API typings ────────────────────────────────────
// The Web Speech API is still vendor-prefixed in most browsers (`webkitSpeechRecognition`)
// and isn't in lib.dom yet. We declare the minimum shape we touch.
interface SpeechRecognitionAlternative { transcript: string; confidence: number; }
interface SpeechRecognitionResult { 0: SpeechRecognitionAlternative; isFinal: boolean; length: number; }
interface SpeechRecognitionResultList { length: number; [index: number]: SpeechRecognitionResult; }
interface SpeechRecognitionEvent extends Event { resultIndex: number; results: SpeechRecognitionResultList; }
interface SpeechRecognitionErrorEvent extends Event { error: string; }
interface SpeechRecognitionLike {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onresult: ((e: SpeechRecognitionEvent) => void) | null;
    onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    start(): void;
    stop(): void;
    abort(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
function getSpeechRecognition(): SpeechRecognitionCtor | null {
    const w = window as unknown as {
        SpeechRecognition?: SpeechRecognitionCtor;
        webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

// ── Types ──────────────────────────────────────────────────────

interface Turn {
    id: string;
    role: "user" | "assistant";
    content: string;
    audioUrl?: string;  // assistant turns only
    pending?: boolean;  // assistant placeholder while we wait for the reply
}

// ── Page ───────────────────────────────────────────────────────

export function VoiceLab() {
    const { activeBrand } = useBrand();
    const [turns, setTurns] = useState<Turn[]>([]);
    const [listening, setListening] = useState(false);
    const [thinking, setThinking] = useState(false);
    const [interim, setInterim] = useState("");   // live partial transcript while mic is hot
    const [error, setError] = useState<string | null>(null);
    const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");

    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const finalBufferRef = useRef<string>("");    // accumulated final segments for the current utterance
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    // Mirror of `turns` so async handlers (rec.onend → sendUtterance) see the latest
    // value without re-creating the callback on every state change. setState updaters
    // are unreliable for snapshotting in React 19 strict mode (they run twice in dev).
    const turnsRef = useRef<Turn[]>([]);
    useEffect(() => { turnsRef.current = turns; }, [turns]);

    const sttCtor = getSpeechRecognition();
    const sttSupported = sttCtor !== null;

    // Brand voice presets — fall back to the server's default voice (empty id).
    const voicePresets = activeBrand?.voicePresets || [];

    // Auto-scroll the transcript to the bottom on each new turn / interim text.
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [turns, interim]);

    // Stop recognition cleanly on unmount (avoids "already started" errors on re-mount).
    useEffect(() => {
        return () => {
            recognitionRef.current?.abort();
            recognitionRef.current = null;
        };
    }, []);

    // Build the assistant reply once recognition finalizes. Wrapped in useCallback so the
    // recognition handler closure stays stable across re-renders.
    const sendUtterance = useCallback(async (utterance: string) => {
        const text = utterance.trim();
        if (!text) return;

        // Snapshot the conversation history from a ref (not setState) — strict-mode-safe
        // and synchronous. Filter out pending placeholders + empty assistant turns so
        // the backend never sees an incomplete trailing message.
        const baseTurns = turnsRef.current.filter((t) => !t.pending && t.content.trim());
        const payloadMessages: VoiceTurnMessage[] = [
            ...baseTurns.map((t) => ({ role: t.role, content: t.content })),
            { role: "user", content: text },
        ];

        // Optimistically append the user turn + a placeholder for the assistant.
        const userTurn: Turn = { id: `u-${Date.now()}`, role: "user", content: text };
        const placeholder: Turn = { id: `a-${Date.now()}`, role: "assistant", content: "", pending: true };
        setTurns((prev) => [...prev, userTurn, placeholder]);

        setThinking(true);
        setError(null);
        try {
            const result = await voiceTurn({
                brandId: activeBrand && activeBrand.id !== "__sandbox__" ? activeBrand.id : null,
                voiceId: selectedVoiceId || null,
                messages: payloadMessages,
            });
            setTurns((prev) =>
                prev.map((t) =>
                    t.id === placeholder.id ? { ...t, content: result.reply, audioUrl: result.audioUrl, pending: false } : t,
                ),
            );
            // Autoplay reply. Some browsers block autoplay without prior user gesture —
            // since the user just clicked the mic button, the gesture is fresh, so this works.
            const url = voiceLabAudioUrl(result.audioUrl);
            if (audioRef.current) {
                audioRef.current.src = url;
                audioRef.current.play().catch(() => { /* autoplay blocked — user can click play */ });
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Falló el turno de voz";
            setError(msg);
            // Drop the failed assistant placeholder; keep the user turn so they can see what they said.
            setTurns((prev) => prev.filter((t) => t.id !== placeholder.id));
        } finally {
            setThinking(false);
        }
    }, [activeBrand, selectedVoiceId]);

    const startListening = useCallback(() => {
        if (!sttCtor) return;
        if (recognitionRef.current) recognitionRef.current.abort();

        const rec = new sttCtor();
        rec.lang = "es-AR";          // primary user is rioplatense
        rec.continuous = true;        // keep listening until we explicitly stop
        rec.interimResults = true;    // stream partial results for the live transcript
        finalBufferRef.current = "";
        setInterim("");
        setError(null);

        rec.onresult = (event: SpeechRecognitionEvent) => {
            let interimChunk = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const res = event.results[i];
                const txt = res[0].transcript;
                if (res.isFinal) {
                    finalBufferRef.current += (finalBufferRef.current ? " " : "") + txt.trim();
                } else {
                    interimChunk += txt;
                }
            }
            setInterim(interimChunk);
        };

        rec.onerror = (event: SpeechRecognitionErrorEvent) => {
            // "no-speech" fires when user stays silent — not actually an error, just stop quietly.
            if (event.error !== "no-speech" && event.error !== "aborted") {
                setError(`Mic error: ${event.error}`);
            }
            setListening(false);
        };

        rec.onend = () => {
            setListening(false);
            const finalText = finalBufferRef.current.trim();
            setInterim("");
            finalBufferRef.current = "";
            if (finalText) void sendUtterance(finalText);
        };

        recognitionRef.current = rec;
        try {
            rec.start();
            setListening(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo iniciar el micrófono");
            setListening(false);
        }
    }, [sttCtor, sendUtterance]);

    const stopListening = useCallback(() => {
        recognitionRef.current?.stop();   // triggers `onend`, which fires sendUtterance
    }, []);

    const clearConversation = () => {
        setTurns([]);
        setInterim("");
        setError(null);
        if (audioRef.current) audioRef.current.pause();
    };

    const handleMicClick = () => {
        if (listening) {
            stopListening();
        } else {
            startListening();
        }
    };

    return (
        <div className="flex-1 flex flex-col bg-bg overflow-hidden">
            {/* ── Header ─────────────────────────────────────────── */}
            <div className="border-b border-edge px-6 py-3 flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[var(--color-action-subtle)] flex items-center justify-center">
                        <FlaskConical size={14} className="text-[var(--color-action)]" />
                    </div>
                    <div>
                        <h1 className="text-[14px] font-medium text-fg flex items-center gap-2">
                            Voice Lab
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--color-action-subtle)] text-[var(--color-action)]">
                                beta
                            </span>
                        </h1>
                        <p className="text-[11px] text-fg-muted">
                            Hablale a Gemini, te responde con la voz que elijas — en vivo.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Voice picker — brand presets + a "default" option that lets the backend choose. */}
                    <select
                        value={selectedVoiceId}
                        onChange={(e) => setSelectedVoiceId(e.target.value)}
                        className="bg-surface-1 border border-edge rounded-[var(--radius-sm)] text-[12px] text-fg px-2.5 py-1.5 outline-none focus:border-[var(--color-edge-focus)] cursor-pointer"
                        title="Voz de ElevenLabs"
                    >
                        <option value="">Voz por defecto</option>
                        {voicePresets.map((v) => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                    </select>

                    <button
                        onClick={clearConversation}
                        disabled={turns.length === 0}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-fg-muted hover:text-fg bg-surface-1 hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed rounded-[var(--radius-sm)] transition-colors cursor-pointer"
                    >
                        <Trash2 size={12} /> Limpiar
                    </button>
                </div>
            </div>

            {/* ── Conversation ──────────────────────────────────── */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
                <div className="max-w-2xl mx-auto space-y-4">
                    {turns.length === 0 && !listening && (
                        <div className="text-center py-16 space-y-3">
                            <div className="w-14 h-14 mx-auto rounded-full bg-surface-1 flex items-center justify-center">
                                <Mic size={20} className="text-fg-muted" />
                            </div>
                            <h2 className="text-[14px] font-medium text-fg">Tocá el micrófono para empezar</h2>
                            <p className="text-[12px] text-fg-faint max-w-sm mx-auto">
                                Hablás, Gemini te responde en una o dos frases con la voz seleccionada. Pensalo como una
                                versión de voz del Copiloto — buena para hacer brainstorming en voz alta o para chequear el tono.
                            </p>
                            {activeBrand && activeBrand.id !== "__sandbox__" && (
                                <p className="text-[11px] text-fg-faint">
                                    Contexto activo: <span className="text-fg-secondary">{activeBrand.name}</span>
                                </p>
                            )}
                        </div>
                    )}

                    {turns.map((t) => (
                        <TurnBubble key={t.id} turn={t} />
                    ))}

                    {/* Live interim transcript bubble — appears while the mic is hot. */}
                    {listening && interim && (
                        <div className="flex justify-end">
                            <div className="max-w-[80%] bg-[var(--color-action-subtle)] text-fg-secondary px-3 py-2 rounded-[var(--radius-md)] text-[13px] italic opacity-70">
                                {interim}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Errors ─────────────────────────────────────────── */}
            {error && (
                <div className="mx-6 mb-2 px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--color-error)] bg-[var(--color-error-subtle,rgba(255,107,107,0.08))] flex items-start gap-2 text-[12px] text-[var(--color-error)]">
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto text-fg-faint hover:text-fg cursor-pointer">×</button>
                </div>
            )}

            {/* ── Mic bar (bottom) ───────────────────────────────── */}
            <div className="border-t border-edge bg-surface-0 px-6 py-4 shrink-0">
                <div className="max-w-2xl mx-auto flex items-center justify-center gap-3">
                    <button
                        onClick={handleMicClick}
                        disabled={!sttSupported || thinking}
                        className={cn(
                            "relative w-14 h-14 rounded-full flex items-center justify-center transition-all cursor-pointer",
                            "disabled:opacity-40 disabled:cursor-not-allowed",
                            listening
                                ? "bg-[var(--color-error,#ff4d4d)] text-white shadow-lg shadow-red-500/30"
                                : "bg-[var(--color-action)] text-[var(--color-action-fg)] hover:opacity-90",
                        )}
                        title={listening ? "Soltar para enviar" : "Tocá para hablar"}
                    >
                        {thinking ? (
                            <Loader2 size={20} className="animate-spin" />
                        ) : listening ? (
                            <MicOff size={20} />
                        ) : (
                            <Mic size={20} />
                        )}
                        {/* Pulsing ring while listening — pure CSS, no JS animation needed. */}
                        {listening && (
                            <span className="absolute inset-0 rounded-full border-2 border-[var(--color-error,#ff4d4d)] animate-ping" />
                        )}
                    </button>

                    <div className="text-[12px] text-fg-muted min-w-[140px]">
                        {!sttSupported ? (
                            <span className="text-[var(--color-error)]">
                                Tu navegador no soporta reconocimiento de voz. Probá con Chrome o Safari.
                            </span>
                        ) : thinking ? (
                            "Gemini está pensando…"
                        ) : listening ? (
                            "Escuchando — tocá de nuevo para enviar"
                        ) : (
                            "Tocá el micrófono para hablar"
                        )}
                    </div>
                </div>
            </div>

            {/* Hidden audio element — controlled by ref so we can autoplay assistant replies. */}
            <audio ref={audioRef} className="hidden" />
        </div>
    );
}

// ── Subcomponents ──────────────────────────────────────────────

function TurnBubble({ turn }: { turn: Turn }) {
    const isUser = turn.role === "user";
    const audioFullUrl = turn.audioUrl ? voiceLabAudioUrl(turn.audioUrl) : null;

    return (
        <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
            <div
                className={cn(
                    "max-w-[80%] px-3 py-2 rounded-[var(--radius-md)] text-[13px] leading-relaxed",
                    isUser
                        ? "bg-[var(--color-action-subtle)] text-fg"
                        : "bg-surface-1 border border-edge text-fg-secondary",
                )}
            >
                {turn.pending ? (
                    <div className="flex items-center gap-1.5 text-fg-faint">
                        <Loader2 size={11} className="animate-spin" />
                        <span className="text-[12px]">Generando respuesta…</span>
                    </div>
                ) : (
                    <>
                        <p className="whitespace-pre-wrap">{turn.content}</p>
                        {audioFullUrl && (
                            <div className="mt-2 flex items-center gap-2">
                                {/* Native player so the user can replay / scrub. Autoplay is handled
                                    separately via the hidden <audio> on the page — this control is just
                                    for re-listening. */}
                                <Volume2 size={12} className="text-fg-faint shrink-0" />
                                <audio controls src={audioFullUrl} className="h-6 max-w-full" />
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
