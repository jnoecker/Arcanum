import { useEffect, useState } from "react";
import { useAssetStore } from "@/stores/assetStore";
import { useProjectStore } from "@/stores/projectStore";
import {
  clearIndex,
  getIndexStats,
  rebuildIndex,
  type IndexStats,
} from "@/lib/rag";
import { gatherChunkerInput } from "@/lib/rag/chunkerInput";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { Settings } from "@/types/assets";

function formatRelative(ts: number | null): string {
  if (!ts) return "never";
  const ms = Date.now() - ts;
  if (ms < 0) return "just now";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

export function LoreIndexPanel() {
  const settings = useAssetStore((s) => s.settings);
  const loadSettings = useAssetStore((s) => s.loadSettings);
  const saveSettings = useAssetStore((s) => s.saveSettings);
  const projectDir = useProjectStore((s) => s.project?.mudDir);

  const [stats, setStats] = useState<IndexStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [progressLine, setProgressLine] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [savingKey, setSavingKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (settings) setDraft({ ...settings });
  }, [settings]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatsLoading(true);
      const next = await getIndexStats();
      if (!cancelled) {
        setStats(next);
        setStatsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [projectDir]);

  async function handleRebuild() {
    if (rebuilding) return;
    setError(null);
    setRebuilding(true);
    setProgressLine("Chunking…");
    try {
      const next = await rebuildIndex(gatherChunkerInput(), (stage) => setProgressLine(stage));
      setStats(next);
      setProgressLine("Done");
      setTimeout(() => setProgressLine(""), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProgressLine("");
    } finally {
      setRebuilding(false);
    }
  }

  async function handleClearConfirmed() {
    setConfirmClearOpen(false);
    setError(null);
    try {
      await clearIndex();
      const next = await getIndexStats();
      setStats(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleSaveKey() {
    if (!draft) return;
    setSavingKey(true);
    setError(null);
    try {
      await saveSettings(draft);
      setKeySaved(true);
      setTimeout(() => setKeySaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingKey(false);
    }
  }

  const keyDirty =
    !!settings && !!draft && (draft.voyage_api_key ?? "") !== (settings.voyage_api_key ?? "");

  const byKind = stats?.by_kind ?? {};
  const byKindEntries = Object.entries(byKind).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="flex flex-col gap-8">
      {/* ─── Status ──────────────────────────────────────────── */}
      <section>
        <h3 className="mb-1 font-display text-sm uppercase tracking-widest text-text-primary">
          Status
        </h3>
        <p className="mb-4 text-2xs text-text-muted">
          Embedded chunks power retrieval-augmented lookups across articles, timelines, maps, and
          entity descriptions. Rebuild after major lore edits.
        </p>

        {!projectDir ? (
          <div className="rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-5 py-4 text-xs text-text-muted">
            Open a world project to manage its lore index.
          </div>
        ) : statsLoading ? (
          <div className="text-xs text-text-muted">Loading index status…</div>
        ) : (
          <div className="rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-5 py-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Total chunks" value={stats ? String(stats.total_chunks) : "0"} />
              <Stat
                label="Last embedded"
                value={stats ? formatRelative(stats.last_embedded_at) : "never"}
              />
              <Stat
                label="Model"
                value={stats?.embedding_model || "—"}
                mono
              />
              <Stat
                label="Dim"
                value={stats?.embedding_dim ? String(stats.embedding_dim) : "—"}
                mono
              />
            </div>
            {byKindEntries.length > 0 && (
              <div className="mt-4 border-t border-border-muted pt-3">
                <div className="text-3xs uppercase tracking-wider text-text-muted">By kind</div>
                <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-2xs text-text-secondary">
                  {byKindEntries.map(([kind, count]) => (
                    <li key={kind} className="flex items-center gap-1.5">
                      <span className="font-mono text-accent/80">{count}</span>
                      <span>{kind}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {projectDir && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleRebuild}
              disabled={rebuilding}
              className="action-button action-button-primary action-button-md focus-ring"
            >
              {rebuilding ? "Rebuilding…" : "Rebuild Index"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmClearOpen(true)}
              disabled={rebuilding || !stats || stats.total_chunks === 0}
              className="focus-ring rounded-full border border-status-error/40 px-3 py-1 text-2xs text-status-error transition hover:bg-status-error/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear index
            </button>
            {progressLine && (
              <span className="text-2xs text-text-muted">{progressLine}</span>
            )}
            {error && <span className="text-2xs text-status-error">{error}</span>}
          </div>
        )}
      </section>

      {/* ─── Voyage API key ──────────────────────────────────── */}
      <section className="border-t border-border-default pt-6">
        <h3 className="mb-1 font-display text-sm uppercase tracking-widest text-text-primary">
          Voyage AI API key
        </h3>
        <p className="mb-4 text-2xs text-text-muted">
          Used for embedding text chunks when not routing through the Arcanum Hub. Stored on this
          machine only.
        </p>
        {draft ? (
          <div className="rounded-2xl border border-[var(--chrome-stroke)] bg-[var(--chrome-fill)] px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="voyage-api-key"
                className="font-display text-xs uppercase tracking-wide-ui text-text-primary"
              >
                Voyage
              </label>
              <span
                className={`rounded-full px-2 py-0.5 text-3xs uppercase tracking-ui ${
                  draft.voyage_api_key
                    ? "bg-status-success/15 text-status-success"
                    : "bg-[var(--chrome-highlight)] text-text-muted"
                }`}
              >
                {draft.voyage_api_key ? "set" : "empty"}
              </span>
            </div>
            <input
              id="voyage-api-key"
              type="password"
              value={draft.voyage_api_key ?? ""}
              onChange={(e) => setDraft({ ...draft, voyage_api_key: e.target.value })}
              placeholder="Enter your Voyage AI API key"
              className="mt-2 w-full rounded border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-border-active"
            />
            <p className="mt-2 text-3xs text-text-muted/60">
              Get your key at <code className="font-mono text-accent/70">dash.voyageai.com</code>
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveKey}
                disabled={!keyDirty || savingKey}
                className="action-button action-button-primary action-button-sm focus-ring"
              >
                {savingKey ? "Saving…" : "Save"}
              </button>
              {keySaved && <span className="text-2xs text-status-success">Saved</span>}
              {keyDirty && !savingKey && (
                <span className="text-2xs text-accent">modified</span>
              )}
            </div>
          </div>
        ) : (
          <div className="text-xs text-text-muted">Loading…</div>
        )}
      </section>

      {confirmClearOpen && (
        <ConfirmDialog
          title="Clear lore index?"
          message="This removes every embedded chunk for this project. You will need to rebuild before retrieval works again."
          confirmLabel="Clear index"
          cancelLabel="Cancel"
          destructive
          onConfirm={handleClearConfirmed}
          onCancel={() => setConfirmClearOpen(false)}
        />
      )}
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-3xs uppercase tracking-wider text-text-muted">{label}</div>
      <div
        className={`mt-1 text-base text-text-primary ${
          mono ? "font-mono text-sm" : "font-display"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
