import { Pencil } from "lucide-react";
import { createCampaign, updateCampaign, type Campaign } from "../../lib/api";
import type { useConfirm } from "../../lib/useConfirm";

/**
 * Dónde va una entrega (studio-v2 §16): campaña y etapa, con rótulo. La campaña se elige, se crea
 * («+ Nueva campaña…») o se renombra (lápiz) acá mismo. La etapa es el paso dentro de la campaña
 * (01 Fotos → 02 Video): se elige de las que ya hay o se escribe otra.
 */

const NEW = "__nueva__";
const OTHER = "__otra__";
const PRESET_STAGES = ["01 Fotos", "02 Video"];
const mono = "font-mono text-[9.5px] uppercase tracking-[0.09em] text-fg-faint";
const field = "h-7 max-w-[180px] px-1.5 rounded-[3px] border border-edge bg-transparent text-[12px] text-fg cursor-pointer outline-none focus:border-fg/40";

type Ask = ReturnType<typeof useConfirm>[1];

export function DeliveryGroupPicker({ brandId, campaigns, onCampaigns, campaignId, stage, usedStages, onChange, ask, onError, disabled }: {
    brandId: string;
    campaigns: Campaign[];
    onCampaigns: (c: Campaign[]) => void;
    campaignId: string | null;
    stage: string | null;
    /** Etapas que ya se usaron en esta marca, para elegirlas en vez de escribirlas. */
    usedStages: string[];
    onChange: (g: { campaignId: string | null; stage: string | null }) => void;
    ask: Ask;
    onError: (msg: string) => void;
    disabled?: boolean;
}) {
    const stages = [...new Set([...PRESET_STAGES, ...usedStages, ...(stage ? [stage] : [])])].sort();
    const current = campaigns.find((c) => c.id === campaignId);

    const safe = async (fn: () => Promise<void>) => { try { await fn(); } catch (e) { onError((e as Error).message); } };
    const pickCampaign = (v: string) => safe(async () => {
        if (v !== NEW) return onChange({ campaignId: v || null, stage });
        const name = await ask({ title: "Nueva campaña", input: "Nombre", placeholder: "Ej: Otoño 2026", confirm: "Crear" });
        if (typeof name !== "string") return;
        const c = await createCampaign({ brandId, name });
        onCampaigns([...campaigns, c]);
        onChange({ campaignId: c.id, stage });
    });
    const rename = () => safe(async () => {
        if (!current) return;
        const name = await ask({ title: "Nombre de la campaña", input: "Nombre", placeholder: current.name, confirm: "Guardar" });
        if (typeof name !== "string") return;
        const c = await updateCampaign(current.id, { name });
        onCampaigns(campaigns.map((x) => (x.id === c.id ? c : x)));
        onChange({ campaignId: c.id, stage });   // refresca el nombre en la lista
    });
    const pickStage = async (v: string) => {
        if (v !== OTHER) return onChange({ campaignId, stage: v || null });
        const s = await ask({ title: "Otra etapa", input: "Nombre de la etapa", placeholder: "Ej: 03 Ajustes, Teaser, Carrusel", confirm: "Usar" });
        if (typeof s === "string") onChange({ campaignId, stage: s.trim() });
    };

    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <label className="flex items-center gap-1.5">
                <span className={mono}>Campaña</span>
                <select value={campaignId ?? ""} disabled={disabled} onChange={(e) => pickCampaign(e.target.value)} className={field}>
                    <option value="">Sin campaña</option>
                    {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name || "Campaña sin nombre"}</option>)}
                    <option value={NEW}>+ Nueva campaña…</option>
                </select>
                {current && (
                    <button type="button" onClick={rename} disabled={disabled} title="Cambiarle el nombre a la campaña" aria-label="Cambiarle el nombre a la campaña"
                        className="w-6 h-6 flex items-center justify-center rounded-[3px] text-fg-faint hover:text-fg cursor-pointer"><Pencil size={11} /></button>
                )}
            </label>
            <label className="flex items-center gap-1.5">
                <span className={mono}>Etapa</span>
                <select value={stage ?? ""} disabled={disabled} onChange={(e) => pickStage(e.target.value)} className={field}>
                    <option value="">Sin etapa</option>
                    {stages.map((s) => <option key={s} value={s}>{s}</option>)}
                    <option value={OTHER}>+ Otra…</option>
                </select>
            </label>
        </div>
    );
}
