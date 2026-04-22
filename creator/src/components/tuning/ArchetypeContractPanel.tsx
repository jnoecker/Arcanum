import { getArchetypeContract } from "@/lib/tuning/archetypes";
import type { ArchetypeEvaluation, ContractCheck, ContractCheckStatus } from "@/lib/tuning/archetypeScore";
import type { TuningPreset } from "@/lib/tuning/presets";

interface ArchetypeContractPanelProps {
  preset: TuningPreset;
  evaluation: ArchetypeEvaluation;
}

const STATUS_STYLES = {
  validated: {
    badge: "border-status-success/35 bg-status-success/[0.08] text-status-success",
    label: "Validated Archetype",
  },
  close: {
    badge: "border-status-warning/35 bg-status-warning/[0.08] text-status-warning",
    label: "Close To Target",
  },
  "needs-tuning": {
    badge: "border-status-error/35 bg-status-error/[0.08] text-status-error",
    label: "Needs Tuning",
  },
} as const;

const CHECK_STYLES: Record<
  ContractCheckStatus,
  { dot: string; text: string; label: string }
> = {
  pass: {
    dot: "bg-status-success",
    text: "text-status-success",
    label: "Pass",
  },
  warn: {
    dot: "bg-status-warning",
    text: "text-status-warning",
    label: "Warn",
  },
  fail: {
    dot: "bg-status-error",
    text: "text-status-error",
    label: "Fail",
  },
};

function checkSortValue(check: ContractCheck): number {
  if (check.status === "fail") return 0;
  if (check.status === "warn") return 1;
  return 2;
}

export function ArchetypeContractPanel({
  preset,
  evaluation,
}: ArchetypeContractPanelProps) {
  const contract = getArchetypeContract(preset.id);
  if (!contract) return null;

  const statusStyle = STATUS_STYLES[evaluation.status];
  const checks = [...evaluation.checks].sort((left, right) => {
    const byStatus = checkSortValue(left) - checkSortValue(right);
    if (byStatus !== 0) return byStatus;
    return left.label.localeCompare(right.label);
  });

  return (
    <section
      aria-label={`${preset.name} archetype contract`}
      className="panel-surface mx-auto mt-6 w-full max-w-6xl rounded-[1.75rem] border border-border-muted px-6 py-5"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="font-display text-2xs uppercase tracking-wide-ui text-text-muted">
            Archetype Contract
          </p>
          <h3 className="mt-1 font-display text-base font-semibold text-text-primary">
            {contract.label}
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-[1.6] text-text-secondary">
            {contract.summary}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`rounded-full border px-3 py-1 font-display text-2xs uppercase tracking-wide-ui ${statusStyle.badge}`}
          >
            {statusStyle.label}
          </div>
          <div className="rounded-full border border-border-muted bg-bg-secondary/40 px-3 py-1 font-mono text-sm text-text-primary">
            {evaluation.score}/100
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {contract.pillars.map((pillar) => (
          <span
            key={pillar}
            className="rounded-full border border-border-muted bg-bg-secondary/40 px-3 py-1 text-2xs text-text-secondary"
          >
            {pillar}
          </span>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
        {checks.map((check) => {
          const style = CHECK_STYLES[check.status];
          return (
            <div
              key={check.id}
              className="rounded-[1rem] border border-border-muted bg-bg-secondary/40 px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-text-primary">{check.label}</p>
                  <p className="mt-1 text-2xs text-text-muted">{check.detail}</p>
                </div>
                <span className={`shrink-0 font-display text-2xs uppercase tracking-wide-ui ${style.text}`}>
                  <span aria-hidden="true" className={`mr-2 inline-block h-2 w-2 rounded-full ${style.dot}`} />
                  {style.label}
                </span>
              </div>
              <div className="mt-3 flex flex-col gap-1 text-2xs">
                <p className="text-text-secondary">
                  Actual: <span className="font-mono text-text-primary">{check.actual}</span>
                </p>
                <p className="text-text-muted">
                  Target: <span className="font-mono text-text-secondary">{check.expected}</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
