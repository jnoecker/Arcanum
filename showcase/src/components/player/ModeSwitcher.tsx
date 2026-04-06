// ─── ModeSwitcher ─────────────────────────────────────────────────
// Segmented toggle for player navigation mode: Click | Auto | Scroll.

export type PlayerMode = "click" | "auto" | "scroll";

interface ModeSwitcherProps {
  mode: PlayerMode;
  onChange: (mode: PlayerMode) => void;
}

const MODES: { value: PlayerMode; label: string }[] = [
  { value: "click", label: "Click" },
  { value: "auto", label: "Auto" },
  { value: "scroll", label: "Scroll" },
];

export function ModeSwitcher({ mode, onChange }: ModeSwitcherProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Navigation mode"
      className="flex rounded-lg border border-border-muted/40 overflow-hidden"
    >
      {MODES.map((m) => (
        <button
          key={m.value}
          role="radio"
          aria-checked={mode === m.value}
          onClick={() => onChange(m.value)}
          className={`px-3 py-1.5 text-[12px] font-display tracking-[0.12em] uppercase transition-colors duration-200 ${
            mode === m.value
              ? "bg-accent/12 text-accent"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
