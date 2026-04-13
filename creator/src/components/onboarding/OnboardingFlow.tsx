import { useState } from "react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { HubKeyStep } from "./HubKeyStep";
import { ArtStyleStep } from "./ArtStyleStep";
import { FlavorStep } from "./FlavorStep";
import { GeneratingStep } from "./GeneratingStep";
import type { OnboardingFlavor } from "@/lib/baseTemplate/flavors";
import { startReSkin } from "@/lib/baseTemplate/reSkinPipeline";
import type { ReSkinProgress, ReSkinResults } from "@/lib/baseTemplate/reSkinPipeline";

export type OnboardingStep = "hubKey" | "flavor" | "artStyle" | "generating";

const STEP_ORDER: OnboardingStep[] = ["hubKey", "flavor", "artStyle", "generating"];

const STEP_LABELS: Record<OnboardingStep, string> = {
  hubKey: "Connect to Arcanum Hub",
  flavor: "Choose your world's theme",
  artStyle: "Pick your image style",
  generating: "Forging your world",
};

const INITIAL_RESKIN_PROGRESS: ReSkinProgress = {
  classesAndAbilities: "pending",
  races: "pending",
  rooms: "pending",
  entities: "pending",
  artStyle: "pending",
  worldLore: "pending",
};

interface OnboardingFlowProps {
  onClose: () => void;
}

export function OnboardingFlow({ onClose }: OnboardingFlowProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const [step, setStep] = useState<OnboardingStep>("hubKey");
  const [reSkinPromise, setReSkinPromise] = useState<Promise<ReSkinResults> | null>(null);
  const [reSkinProgress, setReSkinProgress] = useState<ReSkinProgress>(INITIAL_RESKIN_PROGRESS);

  const stepIndex = STEP_ORDER.indexOf(step);
  const canCloseFromCurrentStep = step !== "generating";

  const handleHubKeyDone = () => setStep("flavor");

  const [selectedFlavor, setSelectedFlavor] = useState<OnboardingFlavor | null>(null);

  const handleFlavorDone = (flavor: OnboardingFlavor) => {
    setSelectedFlavor(flavor);
    const promise = startReSkin(flavor.seedPrompt, setReSkinProgress);
    setReSkinPromise(promise);
    setStep("artStyle");
  };

  const handleArtStyleDone = () => {
    setStep("generating");
  };

  return (
    <div className="dialog-overlay">
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="dialog-shell flex max-h-[92vh] w-full max-w-4xl flex-col"
      >
        <div className="dialog-header block">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 id="onboarding-title" className="dialog-title">
                Start with Arcanum Hub
              </h2>
              <p className="dialog-subtitle">{STEP_LABELS[step]}</p>
            </div>
            {canCloseFromCurrentStep && (
              <button
                onClick={onClose}
                aria-label="Close"
                className="shrink-0 rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-3 py-1 text-2xs uppercase tracking-ui text-text-muted transition hover:text-text-primary"
              >
                Skip
              </button>
            )}
          </div>
          <div className="mt-4 flex gap-1.5" aria-hidden="true">
            {STEP_ORDER.map((s, i) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i === stepIndex
                    ? "bg-accent"
                    : i < stepIndex
                      ? "bg-accent/40"
                      : "bg-bg-elevated"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="dialog-body">
          {step === "hubKey" && <HubKeyStep onDone={handleHubKeyDone} />}
          {step === "flavor" && (
            <FlavorStep onDone={handleFlavorDone} onBack={() => setStep("hubKey")} />
          )}
          {step === "artStyle" && <ArtStyleStep onDone={handleArtStyleDone} />}
          {step === "generating" && reSkinPromise && selectedFlavor && (
            <GeneratingStep
              reSkinPromise={reSkinPromise}
              reSkinProgress={reSkinProgress}
              setReSkinProgress={setReSkinProgress}
              flavor={selectedFlavor}
              onFinished={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
