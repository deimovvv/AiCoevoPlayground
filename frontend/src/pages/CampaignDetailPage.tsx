import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, Loader2, Trash2, Sparkles, Image as ImageIcon } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import { getCampaign, deleteCampaign, productImageUrl, moodboardImageUrl, type Campaign } from "../lib/api";
import { cn } from "../lib/utils";

const STATUS_LABEL: Record<Campaign["status"], { label: string; cls: string }> = {
  draft: { label: "Borrador", cls: "bg-surface-2 text-fg-muted" },
  generating: { label: "Generando", cls: "bg-[var(--color-action-muted)] text-[var(--color-action)]" },
  review: { label: "En revisión", cls: "bg-[var(--color-brand-subtle)] text-[var(--color-brand)]" },
  approved: { label: "Aprobada", cls: "bg-green-500/15 text-green-400" },
};

export function CampaignDetailPage() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const { activeBrand } = useBrand();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true); setError(null);
    try { setCampaign(await getCampaign(campaignId)); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo cargar"); }
    finally { setLoading(false); }
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!campaign) return;
    if (!confirm(`¿Borrar la campaña "${campaign.name}"? No se puede deshacer.`)) return;
    try { await deleteCampaign(campaign.id); navigate("/dashboard/campaigns"); }
    catch { alert("No se pudo borrar."); }
  };

  if (loading) return <div className="flex items-center gap-2 text-fg-muted text-[13px] py-16 justify-center"><Loader2 size={16} className="animate-spin" /> Cargando…</div>;
  if (error || !campaign) return <div className="p-10 text-center text-fg-muted">{error || "Campaña no encontrada"} · <button onClick={() => navigate("/dashboard/campaigns")} className="text-[var(--color-brand)] cursor-pointer">Volver</button></div>;

  const st = STATUS_LABEL[campaign.status] || STATUS_LABEL.draft;
  const products = (activeBrand?.products || []).filter((p) => campaign.productIds.includes(p.id));
  const moodboard = (activeBrand?.moodboards || []).find((m) => m.id === campaign.moodboardId);

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8">
      <button onClick={() => navigate("/dashboard/campaigns")} className="flex items-center gap-1.5 text-[12px] text-fg-faint hover:text-fg mb-4 cursor-pointer"><ArrowLeft size={14} /> Campañas</button>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight">{campaign.name}</h1>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", st.cls)}>{st.label}</span>
            <span className="text-[11px] text-fg-faint">{activeBrand?.name}</span>
          </div>
        </div>
        <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 h-9 rounded-full border border-edge text-[12px] text-fg-muted hover:text-red-400 hover:border-red-400/40 cursor-pointer"><Trash2 size={13} /> Borrar</button>
      </div>

      {/* Settings resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="md:col-span-2 rounded-[var(--radius-md)] border border-edge bg-surface-0 p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-fg-faint mb-3">Setup de la campaña</h3>
          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[12px]">
            <Row label="Shot list" value={campaign.shotPlan === "ai" ? "Que decida la IA" : "Estilos elegidos"} />
            <Row label="Variantes por toma" value={String(campaign.variationsPerShot)} />
            <Row label="Formatos" value={campaign.aspectRatios.join(" · ")} />
            <Row label="Resolución" value={campaign.resolution} />
          </div>
          {/* Productos */}
          <div className="mt-4">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-fg-faint">Producto(s)</span>
            {products.length === 0 ? <p className="text-[11px] text-fg-faint mt-1">Sin producto asignado.</p> : (
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                {products.map((p) => (
                  <div key={p.id} className="w-14 flex flex-col items-center gap-0.5">
                    <div className="w-14 h-14 rounded overflow-hidden border border-edge bg-surface-2">{p.imageUrl && <img src={productImageUrl(p.imageUrl)} alt={p.name} className="w-full h-full object-cover" />}</div>
                    <span className="text-[8px] text-fg-faint truncate max-w-[56px]">{p.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Moodboard */}
        <div className="rounded-[var(--radius-md)] border border-edge bg-surface-0 p-4">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-fg-faint">Moodboard</span>
          {moodboard?.imageUrl ? (
            <img src={moodboardImageUrl(moodboard.imageUrl)} alt={moodboard.name} className="w-full aspect-square object-cover rounded-[var(--radius-sm)] mt-2 border border-edge" />
          ) : <p className="text-[11px] text-fg-faint mt-2">Sin moodboard.</p>}
        </div>
      </div>

      {/* Piezas */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[16px] font-bold">Piezas</h3>
        <button
          onClick={() => navigate("/dashboard/generate")}
          className="flex items-center gap-1.5 px-4 h-9 rounded-full bg-[var(--color-brand)] text-[var(--color-brand-fg)] text-[12px] font-semibold hover:opacity-90 cursor-pointer"
        >
          <Sparkles size={13} /> Generar piezas
        </button>
      </div>
      <div className="border border-dashed border-edge rounded-[var(--radius-md)] p-10 text-center">
        <ImageIcon size={26} className="mx-auto text-fg-faint mb-2" />
        <p className="text-[13px] text-fg-muted">Todavía no hay piezas en esta campaña.</p>
        <p className="text-[11px] text-fg-faint mt-1">El pipeline con checkpoint (imágenes → aprobar → video + voz) llega en la próxima iteración. Por ahora, generá en las tools y las vinculamos a la campaña.</p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] uppercase tracking-wide text-fg-faint">{label}</span>
      <span className="text-fg">{value}</span>
    </div>
  );
}
