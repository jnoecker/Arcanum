import { useValidationStore } from "@/stores/validationStore";
import type { ValidationIssue } from "@/lib/validateZone";

export function ValidationPanel() {
  const results = useValidationStore((s) => s.results);
  const panelOpen = useValidationStore((s) => s.panelOpen);
  const closePanel = useValidationStore((s) => s.closePanel);

  if (!panelOpen || !results) return null;

  const totalErrors = [...results.values()]
    .flat()
    .filter((i) => i.severity === "error").length;
  const totalWarnings = [...results.values()]
    .flat()
    .filter((i) => i.severity === "warning").length;
  const isClean = totalErrors === 0 && totalWarnings === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="mx-4 flex max-h-[80vh] w-full max-w-xl flex-col rounded-lg border border-border-default bg-bg-secondary shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-default px-5 py-3">
          <h2 className="text-sm font-semibold text-text-primary">
            Validation Results
          </h2>
          <div className="flex items-center gap-3 text-xs">
            {totalErrors > 0 && (
              <span className="text-status-error">
                {totalErrors} error{totalErrors !== 1 ? "s" : ""}
              </span>
            )}
            {totalWarnings > 0 && (
              <span className="text-status-warning">
                {totalWarnings} warning{totalWarnings !== 1 ? "s" : ""}
              </span>
            )}
            {isClean && (
              <span className="text-status-success">All valid</span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {isClean ? (
            <p className="py-4 text-center text-sm text-text-muted">
              No issues found.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {[...results.entries()].map(([zoneId, issues]) => (
                <ZoneIssueGroup
                  key={zoneId}
                  zoneId={zoneId}
                  issues={issues}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-border-default px-5 py-3">
          <button
            onClick={closePanel}
            className="rounded bg-bg-elevated px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ZoneIssueGroup({
  zoneId,
  issues,
}: {
  zoneId: string;
  issues: ValidationIssue[];
}) {
  const errs = issues.filter((i) => i.severity === "error");
  const warns = issues.filter((i) => i.severity === "warning");

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <h3 className="text-xs font-semibold text-text-primary">{zoneId}</h3>
        <span className="text-[10px] text-text-muted">
          {errs.length}E / {warns.length}W
        </span>
      </div>
      <ul className="flex flex-col gap-0.5">
        {/* Errors first, then warnings */}
        {[...errs, ...warns].map((issue, i) => (
          <li key={i} className="flex items-start gap-2 py-0.5 text-xs">
            <span
              className={`mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                issue.severity === "error"
                  ? "bg-status-error"
                  : "bg-status-warning"
              }`}
            />
            <span className="shrink-0 font-mono text-text-muted">
              {issue.entity}
            </span>
            <span className="text-text-secondary">{issue.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
