/**
 * Manual Lab v2 — Freepik-style layout (image-only en v1).
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ TopNav (compartido)                                         │
 *   ├──────────────────────────┬──────────────────────────────────┤
 *   │ SIDEBAR (380px fijo)     │ GALERÍA (scroll vertical infinito)│
 *   │ - mode toggle (img)      │ - todas las generaciones de la   │
 *   │ - refs grid              │   sesión + las persistidas       │
 *   │ - subir / asset picker   │ - newest first                   │
 *   │ - look & feel            │ - card grande con acciones       │
 *   │ - prompt textarea        │                                  │
 *   │ - modelo / AR / res / K  │                                  │
 *   │ - tal cual / curar       │                                  │
 *   │ - generar                │                                  │
 *   └──────────────────────────┴──────────────────────────────────┘
 *
 * Diferencias con v1 deliberadas:
 *  - Layout split (sidebar fijo + galería der) en vez de chat conversacional.
 *  - Solo image-mode en v1 — para video, el usuario va al Lab v1 (`/dashboard/lab`).
 *  - Sin Copiloto panel, sin audio refs, sin batch mode (cosas avanzadas que pueden
 *    sumarse en v2.1 si esta versión termina ganando).
 *  - Galería siempre visible a la derecha (no drawer colapsable).
 *
 * Reusa las APIs y helpers de v1 (createImageEdit, pollImageGen, etc.) — cambia el
 * UI, no la lógica de generación.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
    Wand2, Plus, X, Loader2, Image as ImageIcon, RefreshCw, Sun,
    Download, RotateCcw, Sparkles, FlaskConical, AlertTriangle,
    Mic, MicOff, Video, Eye, ChevronLeft, ChevronRight, Target,
} from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import { useDictation } from "../lib/useDictation";
import {
    createImageEdit, createTextToImage, pollImageGen,
    saveGeneration, fetchManualGenerations,
    avatarImageUrl, productImageUrl, clothingImageUrl, backgroundImageUrl,
    moodboardImageUrl, lookAndFeelImageUrl, brandLogoImageUrl,
    enhanceManualPrompt, describeLookAndFeel, describeLookAndFeelUpload,
    createKlingVideo, createKlingFrameToFrame, pollKlingVideo,
    createSeedanceReferenceToVideo, pollSeedanceVideo,
    ensureHostedRefUrl,
    analyzeMotionFromVideo,
    type Generation, type ImageModel, type LookFeelItem, type KlingModel,
} from "../lib/api";
import { cn } from "../lib/utils";
import { downloadFile } from "../lib/download";

// ── Types ────────────────────────────────────────────────────────────

interface RefImage {
    tag: string;                  // img1, img2, ...
    label: string;
    url: string;
    source: "upload" | "asset" | "result";
    baseName?: string;            // for friendly download filename
    /** "Anchor de consistencia" — marca esta ref como la fuente de verdad para UN aspecto
     *  específico de [img1]. El output mantiene todo de [img1] (composición, pose, escena)
     *  excepto el aspecto declarado por `consistencyType`, que se reemplaza para matchear
     *  esta imagen. Solo puede haber UNA activa a la vez. */
    isConsistency?: boolean;
    /** Qué aspecto reemplazar en [img1]:
     *  - "avatar" → cara/identidad del sujeto (mantiene pose, ropa, escena de [img1])
     *  - "product" → producto físico (mantiene modelo, escena, lighting de [img1]) */
    consistencyType?: "avatar" | "product";
}

interface GenTurn {
    id: string;
    prompt: string;
    sentPrompt?: string;
    refs: Array<{ tag: string; label: string; url: string }>;
    status: "pending" | "completed" | "failed";
    outputUrl?: string;
    /** "image" o "video" — define cómo se renderiza en la galería. */
    outputType: "image" | "video";
    variants?: string[];
    params: Record<string, string>;
    baseName?: string;
    error?: string;
    createdAt: number;
}

const IMG_ASPECT_RATIOS = ["9:16", "1:1", "16:9", "4:5", "3:4"] as const;
const IMG_RESOLUTIONS = ["1K", "2K", "4K"] as const;
const VARIANT_COUNTS = [1, 2, 3, 4] as const;
type AspectRatio = typeof IMG_ASPECT_RATIOS[number];
type Resolution = typeof IMG_RESOLUTIONS[number];

// Video — matchea las opciones de v1 para feature parity.
const VID_DURATIONS = ["5", "10"] as const;
const SEEDANCE_RESOLUTIONS = ["480p", "720p", "1080p"] as const;
const VID_ASPECT_RATIOS = ["9:16", "16:9", "1:1", "4:3", "3:4"] as const;

type Mode = "image" | "video";
type VideoMode = "i2v" | "f2f" | "rtv";
type VideoModelId = KlingModel | "seedance-2";

interface VideoModelSpec {
    id: VideoModelId;
    label: string;
    sub: string;
    provider: "kling" | "seedance";
    modes: VideoMode[];
    resolutions?: readonly string[];
    aspectRatios?: readonly string[];
}

const VIDEO_MODELS: VideoModelSpec[] = [
    { id: "v3-pro",     label: "Kling V3 Pro",    sub: "Mejor calidad · i2v + f2f", provider: "kling",    modes: ["i2v", "f2f"] },
    { id: "v2-5-turbo", label: "Kling V2.5 Turbo", sub: "Rápido / barato · i2v + f2f", provider: "kling", modes: ["i2v", "f2f"] },
    { id: "seedance-2", label: "Seedance 2.0",    sub: "Multi-ref · resolución elegible", provider: "seedance", modes: ["rtv"], resolutions: SEEDANCE_RESOLUTIONS, aspectRatios: VID_ASPECT_RATIOS },
];

const VIDEO_MODE_LABELS: Record<VideoMode, { label: string; sub: string }> = {
    i2v: { label: "Image → Video", sub: "Una imagen como frame de inicio" },
    f2f: { label: "Frame → Frame", sub: "Start + end frame (interpola el medio)" },
    rtv: { label: "Ref → Video",   sub: "Todas las refs guían el resultado" },
};

// ── Helpers ──────────────────────────────────────────────────────────

const fileToDataUrl = (f: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(new Error("read failed"));
        r.readAsDataURL(f);
    });

const sanitizeName = (s: string): string => {
    const reserved = new Set(["/", "\\", "?", "%", "*", ":", "|", '"', "<", ">"]);
    return Array.from((s || "").trim())
        .filter((ch) => !reserved.has(ch) && ch.charCodeAt(0) >= 32)
        .join("").replace(/\s+/g, " ").slice(0, 70).trim();
};

const downloadBaseName = (turn: GenTurn): string => {
    if (turn.baseName) return turn.baseName;
    const slug = sanitizeName(turn.prompt || "").slice(0, 60).trim();
    return slug || `lab_${turn.id.slice(-6)}`;
};

// ── Page ─────────────────────────────────────────────────────────────

export function ManualLabV2() {
    const { activeBrand } = useBrand();
    const isSandbox = !activeBrand || activeBrand.id === "__sandbox__";

    // Composer state — what the user is building right now
    const [refs, setRefs] = useState<RefImage[]>([]);
    const [prompt, setPrompt] = useState("");
    // Inspire-from-video state — el usuario pasa URL o sube video corto (~5-10s)
    // y Gemini Vision saca el motion para inyectar en el prompt principal.
    const [inspireOpen, setInspireOpen] = useState(false);
    const [inspireUrl, setInspireUrl] = useState("");
    const [inspireFile, setInspireFile] = useState<File | null>(null);
    const [inspireLoading, setInspireLoading] = useState(false);
    const [inspireError, setInspireError] = useState<string | null>(null);
    const [useBrandAssets, setUseBrandAssets] = useState(false);

    // Mode (image | video)
    const [mode, setMode] = useState<Mode>("image");

    // Image params
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
    const [resolution, setResolution] = useState<Resolution>("2K");
    const [model, setModel] = useState<ImageModel>("nano-banana-2");
    const [variantCount, setVariantCount] = useState<number>(1);

    // Video params — defaults matchean los más usados de v1.
    const [videoModelId, setVideoModelId] = useState<VideoModelId>("v3-pro");
    const [videoMode, setVideoMode] = useState<VideoMode>("i2v");
    const [vidDuration, setVidDuration] = useState<typeof VID_DURATIONS[number]>("5");
    const [vidResolution, setVidResolution] = useState<string>("1080p");
    const [vidAspectRatio, setVidAspectRatio] = useState<string>("9:16");

    const currentVideoModel = useMemo(
        () => VIDEO_MODELS.find((m) => m.id === videoModelId) || VIDEO_MODELS[0],
        [videoModelId],
    );

    // Cuando cambia el modelo de video, ajustamos el modo si el actual no es válido
    // (ej. estabas en i2v con Kling y switcheas a Seedance que solo soporta rtv).
    useEffect(() => {
        if (!currentVideoModel.modes.includes(videoMode)) {
            setVideoMode(currentVideoModel.modes[0]);
        }
    }, [currentVideoModel, videoMode]);

    // Si el usuario tenía el panel de Look & Feel o Consistencia abierto y cambia
    // a modo video, los cerramos automáticamente (en video no aplican).
    useEffect(() => {
        if (mode === "video") {
            setShowLookFeel(false);
            setShowConsistency(false);
        }
    }, [mode]);

    // "Tal cual" = mandar prompt literal; "Curar con Gemini" = enhance antes de generar
    const [passThrough, setPassThrough] = useState(true);
    const [enhancing, setEnhancing] = useState(false);
    const [enhancedPrompt, setEnhancedPrompt] = useState<string | null>(null);
    const [interpretation, setInterpretation] = useState("");

    // Generation state
    const [turns, setTurns] = useState<GenTurn[]>([]);
    const [busy, setBusy] = useState(false);
    const [busyLabel, setBusyLabel] = useState("Generando…");
    const [error, setError] = useState<string | null>(null);

    // Look & Feel panel — mismo set de modos que v1.
    //  - "recipe": Gemini analiza la imagen y aplica el grade como texto (no manda la
    //    imagen al generador). Default y recomendado.
    //  - "image":  pasa la imagen como ref directa con un prompt restrictivo. Riesgo
    //    de que Nano Banana copie la escena — se muestra warning amarillo.
    const [showLookFeel, setShowLookFeel] = useState(false);
    const [lookFeelMode, setLookFeelMode] = useState<"recipe" | "image">("recipe");
    const [lfAnalyzing, setLfAnalyzing] = useState<string | null>(null);

    // Consistency panel — anchor de identidad. 3 caminos: avatar guardado, producto
    // guardado, o subir ad-hoc. Solo una activa a la vez. Solo modo imagen.
    const [showConsistency, setShowConsistency] = useState(false);

    // Lightbox
    // Lightbox — soporta navegación entre variantes con ← / → o las flechas del UI.
    // `urls` es la lista completa, `activeIdx` la actualmente visible. `download` opcional
    // es un callback que sabe descargar la variante actual con el filename correcto del
    // turn que abrió el lightbox.
    const [lightbox, setLightbox] = useState<{
        urls: string[];
        activeIdx: number;
        label?: string;
        download?: (idx: number) => void;
    } | null>(null);

    // Keyboard navigation en el lightbox: ← / → ciclan, Esc cierra.
    useEffect(() => {
        if (!lightbox) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") { setLightbox(null); return; }
            if (lightbox.urls.length <= 1) return;
            if (e.key === "ArrowLeft") {
                setLightbox((lb) => lb && { ...lb, activeIdx: (lb.activeIdx - 1 + lb.urls.length) % lb.urls.length });
            } else if (e.key === "ArrowRight") {
                setLightbox((lb) => lb && { ...lb, activeIdx: (lb.activeIdx + 1) % lb.urls.length });
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [lightbox]);

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const replaceFileRef = useRef<HTMLInputElement | null>(null);
    const lookFeelFileRef = useRef<HTMLInputElement | null>(null);
    const consistencyFileRef = useRef<HTMLInputElement | null>(null);
    const galleryRef = useRef<HTMLDivElement | null>(null);
    const promptRef = useRef<HTMLTextAreaElement | null>(null);
    /** Tag de la ref que se está reemplazando. Cuando el input file dispara onChange,
     *  reemplazamos esta ref (manteniendo su tag y posición) en vez de agregar una nueva. */
    const [replacingTag, setReplacingTag] = useState<string | null>(null);

    /** Drawer derecho (overlay) con thumbnails de la sesión — abre con el botón
     *  flotante "Sesión (N)" arriba a la derecha de la galería. Cerrado por default
     *  para no tapar contenido al entrar. */
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Dictation (Web Speech API). El callback recibe el texto final y lo appendea al prompt.
    // El `transcript` interim se muestra como overlay para feedback visual mientras hablás.
    const dictation = useDictation({ lang: "es-AR" });
    const onDictateCommit = useCallback((finalText: string) => {
        setPrompt((p) => p ? `${p} ${finalText}` : finalText);
    }, []);

    // @-mention popover state. Cuando el usuario tipea @ en el prompt textarea, abrimos
    // un popover con las refs disponibles. Click o Enter inserta `[imgN]`.
    const [mention, setMention] = useState<{
        open: boolean;
        query: string;
        anchorTop: number;
        anchorLeft: number;
        activeIdx: number;
    }>({ open: false, query: "", anchorTop: 0, anchorLeft: 0, activeIdx: 0 });

    const filteredRefs = useMemo(() => {
        if (!mention.open) return refs;
        const q = mention.query.toLowerCase();
        if (!q) return refs;
        return refs.filter((r) => r.tag.toLowerCase().includes(q) || r.label.toLowerCase().includes(q));
    }, [mention.open, mention.query, refs]);

    // Detect "@..." right before the cursor and open popover with filtered refs.
    const handleMentionTrigger = useCallback((value: string, ta: HTMLTextAreaElement) => {
        const caret = ta.selectionStart ?? value.length;
        // Walk back from caret until whitespace/start; bail if no '@' found.
        let i = caret - 1;
        while (i >= 0 && !/\s/.test(value[i])) {
            if (value[i] === "@") {
                const query = value.slice(i + 1, caret);
                if (refs.length === 0) { setMention((m) => ({ ...m, open: false })); return; }
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
    }, [refs.length]);

    // Replace the current "@query" segment with `[imgN]`.
    const commitMention = useCallback((ref_: RefImage) => {
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
    }, [prompt]);

    // ── Load past generations on mount / brand change ────────────────
    // Las generaciones con el mismo `metadata.batchId` se reagrupan en un solo turn
    // con `variants[]` — sin esto, una corrida de N variantes se mostraba como N
    // bloques separados verticales después de un refresh. Las generaciones viejas
    // sin batchId (pre-feature) se cargan como turns individuales.
    useEffect(() => {
        const brandId = isSandbox ? "__none__" : activeBrand?.id;
        if (!brandId) return;
        let cancelled = false;
        fetchManualGenerations(brandId)
            .then((gens: Generation[]) => {
                if (cancelled) return;

                // Filtrar solo Manual Lab — sin esto el load traía generaciones de TODAS
                // las tools (Avatar Sheet, UGC, etc.) que no tienen el shape esperado y
                // contaminaban la galería. v1 hace lo mismo.
                const labOnly = gens.filter((g) => g.toolId === "manual_lab");

                // Group by batchId. Las gens sin batchId quedan como turns sueltos
                // (cada una con su propio "batch" virtual = su id de generation).
                const byBatch = new Map<string, Generation[]>();
                for (const g of labOnly) {
                    const meta = (g.metadata || {}) as Record<string, unknown>;
                    const batchId = (meta.batchId as string) || `solo_${g.id}`;
                    if (!byBatch.has(batchId)) byBatch.set(batchId, []);
                    byBatch.get(batchId)!.push(g);
                }

                const loaded: GenTurn[] = Array.from(byBatch.values()).map((group) => {
                    // Ordenar por variantIdx para preservar v1/v2/v3 en el orden original.
                    group.sort((a, b) => {
                        const ai = (((a.metadata || {}) as Record<string, unknown>).variantIdx as number) ?? 0;
                        const bi = (((b.metadata || {}) as Record<string, unknown>).variantIdx as number) ?? 0;
                        return ai - bi;
                    });
                    const first = group[0];
                    const meta = (first.metadata || {}) as Record<string, unknown>;
                    const urls = group.map((g) => g.outputUrl).filter((u): u is string => Boolean(u));
                    return {
                        id: first.id,
                        prompt: ((meta.prompt as string) || first.title || ""),
                        sentPrompt: meta.sentPrompt as string | undefined,
                        // CRÍTICO anti-OOM: NO cargar metadata.refs en el histórico.
                        // Cuando subiste fotos como uploads del browser, las refs se persistieron
                        // como data: URLs base64 — cada una 5-10 MB. 30 generaciones × 4 refs ×
                        // 8 MB ≈ 1 GB en memoria → Chrome OOM (Aw Snap! Error 5).
                        // Las refs solo se necesitan al "Regenerar" (que ya carga las del turn
                        // vivo). En las cards del histórico no se muestran las thumbs de refs,
                        // así que no perdés nada visual.
                        refs: [],
                        status: "completed",
                        outputUrl: urls[0],
                        outputType: (first.type === "video" ? "video" : "image") as "image" | "video",
                        variants: urls.length > 1 ? urls : undefined,
                        params: (meta.params as Record<string, string>) || {},
                        baseName: meta.baseName as string | undefined,
                        createdAt: first.createdAt ? new Date(first.createdAt).getTime() : Date.now(),
                    };
                });
                // Newest first.
                loaded.sort((a, b) => b.createdAt - a.createdAt);
                // Cap a 20 generaciones para tener margen extra de seguridad. El resto
                // siempre podés verlo desde Contenido por marca.
                setTurns(loaded.slice(0, 20));
            })
            .catch((e) => console.error("[lab-v2] load failed:", e));
        return () => { cancelled = true; };
    }, [activeBrand?.id, isSandbox]);

    // ── Refs management ──────────────────────────────────────────────
    const addUploadedRefs = useCallback(async (files: FileList | File[]) => {
        const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
        const newRefs: RefImage[] = [];
        for (const f of list) {
            const url = await fileToDataUrl(f);
            newRefs.push({
                tag: "",          // assigned below
                label: f.name.replace(/\.[^.]+$/, ""),
                url,
                source: "upload",
                baseName: sanitizeName(f.name.replace(/\.[^.]+$/, "")) || undefined,
            });
        }
        setRefs((prev) => {
            const all = [...prev, ...newRefs];
            return all.map((r, i) => ({ ...r, tag: `img${i + 1}` }));
        });
    }, []);

    const addAssetRef = useCallback((
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
            brandLogoImageUrl;
        const url = item.imageUrl.startsWith("data:") ? item.imageUrl : resolver(item.imageUrl);
        setRefs((prev) => {
            const tag = `img${prev.length + 1}`;
            return [...prev, {
                tag,
                label: `${kind}: ${item.name}`,
                url,
                source: "asset",
                baseName: sanitizeName(item.name) || undefined,
            }];
        });
    }, []);

    const removeRef = useCallback((tag: string) => {
        setRefs((prev) => {
            const next = prev.filter((r) => r.tag !== tag);
            return next.map((r, i) => ({ ...r, tag: `img${i + 1}` }));
        });
        // Strip the token from the prompt too.
        setPrompt((p) => p.replace(new RegExp(`\\[${tag}\\]`, "g"), "").replace(/\s+/g, " ").trim());
    }, []);

    const insertRefToken = useCallback((tag: string) => {
        setPrompt((p) => (p.endsWith(" ") || p === "" ? `${p}[${tag}] ` : `${p} [${tag}] `));
    }, []);

    /** Append a generated result as a new ref (no anchor logic, just adds to the list). */
    const appendResultAsRef = useCallback((url: string, baseName?: string, label = "previous result") => {
        setRefs((prev) => {
            const tag = `img${prev.length + 1}`;
            return [...prev, { tag, label, url, source: "result", baseName }];
        });
    }, []);

    /** Sanea refs antes de persistir: descarta el campo `url` cuando es un data: URL
     *  (base64 gigante de uploads del browser). Sin esto, una generación con 4 fotos
     *  de 5MB c/u guardaba ~20MB en metadata.refs como base64 en el JSON del backend.
     *  Cargar el histórico después → OOM en Chrome. Acá guardamos solo tag + label,
     *  y la url si es http(s) (ej. URLs de Fal Storage que sí son livianas). */
    const sanitizeRefsForPersist = useCallback((refsToSave: Array<{ tag: string; label: string; url: string }>) => {
        return refsToSave.map((r) => ({
            tag: r.tag,
            label: r.label,
            url: r.url.startsWith("data:") ? "" : r.url,
        }));
    }, []);

    /** Reemplaza la imagen de una ref existente manteniendo su tag y posición.
     *  Útil cuando subiste una imagen mal y querés cambiarla sin tener que borrarla
     *  + reescribir las menciones de [imgN] del prompt. Click → file picker → onChange
     *  consume `replacingTag` y swap-ea la URL. */
    const triggerReplace = useCallback((tag: string) => {
        setReplacingTag(tag);
        replaceFileRef.current?.click();
    }, []);
    const replaceRefImage = useCallback(async (tag: string, file: File) => {
        const url = await fileToDataUrl(file);
        const baseName = sanitizeName(file.name.replace(/\.[^.]+$/, "")) || undefined;
        setRefs((prev) =>
            prev.map((r) => r.tag === tag ? {
                ...r,
                label: file.name.replace(/\.[^.]+$/, ""),
                url,
                source: "upload",
                baseName,
            } : r),
        );
        setReplacingTag(null);
    }, []);

    // Build and inject the recipe prompt — shared between the auto-analyzed and the
    // manually-typed paths. Always preserves [img1]'s subject/composition; only color
    // changes. `recipeName` is just for the prompt's friendly mention.
    const injectRecipePrompt = useCallback((recipeText: string, recipeName: string) => {
        const grade = (recipeText || "").trim() || `the "${recipeName}" color treatment`;
        const promptText =
            `Apply this exact color grade / mood to [img1] as a color-treatment pass (like a film LUT): ${grade}\n` +
            `Keep [img1] completely identical otherwise — same subject, face and identity, pose, light direction, shadows, highlights, exposure, framing, composition, background and product. Change ONLY color, tone and mood.`;
        setEnhancedPrompt(promptText);
        setShowLookFeel(false);
    }, []);

    // Modo "image": pasa la imagen del L&F como ref directa con un prompt restrictivo.
    // Nano Banana es flaky con esto — el warning amarillo en la UI lo aclara.
    const applyLookFeelAsImageRef = useCallback((item: LookFeelItem & { adhocFile?: File }) => {
        const refUrl = item.imageUrl.startsWith("data:") ? item.imageUrl : lookAndFeelImageUrl(item.imageUrl);
        setRefs((prev) => {
            const tag = `img${prev.length + 1}`;
            return [...prev, {
                tag,
                label: `look&feel: ${item.name}`,
                url: refUrl,
                source: "asset",
                baseName: sanitizeName(item.name) || undefined,
            }];
        });
        const newTag = `img${refs.length + 1}`;
        const promptText =
            `Output: [img1] regraded with the color treatment of [${newTag}]. The result IS [img1] with a different color/mood — nothing else.\n` +
            `KEEP from [img1] exactly: subject, face and identity, pose, framing, composition, background, product, light direction, shadows, highlights and exposure.\n` +
            `TAKE from [${newTag}] ONLY: color palette, white balance / temperature, tonal contrast, saturation and overall mood. Treat [${newTag}] as a film LUT — never as scene content.\n` +
            `NEVER copy from [${newTag}]: objects, people, sky, clouds, scenery, textures, lighting direction or composition.`;
        setEnhancedPrompt(promptText);
        setShowLookFeel(false);
    }, [refs.length]);

    // ── Recomendar animación — Gemini Vision mira la imagen ref y propone un
    // prompt de motion para Kling/Seedance. Si el usuario ya escribió algo (intent),
    // Gemini lo respeta; si está vacío, decide solo. Mismo flow que v1.
    const recommendAnimation = useCallback(async () => {
        if (refs.length === 0) {
            alert("Necesitás al menos una imagen como referencia para que Gemini proponga la animación.");
            return;
        }
        setEnhancing(true);
        setBusyLabel("Pensando la animación…");
        try {
            const enh = await enhanceManualPrompt({
                prompt: prompt.trim() || "anima esta imagen con un movimiento que potencie su composición",
                refs: refs.map((r) => ({ tag: r.tag, label: r.label, url: r.url })),
                mode: "video",
                targetModel: model,
            });
            setEnhancedPrompt(enh.enhanced);
            if (enh.interpretation) setInterpretation(enh.interpretation);
        } catch (e) {
            console.error("[recommend-animation] failed:", e);
            alert(e instanceof Error ? e.message : "No se pudo generar la recomendación");
        } finally {
            setEnhancing(false);
            setBusyLabel("Generando…");
        }
    }, [refs, prompt, model]);

    // ── Look & Feel apply — dispatch según el modo activo (recipe vs image). ────
    const applyLookFeel = useCallback(async (item: LookFeelItem & { adhocFile?: File }) => {
        if (refs.length === 0) {
            alert("Primero subí o elegí la imagen base a la que querés aplicarle el look & feel.");
            return;
        }
        // Modo "image": agregamos la imagen como ref con prompt restrictivo, sin Gemini.
        if (lookFeelMode === "image") {
            applyLookFeelAsImageRef(item);
            return;
        }
        // Modo "recipe": Gemini analiza y aplica como texto.
        setLfAnalyzing(item.id);
        try {
            let recipe = (item.description || "").trim();
            if (!recipe) {
                const r = item.adhocFile
                    ? await describeLookAndFeelUpload(item.adhocFile)
                    : activeBrand ? await describeLookAndFeel(activeBrand.id, item.id) : { description: "" };
                recipe = (r.description || "").trim();
            }
            injectRecipePrompt(recipe, item.name);
        } catch (e) {
            console.error("[lookfeel] describe failed:", e);
            alert("No se pudo analizar la referencia. Probá de nuevo.");
        } finally {
            setLfAnalyzing(null);
        }
    }, [refs.length, activeBrand, injectRecipePrompt, lookFeelMode, applyLookFeelAsImageRef]);

    // ── Consistencia ─────────────────────────────────────────────────
    /** Construye el prompt template según el tipo. La regla mental:
     *    Output = [img1] tal cual, EXCEPTO el aspecto declarado, que se reemplaza
     *    para matchear la imagen de consistencia.
     *  El usuario puede sumar su scene description después — el template no la pisa. */
    const buildConsistencyPrompt = useCallback((consistencyTag: string, type: "avatar" | "product") => {
        if (type === "avatar") {
            return (
                `Output: regenerate [img1] applying the FACE / IDENTITY from [${consistencyTag}] to the subject.\n\n` +
                `KEEP from [img1] EXACTLY: composition, framing, pose, body position, gesture, hands, clothing, accessories, background, lighting, atmosphere, color treatment — everything visual EXCEPT the face and identity of the subject.\n\n` +
                `REPLACE the subject's face and identity to match [${consistencyTag}]: facial features (eyes, nose, mouth, jaw), hair color and style, skin tone, age, expression style, distinctive marks. The person in the output MUST be recognizable as the individual in [${consistencyTag}].\n\n` +
                `Do NOT change [img1]'s pose, body, clothing, scene, or lighting — only swap the face/identity to match [${consistencyTag}].`
            );
        }
        // product
        return (
            `Output: regenerate [img1] applying the EXACT product from [${consistencyTag}] in its place.\n\n` +
            `KEEP from [img1] EXACTLY: composition, framing, the model (if any), pose, clothing of the model (except the product item being swapped), background, lighting, atmosphere, color treatment, hand positions holding the product.\n\n` +
            `REPLACE only the product to match [${consistencyTag}] exactly: shape, color, materials, finish, hardware, logo, distinctive details, proportions. The product in the output MUST be visually identical to the one in [${consistencyTag}].\n\n` +
            `Do NOT change [img1]'s scene, model, lighting, or composition — only swap the product to match [${consistencyTag}].`
        );
    }, []);

    /** Agrega una imagen como ANCHOR DE CONSISTENCIA. Reemplaza la consistency activa
     *  si ya hay una (solo una a la vez). Inyecta un prompt template específico para
     *  el tipo declarado (avatar/cara o producto). */
    const applyConsistencyRef = useCallback((opts: {
        url: string;
        label: string;
        baseName?: string;
        type: "avatar" | "product";
    }) => {
        if (refs.length === 0) {
            alert("Primero subí la imagen base como [img1]. La consistencia reemplaza un aspecto de esa base — sin base no hay nada que reemplazar.");
            return;
        }
        setRefs((prev) => {
            const withoutOld = prev.filter((r) => !r.isConsistency);
            const tag = `img${withoutOld.length + 1}`;
            const newRef: RefImage = {
                tag,
                label: `${opts.type === "avatar" ? "identidad" : "producto"}: ${opts.label}`,
                url: opts.url,
                source: "asset",
                baseName: opts.baseName,
                isConsistency: true,
                consistencyType: opts.type,
            };
            const next = [...withoutOld, newRef];
            return next.map((r, i) => ({ ...r, tag: `img${i + 1}` }));
        });
        // Tag estimado para el prompt: si había una anterior, el length no cambia;
        // si no había, +1.
        const consistencyTagEstimate = refs.some((r) => r.isConsistency)
            ? `img${refs.length}`
            : `img${refs.length + 1}`;
        setEnhancedPrompt(buildConsistencyPrompt(consistencyTagEstimate, opts.type));
        setShowConsistency(false);
    }, [refs, buildConsistencyPrompt]);

    /** Quita la consistency activa (si la hay) y limpia el prompt template. */
    const clearConsistency = useCallback(() => {
        setRefs((prev) => prev.filter((r) => !r.isConsistency).map((r, i) => ({ ...r, tag: `img${i + 1}` })));
        setEnhancedPrompt(null);
        setInterpretation("");
    }, []);

    // ── Submit ───────────────────────────────────────────────────────
    const hasContent = useMemo(
        () => prompt.trim().length > 0 || (enhancedPrompt && enhancedPrompt.trim().length > 0),
        [prompt, enhancedPrompt],
    );

    const canGenerate = hasContent && !busy;

    const submit = async () => {
        if (!canGenerate) return;
        setBusy(true);
        setError(null);
        try {
            // Build the prompt — mismo flow para imagen y video.
            let finalPrompt = (enhancedPrompt ?? prompt).trim();
            if (!passThrough && !enhancedPrompt) {
                setBusyLabel("Curando prompt con Gemini…");
                const enh = await enhanceManualPrompt({
                    prompt,
                    refs: refs.map((r) => ({ tag: r.tag, label: r.label, url: r.url })),
                    mode,
                    targetModel: model,
                });
                finalPrompt = enh.enhanced;
                if (enh.interpretation) setInterpretation(enh.interpretation);
                setEnhancedPrompt(enh.enhanced);
            }

            const baseName =
                refs.find((r) => r.baseName)?.baseName ||
                sanitizeName(prompt).slice(0, 60) ||
                undefined;

            if (mode === "image") {
                // ── Image path ────────────────────────────────────────────────
                setBusyLabel(variantCount > 1 ? `Generando ${variantCount} variantes…` : "Generando…");
                const refUrls = refs.map((r) => r.url);
                const jobs = await Promise.all(
                    Array.from({ length: variantCount }, () =>
                        refUrls.length > 0
                            ? createImageEdit(refUrls, finalPrompt, aspectRatio, resolution, model)
                            : createTextToImage(finalPrompt, aspectRatio, resolution, model),
                    ),
                );
                const results = await Promise.all(jobs.map((j) => pollImageGen(j.request_id)));
                const urls = results
                    .map((r) => (r.status === "completed" ? r.image_url : null))
                    .filter((u): u is string => Boolean(u));
                if (urls.length === 0) throw new Error(results[0]?.error || "Generación falló");

                // batchId común para todas las variantes de esta corrida — sin esto, después
                // de un refresh cada variante se cargaba como un turn individual (una abajo
                // de la otra) en vez de agrupadas lado a lado. El load del backend usa este
                // id para reconstruir el turn con variants[].
                const batchId = `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                const turn: GenTurn = {
                    id: `t_${Date.now()}`,
                    prompt, sentPrompt: finalPrompt,
                    refs: refs.map((r) => ({ tag: r.tag, label: r.label, url: r.url })),
                    status: "completed",
                    outputUrl: urls[0],
                    outputType: "image",
                    variants: urls.length > 1 ? urls : undefined,
                    params: { aspectRatio, resolution, model, variantCount: String(variantCount) },
                    baseName,
                    createdAt: Date.now(),
                };
                setTurns((prev) => [turn, ...prev]);
                for (let i = 0; i < urls.length; i++) {
                    try {
                        await saveGeneration({
                            brandId: isSandbox ? null : activeBrand!.id,
                            toolId: "manual_lab",
                            title: prompt.slice(0, 120) || "Manual Lab",
                            type: "image",
                            outputUrl: urls[i],
                            thumbnailUrl: urls[i],
                            metadata: {
                                prompt, sentPrompt: finalPrompt,
                                // Sanitize: descarta data: URLs de refs antes de persistir,
                                // sino el JSON del backend acumula MBs de base64 que rebientan
                                // la memoria del browser al cargar el histórico.
                                refs: sanitizeRefsForPersist(turn.refs), params: turn.params,
                                baseName: baseName ? (urls.length > 1 ? `${baseName}_v${i + 1}` : baseName) : undefined,
                                // batch metadata para reagrupar al cargar del histórico
                                batchId,
                                variantIdx: i,
                                variantCount: urls.length,
                            },
                        });
                    } catch (e) { console.warn("[lab-v2] persist failed:", e); }
                }
            } else {
                // ── Video path ────────────────────────────────────────────────
                if (refs.length === 0) throw new Error("Necesitás al menos 1 referencia para generar video.");
                if (videoMode === "f2f" && refs.length < 2) throw new Error("Frame-to-frame necesita al menos 2 refs (start + end).");

                setBusyLabel(`Subiendo refs a Fal…`);
                // Fal/Kling tira "URL too long" con data: URLs largos — re-hosteamos primero.
                const hostedRefUrls = await Promise.all(
                    refs.map((r, i) => ensureHostedRefUrl(r.url, r.baseName ? `${r.baseName}.png` : `lab_ref_${i + 1}.png`)),
                );

                setBusyLabel(`Generando video (${currentVideoModel.label})…`);
                let videoUrl: string | null = null;
                let videoError: string | null = null;

                if (videoMode === "rtv") {
                    const job = await createSeedanceReferenceToVideo({
                        prompt: finalPrompt,
                        referenceImageUrls: hostedRefUrls,
                        duration: vidDuration,
                        aspectRatio: currentVideoModel.aspectRatios ? vidAspectRatio : undefined,
                        resolution: currentVideoModel.resolutions ? vidResolution : undefined,
                    });
                    if (job.video_url) {
                        videoUrl = job.video_url;
                    } else {
                        const r = await pollSeedanceVideo(job.request_id);
                        videoUrl = r.video_url || null;
                        videoError = r.error || null;
                    }
                } else if (videoMode === "f2f") {
                    const klingId = (currentVideoModel.provider === "kling" ? videoModelId : "v3-pro") as KlingModel;
                    const job = await createKlingFrameToFrame({
                        start_image_url: hostedRefUrls[0],
                        end_image_url: hostedRefUrls[hostedRefUrls.length - 1],
                        prompt: finalPrompt,
                        duration: vidDuration,
                        model: klingId,
                    });
                    const r = await pollKlingVideo(job.request_id);
                    videoUrl = r.video_url || null;
                    videoError = r.error || null;
                } else {
                    // i2v
                    const klingId = (currentVideoModel.provider === "kling" ? videoModelId : "v3-pro") as KlingModel;
                    const job = await createKlingVideo(hostedRefUrls[0], finalPrompt, vidDuration, klingId);
                    const r = await pollKlingVideo(job.request_id);
                    videoUrl = r.video_url || null;
                    videoError = r.error || null;
                }

                if (!videoUrl) throw new Error(videoError || "Video generation failed");

                const turn: GenTurn = {
                    id: `t_${Date.now()}`,
                    prompt, sentPrompt: finalPrompt,
                    refs: refs.map((r) => ({ tag: r.tag, label: r.label, url: r.url })),
                    status: "completed",
                    outputUrl: videoUrl,
                    outputType: "video",
                    params: {
                        videoModel: videoModelId,
                        videoMode,
                        duration: `${vidDuration}s`,
                        ...(currentVideoModel.resolutions ? { resolution: vidResolution } : {}),
                        ...(currentVideoModel.aspectRatios ? { aspectRatio: vidAspectRatio } : {}),
                    },
                    baseName,
                    createdAt: Date.now(),
                };
                setTurns((prev) => [turn, ...prev]);
                try {
                    await saveGeneration({
                        brandId: isSandbox ? null : activeBrand!.id,
                        toolId: "manual_lab",
                        title: prompt.slice(0, 120) || "Manual Lab",
                        type: "video",
                        outputUrl: videoUrl,
                        // Sin thumbnail propio — la galería usa el video con poster auto del browser.
                        metadata: {
                            prompt, sentPrompt: finalPrompt,
                            refs: sanitizeRefsForPersist(turn.refs), params: turn.params,
                            baseName,
                        },
                    });
                } catch (e) { console.warn("[lab-v2] persist failed:", e); }
            }

            requestAnimationFrame(() => galleryRef.current?.scrollTo({ top: 0, behavior: "smooth" }));
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Falló la generación";
            setError(msg);
        } finally {
            setBusy(false);
            setBusyLabel("Generando…");
        }
    };

    // ── Render ───────────────────────────────────────────────────────
    // h-full (NOT flex-1) — el <main> contenedor no es flex, así que flex-1 no resolvía
    // altura y el footer sticky con Generar caía fuera del viewport.
    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header — single row, balanced: title left + meta right */}
            <header className="border-b border-edge px-5 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-md bg-[var(--color-action-subtle)] flex items-center justify-center">
                        <FlaskConical size={14} className="text-[var(--color-action)]" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <h1 className="text-[14px] font-semibold text-fg leading-none">Manual Lab</h1>
                    </div>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-fg-muted">
                    {!isSandbox && activeBrand && (
                        <span>Marca: <span className="text-fg font-medium">{activeBrand.name}</span></span>
                    )}
                    {/* Toggle Sesión — abre el drawer derecho con todas las generaciones. */}
                    <button
                        onClick={() => setDrawerOpen((v) => !v)}
                        title={turns.length > 0 ? "Abrir galería de la sesión" : "Sin generaciones todavía"}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-surface-2 border border-edge hover:border-[var(--color-brand-muted)] hover:bg-[var(--color-brand-subtle)] text-fg-secondary hover:text-fg cursor-pointer transition-colors"
                    >
                        <ImageIcon size={12} />
                        <span className="text-[11px] font-semibold">Sesión</span>
                        {turns.length > 0 && (
                            <span className="text-[10px] font-bold text-[var(--color-brand-fg)] px-1.5 py-0.5 rounded-full bg-[var(--color-brand)] min-w-[18px] text-center leading-none">
                                {turns.length}
                            </span>
                        )}
                    </button>
                </div>
            </header>

            {/* Body — split sidebar + galería */}
            <div className="flex-1 flex overflow-hidden">

                {/* ── Sidebar izquierdo (control panel) ──────────────
                     Estructurado en dos zonas con flex-col:
                       - Top scrollable (refs, prompt, params) — grows + scrolls
                       - Footer sticky (Generar) — siempre visible
                     Sin esto, con suficientes refs / prompt curado / params el botón
                     Generar caía bajo el fold y había que scrollear para verlo. */}
                <aside
                    className="w-[420px] shrink-0 border-r border-edge flex flex-col"
                    style={{
                        // Gradient sutil consistente con ToolRunPage (surface-1 → surface-0).
                        // El sidebar respira de arriba a abajo sin quedar plano.
                        background: "linear-gradient(to bottom, var(--color-surface-1), var(--color-surface-0) 90%)",
                    }}
                >
                    {/* Top zone — scrollable. Spacing generoso (space-y-6) para que cada bloque
                        respire; con space-y-5 se sentía todo apretado. */}
                    <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

                        {/* Mode toggle (Imagen / Video) — funcional, no link a v1.
                            Cambia la sección Modelo y los Parámetros según el modo. */}
                        <div className="grid grid-cols-2 gap-1 p-1 rounded-[var(--radius-md)] bg-surface-2 border border-edge">
                            {([
                                { id: "image" as Mode, label: "Imagen", icon: <ImageIcon size={13} /> },
                                { id: "video" as Mode, label: "Video", icon: <Wand2 size={13} /> },
                            ]).map((m) => {
                                const active = mode === m.id;
                                return (
                                    <button
                                        key={m.id}
                                        onClick={() => setMode(m.id)}
                                        className={cn(
                                            "flex items-center justify-center gap-1.5 py-1.5 rounded text-[12px] font-medium cursor-pointer transition-colors",
                                            active
                                                ? "bg-[var(--color-action)] text-[var(--color-action-fg)] font-semibold"
                                                : "text-fg-muted hover:text-fg hover:bg-surface-1"
                                        )}
                                    >
                                        {m.icon} {m.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Modelo — switch entre image y video según el modo activo. */}
                        {mode === "image" ? (
                            <div className="space-y-1.5">
                                <span className="text-[10px] font-bold text-fg-faint uppercase tracking-widest">Modelo</span>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {([
                                        { id: "nano-banana-2" as const, label: "Nano Banana 2", sub: "Multi-ref · Gemini" },
                                        { id: "gpt-image-2" as const, label: "GPT Image 2", sub: "Base + edit · OpenAI" },
                                    ]).map((m) => {
                                        const active = model === m.id;
                                        return (
                                            <button
                                                key={m.id}
                                                onClick={() => setModel(m.id)}
                                                className={cn(
                                                    "px-2.5 py-2 rounded-[var(--radius-sm)] border text-left transition-colors cursor-pointer",
                                                    active
                                                        ? "border-[var(--color-action)] bg-[var(--color-action-subtle)]"
                                                        : "border-edge bg-surface-1 hover:bg-surface-2 hover:border-edge-strong"
                                                )}
                                            >
                                                <div className={cn("text-[11px] font-semibold", active ? "text-fg" : "text-fg-secondary")}>
                                                    {m.label}
                                                </div>
                                                <div className="text-[9px] text-fg-faint mt-0.5">{m.sub}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                <span className="text-[10px] font-bold text-fg-faint uppercase tracking-widest">Modelo de video</span>
                                <div className="grid grid-cols-1 gap-1.5">
                                    {VIDEO_MODELS.map((m) => {
                                        const active = videoModelId === m.id;
                                        return (
                                            <button
                                                key={m.id}
                                                onClick={() => setVideoModelId(m.id)}
                                                className={cn(
                                                    "px-2.5 py-2 rounded-[var(--radius-sm)] border text-left transition-colors cursor-pointer",
                                                    active
                                                        ? "border-[var(--color-action)] bg-[var(--color-action-subtle)]"
                                                        : "border-edge bg-surface-1 hover:bg-surface-2 hover:border-edge-strong"
                                                )}
                                            >
                                                <div className={cn("text-[11px] font-semibold", active ? "text-fg" : "text-fg-secondary")}>
                                                    {m.label}
                                                </div>
                                                <div className="text-[9px] text-fg-faint mt-0.5">{m.sub}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                                {/* Sub-modo (solo cuando el modelo soporta más de uno — Kling tiene i2v + f2f) */}
                                {currentVideoModel.modes.length > 1 && (
                                    <div className="grid grid-cols-2 gap-1.5 mt-2">
                                        {currentVideoModel.modes.map((vm) => {
                                            const active = videoMode === vm;
                                            const meta = VIDEO_MODE_LABELS[vm];
                                            return (
                                                <button
                                                    key={vm}
                                                    onClick={() => setVideoMode(vm)}
                                                    title={meta.sub}
                                                    className={cn(
                                                        "px-2 py-1.5 rounded-[var(--radius-sm)] border text-left text-[10px] transition-colors cursor-pointer",
                                                        active
                                                            ? "border-[var(--color-action-muted)] bg-[var(--color-action-subtle)] text-fg font-semibold"
                                                            : "border-edge bg-surface-1 hover:bg-surface-2 text-fg-muted"
                                                    )}
                                                >
                                                    {meta.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Brand assets toggle */}
                        {activeBrand && !isSandbox && (
                            <label className="flex items-center gap-2 text-[12px] text-fg cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={useBrandAssets}
                                    onChange={(e) => setUseBrandAssets(e.target.checked)}
                                    className="cursor-pointer"
                                />
                                Usar assets de <span className="font-semibold">{activeBrand.name}</span>
                            </label>
                        )}

                        {/* Refs section — grid de slots cuadrados iguales tipo Freepik.
                            Cada ref subida + "Subir" + "Look & Feel" son cuadrados del mismo tamaño
                            en el mismo grid, sin labels textuales largos por afuera. Más prolijo,
                            más integrado visualmente. */}
                        <Section title="Referencias" hint="Tageá con @img1 / @img2 en el prompt.">
                            <div className="grid grid-cols-4 gap-1.5">
                                {refs.map((r) => (
                                    <RefCard
                                        key={r.tag}
                                        ref_={r}
                                        onRemove={() => removeRef(r.tag)}
                                        onInsert={() => insertRefToken(r.tag)}
                                        onZoom={() => setLightbox({ urls: [r.url], activeIdx: 0, label: r.label })}
                                        onReplace={() => triggerReplace(r.tag)}
                                    />
                                ))}
                                {/* Subir — slot cuadrado, mismo tamaño que las refs */}
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="aspect-square flex flex-col items-center justify-center gap-1 border border-dashed border-edge rounded-[var(--radius-sm)] text-fg-muted hover:text-fg hover:border-edge-strong hover:bg-surface-1 cursor-pointer transition-colors"
                                    title="Subir imagen"
                                >
                                    <Plus size={14} />
                                    <span className="text-[9px] font-medium leading-none">Subir</span>
                                </button>
                                {/* Look & Feel — slot cuadrado solo en modo IMAGEN.
                                    En video no aplica (Kling/Seedance no usan color grade transfer
                                    de la misma manera y el feature está pensado para imagen fija). */}
                                {mode === "image" && (
                                    <button
                                        onClick={() => setShowLookFeel((v) => !v)}
                                        className={cn(
                                            "aspect-square flex flex-col items-center justify-center gap-1 border border-dashed rounded-[var(--radius-sm)] cursor-pointer transition-colors text-center px-1",
                                            showLookFeel
                                                ? "border-[var(--color-action-muted)] bg-[var(--color-action-subtle)] text-fg"
                                                : "border-edge text-fg-muted hover:text-fg hover:border-edge-strong hover:bg-surface-1"
                                        )}
                                        title="Aplicar un color grade / mood a la primera referencia"
                                    >
                                        <Sun size={14} />
                                        <span className="text-[9px] font-medium leading-tight">Look &amp; Feel</span>
                                    </button>
                                )}
                                {/* Consistencia — anchor de identidad. Solo modo IMAGEN.
                                    Si hay una ref marcada como consistency, el slot se ve
                                    "activo" con burgundy. Click → abre panel con 3 opciones. */}
                                {mode === "image" && (
                                    <button
                                        onClick={() => setShowConsistency((v) => !v)}
                                        className={cn(
                                            "aspect-square flex flex-col items-center justify-center gap-1 border border-dashed rounded-[var(--radius-sm)] cursor-pointer transition-colors text-center px-1",
                                            (showConsistency || refs.some((r) => r.isConsistency))
                                                ? "border-[var(--color-brand-muted)] bg-[var(--color-brand-subtle)] text-fg"
                                                : "border-edge text-fg-muted hover:text-fg hover:border-edge-strong hover:bg-surface-1"
                                        )}
                                        title="Anclar identidad — esta imagen es la fuente de verdad para el sujeto/producto"
                                    >
                                        <Target size={14} />
                                        <span className="text-[9px] font-medium leading-tight">Consistencia</span>
                                    </button>
                                )}
                            </div>
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
                            {/* Input dedicado para reemplazo — consume `replacingTag` y swap-ea la
                                imagen de esa ref específica sin tocar el resto. */}
                            <input
                                ref={replaceFileRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f && replacingTag) replaceRefImage(replacingTag, f);
                                    e.target.value = "";
                                }}
                            />

                            {/* Look & Feel panel inline — clone exacto del de v1 para coherencia.
                                Layout compacto: línea-resumen + toggle Receta/Imagen-ref + botón "Subir
                                una (solo esta vez)" + lista de L&F guardados de la marca. Cuando
                                el modo es "image" se muestra un warning amarillo porque Nano Banana
                                a veces devuelve la imagen del L&F en vez de aplicarla como grade. */}
                            {showLookFeel && (
                                <div className="mt-2 border border-edge rounded-[var(--radius-sm)] bg-surface-1 p-1.5 space-y-1.5">
                                    <p className="text-[10px] text-fg-faint px-1.5 pt-1 leading-snug">
                                        Aplica color/mood a <code className="px-1 rounded bg-surface-2">img1</code> sin cambiar su contenido.
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
                                    {/* Honest warning para el modo "image" */}
                                    {lookFeelMode === "image" && (
                                        <p className="text-[10px] text-[var(--color-warning,#f5a623)] px-1.5 pb-1 leading-snug">
                                            ⚠ Nano Banana puede devolverte la imagen del look&feel en vez de aplicarla. Si pasa, cambiá a Receta.
                                        </p>
                                    )}
                                    {/* Ad-hoc: upload one-off (no se guarda en la marca) */}
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
                                            onClick={() => applyLookFeel(item)}
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
                                    <input
                                        ref={lookFeelFileRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={async (e) => {
                                            const f = e.target.files?.[0];
                                            if (!f) return;
                                            const dataUrl = await fileToDataUrl(f);
                                            await applyLookFeel({
                                                id: `adhoc_${Date.now()}`,
                                                name: f.name.replace(/\.[^.]+$/, ""),
                                                filename: f.name,
                                                imageUrl: dataUrl,
                                                adhocFile: f,
                                            });
                                            e.target.value = "";
                                        }}
                                    />
                                </div>
                            )}

                            {/* Consistencia panel inline. Tres caminos según TIPO declarado
                                (avatar/cara vs producto), porque cada uno construye un prompt
                                template distinto: el output es [img1] tal cual, EXCEPTO el
                                aspecto declarado que se reemplaza para matchear esta imagen.
                                Requiere que ya haya una [img1] base — sino la consistencia
                                no tiene sobre qué actuar. */}
                            {showConsistency && mode === "image" && (
                                <div className="mt-2 border border-edge rounded-[var(--radius-sm)] bg-surface-1 p-2 space-y-2">
                                    <div className="flex items-start gap-1.5 px-1">
                                        <Target size={11} className="text-[var(--color-brand-strong)] shrink-0 mt-0.5" />
                                        <p className="text-[10px] text-fg-faint leading-snug">
                                            El output va a ser <strong className="text-fg">[img1] tal cual</strong>, pero la <strong className="text-fg">cara</strong> (si elegís avatar) o el <strong className="text-fg">producto</strong> (si elegís producto) se reemplaza para matchear esta imagen. Una activa a la vez.
                                        </p>
                                    </div>

                                    {/* Warning si no hay base */}
                                    {refs.filter((r) => !r.isConsistency).length === 0 && (
                                        <p className="text-[10px] text-[var(--color-warning,#f5a623)] px-1.5 py-1 leading-snug bg-[var(--color-warning-muted,rgba(245,166,35,0.1))] rounded">
                                            ⚠ Necesitás una imagen base como [img1] primero. Subila desde el slot "Subir" arriba.
                                        </p>
                                    )}

                                    {/* Chip de la activa + botón quitar */}
                                    {refs.some((r) => r.isConsistency) && (
                                        <div className="flex items-center gap-2 px-1.5 py-1 rounded bg-[var(--color-brand-subtle)] border border-[var(--color-brand-muted)]">
                                            <img
                                                src={refs.find((r) => r.isConsistency)!.url}
                                                alt="consistency"
                                                className="w-8 h-8 rounded object-cover shrink-0"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-semibold text-fg truncate">
                                                    {refs.find((r) => r.isConsistency)!.label}
                                                </p>
                                                <p className="text-[9px] text-fg-faint">
                                                    {refs.find((r) => r.isConsistency)?.consistencyType === "avatar"
                                                        ? "reemplaza la cara/identidad de [img1]"
                                                        : "reemplaza el producto de [img1]"}
                                                </p>
                                            </div>
                                            <button
                                                onClick={clearConsistency}
                                                title="Quitar"
                                                className="w-6 h-6 rounded-full text-fg-faint hover:text-fg hover:bg-surface-2 flex items-center justify-center cursor-pointer"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    )}

                                    {/* Avatares del Brand Kit → type "avatar" (reemplaza cara) */}
                                    {activeBrand && (activeBrand.avatars?.length ?? 0) > 0 && (
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-bold text-fg-faint uppercase tracking-widest px-1">
                                                Avatares <span className="text-fg-secondary normal-case font-normal">— reemplaza la cara de [img1]</span>
                                            </p>
                                            <div className="grid grid-cols-4 gap-1.5">
                                                {(activeBrand.avatars || []).map((a) => (
                                                    <button
                                                        key={a.id}
                                                        onClick={() => applyConsistencyRef({
                                                            url: a.imageUrl?.startsWith("http") ? a.imageUrl : avatarImageUrl(a.imageUrl!),
                                                            label: a.name,
                                                            baseName: sanitizeName(a.name) || undefined,
                                                            type: "avatar",
                                                        })}
                                                        className="group relative aspect-square overflow-hidden rounded-sm border border-edge-subtle hover:border-[var(--color-brand)] cursor-pointer"
                                                        title={a.name}
                                                    >
                                                        {a.imageUrl ? (
                                                            <img src={avatarImageUrl(a.imageUrl)} alt={a.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full bg-surface-2" />
                                                        )}
                                                        <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] truncate px-1 py-0.5 opacity-0 group-hover:opacity-100">
                                                            {a.name}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Productos del Brand Kit → type "product" (reemplaza producto) */}
                                    {activeBrand && (activeBrand.products?.length ?? 0) > 0 && (
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-bold text-fg-faint uppercase tracking-widest px-1">
                                                Productos <span className="text-fg-secondary normal-case font-normal">— reemplaza el producto de [img1]</span>
                                            </p>
                                            <div className="grid grid-cols-4 gap-1.5">
                                                {(activeBrand.products || []).map((p) => (
                                                    <button
                                                        key={p.id}
                                                        onClick={() => applyConsistencyRef({
                                                            url: p.imageUrl.startsWith("http") ? p.imageUrl : productImageUrl(p.imageUrl),
                                                            label: p.name,
                                                            baseName: sanitizeName(p.name) || undefined,
                                                            type: "product",
                                                        })}
                                                        className="group relative aspect-square overflow-hidden rounded-sm border border-edge-subtle hover:border-[var(--color-brand)] cursor-pointer"
                                                        title={p.name}
                                                    >
                                                        <img src={productImageUrl(p.imageUrl)} alt={p.name} className="w-full h-full object-cover" />
                                                        <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] truncate px-1 py-0.5 opacity-0 group-hover:opacity-100">
                                                            {p.name}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Subir ad-hoc — DOS botones, uno por tipo, así el sistema
                                        sabe qué prompt construir. Cada uno usa un dataset distinto
                                        del file input que está abajo, recordando el tipo elegido. */}
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-bold text-fg-faint uppercase tracking-widest px-1">Subir una imagen</p>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            <button
                                                onClick={() => {
                                                    if (consistencyFileRef.current) {
                                                        consistencyFileRef.current.dataset.type = "avatar";
                                                        consistencyFileRef.current.click();
                                                    }
                                                }}
                                                className="flex items-center gap-1.5 p-2 rounded border border-dashed border-edge hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-subtle)] cursor-pointer text-left transition-colors"
                                            >
                                                <span className="w-7 h-7 rounded bg-surface-2 flex items-center justify-center text-fg-faint shrink-0">
                                                    <Plus size={11} />
                                                </span>
                                                <span className="flex-1 min-w-0">
                                                    <span className="block text-[10px] font-semibold text-fg">Cara</span>
                                                    <span className="block text-[9px] text-fg-faint">avatar / persona</span>
                                                </span>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (consistencyFileRef.current) {
                                                        consistencyFileRef.current.dataset.type = "product";
                                                        consistencyFileRef.current.click();
                                                    }
                                                }}
                                                className="flex items-center gap-1.5 p-2 rounded border border-dashed border-edge hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-subtle)] cursor-pointer text-left transition-colors"
                                            >
                                                <span className="w-7 h-7 rounded bg-surface-2 flex items-center justify-center text-fg-faint shrink-0">
                                                    <Plus size={11} />
                                                </span>
                                                <span className="flex-1 min-w-0">
                                                    <span className="block text-[10px] font-semibold text-fg">Producto</span>
                                                    <span className="block text-[9px] text-fg-faint">objeto físico</span>
                                                </span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Empty hint si no hay avatares ni productos guardados */}
                                    {activeBrand && (activeBrand.avatars?.length ?? 0) === 0 && (activeBrand.products?.length ?? 0) === 0 && (
                                        <p className="text-[10px] text-fg-faint px-1.5 py-1 leading-snug">
                                            Esta marca no tiene avatares ni productos guardados. Usá los botones de subir arriba, o cargá assets en Brand Kit para reusarlos.
                                        </p>
                                    )}

                                    <input
                                        ref={consistencyFileRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={async (e) => {
                                            const f = e.target.files?.[0];
                                            if (!f) return;
                                            // El tipo viene en dataset del botón que disparó el click.
                                            const declaredType = (e.target as HTMLInputElement).dataset.type;
                                            const type: "avatar" | "product" = declaredType === "product" ? "product" : "avatar";
                                            const dataUrl = await fileToDataUrl(f);
                                            applyConsistencyRef({
                                                url: dataUrl,
                                                label: f.name.replace(/\.[^.]+$/, ""),
                                                baseName: sanitizeName(f.name.replace(/\.[^.]+$/, "")) || undefined,
                                                type,
                                            });
                                            e.target.value = "";
                                        }}
                                    />
                                </div>
                            )}
                        </Section>

                        {/* Asset picker inline (cuando se activa "Usar assets de marca") */}
                        {useBrandAssets && activeBrand && !isSandbox && (
                            <Section title="Assets de la marca">
                                <AssetPickerInline brand={activeBrand} onPick={addAssetRef} />
                            </Section>
                        )}

                        {/* Prompt */}
                        <Section title="Prompt">
                            {enhancedPrompt && (
                                <div className="border border-[var(--color-action-muted)] bg-[var(--color-action-subtle)] rounded-[var(--radius-sm)] p-2 mb-2 space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[10px] font-semibold text-fg flex items-center gap-1">
                                            <Sparkles size={10} className="text-[var(--color-action)]" />
                                            Prompt final · curado
                                        </span>
                                        <button
                                            onClick={() => { setEnhancedPrompt(null); setInterpretation(""); }}
                                            className="text-[10px] text-fg-faint hover:text-fg cursor-pointer flex items-center gap-1"
                                            title="Resetear al prompt original"
                                        >
                                            <RotateCcw size={10} /> Reset
                                        </button>
                                    </div>
                                    {interpretation && (
                                        <div className="text-[10px] text-fg-muted leading-snug">
                                            <span className="text-[var(--color-action)] font-medium">Qué entendí:</span> {interpretation}
                                        </div>
                                    )}
                                    <textarea
                                        value={enhancedPrompt}
                                        onChange={(e) => setEnhancedPrompt(e.target.value)}
                                        rows={5}
                                        className="w-full text-[11px] font-mono text-fg bg-surface-2 border border-edge rounded-[var(--radius-sm)] px-2 py-1.5 outline-none resize-y focus:border-[var(--color-edge-focus)]"
                                    />
                                </div>
                            )}
                            <div className="relative">
                                <textarea
                                    ref={promptRef}
                                    value={prompt + (dictation.listening && dictation.transcript ? ` ${dictation.transcript}` : "")}
                                    onChange={(e) => {
                                        // Si está dictando, no aceptamos input manual — el textarea queda read-ish
                                        // mostrando el interim. Cuando se commitea, onDictateCommit lo persiste.
                                        if (dictation.listening) return;
                                        setPrompt(e.target.value);
                                        handleMentionTrigger(e.target.value, e.target);
                                        if (enhancedPrompt) { setEnhancedPrompt(null); setInterpretation(""); }
                                    }}
                                    placeholder="Describí la imagen. Tipeá @ para referenciar imágenes adjuntas. Tocá el micrófono para dictar."
                                    rows={6}
                                    className={cn(
                                        "w-full text-[12px] text-fg bg-surface-1 border rounded-[var(--radius-sm)] px-2.5 py-2 pr-10 outline-none resize-y min-h-[100px] leading-relaxed transition-colors",
                                        dictation.listening
                                            ? "border-[var(--color-error,#ff4d4d)] focus:border-[var(--color-error,#ff4d4d)]"
                                            : "border-edge focus:border-[var(--color-edge-focus)]"
                                    )}
                                    onKeyDown={(e) => {
                                        // @-mention popover navigation: arrows + enter + escape.
                                        if (mention.open && filteredRefs.length > 0) {
                                            if (e.key === "ArrowDown") { e.preventDefault(); setMention((m) => ({ ...m, activeIdx: Math.min(m.activeIdx + 1, filteredRefs.length - 1) })); return; }
                                            if (e.key === "ArrowUp") { e.preventDefault(); setMention((m) => ({ ...m, activeIdx: Math.max(m.activeIdx - 1, 0) })); return; }
                                            if (e.key === "Enter") { e.preventDefault(); commitMention(filteredRefs[mention.activeIdx]); return; }
                                            if (e.key === "Escape") { e.preventDefault(); setMention((m) => ({ ...m, open: false })); return; }
                                        }
                                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
                                    }}
                                    onBlur={() => setTimeout(() => setMention((m) => ({ ...m, open: false })), 150)}
                                />
                                {/* Botón micrófono — Web Speech API. Tap para empezar, tap para terminar.
                                    Mientras escucha, el textarea muestra el interim en gris y el borde
                                    se pone rojo. Cuando paramos, el texto final se appendea al prompt. */}
                                <button
                                    onClick={() => dictation.toggle(onDictateCommit)}
                                    disabled={!dictation.supported}
                                    title={
                                        !dictation.supported ? "Tu navegador no soporta dictado (probá Chrome/Safari)"
                                            : dictation.listening ? "Tocá para parar — el texto se appendea al prompt"
                                            : "Dictar (es-AR) — Web Speech API"
                                    }
                                    className={cn(
                                        "absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-all",
                                        !dictation.supported && "opacity-40 cursor-not-allowed",
                                        dictation.listening
                                            ? "bg-[var(--color-error,#ff4d4d)] text-white shadow-md animate-pulse"
                                            : "bg-surface-2 text-fg-muted hover:bg-surface-3 hover:text-fg",
                                    )}
                                >
                                    {dictation.listening ? <MicOff size={13} /> : <Mic size={13} />}
                                </button>
                                {dictation.error && (
                                    <p className="text-[10px] text-[var(--color-error)] mt-1">{dictation.error}</p>
                                )}
                                {/* @-mention popover — anchor abajo del textarea para no tapar lo que escribís */}
                                {mention.open && filteredRefs.length > 0 && (
                                    <div className="absolute z-30 mt-1 left-0 right-0 max-h-52 overflow-y-auto bg-surface-1 border border-edge rounded-[var(--radius-md)] shadow-2xl p-1">
                                        <p className="text-[9px] uppercase tracking-widest text-fg-faint px-2 py-1">
                                            ↑/↓ navegar · Enter insertar · Esc cerrar
                                        </p>
                                        {filteredRefs.map((r, i) => (
                                            <button
                                                key={r.tag}
                                                onMouseDown={(e) => { e.preventDefault(); commitMention(r); }}
                                                className={cn(
                                                    "w-full flex items-center gap-2 p-1.5 rounded cursor-pointer text-left transition-colors",
                                                    i === mention.activeIdx
                                                        ? "bg-[var(--color-action-subtle)]"
                                                        : "hover:bg-surface-2"
                                                )}
                                            >
                                                <img src={r.url} alt={r.label} className="w-8 h-8 rounded object-cover shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <code className="text-[10px] font-bold text-[var(--color-action)]">[{r.tag}]</code>
                                                        <span className="text-[11px] text-fg truncate">{r.label}</span>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
                                <div className="flex items-center gap-1">
                                    <SegBtn label="Tal cual" active={passThrough} onClick={() => setPassThrough(true)} />
                                    <SegBtn label="Curar con Gemini" active={!passThrough} onClick={() => setPassThrough(false)} />
                                </div>
                                {/* Recomendar animación — solo en modo video con al menos 1 ref.
                                    Gemini Vision mira la imagen y propone un prompt de motion para
                                    Kling/Seedance. Respeta el intent que ya escribiste; si está
                                    vacío, decide solo. Mismo botón que tiene v1. */}
                                {mode === "video" && refs.length > 0 && (
                                    <button
                                        onClick={recommendAnimation}
                                        disabled={enhancing}
                                        className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full border border-edge text-fg-muted hover:text-fg hover:bg-surface-2 cursor-pointer transition-colors disabled:opacity-40"
                                        title="Gemini mira la imagen y propone una animación. Respeta lo que escribas; si no escribís nada, la decide él."
                                    >
                                        {enhancing
                                            ? <RefreshCw size={10} className="animate-spin" />
                                            : <Video size={10} />}
                                        Recomendar animación
                                    </button>
                                )}
                                {/* Inspirar desde video — solo modo video. El usuario pega un link
                                    o sube un clip CORTO (~5-10s) y Gemini Vision saca el motion para
                                    inyectarlo en el prompt. Diferente a "Recomendar animación" (que
                                    mira la imagen del frame); este mira un VIDEO de referencia. */}
                                {mode === "video" && (
                                    <button
                                        onClick={() => setInspireOpen((v) => !v)}
                                        className={cn(
                                            "flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full border cursor-pointer transition-colors",
                                            inspireOpen
                                                ? "border-[var(--color-brand)] bg-[var(--color-brand-subtle)] text-[var(--color-brand)]"
                                                : "border-edge text-fg-muted hover:text-fg hover:bg-surface-2",
                                        )}
                                        title="Pegá un link o subí un VIDEO CORTO (~5-10s) — Gemini te saca el motion y lo escribe en el prompt"
                                    >
                                        <Sparkles size={10} />
                                        Inspirar desde video
                                    </button>
                                )}
                            </div>
                            {/* Popover de inspirar — solo cuando inspireOpen y modo video.
                                Sumamos texto explicativo claro: esto anima UN CLIP, no una secuencia. */}
                            {mode === "video" && inspireOpen && (
                                <div className="mt-2 p-2 rounded-[var(--radius-sm)] border border-[var(--color-brand-muted)] bg-[var(--color-brand-subtle)] space-y-1.5">
                                    <p className="text-[10px] text-fg-muted leading-snug">
                                        <strong>Video corto de 1 clip</strong> (~5-10s). Gemini analiza solo el motion y lo escribe en el prompt arriba. <strong>Esta tool anima UN clip por vez</strong>, no una secuencia — si tu video es largo, cortalo antes para que la sugerencia salga limpia.
                                    </p>
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            type="url"
                                            value={inspireUrl}
                                            onChange={(e) => setInspireUrl(e.target.value)}
                                            disabled={inspireLoading}
                                            placeholder="https://www.instagram.com/reels/..."
                                            className="flex-1 h-6 px-2 rounded-[var(--radius-sm)] border border-edge bg-surface-1 text-[10px] text-fg placeholder:text-fg-faint outline-none focus:border-[var(--color-brand)]"
                                        />
                                        <label className="h-6 px-2 rounded-[var(--radius-sm)] border border-edge bg-surface-1 text-[10px] text-fg-muted hover:text-fg cursor-pointer flex items-center gap-1 transition-colors">
                                            <Plus size={10} />
                                            {inspireFile ? "✓" : "Video o GIF"}
                                            <input
                                                type="file"
                                                accept="video/*,image/gif"
                                                className="hidden"
                                                disabled={inspireLoading}
                                                onChange={(e) => {
                                                    const f = e.target.files?.[0];
                                                    if (f) setInspireFile(f);
                                                    e.target.value = "";
                                                }}
                                            />
                                        </label>
                                        <button
                                            type="button"
                                            disabled={inspireLoading || (!inspireUrl.trim() && !inspireFile)}
                                            onClick={async () => {
                                                setInspireError(null);
                                                setInspireLoading(true);
                                                try {
                                                    const res = await analyzeMotionFromVideo({
                                                        url: inspireUrl.trim() || undefined,
                                                        file: inspireFile || undefined,
                                                        imageContext: prompt.slice(0, 200),
                                                    });
                                                    if (res.motion) {
                                                        setPrompt((p) => p ? `${p} ${res.motion}` : res.motion);
                                                        setInspireOpen(false);
                                                        setInspireUrl("");
                                                        setInspireFile(null);
                                                    } else {
                                                        setInspireError("Gemini no devolvió motion.");
                                                    }
                                                } catch (e) {
                                                    setInspireError(e instanceof Error ? e.message : "Falló");
                                                } finally {
                                                    setInspireLoading(false);
                                                }
                                            }}
                                            className={cn(
                                                "h-6 px-2 rounded-[var(--radius-sm)] text-[10px] font-bold transition-colors flex items-center gap-1",
                                                !inspireLoading && (inspireUrl.trim() || inspireFile)
                                                    ? "bg-[var(--color-brand)] text-[var(--color-brand-fg)] hover:brightness-105 cursor-pointer"
                                                    : "bg-surface-2 text-fg-faint cursor-not-allowed",
                                            )}
                                        >
                                            {inspireLoading ? <RefreshCw size={10} className="animate-spin" /> : <Sparkles size={10} />}
                                            {inspireLoading ? "..." : "Analizar"}
                                        </button>
                                    </div>
                                    {inspireError && (
                                        <p className="text-[10px] text-[var(--color-error)]">{inspireError}</p>
                                    )}
                                </div>
                            )}
                        </Section>

                        {/* Params — switch entre imagen y video. Para video, mostrar solo lo
                            relevante al modelo seleccionado (Kling fija res, Seedance permite elegir). */}
                        <Section title="Parámetros">
                            {mode === "image" ? (
                                <div className="grid grid-cols-3 gap-2">
                                    <Field label="AR">
                                        <select
                                            value={aspectRatio}
                                            onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                                            className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] text-[12px] text-fg px-2 py-1.5 outline-none focus:border-[var(--color-edge-focus)] cursor-pointer"
                                        >
                                            {IMG_ASPECT_RATIOS.map((ar) => (
                                                <option key={ar} value={ar}>{ar}</option>
                                            ))}
                                        </select>
                                    </Field>
                                    <Field label="Resolución">
                                        <select
                                            value={resolution}
                                            onChange={(e) => setResolution(e.target.value as Resolution)}
                                            className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] text-[12px] text-fg px-2 py-1.5 outline-none focus:border-[var(--color-edge-focus)] cursor-pointer"
                                        >
                                            {IMG_RESOLUTIONS.map((r) => (
                                                <option key={r} value={r}>{r}</option>
                                            ))}
                                        </select>
                                    </Field>
                                    <Field label="Variantes">
                                        <select
                                            value={variantCount}
                                            onChange={(e) => setVariantCount(parseInt(e.target.value, 10))}
                                            className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] text-[12px] text-fg px-2 py-1.5 outline-none focus:border-[var(--color-edge-focus)] cursor-pointer"
                                        >
                                            {VARIANT_COUNTS.map((n) => (
                                                <option key={n} value={n}>{n}×</option>
                                            ))}
                                        </select>
                                    </Field>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-2">
                                    <Field label="Duración">
                                        <select
                                            value={vidDuration}
                                            onChange={(e) => setVidDuration(e.target.value as typeof VID_DURATIONS[number])}
                                            className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] text-[12px] text-fg px-2 py-1.5 outline-none focus:border-[var(--color-edge-focus)] cursor-pointer"
                                        >
                                            {VID_DURATIONS.map((d) => (
                                                <option key={d} value={d}>{d}s</option>
                                            ))}
                                        </select>
                                    </Field>
                                    {currentVideoModel.aspectRatios ? (
                                        <Field label="AR">
                                            <select
                                                value={vidAspectRatio}
                                                onChange={(e) => setVidAspectRatio(e.target.value)}
                                                className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] text-[12px] text-fg px-2 py-1.5 outline-none focus:border-[var(--color-edge-focus)] cursor-pointer"
                                            >
                                                {currentVideoModel.aspectRatios.map((ar) => (
                                                    <option key={ar} value={ar}>{ar}</option>
                                                ))}
                                            </select>
                                        </Field>
                                    ) : (
                                        <Field label="AR">
                                            <div className="text-[11px] text-fg-faint bg-surface-2 border border-edge rounded-[var(--radius-sm)] px-2 py-1.5">
                                                de la imagen
                                            </div>
                                        </Field>
                                    )}
                                    {currentVideoModel.resolutions ? (
                                        <Field label="Resolución">
                                            <select
                                                value={vidResolution}
                                                onChange={(e) => setVidResolution(e.target.value)}
                                                className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] text-[12px] text-fg px-2 py-1.5 outline-none focus:border-[var(--color-edge-focus)] cursor-pointer"
                                            >
                                                {currentVideoModel.resolutions.map((r) => (
                                                    <option key={r} value={r}>{r}</option>
                                                ))}
                                            </select>
                                        </Field>
                                    ) : (
                                        <Field label="Resolución">
                                            <div className="text-[11px] text-fg-faint bg-surface-2 border border-edge rounded-[var(--radius-sm)] px-2 py-1.5">
                                                fija del modelo
                                            </div>
                                        </Field>
                                    )}
                                </div>
                            )}
                        </Section>

                    </div>

                    {/* Footer sticky — el botón Generar siempre visible, no importa cuánto scroll
                        tenga el sidebar arriba. El borde superior lo separa visualmente del scroll. */}
                    <div className="border-t border-edge bg-surface-0 px-5 py-4 space-y-2.5 shrink-0">
                        {error && (
                            <div className="px-2 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-error)] bg-[var(--color-error-subtle,rgba(255,107,107,0.08))] flex items-start gap-2 text-[11px] text-[var(--color-error)]">
                                <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                                <span>{error}</span>
                                <button onClick={() => setError(null)} className="ml-auto text-fg-faint hover:text-fg cursor-pointer text-[12px] leading-none">×</button>
                            </div>
                        )}
                        <button
                            onClick={submit}
                            disabled={!canGenerate}
                            className={cn(
                                "w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-[var(--radius-md)] text-[13px] font-semibold transition-all cursor-pointer shadow-sm",
                                canGenerate
                                    ? "bg-[var(--color-action)] text-[var(--color-action-fg)] hover:opacity-90 hover:shadow-lg"
                                    : "bg-surface-2 text-fg-faint cursor-not-allowed",
                            )}
                        >
                            {busy ? (
                                <>
                                    <Loader2 size={15} className="animate-spin" />
                                    {busyLabel}
                                </>
                            ) : (
                                <>
                                    <Wand2 size={15} />
                                    Generar
                                    {variantCount > 1 && (
                                        <span className="text-[11px] opacity-80 ml-0.5">× {variantCount}</span>
                                    )}
                                </>
                            )}
                        </button>
                        <p className="text-[10px] text-fg-faint text-center leading-snug">
                            ⌘+Enter para generar
                        </p>
                    </div>
                </aside>

                {/* ── Galería derecha (scroll vertical infinito) ────
                    El drawer de sesión ahora vive a la derecha como overlay (fixed),
                    no ocupa columna del layout cuando está cerrado. Botón flotante
                    para abrirlo cuando hay generaciones. */}
                <main
                    ref={galleryRef}
                    className="flex-1 overflow-y-auto relative"
                    style={{
                        // Mismo gradient sutil que ToolRunPage para que el Lab respire igual.
                        // Ver ToolRunPage para el racional.
                        background: "radial-gradient(ellipse 50% 30% at 50% 0%, var(--color-surface-0), var(--color-canvas) 80%)",
                    }}
                >
                    {turns.length === 0 && !busy ? (
                        <div className="h-full flex flex-col items-center justify-center text-center px-8 py-16">
                            <div className="w-14 h-14 rounded-full bg-[var(--color-action-subtle)] flex items-center justify-center mb-3">
                                <Wand2 size={22} className="text-[var(--color-action)]" />
                            </div>
                            <h2 className="text-[15px] font-semibold text-fg">Generá libremente</h2>
                            <p className="text-[12px] text-fg-muted max-w-md mt-1.5 leading-relaxed">
                                Subí imágenes como referencia (opcional), describí lo que querés, y tocá Generar.
                                Las generaciones aparecen acá arriba, las más recientes primero.
                            </p>
                        </div>
                    ) : (
                        <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
                            {busy && (
                                <div className="border border-edge bg-surface-1 rounded-[var(--radius-md)] p-6 flex items-center gap-3">
                                    <Loader2 size={18} className="animate-spin text-[var(--color-action)]" />
                                    <span className="text-[13px] text-fg">{busyLabel}</span>
                                </div>
                            )}
                            {turns.map((t) => (
                                <GenCard
                                    key={t.id}
                                    turn={t}
                                    onZoom={(urls, activeIdx) => {
                                        // Callback de download cerrado sobre el turn — sabe el baseName,
                                        // el outputType (image/video) y la lista de variantes para armar
                                        // el filename correcto (ej. "promo_v2.png"). Lo guardamos en el
                                        // state del lightbox para que el botón "Descargar" lo use.
                                        const download = (idx: number) => {
                                            const base = downloadBaseName(t);
                                            const ext = t.outputType === "video" ? "mp4" : "png";
                                            const name = urls.length > 1 ? `${base}_v${idx + 1}.${ext}` : `${base}.${ext}`;
                                            downloadFile(urls[idx], name);
                                        };
                                        setLightbox({ urls, activeIdx, label: t.prompt, download });
                                    }}
                                    onUseAsRef={(url) => appendResultAsRef(url, t.baseName, "previous result")}
                                    onEdit={(url) => {
                                        // "Editar": agarrá el resultado como [img1] (limpia refs anteriores) +
                                        // dejá el prompt libre para que el usuario describa qué editar. Este es
                                        // el patrón natural de iteración: "esta imagen, pero con X cambio".
                                        setRefs([{ tag: "img1", label: "edit base", url, source: "result", baseName: t.baseName }]);
                                        setPrompt("");
                                        setEnhancedPrompt(null);
                                        setInterpretation("");
                                        // Foco en el prompt para que el usuario empiece a tipear.
                                        requestAnimationFrame(() => promptRef.current?.focus());
                                    }}
                                    onAnimate={(url) => {
                                        // "Animar": switcheá a modo video con el resultado como frame inicial.
                                        // Damos un prompt por defecto razonable que Kling i2v entiende bien,
                                        // así no queda vacío y el usuario sabe qué tipo de motion va a tener.
                                        // Lo puede editar/reemplazar antes de tocar Generar.
                                        setMode("video");
                                        setVideoMode("i2v");
                                        setRefs([{ tag: "img1", label: "frame inicial", url, source: "result", baseName: t.baseName }]);
                                        setPrompt("Movimiento de cámara sutil, atmósfera natural y cinematográfica. El sujeto se mantiene en su posición con micro-movimientos orgánicos (respiración, parpadeo, leves desplazamientos). Luz suave y constante.");
                                        setEnhancedPrompt(null);
                                        setInterpretation("");
                                        requestAnimationFrame(() => {
                                            promptRef.current?.focus();
                                            // Seleccionar todo el texto para que sea fácil reemplazarlo
                                            // si el usuario tiene otra idea en mente.
                                            promptRef.current?.select();
                                        });
                                    }}
                                    onRegenerate={() => {
                                        // "Regenerar": cargá prompt + refs del turn como composer y dejá que
                                        // el usuario toque Generar (no auto-disparamos para no gastar créditos).
                                        setPrompt(t.prompt);
                                        setEnhancedPrompt(t.sentPrompt && t.sentPrompt !== t.prompt ? t.sentPrompt : null);
                                        setRefs(t.refs.map((r, i) => ({
                                            tag: `img${i + 1}`,
                                            label: r.label,
                                            url: r.url,
                                            source: "result",
                                            baseName: t.baseName,
                                        })));
                                        // Scroll al top del sidebar (donde está el prompt + Generar).
                                        requestAnimationFrame(() => promptRef.current?.focus());
                                    }}
                                    onDownload={(url, i) => {
                                        const base = downloadBaseName(t);
                                        const ext = t.outputType === "video" ? "mp4" : "png";
                                        const name = i !== undefined ? `${base}_v${i + 1}.${ext}` : `${base}.${ext}`;
                                        downloadFile(url, name);
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </main>
            </div>

            {/* Drawer de sesión — overlay fixed sobre toda la página, no dentro del main.
                Visible SIEMPRE (incluso con 0 generaciones) para que el usuario sepa que
                existe la feature. Si está vacío, al abrir muestra un placeholder. */}
            <SessionDrawer
                turns={turns}
                open={drawerOpen}
                onToggle={() => setDrawerOpen((v) => !v)}
                onJumpTo={(turnId) => {
                    const el = document.getElementById(`turn-${turnId}`);
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                    setDrawerOpen(false);
                }}
            />

            {/* Lightbox — soporta navegación entre variantes (flechas en pantalla + teclado).
                El render usa lightbox.urls[lightbox.activeIdx] para la imagen activa. */}
            {lightbox && (
                <div
                    onClick={() => setLightbox(null)}
                    className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-6 cursor-zoom-out"
                >
                    <button
                        onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
                        title="Cerrar (Esc)"
                        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer z-10"
                    >
                        <X size={18} />
                    </button>
                    {/* Flecha izquierda */}
                    {lightbox.urls.length > 1 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setLightbox((lb) => lb && { ...lb, activeIdx: (lb.activeIdx - 1 + lb.urls.length) % lb.urls.length });
                            }}
                            title="Anterior (←)"
                            className="absolute left-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer z-10"
                        >
                            <ChevronLeft size={22} />
                        </button>
                    )}
                    {/* Flecha derecha */}
                    {lightbox.urls.length > 1 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setLightbox((lb) => lb && { ...lb, activeIdx: (lb.activeIdx + 1) % lb.urls.length });
                            }}
                            title="Siguiente (→)"
                            className="absolute right-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer z-10"
                        >
                            <ChevronRight size={22} />
                        </button>
                    )}
                    {/* Botón Descargar — arriba a la derecha, junto al cerrar.
                        Descarga la variante actualmente visible (no la primera). */}
                    {lightbox.download && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                lightbox.download!(lightbox.activeIdx);
                            }}
                            title="Descargar esta variante"
                            className="absolute top-4 right-16 flex items-center gap-1.5 px-3 h-9 rounded-full bg-white/10 hover:bg-white/25 text-white cursor-pointer z-10 text-[12px] font-medium"
                        >
                            <Download size={14} /> Descargar
                        </button>
                    )}
                    {/* Indicador de página abajo */}
                    {lightbox.urls.length > 1 && (
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[12px] text-white/80 bg-black/40 backdrop-blur rounded-full px-3 py-1">
                            {lightbox.activeIdx + 1} / {lightbox.urls.length}
                        </div>
                    )}
                    <img
                        src={lightbox.urls[lightbox.activeIdx]}
                        alt={lightbox.label || ""}
                        onClick={(e) => e.stopPropagation()}
                        className="max-w-full max-h-full object-contain rounded-[var(--radius-md)]"
                    />
                </div>
            )}
        </div>
    );
}

// ── Subcomponents ──────────────────────────────────────────────────

/**
 * Section header — eyebrow + title with a thin rule, gives every block a clear
 * visual start. Antes la section solo tenía un label diminuto en gris perdido.
 */
function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-2.5">
            <div className="flex items-baseline gap-2 border-b border-edge-subtle pb-1.5">
                <span className="text-[11px] font-semibold text-fg tracking-tight">{title}</span>
                {hint && <span className="text-[10px] text-fg-faint truncate leading-snug">{hint}</span>}
            </div>
            {children}
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <span className="text-[10px] text-fg-faint">{label}</span>
            {children}
        </div>
    );
}

function SegBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "px-2.5 py-1 text-[10px] font-medium rounded-full cursor-pointer transition-colors",
                active
                    ? "bg-[var(--color-action-subtle)] text-fg border border-[var(--color-action-muted)]"
                    : "text-fg-muted hover:text-fg border border-transparent",
            )}
        >
            {label}
        </button>
    );
}

function RefCard({ ref_, onRemove, onInsert, onZoom, onReplace }: {
    ref_: RefImage;
    onRemove: () => void;
    onInsert: () => void;
    onZoom: () => void;
    /** Reemplaza la imagen de esta ref manteniendo el tag y la posición en el array. */
    onReplace: () => void;
}) {
    return (
        <div className={cn(
            "group relative aspect-square rounded-[var(--radius-sm)] overflow-hidden bg-surface-2 transition-colors",
            // Las refs marcadas como anchor de identidad tienen border burgundy fuerte
            // — feedback visual claro de "esta es LA ref de consistencia".
            ref_.isConsistency
                ? "border-2 border-[var(--color-brand)]"
                : "border border-edge",
        )}>
            <button onClick={onZoom} className="absolute inset-0 cursor-zoom-in" title="Ver grande">
                <img src={ref_.url} alt={ref_.label} className="w-full h-full object-cover" />
            </button>
            {/* Badge "ID" arriba a la izquierda cuando es anchor de identidad. Always-on
                (no en hover) para que el usuario sepa siempre qué ref está actuando como anchor. */}
            {ref_.isConsistency && (
                <span
                    title="Anchor de identidad — fuente de verdad para el sujeto"
                    className="absolute top-1 left-1 flex items-center gap-0.5 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--color-brand)] text-[var(--color-brand-fg)]"
                >
                    <Target size={8} /> ID
                </span>
            )}
            <button
                onClick={onInsert}
                title="Insertar @tag en el prompt"
                className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[9px] font-mono py-0.5 px-1 text-center cursor-pointer hover:bg-black/90"
            >
                [{ref_.tag}]
            </button>
            {/* Acciones top-right en hover: Reemplazar + Quitar. Reemplazar mantiene
                el [tag] así no perdés las menciones que ya escribiste en el prompt. */}
            <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={onReplace}
                    title="Reemplazar imagen — mantiene el tag"
                    className="w-5 h-5 rounded-full bg-black/70 text-white hover:bg-black flex items-center justify-center cursor-pointer"
                >
                    <RefreshCw size={10} />
                </button>
                <button
                    onClick={onRemove}
                    title="Quitar"
                    className="w-5 h-5 rounded-full bg-black/70 text-white hover:bg-black flex items-center justify-center cursor-pointer"
                >
                    <X size={10} />
                </button>
            </div>
        </div>
    );
}

type AssetKind = "avatar" | "product" | "clothing" | "background" | "moodboard" | "lookfeel" | "logo";
const ASSET_TABS: Array<{ id: AssetKind; label: string }> = [
    { id: "avatar", label: "avatar" },
    { id: "product", label: "prod" },
    { id: "clothing", label: "ropa" },
    { id: "background", label: "fondo" },
    { id: "moodboard", label: "mood" },
    { id: "lookfeel", label: "L&F" },
    { id: "logo", label: "logo" },
];

function AssetPickerInline({
    brand,
    onPick,
}: {
    brand: NonNullable<ReturnType<typeof useBrand>["activeBrand"]>;
    onPick: (kind: AssetKind, item: { id: string; name: string; imageUrl?: string }) => void;
}) {
    const [tab, setTab] = useState<AssetKind>("avatar");
    const items: Array<{ id: string; name: string; imageUrl?: string }> =
        tab === "avatar" ? (brand.avatars || []) :
        tab === "product" ? (brand.products || []).map((p) => ({ id: p.id, name: p.name, imageUrl: p.imageUrl })) :
        tab === "clothing" ? (brand.clothing || []) :
        tab === "background" ? (brand.backgrounds || []) :
        tab === "moodboard" ? (brand.moodboards || []) :
        tab === "lookfeel" ? (brand.lookAndFeel || []) :
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
        <div className="border border-edge rounded-[var(--radius-sm)] bg-surface-1 p-2 space-y-2">
            <div className="flex gap-0.5 flex-wrap">
                {ASSET_TABS.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={cn(
                            "text-[10px] px-2 py-1 rounded cursor-pointer",
                            tab === t.id ? "bg-surface-2 text-fg" : "text-fg-muted hover:bg-surface-2",
                        )}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
            {items.length === 0 ? (
                <p className="text-[10px] text-fg-faint p-2">Sin {tab} en esta marca.</p>
            ) : (
                <div className="grid grid-cols-4 gap-1.5 max-h-60 overflow-y-auto">
                    {items.map((it) => (
                        <button
                            key={it.id}
                            onClick={() => onPick(tab, it)}
                            className="group relative aspect-square overflow-hidden rounded-sm border border-edge-subtle hover:border-edge-strong cursor-pointer"
                            title={it.name}
                        >
                            {it.imageUrl ? (
                                <img src={resolver(it.imageUrl)} alt={it.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-surface-2" />
                            )}
                            <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] truncate px-1 py-0.5 opacity-0 group-hover:opacity-100">
                                {it.name}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function GenCard({
    turn,
    onZoom,
    onUseAsRef,
    onEdit,
    onAnimate,
    onRegenerate,
    onDownload,
}: {
    turn: GenTurn;
    /** Abre el lightbox con la lista completa de URLs y el índice clickeado.
     *  Eso permite que en el lightbox se pueda navegar entre variantes con ← / →. */
    onZoom: (urls: string[], activeIdx: number) => void;
    onUseAsRef: (url: string) => void;
    onEdit: (url: string) => void;
    onAnimate: (url: string) => void;
    onRegenerate: () => void;
    onDownload: (url: string, variantIdx?: number) => void;
}) {
    // Local state — mostrar/ocultar el "prompt usado" (el sentPrompt que se envió al modelo,
    // distinto del prompt del usuario cuando se curó con Gemini). Mismo patrón que v1.
    const [showSent, setShowSent] = useState(false);
    const urls = turn.variants && turn.variants.length > 0 ? turn.variants : (turn.outputUrl ? [turn.outputUrl] : []);
    if (urls.length === 0) return null;

    const isVideo = turn.outputType === "video";

    // Antes había un concepto de "variante activa" que se actualizaba en hover y sobre
    // ella aplicaban los botones del footer. Era ambiguo: si solo clickeabas el botón
    // sin hover, se aplicaba a la primera (= bug que el usuario reportó). Ahora cada
    // variante tiene sus propias acciones en hover, así que ese state ya no hace falta.

    return (
        <article id={`turn-${turn.id}`} className="border border-edge-subtle rounded-[var(--radius-lg)] bg-surface-1 p-4 space-y-3 group/turn hover:border-edge transition-colors scroll-mt-4 shadow-sm">
            {/* MEDIA — imágenes con sus rounded propios + gap entre ellas, dentro del
                bloque contenedor. El container las agrupa visualmente con el footer
                (prompt + tags + acciones) para que se entienda como una sola unidad.
                Sin el container, las acciones quedaban flotando sin contexto. */}
            {isVideo ? (
                <video
                    src={urls[0]}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full max-h-[640px] rounded-[var(--radius-md)] border border-edge bg-black"
                />
            ) : urls.length === 1 ? (
                <button
                    onClick={() => onZoom(urls, 0)}
                    className="block w-full cursor-zoom-in"
                >
                    <img
                        src={urls[0]}
                        alt={turn.prompt}
                        loading="lazy"
                        decoding="async"
                        className="w-full max-h-[640px] object-contain rounded-[var(--radius-md)] border border-edge-subtle bg-black/20"
                    />
                </button>
            ) : (
                <div className="flex items-stretch gap-3">
                    {urls.map((url, i) => (
                        // Cada variante es su propio "mini-card" con acciones específicas en hover.
                        // Eso elimina la ambigüedad de "qué variante recibe la acción" — antes
                        // los botones del footer aplicaban a la primera siempre porque el active
                        // solo se actualizaba en hover. Ahora cada imagen tiene sus propios botones.
                        <div key={i} className="group/variant relative flex-1 min-w-0">
                            <button
                                onClick={() => onZoom(urls, i)}
                                className="block w-full cursor-zoom-in"
                                title="Click para abrir grande"
                            >
                                <img
                                    src={url}
                                    alt={`${turn.prompt} v${i + 1}`}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full max-h-[640px] object-contain rounded-[var(--radius-md)] bg-black/30 border-2 border-transparent group-hover/variant:border-[var(--color-brand)] transition-colors"
                                />
                            </button>
                            {/* Badge "vN" arriba a la izquierda — siempre visible para que sepas
                                cuál es cuál sin ambigüedad. */}
                            <span className="absolute top-2 left-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/60 text-white backdrop-blur pointer-events-none">
                                v{i + 1}
                            </span>
                            {/* Mini-toolbar de acciones por variante — aparece en hover. Las
                                acciones aplican explícitamente a ESTA imagen, no a "la activa". */}
                            {!isVideo && (
                                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover/variant:opacity-100 transition-opacity">
                                    <VariantIconBtn onClick={() => onEdit(url)} title="Editar — usar esta como base"><Wand2 size={12} /></VariantIconBtn>
                                    <VariantIconBtn onClick={() => onUseAsRef(url)} title="Usar como referencia"><Plus size={12} /></VariantIconBtn>
                                    <VariantIconBtn onClick={() => onAnimate(url)} title="Animar — usar esta como frame inicial"><Video size={12} /></VariantIconBtn>
                                    <VariantIconBtn onClick={() => onDownload(url, i)} title="Descargar"><Download size={12} /></VariantIconBtn>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* INFO ROW — prompt + tags, alineado al padding del container.
                El prompt usa line-clamp-2 para no expandir cards con prompts largos. */}
            <div className="flex items-start justify-between gap-4">
                <p className="text-[11px] text-fg-secondary line-clamp-2 flex-1 min-w-0" title={turn.prompt}>
                    {turn.prompt || <span className="text-fg-faint italic">sin prompt</span>}
                </p>
                <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                    {turn.params.model && <Tag>{turn.params.model}</Tag>}
                    {turn.params.videoModel && <Tag>{turn.params.videoModel}</Tag>}
                    {turn.params.aspectRatio && <Tag>{turn.params.aspectRatio}</Tag>}
                    {turn.params.resolution && <Tag>{turn.params.resolution}</Tag>}
                    {turn.params.duration && <Tag>{turn.params.duration}</Tag>}
                    {urls.length > 1 && <Tag>{urls.length}×</Tag>}
                </div>
            </div>

            {/* ACTIONS del bloque — son acciones que aplican al turn ENTERO, no a una
                variante específica. Cuando hay variantes (>1), las acciones por-imagen
                (Editar / Usar como ref / Animar / Descargar) viven en hover sobre cada
                variante, así no hay ambigüedad de cuál estás usando. Acá solo:
                Regenerar (re-corre el prompt) + Ver prompt usado + (para una sola imagen,
                las acciones individuales también).
                Pequeña nota informativa cuando hay varias para que el usuario sepa
                dónde están las acciones por-imagen. */}
            <div className="flex items-center gap-1 flex-wrap pt-2 border-t border-edge-subtle">
                {urls.length === 1 && !isVideo && (
                    <>
                        <ActionPill onClick={() => onEdit(urls[0])} icon={<Wand2 size={11} />} label="Editar" title="Usar como base y editar con un nuevo prompt" />
                        <ActionPill onClick={() => onUseAsRef(urls[0])} icon={<Plus size={11} />} label="Usar como ref" title="Agregar como nueva referencia" />
                        <ActionPill onClick={() => onAnimate(urls[0])} icon={<Video size={11} />} label="Animar" title="Cambiar a modo video con esta imagen como frame inicial" />
                        <ActionPill onClick={() => onDownload(urls[0])} icon={<Download size={11} />} label="Descargar" />
                    </>
                )}
                <ActionPill onClick={onRegenerate} icon={<RotateCcw size={11} />} label="Regenerar" title="Volver a generar con el mismo prompt y refs" />
                {turn.refs.length > 0 && (
                    <span className="ml-1 text-[10px] text-fg-faint">· {turn.refs.length} ref{turn.refs.length === 1 ? "" : "s"}</span>
                )}
                {turn.sentPrompt && turn.sentPrompt !== turn.prompt && (
                    <ActionPill
                        onClick={() => setShowSent((v) => !v)}
                        icon={<Eye size={11} />}
                        label={showSent ? "Ocultar prompt" : "Ver prompt usado"}
                        title="Ver el prompt que efectivamente se envió al modelo (post-curación)"
                    />
                )}
                {urls.length > 1 && (
                    <span className="ml-auto text-[10px] text-fg-faint">
                        Hover una variante para editar / animar / descargar esa
                    </span>
                )}
            </div>

            {/* Prompt usado (sentPrompt) — solo cuando el usuario lo expande. */}
            {showSent && turn.sentPrompt && (
                <pre className="text-[10px] text-fg-muted bg-surface-2 border border-edge-subtle rounded-[var(--radius-sm)] p-3 whitespace-pre-wrap font-mono max-w-full overflow-x-auto leading-relaxed">
                    {turn.sentPrompt}
                </pre>
            )}
        </article>
    );
}

function Tag({ children }: { children: React.ReactNode }) {
    return (
        <span className="text-[9px] uppercase tracking-wider font-semibold bg-surface-2 border border-edge-subtle text-fg-secondary px-2 py-0.5 rounded-full">
            {children}
        </span>
    );
}

/**
 * Drawer de sesión — overlay derecho con todas las generaciones como thumbnails.
 *
 * Cerrado: botón flotante chico arriba a la derecha que abre el panel.
 * Abierto: panel de 180px que se solapa sobre la galería principal (z-index alto,
 *   shadow para que se entienda como overlay). No empuja el layout, no roba ancho.
 *   Click fuera o tap al ✕ → se cierra.
 *
 * Click en una thumb → smooth scroll a esa generación en el main.
 */
function SessionDrawer({
    turns,
    open,
    onToggle,
    onJumpTo,
}: {
    turns: GenTurn[];
    open: boolean;
    onToggle: () => void;
    onJumpTo: (turnId: string) => void;
}) {
    // Newest first. Cada variante = su propia thumbnail. Cap a 60 (sino Chrome OOM).
    const items = turns
        .filter((t) => t.status === "completed")
        .flatMap((t) => {
            const urls = t.variants && t.variants.length > 0 ? t.variants : (t.outputUrl ? [t.outputUrl] : []);
            return urls.map((url, i) => ({
                key: `${t.id}_v${i}`,
                url,
                turnId: t.id,
                outputType: t.outputType,
                variantIdx: urls.length > 1 ? i + 1 : null,
                prompt: t.prompt,
            }));
        })
        .slice(0, 60);

    return (
        <>
            {/* El botón "Sesión" ahora vive en el header del Lab (no flotante) para no
                tapar "Marca:" ni nada. El SessionDrawer solo aporta el panel deslizable
                de la derecha. */}

            {/* Drawer abierto — overlay FIXED al viewport. No ocupa layout cuando cerrado. */}
            {open && (
                <>
                    {/* Backdrop fixed. Click cierra. */}
                    <div
                        onClick={onToggle}
                        className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px]"
                    />
                    <div className="fixed top-14 right-0 z-40 h-[calc(100vh-3.5rem)] w-[220px] border-l border-edge bg-surface-0 flex flex-col shadow-2xl">
                        <div className="flex items-center justify-between px-3 py-2.5 border-b border-edge-subtle shrink-0">
                            <span className="text-[10px] font-bold text-fg uppercase tracking-widest">
                                Sesión <span className="text-[var(--color-brand-strong)]">({items.length})</span>
                            </span>
                            <button
                                onClick={onToggle}
                                title="Cerrar"
                                className="w-6 h-6 rounded-full text-fg-faint hover:text-fg hover:bg-surface-2 cursor-pointer flex items-center justify-center"
                            >
                                <X size={12} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                            {items.length === 0 ? (
                                <p className="text-[10px] text-fg-faint p-2 leading-snug">
                                    Sin generaciones todavía.
                                </p>
                            ) : (
                                items.map((it) => (
                                    <button
                                        key={it.key}
                                        onClick={() => { onJumpTo(it.turnId); }}
                                        title={it.prompt || "Saltar a esta generación"}
                                        className="relative w-full aspect-square rounded-[var(--radius-sm)] overflow-hidden border border-edge-subtle hover:border-[var(--color-brand)] cursor-pointer bg-surface-2 transition-colors"
                                    >
                                        {it.outputType === "video" ? (
                                            <div className="w-full h-full bg-surface-1 flex items-center justify-center text-fg-faint">
                                                <Video size={20} />
                                            </div>
                                        ) : (
                                            <img
                                                src={it.url}
                                                alt={it.prompt}
                                                loading="lazy"
                                                decoding="async"
                                                className="w-full h-full object-cover"
                                            />
                                        )}
                                        {it.variantIdx !== null && (
                                            <span className="absolute top-1 left-1 text-[9px] font-bold bg-black/60 text-white px-1.5 py-0.5 rounded backdrop-blur">
                                                v{it.variantIdx}
                                            </span>
                                        )}
                                        {it.outputType === "video" && (
                                            <span className="absolute bottom-1 right-1 text-[9px] bg-black/60 text-white px-1 rounded backdrop-blur">
                                                ▶
                                            </span>
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </>
    );
}

/** Botón icon-only en el overlay de cada variante. Aparece en hover, sobre fondo
 *  oscuro semi-transparente para que se lea sobre cualquier imagen. Hover burgundy
 *  para que el feedback de "vas a actuar sobre esta variante" sea claro. */
function VariantIconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title?: string }) {
    return (
        <button
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            title={title}
            className="w-7 h-7 rounded-full bg-black/70 hover:bg-[var(--color-brand)] text-white flex items-center justify-center cursor-pointer backdrop-blur transition-colors"
        >
            {children}
        </button>
    );
}

/** Action pill — botón de acción en el footer de cada generación. Hover con accent
 *  burgundy sutil para que no se vea muerto como antes (era gris-hover-gris). */
function ActionPill({
    onClick, icon, label, title,
}: {
    onClick: () => void; icon: React.ReactNode; label: string; title?: string;
}) {
    return (
        <button
            onClick={onClick}
            title={title}
            className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-full text-fg-muted hover:text-[var(--color-brand-strong)] hover:bg-[var(--color-brand-subtle)] cursor-pointer transition-colors"
        >
            {icon} {label}
        </button>
    );
}

