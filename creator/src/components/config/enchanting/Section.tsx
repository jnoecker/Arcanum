import type { ReactNode } from "react";

export type SectionTier = "primary" | "secondary" | "ghost" | "default";

interface SectionProps {
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
  className?: string;
  tier?: SectionTier;
  children: ReactNode;
}

export function Section({
  title,
  description,
  actions,
  className,
  tier = "default",
  children,
}: SectionProps) {
  const tierClasses =
    tier === "primary"
      ? "panel-surface bg-gradient-glow-top shadow-section shadow-glow-warm border-accent/25"
      : tier === "secondary"
        ? "panel-surface shadow-section"
        : tier === "ghost"
          ? "bg-gradient-panel-light border border-[var(--chrome-stroke)] opacity-95"
          : "panel-surface shadow-section";

  const showFlourish = tier === "primary";
  const titleClasses =
    tier === "primary"
      ? "font-display text-sm font-semibold uppercase tracking-[0.2em] text-text-primary"
      : tier === "ghost"
        ? "font-display text-2xs font-semibold uppercase tracking-[0.18em] text-text-muted"
        : "font-display text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary";

  return (
    <section
      className={`relative flex flex-col gap-3 overflow-hidden rounded-2xl p-4 ${tierClasses} ${className ?? ""}`}
    >
      {showFlourish && (
        <span
          aria-hidden="true"
          className="flourish-top-thread pointer-events-none absolute inset-x-6 top-0 h-px"
        />
      )}
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className={titleClasses}>{title}</h3>
          {description && (
            <p className="mt-0.5 text-2xs leading-relaxed text-text-muted">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </header>
      <div className="flex min-w-0 flex-col">{children}</div>
    </section>
  );
}
