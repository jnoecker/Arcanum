import { useState, useCallback } from "react";
import { useLoreStore } from "@/stores/loreStore";
import { auditLore, type AuditIssue } from "@/lib/loreAudit";

const SEVERITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  error: { bg: "bg-status-danger/15", text: "text-status-danger", label: "Error" },
  warning: { bg: "bg-status-warning/15", text: "text-status-warning", label: "Warning" },
  info: { bg: "bg-accent/10", text: "text-accent", label: "Info" },
};

export function AuditPanel() {
  const lore = useLoreStore((s) => s.lore);
  const selectArticle = useLoreStore((s) => s.selectArticle);
  const [issues, setIssues] = useState<AuditIssue[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [audited, setAudited] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAudit = useCallback(() => {
    if (!lore) return;
    setLoading(true);
    setTimeout(() => {
      setIssues(auditLore(lore));
      setDismissed(new Set());
      setAudited(true);
      setLoading(false);
    }, 0);
  }, [lore]);

  const visibleWithIndex = issues
    .map((issue, i) => ({ issue, idx: i }))
    .filter(({ idx }) => !dismissed.has(idx));
  const visible = visibleWithIndex.map(({ issue }) => issue);
  const errorCount = visible.filter((i) => i.severity === "error").length;
  const warnCount = visible.filter((i) => i.severity === "warning").length;
  const infoCount = visible.filter((i) => i.severity === "info").length;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-lg text-text-primary">Lore Audit</h2>
        <button
          onClick={handleAudit}
          disabled={!lore || loading}
          className="focus-ring rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:opacity-40"
        >
          {loading ? "Auditing..." : audited ? "Re-audit" : "Run Audit"}
        </button>
      </div>
      <p className="mb-4 text-2xs text-text-secondary">
        Check for orphaned references, duplicate titles, timeline mismatches, and structural issues.
      </p>

      {audited && (
        <div className="mb-4 flex gap-3 text-2xs">
          {errorCount > 0 && <span className="text-status-danger">{errorCount} error{errorCount !== 1 ? "s" : ""}</span>}
          {warnCount > 0 && <span className="text-status-warning">{warnCount} warning{warnCount !== 1 ? "s" : ""}</span>}
          {infoCount > 0 && <span className="text-accent">{infoCount} info</span>}
          {visible.length === 0 && <span className="text-status-success">All clear!</span>}
        </div>
      )}

      {visible.length > 0 && (
        <div className="flex flex-col gap-2">
          {visibleWithIndex.map(({ issue, idx }) => {
            const style = SEVERITY_STYLES[issue.severity]!;
            return (
              <div key={idx} className="rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-4 py-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-3xs font-medium ${style.bg} ${style.text}`}>
                    {style.label}
                  </span>
                  <span className="text-3xs text-text-muted">{issue.category}</span>
                </div>
                <p className="mb-2 text-xs text-text-secondary">{issue.message}</p>
                <div className="flex items-center gap-2">
                  {issue.articleIds.map((id) => (
                    <button
                      key={id}
                      onClick={() => selectArticle(id)}
                      className="text-2xs text-accent hover:text-text-primary transition-colors"
                    >
                      {lore?.articles[id]?.title ?? id}
                    </button>
                  ))}
                  <button
                    onClick={() => setDismissed((s) => new Set(s).add(idx))}
                    className="ml-auto rounded-full border border-[var(--chrome-stroke)] px-2 py-0.5 text-3xs text-text-muted transition hover:bg-[var(--chrome-highlight-strong)]"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
