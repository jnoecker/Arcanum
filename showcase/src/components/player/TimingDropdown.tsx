interface TimingDropdownProps {
  interval: number;
  onChange: (interval: number) => void;
}

const TIMING_OPTIONS = [
  { value: 5000, label: "5 seconds" },
  { value: 10000, label: "10 seconds" },
  { value: 15000, label: "15 seconds" },
];

export function TimingDropdown({ interval, onChange }: TimingDropdownProps) {
  return (
    <label className="inline-flex min-h-11 items-center gap-3 rounded-full border border-border-muted/30 bg-bg-secondary/35 px-4 py-2">
      <span className="font-display text-[0.68rem] uppercase tracking-[0.18em] text-text-muted">Pace</span>
      <select
        value={interval}
        onChange={(event) => onChange(Number(event.target.value))}
        className="rounded-full border border-border-muted/25 bg-bg-abyss/80 px-3 py-1.5 text-[0.72rem] uppercase tracking-[0.16em] text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-aurum)]/35"
      >
        {TIMING_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
