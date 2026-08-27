/**
 * NewCampaignPage — el pedido. Donde nace el trabajo.
 * ────────────────────────────────────────────────────
 * Rehecha entera. La versión anterior era un formulario de configuración: cuatro
 * acordeones grises que decían "Elegir" (elegías un moodboard sin ver ningún moodboard),
 * y el nombre de la campaña pesaba lo mismo que la resolución.
 *
 * Ahora son cuatro filas en orden de importancia — qué necesitamos · cómo se ve esta vez ·
 * con qué · qué sale — con el rótulo en el margen izquierdo y el contenido a la derecha.
 * La jerarquía la hace la grilla, no un borde alrededor de cada cosa.
 *
 * PALETA: papel claro, sin cajas, líneas finas. Es un piloto deliberado — el resto de la
 * app sigue oscura. Se probó acá primero porque es la pantalla más importante y la que
 * peor estaba. Ver docs/decisions-log.md 2026-08.
 *
 * EL ACENTO ES UNA SOLA VARIABLE (`--accent`, hoy tinta). Cuando haya un color de Coevo va
 * ahí y aparece en los tres únicos lugares donde importa: lo elegido, lo urgente y la
 * acción principal. El problema del diseño viejo era un mismo naranja marcando las tres
 * cosas hasta no significar ninguna.
 */

import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Loader2, Paperclip } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import {
  createCampaign,
  avatarImageUrl, productImageUrl, clothingImageUrl, backgroundImageUrl,
  moodboardImageUrl, lookAndFeelImageUrl, poseImageUrl,
} from "../lib/api";
import { imagesUsd, formatUsd } from "../lib/pricing";

const AR_OPTIONS = ["9:16", "4:5", "1:1", "16:9"];
const RES_OPTIONS = ["1K", "2K", "4K"];

/** Papel claro. Explícito y no tokenizado: esta pantalla no sigue el tema oscuro. */
const C = {
  paper: "#faf8f6",
  paper2: "#f4f1ed",
  ink: "#1a1817",
  ink2: "#6b6560",
  ink3: "#9c948d",
  hair: "#e2ddd7",
  hairSoft: "#eeeae5",
  accent: "#1a1817", // ← acá va el color de Coevo cuando exista
  err: "#b4453f",
};

const SERIF = '"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif';

type AssetItem = { id: string; name: string; thumb?: string };

/** Rótulo del margen izquierdo. */
function Gutter({ n, title, hint }: { n: string; title: string; hint?: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] tracking-[.18em]" style={{ color: C.ink3 }}>{n}</p>
      <p className="text-[13px] font-semibold mt-[7px] tracking-[-.005em]">{title}</p>
      {hint && <p className="text-[11.5px] mt-[5px] leading-snug" style={{ color: C.ink3 }}>{hint}</p>}
    </div>
  );
}

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

  if (!activeBrand) {
    return <div className="p-10 text-center text-fg-muted text-[14px]">Elegí una marca en el switcher para crear un pedido.</div>;
  }

  const b = activeBrand;
  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (id: string) =>
    setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // Cuánto va a costar, con los precios reales y ANTES de crear nada.
  const pieceCount = Math.max(1, aspectRatios.length) * variationsPerShot;
  const estimate = imagesUsd(pieceCount, resolution);

  const submit = async () => {
    setSaving(true); setError(null);
    try {
      const c = await createCampaign({
        brandId: b.id,
        // Si no le pusieron nombre, la primera línea del brief sirve mejor que
        // "Campaña sin nombre" — que es lo que se veía en todos los pedidos viejos.
        name: name.trim() || brief.trim().split("\n")[0].slice(0, 60) || "Pedido sin nombre",
        brief: brief.trim(),
        avatarId, productIds, clothingIds, backgroundId, moodboardId, lookFeelId, poseId,
        shotPlan: "ai",
        variationsPerShot,
        aspectRatios: aspectRatios.length ? aspectRatios : ["9:16"],
        resolution,
      });
      navigate(`/dashboard/campaigns/${c.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el pedido");
      setSaving(false);
    }
  };

  const rowStyle = { borderTop: `1px solid ${C.hair}` };

  return (
    <div className="min-h-screen -m-6 md:-m-8" style={{ background: C.paper, color: C.ink }}>
      <div className="max-w-[980px] mx-auto px-8 md:px-12 py-9">
        <button
          onClick={() => navigate("/dashboard/trabajo")}
          className="flex items-center gap-1.5 text-[12px] cursor-pointer mb-5"
          style={{ color: C.ink3 }}
        >
          <ArrowLeft size={13} /> Trabajo
        </button>

        <h1 className="text-[34px] leading-[1.05] tracking-[-.02em] font-normal" style={{ fontFamily: SERIF }}>
          Nuevo pedido
        </h1>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`${b.name.toUpperCase()} · ponerle un nombre (opcional)`}
          className="mt-2 w-full max-w-[440px] bg-transparent text-[12px] tracking-[.02em] outline-none"
          style={{ color: C.ink2 }}
        />

        {/* ── 01 · el brief ── */}
        <div className="grid grid-cols-1 md:grid-cols-[170px_1fr] gap-x-9 gap-y-4 py-7 mt-7" style={rowStyle}>
          <Gutter n="01" title="Qué necesitamos" hint="Lo único obligatorio" />
          <div>
            <textarea
              autoFocus
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={4}
              placeholder="Cápsula de invierno para el drop del 15. Remeras A27 sobre modelo, fondo estudio, y un reel corto para el lanzamiento…"
              className="w-full bg-transparent outline-none resize-none max-w-[60ch]"
              style={{ fontFamily: SERIF, fontSize: 17, lineHeight: 1.62, color: C.ink }}
            />
            <div className="flex items-center gap-3.5 mt-3">
              <span className="inline-flex items-center gap-1.5 text-[12px] pb-[3px]" style={{ color: C.ink3, borderBottom: `1px solid ${C.hair}` }}>
                <Paperclip size={11} /> Adjuntar algo
              </span>
              <span className="text-[11.5px]" style={{ color: C.ink3 }}>o dictalo</span>
            </div>
          </div>
        </div>

        {/* ── 02 · la dirección de ESTE pedido ── */}
        <div className="grid grid-cols-1 md:grid-cols-[170px_1fr] gap-x-9 gap-y-4 py-7" style={rowStyle}>
          <Gutter n="02" title="Cómo se ve esta vez" hint="La estética de este pedido, no la de la marca" />
          <div className="flex gap-9 flex-wrap">
            <Picker
              label="Moodboard" hint="dirección"
              items={(b.moodboards || []).map((m) => ({ id: m.id, name: m.name, thumb: m.imageUrl ? moodboardImageUrl(m.imageUrl) : undefined }))}
              selectedId={moodboardId} onSingle={setMoodboardId}
            />
            <Picker
              label="Look & feel" hint="color y textura"
              items={(b.lookAndFeel || []).map((l) => ({ id: l.id, name: l.name, thumb: l.imageUrl ? lookAndFeelImageUrl(l.imageUrl) : undefined }))}
              selectedId={lookFeelId} onSingle={setLookFeelId}
            />
            <Picker
              label="Poses" hint="estrictas"
              items={(b.poses || []).map((p) => ({ id: p.id, name: p.name, thumb: p.imageUrl ? poseImageUrl(p.imageUrl) : undefined }))}
              selectedId={poseId} onSingle={setPoseId}
            />
          </div>
        </div>

        {/* ── 03 · el material ── */}
        <div className="grid grid-cols-1 md:grid-cols-[170px_1fr] gap-x-9 gap-y-4 py-7" style={rowStyle}>
          <Gutter n="03" title="Con qué" hint="Del banco de la marca" />
          <div className="flex gap-9 flex-wrap">
            <Picker
              label="Prendas" hint={String((b.clothing || []).length)}
              multi
              items={(b.clothing || []).map((c) => ({ id: c.id, name: c.name, thumb: c.imageUrl ? clothingImageUrl(c.imageUrl) : undefined }))}
              selectedIds={clothingIds} onToggle={toggle(setClothingIds)}
            />
            <Picker
              label="Productos" hint={String((b.products || []).length)}
              multi
              items={(b.products || []).map((p) => ({ id: p.id, name: p.name, thumb: p.imageUrl ? productImageUrl(p.imageUrl) : undefined }))}
              selectedIds={productIds} onToggle={toggle(setProductIds)}
            />
            <Picker
              label="Modelo" hint={String((b.avatars || []).length)}
              items={(b.avatars || []).map((a) => ({ id: a.id, name: a.name, thumb: a.imageUrl ? avatarImageUrl(a.imageUrl) : undefined }))}
              selectedId={avatarId} onSingle={setAvatarId}
            />
            <Picker
              label="Fondo" hint="opcional"
              items={(b.backgrounds || []).map((x) => ({ id: x.id, name: x.name, thumb: x.imageUrl ? backgroundImageUrl(x.imageUrl) : undefined }))}
              selectedId={backgroundId} onSingle={setBackgroundId}
            />
          </div>
        </div>

        {/* ── 04 · la salida ── */}
        <div className="grid grid-cols-1 md:grid-cols-[170px_1fr] gap-x-9 gap-y-4 py-7" style={rowStyle}>
          <Gutter n="04" title="Qué sale" />
          <div className="flex gap-11 flex-wrap items-start">
            <Options
              label="Formatos" options={AR_OPTIONS} values={aspectRatios}
              onToggle={(ar) => setAspectRatios((p) => (p.includes(ar) ? p.filter((x) => x !== ar) : [...p, ar]))}
            />
            <Options label="Variantes" options={[1, 2, 3, 4]} value={variationsPerShot} onPick={setVariationsPerShot} />
            <Options label="Resolución" options={RES_OPTIONS} value={resolution} onPick={setResolution} />
            <div className="ml-auto text-right">
              <p className="text-[10px] font-semibold tracking-[.14em] uppercase mb-1.5" style={{ color: C.ink3 }}>Va a costar</p>
              <p className="tracking-[-.01em]" style={{ fontFamily: SERIF, fontSize: 26 }}>≈ {formatUsd(estimate)}</p>
              <p className="text-[11.5px] mt-[3px]" style={{ color: C.ink3 }}>
                {pieceCount} {pieceCount === 1 ? "pieza" : "piezas"} · {formatUsd(imagesUsd(1, resolution))} c/u
              </p>
            </div>
          </div>
        </div>

        {error && <p className="text-[12.5px] mt-4" style={{ color: C.err }}>{error}</p>}

        <div className="flex gap-6 items-center justify-end pt-6 mt-2" style={rowStyle}>
          <button onClick={() => navigate("/dashboard/trabajo")} className="text-[12.5px] cursor-pointer" style={{ color: C.ink3 }}>
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving || !brief.trim()}
            title={!brief.trim() ? "Escribí qué necesitamos" : undefined}
            className="text-[13px] font-semibold px-[26px] py-[11px] rounded-full cursor-pointer disabled:opacity-40 disabled:cursor-default inline-flex items-center gap-2"
            style={{ background: C.accent, color: C.paper }}
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            {saving ? "Creando…" : "Crear el pedido"}
          </button>
        </div>
      </div>
    </div>
  );
}
