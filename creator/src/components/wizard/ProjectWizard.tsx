import { useState } from "react";
import { useProjectWizard } from "@/lib/useProjectWizard";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { LocationStep } from "./steps/LocationStep";
import { TemplateStep } from "./steps/TemplateStep";
import { WorldIdentityStep } from "./steps/WorldIdentityStep";

const PROJECT_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

const STEP_COUNT = 3;

const STEP_TITLES = [
  "Project Location",
  "Choose a Template",
  "World Identity",
];

interface ProjectWizardProps {
  onClose: () => void;
}

export function ProjectWizard({ onClose }: ProjectWizardProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const [step, setStep] = useState(1);
  const [nameError, setNameError] = useState<string | null>(null);
  const { data, update, selectTemplate, stage, error, create, reset } =
    useProjectWizard();

  const validateStep1 = () => {
    if (!data.projectName) {
      setNameError("Project name is required");
      return false;
    }
    if (!PROJECT_NAME_RE.test(data.projectName)) {
      setNameError(
        "Must start with a letter, use only letters, digits, hyphens, underscores",
      );
      return false;
    }
    if (!data.parentDir) {
      setNameError("Select a parent directory");
      return false;
    }
    setNameError(null);
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step < STEP_COUNT) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleCreate = () => {
    create();
  };

  const handleDone = () => {
    reset();
    onClose();
  };

  const isCreating = stage === "creating";
  const isDone = stage === "done";
  const isError = stage === "error";
  const isBusy = isCreating || isDone;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wizard-title"
        className="mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg border border-border-default bg-bg-secondary shadow-xl"
      >
        {/* Header */}
        <div className="shrink-0 border-b border-border-default px-6 py-4">
          <h2
            id="wizard-title"
            className="font-display text-lg tracking-wide text-text-primary"
          >
            Create New Project
          </h2>
          {/* Step indicator */}
          <div className="mt-3 flex gap-1.5">
            {Array.from({ length: STEP_COUNT }, (_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i + 1 === step
                    ? "bg-accent"
                    : i + 1 < step
                      ? "bg-accent/40"
                      : "bg-bg-elevated"
                }`}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-text-muted">
            Step {step} of {STEP_COUNT}
            {" \u2014 "}
            {STEP_TITLES[step - 1]}
          </p>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {step === 1 && (
            <LocationStep
              data={data}
              onChange={update}
              nameError={nameError}
            />
          )}
          {step === 2 && (
            <TemplateStep
              data={data}
              onSelectTemplate={selectTemplate}
            />
          )}
          {step === 3 && (
            <WorldIdentityStep data={data} onChange={update} />
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between border-t border-border-default px-6 py-3">
          <div className="text-xs text-text-muted">
            {isCreating && (
              <span className="flex items-center gap-2">
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                Creating project...
              </span>
            )}
            {isDone && (
              <span className="text-status-success">Project created</span>
            )}
            {isError && (
              <span className="text-status-error">{error}</span>
            )}
          </div>
          <div className="flex gap-2">
            {step === 1 && !isBusy && (
              <button
                onClick={onClose}
                className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
              >
                Cancel
              </button>
            )}
            {step > 1 && !isBusy && (
              <button
                onClick={handleBack}
                className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
              >
                Back
              </button>
            )}
            {step < STEP_COUNT && !isBusy && (
              <button
                onClick={handleNext}
                className="rounded bg-gradient-to-r from-accent-muted to-accent px-4 py-1.5 text-xs font-medium text-accent-emphasis transition-all hover:brightness-110"
              >
                Next
              </button>
            )}
            {step === STEP_COUNT && !isBusy && !isDone && (
              <button
                onClick={handleCreate}
                disabled={isCreating}
                className="rounded bg-gradient-to-r from-accent-muted to-accent px-5 py-1.5 text-xs font-medium text-accent-emphasis transition-all hover:brightness-110 disabled:opacity-50"
              >
                Create Project
              </button>
            )}
            {isDone && (
              <button
                onClick={handleDone}
                className="rounded bg-gradient-to-r from-accent-muted to-accent px-5 py-1.5 text-xs font-medium text-accent-emphasis transition-all hover:brightness-110"
              >
                Open Project
              </button>
            )}
            {isError && (
              <button
                onClick={() => {
                  reset();
                  setStep(1);
                }}
                className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
