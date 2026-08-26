/**
 * Auto-save helper — shared across tools.
 * Creates a draft generation on the first step, then updates it on every subsequent step.
 * genId is persisted in sessionStorage keyed by toolId+brandId so reloads keep the same draft.
 */

import { saveGeneration, updateGeneration, getCampaign, updateCampaign, type Generation, type Brand } from "../../lib/api";
import type { ToolConfig, ToolEntry, StepState } from "../types";

const GEN_ID_KEY = (toolId: string, brandId: string) => `__genId:${toolId}:${brandId}`;

export function getActiveGenId(toolId: string, brandId: string): string | null {
  try {
    return sessionStorage.getItem(GEN_ID_KEY(toolId, brandId));
  } catch {
    return null;
  }
}

export function setActiveGenId(toolId: string, brandId: string, genId: string | null) {
  try {
    if (genId) sessionStorage.setItem(GEN_ID_KEY(toolId, brandId), genId);
    else sessionStorage.removeItem(GEN_ID_KEY(toolId, brandId));
  } catch {
    /* no-op */
  }
}

export interface AutoSavePayload {
  title?: string;
  type: "video" | "image" | "copy";
  status?: "draft" | "in_progress" | "completed";
  thumbnailUrl?: string;
  outputUrl?: string;
  scenes?: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
}

export interface AutoSaveInput {
  activeBrand: Brand;
  tool: ToolEntry;
  config: ToolConfig;
  steps: StepState[];
  curationSelections?: Record<string, string>;
  /** Tandas acumulativas para tools multi-shot (ecommerce_pack, etc). Sin esto,
   *  abrir un run viejo desde /content solo muestra la última tanda — perdés
   *  el resto del catálogo. Se persiste opaco como Record[]. */
  batches?: Array<Record<string, unknown>>;
  payload: AutoSavePayload;
}

/**
 * Persist the current pipeline state. Creates a new draft on the first call,
 * updates the same generation on subsequent calls.
 */
export async function autoSaveStep(input: AutoSaveInput): Promise<Generation | null> {
  try {
    const { activeBrand, tool, config, steps, curationSelections, batches, payload } = input;
    const genId = getActiveGenId(tool.id, activeBrand.id);

    const pipelineState: Record<string, unknown> = {
      steps: steps.map((s) => ({ id: s.id, status: s.status, result: s.result })),
      config: config as unknown as Record<string, unknown>,
      curationSelections,
    };
    if (batches && batches.length > 0) pipelineState.batches = batches;

    const body = {
      brandId: activeBrand.id,
      toolId: tool.id,
      title: payload.title || `${tool.name} — ${new Date().toLocaleDateString()}`,
      type: payload.type,
      status: payload.status || "in_progress",
      thumbnailUrl: payload.thumbnailUrl,
      outputUrl: payload.outputUrl,
      scenes: payload.scenes,
      metadata: payload.metadata,
      pipelineState,
    };

    if (genId) {
      return await updateGeneration(genId, body);
    }
    const created = await saveGeneration(body);
    setActiveGenId(tool.id, activeBrand.id, created.id);
    await linkToCampaign(created.id);
    return created;
  } catch (err) {
    console.warn("[autoSaveStep] failed:", err);
    return null;
  }
}

/**
 * Cuelga una corrida del pedido del que salió, si vino de uno.
 *
 * El id del pedido viaja en la URL (`?campaign=…`) desde que apretás "Abrir en una tool".
 * Se lee de acá y no de ToolRunPage a propósito: esta capa ya es el único lugar por donde
 * pasan TODAS las tools, así que ninguna necesita enterarse. Sin esto, un pedido nunca
 * acumula sus piezas ni su costo — que es justamente para lo que existe.
 *
 * No bloquea nada: si falla, la corrida se guardó igual y solo queda suelta.
 */
async function linkToCampaign(genId: string) {
  try {
    const campaignId = new URLSearchParams(window.location.search).get("campaign");
    if (!campaignId) return;
    const campaign = await getCampaign(campaignId);
    const ids = campaign.generationIds || [];
    if (ids.includes(genId)) return;
    await updateCampaign(campaignId, {
      generationIds: [...ids, genId],
      // Si el pedido estaba en borrador, arrancó a producirse.
      ...(campaign.status === "draft" ? { status: "generating" as const } : {}),
    });
  } catch (e) {
    console.warn("[autoSaveStep] no se pudo colgar la corrida del pedido:", e);
  }
}

export function clearActiveGen(toolId: string, brandId: string) {
  setActiveGenId(toolId, brandId, null);
}
