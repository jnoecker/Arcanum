import type { ReactNode } from "react";

interface OrnateCardProps {
  /** Sequence indicator. Strings are accepted for sub-steps ("1b", "3a").
   *  Omit when the card is part of a thematic grouping where sequence
   *  doesn't carry meaning — the badge will be hidden entirely. */
  number?: number | string;
  title: string;
  description?: string;
  /** Optional content rendered to the right of the title block — typically
   *  a status pill, count chip, or small inline action. */
  headerEnd?: ReactNode;
  /** Visual tone of the card chrome.
   *  - "default": standard translucent panel for content over the page bg.
   *  - "scrimmed": more opaque gradient for cards rendered over a strong
   *    backdrop image (Publish World modal, etc.). Image still bleeds
   *    through the gaps between cards but text stays legible. */
  tone?: "default" | "scrimmed";
  className?: string;
  children: ReactNode;
}

/**
 * Numbered ornate card — the World panel's signature card. Renders as a
 * masonry-friendly block (`break-inside-avoid`) with a glowing circular
 * numeric badge, heading, optional description, and a content body. Use
 * for ordered checklists where the sequence carries meaning (publish
 * pipelines, deploy steps, world-tuning workflows).
 *
 * Don't sprinkle these onto unordered grids — the badge implies sequence,
 * and using it without one reads as decoration. If you need a card without
 * a number, use the bare `panel-surface` utility instead.
 */
export function OrnateCard({
  number,
  title,
  description,
  headerEnd,
  tone = "default",
  className,
  children,
}: OrnateCardProps) {
  const bg = tone === "scrimmed" ? "bg-[var(--bg-panel-strong)]" : "bg-[var(--bg-panel)]";
  return (
    <section
      className={`ornate-card mb-4 break-inside-avoid rounded-2xl border border-[var(--chrome-stroke)] ${bg} p-4 shadow-section ${className ?? ""}`}
    >
      <header className="mb-3 flex items-start gap-3">
        {number !== undefined && (
          <span
            aria-hidden="true"
            className="ornate-card-badge mt-0.5 inline-flex h-7 min-w-[1.75rem] shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/10 px-1.5 font-display text-2xs font-semibold tracking-wider text-accent shadow-[0_0_0_3px_rgb(var(--bg-rgb))_inset,0_0_8px_rgb(var(--accent-rgb)/0.15)]"
          >
            {number}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-sm font-semibold tracking-wide text-text-primary">
            {title}
          </h3>
          {description && (
            <p className="mt-1 text-2xs leading-relaxed text-text-muted">{description}</p>
          )}
        </div>
        {headerEnd && <div className="flex-none">{headerEnd}</div>}
      </header>
      <div className="ornate-card-body">{children}</div>
    </section>
  );
}
