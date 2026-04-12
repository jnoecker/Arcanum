import { useState } from "react";
import { ONBOARDING_FLAVORS } from "@/lib/baseTemplate/flavors";
import type { OnboardingFlavor } from "@/lib/baseTemplate/flavors";

interface FlavorStepProps {
  onDone: (flavor: OnboardingFlavor) => void;
  onBack: () => void;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function FlavorStep({ onDone, onBack }: FlavorStepProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState("");

  const handleCustomSubmit = () => {
    const trimmed = customText.trim();
    if (trimmed.length < 20) return;
    const customFlavor: OnboardingFlavor = {
      id: "custom",
      name: "Custom World",
      tagline: "Your imagination, your rules",
      description: trimmed,
      seedPrompt: trimmed,
      classExamples: {},
      raceExamples: {},
      gradientColors: ["#374151", "#6b7280"],
      icon: "\u2728",
    };
    onDone(customFlavor);
  };

  /** Pick two class re-skin examples for the card preview */
  const pickExamples = (flavor: OnboardingFlavor): [string, string][] => {
    const entries = Object.entries(flavor.classExamples);
    return entries.slice(0, 2) as [string, string][];
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-xl text-text-primary">Choose Your World's Theme</h3>
        <p className="text-sm leading-7 text-text-secondary">
          Pick a flavor to shape your academy's classes, races, creatures, and atmosphere.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ONBOARDING_FLAVORS.map((flavor) => {
          const examples = pickExamples(flavor);
          return (
            <button
              key={flavor.id}
              onClick={() => onDone(flavor)}
              className="group flex h-full flex-col overflow-hidden rounded-3xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] text-left transition hover:border-[var(--border-accent-ring)] hover:shadow-[0_16px_40px_rgb(var(--accent-rgb)/0.16)]"
            >
              <div
                className="relative flex h-24 items-center justify-center"
                style={{
                  background: `linear-gradient(140deg, ${flavor.gradientColors[0]} 0%, ${flavor.gradientColors[1]} 100%)`,
                }}
              >
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgb(255_255_255/0.12),transparent_60%)]" />
                <span className="relative z-10 text-4xl" role="img" aria-label={flavor.name}>
                  {flavor.icon}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="font-display text-base text-text-primary">{flavor.name}</div>
                <p className="text-xs leading-5 text-text-secondary">{flavor.tagline}</p>
                {examples.length > 0 && (
                  <div className="mt-auto flex flex-col gap-1 pt-2">
                    {examples.map(([base, reskin]) => (
                      <div key={base} className="text-2xs text-text-muted">
                        <span className="text-text-secondary">{base}</span>
                        <span className="mx-1 text-accent">&rarr;</span>
                        <span className="text-text-primary">{reskin}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Custom option */}
      <button
        onClick={() => setCustomOpen((o) => !o)}
        className={cx(
          "flex flex-col gap-2 rounded-3xl border-2 border-dashed p-5 text-left transition",
          customOpen
            ? "border-[var(--border-accent-ring)] bg-[var(--chrome-fill)]"
            : "border-[var(--chrome-stroke)] hover:border-[var(--border-accent-ring)]",
        )}
      >
        <div className="font-display text-lg text-text-primary">
          <span className="mr-2">&#x2728;</span>Create your own
        </div>
        <p className="text-xs leading-6 text-text-secondary">
          Describe your world in your own words and we'll build a custom flavor from it.
        </p>
      </button>

      {customOpen && (
        <div className="flex flex-col gap-3 rounded-3xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] p-5">
          <label htmlFor="custom-flavor" className="text-2xs uppercase tracking-ui text-text-muted">
            Describe your world
          </label>
          <textarea
            id="custom-flavor"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            rows={4}
            autoFocus
            placeholder="A sunken city of coral spires lit by bioluminescent jellyfish, where tide-priests summon ocean spirits and rogue leviathans patrol the deep..."
            className="ornate-input w-full rounded-xl border border-border-default bg-bg-primary px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent/60 focus-visible:ring-2 focus-visible:ring-border-active"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-2xs text-text-muted">
              At least 20 characters. A sentence or two is plenty.
            </p>
            <button
              onClick={handleCustomSubmit}
              disabled={customText.trim().length < 20}
              className="rounded-full border border-[var(--border-accent-ring)] bg-[linear-gradient(135deg,rgb(var(--accent-rgb)/0.3),rgb(var(--surface-rgb)/0.18))] px-5 py-2 text-xs font-medium text-text-primary transition hover:shadow-[0_14px_34px_rgb(var(--accent-rgb)/0.2)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Create My World
            </button>
          </div>
        </div>
      )}

      {/* Back button */}
      <div className="flex items-center">
        <button
          onClick={onBack}
          className="rounded-full border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-5 py-2 text-xs font-medium text-text-muted transition hover:border-[var(--border-accent-ring)] hover:text-text-primary"
        >
          &larr; Back
        </button>
      </div>
    </div>
  );
}
