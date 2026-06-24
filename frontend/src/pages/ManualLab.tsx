/**
 * Manual Lab — brand-agnostic sandbox for Nano Banana 2 + Kling V3
 * ─────────────────────────────────────────────────────────────────
 * One-shot generations with chat-style history. References get auto-tagged
 * (img1, img2, ...) and can be inserted as [imgN] in the prompt.
 *
 * No pipeline, no curation, no brand requirement. Optionally pulls assets
 * from the active brand if the user enables the toggle.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { Image as ImageIcon, Video, Plus, X, Send, Sparkles, RefreshCw, Download, AlertCircle, FlaskConical, Wand2, Eye, RotateCcw, ChevronDown, Check, Sun, MessageSquare } from "lucide-react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { ChatPanel } from "../components/ChatPanel";
import { useBrand } from "../lib/BrandContext";
import {
    createImageEdit,
    createTextToImage,
    pollImageGen,
    createKlingVideo,
    createKlingFrameToFrame,
    ensureHostedRefUrl,
    pollKlingVideo,
    createSeedanceReferenceToVideo,
    pollSeedanceVideo,
    suggestManualTool,
    enhanceManualPrompt,
    saveGeneration,
    fetchManualGenerations,
    avatarImageUrl,
    productImageUrl,
    clothingImageUrl,
    backgroundImageUrl,
    lookAndFeelImageUrl,
    moodboardImageUrl,
    brandLogoImageUrl,
    describeLookAndFeel,
    describeLookAndFeelUpload,
    type Generation,
    type ImageModel,
    type KlingModel,
    type LookFeelItem,
} from "../lib/api";
import { cn } from "../lib/utils";
import { downloadFile } from "../lib/download";

type Mode = "image" | "video";

const IMAGE_MODELS: Array<{ id: ImageModel; label: string; resHonored: boolean; note: string }> = [
    { id: "nano-banana-2", label: "Nano Banana 2", resHonored: false, note: "ignora resolution con refs" },
    { id: "gpt-image-2", label: "GPT Image 2", resHonored: true, note: "respeta resolution" },
];

/**
 * Video model picker — unified across providers. Each entry declares which modes
 * it supports so the Mode dropdown can be filtered, and whether it accepts audio
 * for lipsync.
 */
type VideoModelId = KlingModel | "seedance-2";
interface VideoModelDef {
    id: VideoModelId;
    label: string;
    tier: string;
    provider: "kling" | "seedance";
    modes: Array<"i2v" | "f2f" | "rtv">;
    supportsAudio: boolean;
    /** Selectable output resolutions. Omit when the model has a fixed resolution (e.g. Kling on Fal). */
    resolutions?: readonly string[];
    /** Selectable aspect ratios. Omit when ratio is inferred from the input image (Kling i2v/f2f). */
    aspectRatios?: readonly string[];
}
// Curated lineup — each model covers a distinct case (no clutter):
//   V3 Pro  → flagship i2v + frame-to-frame
//   Seedance → multi-reference + audio lipsync
//   V2.5 Turbo → fast/cheap iteration option
// (V2.6 Pro/Std removed — redundant with V3 Pro and the turbo option.)
const VIDEO_MODELS: VideoModelDef[] = [
    { id: "v3-pro",     label: "Kling V3 Pro",       tier: "mejor calidad · i2v + f2f", provider: "kling",    modes: ["i2v", "f2f"], supportsAudio: false },
    { id: "seedance-2", label: "Seedance 2.0",       tier: "multi-ref + audio lipsync", provider: "seedance", modes: ["rtv"], supportsAudio: true, resolutions: ["480p", "720p", "1080p"], aspectRatios: ["9:16", "16:9", "1:1", "4:3", "3:4"] },
    { id: "v2-5-turbo", label: "Kling V2.5 Turbo",   tier: "rápido / barato",           provider: "kling",    modes: ["i2v", "f2f"], supportsAudio: false },
];

type VideoMode = "i2v" | "f2f" | "rtv";  // image-to-video | frame-to-frame | reference-to-video (Seedance)

interface RefImage {
    tag: string;          // image1, image2, ...
    label: string;        // user-provided label (filename, asset name)
    url: string;          // data URL or http URL — what we send to the model
    source: "upload" | "asset" | "result" | "anchor";
    assetType?: "avatar" | "product" | "clothing" | "background";
    file?: File;          // present when source=upload (needed for Kling file path)
    isAnchor?: boolean;   // anchor = "editing this image" mode — always tagged image1
    baseName?: string;    // original source filename (no ext) — inherited by the output on download
}

interface ChatTurn {
    id: string;
    role: "user" | "result";
    mode: Mode;
    prompt?: string;          // what the user typed (always preserved for the bubble)
    sentPrompt?: string;      // what actually went to the model (post-enhance / post-assembly)
    refs?: Array<{ tag: string; label: string; url: string }>;
    params?: Record<string, string>;
    // result-only
    status?: "pending" | "completed" | "failed";
    outputUrl?: string;
    type?: "image" | "video";
    error?: string;
    baseName?: string;        // inherited from the primary input ref — used as the download filename
    variants?: string[];      // batch mode: N output URLs from the same prompt (compare + pick)
}

const IMG_ASPECT_RATIOS = ["9:16", "1:1", "16:9", "4:5", "3:4"] as const;
const IMG_RESOLUTIONS = ["1K", "2K", "4K"] as const;
const VID_DURATIONS = ["5", "10"] as const;
const VARIANT_COUNTS = ["1", "2", "3", "4"] as const;

function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Read failed"));
        reader.readAsDataURL(file);
    });
}

/** Make a filename-safe version of a label while keeping it readable (spaces/accents OK). */
function sanitizeName(s: string): string {
    const reserved = new Set(["/", "\\", "?", "%", "*", ":", "|", '"', "<", ">"]);
    const cleaned = Array.from((s || "").trim())
        .filter((ch) => !reserved.has(ch) && ch.charCodeAt(0) >= 32)  // drop reserved + control chars
        .join("");
    return cleaned.replace(/\s+/g, " ").slice(0, 70).trim();
}

/**
 * The source filename an output should inherit. The edit anchor wins (you're
 * editing that image), otherwise the first ref that carries an original name.
 */
function primaryBaseName(refs: RefImage[]): string | undefined {
    const anchor = refs.find((r) => r.isAnchor);
    if (anchor?.baseName) return anchor.baseName;
    return refs.find((r) => r.baseName)?.baseName;
}

/** Friendly filename for a generation: prefer the propagated baseName (input image's
 *  name), otherwise derive a short slug from the prompt itself. Fallback to the id. */
function downloadBaseName(turn: ChatTurn): string {
    if (turn.baseName) return turn.baseName;
    const slug = sanitizeName(turn.prompt || "").slice(0, 60).trim();
    if (slug) return slug;
    return `manual_lab_${turn.id.slice(-6)}`;
}

// Download via the shared proxy helper (saves cleanly instead of opening a tab).
const forceDownload = downloadFile;

function buildPromptWithRefs(rawPrompt: string, refs: RefImage[]): string {
    if (refs.length === 0) return rawPrompt;
    const refLines = refs.map((r, i) => `Image ${i + 1}: ${r.label || r.tag}`).join("\n");
    // Replace [imgN] tokens with "Image N" so the model knows which ref the user means
    let body = rawPrompt;
    refs.forEach((r, i) => {
        const re = new RegExp(`\\[${r.tag}\\]`, "gi");
        body = body.replace(re, `Image ${i + 1}`);
    });
    return `REFERENCE IMAGES:\n${refLines}\n\n${body}`;
}

export function ManualLab() {
    const { activeBrand } = useBrand();

    const [mode, setMode] = useState<Mode>("image");
    const [useBrandAssets, setUseBrandAssets] = useState(false);
    const [refs, setRefs] = useState<RefImage[]>([]);
    const [prompt, setPrompt] = useState("");
    const [turns, setTurns] = useState<ChatTurn[]>([]);
    const [galleryOpen, setGalleryOpen] = useState(true);
    const [busy, setBusy] = useState(false);
    const [suggestion, setSuggestion] = useState<{ tool_id: string; reason: string } | null>(null);
    // (legacy: el state showAssetPicker se eliminó cuando el picker pasó a abrirse inline
    // junto al toggle "Usar assets de marca". Mantengo el comment como recordatorio.)
    const [showLookFeel, setShowLookFeel] = useState(false);
    // Default to "recipe" — analyzing the L&F into a text grade is far more reliable than
    // attaching it as an image reference (Nano Banana tends to copy the reference's scene
    // even when the prompt says "use only as a color swatch").
    const [lookFeelMode, setLookFeelMode] = useState<"image" | "recipe">("recipe");
    const [lfAnalyzing, setLfAnalyzing] = useState<string | null>(null);  // item id being analyzed (recipe mode)

    // Image params
    const [imgAspectRatio, setImgAspectRatio] = useState<typeof IMG_ASPECT_RATIOS[number]>("9:16");
    const [imgResolution, setImgResolution] = useState<typeof IMG_RESOLUTIONS[number]>("2K");
    const [imgModel, setImgModel] = useState<ImageModel>("nano-banana-2");
    const [variantCount, setVariantCount] = useState(1);  // image batch: generate N variations to compare
    const [batchMode, setBatchMode] = useState(false);    // "a cada imagen": each ref is an independent target → one output per image
    // Video params
    const [vidDuration, setVidDuration] = useState<typeof VID_DURATIONS[number]>("5");
    const [videoModel, setVideoModel] = useState<VideoModelId>("v3-pro");
    const [videoMode, setVideoMode] = useState<VideoMode>("i2v");
    const [vidResolution, setVidResolution] = useState<string>("1080p");
    const [vidAspectRatio, setVidAspectRatio] = useState<string>("9:16");

    // Derived: the model def + its supported modes. Drives mode filtering and audio UI.
    const currentVideoModel = VIDEO_MODELS.find((m) => m.id === videoModel) || VIDEO_MODELS[0];
    // Auto-sync mode + resolution + aspect ratio when model changes (e.g. picking Seedance
    // from a Kling state forces "rtv"; clamp res/AR to what the new model supports).
    useEffect(() => {
        if (!currentVideoModel.modes.includes(videoMode)) {
            setVideoMode(currentVideoModel.modes[0]);
        }
        const res = currentVideoModel.resolutions;
        if (res && !res.includes(vidResolution)) {
            setVidResolution(res.includes("1080p") ? "1080p" : res[res.length - 1]);
        }
        const ars = currentVideoModel.aspectRatios;
        if (ars && !ars.includes(vidAspectRatio)) {
            setVidAspectRatio(ars.includes("9:16") ? "9:16" : ars[0]);
        }
    }, [videoModel, currentVideoModel, videoMode, vidResolution, vidAspectRatio]);

    // Prompt preview / manual override
    const [showPreview, setShowPreview] = useState(false);
    const [manualPrompt, setManualPrompt] = useState<string | null>(null);  // non-null = user took over
    const [interpretation, setInterpretation] = useState("");  // Spanish gloss: "qué entendí" from the enhancer
    // When ON (default): your raw text is sent LITERAL to the image model — no curation step.
    // When OFF: two-stage flow (Preparar → Gemini cures the prompt in English → Generar).
    const [passThroughPrompt, setPassThroughPrompt] = useState(true);

    // Auto-enhance is always ON: Gemini Vision rewrites the prompt before sending,
    // unless the user explicitly edited the preview (manualPrompt !== null).
    const [enhancing, setEnhancing] = useState(false);
    const [busyLabel, setBusyLabel] = useState<string>("Generando...");

    // @ mention popover
    const [mention, setMention] = useState<{ open: boolean; query: string; anchorTop: number; anchorLeft: number; activeIdx: number }>({
        open: false, query: "", anchorTop: 0, anchorLeft: 0, activeIdx: 0,
    });

    // Copiloto side panel — same chat as /dashboard/chat (shared sessions/memory),
    // accessible from within the Lab for prompt brainstorm without leaving the page.
    const [showCopiloto, setShowCopiloto] = useState(false);

    // Lightbox (click-to-zoom for any image/video)
    const [lightbox, setLightbox] = useState<{ url: string; type: "image" | "video"; label?: string; name?: string } | null>(null);

    // "Scroll to bottom" floating button — appears when user has scrolled up to
    // browse history. Hidden when at/near the bottom.
    const [showScrollDown, setShowScrollDown] = useState(false);

    // Edit-anchor mode: when set, this ref becomes the implicit image1 of the next gen
    const anchorRef = refs.find((r) => r.isAnchor) ?? null;

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const audioInputRef = useRef<HTMLInputElement | null>(null);
    const lookFeelFileRef = useRef<HTMLInputElement | null>(null);

    // Audio refs — only used when video mode === "rtv" (Seedance with audio for lipsync).
    // Each entry: dataUrl + label. Submitted as `audioUrls` to the backend.
    const [audioRefs, setAudioRefs] = useState<Array<{ id: string; label: string; dataUrl: string }>>([]);
    const promptRef = useRef<HTMLTextAreaElement | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);

    // Live-assembled preview from current prompt + refs (what the model would actually receive)
    const assembledPreview = useMemo(() => buildPromptWithRefs(prompt, refs), [prompt, refs]);

    const currentModelInfo = useMemo(
        () => IMAGE_MODELS.find((m) => m.id === imgModel) ?? IMAGE_MODELS[0],
        [imgModel],
    );

    // Refs filtered by the active @ query
    const filteredRefs = useMemo(() => {
        if (!mention.open) return refs;
        const q = mention.query.toLowerCase();
        if (!q) return refs;
        return refs.filter((r) => r.tag.toLowerCase().includes(q) || r.label.toLowerCase().includes(q));
    }, [mention.open, mention.query, refs]);

    // Detect "@..." right before the cursor and open popover
    const handleMentionTrigger = (value: string, ta: HTMLTextAreaElement) => {
        const caret = ta.selectionStart ?? value.length;
        // Walk back from caret until whitespace/start; bail if no '@' found before whitespace.
        let i = caret - 1;
        while (i >= 0 && !/\s/.test(value[i])) {
            if (value[i] === "@") {
                const query = value.slice(i + 1, caret);
                if (refs.length === 0) { setMention((m) => ({ ...m, open: false })); return; }
                // Position popover above the textarea (simple approx — place at top-left)
                const rect = ta.getBoundingClientRect();
                const parentRect = ta.offsetParent instanceof HTMLElement
                    ? ta.offsetParent.getBoundingClientRect()
                    : rect;
                setMention({
                    open: true,
                    query,
                    anchorTop: rect.top - parentRect.top,
                    anchorLeft: rect.left - parentRect.left,
                    activeIdx: 0,
                });
                return;
            }
            i--;
        }
        setMention((m) => ({ ...m, open: false }));
    };

    // Replace the current "@query" segment with [imgN]
    const commitMention = (ref_: RefImage) => {
        const ta = promptRef.current;
        if (!ta) return;
        const caret = ta.selectionStart ?? prompt.length;
        let start = caret - 1;
        while (start >= 0 && prompt[start] !== "@") start--;
        if (start < 0) return;
        const token = `[${ref_.tag}]`;
        const next = prompt.slice(0, start) + token + prompt.slice(caret);
        setPrompt(next);
        setMention((m) => ({ ...m, open: false }));
        requestAnimationFrame(() => {
            ta.focus();
            const pos = start + token.length;
            ta.setSelectionRange(pos, pos);
        });
    };

    // Load past Manual Lab history once
    // Lab gallery is per-brand: when Koxis is active, only Koxis's Lab generations show;
    // Sandbox / no brand → brand-agnostic ones. Re-fetch when the active brand changes.
    useEffect(() => {
        const isSandbox = !activeBrand || activeBrand.id === "__sandbox__";
        const filter = isSandbox ? "__none__" : activeBrand.id;
        fetchManualGenerations(filter).then((gens) => {
            const labOnly = gens.filter((g) => g.toolId === "manual_lab");
            const past = labOnly.slice(0, 30).reverse().map((g) => generationToTurn(g));
            setTurns(past);
        }).catch(() => { /* empty history */ });
    }, [activeBrand?.id]);

    // Copiloto → Lab handoff: a prompt candidate (and optionally refs) carried over from
    // the chat. Applied on mount (cold open from Copiloto page) AND on a custom event
    // (warm: when the Copiloto SIDE PANEL fires "Usar en Lab" while the Lab is already mounted).
    useEffect(() => {
        const applyHandoff = () => {
            try {
                const raw = sessionStorage.getItem("coevo-lab-prompt-handoff");
                if (!raw) return;
                sessionStorage.removeItem("coevo-lab-prompt-handoff");
                const data = JSON.parse(raw) as { kind?: string; prompt?: string; title?: string; refs?: Array<{ data: string; mime?: string }> };
                if (data.kind !== "prompt" || !data.prompt) return;
                setMode("image");
                setPrompt(data.prompt);
                if (Array.isArray(data.refs) && data.refs.length) {
                    const refsImported: RefImage[] = data.refs.slice(0, 4).map((r, i) => {
                        const url = r.data.startsWith("data:") ? r.data : `data:${r.mime || "image/jpeg"};base64,${r.data}`;
                        return {
                            tag: `img${i + 1}`,
                            label: `del Copiloto${data.title ? `: ${data.title}` : ""}`,
                            url,
                            source: "upload",
                        };
                    });
                    setRefs(refsImported);
                }
                setShowCopiloto(false);  // close the side panel after applying
            } catch (e) {
                console.warn("[lab] handoff parse failed:", e);
            }
        };
        applyHandoff();  // cold mount
        window.addEventListener("coevo-lab-handoff", applyHandoff);  // warm (from side panel)
        return () => window.removeEventListener("coevo-lab-handoff", applyHandoff);
    }, []);

    // On first load, jump to the BOTTOM (latest output) — not the top of history.
    // The newest generation is what you want to see when you open Lab.
    const didInitialScroll = useRef(false);
    useEffect(() => {
        if (didInitialScroll.current || turns.length === 0) return;
        const el = scrollRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight; // instant, no animation on first paint
        didInitialScroll.current = true;
    }, [turns.length]);

    // Auto-scroll on new turn ONLY if the user is already near the bottom.
    // If they scrolled up to read history, don't yank them.
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (distanceFromBottom < 200) {
            el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        }
    }, [turns.length]);

    const onChatScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        setShowScrollDown(distanceFromBottom > 200);
    };

    const scrollToBottom = () => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    };

    // Debounced tool suggestion when prompt changes
    useEffect(() => {
        if (!prompt.trim() || prompt.length < 25) { setSuggestion(null); return; }
        const handle = setTimeout(async () => {
            try {
                const res = await suggestManualTool({ prompt, mode, hasRefs: refs.length > 0 });
                if (res.tool_id) setSuggestion({ tool_id: res.tool_id, reason: res.reason });
                else setSuggestion(null);
            } catch { setSuggestion(null); }
        }, 800);
        return () => clearTimeout(handle);
    }, [prompt, mode, refs.length]);

    const addUploadedRefs = async (files: FileList | File[]) => {
        const arr = Array.from(files).slice(0, 8);
        const newRefs: RefImage[] = [];
        let counter = refs.length;
        for (const file of arr) {
            counter++;
            try {
                const url = await fileToDataUrl(file);
                const stem = file.name.replace(/\.[^.]+$/, "");
                newRefs.push({
                    tag: `img${counter}`,
                    label: stem,
                    url,
                    source: "upload",
                    file,
                    baseName: sanitizeName(stem) || undefined,
                });
            } catch { /* skip */ }
        }
        setRefs((prev) => [...prev, ...newRefs]);
    };

    const addAudioRefs = async (files: FileList | File[]) => {
        const arr = Array.from(files).slice(0, 4);
        const news: Array<{ id: string; label: string; dataUrl: string }> = [];
        for (const file of arr) {
            try {
                const dataUrl = await fileToDataUrl(file);
                news.push({
                    id: `audio_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    label: file.name.replace(/\.[^.]+$/, ""),
                    dataUrl,
                });
            } catch { /* skip */ }
        }
        setAudioRefs((prev) => [...prev, ...news]);
    };
    const removeAudioRef = (id: string) => setAudioRefs((prev) => prev.filter((a) => a.id !== id));

    const addAssetRef = (
        kind: "avatar" | "product" | "clothing" | "background" | "moodboard" | "lookfeel" | "logo",
        item: { id: string; name: string; imageUrl?: string },
    ) => {
        if (!item.imageUrl) return;
        const resolver =
            kind === "avatar" ? avatarImageUrl :
            kind === "product" ? productImageUrl :
            kind === "clothing" ? clothingImageUrl :
            kind === "background" ? backgroundImageUrl :
            kind === "moodboard" ? moodboardImageUrl :
            kind === "lookfeel" ? lookAndFeelImageUrl :
            brandLogoImageUrl; // logo
        const fullUrl = resolver(item.imageUrl);
        // assetType in RefImage only knows the original 4 categories; moodboard/lookfeel/logo
        // are treated as plain assets (no special handling downstream).
        const assetType = (["avatar", "product", "clothing", "background"] as const).includes(kind as "avatar")
            ? (kind as "avatar" | "product" | "clothing" | "background")
            : undefined;
        setRefs((prev) => [
            ...prev,
            {
                tag: `img${prev.length + 1}`,
                label: `${kind}: ${item.name}`,
                url: fullUrl,
                source: "asset",
                assetType,
                baseName: sanitizeName(item.name) || undefined,
            },
        ]);
        // Antes cerrábamos el picker al seleccionar un asset. Ahora se queda abierto
        // para permitir agregar varios assets consecutivos sin re-abrir.
    };

    // Apply a brand Look & Feel reference as a COLOR-GRADE / MOOD pass — never the
    // reference's shadows or scene content. Two modes:
    //   "recipe" → analyze the reference into a text grade and apply that; the image is NOT
    //              sent, so no objects/sky/clouds can leak into the result. DEFAULT.
    //   "image"  → pass the reference image, prompt it to be used only as a palette swatch.
    //              Faster but less reliable — Nano Banana often copies the reference's scene.
    //
    // Build and inject the recipe-mode prompt. Pure helper — no state about which item.
    const applyRecipePrompt = (item: LookFeelItem & { adhocFile?: File }, recipeText: string) => {
        const grade = (recipeText || "").trim() || `the "${item.name}" color treatment`;
        const promptText =
            `Apply this exact color grade / mood to [img1] as a color-treatment pass (like a film LUT): ${grade}\n` +
            `Keep [img1] completely identical otherwise — same subject, face and identity, pose, light direction, shadows, highlights, exposure, framing, composition, background and product. Change ONLY color, tone and mood. Do NOT add, remove or alter any object or scene element.`;
        // Only set the PREPARED prompt (preview). Leave the raw input untouched so you don't
        // see the same text in two places.
        setManualPrompt(promptText);
        setShowPreview(true);
        setShowLookFeel(false);
        promptRef.current?.focus();
    };

    // `adhocFile` is set when the reference was uploaded on the spot (not saved to the brand).
    const applyLookAndFeel = async (item: LookFeelItem & { adhocFile?: File }) => {
        if (mode !== "image") setMode("image");
        if (refs.length === 0) {
            alert("Primero subí o elegí la imagen a la que querés aplicarle el look & feel (será image1).");
            return;
        }

        if (lookFeelMode === "recipe") {
            // Direct flow: analyze the reference (or reuse the cached description) → apply.
            // No modal — the prepared prompt becomes editable in the "Prompt final" textarea
            // anyway, so giving the user a second editor in a modal was redundant friction.
            setLfAnalyzing(item.id);
            try {
                // Prefer a cached `description` if the brand item already has one (it's the
                // same recipe text the analyzer would produce, just persisted).
                let recipe = (item.description || "").trim();
                if (!recipe) {
                    const r = item.adhocFile
                        ? await describeLookAndFeelUpload(item.adhocFile)
                        : activeBrand ? await describeLookAndFeel(activeBrand.id, item.id) : { description: "" };
                    recipe = (r.description || "").trim();
                }
                applyRecipePrompt(item, recipe);
            } catch (e) {
                console.error("[lookfeel] describe failed:", e);
                // Fall back to a generic prompt that at least references the item name —
                // beats silently doing nothing.
                applyRecipePrompt(item, "");
            } finally {
                setLfAnalyzing(null);
            }
            return;
        }

        // image mode: pass the reference, strongly constrained to color/mood only.
        const lfTag = `img${refs.length + 1}`;
        // Ad-hoc refs carry a data: URL — use it as-is; saved ones resolve via the static host.
        const refUrl = item.imageUrl.startsWith("data:") ? item.imageUrl : lookAndFeelImageUrl(item.imageUrl);
        setRefs((prev) => [
            ...prev,
            {
                tag: `img${prev.length + 1}`,
                label: `look&feel: ${item.name}`,
                url: refUrl,
                source: "asset",
                baseName: sanitizeName(item.name) || undefined,
            },
        ]);
        // Prompt ordering matters: Nano Banana 2 tends to return whichever image is
        // mentioned first as the output. So [img1] MUST come first, declared as the base,
        // and [${lfTag}] only appears later as a color-grade reference.
        const promptText =
            `Output: [img1] regraded with the color treatment of [${lfTag}]. The result IS [img1] with a different color/mood — nothing else. Composition, subject, identity, pose, framing, background and product all come from [img1].\n` +
            `KEEP from [img1] exactly: subject, face and identity, pose, framing, composition, background, product, light direction, shadows, highlights and exposure.\n` +
            `TAKE from [${lfTag}] ONLY: color palette, white balance / temperature, tonal contrast, saturation and overall mood / atmosphere. Treat [${lfTag}] as a film LUT or a Photoshop color-balance layer — never as scene content.\n` +
            `NEVER copy or reproduce from [${lfTag}]: objects, people, sky, clouds, scenery, textures, lighting direction or composition. Do NOT return [${lfTag}] or anything resembling it. Do NOT relight [img1].`;
        setShowLookFeel(false);
        // Only set the PREPARED prompt (preview). Leave the raw input untouched so you don't
        // see the same text in two places.
        setManualPrompt(promptText);
        setShowPreview(true);
        promptRef.current?.focus();
    };

    // Upload a one-off Look & Feel (not saved to the brand) and apply it right away.
    const addAdhocLookFeel = async (file: File) => {
        try {
            const dataUrl = await fileToDataUrl(file);
            await applyLookAndFeel({
                id: `adhoc_${Date.now()}`,
                name: file.name.replace(/\.[^.]+$/, ""),
                filename: file.name,
                imageUrl: dataUrl,
                adhocFile: file,
            });
        } catch (e) {
            console.error("[lookfeel] ad-hoc upload failed:", e);
        }
    };

    const removeRef = (tag: string) => {
        setRefs((prev) => {
            const filtered = prev.filter((r) => r.tag !== tag);
            // Re-number sequentially, anchor (if any) stays at image1
            const anchor = filtered.find((r) => r.isAnchor);
            const rest = filtered.filter((r) => !r.isAnchor);
            const ordered = anchor ? [anchor, ...rest] : rest;
            return ordered.map((r, i) => ({ ...r, tag: `img${i + 1}` }));
        });
    };

    const insertRefToken = (tag: string) => {
        const ta = promptRef.current;
        const token = `[${tag}]`;
        if (!ta) {
            setPrompt((p) => (p ? `${p} ${token}` : token));
            return;
        }
        const start = ta.selectionStart ?? prompt.length;
        const end = ta.selectionEnd ?? prompt.length;
        const next = prompt.slice(0, start) + token + prompt.slice(end);
        setPrompt(next);
        requestAnimationFrame(() => {
            ta.focus();
            const pos = start + token.length;
            ta.setSelectionRange(pos, pos);
        });
    };

    // Add a generated result as a normal reference (alongside whatever's there)
    const useResultAsRef = (turn: ChatTurn) => {
        if (!turn.outputUrl || turn.type !== "image") return;
        setRefs((prev) => [
            ...prev,
            {
                tag: `img${prev.length + 1}`,
                label: `result ${turn.id.slice(-4)}`,
                url: turn.outputUrl!,
                source: "result",
                baseName: turn.baseName,  // carry the original source name through the chain
            },
        ]);
    };

    // Pick one variant from a batch result and add it as a reference to keep working.
    const useUrlAsRef = (url: string) => {
        if (!url) return;
        setRefs((prev) => [
            ...prev,
            { tag: `img${prev.length + 1}`, label: "variante", url, source: "result" },
        ]);
    };

    // Delete a generated output from the session (gallery + chat). Local only —
    // doesn't touch anything saved to Contenido (that has its own delete).
    const deleteTurn = (turn: ChatTurn) => {
        setTurns((prev) => prev.filter((t) => t.id !== turn.id));
        // If it was the edit anchor or a ref, drop it from refs too.
        if (turn.outputUrl) setRefs((prev) => prev.filter((r) => r.url !== turn.outputUrl));
    };

    // Enter "edit anchor" mode — edit ONLY this image. Replaces all refs with just the
    // result as image1, so the edit applies to that single image (not the originals it
    // was generated from). If you want extra refs for the edit, add them after.
    const editResult = (turn: ChatTurn) => {
        if (!turn.outputUrl || turn.type !== "image") return;
        setRefs([{
            tag: "img1",
            label: `editando: result ${turn.id.slice(-4)}`,
            url: turn.outputUrl,
            source: "anchor",
            isAnchor: true,
            baseName: turn.baseName,  // editing keeps the original source name
        }]);
        promptRef.current?.focus();
    };

    const clearAnchor = () => {
        setRefs((prev) => prev.filter((r) => !r.isAnchor).map((r, i) => ({ ...r, tag: `img${i + 1}` })));
    };

    const animateResult = (turn: ChatTurn) => {
        if (!turn.outputUrl || turn.type !== "image") return;
        setMode("video");
        setRefs([{
            tag: "img1",
            label: `previous result`,
            url: turn.outputUrl,
            source: "result",
            baseName: turn.baseName,  // animated video inherits the source name
        }]);
        setPrompt("Subtle natural motion, cinematic.");
        promptRef.current?.focus();
    };

    // Reload a past generation into the composer with its EXACT prompt + refs + params,
    // ready to re-run. The two-stage "Generar" lets you tweak before firing, or just send.
    const regenerateTurn = (turn: ChatTurn) => {
        const exact = turn.sentPrompt || turn.prompt || "";
        setMode(turn.mode);
        setRefs((turn.refs || []).map((r, i) => ({
            tag: `img${i + 1}`,
            label: r.label,
            url: r.url,
            source: "result" as const,
        })));
        const p = turn.params || {};
        if (turn.mode === "image") {
            if (p.aspectRatio) setImgAspectRatio(p.aspectRatio as typeof IMG_ASPECT_RATIOS[number]);
            if (p.resolution) setImgResolution(p.resolution as typeof IMG_RESOLUTIONS[number]);
            if (p.model) setImgModel(p.model as ImageModel);
        } else {
            if (p.duration) setVidDuration(p.duration.replace("s", "") as typeof VID_DURATIONS[number]);
            if (p.model) setVideoModel(p.model as VideoModelId);
            if (p.mode) setVideoMode(p.mode as VideoMode);
            if (p.aspectRatio) setVidAspectRatio(p.aspectRatio);
            if (p.resolution) setVidResolution(p.resolution);
        }
        setPrompt(turn.prompt || exact);
        setManualPrompt(exact);   // re-send the exact prompt (skips re-enhance)
        setShowPreview(true);
        promptRef.current?.focus();
    };

    const persist = async (turn: ChatTurn) => {
        if (!turn.outputUrl || !turn.type) return;
        // Strip large data-URLs from persisted refs — keep label + tag only
        // so generations.json doesn't balloon on every upload.
        const slimRefs = (turn.refs || []).map((r) => ({
            tag: r.tag,
            label: r.label,
            url: r.url.startsWith("data:") ? "" : r.url,
        }));
        try {
            await saveGeneration({
                // Tag with the active brand so the Lab gallery shows per-brand history.
                // Sandbox (no real brand) → null (shows under the brand-agnostic view).
                brandId: activeBrand && activeBrand.id !== "__sandbox__" ? activeBrand.id : null,
                toolId: "manual_lab",
                title: turn.prompt?.slice(0, 80) || "Manual Lab",
                type: turn.type,
                status: "completed",
                outputUrl: turn.outputUrl,
                thumbnailUrl: turn.type === "image" ? turn.outputUrl : undefined,
                metadata: {
                    mode: turn.mode,
                    prompt: turn.prompt,
                    refs: slimRefs,
                    params: turn.params,
                },
            });
        } catch (e) {
            console.error("Save failed:", e);
        }
    };

    const submit = async () => {
        // We have content when either the raw input has text OR a prepared prompt was set
        // (e.g. via Look & Feel apply, where the input stays empty).
        const hasContent = prompt.trim() || (manualPrompt && manualPrompt.trim());
        if (!hasContent || busy) return;
        if (mode === "video" && refs.length === 0) {
            alert("Para generar video, agregá al menos una imagen de referencia.");
            return;
        }

        const turnId = `turn_${Date.now()}`;
        const userTurn: ChatTurn = {
            id: turnId,
            role: "user",
            mode,
            prompt,
            refs: refs.map((r) => ({ tag: r.tag, label: r.label, url: r.url })),
            params: mode === "image"
                ? { aspectRatio: imgAspectRatio, resolution: imgResolution, model: imgModel }
                : {
                    duration: `${vidDuration}s`,
                    model: videoModel,
                    mode: videoMode,
                    ...(currentVideoModel.aspectRatios ? { aspectRatio: vidAspectRatio } : {}),
                    ...(currentVideoModel.resolutions ? { resolution: vidResolution } : {}),
                },
        };
        const pendingResult: ChatTurn = {
            id: `${turnId}_r`,
            role: "result",
            mode,
            status: "pending",
        };
        setTurns((t) => [...t, userTurn, pendingResult]);

        const submittedPrompt = prompt;
        let submittedRefs = [...refs];
        // GPT Image 2 preserves the FIRST image with the most fidelity (esp. faces), so the
        // base must be image_urls[0]. The edit anchor IS the base → keep it first. (image1 is
        // already first by construction; this is a safety net. We don't reorder arbitrary refs
        // because the prompt's [imgN] tokens are position-based and would break.)
        if (imgModel === "gpt-image-2" && mode === "image" && submittedRefs.length > 1) {
            const aIdx = submittedRefs.findIndex((r) => r.isAnchor);
            if (aIdx > 0) submittedRefs = [submittedRefs[aIdx], ...submittedRefs.filter((_, i) => i !== aIdx)];
        }
        const outputBaseName = primaryBaseName(submittedRefs);  // output inherits the input image's name
        setBusy(true);
        setSuggestion(null);

        try {
            // Build the prompt that will actually go to the model:
            //   1. If user took over the preview → send their text literal
            //   2. Else if auto-enhance ON → call Gemini Vision to rewrite
            //   3. Else → assemble manually (REFERENCE IMAGES: + Image N substitution)
            let fullPrompt: string;
            if (passThroughPrompt && submittedPrompt.trim()) {
                // "Tal cual" mode: bypass Gemini entirely and send your text literal.
                fullPrompt = submittedPrompt;
            } else if (manualPrompt !== null) {
                // User opened the preview and edited — respect their literal text.
                fullPrompt = manualPrompt;
            } else {
                // Default flow: Gemini Vision rewrites the casual request into a polished prompt.
                setBusyLabel("Mejorando prompt...");
                try {
                    const { enhanced } = await enhanceManualPrompt({
                        prompt: submittedPrompt,
                        refs: submittedRefs.map((r) => ({ tag: r.tag, label: r.label, url: r.url })),
                        mode,
                        targetModel: imgModel,
                    });
                    fullPrompt = enhanced || buildPromptWithRefs(submittedPrompt, submittedRefs);
                } catch (e) {
                    console.warn("Enhance failed, falling back to manual assembly:", e);
                    fullPrompt = buildPromptWithRefs(submittedPrompt, submittedRefs);
                }
            }
            setBusyLabel("Generando...");

            // Save the actual sent prompt alongside the user's original — bubble keeps showing
            // what they typed, but the result reveals what Gemini sent.
            setTurns((t) => t.map((x) => (x.id === userTurn.id ? { ...x, sentPrompt: fullPrompt } : x)));

            if (mode === "image") {
                const refUrls = submittedRefs.map((r) => r.url);
                // Batch ("a cada imagen"): apply the SAME prompt to EACH ref independently → one output per image.
                // Otherwise: fire N variants in parallel with the SAME input set (different seeds).
                const editOne = async (inputUrls: string[]): Promise<string> => {
                    const job = inputUrls.length > 0
                        ? await createImageEdit(inputUrls, fullPrompt, imgAspectRatio, imgResolution, imgModel)
                        : await createTextToImage(fullPrompt, imgAspectRatio, imgResolution, imgModel);
                    const r = await pollImageGen(job.request_id);
                    if (r.status === "failed" || !r.image_url) throw new Error(r.error || "Image generation failed");
                    return r.image_url;
                };
                let runners: Array<Promise<string>>;
                if (batchMode && refUrls.length >= 1) {
                    setBusyLabel(`Aplicando a ${refUrls.length} ${refUrls.length === 1 ? "imagen" : "imágenes"}...`);
                    runners = refUrls.map((u) => editOne([u]));  // each image processed on its own
                } else {
                    const n = Math.max(1, Math.min(4, variantCount));
                    if (n > 1) setBusyLabel(`Generando ${n} variantes...`);
                    runners = Array.from({ length: n }, () => editOne(refUrls));
                }
                const settled = await Promise.allSettled(runners);
                const urls = settled.filter((s): s is PromiseFulfilledResult<string> => s.status === "fulfilled").map((s) => s.value);
                if (urls.length === 0) {
                    const firstErr = settled.find((s) => s.status === "rejected") as PromiseRejectedResult | undefined;
                    throw new Error(firstErr?.reason?.message || "Image generation failed");
                }

                const finalTurn: ChatTurn = {
                    ...pendingResult,
                    status: "completed",
                    type: "image",
                    outputUrl: urls[0],
                    variants: urls.length > 1 ? urls : undefined,
                    prompt: submittedPrompt,
                    sentPrompt: fullPrompt,
                    refs: userTurn.refs,
                    params: userTurn.params,
                    baseName: outputBaseName,
                };
                setTurns((t) => t.map((x) => (x.id === pendingResult.id ? finalTurn : x)));
                // Persist each variant as its own generation so they all land in Contenido.
                for (let i = 0; i < urls.length; i++) {
                    await persist({ ...finalTurn, outputUrl: urls[i], variants: undefined, baseName: outputBaseName ? `${outputBaseName}_v${i + 1}` : undefined });
                }
                // The prompt + refs (assets) PERSIST after a generation, so you can tweak the
                // instruction and re-run with the same setup. To switch base, click "Editar" on
                // a result; to start fresh, clear refs / the prompt manually.
            } else {
                // Video: dispatch by mode
                //   - i2v (Kling): single image as start frame
                //   - f2f (Kling): start + end frame
                //   - rtv (Seedance 2.0): all refs as visual guides, no fixed frame role
                const startUrlRaw = submittedRefs[0]?.url;
                if (!startUrlRaw) throw new Error("No image to animate.");

                // Fal/Kling rejects long `data:` URLs ("URL too long"). Re-host any data
                // URLs on Fal Storage first — short refs (http(s)) pass through unchanged.
                // We do this in parallel because each upload is independent and Fal handles
                // concurrent uploads fine.
                const hostedRefUrls = await Promise.all(
                    submittedRefs.map((r, i) => ensureHostedRefUrl(r.url, r.baseName ? `${r.baseName}.png` : `lab_ref_${i + 1}.png`)),
                );
                const startUrl = hostedRefUrls[0];

                let result: { status: string; video_url?: string | null; error?: string | null };

                if (videoMode === "rtv") {
                    if (submittedRefs.length < 1) throw new Error("Reference-to-video necesita al menos 1 referencia.");
                    const job = await createSeedanceReferenceToVideo({
                        prompt: fullPrompt,
                        referenceImageUrls: hostedRefUrls,
                        duration: vidDuration,
                        aspectRatio: currentVideoModel.aspectRatios ? vidAspectRatio : undefined,
                        resolution: currentVideoModel.resolutions ? vidResolution : undefined,
                        audioUrls: audioRefs.length > 0 ? audioRefs.map((a) => a.dataUrl) : undefined,
                    });
                    if (job.video_url) {
                        result = { status: "completed", video_url: job.video_url };
                    } else {
                        result = await pollSeedanceVideo(job.request_id);
                    }
                } else if (videoMode === "f2f") {
                    if (submittedRefs.length < 2) throw new Error("Frame-to-frame necesita al menos 2 referencias (start + end).");
                    const endUrl = hostedRefUrls[hostedRefUrls.length - 1];
                    // f2f only valid for Kling models — coerce videoModel to a Kling id (safe because
                    // the mode dropdown filtered it already, but guard against stale state).
                    const klingModelId = (currentVideoModel.provider === "kling" ? videoModel : "v3-pro") as KlingModel;
                    const job = await createKlingFrameToFrame({
                        start_image_url: startUrl,
                        end_image_url: endUrl,
                        prompt: fullPrompt,
                        duration: vidDuration,
                        model: klingModelId,
                    });
                    result = await pollKlingVideo(job.request_id);
                } else {
                    const klingModelId = (currentVideoModel.provider === "kling" ? videoModel : "v3-pro") as KlingModel;
                    const job = await createKlingVideo(startUrl, fullPrompt, vidDuration, klingModelId);
                    result = await pollKlingVideo(job.request_id);
                }

                if (result.status === "failed" || !result.video_url) throw new Error(result.error || "Video generation failed");

                const finalTurn: ChatTurn = {
                    ...pendingResult,
                    status: "completed",
                    type: "video",
                    outputUrl: result.video_url,
                    prompt: submittedPrompt,
                    sentPrompt: fullPrompt,
                    refs: userTurn.refs,
                    params: userTurn.params,
                    baseName: outputBaseName,
                };
                setTurns((t) => t.map((x) => (x.id === pendingResult.id ? finalTurn : x)));
                await persist(finalTurn);
            }

            // Don't clear the prompt / prepared prompt / preview — they persist across
            // generations so you can tweak the same setup and re-run. The result lands in
            // the chat; your inputs (refs + prompt) stay exactly as they were.
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Unknown error";
            setTurns((t) => t.map((x) => (x.id === pendingResult.id ? { ...x, status: "failed", error: msg } : x)));
        } finally {
            setBusy(false);
            setBusyLabel("Generando...");
        }
    };

    /** Manually expand the current prompt via Gemini Vision and put it into the editable preview.
     *  In video mode with an image, an empty prompt is allowed — the model recommends a motion. */
    const enhanceNow = async () => {
        const allowEmpty = mode === "video" && refs.length > 0;  // recommend animation from the image
        if (enhancing || (!prompt.trim() && !allowEmpty)) return;
        setEnhancing(true);
        try {
            const { enhanced, interpretation: interp } = await enhanceManualPrompt({
                prompt,
                refs: refs.map((r) => ({ tag: r.tag, label: r.label, url: r.url })),
                mode,
                targetModel: imgModel,
            });
            if (enhanced) {
                setManualPrompt(enhanced);
                setInterpretation(interp || "");
                setShowPreview(true);
            }
        } catch (e) {
            console.error("Manual enhance failed:", e);
            alert(e instanceof Error ? e.message : "No se pudo mejorar el prompt");
        } finally {
            setEnhancing(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-3.5rem)]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-edge-subtle">
                <div className="flex items-center gap-3">
                    <FlaskConical size={18} className="text-[var(--color-action)]" />
                    <div>
                        <h1 className="text-[15px] font-semibold text-fg">Manual Lab</h1>
                        <p className="text-[11px] text-fg-faint">
                            {useBrandAssets && activeBrand
                                ? `Usando assets de ${activeBrand.name}`
                                : "Generación libre · Nano Banana 2 · Kling V3 Pro"}
                        </p>
                    </div>
                </div>
            </div>

            {/* Body: gallery drawer (left) + chat history (right) */}
            <div className="flex-1 flex min-h-0">

            {/* Gallery drawer — all generated outputs of the session, so they don't get
                lost in the chat scroll. Click a thumb to open it in the lightbox. */}
            <LabGallery
                turns={turns}
                open={galleryOpen}
                onToggle={() => setGalleryOpen((o) => !o)}
                onOpen={(t) => { if (t.outputUrl && t.type) setLightbox({ url: t.outputUrl, type: t.type, label: t.prompt, name: t.baseName }); }}
                onUseAsRef={(t) => useResultAsRef(t)}
                onAnimate={(t) => animateResult(t)}
                onDelete={(t) => deleteTurn(t)}
            />

            {/* Chat history (with floating "scroll to bottom" button) */}
            <div className="flex-1 relative min-h-0">
            <div ref={scrollRef} onScroll={onChatScroll} className="absolute inset-0 overflow-y-auto px-6 py-4 space-y-4">
                {turns.length === 0 ? (
                    <EmptyState mode={mode} />
                ) : (() => {
                    // Only the last 3 completed results show their image BIG in the chat.
                    // Older results collapse to a slim line (the image lives in the gallery).
                    const recentResultIds = new Set(
                        turns
                            .filter((t) => t.role === "result" && t.status === "completed" && t.outputUrl)
                            .slice(-3)
                            .map((t) => t.id),
                    );
                    return turns.map((t) => (
                        <TurnBubble
                            key={t.id}
                            turn={t}
                            isAnchored={!!(anchorRef && t.outputUrl === anchorRef.url)}
                            busyLabel={busyLabel}
                            showFull={t.status !== "completed" || recentResultIds.has(t.id)}
                            onEdit={() => editResult(t)}
                            onUseAsRef={() => useResultAsRef(t)}
                            onAnimate={() => animateResult(t)}
                            onRegenerate={() => regenerateTurn(t)}
                            onPickVariant={(url) => useUrlAsRef(url)}
                            onZoom={() => {
                                if (!t.outputUrl || !t.type) return;
                                setLightbox({ url: t.outputUrl, type: t.type, label: t.prompt, name: t.baseName });
                            }}
                            onZoomRef={(url, label) => setLightbox({ url, type: "image", label })}
                        />
                    ));
                })()}
            </div>
            {/* Floating scroll-to-bottom button — appears when scrolled up */}
            {showScrollDown && (
                <button
                    onClick={scrollToBottom}
                    className="absolute bottom-4 right-6 w-9 h-9 rounded-full bg-surface-1 border border-edge text-fg shadow-lg hover:bg-surface-2 cursor-pointer flex items-center justify-center transition-all animate-in fade-in"
                    aria-label="Bajar al final del chat"
                    title="Bajar al final"
                >
                    <ChevronDown size={16} />
                </button>
            )}
            </div>
            </div>{/* /body flex */}

            {/* Suggestion banner */}
            {suggestion && (
                <div className="mx-6 mb-2 flex items-center justify-between gap-3 px-4 py-2 bg-[var(--color-action-subtle)] border border-[var(--color-action-muted)] rounded-full">
                    <div className="flex items-center gap-2 text-[12px] text-fg">
                        <Sparkles size={13} className="text-[var(--color-action)]" />
                        <span>{suggestion.reason || "Hay un pipeline mejor para esto."}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            to={`/dashboard/generate/${suggestion.tool_id}`}
                            className="text-[11px] px-3 py-1 rounded-full bg-surface-2 hover:bg-surface-3 text-fg cursor-pointer"
                        >
                            Ir a {suggestion.tool_id} →
                        </Link>
                        <button
                            onClick={() => setSuggestion(null)}
                            className="w-5 h-5 rounded-full flex items-center justify-center text-fg-faint hover:text-fg hover:bg-surface-2 cursor-pointer"
                            aria-label="Dismiss"
                        >
                            <X size={12} />
                        </button>
                    </div>
                </div>
            )}

            {/* What-to-generate controls — mode + brand assets, sitting right above the
                input so it's clear they drive this generation (not a global page setting). */}
            <div className="px-6 pt-2 border-t border-edge-subtle flex items-center justify-between gap-3 flex-wrap">
                {/* Mode toggle */}
                <div className="flex border border-edge rounded-full overflow-hidden p-0.5 bg-surface-1">
                    <button
                        onClick={() => setMode("image")}
                        className={cn(
                            "px-3.5 py-1 text-[12px] flex items-center gap-1.5 cursor-pointer transition-colors rounded-full",
                            mode === "image" ? "bg-[var(--color-action-subtle)] text-fg" : "text-fg-muted hover:text-fg",
                        )}
                    >
                        <ImageIcon size={13} /> Imagen
                    </button>
                    <button
                        onClick={() => setMode("video")}
                        className={cn(
                            "px-3.5 py-1 text-[12px] flex items-center gap-1.5 cursor-pointer transition-colors rounded-full",
                            mode === "video" ? "bg-[var(--color-action-subtle)] text-fg" : "text-fg-muted hover:text-fg",
                        )}
                    >
                        <Video size={13} /> Video
                    </button>
                </div>
                {/* Brand assets toggle */}
                {activeBrand && (
                    <label className="flex items-center gap-2 text-[12px] text-fg-muted cursor-pointer">
                        <input
                            type="checkbox"
                            checked={useBrandAssets}
                            onChange={(e) => setUseBrandAssets(e.target.checked)}
                            className="cursor-pointer"
                        />
                        Usar assets de {activeBrand.name}
                    </label>
                )}
            </div>

            {/* References row — cards of 88px wide so thumbs are legible at a glance.
                Action buttons (Subir / Asset / Look & Feel) match the height of a card
                so the row aligns visually. `items-stretch` keeps everything the same height. */}
            <div className="px-6 pt-2">
                <div className="flex items-stretch gap-2 flex-wrap">
                    {refs.map((r) => (
                        <RefChip
                            key={r.tag}
                            ref_={r}
                            onRemove={() => removeRef(r.tag)}
                            onInsert={() => insertRefToken(r.tag)}
                            onZoom={() => setLightbox({ url: r.url, type: "image", label: r.label, name: r.baseName })}
                        />
                    ))}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-[88px] flex flex-col items-center justify-center gap-1 border border-dashed border-edge rounded-[var(--radius-sm)] text-fg-muted hover:text-fg hover:border-edge-strong hover:bg-surface-1 cursor-pointer transition-colors text-[11px]"
                        title="Subir imagen"
                    >
                        <Plus size={16} />
                        Subir
                    </button>
                    {/* Look & Feel: apply a saved OR ad-hoc lighting/grade reference to image1 */}
                    {mode === "image" && (
                        <div className="relative">
                            <button
                                onClick={() => setShowLookFeel((v) => !v)}
                                className="w-[88px] h-full flex flex-col items-center justify-center gap-1 border border-dashed border-edge rounded-[var(--radius-sm)] text-fg-muted hover:text-fg hover:border-edge-strong hover:bg-surface-1 cursor-pointer transition-colors text-[11px]"
                                title="Aplicar un look & feel a image1 — de la marca o subiendo uno en el momento"
                            >
                                <Sun size={16} />
                                Look & Feel
                            </button>
                            {showLookFeel && (
                                <div className="absolute z-20 mt-1 left-0 w-64 max-h-80 overflow-y-auto bg-surface-1 border border-edge rounded-[var(--radius-md)] shadow-xl p-1.5">
                                    <p className="text-[10px] text-fg-faint px-1.5 pt-1 leading-snug">
                                        Aplica color/mood a <code className="px-1 rounded bg-surface-2">image1</code> sin cambiar su contenido.
                                    </p>
                                    {/* Mode toggle: text recipe (default, reliable) vs image ref (faster but copies scene). */}
                                    <div className="flex gap-1 p-1">
                                        {([
                                            { v: "recipe" as const, label: "Receta (auto)", title: "Click → Gemini analiza la referencia y aplica solo color/mood. La imagen NO se manda al generador. Recomendado." },
                                            { v: "image" as const, label: "Imagen ref", title: "Pasa la imagen como ref. Más rápido pero Nano Banana suele copiar la escena, incluso con prompts restrictivos." },
                                        ]).map((m) => (
                                            <button
                                                key={m.v}
                                                onClick={() => setLookFeelMode(m.v)}
                                                title={m.title}
                                                className={cn(
                                                    "flex-1 text-[10px] py-1 rounded cursor-pointer transition-colors",
                                                    lookFeelMode === m.v ? "bg-[var(--color-action-subtle)] text-fg border border-[var(--color-action-muted)]" : "text-fg-muted hover:text-fg border border-transparent",
                                                )}
                                            >
                                                {m.label}
                                            </button>
                                        ))}
                                    </div>
                                    {/* Honest warning — Nano Banana frequently returns the reference image itself
                                        when given two refs, regardless of how strict the prompt is. */}
                                    {lookFeelMode === "image" && (
                                        <p className="text-[10px] text-[var(--color-warning,#f5a623)] px-1.5 pb-1 leading-snug">
                                            ⚠ Nano Banana puede devolverte la imagen del look&feel en vez de aplicarla. Si pasa, cambiá a Receta.
                                        </p>
                                    )}
                                    {/* Ad-hoc: upload a one-off reference (not saved to the brand) */}
                                    <button
                                        onClick={() => lookFeelFileRef.current?.click()}
                                        disabled={lfAnalyzing !== null}
                                        className="w-full flex items-center gap-2 p-1 mb-1 rounded border border-dashed border-edge hover:bg-surface-2 cursor-pointer text-left disabled:opacity-50"
                                    >
                                        <span className="w-9 h-9 rounded bg-surface-2 flex items-center justify-center text-fg-faint shrink-0"><Plus size={14} /></span>
                                        <span className="text-[12px] text-fg flex-1">Subir una (solo esta vez)</span>
                                        {(lfAnalyzing || "").startsWith("adhoc_") && <RefreshCw size={11} className="animate-spin text-fg-faint shrink-0" />}
                                    </button>
                                    {(activeBrand?.lookAndFeel || []).map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => applyLookAndFeel(item)}
                                            disabled={lfAnalyzing !== null}
                                            className="w-full flex items-center gap-2 p-1 rounded hover:bg-surface-2 cursor-pointer text-left disabled:opacity-50"
                                        >
                                            <img src={lookAndFeelImageUrl(item.imageUrl)} alt={item.name} className="w-9 h-9 rounded object-cover shrink-0" />
                                            <span className="text-[12px] text-fg truncate flex-1">{item.name}</span>
                                            {lfAnalyzing === item.id && <RefreshCw size={11} className="animate-spin text-fg-faint shrink-0" />}
                                        </button>
                                    ))}
                                    {(activeBrand?.lookAndFeel?.length ?? 0) === 0 && (
                                        <p className="text-[10px] text-fg-faint px-1.5 py-1">Esta marca no tiene Look & Feel guardados. Subí uno arriba, o cargalos en Brand Kit para reusarlos.</p>
                                    )}
                                </div>
                            )}
                            <input
                                ref={lookFeelFileRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) addAdhocLookFeel(f); e.target.value = ""; }}
                            />
                        </div>
                    )}
                    {/* Audio button only visible in Seedance rtv mode (audio drives lipsync) */}
                    {mode === "video" && videoMode === "rtv" && (
                        <button
                            onClick={() => audioInputRef.current?.click()}
                            className="flex items-center gap-1 px-3 py-1.5 text-[11px] border border-dashed border-edge rounded-full text-fg-muted hover:text-fg hover:border-edge-strong cursor-pointer"
                            title="Audio: Seedance lo lipsynca al avatar"
                        >
                            <Plus size={12} /> Audio
                        </button>
                    )}
                    {refs.length > 0 && (
                        <span className="text-[10px] text-fg-faint ml-auto">
                            {batchMode && mode === "image"
                                ? `Modo lote: cada imagen se procesa por separado → ${refs.length} resultado${refs.length === 1 ? "" : "s"}`
                                : <>Tipeá <code className="px-1 rounded bg-surface-1">@</code> en el prompt para insertar referencias</>}
                        </span>
                    )}
                </div>

                {/* Audio refs chips (Seedance rtv only) */}
                {mode === "video" && videoMode === "rtv" && audioRefs.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                        {audioRefs.map((a) => (
                            <div key={a.id} className="flex items-center gap-2 pl-2 pr-1 py-1 bg-surface-1 border border-edge rounded-full text-[11px]">
                                <span className="text-[var(--color-action)]">🎵</span>
                                <span className="text-fg truncate max-w-[140px]">{a.label}</span>
                                <button
                                    onClick={() => removeAudioRef(a.id)}
                                    className="w-4 h-4 rounded-full flex items-center justify-center text-fg-faint hover:text-error cursor-pointer"
                                >
                                    <X size={11} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                        if (e.target.files) addUploadedRefs(e.target.files);
                        e.target.value = "";
                    }}
                />
                <input
                    ref={audioInputRef}
                    type="file"
                    multiple
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => {
                        if (e.target.files) addAudioRefs(e.target.files);
                        e.target.value = "";
                    }}
                />
                {/* Asset picker inline: aparece automáticamente cuando se activa "Usar assets de marca".
                    Antes había que hacer doble click (toggle + botón "+ Asset"). Ahora es 1 solo paso —
                    se ven los assets al toque y el botón "+ Asset" desaparece. El usuario puede ocultar
                    el picker apagando el toggle. */}
                {useBrandAssets && activeBrand && (
                    <AssetPicker brand={activeBrand} onPick={addAssetRef} onClose={() => setUseBrandAssets(false)} />
                )}
            </div>

            {/* Composer */}
            <div className="px-6 py-3 border-t border-edge bg-surface-0">
                <div className="space-y-2">
                    {/* Anchor chip — "editing this image" mode */}
                    {anchorRef && (
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-full bg-[var(--color-action-subtle)] border border-[var(--color-action-muted)] w-fit max-w-full">
                            <button
                                onClick={() => setLightbox({ url: anchorRef.url, type: "image", label: anchorRef.label, name: anchorRef.baseName })}
                                className="cursor-pointer"
                                title="Ver imagen"
                            >
                                <img src={anchorRef.url} alt="anchor" className="w-7 h-7 object-cover rounded-full" />
                            </button>
                            <div className="flex flex-col leading-tight min-w-0">
                                <span className="text-[10px] text-[var(--color-action)] font-medium uppercase tracking-wide">Editando</span>
                                <span className="text-[11px] text-fg truncate max-w-[260px]">{anchorRef.label}</span>
                            </div>
                            <button
                                onClick={clearAnchor}
                                className="ml-1 w-5 h-5 rounded-full flex items-center justify-center hover:bg-surface-2 text-fg-muted hover:text-fg cursor-pointer"
                                title="Salir del modo edición"
                            >
                                <X size={11} />
                            </button>
                        </div>
                    )}

                    {/* Prompt preview / manual override */}
                    {showPreview && (
                        <div className="rounded-[var(--radius-md)] border border-[var(--color-action-muted)] bg-[var(--color-action-subtle)]/30 p-2.5 space-y-1.5">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] text-fg-muted flex items-center gap-1.5">
                                    <Eye size={11} /> Prompt final {manualPrompt !== null && <span className="text-[var(--color-action)]">· editado manualmente</span>}
                                </span>
                                <div className="flex items-center gap-1">
                                    {manualPrompt !== null && (
                                        <button
                                            onClick={() => setManualPrompt(null)}
                                            className="text-[10px] px-2 py-0.5 rounded-full hover:bg-surface-2 text-fg-muted hover:text-fg cursor-pointer flex items-center gap-1"
                                            title="Volver al ensamblado automático"
                                        >
                                            <RotateCcw size={10} /> Reset
                                        </button>
                                    )}
                                    <button onClick={() => setShowPreview(false)} className="text-fg-faint hover:text-fg cursor-pointer">
                                        <X size={12} />
                                    </button>
                                </div>
                            </div>
                            {interpretation && (
                                <div className="text-[11px] text-fg-muted bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2 py-1.5 leading-snug">
                                    <span className="text-[var(--color-action)] font-medium">Qué entendí:</span> {interpretation}
                                </div>
                            )}
                            <textarea
                                value={manualPrompt ?? assembledPreview}
                                onChange={(e) => setManualPrompt(e.target.value)}
                                placeholder={assembledPreview}
                                rows={6}
                                className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2 py-1.5 text-[12px] font-mono text-fg resize-y focus:outline-none focus:border-[var(--color-edge-focus)]"
                            />
                            <p className="text-[10px] text-fg-faint">
                                {manualPrompt !== null
                                    ? "Se enviará tu texto literal — los [imgN] no se expandirán."
                                    : "Se ensambla automáticamente desde tu prompt + refs. Editá para tomar control."}
                            </p>
                        </div>
                    )}

                    {/* Main prompt + @ mention popover */}
                    <div className="relative">
                        <Textarea
                            ref={promptRef}
                            value={prompt}
                            onChange={(e) => {
                                const v = e.target.value;
                                setPrompt(v);
                                handleMentionTrigger(v, e.target);
                                // Invalidate the previously prepared prompt — user edited the raw
                                // instruction, so the stale "Preparar" output should not be re-sent.
                                // Also close the preview so the user re-Preparates to get a fresh
                                // English version from Gemini (otherwise the panel falls back to
                                // showing the raw Spanish placeholder, which looks confusing).
                                if (manualPrompt !== null) {
                                    setManualPrompt(null);
                                    setInterpretation("");
                                    setShowPreview(false);
                                }
                            }}
                            placeholder={
                                mode === "image"
                                    ? `Describe la imagen. Tipeá @ para referenciar imágenes adjuntas.`
                                    : `Describe el movimiento. La primera referencia se anima como frame de inicio.`
                            }
                            // rows=5 da 5 líneas por default — suficiente para escribir un prompt
                            // con contexto sin sentir que la caja es chiquita. resize-y deja al
                            // usuario agrandarla si necesita más espacio (sin contraer horizontal).
                            rows={5}
                            className="resize-y text-[13px] rounded-[var(--radius-md)] px-3.5 py-2.5 leading-relaxed min-h-[80px]"
                            onKeyDown={(e) => {
                                if (mention.open) {
                                    if (e.key === "ArrowDown") { e.preventDefault(); setMention((m) => ({ ...m, activeIdx: Math.min(m.activeIdx + 1, filteredRefs.length - 1) })); return; }
                                    if (e.key === "ArrowUp") { e.preventDefault(); setMention((m) => ({ ...m, activeIdx: Math.max(m.activeIdx - 1, 0) })); return; }
                                    if (e.key === "Enter" && filteredRefs.length > 0) { e.preventDefault(); commitMention(filteredRefs[mention.activeIdx]); return; }
                                    if (e.key === "Escape") { e.preventDefault(); setMention((m) => ({ ...m, open: false })); return; }
                                }
                                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
                            }}
                            onBlur={() => setTimeout(() => setMention((m) => ({ ...m, open: false })), 150)}
                        />
                        {mention.open && filteredRefs.length > 0 && (
                            <MentionPopover
                                refs={filteredRefs}
                                activeIdx={mention.activeIdx}
                                onPick={commitMention}
                                top={mention.anchorTop}
                                left={mention.anchorLeft}
                            />
                        )}
                    </div>

                    {/* Params + actions */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 text-[11px] text-fg-muted flex-wrap">
                            {mode === "image" ? (
                                <>
                                    <ParamSelect
                                        label="Modelo"
                                        value={imgModel}
                                        options={IMAGE_MODELS.map((m) => m.id)}
                                        labels={Object.fromEntries(IMAGE_MODELS.map((m) => [m.id, m.label]))}
                                        onChange={(v) => setImgModel(v as ImageModel)}
                                    />
                                    <ParamSelect label="AR" value={imgAspectRatio} options={IMG_ASPECT_RATIOS as readonly string[]} onChange={(v) => setImgAspectRatio(v as typeof IMG_ASPECT_RATIOS[number])} />
                                    <ParamSelect label="Res" value={imgResolution} options={IMG_RESOLUTIONS as readonly string[]} onChange={(v) => setImgResolution(v as typeof IMG_RESOLUTIONS[number])} />
                                    {!batchMode && <ParamSelect label="Variantes" value={String(variantCount)} options={VARIANT_COUNTS as readonly string[]} onChange={(v) => setVariantCount(Number(v))} />}
                                    <button
                                        onClick={() => setBatchMode((v) => !v)}
                                        title="Aplicar el mismo prompt/look&feel a cada imagen por separado → un resultado por imagen"
                                        className={cn(
                                            "px-2 py-0.5 rounded-full text-[10px] cursor-pointer border transition-colors",
                                            batchMode ? "bg-[var(--color-action-subtle)] text-fg border-[var(--color-action-muted)]" : "text-fg-muted hover:text-fg border-edge",
                                        )}
                                    >
                                        A cada imagen
                                    </button>
                                    <div
                                        className="inline-flex border border-edge rounded-full overflow-hidden p-0.5 gap-0.5"
                                        title="Tal cual: tu texto se manda LITERAL al modelo. Curar: Gemini lo interpreta y cura el prompt antes."
                                    >
                                        <button
                                            onClick={() => setPassThroughPrompt(true)}
                                            className={cn(
                                                "px-2 py-0.5 rounded-full text-[10px] cursor-pointer transition-colors",
                                                passThroughPrompt ? "bg-[var(--color-action-subtle)] text-fg border border-[var(--color-action-muted)]" : "text-fg-muted hover:text-fg",
                                            )}
                                        >
                                            Tal cual
                                        </button>
                                        <button
                                            onClick={() => setPassThroughPrompt(false)}
                                            className={cn(
                                                "px-2 py-0.5 rounded-full text-[10px] cursor-pointer transition-colors",
                                                !passThroughPrompt ? "bg-[var(--color-action-subtle)] text-fg border border-[var(--color-action-muted)]" : "text-fg-muted hover:text-fg",
                                            )}
                                        >
                                            Curar con Gemini
                                        </button>
                                    </div>
                                    {refs.length > 0 && (
                                        <span className={cn("text-[10px]", currentModelInfo.resHonored ? "text-[var(--color-action)]" : "text-fg-faint")}>
                                            · {currentModelInfo.note}
                                        </span>
                                    )}
                                    {imgModel === "gpt-image-2" && refs.length > 1 && (
                                        <span className="text-[10px] text-fg-faint">· image1 = base (GPT la preserva mejor — poné ahí la cara/lo principal)</span>
                                    )}
                                </>
                            ) : (
                                <>
                                    <ParamSelect
                                        label="Modelo"
                                        value={videoModel}
                                        options={VIDEO_MODELS.map((m) => m.id)}
                                        labels={Object.fromEntries(VIDEO_MODELS.map((m) => [m.id, m.label]))}
                                        onChange={(v) => setVideoModel(v as VideoModelId)}
                                    />
                                    {currentVideoModel.modes.length > 1 && (
                                        <ParamSelect
                                            label="Modo"
                                            value={videoMode}
                                            options={currentVideoModel.modes as readonly string[]}
                                            labels={{
                                                i2v: "Image → Video",
                                                f2f: "Frame to Frame",
                                                rtv: "Refs → Video",
                                            }}
                                            onChange={(v) => setVideoMode(v as VideoMode)}
                                        />
                                    )}
                                    <ParamSelect label="Duración" value={vidDuration} options={VID_DURATIONS as readonly string[]} onChange={(v) => setVidDuration(v as typeof VID_DURATIONS[number])} suffix="s" />
                                    {currentVideoModel.aspectRatios ? (
                                        <ParamSelect label="AR" value={vidAspectRatio} options={currentVideoModel.aspectRatios} onChange={setVidAspectRatio} />
                                    ) : (
                                        <span className="text-[10px] text-fg-faint">· AR = la de la imagen</span>
                                    )}
                                    {currentVideoModel.resolutions ? (
                                        <ParamSelect label="Res" value={vidResolution} options={currentVideoModel.resolutions} onChange={setVidResolution} />
                                    ) : (
                                        <span className="text-[10px] text-fg-faint">· resolución fija por el modelo</span>
                                    )}
                                    {videoMode === "f2f" && (
                                        <span className={cn("text-[10px]", refs.length >= 2 ? "text-fg-faint" : "text-error")}>
                                            · {refs.length >= 2 ? "primer ref = start, último = end" : "necesita 2 refs"}
                                        </span>
                                    )}
                                    {videoMode === "rtv" && (
                                        <span className={cn("text-[10px]", refs.length >= 1 ? "text-fg-faint" : "text-error")}>
                                            · {refs.length >= 2 ? "todas las refs como guía visual" : refs.length === 1 ? "1 ref ok, mejor 2-4" : "necesita ≥1 ref"}
                                            {currentVideoModel.supportsAudio && (audioRefs.length > 0 ? ` · ${audioRefs.length} audio (lipsync)` : " · sin audio = sólo motion")}
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Video + image: Gemini watches the image and proposes a motion (honors any typed intent) */}
                            {mode === "video" && refs.length > 0 && (
                                <button
                                    onClick={() => { if (!enhancing) enhanceNow(); }}
                                    disabled={enhancing}
                                    className="text-[11px] px-3 py-1.5 rounded-full cursor-pointer flex items-center gap-1 border border-edge text-fg-muted hover:text-fg hover:bg-surface-1 transition-colors disabled:opacity-40"
                                    title="Gemini mira la imagen y propone una animación. Respeta lo que escribas; si no escribís nada, la decide él."
                                >
                                    {enhancing ? <RefreshCw size={11} className="animate-spin" /> : <Video size={11} />}
                                    Recomendar animación
                                </button>
                            )}
                            {/* Single Prompt button: enhances via Gemini Vision + opens editable preview */}
                            <button
                                onClick={() => {
                                    if (showPreview) { setShowPreview(false); return; }
                                    if (!prompt.trim()) return;
                                    enhanceNow();
                                }}
                                disabled={enhancing || (!showPreview && !prompt.trim())}
                                className={cn(
                                    "text-[11px] px-3 py-1.5 rounded-full cursor-pointer flex items-center gap-1 border transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                                    showPreview ? "bg-[var(--color-action-subtle)] border-[var(--color-action-muted)] text-fg" : "border-edge text-fg-muted hover:text-fg hover:bg-surface-1",
                                )}
                                title="Ver el prompt mejorado por Gemini (editable)"
                            >
                                {enhancing ? <RefreshCw size={11} className="animate-spin" /> : <Sparkles size={11} />}
                                Prompt
                            </button>
                            <Button
                                onClick={() => {
                                    if (busy || enhancing) return;
                                    const hasContent = prompt.trim() || (manualPrompt && manualPrompt.trim());
                                    if (!hasContent) return;
                                    // "Tal cual": one-click Generar — bypasses Gemini, sends your raw text literal.
                                    if (passThroughPrompt) { submit(); return; }
                                    // Two-stage: first prepare the model-aware prompt for review,
                                    // then (once there's a prompt to confirm) actually generate.
                                    if (manualPrompt === null) { enhanceNow(); return; }
                                    submit();
                                }}
                                disabled={busy || enhancing || (!prompt.trim() && !manualPrompt)}
                                size="sm"
                                className="rounded-full px-4"
                            >
                                {busy || enhancing
                                    ? <RefreshCw size={13} className="animate-spin" />
                                    : (passThroughPrompt || manualPrompt !== null) ? <Send size={13} /> : <Sparkles size={13} />}
                                <span className="ml-1.5">
                                    {busy ? busyLabel
                                        : enhancing ? "Preparando…"
                                        : passThroughPrompt ? "Generar"
                                        : manualPrompt === null ? "Preparar prompt"
                                        : "Generar"}
                                </span>
                            </Button>
                        </div>
                    </div>
                </div>
                <p className="text-[10px] text-fg-faint mt-2">1) <b className="text-fg-muted">Preparar prompt</b> → revisalo / editalo → 2) <b className="text-fg-muted">Generar</b>. El prompt se arma según el modelo elegido. · @ referencia · ⌘+Enter genera directo.</p>
            </div>

            {/* Lightbox overlay */}
            {lightbox && (
                <Lightbox
                    url={lightbox.url}
                    type={lightbox.type}
                    label={lightbox.label}
                    name={lightbox.name}
                    onClose={() => setLightbox(null)}
                />
            )}

            {/* Copiloto — same chat, same memory as /dashboard/chat. Slides in from the right. */}
            {!showCopiloto && (
                <button
                    onClick={() => setShowCopiloto(true)}
                    title="Copiloto — pedile prompts para probar acá"
                    className="fixed bottom-5 right-5 z-30 flex items-center gap-2 h-11 px-4 rounded-full bg-[var(--color-action)] text-[var(--color-action-fg)] shadow-xl hover:scale-[1.03] transition-transform cursor-pointer"
                >
                    <MessageSquare size={16} />
                    <span className="text-[12px] font-semibold">Copiloto</span>
                </button>
            )}
            {showCopiloto && (
                <>
                    <div
                        onClick={() => setShowCopiloto(false)}
                        className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity"
                    />
                    <div className="fixed top-0 right-0 z-40 h-screen w-full sm:w-[600px] bg-[var(--color-canvas)] border-l border-edge flex flex-col shadow-2xl">
                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-edge">
                            <div className="flex items-center gap-2">
                                <MessageSquare size={14} className="text-[var(--color-action)]" />
                                <span className="text-[12px] font-semibold text-fg">Copiloto</span>
                                <span className="text-[10px] text-fg-faint">misma sesión que /chat</span>
                            </div>
                            <button
                                onClick={() => setShowCopiloto(false)}
                                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-surface-2 text-fg-muted hover:text-fg cursor-pointer"
                                title="Cerrar"
                            >
                                <X size={14} />
                            </button>
                        </div>
                        <div className="flex-1 min-h-0 overflow-hidden flex">
                            <ChatPanel compact />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// ── Sub-components ───────────────────────────────────────

function ParamSelect({ label, value, options, onChange, suffix = "", labels }: {
    label: string;
    value: string;
    options: readonly string[];
    onChange: (v: string) => void;
    suffix?: string;
    labels?: Record<string, string>;
}) {
    return (
        <label className="flex items-center gap-2 bg-surface-1 border border-edge rounded-full pl-3 pr-2 py-1">
            <span className="text-fg-faint">{label}</span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="bg-transparent border-0 text-[11px] text-fg cursor-pointer focus:outline-none pr-1"
            >
                {options.map((o) => <option key={o} value={o}>{labels?.[o] ?? o}{suffix}</option>)}
            </select>
        </label>
    );
}

function MentionPopover({ refs, activeIdx, onPick, top, left }: {
    refs: RefImage[];
    activeIdx: number;
    onPick: (r: RefImage) => void;
    top: number;
    left: number;
}) {
    return (
        <div
            className="absolute z-50 bg-surface-1 border border-edge rounded-[var(--radius-md)] shadow-lg p-1 min-w-[220px] max-w-[320px] max-h-64 overflow-y-auto"
            style={{
                top: top - 8,
                left,
                transform: "translateY(-100%)",
            }}
            // Prevent textarea blur from closing before click registers
            onMouseDown={(e) => e.preventDefault()}
        >
            <div className="text-[10px] text-fg-faint px-2 py-1">Insertar referencia</div>
            {refs.map((r, i) => (
                <button
                    key={r.tag}
                    onClick={() => onPick(r)}
                    className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-left",
                        i === activeIdx ? "bg-[var(--color-action-subtle)]" : "hover:bg-surface-2",
                    )}
                >
                    {r.url
                        ? <img src={r.url} alt={r.label} className="w-7 h-7 object-cover rounded-sm shrink-0" />
                        : <div className="w-7 h-7 bg-surface-2 rounded-sm shrink-0" />}
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                            <code className="text-[11px] text-[var(--color-action)]">[{r.tag}]</code>
                            <span className="text-[11px] text-fg truncate">{r.label}</span>
                        </div>
                        <div className="text-[9px] text-fg-faint">{r.source}</div>
                    </div>
                </button>
            ))}
        </div>
    );
}

/**
 * RefChip — referencia cargada en la sesión actual (subida, generada o asset).
 *
 * Layout: card vertical de ~88px de ancho con thumbnail cuadrada arriba (80px),
 * tag/label debajo, X arriba a la derecha en hover. Reemplaza al chip horizontal
 * anterior (36px) porque a esa escala los thumbs eran ilegibles y perdías noción
 * de qué tenías cargado. El click sobre el thumb abre el lightbox (zoom);
 * el click sobre el tag inserta el `[imgN]` en el prompt; la X lo remueve.
 */
function RefChip({ ref_, onRemove, onInsert, onZoom }: { ref_: RefImage; onRemove: () => void; onInsert: () => void; onZoom: () => void }) {
    const isAnchor = ref_.isAnchor;
    return (
        <div className={cn(
            "group relative w-[88px] shrink-0 rounded-[var(--radius-sm)] overflow-hidden transition-all border",
            isAnchor
                ? "bg-[var(--color-action-subtle)] border-[var(--color-action-muted)]"
                : "bg-surface-1 border-edge hover:border-edge-strong",
        )}>
            {/* Thumb (80×80) — click to zoom in lightbox */}
            <button
                onClick={onZoom}
                className="block w-full aspect-square cursor-zoom-in overflow-hidden bg-surface-2"
                title="Ver imagen en grande"
            >
                <img src={ref_.url} alt={ref_.label} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
            </button>
            {/* Tag + label row — click inserts the `[imgN]` token into the prompt */}
            <button
                onClick={onInsert}
                className="w-full px-1.5 py-1 text-left cursor-pointer hover:bg-surface-2"
                title="Insertar tag en el prompt"
            >
                <code className={cn("text-[10px] font-semibold block", isAnchor ? "text-[var(--color-action-strong)]" : "text-[var(--color-action)]")}>
                    [{ref_.tag}]
                </code>
                <span className="text-[9px] text-fg-faint block truncate leading-tight">
                    {ref_.label}
                </span>
            </button>
            {/* Remove button — appears on hover only so it doesn't compete visually */}
            <button
                onClick={onRemove}
                title="Quitar referencia"
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 hover:bg-black flex items-center justify-center cursor-pointer transition-opacity"
            >
                <X size={11} />
            </button>
        </div>
    );
}

function EmptyState({ mode }: { mode: Mode }) {
    return (
        <div className="h-full flex flex-col items-center justify-center text-center py-12">
            <div className="w-12 h-12 rounded-full bg-[var(--color-action-subtle)] flex items-center justify-center mb-3">
                <Wand2 size={20} className="text-[var(--color-action)]" />
            </div>
            <p className="text-[14px] text-fg font-medium">Generá libremente</p>
            <p className="text-[12px] text-fg-muted max-w-md mt-1">
                {mode === "image"
                    ? "Subí imágenes como referencia, taggeá con [img1], [img2] en el prompt y generá con Nano Banana 2."
                    : "Subí una imagen como frame inicial, describí el movimiento y generá con Kling V3 Pro."}
            </p>
        </div>
    );
}

function TurnBubble({ turn, isAnchored, busyLabel, showFull = true, onEdit, onUseAsRef, onAnimate, onRegenerate, onPickVariant, onZoom, onZoomRef }: {
    turn: ChatTurn;
    isAnchored: boolean;
    busyLabel: string;
    // true → show the big image (last 3 results). false → slim line (older, in gallery).
    showFull?: boolean;
    onEdit: () => void;
    onUseAsRef: () => void;
    onAnimate: () => void;
    onRegenerate: () => void;
    onPickVariant: (url: string) => void;
    onZoom: () => void;
    onZoomRef: (url: string, label: string) => void;
}) {
    const [showSent, setShowSent] = useState(false);
    // Older completed results aren't rendered in the chat — they live in the gallery.
    if (turn.role === "result" && turn.status === "completed" && !showFull) return null;
    if (turn.role === "user") {
        return (
            <div className="flex justify-end">
                <div className="max-w-[80%] bg-[var(--color-action-subtle)] border border-[var(--color-action-muted)] rounded-[var(--radius-lg)] px-3 py-2 space-y-1.5">
                    {turn.refs && turn.refs.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                            {turn.refs.map((r) => (
                                <button
                                    key={r.tag}
                                    onClick={() => r.url && onZoomRef(r.url, r.label)}
                                    disabled={!r.url}
                                    className={cn(
                                        "flex items-center gap-1 bg-surface-1 rounded-full pl-0.5 pr-2 py-0.5 text-[10px]",
                                        r.url ? "cursor-pointer hover:bg-surface-2" : "cursor-default",
                                    )}
                                    title={r.url ? "Ver imagen" : ""}
                                >
                                    {r.url
                                        ? <img src={r.url} alt={r.label} className="w-5 h-5 object-cover rounded-full" />
                                        : <span className="w-5 h-5 bg-surface-2 rounded-full" />}
                                    <code className="text-[var(--color-action)]">[{r.tag}]</code>
                                </button>
                            ))}
                        </div>
                    )}
                    <p className="text-[13px] text-fg whitespace-pre-wrap">{turn.prompt}</p>
                    {turn.params && (
                        <div className="flex gap-2 text-[10px] text-fg-faint">
                            {Object.entries(turn.params).map(([k, v]) => (
                                <span key={k}>{k}: {v}</span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Result
    return (
        <div className="flex justify-start">
            <div className={cn(
                "max-w-[80%] bg-surface-1 border rounded-[var(--radius-lg)] p-2 space-y-2",
                isAnchored ? "border-[var(--color-action-muted)] ring-1 ring-[var(--color-action-muted)]" : "border-edge",
            )}>
                {turn.status === "pending" && (
                    <div className="flex items-center gap-2 px-3 py-6 text-[12px] text-fg-muted">
                        <RefreshCw size={14} className="animate-spin" />
                        {busyLabel}
                    </div>
                )}
                {turn.status === "failed" && (
                    <div className="flex items-start gap-2 px-3 py-3 text-[12px] text-error">
                        <AlertCircle size={14} className="mt-0.5 shrink-0" />
                        <div>
                            <p className="font-medium">Falló la generación</p>
                            <p className="text-fg-muted text-[11px] mt-0.5">{turn.error}</p>
                        </div>
                    </div>
                )}
                {turn.status === "completed" && turn.outputUrl && (
                    <>
                        {/* Last 3 results → big preview. Older results live ONLY in the
                            gallery, so they render nothing here (no clutter). */}
                        {turn.type === "image" && turn.variants && turn.variants.length > 1 ? (
                            <div className="max-w-md">
                                <p className="text-[10px] text-fg-faint mb-1">{turn.variants.length} resultados · pasá el mouse para usar o descargar cada uno</p>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {turn.variants.map((url, i) => (
                                        <div key={i} className="relative group/v rounded-[var(--radius-sm)] overflow-hidden border border-edge">
                                            <button onClick={() => onZoomRef(url, `variante ${i + 1}`)} className="block w-full cursor-zoom-in" title="Ampliar">
                                                <img src={url} alt={`Variante ${i + 1}`} className="w-full aspect-square object-cover" />
                                            </button>
                                            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover/v:opacity-100 transition-opacity">
                                                <button onClick={() => onPickVariant(url)} title="Usar esta como referencia para seguir" className="px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] backdrop-blur hover:bg-[var(--color-action)] hover:text-[var(--color-action-fg)] cursor-pointer">Usar</button>
                                                <button onClick={() => forceDownload(url, `${downloadBaseName(turn)}_v${i + 1}.png`)} title="Descargar" className="w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur hover:bg-black/80 cursor-pointer"><Download size={11} /></button>
                                            </div>
                                            <span className="absolute bottom-1 left-1 text-[9px] text-white/90 bg-black/50 rounded px-1">{i + 1}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : turn.type === "image" ? (
                            <button onClick={onZoom} className="block cursor-zoom-in" title="Click para ampliar">
                                <img src={turn.outputUrl} alt="Generated" className="max-w-md max-h-[60vh] rounded-[var(--radius-md)]" />
                            </button>
                        ) : (
                            <video src={turn.outputUrl} controls className="max-w-md max-h-[60vh] rounded-[var(--radius-md)]" />
                        )}
                        <div className="flex items-center gap-1 px-1 flex-wrap">
                            {turn.type === "image" && (
                                <>
                                    <button onClick={onEdit} className={cn(
                                        "text-[11px] px-3 py-1 rounded-full cursor-pointer flex items-center gap-1 transition-colors",
                                        isAnchored
                                            ? "bg-[var(--color-action-subtle)] text-fg border border-[var(--color-action-muted)]"
                                            : "hover:bg-surface-2 text-fg-muted hover:text-fg",
                                    )}>
                                        <Wand2 size={11} /> {isAnchored ? "Editando" : "Editar"}
                                    </button>
                                    <button onClick={onUseAsRef} className="text-[11px] px-3 py-1 rounded-full hover:bg-surface-2 text-fg-muted hover:text-fg cursor-pointer flex items-center gap-1">
                                        <Plus size={11} /> Usar como ref
                                    </button>
                                    <button onClick={onAnimate} className="text-[11px] px-3 py-1 rounded-full hover:bg-surface-2 text-fg-muted hover:text-fg cursor-pointer flex items-center gap-1">
                                        <Video size={11} /> Animar
                                    </button>
                                </>
                            )}
                            {turn.type === "video" && (
                                <button onClick={onZoom} className="text-[11px] px-3 py-1 rounded-full hover:bg-surface-2 text-fg-muted hover:text-fg cursor-pointer flex items-center gap-1">
                                    <Eye size={11} /> Ampliar
                                </button>
                            )}
                            <button
                                onClick={onRegenerate}
                                title="Volver a generar con el mismo prompt y referencias (podés ajustarlo antes)"
                                className="text-[11px] px-3 py-1 rounded-full hover:bg-surface-2 text-fg-muted hover:text-fg cursor-pointer flex items-center gap-1"
                            >
                                <RotateCcw size={11} /> Regenerar
                            </button>
                            <button
                                onClick={() => {
                                    const ext = turn.type === "video" ? "mp4" : "png";
                                    const base = downloadBaseName(turn);
                                    forceDownload(turn.outputUrl!, `${base}.${ext}`);
                                }}
                                className="text-[11px] px-3 py-1 rounded-full hover:bg-surface-2 text-fg-muted hover:text-fg cursor-pointer flex items-center gap-1"
                            >
                                <Download size={11} /> Descargar
                            </button>
                            {turn.sentPrompt && turn.sentPrompt !== turn.prompt && (
                                <button
                                    onClick={() => setShowSent((v) => !v)}
                                    className="text-[11px] px-3 py-1 rounded-full hover:bg-surface-2 text-fg-muted hover:text-fg cursor-pointer flex items-center gap-1"
                                    title="Ver el prompt que efectivamente se envió al modelo"
                                >
                                    <Eye size={11} /> {showSent ? "Ocultar prompt" : "Ver prompt usado"}
                                </button>
                            )}
                        </div>
                        {showSent && turn.sentPrompt && (
                            <pre className="text-[11px] text-fg-muted bg-surface-0 border border-edge-subtle rounded-[var(--radius-sm)] p-2 whitespace-pre-wrap font-mono max-w-md overflow-x-auto">
                                {turn.sentPrompt}
                            </pre>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

function Lightbox({ url, type, label, name, onClose }: {
    url: string;
    type: "image" | "video";
    label?: string;
    name?: string;
    onClose: () => void;
}) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-6 cursor-zoom-out"
            onClick={onClose}
        >
            <button
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-surface-1 border border-edge text-fg-muted hover:text-fg cursor-pointer flex items-center justify-center"
                aria-label="Cerrar"
            >
                <X size={18} />
            </button>
            <div className="max-w-[95vw] max-h-[90vh] flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
                {type === "image" ? (
                    <img src={url} alt={label || "preview"} className="max-w-[95vw] max-h-[85vh] object-contain rounded-[var(--radius-md)]" />
                ) : (
                    <video src={url} controls autoPlay className="max-w-[95vw] max-h-[85vh] rounded-[var(--radius-md)]" />
                )}
                <div className="flex items-center gap-2">
                    {label && <span className="text-[12px] text-fg-muted max-w-md truncate">{label}</span>}
                    <button
                        onClick={() => forceDownload(url, `${name || "manual_lab"}.${type === "video" ? "mp4" : "png"}`)}
                        className="text-[11px] px-3 py-1.5 rounded-full bg-surface-1 border border-edge text-fg hover:bg-surface-2 cursor-pointer flex items-center gap-1.5"
                    >
                        <Download size={12} /> Descargar
                    </button>
                </div>
            </div>
        </div>
    );
}

type AssetKind = "avatar" | "product" | "clothing" | "background" | "moodboard" | "lookfeel" | "logo";

const ASSET_TAB_LABELS: Record<AssetKind, string> = {
    avatar: "avatar", product: "producto", clothing: "ropa", background: "fondo",
    moodboard: "moodboard", lookfeel: "look&feel", logo: "logo",
};

function AssetPicker({ brand, onPick, onClose }: {
    brand: NonNullable<ReturnType<typeof useBrand>["activeBrand"]>;
    onPick: (kind: AssetKind, item: { id: string; name: string; imageUrl?: string }) => void;
    onClose: () => void;
}) {
    const [tab, setTab] = useState<AssetKind>("avatar");
    const items: Array<{ id: string; name: string; imageUrl?: string }> =
        tab === "avatar" ? (brand.avatars || []) :
        tab === "product" ? (brand.products || []).map((p) => ({ id: p.id, name: p.name, imageUrl: p.imageUrl })) :
        tab === "clothing" ? (brand.clothing || []) :
        tab === "background" ? (brand.backgrounds || []) :
        tab === "moodboard" ? (brand.moodboards || []) :
        tab === "lookfeel" ? (brand.lookAndFeel || []) :
        // logos: multi-logo array + legacy single-logo merged into one list
        [
            ...(brand.logo?.imageUrl ? [{ id: "__legacy_logo__", name: "Logo", imageUrl: brand.logo.imageUrl }] : []),
            ...((brand.logos || []).map((l) => ({ id: l.id, name: l.name, imageUrl: l.imageUrl }))),
        ];

    const resolver =
        tab === "avatar" ? avatarImageUrl :
        tab === "product" ? productImageUrl :
        tab === "clothing" ? clothingImageUrl :
        tab === "background" ? backgroundImageUrl :
        tab === "moodboard" ? moodboardImageUrl :
        tab === "lookfeel" ? lookAndFeelImageUrl :
        brandLogoImageUrl;

    return (
        <div className="mt-2 mb-2 border border-edge rounded-[var(--radius-md)] bg-surface-1 p-2">
            <div className="flex items-center justify-between mb-2 gap-2">
                <div className="flex gap-1 flex-wrap">
                    {(["avatar", "product", "clothing", "background", "moodboard", "lookfeel", "logo"] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={cn(
                                "text-[11px] px-2 py-1 rounded cursor-pointer",
                                tab === t ? "bg-surface-2 text-fg" : "text-fg-muted hover:bg-surface-2",
                            )}
                        >
                            {ASSET_TAB_LABELS[t]}
                        </button>
                    ))}
                </div>
                <button onClick={onClose} className="text-fg-faint hover:text-fg cursor-pointer shrink-0">
                    <X size={14} />
                </button>
            </div>
            {items.length === 0 ? (
                <p className="text-[11px] text-fg-faint p-3">No hay {ASSET_TAB_LABELS[tab]} en esta marca.</p>
            ) : (
                <div className="grid grid-cols-6 gap-1.5">
                    {items.map((it) => (
                        <AssetTile key={it.id} item={it} resolver={resolver} onPick={() => onPick(tab, it)} />
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * One tile in the AssetPicker grid. Renders the asset image with an `onError` fallback
 * that swaps in a neutral plate + the item's initials when the image fails to load
 * (404, network error, etc.). Keeps the tile clickable so the asset can still be
 * selected even if its preview can't render — the picker writes the imageUrl through
 * to the ref regardless of preview state.
 */
function AssetTile({
    item,
    resolver,
    onPick,
}: {
    item: { id: string; name: string; imageUrl?: string };
    resolver: (u: string) => string;
    onPick: () => void;
}) {
    const [broken, setBroken] = useState(false);
    const initials = (item.name || "?")
        .split(/\s+/)
        .map((w) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase();

    return (
        <button
            onClick={onPick}
            className="cursor-pointer group relative aspect-square overflow-hidden rounded-sm border border-edge-subtle hover:border-edge-strong"
            title={item.name}
        >
            {item.imageUrl && !broken ? (
                <img
                    src={resolver(item.imageUrl)}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    onError={() => setBroken(true)}
                />
            ) : (
                <div className="w-full h-full bg-surface-2 flex flex-col items-center justify-center gap-0.5 text-fg-faint">
                    <span className="text-[14px] font-semibold text-fg-muted">{initials || "?"}</span>
                    <span className="text-[8px] uppercase tracking-wider opacity-60">
                        {item.imageUrl ? "sin preview" : "sin imagen"}
                    </span>
                </div>
            )}
            <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] truncate px-1 py-0.5 opacity-0 group-hover:opacity-100">
                {item.name}
            </span>
        </button>
    );
}

// ── Helpers ──────────────────────────────────────────────

function generationToTurn(g: Generation): ChatTurn {
    const meta = (g.metadata || {}) as Record<string, unknown>;
    const refs = Array.isArray(meta.refs) ? (meta.refs as Array<{ tag: string; label: string; url: string }>) : [];
    const params = (meta.params as Record<string, string>) || {};
    const mode = (meta.mode as Mode) || (g.type === "video" ? "video" : "image");
    return {
        id: g.id,
        role: "result",
        mode,
        status: "completed",
        type: g.type === "copy" ? "image" : g.type,
        outputUrl: g.outputUrl,
        prompt: (meta.prompt as string) || g.title,
        refs,
        params,
    };
}


// ── Lab Gallery — collapsible left drawer with all session outputs ──────────
// Generated images/videos pile up in the chat scroll and get lost. This drawer
// shows them all as a thumbnail grid so you can browse, open, reuse, or animate
// any past output without hunting through the conversation.
function LabGallery({
    turns,
    open,
    onToggle,
    onOpen,
    onUseAsRef,
    onAnimate,
    onDelete,
}: {
    turns: ChatTurn[];
    open: boolean;
    onToggle: () => void;
    onOpen: (t: ChatTurn) => void;
    onUseAsRef: (t: ChatTurn) => void;
    onAnimate: (t: ChatTurn) => void;
    onDelete: (t: ChatTurn) => void;
}) {
    // Newest first — completed outputs with a URL. Variant sets are EXPANDED here so each
    // variant shows as its own thumbnail; otherwise only the first variant would be visible.
    const outputs = turns
        .filter((t) => t.role === "result" && t.status === "completed" && t.type)
        .flatMap((t): ChatTurn[] => {
            if (t.variants && t.variants.length > 1) {
                return t.variants
                    .filter(Boolean)
                    .map((url, i) => ({ ...t, id: `${t.id}_v${i + 1}`, outputUrl: url, variants: undefined }));
            }
            return t.outputUrl ? [t] : [];
        })
        .reverse();

    if (!open) {
        return (
            <div className="shrink-0 border-r border-edge flex flex-col items-center pt-3 w-10">
                <button
                    onClick={onToggle}
                    title="Abrir galería de generaciones"
                    className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface-2 cursor-pointer"
                >
                    <ImageIcon size={15} />
                </button>
                {outputs.length > 0 && (
                    <span className="mt-1 text-[9px] font-bold text-[var(--color-action)]">{outputs.length}</span>
                )}
            </div>
        );
    }

    return (
        <div className="shrink-0 w-56 border-r border-edge flex flex-col min-h-0">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-edge-subtle">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-fg-faint">
                    Galería <span className="text-fg-muted">({outputs.length})</span>
                </span>
                <button
                    onClick={onToggle}
                    title="Colapsar galería"
                    className="w-6 h-6 rounded flex items-center justify-center text-fg-faint hover:text-fg hover:bg-surface-2 cursor-pointer"
                >
                    <ChevronDown size={14} className="rotate-90" />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
                {outputs.length === 0 ? (
                    <p className="text-[10px] text-fg-faint text-center px-2 py-6 leading-relaxed">
                        Tus generaciones van a aparecer acá. Generá una imagen o video para empezar.
                    </p>
                ) : (
                    <div className="grid grid-cols-2 gap-1.5">
                        {outputs.map((t) => (
                            <div key={t.id} className="group relative aspect-square rounded-[var(--radius-sm)] overflow-hidden border border-edge bg-surface-2">
                                {t.type === "video" ? (
                                    <video src={t.outputUrl} muted className="w-full h-full object-cover" />
                                ) : (
                                    <img src={t.outputUrl} alt={t.prompt || ""} className="w-full h-full object-cover" />
                                )}
                                {t.type === "video" && (
                                    <span className="absolute top-1 left-1 bg-black/60 rounded px-1 py-0.5"><Video size={8} className="text-white" /></span>
                                )}
                                {/* Delete — top-right, always reachable on hover */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDelete(t); }}
                                    title="Eliminar"
                                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 hover:bg-error opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer z-10"
                                >
                                    <X size={10} className="text-white" />
                                </button>
                                {/* Hover actions */}
                                <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                                    <button onClick={() => onOpen(t)} title="Ver" className="w-6 h-6 rounded-full bg-white/15 hover:bg-white/30 flex items-center justify-center cursor-pointer"><Eye size={11} className="text-white" /></button>
                                    {t.type === "image" && (
                                        <div className="flex gap-1">
                                            <button onClick={() => onUseAsRef(t)} title="Usar como referencia" className="w-6 h-6 rounded-full bg-white/15 hover:bg-white/30 flex items-center justify-center cursor-pointer"><Plus size={11} className="text-white" /></button>
                                            <button onClick={() => onAnimate(t)} title="Animar" className="w-6 h-6 rounded-full bg-white/15 hover:bg-white/30 flex items-center justify-center cursor-pointer"><Video size={11} className="text-white" /></button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
