/**
 * PortalPage — el espacio del cliente. Público, sin auth (link mágico por persona).
 * ─────────────────────────────────────────────────────────────────────────────────
 * DELIBERADAMENTE CLARO, al revés que la app interna. El negro con acento naranja es el
 * lenguaje de la consola donde trabajamos nosotros; al cliente le estamos entregando algo,
 * y un espacio claro y editorial lee como una entrega, no como un panel de admin. Además
 * las fotos de ropa respiran mejor sobre claro.
 *
 * Reglas de color (lo que se veía feo antes era exactamente esto):
 *   · La acción principal es TINTA, no color.
 *   · El estado se dice con texto + un punto, no con pastillas saturadas.
 *   · El color de la marca aparece en UNA sola cosa: lo que le toca al cliente.
 *
 * Los grises tienen sesgo cálido a propósito: sobre gris frío, la piel y los tonos tierra
 * de la ropa se ven verdosos.
 */

import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router";
import { Loader2, Upload, ArrowLeft, Check } from "lucide-react";
import { getPortal, fetchPortalPlan, uploadPortalPieces } from "../lib/api";
import type { PortalData, PortalItem, PortalPlanItem } from "../lib/api";

const API = "http://127.0.0.1:8000";
const resolveUrl = (u?: string | null) => (u ? (u.startsWith("http") ? u : `${API}${u}`) : "");

/** Paleta del portal. Explícita y no tokenizada: esta pantalla NO sigue el tema de la app. */
const C = {
  bg: "#faf8f6",
  panel: "#f2efec",
  card: "#ffffff",
  ink: "#1a1817",
  ink2: "#6b6560",
  ink3: "#9c948d",
  line: "#e4dfda",
  ok: "#3f8f6d",
  err: "#b4453f",
};

type Section = "campaigns" | "review" | "reviewed";

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

/** ¿Ya la miró? Decide en qué sección cae y cómo se muestra. */
function itemState(it: PortalItem): "turn" | "done" | "changes" {
  const reviewed = it.summary.approved + it.summary.changes;
  if (it.summary.total > 0 && reviewed >= it.summary.total) {
    return it.summary.changes > 0 ? "changes" : "done";
  }
  return "turn";
}

/** Estado en una línea: un punto y una palabra. Sin pastillas peleándose. */
function Status({ tone, label, accent }: { tone: "turn" | "done" | "neutral"; label?: string; accent: string }) {
  const dot = tone === "turn" ? accent : tone === "done" ? C.ok : C.ink3;
  return (
    <span
      className="inline-flex items-center gap-2 text-[12px] whitespace-nowrap"
      style={{ color: tone === "turn" ? accent : C.ink2, fontWeight: tone === "turn" ? 600 : 400 }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot }} />
      {label}
    </span>
  );
}

export function PortalPage() {
  const { token } = useParams();
  const [data, setData] = useState<PortalData | null>(null);
  const [plan, setPlan] = useState<PortalPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /**
   * Sección inicial. NO es fija: si hay algo esperando al cliente, el portal abre ahí.
   * Abrir siempre en "Campañas" dejaba lo único accionable escondido a un click —
   * reportado por el usuario: "¿dónde apruebo? no entiendo esa parte".
   */
  const [section, setSection] = useState<Section | null>(null);
  /** Campaña abierta. Estado local y no ruta: el portal es una sola página. */
  const [openId, setOpenId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([getPortal(token), fetchPortalPlan(token)])
      .then(([d, p]) => { setData(d); setPlan(p.campaigns); })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar"))
      .finally(() => setLoading(false));
  }, [token]);

  const items = data?.items || [];
  const toReview = useMemo(() => items.filter((it) => itemState(it) === "turn"), [items]);
  const done = useMemo(() => items.filter((it) => itemState(it) !== "turn"), [items]);

  // Prioridad: lo que espera al cliente → el plan → lo ya revisado.
  const initialSection: Section =
    toReview.length > 0 ? "review" : plan.length > 0 ? "campaigns" : done.length > 0 ? "reviewed" : "campaigns";
  const active: Section = section ?? initialSection;

  const open = plan.find((c) => c.id === openId) || null;

  const handleUpload = async (files: FileList | null) => {
    if (!token || !open || !files?.length) return;
    setUploading(true); setUploadError(null);
    try {
      await uploadPortalPieces(token, open.id, Array.from(files));
      const p = await fetchPortalPlan(token);
      setPlan(p.campaigns);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "No se pudo subir");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
        <Loader2 className="animate-spin" style={{ color: C.ink3 }} />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-2 px-6 text-center" style={{ background: C.bg, color: C.ink }}>
        <p className="text-[15px] font-medium">{error || "Portal no encontrado"}</p>
        <p className="text-[13px]" style={{ color: C.ink3 }}>Revisá que el link sea correcto o pedile uno nuevo a tu agencia.</p>
      </div>
    );
  }

  // El acento de la marca. Se usa en UNA cosa: señalar lo que le toca al cliente.
  const accent = data.accent || "#8a5a3c";

  const NAV: Array<{ key: Section; label: string; count: number }> = [
    { key: "campaigns", label: "Campañas", count: plan.length },
    { key: "review", label: "Para revisar", count: toReview.length },
    // "Revisado" y no "Aprobado": acá caen tanto las aprobadas como las que pidió cambiar.
    { key: "reviewed", label: "Revisado", count: done.length },
  ];

  const cardCls = "rounded-[8px] overflow-hidden block";
  const cardStyle = { background: C.card, border: `1px solid ${C.line}` };

  return (
    <div className="min-h-screen flex" style={{ background: C.bg, color: C.ink }}>
      {/* ── Sidebar ── */}
      <aside
        className="w-[236px] shrink-0 px-5 py-7 flex flex-col"
        style={{ background: C.panel, borderRight: `1px solid ${C.line}` }}
      >
        <div>
          {data.logoUrl ? (
            <img src={resolveUrl(data.logoUrl)} alt={data.brandName} className="h-8 w-auto object-contain" />
          ) : (
            <p className="font-display text-[22px] leading-tight tracking-[-.01em]">{data.brandName}</p>
          )}
          <p className="text-[9px] font-mono uppercase tracking-[.16em] mt-2" style={{ color: C.ink3 }}>
            Espacio de contenido
          </p>
        </div>

        <nav className="mt-8 flex flex-col gap-[2px]">
          {NAV.map((n) => {
            const on = active === n.key && !open;
            return (
              <button
                key={n.key}
                onClick={() => { setSection(n.key); setOpenId(null); }}
                className="flex items-center gap-2 px-2.5 py-2 rounded-[7px] text-[13px] text-left cursor-pointer transition-colors"
                style={{
                  background: on ? C.card : "transparent",
                  color: on ? C.ink : C.ink2,
                  fontWeight: on ? 500 : 400,
                  boxShadow: on ? "0 1px 2px rgba(0,0,0,.04)" : "none",
                }}
              >
                {n.label}
                <span
                  className="ml-auto text-[11px] font-mono"
                  style={{ color: n.key === "review" && n.count > 0 ? accent : C.ink3 }}
                >
                  {n.count}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto pt-5 text-[11.5px] leading-relaxed" style={{ borderTop: `1px solid ${C.line}`, color: C.ink3 }}>
          <b className="block text-[12px] font-medium" style={{ color: C.ink2 }}>Coevo Studio</b>
          Tu equipo de contenido
        </div>
      </aside>

      {/* ── Contenido ── */}
      <main className="flex-1 min-w-0 px-10 py-8 max-w-[1100px]">
        {open ? (
          <>
            <button
              onClick={() => setOpenId(null)}
              className="flex items-center gap-1.5 text-[12px] cursor-pointer mb-5"
              style={{ color: C.ink3 }}
            >
              <ArrowLeft size={12} /> Campañas
            </button>
            <h1 className="font-display text-[30px] tracking-[-.015em]">{open.name}</h1>
            {open.brief && open.brief !== open.name && (
              <p className="text-[13.5px] mt-2 max-w-[56ch] leading-relaxed" style={{ color: C.ink2 }}>{open.brief}</p>
            )}
            <div className="my-7" style={{ height: 1, background: C.line }} />

            {uploadError && <p className="text-[12.5px] mb-3" style={{ color: C.err }}>{uploadError}</p>}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
              {open.items.map((it) => {
                const st = itemState(it);
                return (
                  <Link key={it.generationId} to={`/review/${it.token}`} className={cardCls} style={cardStyle}>
                    <div className="aspect-[3/4]" style={{ background: "#e8e2db" }}>
                      {it.thumbnailUrl && <img src={resolveUrl(it.thumbnailUrl)} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="px-2.5 py-2 flex items-center gap-2">
                      <span className="text-[11.5px] truncate" style={{ color: C.ink2 }}>{it.title}</span>
                      <span className="ml-auto shrink-0">
                        <Status tone={st === "turn" ? "turn" : st === "done" ? "done" : "neutral"} accent={accent} />
                      </span>
                    </div>
                  </Link>
                );
              })}

              {open.pieces.map((p) => (
                <div key={p.id} className="rounded-[8px] overflow-hidden" style={cardStyle}>
                  <div className="aspect-[3/4]" style={{ background: "#e8e2db" }}>
                    {p.type === "video" ? (
                      <video
                        src={resolveUrl(p.url)}
                        className="w-full h-full object-cover"
                        muted loop playsInline
                        onMouseEnter={(e) => void (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
                        onMouseLeave={(e) => (e.currentTarget as HTMLVideoElement).pause()}
                      />
                    ) : (
                      <img src={resolveUrl(p.url)} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="px-2.5 py-2">
                    <span className="text-[11.5px] truncate block" style={{ color: C.ink2 }}>{p.label || "Material"}</span>
                  </div>
                </div>
              ))}

              {/* Subir — una celda más, donde se usa. Sirve para las dos puntas. */}
              <label
                className="aspect-[3/4] rounded-[8px] flex flex-col items-center justify-center gap-1.5 text-center px-4 cursor-pointer"
                style={{ border: `1px dashed ${C.line}`, color: C.ink3 }}
              >
                <input
                  type="file"
                  multiple
                  accept="video/*,image/*"
                  className="hidden"
                  onChange={(e) => { handleUpload(e.target.files); e.target.value = ""; }}
                />
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                <b className="text-[12.5px] font-medium" style={{ color: C.ink2 }}>
                  {uploading ? "Subiendo…" : "Subir material"}
                </b>
                <span className="text-[11.5px] leading-snug">Un video o una foto que ya tengas</span>
              </label>
            </div>
          </>
        ) : active === "campaigns" ? (
          <>
            <h1 className="font-display text-[30px] tracking-[-.015em]">Campañas</h1>
            <p className="text-[13.5px] mt-1.5 max-w-[56ch]" style={{ color: C.ink2 }}>
              Lo que estamos trabajando ahora. Cada una arranca con un briefing entre nosotros.
            </p>
            <div className="my-7" style={{ height: 1, background: C.line }} />

            {plan.length === 0 ? (
              <>
                <p className="text-[13.5px] max-w-[46ch] leading-relaxed" style={{ color: C.ink2 }}>
                  Todavía no hay ninguna campaña arrancada. Cuando definamos la primera, la vas a ver
                  acá con todo lo que se vaya produciendo.
                </p>
                {/* Un vacío no puede ser un callejón sin salida: si hay algo esperándolo,
                    se lo decimos acá mismo. */}
                {toReview.length > 0 && (
                  <button
                    onClick={() => setSection("review")}
                    className="mt-5 text-[13.5px] font-semibold cursor-pointer underline underline-offset-4 block text-left"
                    style={{ color: accent }}
                  >
                    Mientras tanto, tenés {toReview.length}{" "}
                    {toReview.length === 1 ? "entrega esperando tu revisión" : "entregas esperando tu revisión"} →
                  </button>
                )}
              </>
            ) : (
              plan.map((c) => {
                const pending = c.items.filter((it) => itemState(it) === "turn").length;
                return (
                  <button
                    key={c.id}
                    onClick={() => setOpenId(c.id)}
                    className="w-full flex items-start gap-5 py-5 text-left cursor-pointer"
                    style={{ borderBottom: `1px solid ${C.line}` }}
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-[19px] tracking-[-.01em]">{c.name}</h3>
                      {c.brief && c.brief !== c.name && (
                        <p className="text-[13px] mt-1.5 max-w-[52ch] leading-relaxed" style={{ color: C.ink2 }}>{c.brief}</p>
                      )}
                      <p className="text-[11.5px] mt-2" style={{ color: C.ink3 }}>{relativeDate(c.createdAt)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2.5 shrink-0">
                      {pending > 0
                        ? <Status tone="turn" label={`Te toca revisar ${pending}`} accent={accent} />
                        : <Status tone={c.state === "Aprobado" ? "done" : "neutral"} label={c.state} accent={accent} />}
                      <span className="text-[11px] font-mono" style={{ color: C.ink3 }}>
                        {c.pieceCount} {c.pieceCount === 1 ? "pieza" : "piezas"}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </>
        ) : (
          <>
            <h1 className="font-display text-[30px] tracking-[-.015em]">
              {active === "review" ? "Para revisar" : "Revisado"}
            </h1>
            <p className="text-[13.5px] mt-1.5 max-w-[56ch]" style={{ color: C.ink2 }}>
              {active === "review"
                ? "Abrí cada una, mirala en grande y decidí si sale así o querés un cambio."
                : "Lo que ya miraste. Queda acá para que lo tengas a mano."}
            </p>
            <div className="my-7" style={{ height: 1, background: C.line }} />

            {(active === "review" ? toReview : done).length === 0 ? (
              <p className="text-[13.5px]" style={{ color: C.ink2 }}>
                {active === "review" ? "No hay nada esperándote. Todo al día." : "Todavía no revisaste nada."}
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
                {(active === "review" ? toReview : done).map((it) => {
                  const st = itemState(it);
                  return (
                    <Link key={it.generationId} to={`/review/${it.token}`} className={cardCls} style={cardStyle}>
                      <div className="aspect-[3/4]" style={{ background: "#e8e2db" }}>
                        {it.thumbnailUrl && <img src={resolveUrl(it.thumbnailUrl)} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="px-2.5 py-2">
                        <span className="text-[11.5px] truncate block" style={{ color: C.ink2 }}>{it.title}</span>
                        <span className="mt-1 block">
                          {st === "turn"
                            ? <Status tone="turn" label="Revisar →" accent={accent} />
                            : st === "changes"
                              ? <Status tone="neutral" label="Pediste cambios" accent={accent} />
                              : <Status tone="done" label="Aprobado" accent={accent} />}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}

        <p className="mt-14 pt-5 text-[11.5px] flex items-center gap-1.5" style={{ borderTop: `1px solid ${C.line}`, color: C.ink3 }}>
          <Check size={11} /> Todo lo que marcás se guarda solo.
        </p>
      </main>
    </div>
  );
}
