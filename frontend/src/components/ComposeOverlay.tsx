/**
 * ComposeOverlay
 * ──────────────
 * Renders an AI-generated image with a live-editable text overlay using the brand's typography.
 * Replaces the manual "bajar a Figma → tipografiar → exportar" flow.
 *
 *  - Live preview via HTML/CSS (instant edits)
 *  - Brand fonts loaded automatically (Google Fonts)
 *  - Auto-contrast: text color flips to white on dark images, black on light
 *  - Export to PNG via Canvas 2D (no external deps)
 */

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { Brand } from "../lib/api";
import {
  type OverlayTemplate,
  type OverlaySlot,
  OVERLAY_TEMPLATES,
  getTemplate,
} from "../tools/shared/composeTemplates";
import { loadBrandFonts, getCanvasFontFamily, type ResolvedBrandFonts } from "../tools/shared/fontLoader";
import { Download, Edit3 } from "lucide-react";
import { cn } from "../lib/utils";

export interface ComposeFields {
  eyebrow?: string;
  headline?: string;
  subline?: string;
  cta?: string;
}

interface Props {
  imageUrl: string;
  brand: Brand;
  initialFields?: ComposeFields;
  initialTemplateId?: string;
  /** Output dimensions for export — fallback 1080x1350 (4:5) */
  outputWidth?: number;
  outputHeight?: number;
  /** Called when user exports a PNG */
  onExport?: (pngBlob: Blob) => void;
  /** Called when fields or template change */
  onChange?: (fields: ComposeFields, templateId: string) => void;
  className?: string;
}

// ── Auto-contrast: sample a region of the image and decide if text should be light or dark ──
async function detectImageBrightness(imageUrl: string): Promise<"light" | "dark"> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        const w = 64, h = 64;
        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        if (!ctx) return resolve("dark");
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        let total = 0;
        for (let i = 0; i < data.length; i += 4) {
          // perceived luminance
          total += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
        }
        const avg = total / (data.length / 4);
        resolve(avg > 140 ? "light" : "dark");
      } catch {
        resolve("dark");
      }
    };
    img.onerror = () => resolve("dark");
    img.src = imageUrl;
  });
}

function resolveColor(token: string, brightness: "light" | "dark", ds?: Record<string, unknown>): string {
  if (token === "fg") return brightness === "light" ? "#0a0a0a" : "#ffffff";
  if (token.startsWith("#")) return token;
  // Try design system colors
  const colors = ds?.colors as Array<{ name: string; hex: string }> | undefined;
  if (colors) {
    const found = colors.find((c) => c.name?.toLowerCase().includes(token.toLowerCase()));
    if (found?.hex) return found.hex;
  }
  if (token === "warm") return "#FACDEA";
  // Action token — kept aligned with `--color-action` in index.css (off-white minimal).
  if (token === "action") return "#F5F5F5";
  if (token === "calm") return "#D4FCF1";
  return "#ffffff";
}

function pctToPx(pct: number, base: number): number {
  return (pct / 100) * base;
}

// ── Slot positioning ──
function slotStyle(slot: OverlaySlot, fonts: ResolvedBrandFonts, color: string): React.CSSProperties {
  const fontFamily = fonts[slot.fontFamilyToken];
  const base: React.CSSProperties = {
    position: "absolute",
    fontFamily,
    fontSize: `${slot.fontSizePct}%`, // % of canvas height — set on the parent's height context
    fontWeight: slot.fontWeight,
    fontStyle: slot.italic ? "italic" : "normal",
    letterSpacing: `${slot.trackingEm}em`,
    lineHeight: slot.lineHeight,
    textTransform: slot.uppercase ? "uppercase" : "none",
    maxWidth: `${slot.maxWidthPct}%`,
    textAlign: slot.align,
    color,
    margin: 0,
    padding: 0,
    pointerEvents: "none",
    userSelect: "none",
    whiteSpace: "pre-wrap",
  };
  const m = `${slot.marginPct}%`;
  switch (slot.position) {
    case "top-left": return { ...base, top: m, left: m };
    case "top-center": return { ...base, top: m, left: "50%", transform: "translateX(-50%)" };
    case "top-right": return { ...base, top: m, right: m };
    case "center": return { ...base, top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    case "bottom-left": return { ...base, bottom: m, left: m };
    case "bottom-center": return { ...base, bottom: m, left: "50%", transform: "translateX(-50%)" };
    case "bottom-right": return { ...base, bottom: m, right: m };
    default: return base;
  }
}

// ── Stack slots by vertical position with relative offsets ──
function applyStacking(slots: OverlaySlot[]): Array<{ slot: OverlaySlot; offsetPct: number }> {
  const result: Array<{ slot: OverlaySlot; offsetPct: number }> = [];
  // Group by position to stack siblings
  const positionGroups: Record<string, OverlaySlot[]> = {};
  for (const s of slots) {
    positionGroups[s.position] = positionGroups[s.position] || [];
    positionGroups[s.position].push(s);
  }
  for (const slot of slots) {
    const group = positionGroups[slot.position];
    const idx = group.indexOf(slot);
    // Each subsequent slot in the same anchor gets pushed down (or up if bottom)
    const isBottom = slot.position.startsWith("bottom");
    const offsetPct = idx * (slot.fontSizePct * slot.lineHeight + 1.2);
    result.push({ slot, offsetPct: isBottom ? -offsetPct : offsetPct });
  }
  return result;
}

export function ComposeOverlay({
  imageUrl,
  brand,
  initialFields,
  initialTemplateId = "editorial_bottom",
  outputWidth = 1080,
  outputHeight = 1350,
  onExport,
  onChange,
  className,
}: Props) {
  const [fields, setFields] = useState<ComposeFields>(initialFields || {});
  const [templateId, setTemplateId] = useState<string>(initialTemplateId);
  const [brightness, setBrightness] = useState<"light" | "dark">("dark");
  const [editing, setEditing] = useState(true);
  const [exporting, setExporting] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const template = useMemo(() => getTemplate(templateId), [templateId]);
  const fonts = useMemo(() => loadBrandFonts(brand.fonts), [brand.fonts]);
  const designSystem = brand.designSystem as Record<string, unknown> | undefined;

  useEffect(() => {
    detectImageBrightness(imageUrl).then(setBrightness);
  }, [imageUrl]);

  useEffect(() => {
    onChange?.(fields, templateId);
  }, [fields, templateId, onChange]);

  const updateField = (k: keyof ComposeFields, v: string) => {
    setFields((p) => ({ ...p, [k]: v }));
  };

  // ── Export to PNG via Canvas 2D ──
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");

      // 1. Draw the image
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error("Failed to load image"));
        i.src = imageUrl;
      });
      // Cover-fit
      const imgRatio = img.width / img.height;
      const canvasRatio = outputWidth / outputHeight;
      let drawW = outputWidth, drawH = outputHeight, dx = 0, dy = 0;
      if (imgRatio > canvasRatio) {
        drawH = outputHeight;
        drawW = drawH * imgRatio;
        dx = (outputWidth - drawW) / 2;
      } else {
        drawW = outputWidth;
        drawH = drawW / imgRatio;
        dy = (outputHeight - drawH) / 2;
      }
      ctx.drawImage(img, dx, dy, drawW, drawH);

      // 2. Optional scrim
      if (template.scrim) {
        ctx.fillStyle = `rgba(0,0,0,${template.scrim.alpha})`;
        const sH = pctToPx(template.scrim.heightPct, outputHeight);
        if (template.scrim.position === "full") {
          ctx.fillRect(0, 0, outputWidth, outputHeight);
        } else if (template.scrim.position === "top") {
          // gradient top
          const grad = ctx.createLinearGradient(0, 0, 0, sH);
          grad.addColorStop(0, `rgba(0,0,0,${template.scrim.alpha})`);
          grad.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, outputWidth, sH);
        } else if (template.scrim.position === "bottom") {
          const grad = ctx.createLinearGradient(0, outputHeight - sH, 0, outputHeight);
          grad.addColorStop(0, "rgba(0,0,0,0)");
          grad.addColorStop(1, `rgba(0,0,0,${template.scrim.alpha})`);
          ctx.fillStyle = grad;
          ctx.fillRect(0, outputHeight - sH, outputWidth, sH);
        }
      }

      // 3. Draw each slot's text
      for (const slot of template.slots) {
        const text = (fields as Record<string, string | undefined>)[slot.field];
        if (!text) continue;
        const fontSizePx = pctToPx(slot.fontSizePct, outputHeight);
        const fontFamily = getCanvasFontFamily(fonts[slot.fontFamilyToken]);
        const styleStr = slot.italic ? "italic" : "normal";
        ctx.font = `${styleStr} ${slot.fontWeight} ${fontSizePx}px "${fontFamily}", Georgia, serif`;
        ctx.fillStyle = resolveColor(slot.color, brightness, designSystem);
        ctx.textBaseline = "top";

        // Wrap text to maxWidth
        const maxWidth = pctToPx(slot.maxWidthPct, outputWidth);
        const lines = wrapText(ctx, slot.uppercase ? text.toUpperCase() : text, maxWidth);
        const lineHeightPx = fontSizePx * slot.lineHeight;
        const totalHeight = lines.length * lineHeightPx;

        const margin = pctToPx(slot.marginPct, outputWidth);
        let x = 0, y = 0;
        // Vertical anchor
        if (slot.position.startsWith("top")) y = pctToPx(slot.marginPct, outputHeight);
        else if (slot.position === "center") y = (outputHeight - totalHeight) / 2;
        else y = outputHeight - pctToPx(slot.marginPct, outputHeight) - totalHeight;
        // Horizontal anchor
        if (slot.position.endsWith("left")) {
          x = margin;
          ctx.textAlign = "left";
        } else if (slot.position.endsWith("right") || slot.position === "top-right" || slot.position === "bottom-right") {
          x = outputWidth - margin;
          ctx.textAlign = "right";
        } else {
          x = outputWidth / 2;
          ctx.textAlign = "center";
        }

        for (let li = 0; li < lines.length; li++) {
          ctx.fillText(lines[li], x, y + li * lineHeightPx);
        }
      }

      // 4. Export
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (blob) {
        if (onExport) {
          onExport(blob);
        } else {
          // Default: trigger download
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `compose_${Date.now()}.png`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
    } catch (err) {
      console.error("[ComposeOverlay] export failed:", err);
    } finally {
      setExporting(false);
    }
  }, [imageUrl, template, fields, fonts, brightness, designSystem, outputWidth, outputHeight, onExport]);

  // ── Render preview ──
  const stacked = applyStacking(template.slots);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Preview canvas */}
      <div
        ref={previewRef}
        className="relative w-full overflow-hidden rounded-[var(--radius-md)] border border-edge bg-surface-2"
        style={{ aspectRatio: `${outputWidth} / ${outputHeight}` }}
      >
        {/* Image */}
        <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" crossOrigin="anonymous" />

        {/* Scrim */}
        {template.scrim && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: 0, right: 0,
              ...(template.scrim.position === "top"
                ? { top: 0, height: `${template.scrim.heightPct}%`, background: `linear-gradient(to bottom, rgba(0,0,0,${template.scrim.alpha}), transparent)` }
                : template.scrim.position === "bottom"
                ? { bottom: 0, height: `${template.scrim.heightPct}%`, background: `linear-gradient(to top, rgba(0,0,0,${template.scrim.alpha}), transparent)` }
                : { top: 0, bottom: 0, background: `rgba(0,0,0,${template.scrim.alpha})` }),
            }}
          />
        )}

        {/* Text slots */}
        {stacked.map(({ slot, offsetPct }, i) => {
          const text = (fields as Record<string, string | undefined>)[slot.field];
          if (!text) return null;
          const color = resolveColor(slot.color, brightness, designSystem);
          const baseStyle = slotStyle(slot, fonts, color);
          // Adjust for stacked positioning: use percentage of container height
          const adjustedStyle: React.CSSProperties = { ...baseStyle };
          if (offsetPct !== 0) {
            const isBottom = slot.position.startsWith("bottom");
            const baseM = parseFloat(slot.marginPct.toString());
            if (isBottom) {
              adjustedStyle.bottom = `${baseM - offsetPct}%`;
            } else {
              adjustedStyle.top = `${baseM + offsetPct}%`;
            }
          }
          // Convert fontSizePct → relative to container height via CSS
          adjustedStyle.fontSize = `${slot.fontSizePct}cqh`; // container query unit (% of container height)
          return (
            <div key={i} style={adjustedStyle}>
              {slot.uppercase ? text.toUpperCase() : text}
            </div>
          );
        })}
      </div>

      {/* Editor */}
      <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-fg-faint uppercase tracking-wider">Compose Mode</span>
          <button
            onClick={() => setEditing((p) => !p)}
            className="flex items-center gap-1 text-[10px] text-fg-muted hover:text-fg cursor-pointer"
          >
            <Edit3 size={11} />
            {editing ? "Cerrar" : "Editar"}
          </button>
        </div>

        {editing && (
          <>
            {/* Template picker */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider">Template</label>
              <div className="flex gap-1.5 flex-wrap">
                {OVERLAY_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTemplateId(t.id)}
                    title={t.description}
                    className={cn(
                      "px-2.5 py-1.5 rounded-[var(--radius-sm)] text-[10px] font-medium border transition-all cursor-pointer",
                      templateId === t.id
                        ? "border-[var(--color-action)] bg-[var(--color-action-muted)] text-fg"
                        : "border-edge bg-surface-2 text-fg-muted hover:text-fg hover:border-edge-strong"
                    )}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-fg-faint italic">{template.description}</p>
            </div>

            {/* Field inputs — only show fields the template uses */}
            {template.slots.length > 0 ? (
              <div className="space-y-2">
                {Array.from(new Set(template.slots.map((s) => s.field))).map((field) => (
                  <div key={field} className="space-y-1">
                    <label className="text-[9px] font-semibold text-fg-faint uppercase tracking-wider">{field}</label>
                    {field === "subline" || field === "headline" ? (
                      <textarea
                        value={(fields as Record<string, string | undefined>)[field] || ""}
                        onChange={(e) => updateField(field as keyof ComposeFields, e.target.value)}
                        rows={field === "headline" ? 2 : 3}
                        className="w-full bg-surface-2 border border-edge rounded-[var(--radius-sm)] px-2 py-1.5 text-[12px] text-fg outline-none focus:border-[var(--color-action)] resize-none"
                      />
                    ) : (
                      <input
                        type="text"
                        value={(fields as Record<string, string | undefined>)[field] || ""}
                        onChange={(e) => updateField(field as keyof ComposeFields, e.target.value)}
                        className="w-full bg-surface-2 border border-edge rounded-[var(--radius-sm)] px-2 py-1.5 text-[12px] text-fg outline-none focus:border-[var(--color-action)]"
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-fg-faint italic">Este template no usa texto. La imagen se exporta limpia.</p>
            )}
          </>
        )}

        <button
          onClick={handleExport}
          disabled={exporting}
          className="w-full flex items-center justify-center gap-2 py-2 bg-[var(--color-action)] text-[var(--color-action-fg)] rounded-[var(--radius-sm)] text-[12px] font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer"
        >
          <Download size={12} />
          {exporting ? "Exportando..." : "Exportar PNG"}
        </button>
      </div>
    </div>
  );
}

// ── Helper: text wrapping for Canvas ──
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}
