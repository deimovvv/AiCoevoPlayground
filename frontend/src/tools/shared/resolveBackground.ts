import type { Brand, BackgroundItem } from "../../lib/api";
import type { ScriptScene, ToolConfig } from "../types";

/**
 * Resolve which background to use for a specific scene.
 *
 * Resolution rules:
 *   scene.backgroundId === null       → no background (force text-only)
 *   scene.backgroundId === string     → use that specific background asset
 *   scene.backgroundId === undefined  → fall back to config.selectedBackgroundId (global)
 *
 * @returns the BackgroundItem to use, or null if no background should be applied
 */
export function resolveSceneBackground(
  scene: ScriptScene | undefined,
  config: ToolConfig,
  brand: Brand,
): BackgroundItem | null {
  if (!scene) return null;

  // Explicit null on scene → force no background
  if (scene.backgroundId === null) return null;

  // Scene has specific background → use it
  const sceneId = scene.backgroundId ?? config.selectedBackgroundId;
  if (!sceneId) return null;

  return (brand.backgrounds || []).find((bg) => bg.id === sceneId) ?? null;
}
