import { ModelDropdown } from "../ui/ModelDropdown";
import { cn } from "../../lib/utils";
import {
  type ImageModel,
  type ImageQuality,
  DEFAULT_IMAGE_QUALITY,
  QUALITY_LABELS,
  imageModelInfo,
  imageModelOptions,
} from "../../lib/imageModels";

/** Selector de modelo de imagen + calidad (sólo si el modelo tiene calidades). Lo usan el
 *  Lab y todas las tools de imagen; las opciones salen de `lib/imageModels.ts`. */
export function ImageModelPicker({
  model,
  quality,
  onModelChange,
  onQualityChange,
  fashionFit = false,
  label = "Modelo de imagen",
}: {
  model: ImageModel;
  quality?: ImageQuality | null;
  onModelChange: (next: ImageModel) => void;
  onQualityChange: (next: ImageQuality) => void;
  /** Tools de moda con calce: GPT aparece "a prueba". */
  fashionFit?: boolean;
  label?: string;
}) {
  const qualities = imageModelInfo(model).qualities;
  const current = quality ?? DEFAULT_IMAGE_QUALITY;

  return (
    <div className="space-y-1.5">
      <ModelDropdown
        label={label}
        value={model}
        onChange={onModelChange}
        options={imageModelOptions({ fashionFit })}
      />
      {qualities && (
        <div role="group" aria-label="Calidad" className="grid grid-cols-3 gap-1">
          {qualities.map((q) => (
            <button
              key={q}
              type="button"
              aria-pressed={current === q}
              onClick={() => onQualityChange(q)}
              title={q === "high" ? "Para piezas finales: cuesta ~4× más que Normal" : undefined}
              className={cn(
                "h-7 rounded-[var(--radius-sm)] border text-[11px] font-medium transition-colors",
                current === q
                  ? "border-[var(--color-edge-focus)] bg-surface-2 text-fg"
                  : "border-edge bg-surface-0 text-fg-faint hover:text-fg",
              )}
            >
              {QUALITY_LABELS[q]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
