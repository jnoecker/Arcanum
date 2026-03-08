interface WizardStepLayoutProps {
  title: string;
  whyItMatters?: string;
  children: React.ReactNode;
}

export function WizardStepLayout({
  title,
  whyItMatters,
  children,
}: WizardStepLayoutProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-6 pt-4 pb-2">
        <h3 className="font-display text-base tracking-wide text-text-primary">
          {title}
        </h3>
      </div>

      {whyItMatters && (
        <div className="mx-6 mb-3 rounded border border-accent/20 bg-accent/5 px-3 py-2">
          <p className="text-[10px] leading-relaxed text-text-muted">
            <span className="font-medium text-accent">Why this matters:</span>{" "}
            {whyItMatters}
          </p>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
        {children}
      </div>
    </div>
  );
}
