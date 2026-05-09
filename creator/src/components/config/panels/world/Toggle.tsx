import { useId } from "react";

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}

/** Switch-style toggle. The track itself is the affordance — no redundant On/Off word. */
export function Toggle({ checked, onChange, label }: ToggleProps) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-2 rounded-md border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-2.5 py-2 transition-colors hover:bg-[var(--chrome-fill)]"
    >
      <span className="min-w-0 flex-1 truncate text-xs text-text-secondary">{label}</span>
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-accent/80" : "bg-[var(--chrome-fill-strong)]"
        }`}
        aria-hidden="true"
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-bg-primary shadow-md transition-transform ${
            checked ? "translate-x-[1.125rem]" : "translate-x-0.5"
          }`}
        />
      </span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
        aria-pressed={checked}
        className="sr-only"
      />
    </label>
  );
}
