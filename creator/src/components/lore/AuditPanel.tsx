import { useState, useCallback } from "react";
import { useLoreStore } from "@/stores/loreStore";
import { auditLore, type AuditIssue } from "@/lib/loreAudit";
import { SuggestionPanel } from "@/components/lore/SuggestionPanel";

const SEVERITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  error: { bg: "bg-status-danger/15", text: "text-status-danger", label: "Error" },
  warning: { bg: "bg-status-warning/15", text: "text-status-warning", label: "Warning" },
  info: { bg: "bg-accent/10", text: "text-accent", label: "Info" },
};

interface AuditItem {
  key: string;
  issue: AuditIssue;
}

export function AuditPanel() {
  const lore = useLoreStore((s) => s.lore);
  const selectArticle = useLoreStore((s) => s.selectArticle);
  const [items, setItems] = useState<AuditItem[]>([]);
  const [audited, setAudited] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAudit = useCallback(() => {
    if (!lore) return;
    setLoading(true);
    setTimeout(() => {
      const issues = auditLore(lore);
      setItems(issues.map((issue, i) => ({ key: `audit-${i}`, issue })));
      setAudited(true);
      setLoading(false);
    }, 0);
  }, [lore]);

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

      <SuggestionPanel<AuditItem>
        items={items}
        loading={loading}
        trackAccepted={false}
        emptyMessage="All clear!"
        summarySlot={(visible) => {
          if (!audited) return null;
          const errorCount = visible.filter((i) => i.issue.severity === "error").length;
          const warnCount = visible.filter((i) => i.issue.severity === "warning").length;
          const infoCount = visible.filter((i) => i.issue.severity === "info").length;
          return (
            <div className="mb-4 flex gap-3 text-2xs">
              {errorCount > 0 && <span className="text-status-danger">{errorCount} error{errorCount !== 1 ? "s" : ""}</span>}
              {warnCount > 0 && <span className="text-status-warning">{warnCount} warning{warnCount !== 1 ? "s" : ""}</span>}
              {infoCount > 0 && <span className="text-accent">{infoCount} info</span>}
              {visible.length === 0 && <span className="text-status-success">All clear!</span>}
            </div>
          );
        }}
        renderCard={(item, { onDismiss }) => {
          const { issue } = item;
          const style = SEVERITY_STYLES[issue.severity]!;
          return (
            <>
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
                  onClick={onDismiss}
                  className="ml-auto rounded-full border border-[var(--chrome-stroke)] px-2 py-0.5 text-3xs text-text-muted transition hover:bg-[var(--chrome-highlight-strong)]"
                >
                  Dismiss
                </button>
              </div>
            </>
          );
        }}
      />
    </div>
  );
}
