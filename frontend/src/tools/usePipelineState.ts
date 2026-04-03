/**
 * Coevo Studio — Pipeline State Hook
 * ────────────────────────────────────
 * Custom hook that manages all pipeline state.
 * Extracted from ToolRunPage to keep the page slim.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type { StepState, StepStatus, ToolConfig, AudioCacheEntry, ScriptScene } from "./types";
import { DEFAULT_CONFIG, extractScenes } from "./types";

export function usePipelineState(pipeline: string[]) {
  const [steps, setSteps] = useState<StepState[]>(
    pipeline.map((id) => ({ id, status: "pending" as StepStatus }))
  );
  const stepsRef = useRef<StepState[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [started, setStarted] = useState(false);
  const [config, setConfig] = useState<ToolConfig>(DEFAULT_CONFIG);
  const [curationSelections, setCurationSelections] = useState<Record<string, string>>({});
  const [audioCache, setAudioCacheState] = useState<Record<string, AudioCacheEntry>>({});
  const audioCacheRef = useRef<Record<string, AudioCacheEntry>>({});

  // Keep refs in sync
  useEffect(() => { stepsRef.current = steps; }, [steps]);
  useEffect(() => { audioCacheRef.current = audioCache; }, [audioCache]);

  // Reset when pipeline changes
  useEffect(() => {
    setSteps(pipeline.map((id) => ({ id, status: "pending" as StepStatus })));
    setActiveStep(0);
    setStarted(false);
  }, [pipeline.join(",")]);

  const getStepResult = useCallback((stepId: string) => {
    return stepsRef.current.find((s) => s.id === stepId)?.result;
  }, []);

  const getScriptScenes = useCallback((): ScriptScene[] => {
    return extractScenes(getStepResult("script"));
  }, [getStepResult]);

  const setAudioCache = useCallback((sceneId: string, entry: AudioCacheEntry) => {
    setAudioCacheState((p) => ({ ...p, [sceneId]: entry }));
  }, []);

  const setStepRunning = useCallback((stepIndex: number) => {
    setSteps((prev) => prev.map((s, i) =>
      i === stepIndex ? { ...s, status: "running" as StepStatus } : s
    ));
  }, []);

  const failStep = useCallback((stepIndex: number, error: string) => {
    setSteps((prev) => prev.map((s, i) =>
      i === stepIndex ? { ...s, status: "error" as StepStatus, error } : s
    ));
  }, []);

  const advanceStep = useCallback((
    stepIndex: number,
    result?: unknown,
    opts?: { needsApproval?: boolean }
  ) => {
    if (opts?.needsApproval) {
      setSteps((prev) => prev.map((s, i) =>
        i === stepIndex ? { ...s, status: "review" as StepStatus, result } : s
      ));
      return;
    }
    setSteps((prev) => prev.map((s, i) => {
      if (i === stepIndex) return { ...s, status: "done" as StepStatus, result };
      if (i === stepIndex + 1) return { ...s, status: s.id === "curation" ? "review" as StepStatus : "active" as StepStatus };
      return s;
    }));
    if (stepIndex < steps.length - 1) {
      setActiveStep(stepIndex + 1);
    }
  }, [steps.length]);

  const approveStep = useCallback((stepIndex: number, customResult?: unknown) => {
    setSteps((prev) => prev.map((s, i) => {
      if (i === stepIndex) return { ...s, status: "done" as StepStatus, result: customResult ?? s.result };
      if (i === stepIndex + 1) return { ...s, status: s.id === "curation" ? "review" as StepStatus : "active" as StepStatus };
      return s;
    }));
    if (stepIndex < steps.length - 1) {
      setActiveStep(stepIndex + 1);
    }
  }, [steps.length]);

  const reset = useCallback(() => {
    setStarted(false);
    setActiveStep(0);
    setSteps((prev) => prev.map((s) => ({ ...s, status: "pending" as StepStatus, result: undefined, error: undefined })));
    setCurationSelections({});
  }, []);

  const start = useCallback(() => {
    setStarted(true);
    setActiveStep(0);
    setSteps((prev) => prev.map((s, i) => ({
      ...s, status: i === 0 ? "active" as StepStatus : "pending" as StepStatus,
    })));
  }, []);

  return {
    steps, activeStep, setActiveStep, started, config, setConfig,
    curationSelections, setCurationSelections,
    audioCache, audioCacheRef, setAudioCache,
    getStepResult, getScriptScenes,
    setStepRunning, failStep, advanceStep, approveStep,
    reset, start,
  };
}
