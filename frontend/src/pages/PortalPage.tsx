/**
 * PortalPage — public, no-auth client portal (per brand).
 * ─────────────────────────────────────────────────────────────
 * The client opens /portal/:token (one stable link per brand) and sees ALL the content
 * the agency PUBLISHED for them. Each item opens its review (/review/:token) to approve
 * or comment per clip. Standalone layout; works locally and unchanged once deployed.
 */

import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router";
import { Loader2, Image as ImageIcon, Video, FileText, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { getPortal, type PortalData, type PortalItem } from "../lib/api";

const resolveUrl = (u?: string | null) => (u ? (u.startsWith("http") ? u : `http://localhost:8000${u}`) : "");

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

  useEffect(() => {
    if (!token) return;
    getPortal(token)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar"))
      .finally(() => setLoading(false));
  }, [token]);

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

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-fg">
      {/* Accent hairline */}
      <div className="h-[2px] w-full bg-gradient-to-r from-[var(--color-action)] via-[var(--color-action)]/40 to-transparent" />

      {/* Header */}
      <header className="border-b border-edge sticky top-0 bg-[var(--color-canvas)]/85 backdrop-blur-xl z-10">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-5 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-action)]">Portal de contenido</p>
            <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight leading-[1.1] mt-1 truncate">
              {data.brandName || "Tu marca"}
            </h1>
          </div>

          {progress.total > 0 && (
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

      <main className="max-w-5xl mx-auto px-5 sm:px-8 py-8">
        {data.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-24 gap-3">
            <div className="w-14 h-14 rounded-full bg-surface-1 border border-edge flex items-center justify-center text-fg-faint">
              <ImageIcon size={22} />
            </div>
            <p className="text-[15px] font-medium text-fg">Todavía no hay contenido</p>
            <p className="text-[13px] text-fg-faint max-w-xs">Cuando tu agencia publique algo, lo vas a ver acá listo para revisar.</p>
          </div>
        ) : (
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
