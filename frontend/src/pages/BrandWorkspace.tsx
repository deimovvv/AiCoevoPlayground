import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import {
    ArrowLeft, Play, Download, AlertCircle,
    CheckCircle2, Clock, X, Upload, Sparkles, Image, Eye, Search,
    SplitSquareHorizontal, Mic, Video, Film, Loader2, Circle,
    ChevronDown, ChevronUp, Headphones, RotateCcw, ThumbsUp,
    Trash2, UserCircle, RotateCw, FileText, Wand2, Save, ChevronRight,
} from "lucide-react";
import {
    generateTTS, createLipSync, pollVideoStatus, uploadTalkingPhoto,
    fetchBrand, updateBrand, uploadAvatar, deleteAvatar, retryAvatarHeygen, avatarImageUrl,
    generateCopy, addHeygenAvatar, createFalLipSync, pollFalLipSync,
    createKlingVideo, pollKlingVideo,
    createImageEdit, pollImageGen,
    uploadProduct, deleteProduct, productImageUrl,
    type Brand, type TalkingPhoto
} from "../lib/api";
import { downloadFile } from "../lib/download";
import { HeygenAvatarSelector } from "../components/HeygenAvatarSelector";
import { GenerationBoard, MOCK_GENERATIONS } from "../components/GenerationBoard";
import { type Generation } from "../components/GenerationCard";
import { NewGenerationWizard } from "../components/NewGenerationWizard";
import { PipelineMonitor, type WizardLaunchResult } from "../components/PipelineMonitor";

const MOCK_SCRIPT = "Are you looking for everyday t-shirts? Taller Santa Clara has the best fit for your daily routine. Our organic cotton feels incredible on your skin.";

function splitIntoSegments(text: string, parts: number): string[] {
    if (parts <= 1) return [text];

    // Build sentence list — match sentences ending in .!? AND capture leftovers
    const sentenceMatches = text.match(/[^.!?]+[.!?]+/g) || [];

    // Check for trailing text without punctuation
    const matched = sentenceMatches.join("");
    const leftover = text.slice(matched.length).trim();
    const sentences = [...sentenceMatches];
    if (leftover) sentences.push(leftover);

    if (sentences.length >= parts) {
        // Enough sentences → distribute evenly
        const result: string[] = [];
        const per = Math.ceil(sentences.length / parts);
        for (let i = 0; i < parts; i++) {
            const chunk = sentences.slice(i * per, (i + 1) * per).join("").trim();
            if (chunk) result.push(chunk);
        }
        return result;
    }

    // Not enough sentences → fall back to word-level split
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length < parts) return [text]; // too short to split

    const result: string[] = [];
    const perPart = Math.ceil(words.length / parts);
    for (let i = 0; i < parts; i++) {
        const chunk = words.slice(i * perPart, (i + 1) * perPart).join(" ");
        if (chunk) result.push(chunk);
    }
    return result;
}

// --- Pipeline types ---
type StepStatus = "idle" | "running" | "done" | "review" | "error";
interface PipelineStep {
    id: string;
    label: string;
    desc: string;
    icon: React.ReactNode;
    status: StepStatus;
    duration?: number;
    errorMsg?: string;
}

// --- Pipeline hook (real TTS + HeyGen/Fabric lip sync) ---
type LipSyncEngine = "heygen" | "fabric";

/** Per-segment scene configuration for image generation */
interface SceneConfig {
    prompt: string;
    productFile?: File | null;   // product image reference
    backgroundFile?: File | null; // background/environment reference
    productPreview?: string;     // data URL preview
    backgroundPreview?: string;  // data URL preview
    klingDuration: "5" | "10";
}

interface PipelineConfig {
    scriptText: string;
    voiceId: string;
    clipCount: number;
    imageMode: "upload" | "generate";
    talkingPhotoIds: string[]; // one per segment (HeyGen)
    uploadedFile?: File | null;
    lipsyncEngine: LipSyncEngine;
    avatarImageFullUrl?: string;
    klingDuration: "5" | "10"; // fallback if no scenes
    // Image generation
    enableImageGen?: boolean;
    scenes?: SceneConfig[]; // one per segment
}

function usePipeline() {
    const [steps, setSteps] = useState<PipelineStep[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [cur, setCur] = useState(-1);
    const [paused, setPaused] = useState(false);
    const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
    const [audioBlobs, setAudioBlobs] = useState<Record<string, Blob>>({});
    const [audioDurations, setAudioDurations] = useState<Record<string, number>>({}); // seconds per audio step
    const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});
    const [klingVideoUrl, setKlingVideoUrl] = useState<string | null>(null);
    const klingVideoUrlRef = useRef<string | null>(null); // ref to avoid stale closure
    const [generatedImageUrls, setGeneratedImageUrls] = useState<Record<string, string>>({}); // per segment
    const [klingVideoUrls, setKlingVideoUrls] = useState<Record<string, string>>({}); // per segment
    const klingVideoUrlsRef = useRef<Record<string, string>>({}); // ref to avoid stale closure
    const [error, setError] = useState<string | null>(null);
    const configRef = useRef<PipelineConfig | null>(null);

    const buildSteps = useCallback((config: PipelineConfig): PipelineStep[] => {
        const { clipCount: clips } = config;
        const s: PipelineStep[] = [];

        // 1. Split (only if multi-segment)
        if (clips > 1) s.push({ id: "split", label: "Script Splitting", desc: `Splitting into ${clips} segments`, icon: <SplitSquareHorizontal size={16} />, status: "idle" });

        // 2. Audio + QA per segment
        for (let i = 1; i <= clips; i++) {
            s.push({ id: `audio-${i}`, label: clips > 1 ? `Audio — Seg ${i}` : "Voice Generation", desc: "ElevenLabs — generating voiceover", icon: <Mic size={16} />, status: "idle" });
            s.push({ id: `qa-audio-${i}`, label: clips > 1 ? `QA Audio — Seg ${i}` : "Audio Review", desc: "Listen and approve before continuing", icon: <Headphones size={16} />, status: "idle" });
        }

        // 3. Image gen + QA PER SEGMENT (when enabled)
        if (config.enableImageGen) {
            for (let i = 1; i <= clips; i++) {
                s.push({ id: `image-gen-${i}`, label: clips > 1 ? `Image Gen — Seg ${i}` : "Image Generation", desc: "Nano Banana 2 — compositing scene", icon: <Wand2 size={16} />, status: "idle" });
                s.push({ id: `qa-image-gen-${i}`, label: clips > 1 ? `Image QA — Seg ${i}` : "Image Review", desc: "Review the generated image", icon: <Eye size={16} />, status: "idle" });
            }
        }

        // 4. Multishot AI Curating (Morfeo Engine)
        if (config.lipsyncEngine === "fabric") {
            for (let i = 1; i <= clips; i++) {
                s.push({ id: `multishot-${i}`, label: clips > 1 ? `Multishot Gen — Seg ${i}` : "Multishot Generation", desc: "Generating 3 scene options", icon: <Image size={16} />, status: "idle" });
                s.push({ id: `qa-curate-${i}`, label: clips > 1 ? `AI Curating — Seg ${i}` : "Vision AI Review", desc: "Gemini Vision selects the best base shot", icon: <Sparkles size={16} />, status: "idle" });
            }
        }

        // 5. Lip Sync per segment
        const engineName = config.lipsyncEngine === "fabric" ? "Fabric 1.0" : "HeyGen";
        for (let i = 1; i <= clips; i++) {
            s.push({ id: `lip-${i}`, label: clips > 1 ? `Lip Sync — Seg ${i}` : "Lip Sync Video", desc: `${engineName} — static image + audio animation`, icon: <Video size={16} />, status: "idle" });
        }

        // 6. Final Render
        s.push({ id: "render", label: "Final Render", desc: clips > 1 ? "FFmpeg — stitching clips into 9:16" : "FFmpeg — exporting 9:16 video", icon: <Film size={16} />, status: "idle" });
        return s;
    }, []);

    const start = useCallback((config: PipelineConfig) => {
        configRef.current = config;
        setAudioUrls({});
        setAudioBlobs({});
        setAudioDurations({});
        setVideoUrls({});
        setError(null);
        setSteps(buildSteps(config));
        setCur(0);
        setIsRunning(true);
        setPaused(false);
    }, [buildSteps]);

    const reset = useCallback(() => {
        Object.values(audioUrls).forEach((u) => URL.revokeObjectURL(u));
        setAudioUrls({});
        setAudioBlobs({});
        setAudioDurations({});
        setVideoUrls({});
        setKlingVideoUrl(null);
        klingVideoUrlRef.current = null;
        setGeneratedImageUrls({});
        setKlingVideoUrls({});
        klingVideoUrlsRef.current = {};
        setError(null);
        setSteps([]);
        setCur(-1);
        setIsRunning(false);
        setPaused(false);
        configRef.current = null;
        executingStepRef.current = -1;
    }, [audioUrls]);

    const approve = useCallback(() => {
        executingStepRef.current = -1;
        setSteps((p) => p.map((s, i) => (i === cur ? { ...s, status: "done" } : s)));
        setPaused(false);
        if (cur + 1 < steps.length) setCur((c) => c + 1);
        else setIsRunning(false);
    }, [cur, steps.length]);

    const regenerate = useCallback(() => {
        if (cur > 0) {
            executingStepRef.current = -1;
            // Revoke old audio for this segment
            const audioStepId = steps[cur - 1]?.id;
            if (audioStepId && audioUrls[audioStepId]) {
                URL.revokeObjectURL(audioUrls[audioStepId]);
                setAudioUrls((prev) => {
                    const copy = { ...prev };
                    delete copy[audioStepId];
                    return copy;
                });
            }
            setSteps((p) => p.map((s, i) => {
                if (i === cur) return { ...s, status: "idle" };
                if (i === cur - 1) return { ...s, status: "idle", duration: undefined };
                return s;
            }));
            setCur(cur - 1);
            setPaused(false);
        }
    }, [cur, steps, audioUrls]);

    const executingStepRef = useRef<number>(-1);

    useEffect(() => {
        if (!isRunning || cur < 0 || cur >= steps.length || paused) return;

        const step = steps[cur];
        const config = configRef.current;

        // If this is a QA step, pause for review
        if (step?.id.startsWith("qa-")) {
            setSteps((p) => p.map((s, i) => (i === cur ? { ...s, status: "review" } : s)));
            setPaused(true);
            return;
        }

        // Prevent double-execution: skip if step already started/finished or same index is executing
        if (step?.status === "done" || step?.status === "error" || step?.status === "running") return;
        if (executingStepRef.current === cur) return;
        executingStepRef.current = cur;

        // Mark as running
        setSteps((p) => p.map((s, i) => (i === cur ? { ...s, status: "running" } : s)));

        // ── REAL TTS for audio steps ──
        if (step?.id.startsWith("audio-") && config) {
            const segIndex = parseInt(step.id.split("-")[1]) - 1;
            const segments = splitIntoSegments(config.scriptText, config.clipCount);
            const segmentText = segments[segIndex] || config.scriptText;

            const startTime = Date.now();

            generateTTS({
                text: segmentText,
                voice_id: config.voiceId || undefined,
            })
                .then(async ({ audioUrl, audioBlob }) => {
                    const elapsed = (Date.now() - startTime) / 1000;
                    setAudioUrls((prev) => ({ ...prev, [step.id]: audioUrl }));
                    setAudioBlobs((prev) => ({ ...prev, [step.id]: audioBlob }));
                    // Compute audio duration from blob
                    try {
                        const tmpUrl = URL.createObjectURL(audioBlob);
                        const audioDur = await new Promise<number>((resolve) => {
                            const a = new Audio(tmpUrl);
                            a.addEventListener("loadedmetadata", () => { resolve(a.duration); URL.revokeObjectURL(tmpUrl); });
                            a.addEventListener("error", () => { resolve(0); URL.revokeObjectURL(tmpUrl); });
                        });
                        if (audioDur > 0) setAudioDurations((prev) => ({ ...prev, [step.id]: Math.ceil(audioDur) }));
                    } catch { /* ignore duration calc errors */ }
                    setSteps((p) =>
                        p.map((s, i) =>
                            i === cur
                                ? { ...s, status: "done", duration: Math.round(elapsed * 10) / 10 }
                                : s
                        )
                    );
                    executingStepRef.current = -1;
                    if (cur + 1 < steps.length) setCur((c) => c + 1);
                    else setIsRunning(false);
                })
                .catch((err) => {
                    setError(err.message);
                    setSteps((p) =>
                        p.map((s, i) =>
                            i === cur
                                ? { ...s, status: "error", errorMsg: err.message }
                                : s
                        )
                    );
                    setIsRunning(false);
                });
            return;
        }

        // ── IMAGE GENERATION per segment (nano-banana-2/edit) ──
        if (step?.id.startsWith("image-gen-") && config) {
            const segIdx = parseInt(step.id.replace("image-gen-", "")) - 1;
            const scene = config.scenes?.[segIdx];

            // Build image URLs from avatar + scene files
            const imageUrls: string[] = [];
            if (config.avatarImageFullUrl) imageUrls.push(config.avatarImageFullUrl);
            // Product/background files are uploaded via the form endpoint
            // For now, we pass the avatar as the primary reference

            if (imageUrls.length === 0) {
                setError("No avatar selected for image generation.");
                setSteps((p) => p.map((s, i) => i === cur ? { ...s, status: "error", errorMsg: "No avatar" } : s));
                executingStepRef.current = -1;
                setIsRunning(false);
                return;
            }

            const prompt = scene?.prompt || "A person naturally presenting, photorealistic, high quality, 9:16 portrait";
            const startTime = Date.now();
            setSteps((p) => p.map((s, i) => i === cur ? { ...s, desc: `Scene ${segIdx + 1}: uploading to Nano Banana 2...` } : s));

            createImageEdit(imageUrls, prompt)
                .then((result) => {
                    if (result.status === "completed" && result.image_url) {
                        const elapsed = (Date.now() - startTime) / 1000;
                        setGeneratedImageUrls(prev => ({ ...prev, [step.id]: result.image_url! }));
                        setSteps((p) => p.map((s, i) => i === cur ? { ...s, status: "done", duration: Math.round(elapsed * 10) / 10, desc: "Image ready" } : s));
                        if (cur + 1 < steps.length) setCur((c) => c + 1);
                        else setIsRunning(false);
                        return;
                    }
                    setSteps((p) => p.map((s, i) => i === cur ? { ...s, desc: `Scene ${segIdx + 1}: generating... (30-60s)` } : s));
                    return pollImageGen(result.request_id, (status) => {
                        setSteps((p) => p.map((s, i) => i === cur ? { ...s, desc: `Scene ${segIdx + 1}: ${status.status}...` } : s));
                    });
                })
                .then((finalStatus) => {
                    if (!finalStatus) return;
                    if (finalStatus.status === "completed" && finalStatus.image_url) {
                        const elapsed = (Date.now() - startTime) / 1000;
                        setGeneratedImageUrls(prev => ({ ...prev, [step.id]: finalStatus.image_url! }));
                        setSteps((p) => p.map((s, i) => i === cur ? { ...s, status: "done", duration: Math.round(elapsed * 10) / 10, desc: "Image ready" } : s));
                        if (cur + 1 < steps.length) setCur((c) => c + 1);
                        else setIsRunning(false);
                    } else {
                        throw new Error(finalStatus.error || "Image generation failed");
                    }
                })
                .catch((err) => {
                    setError(err.message);
                    setSteps((p) => p.map((s, i) => i === cur ? { ...s, status: "error", errorMsg: err.message } : s));
                    setIsRunning(false);
                });
            return;
        }

        // ── QA IMAGE GEN (approve generated image) ──
        if (step?.id.startsWith("qa-image-gen-")) {
            setSteps((p) => p.map((s, i) => i === cur ? { ...s, status: "running", desc: "Review the generated image" } : s));
            setPaused(true);
            setSteps((prev) => prev.map((s, i) => i === cur ? { ...s, status: "review" } : s));
            executingStepRef.current = -1;
            return;
        }

        // ── KLING IMAGE-TO-VIDEO per segment ──
        if (step?.id.startsWith("kling-video-") && config) {
            const segIdx = parseInt(step.id.replace("kling-video-", "")) - 1;
            const scene = config.scenes?.[segIdx];

            // Use generated image for this segment if available, otherwise raw avatar
            const genImgKey = `image-gen-${segIdx + 1}`;
            const imageForKling = generatedImageUrls[genImgKey] || config.avatarImageFullUrl;
            if (!imageForKling) {
                setError("No image available for Kling.");
                setSteps((p) => p.map((s, i) => i === cur ? { ...s, status: "error", errorMsg: "No image" } : s));
                executingStepRef.current = -1;
                setIsRunning(false);
                return;
            }

            const startTime = Date.now();
            const selectedDuration = scene?.klingDuration || config.klingDuration || "5";
            console.log(`[pipeline] Kling seg ${segIdx + 1}: duration=${selectedDuration}s`);
            setSteps((p) => p.map((s, i) => i === cur ? { ...s, desc: `Seg ${segIdx + 1}: Kling V2.6 (${selectedDuration}s)...` } : s));

            createKlingVideo(imageForKling, undefined, selectedDuration)
                .then((result) => {
                    if (result.status === "completed" && result.video_url) {
                        const elapsed = (Date.now() - startTime) / 1000;
                        setKlingVideoUrl(result.video_url); // keep for compat
                        klingVideoUrlRef.current = result.video_url; // update ref immediately
                        setKlingVideoUrls(prev => ({ ...prev, [step.id]: result.video_url! }));
                        klingVideoUrlsRef.current = { ...klingVideoUrlsRef.current, [step.id]: result.video_url! };
                        setVideoUrls((prev) => ({ ...prev, [step.id]: result.video_url! }));
                        setSteps((p) => p.map((s, i) => i === cur ? { ...s, status: "done", duration: Math.round(elapsed * 10) / 10, desc: "Video ready" } : s));
                        if (cur + 1 < steps.length) setCur((c) => c + 1);
                        else setIsRunning(false);
                        return;
                    }
                    setSteps((p) => p.map((s, i) => i === cur ? { ...s, desc: `Seg ${segIdx + 1}: Kling generating... (2-5 min)` } : s));
                    return pollKlingVideo(result.request_id, (status) => {
                        setSteps((p) => p.map((s, i) => i === cur ? { ...s, desc: `Seg ${segIdx + 1}: ${status.status}...` } : s));
                    });
                })
                .then((finalStatus) => {
                    if (!finalStatus) return;
                    if (finalStatus.status === "completed" && finalStatus.video_url) {
                        const elapsed = (Date.now() - startTime) / 1000;
                        setKlingVideoUrl(finalStatus.video_url);
                        klingVideoUrlRef.current = finalStatus.video_url; // update ref immediately
                        setKlingVideoUrls(prev => ({ ...prev, [step.id]: finalStatus.video_url! }));
                        klingVideoUrlsRef.current = { ...klingVideoUrlsRef.current, [step.id]: finalStatus.video_url! };
                        setVideoUrls((prev) => ({ ...prev, [step.id]: finalStatus.video_url! }));
                        setSteps((p) => p.map((s, i) => i === cur ? { ...s, status: "done", duration: Math.round(elapsed * 10) / 10, desc: "Video ready" } : s));
                        if (cur + 1 < steps.length) setCur((c) => c + 1);
                        else setIsRunning(false);
                    } else {
                        throw new Error(finalStatus.error || "Kling video generation failed");
                    }
                })
                .catch((err) => {
                    setError(err.message);
                    setSteps((p) => p.map((s, i) => i === cur ? { ...s, status: "error", errorMsg: err.message } : s));
                    setIsRunning(false);
                });
            return;
        }

        // ── QA KLING VIDEO (approve generated avatar video) ──
        if (step?.id.startsWith("qa-kling-")) {
            setSteps((p) => p.map((s, i) => i === cur ? { ...s, status: "running", desc: "Review the Kling-generated video — approve or regenerate" } : s));
            setPaused(true);
            executingStepRef.current = -1;
            return;
        }

        // ── LIP SYNC for lip-X steps (HeyGen or Fal) ──
        if (step?.id.startsWith("lip-") && config) {
            const segIndex = parseInt(step.id.split("-")[1]) - 1;
            const audioStepId = `audio-${segIndex + 1}`;
            const blob = audioBlobs[audioStepId];
            let talkingPhotoId = config.talkingPhotoIds[segIndex] || config.talkingPhotoIds[0];

            if (!blob) {
                setError(`No audio found for segment ${segIndex + 1}`);
                setSteps((p) => p.map((s, i) => i === cur ? { ...s, status: "error", errorMsg: "Audio blob missing" } : s));
                executingStepRef.current = -1;
                setIsRunning(false);
                return;
            }

            const startTime = Date.now();

            // ─── FABRIC 1.0 AI ENGINE (uses Multishot curating) ───
            if (config.lipsyncEngine === "fabric") {
                // Use ref to avoid stale closure — state may not be updated yet
                const klingStepId = `kling-video-${segIndex + 1}`;
                const klingUrl = klingVideoUrlsRef.current[klingStepId] || klingVideoUrlRef.current;
                if (!klingUrl) {
                    setError("No Kling video available for Fal lip sync. Run the Kling step first.");
                    setSteps((p) => p.map((s, i) => i === cur ? { ...s, status: "error", errorMsg: "Kling video missing" } : s));
                    executingStepRef.current = -1;
                    setIsRunning(false);
                    return;
                }

                setSteps((p) => p.map((s, i) => i === cur ? { ...s, desc: "Uploading audio to Fal..." } : s));

                createFalLipSync(blob, klingUrl, "cut_off", `UGC Seg ${segIndex + 1}`)
                    .then((result) => {
                        if (result.status === "completed" && result.video_url) {
                            const elapsed = (Date.now() - startTime) / 1000;
                            setVideoUrls((prev) => ({ ...prev, [step.id]: result.video_url! }));
                            setSteps((p) => p.map((s, i) => i === cur ? { ...s, status: "done", duration: Math.round(elapsed * 10) / 10, desc: "Video ready (Fal)" } : s));
                            if (cur + 1 < steps.length) setCur((c) => c + 1);
                            else setIsRunning(false);
                            return;
                        }
                        setSteps((p) => p.map((s, i) => i === cur ? { ...s, desc: "Fal rendering lip sync... (1-3 min)" } : s));
                        return pollFalLipSync(result.request_id, (status) => {
                            setSteps((p) => p.map((s, i) => i === cur ? { ...s, desc: `Fal: ${status.status}...` } : s));
                        });
                    })
                    .then((finalStatus) => {
                        if (!finalStatus) return;
                        if (finalStatus.status === "completed" && finalStatus.video_url) {
                            const elapsed = (Date.now() - startTime) / 1000;
                            setVideoUrls((prev) => ({ ...prev, [step.id]: finalStatus.video_url! }));
                            setSteps((p) => p.map((s, i) => i === cur ? { ...s, status: "done", duration: Math.round(elapsed * 10) / 10, desc: "Video ready (Fal)" } : s));
                            if (cur + 1 < steps.length) setCur((c) => c + 1);
                            else setIsRunning(false);
                        } else {
                            throw new Error(finalStatus.error || "Fal video generation failed");
                        }
                    })
                    .catch((err) => {
                        setError(err.message);
                        setSteps((p) => p.map((s, i) => i === cur ? { ...s, status: "error", errorMsg: err.message } : s));
                        executingStepRef.current = -1;
                        setIsRunning(false);
                    });
                return;
            }

            // ─── HEYGEN ENGINE (default) ───
            const resolvePhoto = async (): Promise<string> => {
                if (talkingPhotoId) return talkingPhotoId;
                if (config.uploadedFile) {
                    setSteps((p) => p.map((s, i) => i === cur ? { ...s, desc: "Uploading image to HeyGen..." } : s));
                    const result = await uploadTalkingPhoto(config.uploadedFile);
                    return result.talking_photo_id;
                }
                throw new Error("No avatar or image available for lip sync");
            };

            resolvePhoto()
                .then((photoId) => {
                    talkingPhotoId = photoId;
                    setSteps((p) => p.map((s, i) => i === cur ? { ...s, desc: "Uploading audio to HeyGen..." } : s));
                    return createLipSync(blob, photoId, `UGC Seg ${segIndex + 1}`);
                })
                .then(({ video_id }) => {
                    setSteps((p) => p.map((s, i) => i === cur ? { ...s, desc: "Rendering video... (this may take 1-3 min)" } : s));
                    return pollVideoStatus(video_id, (status) => {
                        setSteps((p) => p.map((s, i) => i === cur ? { ...s, desc: `HeyGen: ${status.status}...` } : s));
                    });
                })
                .then((finalStatus) => {
                    if (finalStatus.status === "completed" && finalStatus.video_url) {
                        const elapsed = (Date.now() - startTime) / 1000;
                        setVideoUrls((prev) => ({ ...prev, [step.id]: finalStatus.video_url! }));
                        executingStepRef.current = -1;
                        setSteps((p) =>
                            p.map((s, i) =>
                                i === cur
                                    ? { ...s, status: "done", duration: Math.round(elapsed * 10) / 10, desc: "Video ready" }
                                    : s
                            )
                        );
                        if (cur + 1 < steps.length) setCur((c) => c + 1);
                        else setIsRunning(false);
                    } else {
                        throw new Error(finalStatus.error || "Video generation failed");
                    }
                })
                .catch((err) => {
                    setError(err.message);
                    setSteps((p) =>
                        p.map((s, i) =>
                            i === cur
                                ? { ...s, status: "error", errorMsg: err.message }
                                : s
                        )
                    );
                    setIsRunning(false);
                });
            return;
        }

        // ── Mock timer ONLY for split and render steps ──
        if (step?.id === "split" || step?.id === "render") {
            const ms = 1200 + Math.random() * 1200;
            const t = setTimeout(() => {
                setSteps((p) => p.map((s, i) => (i === cur ? { ...s, status: "done", duration: Math.round(ms / 100) / 10 } : s)));
                executingStepRef.current = -1;
                if (cur + 1 < steps.length) setCur((c) => c + 1);
                else setIsRunning(false);
            }, ms);
            return () => clearTimeout(t);
        }

        // Unhandled step — should not happen
        console.error(`[pipeline] Unhandled step: ${step?.id}`);
        executingStepRef.current = -1;
    }, [isRunning, cur, steps.length, paused, audioBlobs]);

    const isDone = !isRunning && steps.length > 0 && steps.every((s) => s.status === "done");
    const progress = steps.length ? Math.round((steps.filter((s) => s.status === "done").length / steps.length) * 100) : 0;

    return { steps, start, reset, isRunning, isDone, progress, paused, approve, regenerate, audioUrls, audioDurations, videoUrls, klingVideoUrl, generatedImageUrls, klingVideoUrls, error };
}

// --- Component ---
export function BrandWorkspace() {
    const { brandId } = useParams();
    const [mockGenerations, setMockGenerations] = useState<Generation[]>(MOCK_GENERATIONS);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [isPipelineOpen, setIsPipelineOpen] = useState(false);
    const [pipelineLaunchData, setPipelineLaunchData] = useState<WizardLaunchResult | null>(null);
    const [imageMode, setImageMode] = useState<"upload" | "generate">("upload");
    const [modalView, setModalView] = useState<"form" | "preview">("form");
    const [clipCount, setClipCount] = useState<1 | 2 | 3>(1);
    const [showSegments, setShowSegments] = useState(false);
    const [imageRes, setImageRes] = useState("2K");
    const pipeline = usePipeline();
    const [timelinePopup, setTimelinePopup] = useState<string | null>(null);

    // Auto-open popup when a QA step enters review
    useEffect(() => {
        if (pipeline.paused) {
            const reviewStep = pipeline.steps.find(s => s.status === "review");
            if (reviewStep) setTimelinePopup(reviewStep.id);
        }
    }, [pipeline.paused, pipeline.steps]);

    // ── Brand data ──
    const [brand, setBrand] = useState<Brand | null>(null);
    const [brandLoading, setBrandLoading] = useState(true);

    // ── Form state ──
    const [scriptText, setScriptText] = useState("");
    const [productName, setProductName] = useState("");
    const [voiceId, setVoiceId] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [lipsyncEngine, setLipsyncEngine] = useState<LipSyncEngine>("fabric");
    const [enableImageGen, setEnableImageGen] = useState(false);
    const [activeSceneTab, setActiveSceneTab] = useState(0);

    // Per-segment scene configuration
    const defaultScene = (): SceneConfig => ({ prompt: "", klingDuration: "5" });
    const [scenes, setScenes] = useState<SceneConfig[]>([defaultScene()]);

    // Sync scenes count with clipCount
    useEffect(() => {
        setScenes(prev => {
            if (prev.length === clipCount) return prev;
            if (prev.length < clipCount) {
                return [...prev, ...Array(clipCount - prev.length).fill(null).map(() => defaultScene())];
            }
            return prev.slice(0, clipCount);
        });
    }, [clipCount]);

    // Helper to update a specific scene
    const updateScene = (idx: number, patch: Partial<SceneConfig>) => {
        setScenes(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
    };

    // Apply current scene to all segments
    // Removed applySceneToAll to fix unused var warning

    // ── Avatar selection (per segment) ──
    const [selectedAvatars, setSelectedAvatars] = useState<string[]>([]);

    // ── Avatar upload modal ──
    const [showAvatarModal, setShowAvatarModal] = useState(false);
    const [avatarName, setAvatarName] = useState("");
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [avatarError, setAvatarError] = useState<string | null>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const [showHeygenSelector, setShowHeygenSelector] = useState(false);

    // ── Product upload modal ──
    const [showProductModal, setShowProductModal] = useState(false);
    const [productNameUpload, setProductNameUpload] = useState("");
    const [productFile, setProductFile] = useState<File | null>(null);
    const [productPreview, setProductPreview] = useState<string | null>(null);
    const [productUploading, setProductUploading] = useState(false);
    const [productError, setProductError] = useState<string | null>(null);
    const productInputRef = useRef<HTMLInputElement>(null);

    // Load brand data
    const loadBrand = useCallback(async () => {
        if (!brandId) return;
        setBrandLoading(true);
        try {
            const data = await fetchBrand(brandId);
            setBrand(data);
            // Set default voice
            if (data.voicePresets?.length > 0 && !voiceId) {
                setVoiceId(data.voicePresets[0].id);
            }
        } catch { /* silent */ }
        finally { setBrandLoading(false); }
    }, [brandId]);

    useEffect(() => { loadBrand(); }, [loadBrand]);

    // For HeyGen: need talkingPhotoId. For Fabric: need a local image file (not HeyGen imports which have empty filename).
    const brandAvatars = lipsyncEngine === "fabric"
        ? (brand?.avatars?.filter(a => a.imageUrl && a.filename) || [])
        : (brand?.avatars?.filter(a => a.talkingPhotoId) || []);

    // Reset avatar selection when switching engines (different ID schemes)
    useEffect(() => {
        setSelectedAvatars([]);
    }, [lipsyncEngine]);

    // Auto-select if only one avatar available
    useEffect(() => {
        if (brandAvatars.length === 1 && selectedAvatars.filter(Boolean).length === 0) {
            const av = brandAvatars[0];
            const id = lipsyncEngine === "fabric" ? av.id : (av.talkingPhotoId || av.id);
            if (id) {
                const newArr = Array.from({ length: clipCount }, () => id);
                setSelectedAvatars(newArr);
            }
        }
    }, [brandAvatars.length, lipsyncEngine, clipCount]);

    // Helper to get the avatar image full URL for the selected first avatar (for Kling)
    const getSelectedAvatarImageUrl = (): string | undefined => {
        if (!brand?.avatars) return undefined;
        // Find first selected avatar and return its full image URL
        for (const tpId of selectedAvatars) {
            if (!tpId) continue;
            const av = brand.avatars.find(a => a.talkingPhotoId === tpId || a.id === tpId);
            if (av?.imageUrl) return avatarImageUrl(av.imageUrl);
        }
        return undefined;
    };

    const selectAvatar = (avatarIdOrTpId: string, segIndex: number) => {
        setSelectedAvatars((prev) => {
            const copy = [...prev];
            copy[segIndex] = avatarIdOrTpId;
            return copy;
        });
    };

    // ── Avatar upload handlers ──
    const handleAvatarFile = (file: File) => {
        if (!file.type.startsWith("image/")) return;
        if (file.size > 10 * 1024 * 1024) return;
        setAvatarFile(file);
        setAvatarPreview(URL.createObjectURL(file));
    };

    const handleUploadAvatar = async () => {
        if (!avatarName.trim() || !avatarFile || !brandId) return;
        setAvatarUploading(true);
        setAvatarError(null);
        try {
            await uploadAvatar(brandId, avatarName.trim(), avatarFile, true);
            setShowAvatarModal(false);
            setAvatarName("");
            setAvatarFile(null);
            if (avatarPreview) URL.revokeObjectURL(avatarPreview);
            setAvatarPreview(null);
            await loadBrand();
        } catch (err: any) {
            setAvatarError(err.message || "Failed to upload avatar");
        } finally {
            setAvatarUploading(false);
        }
    };

    const handleDeleteAvatar = async (avatarId: string) => {
        if (!brandId) return;
        try {
            await deleteAvatar(brandId, avatarId);
            await loadBrand();
        } catch { /* silent */ }
    };

    const handleSelectHeygenAvatar = async (photo: TalkingPhoto) => {
        if (!brandId) return;
        try {
            await addHeygenAvatar(brandId, photo.id, photo.name, photo.preview);
            await loadBrand();
        } catch (err: any) {
            console.error(err);
        }
    };

    const handleRetryHeygen = async (avatarId: string) => {
        if (!brandId) return;
        try {
            await retryAvatarHeygen(brandId, avatarId);
            await loadBrand();
        } catch { /* silent */ }
    };

    // ── Product upload handlers ──
    const handleProductFile = (file: File) => {
        if (!file.type.startsWith("image/")) return;
        if (file.size > 10 * 1024 * 1024) return;
        setProductFile(file);
        setProductPreview(URL.createObjectURL(file));
    };

    const handleUploadProduct = async () => {
        if (!productNameUpload.trim() || !productFile || !brandId) return;
        setProductUploading(true);
        setProductError(null);
        try {
            await uploadProduct(brandId, productNameUpload.trim(), productFile);
            setShowProductModal(false);
            setProductNameUpload("");
            setProductFile(null);
            if (productPreview) URL.revokeObjectURL(productPreview);
            setProductPreview(null);
            await loadBrand();
        } catch (err: any) {
            setProductError(err.message || "Failed to upload product");
        } finally {
            setProductUploading(false);
        }
    };

    const handleDeleteProduct = async (productId: string) => {
        if (!brandId) return;
        try {
            await deleteProduct(brandId, productId);
            await loadBrand();
        } catch { /* silent */ }
    };

    // ── Brand Context state ──
    const [showContext, setShowContext] = useState(false);
    const [contextDraft, setContextDraft] = useState("");
    const [contextSaving, setContextSaving] = useState(false);
    const [contextSaved, setContextSaved] = useState(false);

    useEffect(() => {
        if (brand) setContextDraft(brand.brandContext || "");
    }, [brand]);

    const handleSaveContext = async () => {
        if (!brandId) return;
        setContextSaving(true);
        try {
            await updateBrand(brandId, { brandContext: contextDraft });
            setContextSaved(true);
            setTimeout(() => setContextSaved(false), 2000);
            await loadBrand();
        } catch { /* silent */ }
        finally { setContextSaving(false); }
    };

    // ── Generate Copy state ──
    const [copyGenerating, setCopyGenerating] = useState(false);
    const [copyError, setCopyError] = useState<string | null>(null);
    const [copyTone, setCopyTone] = useState<"engaging" | "professional" | "casual" | "funny">("engaging");
    const [copyPlatform, setCopyPlatform] = useState<"tiktok" | "instagram" | "youtube">("tiktok");
    const [copyLang, setCopyLang] = useState<"es" | "en">("es");

    const handleGenerateCopy = async () => {
        if (!brandId) return;
        setCopyGenerating(true);
        setCopyError(null);
        try {
            const result = await generateCopy(brandId, {
                productName: productName.trim(),
                tone: copyTone,
                platform: copyPlatform,
                language: copyLang,
                count: 1,
            });
            if (result.scripts.length > 0) {
                setScriptText(result.scripts[0]);
            }
        } catch (err: any) {
            setCopyError(err.message || "Failed to generate copy");
        } finally {
            setCopyGenerating(false);
        }
    };

    // ── Image upload state ──
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFile = (file: File) => {
        if (!file.type.startsWith("image/")) return;
        if (file.size > 5 * 1024 * 1024) return;
        setUploadedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
    };

    const clearUpload = () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setUploadedFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setModalView("form");
        setClipCount(1);
        setShowSegments(false);
        setScriptText("");
        setProductName("");
        setIsGenerating(false);
        setSelectedAvatars([]);
        clearUpload();
        pipeline.reset();
    };

    const handleSaveAndGenerate = async () => {
        if (!scriptText.trim()) return;
        setIsGenerating(true);
        setModalView("preview");
        pipeline.start({
            scriptText: scriptText.trim(),
            voiceId,
            clipCount,
            imageMode,
            talkingPhotoIds: selectedAvatars.length > 0 ? selectedAvatars : [],
            uploadedFile,
            lipsyncEngine,
            avatarImageFullUrl: getSelectedAvatarImageUrl(),
            klingDuration: "5",
            enableImageGen,
            scenes: scenes,
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                    <Link to="/dashboard" className="text-sm font-medium text-text-secondary hover:text-text-primary flex items-center gap-1 w-fit mb-1">
                        <ArrowLeft size={16} /> Back to Dashboard
                    </Link>
                    <h1 className="text-[32px] font-bold tracking-tight text-text-primary capitalize">
                        {brandId?.replace("-", " ")} Workspace
                    </h1>
                    <p className="text-text-secondary text-base">Manage UGC scripts and trigger generations.</p>
                </div>
                <div className="flex gap-3">
                </div>
            </div>

            {/* ====== BRAND CONTEXT (DNA) PANEL ====== */}
            <div className="border border-edge rounded-[var(--radius-md)] bg-surface-0 overflow-hidden">
                <button
                    onClick={() => setShowContext(!showContext)}
                    className="cursor-pointer w-full px-4 py-3 flex items-center justify-between hover:bg-surface-1/50 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <FileText size={16} className="text-fg-muted" />
                        <span className="text-[13px] font-medium text-fg">Brand DNA</span>
                        {brand?.brandContext && (
                            <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded-full">Active</span>
                        )}
                    </div>
                    <ChevronRight size={14} className={`text-fg-faint transition-transform duration-200 ${showContext ? "rotate-90" : ""}`} />
                </button>
                {showContext && (
                    <div className="px-4 pb-4 pt-1 border-t border-edge-subtle space-y-3">
                        <p className="text-[11px] text-fg-faint leading-relaxed">
                            Describe your brand: tone, audience, products, values. This context is used internally by the AI to generate scripts that match your brand perfectly.
                        </p>
                        <Textarea
                            className="min-h-[120px] text-[13px]"
                            placeholder="e.g. Taller Santa Clara is an artisan clothing brand from Argentina. We make organic cotton t-shirts for urban men aged 25-40. Our tone is warm, authentic, and aspirational..."
                            value={contextDraft}
                            onChange={(e) => setContextDraft(e.target.value)}
                        />
                        <div className="flex items-center justify-between">
                            <p className="text-[11px] text-fg-faint">{contextDraft.length} characters</p>
                            <div className="flex items-center gap-2">
                                {contextSaved && (
                                    <span className="text-[11px] text-success flex items-center gap-1">
                                        <CheckCircle2 size={12} /> Saved
                                    </span>
                                )}
                                <Button
                                    variant="default"
                                    size="sm"
                                    className="flex items-center gap-1.5 h-7 text-xs"
                                    disabled={contextSaving || contextDraft === (brand?.brandContext || "")}
                                    onClick={handleSaveContext}
                                >
                                    {contextSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                    {contextSaving ? "Saving..." : "Save Context"}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ====== AVATAR MANAGEMENT PANEL ====== */}
            <div className="border border-edge rounded-[var(--radius-md)] bg-surface-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-edge-subtle flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <UserCircle size={16} className="text-fg-muted" />
                        <span className="text-[13px] font-medium text-fg">Brand Avatars</span>
                        <span className="text-[11px] text-fg-faint bg-surface-1 px-1.5 py-0.5 rounded-full">{brand?.avatars?.length || 0}</span>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex items-center gap-1.5 h-7 text-xs" onClick={() => setShowHeygenSelector(true)}>
                            <Search size={12} /> Select from HeyGen
                        </Button>
                        <Button variant="outline" size="sm" className="flex items-center gap-1.5 h-7 text-xs" onClick={() => setShowAvatarModal(true)}>
                            <Upload size={12} /> Upload New
                        </Button>
                    </div>
                </div>
                <div className="p-4">
                    {brandLoading ? (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 size={16} className="animate-spin text-fg-muted" />
                            <span className="text-fg-muted text-xs ml-2">Loading avatars...</span>
                        </div>
                    ) : !brand?.avatars?.length ? (
                        <div className="flex flex-col items-center justify-center py-6 text-center">
                            <UserCircle size={24} className="text-fg-faint mb-2" />
                            <p className="text-[13px] text-fg-muted">No avatars yet</p>
                            <p className="text-[11px] text-fg-faint mt-0.5">Upload an avatar image to use in video generation.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {brand.avatars.map((av) => (
                                <div key={av.id} className="group relative border border-edge-subtle rounded-[var(--radius-md)] bg-surface-0 overflow-hidden hover:border-edge-strong transition-all">
                                    <div className="w-full aspect-square bg-surface-1 flex items-center justify-center relative overflow-hidden">
                                        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
                                            <Image size={20} className="text-fg-faint mb-2" />
                                            <span className="text-[10px] text-fg-faint truncate w-full">{av.name}</span>
                                        </div>
                                        <img
                                            src={avatarImageUrl(av.imageUrl)}
                                            alt={av.name}
                                            className="w-full h-full object-cover relative z-10 bg-surface-1"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                    </div>
                                    <div className="p-2">
                                        <p className="text-[12px] font-medium text-fg truncate">{av.name}</p>
                                        <div className="flex items-center gap-1 mt-1">
                                            {av.heygenStatus === "ready" && (
                                                <span className="text-[10px] text-success flex items-center gap-0.5"><CheckCircle2 size={10} /> Ready</span>
                                            )}
                                            {av.heygenStatus === "pending" && (
                                                <span className="text-[10px] text-warning flex items-center gap-0.5"><Clock size={10} /> Pending</span>
                                            )}
                                            {av.heygenStatus === "failed" && (
                                                <span className="text-[10px] text-error flex items-center gap-0.5"><AlertCircle size={10} /> Failed</span>
                                            )}
                                            {av.heygenStatus === "skipped" && (
                                                <span className="text-[10px] text-fg-faint">Local only</span>
                                            )}
                                        </div>
                                    </div>
                                    {/* Actions */}
                                    <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-60 hover:opacity-100 transition-opacity">
                                        {av.heygenStatus === "failed" && (
                                            <button onClick={() => handleRetryHeygen(av.id)} className="cursor-pointer w-6 h-6 flex items-center justify-center rounded-full bg-surface-0/90 border border-edge text-fg-muted hover:text-accent transition-colors" title="Retry HeyGen upload">
                                                <RotateCw size={11} />
                                            </button>
                                        )}
                                        <button onClick={() => handleDeleteAvatar(av.id)} className="cursor-pointer w-6 h-6 flex items-center justify-center rounded-full bg-surface-0/90 border border-edge text-fg-muted hover:text-error transition-colors" title="Delete avatar">
                                            <Trash2 size={11} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ====== AVATAR UPLOAD MODAL ====== */}
            {showAvatarModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowAvatarModal(false); setAvatarError(null); }} />
                    <div className="relative bg-surface-0 border border-edge rounded-[var(--radius-lg)] shadow-lg w-full max-w-md overflow-hidden">
                        <div className="flex items-center justify-between p-5 border-b border-edge">
                            <div>
                                <h2 className="text-[16px] font-semibold text-fg">Add Avatar</h2>
                                <p className="text-[12px] text-fg-muted mt-0.5">Upload an image to use as a talking photo avatar.</p>
                            </div>
                            <button onClick={() => { setShowAvatarModal(false); setAvatarError(null); }} className="cursor-pointer w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-2 text-fg-muted hover:text-fg transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="avatar-name">Avatar Name</Label>
                                <Input
                                    ref={avatarInputRef}
                                    id="avatar-name"
                                    placeholder="e.g. María, Elías, Carlos..."
                                    value={avatarName}
                                    onChange={(e) => setAvatarName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Photo</Label>
                                <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    className="hidden"
                                    id="avatar-file-input"
                                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarFile(f); }}
                                />
                                {!avatarFile ? (
                                    <label htmlFor="avatar-file-input" className="border border-dashed border-edge rounded-[var(--radius-md)] p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-surface-1 transition-colors">
                                        <Upload size={20} className="text-fg-faint mb-2" />
                                        <span className="text-[13px] font-medium text-fg">Click to upload</span>
                                        <span className="text-[11px] text-fg-faint mt-0.5">PNG, JPG or WebP (Max 10MB)</span>
                                    </label>
                                ) : (
                                    <div className="border border-edge rounded-[var(--radius-md)] p-3 flex items-center gap-3 bg-surface-1">
                                        <img src={avatarPreview!} alt="Preview" className="w-16 h-16 rounded-[var(--radius-sm)] object-cover" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-medium text-fg truncate">{avatarFile.name}</p>
                                            <p className="text-[11px] text-fg-faint">{(avatarFile.size / 1024).toFixed(0)} KB</p>
                                        </div>
                                        <button onClick={() => { setAvatarFile(null); if (avatarPreview) URL.revokeObjectURL(avatarPreview); setAvatarPreview(null); }} className="cursor-pointer w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-surface-2 text-fg-muted hover:text-fg transition-colors">
                                            <X size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-start gap-2 p-3 rounded-[var(--radius-md)] bg-accent-muted border border-accent/10">
                                <Sparkles size={14} className="text-accent mt-0.5 shrink-0" />
                                <p className="text-[11px] text-fg-secondary leading-relaxed">The image will be automatically uploaded to HeyGen as a Talking Photo for lip sync generation.</p>
                            </div>
                            {avatarError && (
                                <p className="text-xs text-error flex items-center gap-1"><AlertCircle size={12} /> {avatarError}</p>
                            )}
                        </div>
                        <div className="p-5 border-t border-edge flex justify-end gap-3">
                            <Button variant="outline" onClick={() => { setShowAvatarModal(false); setAvatarError(null); }}>Cancel</Button>
                            <Button
                                variant="default"
                                disabled={!avatarName.trim() || !avatarFile || avatarUploading}
                                onClick={handleUploadAvatar}
                                className={`flex items-center gap-1.5 ${(!avatarName.trim() || !avatarFile) ? 'opacity-50' : ''}`}
                            >
                                {avatarUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                                {avatarUploading ? "Uploading..." : "Upload Avatar"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <HeygenAvatarSelector
                isOpen={showHeygenSelector}
                onClose={() => setShowHeygenSelector(false)}
                onSelect={handleSelectHeygenAvatar}
            />

            {/* ====== PRODUCT MANAGEMENT PANEL ====== */}
            <div className="border border-edge rounded-[var(--radius-md)] bg-surface-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-edge-subtle flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Image size={16} className="text-fg-muted" />
                        <span className="text-[13px] font-medium text-fg">Brand Products</span>
                        <span className="text-[11px] text-fg-faint bg-surface-1 px-1.5 py-0.5 rounded-full">{brand?.products?.length || 0}</span>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex items-center gap-1.5 h-7 text-xs" onClick={() => setShowProductModal(true)}>
                            <Upload size={12} /> Upload New
                        </Button>
                    </div>
                </div>
                <div className="p-4">
                    {brandLoading ? (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 size={16} className="animate-spin text-fg-muted" />
                            <span className="text-fg-muted text-xs ml-2">Loading products...</span>
                        </div>
                    ) : !brand?.products?.length ? (
                        <div className="flex flex-col items-center justify-center py-6 text-center">
                            <Image size={24} className="text-fg-faint mb-2" />
                            <p className="text-[13px] text-fg-muted">No products yet</p>
                            <p className="text-[11px] text-fg-faint mt-0.5">Upload a product image to use in video generation.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {brand.products.map((prod) => (
                                <div key={prod.id} className="group relative border border-edge-subtle rounded-[var(--radius-md)] bg-surface-0 overflow-hidden hover:border-edge-strong transition-all">
                                    <div className="w-full aspect-square bg-surface-1 flex items-center justify-center relative overflow-hidden">
                                        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
                                            <Image size={20} className="text-fg-faint mb-2" />
                                            <span className="text-[10px] text-fg-faint truncate w-full">{prod.name}</span>
                                        </div>
                                        <img
                                            src={productImageUrl(prod.imageUrl)}
                                            alt={prod.name}
                                            className="w-full h-full object-cover relative z-10 bg-surface-1"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                    </div>
                                    <div className="p-2">
                                        <p className="text-[12px] font-medium text-fg truncate">{prod.name}</p>
                                    </div>
                                    {/* Actions */}
                                    <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-60 hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleDeleteProduct(prod.id)} className="cursor-pointer w-6 h-6 flex items-center justify-center rounded-full bg-surface-0/90 border border-edge text-fg-muted hover:text-error transition-colors" title="Delete product">
                                            <Trash2 size={11} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ====== PRODUCT UPLOAD MODAL ====== */}
            {showProductModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowProductModal(false); setProductError(null); }} />
                    <div className="relative bg-surface-0 border border-edge rounded-[var(--radius-lg)] shadow-lg w-full max-w-md overflow-hidden">
                        <div className="flex items-center justify-between p-5 border-b border-edge">
                            <div>
                                <h2 className="text-[16px] font-semibold text-fg">Add Product</h2>
                                <p className="text-[12px] text-fg-muted mt-0.5">Upload an image of your product.</p>
                            </div>
                            <button onClick={() => { setShowProductModal(false); setProductError(null); }} className="cursor-pointer w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-2 text-fg-muted hover:text-fg transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="product-name">Product Name</Label>
                                <Input
                                    ref={productInputRef}
                                    id="product-name"
                                    placeholder="e.g. Classic White T-Shirt"
                                    value={productNameUpload}
                                    onChange={(e) => setProductNameUpload(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Photo</Label>
                                <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    className="hidden"
                                    id="product-file-input"
                                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleProductFile(f); }}
                                />
                                {!productFile ? (
                                    <label htmlFor="product-file-input" className="border border-dashed border-edge rounded-[var(--radius-md)] p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-surface-1 transition-colors">
                                        <Upload size={20} className="text-fg-faint mb-2" />
                                        <span className="text-[13px] font-medium text-fg">Click to upload</span>
                                        <span className="text-[11px] text-fg-faint mt-0.5">PNG, JPG or WebP (Max 10MB)</span>
                                    </label>
                                ) : (
                                    <div className="border border-edge rounded-[var(--radius-md)] p-3 flex items-center gap-3 bg-surface-1">
                                        <img src={productPreview!} alt="Preview" className="w-16 h-16 rounded-[var(--radius-sm)] object-cover" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-medium text-fg truncate">{productFile.name}</p>
                                            <p className="text-[11px] text-fg-faint">{(productFile.size / 1024).toFixed(0)} KB</p>
                                        </div>
                                        <button onClick={() => { setProductFile(null); if (productPreview) URL.revokeObjectURL(productPreview); setProductPreview(null); }} className="cursor-pointer w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-surface-2 text-fg-muted hover:text-fg transition-colors">
                                            <X size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                            {productError && (
                                <p className="text-xs text-error flex items-center gap-1"><AlertCircle size={12} /> {productError}</p>
                            )}
                        </div>
                        <div className="p-5 border-t border-edge flex justify-end gap-3">
                            <Button variant="outline" onClick={() => { setShowProductModal(false); setProductError(null); }}>Cancel</Button>
                            <Button
                                variant="default"
                                disabled={!productNameUpload.trim() || !productFile || productUploading}
                                onClick={handleUploadProduct}
                                className={`flex items-center gap-1.5 ${(!productNameUpload.trim() || !productFile) ? 'opacity-50' : ''}`}
                            >
                                {productUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                                {productUploading ? "Uploading..." : "Upload Product"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Generation Board */}
            <GenerationBoard
                onNewGeneration={() => setIsWizardOpen(true)}
                generations={mockGenerations}
                activePipeline={isPipelineOpen ? (
                    <PipelineMonitor
                        isOpen={isPipelineOpen}
                        onClose={() => setIsPipelineOpen(false)}
                        launchData={pipelineLaunchData}
                        brandId={brandId || ""}
                        voiceId={voiceId}
                        talkingPhotoId={brand?.avatars?.find(a => a.id === pipelineLaunchData?.avatarId)?.talkingPhotoId || undefined}
                        lipsyncEngine={lipsyncEngine}
                        onComplete={(url) => {
                            console.log("[pipeline] Complete:", url);
                        }}
                    />
                ) : undefined}
            />
            <NewGenerationWizard
                isOpen={isWizardOpen}
                onClose={() => setIsWizardOpen(false)}
                onLaunch={(result) => {
                    console.log("[wizard] Launch pipeline:", result);
                    const newGen: Generation = {
                        id: `gen_${Math.random().toString(36).substring(2, 8)}`,
                        scriptText: result.videoObjective || "Generando script con IA...",
                        clipCount: 1,
                        status: "running",
                        createdAt: new Date().toISOString(),
                        avatarName: result.avatarName,
                        avatarImageUrl: result.avatarImageUrl,
                        productName: result.productName,
                        productImageUrl: result.productImageUrl,
                        phases: [
                            { id: "script", label: "Guion", status: "running" },
                            { id: "scene", label: "Escenas", status: "pending" },
                            { id: "audio", label: "Audio", status: "pending" },
                            { id: "lipsync", label: "Lip Sync", status: "pending" },
                        ]
                    };
                    setMockGenerations(prev => [newGen, ...prev]);
                    setIsWizardOpen(false);
                    // Open pipeline drawer
                    setPipelineLaunchData(result as WizardLaunchResult);
                    setIsPipelineOpen(true);
                }}
                avatars={brand?.avatars?.filter(a => a.imageUrl && a.filename) || []}
                products={brand?.products || []}
                brandId={brandId || ""}
                avatarImageUrl={avatarImageUrl}
                onProductUploaded={loadBrand}
            />


            {/* ====== MODAL ====== */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />

                    <div className="relative bg-card-bg border border-border rounded-xl shadow-lg w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
                            <div>
                                <h2 className="text-xl font-semibold text-text-primary tracking-tight">
                                    {modalView === "form" ? "Add New Script" : "Pipeline Preview"}
                                </h2>
                                <p className="text-sm text-text-secondary mt-1">
                                    {modalView === "form"
                                        ? "Configure inputs to generate a new UGC video."
                                        : "Mock simulation of the generation pipeline."}
                                </p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={closeModal} className="rounded-full shrink-0">
                                <X size={20} className="text-text-secondary" />
                            </Button>
                        </div>

                        {/* ---- FORM VIEW ---- */}
                        {modalView === "form" && (
                            <>
                                <div className="p-6 space-y-5 flex-1 overflow-y-auto">
                                    <div className="space-y-2">
                                        <Label htmlFor="product">Product Name</Label>
                                        <Input id="product" placeholder="e.g. Basic T-Shirt Black" value={productName} onChange={(e) => setProductName(e.target.value)} />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <Label htmlFor="script">Video Script (Morfeo Structure)</Label>
                                            <button type="button" onClick={() => setScriptText("1. [Hook] Capta la atención en los primeros 3 segs...\n2. [Story 1] Desarrolla contexto / problema...\n3. [Story 2] Introduce tu producto / solución...\n4. [Plot Twist] Revela que es IA o un giro viral...\n5. [CTA] Llamado a la acción claro.")} className="text-[11px] text-primary-accent hover:underline flex items-center gap-1"><Wand2 size={11} /> Load Template</button>
                                        </div>
                                        <Textarea id="script" className="min-h-[120px]" placeholder="1. Hook: ...&#10;2. Story 1: ...&#10;3. Story 2: ...&#10;4. Plot Twist: ...&#10;5. CTA: ..." value={scriptText} onChange={(e) => setScriptText(e.target.value.slice(0, 500))} />
                                        <p className={`text-xs text-right ${scriptText.length > 450 ? 'text-warning' : 'text-text-secondary'}`}>{scriptText.length}/500 characters</p>
                                    </div>

                                    {/* AI Copy Generation */}
                                    <div className="border border-edge rounded-[var(--radius-md)] bg-surface-1/30 overflow-hidden">
                                        <div className="px-3 py-2.5 flex items-center gap-2 border-b border-edge-subtle">
                                            <Wand2 size={14} className="text-accent" />
                                            <span className="text-[12px] font-medium text-fg">Generate with AI</span>
                                            {brand?.brandContext && (
                                                <span className="text-[10px] bg-accent-muted text-accent px-1.5 py-0.5 rounded-full ml-auto">Brand DNA active</span>
                                            )}
                                        </div>
                                        <div className="p-3 space-y-3">
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-medium text-fg-faint uppercase tracking-wider">Tone</p>
                                                    <select value={copyTone} onChange={(e) => setCopyTone(e.target.value as any)} className="w-full h-7 rounded-md border border-edge bg-surface-0 px-2 text-[11px] text-fg cursor-pointer outline-none">
                                                        <option value="engaging">Engaging</option>
                                                        <option value="casual">Casual</option>
                                                        <option value="professional">Professional</option>
                                                        <option value="funny">Funny</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-medium text-fg-faint uppercase tracking-wider">Platform</p>
                                                    <select value={copyPlatform} onChange={(e) => setCopyPlatform(e.target.value as any)} className="w-full h-7 rounded-md border border-edge bg-surface-0 px-2 text-[11px] text-fg cursor-pointer outline-none">
                                                        <option value="tiktok">TikTok</option>
                                                        <option value="instagram">Instagram</option>
                                                        <option value="youtube">YouTube</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-medium text-fg-faint uppercase tracking-wider">Language</p>
                                                    <select value={copyLang} onChange={(e) => setCopyLang(e.target.value as any)} className="w-full h-7 rounded-md border border-edge bg-surface-0 px-2 text-[11px] text-fg cursor-pointer outline-none">
                                                        <option value="es">Spanish</option>
                                                        <option value="en">English</option>
                                                    </select>
                                                </div>
                                            </div>
                                            {copyError && (
                                                <p className="text-[11px] text-error flex items-center gap-1"><AlertCircle size={12} /> {copyError}</p>
                                            )}
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="w-full flex items-center justify-center gap-2 h-8 text-xs"
                                                disabled={copyGenerating || !brand?.brandContext}
                                                onClick={handleGenerateCopy}
                                            >
                                                {copyGenerating ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                                                {copyGenerating ? "Generating..." : "Generate Script"}
                                            </Button>
                                            {!brand?.brandContext && (
                                                <p className="text-[10px] text-fg-faint text-center">Set up your Brand DNA first to enable AI script generation.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Clip Mode — in the form */}
                                    <div className="space-y-3">
                                        <Label>Clip Mode</Label>
                                        <div className="flex gap-3">
                                            {([1, 2, 3] as const).map((n) => (
                                                <button key={n} onClick={() => setClipCount(n)} type="button"
                                                    className={`cursor-pointer flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-all ${clipCount === n ? "border-primary-accent bg-primary-accent/5 text-primary-accent" : "border-border bg-card-bg text-text-secondary hover:text-text-primary"}`}>
                                                    <div className="flex flex-col items-center gap-1">
                                                        <SplitSquareHorizontal size={18} />
                                                        <span>{n === 1 ? "Single Clip" : `${n} Segments`}</span>
                                                        <span className="text-xs font-normal">{n === 1 ? "One continuous video" : "Split & stitch"}</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                        {/* Segment preview (only if 3 segments and script exists) */}
                                        {clipCount > 1 && scriptText.trim() && (
                                            <div>
                                                <button onClick={() => setShowSegments(!showSegments)} type="button" className="cursor-pointer flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors w-full">
                                                    {showSegments ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                    <span className="font-medium">Preview {splitIntoSegments(scriptText.trim(), clipCount).length} segments</span>
                                                </button>
                                                {showSegments && (
                                                    <div className="mt-2 space-y-2">
                                                        {splitIntoSegments(scriptText.trim(), clipCount).map((seg, i) => (
                                                            <div key={i} className="flex gap-3 items-start p-3 rounded-lg bg-primary-bg border border-border">
                                                                <span className="text-[11px] font-bold text-primary-accent bg-primary-accent/10 rounded px-1.5 py-0.5 shrink-0 font-mono">#{i + 1}</span>
                                                                <p className="text-xs text-text-secondary leading-relaxed">{seg}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Lip Sync Engine Selector */}
                                    <div className="space-y-2">
                                        <Label>Lip Sync Engine</Label>
                                        <div className="flex bg-primary-bg rounded-lg p-1 border border-border">
                                            <button type="button" onClick={() => setLipsyncEngine("heygen")}
                                                className={`cursor-pointer flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${lipsyncEngine === "heygen" ? "bg-card-bg text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
                                                    }`}>
                                                <Video size={15} /> HeyGen
                                            </button>
                                            <button type="button" onClick={() => setLipsyncEngine("fabric")}
                                                className={`cursor-pointer flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${lipsyncEngine === "fabric" ? "bg-card-bg text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
                                                    }`}>
                                                <Sparkles size={15} /> Fabric 1.0 (Morfeo)
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-text-secondary">
                                            {lipsyncEngine === "heygen"
                                                ? "Photo → TTS lip sync (HeyGen Talking Photo)"
                                                : "Multishot Curating → Fabric 1.0 Lip Sync (Morfeo Engine)"}
                                        </p>
                                    </div>

                                    {/* Image Generation with Multishot (only for Fabric engine) */}
                                    {lipsyncEngine === "fabric" && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Label className="flex items-center gap-2">
                                                    <Wand2 size={14} />
                                                    Generate Image
                                                </Label>
                                                <button
                                                    type="button"
                                                    onClick={() => setEnableImageGen(!enableImageGen)}
                                                    className={`cursor-pointer relative w-10 h-5 rounded-full transition-colors ${enableImageGen ? "bg-primary-accent" : "bg-border"}`}
                                                >
                                                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${enableImageGen ? "translate-x-5" : "translate-x-0.5"}`} />
                                                </button>
                                            </div>
                                            <p className="text-[10px] text-text-secondary">
                                                Composite avatar + product/background using AI before generating video
                                            </p>
                                            {enableImageGen && (
                                                <div className="space-y-3 mt-2">
                                                    {/* Scene tabs (multi-segment) */}
                                                    {clipCount > 1 && (
                                                        <div className="flex bg-primary-bg rounded-lg p-1 border border-border">
                                                            {scenes.map((_s, idx) => (
                                                                <button
                                                                    key={idx}
                                                                    type="button"
                                                                    onClick={() => setActiveSceneTab(idx)}
                                                                    className={`cursor-pointer flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeSceneTab === idx ? "bg-card-bg text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"}`}
                                                                >
                                                                    Scene {idx + 1}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Scene cards */}
                                                    {scenes.map((scene, idx) => (
                                                        <div key={idx} className={`space-y-3 ${clipCount > 1 && idx !== activeSceneTab ? "hidden" : ""}`}>
                                                            {/* Prompt */}
                                                            <div className="space-y-1.5">
                                                                <Label className="text-xs flex items-center gap-1.5">
                                                                    <FileText size={12} />
                                                                    Scene Prompt {clipCount > 1 && `(Seg ${idx + 1})`}
                                                                </Label>
                                                                <Textarea
                                                                    placeholder="Describe the scene... e.g. 'Person holding a black t-shirt in a workshop, natural light, photorealistic'"
                                                                    value={scene.prompt}
                                                                    onChange={(e) => updateScene(idx, { prompt: e.target.value })}
                                                                    className="text-sm resize-none"
                                                                    rows={2}
                                                                />
                                                            </div>

                                                            {/* Product Image */}
                                                            <div className="space-y-1.5">
                                                                <Label className="text-xs flex items-center gap-1.5">
                                                                    <Image size={12} /> Product Image
                                                                </Label>
                                                                {scene.productPreview ? (
                                                                    <div className="relative group">
                                                                        <img src={scene.productPreview} alt="Product" className="w-full h-20 object-contain bg-primary-bg border border-border rounded-lg" />
                                                                        <button type="button" className="cursor-pointer absolute top-1 right-1 p-1 bg-black/60 rounded-md text-white opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => updateScene(idx, { productFile: null, productPreview: undefined })}>
                                                                            <X size={12} />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <label className="cursor-pointer flex items-center justify-center gap-2 h-14 border border-dashed border-border rounded-lg text-text-secondary text-xs hover:border-primary-accent hover:text-primary-accent transition-colors">
                                                                        <Upload size={14} /> Upload product photo
                                                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                                                            const f = e.target.files?.[0];
                                                                            if (f) { const r = new FileReader(); r.onload = () => updateScene(idx, { productFile: f, productPreview: r.result as string }); r.readAsDataURL(f); }
                                                                        }} />
                                                                    </label>
                                                                )}
                                                            </div>

                                                            {/* Background Image */}
                                                            <div className="space-y-1.5">
                                                                <Label className="text-xs flex items-center gap-1.5">
                                                                    <Image size={12} /> Background / Environment
                                                                </Label>
                                                                {scene.backgroundPreview ? (
                                                                    <div className="relative group">
                                                                        <img src={scene.backgroundPreview} alt="Background" className="w-full h-20 object-cover bg-primary-bg border border-border rounded-lg" />
                                                                        <button type="button" className="cursor-pointer absolute top-1 right-1 p-1 bg-black/60 rounded-md text-white opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => updateScene(idx, { backgroundFile: null, backgroundPreview: undefined })}>
                                                                            <X size={12} />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <label className="cursor-pointer flex items-center justify-center gap-2 h-14 border border-dashed border-border rounded-lg text-text-secondary text-xs hover:border-primary-accent hover:text-primary-accent transition-colors">
                                                                        <Upload size={14} /> Upload background / scene ref
                                                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                                                            const f = e.target.files?.[0];
                                                                            if (f) { const r = new FileReader(); r.onload = () => updateScene(idx, { backgroundFile: f, backgroundPreview: r.result as string }); r.readAsDataURL(f); }
                                                                        }} />
                                                                    </label>
                                                                )}
                                                            </div>

                                                        </div>
                                                    ))}
                                                    <p className="text-[10px] text-text-secondary">Avatar is auto-included. Add product + background for the Multishot AI composite.</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        <Label>Product Visual</Label>
                                        <div className="flex bg-primary-bg rounded-lg p-1 border border-border">
                                            <button type="button" onClick={() => setImageMode("upload")}
                                                className={`cursor-pointer flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${imageMode === "upload" ? "bg-card-bg text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"}`}>
                                                <Upload size={15} /> Upload Image
                                            </button>
                                            <button type="button" onClick={() => setImageMode("generate")}
                                                className={`cursor-pointer flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${imageMode === "generate" ? "bg-card-bg text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"}`}>
                                                <Sparkles size={15} /> Generate with AI
                                            </button>
                                        </div>
                                        {imageMode === "upload" && (
                                            <>
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept="image/png,image/jpeg,image/webp"
                                                    className="hidden"
                                                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                                                />
                                                {!uploadedFile ? (
                                                    <div
                                                        onClick={() => fileInputRef.current?.click()}
                                                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                                        onDragLeave={() => setIsDragging(false)}
                                                        onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
                                                        className={`border border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer ${isDragging
                                                            ? "border-accent bg-accent-muted"
                                                            : "border-border hover:bg-primary-bg"
                                                            }`}
                                                    >
                                                        <div className="w-10 h-10 bg-card-bg border border-border rounded-full flex items-center justify-center mb-2">
                                                            <Upload size={18} className="text-text-secondary" />
                                                        </div>
                                                        <span className="text-sm font-medium text-text-primary">
                                                            {isDragging ? "Drop image here" : "Click or drag to upload"}
                                                        </span>
                                                        <span className="text-xs text-text-secondary mt-1">PNG, JPG or WebP (Max 5MB)</span>
                                                    </div>
                                                ) : (
                                                    <div className="border border-border rounded-lg p-3 flex items-center gap-3 bg-primary-bg">
                                                        <img src={previewUrl!} alt="Preview" className="w-14 h-14 rounded-md object-cover border border-edge-subtle" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-text-primary truncate">{uploadedFile.name}</p>
                                                            <p className="text-xs text-text-secondary">{(uploadedFile.size / 1024).toFixed(0)} KB</p>
                                                        </div>
                                                        <button onClick={clearUpload} className="cursor-pointer w-7 h-7 flex items-center justify-center rounded-md hover:bg-surface-2 text-fg-muted hover:text-fg transition-colors">
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        {imageMode === "generate" && (
                                            <div className="space-y-3">
                                                <div className="border border-border rounded-lg p-4 bg-primary-bg/50">
                                                    <div className="flex items-start gap-3 mb-3">
                                                        <div className="w-8 h-8 bg-primary-accent/10 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                                                            <Sparkles size={16} className="text-primary-accent" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-text-primary">Nano Banana 2</p>
                                                            <p className="text-xs text-text-secondary mt-0.5">Describe the product scene you want to generate.</p>
                                                        </div>
                                                    </div>
                                                    <Textarea id="image-prompt" className="min-h-[80px] bg-card-bg" placeholder="e.g. A black basic t-shirt on a clean white surface, natural lighting, lifestyle photography, high quality" />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-1.5">
                                                        <p className="text-xs font-medium text-text-secondary">Resolution</p>
                                                        <div className="flex bg-primary-bg rounded-md p-0.5 border border-border">
                                                            {(["1K", "2K", "4K"] as const).map((res) => (
                                                                <button key={res} type="button" onClick={() => setImageRes(res)}
                                                                    className={`cursor-pointer flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all ${imageRes === res ? "bg-card-bg text-text-primary shadow-sm" : "bg-transparent text-text-secondary hover:text-text-primary"}`}>
                                                                    {res}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <p className="text-xs font-medium text-text-secondary">Aspect Ratio</p>
                                                        <select className="flex h-[34px] w-full rounded-md border border-border bg-card-bg px-2.5 py-1 text-xs text-text-primary focus:border-primary-accent outline-none cursor-pointer">
                                                            <option>9:16 (Vertical)</option>
                                                            <option>1:1 (Square)</option>
                                                            <option>16:9 (Landscape)</option>
                                                            <option>4:5 (Portrait)</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <Button variant="outline" className="w-full flex items-center gap-2 justify-center">
                                                    <Image size={16} /> Generate Preview
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="voice">Voice Preset</Label>
                                        <select id="voice" value={voiceId} onChange={(e) => setVoiceId(e.target.value)} className="flex h-10 w-full rounded-md border border-border bg-card-bg px-3 py-2 text-sm text-text-primary focus:border-primary-accent outline-none cursor-pointer">
                                            {brand?.voicePresets?.map((vp) => (
                                                <option key={vp.id} value={vp.id}>{vp.name}</option>
                                            ))}
                                            <option value="default-female">Female (Default)</option>
                                            <option value="default-male">Male (Energetic)</option>
                                        </select>
                                    </div>


                                    {/* Avatar selection */}
                                    <div className="space-y-3">
                                        <Label>Avatar {clipCount > 1 ? "(per segment)" : ""}</Label>
                                        {brandAvatars.length === 0 ? (
                                            <div className="border border-dashed border-edge rounded-lg p-4 text-center">
                                                <UserCircle size={20} className="mx-auto text-fg-faint mb-1" />
                                                <p className="text-sm text-fg-muted">No avatars available</p>
                                                <p className="text-xs text-fg-faint mt-0.5">
                                                    {lipsyncEngine === "fabric"
                                                        ? "Upload avatar images above. HeyGen-imported avatars don't work with Fabric 1.0."
                                                        : "Upload avatars in the panel above to use them here."}
                                                </p>
                                            </div>
                                        ) : (
                                            <>
                                                {Array.from({ length: clipCount }).map((_, segIdx) => (
                                                    <div key={segIdx}>
                                                        {clipCount > 1 && (
                                                            <p className="text-xs font-medium text-text-secondary mb-2">Segment {segIdx + 1}</p>
                                                        )}
                                                        <div className="grid grid-cols-4 gap-2 max-h-[160px] overflow-y-auto pr-1">
                                                            {brandAvatars.map((av) => (
                                                                <button
                                                                    key={av.id}
                                                                    type="button"
                                                                    onClick={() => selectAvatar(lipsyncEngine === "fabric" ? av.id : (av.talkingPhotoId || av.id), segIdx)}
                                                                    className={`cursor-pointer rounded-lg border-2 p-1 transition-all flex flex-col items-center gap-1 ${selectedAvatars[segIdx] === (lipsyncEngine === "fabric" ? av.id : av.talkingPhotoId)
                                                                        ? "border-primary-accent bg-primary-accent/5"
                                                                        : "border-transparent hover:border-border"
                                                                        }`}
                                                                >
                                                                    <img
                                                                        src={avatarImageUrl(av.imageUrl)}
                                                                        alt={av.name}
                                                                        className="w-full aspect-square rounded-md object-cover bg-primary-bg"
                                                                        loading="lazy"
                                                                    />
                                                                    <span className="text-[10px] text-text-secondary truncate w-full text-center">{av.name}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="p-6 border-t border-border bg-primary-bg flex flex-col gap-2 rounded-b-xl shrink-0">
                                    {/* Missing avatar warning */}
                                    {scriptText.trim() && selectedAvatars.filter(Boolean).length < clipCount && brandAvatars.length > 0 && (
                                        <p className="text-xs text-warning text-center">⚠ Select an avatar{clipCount > 1 ? " for each segment" : ""} before generating</p>
                                    )}
                                    <div className="flex justify-end gap-3">
                                        <Button variant="outline" onClick={closeModal}>Cancel</Button>
                                        <Button variant="outline" className="flex items-center gap-2" onClick={() => setModalView("preview")}>
                                            <Eye size={16} /> Preview Pipeline
                                        </Button>
                                        <Button
                                            variant="default"
                                            className={`flex items-center gap-2 ${!scriptText.trim() ? 'opacity-50' : ''}`}
                                            disabled={!scriptText.trim() || isGenerating}
                                            onClick={handleSaveAndGenerate}
                                        >
                                            {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                                            {isGenerating ? 'Generating…' : 'Save & Generate'}
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ---- PIPELINE PREVIEW VIEW ---- */}
                        {modalView === "preview" && (
                            <>
                                <div className="p-6 space-y-5 flex-1 overflow-y-auto">
                                    {/* Config summary */}
                                    <div className="border border-border rounded-lg p-4 bg-primary-bg/50 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">Script</span>
                                            <span className="text-xs text-text-secondary">{clipCount === 1 ? "Single clip" : `${clipCount} segments`}</span>
                                        </div>
                                        <p className="text-sm text-text-primary leading-relaxed line-clamp-2">{scriptText || MOCK_SCRIPT}</p>
                                        <div className="flex items-center gap-4 pt-1">
                                            <span className="text-xs text-text-secondary">🎙 {brand?.voicePresets?.find(v => v.id === voiceId)?.name || (voiceId === "default-female" ? "Female" : "Male")}</span>
                                            <span className="text-xs text-text-secondary">🖼 {imageMode === "upload" ? (uploadedFile ? uploadedFile.name : "Upload") : "AI Generate"}</span>
                                        </div>
                                    </div>

                                    {/* Start button (only when pipeline hasn't started yet) */}
                                    {pipeline.steps.length === 0 && (
                                        <Button className="w-full flex items-center justify-center gap-2 h-11" variant="default" onClick={() => pipeline.start({ scriptText: scriptText.trim() || MOCK_SCRIPT, voiceId, clipCount, imageMode, talkingPhotoIds: selectedAvatars, uploadedFile, lipsyncEngine, avatarImageFullUrl: getSelectedAvatarImageUrl(), klingDuration: "5", enableImageGen, scenes })}>
                                            <Play size={16} /> Run Pipeline
                                        </Button>
                                    )}

                                    {/* ═══════ HORIZONTAL TIMELINE ═══════ */}
                                    {pipeline.steps.length > 0 && (() => {
                                        // Group steps into logical phases for the timeline
                                        type Phase = { id: string; label: string; icon: React.ReactNode; steps: typeof pipeline.steps; status: StepStatus };
                                        const phases: Phase[] = [];

                                        const pSteps = pipeline.steps;
                                        // Audio phase
                                        const audioSteps = pSteps.filter(s => s.id.startsWith("audio-") || s.id.startsWith("qa-audio-") || s.id === "split");
                                        if (audioSteps.length > 0) {
                                            const aStatus = audioSteps.every(s => s.status === "done") ? "done"
                                                : audioSteps.some(s => s.status === "error") ? "error"
                                                    : audioSteps.some(s => s.status === "review") ? "review"
                                                        : audioSteps.some(s => s.status === "running") ? "running" : "idle";
                                            phases.push({ id: "phase-audio", label: "Audio", icon: <Mic size={18} />, steps: audioSteps, status: aStatus });
                                        }
                                        // Image phase
                                        const imgSteps = pSteps.filter(s => s.id.startsWith("image-gen-") || s.id.startsWith("qa-image-gen-"));
                                        if (imgSteps.length > 0) {
                                            const iStatus = imgSteps.every(s => s.status === "done") ? "done"
                                                : imgSteps.some(s => s.status === "error") ? "error"
                                                    : imgSteps.some(s => s.status === "review") ? "review"
                                                        : imgSteps.some(s => s.status === "running") ? "running" : "idle";
                                            phases.push({ id: "phase-image", label: "Image Gen", icon: <Wand2 size={18} />, steps: imgSteps, status: iStatus });
                                        }
                                        // Kling phase
                                        const klingSteps = pSteps.filter(s => s.id.startsWith("kling-video-") || s.id.startsWith("qa-kling-"));
                                        if (klingSteps.length > 0) {
                                            const kStatus = klingSteps.every(s => s.status === "done") ? "done"
                                                : klingSteps.some(s => s.status === "error") ? "error"
                                                    : klingSteps.some(s => s.status === "review") ? "review"
                                                        : klingSteps.some(s => s.status === "running") ? "running" : "idle";
                                            phases.push({ id: "phase-kling", label: "Kling Video", icon: <Film size={18} />, steps: klingSteps, status: kStatus });
                                        }
                                        // Lip Sync phase
                                        const lipSteps = pSteps.filter(s => s.id.startsWith("lip-"));
                                        if (lipSteps.length > 0) {
                                            const lStatus = lipSteps.every(s => s.status === "done") ? "done"
                                                : lipSteps.some(s => s.status === "error") ? "error"
                                                    : lipSteps.some(s => s.status === "running") ? "running" : "idle";
                                            phases.push({ id: "phase-lipsync", label: "Lip Sync", icon: <Video size={18} />, steps: lipSteps, status: lStatus });
                                        }
                                        // Render phase
                                        const renderSteps = pSteps.filter(s => s.id === "render");
                                        if (renderSteps.length > 0) {
                                            phases.push({ id: "phase-render", label: "Export", icon: <Download size={18} />, steps: renderSteps, status: renderSteps[0].status });
                                        }

                                        return (
                                            <div className="space-y-5">
                                                {/* Progress bar */}
                                                <div>
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-xs font-medium text-text-primary">
                                                            {pipeline.error ? `❌ Error` : pipeline.isDone ? "✅ Complete" : pipeline.paused ? "⏸ Review needed" : pipeline.isRunning ? "Processing…" : "Ready"}
                                                        </span>
                                                        <span className="text-xs font-medium text-primary-accent">{pipeline.progress}%</span>
                                                    </div>
                                                    <div className="h-1.5 bg-primary-bg rounded-full overflow-hidden border border-border">
                                                        <div className="h-full bg-primary-accent rounded-full transition-all duration-500" style={{ width: `${pipeline.progress}%` }} />
                                                    </div>
                                                </div>

                                                {/* ── Horizontal Timeline ── */}
                                                <div className="relative">
                                                    <div className="flex items-center justify-between">
                                                        {phases.map((phase, idx) => {
                                                            const isClickable = phase.status === "done" || phase.status === "review";
                                                            return (
                                                                <div key={phase.id} className="flex items-center flex-1">
                                                                    {/* Node */}
                                                                    <button
                                                                        type="button"
                                                                        className={`
                                                                            relative flex flex-col items-center gap-2 group transition-all duration-200 w-full
                                                                            ${isClickable ? "cursor-pointer" : "cursor-default"}
                                                                        `}
                                                                        onClick={() => {
                                                                            if (isClickable) {
                                                                                // Find the relevant step to show in popup
                                                                                const reviewStep = phase.steps.find(s => s.status === "review");
                                                                                const doneStep = [...phase.steps].reverse().find(s => s.status === "done");
                                                                                setTimelinePopup(reviewStep?.id || doneStep?.id || phase.steps[0].id);
                                                                            }
                                                                        }}
                                                                    >
                                                                        {/* Circle */}
                                                                        <div className={`
                                                                            w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 border-2
                                                                            ${phase.status === "done" ? "bg-success/15 border-success text-success" :
                                                                                phase.status === "running" ? "bg-primary-accent/15 border-primary-accent text-primary-accent animate-pulse" :
                                                                                    phase.status === "review" ? "bg-warning/15 border-warning text-warning animate-pulse" :
                                                                                        phase.status === "error" ? "bg-error/15 border-error text-error" :
                                                                                            "bg-primary-bg border-border text-text-secondary/40"}
                                                                        `}>
                                                                            {phase.status === "done" ? <CheckCircle2 size={20} /> :
                                                                                phase.status === "running" ? <Loader2 size={20} className="animate-spin" /> :
                                                                                    phase.status === "error" ? <AlertCircle size={20} /> :
                                                                                        phase.icon}
                                                                        </div>
                                                                        {/* Label */}
                                                                        <span className={`
                                                                            text-[11px] font-medium transition-colors
                                                                            ${phase.status === "done" ? "text-success" :
                                                                                phase.status === "running" || phase.status === "review" ? "text-text-primary" :
                                                                                    phase.status === "error" ? "text-error" :
                                                                                        "text-text-secondary/50"}
                                                                        `}>
                                                                            {phase.label}
                                                                        </span>
                                                                        {/* Review badge */}
                                                                        {phase.status === "review" && (
                                                                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-warning rounded-full flex items-center justify-center text-[10px] font-bold text-black">!</span>
                                                                        )}
                                                                    </button>
                                                                    {/* Connector line */}
                                                                    {idx < phases.length - 1 && (
                                                                        <div className={`
                                                                            h-0.5 flex-1 mx-1 rounded-full transition-colors duration-500
                                                                            ${phase.status === "done" ? "bg-success/40" : "bg-border"}
                                                                        `} />
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* ── Detailed sub-steps ── */}
                                                <div className="bg-primary-bg/30 border border-border rounded-lg p-3 space-y-1">
                                                    {pSteps.map((step) => (
                                                        <div key={step.id} className={`
                                                            flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs transition-colors
                                                            ${step.status === "running" ? "bg-primary-accent/5" :
                                                                step.status === "review" ? "bg-warning/5" :
                                                                    step.status === "error" ? "bg-error/5" : ""}
                                                        `}>
                                                            {step.status === "done" ? <CheckCircle2 size={13} className="text-success shrink-0" /> :
                                                                step.status === "running" ? <Loader2 size={13} className="text-primary-accent animate-spin shrink-0" /> :
                                                                    step.status === "review" ? <Eye size={13} className="text-warning shrink-0" /> :
                                                                        step.status === "error" ? <AlertCircle size={13} className="text-error shrink-0" /> :
                                                                            <Circle size={13} className="text-border-color shrink-0" />}
                                                            <span className={`flex-1 truncate ${step.status === "idle" ? "text-text-secondary/50" : step.status === "error" ? "text-error" : "text-text-primary"}`}>
                                                                {step.label}
                                                            </span>
                                                            {step.status === "error" && step.errorMsg && (
                                                                <span className="text-error truncate max-w-[180px]">{step.errorMsg}</span>
                                                            )}
                                                            {step.duration && <span className="text-text-secondary font-mono shrink-0">{step.duration}s</span>}
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* ── Error display ── */}
                                                {pipeline.error && (
                                                    <div className="bg-error/5 border border-error/20 rounded-lg p-3 flex items-start gap-2">
                                                        <AlertCircle size={16} className="text-error shrink-0 mt-0.5" />
                                                        <p className="text-xs text-error">{pipeline.error}</p>
                                                    </div>
                                                )}

                                                {/* ── Final Results ── */}
                                                {pipeline.isDone && (() => {
                                                    const videoEntries = Object.entries(pipeline.videoUrls).filter(([id]) => id.startsWith("lip-"));
                                                    if (videoEntries.length === 0) return (
                                                        <div className="bg-success/5 border border-success/20 rounded-lg p-4 flex items-center gap-3">
                                                            <Film size={18} className="text-success" />
                                                            <div>
                                                                <p className="text-sm font-semibold text-text-primary">Pipeline Complete</p>
                                                                <p className="text-xs text-text-secondary">All steps finished</p>
                                                            </div>
                                                        </div>
                                                    );
                                                    return (
                                                        <div className="bg-success/5 border border-success/20 rounded-lg overflow-hidden">
                                                            <div className="px-4 py-3 flex items-center gap-3 border-b border-success/10">
                                                                <div className="w-8 h-8 bg-success/10 rounded-lg flex items-center justify-center">
                                                                    <Film size={16} className="text-success" />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <p className="text-sm font-semibold text-text-primary">✅ {videoEntries.length} video{videoEntries.length > 1 ? 's' : ''} ready</p>
                                                                    <p className="text-xs text-text-secondary">9:16 vertical • Ready to download</p>
                                                                </div>
                                                            </div>
                                                            <div className="p-4 space-y-3">
                                                                {videoEntries.map(([stepId, url]) => (
                                                                    <div key={stepId} className="bg-card-bg border border-border rounded-lg overflow-hidden">
                                                                        <div className="p-3 flex justify-center bg-black/30">
                                                                            <video controls src={url} className="max-h-[400px] w-auto rounded-md" style={{ aspectRatio: '9/16' }} />
                                                                        </div>
                                                                        <div className="px-3 py-2.5 border-t border-border flex items-center justify-between">
                                                                            <span className="text-xs text-text-secondary">{stepId.replace('lip-', 'Segment ')}</span>
                                                                            <Button variant="default" size="sm" onClick={() => downloadFile(url, `${stepId.replace('lip-', 'segment_')}.mp4`)} className="flex items-center gap-1.5 h-7 text-xs">
                                                                                <Download size={12} /> Download
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        );
                                    })()}
                                </div>

                                <div className="p-6 border-t border-border bg-primary-bg flex justify-between rounded-b-xl shrink-0">
                                    <Button variant="outline" className="flex items-center gap-2" onClick={() => { setModalView("form"); setIsGenerating(false); pipeline.reset(); }}>
                                        <ArrowLeft size={16} /> Back to Form
                                    </Button>
                                    <Button variant="outline" onClick={closeModal}>Close</Button>
                                </div>

                                {/* ═══════ STEP REVIEW POPUP ═══════ */}
                                {timelinePopup && (() => {
                                    const step = pipeline.steps.find(s => s.id === timelinePopup);
                                    if (!step) return null;

                                    // Determine content to show
                                    const isQaAudio = step.id.startsWith("qa-audio-");
                                    const isQaKling = step.id.startsWith("qa-kling-");
                                    const isQaImageGen = step.id.startsWith("qa-image-gen-");
                                    const isAudioStep = step.id.startsWith("audio-");
                                    const isKlingStep = step.id.startsWith("kling-video-");
                                    const isImageGenStep = step.id.startsWith("image-gen-");
                                    const isLipStep = step.id.startsWith("lip-");

                                    const audioStepId = isQaAudio ? step.id.replace("qa-", "") : step.id;
                                    const audioUrl = pipeline.audioUrls[audioStepId];
                                    const audioDur = pipeline.audioDurations?.[audioStepId];
                                    // Resolve kling URL: for kling-video-N or qa-kling-N, get the matching video
                                    const klingStepId = isQaKling ? step.id.replace("qa-kling-", "kling-video-") : step.id;
                                    const klingUrl = pipeline.videoUrls[klingStepId] || pipeline.klingVideoUrl;
                                    const lipUrl = isLipStep ? pipeline.videoUrls[step.id] : null;
                                    // Resolve generated image for this segment
                                    const imgGenStepId = isQaImageGen ? step.id.replace("qa-image-gen-", "image-gen-") : step.id;
                                    const generatedImgUrl = pipeline.generatedImageUrls[imgGenStepId] || null;
                                    const isReview = step.status === "review";

                                    return (
                                        <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={() => setTimelinePopup(null)}>
                                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                                            <div className="relative z-10 w-full max-w-md mx-4 bg-card-bg border border-border rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                                                {/* Header */}
                                                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`
                                                        w-9 h-9 rounded-lg flex items-center justify-center
                                                        ${isReview ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}
                                                    `}>
                                                            {step.icon}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold text-text-primary">{step.label}</p>
                                                            <p className="text-xs text-text-secondary">{step.desc}</p>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => setTimelinePopup(null)} className="text-text-secondary hover:text-text-primary p-1.5 rounded-md hover:bg-primary-bg transition-colors">
                                                        <X size={16} />
                                                    </button>
                                                </div>

                                                {/* Content */}
                                                <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                                                    {/* Audio Player */}
                                                    {(isQaAudio || isAudioStep) && (
                                                        <div className="bg-primary-bg/50 border border-border rounded-lg p-4">
                                                            <div className="flex items-center gap-3 mb-3">
                                                                <div className="w-8 h-8 bg-primary-accent/10 rounded-full flex items-center justify-center">
                                                                    <Headphones size={16} className="text-primary-accent" />
                                                                </div>
                                                                <p className="text-xs font-medium text-text-primary uppercase tracking-wider">Generated Audio</p>
                                                                {audioDur && <span className="text-[10px] text-text-secondary ml-auto">{audioDur}s</span>}
                                                            </div>
                                                            {audioUrl ? (
                                                                <audio controls src={audioUrl} className="w-full h-10" />
                                                            ) : (
                                                                <p className="text-xs text-text-secondary">Audio not yet available</p>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Product Image */}
                                                    {isQaAudio && previewUrl && (
                                                        <div className="bg-primary-bg/50 border border-border rounded-lg overflow-hidden">
                                                            <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
                                                                <Image size={13} className="text-text-secondary" />
                                                                <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">Product Visual</span>
                                                            </div>
                                                            <div className="p-3 flex justify-center bg-black/20">
                                                                <img src={previewUrl} alt="Product visual" className="max-h-[200px] w-auto rounded-md object-contain" />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Generated Image (nano-banana-2/edit) */}
                                                    {(isQaImageGen || isImageGenStep) && (
                                                        <div className="bg-primary-bg/50 border border-border rounded-lg overflow-hidden">
                                                            <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
                                                                <Wand2 size={13} className="text-text-secondary" />
                                                                <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">Generated Image</span>
                                                                {generatedImgUrl && <span className="text-[10px] text-success ml-auto flex items-center gap-1"><CheckCircle2 size={10} /> Ready</span>}
                                                            </div>
                                                            <div className="p-3 flex justify-center bg-black/20">
                                                                {generatedImgUrl ? (
                                                                    <img src={generatedImgUrl} alt="Generated composite" className="max-h-[320px] w-auto rounded-md object-contain" style={{ aspectRatio: '9/16' }} />
                                                                ) : (
                                                                    <div className="h-[200px] flex items-center justify-center text-text-secondary text-xs">
                                                                        <Loader2 size={20} className="animate-spin mr-2" /> Generating...
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Kling Video */}
                                                    {(isQaKling || isKlingStep) && (
                                                        <div className="bg-primary-bg/50 border border-border rounded-lg overflow-hidden">
                                                            <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
                                                                <Film size={13} className="text-primary-accent" />
                                                                <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">Kling Avatar Video</span>
                                                                {klingUrl && <span className="text-[10px] text-success ml-auto flex items-center gap-1"><CheckCircle2 size={10} /> Ready</span>}
                                                            </div>
                                                            <div className="p-3 flex justify-center bg-black/30">
                                                                {klingUrl ? (
                                                                    <video controls autoPlay src={klingUrl} className="max-h-[320px] w-auto rounded-md" style={{ aspectRatio: '9/16' }} />
                                                                ) : (
                                                                    <p className="text-xs text-text-secondary py-8">Video not yet available</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Lip Sync Video */}
                                                    {isLipStep && lipUrl && (
                                                        <div className="bg-primary-bg/50 border border-border rounded-lg overflow-hidden">
                                                            <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
                                                                <Video size={13} className="text-success" />
                                                                <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">Lip Sync Result</span>
                                                                <span className="text-[10px] text-success ml-auto flex items-center gap-1"><CheckCircle2 size={10} /> Ready</span>
                                                            </div>
                                                            <div className="p-3 flex justify-center bg-black/30">
                                                                <video controls autoPlay src={lipUrl} className="max-h-[320px] w-auto rounded-md" style={{ aspectRatio: '9/16' }} />
                                                            </div>
                                                            <div className="px-3 py-2 border-t border-border flex justify-end">
                                                                <a href={lipUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary-accent hover:underline flex items-center gap-1">
                                                                    <Download size={11} /> Open full video
                                                                </a>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Duration info */}
                                                    {step.duration && (
                                                        <p className="text-xs text-text-secondary text-center">Generated in {step.duration}s</p>
                                                    )}
                                                </div>

                                                {/* Actions */}
                                                {isReview ? (
                                                    <div className="px-5 py-4 border-t border-border flex gap-3">
                                                        <Button variant="outline" className="flex-1 flex items-center justify-center gap-1.5" onClick={() => { setTimelinePopup(null); pipeline.regenerate(); }}>
                                                            <RotateCcw size={14} /> Regenerate
                                                        </Button>
                                                        <Button variant="default" className="flex-1 flex items-center justify-center gap-1.5" onClick={() => { setTimelinePopup(null); pipeline.approve(); }}>
                                                            <ThumbsUp size={14} /> Approve
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="px-5 py-4 border-t border-border flex justify-end">
                                                        <Button variant="outline" onClick={() => setTimelinePopup(null)} className="flex items-center gap-1.5">
                                                            Close
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
