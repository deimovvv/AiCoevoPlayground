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
  ChevronDown,
  Trash2,
} from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import {
  avatarImageUrl, productImageUrl, clothingImageUrl, backgroundImageUrl, moodboardImageUrl,
  type Brand,
  generateCopy, regenerateScene, generateTTS, generateTTSAndUpload, createImageEdit, pollImageGen,
  createFalLipSync, pollFalLipSync, concatVideos, saveGeneration,
  generateToolPrompt, createKlingVideo, pollKlingVideo,
  createKlingFrameToFrame, createSeedanceReferenceToVideo, pollSeedanceVideo,
  resolveAgentBrief,
  uploadAvatar, uploadClothing, uploadBackground, uploadMoodboard,
  deleteClothing, deleteAvatar, deleteProduct, deleteBackground, deleteMoodboard,
  createHeyGenAvatar4, pollHeyGenAvatar4,
  fetchSystemVoices,
  fetchBrandActions,
  getTikTokTopVideos,
  classifyReferenceImage,
  analyzeMotionFromVideo,
  curateMotionPrompt,
  type TikTokVideo,
  type ActionCategory,
} from "../lib/api";
import { cn, downloadUrl, IMAGE_ACCEPT } from "../lib/utils";
import { downloadFile, downloadZip } from "../lib/download";
import { ImageEditPanel } from "../components/ImageEditPanel";
import { SHOT_CATALOG, STUDIO_STYLES, POSE_PRESETS } from "../tools/ecommerce_pack";
import { AVATAR_VIEWS } from "../tools/avatar_creator";
import { VIDEO_SHOT_CATALOG, DEFAULT_LOOKS_SHOTS } from "../tools/fashion_reel";
import { PRODUCT_VIEW_CATALOG, DEFAULT_PRODUCT_VIEWS } from "../tools/product_sheet";
import { EDITORIAL_FRAMINGS, EDITORIAL_LIGHTING, EDITORIAL_VIBES } from "../tools/fashion_editorial";
import { Collapsible } from "../components/ui/section";
import { ModelDropdown } from "../components/ui/ModelDropdown";
import { ComposeOverlay } from "../components/ComposeOverlay";
import { UGCPlayer } from "../remotion/UGCPlayer";
import { TOOL_DEFINITIONS } from "../tools/registry";
import { autoSaveStep, getActiveGenId, setActiveGenId, clearActiveGen } from "../tools/shared/autoSave";

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
  map_assets: {
    label: "Mapeo de assets",
    icon: <Wand2 size={15} />,
    description: "Confirmá qué assets de tu brand kit usar (detectados automáticamente)",
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
  generate_all: {
    label: "Generar",
    icon: <Camera size={15} />,
    description: "Generá todas las tomas seleccionadas, consistentes entre sí",
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

// ── Batches acumulativas para tools multi-shot ──────────────────
// Cada Generar exitoso en ecommerce_pack (y futuras tools batchables) pushea
// uno de estos. El renderer muestra todos apilados, más reciente arriba.
interface BatchEntry {
  id: string;             // único: timestamp+random
  createdAt: number;      // ms epoch — para etiquetar "hace 5 min"
  label: string;          // derivado de la config (ej. "Flats · 6 imágenes")
  shotIds: string[];      // qué shots se eligieron en esa tanda
  images: Array<{ id: string; url: string; label: string; prompt?: string; status?: string }>;
}

// Tools donde activamos el comportamiento de tandas acumulativas.
// Si una tool NO está acá, el render del result sigue siendo lineal (1 sola tanda).
const BATCHABLE_TOOLS = new Set<string>(["ecommerce_pack"]);

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
  // Pose reference — body position / framing ONLY (scoped in handlers so it doesn't
  // bleed lighting/scene/style). Separate from referenceImages (which is look&feel).
  poseReference: File[];
  // Video Swap (Beeble SwitchX): the user's source video + how to mask it.
  sourceVideo: File[];
  alphaMode: "auto" | "select" | "fill" | "custom";
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
  lipsyncMethod: "heygen";
  creativeMode: "single-frame" | "frame-to-frame" | "auto";
  visualStyle: "iphone" | "cinematic" | "studio" | "custom" | "editorial";
  visualStyleCustom: string;
  reelMode: "story" | "looks";
  // Ecommerce Pack
  studioStyle: string;
  ecomShots: string[];
  // Pose ref por shot (data URL). El usuario sube una imagen de pose para
  // cada shot tildado y el handler la pasa como ref al generar ESE shot.
  // Da dinámica (poses dinámicas en lugar de modelo duro). One-off, no Brand Kit.
  ecomShotPoses: Record<string, string>;
  /** Preset textual de pose para Ecommerce Pack. "auto" = rota entre 8 poses
   *  preset (una por shot). Una pose preset específica = todos los shots con
   *  esa pose. "upload" = el usuario sube imagen ref (pose transfer 2-step).
   *  Por default "auto" para que el catálogo tenga variedad. */
  ecomPosePreset: string;
  // Clothing items marcados como "solo styling" — accesorios (zapatillas, collar,
  // gorra) que aparecen como ref en on-model shots pero NO generan flats propios.
  // Subset de selectedClothingIds. Reportado: "me pasan también las zapatillas o
  // un collar, no necesito foto de producto de eso".
  ecomAccessoryIds: string[];
  // Fashion Reel — Looks mode: shots seleccionados por outfit (general / detail / etc.)
  // Cantidad por shot: un shot puede repetirse N veces para generar varias escenas
  // del mismo plano (ej. 2 planos generales del mismo outfit). El array contiene
  // ENTRADAS REPETIDAS — ej. ["general","general","detail"] = 2 generales + 1 detail.
  // El handler recorre el array tal cual; el orden importa para el reel final.
  looksShots: string[];
  // Fashion Reel — preset de escenario que pisa el setting inferido. "brand" usa
  // el background del Brand Kit + settingOverride; el resto fuerza un texto fijo
  // ("estudio fondo blanco infinito con luz softbox", etc.) directo al image_prompt.
  locationPreset: "brand" | "studio_white" | "studio_black" | "street" | "natural";
  // Fashion Reel — duración por clip individual (no del video total). Kling V3 Pro
  // solo acepta 5s o 10s (mínimo 5). El total = N escenas × clipDuration.
  clipDuration: "5" | "10";
  // Product Sheet — vistas seleccionadas por el usuario (hero_34 / side / front / etc.).
  // Cada vista = una imagen individual generada con base_prompt + composition por vista.
  // Si vacío, el handler usa DEFAULT_PRODUCT_VIEWS (hero_34 + side + front).
  productSheetViews: string[];
  // Background ad-hoc dataURL (subido en Content Analyzer Mapeo, viaja al handoff).
  // Vive solo durante la sesión, no se guarda al Brand Kit. Fashion Reel handler
  // lo usa como ref de location en handleBaseImage / handleMultishot.
  adHocBackgroundUrl?: string;
  // Fashion Editorial
  editorialFraming: string;
  editorialLighting: string;
  editorialVibe: string;
  hookType: "none" | "distracted" | "empty-room" | "walks-in" | "looks-down" | "phone-flip";
  hookMode: "standard" | "fooh";
  foohPrompt: string;
  // ElevenLabs voice settings
  voiceStability: number;
  voiceSimilarityBoost: number;
  voiceStyle: number;
  voiceSpeed: number;
  voiceSpeakerBoost: boolean;
  // Image model
  imageModel: "nano-banana-2" | "gpt-image-2";
  referenceMode: "style" | "composition";
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
  numVariations: 1,
  locationRef: "",
  styleRef: "",
  productIsWorn: false,
  aspectRatio: "9:16",
  resolution: "2K",
  subtitleEngine: "auto",
  referenceImages: [],
  poseReference: [],
  sourceVideo: [],
  alphaMode: "auto",
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
  // Default cambiado de "auto" a "single-frame": el comportamiento "auto" forzaba
  // frame-to-frame en Looks mode sin avisar y los usuarios lo descubrían por sorpresa.
  // single-frame es predecible (cada plano se anima en su lugar); el usuario que quiera
  // f2f lo elige explícitamente desde el bloque "Movimiento de cada clip" en Fashion Reel.
  creativeMode: "single-frame",
  visualStyle: "iphone",
  visualStyleCustom: "",
  reelMode: "story",
  studioStyle: "white",
  ecomShots: ["model_front", "model_back", "model_detail", "flat_front"],
  ecomShotPoses: {},
  ecomPosePreset: "auto",
  ecomAccessoryIds: [],
  looksShots: ["general", "detail"],
  locationPreset: "brand",
  clipDuration: "5",
  productSheetViews: ["hero_34", "side", "front"],
  editorialFraming: "full_body",
  editorialLighting: "dramatic",
  editorialVibe: "magazine",
  hookType: "none",
  hookMode: "standard",
  foohPrompt: "",
  voiceStability: 0.5,
  voiceSimilarityBoost: 0.8,
  voiceStyle: 0.0,
  voiceSpeed: 1.0,
  voiceSpeakerBoost: true,
  imageModel: "nano-banana-2",
  referenceMode: "style",
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
  const autoStartFromUrl = searchParams.get("autoStart") === "1";
  const { activeBrand } = useBrand();
  const [tool, setTool] = useState<ToolEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState<StepState[]>([]);
  const stepsRef = useRef<StepState[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [started, setStarted] = useState(false);
  // Set when an agent/URL hand-off requests auto-start. A dedicated effect picks this
  // up and runs step 0 — done in an effect (not inline) so handleRunStep executes with
  // the just-applied config instead of the stale closure from the hand-off effect.
  const [pendingAutoRun, setPendingAutoRun] = useState(false);
  const [config, setConfig] = useState<ToolConfig>(DEFAULT_CONFIG);
  const [agentInfo, setAgentInfo] = useState<{ reasoning?: string; warnings?: string[] } | null>(null);
  // ── Batches acumulativas (tools multi-shot) ───────────────────────────────
  // Cada vez que termina una corrida exitosa del step generate_all en una tool
  // batchable (ecommerce_pack por ahora; sumar fashion_reel/product_sheet después),
  // pusheamos una entry acá. El renderer detecta batches.length > 1 y muestra la
  // vista stacked en lugar de la lineal. Permite "generé flats, ahora on-model
  // sin perder lo de antes". Scope: sesión (se pierde al recargar — OK por ahora,
  // si el usuario quiere persistencia lo migramos a /content).
  const [batches, setBatches] = useState<BatchEntry[]>([]);
  // Flag para que el próximo Generar del usuario SUME una tanda en vez de pisar
  // la sesión actual. Se enciende cuando clickeás "Nueva tanda" desde el panel
  // de resultados.
  const [newBatchPending, setNewBatchPending] = useState(false);
  const [mockRunning, setMockRunning] = useState(false);
  const [curationSelections, setCurationSelections] = useState<Record<string, string>>({}); // sceneId → variationId
  const [audioCache, setAudioCache] = useState<Record<string, { url: string; blob: Blob }>>({}); // sceneId → {url, blob}
  const [validationError, setValidationError] = useState<string | null>(null);
  const audioCacheRef = useRef<Record<string, { url: string; blob: Blob }>>({});

  // Keep refs in sync so async callbacks always read latest
  useEffect(() => { stepsRef.current = steps; }, [steps]);
  useEffect(() => { audioCacheRef.current = audioCache; }, [audioCache]);
  // Reset de tandas al cambiar de tool — evita que entres a otra tool y veas
  // tandas viejas con outputs de la anterior. Scope sigue siendo "una sesión
  // por tool".
  useEffect(() => { setBatches([]); setNewBatchPending(false); }, [toolId]);

  useEffect(() => {
    if (!toolId) return;
    fetch(`http://127.0.0.1:8000/api/tools/${toolId}`)
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

  // If URL has ?gen=, register it as the active draft for auto-save.
  // If NOT — we're starting fresh — clear any stale genId in sessionStorage
  // so the next autoSaveStep creates a new generation instead of overwriting
  // the previous one. Without this, every new UGC/Fashion Reel run for the
  // same brand kept replacing the previous saved generation in Contenido.
  useEffect(() => {
    if (!tool || !activeBrand) return;
    if (generationId) {
      setActiveGenId(tool.id, activeBrand.id, generationId);
    } else {
      clearActiveGen(tool.id, activeBrand.id);
    }
  }, [generationId, tool, activeBrand]);

  // Auto-save whenever a step transitions to done/review with a result.
  // Debounced via ref to avoid firing on every partial state change.
  const lastSavedSignatureRef = useRef<string>("");
  useEffect(() => {
    if (!tool || !activeBrand || !started) return;
    const doneSteps = steps.filter((s) => (s.status === "done" || s.status === "review") && s.result);
    if (doneSteps.length === 0) return;

    // Signature = which steps have a result (by id) → only save when new results appear
    const signature = doneSteps.map((s) => s.id).join("|");
    if (signature === lastSavedSignatureRef.current) return;
    lastSavedSignatureRef.current = signature;

    // Derive payload from the last completed step
    const lastStep = doneSteps[doneSteps.length - 1];
    const result = lastStep.result as Record<string, unknown> | undefined;
    const isVideoTool = tool.pipeline.some((p) => p === "render" || p === "animate" || p === "lipsync");
    // Find the best thumbnail across known result shapes:
    // images[0] (Static Ad / Ad Creative Lab) | slides[0] (Carousel) | scenes[0] (UGC) |
    // selections[0].selectedUrl (UGC curation) | url / image_url / thumbnailUrl
    const firstUrlInArray = (arr: unknown): string | undefined => {
      if (!Array.isArray(arr)) return undefined;
      for (const item of arr) {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const obj = item as Record<string, unknown>;
          const u = obj.url || obj.imageUrl || obj.image_url || obj.selectedUrl;
          if (typeof u === "string" && u) return u;
        }
      }
      return undefined;
    };
    const thumbnail = (result?.thumbnailUrl as string)
      || (result?.url as string)
      || (result?.image_url as string)
      || firstUrlInArray(result?.images)
      || firstUrlInArray(result?.slides)
      || firstUrlInArray(result?.scenes)
      || firstUrlInArray(result?.selections)
      || firstUrlInArray(result?.frames);
    // outputUrl resolution:
    //  - Always prefer explicit outputUrl / video_url / videoUrl (covers all naming styles)
    //  - For VIDEO tools, NEVER fall back to result.url — that's typically the base_image PNG
    //    and would get saved as outputUrl for the whole generation (breaks playback in
    //    Contenido: the <video> tag tries to load a PNG and spins forever).
    //  - For image tools, falling back to result.url is fine (e.g. static_ad final image).
    let outputUrl: string | undefined =
      (result?.outputUrl as string)
      || (result?.video_url as string)
      || (result?.videoUrl as string);
    if (!outputUrl && !isVideoTool) {
      outputUrl = result?.url as string;
    }

    // Extract scenes from common shapes: images[] | slides[] | scenes[] | variations with selections
    let scenesPayload: Array<Record<string, unknown>> | undefined;
    if (Array.isArray(result?.images)) {
      scenesPayload = (result!.images as Array<{ id?: string; url?: string; label?: string }>).map((img, i) => ({
        id: img.id || `scene_${i}`,
        title: img.label || `Scene ${i + 1}`,
        imageUrl: img.url,
      }));
    } else if (Array.isArray(result?.slides)) {
      scenesPayload = (result!.slides as Array<{ id?: string; url?: string; title?: string }>).map((s, i) => ({
        id: s.id || `slide_${i}`,
        title: s.title || `Slide ${i + 1}`,
        imageUrl: s.url,
      }));
    } else if (Array.isArray(result?.selections)) {
      scenesPayload = (result!.selections as Array<{ sceneId?: string; title?: string; selectedUrl?: string }>).map((s, i) => ({
        id: s.sceneId || `scene_${i}`,
        title: s.title || `Scene ${i + 1}`,
        imageUrl: s.selectedUrl,
      }));
    }

    // Build metadata from top-level result fields that aren't complex objects
    const metadata: Record<string, unknown> = {};
    if (result) {
      for (const k of ["headline", "subline", "cta", "colors", "prompt", "script"] as const) {
        const v = result[k];
        if (typeof v === "string" && v) metadata[k] = v;
      }
      if (Array.isArray(result.images)) metadata.numVariations = (result.images as unknown[]).length;
      if (Array.isArray(result.slides)) metadata.numSlides = (result.slides as unknown[]).length;
    }

    const lastPipelineStep = steps[steps.length - 1];
    const isFullyDone = lastPipelineStep?.status === "done" && !!lastPipelineStep?.result;

    autoSaveStep({
      activeBrand,
      tool,
      config,
      steps,
      curationSelections,
      // Persisto las tandas para que al abrir un run viejo desde /content veas
      // TODAS las imágenes generadas, no solo la última tanda.
      batches: BATCHABLE_TOOLS.has(tool.id) && batches.length > 0
        ? batches.map((b) => ({ ...b })) as Array<Record<string, unknown>>
        : undefined,
      payload: {
        title: `${tool.name} — ${new Date().toLocaleDateString()}`,
        type: isVideoTool ? "video" : "image",
        status: isFullyDone ? "completed" : "in_progress",
        thumbnailUrl: thumbnail,
        outputUrl: outputUrl,
        scenes: scenesPayload,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      },
    }).catch(() => { /* handled inside */ });
  }, [steps, tool, activeBrand, started, config, curationSelections, batches]);

  // Load saved generation pipeline state if ?gen= param present
  useEffect(() => {
    if (!generationId || !tool) return;
    fetch(`http://127.0.0.1:8000/api/generations/${generationId}`)
      .then((r) => { if (!r.ok) throw new Error("Not found"); return r.json(); })
      .then((gen) => {
        if (!gen.pipelineState) return;
        const { steps: savedSteps, config: savedConfig, curationSelections: savedCurations, batches: savedBatches } = gen.pipelineState;
        // Restaurar tandas — sin esto, abrir un run viejo de ecommerce_pack solo
        // mostraba la última tanda generada.
        if (Array.isArray(savedBatches) && savedBatches.length > 0) {
          setBatches(savedBatches as BatchEntry[]);
        }
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

  // Apply handoff from chat ("Crear con esto" / "Crear automáticamente")
  useEffect(() => {
    if (!tool) return;
    try {
      const raw = sessionStorage.getItem("coevo-chat-handoff");
      if (!raw) return;
      const h = JSON.parse(raw) as {
        from: string;
        mode?: "auto" | "manual";
        brief?: string;
        tool?: string;
        config?: Partial<ToolConfig> & Record<string, unknown>;
        reasoning?: string;
        warnings?: string[];
        /** When true (set from chat's "Generar" button), auto-run the pipeline after config is applied. */
        autoStart?: boolean;
        attachments?: Array<{
          dataUrl: string;
          fileName?: string;
          mimeType?: string;
          classification?: { type: string; suggested_slot: string; description: string };
        }>;
        // Per-slide attachments — used by the IG replication flow so each generated slide
        // uses its own composition reference. Length should match config.numSlides.
        // Empty entries (no dataUrl) are kept to preserve index alignment.
        perSlideAttachments?: Array<{
          dataUrl: string;
          fileName?: string;
          mimeType?: string;
        }>;
      };
      if (h.from !== "chat" || h.tool !== tool.id) return;
      sessionStorage.removeItem("coevo-chat-handoff");

      // Helper: turn a base64 dataUrl into a File (returns null on failure).
      const dataUrlToFile = (dataUrl: string, fileName: string, mimeOverride?: string): File | null => {
        try {
          const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (!m) return null;
          const [, mime, b64] = m;
          const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          const blob = new Blob([bytes], { type: mimeOverride || mime });
          return new File([blob], fileName, { type: mimeOverride || mime });
        } catch {
          return null;
        }
      };

      // Convert attached dataURLs back to File objects (will be merged into referenceImages
      // in the single setConfig call below, to avoid race conditions between setters).
      const attachmentFiles: File[] = [];
      if (h.attachments && h.attachments.length > 0) {
        for (const att of h.attachments) {
          const file = dataUrlToFile(att.dataUrl, att.fileName || `chat-attachment-${Date.now()}.png`, att.mimeType);
          if (file) attachmentFiles.push(file);
          else console.warn("[handoff] attachment dataUrl format invalid");
        }
        console.log(`[handoff] ${attachmentFiles.length} attachments converted to Files (out of ${h.attachments.length})`);
      }

      // Per-slide attachment files (index-aligned with the slides). Empty entries become null
      // and are filtered out below — but we keep the alignment until the carousel handler reads them.
      const perSlideFiles: File[] = [];
      if (h.perSlideAttachments && h.perSlideAttachments.length > 0) {
        for (let i = 0; i < h.perSlideAttachments.length; i++) {
          const att = h.perSlideAttachments[i];
          if (!att?.dataUrl) continue;
          const file = dataUrlToFile(att.dataUrl, att.fileName || `slide-${i + 1}.jpg`, att.mimeType);
          if (file) perSlideFiles.push(file);
        }
        console.log(`[handoff] ${perSlideFiles.length} per-slide attachments converted (out of ${h.perSlideAttachments.length})`);
      }

      if (h.mode === "auto" && h.config) {
        // Auto mode: apply the full resolved config from the agent
        setConfig((prev) => {
          const next: ToolConfig = { ...prev };
          // Whitelist of fields we allow the agent to set (keeps type safety + security)
          const allowedKeys: (keyof ToolConfig)[] = [
            "selectedAvatarId", "selectedProductId", "selectedClothingIds",
            "selectedBackgroundId", "selectedVoiceId", "objective", "tone",
            "platform", "language", "numVariations", "aspectRatio", "resolution",
            "subtitleEngine", "videoDuration", "ugcMode", "visualStyle",
            "visualStyleCustom", "hookType", "hookMode", "lipsyncMethod",
            "creativeMode", "reelMode", "adStyle", "adTemplate", "carouselType",
            "numSlides", "voiceStability", "voiceSimilarityBoost", "voiceStyle",
            "voiceSpeed", "voiceSpeakerBoost", "productIsWorn",
            // Reference / Compose / Template behavior — needed for IG replicate flow
            "referenceMode", "composeMode", "overlayTemplate", "templateColorMode",
            "imageModel", "settingOverride", "includeCopy",
            // Static Ad batch
            "staticAdBatch", "staticAdCategory",
            // Full scene-by-scene script when the agent detected a structured brief —
            // without this, multi-scene scripts pasted in chat get aplastados into "objective"
            "customScript",
          ];
          for (const k of allowedKeys) {
            const v = (h.config as Record<string, unknown>)[k];
            if (v !== undefined && v !== null) {
              (next as Record<string, unknown>)[k] = v;
            }
          }
          // Ensure objective carries the brief if agent left it empty
          if (!next.objective && h.brief) next.objective = h.brief;
          // Merge attachment Files into referenceImages in the same setter (avoids race condition)
          if (attachmentFiles.length > 0) {
            next.referenceImages = [...prev.referenceImages, ...attachmentFiles].slice(0, 10);
          }
          if (perSlideFiles.length > 0) {
            next.perSlideTemplates = perSlideFiles;
          }
          return next;
        });
        // Store reasoning + warnings for visible banner
        if (h.reasoning || h.warnings?.length) {
          setAgentInfo({ reasoning: h.reasoning, warnings: h.warnings });
        }
      } else if (h.brief) {
        // Manual mode: just append brief to objective + apply attachments if any
        setConfig((prev) => ({
          ...prev,
          objective: prev.objective ? `${prev.objective}\n\n${h.brief}` : h.brief!,
          referenceImages: attachmentFiles.length > 0
            ? [...prev.referenceImages, ...attachmentFiles].slice(0, 10)
            : prev.referenceImages,
          perSlideTemplates: perSlideFiles.length > 0 ? perSlideFiles : prev.perSlideTemplates,
        }));
      } else if (attachmentFiles.length > 0 || perSlideFiles.length > 0) {
        // No config + no brief, but attachments came through → still apply them
        setConfig((prev) => ({
          ...prev,
          referenceImages: attachmentFiles.length > 0
            ? [...prev.referenceImages, ...attachmentFiles].slice(0, 10)
            : prev.referenceImages,
          perSlideTemplates: perSlideFiles.length > 0 ? perSlideFiles : prev.perSlideTemplates,
        }));
      }

      // Auto-start the pipeline when the chat's "Generar" button was used.
      // Mark step 0 active and flag the auto-run; the pendingAutoRun effect runs the
      // step once this render (with the new config) has committed. Previously this only
      // flipped `started`/`activeStep` and never marked step 0 active or ran it, so the
      // pipeline sat on "Waiting for previous steps to complete" and generated nothing.
      if ((h.autoStart || autoStartFromUrl) && !started) {
        setStarted(true);
        setActiveStep(0);
        setSteps((prev) => prev.map((s, i) => ({ ...s, status: (i === 0 ? "active" : "pending") as StepStatus })));
        setPendingAutoRun(true);
      }
    } catch (err) {
      console.error("[chat-handoff] parse error:", err);
    }
  }, [tool, autoStartFromUrl, started]);

  // Run step 0 after an agent/URL auto-start. Lives in its own effect so it fires on the
  // render where the hand-off's config has already committed — handleRunStep then reads
  // the agent's selections (avatar, clothing, …) instead of the pre-hand-off defaults.
  useEffect(() => {
    if (!pendingAutoRun) return;
    setPendingAutoRun(false);
    handleRunStep(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAutoRun]);

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
        analyzeData?: { analysis?: {
          content_type?: string;
          key_insights?: string;
          style_guide?: string;
          visual_style?: string;
          // Continuity metadata — drives whether downstream tools chain scenes or generate them independently
          narrative_shape?: "transformation" | "showcase" | "story" | "cyclic";
          state_continuity?: boolean;
          stateful_elements?: string[];
          // Visual DNA — gets prepended to every generation prompt so the look & feel of the source is replicated
          visual_signature?: string;
          lighting_style?: string;
          palette_temperature?: string;
          framing_signature?: string;
        } };
        selectedAvatarIds?: string[];
        selectedProductIds?: string[];
        selectedClothingIds?: string[];
        selectedAvatarId?: string | null;
        selectedProductId?: string | null;
        selectedBackgroundId?: string | null;
        /** Ad-hoc background dataURL subido en CA Mapeo — viaja al destino y se
         *  setea en cfg.adHocBackgroundUrl para que el handler lo use como ref. */
        adHocBackgroundDataUrl?: string;
      };
      console.log("[handoff] from:", handoff.from, "tool:", tool.id, "scenes:", handoff.adaptData?.scenes?.length);
      if (handoff.from !== "content_analyzer") return;
      // Wait until we're on the destination tool (not still on the source)
      if (tool.id === "content_analyzer") return;
      // Now safe to consume — remove from sessionStorage
      sessionStorage.removeItem(handoffKey);
      const { adaptData, analyzeData } = handoff;

      // Clear any reference images carried over from the Content Analyzer run. The CA stores
      // the uploaded video in config.referenceImages, and since the ToolRunPage component is
      // reused across the :toolId change, that video File would otherwise leak into the
      // destination tool's "pose reference" slot — which then tries to send a video to Nano
      // Banana as an image and fails. (URL-analyzed videos don't hit this because they come
      // through config.objective, not referenceImages.)
      setConfig((prev) => ({ ...prev, referenceImages: [] }));

      // Tools donde el producto NO se debe auto-propagar — el flujo es outfit-driven
      // y meter un producto fantasma del CA confunde el handler (reportado: "el
      // producto seguía seleccionado por defecto en Fashion Reel").
      const handoffSkipsProduct = tool.id === "fashion_reel"
        || tool.id === "ecommerce_pack"
        || tool.id === "fashion_editorial";

      // Always restore asset selections regardless of target tool
      const assetUpdates: Partial<ToolConfig> = {};
      if (handoff.selectedAvatarIds?.length) assetUpdates.selectedAvatarIds = handoff.selectedAvatarIds;
      if (handoff.selectedClothingIds?.length) assetUpdates.selectedClothingIds = handoff.selectedClothingIds;
      if (handoff.selectedAvatarId) assetUpdates.selectedAvatarId = handoff.selectedAvatarId;
      if (handoff.selectedBackgroundId) assetUpdates.selectedBackgroundId = handoff.selectedBackgroundId;
      if (!handoffSkipsProduct) {
        if (handoff.selectedProductIds?.length) assetUpdates.selectedProductIds = handoff.selectedProductIds;
        if (handoff.selectedProductId) assetUpdates.selectedProductId = handoff.selectedProductId;
      } else {
        // Forzar limpieza explícita — sin esto, el default auto-select previo del
        // useEffect persiste y el producto sigue "fantasma".
        assetUpdates.selectedProductId = null;
        assetUpdates.selectedProductIds = [];
      }
      // Ad-hoc background: viaja al cfg para que el handler lo use como ref de
      // location (Fashion Reel mira cfg.adHocBackgroundUrl en sus handlers).
      if (handoff.adHocBackgroundDataUrl) {
        (assetUpdates as unknown as Record<string, unknown>).adHocBackgroundUrl = handoff.adHocBackgroundDataUrl;
      }

      if (!adaptData) {
        if (Object.keys(assetUpdates).length) setConfig((prev) => ({ ...prev, ...assetUpdates }));
        return;
      }

      // Decidir reelMode automáticamente en Fashion Reel — antes quedaba siempre
      // en "story" (default) y el usuario tenía que cambiar a mano. Heurística:
      //   - múltiples outfits mapeados (> 1)  → Looks (catálogo de prendas)
      //   - content_type fashion/lookbook/ootd → Looks
      //   - default                             → Story (4 escenas narrativas)
      if (tool.id === "fashion_reel") {
        const ct = (analyzeData?.analysis?.content_type || "").toLowerCase();
        const multipleOutfits = (handoff.selectedClothingIds?.length || 0) > 1;
        const looksKeywords = ["lookbook", "ootd", "catalogo", "catalog", "outfit", "fashion-movement"];
        const looksByContentType = looksKeywords.some((k) => ct.includes(k));
        (assetUpdates as unknown as Record<string, unknown>).reelMode = (multipleOutfits || looksByContentType) ? "looks" : "story";
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
        const customScenes = adaptData.scenes.map((s, i) => {
          const cleanScript = (s.script || "").trim();
          // Scene type rule:
          //  - Fashion Reel or visual-only mode → always creative (no talking by design)
          //  - Otherwise: if the scene has a meaningful script line → talking, else b-roll/creative.
          //  - The OLD rule compared imagePrompt.length vs script.length*2, which always
          //    favored creative because image prompts are verbose 3-4 sentence English while
          //    scripts are short Spanish. Result: every UGC came out 100% creative.
          const hasMeaningfulScript = cleanScript.length > 5;
          return {
            id: `act_${i + 1}`,
            title: `Scene ${i + 1}`,
            script: (isVisual || isModelReel) ? "" : stripBilingual(s.script),
            visual: s.imagePrompt,
            shot: detectShotType(s.imagePrompt),
            sceneType: (isVisual || isModelReel)
              ? "creative"
              : (hasMeaningfulScript ? "talking" : "creative"),
          };
        });
        const modelReelObjective = analyzeData?.analysis?.key_insights
          ? String(analyzeData.analysis.key_insights).slice(0, 200)
          : "";
        // Continuity hints from the analyzer — drives chain mode in fashion_reel multishot
        const narrativeShape = analyzeData?.analysis?.narrative_shape;
        const stateContinuity = analyzeData?.analysis?.state_continuity === true;
        const statefulElements = Array.isArray(analyzeData?.analysis?.stateful_elements)
          ? analyzeData.analysis.stateful_elements
          : [];
        // Visual DNA from the source — used to recreate the look & feel of the analyzed video
        const visualSignature = analyzeData?.analysis?.visual_signature || "";
        const lightingStyle = analyzeData?.analysis?.lighting_style || "";
        const paletteTemperature = analyzeData?.analysis?.palette_temperature || "";
        const framingSignature = analyzeData?.analysis?.framing_signature || "";
        setConfig((prev) => ({
          ...prev,
          ...assetUpdates,
          objective: isModelReel ? modelReelObjective : "",
          visualStyle: isModelReel ? (isEditorial ? "editorial" : "cinematic") : visualStyle,
          ugcMode: isModelReel ? "standard" : ugcMode,
          customScript: JSON.stringify(customScenes, null, 2),
          // Continuity metadata propagated to the tool's handlers
          narrativeShape,
          stateContinuity,
          statefulElements,
          // Visual signature propagated — handlers prepend it to scene prompts (unless user overrides via styleRef)
          visualSignature,
          lightingStyle,
          paletteTemperature,
          framingSignature,
        } as ToolConfig));
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

  // Auto-invalidate `animate` step when `creativeMode` changes — sin esto el usuario
  // cambiaba el modo (frame-to-frame) DESPUÉS de animar, volvía al step y veía el
  // video viejo (single-frame) porque el step seguía en "done". Reportado como
  // "probé el frame-to-frame y no funcionó". Mismo principio para futuros toggles
  // que afecten un solo step: usar el mapping `CONFIG_TO_STEP_INVALIDATION`.
  const CONFIG_TO_STEP_INVALIDATION: Record<string, string[]> = {
    creativeMode: ["animate"],
    // entryHook afecta base_image (genera o no la escena vacía) y animate (que la usa).
    entryHook: ["base_image", "animate"],
    // clipDuration afecta SOLO animate (no las imágenes generadas).
    clipDuration: ["animate"],
  };
  useEffect(() => {
    setSteps((prev) => prev.map((s) => (
      s.id === "animate" && s.result ? { ...s, status: "stale" as StepStatus } : s
    )));
  }, [config.creativeMode, config.clipDuration]);
  useEffect(() => {
    setSteps((prev) => prev.map((s) => (
      CONFIG_TO_STEP_INVALIDATION.entryHook.includes(s.id) && s.result
        ? { ...s, status: "stale" as StepStatus }
        : s
    )));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(config as unknown as Record<string, unknown>).entryHook]);

  // Tool-specific config defaults
  useEffect(() => {
    if (!tool) return;
    if (tool.id === "carousel_creator" || tool.id === "static_ad") {
      setConfig((prev) => ({ ...prev, aspectRatio: "4:5" }));
    }
    // Fashion Reel: keep whatever style the user has set (default is iphone
    // — overriding to editorial was the old default before we standardized).
  }, [tool]);

  // Auto-select first avatar/product if available.
  // Excepción: en tools outfit-driven (Fashion Reel, Ecommerce Pack, Fashion Editorial)
  // NO auto-seleccionar producto — el flujo es prenda (clothing), no producto, y meter
  // un producto "fantasma" hace que el modelo termine sosteniendo un objeto sin sentido.
  // El usuario reportó: "le paso la prenda como outfit, pero siempre se selecciona un
  // pantalón de producto".
  const OUTFIT_DRIVEN_TOOLS = new Set(["fashion_reel", "ecommerce_pack", "fashion_editorial"]);
  useEffect(() => {
    if (!activeBrand) return;
    const skipProductAutoSelect = tool ? OUTFIT_DRIVEN_TOOLS.has(tool.id) : false;
    setConfig((prev) => ({
      ...prev,
      selectedAvatarId:
        prev.selectedAvatarId || activeBrand.avatars?.[0]?.id || null,
      selectedProductId: skipProductAutoSelect
        ? prev.selectedProductId  // respeta lo que ya hay, pero no fuerza el primero
        : (prev.selectedProductId || activeBrand.products?.[0]?.id || null),
      selectedVoiceId:
        prev.selectedVoiceId || activeBrand.voicePresets?.[0]?.id || null,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBrand, tool]);

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

        // ── Tandas acumulativas ────────────────────────────────────────────
        // Si la tool soporta batches y el step generate_all devolvió un set de
        // imágenes exitosas, pusheamos a la pila. La pila persiste entre
        // generaciones aunque cambies la config; "Nueva tanda" desde el panel
        // de resultados es lo que dispara este push.
        if (BATCHABLE_TOOLS.has(tool.id) && step.id === "generate_all" && result && typeof result === "object") {
          const r = result as { images?: Array<{ id: string; url: string; label: string; prompt?: string; status?: string }> };
          const successful = (r.images || []).filter((im) => im.url);
          if (successful.length > 0) {
            const shotIds = (config as unknown as Record<string, unknown>).ecomShots as string[] || [];
            const label = describeBatch(tool.id, shotIds, successful.length);
            const entry: BatchEntry = {
              id: `batch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              createdAt: Date.now(),
              label,
              shotIds: [...shotIds],
              images: successful,
            };
            setBatches((prev) => [entry, ...prev]);
            setNewBatchPending(false);
          }
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
    // Layout split tipo Lab v2 — la página entera ocupa la altura del viewport.
    // Sidebar izquierdo: TODO el control (ConfigPanel + footer sticky con Generar).
    // Área principal: pipeline chips horizontales + step activo. Sin scroll global,
    // cada zona scrollea independientemente.
    <div className="h-full flex flex-col overflow-hidden">
      {/* Slim header — breadcrumb + tool name + Manage Prompt. Generar/Reset van al
          footer del sidebar. Gradient muy sutil surface-1→surface-0 para que el
          header no quede plano. Sin hairline naranja — el tinte burgundy ambient
          quedaba raro contra el negro del fondo (feedback usuario). */}
      <header
        className="relative border-b border-edge px-5 py-2.5 flex items-center justify-between shrink-0"
        style={{ background: "linear-gradient(to bottom, var(--color-surface-1), var(--color-surface-0))" }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Link to="/dashboard/generate" className="text-fg-faint hover:text-fg transition-colors text-[12px]">
            Generate
          </Link>
          <ChevronRight size={11} className="text-fg-faint shrink-0" />
          <div className="w-7 h-7 rounded-md bg-surface-2 flex items-center justify-center text-fg-muted shrink-0">
            {TOOL_ICONS[tool.icon] || <Sparkles size={13} />}
          </div>
          <div className="flex items-baseline gap-2 min-w-0">
            <h1 className="text-[14px] font-semibold text-fg leading-none">{tool.name}</h1>
            <span className="text-[11px] text-fg-faint truncate">
              {tool.pipeline.length} steps{activeBrand && ` · ${activeBrand.name}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/dashboard/brand"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-fg-muted hover:text-fg bg-surface-1 hover:bg-surface-2 rounded-[var(--radius-sm)] transition-colors"
          >
            <Settings2 size={12} />
            Manage Prompt
          </Link>
          {started && (
            <button
              onClick={handleReset}
              disabled={mockRunning}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-fg-muted hover:text-fg bg-surface-1 hover:bg-surface-2 rounded-[var(--radius-sm)] transition-colors",
                mockRunning ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
              )}
            >
              <RotateCcw size={12} />
              Reset
            </button>
          )}
        </div>
      </header>

      {/* Body split: sidebar 440px + main */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── SIDEBAR control (440px) ────────────────────────────────
             Todo lo que ConfigPanel mostraba antes en el "main content" cuando
             !started. Ahora se ve siempre — incluso después de empezar, podés
             ajustar config y re-correr steps. Footer sticky con Generar/Validar. */}
        <aside
          className="w-[440px] shrink-0 border-r border-edge flex flex-col"
          style={{ background: "linear-gradient(to bottom, var(--color-surface-0), var(--color-canvas) 90%)" }}
        >
          {/* Form bloqueado: durante la generación (mockRunning) O ya cuando el
              pipeline arrancó (started === true). Una vez ejecutado, modificar
              config no surte efecto en los steps ya generados — para volver a usar
              el form, Reset en el header → empezar de cero. También aplica cuando
              se carga una generación histórica desde Contenido (started ya es true).
              Reportado: "el form sigue activo aunque ya se ejecutó".

              EXCEPCIÓN — tools batchables (ecommerce_pack, etc.): el form queda
              SIEMPRE editable. Cada Generar SUMA una tanda en lugar de pisar la
              corrida anterior. El banner cambia para explicarlo. */}
          {(() => {
            const isBatchable = !!tool && BATCHABLE_TOOLS.has(tool.id);
            const disabled = mockRunning || (started && !isBatchable);
            const bannerText = mockRunning
              ? "Pipeline corriendo — esperá a que termine para modificar config."
              : started && !isBatchable
                ? "Pipeline ya ejecutado — para cambiar la config, tocá Reset arriba."
                : "";
            return (
              <div className="flex-1 overflow-y-auto px-4 py-4 relative">
                {disabled && (
                  <div className="sticky top-0 z-10 mb-3 -mt-2 -mx-4 px-4 py-2 bg-[var(--color-brand-subtle)] border-y border-[var(--color-brand-muted)] flex items-center gap-2 text-[11px] text-fg pointer-events-none">
                    {mockRunning ? <Loader2 size={12} className="animate-spin shrink-0 text-[var(--color-brand)]" /> : <Check size={12} className="shrink-0 text-[var(--color-brand)]" />}
                    <span>{bannerText}</span>
                  </div>
                )}
                <div className={cn(disabled && "pointer-events-none opacity-50 transition-opacity")}>
                  <ConfigPanel
                    tool={tool}
                    config={config}
                    setConfig={setConfig}
                    onStart={handleStart}
                    onMockPreview={handleMockPreview}
                  />
                </div>
              </div>
            );
          })()}
          <div className="border-t border-edge bg-surface-0 px-4 py-3 space-y-2 shrink-0">
            {!started && validationError && (
              <div className="flex items-start gap-1.5 text-[10px] text-[var(--color-error)] bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 rounded-[var(--radius-sm)] px-2.5 py-1.5">
                <AlertCircle size={10} className="shrink-0 mt-0.5" />
                <span className="leading-snug">{validationError}</span>
              </div>
            )}
            {(() => {
              // Footer del sidebar:
              // - Tool batchable + ya started → seguimos mostrando "Generar" pero con label
              //   "Generar tanda" porque cada Run SUMA en lugar de pisar.
              // - Tool no-batchable + ya started → mensaje "Pipeline corriendo…" como antes.
              // - !started → botón Generar inicial.
              const isBatchable = !!tool && BATCHABLE_TOOLS.has(tool.id);
              const batchCount = batches.length;
              if (!started || isBatchable) {
                const label = (started && isBatchable && batchCount > 0)
                  ? `Generar tanda ${batchCount + 1}`
                  : "Generar";
                return (
                  <button
                    onClick={handleStart}
                    disabled={!activeBrand || mockRunning}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 px-4 py-3 text-[13px] font-bold uppercase tracking-wide rounded-[var(--radius-md)] transition-all cursor-pointer",
                      activeBrand && !mockRunning
                        ? "text-[var(--color-action-fg)] bg-[var(--color-action)] hover:brightness-105 shadow-[0_4px_24px_-6px_var(--color-brand-muted)] hover:shadow-[0_6px_32px_-4px_var(--color-brand)]"
                        : "text-fg-faint bg-surface-2 cursor-not-allowed"
                    )}
                    title={isBatchable && batchCount > 0 ? "Suma una nueva tanda al stack — no pisa las anteriores" : undefined}
                  >
                    <Play size={14} fill="currentColor" />
                    {label}
                  </button>
                );
              }
              return (
                <div className="text-[10px] text-fg-faint text-center">
                  Pipeline corriendo — ajustá la config arriba y usá "Reset" en el header si necesitás re-empezar.
                </div>
              );
            })()}
          </div>
        </aside>

        {/* ── MAIN AREA ──────────────────────────────────────────────
             Pipeline chips horizontales arriba (clickeables para saltar entre
             steps cuando hay started). Debajo: el StepPanel del step activo,
             o un placeholder cuando no se ha empezado. */}
        <main
          className="flex-1 flex flex-col overflow-hidden relative"
          style={{
            // Gradient ultra-sutil: usar surface-0 (no surface-1) que está apenas por
            // encima del canvas, y achicar la zona iluminada a 50%×30% para que sea casi
            // imperceptible. El efecto es "el centro respira", no un halo evidente.
            // Estilo Higgsfield: la profundidad se SIENTE, no se mira.
            background: "radial-gradient(ellipse 50% 30% at 50% 0%, var(--color-surface-0), var(--color-canvas) 80%)",
          }}
        >
          {/* Pipeline chips */}
          <div className="border-b border-edge px-5 py-3 shrink-0">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {steps.map((step, i) => {
                const meta = STEP_META[step.id] || { label: step.id, icon: <Sparkles size={11} />, description: "" };
                const active = started && activeStep === i;
                return (
                  <button
                    key={step.id}
                    onClick={() => started && setActiveStep(i)}
                    disabled={!started}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] transition-colors shrink-0",
                      started ? "cursor-pointer" : "cursor-default opacity-60",
                      active
                        ? "bg-[var(--color-brand)] text-[var(--color-brand-fg)] font-semibold shadow-[0_0_16px_-2px_var(--color-brand-muted)]"
                        : step.status === "done"
                          ? "bg-[var(--color-success-muted)] text-[var(--color-success)] border border-[var(--color-success)]/30"
                          : step.status === "review"
                            ? "bg-[var(--color-warning-muted)] text-[var(--color-warning)] border border-[var(--color-warning)]/30"
                            : step.status === "running"
                              ? "bg-fg text-[var(--color-canvas)]"
                              : step.status === "error"
                                ? "bg-[var(--color-error-muted)] text-[var(--color-error)] border border-[var(--color-error)]/30"
                                : "bg-surface-1 text-fg-muted border border-edge",
                    )}
                  >
                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 bg-black/10">
                      {step.status === "done" ? <Check size={9} />
                       : step.status === "running" ? <Loader2 size={9} className="animate-spin" />
                       : step.status === "review" ? <Eye size={9} />
                       : i + 1}
                    </span>
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step content (scroll independent) */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {/* Agent banner — solo cuando viene de "Crear automáticamente" */}
            {agentInfo && (
              <div className="mb-4 bg-[var(--color-action-muted)] border border-[var(--color-action-muted)] rounded-[var(--radius-md)] p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <Wand2 size={12} className="text-[var(--color-action-strong)]" />
                    <h4 className="text-[11px] font-semibold text-fg">Configuración del agente</h4>
                  </div>
                  <button onClick={() => setAgentInfo(null)} className="text-fg-faint hover:text-fg cursor-pointer shrink-0" title="Ocultar">
                    <X size={11} />
                  </button>
                </div>
                {agentInfo.reasoning && <p className="text-[11px] text-fg-secondary leading-relaxed">{agentInfo.reasoning}</p>}
                {agentInfo.warnings && agentInfo.warnings.length > 0 && (
                  <div className="space-y-0.5 pt-1 border-t border-[var(--color-action-muted)]">
                    {agentInfo.warnings.map((w, i) => (
                      <div key={i} className="flex items-start gap-1 text-[10px] text-fg-muted">
                        <AlertCircle size={9} className="text-amber-500 mt-0.5 shrink-0" />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!started ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-8">
                <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center text-fg-muted mb-3">
                  {TOOL_ICONS[tool.icon] || <Sparkles size={20} />}
                </div>
                <h3 className="text-[14px] font-semibold text-fg">Listo para arrancar</h3>
                <p className="text-[12px] text-fg-muted mt-1.5 leading-relaxed">
                  Configurá los parámetros en el panel de la izquierda y tocá <strong>Generar</strong>. Cada step del pipeline aparece arriba a medida que avanza.
                </p>
              </div>
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
                onInvalidateDownstream={(sid) => setSteps((prev) => {
                  const idx = prev.findIndex((s) => s.id === sid);
                  if (idx < 0) return prev;
                  return prev.map((s, i) => (i > idx && s.result ? { ...s, status: "stale" as StepStatus } : s));
                })}
                batches={tool && BATCHABLE_TOOLS.has(tool.id) ? batches : undefined}
                onNewBatch={tool && BATCHABLE_TOOLS.has(tool.id) ? (() => {
                  // "Nueva tanda": re-activamos el step generate_all para que el
                  // usuario edite config (desde el sidebar) y dale Generar de nuevo.
                  // El próximo result se SUMA al stack en lugar de pisar.
                  setNewBatchPending(true);
                  setSteps((prev) => prev.map((s) => s.id === "generate_all" ? { ...s, status: "active" as StepStatus, result: undefined } : s));
                  const idx = steps.findIndex((s) => s.id === "generate_all");
                  if (idx >= 0) setActiveStep(idx);
                }) : undefined}
                onDeleteBatch={tool && BATCHABLE_TOOLS.has(tool.id) ? ((batchId: string) => {
                  setBatches((prev) => prev.filter((b) => b.id !== batchId));
                }) : undefined}
                onUpdateBatchImage={tool && BATCHABLE_TOOLS.has(tool.id) ? ((batchId, imageId, newUrl) => {
                  setBatches((prev) => prev.map((b) => b.id === batchId
                    ? { ...b, images: b.images.map((im) => im.id === imageId ? { ...im, url: newUrl, status: "done" } : im) }
                    : b
                  ));
                }) : undefined}
              />
            )}
          </div>
        </main>
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
  /** Subtitles selector visibility. Default = true for video tools. Fashion Reel
   *  no genera subtítulos (es visual-only sin voiceover) → showSubtitles: false. */
  showSubtitles?: boolean;
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
    <div className="bg-surface-1 border border-[var(--color-action)]/30 rounded-[var(--radius-md)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video size={14} className="text-[var(--color-action)]" />
          <label className="text-[12px] font-semibold text-fg">Video a analizar</label>
        </div>
        <div className="flex rounded-[var(--radius-sm)] overflow-hidden border border-edge text-[11px]">
          <button
            onClick={() => setMode("video")}
            className={`px-3 py-1 ${mode === "video" ? "bg-fg text-[var(--color-canvas)]" : "bg-surface-2 text-fg-faint hover:text-fg"}`}
          >
            URL / Upload
          </button>
          <button
            onClick={() => setMode("profile")}
            className={`px-3 py-1 ${mode === "profile" ? "bg-fg text-[var(--color-canvas)]" : "bg-surface-2 text-fg-faint hover:text-fg"}`}
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
            <p className="text-[10px] text-[var(--color-action)]">✓ URL cargada</p>
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
              className="px-4 h-9 rounded-[var(--radius-sm)] bg-fg text-[var(--color-canvas)] text-[12px] font-medium disabled:opacity-50 flex items-center gap-1.5"
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
                      ? "border-[var(--color-action)] bg-[var(--color-action)]/10"
                      : "border-edge bg-surface-2 hover:border-[var(--color-action)]/50"
                  }`}
                >
                  {v.thumbnail_url && (
                    <img src={v.thumbnail_url} alt="" className="w-12 h-16 object-cover rounded flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-bold text-[var(--color-action)]">#{i + 1}</span>
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

// ── Tool Brief Box — chat-first config entry for a single tool ──────────────
// You describe what you want in natural language; the agent (scoped to THIS tool)
// fills the config. The full form below stays as the "fine-tune / advanced" surface.
// This is NOT a separate chat — it's the same agent, scoped to one tool, as a fast
// way to populate the form without scanning 30 empty fields.
const BRIEF_ALLOWED_KEYS: string[] = [
  "selectedAvatarId", "selectedProductId", "selectedClothingIds", "selectedBackgroundId",
  "selectedVoiceId", "selectedMoodboardId", "objective", "tone", "platform", "language",
  "numVariations", "aspectRatio", "resolution", "subtitleEngine", "videoDuration",
  "ugcMode", "visualStyle", "visualStyleCustom", "hookType", "lipsyncMethod", "creativeMode",
  "reelMode", "adStyle", "adTemplate", "carouselType", "numSlides", "animationEngine",
  "voiceStability", "voiceStyle", "voiceSpeed", "productIsWorn", "includeCopy", "customScript",
];

function ToolBriefBox({ toolId, config, setConfig }: {
  toolId: string;
  config: ToolConfig;
  setConfig: React.Dispatch<React.SetStateAction<ToolConfig>>;
}) {
  const { activeBrand } = useBrand();
  const [brief, setBrief] = useState("");
  const [loading, setLoading] = useState(false);
  const [resolved, setResolved] = useState<{ reasoning?: string; warnings?: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // En sidebar 440px el bloque "Describilo. La IA arma el resto." con el headline
  // de 28px ocupaba ~280px de alto. Lo colapsamos por default — el usuario que ya
  // sabe qué quiere salta directo al form de abajo. Click en el header lo expande.
  const [expanded, setExpanded] = useState(false);

  const handleResolve = async () => {
    if (!brief.trim() || !activeBrand) return;
    setLoading(true);
    setError(null);
    try {
      const res = await resolveAgentBrief(
        activeBrand.id,
        brief.trim(),
        { tool: toolId, config: config as unknown as Record<string, unknown> },
      );
      // Apply resolved fields on top of current config (whitelist for type safety).
      setConfig((prev) => {
        const next = { ...prev } as Record<string, unknown>;
        for (const k of BRIEF_ALLOWED_KEYS) {
          const v = (res.config as Record<string, unknown>)[k];
          if (v !== undefined && v !== null) next[k] = v;
        }
        return next as ToolConfig;
      });
      setResolved({ reasoning: res.reasoning, warnings: res.warnings });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo resolver");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative rounded-[var(--radius-md)] border border-edge bg-surface-1 overflow-hidden">
      {/* Header clickeable — colapsado por default ocupa solo ~36px de alto.
          Cuando se expande aparece el textarea + el Submit. Mantiene el hairline
          burgundy arriba como sticker visual del agent. */}
      <div className="h-[2px] bg-[var(--color-action)]" />
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-surface-2 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <Sparkles size={12} className="text-[var(--color-action)]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-fg">Coevo Agent</span>
          <span className="text-[10px] text-fg-faint hidden sm:inline">— describí y armo el form</span>
        </span>
        <ChevronRight
          size={12}
          className={cn("text-fg-faint transition-transform", expanded && "rotate-90")}
        />
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2.5">
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleResolve(); } }}
            rows={2}
            placeholder="ej: reel de la campera bordó · estética VHS · 4 looks"
            className="w-full text-[12px] text-fg bg-surface-2 border border-edge focus:border-[var(--color-action)] rounded-[var(--radius-sm)] px-2.5 py-2 outline-none resize-none placeholder:text-fg-faint transition-colors"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleResolve}
              disabled={loading || !brief.trim()}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide rounded-[var(--radius-sm)] transition-all",
                !loading && brief.trim()
                  ? "bg-[var(--color-action)] text-[var(--color-action-fg)] hover:brightness-105 cursor-pointer"
                  : "bg-surface-2 text-fg-faint cursor-not-allowed",
              )}
            >
              {loading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              {loading ? "Armando..." : "Armar form"}
            </button>
            <span className="text-[9px] text-fg-faint">⌘/Ctrl + ↵</span>
          </div>
          {error && (
            <p className="text-[11px] text-[var(--color-error)] flex items-center gap-1"><AlertCircle size={10} /> {error}</p>
          )}
          {resolved && !error && (
            <div className="border-l-2 border-[var(--color-action)] bg-[var(--color-action-subtle)] rounded-r-[var(--radius-sm)] px-2.5 py-2 space-y-1">
              <p className="text-[11px] font-semibold text-fg flex items-center gap-1">
                <Check size={11} className="text-[var(--color-action)]" /> Listo — revisá abajo.
              </p>
              {resolved.reasoning && <p className="text-[10px] text-fg-muted leading-relaxed">{resolved.reasoning}</p>}
              {resolved.warnings && resolved.warnings.length > 0 && (
                <ul className="text-[10px] text-warning space-y-0.5 pt-0.5">
                  {resolved.warnings.map((w, i) => <li key={i}>⚠ {w}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
  const baseSchema = TOOL_DEFINITIONS[tool.id]?.schema ?? TOOL_SCHEMAS[tool.id] ?? DEFAULT_SCHEMA;
  // Runtime schema overrides (e.g. Avatar tool opens the avatar picker in "poses" mode)
  const schema = tool.id === "avatar_creator" && config.avatarToolMode === "poses"
    ? { ...baseSchema, showAvatar: true, avatarRequired: true }
    : baseSchema;
  const [systemVoices, setSystemVoices] = useState<Array<{ id: string; name: string; language: string }>>([]);
  // Upload state para la sección Accesorios (ecommerce_pack). Cuando el usuario
  // sube un archivo, va directo via uploadClothing con tag "accessory" y queda
  // auto-marcado en ecomAccessoryIds + selectedClothingIds para que el handler
  // lo levante en la próxima corrida. Sin esto, había que ir a BrandSettings,
  // subir, volver, tildar como accesorio — 3 pasos.
  const [accessoryUploading, setAccessoryUploading] = useState(false);
  const accessoryInputRef = useRef<HTMLInputElement>(null);
  const [actionCategories, setActionCategories] = useState<ActionCategory[]>([]);
  const [actionPickerScene, setActionPickerScene] = useState<number | null>(null);
  const [actionPickerTab, setActionPickerTab] = useState<string>("");
  const [refClassification, setRefClassification] = useState<{
    type: string;
    confidence: number;
    description: string;
    suggested_slot: string;
  } | null>(null);
  const [classifyingRef, setClassifyingRef] = useState(false);
  // Lightbox local del ConfigPanel — usado para zoom de pose refs por shot en
  // Ecommerce Pack y cualquier thumb del sidebar que quiera abrir en grande.
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

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

  // ── Brand readiness check (per tool) ───────────────────────
  // Surface to the user what's missing before they hit Generate.
  const readinessIssues: Array<{ severity: "error" | "warn"; msg: string }> = [];
  const ds = activeBrand.designSystem;
  const dna = activeBrand.dna;
  const hasBrandContext = !!(activeBrand.brandContext && activeBrand.brandContext.length > 100);
  const hasDesignSystem = !!(ds?.photoStyle);
  const hasPalette = !!(dna?.colors && dna.colors.length > 0 && dna.colors[0].hex);

  if (!hasBrandContext) readinessIssues.push({ severity: "error", msg: "Sin Brand System cargado — el output va a salir genérico. Cargá contexto en BrandSettings." });
  else if (!hasDesignSystem) readinessIssues.push({ severity: "warn", msg: "Sin Design System extraído — sin reglas visuales claras. Apretá 'Extraer' en BrandSettings." });
  if (!hasPalette && (tool.id === "static_ad" || tool.id === "carousel_creator" || tool.id === "ad_creative_lab")) {
    readinessIssues.push({ severity: "warn", msg: "Sin paleta con hex en Brand DNA — los colores van a ser aproximados. Re-extraé el Brand DNA." });
  }
  if ((tool.id === "static_ad" || tool.id === "carousel_creator") && (!activeBrand.products || activeBrand.products.length === 0)) {
    readinessIssues.push({ severity: "warn", msg: "Sin productos cargados — el ad no va a tener un sujeto claro. Subí al menos uno." });
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
    // Refactor split layout: el ConfigPanel ahora vive en un sidebar de 440px.
    // Quitamos el brand summary box (info ya está en el header del split layout) y
    // bajamos paddings agresivamente. `space-y-3` en lugar de `space-y-5` para que
    // las secciones de assets / ajustes entren sin scroll vertigoso.
    <div className="space-y-3 text-[12px]">
      {/* Counter compacto de assets del brand (1 línea, reemplaza el box gigante de 200px) */}
      <div className="text-[10px] text-fg-faint px-1">
        {activeBrand.avatars?.length || 0} avatars · {activeBrand.products?.length || 0} productos · {activeBrand.clothing?.length || 0} prendas · {activeBrand.backgrounds?.length || 0} fondos
      </div>

      {/* Coevo Agent (chat-first config) — sigue como ToolBriefBox; el componente
          ya tiene su propio padding interno, no le pongo wrapper extra. */}
      {tool.id === "fashion_reel" && (
        <ToolBriefBox toolId={tool.id} config={config} setConfig={setConfig} />
      )}

      {/* Brand readiness banner — shows what's missing before generating */}
      {readinessIssues.length > 0 && (
        <div className="space-y-1.5">
          {readinessIssues.map((issue, i) => (
            <div
              key={i}
              className={cn(
                "px-3 py-2 rounded-[var(--radius-sm)] border flex items-start gap-2 text-[11px]",
                issue.severity === "error"
                  ? "bg-red-500/10 border-red-500/30 text-red-300"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-300"
              )}
            >
              <span className="shrink-0 leading-none">{issue.severity === "error" ? "⚠" : "ⓘ"}</span>
              <span className="leading-relaxed">{issue.msg}</span>
            </div>
          ))}
        </div>
      )}

      {/* Content Analyzer — URL input at top (primary input) */}
      {tool.id === "content_analyzer" && (
        <ContentAnalyzerInput config={config} setConfig={setConfig} />
      )}

      {/* Avatar tool — modo + style + save destination con ModelDropdown.
          Antes eran grids de cards grandes (2 cards arriba + 7 cards 3×3 abajo)
          que comían ~300px de altura. Con dropdowns finos ~80px total. */}
      {tool.id === "avatar_creator" && (() => {
        const cfgStyle = (config as Record<string, unknown>).avatarStyle as string | undefined;
        const defaultStyle = config.avatarToolMode === "poses" ? "inherit" : "realistic";
        const currentStyle = cfgStyle || defaultStyle;
        return (
          <>
            <ModelDropdown
              label="¿Qué querés hacer?"
              value={config.avatarToolMode === "poses" ? "poses" : "create"}
              onChange={(next) => setConfig((p) => ({ ...p, avatarToolMode: next as "create" | "poses" }))}
              options={[
                { id: "create", label: "Crear nuevo avatar", sub: "Gemini arma un perfil desde el brand context y genera la pose sheet" },
                { id: "poses", label: "Poses de un avatar existente", sub: "Tomás un avatar del Brand Kit y generás la pose sheet en fondo blanco" },
              ]}
            />

            {config.avatarToolMode === "poses" && (
              <ModelDropdown
                label="Guardar como"
                value={config.avatarPosesSave === "replace" ? "replace" : "new"}
                onChange={(next) => setConfig((p) => ({ ...p, avatarPosesSave: next as "new" | "replace" }))}
                options={[
                  { id: "new", label: "Avatar nuevo", sub: "Se crea un nuevo avatar en el Brand Kit" },
                  { id: "replace", label: "Reemplazar imagen del original", sub: "Sobrescribe la imagen del avatar seleccionado" },
                ]}
              />
            )}

            <ModelDropdown
              label="Estilo de avatar"
              value={currentStyle}
              onChange={(next) => setConfig((p) => ({ ...(p as Record<string, unknown>), avatarStyle: next } as typeof p))}
              options={[
                { id: "inherit", label: "Heredar referencia", sub: "Sin override — copia el estilo del avatar/foto que pasaste" },
                { id: "realistic", label: "Realistic", sub: "Photorealistic" },
                { id: "editorial", label: "Editorial", sub: "High-fashion" },
                { id: "3d", label: "3D Render", sub: "CGI character" },
                { id: "illustrated", label: "Illustrated", sub: "2D illustration" },
                { id: "anime", label: "Anime", sub: "Japanese style" },
                { id: "cinematic", label: "Cinematic", sub: "Film quality" },
              ]}
            />
            <p className="text-[10px] text-fg-faint -mt-1">
              Si estás usando un avatar de referencia (modo poses, o subida manual),
              elegí <strong>&ldquo;Heredar referencia&rdquo;</strong> para respetar la estética del original.
            </p>

            {/* Selector de vistas — solo aplica en modo poses. Catálogo tildable
                agrupado por tipo (cuerpo / cara / extras). El usuario puede elegir
                solo cara para detalles, solo cuerpo para look, o combinar. */}
            {config.avatarToolMode === "poses" && (
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[10px] font-semibold text-fg-faint uppercase tracking-widest">Vistas a generar</span>
                  <span className="text-[9px] text-fg-faint italic">{config.avatarViews.length} tildada{config.avatarViews.length === 1 ? "" : "s"}</span>
                </div>
                {(["body", "face", "extra"] as const).map((group) => {
                  const groupLabel = group === "body" ? "Cuerpo" : group === "face" ? "Cara" : "Extras";
                  const groupViews = Object.entries(AVATAR_VIEWS).filter(([, v]) => v.group === group);
                  return (
                    <div key={group} className="space-y-1">
                      <p className="text-[9px] text-fg-faint uppercase tracking-wider">{groupLabel}</p>
                      <div className="grid grid-cols-2 gap-1">
                        {groupViews.map(([key, v]) => {
                          const on = config.avatarViews.includes(key);
                          return (
                            <button
                              key={key}
                              onClick={() => setConfig((p) => ({
                                ...p,
                                avatarViews: on
                                  ? p.avatarViews.filter((x) => x !== key)
                                  : [...p.avatarViews, key],
                              }))}
                              className={cn(
                                "px-2 py-1.5 text-[10px] rounded-[var(--radius-sm)] border text-left transition-all cursor-pointer",
                                on
                                  ? "border-[var(--color-action)] bg-[var(--color-action-subtle)] text-fg"
                                  : "border-edge bg-surface-1 text-fg-muted hover:border-edge-strong hover:text-fg",
                              )}
                            >
                              {v.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <p className="text-[10px] text-fg-faint">
                  {config.avatarViews.length === 0
                    ? "Elegí al menos una vista."
                    : config.avatarViews.length === 1
                      ? "1 vista única — sale como foto singular, no como sheet."
                      : `${config.avatarViews.length} vistas — composite side-by-side en fondo blanco.`}
                </p>
              </div>
            )}
          </>
        );
      })()}

      {/* Product Sheet: mode (multi-view vs detail close-ups) + save destination */}
      {tool.id === "product_sheet" && (
        <>
          {/* Recordatorio sobre subir TODOS los ángulos antes — sin esto Nano Banana
              inventa vistas (para un auto, por ejemplo, si solo le mostrás el frente,
              se inventa la cola). Lo dejamos prominente y explicativo. */}
          <div className="bg-[var(--color-brand-subtle)] border border-[var(--color-brand-muted)] rounded-[var(--radius-md)] p-3">
            <div className="flex items-start gap-2">
              <AlertCircle size={14} className="text-[var(--color-brand)] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-[12px] font-semibold text-fg leading-snug">Antes de generar, subí TODOS los ángulos que quieras ver en la sheet.</p>
                <p className="text-[11px] text-fg-muted leading-snug">
                  Si el producto es complejo (auto, electro, mueble), sumá hasta <strong>10 fotos</strong> al Brand Kit: frente, lateral, 3/4, trasera, top, interior (si aplica), detalles. <strong>Lo que no le mostrés, lo inventa</strong> — y suele salir distinto al producto real.
                </p>
                <p className="text-[10px] text-fg-faint">
                  Cargá fotos extra desde <strong>Marcas → Productos</strong> (click en el producto, botón &ldquo;+&rdquo; en la card).
                </p>
              </div>
            </div>
          </div>

          <ModelDropdown
            label="¿Qué querés generar?"
            value={config.productSheetMode === "details" ? "details" : "sheet"}
            onChange={(next) => setConfig((p) => ({ ...p, productSheetMode: next as "sheet" | "details" }))}
            options={[
              { id: "sheet", label: "Sheet integral", sub: "Composite con todas las vistas tildadas en una sola imagen sobre fondo blanco — contexto para otras tools" },
              { id: "details", label: "Planos y detalles", sub: "Close-ups de textura, logo, etiqueta, hardware y stitching del mismo producto" },
            ]}
          />

          {/* Selector de vistas — solo en modo "sheet" (vistas estudio). Cada vista
              tildada genera una imagen aparte con su composition + aspect ratio
              óptimo. Default: hero_34 + side + front. */}
          {config.productSheetMode !== "details" && (
            <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-semibold text-fg-secondary">Vistas a generar</label>
                <span className="text-[10px] text-fg-faint">
                  {(config.productSheetViews.length || DEFAULT_PRODUCT_VIEWS.length)} vista(s)
                </span>
              </div>
              <div className="space-y-1">
                {Object.entries(PRODUCT_VIEW_CATALOG).map(([id, view]) => {
                  const on = config.productSheetViews.includes(id);
                  return (
                    <button
                      key={id}
                      onClick={() => setConfig((p) => ({
                        ...p,
                        productSheetViews: on
                          ? p.productSheetViews.filter((v) => v !== id)
                          : [...p.productSheetViews, id],
                      }))}
                      className={cn(
                        "w-full flex items-start gap-2 px-2.5 py-1.5 rounded-[var(--radius-sm)] border text-[11px] transition-colors text-left",
                        on
                          ? "bg-[var(--color-brand-subtle)] border-[var(--color-brand)] text-fg"
                          : "bg-surface-0 border-edge text-fg-muted hover:text-fg",
                      )}
                    >
                      <span className={cn("w-3.5 h-3.5 rounded-[4px] border flex items-center justify-center shrink-0 mt-0.5", on ? "bg-[var(--color-brand)] border-[var(--color-brand)]" : "border-edge-strong")}>
                        {on && <Check size={10} className="text-[var(--color-brand-fg)]" />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="font-semibold block">{view.label} <span className="text-[9px] text-fg-faint font-normal">· {view.aspectRatio}</span></span>
                        <span className="text-[10px] text-fg-faint block leading-snug">{view.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-fg-faint">
                Todas las vistas tildadas se renderizan en UNA imagen composite (estilo product spec sheet). Layout adaptativo según la cantidad. Si no marcás nada, usa los defaults ({DEFAULT_PRODUCT_VIEWS.map((k) => PRODUCT_VIEW_CATALOG[k].label).join(" + ")}).
              </p>
            </div>
          )}

          <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-4 space-y-3">
            <label className="text-[12px] font-semibold text-fg-secondary">Guardar como</label>
            <div className="inline-flex bg-surface-2 rounded-[var(--radius-sm)] p-0.5 gap-0.5">
              <button
                onClick={() => setConfig((p) => ({ ...p, productSheetSave: "new" }))}
                className={cn(
                  "px-3 py-1.5 text-[11px] font-semibold rounded-[calc(var(--radius-sm)-1px)] transition-all cursor-pointer",
                  config.productSheetSave === "new" ? "bg-fg text-[var(--color-canvas)]" : "text-fg-faint hover:text-fg"
                )}
              >
                Producto nuevo
              </button>
              <button
                onClick={() => setConfig((p) => ({ ...p, productSheetSave: "asset" }))}
                className={cn(
                  "px-3 py-1.5 text-[11px] font-semibold rounded-[calc(var(--radius-sm)-1px)] transition-all cursor-pointer",
                  config.productSheetSave === "asset" ? "bg-fg text-[var(--color-canvas)]" : "text-fg-faint hover:text-fg"
                )}
              >
                Solo asset (no toca catálogo)
              </button>
            </div>
            <p className="text-[10px] text-fg-faint">
              "Producto nuevo" lo agrega al Brand Kit con la descripción que sacó Gemini.
              "Solo asset" te deja la imagen para descargar/usar en Lab sin ensuciar el catálogo.
            </p>
          </div>
        </>
      )}

      {/* UGC production settings — presets + grouped sections */}
      {tool.id === "ugc_creator" && (
        <UGCConfigPanel config={config} setConfig={setConfig} />
      )}

      {/* Style selector (Video Ad Creator) */}
      {tool.id === "video_ad_creator" && (
        <>
          <ModelDropdown
            label="Estilo visual"
            value={config.adStyle || "photorealistic"}
            onChange={(next) => setConfig((p) => ({ ...p, adStyle: next }))}
            options={[
              { id: "photorealistic", label: "Photorealistic", sub: "Foto realista, look profesional" },
              { id: "claymation", label: "Claymation", sub: "Stop-motion arcilla" },
              { id: "2d_cartoon", label: "2D Cartoon", sub: "Animación 2D plana" },
              { id: "3d_render", label: "3D Render", sub: "CGI estilo Pixar" },
              { id: "cinematic", label: "Cinematic", sub: "Look fílmico con grano + grading" },
              { id: "minimal", label: "Minimal", sub: "Limpio, mucho aire negativo" },
              { id: "retro", label: "Retro", sub: "Estética vintage / 80s-90s" },
              { id: "custom", label: "Custom", sub: "Describí tu estilo abajo" },
            ]}
          />
          {config.adStyle === "custom" && (
            <input
              value={config.notes}
              onChange={(e) => setConfig((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Describí tu estilo custom. Ej: 'ilustración en acuarela, tonos pastel, texturas dibujadas a mano'..."
              className="w-full h-8 px-3 rounded-[var(--radius-sm)] border border-edge bg-surface-2 text-[12px] text-fg placeholder:text-fg-faint outline-none focus:border-[var(--color-edge-focus)] -mt-1"
            />
          )}
        </>
      )}

      {/* Fashion Reel — mode + visual style */}
      {/* Heredado del análisis — cuando Fashion Reel viene de Content Analyzer,
          mostramos QUÉ instrucciones se propagaron, para que el usuario las vea
          antes de generar (transparencia: "qué se va a mandar al modelo"). */}
      {tool.id === "fashion_reel" && (() => {
        const c = config as unknown as Record<string, unknown>;
        const sig = (c.visualSignature as string) || "";
        const lighting = (c.lightingStyle as string) || "";
        const palette = (c.paletteTemperature as string) || "";
        const framing = (c.framingSignature as string) || "";
        const customScript = (c.customScript as string) || "";
        let sceneCount = 0;
        try { const p = JSON.parse(customScript); if (Array.isArray(p)) sceneCount = p.length; } catch { /* ignore */ }
        const hasInherited = sig || lighting || palette || framing || sceneCount > 0;
        if (!hasInherited) return null;
        return (
          <div className="bg-blue-500/5 border border-blue-500/30 rounded-[var(--radius-md)] p-4 space-y-2">
            <div className="text-[11px] font-semibold text-blue-300 flex items-center gap-1.5">
              <Sparkles size={12} /> Heredado del análisis del video
            </div>
            <p className="text-[10px] text-fg-faint">Esto es lo que se va a aplicar a TODAS las escenas para recrear el look del video original:</p>
            <div className="space-y-1.5 text-[11px]">
              {sceneCount > 0 && (
                <div className="flex gap-2"><span className="text-fg-faint w-20 shrink-0">Escenas</span><span className="text-fg">{sceneCount} (del guion adaptado)</span></div>
              )}
              {sig && (
                <div className="flex gap-2"><span className="text-fg-faint w-20 shrink-0">Visual DNA</span><span className="text-fg-muted leading-snug">{sig}</span></div>
              )}
              {lighting && (
                <div className="flex gap-2"><span className="text-fg-faint w-20 shrink-0">Iluminación</span><span className="text-fg-muted leading-snug">{lighting}</span></div>
              )}
              {palette && (
                <div className="flex gap-2"><span className="text-fg-faint w-20 shrink-0">Paleta</span><span className="text-fg-muted leading-snug">{palette}</span></div>
              )}
              {framing && (
                <div className="flex gap-2"><span className="text-fg-faint w-20 shrink-0">Encuadre</span><span className="text-fg-muted leading-snug">{framing}</span></div>
              )}
            </div>
            <p className="text-[9px] text-fg-faint pt-1 border-t border-blue-500/20">
              El guion completo (con el image_prompt de cada escena) lo ves y editás en el paso <strong>Script</strong>. Esto es la "firma visual" que se prepend a cada generación.
            </p>
          </div>
        );
      })()}

      {tool.id === "ecommerce_pack" && (
        <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-4 space-y-4">
          {/* Studio style — ModelDropdown unificado con el resto de las tools. */}
          <ModelDropdown
            label="Estilo de estudio"
            value={config.studioStyle || "white"}
            onChange={(next) => setConfig((p) => ({ ...p, studioStyle: next }))}
            options={Object.entries(STUDIO_STYLES).map(([id, s]) => ({
              id,
              label: s.label,
              sub: id === "custom" ? "Describí el fondo/luz en el campo de abajo" : s.clause,
            }))}
          />
          <p className="text-[10px] text-fg-faint -mt-1">
            Afiná con <strong>Look &amp; Feel</strong> (iluminación/estética) y/o <strong>moodboard</strong>. Para la postura de la modelo, usá <strong>Referencia de POSE</strong> (abajo).
          </p>

          {/* Shot selection — para cada shot on-model tildado se puede sumar una
              pose ref one-off. El handler la usa como ref específica de ese shot. */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-semibold text-fg-faint uppercase tracking-widest">Tomas a generar</span>
            <div className="space-y-1">
              {Object.entries(SHOT_CATALOG).map(([id, shot]) => {
                const on = config.ecomShots.includes(id);
                const poseUrl = config.ecomShotPoses[id];
                return (
                  <div
                    key={id}
                    className={cn(
                      "rounded-[var(--radius-sm)] border transition-colors",
                      on ? "bg-[var(--color-action-subtle)] border-[var(--color-action-muted)]" : "bg-surface-0 border-edge",
                    )}
                  >
                    <div className="flex items-center gap-2 px-2.5 py-1.5">
                      <button
                        onClick={() => setConfig((p) => {
                          if (on) {
                            // Al desmarcar el shot, también limpiamos su pose ref.
                            const { [id]: _drop, ...rest } = p.ecomShotPoses;
                            void _drop;
                            return { ...p, ecomShots: p.ecomShots.filter((s) => s !== id), ecomShotPoses: rest };
                          }
                          return { ...p, ecomShots: [...p.ecomShots, id] };
                        })}
                        className={cn(
                          "flex items-center gap-2 flex-1 text-[11px] text-left cursor-pointer",
                          on ? "text-fg" : "text-fg-muted hover:text-fg",
                        )}
                      >
                        <span className={cn("w-3.5 h-3.5 rounded-[4px] border flex items-center justify-center shrink-0", on ? "bg-[var(--color-action)] border-[var(--color-action)]" : "border-edge-strong")}>
                          {on && <Check size={10} className="text-[var(--color-action-fg)]" />}
                        </span>
                        {shot.label}
                      </button>
                      {/* Pose ref por shot — solo para on-model shots tildados.
                          Thumbnail más grande (40×40 en vez de 24) y click → lightbox. */}
                      {on && shot.onModel && (
                        poseUrl ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => setLightboxUrl(poseUrl)}
                              title="Ver pose en grande"
                              className="cursor-zoom-in"
                            >
                              <img src={poseUrl} alt="pose" className="w-10 h-10 rounded object-cover border-2 border-[var(--color-brand)] shadow-[0_0_8px_-2px_var(--color-brand-muted)]" />
                            </button>
                            <button
                              onClick={() => setConfig((p) => {
                                const { [id]: _drop, ...rest } = p.ecomShotPoses;
                                void _drop;
                                return { ...p, ecomShotPoses: rest };
                              })}
                              title="Quitar pose"
                              className="text-fg-faint hover:text-fg cursor-pointer"
                            ><X size={12} /></button>
                          </div>
                        ) : (
                          <label className="flex items-center gap-1 px-1.5 h-6 rounded-[var(--radius-sm)] border border-dashed border-edge-strong bg-surface-1 text-[9px] text-fg-muted hover:text-fg cursor-pointer shrink-0" title="Subir imagen de pose específica para este shot">
                            <Plus size={10} />
                            Pose
                            <input
                              type="file"
                              accept={IMAGE_ACCEPT}
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                const r = new FileReader();
                                r.onload = () => {
                                  setConfig((p) => ({ ...p, ecomShotPoses: { ...p.ecomShotPoses, [id]: r.result as string } }));
                                };
                                r.readAsDataURL(f);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-fg-faint">
              {config.ecomShots.length === 0
                ? "Elegí al menos una toma."
                : `${config.ecomShots.length} toma${config.ecomShots.length === 1 ? "" : "s"} · subí una pose ref por shot si querés una pose específica.`}
            </p>
          </div>

          {/* ── Pose preset (texto) ─────────────────────────────────────
              Reemplaza al "modelo de pie estático" default — el handler usa
              la descripción textual de la pose elegida cuando NO hay pose ref
              imagen subida. "auto" rota entre 8 poses para darle variedad a
              la galería; el resto fija una pose para todos los shots. */}
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] font-semibold text-fg-faint uppercase tracking-widest">✨ Pose</span>
              <span className="text-[9px] text-fg-faint italic">{config.ecomPosePreset === "auto" ? "rota entre 8" : "fija"}</span>
            </div>
            <select
              value={config.ecomPosePreset}
              onChange={(e) => setConfig((p) => ({ ...p, ecomPosePreset: e.target.value }))}
              className="w-full px-2 py-1.5 text-[11px] bg-surface-0 border border-edge focus:border-[var(--color-brand)] rounded-[var(--radius-sm)] outline-none cursor-pointer"
            >
              <option value="auto">Auto · rota entre 8 poses por outfit</option>
              <optgroup label="Pose fija (todos los shots iguales)">
                {Object.entries(POSE_PRESETS).map(([key, p]) => (
                  <option key={key} value={key}>{p.label}</option>
                ))}
              </optgroup>
            </select>
            <p className="text-[10px] text-fg-faint">
              Si subís una pose ref imagen a un shot, esa pose gana sobre el preset.
            </p>
          </div>

          {/* Accesorios — sección dedicada para items que aparecen en on-model PERO
              NO generan flats propios (zapatos, collar, cinturón, gorra, gafas).
              Empieza vacía por default — antes mostraba TODAS las prendas no
              seleccionadas como "candidatas a accesorio" lo cual era confuso
              (¿una campera es accesorio?). Ahora: subís un accesorio directo
              y queda auto-marcado. Si necesitás reusar uno que ya está cargado
              como prenda, lo marcás desde el listado. */}
          {activeBrand && (
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] font-semibold text-fg-faint uppercase tracking-widest">
                  ✨ Accesorios {config.ecomAccessoryIds.length > 0 && `(${config.ecomAccessoryIds.length})`}
                </span>
                <span className="text-[9px] text-fg-faint italic">solo on-model, sin flats</span>
              </div>

              {/* Hidden file input + botón visible que lo dispara. Acepta múltiples
                  archivos — bajo el patrón "subí los 3 zapatos juntos" — los sube
                  en serie. */}
              <input
                ref={accessoryInputRef}
                type="file"
                accept={IMAGE_ACCEPT}
                multiple
                className="hidden"
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  e.target.value = "";
                  if (files.length === 0 || !activeBrand) return;
                  setAccessoryUploading(true);
                  try {
                    const newIds: string[] = [];
                    for (const file of files) {
                      // Nombre por filename (sin extensión). El backend ya tiene auto-describe
                      // por Gemini Vision, así que la description sale de ahí.
                      const baseName = file.name.replace(/\.[^.]+$/, "").slice(0, 60) || "Accesorio";
                      const item = await uploadClothing(activeBrand.id, baseName, file, "", "accessory");
                      newIds.push(item.id);
                    }
                    await refreshBrands();
                    // Auto-marcar los nuevos como accesorios + sumarlos a selected
                    // para que el handler los pase como STYLING ACCESSORY en on-model.
                    setConfig((p) => ({
                      ...p,
                      ecomAccessoryIds: [...p.ecomAccessoryIds, ...newIds],
                      selectedClothingIds: [...p.selectedClothingIds, ...newIds.filter((id) => !p.selectedClothingIds.includes(id))],
                    }));
                  } catch (err) {
                    console.error("[ecommerce_pack] accessory upload failed:", err);
                    alert(err instanceof Error ? err.message : "No se pudo subir el accesorio.");
                  } finally {
                    setAccessoryUploading(false);
                  }
                }}
              />

              {/* Items del brand kit con tag "accessory" — accesorios cargados desde
                  BrandSettings → Accesorios. Acá los mostramos como tildables. Si no
                  hay ninguno cargado en el kit todavía, mostramos solo el botón de
                  subir directo. */}
              {(() => {
                const kitAccessories = (activeBrand?.clothing || []).filter(
                  (c) => (c.tags || []).some((t) => t === "accessory")
                );
                const showKitGrid = config.ecomAccessoryIds.length === 0 && kitAccessories.length > 0;
                return showKitGrid;
              })() && (
                <div className="space-y-1.5">
                  <p className="text-[9px] text-fg-faint uppercase tracking-wider">Del brand kit — click para tildar</p>
                  <div className="grid grid-cols-3 gap-1">
                    {(activeBrand?.clothing || [])
                      .filter((c) => (c.tags || []).some((t) => t === "accessory"))
                      .map((item) => (
                        <div key={item.id} className="group/tile relative">
                          <button
                            onClick={() => setConfig((p) => ({
                              ...p,
                              ecomAccessoryIds: [...p.ecomAccessoryIds, item.id],
                              selectedClothingIds: p.selectedClothingIds.includes(item.id)
                                ? p.selectedClothingIds
                                : [...p.selectedClothingIds, item.id],
                            }))}
                            title={`Usar ${item.name}`}
                            className="w-full border border-edge hover:border-[var(--color-brand)] rounded-[var(--radius-sm)] p-1 transition-all cursor-pointer text-left"
                          >
                            <div className="aspect-square bg-surface-2 rounded-[2px] overflow-hidden mb-1">
                              {item.imageUrl && (
                                <img src={clothingImageUrl(item.imageUrl)} alt={item.name} className="w-full h-full object-cover" />
                              )}
                            </div>
                            <span className="text-[9px] text-fg-muted truncate block font-medium leading-tight">{item.name}</span>
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!activeBrand) return;
                              if (!confirm(`Borrar "${item.name}" del Brand Kit? Se quita de TODAS las tools, no se puede deshacer.`)) return;
                              try {
                                await deleteClothing(activeBrand.id, item.id);
                                await refreshBrands();
                              } catch (err) {
                                console.error("[ecommerce_pack] delete accessory failed:", err);
                                alert("No se pudo borrar el accesorio.");
                              }
                            }}
                            title="Borrar del Brand Kit (no se puede deshacer)"
                            className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-black/70 hover:bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/tile:opacity-100 transition-opacity cursor-pointer z-20"
                          >
                            <Trash2 size={9} />
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {config.ecomAccessoryIds.length === 0 ? (
                <button
                  onClick={() => accessoryInputRef.current?.click()}
                  disabled={accessoryUploading}
                  className={cn(
                    "w-full py-4 border border-dashed rounded-[var(--radius-sm)] text-[11px] flex flex-col items-center justify-center gap-1 transition-colors",
                    accessoryUploading
                      ? "border-edge text-fg-faint cursor-not-allowed"
                      : "border-edge hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-subtle)] text-fg-muted hover:text-fg cursor-pointer",
                  )}
                  title="Zapatos, collar, gorra, cinturón, gafas, etc."
                >
                  {accessoryUploading ? (
                    <><Loader2 size={13} className="animate-spin" /> Subiendo…</>
                  ) : (
                    <>
                      <Plus size={13} />
                      <span>Subir accesorio nuevo</span>
                      <span className="text-[9px] text-fg-faint">zapatos, collar, gorra, cinturón…</span>
                    </>
                  )}
                </button>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-1">
                    {(activeBrand.clothing || [])
                      .filter((c) => config.ecomAccessoryIds.includes(c.id))
                      .map((item) => (
                        // Wrapper para que el botón trash pueda vivir afuera del
                        // <button> principal (no se pueden anidar buttons).
                        <div key={item.id} className="group/tile relative">
                          <button
                            onClick={() => setConfig((p) => ({
                              ...p,
                              ecomAccessoryIds: p.ecomAccessoryIds.filter((x) => x !== item.id),
                              selectedClothingIds: p.selectedClothingIds.filter((x) => x !== item.id),
                            }))}
                            title={`Quitar de esta sesión: ${item.name}`}
                            className="relative w-full border border-[var(--color-brand)] bg-[var(--color-brand-subtle)] shadow-[0_0_14px_-4px_var(--color-brand-muted)] rounded-[var(--radius-sm)] p-1 transition-all cursor-pointer text-left"
                          >
                            <div className="aspect-square bg-surface-2 rounded-[2px] overflow-hidden mb-1">
                              {item.imageUrl && (
                                <img src={clothingImageUrl(item.imageUrl)} alt={item.name} className="w-full h-full object-cover" />
                              )}
                            </div>
                            <span className="text-[9px] text-fg-muted truncate block font-medium leading-tight">{item.name}</span>
                            <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-[var(--color-brand)] flex items-center justify-center z-10 shadow-sm">
                              <Check size={8} className="text-[var(--color-brand-fg)]" />
                            </div>
                          </button>
                          {/* Trash icon en hover — borra el accesorio del Brand Kit
                              entero (no solo de la sesión). Con confirm porque es
                              destructivo y propaga a TODAS las tools. */}
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!confirm(`Borrar "${item.name}" del Brand Kit? Se quita de TODAS las tools, no se puede deshacer.`)) return;
                              try {
                                await deleteClothing(activeBrand.id, item.id);
                                await refreshBrands();
                                setConfig((p) => ({
                                  ...p,
                                  ecomAccessoryIds: p.ecomAccessoryIds.filter((x) => x !== item.id),
                                  selectedClothingIds: p.selectedClothingIds.filter((x) => x !== item.id),
                                }));
                              } catch (err) {
                                console.error("[ecommerce_pack] delete accessory failed:", err);
                                alert("No se pudo borrar el accesorio.");
                              }
                            }}
                            title="Borrar del Brand Kit (no se puede deshacer)"
                            className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-black/70 hover:bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/tile:opacity-100 transition-opacity cursor-pointer z-20"
                          >
                            <Trash2 size={9} />
                          </button>
                        </div>
                      ))}
                    {/* "+ Sumar más" como tile extra al final del grid. */}
                    <button
                      onClick={() => accessoryInputRef.current?.click()}
                      disabled={accessoryUploading}
                      className={cn(
                        "aspect-square border border-dashed rounded-[var(--radius-sm)] flex items-center justify-center transition-colors",
                        accessoryUploading
                          ? "border-edge text-fg-faint cursor-not-allowed"
                          : "border-edge hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-subtle)] text-fg-muted hover:text-fg cursor-pointer",
                      )}
                      title="Subir otro accesorio"
                    >
                      {accessoryUploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-fg-faint">
                    Click en un tile para sacarlo. Se usan como ref en on-model y se preservan exactos. <strong>No generan flats</strong>.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {tool.id === "fashion_editorial" && (
        <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-4 space-y-4">
          {([
            { key: "editorialFraming" as const, title: "Encuadre", opts: EDITORIAL_FRAMINGS },
            { key: "editorialLighting" as const, title: "Luz", opts: EDITORIAL_LIGHTING },
            { key: "editorialVibe" as const, title: "Vibe", opts: EDITORIAL_VIBES },
          ]).map(({ key, title, opts }) => (
            <div key={key} className="space-y-1.5">
              <span className="text-[10px] font-semibold text-fg-faint uppercase tracking-widest">{title}</span>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(opts).map(([id, o]) => {
                  const active = (config[key] as string) === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setConfig((p) => ({ ...p, [key]: id }))}
                      title={o.clause}
                      className={cn(
                        "px-3 py-1 text-[11px] font-medium rounded-full cursor-pointer transition-colors border",
                        active ? "bg-[var(--color-action-subtle)] border-[var(--color-action-muted)] text-fg" : "bg-surface-0 border-edge text-fg-muted hover:text-fg",
                      )}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="text-[10px] text-fg-faint leading-snug">
            Elegí <strong>modelo</strong> + <strong>prenda</strong> arriba. Escribí tu pedido en <strong>español</strong> en &ldquo;Tu pedido&rdquo; — Gemini lo interpreta y arma el prompt. Afiná con <strong>moodboard</strong> y/o <strong>Look &amp; Feel</strong> (se analiza en receta, sin filtrar la escena). Generá varias <strong>variantes</strong> y elegí la mejor.
          </p>
        </div>
      )}

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
                    config.reelMode === m.id ? "bg-fg text-[var(--color-canvas)] shadow-sm" : "text-fg-faint hover:text-fg"
                  )}
                >{m.label}</button>
              ))}
            </div>
            <p className="text-[10px] text-fg-faint">
              {config.reelMode === "looks"
                ? "Cada prenda × cada plano = una escena. Configurá los planos abajo (ej. general + detalle = 2 escenas por outfit)."
                : "4 escenas con arco narrativo: gancho visual → movimiento → héroe → cierre."}
            </p>
          </div>

          {/* Looks-mode: shot selection per outfit. Solo visible cuando reelMode==="looks".
              Cada shot tildado genera UNA escena por cada outfit seleccionado en clothing.
              El motion del shot se inyecta en handleAnimate para que el detalle tenga dolly-in
              en lugar del sway genérico de modelo. */}
          {config.reelMode === "looks" && (
            <>
              {/* Escenario — preset de location que pisa el setting inferido. "Brand Kit"
                  usa el background del Brand Kit + Setting/Locación de Ajustes. El resto
                  fuerza un texto fijo al image_prompt para que Nano Banana NO invente
                  un loft/habitación cuando el usuario pidió estudio blanco. */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold text-fg-faint uppercase tracking-widest">Escenario</span>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { id: "brand" as const, label: "Brand Kit", desc: "Usa el Fondo seleccionado del Brand Kit + Setting/Locación de Ajustes" },
                    { id: "studio_white" as const, label: "Estudio blanco", desc: "Fondo blanco infinito con luz softbox profesional" },
                    { id: "studio_black" as const, label: "Estudio negro", desc: "Fondo negro infinito con luz lateral dramática" },
                    { id: "street" as const, label: "Urbano", desc: "Calle urbana, hora dorada" },
                    { id: "natural" as const, label: "Natural", desc: "Exterior con luz natural difusa" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      title={p.desc}
                      onClick={() => setConfig((c) => ({ ...c, locationPreset: p.id }))}
                      className={cn(
                        "px-2 py-1.5 rounded-[var(--radius-sm)] border text-[10px] cursor-pointer transition-colors text-center leading-tight",
                        config.locationPreset === p.id
                          ? "bg-[var(--color-brand-subtle)] border-[var(--color-brand)] text-fg"
                          : "bg-surface-0 border-edge text-fg-muted hover:text-fg",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-fg-faint">
                  {config.locationPreset === "brand"
                    ? "Usa el fondo del Brand Kit; podés afinar con Setting/Locación abajo."
                    : "Pisa cualquier fondo del Brand Kit y fuerza este escenario en todas las escenas."}
                </p>
              </div>

              {/* Planos por outfit — contador por shot. Cada click incrementa la
                  cantidad de escenas a generar para ese plano. Ej. plano general ×2
                  + detalle ×1 = 3 escenas por outfit. Internamente el array contiene
                  el shot repetido N veces, respetando orden de tildado. */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold text-fg-faint uppercase tracking-widest">Planos por outfit</span>
                <div className="space-y-1">
                  {Object.entries(VIDEO_SHOT_CATALOG).map(([id, shot]) => {
                    const count = config.looksShots.filter((s) => s === id).length;
                    const on = count > 0;
                    const inc = () => setConfig((p) => ({ ...p, looksShots: [...p.looksShots, id] }));
                    const dec = () => setConfig((p) => {
                      const idx = p.looksShots.lastIndexOf(id);
                      if (idx === -1) return p;
                      return { ...p, looksShots: [...p.looksShots.slice(0, idx), ...p.looksShots.slice(idx + 1)] };
                    });
                    return (
                      <div
                        key={id}
                        title={shot.framing}
                        className={cn(
                          "flex items-center gap-2 px-2.5 py-1.5 rounded-[var(--radius-sm)] border text-[11px] transition-colors",
                          on ? "bg-[var(--color-brand-subtle)] border-[var(--color-brand)] text-fg" : "bg-surface-0 border-edge text-fg-muted",
                        )}
                      >
                        <span
                          onClick={inc}
                          className="flex-1 cursor-pointer select-none"
                        >
                          {shot.label}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={dec}
                            disabled={count === 0}
                            className={cn(
                              "w-5 h-5 rounded flex items-center justify-center text-[14px] leading-none font-bold transition-colors",
                              count === 0 ? "text-fg-faint cursor-not-allowed" : "text-fg-muted hover:bg-surface-2 hover:text-fg cursor-pointer",
                            )}
                          >
                            −
                          </button>
                          <span className={cn(
                            "min-w-[18px] text-center text-[11px] font-semibold",
                            on ? "text-[var(--color-brand)]" : "text-fg-faint",
                          )}>
                            {count}
                          </span>
                          <button
                            type="button"
                            onClick={inc}
                            disabled={count >= 6}
                            className={cn(
                              "w-5 h-5 rounded flex items-center justify-center text-[14px] leading-none font-bold transition-colors",
                              count >= 6 ? "text-fg-faint cursor-not-allowed" : "text-fg-muted hover:bg-surface-2 hover:text-fg cursor-pointer",
                            )}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-fg-faint">
                  {(() => {
                    const totalShots = config.looksShots.length || DEFAULT_LOOKS_SHOTS.length;
                    return `${totalShots} plano(s) por outfit · si dejás en 0 todos, usa los defaults (${DEFAULT_LOOKS_SHOTS.join(" + ")})`;
                  })()}
                </p>
              </div>
            </>
          )}

          {/* Duración por clip — Kling V3 Pro solo acepta 5s o 10s (mínimo 5).
              Total del reel = N escenas × clipDuration. Default 5s (más barato y
              rápido). Visible para todas las variantes de Fashion Reel + Kling. */}
          {config.animationEngine === "kling" && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold text-fg-faint uppercase tracking-widest">Duración por clip</span>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: "5" as const, label: "5 segundos", desc: "Default — más barato. Mínimo soportado por Kling V3 Pro." },
                  { id: "10" as const, label: "10 segundos", desc: "Clips más largos y suaves (mejor para frame-to-frame). Cuesta el doble." },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    title={opt.desc}
                    onClick={() => setConfig((p) => ({ ...p, clipDuration: opt.id }))}
                    className={cn(
                      "px-2.5 py-2 rounded-[var(--radius-sm)] border text-[11px] cursor-pointer transition-colors text-center leading-snug",
                      config.clipDuration === opt.id
                        ? "bg-[var(--color-brand-subtle)] border-[var(--color-brand)] text-fg"
                        : "bg-surface-0 border-edge text-fg-muted hover:text-fg",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-fg-faint">
                Total estimado: N escenas × {config.clipDuration}s. Kling V3 Pro no soporta menos de 5s.
              </p>
            </div>
          )}

          {/* Modo de animación de clips — antes vivía enterrado dentro de "Ajustes
              técnicos > Motor de video". El default "auto" forzaba frame-to-frame
              en Looks mode sin que el usuario lo viera. Lo subimos acá para que sea
              decisión consciente. Solo aparece en Looks + Kling (Seedance no soporta
              f2f). */}
          {config.reelMode === "looks" && config.animationEngine === "kling" && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold text-fg-faint uppercase tracking-widest">Movimiento de cada clip</span>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: "single-frame", label: "Cada plano en su lugar", desc: "El modelo se mueve dentro del frame (sway, pelo, postura). Cada clip es independiente." },
                  { id: "frame-to-frame", label: "Transición entre planos", desc: "Cada clip morpha del plano N al plano N+1. Estilo catálogo / lookbook." },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    title={opt.desc}
                    onClick={() => setConfig((p) => ({ ...p, creativeMode: opt.id as ToolConfig["creativeMode"] }))}
                    className={cn(
                      "px-2.5 py-2 rounded-[var(--radius-sm)] border text-[11px] cursor-pointer transition-colors text-left leading-snug",
                      config.creativeMode === opt.id
                        ? "bg-[var(--color-brand-subtle)] border-[var(--color-brand)] text-fg"
                        : "bg-surface-0 border-edge text-fg-muted hover:text-fg",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-fg-faint">
                {config.creativeMode === "frame-to-frame"
                  ? "Cada clip = morph entre 2 planos consecutivos. Funciona mejor con planos del mismo outfit."
                  : "Cada plano = clip independiente con motion específico del shot (general/detail/back tienen movimientos distintos)."}
              </p>
            </div>
          )}

          {/* Visual style */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-semibold text-fg-faint uppercase tracking-widest">Estilo visual</span>
            <select
              value={config.visualStyle}
              onChange={(e) => setConfig((p) => ({ ...p, visualStyle: e.target.value as typeof p.visualStyle }))}
              className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-edge bg-surface-1 text-[12px] text-fg outline-none focus:border-[var(--color-action)] cursor-pointer"
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
        <>
          <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-3 space-y-2">
            <label className="text-[12px] font-semibold text-fg-secondary">Modo de salida</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setConfig((p) => ({ ...p, includeCopy: true }))}
                className={cn(
                  "px-3 py-2 text-[11px] font-semibold rounded-[var(--radius-sm)] border transition-all cursor-pointer text-left",
                  config.includeCopy !== false
                    ? "bg-fg text-[var(--color-canvas)] border-[var(--color-action)]"
                    : "bg-surface-2 text-fg-muted border-edge hover:text-fg"
                )}
              >
                <div className="font-semibold">Con texto</div>
                <div className="text-[9px] opacity-80 mt-0.5">Ad listo: headline + logo</div>
              </button>
              <button
                onClick={() => setConfig((p) => ({ ...p, includeCopy: false }))}
                className={cn(
                  "px-3 py-2 text-[11px] font-semibold rounded-[var(--radius-sm)] border transition-all cursor-pointer text-left",
                  config.includeCopy === false
                    ? "bg-fg text-[var(--color-canvas)] border-[var(--color-action)]"
                    : "bg-surface-2 text-fg-muted border-edge hover:text-fg"
                )}
              >
                <div className="font-semibold">Sin texto</div>
                <div className="text-[9px] opacity-80 mt-0.5">Editorial limpio, sin overlays</div>
              </button>
            </div>
          </div>
          {/* Batch quantity picker */}
          <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-3 space-y-2">
            <label className="text-[12px] font-semibold text-fg-secondary">Cantidad de ads</label>
            <div className="flex gap-1.5 flex-wrap">
              {([1, 3, 5, 10, "all"] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setConfig((p) => ({ ...p, staticAdBatch: n }))}
                  className={cn(
                    "px-3 py-1.5 rounded-[var(--radius-sm)] text-[11px] font-medium border transition-all cursor-pointer",
                    config.staticAdBatch === n
                      ? "border-[var(--color-action)] bg-[var(--color-action-muted)] text-fg"
                      : "border-edge bg-surface-2 text-fg-muted hover:text-fg"
                  )}
                >
                  {n === "all" ? "Todos (40)" : n}
                </button>
              ))}
            </div>
            {config.staticAdBatch !== 1 && (
              <p className="text-[10px] text-fg-faint italic">
                Genera {config.staticAdBatch === "all" ? "todos los 40" : `${config.staticAdBatch}`} ads, cada uno con un template distinto random{config.staticAdCategory ? ` de la categoría ${config.staticAdCategory}` : ""}. Tu selección manual de template se ignora.
              </p>
            )}
          </div>

          {/* Category filter (only when batch > 1) */}
          {config.staticAdBatch !== 1 && (
            <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-3 space-y-2">
              <label className="text-[12px] font-semibold text-fg-secondary">Filtro de categoría <span className="text-fg-faint font-normal">(opcional)</span></label>
              <div className="flex gap-1.5 flex-wrap">
                {(["", "brand", "promo", "social_proof", "educational", "comparison", "ugc"]).map((cat) => (
                  <button
                    key={cat || "all"}
                    onClick={() => setConfig((p) => ({ ...p, staticAdCategory: cat }))}
                    className={cn(
                      "px-2.5 py-1 rounded-[var(--radius-sm)] text-[10px] font-medium border transition-all cursor-pointer capitalize",
                      config.staticAdCategory === cat
                        ? "border-[var(--color-action)] bg-[var(--color-action-muted)] text-fg"
                        : "border-edge bg-surface-2 text-fg-muted hover:text-fg"
                    )}
                  >
                    {cat === "" ? "Todas" : cat.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Template selector — only relevant when batch === 1 */}
          {config.staticAdBatch === 1 && (
            <TemplateSelector
              selectedId={config.adTemplate}
              onSelect={(id) => setConfig((p) => ({ ...p, adTemplate: id }))}
            />
          )}
        </>
      )}

      {/* Instagram Importer — for Carousel only. Lets the user paste an IG URL,
          scrape via Apify, and choose which slide to use as template. */}
      {tool.id === "carousel_creator" && (
        <InstagramCarouselImporter
          onUseAsTemplate={(slideDataUrl) => {
            // Convert dataURL to File and inject as referenceImages
            try {
              const m = slideDataUrl.match(/^data:([^;]+);base64,(.+)$/);
              if (!m) return;
              const [, mime, b64] = m;
              const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
              const blob = new Blob([bytes], { type: mime });
              const file = new File([blob], `ig-template-${Date.now()}.jpg`, { type: mime });
              setConfig((p) => ({ ...p, referenceImages: [file], referenceMode: "composition" }));
            } catch (err) {
              console.error("[ig-importer] failed to attach slide:", err);
            }
          }}
        />
      )}

      {/* Carousel coherence banner — shows which mode the generation will use */}
      {tool.id === "carousel_creator" && activeBrand && (() => {
        const ds = (activeBrand as Record<string, unknown>).designSystem as Record<string, unknown> | undefined;
        const hasTemplate = config.referenceImages.length > 0;
        const hasDesignSystem = !!ds && (
          !!ds.photoStyle || !!ds.composition || !!ds.colorTreatment ||
          (Array.isArray(ds.visualDos) && (ds.visualDos as unknown[]).length > 0)
        );
        if (hasTemplate) {
          return (
            <div className="px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--color-action-muted)] border border-[var(--color-action)] flex items-center gap-2">
              <Check size={12} className="text-[var(--color-action-strong)] shrink-0" />
              <p className="text-[11px] text-fg-muted">
                <span className="font-semibold text-fg">Template cargado</span> — todos los slides van a respetar este layout
              </p>
            </div>
          );
        }
        if (hasDesignSystem) {
          return (
            <div className="px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--color-action-subtle)] border border-[var(--color-action-muted)] flex items-start gap-2">
              <Sparkles size={12} className="text-[var(--color-action-strong)] shrink-0 mt-0.5" />
              <p className="text-[11px] text-fg-muted leading-relaxed">
                <span className="font-semibold text-fg">Sin template visual</span> — los slides van a compartir paleta y estilo del Design System, pero el layout puede variar entre slides. Para mejor coherencia: subí una imagen como template arriba.
              </p>
            </div>
          );
        }
        return (
          <div className="px-3 py-2 rounded-[var(--radius-sm)] bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
            <span className="text-amber-400 shrink-0 text-[14px] leading-none">⚠</span>
            <p className="text-[11px] text-fg-muted leading-relaxed">
              <span className="font-semibold text-fg">Sin Design System ni template</span> — el carousel no va a ser coherente entre slides. Cargá un Design System en BrandSettings o subí una imagen como template arriba.
            </p>
          </div>
        );
      })()}

      {/* Carousel — Quick / Compose mode toggle */}
      {tool.id === "carousel_creator" && (
        <>
          <ModelDropdown
            label="Modo de salida"
            value={config.composeMode === "compose" ? "compose" : "quick"}
            onChange={(next) => setConfig((p) => ({ ...p, composeMode: next as "quick" | "compose" }))}
            options={[
              { id: "quick", label: "Quick — texto en imagen", sub: "Rápido. La IA mete el texto en pixel. Tipografía aproximada." },
              { id: "compose", label: "Compose — overlay con brand fonts", sub: "Imagen limpia + texto editable con tipografía REAL de la marca." },
            ]}
          />
          {config.composeMode === "compose" && (
            <p className="text-[10px] text-fg-faint italic -mt-1">
              Después de generar las imágenes vas a poder editar el copy live, cambiar el template y exportar PNG con Awesome Serif / Montserrat / la tipografía de la marca.
            </p>
          )}
        </>
      )}

      {/* Carousel — slide count picker (sin tipos predefinidos: el contenido sale del Creative Direction) */}
      {tool.id === "carousel_creator" && (
        <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-3 space-y-2">
          <label className="text-[12px] font-semibold text-fg-secondary">Cantidad de slides</label>
          <div className="flex gap-1.5 flex-wrap">
            {[2, 3, 4, 5, 6, 7, 8, 10].map((n) => (
              <button
                key={n}
                onClick={() => setConfig((p) => ({ ...p, numSlides: n }))}
                className={cn(
                  "px-3 py-1.5 rounded-[var(--radius-sm)] text-[11px] font-medium border transition-all cursor-pointer",
                  config.numSlides === n
                    ? "border-[var(--color-action)] bg-[var(--color-action-muted)] text-fg"
                    : "border-edge bg-surface-2 text-fg-muted hover:text-fg"
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-fg-faint">
            La estructura del carousel sale del Creative Direction de abajo (ej: "antes / después", "5 razones para...", "lookbook editorial").
          </p>
        </div>
      )}

      {/* Animation mode selector (Product Clip, Video Ad Creator) */}
      {(tool.id === "product_clip" || tool.id === "video_ad_creator") && (
        <ModelDropdown
          label="Modo de animación"
          value={config.animationMode || "frame-to-frame"}
          onChange={(next) => setConfig((p) => ({ ...p, animationMode: next as ToolConfig["animationMode"] }))}
          options={[
            { id: "frame-to-frame", label: "Frame-to-Frame", sub: "Transiciones suaves entre escenas" },
            { id: "image-to-video", label: "Image-to-Video", sub: "Una sola imagen base se anima" },
          ]}
        />
      )}

      {/* Reference image(s) + Graphics uploaders */}
      {/* Fashion Reel — explica el reparto de roles entre inputs, para que no sea
          confuso pasar pose + escena + look&feel a la vez. Cada input controla UNA cosa. */}
      {tool.id === "fashion_reel" && (
        <div className="bg-surface-1 border border-blue-500/30 rounded-[var(--radius-md)] p-3 space-y-1.5">
          <div className="text-[11px] font-semibold text-blue-300 flex items-center gap-1.5">
            <ImageIcon size={12} /> Cómo se reparten los inputs
          </div>
          <p className="text-[10px] text-fg-muted leading-relaxed">
            Cada referencia controla <strong>una sola cosa</strong> — no se pisan entre sí:
          </p>
          <ul className="text-[10px] text-fg-muted space-y-0.5 pl-1">
            <li>📐 <strong>Pose</strong> (abajo, &ldquo;Referencia de POSE&rdquo;) → solo postura + encuadre</li>
            <li>🏞️ <strong>Escena + luz</strong> → seleccioná un <strong>Background</strong> del brand kit</li>
            <li>🎨 <strong>Look &amp; feel</strong> (estética/color) → seleccioná un <strong>Moodboard</strong> del brand kit</li>
            <li>👤 <strong>Identidad</strong> → el <strong>Avatar</strong> elegido</li>
            <li>👕 <strong>Prendas / producto</strong> → Clothing / Products del kit</li>
          </ul>
          <p className="text-[9px] text-fg-faint pt-0.5">
            Si pasás varios, el motor toma de cada uno solo su rol (la pose no aporta luz, el fondo no aporta pose, etc).
          </p>
        </div>
      )}

      {/* Ecommerce Pack: SOLO Look & Feel. La Referencia de POSE global fue
          eliminada porque las pose refs por shot (en el bloque "Tomas a generar")
          ya cubren ese caso de uso, mejor: una pose distinta por shot en lugar
          de una sola global. */}
      {tool.id === "ecommerce_pack" && (
        <div>
          <CompactRefCard
            title="Referencia Look & Feel"
            hint="Imagen de iluminación/estética — Nano Banana copia el look, no el contenido."
            files={config.referenceImages}
            onAdd={(f) => setConfig((p) => ({ ...p, referenceImages: [f] }))}
            onRemove={(i) => setConfig((p) => ({ ...p, referenceImages: p.referenceImages.filter((_, j) => j !== i) }))}
          />
        </div>
      )}

      {(schema.showReference || tool.id === "content_analyzer") && tool.id !== "ecommerce_pack" && (
        <div className={cn(
          "gap-4",
          tool.id === "static_ad" ? "grid grid-cols-2" : "space-y-4",
          // Single-image reference tools → keep it compact (not full-width sprawl).
          ["fashion_reel", "ugc_creator", "product_spotlight", "product_clip", "fashion_editorial"].includes(tool.id) && "sm:max-w-md",
        )}>
          {/* Reference Image — single for Static Ad, multiple for Ad Creative Lab */}
          <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-semibold text-fg-secondary">
                {tool.id === "content_analyzer" ? "Upload Video"
                  : tool.id === "fashion_reel" ? "Referencia de POSE"
                  : tool.id === "ugc_creator" ? "Composition Reference"
                  : tool.id === "carousel_creator" ? "Template del Carousel"
                  : tool.id === "ecommerce_pack" ? "Referencia Look & Feel"
                  : tool.id === "fashion_editorial" ? "Referencia Look & Feel"
                  : tool.id === "product_sheet" ? "Fotos del producto"
                  : (tool.id === "static_ad" || tool.id === "product_clip") ? "Reference Image"
                  : "Reference Images"}
                <span className="text-fg-faint font-normal ml-1">
                  {tool.id === "content_analyzer" ? "(MP4, WebM — or use URL above)"
                    : tool.id === "fashion_reel" ? "(solo postura y encuadre — no toma luz ni escena)"
                    : tool.id === "ugc_creator" ? "(optional — pose/setting reference for first scene)"
                    : tool.id === "carousel_creator" ? "(layout / tipografía / estilo que respetan TODOS los slides)"
                    : tool.id === "ecommerce_pack" ? "(imagen de iluminación/estética — Nano Banana copia el look, no el contenido)"
                    : tool.id === "fashion_editorial" ? "(iluminación/color — se analiza en receta de texto, sin filtrar la escena)"
                    : tool.id === "product_sheet" ? "(subí acá front / back / detail / packaging si no usás un producto del Brand Kit)"
                    : (tool.id === "static_ad" || tool.id === "product_clip") ? "(style/mood reference)"
                    : "(campaign style references)"}
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
              <Plus size={11} /> {tool.id === "content_analyzer" ? "Upload video"
                : tool.id === "carousel_creator" ? "Subir template"
                : tool.id === "product_sheet" ? "Subir fotos del producto"
                : (tool.id === "static_ad" || tool.id === "product_clip") ? "Upload reference"
                : "Add references"}
              <input
                type="file"
                accept={tool.id === "content_analyzer" ? "video/*" : IMAGE_ACCEPT}
                multiple={tool.id !== "static_ad" && tool.id !== "content_analyzer" && tool.id !== "product_clip" && tool.id !== "carousel_creator"}
                className="hidden"
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 0) {
                    setConfig((p) => ({
                      ...p,
                      referenceImages: tool.id === "static_ad" || tool.id === "carousel_creator" ? [files[0]] : [...p.referenceImages, ...files].slice(0, 10),
                      // Carousel: when a template is uploaded, default to "composition" — that's the use case
                      referenceMode: tool.id === "carousel_creator" ? "composition" : p.referenceMode,
                    }));
                    // Auto-classify the uploaded reference (only for image tools, not video)
                    if (tool.id !== "content_analyzer" && files[0].type.startsWith("image/")) {
                      setRefClassification(null);
                      setClassifyingRef(true);
                      try {
                        console.log("[ref-classify] analyzing uploaded image...");
                        const classification = await classifyReferenceImage(files[0]);
                        console.log("[ref-classify] result:", classification);
                        setRefClassification(classification);
                      } catch (err) {
                        console.error("[ref-classify] failed:", err);
                      } finally {
                        setClassifyingRef(false);
                      }
                    }
                  }
                  e.target.value = "";
                }}
              />
            </label>

            {/* Loading state while classifying */}
            {classifyingRef && tool.id === "static_ad" && (
              <div className="mt-2 p-2.5 bg-surface-1 border border-edge rounded-[var(--radius-sm)] flex items-center gap-2">
                <Loader2 size={12} className="animate-spin text-[var(--color-action-strong)]" />
                <span className="text-[11px] text-fg-muted">Analizando la referencia con IA...</span>
              </div>
            )}

            {/* Auto-classification suggestion banner */}
            {refClassification && !classifyingRef && tool.id === "static_ad" && (() => {
              const slotMap: Record<string, { label: string; emoji: string }> = {
                product:    { label: "un producto",          emoji: "📦" },
                avatar:     { label: "una persona",          emoji: "👤" },
                background: { label: "un fondo / locación",  emoji: "🏙️" },
                moodboard:  { label: "un moodboard",         emoji: "🎨" },
                reference:  { label: "una escena completa",  emoji: "🔍" },
              };
              const slot = slotMap[refClassification.suggested_slot] || slotMap.reference;
              const isReference = refClassification.suggested_slot === "reference";

              return (
                <div className="mt-2 p-2.5 bg-[var(--color-action-muted)] border border-[var(--color-action-muted)] rounded-[var(--radius-sm)] space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-semibold text-[var(--color-action-strong)] uppercase tracking-wider mb-0.5">
                        {slot.emoji} {isReference ? "Análisis visual" : `Parece ${slot.label}`}
                      </div>
                      <p className="text-[10px] text-fg-muted leading-relaxed">
                        {refClassification.description}
                      </p>
                    </div>
                    <button
                      onClick={() => setRefClassification(null)}
                      className="text-fg-faint hover:text-fg cursor-pointer shrink-0"
                      title="Cerrar"
                    >
                      <X size={11} />
                    </button>
                  </div>

                  {!isReference && (
                    <p className="text-[10px] text-fg-faint leading-relaxed italic">
                      Hoy la imagen se usa solo como referencia visual (estilo o composición). Si querés que sea {slot.label} literal en el ad, subila al Brand Kit.
                    </p>
                  )}

                  {isReference && (
                    <p className="text-[10px] text-fg-faint leading-relaxed italic">
                      Elegí abajo cómo querés usarla: <b>Estilo</b> (copia mood/colores) o <b>Composición</b> (copia layout + setting).
                    </p>
                  )}

                  {!isReference && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => setRefClassification(null)}
                        className="flex-1 px-2 py-1 text-[10px] font-medium text-[var(--color-action-strong)] bg-surface-1 hover:bg-surface-2 border border-edge rounded-[var(--radius-sm)] cursor-pointer"
                      >
                        Dejar como referencia
                      </button>
                      <Link
                        to="/dashboard/brand"
                        onClick={() => setRefClassification(null)}
                        className="flex-1 px-2 py-1 text-[10px] font-medium text-[var(--color-action-fg)] bg-[var(--color-action)] hover:opacity-90 rounded-[var(--radius-sm)] cursor-pointer text-center"
                      >
                        Ir a Brand Kit →
                      </Link>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Reference mode toggle — for image tools that support style/composition switching */}
            {(tool.id === "static_ad" || tool.id === "carousel_creator") && config.referenceImages.length > 0 && (
              <div className="pt-2 border-t border-edge-subtle mt-2 space-y-1.5">
                <span className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider">
                  {tool.id === "carousel_creator" ? "Cómo usar el template" : "Cómo usar la referencia"}
                </span>
                <div className="inline-flex bg-surface-2 rounded-[var(--radius-sm)] p-0.5 gap-0.5 w-full">
                  <button
                    onClick={() => setConfig((p) => ({ ...p, referenceMode: "style" }))}
                    className={cn(
                      "flex-1 px-2 py-1 text-[10px] font-semibold rounded-[calc(var(--radius-sm)-1px)] transition-all cursor-pointer",
                      config.referenceMode !== "composition" ? "bg-fg text-[var(--color-canvas)] shadow-sm" : "text-fg-faint hover:text-fg"
                    )}
                  >
                    Estilo
                  </button>
                  <button
                    onClick={() => setConfig((p) => ({ ...p, referenceMode: "composition" }))}
                    className={cn(
                      "flex-1 px-2 py-1 text-[10px] font-semibold rounded-[calc(var(--radius-sm)-1px)] transition-all cursor-pointer",
                      config.referenceMode === "composition" ? "bg-fg text-[var(--color-canvas)] shadow-sm" : "text-fg-faint hover:text-fg"
                    )}
                  >
                    Composición
                  </button>
                </div>
                <p className="text-[9px] text-fg-faint leading-relaxed">
                  {tool.id === "carousel_creator" && config.referenceMode === "composition"
                    ? "Cada slide respeta el layout/framing exacto del template — solo cambia el contenido. Mejor con GPT Image 2."
                    : tool.id === "carousel_creator"
                    ? "Cada slide hereda el mood/colores/iluminación del template — el layout puede variar entre slides."
                    : config.referenceMode === "composition"
                    ? "Copia el layout/framing exacto de la referencia. Mejor con GPT Image 2."
                    : "Copia colores, mood e iluminación. La composición la decide el modelo."}
                </p>

                {/* Template color mode — Carousel only, when in Composición mode */}
                {tool.id === "carousel_creator" && config.referenceMode === "composition" && (
                  <div className="pt-2 border-t border-edge-subtle space-y-1.5">
                    <span className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider">Colores</span>
                    <div className="inline-flex bg-surface-2 rounded-[var(--radius-sm)] p-0.5 gap-0.5 w-full">
                      <button
                        onClick={() => setConfig((p) => ({ ...p, templateColorMode: "brand" }))}
                        className={cn(
                          "flex-1 px-2 py-1 text-[10px] font-semibold rounded-[calc(var(--radius-sm)-1px)] transition-all cursor-pointer",
                          config.templateColorMode !== "template" ? "bg-fg text-[var(--color-canvas)] shadow-sm" : "text-fg-faint hover:text-fg"
                        )}
                      >
                        De la marca
                      </button>
                      <button
                        onClick={() => setConfig((p) => ({ ...p, templateColorMode: "template" }))}
                        className={cn(
                          "flex-1 px-2 py-1 text-[10px] font-semibold rounded-[calc(var(--radius-sm)-1px)] transition-all cursor-pointer",
                          config.templateColorMode === "template" ? "bg-fg text-[var(--color-canvas)] shadow-sm" : "text-fg-faint hover:text-fg"
                        )}
                      >
                        Del template
                      </button>
                    </div>
                    <p className="text-[9px] text-fg-faint leading-relaxed">
                      {config.templateColorMode === "template"
                        ? "Mantiene los colores literales del template. Usalo cuando el template es oficial de la marca."
                        : "Re-colorea el template con la paleta del Brand DNA. Usalo cuando el template es de otra marca y solo querés el layout."}
                    </p>
                  </div>
                )}
              </div>
            )}
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
                <input type="file" accept={IMAGE_ACCEPT} multiple className="hidden"
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
                    <img src={`http://127.0.0.1:8000${activeBrand.logo.imageUrl}`} alt="Brand logo" className="max-w-full max-h-full object-contain" />
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
              className="accent-[var(--color-action)]"
            />
            <span className="text-[12px] text-fg-muted">
              Allow faces / people in generated images
            </span>
          </label>
        </div>
      )}

      {/* Video Swap — source video + masking mode. The reference (new look) comes from
          the Reference Image upload above, or a selected product/clothing. */}
      {tool.id === "video_swap" && (
        <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[12px] font-semibold text-fg-secondary">
              Video fuente
              <span className="text-fg-faint font-normal ml-1">(tu propio video — se mantiene el sujeto y el movimiento)</span>
            </label>
            <span className="text-[10px] text-fg-faint">{config.sourceVideo.length} subido</span>
          </div>
          {config.sourceVideo.length > 0 ? (
            <video src={URL.createObjectURL(config.sourceVideo[0])} controls className="w-full max-h-64 rounded-[var(--radius-sm)] bg-black" />
          ) : null}
          <label className="flex items-center justify-center gap-1.5 py-3 border border-dashed rounded-[var(--radius-sm)] cursor-pointer text-[11px] transition-all border-edge hover:border-[var(--color-edge-strong)] hover:bg-surface-2 text-fg-muted hover:text-fg">
            <Plus size={12} /> {config.sourceVideo.length > 0 ? "Cambiar video" : "Subir video fuente"}
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setConfig((p) => ({ ...p, sourceVideo: [f] }));
                e.target.value = "";
              }}
            />
          </label>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-fg-faint">Modo de máscara (qué se mantiene)</label>
            <select
              value={config.alphaMode}
              onChange={(e) => setConfig((p) => ({ ...p, alphaMode: e.target.value as ToolConfig["alphaMode"] }))}
              className="w-full h-8 px-2 rounded-[var(--radius-sm)] border border-edge bg-surface-2 text-[12px] text-fg outline-none focus:border-[var(--color-edge-focus)]"
            >
              <option value="auto">Auto — la IA detecta y enmascara el sujeto sola</option>
              <option value="select">Select — vos marcás el 1er frame, la IA propaga</option>
              <option value="fill">Fill — mantiene todo (sin máscara)</option>
              <option value="custom">Custom — máscara propia frame por frame</option>
            </select>
            <p className="text-[10px] text-fg-faint">
              El <strong>Reference Image</strong> de arriba (o un producto/prenda seleccionado) define el nuevo look.
              SwitchX mantiene el movimiento de tu video y swappea el elemento, relighteando para que matchee.
            </p>
          </div>
        </div>
      )}

      {/* Pose reference — for tools that generate a person (static_ad, product_spotlight).
          Compact + half-width, matching Ecommerce Pack. */}
      {(tool.id === "static_ad" || tool.id === "product_spotlight") && (
        <div className="sm:max-w-md">
          <CompactRefCard
            title="Referencia de POSE"
            hint="Solo postura y encuadre — no toma luz, escena ni estilo. El estilo/mood viene del style reference / moodboard."
            files={config.poseReference}
            onAdd={(f) => setConfig((p) => ({ ...p, poseReference: [f] }))}
            onRemove={(i) => setConfig((p) => ({ ...p, poseReference: p.poseReference.filter((_, j) => j !== i) }))}
          />
        </div>
      )}

      {/* Inputs summary chips — eliminado en Product Sheet porque duplica los labels
          de los AssetSelectors que vienen abajo. En sidebar 440px este "índice"
          ya no aporta valor y confunde (el usuario veía "Producto base (opcional)"
          dos veces). En el resto de las tools se mantiene por ahora. */}
      {tool.id !== "product_sheet" && (schema.showAvatar || schema.showProduct || schema.showClothing || schema.showBackground || schema.showVoice || schema.showLanguage) && (
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

      {/* Asset selection — only render sections that this tool uses.
          En sidebar 440px usamos 1 col siempre (gap chico) para que las cards no
          se encimen. El layout 2-cols del antiguo full-width se descarta. */}
      {(schema.showAvatar || schema.showProduct || schema.showClothing || schema.showBackground || schema.showMoodboard) && (
        <div className="grid grid-cols-1 gap-2">
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
              onDelete={async (id) => {
                await deleteAvatar(activeBrand.id, id);
                await refreshBrands();
                setConfig((p) => ({
                  ...p,
                  selectedAvatarId: p.selectedAvatarId === id ? null : p.selectedAvatarId,
                  selectedAvatarIds: p.selectedAvatarIds.filter((x) => x !== id),
                }));
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
                onDelete={async (id) => {
                  await deleteProduct(activeBrand.id, id);
                  await refreshBrands();
                  setConfig((p) => ({
                    ...p,
                    selectedProductId: p.selectedProductId === id ? null : p.selectedProductId,
                    selectedProductIds: p.selectedProductIds.filter((x) => x !== id),
                  }));
                }}
              />
              {config.selectedProductId && config.selectedAvatarId && (tool.id === "ugc_creator" || tool.id === "static_ad") && (
                <label className="flex items-center gap-2 px-4 py-2 bg-surface-1 border border-edge rounded-[var(--radius-sm)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.productIsWorn}
                    onChange={(e) => setConfig((p) => ({ ...p, productIsWorn: e.target.checked }))}
                    className="accent-[var(--color-action)]"
                  />
                  <span className="text-[12px] text-fg-muted">
                    El modelo <strong>usa</strong> el producto (lo lleva puesto o lo sostiene) — si está apagado, el producto se muestra aparte como hero del ad
                  </span>
                </label>
              )}
            </div>
          )}

          {/* Heads-up when user selected a product AND has clothing visible:
              clarify the interaction so they don't end up with avatar wearing AND
              holding the same garment (common confusion when product = clothing). */}
          {schema.showClothing && schema.showProduct && config.selectedProductId && (
            <div className="px-3 py-2 rounded-[var(--radius-sm)] bg-surface-1 border border-edge-subtle text-[11px] text-fg-muted leading-relaxed">
              <strong className="text-fg">Cómo se combinan Product + Clothing:</strong> el <strong>Product</strong> es lo que el avatar <em>sostiene/muestra</em> (a menos que actives "el modelo usa el producto" arriba — ahí se vuelve lo que lleva puesto). El <strong>Clothing</strong> es lo que el avatar <em>lleva puesto</em>.
              <br />
              · Si querés <strong>vender una prenda mientras la lleva puesta</strong> → seleccioná sólo Product + activá "usa el producto". No selecciones clothing.
              <br />
              · Si querés <strong>mostrar la prenda en mano</strong> mientras lleva otra cosa → Product (sin "usa") + Clothing (otra prenda).
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
              onDelete={async (id) => {
                await deleteClothing(activeBrand.id, id);
                await refreshBrands();
                setConfig((p) => ({
                  ...p,
                  selectedClothingIds: p.selectedClothingIds.filter((x) => x !== id),
                  ecomAccessoryIds: p.ecomAccessoryIds.filter((x) => x !== id),
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
              onDelete={async (id) => {
                await deleteBackground(activeBrand.id, id);
                await refreshBrands();
                setConfig((p) => ({ ...p, selectedBackgroundId: p.selectedBackgroundId === id ? null : p.selectedBackgroundId }));
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
              onDelete={async (id) => {
                await deleteMoodboard(activeBrand.id, id);
                await refreshBrands();
                setConfig((p) => ({ ...p, selectedMoodboardId: p.selectedMoodboardId === id ? null : p.selectedMoodboardId }));
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
                          btn.classList.remove("text-[var(--color-action)]");
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
                          btn.classList.add("text-[var(--color-action)]");
                          btn.dataset.playing = "true";
                          audio.onended = () => {
                            btn.dataset.playing = "false";
                            btn.classList.remove("text-[var(--color-action)]");
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

        {/* Image model selector — solo para tools de generación de imagen.
            ModelDropdown unificado con Lab: una línea fina con popover en vez del
            segmented control + hint. El sub-texto ahora vive DENTRO de la opción. */}
        {["static_ad", "carousel_creator", "ad_creative_lab", "product_spotlight"].includes(tool.id) && (
          <ModelDropdown
            label="Modelo de imagen"
            value={config.imageModel === "gpt-image-2" ? "gpt-image-2" : "nano-banana-2"}
            onChange={(next) => setConfig((p) => ({ ...p, imageModel: next as "nano-banana-2" | "gpt-image-2" }))}
            options={[
              { id: "nano-banana-2", label: "Nano Banana 2", sub: "Multi-ref · mejor para combinar avatar + producto + fondo" },
              { id: "gpt-image-2", label: "GPT Image 2", sub: "Base + edit · mejor para editar sobre una imagen base" },
            ]}
          />
        )}

        {/* Technical settings — siempre visibles (no Collapsible). El usuario los
            quiere a la vista, no escondidos detrás de un toggle. Compactado para
            sidebar 440px: grid 2 cols (no entraban 3 dropdowns), Motor de video sin
            sub-card adentro. */}
        {tool.id !== "content_analyzer" && (
        <div className="space-y-2 pt-1">
          <div className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider">Ajustes técnicos</div>
          <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-fg-faint">AR</label>
            <select
              value={config.aspectRatio}
              onChange={(e) => setConfig((p) => ({ ...p, aspectRatio: e.target.value }))}
              className="w-full h-7 px-1.5 rounded-[var(--radius-sm)] border border-edge bg-surface-2 text-[11px] text-fg outline-none focus:border-[var(--color-edge-focus)]"
            >
              <option value="9:16">9:16 Vertical</option>
              <option value="16:9">16:9 Horizontal</option>
              <option value="1:1">1:1 Square</option>
              <option value="4:5">4:5 Portrait</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-fg-faint">Resolución</label>
            <select
              value={config.resolution}
              onChange={(e) => setConfig((p) => ({ ...p, resolution: e.target.value }))}
              className="w-full h-7 px-1.5 rounded-[var(--radius-sm)] border border-edge bg-surface-2 text-[11px] text-fg outline-none focus:border-[var(--color-edge-focus)]"
            >
              <option value="1K">1K (standard)</option>
              <option value="2K">2K (high quality)</option>
              <option value="4K">4K (production)</option>
            </select>
          </div>
          {/* Subtítulos: solo para tools de video que SÍ tienen voiceover (UGC, Video Ad).
              Fashion Reel es visual-only — no aplica subtítulos. Schema flag `showSubtitles` */}
          {tool.category === "video" && schema.showSubtitles !== false && (
            <div className="space-y-1 col-span-2">
              <label className="text-[10px] font-medium text-fg-faint">Subtítulos</label>
              <select
                value={config.subtitleEngine}
                onChange={(e) => setConfig((p) => ({ ...p, subtitleEngine: e.target.value as ToolConfig["subtitleEngine"] }))}
                className="w-full h-7 px-1.5 rounded-[var(--radius-sm)] border border-edge bg-surface-2 text-[11px] text-fg outline-none focus:border-[var(--color-edge-focus)]"
              >
                <option value="auto">Auto (best available)</option>
                <option value="remotion">Remotion (animated)</option>
                <option value="ffmpeg">FFmpeg (simple)</option>
                <option value="none">No subtitles</option>
              </select>
            </div>
          )}
        </div>

        {/* Motor de video — sub-sección plana dentro del collapsible (sin sub-card).
            Lo separa visualmente solo un divider y el eyebrow. */}
        {schema.showAnimationEngine && (
          <div className="space-y-2 pt-2 mt-1 border-t border-edge">
            <div className="text-[10px] font-semibold text-fg-muted uppercase tracking-wider">
              Motor de video
            </div>

            {/* Animación — ModelDropdown unificado con Lab/imagen. El hint vive
                dentro de cada opción en lugar de abajo como párrafo separado. */}
            <ModelDropdown
              label="Animación"
              value={config.animationEngine}
              onChange={(next) => setConfig((p) => ({ ...p, animationEngine: next as ToolConfig["animationEngine"] }))}
              options={[
                { id: "kling", label: "Kling V3 Pro", sub: "Anima; las talking pasan por HeyGen Avatar 4" },
                { id: "seedance", label: "Seedance 2.0", sub: "Visual + lipsync en un solo modelo, sin HeyGen" },
              ]}
            />

            {/* Modo de clip (single-frame / frame-to-frame) ahora vive en el bloque
                principal de Fashion Reel ("Movimiento de cada clip") cuando Looks
                mode + Kling. No se duplica acá. */}

            {/* Hook de entrada — solo Fashion Reel + Kling. Genera la escena vacía y
                anima a la modelo entrando (f2f vacío → modelo). */}
            {tool.id === "fashion_reel" && config.animationEngine === "kling" && (
              <label className="flex items-start gap-1.5 cursor-pointer pt-0.5">
                <input
                  type="checkbox"
                  checked={(config as unknown as Record<string, unknown>).entryHook === true}
                  onChange={(e) => setConfig((p) => ({ ...(p as Record<string, unknown>), entryHook: e.target.checked } as typeof p))}
                  className="mt-0.5 accent-[var(--color-action)]"
                />
                <span className="text-[10px] text-fg-muted leading-snug">
                  <strong className="text-fg">Hook de entrada</strong> — la modelo entra a la escena 1 (f2f vacío → modelo).
                </span>
              </label>
            )}
          </div>
        )}
        </div>
        )}

        {/* Video Duration — compactado: chips chiquitos (h-7, sin sublabel) y
            contador de palabras integrado en el label de arriba. */}
        {tool.category === "video" && tool.pipeline?.includes("script") && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-medium text-fg-faint">Duración</label>
              <span className="text-[9px] text-fg-faint">
                {(() => {
                  const dur = parseInt(config.videoDuration || "30");
                  const scenes = 4;
                  const wordsPerScene = Math.round(dur / scenes * 2.5);
                  return `~${wordsPerScene} palabras/escena`;
                })()}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {[
                { value: "15", label: "15s" },
                { value: "30", label: "30s" },
                { value: "45", label: "45s" },
                { value: "60", label: "60s" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setConfig((p) => ({ ...p, videoDuration: opt.value }))}
                  className={`h-7 rounded-[var(--radius-sm)] border text-[11px] font-semibold transition-all cursor-pointer ${
                    config.videoDuration === opt.value
                      ? "border-[var(--color-action)] bg-[var(--color-action)]/10 text-fg"
                      : "border-edge bg-surface-2 text-fg-muted hover:border-edge-strong"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Voice settings — only for UGC Creator (has voice step) */}
        {tool.id === "ugc_creator" && (
          <VoiceSettingsPanel config={config} setConfig={setConfig} />
        )}

        {/* Objective / brief — compactado: textarea baja a 2 rows (3 era 80px de alto),
            placeholder más corto, text-[12px]. UGC sigue con 4 rows porque su prompt es largo. */}
        {tool.id !== "content_analyzer" && (
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-fg-faint">
              {schema.objectiveLabel}
            </label>
            <textarea
              value={config.objective}
              onChange={(e) => setConfig((p) => ({ ...p, objective: e.target.value }))}
              rows={tool.id === "ugc_creator" ? 4 : 2}
              placeholder={schema.objectivePlaceholder}
              className="w-full bg-surface-2 border border-edge rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] text-fg placeholder:text-fg-faint outline-none focus:border-[var(--color-edge-focus)] resize-none leading-snug"
            />
          </div>
        )}

        {/* Setting / Locación override — compactado: input 1 línea sin el párrafo
            explicativo (el tooltip cubre el detalle) */}
        {tool.id !== "content_analyzer" && tool.id !== "avatar_creator" && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-medium text-fg-faint" title="Si la marca tiene un setting cargado (ej: taller, oficina) y querés cambiarlo solo para esta corrida, escribilo acá.">
                Setting <span className="text-fg-faint italic">opcional</span>
              </label>
              {config.settingOverride && (
                <button
                  onClick={() => setConfig((p) => ({ ...p, settingOverride: "" }))}
                  className="text-[9px] text-fg-faint hover:text-fg cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>
            <input
              type="text"
              value={config.settingOverride}
              onChange={(e) => setConfig((p) => ({ ...p, settingOverride: e.target.value }))}
              placeholder='ej: "baño moderno con luz natural"'
              className="w-full bg-surface-2 border border-edge rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] text-fg placeholder:text-fg-faint outline-none focus:border-[var(--color-edge-focus)]"
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
                    <p className="text-[10px] text-[var(--color-action)]">
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
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-fg-faint">
                  Style Reference <span className="text-fg-faint italic">opcional</span>
                </label>
                <textarea
                  value={config.styleRef}
                  onChange={(e) => setConfig((p) => ({ ...p, styleRef: e.target.value }))}
                  rows={2}
                  placeholder="ej: 'Vogue Italia dark editorial', 'COS minimalist', '90s supermodel'"
                  className="w-full bg-surface-2 border border-edge rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] text-fg placeholder:text-fg-faint outline-none focus:border-[var(--color-edge-focus)] resize-none leading-snug"
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

      {/* "Listo para generar" + botón Generar legacy eliminados — eran del layout viejo
          en columna; en el split layout actual el CTA Generar vive en el footer sticky
          del sidebar. Se duplicaban y confundían. */}

      {/* Lightbox del ConfigPanel — abre cuando se clickea un thumbnail del sidebar
          (pose ref por shot en Ecommerce Pack, etc.). ESC o click fuera para cerrar. */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-8 cursor-pointer"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setLightboxUrl(null); }}
            title="Cerrar (ESC)"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur flex items-center justify-center text-white cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
          <img
            src={lightboxUrl}
            alt="preview"
            className="max-w-full max-h-full object-contain rounded-[var(--radius-md)]"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ── Step Panel ─────────────────────────────────────────────

function StepPanel({
  tool,
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
  onInvalidateDownstream,
  batches,
  onNewBatch,
  onDeleteBatch,
  onUpdateBatchImage,
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
  onInvalidateDownstream?: (stepId: string) => void;
  /** Tandas acumulativas — solo se usan en tools batchables. Forwarded a DoneStep. */
  batches?: BatchEntry[];
  onNewBatch?: () => void;
  onDeleteBatch?: (batchId: string) => void;
  onUpdateBatchImage?: (batchId: string, imageId: string, newUrl: string) => void;
}) {
  const meta = STEP_META[step.id] || {
    label: step.id,
    icon: <Sparkles size={15} />,
    description: "",
  };
  const { activeBrand } = useBrand();
  const [showResetModal, setShowResetModal] = useState(false);

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
              className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium text-[var(--color-action-fg)] bg-[var(--color-action)] rounded-[var(--radius-sm)] hover:opacity-90 transition-opacity cursor-pointer"
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
              onClick={() => setShowResetModal(true)}
              title="Resetea este paso a 'activo' para volver a correrlo. Los pasos siguientes quedan marcados como desactualizados pero conservan sus resultados. No corre nada solo — tenés que apretar Run después."
              className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-fg-muted hover:text-fg bg-surface-2 hover:bg-surface-1 rounded-[var(--radius-sm)] transition-colors cursor-pointer"
            >
              <RotateCcw size={12} />
              Resetear paso
            </button>
          )}
        </div>
      </div>

      {/* Step content */}
      <div className="p-5">
        {step.status === "pending" ? (
          <PendingStep stepId={step.id} isFirst={stepIndex === 0} />
        ) : step.status === "active" ? (
          <ActiveStep
            stepId={step.id}
            config={config}
            brandName={activeBrand?.name || ""}
          />
        ) : step.status === "running" ? (
          <RunningStep label={meta.label} config={config} activeBrand={activeBrand} />
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
            onInvalidateDownstream={onInvalidateDownstream}
          />
        ) : step.status === "review" ? (
          <DoneStep stepId={step.id} result={step.result} audioCache={audioCache} config={config} allSteps={allSteps}
            onUpdateStepResult={onUpdateStepResult}
            onInvalidateDownstream={onInvalidateDownstream}
            toolId={tool.id}
            batches={batches}
            onNewBatch={onNewBatch}
            onDeleteBatch={onDeleteBatch}
            onUpdateBatchImage={onUpdateBatchImage}
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
                <span className="text-[11px] text-fg-faint">Paso anterior cambió — re-generá este paso para aplicar el cambio (apretá &ldquo;Resetear paso&rdquo; arriba o navegá y dale Run).</span>
              </div>
            )}
            <DoneStep stepId={step.id} result={step.result} audioCache={audioCache} config={config} allSteps={allSteps}
              onUpdateStepResult={onUpdateStepResult}
              onInvalidateDownstream={onInvalidateDownstream}
              toolId={tool.id}
              batches={batches}
              onNewBatch={onNewBatch}
              onDeleteBatch={onDeleteBatch}
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

      {/* Reset step confirmation modal — replaces the alarming "Re-run from here"
          with a clear explanation of what actually happens. */}
      {showResetModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowResetModal(false)} />
          <div className="relative bg-surface-0 border border-edge rounded-[var(--radius-md)] p-6 max-w-md w-full mx-4 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--color-action)]/15 flex items-center justify-center shrink-0">
                <RotateCcw size={18} className="text-[var(--color-action)]" />
              </div>
              <div className="flex-1">
                <h3 className="text-[15px] font-semibold text-fg">
                  ¿Resetear el paso &ldquo;{meta.label}&rdquo;?
                </h3>
                <p className="text-[12px] text-fg-muted mt-1 leading-relaxed">
                  Esto marca el paso como activo y los siguientes como desactualizados.
                  <strong className="text-fg"> No corre nada automáticamente</strong> —
                  tenés que apretar &ldquo;Run&rdquo; después si querés regenerar.
                </p>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-[var(--radius-sm)] p-3 text-[11px] text-amber-200 leading-relaxed">
              <p className="font-semibold mb-0.5">💡 Si solo querés avanzar al Render:</p>
              <p>No uses este botón. Cliqueá el paso <strong>Render</strong> en la barra de pasos y dale Run. Usa todo lo que ya animaste.</p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 text-[12px] font-medium text-fg-muted hover:text-fg bg-surface-2 rounded-[var(--radius-sm)] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setShowResetModal(false);
                  onReRunFromHere();
                }}
                className="px-4 py-2 text-[12px] font-medium text-[var(--color-action-fg)] bg-[var(--color-action)] hover:opacity-90 rounded-[var(--radius-sm)] transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw size={12} />
                Resetear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Running step (with inputs preview) ─────────────────────

function RunningStep({
  label,
  config,
  activeBrand,
}: {
  label: string;
  config: ToolConfig;
  activeBrand: Brand | null;
}) {
  const selectedAvatar = activeBrand?.avatars?.find((a) => a.id === config.selectedAvatarId);
  const selectedProduct = activeBrand?.products?.find((p) => p.id === config.selectedProductId);
  const selectedBackground = activeBrand?.backgrounds?.find((b) => b.id === config.selectedBackgroundId);
  const selectedMoodboard = activeBrand?.moodboards?.find((m) => m.id === config.selectedMoodboardId);
  const selectedClothing = (activeBrand?.clothing || []).filter((c) => config.selectedClothingIds?.includes(c.id));
  const refFile = config.referenceImages?.[0];
  const [refPreview, setRefPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!refFile) { setRefPreview(null); return; }
    const url = URL.createObjectURL(refFile);
    setRefPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [refFile]);

  type Chip = { kind: string; label: string; thumb?: string | null; hint?: string };
  const chips: Chip[] = [];
  if (refPreview) chips.push({ kind: "Referencia", label: config.referenceMode === "composition" ? "Composición" : "Estilo", thumb: refPreview, hint: "pisa layout+setting" });
  if (selectedAvatar) chips.push({ kind: "Avatar", label: selectedAvatar.name, thumb: selectedAvatar.imageUrl ? avatarImageUrl(selectedAvatar.imageUrl) : null });
  for (const c of selectedClothing) chips.push({ kind: "Ropa", label: c.name, thumb: c.imageUrl ? clothingImageUrl(c.imageUrl) : null });
  if (selectedProduct) chips.push({ kind: "Producto", label: selectedProduct.name, thumb: selectedProduct.imageUrl ? productImageUrl(selectedProduct.imageUrl) : null });
  if (selectedBackground) chips.push({ kind: "Fondo", label: selectedBackground.name, thumb: selectedBackground.imageUrl ? backgroundImageUrl(selectedBackground.imageUrl) : null });
  if (selectedMoodboard) chips.push({ kind: "Moodboard", label: selectedMoodboard.name, thumb: selectedMoodboard.imageUrl ? moodboardImageUrl(selectedMoodboard.imageUrl) : null });

  const imageModelLabel = config.imageModel === "gpt-image-2" ? "GPT Image 2" : "Nano Banana 2";

  return (
    <div className="py-10 space-y-5">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={26} className="animate-spin text-[var(--color-action)]" />
        <div className="text-center space-y-1">
          <p className="text-[14px] font-semibold text-fg">Generando {label}…</p>
          <p className="text-[11px] text-fg-faint">
            Modelo: <span className="text-fg-muted">{imageModelLabel}</span>
            {config.aspectRatio && <> · {config.aspectRatio}</>}
            {config.resolution && <> · {config.resolution}</>}
          </p>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="max-w-2xl mx-auto space-y-2">
          <p className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider text-center">
            Inputs que se están usando ({chips.length})
          </p>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {chips.map((c, i) => (
              <div
                key={i}
                className="inline-flex items-center gap-1.5 h-7 pl-1 pr-2.5 rounded-full border border-edge bg-surface-2"
                title={c.hint || c.label}
              >
                {c.thumb ? (
                  <img src={c.thumb} alt={c.label} className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-surface-3" />
                )}
                <span className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider">{c.kind}:</span>
                <span className="text-[10px] font-medium text-fg-muted max-w-[140px] truncate">{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {config.objective && (
        <div className="max-w-2xl mx-auto bg-surface-2 border border-edge rounded-[var(--radius-sm)] px-3 py-2">
          <p className="text-[9px] font-semibold text-fg-faint uppercase tracking-wider mb-1">Dirección creativa</p>
          <p className="text-[11px] text-fg-muted leading-relaxed italic">"{config.objective}"</p>
        </div>
      )}
    </div>
  );
}

// ── Pending step placeholder ───────────────────────────────

function PendingStep({ stepId, isFirst = false }: { stepId: string; isFirst?: boolean }) {
  const meta = STEP_META[stepId];
  return (
    <div className="text-center py-10 text-fg-faint">
      <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center mx-auto mb-3 opacity-50">
        {meta?.icon || <Sparkles size={18} />}
      </div>
      <p className="text-[13px]">
        {isFirst
          ? "Revisá la config y tocá Start para empezar"
          : "Esperando a que terminen los pasos anteriores"}
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

function DoneStep({ stepId, result, audioCache: audioCacheProp, getScriptScenes, config, allSteps = [], onUpdateStepResult, onInvalidateDownstream, toolId, batches, onNewBatch, onDeleteBatch }: {
  stepId: string;
  result?: unknown;
  audioCache?: Record<string, { url: string; blob: Blob }>;
  getScriptScenes?: () => Array<{ id: string; title: string; script: string; image_prompt: string; sceneType?: string; location?: string }>;
  config?: ToolConfig;
  allSteps?: StepState[];
  onUpdateStepResult?: (stepId: string, result: unknown) => void;
  onInvalidateDownstream?: (stepId: string) => void;
  /** Tool id — para condicionar UI específica (ej. ocultar toggles de talking/voz en
   *  Fashion Reel donde no aplica). */
  toolId?: string;
  /** Pila de tandas acumuladas (tools multi-shot). Si está vacío o undefined,
   *  el renderer cae al flow lineal de siempre. */
  batches?: BatchEntry[];
  /** Disparado al clickear "Nueva tanda" — el padre re-activa el step para que
   *  el usuario edite config y vuelva a Generar; el resultado se SUMA. */
  onNewBatch?: () => void;
  /** Borrar una tanda específica del stack. */
  onDeleteBatch?: (batchId: string) => void;
  /** Reemplaza la URL de una imagen específica dentro de una tanda. Lo dispara
   *  el ImageEditPanel cuando el usuario edita una toma generada. */
  onUpdateBatchImage?: (batchId: string, imageId: string, newUrl: string) => void;
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
  // Tracks which scene's base-frame editor panel is open in the Lipsync step DONE view.
  // Lets the user swap the image of a single clip and auto re-run lipsync without
  // going back to multishot/curation.
  const [editingFrameSceneId, setEditingFrameSceneId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [selectedRefIdx, setSelectedRefIdx] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [sceneTypes, setSceneTypes] = useState<Record<string, "talking" | "creative">>({});
  const [selectedShots, setSelectedShots] = useState<Record<string, string>>({});
  const [activeHeroId, setActiveHeroId] = useState<string | null>(null);
  // Script step: per-scene "regenerate" loading + a version counter to force the
  // uncontrolled textareas to remount with the new text after a regen.
  const [scriptRegenId, setScriptRegenId] = useState<string | null>(null);
  const [sceneVersions, setSceneVersions] = useState<Record<string, number>>({});
  // Creative scenes: explicit "voz en off" (has script → gets audio) vs "muda" (silent b-roll).
  const [voiceoverByScene, setVoiceoverByScene] = useState<Record<string, boolean>>({});

  // ── Product Sheet: Brief step ────────────────────────────
  // Distinguished from the Avatar brief by the presence of product-specific keys.
  // We do this by-shape so we don't need to plumb `toolId` into DoneStep.
  if (
    stepId === "brief"
    && result
    && typeof result === "object"
    && ("materials" in (result as object) || "distinctive_details" in (result as object))
  ) {
    const brief = result as {
      name: string; category: string; summary: string; shape: string;
      materials: string[]; colors: string[]; scale: string; packaging: string;
      distinctive_details: string[]; visible_views: string[]; missing_views: string[];
      image_prompt: string; mode?: "sheet" | "details";
      photo_views?: Array<{ index: number; view: string; confidence?: number; notes?: string }>;
    };
    // Single-line fields (name, category, scale, packaging) — short, editable inline.
    const textFields: Array<{ label: string; key: "name" | "category" | "shape" | "scale" | "packaging"; rows?: number }> = [
      { label: "Nombre", key: "name" },
      { label: "Categoría", key: "category" },
      { label: "Forma / Silueta", key: "shape", rows: 2 },
      { label: "Escala (hint)", key: "scale" },
      { label: "Packaging", key: "packaging" },
    ];
    // List fields — render as one-per-line textareas. Edits split by newline back to array.
    const listFields: Array<{ label: string; key: "materials" | "colors" | "distinctive_details" | "visible_views" | "missing_views" }> = [
      { label: "Materiales", key: "materials" },
      { label: "Colores (con shade específico)", key: "colors" },
      { label: "Detalles distintivos", key: "distinctive_details" },
      { label: "Vistas presentes en las refs", key: "visible_views" },
      { label: "Vistas faltantes (a inferir)", key: "missing_views" },
    ];
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Check size={14} className="text-[var(--color-success)]" />
          <span className="text-[13px] font-medium text-fg">
            Brief del producto — modo: {brief.mode === "details" ? "Planos y detalles" : "Sheet integral"}
          </span>
        </div>
        {/* Clasificación de cada foto por Gemini Vision. Esto es lo que asegura
            que el handler use la foto correcta para cada vista del composite —
            sin esto, Nano Banana mezcla todas las refs sin saber cuál corresponde
            a qué ángulo. Reportado: "cómo aseguramos que use la foto de espalda
            si en el resultado muestra la espalda". */}
        {brief.photo_views && brief.photo_views.length > 0 && (
          <div className="bg-[var(--color-brand-subtle)] border border-[var(--color-brand-muted)] rounded-[var(--radius-sm)] p-2.5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-brand)]">
              <Sparkles size={11} />
              Gemini clasificó cada foto que subiste
            </div>
            <div className="grid grid-cols-2 gap-1">
              {brief.photo_views.map((pv) => {
                const confPct = pv.confidence !== undefined ? Math.round(pv.confidence * 100) : null;
                const confColor = confPct === null ? "text-fg-faint"
                  : confPct >= 80 ? "text-[var(--color-success)]"
                  : confPct >= 50 ? "text-[var(--color-warning)]"
                  : "text-[var(--color-error)]";
                return (
                  <div key={pv.index} className="flex items-baseline justify-between gap-2 text-[10px] bg-surface-1/50 px-2 py-1 rounded">
                    <span className="text-fg-muted shrink-0">Foto {pv.index + 1}</span>
                    <span className="font-mono font-semibold text-fg truncate">{pv.view}</span>
                    {confPct !== null && (
                      <span className={cn("text-[9px] shrink-0", confColor)}>{confPct}%</span>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[9px] text-fg-faint italic leading-snug">
              El handler usa estas clasificaciones para decirle a Nano Banana <strong>"para la vista X, usá EXACTAMENTE Foto N"</strong> — sin inventar. Si una clasificación está mal, no podés corregirla acá todavía (próxima iteración: dropdown editable por foto).
            </p>
          </div>
        )}
        <div className="space-y-1">
          <div className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider">Resumen</div>
          <textarea
            defaultValue={brief.summary || ""}
            onChange={(e) => { brief.summary = e.target.value; }}
            rows={2}
            className="w-full text-[12px] text-fg bg-surface-2 border border-transparent hover:border-edge focus:border-[var(--color-action)] rounded-[var(--radius-sm)] px-2 py-1.5 outline-none resize-none transition-colors"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {textFields.map(({ label, key, rows }) => (
            <div key={key} className="space-y-1">
              <div className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider">{label}</div>
              <textarea
                defaultValue={brief[key] || ""}
                onChange={(e) => { brief[key] = e.target.value; }}
                rows={rows || 1}
                className="w-full text-[12px] text-fg bg-surface-2 border border-transparent hover:border-edge focus:border-[var(--color-action)] rounded-[var(--radius-sm)] px-2 py-1.5 outline-none resize-none transition-colors"
              />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {listFields.map(({ label, key }) => (
            <div key={key} className="space-y-1">
              <div className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider">{label}</div>
              <textarea
                defaultValue={(brief[key] || []).join("\n")}
                onChange={(e) => {
                  // Newline-separated; trim + drop empties so we don't write `[""]`.
                  brief[key] = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean);
                }}
                rows={Math.max(2, (brief[key] || []).length)}
                placeholder="Uno por línea"
                className="w-full text-[12px] text-fg bg-surface-2 border border-transparent hover:border-edge focus:border-[var(--color-action)] rounded-[var(--radius-sm)] px-2 py-1.5 outline-none resize-none transition-colors"
              />
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <div className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider">Prompt de imagen (lo que recibe Nano Banana)</div>
          <textarea
            defaultValue={brief.image_prompt || ""}
            onChange={(e) => { brief.image_prompt = e.target.value; }}
            rows={4}
            className="w-full text-[12px] text-fg-muted font-mono bg-surface-2 border border-transparent hover:border-edge focus:border-[var(--color-action)] rounded-[var(--radius-sm)] p-3 outline-none resize-none transition-colors"
          />
        </div>
      </div>
    );
  }

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
                className="w-full text-[12px] text-fg bg-surface-2 border border-transparent hover:border-edge focus:border-[var(--color-action)] rounded-[var(--radius-sm)] px-2 py-1.5 outline-none resize-none transition-colors"
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
            className="w-full text-[12px] text-fg-muted font-mono bg-surface-2 border border-transparent hover:border-edge focus:border-[var(--color-action)] rounded-[var(--radius-sm)] p-3 outline-none resize-none transition-colors"
          />
        </div>
      </div>
    );
  }

  // ── Video Swap: swap step result ─────────────────────────
  if (stepId === "swap" && result) {
    const swap = result as { url: string; type?: string };
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Check size={14} className="text-[var(--color-success)]" />
          <span className="text-[13px] font-medium text-fg">Video swappeado — sujeto y movimiento intactos</span>
        </div>
        {swap.url && (
          <video src={swap.url} controls className="w-full max-h-[70vh] rounded-[var(--radius-md)] bg-black" />
        )}
        {swap.url && (
          <a
            href={`http://127.0.0.1:8000/api/download?url=${encodeURIComponent(swap.url)}&filename=video_swap.mp4`}
            className="inline-flex items-center gap-2 px-4 py-2 text-[12px] font-medium rounded-[var(--radius-sm)] bg-surface-2 hover:bg-surface-3 text-fg cursor-pointer"
          >
            <Download size={13} /> Descargar
          </a>
        )}
      </div>
    );
  }

  // ── Avatar Creator: Generate step ────────────────────────
  if (stepId === "generate" && result) {
    const gen = result as { url: string; styleLabel: string; brief: Record<string, string> };
    const isEditing = editingImageId === "avatar_gen";
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Check size={14} className="text-[var(--color-success)]" />
            <span className="text-[13px] font-medium text-fg">Reference sheet generated — {gen.styleLabel} style</span>
          </div>
          {gen.url && (
            <div className="flex items-center gap-2">
              {/* Descargar — usa downloadUrl helper que fuerza el descargado vía
                  fetch+blob (las URLs de Fal son cross-origin y `<a download>`
                  abre pestaña en lugar de descargar). */}
              <button
                type="button"
                onClick={() => downloadUrl(gen.url, `avatar_${(gen.brief?.name || "sheet").toLowerCase().replace(/[^a-z0-9]+/g, "_")}.png`)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-[var(--radius-sm)] bg-surface-2 hover:bg-surface-3 text-fg-muted hover:text-fg cursor-pointer transition-colors"
                title="Descargar imagen"
              >
                <Download size={11} />
                Descargar
              </button>
              <button
                onClick={() => setEditingImageId(isEditing ? null : "avatar_gen")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-[var(--radius-sm)] bg-surface-2 hover:bg-surface-3 text-fg-muted hover:text-fg cursor-pointer transition-colors"
              >
                <Pencil size={11} />
                {isEditing ? "Cerrar editor" : "Editar imagen"}
              </button>
            </div>
          )}
        </div>
        {gen.url && (
          <button
            type="button"
            onClick={() => setLightboxUrl(gen.url)}
            className="block w-full rounded-[var(--radius-md)] overflow-hidden border border-edge bg-surface-2 cursor-zoom-in"
            title="Click para ver a tamaño completo"
          >
            <img src={gen.url} alt="Avatar reference sheet" className="w-full object-contain" />
          </button>
        )}
        <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-3 text-[12px] text-fg-muted">
          <span className="font-medium text-fg">{gen.brief?.name}</span>
          {gen.brief?.age && <span className="text-fg-faint"> · {gen.brief.age}</span>}
          {gen.brief?.personality && <span className="text-fg-faint"> · {gen.brief.personality}</span>}
        </div>

        {/* Inline image editor — refine the generated avatar before approving.
            Edits replace the generated URL so the next step (Save) uses the
            edited version. */}
        {isEditing && gen.url && (
          <div className="border-t border-edge pt-3">
            <ImageEditPanel
              imageUrl={gen.url}
              aspectRatio="1:1"
              resolution="2K"
              selectedProductId={config?.selectedProductId} selectedClothingIds={config?.selectedClothingIds}
              onImageUpdated={(newUrl) => {
                gen.url = newUrl;
                if (onUpdateStepResult) onUpdateStepResult("generate", { ...gen });
                setEditingImageId(null);
              }}
              onClose={() => setEditingImageId(null)}
            />
          </div>
        )}

        <p className="text-[11px] text-fg-faint">
          Approve to save this avatar to your brand library. It will be available in UGC Creator and other tools immediately.
          {gen.url && <span className="ml-1">Si querés ajustar algo antes (pose, expresión, ropa), apretá <strong>&quot;Editar imagen&quot;</strong> arriba.</span>}
        </p>

        {lightboxUrl && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8 cursor-zoom-out"
            onClick={() => setLightboxUrl(null)}
          >
            <img
              src={lightboxUrl}
              alt="Avatar zoom"
              className="max-h-full max-w-full object-contain rounded-[var(--radius-md)]"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        )}
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
          <span className="text-fg-faint ml-2">quedó guardado y disponible en todas las tools que usan avatares.</span>
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
          <div className="border border-[var(--color-action)]/30 bg-[var(--color-action)]/5 rounded-[var(--radius-md)] p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Film size={11} className="text-[var(--color-action)]" />
              <span className="text-[10px] font-semibold text-[var(--color-action)] uppercase tracking-wider">Historia del video</span>
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
          // Rewrite just this scene, passing all scenes for coherence.
          const handleSceneRegen = async () => {
            if (!activeBrand) return;
            setScriptRegenId(scene.id);
            try {
              const out = await regenerateScene(activeBrand.id, {
                scenes: scenes.map((s) => ({ id: s.id, title: s.title, script: s.script, image_prompt: s.image_prompt, sceneType: (s as { sceneType?: string }).sceneType })),
                targetIndex: i,
                language: (config?.language as string) || "es",
                videoObjective: (config?.objective as string) || "",
                productName: (activeBrand.products || []).find((p) => p.id === config?.selectedProductId)?.name || "",
              });
              if (out.script !== undefined) scene.script = out.script;
              if (out.image_prompt) scene.image_prompt = out.image_prompt;
              onUpdateStepResult?.("script", result);
              setSceneVersions((v) => ({ ...v, [scene.id]: (v[scene.id] || 0) + 1 }));
            } catch (e) {
              console.error("[script] regen failed:", e);
            } finally {
              setScriptRegenId(null);
            }
          };
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
            talking: { label: "Talking", color: "bg-[var(--color-action)]", activeBg: "bg-[var(--color-action)]/5" },
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

          // Fashion Reel es visual-only — los toggles de scene type (talking / creative
          // / lifestyle / sensorial / product_reveal) y los de voz (muda / voz en off)
          // NO aplican. Solo aparecen para tools con flujo de voiceover (UGC, Video Ad).
          const isVisualOnlyTool = toolId === "fashion_reel";
          return (
          <div key={scene.id} className={`border rounded-[var(--radius-md)] overflow-hidden transition-colors ${
            isCreativeFamily ? "border-blue-500/30" : "border-edge"
          }`}>
            {/* Scene header */}
            <div className={`px-4 py-2.5 border-b border-edge flex items-center justify-between ${typeConfig.activeBg}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold text-fg-faint tabular-nums bg-surface-1 border border-edge rounded px-1.5 py-0.5">{i + 1}</span>
                <span className="text-[12px] font-semibold text-fg">{scene.title}</span>
                {/* Scene type toggle — solo cuando la tool tiene flujo de voiceover */}
                {!isVisualOnlyTool && (
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
                )}
                {/* Creative scenes: muda (silent b-roll) vs voz en off (gets audio) — no aplica en visual-only */}
                {!isVisualOnlyTool && displayType !== "talking" && (() => {
                  const hasVo = voiceoverByScene[scene.id] ?? ((scene.script || "").trim().length > 0);
                  return (
                    <div className="flex items-center rounded border border-edge overflow-hidden" title="Esta escena no habla a cámara. Elegí si lleva voz en off o queda muda.">
                      <button
                        onClick={() => {
                          setVoiceoverByScene((v) => ({ ...v, [scene.id]: false }));
                          scene.script = "";
                          setSceneVersions((vv) => ({ ...vv, [scene.id]: (vv[scene.id] || 0) + 1 }));
                          onUpdateStepResult?.("script", result);
                        }}
                        className={`px-2 py-0.5 text-[9px] font-medium cursor-pointer ${!hasVo ? "bg-fg text-[var(--color-canvas)]" : "bg-surface-1 text-fg-muted hover:text-fg"}`}
                      >🔇 Muda</button>
                      <button
                        onClick={() => setVoiceoverByScene((v) => ({ ...v, [scene.id]: true }))}
                        className={`px-2 py-0.5 text-[9px] font-medium cursor-pointer ${hasVo ? "bg-fg text-[var(--color-canvas)]" : "bg-surface-1 text-fg-muted hover:text-fg"}`}
                      >🎙️ Voz en off</button>
                    </div>
                  );
                })()}
                {/* Regenerate this scene only (full script as context) */}
                <button
                  onClick={handleSceneRegen}
                  disabled={scriptRegenId === scene.id}
                  title="Reescribe SOLO esta escena, usando el resto del guion como contexto para que quede coherente"
                  className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-medium rounded border border-edge bg-surface-1 text-fg-muted hover:text-fg hover:border-[var(--color-action)] cursor-pointer disabled:opacity-50"
                >
                  {scriptRegenId === scene.id ? <Loader2 size={9} className="animate-spin" /> : <RotateCcw size={9} />}
                  Regenerar
                </button>
                {hasAiSuggestion && (
                  <span className="text-[9px] text-fg-faint italic">IA</span>
                )}
                {/* Engine pill — surfaces which model will animate THIS scene so
                    the user knows what to expect before launching. */}
                {config?.animationEngine && (() => {
                  const engine = config.animationEngine === "seedance" ? "seedance" : "kling";
                  const isTalking = displayType === "talking";
                  let label = "";
                  let cls = "";
                  if (engine === "seedance" && isTalking) {
                    label = "🎬 Seedance + audio";
                    cls = "bg-blue-500/10 border-blue-500/30 text-blue-300";
                  } else if (engine === "seedance") {
                    label = "🎬 Seedance creative";
                    cls = "bg-blue-500/10 border-blue-500/30 text-blue-300";
                  } else if (isTalking) {
                    label = "🎬 Kling + HeyGen";
                    cls = "bg-amber-500/10 border-amber-500/30 text-amber-300";
                  } else {
                    label = "🎬 Kling animation";
                    cls = "bg-amber-500/10 border-amber-500/30 text-amber-300";
                  }
                  return (
                    <span
                      className={`text-[9px] font-medium border rounded px-1.5 py-0.5 ${cls}`}
                      title="Modelo que va a animar esta escena (definido en ConfigPanel)"
                    >
                      {label}
                    </span>
                  );
                })()}
                {/* Avatar on/off toggle — no aplica en Fashion Reel (siempre la modelo) */}
                {!isVisualOnlyTool && <AvatarToggle scene={scene} />}
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

            <div className={cn("grid divide-x divide-edge", isVisualOnlyTool ? "grid-cols-1" : "grid-cols-2")}>
              {/* Script column — solo cuando la tool tiene voiceover. Fashion Reel
                  es visual-only y no necesita ni script ni mensaje "clip mudo". */}
              {!isVisualOnlyTool && (
                <div className="p-3 space-y-1">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Mic size={10} className="text-fg-faint" />
                    <span className="text-[9px] font-semibold text-fg-faint uppercase tracking-wider">Script</span>
                  </div>
                  {displayType !== "talking" && !(voiceoverByScene[scene.id] ?? ((scene.script || "").trim().length > 0)) ? (
                    <p className="text-[11px] text-fg-faint italic px-2 py-1">🔇 Clip mudo (b-roll, sin voz). Cambiá a &ldquo;Voz en off&rdquo; arriba si querés que narre.</p>
                  ) : (
                    <textarea
                      key={`sc_${scene.id}_${sceneVersions[scene.id] || 0}`}
                      defaultValue={scene.script}
                      onChange={(e) => { scene.script = e.target.value; }}
                      rows={Math.max(3, Math.ceil((scene.script.length || 40) / 40))}
                      className="w-full text-[12px] text-fg leading-relaxed bg-transparent border border-transparent hover:border-edge focus:border-[var(--color-action)] rounded-[var(--radius-sm)] px-2 py-1 outline-none resize-none transition-colors"
                    />
                  )}
                </div>
              )}

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
                    key={`vis_${scene.id}_${sceneVersions[scene.id] || 0}`}
                    defaultValue={scene.image_prompt}
                    onChange={(e) => { scene.image_prompt = e.target.value; }}
                    rows={Math.max(3, Math.ceil(scene.image_prompt.length / 40))}
                    className="w-full text-[11px] text-fg-muted leading-relaxed bg-transparent border border-transparent hover:border-edge focus:border-[var(--color-action)] rounded-[var(--radius-sm)] px-2 py-1 outline-none resize-none transition-colors font-mono"
                  />
                ) : (
                  <p className="text-[11px] text-fg-faint italic px-2">Auto-generated from script</p>
                )}
              </div>
            </div>

            {/* Per-scene background override */}
            <ScenesBackgroundPicker
              scene={scene}
              backgrounds={activeBrand?.backgrounds || []}
              globalBackgroundId={config.selectedBackgroundId}
            />
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
          // Editing the base invalidates downstream steps (multishot uses the base as
          // its anchor) — mark them stale so the user knows to re-generate to propagate.
          if (onInvalidateDownstream) onInvalidateDownstream("base_image");
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
              className="w-full aspect-[9/16] rounded-[var(--radius-md)] overflow-hidden border-2 border-edge cursor-pointer hover:border-[var(--color-action)] transition-colors relative group"
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
                className="text-[10px] px-2.5 py-1 bg-[var(--color-action-muted)] text-[var(--color-action)] rounded-full cursor-pointer hover:opacity-80"
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
                          isIncluded ? "border-[var(--color-action)]" : "border-edge opacity-50 hover:opacity-100"
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
                    ? "text-[var(--color-action-fg)] bg-[var(--color-action)] hover:opacity-90 cursor-pointer"
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
                  : "bg-[var(--color-action-muted)] text-[var(--color-action)]"
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
                      <button
                        type="button"
                        onClick={() => downloadUrl(seg.audioUrl!, `${seg.title || seg.sceneId || "audio"}.mp3`)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-sm)] text-[10px] font-medium bg-surface-2 text-fg-muted hover:text-fg hover:bg-surface-3 cursor-pointer"
                        title="Download audio"
                      >
                        <Download size={10} />
                      </button>
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
                className="w-full text-[12px] text-fg-muted leading-relaxed bg-transparent border border-transparent hover:border-edge focus:border-[var(--color-action)] rounded-[var(--radius-sm)] px-2 py-1 outline-none resize-none transition-colors"
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
          // Persist the new video URL so it survives navigation away (and reopening
          // a saved generation from Contenido will keep the edited clip).
          if (onUpdateStepResult) onUpdateStepResult("lipsync", [...segments]);
        }
      } catch { /* silent */ } finally {
        setRegenSceneId(null);
      }
    };

    // Combined regen for a single scene: voice first, then lipsync with the new audio.
    // Used after the user edits the scene's script text inline — one click regenerates
    // both, only for that scene, without touching the others.
    const handleRegenScene = async (seg: typeof segments[0]) => {
      await handleRegenVoice(seg);
      // handleRegenVoice already updated latestVoice cache + voice step state,
      // so handleRegenLipsync will pick up the new audio.
      await handleRegenLipsync(seg);
    };

    // Fallback resolver: older generations didn't always persist `imageUrl` on the
    // lipsync segment. Look up the base frame from upstream steps (curation first —
    // it's the user's chosen variation — then multishot, then base_image).
    const resolveBaseFrameUrl = (sceneId: string): string | undefined => {
      if (allSteps) {
        const curation = allSteps.find((s) => s.id === "curation")?.result as Array<{ sceneId: string; selectedUrl?: string }> | { selections?: Array<{ sceneId: string; selectedUrl?: string }> } | undefined;
        if (Array.isArray(curation)) {
          const entry = curation.find((c) => c.sceneId === sceneId);
          if (entry?.selectedUrl) return entry.selectedUrl;
        } else if (curation && "selections" in curation && Array.isArray(curation.selections)) {
          const entry = curation.selections.find((c) => c.sceneId === sceneId);
          if (entry?.selectedUrl) return entry.selectedUrl;
        }
        const multishot = allSteps.find((s) => s.id === "multishot")?.result as Array<{ sceneId: string; variations?: Array<{ url?: string }> }> | undefined;
        if (Array.isArray(multishot)) {
          const ms = multishot.find((m) => m.sceneId === sceneId);
          if (ms?.variations?.[0]?.url) return ms.variations[0].url;
        }
        const base = allSteps.find((s) => s.id === "base_image")?.result as { url?: string } | undefined;
        if (base?.url) return base.url;
      }
      return undefined;
    };

    // Replace the base frame for ONE clip — but DO NOT auto-run lipsync.
    // The user wants to inspect the new frame before paying the lipsync cost / wait.
    // We mark the segment as having a "pending" frame change so the UI can show a
    // banner prompting the user to apply it.
    const handleFrameUpdated = (seg: typeof segments[0], newUrl: string) => {
      // Stash the old video URL so we can show "stale lipsync" warning until applied
      (seg as Record<string, unknown>).pendingFrameUrl = newUrl;
      if (onUpdateStepResult) onUpdateStepResult("lipsync", [...segments]);
    };

    // User confirms: commit the pending frame and run lipsync.
    const handleApplyPendingFrame = async (seg: typeof segments[0]) => {
      const pending = (seg as Record<string, unknown>).pendingFrameUrl as string | undefined;
      if (!pending) return;
      seg.imageUrl = pending;
      delete (seg as Record<string, unknown>).pendingFrameUrl;
      if (onUpdateStepResult) onUpdateStepResult("lipsync", [...segments]);
      await handleRegenLipsync(seg);
    };

    // User discards: drop the pending frame change.
    const handleDiscardPendingFrame = (seg: typeof segments[0]) => {
      delete (seg as Record<string, unknown>).pendingFrameUrl;
      if (onUpdateStepResult) onUpdateStepResult("lipsync", [...segments]);
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
            const isEditingFrame = editingFrameSceneId === seg.sceneId;
            // Resolve base frame URL: prefer the one persisted on the lipsync segment,
            // fall back to upstream steps for older generations that didn't store it.
            const baseFrameUrl = seg.imageUrl || resolveBaseFrameUrl(seg.sceneId);
            // Pending frame change — the user edited the image but hasn't applied it yet
            const pendingFrameUrl = (seg as Record<string, unknown>).pendingFrameUrl as string | undefined;
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
                      <p className="text-[10px] text-white/70">Regenerando esta escena...</p>
                    </div>
                  )}
                </div>
                <div className="p-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-fg font-medium">Scene {i + 1}: {seg.title}</span>
                    <span className="text-[9px] text-fg-faint">Edit + Regen sin tocar las otras</span>
                  </div>

                  {/* Base frame preview row — la miniatura abre lightbox (ver en grande)
                      y un botón aparte abre el editor inline. Antes click → editor, sin
                      forma de ver la imagen grande. Reportado: "deberíamos poder ver la
                      imagen del frame base en grande, o al tocarla aunque sea". */}
                  <div className={cn(
                    "w-full flex items-center gap-2 p-1.5 rounded-[var(--radius-sm)] border transition-colors",
                    baseFrameUrl
                      ? (isEditingFrame ? "border-[var(--color-action)] bg-[var(--color-action)]/10" : "border-edge hover:border-edge-strong hover:bg-surface-1")
                      : "border-edge bg-surface-1 opacity-50",
                  )}>
                    {baseFrameUrl ? (
                      <button
                        type="button"
                        onClick={() => setLightboxUrl(baseFrameUrl)}
                        title="Ver frame base en grande"
                        className="shrink-0 cursor-zoom-in"
                      >
                        <img src={baseFrameUrl} alt="Frame base" className="w-10 h-10 object-cover rounded-[var(--radius-sm)]" />
                      </button>
                    ) : (
                      <div className="w-10 h-10 bg-surface-2 rounded-[var(--radius-sm)] flex items-center justify-center shrink-0">
                        <ImageIcon size={12} className="text-fg-faint" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => baseFrameUrl && setEditingFrameSceneId(isEditingFrame ? null : seg.sceneId)}
                      disabled={!baseFrameUrl}
                      title={baseFrameUrl ? "Editar el frame base de esta escena" : "Frame base no disponible"}
                      className={cn(
                        "flex-1 min-w-0 text-left",
                        baseFrameUrl ? "cursor-pointer" : "cursor-not-allowed",
                      )}
                    >
                      <p className="text-[10px] font-medium text-fg">{isEditingFrame ? "Cerrar editor" : "Frame base"}</p>
                      <p className="text-[9px] text-fg-faint truncate">
                        {baseFrameUrl ? "Tocá thumb para zoom · texto para editar" : "No disponible en esta gen"}
                      </p>
                    </button>
                    <Pencil size={12} className={cn(baseFrameUrl ? "text-fg-muted" : "text-fg-faint")} />
                  </div>

                  {/* Pending frame preview — big new image so the user can ACTUALLY
                      see what was generated, with a small "actual" thumbnail to compare.
                      Click either image to open lightbox at full size. */}
                  {pendingFrameUrl && (
                    <div className="border border-amber-500/40 bg-amber-500/5 rounded-[var(--radius-sm)] p-2 space-y-2">
                      <p className="text-[10px] font-semibold text-amber-400 flex items-center gap-1">
                        <ImageIcon size={10} /> Frame nuevo generado — revisalo antes de aplicar
                      </p>
                      {/* New image — full width inside the card, click to zoom */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setLightboxUrl(pendingFrameUrl)}
                          className="w-full block cursor-zoom-in"
                          title="Click para ver a tamaño real"
                        >
                          <img
                            src={pendingFrameUrl}
                            alt="Frame nuevo"
                            className="w-full aspect-[9/16] object-cover rounded border-2 border-amber-500/60"
                          />
                        </button>
                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-amber-500 text-black text-[9px] font-semibold rounded">
                          Nuevo
                        </span>
                        {baseFrameUrl && (
                          <button
                            type="button"
                            onClick={() => setLightboxUrl(baseFrameUrl)}
                            title="Frame actual (click para ver grande)"
                            className="absolute bottom-1.5 right-1.5 w-16 aspect-[9/16] rounded border-2 border-white/70 shadow-lg overflow-hidden cursor-zoom-in hover:scale-110 transition-transform"
                          >
                            <img
                              src={baseFrameUrl}
                              alt="Frame actual"
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute top-0 left-0 right-0 bg-black/80 text-white text-[8px] font-medium text-center py-0.5">
                              Actual
                            </span>
                          </button>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleDiscardPendingFrame(seg)}
                          disabled={isRegen}
                          className="flex-1 flex items-center justify-center gap-1 py-1 rounded-[var(--radius-sm)] text-[10px] font-medium bg-surface-2 text-fg-muted hover:bg-surface-3 hover:text-fg cursor-pointer transition-colors"
                        >
                          <X size={10} /> Descartar
                        </button>
                        <button
                          onClick={() => handleApplyPendingFrame(seg)}
                          disabled={isRegen}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-1 py-1 rounded-[var(--radius-sm)] text-[10px] font-medium transition-colors cursor-pointer",
                            !isRegen
                              ? "bg-fg text-[var(--color-canvas)] hover:opacity-90"
                              : "bg-surface-1 text-fg-faint cursor-not-allowed",
                          )}
                          title="Usa este frame como base y re-runea el lipsync de esta escena"
                        >
                          <Check size={10} /> Aplicar + animar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Inline editable script — user edits here, then clicks "Regen escena" */}
                  <textarea
                    defaultValue={seg.scriptText || ""}
                    onChange={(e) => { seg.scriptText = e.target.value; }}
                    onBlur={() => {
                      // Persist script edits in the lipsync step result so navigating
                      // away (or reopening from Contenido) keeps them.
                      if (onUpdateStepResult) onUpdateStepResult("lipsync", [...segments]);
                    }}
                    rows={3}
                    placeholder="Texto que dice el avatar en esta escena..."
                    className="w-full text-[11px] text-fg leading-relaxed bg-surface-1 border border-edge hover:border-edge-strong focus:border-[var(--color-action)] rounded-[var(--radius-sm)] px-2 py-1.5 outline-none resize-none transition-colors"
                  />

                  {/* Action row */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => handlePlayVoice(seg.sceneId)}
                      disabled={!hasAudio}
                      title="Escuchar el audio actual"
                      className={cn(
                        "flex-shrink-0 flex items-center justify-center gap-1 px-2 py-1 rounded-[var(--radius-sm)] text-[10px] font-medium transition-colors cursor-pointer",
                        hasAudio ? "bg-surface-2 text-fg-muted hover:bg-surface-3 hover:text-fg" : "bg-surface-1 text-fg-faint cursor-not-allowed",
                      )}
                    >
                      <Play size={9} />
                    </button>
                    <button
                      onClick={() => handleRegenScene(seg)}
                      disabled={isRegen}
                      title="Genera de nuevo voz + lipsync de ESTA escena solo. Las otras quedan intactas."
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1 py-1 rounded-[var(--radius-sm)] text-[10px] font-medium transition-colors cursor-pointer",
                        !isRegen
                          ? "bg-fg text-[var(--color-canvas)] hover:opacity-90"
                          : "bg-surface-1 text-fg-faint cursor-not-allowed",
                      )}
                    >
                      <RotateCcw size={10} /> Regen escena
                    </button>
                  </div>

                  {/* Advanced — split voice / lipsync regen (collapsed under details) */}
                  <details className="text-[9px] text-fg-faint">
                    <summary className="cursor-pointer hover:text-fg-muted select-none">Avanzado: regen por separado</summary>
                    <div className="flex gap-1 mt-1.5">
                      <button
                        onClick={() => handleRegenVoice(seg)}
                        disabled={isRegen}
                        className="flex-1 flex items-center justify-center gap-1 py-1 rounded-[var(--radius-sm)] text-[10px] font-medium bg-surface-2 text-fg-muted hover:bg-surface-3 hover:text-fg transition-colors cursor-pointer"
                      >
                        <Mic size={9} /> Solo voz
                      </button>
                      <button
                        onClick={() => handleRegenLipsync(seg)}
                        disabled={isRegen || !hasAudio}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-1 py-1 rounded-[var(--radius-sm)] text-[10px] font-medium transition-colors cursor-pointer",
                          !isRegen && hasAudio
                            ? "bg-surface-2 text-fg-muted hover:bg-surface-3 hover:text-fg"
                            : "bg-surface-1 text-fg-faint cursor-not-allowed",
                        )}
                      >
                        <RotateCcw size={9} /> Solo lip-sync
                      </button>
                    </div>
                  </details>

                  {/* Inline frame editor — opens when user clicks the Frame row above.
                      The edit only STAGES the new image as pendingFrameUrl; it does
                      NOT auto-run lipsync. The user reviews via the side-by-side
                      preview panel above and decides whether to apply or discard. */}
                  {isEditingFrame && baseFrameUrl && (
                    <div className="pt-1 border-t border-edge">
                      <ImageEditPanel
                        imageUrl={baseFrameUrl}
                        aspectRatio={config?.aspectRatio || "9:16"}
                        resolution={config?.resolution || "1K"}
                        selectedProductId={config?.selectedProductId} selectedClothingIds={config?.selectedClothingIds}
                        onImageUpdated={(newUrl) => {
                          // Stash for review — don't auto-apply or auto-animate
                          handleFrameUpdated(seg, newUrl);
                          setEditingFrameSceneId(null);
                        }}
                        onClose={() => setEditingFrameSceneId(null)}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Lightbox — opens when user clicks the new / actual frame thumbnails above.
            Click outside or on the image closes it. */}
        {lightboxUrl && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8 cursor-zoom-out"
            onClick={() => setLightboxUrl(null)}
          >
            <img
              src={lightboxUrl}
              alt="Frame zoom"
              className="max-h-full max-w-full object-contain rounded-[var(--radius-md)]"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        )}
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
    const fullVideoUrl = info.videoUrl ? `http://127.0.0.1:8000${info.videoUrl}` : undefined;
    const fullVideoUrlNoSubs = info.videoUrlNoSubs ? `http://127.0.0.1:8000${info.videoUrlNoSubs}` : undefined;

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
              onClick={() => downloadFile(fullVideoUrl, "ugc_with_subs.mp4")}
              className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-[var(--color-action-fg)] bg-[var(--color-action)] rounded-[var(--radius-sm)] hover:opacity-90 transition-opacity cursor-pointer"
            >
              <Film size={14} />
              Download with Subtitles
            </button>
          )}
          {fullVideoUrlNoSubs && (
            <button
              onClick={() => downloadFile(fullVideoUrlNoSubs, "ugc_no_subs.mp4")}
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
    const data = result as {
      slides: Array<{ id: string; url: string; label: string; headline: string; body: string; role: string }>;
      visualStyle?: string;
      composeMode?: "quick" | "compose";
    };
    const slides = data.slides || [];
    const isComposeMode = data.composeMode === "compose";
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Check size={14} className="text-[var(--color-success)]" />
          <span className="text-[13px] font-medium text-fg">Carousel — {slides.length} slides generated</span>
          {isComposeMode && (
            <span className="text-[10px] font-semibold text-[var(--color-action-strong)] bg-[var(--color-action-muted)] px-2 py-0.5 rounded uppercase tracking-wider">Compose Mode</span>
          )}
        </div>

        {/* Compose Mode editor — one ComposeOverlay per slide */}
        {isComposeMode && config && allSteps[0]?.result ? (
          <CarouselComposeEditor slides={slides} config={config} allSteps={allSteps} />
        ) : null}
        {/* Horizontal scroll carousel preview */}
        <div className="flex gap-3 overflow-x-auto pb-3 -mx-2 px-2 snap-x snap-mandatory">
          {slides.map((slide, i) => (
            <div key={slide.id} className="flex-shrink-0 w-56 snap-start space-y-2">
              <div
                className="rounded-[var(--radius-md)] overflow-hidden border border-edge cursor-pointer hover:border-[var(--color-action)] transition-colors relative group"
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
                  <span className="text-[9px] font-semibold text-[var(--color-action)] uppercase">{slide.role}</span>
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
                  selectedProductId={config?.selectedProductId} selectedClothingIds={config?.selectedClothingIds}
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
                downloadFile(slide.url, `carousel_${slide.id}.png`);
              }
            }}
            className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-[var(--color-action-fg)] bg-[var(--color-action)] rounded-[var(--radius-sm)] hover:opacity-90 cursor-pointer"
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
    const data = result as { images: Array<{ id: string; url: string; label: string }>; headline?: string; subline?: string; cta?: string; colors?: string; interpretation?: string };
    const images = data.images || [];
    const activeImg = images.find((i) => i.id === activeHeroId) || images[0];
    const colorTokens = (data.colors || "").split(/[,;]+/).map((s) => s.trim()).filter(Boolean).slice(0, 5);
    // Descriptive filenames: <marca>_<toma>.png  (e.g. taller-de-santa-clara_flat-frente-remera.png)
    const brandSlug = slugify(activeBrand?.name || "coevo");
    const fileFor = (img: { label?: string }, idx: number) => `${brandSlug}_${slugify(img.label || "") || `toma-${idx + 1}`}.png`;

    // ── Vista alternativa: tandas acumulativas (ecommerce_pack, etc.) ──
    // Si la tool batchable y ya hay >=1 tanda en el stack, renderizamos la pila
    // en lugar de la vista lineal. Cada tanda es independiente, con su propio
    // header + acciones. La última tanda generada queda arriba.
    if (toolId && BATCHABLE_TOOLS.has(toolId) && batches && batches.length > 0) {
      const allImages = batches.flatMap((b) => b.images);
      const totalCount = allImages.length;
      return (
        <div className="space-y-4">
          {/* Header global de tandas */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check size={14} className="text-[var(--color-success)]" />
              <span className="text-[13px] font-medium text-fg">
                {batches.length} tanda{batches.length === 1 ? "" : "s"} · {totalCount} imagen{totalCount === 1 ? "" : "es"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {totalCount > 1 && (
                <button
                  onClick={async () => {
                    const items = allImages
                      .filter((img) => img.url)
                      .map((img, idx) => ({ url: img.url, filename: `${brandSlug}_${slugify(img.label || "") || `toma-${idx + 1}`}.png` }));
                    try { await downloadZip(items, `${brandSlug}_pack`); }
                    catch (e) {
                      console.error("[ecommerce-pack] zip download failed:", e);
                      alert("No se pudo descargar el ZIP. Probá descargar de a una.");
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-fg-muted hover:text-fg bg-surface-2 hover:bg-surface-3 rounded-[var(--radius-sm)] cursor-pointer"
                  title="Todas las tandas en un solo ZIP"
                >
                  <Download size={12} />
                  Descargar todas ({totalCount}) · ZIP
                </button>
              )}
              {onNewBatch && (
                <button
                  onClick={onNewBatch}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-[var(--color-action-fg)] bg-[var(--color-action)] rounded-[var(--radius-sm)] hover:opacity-90 cursor-pointer"
                  title="Cambiá la config y dale Generar — se suma como nueva tanda"
                >
                  <Sparkles size={12} />
                  Nueva tanda
                </button>
              )}
            </div>
          </div>

          {/* Pila de tandas — más reciente arriba */}
          <div className="space-y-5">
            {batches.map((batch, batchIdx) => {
              const batchImages = batch.images.filter((im) => im.url);
              const isNewest = batchIdx === 0;
              return (
                <div key={batch.id} className="bg-surface-1 border border-edge rounded-[var(--radius-md)] overflow-hidden">
                  {/* Header de tanda */}
                  <div className="px-4 py-2.5 border-b border-edge flex items-center justify-between bg-surface-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider shrink-0">
                        Tanda {batches.length - batchIdx}
                      </span>
                      <span className="text-[12px] font-medium text-fg truncate">{batch.label}</span>
                      <span className="text-[10px] text-fg-faint shrink-0">· {timeAgo(batch.createdAt)}</span>
                      {isNewest && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-action)] bg-[var(--color-action-muted)] px-1.5 py-0.5 rounded shrink-0">
                          nueva
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {batchImages.length > 1 && (
                        <button
                          onClick={async () => {
                            const items = batchImages.map((img, idx) => ({ url: img.url, filename: `${brandSlug}_${slugify(img.label || "") || `toma-${idx + 1}`}.png` }));
                            try { await downloadZip(items, `${brandSlug}_${slugify(batch.label).slice(0, 30)}`); }
                            catch (e) { console.error(e); alert("No se pudo descargar el ZIP."); }
                          }}
                          className="flex items-center gap-1 px-2 py-1 text-[10px] text-fg-muted hover:text-fg hover:bg-surface-2 rounded transition-colors cursor-pointer"
                          title="Descargar solo esta tanda"
                        >
                          <Download size={11} />
                          ZIP
                        </button>
                      )}
                      {onDeleteBatch && (
                        <button
                          onClick={() => {
                            if (confirm(`Borrar "${batch.label}"? No se puede deshacer.`)) onDeleteBatch(batch.id);
                          }}
                          className="flex items-center justify-center w-7 h-7 text-fg-faint hover:text-red-400 hover:bg-surface-2 rounded transition-colors cursor-pointer"
                          title="Borrar esta tanda"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Grid de thumbs de la tanda */}
                  <div className="p-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {batch.images.map((img, idx) => {
                        const editKey = `${batch.id}__${img.id}`;
                        const isEditing = editingImageId === editKey;
                        return (
                          <div key={img.id} className={cn("space-y-1", isEditing && "col-span-2 sm:col-span-3 md:col-span-4 lg:col-span-5")}>
                            <div className={cn(
                              "rounded-[var(--radius-sm)] overflow-hidden border bg-surface-2 relative group transition-colors",
                              isEditing
                                ? "border-[var(--color-action)] aspect-auto"
                                : "border-edge hover:border-[var(--color-action)] cursor-pointer aspect-square",
                            )}>
                              {img.url ? (
                                <button
                                  onClick={() => !isEditing && setLightboxUrl(img.url)}
                                  className={cn("block w-full", isEditing ? "cursor-default" : "cursor-zoom-in")}
                                  title={isEditing ? "" : "Click para zoom"}
                                >
                                  <img src={img.url} alt={img.label} className={cn("w-full", isEditing ? "max-h-[400px] object-contain" : "h-full object-cover")} />
                                </button>
                              ) : (
                                <div className="w-full aspect-square flex items-center justify-center text-fg-faint text-[10px]">Failed</div>
                              )}
                              {img.url && !isEditing && (
                                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setEditingImageId(editKey); }}
                                    className="w-6 h-6 flex items-center justify-center bg-black/60 hover:bg-[var(--color-action)] text-white rounded cursor-pointer"
                                    title="Editar esta toma — agregá refs y describí qué cambiar"
                                  >
                                    <Wand2 size={11} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      downloadMediaAs(img.url, `${brandSlug}_${slugify(img.label || "") || `toma-${idx + 1}`}.png`);
                                    }}
                                    className="w-6 h-6 flex items-center justify-center bg-black/60 hover:bg-black/80 text-white rounded cursor-pointer"
                                    title="Descargar esta imagen"
                                  >
                                    <Download size={11} />
                                  </button>
                                </div>
                              )}
                              {isEditing && (
                                <button
                                  onClick={() => setEditingImageId(null)}
                                  className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-black/70 hover:bg-black/90 text-white rounded-full cursor-pointer"
                                  title="Cerrar editor"
                                >
                                  <X size={13} />
                                </button>
                              )}
                            </div>
                            <p className="text-[10px] text-fg-faint truncate px-0.5">{img.label}</p>
                            {isEditing && img.url && (
                              <div className="pt-1 border-t border-edge">
                                <ImageEditPanel
                                  imageUrl={img.url}
                                  aspectRatio={config?.aspectRatio || "4:5"}
                                  resolution={config?.resolution || "2K"}
                                  selectedProductId={config?.selectedProductId}
                                  selectedClothingIds={config?.selectedClothingIds}
                                  onImageUpdated={(newUrl) => {
                                    onUpdateBatchImage?.(batch.id, img.id, newUrl);
                                    setEditingImageId(null);
                                  }}
                                  onClose={() => setEditingImageId(null)}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* CTA al final también, para que no haya que scrollear arriba */}
          {onNewBatch && (
            <div className="pt-2">
              <button
                onClick={onNewBatch}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-[12px] font-medium text-fg-muted hover:text-fg bg-surface-1 hover:bg-surface-2 border border-dashed border-edge hover:border-[var(--color-action)] rounded-[var(--radius-md)] transition-colors cursor-pointer"
                title="Editá la config arriba (o desde el sidebar) y dale Generar — se suma como nueva tanda"
              >
                <Sparkles size={13} />
                + Nueva tanda (editá shots/outfits y volvé a generar)
              </button>
            </div>
          )}

          {/* Lightbox compartido */}
          {lightboxUrl && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8 cursor-pointer" onClick={() => setLightboxUrl(null)}>
              <img src={lightboxUrl} alt="Full size" className="max-h-full max-w-full object-contain rounded-[var(--radius-md)]" onClick={(e) => e.stopPropagation()} />
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {data.interpretation && (
          <div className="text-[11px] text-fg-muted bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2.5 py-1.5 leading-snug">
            <span className="text-[var(--color-action)] font-medium">Qué entendí:</span> {data.interpretation}
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check size={14} className="text-[var(--color-success)]" />
            <span className="text-[13px] font-medium text-fg">{images.length} creativo{images.length === 1 ? "" : "s"} generado{images.length === 1 ? "" : "s"}</span>
          </div>
          <div className="flex items-center gap-2">
            {activeImg?.url && (
              <button
                onClick={() => downloadMediaAs(activeImg.url, fileFor(activeImg, images.indexOf(activeImg)))}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-fg-muted hover:text-fg bg-surface-2 hover:bg-surface-3 rounded-[var(--radius-sm)] cursor-pointer"
                title={`Descargar: ${fileFor(activeImg, images.indexOf(activeImg))}`}
              >
                <Download size={12} />
                Descargar esta
              </button>
            )}
            {images.length > 1 && (
              <button
                onClick={async () => {
                  // Backend arma UN solo ZIP — soluciona el bloqueo de Chrome
                  // que ignora downloads consecutivos. Reportado: "no me deja
                  // descargar todas juntas, solo me baja una".
                  const items = images
                    .filter((img) => img.url)
                    .map((img, idx) => ({ url: img.url, filename: fileFor(img, idx) }));
                  try {
                    await downloadZip(items, `${brandSlug}_pack`);
                  } catch (e) {
                    console.error("[ecommerce-pack] zip download failed:", e);
                    alert("No se pudo descargar el ZIP. Probá descargar de a una.");
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-fg-muted hover:text-fg bg-surface-2 hover:bg-surface-3 rounded-[var(--radius-sm)] cursor-pointer"
                title="Descarga todas las imágenes empaquetadas en un ZIP"
              >
                <Download size={12} />
                Descargar todas ({images.length}) · ZIP
              </button>
            )}
          </div>
        </div>

        {/* Split layout: hero image + copy sidebar */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr,320px] gap-4 items-start">
          {/* Hero image */}
          <div className="space-y-2">
            <div
              className="rounded-[var(--radius-md)] overflow-hidden border border-edge cursor-pointer hover:border-[var(--color-action)] transition-colors relative group bg-surface-2"
              onClick={() => activeImg?.url && setLightboxUrl(activeImg.url)}
            >
              {activeImg?.url && <img src={activeImg.url} alt={activeImg.label} className="w-full object-contain max-h-[560px]" />}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center pointer-events-none">
                <Eye size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            {/* Thumbnails (variations) */}
            {images.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {images.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => setActiveHeroId(img.id)}
                    className={cn(
                      "w-16 h-16 rounded-[var(--radius-sm)] overflow-hidden border-2 cursor-pointer transition-all",
                      (activeImg?.id === img.id) ? "border-[var(--color-action)] ring-2 ring-[var(--color-action-muted)]" : "border-edge hover:border-edge-strong"
                    )}
                  >
                    <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Copy sidebar */}
          <div className="space-y-3 md:sticky md:top-4">
            {data.headline && (
              <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-4 space-y-3">
                <div>
                  <p className="text-[9px] font-semibold text-fg-faint uppercase tracking-wider mb-1">Headline</p>
                  <p className="text-[18px] font-bold text-fg leading-tight">{data.headline}</p>
                </div>
                {data.subline && (
                  <div>
                    <p className="text-[9px] font-semibold text-fg-faint uppercase tracking-wider mb-1">Subline</p>
                    <p className="text-[12px] text-fg-muted leading-relaxed">{data.subline}</p>
                  </div>
                )}
                {data.cta && (
                  <div>
                    <p className="text-[9px] font-semibold text-fg-faint uppercase tracking-wider mb-1">CTA</p>
                    <span className="inline-block px-3 py-1 text-[11px] font-semibold bg-fg text-[var(--color-canvas)] rounded-[var(--radius-sm)]">{data.cta}</span>
                  </div>
                )}
              </div>
            )}

            {colorTokens.length > 0 && (
              <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-3 space-y-2">
                <p className="text-[9px] font-semibold text-fg-faint uppercase tracking-wider">Paleta</p>
                <div className="flex gap-1.5 flex-wrap">
                  {colorTokens.map((c, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-surface-2 border border-edge rounded-full px-2 py-1">
                      <span className="w-3 h-3 rounded-full border border-edge-subtle" style={{ background: c }} />
                      <span className="text-[10px] text-fg-muted">{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeImg && (
              <div className="space-y-2">
                <button
                  onClick={() => setEditingImageId(editingImageId === activeImg.id ? null : activeImg.id)}
                  className="w-full py-2 text-[12px] font-medium text-fg-muted hover:text-fg bg-surface-2 hover:bg-surface-3 rounded-[var(--radius-sm)] cursor-pointer"
                >
                  {editingImageId === activeImg.id ? "Cancelar" : "Editar imagen"}
                </button>
                <button
                  type="button"
                  onClick={() => downloadUrl(activeImg.url, `static_ad_${activeImg.id}.png`)}
                  className="block w-full py-2 text-center text-[12px] font-medium text-[var(--color-action-fg)] bg-[var(--color-action)] hover:opacity-90 rounded-[var(--radius-sm)] cursor-pointer"
                >
                  Descargar
                </button>
              </div>
            )}
          </div>
        </div>

        {activeImg && editingImageId === activeImg.id && (
          <ImageEditPanel
            imageUrl={activeImg.url}
            aspectRatio={config?.aspectRatio || "4:5"}
            resolution={config?.resolution || "1K"}
            selectedProductId={config?.selectedProductId} selectedClothingIds={config?.selectedClothingIds}
            onImageUpdated={(newUrl) => { activeImg.url = newUrl; setEditingImageId(null); }}
            onClose={() => setEditingImageId(null)}
          />
        )}

        {lightboxUrl && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8 cursor-pointer" onClick={() => setLightboxUrl(null)}>
            <img src={lightboxUrl} alt="Full size" className="max-h-full max-w-full object-contain rounded-[var(--radius-md)]" onClick={(e) => e.stopPropagation()} />
          </div>
        )}
      </div>
    );
  }

  // Generate step — show generated image(s). Si el result trae `views[]` (Product
  // Sheet multi-view), renderiza una galería con cada vista en su aspect ratio
  // óptimo. Sino, cae al single-image legacy.
  if (stepId === "generate" && result) {
    const data = result as {
      url?: string;
      prompt?: string;
      headline?: string;
      subline?: string;
      title?: string;
      views?: Array<{ key: string; label: string; url: string; aspectRatio: string; prompt: string; error?: string }>;
    };
    const views = data.views?.filter((v) => v) || [];
    const isMultiView = views.length > 0;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Check size={14} className="text-[var(--color-success)]" />
          <span className="text-[13px] font-medium text-fg">
            {isMultiView
              ? `${views.filter((v) => v.url).length} / ${views.length} vista(s) generada(s)`
              : (data.title || "Image generated")}
          </span>
        </div>

        {isMultiView ? (
          // Galería multi-vista: grid 2 cols, cada card mantiene su aspect ratio
          // declarado por el catálogo. Click para lightbox.
          <div className="grid grid-cols-2 gap-3">
            {views.map((v) => (
              <div key={v.key} className="space-y-1.5">
                {v.url ? (
                  <div
                    className="rounded-[var(--radius-md)] overflow-hidden border border-edge cursor-pointer hover:border-[var(--color-brand)] transition-colors relative group bg-surface-2"
                    onClick={() => setLightboxUrl(v.url)}
                  >
                    <img src={v.url} alt={v.label} className="w-full h-auto" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <Eye size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[var(--radius-md)] border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 p-4 flex items-center justify-center text-[11px] text-[var(--color-error)] aspect-video">
                    <span>Falló — {v.error || "error desconocido"}</span>
                  </div>
                )}
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] font-semibold text-fg">{v.label}</span>
                  <span className="text-[9px] text-fg-faint">{v.aspectRatio}</span>
                </div>
                {v.url && (
                  <button
                    type="button"
                    onClick={() => downloadUrl(v.url, `${v.key}_${v.label.replace(/\s+/g, "_")}.png`)}
                    className="flex items-center justify-center gap-1 py-1 rounded-[var(--radius-sm)] text-[10px] bg-surface-2 text-fg-muted hover:bg-surface-3 hover:text-fg transition-colors w-full cursor-pointer"
                    title="Descargar esta vista"
                  >
                    <Download size={10} />
                    Descargar
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          data.url && (
            <div className="flex flex-col items-center gap-2">
              <div
                className="max-w-sm rounded-[var(--radius-md)] overflow-hidden border border-edge cursor-pointer hover:border-[var(--color-action)] transition-colors relative group"
                onClick={() => setLightboxUrl(data.url!)}
              >
                <img src={data.url} alt="Generated" className="w-full" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <Eye size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              {/* Botón Descargar — usa downloadUrl helper (fetch+blob) que fuerza
                  el descargado incluso con URLs cross-origin como Fal. */}
              <button
                type="button"
                onClick={() => downloadUrl(data.url!, `${(data.title || "generated").toLowerCase().replace(/[^a-z0-9]+/g, "_")}.png`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-[11px] bg-surface-2 text-fg-muted hover:bg-surface-3 hover:text-fg transition-colors cursor-pointer"
                title="Descargar imagen"
              >
                <Download size={11} />
                Descargar
              </button>
            </div>
          )
        )}

        {(data.headline || data.subline) && (
          <div className="text-center space-y-1">
            {data.headline && <p className="text-[14px] font-bold text-fg">{data.headline}</p>}
            {data.subline && <p className="text-[12px] text-fg-muted">{data.subline}</p>}
          </div>
        )}
        {data.prompt && !isMultiView && (
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
          <div className="bg-[var(--color-action-muted)] border border-[var(--color-action)] rounded-[var(--radius-md)] p-4">
            <h4 className="text-[11px] font-semibold text-[var(--color-action)] uppercase tracking-wider mb-1">Insights clave</h4>
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

  // Map Assets step — detected assets vs brand kit, with confirmation dropdowns
  if (stepId === "map_assets" && result) {
    interface DetectedItem { id: string; description: string; scenes: number[] }
    interface MatchItem { detected_id: string; description: string; scenes: number[]; suggested_brand_id: string | null; confidence: number; reason: string }
    interface MapResult {
      detected?: { persons?: DetectedItem[]; outfits?: DetectedItem[]; products?: DetectedItem[]; locations?: DetectedItem[] };
      matches?: { persons?: MatchItem[]; outfits?: MatchItem[]; products?: MatchItem[]; locations?: MatchItem[] };
      confirmations?: Record<string, string | null>;
      // Per-item text overrides keyed by "cat:detected_id". When set, this text
      // replaces the original detected description in the adapt step — lets the
      // user keep the reference structure but change a detail (outfit, location
      // vibe, etc.) even when the brand kit has no asset to map to.
      overrides?: Record<string, string>;
      // Per-garment role override keyed by "cat:detected_id" → "hero" | "wardrobe".
      // Default is inferred: detected products = hero (featured), detected outfits =
      // wardrobe (worn). The user can flip it — controls whether the item gets
      // featured/close-up treatment or styling/background treatment in the output.
      roles?: Record<string, "hero" | "wardrobe">;
      // Per-scene outfit granularity. Detected garments are grouped by scene; for each
      // scene the user picks "individual" (each garment → its own asset) or "complete"
      // (the whole scene look → ONE asset, stored under "outfits:__scene_<N>__").
      // Keyed by scene number as a string. Default per scene is "individual".
      outfitSceneModes?: Record<string, "individual" | "complete">;
      skipped?: boolean;
    }
    const data = result as MapResult;

    if (data.skipped) {
      return (
        <div className="text-center py-8 text-fg-faint text-[12px]">
          No detectó assets en el video. Continuá al siguiente paso.
        </div>
      );
    }

    const matches = data.matches || {};
    const confirmations = data.confirmations || {};

    type CategoryKey = "persons" | "outfits" | "products" | "locations";
    // Resolve full image URLs once so the dropdown previews render directly
    const resolveImg = (cat: CategoryKey, relUrl?: string): string | undefined => {
      if (!relUrl) return undefined;
      if (cat === "persons") return avatarImageUrl(relUrl);
      if (cat === "outfits") return clothingImageUrl(relUrl);
      if (cat === "products") return productImageUrl(relUrl);
      if (cat === "locations") return backgroundImageUrl(relUrl);
      return relUrl;
    };

    // Garment-like categories (outfits + products) share a combined pool of clothing
    // AND products — a brand may catalog a t-shirt they sell in either bucket, so both
    // dropdowns must offer both. Each option keeps the right thumbnail resolver.
    const clothingOpts = (activeBrand?.clothing || []).map((c) => ({ id: c.id, name: c.name, description: c.description, imageUrl: clothingImageUrl(c.imageUrl || "") }));
    const productOpts = (activeBrand?.products || []).map((p) => ({ id: p.id, name: p.name, description: p.description, imageUrl: productImageUrl(p.imageUrl || "") }));
    const garmentPool = [...clothingOpts, ...productOpts];

    const categories: Array<{
      key: CategoryKey;
      label: string;
      emoji: string;
      brandAssets: Array<{ id: string; name: string; description?: string; imageUrl?: string }>;
    }> = [
      { key: "persons",   label: "Personas",  emoji: "👤", brandAssets: (activeBrand?.avatars || []).map((a) => ({ id: a.id, name: a.name, description: a.description, imageUrl: resolveImg("persons", a.imageUrl) })) },
      { key: "outfits",   label: "Outfits / Prendas",   emoji: "👕", brandAssets: garmentPool },
      { key: "products",  label: "Productos", emoji: "📦", brandAssets: garmentPool },
      { key: "locations", label: "Locaciones", emoji: "🏞️", brandAssets: (activeBrand?.backgrounds || []).map((b) => ({ id: b.id, name: b.name, description: b.description, imageUrl: resolveImg("locations", b.imageUrl) })) },
    ];

    const setChoice = (cat: CategoryKey, detectedId: string, newBrandId: string | null) => {
      if (!onUpdateStepResult) return;
      const next: MapResult = {
        ...data,
        confirmations: { ...confirmations, [`${cat}:${detectedId}`]: newBrandId },
      };
      onUpdateStepResult("map_assets", next);
    };

    const addManual = (cat: CategoryKey, brandId: string) => {
      if (!onUpdateStepResult) return;
      const synthId = `manual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const brandAsset = categories.find((c) => c.key === cat)?.brandAssets.find((b) => b.id === brandId);
      const newMatch: MatchItem = {
        detected_id: synthId,
        description: brandAsset ? `Agregado manualmente: ${brandAsset.name}` : "Agregado manualmente",
        scenes: [],
        suggested_brand_id: brandId,
        confidence: 1.0,
        reason: "manual",
      };
      const next: MapResult = {
        ...data,
        matches: {
          ...matches,
          [cat]: [...(matches[cat] || []), newMatch],
        },
        confirmations: { ...confirmations, [`${cat}:${synthId}`]: brandId },
      };
      onUpdateStepResult("map_assets", next);
    };

    const removeEntry = (cat: CategoryKey, detectedId: string) => {
      if (!onUpdateStepResult) return;
      const filteredMatches = (matches[cat] || []).filter((m) => m.detected_id !== detectedId);
      const newConfirmations = { ...confirmations };
      delete newConfirmations[`${cat}:${detectedId}`];
      const next: MapResult = {
        ...data,
        matches: { ...matches, [cat]: filteredMatches },
        confirmations: newConfirmations,
      };
      onUpdateStepResult("map_assets", next);
    };

    const overrides = data.overrides || {};
    const setOverride = (cat: CategoryKey, detectedId: string, text: string) => {
      if (!onUpdateStepResult) return;
      const nextOverrides = { ...overrides };
      const trimmed = text.trim();
      if (trimmed) nextOverrides[`${cat}:${detectedId}`] = trimmed;
      else delete nextOverrides[`${cat}:${detectedId}`];
      onUpdateStepResult("map_assets", { ...data, overrides: nextOverrides });
    };

    // Role: dynamic default (products → hero, outfits → wardrobe) with manual override.
    const roles = data.roles || {};
    const defaultRole = (cat: CategoryKey): "hero" | "wardrobe" =>
      cat === "products" ? "hero" : "wardrobe";
    const roleOf = (cat: CategoryKey, detectedId: string): "hero" | "wardrobe" =>
      roles[`${cat}:${detectedId}`] || defaultRole(cat);
    const setRole = (cat: CategoryKey, detectedId: string, role: "hero" | "wardrobe") => {
      if (!onUpdateStepResult) return;
      onUpdateStepResult("map_assets", { ...data, roles: { ...roles, [`${cat}:${detectedId}`]: role } });
    };

    // Per-scene outfit granularity. Each scene can be "individual" or "complete".
    const outfitSceneModes = data.outfitSceneModes || {};
    const sceneOutfitMode = (s: number): "individual" | "complete" => outfitSceneModes[String(s)] || "individual";
    const sceneCompleteKey = (s: number) => `__scene_${s}__`;
    // Limpia confirmations residuales al cambiar de modo — sin esto, si el usuario
    // arrancaba en "sueltas" y mapeaba algunas prendas individualmente, después
    // cambiaba a "outfit completo" y elegía 1 prenda, quedaban AMBAS modalidades en
    // el storage. El handoff a Fashion Reel agarraba todos los IDs y pre-seleccionaba
    // las prendas equivocadas. Reportado: "elegí outfit completo en las 3 escenas
    // pero en Fashion Reel estaban seleccionadas las prendas diferentes".
    const setSceneOutfitMode = (s: number, mode: "individual" | "complete") => {
      if (!onUpdateStepResult) return;
      // Limpieza de la modalidad opuesta para evitar residuos. Usamos matches["outfits"]
      // directamente (no `items`, que vive dentro del .map de categories más abajo).
      const outfitMatches = (matches.outfits || []) as MatchItem[];
      const sceneItemKeys = outfitMatches
        .filter((it) => (it.scenes || []).includes(s))
        .map((it) => `outfits:${it.detected_id}`);
      const completeKey = `outfits:${sceneCompleteKey(s)}`;
      const nextConfirmations = { ...confirmations };
      if (mode === "complete") {
        // El usuario va a elegir 1 outfit para toda la escena → las elecciones de
        // items individuales de esa escena ya no aplican.
        for (const k of sceneItemKeys) delete nextConfirmations[k];
      } else {
        // El usuario va a elegir item por item → la elección "complete" ya no aplica.
        delete nextConfirmations[completeKey];
      }
      onUpdateStepResult("map_assets", {
        ...data,
        outfitSceneModes: { ...outfitSceneModes, [String(s)]: mode },
        confirmations: nextConfirmations,
      });
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Check size={14} className="text-[var(--color-success)]" />
          <span className="text-[13px] font-medium text-fg">Mapeo de assets — confirmá, ajustá o agregá</span>
        </div>
        <p className="text-[11px] text-fg-muted leading-relaxed bg-surface-1 border border-edge rounded-[var(--radius-sm)] p-2.5">
          Para cada prenda/elemento detectado en el video: elegí con qué asset tuyo reemplazarlo,
          o &ldquo;Ajustar&rdquo; para cambiar el texto. En prendas, el toggle
          <span className="text-[var(--color-action)] font-medium"> 🎯 Producto a vender</span> /
          <span className="text-fg"> 👕 Solo la usa</span> define el rol:
          <strong> &ldquo;Producto a vender&rdquo;</strong> = lo que estás promocionando (close-ups, foco del script).
          <strong> &ldquo;Solo la usa&rdquo;</strong> = styling de fondo, la modelo lo lleva puesto pero no es el foco.
        </p>

        {categories.map(({ key, label, emoji, brandAssets }) => {
          const items = matches[key] || [];
          // One detected-item row, with every callback wired to this category.
          const row = (item: MatchItem, showScenes = true) => (
            <DetectedItemRow
              key={item.detected_id}
              item={item}
              cat={key}
              brandAssets={brandAssets}
              confirmedId={confirmations[`${key}:${item.detected_id}`] ?? null}
              overrideText={overrides[`${key}:${item.detected_id}`]}
              isEditing={editingId === `ovr:${key}:${item.detected_id}`}
              role={roleOf(key, item.detected_id)}
              showScenes={showScenes}
              onChoice={(id) => setChoice(key, item.detected_id, id)}
              onToggleRole={() => setRole(key, item.detected_id, roleOf(key, item.detected_id) === "hero" ? "wardrobe" : "hero")}
              onSetOverride={(t) => setOverride(key, item.detected_id, t)}
              onStartEdit={() => setEditingId(`ovr:${key}:${item.detected_id}`)}
              onStopEdit={() => setEditingId(null)}
              onRemove={() => removeEntry(key, item.detected_id)}
            />
          );
          // Outfits are grouped by scene so it's clear which garments belong where.
          const sceneNums = key === "outfits"
            ? [...new Set(items.flatMap((it) => it.scenes || []))].sort((a, b) => a - b)
            : [];
          return (
            <div key={key} className="bg-surface-0 border border-edge rounded-[var(--radius-md)] p-3 space-y-2.5">
              <div className="text-[11px] font-semibold text-fg uppercase tracking-wider flex items-center justify-between">
                <span>
                  {emoji} {label} <span className="text-fg-faint normal-case">({items.length})</span>
                </span>
                {brandAssets.length === 0 && (
                  <span className="text-fg-faint normal-case text-[10px]">brand kit vacío</span>
                )}
              </div>

              {key === "outfits" && items.length > 0 && sceneNums.length > 0 && (
                <p className="text-[10px] text-fg-faint">
                  Agrupado por escena. En cada una elegí <strong>prendas sueltas</strong> (cada prenda → su asset) o <strong>outfit completo</strong> (todo el look → un asset).
                </p>
              )}

              {items.length === 0 ? (
                <p className="text-[11px] text-fg-faint italic">No se detectó ninguno en el video. Podés agregar uno manualmente abajo.</p>
              ) : key === "outfits" && sceneNums.length > 0 ? (
                // Outfits grouped by scene, each with its own individual/complete toggle.
                sceneNums.map((s) => {
                  const sceneItems = items.filter((it) => (it.scenes || []).includes(s));
                  const mode = sceneOutfitMode(s);
                  const completeId = confirmations[`outfits:${sceneCompleteKey(s)}`] ?? null;
                  return (
                    <div key={`scene_${s}`} className="border border-edge rounded-[var(--radius-sm)] p-2.5 space-y-2 bg-surface-1/40">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[11px] font-bold text-fg flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-[var(--color-action-subtle)] text-[var(--color-action)] flex items-center justify-center text-[10px]">{s}</span>
                          Escena {s} <span className="text-fg-faint font-normal">({sceneItems.length} {sceneItems.length === 1 ? "prenda" : "prendas"})</span>
                        </span>
                        <div className="flex items-center gap-1 bg-surface-2 border border-edge rounded-full p-0.5">
                          {([["individual", "👕 Sueltas"], ["complete", "🧥 Outfit completo"]] as const).map(([m, lbl]) => (
                            <button
                              key={m}
                              onClick={() => setSceneOutfitMode(s, m)}
                              className={cn("px-2.5 py-0.5 text-[10px] rounded-full cursor-pointer transition-colors", mode === m ? "bg-[var(--color-action-subtle)] text-fg" : "text-fg-muted hover:text-fg")}
                            >
                              {lbl}
                            </button>
                          ))}
                        </div>
                      </div>
                      {mode === "complete" ? (
                        <div className="bg-surface-1 rounded-[var(--radius-sm)] p-2.5 space-y-1.5">
                          <p className="text-[11px] text-fg-muted leading-snug">
                            Una sola prenda de tu kit para todo el look de esta escena
                            <span className="text-fg-faint"> · detectado: {sceneItems.map((it) => it.description).join(" · ").slice(0, 140)}</span>
                          </p>
                          <AssetPickerDropdown
                            options={brandAssets}
                            value={completeId}
                            onChange={(id) => setChoice("outfits", sceneCompleteKey(s), id)}
                          />
                        </div>
                      ) : (
                        sceneItems.map((item) => row(item, false))
                      )}
                    </div>
                  );
                })
              ) : (
                items.map((item) => row(item))
              )}

              {/* Add manually del Brand Kit */}
              {brandAssets.length > 0 && (
                <AddManualButton brandAssets={brandAssets} onAdd={(id) => addManual(key, id)} />
              )}

              {/* Upload ad-hoc para LOCATIONS — sube una imagen one-off (no guarda
                  en Brand Kit) que viaja al handoff y la usa Fashion Reel como
                  background ref. Reportado: "Content Analyzer no me permitió
                  ponerle el fondo". */}
              {key === "locations" && (() => {
                const adHocUrl = (data as unknown as Record<string, string>).adHocBackgroundDataUrl;
                return (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-sm)] bg-[var(--color-brand-subtle)] border border-[var(--color-brand-muted)]">
                    {adHocUrl ? (
                      <>
                        <img src={adHocUrl} alt="ad-hoc" className="w-8 h-8 rounded object-cover shrink-0" />
                        <span className="flex-1 text-[10px] text-fg">
                          <strong className="text-[var(--color-brand)]">Fondo ad-hoc</strong> cargado · vive solo en este run, no se guarda al Brand Kit.
                        </span>
                        <button
                          onClick={() => {
                            if (onUpdateStepResult) onUpdateStepResult("map_assets", { ...data, adHocBackgroundDataUrl: undefined });
                          }}
                          className="text-[10px] text-fg-faint hover:text-fg cursor-pointer"
                          title="Quitar"
                        ><X size={11} /></button>
                      </>
                    ) : (
                      <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-[var(--color-brand)] hover:underline w-full">
                        <Plus size={11} />
                        Subir imagen ad-hoc (one-off, no toca el Brand Kit)
                        <input
                          type="file"
                          accept={IMAGE_ACCEPT}
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            const r = new FileReader();
                            r.onload = () => {
                              if (onUpdateStepResult) onUpdateStepResult("map_assets", {
                                ...data,
                                adHocBackgroundDataUrl: r.result as string,
                              });
                            };
                            r.readAsDataURL(f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })}

        <p className="text-[10px] text-fg-faint text-center">
          Aprobá este paso cuando los mapeos estén OK. Lo elegido se aplica al tool destino.
        </p>
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
                <span className="text-[10px] font-bold text-[var(--color-action)] bg-warm-muted px-1.5 py-0.5 rounded">
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
                    const res = await fetch("http://127.0.0.1:8000/api/tools/generate-prompt", {
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
              className="w-full text-[18px] font-bold text-fg bg-transparent border-b border-transparent hover:border-edge focus:border-[var(--color-action)] outline-none transition-colors"
            />
            <input
              key={`s_${subline}`}
              defaultValue={subline}
              onChange={(e) => { (data as Record<string, unknown>).subline = e.target.value; }}
              className="w-full text-[13px] text-fg-muted bg-transparent border-b border-transparent hover:border-edge focus:border-[var(--color-action)] outline-none transition-colors"
            />
            <input
              key={`c_${cta}`}
              defaultValue={cta}
              onChange={(e) => { (data as Record<string, unknown>).cta = e.target.value; }}
              placeholder="CTA (e.g., Shop now)"
              className="w-full text-[12px] text-[var(--color-action)] font-medium bg-transparent border-b border-transparent hover:border-edge focus:border-[var(--color-action)] outline-none transition-colors placeholder:text-fg-faint"
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
                className="relative aspect-[9/16] rounded-[var(--radius-sm)] overflow-hidden border border-edge cursor-pointer hover:border-[var(--color-action)] transition-colors group"
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
                  selectedProductId={config?.selectedProductId} selectedClothingIds={config?.selectedClothingIds}
                  onImageUpdated={(newUrl) => { img.url = newUrl; setEditingId(null); }}
                  onClose={() => setEditingId(null)}
                />
              )}
              {/* AnimationHintBar — usuario tipea / cura / inspira instrucción de motion
                  ANTES de animar. Persistido en script.frames[i].animationHint donde el
                  handler de animate de Video Ad Creator / Product Clip lo lee. */}
              {(() => {
                const scriptStepData = allSteps.find((s) => s.id === "script")?.result as Record<string, unknown> | undefined;
                if (!scriptStepData) return null;
                const frames = (scriptStepData.frames as Array<Record<string, unknown>>) || [];
                const frameIdx = img.frame - 1;
                const frameEntry = frames[frameIdx];
                const currentHint = (frameEntry?.animationHint as string) || "";
                const updateHint = (hint: string) => {
                  if (!onUpdateStepResult) return;
                  const newFrames = frames.map((f, i) => i === frameIdx ? { ...f, animationHint: hint } : f);
                  onUpdateStepResult("script", { ...scriptStepData, frames: newFrames });
                  onInvalidateDownstream?.("images");
                };
                return (
                  <AnimationHintBar
                    value={currentHint}
                    onChange={updateHint}
                    sceneContext={img.script || img.prompt?.slice(0, 100) || `Frame ${img.frame}`}
                    compact
                  />
                );
              })()}
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
                      ? "border-[var(--color-action)] ring-2 ring-[var(--color-action)]/30"
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
                className="relative rounded-[var(--radius-sm)] overflow-hidden border border-edge group cursor-pointer hover:border-[var(--color-action)] transition-colors"
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
                    className="flex-1 flex items-center justify-center gap-1 py-1 rounded-[var(--radius-sm)] text-[10px] font-medium bg-[var(--color-action-muted)] text-[var(--color-action)] hover:opacity-80 transition-colors cursor-pointer"
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
                  selectedProductId={config?.selectedProductId} selectedClothingIds={config?.selectedClothingIds}
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
                  downloadFile(c.url, `creative_${i + 1}_${c.style}.png`);
                });
              }}
              className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-[var(--color-action-fg)] bg-[var(--color-action)] rounded-[var(--radius-sm)] hover:opacity-90 cursor-pointer"
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
  // Result can come in 2 shapes:
  //   - video_ad_creator: { segments: [{index, videoUrl, startFrame, endFrame, status}, ...] }
  //   - fashion_reel:     [{sceneId, title, videoUrl, imageUrl}, ...]
  //   - either of those wrapped in { variations: [...], selections: [...] } after approval
  if (stepId === "animate" && result) {
    interface VideoSeg {
      key: string;
      videoUrl: string;
      label: string;
      sublabel?: string;
      status: string;
    }

    // Unwrap post-approval envelope
    const unwrapped = Array.isArray(result)
      ? result
      : (result as Record<string, unknown>).segments
        || (result as Record<string, unknown>).variations
        || result;

    // Fashion Reel editable path: result is a flat array of {sceneId,title,videoUrl,imageUrl,mode}.
    // We render per-clip controls (regen + frame edit) so the user can fix ONE clip
    // without re-animating the whole reel — same UX as the UGC lipsync step.
    interface FRClip { sceneId: string; title: string; videoUrl: string; imageUrl: string; mode?: string; motionPrompt?: string }
    // DoneStep doesn't receive `tool`, so detect Fashion Reel clips by their shape:
    // each clip has a string `sceneId` AND a string `imageUrl` (video_ad_creator uses
    // index/startFrame/endFrame instead, and UGC uses the lipsync step, not animate).
    const firstClip = Array.isArray(unwrapped) ? (unwrapped[0] as Record<string, unknown> | undefined) : undefined;
    const isFashionReelClips =
      Array.isArray(unwrapped) &&
      unwrapped.length > 0 &&
      typeof firstClip?.imageUrl === "string" &&
      typeof firstClip?.sceneId === "string";

    if (isFashionReelClips) {
      const clips = unwrapped as FRClip[];
      const engine = (config?.animationEngine === "seedance" ? "seedance" : "kling");
      const klingModel = ((config as Record<string, unknown> | undefined)?.videoModel as "v3-pro" | "v2-6-pro" | "v2-6-std" | "v2-5-turbo") || "v3-pro";

      const persist = () => { if (onUpdateStepResult) onUpdateStepResult("animate", [...clips]); };
      const defaultMotion = "Fashion model subtle natural movement — slight sway, confident pose, hair movement. Vertical 9:16.";

      const regenClip = async (clip: FRClip, idx: number) => {
        setRegenSceneId(clip.sceneId);
        try {
          let videoUrl = "";
          // Use the clip's (possibly user-edited) motion prompt — this is what makes
          // the prompt visible AND controllable per clip.
          const motion = clip.motionPrompt?.trim() || defaultMotion;
          if (engine === "seedance") {
            const job = await createSeedanceReferenceToVideo({ prompt: motion, referenceImageUrls: [clip.imageUrl], duration: "5" });
            const r = job.video_url ? { status: "completed", video_url: job.video_url } : await pollSeedanceVideo(job.request_id);
            videoUrl = r.video_url || "";
          } else if (clip.mode === "f2f" && idx < clips.length - 1) {
            const next = clips[idx + 1];
            const job = await createKlingFrameToFrame({ start_image_url: clip.imageUrl, end_image_url: next.imageUrl, prompt: motion, duration: "5", model: klingModel });
            const r = await pollKlingVideo(job.request_id);
            videoUrl = r.video_url || "";
          } else {
            const job = await createKlingVideo(clip.imageUrl, motion, "5", klingModel);
            const r = await pollKlingVideo(job.request_id);
            videoUrl = r.video_url || "";
          }
          if (videoUrl) { clip.videoUrl = videoUrl; persist(); }
        } catch { /* silent */ } finally {
          setRegenSceneId(null);
        }
      };

      const successCount = clips.filter((c) => c.videoUrl).length;
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Check size={14} className="text-[var(--color-success)]" />
            <span className="text-[13px] font-medium text-fg">{successCount}/{clips.length} clips animados — editá los que quieras sin tocar el resto</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {clips.map((clip, idx) => {
              const isRegen = regenSceneId === clip.sceneId;
              const isEditingFrame = editingFrameSceneId === clip.sceneId;
              return (
                <div key={clip.sceneId} className="bg-surface-0 border border-edge rounded-[var(--radius-md)] overflow-hidden">
                  <div className="aspect-[9/16] relative">
                    {clip.videoUrl ? (
                      <video src={clip.videoUrl} controls className="w-full h-full object-contain bg-black" />
                    ) : (
                      <div className="w-full h-full bg-surface-2 flex items-center justify-center">
                        <AlertCircle size={16} className="text-[var(--color-error)]" />
                      </div>
                    )}
                    {isRegen && (
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                        <Loader2 size={20} className="animate-spin text-white" />
                        <p className="text-[10px] text-white/70">Regenerando...</p>
                      </div>
                    )}
                    {clip.mode === "f2f" && (
                      <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-blue-500/80 text-white text-[8px] font-semibold">f2f →</span>
                    )}
                    {clip.mode === "entry" && (
                      <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-purple-500/80 text-white text-[8px] font-semibold">🚪 entrada</span>
                    )}
                  </div>
                  <div className="p-2 space-y-1.5">
                    <span className="text-[10px] text-fg font-medium truncate block">{clip.title}</span>
                    {/* Frame base — click para editar la imagen y re-animar */}
                    <button
                      type="button"
                      onClick={() => setEditingFrameSceneId(isEditingFrame ? null : clip.sceneId)}
                      className={cn(
                        "w-full flex items-center gap-1.5 p-1 rounded-[var(--radius-sm)] border text-left transition-colors",
                        isEditingFrame ? "border-[var(--color-action)] bg-[var(--color-action)]/10" : "border-edge hover:bg-surface-1",
                      )}
                    >
                      <img src={clip.imageUrl} alt="frame" className="w-7 h-7 object-cover rounded" />
                      <span className="text-[9px] text-fg-muted flex-1">{isEditingFrame ? "Cerrar" : "Editar frame base"}</span>
                      <ImageIcon size={10} className="text-fg-faint" />
                    </button>
                    {/* Visible + editable motion prompt — exactly what gets sent to the
                        video model for this clip. Edit it and Regen to apply. */}
                    <details className="text-[9px] text-fg-faint">
                      <summary className="cursor-pointer hover:text-fg-muted select-none">Ver / editar prompt de animación</summary>
                      <textarea
                        defaultValue={clip.motionPrompt || defaultMotion}
                        onChange={(e) => { clip.motionPrompt = e.target.value; }}
                        onBlur={persist}
                        rows={3}
                        className="w-full mt-1 text-[10px] text-fg bg-surface-1 border border-edge focus:border-[var(--color-action)] rounded-[var(--radius-sm)] px-1.5 py-1 outline-none resize-none"
                      />
                    </details>
                    <button
                      onClick={() => regenClip(clip, idx)}
                      disabled={isRegen}
                      className={cn(
                        "w-full flex items-center justify-center gap-1 py-1 rounded-[var(--radius-sm)] text-[10px] font-medium transition-colors cursor-pointer",
                        !isRegen ? "bg-fg text-[var(--color-canvas)] hover:opacity-90" : "bg-surface-1 text-fg-faint cursor-not-allowed",
                      )}
                    >
                      <RotateCcw size={9} /> Regen clip
                    </button>
                    {isEditingFrame && (
                      <div className="pt-1 border-t border-edge">
                        <ImageEditPanel
                          imageUrl={clip.imageUrl}
                          aspectRatio={config?.aspectRatio || "9:16"}
                          resolution={config?.resolution || "1K"}
                          selectedProductId={config?.selectedProductId} selectedClothingIds={config?.selectedClothingIds}
                          onImageUpdated={(newUrl) => { clip.imageUrl = newUrl; persist(); setEditingFrameSceneId(null); }}
                          onClose={() => setEditingFrameSceneId(null)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-fg-faint text-center">
            Editá el frame o regenerá clips individuales. Approve para renderizar el video final.
          </p>
          {lightboxUrl && (
            <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8 cursor-zoom-out" onClick={() => setLightboxUrl(null)}>
              <img src={lightboxUrl} alt="zoom" className="max-h-full max-w-full object-contain rounded-[var(--radius-md)]" onClick={(e) => e.stopPropagation()} />
            </div>
          )}
        </div>
      );
    }

    const segments: VideoSeg[] = Array.isArray(unwrapped)
      ? unwrapped.map((s: Record<string, unknown>, i: number) => ({
          key: String(s.sceneId || s.id || s.index || i),
          videoUrl: String(s.videoUrl || ""),
          label: String(s.title || (s.startFrame !== undefined ? `F${s.startFrame} → F${s.endFrame}` : `Scene ${i + 1}`)),
          sublabel: s.startFrame !== undefined ? undefined : (s.sceneId ? String(s.sceneId) : undefined),
          status: String(s.status || (s.videoUrl ? "done" : "failed")),
        }))
      : [];

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
            <div key={seg.key} className="bg-surface-0 border border-edge rounded-[var(--radius-md)] overflow-hidden">
              <div className="aspect-[9/16]">
                {seg.videoUrl ? (
                  <video src={seg.videoUrl} controls className="w-full h-full object-contain bg-black" />
                ) : (
                  <div className="w-full h-full bg-surface-2 flex items-center justify-center">
                    <AlertCircle size={16} className="text-[var(--color-error)]" />
                  </div>
                )}
              </div>
              <div className="p-2 flex items-center justify-between gap-2">
                <span className="text-[10px] text-fg font-medium truncate">{seg.label}</span>
                <span className={cn(
                  "text-[9px] px-1.5 py-0.5 rounded shrink-0",
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
  onDelete,
  deleteConfirm,
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
  /** Borra el item del Brand Kit (propaga a todas las tools). Si se provee,
   *  cada card muestra un trash en hover. */
  onDelete?: (id: string) => Promise<void> | void;
  /** Mensaje de confirmación. `{name}` se reemplaza por el nombre del item. */
  deleteConfirm?: string;
}) {
  const hasItems = items.length > 0;
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Sube uno o varios archivos. Secuencial para evitar races en setConfig/
  // refreshBrands (cada onUpload refresca el brand y agrega su id a la selección).
  const handleFiles = async (files: File[]) => {
    if (!onUpload || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const finalName = file.name.replace(/\.[^.]+$/, "");
        try {
          await onUpload(file, finalName);
        } catch { /* seguí con los demás aunque uno falle */ }
      }
      setShowUpload(false);
    } finally {
      setUploading(false);
    }
  };

  const uploadForm = onUpload ? (
    <div className={cn(hasItems ? "mb-2" : "")}>
      <label className={cn(
        "flex items-center justify-center gap-1.5 py-2 border border-dashed rounded-[var(--radius-sm)] cursor-pointer text-[10px] transition-all",
        uploading
          ? "border-[var(--color-action)] bg-[var(--color-action-muted)] text-fg-muted"
          : "border-edge hover:border-[var(--color-edge-strong)] hover:bg-surface-2 text-fg-muted hover:text-fg"
      )}>
        {uploading ? (
          <><Loader2 size={11} className="animate-spin" /> Subiendo...</>
        ) : (
          <><Plus size={11} /> Subir imágenes</>
        )}
        <input
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length) handleFiles(files);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  ) : null;

  return (
    // Compactado para sidebar 440px: p-2.5 (era p-4), header de 1 línea (label +
    // contador + upload-icon en un flex con gap chico), sin label sublabel
    // entre paréntesis arrastrando segunda línea. Grid 4-col en lugar de 3 para
    // que entren más cards en menos alto.
    <div className="bg-surface-1 border border-edge rounded-[var(--radius-sm)] p-2.5">
      <div className="flex items-center gap-2 mb-2 min-w-0">
        <label className="text-[11px] font-semibold text-fg-secondary truncate">
          {label}
          {sublabel && (
            <span className="text-fg-faint font-normal ml-1 text-[10px]">· {sublabel}</span>
          )}
        </label>
        <span className="ml-auto flex items-center gap-1.5 shrink-0">
          {hasItems && (
            <span className="text-[9px] text-fg-faint">{items.length}</span>
          )}
          {onUpload && !showUpload && hasItems && (
            <button
              onClick={() => setShowUpload(true)}
              title="Subir imagen"
              className="flex items-center justify-center w-5 h-5 rounded text-[var(--color-action)] hover:bg-[var(--color-action-subtle)] cursor-pointer"
            >
              <Plus size={11} />
            </button>
          )}
        </span>
      </div>

      {/* Show upload inline when toggled or when there are no items */}
      {(showUpload || !hasItems) && uploadForm}

      {hasItems && (
        <div className="grid grid-cols-4 gap-1.5">
          {items.map((item) => {
            const isSelected = multi
              ? (selectedIds || []).includes(item.id)
              : selectedId === item.id;

            // Wrapper para que el trash pueda vivir afuera del <button> principal
            // (no se pueden anidar buttons). Mismo patrón que la sección Accesorios.
            return (
              <div key={item.id} className="group/tile relative">
                <button
                  onClick={() => multi ? onToggle?.(item.id) : onSelect?.(item.id)}
                  title={item.description ? `${item.name} — ${item.description}` : item.name}
                  className={cn(
                    "w-full border rounded-[var(--radius-sm)] p-1 transition-all cursor-pointer relative text-left",
                    isSelected
                      // Estado activo en burgundy con glow lateral sutil. Reemplaza el
                      // blanco genérico para que las cards seleccionadas tengan personalidad
                      // y se diferencien claramente del hover state.
                      ? "border-[var(--color-brand)] bg-[var(--color-brand-subtle)] shadow-[0_0_14px_-4px_var(--color-brand-muted)]"
                      : "border-edge hover:border-[var(--color-edge-strong)]"
                  )}
                >
                  {isSelected && (
                    <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-[var(--color-brand)] flex items-center justify-center z-10 shadow-sm">
                      <Check size={8} className="text-[var(--color-brand-fg)]" />
                    </div>
                  )}
                  <div className="w-full aspect-square bg-surface-2 rounded-[2px] overflow-hidden">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-fg-faint">
                        <ImageIcon size={14} />
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] text-fg-muted truncate block font-medium mt-1 leading-tight">
                    {item.name}
                  </span>
                </button>
                {/* Trash en hover — borra el item del Brand Kit (propaga a todas
                    las tools). Con confirm porque es destructivo. */}
                {onDelete && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const msg = (deleteConfirm || `Borrar "{name}" del Brand Kit? Se quita de TODAS las tools, no se puede deshacer.`).replace("{name}", item.name);
                      if (!confirm(msg)) return;
                      try {
                        await onDelete(item.id);
                      } catch (err) {
                        console.error("[AssetSelector] delete failed:", err);
                        alert("No se pudo borrar.");
                      }
                    }}
                    title="Borrar del Brand Kit (no se puede deshacer)"
                    className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-black/70 hover:bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/tile:opacity-100 transition-opacity cursor-pointer z-20"
                  >
                    <Trash2 size={9} />
                  </button>
                )}
              </div>
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
  const lower = contentType.toLowerCase();

  // Visual-fashion content → Fashion Reel, EVEN when a script/voiceover was detected.
  // Fashion reels are visual by nature and their background music often gets transcribed
  // as a "script", which used to flip isVisualOnly to false and mis-route them to UGC.
  // Only fall back to a talking tool when there's an explicit talking signal.
  const TALKING_SIGNALS = ["talking", "testimonial", "tutorial", "review", "presenter", "narrator", "speaker", "vlog", "explainer", "interview"];
  const FASHION_SIGNALS = ["fashion", "editorial", "runway", "catwalk", "lookbook", "ootd", "outfit", "model", "moda", "desfile", "pasarela"];
  const hasTalking = TALKING_SIGNALS.some((kw) => lower.includes(kw));
  const hasFashion = FASHION_SIGNALS.some((kw) => lower.includes(kw));
  if (hasFashion && !hasTalking) return "fashion_reel";

  if (isVisualOnly) return "fashion_reel";
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
  // isVisualOnly: now defaults to TALKING. We only flag visual-only when there's a
  // clear signal (specific content_type, or script literally empty). Before this fix,
  // many UGC videos (a person selling in casual rioplatense) were being mis-flagged as
  // visual-only because the script lacked specific keywords like "compra/visitá",
  // and every scene then became "creative" — losing the talking structure of the source.
  const isVisualOnly = (() => {
    const script = (analyzeData?.analysis?.estimated_script || "").trim();
    const ct = contentType.toLowerCase();
    const structure = (analyzeData?.analysis?.structure || "").toLowerCase();

    // Truly empty script → visual-only
    if (!script || script.length < 5) return true;

    // Clear visual-only content types — no person speaking on camera
    if (ct.includes("dance") || ct.includes("baile")) return true;
    if (ct.includes("fashion-movement") || ct.includes("movement only")) return true;
    if (ct.includes("transformation") && !ct.includes("ugc") && !ct.includes("testimonial")) return true;
    if (ct.includes("transition")) return true;

    // Trending audio overlay (recognizable lyrics/hooks) → visual-only
    const isAudioTrend = /\b(damn|look good|nobody tell me|i look|can't nobody|what the|mirror|feeling myself|baby|love song)\b/i.test(script);
    if (isAudioTrend) return true;

    // Everything else: default to TALKING. If there's any meaningful script, assume
    // the person is speaking — that's the more conservative assumption for UGC.
    return false;
  })();
  const suggestedId = detectSuggestedTool(contentType, isVisualOnly);

  const launch = (targetToolId: string) => {
    // Resolve asset selections from the map_assets step (the new flow) — replaces
    // the upfront avatar/product/clothing/background selectors that were removed
    // from the CA schema. Falls back to config-level selections for backwards compat.
    const mapStep = allSteps.find((s) => s.id === "map_assets");
    const mapResult = mapStep?.result as { confirmations?: Record<string, string | null> } | undefined;
    const confirmations = mapResult?.confirmations || {};

    const collect = (catPrefix: "persons" | "outfits" | "products" | "locations"): string[] => {
      const ids: string[] = [];
      for (const [k, v] of Object.entries(confirmations)) {
        if (k.startsWith(catPrefix + ":") && v) ids.push(v);
      }
      return Array.from(new Set(ids));  // dedupe
    };

    const mappedAvatars = collect("persons");
    const mappedClothing = collect("outfits");
    const mappedProducts = collect("products");
    const mappedBackgrounds = collect("locations");

    // Ad-hoc background dataURL (subido en el step Mapeo de CA, no toca Brand Kit).
    // Vive solo durante el handoff. La tool destino lo lee de cfg.adHocBackgroundUrl
    // y lo manda como ref a Nano Banana.
    const mapStepData = mapStep?.result as Record<string, unknown> | undefined;
    const adHocBackgroundDataUrl = mapStepData?.adHocBackgroundDataUrl as string | undefined;

    const key = `handoff_${crypto.randomUUID()}`;
    sessionStorage.setItem(key, JSON.stringify({
      from: "content_analyzer",
      adaptData,
      analyzeData,
      contentMode: isVisualOnly ? "visual" : "voiceover",
      // Prefer map_assets confirmations; fall back to config (legacy path)
      selectedAvatarIds: mappedAvatars.length > 0 ? mappedAvatars : config.selectedAvatarIds,
      selectedProductIds: mappedProducts.length > 0 ? mappedProducts : config.selectedProductIds,
      selectedClothingIds: mappedClothing.length > 0 ? mappedClothing : config.selectedClothingIds,
      selectedAvatarId: mappedAvatars[0] || config.selectedAvatarId,
      selectedBackgroundId: mappedBackgrounds[0] || config.selectedBackgroundId,
      selectedProductId: mappedProducts[0] || config.selectedProductId,
      adHocBackgroundDataUrl,
    }));
    navigate(`/dashboard/generate/${targetToolId}?handoff=${key}`);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3 bg-surface-0 border border-edge rounded-[var(--radius-md)] p-4">
        <div className="w-8 h-8 rounded-full bg-[var(--color-action-muted)] flex items-center justify-center shrink-0">
          <Sparkles size={14} className="text-[var(--color-action)]" />
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
            <p className="text-[11px] text-[var(--color-action)] mt-1 font-medium">
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
                    ? "bg-[var(--color-action-muted)] border-[var(--color-action)]/50 hover:border-[var(--color-action)]"
                    : "bg-surface-1 border-edge hover:border-[var(--color-action)]/40 hover:bg-surface-2"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={isSuggested ? "text-[var(--color-action)]" : "text-fg-muted group-hover:text-fg"}>
                    {t.icon}
                  </span>
                  <span className="text-[13px] font-semibold text-fg">{t.label}</span>
                  {isSuggested && (
                    <span className="ml-auto text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--color-action)]/20 text-[var(--color-action)]">
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
  onInvalidateDownstream,
}: {
  allSteps: StepState[];
  curationSelections: Record<string, string>;
  onSelect: (sceneId: string, variationId: string) => void;
  audioCache: Record<string, { url: string; blob: Blob }>;
  config?: ToolConfig;
  onAudioCached: (sceneId: string, url: string, blob: Blob) => void;
  voiceId: string | null;
  onUpdateStepResult?: (stepId: string, result: unknown) => void;
  onInvalidateDownstream?: (stepId: string) => void;
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
    // scenes can be stored as either:
    //   - 2D array: [[{...}, {...}]]  (UGC creator — array of tone variants)
    //   - 1D array: [{...}, {...}]    (fashion_reel and others — flat scene list)
    let rawArr: Array<Record<string, string>> = [];
    const pickFirstSceneList = (v: unknown): Array<Record<string, string>> => {
      if (!Array.isArray(v)) return [];
      if (v.length > 0 && Array.isArray(v[0])) return v[0] as Array<Record<string, string>>;
      return v as Array<Record<string, string>>;
    };
    if (scriptResult.scenes) {
      rawArr = pickFirstSceneList(scriptResult.scenes);
    } else if (Array.isArray(scriptResult)) {
      rawArr = pickFirstSceneList(scriptResult);
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
  // Imagen ad-hoc subida por el usuario como ref extra para el image-to-image.
  // Ej. "una pose distinta" o "la prenda en mejor calidad". One-off — no toca el
  // Brand Kit. Data URL para no requerir endpoint backend. Se descarta al cerrar
  // el editor o al aplicar el cambio. Reportado: "que le puedas pasar una pose".
  const [editAdHocRefUrl, setEditAdHocRefUrl] = useState<string | null>(null);

  // Motion-inspire popover state — el usuario pasa URL o sube video para que
  // Gemini Vision infiera el motion y lo sugiera como animationHint del clip.
  // Reutiliza la infra de Content Analyzer (/api/analyze/motion). Por escena.
  const [motionInspireSceneId, setMotionInspireSceneId] = useState<string | null>(null);
  const [motionInspireUrl, setMotionInspireUrl] = useState("");
  const [motionInspireFile, setMotionInspireFile] = useState<File | null>(null);
  const [motionInspireLoading, setMotionInspireLoading] = useState(false);
  const [motionInspireError, setMotionInspireError] = useState<string | null>(null);
  // Curate state — qué escena está corriendo el "curar texto a inglés".
  const [curatingSceneId, setCuratingSceneId] = useState<string | null>(null);

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
      // Imagen ad-hoc (data URL) — viaja como ref adicional para que Nano Banana
      // use su contenido (ej. pose, prenda mejor calidad, ref visual extra).
      const adHocRefs = editAdHocRefUrl ? [editAdHocRefUrl] : [];
      const allRefs = [editingVar.url, ...productUrls, ...extraRefs, ...adHocRefs];
      // Si hay imagen ad-hoc, ENRIQUECEMOS el prompt para que Nano Banana sepa qué hacer
      // con ella — sin instrucción explícita tiende a ignorarla.
      const enrichedPrompt = editAdHocRefUrl
        ? `${editPrompt.trim()} Use the LAST reference image as a guide for pose, framing, or visual detail — apply that aspect to the subject in image 1.`
        : editPrompt.trim();
      const job = await createImageEdit(allRefs, enrichedPrompt);
      const result = await pollImageGen(job.request_id);
      if (result.image_url) {
        for (const scene of multishotData) {
          const v = scene.variations.find((v) => v.id === editVarId);
          if (v) { v.url = result.image_url; break; }
        }
        setEditingVar(null);
        setEditPrompt("");
        setEditAdHocRefUrl(null);  // limpieza tras aplicar
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
        // synclipsync deprecated — always false. Kept as a constant to avoid touching
        // downstream conditionals that depended on it.
        const isSyncLipsync = false;

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
                    : "bg-[var(--color-action-muted)] text-[var(--color-action)]"
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
              {scriptScene && scriptScene.script && (
                <p className="text-[12px] text-fg-muted mt-1 leading-relaxed">
                  &ldquo;{scriptScene.script}&rdquo;
                </p>
              )}

              {/* Instrucción de animación por escena — el usuario tipea acá cómo
                  quiere que se mueva ESTE clip específico antes de animar (ej.
                  "agarra la cartera con energía", "gira lento mirando a cámara").
                  Se inyecta al motionPrompt del handler de animate junto con el
                  motion del catálogo del shot. Persistido en script.scenes[i].animationHint. */}
              {(() => {
                const scriptStepData = allSteps.find((s) => s.id === "script")?.result as Record<string, unknown> | undefined;
                const scenes = (scriptStepData?.scenes as Array<{ id: string; animationHint?: string }>) || [];
                const sceneEntry = scenes.find((s) => s.id === scene.sceneId);
                const currentHint = sceneEntry?.animationHint || "";
                const updateHint = (hint: string) => {
                  if (!onUpdateStepResult || !scriptStepData) return;
                  const allScenes = (scriptStepData.scenes as Array<Record<string, unknown>>) || [];
                  const newScenes = allScenes.map((s) =>
                    (s.id === scene.sceneId) ? { ...s, animationHint: hint } : s,
                  );
                  onUpdateStepResult("script", { ...scriptStepData, scenes: newScenes });
                  // Invalidar steps downstream (incluido animate) — si ya estaban
                  // done con la versión vieja del hint, marcarlos como stale para
                  // que el usuario sepa que tiene que re-correr para aplicar el cambio.
                  onInvalidateDownstream?.("multishot");
                };
                const inspireOpen = motionInspireSceneId === scene.sceneId;
                const runInspire = async () => {
                  setMotionInspireError(null);
                  if (!motionInspireUrl.trim() && !motionInspireFile) {
                    setMotionInspireError("Pegá un link o subí un video");
                    return;
                  }
                  setMotionInspireLoading(true);
                  try {
                    const res = await analyzeMotionFromVideo({
                      url: motionInspireUrl.trim() || undefined,
                      file: motionInspireFile || undefined,
                      imageContext: scene.title,
                    });
                    if (res.motion) {
                      updateHint(res.motion);
                      setMotionInspireSceneId(null);
                      setMotionInspireUrl("");
                      setMotionInspireFile(null);
                    } else {
                      setMotionInspireError("Gemini no devolvió motion. Probá con otro video.");
                    }
                  } catch (e) {
                    setMotionInspireError(e instanceof Error ? e.message : "Falló el análisis");
                  } finally {
                    setMotionInspireLoading(false);
                  }
                };
                return (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-start gap-1.5">
                      <Wand2 size={11} className="text-fg-faint shrink-0 mt-1.5" />
                      <input
                        value={currentHint}
                        onChange={(e) => updateHint(e.target.value)}
                        placeholder="Animación de este clip (opcional) — ej: 'agarra la cartera con energía'"
                        className="flex-1 h-7 px-2 rounded-[var(--radius-sm)] border border-edge bg-surface-2 text-[11px] text-fg placeholder:text-fg-faint outline-none focus:border-[var(--color-edge-focus)]"
                      />
                      {/* Curar: agarra el texto del input (probablemente en español)
                          y lo manda a Gemini para que lo convierta en motion prompt
                          curado en inglés. Solo visible cuando hay texto que curar. */}
                      {currentHint.trim() && (
                        <button
                          type="button"
                          disabled={curatingSceneId === scene.sceneId}
                          onClick={async () => {
                            setCuratingSceneId(scene.sceneId);
                            try {
                              const res = await curateMotionPrompt(currentHint, scene.title);
                              if (res.motion) updateHint(res.motion);
                            } catch { /* silent — el texto original sigue ahí */ }
                            finally { setCuratingSceneId(null); }
                          }}
                          title="Pasar tu texto por Gemini — lo traduce a inglés y ordena para Kling"
                          className="h-7 px-2 rounded-[var(--radius-sm)] border text-[10px] font-medium transition-colors cursor-pointer flex items-center gap-1 shrink-0 border-edge bg-surface-2 text-fg-muted hover:text-fg hover:border-fg-muted disabled:opacity-50"
                        >
                          {curatingSceneId === scene.sceneId ? <Loader2 size={10} className="animate-spin" /> : <Wand2 size={10} />}
                          Curar
                        </button>
                      )}
                      {/* Botón chiquito para inspirar el motion desde un video ref */}
                      <button
                        type="button"
                        onClick={() => {
                          if (inspireOpen) {
                            setMotionInspireSceneId(null);
                          } else {
                            setMotionInspireSceneId(scene.sceneId);
                            setMotionInspireUrl("");
                            setMotionInspireFile(null);
                            setMotionInspireError(null);
                          }
                        }}
                        title="Inspirar motion desde un video de referencia (URL o subir)"
                        className={cn(
                          "h-7 px-2 rounded-[var(--radius-sm)] border text-[10px] font-medium transition-colors cursor-pointer flex items-center gap-1 shrink-0",
                          inspireOpen
                            ? "border-[var(--color-brand)] bg-[var(--color-brand-subtle)] text-[var(--color-brand)]"
                            : "border-edge bg-surface-2 text-fg-muted hover:text-fg hover:border-fg-muted",
                        )}
                      >
                        <Sparkles size={10} />
                        Inspirar
                      </button>
                    </div>
                    {inspireOpen && (
                      <div className="ml-4 p-2 rounded-[var(--radius-sm)] border border-[var(--color-brand-muted)] bg-[var(--color-brand-subtle)] space-y-1.5">
                        <p className="text-[10px] text-fg-muted leading-snug">
                          <strong>Video corto de 1 clip</strong> (~5-10s). Gemini analiza solo el motion y lo escribe arriba. Si el video es largo, te conviene cortarlo antes — esta tool anima UN clip por vez, no una secuencia.
                        </p>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="url"
                            value={motionInspireUrl}
                            onChange={(e) => setMotionInspireUrl(e.target.value)}
                            disabled={motionInspireLoading}
                            placeholder="https://www.instagram.com/reels/..."
                            className="flex-1 h-6 px-2 rounded-[var(--radius-sm)] border border-edge bg-surface-1 text-[10px] text-fg placeholder:text-fg-faint outline-none focus:border-[var(--color-brand)]"
                          />
                          <label className="h-6 px-2 rounded-[var(--radius-sm)] border border-edge bg-surface-1 text-[10px] text-fg-muted hover:text-fg cursor-pointer flex items-center gap-1 transition-colors">
                            <Plus size={10} />
                            {motionInspireFile ? "✓" : "Video o GIF"}
                            <input
                              type="file"
                              accept="video/*,image/gif"
                              className="hidden"
                              disabled={motionInspireLoading}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) setMotionInspireFile(f);
                                e.target.value = "";
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={runInspire}
                            disabled={motionInspireLoading || (!motionInspireUrl.trim() && !motionInspireFile)}
                            className={cn(
                              "h-6 px-2 rounded-[var(--radius-sm)] text-[10px] font-bold transition-colors flex items-center gap-1",
                              !motionInspireLoading && (motionInspireUrl.trim() || motionInspireFile)
                                ? "bg-[var(--color-brand)] text-[var(--color-brand-fg)] hover:brightness-105 cursor-pointer"
                                : "bg-surface-2 text-fg-faint cursor-not-allowed",
                            )}
                          >
                            {motionInspireLoading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                            {motionInspireLoading ? "..." : "Analizar"}
                          </button>
                        </div>
                        {motionInspireError && (
                          <p className="text-[10px] text-[var(--color-error)] flex items-center gap-1">
                            <AlertCircle size={9} /> {motionInspireError}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
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
                      <button
                        type="button"
                        onClick={() => downloadUrl(v.url, "scene1_base.jpg")}
                        className="flex items-center justify-center gap-1 py-1 rounded-[var(--radius-sm)] text-[10px] bg-surface-2 text-fg-muted hover:bg-surface-3 hover:text-fg transition-colors w-full cursor-pointer"
                        title="Download image"
                      >
                        <Download size={10} />
                        Download
                      </button>
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
                              ? "bg-[var(--color-action-muted)] text-[var(--color-action)]"
                              : "bg-surface-2 text-fg-muted hover:bg-surface-3 hover:text-fg"
                          )}
                        >
                          <Pencil size={10} />
                          {isEditing ? "Cancel" : "Edit"}
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadUrl(v.url, `scene${sceneIndex + 1}_${v.label.replace(/\s+/g, "_")}.jpg`)}
                          className="flex items-center justify-center px-2 py-1 rounded-[var(--radius-sm)] text-[10px] bg-surface-2 text-fg-muted hover:bg-surface-3 hover:text-fg transition-colors cursor-pointer"
                          title="Download image"
                        >
                          <Download size={10} />
                        </button>
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
                    className="text-[10px] px-2 py-0.5 bg-[var(--color-action-muted)] text-[var(--color-action)] rounded-full cursor-pointer hover:opacity-80"
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
                {/* Refs: Product del Brand Kit + Imagen ad-hoc one-off */}
                <div className="flex items-center gap-2 flex-wrap">
                  {productRefUrl && (
                    <button
                      onClick={() => {
                        const next = !editIncludeProduct;
                        setEditIncludeProduct(next);
                        // Auto-carga prompt de reemplazo cuando el usuario activa la
                        // ref si el input está vacío. Mensaje claro: "reemplazá el
                        // producto/prenda de la imagen actual por el de la ref".
                        // No pisa lo que el usuario haya escrito. Reportado: "al
                        // seleccionar una prenda debería ponerse un prompt que diga
                        // que reemplaza esa prenda por la de la imagen ref".
                        if (next && !editPrompt.trim()) {
                          setEditPrompt("Replace the product/garment in image 1 with the one shown in the product reference. Keep the model, pose, framing, lighting and background identical to image 1.");
                        }
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-sm)] text-[10px] font-medium transition-colors cursor-pointer border",
                        editIncludeProduct
                          ? "bg-[var(--color-brand-subtle)] text-[var(--color-brand)] border-[var(--color-brand)]"
                          : "bg-surface-1 text-fg-faint border-edge hover:text-fg"
                      )}
                      title={editIncludeProduct ? "Producto del Brand Kit incluido como ref — el prompt se autocompletó si estaba vacío" : "Sumar el producto del Brand Kit como ref (auto-prompt de reemplazo)"}
                    >
                      <img src={productRefUrl} alt="" className="w-4 h-4 rounded object-cover" />
                      {editIncludeProduct ? "Producto ref ✓" : "+ Producto del Kit"}
                    </button>
                  )}
                  {/* Imagen ad-hoc — one-off, no se guarda en Brand Kit. Sirve para
                      pasar pose ref, prenda en mejor calidad, ref visual extra. */}
                  {editAdHocRefUrl ? (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-sm)] text-[10px] font-medium border bg-[var(--color-brand-subtle)] text-[var(--color-brand)] border-[var(--color-brand)]">
                      <img src={editAdHocRefUrl} alt="" className="w-4 h-4 rounded object-cover" />
                      Ref ad-hoc ✓
                      <button
                        onClick={() => setEditAdHocRefUrl(null)}
                        title="Quitar"
                        className="ml-0.5 hover:text-fg cursor-pointer"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-sm)] text-[10px] font-medium border bg-surface-1 text-fg-faint border-edge hover:text-fg cursor-pointer transition-colors">
                      <Plus size={10} />
                      Subir imagen ref (pose, prenda…)
                      <input
                        type="file"
                        accept={IMAGE_ACCEPT}
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          const r = new FileReader();
                          r.onload = () => {
                            setEditAdHocRefUrl(r.result as string);
                            // Auto-prompt de reemplazo si el input está vacío.
                            // El nombre del archivo da pista (ej. "pose-front.jpg",
                            // "blue-jacket.png") para que Nano Banana sepa qué
                            // elemento reemplazar. No pisa lo que el usuario escribió.
                            if (!editPrompt.trim()) {
                              const fname = f.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ");
                              setEditPrompt(`Replace the relevant element (garment / pose / detail — context: "${fname}") in image 1 with the one shown in the LAST reference image. Keep the model identity, framing, lighting and background of image 1 identical.`);
                            }
                          };
                          r.readAsDataURL(f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>
                {/* Input row */}
                <div className="flex items-center gap-2">
                  <input
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    placeholder="Describí qué cambiar..."
                    className="flex-1 h-8 px-3 rounded-[var(--radius-sm)] border border-edge bg-surface-1 text-[12px] text-fg placeholder:text-fg-faint outline-none focus:border-[var(--color-action)]"
                    onKeyDown={(e) => e.key === "Enter" && handleEditImage()}
                    autoFocus
                  />
                  <button
                    onClick={handleEditImage}
                    disabled={editLoading || !editPrompt.trim()}
                    className={cn(
                      "px-3 py-1.5 text-[11px] font-medium rounded-[var(--radius-sm)] transition-colors",
                      !editLoading && editPrompt.trim()
                        ? "text-[var(--color-action-fg)] bg-[var(--color-action)] hover:opacity-90 cursor-pointer"
                        : "text-fg-faint bg-surface-1 cursor-not-allowed"
                    )}
                  >
                    {editLoading ? <Loader2 size={12} className="animate-spin" /> : "Apply"}
                  </button>
                  <button
                    onClick={() => { setEditingVar(null); setEditPrompt(""); setEditIncludeProduct(false); setEditAdHocRefUrl(null); }}
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
  brand: { label: "Brand", color: "text-[var(--color-action)] bg-[var(--color-action-muted)]" },
  social_proof: { label: "Social Proof", color: "text-success bg-success-muted" },
  educational: { label: "Educational", color: "text-fg-secondary bg-surface-2" },
  ugc: { label: "UGC Native", color: "text-warning bg-warning-muted" },
  comparison: { label: "Comparison", color: "text-error bg-error-muted" },
  promo: { label: "Promo", color: "text-fg bg-surface-3" },
  lifestyle: { label: "Lifestyle", color: "text-fg-secondary bg-surface-2" },
};

// ── Carousel Compose Editor (modo Compose) ─────────────────
// Renderiza un <ComposeOverlay/> por cada slide para que el usuario edite el texto
// y exporte PNG con la tipografía real del brand.
// ── Instagram Carousel Importer ───────────────────────────────
// Pastes an IG post URL, scrapes via Apify, and lets the user pick which slide
// to use as the visual template for the carousel. Auto-fetches the chosen slide
// as a data URL and hands it back to the parent via onUseAsTemplate.
function InstagramCarouselImporter({ onUseAsTemplate }: { onUseAsTemplate: (slideDataUrl: string) => void }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [post, setPost] = useState<{
    type: "carousel" | "image" | "video";
    thumbnail: string;
    slides: Array<{ url: string }>;
    username: string;
    caption: string;
    likesCount: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosenIdx, setChosenIdx] = useState<number>(0);
  const [importingSlide, setImportingSlide] = useState(false);

  const handleScrape = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setPost(null);
    try {
      const { scrapeInstagramPost } = await import("../lib/api");
      const res = await scrapeInstagramPost(url.trim());
      setPost(res);
      setChosenIdx(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo scrapear el post");
    } finally {
      setLoading(false);
    }
  };

  const handleUseSlide = async () => {
    if (!post || !post.slides[chosenIdx]) return;
    setImportingSlide(true);
    try {
      const slideUrl = post.slides[chosenIdx].url;
      // Backend serves IG images as /static/ig-imports/... → prepend the API host
      const fullUrl = slideUrl.startsWith("http") ? slideUrl : `http://127.0.0.1:8000${slideUrl}`;
      const res = await fetch(fullUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status} al descargar la imagen`);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = () => {
        onUseAsTemplate(reader.result as string);
        setImportingSlide(false);
      };
      reader.onerror = () => {
        setError("No se pudo leer la imagen");
        setImportingSlide(false);
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo descargar la imagen");
      setImportingSlide(false);
    }
  };

  return (
    <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-[12px] font-semibold text-fg-secondary">Importar de Instagram</label>
          <p className="text-[10px] text-fg-faint mt-0.5">Pegá un link de un post o carousel para usar uno de sus slides como template</p>
        </div>
        {post && <span className="text-[10px] text-[var(--color-success)] font-semibold uppercase tracking-wider">@{post.username}</span>}
      </div>

      <div className="flex gap-1.5">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.instagram.com/p/..."
          className="flex-1 bg-surface-2 border border-edge rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] text-fg outline-none focus:border-[var(--color-action)]"
          onKeyDown={(e) => { if (e.key === "Enter") handleScrape(); }}
        />
        <button
          onClick={handleScrape}
          disabled={loading || !url.trim()}
          className="px-3 py-1.5 text-[11px] font-semibold bg-surface-2 border border-edge text-fg-muted hover:text-fg hover:border-[var(--color-action)] rounded-[var(--radius-sm)] disabled:opacity-50 cursor-pointer flex items-center gap-1"
        >
          {loading ? <Loader2 size={11} className="animate-spin" /> : <span>↓</span>}
          {loading ? "Scrapeando..." : "Importar"}
        </button>
      </div>

      {error && (
        <div className="text-[10px] text-[var(--color-error)]">{error}</div>
      )}

      {post && post.slides.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-fg-faint uppercase tracking-wider">
              {post.type === "carousel" ? `${post.slides.length} slides` : post.type === "video" ? "Video post" : "Single image"}
            </span>
            <span className="text-[10px] text-fg-faint">♡ {post.likesCount.toLocaleString()}</span>
          </div>

          {/* Slides grid (clickable to choose) */}
          <div className="grid grid-cols-5 gap-1.5">
            {post.slides.map((s, i) => {
              const thumbUrl = s.url.startsWith("http") ? s.url : `http://127.0.0.1:8000${s.url}`;
              return (
                <button
                  key={i}
                  onClick={() => setChosenIdx(i)}
                  className={cn(
                    "relative aspect-square rounded-[var(--radius-sm)] overflow-hidden border-2 transition-all cursor-pointer",
                    chosenIdx === i ? "border-[var(--color-action)] ring-2 ring-[var(--color-action-muted)]" : "border-edge hover:border-edge-strong"
                  )}
                >
                  <img src={thumbUrl} alt={`slide ${i + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <div className="absolute top-1 left-1 bg-black/60 text-white text-[8px] font-bold px-1 py-0.5 rounded">
                    {i + 1}
                  </div>
                </button>
              );
            })}
          </div>

          {post.caption && (
            <details className="text-[10px] text-fg-muted">
              <summary className="cursor-pointer hover:text-fg">Caption original</summary>
              <p className="mt-1 italic leading-relaxed whitespace-pre-wrap">{post.caption.slice(0, 400)}{post.caption.length > 400 ? "..." : ""}</p>
            </details>
          )}

          <button
            onClick={handleUseSlide}
            disabled={importingSlide}
            className="w-full px-3 py-2 text-[11px] font-semibold bg-fg text-[var(--color-canvas)] rounded-[var(--radius-sm)] hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
          >
            {importingSlide ? <Loader2 size={11} className="animate-spin" /> : <span>→</span>}
            {importingSlide ? "Cargando..." : `Usar slide ${chosenIdx + 1} como template`}
          </button>
        </div>
      )}
    </div>
  );
}

function CarouselComposeEditor({
  slides,
  config,
}: {
  slides: Array<{ id: string; url: string; label: string; headline: string; body: string; role: string }>;
  config: ToolConfig;
  allSteps: StepState[];
}) {
  const { activeBrand } = useBrand();
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);

  if (!activeBrand) return null;
  const validSlides = slides.filter((s) => s.url);
  if (validSlides.length === 0) return null;
  const active = validSlides[activeSlideIdx] || validSlides[0];

  // Map aspect ratio to output dimensions
  const ratioMap: Record<string, [number, number]> = {
    "4:5": [1080, 1350],
    "9:16": [1080, 1920],
    "1:1": [1080, 1080],
    "16:9": [1920, 1080],
    "3:4": [1080, 1440],
  };
  const [outW, outH] = ratioMap[config.aspectRatio || "4:5"] || [1080, 1350];

  return (
    <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-4 space-y-3">
      <div>
        <h3 className="text-[12px] font-semibold text-fg-secondary">Compose Mode — Editor de overlay</h3>
        <p className="text-[10px] text-fg-faint mt-0.5">
          Cambiá el copy, elegí el template de overlay y exportá el PNG con la tipografía real del brand.
        </p>
      </div>

      {/* Slide selector */}
      {validSlides.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          {validSlides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setActiveSlideIdx(i)}
              className={cn(
                "px-2.5 py-1 rounded-[var(--radius-sm)] text-[10px] font-medium border transition-all cursor-pointer",
                activeSlideIdx === i
                  ? "border-[var(--color-action)] bg-[var(--color-action-muted)] text-fg"
                  : "border-edge bg-surface-2 text-fg-muted hover:text-fg"
              )}
            >
              Slide {i + 1}
            </button>
          ))}
        </div>
      )}

      <ComposeOverlay
        key={active.id}
        imageUrl={active.url}
        brand={activeBrand}
        initialFields={{
          eyebrow: active.role || "",
          headline: active.headline || "",
          subline: active.body || "",
        }}
        initialTemplateId={config.overlayTemplate || "editorial_bottom"}
        outputWidth={outW}
        outputHeight={outH}
      />
    </div>
  );
}

function TemplateSelector({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  const [templates, setTemplates] = useState<AdTemplate[]>([]);
  const [filterCat, setFilterCat] = useState<string>("all");

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/tools/static-ad/templates")
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
                  ? "border-[var(--color-action)] bg-[var(--color-action-muted)]"
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
    fetch("http://127.0.0.1:8000/api/tools/carousel-creator/types")
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
                  ? "border-[var(--color-action)] bg-[var(--color-action-muted)]"
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
                ? "bg-fg text-[var(--color-canvas)]"
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
                  className="flex-1 text-[9px] font-medium text-[var(--color-action-fg)] bg-[var(--color-action)] hover:opacity-90 rounded px-2 py-1 cursor-pointer"
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
                        ? "border-[var(--color-action)] bg-[var(--color-action-muted)] text-fg"
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
                          ? "border-[var(--color-action)]"
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
              className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium text-[var(--color-action-fg)] bg-[var(--color-action)] rounded-[var(--radius-sm)] hover:opacity-90 cursor-pointer disabled:opacity-40"
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
      lipsyncMethod: "heygen",
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
      lipsyncMethod: "heygen",
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
      {/* ── Presets bar ──────────────────────────────────────────
          ModelDropdown unificado con el resto. Antes era un grid 2×2/4-col de
          cards grandes que comía ~150px de altura. */}
      <ModelDropdown
        label="Preset"
        value={activePreset?.id || ""}
        onChange={(nextId) => {
          const next = UGC_PRESETS.find((p) => p.id === nextId);
          if (next) applyPreset(next);
        }}
        options={UGC_PRESETS.map((p) => ({
          id: p.id,
          label: `${p.emoji} ${p.name}`,
          sub: p.description,
        }))}
        placeholder="Custom — ajustá los campos abajo"
      />

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

        {/* Frame mode — Kling-only. Seedance reference-to-video no usa frame único
            ni interpolación entre escenas; siempre va con multi-ref. */}
        {config.ugcMode === "narrative" && config.animationEngine === "kling" && (
          <UGCField label="Escenas creativas">
            <SegToggle
              value={config.creativeMode === "frame-to-frame" ? "frame-to-frame" : "single-frame"}
              onChange={(v) => setConfig((p) => ({ ...p, creativeMode: v as ToolConfig["creativeMode"] }))}
              options={[
                { id: "single-frame", label: "Single Frame" },
                { id: "frame-to-frame", label: "Frame to Frame" },
              ]}
            />
            <FieldHint>
              {config.creativeMode === "frame-to-frame" ? "Kling interpola hacia la siguiente escena." : "Kling anima desde una imagen."}
            </FieldHint>
          </UGCField>
        )}
        {config.ugcMode === "narrative" && config.animationEngine === "seedance" && (
          <FieldHint>
            <strong className="text-fg">Seedance</strong> no usa frame-único ni interpolación — anima cada escena con multi-referencia. El selector de "Escenas creativas" no aplica.
          </FieldHint>
        )}
      </UGCSection>

      {/* ── Section: Dirección visual ────────────────────────── */}
      <UGCSection title="Dirección visual" subtitle="Estética y look del material">
        <UGCField label="Estilo visual">
          <select
            value={config.visualStyle}
            onChange={(e) => setConfig((p) => ({ ...p, visualStyle: e.target.value as ToolConfig["visualStyle"] }))}
            className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-edge bg-surface-1 text-[12px] text-fg outline-none focus:border-[var(--color-action)] cursor-pointer"
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
              className="w-full mt-2 px-3 py-2 rounded-[var(--radius-sm)] border border-edge bg-surface-1 text-[11px] text-fg placeholder:text-fg-faint outline-none focus:border-[var(--color-action)] resize-none"
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
            className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-edge bg-surface-1 text-[12px] text-fg outline-none focus:border-[var(--color-action)] cursor-pointer"
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
                  className="w-full bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2.5 py-2 text-[11px] text-fg placeholder:text-fg-faint focus:outline-none focus:border-[var(--color-action)] resize-none leading-relaxed"
                />
              </div>
            )}
          </UGCField>
        )}
      </UGCSection>

      {/* Motor de video (animación + lipsync) ahora vive arriba en Ajustes,
          consolidado en una sola sección. Antes había DOS selectores en lugares
          distintos (uno acá abajo, uno arriba) — confuso. */}
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
            value === o.id ? "bg-fg text-[var(--color-canvas)] shadow-sm" : "text-fg-faint hover:text-fg"
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
                        ? "border-[var(--color-action)] bg-[var(--color-action-muted)]"
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
              className="accent-[var(--color-action)]"
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
          className="absolute left-0 h-[3px] bg-[var(--color-action)] rounded-full pointer-events-none transition-[width] duration-100"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute w-3.5 h-3.5 rounded-full bg-[var(--color-action)] shadow-[0_0_0_3px_var(--color-action-muted)] pointer-events-none transition-[left] duration-100"
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


// ──────────────────────────────────────────────────────────────────
// Per-scene Background Picker — visual thumbnail popover
// ──────────────────────────────────────────────────────────────────

function ScenesBackgroundPicker({
  scene,
  backgrounds,
  globalBackgroundId,
}: {
  scene: { id: string; backgroundId?: string | null } & Record<string, unknown>;
  backgrounds: Array<{ id: string; name: string; description?: string; imageUrl?: string }>;
  globalBackgroundId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const setBg = (val: undefined | null | string) => {
    scene.backgroundId = val;
    force((x) => x + 1);
    setOpen(false);
  };

  const current = backgrounds.find((b) => b.id === scene.backgroundId);
  const globalBg = globalBackgroundId ? backgrounds.find((b) => b.id === globalBackgroundId) : undefined;
  const isInherit = scene.backgroundId === undefined;

  const currentLabel = scene.backgroundId === null
    ? "Sin fondo"
    : scene.backgroundId
    ? current?.name || "Desconocido"
    : globalBg
    ? `Global: ${globalBg.name}`
    : "Config global (sin fondo)";

  const currentThumb = scene.backgroundId && current?.imageUrl
    ? backgroundImageUrl(current.imageUrl)
    : isInherit && globalBg?.imageUrl
    ? backgroundImageUrl(globalBg.imageUrl)
    : null;

  const hint = scene.backgroundId === null
    ? "Nano Banana genera desde el prompt"
    : scene.backgroundId
    ? "Usa esta imagen como referencia visual"
    : globalBg
    ? "Hereda del ConfigPanel"
    : "ConfigPanel no tiene fondo — genera desde prompt";

  return (
    <div ref={ref} className="border-t border-edge bg-surface-1/40">
      {/* Row: current selection + toggle */}
      <div className="px-3 py-2 flex items-center gap-2 flex-wrap">
        <Mountain size={10} className="text-fg-faint" />
        <span className="text-[9px] font-semibold text-fg-faint uppercase tracking-wider">Fondo</span>

        <button
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-1.5 h-7 pl-1 pr-2 rounded-full border border-edge bg-surface-1 hover:border-edge-strong hover:bg-surface-2 transition-colors cursor-pointer"
        >
          {currentThumb ? (
            <div className="relative">
              <img src={currentThumb} alt={currentLabel} className={cn("w-5 h-5 rounded-full object-cover", isInherit && "ring-1 ring-[var(--color-action)] ring-offset-1 ring-offset-surface-1")} />
              {isInherit && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--color-action)] border border-surface-1" title="Heredado del ConfigPanel" />
              )}
            </div>
          ) : (
            <div className={cn(
              "w-5 h-5 rounded-full flex items-center justify-center",
              scene.backgroundId === null ? "bg-amber-500/20 text-amber-400" : "bg-surface-3 text-fg-faint"
            )}>
              {scene.backgroundId === null ? <X size={10} /> : <Settings2 size={9} />}
            </div>
          )}
          <span className="text-[10px] font-medium text-fg-muted max-w-[120px] truncate">{currentLabel}</span>
          <ChevronDown size={10} className={cn("text-fg-faint transition-transform", open && "rotate-180")} />
        </button>

        <span className="text-[9px] text-fg-faint italic ml-auto">{hint}</span>
      </div>

      {/* Expanded picker (inline, not absolute — avoids overflow clipping) */}
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-1 border-t border-edge-subtle bg-surface-0/50">
          <p className="text-[9px] font-semibold text-fg-faint uppercase tracking-wider py-1">Elegí un fondo</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setBg(undefined)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium transition-colors cursor-pointer border",
                scene.backgroundId === undefined
                  ? "bg-[var(--color-action-muted)] border-[var(--color-action)] text-fg"
                  : "border-edge bg-surface-1 text-fg-muted hover:border-edge-strong"
              )}
            >
              {globalBg?.imageUrl ? (
                <img src={backgroundImageUrl(globalBg.imageUrl)} alt={globalBg.name} className="w-4 h-4 rounded-full object-cover" />
              ) : (
                <Settings2 size={9} />
              )}
              {globalBg ? `Global: ${globalBg.name}` : "Config global"}
              {scene.backgroundId === undefined && <Check size={9} className="text-[var(--color-action-strong)]" />}
            </button>
            <button
              onClick={() => setBg(null)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium transition-colors cursor-pointer border",
                scene.backgroundId === null
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                  : "border-edge bg-surface-1 text-fg-muted hover:border-edge-strong"
              )}
            >
              <X size={9} />
              Sin fondo
              {scene.backgroundId === null && <Check size={9} />}
            </button>
          </div>

          {backgrounds.length > 0 && (
            <>
              <p className="text-[9px] font-semibold text-fg-faint uppercase tracking-wider pt-2">Assets de la marca</p>
              <div className="grid grid-cols-4 gap-1.5">
                {backgrounds.map((bg) => {
                  const isActive = scene.backgroundId === bg.id;
                  const thumb = bg.imageUrl ? backgroundImageUrl(bg.imageUrl) : null;
                  return (
                    <button
                      key={bg.id}
                      onClick={() => setBg(bg.id)}
                      title={bg.description || bg.name}
                      className={cn(
                        "relative rounded-[var(--radius-sm)] overflow-hidden border-2 transition-all cursor-pointer",
                        isActive ? "border-[var(--color-action)] ring-2 ring-[var(--color-action-muted)]" : "border-transparent hover:border-edge-strong"
                      )}
                    >
                      {thumb ? (
                        <img src={thumb} alt={bg.name} className="w-full aspect-[4/3] object-cover" />
                      ) : (
                        <div className="w-full aspect-[4/3] bg-surface-2 flex items-center justify-center">
                          <Mountain size={14} className="text-fg-faint" />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1 py-0.5">
                        <p className="text-[9px] font-medium text-white truncate text-left">{bg.name}</p>
                      </div>
                      {isActive && (
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[var(--color-action)] flex items-center justify-center">
                          <Check size={8} className="text-[var(--color-action-fg)]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Custom dropdown for the Map Assets step — shows thumbnail + name per option,
 * plus a "No usar / skip" entry. Replaces the native <select> which can't
 * render images.
 */
function AssetPickerDropdown({ options, value, onChange }: {
  options: Array<{ id: string; name: string; imageUrl?: string }>;
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const selected = options.find((o) => o.id === value);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="bg-surface-2 border border-edge rounded-[var(--radius-sm)] px-2 py-1 text-[12px] text-fg cursor-pointer min-w-[200px] flex items-center gap-2 hover:bg-surface-3"
      >
        {selected ? (
          <>
            {selected.imageUrl ? (
              <img src={selected.imageUrl} alt={selected.name} className="w-6 h-6 object-cover rounded-sm shrink-0" />
            ) : (
              <div className="w-6 h-6 bg-surface-3 rounded-sm shrink-0" />
            )}
            <span className="truncate flex-1 text-left">{selected.name}</span>
          </>
        ) : (
          <span className="text-fg-muted flex-1 text-left">— No usar / skip —</span>
        )}
        <ChevronDown size={12} className={cn("shrink-0 text-fg-faint transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 min-w-[260px] max-h-[320px] overflow-y-auto bg-surface-1 border border-edge rounded-[var(--radius-md)] shadow-lg p-1">
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-sm)] text-[12px] cursor-pointer",
              value === null ? "bg-[var(--color-action-subtle)] text-fg" : "text-fg-muted hover:bg-surface-2"
            )}
          >
            <div className="w-6 h-6 rounded-sm border border-dashed border-edge flex items-center justify-center shrink-0">
              <X size={10} className="text-fg-faint" />
            </div>
            <span className="flex-1 text-left">No usar / skip</span>
          </button>
          {options.length === 0 ? (
            <div className="text-[10px] text-fg-faint p-2">No hay assets en esta categoría.</div>
          ) : (
            options.map((o) => (
              <button
                key={o.id}
                onClick={() => { onChange(o.id); setOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-sm)] text-[12px] cursor-pointer",
                  value === o.id ? "bg-[var(--color-action-subtle)] text-fg" : "text-fg-muted hover:bg-surface-2"
                )}
              >
                {o.imageUrl ? (
                  <img src={o.imageUrl} alt={o.name} className="w-8 h-8 object-cover rounded-sm shrink-0" />
                ) : (
                  <div className="w-8 h-8 bg-surface-3 rounded-sm shrink-0" />
                )}
                <span className="truncate flex-1 text-left">{o.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/**
 * One detected-asset row in the Map Assets step: original description (with optional
 * override), scene tags, the brand-asset dropdown, role toggle (garments), and the
 * adjust/remove controls. Reused by every category and by the per-scene outfit grouping.
 */
function DetectedItemRow({
  item, cat, brandAssets, confirmedId, overrideText, isEditing, role, showScenes = true,
  onChoice, onToggleRole, onSetOverride, onStartEdit, onStopEdit, onRemove,
}: {
  item: { detected_id: string; description: string; scenes: number[]; suggested_brand_id: string | null; confidence: number; reason: string };
  cat: "persons" | "outfits" | "products" | "locations";
  brandAssets: Array<{ id: string; name: string; description?: string; imageUrl?: string }>;
  confirmedId: string | null;
  overrideText?: string;
  isEditing: boolean;
  role: "hero" | "wardrobe";
  showScenes?: boolean;
  onChoice: (id: string | null) => void;
  onToggleRole: () => void;
  onSetOverride: (text: string) => void;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onRemove: () => void;
}) {
  const isManual = item.detected_id.startsWith("manual_");
  const confidencePct = Math.round((item.confidence || 0) * 100);
  return (
    <div className="bg-surface-1 rounded-[var(--radius-sm)] p-2.5 space-y-1.5 relative">
      {isManual && (
        <span className="absolute top-1.5 right-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--color-action-subtle)] text-[var(--color-action)] uppercase tracking-wider">
          manual
        </span>
      )}
      <p className={cn("text-[12px] leading-snug pr-12", overrideText ? "text-fg-faint line-through decoration-1" : "text-fg-muted")}>
        {item.description}
      </p>
      {overrideText && !isEditing && (
        <p className="text-[12px] text-blue-300 leading-snug flex items-start gap-1.5 pr-12">
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 uppercase tracking-wider shrink-0 mt-0.5">cambiado</span>
          <span>{overrideText}</span>
        </p>
      )}
      {isEditing && (
        <div className="space-y-1.5">
          <textarea
            defaultValue={overrideText || item.description}
            rows={2}
            autoFocus
            placeholder="Describí cómo querés que sea en TU versión (ej: 'mujer con vestido largo' / 'playa soleada de día')"
            className="w-full text-[12px] text-fg bg-surface-2 border border-[var(--color-edge-focus)] rounded-[var(--radius-sm)] px-2 py-1.5 outline-none resize-none"
            onBlur={(e) => { onSetOverride(e.target.value); onStopEdit(); }}
            onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); onStopEdit(); } }}
          />
          <p className="text-[9px] text-fg-faint">Enter/click afuera para guardar · Esc para cancelar</p>
        </div>
      )}
      {showScenes && item.scenes?.length > 0 && (
        <p className="text-[10px] text-fg-faint">Escenas: {item.scenes.join(", ")}</p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <AssetPickerDropdown options={brandAssets} value={confirmedId} onChange={onChoice} />
        {(cat === "outfits" || cat === "products") && (
          <button
            onClick={onToggleRole}
            title={role === "hero" ? "Esta prenda es el PRODUCTO QUE VENDÉS en este contenido — recibe close-ups y el foco. Click para marcarla como 'solo la usa'." : "La modelo solo la USA para el look, no es el foco de venta. Click para marcarla como 'producto a vender'."}
            className={cn(
              "text-[10px] px-2 py-0.5 rounded-full cursor-pointer flex items-center gap-1 font-medium transition-colors",
              role === "hero" ? "bg-[var(--color-action)]/15 text-[var(--color-action)] hover:bg-[var(--color-action)]/25" : "bg-surface-2 text-fg-muted hover:text-fg hover:bg-surface-3",
            )}
          >
            {role === "hero" ? "🎯 Producto a vender" : "👕 Solo la usa"}
          </button>
        )}
        {!isEditing && (
          <button
            onClick={onStartEdit}
            className="text-[10px] px-2 py-0.5 rounded-full bg-surface-2 text-fg-muted hover:text-fg hover:bg-surface-3 cursor-pointer flex items-center gap-1"
          >
            <Pencil size={9} /> {overrideText ? "Editar cambio" : "Ajustar"}
          </button>
        )}
        {overrideText && !isEditing && (
          <button onClick={() => onSetOverride("")} className="text-[10px] text-fg-faint hover:text-error cursor-pointer flex items-center gap-1">
            <X size={9} /> Quitar cambio
          </button>
        )}
        {!isManual && item.suggested_brand_id && confirmedId === item.suggested_brand_id && (
          <span className={cn(
            "text-[10px] px-2 py-0.5 rounded-full",
            confidencePct >= 75 ? "bg-success-muted text-success" : confidencePct >= 50 ? "bg-warning-muted text-warning" : "bg-surface-2 text-fg-faint",
          )}>
            sugerido · {confidencePct}%
          </span>
        )}
        {!isManual && item.reason && !overrideText && (
          <span className="text-[10px] text-fg-faint italic">{item.reason}</span>
        )}
        {isManual && (
          <button onClick={onRemove} className="text-[10px] text-fg-faint hover:text-error cursor-pointer flex items-center gap-1">
            <X size={10} /> Quitar
          </button>
        )}
      </div>
    </div>
  );
}

/** Slug for filenames: lowercased, accent-stripped, dashes, capped. */
function slugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Etiqueta corta para una tanda — categoriza los shots elegidos (on-model vs flat)
 *  y trae la cuenta de outputs exitosos. Pensado para que un usuario que ve la pila
 *  de tandas entienda de un vistazo qué es cada una sin tener que abrirla. */
function describeBatch(toolId: string, shotIds: string[], count: number): string {
  if (toolId === "ecommerce_pack") {
    const onModelShots = shotIds.filter((s) => SHOT_CATALOG[s]?.onModel);
    const flatShots = shotIds.filter((s) => SHOT_CATALOG[s] && !SHOT_CATALOG[s].onModel);
    const parts: string[] = [];
    if (onModelShots.length) parts.push(`On-model ${onModelShots.map((s) => SHOT_CATALOG[s].label.split(" ").slice(-1)[0]).join("/")}`);
    if (flatShots.length) parts.push(`Flats ${flatShots.map((s) => SHOT_CATALOG[s].label.split(" ").slice(-1)[0]).join("/")}`);
    const head = parts.join(" + ") || "Tanda";
    return `${head} · ${count} imagen${count === 1 ? "" : "es"}`;
  }
  return `Tanda · ${count} imagen${count === 1 ? "" : "es"}`;
}

/** Tiempo relativo en español ("ahora", "hace 3 min", "hace 1 h"). Más liviano
 *  que sumar dayjs/date-fns para un solo lugar de uso. */
function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 30) return "ahora";
  if (s < 90) return "hace 1 min";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 7200) return "hace 1 h";
  return `hace ${Math.floor(s / 3600)} h`;
}

/** Download a media URL with the given filename, via the backend proxy so it always
 *  saves (never opens a new tab). See lib/download.ts. */
async function downloadMediaAs(url: string, filename: string): Promise<void> {
  downloadFile(url, filename);
}

/**
 * Compact single-image reference uploader (thumbnail + inline upload zone). Used for the
 * Look & Feel and Pose slots so they sit half-width in a grid instead of full-width cards.
 */
function CompactRefCard({ title, hint, files, accept = "image/*", onAdd, onRemove }: {
  title: string;
  hint: string;
  files: File[];
  accept?: string;
  onAdd: (f: File) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[11px] font-semibold text-fg-secondary">{title}</label>
        <span className="text-[10px] text-fg-faint shrink-0">{files.length || 0}</span>
      </div>
      <p className="text-[10px] text-fg-faint leading-snug">{hint}</p>
      <div className="flex items-center gap-2 flex-wrap">
        {files.map((file, i) => (
          <div key={i} className="relative w-11 h-11 rounded-[var(--radius-sm)] overflow-hidden border border-edge group shrink-0">
            <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-full object-cover" />
            <button
              onClick={() => onRemove(i)}
              className="absolute top-0 right-0 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <span className="text-white text-[8px]">×</span>
            </button>
          </div>
        ))}
        <label className="flex-1 min-w-[90px] flex items-center justify-center gap-1.5 py-2 border border-dashed rounded-[var(--radius-sm)] cursor-pointer text-[10px] transition-all border-edge hover:border-[var(--color-edge-strong)] hover:bg-surface-2 text-fg-muted hover:text-fg">
          <Plus size={11} /> Subir
          <input
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onAdd(f); e.target.value = ""; }}
          />
        </label>
      </div>
    </div>
  );
}

/**
 * "+ Agregar manualmente" button for the Map Assets step. Opens a popover with
 * the brand-kit options for the given category and inserts a synthetic detected
 * entry pre-linked to the chosen asset.
 */
function AddManualButton({ brandAssets, onAdd }: {
  brandAssets: Array<{ id: string; name: string; imageUrl?: string }>;
  onAdd: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] text-fg-muted hover:text-fg cursor-pointer px-2.5 py-1 rounded-full border border-dashed border-edge hover:border-edge-strong w-full justify-center"
      >
        <Plus size={11} /> Agregar manualmente
      </button>
      {open && (
        <div className="absolute z-50 mt-1 min-w-[260px] max-h-[280px] overflow-y-auto bg-surface-1 border border-edge rounded-[var(--radius-md)] shadow-lg p-1">
          {brandAssets.length === 0 ? (
            <div className="text-[10px] text-fg-faint p-2">Nada en esta categoría del brand kit.</div>
          ) : (
            brandAssets.map((b) => (
              <button
                key={b.id}
                onClick={() => { onAdd(b.id); setOpen(false); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-sm)] text-[12px] cursor-pointer text-fg-muted hover:bg-surface-2 hover:text-fg"
              >
                {b.imageUrl ? (
                  <img src={b.imageUrl} alt={b.name} className="w-8 h-8 object-cover rounded-sm shrink-0" />
                ) : (
                  <div className="w-8 h-8 bg-surface-3 rounded-sm shrink-0" />
                )}
                <span className="truncate flex-1 text-left">{b.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── AnimationHintBar ──────────────────────────────────────────────
//
// Componente compartido para "instrucción de animación por clip antes de animar".
// Usado en:
//   • CurationPanel (Fashion Reel) — por escena del multishot
//   • DoneStep step "images" (Video Ad Creator, Product Clip) — por frame
// Toda tool con step animate puede inyectar este bar al lado de cada frame/escena.
// Provee: input texto libre + botón Curar (Gemini ES→EN) + botón Inspirar (video/GIF
// ref → Gemini saca motion). El callback `onChange(hint)` persiste el valor donde
// el handler de animate lo va a leer (típico: script.frames[i].animationHint).

function AnimationHintBar({
  value,
  onChange,
  sceneContext,
  compact = false,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Contexto opcional para que Gemini cure/inspire mejor. Ej: título de la escena. */
  sceneContext?: string;
  /** Compact = inputs más chicos para frame thumbnails (Video Ad). */
  compact?: boolean;
}) {
  const [inspireOpen, setInspireOpen] = useState(false);
  const [inspireUrl, setInspireUrl] = useState("");
  const [inspireFile, setInspireFile] = useState<File | null>(null);
  const [inspireLoading, setInspireLoading] = useState(false);
  const [inspireError, setInspireError] = useState<string | null>(null);
  const [curating, setCurating] = useState(false);

  const runInspire = async () => {
    setInspireError(null);
    if (!inspireUrl.trim() && !inspireFile) {
      setInspireError("Pegá un link o subí un video/GIF");
      return;
    }
    setInspireLoading(true);
    try {
      const res = await analyzeMotionFromVideo({
        url: inspireUrl.trim() || undefined,
        file: inspireFile || undefined,
        imageContext: sceneContext,
      });
      if (res.motion) {
        onChange(res.motion);
        setInspireOpen(false);
        setInspireUrl("");
        setInspireFile(null);
      } else {
        setInspireError("Gemini no devolvió motion. Probá con otro video.");
      }
    } catch (e) {
      setInspireError(e instanceof Error ? e.message : "Falló el análisis");
    } finally {
      setInspireLoading(false);
    }
  };

  const runCurate = async () => {
    if (!value.trim()) return;
    setCurating(true);
    try {
      const res = await curateMotionPrompt(value, sceneContext || "");
      if (res.motion) onChange(res.motion);
    } catch { /* silent */ }
    finally { setCurating(false); }
  };

  const inputH = compact ? "h-6" : "h-7";
  const textSize = compact ? "text-[10px]" : "text-[11px]";

  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-1.5">
        <Wand2 size={11} className="text-fg-faint shrink-0 mt-1.5" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Animación de este clip (opcional) — ej: 'agarra la cartera con energía'"
          className={cn(
            "flex-1 px-2 rounded-[var(--radius-sm)] border border-edge bg-surface-2 text-fg placeholder:text-fg-faint outline-none focus:border-[var(--color-edge-focus)]",
            inputH, textSize,
          )}
        />
        {value.trim() && (
          <button
            type="button"
            disabled={curating}
            onClick={runCurate}
            title="Pasar tu texto por Gemini — lo traduce a inglés y ordena para Kling"
            className={cn(
              "px-2 rounded-[var(--radius-sm)] border text-[10px] font-medium cursor-pointer flex items-center gap-1 shrink-0 border-edge bg-surface-2 text-fg-muted hover:text-fg hover:border-fg-muted disabled:opacity-50",
              inputH,
            )}
          >
            {curating ? <Loader2 size={10} className="animate-spin" /> : <Wand2 size={10} />}
            Curar
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (inspireOpen) {
              setInspireOpen(false);
            } else {
              setInspireOpen(true);
              setInspireUrl("");
              setInspireFile(null);
              setInspireError(null);
            }
          }}
          title="Inspirar motion desde un video/GIF de referencia"
          className={cn(
            "px-2 rounded-[var(--radius-sm)] border text-[10px] font-medium transition-colors cursor-pointer flex items-center gap-1 shrink-0",
            inspireOpen
              ? "border-[var(--color-brand)] bg-[var(--color-brand-subtle)] text-[var(--color-brand)]"
              : "border-edge bg-surface-2 text-fg-muted hover:text-fg hover:border-fg-muted",
            inputH,
          )}
        >
          <Sparkles size={10} />
          Inspirar
        </button>
      </div>
      {inspireOpen && (
        <div className="ml-4 p-2 rounded-[var(--radius-sm)] border border-[var(--color-brand-muted)] bg-[var(--color-brand-subtle)] space-y-1.5">
          <p className="text-[10px] text-fg-muted leading-snug">
            <strong>Video corto o GIF de 1 clip</strong> (~5-10s). Gemini analiza solo el motion y lo escribe arriba. Esta tool anima UN clip por vez — si tu video es largo, cortalo antes.
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
              onClick={runInspire}
              disabled={inspireLoading || (!inspireUrl.trim() && !inspireFile)}
              className={cn(
                "h-6 px-2 rounded-[var(--radius-sm)] text-[10px] font-bold transition-colors flex items-center gap-1",
                !inspireLoading && (inspireUrl.trim() || inspireFile)
                  ? "bg-[var(--color-brand)] text-[var(--color-brand-fg)] hover:brightness-105 cursor-pointer"
                  : "bg-surface-2 text-fg-faint cursor-not-allowed",
              )}
            >
              {inspireLoading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
              {inspireLoading ? "..." : "Analizar"}
            </button>
          </div>
          {inspireError && (
            <p className="text-[10px] text-[var(--color-error)] flex items-center gap-1">
              <AlertCircle size={9} /> {inspireError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
