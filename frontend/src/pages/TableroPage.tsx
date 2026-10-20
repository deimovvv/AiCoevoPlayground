import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Loader2, Trash2, Upload } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import { useConfirm } from "../lib/useConfirm";
import {
    backendUrl, getCampaign, updateCampaign, uploadCampaignInputs, deleteCampaignInput,
    type Campaign, type CampaignInput,
} from "../lib/api";

/**
 * Tablero de una campaña (openspec/changes/studio-v2 §15): la dirección de ESTA pieza o temporada.
 * Como el tablero de dirección de arte: brief, moodboard, luz, locación, poses, planos, casting.
 * La marca pone los límites (siempre / nunca, paleta, caras); lo de la campaña gana en lo suyo.
 * Claude lo lee al producir para la campaña (MCP). El generador viejo sigue en «Abrir en el generador».
 */

type T = CampaignInput["type"];
const ROWS: Array<{ type: T; label: string; hint: string }> = [
    { type: "moodboard", label: "Moodboard", hint: "El clima de la campaña" },
    { type: "lookfeel", label: "Luz / look", hint: "Cómo está iluminada" },
    { type: "background", label: "Locación", hint: "Dónde pasa" },
    { type: "plano", label: "Planos", hint: "Encuadre, lente, movimiento" },
    { type: "pose", label: "Poses", hint: "Postura y gesto" },
    { type: "avatar", label: "Casting", hint: "Quién aparece" },
    { type: "clothing", label: "Prendas", hint: "Lo que se muestra" },
    { type: "reference", label: "Otras referencias", hint: "Lo que no entra arriba" },
];
const mono = "font-mono text-[10px] uppercase tracking-[0.09em]";

function Row({ row, items, campaignId, onChange, ask }: {
    row: typeof ROWS[number]; items: CampaignInput[]; campaignId: string; onChange: () => Promise<void>;
    ask: ReturnType<typeof useConfirm>[1];
}) {
    const ref = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [over, setOver] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const send = async (files: FileList | null) => {
        const list = Array.from(files || []).filter((f) => f.type.startsWith("image/"));
        if (!list.length) return;
        setBusy(true); setErr(null);
        try { await uploadCampaignInputs(campaignId, list, row.type); await onChange(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
    };
    return (
        <section className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)] gap-x-8 gap-y-3 py-5 border-t border-edge"
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); send(e.dataTransfer.files); }}>
            <div>
                <h2 className="text-[15px] text-fg">{row.label} <span className="font-mono text-[11px] text-fg-faint">{items.length || ""}</span></h2>
                <p className="text-[12px] text-fg-faint mt-1">{row.hint}</p>
            </div>
            <div className={`flex gap-2 overflow-x-auto pb-1 rounded-[4px] ${over ? "outline outline-1 outline-dashed outline-fg" : ""}`}>
                {items.map((it) => (
                    <figure key={it.id} className="group relative shrink-0 h-[150px] rounded-[2px] overflow-hidden bg-[var(--color-surface-2)]">
                        <img src={backendUrl(it.url)} alt={it.name} loading="lazy" className="h-full w-auto object-cover" />
                        <button aria-label="Quitar" onClick={async () => { if (await ask({ title: "¿Quitar esta imagen de la campaña?", confirm: "Quitar", danger: true })) { await deleteCampaignInput(campaignId, it.id); await onChange(); } }}
                            className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer">
                            <Trash2 size={12} />
                        </button>
                    </figure>
                ))}
                <button onClick={() => ref.current?.click()}
                    className="shrink-0 h-[150px] w-[120px] rounded-[2px] border border-dashed border-[var(--color-edge-strong)] flex flex-col items-center justify-center gap-1.5 text-[12px] text-fg-muted hover:text-fg cursor-pointer">
                    {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                    {busy ? "Subiendo…" : "Sumar"}
                </button>
                <input ref={ref} type="file" multiple accept="image/*" hidden onChange={(e) => { send(e.target.files); e.target.value = ""; }} />
            </div>
            {err && <p className="md:col-start-2 text-[12px] text-[var(--color-error)]">{err}</p>}
        </section>
    );
}

export function TableroPage() {
    const { id = "" } = useParams();
    const navigate = useNavigate();
    const { activeBrand, setActiveBrandId } = useBrand();
    const [c, setC] = useState<Campaign | null>(null);
    const [name, setName] = useState("");
    const [brief, setBrief] = useState("");
    const [saved, setSaved] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const brandRef = useRef(activeBrand?.id);
    const [dialog, ask] = useConfirm();

    const load = useCallback(async () => {
        try {
            const x = await getCampaign(id);
            setC(x); setName(x.name); setBrief(x.brief || ""); setSaved(true);
            // Abrir el tablero de otra marca cambia la marca activa.
            if (brandRef.current !== x.brandId) { brandRef.current = x.brandId; setActiveBrandId(x.brandId); }
        } catch (e) { setErr((e as Error).message); }
    }, [id, setActiveBrandId]);
    useEffect(() => {
        let alive = true;
        getCampaign(id).then((x) => {
            if (!alive) return;
            setC(x); setName(x.name); setBrief(x.brief || ""); setSaved(true);
            if (brandRef.current !== x.brandId) { brandRef.current = x.brandId; setActiveBrandId(x.brandId); }
        }).catch((e) => alive && setErr(e.message));
        return () => { alive = false; };
    }, [id, setActiveBrandId]);

    const save = async () => {
        if (!c) return;
        await updateCampaign(c.id, { name: name.trim() || c.name, brief });
        setSaved(true);
    };

    if (err) return <p className="p-8 text-[13px] text-[var(--color-error)]">{err}</p>;
    if (!c) return <p className="p-8 text-[13px] text-fg-faint">Cargando…</p>;
    const inputs = c.inputs || [];

    return (
        <div className="max-w-[1400px] mx-auto px-4 md:px-10 py-8 pb-20">
            {dialog}
            <div className="flex flex-wrap items-center gap-3 text-[12px]">
                <Link to="/dashboard/produccion" className="text-fg-muted hover:text-fg no-underline">← Producción</Link>
                <span className="flex-1" />
                {!saved && <button onClick={save} className="h-8 px-3 rounded-[4px] bg-[var(--color-action)] text-[var(--color-action-fg)] cursor-pointer">Guardar cambios</button>}
                <button onClick={() => navigate(`/dashboard/campaigns/${c.id}`)} className="h-8 px-3 rounded-[4px] border border-edge text-fg-muted hover:text-fg cursor-pointer">Abrir en el generador</button>
            </div>

            <header className="mt-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-12 gap-y-4 pb-8">
                <div>
                    <p className={`${mono} text-fg-faint`}>Campaña · {activeBrand?.name}</p>
                    <input value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} onBlur={save} aria-label="Nombre de la campaña"
                        className="mt-3 w-full bg-transparent text-[40px] leading-[1.05] tracking-[-0.035em] text-fg outline-none border-b border-transparent focus:border-edge" />
                </div>
                <label className="flex flex-col gap-2">
                    <span className={`${mono} text-fg-faint`}>La idea</span>
                    <textarea value={brief} onChange={(e) => { setBrief(e.target.value); setSaved(false); }} onBlur={save} rows={5}
                        placeholder="Qué se hace, el concepto, el guion en dos líneas. Lo lee Claude antes de producir."
                        className="w-full px-3 py-2.5 rounded-[4px] border border-edge bg-[var(--color-surface-1)] text-[14px] leading-relaxed text-fg outline-none focus:border-fg/40 resize-y" />
                </label>
            </header>

            {ROWS.map((r) => (
                <Row key={r.type} row={r} campaignId={c.id} onChange={load} ask={ask} items={inputs.filter((i) => i.type === r.type || (r.type === "reference" && i.type === "product"))} />
            ))}
            <p className="pt-6 border-t border-edge text-[12px] text-fg-faint">
                La marca pone los límites (siempre / nunca, paleta, caras); lo de este tablero gana en lo suyo cuando se produce la campaña.
            </p>
        </div>
    );
}
