/**
 * NewGenerationWizard — 4-step wizard to set up a new UGC video generation.
 * Step 1: Select Avatar (character)
 * Step 2: Select Product (from catalog, or upload new)
 * Step 3: Generate Scene Image (avatar + product → auto-generated with nano-banana-2)
 * Step 4: Video Objective (auto-generated or manual) → Launches the pipeline
 */
import { useState, useRef, useEffect } from "react";
import {
    X, User, Package, Sparkles, ChevronRight, ChevronLeft, Loader2,
    Zap, Plus, Upload, Image, RotateCcw, CheckCircle2, AlertCircle,
    Wand2, Film,
} from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import { cn } from "../lib/utils";
import {
    type Product, uploadProduct, productImageUrl,
    createImageEdit, pollImageGen,
} from "../lib/api";

interface Avatar {
    id: string;
    name: string;
    imageUrl?: string;
    talkingPhotoId?: string | null;
}

interface WizardResult {
    avatarId: string;
    avatarName: string;
    avatarImageUrl?: string;
    productId: string;
    productName: string;
    productImageUrl?: string;
    videoObjective: string;
    /** The AI-generated scene image URL (from step 3) */
    generatedSceneImageUrl?: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onLaunch: (result: WizardResult) => void;
    avatars: Avatar[];
    products: Product[];
    brandId: string;
    avatarImageUrl: (url: string) => string;
    onProductUploaded?: () => void;
}

const STEPS = [
    { id: 1, label: "Personaje", icon: <User size={14} /> },
    { id: 2, label: "Producto",  icon: <Package size={14} /> },
    { id: 3, label: "Escena",    icon: <Image size={14} /> },
    { id: 4, label: "Objetivo",  icon: <Sparkles size={14} /> },
];

// ── Image generation status ──
type ImgGenStatus = "idle" | "generating" | "done" | "error";

export function NewGenerationWizard({
    isOpen, onClose, onLaunch, avatars, products, brandId,
    avatarImageUrl: getAvatarUrl, onProductUploaded,
}: Props) {
    const [step, setStep] = useState(1);
    const [selectedAvatarId, setSelectedAvatarId] = useState<string>("");
    const [selectedProductId, setSelectedProductId] = useState<string>("");
    const [videoObjective, setVideoObjective] = useState("");
    const [suggestingObjective, setSuggestingObjective] = useState(false);

    // Upload new product state
    const [showUpload, setShowUpload] = useState(false);
    const [newProductName, setNewProductName] = useState("");
    const [newProductFile, setNewProductFile] = useState<File | null>(null);
    const [newProductPreview, setNewProductPreview] = useState<string>("");
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Step 3 — image generation state
    const [imgGenStatus, setImgGenStatus] = useState<ImgGenStatus>("idle");
    const [imgGenUrl, setImgGenUrl] = useState<string | null>(null);
    const [imgGenError, setImgGenError] = useState<string | null>(null);
    const [imgGenProgress, setImgGenProgress] = useState<string>("Iniciando...");
    const imgGenAbortRef = useRef(false);

    if (!isOpen) return null;

    const selectedAvatar = avatars.find(a => a.id === selectedAvatarId);
    const selectedProduct = products.find(p => p.id === selectedProductId);

    // ── Derived full URLs ──
    const avatarFullUrl = selectedAvatar?.imageUrl ? getAvatarUrl(selectedAvatar.imageUrl) : undefined;
    const productFullUrl = selectedProduct?.imageUrl ? productImageUrl(selectedProduct.imageUrl) : undefined;

    const canProceed = () => {
        if (step === 1) return !!selectedAvatarId;
        if (step === 2) return !!selectedProductId;
        if (step === 3) return imgGenStatus === "done" && !!imgGenUrl;
        if (step === 4) return videoObjective.trim().length > 0;
        return false;
    };

    // Auto-launch image generation when entering step 3
    const triggerImageGen = async () => {
        if (!avatarFullUrl) {
            setImgGenStatus("error");
            setImgGenError("No se encontró la imagen del avatar.");
            return;
        }

        imgGenAbortRef.current = false;
        setImgGenStatus("generating");
        setImgGenUrl(null);
        setImgGenError(null);
        setImgGenProgress("Enviando referencias a Nano Banana 2...");

        const imageUrls: string[] = [avatarFullUrl];
        if (productFullUrl) imageUrls.push(productFullUrl);

        const avatarName = selectedAvatar?.name || "person";
        const productName = selectedProduct?.name || "product";
        const prompt = `Photorealistic vertical UGC video scene (9:16). ${avatarName} naturally holding or using "${productName}" as a product. The product is clearly visible as the main background element. High-quality lifestyle photography, studio-grade lighting, premium brand feel, crisp details.`;

        try {
            const result = await createImageEdit(imageUrls, prompt, "9:16", "1K");

            if (imgGenAbortRef.current) return;

            if (result.status === "completed" && result.image_url) {
                setImgGenUrl(result.image_url);
                setImgGenStatus("done");
                return;
            }

            // Poll
            setImgGenProgress("Generando composición... (30-90s)");
            const finalStatus = await pollImageGen(result.request_id, (s) => {
                if (imgGenAbortRef.current) return;
                if (s.status === "processing") setImgGenProgress("Procesando escena...");
                else if (s.status === "pending") setImgGenProgress("En cola...");
            });

            if (imgGenAbortRef.current) return;

            if (finalStatus.status === "completed" && finalStatus.image_url) {
                setImgGenUrl(finalStatus.image_url);
                setImgGenStatus("done");
            } else {
                throw new Error(finalStatus.error || "La generación de imagen falló.");
            }
        } catch (e: any) {
            if (imgGenAbortRef.current) return;
            setImgGenStatus("error");
            setImgGenError(e.message || "Error desconocido.");
        }
    };

    const handleNext = async () => {
        if (step === 2) {
            // Move to step 3 and auto-launch image gen
            setStep(3);
            await triggerImageGen();
            return;
        }
        if (step < 4) {
            setStep(step + 1);
        } else {
            onLaunch({
                avatarId: selectedAvatarId,
                avatarName: selectedAvatar?.name || "",
                avatarImageUrl: avatarFullUrl,
                productId: selectedProductId,
                productName: selectedProduct?.name || "",
                productImageUrl: productFullUrl,
                videoObjective: videoObjective.trim(),
                generatedSceneImageUrl: imgGenUrl || undefined,
            });
            resetWizard();
        }
    };

    const handleBack = () => {
        if (step === 3) {
            imgGenAbortRef.current = true;
            setImgGenStatus("idle");
            setImgGenUrl(null);
            setImgGenError(null);
        }
        if (step > 1) setStep(step - 1);
    };

    const handleRegenerateImage = () => {
        triggerImageGen();
    };

    const resetWizard = () => {
        imgGenAbortRef.current = true;
        setStep(1);
        setSelectedAvatarId("");
        setSelectedProductId("");
        setVideoObjective("");
        setShowUpload(false);
        setNewProductName("");
        setNewProductFile(null);
        setNewProductPreview("");
        setImgGenStatus("idle");
        setImgGenUrl(null);
        setImgGenError(null);
    };

    const handleSuggestObjective = async () => {
        setSuggestingObjective(true);
        try {
            const res = await fetch(`http://localhost:8000/api/brands/${brandId}/suggest-objective`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productName: selectedProduct?.name || "", language: "es" }),
            });
            if (res.ok) {
                const data = await res.json();
                setVideoObjective(data.objective || "");
            }
        } catch (e) {
            console.error("Failed to suggest objective:", e);
        } finally {
            setSuggestingObjective(false);
        }
    };

    const handleUploadProduct = async () => {
        if (!newProductName.trim() || !newProductFile) return;
        setUploading(true);
        try {
            const product = await uploadProduct(brandId, newProductName.trim(), newProductFile);
            setSelectedProductId(product.id);
            setShowUpload(false);
            setNewProductName("");
            setNewProductFile(null);
            setNewProductPreview("");
            onProductUploaded?.();
        } catch (e) {
            console.error("Failed to upload product:", e);
        } finally {
            setUploading(false);
        }
    };

    const handleFileChange = (file: File) => {
        if (!file.type.startsWith("image/")) return;
        setNewProductFile(file);
        setNewProductPreview(URL.createObjectURL(file));
    };

    const handleClose = () => {
        resetWizard();
        onClose();
    };

    const nextLabel = () => {
        if (step === 2) return <><Wand2 size={14} /> Generar Escena</>;
        if (step === 4) return <><Zap size={14} /> Lanzar Pipeline</>;
        return <>Siguiente <ChevronRight size={14} /></>;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

            <div className="relative bg-surface-0 border border-edge rounded-[var(--radius-lg)] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-edge shrink-0">
                    <div>
                        <h2 className="text-[18px] font-semibold text-fg tracking-tight">Nueva Generación</h2>
                        <p className="text-[13px] text-fg-faint mt-0.5">Configurá los parámetros del video UGC</p>
                    </div>
                    <button
                        onClick={handleClose}
                        className="cursor-pointer w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-surface-2 text-fg-faint hover:text-fg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-0 px-6 py-3 border-b border-edge-subtle bg-surface-1/30">
                    {STEPS.map((s, i) => (
                        <div key={s.id} className="flex items-center">
                            <div className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded text-[12px] font-medium transition-all",
                                step === s.id
                                    ? "text-fg bg-surface-2"
                                    : step > s.id
                                        ? "text-fg-muted"
                                        : "text-fg-faint"
                            )}>
                                {step > s.id ? (
                                    <span className="text-[var(--color-warm)]">✓</span>
                                ) : (
                                    s.icon
                                )}
                                {s.label}
                            </div>
                            {i < STEPS.length - 1 && (
                                <ChevronRight size={12} className="mx-1 text-fg-faint" />
                            )}
                        </div>
                    ))}
                </div>

                {/* Content */}
                <div className="px-6 py-6 flex-1 overflow-y-auto min-h-[320px]">

                    {/* ── Step 1: Select Avatar ── */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-[14px] font-medium text-fg mb-1">Elegí el personaje</h3>
                                <p className="text-[12px] text-fg-faint">Seleccioná qué avatar va a protagonizar el video.</p>
                            </div>
                            {avatars.length === 0 ? (
                                <div className="border border-dashed border-edge rounded-[var(--radius-md)] p-8 text-center">
                                    <p className="text-[13px] text-fg-muted">No hay avatares cargados.</p>
                                    <p className="text-[12px] text-fg-faint mt-1">Subí un personaje en la sección de avatares primero.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-3">
                                    {avatars.map(avatar => (
                                        <button
                                            key={avatar.id}
                                            onClick={() => setSelectedAvatarId(avatar.id)}
                                            className={cn(
                                                "cursor-pointer relative border rounded-[var(--radius-md)] overflow-hidden transition-all group",
                                                selectedAvatarId === avatar.id
                                                    ? "border-[var(--color-warm)] ring-1 ring-[var(--color-warm)]/30"
                                                    : "border-edge hover:border-edge-strong"
                                            )}
                                        >
                                            {avatar.imageUrl ? (
                                                <img
                                                    src={getAvatarUrl(avatar.imageUrl)}
                                                    alt={avatar.name}
                                                    className="w-full aspect-[3/4] object-cover"
                                                />
                                            ) : (
                                                <div className="w-full aspect-[3/4] bg-surface-1 flex items-center justify-center">
                                                    <User size={24} className="text-fg-faint" />
                                                </div>
                                            )}
                                            <div className="px-3 py-2 bg-surface-0 border-t border-edge-subtle">
                                                <p className="text-[12px] font-medium text-fg truncate">{avatar.name}</p>
                                            </div>
                                            {selectedAvatarId === avatar.id && (
                                                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[var(--color-warm)] flex items-center justify-center">
                                                    <span className="text-white text-[10px] font-bold">✓</span>
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Step 2: Select or Upload Product ── */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-[14px] font-medium text-fg mb-1">¿Qué producto promocionamos?</h3>
                                    <p className="text-[12px] text-fg-faint">Elegí uno de los productos cargados o subí uno nuevo.</p>
                                </div>
                                <button
                                    onClick={() => setShowUpload(!showUpload)}
                                    className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded border border-edge bg-surface-1 text-[12px] font-medium text-fg-muted hover:text-fg hover:border-edge-strong transition-all shrink-0"
                                >
                                    <Plus size={12} /> Subir nuevo
                                </button>
                            </div>

                            {/* Upload form */}
                            {showUpload && (
                                <div className="border border-edge rounded-[var(--radius-md)] bg-surface-1/30 p-4 space-y-3">
                                    <Input
                                        placeholder="Nombre del producto (ej: Remera oversize)"
                                        value={newProductName}
                                        onChange={(e) => setNewProductName(e.target.value)}
                                        className="text-[13px]"
                                        autoFocus
                                    />
                                    <div className="flex gap-3">
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                                        />
                                        {newProductPreview ? (
                                            <img
                                                src={newProductPreview}
                                                alt="Preview"
                                                className="w-16 h-16 rounded-[var(--radius-sm)] object-cover border border-edge cursor-pointer"
                                                onClick={() => fileInputRef.current?.click()}
                                            />
                                        ) : (
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="cursor-pointer w-16 h-16 rounded-[var(--radius-sm)] border border-dashed border-edge flex items-center justify-center hover:border-edge-strong transition-colors"
                                            >
                                                <Upload size={16} className="text-fg-faint" />
                                            </button>
                                        )}
                                        <div className="flex-1 flex items-end">
                                            <Button
                                                onClick={handleUploadProduct}
                                                disabled={!newProductName.trim() || !newProductFile || uploading}
                                                className="h-8 px-4 text-[12px] gap-1.5"
                                                size="sm"
                                            >
                                                {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                                                {uploading ? "Subiendo..." : "Subir"}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Product grid */}
                            {products.length === 0 && !showUpload ? (
                                <div className="border border-dashed border-edge rounded-[var(--radius-md)] p-8 text-center">
                                    <Package size={24} className="text-fg-faint mx-auto mb-2" />
                                    <p className="text-[13px] text-fg-muted">No hay productos cargados.</p>
                                    <button
                                        onClick={() => setShowUpload(true)}
                                        className="cursor-pointer text-[12px] text-[var(--color-warm)] mt-2 hover:underline"
                                    >
                                        Subir el primer producto
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-3">
                                    {products.map(product => (
                                        <button
                                            key={product.id}
                                            onClick={() => setSelectedProductId(product.id)}
                                            className={cn(
                                                "cursor-pointer relative border rounded-[var(--radius-md)] overflow-hidden transition-all group",
                                                selectedProductId === product.id
                                                    ? "border-[var(--color-warm)] ring-1 ring-[var(--color-warm)]/30"
                                                    : "border-edge hover:border-edge-strong"
                                            )}
                                        >
                                            <img
                                                src={productImageUrl(product.imageUrl)}
                                                alt={product.name}
                                                className="w-full aspect-square object-cover"
                                            />
                                            <div className="px-3 py-2 bg-surface-0 border-t border-edge-subtle">
                                                <p className="text-[12px] font-medium text-fg truncate">{product.name}</p>
                                            </div>
                                            {selectedProductId === product.id && (
                                                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[var(--color-warm)] flex items-center justify-center">
                                                    <span className="text-white text-[10px] font-bold">✓</span>
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Avatar reminder */}
                            {selectedAvatar && (
                                <div className="flex items-center gap-3 bg-surface-1/50 border border-edge-subtle rounded-[var(--radius-sm)] px-3 py-2">
                                    <User size={14} className="text-fg-faint shrink-0" />
                                    <span className="text-[12px] text-fg-muted">
                                        Personaje: <span className="text-fg font-medium">{selectedAvatar.name}</span>
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Step 3: Generate Scene Image ── */}
                    {step === 3 && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-[14px] font-medium text-fg mb-1">Generando escena base</h3>
                                <p className="text-[12px] text-fg-faint">
                                    La IA está componiendo una imagen con <span className="text-fg font-medium">{selectedAvatar?.name}</span> y el producto <span className="text-fg font-medium">{selectedProduct?.name}</span>.
                                </p>
                            </div>

                            {/* Main image area */}
                            <div className="relative w-full rounded-[var(--radius-md)] overflow-hidden bg-surface-1 border border-edge" style={{ aspectRatio: "9/16", maxHeight: "380px" }}>

                                {/* Generating state */}
                                {imgGenStatus === "generating" && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-surface-1">
                                        {/* Reference images preview */}
                                        <div className="flex gap-3 mb-2">
                                            {avatarFullUrl && (
                                                <div className="relative">
                                                    <img src={avatarFullUrl} alt="Avatar" className="w-14 h-20 object-cover rounded border border-edge opacity-70" />
                                                    <span className="absolute -top-1.5 -right-1.5 bg-surface-0 border border-edge text-[9px] text-fg-faint px-1 rounded">avatar</span>
                                                </div>
                                            )}
                                            {productFullUrl && (
                                                <div className="relative">
                                                    <img src={productFullUrl} alt="Product" className="w-14 h-14 object-cover rounded border border-edge opacity-70" />
                                                    <span className="absolute -top-1.5 -right-1.5 bg-surface-0 border border-edge text-[9px] text-fg-faint px-1 rounded">producto</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-[var(--color-warm)]/10 flex items-center justify-center">
                                                <Wand2 size={16} className="text-[var(--color-warm)] animate-pulse" />
                                            </div>
                                            <p className="text-[13px] font-medium text-fg">Generando imagen...</p>
                                            <p className="text-[11px] text-fg-faint">{imgGenProgress}</p>
                                        </div>
                                        {/* Animated bars */}
                                        <div className="flex gap-1 mt-1">
                                            {[0,1,2,3,4].map(i => (
                                                <div
                                                    key={i}
                                                    className="w-1 rounded-full bg-[var(--color-warm)]/50"
                                                    style={{
                                                        height: `${12 + Math.random() * 16}px`,
                                                        animationDelay: `${i * 0.15}s`,
                                                        animation: "pulse 1s ease-in-out infinite alternate",
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Done state — show generated image */}
                                {imgGenStatus === "done" && imgGenUrl && (
                                    <>
                                        <img
                                            src={imgGenUrl}
                                            alt="Escena generada"
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute top-2 right-2">
                                            <span className="flex items-center gap-1 bg-success/90 text-white text-[9px] font-bold px-2 py-1 rounded-full backdrop-blur-sm">
                                                <CheckCircle2 size={10} /> generada
                                            </span>
                                        </div>
                                    </>
                                )}

                                {/* Error state */}
                                {imgGenStatus === "error" && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-1 p-4">
                                        <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center">
                                            <AlertCircle size={20} className="text-error" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[13px] font-medium text-fg">Error al generar</p>
                                            <p className="text-[11px] text-fg-faint mt-1 max-w-[200px]">{imgGenError}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Actions row */}
                            <div className="flex items-center justify-between">
                                {/* Reference chip */}
                                <div className="flex items-center gap-2">
                                    {avatarFullUrl && (
                                        <img src={avatarFullUrl} alt="Avatar" className="w-7 h-7 rounded-full object-cover border border-edge" />
                                    )}
                                    {productFullUrl && (
                                        <img src={productFullUrl} alt="Product" className="w-7 h-7 rounded object-cover border border-edge" />
                                    )}
                                    <span className="text-[11px] text-fg-faint">
                                        {selectedAvatar?.name} + {selectedProduct?.name}
                                    </span>
                                </div>

                                {/* Regenerate button */}
                                {(imgGenStatus === "done" || imgGenStatus === "error") && (
                                    <button
                                        onClick={handleRegenerateImage}
                                        className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded border border-edge bg-surface-1 text-[12px] font-medium text-fg-muted hover:text-fg hover:border-edge-strong transition-all"
                                    >
                                        <RotateCcw size={12} /> Regenerar
                                    </button>
                                )}
                            </div>

                            {/* Next step hint */}
                            {imgGenStatus === "done" && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-warm)]/5 border border-[var(--color-warm)]/20 rounded-[var(--radius-sm)]">
                                    <Film size={13} className="text-[var(--color-warm)] shrink-0" />
                                    <p className="text-[12px] text-fg-muted">
                                        Esta imagen se usará como <span className="text-fg font-medium">escena base</span> para las otras escenas del video.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Step 4: Video Objective ── */}
                    {step === 4 && (
                        <div className="space-y-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-[14px] font-medium text-fg mb-1">Objetivo del Guión</h3>
                                    <p className="text-[12px] text-fg-faint">Describí el propósito narrativo del video o dejá que Gemini lo sugiera.</p>
                                </div>
                                <button
                                    onClick={handleSuggestObjective}
                                    disabled={suggestingObjective}
                                    className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded border border-edge bg-surface-1 text-[12px] font-medium text-fg-muted hover:text-fg hover:border-edge-strong transition-all disabled:opacity-50 shrink-0"
                                >
                                    {suggestingObjective ? (
                                        <><Loader2 size={12} className="animate-spin" /> Generando...</>
                                    ) : (
                                        <><Sparkles size={12} /> Sugerir</>
                                    )}
                                </button>
                            </div>
                            <Textarea
                                placeholder="Ej: Crear un video de TikTok donde el personaje muestra la remera de forma cotidiana. El CTA invita a visitar la web."
                                value={videoObjective}
                                onChange={(e) => setVideoObjective(e.target.value)}
                                className="min-h-[120px] text-[13px] leading-relaxed"
                                autoFocus
                            />

                            {/* Summary card */}
                            <div className="rounded-[var(--radius-md)] border border-edge-subtle overflow-hidden">
                                <div className="flex gap-0">
                                    {/* Generated scene thumb */}
                                    {imgGenUrl && (
                                        <div className="w-20 shrink-0">
                                            <img src={imgGenUrl} alt="Escena" className="w-full h-full object-cover" style={{ minHeight: "80px" }} />
                                        </div>
                                    )}
                                    <div className="flex-1 p-3 bg-surface-1/50 space-y-2">
                                        <div className="flex items-center gap-2">
                                            {avatarFullUrl ? (
                                                <img src={avatarFullUrl} alt="" className="w-7 h-7 rounded-full object-cover border border-edge shrink-0" />
                                            ) : (
                                                <div className="w-7 h-7 rounded-full bg-surface-2 border border-edge flex items-center justify-center shrink-0">
                                                    <User size={12} className="text-fg-faint" />
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="text-[10px] text-fg-faint uppercase tracking-wider">Personaje</p>
                                                <p className="text-[12px] font-medium text-fg truncate">{selectedAvatar?.name}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {productFullUrl ? (
                                                <img src={productFullUrl} alt="" className="w-7 h-7 rounded object-cover border border-edge shrink-0" />
                                            ) : (
                                                <div className="w-7 h-7 rounded bg-surface-2 border border-edge flex items-center justify-center shrink-0">
                                                    <Package size={12} className="text-fg-faint" />
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="text-[10px] text-fg-faint uppercase tracking-wider">Producto</p>
                                                <p className="text-[12px] font-medium text-fg truncate">{selectedProduct?.name}</p>
                                            </div>
                                        </div>
                                        {imgGenUrl && (
                                            <div className="flex items-center gap-1.5">
                                                <CheckCircle2 size={11} className="text-success shrink-0" />
                                                <p className="text-[11px] text-fg-muted">Escena base generada</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-edge bg-surface-0 shrink-0">
                    <div>
                        {step > 1 ? (
                            <button
                                onClick={handleBack}
                                disabled={imgGenStatus === "generating"}
                                className="cursor-pointer flex items-center gap-1.5 text-[13px] text-fg-muted hover:text-fg transition-colors disabled:opacity-40"
                            >
                                <ChevronLeft size={14} /> Atrás
                            </button>
                        ) : (
                            <div />
                        )}
                    </div>
                    <Button
                        onClick={handleNext}
                        disabled={!canProceed() || imgGenStatus === "generating"}
                        className="gap-2 h-9 px-5"
                    >
                        {imgGenStatus === "generating" ? (
                            <><Loader2 size={14} className="animate-spin" /> Generando...</>
                        ) : (
                            nextLabel()
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
