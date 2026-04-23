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
  Palette,
  Sparkles,
  Dna,
  Camera,
  X,
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
  uploadMoodboard,
  deleteMoodboard,
  moodboardImageUrl,
  addVoicePreset,
  deleteVoicePreset,
  avatarImageUrl,
  productImageUrl,
  clothingImageUrl,
  backgroundImageUrl,
  addGuidanceFromUrl,
  addGuidanceFromPdf,
  generateBrandDNA,
  extractDesignSystem,
  updateDesignSystem,
  addProductImage,
  generateTTS,
} from "../lib/api";
import type { Avatar, Product, ClothingItem, BackgroundItem, MoodboardItem, DesignSystem } from "../lib/api";
import { cn } from "../lib/utils";
import { PromptsCard } from "../components/PromptsCard";

export function BrandSettings() {
  const { activeBrand } = useBrand();

  if (!activeBrand) {
    return (
      <div className="flex items-center justify-center h-64 text-fg-muted text-[14px]">
        Seleccioná una marca desde el switcher para configurarla
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
          Configurá contexto, assets y ajustes de la marca
        </p>
      </div>

      {/* Brand System — source document, full width */}
      <GuidanceCard />

      {/* Brand DNA — extracted strategy, full width */}
      <BrandDNACard />

      {/* Design System — extracted visual rules, full width */}
      <DesignSystemCard />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VoicesCard />
        <AvatarsCard />
        <ClothingCard />
        <ProductsCard />
        <LogoCard />
        <BackgroundsCard />
        <MoodboardsCard />
        <PromptsCard />
      </div>
    </div>
  );
}

// ── Brand System Card (source document) ─────────────────────

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
      console.error("Error al guardar:", err);
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
      setUrlSuccess(`${result.added_chars.toLocaleString()} caracteres agregados desde URL`);
      setUrl("");
      setShowUrlInput(false);
      setTimeout(() => setUrlSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo traer la URL");
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
      setError(err instanceof Error ? err.message : "No se pudo leer el PDF");
    } finally {
      setPdfLoading(false);
      if (pdfRef.current) pdfRef.current.value = "";
    }
  };

  return (
    <Card
      icon={<FileText size={16} />}
      title="Brand System"
      description="Documento fuente de la marca — estrategia, voz, audiencia, diseño, messaging. De acá se extraen el Brand DNA y el Design System."
      action={
        !editing ? (
          <button
            onClick={handleEdit}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-fg-muted hover:text-fg bg-surface-1 hover:bg-surface-2 rounded-[var(--radius-sm)] transition-colors cursor-pointer"
          >
            <Pencil size={12} />
            Editar
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
              Importar desde URL
            </button>
            <button
              onClick={() => pdfRef.current?.click()}
              disabled={pdfLoading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-fg-muted hover:text-fg bg-surface-0 border border-edge hover:border-[var(--color-edge-strong)] rounded-[var(--radius-sm)] transition-colors cursor-pointer"
            >
              {pdfLoading ? <Loader2 size={12} className="animate-spin" /> : <FileUp size={12} />}
              Subir PDF
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
                className="px-3 py-1.5 text-[12px] font-medium bg-[var(--color-warm)] text-[var(--color-warm-fg)] rounded-[var(--radius-sm)] hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
              >
                {urlLoading ? <Loader2 size={12} className="animate-spin" /> : <Globe size={12} />}
                Traer
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
            placeholder="Describí la marca: tono, audiencia, valores, estilo de comunicación, idioma..."
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 text-[12px] font-medium text-fg-muted hover:text-fg rounded-[var(--radius-sm)] hover:bg-surface-2 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-[12px] font-medium bg-[var(--color-warm)] text-[var(--color-warm-fg)] rounded-[var(--radius-sm)] hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-1.5"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Guardar
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
        <EmptyState onClick={handleEdit} label="Agregar Brand System" />
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
      setError(err instanceof Error ? err.message : "Falló la subida");
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
      console.error("Error al eliminar:", err);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Card
      icon={<ImageIcon size={16} />}
      title={`Avatars (${avatars.length})`}
      description="Personas/modelos usados en generación de contenido"
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
            placeholder="Nombre del avatar"
            className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2.5 py-2 text-[13px] text-fg outline-none focus:border-[var(--color-edge-focus)] transition-colors"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción (ej. Hombre de 32 años, argentino, piel morena clara, barba corta, casual urbano)"
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
                <p className="text-[12px] text-fg-faint">Click para seleccionar imagen</p>
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
              Cancelar
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || !file || !name.trim()}
              className="px-3 py-1.5 text-[12px] font-medium bg-[var(--color-warm)] text-[var(--color-warm-fg)] rounded-[var(--radius-sm)] hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              Upload
            </button>
          </div>
        </div>
      )}

      {/* Avatar grid */}
      {avatars.length === 0 && !showUpload ? (
        <EmptyState onClick={() => setShowUpload(true)} label="Subí el primer avatar" />
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
      setError(err instanceof Error ? err.message : "Falló la subida");
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
      console.error("Error al eliminar:", err);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Card
      icon={<Package size={16} />}
      title={`Productos (${products.length})`}
      description="Imágenes de productos disponibles para generación"
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
            placeholder="Nombre del producto"
            className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2.5 py-2 text-[13px] text-fg outline-none focus:border-[var(--color-edge-focus)] transition-colors"
          />
          <div className="space-y-1">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción — o click en 'Describir con IA' después de seleccionar una imagen"
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
                Describir con IA
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
                <p className="text-[12px] text-fg-faint">Click para seleccionar imagen</p>
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
              Cancelar
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || !file || !name.trim()}
              className="px-3 py-1.5 text-[12px] font-medium bg-[var(--color-warm)] text-[var(--color-warm-fg)] rounded-[var(--radius-sm)] hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              Upload
            </button>
          </div>
        </div>
      )}

      {/* Products list */}
      {products.length === 0 && !showUpload ? (
        <EmptyState onClick={() => setShowUpload(true)} label="Subí el primer producto" />
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {products.map((p) => (
            <ProductTile
              key={p.id}
              product={p}
              deleting={deleting === p.id}
              onDelete={() => handleDelete(p.id)}
              onAddImage={async (file) => {
                try {
                  await addProductImage(activeBrand.id, p.id, file);
                  await refreshBrands();
                } catch (err) {
                  console.error("Error al agregar imagen:", err);
                }
              }}
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
  onAddImage,
}: {
  product: Product;
  deleting: boolean;
  onDelete: () => void;
  onUpdate: (name: string, description: string) => void;
  onAddImage: (file: File) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(product.name);
  const [editDesc, setEditDesc] = useState(product.description || "");
  const [aiLoading, setAiLoading] = useState(false);
  const extraFileRef = useRef<HTMLInputElement>(null);

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

  const allImages = [
    { imageUrl: product.imageUrl, label: "Main" },
    ...(product.images || []),
  ];
  const canAddMore = allImages.length < 3;

  return (
    <div className="group relative rounded-[var(--radius-sm)] bg-surface-2 overflow-hidden">
      {/* Image gallery — main + extras */}
      <div className="flex gap-0.5">
        <div className="flex-1 aspect-square">
          <img src={productImageUrl(product.imageUrl)} alt={product.name} className="w-full h-full object-cover" />
        </div>
        {(product.images || []).length > 0 && (
          <div className="flex flex-col gap-0.5" style={{ width: "30%" }}>
            {(product.images || []).map((img, idx) => (
              <div key={idx} className="flex-1">
                <img src={productImageUrl(img.imageUrl)} alt={img.label || `Photo ${idx + 2}`} className="w-full h-full object-cover" />
              </div>
            ))}
            {canAddMore && (
              <label className="flex-1 flex items-center justify-center bg-surface-3 cursor-pointer hover:bg-surface-2 transition-colors text-fg-faint hover:text-fg-muted">
                <Plus size={12} />
                <input ref={extraFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onAddImage(f);
                  e.target.value = "";
                }} />
              </label>
            )}
          </div>
        )}
      </div>
      {/* Add first extra photo button — only when no extras yet */}
      {(product.images || []).length === 0 && (
        <label className="absolute top-1 right-1 p-1 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" title="Agregar más fotos (hasta 3)">
          <Plus size={10} />
          <input type="file" accept="image/*" className="hidden" onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onAddImage(f);
            e.target.value = "";
          }} />
        </label>
      )}
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
              <button onClick={() => setEditing(false)} className="text-[9px] text-fg-faint cursor-pointer">Cancelar</button>
              <button onClick={handleSave} className="text-[9px] text-[var(--color-warm)] font-medium cursor-pointer">Guardar</button>
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
      setError(err instanceof Error ? err.message : "Falló la subida");
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
      console.error("Error al eliminar:", err);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Card
      icon={<Shirt size={16} />}
      title={`Prendas (${clothing.length})`}
      description="Prendas disponibles para outfits de avatars"
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
            placeholder="Nombre (ej. Jogger Negro)"
            className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2.5 py-2 text-[13px] text-fg outline-none focus:border-[var(--color-edge-focus)] transition-colors"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción (ej. Jogger de algodón orgánico, corte recto, cintura elástica, color negro liso)"
            rows={3}
            className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2.5 py-2 text-[13px] text-fg outline-none resize-none focus:border-[var(--color-edge-focus)] transition-colors"
          />
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags (separadas por coma: casual, negro, algodón)"
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
                <p className="text-[12px] text-fg-faint">Click para seleccionar imagen</p>
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
              Cancelar
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || !file || !name.trim()}
              className="px-3 py-1.5 text-[12px] font-medium bg-[var(--color-warm)] text-[var(--color-warm-fg)] rounded-[var(--radius-sm)] hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              Upload
            </button>
          </div>
        </div>
      )}

      {/* Clothing grid */}
      {clothing.length === 0 && !showUpload ? (
        <EmptyState onClick={() => setShowUpload(true)} label="Subí la primera prenda" />
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
    if (!name.trim() || !voiceId.trim()) { setError("Nombre y Voice ID son requeridos"); return; }
    setSaving(true);
    setError(null);
    try {
      await addVoicePreset(activeBrand.id, name.trim(), voiceId.trim());
      await refreshBrands();
      setName(""); setVoiceId(""); setShowAdd(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la voz");
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
      title={`Voces (${voices.length})`}
      description="IDs de voces de ElevenLabs para generación TTS"
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
                  ? "bg-[var(--color-warm)] text-[var(--color-warm-fg)]"
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
            <p className="text-[12px] font-medium text-fg-secondary">Agregar voz</p>

            <div className="space-y-1.5">
              <label className="text-[11px] text-fg-faint font-medium">Display Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Sofia — Voz femenina"
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
                    ? "text-[var(--color-warm-fg)] bg-[var(--color-warm)] hover:opacity-90 cursor-pointer"
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
            Agregar Voice ID
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
      setError(err instanceof Error ? err.message : "Falló la subida");
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
      console.error("Error al eliminar:", err);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Card
      icon={<Mountain size={16} />}
      title={`Fondos (${backgrounds.length})`}
      description="Escenas y fondos para UGC y generación de contenido"
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
            placeholder="Nombre del fondo (ej. Living con luz natural)"
            className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2.5 py-2 text-[13px] text-fg outline-none focus:border-[var(--color-edge-focus)] transition-colors"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción (ej. Living moderno con paredes blancas, piso de madera, luz natural lateral)"
            rows={3}
            className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2.5 py-2 text-[13px] text-fg outline-none resize-none focus:border-[var(--color-edge-focus)] transition-colors"
          />
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags (separadas por coma: interior, natural, moderno)"
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
                <p className="text-[12px] text-fg-faint">Click para seleccionar imagen de fondo</p>
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
              Cancelar
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || !file || !name.trim()}
              className="px-3 py-1.5 text-[12px] font-medium bg-[var(--color-warm)] text-[var(--color-warm-fg)] rounded-[var(--radius-sm)] hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              Upload
            </button>
          </div>
        </div>
      )}

      {backgrounds.length === 0 && !showUpload ? (
        <EmptyState onClick={() => setShowUpload(true)} label="Subí el primer fondo" />
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

// ── Moodboards Card ──────────────────────────────────────────

function MoodboardsCard() {
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

  const moodboards = activeBrand.moodboards || [];
  const atLimit = moodboards.length >= 5;

  const handleUpload = async () => {
    if (!file || !name.trim()) return;
    setUploading(true);
    setError(null);
    try {
      await uploadMoodboard(activeBrand.id, name.trim(), file, description.trim());
      await refreshBrands();
      setShowUpload(false);
      setName("");
      setDescription("");
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falló la subida");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (itemId: string) => {
    setDeleting(itemId);
    try {
      await deleteMoodboard(activeBrand.id, itemId);
      await refreshBrands();
    } catch (err) {
      console.error("Error al eliminar:", err);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Card
      icon={<Palette size={16} />}
      title={`Moodboard (${moodboards.length}/5)`}
      description="Referencias de estilo visual — uno activo por tool"
      action={
        !atLimit ? (
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-fg-muted hover:text-fg bg-surface-1 hover:bg-surface-2 rounded-[var(--radius-sm)] transition-colors cursor-pointer"
          >
            <Plus size={12} />
            Add
          </button>
        ) : (
          <span className="text-[11px] text-fg-faint">Max 5 reached</span>
        )
      }
    >
      {showUpload && (
        <div className="mb-4 p-3 bg-surface-0 border border-edge rounded-[var(--radius-sm)] space-y-2.5">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del moodboard (ej. Verano editorial 2025)"
            className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2.5 py-2 text-[13px] text-fg outline-none focus:border-[var(--color-edge-focus)] transition-colors"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción (ej. Tonos cálidos, luz natural, estética editorial minimalista, paleta terracota)"
            rows={2}
            className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2.5 py-2 text-[13px] text-fg outline-none resize-none focus:border-[var(--color-edge-focus)] transition-colors"
          />
          <div
            onClick={() => fileRef.current?.click()}
            className={cn(
              "border border-dashed border-edge rounded-[var(--radius-sm)] px-3 py-4 text-center cursor-pointer transition-colors",
              file ? "border-[var(--color-warm)] bg-[var(--color-warm-subtle)]" : "hover:border-[var(--color-edge-strong)]"
            )}
          >
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            {file ? (
              <span className="text-[12px] text-fg-secondary">{file.name}</span>
            ) : (
              <div className="space-y-1">
                <Upload size={16} className="mx-auto text-fg-faint" />
                <p className="text-[12px] text-fg-faint">Click to select moodboard image</p>
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
              Cancelar
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || !file || !name.trim()}
              className="px-3 py-1.5 text-[12px] font-medium bg-[var(--color-warm)] text-[var(--color-warm-fg)] rounded-[var(--radius-sm)] hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              Upload
            </button>
          </div>
        </div>
      )}

      {moodboards.length === 0 && !showUpload ? (
        <EmptyState onClick={() => setShowUpload(true)} label="Subí el primer moodboard" />
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {moodboards.map((m) => (
            <MoodboardTile key={m.id} item={m} deleting={deleting === m.id} onDelete={() => handleDelete(m.id)} />
          ))}
        </div>
      )}
    </Card>
  );
}

function MoodboardTile({ item, deleting, onDelete }: { item: MoodboardItem; deleting: boolean; onDelete: () => void }) {
  return (
    <div className="group relative rounded-[var(--radius-sm)] bg-surface-2 overflow-hidden">
      <div className="aspect-square">
        <img src={moodboardImageUrl(item.imageUrl)} alt={item.name} className="w-full h-full object-cover" />
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
      description={dna ? "Identidad de marca extraída por IA — usada en prompts de copy (scripts, captions, ads)" : "Destilá el brand guidance en datos estructurados (colores, tono, audiencia, etc.) que se inyectan en todas las tools"}
      action={
        <button
          onClick={handleGenerate}
          disabled={generating || !hasContext}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-[var(--radius-sm)] transition-all cursor-pointer disabled:opacity-40",
            dna
              ? "text-fg-muted hover:text-fg bg-surface-2 hover:bg-surface-3"
              : "bg-[var(--color-warm)] text-[var(--color-warm-fg)] hover:opacity-90"
          )}
        >
          {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {dna ? "Regenerar" : "Generar DNA"}
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
          Agregá brand guidance (URL o PDF) primero, después click en "Generar DNA".
        </p>
      )}

      {generating && !dna && (
        <div className="flex items-center justify-center gap-2 py-8 text-fg-muted">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-[13px]">Analizando contexto con IA...</span>
        </div>
      )}

      {dna && (
        <div className="space-y-5">
          {/* Colors */}
          {dna.colors && dna.colors.length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider mb-2">Paleta de colores</h4>
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
                <h4 className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider mb-2">Tono de marca</h4>
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
                <h4 className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider mb-2">Palabras clave</h4>
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
              <h4 className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider mb-2">Personalidad</h4>
              <p className="text-[13px] text-fg-muted leading-relaxed italic">&ldquo;{dna.personality}&rdquo;</p>
            </div>
          )}

          {/* Audience */}
          {dna.audience && (
            <div>
              <h4 className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider mb-2">Audiencia</h4>
              <p className="text-[13px] text-fg-muted leading-relaxed">{dna.audience}</p>
            </div>
          )}

          {/* Unique Value */}
          {dna.unique_value && (
            <div>
              <h4 className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider mb-2">Valor único</h4>
              <p className="text-[13px] text-fg leading-relaxed font-medium">{dna.unique_value}</p>
            </div>
          )}

          {/* Competitors + Fonts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dna.competitors && dna.competitors.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider mb-2">Competidores</h4>
                <div className="flex flex-wrap gap-1.5">
                  {dna.competitors.map((c, i) => (
                    <span key={i} className="text-[11px] px-2.5 py-1 bg-surface-2 text-fg-muted rounded-full">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {fonts && (fonts.headline || fonts.body) && (
              <div>
                <h4 className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider mb-2">Tipografías sugeridas</h4>
                <div className="space-y-1">
                  {fonts.headline && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-fg-faint w-16">Titular:</span>
                      <span className="text-[12px] text-fg font-medium">{fonts.headline}</span>
                    </div>
                  )}
                  {fonts.body && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-fg-faint w-16">Cuerpo:</span>
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


// ── Design System Card ──────────────────────────────────────

function DesignSystemCard() {
  const { activeBrand, refreshBrands } = useBrand();
  const [extracting, setExtracting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DesignSystem>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!activeBrand) return null;

  const ds = activeBrand.designSystem;
  const hasContext = !!activeBrand.brandContext?.trim();

  const handleExtract = async () => {
    setExtracting(true);
    setError(null);
    try {
      await extractDesignSystem(activeBrand.id);
      await refreshBrands();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falló la extracción");
    } finally {
      setExtracting(false);
    }
  };

  const handleEdit = () => {
    setDraft(ds || {});
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateDesignSystem(activeBrand.id, draft);
      await refreshBrands();
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  if (!hasContext && !ds) return null;

  return (
    <Card
      icon={<Camera size={18} />}
      title="Design System"
      description={ds ? "Reglas visuales extraídas por IA — usadas en prompts de tools de imagen/video" : "Destilá la dirección visual del brand guidance — se inyecta en todas las tools que generan imágenes"}
      action={
        <div className="flex items-center gap-2">
          {ds && !editing && (
            <button
              onClick={handleEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-[var(--radius-sm)] text-fg-muted hover:text-fg bg-surface-2 hover:bg-surface-3 transition-all cursor-pointer"
            >
              <Pencil size={12} />
              Editar
            </button>
          )}
          {editing ? (
            <>
              <button
                onClick={() => setEditing(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-[var(--radius-sm)] text-fg-muted hover:text-fg bg-surface-2 hover:bg-surface-3 transition-all cursor-pointer"
              >
                <X size={12} />
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-[var(--radius-sm)] bg-[var(--color-warm)] text-[var(--color-warm-fg)] hover:opacity-90 transition-all cursor-pointer disabled:opacity-40"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Guardar
              </button>
            </>
          ) : (
            <button
              onClick={handleExtract}
              disabled={extracting || !hasContext}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-[var(--radius-sm)] transition-all cursor-pointer disabled:opacity-40",
                ds
                  ? "text-fg-muted hover:text-fg bg-surface-2 hover:bg-surface-3"
                  : "bg-[var(--color-warm)] text-[var(--color-warm-fg)] hover:opacity-90"
              )}
            >
              {extracting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {ds ? "Re-extraer" : "Extraer del guidance"}
            </button>
          )}
        </div>
      }
    >
      {error && (
        <div className="flex items-center gap-2 text-[12px] text-red-400 mb-4">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {!ds && !extracting && !editing && (
        <p className="text-[13px] text-fg-faint text-center py-4">
          Agregá brand guidance (URL o PDF) primero, después click en "Extraer del guidance".
        </p>
      )}

      {extracting && !ds && (
        <div className="flex items-center justify-center gap-2 py-8 text-fg-muted">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-[13px]">Extrayendo reglas visuales con IA...</span>
        </div>
      )}

      {editing && (
        <div className="space-y-4">
          <DesignField label="Estilo fotográfico" value={draft.photoStyle || ""} onChange={(v) => setDraft({ ...draft, photoStyle: v })} rows={3} />
          <DesignField label="Composición" value={draft.composition || ""} onChange={(v) => setDraft({ ...draft, composition: v })} rows={2} />
          <DesignField label="Tratamiento de color" value={draft.colorTreatment || ""} onChange={(v) => setDraft({ ...draft, colorTreatment: v })} rows={2} />
          <DesignField label="Iluminación" value={draft.lighting || ""} onChange={(v) => setDraft({ ...draft, lighting: v })} rows={2} />
          <DesignListField label="Siempre mostrar (dos)" items={draft.visualDos || []} onChange={(items) => setDraft({ ...draft, visualDos: items })} />
          <DesignListField label="Nunca mostrar (don'ts)" items={draft.visualDonts || []} onChange={(items) => setDraft({ ...draft, visualDonts: items })} />
          <DesignField label="Referencias visuales" value={draft.references || ""} onChange={(v) => setDraft({ ...draft, references: v })} rows={2} />
        </div>
      )}

      {ds && !editing && (
        <div className="space-y-4">
          {ds.photoStyle && (
            <div>
              <h4 className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider mb-1">Estilo fotográfico</h4>
              <p className="text-[13px] text-fg-muted leading-relaxed">{ds.photoStyle}</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ds.composition && (
              <div>
                <h4 className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider mb-1">Composición</h4>
                <p className="text-[13px] text-fg-muted leading-relaxed">{ds.composition}</p>
              </div>
            )}
            {ds.colorTreatment && (
              <div>
                <h4 className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider mb-1">Tratamiento de color</h4>
                <p className="text-[13px] text-fg-muted leading-relaxed">{ds.colorTreatment}</p>
              </div>
            )}
            {ds.lighting && (
              <div>
                <h4 className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider mb-1">Iluminación</h4>
                <p className="text-[13px] text-fg-muted leading-relaxed">{ds.lighting}</p>
              </div>
            )}
            {ds.references && (
              <div>
                <h4 className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider mb-1">Referencias</h4>
                <p className="text-[13px] text-fg-muted leading-relaxed">{ds.references}</p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ds.visualDos && ds.visualDos.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider mb-2">Siempre mostrar</h4>
                <ul className="space-y-1">
                  {ds.visualDos.map((x, i) => (
                    <li key={i} className="text-[12px] text-fg-muted flex items-start gap-1.5">
                      <Check size={12} className="text-green-400 mt-0.5 shrink-0" />
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {ds.visualDonts && ds.visualDonts.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider mb-2">Nunca mostrar</h4>
                <ul className="space-y-1">
                  {ds.visualDonts.map((x, i) => (
                    <li key={i} className="text-[12px] text-fg-muted flex items-start gap-1.5">
                      <X size={12} className="text-red-400 mt-0.5 shrink-0" />
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function DesignField({ label, value, onChange, rows = 2 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-fg-faint uppercase tracking-wider mb-1.5">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full bg-surface-0 border border-edge rounded-[var(--radius-sm)] px-3 py-2 text-[13px] text-fg outline-none focus:border-[var(--color-edge-focus)] transition-colors resize-none"
      />
    </div>
  );
}

function DesignListField({ label, items, onChange }: { label: string; items: string[]; onChange: (items: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    onChange([...items, t]);
    setDraft("");
  };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div>
      <label className="block text-[10px] font-semibold text-fg-faint uppercase tracking-wider mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {items.map((it, i) => (
          <span key={i} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 bg-surface-2 text-fg-muted rounded-full">
            {it}
            <button onClick={() => remove(i)} className="hover:text-red-400 cursor-pointer">
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder="Agregar item..."
          className="flex-1 bg-surface-0 border border-edge rounded-[var(--radius-sm)] px-3 py-1.5 text-[12px] text-fg outline-none focus:border-[var(--color-edge-focus)] transition-colors"
        />
        <button
          onClick={add}
          className="px-3 py-1.5 text-[11px] bg-surface-2 hover:bg-surface-3 text-fg-muted rounded-[var(--radius-sm)] cursor-pointer transition-colors"
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
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
      title="Logo de marca"
      description="Usado en composiciones de ads y contenido de marca"
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
            <Upload size={11} /> Reemplazar
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
          {uploading ? "Subiendo..." : "Subir logo de marca"}
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
