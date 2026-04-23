import { useState, useEffect } from "react";
import {
  Code2,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Save,
  Loader2,
  Eye,
  Pencil,
  Check,
  AlertCircle,
} from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import {
  fetchPromptTemplates,
  fetchPromptTemplate,
  fetchBrandPromptOverrides,
  setBrandPromptOverride,
  deleteBrandPromptOverride,
  previewPrompt,
} from "../lib/api";
import type { PromptTemplate } from "../lib/api";
import { cn } from "../lib/utils";

const TOOL_LABELS: Record<string, string> = {
  ugc_creator: "UGC Creator",
  video_ad_creator: "Video Ad Creator",
  fashion_reel: "Fashion Reel",
  product_clip: "Product Clip",
  content_analyzer: "Content Analyzer",
  static_ad: "Static Ad",
  carousel_creator: "Carousel Creator",
  ad_creative_lab: "Ad Creative Lab",
  product_spotlight: "Product Spotlight",
  fashion_editorial: "Fashion Editorial",
  avatar_creator: "Avatar Creator",
  chat: "Chat Assistant",
};

const TOOL_GROUPS: Array<{ label: string; ids: string[] }> = [
  { label: "Video", ids: ["ugc_creator", "video_ad_creator", "fashion_reel", "product_clip"] },
  { label: "Imágenes", ids: ["static_ad", "carousel_creator", "ad_creative_lab", "product_spotlight", "fashion_editorial", "avatar_creator", "content_analyzer"] },
  { label: "Otros", ids: ["chat"] },
];

export function PromptsCard() {
  const { activeBrand } = useBrand();
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeBrand) return;
    setLoading(true);
    Promise.all([
      fetchPromptTemplates(),
      fetchBrandPromptOverrides(activeBrand.id),
    ])
      .then(([tmpls, ovrs]) => {
        setTemplates(tmpls);
        setOverrides(ovrs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeBrand?.id]);

  if (!activeBrand) return null;

  return (
    <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] lg:col-span-2">
      <div className="px-5 py-4 border-b border-edge flex items-center gap-2.5">
        <Code2 size={16} className="text-fg-muted" />
        <h2 className="text-[14px] font-semibold text-fg">Templates de prompts</h2>
        <span className="text-[11px] text-fg-faint ml-auto">
          {Object.keys(overrides).length} custom
        </span>
      </div>

      <div className="p-4">
        <p className="text-[12px] text-fg-muted mb-4">
          Cada tool usa un template con variables dinámicas como{" "}
          <code className="text-[11px] bg-surface-2 px-1 py-0.5 rounded">
            {"{brand_name}"}
          </code>{" "}
          and{" "}
          <code className="text-[11px] bg-surface-2 px-1 py-0.5 rounded">
            {"{brand_guidance}"}
          </code>
          . Personalizá por marca o usá los defaults.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-fg-faint">
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : templates.length === 0 ? (
          <p className="text-[13px] text-fg-faint text-center py-8">
            No se encontraron templates
          </p>
        ) : (
          <div className="space-y-5">
            {TOOL_GROUPS.map((group) => {
              const groupTemplates = group.ids
                .map((id) => templates.find((t) => t.tool_id === id))
                .filter(Boolean) as typeof templates;
              if (groupTemplates.length === 0) return null;
              return (
                <div key={group.label}>
                  <p className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider mb-2 px-1">
                    {group.label}
                  </p>
                  <div className="space-y-1">
                    {groupTemplates.map((tmpl) => (
                      <ToolPromptRow
                        key={tmpl.tool_id}
                        template={tmpl}
                        override={overrides[tmpl.tool_id]}
                        expanded={expandedTool === tmpl.tool_id}
                        onToggle={() => setExpandedTool(expandedTool === tmpl.tool_id ? null : tmpl.tool_id)}
                        onSaved={(newOverride) => {
                          if (newOverride) {
                            setOverrides((o) => ({ ...o, [tmpl.tool_id]: newOverride }));
                          } else {
                            setOverrides((o) => { const copy = { ...o }; delete copy[tmpl.tool_id]; return copy; });
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolPromptRow({
  template,
  override,
  expanded,
  onToggle,
  onSaved,
}: {
  template: PromptTemplate;
  override?: string;
  expanded: boolean;
  onToggle: () => void;
  onSaved: (newOverride: string | null) => void;
}) {
  const { activeBrand } = useBrand();
  const [mode, setMode] = useState<"view" | "edit" | "preview">("view");
  const [fullDefault, setFullDefault] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasOverride = !!override;
  const label = TOOL_LABELS[template.tool_id] || template.tool_id;

  const loadFullTemplate = async () => {
    if (fullDefault !== null) return fullDefault;
    setLoadingContent(true);
    try {
      const text = await fetchPromptTemplate(template.tool_id);
      setFullDefault(text);
      return text;
    } catch {
      return template.preview;
    } finally {
      setLoadingContent(false);
    }
  };

  const handleExpand = async () => {
    onToggle();
    if (!expanded) {
      const def = await loadFullTemplate();
      setDraft(override || def);
      setMode("view");
      setError(null);
    }
  };

  const handleEdit = async () => {
    const def = await loadFullTemplate();
    setDraft(override || def);
    setMode("edit");
  };

  const handleSave = async () => {
    if (!activeBrand) return;
    setSaving(true);
    setError(null);
    try {
      await setBrandPromptOverride(activeBrand.id, template.tool_id, draft);
      onSaved(draft);
      setMode("view");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!activeBrand) return;
    setSaving(true);
    setError(null);
    try {
      await deleteBrandPromptOverride(activeBrand.id, template.tool_id);
      onSaved(null);
      const def = await loadFullTemplate();
      setDraft(def);
      setMode("view");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo restaurar");
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!activeBrand) return;
    setLoadingContent(true);
    setError(null);
    try {
      const text = await previewPrompt(activeBrand.id, template.tool_id);
      setPreviewText(text);
      setMode("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo previsualizar");
    } finally {
      setLoadingContent(false);
    }
  };

  return (
    <div className="border border-edge rounded-[var(--radius-sm)] overflow-hidden">
      {/* Header row */}
      <button
        onClick={handleExpand}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors cursor-pointer text-left"
      >
        {expanded ? (
          <ChevronDown size={13} className="text-fg-faint shrink-0" />
        ) : (
          <ChevronRight size={13} className="text-fg-faint shrink-0" />
        )}
        <span className="text-[13px] font-medium text-fg flex-1">{label}</span>
        {hasOverride && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--color-warm-muted)] text-[var(--color-warm)]">
            Custom
          </span>
        )}
        <span className="text-[11px] text-fg-faint">
          {template.tool_id}
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-edge px-4 py-3 space-y-3 bg-surface-0">
          {/* Action bar */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleEdit}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-[var(--radius-sm)] transition-colors cursor-pointer",
                mode === "edit"
                  ? "bg-surface-2 text-fg"
                  : "text-fg-muted hover:text-fg hover:bg-surface-1"
              )}
            >
              <Pencil size={11} />
              Editar
            </button>
            <button
              onClick={handlePreview}
              disabled={loadingContent}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-[var(--radius-sm)] transition-colors cursor-pointer",
                mode === "preview"
                  ? "bg-surface-2 text-fg"
                  : "text-fg-muted hover:text-fg hover:bg-surface-1"
              )}
            >
              {loadingContent ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <Eye size={11} />
              )}
              Vista previa
            </button>

            <div className="flex-1" />

            {hasOverride && (
              <button
                onClick={handleReset}
                disabled={saving}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-fg-muted hover:text-[var(--color-error)] rounded-[var(--radius-sm)] transition-colors cursor-pointer"
              >
                <RotateCcw size={11} />
                Restaurar default
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-[12px] text-[var(--color-error)]">
              <AlertCircle size={12} />
              {error}
            </div>
          )}

          {/* Content area */}
          {mode === "edit" ? (
            <>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={14}
                className="w-full bg-surface-2 border border-edge rounded-[var(--radius-sm)] p-3 text-[12px] text-fg font-mono leading-relaxed outline-none focus:border-[var(--color-edge-focus)] resize-y"
                spellCheck={false}
              />
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => setMode("view")}
                  className="px-3 py-1.5 text-[12px] font-medium text-fg-muted hover:text-fg rounded-[var(--radius-sm)] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[var(--color-warm-fg)] bg-[var(--color-warm)] rounded-[var(--radius-sm)] hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Save size={12} />
                  )}
                  Guardar override
                </button>
              </div>
            </>
          ) : mode === "preview" ? (
            <div className="bg-surface-2 border border-edge rounded-[var(--radius-sm)] p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Check size={12} className="text-[var(--color-success)]" />
                <span className="text-[11px] font-medium text-fg-muted">
                  Preview with {activeBrand?.name} context
                </span>
              </div>
              <pre className="text-[12px] text-fg-secondary font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto">
                {previewText}
              </pre>
            </div>
          ) : (
            <div className="bg-surface-2 border border-edge rounded-[var(--radius-sm)] p-3">
              <pre className="text-[12px] text-fg-secondary font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto max-h-[300px] overflow-y-auto">
                {override || fullDefault || template.preview + "..."}
              </pre>
            </div>
          )}

          {/* Variable reference */}
          <div className="text-[11px] text-fg-faint">
            <span className="font-medium">Variables: </span>
            <code className="bg-surface-2 px-1 rounded">{"{brand_name}"}</code>{" "}
            <code className="bg-surface-2 px-1 rounded">{"{brand_guidance}"}</code>{" "}
            <code className="bg-surface-2 px-1 rounded">{"{avatars}"}</code>{" "}
            <code className="bg-surface-2 px-1 rounded">{"{clothing}"}</code>{" "}
            <code className="bg-surface-2 px-1 rounded">{"{products}"}</code>{" "}
            <code className="bg-surface-2 px-1 rounded">{"{voices}"}</code>{" "}
            | Conditional:{" "}
            <code className="bg-surface-2 px-1 rounded">{"{?var}...{/var}"}</code>
          </div>
        </div>
      )}
    </div>
  );
}
