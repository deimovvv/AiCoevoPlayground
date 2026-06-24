/**
 * useDictation — botón micrófono que transcribe en vivo al campo activo.
 *
 * Usa la Web Speech API del navegador (gratis, sin backend). En Chrome/Edge/Safari
 * reconoce español argentino bien. Firefox no la soporta — el botón aparece deshabilitado
 * con un hint, no rompe.
 *
 * Patrón de uso:
 *   const { listening, supported, toggle, transcript } = useDictation({ lang: "es-AR" });
 *   <textarea value={text + (listening ? transcript : "")} ... />
 *   <button onClick={() => toggle((final) => setText(t => t + final))} disabled={!supported} />
 *
 * El callback `onCommit` recibe el texto final cuando paramos de escuchar.
 * `transcript` es la transcripción interim (lo que el usuario está diciendo ahora mismo,
 * antes de que el browser la marque como "final"). Útil para mostrar feedback visual.
 */

import { useState, useRef, useCallback, useEffect } from "react";

// ── Web Speech API typings (vendor-prefixed, no están en lib.dom) ────────────

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

// ── Hook ─────────────────────────────────────────────────────────────────────

interface DictationOptions {
    /** Idioma BCP47 — default español argentino. Cambiar a "es-419" o "en-US" si querés. */
    lang?: string;
}

export function useDictation({ lang = "es-AR" }: DictationOptions = {}) {
    const [listening, setListening] = useState(false);
    const [transcript, setTranscript] = useState("");   // interim text mientras hablás
    const [error, setError] = useState<string | null>(null);

    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const finalBufferRef = useRef<string>("");
    const onCommitRef = useRef<((finalText: string) => void) | null>(null);

    const sttCtor = getSpeechRecognition();
    const supported = sttCtor !== null;

    // Stop recognition on unmount — sino el browser sigue escuchando aunque se vaya la página.
    useEffect(() => {
        return () => {
            recognitionRef.current?.abort();
            recognitionRef.current = null;
        };
    }, []);

    const start = useCallback((onCommit: (finalText: string) => void) => {
        if (!sttCtor) return;
        if (recognitionRef.current) recognitionRef.current.abort();
        onCommitRef.current = onCommit;

        const rec = new sttCtor();
        rec.lang = lang;
        rec.continuous = true;
        rec.interimResults = true;
        finalBufferRef.current = "";
        setTranscript("");
        setError(null);

        rec.onresult = (event: SpeechRecognitionEvent) => {
            let interim = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const res = event.results[i];
                const txt = res[0].transcript;
                if (res.isFinal) {
                    finalBufferRef.current += (finalBufferRef.current ? " " : "") + txt.trim();
                } else {
                    interim += txt;
                }
            }
            setTranscript(interim);
        };

        rec.onerror = (event: SpeechRecognitionErrorEvent) => {
            // "no-speech" salta si te quedás callado — no es un error real, paramos quietos.
            if (event.error !== "no-speech" && event.error !== "aborted") {
                setError(`Mic error: ${event.error}`);
            }
            setListening(false);
        };

        rec.onend = () => {
            setListening(false);
            const finalText = finalBufferRef.current.trim();
            setTranscript("");
            finalBufferRef.current = "";
            if (finalText && onCommitRef.current) onCommitRef.current(finalText);
        };

        recognitionRef.current = rec;
        try {
            rec.start();
            setListening(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo iniciar el micrófono");
            setListening(false);
        }
    }, [sttCtor, lang]);

    const stop = useCallback(() => {
        recognitionRef.current?.stop();   // dispara `onend`, que commitea el texto final
    }, []);

    /** Toggle: si está escuchando para y commitea; si no, empieza a escuchar. */
    const toggle = useCallback((onCommit: (finalText: string) => void) => {
        if (listening) stop();
        else start(onCommit);
    }, [listening, stop, start]);

    return {
        listening,
        supported,
        transcript,
        error,
        clearError: () => setError(null),
        start,
        stop,
        toggle,
    };
}
