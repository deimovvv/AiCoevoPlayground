import { Pencil, Trash2 } from "lucide-react";
import { createCampaign, deleteProject, updateCampaign, type Campaign } from "../../lib/api";
import type { useConfirm } from "../../lib/useConfirm";

/**
 * Dónde va una entrega (studio-v2 §16): campaña y etapa, con rótulo. La campaña se elige, se crea
 * («+ Proyecto»), se renombra (lápiz) o se borra (tacho: sus entregas quedan sin proyecto) acá mismo. La etapa es el paso dentro del proyecto
 * (01 Fotos → 02 Video): se elige de las que ya hay o se escribe otra.
 */

const NEW = "__nueva__";
const OTHER = "__otra__";
const PRESET_STAGES = ["01 Fotos", "02 Video", "Carrusel", "Historias", "Video"];
const mono = "font-mono text-[9.5px] uppercase tracking-[0.09em] text-fg-faint";
const field = "h-7 max-w-[180px] px-1.5 rounded-[3px] border border-edge bg-transparent text-[12px] text-fg cursor-pointer outline-none focus:border-fg/40";

type Ask = ReturnType<typeof useConfirm>[1];

export function DeliveryGroupPicker({ brandId, campaigns, onCampaigns, campaignId, stage, usedStages, onChange, ask, onError, disabled, variant = "full" }: {
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
    /** «upload»: sólo el proyecto (al subir). «full»: proyecto (renombrar, borrar) y etapa. */
    variant?: "full" | "upload";
}) {
    const stages = [...new Set([...PRESET_STAGES, ...usedStages, ...(stage ? [stage] : [])])].sort();
    const current = campaigns.find((c) => c.id === campaignId);

    const safe = async (fn: () => Promise<void>) => { try { await fn(); } catch (e) { onError((e as Error).message); } };
    const create = () => safe(async () => {
        const name = await ask({ title: "Nuevo proyecto", input: "Nombre", placeholder: "Ej: Jean otoño 2026", confirm: "Crear",
            body: "Un proyecto junta las entregas de una misma campaña o pedido (fotos, carruseles, historias, videos)." });
        if (typeof name !== "string") return;
        const c = await createCampaign({ brandId, name });
        onCampaigns([...campaigns, c]);
        onChange({ campaignId: c.id, stage });
    });
    const pickCampaign = (v: string) => (v === NEW ? create() : onChange({ campaignId: v || null, stage }));
    const remove = () => safe(async () => {
        if (!current) return;
        if (!(await ask({ title: `¿Borrar el proyecto «${current.name || "sin nombre"}»?`, body: "Se borra sólo el proyecto (la carpeta). Sus entregas y sus imágenes no se borran: quedan sin proyecto.", confirm: "Borrar el proyecto", danger: true }))) return;
        await deleteProject(current.id);
        onCampaigns(campaigns.filter((x) => x.id !== current.id));
        onChange({ campaignId: null, stage });
    });
    const rename = () => safe(async () => {
        if (!current) return;
        const name = await ask({ title: "Nombre del proyecto", input: "Nombre", placeholder: current.name, confirm: "Guardar" });
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
            <label className="flex flex-wrap items-center gap-1.5 max-w-full">
                <span className={mono}>Proyecto</span>
                <select value={campaignId ?? ""} disabled={disabled} onChange={(e) => pickCampaign(e.target.value)} className={field}>
                    <option value="">Sin proyecto</option>
                    {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name || "Proyecto sin nombre"}</option>)}
                    <option value={NEW}>+ Nuevo proyecto…</option>
                </select>
                {current && variant === "full" && (
                    <>
                        <button type="button" onClick={rename} disabled={disabled} title="Cambiarle el nombre al proyecto" aria-label="Cambiarle el nombre al proyecto"
                            className="w-6 h-6 flex items-center justify-center rounded-[3px] text-fg-faint hover:text-fg cursor-pointer"><Pencil size={11} /></button>
                        <button type="button" onClick={remove} disabled={disabled} title="Borrar el proyecto (las entregas quedan sin proyecto)" aria-label="Borrar el proyecto"
                            className="w-6 h-6 flex items-center justify-center rounded-[3px] text-fg-faint hover:text-[var(--color-error)] cursor-pointer"><Trash2 size={11} /></button>
                    </>
                )}
            </label>
            {variant === "full" && <label className="flex items-center gap-1.5">
                <span className={mono}>Etapa</span>
                <select value={stage ?? ""} disabled={disabled} onChange={(e) => pickStage(e.target.value)} className={field}>
                    <option value="">Sin etapa</option>
                    {stages.map((s) => <option key={s} value={s}>{s}</option>)}
                    <option value={OTHER}>+ Otra…</option>
                </select>
            </label>}
        </div>
    );
}
