/**
 * NewCampaignPage — donde nace una campaña.
 * ────────────────────────────────────────────────────
 * PANEL + LIENZO, no formulario.
 *
 * Era un formulario con bloques numerados que te hacía scrollear hasta el final
 * para encontrar el botón, y al crear te sacaba a otra pantalla. Reportado:
 * "esta UI no le encuentro mucho sentido".
 *
 * Ahora: controles a la izquierda, lienzo a la derecha, y el botón de generar
 * SIEMPRE visible abajo del panel con el contador de piezas y el costo. Nunca
 * salís de esta pantalla. (Forma tomada de Genera Space, ver decisions-log 2026-09;
 * lo que NO copiamos es su flujo — ellos son foto fija de moda, nosotros video
 * en español con calce.)
 *
 * Lo que se conserva de la versión anterior, que sí funcionaba:
 *   · el brief se interpreta solo mientras escribís (planCampaign)
 *   · se puede adjuntar el PDF del cliente en vez de transcribirlo
 *   · los assets salen del banco de la marca, no te los vuelve a pedir
 *
 * EL ACENTO ES UNA SOLA VARIABLE (`--color-action`): lo elegido, lo urgente y la
 * acción principal. Nada más.
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { SelectorPanel } from "../components/workspace/SelectorPanel";
import { EditOverlay } from "../components/workspace/EditOverlay";
import { fetchSystemLighting, systemAssetUrl, type LightingPreset } from "../lib/api";
import { useNavigate } from "react-router";
import { ArrowLeft, Loader2, Paperclip } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import {
  createCampaign,
  updateCampaign,
  createImageEdit,
  createTextToImage,
  pollImageGen,
  type CampaignPiece,
  createKlingVideo,
  pollKlingVideo,
  saveGeneration,
  curateMotionPrompt,
  avatarImageUrl, productImageUrl, clothingImageUrl, backgroundImageUrl,
  moodboardImageUrl, lookAndFeelImageUrl, poseImageUrl,
  planCampaign, type CampaignPlan,
  briefFromFile,
} from "../lib/api";
import { imagesUsd, formatUsd } from "../lib/pricing";

const AR_OPTIONS = ["9:16", "4:5", "1:1", "16:9"];
const RES_OPTIONS = ["1K", "2K", "4K"];

/** Papel claro. Explícito y no tokenizado: esta pantalla no sigue el tema oscuro. */
// Esta pantalla tenía su propia paleta clara hardcodeada (#faf8f6) y era la única
// en blanco de toda la app — además de quedar afuera de cualquier cambio de tema.
// Ahora toma los mismos tokens que el resto: se ve bien en oscuro y en claro.
const C = {
  paper: "var(--color-surface-0)",
  paper2: "var(--color-surface-1)",
  ink: "var(--color-fg)",
  ink2: "var(--color-fg-secondary)",
  ink3: "var(--color-fg-muted)",
  // `hair` es el borde de CONTROLES (textarea, slots de asset): tiene que verse.
  // Antes apuntaba a edge-subtle (8%) y el textarea del brief era invisible sobre
  // el fondo negro. `hairSoft` queda para separadores, donde sí debe ser tenue.
  hair: "var(--color-edge)",
  hairSoft: "var(--color-edge-subtle)",
  accent: "var(--color-action)",
  accentFg: "var(--color-action-fg)",
  err: "var(--color-danger, #b4453f)",
};

const SERIF = '"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif';

type AssetItem = { id: string; name: string; thumb?: string };


/**
 * Tira de miniaturas. Todo a la vista: sin acordeón, sin "Elegir".
 * Lo seleccionado lleva un marco fino por fuera, nunca un relleno de color.
 */
function Picker({ label, hint, items, multi, selectedId, selectedIds, onSingle, onToggle }: {
  label: string;
  hint?: string;
  items: AssetItem[];
  multi?: boolean;
  selectedId?: string | null;
  selectedIds?: string[];
  onSingle?: (id: string | null) => void;
  onToggle?: (id: string) => void;
}) {
  // Se muestran las primeras; el resto se despliega en el lugar, sin cambiar de pantalla.
  const [showAll, setShowAll] = useState(false);
  if (items.length === 0) return null;
  const VISIBLE = 6;
  const shown = showAll ? items : items.slice(0, VISIBLE);
  const rest = items.length - shown.length;

  return (
    <div>
      <p className="flex items-baseline gap-2 mb-[9px]">
        <b className="text-[10px] font-semibold tracking-[.14em] uppercase">{label}</b>
        {hint && <span className="text-[10.5px] tracking-[.04em]" style={{ color: C.ink3 }}>{hint}</span>}
      </p>
      <div className="flex gap-1.5 flex-wrap">
        {shown.map((it) => {
          const on = multi ? (selectedIds || []).includes(it.id) : selectedId === it.id;
          return (
            <button
              key={it.id}
              type="button"
              title={it.name}
              onClick={() => (multi ? onToggle?.(it.id) : onSingle?.(on ? null : it.id))}
              className="w-[50px] h-[64px] rounded-[2px] overflow-hidden cursor-pointer transition-shadow"
              style={{
                background: C.paper2,
                boxShadow: on
                  ? `0 0 0 1px ${C.accent}, 0 0 0 4px ${C.paper}, 0 0 0 5px ${C.accent}`
                  : `inset 0 0 0 1px ${C.hairSoft}`,
              }}
            >
              {it.thumb
                ? <img src={it.thumb} alt={it.name} className="w-full h-full object-cover" />
                : <span className="text-[8px] px-1 block leading-tight pt-2" style={{ color: C.ink3 }}>{it.name}</span>}
            </button>
          );
        })}
        {rest > 0 && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="w-[50px] h-[64px] rounded-[2px] text-[10.5px] cursor-pointer"
            style={{ color: C.ink3, boxShadow: `inset 0 0 0 1px ${C.hair}` }}
          >
            +{rest}
          </button>
        )}
      </div>
    </div>
  );
}

/** Controles: subrayado, no pastilla. Nada grita. */
/**
 * Selector de opciones como CHIPS — mismo lenguaje que el `ChipRow` del Lab.
 *
 * Antes marcaba lo activo con un subrayado de 1.5px y un cambio de peso. Sobre
 * fondo negro eso es frágil: el subrayado se pierde y las opciones inactivas
 * (en fg-muted) casi no se leen. Ahora el activo se distingue por CONTRASTE DE
 * FONDO (blanco sobre negro), que no depende de que el ojo pesque una línea fina.
 */
/** Título del selector según el campo que lo abrió. */
const MAX_PIECES_PER_RUN = 8; // cap de costo por tanda

const PICKER_TITLES: Record<string, string> = {
  clothing: "Prendas", products: "Productos", avatar: "Modelo",
  background: "Fondo", moodboard: "Moodboard", lookFeel: "Look & feel",
  lighting: "Iluminación", pose: "Poses",
};

/**
 * Pestañas de ORIGEN por campo (ref: Genera usa Presets / Generated / Pinterest).
 * Sólo se muestran donde tienen sentido: un moodboard de la marca no viene de
 * un banco de presets del sistema.
 */
const PICKER_TABS: Record<string, Array<{ id: string; label: string }>> = {
  lighting: [
    { id: "presets", label: "Presets" },
    { id: "mine", label: "De la marca" },
    { id: "pinterest", label: "Pinterest" },
  ],
  pose: [
    { id: "presets", label: "De la marca" },
    { id: "pinterest", label: "Pinterest" },
  ],
};

/** Estado vacío de una pestaña que todavía no tiene contenido conectado. */
function EmptyTab({ tab }: { tab: string }) {
  const msg = tab === "pinterest"
    ? "Conectá una cuenta de Pinterest para traer referencias desde tus tableros."
    : "Todavía no cargaste nada tuyo acá. Subilo desde el brand kit de la marca.";
  return (
    <p className="text-[11.5px] leading-relaxed py-8 px-1 text-center" style={{ color: C.ink3 }}>
      {msg}
    </p>
  );
}

function Options({ label, options, value, values, onPick, onToggle, inline, render }: {
  label: string;
  options: Array<string | number>;
  value?: string | number;
  values?: Array<string | number>;
  onPick?: (v: never) => void;
  onToggle?: (v: never) => void;
  /** `inline`: label al lado de los chips, para la barra horizontal sobre el canvas. */
  inline?: boolean;
  /** Formato del texto del chip. Por defecto, el valor tal cual. */
  render?: (v: string | number) => string;
}) {
  return (
    <div className={inline ? "flex items-center gap-2 shrink-0" : undefined}>
      <p className={`text-[10px] font-semibold tracking-[.14em] uppercase ${inline ? "shrink-0" : "mb-2"}`} style={{ color: C.ink2 }}>{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => {
          const on = values ? values.includes(o) : value === o;
          return (
            <button
              key={String(o)}
              type="button"
              onClick={() => (onToggle ? onToggle(o as never) : onPick?.(o as never))}
              className="h-7 px-2.5 rounded-[var(--radius-sm)] text-[11.5px] font-medium tabular-nums transition-colors cursor-pointer border"
              style={{
                color: on ? C.accentFg : C.ink2,
                background: on ? C.accent : C.paper2,
                borderColor: on ? C.accent : C.hair,
              }}
            >
              {render ? render(o) : o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function NewCampaignPage() {
  const navigate = useNavigate();
  const { activeBrand } = useBrand();

  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");
  // Interpretación de lo que escribiste. El brief ya decía qué prenda, sobre quién, con qué
  // fondo y en qué formato — y el formulario te lo volvía a preguntar en tres
  // bloques. Ahora se completan solos al terminar de escribir, y quedan editables.
  const [plan, setPlan] = useState<CampaignPlan | null>(null);
  /** Piezas generadas — se dibujan en el canvas de esta misma pantalla.
   *  Antes `submit` creaba la campaña y navegaba a /campaigns/:id: generabas y te
   *  sacaba de la pantalla, sin poder seguir tocando el brief ni regenerar. */
  const [pieces, setPieces] = useState<CampaignPiece[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  /** Id de la campaña una vez creada. Se crea al primer Generar y después se reusa. */
  const [campaignId, setCampaignId] = useState<string | null>(null);
  /** Pieza abierta en el editor (overlay). `null` = ninguna. */
  const [editing, setEditing] = useState<CampaignPiece | null>(null);
  /** Ids de piezas que están animándose ahora mismo. */
  const [animating, setAnimating] = useState<Set<string>>(new Set());
  const [reading, setReading] = useState(false);
  /** Campos que tocó el usuario a mano: la interpretación no los pisa. */
  const touched = useRef<Set<string>>(new Set());
  /** Qué campo abrió el selector. `null` = cerrado.
   *  Antes era un booleano y el panel mostraba TODOS los pickers juntos:
   *  tocabas "Iluminación" y veías también prendas, productos, modelos… */
  type PickerKind = "clothing" | "products" | "avatar" | "background" | "moodboard" | "lookFeel" | "lighting" | "pose";
  const [picker, setPicker] = useState<PickerKind | null>(null);
  /** Origen de los items dentro del selector: del sistema, de la marca, o externos. */
  const [pickerTab, setPickerTab] = useState<"presets" | "mine" | "pinterest">("presets");
  // Al cambiar de campo, volver a la primera pestaña: si dejaste "Pinterest" abierto
  // en Iluminación y después abrís Poses, verías el vacío de Pinterest sin pedirlo.
  useEffect(() => { setPickerTab("presets"); }, [picker]);
  // El brief casi siempre llega como PDF del cliente. Antes había que leerlo y
  // transcribirlo a mano: "Adjuntar algo" era texto decorativo, no hacía nada.
  const [attached, setAttached] = useState<{ name: string; chars: number } | null>(null);
  const [attachErr, setAttachErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [clothingIds, setClothingIds] = useState<string[]>([]);
  const [backgroundId, setBackgroundId] = useState<string | null>(null);
  const [moodboardId, setMoodboardId] = useState<string | null>(null);
  const [lookFeelId, setLookFeelId] = useState<string | null>(null);
  /** Iluminación — preset del SISTEMA, compartido por todas las marcas
   *  (`/api/system/lighting`). No vive en el brand kit. */
  const [lightingId, setLightingId] = useState<string | null>(null);
  const [lighting, setLighting] = useState<LightingPreset[]>([]);
  useEffect(() => { fetchSystemLighting().then(setLighting).catch(() => setLighting([])); }, []);
  const [poseId, setPoseId] = useState<string | null>(null);
  const [variationsPerShot, setVariationsPerShot] = useState(2);
  const [aspectRatios, setAspectRatios] = useState<string[]>(["9:16"]);
  const [resolution, setResolution] = useState("2K");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const b = activeBrand;
  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (id: string) =>
    setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // Cuánto va a costar, con los precios reales y ANTES de crear nada.
  const pieceCount = Math.max(1, aspectRatios.length) * variationsPerShot;
  const estimate = imagesUsd(pieceCount, resolution);

  // Se dispara sola al dejar de escribir. Sin botón: se lee mientras
  // trabajás, no en un paso aparte.
  useEffect(() => {
    const text = brief.trim();
    if (!b || text.length < 15) { setPlan(null); return; }
    const t = setTimeout(async () => {
      setReading(true);
      try {
        const p = await planCampaign(b.id, text);
        setPlan(p);
        // Solo completa lo que no tocaste a mano.
        const a = p.assets || {};
        if (!touched.current.has("clothing") && a.clothingIds?.length) setClothingIds(a.clothingIds);
        if (!touched.current.has("products") && a.productIds?.length) setProductIds(a.productIds);
        if (!touched.current.has("avatar") && a.avatarId) setAvatarId(a.avatarId);
        if (!touched.current.has("background") && a.backgroundId) setBackgroundId(a.backgroundId);
        if (!touched.current.has("moodboard") && a.moodboardId) setMoodboardId(a.moodboardId);
        if (!touched.current.has("lookFeel") && a.lookFeelId) setLookFeelId(a.lookFeelId);
        if (!touched.current.has("pose") && a.poseId) setPoseId(a.poseId);
        if (!touched.current.has("ratios") && p.aspect_ratios?.length) setAspectRatios(p.aspect_ratios);
      } catch {
        // Si la interpretación falla, el formulario sigue funcionando a mano.
      } finally {
        setReading(false);
      }
    }, 900);
    return () => clearTimeout(t);
  }, [brief, b?.id]);

  /** Marca el campo como tocado a mano y aplica el cambio. La interpretación
   *  automática respeta todo lo que hayas elegido vos. */
  /** Lo que quedó seleccionado del banco de la marca — venga de la interpretación
   *  del brief o de haberlo elegido a mano. Es lo que se muestra en el bloque 02. */
  const chosen = useMemo(() => {
    if (!b) return [];
    const out: Array<{ kind: string; id: string; name: string; thumb?: string }> = [];
    (b.clothing || []).filter((c) => clothingIds.includes(c.id))
      .forEach((c) => out.push({ kind: "Prenda", id: c.id, name: c.name, thumb: c.imageUrl ? clothingImageUrl(c.imageUrl) : undefined }));
    (b.products || []).filter((x) => productIds.includes(x.id))
      .forEach((x) => out.push({ kind: "Producto", id: x.id, name: x.name, thumb: x.imageUrl ? productImageUrl(x.imageUrl) : undefined }));
    const av = (b.avatars || []).find((a) => a.id === avatarId);
    if (av) out.push({ kind: "Modelo", id: av.id, name: av.name, thumb: av.imageUrl ? avatarImageUrl(av.imageUrl) : undefined });
    const bg = (b.backgrounds || []).find((x) => x.id === backgroundId);
    if (bg) out.push({ kind: "Fondo", id: bg.id, name: bg.name, thumb: bg.imageUrl ? backgroundImageUrl(bg.imageUrl) : undefined });
    const mb = (b.moodboards || []).find((x) => x.id === moodboardId);
    if (mb) out.push({ kind: "Moodboard", id: mb.id, name: mb.name, thumb: mb.imageUrl ? moodboardImageUrl(mb.imageUrl) : undefined });
    const lf = (b.lookAndFeel || []).find((x) => x.id === lookFeelId);
    if (lf) out.push({ kind: "Look & feel", id: lf.id, name: lf.name, thumb: lf.imageUrl ? lookAndFeelImageUrl(lf.imageUrl) : undefined });
    const po = (b.poses || []).find((x) => x.id === poseId);
    if (po) out.push({ kind: "Pose", id: po.id, name: po.name, thumb: po.imageUrl ? poseImageUrl(po.imageUrl) : undefined });
    return out;
  }, [b, clothingIds, productIds, avatarId, backgroundId, moodboardId, lookFeelId, poseId]);

  const handleAttach = async (f: File | null | undefined) => {
    if (!f) return;
    setAttachErr(null);
    try {
      const r = await briefFromFile(f);
      // Se suma a lo que ya escribiste, no lo pisa.
      setBrief((prev) => (prev.trim() ? `${prev.trim()}\n\n${r.text}` : r.text));
      setAttached({ name: r.filename, chars: r.chars });
    } catch (e) {
      setAttachErr(e instanceof Error ? e.message : "No se pudo leer el archivo");
    }
  };

  const mark = <T,>(key: string, setter: (v: T) => void) => (v: T) => {
    touched.current.add(key);
    setter(v);
  };

  // OJO: este return va DESPUÉS de todos los hooks. Arriba de ellos, React saltea
  // useEffect/useMemo/useRef cuando no hay marca, la cantidad de hooks cambia entre
  // renders y la pantalla queda en blanco. Es la regla que avisa CLAUDE.md.
  if (!activeBrand || !b) {
    return <div className="p-10 text-center text-fg-muted text-[14px]">Elegí una marca en el switcher para crear una campaña.</div>;
  }

  /** Reemplaza una pieza tras editarla. Persiste en la campaña si ya existe. */
  const replacePiece = (id: string, patch: Partial<CampaignPiece>) => {
    setPieces((prev) => {
      const next = prev.map((pc) => (pc.id === id ? { ...pc, ...patch } : pc));
      if (campaignId) updateCampaign(campaignId, { pieces: next }).catch(() => { /* la UI ya está actualizada */ });
      return next;
    });
  };

  /**
   * Anima una pieza con Kling. El motion prompt lo sugiere Gemini a partir del
   * prompt de la pieza — si falla, cae a un movimiento suave genérico en vez de
   * bloquear la animación.
   */
  const animatePiece = async (pc: CampaignPiece) => {
    if (!pc.url || animating.has(pc.id)) return;
    setAnimating((prev) => new Set(prev).add(pc.id));
    try {
      let motion = "Slow, subtle camera push-in. Natural micro-movement. Keep the subject stable.";
      try {
        const c = await curateMotionPrompt("", pc.prompt || "");
        if (c.motion) motion = c.motion;
      } catch { /* el default alcanza */ }
      const job = await createKlingVideo(pc.url, motion, "5");
      // Kling a veces resuelve en la misma respuesta; si no, se poolea por request_id.
      const url = job.video_url || (await pollKlingVideo(job.request_id)).video_url;
      if (url) replacePiece(pc.id, { type: "video", url });
    } catch (e) {
      console.error("[campaign] animación falló:", e);
      setError(e instanceof Error ? e.message : "No se pudo animar la pieza");
    } finally {
      setAnimating((prev) => { const n = new Set(prev); n.delete(pc.id); return n; });
    }
  };

  /** Referencias visuales que viajan al generador. Cap de 8 — límite de Fal. */
  const buildRefs = (): string[] => {
    const refs: string[] = [];
    const avatar = (b.avatars || []).find((a) => a.id === avatarId);
    if (avatar?.imageUrl) refs.push(avatar.imageUrl);
    (b.products || []).filter((x) => productIds.includes(x.id)).forEach((x) => {
      if (x.imageUrl) refs.push(x.imageUrl);
      (x.images || []).forEach((im) => im.imageUrl && refs.push(im.imageUrl));
    });
    (b.clothing || []).filter((c) => clothingIds.includes(c.id)).forEach((c) => { if (c.imageUrl) refs.push(c.imageUrl); });
    const bg = (b.backgrounds || []).find((x) => x.id === backgroundId);
    if (bg?.imageUrl) refs.push(bg.imageUrl);
    const mb = (b.moodboards || []).find((m) => m.id === moodboardId);
    if (mb?.imageUrl) refs.push(mb.imageUrl);
    const lf = (b.lookAndFeel || []).find((l) => l.id === lookFeelId);
    if (lf?.imageUrl) refs.push(lf.imageUrl);
    return refs.slice(0, 8);
  };

  /**
   * Genera SIN salir de la pantalla: las piezas se dibujan en el canvas de al lado.
   * La campaña se crea en la primera corrida y después se reusa, así regenerar no
   * deja campañas huérfanas.
   */
  const submit = async () => {
    setSaving(true); setError(null);
    try {
      let id = campaignId;
      if (!id) {
        const c = await createCampaign({
          brandId: b.id,
          // Si no le pusieron nombre, la primera línea del brief sirve mejor que
          // "Campaña sin nombre" — que es lo que se veía en todas las campañas viejas.
          name: name.trim() || brief.trim().split("\n")[0].slice(0, 60) || "Campaña sin nombre",
          brief: brief.trim(),
          avatarId, productIds, clothingIds, backgroundId, moodboardId, lookFeelId, poseId, lightingId,
          shotPlan: "ai",
          variationsPerShot,
          aspectRatios: aspectRatios.length ? aspectRatios : ["9:16"],
          resolution,
        });
        id = c.id;
        setCampaignId(id);
      }

      const refs = buildRefs();
      if (refs.length === 0 && !b.brandContext) {
        setError("Elegí al menos un asset (producto, modelo, moodboard…) o cargá brand context.");
        setSaving(false);
        return;
      }

      const ctx = (b.brandContext || "").slice(0, 400);
      const prodNames = (b.products || []).filter((x) => productIds.includes(x.id)).map((x) => x.name).join(", ");
      const clothingNames = (b.clothing || []).filter((c) => clothingIds.includes(c.id)).map((c) => c.name).join(", ");
      const light = lighting.find((l) => l.id === lightingId);
      const basePrompt =
        `Professional advertising campaign photograph for the brand ${b.name}. ` +
        `${avatarId ? "Use the EXACT model from the identity reference (same face, hair, skin). " : ""}` +
        `${prodNames ? `Feature the product(s): ${prodNames}, reproduced faithfully from the reference. ` : ""}` +
        `${clothingNames ? `The model wears: ${clothingNames}, matched to the reference. ` : ""}` +
        `${ctx} ` +
        // El preset de iluminación inyecta SU fragmento de prompt — es lo que hace
        // que el banco de luces sirva y no sea sólo una miniatura.
        `${light ? `Lighting: ${light.prompt}. ` : ""}` +
        `High-end editorial commercial quality, sharp, photorealistic. No text, no watermark, no logo overlay.`;

      const ars = aspectRatios.length ? aspectRatios : ["9:16"];
      const shots = plan?.shots?.length
        ? plan.shots
        : Array.from({ length: variationsPerShot }, (_, i) => ({
            id: `var_${i}`, label: `Variante ${i + 1}`, why: "", framing: "", prompt: "",
          }));
      const jobs: Array<{ ar: string; shot: typeof shots[number] }> = [];
      shots.forEach((shot) => ars.forEach((ar) => jobs.push({ ar, shot })));
      const capped = jobs.slice(0, MAX_PIECES_PER_RUN);

      setProgress({ done: 0, total: capped.length });
      const fresh: CampaignPiece[] = [];
      for (let i = 0; i < capped.length; i++) {
        const { ar, shot } = capped[i];
        const shotPrompt = shot.prompt ? `${basePrompt} SHOT: ${shot.prompt}` : basePrompt;
        try {
          const job = refs.length
            ? await createImageEdit(refs, shotPrompt, ar, resolution)
            : await createTextToImage(shotPrompt, ar, resolution);
          const r = await pollImageGen(job.request_id);
          fresh.push({ id: `pc_${pieces.length + i}_${ar}_${i}`, url: r.image_url || "", type: "image", aspectRatio: ar, prompt: shotPrompt, label: shot.label || undefined, status: r.image_url ? "done" : "failed" });
        } catch (e) {
          console.error("[campaign] pieza falló:", e);
          fresh.push({ id: `pc_${pieces.length + i}_${ar}_${i}`, url: "", type: "image", aspectRatio: ar, prompt: shotPrompt, label: shot.label || undefined, status: "failed" });
        }
        setProgress((pr) => ({ ...pr, done: pr.done + 1 }));
        setPieces((prev) => [...prev, fresh[fresh.length - 1]]);
      }

      // Persistir en la campaña. Si falla, las piezas siguen visibles en memoria.
      try { await updateCampaign(id, { pieces: [...pieces, ...fresh], status: "review" }); } catch { /* noop */ }

      // Y guardarlas TAMBIÉN como generations, tagueadas con la campaña: así la
      // biblioteca (Contenido) las ve. Antes vivían sólo dentro de `campaign.pieces`
      // y nunca aparecían ahí — dos almacenes que no se cruzaban.
      for (const pc of fresh) {
        if (!pc.url) continue;
        try {
          await saveGeneration({
            brandId: b.id,
            campaignId: id,
            toolId: "campaign",
            title: pc.label || name.trim() || "Pieza de campaña",
            type: pc.type === "video" ? "video" : "image",
            status: "completed",
            thumbnailUrl: pc.url,
            outputUrl: pc.url,
            metadata: { prompt: pc.prompt, aspectRatio: pc.aspectRatio, campaignName: name.trim() },
          });
        } catch { /* la pieza ya está en la campaña; el índice puede reintentarse */ }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar");
    } finally {
      setSaving(false);
    }
  };

  /** Un control del panel: rótulo + miniatura de lo elegido + acción.
   *  La miniatura importa — en los acordeones viejos no veías qué habías elegido
   *  sin abrirlos. */
  const Control = ({ label, items, onOpen, empty }: {
    label: string;
    items: Array<{ id: string; name: string; thumb?: string }>;
    onOpen: () => void;
    empty: string;
  }) => (
    /* Mismas medidas que el <SelectorTrigger> del Lab: alto fijo 44px, borde
       visible, fondo propio. Antes era un botón sin borde con padding libre —
       al lado del Lab se veía como otro control. */
    <button
      onClick={onOpen}
      className="w-full text-left px-3 h-11 rounded-[var(--radius-sm)] transition-colors cursor-pointer border"
      style={{ background: "var(--color-surface-1)", borderColor: C.hair }}
    >
      <div className="flex items-center gap-2.5 h-full">
        <div className="flex -space-x-1.5 shrink-0">
          {items.length > 0 ? (
            items.slice(0, 3).map((it) => (
              <div key={it.id} className="w-7 h-7 rounded-[3px] overflow-hidden ring-1 ring-[var(--color-surface-0)]"
                   style={{ background: C.paper2, border: `1px solid ${C.hair}` }}>
                {it.thumb && <img src={it.thumb} alt="" className="w-full h-full object-cover" />}
              </div>
            ))
          ) : (
            <div className="w-7 h-7 rounded-[3px]" style={{ background: C.paper2, border: `1px dashed var(--color-edge-strong)` }} />
          )}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          {/* La etiqueta (PRENDAS, MODELO…) es lo que identifica la fila: va en ink2,
              no en ink3. Con el más apagado sobre negro se perdía. */}
          <div className="text-[12px] font-medium leading-tight" style={{ color: C.ink }}>{label}</div>
          <div className="text-[11px] leading-tight truncate" style={{ color: C.ink3 }}>
            {items.length === 0 ? empty
              : items.length === 1 ? items[0].name
              : `${items.length} elegidos`}
          </div>
        </div>
      </div>
    </button>
  );

  const byKind = (kind: string) => chosen.filter((c) => c.kind === kind);

  return (
    /* Misma estructura que el Lab: header arriba a todo el ancho, y debajo el
       panel + área de trabajo. Antes esta pantalla no tenía header —el título
       vivía dentro del panel— y por eso se leía como otra app. */
    <div className="h-full flex flex-col overflow-hidden" style={{ background: "var(--color-canvas)", color: C.ink }}>

      <header className="border-b border-edge px-5 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/dashboard/campanas")}
                  className="w-7 h-7 rounded-md bg-[var(--color-action-subtle)] flex items-center justify-center cursor-pointer hover:bg-[var(--color-surface-2)] transition-colors"
                  title="Volver a Campañas">
            <ArrowLeft size={14} className="text-[var(--color-action)]" />
          </button>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nueva campaña"
            className="bg-transparent outline-none text-[14px] font-semibold text-fg leading-none min-w-[180px]"
          />
        </div>
        <div className="flex items-center gap-3 text-[11px] text-fg-muted">
          <span className="uppercase tracking-[.09em]">{b.name}</span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">

      {/* ── PANEL ─────────────────────────────────────────────────── */}
      <aside className="w-[420px] shrink-0 flex flex-col h-full" style={{ background: "var(--color-surface-0)", borderRight: `1px solid ${C.hair}` }}>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          {/* El brief — lo primero y lo único obligatorio */}
          <div className="px-1 pb-1">
            <div className="flex items-baseline gap-2 border-b pb-1.5 mb-2.5" style={{ borderColor: "var(--color-edge-subtle)" }}>
              <span className="text-[11px] font-semibold tracking-tight" style={{ color: C.ink }}>El brief</span>
            </div>
            <textarea
              autoFocus
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={5}
              placeholder="Qué hay que hacer. O adjuntá el PDF del cliente."
              className="w-full bg-transparent outline-none resize-none rounded-[5px] p-2.5"
              style={{ fontFamily: SERIF, fontSize: 14, lineHeight: 1.5, color: C.ink, border: `1px solid ${C.hair}` }}
            />
            <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
              <input ref={fileRef} type="file" accept=".pdf,.txt,.md" className="hidden"
                     onChange={(e) => { handleAttach(e.target.files?.[0]); e.target.value = ""; }} />
              <button onClick={() => fileRef.current?.click()}
                      className="inline-flex items-center gap-1.5 text-[11px] cursor-pointer" style={{ color: C.ink3 }}>
                <Paperclip size={10} /> {attached ? "Otro archivo" : "Adjuntar"}
              </button>
              {reading && (
                <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: C.ink3 }}>
                  <Loader2 size={9} className="animate-spin" /> leyendo…
                </span>
              )}
              {attached && <span className="text-[11px] truncate" style={{ color: C.ink2 }}>{attached.name}</span>}
            </div>
            {attachErr && <p className="text-[11px] mt-1" style={{ color: C.err }}>{attachErr}</p>}
          </div>

          <div className="h-px mx-1 my-2" style={{ background: C.hair }} />

          {/* Los assets — salen del banco de la marca */}
          <Control label="Prendas"    items={byKind("Prenda")}    onOpen={() => setPicker("clothing")} empty="del banco de la marca" />
          <Control label="Productos"  items={byKind("Producto")}  onOpen={() => setPicker("products")} empty="ninguno" />
          <Control label="Modelo"     items={byKind("Modelo")}    onOpen={() => setPicker("avatar")} empty="ninguno" />
          <Control label="Fondo"      items={byKind("Fondo")}     onOpen={() => setPicker("background")} empty="estudio" />
          <Control label="Moodboard"  items={byKind("Moodboard")} onOpen={() => setPicker("moodboard")} empty="ninguno" />
          {/* Iluminación — preset del sistema, no del brand kit. Por eso `items` sale
              de `lighting` y no de `byKind()`. */}
          <Control
            label="Iluminación"
            items={lightingId ? lighting.filter((l) => l.id === lightingId).map((l) => ({ id: l.id, name: l.name, thumb: systemAssetUrl(l.imageUrl) })) : []}
            onOpen={() => setPicker("lighting")}
            empty="automática"
          />

        </div>

        {/* El botón de generar: SIEMPRE visible, con lo que va a salir y lo que cuesta.
            Antes había que scrollear hasta el final del formulario para encontrarlo. */}
        <div className="px-5 pt-3 pb-4" style={{ borderTop: `1px solid ${C.hairSoft}` }}>
          {error && <p className="text-[11.5px] mb-2" style={{ color: C.err }}>{error}</p>}
          {/* Se apaga sin brief, igual que el Lab se apaga sin prompt: el botón
              refleja si REALMENTE se puede generar, no solo si está guardando.
              Antes se podía apretar con el formulario vacío. */}
          <button
            onClick={submit}
            disabled={saving || !brief.trim()}
            className="w-full h-11 rounded-[var(--radius-sm)] text-[13px] font-semibold transition-colors flex items-center justify-center gap-2"
            style={
              saving || !brief.trim()
                ? { background: "var(--color-surface-2)", color: "var(--color-fg-faint)", cursor: "not-allowed" }
                : { background: C.accent, color: C.accentFg, cursor: "pointer" }
            }
          >
            {saving
              ? <><Loader2 size={13} className="animate-spin" /> {progress.total ? `${progress.done}/${progress.total}` : "Creando…"}</>
              : <>{pieces.length > 0 ? "Generar más" : "Generar"} · {plan?.shots?.length ? plan.shots.length * Math.max(1, aspectRatios.length) : pieceCount} piezas</>}
          </button>
          <div className="text-[10.5px] text-center mt-2" style={{ color: C.ink2 }}>
            ≈ {formatUsd(estimate)} · {resolution}
          </div>
        </div>
      </aside>

      {/* ── LIENZO ────────────────────────────────────────────────── */}
      {/* ── Columna del MEDIO: banco de assets ───────────────────────────
           Antes los pickers REEMPLAZABAN el lienzo ("se abren ACÁ, en el lienzo"):
           mientras elegías prendas perdías de vista el plan de tomas. Ahora es la
           columna del medio del workspace de 3 columnas — empuja el lienzo, que
           sigue visible. Mismo patrón que el Lab (ver components/workspace). */}
      {/* Un picker por vez — el que abrió el campo. Con pestañas de ORIGEN
           (Presets del sistema / De la marca / Pinterest), como en Genera. */}
      <SelectorPanel
        open={picker !== null}
        title={picker ? PICKER_TITLES[picker] : ""}
        onClose={() => setPicker(null)}
        width={340}
        tabs={picker ? PICKER_TABS[picker] : undefined}
        activeTab={pickerTab}
        onTabChange={(id) => setPickerTab(id as typeof pickerTab)}
      >
        {picker === "clothing" && (
          <Picker label="Prendas" hint={String((b.clothing || []).length)} multi
                  items={(b.clothing || []).map((c) => ({ id: c.id, name: c.name, thumb: c.imageUrl ? clothingImageUrl(c.imageUrl) : undefined }))}
                  selectedIds={clothingIds} onToggle={mark("clothing", toggle(setClothingIds))} />
        )}
        {picker === "products" && (
          <Picker label="Productos" hint={String((b.products || []).length)} multi
                  items={(b.products || []).map((x) => ({ id: x.id, name: x.name, thumb: x.imageUrl ? productImageUrl(x.imageUrl) : undefined }))}
                  selectedIds={productIds} onToggle={mark("products", toggle(setProductIds))} />
        )}
        {picker === "avatar" && (
          <Picker label="Modelo" hint={String((b.avatars || []).length)}
                  items={(b.avatars || []).map((a) => ({ id: a.id, name: a.name, thumb: a.imageUrl ? avatarImageUrl(a.imageUrl) : undefined }))}
                  selectedId={avatarId} onSingle={mark("avatar", setAvatarId)} />
        )}
        {picker === "background" && (
          <Picker label="Fondo" hint="opcional"
                  items={(b.backgrounds || []).map((x) => ({ id: x.id, name: x.name, thumb: x.imageUrl ? backgroundImageUrl(x.imageUrl) : undefined }))}
                  selectedId={backgroundId} onSingle={mark("background", setBackgroundId)} />
        )}
        {picker === "moodboard" && (
          <Picker label="Moodboard" hint="dirección"
                  items={(b.moodboards || []).map((m) => ({ id: m.id, name: m.name, thumb: m.imageUrl ? moodboardImageUrl(m.imageUrl) : undefined }))}
                  selectedId={moodboardId} onSingle={mark("moodboard", setMoodboardId)} />
        )}
        {picker === "lookFeel" && (
          <Picker label="Look & feel" hint="color"
                  items={(b.lookAndFeel || []).map((l) => ({ id: l.id, name: l.name, thumb: l.imageUrl ? lookAndFeelImageUrl(l.imageUrl) : undefined }))}
                  selectedId={lookFeelId} onSingle={mark("lookFeel", setLookFeelId)} />
        )}
        {picker === "lighting" && (
          pickerTab === "presets" ? (
            <Picker label="Iluminación" hint={`${lighting.length} presets`}
                    items={lighting.map((l) => ({ id: l.id, name: l.name, thumb: systemAssetUrl(l.imageUrl) }))}
                    selectedId={lightingId} onSingle={mark("lighting", setLightingId)} />
          ) : (
            <EmptyTab tab={pickerTab} />
          )
        )}
        {picker === "pose" && (
          pickerTab === "pinterest" ? <EmptyTab tab="pinterest" /> : (
            <Picker label="Poses" hint="estrictas"
                    items={(b.poses || []).map((x) => ({ id: x.id, name: x.name, thumb: x.imageUrl ? poseImageUrl(x.imageUrl) : undefined }))}
                    selectedId={poseId} onSingle={mark("pose", setPoseId)} />
          )
        )}
      </SelectorPanel>

      {/* Columna derecha: barra de parámetros + área de trabajo.
          Los parámetros de CORRIDA (formato / variantes / resolución) viven acá
          arriba y no en el panel del brief — misma decisión que en el Lab:
          "run parameters live here, what defines WHAT gets generated lives in
          the brief". */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="shrink-0 flex items-center gap-5 px-4 h-12 overflow-x-auto no-scrollbar" style={{ borderBottom: `1px solid ${C.hair}` }}>
          {/* Mismo orden, mismos nombres y mismo formato de valores que el Lab:
              Formato → Resolución → Variantes, singular, y las variantes con "×". */}
          <Options inline label="Formato" options={AR_OPTIONS} values={aspectRatios}
                   onToggle={(ar) => { touched.current.add("ratios"); setAspectRatios((prev) => (prev.includes(ar) ? prev.filter((x) => x !== ar) : [...prev, ar])); }} />
          <Options inline label="Resolución" options={RES_OPTIONS} value={resolution} onPick={setResolution} />
          <Options inline label="Variantes" options={[1, 2, 3, 4]} value={variationsPerShot} onPick={setVariationsPerShot}
                   render={(v) => `${v}×`} />
        </div>
      <main
        className="flex-1 overflow-y-auto relative"
        style={{ background: "radial-gradient(ellipse 50% 30% at 50% 0%, var(--color-surface-0), var(--color-canvas) 80%)" }}
      >
        {plan ? (
          /* Lo que entendió del brief: el plan de tomas */
          <div className="p-8 max-w-[680px]">
            <p className="text-[15px] leading-relaxed mb-6" style={{ fontFamily: SERIF, color: C.ink }}>
              {plan.interpretation}
            </p>

            <div className="text-[9.5px] uppercase tracking-[.1em] mb-2.5" style={{ color: C.ink3 }}>
              {plan.shots.length} tomas
            </div>
            <div style={{ borderTop: `1px solid ${C.hair}` }}>
              {plan.shots.map((sh, i) => (
                <div key={sh.id} className="flex gap-3.5 py-2.5" style={{ borderBottom: `1px solid ${C.hair}` }}>
                  <span className="text-[10px] font-mono tabular-nums w-4 shrink-0 pt-0.5" style={{ color: C.ink3 }}>{i + 1}</span>
                  <div className="min-w-0">
                    <div className="text-[13px]" style={{ color: C.ink }}>{sh.label}</div>
                    {sh.why && <div className="text-[11.5px] mt-0.5" style={{ color: C.ink3 }}>{sh.why}</div>}
                  </div>
                </div>
              ))}
            </div>

            {plan.needs_video && (
              <p className="text-[11.5px] mt-4" style={{ color: C.ink3 }}>
                Mencionaste video. Por ahora salen las imágenes; el reel se arma después desde Fashion Reel.
              </p>
            )}

            {plan.assumptions.length > 0 && (
              <div className="mt-6">
                <div className="flex items-baseline gap-2 border-b pb-1.5 mb-2.5" style={{ borderColor: "var(--color-edge-subtle)" }}>
                  <span className="text-[11px] font-semibold tracking-tight" style={{ color: C.ink }}>Asumimos</span>
                </div>
                {plan.assumptions.slice(0, 4).map((a, i) => (
                  <p key={i} className="text-[11.5px] leading-snug mb-1" style={{ color: C.ink3 }}>· {a}</p>
                ))}
              </div>
            )}
          </div>
        ) : pieces.length > 0 || progress.total > 0 ? (
          /* Piezas generadas — el resultado vive ACÁ, no en otra pantalla. */
          <div className="p-6">
            <div className="flex items-baseline justify-between mb-4">
              <span className="text-[11px] uppercase tracking-[.12em]" style={{ color: C.ink2 }}>
                {pieces.length} {pieces.length === 1 ? "pieza" : "piezas"}
              </span>
              {saving && progress.total > 0 && (
                <span className="text-[11px] tabular-nums" style={{ color: C.ink3 }}>
                  generando {progress.done}/{progress.total}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {pieces.map((pc) => (
                <figure key={pc.id} className="group relative rounded-[var(--radius-sm)] overflow-hidden"
                        style={{ background: C.paper2, border: `1px solid ${C.hair}` }}>
                  {pc.url && pc.type === "video" ? (
                    <video src={pc.url} controls loop muted playsInline className="w-full h-full object-cover"
                           style={{ aspectRatio: pc.aspectRatio.replace(":", "/") }} />
                  ) : pc.url ? (
                    <img src={pc.url} alt={pc.label || ""} className="w-full h-full object-cover"
                         style={{ aspectRatio: pc.aspectRatio.replace(":", "/") }} />
                  ) : (
                    <div className="flex items-center justify-center text-[11px]"
                         style={{ aspectRatio: pc.aspectRatio.replace(":", "/"), color: C.err }}>
                      falló
                    </div>
                  )}

                  {/* Acciones — aparecen en hover sobre la pieza. Editar abre el mismo
                      ImageEditPanel que usan las tools; Animar manda a Kling. */}
                  {pc.url && pc.type !== "video" && (
                    <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditing(pc)}
                        title="Editar esta pieza"
                        className="h-6 px-2 rounded text-[10px] font-medium backdrop-blur cursor-pointer"
                        style={{ background: "rgba(0,0,0,.6)", color: "#fff" }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => animatePiece(pc)}
                        disabled={animating.has(pc.id)}
                        title="Animar esta pieza con Kling"
                        className="h-6 px-2 rounded text-[10px] font-medium backdrop-blur cursor-pointer disabled:opacity-60"
                        style={{ background: "rgba(0,0,0,.6)", color: "#fff" }}
                      >
                        {animating.has(pc.id) ? "Animando…" : "Animar"}
                      </button>
                    </div>
                  )}

                  {animating.has(pc.id) && (
                    <div className="absolute inset-0 flex items-center justify-center text-[11px] text-white"
                         style={{ background: "rgba(0,0,0,.55)" }}>
                      <Loader2 size={14} className="animate-spin mr-1.5" /> Animando…
                    </div>
                  )}

                  {pc.label && (
                    <figcaption className="absolute inset-x-0 bottom-0 px-2 py-1 text-[10px] text-white/90 truncate pointer-events-none"
                                style={{ background: "linear-gradient(to top, rgba(0,0,0,.8), transparent)" }}>
                      {pc.label}
                    </figcaption>
                  )}
                </figure>
              ))}
              {/* Placeholders de lo que falta en esta tanda */}
              {saving && Array.from({ length: Math.max(0, progress.total - pieces.length) }).map((_, i) => (
                <div key={`ph${i}`} className="rounded-[var(--radius-sm)] animate-pulse"
                     style={{ aspectRatio: "4/5", background: C.paper2, border: `1px solid ${C.hair}` }} />
              ))}
            </div>
          </div>
        ) : (
          /* En reposo */
          <div className="h-full flex items-center justify-center">
            <p className="text-[13px] max-w-[300px] text-center leading-relaxed" style={{ color: C.ink3 }}>
              {reading
                ? "Leyendo el brief…"
                : "Escribí el brief a la izquierda y acá vas a ver qué entendimos y qué tomas se van a generar."}
            </p>
          </div>
        )}
      </main>
      </div>
      </div>

      {/* Editor de pieza — overlay. Reusa el ImageEditPanel de las tools, así el
          editar de campañas y el de las tools se comportan igual. */}
      {editing && (
        <EditOverlay
          imageUrl={editing.url}
          aspectRatio={editing.aspectRatio}
          resolution={resolution}
          title={editing.label || "Editar pieza"}
          onImageUpdated={(url) => { replacePiece(editing.id, { url }); setEditing(null); }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
