import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, Loader2, Trash2, Sparkles, Image as ImageIcon, AlertCircle, X, Download } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import {
  getCampaign, deleteCampaign, updateCampaign,
  createImageEdit, createTextToImage, pollImageGen,
  avatarImageUrl, productImageUrl, clothingImageUrl, backgroundImageUrl, moodboardImageUrl, lookAndFeelImageUrl,
  type Campaign, type CampaignPiece,
} from "../lib/api";
import { imagesUsd, formatCost } from "../lib/pricing";
import { claimFor } from "../lib/costLedger";
import { cn } from "../lib/utils";

const STATUS_LABEL: Record<Campaign["status"], { label: string; cls: string }> = {
  draft: { label: "Borrador", cls: "bg-surface-2 text-fg-muted" },
  generating: { label: "Generando", cls: "bg-[var(--color-action-muted)] text-[var(--color-action)]" },
  review: { label: "En revisión", cls: "bg-[var(--color-brand-subtle)] text-[var(--color-brand)]" },
  approved: { label: "Aprobada", cls: "bg-green-500/15 text-green-400" },
};

const AR_CLASS: Record<string, string> = { "9:16": "aspect-[9/16]", "16:9": "aspect-[16/9]", "1:1": "aspect-square", "4:5": "aspect-[4/5]" };
const MAX_PIECES_PER_RUN = 8; // cap de costo por tanda

export function CampaignDetailPage() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const { activeBrand } = useBrand();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [lightbox, setLightbox] = useState<string | null>(null);

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

  const handleGenerate = async () => {
    if (!activeBrand || !campaign || generating) return;
    const avatar = (activeBrand.avatars || []).find((a) => a.id === campaign.avatarId);
    const products = (activeBrand.products || []).filter((p) => campaign.productIds.includes(p.id));
    const clothing = (activeBrand.clothing || []).filter((c) => campaign.clothingIds?.includes(c.id));
    const background = (activeBrand.backgrounds || []).find((x) => x.id === campaign.backgroundId);
    const moodboard = (activeBrand.moodboards || []).find((m) => m.id === campaign.moodboardId);
    const lookFeel = (activeBrand.lookAndFeel || []).find((l) => l.id === campaign.lookFeelId);

    // Refs para Nano Banana, por prioridad (cap 8 = límite de Fal): identidad → producto
    // → prenda → fondo → moodboard → look&feel. Se usan las imageUrls crudas (el backend
    // las sube a Fal).
    const refs: string[] = [];
    if (avatar?.imageUrl) refs.push(avatar.imageUrl);
    products.forEach((p) => { if (p.imageUrl) refs.push(p.imageUrl); (p.images || []).forEach((im) => im.imageUrl && refs.push(im.imageUrl)); });
    clothing.forEach((c) => { if (c.imageUrl) refs.push(c.imageUrl); });
    if (background?.imageUrl) refs.push(background.imageUrl);
    if (moodboard?.imageUrl) refs.push(moodboard.imageUrl);
    if (lookFeel?.imageUrl) refs.push(lookFeel.imageUrl);
    const cappedRefs = refs.slice(0, 8);

    if (cappedRefs.length === 0 && !activeBrand.brandContext) {
      alert("Asigná al menos un asset (producto, modelo, moodboard…) o cargá brand context para generar.");
      return;
    }

    const ctx = (activeBrand.brandContext || "").slice(0, 400);
    const prodNames = products.map((p) => p.name).join(", ");
    const clothingNames = clothing.map((c) => c.name).join(", ");
    const prompt =
      `Professional advertising campaign photograph for the brand ${activeBrand.name}. ` +
      `${avatar ? "Use the EXACT model from the identity reference (same face, hair, skin). " : ""}` +
      `${prodNames ? `Feature the product(s): ${prodNames}, reproduced faithfully from the reference. ` : ""}` +
      `${clothingNames ? `The model wears: ${clothingNames}, matched to the reference. ` : ""}` +
      `${ctx} ` +
      `${background ? "Place the subject in the environment shown in the background reference. " : ""}` +
      `${moodboard ? "Follow the visual style, composition, palette and mood of the moodboard reference. " : ""}` +
      `${lookFeel ? "Apply the lighting and color grade of the look & feel reference. " : ""}` +
      `High-end editorial commercial quality, sharp, photorealistic. No text, no watermark, no logo overlay.`;

    // Una pieza por (aspect ratio × variante), capado por costo.
    const jobs: string[] = [];
    campaign.aspectRatios.forEach((ar) => { for (let i = 0; i < campaign.variationsPerShot; i++) jobs.push(ar); });
    const capped = jobs.slice(0, MAX_PIECES_PER_RUN);
    if (jobs.length > MAX_PIECES_PER_RUN) console.warn(`[campaign] capado ${jobs.length} → ${MAX_PIECES_PER_RUN} piezas por tanda`);

    setGenerating(true);
    setProgress({ done: 0, total: capped.length });
    const fresh: CampaignPiece[] = [];
    for (let i = 0; i < capped.length; i++) {
      const ar = capped[i];
      try {
        const job = cappedRefs.length
          ? await createImageEdit(cappedRefs, prompt, ar, campaign.resolution)
          : await createTextToImage(prompt, ar, campaign.resolution);
        const r = await pollImageGen(job.request_id);
        fresh.push({ id: `pc_${campaign.pieces.length + i}_${ar}_${i}`, url: r.image_url || "", type: "image", aspectRatio: ar, prompt, status: r.image_url ? "done" : "failed" });
      } catch (e) {
        console.error("[campaign] pieza falló:", e);
        fresh.push({ id: `pc_${campaign.pieces.length + i}_${ar}_${i}`, url: "", type: "image", aspectRatio: ar, prompt, status: "failed" });
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    // Las piezas de campaña NO son generaciones, así que nadie reclamaba lo que el ledger
    // venía acumulando — se le hubiera cargado a la próxima corrida de una tool. La campaña
    // reclama su propio costo y lo suma al que ya tenía.
    const delta = claimFor(campaign.id);
    const prev = campaign.cost;
    const merged = prev ? {
      ...prev,
      usd: Math.round((prev.usd + delta.usd) * 10000) / 10000,
      images: prev.images + delta.images,
      videoClips: prev.videoClips + delta.videoClips,
      videoSeconds: prev.videoSeconds + delta.videoSeconds,
      ttsChars: prev.ttsChars + delta.ttsChars,
      byModel: Object.entries(delta.byModel).reduce(
        (acc, [m, usd]) => ({ ...acc, [m]: Math.round(((acc[m] || 0) + usd) * 10000) / 10000 }),
        { ...prev.byModel } as Record<string, number>,
      ),
      verified: prev.verified && delta.verified,
    } : delta;

    try {
      const updated = await updateCampaign(campaign.id, { pieces: [...campaign.pieces, ...fresh], status: "review", cost: merged });
      setCampaign(updated);
    } catch { /* si falla el patch, al menos mostramos lo generado en memoria */ setCampaign((c) => c ? { ...c, pieces: [...c.pieces, ...fresh], status: "review" } : c); }
    setGenerating(false);
  };

  if (loading) return <div className="flex items-center gap-2 text-fg-muted text-[13px] py-16 justify-center"><Loader2 size={16} className="animate-spin" /> Cargando…</div>;
  if (error || !campaign) return <div className="p-10 text-center text-fg-muted">{error || "Campaña no encontrada"} · <button onClick={() => navigate("/dashboard/campaigns")} className="text-[var(--color-brand)] cursor-pointer">Volver</button></div>;

  const st = STATUS_LABEL[campaign.status] || STATUS_LABEL.draft;
  const pieces = campaign.pieces || [];

  // Todos los assets asignados (avatar, productos, prendas, fondo, moodboard, look&feel)
  // como una sola lista para el strip compacto.
  const b = activeBrand;
  const assigned: Array<{ kind: string; name: string; thumb?: string }> = [];
  const av = b?.avatars?.find((a) => a.id === campaign.avatarId);
  if (av) assigned.push({ kind: "Modelo", name: av.name, thumb: av.imageUrl ? avatarImageUrl(av.imageUrl) : undefined });
  (b?.products || []).filter((p) => campaign.productIds.includes(p.id)).forEach((p) => assigned.push({ kind: "Producto", name: p.name, thumb: p.imageUrl ? productImageUrl(p.imageUrl) : undefined }));
  (b?.clothing || []).filter((c) => campaign.clothingIds?.includes(c.id)).forEach((c) => assigned.push({ kind: "Prenda", name: c.name, thumb: c.imageUrl ? clothingImageUrl(c.imageUrl) : undefined }));
  const bg = b?.backgrounds?.find((x) => x.id === campaign.backgroundId);
  if (bg) assigned.push({ kind: "Fondo", name: bg.name, thumb: bg.imageUrl ? backgroundImageUrl(bg.imageUrl) : undefined });
  const mb = b?.moodboards?.find((m) => m.id === campaign.moodboardId);
  if (mb) assigned.push({ kind: "Moodboard", name: mb.name, thumb: mb.imageUrl ? moodboardImageUrl(mb.imageUrl) : undefined });
  const lf = b?.lookAndFeel?.find((l) => l.id === campaign.lookFeelId);
  if (lf) assigned.push({ kind: "Look & Feel", name: lf.name, thumb: lf.imageUrl ? lookAndFeelImageUrl(lf.imageUrl) : undefined });

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8">
      <button onClick={() => navigate("/dashboard/campaigns")} className="flex items-center gap-1.5 text-[12px] text-fg-faint hover:text-fg mb-4 cursor-pointer"><ArrowLeft size={14} /> Campañas</button>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-[26px] font-semibold tracking-tight">{campaign.name}</h1>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", st.cls)}>{st.label}</span>
            <span className="text-[11px] text-fg-faint">{activeBrand?.name}</span>
          </div>
        </div>
        <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 h-9 rounded-full border border-edge text-[12px] text-fg-muted hover:text-red-400 hover:border-red-400/40 cursor-pointer"><Trash2 size={13} /> Borrar</button>
      </div>

      {/* Setup — strip compacto: chips + assets asignados en una fila */}
      <div className="rounded-[var(--radius-md)] border border-edge bg-surface-0 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Chip label="Shot list" value={campaign.shotPlan === "ai" ? "IA decide" : "Estilos"} />
          <Chip label="Variantes" value={String(campaign.variationsPerShot)} />
          <Chip label="Formatos" value={campaign.aspectRatios.join(" · ")} />
          <Chip label="Resolución" value={campaign.resolution} />
        </div>
        {assigned.length === 0 ? (
          <p className="text-[11px] text-fg-faint">Sin assets asignados. <button onClick={() => navigate("/dashboard/campaigns/new")} className="text-[var(--color-brand)] cursor-pointer">Creá otra con assets</button> o generá solo desde el brand context.</p>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {assigned.map((a, i) => (
              <div key={i} className="flex flex-col items-center gap-1 w-16">
                <div className="w-16 h-16 rounded-[var(--radius-sm)] overflow-hidden border border-edge bg-surface-2">
                  {a.thumb && <img src={a.thumb} alt={a.name} className="w-full h-full object-cover" />}
                </div>
                <div className="text-center leading-tight">
                  <span className="block text-[8px] uppercase tracking-wide text-[var(--color-brand)] font-semibold">{a.kind}</span>
                  <span className="block text-[9px] text-fg-faint truncate max-w-[64px]">{a.name}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Piezas */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[16px] font-bold">Piezas {pieces.length > 0 && <span className="text-fg-faint font-normal text-[13px]">· {pieces.length}</span>}</h3>
        <div className="flex items-center gap-2.5">
          {!generating && (() => {
            const count = Math.min(campaign.aspectRatios.length * campaign.variationsPerShot, MAX_PIECES_PER_RUN);
            const cost = formatCost(imagesUsd(count));
            return <span className="text-[11px] text-fg-faint" title="Estimado — precios ajustables en pricing.ts">{count} img · {cost.label}</span>;
          })()}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-1.5 px-4 h-9 rounded-full bg-[var(--color-brand)] text-[var(--color-brand-fg)] text-[12px] font-semibold hover:opacity-90 disabled:opacity-60 cursor-pointer"
          >
            {generating ? <><Loader2 size={13} className="animate-spin" /> Generando {progress.done}/{progress.total}</> : <><Sparkles size={13} /> {pieces.length > 0 ? "Generar más" : "Generar piezas"}</>}
          </button>
        </div>
      </div>

      {pieces.length === 0 && !generating ? (
        <div className="border border-dashed border-edge rounded-[var(--radius-md)] p-10 text-center">
          <ImageIcon size={26} className="mx-auto text-fg-faint mb-2" />
          <p className="text-[13px] text-fg-muted">Todavía no hay piezas.</p>
          <p className="text-[11px] text-fg-faint mt-1">Tocá <strong>Generar piezas</strong> — usa el producto + moodboard + formatos de la campaña. El checkpoint (aprobar → video + voz) llega en la próxima.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {pieces.map((pc) => (
            <div key={pc.id} className={cn("relative rounded-[var(--radius-md)] overflow-hidden border border-edge bg-surface-1 group", AR_CLASS[pc.aspectRatio] || "aspect-square")}>
              {pc.url ? (
                <>
                  <img src={pc.url} alt="" className="w-full h-full object-cover cursor-zoom-in" onClick={() => setLightbox(pc.url)} />
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px]">{pc.aspectRatio}</span>
                  <a href={pc.url} download onClick={(e) => e.stopPropagation()} className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" title="Descargar"><Download size={12} /></a>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-[var(--color-error)] gap-1"><AlertCircle size={16} /><span className="text-[9px]">falló</span></div>
              )}
            </div>
          ))}
          {generating && Array.from({ length: Math.max(0, progress.total - (progress.done)) }).map((_, i) => (
            <div key={`skel_${i}`} className="aspect-square rounded-[var(--radius-md)] border border-edge bg-surface-1 flex items-center justify-center"><Loader2 size={16} className="animate-spin text-fg-faint" /></div>
          ))}
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8 cursor-zoom-out" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-h-full max-w-full object-contain rounded-[var(--radius-md)]" onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer"><X size={16} /></button>
        </div>
      )}
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-edge bg-surface-1 text-[11px]">
      <span className="text-fg-faint">{label}</span>
      <span className="text-fg font-medium">{value}</span>
    </span>
  );
}
