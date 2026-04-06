import { useState, useRef } from "react";
import {
  FileText,
  ImageIcon,
  Package,
  Mic,
  Pencil,
  Save,
  Loader2,
  Trash2,
  Upload,
  Plus,
  AlertCircle,
  Globe,
  FileUp,
  Check,
  Shirt,
  Play,
  Square,
  Mountain,
  Sparkles,
  Dna,
} from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import {
  updateBrand,
  uploadAvatar,
  deleteAvatar,
  uploadProduct,
  deleteProduct,
  uploadClothing,
  deleteClothing,
  uploadBackground,
  deleteBackground,
  addVoicePreset,
  deleteVoicePreset,
  avatarImageUrl,
  productImageUrl,
  clothingImageUrl,
  backgroundImageUrl,
  addGuidanceFromUrl,
  addGuidanceFromPdf,
  generateBrandDNA,
  generateTTS,
} from "../lib/api";
import type { Avatar, Product, ClothingItem, BackgroundItem } from "../lib/api";
import { cn } from "../lib/utils";
import { PromptsCard } from "../components/PromptsCard";

export function BrandSettings() {
  const { activeBrand } = useBrand();

  if (!activeBrand) {
    return (
      <div className="flex items-center justify-center h-64 text-fg-muted text-[14px]">
        Select a brand from the switcher to configure it
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-semibold text-fg tracking-tight">
          {activeBrand.name}
        </h1>
        <p className="text-[14px] text-fg-muted mt-1">
          Configure brand context, assets, and settings
        </p>
      </div>

      {/* Brand DNA — full width */}
      <BrandDNACard />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GuidanceCard />
        <VoicesCard />
        <AvatarsCard />
        <ClothingCard />
        <ProductsCard />
        <LogoCard />
        <BackgroundsCard />
        <PromptsCard />
      </div>
    </div>
  );
}

// ── Brand Guidance Card ─────────────────────────────────────

function GuidanceCard() {
  const { activeBrand, refreshBrands } = useBrand();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  // URL import
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [url, setUrl] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlSuccess, setUrlSuccess] = useState<string | null>(null);

  // PDF import
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState<string | null>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);

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
      console.error("Failed to save:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleUrlImport = async () => {
    if (!url.trim()) return;
    setUrlLoading(true);
    setError(null);
    setUrlSuccess(null);
    try {
      const result = await addGuidanceFromUrl(activeBrand.id, url.trim());
      await refreshBrands();
      setUrlSuccess(`Added ${result.added_chars.toLocaleString()} chars from URL`);
      setUrl("");
      setShowUrlInput(false);
      setTimeout(() => setUrlSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch URL");
    } finally {
      setUrlLoading(false);
    }
  };

  const handlePdfUpload = async (file: File) => {
    setPdfLoading(true);
    setError(null);
    setPdfSuccess(null);
    try {
      const result = await addGuidanceFromPdf(activeBrand.id, file);
      await refreshBrands();
      setPdfSuccess(`Added ${result.added_chars.toLocaleString()} chars from ${result.pages} pages`);
      setTimeout(() => setPdfSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse PDF");
    } finally {
      setPdfLoading(false);
      if (pdfRef.current) pdfRef.current.value = "";
    }
  };

  return (
    <Card
      icon={<FileText size={16} />}
      title="Brand Guidance"
      description="The core context document that informs all AI-generated content"
      action={
        !editing ? (
          <button
            onClick={handleEdit}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-fg-muted hover:text-fg bg-surface-1 hover:bg-surface-2 rounded-[var(--radius-sm)] transition-colors cursor-pointer"
          >
            <Pencil size={12} />
            Edit
          </button>
        ) : undefined
      }
    >
      {/* Import actions */}
      {!editing && (
        <div className="mb-4 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => { setShowUrlInput(!showUrlInput); setError(null); }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-fg-muted hover:text-fg bg-surface-0 border border-edge hover:border-[var(--color-edge-strong)] rounded-[var(--radius-sm)] transition-colors cursor-pointer"
            >
              <Globe size={12} />
              Import from URL
            </button>
            <button
              onClick={() => pdfRef.current?.click()}
              disabled={pdfLoading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-fg-muted hover:text-fg bg-surface-0 border border-edge hover:border-[var(--color-edge-strong)] rounded-[var(--radius-sm)] transition-colors cursor-pointer"
            >
              {pdfLoading ? <Loader2 size={12} className="animate-spin" /> : <FileUp size={12} />}
              Upload PDF
            </button>
            <input
              ref={pdfRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handlePdfUpload(f);
              }}
            />
          </div>

          {/* URL input */}
          {showUrlInput && (
            <div className="flex gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/about"
                className="flex-1 bg-surface-0 border border-edge rounded-[var(--radius-sm)] px-2.5 py-2 text-[13px] text-fg outline-none focus:border-[var(--color-edge-focus)] transition-colors"
                onKeyDown={(e) => { if (e.key === "Enter") handleUrlImport(); }}
                autoFocus
              />
              <button
                onClick={handleUrlImport}
                disabled={urlLoading || !url.trim()}
                className="px-3 py-1.5 text-[12px] font-medium bg-[var(--color-warm)] text-white rounded-[var(--radius-sm)] hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
              >
                {urlLoading ? <Loader2 size={12} className="animate-spin" /> : <Globe size={12} />}
                Fetch
              </button>
            </div>
          )}

          {/* Success messages */}
          {urlSuccess && (
            <div className="flex items-center gap-1.5 text-[12px] text-[var(--color-success)]">
              <Check size={12} /> {urlSuccess}
            </div>
          )}
          {pdfSuccess && (
            <div className="flex items-center gap-1.5 text-[12px] text-[var(--color-success)]">
              <Check size={12} /> {pdfSuccess}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-1.5 text-[12px] text-[var(--color-error)]">
              <AlertCircle size={12} /> {error}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {editing ? (
        <div className="space-y-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full bg-surface-0 border border-edge rounded-[var(--radius-sm)] px-3 py-2.5 text-[13px] text-fg outline-none resize-none focus:border-[var(--color-edge-focus)] transition-colors leading-relaxed"
            rows={10}
            placeholder="Describe the brand: tone, audience, values, communication style, language..."
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 text-[12px] font-medium text-fg-muted hover:text-fg rounded-[var(--radius-sm)] hover:bg-surface-2 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-[12px] font-medium bg-[var(--color-warm)] text-white rounded-[var(--radius-sm)] hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-1.5"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Save
            </button>
          </div>
        </div>
      ) : activeBrand.brandContext ? (
        <div className="max-h-[300px] overflow-y-auto">
          <p className="text-[13px] text-fg-muted leading-relaxed whitespace-pre-wrap">
            {activeBrand.brandContext}
          </p>
        </div>
      ) : (
        <EmptyState onClick={handleEdit} label="Add brand guidance" />
      )}
    </Card>
  );
}

// ── Avatars Card ────────────────────────────────────────────

function AvatarsCard() {
  const { activeBrand, refreshBrands } = useBrand();
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!activeBrand) return null;

  const avatars = activeBrand.avatars || [];

  const handleUpload = async () => {
    if (!file || !name.trim()) return;
    setUploading(true);
    setError(null);
    try {
      await uploadAvatar(activeBrand.id, name.trim(), file, false, description.trim());
      await refreshBrands();
      setShowUpload(false);
      setName("");
      setDescription("");
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (avatarId: string) => {
    setDeleting(avatarId);
    try {
      await deleteAvatar(activeBrand.id, avatarId);
      await refreshBrands();
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Card
      icon={<ImageIcon size={16} />}
      title={`Avatars (${avatars.length})`}
      description="People/models used in content generation"
      action={
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-fg-muted hover:text-fg bg-surface-1 hover:bg-surface-2 rounded-[var(--radius-sm)] transition-colors cursor-pointer"
        >
          <Plus size={12} />
          Add
        </button>
      }
    >
      {/* Upload form */}
      {showUpload && (
        <div className="mb-4 p-3 bg-surface-0 border border-edge rounded-[var(--radius-sm)] space-y-2.5">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Avatar name"
            className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2.5 py-2 text-[13px] text-fg outline-none focus:border-[var(--color-edge-focus)] transition-colors"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (e.g. Hombre de 32 años, argentino, piel morena clara, barba corta, casual urbano)"
            rows={3}
            className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2.5 py-2 text-[13px] text-fg outline-none resize-none focus:border-[var(--color-edge-focus)] transition-colors"
          />
          <div
            onClick={() => fileRef.current?.click()}
            className={cn(
              "border border-dashed border-edge rounded-[var(--radius-sm)] px-3 py-4 text-center cursor-pointer transition-colors",
              file ? "border-[var(--color-warm)] bg-[var(--color-warm-subtle)]" : "hover:border-[var(--color-edge-strong)]"
            )}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file ? (
              <span className="text-[12px] text-fg-secondary">{file.name}</span>
            ) : (
              <div className="space-y-1">
                <Upload size={16} className="mx-auto text-fg-faint" />
                <p className="text-[12px] text-fg-faint">Click to select image</p>
              </div>
            )}
          </div>
          {error && (
            <div className="flex items-center gap-1.5 text-[12px] text-[var(--color-error)]">
              <AlertCircle size={12} /> {error}
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowUpload(false); setName(""); setDescription(""); setFile(null); setError(null); }}
              className="px-2.5 py-1.5 text-[12px] text-fg-muted hover:text-fg rounded-[var(--radius-sm)] hover:bg-surface-2 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || !file || !name.trim()}
              className="px-3 py-1.5 text-[12px] font-medium bg-[var(--color-warm)] text-white rounded-[var(--radius-sm)] hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              Upload
            </button>
          </div>
        </div>
      )}

      {/* Avatar grid */}
      {avatars.length === 0 && !showUpload ? (
        <EmptyState onClick={() => setShowUpload(true)} label="Upload first avatar" />
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {avatars.map((a) => (
            <AvatarTile
              key={a.id}
              avatar={a}
              deleting={deleting === a.id}
              onDelete={() => handleDelete(a.id)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function AvatarTile({
  avatar,
  deleting,
  onDelete,
}: {
  avatar: Avatar;
  deleting: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="group relative rounded-[var(--radius-sm)] bg-surface-2 overflow-hidden">
      <div className="aspect-square">
        <img
          src={avatarImageUrl(avatar.imageUrl)}
          alt={avatar.name}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-2 space-y-0.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-fg font-medium truncate">{avatar.name}</span>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="p-0.5 rounded text-fg-faint hover:text-error transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
          >
            {deleting ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
          </button>
        </div>
        {avatar.description && (
          <p className="text-[10px] text-fg-faint leading-tight line-clamp-2">{avatar.description}</p>
        )}
      </div>
    </div>
  );
}

// ── Products Card ───────────────────────────────────────────

function ProductsCard() {
  const { activeBrand, refreshBrands } = useBrand();
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!activeBrand) return null;

  const products = activeBrand.products || [];

  const handleUpload = async () => {
    if (!file || !name.trim()) return;
    setUploading(true);
    setError(null);
    try {
      await uploadProduct(activeBrand.id, name.trim(), file, description.trim());
      await refreshBrands();
      setShowUpload(false);
      setName("");
      setDescription("");
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (productId: string) => {
    setDeleting(productId);
    try {
      await deleteProduct(activeBrand.id, productId);
      await refreshBrands();
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Card
      icon={<Package size={16} />}
      title={`Products (${products.length})`}
      description="Product images available for content generation"
      action={
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-fg-muted hover:text-fg bg-surface-1 hover:bg-surface-2 rounded-[var(--radius-sm)] transition-colors cursor-pointer"
        >
          <Plus size={12} />
          Add
        </button>
      }
    >
      {/* Upload form */}
      {showUpload && (
        <div className="mb-4 p-3 bg-surface-0 border border-edge rounded-[var(--radius-sm)] space-y-2.5">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Product name"
            className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2.5 py-2 text-[13px] text-fg outline-none focus:border-[var(--color-edge-focus)] transition-colors"
          />
          <div className="space-y-1">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description — or click 'AI Describe' after selecting an image"
              rows={2}
              className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2.5 py-2 text-[13px] text-fg outline-none resize-none focus:border-[var(--color-edge-focus)] transition-colors"
            />
            {file && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    const formData = new FormData();
                    formData.append("image", file);
                    formData.append("type", "product");
                    formData.append("name", name);
                    const res = await fetch("http://localhost:8000/api/analyze/image", { method: "POST", body: formData });
                    if (res.ok) {
                      const data = await res.json();
                      setDescription(data.description || "");
                    }
                  } catch { /* silent */ }
                }}
                className="flex items-center gap-1.5 text-[11px] text-[var(--color-warm)] hover:underline cursor-pointer"
              >
                <Sparkles size={11} />
                AI Describe
              </button>
            )}
          </div>
          <div
            onClick={() => fileRef.current?.click()}
            className={cn(
              "border border-dashed border-edge rounded-[var(--radius-sm)] px-3 py-4 text-center cursor-pointer transition-colors",
              file ? "border-[var(--color-warm)] bg-[var(--color-warm-subtle)]" : "hover:border-[var(--color-edge-strong)]"
            )}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file ? (
              <span className="text-[12px] text-fg-secondary">{file.name}</span>
            ) : (
              <div className="space-y-1">
                <Upload size={16} className="mx-auto text-fg-faint" />
                <p className="text-[12px] text-fg-faint">Click to select image</p>
              </div>
            )}
          </div>
          {error && (
            <div className="flex items-center gap-1.5 text-[12px] text-[var(--color-error)]">
              <AlertCircle size={12} /> {error}
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowUpload(false); setName(""); setDescription(""); setFile(null); setError(null); }}
              className="px-2.5 py-1.5 text-[12px] text-fg-muted hover:text-fg rounded-[var(--radius-sm)] hover:bg-surface-2 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || !file || !name.trim()}
              className="px-3 py-1.5 text-[12px] font-medium bg-[var(--color-warm)] text-white rounded-[var(--radius-sm)] hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              Upload
            </button>
          </div>
        </div>
      )}

      {/* Products list */}
      {products.length === 0 && !showUpload ? (
        <EmptyState onClick={() => setShowUpload(true)} label="Upload first product" />
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {products.map((p) => (
            <ProductTile
              key={p.id}
              product={p}
              deleting={deleting === p.id}
              onDelete={() => handleDelete(p.id)}
              onUpdate={async (newName, newDesc) => {
                try {
                  await fetch(`http://localhost:8000/api/brands/${activeBrand.id}/products/${p.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: newName, description: newDesc }),
                  });
                  await refreshBrands();
                } catch { /* silent */ }
              }}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function ProductTile({
  product,
  deleting,
  onDelete,
  onUpdate,
}: {
  product: Product;
  deleting: boolean;
  onDelete: () => void;
  onUpdate: (name: string, description: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(product.name);
  const [editDesc, setEditDesc] = useState(product.description || "");
  const [aiLoading, setAiLoading] = useState(false);

  const handleSave = () => {
    onUpdate(editName, editDesc);
    setEditing(false);
  };

  const handleAiDescribe = async () => {
    setAiLoading(true);
    try {
      const imgUrl = productImageUrl(product.imageUrl);
      const res = await fetch(imgUrl);
      const blob = await res.blob();
      const formData = new FormData();
      formData.append("image", blob, "product.jpg");
      formData.append("type", "product");
      formData.append("name", editName);
      const analyzeRes = await fetch("http://localhost:8000/api/analyze/image", { method: "POST", body: formData });
      if (analyzeRes.ok) {
        const data = await analyzeRes.json();
        setEditDesc(data.description || "");
      }
    } catch { /* silent */ } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="group relative rounded-[var(--radius-sm)] bg-surface-2 overflow-hidden">
      <div className="aspect-square">
        <img src={productImageUrl(product.imageUrl)} alt={product.name} className="w-full h-full object-cover" />
      </div>
      <div className="p-2 space-y-0.5">
        {editing ? (
          <div className="space-y-1.5">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full h-6 px-1.5 rounded border border-edge bg-surface-1 text-[11px] text-fg outline-none"
            />
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={2}
              className="w-full px-1.5 py-1 rounded border border-edge bg-surface-1 text-[10px] text-fg outline-none resize-none"
            />
            <div className="flex gap-1">
              <button onClick={handleAiDescribe} disabled={aiLoading} className="flex items-center gap-1 text-[9px] text-[var(--color-warm)] cursor-pointer">
                {aiLoading ? <Loader2 size={9} className="animate-spin" /> : <Sparkles size={9} />}
                AI
              </button>
              <div className="flex-1" />
              <button onClick={() => setEditing(false)} className="text-[9px] text-fg-faint cursor-pointer">Cancel</button>
              <button onClick={handleSave} className="text-[9px] text-[var(--color-warm)] font-medium cursor-pointer">Save</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-fg font-medium truncate">{product.name}</span>
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setEditing(true)} className="p-0.5 rounded text-fg-faint hover:text-fg cursor-pointer">
                  <Pencil size={10} />
                </button>
                <button onClick={onDelete} disabled={deleting} className="p-0.5 rounded text-fg-faint hover:text-error cursor-pointer">
                  {deleting ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                </button>
              </div>
            </div>
            {product.description && (
              <p className="text-[10px] text-fg-faint leading-tight line-clamp-2">{product.description}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Clothing Card ───────────────────────────────────────────

function ClothingCard() {
  const { activeBrand, refreshBrands } = useBrand();
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!activeBrand) return null;

  const clothing = activeBrand.clothing || [];

  const handleUpload = async () => {
    if (!file || !name.trim()) return;
    setUploading(true);
    setError(null);
    try {
      await uploadClothing(activeBrand.id, name.trim(), file, description.trim(), tags.trim());
      await refreshBrands();
      setShowUpload(false);
      setName("");
      setDescription("");
      setTags("");
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (itemId: string) => {
    setDeleting(itemId);
    try {
      await deleteClothing(activeBrand.id, itemId);
      await refreshBrands();
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Card
      icon={<Shirt size={16} />}
      title={`Clothing (${clothing.length})`}
      description="Wardrobe items available for avatar outfits"
      action={
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-fg-muted hover:text-fg bg-surface-1 hover:bg-surface-2 rounded-[var(--radius-sm)] transition-colors cursor-pointer"
        >
          <Plus size={12} />
          Add
        </button>
      }
    >
      {/* Upload form */}
      {showUpload && (
        <div className="mb-4 p-3 bg-surface-0 border border-edge rounded-[var(--radius-sm)] space-y-2.5">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Item name (e.g. Jogger Negro)"
            className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2.5 py-2 text-[13px] text-fg outline-none focus:border-[var(--color-edge-focus)] transition-colors"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (e.g. Jogger de algodón orgánico, corte recto, cintura elástica, color negro liso)"
            rows={3}
            className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2.5 py-2 text-[13px] text-fg outline-none resize-none focus:border-[var(--color-edge-focus)] transition-colors"
          />
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags (comma separated: casual, negro, algodón)"
            className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2.5 py-2 text-[13px] text-fg outline-none focus:border-[var(--color-edge-focus)] transition-colors"
          />
          <div
            onClick={() => fileRef.current?.click()}
            className={cn(
              "border border-dashed border-edge rounded-[var(--radius-sm)] px-3 py-4 text-center cursor-pointer transition-colors",
              file ? "border-[var(--color-warm)] bg-[var(--color-warm-subtle)]" : "hover:border-[var(--color-edge-strong)]"
            )}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file ? (
              <span className="text-[12px] text-fg-secondary">{file.name}</span>
            ) : (
              <div className="space-y-1">
                <Upload size={16} className="mx-auto text-fg-faint" />
                <p className="text-[12px] text-fg-faint">Click to select image</p>
              </div>
            )}
          </div>
          {error && (
            <div className="flex items-center gap-1.5 text-[12px] text-[var(--color-error)]">
              <AlertCircle size={12} /> {error}
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowUpload(false); setName(""); setDescription(""); setTags(""); setFile(null); setError(null); }}
              className="px-2.5 py-1.5 text-[12px] text-fg-muted hover:text-fg rounded-[var(--radius-sm)] hover:bg-surface-2 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || !file || !name.trim()}
              className="px-3 py-1.5 text-[12px] font-medium bg-[var(--color-warm)] text-white rounded-[var(--radius-sm)] hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              Upload
            </button>
          </div>
        </div>
      )}

      {/* Clothing grid */}
      {clothing.length === 0 && !showUpload ? (
        <EmptyState onClick={() => setShowUpload(true)} label="Upload first clothing item" />
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {clothing.map((c) => (
            <ClothingTile
              key={c.id}
              item={c}
              deleting={deleting === c.id}
              onDelete={() => handleDelete(c.id)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function ClothingTile({
  item,
  deleting,
  onDelete,
}: {
  item: ClothingItem;
  deleting: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="group relative rounded-[var(--radius-sm)] bg-surface-2 overflow-hidden">
      <div className="aspect-square">
        <img
          src={clothingImageUrl(item.imageUrl)}
          alt={item.name}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-2 space-y-0.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-fg font-medium truncate">{item.name}</span>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="p-0.5 rounded text-fg-faint hover:text-error transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
          >
            {deleting ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
          </button>
        </div>
        {item.description && (
          <p className="text-[10px] text-fg-faint leading-tight line-clamp-2">{item.description}</p>
        )}
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {item.tags.map((t) => (
              <span key={t} className="text-[9px] px-1.5 py-0.5 bg-surface-3 rounded text-fg-faint">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Voices Card ─────────────────────────────────────────────

function VoicesCard() {
  const { activeBrand, refreshBrands } = useBrand();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (!activeBrand) return null;

  const voices = activeBrand.voicePresets || [];

  const stopAudio = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingId(null);
  };

  const handlePlay = async (id: string, vname: string) => {
    if (playingId === id) { stopAudio(); return; }
    stopAudio();
    setLoadingId(id);
    try {
      const sampleText = activeBrand.brandContext
        ? activeBrand.brandContext.slice(0, 150)
        : `Hola, soy ${vname}. Esta es una muestra de mi voz para ${activeBrand.name}.`;
      const result = await generateTTS({ text: sampleText, voice_id: id });
      const audio = new Audio(result.audioUrl);
      audioRef.current = audio;
      audio.onended = () => { setPlayingId(null); audioRef.current = null; };
      audio.play();
      setPlayingId(id);
    } catch { /* silent */ } finally {
      setLoadingId(null);
    }
  };

  const handlePreview = async () => {
    if (!voiceId.trim()) return;
    stopAudio();
    setPreviewLoading(true);
    try {
      const text = `Hola, esta es una muestra de mi voz. Soy ${name || "una voz de ElevenLabs"}.`;
      const result = await generateTTS({ text, voice_id: voiceId.trim() });
      const audio = new Audio(result.audioUrl);
      audioRef.current = audio;
      audio.onended = () => { setPlayingId(null); audioRef.current = null; };
      audio.play();
      setPlayingId("__preview__");
    } catch {
      setError("Voice ID not found or ElevenLabs error");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !voiceId.trim()) { setError("Name and Voice ID are required"); return; }
    setSaving(true);
    setError(null);
    try {
      await addVoicePreset(activeBrand.id, name.trim(), voiceId.trim());
      await refreshBrands();
      setName(""); setVoiceId(""); setShowAdd(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save voice");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteVoicePreset(activeBrand.id, id);
      await refreshBrands();
    } catch { /* silent */ } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card
      icon={<Mic size={16} />}
      title={`Voice Presets (${voices.length})`}
      description="ElevenLabs voice IDs for TTS generation"
    >
      <div className="space-y-3">
        {voices.length === 0 && !showAdd && (
          <p className="text-[13px] text-fg-faint">No voices configured yet</p>
        )}

        {voices.map((v) => (
          <div
            key={v.id}
            className="flex items-center gap-2.5 px-3 py-2 bg-surface-0 border border-edge rounded-[var(--radius-sm)]"
          >
            <button
              onClick={() => handlePlay(v.id, v.name)}
              disabled={loadingId === v.id}
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer",
                playingId === v.id
                  ? "bg-[var(--color-warm)] text-white"
                  : "bg-surface-2 text-fg-muted hover:text-fg hover:bg-surface-3"
              )}
            >
              {loadingId === v.id ? (
                <Loader2 size={13} className="animate-spin" />
              ) : playingId === v.id ? (
                <Square size={10} />
              ) : (
                <Play size={12} className="ml-0.5" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-fg font-medium">{v.name}</p>
              <p className="text-[11px] text-fg-faint font-mono truncate">{v.id}</p>
            </div>
            <button
              onClick={() => handleDelete(v.id)}
              disabled={deletingId === v.id}
              className="w-6 h-6 flex items-center justify-center text-fg-faint hover:text-[var(--color-error)] transition-colors cursor-pointer rounded"
            >
              {deletingId === v.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            </button>
          </div>
        ))}

        {showAdd && (
          <div className="bg-surface-0 border border-edge rounded-[var(--radius-sm)] p-4 space-y-3">
            <p className="text-[12px] font-medium text-fg-secondary">Add Voice</p>

            <div className="space-y-1.5">
              <label className="text-[11px] text-fg-faint font-medium">Display Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="E.g., Sofia — Spanish Female"
                className="w-full h-8 px-3 rounded-[var(--radius-sm)] border border-edge bg-surface-2 text-[13px] text-fg placeholder:text-fg-faint outline-none focus:border-[var(--color-edge-focus)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] text-fg-faint font-medium">ElevenLabs Voice ID</label>
              <input
                value={voiceId}
                onChange={(e) => { setVoiceId(e.target.value); setError(null); }}
                placeholder="E.g., 21m00Tcm4TlvDq8ikWAM"
                className="w-full h-8 px-3 rounded-[var(--radius-sm)] border border-edge bg-surface-2 text-[13px] text-fg placeholder:text-fg-faint font-mono outline-none focus:border-[var(--color-edge-focus)]"
              />
              <p className="text-[10px] text-fg-faint">
                Found in ElevenLabs → Voices → Voice Settings → Voice ID
              </p>
            </div>

            {error && (
              <p className="text-[12px] text-[var(--color-error)] flex items-center gap-1.5">
                <AlertCircle size={12} /> {error}
              </p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handlePreview}
                disabled={!voiceId.trim() || previewLoading}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-[var(--radius-sm)] transition-colors",
                  voiceId.trim() && !previewLoading
                    ? "text-fg-muted bg-surface-2 hover:bg-surface-3 hover:text-fg cursor-pointer"
                    : "text-fg-faint bg-surface-2 cursor-not-allowed opacity-50"
                )}
              >
                {previewLoading ? <Loader2 size={12} className="animate-spin" /> : playingId === "__preview__" ? <Square size={10} /> : <Play size={12} />}
                {playingId === "__preview__" ? "Playing..." : "Preview"}
              </button>

              <div className="flex-1" />

              <button
                onClick={() => { setShowAdd(false); setName(""); setVoiceId(""); setError(null); }}
                className="px-3 py-1.5 text-[12px] text-fg-muted hover:text-fg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !name.trim() || !voiceId.trim()}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-1.5 text-[12px] font-medium rounded-[var(--radius-sm)] transition-colors",
                  !saving && name.trim() && voiceId.trim()
                    ? "text-white bg-[var(--color-warm)] hover:opacity-90 cursor-pointer"
                    : "text-fg-faint bg-surface-2 cursor-not-allowed opacity-50"
                )}
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Save
              </button>
            </div>
          </div>
        )}

        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 text-[12px] text-fg-muted hover:text-fg transition-colors cursor-pointer"
          >
            <Plus size={13} />
            Add Voice ID
          </button>
        )}
      </div>
    </Card>
  );
}

// ── Shared Components ───────────────────────────────────────

// ── Backgrounds Card ────────────────────────────────────────

function BackgroundsCard() {
  const { activeBrand, refreshBrands } = useBrand();
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!activeBrand) return null;

  const backgrounds = activeBrand.backgrounds || [];

  const handleUpload = async () => {
    if (!file || !name.trim()) return;
    setUploading(true);
    setError(null);
    try {
      await uploadBackground(activeBrand.id, name.trim(), file, description.trim(), tags.trim());
      await refreshBrands();
      setShowUpload(false);
      setName("");
      setDescription("");
      setTags("");
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (itemId: string) => {
    setDeleting(itemId);
    try {
      await deleteBackground(activeBrand.id, itemId);
      await refreshBrands();
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Card
      icon={<Mountain size={16} />}
      title={`Backgrounds (${backgrounds.length})`}
      description="Background scenes and settings for UGC and content generation"
      action={
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-fg-muted hover:text-fg bg-surface-1 hover:bg-surface-2 rounded-[var(--radius-sm)] transition-colors cursor-pointer"
        >
          <Plus size={12} />
          Add
        </button>
      }
    >
      {showUpload && (
        <div className="mb-4 p-3 bg-surface-0 border border-edge rounded-[var(--radius-sm)] space-y-2.5">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Background name (e.g. Living con luz natural)"
            className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2.5 py-2 text-[13px] text-fg outline-none focus:border-[var(--color-edge-focus)] transition-colors"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (e.g. Living moderno con paredes blancas, piso de madera, luz natural lateral)"
            rows={3}
            className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2.5 py-2 text-[13px] text-fg outline-none resize-none focus:border-[var(--color-edge-focus)] transition-colors"
          />
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags (comma separated: interior, natural, moderno)"
            className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2.5 py-2 text-[13px] text-fg outline-none focus:border-[var(--color-edge-focus)] transition-colors"
          />
          <div
            onClick={() => fileRef.current?.click()}
            className={cn(
              "border border-dashed border-edge rounded-[var(--radius-sm)] px-3 py-4 text-center cursor-pointer transition-colors",
              file ? "border-[var(--color-warm)] bg-[var(--color-warm-subtle)]" : "hover:border-[var(--color-edge-strong)]"
            )}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file ? (
              <span className="text-[12px] text-fg-secondary">{file.name}</span>
            ) : (
              <div className="space-y-1">
                <Upload size={16} className="mx-auto text-fg-faint" />
                <p className="text-[12px] text-fg-faint">Click to select background image</p>
              </div>
            )}
          </div>
          {error && (
            <div className="flex items-center gap-1.5 text-[12px] text-[var(--color-error)]">
              <AlertCircle size={12} /> {error}
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowUpload(false); setName(""); setDescription(""); setTags(""); setFile(null); setError(null); }}
              className="px-2.5 py-1.5 text-[12px] text-fg-muted hover:text-fg rounded-[var(--radius-sm)] hover:bg-surface-2 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || !file || !name.trim()}
              className="px-3 py-1.5 text-[12px] font-medium bg-[var(--color-warm)] text-white rounded-[var(--radius-sm)] hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              Upload
            </button>
          </div>
        </div>
      )}

      {backgrounds.length === 0 && !showUpload ? (
        <EmptyState onClick={() => setShowUpload(true)} label="Upload first background" />
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {backgrounds.map((bg) => (
            <BackgroundTile
              key={bg.id}
              item={bg}
              deleting={deleting === bg.id}
              onDelete={() => handleDelete(bg.id)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function BackgroundTile({
  item,
  deleting,
  onDelete,
}: {
  item: BackgroundItem;
  deleting: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="group relative rounded-[var(--radius-sm)] bg-surface-2 overflow-hidden">
      <div className="aspect-video">
        <img
          src={backgroundImageUrl(item.imageUrl)}
          alt={item.name}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-2 space-y-0.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-fg font-medium truncate">{item.name}</span>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="p-0.5 rounded text-fg-faint hover:text-error transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
          >
            {deleting ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
          </button>
        </div>
        {item.description && (
          <p className="text-[10px] text-fg-faint leading-tight line-clamp-2">{item.description}</p>
        )}
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {item.tags.map((t) => (
              <span key={t} className="text-[9px] px-1.5 py-0.5 bg-surface-3 rounded text-fg-faint">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Card({
  icon,
  title,
  description,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface-1 border border-edge rounded-[var(--radius-lg)] overflow-hidden">
      <div className="px-5 py-4 border-b border-edge-subtle flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-fg-muted">{icon}</div>
          <div>
            <h3 className="text-[14px] font-semibold text-fg">{title}</h3>
            <p className="text-[12px] text-fg-faint mt-0.5">{description}</p>
          </div>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function EmptyState({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-6 border border-dashed border-edge rounded-[var(--radius-sm)] text-[13px] text-fg-faint hover:text-fg-muted hover:border-[var(--color-edge-strong)] transition-colors cursor-pointer flex items-center justify-center gap-2"
    >
      <Plus size={14} />
      {label}
    </button>
  );
}

// ── Brand DNA Card ──────────────────────────────────────────

function BrandDNACard() {
  const { activeBrand, refreshBrands } = useBrand();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!activeBrand) return null;

  const dna = activeBrand.dna;
  const fonts = activeBrand.fonts;
  const hasContext = !!activeBrand.brandContext?.trim();

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      await generateBrandDNA(activeBrand.id);
      await refreshBrands();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate");
    } finally {
      setGenerating(false);
    }
  };

  if (!hasContext && !dna) return null;

  return (
    <Card
      icon={<Dna size={18} />}
      title="Brand DNA"
      description={dna ? "AI-extracted brand identity" : "Generate structured brand identity from your guidance"}
      action={
        <button
          onClick={handleGenerate}
          disabled={generating || !hasContext}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-[var(--radius-sm)] transition-all cursor-pointer disabled:opacity-40",
            dna
              ? "text-fg-muted hover:text-fg bg-surface-2 hover:bg-surface-3"
              : "bg-[var(--color-warm)] text-white hover:opacity-90"
          )}
        >
          {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {dna ? "Regenerate" : "Generate DNA"}
        </button>
      }
    >
      {error && (
        <div className="flex items-center gap-2 text-[12px] text-red-400 mb-4">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {!dna && !generating && (
        <p className="text-[13px] text-fg-faint text-center py-4">
          Add brand guidance (URL or PDF) first, then click Generate DNA.
        </p>
      )}

      {generating && !dna && (
        <div className="flex items-center justify-center gap-2 py-8 text-fg-muted">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-[13px]">Analyzing brand context with AI...</span>
        </div>
      )}

      {dna && (
        <div className="space-y-5">
          {/* Colors */}
          {dna.colors && dna.colors.length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider mb-2">Color Palette</h4>
              <div className="flex flex-wrap gap-2">
                {dna.colors.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 bg-surface-0 border border-edge rounded-[var(--radius-sm)] px-3 py-2">
                    <div
                      className="w-6 h-6 rounded-full border border-white/20 shrink-0"
                      style={{ backgroundColor: c.hex }}
                    />
                    <div>
                      <span className="text-[11px] font-medium text-fg">{c.name}</span>
                      <span className="text-[10px] text-fg-faint ml-1.5 font-mono">{c.hex}</span>
                      <p className="text-[9px] text-fg-faint">{c.usage}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tone + Keywords */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dna.tone && dna.tone.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider mb-2">Brand Tone</h4>
                <div className="flex flex-wrap gap-1.5">
                  {dna.tone.map((t, i) => (
                    <span key={i} className="text-[11px] px-2.5 py-1 bg-[var(--color-warm-muted)] text-[var(--color-warm)] rounded-full font-medium">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {dna.keywords && dna.keywords.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider mb-2">Keywords</h4>
                <div className="flex flex-wrap gap-1.5">
                  {dna.keywords.map((k, i) => (
                    <span key={i} className="text-[11px] px-2.5 py-1 bg-surface-2 text-fg-muted rounded-full">{k}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Personality */}
          {dna.personality && (
            <div>
              <h4 className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider mb-2">Brand Personality</h4>
              <p className="text-[13px] text-fg-muted leading-relaxed italic">&ldquo;{dna.personality}&rdquo;</p>
            </div>
          )}

          {/* Audience */}
          {dna.audience && (
            <div>
              <h4 className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider mb-2">Target Audience</h4>
              <p className="text-[13px] text-fg-muted leading-relaxed">{dna.audience}</p>
            </div>
          )}

          {/* Unique Value */}
          {dna.unique_value && (
            <div>
              <h4 className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider mb-2">Unique Value</h4>
              <p className="text-[13px] text-fg leading-relaxed font-medium">{dna.unique_value}</p>
            </div>
          )}

          {/* Competitors + Fonts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dna.competitors && dna.competitors.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider mb-2">Competitors</h4>
                <div className="flex flex-wrap gap-1.5">
                  {dna.competitors.map((c, i) => (
                    <span key={i} className="text-[11px] px-2.5 py-1 bg-surface-2 text-fg-muted rounded-full">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {fonts && (fonts.headline || fonts.body) && (
              <div>
                <h4 className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider mb-2">Suggested Fonts</h4>
                <div className="space-y-1">
                  {fonts.headline && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-fg-faint w-16">Headline:</span>
                      <span className="text-[12px] text-fg font-medium">{fonts.headline}</span>
                    </div>
                  )}
                  {fonts.body && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-fg-faint w-16">Body:</span>
                      <span className="text-[12px] text-fg font-medium">{fonts.body}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Logo Card ──────────────────────────────────────────────

function LogoCard() {
  const { activeBrand, refreshBrands } = useBrand();
  const [uploading, setUploading] = useState(false);

  if (!activeBrand) return null;

  const logo = activeBrand.logo as { filename: string; imageUrl: string } | undefined;
  const API_BASE = "http://localhost:8000";

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch(`${API_BASE}/api/brands/${activeBrand.id}/logo`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) await refreshBrands();
    } catch { /* silent */ } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await fetch(`${API_BASE}/api/brands/${activeBrand.id}/logo`, { method: "DELETE" });
      await refreshBrands();
    } catch { /* silent */ }
  };

  return (
    <Card
      icon={<ImageIcon size={16} />}
      title="Brand Logo"
      description="Used in ad compositions and branded content"
    >
      {logo?.imageUrl ? (
        <div className="space-y-2">
          <div className="relative group inline-block">
            <div className="w-32 h-32 rounded-[var(--radius-sm)] border border-edge overflow-hidden bg-white flex items-center justify-center p-2">
              <img
                src={`${API_BASE}${logo.imageUrl}`}
                alt="Brand logo"
                className="max-w-full max-h-full object-contain"
              />
            </div>
            <button
              onClick={handleDelete}
              className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <Trash2 size={10} />
            </button>
          </div>
          <label className="flex items-center gap-1.5 text-[11px] text-fg-muted hover:text-fg cursor-pointer">
            <Upload size={11} /> Replace
            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = "";
            }} />
          </label>
        </div>
      ) : (
        <label className={cn(
          "flex flex-col items-center gap-2 py-6 border border-dashed rounded-[var(--radius-sm)] cursor-pointer text-[11px] transition-all",
          uploading
            ? "border-[var(--color-warm)] bg-[var(--color-warm-muted)] text-fg-muted"
            : "border-edge hover:border-[var(--color-edge-strong)] hover:bg-surface-2 text-fg-muted hover:text-fg"
        )}>
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {uploading ? "Uploading..." : "Upload brand logo"}
          <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
            e.target.value = "";
          }} />
        </label>
      )}
    </Card>
  );
}
