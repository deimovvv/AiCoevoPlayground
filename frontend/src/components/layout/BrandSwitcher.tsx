import { useBrand } from "../../lib/BrandContext";
import { Loader2, FlaskConical, LayoutGrid } from "lucide-react";
import { useNavigate } from "react-router";
import { cn } from "../../lib/utils";

const API_BASE = "http://localhost:8000";

export function BrandSwitcher() {
  const { activeBrand, loading } = useBrand();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="px-4 py-5 border-b border-edge">
        <div className="flex items-center gap-2 text-fg-muted">
          <Loader2 size={15} className="animate-spin" />
          <span className="text-[13px]">Cargando...</span>
        </div>
      </div>
    );
  }

  const initials = (name: string) =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  const isSandbox = activeBrand?.id === "__sandbox__";
  const hasLogo = !!activeBrand?.logo?.imageUrl;

  return (
    <div className="px-4 py-4 border-b border-edge">
      <button
        onClick={() => navigate("/dashboard/brands")}
        className="w-full flex items-center gap-2.5 cursor-pointer rounded-[var(--radius-sm)] px-1 py-1 -mx-1 -my-1 hover:bg-surface-1 transition-colors group"
        title="Ver todas las marcas"
      >
        {/* Brand avatar */}
        <div
          className={cn(
            "w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center shrink-0 overflow-hidden",
            isSandbox ? "bg-surface-2" : "bg-[var(--color-warm-muted)]"
          )}
        >
          {hasLogo && activeBrand ? (
            <img
              src={`${API_BASE}${activeBrand.logo!.imageUrl}`}
              alt={activeBrand.name}
              className="max-w-full max-h-full object-contain p-0.5 bg-white"
            />
          ) : isSandbox ? (
            <FlaskConical size={14} className="text-fg-faint" />
          ) : (
            <span className="text-[10px] font-bold text-[var(--color-warm)] leading-none">
              {activeBrand ? initials(activeBrand.name) : "?"}
            </span>
          )}
        </div>

        {/* Brand name + label */}
        <div className="flex-1 min-w-0 text-left">
          <div className="text-[13px] font-semibold text-fg truncate leading-tight">
            {activeBrand?.name ?? "Sin marca"}
          </div>
          <div className="text-[10px] text-fg-faint leading-tight mt-0.5 flex items-center gap-1">
            <LayoutGrid size={9} />
            Ver todas las marcas
          </div>
        </div>
      </button>
    </div>
  );
}
