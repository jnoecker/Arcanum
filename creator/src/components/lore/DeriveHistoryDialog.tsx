import { useEffect, useState } from "react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { DialogShell, ActionButton, Spinner } from "@/components/ui/FormWidgets";
import { deriveWorldHistory, type DeriveResult } from "@/lib/loreDerive";

interface DeriveHistoryDialogProps {
  currentValue: string;
  onAccept: (history: string) => void;
  onClose: () => void;
}

export function DeriveHistoryDialog({
  currentValue,
  onAccept,
  onClose,
}: DeriveHistoryDialogProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<DeriveResult | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    deriveWorldHistory()
      .then((r) => {
        if (cancelled) return;
        setResult(r);
        setDraft(r.content);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAccept = () => {
    onAccept(draft);
    onClose();
  };

  const willReplace = currentValue.trim().length > 0;

  return (
    <DialogShell
      dialogRef={trapRef}
      titleId="derive-history-title"
      title="Derive History from Lore"
      subtitle="Synthesized from timeline events and lore articles"
      widthClassName="max-w-5xl"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <ActionButton variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </ActionButton>
          {result && !loading && !error && (
            <ActionButton
              variant="primary"
              size="sm"
              onClick={handleAccept}
              disabled={!draft.trim()}
            >
              {willReplace ? "Replace History" : "Use as History"}
            </ActionButton>
          )}
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center gap-3 py-8 text-sm text-text-secondary">
          <Spinner /> Reading the timeline and gathering relevant lore…
        </div>
      ) : error ? (
        <p className="text-sm text-status-error">{error}</p>
      ) : result ? (
        <div className="flex flex-col gap-3">
          <ResultBanner result={result} />

          {result.sources.length > 0 && (
            <div className="rounded-lg border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-soft)] px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-text-secondary">
                  <span className="text-accent">
                    {result.sources.length} lore source
                    {result.sources.length === 1 ? "" : "s"}
                  </span>{" "}
                  used as additional context.
                </p>
                <button
                  type="button"
                  onClick={() => setSourcesOpen((o) => !o)}
                  className="focus-ring rounded text-2xs uppercase tracking-wider text-text-muted transition hover:text-text-primary"
                >
                  {sourcesOpen ? "Hide" : "Show"} sources
                </button>
              </div>
              {sourcesOpen && (
                <ul className="mt-2 flex flex-col gap-1">
                  {result.sources.map((s) => (
                    <li
                      key={`${s.kind}:${s.id}`}
                      className="flex items-center gap-2 text-2xs"
                    >
                      <span className="inline-flex h-4 min-w-12 items-center justify-center rounded bg-bg-tertiary px-1.5 font-mono text-3xs uppercase tracking-wider text-text-muted">
                        {s.kind}
                      </span>
                      <span className="text-text-secondary">{s.title}</span>
                      <span className="ml-auto font-mono text-3xs text-text-muted">
                        {s.score.toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label
              htmlFor="derive-history-draft"
              className="font-display text-2xs uppercase tracking-wider text-accent"
            >
              Proposed history
            </label>
            <textarea
              id="derive-history-draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={18}
              className="ornate-input w-full resize-y rounded border border-accent/30 bg-bg-primary px-3 py-2 text-sm leading-relaxed text-text-secondary"
            />
            <p className="text-2xs text-text-muted">
              Edit before accepting if you want to soften phrasing or adjust
              citations.
            </p>
          </div>
        </div>
      ) : null}
    </DialogShell>
  );
}

function ResultBanner({ result }: { result: DeriveResult }) {
  const haveContext = result.eventCount > 0 || result.sources.length > 0;
  if (!haveContext) {
    return (
      <div className="rounded-lg border border-status-warning/30 bg-status-warning/[0.06] px-3 py-2 text-xs text-status-warning">
        No timeline events or lore context found. The result below was
        generated from the world's tone directive alone — review carefully
        before accepting.
      </div>
    );
  }
  const eventBit =
    result.eventCount > 0
      ? `${result.eventCount} timeline event${result.eventCount === 1 ? "" : "s"}`
      : "no timeline events";
  const ragBit = result.usedRag
    ? `${result.sources.length} retrieved lore source${result.sources.length === 1 ? "" : "s"}`
    : "no lore index built — using legacy world summary";
  return (
    <div className="rounded-lg border border-accent/25 bg-accent/[0.05] px-3 py-2 text-xs text-text-secondary">
      Synthesized from <span className="text-accent">{eventBit}</span> and{" "}
      <span className="text-accent">{ragBit}</span>.
    </div>
  );
}
