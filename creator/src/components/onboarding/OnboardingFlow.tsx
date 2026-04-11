import { useState } from "react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import type { OnboardingZoneTemplate } from "@/lib/onboardingZoneTemplates";
import { HubKeyStep } from "./HubKeyStep";
import { ArtStyleStep, type OnboardingImageStyle } from "./ArtStyleStep";
import { ZoneTemplateStep } from "./ZoneTemplateStep";
import { GeneratingStep } from "./GeneratingStep";

export type OnboardingStep = "hubKey" | "artStyle" | "zoneTemplate" | "generating";

const STEP_ORDER: OnboardingStep[] = ["hubKey", "artStyle", "zoneTemplate", "generating"];

const STEP_LABELS: Record<OnboardingStep, string> = {
  hubKey: "Connect to Arcanum Hub",
  artStyle: "Pick your image style",
  zoneTemplate: "Choose a first world",
  generating: "Forging your world",
};

interface OnboardingFlowProps {
  onClose: () => void;
}

export function OnboardingFlow({ onClose }: OnboardingFlowProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const [step, setStep] = useState<OnboardingStep>("hubKey");
  const [imageStyle, setImageStyle] = useState<OnboardingImageStyle | null>(null);
  const [template, setTemplate] = useState<OnboardingZoneTemplate | null>(null);

  const stepIndex = STEP_ORDER.indexOf(step);
  const canCloseFromCurrentStep = step !== "generating";

  const handleHubKeyDone = () => setStep("artStyle");
  const handleArtStyleDone = (style: OnboardingImageStyle) => {
    setImageStyle(style);
    setStep("zoneTemplate");
  };
  const handleTemplateDone = (picked: OnboardingZoneTemplate) => {
    setTemplate(picked);
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
          {step === "artStyle" && <ArtStyleStep onDone={handleArtStyleDone} />}
          {step === "zoneTemplate" && <ZoneTemplateStep onDone={handleTemplateDone} />}
          {step === "generating" && imageStyle && template && (
            <GeneratingStep
              imageStyle={imageStyle}
              template={template}
              onFinished={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
