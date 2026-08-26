/**
 * PortalPage — public, no-auth client portal (per brand).
 * ─────────────────────────────────────────────────────────────
 * The client opens /portal/:token (one stable link per brand) and sees ALL the content
 * the agency PUBLISHED for them. Each item opens its review (/review/:token) to approve
 * or comment per clip. Standalone layout; works locally and unchanged once deployed.
 */

import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router";
import { Loader2, Image as ImageIcon, Video, FileText, ArrowUpRight, CheckCircle2, Send, Check } from "lucide-react";
import { getPortal, fetchPortalPlan, createPortalNote, type PortalData, type PortalItem, type PortalPlanItem } from "../lib/api";

const resolveUrl = (u?: string | null) => (u ? (u.startsWith("http") ? u : `http://127.0.0.1:8000${u}`) : "");

const typeMeta: Record<string, { icon: React.ReactNode; label: string }> = {
  image: { icon: <ImageIcon size={12} />, label: "Imagen" },
  video: { icon: <Video size={12} />, label: "Video" },
  copy: { icon: <FileText size={12} />, label: "Copy" },
};

function relativeDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  if (days < 30) return `Hace ${Math.floor(days / 7)} sem`;
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

/** Per-item review state, derived once. */
function itemState(it: PortalItem) {
  const reviewed = it.summary.approved + it.summary.changes;
  const done = it.summary.total > 0 && reviewed >= it.summary.total;
  if (done) {
    return it.summary.changes > 0
      ? { tone: "warning" as const, label: `${it.summary.changes} con cambios`, footer: "Revisado" }
      : { tone: "success" as const, label: "Aprobado", footer: "Revisado" };
  }
  if (reviewed > 0) {
    return { tone: "warning" as const, label: `${reviewed}/${it.summary.total}`, footer: `${reviewed}/${it.summary.total} revisados` };
  }
  return { tone: "neutral" as const, label: null, footer: `${it.summary.total} clips · sin revisar` };
}

export function PortalPage() {
  const { token } = useParams();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // El eje es el PLAN: las campañas que se briefearon. Lo que el cliente escribe es una
  // NOTA para la próxima conversación, no una orden de trabajo.
  const [plan, setPlan] = useState<PortalPlanItem[]>([]);
  const [ask, setAsk] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getPortal(token)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar"))
      .finally(() => setLoading(false));
    fetchPortalPlan(token).then((d) => setPlan(d.campaigns)).catch(() => setPlan([]));
  }, [token]);

  const submitAsk = async () => {
    const text = ask.trim();
    if (!token || !text || sending) return;
    setSending(true); setAskError(null);
    try {
      await createPortalNote(token, text);
      setAsk("");
      setSent(true);
      setTimeout(() => setSent(false), 4000);
    } catch (e) {
      setAskError(e instanceof Error ? e.message : "No se pudo enviar");
    } finally {
      setSending(false);
    }
  };

  const progress = useMemo(() => {
    const items = data?.items || [];
    const reviewed = items.filter((it) => it.summary.total > 0 && it.summary.approved + it.summary.changes >= it.summary.total).length;
    return { total: items.length, reviewed, pct: items.length ? Math.round((reviewed / items.length) * 100) : 0 };
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-canvas)] flex items-center justify-center">
        <Loader2 className="animate-spin text-fg-faint" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen bg-[var(--color-canvas)] flex flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-[15px] text-fg font-medium">{error || "Portal no encontrado"}</p>
        <p className="text-[13px] text-fg-faint">Revisá que el link sea correcto o pedile uno nuevo a tu agencia.</p>
      </div>
    );
  }

  const allDone = progress.total > 0 && progress.reviewed === progress.total;
  // Primera vez: no hay nada publicado ni pedido todavía. En vez de un cartel de "vacío",
  // el portal se presenta y explica en qué consiste. Es lo primero que ve un cliente.
  const firstVisit = data.items.length === 0 && plan.length === 0;

  return (
    <div
      className="min-h-screen bg-[var(--color-canvas)] text-fg"
      // El acento sale de la paleta de la marca cuando la tiene. Sin esto el portal se ve
      // igual para todas — y es lo primero que ve un cliente.
      style={{ ["--accent" as string]: data.accent || "var(--color-action)" }}
    >
      {/* Accent hairline */}
      <div className="h-[2px] w-full" style={{ background: "linear-gradient(to right, var(--accent), color-mix(in srgb, var(--accent) 35%, transparent), transparent)" }} />

      {/* Header */}
      {!firstVisit && (
      <header className="border-b border-edge sticky top-0 bg-[var(--color-canvas)]/85 backdrop-blur-xl z-10">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-5 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-action)]">Portal de contenido</p>
            <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight leading-[1.1] mt-1 truncate">
              {data.brandName || "Tu marca"}
            </h1>
          </div>

          {progress.total > 0 && !firstVisit && (
            <div className="shrink-0 text-right">
              <div className="flex items-center justify-end gap-2">
                {allDone && <CheckCircle2 size={15} className="text-[var(--color-success)]" />}
                <span className="text-[13px] font-semibold tabular-nums">
                  <span className={allDone ? "text-[var(--color-success)]" : "text-fg"}>{progress.reviewed}</span>
                  <span className="text-fg-faint"> / {progress.total}</span>
                </span>
              </div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-fg-faint mt-0.5">revisados</p>
              <div className="mt-2 h-1 w-28 rounded-full bg-surface-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${allDone ? "bg-[var(--color-success)]" : "bg-[var(--color-action)]"}`}
                  style={{ width: `${progress.pct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </header>
      )}

      <main className={firstVisit ? "max-w-[680px] mx-auto px-6 min-h-[calc(100vh-2px)] flex flex-col justify-center py-16" : "max-w-5xl mx-auto px-5 sm:px-8 py-8"}>
        {firstVisit ? (
          <div className="text-center">
            {/* Sin logo cargado, el NOMBRE es la marca. Va en la serif del sistema y
                grande — es el ancla visual de toda la pantalla. */}
            {data.logoUrl && (
              <img
                src={resolveUrl(data.logoUrl)}
                alt={data.brandName}
                className="h-10 w-auto object-contain mx-auto mb-7"
              />
            )}
            <p className="text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: "var(--accent)" }}>
              Espacio de contenido
            </p>
            {!data.logoUrl && (
              <h1 className="font-display text-[42px] sm:text-[56px] font-semibold tracking-[-0.025em] leading-[1.05] mt-3">
                {data.brandName}
              </h1>
            )}
            <p className="text-[15px] text-fg-muted mt-4 max-w-[440px] mx-auto leading-relaxed">
              Acá vas a seguir cada campaña, ver lo que se va produciendo y aprobarlo.
            </p>

            <p className="text-[13px] text-fg-faint mt-8 max-w-[420px] mx-auto leading-relaxed">
              Todavía no hay ninguna campaña arrancada. Cuando definamos la primera,
              la vas a ver acá con todo lo que se vaya produciendo.
            </p>

            {/* Los tres pasos, en voz baja: contexto, no instrucciones. */}
            <div className="grid grid-cols-3 gap-6 mt-14 pt-8 border-t border-edge text-left">
              {[
                { t: "Definimos", d: "Cada campaña arranca con un briefing entre nosotros." },
                { t: "Producimos", d: "Con el material y el estilo de tu marca." },
                { t: "Aprobás", d: "O pedís cambios, las veces que haga falta." },
              ].map((step) => (
                <div key={step.t}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-fg-faint">{step.t}</p>
                  <p className="text-[12.5px] text-fg-muted mt-1.5 leading-relaxed">{step.d}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (<>

        {/* El plan: lo que se acordó trabajar. Cada campaña nace de un briefing. */}
        {plan.length > 0 && (
          <section className="mb-12">
            <h2 className="text-[15px] font-semibold">Tus campañas</h2>
            <p className="text-[13px] text-fg-muted mt-0.5 mb-4">
              Lo que estamos trabajando y en qué anda cada cosa.
            </p>
            <div className="flex flex-col gap-2.5">
              {plan.map((c) => {
                const isTurn = c.state === "Listo para vos";
                const done = c.state === "Aprobado";
                return (
                  <div
                    key={c.id}
                    className={`rounded-[var(--radius-md)] border px-5 py-4 ${
                      isTurn ? "border-[var(--color-warning)] bg-[rgba(228,171,27,.07)]" : "border-edge bg-surface-1"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-medium leading-snug">{c.name}</p>
                        {c.brief && c.brief !== c.name && (
                          <p className="text-[13px] text-fg-muted mt-1 leading-relaxed line-clamp-2">{c.brief}</p>
                        )}
                        <p className="text-[12px] text-fg-faint mt-2">
                          {relativeDate(c.createdAt)}
                          {c.pieces > 0 ? ` · ${c.pieces} ${c.pieces === 1 ? "pieza" : "piezas"}` : ""}
                        </p>
                      </div>
                      <span
                        className={`text-[13px] font-semibold px-3.5 py-1.5 rounded-full shrink-0 whitespace-nowrap ${
                          isTurn
                            ? "bg-[var(--color-warning)] text-black"
                            : done
                              ? "bg-[rgba(61,191,138,.16)] text-[var(--color-success)]"
                              : "bg-surface-2 text-fg-secondary border border-edge"
                        }`}
                      >
                        {c.state}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {data.items.length === 0 ? (firstVisit ? null : (
          <div className="flex flex-col items-center justify-center text-center py-24 gap-3">
            <div className="w-14 h-14 rounded-full bg-surface-1 border border-edge flex items-center justify-center text-fg-faint">
              <ImageIcon size={22} />
            </div>
            <p className="text-[15px] font-medium text-fg">Todavía no hay contenido</p>
            <p className="text-[13px] text-fg-faint max-w-xs">Cuando tu agencia publique algo, lo vas a ver acá listo para revisar.</p>
          </div>
        )) : (
          <>
            <p className="text-[14px] text-fg-muted mb-6 max-w-2xl">
              Estos son los contenidos listos para tu revisión. Abrí cada uno para <span className="text-fg">aprobarlo</span> o <span className="text-fg">pedir cambios</span>.
            </p>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
              {data.items.map((it) => {
                const st = itemState(it);
                const tm = typeMeta[it.type || "image"] || typeMeta.image;
                return (
                  <Link
                    key={it.generationId}
                    to={`/review/${it.token}`}
                    className="group relative bg-surface-1 border border-edge rounded-[var(--radius-lg)] overflow-hidden hover:border-edge-strong transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
                  >
                    {/* Thumbnail */}
                    <div className="aspect-[4/5] bg-surface-2 relative overflow-hidden">
                      {it.thumbnailUrl ? (
                        <img
                          src={resolveUrl(it.thumbnailUrl)}
                          alt={it.title || "Contenido"}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-fg-faint">{tm.icon}</div>
                      )}

                      {/* Scrim for legibility */}
                      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

                      {/* Type chip */}
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-black/55 backdrop-blur text-white/90">
                        {tm.icon}
                        <span className="hidden sm:inline">{tm.label}</span>
                      </div>

                      {/* Status pill */}
                      {st.label && (
                        <div
                          className={`absolute top-2.5 right-2.5 text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur ${
                            st.tone === "success"
                              ? "bg-[var(--color-success)]/90 text-white"
                              : "bg-[var(--color-warning)]/90 text-black"
                          }`}
                        >
                          {st.label}
                        </div>
                      )}

                      {/* Title over scrim */}
                      <div className="absolute inset-x-0 bottom-0 p-3">
                        <p className="text-[13px] font-semibold text-white leading-snug line-clamp-2 drop-shadow">
                          {it.title || "Contenido"}
                        </p>
                      </div>
                    </div>

                    {/* Footer row */}
                    <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p
                          className={`text-[11px] font-medium truncate ${
                            st.tone === "success" ? "text-[var(--color-success)]" : st.tone === "warning" ? "text-[var(--color-warning)]" : "text-fg-faint"
                          }`}
                        >
                          {st.footer}
                        </p>
                        <p className="text-[10px] text-fg-faint">{relativeDate(it.createdAt)}</p>
                      </div>
                      <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-fg-faint bg-surface-2 group-hover:bg-[var(--color-action)] group-hover:text-[var(--color-action-fg)] transition-colors">
                        <ArrowUpRight size={14} />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        </>)}

        {/* Notas — input para la próxima conversación, NO una orden de trabajo.
            El trabajo nace de un briefing; esto evita que lo que se le ocurre al cliente
            se pierda en WhatsApp hasta la próxima reunión. */}
        <section className={firstVisit ? "mt-14 pt-8 border-t border-edge text-left" : "mt-12 pt-8 border-t border-edge"}>
          <h2 className="text-[15px] font-semibold">¿Algo para la próxima?</h2>
          <p className="text-[13px] text-fg-muted mt-0.5 mb-3 max-w-lg leading-relaxed">
            Dejá acá lo que se te ocurra — una idea, algo que viste, algo que hace falta.
            Lo vemos juntos cuando definamos la próxima campaña.
          </p>
          <div className="flex items-start gap-2 max-w-2xl">
            <textarea
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitAsk(); }}
              rows={2}
              placeholder="Ej: me gustaría probar algo en exterior para la cápsula de lino"
              className="flex-1 bg-surface-1 border border-edge rounded-[var(--radius-md)] px-4 py-3 text-[14px] outline-none resize-none placeholder:text-fg-faint focus:border-[var(--color-edge-focus)] transition-colors"
            />
            <button
              onClick={submitAsk}
              disabled={!ask.trim() || sending}
              className="h-11 px-4 rounded-[var(--radius-md)] text-[13px] font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-default"
              style={{ background: "var(--accent)", color: "#000" }}
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar
            </button>
          </div>
          {sent && (
            <p className="flex items-center gap-1.5 text-[13px] text-[var(--color-success)] mt-2">
              <Check size={13} /> Anotado. Lo charlamos en la próxima.
            </p>
          )}
          {askError && <p className="text-[13px] text-[var(--color-error)] mt-2">{askError}</p>}
        </section>

        <footer className="mt-12 pt-6 border-t border-edge flex items-center justify-between gap-3">
          <p className="text-[11px] text-fg-faint">Tu feedback se guarda automáticamente.</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-fg-faint">
            Hecho con <span className="text-fg-muted font-semibold">Coevo Studio</span>
          </p>
        </footer>
      </main>
    </div>
  );
}
