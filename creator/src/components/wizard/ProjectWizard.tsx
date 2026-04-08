import { useState } from "react";
import { useProjectWizard } from "@/lib/useProjectWizard";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { ActionButton } from "@/components/ui/FormWidgets";
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
    <div className="dialog-overlay">
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wizard-title"
        className="dialog-shell flex max-h-[88vh] w-full max-w-2xl flex-col"
      >
        <div className="dialog-header block">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 id="wizard-title" className="dialog-title">
                Create New Project
              </h2>
              <p className="dialog-subtitle">
                Choose a location, seed the world from a template, and set the first thematic constraints before opening the workspace.
              </p>
            </div>
            <span className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-3 py-1 text-2xs text-text-secondary">
              Step {step} of {STEP_COUNT}
            </span>
          </div>
          <div className="mt-4 flex gap-1.5" aria-hidden="true">
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
          <p className="mt-3 text-xs text-text-muted">
            {STEP_TITLES[step - 1]}
          </p>
        </div>

        <div className="dialog-body">
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

        <div className="dialog-footer items-center justify-between">
          <div className="text-xs text-text-muted" aria-live="polite">
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
              <ActionButton onClick={onClose} variant="ghost" size="sm">
                Cancel
              </ActionButton>
            )}
            {step > 1 && !isBusy && (
              <ActionButton onClick={handleBack} variant="ghost" size="sm">
                Back
              </ActionButton>
            )}
            {step < STEP_COUNT && !isBusy && (
              <ActionButton onClick={handleNext} variant="primary" size="sm">
                Next
              </ActionButton>
            )}
            {step === STEP_COUNT && !isBusy && !isDone && (
              <ActionButton
                onClick={handleCreate}
                disabled={isCreating}
                variant="primary"
                size="sm"
              >
                Create Project
              </ActionButton>
            )}
            {isDone && (
              <ActionButton onClick={handleDone} variant="primary" size="sm">
                Open Project
              </ActionButton>
            )}
            {isError && (
              <ActionButton
                onClick={() => {
                  reset();
                  setStep(1);
                }}
                variant="ghost"
                size="sm"
              >
                Retry
              </ActionButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
