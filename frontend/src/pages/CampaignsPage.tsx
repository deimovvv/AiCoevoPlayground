import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { Megaphone, Plus, Loader2, ArrowRight } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import { listCampaigns, type Campaign } from "../lib/api";
import { cn } from "../lib/utils";

const STATUS_LABEL: Record<Campaign["status"], { label: string; cls: string }> = {
  draft: { label: "Borrador", cls: "bg-surface-2 text-fg-muted" },
  generating: { label: "Generando", cls: "bg-[var(--color-action-muted)] text-[var(--color-action)]" },
  review: { label: "En revisión", cls: "bg-[var(--color-brand-subtle)] text-[var(--color-brand)]" },
  approved: { label: "Aprobada", cls: "bg-green-500/15 text-green-400" },
};

export function CampaignsPage() {
  const navigate = useNavigate();
  const { activeBrand } = useBrand();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeBrand) { setCampaigns([]); setLoading(false); return; }
    setLoading(true);
    try { setCampaigns(await listCampaigns(activeBrand.id)); }
    finally { setLoading(false); }
  }, [activeBrand]);

  useEffect(() => { load(); }, [load]);

  if (!activeBrand) {
    return <div className="p-10 text-center text-fg-muted text-[14px]">Elegí una marca en el switcher para ver sus campañas.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 font-display text-[24px] font-semibold tracking-tight">
            <Megaphone size={20} className="text-[var(--color-brand)]" /> Campañas
          </div>
          <p className="text-[12px] text-fg-faint mt-0.5">Marca: <span className="text-fg-muted">{activeBrand.name}</span></p>
        </div>
        <button onClick={() => navigate("/dashboard/campaigns/new")}
          className="flex items-center gap-1.5 px-4 h-10 rounded-full bg-[var(--color-brand)] text-[var(--color-brand-fg)] text-[13px] font-semibold hover:opacity-90 cursor-pointer">
          <Plus size={15} /> Nueva campaña
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-fg-muted text-[13px] py-10 justify-center"><Loader2 size={16} className="animate-spin" /> Cargando…</div>
      ) : campaigns.length === 0 ? (
        <div className="border border-dashed border-edge rounded-[var(--radius-md)] p-10 text-center">
          <Megaphone size={28} className="mx-auto text-fg-faint mb-3" />
          <p className="text-[14px] text-fg-muted">Todavía no hay campañas para {activeBrand.name}.</p>
          <p className="text-[12px] text-fg-faint mt-1">Creá una para trabajar contenido de punta a punta.</p>
          <button onClick={() => navigate("/dashboard/campaigns/new")} className="mt-4 inline-flex items-center gap-1.5 px-4 h-9 rounded-full bg-[var(--color-brand)] text-[var(--color-brand-fg)] text-[12px] font-semibold cursor-pointer"><Plus size={13} /> Nueva campaña</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {campaigns.map((c) => {
            const st = STATUS_LABEL[c.status] || STATUS_LABEL.draft;
            return (
              <button key={c.id} onClick={() => navigate(`/dashboard/campaigns/${c.id}`)}
                className="group text-left rounded-[var(--radius-md)] border border-edge bg-surface-0 p-4 hover:border-[var(--color-brand)] transition-colors cursor-pointer">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[15px] font-semibold leading-tight">{c.name}</h3>
                  <ArrowRight size={15} className="text-fg-faint group-hover:text-[var(--color-brand)] shrink-0 mt-0.5" />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", st.cls)}>{st.label}</span>
                  <span className="text-[10px] text-fg-faint">{c.pieces?.length || 0} pieza{(c.pieces?.length || 0) === 1 ? "" : "s"}</span>
                  <span className="text-[10px] text-fg-faint">· {c.aspectRatios.join(" · ")}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
