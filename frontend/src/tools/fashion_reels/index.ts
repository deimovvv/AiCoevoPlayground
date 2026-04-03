import type { ToolDefinition } from "../types";
import { handleScript, handleBaseImage, handleMultishot, handleCuration } from "../ugc_creator/handlers";
import { createKlingVideo, pollKlingVideo, saveGeneration } from "../../lib/api";
import type { StepHandler } from "../types";

const handleAnimate: StepHandler = async (ctx) => {
  const { activeBrand, config, getStepResult, tool } = ctx;
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

  // Save to content
  try {
    await saveGeneration({
      brandId: activeBrand.id,
      toolId: tool.id,
      title: `Fashion Reel — ${activeBrand.name} — ${new Date().toLocaleDateString()}`,
      type: "video",
      thumbnailUrl: curationData[0]?.selectedUrl,
      scenes: animatedResults.map((r) => ({ id: r.sceneId, title: r.title })),
      metadata: { numLooks: animatedResults.length },
    });
  } catch { /* silent */ }

  return { result: animatedResults };
};

export const fashionReels: ToolDefinition = {
  schema: {
    showAvatar: true, avatarLabel: "Model / Avatar", avatarSublabel: "Same model across all looks",
    showProduct: false,
    showClothing: true, clothingLabel: "Outfits", clothingSublabel: "each outfit = one look (multi-select)",
    showBackground: true,
    showVoice: false, showTone: false, showPlatform: false, showLanguage: false, showVariations: true,
    objectiveLabel: "Direction / Mood",
    objectivePlaceholder: "Describe the overall visual direction...",
    showNotes: false,
  },
  stepHandlers: {
    script: handleScript,
    base_image: handleBaseImage,
    multishot: handleMultishot,
    curation: handleCuration,
    animate: handleAnimate,
  },
  approvalSteps: ["script", "base_image"],
  autoRunSteps: ["base_image", "multishot"],
};
