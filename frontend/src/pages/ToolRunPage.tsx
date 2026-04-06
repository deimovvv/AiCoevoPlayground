import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router";
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
} from "lucide-react";
import { useBrand } from "../lib/BrandContext";
import {
  avatarImageUrl, productImageUrl, clothingImageUrl, backgroundImageUrl,
  type Brand,
  generateCopy, generateTTS, generateTTSAndUpload, createImageEdit, pollImageGen,
  createFalLipSync, pollFalLipSync, concatVideos, saveGeneration,
  generateToolPrompt, createKlingVideo, pollKlingVideo,
  uploadAvatar, uploadClothing, uploadBackground,
  createHeyGenAvatar4, pollHeyGenAvatar4,
  fetchSystemVoices,
} from "../lib/api";
import { cn } from "../lib/utils";
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
    description: "Generate the script/copy using AI",
  },
  base_image: {
    label: "Base Image",
    icon: <ImageIcon size={15} />,
    description: "Generate and approve the hero image for scene 1",
  },
  multishot: {
    label: "Multishot",
    icon: <Camera size={15} />,
    description: "Generate variations for all scenes from approved base",
  },
  images: {
    label: "Images",
    icon: <ImageIcon size={15} />,
    description: "Generate image variations for each scene",
  },
  image: {
    label: "Image",
    icon: <ImageIcon size={15} />,
    description: "Generate the visual creative",
  },
  curation: {
    label: "Curation",
    icon: <Eye size={15} />,
    description: "Select and reorder the best shots for your video",
  },
  voice: {
    label: "Voice",
    icon: <Mic size={15} />,
    description: "Generate voiceover with text-to-speech",
  },
  lipsync: {
    label: "Lip-Sync",
    icon: <Video size={15} />,
    description: "Animate the image with lip-sync",
  },
  subtitles: {
    label: "Subtitles",
    icon: <Type size={15} />,
    description: "Auto-generate subtitles overlay",
  },
  render: {
    label: "Render",
    icon: <Film size={15} />,
    description: "Combine all elements into final output",
  },
  prompt: {
    label: "Prompt",
    icon: <Wand2 size={15} />,
    description: "Generate image prompts from brand context",
  },
  generate: {
    label: "Generate",
    icon: <Sparkles size={15} />,
    description: "Run the AI generation",
  },
  copy: {
    label: "Copy",
    icon: <Type size={15} />,
    description: "Generate ad copy and headlines",
  },
  compose: {
    label: "Compose",
    icon: <Palette size={15} />,
    description: "Compose the final ad creative",
  },
  caption: {
    label: "Caption",
    icon: <Type size={15} />,
    description: "Generate social media caption",
  },
  scenes: {
    label: "Scenes",
    icon: <ListChecks size={15} />,
    description: "Generate scene descriptions",
  },
  music: {
    label: "Music",
    icon: <Mic size={15} />,
    description: "Select music mood and track",
  },
  remove: {
    label: "Remove BG",
    icon: <Scissors size={15} />,
    description: "AI background removal",
  },
  variations: {
    label: "Variations",
    icon: <Camera size={15} />,
    description: "Generate multiple variations for selection",
  },
  animate: {
    label: "Animate",
    icon: <Video size={15} />,
    description: "Animate frames with Kling for smooth transitions",
  },
  visual_guide: {
    label: "Visual Guide",
    icon: <Palette size={15} />,
    description: "Analyze reference images to extract brand visual style",
  },
  prompts: {
    label: "Prompts",
    icon: <Wand2 size={15} />,
    description: "Generate creative prompts from visual guide + product",
  },
  generate_batch: {
    label: "Generate",
    icon: <Sparkles size={15} />,
    description: "Generate all ad creatives from prompts",
  },
  review: {
    label: "Review",
    icon: <Eye size={15} />,
    description: "Review, edit, and iterate on generated creatives",
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

type StepStatus = "pending" | "active" | "running" | "review" | "done" | "error";

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
  resolution: "1K",
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
  ugc_creator: { id: "ugc_creator", name: "UGC Creator", category: "video", description: "Create complete UGC videos: script, base image, multishot variations, voice, lip-sync, subtitles.", icon: "video", status: "active", pipeline: ["script", "base_image", "multishot", "curation", "voice", "lipsync", "subtitles", "render"] },
  photo_multishot: { id: "photo_multishot", name: "Product Photos", category: "images", description: "Generate multiple creative product photo variations from a base image.", icon: "camera", status: "active", pipeline: ["prompt", "generate"] },
  ad_creative: { id: "ad_creative", name: "Ad Creative", category: "images", description: "Generate ad creatives with copy, images, and brand composition.", icon: "megaphone", status: "active", pipeline: ["copy", "image", "compose"] },
  social_post: { id: "social_post", name: "Social Post", category: "copy", description: "Generate captions and images for social media posts.", icon: "share", status: "active", pipeline: ["caption", "image"] },
  reel_creator: { id: "reel_creator", name: "Reel Creator", category: "video", description: "Create short-form video reels with scenes, music, and subtitles.", icon: "film", status: "coming_soon", pipeline: ["script", "scenes", "music", "subtitles", "render"] },
  bg_remover: { id: "bg_remover", name: "Background Remover", category: "images", description: "Remove background from product photos using AI segmentation.", icon: "eraser", status: "coming_soon", pipeline: ["remove"] },
};

// ── Page Component ─────────────────────────────────────────

export function ToolRunPage() {
  const { toolId } = useParams();
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

  // Tool-specific config defaults
  useEffect(() => {
    if (!tool) return;
    if (tool.id === "carousel_creator" || tool.id === "static_ad") {
      setConfig((prev) => ({ ...prev, aspectRatio: "4:5" }));
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
        <div className="text-center py-16 text-fg-muted">Tool not found</div>
      </div>
    );
  }

  const handleStart = () => {
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

    // If it's the curation step, build the result from manual selections
    if (currentStep.id === "curation") {
      const multishotData = getStepResult("multishot") as Array<{
        sceneId: string; title: string;
        variations: Array<{ id: string; url: string; label: string }>;
      }> | undefined;

      if (multishotData) {
        const curationResult = multishotData.map((scene) => {
          const selectedId = curationSelections[scene.sceneId] || scene.variations[0]?.id;
          const selectedVar = scene.variations.find((v) => v.id === selectedId) || scene.variations[0];
          return {
            sceneId: scene.sceneId,
            title: scene.title,
            selectedId: selectedVar?.id || "",
            selectedUrl: selectedVar?.url || "",
          };
        });

        setSteps((prev) =>
          prev.map((s, i) => {
            if (i === stepIndex) return { ...s, status: "done", result: curationResult };
            if (i === stepIndex + 1) return { ...s, status: "active" };
            return s;
          })
        );
        if (stepIndex < steps.length - 1) {
          setActiveStep(stepIndex + 1);
          // Auto-run voice (generates missing audio) then lipsync
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
  const getScriptScenes = (): Array<{ id: string; title: string; script: string; image_prompt: string }> => {
    const scriptResult = getStepResult("script") as Record<string, unknown> | undefined;
    if (!scriptResult) return [];

    let rawScenes: Array<Record<string, string>> = [];
    if (scriptResult.scenes) {
      const arr = scriptResult.scenes as Array<Array<Record<string, string>>>;
      rawScenes = arr[0] || [];
    } else if (Array.isArray(scriptResult)) {
      rawScenes = (scriptResult as Array<Array<Record<string, string>>>)[0] || [];
    }

    console.log("[getScriptScenes] rawScenes count:", rawScenes.length, "scriptResult keys:", Object.keys(scriptResult));
    if (rawScenes.length > 0) {
      console.log("[getScriptScenes] first scene ALL keys:", Object.keys(rawScenes[0]), "FULL:", JSON.stringify(rawScenes[0]));
    } else {
      console.log("[getScriptScenes] NO rawScenes found. Full result:", JSON.stringify(scriptResult).slice(0, 500));
    }

    // Normalize: Gemini returns wildly inconsistent field names across runs
    return rawScenes.map((s, i) => {
      // Script: try every possible field name Gemini might use
      let scriptText = s.script || s.speech || s.copy || s.text || s.audio || s.dialogue
        || s.narration || s.voiceover || s.action || s.spoken || s.line || s.lines || "";
      // Clean prefixes like "AVATAR:", "OFF-CAMERA (sigh):", etc.
      scriptText = scriptText.replace(/^(AVATAR|OFF[- ]?CAMERA|ON[- ]?CAMERA|NARRATOR|SPEAKER)\s*(\([^)]*\)\s*)?:\s*/i, "").trim();

      // Image prompt: try every possible field name
      const imagePrompt = s.image_prompt || s.visuals || s.visual || s.visual_prompt
        || s.scene_description || s.setting || s.background || s.scene || "";

      // Don't use numeric-only values as image_prompt (e.g. scene: 1)
      const finalImagePrompt = imagePrompt && isNaN(Number(imagePrompt)) ? imagePrompt : "";

      return {
        id: s.id || s.scene_number || `act_${i + 1}`,
        title: s.title || s.act || `Scene ${i + 1}`,
        script: scriptText,
        image_prompt: finalImagePrompt,
      };
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
        console.log("[base_image] scenes:", scenes.length, "firstScene:", JSON.stringify(firstScene).slice(0, 300));
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

        // Generate audio for Scene 1 in parallel so it's ready for test video
        const voiceId = config.selectedVoiceId || activeBrand.voicePresets?.[0]?.id;
        if (firstScene.script && voiceId) {
          try {
            const ttsResult = await generateTTS({ text: firstScene.script, voice_id: voiceId });
            setAudioCache((p) => ({ ...p, [firstScene.id]: { url: ttsResult.audioUrl, blob: ttsResult.audioBlob } }));
          } catch { /* non-blocking */ }
        }

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

        const baseImageResult = getStepResult("base_image") as { url: string } | undefined;
        if (!baseImageResult?.url) throw new Error("Base image not found.");

        const referenceUrls: string[] = [baseImageResult.url];
        const NUM_VARIATIONS = 2;

        const multishotResults: Array<{
          sceneId: string; title: string;
          variations: Array<{ id: string; url: string; label: string; prompt: string }>;
        }> = [];

        // Scene 1: use base image directly — no variations needed
        multishotResults.push({
          sceneId: scenes[0].id,
          title: scenes[0].title,
          variations: [{ id: `${scenes[0].id}_v1`, url: baseImageResult.url, label: "Base image", prompt: "" }],
        });

        // Scenes 2+: different camera angles of the same person in the same space
        // Same person, clothes, product, lighting — but camera moves around them
        const MOMENTS = [
          {
            label: "Tight close-up",
            desc: "Same person, same clothes, same product as image 1. Tight close-up from a different angle, face fills frame, leaning slightly forward gesturing mid-sentence. Shot on 50mm f/1.4, very shallow depth of field, natural skin texture. Eyes locked on camera.",
          },
          {
            label: "Medium wide",
            desc: "Same person, same clothes, same product as image 1. Camera pulled back to medium-wide, showing full torso and surroundings from a wider perspective. Shot on 35mm f/1.8, relaxed posture, one hand on product. Off-center framing, eye contact.",
          },
          {
            label: "Low angle",
            desc: "Same person, same clothes, same product as image 1. Camera positioned lower, looking slightly up at the subject. Shot on 24mm f/2.0, product held up to camera, confident expression. The background shifts naturally with the low perspective.",
          },
          {
            label: "Product focus",
            desc: "Same person as image 1, slightly blurred in background. Product in sharp focus in foreground, held toward camera at arm's length. Shot on 85mm f/1.8, extreme shallow depth of field, realistic texture detail on the product.",
          },
          {
            label: "Side angle",
            desc: "Same person, same clothes, same product as image 1. Camera moved to the side, subject's body angled but head turned with eyes on camera. Shot on 35mm f/2.0, rule of thirds composition, product at chest level. Background seen from a new angle.",
          },
          {
            label: "Over shoulder",
            desc: "Same person, same clothes, same product as image 1. Camera behind and over one shoulder, subject looking back at camera with a genuine expression, product visible in hands. Shot on 28mm f/2.8, handheld feel, wider view of the space.",
          },
        ];

        const remainingScenes = scenes.slice(1);
        const remainingResults = await Promise.all(
          remainingScenes.map(async (scene, sceneIdx) => {
            const variations = await Promise.all(
              Array.from({ length: NUM_VARIATIONS }, async (_, vi) => {
                const momentIdx = (sceneIdx * NUM_VARIATIONS + vi) % MOMENTS.length;
                const moment = MOMENTS[momentIdx];
                const prompt = `${moment.desc}. Natural lighting, 9:16 vertical, ultra-realistic.`;
                const job = await createImageEdit(referenceUrls, prompt, config.aspectRatio, config.resolution);
                const result = await pollImageGen(job.request_id);
                return {
                  id: `${scene.id}_v${vi + 1}`,
                  url: result.image_url || "",
                  label: moment.label,
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

        // Generate ALL missing audio first
        const generatedAudios: Record<string, { url: string; blob: Blob }> = { ...audioCacheRef.current };
        for (const scene of scenes) {
          if (!generatedAudios[scene.id]) {
            console.log(`[voice] Generating TTS for ${scene.id} with voice ${voiceId}`);
            const ttsResult = await generateTTS({ text: scene.script, voice_id: voiceId });
            generatedAudios[scene.id] = { url: ttsResult.audioUrl, blob: ttsResult.audioBlob };
            setAudioCache((p) => ({ ...p, [scene.id]: generatedAudios[scene.id] }));
          }
        }

        advanceStep(stepIndex, { generated: true, audioKeys: Object.keys(generatedAudios) });
        // Auto-chain to lipsync
        setTimeout(() => handleRunStep(stepIndex + 1), 200);
      } catch (err) {
        failStep(stepIndex, err instanceof Error ? err.message : "Voice generation failed");
      }
      return;
    }

    // ── Lip-sync — HeyGen Avatar 4 via Fal ──
    if (step.id === "lipsync") {
      setStepRunning(stepIndex);
      try {
        const curationData = getStepResult("curation") as Array<{
          sceneId: string; title: string; selectedUrl: string;
        }> | undefined;

        if (!curationData) throw new Error("No curated images found. Complete the Curation step first.");

        const scenes = getScriptScenes();
        const voiceId = config.selectedVoiceId || activeBrand.voicePresets?.[0]?.id;

        const heygenAR = config.aspectRatio === "4:5" ? "9:16" : config.aspectRatio;
        const heygenRes = config.resolution === "4K" || config.resolution === "2K" ? "1080p" : "720p";

        const lipsyncResults = [];
        for (let i = 0; i < curationData.length; i++) {
          const scene = curationData[i];
          // Match by index as fallback if IDs don't match
          const scriptScene = scenes.find((s) => s.id === scene.sceneId) || scenes[i];
          const scriptText = scriptScene?.script || "";

          if (!scriptText) {
            console.warn(`[lipsync] No script text for scene ${scene.sceneId}, skipping`);
            continue;
          }

          console.log(`[lipsync] Scene ${i + 1}: "${scriptText.slice(0, 50)}..." → ${scene.sceneId}`);

          // Generate TTS + upload to Fal — each scene gets its OWN audio
          const { fal_url: falAudioUrl } = await generateTTSAndUpload({
            text: scriptText,
            voice_id: voiceId,
          });

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
            fashion_reels: "creative_direction",
            product_spotlight: "setting_description",
            photo_multishot: "photo_brief",
            ad_creative: "campaign_brief",
            social_post: "post_brief",
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
        const curationData = getStepResult("curation") as Array<{
          sceneId: string; title: string; selectedUrl: string;
        }> | undefined;
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
            <>
              <button
                onClick={handleStart}
                disabled={!activeBrand}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium rounded-[var(--radius-sm)] transition-all cursor-pointer",
                  activeBrand
                    ? "text-white bg-[var(--color-warm)] hover:opacity-90"
                    : "text-fg-faint bg-surface-2 cursor-not-allowed"
                )}
              >
                <Play size={14} />
                Start Pipeline
              </button>
            </>
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
                      : step.status === "review"
                        ? "bg-[var(--color-warning)] text-white"
                        : step.status === "active" || step.status === "running"
                          ? "bg-[var(--color-warm)] text-white"
                          : step.status === "error"
                            ? "bg-[var(--color-error)] text-white"
                            : "bg-surface-2 text-fg-faint border border-edge"
                  )}
                >
                  {step.status === "done" ? (
                    <Check size={12} />
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
  showProduct: boolean;
  productLabel?: string;
  showClothing: boolean;
  clothingLabel?: string;
  clothingSublabel?: string;
  showBackground: boolean;
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
}

const TOOL_SCHEMAS: Record<string, ToolSchema> = {
  ugc_creator: {
    showAvatar: true, avatarLabel: "Avatar", avatarSublabel: "Who appears in the video",
    showProduct: true, productLabel: "Product",
    showClothing: true, clothingLabel: "Clothing", clothingSublabel: "optional, multi-select",
    showBackground: true,
    showVoice: true, showTone: false, showPlatform: false, showLanguage: true, showVariations: false,
    objectiveLabel: "Video Objective",
    objectivePlaceholder: "Describe what you want to achieve. E.g., 'Show the new spring polo in a casual urban setting, targeting men 25–35, emphasize quality and comfort'...",
    showNotes: false,
  },
  product_spotlight: {
    showAvatar: false, showProduct: true, productLabel: "Product",
    showClothing: false, showBackground: true,
    showVoice: false, showTone: false, showPlatform: false, showLanguage: false, showVariations: true,
    objectiveLabel: "Setting Description",
    objectivePlaceholder: "Describe the desired setting. E.g., 'rustic cafe table with morning window light, warm earthy tones, shallow depth of field'...",
    showNotes: false,
  },
  fashion_editorial: {
    showAvatar: true, avatarLabel: "Model / Avatar", avatarSublabel: "The model for the editorial",
    showProduct: true, productLabel: "Accessories / Product",
    showClothing: true, clothingLabel: "Garments", clothingSublabel: "multi-select — each garment is styled",
    showBackground: true,
    showVoice: false, showTone: false, showPlatform: false, showLanguage: false, showVariations: true,
    objectiveLabel: "Pose Direction",
    objectivePlaceholder: "Describe the pose and mood. E.g., 'confident power stance, hand in pocket, looking slightly off camera, moody editorial feel'...",
    showNotes: false,
    showLocationRef: true,
    showStyleRef: true,
  },
  fashion_reels: {
    showAvatar: true, avatarLabel: "Model / Avatar", avatarSublabel: "Same model across all looks",
    showProduct: false,
    showClothing: true, clothingLabel: "Outfits", clothingSublabel: "each outfit = one look in the reel (multi-select)",
    showBackground: true,
    showVoice: false, showTone: false, showPlatform: false, showLanguage: false, showVariations: true,
    objectiveLabel: "Direction / Mood",
    objectivePlaceholder: "Describe the overall visual direction. E.g., 'summer campaign, outdoor market, natural light, relaxed confidence'...",
    showNotes: false,
  },
  photo_multishot: {
    showAvatar: false, showProduct: true, productLabel: "Product",
    showClothing: false, showBackground: true,
    showVoice: false, showTone: false, showPlatform: false, showLanguage: false, showVariations: true,
    objectiveLabel: "Photo Brief",
    objectivePlaceholder: "Describe the style of photos you want. E.g., 'lifestyle shots in a kitchen, product hero on clean white, e-commerce ready'...",
    showNotes: false,
  },
  ad_creative: {
    showAvatar: true, avatarLabel: "Avatar", avatarSublabel: "optional — include talent in the ad",
    showProduct: true, productLabel: "Product",
    showClothing: false, showBackground: false,
    showVoice: false, showTone: true, showPlatform: true, showLanguage: false, showVariations: true,
    objectiveLabel: "Campaign Brief",
    objectivePlaceholder: "Describe the campaign objective, target audience, and key message. E.g., 'Drive sales for summer collection, audience: women 25–40, message: effortless style at an accessible price'...",
    showNotes: true,
  },
  social_post: {
    showAvatar: true, avatarLabel: "Avatar", avatarSublabel: "optional — include in the post",
    showProduct: true, productLabel: "Product",
    showClothing: false, showBackground: false,
    showVoice: false, showTone: true, showPlatform: true, showLanguage: true, showVariations: false,
    objectiveLabel: "Post Brief",
    objectivePlaceholder: "What do you want to communicate? Include any specific hashtags, mentions, or campaign details...",
    showNotes: false,
  },
  ad_creative_lab: {
    showAvatar: false, showProduct: true, productLabel: "Product",
    showClothing: false, showBackground: false,
    showVoice: false, showTone: false, showPlatform: false, showLanguage: false, showVariations: true,
    objectiveLabel: "Creative Direction",
    objectivePlaceholder: "Describe the campaign direction. E.g., 'minimal product photography, earthy tones, premium lifestyle feel, targeting urban professionals'...",
    showNotes: true,
  },
};

const DEFAULT_SCHEMA: ToolSchema = {
  showAvatar: true, showProduct: true, showClothing: false, showBackground: true,
  showVoice: false, showTone: true, showPlatform: true, showLanguage: false, showVariations: true,
  objectiveLabel: "Brief",
  objectivePlaceholder: "Describe what you want to create...",
  showNotes: true,
};

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

  useEffect(() => {
    fetchSystemVoices().then(setSystemVoices).catch(() => {});
  }, []);

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

      {/* Style selector (Video Ad Creator) */}
      {tool.id === "video_ad_creator" && (
        <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-4 space-y-3">
          <label className="text-[12px] font-semibold text-fg-secondary">Visual Style</label>
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
              placeholder="Describe your custom style. E.g., 'watercolor illustration, pastel tones, hand-drawn textures'..."
              className="w-full h-8 px-3 rounded-[var(--radius-sm)] border border-edge bg-surface-2 text-[12px] text-fg placeholder:text-fg-faint outline-none focus:border-[var(--color-edge-focus)]"
            />
          )}
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
          <label className="text-[12px] font-semibold text-fg-secondary">Animation Mode</label>
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
              <div className="text-[9px] text-fg-faint mt-0.5">Smooth transitions between scenes</div>
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
              <div className="text-[9px] text-fg-faint mt-0.5">Each frame animated independently</div>
            </button>
          </div>
        </div>
      )}

      {/* Reference image(s) + Graphics uploaders */}
      {(tool.id === "ad_creative_lab" || tool.id === "static_ad" || tool.id === "content_analyzer" || tool.id === "product_clip" || tool.id === "ugc_creator") && (
        <div className={cn("gap-4", tool.id === "static_ad" ? "grid grid-cols-2" : "space-y-4")}>
          {/* Reference Image — single for Static Ad, multiple for Ad Creative Lab */}
          <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-semibold text-fg-secondary">
                {tool.id === "content_analyzer" ? "Upload Video" : tool.id === "ugc_creator" ? "Composition Reference" : (tool.id === "static_ad" || tool.id === "product_clip") ? "Reference Image" : "Reference Images"}
                <span className="text-fg-faint font-normal ml-1">
                  {tool.id === "content_analyzer" ? "(MP4, WebM — or use URL above)" : tool.id === "ugc_creator" ? "(optional — pose/setting reference for first scene)" : (tool.id === "static_ad" || tool.id === "product_clip") ? "(style/mood reference)" : "(campaign style references)"}
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

      {/* Asset selection — only what this tool needs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {schema.showAvatar && (
          <AssetSelector
            label={schema.avatarLabel || "Avatar"}
            sublabel={schema.avatarSublabel || "Who appears in the content"}
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
              sublabel={schema.multiProduct ? "multi-select" : "What product to feature"}
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
            sublabel={schema.clothingSublabel || "optional, multi-select"}
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
              // Auto-select the newly uploaded item
              setConfig((p) => ({
                ...p,
                selectedClothingIds: [...p.selectedClothingIds, item.id],
              }));
            }}
          />
        )}

        {schema.showBackground && (
          <AssetSelector
            label="Background"
            sublabel="Scene setting (optional)"
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
              // Auto-select the newly uploaded background
              setConfig((p) => ({ ...p, selectedBackgroundId: item.id }));
            }}
          />
        )}
      </div>

      {/* Settings — only relevant dropdowns + objective */}
      <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-5 space-y-4">
        <h3 className="text-[12px] font-semibold text-fg-secondary">Settings</h3>

        {settingsCols > 0 && (
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${Math.min(settingsCols, 5)}, minmax(0, 1fr))` }}
          >
            {schema.showVoice && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-fg-faint">Voice</label>
                <div className="flex gap-1.5">
                  <select
                    value={config.selectedVoiceId || ""}
                    onChange={(e) => setConfig((p) => ({ ...p, selectedVoiceId: e.target.value || null }))}
                    className="flex-1 h-8 px-2 rounded-[var(--radius-sm)] border border-edge bg-surface-2 text-[12px] text-fg outline-none focus:border-[var(--color-edge-focus)]"
                  >
                    <option value="">Select voice...</option>
                    {(activeBrand?.voicePresets || []).length > 0 && (
                      <optgroup label="Brand Voices">
                        {activeBrand.voicePresets.map((v) => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </optgroup>
                    )}
                    {systemVoices.length > 0 && (
                      <optgroup label="System Voices">
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
                      title="Preview voice"
                    >
                      <Play size={12} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {schema.showTone && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-fg-faint">Tone</label>
                <select
                  value={config.tone}
                  onChange={(e) => setConfig((p) => ({ ...p, tone: e.target.value }))}
                  className="w-full h-8 px-2 rounded-[var(--radius-sm)] border border-edge bg-surface-2 text-[12px] text-fg outline-none focus:border-[var(--color-edge-focus)]"
                >
                  <option value="engaging">Engaging</option>
                  <option value="casual">Casual</option>
                  <option value="professional">Professional</option>
                  <option value="funny">Funny</option>
                  <option value="inspirational">Inspirational</option>
                </select>
              </div>
            )}

            {schema.showPlatform && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-fg-faint">Platform</label>
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
                <label className="text-[11px] font-medium text-fg-faint">Language</label>
                <select
                  value={config.language}
                  onChange={(e) => setConfig((p) => ({ ...p, language: e.target.value }))}
                  className="w-full h-8 px-2 rounded-[var(--radius-sm)] border border-edge bg-surface-2 text-[12px] text-fg outline-none focus:border-[var(--color-edge-focus)]"
                >
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </div>
            )}

            {schema.showVariations && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-fg-faint">Variations</label>
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

        {/* Aspect Ratio + Resolution + Subtitles */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-fg-faint">Aspect Ratio</label>
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
            <label className="text-[11px] font-medium text-fg-faint">Resolution</label>
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
              <label className="text-[11px] font-medium text-fg-faint">Subtitles</label>
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
        </div>

        {/* Objective / brief */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-fg-faint">
            {schema.objectiveLabel}
          </label>
          <textarea
            value={config.objective}
            onChange={(e) => setConfig((p) => ({ ...p, objective: e.target.value }))}
            rows={3}
            placeholder={schema.objectivePlaceholder}
            className="w-full bg-surface-2 border border-edge rounded-[var(--radius-sm)] px-3 py-2 text-[13px] text-fg placeholder:text-fg-faint outline-none focus:border-[var(--color-edge-focus)] resize-none"
          />
        </div>

        {/* Custom Script — per-scene inputs, skip Gemini */}
        {tool.pipeline?.includes("script") && (
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
                    <div key={i} className="border border-edge rounded-[var(--radius-sm)] p-2 space-y-1.5">
                      <div className="flex gap-2 items-start">
                        <span className="text-[10px] text-fg-faint font-mono mt-1.5 w-4 shrink-0">{i + 1}</span>
                        <div className="flex-1 space-y-1">
                          <textarea
                            value={s.script}
                            onChange={(e) => updateScript(i, e.target.value)}
                            rows={2}
                            placeholder={
                              i === 0 ? "Script: Si buscas auriculares nuevos escucha bien..."
                              : i === scenes.length - 1 ? "Script: Si pagas con personal Pay, tenes un 20% de reintegro"
                              : `Script scene ${i + 1}...`
                            }
                            className="w-full bg-surface-2 border border-edge rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] text-fg placeholder:text-fg-faint outline-none focus:border-[var(--color-edge-focus)] resize-none"
                          />
                          <div className="flex gap-1.5">
                            <input
                              value={s.visual}
                              onChange={(e) => updateVisual(i, e.target.value)}
                              placeholder={
                                i === 0 ? "Visual: chica acostada en la cama mirando el celular"
                                : "Visual: close-up del producto solo, sin persona"
                              }
                              className="flex-1 bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-2.5 py-1 text-[11px] text-fg-muted placeholder:text-fg-faint outline-none focus:border-[var(--color-edge-focus)]"
                            />
                            <select
                              value={s.shot || "auto"}
                              onChange={(e) => updateShot(i, e.target.value)}
                              className="w-28 bg-surface-1 border border-edge rounded-[var(--radius-sm)] px-1.5 py-1 text-[10px] text-fg-muted outline-none focus:border-[var(--color-edge-focus)]"
                            >
                              <option value="auto">Auto</option>
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
                        </div>
                        <button onClick={() => removeScene(i)} className="text-[10px] text-fg-faint hover:text-red-400 mt-1.5 cursor-pointer">
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
                  placeholder="E.g., 'rooftop in NYC at golden hour', 'industrial warehouse with concrete walls and diffused light'..."
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
                  placeholder="E.g., 'Vogue Italia dark editorial', 'COS minimalist campaign', '90s supermodel energy, film grain'..."
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
              placeholder="Any extra instructions, references, or constraints..."
              className="w-full bg-surface-2 border border-edge rounded-[var(--radius-sm)] px-3 py-2 text-[13px] text-fg placeholder:text-fg-faint outline-none focus:border-[var(--color-edge-focus)] resize-none"
            />
          </div>
        )}
      </div>

      {/* Summary + start */}
      <div className="bg-surface-1 border border-edge rounded-[var(--radius-md)] p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[13px] font-semibold text-fg">Ready to generate</h3>
            <p className="text-[12px] text-fg-muted mt-0.5">
              {tool.pipeline.length} steps
              {schema.showAvatar && ` · ${config.selectedAvatarId ? "1 avatar" : "no avatar"}`}
              {schema.showProduct && ` · ${config.selectedProductId ? "1 product" : "no product"}`}
              {schema.showClothing && config.selectedClothingIds.length > 0 && ` · ${config.selectedClothingIds.length} garments`}
              {schema.showVariations && ` · ${config.numVariations} variations`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onStart}
              className="flex items-center gap-2 px-6 py-2.5 text-[13px] font-medium text-white bg-[var(--color-warm)] rounded-[var(--radius-sm)] hover:opacity-90 transition-opacity cursor-pointer"
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
              className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium text-white bg-[var(--color-warm)] rounded-[var(--radius-sm)] hover:opacity-90 transition-opacity cursor-pointer"
            >
              <Play size={12} />
              Run
            </button>
          )}
          {step.status === "review" && (
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
        ) : step.status === "review" && step.id === "curation" ? (
          <CurationPanel
            allSteps={allSteps}
            curationSelections={curationSelections}
            onSelect={onCurationSelect}
            audioCache={audioCache}
            onAudioCached={onAudioCached}
            voiceId={config.selectedVoiceId}
          />
        ) : step.status === "review" ? (
          <DoneStep stepId={step.id} result={step.result} audioCache={audioCache} config={config} allSteps={allSteps}
            getScriptScenes={() => {
              const sr = allSteps.find((s: StepState) => s.id === "script")?.result as Record<string, unknown> | undefined;
              if (!sr?.scenes) return [];
              const arr = (sr.scenes as Array<Array<Record<string, string>>>)[0] || [];
              return arr.map((s, i) => ({ id: s.id || `act_${i+1}`, title: s.title || s.act || `Scene ${i+1}`, script: s.script || s.speech || s.copy || s.text || "", image_prompt: s.image_prompt || "" }));
            }} />
        ) : step.status === "done" ? (
          <DoneStep stepId={step.id} result={step.result} audioCache={audioCache} config={config} allSteps={allSteps}
            getScriptScenes={() => {
              const sr = allSteps.find((s: StepState) => s.id === "script")?.result as Record<string, unknown> | undefined;
              if (!sr?.scenes) return [];
              const arr = (sr.scenes as Array<Array<Record<string, string>>>)[0] || [];
              return arr.map((s, i) => ({ id: s.id || `act_${i+1}`, title: s.title || s.act || `Scene ${i+1}`, script: s.script || s.speech || s.copy || s.text || "", image_prompt: s.image_prompt || "" }));
            }} />
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
              <p className="text-[11px] text-fg-faint">Base image</p>
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
              <span className="text-[10px] text-fg-faint">Generated image</span>
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

function DoneStep({ stepId, result, audioCache: audioCacheProp, getScriptScenes, config, allSteps = [] }: {
  stepId: string;
  result?: unknown;
  audioCache?: Record<string, { url: string; blob: Blob }>;
  getScriptScenes?: () => Array<{ id: string; title: string; script: string; image_prompt: string }>;
  config?: ToolConfig;
  allSteps?: StepState[];
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
  const [testVideoLoading, setTestVideoLoading] = useState(false);
  const [testVideoUrl, setTestVideoUrl] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState(false);
  const testAudioRef = useRef<HTMLAudioElement | null>(null);
  const [regenSceneId, setRegenSceneId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [selectedRefIdx, setSelectedRefIdx] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Script step — show script text + brief, only first image prompt
  if (stepId === "script" && result) {
    const raw = result as Record<string, unknown>;
    console.log("[DoneStep script] keys:", Object.keys(raw), "isArray:", Array.isArray(result), "preview:", JSON.stringify(raw).slice(0, 500));
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
      // Build full script as brief
      const fullScript = frames.map((f) => String(f.script || f.voiceover || "")).filter(Boolean).join(" ");
      brief = `Style: ${raw.style || "N/A"}\n\nFull Script:\n${fullScript}`;
    }
    // UGC format: { scenes: [[...]], brief }
    else if (raw.scenes) {
      const arr = raw.scenes as Array<Array<Record<string, string>>>;
      scenes = (arr[0] || []).map((s, i) => {
        let scriptText = s.script || s.speech || s.copy || s.text || s.audio || s.dialogue
          || s.narration || s.voiceover || s.action || s.spoken || s.line || s.lines || "";
        scriptText = scriptText.replace(/^(AVATAR|OFF[- ]?CAMERA|ON[- ]?CAMERA|NARRATOR|SPEAKER)\s*(\([^)]*\)\s*)?:\s*/i, "").trim();
        const imgPrompt = s.image_prompt || s.visuals || s.visual || s.visual_prompt
          || s.scene_description || s.setting || s.background || s.scene || "";
        return {
          id: s.id || s.scene_number || `act_${i + 1}`,
          title: s.title || s.act || `Scene ${i + 1}`,
          script: scriptText,
          image_prompt: imgPrompt && isNaN(Number(imgPrompt)) ? imgPrompt : "",
        };
      });
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

    return (
      <div className="space-y-4">
        {/* Full script / brief — shown at top for Video Ad Creator */}
        {brief && brief.includes("Full Script:") && (
          <div className="bg-surface-2 border border-edge rounded-[var(--radius-md)] p-4 mb-2">
            <h4 className="text-[11px] font-semibold text-fg-faint uppercase tracking-wider mb-2">Narrative</h4>
            <pre className="text-[12px] text-fg-muted whitespace-pre-wrap leading-relaxed">{brief}</pre>
          </div>
        )}

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Check size={14} className="text-[var(--color-success)]" />
            <span className="text-[13px] font-medium text-fg">
              Script generated — {scenes.length} scenes
            </span>
          </div>
          {brief && !brief.includes("Full Script:") && (
            <button
              onClick={() => setShowBrief(!showBrief)}
              className="text-[11px] text-fg-muted hover:text-fg transition-colors cursor-pointer underline"
            >
              {showBrief ? "Hide brief" : "Show brief used"}
            </button>
          )}
        </div>

        {showBrief && brief && (
          <div className="bg-surface-2 border border-edge rounded-[var(--radius-sm)] p-4 max-h-48 overflow-y-auto">
            <div className="text-[10px] font-medium text-fg-faint uppercase tracking-wider mb-2">System Prompt / Brief</div>
            <pre className="text-[11px] text-fg-muted whitespace-pre-wrap font-mono leading-relaxed">{brief}</pre>
          </div>
        )}

        {scenes.map((scene, i) => (
          <div
            key={scene.id}
            className="border border-edge rounded-[var(--radius-md)] overflow-hidden"
          >
            <div className="px-4 py-2.5 bg-surface-2 border-b border-edge flex items-center justify-between">
              <span className="text-[12px] font-semibold text-fg">{scene.title}</span>
              <span className="text-[10px] text-fg-faint font-mono">{scene.id}</span>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[10px] font-medium text-fg-faint uppercase tracking-wider">Script</div>
                  {scene.script && config?.selectedVoiceId && (
                    <button
                      onClick={async (e) => {
                        const btn = e.currentTarget;
                        // If already playing, stop
                        if (btn.dataset.playing === "true") {
                          const audio = document.getElementById(`preview-audio-${scene.id}`) as HTMLAudioElement;
                          if (audio) { audio.pause(); audio.currentTime = 0; }
                          btn.dataset.playing = "false";
                          btn.textContent = "▶ Preview";
                          return;
                        }
                        // Check cache first
                        const cached = audioCacheProp?.[scene.id];
                        if (cached?.url) {
                          let audio = document.getElementById(`preview-audio-${scene.id}`) as HTMLAudioElement;
                          if (!audio) { audio = new Audio(); audio.id = `preview-audio-${scene.id}`; }
                          audio.src = cached.url;
                          btn.dataset.playing = "true";
                          btn.textContent = "⏹ Stop";
                          audio.onended = () => { btn.dataset.playing = "false"; btn.textContent = "▶ Preview"; };
                          audio.play();
                          return;
                        }
                        // Generate TTS
                        btn.textContent = "⏳...";
                        try {
                          const tts = await generateTTS({ text: scene.script, voice_id: config.selectedVoiceId! });
                          let audio = document.getElementById(`preview-audio-${scene.id}`) as HTMLAudioElement;
                          if (!audio) { audio = new Audio(); audio.id = `preview-audio-${scene.id}`; }
                          audio.src = tts.audioUrl;
                          btn.dataset.playing = "true";
                          btn.textContent = "⏹ Stop";
                          audio.onended = () => { btn.dataset.playing = "false"; btn.textContent = "▶ Preview"; };
                          audio.play();
                        } catch {
                          btn.textContent = "▶ Preview";
                        }
                      }}
                      className="text-[10px] text-fg-muted hover:text-fg bg-surface-2 hover:bg-surface-3 px-2 py-0.5 rounded cursor-pointer transition-colors"
                    >
                      ▶ Preview
                    </button>
                  )}
                </div>
                <textarea
                  defaultValue={scene.script}
                  onChange={(e) => {
                    // Update the script in the step result directly
                    scene.script = e.target.value;
                  }}
                  rows={Math.max(2, Math.ceil(scene.script.length / 60))}
                  className="w-full text-[13px] text-fg leading-relaxed bg-transparent border border-transparent hover:border-edge focus:border-[var(--color-warm)] rounded-[var(--radius-sm)] px-2 py-1 outline-none resize-none transition-colors"
                />
              </div>
              {i === 0 && scene.image_prompt && (
                <div>
                  <div className="text-[10px] font-medium text-fg-faint uppercase tracking-wider mb-1">
                    Image Prompt (Scene 1 — base image)
                  </div>
                  <p className="text-[12px] text-fg-muted leading-relaxed bg-surface-2 rounded-[var(--radius-sm)] p-3 font-mono">
                    {scene.image_prompt}
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Base image step — show generated image + inputs used + lightbox + edit
  if (stepId === "base_image" && result) {
    const img = result as {
      url: string;
      prompt: string;
      scriptText?: string;
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
          setEditMode(false);
          setEditPromptText("");
        }
      } catch { /* silent */ } finally {
        setEditLoading(false);
      }
    };

    const handleTestVideo = async () => {
      setTestVideoLoading(true);
      setTestVideoUrl(null);
      try {
        const scenes = getScriptScenes?.() || [];
        const scriptText = scenes[0]?.script || "Hola, esta es una prueba rápida.";
        const resolvedVoiceId = config?.selectedVoiceId || activeBrand?.voicePresets?.[0]?.id;

        // Generate TTS + upload to Fal in one backend call
        const { fal_url: audioUrl } = await generateTTSAndUpload({
          text: scriptText,
          voice_id: resolvedVoiceId,
        });

        const job = await createHeyGenAvatar4({
          image_url: img.url,
          audio_url: audioUrl,
          talking_style: "expressive",
          aspect_ratio: (config?.aspectRatio || "9:16") === "4:5" ? "9:16" : (config?.aspectRatio || "9:16"),
          resolution: "720p",
        });
        const videoResult = await pollHeyGenAvatar4(job.request_id);
        if (videoResult.video_url) {
          setTestVideoUrl(videoResult.video_url);
        }
      } catch { /* silent */ } finally {
        setTestVideoLoading(false);
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
              <button
                onClick={() => {
                  const scenes = getScriptScenes?.() || [];
                  const firstId = scenes[0]?.id;
                  const cached = firstId && audioCacheProp ? audioCacheProp[firstId] : null;
                  if (playingAudio) {
                    testAudioRef.current?.pause();
                    setPlayingAudio(false);
                    return;
                  }
                  if (cached) {
                    const audio = new Audio(cached.url);
                    testAudioRef.current = audio;
                    audio.onended = () => setPlayingAudio(false);
                    audio.play();
                    setPlayingAudio(true);
                  }
                }}
                disabled={!audioCacheProp || !getScriptScenes?.()[0]?.id || !audioCacheProp[getScriptScenes()[0].id]}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 text-[10px] rounded-[var(--radius-sm)] py-1.5 transition-colors cursor-pointer",
                  playingAudio
                    ? "bg-[var(--color-warm)] text-white"
                    : "text-fg-muted bg-surface-2 hover:bg-surface-3 hover:text-fg"
                )}
              >
                {playingAudio ? <Square size={8} /> : <Play size={10} />}
                {playingAudio ? "Stop" : "Listen"}
              </button>
              <button
                onClick={handleTestVideo}
                disabled={testVideoLoading}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 text-[10px] rounded-[var(--radius-sm)] py-1.5 transition-colors cursor-pointer",
                  testVideoLoading
                    ? "text-fg-faint bg-surface-2"
                    : "text-[var(--color-warm)] bg-[var(--color-warm-muted)] hover:opacity-80"
                )}
              >
                {testVideoLoading ? <Loader2 size={10} className="animate-spin" /> : <Video size={10} />}
                {testVideoLoading ? "Testing..." : "Test video"}
              </button>
            </div>

            {/* Test video preview */}
            {testVideoUrl && (
              <div className="rounded-[var(--radius-sm)] overflow-hidden border border-edge">
                <video src={testVideoUrl} controls autoPlay className="w-full" />
              </div>
            )}
          </div>

          {/* Inputs used */}
          <div className="flex-1 space-y-3">
            <h4 className="text-[11px] font-semibold text-fg-faint uppercase tracking-wider">Inputs used</h4>

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
                  <div className="text-[10px] text-fg-faint">Background</div>
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
                placeholder="Describe what to change..."
                className="flex-1 h-8 px-3 rounded-[var(--radius-sm)] border border-edge bg-surface-1 text-[12px] text-fg placeholder:text-fg-faint outline-none"
                onKeyDown={(e) => e.key === "Enter" && handleEdit()}
              />
              <button
                onClick={handleEdit}
                disabled={editLoading || !editPromptText.trim()}
                className={cn(
                  "px-4 py-2 text-[11px] font-medium rounded-[var(--radius-sm)] transition-colors",
                  !editLoading && editPromptText.trim()
                    ? "text-white bg-[var(--color-warm)] hover:opacity-90 cursor-pointer"
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
    const scenes = result as Array<{
      sceneId: string;
      title: string;
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
        <div className="grid grid-cols-4 gap-3">
          {scenes.map((scene) =>
            scene.variations.map((v) => (
              <div key={v.id} className="space-y-1">
                <div className="relative">
                  <div className="aspect-[9/16] rounded-[var(--radius-sm)] overflow-hidden border border-edge">
                    <img src={v.url} alt={v.label} className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 rounded-b-[var(--radius-sm)]">
                    <div className="text-[9px] text-white font-medium">{v.label}</div>
                  </div>
                </div>
                <p className="text-[9px] text-fg-faint text-center truncate">{scene.title}</p>
              </div>
            ))
          )}
        </div>
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
                  <span className="text-[10px] text-fg-faint">No audio</span>
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
                    <button
                      onClick={() => {
                        const audio = new Audio(seg.audioUrl);
                        audio.play();
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-sm)] text-[10px] font-medium bg-surface-2 text-fg-muted hover:text-fg hover:bg-surface-3 cursor-pointer"
                    >
                      <Play size={10} /> Play
                    </button>
                  )}
                  <button
                    onClick={async (e) => {
                      const btn = e.currentTarget;
                      btn.textContent = "⏳...";
                      try {
                        const voiceId = config?.selectedVoiceId || activeBrand?.voicePresets?.[0]?.id;
                        const tts = await generateTTS({ text: seg.script || seg.text || "", voice_id: voiceId });
                        seg.audioUrl = tts.audioUrl;
                        const audio = new Audio(tts.audioUrl);
                        audio.play();
                      } catch { /* */ }
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
                onChange={(e) => { seg.script = e.target.value; }}
                rows={2}
                className="w-full text-[12px] text-fg-muted leading-relaxed bg-transparent border border-transparent hover:border-edge focus:border-[var(--color-warm)] rounded-[var(--radius-sm)] px-2 py-1 outline-none resize-none transition-colors"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Lip-sync step — show playable videos with regenerate per scene
  if (stepId === "lipsync" && result) {
    const segments = result as Array<{
      sceneId: string;
      title: string;
      scriptText?: string;
      videoUrl: string;
      imageUrl?: string;
    }>;
    const handleRegenScene = async (seg: typeof segments[0]) => {
      if (!seg.scriptText || !seg.imageUrl) return;
      setRegenSceneId(seg.sceneId);
      try {
        const voiceId = config?.selectedVoiceId || activeBrand?.voicePresets?.[0]?.id;
        const { fal_url: audioUrl } = await generateTTSAndUpload({
          text: seg.scriptText,
          voice_id: voiceId,
        });
        const job = await createHeyGenAvatar4({
          image_url: seg.imageUrl,
          audio_url: audioUrl,
          talking_style: "expressive",
          aspect_ratio: "9:16",
          resolution: "720p",
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
        <div className="grid grid-cols-2 gap-4">
          {segments.map((seg, i) => (
            <div key={seg.sceneId} className="bg-surface-0 border border-edge rounded-[var(--radius-md)] overflow-hidden">
              <div className="aspect-[9/16]">
                {regenSceneId === seg.sceneId ? (
                  <div className="w-full h-full bg-surface-2 flex flex-col items-center justify-center gap-2">
                    <Loader2 size={20} className="animate-spin text-fg-muted" />
                    <p className="text-[10px] text-fg-faint">Regenerating...</p>
                  </div>
                ) : seg.videoUrl ? (
                  <video src={seg.videoUrl} controls className="w-full h-full object-contain bg-black" />
                ) : (
                  <div className="w-full h-full bg-surface-2 flex items-center justify-center">
                    <p className="text-[11px] text-fg-faint">No video</p>
                  </div>
                )}
              </div>
              <div className="p-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-fg font-medium">Scene {i + 1}: {seg.title}</span>
                  <button
                    onClick={() => handleRegenScene(seg)}
                    disabled={!!regenSceneId}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] text-fg-muted hover:text-fg bg-surface-2 hover:bg-surface-3 rounded-[var(--radius-sm)] transition-colors cursor-pointer"
                  >
                    <RotateCcw size={10} />
                    Regen
                  </button>
                </div>
                {seg.scriptText && (
                  <p className="text-[10px] text-fg-faint leading-relaxed">&ldquo;{seg.scriptText}&rdquo;</p>
                )}
              </div>
            </div>
          ))}
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
      videoUrl?: string; totalDuration: string; scenes: number;
      format: string; resolution: string; sizeBytes?: number;
      subtitleEngine?: string;
      remotionScenes?: Array<{ videoUrl: string; scriptText: string; durationInFrames: number }>;
    };
    const fullVideoUrl = info.videoUrl ? `http://localhost:8000${info.videoUrl}` : undefined;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Check size={14} className="text-[var(--color-success)]" />
          <span className="text-[13px] font-medium text-fg">Final video rendered</span>
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
            <p className="text-[13px]">Video ready</p>
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

        <div className="flex justify-center gap-2 pt-2">
          {fullVideoUrl && (
            <a
              href={fullVideoUrl}
              download="ugc_video.mp4"
              className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-white bg-[var(--color-warm)] rounded-[var(--radius-sm)] hover:opacity-90 transition-opacity cursor-pointer"
            >
              <Film size={14} />
              Download
            </a>
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
              <div className="px-1">
                <span className="text-[9px] font-semibold text-[var(--color-warm)] uppercase">{slide.role}</span>
                {slide.headline && <p className="text-[12px] font-bold text-fg leading-tight">{slide.headline}</p>}
                {slide.body && <p className="text-[10px] text-fg-muted leading-tight">{slide.body}</p>}
              </div>
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
            className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-white bg-[var(--color-warm)] rounded-[var(--radius-sm)] hover:opacity-90 cursor-pointer"
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
              <p className="text-[10px] text-fg-faint text-center">{img.label}</p>
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
            className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-white bg-[var(--color-warm)] rounded-[var(--radius-sm)] hover:opacity-90 cursor-pointer"
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
            <summary className="cursor-pointer hover:text-fg">Show prompt</summary>
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
            <h4 className="text-[11px] font-semibold text-[var(--color-warm)] uppercase tracking-wider mb-1">Key Insights</h4>
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
            <h4 className="text-[11px] font-semibold text-fg-faint uppercase tracking-wider mb-2">Estimated Script</h4>
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
                  <summary className="cursor-pointer hover:text-fg">Image prompt</summary>
                  <p className="mt-1 font-mono bg-surface-2 p-1.5 rounded text-[9px]">{scene.image_prompt}</p>
                </details>
              </div>
            ))}
          </div>
        )}

        {/* Style guide */}
        {!!analysis.style_guide && (
          <div className="bg-surface-2 rounded-[var(--radius-sm)] p-3">
            <span className="text-[10px] text-fg-faint font-medium">Visual Style</span>
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
      scenes: Array<{ frame: number; script: string; imagePrompt: string; sceneType: string }>;
      styleNotes: string;
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Check size={14} className="text-[var(--color-success)]" />
          <span className="text-[13px] font-medium text-fg">
            Content adapted — {data.scenes.length} scenes for your brand
          </span>
        </div>

        {data.adaptedScript && (
          <div className="bg-surface-0 border border-edge rounded-[var(--radius-md)] p-4">
            <h4 className="text-[11px] font-semibold text-fg-faint uppercase tracking-wider mb-2">Your Script</h4>
            <p className="text-[13px] text-fg leading-relaxed">{data.adaptedScript}</p>
          </div>
        )}

        <div className="space-y-2">
          {data.scenes.map((scene, i) => (
            <div key={i} className="bg-surface-0 border border-edge rounded-[var(--radius-sm)] p-3 flex gap-3">
              <span className="text-[10px] font-bold text-fg-faint w-6 shrink-0">F{scene.frame}</span>
              <div className="flex-1 space-y-1">
                <p className="text-[11px] text-fg-muted">&ldquo;{scene.script}&rdquo;</p>
                <details className="text-[9px] text-fg-faint">
                  <summary className="cursor-pointer hover:text-fg">Image prompt</summary>
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
  if (stepId === "prompt" && result) {
    // Debug: log what the DoneStep received
    const _raw = result as Record<string, unknown>;
    console.log("[DoneStep prompt]", "keys:", Object.keys(_raw), "isArray:", Array.isArray(_raw), "has slides:", "slides" in _raw, "preview:", JSON.stringify(_raw).slice(0, 400));
  }
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
                <summary className="text-[9px] text-fg-faint cursor-pointer hover:text-fg-muted">Image prompt</summary>
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
                <div className="flex items-center gap-1">
                  <input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    placeholder="E.g., warmer, more dramatic..."
                    className="flex-1 h-6 px-1.5 rounded-[var(--radius-sm)] border border-edge bg-surface-2 text-[9px] text-fg outline-none"
                    onKeyDown={async (e) => {
                      if (e.key !== "Enter" || !editText.trim()) return;
                      setEditLoading(true);
                      try {
                        const job = await createImageEdit([img.url], editText.trim(), config?.aspectRatio || "9:16", config?.resolution || "1K");
                        const result = await pollImageGen(job.request_id);
                        if (result.image_url) img.url = result.image_url;
                      } catch { /* */ } finally { setEditLoading(false); setEditingId(null); setEditText(""); }
                    }}
                  />
                  <button
                    onClick={async () => {
                      if (!editText.trim()) return;
                      setEditLoading(true);
                      try {
                        const job = await createImageEdit([img.url], editText.trim(), config?.aspectRatio || "9:16", config?.resolution || "1K");
                        const result = await pollImageGen(job.request_id);
                        if (result.image_url) img.url = result.image_url;
                      } catch { /* */ } finally { setEditLoading(false); setEditingId(null); setEditText(""); }
                    }}
                    disabled={editLoading}
                    className="px-1.5 py-1 text-[8px] font-medium text-white bg-[var(--color-warm)] rounded-[var(--radius-sm)] cursor-pointer"
                  >
                    {editLoading ? <Loader2 size={8} className="animate-spin" /> : "OK"}
                  </button>
                </div>
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
    const data = result as {
      creatives: Array<{ id: string; url: string; prompt: string; style: string; angle: string; status: string }>;
      successful: number; totalGenerated: number;
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

              {/* Edit input */}
              {editingId === creative.id && (
                <div className="flex items-center gap-1.5">
                  <input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    placeholder="E.g., warmer tones, remove clutter..."
                    className="flex-1 h-7 px-2 rounded-[var(--radius-sm)] border border-edge bg-surface-2 text-[11px] text-fg outline-none"
                    onKeyDown={(e) => e.key === "Enter" && handleEditCreative(creative)}
                  />
                  <button
                    onClick={() => handleEditCreative(creative)}
                    disabled={editLoading}
                    className="px-2 py-1 text-[10px] font-medium text-white bg-[var(--color-warm)] rounded-[var(--radius-sm)] cursor-pointer"
                  >
                    {editLoading ? <Loader2 size={10} className="animate-spin" /> : "Apply"}
                  </button>
                </div>
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
              className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-white bg-[var(--color-warm)] rounded-[var(--radius-sm)] hover:opacity-90 cursor-pointer"
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

// ── Curation Panel — manual variation selection ───────────

function CurationPanel({
  allSteps,
  curationSelections,
  onSelect,
  audioCache,
  onAudioCached,
  voiceId,
}: {
  allSteps: StepState[];
  curationSelections: Record<string, string>;
  onSelect: (sceneId: string, variationId: string) => void;
  audioCache: Record<string, { url: string; blob: Blob }>;
  onAudioCached: (sceneId: string, url: string, blob: Blob) => void;
  voiceId: string | null;
}) {
  const { activeBrand } = useBrand();
  const multishotStep = allSteps.find((s) => s.id === "multishot");
  const multishotData = multishotStep?.result as Array<{
    sceneId: string;
    title: string;
    variations: Array<{ id: string; url: string; label: string }>;
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
    setEditLoading(true);
    try {
      const productUrls = (editingVar as typeof editingVar & { productUrls?: string[] })?.productUrls || [];
      const job = await createImageEdit([editingVar.url, ...productUrls], editPrompt.trim());
      const result = await pollImageGen(job.request_id);
      if (result.image_url) {
        for (const scene of multishotData) {
          const v = scene.variations.find((v) => v.id === editingVar.varId);
          if (v) { v.url = result.image_url; break; }
        }
        setEditingVar(null);
        setEditPrompt("");
      }
    } catch { /* silent */ } finally {
      setEditLoading(false);
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

        return (
          <div key={scene.sceneId} className="bg-surface-0 border border-edge rounded-[var(--radius-md)] p-4 space-y-3">
            {/* Scene header + script + audio */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="text-[12px] font-semibold text-fg">
                  Scene {sceneIndex + 1}: {scene.title}
                </h4>
                {scriptScene && (
                  <p className="text-[12px] text-fg-muted mt-1 leading-relaxed">
                    &ldquo;{scriptScene.script}&rdquo;
                  </p>
                )}
              </div>
              {scriptScene && (
                <div className="shrink-0 flex items-center gap-1.5">
                  <button
                    onClick={() => handlePlayAudio(scene.sceneId, scriptScene.script)}
                    disabled={isGenerating}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-[11px] font-medium transition-colors cursor-pointer",
                      isPlaying
                        ? "bg-[var(--color-warm)] text-white"
                        : "bg-surface-2 text-fg-muted hover:text-fg hover:bg-surface-3"
                    )}
                  >
                    {isGenerating ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : isPlaying ? (
                      <Square size={9} />
                    ) : (
                      <Play size={11} />
                    )}
                    {isGenerating ? "Generating..." : isPlaying ? "Stop" : hasCached ? "Replay" : "Listen"}
                  </button>
                  {hasCached && !isGenerating && (
                    <button
                      onClick={() => handleRegenerateAudio(scene.sceneId, scriptScene.script)}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-[var(--radius-sm)] text-[10px] text-fg-faint hover:text-fg bg-surface-2 hover:bg-surface-3 transition-colors cursor-pointer"
                      title="Regenerate audio"
                    >
                      <RotateCcw size={10} />
                    </button>
                  )}
                </div>
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
                      <div className="aspect-[9/16]">
                        {isRegen ? (
                          <div className="w-full h-full flex items-center justify-center bg-surface-2">
                            <Loader2 size={16} className="animate-spin text-fg-muted" />
                          </div>
                        ) : (
                          <img src={v.url} alt={v.label} className="w-full h-full object-cover" />
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
                          Regenerate
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
                      </div>
                    )}
                    {!isScene1 && (v as { prompt?: string }).prompt && (
                      <details className="text-[9px] text-fg-faint">
                        <summary className="cursor-pointer hover:text-fg">Show prompt</summary>
                        <p className="mt-1 p-1.5 bg-surface-2 rounded text-[9px] font-mono leading-relaxed break-words">
                          {(v as { prompt?: string }).prompt}
                        </p>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Inline edit form with product selector */}
            {editingVar && editingVar.sceneId === scene.sceneId && (
              <div className="bg-surface-2 rounded-[var(--radius-sm)] p-3 space-y-2">
                {/* Product image selector */}
                {activeBrand?.products && activeBrand.products.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[9px] font-medium text-fg-faint uppercase tracking-wider">Include product reference</span>
                    <div className="flex gap-1.5 flex-wrap">
                      {(activeBrand.products || []).flatMap((p) => [
                        { url: p.imageUrl, label: p.name, pid: p.id },
                        ...(p.images || []).map((img) => ({ url: img.imageUrl, label: img.label || p.name, pid: p.id })),
                      ]).map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            const ev = editingVar as typeof editingVar & { productUrls?: string[] };
                            const urls = ev?.productUrls || [];
                            if (urls.includes(img.url)) {
                              (editingVar as typeof editingVar & { productUrls?: string[] }).productUrls = urls.filter((u) => u !== img.url);
                            } else {
                              (editingVar as typeof editingVar & { productUrls?: string[] }).productUrls = [...urls, img.url];
                            }
                            setEditPrompt((p) => p); // force re-render
                          }}
                          className={cn(
                            "w-10 h-10 rounded overflow-hidden border-2 cursor-pointer transition-all",
                            ((editingVar as typeof editingVar & { productUrls?: string[] })?.productUrls || []).includes(img.url)
                              ? "border-[var(--color-warm)]"
                              : "border-edge opacity-50 hover:opacity-100"
                          )}
                          title={img.label}
                        >
                          <img src={productImageUrl(img.url)} alt={img.label} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    placeholder="Replace the product with the one from the reference. Keep everything else identical."
                    className="flex-1 h-7 px-2 rounded-[var(--radius-sm)] border border-edge bg-surface-1 text-[12px] text-fg placeholder:text-fg-faint outline-none"
                    onKeyDown={(e) => e.key === "Enter" && handleEditImage()}
                  />
                <button
                  onClick={handleEditImage}
                  disabled={editLoading || !editPrompt.trim()}
                  className={cn(
                    "px-3 py-1.5 text-[11px] font-medium rounded-[var(--radius-sm)] transition-colors",
                    !editLoading && editPrompt.trim()
                      ? "text-white bg-[var(--color-warm)] hover:opacity-90 cursor-pointer"
                      : "text-fg-faint bg-surface-1 cursor-not-allowed"
                  )}
                >
                  {editLoading ? <Loader2 size={11} className="animate-spin" /> : "Apply"}
                </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
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
                ? "bg-[var(--color-warm)] text-white"
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
                  className="flex-1 text-[9px] font-medium text-white bg-[var(--color-warm)] hover:opacity-90 rounded px-2 py-1 cursor-pointer"
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
              className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium text-white bg-[var(--color-warm)] rounded-[var(--radius-sm)] hover:opacity-90 cursor-pointer disabled:opacity-40"
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
