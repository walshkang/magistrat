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
  getHostCapabilities,
  loadDocumentState,
  readDeckSnapshot,
  saveDocumentState
} from "@magistrat/office-adapter";
import type { CoverageSnapshot, DeckSnapshot, DocumentStateV1, Finding, PatchOp } from "@magistrat/shared-types";
import { useCallback, useEffect, useMemo, useState } from "react";

interface AnalysisState {
  findings: Finding[];
  safePatches: PatchOp[];
  cautionPatches: PatchOp[];
  manualPatches: PatchOp[];
  coverage: CoverageSnapshot;
  exemplarHealthScore: number;
}

export function App() {
  const [loading, setLoading] = useState(true);
  const [deck, setDeck] = useState<DeckSnapshot | null>(null);
  const [documentState, setDocumentState] = useState<DocumentStateV1 | null>(null);
  const [selectedExemplarSlideId, setSelectedExemplarSlideId] = useState<string>("");
  const [exemplarMode, setExemplarMode] = useState<"original" | "normalized">("normalized");
  const [analysisState, setAnalysisState] = useState<AnalysisState | null>(null);
  const [message, setMessage] = useState<string>("");

  const hostCapabilities = useMemo(() => getHostCapabilities(), []);

  useEffect(() => {
    let mounted = true;

    async function initialize(): Promise<void> {
      const [snapshot, state] = await Promise.all([readDeckSnapshot(), loadDocumentState()]);
      if (!mounted) {
        return;
      }

      setDeck(snapshot);
      setDocumentState(state);
      const firstSlideId = state.exemplar?.slideId ?? snapshot.slides[0]?.slideId ?? "";
      setSelectedExemplarSlideId(firstSlideId);
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
  }, []);

  const runCleanup = useCallback(async () => {
    if (!deck || !documentState) {
      return;
    }

    const exemplarSlide =
      deck.slides.find((slide) => slide.slideId === selectedExemplarSlideId) ?? deck.slides[0] ?? null;

    if (!exemplarSlide) {
      setMessage("No slide available for exemplar selection.");
      return;
    }

    const ir = buildDeckIr(deck);
    const inferred = inferRoles(ir);
    const styleMapResult = buildStyleMap(exemplarSlide, exemplarMode);
    const checks = runChecks(inferred.deck, styleMapResult.styleMap);
    const patches = planPatches(checks.findings, checks.suggestedPatches);
    const exemplarHealth = scoreExemplarHealth(exemplarSlide);

    const nextState: DocumentStateV1 = {
      ...documentState,
      exemplar: {
        slideId: exemplarSlide.slideId,
        mode: exemplarMode,
        normalizationAppliedToSlide: false,
        selectedAtIso: new Date().toISOString()
      },
      styleMap: styleMapResult.styleMap,
      findings: checks.findings,
      coverage: checks.coverage,
      lastUpdatedIso: new Date().toISOString()
    };

    await saveDocumentState(nextState);
    setDocumentState(nextState);
    setAnalysisState({
      findings: checks.findings,
      safePatches: patches.safe,
      cautionPatches: patches.caution,
      manualPatches: patches.manual,
      coverage: checks.coverage,
      exemplarHealthScore: exemplarHealth.score
    });

    setMessage(`Scan complete: ${checks.findings.length} findings.`);
  }, [deck, documentState, selectedExemplarSlideId, exemplarMode]);

  const applySafe = useCallback(async () => {
    if (!analysisState || !documentState) {
      return;
    }

    const applied = await applyPatchOps(analysisState.safePatches);
    const nextState: DocumentStateV1 = {
      ...documentState,
      patchLog: [...documentState.patchLog, ...applied],
      lastUpdatedIso: new Date().toISOString()
    };

    await saveDocumentState(nextState);
    setDocumentState(nextState);
    setMessage(`Applied ${applied.length} safe patches.`);
  }, [analysisState, documentState]);

  const ratify = useCallback(async () => {
    if (!documentState) {
      return;
    }

    const styleSignatureHash = btoa(
      JSON.stringify({
        exemplar: documentState.exemplar,
        findings: (analysisState?.findings ?? []).map((finding) => finding.id).sort()
      })
    ).slice(0, 24);

    const nextState: DocumentStateV1 = {
      ...documentState,
      ratify: {
        scope: "deck",
        styleSignatureHash,
        ratifiedAtIso: new Date().toISOString()
      },
      lastUpdatedIso: new Date().toISOString()
    };

    await saveDocumentState(nextState);
    setDocumentState(nextState);
    setMessage("Style ratified. Drift checks can run against this signature.");
  }, [analysisState?.findings, documentState]);

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
          <span>Host</span>
          <strong>{hostCapabilities.host}</strong>
          <span>Platform</span>
          <strong>{hostCapabilities.platform}</strong>
          <span>Office available</span>
          <strong>{hostCapabilities.officeAvailable ? "yes" : "no"}</strong>
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
              onChange={(event) => setExemplarMode(event.target.value as "original" | "normalized")}
            >
              <option value="original">Use Original Exemplar</option>
              <option value="normalized">Use Normalized Exemplar</option>
            </select>
          </label>

          <button onClick={() => void runCleanup()}>Run clean up</button>
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
              <span>Unhandled object types</span>
              <strong>{analysisState.coverage.topUnhandledObjectTypes.join(", ") || "none"}</strong>
              <span>Continuity coverage</span>
              <strong>{Math.round(analysisState.coverage.continuityCoverage * 100)}%</strong>
              <span>Exemplar health</span>
              <strong>{analysisState.exemplarHealthScore}/100</strong>
            </div>
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
              <button onClick={() => void applySafe()}>Apply safe ({analysisState.safePatches.length})</button>
              <button onClick={() => void ratify()}>Ratify style</button>
            </div>
          </section>
        </>
      ) : null}

      {message ? <footer className="panel info">{message}</footer> : null}
    </main>
  );
}
