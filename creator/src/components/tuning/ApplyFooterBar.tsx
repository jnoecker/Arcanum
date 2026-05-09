// ─── Apply Footer Bar ───────────────────────────────────────────────
// Sticky footer with Apply (working set), Commit (disk), Undo, and
// Reset actions plus section count summary.

import { useState, useEffect } from "react";
import { useTuningWizardStore } from "@/stores/tuningWizardStore";
import { useConfigStore } from "@/stores/configStore";
import { useProjectStore } from "@/stores/projectStore";
import { useToastStore } from "@/stores/toastStore";
import { TuningSection } from "@/lib/tuning/types";
import { ActionButton, Spinner } from "@/components/ui/FormWidgets";

const ALL_SECTIONS = [
  TuningSection.CombatStats,
  TuningSection.EconomyCrafting,
  TuningSection.ProgressionQuests,
  TuningSection.WorldSocial,
];

export function ApplyFooterBar() {
  const acceptedSections = useTuningWizardStore((s) => s.acceptedSections);
  const undoAvailable = useTuningWizardStore((s) => s.undoAvailable);
  const applySuccess = useTuningWizardStore((s) => s.applySuccess);
  const actionError = useTuningWizardStore((s) => s.actionError);
  const applyPreset = useTuningWizardStore((s) => s.applyPreset);
  const undoApply = useTuningWizardStore((s) => s.undoApply);
  const resetWizard = useTuningWizardStore((s) => s.resetWizard);
  const clearApplySuccess = useTuningWizardStore((s) => s.clearApplySuccess);
  const clearActionError = useTuningWizardStore((s) => s.clearActionError);

  const dirty = useConfigStore((s) => s.dirty);
  const project = useProjectStore((s) => s.project);
  const showToast = useToastStore((s) => s.show);

  const [applying, setApplying] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const acceptedCount = acceptedSections.size;
  const totalSections = ALL_SECTIONS.length;

  // Auto-dismiss success flash after 2000ms (UI-SPEC Component 4)
  useEffect(() => {
    if (!applySuccess) return;
    const timer = setTimeout(() => clearApplySuccess(), 2000);
    return () => clearTimeout(timer);
  }, [applySuccess, clearApplySuccess]);

  async function handleApply() {
    setApplying(true);
    try {
      await applyPreset();
    } finally {
      setApplying(false);
    }
  }

  async function handleCommit() {
    if (!project || committing || !dirty) return;
    setCommitting(true);
    setCommitError(null);
    try {
      const { saveProjectConfig } = await import("@/lib/saveConfig");
      await saveProjectConfig(project);
      useConfigStore.getState().markClean();
      showToast({
        kicker: "Tuning Wizard",
        message: "Committed to application.yaml.",
        variant: "astral",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setCommitError(message);
      showToast(
        {
          kicker: "Tuning Wizard",
          message: `Commit failed: ${message}`,
          variant: "ember",
        },
        4000,
      );
      console.error("Tuning commit failed:", err);
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="sticky bottom-0 z-10 border-t border-border-muted bg-bg-primary/95 px-6 py-3 shadow-section animate-unfurl-in">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: section count summary + success flash */}
        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center">
          <span className="text-sm text-text-secondary">
            {acceptedCount} of {totalSections} sections selected
          </span>
          {applySuccess && (
            <span className="text-sm font-semibold text-status-success animate-saved-flash sm:ml-3">
              Applied!
            </span>
          )}
          {actionError && (
            <span role="alert" className="text-sm text-status-error sm:ml-3">
              {actionError}
            </span>
          )}
          {commitError && !actionError && (
            <span role="alert" className="text-sm text-status-error sm:ml-3">
              Commit failed: {commitError}
            </span>
          )}
        </div>

        {/* Right: action buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <ActionButton variant="ghost" onClick={() => { clearActionError(); resetWizard(); }}>
            Reset
          </ActionButton>
          {undoAvailable && (
            <ActionButton variant="secondary" onClick={() => { clearActionError(); void undoApply(); }}>
              Undo
            </ActionButton>
          )}
          <ActionButton
            variant="primary"
            disabled={acceptedCount === 0 || applying}
            onClick={() => {
              clearActionError();
              void handleApply();
            }}
          >
            {applying ? (
              <>
                <Spinner className="mr-2" />
                Applying...
              </>
            ) : (
              `Apply ${acceptedCount} ${acceptedCount === 1 ? "Section" : "Sections"} to Working Set`
            )}
          </ActionButton>
          <ActionButton
            variant="ghost"
            disabled={!dirty || committing}
            onClick={() => {
              setCommitError(null);
              void handleCommit();
            }}
            aria-label={committing ? "Committing to application.yaml" : "Commit to application.yaml"}
          >
            {committing ? (
              <>
                <Spinner className="mr-2" />
                Committing...
              </>
            ) : (
              "Commit to application.yaml"
            )}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
