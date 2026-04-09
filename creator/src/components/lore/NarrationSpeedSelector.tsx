import type { NarrationSpeed } from "@/lib/narrationSpeed";

// ─── Types ────────────────────────────────────────────────────────

interface NarrationSpeedSelectorProps {
  value: NarrationSpeed | undefined;
  storyDefault?: NarrationSpeed;
  onChange: (speed: NarrationSpeed | undefined) => void;
}

const SPEED_OPTIONS: { value: NarrationSpeed; label: string }[] = [
  { value: "slow", label: "Slow" },
  { value: "normal", label: "Normal" },
  { value: "fast", label: "Fast" },
];

// ─── NarrationSpeedSelector ───────────────────────────────────────

export function NarrationSpeedSelector({
  value,
  storyDefault,
  onChange,
}: NarrationSpeedSelectorProps) {
  const effectiveDefault = storyDefault ?? "normal";
  const effectiveValue = value ?? effectiveDefault;
  const isOverridden = value !== undefined && value !== effectiveDefault;

  const handleClick = (speed: NarrationSpeed) => {
    // If clicking the segment that matches the default, clear the override
    if (speed === effectiveDefault) {
      onChange(undefined);
    } else {
      onChange(speed);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {/* Label with override indicator */}
      <div className="flex items-center gap-1.5">
        <span className="font-body text-[10px] text-text-muted uppercase tracking-[0.18em]">
          Narration Speed
        </span>
        {isOverridden && (
          <span className="w-1 h-1 rounded-full bg-accent" />
        )}
      </div>

      {/* Segmented control */}
      <div
        role="radiogroup"
        aria-label="Narration speed"
        className="flex w-full max-w-[200px] h-7 bg-bg-tertiary rounded-md overflow-hidden"
      >
        {SPEED_OPTIONS.map((option) => {
          const active = option.value === effectiveValue;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              className={`flex-1 flex items-center justify-center cursor-pointer transition-colors duration-[180ms] font-body text-xs ${
                active
                  ? "bg-bg-elevated text-accent"
                  : "text-text-muted hover:text-text-secondary"
              }`}
              onClick={() => handleClick(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
