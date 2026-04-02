import {
  buildDeckIr,
  buildStyleMap,
  computeAlignmentScore,
  inferCandidateRules,
  inferRoles,
  mergeStyleMaps,
  planMasterPatches,
  planPatches,
  runChecks,
  scoreExemplarHealth,
  type AlignmentScore,
  type MasterLayoutSnapshot
} from "@magistrat/compiler-core";
import {
  applyMasterPatches,
  applyPatchOps,
  getPartialAppliedRecords,
  loadDocumentState,
  readDeckSnapshot,
  readMasterLayouts,
  saveDocumentState
} from "@magistrat/google-adapter";
import { importRuleProfileJson } from "@magistrat/shared-types";
import type {
  CandidateRule,
  CoverageSnapshot,
  DeckSnapshot,
  DocumentStateV1,
  ExemplarSelection,
  Finding,
  PatchOp,
  RoleStyleTokens,
  RoleV1,
  RuleProfile,
  StyleMap
} from "@magistrat/shared-types";
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { reconcilePatchLogByRecordIdentity } from "../patchLog.js";

/** Shown after a rule profile is loaded from JSON (App closes import UI when this message is set). */
export const PROFILE_LOADED_MESSAGE = "Profile loaded. Ready to scan.";

export interface AnalysisState {
  findings: Finding[];
  safePatches: PatchOp[];
  cautionPatches: PatchOp[];
  manualPatches: PatchOp[];
  coverage: CoverageSnapshot;
  exemplarHealthScore: number;
  styleMap: StyleMap;
  stale: boolean;
  alignmentScore: AlignmentScore;
}

interface AnalyzeResult {
  analysis: AnalysisState;
  exemplarSlideId: string;
}

interface StyleMapPhaseResult {
  deck: DeckSnapshot;
  exemplarSlideId: string;
  exemplarMode: ExemplarSelection["mode"];
  styleMap: StyleMap;
  exemplarHealthScore: number;
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
  const [additionalExemplarSlideIds, setAdditionalExemplarSlideIds] = useState<string[]>([]);
  const [exemplarMode, setExemplarMode] = useState<ExemplarSelection["mode"]>("token_normalized");
  const [analysisState, setAnalysisState] = useState<AnalysisState | null>(null);
  const [message, setMessage] = useState<string>("");
  const [pendingRuleConfirmation, setPendingRuleConfirmation] = useState<{
    deck: DeckSnapshot;
    exemplarSlideId: string;
    exemplarMode: ExemplarSelection["mode"];
    styleMap: StyleMap;
    candidates: CandidateRule[];
    exemplarHealthScore: number;
  } | null>(null);

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
      setAdditionalExemplarSlideIds(state.exemplar?.additionalSlideIds ?? []);
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
      if (documentState.ruleProfile) {
        const stylePhase = runStyleMapPhase(
          latestDeck,
          selectedExemplarSlideId,
          exemplarMode,
          additionalExemplarSlideIds
        );
        const filteredStyleMap = filterStyleMapByCandidates(
          stylePhase.styleMap,
          documentState.ruleProfile.rules
        );
        const result = finishAnalysisFromStyleMap({ ...stylePhase, styleMap: filteredStyleMap });
        const nextState: DocumentStateV1 = {
          ...documentState,
          exemplar: {
            slideId: result.exemplarSlideId,
            mode: exemplarMode,
            normalizationAppliedToSlide: false,
            selectedAtIso: new Date().toISOString(),
            ...(additionalExemplarSlideIds.length ? { additionalSlideIds: additionalExemplarSlideIds } : {})
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
        return;
      }

      const stylePhase = runStyleMapPhase(
        latestDeck,
        selectedExemplarSlideId,
        exemplarMode,
        additionalExemplarSlideIds
      );
      const inferred = inferCandidateRules(stylePhase.styleMap);
      setPendingRuleConfirmation({
        deck: latestDeck,
        exemplarSlideId: stylePhase.exemplarSlideId,
        exemplarMode,
        styleMap: stylePhase.styleMap,
        candidates: inferred.candidates.map((c) => ({ ...c })),
        exemplarHealthScore: stylePhase.exemplarHealthScore
      });
      setDeck(latestDeck);
      setSelectedExemplarSlideId(stylePhase.exemplarSlideId);
      setMessage("Review inferred rules before running full scan.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Run clean up failed.");
    }
  }, [
    additionalExemplarSlideIds,
    deck,
    documentState,
    exemplarMode,
    readDeckCapability.supported,
    selectedExemplarSlideId,
    setDocumentState
  ]);

  const confirmRulesAndFinalize = useCallback(
    async (candidates: CandidateRule[], mode: "save" | "defaults") => {
      if (!documentState || !pendingRuleConfirmation) {
        return;
      }

      const { deck: phaseDeck, exemplarSlideId, exemplarMode: phaseMode, styleMap } = pendingRuleConfirmation;
      try {
        const nowIso = new Date().toISOString();
        const profileName =
          phaseDeck.slides.find((s) => s.slideId === exemplarSlideId)?.title || "Inferred rules";
        const nextRuleProfile: RuleProfile | undefined =
          mode === "save"
            ? {
                id: globalThis.crypto?.randomUUID
                  ? globalThis.crypto.randomUUID()
                  : `rule-profile-${Date.now()}`,
                name: profileName,
                updatedAtIso: nowIso,
                sourceSlideIds: [exemplarSlideId],
                rules: candidates
              }
            : undefined;

        const filteredStyleMap =
          mode === "save" ? filterStyleMapByCandidates(styleMap, candidates) : styleMap;
        const filteredResult = finishAnalysisFromStyleMap({
          ...pendingRuleConfirmation,
          styleMap: filteredStyleMap
        });

        const nextState: DocumentStateV1 = {
          ...documentState,
          exemplar: {
            slideId: filteredResult.exemplarSlideId,
            mode: phaseMode,
            normalizationAppliedToSlide: false,
            selectedAtIso: nowIso,
            ...(additionalExemplarSlideIds.length ? { additionalSlideIds: additionalExemplarSlideIds } : {})
          },
          styleMap: filteredResult.analysis.styleMap,
          findings: filteredResult.analysis.findings,
          coverage: filteredResult.analysis.coverage,
          lastUpdatedIso: nowIso,
          ...(nextRuleProfile !== undefined ? { ruleProfile: nextRuleProfile } : {})
        };

        await saveDocumentState(nextState);
        setDeck(phaseDeck);
        setDocumentState(nextState);
        setAnalysisState(filteredResult.analysis);
        setSelectedExemplarSlideId(filteredResult.exemplarSlideId);
        setPendingRuleConfirmation(null);
        setMessage(`Scan complete: ${filteredResult.analysis.findings.length} findings.`);
      } catch (error: unknown) {
        setMessage(error instanceof Error ? error.message : "Rule confirmation failed.");
      }
    },
    [additionalExemplarSlideIds, documentState, pendingRuleConfirmation, setDocumentState]
  );

  const openRuleConfirmationEditor = useCallback(() => {
    if (!documentState || !analysisState || !deck) {
      return;
    }

    const fallbackSlide = deck.slides[0];
    if (!fallbackSlide) {
      return;
    }

    const styleMap = analysisState.styleMap;
    const inferred = inferCandidateRules(styleMap);
    const baseCandidates = inferred.candidates.map((c) => ({ ...c }));
    const profile = documentState.ruleProfile;

    const mergedCandidates =
      profile && profile.rules.length > 0
        ? baseCandidates.map((candidate) => {
            const match = profile.rules.find((r) => r.id === candidate.id);
            if (!match) return candidate;
            return { ...candidate, enabled: match.enabled };
          })
        : baseCandidates;

    const exemplarSlideId =
      documentState.exemplar?.slideId ?? fallbackSlide.slideId ?? selectedExemplarSlideId;
    const exemplarHealth = scoreExemplarHealth(
      deck.slides.find((s) => s.slideId === exemplarSlideId) ?? fallbackSlide
    );

    setPendingRuleConfirmation({
      deck,
      exemplarSlideId,
      exemplarMode,
      styleMap,
      candidates: mergedCandidates,
      exemplarHealthScore: exemplarHealth.score
    });
  }, [analysisState, deck, documentState, exemplarMode, selectedExemplarSlideId]);

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
        const stylePhase = runStyleMapPhase(
          refreshedDeck,
          selectedExemplarSlideId,
          exemplarMode,
          additionalExemplarSlideIds
        );
        const refreshed = finishAnalysisFromStyleMap(stylePhase);

        const patchLog = [...documentState.patchLog, ...applied];
        const reconciledPatchLog = reconcilePatchLogByRecordIdentity(patchLog, refreshedDeck);
        const reconciledAtIso = new Date().toISOString();

        const nextState: DocumentStateV1 = {
          ...documentState,
          exemplar: {
            slideId: refreshed.exemplarSlideId,
            mode: exemplarMode,
            normalizationAppliedToSlide: false,
            selectedAtIso: documentState.exemplar?.selectedAtIso ?? new Date().toISOString(),
            ...(additionalExemplarSlideIds.length ? { additionalSlideIds: additionalExemplarSlideIds } : {})
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
            const stylePhase = runStyleMapPhase(
              refreshedDeck,
              selectedExemplarSlideId,
              exemplarMode,
              additionalExemplarSlideIds
            );
            const refreshed = finishAnalysisFromStyleMap(stylePhase);

            const patchLog = [...documentState.patchLog, ...partialApplied];
            const reconciledPatchLog = reconcilePatchLogByRecordIdentity(patchLog, refreshedDeck);
            const reconciledAtIso = new Date().toISOString();

            const nextState: DocumentStateV1 = {
              ...documentState,
              exemplar: {
                slideId: refreshed.exemplarSlideId,
                mode: exemplarMode,
                normalizationAppliedToSlide: false,
                selectedAtIso: documentState.exemplar?.selectedAtIso ?? new Date().toISOString(),
                ...(additionalExemplarSlideIds.length ? { additionalSlideIds: additionalExemplarSlideIds } : {})
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
      additionalExemplarSlideIds,
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

  const loadProfileFromJson = useCallback(
    async (json: string) => {
      if (!documentState) {
        return;
      }

      let profile: RuleProfile;
      try {
        profile = importRuleProfileJson(json);
      } catch {
        setMessage("Invalid profile JSON — check format.");
        return;
      }

      const nowIso = new Date().toISOString();
      const nextState: DocumentStateV1 = {
        ...documentState,
        lastUpdatedIso: nowIso,
        ...(profile !== undefined ? { ruleProfile: profile } : {})
      };

      try {
        await saveDocumentState(nextState);
        setDocumentState(nextState);
        setMessage(PROFILE_LOADED_MESSAGE);
      } catch (error: unknown) {
        setMessage(error instanceof Error ? error.message : "Failed to save profile.");
      }
    },
    [documentState, setDocumentState]
  );

  const applyToMaster = useCallback(async () => {
    if (!analysisState) {
      setMessage("Run a scan first to build the style map.");
      return;
    }

    try {
      setMessage("Reading master/layout structure...");
      const bridgeLayouts = await readMasterLayouts();

      // Bridge returns GoogleBridgeMasterLayouts which matches MasterLayoutSnapshot shape
      const masterLayouts: MasterLayoutSnapshot = bridgeLayouts;

      const plan = planMasterPatches(analysisState.styleMap, masterLayouts);

      if (plan.matched.length === 0) {
        setMessage(
          `No placeholders matched any StyleMap roles. ${plan.skipped.length} placeholder(s) skipped.`
        );
        return;
      }

      setMessage(`Applying style to ${plan.matched.length} placeholder(s)...`);
      await applyMasterPatches(plan.requests);

      const roles = [...new Set(plan.matched.map((m) => m.role))].join(", ");
      setMessage(
        `Master updated: ${plan.matched.length} placeholder(s) restyled (${roles}). ${plan.skipped.length} skipped.`
      );
    } catch (error: unknown) {
      setMessage(
        error instanceof Error ? error.message : "Failed to apply style to master."
      );
    }
  }, [analysisState, setMessage]);

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
    additionalExemplarSlideIds,
    setAdditionalExemplarSlideIds,
    exemplarMode,
    setExemplarMode,
    runCleanup,
    pendingRuleConfirmation,
    setPendingRuleConfirmation,
    confirmRulesAndFinalize,
    openRuleConfirmationEditor,
    applySafe,
    applyForFinding,
    loadProfileFromJson,
    applyToMaster,
    message,
    setMessage
  };
}

function runStyleMapPhase(
  deck: DeckSnapshot,
  selectedExemplarSlideId: string,
  exemplarMode: ExemplarSelection["mode"],
  additionalSlideIds: string[]
): StyleMapPhaseResult {
  const exemplarSlide =
    deck.slides.find((slide) => slide.slideId === selectedExemplarSlideId) ?? deck.slides[0] ?? null;

  if (!exemplarSlide) {
    throw new Error("No slide available for exemplar selection.");
  }

  const primaryStyleMap = buildStyleMap(exemplarSlide, exemplarMode).styleMap;
  const additionalStyleMaps: StyleMap[] = [];
  for (const id of additionalSlideIds) {
    const slide = deck.slides.find((s) => s.slideId === id);
    if (slide) {
      additionalStyleMaps.push(buildStyleMap(slide, exemplarMode).styleMap);
    }
  }
  const styleMap = mergeStyleMaps(primaryStyleMap, ...additionalStyleMaps);
  const exemplarHealth = scoreExemplarHealth(exemplarSlide);

  return {
    exemplarSlideId: exemplarSlide.slideId,
    exemplarMode,
    styleMap,
    exemplarHealthScore: exemplarHealth.score,
    deck
  };
}

function finishAnalysisFromStyleMap(phase: StyleMapPhaseResult): AnalyzeResult {
  const { deck, exemplarSlideId, styleMap } = phase;
  const exemplarSlide =
    deck.slides.find((slide) => slide.slideId === exemplarSlideId) ?? deck.slides[0] ?? null;

  if (!exemplarSlide) {
    throw new Error("No slide available for exemplar selection.");
  }

  const ir = buildDeckIr(deck);
  const inferred = inferRoles(ir);
  const checks = runChecks(inferred.deck, styleMap);
  const alignmentScore = computeAlignmentScore(checks.findings, checks.coverage);
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
      styleMap,
      stale: false,
      alignmentScore
    }
  };
}

/**
 * Remove style map entries for properties the user disabled in the rule confirmation panel.
 * This causes `runChecks` to skip those checks (no expected value = no finding).
 */
function filterStyleMapByCandidates(
  styleMap: StyleMap,
  candidates: CandidateRule[]
): StyleMap {
  const disabledByRole = new Map<string, Set<string>>();
  for (const c of candidates) {
    if (c.enabled) continue;
    let set = disabledByRole.get(c.role);
    if (!set) {
      set = new Set();
      disabledByRole.set(c.role, set);
    }
    set.add(c.property);
  }

  if (disabledByRole.size === 0) return styleMap;

  const filtered: StyleMap = {};
  for (const [role, tokens] of Object.entries(styleMap) as [RoleV1, RoleStyleTokens][]) {
    const disabled = disabledByRole.get(role);
    if (!disabled) {
      filtered[role] = tokens;
      continue;
    }

    const copy = { ...tokens };
    // Null out disabled properties so runChecks skips the comparison
    if (disabled.has("fontFamily")) copy.fontFamily = "";
    if (disabled.has("fontColor")) copy.fontColor = "";
    if (disabled.has("lineSpacing")) copy.lineSpacing = undefined;
    if (disabled.has("bulletIndent")) {
      copy.bulletIndent = undefined;
      copy.bulletHanging = undefined;
    }
    if (disabled.has("bulletGlyph")) copy.bulletGlyph = undefined;
    if (disabled.has("fillColor")) copy.fillColor = undefined;
    if (disabled.has("geometryBand")) {
      copy.hasGeometryCluster = false;
      delete copy.geometryCentroid;
    }
    // fontSizePt and bold/italic: set to match-anything sentinels
    // For these, we can't null them (they're required). Instead we rely on
    // the fact that checks compare observed vs expected — if we set expected
    // to match observed, no finding is emitted. But we don't have observed here.
    // Best approach: remove the entire role entry if ALL properties are disabled.
    const allProps = ["fontFamily", "fontSizePt", "fontColor", "bold", "italic", "lineSpacing", "bulletIndent", "bulletGlyph", "fillColor", "geometryBand"];
    const allDisabled = allProps.every((p) => disabled.has(p));
    if (allDisabled) {
      // Skip the role entirely — no findings for this role
      continue;
    }

    filtered[role] = copy;
  }

  return filtered;
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
    stale: true,
    alignmentScore: computeAlignmentScore(state.findings, state.coverage)
  };
}
