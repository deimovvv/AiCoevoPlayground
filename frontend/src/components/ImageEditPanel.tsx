/**
 * ImageEditPanel — Reusable image edit with product reference picker
 * ──────────────────────────────────────────────────────────────────
 * Used across all tools to edit generated images with product consistency.
 * Shows: quick actions, product/clothing image picker, editable prompt.
 */

import { useState } from "react";
import { Loader2, Wand2, ImagePlus, X, Brush, Sparkles, ArrowUp } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import { createImageEdit, pollImageGen, productImageUrl, clothingImageUrl, refineEditInstruction } from "../lib/api";
import { MaskCanvas } from "./workspace/MaskCanvas";
import { cn } from "../lib/utils";

// Heurística barata: ¿el texto parece español? Si sí, lo pasamos por Gemini para
// traducirlo a inglés fiel antes de mandarlo a Nano Banana (que rinde mejor en inglés).
// Si es inglés (ej. los atajos ya generan prompts en inglés) → no lo tocamos, sin latencia.
function looksSpanish(text: string): boolean {
  const t = text.toLowerCase();
  if (/[áéíóúñ¿¡]/.test(t)) return true;
  const words = /\b(el|la|los|las|un|una|de|del|con|sin|que|más|menos|para|por|fondo|cara|pelo|color|cálid|fría|prenda|campera|remera|pantalón|zapat|poné|poner|cambiá|cambiar|hacé|hacer|sacá|sacar|quitá|quitar|agregá|mostrar|mostrá|debe|tiene|blanco|negro|claro|oscuro|izquierda|derecha)\b/;
  return words.test(t);
}

interface ImageEditPanelProps {
  imageUrl: string;
  aspectRatio?: string;
  resolution?: string;
  onImageUpdated: (newUrl: string) => void;
  onClose?: () => void;
  defaultPrompt?: string;
  /** Pre-select this product's images as references */
  selectedProductId?: string | null;
  /** Pre-select these clothing items' images as references */
  selectedClothingIds?: string[];
  /* ── Máscara CONTROLADA desde afuera ──────────────────────────────────
     Cuando el panel vive dentro de `EditOverlay`, el brush se pinta sobre la
     imagen grande del centro y no acá — así que el estado lo maneja el padre.
     Sin estas props el panel usa su propio brush embebido (modo autónomo). */
  mask?: string | null;
  masking?: boolean;
  onToggleMask?: () => void;
  /** `bar` = sólo el prompt, para la barra bajo la imagen (ref. Pics).
   *  `full` (default) = el panel completo con referencias y atajos. */
  variant?: "full" | "bar";
}

export function ImageEditPanel({
  imageUrl,
  aspectRatio = "9:16",
  resolution = "1K",
  onImageUpdated,
  onClose,
  defaultPrompt = "",
  selectedProductId,
  selectedClothingIds,
  mask: maskProp,
  masking: maskingProp,
  onToggleMask,
  variant = "full",
}: ImageEditPanelProps) {
  const { activeBrand } = useBrand();
  const [prompt, setPrompt] = useState(defaultPrompt);
  /** Máscara de edición local (data URL PNG). `null` = editar la imagen entera.
   *  Si el padre la controla (EditOverlay), se usa la suya. */
  /** Curando el prompt con Gemini (a pedido, no automático). */
  const [curating, setCurating] = useState(false);
  const [maskSelf, setMaskSelf] = useState<string | null>(null);
  const [maskingSelf, setMaskingSelf] = useState(false);
  const controlled = onToggleMask !== undefined;
  const mask = controlled ? (maskProp ?? null) : maskSelf;
  const masking = controlled ? !!maskingProp : maskingSelf;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Resolución elegible en el edit — arranca con la que pasa el parent, el usuario la cambia.
  const [editResolution, setEditResolution] = useState(resolution);
  // Los pickers completos del kit arrancan ocultos — arriba mostramos el/los asset(s)
  // seleccionado(s) para comprobar consistencia; "Ver todos" despliega el resto.
  const [showAllAssets, setShowAllAssets] = useState(false);

  const products = activeBrand?.products || [];
  const clothing = activeBrand?.clothing || [];
  const selectedProduct = selectedProductId ? products.find((p) => p.id === selectedProductId) : null;
  const selectedClothingItems = selectedClothingIds?.length
    ? clothing.filter((c) => selectedClothingIds.includes(c.id))
    : [];

  // Auto-select the active product's images
  const getProductRefs = (): string[] => {
    if (!selectedProduct) return [];
    return [selectedProduct.imageUrl, ...(selectedProduct.images || []).map((img) => img.imageUrl)];
  };
  // Clothing refs: pre-selected items if any, otherwise all clothing in the kit.
  const getClothingRefs = (): string[] => {
    const items = selectedClothingItems.length ? selectedClothingItems : clothing;
    return items.map((c) => c.imageUrl).filter(Boolean);
  };
  const [selectedRefs, setSelectedRefs] = useState<string[]>(getProductRefs);
  // Refs subidas al toque (dataURLs) — para cuando faltó algo (un accesorio, el producto)
  // y lo querés meter sin tenerlo en el Brand Kit. El backend convierte el dataURL a Fal URL.
  const [uploadedRefs, setUploadedRefs] = useState<string[]>([]);
  // Etiqueta por ref subida (a quién/qué refiere: "la ropa de Renata", "el producto"…).
  // Se inyecta en el prompt para que el modelo entienda para qué es cada referencia.
  const [uploadedRefLabels, setUploadedRefLabels] = useState<string[]>([]);

  const addUploadedFiles = (files: File[]) => {
    files.filter((f) => f.type.startsWith("image/")).forEach((f) => {
      const r = new FileReader();
      r.onload = () => {
        setUploadedRefs((prev) => [...prev, r.result as string]);
        setUploadedRefLabels((prev) => [...prev, ""]);
      };
      r.readAsDataURL(f);
    });
  };

  // All product images (main + extras)
  const allProductImages = products.flatMap((p) => [
    { url: p.imageUrl, label: p.name },
    ...(p.images || []).map((img) => ({ url: img.imageUrl, label: img.label || p.name })),
  ]);
  // All clothing images
  const allClothingImages = clothing.map((c) => ({ url: c.imageUrl, label: c.name }));

  const toggleRef = (url: string) => {
    setSelectedRefs((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
    );
  };

  const handleApply = async () => {
    const hasRefs = selectedRefs.length > 0 || uploadedRefs.length > 0;
    // Se puede aplicar con SOLO una referencia (sin texto): antes hacía no-op y parecía
    // que el botón "no aplicaba". Si hay ref pero no hay prompt, generamos la instrucción.
    if (!prompt.trim() && !hasRefs) return;
    setLoading(true);
    setError(null);
    try {
      // Si el texto parece español, lo traducimos/afilamos a inglés (fail-open: si falla,
      // el backend devuelve el original). Los atajos ya escriben inglés → no se tocan.
      let finalPrompt = prompt.trim();
      if (finalPrompt && looksSpanish(finalPrompt)) {
        try {
          const { refined } = await refineEditInstruction(finalPrompt);
          if (refined && refined.trim()) finalPrompt = refined.trim();
        } catch { /* fail-open: seguimos con el texto original */ }
      }
      // Guía de referencias: numeramos las refs subidas y sumamos su etiqueta para que el
      // modelo sepa a qué corresponde cada una ("[ref 2] = la ropa de la mujer").
      const labeled = uploadedRefs
        .map((_, i) => uploadedRefLabels[i]?.trim())
        .filter(Boolean);
      if (labeled.length) {
        const guide = uploadedRefs
          .map((_, i) => {
            const lbl = uploadedRefLabels[i]?.trim();
            return lbl ? `reference image #${i + 1} = ${lbl}` : null;
          })
          .filter(Boolean)
          .join("; ");
        finalPrompt = finalPrompt
          ? `${finalPrompt}\n\nReference guide: ${guide}. Use each reference for the element it describes; keep everything else identical to the source image.`
          : `Update the source image using the provided references — ${guide}. Match each reference exactly (garments, colors, patterns, shapes, details) for the element it describes, and keep everything else in the image identical.`;
      } else if (!finalPrompt) {
        // Hay ref(s) sin etiqueta ni texto: instrucción genérica de incorporar la referencia.
        finalPrompt = "Update the source image to match the provided reference image(s) — apply the referenced element (clothing, product or detail) exactly: same colors, patterns, shapes and details. Keep the rest of the image identical.";
      }
      const refs = [imageUrl, ...selectedRefs, ...uploadedRefs];
      // Con máscara va SÍ o SÍ por gpt-image-2: Nano Banana no acepta `mask_url`
      // y la edición saldría global, redibujando cosas que nadie pidió.
      const job = await createImageEdit(
        refs, finalPrompt, aspectRatio, editResolution,
        mask ? "gpt-image-2" : "nano-banana-2",
        mask,
      );
      const result = await pollImageGen(job.request_id);
      if (result.image_url) {
        onImageUpdated(result.image_url);
      } else {
        setError("La edición no devolvió ninguna imagen. Probá de nuevo o reformulá el cambio.");
      }
    } catch (err) {
      console.error("Error al editar:", err);
      setError(err instanceof Error ? err.message : "No se pudo aplicar la edición.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Cura el prompt con Gemini y lo ESCRIBE en el input, para verlo y ajustarlo
   * antes de aplicar. `handleApply` ya curaba, pero en silencio: no había forma
   * de saber qué se le mandó al modelo ni de corregirlo.
   */
  const handleCurate = async () => {
    const text = prompt.trim();
    if (!text || curating) return;
    setCurating(true);
    try {
      const { refined } = await refineEditInstruction(text);
      if (refined?.trim()) setPrompt(refined.trim());
    } catch { /* fail-open: queda el texto original */ }
    finally { setCurating(false); }
  };

  // Variante BARRA: sólo el prompt, ancho, bajo la imagen. El gesto principal
  // del editor es escribir qué cambiar — en el panel lateral quedaba enterrado
  // entre referencias, atajos y resolución. Ref: la barra de Gemini en Pics.
  if (variant === "bar") {
    return (
      <div className="w-full">
        {error && (
          <p className="mb-2 text-[11px] text-[var(--color-error)] text-center">{error}</p>
        )}
        {/* Sin atajos. Eran prompts hardcodeados en inglés que asumían un producto
            o ropa seleccionada ("Corregir producto", "Luz más cálida"). Con el prompt
            a la vista, escribirlo es igual de rápido y no miente sobre el contexto. */}
        <div className="flex items-center gap-2 px-3 h-12 rounded-xl border border-edge bg-[var(--color-surface-1)] shadow-lg">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={mask ? "Qué cambiar en la zona marcada…" : "Describí qué cambiar…"}
            className="flex-1 h-full bg-transparent text-[13px] text-fg placeholder:text-fg-faint outline-none"
            onKeyDown={(e) => e.key === "Enter" && handleApply()}
          />
          <button
            onClick={handleCurate}
            disabled={curating || !prompt.trim()}
            title="Reescribe tu instrucción para que el modelo la entienda mejor. Después la podés editar."
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg text-[11.5px] font-medium text-fg-muted hover:text-fg hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {curating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {curating ? "Mejorando…" : "Mejorar"}
          </button>
          <button
            onClick={handleApply}
            disabled={loading || (!prompt.trim() && selectedRefs.length === 0 && uploadedRefs.length === 0)}
            className={cn(
              "h-8 w-8 flex items-center justify-center rounded-lg transition-colors shrink-0",
              !loading && (prompt.trim() || selectedRefs.length > 0 || uploadedRefs.length > 0)
                ? "text-[var(--color-action-fg)] bg-[var(--color-action)] hover:opacity-90 cursor-pointer"
                : "text-fg-faint bg-[var(--color-surface-2)] cursor-not-allowed",
            )}
            title="Aplicar (Enter)"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <ArrowUp size={14} />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-2 rounded-[var(--radius-md)] p-4 space-y-3">
      {/* Cómo se usa — corto, para que no quede ambiguo. */}
      <p className="text-[10px] text-fg-faint leading-snug">
        Escribí abajo qué querés cambiar (ej. <span className="text-fg-muted">"el fondo debe ser blanco"</span>) y tocá <span className="text-fg-muted">Aplicar</span> — se regenera ESTA imagen con el cambio. Sumá una <span className="text-fg-muted">imagen de referencia</span> (abajo) si faltó algo, o refs del kit / un atajo.
      </p>

      {/* Editar SÓLO una zona. Cuando el panel vive dentro de `EditOverlay`, el
          lápiz está sobre la imagen grande y acá no se dibuja nada — sólo queda
          el aviso de que hay una zona marcada. */}
      {controlled ? (
        mask && (
          <p className="text-[10.5px] leading-snug text-[var(--color-brand)]">
            Hay una zona marcada: se va a regenerar sólo eso.
          </p>
        )
      ) : (
      <div className="space-y-2">
        <button
          onClick={() => {
            // Este botón sólo existe en modo autónomo (ver la rama de arriba).
            setMaskingSelf((v) => !v);
            if (masking) setMaskSelf(null);
          }}
          className={cn(
            "w-full flex items-center justify-center gap-1.5 h-8 rounded-[var(--radius-sm)] text-[11.5px] font-medium transition-colors cursor-pointer border",
            masking
              ? "bg-[var(--color-brand-muted)] border-[var(--color-brand)] text-fg"
              : "bg-surface-1 border-edge text-fg-muted hover:text-fg",
          )}
        >
          <Brush size={12} />
          {masking ? "Editando una zona" : "Editar sólo una zona"}
          {mask && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--color-brand)] text-[var(--color-brand-fg)]">zona marcada</span>}
        </button>
        {masking && !controlled && <MaskCanvas imageUrl={imageUrl} onMaskChange={setMaskSelf} />}
      </div>
      )}

      {/* Subir imagen de referencia — para cuando faltó algo (accesorio, producto) y no
          está en el kit. Se suma como ref a la edición, igual que en el Lab. */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-sm)] border border-dashed border-edge hover:border-[var(--color-action)] text-[10px] text-fg-muted hover:text-fg cursor-pointer transition-colors">
            <ImagePlus size={12} /> Subir imagen de referencia
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { addUploadedFiles(Array.from(e.target.files || [])); e.target.value = ""; }}
            />
          </label>
          {uploadedRefs.length > 0 && (
            <span className="text-[9px] text-fg-faint">{uploadedRefs.length} subida{uploadedRefs.length === 1 ? "" : "s"} — etiquetá a qué refiere cada una</span>
          )}
        </div>
        {uploadedRefs.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {uploadedRefs.map((url, i) => (
              <div key={i} className="flex flex-col gap-1 w-[88px]">
                <div className="relative group/up">
                  <img src={url} alt={`ref ${i + 1}`} className="w-full h-16 rounded object-cover border-2 border-[var(--color-action)]" />
                  <span className="absolute bottom-0.5 left-0.5 text-[8px] px-1 rounded bg-black/70 text-white">ref #{i + 1}</span>
                  <button
                    onClick={() => {
                      setUploadedRefs((prev) => prev.filter((_, j) => j !== i));
                      setUploadedRefLabels((prev) => prev.filter((_, j) => j !== i));
                    }}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-black/80 hover:bg-red-500 text-white flex items-center justify-center cursor-pointer"
                    title="Quitar"
                  ><X size={9} /></button>
                </div>
                <input
                  type="text"
                  value={uploadedRefLabels[i] || ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setUploadedRefLabels((prev) => prev.map((l, j) => (j === i ? v : l)));
                  }}
                  placeholder="¿a qué refiere?"
                  className="w-full text-[9px] px-1.5 py-1 rounded-[var(--radius-sm)] bg-surface-3 border border-edge text-fg placeholder:text-fg-faint focus:border-[var(--color-action)] outline-none"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => {
            // Auto-select product reference images
            const refs = getProductRefs();
            if (refs.length > 0) setSelectedRefs((prev) => [...new Set([...prev, ...refs])]);
            const productName = selectedProduct?.name || "the product";
            const productDesc = selectedProduct?.description ? ` (${selectedProduct.description})` : "";
            setPrompt(`Replace the product with "${productName}"${productDesc} from the reference images. Match the EXACT color, design, shape, and details from the reference. Keep everything else identical.`);
          }}
          className="text-[10px] px-2.5 py-1 bg-[var(--color-action-muted)] text-[var(--color-action)] rounded-full cursor-pointer hover:opacity-80"
        >
          Corregir producto
        </button>
        <button
          onClick={() => {
            // Use CLOTHING refs (not product) for a clothing fix.
            const refs = getClothingRefs();
            if (refs.length > 0) setSelectedRefs((prev) => [...new Set([...prev, ...refs])]);
            const garmentName = selectedClothingItems[0]?.name || clothing[0]?.name || "the garment";
            setPrompt(`Re-dress the person in the clothing shown in the reference images — match "${garmentName}" exactly: same color, same design, same fit, same texture. Replace whatever they are currently wearing.`);
          }}
          className="text-[10px] px-2.5 py-1 bg-surface-3 text-fg-muted rounded-full cursor-pointer hover:text-fg"
        >
          Corregir ropa
        </button>
        <button
          onClick={() => setPrompt("Make the lighting warmer and more natural.")}
          className="text-[10px] px-2.5 py-1 bg-surface-3 text-fg-muted rounded-full cursor-pointer hover:text-fg"
        >
          Luz más cálida
        </button>
        <button
          onClick={() => {
            const refs = getProductRefs();
            if (refs.length > 0) setSelectedRefs((prev) => [...new Set([...prev, ...refs])]);
            const productName = selectedProduct?.name || "the product";
            setPrompt(`Make "${productName}" more prominent and clearly visible in the frame. Match the exact product from the reference images.`);
          }}
          className="text-[10px] px-2.5 py-1 bg-surface-3 text-fg-muted rounded-full cursor-pointer hover:text-fg"
        >
          Mostrar producto
        </button>
      </div>

      {/* Assets de ESTA tirada — clickeables como referencia. Es lo que elegiste para
          esta generación; tocá uno para sumarlo de ref (borde naranja = incluido) y
          escribí "poné esta campera / respetá este producto" → Nano Banana lo matchea.
          También sirve para comprobar consistencia visual contra la imagen que editás. */}
      {(selectedProduct || selectedClothingItems.length > 0) && (
        <div className="space-y-1.5">
          <span className="text-[9px] font-medium text-fg-faint uppercase tracking-wider">Assets de esta tirada — tocá para usar de referencia</span>
          <div className="flex gap-2 flex-wrap">
            {selectedProduct && (() => {
              const on = selectedRefs.includes(selectedProduct.imageUrl);
              return (
                <button
                  type="button"
                  onClick={() => toggleRef(selectedProduct.imageUrl)}
                  className="flex flex-col items-center gap-0.5 w-14 cursor-pointer group/asset"
                  title={on ? "Quitar de referencias" : "Usar como referencia"}
                >
                  <span className={cn("relative w-14 h-14 rounded overflow-hidden border-2 transition-all", on ? "border-[var(--color-action)]" : "border-[var(--color-brand)] opacity-70 group-hover/asset:opacity-100")}>
                    <img src={productImageUrl(selectedProduct.imageUrl)} alt={selectedProduct.name} className="w-full h-full object-cover" />
                    {on && <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-[var(--color-action)] text-[var(--color-action-fg)] flex items-center justify-center text-[8px]">✓</span>}
                  </span>
                  <span className="text-[8px] text-fg-faint truncate max-w-[56px]" title={selectedProduct.name}>{selectedProduct.name}</span>
                </button>
              );
            })()}
            {selectedClothingItems.map((c) => {
              const on = selectedRefs.includes(c.imageUrl);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleRef(c.imageUrl)}
                  className="flex flex-col items-center gap-0.5 w-14 cursor-pointer group/asset"
                  title={on ? "Quitar de referencias" : "Usar como referencia"}
                >
                  <span className={cn("relative w-14 h-14 rounded overflow-hidden border-2 transition-all", on ? "border-[var(--color-action)]" : "border-[var(--color-brand)] opacity-70 group-hover/asset:opacity-100")}>
                    <img src={clothingImageUrl(c.imageUrl)} alt={c.name} className="w-full h-full object-cover" />
                    {on && <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-[var(--color-action)] text-[var(--color-action-fg)] flex items-center justify-center text-[8px]">✓</span>}
                  </span>
                  <span className="text-[8px] text-fg-faint truncate max-w-[56px]" title={c.name}>{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Ver todos los assets del kit — colapsado por default. */}
      {(allProductImages.length > 0 || allClothingImages.length > 0) && (
        <button
          onClick={() => setShowAllAssets((v) => !v)}
          className="text-[10px] font-medium text-[var(--color-action)] hover:opacity-80 cursor-pointer"
        >
          {showAllAssets ? "▾ Ocultar todos los assets" : "▸ Ver todos los assets del kit (para sumar refs)"}
        </button>
      )}

      {/* Product image picker */}
      {showAllAssets && allProductImages.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[9px] font-medium text-fg-faint uppercase tracking-wider">Referencia del producto (click para incluir)</span>
          <div className="flex gap-1.5 flex-wrap">
            {allProductImages.map((img, idx) => (
              <button
                key={idx}
                onClick={() => toggleRef(img.url)}
                className={cn(
                  "w-10 h-10 rounded overflow-hidden border-2 cursor-pointer transition-all",
                  selectedRefs.includes(img.url)
                    ? "border-[var(--color-action)]"
                    : "border-edge opacity-50 hover:opacity-100"
                )}
                title={img.label}
              >
                <img src={productImageUrl(img.url)} alt={img.label} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Clothing image picker */}
      {showAllAssets && allClothingImages.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[9px] font-medium text-fg-faint uppercase tracking-wider">Referencia de ropa (click para incluir)</span>
          <div className="flex gap-1.5 flex-wrap">
            {allClothingImages.map((img, idx) => (
              <button
                key={idx}
                onClick={() => toggleRef(img.url)}
                className={cn(
                  "w-10 h-10 rounded overflow-hidden border-2 cursor-pointer transition-all",
                  selectedRefs.includes(img.url)
                    ? "border-[var(--color-action)]"
                    : "border-edge opacity-50 hover:opacity-100"
                )}
                title={img.label}
              >
                <img src={clothingImageUrl(img.url)} alt={img.label} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error surfacing — antes se tragaba en console y parecía "no hace nada". */}
      {error && (
        <p className="text-[11px] text-[var(--color-error)] leading-snug">{error}</p>
      )}

      {/* Prompt + apply */}
      <div className="flex items-center gap-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describí qué cambiar..."
          className="flex-1 h-8 px-3 rounded-[var(--radius-sm)] border border-edge bg-surface-1 text-[12px] text-fg placeholder:text-fg-faint outline-none"
          onKeyDown={(e) => e.key === "Enter" && handleApply()}
        />
        <button
          onClick={handleCurate}
          disabled={curating || !prompt.trim()}
          title="Curar con Gemini — afina la instrucción y la deja en inglés. Podés editarla después."
          className="h-8 w-8 flex items-center justify-center rounded-[var(--radius-sm)] border border-edge bg-surface-1 text-fg-muted hover:text-fg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {curating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
        </button>
        <select
          value={editResolution}
          onChange={(e) => setEditResolution(e.target.value)}
          title="Resolución del resultado"
          className="h-8 px-2 rounded-[var(--radius-sm)] border border-edge bg-surface-1 text-[11px] text-fg-muted outline-none cursor-pointer shrink-0"
        >
          <option value="1K">1K</option>
          <option value="2K">2K</option>
          <option value="4K">4K</option>
        </select>
        <button
          onClick={handleApply}
          disabled={loading || (!prompt.trim() && selectedRefs.length === 0 && uploadedRefs.length === 0)}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 text-[11px] font-medium rounded-[var(--radius-sm)] transition-colors",
            !loading && (prompt.trim() || selectedRefs.length > 0 || uploadedRefs.length > 0)
              ? "text-[var(--color-action-fg)] bg-[var(--color-action)] hover:opacity-90 cursor-pointer"
              : "text-fg-faint bg-surface-1 cursor-not-allowed"
          )}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
          {loading ? "..." : "Aplicar"}
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="text-[10px] text-fg-faint hover:text-fg cursor-pointer px-2"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
