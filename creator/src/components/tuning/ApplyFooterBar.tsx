// ─── Apply Footer Bar ───────────────────────────────────────────────
// Sticky footer with Apply/Undo/Reset buttons and section count summary.

import { useState, useEffect } from "react";
import { useTuningWizardStore } from "@/stores/tuningWizardStore";
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
  const applyPreset = useTuningWizardStore((s) => s.applyPreset);
  const undoApply = useTuningWizardStore((s) => s.undoApply);
  const resetWizard = useTuningWizardStore((s) => s.resetWizard);
  const clearApplySuccess = useTuningWizardStore((s) => s.clearApplySuccess);

  const [applying, setApplying] = useState(false);
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

  return (
    <div className="sticky bottom-0 z-10 border-t border-border-muted bg-bg-primary px-6 py-3 shadow-[0_-4px_16px_rgba(8,10,18,0.3)] animate-unfurl-in">
      <div className="flex items-center justify-between">
        {/* Left: section count summary + success flash */}
        <div className="flex items-center">
          <span className="font-sans text-sm text-text-secondary">
            {acceptedCount} of {totalSections} sections selected
          </span>
          {applySuccess && (
            <span className="ml-3 font-sans text-sm font-semibold text-status-success animate-saved-flash">
              Applied!
            </span>
          )}
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-3">
          <ActionButton variant="ghost" onClick={resetWizard}>
            Reset
          </ActionButton>
          {undoAvailable && (
            <ActionButton variant="secondary" onClick={undoApply}>
              Undo
            </ActionButton>
          )}
          <ActionButton
            variant="primary"
            disabled={acceptedCount === 0 || applying}
            onClick={handleApply}
          >
            {applying ? (
              <>
                <Spinner className="mr-2" />
                Applying...
              </>
            ) : (
              `Apply ${acceptedCount} ${acceptedCount === 1 ? "Section" : "Sections"}`
            )}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
