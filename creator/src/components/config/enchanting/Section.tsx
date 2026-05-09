import type { ReactNode } from "react";

interface SectionProps {
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Section({
  title,
  description,
  actions,
  className,
  children,
}: SectionProps) {
  return (
    <section
      className={`panel-surface relative flex flex-col gap-3 overflow-hidden rounded-2xl p-4 shadow-section ${className ?? ""}`}
    >
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
            {title}
          </h3>
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
