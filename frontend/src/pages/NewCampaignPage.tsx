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
import { useNavigate } from "react-router";
import { ArrowLeft, Loader2, Paperclip } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import {
  createCampaign,
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
  hair: "var(--color-edge-subtle)",
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
function Options({ label, options, value, values, onPick, onToggle }: {
  label: string;
  options: Array<string | number>;
  value?: string | number;
  values?: Array<string | number>;
  onPick?: (v: never) => void;
  onToggle?: (v: never) => void;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-[.14em] uppercase mb-[9px]" style={{ color: C.ink3 }}>{label}</p>
      <div className="flex gap-[18px]">
        {options.map((o) => {
          const on = values ? values.includes(o) : value === o;
          return (
            <button
              key={String(o)}
              type="button"
              onClick={() => (onToggle ? onToggle(o as never) : onPick?.(o as never))}
              className="text-[12.5px] pb-1 cursor-pointer transition-colors"
              style={{
                color: on ? C.ink : C.ink3,
                fontWeight: on ? 600 : 400,
                borderBottom: `1.5px solid ${on ? C.accent : "transparent"}`,
              }}
            >
              {o}
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
  const [reading, setReading] = useState(false);
  /** Campos que tocó el usuario a mano: la interpretación no los pisa. */
  const touched = useRef<Set<string>>(new Set());
  const [showPickers, setShowPickers] = useState(false);
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

  const submit = async () => {
    setSaving(true); setError(null);
    try {
      const c = await createCampaign({
        brandId: b.id,
        // Si no le pusieron nombre, la primera línea del brief sirve mejor que
        // "Campaña sin nombre" — que es lo que se veía en todas las campañas viejas.
        name: name.trim() || brief.trim().split("\n")[0].slice(0, 60) || "Campaña sin nombre",
        brief: brief.trim(),
        avatarId, productIds, clothingIds, backgroundId, moodboardId, lookFeelId, poseId,
        shotPlan: "ai",
        variationsPerShot,
        aspectRatios: aspectRatios.length ? aspectRatios : ["9:16"],
        resolution,
      });
      navigate(`/dashboard/campaigns/${c.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la campaña");
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
    <button
      onClick={onOpen}
      className="w-full text-left px-3 py-2.5 rounded-[5px] transition-colors cursor-pointer hover:bg-[var(--color-surface-2)]"
    >
      <div className="flex items-center gap-2.5">
        <div className="flex -space-x-1.5 shrink-0">
          {items.length > 0 ? (
            items.slice(0, 3).map((it) => (
              <div key={it.id} className="w-7 h-7 rounded-[3px] overflow-hidden ring-1 ring-[var(--color-surface-0)]"
                   style={{ background: C.paper2, border: `1px solid ${C.hair}` }}>
                {it.thumb && <img src={it.thumb} alt="" className="w-full h-full object-cover" />}
              </div>
            ))
          ) : (
            <div className="w-7 h-7 rounded-[3px]" style={{ background: C.paper2, border: `1px dashed ${C.hair}` }} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[9.5px] uppercase tracking-[.1em]" style={{ color: C.ink3 }}>{label}</div>
          <div className="text-[12px] truncate" style={{ color: items.length ? C.ink2 : C.ink3 }}>
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
    <div className="flex h-screen -m-6 md:-m-8" style={{ background: C.paper, color: C.ink }}>

      {/* ── PANEL ─────────────────────────────────────────────────── */}
      <aside className="w-[340px] shrink-0 flex flex-col h-full" style={{ borderRight: `1px solid ${C.hair}` }}>

        <div className="px-4 pt-4 pb-3" style={{ borderBottom: `1px solid ${C.hair}` }}>
          <button onClick={() => navigate("/dashboard/campanas")}
                  className="inline-flex items-center gap-1.5 text-[11.5px] mb-2.5 cursor-pointer" style={{ color: C.ink3 }}>
            <ArrowLeft size={11} /> Campañas
          </button>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nueva campaña"
            className="w-full bg-transparent outline-none"
            style={{ fontFamily: SERIF, fontSize: 21, color: C.ink }}
          />
          <div className="text-[10.5px] uppercase tracking-[.09em] mt-1" style={{ color: C.ink3 }}>{b.name}</div>
        </div>

        <div className="flex-1 overflow-y-auto px-2.5 py-3 flex flex-col gap-1">

          {/* El brief — lo primero y lo único obligatorio */}
          <div className="px-1 pb-1">
            <div className="text-[9.5px] uppercase tracking-[.1em] mb-1.5" style={{ color: C.ink3 }}>El brief</div>
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
          <Control label="Prendas"   items={byKind("Prenda")}    onOpen={() => setShowPickers(true)} empty="del banco de la marca" />
          <Control label="Productos" items={byKind("Producto")}  onOpen={() => setShowPickers(true)} empty="ninguno" />
          <Control label="Modelo"    items={byKind("Modelo")}    onOpen={() => setShowPickers(true)} empty="ninguno" />
          <Control label="Fondo"     items={byKind("Fondo")}     onOpen={() => setShowPickers(true)} empty="estudio" />
          <Control label="Moodboard" items={byKind("Moodboard")} onOpen={() => setShowPickers(true)} empty="ninguno" />

          <div className="h-px mx-1 my-2" style={{ background: C.hair }} />

          {/* La salida */}
          <div className="px-1 flex flex-col gap-3">
            <Options label="Formatos" options={AR_OPTIONS} values={aspectRatios}
                     onToggle={(ar) => { touched.current.add("ratios"); setAspectRatios((prev) => (prev.includes(ar) ? prev.filter((x) => x !== ar) : [...prev, ar])); }} />
            <Options label="Variantes" options={[1, 2, 3, 4]} value={variationsPerShot} onPick={setVariationsPerShot} />
            <Options label="Resolución" options={RES_OPTIONS} value={resolution} onPick={setResolution} />
          </div>
        </div>

        {/* El botón de generar: SIEMPRE visible, con lo que va a salir y lo que cuesta.
            Antes había que scrollear hasta el final del formulario para encontrarlo. */}
        <div className="px-3 py-3" style={{ borderTop: `1px solid ${C.hair}` }}>
          {error && <p className="text-[11.5px] mb-2" style={{ color: C.err }}>{error}</p>}
          <button
            onClick={submit}
            disabled={saving}
            className="w-full h-11 rounded-[6px] text-[13px] font-semibold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: C.accent, color: C.accentFg }}
          >
            {saving
              ? <><Loader2 size={13} className="animate-spin" /> Creando…</>
              : <>Generar · {plan?.shots?.length ? plan.shots.length * Math.max(1, aspectRatios.length) : pieceCount} piezas</>}
          </button>
          <div className="text-[10.5px] text-center mt-1.5" style={{ color: C.ink3 }}>
            ≈ {formatUsd(estimate)} · {resolution}
          </div>
        </div>
      </aside>

      {/* ── LIENZO ────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        {showPickers ? (
          /* Los selectores se abren ACÁ, en el lienzo — no empujan el panel */
          <div className="p-6 max-w-[900px]">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[16px]" style={{ fontFamily: SERIF, color: C.ink }}>Elegir del banco de {b.name}</h2>
              <button onClick={() => setShowPickers(false)}
                      className="text-[12px] px-3 py-1.5 rounded-[5px] cursor-pointer"
                      style={{ color: C.ink2, border: `1px solid ${C.hair}` }}>Listo</button>
            </div>
            <div className="flex gap-9 flex-wrap">
              <Picker label="Prendas" hint={String((b.clothing || []).length)} multi
                      items={(b.clothing || []).map((c) => ({ id: c.id, name: c.name, thumb: c.imageUrl ? clothingImageUrl(c.imageUrl) : undefined }))}
                      selectedIds={clothingIds} onToggle={mark("clothing", toggle(setClothingIds))} />
              <Picker label="Productos" hint={String((b.products || []).length)} multi
                      items={(b.products || []).map((x) => ({ id: x.id, name: x.name, thumb: x.imageUrl ? productImageUrl(x.imageUrl) : undefined }))}
                      selectedIds={productIds} onToggle={mark("products", toggle(setProductIds))} />
              <Picker label="Modelo" hint={String((b.avatars || []).length)}
                      items={(b.avatars || []).map((a) => ({ id: a.id, name: a.name, thumb: a.imageUrl ? avatarImageUrl(a.imageUrl) : undefined }))}
                      selectedId={avatarId} onSingle={mark("avatar", setAvatarId)} />
              <Picker label="Fondo" hint="opcional"
                      items={(b.backgrounds || []).map((x) => ({ id: x.id, name: x.name, thumb: x.imageUrl ? backgroundImageUrl(x.imageUrl) : undefined }))}
                      selectedId={backgroundId} onSingle={mark("background", setBackgroundId)} />
              <Picker label="Moodboard" hint="dirección"
                      items={(b.moodboards || []).map((m) => ({ id: m.id, name: m.name, thumb: m.imageUrl ? moodboardImageUrl(m.imageUrl) : undefined }))}
                      selectedId={moodboardId} onSingle={mark("moodboard", setMoodboardId)} />
              <Picker label="Look & feel" hint="color"
                      items={(b.lookAndFeel || []).map((l) => ({ id: l.id, name: l.name, thumb: l.imageUrl ? lookAndFeelImageUrl(l.imageUrl) : undefined }))}
                      selectedId={lookFeelId} onSingle={mark("lookFeel", setLookFeelId)} />
              <Picker label="Poses" hint="estrictas"
                      items={(b.poses || []).map((x) => ({ id: x.id, name: x.name, thumb: x.imageUrl ? poseImageUrl(x.imageUrl) : undefined }))}
                      selectedId={poseId} onSingle={mark("pose", setPoseId)} />
            </div>
          </div>
        ) : plan ? (
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
                <div className="text-[9.5px] uppercase tracking-[.1em] mb-1.5" style={{ color: C.ink3 }}>Asumimos</div>
                {plan.assumptions.slice(0, 4).map((a, i) => (
                  <p key={i} className="text-[11.5px] leading-snug mb-1" style={{ color: C.ink3 }}>· {a}</p>
                ))}
              </div>
            )}
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
  );
}
