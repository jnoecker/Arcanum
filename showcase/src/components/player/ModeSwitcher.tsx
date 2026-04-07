export type PlayerMode = "click" | "auto" | "scroll";

interface ModeSwitcherProps {
  mode: PlayerMode;
  onChange: (mode: PlayerMode) => void;
}

const MODES: { value: PlayerMode; label: string; shortDescription: string }[] = [
  { value: "click", label: "Click", shortDescription: "Manual" },
  { value: "auto", label: "Auto", shortDescription: "Timed" },
  { value: "scroll", label: "Scroll", shortDescription: "Exhibit" },
];

export function ModeSwitcher({ mode, onChange }: ModeSwitcherProps) {
  return (
    <fieldset className="inline-flex flex-wrap gap-2 rounded-[1.2rem] border border-border-muted/30 bg-bg-secondary/25 p-1.5">
      <legend className="sr-only">Navigation mode</legend>
      {MODES.map((entry) => {
        const active = mode === entry.value;
        return (
          <label
            key={entry.value}
            className={`min-h-11 rounded-[0.95rem] px-3 py-2 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-aurum)]/35 ${
              active
                ? "border border-[var(--color-aurum)]/35 bg-[var(--color-aurum)]/10 text-[var(--color-aurum-pale)]"
                : "border border-transparent bg-transparent text-text-muted hover:text-text-secondary"
            }`}
          >
            <input
              type="radio"
              name="story-player-mode"
              value={entry.value}
              checked={active}
              onChange={() => onChange(entry.value)}
              className="sr-only"
            />
            <span className="block font-display text-[0.72rem] uppercase tracking-[0.18em]">{entry.label}</span>
            <span className="mt-1 block text-[0.68rem] uppercase tracking-[0.16em] text-current/75">
              {entry.shortDescription}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
