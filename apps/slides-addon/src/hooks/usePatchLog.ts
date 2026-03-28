import { buildStyleSignature } from "@magistrat/compiler-core";
import {
  applyPatchOps,
  getPartialAppliedRecords,
  readDeckSnapshot,
  saveDocumentState
} from "@magistrat/google-adapter";
import type { DeckSnapshot, DocumentStateV1 } from "@magistrat/shared-types";
import { useCallback, useMemo, type Dispatch, type SetStateAction } from "react";
import {
  buildSafeRestoreOps,
  countReconcileStates,
  countStateTransitions,
  getRestoreUiDisabledReason,
  groupPatchRecordsByAppliedAtIso,
  reconcilePatchLogByRecordIdentity
} from "../patchLog.js";
import type { AnalysisState, RuntimeCapability } from "./useAnalysis.js";

export interface UsePatchLogParams {
  documentState: DocumentStateV1 | null;
  setDocumentState: Dispatch<SetStateAction<DocumentStateV1 | null>>;
  setDeck: Dispatch<SetStateAction<DeckSnapshot | null>>;
  setMessage: (message: string) => void;
  setLastReconciledIso: (iso: string) => void;
  analysisState: AnalysisState | null;
  readDeckCapability: RuntimeCapability;
  applyPatchCapability: RuntimeCapability;
}

export function usePatchLog({
  documentState,
  setDocumentState,
  setDeck,
  setMessage,
  setLastReconciledIso,
  analysisState,
  readDeckCapability,
  applyPatchCapability
}: UsePatchLogParams) {
  const patchLogGroups = useMemo(
    () => groupPatchRecordsByAppliedAtIso(documentState?.patchLog ?? []),
    [documentState?.patchLog]
  );
  const patchStateCounts = useMemo(
    () => countReconcileStates(documentState?.patchLog ?? []),
    [documentState?.patchLog]
  );

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
  }, [documentState, readDeckCapability.reason, readDeckCapability.supported, setDeck, setDocumentState, setLastReconciledIso, setMessage]);

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
      readDeckCapability.supported,
      setDeck,
      setDocumentState,
      setLastReconciledIso,
      setMessage
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
  }, [analysisState?.findings, analysisState?.styleMap, documentState, setDocumentState, setMessage]);

  return {
    patchLogGroups,
    patchStateCounts,
    reconcileNow,
    restoreBefore,
    ratify
  };
}
