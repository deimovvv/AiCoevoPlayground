/**
 * ImageEditPanel — Reusable image edit with product reference picker
 * ──────────────────────────────────────────────────────────────────
 * Used across all tools to edit generated images with product consistency.
 * Shows: quick actions, product/clothing image picker, editable prompt.
 */

import { useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import { createImageEdit, pollImageGen, productImageUrl, clothingImageUrl } from "../lib/api";
import { cn } from "../lib/utils";

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
}: ImageEditPanelProps) {
  const { activeBrand } = useBrand();
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [loading, setLoading] = useState(false);

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
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const refs = [imageUrl, ...selectedRefs];
      const job = await createImageEdit(refs, prompt.trim(), aspectRatio, resolution);
      const result = await pollImageGen(job.request_id);
      if (result.image_url) {
        onImageUpdated(result.image_url);
      }
    } catch (err) {
      console.error("Error al editar:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface-2 rounded-[var(--radius-md)] p-4 space-y-3">
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

      {/* Product image picker */}
      {allProductImages.length > 0 && (
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
      {allClothingImages.length > 0 && (
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
          onClick={handleApply}
          disabled={loading || !prompt.trim()}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 text-[11px] font-medium rounded-[var(--radius-sm)] transition-colors",
            !loading && prompt.trim()
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
