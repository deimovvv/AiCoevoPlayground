// ── API Client ──────────────────────────────────────────────
// Centralised helpers for backend communication.

const API_BASE = "http://localhost:8000";

// ══════════════════════════════════════════════════════════════
//  Brand Types & API
// ══════════════════════════════════════════════════════════════

export interface Avatar {
    id: string;
    name: string;
    description?: string;
    filename: string;
    imageUrl: string;
    talkingPhotoId: string | null;
    heygenStatus: "pending" | "ready" | "failed" | "skipped";
    heygenError?: string;
}

export interface VoicePreset {
    id: string;
    name: string;
    source?: "designed" | "cloned" | "system";
}

export type ProductType = "physical" | "digital" | "course" | "service" | "subscription" | "";

export interface Product {
    id: string;
    name: string;
    description?: string;
    filename: string;
    imageUrl: string;
    images?: Array<{ filename: string; imageUrl: string; label?: string }>;
    type?: ProductType;
    price?: string;
    url?: string;
    category?: string;
}

export interface ClothingItem {
    id: string;
    name: string;
    description?: string;
    tags?: string[];
    filename: string;
    imageUrl: string;
}

export interface BackgroundItem {
    id: string;
    name: string;
    description?: string;
    tags?: string[];
    filename: string;
    imageUrl: string;
}

export interface MoodboardItem {
    id: string;
    name: string;
    description?: string;
    filename: string;
    imageUrl: string;
}

export interface BrandFonts {
    headline?: string;
    body?: string;
    accent?: string;
}

export interface BrandDNA {
    colors?: Array<{ name: string; hex: string; usage: string }>;
    tone?: string[];
    audience?: string;
    keywords?: string[];
    personality?: string;
    competitors?: string[];
    unique_value?: string;
    forbidden_words?: string[];
}

export interface DesignSystem {
    photoStyle?: string;
    composition?: string;
    colorTreatment?: string;
    lighting?: string;
    visualDos?: string[];
    visualDonts?: string[];
    references?: string;
    casting?: string;
    preferred_locations?: string[];
    product_presentation?: string;
    motion_rules?: string;
}

export type BusinessModel = "ecommerce" | "saas" | "academy" | "service" | "subscription" | "marketplace" | "d2c" | "agency" | "";

export interface BrandBusiness {
    model?: BusinessModel;
    description?: string;
    value_prop?: string;
    target_market?: string;
    revenue_streams?: string[];
}

export type BrandSourceType = "url" | "pdf" | "text" | "instagram" | "tiktok" | "reviews" | "audio_transcript";

export interface BrandSource {
    id: string;
    type: BrandSourceType;
    label?: string;
    url?: string;
    content?: string;
    addedAt?: string;
}

export interface BrandCompetitor {
    name: string;
    url?: string;
    notes?: string;
}

export interface Brand {
    id: string;
    name: string;
    isSandbox?: boolean;
    brandContext: string;
    avatars: Avatar[];
    voicePresets: VoicePreset[];
    products?: Product[];
    clothing?: ClothingItem[];
    backgrounds?: BackgroundItem[];
    moodboards?: MoodboardItem[];
    logo?: { filename: string; imageUrl: string };
    fonts?: BrandFonts;
    dna?: BrandDNA;
    designSystem?: DesignSystem;
    business?: BrandBusiness;
    brandSources?: BrandSource[];
    competitors?: BrandCompetitor[];
    customerReviews?: string[];
}

export interface ChatMessage {
    role: "user" | "assistant";
    content: string;
    /** Optional structured payload — used for special bubbles like IG replication results. */
    meta?: {
        kind: "ig_replicate";
        result: InstagramReplicationResult;
    };
}

// ══════════════════════════════════════════════════════════════
//  Agent — natural language brief → tool + config
// ══════════════════════════════════════════════════════════════

export interface AgentResolveResult {
    tool: string;
    reasoning?: string;
    config: Record<string, unknown>;
    warnings?: string[];
}

export async function resolveAgentBrief(
    brandId: string,
    brief: string,
    /** Optional prior resolved state — when present, the agent treats `brief` as a delta on top. */
    previous?: { tool: string; config: Record<string, unknown> } | null,
): Promise<AgentResolveResult> {
    const res = await fetch(`${API_BASE}/api/agent/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            brandId,
            brief,
            previousConfig: previous?.config,
            previousTool: previous?.tool,
        }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Agent request failed" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || `Agent error (${res.status})`);
    }
    return res.json();
}

export async function sendChatMessage(
    brandId: string,
    messages: ChatMessage[],
): Promise<string> {
    const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, messages }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Chat request failed" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || "Chat request failed");
    }
    const data = await res.json();
    return data.reply;
}

export async function fetchBrands(): Promise<Brand[]> {
    const res = await fetch(`${API_BASE}/api/brands`);
    if (!res.ok) throw new Error("Failed to fetch brands");
    const data = await res.json();
    return data.brands;
}

export async function fetchBrand(brandId: string): Promise<Brand> {
    const res = await fetch(`${API_BASE}/api/brands/${brandId}`);
    if (!res.ok) throw new Error("Failed to fetch brand");
    return res.json();
}

export async function createBrand(name: string): Promise<Brand> {
    const res = await fetch(`${API_BASE}/api/brands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || `Failed to create brand (${res.status})`);
    }
    return res.json();
}

export async function deleteBrand(brandId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/brands/${brandId}`, {
        method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete brand");
}

export interface UpdateBrandPayload {
    name?: string;
    brandContext?: string;
    fonts?: BrandFonts;
    dna?: BrandDNA;
    designSystem?: DesignSystem;
    business?: BrandBusiness;
    brandSources?: BrandSource[];
    competitors?: BrandCompetitor[];
    customerReviews?: string[];
}

export async function updateBrand(brandId: string, updates: UpdateBrandPayload): Promise<Brand> {
    const res = await fetch(`${API_BASE}/api/brands/${brandId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || `Failed to update brand (${res.status})`);
    }
    return res.json();
}

// ══════════════════════════════════════════════════════════════
//  Brand Guidance (URL + PDF)
// ══════════════════════════════════════════════════════════════

export async function addGuidanceFromUrl(brandId: string, url: string): Promise<{ added_chars: number; brand: Brand }> {
    const res = await fetch(`${API_BASE}/api/brands/${brandId}/guidance/url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed to fetch URL" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || "Failed to fetch URL");
    }
    return res.json();
}

export async function addGuidanceFromPdf(brandId: string, file: File): Promise<{ added_chars: number; pages: number; brand: Brand }> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/api/brands/${brandId}/guidance/pdf`, {
        method: "POST",
        body: formData,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed to parse PDF" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || "Failed to parse PDF");
    }
    return res.json();
}

// ══════════════════════════════════════════════════════════════
//  Brand DNA
// ══════════════════════════════════════════════════════════════

export async function generateBrandDNA(brandId: string): Promise<{ dna: BrandDNA; fonts?: BrandFonts; business?: BrandBusiness; brand: Brand }> {
    const res = await fetch(`${API_BASE}/api/brands/${brandId}/generate-dna`, { method: "POST" });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed to generate DNA" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || "Failed to generate Brand DNA");
    }
    return res.json();
}

export async function extractDesignSystem(brandId: string): Promise<{ designSystem: DesignSystem; brand: Brand }> {
    const res = await fetch(`${API_BASE}/api/brands/${brandId}/extract-design-system`, { method: "POST" });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "No se pudo extraer el design system" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || "No se pudo extraer el design system");
    }
    return res.json();
}

export interface ExtractAllResult {
    dna?: BrandDNA;
    designSystem?: DesignSystem;
    business?: BrandBusiness;
    fonts?: BrandFonts;
    errors?: Array<{ step: string; detail: string }>;
    brand?: Brand;
}

export async function extractEverything(brandId: string): Promise<ExtractAllResult> {
    const res = await fetch(`${API_BASE}/api/brands/${brandId}/extract-all`, { method: "POST" });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Extract-all failed" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || "Extract-all failed");
    }
    return res.json();
}

export async function updateDesignSystem(brandId: string, designSystem: DesignSystem): Promise<Brand> {
    const res = await fetch(`${API_BASE}/api/brands/${brandId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designSystem }),
    });
    if (!res.ok) {
        throw new Error("No se pudo guardar el design system");
    }
    return res.json();
}

// ══════════════════════════════════════════════════════════════
//  Copy Generation
// ══════════════════════════════════════════════════════════════

export interface GenerateCopyRequest {
    productName?: string;
    tone?: "engaging" | "professional" | "casual" | "funny";
    platform?: "tiktok" | "instagram" | "youtube";
    language?: "es" | "en";
    additionalNotes?: string;
    count?: number;
    narrativeMode?: boolean;
}

export interface GenerateCopyResult {
    scripts: string[];
    model: string;
    brief?: string;
}

export async function generateCopy(brandId: string, req: GenerateCopyRequest): Promise<GenerateCopyResult> {
    const res = await fetch(`${API_BASE}/api/brands/${brandId}/generate-copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || `Copy generation failed (${res.status})`);
    }
    return res.json();
}

// ══════════════════════════════════════════════════════════════
//  Avatar API
// ══════════════════════════════════════════════════════════════

export async function uploadAvatar(
    brandId: string,
    name: string,
    imageFile: File,
    uploadToHeygen = true,
    description = "",
): Promise<Avatar> {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    formData.append("image", imageFile);
    formData.append("upload_to_heygen", String(uploadToHeygen));

    const res = await fetch(`${API_BASE}/api/brands/${brandId}/avatars`, {
        method: "POST",
        body: formData,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || `Failed to upload avatar (${res.status})`);
    }

    return res.json();
}

export async function deleteAvatar(brandId: string, avatarId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/brands/${brandId}/avatars/${avatarId}`, {
        method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete avatar");
}

export async function replaceAvatarImage(brandId: string, avatarId: string, image: File): Promise<{ id: string; imageUrl: string; filename: string; [k: string]: unknown }> {
    const formData = new FormData();
    formData.append("image", image);
    const res = await fetch(`${API_BASE}/api/brands/${brandId}/avatars/${avatarId}/image`, {
        method: "PATCH",
        body: formData,
    });
    if (!res.ok) throw new Error("Failed to replace avatar image");
    return res.json();
}

export async function addHeygenAvatar(
    brandId: string,
    talkingPhotoId: string,
    name: string,
    previewUrl: string
): Promise<Avatar> {
    const res = await fetch(`${API_BASE}/api/brands/${brandId}/avatars/heygen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ talkingPhotoId, name, previewUrl })
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || `Failed to add HeyGen avatar (${res.status})`);
    }

    return res.json();
}

export async function retryAvatarHeygen(brandId: string, avatarId: string): Promise<Avatar> {
    const res = await fetch(`${API_BASE}/api/brands/${brandId}/avatars/${avatarId}/retry-heygen`, {
        method: "POST",
    });
    if (!res.ok) throw new Error("Failed to retry HeyGen upload");
    return res.json();
}

/**
 * Get the full URL for an avatar image (prepends API_BASE to relative path).
 */
export function avatarImageUrl(relativeUrl: string): string {
    if (relativeUrl.startsWith("http")) return relativeUrl;
    return `${API_BASE}${relativeUrl}`;
}

// ══════════════════════════════════════════════════════════════
//  Product API
// ══════════════════════════════════════════════════════════════

export async function uploadProduct(
    brandId: string,
    name: string,
    imageFile: File,
    description = "",
    extras: { type?: ProductType; price?: string; url?: string; category?: string } = {},
): Promise<Product> {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    formData.append("image", imageFile);
    if (extras.type) formData.append("type", extras.type);
    if (extras.price) formData.append("price", extras.price);
    if (extras.url) formData.append("url", extras.url);
    if (extras.category) formData.append("category", extras.category);

    const res = await fetch(`${API_BASE}/api/brands/${brandId}/products`, {
        method: "POST",
        body: formData,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || `Failed to upload product (${res.status})`);
    }

    return res.json();
}

export async function updateProduct(
    brandId: string,
    productId: string,
    updates: { name?: string; description?: string; type?: ProductType; price?: string; url?: string; category?: string }
): Promise<Product> {
    const res = await fetch(`${API_BASE}/api/brands/${brandId}/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error("Failed to update product");
    return res.json();
}

export async function addProductImage(brandId: string, productId: string, imageFile: File, label = ""): Promise<Product> {
    const formData = new FormData();
    formData.append("image", imageFile);
    formData.append("label", label);
    const res = await fetch(`${API_BASE}/api/brands/${brandId}/products/${productId}/images`, {
        method: "POST",
        body: formData,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || "Failed to add product image");
    }
    return res.json();
}

export async function deleteProduct(brandId: string, productId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/brands/${brandId}/products/${productId}`, {
        method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete product");
}

export function productImageUrl(relativeUrl: string): string {
    if (relativeUrl.startsWith("http")) return relativeUrl;
    return `${API_BASE}${relativeUrl}`;
}

// ══════════════════════════════════════════════════════════════
//  Clothing API
// ══════════════════════════════════════════════════════════════

export async function uploadClothing(
    brandId: string,
    name: string,
    imageFile: File,
    description = "",
    tags = "",
): Promise<ClothingItem> {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    formData.append("tags", tags);
    formData.append("image", imageFile);

    const res = await fetch(`${API_BASE}/api/brands/${brandId}/clothing`, {
        method: "POST",
        body: formData,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || `Failed to upload clothing (${res.status})`);
    }

    return res.json();
}

export async function deleteClothing(brandId: string, itemId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/brands/${brandId}/clothing/${itemId}`, {
        method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete clothing item");
}

export function clothingImageUrl(relativeUrl: string): string {
    if (relativeUrl.startsWith("http")) return relativeUrl;
    return `${API_BASE}${relativeUrl}`;
}

// ══════════════════════════════════════════════════════════════
//  Backgrounds API
// ══════════════════════════════════════════════════════════════

export async function uploadBackground(
    brandId: string,
    name: string,
    imageFile: File,
    description = "",
    tags = "",
): Promise<BackgroundItem> {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    formData.append("tags", tags);
    formData.append("image", imageFile);

    const res = await fetch(`${API_BASE}/api/brands/${brandId}/backgrounds`, {
        method: "POST",
        body: formData,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || `Failed to upload background (${res.status})`);
    }

    return res.json();
}

export async function deleteBackground(brandId: string, itemId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/brands/${brandId}/backgrounds/${itemId}`, {
        method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete background");
}

export function backgroundImageUrl(relativeUrl: string): string {
    if (relativeUrl.startsWith("http")) return relativeUrl;
    return `${API_BASE}${relativeUrl}`;
}

// ══════════════════════════════════════════════════════════════
//  Moodboards API
// ══════════════════════════════════════════════════════════════

export async function uploadMoodboard(
    brandId: string,
    name: string,
    imageFile: File,
    description = "",
): Promise<MoodboardItem> {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    formData.append("image", imageFile);
    const res = await fetch(`${API_BASE}/api/brands/${brandId}/moodboards`, {
        method: "POST",
        body: formData,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Upload failed" }));
        throw new Error(err.detail || "Upload failed");
    }
    return res.json();
}

export async function deleteMoodboard(brandId: string, itemId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/brands/${brandId}/moodboards/${itemId}`, {
        method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete moodboard");
}

export function moodboardImageUrl(relativeUrl: string): string {
    if (relativeUrl.startsWith("http")) return relativeUrl;
    return `${API_BASE}${relativeUrl}`;
}

// ══════════════════════════════════════════════════════════════
//  Voice Presets API
// ══════════════════════════════════════════════════════════════

export async function addVoicePreset(
    brandId: string,
    name: string,
    voiceId: string,
): Promise<VoicePreset> {
    const res = await fetch(`${API_BASE}/api/brands/${brandId}/voices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, voice_id: voiceId }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || `Failed to add voice (${res.status})`);
    }
    return res.json();
}

export async function deleteVoicePreset(brandId: string, voiceId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/brands/${brandId}/voices/${voiceId}`, {
        method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete voice");
}

// ── Voice Design (text-to-voice) + Cloning ─────────────────

export interface VoiceDesignPreview {
    generated_voice_id: string;
    audio_base_64: string;     // raw MP3 base64 (no data: prefix)
    media_type: string;        // e.g. "audio/mpeg"
    duration_secs?: number;
}

export async function createVoiceDesignPreviews(opts: {
    voiceDescription: string;
    text: string;
    loudness?: number;
    guidanceScale?: number;
    seed?: number;
}): Promise<VoiceDesignPreview[]> {
    const res = await fetch(`${API_BASE}/api/voices/design/previews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            voice_description: opts.voiceDescription,
            text: opts.text,
            loudness: opts.loudness,
            guidance_scale: opts.guidanceScale,
            seed: opts.seed,
        }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || `Failed to design voice (${res.status})`);
    }
    const data = await res.json();
    return data.previews || [];
}

export async function saveDesignedVoice(opts: {
    brandId: string;
    generatedVoiceId: string;
    name: string;
    voiceDescription: string;
}): Promise<VoicePreset> {
    const res = await fetch(`${API_BASE}/api/voices/design/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            brand_id: opts.brandId,
            generated_voice_id: opts.generatedVoiceId,
            name: opts.name,
            voice_description: opts.voiceDescription,
        }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || `Failed to save voice (${res.status})`);
    }
    return res.json();
}

export async function cloneVoice(opts: {
    brandId: string;
    name: string;
    description?: string;
    files: File[];
}): Promise<VoicePreset> {
    const formData = new FormData();
    formData.append("brand_id", opts.brandId);
    formData.append("name", opts.name);
    if (opts.description) formData.append("description", opts.description);
    opts.files.forEach((f) => formData.append("files", f));
    const res = await fetch(`${API_BASE}/api/voices/clone`, {
        method: "POST",
        body: formData,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || `Failed to clone voice (${res.status})`);
    }
    return res.json();
}

// ══════════════════════════════════════════════════════════════
//  Generations API
// ══════════════════════════════════════════════════════════════

export interface Generation {
    id: string;
    brandId: string | null;  // null for brand-agnostic Manual Lab runs
    toolId: string;
    title: string;
    type: "video" | "image" | "copy";
    status: string;
    thumbnailUrl?: string;
    outputUrl?: string;
    scenes?: Array<{ id: string; title: string; script?: string; imageUrl?: string; videoUrl?: string }>;
    metadata?: Record<string, unknown>;
    pipelineState?: {
        steps: Array<{ id: string; status: string; result?: unknown }>;
        config: Record<string, unknown>;
        curationSelections?: Record<string, string>;
    };
    createdAt: string;
}

export async function fetchGenerations(brandId?: string): Promise<Generation[]> {
    const url = brandId
        ? `${API_BASE}/api/generations?brandId=${brandId}`
        : `${API_BASE}/api/generations`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch generations");
    const data = await res.json();
    return data.generations;
}

export async function saveGeneration(gen: {
    brandId: string | null;  // null for brand-agnostic Manual Lab runs
    toolId: string;
    title: string;
    type: "video" | "image" | "copy";
    status?: string;
    thumbnailUrl?: string;
    outputUrl?: string;
    scenes?: Array<Record<string, unknown>>;
    metadata?: Record<string, unknown>;
    pipelineState?: Record<string, unknown>;
}): Promise<Generation> {
    const res = await fetch(`${API_BASE}/api/generations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gen),
    });
    if (!res.ok) throw new Error("Failed to save generation");
    return res.json();
}

export async function updateGeneration(genId: string, gen: {
    brandId: string | null;
    toolId: string;
    title: string;
    type: "video" | "image" | "copy";
    status?: string;
    thumbnailUrl?: string;
    outputUrl?: string;
    scenes?: Array<Record<string, unknown>>;
    metadata?: Record<string, unknown>;
    pipelineState?: Record<string, unknown>;
}): Promise<Generation> {
    const res = await fetch(`${API_BASE}/api/generations/${genId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gen),
    });
    if (!res.ok) throw new Error("Failed to update generation");
    return res.json();
}

export async function fetchGeneration(genId: string): Promise<Generation> {
    const res = await fetch(`${API_BASE}/api/generations/${genId}`);
    if (!res.ok) throw new Error("Failed to fetch generation");
    return res.json();
}

export async function deleteGeneration(genId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/generations/${genId}`, {
        method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete generation");
}

/** Fetch only Manual Lab (brand-agnostic) generations. */
export async function fetchManualGenerations(): Promise<Generation[]> {
    const res = await fetch(`${API_BASE}/api/generations?brandId=__none__`);
    if (!res.ok) throw new Error("Failed to fetch manual generations");
    const data = await res.json();
    return data.generations;
}

// ══════════════════════════════════════════════════════════════
//  Manual Lab — tool suggestion
// ══════════════════════════════════════════════════════════════

export interface ManualLabSuggestion {
    tool_id: string | null;
    reason: string;
}

export async function suggestManualTool(opts: {
    prompt: string;
    mode: "image" | "video";
    hasRefs: boolean;
}): Promise<ManualLabSuggestion> {
    const res = await fetch(`${API_BASE}/api/manual/suggest-tool`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: opts.prompt, mode: opts.mode, hasRefs: opts.hasRefs }),
    });
    if (!res.ok) return { tool_id: null, reason: "" };
    return res.json();
}

// ══════════════════════════════════════════════════════════════
//  Asset Detection + Matching (Content Analyzer)
// ══════════════════════════════════════════════════════════════

export interface DetectedAsset {
    id: string;
    description: string;
    scenes: number[];
}

export interface DetectedAssets {
    persons?: DetectedAsset[];
    outfits?: DetectedAsset[];
    products?: DetectedAsset[];
    locations?: DetectedAsset[];
}

export interface AssetMatch {
    detected_id: string;
    description: string;
    scenes: number[];
    suggested_brand_id: string | null;
    confidence: number;
    reason: string;
}

export interface AssetMatches {
    persons?: AssetMatch[];
    outfits?: AssetMatch[];
    products?: AssetMatch[];
    locations?: AssetMatch[];
}

/** Given detected_assets from the analyzer + brand id, ask the backend to suggest brand-kit matches. */
export async function matchDetectedAssets(opts: {
    brandId: string;
    detected: DetectedAssets;
}): Promise<{ matches: AssetMatches }> {
    const res = await fetch(`${API_BASE}/api/analyze/match-assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: opts.brandId, detected: opts.detected }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Match failed" }));
        throw new Error(typeof err.detail === "string" ? err.detail : "Match failed");
    }
    return res.json();
}

/**
 * Enhance a casual Manual Lab prompt via Gemini Vision: returns a polished
 * prompt optimized for the target image/video model, with the reference
 * images actually inspected by Vision.
 */
export async function enhanceManualPrompt(opts: {
    prompt: string;
    refs: Array<{ tag: string; label: string; url: string }>;
    mode: "image" | "video";
    targetModel: ImageModel;
}): Promise<{ enhanced: string }> {
    const res = await fetch(`${API_BASE}/api/manual/enhance-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            prompt: opts.prompt,
            refs: opts.refs,
            mode: opts.mode,
            targetModel: opts.targetModel,
        }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Enhance failed" }));
        throw new Error(typeof err.detail === "string" ? err.detail : "Enhance failed");
    }
    return res.json();
}

// ══════════════════════════════════════════════════════════════
//  TTS
// ══════════════════════════════════════════════════════════════

export interface TTSRequest {
    text: string;
    voice_id?: string;
    model_id?: string;
    output_format?: string;
    // Voice settings (ElevenLabs voice_settings)
    stability?: number;           // 0.0–1.0, 0.5 = Natural (default)
    similarity_boost?: number;    // 0.0–1.0, default 0.8
    style?: number;               // 0.0–1.0, 0 = natural (default)
    use_speaker_boost?: boolean;  // default true
    speed?: number;               // 0.7–1.2, default 1.0
}

export interface TTSResult {
    audioUrl: string;   // Object URL for playback
    audioBlob: Blob;    // Raw blob for sending to HeyGen
}

/**
 * Call the backend TTS endpoint and return both an Object URL
 * (for playback) and the raw Blob (for uploading to HeyGen).
 */
export async function generateTTS(req: TTSRequest): Promise<TTSResult> {
    const res = await fetch(`${API_BASE}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || `TTS failed (${res.status})`);
    }

    const blob = await res.blob();
    const audioUrl = URL.createObjectURL(blob);
    return { audioUrl, audioBlob: blob };
}

/**
 * Generate TTS and upload audio to Fal Storage in one step.
 * Returns the Fal URL ready to pass to HeyGen.
 */
export async function generateTTSAndUpload(req: TTSRequest): Promise<{ fal_url: string }> {
    const res = await fetch(`${API_BASE}/api/tts/generate-and-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || `TTS+Upload failed (${res.status})`);
    }
    return res.json();
}

// ══════════════════════════════════════════════════════════════
//  HeyGen: Talking Photos
// ══════════════════════════════════════════════════════════════

export interface TalkingPhoto {
    id: string;
    name: string;
    preview: string;
}

export async function fetchTalkingPhotos(): Promise<TalkingPhoto[]> {
    const res = await fetch(`${API_BASE}/api/heygen/talking-photos`);
    if (!res.ok) throw new Error("Failed to fetch talking photos");
    const data = await res.json();
    return data.talking_photos;
}

// ══════════════════════════════════════════════════════════════
//  HeyGen: Upload Talking Photo (on-the-fly)
// ══════════════════════════════════════════════════════════════

/**
 * Upload an image directly to HeyGen as a talking photo.
 * Returns the talking_photo_id for immediate use in lip sync.
 */
export async function uploadTalkingPhoto(imageFile: File): Promise<{ talking_photo_id: string }> {
    const formData = new FormData();
    formData.append("image", imageFile);

    const res = await fetch(`${API_BASE}/api/heygen/upload-talking-photo`, {
        method: "POST",
        body: formData,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || `Failed to upload talking photo (${res.status})`);
    }

    return res.json();
}

// ══════════════════════════════════════════════════════════════
//  HeyGen: Lip Sync
// ══════════════════════════════════════════════════════════════

export interface LipSyncResult {
    video_id: string;
    status: string;
}

/**
 * Create a lip sync video by uploading audio + selecting a talking photo.
 * Returns a video_id for status polling.
 */
export async function createLipSync(
    audioBlob: Blob,
    talkingPhotoId: string,
    title?: string,
): Promise<LipSyncResult> {
    const formData = new FormData();
    formData.append("audio", audioBlob, "audio.mp3");
    formData.append("talking_photo_id", talkingPhotoId);
    if (title) formData.append("title", title);

    const res = await fetch(`${API_BASE}/api/lipsync`, {
        method: "POST",
        body: formData,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || `Lip sync failed (${res.status})`);
    }

    return res.json();
}

// ══════════════════════════════════════════════════════════════
//  HeyGen: Video Status
// ══════════════════════════════════════════════════════════════

export interface VideoStatus {
    video_id: string;
    status: "pending" | "waiting" | "processing" | "completed" | "failed" | "unknown";
    video_url: string | null;
    thumbnail_url: string | null;
    duration: number | null;
    error: string | null;
}

export async function checkVideoStatus(videoId: string): Promise<VideoStatus> {
    const res = await fetch(`${API_BASE}/api/heygen/video-status/${videoId}`);
    if (!res.ok) throw new Error("Failed to check video status");
    return res.json();
}

/**
 * Poll video status until completed or failed.
 * Calls onProgress with each status update.
 * Returns the final status.
 */
export async function pollVideoStatus(
    videoId: string,
    onProgress?: (status: VideoStatus) => void,
    intervalMs = 5000,
    maxAttempts = 120, // 10 min max
): Promise<VideoStatus> {
    for (let i = 0; i < maxAttempts; i++) {
        const status = await checkVideoStatus(videoId);
        onProgress?.(status);

        if (status.status === "completed" || status.status === "failed") {
            return status;
        }

        await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error("Video generation timed out");
}

// ══════════════════════════════════════════════════════════════
//  Kling V2.6: Image-to-Video (via Fal)
// ══════════════════════════════════════════════════════════════

export interface KlingVideoResult {
    request_id: string;
    status: string;
    video_url?: string;
}

/** Frontend-friendly Kling model ids (must match KLING_MODELS in backend). */
export type KlingModel = "v3-pro" | "v2-6-pro" | "v2-6-std" | "v2-5-turbo";

/**
 * Seedance 2.0 reference-to-video: takes N reference images + prompt, returns
 * a video that integrates elements from all of them. Polled via the same
 * `pollKlingVideo` helper since Fal's queue API is uniform across providers
 * — but the status/result URLs differ, so we provide dedicated pollers.
 */
export async function createSeedanceReferenceToVideo(opts: {
    prompt: string;
    referenceImageUrls: string[];
    duration?: string;
    aspectRatio?: string;
    resolution?: string;
    /** Optional audio URLs — when provided, Seedance lip-syncs the avatar to the audio. */
    audioUrls?: string[];
    /** Optional reference videos (motion/style refs). */
    referenceVideoUrls?: string[];
}): Promise<{ request_id: string; status: string; video_url?: string }> {
    const res = await fetch(`${API_BASE}/api/seedance/reference-to-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            prompt: opts.prompt,
            reference_image_urls: opts.referenceImageUrls,
            duration: opts.duration || "5",
            aspect_ratio: opts.aspectRatio || "9:16",
            resolution: opts.resolution,
            audio_urls: opts.audioUrls,
            reference_video_urls: opts.referenceVideoUrls,
        }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Seedance failed" }));
        throw new Error(typeof err.detail === "string" ? err.detail : "Seedance failed");
    }
    return res.json();
}

export async function checkSeedanceStatus(requestId: string): Promise<KlingStatus> {
    const res = await fetch(`${API_BASE}/api/seedance/status/${encodeURIComponent(requestId)}`);
    if (!res.ok) throw new Error(`Seedance status failed (${res.status})`);
    return res.json();
}

export async function getSeedanceResult(requestId: string): Promise<KlingStatus> {
    const res = await fetch(`${API_BASE}/api/seedance/result/${encodeURIComponent(requestId)}`);
    if (!res.ok) throw new Error(`Seedance result failed (${res.status})`);
    return res.json();
}

/** Poll Seedance until done. Mirrors `pollKlingVideo`. */
export async function pollSeedanceVideo(
    requestId: string,
    intervalMs = 5000,
    maxAttempts = 120,
): Promise<KlingStatus> {
    if (requestId.startsWith("SYNC:")) {
        return { request_id: requestId, status: "completed", video_url: requestId.slice(5), error: null };
    }
    for (let i = 0; i < maxAttempts; i++) {
        const status = await checkSeedanceStatus(requestId);
        if (status.status === "completed") {
            return await getSeedanceResult(requestId);
        }
        if (status.status === "failed") return status;
        await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error("Seedance video generation timed out");
}

/**
 * Generate a short video from a static image using Kling.
 * Accepts image URL or can upload an image file.
 */
export async function createKlingVideo(
    imageUrl: string,
    prompt?: string,
    duration: string = "10",
    model?: KlingModel,
): Promise<KlingVideoResult> {
    const formData = new FormData();
    formData.append("image_url", imageUrl);
    if (prompt) formData.append("prompt", prompt);
    formData.append("duration", duration);
    if (model) formData.append("model", model);

    const res = await fetch(`${API_BASE}/api/kling/image-to-video`, {
        method: "POST",
        body: formData,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || `Kling video failed (${res.status})`);
    }

    return res.json();
}

/**
 * Kling frame-to-frame: animate from a start image to an end image.
 */
export async function createKlingFrameToFrame(opts: {
    start_image_url: string;
    end_image_url: string;
    prompt?: string;
    duration?: string;
    model?: KlingModel;
}): Promise<KlingVideoResult> {
    const res = await fetch(`${API_BASE}/api/kling/frame-to-frame`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || `Kling frame-to-frame failed (${res.status})`);
    }
    return res.json();
}

/**
 * Upload an image file and generate a Kling video from it.
 */
export async function createKlingVideoFromFile(
    imageFile: File,
    prompt?: string,
    duration: string = "10",
): Promise<KlingVideoResult> {
    const formData = new FormData();
    formData.append("image", imageFile);
    if (prompt) formData.append("prompt", prompt);
    formData.append("duration", duration);

    const res = await fetch(`${API_BASE}/api/kling/image-to-video`, {
        method: "POST",
        body: formData,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || `Kling video failed (${res.status})`);
    }

    return res.json();
}

export interface KlingStatus {
    request_id: string;
    status: "pending" | "processing" | "completed" | "failed" | "unknown";
    video_url: string | null;
    error: string | null;
}

export async function checkKlingStatus(requestId: string): Promise<KlingStatus> {
    const res = await fetch(`${API_BASE}/api/kling/status/${encodeURIComponent(requestId)}`);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || `Kling status check failed (${res.status})`);
    }
    return res.json();
}

export async function getKlingResult(requestId: string): Promise<KlingStatus> {
    const res = await fetch(`${API_BASE}/api/kling/result/${encodeURIComponent(requestId)}`);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || `Kling result failed (${res.status})`);
    }
    return res.json();
}

/**
 * Poll Kling video status until completed or failed.
 */
export async function pollKlingVideo(
    requestId: string,
    onProgress?: (status: KlingStatus) => void,
    intervalMs = 5000,
    maxAttempts = 120,
): Promise<KlingStatus> {
    if (requestId.startsWith("SYNC:")) {
        const result: KlingStatus = {
            request_id: requestId,
            status: "completed",
            video_url: requestId.slice(5),
            error: null,
        };
        onProgress?.(result);
        return result;
    }

    for (let i = 0; i < maxAttempts; i++) {
        const status = await checkKlingStatus(requestId);
        onProgress?.(status);

        if (status.status === "completed") {
            const result = await getKlingResult(requestId);
            onProgress?.(result);
            return result;
        }

        if (status.status === "failed") {
            return status;
        }

        await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error("Kling video generation timed out");
}

// ══════════════════════════════════════════════════════════════
//  Image Generation / Edit (nano-banana-2/edit via Fal)
// ══════════════════════════════════════════════════════════════

export interface ImageGenResult {
    request_id: string;
    status: string;
    image_url?: string;
}

export interface ImageGenStatus {
    request_id: string;
    status: "pending" | "processing" | "completed" | "failed" | "unknown";
    image_url: string | null;
    error: string | null;
}

/**
 * Submit an image edit/generation job.
 * imageUrls: array of image URLs (avatar, product, background)
 * prompt: what to generate
 */
export type ImageModel = "nano-banana-2" | "gpt-image-2";

export async function createImageEdit(
    imageUrls: string[],
    prompt: string,
    aspectRatio: string = "9:16",
    resolution: string = "1K",
    model: ImageModel = "nano-banana-2",
): Promise<ImageGenResult> {
    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("image_urls", JSON.stringify(imageUrls));
    formData.append("aspect_ratio", aspectRatio);
    formData.append("resolution", resolution);
    formData.append("model", model);

    const res = await fetch(`${API_BASE}/api/image-gen/edit`, {
        method: "POST",
        body: formData,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        const detail = typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail);
        throw new Error(detail || `Image gen failed (${res.status})`);
    }

    return res.json();
}

export async function analyzePoseReference(imageFile: File): Promise<{ pose_description: string }> {
    const formData = new FormData();
    formData.append("image", imageFile);
    const res = await fetch(`${API_BASE}/api/analyze/pose`, { method: "POST", body: formData });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error((typeof err.detail === "string" ? err.detail : "Pose analysis failed"));
    }
    return res.json();
}

export type ReferenceType = "product" | "person" | "scene" | "abstract" | "mixed";
export type SuggestedSlot = "product" | "avatar" | "background" | "moodboard" | "reference";

export async function classifyReferenceImage(imageFile: File): Promise<{
    type: ReferenceType;
    confidence: number;
    description: string;
    suggested_slot: SuggestedSlot;
}> {
    const formData = new FormData();
    formData.append("image", imageFile);
    const res = await fetch(`${API_BASE}/api/analyze/reference`, { method: "POST", body: formData });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error((typeof err.detail === "string" ? err.detail : "Classification failed"));
    }
    return res.json();
}

export async function createTextToImage(
    prompt: string,
    aspectRatio: string = "1:1",
    resolution: string = "2K",
    model: ImageModel = "nano-banana-2",
): Promise<ImageGenResult> {
    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("aspect_ratio", aspectRatio);
    formData.append("resolution", resolution);
    formData.append("model", model);

    const res = await fetch(`${API_BASE}/api/image-gen/text-to-image`, {
        method: "POST",
        body: formData,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        const detail = typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail);
        throw new Error(detail || `Text-to-image failed (${res.status})`);
    }

    return res.json();
}

export async function checkImageGenStatus(requestId: string): Promise<ImageGenStatus> {
    const res = await fetch(`${API_BASE}/api/image-gen/status/${encodeURIComponent(requestId)}`);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || `Image gen status check failed (${res.status})`);
    }
    return res.json();
}

export async function getImageGenResult(requestId: string): Promise<ImageGenStatus> {
    const res = await fetch(`${API_BASE}/api/image-gen/result/${encodeURIComponent(requestId)}`);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || `Image gen result failed (${res.status})`);
    }
    return res.json();
}

/**
 * Poll image gen status until completed or failed.
 */
export async function pollImageGen(
    requestId: string,
    onProgress?: (status: ImageGenStatus) => void,
    intervalMs = 4000,
    maxAttempts = 90,
): Promise<ImageGenStatus> {
    if (requestId.startsWith("SYNC:")) {
        const result: ImageGenStatus = {
            request_id: requestId,
            status: "completed",
            image_url: requestId.slice(5),
            error: null,
        };
        onProgress?.(result);
        return result;
    }

    for (let i = 0; i < maxAttempts; i++) {
        const status = await checkImageGenStatus(requestId);
        onProgress?.(status);

        if (status.status === "completed") {
            const result = await getImageGenResult(requestId);
            onProgress?.(result);
            return result;
        }

        if (status.status === "failed") {
            return status;
        }

        await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error("Image generation timed out");
}

// ══════════════════════════════════════════════════════════════
//  Fal AI: Lip Sync (v2 Pro)
// ══════════════════════════════════════════════════════════════


export interface FalLipSyncResult {
    request_id: string;
    status: string;
    video_url?: string;
}

/**
 * Create a Fal lip sync job by uploading audio + providing a video URL.
 * Returns a request_id for status polling (or immediate result if sync).
 */
export async function createFalLipSync(
    audioBlob: Blob,
    videoUrl: string,
    syncMode: string = "cut_off",
    title?: string,
): Promise<FalLipSyncResult> {
    const formData = new FormData();
    formData.append("audio", audioBlob, "audio.mp3");
    formData.append("video_url", videoUrl);
    formData.append("sync_mode", syncMode);
    if (title) formData.append("title", title);

    const res = await fetch(`${API_BASE}/api/fal/lipsync`, {
        method: "POST",
        body: formData,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || `Fal lip sync failed (${res.status})`);
    }

    return res.json();
}

export interface FalStatus {
    request_id: string;
    status: "pending" | "processing" | "completed" | "failed" | "unknown";
    video_url: string | null;
    logs?: string[];
    error: string | null;
}

export async function checkFalStatus(requestId: string): Promise<FalStatus> {
    const res = await fetch(`${API_BASE}/api/fal/lipsync/${encodeURIComponent(requestId)}/status`);
    if (!res.ok) throw new Error("Failed to check Fal status");
    return res.json();
}

export async function getFalResult(requestId: string): Promise<FalStatus> {
    const res = await fetch(`${API_BASE}/api/fal/lipsync/${encodeURIComponent(requestId)}/result`);
    if (!res.ok) throw new Error("Failed to get Fal result");
    return res.json();
}

/**
 * Poll Fal lip sync status until completed or failed.
 * Calls onProgress with each status update.
 * Returns the final result with video_url.
 */
export async function pollFalLipSync(
    requestId: string,
    onProgress?: (status: FalStatus) => void,
    intervalMs = 5000,
    maxAttempts = 120,
): Promise<FalStatus> {
    // Handle sync results
    if (requestId.startsWith("SYNC:")) {
        const result: FalStatus = {
            request_id: requestId,
            status: "completed",
            video_url: requestId.slice(5),
            error: null,
        };
        onProgress?.(result);
        return result;
    }

    for (let i = 0; i < maxAttempts; i++) {
        const status = await checkFalStatus(requestId);
        onProgress?.(status);

        if (status.status === "completed") {
            // Fetch the actual result with video URL
            const result = await getFalResult(requestId);
            onProgress?.(result);
            return result;
        }

        if (status.status === "failed") {
            return status;
        }

        await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error("Fal lip sync timed out");
}

// ══════════════════════════════════════════════════════════════
//  Prompt Templates & Overrides
// ══════════════════════════════════════════════════════════════

export interface PromptTemplate {
    tool_id: string;
    path: string;
    preview: string;
}

export async function fetchPromptTemplates(): Promise<PromptTemplate[]> {
    const res = await fetch(`${API_BASE}/api/prompts/templates`);
    if (!res.ok) throw new Error("Failed to fetch prompt templates");
    const data = await res.json();
    return data.templates;
}

export async function fetchPromptTemplate(toolId: string): Promise<string> {
    const res = await fetch(`${API_BASE}/api/prompts/templates/${toolId}`);
    if (!res.ok) throw new Error("Failed to fetch template");
    const data = await res.json();
    return data.template;
}

export async function fetchBrandPromptOverrides(brandId: string): Promise<Record<string, string>> {
    const res = await fetch(`${API_BASE}/api/brands/${brandId}/prompts`);
    if (!res.ok) throw new Error("Failed to fetch overrides");
    const data = await res.json();
    return data.overrides;
}

export async function setBrandPromptOverride(brandId: string, toolId: string, template: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/brands/${brandId}/prompts/${toolId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template }),
    });
    if (!res.ok) throw new Error("Failed to save prompt override");
}

export async function deleteBrandPromptOverride(brandId: string, toolId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/brands/${brandId}/prompts/${toolId}`, {
        method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete prompt override");
}

export async function previewPrompt(brandId: string, toolId: string, extraVariables?: Record<string, string>): Promise<string> {
    const res = await fetch(`${API_BASE}/api/brands/${brandId}/prompts/${toolId}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extra_variables: extraVariables || {} }),
    });
    if (!res.ok) throw new Error("Failed to preview prompt");
    const data = await res.json();
    return data.prompt;
}

// ══════════════════════════════════════════════════════════════
//  Action Library
// ══════════════════════════════════════════════════════════════

export interface ActionPreset {
    name: string;
    prompt: string;
}

export interface ActionCategory {
    id: string;
    label: string;
    actions: ActionPreset[];
}

export async function fetchActionPresets(): Promise<{ categories: ActionCategory[] }> {
    const res = await fetch(`${API_BASE}/api/action-presets`);
    if (!res.ok) throw new Error("Failed to fetch action presets");
    return res.json();
}

export async function fetchBrandActions(brandId: string): Promise<{ categories: ActionCategory[] }> {
    const res = await fetch(`${API_BASE}/api/brands/${brandId}/actions`);
    if (!res.ok) throw new Error("Failed to fetch brand actions");
    return res.json();
}

export async function saveBrandActions(brandId: string, actions: ActionPreset[]): Promise<void> {
    const res = await fetch(`${API_BASE}/api/brands/${brandId}/actions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actions }),
    });
    if (!res.ok) throw new Error("Failed to save brand actions");
}

// ══════════════════════════════════════════════════════════════
//  Generic Tool Prompt Execution
// ══════════════════════════════════════════════════════════════

export async function generateToolPrompt(
    brandId: string,
    toolId: string,
    userMessage?: string,
    extraVariables?: Record<string, string>,
): Promise<{ result: unknown; raw?: boolean }> {
    const res = await fetch(`${API_BASE}/api/tools/generate-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            brandId,
            toolId,
            userMessage: userMessage || "",
            extraVariables: extraVariables || {},
        }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || `Prompt generation failed (${res.status})`);
    }
    return res.json();
}

// ══════════════════════════════════════════════════════════════
//  Video Concat (FFmpeg)
// ══════════════════════════════════════════════════════════════

export interface ConcatResult {
    video_url: string;
    duration: number;
    size_bytes: number;
    num_segments: number;
}

export async function overlayAudio(videoUrl: string, audioUrl: string): Promise<{ video_url: string; duration: number }> {
    const res = await fetch(`${API_BASE}/api/video/overlay-audio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_url: videoUrl, audio_url: audioUrl }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error(typeof err.detail === "string" ? err.detail : "Audio overlay failed");
    }
    return res.json();
}

export async function concatVideos(
    videoUrls: string[],
    scripts?: Array<{ text: string }>,
    addSubtitles: boolean = true,
    subtitleEngine: "auto" | "remotion" | "ffmpeg" | "none" = "auto",
): Promise<ConcatResult> {
    const res = await fetch(`${API_BASE}/api/video/concat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            video_urls: videoUrls,
            scripts: scripts || null,
            add_subtitles: addSubtitles,
            subtitle_engine: subtitleEngine,
        }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || `Video concat failed (${res.status})`);
    }
    return res.json();
}

// ══════════════════════════════════════════════════════════════
//  HeyGen Avatar 4 (via Fal) — Talking Head Video
// ══════════════════════════════════════════════════════════════

export async function createHeyGenAvatar4(opts: {
    image_url: string;
    prompt?: string;
    voice?: string;
    audio_url?: string;
    expression?: string;
    talking_style?: string;
    aspect_ratio?: string;
    resolution?: string;
}): Promise<{ request_id: string }> {
    const res = await fetch(`${API_BASE}/api/heygen-avatar4/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || `HeyGen Avatar4 failed (${res.status})`);
    }
    return res.json();
}

export async function pollHeyGenAvatar4(requestId: string): Promise<{
    status: string;
    video_url?: string;
    error?: string;
}> {
    const POLL_INTERVAL = 5000;
    const MAX_POLLS = 300; // 25 minutes max — HeyGen can be slow in queue

    for (let i = 0; i < MAX_POLLS; i++) {
        const statusRes = await fetch(`${API_BASE}/api/heygen-avatar4/status/${requestId}`);
        if (!statusRes.ok) throw new Error("Failed to check HeyGen Avatar4 status");
        const statusData = await statusRes.json();

        if (statusData.status === "completed") {
            const resultRes = await fetch(`${API_BASE}/api/heygen-avatar4/result/${requestId}`);
            if (!resultRes.ok) throw new Error("Failed to fetch HeyGen Avatar4 result");
            const resultData = await resultRes.json();
            return { status: "completed", video_url: resultData.video_url };
        }

        if (statusData.status === "failed") {
            return { status: "failed", error: statusData.error || "HeyGen Avatar4 failed" };
        }

        // Log progress every 10 polls (~50s)
        if (i % 10 === 0 && i > 0) {
            console.log(`[heygen-avatar4] Still waiting... poll ${i}/${MAX_POLLS}, status: ${statusData.status}`);
        }

        await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    }

    throw new Error("HeyGen Avatar4 timed out after 25 minutes");
}

// ══════════════════════════════════════════════════════════════
//  Sync Lipsync V3 (video + audio → lipsync video, via Fal)
// ══════════════════════════════════════════════════════════════

export async function createSyncLipsync(opts: {
    video_url: string;
    audio_url: string;
    sync_mode?: string;
}): Promise<{ request_id: string }> {
    const res = await fetch(`${API_BASE}/api/synclipsync/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error((typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)) || `SyncLipsync failed (${res.status})`);
    }
    return res.json();
}

export async function pollSyncLipsync(requestId: string): Promise<{
    status: string;
    video_url?: string;
    error?: string;
}> {
    const POLL_INTERVAL = 4000;
    const MAX_POLLS = 150; // 10 minutes max

    for (let i = 0; i < MAX_POLLS; i++) {
        const statusRes = await fetch(`${API_BASE}/api/synclipsync/status/${requestId}`);
        if (!statusRes.ok) throw new Error("Failed to check SyncLipsync status");
        const statusData = await statusRes.json();

        if (statusData.status === "completed") {
            const resultRes = await fetch(`${API_BASE}/api/synclipsync/result/${requestId}`);
            if (!resultRes.ok) throw new Error("Failed to fetch SyncLipsync result");
            const resultData = await resultRes.json();
            return { status: "completed", video_url: resultData.video_url };
        }

        if (statusData.status === "failed") {
            return { status: "failed", error: statusData.error || "SyncLipsync failed" };
        }

        await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    }

    throw new Error("SyncLipsync timed out after 10 minutes");
}

// ══════════════════════════════════════════════════════════════
//  System Voices
// ══════════════════════════════════════════════════════════════

export interface SystemVoice {
    id: string;
    name: string;
    language: string;
    gender: string;
}

export async function fetchSystemVoices(): Promise<SystemVoice[]> {
    const res = await fetch(`${API_BASE}/api/voices/system`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.voices || [];
}

// ══════════════════════════════════════════════════════════════
//  Health check
// ══════════════════════════════════════════════════════════════

export async function checkHealth(): Promise<{
    status: string;
    elevenlabs_configured: boolean;
    heygen_configured: boolean;
}> {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error("Backend unreachable");
    return res.json();
}

// ══════════════════════════════════════════════════════════════
//  TikTok / Apify
// ══════════════════════════════════════════════════════════════

export interface TikTokVideo {
    url: string;
    download_url: string;
    thumbnail_url: string;
    author: string;
    description: string;
    likes: number;
    comments: number;
    shares: number;
    plays: number;
    duration: number;
    created_at: string;
}

// ══════════════════════════════════════════════════════════════
//  Instagram Scraper (via Apify)
// ══════════════════════════════════════════════════════════════

export interface InstagramPost {
    url: string;
    type: "carousel" | "image" | "video";
    shortCode: string;
    thumbnail: string;
    slides: Array<{ url: string; originalUrl?: string; local?: boolean; alt?: string }>;
    videoUrl?: string;
    caption: string;
    username: string;
    likesCount: number;
    commentsCount: number;
    timestamp?: string;
    alt?: string;
}

export async function scrapeInstagramPost(url: string): Promise<InstagramPost> {
    const res = await fetch(`${API_BASE}/api/integrations/instagram/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed to scrape Instagram post" }));
        throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail));
    }
    return res.json();
}

export interface InstagramSlideNarrative {
    slide: number;
    role: string;
    describes: string;
    text_seen: string;
    adapted_for_brand?: {
        visual?: string;
        text?: string;
    };
}

export interface InstagramReplicationResult {
    scraped: InstagramPost;
    narrative: InstagramSlideNarrative[];
    brief: string;
    numSlides: number;
    platform: "instagram";
    sourceUsername: string;
    sourceUrl: string;
}

export async function replicateInstagramCarousel(url: string, brandId: string): Promise<InstagramReplicationResult> {
    const res = await fetch(`${API_BASE}/api/integrations/instagram/replicate-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, brandId }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Replicate analysis failed" }));
        throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail));
    }
    return res.json();
}

export async function scrapeInstagramProfile(usernameOrUrl: string, postsLimit = 12): Promise<{ posts: InstagramPost[]; count: number }> {
    const res = await fetch(`${API_BASE}/api/integrations/instagram/scrape-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username_or_url: usernameOrUrl, posts_limit: postsLimit }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed to scrape profile" }));
        throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail));
    }
    return res.json();
}

export async function getTikTokTopVideos(profileUrl: string, limit = 10): Promise<TikTokVideo[]> {
    const res = await fetch(`${API_BASE}/api/tiktok/top-videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_url: profileUrl, limit }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error(err.detail || "TikTok profile scrape failed");
    }
    const data = await res.json();
    return data.videos as TikTokVideo[];
}
