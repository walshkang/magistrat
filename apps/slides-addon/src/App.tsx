import { computeAlignmentScore } from "@magistrat/compiler-core";
import { getDocumentId, getRuntimeStatus, saveDocumentState } from "@magistrat/google-adapter";
import type { DocumentStateV1 } from "@magistrat/shared-types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlignmentScoreBar } from "./components/AlignmentScoreBar.js";
import { ChangeHistory } from "./components/ChangeHistory.js";
import { ExceptionsPanel } from "./components/ExceptionsPanel.js";
import { Minimap } from "./components/Minimap.js";
import { DevModeToggle } from "./components/DevModeToggle.js";
import { FindingsPanel } from "./components/FindingsPanel.js";
import { useDevMode } from "./context/DevModeContext.js";
import { useAnalysis } from "./hooks/useAnalysis.js";
import { usePatchLog } from "./hooks/usePatchLog.js";
import { messageLooksPersistent } from "./messageToast.js";
import { getRestoreUiDisabledReason } from "./patchLog.js";
import { computeSlideStatuses } from "./utils/slideStatus.js";

export function App() {
  const { devMode } = useDevMode();
  const runtimeStatus = useMemo(() => getRuntimeStatus(), []);
  const hostCapabilities = runtimeStatus.hostCapabilities;
  const readDeckCapability = runtimeStatus.capabilities.readDeckSnapshot;
  const applyPatchCapability = runtimeStatus.capabilities.applyPatchOps;

  const [documentState, setDocumentState] = useState<DocumentStateV1 | null>(null);
  const [lastReconciledIso, setLastReconciledIso] = useState<string>("");
  const [exemplarExpanded, setExemplarExpanded] = useState(true);
  const hasCollapsedExemplarAfterScanRef = useRef(false);
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);

  const {
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
  } = useAnalysis({
    documentState,
    setDocumentState,
    setLastReconciledIso,
    readDeckCapability,
    applyPatchCapability
  });

  const ignoredFindingIds = useMemo(
    () => new Set((documentState?.ignoredFindings ?? []).map((ig) => ig.findingId)),
    [documentState?.ignoredFindings]
  );

  const adjustedAlignmentScore = useMemo(() => {
    if (!analysisState) {
      return null;
    }
    return computeAlignmentScore(analysisState.findings, analysisState.coverage, ignoredFindingIds);
  }, [analysisState, ignoredFindingIds]);

  const ignoreFinding = useCallback(
    (findingId: string) => {
      if (!documentState) {
        return;
      }

      const already = documentState.ignoredFindings.some((ig) => ig.findingId === findingId);
      if (already) {
        return;
      }

      const nextState: DocumentStateV1 = {
        ...documentState,
        ignoredFindings: [
          ...documentState.ignoredFindings,
          { findingId, ignoredAtIso: new Date().toISOString() }
        ],
        lastUpdatedIso: new Date().toISOString()
      };

      void saveDocumentState(nextState);
      setDocumentState(nextState);
    },
    [documentState, setDocumentState]
  );

  const unignoreFinding = useCallback(
    (findingId: string) => {
      if (!documentState) {
        return;
      }

      const nextState: DocumentStateV1 = {
        ...documentState,
        ignoredFindings: documentState.ignoredFindings.filter((ig) => ig.findingId !== findingId),
        lastUpdatedIso: new Date().toISOString()
      };

      void saveDocumentState(nextState);
      setDocumentState(nextState);
    },
    [documentState, setDocumentState]
  );

  useEffect(() => {
    if (analysisState && !analysisState.stale) {
      setSelectedSlideId(null);
    }
    if (analysisState && !hasCollapsedExemplarAfterScanRef.current) {
      setExemplarExpanded(false);
      hasCollapsedExemplarAfterScanRef.current = true;
    }
  }, [analysisState]);

  useEffect(() => {
    if (!message) {
      return;
    }
    if (messageLooksPersistent(message)) {
      return;
    }
    const id = window.setTimeout(() => setMessage(""), 5000);
    return () => window.clearTimeout(id);
  }, [message, setMessage]);

  const { patchLogGroups, patchStateCounts, reconcileNow, restoreBefore, ratify } = usePatchLog({
    documentState,
    setDocumentState,
    setDeck,
    setMessage,
    setLastReconciledIso,
    analysisState,
    readDeckCapability,
    applyPatchCapability
  });

  const safePatchCount = analysisState?.safePatches.length ?? 0;
  const hasFindings = (analysisState?.findings.length ?? 0) > 0;

  const filteredFindings = useMemo(() => {
    if (!analysisState) {
      return [];
    }
    if (!selectedSlideId) {
      return analysisState.findings;
    }
    return analysisState.findings.filter((f) => f.slideId === selectedSlideId);
  }, [analysisState, selectedSlideId]);

  const slideStatuses = useMemo(() => {
    if (!analysisState || !deck) {
      return [];
    }
    return computeSlideStatuses(analysisState.findings, deck);
  }, [analysisState, deck]);

  const filteredActionableCount = useMemo(
    () =>
      filteredFindings.filter((f) => f.coverage === "ANALYZED" && !ignoredFindingIds.has(f.id)).length,
    [filteredFindings, ignoredFindingIds]
  );

  const canApplySafeFromSummary = Boolean(
    analysisState && documentState && deck && safePatchCount > 0 && applyPatchCapability.supported
  );
  const canRunScan = Boolean(deck && documentState);
  const ratifyState = documentState?.ratify;
  const totalPatches = documentState?.patchLog.length ?? 0;
  const analyzedFindingsCount = useMemo(() => {
    if (!analysisState) {
      return 0;
    }
    return analysisState.findings.filter(
      (f) => f.coverage === "ANALYZED" && !ignoredFindingIds.has(f.id)
    ).length;
  }, [analysisState, ignoredFindingIds]);

  const canRatify = Boolean(
    analysisState &&
      documentState &&
      analysisState.findings.filter((f) => f.coverage === "ANALYZED" && !ignoredFindingIds.has(f.id)).length === 0
  );

  const findingsRiskCounts = useMemo(() => {
    if (!analysisState) {
      return { safe: 0, caution: 0, manual: 0 };
    }
    let safe = 0;
    let caution = 0;
    let manual = 0;
    for (const f of filteredFindings) {
      if (f.coverage !== "ANALYZED" || ignoredFindingIds.has(f.id)) {
        continue;
      }
      if (f.risk === "safe") {
        safe += 1;
      } else if (f.risk === "caution") {
        caution += 1;
      } else {
        manual += 1;
      }
    }
    return { safe, caution, manual };
  }, [analysisState, filteredFindings, ignoredFindingIds]);

  const exemplarSlideLabel =
    deck?.slides.find((s) => s.slideId === selectedExemplarSlideId)?.title ||
    selectedExemplarSlideId ||
    "—";
  const exemplarModeShort = exemplarMode === "token_normalized" ? "Normalized" : "Original";

  const exemplarSummaryLine =
    analysisState && !devMode
      ? `Exemplar: ${exemplarSlideLabel} · ${exemplarModeShort} · Health ${analysisState.exemplarHealthScore}/100`
      : `Exemplar: ${exemplarSlideLabel} · ${exemplarModeShort}`;

  const showPreScanEmpty =
    !analysisState && Boolean(deck && documentState && readDeckCapability.supported);

  if (loading) {
    return (
      <main className="shell loading-state" aria-busy="true">
        <div className="loading-spinner" aria-hidden />
        <span className="loading-text" role="status">
          Connecting to deck...
        </span>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="header header-row">
        <div className="header-brand">
          <span className="header-brand__title">Magistrat</span>
        </div>
        <DevModeToggle />
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

      {devMode ? (
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
      ) : null}

      <details
        className="exemplar-details"
        open={exemplarExpanded}
        onToggle={(event) => setExemplarExpanded(event.currentTarget.open)}
      >
        <summary
          className="exemplar-details__summary"
          aria-label={exemplarExpanded ? exemplarSummaryLine : undefined}
        >
          {exemplarExpanded ? "Exemplar setup" : exemplarSummaryLine}
        </summary>
        <div className="exemplar-details__body">
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
                onChange={(event) => setExemplarMode(event.target.value as typeof exemplarMode)}
              >
                <option value="original">Use Original Exemplar</option>
                <option value="token_normalized">Use Normalized Exemplar (token-only preview)</option>
              </select>
            </label>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => void runCleanup()}
              disabled={!deck}
            >
              {analysisState ? "Rescan" : "Scan deck"}
            </button>
          </div>
          {analysisState && !devMode ? (
            <p className="exemplar-health-summary">Exemplar health: {analysisState.exemplarHealthScore}/100</p>
          ) : null}
        </div>
      </details>

      {showPreScanEmpty ? (
        <section className="empty-state" aria-label="Scan prompt">
          <div className="empty-state__copy">
            <p>Scan your deck to check</p>
            <p>alignment with the exemplar</p>
          </div>
          <button type="button" className="btn-primary" onClick={() => void runCleanup()} disabled={!canRunScan}>
            Scan deck
          </button>
        </section>
      ) : null}

      {analysisState ? (
        <>
          {adjustedAlignmentScore ? <AlignmentScoreBar score={adjustedAlignmentScore} /> : null}

          {slideStatuses.length > 0 ? (
            <Minimap
              slides={slideStatuses}
              selectedSlideId={selectedSlideId}
              onSelectSlide={setSelectedSlideId}
            />
          ) : null}

          <section
            className={`summary-panel${analysisState.findings.length === 0 ? " summary-panel--all-clear" : ""}`}
            aria-label="Scan summary"
          >
            {analysisState.findings.length === 0 ? (
              <>
                <div className="summary-panel__top-row">
                  <p className="summary-panel__meta summary-panel__meta--status">All clear</p>
                </div>
                <p className="summary-panel__sub">No style issues found.</p>
              </>
            ) : (
              <>
                <div className="summary-panel__top-row">
                  <p className="summary-panel__meta">
                    {selectedSlideId
                      ? `${filteredActionableCount} of ${analyzedFindingsCount} findings (filtered)`
                      : `${analyzedFindingsCount} ${analyzedFindingsCount === 1 ? "finding" : "findings"}`}
                  </p>
                </div>
                <p className="summary-panel__breakdown">
                  {findingsRiskCounts.safe} auto-fixable · {findingsRiskCounts.caution} need review ·{" "}
                  {findingsRiskCounts.manual} manual
                </p>
              </>
            )}
            <div className="summary-panel__actions">
              <button
                type="button"
                className={hasFindings ? "btn-secondary" : "btn-primary"}
                onClick={() => void runCleanup()}
                disabled={!canRunScan}
              >
                Scan deck
              </button>
              <button
                type="button"
                className={hasFindings ? "btn-primary" : "btn-secondary"}
                onClick={() => void applySafe()}
                disabled={!canApplySafeFromSummary}
                title={
                  !applyPatchCapability.supported && safePatchCount > 0 ? applyPatchCapability.reason : undefined
                }
              >
                Apply Recommended Fixes ({safePatchCount})
              </button>
              {canRatify && !ratifyState ? (
                <button type="button" className="btn-primary ratify-btn" onClick={() => void ratify()}>
                  Ratify style
                </button>
              ) : null}
              {!canRatify && analysisState && analyzedFindingsCount > 0 ? (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled
                  title="Fix or ignore all findings before ratifying"
                >
                  Ratify style
                </button>
              ) : null}
            </div>
            {ratifyState ? (
              <p className="ratify-stamp">
                Ratified {new Date(ratifyState.ratifiedAtIso).toLocaleDateString()}
              </p>
            ) : null}
          </section>

          {devMode ? (
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
          ) : null}

          <section className="panel">
            <h2>Linter stream</h2>
            <p>
              {filteredFindings.length} findings · safe={analysisState.safePatches.length} · caution=
              {analysisState.cautionPatches.length} · manual={analysisState.manualPatches.length}
            </p>
            {analysisState.stale && !devMode ? (
              <p className="muted">Loaded from persisted state; run clean up to refresh against current deck.</p>
            ) : null}
            <FindingsPanel
              findings={filteredFindings}
              deck={deck}
              coverage={analysisState.coverage}
              onApplyFinding={(id) => void applyForFinding(id)}
              onIgnoreFinding={ignoreFinding}
              ignoredFindingIds={ignoredFindingIds}
            />
          </section>
        </>
      ) : null}

      {(documentState?.ignoredFindings.length ?? 0) > 0 ? (
        <ExceptionsPanel
          ignoredFindings={documentState!.ignoredFindings}
          findings={analysisState?.findings ?? documentState?.findings ?? []}
          onUnignore={unignoreFinding}
        />
      ) : null}

      {totalPatches > 0 ? (
        <section className="panel">
          {!devMode ? (
            <ChangeHistory
              patchLog={documentState?.patchLog ?? []}
              findings={analysisState?.findings ?? documentState?.findings ?? []}
              deck={deck}
              onReconcile={() => void reconcileNow()}
              reconcileDisabled={!documentState || !readDeckCapability.supported}
              {...(!readDeckCapability.supported ? { reconcileTitle: readDeckCapability.reason } : {})}
            />
          ) : (
            <>
              <div className="panel-header">
                <h2>Patch log</h2>
                <button
                  type="button"
                  className="btn-secondary"
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
                <span>Ratify status</span>
                <strong>
                  {ratifyState ? `Deck ratified at ${ratifyState.ratifiedAtIso}` : "Not ratified"}
                </strong>
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
                                    <span className={`reconcile-badge reconcile-${record.reconcileState}`}>
                                      {record.reconcileState}
                                    </span>
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
                                      type="button"
                                      className="btn-ghost btn-sm"
                                      onClick={() => void restoreBefore(originalRecordIndex)}
                                      disabled={restoreDisabled}
                                      title={restoreDisabledReason}
                                    >
                                      Restore before
                                    </button>
                                    {restoreDisabledReason ? (
                                      <span className="restore-disabled-reason">{restoreDisabledReason}</span>
                                    ) : null}
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
            </>
          )}
        </section>
      ) : null}

      {message ? (
        <footer
          className="message-toast"
          role={messageLooksPersistent(message) ? "alert" : "status"}
          aria-live={messageLooksPersistent(message) ? "assertive" : "polite"}
        >
          <span className="message-toast__text">{message}</span>
          <button
            type="button"
            className="btn-ghost btn-sm message-toast__dismiss"
            onClick={() => setMessage("")}
          >
            Dismiss
          </button>
        </footer>
      ) : null}
    </main>
  );
}
