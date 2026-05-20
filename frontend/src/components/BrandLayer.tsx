/**
 * Brand Layer — cards for the enriched Brand schema (v2)
 * ──────────────────────────────────────────────────────
 *  - BusinessCard: business model, value prop, target market, revenue streams
 *  - BrandSourcesCard: list of sources (web, IG, TikTok, PDF, text, reviews) used to feed Gemini
 *  - CompetitorsCard: brands the user references for differentiation
 *  - CustomerReviewsCard: real reviews/testimonials pegados → voz auténtica
 *  - BrandHealthCard: visible status of what's loaded vs what's missing
 *
 * All cards persist via PATCH /api/brands/{id} (updateBrand).
 */

import { useState } from "react";
import { Plus, Trash2, X, Pencil, CheckCircle2, AlertCircle, Circle, ExternalLink, ChevronDown, Download } from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import { updateBrand, type BrandBusiness, type BrandCompetitor, type BrandSource, type BrandSourceType, type BusinessModel } from "../lib/api";
import { cn } from "../lib/utils";

// ── Section Header (visual hierarchy in BrandSettings) ───────

export function SectionHeader({
  number,
  title,
  subtitle,
  collapsible = false,
  defaultCollapsed = false,
  children,
}: {
  number: string;
  title: string;
  subtitle?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  children?: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  return (
    <div className="space-y-3">
      <button
        onClick={() => collapsible && setCollapsed((c) => !c)}
        disabled={!collapsible}
        className={cn(
          "w-full flex items-center gap-3 pt-2",
          collapsible && "cursor-pointer hover:opacity-80 transition-opacity"
        )}
      >
        <span className="text-[20px] font-bold text-[var(--color-warm-strong)] tabular-nums">{number}</span>
        <div className="flex-1 text-left">
          <h2 className="text-[16px] font-semibold text-fg tracking-tight">{title}</h2>
          {subtitle && <p className="text-[12px] text-fg-faint mt-0.5">{subtitle}</p>}
        </div>
        {collapsible && (
          <ChevronDown size={16} className={cn("text-fg-faint shrink-0 transition-transform", !collapsed && "rotate-180")} />
        )}
      </button>
      {collapsible && !collapsed && children}
    </div>
  );
}

// ── Brand Identity Export Card ───────────────────────────────

export function BrandIdentityExportCard() {
  const { activeBrand } = useBrand();
  const [exporting, setExporting] = useState(false);

  if (!activeBrand) return null;

  const buildIdentityHTML = () => {
    const b = activeBrand;
    const dna = b.dna || {};
    const ds = b.designSystem || {};
    const business = b.business || {};
    const colors = (dna.colors || []).map((c) => `
      <div style="display:flex;align-items:center;gap:12px;padding:8px 12px;background:#f5f5f3;border-radius:6px;">
        <div style="width:32px;height:32px;border-radius:6px;background:${c.hex};border:1px solid #ddd;"></div>
        <div><div style="font-weight:600;font-size:13px;">${c.name}</div><div style="font-family:monospace;font-size:11px;color:#666;">${c.hex}</div><div style="font-size:11px;color:#999;">${c.usage || ""}</div></div>
      </div>
    `).join("");
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${b.name} — Brand Identity</title><style>
      body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:880px;margin:0 auto;padding:48px 32px;color:#0a0a0a;background:#fafaf8;line-height:1.6;}
      h1{font-size:48px;letter-spacing:-0.03em;margin:0 0 8px;font-weight:700;}
      h2{font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#999;margin:48px 0 16px;font-weight:600;}
      h3{font-size:18px;margin:24px 0 8px;font-weight:600;}
      p{margin:0 0 12px;font-size:14px;}
      .tagline{font-size:18px;color:#666;margin:0 0 32px;}
      .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;}
      .pill{display:inline-block;padding:4px 12px;background:#0a0a0a;color:#fff;border-radius:99px;font-size:11px;margin:0 4px 4px 0;}
      .quote{padding:16px;border-left:3px solid #0a0a0a;margin:16px 0;font-style:italic;color:#444;}
      hr{border:none;border-top:1px solid #ddd;margin:32px 0;}
      .footer{margin-top:64px;padding-top:24px;border-top:1px solid #ddd;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.1em;}
    </style></head><body>
      <h1>${b.name}</h1>
      ${business.description ? `<p class="tagline">${business.description}</p>` : ""}
      ${business.value_prop ? `<div class="quote">${business.value_prop}</div>` : ""}
      ${business.model ? `<h2>Modelo de negocio</h2><span class="pill">${business.model}</span>` : ""}
      ${business.target_market ? `<h2>Target</h2><p>${business.target_market}</p>` : ""}
      ${dna.audience ? `<h2>Audiencia</h2><p>${dna.audience}</p>` : ""}
      ${dna.personality ? `<h2>Personalidad</h2><p>${dna.personality}</p>` : ""}
      ${dna.unique_value ? `<h2>Valor único</h2><p>${dna.unique_value}</p>` : ""}
      ${dna.tone && dna.tone.length ? `<h2>Tono</h2><div>${dna.tone.map((t) => `<span class="pill">${t}</span>`).join("")}</div>` : ""}
      ${dna.keywords && dna.keywords.length ? `<h2>Palabras clave</h2><div>${dna.keywords.map((k) => `<span class="pill" style="background:#666;">${k}</span>`).join("")}</div>` : ""}
      ${dna.forbidden_words && dna.forbidden_words.length ? `<h2>Palabras prohibidas</h2><div>${dna.forbidden_words.map((k) => `<span class="pill" style="background:#c00;">${k}</span>`).join("")}</div>` : ""}
      ${dna.colors && dna.colors.length ? `<h2>Paleta</h2><div class="grid">${colors}</div>` : ""}
      ${ds.photoStyle ? `<h2>Estilo fotográfico</h2><p>${ds.photoStyle}</p>` : ""}
      ${ds.composition ? `<h2>Composición</h2><p>${ds.composition}</p>` : ""}
      ${ds.colorTreatment ? `<h2>Color</h2><p>${ds.colorTreatment}</p>` : ""}
      ${ds.lighting ? `<h2>Iluminación</h2><p>${ds.lighting}</p>` : ""}
      ${ds.casting ? `<h2>Casting</h2><p>${ds.casting}</p>` : ""}
      ${ds.preferred_locations && ds.preferred_locations.length ? `<h2>Locaciones</h2><div>${ds.preferred_locations.map((l) => `<span class="pill" style="background:#666;">${l}</span>`).join("")}</div>` : ""}
      ${ds.product_presentation ? `<h2>Presentación del producto</h2><p>${ds.product_presentation}</p>` : ""}
      ${ds.motion_rules ? `<h2>Motion rules</h2><p>${ds.motion_rules}</p>` : ""}
      ${ds.visualDos && ds.visualDos.length ? `<h2>Siempre mostrar</h2><ul>${ds.visualDos.map((x) => `<li>${x}</li>`).join("")}</ul>` : ""}
      ${ds.visualDonts && ds.visualDonts.length ? `<h2>Nunca mostrar</h2><ul>${ds.visualDonts.map((x) => `<li>${x}</li>`).join("")}</ul>` : ""}
      ${dna.competitors && dna.competitors.length ? `<h2>Competidores</h2><div>${dna.competitors.map((c) => `<span class="pill" style="background:#fff;color:#0a0a0a;border:1px solid #0a0a0a;">${c}</span>`).join("")}</div>` : ""}
      <div class="footer">${b.name} · Brand Identity · Generado por Coevo · ${new Date().toLocaleDateString("es-AR", { year: "numeric", month: "long", day: "numeric" })}</div>
    </body></html>`;
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const html = buildIdentityHTML();
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeBrand.name.toLowerCase().replace(/\s+/g, "-")}-brand-identity.html`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const hasContent = !!(activeBrand.dna?.tone || activeBrand.designSystem?.photoStyle);

  return (
    <CardShell
      title="Brand Identity export"
      description="Descargá un HTML standalone con todo el brand kit — listo para mandarle al cliente o imprimir como PDF."
    >
      {!hasContent && (
        <p className="text-[12px] text-fg-faint italic">Necesitás Brand DNA y/o Design System extraídos antes de exportar.</p>
      )}
      <button
        onClick={handleExport}
        disabled={exporting || !hasContent}
        className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold bg-[var(--color-warm)] text-[var(--color-warm-fg)] rounded-[var(--radius-sm)] hover:opacity-90 disabled:opacity-50 cursor-pointer"
      >
        <Download size={14} />
        {exporting ? "Generando..." : "Descargar Brand Identity (HTML)"}
      </button>
    </CardShell>
  );
}

// ── Reusable wrapper card ─────────────────────────────────────

function CardShell({ title, description, action, children }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-md)] border border-edge bg-surface-1">
      <header className="flex items-start justify-between gap-3 px-5 py-3 border-b border-edge">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-fg">{title}</h2>
          {description && <p className="text-[12px] text-fg-faint mt-0.5">{description}</p>}
        </div>
        {action}
      </header>
      <div className="p-5 space-y-3">{children}</div>
    </section>
  );
}

// ── 1) Business ──────────────────────────────────────────────

const BUSINESS_MODELS: Array<{ value: BusinessModel; label: string }> = [
  { value: "ecommerce", label: "Ecommerce" },
  { value: "saas", label: "SaaS" },
  { value: "academy", label: "Academia / Curso" },
  { value: "service", label: "Servicio" },
  { value: "subscription", label: "Suscripción" },
  { value: "marketplace", label: "Marketplace" },
  { value: "d2c", label: "D2C" },
  { value: "agency", label: "Agencia" },
];

export function BusinessCard() {
  const { activeBrand, refreshBrands } = useBrand();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<BrandBusiness>({});
  const [saving, setSaving] = useState(false);

  if (!activeBrand) return null;
  const business = activeBrand.business || {};

  const handleEdit = () => {
    setDraft({
      model: business.model,
      description: business.description,
      value_prop: business.value_prop,
      target_market: business.target_market,
      revenue_streams: business.revenue_streams,
    });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateBrand(activeBrand.id, { business: draft });
      await refreshBrands();
      setEditing(false);
    } catch (err) {
      console.error("[business] save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <CardShell
      title="Negocio"
      description="Cómo opera y qué vende la marca. Es el framing comercial que usan los pipelines."
      action={editing ? (
        <div className="flex gap-1.5">
          <button onClick={() => setEditing(false)} className="px-2.5 py-1 text-[11px] text-fg-muted hover:text-fg cursor-pointer">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="px-3 py-1 text-[11px] font-medium bg-[var(--color-warm)] text-[var(--color-warm-fg)] rounded-[var(--radius-sm)] hover:opacity-90 disabled:opacity-50 cursor-pointer">{saving ? "Guardando..." : "Guardar"}</button>
        </div>
      ) : (
        <button onClick={handleEdit} className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-fg-muted hover:text-fg cursor-pointer">
          <Pencil size={11} /> Editar
        </button>
      )}
    >
      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider mb-1 block">Modelo</label>
            <div className="flex gap-1.5 flex-wrap">
              {BUSINESS_MODELS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setDraft((d) => ({ ...d, model: m.value }))}
                  className={cn(
                    "px-3 py-1.5 rounded-[var(--radius-sm)] text-[11px] font-medium border transition-all cursor-pointer",
                    draft.model === m.value
                      ? "border-[var(--color-warm)] bg-[var(--color-warm-muted)] text-fg"
                      : "border-edge bg-surface-2 text-fg-muted hover:text-fg"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <Field label="Descripción del negocio" value={draft.description || ""} onChange={(v) => setDraft((d) => ({ ...d, description: v }))} placeholder="Qué vende, a quién, cómo se monetiza. 2-3 frases concretas." rows={3} />
          <Field label="Propuesta de valor" value={draft.value_prop || ""} onChange={(v) => setDraft((d) => ({ ...d, value_prop: v }))} placeholder="Una frase: por qué alguien compra." rows={2} />
          <Field label="Target / mercado" value={draft.target_market || ""} onChange={(v) => setDraft((d) => ({ ...d, target_market: v }))} placeholder="B2C / B2B + demo + psicográfico breve." rows={2} />
          <ListField
            label="Fuentes de ingreso"
            items={draft.revenue_streams || []}
            onChange={(items) => setDraft((d) => ({ ...d, revenue_streams: items }))}
            placeholder='ej: "Suscripción mensual"'
          />
        </div>
      ) : (
        <div className="space-y-3">
          {!business.model && !business.description ? (
            <p className="text-[12px] text-fg-faint italic">Sin info de negocio. Sin esto el agente no puede inferir bien el framing comercial.</p>
          ) : (
            <>
              {business.model && (
                <div className="inline-flex px-2.5 py-1 bg-[var(--color-warm-muted)] text-[var(--color-warm-strong)] rounded-full text-[11px] font-semibold uppercase tracking-wider">
                  {BUSINESS_MODELS.find((m) => m.value === business.model)?.label || business.model}
                </div>
              )}
              {business.description && <ReadField label="Descripción" value={business.description} />}
              {business.value_prop && <ReadField label="Value prop" value={business.value_prop} />}
              {business.target_market && <ReadField label="Target" value={business.target_market} />}
              {(business.revenue_streams && business.revenue_streams.length > 0) && (
                <div>
                  <p className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider mb-1">Fuentes de ingreso</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {business.revenue_streams.map((r, i) => (
                      <span key={i} className="px-2 py-0.5 bg-surface-2 rounded text-[11px] text-fg-muted">{r}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </CardShell>
  );
}

// ── 2) Brand Sources ──────────────────────────────────────────

const SOURCE_TYPES: Array<{ value: BrandSourceType; label: string; placeholder: string; needsUrl: boolean }> = [
  { value: "url", label: "Website", placeholder: "https://marca.com", needsUrl: true },
  { value: "instagram", label: "Instagram", placeholder: "https://instagram.com/marca", needsUrl: true },
  { value: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@marca", needsUrl: true },
  { value: "pdf", label: "PDF (brand book)", placeholder: "Subí desde el card de Brand System", needsUrl: false },
  { value: "text", label: "Texto pegado", placeholder: "Notas internas, brief, etc.", needsUrl: false },
  { value: "reviews", label: "Reviews", placeholder: "Pegá reviews reales", needsUrl: false },
];

export function BrandSourcesCard() {
  const { activeBrand, refreshBrands } = useBrand();
  const [adding, setAdding] = useState<BrandSourceType | null>(null);
  const [draftUrl, setDraftUrl] = useState("");
  const [draftText, setDraftText] = useState("");
  const [draftLabel, setDraftLabel] = useState("");
  const [saving, setSaving] = useState(false);

  if (!activeBrand) return null;
  const sources = activeBrand.brandSources || [];

  const addSource = async () => {
    if (!adding) return;
    const type = adding;
    const config = SOURCE_TYPES.find((s) => s.value === type)!;
    const newSource: BrandSource = {
      id: `src_${Date.now().toString(36)}`,
      type,
      label: draftLabel || undefined,
      url: config.needsUrl ? draftUrl : undefined,
      content: !config.needsUrl ? draftText : undefined,
      addedAt: new Date().toISOString(),
    };
    setSaving(true);
    try {
      await updateBrand(activeBrand.id, { brandSources: [...sources, newSource] });
      await refreshBrands();
      setAdding(null);
      setDraftUrl("");
      setDraftText("");
      setDraftLabel("");
    } catch (err) {
      console.error("[sources] add failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const removeSource = async (id: string) => {
    setSaving(true);
    try {
      await updateBrand(activeBrand.id, { brandSources: sources.filter((s) => s.id !== id) });
      await refreshBrands();
    } catch (err) {
      console.error("[sources] remove failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const config = adding ? SOURCE_TYPES.find((s) => s.value === adding) : null;

  return (
    <CardShell
      title="Brand Sources"
      description="Todas las fuentes de las que Coevo aprende sobre la marca. Cuantas más cargues, mejor el contexto. No hace falta tenerlas todas."
    >
      {sources.length === 0 ? (
        <p className="text-[12px] text-fg-faint italic">Sin fuentes cargadas. Empezá agregando al menos una (web, IG, o texto).</p>
      ) : (
        <div className="space-y-1.5">
          {sources.map((s) => {
            const cfg = SOURCE_TYPES.find((c) => c.value === s.type);
            return (
              <div key={s.id} className="flex items-center gap-3 px-3 py-2 bg-surface-2 rounded-[var(--radius-sm)] border border-edge group">
                <div className="text-[10px] font-bold text-[var(--color-warm-strong)] uppercase tracking-wider shrink-0 w-20">
                  {cfg?.label || s.type}
                </div>
                <div className="flex-1 min-w-0">
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[12px] text-fg-muted hover:text-fg flex items-center gap-1 truncate">
                      {s.url}
                      <ExternalLink size={9} className="shrink-0" />
                    </a>
                  ) : (
                    <span className="text-[12px] text-fg-muted truncate block">{(s.label || s.content || "").slice(0, 100)}{(s.content || "").length > 100 ? "..." : ""}</span>
                  )}
                </div>
                <button
                  onClick={() => removeSource(s.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-fg-faint hover:text-error cursor-pointer transition-opacity"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!adding && (
        <div className="flex gap-1.5 flex-wrap pt-1">
          {SOURCE_TYPES.map((s) => (
            <button
              key={s.value}
              onClick={() => setAdding(s.value)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium border border-dashed border-edge bg-surface-2 text-fg-muted hover:text-fg hover:border-[var(--color-warm)] rounded-[var(--radius-sm)] cursor-pointer"
            >
              <Plus size={10} /> {s.label}
            </button>
          ))}
        </div>
      )}

      {adding && config && (
        <div className="space-y-2 p-3 bg-surface-2 rounded-[var(--radius-sm)] border border-[var(--color-warm-muted)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-fg">Nuevo: {config.label}</span>
            <button onClick={() => setAdding(null)} className="text-fg-faint hover:text-fg cursor-pointer">
              <X size={12} />
            </button>
          </div>
          {config.needsUrl ? (
            <input
              type="url"
              value={draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
              placeholder={config.placeholder}
              className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] text-fg outline-none focus:border-[var(--color-warm)]"
            />
          ) : (
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder={config.placeholder}
              rows={4}
              className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] text-fg outline-none focus:border-[var(--color-warm)] resize-none"
            />
          )}
          <input
            type="text"
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            placeholder="Label (opcional)"
            className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[11px] text-fg outline-none focus:border-[var(--color-warm)]"
          />
          <button
            onClick={addSource}
            disabled={saving || (config.needsUrl ? !draftUrl : !draftText)}
            className="w-full px-3 py-1.5 text-[11px] font-semibold bg-[var(--color-warm)] text-[var(--color-warm-fg)] rounded-[var(--radius-sm)] hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Agregando..." : "Agregar fuente"}
          </button>
        </div>
      )}
    </CardShell>
  );
}

// ── 3) Customer Reviews ──────────────────────────────────────

export function CustomerReviewsCard() {
  const { activeBrand, refreshBrands } = useBrand();
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  if (!activeBrand) return null;
  const reviews = activeBrand.customerReviews || [];

  const addReview = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await updateBrand(activeBrand.id, { customerReviews: [...reviews, draft.trim()] });
      await refreshBrands();
      setDraft("");
    } finally {
      setSaving(false);
    }
  };

  const removeReview = async (idx: number) => {
    setSaving(true);
    try {
      await updateBrand(activeBrand.id, { customerReviews: reviews.filter((_, i) => i !== idx) });
      await refreshBrands();
    } finally {
      setSaving(false);
    }
  };

  return (
    <CardShell
      title="Reviews / Testimoniales"
      description="Pegá reviews reales de clientes. Coevo extrae voz auténtica para usar en copy."
    >
      {reviews.length > 0 && (
        <div className="space-y-1.5">
          {reviews.map((r, i) => (
            <div key={i} className="group flex items-start gap-2 px-3 py-2 bg-surface-2 rounded-[var(--radius-sm)] border border-edge">
              <p className="flex-1 text-[12px] text-fg-muted leading-relaxed italic">"{r}"</p>
              <button onClick={() => removeReview(i)} className="opacity-0 group-hover:opacity-100 p-1 text-fg-faint hover:text-error cursor-pointer">
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder='ej: "Probé el producto y cambió mi rutina. La calidad se nota desde el primer día."'
          rows={3}
          className="w-full bg-surface-2 border border-edge rounded-[var(--radius-sm)] px-2.5 py-2 text-[12px] text-fg outline-none focus:border-[var(--color-warm)] resize-none"
        />
        <button
          onClick={addReview}
          disabled={!draft.trim() || saving}
          className="px-3 py-1.5 text-[11px] font-semibold bg-[var(--color-warm)] text-[var(--color-warm-fg)] rounded-[var(--radius-sm)] hover:opacity-90 disabled:opacity-50 cursor-pointer"
        >
          {saving ? "..." : "+ Agregar review"}
        </button>
      </div>
    </CardShell>
  );
}

// ── 4) Competitors ────────────────────────────────────────────

export function CompetitorsCard() {
  const { activeBrand, refreshBrands } = useBrand();
  const [draft, setDraft] = useState<BrandCompetitor>({ name: "" });
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);

  if (!activeBrand) return null;
  const competitors = activeBrand.competitors || [];

  const addCompetitor = async () => {
    if (!draft.name.trim()) return;
    setSaving(true);
    try {
      await updateBrand(activeBrand.id, { competitors: [...competitors, draft] });
      await refreshBrands();
      setDraft({ name: "" });
      setAdding(false);
    } finally {
      setSaving(false);
    }
  };

  const removeCompetitor = async (idx: number) => {
    setSaving(true);
    try {
      await updateBrand(activeBrand.id, { competitors: competitors.filter((_, i) => i !== idx) });
      await refreshBrands();
    } finally {
      setSaving(false);
    }
  };

  return (
    <CardShell
      title="Competidores"
      description="Marcas con las que se compara o de las que se diferencia. Útil para framing y differenciación visual."
    >
      {competitors.length > 0 && (
        <div className="space-y-1.5">
          {competitors.map((c, i) => (
            <div key={i} className="group flex items-center gap-3 px-3 py-2 bg-surface-2 rounded-[var(--radius-sm)] border border-edge">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-fg">{c.name}</span>
                  {c.url && (
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-fg-faint hover:text-fg-muted">
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>
                {c.notes && <p className="text-[11px] text-fg-muted truncate">{c.notes}</p>}
              </div>
              <button onClick={() => removeCompetitor(i)} className="opacity-0 group-hover:opacity-100 p-1 text-fg-faint hover:text-error cursor-pointer">
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
      {adding ? (
        <div className="space-y-2 p-3 bg-surface-2 rounded-[var(--radius-sm)] border border-[var(--color-warm-muted)]">
          <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Nombre" className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] text-fg outline-none focus:border-[var(--color-warm)]" />
          <input value={draft.url || ""} onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))} placeholder="URL (opcional)" className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] text-fg outline-none focus:border-[var(--color-warm)]" />
          <textarea value={draft.notes || ""} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="Notas (qué hacen bien, cómo te diferenciás...)" rows={2} className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] text-fg outline-none focus:border-[var(--color-warm)] resize-none" />
          <div className="flex gap-1.5">
            <button onClick={addCompetitor} disabled={!draft.name.trim() || saving} className="flex-1 px-3 py-1.5 text-[11px] font-semibold bg-[var(--color-warm)] text-[var(--color-warm-fg)] rounded-[var(--radius-sm)] hover:opacity-90 disabled:opacity-50 cursor-pointer">{saving ? "..." : "Agregar"}</button>
            <button onClick={() => { setAdding(false); setDraft({ name: "" }); }} className="px-3 py-1.5 text-[11px] text-fg-muted hover:text-fg cursor-pointer">Cancelar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium border border-dashed border-edge bg-surface-2 text-fg-muted hover:text-fg hover:border-[var(--color-warm)] rounded-[var(--radius-sm)] cursor-pointer">
          <Plus size={10} /> Agregar competidor
        </button>
      )}
    </CardShell>
  );
}

// ── 5) Brand Health ───────────────────────────────────────────

export function BrandHealthCard() {
  const { activeBrand } = useBrand();
  if (!activeBrand) return null;

  const checks = [
    { key: "brandContext", label: "Brand System", ok: !!(activeBrand.brandContext && activeBrand.brandContext.length > 100), hint: "Pegá contexto de la marca o cargá fuentes" },
    { key: "business", label: "Modelo de negocio", ok: !!(activeBrand.business?.model && activeBrand.business?.description), hint: "Definí el modelo (ecommerce/saas/etc) + descripción del negocio" },
    { key: "products", label: "Productos cargados", ok: (activeBrand.products?.length || 0) > 0, hint: "Subí al menos 1 producto con foto y precio" },
    { key: "dna", label: "Brand DNA extraído", ok: !!(activeBrand.dna?.tone && activeBrand.dna?.audience), hint: "Extraé Brand DNA después de cargar Brand System" },
    { key: "palette", label: "Paleta con hex", ok: !!(activeBrand.dna?.colors && activeBrand.dna.colors.length > 0 && activeBrand.dna.colors[0].hex), hint: "El Brand DNA debe tener colores con hex codes" },
    { key: "designSystem", label: "Design System", ok: !!(activeBrand.designSystem?.photoStyle), hint: "Extraé Design System para guías visuales" },
    { key: "moodboard", label: "Moodboard cargado", ok: (activeBrand.moodboards?.length || 0) > 0, hint: "Recomendado — referencia visual de estilo" },
  ];

  const completed = checks.filter((c) => c.ok).length;
  const total = checks.length;
  const pct = Math.round((completed / total) * 100);

  return (
    <CardShell
      title="Brand Health"
      description={`${completed} de ${total} checks completados (${pct}%). Cuanto más completo, mejores los outputs.`}
    >
      <div className="w-full bg-surface-2 rounded-full h-1.5 overflow-hidden">
        <div className="bg-[var(--color-warm)] h-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="space-y-1.5 mt-3">
        {checks.map((c) => (
          <div key={c.key} className="flex items-start gap-2 px-2 py-1.5 hover:bg-surface-2 rounded-[var(--radius-sm)] transition-colors">
            {c.ok ? (
              <CheckCircle2 size={14} className="text-[var(--color-success)] shrink-0 mt-0.5" />
            ) : c.key === "moodboard" ? (
              <Circle size={14} className="text-fg-faint shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className={cn("text-[12px] font-medium", c.ok ? "text-fg" : "text-fg-muted")}>{c.label}</p>
              {!c.ok && <p className="text-[10px] text-fg-faint italic">{c.hint}</p>}
            </div>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

// ── Helpers ───────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder, rows = 2 }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider mb-1 block">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-surface-2 border border-edge rounded-[var(--radius-sm)] px-2.5 py-2 text-[12px] text-fg outline-none focus:border-[var(--color-warm)] resize-none"
      />
    </div>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-[12px] text-fg-muted leading-relaxed">{value}</p>
    </div>
  );
}

function ListField({ label, items, onChange, placeholder }: { label: string; items: string[]; onChange: (items: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  return (
    <div>
      <label className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider mb-1 block">{label}</label>
      <div className="flex gap-1.5 flex-wrap mb-2">
        {items.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-2 rounded text-[11px] text-fg-muted">
            {item}
            <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="text-fg-faint hover:text-fg cursor-pointer">
              <X size={9} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && draft.trim()) { onChange([...items, draft.trim()]); setDraft(""); } }}
          placeholder={placeholder}
          className="flex-1 bg-surface-2 border border-edge rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[11px] text-fg outline-none focus:border-[var(--color-warm)]"
        />
        <button onClick={() => { if (draft.trim()) { onChange([...items, draft.trim()]); setDraft(""); } }} className="px-2.5 py-1.5 text-[11px] text-fg-muted hover:text-fg bg-surface-2 hover:bg-surface-3 rounded-[var(--radius-sm)] cursor-pointer">+</button>
      </div>
    </div>
  );
}
