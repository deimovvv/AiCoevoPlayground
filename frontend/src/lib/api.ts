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
}

export interface Product {
    id: string;
    name: string;
    description?: string;
    filename: string;
    imageUrl: string;
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

export interface Brand {
    id: string;
    name: string;
    brandContext: string;
    avatars: Avatar[];
    voicePresets: VoicePreset[];
    products?: Product[];
    clothing?: ClothingItem[];
    backgrounds?: BackgroundItem[];
    logo?: { filename: string; imageUrl: string };
}

export interface ChatMessage {
    role: "user" | "assistant";
    content: string;
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
        throw new Error(err.detail || "Chat request failed");
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
        throw new Error(err.detail || `Failed to create brand (${res.status})`);
    }
    return res.json();
}

export async function deleteBrand(brandId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/brands/${brandId}`, {
        method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete brand");
}

export async function updateBrand(brandId: string, updates: { name?: string; brandContext?: string }): Promise<Brand> {
    const res = await fetch(`${API_BASE}/api/brands/${brandId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error(err.detail || `Failed to update brand (${res.status})`);
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
        throw new Error(err.detail || "Failed to fetch URL");
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
        throw new Error(err.detail || "Failed to parse PDF");
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
        throw new Error(err.detail || `Copy generation failed (${res.status})`);
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
        throw new Error(err.detail || `Failed to upload avatar (${res.status})`);
    }

    return res.json();
}

export async function deleteAvatar(brandId: string, avatarId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/brands/${brandId}/avatars/${avatarId}`, {
        method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete avatar");
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
        throw new Error(err.detail || `Failed to add HeyGen avatar (${res.status})`);
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
): Promise<Product> {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    formData.append("image", imageFile);

    const res = await fetch(`${API_BASE}/api/brands/${brandId}/products`, {
        method: "POST",
        body: formData,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error(err.detail || `Failed to upload product (${res.status})`);
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
        throw new Error(err.detail || `Failed to upload clothing (${res.status})`);
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
        throw new Error(err.detail || `Failed to upload background (${res.status})`);
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
        throw new Error(err.detail || `Failed to add voice (${res.status})`);
    }
    return res.json();
}

export async function deleteVoicePreset(brandId: string, voiceId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/brands/${brandId}/voices/${voiceId}`, {
        method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete voice");
}

// ══════════════════════════════════════════════════════════════
//  Generations API
// ══════════════════════════════════════════════════════════════

export interface Generation {
    id: string;
    brandId: string;
    toolId: string;
    title: string;
    type: "video" | "image" | "copy";
    status: string;
    thumbnailUrl?: string;
    outputUrl?: string;
    scenes?: Array<{ id: string; title: string; script?: string; imageUrl?: string; videoUrl?: string }>;
    metadata?: Record<string, unknown>;
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
    brandId: string;
    toolId: string;
    title: string;
    type: "video" | "image" | "copy";
    status?: string;
    thumbnailUrl?: string;
    outputUrl?: string;
    scenes?: Array<Record<string, unknown>>;
    metadata?: Record<string, unknown>;
}): Promise<Generation> {
    const res = await fetch(`${API_BASE}/api/generations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gen),
    });
    if (!res.ok) throw new Error("Failed to save generation");
    return res.json();
}

export async function deleteGeneration(genId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/generations/${genId}`, {
        method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete generation");
}

// ══════════════════════════════════════════════════════════════
//  TTS
// ══════════════════════════════════════════════════════════════

export interface TTSRequest {
    text: string;
    voice_id?: string;
    model_id?: string;
    output_format?: string;
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
        throw new Error(err.detail || `TTS failed (${res.status})`);
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
        throw new Error(err.detail || `TTS+Upload failed (${res.status})`);
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
        throw new Error(err.detail || `Failed to upload talking photo (${res.status})`);
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
        throw new Error(err.detail || `Lip sync failed (${res.status})`);
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

/**
 * Generate a short video from a static image using Kling V2.6.
 * Accepts image URL or can upload an image file.
 */
export async function createKlingVideo(
    imageUrl: string,
    prompt?: string,
    duration: string = "10",
): Promise<KlingVideoResult> {
    const formData = new FormData();
    formData.append("image_url", imageUrl);
    if (prompt) formData.append("prompt", prompt);
    formData.append("duration", duration);

    const res = await fetch(`${API_BASE}/api/kling/image-to-video`, {
        method: "POST",
        body: formData,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error(err.detail || `Kling video failed (${res.status})`);
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
        throw new Error(err.detail || `Kling video failed (${res.status})`);
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
        throw new Error(err.detail || `Kling status check failed (${res.status})`);
    }
    return res.json();
}

export async function getKlingResult(requestId: string): Promise<KlingStatus> {
    const res = await fetch(`${API_BASE}/api/kling/result/${encodeURIComponent(requestId)}`);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error(err.detail || `Kling result failed (${res.status})`);
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
export async function createImageEdit(
    imageUrls: string[],
    prompt: string,
    aspectRatio: string = "9:16",
    resolution: string = "1K",
): Promise<ImageGenResult> {
    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("image_urls", JSON.stringify(imageUrls));
    formData.append("aspect_ratio", aspectRatio);
    formData.append("resolution", resolution);

    const res = await fetch(`${API_BASE}/api/image-gen/edit`, {
        method: "POST",
        body: formData,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error(err.detail || `Image gen failed (${res.status})`);
    }

    return res.json();
}

export async function checkImageGenStatus(requestId: string): Promise<ImageGenStatus> {
    const res = await fetch(`${API_BASE}/api/image-gen/status/${encodeURIComponent(requestId)}`);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error(err.detail || `Image gen status check failed (${res.status})`);
    }
    return res.json();
}

export async function getImageGenResult(requestId: string): Promise<ImageGenStatus> {
    const res = await fetch(`${API_BASE}/api/image-gen/result/${encodeURIComponent(requestId)}`);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error(err.detail || `Image gen result failed (${res.status})`);
    }
    return res.json();
}

/**
 * Poll image gen status until completed or failed.
 */
export async function pollImageGen(
    requestId: string,
    onProgress?: (status: ImageGenStatus) => void,
    intervalMs = 3000,
    maxAttempts = 60,
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
        throw new Error(err.detail || `Fal lip sync failed (${res.status})`);
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
        throw new Error(err.detail || `Prompt generation failed (${res.status})`);
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
        throw new Error(err.detail || `Video concat failed (${res.status})`);
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
        throw new Error(err.detail || `HeyGen Avatar4 failed (${res.status})`);
    }
    return res.json();
}

export async function pollHeyGenAvatar4(requestId: string): Promise<{
    status: string;
    video_url?: string;
    error?: string;
}> {
    const POLL_INTERVAL = 3000;
    const MAX_POLLS = 120; // 6 minutes max

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

        await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    }

    throw new Error("HeyGen Avatar4 timed out");
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
