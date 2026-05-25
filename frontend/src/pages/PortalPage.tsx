/**
 * PortalPage — public, no-auth client portal (per brand).
 * ─────────────────────────────────────────────────────────────
 * The client opens /portal/:token (one stable link per brand) and sees ALL the content
 * the agency PUBLISHED for them. Each item opens its review (/review/:token) to approve
 * or comment per clip. Standalone layout; works locally and unchanged once deployed.
 */

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import { Loader2, Image as ImageIcon, Video, FileText, ChevronRight } from "lucide-react";
import { getPortal, type PortalData } from "../lib/api";

const resolveUrl = (u?: string | null) => (u ? (u.startsWith("http") ? u : `http://localhost:8000${u}`) : "");
const typeIcon: Record<string, React.ReactNode> = {
  image: <ImageIcon size={16} />,
  video: <Video size={16} />,
  copy: <FileText size={16} />,
};

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

  if (loading) return <div className="min-h-screen bg-[var(--color-canvas)] flex items-center justify-center"><Loader2 className="animate-spin text-fg-muted" /></div>;
  if (error || !data) return <div className="min-h-screen bg-[var(--color-canvas)] flex items-center justify-center text-fg-muted text-[14px]">{error || "Portal no encontrado"}</div>;

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-fg">
      <div className="border-b border-edge sticky top-0 bg-[var(--color-canvas)]/95 backdrop-blur z-10">
        <div className="max-w-4xl mx-auto px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-action)]">Portal de contenido</p>
          <h1 className="text-[20px] font-bold tracking-tight leading-tight">{data.brandName || "Tu marca"}</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-5 py-6 space-y-4">
        {data.items.length === 0 ? (
          <p className="text-[14px] text-fg-muted text-center py-16">Todavía no hay contenido publicado para revisar.</p>
        ) : (
          <>
            <p className="text-[13px] text-fg-muted">Estos son los contenidos listos para tu revisión. Abrí cada uno para aprobarlo o pedir cambios.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.items.map((it) => {
                const reviewed = it.summary.approved + it.summary.changes;
                const done = reviewed >= it.summary.total && it.summary.total > 0;
                return (
                  <Link
                    key={it.generationId}
                    to={`/review/${it.token}`}
                    className="group bg-surface-1 border border-edge rounded-[var(--radius-md)] overflow-hidden hover:border-[var(--color-action)] transition-colors"
                  >
                    <div className="aspect-[16/10] bg-surface-2 flex items-center justify-center text-fg-faint relative overflow-hidden">
                      {it.thumbnailUrl ? (
                        <img src={resolveUrl(it.thumbnailUrl)} alt={it.title} className="w-full h-full object-cover" />
                      ) : (typeIcon[it.type || "image"] || <ImageIcon size={16} />)}
                      {reviewed > 0 && (
                        <div className={`absolute top-2 left-2 text-[9px] font-semibold px-1.5 py-0.5 rounded-full backdrop-blur ${it.summary.changes > 0 ? "bg-[var(--color-warning)]/90 text-black" : "bg-[var(--color-success)]/90 text-white"}`}>
                          {it.summary.approved}✓{it.summary.changes > 0 ? ` · ${it.summary.changes}✎` : ""}
                        </div>
                      )}
                    </div>
                    <div className="p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-fg truncate">{it.title || "Contenido"}</p>
                        <p className="text-[11px] text-fg-faint">
                          {done ? "Revisado" : reviewed > 0 ? `${reviewed}/${it.summary.total} revisados` : `${it.summary.total} clips · sin revisar`}
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-fg-faint group-hover:text-[var(--color-action)] shrink-0" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
        <p className="text-[11px] text-fg-faint text-center py-4">Tu feedback se guarda automáticamente.</p>
      </div>
    </div>
  );
}
