import { useEffect, useState, useCallback } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useAssetStore } from "@/stores/assetStore";
import { useGitStore } from "@/stores/gitStore";
import { Spinner } from "@/components/ui/FormWidgets";

// ─── Version Control Panel ─────────────────────────────────────────

export function VersionControlPanel() {
  const project = useProjectStore((s) => s.project);
  const settings = useAssetStore((s) => s.settings);
  const {
    status,
    log,
    loading,
    committing,
    pushing,
    pulling,
    initializing,
    lastError,
    lastSuccess,
    pullResult,
    prResult,
    refreshStatus,
    refreshLog,
    initRepo,
    setRemote,
    commit,
    push,
    pull,
    createPr,
    clearMessages,
  } = useGitStore();

  const [commitMsg, setCommitMsg] = useState("");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [prBranch, setPrBranch] = useState("");
  const [prTitle, setPrTitle] = useState("");
  const [prBody, setPrBody] = useState("");
  const [creatingPr, setCreatingPr] = useState(false);

  const mudDir = project?.mudDir;
  const hasPat = !!settings?.github_pat;

  const refresh = useCallback(() => {
    if (!mudDir) return;
    refreshStatus(mudDir);
    refreshLog(mudDir);
  }, [mudDir, refreshStatus, refreshLog]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Format guard
  if (!project || project.format !== "standalone") {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/10 px-6 py-8 text-center text-sm text-text-muted">
        Version control is available for standalone projects only.
      </div>
    );
  }

  if (!mudDir) return null;

  const isRepo = status?.is_repo ?? false;
  const hasRemote = status?.has_remote ?? false;

  // ─── Not a repo ────────────────────────────────────────────────
  if (!isRepo && !loading) {
    return (
      <div className="flex flex-col gap-4">
        <Card>
          <h3 className="font-display text-sm text-text-primary">Initialize Repository</h3>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">
            This project directory is not a git repository. Initialize one to start tracking changes.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <label className="text-2xs uppercase tracking-wider text-text-muted">
              Remote URL (optional)
            </label>
            <input
              type="text"
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
              placeholder="https://github.com/you/your-world.git"
              className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50"
            />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={async () => {
                await initRepo(mudDir);
                if (remoteUrl.trim()) {
                  await setRemote(mudDir, remoteUrl.trim());
                }
              }}
              disabled={initializing}
              className="rounded bg-gradient-to-r from-accent-muted to-accent px-4 py-1.5 text-xs font-medium text-accent-emphasis transition hover:brightness-110 disabled:opacity-50"
            >
              {initializing ? <><Spinner className="mr-1.5" /> Initializing...</> : "Initialize"}
            </button>
          </div>
          <MessageBanner error={lastError} success={lastSuccess} onDismiss={clearMessages} />
        </Card>
      </div>
    );
  }

  // ─── Main repo view ────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* Status header */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-2xs uppercase tracking-wider text-text-muted">Branch</span>
              <span className="rounded bg-white/8 px-2 py-0.5 font-mono text-xs text-text-primary">
                {status?.branch || "—"}
              </span>
            </div>
            {status && status.changed_files > 0 && (
              <span className="rounded bg-accent/15 px-2 py-0.5 text-2xs font-medium text-accent">
                {status.changed_files} changed
              </span>
            )}
            {status && status.ahead > 0 && (
              <span className="rounded bg-status-success/15 px-2 py-0.5 text-2xs text-status-success">
                {status.ahead} ahead
              </span>
            )}
            {status && status.behind > 0 && (
              <span className="rounded bg-status-warning/15 px-2 py-0.5 text-2xs text-status-warning">
                {status.behind} behind
              </span>
            )}
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="rounded px-2 py-1 text-2xs text-text-muted transition hover:bg-white/5 hover:text-text-primary disabled:opacity-50"
          >
            {loading ? <Spinner /> : "Refresh"}
          </button>
        </div>
      </Card>

      {/* Remote config */}
      {!hasRemote && (
        <Card>
          <h3 className="text-xs font-medium text-text-primary">Set Remote</h3>
          <p className="mt-0.5 text-2xs text-text-muted">
            Configure a GitHub remote to enable push and pull.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
              placeholder="https://github.com/you/your-world.git"
              className="min-w-0 flex-1 rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50"
            />
            <button
              onClick={() => {
                if (remoteUrl.trim()) setRemote(mudDir, remoteUrl.trim());
              }}
              disabled={!remoteUrl.trim()}
              className="shrink-0 rounded bg-white/8 px-3 py-1.5 text-xs text-text-primary transition hover:bg-white/12 disabled:opacity-50"
            >
              Set Remote
            </button>
          </div>
        </Card>
      )}

      {/* Commit section */}
      <Card>
        <h3 className="text-xs font-medium text-text-primary">Commit Changes</h3>
        {status && status.changed_files === 0 ? (
          <p className="mt-1 text-2xs text-text-muted">Working tree is clean — nothing to commit.</p>
        ) : (
          <>
            <p className="mt-0.5 text-2xs text-text-muted">
              {status?.changed_files ?? 0} file{(status?.changed_files ?? 0) !== 1 ? "s" : ""} changed
            </p>
            <textarea
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              placeholder="Describe your changes..."
              rows={2}
              className="mt-2 w-full resize-y rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs leading-relaxed text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={async () => {
                  await commit(mudDir, commitMsg);
                  setCommitMsg("");
                }}
                disabled={committing || !commitMsg.trim()}
                className="rounded bg-gradient-to-r from-accent-muted to-accent px-4 py-1.5 text-xs font-medium text-accent-emphasis transition hover:brightness-110 disabled:opacity-50"
              >
                {committing ? <><Spinner className="mr-1.5" /> Committing...</> : "Commit"}
              </button>
            </div>
          </>
        )}
      </Card>

      {/* Push / Pull */}
      {hasRemote && (
        <Card>
          <div className="flex items-center gap-2">
            <button
              onClick={() => push(mudDir)}
              disabled={pushing || !hasPat}
              className="rounded bg-white/8 px-4 py-1.5 text-xs text-text-primary transition hover:bg-white/12 disabled:opacity-50"
            >
              {pushing ? <><Spinner className="mr-1.5" /> Pushing...</> : "Push"}
              {(status?.ahead ?? 0) > 0 && (
                <span className="ml-1.5 rounded-full bg-status-success/20 px-1.5 text-2xs text-status-success">
                  {status!.ahead}
                </span>
              )}
            </button>
            <button
              onClick={() => pull(mudDir)}
              disabled={pulling || !hasPat}
              className="rounded bg-white/8 px-4 py-1.5 text-xs text-text-primary transition hover:bg-white/12 disabled:opacity-50"
            >
              {pulling ? <><Spinner className="mr-1.5" /> Pulling...</> : "Pull"}
              {(status?.behind ?? 0) > 0 && (
                <span className="ml-1.5 rounded-full bg-status-warning/20 px-1.5 text-2xs text-status-warning">
                  {status!.behind}
                </span>
              )}
            </button>
            {!hasPat && (
              <span className="text-2xs text-text-muted">
                Set a GitHub PAT in Services to enable sync.
              </span>
            )}
          </div>
        </Card>
      )}

      {/* Conflict resolution */}
      {pullResult?.had_conflicts && (
        <Card className="border-status-warning/30">
          <h3 className="text-xs font-medium text-status-warning">Merge Conflicts</h3>
          <p className="mt-1 text-2xs leading-relaxed text-text-secondary">
            The remote has changes that conflict with yours. You can create a pull request
            on GitHub to resolve them using the web editor.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <input
              type="text"
              value={prBranch}
              onChange={(e) => setPrBranch(e.target.value)}
              placeholder={`conflict-resolution-${Date.now().toString(36)}`}
              className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50"
            />
            <input
              type="text"
              value={prTitle}
              onChange={(e) => setPrTitle(e.target.value)}
              placeholder="Resolve merge conflicts"
              className="w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50"
            />
            <textarea
              value={prBody}
              onChange={(e) => setPrBody(e.target.value)}
              placeholder="Description of your changes..."
              rows={2}
              className="w-full resize-y rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs leading-relaxed text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50"
            />
            <button
              onClick={async () => {
                setCreatingPr(true);
                const branch = prBranch.trim() || `conflict-resolution-${Date.now().toString(36)}`;
                const title = prTitle.trim() || "Resolve merge conflicts";
                await createPr(mudDir, branch, title, prBody);
                setCreatingPr(false);
                setPrBranch("");
                setPrTitle("");
                setPrBody("");
              }}
              disabled={creatingPr}
              className="self-start rounded bg-gradient-to-r from-accent-muted to-accent px-4 py-1.5 text-xs font-medium text-accent-emphasis transition hover:brightness-110 disabled:opacity-50"
            >
              {creatingPr ? <><Spinner className="mr-1.5" /> Creating PR...</> : "Create PR on GitHub"}
            </button>
          </div>
        </Card>
      )}

      {/* PR result */}
      {prResult && (
        <Card className="border-status-success/30">
          <h3 className="text-xs font-medium text-status-success">Pull Request Created</h3>
          <p className="mt-1 text-2xs text-text-secondary">
            Branch <code className="font-mono text-accent/70">{prResult.branch_name}</code> pushed.
            Resolve conflicts and merge on GitHub, then pull again.
          </p>
          <a
            href={prResult.pr_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block rounded bg-white/8 px-3 py-1.5 text-xs text-accent transition hover:bg-white/12"
          >
            Open PR on GitHub &rarr;
          </a>
        </Card>
      )}

      {/* Messages */}
      <MessageBanner error={lastError} success={lastSuccess} onDismiss={clearMessages} />

      {/* Commit history */}
      {log.length > 0 && (
        <Card>
          <h3 className="mb-2 text-xs font-medium text-text-primary">Recent Commits</h3>
          <div className="flex flex-col divide-y divide-white/6">
            {log.map((c) => (
              <div key={c.hash} className="flex items-baseline gap-2 py-1.5">
                <code className="shrink-0 font-mono text-2xs text-accent/70">{c.short_hash}</code>
                <span className="min-w-0 flex-1 truncate text-xs text-text-secondary">{c.message}</span>
                <span className="shrink-0 text-2xs text-text-muted">{c.author}</span>
                <span className="shrink-0 text-2xs text-text-muted">{formatDate(c.date)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Shared pieces ─────────────────────────────────────────────────

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-black/10 px-5 py-4 ${className ?? ""}`}>
      {children}
    </div>
  );
}

function MessageBanner({
  error,
  success,
  onDismiss,
}: {
  error: string | null;
  success: string | null;
  onDismiss: () => void;
}) {
  if (!error && !success) return null;
  return (
    <div
      className={`flex items-center justify-between rounded-xl px-4 py-2 text-xs ${
        error
          ? "border border-status-error/30 bg-status-error/10 text-status-error"
          : "border border-status-success/30 bg-status-success/10 text-status-success"
      }`}
    >
      <span>{error || success}</span>
      <button onClick={onDismiss} className="ml-2 opacity-60 hover:opacity-100">&times;</button>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}
