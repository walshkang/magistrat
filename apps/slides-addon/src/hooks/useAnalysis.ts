import {
  buildDeckIr,
  buildStyleMap,
  inferRoles,
  planPatches,
  runChecks,
  scoreExemplarHealth
} from "@magistrat/compiler-core";
import {
  applyPatchOps,
  getPartialAppliedRecords,
  loadDocumentState,
  readDeckSnapshot,
  saveDocumentState
} from "@magistrat/google-adapter";
import type {
  CoverageSnapshot,
  DeckSnapshot,
  DocumentStateV1,
  ExemplarSelection,
  Finding,
  PatchOp,
  StyleMap
} from "@magistrat/shared-types";
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { reconcilePatchLogByRecordIdentity } from "../patchLog.js";

export interface AnalysisState {
  findings: Finding[];
  safePatches: PatchOp[];
  cautionPatches: PatchOp[];
  manualPatches: PatchOp[];
  coverage: CoverageSnapshot;
  exemplarHealthScore: number;
  styleMap: StyleMap;
  stale: boolean;
}

interface AnalyzeResult {
  analysis: AnalysisState;
  exemplarSlideId: string;
}

export interface RuntimeCapability {
  supported: boolean;
  reason?: string;
}

export interface UseAnalysisParams {
  documentState: DocumentStateV1 | null;
  setDocumentState: Dispatch<SetStateAction<DocumentStateV1 | null>>;
  setLastReconciledIso: (iso: string) => void;
  readDeckCapability: RuntimeCapability;
  applyPatchCapability: RuntimeCapability;
}

export function useAnalysis({
  documentState,
  setDocumentState,
  setLastReconciledIso,
  readDeckCapability,
  applyPatchCapability
}: UseAnalysisParams) {
  const [loading, setLoading] = useState(true);
  const [deck, setDeck] = useState<DeckSnapshot | null>(null);
  const [selectedExemplarSlideId, setSelectedExemplarSlideId] = useState<string>("");
  const [exemplarMode, setExemplarMode] = useState<ExemplarSelection["mode"]>("token_normalized");
  const [analysisState, setAnalysisState] = useState<AnalysisState | null>(null);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    async function initialize(): Promise<void> {
      const [state, snapshot] = await Promise.all([
        loadDocumentState(),
        readDeckCapability.supported ? readDeckSnapshot() : Promise.resolve(null)
      ]);

      if (!mounted) {
        return;
      }

      setDocumentState(state);
      setDeck(snapshot);

      const firstSlideId = state.exemplar?.slideId ?? snapshot?.slides[0]?.slideId ?? "";
      setSelectedExemplarSlideId(firstSlideId);
      setExemplarMode(state.exemplar?.mode ?? "token_normalized");

      const staleState = hydrateAnalysisState(state);
      if (staleState) {
        setAnalysisState(staleState);
      }

      if (!readDeckCapability.supported) {
        setMessage(readDeckCapability.reason ?? "Deck snapshot is unavailable in current mode.");
      } else if (staleState) {
        setMessage("Loaded prior scan state from document (stale until next clean up run).");
      }

      setLoading(false);
    }

    initialize().catch((error: unknown) => {
      if (mounted) {
        setMessage(`Initialization failed: ${error instanceof Error ? error.message : "unknown error"}`);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [readDeckCapability.reason, readDeckCapability.supported, setDocumentState]);

  const runCleanup = useCallback(async () => {
    if (!documentState) {
      setMessage("Deck snapshot is not available in current runtime mode.");
      return;
    }

    try {
      const latestDeck = readDeckCapability.supported ? await readDeckSnapshot() : deck;
      if (!latestDeck) {
        setMessage("Deck snapshot is not available in current runtime mode.");
        return;
      }

      const result = analyzeDeckSnapshot(latestDeck, selectedExemplarSlideId, exemplarMode);
      const nextState: DocumentStateV1 = {
        ...documentState,
        exemplar: {
          slideId: result.exemplarSlideId,
          mode: exemplarMode,
          normalizationAppliedToSlide: false,
          selectedAtIso: new Date().toISOString()
        },
        styleMap: result.analysis.styleMap,
        findings: result.analysis.findings,
        coverage: result.analysis.coverage,
        lastUpdatedIso: new Date().toISOString()
      };

      await saveDocumentState(nextState);
      setDeck(latestDeck);
      setDocumentState(nextState);
      setAnalysisState(result.analysis);
      setSelectedExemplarSlideId(result.exemplarSlideId);
      setMessage(`Scan complete: ${result.analysis.findings.length} findings.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Run clean up failed.");
    }
  }, [deck, documentState, exemplarMode, readDeckCapability.supported, selectedExemplarSlideId, setDocumentState]);

  const applyPatchesWithRefresh = useCallback(
    async (patches: PatchOp[], errorLabel: string) => {
      if (!analysisState || !documentState || !deck) {
        return;
      }

      if (!applyPatchCapability.supported) {
        setMessage(applyPatchCapability.reason ?? "Patch apply is unavailable in this runtime mode.");
        return;
      }

      if (patches.length === 0) {
        return;
      }

      try {
        const applied = await applyPatchOps(patches);
        const refreshedDeck = await readDeckSnapshot();
        const refreshed = analyzeDeckSnapshot(refreshedDeck, selectedExemplarSlideId, exemplarMode);

        const patchLog = [...documentState.patchLog, ...applied];
        const reconciledPatchLog = reconcilePatchLogByRecordIdentity(patchLog, refreshedDeck);
        const reconciledAtIso = new Date().toISOString();

        const nextState: DocumentStateV1 = {
          ...documentState,
          exemplar: {
            slideId: refreshed.exemplarSlideId,
            mode: exemplarMode,
            normalizationAppliedToSlide: false,
            selectedAtIso: documentState.exemplar?.selectedAtIso ?? new Date().toISOString()
          },
          styleMap: refreshed.analysis.styleMap,
          findings: refreshed.analysis.findings,
          coverage: refreshed.analysis.coverage,
          patchLog: reconciledPatchLog,
          lastUpdatedIso: reconciledAtIso
        };

        await saveDocumentState(nextState);
        setDeck(refreshedDeck);
        setDocumentState(nextState);
        setAnalysisState(refreshed.analysis);
        setLastReconciledIso(reconciledAtIso);
        setMessage(`Applied ${applied.length} patch(es) and reconciled ${reconciledPatchLog.length} patch records.`);
      } catch (error: unknown) {
        const partialApplied = getPartialAppliedRecords(error);
        if (partialApplied.length > 0) {
          try {
            const refreshedDeck = await readDeckSnapshot();
            const refreshed = analyzeDeckSnapshot(refreshedDeck, selectedExemplarSlideId, exemplarMode);

            const patchLog = [...documentState.patchLog, ...partialApplied];
            const reconciledPatchLog = reconcilePatchLogByRecordIdentity(patchLog, refreshedDeck);
            const reconciledAtIso = new Date().toISOString();

            const nextState: DocumentStateV1 = {
              ...documentState,
              exemplar: {
                slideId: refreshed.exemplarSlideId,
                mode: exemplarMode,
                normalizationAppliedToSlide: false,
                selectedAtIso: documentState.exemplar?.selectedAtIso ?? new Date().toISOString()
              },
              styleMap: refreshed.analysis.styleMap,
              findings: refreshed.analysis.findings,
              coverage: refreshed.analysis.coverage,
              patchLog: reconciledPatchLog,
              lastUpdatedIso: reconciledAtIso
            };

            await saveDocumentState(nextState);
            setDeck(refreshedDeck);
            setDocumentState(nextState);
            setAnalysisState(refreshed.analysis);
            setLastReconciledIso(reconciledAtIso);
            setMessage(
              `${error instanceof Error ? error.message : errorLabel} Recovered partial progress: reconciled ${partialApplied.length} applied patch records.`
            );
            return;
          } catch (recoveryError: unknown) {
            setMessage(
              `${error instanceof Error ? error.message : errorLabel} Partial progress was detected, but refresh failed: ${
                recoveryError instanceof Error ? recoveryError.message : "unknown error"
              }`
            );
            return;
          }
        }

        setMessage(error instanceof Error ? error.message : errorLabel);
      }
    },
    [
      analysisState,
      applyPatchCapability.reason,
      applyPatchCapability.supported,
      deck,
      documentState,
      exemplarMode,
      selectedExemplarSlideId,
      setDocumentState,
      setLastReconciledIso
    ]
  );

  const applySafe = useCallback(async () => {
    if (!analysisState || !documentState || !deck) {
      return;
    }
    await applyPatchesWithRefresh(analysisState.safePatches, "Apply safe failed.");
  }, [analysisState, applyPatchesWithRefresh, deck, documentState]);

  const applyForFinding = useCallback(
    async (findingId: string) => {
      if (!analysisState || !documentState || !deck) {
        return;
      }

      const finding = analysisState.findings.find((f) => f.id === findingId);
      if (!finding) {
        setMessage("Finding not found.");
        return;
      }

      if (!finding.suggestedPatchId) {
        setMessage("No suggested patch for this finding.");
        return;
      }

      const patch =
        analysisState.safePatches.find((p) => p.id === finding.suggestedPatchId) ??
        analysisState.cautionPatches.find((p) => p.id === finding.suggestedPatchId);

      if (!patch) {
        setMessage("Patch plan is unavailable for this finding (run clean up or check stale state).");
        return;
      }

      await applyPatchesWithRefresh([patch], "Apply failed.");
    },
    [analysisState, applyPatchesWithRefresh, deck, documentState]
  );

  return {
    loading,
    deck,
    setDeck,
    analysisState,
    selectedExemplarSlideId,
    setSelectedExemplarSlideId,
    exemplarMode,
    setExemplarMode,
    runCleanup,
    applySafe,
    applyForFinding,
    message,
    setMessage
  };
}

function analyzeDeckSnapshot(
  deck: DeckSnapshot,
  selectedExemplarSlideId: string,
  exemplarMode: ExemplarSelection["mode"]
): AnalyzeResult {
  const exemplarSlide =
    deck.slides.find((slide) => slide.slideId === selectedExemplarSlideId) ?? deck.slides[0] ?? null;

  if (!exemplarSlide) {
    throw new Error("No slide available for exemplar selection.");
  }

  const ir = buildDeckIr(deck);
  const inferred = inferRoles(ir);
  const styleMapResult = buildStyleMap(exemplarSlide, exemplarMode);
  const checks = runChecks(inferred.deck, styleMapResult.styleMap);
  const patches = planPatches(checks.findings, checks.suggestedPatches);
  const exemplarHealth = scoreExemplarHealth(exemplarSlide);

  return {
    exemplarSlideId: exemplarSlide.slideId,
    analysis: {
      findings: checks.findings,
      safePatches: patches.safe,
      cautionPatches: patches.caution,
      manualPatches: patches.manual,
      coverage: checks.coverage,
      exemplarHealthScore: exemplarHealth.score,
      styleMap: styleMapResult.styleMap,
      stale: false
    }
  };
}

function hydrateAnalysisState(state: DocumentStateV1): AnalysisState | null {
  if (!state.coverage || state.findings.length === 0) {
    return null;
  }

  return {
    findings: state.findings,
    safePatches: [],
    cautionPatches: [],
    manualPatches: [],
    coverage: state.coverage,
    exemplarHealthScore: 0,
    styleMap: state.styleMap ?? {},
    stale: true
  };
}
