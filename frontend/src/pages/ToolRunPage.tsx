import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Loader2,
  ChevronRight,
  Check,
  Play,
  Sparkles,
  Video,
  Camera,
  Megaphone,
  Share2,
  Film,
  Eraser,
  ImageIcon,
  Mic,
  Scissors,
  Type,
  Palette,
  Wand2,
  Eye,
  ListChecks,
  Plus,
  RotateCcw,
  Settings2,
  AlertCircle,
  Square,
  Pencil,
  Download,
  Zap,
  X,
  Mountain,
} from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import {
  avatarImageUrl, productImageUrl, clothingImageUrl, backgroundImageUrl, moodboardImageUrl,
  type Brand,
  generateCopy, generateTTS, generateTTSAndUpload, createImageEdit, pollImageGen,
  createFalLipSync, pollFalLipSync, concatVideos, saveGeneration,
  generateToolPrompt, createKlingVideo, pollKlingVideo,
  uploadAvatar, uploadClothing, uploadBackground, uploadMoodboard,
  createHeyGenAvatar4, pollHeyGenAvatar4,
  fetchSystemVoices,
  fetchBrandActions,
  getTikTokTopVideos,
  type TikTokVideo,
  type ActionCategory,
} from "../lib/api";
import { cn } from "../lib/utils";
import { ImageEditPanel } from "../components/ImageEditPanel";
import { UGCPlayer } from "../remotion/UGCPlayer";
import { TOOL_DEFINITIONS } from "../tools/registry";

// ── Types ──────────────────────────────────────────────────

interface ToolEntry {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  status: string;
  pipeline: string[];
}

// ── Step metadata ──────────────────────────────────────────

const STEP_META: Record<
  string,
  { label: string; icon: React.ReactNode; description: string }
> = {
  script: {
    label: "Script",
    icon: <Type size={15} />,
    description: "Generá el script/copy con IA",
  },
  base_image: {
    label: "Imagen base",
    icon: <ImageIcon size={15} />,
    description: "Generá y aprobá la imagen hero de la escena 1",
  },
  multishot: {
    label: "Shots",
    icon: <Camera size={15} />,
    description: "Generá variaciones por escena — elegí la mejor de cada una",
  },
  images: {
    label: "Imágenes",
    icon: <ImageIcon size={15} />,
    description: "Generá variaciones de imagen para cada escena",
  },
  image: {
    label: "Imagen",
    icon: <ImageIcon size={15} />,
    description: "Generá el creativo visual",
  },
  curation: {
    label: "Curación",
    icon: <Eye size={15} />,
    description: "Elegí y reordená los mejores shots del video",
  },
  voice: {
    label: "Voz",
    icon: <Mic size={15} />,
    description: "Generá el voiceover con text-to-speech",
  },
  lipsync: {
    label: "Lip-sync",
    icon: <Video size={15} />,
    description: "Animá la imagen con lip-sync",
  },
  subtitles: {
    label: "Subtítulos",
    icon: <Type size={15} />,
    description: "Subtítulos en overlay generados automáticamente",
  },
  render: {
    label: "Render",
    icon: <Film size={15} />,
    description: "Combinar todos los elementos en el output final",
  },
  prompt: {
    label: "Prompt",
    icon: <Wand2 size={15} />,
    description: "Generá prompts de imagen desde el contexto de marca",
  },
  generate: {
    label: "Generar",
    icon: <Sparkles size={15} />,
    description: "Correr la generación con IA",
  },
  copy: {
    label: "Copy",
    icon: <Type size={15} />,
    description: "Generá copy y headlines del ad",
  },
  compose: {
    label: "Componer",
    icon: <Palette size={15} />,
    description: "Componer el creativo final",
  },
  caption: {
    label: "Caption",
    icon: <Type size={15} />,
    description: "Generá un caption para social media",
  },
  scenes: {
    label: "Escenas",
    icon: <ListChecks size={15} />,
    description: "Generá descripciones de escenas",
  },
  music: {
    label: "Música",
    icon: <Mic size={15} />,
    description: "Elegí el mood musical y el track",
  },
  remove: {
    label: "Quitar fondo",
    icon: <Scissors size={15} />,
    description: "Eliminación de fondo con IA",
  },
  variations: {
    label: "Variaciones",
    icon: <Camera size={15} />,
    description: "Generá varias variaciones para elegir",
  },
  animate: {
    label: "Animar",
    icon: <Video size={15} />,
    description: "Animá los frames con Kling para transiciones suaves",
  },
  visual_guide: {
    label: "Guía visual",
    icon: <Palette size={15} />,
    description: "Analizá imágenes de referencia para extraer el estilo visual",
  },
  prompts: {
    label: "Prompts",
    icon: <Wand2 size={15} />,
    description: "Generá prompts creativos desde la guía visual + producto",
  },
  generate_batch: {
    label: "Generar",
    icon: <Sparkles size={15} />,
    description: "Generá todos los creativos desde los prompts",
  },
  analyze: {
    label: "Analizar",
    icon: <Eye size={15} />,
    description: "Analizá el video con Gemini Vision",
  },
  adapt: {
    label: "Adaptar",
    icon: <Wand2 size={15} />,
    description: "Adaptá el contenido a tu marca",
  },
  route: {
    label: "Crear contenido",
    icon: <Zap size={15} />,
    description: "Elegí cómo querés usar este contenido en tu marca",
  },
  review: {
    label: "Revisar",
    icon: <Eye size={15} />,
    description: "Revisá, editá e iterá sobre los creativos generados",
  },
};

const TOOL_ICONS: Record<string, React.ReactNode> = {
  video: <Video size={20} />,
  camera: <Camera size={20} />,
  megaphone: <Megaphone size={20} />,
  share: <Share2 size={20} />,
  film: <Film size={20} />,
  eraser: <Eraser size={20} />,
  sparkles: <Sparkles size={20} />,
};

type StepStatus = "pending" | "active" | "running" | "review" | "done" | "stale" | "error";

interface StepState {
  id: string;
  status: StepStatus;
  result?: unknown;
  error?: string;
}

// ── Tool config state ──────────────────────────────────────

interface ToolConfig {
  selectedAvatarId: string | null;
  selectedAvatarIds: string[];
  selectedProductId: string | null;
  selectedProductIds: string[];
  selectedClothingIds: string[];
  selectedBackgroundId: string | null;
  selectedVoiceId: string | null;
  objective: string;
  tone: string;
  platform: string;
  language: string;
  notes: string;
  numVariations: number;
  locationRef: string;
  styleRef: string;
  productIsWorn: boolean;
  aspectRatio: string;
  resolution: string;
  subtitleEngine: "auto" | "remotion" | "ffmpeg" | "none";
  referenceImages: File[];
  graphicAssets: File[];
  allowFaces: boolean;
  adStyle: string;
  animationMode: "frame-to-frame" | "image-to-video";
  adTemplate: string;
  carouselType: string;
  numSlides: number;
  customScript: string;
  videoDuration: string;
  ugcMode: "standard" | "narrative";
  lipsyncMethod: "heygen" | "synclipsync";
  creativeMode: "single-frame" | "frame-to-frame";
  visualStyle: "iphone" | "cinematic" | "studio" | "custom" | "editorial";
  visualStyleCustom: string;
  reelMode: "story" | "looks";
  hookType: "none" | "distracted" | "empty-room" | "walks-in" | "looks-down" | "phone-flip";
  hookMode: "standard" | "fooh";
  foohPrompt: string;
  // ElevenLabs voice settings
  voiceStability: number;
  voiceSimilarityBoost: number;
  voiceStyle: number;
  voiceSpeed: number;
  voiceSpeakerBoost: boolean;
}

const DEFAULT_CONFIG: ToolConfig = {
  selectedAvatarId: null,
  selectedAvatarIds: [],
  selectedProductId: null,
  selectedProductIds: [],
  selectedClothingIds: [],
  selectedBackgroundId: null,
  selectedVoiceId: null,
  objective: "",
  tone: "engaging",
  platform: "instagram",
  language: "es",
  notes: "",
  numVariations: 3,
  locationRef: "",
  styleRef: "",
  productIsWorn: false,
  aspectRatio: "9:16",
  resolution: "2K",
  subtitleEngine: "auto",
  referenceImages: [],
  graphicAssets: [],
  allowFaces: true,
  adStyle: "photorealistic",
  animationMode: "frame-to-frame",
  adTemplate: "",
  carouselType: "",
  numSlides: 5,
  customScript: "",
  videoDuration: "15",
  ugcMode: "standard",
  lipsyncMethod: "heygen",
  creativeMode: "single-frame",
  visualStyle: "iphone",
  visualStyleCustom: "",
  reelMode: "story",
  hookType: "none",
  hookMode: "standard",
  foohPrompt: "",
  voiceStability: 0.5,
  voiceSimilarityBoost: 0.8,
  voiceStyle: 0.0,
  voiceSpeed: 1.0,
  voiceSpeakerBoost: true,
};

// ── Mock data for preview ─────────────────────────────────

const MOCK_SCRIPT = [
  [
    {
      id: "act_1_hook",
      title: "Act 1: Hook",
      script: "¿Sabías que el 80% de las personas no cuidan su piel como deberían? Yo era una de ellas... hasta que descubrí esto.",
      image_prompt: "Close-up portrait of a young latino man looking directly at camera with surprised expression, natural window lighting, urban apartment background, 9:16 vertical, photorealistic",
    },
    {
      id: "act_2_story",
      title: "Act 2: Story",
      script: "Probé de todo: cremas caras, remedios caseros, hasta recetas de mi abuela. Nada funcionaba realmente.",
      image_prompt: "Medium shot of the same young latino man gesturing with hands while talking, showing frustration, soft rim lighting, same apartment, 9:16 vertical",
    },
    {
      id: "act_3_story2",
      title: "Act 3: Story",
      script: "Hasta que un amigo me recomendó este producto. Al principio no le creí, pero después de dos semanas... mirá mi piel.",
      image_prompt: "Medium close-up of the same young latino man holding a product, showing it to camera with genuine smile, warm natural lighting, 9:16 vertical",
    },
    {
      id: "act_4_twist",
      title: "Act 4: Twist",
      script: "Lo mejor es que no necesitás una rutina de 10 pasos. Solo esto, mañana y noche, y listo.",
      image_prompt: "Close-up of the same young latino man applying product to face, relaxed confident expression, bathroom mirror reflection visible, soft studio lighting, 9:16 vertical",
    },
    {
      id: "act_5_cta",
      title: "Act 5: CTA",
      script: "Link en mi bio. Usá el código GLOW20 y llevátelo con 20% de descuento. No te vas a arrepentir.",
      image_prompt: "Tight close-up of the same young latino man pointing at camera with a confident wink, bold lighting, clean background, text overlay space at bottom, 9:16 vertical",
    },
  ],
];

const MOCK_BASE_IMAGE = {
  url: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=711&fit=crop",
  prompt: MOCK_SCRIPT[0][0].image_prompt,
};

const MOCK_MULTISHOT = MOCK_SCRIPT[0].map((scene, i) => ({
  sceneId: scene.id,
  title: scene.title,
  variations: [
    { id: `${scene.id}_v1`, url: `https://picsum.photos/seed/${i * 3 + 1}/400/711`, composition: "Close-up", score: 85 + Math.floor(Math.random() * 10) },
    { id: `${scene.id}_v2`, url: `https://picsum.photos/seed/${i * 3 + 2}/400/711`, composition: "Medium shot", score: 70 + Math.floor(Math.random() * 15) },
    { id: `${scene.id}_v3`, url: `https://picsum.photos/seed/${i * 3 + 3}/400/711`, composition: "Low angle", score: 60 + Math.floor(Math.random() * 20) },
  ],
}));

const MOCK_CURATION = MOCK_MULTISHOT.map((scene) => {
  const best = scene.variations.reduce((a, b) => (a.score > b.score ? a : b));
  return { sceneId: scene.sceneId, title: scene.title, selectedId: best.id, selectedUrl: best.url, score: best.score };
});

const MOCK_VOICE = MOCK_SCRIPT[0].map((scene) => ({
  sceneId: scene.id,
  title: scene.title,
  duration: (2.5 + Math.random() * 3).toFixed(1),
  text: scene.script,
}));

const MOCK_LIPSYNC = MOCK_CURATION.map((scene) => ({
  sceneId: scene.sceneId,
  title: scene.title,
  videoUrl: scene.selectedUrl,
  duration: MOCK_VOICE.find((v) => v.sceneId === scene.sceneId)?.duration || "3.0",
}));

const MOCK_SUBTITLES = MOCK_SCRIPT[0].map((scene, i) => ({
  sceneId: scene.id,
  title: scene.title,
  text: scene.script,
  startTime: i * 5,
  endTime: i * 5 + 4.5,
}));

const MOCK_RENDER = {
  totalDuration: "25.3s",
  scenes: MOCK_SCRIPT[0].length,
  format: "MP4 / H.264",
  resolution: "1080x1920 (9:16)",
};

const MOCK_STEP_RESULTS: Record<string, unknown> = {
  script: MOCK_SCRIPT,
  base_image: MOCK_BASE_IMAGE,
  multishot: MOCK_MULTISHOT,
  curation: MOCK_CURATION,
  voice: MOCK_VOICE,
  lipsync: MOCK_LIPSYNC,
  subtitles: MOCK_SUBTITLES,
  render: MOCK_RENDER,
};

// ── Fallback tool definitions (when backend is down) ──────

const FALLBACK_TOOLS: Record<string, ToolEntry> = {
  ugc_creator: { id: "ugc_creator", name: "UGC Creator", category: "video", description: "Create complete UGC videos: script, base image, multishot variations, voice, lip-sync, subtitles.", icon: "video", status: "active", pipeline: ["script", "base_image", "multishot", "voice", "lipsync", "subtitles", "render"] },

  reel_creator: { id: "reel_creator", name: "Reel Creator", category: "video", description: "Create short-form video reels with scenes, music, and subtitles.", icon: "film", status: "coming_soon", pipeline: ["script", "scenes", "music", "subtitles", "render"] },
  bg_remover: { id: "bg_remover", name: "Background Remover", category: "images", description: "Remove background from product photos using AI segmentation.", icon: "eraser", status: "coming_soon", pipeline: ["remove"] },
};

// ── Page Component ─────────────────────────────────────────

export function ToolRunPage() {
  const { toolId } = useParams();
  const [searchParams] = useSearchParams();
  const generationId = searchParams.get("gen");
  const handoffKey = searchParams.get("handoff");
  const { activeBrand } = useBrand();
  const [tool, setTool] = useState<ToolEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState<StepState[]>([]);
  const stepsRef = useRef<StepState[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [started, setStarted] = useState(false);
  const [config, setConfig] = useState<ToolConfig>(DEFAULT_CONFIG);
  const [mockRunning, setMockRunning] = useState(false);
  const [curationSelections, setCurationSelections] = useState<Record<string, string>>({}); // sceneId → variationId
  const [audioCache, setAudioCache] = useState<Record<string, { url: string; blob: Blob }>>({}); // sceneId → {url, blob}
  const [validationError, setValidationError] = useState<string | null>(null);
  const audioCacheRef = useRef<Record<string, { url: string; blob: Blob }>>({});

  // Keep refs in sync so async callbacks always read latest
  useEffect(() => { stepsRef.current = steps; }, [steps]);
  useEffect(() => { audioCacheRef.current = audioCache; }, [audioCache]);

  useEffect(() => {
    if (!toolId) return;
    fetch(`http://localhost:8000/api/tools/${toolId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data) => {
        setTool(data);
        setSteps(
          (data.pipeline || []).map((stepId: string) => ({
            id: stepId,
            status: "pending" as StepStatus,
          }))
        );
        setLoading(false);
      })
      .catch(() => {
        // Fallback to local tool definitions when backend is down
        const fallback = FALLBACK_TOOLS[toolId];
        if (fallback) {
          setTool(fallback);
          setSteps(
            fallback.pipeline.map((stepId: string) => ({
              id: stepId,
              status: "pending" as StepStatus,
            }))
          );
        }
        setLoading(false);
      });
  }, [toolId]);

  // Load saved generation pipeline state if ?gen= param present
  useEffect(() => {
    if (!generationId || !tool) return;
    fetch(`http://localhost:8000/api/generations/${generationId}`)
      .then((r) => { if (!r.ok) throw new Error("Not found"); return r.json(); })
      .then((gen) => {
        if (!gen.pipelineState) return;
        const { steps: savedSteps, config: savedConfig, curationSelections: savedCurations } = gen.pipelineState;
        // Restore steps — mark all as "done" so user can navigate and re-run from any
        if (Array.isArray(savedSteps) && savedSteps.length > 0) {
          // Multishot/curation need "review" status so the interactive CurationPanel renders.
          // All other steps with results get "done". Steps without results get "pending".
          const REVIEW_ON_RESTORE = new Set(["multishot", "curation"]);
          setSteps(savedSteps.map((s: { id: string; status: string; result?: unknown }) => ({
            id: s.id,
            status: (s.result
              ? (REVIEW_ON_RESTORE.has(s.id) ? "review" : "done")
              : "pending") as StepStatus,
            result: s.result,
          })));
          // Start at multishot/curation if it has a result — that's the natural editing entry point.
          // Fall back to the last step with a result otherwise.
          const multishotIdx = savedSteps.findIndex((s: { id: string; result?: unknown }) =>
            REVIEW_ON_RESTORE.has(s.id) && s.result
          );
          const lastDone = savedSteps.reduce((acc: number, s: { result?: unknown }, i: number) => s.result ? i : acc, 0);
          setActiveStep(multishotIdx >= 0 ? multishotIdx : lastDone);
          setStarted(true);
        }
        if (savedConfig) {
          setConfig((prev) => ({ ...prev, ...savedConfig }));
        }
        if (savedCurations) {
          setCurationSelections(savedCurations);
        }
      })
      .catch(() => { /* generation not found or no pipeline state */ });
  }, [generationId, tool]);

  // Apply handoff from chat ("Crear con esto" button)
  useEffect(() => {
    if (!tool) return;
    try {
      const raw = sessionStorage.getItem("coevo-chat-handoff");
      if (!raw) return;
      const h = JSON.parse(raw) as { from: string; brief?: string; tool?: string };
      if (h.from !== "chat" || h.tool !== tool.id) return;
      sessionStorage.removeItem("coevo-chat-handoff");
      if (h.brief) {
        setConfig((prev) => ({
          ...prev,
          objective: prev.objective ? `${prev.objective}\n\n${h.brief}` : h.brief!,
        }));
      }
    } catch (err) {
      console.error("[chat-handoff] parse error:", err);
    }
  }, [tool]);

  // Apply handoff from Content Analyzer routing
  useEffect(() => {
    console.log("[handoff] effect fired — key:", handoffKey, "tool:", tool?.id);
    if (!handoffKey || !tool) return;
    try {
      const raw = sessionStorage.getItem(handoffKey);
      console.log("[handoff] sessionStorage hit:", !!raw, "length:", raw?.length);
      if (!raw) return;
      const handoff = JSON.parse(raw) as {
        from: string;
        contentMode?: "visual" | "voiceover";
        adaptData?: { scenes?: Array<{ frame: number; script: string; imagePrompt: string; sceneType: string }>; adaptedScript?: string; styleNotes?: string };
        analyzeData?: { analysis?: { content_type?: string; key_insights?: string; style_guide?: string; visual_style?: string } };
        selectedAvatarIds?: string[];
        selectedProductIds?: string[];
        selectedClothingIds?: string[];
        selectedAvatarId?: string | null;
        selectedProductId?: string | null;
        selectedBackgroundId?: string | null;
      };
      console.log("[handoff] from:", handoff.from, "tool:", tool.id, "scenes:", handoff.adaptData?.scenes?.length);
      if (handoff.from !== "content_analyzer") return;
      // Wait until we're on the destination tool (not still on the source)
      if (tool.id === "content_analyzer") return;
      // Now safe to consume — remove from sessionStorage
      sessionStorage.removeItem(handoffKey);
      const { adaptData, analyzeData } = handoff;

      // Always restore asset selections regardless of target tool
      const assetUpdates: Partial<ToolConfig> = {};
      if (handoff.selectedAvatarIds?.length) assetUpdates.selectedAvatarIds = handoff.selectedAvatarIds;
      if (handoff.selectedProductIds?.length) assetUpdates.selectedProductIds = handoff.selectedProductIds;
      if (handoff.selectedClothingIds?.length) assetUpdates.selectedClothingIds = handoff.selectedClothingIds;
      if (handoff.selectedAvatarId) assetUpdates.selectedAvatarId = handoff.selectedAvatarId;
      if (handoff.selectedProductId) assetUpdates.selectedProductId = handoff.selectedProductId;
      if (handoff.selectedBackgroundId) assetUpdates.selectedBackgroundId = handoff.selectedBackgroundId;

      if (!adaptData) {
        if (Object.keys(assetUpdates).length) setConfig((prev) => ({ ...prev, ...assetUpdates }));
        return;
      }

      if ((tool.id === "ugc_creator" || tool.id === "fashion_reel") && adaptData.scenes?.length) {
        const isVisual = handoff.contentMode === "visual";
        const ct = (analyzeData?.analysis?.content_type || "").toLowerCase();
        const isEditorial = ct.includes("editorial") || ct.includes("cinematic") || ct.includes("fashion");
        const isProduct = ct.includes("product");
        const visualStyle = isEditorial ? "cinematic" : isProduct ? "studio" : "iphone";
        const ugcMode = isEditorial ? "narrative" : "standard";

        const stripBilingual = (text: string) =>
          text.replace(/\s*[\[(][A-Za-záéíóúÁÉÍÓÚñÑ]+:\s*['"]?[^'"\]\)]+['"]?[\]\)]/g, "").trim();

        const detectShotType = (prompt: string): string => {
          const p = prompt.toLowerCase();
          if (p.includes("extreme close") || p.includes("ecu ")) return "close-up";
          if (p.includes("close-up") || p.includes("close up") || p.includes("cu ") || p.includes("face shot")) return "close-up";
          if (p.includes("medium close") || p.includes("mcu")) return "medium-close";
          if (p.includes("full body") || p.includes("full-body") || p.includes("head to toe")) return "full-body";
          if (p.includes("wide shot") || p.includes("wide angle") || p.includes("establishing")) return "wide";
          if (p.includes("overhead") || p.includes("top down") || p.includes("bird")) return "overhead";
          if (p.includes("product only") || p.includes("product shot") || p.includes("no person")) return "product-only";
          if (p.includes("hands") || p.includes("hand shot")) return "hands";
          if (p.includes("medium shot") || p.includes("mid shot") || p.includes("waist")) return "medium";
          return "medium-close"; // safe default
        };

        const isModelReel = tool.id === "fashion_reel";
        const customScenes = adaptData.scenes.map((s, i) => ({
          id: `act_${i + 1}`,
          title: `Scene ${i + 1}`,
          // Model Reel and visual-only UGC: no script, all scenes are creative
          script: (isVisual || isModelReel) ? "" : stripBilingual(s.script),
          visual: s.imagePrompt,
          shot: detectShotType(s.imagePrompt),
          sceneType: (isVisual || isModelReel) ? "creative" : (s.imagePrompt.length > s.script.length * 2 ? "creative" : "talking"),
        }));
        const modelReelObjective = analyzeData?.analysis?.key_insights
          ? String(analyzeData.analysis.key_insights).slice(0, 200)
          : "";
        setConfig((prev) => ({
          ...prev,
          ...assetUpdates,
          objective: isModelReel ? modelReelObjective : "",
          visualStyle: isModelReel ? (isEditorial ? "editorial" : "cinematic") : visualStyle,
          ugcMode: isModelReel ? "standard" : ugcMode,
          customScript: JSON.stringify(customScenes, null, 2),
        }));
      } else if (tool.id === "carousel_creator" && adaptData.scenes?.length) {
        const outline = adaptData.scenes.map((s, i) => `Slide ${i + 1}: ${s.script || s.imagePrompt}`).join("\n");
        setConfig((prev) => ({ ...prev, ...assetUpdates, objective: adaptData.adaptedScript || outline, notes: outline }));
      } else if (tool.id === "static_ad" || tool.id === "ad_creative_lab") {
        const visualStyle = analyzeData?.analysis?.visual_style || analyzeData?.analysis?.style_guide || "";
        const sceneSummary = adaptData.scenes?.map((s) => s.imagePrompt).filter(Boolean).join("\n") || "";
        const direction = [adaptData.adaptedScript, adaptData.styleNotes, visualStyle].filter(Boolean).join("\n\n---\n");
        setConfig((prev) => ({ ...prev, ...assetUpdates, objective: direction, notes: sceneSummary }));
      } else {
        setConfig((prev) => ({ ...prev, ...assetUpdates, objective: "" }));
      }
    } catch { /* silent */ }
  }, [handoffKey, tool]);

  // Reset pipeline state when tool changes (e.g. navigating from content_analyzer RoutePanel)
  useEffect(() => {
    if (!toolId) return;
    setStarted(false);
    setActiveStep(0);
    setSteps([]);
  }, [toolId]);

  // Tool-specific config defaults
  useEffect(() => {
    if (!tool) return;
    if (tool.id === "carousel_creator" || tool.id === "static_ad") {
      setConfig((prev) => ({ ...prev, aspectRatio: "4:5" }));
    }
    if (tool.id === "fashion_reel") {
      setConfig((prev) => ({ ...prev, visualStyle: prev.visualStyle === "iphone" ? "editorial" : prev.visualStyle }));
    }
  }, [tool]);

  // Auto-select first avatar/product if available
  useEffect(() => {
    if (!activeBrand) return;
    setConfig((prev) => ({
      ...prev,
      selectedAvatarId:
        prev.selectedAvatarId || activeBrand.avatars?.[0]?.id || null,
      selectedProductId:
        prev.selectedProductId || activeBrand.products?.[0]?.id || null,
      selectedVoiceId:
        prev.selectedVoiceId || activeBrand.voicePresets?.[0]?.id || null,
    }));
  }, [activeBrand]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={20} className="animate-spin text-fg-muted" />
      </div>
    );
  }

  if (!tool) {
    return (
      <div className="space-y-4">
        <Link
          to="/dashboard/generate"
          className="flex items-center gap-1.5 text-[13px] text-fg-muted hover:text-fg transition-colors"
        >
          Back to tools
        </Link>
        <div className="text-center py-16 text-fg-muted">Tool no encontrada</div>
      </div>
    );
  }

  const handleStart = () => {
    // Validate required assets before starting
    const schema = tool ? (TOOL_SCHEMAS[tool.id] || DEFAULT_SCHEMA) : DEFAULT_SCHEMA;
    if (schema.avatarRequired && !config.selectedAvatarId) {
      setValidationError(`${schema.avatarLabel || "Avatar"} is required to run this pipeline. Select one from the panel above.`);
      return;
    }
    setValidationError(null);
    setStarted(true);
    setActiveStep(0);
    setSteps((prev) =>
      prev.map((s, i) => ({
        ...s,
        status: i === 0 ? "active" : "pending",
      }))
    );
    // Auto-run the first step (script generation)
    setTimeout(() => handleRunStep(0), 100);
  };

  const handleMockPreview = () => {
    setStarted(true);
    setMockRunning(true);
    setActiveStep(0);

    const pipeline = tool!.pipeline || [];
    const initialSteps = pipeline.map((stepId: string, i: number) => ({
      id: stepId,
      status: (i === 0 ? "running" : "pending") as StepStatus,
    }));
    setSteps(initialSteps);

    // Advance through each step with a timer
    let current = 0;
    const advance = () => {
      if (current >= pipeline.length) {
        setMockRunning(false);
        return;
      }
      const stepId = pipeline[current];
      const delay = 800 + Math.random() * 1200; // 0.8–2s per step

      setTimeout(() => {
        const idx = current;
        setSteps((prev) =>
          prev.map((s, i) => {
            if (i === idx) return { ...s, status: "done" as StepStatus, result: MOCK_STEP_RESULTS[stepId] };
            if (i === idx + 1) return { ...s, status: "running" as StepStatus };
            return s;
          })
        );
        setActiveStep(Math.min(idx + 1, pipeline.length - 1));
        current++;
        advance();
      }, delay);
    };
    advance();
  };

  const advanceStep = (stepIndex: number, result?: unknown, opts?: { needsApproval?: boolean }) => {
    if (opts?.needsApproval) {
      // Mark step as "review" — stays on this step, shows result + approve button
      setSteps((prev) =>
        prev.map((s, i) =>
          i === stepIndex ? { ...s, status: "review" as StepStatus, result } : s
        )
      );
      return;
    }
    setSteps((prev) =>
      prev.map((s, i) => {
        if (i === stepIndex) return { ...s, status: "done", result };
        // If next step is curation, go directly to "review" (manual selection)
        if (i === stepIndex + 1) return { ...s, status: s.id === "curation" ? "review" : "active" };
        return s;
      })
    );
    if (stepIndex < steps.length - 1) {
      setActiveStep(stepIndex + 1);
    }
  };

  const approveStep = (stepIndex: number) => {
    const currentStep = steps[stepIndex];

    // If it's multishot (or legacy curation), build selected images from variations
    if (currentStep.id === "multishot" || currentStep.id === "curation") {
      const multishotData = (currentStep.id === "multishot" ? currentStep.result : getStepResult("multishot")) as Array<{
        sceneId: string; title: string;
        variations: Array<{ id: string; url: string; label: string }>;
      }> | undefined;

      if (multishotData) {
        const selections = multishotData.map((scene) => {
          const selectedId = curationSelections[scene.sceneId] || scene.variations[0]?.id;
          const selectedVar = scene.variations.find((v) => v.id === selectedId) || scene.variations[0];
          return {
            sceneId: scene.sceneId,
            title: scene.title,
            selectedId: selectedVar?.id || "",
            selectedUrl: selectedVar?.url || "",
          };
        });

        // Store both: original variations (for re-run) + selections (for downstream)
        setSteps((prev) =>
          prev.map((s, i) => {
            if (i === stepIndex) return { ...s, status: "done", result: { variations: multishotData, selections } };
            if (i === stepIndex + 1) return { ...s, status: "active" };
            return s;
          })
        );
        if (stepIndex < steps.length - 1) {
          setActiveStep(stepIndex + 1);
          // Auto-run voice
          setTimeout(() => handleRunStep(stepIndex + 1), 100);
        }
        return;
      }
    }

    setSteps((prev) =>
      prev.map((s, i) => {
        if (i === stepIndex) return { ...s, status: "done" };
        if (i === stepIndex + 1) return { ...s, status: "active" };
        return s;
      })
    );
    if (stepIndex < steps.length - 1) {
      setActiveStep(stepIndex + 1);
      // Auto-run next step if configured in tool registry
      const nextStep = steps[stepIndex + 1];
      const toolDef = tool ? TOOL_DEFINITIONS[tool.id] : null;
      if (nextStep && toolDef?.autoRunSteps?.includes(nextStep.id)) {
        handleRunStep(stepIndex + 1);
      }
    }
  };

  const failStep = (stepIndex: number, error: string) => {
    setSteps((prev) =>
      prev.map((s, i) =>
        i === stepIndex ? { ...s, status: "error", error } : s
      )
    );
  };

  const reRunFromStep = (stepIndex: number) => {
    // Mark this step as active, all subsequent as stale (keep results for reference)
    setSteps((prev) =>
      prev.map((s, i) => {
        if (i === stepIndex) return { ...s, status: "active" };
        if (i > stepIndex) return { ...s, status: "stale" };
        return s;
      })
    );
    setActiveStep(stepIndex);
  };

  const setStepRunning = (stepIndex: number) => {
    setSteps((prev) =>
      prev.map((s, i) =>
        i === stepIndex ? { ...s, status: "running" } : s
      )
    );
  };

  // Helper: get the result from a previous step (uses ref for latest state in async callbacks)
  const getStepResult = (stepId: string) => {
    return stepsRef.current.find((s) => s.id === stepId)?.result;
  };

  // Helper: get script scenes from the script step result
  const getScriptScenes = (): Array<{ id: string; title: string; script: string; image_prompt: string; sceneType: "talking" | "creative"; narrativeSceneType?: string; location?: string; backgroundId?: string | null; _showProduct?: boolean; _useAvatar?: boolean }> => {
    const scriptResult = getStepResult("script") as Record<string, unknown> | undefined;
    if (!scriptResult) return [];

    let rawScenes: Array<Record<string, unknown>> = [];
    if (scriptResult.scenes) {
      const arr = scriptResult.scenes as Array<unknown>;
      // Handle both nested [[...]] (UGC) and flat [...] (Fashion Reel, other tools)
      rawScenes = Array.isArray(arr[0])
        ? (arr[0] as Array<Record<string, unknown>>)
        : (arr as Array<Record<string, unknown>>);
    } else if (Array.isArray(scriptResult)) {
      const arr = scriptResult as Array<unknown>;
      rawScenes = Array.isArray(arr[0])
        ? (arr[0] as Array<Record<string, unknown>>)
        : (arr as Array<Record<string, unknown>>);
    }

    // The DoneStep normalizes field names onto the raw objects in-place.
    // So we can read directly — just apply fallbacks for any fields still missing.
    return rawScenes.map((s, i) => {
      const id = String(s.id || s.scene_number || `act_${i + 1}`);
      const title = String(s.title || s.act || `Scene ${i + 1}`);

      let scriptText = String(s.script || s.speech || s.copy || s.text || s.audio || s.dialogue
        || s.narration || s.voiceover || s.action || s.spoken || s.line || s.lines || "");
      scriptText = scriptText.replace(/^(AVATAR|OFF[- ]?CAMERA|ON[- ]?CAMERA|NARRATOR|SPEAKER)\s*(\([^)]*\)\s*)?:\s*/i, "").trim();

      const imagePrompt = String(s.image_prompt || s.visuals || s.visual || s.visual_prompt
        || s.scene_description || s.setting || s.background || s.scene || "");
      const finalImagePrompt = imagePrompt && isNaN(Number(imagePrompt)) ? imagePrompt : "";

      const sceneType = (s.sceneType as "talking" | "creative") || "talking";
      const narrativeSceneType = s.narrativeSceneType ? String(s.narrativeSceneType) : undefined;
      const location = s.location ? String(s.location) : undefined;
      // Per-scene background override: string = specific asset id, null = force none, undefined = inherit global
      const bgRaw = (s as { backgroundId?: string | null }).backgroundId;
      const backgroundId = bgRaw === null ? null : (typeof bgRaw === "string" && bgRaw.length > 0 ? bgRaw : undefined);
      const showProduct = typeof s._showProduct === "boolean" ? s._showProduct : undefined;
      // avatar: false (from Gemini or custom script) → skip avatar refs, use text-to-image
      const avatarVal = s.avatar ?? s._useAvatar;
      const useAvatar = (avatarVal === false || avatarVal === "false") ? false : undefined;

      return { id, title, script: scriptText, image_prompt: finalImagePrompt, sceneType, narrativeSceneType, location, backgroundId, _showProduct: showProduct, _useAvatar: useAvatar };
    });
  };

  const handleRunStep = async (stepIndex: number) => {
    const step = steps[stepIndex];
    if (!activeBrand || !tool) return;

    // ── Registry-based handler lookup ──
    const toolDef = TOOL_DEFINITIONS[tool.id];
    const handler = toolDef?.stepHandlers[step.id];

    if (handler) {
      setStepRunning(stepIndex);
      try {
        const ctx = {
          activeBrand,
          config,
          tool,
          getStepResult,
          getScriptScenes,
          audioCache,
          setAudioCache: (sceneId: string, entry: { url: string; blob: Blob }) => {
            setAudioCache((p: Record<string, { url: string; blob: Blob }>) => ({ ...p, [sceneId]: entry }));
          },
          getAllSteps: () => stepsRef.current.map((s) => ({ id: s.id, status: s.status, result: s.result })),
          curationSelections,
        };
        const { result, needsApproval, autoRunNext } = await handler(ctx);

        if (step.id === "curation") {
          // Curation is manual — don't advance
          return;
        }

        advanceStep(stepIndex, result, { needsApproval });

        // Auto-run next step if configured — run immediately
        const nextStepId = steps[stepIndex + 1]?.id;
        if (!needsApproval && (autoRunNext || toolDef?.autoRunSteps?.includes(nextStepId))) {
          handleRunStep(stepIndex + 1);
        }
      } catch (err) {
        failStep(stepIndex, err instanceof Error ? err.message : "Step failed");
      }
      return;
    }

    // ── Fallback: no handler found, just advance ──
    advanceStep(stepIndex);

    // ── LEGACY: inline handlers below (will be removed after full migration) ──
    const selectedProduct = (activeBrand.products || []).find(
      (p) => p.id === config.selectedProductId
    );
    const selectedAvatar = activeBrand.avatars?.find(
      (a) => a.id === config.selectedAvatarId
    );
    const selectedBackground = (activeBrand.backgrounds || []).find(
      (bg) => bg.id === config.selectedBackgroundId
    );

    // ── Script step — call Gemini ──
    if (step.id === "script") {
      setStepRunning(stepIndex);
      try {
        // Custom script bypass — skip Gemini, parse user's script directly
        if (config.customScript?.trim()) {
          const lines = config.customScript.trim().split("\n").filter((l) => l.trim());
          const customScenes = lines.map((line, i) => ({
            id: `act_${i + 1}`,
            title: `Scene ${i + 1}`,
            script: line.trim(),
            image_prompt: `${selectedAvatar?.name || "Person"} looking directly at camera, ${line.trim().slice(0, 50)}. ${selectedProduct ? `Holding or showing ${selectedProduct.name}.` : ""} Shot on 50mm f/1.8, medium shot, natural lighting, vertical 9:16.`,
          }));
          advanceStep(stepIndex, { scenes: [customScenes] }, { needsApproval: true });
          return;
        }

        let notes = config.objective;
        if (selectedAvatar) {
          notes += `\nAVATAR: ${selectedAvatar.name}`;
          if (selectedAvatar.description) notes += ` — ${selectedAvatar.description}`;
        }
        if (selectedBackground) {
          notes += `\nBACKGROUND/SETTING: ${selectedBackground.name}`;
          if (selectedBackground.description) notes += ` — ${selectedBackground.description}`;
        }
        // Include selected clothing
        const selectedClothing = (activeBrand.clothing || []).filter(
          (c) => config.selectedClothingIds.includes(c.id)
        );
        if (selectedClothing.length > 0) {
          notes += `\nCLOTHING TO WEAR:`;
          selectedClothing.forEach((c) => {
            notes += `\n- ${c.name}`;
            if (c.description) notes += `: ${c.description}`;
          });
          notes += `\nThe avatar MUST be wearing these specific clothing items in every scene.`;
        }
        if (config.notes) notes += `\n${config.notes}`;

        // Build explicit instructions about what the avatar wears and promotes
        if (selectedProduct) {
          notes += `\n\nPRODUCT TO PROMOTE: ${selectedProduct.name}`;
          if (selectedProduct.description) notes += ` — ${selectedProduct.description}`;
          if (config.productIsWorn) {
            notes += `\nIMPORTANT: The avatar IS WEARING the product. The product is a garment that goes ON the body. Do NOT show it in hands — the avatar wears it and talks about it while wearing it.`;
          } else {
            notes += `\nThe avatar shows/holds this product in their hands. It must be visible, unfolded, and extended in every scene.`;
          }
        }

        const result = await generateCopy(activeBrand.id, {
          productName: selectedProduct?.name || "",
          tone: config.tone as "engaging" | "professional" | "casual" | "funny",
          platform: config.platform as "tiktok" | "instagram" | "youtube",
          language: config.language as "es" | "en",
          additionalNotes: notes,
        });
        // Store scripts + brief together so the UI can show both
        advanceStep(stepIndex, { scenes: result.scripts, brief: result.brief }, { needsApproval: true });
      } catch (err) {
        failStep(stepIndex, err instanceof Error ? err.message : "Script generation failed");
      }
      return;
    }

    // ── Base Image — Nano Banana 2 ──
    if (step.id === "base_image") {
      setStepRunning(stepIndex);
      try {
        const scenes = getScriptScenes();
        const firstScene = scenes[0];
        if (!firstScene) throw new Error("No script scenes found. Run the Script step first.");
        if (!firstScene.image_prompt) throw new Error(`No image prompt found in scene 1. Scene keys: ${JSON.stringify(firstScene)}`);

        // Collect reference images based on mode
        const imageUrls: string[] = [];
        const selectedClothingItems = (activeBrand.clothing || []).filter(
          (c) => config.selectedClothingIds.includes(c.id)
        );

        if (config.productIsWorn) {
          // Product IS what they wear: image 1=person, image 2=product (worn), image 3=extra clothing
          if (selectedAvatar?.imageUrl) imageUrls.push(selectedAvatar.imageUrl);
          if (selectedProduct?.imageUrl) imageUrls.push(selectedProduct.imageUrl);
          selectedClothingItems.forEach((c) => { if (c.imageUrl) imageUrls.push(c.imageUrl); });
        } else {
          // Normal: image 1=person, image 2=clothing (worn), image 3=product (held)
          if (selectedAvatar?.imageUrl) imageUrls.push(selectedAvatar.imageUrl);
          selectedClothingItems.forEach((c) => { if (c.imageUrl) imageUrls.push(c.imageUrl); });
          if (selectedProduct?.imageUrl) imageUrls.push(selectedProduct.imageUrl);
        }
        if (selectedBackground?.imageUrl) imageUrls.push(selectedBackground.imageUrl);

        const job = await createImageEdit(imageUrls, firstScene.image_prompt, config.aspectRatio, config.resolution);
        const result = await pollImageGen(job.request_id);

        if (result.status === "failed") throw new Error(result.error || "Image generation failed");

        // Store the inputs used so we can display them in review
        const inputsSummary = {
          avatar: selectedAvatar ? { name: selectedAvatar.name, imageUrl: selectedAvatar.imageUrl } : null,
          product: selectedProduct ? { name: selectedProduct.name, imageUrl: selectedProduct.imageUrl } : null,
          clothing: selectedClothingItems.map((c) => ({ name: c.name, imageUrl: c.imageUrl })),
          background: selectedBackground ? { name: selectedBackground.name, imageUrl: selectedBackground.imageUrl } : null,
        };

        advanceStep(stepIndex, {
          url: result.image_url,
          prompt: firstScene.image_prompt,
          scriptText: firstScene.script,
          inputs: inputsSummary,
        }, { needsApproval: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err);
        failStep(stepIndex, msg || "Image generation failed");
      }
      return;
    }

    // ── Multishot — Scene 1 = base image, Scenes 2+ = 2 variations each ──
    if (step.id === "multishot") {
      setStepRunning(stepIndex);
      try {
        const scenes = getScriptScenes();
        if (scenes.length === 0) throw new Error("No script scenes found.");

        const baseImageResult = getStepResult("base_image") as { url: string; entryFrameUrl?: string } | undefined;
        if (!baseImageResult?.url) throw new Error("Base image not found.");

        const referenceUrls: string[] = [baseImageResult.url];
        const NUM_VARIATIONS = 2;

        const multishotResults: Array<{
          sceneId: string; title: string;
          variations: Array<{ id: string; url: string; label: string; prompt: string }>;
          entryFrameUrl?: string;
        }> = [];

        // Scene 1: use base image directly — carry over entry frame if set
        multishotResults.push({
          sceneId: scenes[0].id,
          title: scenes[0].title,
          variations: [{ id: `${scenes[0].id}_v1`, url: baseImageResult.url, label: "Base image", prompt: "" }],
          ...(baseImageResult.entryFrameUrl ? { entryFrameUrl: baseImageResult.entryFrameUrl } : {}),
        });

        // Subtle angle tweaks — don't override the scene's shot type
        const ANGLE_TWEAKS = [
          { label: "Straight on", desc: "Camera straight on, centered framing." },
          { label: "Slightly left", desc: "Camera shifted slightly to the left, off-center composition." },
          { label: "Slightly right", desc: "Camera shifted slightly to the right, rule of thirds." },
          { label: "Slightly low", desc: "Camera positioned slightly lower than eye level." },
        ];

        // Full camera moments — only used when scene has no image_prompt
        const FALLBACK_MOMENTS = [
          { label: "Tight close-up", desc: "Same EXACT person, same clothes, same product, same background/environment as image 1. Do NOT change the setting or location. Tight close-up from a different angle, face fills frame. Shot on 50mm f/1.4, very shallow depth of field, natural skin texture. Eyes locked on camera." },
          { label: "Medium wide", desc: "Same EXACT person, same clothes, same product, same background/environment as image 1. Do NOT change the setting or location. Camera pulled back to medium-wide, showing full torso and surroundings. Shot on 35mm f/1.8, relaxed posture. Off-center framing, eye contact." },
          { label: "Low angle", desc: "Same EXACT person, same clothes, same product, same background/environment as image 1. Do NOT change the setting or location. Camera positioned lower, looking slightly up. Shot on 24mm f/2.0, product held up to camera, confident expression." },
          { label: "Product focus", desc: "Same person as image 1, slightly blurred in background. Product in sharp focus in foreground, held toward camera. Shot on 85mm f/1.8, extreme shallow depth of field." },
          { label: "Side angle", desc: "Same EXACT person, same clothes, same product, same background/environment as image 1. Do NOT change the setting or location. Camera moved to the side, body angled but eyes on camera. Shot on 35mm f/2.0, rule of thirds composition." },
          { label: "Over shoulder", desc: "Same EXACT person, same clothes, same product, same background/environment as image 1. Do NOT change the setting or location. Camera behind and over one shoulder, subject looking back at camera. Shot on 28mm f/2.8, handheld feel." },
        ];

        const remainingScenes = scenes.slice(1);
        const remainingResults = await Promise.all(
          remainingScenes.map(async (scene, sceneIdx) => {
            const sceneDirection = scene.image_prompt || "";
            const variations = await Promise.all(
              Array.from({ length: NUM_VARIATIONS }, async (_, vi) => {
                let prompt: string;
                let label: string;
                if (sceneDirection) {
                  const tweak = ANGLE_TWEAKS[(sceneIdx * NUM_VARIATIONS + vi) % ANGLE_TWEAKS.length];
                  label = vi === 0 ? "Scene direction" : tweak.label;
                  prompt = vi === 0
                    ? `${sceneDirection}. Same EXACT person, same clothes, same product, same background/environment as image 1. Do NOT change the setting or location. Natural lighting, ${config.aspectRatio} aspect ratio, ultra-realistic.`
                    : `${sceneDirection}. ${tweak.desc} Same EXACT person, same clothes, same product, same background/environment as image 1. Do NOT change the setting or location. Natural lighting, ${config.aspectRatio} aspect ratio, ultra-realistic.`;
                } else {
                  const moment = FALLBACK_MOMENTS[(sceneIdx * NUM_VARIATIONS + vi) % FALLBACK_MOMENTS.length];
                  label = moment.label;
                  prompt = `${moment.desc}. Natural lighting, 9:16 vertical, ultra-realistic.`;
                }
                const job = await createImageEdit(referenceUrls, prompt, config.aspectRatio, config.resolution);
                const result = await pollImageGen(job.request_id);
                return {
                  id: `${scene.id}_v${vi + 1}`,
                  url: result.image_url || "",
                  label,
                  prompt,
                };
              })
            );
            return { sceneId: scene.id, title: scene.title, variations };
          })
        );
        multishotResults.push(...remainingResults);

        advanceStep(stepIndex, multishotResults);
      } catch (err) {
        failStep(stepIndex, err instanceof Error ? err.message : "Multishot generation failed");
      }
      return;
    }

    // ── Curation — manual selection (handled via UI, not auto-run) ──
    if (step.id === "curation") {
      // Curation is manual — we just mark it active so the UI renders the selection grid.
      // The user selects variations and clicks "Approve" to advance.
      // The result is set by the CurationPanel component via setCurationSelections.
      return;
    }

    // ── Voice + Lip-sync combined — generate all audio, then animate each scene ──
    if (step.id === "voice") {
      setStepRunning(stepIndex);
      try {
        const scenes = getScriptScenes();
        const voiceId = config.selectedVoiceId || activeBrand.voicePresets?.[0]?.id;

        // Generate TTS + upload to Fal for ALL scenes
        const voiceResults: Array<{ sceneId: string; title: string; script: string; audioUrl: string; falUrl: string; duration: string }> = [];
        for (const scene of scenes) {
          if (!scene.script) continue;
          console.log(`[voice] Generating TTS for ${scene.id} with voice ${voiceId}`);
          const { fal_url } = await generateTTSAndUpload({ text: scene.script, voice_id: voiceId });
          const ttsResult = await generateTTS({ text: scene.script, voice_id: voiceId });
          voiceResults.push({
            sceneId: scene.id,
            title: scene.title || `Scene`,
            script: scene.script,
            audioUrl: ttsResult.audioUrl,
            falUrl: fal_url,
            duration: "generated",
          });
        }

        advanceStep(stepIndex, voiceResults, { needsApproval: true });
      } catch (err) {
        failStep(stepIndex, err instanceof Error ? err.message : "Voice generation failed");
      }
      return;
    }

    // ── Lip-sync — HeyGen Avatar 4 via Fal ──
    if (step.id === "lipsync") {
      setStepRunning(stepIndex);
      try {
        const msResult = getStepResult("multishot") as { selections?: Array<{ sceneId: string; title: string; selectedUrl: string }> } | undefined;
        const curationData = msResult?.selections || (getStepResult("curation") as Array<{ sceneId: string; title: string; selectedUrl: string }> | undefined);

        if (!curationData) throw new Error("No curated images found. Approve the Multishot step first.");

        const scenes = getScriptScenes();
        const voiceId = config.selectedVoiceId || activeBrand.voicePresets?.[0]?.id;

        const heygenAR = config.aspectRatio === "4:5" ? "9:16" : config.aspectRatio;
        const heygenRes = config.resolution === "4K" || config.resolution === "2K" ? "1080p" : "720p";

        // Use voice step results — these have the final edited text + uploaded audio
        const voiceData = getStepResult("voice") as Array<{
          sceneId: string; script: string; audioUrl: string; falUrl: string;
        }> | undefined;

        const lipsyncResults = [];
        for (let i = 0; i < curationData.length; i++) {
          const scene = curationData[i];
          // Match by index as fallback if IDs don't match
          const scriptScene = scenes.find((s) => s.id === scene.sceneId) || scenes[i];
          const voiceEntry = Array.isArray(voiceData)
            ? voiceData.find((v) => v.sceneId === scene.sceneId) || voiceData[i]
            : undefined;
          // Prefer voice step text (user may have edited it) over original script
          const scriptText = voiceEntry?.script || scriptScene?.script || "";

          if (!scriptText) {
            console.warn(`[lipsync] No script text for scene ${scene.sceneId}, skipping`);
            continue;
          }

          console.log(`[lipsync] Scene ${i + 1}: "${scriptText.slice(0, 50)}..." → ${scene.sceneId}`);

          // Require audio from voice step — don't generate silently
          if (!voiceEntry?.falUrl) {
            throw new Error(`No audio found for "${scene.title}". Complete the Voice step first and make sure all scenes have audio.`);
          }
          const falAudioUrl = voiceEntry.falUrl;

          // Call HeyGen Avatar 4
          const job = await createHeyGenAvatar4({
            image_url: scene.selectedUrl,
            audio_url: falAudioUrl,
            talking_style: "expressive",
            aspect_ratio: heygenAR,
            resolution: heygenRes,
          });
          const result = await pollHeyGenAvatar4(job.request_id);

          if (result.status === "failed") throw new Error(result.error || `Lip-sync failed for ${scene.title}`);

          lipsyncResults.push({
            sceneId: scene.sceneId,
            title: scene.title,
            scriptText,
            videoUrl: result.video_url || scene.selectedUrl,
            imageUrl: scene.selectedUrl,
          });
        }

        // Show results for review — don't auto-advance to render
        advanceStep(stepIndex, lipsyncResults, { needsApproval: true });
      } catch (err) {
        failStep(stepIndex, err instanceof Error ? err.message : "Lip-sync failed");
      }
      return;
    }

    // ── Render — FFmpeg concat (no subtitles, Remotion handles them) ──
    if (step.id === "render") {
      setStepRunning(stepIndex);
      try {
        const lipsyncData = getStepResult("lipsync") as Array<{
          sceneId: string; title: string; scriptText?: string; videoUrl: string;
        }> | undefined;

        if (!lipsyncData || lipsyncData.length === 0) throw new Error("No lip-sync videos found.");

        const videoUrls = lipsyncData.map((s) => s.videoUrl).filter(Boolean);
        if (videoUrls.length === 0) throw new Error("No valid video URLs to concatenate.");

        // Concat with subtitles — backend tries Remotion first, falls back to FFmpeg
        const scriptScenes = getScriptScenes();
        const subtitleScripts = lipsyncData.map((seg) => {
          const scene = scriptScenes.find((s) => s.id === seg.sceneId);
          return { text: seg.scriptText || scene?.script || "" };
        });
        const result = await concatVideos(videoUrls, subtitleScripts, config.subtitleEngine !== "none", config.subtitleEngine);

        // Build Remotion scenes for subtitle preview player
        const fps = 30;
        const avgDurationPerScene = (result.duration / lipsyncData.length) * fps;
        const remotionScenes = lipsyncData.map((seg) => {
          const scene = scriptScenes.find((s) => s.id === seg.sceneId);
          return {
            videoUrl: seg.videoUrl,
            scriptText: seg.scriptText || scene?.script || "",
            durationInFrames: Math.round(avgDurationPerScene),
          };
        });

        const renderResult = {
          videoUrl: result.video_url,
          totalDuration: `${result.duration}s`,
          scenes: result.num_segments,
          format: "MP4 / H.264",
          resolution: "1080x1920 (9:16)",
          sizeBytes: result.size_bytes,
          subtitleEngine: config.subtitleEngine,
          remotionScenes,
        };
        advanceStep(stepIndex, renderResult);

        // Save generation to content library
        const selectedProduct = (activeBrand.products || []).find(p => p.id === config.selectedProductId);
        const baseImg = getStepResult("base_image") as { url: string } | undefined;
        try {
          await saveGeneration({
            brandId: activeBrand.id,
            toolId: tool?.id || "ugc_creator",
            title: `UGC — ${selectedProduct?.name || "Video"} — ${new Date().toLocaleDateString()}`,
            type: "video",
            status: "completed",
            thumbnailUrl: baseImg?.url || undefined,
            outputUrl: result.video_url,
            scenes: scriptScenes.map((s) => ({
              id: s.id,
              title: s.title,
              script: s.script,
            })),
            metadata: {
              tone: config.tone,
              platform: config.platform,
              language: config.language,
              numScenes: scriptScenes.length,
              duration: result.duration,
            },
          });
        } catch {
          console.error("Failed to save generation to content library");
        }
      } catch (err) {
        failStep(stepIndex, err instanceof Error ? err.message : "Render failed");
      }
      return;
    }

    // ── Prompt step — call Gemini via PromptBuilder for any tool ──
    if (step.id === "prompt") {
      setStepRunning(stepIndex);
      try {
        const extraVars: Record<string, string> = {};
        if (config.objective) extraVars.video_objective = config.objective;
        if (config.notes) extraVars.user_notes = config.notes;
        if (config.tone) extraVars.tone = config.tone;
        if (config.platform) extraVars.platform = config.platform;
        if (config.language) extraVars.language = config.language;

        // Tool-specific extra variables
        if (config.objective) {
          // Map objective to tool-specific variable name
          const objectiveKey: Record<string, string> = {
            fashion_editorial: "pose_direction",
            product_spotlight: "setting_description",
          };
          const key = objectiveKey[tool!.id];
          if (key) extraVars[key] = config.objective;
        }

        // Selected accessory (fashion editorial)
        if (selectedProduct) {
          let accessoryStr = selectedProduct.name;
          if (selectedProduct.description) accessoryStr += `: ${selectedProduct.description}`;
          extraVars.selected_accessory = accessoryStr;
        }

        // Selected avatar detail
        if (selectedAvatar) {
          let avatarStr = selectedAvatar.name;
          if (selectedAvatar.description) avatarStr += `: ${selectedAvatar.description}`;
          extraVars.selected_avatar = avatarStr;
        }

        // Location and style references (fashion editorial, fashion reels)
        if (config.locationRef) extraVars.location_reference = config.locationRef;
        if (config.styleRef) extraVars.style_reference = config.styleRef;

        // Selected clothing
        const selectedClothingItems = (activeBrand.clothing || []).filter(
          (c) => config.selectedClothingIds.includes(c.id)
        );
        if (selectedClothingItems.length > 0) {
          extraVars.selected_clothing = selectedClothingItems
            .map((c) => `${c.name}${c.description ? `: ${c.description}` : ""}`)
            .join("\n- ");
          extraVars.selected_clothing = `- ${extraVars.selected_clothing}`;
        }

        // Selected background
        if (selectedBackground) {
          let bgStr = selectedBackground.name;
          if (selectedBackground.description) bgStr += `: ${selectedBackground.description}`;
          extraVars.selected_background = bgStr;
        }

        let userMsg = "Generate now.";
        if (selectedProduct) userMsg = `Product: ${selectedProduct.name}`;
        if (config.objective) userMsg += `\n${config.objective}`;
        if (config.notes) userMsg += `\n${config.notes}`;

        const { result } = await generateToolPrompt(
          activeBrand.id,
          tool!.id,
          userMsg,
          extraVars,
        );
        advanceStep(stepIndex, result, { needsApproval: true });
      } catch (err) {
        failStep(stepIndex, err instanceof Error ? err.message : "Prompt generation failed");
      }
      return;
    }

    // ── Generate step — create image from prompt result ──
    if (step.id === "generate") {
      setStepRunning(stepIndex);
      try {
        const promptResult = getStepResult("prompt") as { image_prompt: string; title?: string } | undefined;
        if (!promptResult?.image_prompt) throw new Error("No image prompt found. Run the Prompt step first.");

        // All reference images: avatar → clothing → product → background
        const imageUrls: string[] = [];
        if (selectedAvatar?.imageUrl) imageUrls.push(selectedAvatar.imageUrl);
        const selClothing = (activeBrand.clothing || []).filter(
          (c) => config.selectedClothingIds.includes(c.id)
        );
        selClothing.forEach((c) => { if (c.imageUrl) imageUrls.push(c.imageUrl); });
        if (selectedProduct?.imageUrl) imageUrls.push(selectedProduct.imageUrl);
        if (selectedBackground?.imageUrl) imageUrls.push(selectedBackground.imageUrl);

        const job = await createImageEdit(imageUrls, promptResult.image_prompt, config.aspectRatio, config.resolution);
        const result = await pollImageGen(job.request_id);
        if (result.status === "failed") throw new Error(result.error || "Image generation failed");

        advanceStep(stepIndex, {
          url: result.image_url,
          prompt: promptResult.image_prompt,
          title: promptResult.title || "Generated",
        }, { needsApproval: true });
      } catch (err) {
        failStep(stepIndex, err instanceof Error ? err.message : "Image generation failed");
      }
      return;
    }

    // ── Variations step — generate N variations of the approved image ──
    if (step.id === "variations") {
      setStepRunning(stepIndex);
      try {
        const genResult = getStepResult("generate") as { url: string; prompt: string } | undefined;
        if (!genResult) throw new Error("No base image found. Run the Generate step first.");

        const referenceUrls = [genResult.url];
        if (selectedAvatar?.imageUrl) referenceUrls.push(selectedAvatar.imageUrl);
        if (selectedProduct?.imageUrl) referenceUrls.push(selectedProduct.imageUrl);

        const variations = await Promise.all(
          Array.from({ length: config.numVariations }, async (_, vi) => {
            const prompt = `Maintain the same subject, style, and quality. Vary the angle, composition, or subtle details. ${genResult.prompt}`;
            const job = await createImageEdit(referenceUrls, prompt, config.aspectRatio, config.resolution);
            const result = await pollImageGen(job.request_id);
            return {
              id: `var_${vi + 1}`,
              url: result.image_url || "",
              label: `Variation ${vi + 1}`,
            };
          })
        );

        // Include original as first
        const allVariations = [
          { id: "original", url: genResult.url, label: "Original" },
          ...variations,
        ];

        advanceStep(stepIndex, allVariations);

        // Save to content library
        try {
          await saveGeneration({
            brandId: activeBrand.id,
            toolId: tool!.id,
            title: `${tool!.name} — ${selectedProduct?.name || "Photo"} — ${new Date().toLocaleDateString()}`,
            type: "image",
            thumbnailUrl: genResult.url,
            scenes: allVariations.map((v) => ({ id: v.id, title: v.label, imageUrl: v.url })),
            metadata: { numVariations: allVariations.length },
          });
        } catch { /* silent */ }
      } catch (err) {
        failStep(stepIndex, err instanceof Error ? err.message : "Variations failed");
      }
      return;
    }

    // ── Animate step — Kling animation for fashion reels ──
    if (step.id === "animate") {
      setStepRunning(stepIndex);
      try {
        const msResult2 = getStepResult("multishot") as { selections?: Array<{ sceneId: string; title: string; selectedUrl: string }> } | undefined;
        const curationData = msResult2?.selections || (getStepResult("curation") as Array<{ sceneId: string; title: string; selectedUrl: string }> | undefined);
        if (!curationData) throw new Error("No curated images found.");

        const animatedResults = [];
        for (const scene of curationData) {
          const klingJob = await createKlingVideo(scene.selectedUrl, "Fashion model subtle movement, gentle sway, confident pose transition", "5");
          const klingResult = await pollKlingVideo(klingJob.request_id);

          animatedResults.push({
            sceneId: scene.sceneId,
            title: scene.title,
            videoUrl: klingResult.video_url || scene.selectedUrl,
            imageUrl: scene.selectedUrl,
          });
        }

        advanceStep(stepIndex, animatedResults);

        // Save to content
        try {
          await saveGeneration({
            brandId: activeBrand.id,
            toolId: tool!.id,
            title: `Fashion Reel — ${activeBrand.name} — ${new Date().toLocaleDateString()}`,
            type: "video",
            thumbnailUrl: curationData[0]?.selectedUrl,
            scenes: animatedResults.map((r) => ({ id: r.sceneId, title: r.title })),
            metadata: { numLooks: animatedResults.length },
          });
        } catch { /* silent */ }
      } catch (err) {
        failStep(stepIndex, err instanceof Error ? err.message : "Animation failed");
      }
      return;
    }

    // ── Other steps — advance without backend (subtitles is TODO) ──
    advanceStep(stepIndex);
  };

  const handleReset = () => {
    setStarted(false);
    setActiveStep(0);
    setSteps((prev) => prev.map((s) => ({ ...s, status: "pending" })));
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px]">
        <Link
          to="/dashboard/generate"
          className="text-fg-muted hover:text-fg transition-colors"
        >
          Generate
        </Link>
        <ChevronRight size={12} className="text-fg-faint" />
        <span className="text-fg font-medium">{tool.name}</span>
      </div>

      {/* Tool header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-[var(--radius-md)] bg-surface-2 flex items-center justify-center text-fg-muted shrink-0">
          {TOOL_ICONS[tool.icon] || <Sparkles size={22} />}
        </div>
        <div className="flex-1">
          <h1 className="text-[22px] font-semibold text-fg tracking-tight">
            {tool.name}
          </h1>
          <p className="text-[14px] text-fg-muted mt-0.5">
            {tool.description}
          </p>
          {activeBrand && (
            <p className="text-[12px] text-fg-faint mt-1">
              Brand: <span className="text-fg-muted">{activeBrand.name}</span>
              {" · "}
              {tool.pipeline.length} steps in pipeline
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/dashboard/brand"
            className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-fg-muted hover:text-fg bg-surface-1 hover:bg-surface-2 rounded-[var(--radius-sm)] transition-colors"
          >
            <Settings2 size={13} />
            Manage Prompt
          </Link>
          {started && (
            <button
              onClick={handleReset}
              disabled={mockRunning}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-fg-muted hover:text-fg bg-surface-1 hover:bg-surface-2 rounded-[var(--radius-sm)] transition-colors",
                mockRunning ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
              )}
            >
              <RotateCcw size={13} />
              Reset
            </button>
          )}
          {!started && (
            <div className="flex flex-col items-end gap-2">
              {validationError && (
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-error)] bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 rounded-[var(--radius-sm)] px-3 py-1.5 max-w-xs text-right">
                  <AlertCircle size={11} className="shrink-0" />
                  {validationError}
                </div>
              )}
              <button
                onClick={handleStart}
                disabled={!activeBrand}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium rounded-[var(--radius-sm)] transition-all cursor-pointer",
                  activeBrand
                    ? "text-[var(--color-warm-fg)] bg-[var(--color-warm)] hover:opacity-90"
                    : "text-fg-faint bg-surface-2 cursor-not-allowed"
                )}
              >
                <Play size={14} />
                Start Pipeline
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main layout */}
      <div className="flex gap-6 min-h-[500px]">
        {/* Steps sidebar */}
        <div className="w-56 shrink-0 space-y-1">
          <h3 className="text-[11px] font-semibold text-fg-faint tracking-wider uppercase px-1 mb-3">
            Pipeline
          </h3>
          {steps.map((step, i) => {
            const meta = STEP_META[step.id] || {
              label: step.id,
              icon: <Sparkles size={15} />,
              description: "",
            };
            return (
              <button
                key={step.id}
                onClick={() => started && setActiveStep(i)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] text-left transition-colors",
                  started ? "cursor-pointer" : "cursor-default",
                  activeStep === i && started
                    ? "bg-surface-2 text-fg"
                    : "text-fg-muted hover:bg-surface-1 hover:text-fg"
                )}
              >
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold transition-colors",
                    step.status === "done"
                      ? "bg-[var(--color-success)] text-white"
                      : step.status === "stale"
                        ? "bg-surface-3 text-fg-faint"
                        : step.status === "review"
                          ? "bg-[var(--color-warning)] text-white"
                          : step.status === "active" || step.status === "running"
                            ? "bg-[var(--color-warm)] text-[var(--color-warm-fg)]"
                            : step.status === "error"
                              ? "bg-[var(--color-error)] text-white"
                              : "bg-surface-2 text-fg-faint border border-edge"
                  )}
                >
                  {step.status === "done" ? (
                    <Check size={12} />
                  ) : step.status === "stale" ? (
                    <AlertCircle size={12} />
                  ) : step.status === "review" ? (
                    <Eye size={12} />
                  ) : step.status === "running" ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    i + 1
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate">
                    {meta.label}
                  </div>
                </div>
              </button>
            );
          })}

          {/* Pipeline legend */}
          <div className="mt-6 pt-4 border-t border-edge space-y-2 px-1">
            <div className="flex items-center gap-2 text-[10px] text-fg-faint">
              <div className="w-3 h-3 rounded-full bg-surface-2 border border-edge" />
              Pending
            </div>
            <div className="flex items-center gap-2 text-[10px] text-fg-faint">
              <div className="w-3 h-3 rounded-full bg-[var(--color-warm)]" />
              Active
            </div>
            <div className="flex items-center gap-2 text-[10px] text-fg-faint">
              <div className="w-3 h-3 rounded-full bg-[var(--color-success)]" />
              Done
            </div>
            <div className="flex items-center gap-2 text-[10px] text-fg-faint">
              <div className="w-3 h-3 rounded-full bg-surface-3" />
              Needs re-run
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 min-w-0">
          {!started ? (
            <ConfigPanel
              tool={tool}
              config={config}
              setConfig={setConfig}
              onStart={handleStart}
              onMockPreview={handleMockPreview}
            />
          ) : (
            <StepPanel
              tool={tool}
              step={steps[activeStep]}
              stepIndex={activeStep}
              totalSteps={steps.length}
              config={config}
              allSteps={steps}
              curationSelections={curationSelections}
              onCurationSelect={(sceneId, varId) => setCurationSelections((p) => ({ ...p, [sceneId]: varId }))}
              audioCache={audioCache}
              onAudioCached={(sceneId, url, blob) => setAudioCache((p) => ({ ...p, [sceneId]: { url, blob } }))}
              onComplete={() => handleRunStep(activeStep)}
              onApprove={() => approveStep(activeStep)}
              onRegenerate={() => handleRunStep(activeStep)}
              onReRunFromHere={() => reRunFromStep(activeStep)}
              onUpdateStepResult={(sid, res) => setSteps((prev) => prev.map((s) => s.id === sid ? { ...s, result: res } : s))}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tool config schemas — defines what fields to show per tool ──

interface ToolSchema {
  showAvatar: boolean;
  avatarLabel?: string;
  avatarSublabel?: string;
  avatarRequired?: boolean;
  showProduct: boolean;
  productLabel?: string;
  productSublabel?: string;
  showClothing: boolean;
  clothingLabel?: string;
  clothingSublabel?: string;
  showBackground: boolean;
  backgroundSublabel?: string;
  showVoice: boolean;
  showTone: boolean;
  showPlatform: boolean;
  showLanguage: boolean;
  showVariations: boolean;
  objectiveLabel: string;
  objectivePlaceholder: string;
  showNotes: boolean;
  showLocationRef?: boolean;
  showStyleRef?: boolean;
  /** Describes what inputs are available and how they affect the output */
  inputsHint?: string;
}

const TOOL_SCHEMAS: Record<string, ToolSchema> = {
  avatar_creator: {
    showAvatar: false,
    showProduct: false,
    showClothing: false,
    showBackground: false,
    showVoice: false,
    showTone: false,
    showPlatform: false,
    showLanguage: false,
    showVariations: false,
    showNotes: false,
    objectiveLabel: "Avatar Direction",
    objectivePlaceholder: "Optional: describe what you're looking for. E.g., 'confident young woman for Gen Z streetwear' or leave blank to let the brand context decide...",
    inputsHint: "No assets needed — the avatar is generated from your brand context. Just select a style and optionally add direction.",
  },
  ugc_creator: {
    showAvatar: true, avatarLabel: "Avatar", avatarRequired: true,
    showProduct: true, productLabel: "Product",
    showClothing: true, clothingLabel: "Clothing", clothingSublabel: "multi-select",
    showBackground: true, showMoodboard: true,
    showVoice: true, showTone: false, showPlatform: false, showLanguage: true, showVariations: false,
    objectiveLabel: "Brief del Guión",
    objectivePlaceholder: "Describí el objetivo o pegá una estructura de actos. Ej: 'Estructura de 5 actos: gancho sensorial → producto hero → stress test → momento de la verdad → CTA. Producto: Beedeez. Tono: TikTok auténtico, español latino, mujer 25-40.' Gemini va a seguir esta estructura.",
    showNotes: false,
  },
  product_spotlight: {
    showAvatar: false, showProduct: true, productLabel: "Product",
    showClothing: false, showBackground: true, showMoodboard: true,
    showVoice: false, showTone: false, showPlatform: false, showLanguage: false, showVariations: true,
    objectiveLabel: "Setting Description",
    objectivePlaceholder: "Describe the desired setting. E.g., 'rustic cafe table with morning window light, warm earthy tones, shallow depth of field'...",
    showNotes: false,
  },
  fashion_editorial: {
    showAvatar: true, avatarLabel: "Model / Avatar", avatarSublabel: "The model for the editorial", avatarRequired: true,
    showProduct: true, productLabel: "Accessories / Product",
    showClothing: true, clothingLabel: "Garments", clothingSublabel: "multi-select — each garment is styled",
    showBackground: true, showMoodboard: true,
    showVoice: false, showTone: false, showPlatform: false, showLanguage: false, showVariations: true,
    objectiveLabel: "Pose Direction",
    objectivePlaceholder: "Describe the pose and mood. E.g., 'confident power stance, hand in pocket, looking slightly off camera, moody editorial feel'...",
    showNotes: false,
    showLocationRef: true,
    showStyleRef: true,
  },

  ad_creative_lab: {
    showAvatar: false, showProduct: true, productLabel: "Product",
    showClothing: false, showBackground: false, showMoodboard: true,
    showVoice: false, showTone: false, showPlatform: false, showLanguage: false, showVariations: true,
    objectiveLabel: "Creative Direction",
    objectivePlaceholder: "Describe the campaign direction. E.g., 'minimal product photography, earthy tones, premium lifestyle feel, targeting urban professionals'...",
    showNotes: true,
  },
};

const DEFAULT_SCHEMA: ToolSchema = {
  showAvatar: true, showProduct: true, showClothing: false, showBackground: true, showMoodboard: true,
  showVoice: false, showTone: true, showPlatform: true, showLanguage: false, showVariations: true,
  objectiveLabel: "Brief",
  objectivePlaceholder: "Describe what you want to create...",
  showNotes: true,
};

// ── Content Analyzer: video URL + TikTok profile picker ────

function ContentAnalyzerInput({
  config,
  setConfig,
}: {
  config: ToolConfig;
  setConfig: React.Dispatch<React.SetStateAction<ToolConfig>>;
}) {
  const [mode, setMode] = useState<"video" | "profile">("video");
  const [profileUrl, setProfileUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [videos, setVideos] = useState<TikTokVideo[]>([]);
  const [error, setError] = useState("");

  const fetchTopVideos = async () => {
    if (!profileUrl.trim()) return;
    setLoading(true);
    setError("");
    setVideos([]);
    try {
      const results = await getTikTokTopVideos(profileUrl.trim(), 10);
      setVideos(results);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error fetching profile");
    } finally {
      setLoading(false);
    }
  };

  const selectVideo = (v: TikTokVideo) => {
    setConfig((p) => ({ ...p, objective: v.url }));
    setMode("video");
  };

  const formatNum = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n);

  const engRate = (v: TikTokVideo) => {
    const plays = v.plays || 1;
    return (((v.likes + v.comments + v.shares) / plays) * 100).toFixed(1);
  };

  return (
    <div className="bg-surface-1 border border-[var(--color-warm)]/30 rounded-[var(--radius-md)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video size={14} className="text-[var(--color-warm)]" />
          <label className="text-[12px] font-semibold text-fg">Video a analizar</label>
        </div>
        <div className="flex rounded-[var(--radius-sm)] overflow-hidden border border-edge text-[11px]">
          <button
            onClick={() => setMode("video")}
            className={`px-3 py-1 ${mode === "video" ? "bg-[var(--color-warm)] text-[var(--color-warm-fg)]" : "bg-surface-2 text-fg-faint hover:text-fg"}`}
          >
            URL / Upload
          </button>
          <button
            onClick={() => setMode("profile")}
            className={`px-3 py-1 ${mode === "profile" ? "bg-[var(--color-warm)] text-[var(--color-warm-fg)]" : "bg-surface-2 text-fg-faint hover:text-fg"}`}
          >
            Perfil TikTok
          </button>
        </div>
      </div>

      {mode === "video" ? (
        <>
          <input
            type="url"
            value={config.objective}
            onChange={(e) => setConfig((p) => ({ ...p, objective: e.target.value }))}
            placeholder="https://www.tiktok.com/@user/video/... o YouTube, Instagram, URL directa"
            className="w-full h-9 px-3 rounded-[var(--radius-sm)] border border-edge bg-surface-2 text-[13px] text-fg placeholder:text-fg-faint outline-none focus:border-[var(--color-edge-focus)]"
          />
          {config.objective && (
            <p className="text-[10px] text-[var(--color-warm)]">✓ URL cargada</p>
          )}
          <p className="text-[10px] text-fg-faint">
            TikTok, YouTube, Instagram — o subí el archivo directamente abajo.
          </p>
        </>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="url"
              value={profileUrl}
              onChange={(e) => setProfileUrl(e.target.value)}
              placeholder="https://www.tiktok.com/@username"
              className="flex-1 h-9 px-3 rounded-[var(--radius-sm)] border border-edge bg-surface-2 text-[13px] text-fg placeholder:text-fg-faint outline-none focus:border-[var(--color-edge-focus)]"
            />
            <button
              onClick={fetchTopVideos}
              disabled={loading || !profileUrl.trim()}
              className="px-4 h-9 rounded-[var(--radius-sm)] bg-[var(--color-warm)] text-[var(--color-warm-fg)] text-[12px] font-medium disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
              Analizar
            </button>
          </div>
          <p className="text-[10px] text-fg-faint">Requiere APIFY_API_KEY configurada. Obtiene los top videos por engagement.</p>

          {error && <p className="text-[11px] text-red-400">{error}</p>}

          {videos.length > 0 && (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              <p className="text-[10px] text-fg-faint">{videos.length} videos — seleccioná uno para analizar:</p>
              {videos.map((v, i) => (
                <button
                  key={v.url}
                  onClick={() => selectVideo(v)}
                  className={`w-full flex gap-3 p-2 rounded-[var(--radius-sm)] border text-left transition-colors ${
                    config.objective === v.url
                      ? "border-[var(--color-warm)] bg-[var(--color-warm)]/10"
                      : "border-edge bg-surface-2 hover:border-[var(--color-warm)]/50"
                  }`}
                >
                  {v.thumbnail_url && (
                    <img src={v.thumbnail_url} alt="" className="w-12 h-16 object-cover rounded flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-bold text-[var(--color-warm)]">#{i + 1}</span>
                      <span className="text-[10px] text-fg-faint">{engRate(v)}% eng</span>
                    </div>
                    <p className="text-[11px] text-fg line-clamp-2 leading-snug">{v.description || "(sin descripción)"}</p>
                    <div className="flex gap-2 mt-1 text-[10px] text-fg-faint">
                      <span>▶ {formatNum(v.plays)}</span>
                      <span>♥ {formatNum(v.likes)}</span>
                      <span>💬 {formatNum(v.comments)}</span>
                      <span>↗ {formatNum(v.shares)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Config Panel ───────────────────────────────────────────

function ConfigPanel({
  tool,
  config,
  setConfig,
  onStart,
  onMockPreview,
}: {
  tool: ToolEntry;
  config: ToolConfig;
  setConfig: React.Dispatch<React.SetStateAction<ToolConfig>>;
  onStart: () => void;
  onMockPreview: () => void;
}) {
  const { activeBrand, refreshBrands } = useBrand();
  const schema = TOOL_DEFINITIONS[tool.id]?.schema ?? TOOL_SCHEMAS[tool.id] ?? DEFAULT_SCHEMA;
  const [systemVoices, setSystemVoices] = useState<Array<{ id: string; name: string; language: string }>>([]);
  const [actionCategories, setActionCategories] = useState<ActionCategory[]>([]);
  const [actionPickerScene, setActionPickerScene] = useState<number | null>(null);
  const [actionPickerTab, setActionPickerTab] = useState<string>("");

  useEffect(() => {
    fetchSystemVoices().then(setSystemVoices).catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeBrand || tool.id !== "ugc_creator") return;
    fetchBrandActions(activeBrand.id)
      .then((data) => {
        setActionCategories(data.categories);
        if (data.categories.length > 0) setActionPickerTab(data.categories[0].id);
      })
      .catch(() => {});
  }, [activeBrand, tool.id]);


  if (!activeBrand) {
    return (
      <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-8 text-center text-fg-muted text-[14px]">
        Select a brand from the switcher to configure this tool
      </div>
    );
  }

  // Build settings columns dynamically so empty tools don't have a row of dropdowns
  const settingsCols = [
    schema.showVoice,
    schema.showTone,
    schema.showPlatform,
    schema.showLanguage,
    schema.showVariations,
  ].filter(Boolean).length;

  return (
    <div className="space-y-5">
      {/* Brand context summary */}
      <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-[var(--color-warm-muted)] flex items-center justify-center text-[var(--color-warm)] text-[13px] font-bold">
            {activeBrand.name.charAt(0)}
          </div>
          <div>
            <div className="text-[14px] font-semibold text-fg">{activeBrand.name}</div>
            <div className="text-[11px] text-fg-faint">
              {activeBrand.avatars?.length || 0} avatars ·{" "}
              {activeBrand.products?.length || 0} products ·{" "}
              {activeBrand.clothing?.length || 0} clothing ·{" "}
              {activeBrand.backgrounds?.length || 0} backgrounds
            </div>
          </div>
        </div>
        {activeBrand.brandContext && (
          <div className="bg-surface-2 rounded-[var(--radius-sm)] p-3 text-[12px] text-fg-muted leading-relaxed line-clamp-3">
            {activeBrand.brandContext.slice(0, 200)}
            {activeBrand.brandContext.length > 200 && "..."}
          </div>
        )}
      </div>

      {/* Content Analyzer — URL input at top (primary input) */}
      {tool.id === "content_analyzer" && (
        <ContentAnalyzerInput config={config} setConfig={setConfig} />
      )}

      {/* Avatar style selector (Avatar Creator) */}
      {tool.id === "avatar_creator" && (
        <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-4 space-y-3">
          <label className="text-[12px] font-semibold text-fg-secondary">Estilo de avatar</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "realistic", label: "Realistic", desc: "Photorealistic" },
              { id: "editorial", label: "Editorial", desc: "High-fashion" },
              { id: "3d", label: "3D Render", desc: "CGI character" },
              { id: "illustrated", label: "Illustrated", desc: "2D illustration" },
              { id: "anime", label: "Anime", desc: "Japanese style" },
              { id: "cinematic", label: "Cinematic", desc: "Film quality" },
            ].map((style) => {
              const selected = ((config as Record<string, unknown>).avatarStyle || "realistic") === style.id;
              return (
                <button
                  key={style.id}
                  onClick={() => setConfig((p) => ({ ...(p as Record<string, unknown>), avatarStyle: style.id } as typeof p))}
                  className={cn(
                    "px-3 py-2 rounded-[var(--radius-sm)] text-left text-[11px] font-medium border transition-all cursor-pointer",
                    selected
                      ? "border-[var(--color-warm)] bg-[var(--color-warm-muted)] text-fg"
                      : "border-edge bg-surface-2 text-fg-muted hover:text-fg hover:border-fg-muted"
                  )}
                >
                  <div className="font-semibold">{style.label}</div>
                  <div className="text-[9px] text-fg-faint mt-0.5">{style.desc}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* UGC production settings — presets + grouped sections */}
      {tool.id === "ugc_creator" && (
        <UGCConfigPanel config={config} setConfig={setConfig} />
      )}

      {/* Style selector (Video Ad Creator) */}
      {tool.id === "video_ad_creator" && (
        <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-4 space-y-3">
          <label className="text-[12px] font-semibold text-fg-secondary">Estilo visual</label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: "photorealistic", label: "Photorealistic" },
              { id: "claymation", label: "Claymation" },
              { id: "2d_cartoon", label: "2D Cartoon" },
              { id: "3d_render", label: "3D Render" },
              { id: "cinematic", label: "Cinematic" },
              { id: "minimal", label: "Minimal" },
              { id: "retro", label: "Retro" },
              { id: "custom", label: "Custom" },
            ].map((style) => (
              <button
                key={style.id}
                onClick={() => setConfig((p) => ({ ...p, adStyle: style.id }))}
                className={cn(
                  "px-3 py-2 rounded-[var(--radius-sm)] text-[11px] font-medium border transition-all cursor-pointer text-center",
                  config.adStyle === style.id
                    ? "border-[var(--color-warm)] bg-[var(--color-warm-muted)] text-fg"
                    : "border-edge bg-surface-2 text-fg-muted hover:text-fg hover:border-fg-muted"
                )}
              >
                {style.label}
              </button>
            ))}
          </div>
          {config.adStyle === "custom" && (
            <input
              value={config.notes}
              onChange={(e) => setConfig((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Describí tu estilo custom. Ej: 'ilustración en acuarela, tonos pastel, texturas dibujadas a mano'..."
              className="w-full h-8 px-3 rounded-[var(--radius-sm)] border border-edge bg-surface-2 text-[12px] text-fg placeholder:text-fg-faint outline-none focus:border-[var(--color-edge-focus)]"
            />
          )}
        </div>
      )}

      {/* Fashion Reel — mode + visual style */}
      {tool.id === "fashion_reel" && (
        <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-4 space-y-4">
          {/* Mode toggle */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-semibold text-fg-faint uppercase tracking-widest">Modo</span>
            <div className="flex bg-surface-0 rounded-[var(--radius-sm)] p-0.5 border border-edge">
              {([
                { id: "story" as const, label: "Story", desc: "4 escenas narrativas — Hook, Movement, Showcase, Closer" },
                { id: "looks" as const, label: "Looks", desc: "Un outfit por escena — ideal para colecciones" },
              ]).map((m) => (
                <button
                  key={m.id}
                  title={m.desc}
                  onClick={() => setConfig((p) => ({ ...p, reelMode: m.id }))}
                  className={cn(
                    "px-3 py-1 text-[11px] font-semibold rounded-[calc(var(--radius-sm)-1px)] transition-all cursor-pointer",
                    config.reelMode === m.id ? "bg-[var(--color-warm)] text-[var(--color-warm-fg)] shadow-sm" : "text-fg-faint hover:text-fg"
                  )}
                >{m.label}</button>
              ))}
            </div>
            <p className="text-[10px] text-fg-faint">
              {config.reelMode === "looks"
                ? "Cada prenda seleccionada = una escena. Ideal para mostrar múltiples outfits en un solo reel."
                : "4 escenas con arco narrativo: gancho visual → movimiento → héroe → cierre."}
            </p>
          </div>

          {/* Visual style */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-semibold text-fg-faint uppercase tracking-widest">Estilo visual</span>
            <select
              value={config.visualStyle}
              onChange={(e) => setConfig((p) => ({ ...p, visualStyle: e.target.value as typeof p.visualStyle }))}
              className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-edge bg-surface-1 text-[12px] text-fg outline-none focus:border-[var(--color-warm)] cursor-pointer"
            >
              <option value="editorial">Editorial</option>
              <option value="cinematic">Cinematic</option>
              <option value="iphone">iPhone</option>
              <option value="studio">Studio</option>
            </select>
            <p className="text-[10px] text-fg-faint">
              {config.visualStyle === "editorial" ? "Luz direccional suave, calidad de revista de moda." :
               config.visualStyle === "cinematic" ? "Lente anamórfico, iluminación dramática, grado cinematográfico." :
               config.visualStyle === "iphone" ? "Handheld auténtico, luz natural disponible." :
               "Iluminación profesional 3 puntos, limpio y nítido."}
            </p>
          </div>
        </div>
      )}

      {/* Ad Template selector (Static Ad) */}
      {tool.id === "static_ad" && (
        <TemplateSelector
          selectedId={config.adTemplate}
          onSelect={(id) => setConfig((p) => ({ ...p, adTemplate: id }))}
        />
      )}

      {/* Carousel type selector */}
      {tool.id === "carousel_creator" && (
        <CarouselTypeSelector
          selectedType={config.carouselType}
          numSlides={config.numSlides}
          onSelectType={(id) => setConfig((p) => ({ ...p, carouselType: id }))}
          onChangeSlides={(n) => setConfig((p) => ({ ...p, numSlides: n }))}
        />
      )}

      {/* Animation mode selector (Product Clip, Video Ad Creator) */}
      {(tool.id === "product_clip" || tool.id === "video_ad_creator") && (
        <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-3 space-y-2">
          <label className="text-[12px] font-semibold text-fg-secondary">Modo de animación</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setConfig((p) => ({ ...p, animationMode: "frame-to-frame" }))}
              className={cn(
                "px-3 py-2 rounded-[var(--radius-sm)] text-[11px] font-medium border transition-all cursor-pointer text-center",
                config.animationMode === "frame-to-frame"
                  ? "border-[var(--color-warm)] bg-[var(--color-warm-muted)] text-fg"
                  : "border-edge bg-surface-2 text-fg-muted hover:text-fg hover:border-fg-muted"
              )}
            >
              <div className="font-semibold">Frame-to-Frame</div>
              <div className="text-[9px] text-fg-faint mt-0.5">Transiciones suaves entre escenas</div>
            </button>
            <button
              onClick={() => setConfig((p) => ({ ...p, animationMode: "image-to-video" }))}
              className={cn(
                "px-3 py-2 rounded-[var(--radius-sm)] text-[11px] font-medium border transition-all cursor-pointer text-center",
                config.animationMode === "image-to-video"
                  ? "border-[var(--color-warm)] bg-[var(--color-warm-muted)] text-fg"
                  : "border-edge bg-surface-2 text-fg-muted hover:text-fg hover:border-fg-muted"
              )}
            >
              <div className="font-semibold">Image-to-Video</div>
              <div className="text-[9px] text-fg-faint mt-0.5">Cada frame animado independientemente</div>
            </button>
          </div>
        </div>
      )}

      {/* Reference image(s) + Graphics uploaders */}
      {(tool.id === "ad_creative_lab" || tool.id === "static_ad" || tool.id === "content_analyzer" || tool.id === "product_clip" || tool.id === "ugc_creator" || tool.id === "fashion_reel") && (
        <div className={cn("gap-4", tool.id === "static_ad" ? "grid grid-cols-2" : "space-y-4")}>
          {/* Reference Image — single for Static Ad, multiple for Ad Creative Lab */}
          <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-semibold text-fg-secondary">
                {tool.id === "content_analyzer" ? "Upload Video" : (tool.id === "ugc_creator" || tool.id === "fashion_reel") ? "Composition Reference" : (tool.id === "static_ad" || tool.id === "product_clip") ? "Reference Image" : "Reference Images"}
                <span className="text-fg-faint font-normal ml-1">
                  {tool.id === "content_analyzer" ? "(MP4, WebM — or use URL above)" : (tool.id === "ugc_creator" || tool.id === "fashion_reel") ? "(optional — pose/setting reference for first scene)" : (tool.id === "static_ad" || tool.id === "product_clip") ? "(style/mood reference)" : "(campaign style references)"}
                </span>
              </label>
              <span className="text-[10px] text-fg-faint">{config.referenceImages.length} uploaded</span>
            </div>

            {config.referenceImages.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {config.referenceImages.map((file, i) => (
                  <div key={i} className="relative w-12 h-12 rounded-[var(--radius-sm)] overflow-hidden border border-edge group shrink-0">
                    <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-full object-cover" />
                    <button
                      onClick={() => setConfig((p) => ({ ...p, referenceImages: p.referenceImages.filter((_, j) => j !== i) }))}
                      className="absolute top-0 right-0 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <span className="text-white text-[8px]">×</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <label className={cn(
              "flex items-center justify-center gap-1.5 py-2 border border-dashed rounded-[var(--radius-sm)] cursor-pointer text-[10px] transition-all",
              "border-edge hover:border-[var(--color-edge-strong)] hover:bg-surface-2 text-fg-muted hover:text-fg"
            )}>
              <Plus size={11} /> {tool.id === "content_analyzer" ? "Upload video" : (tool.id === "static_ad" || tool.id === "product_clip") ? "Upload reference" : "Add references"}
              <input
                type="file"
                accept={tool.id === "content_analyzer" ? "video/*" : "image/*"}
                multiple={tool.id !== "static_ad" && tool.id !== "content_analyzer" && tool.id !== "product_clip"}
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 0) {
                    setConfig((p) => ({
                      ...p,
                      referenceImages: tool.id === "static_ad" ? [files[0]] : [...p.referenceImages, ...files].slice(0, 10),
                    }));
                  }
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          {/* Graphics — logo, badges, icons (Static Ad only) */}
          {tool.id === "static_ad" && (
            <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-semibold text-fg-secondary">
                  Graphics
                  <span className="text-fg-faint font-normal ml-1">(logo, badges, icons)</span>
                </label>
                <span className="text-[10px] text-fg-faint">{config.graphicAssets.length} uploaded</span>
              </div>

              {config.graphicAssets.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {config.graphicAssets.map((file, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-[var(--radius-sm)] overflow-hidden border border-edge group bg-white flex items-center justify-center p-1">
                      <img src={URL.createObjectURL(file)} alt={file.name} className="max-w-full max-h-full object-contain" />
                      <button
                        onClick={() => setConfig((p) => ({ ...p, graphicAssets: p.graphicAssets.filter((_, j) => j !== i) }))}
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        <span className="text-white text-[8px]">×</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <label className={cn(
                "flex items-center justify-center gap-1.5 py-2 border border-dashed rounded-[var(--radius-sm)] cursor-pointer text-[10px] transition-all",
                "border-edge hover:border-[var(--color-edge-strong)] hover:bg-surface-2 text-fg-muted hover:text-fg"
              )}>
                <Plus size={11} /> Add graphics
                <input type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length > 0) setConfig((p) => ({ ...p, graphicAssets: [...p.graphicAssets, ...files] }));
                    e.target.value = "";
                  }}
                />
              </label>
              {activeBrand.logo?.imageUrl && config.graphicAssets.length === 0 && (
                <div className="flex items-center gap-2 bg-surface-2 rounded-[var(--radius-sm)] px-3 py-2">
                  <div className="w-8 h-8 rounded bg-white overflow-hidden flex items-center justify-center p-0.5 shrink-0">
                    <img src={`http://localhost:8000${activeBrand.logo.imageUrl}`} alt="Brand logo" className="max-w-full max-h-full object-contain" />
                  </div>
                  <span className="text-[10px] text-fg-muted">Brand Kit logo will be used automatically</span>
                </div>
              )}
            </div>
          )}

          <label className="flex items-center gap-2 mt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.allowFaces}
              onChange={(e) => setConfig((p) => ({ ...p, allowFaces: e.target.checked }))}
              className="accent-[var(--color-warm)]"
            />
            <span className="text-[12px] text-fg-muted">
              Allow faces / people in generated images
            </span>
          </label>
        </div>
      )}

      {/* Inputs summary — only shown when at least one asset is used */}
      {(schema.showAvatar || schema.showProduct || schema.showClothing || schema.showBackground || schema.showVoice || schema.showLanguage) && (
        <div className="bg-surface-0 border border-edge rounded-[var(--radius-sm)] px-4 py-2 flex gap-3 flex-wrap">
          {[
            schema.showAvatar && (schema.avatarLabel || "Avatar"),
            schema.showProduct && (schema.productLabel || "Product"),
            schema.showClothing && (schema.clothingLabel || "Clothing"),
            schema.showBackground && "Background",
            schema.showVoice && "Voice",
            schema.showLanguage && "Language",
          ].filter(Boolean).map((name, i) => (
            <span key={i} className="text-[11px] font-medium text-fg-muted">{name as string}</span>
          ))}
        </div>
      )}

      {/* Asset selection — only render sections that this tool uses */}
      {(schema.showAvatar || schema.showProduct || schema.showClothing || schema.showBackground) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {schema.showAvatar && (
            <AssetSelector
              label={schema.avatarLabel || "Avatar"}
              sublabel={schema.avatarSublabel || ""}
              emptyText="Upload an avatar or add from here"
              items={(activeBrand.avatars || []).map((av) => ({
                id: av.id,
                name: av.name,
                description: av.description,
                imageUrl: av.imageUrl ? avatarImageUrl(av.imageUrl) : undefined,
              }))}
              {...(schema.multiAvatar ? {
                selectedIds: config.selectedAvatarIds,
                onToggle: (id: string) => setConfig((p) => ({
                  ...p,
                  selectedAvatarIds: p.selectedAvatarIds.includes(id)
                    ? p.selectedAvatarIds.filter((x) => x !== id)
                    : [...p.selectedAvatarIds, id],
                })),
                multi: true,
              } : {
                selectedId: config.selectedAvatarId,
                onSelect: (id: string) => setConfig((p) => ({ ...p, selectedAvatarId: p.selectedAvatarId === id ? null : id })),
              })}
              onUpload={async (file, name) => {
                const item = await uploadAvatar(activeBrand.id, name, file);
                await refreshBrands();
                if (schema.multiAvatar) {
                  setConfig((p) => ({ ...p, selectedAvatarIds: [...p.selectedAvatarIds, item.id] }));
                } else {
                  setConfig((p) => ({ ...p, selectedAvatarId: item.id }));
                }
              }}
            />
          )}

          {schema.showProduct && (
            <div className="space-y-2">
              <AssetSelector
                label={schema.productLabel || "Product"}
                sublabel={schema.productSublabel || (schema.multiProduct ? "multi-select" : "")}
                emptyText="Upload products in Brand Kit"
                items={(activeBrand.products || []).map((prod) => ({
                  id: prod.id,
                  name: prod.name,
                  description: prod.description,
                  imageUrl: prod.imageUrl ? productImageUrl(prod.imageUrl) : undefined,
                }))}
                {...(schema.multiProduct ? {
                  selectedIds: config.selectedProductIds,
                  onToggle: (id: string) => setConfig((p) => ({
                    ...p,
                    selectedProductIds: p.selectedProductIds.includes(id)
                      ? p.selectedProductIds.filter((x) => x !== id)
                      : [...p.selectedProductIds, id],
                  })),
                  multi: true,
                } : {
                  selectedId: config.selectedProductId,
                  onSelect: (id: string) => setConfig((p) => ({ ...p, selectedProductId: p.selectedProductId === id ? null : id })),
                })}
              />
              {config.selectedProductId && tool.id === "ugc_creator" && (
                <label className="flex items-center gap-2 px-4 py-2 bg-surface-1 border border-edge rounded-[var(--radius-sm)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.productIsWorn}
                    onChange={(e) => setConfig((p) => ({ ...p, productIsWorn: e.target.checked }))}
                    className="accent-[var(--color-warm)]"
                  />
                  <span className="text-[12px] text-fg-muted">
                    The product is what the avatar <strong>wears</strong> (not held in hands)
                  </span>
                </label>
              )}
            </div>
          )}

          {schema.showClothing && (
            <AssetSelector
              label={schema.clothingLabel || "Clothing"}
              sublabel={schema.clothingSublabel || "multi-select"}
              emptyText="Upload clothing items or add from here"
              items={(activeBrand.clothing || []).map((item) => ({
                id: item.id,
                name: item.name,
                description: item.description,
                imageUrl: item.imageUrl ? clothingImageUrl(item.imageUrl) : undefined,
              }))}
              selectedIds={config.selectedClothingIds}
              onToggle={(id) =>
                setConfig((p) => ({
                  ...p,
                  selectedClothingIds: p.selectedClothingIds.includes(id)
                    ? p.selectedClothingIds.filter((x) => x !== id)
                    : [...p.selectedClothingIds, id],
                }))
              }
              multi
              onUpload={async (file, name) => {
                const item = await uploadClothing(activeBrand.id, name, file);
                await refreshBrands();
                setConfig((p) => ({
                  ...p,
                  selectedClothingIds: [...p.selectedClothingIds, item.id],
                }));
              }}
            />
          )}

          {schema.showBackground && (
            <AssetSelector
              label="Fondo"
              sublabel={schema.backgroundSublabel || ""}
              emptyText="Upload a background or add from here"
              items={(activeBrand.backgrounds || []).map((bg) => ({
                id: bg.id,
                name: bg.name,
                description: bg.description,
                imageUrl: bg.imageUrl ? backgroundImageUrl(bg.imageUrl) : undefined,
              }))}
              selectedId={config.selectedBackgroundId}
              onSelect={(id) =>
                setConfig((p) => ({ ...p, selectedBackgroundId: p.selectedBackgroundId === id ? null : id }))
              }
              onUpload={async (file, name) => {
                const item = await uploadBackground(activeBrand.id, name, file);
                await refreshBrands();
                setConfig((p) => ({ ...p, selectedBackgroundId: item.id }));
              }}
            />
          )}

          {schema.showMoodboard && (
            <AssetSelector
              label="Moodboard"
              sublabel="visual style reference — one active at a time"
              emptyText="Upload a moodboard (up to 5 per brand)"
              items={(activeBrand.moodboards || []).map((m) => ({
                id: m.id,
                name: m.name,
                description: m.description,
                imageUrl: m.imageUrl ? moodboardImageUrl(m.imageUrl) : undefined,
              }))}
              selectedId={config.selectedMoodboardId}
              onSelect={(id) =>
                setConfig((p) => ({ ...p, selectedMoodboardId: p.selectedMoodboardId === id ? null : id }))
              }
              onUpload={async (file, name) => {
                const item = await uploadMoodboard(activeBrand.id, name, file);
                await refreshBrands();
                setConfig((p) => ({ ...p, selectedMoodboardId: item.id }));
              }}
            />
          )}
        </div>
      )}

      {/* Settings — only relevant dropdowns + objective */}
      <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-5 space-y-4">
        <h3 className="text-[12px] font-semibold text-fg-secondary">Ajustes</h3>

        {settingsCols > 0 && (
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${Math.min(settingsCols, 5)}, minmax(0, 1fr))` }}
          >
            {schema.showVoice && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-fg-faint">Voz</label>
                <div className="flex gap-1.5">
                  <select
                    value={config.selectedVoiceId || ""}
                    onChange={(e) => setConfig((p) => ({ ...p, selectedVoiceId: e.target.value || null }))}
                    className="flex-1 h-8 px-2 rounded-[var(--radius-sm)] border border-edge bg-surface-2 text-[12px] text-fg outline-none focus:border-[var(--color-edge-focus)]"
                  >
                    <option value="">Select voice...</option>
                    {(activeBrand?.voicePresets || []).length > 0 && (
                      <optgroup label="Voces de la marca">
                        {activeBrand.voicePresets.map((v) => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </optgroup>
                    )}
                    {systemVoices.length > 0 && (
                      <optgroup label="Voces del sistema">
                        {systemVoices.map((v) => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  {config.selectedVoiceId && (
                    <button
                      type="button"
                      onClick={async (e) => {
                        const btn = e.currentTarget;
                        if (btn.dataset.playing === "true") {
                          // Stop
                          const audio = (btn as unknown as { _audio?: HTMLAudioElement })._audio;
                          audio?.pause();
                          btn.dataset.playing = "false";
                          btn.classList.remove("text-[var(--color-warm)]");
                          btn.classList.add("text-fg-muted");
                          return;
                        }
                        // Generate + play
                        btn.dataset.playing = "loading";
                        btn.classList.add("animate-pulse");
                        try {
                          const result = await generateTTS({ text: "Hola, esta es una muestra de mi voz para este proyecto.", voice_id: config.selectedVoiceId! });
                          const audio = new Audio(result.audioUrl);
                          (btn as unknown as { _audio?: HTMLAudioElement })._audio = audio;
                          btn.classList.remove("animate-pulse", "text-fg-muted");
                          btn.classList.add("text-[var(--color-warm)]");
                          btn.dataset.playing = "true";
                          audio.onended = () => {
                            btn.dataset.playing = "false";
                            btn.classList.remove("text-[var(--color-warm)]");
                            btn.classList.add("text-fg-muted");
                          };
                          audio.play();
                        } catch {
                          btn.classList.remove("animate-pulse");
                          btn.dataset.playing = "false";
                        }
                      }}
                      className="h-8 w-8 shrink-0 flex items-center justify-center rounded-[var(--radius-sm)] bg-surface-2 border border-edge text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors cursor-pointer"
                      title="Previsualizar voz"
                    >
                      <Play size={12} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {schema.showTone && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-fg-faint">Tono</label>
                <select
                  value={config.tone}
                  onChange={(e) => setConfig((p) => ({ ...p, tone: e.target.value }))}
                  className="w-full h-8 px-2 rounded-[var(--radius-sm)] border border-edge bg-surface-2 text-[12px] text-fg outline-none focus:border-[var(--color-edge-focus)]"
                >
                  <option value="engaging">Atrapante</option>
                  <option value="casual">Casual</option>
                  <option value="professional">Profesional</option>
                  <option value="funny">Gracioso</option>
                  <option value="inspirational">Inspiracional</option>
                </select>
              </div>
            )}

            {schema.showPlatform && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-fg-faint">Plataforma</label>
                <select
                  value={config.platform}
                  onChange={(e) => setConfig((p) => ({ ...p, platform: e.target.value }))}
                  className="w-full h-8 px-2 rounded-[var(--radius-sm)] border border-edge bg-surface-2 text-[12px] text-fg outline-none focus:border-[var(--color-edge-focus)]"
                >
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                  <option value="youtube">YouTube Shorts</option>
                  <option value="facebook">Facebook</option>
                </select>
              </div>
            )}

            {schema.showLanguage && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-fg-faint">Idioma</label>
                <select
                  value={config.language}
                  onChange={(e) => setConfig((p) => ({ ...p, language: e.target.value }))}
                  className="w-full h-8 px-2 rounded-[var(--radius-sm)] border border-edge bg-surface-2 text-[12px] text-fg outline-none focus:border-[var(--color-edge-focus)]"
                >
                  <option value="es">Español</option>
                  <option value="en">Inglés</option>
                </select>
              </div>
            )}

            {schema.showVariations && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-fg-faint">Variaciones</label>
                <select
                  value={config.numVariations}
                  onChange={(e) => setConfig((p) => ({ ...p, numVariations: parseInt(e.target.value) }))}
                  className="w-full h-8 px-2 rounded-[var(--radius-sm)] border border-edge bg-surface-2 text-[12px] text-fg outline-none focus:border-[var(--color-edge-focus)]"
                >
                  <option value={1}>1</option>
                  <option value={3}>3 (recommended)</option>
                  <option value={5}>5</option>
                </select>
              </div>
            )}
          </div>
        )}

        {/* Aspect Ratio + Resolution + Subtitles — hidden for analysis-only tools */}
        {tool.id !== "content_analyzer" && <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-fg-faint">Aspect ratio</label>
            <select
              value={config.aspectRatio}
              onChange={(e) => setConfig((p) => ({ ...p, aspectRatio: e.target.value }))}
              className="w-full h-8 px-2 rounded-[var(--radius-sm)] border border-edge bg-surface-2 text-[12px] text-fg outline-none focus:border-[var(--color-edge-focus)]"
            >
              <option value="9:16">9:16 Vertical</option>
              <option value="16:9">16:9 Horizontal</option>
              <option value="1:1">1:1 Square</option>
              <option value="4:5">4:5 Portrait</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-fg-faint">Resolución</label>
            <select
              value={config.resolution}
              onChange={(e) => setConfig((p) => ({ ...p, resolution: e.target.value }))}
              className="w-full h-8 px-2 rounded-[var(--radius-sm)] border border-edge bg-surface-2 text-[12px] text-fg outline-none focus:border-[var(--color-edge-focus)]"
            >
              <option value="1K">1K (standard)</option>
              <option value="2K">2K (high quality)</option>
              <option value="4K">4K (production)</option>
            </select>
          </div>
          {tool.category === "video" && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-fg-faint">Subtítulos</label>
              <select
                value={config.subtitleEngine}
                onChange={(e) => setConfig((p) => ({ ...p, subtitleEngine: e.target.value as ToolConfig["subtitleEngine"] }))}
                className="w-full h-8 px-2 rounded-[var(--radius-sm)] border border-edge bg-surface-2 text-[12px] text-fg outline-none focus:border-[var(--color-edge-focus)]"
              >
                <option value="auto">Auto (best available)</option>
                <option value="remotion">Remotion (animated)</option>
                <option value="ffmpeg">FFmpeg (simple)</option>
                <option value="none">No subtitles</option>
              </select>
            </div>
          )}
        </div>}

        {/* Video Duration — only for video tools with script step */}
        {tool.category === "video" && tool.pipeline?.includes("script") && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-fg-faint">Duración del video</label>
              <span className="text-[10px] text-fg-faint">
                {(() => {
                  const dur = parseInt(config.videoDuration || "30");
                  const scenes = 4;
                  const wordsPerScene = Math.round(dur / scenes * 2.5);
                  return `~${wordsPerScene} palabras / escena`;
                })()}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { value: "15", label: "15s", sub: "Story corta" },
                { value: "30", label: "30s", sub: "Estándar" },
                { value: "45", label: "45s", sub: "Detallado" },
                { value: "60", label: "60s", sub: "Long-form" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setConfig((p) => ({ ...p, videoDuration: opt.value }))}
                  className={`flex flex-col items-center py-2 px-1 rounded-[var(--radius-sm)] border text-center transition-all cursor-pointer ${
                    config.videoDuration === opt.value
                      ? "border-[var(--color-warm)] bg-[var(--color-warm)]/10 text-fg"
                      : "border-edge bg-surface-2 text-fg-muted hover:border-edge-strong"
                  }`}
                >
                  <span className="text-[13px] font-semibold">{opt.label}</span>
                  <span className="text-[9px] text-fg-faint mt-0.5">{opt.sub}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Voice settings — only for UGC Creator (has voice step) */}
        {tool.id === "ugc_creator" && (
          <VoiceSettingsPanel config={config} setConfig={setConfig} />
        )}

        {/* Objective / brief — hidden for content_analyzer (shown at top as URL input) */}
        {tool.id !== "content_analyzer" && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-fg-faint">
              {schema.objectiveLabel}
            </label>
            <textarea
              value={config.objective}
              onChange={(e) => setConfig((p) => ({ ...p, objective: e.target.value }))}
              rows={tool.id === "ugc_creator" ? 6 : 3}
              placeholder={schema.objectivePlaceholder}
              className="w-full bg-surface-2 border border-edge rounded-[var(--radius-sm)] px-3 py-2 text-[13px] text-fg placeholder:text-fg-faint outline-none focus:border-[var(--color-edge-focus)] resize-none leading-relaxed"
            />
          </div>
        )}

        {/* Custom Script — per-scene inputs, skip Gemini (UGC only) */}
        {tool.id === "ugc_creator" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-fg-faint">
                Custom Script <span className="text-fg-faint">(optional — skip AI)</span>
              </label>
              {config.customScript && (
                <button
                  onClick={() => setConfig((p) => ({ ...p, customScript: "" }))}
                  className="text-[9px] text-fg-faint hover:text-fg cursor-pointer"
                >
                  Clear all
                </button>
              )}
            </div>
            {(() => {
              // Parse scenes: array of {script, visual, shot} objects
              type CustomScene = { script: string; visual: string; shot?: string };
              let scenes: CustomScene[] = [];
              try {
                const parsed = JSON.parse(config.customScript || "[]");
                if (Array.isArray(parsed)) {
                  scenes = parsed.map((s: string | CustomScene) =>
                    typeof s === "string" ? { script: s, visual: "", shot: "auto" } : { shot: "auto", ...s }
                  );
                }
              } catch {
                scenes = [];
              }
              if (scenes.length === 0) scenes.push({ script: "", visual: "", shot: "auto" });

              const save = (updated: CustomScene[]) => {
                setConfig((p) => ({ ...p, customScript: JSON.stringify(updated) }));
              };
              const updateScript = (idx: number, val: string) => {
                const u = [...scenes]; u[idx] = { ...u[idx], script: val }; save(u);
              };
              const updateVisual = (idx: number, val: string) => {
                const u = [...scenes]; u[idx] = { ...u[idx], visual: val }; save(u);
              };
              const updateShot = (idx: number, val: string) => {
                const u = [...scenes]; u[idx] = { ...u[idx], shot: val }; save(u);
              };
              const addScene = () => save([...scenes, { script: "", visual: "", shot: "auto" }]);
              const removeScene = (idx: number) => save(scenes.filter((_, i) => i !== idx));
              const hasContent = scenes.some((s) => s.script.trim());

              return (
                <>
                  {scenes.map((s, i) => (
                    <div key={i} className="border border-edge rounded-[var(--radius-sm)] p-3 space-y-2">
                      <div className="flex gap-2 items-start">
                        <span className="text-[11px] text-fg-muted font-mono mt-1.5 w-4 shrink-0">{i + 1}</span>
                        <div className="flex-1 space-y-2">
                          <textarea
                            value={s.script}
                            onChange={(e) => updateScript(i, e.target.value)}
                            rows={2}
                            placeholder={
                              i === 0 ? "Lo que dice el avatar en esta escena..."
                              : i === scenes.length - 1 ? "CTA final..."
                              : `Escena ${i + 1}...`
                            }
                            className="w-full bg-surface-2 border border-edge rounded-[var(--radius-sm)] px-3 py-2 text-[13px] text-fg placeholder:text-fg-muted outline-none focus:border-[var(--color-edge-focus)] resize-none"
                          />
                          <div className="relative">
                            <div className="flex gap-1 items-center">
                              <input
                                value={s.visual}
                                onChange={(e) => updateVisual(i, e.target.value)}
                                placeholder={
                                  i === 0 ? "Visual: plano, acción, entorno (opcional)"
                                  : "Visual: descripción de la toma (opcional)"
                                }
                                className="flex-1 bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-3 py-1.5 text-[12px] text-fg-muted placeholder:text-fg-muted outline-none focus:border-[var(--color-edge-focus)]"
                              />
                              {actionCategories.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setActionPickerScene(actionPickerScene === i ? null : i)}
                                  title="Elegir acción"
                                  className={cn(
                                    "flex items-center gap-1 px-2 py-1.5 rounded-[var(--radius-sm)] border text-[11px] font-medium cursor-pointer transition-colors shrink-0",
                                    actionPickerScene === i
                                      ? "bg-purple-900/40 border-purple-500/50 text-purple-300"
                                      : "bg-surface-1 border-edge text-fg-muted hover:text-fg hover:border-edge-hover"
                                  )}
                                >
                                  <Zap size={11} />
                                </button>
                              )}
                            </div>
                            {/* Action picker dropdown */}
                            {actionPickerScene === i && actionCategories.length > 0 && (
                              <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-surface-2 border border-edge rounded-[var(--radius)] shadow-xl">
                                {/* Header */}
                                <div className="flex items-center justify-between px-3 py-2 border-b border-edge">
                                  <span className="text-[11px] font-semibold text-fg-muted uppercase tracking-widest">Acciones</span>
                                  <button
                                    type="button"
                                    onClick={() => setActionPickerScene(null)}
                                    className="text-fg-muted hover:text-fg cursor-pointer"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                                {/* Category tabs */}
                                <div className="flex gap-1 p-2 border-b border-edge overflow-x-auto">
                                  {actionCategories.map((cat) => (
                                    <button
                                      key={cat.id}
                                      type="button"
                                      onClick={() => setActionPickerTab(cat.id)}
                                      className={cn(
                                        "px-2.5 py-1 rounded-[var(--radius-sm)] text-[11px] font-medium whitespace-nowrap cursor-pointer transition-colors",
                                        actionPickerTab === cat.id
                                          ? "bg-purple-900/50 text-purple-300 border border-purple-500/40"
                                          : "text-fg-muted hover:text-fg hover:bg-surface-3"
                                      )}
                                    >
                                      {cat.label}
                                    </button>
                                  ))}
                                </div>
                                {/* Actions */}
                                <div className="p-2 flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                                  {(actionCategories.find((c) => c.id === actionPickerTab)?.actions ?? []).map((action) => (
                                    <button
                                      key={action.name}
                                      type="button"
                                      onClick={() => {
                                        updateVisual(i, action.prompt);
                                        setActionPickerScene(null);
                                      }}
                                      className="px-2.5 py-1 bg-surface-3 hover:bg-surface-2 border border-edge rounded-full text-[11px] text-fg-muted hover:text-fg cursor-pointer transition-colors"
                                    >
                                      {action.name}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <button onClick={() => removeScene(i)} className="text-[11px] text-fg-muted hover:text-red-400 mt-1.5 cursor-pointer">
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={addScene}
                    className="flex items-center gap-1 text-[10px] text-fg-muted hover:text-fg cursor-pointer"
                  >
                    <Plus size={10} /> Add scene
                  </button>
                  {hasContent && (
                    <p className="text-[10px] text-[var(--color-warm)]">
                      AI script generation will be skipped — your scripts will be used directly.
                    </p>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {(schema.showLocationRef || schema.showStyleRef) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {schema.showLocationRef && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-fg-faint">
                  Location Reference <span className="text-fg-faint">(optional)</span>
                </label>
                <textarea
                  value={config.locationRef}
                  onChange={(e) => setConfig((p) => ({ ...p, locationRef: e.target.value }))}
                  rows={2}
                  placeholder="Ej: 'rooftop in NYC at golden hour', 'industrial warehouse with concrete walls and diffused light'..."
                  className="w-full bg-surface-2 border border-edge rounded-[var(--radius-sm)] px-3 py-2 text-[13px] text-fg placeholder:text-fg-faint outline-none focus:border-[var(--color-edge-focus)] resize-none"
                />
              </div>
            )}
            {schema.showStyleRef && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-fg-faint">
                  Style Reference <span className="text-fg-faint">(optional)</span>
                </label>
                <textarea
                  value={config.styleRef}
                  onChange={(e) => setConfig((p) => ({ ...p, styleRef: e.target.value }))}
                  rows={2}
                  placeholder="Ej: 'Vogue Italia dark editorial', 'COS minimalist campaign', '90s supermodel energy, film grain'..."
                  className="w-full bg-surface-2 border border-edge rounded-[var(--radius-sm)] px-3 py-2 text-[13px] text-fg placeholder:text-fg-faint outline-none focus:border-[var(--color-edge-focus)] resize-none"
                />
              </div>
            )}
          </div>
        )}

        {schema.showNotes && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-fg-faint">
              Additional Notes <span className="text-fg-faint">(optional)</span>
            </label>
            <textarea
              value={config.notes}
              onChange={(e) => setConfig((p) => ({ ...p, notes: e.target.value }))}
              rows={2}
              placeholder="Instrucciones extra, referencias, o constraints..."
              className="w-full bg-surface-2 border border-edge rounded-[var(--radius-sm)] px-3 py-2 text-[13px] text-fg placeholder:text-fg-faint outline-none focus:border-[var(--color-edge-focus)] resize-none"
            />
          </div>
        )}
      </div>

      {/* Summary + start */}
      <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[13px] font-semibold text-fg">Listo para generar</h3>
            <p className="text-[12px] text-fg-muted mt-0.5">
              {[
                schema.showAvatar && (config.selectedAvatarId
                  ? `${schema.avatarLabel || "Avatar"} ✓`
                  : `${schema.avatarLabel || "Avatar"} —`),
                schema.showProduct && (config.selectedProductId
                  ? `${schema.productLabel || "Product"} ✓`
                  : `${schema.productLabel || "Product"} —`),
                schema.showClothing && config.selectedClothingIds.length > 0 && `${config.selectedClothingIds.length} ${schema.clothingLabel || "clothing"}`,
                schema.showBackground && (config.selectedBackgroundId
                  ? "Background ✓"
                  : "Background —"),
                schema.showVoice && (config.selectedVoiceId
                  ? "Voice ✓"
                  : "Voice —"),
                schema.showVariations && `${config.numVariations} variations`,
              ].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onStart}
              className="flex items-center gap-2 px-6 py-2.5 text-[13px] font-medium text-[var(--color-warm-fg)] bg-[var(--color-warm)] rounded-[var(--radius-sm)] hover:opacity-90 transition-opacity cursor-pointer"
            >
              <Play size={14} />
              Start Pipeline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step Panel ─────────────────────────────────────────────

function StepPanel({
  step,
  stepIndex,
  totalSteps,
  config,
  allSteps,
  curationSelections,
  onCurationSelect,
  audioCache,
  onAudioCached,
  onComplete,
  onApprove,
  onRegenerate,
  onReRunFromHere,
  onUpdateStepResult,
}: {
  tool: ToolEntry;
  step: StepState;
  stepIndex: number;
  totalSteps: number;
  config: ToolConfig;
  allSteps: StepState[];
  curationSelections: Record<string, string>;
  onCurationSelect: (sceneId: string, variationId: string) => void;
  audioCache: Record<string, { url: string; blob: Blob }>;
  onAudioCached: (sceneId: string, url: string, blob: Blob) => void;
  onComplete: () => void;
  onApprove: () => void;
  onRegenerate: () => void;
  onReRunFromHere: () => void;
  onUpdateStepResult?: (stepId: string, result: unknown) => void;
}) {
  const meta = STEP_META[step.id] || {
    label: step.id,
    icon: <Sparkles size={15} />,
    description: "",
  };
  const { activeBrand } = useBrand();

  return (
    <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] overflow-hidden">
      {/* Step header */}
      <div className="px-5 py-4 border-b border-edge flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-fg-muted">
            {meta.icon}
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-fg">
              Step {stepIndex + 1}: {meta.label}
            </h3>
            <p className="text-[12px] text-fg-faint">{meta.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-fg-faint">
            {stepIndex + 1} / {totalSteps}
          </span>
          {step.status === "active" && (
            <button
              onClick={onComplete}
              className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium text-[var(--color-warm-fg)] bg-[var(--color-warm)] rounded-[var(--radius-sm)] hover:opacity-90 transition-opacity cursor-pointer"
            >
              <Play size={12} />
              Run
            </button>
          )}
          {step.status === "review" && step.id !== "route" && (
            <div className="flex items-center gap-2">
              <button
                onClick={onRegenerate}
                className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-fg-muted hover:text-fg bg-surface-2 hover:bg-surface-1 rounded-[var(--radius-sm)] transition-colors cursor-pointer"
              >
                <RotateCcw size={12} />
                Regenerate
              </button>
              <button
                onClick={onApprove}
                className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium text-white bg-[var(--color-success)] rounded-[var(--radius-sm)] hover:opacity-90 transition-opacity cursor-pointer"
              >
                <Check size={12} />
                Approve & Continue
              </button>
            </div>
          )}
          {(step.status === "done" || step.status === "stale") && (
            <button
              onClick={onReRunFromHere}
              className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-fg-muted hover:text-fg bg-surface-2 hover:bg-surface-1 rounded-[var(--radius-sm)] transition-colors cursor-pointer"
            >
              <RotateCcw size={12} />
              Re-run from here
            </button>
          )}
        </div>
      </div>

      {/* Step content */}
      <div className="p-5">
        {step.status === "pending" ? (
          <PendingStep stepId={step.id} />
        ) : step.status === "active" ? (
          <ActiveStep
            stepId={step.id}
            config={config}
            brandName={activeBrand?.name || ""}
          />
        ) : step.status === "running" ? (
          <div className="flex flex-col items-center py-12 gap-3">
            <Loader2
              size={24}
              className="animate-spin text-[var(--color-warm)]"
            />
            <p className="text-[13px] text-fg-muted">
              Running {meta.label}...
            </p>
          </div>
        ) : step.status === "review" && step.id === "route" ? (
          <RoutePanel allSteps={allSteps} config={config} />
        ) : step.status === "review" && (step.id === "curation" || step.id === "multishot") ? (
          <CurationPanel
            allSteps={allSteps}
            curationSelections={curationSelections}
            onSelect={onCurationSelect}
            audioCache={audioCache}
            onAudioCached={onAudioCached}
            voiceId={config.selectedVoiceId}
            config={config}
            onUpdateStepResult={onUpdateStepResult}
          />
        ) : step.status === "review" ? (
          <DoneStep stepId={step.id} result={step.result} audioCache={audioCache} config={config} allSteps={allSteps}
            onUpdateStepResult={onUpdateStepResult}
            getScriptScenes={() => {
              const sr = allSteps.find((s: StepState) => s.id === "script")?.result as Record<string, unknown> | undefined;
              if (!sr?.scenes) return [];
              const arr = (sr.scenes as Array<Array<Record<string, string>>>)[0] || [];
              return arr.map((s, i) => ({ id: s.id || `act_${i+1}`, title: s.title || s.act || `Scene ${i+1}`, script: s.script || s.speech || s.copy || s.text || "", image_prompt: s.image_prompt || "" }));
            }} />
        ) : step.status === "done" || step.status === "stale" ? (
          <div className={step.status === "stale" ? "opacity-50" : ""}>
            {step.status === "stale" && (
              <div className="bg-surface-2 border border-edge rounded-[var(--radius-sm)] px-4 py-2 mb-4 flex items-center gap-2">
                <AlertCircle size={12} className="text-fg-faint" />
                <span className="text-[11px] text-fg-faint">Previous step changed — this result may be outdated</span>
              </div>
            )}
            <DoneStep stepId={step.id} result={step.result} audioCache={audioCache} config={config} allSteps={allSteps}
              onUpdateStepResult={onUpdateStepResult}
              getScriptScenes={() => {
                const sr = allSteps.find((s: StepState) => s.id === "script")?.result as Record<string, unknown> | undefined;
                if (!sr?.scenes) return [];
                const arr = (sr.scenes as Array<Array<Record<string, string>>>)[0] || [];
                return arr.map((s, i) => ({ id: s.id || `act_${i+1}`, title: s.title || s.act || `Scene ${i+1}`, script: s.script || s.speech || s.copy || s.text || "", image_prompt: s.image_prompt || "" }));
              }} />
          </div>
        ) : (
          <div className="text-center py-12">
            <AlertCircle size={24} className="mx-auto text-[var(--color-error)] mb-2" />
            <p className="text-[14px] font-medium text-[var(--color-error)]">Error in {meta.label}</p>
            {step.error && <p className="text-[12px] text-fg-muted mt-1 max-w-md mx-auto">{step.error}</p>}
            <button
              onClick={onComplete}
              className="mt-4 px-4 py-2 text-[12px] font-medium text-fg-muted hover:text-fg bg-surface-2 hover:bg-surface-1 rounded-[var(--radius-sm)] transition-colors cursor-pointer"
            >
              <RotateCcw size={12} className="inline mr-1.5" />
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pending step placeholder ───────────────────────────────

function PendingStep({ stepId }: { stepId: string }) {
  const meta = STEP_META[stepId];
  return (
    <div className="text-center py-10 text-fg-faint">
      <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center mx-auto mb-3 opacity-50">
        {meta?.icon || <Sparkles size={18} />}
      </div>
      <p className="text-[13px]">
        Waiting for previous steps to complete
      </p>
    </div>
  );
}

// ── Active step (the "working" state) ──────────────────────

function ActiveStep({
  stepId,
  config,
  brandName,
}: {
  stepId: string;
  config: ToolConfig;
  brandName: string;
}) {
  const { activeBrand: stepBrand } = useBrand();

  // Resolve selected asset names for display
  const selectedAvatar = stepBrand?.avatars?.find(
    (a) => a.id === config.selectedAvatarId
  );
  const selectedProduct = (stepBrand?.products || []).find(
    (p) => p.id === config.selectedProductId
  );

  // Show context-specific info for each step type
  if (stepId === "script") {
    return (
      <div className="space-y-4">
        <p className="text-[13px] text-fg-muted">
          Gemini will generate a script using{" "}
          <span className="text-fg font-medium">{brandName}</span>'s context,
          prompt template, and your settings.
        </p>

        {/* Selected assets summary */}
        <div className="flex gap-3 flex-wrap">
          {selectedAvatar && (
            <div className="flex items-center gap-2 bg-surface-2 rounded-[var(--radius-sm)] px-3 py-2">
              <div className="w-6 h-6 rounded-full bg-surface-0 overflow-hidden shrink-0">
                {selectedAvatar.imageUrl && (
                  <img
                    src={avatarImageUrl(selectedAvatar.imageUrl)}
                    alt={selectedAvatar.name}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div>
                <div className="text-[11px] text-fg-faint">Avatar</div>
                <div className="text-[12px] text-fg font-medium">
                  {selectedAvatar.name}
                </div>
              </div>
            </div>
          )}
          {selectedProduct && (
            <div className="flex items-center gap-2 bg-surface-2 rounded-[var(--radius-sm)] px-3 py-2">
              <div className="w-6 h-6 rounded bg-surface-0 overflow-hidden shrink-0">
                {selectedProduct.imageUrl && (
                  <img
                    src={productImageUrl(selectedProduct.imageUrl)}
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div>
                <div className="text-[11px] text-fg-faint">Product</div>
                <div className="text-[12px] text-fg font-medium">
                  {selectedProduct.name}
                </div>
              </div>
            </div>
          )}
          {!selectedAvatar && !selectedProduct && (
            <p className="text-[12px] text-fg-faint italic">
              No avatar or product selected — the script will be generic.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <InfoPill label="Tone" value={config.tone} />
          <InfoPill label="Platform" value={config.platform} />
          <InfoPill label="Language" value={config.language === "es" ? "Español" : "English"} />
          <InfoPill label="Objective" value={config.objective || "Not specified"} />
        </div>
        {config.notes && (
          <div className="bg-surface-2 rounded-[var(--radius-sm)] p-3 text-[12px] text-fg-muted">
            <span className="font-medium text-fg-secondary">Notes:</span>{" "}
            {config.notes}
          </div>
        )}
        <div className="bg-surface-0 border border-dashed border-edge rounded-[var(--radius-md)] p-6 text-center">
          <Type size={24} className="mx-auto text-fg-faint mb-2" />
          <p className="text-[12px] text-fg-faint">
            Script output will appear here after running
          </p>
        </div>
      </div>
    );
  }

  if (stepId === "base_image") {
    return (
      <div className="space-y-4">
        <p className="text-[13px] text-fg-muted">
          Nano Banana 2 will generate the <strong>hero image</strong> for the first scene using
          the script's image prompt + avatar + product.
        </p>
        <p className="text-[12px] text-fg-faint">
          This image sets the visual identity for all other scenes. Approve it before generating multishot variations.
        </p>

        {/* Avatar + product being used */}
        {(selectedAvatar || selectedProduct) && (
          <div className="flex gap-3">
            {selectedAvatar && (
              <div className="flex items-center gap-2 bg-surface-2 rounded-[var(--radius-sm)] px-3 py-2">
                <div className="w-6 h-6 rounded-full bg-surface-0 overflow-hidden shrink-0">
                  {selectedAvatar.imageUrl && (
                    <img src={avatarImageUrl(selectedAvatar.imageUrl)} alt={selectedAvatar.name} className="w-full h-full object-cover" />
                  )}
                </div>
                <span className="text-[11px] text-fg-muted">{selectedAvatar.name}</span>
              </div>
            )}
            {selectedProduct && (
              <div className="flex items-center gap-2 bg-surface-2 rounded-[var(--radius-sm)] px-3 py-2">
                <div className="w-6 h-6 rounded bg-surface-0 overflow-hidden shrink-0">
                  {selectedProduct.imageUrl && (
                    <img src={productImageUrl(selectedProduct.imageUrl)} alt={selectedProduct.name} className="w-full h-full object-cover" />
                  )}
                </div>
                <span className="text-[11px] text-fg-muted">{selectedProduct.name}</span>
              </div>
            )}
          </div>
        )}

        {/* Base image placeholder */}
        <div className="flex justify-center">
          <div className="w-48 aspect-[9/16] bg-surface-2 border-2 border-dashed border-edge rounded-[var(--radius-md)] flex items-center justify-center">
            <div className="text-center">
              <ImageIcon size={28} className="mx-auto text-fg-faint mb-2" />
              <p className="text-[11px] text-fg-faint">Imagen base</p>
              <p className="text-[10px] text-fg-faint">9:16</p>
            </div>
          </div>
        </div>

        <div className="bg-surface-2 rounded-[var(--radius-sm)] p-3 text-[11px] text-fg-faint text-center">
          Once approved, this image becomes the reference for all multishot variations.
        </div>
      </div>
    );
  }

  if (stepId === "multishot") {
    return (
      <div className="space-y-4">
        <p className="text-[13px] text-fg-muted">
          Using the approved base image as reference, Gemini generates{" "}
          <strong>{config.numVariations} UGC talking-head prompts</strong> with varied angles,
          lighting, and composition — all maintaining the same character identity.
        </p>
        <p className="text-[12px] text-fg-faint">
          Each prompt is optimized for Nano Banana 2 in 9:16 vertical format.
          Direct eye contact with camera is maintained across all frames.
        </p>

        {/* Multishot grid preview */}
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: Math.max(config.numVariations, 5) }, (_, i) => (
            <div
              key={i}
              className="aspect-[9/16] bg-surface-2 border border-dashed border-edge rounded-[var(--radius-sm)] flex items-center justify-center relative group"
            >
              <div className="text-center">
                <Camera size={16} className="mx-auto text-fg-faint mb-1" />
                <span className="text-[9px] text-fg-faint">Shot {i + 1}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-surface-2 rounded-[var(--radius-sm)] p-3 text-[11px] text-fg-faint">
          <strong>Prompt template:</strong> ugc_multishot — varies composition (close-up, medium shot, low angle),
          lighting (window light, rim light, studio), and gestures while keeping character consistent.
        </div>
      </div>
    );
  }

  if (stepId === "images" || stepId === "image" || stepId === "generate") {
    return (
      <div className="space-y-4">
        <p className="text-[13px] text-fg-muted">
          Nano Banana 2 will generate the image using avatar + product + scene prompt.
        </p>
        <div className="flex justify-center">
          <div className="w-48 aspect-[9/16] bg-surface-2 border border-dashed border-edge rounded-[var(--radius-md)] flex items-center justify-center">
            <div className="text-center">
              <ImageIcon size={20} className="mx-auto text-fg-faint mb-1" />
              <span className="text-[10px] text-fg-faint">Imagen generada</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (stepId === "curation") {
    return (
      <div className="space-y-4">
        <p className="text-[13px] text-fg-muted">
          Select the best shots for your video and arrange them in order.
          Drag to reorder — each position becomes a scene in your final video.
        </p>

        {/* Scene slots */}
        <div className="space-y-2">
          <h4 className="text-[11px] font-semibold text-fg-faint uppercase tracking-wider">
            Video Timeline
          </h4>
          {["Act 1: Hook", "Act 2: Story", "Act 3: Twist", "Act 4: CTA"].map(
            (act, i) => (
              <div
                key={act}
                className="flex items-center gap-3 bg-surface-2 rounded-[var(--radius-sm)] px-4 py-3 border border-dashed border-edge"
              >
                <span className="text-[11px] font-bold text-fg-faint w-5">
                  {i + 1}
                </span>
                <div className="w-10 h-16 bg-surface-0 border border-edge rounded-[var(--radius-sm)] flex items-center justify-center shrink-0">
                  <ImageIcon size={12} className="text-fg-faint" />
                </div>
                <div className="flex-1">
                  <div className="text-[12px] font-medium text-fg">{act}</div>
                  <div className="text-[10px] text-fg-faint">
                    Drop a shot here or click to assign
                  </div>
                </div>
              </div>
            )
          )}
        </div>

        <p className="text-[11px] text-fg-faint text-center">
          Only selected shots advance to voice & lip-sync — saving 60-70% on animation costs.
        </p>
      </div>
    );
  }

  if (stepId === "voice") {
    return (
      <div className="space-y-4">
        <p className="text-[13px] text-fg-muted">
          ElevenLabs will generate voiceover for each scene using the brand's
          voice preset.
        </p>
        <div className="grid grid-cols-1 gap-2">
          {["Act 1: Hook", "Act 2: Story", "Act 3: Twist", "Act 4: CTA"].map(
            (act) => (
              <div
                key={act}
                className="flex items-center gap-3 bg-surface-2 rounded-[var(--radius-sm)] px-4 py-3"
              >
                <Mic size={14} className="text-fg-faint" />
                <span className="text-[12px] text-fg-muted flex-1">
                  {act}
                </span>
                <span className="text-[10px] text-fg-faint">--:--</span>
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  if (stepId === "lipsync") {
    return (
      <div className="space-y-4">
        <p className="text-[13px] text-fg-muted">
          Fal Fabric 1.0 will animate the curated images with the generated
          audio — lip-sync + head movement.
        </p>
        <div className="bg-surface-0 border border-dashed border-edge rounded-[var(--radius-md)] p-6 text-center">
          <Video size={24} className="mx-auto text-fg-faint mb-2" />
          <p className="text-[12px] text-fg-faint">
            Animated video segments will appear here
          </p>
        </div>
        <p className="text-[11px] text-fg-faint">
          Only curated (best) images are animated — saving 60-70% on
          lip-sync costs.
        </p>
      </div>
    );
  }

  if (stepId === "subtitles") {
    return (
      <div className="space-y-4">
        <p className="text-[13px] text-fg-muted">
          Remotion will overlay auto-generated subtitles on the video segments.
        </p>
        <div className="bg-surface-0 border border-dashed border-edge rounded-[var(--radius-md)] p-6 text-center">
          <Type size={24} className="mx-auto text-fg-faint mb-2" />
          <p className="text-[12px] text-fg-faint">
            Subtitle timing and styles will be configured here
          </p>
        </div>
      </div>
    );
  }

  if (stepId === "render") {
    return (
      <div className="space-y-4">
        <p className="text-[13px] text-fg-muted">
          Final render: combine all animated segments with transitions and
          subtitles into the output video.
        </p>
        <div className="aspect-video bg-surface-2 border border-dashed border-edge rounded-[var(--radius-md)] flex items-center justify-center">
          <div className="text-center">
            <Film size={28} className="mx-auto text-fg-faint mb-2" />
            <p className="text-[12px] text-fg-faint">
              Final video preview
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Generic fallback
  const meta = STEP_META[stepId];
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-fg-muted">
        Ready to execute this step using {brandName}'s context and prompt
        templates.
      </p>
      <div className="bg-surface-0 border border-dashed border-edge rounded-[var(--radius-md)] p-8 text-center">
        <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center mx-auto mb-3">
          {meta?.icon || <Sparkles size={18} />}
        </div>
        <p className="text-[13px] text-fg-faint">
          Results will appear here after running
        </p>
      </div>
    </div>
  );
}

// ── Done step ──────────────────────────────────────────────

function DoneStep({ stepId, result, audioCache: audioCacheProp, getScriptScenes, config, allSteps = [], onUpdateStepResult }: {
  stepId: string;
  result?: unknown;
  audioCache?: Record<string, { url: string; blob: Blob }>;
  getScriptScenes?: () => Array<{ id: string; title: string; script: string; image_prompt: string; sceneType?: string; location?: string }>;
  config?: ToolConfig;
  allSteps?: StepState[];
  onUpdateStepResult?: (stepId: string, result: unknown) => void;
}) {
  const meta = STEP_META[stepId];
  const { activeBrand } = useBrand();

  // All hooks MUST be before any conditional returns (React Rules of Hooks)
  const [showBrief, setShowBrief] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editPromptText, setEditPromptText] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editRefUrls, setEditRefUrls] = useState<string[]>([]);
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [regenSceneId, setRegenSceneId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [selectedRefIdx, setSelectedRefIdx] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [sceneTypes, setSceneTypes] = useState<Record<string, "talking" | "creative">>({});
  const [selectedShots, setSelectedShots] = useState<Record<string, string>>({});

  // ── Avatar Creator: Brief step ───────────────────────────
  if (stepId === "brief" && result) {
    const brief = result as {
      name: string; age: string; gender: string; ethnicity: string;
      physical: string; style: string; personality: string; mood: string;
      image_prompt: string; avatarStyle?: string;
    };
    const fields = [
      { label: "Name", key: "name" },
      { label: "Age", key: "age" },
      { label: "Gender", key: "gender" },
      { label: "Ethnicity", key: "ethnicity" },
      { label: "Physical Description", key: "physical" },
      { label: "Style", key: "style" },
      { label: "Personality", key: "personality" },
      { label: "Mood / Expression", key: "mood" },
    ] as const;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Check size={14} className="text-[var(--color-success)]" />
          <span className="text-[13px] font-medium text-fg">Brief de avatar generado</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {fields.map(({ label, key }) => (
            <div key={key} className="space-y-1">
              <div className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider">{label}</div>
              <textarea
                defaultValue={(brief as Record<string, string>)[key] || ""}
                onChange={(e) => { (brief as Record<string, string>)[key] = e.target.value; }}
                rows={Math.max(1, Math.ceil(((brief as Record<string, string>)[key] || "").length / 40))}
                className="w-full text-[12px] text-fg bg-surface-2 border border-transparent hover:border-edge focus:border-[var(--color-warm)] rounded-[var(--radius-sm)] px-2 py-1.5 outline-none resize-none transition-colors"
              />
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <div className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider">Image Prompt (for generation)</div>
          <textarea
            defaultValue={brief.image_prompt || ""}
            onChange={(e) => { brief.image_prompt = e.target.value; }}
            rows={4}
            className="w-full text-[12px] text-fg-muted font-mono bg-surface-2 border border-transparent hover:border-edge focus:border-[var(--color-warm)] rounded-[var(--radius-sm)] p-3 outline-none resize-none transition-colors"
          />
        </div>
      </div>
    );
  }

  // ── Avatar Creator: Generate step ────────────────────────
  if (stepId === "generate" && result) {
    const gen = result as { url: string; styleLabel: string; brief: Record<string, string> };
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Check size={14} className="text-[var(--color-success)]" />
          <span className="text-[13px] font-medium text-fg">Reference sheet generated — {gen.styleLabel} style</span>
        </div>
        {gen.url && (
          <div className="rounded-[var(--radius-md)] overflow-hidden border border-edge bg-surface-2">
            <img src={gen.url} alt="Avatar reference sheet" className="w-full object-contain" />
          </div>
        )}
        <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-3 text-[12px] text-fg-muted">
          <span className="font-medium text-fg">{gen.brief?.name}</span>
          {gen.brief?.age && <span className="text-fg-faint"> · {gen.brief.age}</span>}
          {gen.brief?.personality && <span className="text-fg-faint"> · {gen.brief.personality}</span>}
        </div>
        <p className="text-[11px] text-fg-faint">Approve to save this avatar to your brand library. It will be available in UGC Creator and other tools immediately.</p>
      </div>
    );
  }

  // ── Avatar Creator: Save step ─────────────────────────────
  if (stepId === "save" && result) {
    const saved = result as { name: string; imageUrl: string; brief: Record<string, string> };
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-[var(--color-success)]">
          <Check size={16} />
          <span className="text-[14px] font-semibold">Avatar saved to brand library</span>
        </div>
        {saved.imageUrl && (
          <img src={saved.imageUrl} alt={saved.name} className="w-32 h-32 object-cover rounded-[var(--radius-md)] border border-edge" />
        )}
        <div className="text-[13px] text-fg">
          <span className="font-medium">{saved.name}</span>
          <span className="text-fg-faint ml-2">is now available in Avatar Creator across all tools.</span>
        </div>
      </div>
    );
  }

  // Script step — storyboard view
  if (stepId === "script" && result) {
    const raw = result as Record<string, unknown>;
    let scenes: Array<{ id: string; title: string; script: string; image_prompt: string }> = [];
    let brief: string | null = null;

    // Video Ad Creator format: { frames: [...], style, numScenes }
    if (raw.frames && Array.isArray(raw.frames)) {
      const frames = raw.frames as Array<Record<string, unknown>>;
      scenes = frames.map((f, i) => ({
        id: `frame_${i + 1}`,
        title: `Frame ${i + 1} — ${String(f.scene_type || "scene")}`,
        script: String(f.script || f.voiceover || ""),
        image_prompt: String(f.prompt || ""),
      }));
      const fullScript = frames.map((f) => String(f.script || f.voiceover || "")).filter(Boolean).join(" ");
      brief = `Style: ${raw.style || "N/A"}\n\nFull Script:\n${fullScript}`;
    }
    // UGC format: { scenes: [[...]], brief }
    else if (raw.scenes) {
      const arr = raw.scenes as Array<unknown>;
      // Handle both nested [[...]] (UGC) and flat [...] (Fashion Reel, other tools)
      const rawScenes: Array<Record<string, unknown>> = Array.isArray(arr[0])
        ? (arr[0] as Array<Record<string, unknown>>)
        : (arr as Array<Record<string, unknown>>);
      console.log("[DoneStep/script] rawScenes count:", rawScenes.length, "| first scene keys:", rawScenes[0] ? Object.keys(rawScenes[0]) : "empty", "| first script:", String(rawScenes[0]?.script || "").slice(0, 60));
      // Normalize field names onto the raw objects so mutations propagate back to step result
      rawScenes.forEach((s, i) => {
        if (!s.id) s.id = s.scene_number || `act_${i + 1}`;
        if (!s.title) s.title = s.act || `Scene ${i + 1}`;
        if (!s.script) {
          let t = String(s.speech || s.copy || s.text || s.audio || s.dialogue
            || s.narration || s.voiceover || s.action || s.spoken || s.line || s.lines || "");
          t = t.replace(/^(AVATAR|OFF[- ]?CAMERA|ON[- ]?CAMERA|NARRATOR|SPEAKER)\s*(\([^)]*\)\s*)?:\s*/i, "").trim();
          s.script = t;
        }
        if (!s.image_prompt) {
          const ip = String(s.visuals || s.visual || s.visual_prompt
            || s.scene_description || s.setting || s.background || s.scene || "");
          s.image_prompt = ip && isNaN(Number(ip)) ? ip : "";
        }
        // Normalize location field
        if (!s.location && s.setting && s.setting !== s.image_prompt) {
          s.location = s.setting;
        }
        // Normalize narrative scene types — store original in narrativeSceneType,
        // map to "creative" in sceneType for downstream handlers (lipsync, multishot)
        const rawST = String(s.sceneType || "");
        if (rawST && ["lifestyle", "sensorial", "product_reveal"].includes(rawST)) {
          s.narrativeSceneType = rawST;   // keep full type for display
          s.sceneType = "creative";        // downstream lipsync/multishot treat as creative
        }
      });
      scenes = rawScenes.map((s) => s as unknown as { id: string; title: string; script: string; image_prompt: string; sceneType?: "talking" | "creative"; narrativeSceneType?: string; location?: string });
      brief = (raw.brief as string) || null;
    } else if (Array.isArray(result)) {
      const arr = (result as Array<Array<Record<string, string>>>)[0] || [];
      scenes = arr.map((s, i) => ({
        id: s.id || s.scene_number || `act_${i + 1}`,
        title: s.title || s.act || `Scene ${i + 1}`,
        script: s.script || s.speech || s.copy || s.text || s.audio || s.dialogue || s.narration || s.voiceover || "",
        image_prompt: s.image_prompt || s.visuals || s.visual || s.visual_prompt || s.scene_description || "",
      }));
    }

    // Context info from config
    const ctxAvatar = config && activeBrand?.avatars?.find((a) => a.id === config.selectedAvatarId);
    const ctxProduct = config && (activeBrand?.products || []).find((p) => p.id === config.selectedProductId);

    return (
      <div className="space-y-4">
        {/* Character context bar */}
        {(ctxAvatar || ctxProduct || activeBrand) && (
          <div className="flex items-center gap-3 px-3 py-2.5 bg-surface-2 border border-edge rounded-[var(--radius-md)]">
            {ctxAvatar?.imageUrl && (
              <img src={ctxAvatar.imageUrl} alt={ctxAvatar.name} className="w-8 h-8 rounded-full object-cover border border-edge shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {ctxAvatar && (
                  <span className="text-[11px] font-medium text-fg">{ctxAvatar.name}</span>
                )}
                {ctxProduct && (
                  <>
                    <span className="text-fg-faint text-[10px]">·</span>
                    <span className="text-[11px] text-fg-muted">{ctxProduct.name}</span>
                  </>
                )}
                {activeBrand && (
                  <>
                    <span className="text-fg-faint text-[10px]">·</span>
                    <span className="text-[11px] text-fg-faint">{activeBrand.name}</span>
                  </>
                )}
              </div>
              {ctxAvatar?.description && (
                <p className="text-[10px] text-fg-faint mt-0.5 truncate">{ctxAvatar.description}</p>
              )}
            </div>
            {ctxProduct?.imageUrl && (
              <img src={ctxProduct.imageUrl} alt={ctxProduct.name} className="w-8 h-8 rounded object-cover border border-edge shrink-0" />
            )}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-2">
          <Check size={14} className="text-[var(--color-success)]" />
          <span className="text-[13px] font-medium text-fg">
            Script generated — {scenes.length} scenes
          </span>
        </div>

        {/* Creative concept — shown prominently when available */}
        {brief && !brief.includes("Full Script:") && (
          <div className="border border-[var(--color-warm)]/30 bg-[var(--color-warm)]/5 rounded-[var(--radius-md)] p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Film size={11} className="text-[var(--color-warm)]" />
              <span className="text-[10px] font-semibold text-[var(--color-warm)] uppercase tracking-wider">Historia del video</span>
            </div>
            <p className="text-[13px] text-fg leading-relaxed italic">{brief}</p>
          </div>
        )}

        {/* Full script brief (Video Ad Creator) */}
        {brief && brief.includes("Full Script:") && (
          <div className="bg-surface-2 border border-edge rounded-[var(--radius-md)] p-4">
            <h4 className="text-[11px] font-semibold text-fg-faint uppercase tracking-wider mb-2">Narrative</h4>
            <pre className="text-[12px] text-fg-muted whitespace-pre-wrap leading-relaxed">{brief}</pre>
          </div>
        )}

        {/* Storyboard scenes */}
        {scenes.map((scene, i) => {
          type AllSceneTypes = "talking" | "creative" | "lifestyle" | "sensorial" | "product_reveal";

          // narrativeSceneType is set in normalization above for lifestyle/sensorial/product_reveal
          // sceneType (raw object) is always "talking" | "creative" for downstream handlers
          const narrativeType = (scene as Record<string, unknown>).narrativeSceneType as AllSceneTypes | undefined;
          const aiDownstream = (scene as Record<string, unknown>).sceneType as "talking" | "creative" | undefined;

          // Display type: user state override → narrative type from AI → downstream type → talking
          const displayType: AllSceneTypes = (sceneTypes[scene.id] as AllSceneTypes)
            ?? narrativeType
            ?? aiDownstream
            ?? "talking";

          const sceneLocation = (scene as Record<string, unknown>).location as string | undefined;
          const isCreativeFamily = displayType !== "talking";

          const SCENE_TYPE_CONFIG: Record<AllSceneTypes, { label: string; color: string; activeBg: string }> = {
            talking: { label: "Talking", color: "bg-[var(--color-warm)]", activeBg: "bg-[var(--color-warm)]/5" },
            creative: { label: "Creative", color: "bg-blue-500", activeBg: "bg-blue-500/5" },
            lifestyle: { label: "Lifestyle", color: "bg-emerald-500", activeBg: "bg-emerald-500/5" },
            sensorial: { label: "Sensorial", color: "bg-purple-500", activeBg: "bg-purple-500/5" },
            product_reveal: { label: "Product", color: "bg-amber-500", activeBg: "bg-amber-500/5" },
          };
          const typeConfig = SCENE_TYPE_CONFIG[displayType];

          const setSceneType = (type: AllSceneTypes) => {
            setSceneTypes((prev) => ({ ...prev, [scene.id]: type }));
            // Map narrative types to "creative" for downstream lipsync/multishot handlers
            const downstreamType = (type === "lifestyle" || type === "sensorial" || type === "product_reveal") ? "creative" : type;
            (scene as Record<string, unknown>).sceneType = downstreamType;
            (scene as Record<string, unknown>).narrativeSceneType = type === downstreamType ? undefined : type;
          };

          const hasAiSuggestion = (narrativeType || aiDownstream) && !sceneTypes[scene.id];

          return (
          <div key={scene.id} className={`border rounded-[var(--radius-md)] overflow-hidden transition-colors ${
            isCreativeFamily ? "border-blue-500/30" : "border-edge"
          }`}>
            {/* Scene header */}
            <div className={`px-4 py-2.5 border-b border-edge flex items-center justify-between ${typeConfig.activeBg}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold text-fg-faint tabular-nums bg-surface-1 border border-edge rounded px-1.5 py-0.5">{i + 1}</span>
                <span className="text-[12px] font-semibold text-fg">{scene.title}</span>
                {/* Scene type toggle */}
                <div className="flex items-center rounded border border-edge overflow-hidden ml-1">
                  {(["talking", "creative", "lifestyle", "sensorial", "product_reveal"] as AllSceneTypes[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setSceneType(t)}
                      className={`px-2 py-0.5 text-[9px] font-medium transition-colors cursor-pointer ${
                        displayType === t
                          ? `${SCENE_TYPE_CONFIG[t].color} text-white`
                          : "bg-surface-1 text-fg-muted hover:text-fg"
                      }`}
                    >
                      {SCENE_TYPE_CONFIG[t].label}
                    </button>
                  ))}
                </div>
                {hasAiSuggestion && (
                  <span className="text-[9px] text-fg-faint italic">IA</span>
                )}
                {/* Avatar on/off toggle */}
                <AvatarToggle scene={scene} />
                {/* Location chip (narrative mode) */}
                {sceneLocation && (
                  <span className="text-[9px] text-fg-faint bg-surface-2 border border-edge rounded px-1.5 py-0.5 max-w-[160px] truncate" title={sceneLocation}>
                    📍 {sceneLocation}
                  </span>
                )}
              </div>
              <select
                value={selectedShots[scene.id] || ""}
                onChange={(e) => {
                  const shotMap: Record<string, string> = {
                    "": "",
                    "close-up": "Shot on 50mm f/1.4, tight close-up, face fills 60% of frame.",
                    "medium-close": "Shot on 50mm f/1.8, medium-close, chest up.",
                    "medium": "Shot on 35mm f/1.8, medium shot, waist up, product clearly visible.",
                    "full-body": "Shot on 35mm f/2.8, full body visible, head to toe.",
                    "wide": "Shot on 24mm f/2.8, wide shot, person and environment visible.",
                    "hands": "Shot on 50mm f/2.0, close-up of hands interacting with product.",
                    "product-only": "Shot on 85mm f/2.0, close-up of product only, no person.",
                    "overhead": "Shot from directly above, overhead flat-lay angle.",
                  };
                  const val = e.target.value;
                  setSelectedShots((prev) => ({ ...prev, [scene.id]: val }));
                  const shot = shotMap[val];
                  if (shot) {
                    const replaced = scene.image_prompt.replace(/Shot on \d+mm[^.]*\.|Shot from [^.]*\./i, shot);
                    scene.image_prompt = replaced !== scene.image_prompt ? replaced : `${scene.image_prompt} ${shot}`;
                  }
                }}
                className="h-6 px-1.5 rounded border border-edge bg-surface-1 text-[9px] text-fg-muted outline-none cursor-pointer"
              >
                <option value="">Shot type...</option>
                <option value="close-up">Close-up</option>
                <option value="medium-close">Medium Close</option>
                <option value="medium">Medium</option>
                <option value="full-body">Full Body</option>
                <option value="wide">Wide</option>
                <option value="hands">Hands</option>
                <option value="product-only">Product Only</option>
                <option value="overhead">Overhead</option>
              </select>
            </div>

            <div className="grid grid-cols-2 divide-x divide-edge">
              {/* Script column */}
              <div className="p-3 space-y-1">
                <div className="flex items-center gap-1.5 mb-2">
                  <Mic size={10} className="text-fg-faint" />
                  <span className="text-[9px] font-semibold text-fg-faint uppercase tracking-wider">Script</span>
                </div>
                <textarea
                  defaultValue={scene.script}
                  onChange={(e) => { scene.script = e.target.value; }}
                  rows={Math.max(3, Math.ceil(scene.script.length / 40))}
                  className="w-full text-[12px] text-fg leading-relaxed bg-transparent border border-transparent hover:border-edge focus:border-[var(--color-warm)] rounded-[var(--radius-sm)] px-2 py-1 outline-none resize-none transition-colors"
                />
              </div>

              {/* Visual direction column */}
              <div className="p-3 space-y-1 bg-surface-1/50">
                <div className="flex items-center gap-1.5 mb-2">
                  <Camera size={10} className="text-fg-faint" />
                  <span className="text-[9px] font-semibold text-fg-faint uppercase tracking-wider">
                    Visual{i === 0 ? " · base image" : ""}
                  </span>
                </div>
                {scene.image_prompt ? (
                  <textarea
                    defaultValue={scene.image_prompt}
                    onChange={(e) => { scene.image_prompt = e.target.value; }}
                    rows={Math.max(3, Math.ceil(scene.image_prompt.length / 40))}
                    className="w-full text-[11px] text-fg-muted leading-relaxed bg-transparent border border-transparent hover:border-edge focus:border-[var(--color-warm)] rounded-[var(--radius-sm)] px-2 py-1 outline-none resize-none transition-colors font-mono"
                  />
                ) : (
                  <p className="text-[11px] text-fg-faint italic px-2">Auto-generated from script</p>
                )}
              </div>
            </div>

            {/* Per-scene background override */}
            <div className="px-3 py-2 border-t border-edge bg-surface-1/40 flex items-center gap-2 flex-wrap">
              <Mountain size={10} className="text-fg-faint" />
              <span className="text-[9px] font-semibold text-fg-faint uppercase tracking-wider">Fondo de esta escena</span>
              <select
                defaultValue={scene.backgroundId === null ? "__none__" : scene.backgroundId || ""}
                onChange={(e) => {
                  const v = e.target.value;
                  scene.backgroundId = v === "" ? undefined : v === "__none__" ? null : v;
                }}
                className="h-6 px-1.5 rounded border border-edge bg-surface-1 text-[10px] text-fg-muted outline-none cursor-pointer"
              >
                <option value="">Usar el del ConfigPanel</option>
                <option value="__none__">Sin fondo (solo texto)</option>
                {(activeBrand?.backgrounds || []).map((bg) => (
                  <option key={bg.id} value={bg.id}>{bg.name}</option>
                ))}
              </select>
              <span className="text-[9px] text-fg-faint italic ml-auto">
                {scene.backgroundId === null ? "Nano Banana genera solo desde el prompt" :
                 scene.backgroundId ? "Usa esta imagen como referencia visual" :
                 "Hereda del ConfigPanel global"}
              </span>
            </div>
          </div>
          );
        })}
      </div>
    );
  }

  // Base image step — show generated image + inputs used + lightbox + edit
  if (stepId === "base_image" && result) {
    const img = result as {
      url: string;
      prompt: string;
      scriptText?: string;
      entryFrameUrl?: string;
      inputs?: {
        avatar: { name: string; imageUrl: string } | null;
        product: { name: string; imageUrl: string } | null;
        clothing: Array<{ name: string; imageUrl: string }>;
        background: { name: string; imageUrl: string } | null;
      };
    };
    const inputs = img.inputs;

    const handleEdit = async () => {
      if (!editPromptText.trim()) return;
      setEditLoading(true);
      try {
        // Pass current image + user-selected refs
        const editRefs = [img.url, ...editRefUrls];
        const job = await createImageEdit(editRefs, editPromptText.trim(), config?.aspectRatio || "9:16", config?.resolution || "1K");
        const editResult = await pollImageGen(job.request_id);
        if (editResult.image_url) {
          (result as { url: string }).url = editResult.image_url;
          // Persist the updated base image URL in steps state
          if (onUpdateStepResult) {
            onUpdateStepResult("base_image", { ...(result as Record<string, unknown>), url: editResult.image_url });
          }
          setEditMode(false);
          setEditPromptText("");
        }
      } catch { /* silent */ } finally {
        setEditLoading(false);
      }
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Check size={14} className="text-[var(--color-success)]" />
          <span className="text-[13px] font-medium text-fg">Base image generated — this is your Scene 1</span>
        </div>

        <div className="flex gap-5">
          {/* Generated image — clickable for lightbox */}
          <div className="w-56 shrink-0 space-y-2">
            <button
              onClick={() => setShowLightbox(true)}
              className="w-full aspect-[9/16] rounded-[var(--radius-md)] overflow-hidden border-2 border-edge cursor-pointer hover:border-[var(--color-warm)] transition-colors relative group"
            >
              <img src={img.url} alt="Base image" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <Eye size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
            {/* Script text */}
            {img.scriptText && (
              <div className="bg-surface-2 rounded-[var(--radius-sm)] p-2.5">
                <p className="text-[11px] text-fg-muted leading-relaxed">&ldquo;{img.scriptText}&rdquo;</p>
              </div>
            )}

            <div className="flex gap-1.5">
              <button
                onClick={() => setEditMode(!editMode)}
                className="flex-1 text-[10px] text-fg-muted hover:text-fg bg-surface-2 hover:bg-surface-3 rounded-[var(--radius-sm)] py-1.5 transition-colors cursor-pointer text-center"
              >
                {editMode ? "Cancel" : "Edit"}
              </button>
            </div>
          </div>

          {/* Inputs used */}
          <div className="flex-1 space-y-3">
            <h4 className="text-[11px] font-semibold text-fg-faint uppercase tracking-wider">Inputs usados</h4>

            {inputs?.avatar && (
              <div className="flex items-center gap-2.5 bg-surface-2 rounded-[var(--radius-sm)] px-3 py-2">
                <div className="w-8 h-8 rounded-full bg-surface-0 overflow-hidden shrink-0">
                  <img src={avatarImageUrl(inputs.avatar.imageUrl)} alt="" className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="text-[10px] text-fg-faint">Avatar</div>
                  <div className="text-[12px] text-fg font-medium">{inputs.avatar.name}</div>
                </div>
              </div>
            )}

            {inputs?.product && (
              <div className="flex items-center gap-2.5 bg-surface-2 rounded-[var(--radius-sm)] px-3 py-2">
                <div className="w-8 h-8 rounded bg-surface-0 overflow-hidden shrink-0">
                  <img src={productImageUrl(inputs.product.imageUrl)} alt="" className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="text-[10px] text-fg-faint">Product</div>
                  <div className="text-[12px] text-fg font-medium">{inputs.product.name}</div>
                </div>
              </div>
            )}

            {inputs?.clothing && inputs.clothing.length > 0 && inputs.clothing.map((c, i) => (
              <div key={i} className="flex items-center gap-2.5 bg-surface-2 rounded-[var(--radius-sm)] px-3 py-2">
                <div className="w-8 h-8 rounded bg-surface-0 overflow-hidden shrink-0">
                  <img src={clothingImageUrl(c.imageUrl)} alt="" className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="text-[10px] text-fg-faint">Clothing</div>
                  <div className="text-[12px] text-fg font-medium">{c.name}</div>
                </div>
              </div>
            ))}

            {inputs?.background && (
              <div className="flex items-center gap-2.5 bg-surface-2 rounded-[var(--radius-sm)] px-3 py-2">
                <div className="w-8 h-8 rounded bg-surface-0 overflow-hidden shrink-0">
                  <img src={backgroundImageUrl(inputs.background.imageUrl)} alt="" className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="text-[10px] text-fg-faint">Fondo</div>
                  <div className="text-[12px] text-fg font-medium">{inputs.background.name}</div>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowPrompt(!showPrompt)}
              className="text-[11px] text-fg-muted hover:text-fg transition-colors cursor-pointer underline"
            >
              {showPrompt ? "Hide prompt" : "Show prompt used"}
            </button>

            {showPrompt && (
              <div className="bg-surface-2 rounded-[var(--radius-sm)] p-3 max-h-32 overflow-y-auto">
                <p className="text-[11px] text-fg-muted font-mono leading-relaxed">{img.prompt}</p>
              </div>
            )}
          </div>
        </div>

        {/* Entry frame — shown whenever a hook is configured or manually generated */}
        {/* In FOOH mode: auto-generated — show preview only if already set, no manual picker */}
        {config?.hookMode === "fooh" && img.entryFrameUrl ? (
          <div className="mt-3 border border-dashed border-purple-500/30 rounded-[var(--radius-sm)] p-2.5 space-y-2">
            <div className="flex items-center gap-1.5">
              <Video size={10} className="text-purple-400" />
              <span className="text-[10px] font-medium text-purple-400">FOOH Entry Frame</span>
              <span className="text-[9px] text-fg-faint">— Escena surrealist → Kling transición → UGC</span>
            </div>
            <div className="space-y-1.5">
              <div className="w-24 h-40 rounded overflow-hidden border border-purple-500/40">
                <img src={img.entryFrameUrl} alt="FOOH entry frame" className="w-full h-full object-cover" />
              </div>
              <div className="flex items-center gap-3">
                <p className="text-[10px] text-fg-muted">FOOH frame ready — animación Kling se genera en el siguiente paso</p>
                <button
                  onClick={() => onUpdateStepResult?.("base_image", { ...(result as Record<string, unknown>), entryFrameUrl: undefined })}
                  className="text-[9px] text-fg-faint hover:text-red-400 cursor-pointer"
                >Remove</button>
              </div>
            </div>
          </div>
        ) : config?.hookMode !== "fooh" && allSteps.some((s) => s.id === "lipsync") ? (
          <EntryFramePanel
            sceneId="scene_1"
            entryFrameUrl={img.entryFrameUrl}
            avatarUrl={img.url}
            backgroundUrl={inputs?.background?.imageUrl ? backgroundImageUrl(inputs.background.imageUrl) : undefined}
            onGenerated={(url) => {
              if (onUpdateStepResult) {
                onUpdateStepResult("base_image", { ...(result as Record<string, unknown>), entryFrameUrl: url });
              }
            }}
            onRemove={() => {
              if (onUpdateStepResult) {
                onUpdateStepResult("base_image", { ...(result as Record<string, unknown>), entryFrameUrl: undefined });
              }
            }}
          />
        ) : null}

        {/* Edit form with product selector */}
        {editMode && (
          <div className="bg-surface-2 rounded-[var(--radius-md)] p-4 space-y-3">
            {/* Quick actions */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setEditPromptText("Replace the product with the product from the reference images. Keep the person, pose, background, and lighting identical.")}
                className="text-[10px] px-2.5 py-1 bg-[var(--color-warm-muted)] text-[var(--color-warm)] rounded-full cursor-pointer hover:opacity-80"
              >
                Fix Product
              </button>
              <button
                onClick={() => setEditPromptText("Make the clothing match the reference images exactly — same color, design, and fit.")}
                className="text-[10px] px-2.5 py-1 bg-surface-3 text-fg-muted rounded-full cursor-pointer hover:text-fg"
              >
                Fix Clothing
              </button>
              <button
                onClick={() => setEditPromptText("Make the lighting warmer and more natural.")}
                className="text-[10px] px-2.5 py-1 bg-surface-3 text-fg-muted rounded-full cursor-pointer hover:text-fg"
              >
                Warmer Light
              </button>
            </div>

            {/* Product/clothing image picker */}
            {activeBrand && (activeBrand.products?.length || 0) + (activeBrand.clothing?.length || 0) > 0 && (
              <div className="space-y-1.5">
                <span className="text-[9px] font-medium text-fg-faint uppercase tracking-wider">Reference images (click to include)</span>
                <div className="flex gap-1.5 flex-wrap">
                  {(activeBrand.products || []).flatMap((p) => [
                    { url: p.imageUrl, label: p.name, resolver: productImageUrl },
                    ...(p.images || []).map((img) => ({ url: img.imageUrl, label: img.label || p.name, resolver: productImageUrl })),
                  ]).map((ref, idx) => {
                    const isIncluded = editRefUrls.includes(ref.url);
                    return (
                      <button
                        key={idx}
                        onClick={() => setEditRefUrls((prev) =>
                          prev.includes(ref.url) ? prev.filter((u) => u !== ref.url) : [...prev, ref.url]
                        )}
                        className={cn(
                          "w-10 h-10 rounded overflow-hidden border-2 cursor-pointer transition-all",
                          isIncluded ? "border-[var(--color-warm)]" : "border-edge opacity-50 hover:opacity-100"
                        )}
                        title={ref.label}
                      >
                        <img src={ref.resolver(ref.url)} alt={ref.label} className="w-full h-full object-cover" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Prompt input */}
            <div className="flex items-center gap-2">
              <input
                value={editPromptText}
                onChange={(e) => setEditPromptText(e.target.value)}
                placeholder="Describí qué cambiar..."
                className="flex-1 h-8 px-3 rounded-[var(--radius-sm)] border border-edge bg-surface-1 text-[12px] text-fg placeholder:text-fg-faint outline-none"
                onKeyDown={(e) => e.key === "Enter" && handleEdit()}
              />
              <button
                onClick={handleEdit}
                disabled={editLoading || !editPromptText.trim()}
                className={cn(
                  "px-4 py-2 text-[11px] font-medium rounded-[var(--radius-sm)] transition-colors",
                  !editLoading && editPromptText.trim()
                    ? "text-[var(--color-warm-fg)] bg-[var(--color-warm)] hover:opacity-90 cursor-pointer"
                    : "text-fg-faint bg-surface-1 cursor-not-allowed"
                )}
              >
                {editLoading ? <Loader2 size={12} className="animate-spin" /> : "Apply"}
              </button>
            </div>
          </div>
        )}

        {/* Lightbox */}
        {showLightbox && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8 cursor-pointer"
            onClick={() => setShowLightbox(false)}
          >
            <img
              src={img.url}
              alt="Base image full size"
              className="max-h-full max-w-full object-contain rounded-[var(--radius-md)]"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    );
  }

  // Multishot step — grid of 2 variations per scene
  if (stepId === "multishot" && result) {
    // After approval, result becomes { variations: [...], selections: [...] }
    const rawResult = result as { variations?: Array<unknown>; selections?: Array<unknown> } | Array<unknown>;
    const scenes = (Array.isArray(rawResult) ? rawResult : (rawResult as { variations?: Array<unknown> }).variations || []) as Array<{
      sceneId: string;
      title: string;
      sceneType?: "talking" | "creative";
      variations: Array<{ id: string; url: string; label: string }>;
    }>;
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <Check size={14} className="text-[var(--color-success)]" />
          <span className="text-[13px] font-medium text-fg">
            {scenes.length} scenes × {scenes[0]?.variations.length || 0} variations generated
          </span>
        </div>
        {scenes.map((scene) => (
          <div key={scene.sceneId} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-fg-muted truncate">{scene.title}</span>
              <span className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide shrink-0",
                scene.sceneType === "creative"
                  ? "bg-blue-500/15 text-blue-400"
                  : "bg-[var(--color-warm-muted)] text-[var(--color-warm)]"
              )}>
                {scene.sceneType === "creative" ? <Film size={8} /> : <Mic size={8} />}
                {scene.sceneType === "creative" ? "Creative" : "Talking"}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {scene.variations.map((v) => (
                <div key={v.id} className="space-y-1">
                  <div className="relative">
                    <div className="aspect-[9/16] rounded-[var(--radius-sm)] overflow-hidden border border-edge">
                      <img src={v.url} alt={v.label} className="w-full h-full object-cover" />
                    </div>
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 rounded-b-[var(--radius-sm)]">
                      <div className="text-[9px] text-white font-medium">{v.label}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <p className="text-[11px] text-fg-faint text-center">
          Select your preferred variation for each scene in the next step.
        </p>
      </div>
    );
  }

  // Curation step — show selections summary (after approval)
  if (stepId === "curation" && result) {
    const picks = result as Array<{
      sceneId: string;
      title: string;
      selectedUrl: string;
    }>;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Check size={14} className="text-[var(--color-success)]" />
          <span className="text-[13px] font-medium text-fg">
            {picks.length} scenes selected
          </span>
        </div>
        <CurationFixGrid picks={picks} brand={activeBrand!} config={config!} />
      </div>
    );
  }

  // Voice step — show audio segments with play buttons
  if (stepId === "voice" && result) {
    // Video Ad Creator format: { audioSegments: [...] }
    const raw = result as Record<string, unknown>;
    const audioSegs = raw.audioSegments as Array<{ frame: number; script: string; audioUrl: string }> | undefined;

    if (audioSegs) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Check size={14} className="text-[var(--color-success)]" />
            <span className="text-[13px] font-medium text-fg">
              {audioSegs.filter((s) => s.audioUrl).length}/{audioSegs.length} audio segments generated
            </span>
          </div>
          <div className="space-y-2">
            {audioSegs.map((seg) => (
              <div key={seg.frame} className="bg-surface-0 border border-edge rounded-[var(--radius-sm)] px-4 py-3 flex items-center gap-3">
                <span className="text-[10px] font-bold text-fg-faint w-6 shrink-0">F{seg.frame}</span>
                <p className="flex-1 text-[12px] text-fg-muted leading-relaxed">&ldquo;{seg.script}&rdquo;</p>
                {seg.audioUrl ? (
                  <button
                    onClick={() => {
                      const audio = new Audio(seg.audioUrl);
                      audio.play();
                    }}
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-sm)] text-[10px] font-medium bg-surface-2 text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors cursor-pointer"
                  >
                    <Play size={10} />
                    Play
                  </button>
                ) : (
                  <span className="text-[10px] text-fg-faint">Sin audio</span>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    // UGC format — voice results with playback + edit + regenerate
    const segments = result as Array<{ sceneId: string; title: string; script: string; audioUrl: string; duration: string; text?: string }>;
    if (!Array.isArray(segments)) return null;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Check size={14} className="text-[var(--color-success)]" />
          <span className="text-[13px] font-medium text-fg">
            {segments.filter((s) => s.audioUrl).length}/{segments.length} audio segments generated
          </span>
        </div>
        <div className="space-y-2">
          {segments.map((seg) => (
            <div key={seg.sceneId} className="bg-surface-0 border border-edge rounded-[var(--radius-sm)] px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mic size={12} className="text-fg-muted" />
                  <span className="text-[12px] font-medium text-fg">{seg.title}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {seg.audioUrl && (
                    <>
                      <button
                        onClick={() => {
                          const audio = new Audio(seg.audioUrl);
                          audio.play();
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-sm)] text-[10px] font-medium bg-surface-2 text-fg-muted hover:text-fg hover:bg-surface-3 cursor-pointer"
                      >
                        <Play size={10} /> Play
                      </button>
                      <a
                        href={seg.audioUrl}
                        download={`${seg.title || seg.sceneId || "audio"}.mp3`}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-sm)] text-[10px] font-medium bg-surface-2 text-fg-muted hover:text-fg hover:bg-surface-3 cursor-pointer"
                        title="Download audio"
                      >
                        <Download size={10} />
                      </a>
                    </>
                  )}
                  <button
                    onClick={async (e) => {
                      const btn = e.currentTarget;
                      btn.textContent = "⏳...";
                      try {
                        const vid = config?.selectedVoiceId || activeBrand?.voicePresets?.[0]?.id;
                        const scriptText = seg.script || seg.text || "";
                        // Single call: generate + upload to Fal — same audio for preview and lipsync
                        const { fal_url } = await generateTTSAndUpload({ text: scriptText, voice_id: vid });
                        // Use fal_url as audioUrl too — it's a public HTTP URL the browser can play
                        seg.audioUrl = fal_url;
                        (seg as Record<string, unknown>).falUrl = fal_url;
                        seg.script = scriptText;
                        // Persist the updated voice results in steps state
                        if (onUpdateStepResult) {
                          onUpdateStepResult("voice", [...segments]);
                        }
                        new Audio(fal_url).play();
                      } catch (err) {
                        console.error("[voice regen] failed:", err);
                        btn.textContent = "✗ Error";
                        setTimeout(() => { btn.textContent = "↻ Regen"; }, 2000);
                        return;
                      }
                      btn.textContent = "↻ Regen";
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded-[var(--radius-sm)] text-[10px] text-fg-faint hover:text-fg bg-surface-2 hover:bg-surface-3 cursor-pointer"
                  >
                    <RotateCcw size={9} /> Regen
                  </button>
                </div>
              </div>
              <textarea
                defaultValue={seg.script || seg.text || ""}
                onChange={(e) => {
                  seg.script = e.target.value;
                }}
                onBlur={() => {
                  // Persist text edits to steps state when user finishes editing
                  if (onUpdateStepResult) {
                    onUpdateStepResult("voice", [...segments]);
                  }
                }}
                rows={2}
                className="w-full text-[12px] text-fg-muted leading-relaxed bg-transparent border border-transparent hover:border-edge focus:border-[var(--color-warm)] rounded-[var(--radius-sm)] px-2 py-1 outline-none resize-none transition-colors"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Lip-sync step — show videos + voice controls per scene
  if (stepId === "lipsync" && result) {
    const segments = result as Array<{
      sceneId: string;
      title: string;
      scriptText?: string;
      videoUrl: string;
      hookVideoUrl?: string;
      imageUrl?: string;
    }>;

    // Local cache of latest voice data — survives React re-render closures
    const latestVoice: Record<string, { audioUrl: string; falUrl: string }> = {};

    const getVoiceEntry = (sceneId: string) => {
      // Check local cache first (updated by regen), then allSteps
      if (latestVoice[sceneId]) return latestVoice[sceneId];
      const voiceData = allSteps?.find((s) => s.id === "voice")?.result as Array<{
        sceneId: string; script: string; audioUrl: string; falUrl: string;
      }> | undefined;
      const entry = Array.isArray(voiceData) ? voiceData.find((v) => v.sceneId === sceneId) : undefined;
      return entry || null;
    };

    const handlePlayVoice = (sceneId: string) => {
      const entry = getVoiceEntry(sceneId);
      if (!entry?.audioUrl) return;
      const audio = new Audio(entry.audioUrl);
      audio.play();
    };

    const handleRegenVoice = async (seg: typeof segments[0]) => {
      setRegenSceneId(seg.sceneId);
      try {
        const voiceId = config?.selectedVoiceId || activeBrand?.voicePresets?.[0]?.id;
        const scriptText = seg.scriptText || "";
        if (!scriptText) throw new Error("No script text for this scene.");
        const { fal_url } = await generateTTSAndUpload({ text: scriptText, voice_id: voiceId });
        const ttsResult = await generateTTS({ text: scriptText, voice_id: voiceId });
        // Cache locally so handleRegenLipsync can read it immediately
        latestVoice[seg.sceneId] = { audioUrl: ttsResult.audioUrl, falUrl: fal_url };
        // Also persist to steps state
        const voiceData = allSteps?.find((s) => s.id === "voice")?.result as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(voiceData)) {
          const entry = voiceData.find((v) => v.sceneId === seg.sceneId);
          if (entry) {
            entry.falUrl = fal_url;
            entry.audioUrl = ttsResult.audioUrl;
            entry.script = scriptText;
          }
          if (onUpdateStepResult) onUpdateStepResult("voice", [...voiceData]);
        }
        const audio = new Audio(ttsResult.audioUrl);
        audio.play();
      } catch { /* silent */ } finally {
        setRegenSceneId(null);
      }
    };

    const handleRegenLipsync = async (seg: typeof segments[0]) => {
      if (!seg.imageUrl) return;
      const entry = getVoiceEntry(seg.sceneId);
      if (!entry?.falUrl) {
        console.error(`No audio for scene ${seg.sceneId}. Regenerate voice first.`);
        return;
      }
      setRegenSceneId(seg.sceneId);
      try {
        const job = await createHeyGenAvatar4({
          image_url: seg.imageUrl,
          audio_url: entry.falUrl,
          talking_style: "expressive",
          aspect_ratio: (config?.aspectRatio || "9:16") === "4:5" ? "9:16" : (config?.aspectRatio || "9:16"),
          resolution: config?.resolution === "4K" || config?.resolution === "2K" ? "1080p" : "720p",
        });
        const videoResult = await pollHeyGenAvatar4(job.request_id);
        if (videoResult.video_url) {
          seg.videoUrl = videoResult.video_url;
        }
      } catch { /* silent */ } finally {
        setRegenSceneId(null);
      }
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Check size={14} className="text-[var(--color-success)]" />
          <span className="text-[13px] font-medium text-fg">
            {segments.length} scenes animated — review and approve
          </span>
        </div>
        {/* Hook video — shown before scene grid when present */}
        {segments[0]?.hookVideoUrl && (
          <div className="bg-surface-0 border border-purple-500/40 rounded-[var(--radius-md)] p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide bg-purple-500/20 text-purple-300">
                <Video size={8} /> Hook
              </span>
              <span className="text-[11px] font-medium text-fg">Escena 0 — Entrada · 3s · sin audio</span>
              <span className="text-[10px] text-fg-faint">Se prepend al render</span>
            </div>
            <video
              src={segments[0].hookVideoUrl}
              controls
              muted
              className="h-40 rounded border border-purple-500/30 bg-black"
              style={{ aspectRatio: "9/16" }}
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          {segments.map((seg, i) => {
            const voiceEntry = getVoiceEntry(seg.sceneId);
            const hasAudio = !!voiceEntry?.audioUrl;
            const isRegen = regenSceneId === seg.sceneId;
            return (
              <div key={seg.sceneId} className="bg-surface-0 border border-edge rounded-[var(--radius-md)] overflow-hidden">
                <div className="aspect-[9/16] relative">
                  {seg.videoUrl ? (
                    <video src={seg.videoUrl} controls className="w-full h-full object-contain bg-black" />
                  ) : (
                    <div className="w-full h-full bg-surface-2 flex items-center justify-center">
                      <p className="text-[11px] text-fg-faint">Sin video</p>
                    </div>
                  )}
                  {isRegen && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                      <Loader2 size={20} className="animate-spin text-white" />
                      <p className="text-[10px] text-white/70">Regenerating...</p>
                    </div>
                  )}
                </div>
                <div className="p-2.5 space-y-2">
                  <span className="text-[11px] text-fg font-medium">Scene {i + 1}: {seg.title}</span>
                  {seg.scriptText && (
                    <p className="text-[10px] text-fg-faint leading-relaxed">&ldquo;{seg.scriptText}&rdquo;</p>
                  )}
                  {/* Voice controls */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => handlePlayVoice(seg.sceneId)}
                      disabled={!hasAudio}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1 py-1 rounded-[var(--radius-sm)] text-[10px] font-medium transition-colors cursor-pointer",
                        hasAudio ? "bg-surface-2 text-fg-muted hover:bg-surface-3 hover:text-fg" : "bg-surface-1 text-fg-faint cursor-not-allowed"
                      )}
                    >
                      <Play size={9} /> Voice
                    </button>
                    <button
                      onClick={() => handleRegenVoice(seg)}
                      disabled={isRegen}
                      className="flex-1 flex items-center justify-center gap-1 py-1 rounded-[var(--radius-sm)] text-[10px] font-medium bg-surface-2 text-fg-muted hover:bg-surface-3 hover:text-fg transition-colors cursor-pointer"
                    >
                      <Mic size={9} /> Regen Voice
                    </button>
                    <button
                      onClick={() => handleRegenLipsync(seg)}
                      disabled={isRegen || !hasAudio}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1 py-1 rounded-[var(--radius-sm)] text-[10px] font-medium transition-colors cursor-pointer",
                        !isRegen && hasAudio
                          ? "bg-[var(--color-warm-muted)] text-[var(--color-warm)] hover:opacity-80"
                          : "bg-surface-1 text-fg-faint cursor-not-allowed"
                      )}
                    >
                      <RotateCcw size={9} /> Regen Lip-sync
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Subtitles step — show timeline
  if (stepId === "subtitles" && result) {
    const subs = result as Array<{
      sceneId: string;
      title: string;
      text: string;
      startTime: number;
      endTime: number;
    }>;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Check size={14} className="text-[var(--color-success)]" />
          <span className="text-[13px] font-medium text-fg">
            Subtitles generated for {subs.length} scenes
          </span>
        </div>
        <div className="space-y-1">
          {subs.map((sub) => (
            <div key={sub.sceneId} className="flex items-start gap-3 bg-surface-2 rounded-[var(--radius-sm)] px-4 py-2.5">
              <span className="text-[10px] font-mono text-fg-faint shrink-0 pt-0.5">
                {sub.startTime.toFixed(1)}s — {sub.endTime.toFixed(1)}s
              </span>
              <div className="flex-1">
                <div className="text-[11px] font-medium text-fg-secondary mb-0.5">{sub.title}</div>
                <p className="text-[12px] text-fg leading-relaxed">{sub.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Render step — final video with subtitle engine info + download
  if (stepId === "render" && result) {
    const info = result as {
      videoUrl?: string; videoUrlNoSubs?: string; totalDuration: string; scenes: number;
      format: string; resolution: string; sizeBytes?: number;
      subtitleEngine?: string;
      remotionScenes?: Array<{ videoUrl: string; scriptText: string; durationInFrames: number }>;
    };
    const fullVideoUrl = info.videoUrl ? `http://localhost:8000${info.videoUrl}` : undefined;
    const fullVideoUrlNoSubs = info.videoUrlNoSubs ? `http://localhost:8000${info.videoUrlNoSubs}` : undefined;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Check size={14} className="text-[var(--color-success)]" />
          <span className="text-[13px] font-medium text-fg">Video final renderizado</span>
          {info.subtitleEngine && (
            <span className="text-[10px] text-fg-faint px-2 py-0.5 bg-surface-2 rounded">
              subs: {info.subtitleEngine}
            </span>
          )}
        </div>

        {/* Video player */}
        {fullVideoUrl ? (
          <video
            src={fullVideoUrl}
            controls
            className="w-full max-w-sm mx-auto rounded-[var(--radius-md)] border border-edge bg-black"
          />
        ) : (
          <div className="text-center py-8 text-fg-faint">
            <Film size={32} className="mx-auto mb-2" />
            <p className="text-[13px]">Video listo</p>
          </div>
        )}

        {/* Remotion preview (if available) */}
        {info.remotionScenes && info.remotionScenes.length > 0 && (
          <details className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-4">
            <summary className="text-[12px] text-fg-muted cursor-pointer hover:text-fg">
              Preview with Remotion subtitles
            </summary>
            <div className="flex justify-center mt-3">
              <UGCPlayer scenes={info.remotionScenes} width={280} height={497} />
            </div>
          </details>
        )}

        <div className="grid grid-cols-4 gap-2">
          <InfoPill label="Duration" value={info.totalDuration} />
          <InfoPill label="Scenes" value={String(info.scenes)} />
          <InfoPill label="Format" value={info.format} />
          <InfoPill label="Resolution" value={info.resolution} />
        </div>

        <div className="flex justify-center gap-3 pt-2">
          {fullVideoUrl && (
            <button
              onClick={async () => {
                const res = await fetch(fullVideoUrl);
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = "ugc_with_subs.mp4"; a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-[var(--color-warm-fg)] bg-[var(--color-warm)] rounded-[var(--radius-sm)] hover:opacity-90 transition-opacity cursor-pointer"
            >
              <Film size={14} />
              Download with Subtitles
            </button>
          )}
          {fullVideoUrlNoSubs && (
            <button
              onClick={async () => {
                const res = await fetch(fullVideoUrlNoSubs);
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = "ugc_no_subs.mp4"; a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-fg bg-surface-2 hover:bg-surface-3 rounded-[var(--radius-sm)] transition-colors cursor-pointer"
            >
              <Film size={14} />
              Download without Subtitles
            </button>
          )}
        </div>
      </div>
    );
  }

  // Generate All step — show all images (Static Ad)
  // Carousel generate_all — horizontal slide gallery
  if (stepId === "generate_all" && result && (result as Record<string, unknown>).slides && Array.isArray((result as Record<string, unknown>).slides)) {
    const data = result as { slides: Array<{ id: string; url: string; label: string; headline: string; body: string; role: string }>; visualStyle?: string };
    const slides = data.slides || [];
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Check size={14} className="text-[var(--color-success)]" />
          <span className="text-[13px] font-medium text-fg">Carousel — {slides.length} slides generated</span>
        </div>
        {/* Horizontal scroll carousel preview */}
        <div className="flex gap-3 overflow-x-auto pb-3 -mx-2 px-2 snap-x snap-mandatory">
          {slides.map((slide, i) => (
            <div key={slide.id} className="flex-shrink-0 w-56 snap-start space-y-2">
              <div
                className="rounded-[var(--radius-md)] overflow-hidden border border-edge cursor-pointer hover:border-[var(--color-warm)] transition-colors relative group"
                onClick={() => slide.url && setLightboxUrl(slide.url)}
              >
                {slide.url ? (
                  <img src={slide.url} alt={slide.label} className="w-full aspect-[4/5] object-cover" />
                ) : (
                  <div className="w-full aspect-[4/5] bg-surface-2 flex items-center justify-center text-fg-faint text-[11px]">Failed</div>
                )}
                <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                  {i + 1}/{slides.length}
                </div>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <Eye size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <div className="px-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-semibold text-[var(--color-warm)] uppercase">{slide.role}</span>
                  <button
                    onClick={() => setEditingImageId(editingImageId === slide.id ? null : slide.id)}
                    className="text-[9px] text-fg-faint hover:text-fg cursor-pointer"
                  >
                    {editingImageId === slide.id ? "Cancel" : "Edit"}
                  </button>
                </div>
                {slide.headline && <p className="text-[12px] font-bold text-fg leading-tight">{slide.headline}</p>}
                {slide.body && <p className="text-[10px] text-fg-muted leading-tight">{slide.body}</p>}
              </div>
              {editingImageId === slide.id && slide.url && (
                <ImageEditPanel
                  imageUrl={slide.url}
                  aspectRatio={config?.aspectRatio || "4:5"}
                  resolution={config?.resolution || "1K"}
                  selectedProductId={config?.selectedProductId}
                  onImageUpdated={(newUrl) => { slide.url = newUrl; setEditingImageId(null); }}
                  onClose={() => setEditingImageId(null)}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-2 pt-2">
          <button
            onClick={async () => {
              for (const slide of slides) {
                if (!slide.url) continue;
                try {
                  const res = await fetch(slide.url);
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `carousel_${slide.id}.png`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch { /* */ }
              }
            }}
            className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-[var(--color-warm-fg)] bg-[var(--color-warm)] rounded-[var(--radius-sm)] hover:opacity-90 cursor-pointer"
          >
            <Film size={14} />
            Download All ({slides.length})
          </button>
        </div>
        {lightboxUrl && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8 cursor-pointer" onClick={() => setLightboxUrl(null)}>
            <img src={lightboxUrl} alt="Full size" className="max-h-full max-w-full object-contain rounded-[var(--radius-md)]" onClick={(e) => e.stopPropagation()} />
          </div>
        )}
      </div>
    );
  }

  if (stepId === "generate_all" && result) {
    const data = result as { images: Array<{ id: string; url: string; label: string }>; headline?: string; subline?: string };
    const images = data.images || [];
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Check size={14} className="text-[var(--color-success)]" />
          <span className="text-[13px] font-medium text-fg">{images.length} creatives generated</span>
        </div>
        {data.headline && (
          <div className="text-center space-y-1 mb-2">
            <p className="text-[16px] font-bold text-fg">{data.headline}</p>
            {data.subline && <p className="text-[12px] text-fg-muted">{data.subline}</p>}
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          {images.map((img) => (
            <div key={img.id} className="space-y-1.5">
              <div
                className="rounded-[var(--radius-sm)] overflow-hidden border border-edge cursor-pointer hover:border-[var(--color-warm)] transition-colors relative group"
                onClick={() => img.url && setLightboxUrl(img.url)}
              >
                <img src={img.url} alt={img.label} className="w-full aspect-square object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <Eye size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setEditingImageId(editingImageId === img.id ? null : img.id)}
                  className="flex-1 text-[9px] text-fg-muted hover:text-fg bg-surface-2 hover:bg-surface-3 rounded py-1 cursor-pointer text-center"
                >
                  {editingImageId === img.id ? "Cancel" : "Edit"}
                </button>
                <p className="flex-1 text-[10px] text-fg-faint text-center py-1">{img.label}</p>
              </div>
              {editingImageId === img.id && (
                <ImageEditPanel
                  imageUrl={img.url}
                  aspectRatio={config?.aspectRatio || "4:5"}
                  resolution={config?.resolution || "1K"}
                  selectedProductId={config?.selectedProductId}
                  onImageUpdated={(newUrl) => { img.url = newUrl; setEditingImageId(null); }}
                  onClose={() => setEditingImageId(null)}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-2 pt-2">
          <button
            onClick={async () => {
              for (const img of images) {
                if (!img.url) continue;
                try {
                  const res = await fetch(img.url);
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `static_ad_${img.id}.png`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch { /* */ }
              }
            }}
            className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-[var(--color-warm-fg)] bg-[var(--color-warm)] rounded-[var(--radius-sm)] hover:opacity-90 cursor-pointer"
          >
            <Film size={14} />
            Download All ({images.length})
          </button>
        </div>
        {lightboxUrl && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8 cursor-pointer" onClick={() => setLightboxUrl(null)}>
            <img src={lightboxUrl} alt="Full size" className="max-h-full max-w-full object-contain rounded-[var(--radius-md)]" onClick={(e) => e.stopPropagation()} />
          </div>
        )}
      </div>
    );
  }

  // Generate step — show generated image
  if (stepId === "generate" && result) {
    const data = result as { url?: string; prompt?: string; headline?: string; subline?: string; title?: string };
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Check size={14} className="text-[var(--color-success)]" />
          <span className="text-[13px] font-medium text-fg">{data.title || "Image generated"}</span>
        </div>
        {data.url && (
          <div className="flex justify-center">
            <div
              className="max-w-sm rounded-[var(--radius-md)] overflow-hidden border border-edge cursor-pointer hover:border-[var(--color-warm)] transition-colors relative group"
              onClick={() => setLightboxUrl(data.url!)}
            >
              <img src={data.url} alt="Generated" className="w-full" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <Eye size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>
        )}
        {(data.headline || data.subline) && (
          <div className="text-center space-y-1">
            {data.headline && <p className="text-[14px] font-bold text-fg">{data.headline}</p>}
            {data.subline && <p className="text-[12px] text-fg-muted">{data.subline}</p>}
          </div>
        )}
        {data.prompt && (
          <details className="text-[10px] text-fg-faint">
            <summary className="cursor-pointer hover:text-fg">Ver prompt</summary>
            <p className="mt-1 p-2 bg-surface-2 rounded text-[10px] font-mono leading-relaxed">{data.prompt}</p>
          </details>
        )}
        {lightboxUrl && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8 cursor-pointer" onClick={() => setLightboxUrl(null)}>
            <img src={lightboxUrl} alt="Full size" className="max-h-full max-w-full object-contain rounded-[var(--radius-md)]" onClick={(e) => e.stopPropagation()} />
          </div>
        )}
      </div>
    );
  }

  // Analyze step — show video analysis results (Content Analyzer)
  if (stepId === "analyze" && result) {
    const data = result as { analysis: Record<string, unknown>; videoDuration: number; numFrames: number; sourceUrl: string };
    const analysis = data.analysis || {};
    const scenes = (analysis.scenes || []) as Array<Record<string, string>>;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Check size={14} className="text-[var(--color-success)]" />
          <span className="text-[13px] font-medium text-fg">
            Video analyzed — {data.numFrames} frames, {data.videoDuration}s
          </span>
        </div>

        {/* Key insights */}
        {!!analysis.key_insights && (
          <div className="bg-[var(--color-warm-muted)] border border-[var(--color-warm)] rounded-[var(--radius-md)] p-4">
            <h4 className="text-[11px] font-semibold text-[var(--color-warm)] uppercase tracking-wider mb-1">Insights clave</h4>
            <p className="text-[12px] text-fg-muted">{String(analysis.key_insights)}</p>
          </div>
        )}

        {/* Structure + style */}
        <div className="grid grid-cols-2 gap-3">
          {!!analysis.content_type && (
            <div className="bg-surface-2 rounded-[var(--radius-sm)] p-3">
              <span className="text-[10px] text-fg-faint font-medium">Type</span>
              <p className="text-[12px] text-fg mt-0.5">{String(analysis.content_type)}</p>
            </div>
          )}
          {!!analysis.structure && (
            <div className="bg-surface-2 rounded-[var(--radius-sm)] p-3">
              <span className="text-[10px] text-fg-faint font-medium">Structure</span>
              <p className="text-[12px] text-fg mt-0.5">{String(analysis.structure)}</p>
            </div>
          )}
        </div>

        {/* Estimated script */}
        {!!analysis.estimated_script && (
          <div className="bg-surface-0 border border-edge rounded-[var(--radius-md)] p-4">
            <h4 className="text-[11px] font-semibold text-fg-faint uppercase tracking-wider mb-2">Script estimado</h4>
            <p className="text-[12px] text-fg-muted leading-relaxed">{String(analysis.estimated_script)}</p>
          </div>
        )}

        {/* Scenes */}
        {scenes.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[11px] font-semibold text-fg-faint uppercase tracking-wider">Scene Breakdown ({scenes.length} scenes)</h4>
            {scenes.map((scene, i) => (
              <div key={i} className="bg-surface-0 border border-edge rounded-[var(--radius-sm)] p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-fg-faint">F{scene.frame || i + 1}</span>
                  {scene.mood && <span className="text-[9px] px-1.5 py-0.5 bg-surface-2 rounded text-fg-faint">{scene.mood}</span>}
                </div>
                <p className="text-[11px] text-fg-muted">{scene.description}</p>
                <details className="mt-1 text-[9px] text-fg-faint">
                  <summary className="cursor-pointer hover:text-fg">Prompt de imagen</summary>
                  <p className="mt-1 font-mono bg-surface-2 p-1.5 rounded text-[9px]">{scene.image_prompt}</p>
                </details>
              </div>
            ))}
          </div>
        )}

        {/* Style guide */}
        {!!analysis.style_guide && (
          <div className="bg-surface-2 rounded-[var(--radius-sm)] p-3">
            <span className="text-[10px] text-fg-faint font-medium">Estilo visual</span>
            <p className="text-[11px] text-fg-muted mt-1">{String(analysis.style_guide)}</p>
          </div>
        )}
      </div>
    );
  }

  // Adapt step — show adapted content
  if (stepId === "adapt" && result) {
    const data = result as {
      adaptedScript: string;
      scenes?: Array<{ frame: number; script: string; imagePrompt: string; sceneType: string }>;
      styleNotes: string;
    };
    const adaptScenes = data.scenes || [];

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Check size={14} className="text-[var(--color-success)]" />
          <span className="text-[13px] font-medium text-fg">
            Content adapted — {adaptScenes.length} scenes for your brand
          </span>
        </div>

        {data.adaptedScript && (
          <div className="bg-surface-0 border border-edge rounded-[var(--radius-md)] p-4">
            <h4 className="text-[11px] font-semibold text-fg-faint uppercase tracking-wider mb-2">Tu script</h4>
            <p className="text-[13px] text-fg leading-relaxed">{data.adaptedScript}</p>
          </div>
        )}

        <div className="space-y-2">
          {adaptScenes.map((scene, i) => (
            <div key={i} className="bg-surface-0 border border-edge rounded-[var(--radius-sm)] p-3 flex gap-3">
              <span className="text-[10px] font-bold text-fg-faint w-6 shrink-0">F{scene.frame}</span>
              <div className="flex-1 space-y-1">
                <p className="text-[11px] text-fg-muted">&ldquo;{scene.script}&rdquo;</p>
                <details className="text-[9px] text-fg-faint">
                  <summary className="cursor-pointer hover:text-fg">Prompt de imagen</summary>
                  <p className="mt-1 font-mono bg-surface-2 p-1.5 rounded text-[9px]">{scene.imagePrompt}</p>
                </details>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 bg-surface-2 rounded text-fg-faint h-fit">{scene.sceneType}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Carousel prompt step — show slides overview (detected by presence of slides array)
  if (stepId === "prompt" && result && (() => {
    let d = result as Record<string, unknown>;
    if (Array.isArray(d)) return true; // wrapped array has slides
    const dk = Object.keys(d);
    if (dk.length === 1 && typeof d[dk[0]] === "object" && d[dk[0]] !== null && !Array.isArray(d[dk[0]])) d = d[dk[0]] as Record<string, unknown>;
    return Array.isArray(d.slides);
  })()) {
    let data = result as Record<string, unknown>;
    // If it's an array, wrap it
    if (Array.isArray(data)) {
      data = { slides: data } as unknown as Record<string, unknown>;
    }
    const dKeys = Object.keys(data);
    if (dKeys.length === 1 && typeof data[dKeys[0]] === "object" && data[dKeys[0]] !== null && !Array.isArray(data[dKeys[0]])) {
      data = data[dKeys[0]] as Record<string, unknown>;
    }
    const slides = (data.slides || (Array.isArray(result) ? result : [])) as Array<Record<string, string>>;
    const visualStyle = String(data.base_scene || data.visual_style || "");
    const colors = String(data.colors || "");

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Check size={14} className="text-[var(--color-success)]" />
          <span className="text-[13px] font-medium text-fg">Carousel — {slides.length} slides</span>
        </div>

        {visualStyle && (
          <div className="bg-surface-2 rounded-[var(--radius-sm)] px-4 py-2">
            <span className="text-[10px] text-fg-faint font-medium">Visual Style: </span>
            <span className="text-[11px] text-fg-muted">{visualStyle}</span>
          </div>
        )}

        {colors && (
          <div className="bg-surface-2 rounded-[var(--radius-sm)] px-4 py-2">
            <span className="text-[10px] text-fg-faint font-medium">Colors: </span>
            <span className="text-[11px] text-fg-muted">{colors}</span>
          </div>
        )}

        <div className="space-y-2">
          {slides.map((slide, i) => (
            <div key={i} className="bg-surface-0 border border-edge rounded-[var(--radius-md)] p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold text-[var(--color-warm)] bg-warm-muted px-1.5 py-0.5 rounded">
                  {i + 1}
                </span>
                <span className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider">
                  {slide.role || `Slide ${i + 1}`}
                </span>
              </div>
              {slide.headline && (
                <p className="text-[15px] font-bold text-fg mb-1">{slide.headline}</p>
              )}
              {slide.body && (
                <p className="text-[12px] text-fg-muted mb-2">{slide.body}</p>
              )}
              <details className="mt-1">
                <summary className="text-[9px] text-fg-faint cursor-pointer hover:text-fg-muted">Prompt de imagen</summary>
                <p className="mt-1 font-mono text-[10px] text-fg-faint leading-relaxed">{slide.image_prompt}</p>
              </details>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Prompt step — show prompt + copy (Static Ad, Product Spotlight, etc.)
  if (stepId === "prompt" && result) {
    let data = result as Record<string, unknown>;
    // Unwrap if Gemini wraps in a single-key object (e.g. {"ad_composition": {...}})
    const keys = Object.keys(data);
    if (keys.length === 1 && typeof data[keys[0]] === "object" && data[keys[0]] !== null && !Array.isArray(data[keys[0]])) {
      data = data[keys[0]] as Record<string, unknown>;
    }
    const imagePrompt = String(data.image_prompt || data.prompt || data.image || data.description || "");
    const headline = String(data.headline || "");
    const subline = String(data.subline || "");
    const cta = String(data.cta || "");
    const colors = String(data.colors || "");
    const title = String(data.title || "");
    const mood = String(data.mood || "");

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Check size={14} className="text-[var(--color-success)]" />
          <span className="text-[13px] font-medium text-fg">Prompt generated</span>
        </div>

        {/* Editable copy + regenerate */}
        {(headline || subline) && (
          <div className="bg-surface-0 border border-edge rounded-[var(--radius-md)] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider">Ad Copy (click to edit)</h4>
              <button
                onClick={async () => {
                  if (!activeBrand || !config) return;
                  setEditLoading(true);
                  try {
                    const product = (activeBrand.products || []).find((p) => p.id === config.selectedProductId);
                    const res = await fetch("http://localhost:8000/api/tools/generate-prompt", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        brandId: activeBrand.id,
                        toolId: "static_ad",
                        userMessage: `Generate ONLY new ad copy (headline + subline + cta) for ${product?.name || "the product"}. Keep the same image prompt. Respond with JSON.`,
                        extraVariables: { language: config.language || "es" },
                      }),
                    });
                    if (res.ok) {
                      const { result: newCopy } = await res.json();
                      const nc = newCopy as Record<string, unknown>;
                      if (nc.headline) (data as Record<string, unknown>).headline = nc.headline;
                      if (nc.subline) (data as Record<string, unknown>).subline = nc.subline;
                      if (nc.cta) (data as Record<string, unknown>).cta = nc.cta;
                      // Force re-render by toggling a state
                      setShowBrief((p) => !p);
                      setTimeout(() => setShowBrief((p) => !p), 10);
                    }
                  } catch { /* silent */ } finally {
                    setEditLoading(false);
                  }
                }}
                disabled={editLoading}
                className="flex items-center gap-1 text-[10px] text-fg-muted hover:text-fg bg-surface-2 hover:bg-surface-3 px-2 py-1 rounded-[var(--radius-sm)] transition-colors cursor-pointer"
              >
                {editLoading ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />}
                Regen copy
              </button>
            </div>
            <input
              key={`h_${headline}`}
              defaultValue={headline}
              onChange={(e) => { (data as Record<string, unknown>).headline = e.target.value; }}
              className="w-full text-[18px] font-bold text-fg bg-transparent border-b border-transparent hover:border-edge focus:border-[var(--color-warm)] outline-none transition-colors"
            />
            <input
              key={`s_${subline}`}
              defaultValue={subline}
              onChange={(e) => { (data as Record<string, unknown>).subline = e.target.value; }}
              className="w-full text-[13px] text-fg-muted bg-transparent border-b border-transparent hover:border-edge focus:border-[var(--color-warm)] outline-none transition-colors"
            />
            <input
              key={`c_${cta}`}
              defaultValue={cta}
              onChange={(e) => { (data as Record<string, unknown>).cta = e.target.value; }}
              placeholder="CTA (e.g., Shop now)"
              className="w-full text-[12px] text-[var(--color-warm)] font-medium bg-transparent border-b border-transparent hover:border-edge focus:border-[var(--color-warm)] outline-none transition-colors placeholder:text-fg-faint"
            />
          </div>
        )}

        {/* Colors */}
        {colors && (
          <div className="bg-surface-2 rounded-[var(--radius-sm)] px-4 py-2">
            <span className="text-[10px] text-fg-faint font-medium">Colors: </span>
            <span className="text-[11px] text-fg-muted">{colors}</span>
          </div>
        )}

        {/* Title / Mood */}
        {(title || mood) && (
          <div className="flex gap-2">
            {title && <span className="text-[10px] px-2 py-0.5 bg-surface-2 rounded text-fg-muted">{title}</span>}
            {mood && <span className="text-[10px] px-2 py-0.5 bg-surface-2 rounded text-fg-faint italic">{mood}</span>}
          </div>
        )}

        {/* Image prompt */}
        <div className="bg-surface-2 border border-edge rounded-[var(--radius-sm)] p-4">
          <h4 className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider mb-2">Image Prompt</h4>
          <p className="text-[12px] text-fg-muted leading-relaxed font-mono">{imagePrompt}</p>
        </div>
      </div>
    );
  }

  // Visual Guide step — show extracted style guide
  if (stepId === "visual_guide" && result) {
    const data = result as { visualGuide: string; numReferences: number };
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Check size={14} className="text-[var(--color-success)]" />
          <span className="text-[13px] font-medium text-fg">
            Visual guide extracted from {data.numReferences} reference images
          </span>
        </div>
        <div className="bg-surface-2 border border-edge rounded-[var(--radius-md)] p-5">
          <h4 className="text-[11px] font-semibold text-fg-faint uppercase tracking-wider mb-3">Brand Visual Guide</h4>
          <pre className="text-[12px] text-fg-muted whitespace-pre-wrap font-mono leading-relaxed">{data.visualGuide}</pre>
        </div>
      </div>
    );
  }

  // Prompts step — show generated creative prompts
  if (stepId === "prompts" && result) {
    const data = result as { prompts: Array<{ prompt: string; style: string; angle: string }> };
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Check size={14} className="text-[var(--color-success)]" />
          <span className="text-[13px] font-medium text-fg">
            {data.prompts.length} creative prompts generated
          </span>
        </div>
        <div className="space-y-2">
          {data.prompts.map((p, i) => (
            <div key={i} className="bg-surface-0 border border-edge rounded-[var(--radius-sm)] p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-medium text-fg-faint bg-surface-2 px-1.5 py-0.5 rounded">{p.style}</span>
                <span className="text-[10px] text-fg-faint">{p.angle}</span>
              </div>
              <p className="text-[12px] text-fg-muted leading-relaxed">{p.prompt}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Images step — full review: image + script + audio + prompt per frame
  if (stepId === "images" && result) {
    const data = result as { images: Array<{ frame: number; url: string; prompt: string; scene_type: string; script: string; audioUrl?: string; status: string }> };
    const images = data.images || [];
    const successful = images.filter((img) => img.url && img.status !== "failed");

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Check size={14} className="text-[var(--color-success)]" />
          <span className="text-[13px] font-medium text-fg">
            {successful.length}/{images.length} keyframes generated — review before animating
          </span>
        </div>

        {/* Horizontal grid of frames */}
        <div className={cn("grid gap-3", images.length <= 3 ? "grid-cols-3" : images.length <= 5 ? "grid-cols-5" : "grid-cols-5")}>
          {images.map((img) => (
            <div key={img.frame} className="space-y-1.5">
              <div
                className="relative aspect-[9/16] rounded-[var(--radius-sm)] overflow-hidden border border-edge cursor-pointer hover:border-[var(--color-warm)] transition-colors group"
                onClick={() => img.url && setLightboxUrl(img.url)}
              >
                {img.url ? (
                  <img src={img.url} alt={`F${img.frame}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-surface-2 flex items-center justify-center">
                    <AlertCircle size={14} className="text-[var(--color-error)]" />
                  </div>
                )}
                <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-[8px] text-white font-bold">
                  F{img.frame}
                </div>
                {img.scene_type && (
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                    <span className="text-[8px] text-white">{img.scene_type}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <Eye size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              {/* Script + audio below image */}
              {img.script && (
                <p className="text-[9px] text-fg-muted leading-tight line-clamp-2">&ldquo;{img.script}&rdquo;</p>
              )}
              {img.audioUrl && (
                <button
                  onClick={() => new Audio(img.audioUrl!).play()}
                  className="flex items-center gap-1 text-[9px] text-fg-faint hover:text-fg cursor-pointer"
                >
                  <Play size={8} /> Listen
                </button>
              )}
              {/* Regen + Edit */}
              {img.frame > 1 && (
                <div className="flex gap-1">
                  <button
                    onClick={async () => {
                      setActionLoading(`img_${img.frame}`);
                      try {
                        const baseUrl = images[0]?.url;
                        if (!baseUrl) return;
                        const prompt = `Same product, same style, same lighting as image 1. ${img.prompt}`;
                        const job = await createImageEdit([img.url, baseUrl], prompt, config?.aspectRatio || "9:16", config?.resolution || "1K");
                        const result = await pollImageGen(job.request_id);
                        if (result.image_url) img.url = result.image_url;
                      } catch { /* */ } finally { setActionLoading(null); }
                    }}
                    disabled={!!actionLoading}
                    className="flex-1 flex items-center justify-center gap-1 py-1 rounded-[var(--radius-sm)] text-[9px] font-medium bg-surface-2 text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors cursor-pointer"
                  >
                    {actionLoading === `img_${img.frame}` ? <Loader2 size={8} className="animate-spin" /> : <RotateCcw size={8} />}
                    Regen
                  </button>
                  <button
                    onClick={() => setEditingId(editingId === `img_${img.frame}` ? null : `img_${img.frame}`)}
                    className="flex-1 flex items-center justify-center gap-1 py-1 rounded-[var(--radius-sm)] text-[9px] font-medium bg-surface-2 text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors cursor-pointer"
                  >
                    <Pencil size={8} />
                    Edit
                  </button>
                </div>
              )}
              {editingId === `img_${img.frame}` && (
                <ImageEditPanel
                  imageUrl={img.url}
                  aspectRatio={config?.aspectRatio || "9:16"}
                  resolution={config?.resolution || "1K"}
                  selectedProductId={config?.selectedProductId}
                  onImageUpdated={(newUrl) => { img.url = newUrl; setEditingId(null); }}
                  onClose={() => setEditingId(null)}
                />
              )}
              <details className="text-[8px] text-fg-faint">
                <summary className="cursor-pointer hover:text-fg">Prompt</summary>
                <p className="mt-0.5 font-mono leading-relaxed break-words">{img.prompt}</p>
              </details>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-fg-faint text-center">
          Review all frames. Approve to generate animation with Kling (${images.length - 1} segments × ~$0.50 each).
        </p>

        {lightboxUrl && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8 cursor-pointer" onClick={() => setLightboxUrl(null)}>
            <img src={lightboxUrl} alt="Full size" className="max-h-full max-w-full object-contain rounded-[var(--radius-md)]" onClick={(e) => e.stopPropagation()} />
          </div>
        )}
      </div>
    );
  }

  // Generate Batch step — creatives grid with edit/regen/apply reference/iterate
  if (stepId === "generate_batch" && result) {
    // Normalize: ad_creative_lab returns { creatives, successful, totalGenerated }
    //            content_analyzer returns { images, successful, total }
    const raw = result as {
      creatives?: Array<{ id: string; url: string; prompt: string; style: string; angle: string; status: string }>;
      images?: Array<{ frame: number; url: string; prompt: string; script: string; sceneType: string; status: string }>;
      successful: number; totalGenerated?: number; total?: number;
    };
    const normalizedCreatives = raw.creatives ?? (raw.images || []).map((img) => ({
      id: `frame_${img.frame}`,
      url: img.url,
      prompt: img.prompt,
      style: img.sceneType || "scene",
      angle: img.script || "",
      status: img.status,
    }));
    const data = {
      creatives: normalizedCreatives,
      successful: raw.successful,
      totalGenerated: raw.totalGenerated ?? raw.total ?? normalizedCreatives.filter((c) => c.url).length,
    };

    // Get references from visual_guide step
    const vgResult = allSteps.find((s) => s.id === "visual_guide")?.result as {
      referenceUrls?: string[];
    } | undefined;
    const refUrls = vgResult?.referenceUrls || [];

    // Get brand reference images (avatar + clothing + product) for consistency
    const getBrandRefs = (): string[] => {
      if (!activeBrand) return [];
      const refs: string[] = [];
      const avatar = activeBrand.avatars?.find((a) => a.id === config?.selectedAvatarId);
      if (avatar?.imageUrl) refs.push(avatar.imageUrl);
      const clothing = (activeBrand.clothing || []).filter((c) => (config?.selectedClothingIds || []).includes(c.id));
      clothing.forEach((c) => { if (c.imageUrl) refs.push(c.imageUrl); });
      const product = (activeBrand.products || []).find((p) => p.id === config?.selectedProductId);
      if (product?.imageUrl) refs.push(product.imageUrl);
      return refs;
    };

    // Apply a reference's mood/style to a creative — keep product/person consistent
    const handleApplyRef = async (creative: typeof data.creatives[0], refIdx: number) => {
      const refUrl = refUrls[refIdx];
      if (!refUrl) return;
      setActionLoading(creative.id);
      try {
        // Pass: creative (to keep) + brand refs (for consistency) + style reference (for mood)
        const refs = [creative.url, ...getBrandRefs(), refUrl];
        const job = await createImageEdit(
          refs,
          `Keep the EXACT same person, product, and garments from the first image. Only change the mood, lighting, color grading, and atmosphere to match the style of the last reference image. Do NOT change what the person looks like, what they wear, or what they hold. ${creative.prompt}`,
          config?.aspectRatio || "9:16",
          config?.resolution || "1K",
        );
        const editResult = await pollImageGen(job.request_id);
        if (editResult.image_url) creative.url = editResult.image_url;
      } catch { /* silent */ } finally {
        setActionLoading(null);
        setSelectedRefIdx(null);
      }
    };

    // Regenerate with original prompt + brand reference images for consistency
    const handleRegen = async (creative: typeof data.creatives[0]) => {
      setActionLoading(creative.id);
      try {
        const refs = getBrandRefs();
        const job = await createImageEdit(refs, creative.prompt, config?.aspectRatio || "9:16", config?.resolution || "1K");
        const regenResult = await pollImageGen(job.request_id);
        if (regenResult.image_url) creative.url = regenResult.image_url;
      } catch { /* silent */ } finally {
        setActionLoading(null);
      }
    };

    // Edit with brand refs for consistency
    const handleEditCreative = async (creative: typeof data.creatives[0]) => {
      if (!editText.trim()) return;
      setEditLoading(true);
      try {
        const refs = [creative.url, ...getBrandRefs()];
        const job = await createImageEdit(refs, editText.trim(), config?.aspectRatio || "9:16", config?.resolution || "1K");
        const editResult = await pollImageGen(job.request_id);
        if (editResult.image_url) creative.url = editResult.image_url;
      } catch { /* silent */ } finally {
        setEditLoading(false);
        setEditingId(null);
        setEditText("");
      }
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Check size={14} className="text-[var(--color-success)]" />
          <span className="text-[13px] font-medium text-fg">
            {data.successful}/{data.totalGenerated} creatives generated
          </span>
        </div>

        {/* Reference images strip — click to select one for applying */}
        {refUrls.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] text-fg-faint">Click a reference, then click "Apply Style" on a creative to transfer that visual style.</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {refUrls.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedRefIdx(selectedRefIdx === i ? null : i)}
                  className={cn(
                    "shrink-0 w-14 h-14 rounded-[var(--radius-sm)] overflow-hidden border-2 transition-all cursor-pointer",
                    selectedRefIdx === i
                      ? "border-[var(--color-warm)] ring-2 ring-[var(--color-warm)]/30"
                      : "border-edge hover:border-fg-muted"
                  )}
                >
                  <img src={url} alt={`Ref ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Creatives grid */}
        <div className="grid grid-cols-3 gap-3">
          {data.creatives.filter((c) => c.url).map((creative) => (
            <div key={creative.id} className="space-y-1.5">
              <div
                onClick={() => !actionLoading && creative.url && setLightboxUrl(creative.url)}
                className="relative rounded-[var(--radius-sm)] overflow-hidden border border-edge group cursor-pointer hover:border-[var(--color-warm)] transition-colors"
              >
                <div className="aspect-square">
                  {actionLoading === creative.id ? (
                    <div className="w-full h-full bg-surface-2 flex flex-col items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin text-fg-muted" />
                      <span className="text-[9px] text-fg-faint">Processing...</span>
                    </div>
                  ) : (
                    <img src={creative.url} alt={creative.style} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                  <span className="text-[9px] text-white font-medium">{creative.style} · {creative.angle}</span>
                </div>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <Eye size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-1">
                <button
                  onClick={() => handleRegen(creative)}
                  disabled={!!actionLoading}
                  className="flex-1 flex items-center justify-center gap-1 py-1 rounded-[var(--radius-sm)] text-[10px] font-medium bg-surface-2 text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors cursor-pointer"
                >
                  <RotateCcw size={9} />
                  Regen
                </button>
                <button
                  onClick={() => setEditingId(editingId === creative.id ? null : creative.id)}
                  className="flex-1 flex items-center justify-center gap-1 py-1 rounded-[var(--radius-sm)] text-[10px] font-medium bg-surface-2 text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors cursor-pointer"
                >
                  <Pencil size={9} />
                  Edit
                </button>
                {selectedRefIdx !== null && (
                  <button
                    onClick={() => handleApplyRef(creative, selectedRefIdx)}
                    disabled={!!actionLoading}
                    className="flex-1 flex items-center justify-center gap-1 py-1 rounded-[var(--radius-sm)] text-[10px] font-medium bg-[var(--color-warm-muted)] text-[var(--color-warm)] hover:opacity-80 transition-colors cursor-pointer"
                  >
                    <Sparkles size={9} />
                    Apply Style
                  </button>
                )}
              </div>

              {/* Edit panel with product picker */}
              {editingId === creative.id && (
                <ImageEditPanel
                  imageUrl={creative.url}
                  aspectRatio={config?.aspectRatio || "9:16"}
                  resolution={config?.resolution || "1K"}
                  selectedProductId={config?.selectedProductId}
                  onImageUpdated={(newUrl) => { creative.url = newUrl; setEditingId(null); }}
                  onClose={() => setEditingId(null)}
                />
              )}
            </div>
          ))}
        </div>

        {/* Download all */}
        {data.creatives.some((c) => c.url) && (
          <div className="flex justify-center pt-2">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                data.creatives.filter((c) => c.url).forEach((c, i) => {
                  const link = document.createElement("a");
                  link.href = c.url;
                  link.download = `creative_${i + 1}_${c.style}.png`;
                  link.click();
                });
              }}
              className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-[var(--color-warm-fg)] bg-[var(--color-warm)] rounded-[var(--radius-sm)] hover:opacity-90 cursor-pointer"
            >
              <Film size={14} />
              Download All ({data.creatives.filter((c) => c.url).length})
            </a>
            <button
              onClick={async () => {
                if (!activeBrand) return;
                const successful = data.creatives.filter((c) => c.url);
                try {
                  await saveGeneration({
                    brandId: activeBrand.id,
                    toolId: "ad_creative_lab",
                    title: `Ad Creatives — ${new Date().toLocaleDateString()}`,
                    type: "image",
                    thumbnailUrl: successful[0]?.url,
                    scenes: successful.map((c) => ({ id: c.id, title: c.style, imageUrl: c.url })),
                    metadata: { numCreatives: successful.length },
                  });
                  alert("Saved to Content!");
                } catch { /* silent */ }
              }}
              className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-fg-muted bg-surface-2 border border-edge rounded-[var(--radius-sm)] hover:text-fg hover:bg-surface-3 transition-colors cursor-pointer"
            >
              <Check size={14} />
              Save to Content
            </button>
          </div>
        )}

        {/* Lightbox */}
        {lightboxUrl && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8 cursor-pointer"
            onClick={() => setLightboxUrl(null)}
          >
            <img
              src={lightboxUrl}
              alt="Full size"
              className="max-h-full max-w-full object-contain rounded-[var(--radius-md)]"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    );
  }

  // Animate step — show video segments with play
  if (stepId === "animate" && result) {
    const data = result as { segments: Array<{ index: number; videoUrl: string; startFrame: number; endFrame: number; status: string }> };
    const segments = data.segments || [];
    const successful = segments.filter((s) => s.videoUrl && s.status !== "failed");

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Check size={14} className="text-[var(--color-success)]" />
          <span className="text-[13px] font-medium text-fg">
            {successful.length}/{segments.length} segments animated
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {segments.map((seg) => (
            <div key={seg.index} className="bg-surface-0 border border-edge rounded-[var(--radius-md)] overflow-hidden">
              <div className="aspect-[9/16]">
                {seg.videoUrl ? (
                  <video src={seg.videoUrl} controls className="w-full h-full object-contain bg-black" />
                ) : (
                  <div className="w-full h-full bg-surface-2 flex items-center justify-center">
                    <AlertCircle size={16} className="text-[var(--color-error)]" />
                  </div>
                )}
              </div>
              <div className="p-2 flex items-center justify-between">
                <span className="text-[10px] text-fg font-medium">F{seg.startFrame} → F{seg.endFrame}</span>
                <span className={cn(
                  "text-[9px] px-1.5 py-0.5 rounded",
                  seg.status === "done" ? "bg-success-muted text-success" : "bg-warning-muted text-warning"
                )}>
                  {seg.status}
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-fg-faint text-center">
          Review animated segments. Approve to render final video.
        </p>
      </div>
    );
  }

  // Generic fallback
  return (
    <div className="text-center py-8">
      <div className="w-10 h-10 rounded-full bg-success-muted flex items-center justify-center mx-auto mb-3">
        <Check size={18} className="text-[var(--color-success)]" />
      </div>
      <p className="text-[14px] text-fg font-medium">
        {meta?.label || stepId} completed
      </p>
      <p className="text-[12px] text-fg-muted mt-1">
        Results will be displayed here when backend is connected.
      </p>
    </div>
  );
}

// ── Info pill helper ───────────────────────────────────────

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-2 rounded-[var(--radius-sm)] px-3 py-2">
      <div className="text-[10px] font-medium text-fg-faint uppercase tracking-wider">
        {label}
      </div>
      <div className="text-[13px] text-fg mt-0.5 truncate">{value}</div>
    </div>
  );
}

// ── Asset Selector (reusable) ──────────────────────────────

interface AssetItem {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
}

function AssetSelector({
  label,
  sublabel,
  emptyText,
  items,
  selectedId,
  selectedIds,
  onSelect,
  onToggle,
  multi,
  onUpload,
}: {
  label: string;
  sublabel?: string;
  emptyText: string;
  items: AssetItem[];
  selectedId?: string | null;
  selectedIds?: string[];
  onSelect?: (id: string) => void;
  onToggle?: (id: string) => void;
  multi?: boolean;
  onUpload?: (file: File, name: string) => Promise<void>;
}) {
  const hasItems = items.length > 0;
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (file: File) => {
    if (!onUpload) return;
    const finalName = file.name.replace(/\.[^.]+$/, "");
    setUploading(true);
    try {
      await onUpload(file, finalName);
      setShowUpload(false);
    } catch { /* silent */ } finally {
      setUploading(false);
    }
  };

  const uploadForm = onUpload ? (
    <div className={cn(hasItems ? "mb-3" : "")}>
      <label className={cn(
        "flex items-center justify-center gap-2 py-3 border border-dashed rounded-[var(--radius-sm)] cursor-pointer text-[11px] transition-all",
        uploading
          ? "border-[var(--color-warm)] bg-[var(--color-warm-muted)] text-fg-muted"
          : "border-edge hover:border-[var(--color-edge-strong)] hover:bg-surface-2 text-fg-muted hover:text-fg"
      )}>
        {uploading ? (
          <><Loader2 size={13} className="animate-spin" /> Uploading...</>
        ) : (
          <><Plus size={13} /> Upload image</>
        )}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileChange(f);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  ) : null;

  return (
    <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-4">
      <div className="flex items-center justify-between mb-3">
        <label className="text-[12px] font-semibold text-fg-secondary">
          {label}
          {sublabel && (
            <span className="text-fg-faint font-normal ml-1">
              ({sublabel})
            </span>
          )}
        </label>
        <div className="flex items-center gap-2">
          {hasItems && (
            <span className="text-[10px] text-fg-faint">
              {items.length} available
            </span>
          )}
          {onUpload && !showUpload && hasItems && (
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-1 text-[10px] text-[var(--color-warm)] hover:underline cursor-pointer"
            >
              <Plus size={10} /> Upload
            </button>
          )}
        </div>
      </div>

      {/* Show upload inline when toggled or when there are no items */}
      {(showUpload || !hasItems) && uploadForm}

      {hasItems && (
        <div className="grid grid-cols-3 gap-2">
          {items.map((item) => {
            const isSelected = multi
              ? (selectedIds || []).includes(item.id)
              : selectedId === item.id;

            return (
              <button
                key={item.id}
                onClick={() =>
                  multi ? onToggle?.(item.id) : onSelect?.(item.id)
                }
                className={cn(
                  "border rounded-[var(--radius-sm)] p-2 text-center transition-all cursor-pointer group relative",
                  isSelected
                    ? "border-[var(--color-warm)] bg-[var(--color-warm-muted)]"
                    : "border-edge hover:border-[var(--color-edge-strong)]"
                )}
              >
                {isSelected && (
                  <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[var(--color-warm)] flex items-center justify-center">
                    <Check size={10} className="text-white" />
                  </div>
                )}
                <div className="w-full aspect-square bg-surface-2 rounded-[var(--radius-sm)] mb-1.5 overflow-hidden">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-fg-faint">
                      <ImageIcon size={16} />
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-fg-muted truncate block font-medium">
                  {item.name}
                </span>
                {item.description && (
                  <span className="text-[9px] text-fg-faint truncate block mt-0.5">
                    {item.description}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Entry Frame Panel — generates an "arrival pose" for scene 1 + Sync Lipsync V3 ──

const ENTRY_POSES = [
  { label: "Solo fondo", prompt: "Exact same room, background, lighting, colors, and environment as the reference image — but completely empty. No person, no one present anywhere in the frame. Keep every spatial and lighting detail identical. The scene is ready, waiting.", emptyRoom: true },
  { label: "Turns to camera", prompt: "Person seen from behind or side, just beginning to turn toward camera. Natural casual pose, back/side visible, movement starting. Same person, same clothing." },
  { label: "Looks up", prompt: "Person looking down at something off-screen, about to look up toward camera. Head tilted down, caught mid-transition. Same person, same clothing." },
  { label: "Walks into frame", prompt: "Person entering frame from the side, mid-walk, body in motion. Only partially visible as they step into shot. Same person, same clothing." },
  { label: "Distracted", prompt: "Person looking slightly off to the side as if distracted, body relaxed. Just before eye contact with camera. Same person, same clothing." },
];

function EntryFramePanel({
  sceneId: _sceneId,
  entryFrameUrl,
  avatarUrl,
  backgroundUrl,
  onGenerated,
  onRemove,
}: {
  sceneId: string;
  entryFrameUrl?: string;
  avatarUrl?: string;
  backgroundUrl?: string;
  onGenerated: (url: string) => void;
  onRemove: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [selectedPose, setSelectedPose] = useState(0);

  const isEmptyRoom = (ENTRY_POSES[selectedPose] as typeof ENTRY_POSES[0] & { emptyRoom?: boolean }).emptyRoom;

  const generate = async () => {
    setLoading(true);
    try {
      const pose = ENTRY_POSES[selectedPose];
      // "Solo fondo": use background asset if available, else generate empty version of base image
      if (pose.emptyRoom) {
        if (backgroundUrl) {
          onGenerated(backgroundUrl);
          return;
        }
        if (!avatarUrl) throw new Error("No base image available to derive empty room from.");
        // No background asset — generate empty version of the base image
        const job = await createImageEdit(
          [avatarUrl],
          `Remove the person entirely from this scene. Keep the exact same environment, lighting, colors, composition, camera angle, and every spatial detail identical — but completely empty. No person visible anywhere in frame. The room/setting is ready, waiting. Vertical 9:16, photorealistic. NO text, watermarks.`
        );
        const result = await pollImageGen(job.request_id);
        if (result.image_url) onGenerated(result.image_url);
        return;
      }
      if (!avatarUrl) return;
      const job = await createImageEdit(
        [avatarUrl],
        `${pose.prompt} Vertical 9:16, photorealistic, natural lighting. NO text, watermarks.`
      );
      const result = await pollImageGen(job.request_id);
      if (result.image_url) onGenerated(result.image_url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Entry frame generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3 border border-dashed border-purple-500/30 rounded-[var(--radius-sm)] p-2.5 space-y-2">
      <div className="flex items-center gap-1.5">
        <Video size={10} className="text-purple-400" />
        <span className="text-[10px] font-medium text-purple-400">Entry Frame</span>
        <span className="text-[9px] text-fg-faint">
          {isEmptyRoom
            ? backgroundUrl
              ? "— Usa el fondo seleccionado. Kling anima: fondo vacío → persona en frame, luego Lipsync"
              : "— Sin fondo asset: genera una versión vacía del escenario base. Kling anima entrada, luego Lipsync"
            : "— Kling animates entry → this image, then Lipsync V3 syncs lips"}
        </span>
      </div>
      {entryFrameUrl ? (
        <div className="space-y-1.5">
          <div className="w-24 h-40 rounded overflow-hidden border border-purple-500/40">
            <img src={entryFrameUrl} alt="entry frame" className="w-full h-full object-cover" />
          </div>
          <div className="flex items-center gap-3">
            <p className="text-[10px] text-fg-muted">Entry frame ready</p>
            <button onClick={onRemove} className="text-[9px] text-fg-faint hover:text-red-400 cursor-pointer">Remove</button>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1">
            {ENTRY_POSES.map((p, pi) => (
              <button
                key={pi}
                onClick={() => setSelectedPose(pi)}
                className={cn(
                  "px-2 py-0.5 rounded text-[9px] font-medium cursor-pointer transition-colors",
                  selectedPose === pi
                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/40"
                    : "bg-surface-2 text-fg-faint hover:text-fg border border-transparent"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={generate}
            disabled={loading || (!isEmptyRoom && !avatarUrl)}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-sm)] text-[10px] font-medium transition-colors",
              loading || (!isEmptyRoom && !avatarUrl)
                ? "bg-surface-2 text-fg-faint cursor-not-allowed"
                : "bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 cursor-pointer"
            )}
          >
            {loading ? <Loader2 size={9} className="animate-spin" /> : <Sparkles size={9} />}
            {loading ? "Generating..." : "Generate entry frame"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Route Panel — Content Analyzer output router ──────────

const ROUTE_TOOLS: Array<{
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  matchKeywords: string[];
  recommended?: boolean;
}> = [
  {
    id: "ugc_creator",
    label: "UGC Creator",
    description: "Video con avatar hablando, voz y lip-sync. Ideal para talking heads, testimonials, tutoriales.",
    icon: <Video size={20} />,
    matchKeywords: ["talking", "ugc", "testimonial", "tutorial", "person", "face", "speaker", "narrator", "presenter"],
  },
  {
    id: "carousel_creator",
    label: "Carousel Creator",
    description: "Múltiples slides con texto e imagen. Ideal para demos de producto, listas, educación.",
    icon: <ListChecks size={20} />,
    matchKeywords: ["carousel", "slide", "multi", "steps", "tips", "list", "educational", "product demo"],
  },
  {
    id: "static_ad",
    label: "Static Ad",
    description: "Una imagen creativa de alta calidad. Ideal para awareness, lanzamientos, promos.",
    icon: <ImageIcon size={20} />,
    matchKeywords: ["product", "shot", "hero", "single", "image", "ad", "banner", "launch"],
  },
  {
    id: "ad_creative_lab",
    label: "Ad Creative Lab",
    description: "Batch de creatividades con variaciones de estilo y ángulo. Para tests A/B y campañas.",
    icon: <Palette size={20} />,
    matchKeywords: ["creative", "lifestyle", "batch", "variations", "angles", "campaign"],
  },
  {
    id: "fashion_reel",
    label: "Fashion Reel",
    description: "Reel visual sin voiceover — movimiento, moda, poses. Story (4 escenas narrativas) o Looks (un outfit por escena).",
    icon: <Film size={20} />,
    matchKeywords: ["dance", "transition", "transformation", "fashion", "movement", "lifestyle", "model", "outfit", "reel", "visual"],
  },
];

function detectSuggestedTool(contentType: string, isVisualOnly?: boolean): string {
  if (isVisualOnly) return "fashion_reel";
  const lower = contentType.toLowerCase();
  for (const t of ROUTE_TOOLS) {
    if (t.matchKeywords.some((kw) => lower.includes(kw))) return t.id;
  }
  return "ugc_creator";
}

function RoutePanel({ allSteps, config }: { allSteps: StepState[]; config: ToolConfig }) {
  const navigate = useNavigate();

  const analyzeStep = allSteps.find((s) => s.id === "analyze");
  const adaptStep = allSteps.find((s) => s.id === "adapt");
  const analyzeData = analyzeStep?.result as {
    analysis?: { content_type?: string; key_insights?: string; structure?: string; estimated_script?: string }
  } | undefined;
  const adaptData = adaptStep?.result as { scenes?: Array<{ frame: number; script: string; imagePrompt: string; sceneType: string }>; adaptedScript?: string; styleNotes?: string } | undefined;

  const contentType = analyzeData?.analysis?.content_type || "";
  // isVisualOnly computed before suggestedId so we can pass it
  const isVisualOnly = (() => {
    const script = (analyzeData?.analysis?.estimated_script || "").toLowerCase();
    const ct = contentType.toLowerCase();
    const structure = (analyzeData?.analysis?.structure || "").toLowerCase();
    if (!script || script.length < 10) return true;
    // Content type or structure keywords suggest no brand VO
    if (ct.includes("dance") || ct.includes("movement") || ct.includes("fashion-movement")) return true;
    if (ct.includes("transition") || ct.includes("transformation")) return true;
    if (ct.includes("baile") || ct.includes("movimiento") || ct.includes("transformación")) return true;
    if (structure.includes("antes y después") || structure.includes("before") || structure.includes("transformación")) return true;
    // Has brand call-to-action → it's voiceover content
    const hasBrandVO = /\b(compra|descubrí|probá|conocé|visitá|link|swipe|shop|buy|discover|try|get yours|available|precio|oferta|discount|te cuento|te explico|quiero mostrarte)\b/i.test(script);
    if (hasBrandVO) return false;
    // Script looks like a trending audio (no product/brand purpose) → visual-only
    const isAudioTrend = /\b(damn|look good|nobody tell me|i look|can't nobody|what the|mirror|feeling myself)\b/i.test(script);
    if (isAudioTrend) return true;
    // Short script with no brand purpose → visual-only
    const isShortCasual = script.length < 100 && !hasBrandVO;
    return isShortCasual;
  })();
  const suggestedId = detectSuggestedTool(contentType, isVisualOnly);

  const launch = (targetToolId: string) => {
    const key = `handoff_${crypto.randomUUID()}`;
    sessionStorage.setItem(key, JSON.stringify({
      from: "content_analyzer",
      adaptData,
      analyzeData,
      contentMode: isVisualOnly ? "visual" : "voiceover",
      selectedAvatarIds: config.selectedAvatarIds,
      selectedProductIds: config.selectedProductIds,
      selectedClothingIds: config.selectedClothingIds,
      selectedAvatarId: config.selectedAvatarId,
      selectedBackgroundId: config.selectedBackgroundId,
      selectedProductId: config.selectedProductId,
    }));
    navigate(`/dashboard/generate/${targetToolId}?handoff=${key}`);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3 bg-surface-0 border border-edge rounded-[var(--radius-md)] p-4">
        <div className="w-8 h-8 rounded-full bg-[var(--color-warm-muted)] flex items-center justify-center shrink-0">
          <Sparkles size={14} className="text-[var(--color-warm)]" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-fg">Análisis completado</p>
          {contentType && (
            <p className="text-[12px] text-fg-muted mt-0.5">
              Tipo detectado: <span className="text-fg font-medium">{contentType}</span>
            </p>
          )}
          {analyzeData?.analysis?.key_insights && (
            <p className="text-[11px] text-fg-faint mt-1 leading-relaxed">{String(analyzeData.analysis.key_insights).slice(0, 180)}</p>
          )}
          {adaptData?.scenes?.length && (
            <p className="text-[11px] text-[var(--color-success)] mt-1">
              {adaptData.scenes.length} escenas adaptadas para tu marca — listas para usar
            </p>
          )}
          {isVisualOnly && (
            <p className="text-[11px] text-[var(--color-warm)] mt-1 font-medium">
              Contenido visual — sin voiceover. Se generará como video de imágenes + animación (sin lipsync).
            </p>
          )}
        </div>
      </div>

      {/* Scene preview */}
      {adaptData?.scenes?.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-fg-faint uppercase tracking-wider mb-2">
            Escenas adaptadas ({adaptData.scenes.length})
          </p>
          <div className="space-y-2">
            {(adaptData.scenes as Array<{ frame: number; script: string; imagePrompt: string; sceneType: string }>).map((scene, i) => (
              <div key={i} className="bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-3 py-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-bold text-fg-faint w-5 shrink-0">{scene.frame ?? i + 1}</span>
                  {scene.sceneType && (
                    <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-surface-2 text-fg-faint font-medium">
                      {scene.sceneType}
                    </span>
                  )}
                </div>
                {scene.script && (
                  <p className="text-[12px] text-fg leading-snug mb-1">{scene.script}</p>
                )}
                {scene.imagePrompt && (
                  <p className="text-[11px] text-fg-faint leading-snug italic">
                    {scene.imagePrompt.length > 110 ? scene.imagePrompt.slice(0, 110) + "…" : scene.imagePrompt}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tool cards */}
      <div>
        <p className="text-[11px] font-semibold text-fg-faint uppercase tracking-wider mb-3">
          ¿Qué querés crear con este contenido?
        </p>
        <div className="grid grid-cols-2 gap-3">
          {ROUTE_TOOLS.map((t) => {
            const isSuggested = t.id === suggestedId;
            return (
              <button
                key={t.id}
                onClick={() => launch(t.id)}
                className={cn(
                  "text-left p-4 rounded-[var(--radius-md)] border transition-all cursor-pointer group",
                  isSuggested
                    ? "bg-[var(--color-warm-muted)] border-[var(--color-warm)]/50 hover:border-[var(--color-warm)]"
                    : "bg-surface-1 border-edge hover:border-[var(--color-warm)]/40 hover:bg-surface-2"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={isSuggested ? "text-[var(--color-warm)]" : "text-fg-muted group-hover:text-fg"}>
                    {t.icon}
                  </span>
                  <span className="text-[13px] font-semibold text-fg">{t.label}</span>
                  {isSuggested && (
                    <span className="ml-auto text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--color-warm)]/20 text-[var(--color-warm)]">
                      Recomendado
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-fg-faint leading-relaxed">{t.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick generate images option */}
      <div className="border-t border-edge pt-4">
        <p className="text-[10px] text-fg-faint mb-2">También podés quedarte acá y generar imágenes directamente:</p>
        <button
          onClick={() => launch("ad_creative_lab")}
          className="flex items-center gap-2 px-3 py-2 text-[11px] text-fg-muted bg-surface-1 border border-edge hover:border-fg-muted rounded-[var(--radius-sm)] transition-colors cursor-pointer"
        >
          <Wand2 size={11} />
          Generar imágenes batch
        </button>
      </div>
    </div>
  );
}

// ── Curation Panel — manual variation selection ───────────

function CurationPanel({
  allSteps,
  curationSelections,
  onSelect,
  audioCache,
  onAudioCached,
  voiceId,
  config,
  onUpdateStepResult,
}: {
  allSteps: StepState[];
  curationSelections: Record<string, string>;
  onSelect: (sceneId: string, variationId: string) => void;
  audioCache: Record<string, { url: string; blob: Blob }>;
  config?: ToolConfig;
  onAudioCached: (sceneId: string, url: string, blob: Blob) => void;
  voiceId: string | null;
  onUpdateStepResult?: (stepId: string, result: unknown) => void;
}) {
  const { activeBrand } = useBrand();
  const multishotStep = allSteps.find((s) => s.id === "multishot");
  // multishot result can be either:
  //   - plain array [{sceneId, variations, ...}]  (set by handleMultishot, shown during review)
  //   - post-approval object { variations: [...], selections: [...] }  (set after approval / restored)
  const rawMultishotResult = multishotStep?.result;
  const multishotData = (Array.isArray(rawMultishotResult)
    ? rawMultishotResult
    : (rawMultishotResult as Record<string, unknown>)?.variations
  ) as Array<{
    sceneId: string;
    title: string;
    sceneType?: "talking" | "creative";
    variations: Array<{ id: string; url: string; label: string }>;
    frameToFrame?: boolean;
    frameToFrameNote?: string;
    entryFrameUrl?: string;
    hookVideoUrl?: string;
  }> | undefined;

  const scriptStep = allSteps.find((s) => s.id === "script");
  const scriptResult = scriptStep?.result as Record<string, unknown> | undefined;
  let scriptScenes: Array<{ id: string; title: string; script: string }> = [];
  if (scriptResult) {
    let rawArr: Array<Record<string, string>> = [];
    if (scriptResult.scenes) {
      rawArr = ((scriptResult.scenes as Array<Array<Record<string, string>>>)[0]) || [];
    } else if (Array.isArray(scriptResult)) {
      rawArr = (scriptResult as Array<Array<Record<string, string>>>)[0] || [];
    }
    scriptScenes = rawArr.map((s, i) => {
      let scriptText = s.script || s.speech || s.copy || s.text || s.audio || s.dialogue || s.narration || s.voiceover || s.action || "";
      scriptText = scriptText.replace(/^(AVATAR|OFF[- ]?CAMERA|ON[- ]?CAMERA|NARRATOR|SPEAKER)\s*(\([^)]*\)\s*)?:\s*/i, "").trim();
      return {
        id: s.id || s.scene_number || `act_${i + 1}`,
        title: s.title || s.act || `Scene ${i + 1}`,
        script: scriptText,
      };
    });
  }

  // Local playback state (not generation state)
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  // Edit state
  const [editingVar, setEditingVar] = useState<{ sceneId: string; varId: string; url: string } | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editIncludeProduct, setEditIncludeProduct] = useState(false);

  // Resolve selected product image URL (for reference in edits)
  const selectedProduct = (activeBrand?.products || []).find((p) => p.id === config?.selectedProductId);
  const productRefUrl = selectedProduct?.imageUrl ? productImageUrl(selectedProduct.imageUrl) : null;

  if (!multishotData) {
    return (
      <div className="text-center py-12 text-fg-faint">
        <p className="text-[13px]">No multishot data found.</p>
      </div>
    );
  }

  const allSelected = multishotData.every(
    (scene) => curationSelections[scene.sceneId] || scene.variations.length === 1
  );

  const handlePlayAudio = async (sceneId: string, text: string) => {
    // If playing this one, stop
    if (playingId === sceneId) {
      audioRefs.current[sceneId]?.pause();
      setPlayingId(null);
      return;
    }
    // Stop any other playing
    if (playingId) {
      audioRefs.current[playingId]?.pause();
      setPlayingId(null);
    }

    // If cached, replay
    if (audioCache[sceneId]) {
      const audio = new Audio(audioCache[sceneId].url);
      audioRefs.current[sceneId] = audio;
      audio.onended = () => setPlayingId(null);
      audio.play();
      setPlayingId(sceneId);
      return;
    }

    // Generate TTS
    if (!text) {
      console.warn(`[curation] No script text for scene ${sceneId}, skipping TTS`);
      return;
    }
    setGeneratingId(sceneId);
    try {
      console.log(`[curation] Generating TTS for ${sceneId}: "${text.slice(0, 50)}..." voice=${voiceId}`);
      const resolvedVoiceId = voiceId || activeBrand?.voicePresets?.[0]?.id;
      const result = await generateTTS({ text, voice_id: resolvedVoiceId });
      onAudioCached(sceneId, result.audioUrl, result.audioBlob);
      const audio = new Audio(result.audioUrl);
      audioRefs.current[sceneId] = audio;
      audio.onended = () => setPlayingId(null);
      audio.play();
      setPlayingId(sceneId);
    } catch (e) {
      console.error(`[curation] TTS failed for ${sceneId}:`, e);
    } finally {
      setGeneratingId(null);
    }
  };

  const handleRegenerateAudio = async (sceneId: string, text: string) => {
    // Stop if playing
    audioRefs.current[sceneId]?.pause();
    setPlayingId(null);
    // Generate fresh
    setGeneratingId(sceneId);
    try {
      const resolvedVoiceId = voiceId || activeBrand?.voicePresets?.[0]?.id;
      const result = await generateTTS({ text, voice_id: resolvedVoiceId });
      onAudioCached(sceneId, result.audioUrl, result.audioBlob);
      const audio = new Audio(result.audioUrl);
      audioRefs.current[sceneId] = audio;
      audio.onended = () => setPlayingId(null);
      audio.play();
      setPlayingId(sceneId);
    } catch { /* silent */ } finally {
      setGeneratingId(null);
    }
  };

  const [regenLoading, setRegenLoading] = useState<string | null>(null);

  const handleEditImage = async () => {
    if (!editingVar || !editPrompt.trim()) return;
    const editVarId = editingVar.varId;
    setEditLoading(true);
    setRegenLoading(editVarId); // show loader on the image
    try {
      const productUrls = (editingVar as typeof editingVar & { productUrls?: string[] })?.productUrls || [];
      const extraRefs = editIncludeProduct && productRefUrl ? [productRefUrl] : [];
      const job = await createImageEdit([editingVar.url, ...productUrls, ...extraRefs], editPrompt.trim());
      const result = await pollImageGen(job.request_id);
      if (result.image_url) {
        for (const scene of multishotData) {
          const v = scene.variations.find((v) => v.id === editVarId);
          if (v) { v.url = result.image_url; break; }
        }
        setEditingVar(null);
        setEditPrompt("");
      }
    } catch { /* silent */ } finally {
      setEditLoading(false);
      setRegenLoading(null);
    }
  };

  const handleRegenVariation = async (varId: string, sceneId: string) => {
    // Get base image as reference
    const baseStep = allSteps.find((s) => s.id === "base_image");
    const baseUrl = (baseStep?.result as { url: string } | undefined)?.url;
    if (!baseUrl) return;

    const scene = multishotData.find((s) => s.sceneId === sceneId);
    const variation = scene?.variations.find((v) => v.id === varId);
    if (!variation) return;

    // Find the script scene for the prompt
    const scriptScene = scriptScenes.find((s) => s.id === sceneId);
    const scenePrompt = scriptScene ? `Same person, same clothing, same product, same location, same lighting as image 1. ${(variation as { prompt?: string }).prompt || scriptScene.script}` : "Same person, same clothing, same product as image 1, subtle variation.";

    setRegenLoading(varId);
    try {
      const job = await createImageEdit([baseUrl], scenePrompt);
      const result = await pollImageGen(job.request_id);
      if (result.image_url) {
        variation.url = result.image_url;
      }
    } catch { /* silent */ } finally {
      setRegenLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Eye size={14} className="text-[var(--color-warning)]" />
        <span className="text-[13px] font-medium text-fg">
          Select your preferred variation for each scene
        </span>
        {allSelected && (
          <span className="text-[11px] text-[var(--color-success)] ml-2">
            All selected — click Approve & Continue
          </span>
        )}
      </div>

      {multishotData.map((scene, sceneIndex) => {
        const selectedId = curationSelections[scene.sceneId];
        const scriptScene = scriptScenes.find((s) => s.id === scene.sceneId);
        const isGenerating = generatingId === scene.sceneId;
        const isPlaying = playingId === scene.sceneId;
        const hasCached = !!audioCache[scene.sceneId];

        const sceneType = scene.sceneType ?? "talking";
        const isCreative = sceneType === "creative";
        const isFirstScene = sceneIndex === 0;
        const isSyncLipsync = config?.lipsyncMethod === "synclipsync";

        // Per-scene frame-to-frame state (set by intelligent suggestion, togglable by user)
        const sceneF2F = scene.frameToFrame ?? false;
        const sceneF2FNote = scene.frameToFrameNote;
        const entryFrameUrl = scene.entryFrameUrl;

        const toggleF2F = () => {
          const updated = multishotData.map((s) =>
            s.sceneId === scene.sceneId ? { ...s, frameToFrame: !sceneF2F } : s
          );
          onUpdateStepResult?.("multishot", updated);
        };

        // Next scene's selected image (for f2f preview)
        const nextScene = multishotData[sceneIndex + 1];
        const nextSelectedId = nextScene ? (curationSelections[nextScene.sceneId] || nextScene.variations[0]?.id) : null;
        const nextSelectedUrl = nextScene?.variations.find((v) => v.id === nextSelectedId)?.url;


        return (
          <React.Fragment key={scene.sceneId}>
          {/* Hook video — shown before Scene 1 when generated */}
          {isFirstScene && scene.hookVideoUrl && (
            <div className="bg-surface-0 border border-purple-500/40 rounded-[var(--radius-md)] p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide bg-purple-500/20 text-purple-300">
                  <Video size={8} /> Hook
                </span>
                <span className="text-[11px] font-semibold text-fg">Escena 0 — Entrada</span>
                <span className="text-[10px] text-fg-faint">Kling f2f · 3s · sin audio</span>
              </div>
              <div className="flex gap-3 items-start">
                {scene.entryFrameUrl && (
                  <div className="space-y-1">
                    <span className="text-[9px] text-fg-faint">Start</span>
                    <div className="w-16 h-28 rounded overflow-hidden border border-purple-500/30">
                      <img src={scene.entryFrameUrl} className="w-full h-full object-cover" />
                    </div>
                  </div>
                )}
                <div className="flex items-center self-center text-fg-faint text-[10px] gap-1">
                  <span>→</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] text-fg-faint">End</span>
                  <div className="w-16 h-28 rounded overflow-hidden border border-edge">
                    <img src={scene.variations[0]?.url} className="w-full h-full object-cover" />
                  </div>
                </div>
                <div className="space-y-1 flex-1">
                  <span className="text-[9px] text-fg-faint">Preview</span>
                  <video
                    src={scene.hookVideoUrl}
                    controls
                    muted
                    className="h-28 rounded border border-purple-500/30 bg-black"
                    style={{ aspectRatio: "9/16" }}
                  />
                </div>
              </div>
            </div>
          )}
          <div className={cn(
            "bg-surface-0 border rounded-[var(--radius-md)] p-4 space-y-3",
            isCreative ? "border-blue-500/30" : "border-edge"
          )}>
            {/* Scene header + script */}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-[12px] font-semibold text-fg">
                  Scene {sceneIndex + 1}: {scene.title}
                </h4>
                <span className={cn(
                  "flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide",
                  isCreative
                    ? "bg-blue-500/15 text-blue-400"
                    : "bg-[var(--color-warm-muted)] text-[var(--color-warm)]"
                )}>
                  {isCreative ? <Film size={8} /> : <Mic size={8} />}
                  {isCreative ? "Creative" : "Talking"}
                </span>
                {isCreative && sceneF2F && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide bg-purple-500/15 text-purple-400">
                    <Video size={8} /> Frame to Frame
                  </span>
                )}
              </div>

              {/* F2F toggle for creative scenes */}
              {isCreative && (
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-fg-faint">Frame to Frame</span>
                    {sceneF2FNote && (
                      <span className="text-[9px] text-fg-faint italic">{sceneF2FNote}</span>
                    )}
                  </div>
                  <button
                    onClick={toggleF2F}
                    className={cn(
                      "relative w-8 h-4 rounded-full transition-colors flex-shrink-0 cursor-pointer",
                      sceneF2F ? "bg-purple-500" : "bg-surface-3"
                    )}
                    title={sceneF2F ? "Disable frame-to-frame" : "Enable frame-to-frame"}
                  >
                    <span className={cn(
                      "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform",
                      sceneF2F ? "translate-x-[18px]" : "translate-x-0.5"
                    )} />
                  </button>
                </div>
              )}

              {/* F2F transition preview */}
              {isCreative && sceneF2F && (
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-[10px] text-fg-faint">Transitions to →</span>
                  {nextSelectedUrl ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-7 h-12 rounded overflow-hidden border border-purple-500/40">
                        <img src={nextSelectedUrl} alt="end frame" className="w-full h-full object-cover" />
                      </div>
                      <span className="text-[10px] text-purple-400">Scene {sceneIndex + 2}</span>
                    </div>
                  ) : nextScene ? (
                    <span className="text-[10px] text-fg-faint italic">Select image in Scene {sceneIndex + 2} first</span>
                  ) : (
                    <span className="text-[10px] text-fg-faint italic">Last scene — single frame fallback</span>
                  )}
                </div>
              )}

              {/* Entry frame — scene 1, shown when hook configured or entry frame already set */}
              {isFirstScene && config?.hookMode === "fooh" && entryFrameUrl ? (
                <div className="mt-3 border border-dashed border-purple-500/30 rounded-[var(--radius-sm)] p-2.5 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Video size={10} className="text-purple-400" />
                    <span className="text-[10px] font-medium text-purple-400">FOOH Entry Frame</span>
                    <span className="text-[9px] text-fg-faint">— Escena surrealist generada</span>
                  </div>
                  <div className="w-24 h-40 rounded overflow-hidden border border-purple-500/40">
                    <img src={entryFrameUrl} alt="FOOH entry frame" className="w-full h-full object-cover" />
                  </div>
                  <button
                    onClick={() => {
                      const updated = multishotData.map((s) =>
                        s.sceneId === scene.sceneId ? { ...s, entryFrameUrl: undefined } : s
                      );
                      onUpdateStepResult?.("multishot", updated);
                    }}
                    className="text-[9px] text-fg-faint hover:text-red-400 cursor-pointer"
                  >Remove</button>
                </div>
              ) : isFirstScene && config?.hookMode !== "fooh" && (config?.hookType !== "none" || entryFrameUrl) ? (
                <EntryFramePanel
                  sceneId={scene.sceneId}
                  entryFrameUrl={entryFrameUrl}
                  avatarUrl={multishotData[0]?.variations[0]?.url || scene.variations[0]?.url}
                  backgroundUrl={(() => {
                    const bg = (activeBrand?.backgrounds || []).find((b) => b.id === config?.selectedBackgroundId);
                    return bg?.imageUrl ? backgroundImageUrl(bg.imageUrl) : undefined;
                  })()}
                  onGenerated={(url) => {
                    const updated = multishotData.map((s) =>
                      s.sceneId === scene.sceneId ? { ...s, entryFrameUrl: url } : s
                    );
                    onUpdateStepResult?.("multishot", updated);
                  }}
                  onRemove={() => {
                    const updated = multishotData.map((s) =>
                      s.sceneId === scene.sceneId ? { ...s, entryFrameUrl: undefined } : s
                    );
                    onUpdateStepResult?.("multishot", updated);
                  }}
                />
              ) : null}
              {scriptScene && (
                <p className="text-[12px] text-fg-muted mt-1 leading-relaxed">
                  &ldquo;{scriptScene.script}&rdquo;
                </p>
              )}
            </div>

            {/* Variation thumbnails */}
            <div className={cn("grid gap-2", scene.variations.length === 1 ? "grid-cols-2" : "grid-cols-4")}>
              {scene.variations.map((v) => {
                const isSelected = selectedId === v.id || scene.variations.length === 1;
                const isEditing = editingVar?.varId === v.id;
                const isScene1 = sceneIndex === 0;
                const isRegen = regenLoading === v.id;
                return (
                  <div key={v.id} className="space-y-1">
                    <button
                      onClick={() => onSelect(scene.sceneId, v.id)}
                      className={cn(
                        "relative w-full rounded-[var(--radius-sm)] overflow-hidden border-2 transition-all cursor-pointer",
                        isSelected
                          ? "border-[var(--color-success)] ring-1 ring-[var(--color-success)]/30"
                          : "border-edge hover:border-fg-muted"
                      )}
                    >
                      <div className="aspect-[9/16] relative">
                        <img src={v.url} alt={v.label} className="w-full h-full object-cover" />
                        {isRegen && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <Loader2 size={16} className="animate-spin text-white" />
                          </div>
                        )}
                      </div>
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                        <span className="text-[9px] text-white font-medium">{isScene1 ? "Scene 1 (base)" : v.label}</span>
                      </div>
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[var(--color-success)] flex items-center justify-center">
                          <Check size={10} className="text-white" />
                        </div>
                      )}
                    </button>
                    {isScene1 && (
                      <a
                        href={v.url}
                        download={`scene1_base.jpg`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1 py-1 rounded-[var(--radius-sm)] text-[10px] bg-surface-2 text-fg-muted hover:bg-surface-3 hover:text-fg transition-colors w-full"
                        title="Download image"
                      >
                        <Download size={10} />
                        Download
                      </a>
                    )}
                    {!isScene1 && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleRegenVariation(v.id, scene.sceneId)}
                          disabled={!!regenLoading}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-1 py-1 rounded-[var(--radius-sm)] text-[10px] font-medium transition-colors cursor-pointer",
                            regenLoading === v.id
                              ? "bg-surface-2 text-fg-faint"
                              : "bg-surface-2 text-fg-muted hover:bg-surface-3 hover:text-fg"
                          )}
                        >
                          {regenLoading === v.id ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />}
                          Regen
                        </button>
                        <button
                          onClick={() => setEditingVar(isEditing ? null : { sceneId: scene.sceneId, varId: v.id, url: v.url })}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-1 py-1 rounded-[var(--radius-sm)] text-[10px] font-medium transition-colors cursor-pointer",
                            isEditing
                              ? "bg-[var(--color-warm-muted)] text-[var(--color-warm)]"
                              : "bg-surface-2 text-fg-muted hover:bg-surface-3 hover:text-fg"
                          )}
                        >
                          <Pencil size={10} />
                          {isEditing ? "Cancel" : "Edit"}
                        </button>
                        <a
                          href={v.url}
                          download={`scene${sceneIndex + 1}_${v.label.replace(/\s+/g, "_")}.jpg`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center px-2 py-1 rounded-[var(--radius-sm)] text-[10px] bg-surface-2 text-fg-muted hover:bg-surface-3 hover:text-fg transition-colors"
                          title="Download image"
                        >
                          <Download size={10} />
                        </a>
                      </div>
                    )}
                    {!isScene1 && (v as { prompt?: string }).prompt && (
                      <details className="text-[9px] text-fg-faint">
                        <summary className="cursor-pointer hover:text-fg">Ver prompt</summary>
                        <p className="mt-1 p-1.5 bg-surface-2 rounded text-[9px] font-mono leading-relaxed break-words">
                          {(v as { prompt?: string }).prompt}
                        </p>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Inline edit prompt */}
            {editingVar && editingVar.sceneId === scene.sceneId && (
              <div className="space-y-2 bg-surface-2 rounded-[var(--radius-sm)] p-2.5">
                {/* Quick actions */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setEditPrompt("Match the product with the reference image exactly — keep the person, pose, and background identical.")}
                    className="text-[10px] px-2 py-0.5 bg-[var(--color-warm-muted)] text-[var(--color-warm)] rounded-full cursor-pointer hover:opacity-80"
                  >
                    Fix Product
                  </button>
                  <button
                    onClick={() => setEditPrompt("Fix the person's face to match the reference image — same identity, expression, and skin tone.")}
                    className="text-[10px] px-2 py-0.5 bg-surface-3 text-fg-muted rounded-full cursor-pointer hover:text-fg"
                  >
                    Fix Face
                  </button>
                  <button
                    onClick={() => setEditPrompt("Make the lighting warmer and more flattering.")}
                    className="text-[10px] px-2 py-0.5 bg-surface-3 text-fg-muted rounded-full cursor-pointer hover:text-fg"
                  >
                    Warmer Light
                  </button>
                </div>
                {/* Product ref toggle */}
                {productRefUrl && (
                  <button
                    onClick={() => setEditIncludeProduct(!editIncludeProduct)}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-sm)] text-[10px] font-medium transition-colors cursor-pointer border",
                      editIncludeProduct
                        ? "bg-[var(--color-warm-muted)] text-[var(--color-warm)] border-[var(--color-warm)]/40"
                        : "bg-surface-1 text-fg-faint border-edge hover:text-fg"
                    )}
                    title={editIncludeProduct ? "Product reference included" : "Include product as reference"}
                  >
                    <img src={productRefUrl} alt="" className="w-4 h-4 rounded object-cover" />
                    {editIncludeProduct ? "Product ref included" : "+ Product ref"}
                  </button>
                )}
                {/* Input row */}
                <div className="flex items-center gap-2">
                  <input
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    placeholder="Describí qué cambiar..."
                    className="flex-1 h-8 px-3 rounded-[var(--radius-sm)] border border-edge bg-surface-1 text-[12px] text-fg placeholder:text-fg-faint outline-none focus:border-[var(--color-warm)]"
                    onKeyDown={(e) => e.key === "Enter" && handleEditImage()}
                    autoFocus
                  />
                  <button
                    onClick={handleEditImage}
                    disabled={editLoading || !editPrompt.trim()}
                    className={cn(
                      "px-3 py-1.5 text-[11px] font-medium rounded-[var(--radius-sm)] transition-colors",
                      !editLoading && editPrompt.trim()
                        ? "text-[var(--color-warm-fg)] bg-[var(--color-warm)] hover:opacity-90 cursor-pointer"
                        : "text-fg-faint bg-surface-1 cursor-not-allowed"
                    )}
                  >
                    {editLoading ? <Loader2 size={12} className="animate-spin" /> : "Apply"}
                  </button>
                  <button
                    onClick={() => { setEditingVar(null); setEditPrompt(""); setEditIncludeProduct(false); }}
                    className="text-[10px] text-fg-faint hover:text-fg cursor-pointer px-1"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Sortable wrapper for curation scenes ──────────────────

function SortableSceneWrapper({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative" as const,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <div
        {...attributes}
        {...listeners}
        className="absolute left-2 top-3 cursor-grab active:cursor-grabbing text-fg-faint hover:text-fg z-10"
        title="Drag to reorder"
      >
        <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
          <circle cx="2" cy="2" r="1.5" /><circle cx="8" cy="2" r="1.5" />
          <circle cx="2" cy="8" r="1.5" /><circle cx="8" cy="8" r="1.5" />
          <circle cx="2" cy="14" r="1.5" /><circle cx="8" cy="14" r="1.5" />
        </svg>
      </div>
      {children}
    </div>
  );
}

// ── Template Selector (Static Ad) ─────────────────────────

interface AdTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  aspect_ratio: string;
  needs_person: boolean;
}

const TEMPLATE_CATEGORIES: Record<string, { label: string; color: string }> = {
  brand: { label: "Brand", color: "text-[var(--color-warm)] bg-[var(--color-warm-muted)]" },
  social_proof: { label: "Social Proof", color: "text-success bg-success-muted" },
  educational: { label: "Educational", color: "text-fg-secondary bg-surface-2" },
  ugc: { label: "UGC Native", color: "text-warning bg-warning-muted" },
  comparison: { label: "Comparison", color: "text-error bg-error-muted" },
  promo: { label: "Promo", color: "text-fg bg-surface-3" },
  lifestyle: { label: "Lifestyle", color: "text-fg-secondary bg-surface-2" },
};

function TemplateSelector({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  const [templates, setTemplates] = useState<AdTemplate[]>([]);
  const [filterCat, setFilterCat] = useState<string>("all");

  useEffect(() => {
    fetch("http://localhost:8000/api/tools/static-ad/templates")
      .then((r) => r.json())
      .then((data) => setTemplates(data.templates || []))
      .catch(() => {});
  }, []);

  const categories = [...new Set(templates.map((t) => t.category))];
  const filtered = filterCat === "all" ? templates : templates.filter((t) => t.category === filterCat);

  return (
    <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-[12px] font-semibold text-fg-secondary">
          Ad Template
          <span className="text-fg-faint font-normal ml-1">({templates.length} templates)</span>
        </label>
        {selectedId && (
          <button
            onClick={() => onSelect("")}
            className="text-[10px] text-fg-faint hover:text-fg cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {/* Category filter */}
      <div className="flex gap-1 flex-wrap">
        <button
          onClick={() => setFilterCat("all")}
          className={cn(
            "px-2 py-0.5 rounded text-[9px] font-medium cursor-pointer transition-colors",
            filterCat === "all" ? "bg-surface-3 text-fg" : "text-fg-faint hover:text-fg"
          )}
        >
          All
        </button>
        {categories.map((cat) => {
          const catInfo = TEMPLATE_CATEGORIES[cat];
          return (
            <button
              key={cat}
              onClick={() => setFilterCat(filterCat === cat ? "all" : cat)}
              className={cn(
                "px-2 py-0.5 rounded text-[9px] font-medium cursor-pointer transition-colors",
                filterCat === cat ? (catInfo?.color || "bg-surface-3 text-fg") : "text-fg-faint hover:text-fg"
              )}
            >
              {catInfo?.label || cat}
            </button>
          );
        })}
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
        {filtered.map((t) => {
          const isSelected = selectedId === t.id;
          const catInfo = TEMPLATE_CATEGORIES[t.category];
          return (
            <button
              key={t.id}
              onClick={() => onSelect(isSelected ? "" : t.id)}
              className={cn(
                "text-left px-2.5 py-2 rounded-[var(--radius-sm)] border transition-all cursor-pointer",
                isSelected
                  ? "border-[var(--color-warm)] bg-[var(--color-warm-muted)]"
                  : "border-edge hover:border-[var(--color-edge-strong)] hover:bg-surface-2"
              )}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] font-semibold text-fg truncate">{t.name}</span>
                <span className={cn("text-[8px] px-1 py-0.5 rounded shrink-0", catInfo?.color || "bg-surface-2 text-fg-faint")}>
                  {t.aspect_ratio}
                </span>
              </div>
              <p className="text-[8px] text-fg-faint leading-tight line-clamp-2">{t.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Carousel Type Selector ────────────────────────────────

interface CarouselType {
  id: string;
  name: string;
  description: string;
  slides: number;
  structure: Array<{ role: string; label: string; hint: string }>;
}

function CarouselTypeSelector({
  selectedType,
  numSlides,
  onSelectType,
  onChangeSlides,
}: {
  selectedType: string;
  numSlides: number;
  onSelectType: (id: string) => void;
  onChangeSlides: (n: number) => void;
}) {
  const [types, setTypes] = useState<CarouselType[]>([]);

  useEffect(() => {
    fetch("http://localhost:8000/api/tools/carousel-creator/types")
      .then((r) => r.json())
      .then((data) => setTypes(data.types || []))
      .catch(() => {});
  }, []);

  const selected = types.find((t) => t.id === selectedType);

  return (
    <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-[12px] font-semibold text-fg-secondary">
          Carousel Type
          <span className="text-fg-faint font-normal ml-1">({types.length} types)</span>
        </label>
        {selectedType && (
          <button
            onClick={() => onSelectType("")}
            className="text-[10px] text-fg-faint hover:text-fg cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {types.map((t) => {
          const isSelected = selectedType === t.id;
          return (
            <button
              key={t.id}
              onClick={() => {
                onSelectType(isSelected ? "" : t.id);
                if (!isSelected) onChangeSlides(t.slides);
              }}
              className={cn(
                "text-left px-2.5 py-2 rounded-[var(--radius-sm)] border transition-all cursor-pointer",
                isSelected
                  ? "border-[var(--color-warm)] bg-[var(--color-warm-muted)]"
                  : "border-edge hover:border-[var(--color-edge-strong)] hover:bg-surface-2"
              )}
            >
              <span className="text-[10px] font-semibold text-fg">{t.name}</span>
              <p className="text-[8px] text-fg-faint leading-tight line-clamp-2 mt-0.5">{t.description}</p>
            </button>
          );
        })}
      </div>

      {/* Slide count */}
      <div className="flex items-center gap-3 pt-1">
        <label className="text-[11px] text-fg-muted">Slides:</label>
        {[3, 4, 5, 6].map((n) => (
          <button
            key={n}
            onClick={() => onChangeSlides(n)}
            className={cn(
              "w-7 h-7 rounded-[var(--radius-sm)] text-[11px] font-medium transition-colors cursor-pointer",
              numSlides === n
                ? "bg-[var(--color-warm)] text-[var(--color-warm-fg)]"
                : "bg-surface-2 text-fg-muted hover:text-fg"
            )}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Selected type structure preview */}
      {selected && (
        <div className="bg-surface-0 border border-edge rounded-[var(--radius-sm)] p-2.5 space-y-1">
          <span className="text-[9px] font-semibold text-fg-faint uppercase tracking-wider">Slide Structure</span>
          {selected.structure.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-[10px]">
              <span className="text-fg-faint shrink-0 w-4">{i + 1}.</span>
              <span className="text-fg font-medium">{s.label}</span>
              <span className="text-fg-faint">— {s.hint}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Curation Fix Grid ─────────────────────────────────────

function CurationFixGrid({ picks, brand, config }: {
  picks: Array<{ sceneId: string; title: string; selectedUrl: string }>;
  brand: Brand;
  config: ToolConfig;
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [selectedProductId, setSelectedProductId] = useState(config.selectedProductId || "");
  const [selectedImageUrls, setSelectedImageUrls] = useState<string[]>([]);
  const [editPrompt, setEditPrompt] = useState("Replace the product in this image with the product from the reference. Keep the person, pose, background, and lighting identical.");
  const [loading, setLoading] = useState(false);
  const [, forceUpdate] = useState(0);

  const products = brand.products || [];

  const openEdit = (idx: number) => {
    setEditingIdx(idx);
    // Pre-select current product
    const pid = config.selectedProductId || products[0]?.id || "";
    setSelectedProductId(pid);
    // Pre-select all images of that product
    const p = products.find((pr) => pr.id === pid);
    if (p) {
      setSelectedImageUrls([p.imageUrl, ...(p.images || []).map((img) => img.imageUrl)]);
    }
  };

  const handleProductChange = (pid: string) => {
    setSelectedProductId(pid);
    const p = products.find((pr) => pr.id === pid);
    if (p) {
      setSelectedImageUrls([p.imageUrl, ...(p.images || []).map((img) => img.imageUrl)]);
    }
  };

  const toggleImage = (url: string) => {
    setSelectedImageUrls((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
    );
  };

  const handleFix = async () => {
    if (editingIdx === null || selectedImageUrls.length === 0) return;
    const pick = picks[editingIdx];
    setLoading(true);
    try {
      const job = await createImageEdit(
        [pick.selectedUrl, ...selectedImageUrls],
        editPrompt,
        config.aspectRatio || "9:16",
        config.resolution || "1K"
      );
      const result = await pollImageGen(job.request_id);
      if (result.image_url) {
        pick.selectedUrl = result.image_url;
        forceUpdate((n) => n + 1);
      }
    } catch (err) {
      console.error("Fix failed:", err);
    } finally {
      setLoading(false);
      setEditingIdx(null);
    }
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  return (
    <>
      <div className="grid grid-cols-4 gap-3">
        {picks.map((pick, i) => (
          <div key={pick.sceneId} className="space-y-1.5">
            <div className="aspect-[9/16] rounded-[var(--radius-sm)] overflow-hidden border-2 border-[var(--color-success)] relative group">
              <img src={pick.selectedUrl} alt={pick.title} className="w-full h-full object-cover" />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <button
                  onClick={() => openEdit(i)}
                  className="flex-1 text-[9px] font-medium text-[var(--color-warm-fg)] bg-[var(--color-warm)] hover:opacity-90 rounded px-2 py-1 cursor-pointer"
                >
                  Edit
                </button>
              </div>
            </div>
            <p className="text-[11px] text-fg font-medium text-center">{i + 1}. {pick.title}</p>
          </div>
        ))}
      </div>

      {/* Edit panel */}
      {editingIdx !== null && (
        <div className="bg-surface-0 border border-edge rounded-[var(--radius-md)] p-4 space-y-3 mt-3">
          <div className="flex items-center justify-between">
            <h4 className="text-[12px] font-semibold text-fg">
              Edit Scene {editingIdx + 1} — {picks[editingIdx].title}
            </h4>
            <button onClick={() => setEditingIdx(null)} className="text-[10px] text-fg-faint hover:text-fg cursor-pointer">
              Cancel
            </button>
          </div>

          {/* Product selector */}
          {products.length > 0 && (
            <div className="space-y-2">
              <label className="text-[10px] font-medium text-fg-faint uppercase tracking-wider">Product Reference</label>
              <div className="flex gap-2 flex-wrap">
                {products.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleProductChange(p.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-sm)] border text-[11px] cursor-pointer transition-all",
                      selectedProductId === p.id
                        ? "border-[var(--color-warm)] bg-[var(--color-warm-muted)] text-fg"
                        : "border-edge hover:border-[var(--color-edge-strong)] text-fg-muted"
                    )}
                  >
                    <img src={productImageUrl(p.imageUrl)} alt={p.name} className="w-5 h-5 rounded object-cover" />
                    {p.name}
                  </button>
                ))}
              </div>

              {/* Image picker — select which photos to pass */}
              {selectedProduct && (
                <div className="flex gap-2">
                  {[
                    { url: selectedProduct.imageUrl, label: "Main" },
                    ...(selectedProduct.images || []).map((img) => ({ url: img.imageUrl, label: img.label || "Extra" })),
                  ].map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => toggleImage(img.url)}
                      className={cn(
                        "w-12 h-12 rounded-[var(--radius-sm)] overflow-hidden border-2 cursor-pointer transition-all",
                        selectedImageUrls.includes(img.url)
                          ? "border-[var(--color-warm)]"
                          : "border-edge opacity-50 hover:opacity-100"
                      )}
                    >
                      <img src={productImageUrl(img.url)} alt={img.label} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Editable prompt */}
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-fg-faint uppercase tracking-wider">Edit Prompt</label>
            <textarea
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              rows={3}
              className="w-full bg-surface-2 border border-edge rounded-[var(--radius-sm)] px-3 py-2 text-[12px] text-fg outline-none focus:border-[var(--color-edge-focus)] resize-none font-mono"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleFix}
              disabled={loading || selectedImageUrls.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium text-[var(--color-warm-fg)] bg-[var(--color-warm)] rounded-[var(--radius-sm)] hover:opacity-90 cursor-pointer disabled:opacity-40"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
              {loading ? "Generating..." : "Apply Edit"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ──────────────────────────────────────────────────────────────────
// UGC Config Panel — premium, grouped sections + presets
// ──────────────────────────────────────────────────────────────────

type UGCPreset = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  config: Partial<ToolConfig>;
};

const UGC_PRESETS: UGCPreset[] = [
  {
    id: "fast",
    name: "UGC Rápido",
    emoji: "⚡",
    description: "Estándar · iPhone · Sin hook",
    config: {
      ugcMode: "standard",
      lipsyncMethod: "heygen",
      visualStyle: "iphone",
      hookType: "none",
    },
  },
  {
    id: "narrative-cine",
    name: "Narrativo Cine",
    emoji: "🎬",
    description: "Narrativo · Cinematic · Hook distraído",
    config: {
      ugcMode: "narrative",
      lipsyncMethod: "synclipsync",
      visualStyle: "cinematic",
      hookType: "distracted",
      creativeMode: "frame-to-frame",
    },
  },
  {
    id: "editorial",
    name: "Editorial Fashion",
    emoji: "✨",
    description: "Studio · Luz profesional · Sin hook",
    config: {
      ugcMode: "standard",
      lipsyncMethod: "synclipsync",
      visualStyle: "studio",
      hookType: "none",
    },
  },
  {
    id: "vlog",
    name: "Vlog Casual",
    emoji: "📱",
    description: "iPhone · Hook distraído · HeyGen",
    config: {
      ugcMode: "standard",
      lipsyncMethod: "heygen",
      visualStyle: "iphone",
      hookType: "distracted",
    },
  },
];

function UGCConfigPanel({
  config,
  setConfig,
}: {
  config: ToolConfig;
  setConfig: React.Dispatch<React.SetStateAction<ToolConfig>>;
}) {
  const activePreset = UGC_PRESETS.find((p) =>
    Object.entries(p.config).every(([k, v]) => (config as Record<string, unknown>)[k] === v)
  );

  const applyPreset = (preset: UGCPreset) => {
    setConfig((prev) => ({ ...prev, ...preset.config }));
  };

  return (
    <div className="space-y-5">
      {/* ── Presets bar ──────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-semibold text-fg-faint uppercase tracking-widest">Presets</span>
          {activePreset && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--color-warm-muted)] text-[var(--color-warm-strong)] font-medium">
              {activePreset.name} activo
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {UGC_PRESETS.map((p) => {
            const isActive = activePreset?.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => applyPreset(p)}
                className={cn(
                  "group relative text-left p-3 rounded-[var(--radius-md)] border transition-all cursor-pointer",
                  isActive
                    ? "border-[var(--color-warm)] bg-[var(--color-warm-muted)]"
                    : "border-edge bg-surface-1 hover:border-edge-strong hover:bg-surface-2"
                )}
              >
                <div className="flex items-start gap-2 mb-1.5">
                  <span className="text-[16px] leading-none">{p.emoji}</span>
                  <span className={cn(
                    "text-[12px] font-semibold leading-tight",
                    isActive ? "text-fg" : "text-fg"
                  )}>{p.name}</span>
                </div>
                <p className="text-[10px] text-fg-faint leading-snug">{p.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Section: Narrativa ───────────────────────────────── */}
      <UGCSection title="Narrativa" subtitle="Estructura del video">
        <UGCField label="Modo">
          <SegToggle
            value={config.ugcMode}
            onChange={(v) => setConfig((p) => ({ ...p, ugcMode: v as ToolConfig["ugcMode"] }))}
            options={[
              { id: "standard", label: "Estándar" },
              { id: "narrative", label: "Narrativo" },
            ]}
          />
          <FieldHint>
            {config.ugcMode === "standard" ? "Una locación, foco en el avatar." : "Múltiples ambientes, estilo cortometraje."}
          </FieldHint>
        </UGCField>

        {config.ugcMode === "narrative" && (
          <UGCField label="Escenas creativas">
            <SegToggle
              value={config.creativeMode}
              onChange={(v) => setConfig((p) => ({ ...p, creativeMode: v as ToolConfig["creativeMode"] }))}
              options={[
                { id: "single-frame", label: "Single Frame" },
                { id: "frame-to-frame", label: "Frame to Frame" },
              ]}
            />
            <FieldHint>
              {config.creativeMode === "single-frame" ? "Kling anima desde una imagen." : "Kling interpola hacia la siguiente escena."}
            </FieldHint>
          </UGCField>
        )}
      </UGCSection>

      {/* ── Section: Dirección visual ────────────────────────── */}
      <UGCSection title="Dirección visual" subtitle="Estética y look del material">
        <UGCField label="Estilo visual">
          <select
            value={config.visualStyle}
            onChange={(e) => setConfig((p) => ({ ...p, visualStyle: e.target.value as ToolConfig["visualStyle"] }))}
            className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-edge bg-surface-1 text-[12px] text-fg outline-none focus:border-[var(--color-warm)] cursor-pointer"
          >
            <option value="iphone">iPhone — UGC nativo handheld</option>
            <option value="cinematic">Cinematic — dramático, anamórfico</option>
            <option value="studio">Studio — limpio, comercial</option>
            <option value="custom">Custom — definís vos</option>
          </select>
          {config.visualStyle === "custom" && (
            <textarea
              value={config.visualStyleCustom}
              onChange={(e) => setConfig((p) => ({ ...p, visualStyleCustom: e.target.value }))}
              placeholder="FORMAT: Vertical 9:16... LIGHTING: ... STYLE: ..."
              rows={3}
              className="w-full mt-2 px-3 py-2 rounded-[var(--radius-sm)] border border-edge bg-surface-1 text-[11px] text-fg placeholder:text-fg-faint outline-none focus:border-[var(--color-warm)] resize-none"
            />
          )}
        </UGCField>
      </UGCSection>

      {/* ── Section: Hook de entrada ─────────────────────────── */}
      <UGCSection title="Hook de entrada" subtitle="Primeros segundos del video (scene 1)">
        <UGCField label="Tipo">
          <select
            value={config.hookType}
            onChange={(e) => setConfig((p) => ({ ...p, hookType: e.target.value as ToolConfig["hookType"] }))}
            className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-edge bg-surface-1 text-[12px] text-fg outline-none focus:border-[var(--color-warm)] cursor-pointer"
          >
            <option value="none">Sin hook</option>
            <option value="distracted">Distraído → mira a cámara</option>
            <option value="empty-room">Solo fondo → aparece</option>
            <option value="walks-in">Entra al frame</option>
            <option value="looks-down">Mira abajo → levanta vista</option>
            <option value="phone-flip">Flip del celu → selfie</option>
          </select>
          <FieldHint>
            {config.hookType === "none" && "Sin animación de entrada — arranca directo con lipsync."}
            {config.hookType === "distracted" && "Persona mirando al costado → gira a cámara."}
            {config.hookType === "empty-room" && "Fondo vacío → persona aparece en frame."}
            {config.hookType === "walks-in" && "Persona entrando al frame desde el costado."}
            {config.hookType === "looks-down" && "Persona mirando abajo → levanta la vista."}
            {config.hookType === "phone-flip" && "Back de celu → flip a selfie camera."}
          </FieldHint>
        </UGCField>

        {config.hookType !== "none" && (
          <UGCField label="Modo del hook">
            <SegToggle
              value={config.hookMode}
              onChange={(v) => setConfig((p) => ({ ...p, hookMode: v as ToolConfig["hookMode"] }))}
              options={[
                { id: "standard", label: "Llegada del avatar" },
                { id: "fooh", label: "FOOH surrealista" },
              ]}
            />
            {config.hookMode === "standard" ? (
              <FieldHint>El avatar aparece con una animación de entrada.</FieldHint>
            ) : (
              <div className="mt-2 space-y-1.5">
                <FieldHint>Escena surrealista (sin avatar) → transición a UGC.</FieldHint>
                <textarea
                  value={config.foohPrompt}
                  onChange={(e) => setConfig((p) => ({ ...p, foohPrompt: e.target.value }))}
                  placeholder="Ej: A giant floating hoodie drifts through the Buenos Aires skyline at golden hour..."
                  rows={3}
                  className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2.5 py-2 text-[11px] text-fg placeholder:text-fg-faint focus:outline-none focus:border-[var(--color-warm)] resize-none leading-relaxed"
                />
              </div>
            )}
          </UGCField>
        )}
      </UGCSection>

      {/* ── Section: Técnico ─────────────────────────────────── */}
      <UGCSection title="Técnico" subtitle="Motor de lipsync">
        <UGCField label="Lipsync engine">
          <SegToggle
            value={config.lipsyncMethod}
            onChange={(v) => setConfig((p) => ({ ...p, lipsyncMethod: v as ToolConfig["lipsyncMethod"] }))}
            options={[
              { id: "heygen", label: "HeyGen Avatar 4" },
              { id: "synclipsync", label: "Sync Lipsync V3" },
            ]}
          />
          <FieldHint>
            {config.lipsyncMethod === "heygen" ? "Imagen → HeyGen directo. Más rápido." : "Imagen → Kling → lipsync. Movimiento más natural."}
          </FieldHint>
        </UGCField>
      </UGCSection>
    </div>
  );
}

function UGCSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-surface-1/50 border border-edge rounded-[var(--radius-md)] overflow-hidden">
      <header className="px-4 py-3 border-b border-edge-subtle bg-surface-1">
        <h3 className="text-[12px] font-semibold text-fg tracking-tight">{title}</h3>
        {subtitle && <p className="text-[10px] text-fg-faint mt-0.5">{subtitle}</p>}
      </header>
      <div className="p-4 space-y-4">{children}</div>
    </section>
  );
}

function UGCField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-medium text-fg-muted uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <p className="text-[10px] text-fg-faint leading-relaxed mt-1.5">{children}</p>;
}

function SegToggle({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <div className="inline-flex bg-surface-2 rounded-[var(--radius-sm)] p-0.5 gap-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "px-3 py-1 text-[11px] font-semibold rounded-[calc(var(--radius-sm)-1px)] transition-all cursor-pointer",
            value === o.id ? "bg-[var(--color-warm)] text-[var(--color-warm-fg)] shadow-sm" : "text-fg-faint hover:text-fg"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}


// ──────────────────────────────────────────────────────────────────
// Voice Settings Panel — ElevenLabs tuning (collapsible)
// ──────────────────────────────────────────────────────────────────

const VOICE_PRESETS = [
  { id: "natural", label: "Natural", emoji: "🎙️", stability: 0.5, style: 0.0, speed: 1.0, hint: "Balance expresividad/estabilidad. Default recomendado." },
  { id: "stable", label: "Estable", emoji: "📻", stability: 0.75, style: 0.0, speed: 1.0, hint: "Voz consistente, poca variación emocional. Bueno para contenido corporativo." },
  { id: "expressive", label: "Expresiva", emoji: "🎭", stability: 0.3, style: 0.4, speed: 1.0, hint: "Más emoción y variación. Bueno para UGC dinámico." },
  { id: "slow-calm", label: "Calma", emoji: "🌙", stability: 0.6, style: 0.1, speed: 0.9, hint: "Ligeramente más lenta y calma. ASMR / reflexivo." },
  { id: "energetic", label: "Energética", emoji: "⚡", stability: 0.35, style: 0.5, speed: 1.05, hint: "Rápida y expresiva. Hooks y ads de alto impacto." },
];

function VoiceSettingsPanel({
  config,
  setConfig,
}: {
  config: ToolConfig;
  setConfig: React.Dispatch<React.SetStateAction<ToolConfig>>;
}) {
  const [open, setOpen] = useState(false);

  const activePreset = VOICE_PRESETS.find(
    (p) =>
      Math.abs(p.stability - config.voiceStability) < 0.01 &&
      Math.abs(p.style - config.voiceStyle) < 0.01 &&
      Math.abs(p.speed - config.voiceSpeed) < 0.01
  );

  const applyPreset = (p: (typeof VOICE_PRESETS)[0]) => {
    setConfig((prev) => ({
      ...prev,
      voiceStability: p.stability,
      voiceStyle: p.style,
      voiceSpeed: p.speed,
    }));
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-[var(--radius-sm)] bg-surface-2 border border-edge hover:border-edge-strong transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Mic size={12} className="text-fg-faint" />
          <span className="text-[11px] font-medium text-fg-muted uppercase tracking-wider">Voz ElevenLabs v3</span>
          <span className="text-[10px] text-fg-faint">
            · {activePreset ? activePreset.label : "Custom"} · vel {config.voiceSpeed.toFixed(2)}x
          </span>
        </div>
        <ChevronRight size={12} className={cn("text-fg-faint transition-transform", open && "rotate-90")} />
      </button>

      {open && (
        <div className="space-y-4 p-3 rounded-[var(--radius-sm)] border border-edge bg-surface-1">
          {/* Presets */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-semibold text-fg-faint uppercase tracking-widest">Presets</span>
            <div className="grid grid-cols-5 gap-1.5">
              {VOICE_PRESETS.map((p) => {
                const isActive = activePreset?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p)}
                    title={p.hint}
                    className={cn(
                      "flex flex-col items-center py-2 px-1 rounded-[var(--radius-sm)] border text-center transition-all cursor-pointer",
                      isActive
                        ? "border-[var(--color-warm)] bg-[var(--color-warm-muted)]"
                        : "border-edge bg-surface-2 hover:border-edge-strong"
                    )}
                  >
                    <span className="text-[14px] leading-none mb-0.5">{p.emoji}</span>
                    <span className="text-[9px] font-medium text-fg-muted">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sliders */}
          <Slider
            label="Estabilidad"
            hint="0 = muy expresivo · 1 = muy estable/monótono"
            value={config.voiceStability}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => setConfig((p) => ({ ...p, voiceStability: v }))}
          />
          <Slider
            label="Estilo / Emoción"
            hint="0 = natural · 1 = exagerado"
            value={config.voiceStyle}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => setConfig((p) => ({ ...p, voiceStyle: v }))}
          />
          <Slider
            label="Similaridad al clon"
            hint="0 = libre · 1 = fiel al clon original"
            value={config.voiceSimilarityBoost}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => setConfig((p) => ({ ...p, voiceSimilarityBoost: v }))}
          />
          <Slider
            label="Velocidad"
            hint="0.7 = lento · 1.0 = normal · 1.2 = rápido"
            value={config.voiceSpeed}
            min={0.7}
            max={1.2}
            step={0.05}
            onChange={(v) => setConfig((p) => ({ ...p, voiceSpeed: v }))}
          />

          {/* Speaker boost */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.voiceSpeakerBoost}
              onChange={(e) => setConfig((p) => ({ ...p, voiceSpeakerBoost: e.target.checked }))}
              className="accent-[var(--color-warm)]"
            />
            <span className="text-[11px] text-fg-muted">Speaker boost — mejora claridad y similaridad</span>
          </label>

          <p className="text-[10px] text-fg-faint leading-relaxed pt-1 border-t border-edge-subtle">
            Cambiá <strong>Estabilidad</strong> bajando si la voz suena muy plana. Subí <strong>Estilo</strong>{" "}
            para más emoción. <strong>Velocidad</strong> afecta al lip-sync y a la duración de las scenes.
          </p>
        </div>
      )}
    </div>
  );
}

function Slider({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-medium text-fg-muted tracking-tight">{label}</label>
        <span className="text-[11px] tabular-nums font-medium text-fg bg-surface-2 border border-edge rounded-full px-2 py-0.5 min-w-[44px] text-center">
          {value.toFixed(2)}
        </span>
      </div>
      <div className="relative h-6 flex items-center">
        <div className="absolute left-0 right-0 h-[3px] bg-surface-3 rounded-full" />
        <div
          className="absolute left-0 h-[3px] bg-[var(--color-warm)] rounded-full pointer-events-none transition-[width] duration-100"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute w-3.5 h-3.5 rounded-full bg-[var(--color-warm)] shadow-[0_0_0_3px_var(--color-warm-muted)] pointer-events-none transition-[left] duration-100"
          style={{ left: `calc(${pct}% - 7px)` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
      {hint && <p className="text-[9.5px] text-fg-faint leading-tight">{hint}</p>}
    </div>
  );
}


// ──────────────────────────────────────────────────────────────────
// Per-scene Avatar toggle — controls whether the avatar appears in the scene
// ──────────────────────────────────────────────────────────────────

function AvatarToggle({ scene }: { scene: { id: string; _useAvatar?: boolean } & Record<string, unknown> }) {
  // tick to force re-render on mutation
  const [, force] = useState(0);
  const useAvatar = scene._useAvatar !== false;

  const toggle = () => {
    scene._useAvatar = useAvatar ? false : true;
    // when disabling avatar on a talking scene, switch downstream sceneType to creative
    // so lipsync handler skips HeyGen and uses Kling + voiceover overlay instead
    if (!useAvatar === false) {
      // turning OFF
      if (scene.sceneType === "talking") {
        scene.sceneType = "creative";
      }
    }
    force((x) => x + 1);
  };

  return (
    <button
      onClick={toggle}
      title={useAvatar ? "Avatar aparece en esta escena" : "Sin avatar — solo producto / acción / voz en off"}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-semibold rounded-full border transition-colors cursor-pointer",
        useAvatar
          ? "text-fg bg-surface-2 border-edge hover:border-edge-strong"
          : "text-amber-400 bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20"
      )}
    >
      <span>{useAvatar ? "👤" : "🚫"}</span>
      {useAvatar ? "Avatar ON" : "Avatar OFF"}
    </button>
  );
}
