import type { TransitionType } from "@/types/story";

interface TransitionDropdownProps {
  value: TransitionType;
  onChange: (type: TransitionType) => void;
}

const TRANSITION_OPTIONS: { value: TransitionType; label: string }[] = [
  { value: "crossfade", label: "Crossfade" },
  { value: "fade_black", label: "Fade to Black" },
];

export function TransitionDropdown({ value, onChange }: TransitionDropdownProps) {
  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">Scene transition type</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as TransitionType)}
        aria-label="Scene transition type"
        className="rounded-md border border-border-muted bg-bg-elevated px-3 py-1.5 text-xs text-text-primary outline-none transition-colors duration-[180ms] hover:border-border-default focus:border-border-focus"
      >
        {TRANSITION_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
