import { useState, useEffect } from "react";
import { useProjectWizard } from "@/lib/useProjectWizard";
import { useAssetStore } from "@/stores/assetStore";
import { WizardStepLayout } from "./WizardStepLayout";
import { LocationStep } from "./steps/LocationStep";
import { TemplateStyleStep } from "./steps/TemplateStyleStep";
import { WorldIdentityStep } from "./steps/WorldIdentityStep";
import { CharacterSystemStep } from "./steps/CharacterSystemStep";
import { ProgressionBalanceStep } from "./steps/ProgressionBalanceStep";
import { DemoZoneStep } from "./steps/DemoZoneStep";
import { CreationStep } from "./steps/CreationStep";

const PROJECT_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

const STEP_COUNT = 7;

const STEP_TITLES = [
  "Project Location",
  "Template & Art Style",
  "World Identity",
  "Character System",
  "Progression & Balance",
  "Demo Zone",
  "Create & Generate Art",
];

const STEP_WHY = [
  undefined,
  "The template pre-fills stats, classes, races, and equipment. The art style sets the visual language for all generated images.",
  "Your world theme guides AI-generated room descriptions, creature designs, and art. It establishes the atmosphere across your entire project.",
  "Stats, classes, and races are the core of character identity. These determine how players build and differentiate their characters.",
  "These numbers control pacing \u2014 how fast players grow, how dangerous combat feels, and how the economy flows.",
  "This creates your first playable area. AI generates thematic content you can tweak, or you can write everything yourself.",
  undefined,
];

interface ProjectWizardProps {
  onClose: () => void;
}

export function ProjectWizard({ onClose }: ProjectWizardProps) {
  const [step, setStep] = useState(1);
  const [nameError, setNameError] = useState<string | null>(null);
  const { data, update, selectTemplate, stage, error, create, reset } =
    useProjectWizard();

  const settings = useAssetStore((s) => s.settings);

  // Load settings if not already loaded
  const loadSettings = useAssetStore((s) => s.loadSettings);
  useEffect(() => {
    if (!settings) {
      loadSettings();
    }
  }, [settings, loadSettings]);

  const hasLlmKey = !!(
    settings?.anthropic_api_key || settings?.openrouter_api_key
  );

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
    if (step < STEP_COUNT) {
      if (step === 6) {
        // Trigger creation
        setStep(7);
        create();
        return;
      }
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1 && step < 7) {
      setStep(step - 1);
    }
  };

  const handleDone = () => {
    reset();
    onClose();
  };

  const canGoNext = () => {
    if (step === 7) return false;
    return true;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="mx-4 flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg border border-border-default bg-bg-secondary shadow-xl">
        {/* Header */}
        <div className="shrink-0 border-b border-border-default px-6 py-3">
          <h2 className="font-display text-sm tracking-wide text-accent-emphasis">
            Create New Project
          </h2>
          {/* Step indicator */}
          <div className="mt-2 flex gap-1">
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
          <p className="mt-1 text-[10px] text-text-muted">
            Step {step} of {STEP_COUNT}: {STEP_TITLES[step - 1]}
          </p>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {step !== 7 ? (
            <WizardStepLayout
              title={STEP_TITLES[step - 1]!}
              whyItMatters={STEP_WHY[step - 1]}
            >
              {step === 1 && (
                <LocationStep
                  data={data}
                  onChange={update}
                  nameError={nameError}
                />
              )}
              {step === 2 && (
                <TemplateStyleStep
                  data={data}
                  onSelectTemplate={selectTemplate}
                />
              )}
              {step === 3 && (
                <WorldIdentityStep data={data} onChange={update} />
              )}
              {step === 4 && (
                <CharacterSystemStep data={data} onChange={update} />
              )}
              {step === 5 && (
                <ProgressionBalanceStep data={data} onChange={update} />
              )}
              {step === 6 && (
                <DemoZoneStep
                  data={data}
                  onChange={update}
                  hasLlmKey={hasLlmKey}
                />
              )}
            </WizardStepLayout>
          ) : (
            <div className="px-6 py-4">
              <CreationStep
                stage={stage}
                error={error}
                artStyle={data.artStyle}
                demoZone={data.demoZone}
                zoneId={data.zoneName}
                onOpenProject={handleDone}
                onRetry={() => {
                  reset();
                  setStep(1);
                }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        {step < 7 && (
          <div className="shrink-0 flex justify-end gap-2 border-t border-border-default px-6 py-3">
            {step === 1 ? (
              <button
                onClick={onClose}
                className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
              >
                Cancel
              </button>
            ) : (
              <button
                onClick={handleBack}
                className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
              >
                Back
              </button>
            )}
            {canGoNext() && (
              <button
                onClick={handleNext}
                className="rounded bg-gradient-to-r from-accent-muted to-accent px-4 py-1.5 text-xs font-medium text-accent-emphasis transition-all hover:brightness-110"
              >
                {step === 6 ? "Create Project" : "Next"}
              </button>
            )}
          </div>
        )}

        {/* Footer for step 7 error */}
        {step === 7 && stage === "error" && (
          <div className="shrink-0 flex justify-end gap-2 border-t border-border-default px-6 py-3">
            <button
              onClick={() => {
                reset();
                onClose();
              }}
              className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
