import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { Megaphone, Plus, Loader2, X, Check, ArrowRight } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import { listCampaigns, createCampaign, productImageUrl, moodboardImageUrl, type Campaign } from "../lib/api";
import { cn } from "../lib/utils";

const STATUS_LABEL: Record<Campaign["status"], { label: string; cls: string }> = {
  draft: { label: "Borrador", cls: "bg-surface-2 text-fg-muted" },
  generating: { label: "Generando", cls: "bg-[var(--color-action-muted)] text-[var(--color-action)]" },
  review: { label: "En revisión", cls: "bg-[var(--color-brand-subtle)] text-[var(--color-brand)]" },
  approved: { label: "Aprobada", cls: "bg-green-500/15 text-green-400" },
};

const AR_OPTIONS = ["9:16", "16:9", "1:1", "4:5"];
const RES_OPTIONS = ["1K", "2K", "4K"];

export function CampaignsPage() {
  const navigate = useNavigate();
  const { activeBrand } = useBrand();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    if (!activeBrand) { setCampaigns([]); setLoading(false); return; }
    setLoading(true);
    try { setCampaigns(await listCampaigns(activeBrand.id)); }
    finally { setLoading(false); }
  }, [activeBrand]);

  useEffect(() => { load(); }, [load]);

  if (!activeBrand) {
    return (
      <div className="p-10 text-center text-fg-muted text-[14px]">
        Elegí una marca en el switcher para ver sus campañas.
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-[22px] font-bold tracking-tight">
            <Megaphone size={20} className="text-[var(--color-brand)]" /> Campañas
          </div>
          <p className="text-[12px] text-fg-faint mt-0.5">Marca: <span className="text-fg-muted">{activeBrand.name}</span></p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 h-10 rounded-full bg-[var(--color-brand)] text-[var(--color-brand-fg)] text-[13px] font-semibold hover:opacity-90 cursor-pointer"
        >
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
          <button onClick={() => setShowForm(true)} className="mt-4 inline-flex items-center gap-1.5 px-4 h-9 rounded-full bg-[var(--color-brand)] text-[var(--color-brand-fg)] text-[12px] font-semibold cursor-pointer"><Plus size={13} /> Nueva campaña</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {campaigns.map((c) => {
            const st = STATUS_LABEL[c.status] || STATUS_LABEL.draft;
            return (
              <button
                key={c.id}
                onClick={() => navigate(`/dashboard/campaigns/${c.id}`)}
                className="group text-left rounded-[var(--radius-md)] border border-edge bg-surface-0 p-4 hover:border-[var(--color-brand)] transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[15px] font-semibold leading-tight">{c.name}</h3>
                  <ArrowRight size={15} className="text-fg-faint group-hover:text-[var(--color-brand)] shrink-0 mt-0.5" />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", st.cls)}>{st.label}</span>
                  <span className="text-[10px] text-fg-faint">{c.productIds.length} producto{c.productIds.length === 1 ? "" : "s"}</span>
                  <span className="text-[10px] text-fg-faint">· {c.aspectRatios.join(" · ")}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showForm && (
        <NewCampaignForm
          onClose={() => setShowForm(false)}
          onCreated={(c) => { setShowForm(false); navigate(`/dashboard/campaigns/${c.id}`); }}
        />
      )}
    </div>
  );
}

function NewCampaignForm({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Campaign) => void }) {
  const { activeBrand } = useBrand();
  const [name, setName] = useState("");
  const [productIds, setProductIds] = useState<string[]>([]);
  const [moodboardId, setMoodboardId] = useState<string | null>(null);
  const [shotPlan, setShotPlan] = useState<"ai" | "manual">("ai");
  const [variationsPerShot, setVariationsPerShot] = useState(2);
  const [aspectRatios, setAspectRatios] = useState<string[]>(["9:16"]);
  const [resolution, setResolution] = useState("2K");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const products = activeBrand?.products || [];
  const moodboards = activeBrand?.moodboards || [];

  const toggleAR = (ar: string) => setAspectRatios((p) => p.includes(ar) ? p.filter((x) => x !== ar) : [...p, ar]);

  const submit = async () => {
    if (!activeBrand) return;
    setSaving(true); setError(null);
    try {
      const c = await createCampaign({
        brandId: activeBrand.id,
        name: name.trim() || "Campaña sin nombre",
        productIds, moodboardId, shotPlan, variationsPerShot,
        aspectRatios: aspectRatios.length ? aspectRatios : ["9:16"],
        resolution,
      });
      onCreated(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la campaña");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface-0 border border-edge rounded-[var(--radius-lg)] w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold">Nueva campaña</h2>
          <button onClick={onClose} className="text-fg-faint hover:text-fg cursor-pointer"><X size={16} /></button>
        </div>

        <div>
          <label className="text-[11px] font-medium text-fg-muted">Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder='ej: "Campaña Auto — Verano"'
            className="mt-1 w-full h-9 px-3 rounded-[var(--radius-sm)] border border-edge bg-surface-1 text-[13px] outline-none focus:border-[var(--color-brand)]" />
        </div>

        {/* Producto */}
        <div>
          <label className="text-[11px] font-medium text-fg-muted">Producto(s)</label>
          {products.length === 0 ? (
            <p className="text-[11px] text-fg-faint mt-1">Esta marca no tiene productos cargados. Cargalos en el Brand Kit.</p>
          ) : (
            <div className="grid grid-cols-4 gap-1.5 mt-1.5">
              {products.map((p) => {
                const on = productIds.includes(p.id);
                return (
                  <button key={p.id} type="button" onClick={() => setProductIds((prev) => on ? prev.filter((x) => x !== p.id) : [...prev, p.id])}
                    className={cn("relative border-2 rounded-[var(--radius-sm)] p-0.5 cursor-pointer", on ? "border-[var(--color-brand)]" : "border-edge opacity-70 hover:opacity-100")}>
                    <div className="aspect-square rounded overflow-hidden bg-surface-2">
                      {p.imageUrl && <img src={productImageUrl(p.imageUrl)} alt={p.name} className="w-full h-full object-cover" />}
                    </div>
                    {on && <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-[var(--color-brand)] text-white flex items-center justify-center"><Check size={9} /></span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Moodboard */}
        {moodboards.length > 0 && (
          <div>
            <label className="text-[11px] font-medium text-fg-muted">Moodboard (look de la escena)</label>
            <div className="grid grid-cols-5 gap-1.5 mt-1.5">
              <button type="button" onClick={() => setMoodboardId(null)}
                className={cn("aspect-square rounded-[var(--radius-sm)] border-2 flex items-center justify-center text-[9px] text-fg-faint cursor-pointer", moodboardId === null ? "border-[var(--color-brand)] text-fg" : "border-edge")}>Ninguno</button>
              {moodboards.map((m) => (
                <button key={m.id} type="button" onClick={() => setMoodboardId(m.id)}
                  className={cn("aspect-square rounded-[var(--radius-sm)] border-2 overflow-hidden cursor-pointer", moodboardId === m.id ? "border-[var(--color-brand)]" : "border-edge opacity-70 hover:opacity-100")}>
                  {m.imageUrl && <img src={moodboardImageUrl(m.imageUrl)} alt={m.name} className="w-full h-full object-cover" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Shot list */}
        <div>
          <label className="text-[11px] font-medium text-fg-muted">Shot list</label>
          <div className="grid grid-cols-2 gap-1.5 mt-1.5">
            {([["ai", "Que decida la IA"], ["manual", "Elegir estilos"]] as const).map(([id, lbl]) => (
              <button key={id} type="button" onClick={() => setShotPlan(id)}
                className={cn("px-3 py-2 rounded-[var(--radius-sm)] border text-[12px] cursor-pointer", shotPlan === id ? "bg-[var(--color-brand-subtle)] border-[var(--color-brand)] text-fg" : "bg-surface-1 border-edge text-fg-muted")}>{lbl}</button>
            ))}
          </div>
        </div>

        {/* Variantes + Resolución */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-medium text-fg-muted">Variantes por toma</label>
            <div className="flex items-center gap-1 mt-1.5">
              {[1, 2, 3, 4].map((n) => (
                <button key={n} type="button" onClick={() => setVariationsPerShot(n)}
                  className={cn("w-8 h-8 rounded-[var(--radius-sm)] border text-[12px] font-semibold cursor-pointer", variationsPerShot === n ? "bg-[var(--color-brand-subtle)] border-[var(--color-brand)] text-fg" : "bg-surface-1 border-edge text-fg-muted")}>{n}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-fg-muted">Resolución</label>
            <div className="flex items-center gap-1 mt-1.5">
              {RES_OPTIONS.map((r) => (
                <button key={r} type="button" onClick={() => setResolution(r)}
                  className={cn("px-2.5 h-8 rounded-[var(--radius-sm)] border text-[12px] font-semibold cursor-pointer", resolution === r ? "bg-[var(--color-brand-subtle)] border-[var(--color-brand)] text-fg" : "bg-surface-1 border-edge text-fg-muted")}>{r}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Aspect ratios */}
        <div>
          <label className="text-[11px] font-medium text-fg-muted">Formatos (multi)</label>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {AR_OPTIONS.map((ar) => (
              <button key={ar} type="button" onClick={() => toggleAR(ar)}
                className={cn("px-3 h-8 rounded-[var(--radius-sm)] border text-[12px] font-medium cursor-pointer", aspectRatios.includes(ar) ? "bg-[var(--color-brand-subtle)] border-[var(--color-brand)] text-fg" : "bg-surface-1 border-edge text-fg-muted")}>{ar}</button>
            ))}
          </div>
        </div>

        {error && <p className="text-[12px] text-[var(--color-error)]">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 h-9 rounded-full border border-edge text-[13px] text-fg-muted hover:text-fg cursor-pointer">Cancelar</button>
          <button onClick={submit} disabled={saving}
            className="flex items-center gap-1.5 px-5 h-9 rounded-full bg-[var(--color-brand)] text-[var(--color-brand-fg)] text-[13px] font-semibold hover:opacity-90 disabled:opacity-60 cursor-pointer">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Crear campaña
          </button>
        </div>
      </div>
    </div>
  );
}
