import type { ReactNode } from "react";

interface OrnateCardProps {
  number: number;
  title: string;
  description?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Numbered ornate card used by the World panel grid. Renders as a
 * masonry block (`break-inside-avoid`) with a circular numeric badge,
 * heading, and content body. Uses the panel-surface chrome with an
 * accent rule on the left so the cards read as a numbered sequence
 * when scanned vertically in either column.
 */
export function OrnateCard({
  number,
  title,
  description,
  className,
  children,
}: OrnateCardProps) {
  return (
    <section
      className={`ornate-card mb-4 break-inside-avoid rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--bg-panel)] p-4 shadow-section ${className ?? ""}`}
    >
      <header className="mb-3 flex items-start gap-3">
        <span
          aria-hidden="true"
          className="ornate-card-badge mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/10 font-display text-2xs font-semibold tracking-wider text-accent shadow-[0_0_0_3px_rgb(var(--bg-rgb))_inset,0_0_8px_rgb(var(--accent-rgb)/0.15)]"
        >
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-sm font-semibold tracking-wide text-text-primary">
            {title}
          </h3>
          {description && (
            <p className="mt-1 text-2xs leading-relaxed text-text-muted">{description}</p>
          )}
        </div>
      </header>
      <div className="ornate-card-body">{children}</div>
    </section>
  );
}
