import { useState } from "react";
import { useAssetStore } from "@/stores/assetStore";

export type OnboardingImageStyle = "flux" | "gpt";

interface ArtStyleStepProps {
  onDone: (style: OnboardingImageStyle) => void;
}

interface StyleOption {
  id: OnboardingImageStyle;
  label: string;
  tagline: string;
  description: string;
  provider: "runware" | "openai";
  model: string;
  previewBackground: string;
  previewHint: string;
}

const STYLE_OPTIONS: StyleOption[] = [
  {
    id: "flux",
    label: "FLUX",
    tagline: "Classic fantasy",
    description:
      "Painterly, illustrated, a little cinematic. Leans into high-contrast lighting and moody atmosphere — the look of a hand-painted fantasy cover.",
    provider: "runware",
    model: "runware:400@2",
    previewBackground:
      "linear-gradient(140deg, #2a1840 0%, #6d3a8a 45%, #c58a4a 100%)",
    previewHint: "Moody, painterly, hand-illustrated",
  },
  {
    id: "gpt",
    label: "GPT Image",
    tagline: "Warmer, studio-softened",
    description:
      "Soft edges, gentle palettes, a storybook warmth. Reads more like animation concept art — approachable, friendly, and lightly whimsical.",
    provider: "openai",
    model: "openai:4@1",
    previewBackground:
      "linear-gradient(140deg, #f6d6c0 0%, #e3a0c5 40%, #8b7ac0 100%)",
    previewHint: "Soft, warm, storybook",
  },
];

export function ArtStyleStep({ onDone }: ArtStyleStepProps) {
  const settings = useAssetStore((s) => s.settings);
  const saveSettings = useAssetStore((s) => s.saveSettings);
  const setArtStyle = useAssetStore((s) => s.setArtStyle);
  const [pending, setPending] = useState<OnboardingImageStyle | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePick = async (option: StyleOption) => {
    if (!settings) {
      setError("Settings not loaded yet — give it a moment and try again.");
      return;
    }
    setPending(option.id);
    setError(null);
    try {
      await saveSettings({
        ...settings,
        image_provider: option.provider,
        image_model: option.model,
      });
      setArtStyle("gentle_magic");
      onDone(option.id);
    } catch (e) {
      setError(String(e));
      setPending(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm leading-7 text-text-secondary">
        Both produce the same scenes from the same prompts, but they feel different. Pick whichever
        look you'd like your world to wear. You can swap later from Settings.
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        {STYLE_OPTIONS.map((option) => {
          const isPending = pending === option.id;
          return (
            <button
              key={option.id}
              onClick={() => handlePick(option)}
              disabled={pending !== null}
              className="group flex flex-col overflow-hidden rounded-3xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] text-left transition hover:border-[var(--border-accent-ring)] hover:shadow-[0_16px_40px_rgb(var(--accent-rgb)/0.16)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {/* Preview: hand-committed sample images go in creator/public/onboarding/.
                  Until those exist we render a representative gradient so the flow still reads. */}
              <div
                className="relative flex h-48 items-end p-4"
                style={{ background: option.previewBackground }}
              >
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgb(255_255_255/0.12),transparent_60%)]" />
                <div className="relative z-10">
                  <div className="text-2xs uppercase tracking-ui text-white/70">Sample</div>
                  <div className="mt-1 font-display text-sm text-white/90">{option.previewHint}</div>
                </div>
                {isPending && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <div className="h-6 w-6 rounded-full border-2 border-white/70 border-t-transparent animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="font-display text-xl text-text-primary">{option.label}</div>
                  <div className="text-2xs uppercase tracking-ui text-text-muted">
                    {option.tagline}
                  </div>
                </div>
                <p className="text-xs leading-6 text-text-secondary">{option.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {error && <p className="text-2xs text-status-error">{error}</p>}
    </div>
  );
}
