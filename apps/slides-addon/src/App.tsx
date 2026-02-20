import {
  buildDeckIr,
  buildStyleMap,
  buildStyleSignature,
  inferRoles,
  planPatches,
  runChecks,
  scoreExemplarHealth
} from "@magistrat/compiler-core";
import {
  applyPatchOps,
  getDocumentId,
  getPartialAppliedRecords,
  getRuntimeStatus,
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
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildSafeRestoreOps,
  countReconcileStates,
  countStateTransitions,
  getRestoreUiDisabledReason,
  groupPatchRecordsByAppliedAtIso,
  reconcilePatchLogByRecordIdentity
} from "./patchLog.js";

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
  const [lastReconciledIso, setLastReconciledIso] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const patchLogGroups = useMemo(() => groupPatchRecordsByAppliedAtIso(documentState?.patchLog ?? []), [documentState?.patchLog]);
  const patchStateCounts = useMemo(() => countReconcileStates(documentState?.patchLog ?? []), [documentState?.patchLog]);

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
  }, [readDeckCapability.reason, readDeckCapability.supported]);

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
  }, [deck, documentState, exemplarMode, readDeckCapability.supported, selectedExemplarSlideId]);

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
      setMessage(`Applied ${applied.length} safe patches and reconciled ${reconciledPatchLog.length} patch records.`);
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
            `${error instanceof Error ? error.message : "Apply safe failed."} Recovered partial progress: reconciled ${partialApplied.length} applied patch records.`
          );
          return;
        } catch (recoveryError: unknown) {
          setMessage(
            `${error instanceof Error ? error.message : "Apply safe failed."} Partial progress was detected, but refresh failed: ${
              recoveryError instanceof Error ? recoveryError.message : "unknown error"
            }`
          );
          return;
        }
      }

      setMessage(error instanceof Error ? error.message : "Apply safe failed.");
    }
  }, [analysisState, applyPatchCapability.reason, applyPatchCapability.supported, deck, documentState, exemplarMode, selectedExemplarSlideId]);

  const reconcileNow = useCallback(async () => {
    if (!documentState) {
      setMessage("Document state is unavailable; run clean up first.");
      return;
    }

    if (!readDeckCapability.supported) {
      setMessage(readDeckCapability.reason ?? "Deck snapshot is unavailable in current runtime mode.");
      return;
    }

    try {
      const refreshedDeck = await readDeckSnapshot();
      const reconciledPatchLog = reconcilePatchLogByRecordIdentity(documentState.patchLog, refreshedDeck);
      const changedStates = countStateTransitions(documentState.patchLog, reconciledPatchLog);
      const counts = countReconcileStates(reconciledPatchLog);
      const reconciledAtIso = new Date().toISOString();
      const nextState: DocumentStateV1 = {
        ...documentState,
        patchLog: reconciledPatchLog,
        lastUpdatedIso: reconciledAtIso
      };

      await saveDocumentState(nextState);
      setDeck(refreshedDeck);
      setDocumentState(nextState);
      setLastReconciledIso(reconciledAtIso);
      setMessage(
        `Reconciled ${reconciledPatchLog.length} patch records. Changed ${changedStates} states (applied=${counts.applied}, reverted_externally=${counts.reverted_externally}, drifted=${counts.drifted}, missing_target=${counts.missing_target}).`
      );
    } catch (error: unknown) {
      setMessage(`Reconcile failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }, [documentState, readDeckCapability.reason, readDeckCapability.supported]);

  const restoreBefore = useCallback(
    async (recordIndex: number) => {
      if (!documentState) {
        setMessage("Document state is unavailable; run clean up first.");
        return;
      }

      if (recordIndex < 0 || recordIndex >= documentState.patchLog.length) {
        setMessage("Restore skipped: patch record index is out of date. Reconcile and retry.");
        return;
      }

      if (!applyPatchCapability.supported) {
        setMessage(applyPatchCapability.reason ?? "Patch apply is unavailable in this runtime mode.");
        return;
      }

      if (!readDeckCapability.supported) {
        setMessage(readDeckCapability.reason ?? "Deck snapshot is unavailable in current runtime mode.");
        return;
      }

      try {
        const preflightDeck = await readDeckSnapshot();
        const preflightPatchLog = reconcilePatchLogByRecordIdentity(documentState.patchLog, preflightDeck);
        const preflightAtIso = new Date().toISOString();
        const preflightState: DocumentStateV1 = {
          ...documentState,
          patchLog: preflightPatchLog,
          lastUpdatedIso: preflightAtIso
        };

        await saveDocumentState(preflightState);
        setDeck(preflightDeck);
        setDocumentState(preflightState);
        setLastReconciledIso(preflightAtIso);

        const refreshedRecord = preflightPatchLog[recordIndex];
        if (!refreshedRecord) {
          setMessage("Restore skipped: selected patch record is no longer available after reconcile.");
          return;
        }

        if (refreshedRecord.reconcileState !== "applied") {
          setMessage(`Restore skipped: patch record is ${refreshedRecord.reconcileState} after preflight reconcile.`);
          return;
        }

        const disabledReason = getRestoreUiDisabledReason(
          refreshedRecord,
          applyPatchCapability.supported,
          applyPatchCapability.reason
        );
        if (disabledReason) {
          setMessage(`Restore skipped: ${disabledReason}`);
          return;
        }

        const restoreBuild = buildSafeRestoreOps(refreshedRecord, preflightDeck, preflightAtIso);
        if (restoreBuild.reason || restoreBuild.restoreOps.length === 0) {
          setMessage(`Restore skipped: ${restoreBuild.reason ?? "no safe restore operations were generated."}`);
          return;
        }

        try {
          const restoredRecords = await applyPatchOps(restoreBuild.restoreOps);
          const restoredDeck = await readDeckSnapshot();
          const patchLogWithRestore = [...preflightPatchLog, ...restoredRecords];
          const reconciledPatchLog = reconcilePatchLogByRecordIdentity(patchLogWithRestore, restoredDeck);
          const restoredAtIso = new Date().toISOString();
          const nextState: DocumentStateV1 = {
            ...preflightState,
            patchLog: reconciledPatchLog,
            lastUpdatedIso: restoredAtIso
          };

          await saveDocumentState(nextState);
          setDeck(restoredDeck);
          setDocumentState(nextState);
          setLastReconciledIso(restoredAtIso);
          setMessage(
            `Restored safe fields for patch ${refreshedRecord.id}. Applied ${restoreBuild.restoreOps.length} safe restore ops, appended ${restoredRecords.length} restore patch records, and reconciled ${reconciledPatchLog.length} total records.`
          );
        } catch (error: unknown) {
          const partialApplied = getPartialAppliedRecords(error);
          if (partialApplied.length > 0) {
            try {
              const restoredDeck = await readDeckSnapshot();
              const patchLogWithRestore = [...preflightPatchLog, ...partialApplied];
              const reconciledPatchLog = reconcilePatchLogByRecordIdentity(patchLogWithRestore, restoredDeck);
              const restoredAtIso = new Date().toISOString();
              const nextState: DocumentStateV1 = {
                ...preflightState,
                patchLog: reconciledPatchLog,
                lastUpdatedIso: restoredAtIso
              };

              await saveDocumentState(nextState);
              setDeck(restoredDeck);
              setDocumentState(nextState);
              setLastReconciledIso(restoredAtIso);
              setMessage(
                `${error instanceof Error ? error.message : "Restore failed."} Recovered partial restore progress: appended ${partialApplied.length} restore patch records and reconciled ${reconciledPatchLog.length} total records. Only safe fields were targeted.`
              );
              return;
            } catch (recoveryError: unknown) {
              setMessage(
                `${error instanceof Error ? error.message : "Restore failed."} Partial restore progress was detected, but refresh failed: ${
                  recoveryError instanceof Error ? recoveryError.message : "unknown error"
                }`
              );
              return;
            }
          }

          setMessage(`Restore failed: ${error instanceof Error ? error.message : "unknown error"}`);
        }
      } catch (error: unknown) {
        setMessage(`Restore preflight failed: ${error instanceof Error ? error.message : "unknown error"}`);
      }
    },
    [
      applyPatchCapability.reason,
      applyPatchCapability.supported,
      documentState,
      readDeckCapability.reason,
      readDeckCapability.supported
    ]
  );

  const ratify = useCallback(async () => {
    if (!documentState) {
      setMessage("Document state is unavailable; run clean up first.");
      return;
    }

    try {
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
    } catch (error: unknown) {
      setMessage(`Ratify failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }, [analysisState?.findings, analysisState?.styleMap, documentState]);

  if (loading) {
    return <main className="shell">Loading Magistrat Google Slides...</main>;
  }

  return (
    <main className="shell">
      <header className="header">
        <h1>Magistrat</h1>
        <p>Trust-first Google Slides compiler workflow.</p>
      </header>

      {runtimeStatus.mode === "GOOGLE_SHADOW" ? (
        <section className="panel warning">
          <h2>Bridge unavailable</h2>
          <p>
            Google bridge is not ready for full runtime operations. host={hostCapabilities.host},
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
          <span>Bridge available</span>
          <strong>{hostCapabilities.bridgeAvailable ? "yes" : "no"}</strong>
          <span>Add-on context</span>
          <strong>{hostCapabilities.addOnContextAvailable ? "yes" : "no"}</strong>
          <span>Read deck</span>
          <strong>{runtimeStatus.capabilities.readDeckSnapshot.supported ? "yes" : "no"}</strong>
          <span>Apply patches</span>
          <strong>{runtimeStatus.capabilities.applyPatchOps.supported ? "yes" : "no"}</strong>
          <span>Document id</span>
          <strong>{getDocumentId()}</strong>
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

      <section className="panel">
        <div className="panel-header">
          <h2>Patch log</h2>
          <button
            onClick={() => void reconcileNow()}
            disabled={!documentState || !readDeckCapability.supported}
            title={!readDeckCapability.supported ? readDeckCapability.reason : undefined}
          >
            Reconcile now
          </button>
        </div>
        <p className="muted">
          Restore before is available only for records currently reconciled as applied, and restores safe fields only.
        </p>
        <div className="grid patch-log-summary">
          <span>Total patch records</span>
          <strong>{documentState?.patchLog.length ?? 0}</strong>
          <span>Applied</span>
          <strong>{patchStateCounts.applied}</strong>
          <span>Reverted externally</span>
          <strong>{patchStateCounts.reverted_externally}</strong>
          <span>Drifted</span>
          <strong>{patchStateCounts.drifted}</strong>
          <span>Missing target</span>
          <strong>{patchStateCounts.missing_target}</strong>
          <span>Last reconciled</span>
          <strong>{lastReconciledIso || "-"}</strong>
        </div>

        {patchLogGroups.length === 0 ? (
          <p className="muted">No patch records yet. Run clean up and apply safe patches to populate this log.</p>
        ) : (
          <div className="patch-log-groups">
            {patchLogGroups.map((group, groupIndex) => (
              <article className="patch-log-group" key={`${group.appliedAtIso}-${groupIndex}`}>
                <h3>
                  <code>{group.appliedAtIso}</code> ({group.records.length})
                </h3>
                <ul className="patch-log-list">
                  {group.records.map((record, recordIndex) => (
                    <li className="patch-log-item" key={`${record.id}-${record.findingId}-${recordIndex}`}>
                      {(() => {
                        const originalRecordIndex = documentState ? documentState.patchLog.indexOf(record) : -1;
                        const restoreDisabledReason =
                          originalRecordIndex < 0
                            ? "Restore is unavailable because this patch record is out of date."
                            : getRestoreUiDisabledReason(
                                record,
                                applyPatchCapability.supported,
                                applyPatchCapability.reason
                              );
                        const restoreDisabled = originalRecordIndex < 0 || Boolean(restoreDisabledReason);

                        return (
                          <>
                            <div className="patch-log-row">
                              <span className={`reconcile-badge reconcile-${record.reconcileState}`}>{record.reconcileState}</span>
                              <code>
                                {record.targetFingerprint.slideId}:{record.targetFingerprint.objectId}
                              </code>
                            </div>
                            <div className="patch-log-meta">
                              <span>
                                finding <code>{record.findingId}</code>
                              </span>
                              <span>
                                patch <code>{record.id}</code>
                              </span>
                              <span>
                                at <code>{record.appliedAtIso}</code>
                              </span>
                            </div>
                            <div className="patch-log-actions">
                              <button
                                className="secondary-button"
                                onClick={() => void restoreBefore(originalRecordIndex)}
                                disabled={restoreDisabled}
                                title={restoreDisabledReason}
                              >
                                Restore before
                              </button>
                              {restoreDisabledReason ? <span className="restore-disabled-reason">{restoreDisabledReason}</span> : null}
                            </div>
                          </>
                        );
                      })()}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>

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
