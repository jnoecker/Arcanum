// ─── TimingDropdown ───────────────────────────────────────────────
// Auto-play timing selector: 5s, 10s, 15s.

interface TimingDropdownProps {
  interval: number;
  onChange: (interval: number) => void;
}

const TIMING_OPTIONS = [
  { value: 5000, label: "5s" },
  { value: 10000, label: "10s" },
  { value: 15000, label: "15s" },
];

export function TimingDropdown({ interval, onChange }: TimingDropdownProps) {
  return (
    <label>
      <span className="text-[12px] font-display text-text-muted tracking-[0.14em] uppercase sr-only">
        Auto-play timing
      </span>
      <select
        value={interval}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-bg-secondary/60 border border-border-muted/60 rounded-lg text-[12px] font-display text-text-primary px-2 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        {TIMING_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
