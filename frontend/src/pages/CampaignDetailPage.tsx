import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { ArrowLeft, Loader2, Trash2, Sparkles, Image as ImageIcon, AlertCircle, X, Download, Upload, RotateCcw, History, Wand2 } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import {
  getCampaign, deleteCampaign, updateCampaign,
  createImageEdit, createTextToImage, pollImageGen,
  avatarImageUrl, productImageUrl, clothingImageUrl, backgroundImageUrl, moodboardImageUrl, lookAndFeelImageUrl,
  planCampaign,
  type Campaign, type CampaignPiece, type CampaignPlan,
} from "../lib/api";
import { imagesUsd, formatCost } from "../lib/pricing";
import { claimFor } from "../lib/costLedger";
import { saveGeneration } from "../lib/api";
import { EditOverlay } from "../components/workspace/EditOverlay";
import type { CostSummary } from "../lib/costLedger";
import { uploadCampaignPieces } from "../lib/api";
import { cn } from "../lib/utils";

const STATUS_LABEL: Record<Campaign["status"], { label: string; cls: string }> = {
  draft: { label: "Borrador", cls: "bg-surface-2 text-fg-muted" },
  generating: { label: "Generando", cls: "bg-[var(--color-action-muted)] text-[var(--color-action)]" },
  review: { label: "En revisión", cls: "bg-[var(--color-brand-subtle)] text-[var(--color-brand)]" },
  approved: { label: "Aprobada", cls: "bg-green-500/15 text-green-400" },
};

const AR_CLASS: Record<string, string> = { "9:16": "aspect-[9/16]", "16:9": "aspect-[16/9]", "1:1": "aspect-square", "4:5": "aspect-[4/5]" };
const MAX_PIECES_PER_RUN = 8; // cap de costo por tanda

/**
 * Suma un delta de costo sobre lo que la campaña ya tenía. Espeja `_merge_cost` del
 * backend — las piezas de campaña no son generaciones, así que la campaña lleva su
 * propio registro (ver lib/costLedger.ts).
 */
function mergeCost(prev: CostSummary | undefined, delta: CostSummary): CostSummary {
  if (!prev) return delta;
  return {
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
  };
}

export function CampaignDetailPage() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const { activeBrand } = useBrand();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  // El plan de tomas: qué se va a generar y por qué. Se pide primero, se revisa,
  // y recién ahí se genera. Antes handleGenerate armaba UN prompt genérico y lo
  // repetía por formato — el brief que escribías no entraba en ningún lado.
  const [plan, setPlan] = useState<CampaignPlan | null>(null);
  const [uploading, setUploading] = useState(false);
  const [regenId, setRegenId] = useState<string | null>(null);
  const [versionsOf, setVersionsOf] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [lightbox, setLightbox] = useState<string | null>(null);
  /** Pieza abierta en el editor. El panel trae el brush de máscara, así que
   *  desde acá se puede corregir una zona puntual sin redibujar todo. */
  const [editing, setEditing] = useState<CampaignPiece | null>(null);

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

  /**
   * Subir material propio al pedido. Existe porque no todo tiene que salir de nuestras
   * tools: si un video conviene hacerlo en otro lado, igual pertenece a este pedido.
   */
  const handleUpload = async (files: FileList | null) => {
    if (!campaign || !files || files.length === 0) return;
    setUploading(true); setUploadError(null);
    try {
      setCampaign(await uploadCampaignPieces(campaign.id, Array.from(files)));
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "No se pudo subir");
    } finally {
      setUploading(false);
    }
  };

  /**
   * Regenera UNA pieza. La url actual se empuja al historial en vez de perderse: la IA no
   * acierta al primer intento y el flujo tiene que tolerarlo. Ver el mockup del pedido.
   */
  const regeneratePiece = async (pc: CampaignPiece) => {
    if (!campaign || regenId) return;
    setRegenId(pc.id);
    try {
      const refs = buildRefs();
      const job = refs.length
        ? await createImageEdit(refs, pc.prompt, pc.aspectRatio || "9:16", campaign.resolution)
        : await createTextToImage(pc.prompt, pc.aspectRatio || "9:16", campaign.resolution);
      const r = await pollImageGen(job.request_id);
      if (!r.image_url) throw new Error("no vino imagen");
      const next = campaign.pieces.map((p) => p.id === pc.id
        ? { ...p, url: r.image_url!, history: [...(p.history || []), p.url] }
        : p);
      const delta = claimFor(campaign.id);
      setCampaign(await updateCampaign(campaign.id, {
        pieces: next,
        cost: mergeCost(campaign.cost, delta),
      }));
    } catch (e) {
      console.error("[campaign] regenerar falló:", e);
    } finally {
      setRegenId(null);
    }
  };

  /** Vuelve una pieza a una versión anterior. La actual pasa al historial. */
  const revertPiece = async (pc: CampaignPiece, url: string) => {
    if (!campaign) return;
    const next = campaign.pieces.map((p) => p.id === pc.id
      ? { ...p, url, history: [...(p.history || []).filter((h) => h !== url), p.url] }
      : p);
    setCampaign(await updateCampaign(campaign.id, { pieces: next }));
    setVersionsOf(null);
  };

  /**
   * Refs para Nano Banana, por prioridad (cap 8 = límite de Fal): identidad → producto
   * → prenda → fondo → moodboard → look&feel. Se extrajo de handleGenerate porque
   * REGENERAR tiene que usar exactamente las mismas: sin refs, la pieza nueva sale sin
   * el producto ni la modelo y no es una versión de la misma cosa.
   */
  const buildRefs = useCallback((): string[] => {
    if (!activeBrand || !campaign) return [];
    const avatar = (activeBrand.avatars || []).find((a) => a.id === campaign.avatarId);
    const products = (activeBrand.products || []).filter((p) => campaign.productIds.includes(p.id));
    const clothing = (activeBrand.clothing || []).filter((c) => campaign.clothingIds?.includes(c.id));
    const background = (activeBrand.backgrounds || []).find((x) => x.id === campaign.backgroundId);
    const moodboard = (activeBrand.moodboards || []).find((m) => m.id === campaign.moodboardId);
    const lookFeel = (activeBrand.lookAndFeel || []).find((l) => l.id === campaign.lookFeelId);
    const refs: string[] = [];
    if (avatar?.imageUrl) refs.push(avatar.imageUrl);
    products.forEach((p) => { if (p.imageUrl) refs.push(p.imageUrl); (p.images || []).forEach((im) => im.imageUrl && refs.push(im.imageUrl)); });
    clothing.forEach((c) => { if (c.imageUrl) refs.push(c.imageUrl); });
    if (background?.imageUrl) refs.push(background.imageUrl);
    if (moodboard?.imageUrl) refs.push(moodboard.imageUrl);
    if (lookFeel?.imageUrl) refs.push(lookFeel.imageUrl);
    return refs.slice(0, 8);
  }, [activeBrand, campaign]);

  /**
   * Arma el plan de tomas a partir del brief. Antes era un paso MANUAL con su
   * propio botón y su propia tarjeta en el panel; era ruido — nadie pidió revisar
   * un plan antes de generar. Ahora corre solo dentro de `handleGenerate`.
   *
   * Qué hace: convierte el brief en tomas concretas para que cada pieza salga
   * distinta. Sin esto, la generación repetía UN prompt genérico por formato y
   * todas las piezas salían iguales.
   *
   * Devuelve el plan o `null` — fail-open: si falla, se generan variantes del
   * prompt base, que es como funcionaba antes de que existiera el plan.
   */
  const buildPlan = async (): Promise<CampaignPlan | null> => {
    if (!campaign) return null;
    const brief = (campaign.brief || "").trim();
    // Con un brief de dos letras, Gemini recibe ruido e inventa cualquier cosa.
    if (brief.length < 12) return null;
    try {
      const p = await planCampaign(campaign.brandId, brief);
      setPlan(p);
      return p;
    } catch {
      return null;
    }
  };


  const handleGenerate = async () => {
    if (!activeBrand || !campaign || generating) return;
    const avatar = (activeBrand.avatars || []).find((a) => a.id === campaign.avatarId);
    const products = (activeBrand.products || []).filter((p) => campaign.productIds.includes(p.id));
    const clothing = (activeBrand.clothing || []).filter((c) => campaign.clothingIds?.includes(c.id));
    const background = (activeBrand.backgrounds || []).find((x) => x.id === campaign.backgroundId);
    const moodboard = (activeBrand.moodboards || []).find((m) => m.id === campaign.moodboardId);
    const lookFeel = (activeBrand.lookAndFeel || []).find((l) => l.id === campaign.lookFeelId);
    const cappedRefs = buildRefs();

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

    // Una pieza por (toma del plan × formato). Cada toma trae SU prompt, así que
    // las piezas salen distintas entre sí. Sin plan se cae al prompt genérico de
    // antes, repetido por variante — que es como funcionaba hasta ahora.
    // El plan se arma acá, no en un paso manual aparte. Si el brief es muy corto
    // o Gemini falla, `buildPlan` devuelve null y se cae a variantes del prompt base.
    const activePlan = plan ?? await buildPlan();
    const shots = activePlan?.shots?.length
      ? activePlan.shots
      : Array.from({ length: campaign.variationsPerShot }, (_, i) => ({
          id: `var_${i}`, label: `Variante ${i + 1}`, why: "", framing: "", prompt: "",
        }));

    const jobs: Array<{ ar: string; shot: typeof shots[number] }> = [];
    shots.forEach((shot) => campaign.aspectRatios.forEach((ar) => jobs.push({ ar, shot })));
    const capped = jobs.slice(0, MAX_PIECES_PER_RUN);
    if (jobs.length > MAX_PIECES_PER_RUN) console.warn(`[campaign] capado ${jobs.length} → ${MAX_PIECES_PER_RUN} piezas por tanda`);

    setGenerating(true);
    setProgress({ done: 0, total: capped.length });
    const fresh: CampaignPiece[] = [];
    for (let i = 0; i < capped.length; i++) {
      const { ar, shot } = capped[i];
      // El prompt de la toma reemplaza a la descripción de escena del prompt base;
      // el resto (identidad, producto, prendas, referencias) se mantiene igual.
      const shotPrompt = shot.prompt ? `${prompt} SHOT: ${shot.prompt}` : prompt;
      try {
        const job = cappedRefs.length
          ? await createImageEdit(cappedRefs, shotPrompt, ar, campaign.resolution)
          : await createTextToImage(shotPrompt, ar, campaign.resolution);
        const r = await pollImageGen(job.request_id);
        fresh.push({ id: `pc_${campaign.pieces.length + i}_${ar}_${i}`, url: r.image_url || "", type: "image", aspectRatio: ar, prompt: shotPrompt, label: shot.label || undefined, status: r.image_url ? "done" : "failed" });
      } catch (e) {
        console.error("[campaign] pieza falló:", e);
        fresh.push({ id: `pc_${campaign.pieces.length + i}_${ar}_${i}`, url: "", type: "image", aspectRatio: ar, prompt: shotPrompt, label: shot.label || undefined, status: "failed" });
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    // Las piezas de campaña NO son generaciones, así que nadie reclamaba lo que el ledger
    // venía acumulando — se le hubiera cargado a la próxima corrida de una tool. La campaña
    // reclama su propio costo y lo suma al que ya tenía.
    const delta = claimFor(campaign.id);
    const merged = mergeCost(campaign.cost, delta);

    try {
      const updated = await updateCampaign(campaign.id, { pieces: [...campaign.pieces, ...fresh], status: "review", cost: merged });
      setCampaign(updated);
    } catch { /* si falla el patch, al menos mostramos lo generado en memoria */ setCampaign((c) => c ? { ...c, pieces: [...c.pieces, ...fresh], status: "review" } : c); }

    // Las piezas también se indexan como generations con `campaignId`, para que
    // aparezcan en la biblioteca (Contenido). Ver docs/campaigns.md.
    for (const pc of fresh) {
      if (!pc.url) continue;
      try {
        await saveGeneration({
          brandId: campaign.brandId,
          campaignId: campaign.id,
          toolId: "campaign",
          title: pc.label || campaign.name,
          type: pc.type === "video" ? "video" : "image",
          status: "completed",
          thumbnailUrl: pc.url,
          outputUrl: pc.url,
          metadata: { prompt: pc.prompt, aspectRatio: pc.aspectRatio, campaignName: campaign.name },
        });
      } catch { /* la pieza ya está en la campaña */ }
    }
    setGenerating(false);
  };

  if (loading) return <div className="flex items-center gap-2 text-fg-muted text-[13px] py-16 justify-center"><Loader2 size={16} className="animate-spin" /> Cargando…</div>;
  if (error || !campaign) return <div className="p-10 text-center text-fg-muted">{error || "Campaña no encontrada"} · <button onClick={() => navigate("/dashboard/campaigns")} className="text-[var(--color-brand)] cursor-pointer">Volver</button></div>;

  const st = STATUS_LABEL[campaign.status] || STATUS_LABEL.draft;
  const pieces = campaign.pieces || [];
  // Las generadas vienen de Fal con URL absoluta; las subidas viven en nuestro backend.
  const pieceUrl = (u: string) => (u.startsWith("http") ? u : `http://127.0.0.1:8000${u}`);

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
    /* Mismo layout que el Lab y Crear campaña: header a todo el ancho, y debajo
       panel de 420px + canvas. Antes era un `max-w-5xl` centrado con todo apilado
       verticalmente — se leía como otra app. */
    <div className="h-full flex flex-col overflow-hidden">

      <header className="border-b border-edge px-5 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/dashboard/campaigns")}
                  title="Volver a Campañas"
                  className="w-7 h-7 rounded-md bg-[var(--color-action-subtle)] flex items-center justify-center cursor-pointer hover:bg-[var(--color-surface-2)] transition-colors">
            <ArrowLeft size={14} className="text-[var(--color-action)]" />
          </button>
          <h1 className="text-[14px] font-semibold text-fg leading-none">{campaign.name}</h1>
          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", st.cls)}>{st.label}</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-fg-muted">
          <span className="uppercase tracking-[.09em]">{activeBrand?.name}</span>
          <button onClick={handleDelete} title="Borrar campaña"
                  className="w-7 h-7 flex items-center justify-center rounded-md text-fg-faint hover:text-red-400 hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer">
            <Trash2 size={13} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">

      {/* ── PANEL: setup + plan + acciones ─────────────────────────── */}
      <aside className="w-[420px] shrink-0 flex flex-col h-full border-r border-edge bg-[var(--color-surface-0)]">
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

      {/* Setup — mismo lenguaje que el Lab: cada asset es una FILA que se puede
           tocar, no un thumb de 64px solo para mirar. Antes era una tira de
           miniaturas decorativas: veías qué había asignado pero no podías
           cambiarlo sin volver a crear la campaña. */}
      <div className="rounded-[var(--radius-md)] border border-[var(--color-edge-subtle)] bg-[var(--color-surface-0)] p-4 mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Chip label="Shot list" value={campaign.shotPlan === "ai" ? "IA decide" : "Estilos"} />
          <Chip label="Variantes" value={String(campaign.variationsPerShot)} />
          <Chip label="Formatos" value={campaign.aspectRatios.join(" · ")} />
          <Chip label="Resolución" value={campaign.resolution} />
        </div>
        {assigned.length === 0 ? (
          <p className="text-[11px] text-fg-faint">
            Sin assets asignados.{" "}
            <button onClick={() => navigate("/dashboard/campaigns/new")} className="underline underline-offset-2 hover:text-fg cursor-pointer">
              Creá otra con assets
            </button>{" "}
            o generá solo desde el brand context.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-1">
            {assigned.map((a, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 px-2.5 h-11 rounded-[var(--radius-sm)] bg-[var(--color-surface-1)]"
              >
                <div className="w-7 h-7 rounded overflow-hidden bg-[var(--color-surface-2)] shrink-0">
                  {a.thumb && <img src={a.thumb} alt="" className="w-full h-full object-cover" />}
                </div>
                <span className="flex-1 min-w-0">
                  <span className="block text-[12px] font-medium leading-tight truncate">{a.name}</span>
                  <span className="block text-[11px] text-fg-faint leading-tight">{a.kind}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

        </div>

        {/* Footer del panel: el botón principal, siempre visible. */}
        <div className="px-5 pt-3 pb-4 border-t border-[var(--color-edge-subtle)]">
          {uploadError && (
            <p className="mb-2 flex items-center gap-1.5 text-[11.5px] text-[var(--color-error)]">
              <AlertCircle size={12} /> {uploadError}
            </p>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full h-11 rounded-[var(--radius-sm)] text-[13px] font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:cursor-not-allowed"
            style={generating
              ? { background: "var(--color-surface-2)", color: "var(--color-fg-faint)" }
              : { background: "var(--color-action)", color: "var(--color-action-fg)" }}
          >
            {generating
              ? <><Loader2 size={13} className="animate-spin" /> {progress.done}/{progress.total}</>
              : <><Sparkles size={13} /> {pieces.length > 0 ? "Generar más" : "Generar piezas"}</>}
          </button>
          {!generating && (() => {
            const count = Math.min(campaign.aspectRatios.length * campaign.variationsPerShot, MAX_PIECES_PER_RUN);
            const cost = formatCost(imagesUsd(count));
            return (
              <div className="text-[10.5px] text-center mt-2 text-fg-muted" title="Estimado — precios en pricing.ts">
                {count} img · {cost.label} por intento
              </div>
            );
          })()}

          {/* Acciones secundarias — el generador de campaña hace imágenes sueltas;
              para un reel, un catálogo o un UGC hay que ir a la tool. */}
          <div className="flex items-center gap-1.5 mt-3">
          <Link
            to={`/dashboard/generate?campaign=${campaign.id}`}
            title="Usar una tool (reel, UGC, catálogo) para esta campaña"
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-[var(--radius-sm)] border border-edge text-[11.5px] text-fg-secondary hover:text-fg hover:bg-[var(--color-surface-1)] transition-colors cursor-pointer"
          >
            <Wand2 size={12} /> Usar una tool
          </Link>
          <label
            title="Subir un video o una imagen hecha fuera de Coevo"
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-[var(--radius-sm)] border border-edge text-[11.5px] text-fg-secondary hover:text-fg hover:bg-[var(--color-surface-1)] transition-colors cursor-pointer"
          >
            <input type="file" multiple accept="video/*,image/*" className="hidden"
                   onChange={(e) => { handleUpload(e.target.files); e.target.value = ""; }} />
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {uploading ? "Subiendo…" : "Subir"}
          </label>
          </div>
        </div>
      </aside>

      {/* ── CANVAS: las piezas ─────────────────────────────────────── */}
      <main
        className="flex-1 overflow-y-auto p-6"
        style={{ background: "radial-gradient(ellipse 50% 30% at 50% 0%, var(--color-surface-0), var(--color-canvas) 80%)" }}
      >
        <div className="flex items-baseline justify-between mb-4">
          <span className="text-[11px] uppercase tracking-[.12em] text-fg-muted">
            {pieces.length} {pieces.length === 1 ? "pieza" : "piezas"}
          </span>
          {generating && (
            <span className="text-[11px] tabular-nums text-fg-faint">generando {progress.done}/{progress.total}</span>
          )}
        </div>

      {pieces.length === 0 && !generating ? (
        <div className="h-full flex items-center justify-center">
          <div className="text-center max-w-[300px]">
            <ImageIcon size={24} className="mx-auto text-fg-faint mb-2" />
            <p className="text-[13px] text-fg-muted">Todavía no hay piezas.</p>
            <p className="text-[11px] text-fg-faint mt-1 leading-relaxed">Tocá <strong>Generar piezas</strong> — usa el producto, el moodboard y los formatos de la campaña.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {pieces.map((pc) => (
            <div key={pc.id} className={cn("relative rounded-[var(--radius-md)] overflow-hidden border border-edge bg-surface-1 group", AR_CLASS[pc.aspectRatio] || "aspect-square")}>
              {pc.url ? (
                <>
                  {pc.type === "video" ? (
                    <video
                      src={pieceUrl(pc.url)}
                      className="w-full h-full object-cover cursor-zoom-in"
                      muted
                      loop
                      playsInline
                      onMouseEnter={(e) => void (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
                      onMouseLeave={(e) => (e.currentTarget as HTMLVideoElement).pause()}
                      onClick={() => setLightbox(pc.url)}
                    />
                  ) : (
                    <img src={pieceUrl(pc.url)} alt="" className="w-full h-full object-cover cursor-zoom-in" onClick={() => setLightbox(pc.url)} />
                  )}
                  {/* Marca de origen: lo subido no lo generamos nosotros ni costó acá. */}
                  {pc.source === "upload" && (
                    <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 text-white text-[9px] font-medium" title={pc.prompt}>
                      subida
                    </span>
                  )}
                  {pc.aspectRatio && <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px]">{pc.aspectRatio}</span>}
                  {/* Versión: aparece recién cuando hay historial. v1 no se anuncia. */}
                  {(pc.history?.length || 0) > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setVersionsOf(versionsOf === pc.id ? null : pc.id); }}
                      title={`${(pc.history?.length || 0) + 1} versiones — ver anteriores`}
                      className="absolute bottom-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 hover:bg-black/80 text-white text-[9px] font-mono cursor-pointer"
                    >
                      <History size={8} /> v{(pc.history?.length || 0) + 1}
                    </button>
                  )}
                  {pc.source !== "upload" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); regeneratePiece(pc); }}
                      disabled={!!regenId}
                      title="Regenerar — la actual queda en el historial"
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-md bg-black/70 hover:bg-black/90 text-white flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity cursor-pointer disabled:opacity-40"
                    >
                      {regenId === pc.id ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                    </button>
                  )}
                  {pc.type !== "video" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditing(pc); }}
                      title="Editar — incluye pintar una zona puntual"
                      className="absolute bottom-1.5 left-1.5 h-6 px-2.5 rounded-md bg-black/70 hover:bg-black/90 text-white text-[10px] font-medium flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      Editar
                    </button>
                  )}
                  <a href={pieceUrl(pc.url)} download onClick={(e) => e.stopPropagation()} className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-md bg-black/70 hover:bg-black/90 text-white flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity" title="Descargar"><Download size={12} /></a>
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

      {/* Versiones anteriores de una pieza — volver a cualquiera. */}
      {versionsOf && (() => {
        const pc = pieces.find((p) => p.id === versionsOf);
        if (!pc || !pc.history?.length) return null;
        return (
          <div className="mt-4 rounded-[var(--radius-md)] border border-edge bg-surface-1 px-4 py-3">
            <div className="flex items-center gap-2 mb-3">
              <History size={12} className="text-fg-muted" />
              <span className="text-[12.5px] font-semibold">Versiones anteriores</span>
              <span className="text-[11px] text-fg-faint">la actual es la v{pc.history.length + 1}</span>
              <button onClick={() => setVersionsOf(null)} className="ml-auto text-fg-faint hover:text-fg cursor-pointer"><X size={13} /></button>
            </div>
            <div className="flex gap-2.5 flex-wrap">
              {pc.history.map((u, i) => (
                <button
                  key={u}
                  onClick={() => revertPiece(pc, u)}
                  title="Volver a esta versión"
                  className="group/v relative w-[74px] aspect-square rounded-[var(--radius-sm)] overflow-hidden border border-edge cursor-pointer"
                >
                  <img src={pieceUrl(u)} alt="" className="w-full h-full object-cover" />
                  <span className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-[9px] font-mono py-0.5 text-center">v{i + 1}</span>
                  <span className="absolute inset-0 bg-black/60 text-white text-[10px] font-medium opacity-0 group-hover/v:opacity-100 transition-opacity flex items-center justify-center">
                    Volver
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      </main>
      </div>

      {/* Editor de pieza — pantalla completa, con el brush de máscara. */}
      {editing && (
        <EditOverlay
          imageUrl={pieceUrl(editing.url)}
          aspectRatio={editing.aspectRatio}
          resolution={campaign.resolution}
          title={editing.label || campaign.name}
          onImageUpdated={(url) => {
            const next = campaign.pieces.map((x) => (x.id === editing.id ? { ...x, url } : x));
            setCampaign((c) => (c ? { ...c, pieces: next } : c));
            updateCampaign(campaign.id, { pieces: next }).catch(() => { /* la UI ya está al día */ });
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {/* Lightbox — fixed, va FUERA de las columnas para cubrir toda la pantalla. */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8 cursor-zoom-out" onClick={() => setLightbox(null)}>
          {pieces.find((p) => p.url === lightbox)?.type === "video" ? (
            <video src={pieceUrl(lightbox)} className="max-h-full max-w-full object-contain rounded-[var(--radius-md)]" controls autoPlay loop onClick={(e) => e.stopPropagation()} />
          ) : (
            <img src={pieceUrl(lightbox)} alt="" className="max-h-full max-w-full object-contain rounded-[var(--radius-md)]" onClick={(e) => e.stopPropagation()} />
          )}
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
