import { useState, useCallback, useRef, useMemo } from "react";
import { AI_ENABLED } from "@/lib/featureFlags";
import { useAssetStore } from "@/stores/assetStore";
import { useToastStore } from "@/stores/toastStore";
import {
  analyzeZoneLayout,
  type LayoutIssue,
  type TextDirectionMismatch,
} from "@/lib/zoneLayoutDoctor";
import {
  rewriteRoomDescriptions,
  type TextRewriteResult,
} from "@/lib/zoneLayoutDoctorLlm";
import type { WorldFile } from "@/types/world";
import { ActionButton, Spinner } from "@/components/ui/FormWidgets";

interface ZoneLayoutDoctorProps {
  zoneId: string;
  world: WorldFile;
  onWorldChange: (world: WorldFile) => void;
}

type IssueSeverityBadge = "error" | "warning";

const SEVERITY_STYLES: Record<IssueSeverityBadge, string> = {
  error: "bg-status-error/15 text-status-error",
  warning: "bg-status-warning/15 text-status-warning",
};

const KIND_LABELS: Record<string, string> = {
  "one-way-exit": "One-Way Exit",
  "contradictory-pair": "Contradictory Pair",
  "disconnected-room": "Disconnected Room",
  "text-direction-mismatch": "Text Mismatch",
  "text-room-mismatch": "Text ↔ Layout Mismatch",
};

export function ZoneLayoutDoctor({ world, onWorldChange }: ZoneLayoutDoctorProps) {
  const settings = useAssetStore((s) => s.settings);
  const hasLlmKey = !!(
    settings?.deepinfra_api_key ||
    settings?.anthropic_api_key ||
    settings?.openrouter_api_key
  );

  const [analyzed, setAnalyzed] = useState(false);
  const [issues, setIssues] = useState<LayoutIssue[]>([]);
  const [textMismatches, setTextMismatches] = useState<TextDirectionMismatch[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [rewriting, setRewriting] = useState(false);
  const [rewrites, setRewrites] = useState<TextRewriteResult[]>([]);
  const [rewriteDismissed, setRewriteDismissed] = useState<Set<string>>(new Set());
  const [rewriteApplied, setRewriteApplied] = useState<Set<string>>(new Set());
  const [rewriteError, setRewriteError] = useState<string | null>(null);

  const worldRef = useRef(world);
  worldRef.current = world;

  const handleAnalyze = useCallback(() => {
    const report = analyzeZoneLayout(worldRef.current);
    setIssues(report.issues);
    setTextMismatches(report.textMismatches);
    setAnalyzed(true);
    setDismissed(new Set());
    setApplied(new Set());
    setRewrites([]);
    setRewriteDismissed(new Set());
    setRewriteApplied(new Set());
    setRewriteError(null);
  }, []);

  const handleApplyFix = useCallback((issue: LayoutIssue) => {
    if (!issue.fix) return;
    try {
      const next = issue.fix.apply(worldRef.current);
      onWorldChange(next);
      setApplied((prev) => new Set(prev).add(issue.key));
      useToastStore.getState().show("Fix applied");
    } catch (e) {
      useToastStore.getState().show({ message: `Failed: ${e}`, variant: "ember" });
    }
  }, [onWorldChange]);

  const handleDismiss = useCallback((key: string) => {
    setDismissed((prev) => new Set(prev).add(key));
  }, []);

  const handleRewriteDescriptions = useCallback(async () => {
    if (textMismatches.length === 0) return;
    setRewriting(true);
    setRewriteError(null);
    try {
      const results = await rewriteRoomDescriptions(worldRef.current, textMismatches);
      setRewrites(results);
    } catch (e) {
      setRewriteError(String(e));
    } finally {
      setRewriting(false);
    }
  }, [textMismatches]);

  const handleApplyRewrite = useCallback((result: TextRewriteResult) => {
    const next = structuredClone(worldRef.current);
    const room = next.rooms[result.roomId];
    if (!room) return;
    room.description = result.rewritten;
    onWorldChange(next);
    setRewriteApplied((prev) => new Set(prev).add(result.roomId));
    useToastStore.getState().show(`Updated ${result.roomId} description`);
  }, [onWorldChange]);

  const handleDismissRewrite = useCallback((roomId: string) => {
    setRewriteDismissed((prev) => new Set(prev).add(roomId));
  }, []);

  // Filter visible issues
  const visibleIssues = useMemo(
    () => issues.filter((i) => !dismissed.has(i.key) && !applied.has(i.key)),
    [issues, dismissed, applied],
  );

  const visibleRewrites = useMemo(
    () => rewrites.filter((r) => !rewriteDismissed.has(r.roomId) && !rewriteApplied.has(r.roomId)),
    [rewrites, rewriteDismissed, rewriteApplied],
  );

  // Counts by severity
  const errorCount = visibleIssues.filter((i) => i.severity === "error").length;
  const warningCount = visibleIssues.filter((i) => i.severity === "warning").length;
  const isTextIssue = (k: LayoutIssue["kind"]) =>
    k === "text-direction-mismatch" || k === "text-room-mismatch";
  const textMismatchCount = visibleIssues.filter((i) => isTextIssue(i.kind)).length;
  const structuralCount = visibleIssues.filter((i) => !isTextIssue(i.kind)).length;

  const roomCount = Object.keys(world.rooms).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-sm uppercase tracking-widest text-accent">
            Layout Doctor
          </h2>
          <p className="mt-1 text-2xs text-text-muted">
            Analyze exit wiring, detect structural problems, and fix directional references in room descriptions.
          </p>
        </div>
        <ActionButton
          onClick={handleAnalyze}
          disabled={roomCount === 0}
        >
          {analyzed ? "Re-analyze" : "Analyze Zone"}
        </ActionButton>
      </div>

      {/* Empty state */}
      {!analyzed && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-muted bg-bg-elevated/50 px-8 py-16">
          <div className="font-display text-base uppercase tracking-widest text-text-muted">
            No Analysis Yet
          </div>
          <p className="mt-2 max-w-md text-center text-2xs text-text-secondary">
            Run the Layout Doctor to scan this zone's {roomCount} rooms for structural issues
            and text/exit mismatches.
          </p>
        </div>
      )}

      {/* Results summary */}
      {analyzed && (
        <div className="flex flex-wrap gap-3 text-2xs">
          {visibleIssues.length === 0 && visibleRewrites.length === 0 ? (
            <span className="text-status-success">
              No issues found — this zone's layout is clean!
            </span>
          ) : (
            <>
              {errorCount > 0 && (
                <span className="text-status-error">
                  {errorCount} error{errorCount !== 1 ? "s" : ""}
                </span>
              )}
              {warningCount > 0 && (
                <span className="text-status-warning">
                  {warningCount} warning{warningCount !== 1 ? "s" : ""}
                </span>
              )}
              <span className="text-text-muted">
                {applied.size + rewriteApplied.size} fixed, {dismissed.size + rewriteDismissed.size} dismissed
              </span>
            </>
          )}
        </div>
      )}

      {/* Structural issues */}
      {analyzed && structuralCount > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-display text-xs uppercase tracking-widest text-text-secondary">
            Structural Issues
          </h3>
          {visibleIssues
            .filter((i) => !isTextIssue(i.kind))
            .map((issue) => (
              <div
                key={issue.key}
                className="rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-4 py-3"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-3xs font-medium ${SEVERITY_STYLES[issue.severity]}`}>
                    {issue.severity}
                  </span>
                  <span className="text-3xs text-text-muted">
                    {KIND_LABELS[issue.kind] ?? issue.kind}
                  </span>
                </div>
                <p className="mb-2 text-xs text-text-secondary">{issue.message}</p>
                <div className="flex items-center gap-2">
                  {issue.fix && (
                    <button
                      onClick={() => handleApplyFix(issue)}
                      className="focus-ring rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-2xs text-accent transition hover:bg-accent/20"
                    >
                      {issue.fix.label}
                    </button>
                  )}
                  <button
                    onClick={() => handleDismiss(issue.key)}
                    className="focus-ring rounded-full border border-[var(--chrome-stroke)] px-3 py-1 text-2xs text-text-muted transition hover:bg-[var(--chrome-highlight-strong)]"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Text/direction mismatches */}
      {analyzed && textMismatchCount > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xs uppercase tracking-widest text-text-secondary">
              Text / Direction Mismatches
            </h3>
            {AI_ENABLED && hasLlmKey && textMismatchCount > 0 && rewrites.length === 0 && (
              <ActionButton
                onClick={handleRewriteDescriptions}
                disabled={rewriting}
                size="sm"
                variant="secondary"
              >
                {rewriting ? <><Spinner className="mr-1.5" /> Rewriting...</> : "Auto-fix with AI"}
              </ActionButton>
            )}
          </div>

          {/* Show text mismatch issue cards when no rewrites have been generated yet */}
          {rewrites.length === 0 && visibleIssues
            .filter((i) => isTextIssue(i.kind))
            .map((issue) => (
              <div
                key={issue.key}
                className="rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-4 py-3"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-3xs font-medium ${SEVERITY_STYLES[issue.severity]}`}>
                    {issue.severity}
                  </span>
                  <span className="text-3xs text-text-muted">
                    {KIND_LABELS[issue.kind]}
                  </span>
                </div>
                <p className="mb-2 text-xs text-text-secondary">{issue.message}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDismiss(issue.key)}
                    className="focus-ring rounded-full border border-[var(--chrome-stroke)] px-3 py-1 text-2xs text-text-muted transition hover:bg-[var(--chrome-highlight-strong)]"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* AI-generated rewrite cards */}
      {visibleRewrites.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-display text-xs uppercase tracking-widest text-text-secondary">
            Suggested Rewrites
          </h3>
          {visibleRewrites.map((result) => (
            <div
              key={result.roomId}
              className="rounded-xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-4 py-3"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-full bg-stellar-blue/15 px-2 py-0.5 text-3xs font-medium text-stellar-blue">
                  AI Rewrite
                </span>
                <span className="text-2xs font-medium text-text-primary">
                  {result.roomId}
                </span>
                <span className="text-3xs text-text-muted">
                  {world.rooms[result.roomId]?.title}
                </span>
              </div>

              {/* Diff view */}
              <div className="mb-3 grid gap-2 md:grid-cols-2">
                <div className="rounded-lg bg-bg-abyss/50 p-3">
                  <div className="mb-1 text-3xs font-medium uppercase tracking-widest text-status-error/70">
                    Before
                  </div>
                  <p className="text-2xs leading-relaxed text-text-secondary">
                    {result.original}
                  </p>
                </div>
                <div className="rounded-lg bg-bg-abyss/50 p-3">
                  <div className="mb-1 text-3xs font-medium uppercase tracking-widest text-status-success/70">
                    After
                  </div>
                  <p className="text-2xs leading-relaxed text-text-secondary">
                    {result.rewritten}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleApplyRewrite(result)}
                  className="focus-ring rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-2xs text-accent transition hover:bg-accent/20"
                >
                  Accept
                </button>
                <button
                  onClick={() => handleDismissRewrite(result.roomId)}
                  className="focus-ring rounded-full border border-[var(--chrome-stroke)] px-3 py-1 text-2xs text-text-muted transition hover:bg-[var(--chrome-highlight-strong)]"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* LLM hint */}
      {analyzed && textMismatchCount > 0 && !hasLlmKey && AI_ENABLED && (
        <p className="text-2xs italic text-text-muted">
          Configure an LLM API key in Settings to auto-fix text/direction mismatches.
        </p>
      )}

      {/* Rewrite error */}
      {rewriteError && (
        <p className="text-2xs italic text-status-error">{rewriteError}</p>
      )}

      {/* Rewriting spinner */}
      {rewriting && (
        <div className="flex items-center gap-3 rounded-xl border border-border-muted bg-bg-elevated/50 px-6 py-8">
          <Spinner />
          <span className="text-2xs uppercase tracking-widest text-text-muted">
            AI is rewriting room descriptions...
          </span>
        </div>
      )}
    </div>
  );
}
