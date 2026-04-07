/**
 * ImageEditPanel — Reusable image edit with product reference picker
 * ──────────────────────────────────────────────────────────────────
 * Used across all tools to edit generated images with product consistency.
 * Shows: quick actions, product/clothing image picker, editable prompt.
 */

import { useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import { createImageEdit, pollImageGen, productImageUrl } from "../lib/api";
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
}

export function ImageEditPanel({
  imageUrl,
  aspectRatio = "9:16",
  resolution = "1K",
  onImageUpdated,
  onClose,
  defaultPrompt = "",
  selectedProductId,
}: ImageEditPanelProps) {
  const { activeBrand } = useBrand();
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [loading, setLoading] = useState(false);

  const products = activeBrand?.products || [];

  // Auto-select the active product's images
  const getInitialRefs = (): string[] => {
    if (!selectedProductId) return [];
    const product = products.find((p) => p.id === selectedProductId);
    if (!product) return [];
    return [product.imageUrl, ...(product.images || []).map((img) => img.imageUrl)];
  };
  const [selectedRefs, setSelectedRefs] = useState<string[]>(getInitialRefs);

  // All product images (main + extras)
  const allProductImages = products.flatMap((p) => [
    { url: p.imageUrl, label: p.name },
    ...(p.images || []).map((img) => ({ url: img.imageUrl, label: img.label || p.name })),
  ]);

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
      console.error("Edit failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface-2 rounded-[var(--radius-md)] p-4 space-y-3">
      {/* Quick actions */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setPrompt("Replace the product with the product from the reference images. Keep everything else identical.")}
          className="text-[10px] px-2.5 py-1 bg-[var(--color-warm-muted)] text-[var(--color-warm)] rounded-full cursor-pointer hover:opacity-80"
        >
          Fix Product
        </button>
        <button
          onClick={() => setPrompt("Make the clothing match the reference images exactly — same color, design, and fit.")}
          className="text-[10px] px-2.5 py-1 bg-surface-3 text-fg-muted rounded-full cursor-pointer hover:text-fg"
        >
          Fix Clothing
        </button>
        <button
          onClick={() => setPrompt("Make the lighting warmer and more natural.")}
          className="text-[10px] px-2.5 py-1 bg-surface-3 text-fg-muted rounded-full cursor-pointer hover:text-fg"
        >
          Warmer Light
        </button>
        <button
          onClick={() => setPrompt("Improve the product visibility — make it more prominent and clearly visible in the frame.")}
          className="text-[10px] px-2.5 py-1 bg-surface-3 text-fg-muted rounded-full cursor-pointer hover:text-fg"
        >
          Show Product
        </button>
      </div>

      {/* Product image picker */}
      {allProductImages.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[9px] font-medium text-fg-faint uppercase tracking-wider">Product reference (click to include)</span>
          <div className="flex gap-1.5 flex-wrap">
            {allProductImages.map((img, idx) => (
              <button
                key={idx}
                onClick={() => toggleRef(img.url)}
                className={cn(
                  "w-10 h-10 rounded overflow-hidden border-2 cursor-pointer transition-all",
                  selectedRefs.includes(img.url)
                    ? "border-[var(--color-warm)]"
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

      {/* Prompt + apply */}
      <div className="flex items-center gap-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what to change..."
          className="flex-1 h-8 px-3 rounded-[var(--radius-sm)] border border-edge bg-surface-1 text-[12px] text-fg placeholder:text-fg-faint outline-none"
          onKeyDown={(e) => e.key === "Enter" && handleApply()}
        />
        <button
          onClick={handleApply}
          disabled={loading || !prompt.trim()}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 text-[11px] font-medium rounded-[var(--radius-sm)] transition-colors",
            !loading && prompt.trim()
              ? "text-white bg-[var(--color-warm)] hover:opacity-90 cursor-pointer"
              : "text-fg-faint bg-surface-1 cursor-not-allowed"
          )}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
          {loading ? "..." : "Apply"}
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
