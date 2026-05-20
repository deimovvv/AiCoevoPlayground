/**
 * Manual Lab — brand-agnostic sandbox for Nano Banana 2 + Kling V3
 * ─────────────────────────────────────────────────────────────────
 * One-shot generations with chat-style history. References get auto-tagged
 * (image1, image2, ...) and can be inserted as [imageN] in the prompt.
 *
 * No pipeline, no curation, no brand requirement. Optionally pulls assets
 * from the active brand if the user enables the toggle.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { Image as ImageIcon, Video, Plus, X, Send, Sparkles, RefreshCw, Download, AlertCircle, FlaskConical, Wand2, Eye, RotateCcw, ChevronDown } from "lucide-react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { useBrand } from "../lib/BrandContext";
import {
    createImageEdit,
    createTextToImage,
    pollImageGen,
    createKlingVideo,
    createKlingFrameToFrame,
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
    type Generation,
    type ImageModel,
    type KlingModel,
} from "../lib/api";
import { cn } from "../lib/utils";

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
}
const VIDEO_MODELS: VideoModelDef[] = [
    { id: "v3-pro",     label: "Kling V3 Pro",       tier: "best quality",  provider: "kling",    modes: ["i2v", "f2f"], supportsAudio: false },
    { id: "v2-6-pro",   label: "Kling V2.6 Pro",     tier: "balanced",      provider: "kling",    modes: ["i2v", "f2f"], supportsAudio: false },
    { id: "v2-6-std",   label: "Kling V2.6 Std",     tier: "cheaper",       provider: "kling",    modes: ["i2v", "f2f"], supportsAudio: false },
    { id: "v2-5-turbo", label: "Kling V2.5 Turbo",   tier: "fastest",       provider: "kling",    modes: ["i2v", "f2f"], supportsAudio: false },
    { id: "seedance-2", label: "Seedance 2.0",       tier: "multi-ref + audio lipsync", provider: "seedance", modes: ["rtv"], supportsAudio: true },
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
}

const IMG_ASPECT_RATIOS = ["9:16", "1:1", "16:9", "4:5", "3:4"] as const;
const IMG_RESOLUTIONS = ["1K", "2K"] as const;
const VID_DURATIONS = ["5", "10"] as const;

function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Read failed"));
        reader.readAsDataURL(file);
    });
}

/**
 * Force-download a remote file via the backend proxy.
 *
 * Why a proxy: browsers ignore <a download> on cross-origin URLs that don't
 * send `Content-Disposition: attachment`, and a JS fetch() is blocked by CORS
 * (Fal CDN doesn't allow-origin our app). The backend proxies the file with
 * the right headers, so the browser downloads cleanly.
 */
function forceDownload(url: string, filename: string) {
    const proxyUrl = `http://localhost:8000/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
    const a = document.createElement("a");
    a.href = proxyUrl;
    // download attr is honored on same-origin (the proxy is our backend).
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function buildPromptWithRefs(rawPrompt: string, refs: RefImage[]): string {
    if (refs.length === 0) return rawPrompt;
    const refLines = refs.map((r, i) => `Image ${i + 1}: ${r.label || r.tag}`).join("\n");
    // Replace [imageN] tokens with "Image N" so the model knows which ref the user means
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
    const [busy, setBusy] = useState(false);
    const [suggestion, setSuggestion] = useState<{ tool_id: string; reason: string } | null>(null);
    const [showAssetPicker, setShowAssetPicker] = useState(false);

    // Image params
    const [imgAspectRatio, setImgAspectRatio] = useState<typeof IMG_ASPECT_RATIOS[number]>("9:16");
    const [imgResolution, setImgResolution] = useState<typeof IMG_RESOLUTIONS[number]>("2K");
    const [imgModel, setImgModel] = useState<ImageModel>("nano-banana-2");
    // Video params
    const [vidDuration, setVidDuration] = useState<typeof VID_DURATIONS[number]>("5");
    const [videoModel, setVideoModel] = useState<VideoModelId>("v3-pro");
    const [videoMode, setVideoMode] = useState<VideoMode>("i2v");

    // Derived: the model def + its supported modes. Drives mode filtering and audio UI.
    const currentVideoModel = VIDEO_MODELS.find((m) => m.id === videoModel) || VIDEO_MODELS[0];
    // Auto-sync mode when model changes (e.g. picking Seedance from a Kling state forces "rtv")
    useEffect(() => {
        if (!currentVideoModel.modes.includes(videoMode)) {
            setVideoMode(currentVideoModel.modes[0]);
        }
    }, [videoModel, currentVideoModel, videoMode]);

    // Prompt preview / manual override
    const [showPreview, setShowPreview] = useState(false);
    const [manualPrompt, setManualPrompt] = useState<string | null>(null);  // non-null = user took over

    // Auto-enhance is always ON: Gemini Vision rewrites the prompt before sending,
    // unless the user explicitly edited the preview (manualPrompt !== null).
    const [enhancing, setEnhancing] = useState(false);
    const [busyLabel, setBusyLabel] = useState<string>("Generando...");

    // @ mention popover
    const [mention, setMention] = useState<{ open: boolean; query: string; anchorTop: number; anchorLeft: number; activeIdx: number }>({
        open: false, query: "", anchorTop: 0, anchorLeft: 0, activeIdx: 0,
    });

    // Lightbox (click-to-zoom for any image/video)
    const [lightbox, setLightbox] = useState<{ url: string; type: "image" | "video"; label?: string } | null>(null);

    // "Scroll to bottom" floating button — appears when user has scrolled up to
    // browse history. Hidden when at/near the bottom.
    const [showScrollDown, setShowScrollDown] = useState(false);

    // Edit-anchor mode: when set, this ref becomes the implicit image1 of the next gen
    const anchorRef = refs.find((r) => r.isAnchor) ?? null;

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const audioInputRef = useRef<HTMLInputElement | null>(null);

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

    // Replace the current "@query" segment with [imageN]
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
    useEffect(() => {
        fetchManualGenerations().then((gens) => {
            const past = gens.slice(0, 30).reverse().map((g) => generationToTurn(g));
            setTurns(past);
        }).catch(() => { /* empty history */ });
    }, []);

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
                newRefs.push({
                    tag: `image${counter}`,
                    label: file.name.replace(/\.[^.]+$/, ""),
                    url,
                    source: "upload",
                    file,
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
        kind: "avatar" | "product" | "clothing" | "background",
        item: { id: string; name: string; imageUrl?: string },
    ) => {
        if (!item.imageUrl) return;
        const resolver =
            kind === "avatar" ? avatarImageUrl :
            kind === "product" ? productImageUrl :
            kind === "clothing" ? clothingImageUrl :
            backgroundImageUrl;
        const fullUrl = resolver(item.imageUrl);
        setRefs((prev) => [
            ...prev,
            {
                tag: `image${prev.length + 1}`,
                label: `${kind}: ${item.name}`,
                url: fullUrl,
                source: "asset",
                assetType: kind,
            },
        ]);
        setShowAssetPicker(false);
    };

    const removeRef = (tag: string) => {
        setRefs((prev) => {
            const filtered = prev.filter((r) => r.tag !== tag);
            // Re-number sequentially, anchor (if any) stays at image1
            const anchor = filtered.find((r) => r.isAnchor);
            const rest = filtered.filter((r) => !r.isAnchor);
            const ordered = anchor ? [anchor, ...rest] : rest;
            return ordered.map((r, i) => ({ ...r, tag: `image${i + 1}` }));
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
                tag: `image${prev.length + 1}`,
                label: `result ${turn.id.slice(-4)}`,
                url: turn.outputUrl!,
                source: "result",
            },
        ]);
    };

    // Enter "edit anchor" mode — the result becomes image1, other refs shift down.
    // If there's already an anchor, replace it (don't accumulate).
    const editResult = (turn: ChatTurn) => {
        if (!turn.outputUrl || turn.type !== "image") return;
        const newAnchor: RefImage = {
            tag: "image1",
            label: `editando: result ${turn.id.slice(-4)}`,
            url: turn.outputUrl,
            source: "anchor",
            isAnchor: true,
        };
        setRefs((prev) => {
            const withoutAnchor = prev.filter((r) => !r.isAnchor);
            return [newAnchor, ...withoutAnchor].map((r, i) => ({ ...r, tag: `image${i + 1}` }));
        });
        promptRef.current?.focus();
    };

    const clearAnchor = () => {
        setRefs((prev) => prev.filter((r) => !r.isAnchor).map((r, i) => ({ ...r, tag: `image${i + 1}` })));
    };

    const animateResult = (turn: ChatTurn) => {
        if (!turn.outputUrl || turn.type !== "image") return;
        setMode("video");
        setRefs([{
            tag: "image1",
            label: `previous result`,
            url: turn.outputUrl,
            source: "result",
        }]);
        setPrompt("Subtle natural motion, cinematic.");
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
                brandId: useBrandAssets && activeBrand ? activeBrand.id : null,
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
        if (!prompt.trim() || busy) return;
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
        const submittedRefs = [...refs];
        setBusy(true);
        setSuggestion(null);

        try {
            // Build the prompt that will actually go to the model:
            //   1. If user took over the preview → send their text literal
            //   2. Else if auto-enhance ON → call Gemini Vision to rewrite
            //   3. Else → assemble manually (REFERENCE IMAGES: + Image N substitution)
            let fullPrompt: string;
            if (manualPrompt !== null) {
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
                const job = refUrls.length > 0
                    ? await createImageEdit(refUrls, fullPrompt, imgAspectRatio, imgResolution, imgModel)
                    : await createTextToImage(fullPrompt, imgAspectRatio, imgResolution, imgModel);
                const result = await pollImageGen(job.request_id);
                if (result.status === "failed" || !result.image_url) throw new Error(result.error || "Image generation failed");

                const finalTurn: ChatTurn = {
                    ...pendingResult,
                    status: "completed",
                    type: "image",
                    outputUrl: result.image_url,
                    prompt: submittedPrompt,
                    sentPrompt: fullPrompt,
                    refs: userTurn.refs,
                    params: userTurn.params,
                };
                setTurns((t) => t.map((x) => (x.id === pendingResult.id ? finalTurn : x)));
                await persist(finalTurn);
            } else {
                // Video: dispatch by mode
                //   - i2v (Kling): single image as start frame
                //   - f2f (Kling): start + end frame
                //   - rtv (Seedance 2.0): all refs as visual guides, no fixed frame role
                const startUrl = submittedRefs[0]?.url;
                if (!startUrl) throw new Error("No image to animate.");

                let result: { status: string; video_url?: string | null; error?: string | null };

                if (videoMode === "rtv") {
                    if (submittedRefs.length < 1) throw new Error("Reference-to-video necesita al menos 1 referencia.");
                    const job = await createSeedanceReferenceToVideo({
                        prompt: fullPrompt,
                        referenceImageUrls: submittedRefs.map((r) => r.url),
                        duration: vidDuration,
                        audioUrls: audioRefs.length > 0 ? audioRefs.map((a) => a.dataUrl) : undefined,
                    });
                    if (job.video_url) {
                        result = { status: "completed", video_url: job.video_url };
                    } else {
                        result = await pollSeedanceVideo(job.request_id);
                    }
                } else if (videoMode === "f2f") {
                    if (submittedRefs.length < 2) throw new Error("Frame-to-frame necesita al menos 2 referencias (start + end).");
                    const endUrl = submittedRefs[submittedRefs.length - 1].url;
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
                };
                setTurns((t) => t.map((x) => (x.id === pendingResult.id ? finalTurn : x)));
                await persist(finalTurn);
            }

            setPrompt("");
            setManualPrompt(null);
            setShowPreview(false);
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Unknown error";
            setTurns((t) => t.map((x) => (x.id === pendingResult.id ? { ...x, status: "failed", error: msg } : x)));
        } finally {
            setBusy(false);
            setBusyLabel("Generando...");
        }
    };

    /** Manually expand the current prompt via Gemini Vision and put it into the editable preview. */
    const enhanceNow = async () => {
        if (!prompt.trim() || enhancing) return;
        setEnhancing(true);
        try {
            const { enhanced } = await enhanceManualPrompt({
                prompt,
                refs: refs.map((r) => ({ tag: r.tag, label: r.label, url: r.url })),
                mode,
                targetModel: imgModel,
            });
            if (enhanced) {
                setManualPrompt(enhanced);
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
                    <FlaskConical size={18} className="text-[var(--color-warm)]" />
                    <div>
                        <h1 className="text-[15px] font-semibold text-fg">Manual Lab</h1>
                        <p className="text-[11px] text-fg-faint">
                            {useBrandAssets && activeBrand
                                ? `Usando assets de ${activeBrand.name}`
                                : "Generación libre · Nano Banana 2 · Kling V3 Pro"}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
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
                    {/* Mode toggle */}
                    <div className="flex border border-edge rounded-full overflow-hidden p-0.5 bg-surface-1">
                        <button
                            onClick={() => setMode("image")}
                            className={cn(
                                "px-3.5 py-1 text-[12px] flex items-center gap-1.5 cursor-pointer transition-colors rounded-full",
                                mode === "image" ? "bg-[var(--color-warm-subtle)] text-fg" : "text-fg-muted hover:text-fg",
                            )}
                        >
                            <ImageIcon size={13} /> Image
                        </button>
                        <button
                            onClick={() => setMode("video")}
                            className={cn(
                                "px-3.5 py-1 text-[12px] flex items-center gap-1.5 cursor-pointer transition-colors rounded-full",
                                mode === "video" ? "bg-[var(--color-warm-subtle)] text-fg" : "text-fg-muted hover:text-fg",
                            )}
                        >
                            <Video size={13} /> Video
                        </button>
                    </div>
                </div>
            </div>

            {/* Chat history (with floating "scroll to bottom" button) */}
            <div className="flex-1 relative min-h-0">
            <div ref={scrollRef} onScroll={onChatScroll} className="absolute inset-0 overflow-y-auto px-6 py-4 space-y-4">
                {turns.length === 0 ? (
                    <EmptyState mode={mode} />
                ) : (
                    turns.map((t) => (
                        <TurnBubble
                            key={t.id}
                            turn={t}
                            isAnchored={!!(anchorRef && t.outputUrl === anchorRef.url)}
                            busyLabel={busyLabel}
                            onEdit={() => editResult(t)}
                            onUseAsRef={() => useResultAsRef(t)}
                            onAnimate={() => animateResult(t)}
                            onZoom={() => {
                                if (!t.outputUrl || !t.type) return;
                                setLightbox({ url: t.outputUrl, type: t.type, label: t.prompt });
                            }}
                            onZoomRef={(url, label) => setLightbox({ url, type: "image", label })}
                        />
                    ))
                )}
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

            {/* Suggestion banner */}
            {suggestion && (
                <div className="mx-6 mb-2 flex items-center justify-between gap-3 px-4 py-2 bg-[var(--color-warm-subtle)] border border-[var(--color-warm-muted)] rounded-full">
                    <div className="flex items-center gap-2 text-[12px] text-fg">
                        <Sparkles size={13} className="text-[var(--color-warm)]" />
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

            {/* References row */}
            <div className="px-6 pt-2 border-t border-edge-subtle">
                <div className="flex items-center gap-2 flex-wrap">
                    {refs.map((r) => (
                        <RefChip
                            key={r.tag}
                            ref_={r}
                            onRemove={() => removeRef(r.tag)}
                            onInsert={() => insertRefToken(r.tag)}
                            onZoom={() => setLightbox({ url: r.url, type: "image", label: r.label })}
                        />
                    ))}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1 px-3 py-1.5 text-[11px] border border-dashed border-edge rounded-full text-fg-muted hover:text-fg hover:border-edge-strong cursor-pointer"
                        title="Subir imagen"
                    >
                        <Plus size={12} /> Subir
                    </button>
                    {useBrandAssets && activeBrand && (
                        <button
                            onClick={() => setShowAssetPicker((v) => !v)}
                            className="flex items-center gap-1 px-3 py-1.5 text-[11px] border border-dashed border-edge rounded-full text-fg-muted hover:text-fg hover:border-edge-strong cursor-pointer"
                        >
                            <Plus size={12} /> Asset
                        </button>
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
                            Tipeá <code className="px-1 rounded bg-surface-1">@</code> en el prompt para insertar referencias
                        </span>
                    )}
                </div>

                {/* Audio refs chips (Seedance rtv only) */}
                {mode === "video" && videoMode === "rtv" && audioRefs.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                        {audioRefs.map((a) => (
                            <div key={a.id} className="flex items-center gap-2 pl-2 pr-1 py-1 bg-surface-1 border border-edge rounded-full text-[11px]">
                                <span className="text-[var(--color-warm)]">🎵</span>
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
                {showAssetPicker && useBrandAssets && activeBrand && (
                    <AssetPicker brand={activeBrand} onPick={addAssetRef} onClose={() => setShowAssetPicker(false)} />
                )}
            </div>

            {/* Composer */}
            <div className="px-6 py-3 border-t border-edge bg-surface-0">
                <div className="space-y-2">
                    {/* Anchor chip — "editing this image" mode */}
                    {anchorRef && (
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-full bg-[var(--color-warm-subtle)] border border-[var(--color-warm-muted)] w-fit max-w-full">
                            <button
                                onClick={() => setLightbox({ url: anchorRef.url, type: "image", label: anchorRef.label })}
                                className="cursor-pointer"
                                title="Ver imagen"
                            >
                                <img src={anchorRef.url} alt="anchor" className="w-7 h-7 object-cover rounded-full" />
                            </button>
                            <div className="flex flex-col leading-tight min-w-0">
                                <span className="text-[10px] text-[var(--color-warm)] font-medium uppercase tracking-wide">Editando</span>
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
                        <div className="rounded-[var(--radius-md)] border border-[var(--color-warm-muted)] bg-[var(--color-warm-subtle)]/30 p-2.5 space-y-1.5">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] text-fg-muted flex items-center gap-1.5">
                                    <Eye size={11} /> Prompt final {manualPrompt !== null && <span className="text-[var(--color-warm)]">· editado manualmente</span>}
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
                            <textarea
                                value={manualPrompt ?? assembledPreview}
                                onChange={(e) => setManualPrompt(e.target.value)}
                                placeholder={assembledPreview}
                                rows={6}
                                className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2 py-1.5 text-[12px] font-mono text-fg resize-y focus:outline-none focus:border-[var(--color-edge-focus)]"
                            />
                            <p className="text-[10px] text-fg-faint">
                                {manualPrompt !== null
                                    ? "Se enviará tu texto literal — los [imageN] no se expandirán."
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
                            }}
                            placeholder={
                                mode === "image"
                                    ? `Describe la imagen. Tipeá @ para referenciar imágenes adjuntas.`
                                    : `Describe el movimiento. La primera referencia se anima como frame de inicio.`
                            }
                            rows={2}
                            className="resize-none text-[13px] rounded-[var(--radius-md)] px-3.5"
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
                                    {refs.length > 0 && (
                                        <span className={cn("text-[10px]", currentModelInfo.resHonored ? "text-[var(--color-warm)]" : "text-fg-faint")}>
                                            · {currentModelInfo.note}
                                        </span>
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
                                    showPreview ? "bg-[var(--color-warm-subtle)] border-[var(--color-warm-muted)] text-fg" : "border-edge text-fg-muted hover:text-fg hover:bg-surface-1",
                                )}
                                title="Ver el prompt mejorado por Gemini (editable)"
                            >
                                {enhancing ? <RefreshCw size={11} className="animate-spin" /> : <Sparkles size={11} />}
                                Prompt
                            </button>
                            <Button onClick={submit} disabled={busy || !prompt.trim()} size="sm" className="rounded-full px-4">
                                {busy ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                                <span className="ml-1.5">{busy ? busyLabel : "Generar"}</span>
                            </Button>
                        </div>
                    </div>
                </div>
                <p className="text-[10px] text-fg-faint mt-2">⌘+Enter enviar · @ referencia · Gemini Vision optimiza el prompt automáticamente. ✨ Prompt para verlo/editarlo.</p>
            </div>

            {/* Lightbox overlay */}
            {lightbox && (
                <Lightbox
                    url={lightbox.url}
                    type={lightbox.type}
                    label={lightbox.label}
                    onClose={() => setLightbox(null)}
                />
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
                        i === activeIdx ? "bg-[var(--color-warm-subtle)]" : "hover:bg-surface-2",
                    )}
                >
                    {r.url
                        ? <img src={r.url} alt={r.label} className="w-7 h-7 object-cover rounded-sm shrink-0" />
                        : <div className="w-7 h-7 bg-surface-2 rounded-sm shrink-0" />}
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                            <code className="text-[11px] text-[var(--color-warm)]">[{r.tag}]</code>
                            <span className="text-[11px] text-fg truncate">{r.label}</span>
                        </div>
                        <div className="text-[9px] text-fg-faint">{r.source}</div>
                    </div>
                </button>
            ))}
        </div>
    );
}

function RefChip({ ref_, onRemove, onInsert, onZoom }: { ref_: RefImage; onRemove: () => void; onInsert: () => void; onZoom: () => void }) {
    const isAnchor = ref_.isAnchor;
    return (
        <div className={cn(
            "group relative flex items-center gap-2 pl-1 pr-2 py-1 rounded-full text-[11px] transition-all",
            isAnchor
                ? "bg-[var(--color-warm-subtle)] border border-[var(--color-warm-muted)]"
                : "bg-surface-1 border border-edge hover:border-edge-strong",
        )}>
            <button
                onClick={onZoom}
                className="cursor-zoom-in shrink-0 transition-transform hover:scale-110"
                title="Ver imagen en grande"
            >
                <img src={ref_.url} alt={ref_.label} className="w-9 h-9 object-cover rounded-full" />
            </button>
            <button onClick={onInsert} className="text-fg cursor-pointer flex items-center gap-1.5" title="Insertar tag en el prompt">
                <code className={cn(isAnchor ? "text-[var(--color-warm-strong)]" : "text-[var(--color-warm)]")}>[{ref_.tag}]</code>
                <span className="text-fg-faint">{ref_.label.slice(0, 18)}{ref_.label.length > 18 ? "…" : ""}</span>
            </button>
            <button onClick={onRemove} className="text-fg-faint hover:text-error cursor-pointer ml-1 w-4 h-4 rounded-full flex items-center justify-center hover:bg-surface-2">
                <X size={11} />
            </button>
        </div>
    );
}

function EmptyState({ mode }: { mode: Mode }) {
    return (
        <div className="h-full flex flex-col items-center justify-center text-center py-12">
            <div className="w-12 h-12 rounded-full bg-[var(--color-warm-subtle)] flex items-center justify-center mb-3">
                <Wand2 size={20} className="text-[var(--color-warm)]" />
            </div>
            <p className="text-[14px] text-fg font-medium">Generá libremente</p>
            <p className="text-[12px] text-fg-muted max-w-md mt-1">
                {mode === "image"
                    ? "Subí imágenes como referencia, taggeá con [image1], [image2] en el prompt y generá con Nano Banana 2."
                    : "Subí una imagen como frame inicial, describí el movimiento y generá con Kling V3 Pro."}
            </p>
        </div>
    );
}

function TurnBubble({ turn, isAnchored, busyLabel, onEdit, onUseAsRef, onAnimate, onZoom, onZoomRef }: {
    turn: ChatTurn;
    isAnchored: boolean;
    busyLabel: string;
    onEdit: () => void;
    onUseAsRef: () => void;
    onAnimate: () => void;
    onZoom: () => void;
    onZoomRef: (url: string, label: string) => void;
}) {
    const [showSent, setShowSent] = useState(false);
    if (turn.role === "user") {
        return (
            <div className="flex justify-end">
                <div className="max-w-[80%] bg-[var(--color-warm-subtle)] border border-[var(--color-warm-muted)] rounded-[var(--radius-lg)] px-3 py-2 space-y-1.5">
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
                                    <code className="text-[var(--color-warm)]">[{r.tag}]</code>
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
                isAnchored ? "border-[var(--color-warm-muted)] ring-1 ring-[var(--color-warm-muted)]" : "border-edge",
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
                        {turn.type === "image" ? (
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
                                            ? "bg-[var(--color-warm-subtle)] text-fg border border-[var(--color-warm-muted)]"
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
                                onClick={() => {
                                    const ext = turn.type === "video" ? "mp4" : "png";
                                    forceDownload(turn.outputUrl!, `manual_lab_${turn.id.slice(-6)}.${ext}`);
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

function Lightbox({ url, type, label, onClose }: {
    url: string;
    type: "image" | "video";
    label?: string;
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
                        onClick={() => forceDownload(url, `manual_lab.${type === "video" ? "mp4" : "png"}`)}
                        className="text-[11px] px-3 py-1.5 rounded-full bg-surface-1 border border-edge text-fg hover:bg-surface-2 cursor-pointer flex items-center gap-1.5"
                    >
                        <Download size={12} /> Descargar
                    </button>
                </div>
            </div>
        </div>
    );
}

function AssetPicker({ brand, onPick, onClose }: {
    brand: NonNullable<ReturnType<typeof useBrand>["activeBrand"]>;
    onPick: (kind: "avatar" | "product" | "clothing" | "background", item: { id: string; name: string; imageUrl?: string }) => void;
    onClose: () => void;
}) {
    const [tab, setTab] = useState<"avatar" | "product" | "clothing" | "background">("avatar");
    const items: Array<{ id: string; name: string; imageUrl?: string }> =
        tab === "avatar" ? (brand.avatars || []) :
        tab === "product" ? (brand.products || []).map((p) => ({ id: p.id, name: p.name, imageUrl: p.imageUrl })) :
        tab === "clothing" ? (brand.clothing || []) :
        (brand.backgrounds || []);

    const resolver =
        tab === "avatar" ? avatarImageUrl :
        tab === "product" ? productImageUrl :
        tab === "clothing" ? clothingImageUrl :
        backgroundImageUrl;

    return (
        <div className="mt-2 mb-2 border border-edge rounded-[var(--radius-md)] bg-surface-1 p-2">
            <div className="flex items-center justify-between mb-2">
                <div className="flex gap-1">
                    {(["avatar", "product", "clothing", "background"] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={cn(
                                "text-[11px] px-2 py-1 rounded cursor-pointer",
                                tab === t ? "bg-surface-2 text-fg" : "text-fg-muted hover:bg-surface-2",
                            )}
                        >
                            {t}
                        </button>
                    ))}
                </div>
                <button onClick={onClose} className="text-fg-faint hover:text-fg cursor-pointer">
                    <X size={14} />
                </button>
            </div>
            {items.length === 0 ? (
                <p className="text-[11px] text-fg-faint p-3">No hay {tab}s en esta marca.</p>
            ) : (
                <div className="grid grid-cols-6 gap-1.5">
                    {items.map((it) => (
                        <button
                            key={it.id}
                            onClick={() => onPick(tab, it)}
                            className="cursor-pointer group relative aspect-square overflow-hidden rounded-sm border border-edge-subtle hover:border-edge-strong"
                            title={it.name}
                        >
                            {it.imageUrl ? (
                                <img src={resolver(it.imageUrl)} alt={it.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-surface-2" />
                            )}
                            <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] truncate px-1 py-0.5 opacity-0 group-hover:opacity-100">
                                {it.name}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
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

