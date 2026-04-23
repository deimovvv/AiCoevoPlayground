import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Bot, User, AlertCircle, Plus, MessageSquare, Trash2, Clock, ImageIcon, Package, Mic, Wand2, Video, Megaphone, Share2, ChevronDown, Mountain } from "lucide-react";
import { useNavigate } from "react-router";
import { useBrand } from "../lib/BrandContext";
import { sendChatMessage } from "../lib/api";
import type { ChatMessage } from "../lib/api";
import { cn } from "../lib/utils";

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
    const userMessage: ChatMessage = { role: "user", content: text };

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
      const currentSession = sessions.find((s) => s.id === sessionId);
      const allMessages = [...(currentSession?.messages || []), userMessage];
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-6 max-w-2xl px-4 w-full">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-full bg-[var(--color-warm-muted)] flex items-center justify-center mx-auto">
                    <Bot size={22} className="text-[var(--color-warm-strong)]" />
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
              {messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} />
              ))}
              {loading && (
                <div className="flex items-start gap-3 py-4">
                  <div className="w-7 h-7 rounded-full bg-[var(--color-warm-muted)] flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={14} className="text-[var(--color-warm)]" />
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

        {/* Input area */}
        <div className="border-t border-edge p-4">
          <div className="max-w-3xl mx-auto space-y-2">
            <div className="flex items-end gap-2 bg-surface-1 border border-edge rounded-[var(--radius-md)] px-3 py-2 focus-within:border-[var(--color-edge-focus)] transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Mensaje al assistant de ${activeBrand.name}...`}
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
                onClick={handleSubmit}
                disabled={!input.trim() || loading}
                className={cn(
                  "p-1.5 rounded-[var(--radius-sm)] transition-colors shrink-0 cursor-pointer",
                  input.trim() && !loading
                    ? "bg-[var(--color-warm)] text-[var(--color-warm-fg)] hover:opacity-90"
                    : "text-fg-faint"
                )}
              >
                <Send size={16} />
              </button>
            </div>

            {/* Context chips + tool actions (hidden in compact/drawer mode) */}
            <div className={cn("space-y-1.5", compact && "hidden")}>
              {/* Asset groups */}
              <AssetChipGroup
                items={(activeBrand.avatars || []).map((av) => ({ id: av.id, name: av.name, tag: `[avatar: ${av.name}]` }))}
                icon={<ImageIcon size={10} />}
                label="Avatars"
                onSelect={(tag) => setInput((prev) => `${prev}${prev ? " " : ""}${tag} `)}
              />
              <AssetChipGroup
                items={(activeBrand.products || []).map((p) => ({ id: p.id, name: p.name, tag: `[producto: ${p.name}]` }))}
                icon={<Package size={10} />}
                label="Productos"
                onSelect={(tag) => setInput((prev) => `${prev}${prev ? " " : ""}${tag} `)}
              />
              <AssetChipGroup
                items={(activeBrand.voicePresets || []).map((v) => ({ id: v.id, name: v.name, tag: `[voz: ${v.name}]` }))}
                icon={<Mic size={10} />}
                label="Voces"
                onSelect={(tag) => setInput((prev) => `${prev}${prev ? " " : ""}${tag} `)}
              />
              <AssetChipGroup
                items={(activeBrand.backgrounds || []).map((bg) => ({ id: bg.id, name: bg.name, tag: `[fondo: ${bg.name}]` }))}
                icon={<Mountain size={10} />}
                label="Fondos"
                onSelect={(tag) => setInput((prev) => `${prev}${prev ? " " : ""}${tag} `)}
              />

              {/* Tool quick actions */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => navigate("/dashboard/generate/ugc_creator")}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-[var(--color-warm)] bg-[var(--color-warm-muted)] rounded-full hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <Video size={10} />
                  UGC Creator
                </button>
                <button
                  onClick={() => navigate("/dashboard/generate/ad_creative")}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-[var(--color-warm)] bg-[var(--color-warm-muted)] rounded-full hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <Megaphone size={10} />
                  Ad Creative
                </button>
                <button
                  onClick={() => navigate("/dashboard/generate/social_post")}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-[var(--color-warm)] bg-[var(--color-warm-muted)] rounded-full hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <Share2 size={10} />
                  Social Post
                </button>
                <button
                  onClick={() => navigate("/dashboard/generate")}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-fg-faint bg-surface-1 border border-edge rounded-full hover:bg-surface-2 hover:text-fg transition-colors cursor-pointer"
                >
                  <Wand2 size={10} />
                  Todas las tools
                </button>
              </div>
            </div>

            <p className="text-[11px] text-fg-faint text-center">
              Gemini 2.5 Flash — con contexto de {activeBrand.name}
            </p>
          </div>
        </div>
      </div>

      {/* Chat history sidebar */}
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
    </div>
  );
}

const CHIP_VISIBLE_COUNT = 3;

function AssetChipGroup({
  items,
  icon,
  label,
  onSelect,
}: {
  items: { id: string; name: string; tag: string }[];
  icon: React.ReactNode;
  label: string;
  onSelect: (tag: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) return null;

  const visible = expanded ? items : items.slice(0, CHIP_VISIBLE_COUNT);
  const hiddenCount = items.length - CHIP_VISIBLE_COUNT;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] text-fg-faint font-medium uppercase tracking-wider">{label}</span>
      {visible.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item.tag)}
          className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-fg-muted bg-surface-1 border border-edge rounded-full hover:bg-surface-2 hover:text-fg transition-colors cursor-pointer"
        >
          {icon}
          {item.name}
        </button>
      ))}
      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-0.5 px-2 py-1 text-[10px] font-medium text-fg-faint hover:text-fg-muted transition-colors cursor-pointer"
        >
          {expanded ? "Less" : `+${hiddenCount} more`}
          <ChevronDown size={10} className={cn("transition-transform", expanded && "rotate-180")} />
        </button>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex items-start gap-3 py-4", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
          isUser ? "bg-surface-2" : "bg-[var(--color-warm-muted)]"
        )}
      >
        {isUser ? (
          <User size={14} className="text-fg-secondary" />
        ) : (
          <Bot size={14} className="text-[var(--color-warm-strong)]" />
        )}
      </div>
      <div
        className={cn(
          "max-w-[85%] text-[14px] leading-relaxed whitespace-pre-wrap",
          isUser ? "text-fg text-right" : "text-fg-secondary space-y-3"
        )}
      >
        <div>{message.content}</div>
        {!isUser && <CreateWithThis content={message.content} />}
      </div>
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

function CreateWithThis({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const handoff = (toolId: string) => {
    sessionStorage.setItem(
      CHAT_HANDOFF_KEY,
      JSON.stringify({ from: "chat", brief: content, tool: toolId })
    );
    setOpen(false);
    navigate(`/dashboard/generate/${toolId}`);
  };

  if (!content.trim()) return null;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-[var(--color-warm-strong)] bg-[var(--color-warm-muted)] hover:bg-[var(--color-warm-subtle)] border border-[var(--color-warm-muted)] hover:border-[var(--color-warm)] rounded-full transition-all cursor-pointer"
      >
        <Wand2 size={11} />
        Crear con esto
        <ChevronDown size={10} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-surface-1 border border-edge rounded-[var(--radius-md)] shadow-lg overflow-hidden z-20">
          <div className="px-3 py-2 border-b border-edge-subtle">
            <p className="text-[10px] font-semibold text-fg-faint uppercase tracking-widest">Elegí una tool</p>
          </div>
          <div className="py-1 max-h-64 overflow-y-auto">
            {HANDOFF_TOOLS.map((t) => (
              <button
                key={t.id}
                onClick={() => handoff(t.id)}
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
