import { useState } from "react";
import {
  PanelRightClose,
  PanelRightOpen,
  ChevronDown,
  FileText,
  ImageIcon,
  Package,
  Mic,
  Pencil,
  Save,
  X,
  Loader2,
} from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import { updateBrand } from "../lib/api";
import { cn } from "../lib/utils";

const API_BASE = "http://localhost:8000";

export function BrandPanel() {
  const { activeBrand } = useBrand();
  const [collapsed, setCollapsed] = useState(false);

  if (!activeBrand) return null;

  if (collapsed) {
    return (
      <div className="border-l border-edge bg-surface-0 flex flex-col items-center py-4">
        <button
          onClick={() => setCollapsed(false)}
          className="p-2 rounded-[var(--radius-sm)] text-fg-muted hover:text-fg hover:bg-surface-1 transition-colors cursor-pointer"
          title="Show brand panel"
        >
          <PanelRightOpen size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-72 border-l border-edge bg-surface-0 flex flex-col shrink-0 h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-edge flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-fg tracking-tight">Brand Context</h2>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 rounded-[var(--radius-sm)] text-fg-muted hover:text-fg hover:bg-surface-1 transition-colors cursor-pointer"
          title="Collapse panel"
        >
          <PanelRightClose size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        <GuidanceSection />
        <AssetsSection />
        <ProductsSection />
        <VoicesSection />
      </div>
    </div>
  );
}

// ── Guidance Section ────────────────────────────────────────

function GuidanceSection() {
  const { activeBrand, refreshBrands } = useBrand();
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  if (!activeBrand) return null;

  const handleEdit = () => {
    setDraft(activeBrand.brandContext || "");
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateBrand(activeBrand.id, { brandContext: draft });
      await refreshBrands();
      setEditing(false);
    } catch (err) {
      console.error("Failed to save guidance:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <CollapsibleSection
      icon={<FileText size={14} />}
      title="Brand Guidance"
      open={open}
      onToggle={() => setOpen(!open)}
      action={
        !editing ? (
          <button
            onClick={(e) => { e.stopPropagation(); handleEdit(); }}
            className="p-0.5 rounded text-fg-faint hover:text-fg transition-colors cursor-pointer"
          >
            <Pencil size={12} />
          </button>
        ) : undefined
      }
    >
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2.5 py-2 text-[12px] text-fg outline-none resize-none focus:border-[var(--color-edge-focus)] transition-colors"
            rows={6}
            placeholder="Describe the brand: tone, audience, values..."
          />
          <div className="flex gap-1.5 justify-end">
            <button
              onClick={() => setEditing(false)}
              className="px-2 py-1 text-[11px] text-fg-muted hover:text-fg rounded-[var(--radius-sm)] hover:bg-surface-1 transition-colors cursor-pointer"
            >
              <X size={12} />
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-2.5 py-1 text-[11px] font-medium bg-[var(--color-action)] text-[var(--color-action-fg)] rounded-[var(--radius-sm)] hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-1"
            >
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
              Save
            </button>
          </div>
        </div>
      ) : activeBrand.brandContext ? (
        <p className="text-[12px] text-fg-muted leading-relaxed line-clamp-8">
          {activeBrand.brandContext}
        </p>
      ) : (
        <button
          onClick={handleEdit}
          className="w-full py-3 border border-dashed border-edge rounded-[var(--radius-sm)] text-[12px] text-fg-faint hover:text-fg-muted hover:border-[var(--color-edge-strong)] transition-colors cursor-pointer"
        >
          + Add brand guidance
        </button>
      )}
    </CollapsibleSection>
  );
}

// ── Assets Section ──────────────────────────────────────────

function AssetsSection() {
  const { activeBrand } = useBrand();
  const [open, setOpen] = useState(true);

  if (!activeBrand) return null;

  const avatars = activeBrand.avatars || [];

  return (
    <CollapsibleSection
      icon={<ImageIcon size={14} />}
      title={`Avatars (${avatars.length})`}
      open={open}
      onToggle={() => setOpen(!open)}
    >
      {avatars.length === 0 ? (
        <p className="text-[12px] text-fg-faint">No avatars uploaded</p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {avatars.map((a) => (
            <div
              key={a.id}
              className="aspect-square rounded-[var(--radius-sm)] bg-surface-2 overflow-hidden relative group"
              title={a.name}
            >
              <img
                src={`${API_BASE}${a.imageUrl}`}
                alt={a.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[9px] text-white truncate block">{a.name}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}

// ── Products Section ────────────────────────────────────────

function ProductsSection() {
  const { activeBrand } = useBrand();
  const [open, setOpen] = useState(true);

  if (!activeBrand) return null;

  const products = activeBrand.products || [];

  return (
    <CollapsibleSection
      icon={<Package size={14} />}
      title={`Products (${products.length})`}
      open={open}
      onToggle={() => setOpen(!open)}
    >
      {products.length === 0 ? (
        <p className="text-[12px] text-fg-faint">No products uploaded</p>
      ) : (
        <div className="space-y-1.5">
          {products.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-surface-2 overflow-hidden shrink-0">
                <img
                  src={`${API_BASE}${p.imageUrl}`}
                  alt={p.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-[12px] text-fg-secondary truncate">{p.name}</span>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}

// ── Voices Section ──────────────────────────────────────────

function VoicesSection() {
  const { activeBrand } = useBrand();
  const [open, setOpen] = useState(false);

  if (!activeBrand) return null;

  const voices = activeBrand.voicePresets || [];

  return (
    <CollapsibleSection
      icon={<Mic size={14} />}
      title={`Voices (${voices.length})`}
      open={open}
      onToggle={() => setOpen(!open)}
    >
      {voices.length === 0 ? (
        <p className="text-[12px] text-fg-faint">No voice presets</p>
      ) : (
        <div className="space-y-1">
          {voices.map((v) => (
            <div
              key={v.id}
              className="px-2 py-1.5 bg-surface-1 rounded-[var(--radius-sm)] text-[12px] text-fg-secondary"
            >
              {v.name}
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}

// ── Collapsible Section Component ───────────────────────────

function CollapsibleSection({
  icon,
  title,
  open,
  onToggle,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  open: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-md)] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-surface-1 rounded-[var(--radius-sm)] transition-colors cursor-pointer"
      >
        <div className="text-fg-muted">{icon}</div>
        <span className="flex-1 text-[12px] font-medium text-fg-secondary">{title}</span>
        {action}
        <ChevronDown
          size={12}
          className={cn(
            "text-fg-faint transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      {open && <div className="px-2.5 pb-2.5 pt-1">{children}</div>}
    </div>
  );
}
