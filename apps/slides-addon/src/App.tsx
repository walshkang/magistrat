import { getDocumentId, getRuntimeStatus } from "@magistrat/google-adapter";
import type { DocumentStateV1 } from "@magistrat/shared-types";
import { useMemo, useState } from "react";
import { DevModeToggle } from "./components/DevModeToggle.js";
import { FindingsPanel } from "./components/FindingsPanel.js";
import { useDevMode } from "./context/DevModeContext.js";
import { useAnalysis } from "./hooks/useAnalysis.js";
import { usePatchLog } from "./hooks/usePatchLog.js";
import { getRestoreUiDisabledReason } from "./patchLog.js";

export function App() {
  const { devMode } = useDevMode();
  const runtimeStatus = useMemo(() => getRuntimeStatus(), []);
  const hostCapabilities = runtimeStatus.hostCapabilities;
  const readDeckCapability = runtimeStatus.capabilities.readDeckSnapshot;
  const applyPatchCapability = runtimeStatus.capabilities.applyPatchOps;

  const [documentState, setDocumentState] = useState<DocumentStateV1 | null>(null);
  const [lastReconciledIso, setLastReconciledIso] = useState<string>("");

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
  const totalFindings = analysisState?.findings.length ?? documentState?.findings.length ?? 0;
  const coverageSnapshot = analysisState?.coverage ?? documentState?.coverage;
  const coverageSlidesPercent =
    coverageSnapshot && coverageSnapshot.totalSlides > 0
      ? Math.round((coverageSnapshot.analyzedSlides / coverageSnapshot.totalSlides) * 100)
      : null;
  const canApplySafeFromHud = Boolean(
    analysisState && documentState && deck && safePatchCount > 0 && applyPatchCapability.supported
  );
  const canRunCleanupFromHud = Boolean(deck && documentState);
  const hudPrimaryIsApplySafe = canApplySafeFromHud;
  const hudPrimaryLabel = hudPrimaryIsApplySafe ? `Apply safe (${safePatchCount})` : "Run clean up";
  const hudPrimaryDisabled = hudPrimaryIsApplySafe ? !canApplySafeFromHud : !canRunCleanupFromHud;
  const ratifyState = documentState?.ratify;

  if (loading) {
    return <main className="shell">Loading Magistrat Google Slides...</main>;
  }

  return (
    <main className="shell">
      <header className="header header-row">
        <div className="header-brand">
          <h1>Magistrat</h1>
          <p>Trust-first Google Slides compiler workflow.</p>
        </div>
        <DevModeToggle />
      </header>

      <section className="panel">
        <div className="panel-header">
          <h2>Style HUD</h2>
          <button
            onClick={() => void (hudPrimaryIsApplySafe ? applySafe() : runCleanup())}
            disabled={hudPrimaryDisabled}
            title={
              hudPrimaryIsApplySafe && !applyPatchCapability.supported ? applyPatchCapability.reason : undefined
            }
          >
            {hudPrimaryLabel}
          </button>
        </div>
        <div className="grid">
          <span>Runtime mode</span>
          <strong>{runtimeStatus.mode}</strong>
          <span>Exemplar slide</span>
          <strong>{selectedExemplarSlideId || "-"}</strong>
          <span>Scan coverage</span>
          <strong>{coverageSlidesPercent != null ? `${coverageSlidesPercent}% of slides` : "Not yet scanned"}</strong>
          <span>Findings</span>
          <strong>{totalFindings}</strong>
        </div>
      </section>

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
              onChange={(event) => setExemplarMode(event.target.value as typeof exemplarMode)}
            >
              <option value="original">Use Original Exemplar</option>
              <option value="token_normalized">Use Normalized Exemplar (token-only preview)</option>
            </select>
          </label>

          <button onClick={() => void runCleanup()} disabled={!deck}>
            Run clean up
          </button>
        </div>
        {analysisState && !devMode ? (
          <p className="exemplar-health-summary">Exemplar health: {analysisState.exemplarHealthScore}/100</p>
        ) : null}
      </section>

      {analysisState ? (
        <>
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
              {analysisState.findings.length} findings · safe={analysisState.safePatches.length} · caution=
              {analysisState.cautionPatches.length} · manual={analysisState.manualPatches.length}
            </p>
            {analysisState.stale && !devMode ? (
              <p className="muted">Loaded from persisted state; run clean up to refresh against current deck.</p>
            ) : null}
            <FindingsPanel
              findings={analysisState.findings}
              deck={deck}
              onApplyFinding={(id) => void applyForFinding(id)}
            />
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
          <span>Ratify status</span>
          <strong>
            {ratifyState
              ? `Deck ratified at ${ratifyState.ratifiedAtIso}`
              : "Not ratified"}
          </strong>
        </div>

        {patchLogGroups.length === 0 ? (
          <p className="muted">No patch records yet. Run clean up and apply safe patches to populate this log.</p>
        ) : devMode ? (
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
        ) : (
          <p className="muted">Enable Dev mode to see patch-level details and restore actions.</p>
        )}
      </section>

      {message ? <footer className="panel info">{message}</footer> : null}
    </main>
  );
}
