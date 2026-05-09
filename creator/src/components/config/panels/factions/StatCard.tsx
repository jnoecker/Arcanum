import { useState } from "react";

interface StatCardProps {
  label: string;
  hint: string;
  value: number;
  onCommit: (v: number) => void;
  min?: number;
  /** Color tint applied to the value when focused + outer accent ring. */
  tint?: "neutral" | "rose" | "emerald";
}

const TINT_CLASSES: Record<NonNullable<StatCardProps["tint"]>, { ring: string; glow: string }> = {
  neutral: {
    ring: "border-stellar-blue/30",
    glow: "shadow-[0_0_24px_-12px_rgb(var(--stellar-blue-rgb)/0.6)]",
  },
  rose: {
    ring: "border-status-error/30",
    glow: "shadow-[0_0_24px_-12px_rgb(var(--status-error-rgb)/0.6)]",
  },
  emerald: {
    ring: "border-status-success/30",
    glow: "shadow-[0_0_24px_-12px_rgb(var(--status-success-rgb)/0.6)]",
  },
};

/**
 * Hero-strip stat tile used for the global reputation knobs (Starting
 * Rep, Kill Penalty, Kill Bonus). Number is editable inline — click to
 * type, blur or Enter to commit.
 */
export function StatCard({
  label,
  hint,
  value,
  onCommit,
  min,
  tint = "neutral",
}: StatCardProps) {
  const t = TINT_CLASSES[tint];
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  if (!focused && draft !== String(value)) {
    setDraft(String(value));
  }

  const commit = () => {
    const n = Number(draft);
    if (!Number.isNaN(n) && n !== value) onCommit(n);
    else setDraft(String(value));
  };

  return (
    <div
      className={`panel-surface flex items-center gap-4 rounded-2xl border p-3 pl-4 ${t.ring} ${t.glow}`}
    >
      <div className="min-w-0 flex-1">
        <p className="font-display text-2xs font-semibold uppercase tracking-[0.18em] text-text-muted">
          {label}
        </p>
        <input
          type="number"
          value={draft}
          min={min}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            commit();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setDraft(String(value));
              (e.target as HTMLInputElement).blur();
            }
          }}
          aria-label={label}
          className="w-full border-none bg-transparent p-0 font-display text-3xl font-bold leading-none text-text-primary outline-none focus:text-accent"
        />
        <p className="mt-1 text-2xs leading-snug text-text-muted/70">{hint}</p>
      </div>
    </div>
  );
}
