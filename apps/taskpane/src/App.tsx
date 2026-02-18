import {
  buildDeckIr,
  buildStyleMap,
  buildStyleSignature,
  inferRoles,
  planPatches,
  reconcilePatches,
  runChecks,
  scoreExemplarHealth
} from "@magistrat/compiler-core";
import {
  applyPatchOps,
  getRuntimeStatus,
  loadDocumentState,
  readDeckSnapshot,
  saveDocumentState
} from "@magistrat/office-adapter";
import type {
  CoverageSnapshot,
  DeckSnapshot,
  DocumentStateV1,
  ExemplarSelection,
  Finding,
  PatchOp,
  StyleMap
} from "@magistrat/shared-types";
import { useCallback, useEffect, useMemo, useState } from "react";

interface AnalysisState {
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

export function App() {
  const runtimeStatus = useMemo(() => getRuntimeStatus(), []);
  const hostCapabilities = runtimeStatus.hostCapabilities;
  const readDeckCapability = runtimeStatus.capabilities.readDeckSnapshot;
  const applyPatchCapability = runtimeStatus.capabilities.applyPatchOps;

  const [loading, setLoading] = useState(true);
  const [deck, setDeck] = useState<DeckSnapshot | null>(null);
  const [documentState, setDocumentState] = useState<DocumentStateV1 | null>(null);
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
        setMessage(readDeckCapability.reason ?? "Deck snapshot is unavailable in this mode.");
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
  }, [readDeckCapability.reason, readDeckCapability.supported]);

  const runCleanup = useCallback(async () => {
    if (!deck || !documentState) {
      setMessage("Deck snapshot is not available in current runtime mode.");
      return;
    }

    try {
      const result = analyzeDeckSnapshot(deck, selectedExemplarSlideId, exemplarMode);
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
      setDocumentState(nextState);
      setAnalysisState(result.analysis);
      setSelectedExemplarSlideId(result.exemplarSlideId);
      setMessage(`Scan complete: ${result.analysis.findings.length} findings.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Run clean up failed.");
    }
  }, [deck, documentState, exemplarMode, selectedExemplarSlideId]);

  const applySafe = useCallback(async () => {
    if (!analysisState || !documentState || !deck) {
      return;
    }

    if (!applyPatchCapability.supported) {
      setMessage(applyPatchCapability.reason ?? "Patch apply is unavailable in this runtime mode.");
      return;
    }

    try {
      const applied = await applyPatchOps(analysisState.safePatches);
      const refreshedDeck = await readDeckSnapshot();
      const refreshed = analyzeDeckSnapshot(refreshedDeck, selectedExemplarSlideId, exemplarMode);

      const patchLog = [...documentState.patchLog, ...applied];
      const reconcileResults = reconcilePatches(patchLog, refreshedDeck);
      const reconcileMap = new Map(reconcileResults.map((result) => [result.patch.id, result.nextState]));
      const reconciledPatchLog = patchLog.map((patch) => ({
        ...patch,
        reconcileState: reconcileMap.get(patch.id) ?? patch.reconcileState
      }));

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
        lastUpdatedIso: new Date().toISOString()
      };

      await saveDocumentState(nextState);
      setDeck(refreshedDeck);
      setDocumentState(nextState);
      setAnalysisState(refreshed.analysis);
      setMessage(`Applied ${applied.length} safe patches and reconciled ${reconciledPatchLog.length} patch records.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Apply safe failed.");
    }
  }, [analysisState, applyPatchCapability.reason, applyPatchCapability.supported, deck, documentState, exemplarMode, selectedExemplarSlideId]);

  const ratify = useCallback(async () => {
    if (!documentState) {
      return;
    }

    const findings = analysisState?.findings ?? documentState.findings;
    const styleMap = analysisState?.styleMap ?? documentState.styleMap;
    const signature = buildStyleSignature(documentState.exemplar, styleMap, findings);

    const nextState: DocumentStateV1 = {
      ...documentState,
      ratify: {
        scope: "deck",
        styleSignatureHash: signature.styleSignatureHash,
        basisSummary: signature.basisSummary,
        ratifiedAtIso: new Date().toISOString()
      },
      lastUpdatedIso: new Date().toISOString()
    };

    await saveDocumentState(nextState);
    setDocumentState(nextState);
    setMessage(
      `Style ratified. Basis: roles=${signature.basisSummary.roleCount}, tokens=${signature.basisSummary.tokenCount}, rules=${signature.basisSummary.ruleIds.length}.`
    );
  }, [analysisState?.findings, analysisState?.styleMap, documentState]);

  if (loading) {
    return <main className="shell">Loading Magistrat bootstrap...</main>;
  }

  return (
    <main className="shell">
      <header className="header">
        <h1>Magistrat</h1>
        <p>Trust-first PowerPoint compiler workflow.</p>
      </header>

      {!hostCapabilities.desktopSupported ? (
        <section className="panel warning">
          <h2>Unsupported host</h2>
          <p>
            This build targets PowerPoint desktop on Windows or Mac. Current host={hostCapabilities.host},
            platform={hostCapabilities.platform}.
          </p>
        </section>
      ) : null}

      <section className="panel">
        <h2>Session diagnostics</h2>
        <div className="grid">
          <span>Runtime mode</span>
          <strong>{runtimeStatus.mode}</strong>
          <span>Host</span>
          <strong>{hostCapabilities.host}</strong>
          <span>Platform</span>
          <strong>{hostCapabilities.platform}</strong>
          <span>Office available</span>
          <strong>{hostCapabilities.officeAvailable ? "yes" : "no"}</strong>
          <span>Read deck</span>
          <strong>{runtimeStatus.capabilities.readDeckSnapshot.supported ? "yes" : "no"}</strong>
          <span>Apply patches</span>
          <strong>{runtimeStatus.capabilities.applyPatchOps.supported ? "yes" : "no"}</strong>
          <span>Schema version</span>
          <strong>{documentState?.schemaVersion ?? 1}</strong>
          <span>Last updated</span>
          <strong>{documentState?.lastUpdatedIso ?? "-"}</strong>
        </div>
      </section>

      <section className="panel">
        <h2>Exemplar setup</h2>
        <div className="controls">
          <label>
            Exemplar slide
            <select
              value={selectedExemplarSlideId}
              onChange={(event) => setSelectedExemplarSlideId(event.target.value)}
              disabled={!deck}
            >
              {deck?.slides.map((slide) => (
                <option key={slide.slideId} value={slide.slideId}>
                  {slide.index}. {slide.title || slide.slideId}
                </option>
              ))}
            </select>
          </label>

          <label>
            Style map mode
            <select
              value={exemplarMode}
              onChange={(event) => setExemplarMode(event.target.value as ExemplarSelection["mode"])}
            >
              <option value="original">Use Original Exemplar</option>
              <option value="token_normalized">Use Normalized Exemplar (token-only preview)</option>
            </select>
          </label>

          <button onClick={() => void runCleanup()} disabled={!deck}>
            Run clean up
          </button>
        </div>
      </section>

      {analysisState ? (
        <>
          <section className="panel">
            <h2>Coverage meter</h2>
            <div className="grid">
              <span>Analyzed slides</span>
              <strong>
                {analysisState.coverage.analyzedSlides}/{analysisState.coverage.totalSlides}
              </strong>
              <span>Analyzed objects</span>
              <strong>
                {analysisState.coverage.analyzedObjects}/{analysisState.coverage.totalObjects}
              </strong>
              <span>Not analyzed objects</span>
              <strong>{analysisState.coverage.notAnalyzedObjects}</strong>
              <span>Unhandled object types</span>
              <strong>{analysisState.coverage.topUnhandledObjectTypes.join(", ") || "none"}</strong>
              <span>Continuity status</span>
              <strong>{analysisState.coverage.continuityStatus}</strong>
              <span>Continuity coverage</span>
              <strong>{Math.round(analysisState.coverage.continuityCoverage * 100)}%</strong>
              <span>Exemplar health</span>
              <strong>{analysisState.exemplarHealthScore}/100</strong>
            </div>
            {analysisState.stale ? <p>Loaded from persisted state; run clean up to refresh against current deck.</p> : null}
          </section>

          <section className="panel">
            <h2>Findings</h2>
            <p>{analysisState.findings.length} total findings.</p>
            <ul>
              {analysisState.findings.slice(0, 8).map((finding) => (
                <li key={finding.id}>
                  <strong>{finding.ruleId}</strong> [{finding.severity}/{finding.risk}] on {finding.slideId}
                  {finding.objectId ? `:${finding.objectId}` : ""}
                  {finding.coverage === "NOT_ANALYZED" && finding.notAnalyzedReason
                    ? ` (NOT_ANALYZED:${finding.notAnalyzedReason})`
                    : ""}
                </li>
              ))}
            </ul>
            <div className="actions">
              <button
                onClick={() => void applySafe()}
                disabled={!applyPatchCapability.supported || analysisState.safePatches.length === 0}
                title={applyPatchCapability.reason}
              >
                Apply safe ({analysisState.safePatches.length})
              </button>
              <button onClick={() => void ratify()}>Ratify style</button>
            </div>
          </section>
        </>
      ) : null}

      {message ? <footer className="panel info">{message}</footer> : null}
    </main>
  );
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
