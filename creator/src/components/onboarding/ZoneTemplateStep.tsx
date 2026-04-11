import { useState } from "react";
import {
  ONBOARDING_ZONE_TEMPLATES,
  buildCustomOnboardingTemplate,
  type OnboardingZoneTemplate,
} from "@/lib/onboardingZoneTemplates";

interface ZoneTemplateStepProps {
  onDone: (template: OnboardingZoneTemplate) => void;
}

export function ZoneTemplateStep({ onDone }: ZoneTemplateStepProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState("");

  const handleCustom = () => {
    const trimmed = customText.trim();
    if (!trimmed) return;
    onDone(buildCustomOnboardingTemplate(trimmed));
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm leading-7 text-text-secondary">
        Pick the flavor of the first zone we'll generate. You'll keep shaping it by hand afterward —
        this is just a starting point, not a commitment.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ONBOARDING_ZONE_TEMPLATES.map((template) => (
          <button
            key={template.id}
            onClick={() => onDone(template)}
            className="group flex h-full flex-col gap-2 rounded-3xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] p-5 text-left transition hover:border-[var(--border-accent-ring)] hover:shadow-[0_16px_40px_rgb(var(--accent-rgb)/0.16)]"
          >
            <div className="font-display text-lg text-text-primary">{template.name}</div>
            <p className="text-xs leading-6 text-text-secondary">{template.blurb}</p>
          </button>
        ))}

        <button
          onClick={() => setCustomOpen((o) => !o)}
          className={`flex h-full flex-col gap-2 rounded-3xl border-2 border-dashed p-5 text-left transition ${
            customOpen
              ? "border-[var(--border-accent-ring)] bg-[var(--chrome-fill)]"
              : "border-[var(--chrome-stroke)] hover:border-[var(--border-accent-ring)]"
          }`}
        >
          <div className="font-display text-lg text-text-primary">Create your own</div>
          <p className="text-xs leading-6 text-text-secondary">
            Describe the world in your own words and we'll seed it from that.
          </p>
        </button>
      </div>

      {customOpen && (
        <div className="flex flex-col gap-3 rounded-3xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] p-5">
          <label htmlFor="custom-world" className="text-2xs uppercase tracking-ui text-text-muted">
            Describe your world
          </label>
          <textarea
            id="custom-world"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            rows={4}
            autoFocus
            placeholder="A sunken city of coral spires lit by bioluminescent jellyfish..."
            className="ornate-input w-full rounded-xl border border-border-default bg-bg-primary px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent/60 focus-visible:ring-2 focus-visible:ring-border-active"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-2xs text-text-muted">
              A sentence or two is plenty — we'll ask the hub to fill in the rest.
            </p>
            <button
              onClick={handleCustom}
              disabled={!customText.trim()}
              className="rounded-full border border-[var(--border-accent-ring)] bg-[linear-gradient(135deg,rgb(var(--accent-rgb)/0.3),rgb(var(--surface-rgb)/0.18))] px-5 py-2 text-xs font-medium text-text-primary transition hover:shadow-[0_14px_34px_rgb(var(--accent-rgb)/0.2)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Generate this world
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
