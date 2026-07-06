import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Loader2, Check, Plus, ChevronDown } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import {
  createCampaign,
  avatarImageUrl, productImageUrl, clothingImageUrl, backgroundImageUrl, moodboardImageUrl, lookAndFeelImageUrl,
} from "../lib/api";
import { cn } from "../lib/utils";

const AR_OPTIONS = ["9:16", "16:9", "1:1", "4:5"];
const RES_OPTIONS = ["1K", "2K", "4K"];

type AssetItem = { id: string; name: string; thumb?: string };

/** Módulo colapsable de assets de un tipo — single (radio) o multi (checkbox).
 *  Cerrado por default; el header muestra qué elegiste (thumbs + contador) sin abrir. */
function AssetGrid({ label, hint, items, multi, selectedId, selectedIds, onSingle, onToggle }: {
  label: string;
  hint?: string;
  items: AssetItem[];
  multi?: boolean;
  selectedId?: string | null;
  selectedIds?: string[];
  onSingle?: (id: string | null) => void;
  onToggle?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => multi ? items.filter((i) => (selectedIds || []).includes(i.id)) : items.filter((i) => i.id === selectedId),
    [items, multi, selectedIds, selectedId],
  );
  if (items.length === 0) return null;

  return (
    <div className="rounded-[var(--radius-sm)] border border-edge bg-surface-1 overflow-hidden">
      {/* Header — click para abrir/cerrar. Muestra selección aunque esté cerrado. */}
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2 px-3 py-2.5 cursor-pointer text-left">
        <ChevronDown size={14} className={cn("text-fg-faint shrink-0 transition-transform", open ? "" : "-rotate-90")} />
        <span className="text-[12px] font-semibold text-fg-secondary">{label}</span>
        {hint && <span className="text-[10px] text-fg-faint">{hint}</span>}
        <span className="ml-auto flex items-center gap-1.5">
          {!open && selected.slice(0, 4).map((s) => (
            <span key={s.id} className="w-6 h-6 rounded overflow-hidden border border-edge bg-surface-2 shrink-0">
              {s.thumb && <img src={s.thumb} alt={s.name} className="w-full h-full object-cover" />}
            </span>
          ))}
          <span className={cn("text-[10px] font-medium", selected.length ? "text-[var(--color-brand)]" : "text-fg-faint")}>
            {selected.length ? `${selected.length} sel.` : "Elegir"}
          </span>
        </span>
      </button>

      {open && (
        <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 p-3 pt-0">
          {!multi && (
            <button type="button" onClick={() => onSingle?.(null)}
              className={cn("aspect-square rounded-[var(--radius-sm)] border-2 flex items-center justify-center text-[9px] cursor-pointer", selectedId == null ? "border-[var(--color-brand)] text-fg" : "border-edge text-fg-faint")}>Ninguno</button>
          )}
          {items.map((it) => {
            const on = multi ? (selectedIds || []).includes(it.id) : selectedId === it.id;
            return (
              <button key={it.id} type="button" title={it.name}
                onClick={() => multi ? onToggle?.(it.id) : onSingle?.(it.id)}
                className={cn("relative aspect-square rounded-[var(--radius-sm)] border-2 overflow-hidden cursor-pointer", on ? "border-[var(--color-brand)]" : "border-edge opacity-70 hover:opacity-100")}>
                {it.thumb ? <img src={it.thumb} alt={it.name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-surface-2 flex items-center justify-center text-[8px] text-fg-faint p-1 text-center">{it.name}</div>}
                {on && <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-[var(--color-brand)] text-white flex items-center justify-center"><Check size={9} /></span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function NewCampaignPage() {
  const navigate = useNavigate();
  const { activeBrand } = useBrand();

  const [name, setName] = useState("");
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [clothingIds, setClothingIds] = useState<string[]>([]);
  const [backgroundId, setBackgroundId] = useState<string | null>(null);
  const [moodboardId, setMoodboardId] = useState<string | null>(null);
  const [lookFeelId, setLookFeelId] = useState<string | null>(null);
  const [shotPlan, setShotPlan] = useState<"ai" | "manual">("ai");
  const [variationsPerShot, setVariationsPerShot] = useState(2);
  const [aspectRatios, setAspectRatios] = useState<string[]>(["9:16"]);
  const [resolution, setResolution] = useState("2K");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!activeBrand) {
    return <div className="p-10 text-center text-fg-muted text-[14px]">Elegí una marca en el switcher para crear una campaña.</div>;
  }

  const b = activeBrand;
  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (id: string) =>
    setter((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleAR = (ar: string) => setAspectRatios((p) => p.includes(ar) ? p.filter((x) => x !== ar) : [...p, ar]);

  const submit = async () => {
    setSaving(true); setError(null);
    try {
      const c = await createCampaign({
        brandId: b.id,
        name: name.trim() || "Campaña sin nombre",
        avatarId, productIds, clothingIds, backgroundId, moodboardId, lookFeelId,
        shotPlan, variationsPerShot,
        aspectRatios: aspectRatios.length ? aspectRatios : ["9:16"],
        resolution,
      });
      navigate(`/dashboard/campaigns/${c.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la campaña");
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-8">
      <button onClick={() => navigate("/dashboard/campaigns")} className="flex items-center gap-1.5 text-[12px] text-fg-faint hover:text-fg mb-4 cursor-pointer"><ArrowLeft size={14} /> Campañas</button>
      <h1 className="font-display text-[26px] font-semibold tracking-tight">Nueva campaña</h1>
      <p className="text-[12px] text-fg-faint mt-0.5 mb-6">Marca: <span className="text-fg-muted">{b.name}</span></p>

      <div className="space-y-6">
        {/* Nombre */}
        <div>
          <label className="text-[12px] font-semibold text-fg-secondary">Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder='ej: "Campaña Auto — Verano"'
            className="mt-1.5 w-full h-10 px-3 rounded-[var(--radius-sm)] border border-edge bg-surface-1 text-[14px] outline-none focus:border-[var(--color-brand)]" />
        </div>

        {/* Assets de la marca — cada tipo es un módulo colapsable (cerrado por default). */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-fg-faint mb-1">Assets de la marca</div>
          {(b.avatars?.length || b.products?.length || b.clothing?.length || b.backgrounds?.length || b.moodboards?.length || b.lookAndFeel?.length) ? (
            <>
              <AssetGrid label="Modelo / Avatar" hint="uno" selectedId={avatarId} onSingle={setAvatarId}
                items={(b.avatars || []).map((a) => ({ id: a.id, name: a.name, thumb: a.imageUrl ? avatarImageUrl(a.imageUrl) : undefined }))} />
              <AssetGrid label="Productos" hint="multi" multi selectedIds={productIds} onToggle={toggle(setProductIds)}
                items={(b.products || []).map((p) => ({ id: p.id, name: p.name, thumb: p.imageUrl ? productImageUrl(p.imageUrl) : undefined }))} />
              <AssetGrid label="Prendas" hint="multi" multi selectedIds={clothingIds} onToggle={toggle(setClothingIds)}
                items={(b.clothing || []).map((c) => ({ id: c.id, name: c.name, thumb: c.imageUrl ? clothingImageUrl(c.imageUrl) : undefined }))} />
              <AssetGrid label="Fondo" hint="uno" selectedId={backgroundId} onSingle={setBackgroundId}
                items={(b.backgrounds || []).map((x) => ({ id: x.id, name: x.name, thumb: x.imageUrl ? backgroundImageUrl(x.imageUrl) : undefined }))} />
              <AssetGrid label="Moodboard" hint="look de la escena" selectedId={moodboardId} onSingle={setMoodboardId}
                items={(b.moodboards || []).map((m) => ({ id: m.id, name: m.name, thumb: m.imageUrl ? moodboardImageUrl(m.imageUrl) : undefined }))} />
              <AssetGrid label="Look & Feel" hint="iluminación / color" selectedId={lookFeelId} onSingle={setLookFeelId}
                items={(b.lookAndFeel || []).map((l) => ({ id: l.id, name: l.name, thumb: l.imageUrl ? lookAndFeelImageUrl(l.imageUrl) : undefined }))} />
            </>
          ) : (
            <p className="text-[12px] text-fg-faint">Esta marca no tiene assets cargados todavía. Cargalos en el <button onClick={() => navigate("/dashboard/brand")} className="text-[var(--color-brand)] cursor-pointer">Brand Kit</button>.</p>
          )}
        </div>

        {/* Shot list */}
        <div>
          <label className="text-[12px] font-semibold text-fg-secondary">Shot list</label>
          <div className="grid grid-cols-2 gap-2 mt-1.5">
            {([["ai", "Que decida la IA"], ["manual", "Elegir estilos"]] as const).map(([id, lbl]) => (
              <button key={id} type="button" onClick={() => setShotPlan(id)}
                className={cn("px-3 py-2.5 rounded-[var(--radius-sm)] border text-[13px] cursor-pointer", shotPlan === id ? "bg-[var(--color-brand-subtle)] border-[var(--color-brand)] text-fg" : "bg-surface-1 border-edge text-fg-muted")}>{lbl}</button>
            ))}
          </div>
        </div>

        {/* Variantes + Resolución */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[12px] font-semibold text-fg-secondary">Variantes por toma</label>
            <div className="flex items-center gap-1.5 mt-1.5">
              {[1, 2, 3, 4].map((n) => (
                <button key={n} type="button" onClick={() => setVariationsPerShot(n)}
                  className={cn("w-9 h-9 rounded-[var(--radius-sm)] border text-[13px] font-semibold cursor-pointer", variationsPerShot === n ? "bg-[var(--color-brand-subtle)] border-[var(--color-brand)] text-fg" : "bg-surface-1 border-edge text-fg-muted")}>{n}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[12px] font-semibold text-fg-secondary">Resolución</label>
            <div className="flex items-center gap-1.5 mt-1.5">
              {RES_OPTIONS.map((r) => (
                <button key={r} type="button" onClick={() => setResolution(r)}
                  className={cn("px-3 h-9 rounded-[var(--radius-sm)] border text-[13px] font-semibold cursor-pointer", resolution === r ? "bg-[var(--color-brand-subtle)] border-[var(--color-brand)] text-fg" : "bg-surface-1 border-edge text-fg-muted")}>{r}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Formatos */}
        <div>
          <label className="text-[12px] font-semibold text-fg-secondary">Formatos <span className="text-fg-faint font-normal">(multi)</span></label>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {AR_OPTIONS.map((ar) => (
              <button key={ar} type="button" onClick={() => toggleAR(ar)}
                className={cn("px-4 h-9 rounded-[var(--radius-sm)] border text-[13px] font-medium cursor-pointer", aspectRatios.includes(ar) ? "bg-[var(--color-brand-subtle)] border-[var(--color-brand)] text-fg" : "bg-surface-1 border-edge text-fg-muted")}>{ar}</button>
            ))}
          </div>
        </div>

        {error && <p className="text-[13px] text-[var(--color-error)]">{error}</p>}

        {/* Acciones */}
        <div className="flex justify-end gap-2 pt-2 pb-8">
          <button onClick={() => navigate("/dashboard/campaigns")} className="px-5 h-11 rounded-full border border-edge text-[14px] text-fg-muted hover:text-fg cursor-pointer">Cancelar</button>
          <button onClick={submit} disabled={saving}
            className="flex items-center gap-2 px-6 h-11 rounded-full bg-[var(--color-brand)] text-[var(--color-brand-fg)] text-[14px] font-semibold hover:opacity-90 disabled:opacity-60 cursor-pointer">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Crear campaña
          </button>
        </div>
      </div>
    </div>
  );
}
