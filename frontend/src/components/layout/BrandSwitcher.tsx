import { useState, useRef, useEffect } from "react";
import { useBrand } from "../../lib/BrandContext";
import { ChevronDown, Check, Plus, Loader2, FlaskConical } from "lucide-react";
import { useNavigate } from "react-router";
import { cn } from "../../lib/utils";

export function BrandSwitcher() {
  const { brands, activeBrand, setActiveBrandId, loading } = useBrand();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  if (loading) {
    return (
      <div className="px-4 py-5 border-b border-edge">
        <div className="flex items-center gap-2 text-fg-muted">
          <Loader2 size={15} className="animate-spin" />
          <span className="text-[13px]">Loading...</span>
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

  return (
    <div ref={ref} className="relative px-4 py-5 border-b border-edge">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center gap-2.5 cursor-pointer rounded-[var(--radius-sm)] transition-colors group",
          "hover:opacity-80"
        )}
      >
        {/* Brand avatar */}
        <div className="w-7 h-7 rounded-[var(--radius-sm)] bg-[var(--color-warm-muted)] flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-[var(--color-warm)] leading-none">
            {activeBrand ? initials(activeBrand.name) : "?"}
          </span>
        </div>

        {/* Brand name */}
        <span className="flex-1 text-left font-semibold text-[14px] text-fg tracking-tight truncate">
          {activeBrand?.name ?? "Select brand"}
        </span>

        <ChevronDown
          size={13}
          className={cn(
            "text-fg-faint transition-transform duration-200 shrink-0",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-surface-1 border border-edge rounded-[var(--radius-md)] shadow-lg overflow-hidden">
          {/* Brand list */}
          <div className="max-h-[240px] overflow-y-auto py-1">
            {brands.filter(b => b.id !== "__sandbox__").length === 0 && (
              <div className="px-3 py-4 text-center text-fg-muted text-[13px]">
                No brands yet
              </div>
            )}
            {brands.filter(b => b.id !== "__sandbox__").map((brand) => {
              const isActive = brand.id === activeBrand?.id;
              return (
                <button
                  key={brand.id}
                  onClick={() => { setActiveBrandId(brand.id); setOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-left cursor-pointer transition-colors",
                    isActive ? "bg-surface-2 text-fg" : "text-fg-secondary hover:bg-surface-2 hover:text-fg"
                  )}
                >
                  <div className="w-6 h-6 rounded-[var(--radius-sm)] bg-[var(--color-warm-muted)] flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-[var(--color-warm)] leading-none">{initials(brand.name)}</span>
                  </div>
                  <span className="flex-1 text-[13px] font-medium truncate">{brand.name}</span>
                  {isActive && <Check size={14} className="text-[var(--color-warm)] shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Sandbox */}
          <div className="border-t border-edge">
            {(() => {
              const sandbox = brands.find(b => b.id === "__sandbox__");
              if (!sandbox) return null;
              const isActive = activeBrand?.id === "__sandbox__";
              return (
                <button
                  onClick={() => { setActiveBrandId("__sandbox__"); setOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2.5 text-left cursor-pointer transition-colors",
                    isActive ? "bg-surface-2 text-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg"
                  )}
                >
                  <div className="w-6 h-6 rounded-[var(--radius-sm)] bg-surface-3 flex items-center justify-center shrink-0">
                    <FlaskConical size={11} className="text-fg-faint" />
                  </div>
                  <span className="flex-1 text-[13px] font-medium">Sandbox</span>
                  {isActive && <Check size={14} className="text-[var(--color-warm)] shrink-0" />}
                </button>
              );
            })()}
          </div>

          {/* Manage brands link */}
          <div className="border-t border-edge">
            <button
              onClick={() => {
                setOpen(false);
                navigate("/dashboard/brands");
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors cursor-pointer"
            >
              <Plus size={14} />
              <span className="text-[13px] font-medium">Manage brands</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
