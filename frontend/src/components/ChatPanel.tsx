import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Bot, User, AlertCircle, Plus, MessageSquare, Trash2, Clock, ImageIcon, Package, Mic, Wand2, ChevronDown, ChevronLeft, ChevronRight, Mountain, Shirt, Check, X, Paperclip } from "lucide-react";
import { useNavigate } from "react-router";
import { useBrand } from "../lib/BrandContext";
import { sendChatMessage, resolveAgentBrief, transcribeAudio, chatScripts, chatPrompts } from "../lib/api";
import type { ChatMessage, ChatScriptScene, ChatPromptCandidate, ChatImage } from "../lib/api";
import { cn } from "../lib/utils";
import { ConfigPreviewCard } from "./ConfigPreviewCard";

// ── Chat History Types ──────────────────────────────────────

interface ChatSession {
  id: string;
  brandId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "coevo-chat-history";

interface ChatSelections {
  avatarIds: string[];
  productIds: string[];
  clothingIds: string[];
  backgroundIds: string[];
  voiceId: string | null;
}

// ── Quick starters ──────────────────────────────────────────

const QUICK_STARTERS: { emoji: string; label: string; hint: string; prompt: string }[] = [
  {
    emoji: "💡",
    label: "Ideá 5 hooks para TikTok",
    hint: "Ganchos de 3 segundos para parar el scroll",
    prompt: "Ideá 5 hooks de 3 segundos para TikTok de {brand}. Que sean provocadores, visuales, y que inviten a seguir mirando. Especificá el tipo de gancho (pregunta, shock, curiosidad, before/after, reveal).",
  },
  {
    emoji: "📝",
    label: "Brief para UGC",
    hint: "Script + dirección para un video UGC",
    prompt: "Armá un brief para un video UGC de {brand}: objetivo, tono, estructura de 4 escenas (hook, problema, solución, CTA), y un script base que después puedo ajustar.",
  },
  {
    emoji: "🎯",
    label: "Analizá la marca",
    hint: "Diagnóstico estratégico breve",
    prompt: "En 5 bullets: ¿cuál es el diferencial real de {brand} vs sus competidores? ¿Qué posicionamiento explota mejor? ¿Qué oportunidades de contenido veo que no están usando?",
  },
  {
    emoji: "✍️",
    label: "Copy para Instagram",
    hint: "Caption + CTA para feed",
    prompt: "Escribí 3 variantes de copy para un post de Instagram de {brand}: una emocional, una directa, una con humor. Incluí hashtags y CTA para cada una.",
  },
  {
    emoji: "🎬",
    label: "Plan de 1 semana",
    hint: "Calendario editorial por plataforma",
    prompt: "Armá un plan de contenido de 1 semana para {brand} en IG + TikTok. 7 días, 1-2 piezas por día, mix de formatos (reel, carrusel, story, UGC). Indicá objetivo de cada pieza.",
  },
  {
    emoji: "🔍",
    label: "Competidores a mirar",
    hint: "Benchmarks y referencias",
    prompt: "Listá 5 marcas a las que {brand} debería mirar de cerca (directos + indirectos + aspiracionales). Por cada una: qué hace bien, qué aplicar, qué evitar.",
  },
];


function loadHistory(): ChatSession[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(sessions: ChatSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── Main Component ──────────────────────────────────────────

export function ChatPanel({ compact = false }: { compact?: boolean }) {
  const { activeBrand } = useBrand();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ChatSession[]>(loadHistory);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Voice dictation (mic → record → Gemini transcription → fills the input)
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Attachments — images dropped/uploaded into the chat. They get classified by Gemini Vision
  // and routed to the right slot when the user creates a tool from this conversation.
  const [attachments, setAttachments] = useState<Array<{ file: File; dataUrl: string; classification?: { type: string; suggested_slot: string; description: string } }>>([]);

  // Multi-turn config refinement — the last resolved (tool + config) from the agent.
  // Persists across messages so the user can iterate: "hacé X" → preview → "cambiá Y" → preview updated.
  // Reset when the user switches brand or session.
  const [resolvedPreview, setResolvedPreview] = useState<{
    tool: string;
    config: Record<string, unknown>;
    reasoning?: string;
    warnings?: string[];
  } | null>(null);

  // @ mention popover state — autocompletes brand assets when user types @
  const [mention, setMention] = useState<{ open: boolean; query: string; activeIdx: number }>({
    open: false, query: "", activeIdx: 0,
  });

  const addAttachments = useCallback(async (files: File[]) => {
    const imgFiles = files.filter((f) => f.type.startsWith("image/"));
    if (imgFiles.length === 0) return;
    const newAttachments = await Promise.all(imgFiles.map(async (file) => {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      return { file, dataUrl };
    }));
    setAttachments((p) => [...p, ...newAttachments].slice(0, 6));
    // Classify each in the background so the agent can use the slot info
    for (const att of newAttachments) {
      try {
        const { classifyReferenceImage } = await import("../lib/api");
        const classification = await classifyReferenceImage(att.file);
        setAttachments((p) => p.map((a) => a.dataUrl === att.dataUrl ? { ...a, classification } : a));
      } catch {
        /* silent — classification is enhancement, not required */
      }
    }
  }, []);

  const removeAttachment = (idx: number) => setAttachments((p) => p.filter((_, i) => i !== idx));

  // Asset selections (persistent in the session — passed to agent on handoff)
  const [selections, setSelections] = useState<ChatSelections>({
    avatarIds: [],
    productIds: [],
    clothingIds: [],
    backgroundIds: [],
    voiceId: null,
  });

  // Reset selections when switching brand
  useEffect(() => {
    setSelections({ avatarIds: [], productIds: [], clothingIds: [], backgroundIds: [], voiceId: null });
  }, [activeBrand?.id]);

  // Get brand-filtered sessions
  const brandSessions = sessions
    .filter((s) => s.brandId === activeBrand?.id)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;
  const messages = activeSession?.messages || [];

  // Reset when brand changes
  useEffect(() => {
    setActiveSessionId(null);
    setError(null);
  }, [activeBrand?.id]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading]);

  // Focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, [activeSessionId]);

  // Persist history
  useEffect(() => {
    saveHistory(sessions);
  }, [sessions]);

  const createSession = useCallback(() => {
    if (!activeBrand) return;
    const session: ChatSession = {
      id: generateId(),
      brandId: activeBrand.id,
      title: "Nuevo chat",
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
    setError(null);
  }, [activeBrand]);

  const deleteSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSessionId === id) setActiveSessionId(null);
  };

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text || loading || !activeBrand) return;

    // Auto-create session if none active
    let sessionId = activeSessionId;
    if (!sessionId) {
      const session: ChatSession = {
        id: generateId(),
        brandId: activeBrand.id,
        title: text.slice(0, 50),
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setSessions((prev) => [session, ...prev]);
      sessionId = session.id;
      setActiveSessionId(session.id);
    }

    setError(null);
    // Attachments (Files w/ data URLs) carried into the user message as Gemini Vision input.
    const userImages: ChatImage[] = attachments.map((a) => ({ data: a.dataUrl, mime: a.file.type || "image/jpeg" }));
    const userMessage: ChatMessage = userImages.length
      ? { role: "user", content: text, images: userImages }
      : { role: "user", content: text };

    // Update session with user message
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        const updated = [...s.messages, userMessage];
        return {
          ...s,
          messages: updated,
          title: s.messages.length === 0 ? text.slice(0, 50) : s.title,
          updatedAt: new Date().toISOString(),
        };
      })
    );

    setInput("");
    setLoading(true);

    try {
      // Detect Instagram post URLs in the message — if present, run the replication flow
      // instead of the regular chat reply.
      const igMatch = text.match(/https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel)\/[^\s/?]+/i);

      if (igMatch) {
        const igUrl = igMatch[0];
        const { replicateInstagramCarousel } = await import("../lib/api");
        try {
          const result = await replicateInstagramCarousel(igUrl, activeBrand.id);
          setSessions((prev) =>
            prev.map((s) => {
              if (s.id !== sessionId) return s;
              return {
                ...s,
                messages: [...s.messages, {
                  role: "assistant",
                  content: `Analicé el carrusel de @${result.sourceUsername} (${result.numSlides} slides). Te armé un brief para replicar la narrativa adaptado a ${activeBrand.name}.`,
                  meta: { kind: "ig_replicate", result },
                }],
                updatedAt: new Date().toISOString(),
              };
            })
          );
          return;
        } catch (e) {
          // Fall through to regular chat if replication fails
          console.warn("[chat] IG replication failed, falling back to normal chat:", e);
        }
      }

      const currentSession = sessions.find((s) => s.id === sessionId);
      const allMessages = [...(currentSession?.messages || []), userMessage];

      // Scriptwriter intent: explicit script request, OR a follow-up while already in a
      // scripting thread (last assistant message was a script → "más corto" etc. iterate it).
      const lower = text.toLowerCase();
      const lastAssistantKind = [...(currentSession?.messages || [])].reverse()
        .find((m) => m.role === "assistant")?.meta?.kind;
      const lastAssistantScript = lastAssistantKind === "script";
      const lastAssistantPrompts = lastAssistantKind === "prompts";

      // Prompt brainstorm intent: explicit "armame/dame/sugerime prompts" OR refinement on a
      // prompts thread ("más oscuro", "otro vibe"). Drives the Copiloto-in-Lab panel cards.
      const promptVerb = /\b(arm[aá]me|sugerime|sugier|dame|gener[aá]|necesito|quiero|hace?me|haceme|opciones|alternativas|ideas)\b/.test(lower);
      const promptNoun = /\bpro?mpt(s|eo)?\b/i.test(text);
      const wantsPrompts = (promptVerb && promptNoun) || lastAssistantPrompts;

      const wantsScript = !wantsPrompts && (
        /\b(gui[oó]n|guion|script|guiones)\b/.test(lower) ||
        (/\b(ugc|reel|video|tiktok|tik tok)\b/.test(lower) && /\b(escrib|tirame|tira|dame|generame|gener|armame|arma|hac[eé]|idea|ideas|gancho|hook)\b/.test(lower)) ||
        lastAssistantScript
      );

      if (wantsPrompts) {
        const { reply, prompts } = await chatPrompts(activeBrand.id, allMessages);
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== sessionId) return s;
            // Snapshot the user's attached images on the assistant message so the bubble's
            // "incluir imágenes como refs" checkbox can carry them over to the Lab.
            const snapshot = userImages.length ? { userImages } : {};
            return {
              ...s,
              messages: [...s.messages, { role: "assistant", content: reply, meta: { kind: "prompts", prompts, ...snapshot } }],
              updatedAt: new Date().toISOString(),
            };
          })
        );
        return;
      }

      if (wantsScript) {
        const { reply, scenes } = await chatScripts(activeBrand.id, allMessages);
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== sessionId) return s;
            return {
              ...s,
              messages: [...s.messages, { role: "assistant", content: reply, meta: { kind: "script", scenes } }],
              updatedAt: new Date().toISOString(),
            };
          })
        );
        return;
      }

      const reply = await sendChatMessage(activeBrand.id, allMessages);

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s;
          return {
            ...s,
            messages: [...s.messages, { role: "assistant", content: reply }],
            updatedAt: new Date().toISOString(),
          };
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo obtener respuesta");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  // Flat list of mentionable brand assets with image + category for the @ popover.
  const mentionableAssets = (() => {
    if (!activeBrand) return [] as Array<{ id: string; name: string; kind: string; imageUrl?: string }>;
    const out: Array<{ id: string; name: string; kind: string; imageUrl?: string }> = [];
    for (const a of activeBrand.avatars || []) out.push({ id: a.id, name: a.name, kind: "avatar", imageUrl: a.imageUrl });
    for (const p of activeBrand.products || []) out.push({ id: p.id, name: p.name, kind: "product", imageUrl: p.imageUrl });
    for (const c of activeBrand.clothing || []) out.push({ id: c.id, name: c.name, kind: "clothing", imageUrl: c.imageUrl });
    for (const b of activeBrand.backgrounds || []) out.push({ id: b.id, name: b.name, kind: "background", imageUrl: b.imageUrl });
    for (const m of activeBrand.moodboards || []) out.push({ id: m.id, name: m.name || m.description || "Moodboard", kind: "moodboard", imageUrl: m.imageUrl });
    if (activeBrand.logo?.imageUrl) {
      out.push({ id: "__logo__", name: "Logo", kind: "logo", imageUrl: activeBrand.logo.imageUrl });
    }
    return out;
  })();

  const filteredMentions = (() => {
    if (!mention.open) return mentionableAssets;
    const q = mention.query.toLowerCase();
    if (!q) return mentionableAssets.slice(0, 8);
    return mentionableAssets
      .filter((a) => a.name.toLowerCase().includes(q) || a.kind.toLowerCase().includes(q))
      .slice(0, 8);
  })();

  // Voice dictation: tap to record, tap again to stop → transcribe → append to input.
  const toggleRecording = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || "audio/webm" });
        if (blob.size === 0) return;
        setTranscribing(true);
        try {
          const { text } = await transcribeAudio(blob, "es");
          if (text) {
            setInput((prev) => (prev ? prev + " " : "") + text);
            inputRef.current?.focus();
          }
        } catch (err) {
          console.error("[stt] transcription failed:", err);
          setError("No se pudo transcribir el audio. Probá de nuevo.");
        } finally {
          setTranscribing(false);
        }
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (err) {
      console.error("[stt] mic error:", err);
      setError("No se pudo acceder al micrófono. Revisá los permisos del navegador.");
    }
  };

  // Detect "@<word>" right before caret on input change
  const handleInputChange = (value: string, ta: HTMLTextAreaElement | null) => {
    setInput(value);
    if (!ta) return;
    const caret = ta.selectionStart ?? value.length;
    let i = caret - 1;
    while (i >= 0 && !/\s/.test(value[i])) {
      if (value[i] === "@") {
        const query = value.slice(i + 1, caret);
        setMention({ open: true, query, activeIdx: 0 });
        return;
      }
      i--;
    }
    setMention((m) => ({ ...m, open: false }));
  };

  const commitMention = (asset: { id: string; name: string; kind: string }) => {
    const ta = inputRef.current;
    if (!ta) return;
    const caret = ta.selectionStart ?? input.length;
    let start = caret - 1;
    while (start >= 0 && input[start] !== "@") start--;
    if (start < 0) return;
    // Insert "@AssetName " (with trailing space) — the agent reads the name and matches it against
    // brand_summary which has names + ids. No need to embed the id explicitly for now.
    const token = `@${asset.name} `;
    const next = input.slice(0, start) + token + input.slice(caret);
    setInput(next);
    setMention({ open: false, query: "", activeIdx: 0 });
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + token.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mention.open) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMention((m) => ({ ...m, activeIdx: Math.min(m.activeIdx + 1, filteredMentions.length - 1) })); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMention((m) => ({ ...m, activeIdx: Math.max(m.activeIdx - 1, 0) })); return; }
      if (e.key === "Enter" && filteredMentions.length > 0) { e.preventDefault(); commitMention(filteredMentions[mention.activeIdx]); return; }
      if (e.key === "Escape") { e.preventDefault(); setMention((m) => ({ ...m, open: false })); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!activeBrand) {
    return (
      <div className="flex-1 flex items-center justify-center text-fg-muted">
        <div className="text-center space-y-2">
          <Bot size={32} className="mx-auto text-fg-faint" />
          <p className="text-[14px]">Seleccioná una marca para empezar a chatear</p>
        </div>
      </div>
    );
  }

  if (!activeBrand) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-[13px] text-fg-faint text-center">Seleccioná una marca para empezar a chatear</p>
      </div>
    );
  }

  return (
    <div className={cn("flex-1 flex min-w-0 h-full", compact ? "flex-col" : "")}>
      {/* Left: Assets panel (only in non-compact mode) */}
      {!compact && (
        <AssetsPanel
          brand={activeBrand}
          selections={selections}
          onChange={setSelections}
          onAddNew={() => navigate("/dashboard/brand")}
        />
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-6 max-w-2xl px-4 w-full">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-full bg-[var(--color-action-muted)] flex items-center justify-center mx-auto">
                    <Bot size={22} className="text-[var(--color-action-strong)]" />
                  </div>
                  <p className="text-fg text-[20px] font-semibold tracking-tight">
                    ¿Qué querés crear para {activeBrand.name}?
                  </p>
                  <p className="text-fg-muted text-[13px]">
                    Pedime copy, ideas de campaña, scripts, o cualquier cosa creativa.
                  </p>
                </div>

                {/* Quick starters */}
                <div className="space-y-2 text-left">
                  <p className="text-[10px] font-semibold text-fg-faint uppercase tracking-widest text-center">
                    Empezá con
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {QUICK_STARTERS.map((q) => (
                      <button
                        key={q.label}
                        onClick={() => {
                          setInput(q.prompt.replace("{brand}", activeBrand.name));
                          inputRef.current?.focus();
                        }}
                        className="group text-left px-3 py-2.5 bg-surface-1 hover:bg-surface-2 border border-edge hover:border-edge-strong rounded-[var(--radius-md)] transition-all cursor-pointer"
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-[14px] leading-none mt-0.5">{q.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium text-fg leading-tight">{q.label}</p>
                            <p className="text-[10px] text-fg-faint mt-0.5 leading-snug line-clamp-1">{q.hint}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className={cn("mx-auto py-4 space-y-1", compact ? "px-3 max-w-full" : "px-4 max-w-3xl")}>
              {messages.map((msg, i) => {
                // For assistant messages, find the preceding user message to pass as context
                const prevUserMsg = msg.role === "assistant"
                  ? [...messages.slice(0, i)].reverse().find((m) => m.role === "user")?.content
                  : undefined;
                // Only the most recent assistant message gets the current attachments
                // (older replies in history don't represent the current upload state)
                const isLatestAssistant = msg.role === "assistant" && i === messages.length - 1;
                const liveAttachments = isLatestAssistant
                  ? attachments.map((a) => ({
                      dataUrl: a.dataUrl,
                      fileName: a.file.name,
                      mimeType: a.file.type,
                      classification: a.classification,
                    }))
                  : undefined;
                return (
                  <MessageBubble
                    key={i}
                    message={msg}
                    selections={selections}
                    userQuestion={prevUserMsg}
                    attachments={liveAttachments}
                    previousResolved={resolvedPreview}
                    onResolved={(r) => setResolvedPreview(r)}
                  />
                );
              })}
              {loading && (
                <div className="flex items-start gap-3 py-4">
                  <div className="w-7 h-7 rounded-full bg-[var(--color-action-muted)] flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={14} className="text-[var(--color-action)]" />
                  </div>
                  <div className="flex items-center gap-2 text-fg-muted text-[13px] pt-1">
                    <Loader2 size={14} className="animate-spin" />
                    Pensando...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mb-2 px-3 py-2 rounded-[var(--radius-sm)] bg-[rgba(233,101,101,0.1)] border border-[rgba(233,101,101,0.2)] flex items-center gap-2 text-[13px] text-[var(--color-error)]">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {/* Resolved config preview — persists across turns. Click "Generar" to launch, or
            keep chatting to refine it (next resolve uses this as previous). */}
        {resolvedPreview && (
          <div className="mx-4 mb-2 relative">
            <button
              onClick={() => setResolvedPreview(null)}
              className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full bg-surface-1 border border-edge text-fg-faint hover:text-fg flex items-center justify-center cursor-pointer"
              title="Descartar este preview"
            >
              <X size={10} />
            </button>
            <ConfigPreviewCard resolved={resolvedPreview} />
          </div>
        )}

        {/* Input area */}
        <div
          className="border-t border-edge p-4"
          onDragOver={(e) => { e.preventDefault(); }}
          onDrop={(e) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files || []);
            if (files.length > 0) addAttachments(files);
          }}
        >
          <div className="max-w-3xl mx-auto space-y-2">
            {/* Attachments preview */}
            {attachments.length > 0 && (
              <div className="flex gap-1.5 flex-wrap px-2">
                {attachments.map((att, i) => {
                  const slotMap: Record<string, { label: string; emoji: string }> = {
                    product:    { label: "producto",    emoji: "📦" },
                    avatar:     { label: "persona",     emoji: "👤" },
                    background: { label: "fondo",       emoji: "🏙️" },
                    moodboard:  { label: "moodboard",   emoji: "🎨" },
                    reference:  { label: "referencia",  emoji: "🖼️" },
                  };
                  const slot = att.classification ? slotMap[att.classification.suggested_slot] : null;
                  return (
                    <div key={i} className="relative group">
                      <div className="w-16 h-16 rounded-[var(--radius-sm)] overflow-hidden border border-edge bg-surface-2">
                        <img src={att.dataUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                      {slot && (
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-surface-1 border border-edge rounded-full px-1.5 py-0.5 text-[8px] font-semibold text-fg-muted whitespace-nowrap shadow-sm">
                          {slot.emoji} {slot.label}
                        </div>
                      )}
                      {!att.classification && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-[var(--radius-sm)]">
                          <Loader2 size={12} className="animate-spin text-white" />
                        </div>
                      )}
                      <button
                        onClick={() => removeAttachment(i)}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-surface-2 border border-edge flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        <X size={9} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="relative flex items-end gap-2 bg-surface-1 border border-edge rounded-[var(--radius-md)] px-3 py-2 focus-within:border-[var(--color-edge-focus)] transition-colors">
              {/* @ mention popover — appears above the input when user types @ */}
              {mention.open && filteredMentions.length > 0 && (
                <div
                  className="absolute left-0 right-0 bottom-full mb-1 bg-surface-1 border border-edge rounded-[var(--radius-md)] shadow-lg p-1 max-h-64 overflow-y-auto z-20"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <div className="text-[10px] text-fg-faint px-2 py-1">Asset del brand kit</div>
                  {filteredMentions.map((a, i) => (
                    <button
                      key={a.id}
                      onClick={() => commitMention(a)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-left",
                        i === mention.activeIdx ? "bg-[var(--color-action-subtle)]" : "hover:bg-surface-2",
                      )}
                    >
                      {a.imageUrl ? (
                        <img src={a.imageUrl.startsWith("http") ? a.imageUrl : `http://127.0.0.1:8000${a.imageUrl}`} alt={a.name} className="w-7 h-7 object-cover rounded-sm shrink-0" />
                      ) : (
                        <div className="w-7 h-7 bg-surface-2 rounded-sm shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] text-fg truncate">{a.name}</div>
                        <div className="text-[9px] text-fg-faint">{a.kind}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 text-fg-faint hover:text-fg transition-colors shrink-0 cursor-pointer"
                title="Adjuntar imagen"
                type="button"
              >
                <Paperclip size={16} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 0) addAttachments(files);
                  e.target.value = "";
                }}
              />
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => handleInputChange(e.target.value, e.target)}
                onKeyDown={handleKeyDown}
                onBlur={() => setTimeout(() => setMention((m) => ({ ...m, open: false })), 150)}
                onPaste={(e) => {
                  const files = Array.from(e.clipboardData?.files || []);
                  if (files.length > 0) {
                    e.preventDefault();
                    addAttachments(files);
                  }
                }}
                placeholder={attachments.length > 0
                  ? `Decile qué hacer con ${attachments.length === 1 ? "esta imagen" : "estas imágenes"}...`
                  : `Mensaje al assistant de ${activeBrand.name}...`}
                rows={1}
                className="flex-1 bg-transparent text-fg text-[14px] placeholder:text-fg-faint outline-none resize-none max-h-[120px]"
                style={{ minHeight: "24px" }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "24px";
                  target.style.height = Math.min(target.scrollHeight, 120) + "px";
                }}
              />
              <button
                onClick={toggleRecording}
                disabled={transcribing}
                type="button"
                title={recording ? "Detener y transcribir" : "Dictar por voz"}
                className={cn(
                  "p-1.5 rounded-[var(--radius-sm)] transition-colors shrink-0 cursor-pointer disabled:opacity-50",
                  recording ? "bg-[var(--color-error)] text-white animate-pulse" : "text-fg-faint hover:text-fg",
                )}
              >
                {transcribing ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
              </button>
              <button
                onClick={handleSubmit}
                disabled={(!input.trim() && attachments.length === 0) || loading}
                className={cn(
                  "p-1.5 rounded-[var(--radius-sm)] transition-colors shrink-0 cursor-pointer",
                  (input.trim() || attachments.length > 0) && !loading
                    ? "bg-[var(--color-action)] text-[var(--color-action-fg)] hover:opacity-90"
                    : "text-fg-faint"
                )}
              >
                <Send size={16} />
              </button>
            </div>

            {/* Selection summary — shows below input when assets selected */}
            {!compact && (selections.avatarIds.length > 0 || selections.productIds.length > 0 || selections.clothingIds.length > 0 || selections.backgroundIds.length > 0 || selections.voiceId) && (
              <SelectionSummary selections={selections} brand={activeBrand} onClear={() => setSelections({ avatarIds: [], productIds: [], clothingIds: [], backgroundIds: [], voiceId: null })} />
            )}

            <p className="text-[11px] text-fg-faint text-center">
              Gemini 2.5 Flash — con contexto de {activeBrand.name}
            </p>
          </div>
        </div>
      </div>

      {/* Chat history sidebar (hidden in compact / inside the Lab side panel) */}
      {!compact && (
      <div className="w-64 border-l border-edge bg-surface-0 flex flex-col shrink-0 hidden lg:flex">
        <div className="px-4 py-3 border-b border-edge flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-fg">Chats</h2>
          <button
            onClick={createSession}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-fg-muted hover:text-fg bg-surface-1 hover:bg-surface-2 rounded-[var(--radius-sm)] transition-colors cursor-pointer"
          >
            <Plus size={11} />
            Nuevo
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {brandSessions.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <MessageSquare size={20} className="mx-auto text-fg-faint mb-2" />
              <p className="text-[12px] text-fg-faint">Sin chats todavía</p>
            </div>
          ) : (
            brandSessions.map((session) => (
              <button
                key={session.id}
                onClick={() => setActiveSessionId(session.id)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-[var(--radius-sm)] transition-colors cursor-pointer group",
                  activeSessionId === session.id
                    ? "bg-surface-2 text-fg"
                    : "text-fg-muted hover:bg-surface-1 hover:text-fg"
                )}
              >
                <p className="text-[12px] font-medium truncate">{session.title}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-fg-faint flex items-center gap-1">
                    <Clock size={9} />
                    {timeAgo(session.updatedAt)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(session.id);
                    }}
                    className="p-0.5 rounded text-fg-faint hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
      )}
    </div>
  );
}

const CHIP_VISIBLE_COUNT = 4;

function AssetChipGroup({
  items,
  icon,
  label,
  onSelect,
  onAddNew,
}: {
  items: { id: string; name: string; tag: string; imageUrl?: string }[];
  icon: React.ReactNode;
  label: string;
  onSelect: (tag: string) => void;
  onAddNew?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // Always render — even when empty — so user has "+ Nuevo" button available
  const visible = expanded ? items : items.slice(0, CHIP_VISIBLE_COUNT);
  const hiddenCount = items.length - CHIP_VISIBLE_COUNT;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] text-fg-faint font-medium uppercase tracking-wider inline-flex items-center gap-1">
        {icon}
        {label}
        <span className="text-fg-faint/60 font-normal normal-case ml-0.5">({items.length})</span>
      </span>
      {visible.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item.tag)}
          title={item.name}
          className="group flex items-center gap-1.5 pl-0.5 pr-2 py-0.5 text-[11px] font-medium text-fg-muted bg-surface-1 hover:bg-surface-2 border border-edge hover:border-edge-strong hover:text-fg rounded-full transition-all cursor-pointer"
        >
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt=""
              className="w-5 h-5 rounded-full object-cover shrink-0"
            />
          ) : (
            <span className="w-5 h-5 rounded-full bg-surface-3 flex items-center justify-center text-fg-faint shrink-0">
              {icon}
            </span>
          )}
          <span className="truncate max-w-[110px]">{item.name}</span>
        </button>
      ))}
      {items.length === 0 && (
        <span className="text-[10px] text-fg-faint italic">Ninguno cargado</span>
      )}
      {onAddNew && (
        <button
          onClick={onAddNew}
          title={`Agregar ${label.toLowerCase()} en Brand Kit`}
          className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-[var(--color-action-strong)] bg-[var(--color-action-muted)] hover:bg-[var(--color-action-subtle)] rounded-full transition-colors cursor-pointer border border-dashed border-[var(--color-action-muted)]"
        >
          <Plus size={9} />
          Nuevo
        </button>
      )}
      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-0.5 px-2 py-1 text-[10px] font-medium text-fg-faint hover:text-fg-muted transition-colors cursor-pointer"
        >
          {expanded ? "Ver menos" : `+${hiddenCount} más`}
          <ChevronDown size={10} className={cn("transition-transform", expanded && "rotate-180")} />
        </button>
      )}
    </div>
  );
}

function MessageBubble({ message, selections, userQuestion, attachments, previousResolved, onResolved }: {
  message: ChatMessage;
  selections?: ChatSelections;
  userQuestion?: string;
  attachments?: ChatAttachment[];
  previousResolved?: { tool: string; config: Record<string, unknown> } | null;
  onResolved?: (r: { tool: string; config: Record<string, unknown>; reasoning?: string; warnings?: string[] }) => void;
}) {
  const isUser = message.role === "user";
  const isIgReplicate = message.meta?.kind === "ig_replicate";
  const isScript = message.meta?.kind === "script";
  const isPrompts = message.meta?.kind === "prompts";

  return (
    <div className={cn("flex items-start gap-3 py-4", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
          isUser ? "bg-surface-2" : "bg-[var(--color-action-muted)]"
        )}
      >
        {isUser ? (
          <User size={14} className="text-fg-secondary" />
        ) : (
          <Bot size={14} className="text-[var(--color-action-strong)]" />
        )}
      </div>
      <div
        className={cn(
          "max-w-[85%] text-[14px] leading-relaxed whitespace-pre-wrap",
          isUser ? "text-fg text-right" : "text-fg-secondary space-y-3"
        )}
      >
        <div>{message.content}</div>
        {!isUser && isIgReplicate && message.meta?.kind === "ig_replicate" && (
          <IgReplicateBubble result={message.meta.result} />
        )}
        {!isUser && isScript && message.meta?.kind === "script" && (
          <ScriptBubble scenes={message.meta.scenes} selections={selections} />
        )}
        {!isUser && isPrompts && message.meta?.kind === "prompts" && (
          <PromptBubble prompts={message.meta.prompts} userImages={message.meta.userImages || []} />
        )}
        {!isUser && !isIgReplicate && !isScript && !isPrompts && <CreateWithThis content={message.content} userQuestion={userQuestion} selections={selections} attachments={attachments} previousResolved={previousResolved} onResolved={onResolved} />}
      </div>
    </div>
  );
}

// ── IG Replicate special bubble ─────────────────────────────

function buildFullObjectiveFromIg(result: import("../lib/api").InstagramReplicationResult, headerBrief: string): string {
  const lines: string[] = [];
  if (headerBrief.trim()) lines.push(headerBrief.trim());
  if (result.narrative && result.narrative.length > 0) {
    lines.push("");
    lines.push(`Estructura (${result.narrative.length} slides):`);
    for (const n of result.narrative) {
      const visual = n.adapted_for_brand?.visual?.trim();
      const text = n.adapted_for_brand?.text?.trim();
      const role = n.role ? ` (${n.role})` : "";
      if (visual || text) {
        const parts: string[] = [];
        if (visual) parts.push(`mostrar: ${visual}`);
        if (text) parts.push(`texto: "${text}"`);
        lines.push(`  Slide ${n.slide}${role} — ${parts.join(" | ")}`);
      } else if (n.describes) {
        lines.push(`  Slide ${n.slide}${role} — ${n.describes}`);
      }
    }
    lines.push(`Fuente narrativa: @${result.sourceUsername} (adaptada a la marca, no copiar literal)`);
  }
  return lines.join("\n");
}

function IgReplicateBubble({ result }: { result: import("../lib/api").InstagramReplicationResult }) {
  const navigate = useNavigate();
  const [editedBrief, setEditedBrief] = useState(() => buildFullObjectiveFromIg(result, result.brief));
  const [applying, setApplying] = useState(false);

  const handoffToCarousel = async () => {
    setApplying(true);
    try {
      // Download ALL slides as dataURLs so each generated slide can use its
      // corresponding original as a per-slide composition reference.
      const slideDataUrls: string[] = [];
      for (const s of result.scraped.slides.slice(0, 10)) {
        if (!s?.url) { slideDataUrls.push(""); continue; }
        try {
          const fullUrl = s.url.startsWith("http") ? s.url : `http://127.0.0.1:8000${s.url}`;
          const r = await fetch(fullUrl);
          if (!r.ok) { slideDataUrls.push(""); continue; }
          const blob = await r.blob();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          });
          slideDataUrls.push(dataUrl);
        } catch (err) {
          console.warn("[ig-replicate-bubble] could not download slide as dataURL:", err);
          slideDataUrls.push("");
        }
      }

      const validCount = slideDataUrls.filter(Boolean).length;
      console.log(`[ig-replicate-bubble] downloaded ${validCount}/${result.scraped.slides.length} slides`);

      // Slide 0 also goes in `attachments` so the existing referenceImages flow shows
      // a thumbnail in the Composition Reference slot (banner / readiness check).
      const slide0DataUrl = slideDataUrls[0] || "";

      const handoff = {
        from: "chat",
        mode: "auto",
        tool: "carousel_creator",
        brief: editedBrief,
        config: {
          numSlides: result.numSlides,
          objective: editedBrief,
          referenceMode: "composition",
          composeMode: "quick",
        },
        attachments: slide0DataUrl ? [{
          dataUrl: slide0DataUrl,
          fileName: `ig-template-${result.scraped.shortCode}.jpg`,
          mimeType: "image/jpeg",
        }] : undefined,
        // Per-slide attachments: each slide of the IG carousel becomes the layout anchor
        // for the corresponding generated slide. Length matches the number of slides.
        perSlideAttachments: slideDataUrls.map((dataUrl, i) => ({
          dataUrl,
          fileName: `ig-slide-${i + 1}-${result.scraped.shortCode}.jpg`,
          mimeType: "image/jpeg",
        })),
        reasoning: `Replicar narrativa de @${result.sourceUsername} adaptada a la marca, con un template distinto por slide`,
      };
      sessionStorage.setItem("coevo-chat-handoff", JSON.stringify(handoff));
      navigate(`/dashboard/generate/carousel_creator`);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-4 space-y-3 mt-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold text-fg-faint uppercase tracking-wider">Carrusel original</p>
          <p className="text-[12px] font-semibold text-fg">@{result.sourceUsername} · {result.numSlides} slides</p>
        </div>
        <a href={result.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-fg-faint hover:text-fg-muted">Ver original →</a>
      </div>

      {/* Slides preview */}
      {result.scraped.slides && result.scraped.slides.length > 0 && (
        <div className="grid grid-cols-5 gap-1.5">
          {result.scraped.slides.slice(0, 10).map((s, i) => {
            const thumbUrl = s.url.startsWith("http") ? s.url : `http://127.0.0.1:8000${s.url}`;
            return (
              <div key={i} className="relative aspect-square rounded-[var(--radius-sm)] overflow-hidden border border-edge">
                <img src={thumbUrl} alt={`slide ${i + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <div className="absolute top-1 left-1 bg-black/60 text-white text-[8px] font-bold px-1 py-0.5 rounded">
                  {i + 1}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Narrative breakdown */}
      {result.narrative && result.narrative.length > 0 && (
        <details className="group">
          <summary className="text-[11px] font-semibold text-fg-faint uppercase tracking-wider cursor-pointer hover:text-fg-muted">
            Narrativa detectada ({result.narrative.length} slides)
          </summary>
          <ul className="mt-2 space-y-1.5">
            {result.narrative.map((n, i) => (
              <li key={i} className="text-[11px] text-fg-muted leading-relaxed">
                <span className="font-mono text-[10px] text-fg-faint">{String(n.slide).padStart(2, "0")}</span>
                <span className="font-semibold text-[var(--color-action-strong)] ml-1.5">{n.role}</span>
                <span className="ml-1.5">— {n.describes}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Editable brief */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-fg-faint uppercase tracking-wider">Brief para tu marca (editable)</label>
        <textarea
          value={editedBrief}
          onChange={(e) => setEditedBrief(e.target.value)}
          rows={Math.min(12, Math.max(6, editedBrief.split("\n").length))}
          className="w-full bg-surface-2 border border-edge rounded-[var(--radius-sm)] px-3 py-2 text-[12px] text-fg outline-none focus:border-[var(--color-action)] resize-y leading-relaxed font-mono"
        />
      </div>

      <button
        onClick={handoffToCarousel}
        disabled={applying || !editedBrief.trim()}
        className="w-full px-3 py-2.5 text-[12px] font-semibold bg-[var(--color-action)] text-[var(--color-action-fg)] rounded-[var(--radius-sm)] hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
      >
        {applying ? "Preparando..." : "→ Crear carousel con esto"}
      </button>
      <p className="text-[10px] text-fg-faint italic">
        Slide 1 se va a usar como template visual. Modo: Composición + Compose=Quick.
      </p>
    </div>
  );
}

// ── Script bubble: shows a generated UGC script + "Usar este guion" → UGC tool ──

function ScriptBubble({ scenes, selections }: { scenes: ChatScriptScene[]; selections?: ChatSelections }) {
  const navigate = useNavigate();
  if (!scenes || scenes.length === 0) return null;

  const useThis = () => {
    const override: Record<string, unknown> = {};
    if (selections?.avatarIds[0]) override.selectedAvatarId = selections.avatarIds[0];
    if (selections?.productIds[0]) override.selectedProductId = selections.productIds[0];
    if (selections?.clothingIds.length) override.selectedClothingIds = selections.clothingIds;
    if (selections?.backgroundIds[0]) override.selectedBackgroundId = selections.backgroundIds[0];
    if (selections?.voiceId) override.selectedVoiceId = selections.voiceId;
    const customScript = JSON.stringify(
      scenes.map((s) => ({ title: s.title, script: s.script, visual: s.image_prompt, sceneType: s.sceneType })),
    );
    sessionStorage.setItem("coevo-chat-handoff", JSON.stringify({
      from: "chat", mode: "script", tool: "ugc_creator",
      config: { ...override, customScript },
    }));
    navigate("/dashboard/generate/ugc_creator");
  };

  return (
    <div className="mt-2 border border-edge rounded-[var(--radius-md)] bg-surface-1 overflow-hidden">
      <div className="px-3 py-2 border-b border-edge flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-fg">Guion · {scenes.length} escena{scenes.length === 1 ? "" : "s"}</span>
        <button
          onClick={useThis}
          className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold rounded-full bg-[var(--color-action)] text-[var(--color-action-fg)] hover:opacity-90 cursor-pointer shrink-0"
        >
          <Wand2 size={12} /> Usar este guion
        </button>
      </div>
      <div className="divide-y divide-edge">
        {scenes.map((s, i) => (
          <div key={i} className="px-3 py-2 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-fg-faint tabular-nums bg-surface-2 border border-edge rounded px-1.5 py-0.5">{i + 1}</span>
              <span className="text-[10px] font-medium text-fg-muted">{s.title || `Escena ${i + 1}`}</span>
              <span className={cn(
                "text-[8px] px-1.5 py-0.5 rounded-full uppercase tracking-wide",
                s.sceneType === "creative" ? "bg-blue-500/15 text-blue-300" : "bg-[var(--color-action-subtle)] text-[var(--color-action)]",
              )}>{s.sceneType === "creative" ? "b-roll" : "habla"}</span>
            </div>
            {s.script ? (
              <p className="text-[12px] text-fg leading-snug whitespace-pre-wrap">{s.script}</p>
            ) : (
              <p className="text-[11px] text-fg-faint italic">— sin voz (b-roll) —</p>
            )}
            {s.image_prompt && <p className="text-[10px] text-fg-faint leading-snug">🎥 {s.image_prompt}</p>}
          </div>
        ))}
      </div>
      <p className="px-3 py-1.5 text-[10px] text-fg-faint border-t border-edge">Pedime cambios ("más corto", "otro hook", "metele b-roll") o tocá <strong>Usar este guion</strong>.</p>
    </div>
  );
}

// ── Prompt bubble: 1-3 image-prompt candidates + "Usar en Lab" → Lab with handoff ──

function PromptBubble({ prompts, userImages }: { prompts: ChatPromptCandidate[]; userImages: ChatImage[] }) {
  const navigate = useNavigate();
  const [includeRefs, setIncludeRefs] = useState<Record<number, boolean>>({});

  if (!prompts || prompts.length === 0) return null;
  const hasImages = userImages.length > 0;

  const useThis = (idx: number) => {
    const carryRefs = hasImages && !!includeRefs[idx];
    const payload = {
      from: "copiloto" as const,
      kind: "prompt" as const,
      prompt: prompts[idx].prompt,
      title: prompts[idx].title,
      refs: carryRefs ? userImages : [],
    };
    sessionStorage.setItem("coevo-lab-prompt-handoff", JSON.stringify(payload));
    // Fire an event so the Lab (if currently mounted, e.g. when this bubble lives in the
    // side panel) picks it up without relying on a remount.
    window.dispatchEvent(new CustomEvent("coevo-lab-handoff"));
    navigate("/dashboard/lab");
  };

  return (
    <div className="mt-2 border border-edge rounded-[var(--radius-md)] bg-surface-1 overflow-hidden">
      <div className="px-3 py-2 border-b border-edge flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-fg">
          {prompts.length} {prompts.length === 1 ? "prompt" : "prompts"} candidato{prompts.length === 1 ? "" : "s"}
        </span>
        <span className="text-[10px] text-fg-faint">elegí uno y probalo en Lab</span>
      </div>
      <div className="divide-y divide-edge">
        {prompts.map((p, i) => (
          <div key={i} className="px-3 py-2.5 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[9px] font-bold text-fg-faint tabular-nums bg-surface-2 border border-edge rounded px-1.5 py-0.5">{i + 1}</span>
              <span className="text-[11px] font-semibold text-fg">{p.title || `Variante ${i + 1}`}</span>
            </div>
            <p className="text-[12px] text-fg leading-snug font-mono whitespace-pre-wrap">{p.prompt}</p>
            {p.why && <p className="text-[10px] text-fg-faint leading-snug italic">— {p.why}</p>}
            <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
              {hasImages ? (
                <label className="flex items-center gap-1.5 text-[10px] text-fg-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!includeRefs[i]}
                    onChange={(e) => setIncludeRefs((s) => ({ ...s, [i]: e.target.checked }))}
                    className="cursor-pointer"
                  />
                  Incluir {userImages.length} imagen{userImages.length === 1 ? "" : "es"} como refs (image-to-image)
                </label>
              ) : <span />}
              <button
                onClick={() => useThis(i)}
                className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold rounded-full bg-[var(--color-action)] text-[var(--color-action-fg)] hover:opacity-90 cursor-pointer shrink-0"
              >
                <Wand2 size={11} /> Usar en Lab
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="px-3 py-1.5 text-[10px] text-fg-faint border-t border-edge">Pedime ajustes ("más oscuro", "otro vibe", "más editorial") para una ronda nueva.</p>
    </div>
  );
}

// ── Handoff: chat reply → tool ──────────────────────────────

const HANDOFF_TOOLS: { id: string; label: string; emoji: string }[] = [
  { id: "ugc_creator", label: "UGC Creator", emoji: "🎬" },
  { id: "video_ad_creator", label: "Video Ad Creator", emoji: "🎞️" },
  { id: "fashion_reel", label: "Fashion Reel", emoji: "👗" },
  { id: "static_ad", label: "Static Ad", emoji: "🖼️" },
  { id: "carousel_creator", label: "Carousel", emoji: "📑" },
  { id: "product_spotlight", label: "Product Spotlight", emoji: "💡" },
];

const CHAT_HANDOFF_KEY = "coevo-chat-handoff";

export interface ChatAttachment {
  dataUrl: string;
  fileName?: string;
  mimeType?: string;
  classification?: { type: string; suggested_slot: string; description: string };
}

function CreateWithThis({ content, userQuestion, selections, attachments, previousResolved, onResolved }: {
  content: string;
  userQuestion?: string;
  selections?: ChatSelections;
  attachments?: ChatAttachment[];
  previousResolved?: { tool: string; config: Record<string, unknown> } | null;
  onResolved?: (r: { tool: string; config: Record<string, unknown>; reasoning?: string; warnings?: string[] }) => void;
}) {
  const { activeBrand } = useBrand();
  const [open, setOpen] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoError, setAutoError] = useState<string | null>(null);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Build override config from current selections — so agent doesn't have to guess
  const buildSelectionOverride = () => {
    if (!selections) return {};
    const override: Record<string, unknown> = {};
    if (selections.avatarIds[0]) override.selectedAvatarId = selections.avatarIds[0];
    if (selections.productIds[0]) override.selectedProductId = selections.productIds[0];
    if (selections.clothingIds.length > 0) override.selectedClothingIds = selections.clothingIds;
    if (selections.backgroundIds[0]) override.selectedBackgroundId = selections.backgroundIds[0];
    if (selections.voiceId) override.selectedVoiceId = selections.voiceId;
    return override;
  };

  // Build a brief that combines the user's original question with the AI's elaboration
  const buildBrief = (): string => {
    if (userQuestion) {
      return `LO QUE EL USUARIO PIDIÓ:\n${userQuestion}\n\nELABORACIÓN DEL ASSISTANT (ideas, copy, contexto adicional):\n${content}`;
    }
    return content;
  };

  const manualHandoff = (toolId: string) => {
    const brief = buildBrief();
    sessionStorage.setItem(
      CHAT_HANDOFF_KEY,
      JSON.stringify({
        from: "chat",
        mode: "auto",
        brief,
        tool: toolId,
        config: { ...buildSelectionOverride(), objective: userQuestion || content },
        attachments: attachments && attachments.length > 0 ? attachments : undefined,
      })
    );
    setOpen(false);
    navigate(`/dashboard/generate/${toolId}`);
  };

  const autoHandoff = async () => {
    if (!activeBrand) return;
    setAutoLoading(true);
    setAutoError(null);
    try {
      // Compose brief: user question (intent) + assistant reply (ideas/copy) + selections + attachments
      const baseBrief = buildBrief();
      const selectionHint = selections ? buildSelectionHint(selections, activeBrand) : "";
      let fullBrief = selectionHint ? `${baseBrief}\n\n${selectionHint}` : baseBrief;
      // Attachments hint — give the agent context about what images came with the brief
      if (attachments && attachments.length > 0) {
        const attHint = attachments.map((a, i) => {
          const slot = a.classification?.suggested_slot || "reference";
          const desc = a.classification?.description || "imagen subida por el usuario";
          return `  Imagen ${i + 1} (${slot}): ${desc}`;
        }).join("\n");
        fullBrief += `\n\nIMÁGENES ADJUNTAS POR EL USUARIO (clasificadas por Gemini Vision):\n${attHint}\n\nEl tool elegido debe usar estas imágenes en los slots adecuados (template/reference/etc.) sin que el usuario tenga que cargarlas otra vez.`;
      }
      const result = await resolveAgentBrief(activeBrand.id, fullBrief, previousResolved || null);
      if (!result.tool) throw new Error("El agente no pudo elegir tool");
      // Merge agent config with user selections (user wins on explicit picks)
      const mergedConfig = { ...result.config, ...buildSelectionOverride() };
      // Propagate up so ChatPanel can show the preview card + use it as `previous` on next turn.
      onResolved?.({ tool: result.tool, config: mergedConfig, reasoning: result.reasoning, warnings: result.warnings });
      sessionStorage.setItem(
        CHAT_HANDOFF_KEY,
        JSON.stringify({
          from: "chat",
          mode: "auto",
          brief: content,
          tool: result.tool,
          config: mergedConfig,
          reasoning: result.reasoning,
          warnings: result.warnings,
          attachments: attachments && attachments.length > 0 ? attachments : undefined,
        })
      );
      setOpen(false);
      navigate(`/dashboard/generate/${result.tool}`);
    } catch (e) {
      setAutoError(e instanceof Error ? e.message : "Agent error");
    } finally {
      setAutoLoading(false);
    }
  };

  if (!content.trim()) return null;

  return (
    <div ref={ref} className="relative inline-flex items-center gap-2 flex-wrap">
      {/* Primary: auto */}
      <button
        onClick={autoHandoff}
        disabled={autoLoading || !activeBrand}
        className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium text-[var(--color-action-fg)] bg-[var(--color-action)] hover:bg-[var(--color-action-strong)] rounded-full transition-all cursor-pointer disabled:opacity-50 shadow-sm"
        title="La IA elige la tool y pre-llena todos los campos automáticamente"
      >
        {autoLoading ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
        {autoLoading ? "Resolviendo..." : "Crear automáticamente"}
      </button>

      {/* Secondary: manual picker */}
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-fg-muted hover:text-fg bg-surface-1 hover:bg-surface-2 border border-edge hover:border-edge-strong rounded-full transition-all cursor-pointer"
        title="Elegí vos la tool manualmente"
      >
        Elegir tool
        <ChevronDown size={10} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {autoError && (
        <span className="text-[10px] text-[var(--color-error)]">{autoError}</span>
      )}

      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-surface-1 border border-edge rounded-[var(--radius-md)] shadow-lg overflow-hidden z-20">
          <div className="px-3 py-2 border-b border-edge-subtle">
            <p className="text-[10px] font-semibold text-fg-faint uppercase tracking-widest">Elegí una tool</p>
          </div>
          <div className="py-1 max-h-64 overflow-y-auto">
            {HANDOFF_TOOLS.map((t) => (
              <button
                key={t.id}
                onClick={() => manualHandoff(t.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-2 cursor-pointer transition-colors"
              >
                <span className="text-[13px]">{t.emoji}</span>
                <span className="text-[12px] font-medium text-fg">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


// ──────────────────────────────────────────────────────────────────
// Assets Panel — left sidebar with visual asset selection
// ──────────────────────────────────────────────────────────────────

type Brand = ReturnType<typeof useBrand>["activeBrand"];

function buildSelectionHint(selections: ChatSelections, brand: NonNullable<Brand>): string {
  const lines: string[] = [];
  const avatars = (brand.avatars || []).filter((a) => selections.avatarIds.includes(a.id));
  const products = (brand.products || []).filter((p) => selections.productIds.includes(p.id));
  const clothing = (brand.clothing || []).filter((c) => selections.clothingIds.includes(c.id));
  const backgrounds = (brand.backgrounds || []).filter((b) => selections.backgroundIds.includes(b.id));
  const voice = (brand.voicePresets || []).find((v) => v.id === selections.voiceId);

  if (avatars.length) lines.push(`USÁ estos avatars (ids): ${avatars.map((a) => `${a.id} (${a.name})`).join(", ")}`);
  if (products.length) lines.push(`USÁ estos productos (ids): ${products.map((p) => `${p.id} (${p.name})`).join(", ")}`);
  if (clothing.length) lines.push(`USÁ esta ropa (ids): ${clothing.map((c) => `${c.id} (${c.name})`).join(", ")}`);
  if (backgrounds.length) lines.push(`USÁ estos fondos (ids): ${backgrounds.map((b) => `${b.id} (${b.name})`).join(", ")}`);
  if (voice) lines.push(`USÁ esta voz (id): ${voice.id} (${voice.name})`);

  return lines.length ? `ASSETS PRESELECCIONADOS POR EL USUARIO (usar estos, no los inventes):\n${lines.join("\n")}` : "";
}

function AssetsPanel({
  brand,
  selections,
  onChange,
  onAddNew,
}: {
  brand: NonNullable<Brand>;
  selections: ChatSelections;
  onChange: (s: ChatSelections) => void;
  onAddNew: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const toggleAvatar = (id: string) => {
    onChange({
      ...selections,
      avatarIds: selections.avatarIds.includes(id)
        ? selections.avatarIds.filter((x) => x !== id)
        : [...selections.avatarIds, id],
    });
  };
  const toggleProduct = (id: string) => {
    onChange({
      ...selections,
      productIds: selections.productIds.includes(id)
        ? selections.productIds.filter((x) => x !== id)
        : [...selections.productIds, id],
    });
  };
  const toggleClothing = (id: string) => {
    onChange({
      ...selections,
      clothingIds: selections.clothingIds.includes(id)
        ? selections.clothingIds.filter((x) => x !== id)
        : [...selections.clothingIds, id],
    });
  };
  const toggleBackground = (id: string) => {
    onChange({
      ...selections,
      backgroundIds: selections.backgroundIds.includes(id)
        ? selections.backgroundIds.filter((x) => x !== id)
        : [...selections.backgroundIds, id],
    });
  };
  const setVoice = (id: string) => {
    onChange({ ...selections, voiceId: selections.voiceId === id ? null : id });
  };

  if (collapsed) {
    return (
      <div className="w-12 border-r border-edge bg-surface-0 flex flex-col items-center py-3 shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          className="w-8 h-8 flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface-1 rounded-[var(--radius-sm)] cursor-pointer"
          title="Expandir assets"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    );
  }

  return (
    <aside className="w-[280px] border-r border-edge bg-surface-0 flex flex-col shrink-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-edge flex items-center justify-between">
        <h2 className="text-[12px] font-semibold text-fg tracking-tight">Assets de la marca</h2>
        <button
          onClick={() => setCollapsed(true)}
          className="text-fg-faint hover:text-fg cursor-pointer"
          title="Colapsar"
        >
          <ChevronLeft size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-3 space-y-4">
        {/* Avatars */}
        <AssetSection
          icon={<ImageIcon size={11} />}
          label="Avatars"
          count={(brand.avatars || []).length}
          onAdd={onAddNew}
        >
          <AssetGrid
            items={(brand.avatars || []).map((a) => ({
              id: a.id,
              name: a.name,
              imageUrl: a.imageUrl ? `http://127.0.0.1:8000${a.imageUrl}` : undefined,
            }))}
            selected={selections.avatarIds}
            onToggle={toggleAvatar}
          />
        </AssetSection>

        {/* Products */}
        <AssetSection
          icon={<Package size={11} />}
          label="Productos"
          count={(brand.products || []).length}
          onAdd={onAddNew}
        >
          <AssetGrid
            items={(brand.products || []).map((p) => ({
              id: p.id,
              name: p.name,
              imageUrl: p.imageUrl ? `http://127.0.0.1:8000${p.imageUrl}` : undefined,
            }))}
            selected={selections.productIds}
            onToggle={toggleProduct}
          />
        </AssetSection>

        {/* Clothing */}
        <AssetSection
          icon={<Shirt size={11} />}
          label="Ropa"
          count={(brand.clothing || []).length}
          onAdd={onAddNew}
        >
          <AssetGrid
            items={(brand.clothing || []).map((c) => ({
              id: c.id,
              name: c.name,
              imageUrl: c.imageUrl ? `http://127.0.0.1:8000${c.imageUrl}` : undefined,
            }))}
            selected={selections.clothingIds}
            onToggle={toggleClothing}
          />
        </AssetSection>

        {/* Backgrounds */}
        <AssetSection
          icon={<Mountain size={11} />}
          label="Fondos"
          count={(brand.backgrounds || []).length}
          onAdd={onAddNew}
        >
          <AssetGrid
            items={(brand.backgrounds || []).map((b) => ({
              id: b.id,
              name: b.name,
              imageUrl: b.imageUrl ? `http://127.0.0.1:8000${b.imageUrl}` : undefined,
            }))}
            selected={selections.backgroundIds}
            onToggle={toggleBackground}
          />
        </AssetSection>

        {/* Voices (single-select) */}
        <AssetSection
          icon={<Mic size={11} />}
          label="Voces"
          count={(brand.voicePresets || []).length}
          onAdd={onAddNew}
        >
          <div className="px-3 space-y-1">
            {(brand.voicePresets || []).map((v) => {
              const isActive = selections.voiceId === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => setVoice(v.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-sm)] transition-all cursor-pointer text-left",
                    isActive
                      ? "bg-[var(--color-action-muted)] border border-[var(--color-action)]"
                      : "border border-transparent hover:bg-surface-1 hover:border-edge"
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
                    isActive ? "bg-[var(--color-action)] text-[var(--color-action-fg)]" : "bg-surface-2 text-fg-faint"
                  )}>
                    <Mic size={10} />
                  </div>
                  <span className={cn(
                    "text-[11px] font-medium flex-1 truncate",
                    isActive ? "text-fg" : "text-fg-muted"
                  )}>
                    {v.name}
                  </span>
                  {isActive && <Check size={11} className="text-[var(--color-action-strong)]" />}
                </button>
              );
            })}
            {(brand.voicePresets || []).length === 0 && (
              <p className="text-[10px] text-fg-faint italic px-2 py-1">Ninguna cargada</p>
            )}
          </div>
        </AssetSection>
      </div>
    </aside>
  );
}

function AssetSection({
  icon,
  label,
  count,
  onAdd,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  onAdd?: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <div className="flex items-center justify-between px-3 mb-1.5">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 text-[10px] font-semibold text-fg-faint uppercase tracking-wider hover:text-fg cursor-pointer"
        >
          <ChevronRight size={10} className={cn("transition-transform", open && "rotate-90")} />
          {icon}
          {label}
          <span className="text-fg-faint/50 font-normal normal-case">({count})</span>
        </button>
        {onAdd && (
          <button
            onClick={onAdd}
            className="w-5 h-5 rounded-full flex items-center justify-center text-fg-faint hover:text-[var(--color-action-strong)] hover:bg-[var(--color-action-muted)] cursor-pointer transition-colors"
            title={`Agregar en Brand Kit`}
          >
            <Plus size={10} />
          </button>
        )}
      </div>
      {open && children}
    </div>
  );
}

function AssetGrid({
  items,
  selected,
  onToggle,
}: {
  items: { id: string; name: string; imageUrl?: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (items.length === 0) {
    return <p className="text-[10px] text-fg-faint italic px-3 py-1">Ninguno cargado</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-1.5 px-3">
      {items.map((it) => {
        const isActive = selected.includes(it.id);
        return (
          <button
            key={it.id}
            onClick={() => onToggle(it.id)}
            title={it.name}
            className={cn(
              "relative rounded-[var(--radius-sm)] overflow-hidden border-2 transition-all cursor-pointer group",
              isActive
                ? "border-[var(--color-action)] ring-2 ring-[var(--color-action-muted)]"
                : "border-transparent hover:border-edge-strong"
            )}
          >
            {it.imageUrl ? (
              <img src={it.imageUrl} alt={it.name} className="w-full aspect-square object-cover" />
            ) : (
              <div className="w-full aspect-square bg-surface-2 flex items-center justify-center">
                <ImageIcon size={16} className="text-fg-faint" />
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 py-1">
              <p className="text-[9px] font-medium text-white truncate text-left">{it.name}</p>
            </div>
            {isActive && (
              <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[var(--color-action)] flex items-center justify-center shadow-sm">
                <Check size={8} className="text-[var(--color-action-fg)]" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function SelectionSummary({
  selections,
  brand,
  onClear,
}: {
  selections: ChatSelections;
  brand: NonNullable<Brand>;
  onClear: () => void;
}) {
  const avatars = (brand.avatars || []).filter((a) => selections.avatarIds.includes(a.id));
  const products = (brand.products || []).filter((p) => selections.productIds.includes(p.id));
  const clothing = (brand.clothing || []).filter((c) => selections.clothingIds.includes(c.id));
  const backgrounds = (brand.backgrounds || []).filter((b) => selections.backgroundIds.includes(b.id));
  const voice = (brand.voicePresets || []).find((v) => v.id === selections.voiceId);

  const total = avatars.length + products.length + clothing.length + backgrounds.length + (voice ? 1 : 0);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-action-muted)] border border-[var(--color-action-muted)] rounded-full text-[11px] text-[var(--color-action-strong)] font-medium">
      <Check size={11} />
      <span>{total} asset{total !== 1 ? "s" : ""} seleccionado{total !== 1 ? "s" : ""}:</span>
      <span className="text-fg-muted truncate flex-1 font-normal">
        {[
          avatars.map((a) => a.name).join(", "),
          products.map((p) => p.name).join(", "),
          clothing.length ? `${clothing.length} ropa` : "",
          backgrounds.length ? `${backgrounds.length} fondo` : "",
          voice?.name,
        ].filter(Boolean).join(" · ")}
      </span>
      <button
        onClick={onClear}
        className="text-[var(--color-action-strong)] hover:text-fg cursor-pointer"
        title="Limpiar selección"
      >
        <X size={11} />
      </button>
    </div>
  );
}
