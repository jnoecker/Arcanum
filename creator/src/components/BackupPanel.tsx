import { useCallback, useEffect, useMemo, useState } from "react";
import { save as saveDialog, open as openDialog } from "@tauri-apps/plugin-dialog";
import { useProjectStore } from "@/stores/projectStore";
import { useAssetStore } from "@/stores/assetStore";
import { useToastStore } from "@/stores/toastStore";
import {
  ActionButton,
  CheckboxInput,
  FieldRow,
  NumberInput,
  Section,
  Spinner,
  TextInput,
} from "@/components/ui/FormWidgets";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  createSnapshot,
  deleteSnapshot,
  exportBackup,
  formatBytes,
  formatSnapshotTimestamp,
  listSnapshots,
  pruneSnapshots,
  restoreSnapshot,
  type SnapshotInfo,
} from "@/lib/backup";
import type { ProjectSettings } from "@/types/assets";

const KIND_LABEL: Record<string, string> = {
  auto: "Auto",
  manual: "Manual",
  "pre-restore": "Pre-restore",
};

function KindBadge({ kind }: { kind: string }) {
  const label = KIND_LABEL[kind] ?? kind;
  const tone =
    kind === "manual"
      ? "border-accent/50 bg-accent/12 text-accent"
      : kind === "pre-restore"
        ? "border-status-warn/40 bg-status-warn/10 text-status-warn"
        : "border-border-muted bg-[var(--chrome-fill-soft)] text-text-secondary";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-display text-2xs uppercase tracking-wide-ui ${tone}`}
    >
      {label}
    </span>
  );
}

export function BackupPanel() {
  const project = useProjectStore((s) => s.project);
  const projectSettings = useAssetStore((s) => s.projectSettings);
  const saveProjectSettings = useAssetStore((s) => s.saveProjectSettings);
  const showToast = useToastStore((s) => s.show);

  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [manualLabel, setManualLabel] = useState("");
  const [manualIncludeAssets, setManualIncludeAssets] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<SnapshotInfo | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SnapshotInfo | null>(null);

  const projectDir = project?.mudDir ?? null;

  const refresh = useCallback(async () => {
    if (!projectDir) return;
    setLoading(true);
    try {
      const list = await listSnapshots(projectDir);
      setSnapshots(list);
    } catch (err) {
      console.error("listSnapshots failed:", err);
    } finally {
      setLoading(false);
    }
  }, [projectDir]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const totalSize = useMemo(
    () => snapshots.reduce((sum, s) => sum + s.size_bytes, 0),
    [snapshots],
  );

  async function updateSettings(patch: Partial<ProjectSettings>) {
    if (!projectDir || !projectSettings) return;
    await saveProjectSettings(projectDir, { ...projectSettings, ...patch });
  }

  async function handleCreateSnapshot() {
    if (!projectDir) return;
    setBusy("snapshot");
    try {
      const info = await createSnapshot(
        projectDir,
        "manual",
        manualLabel.trim() || null,
        manualIncludeAssets,
      );
      showToast({
        variant: "astral",
        kicker: "Snapshot",
        message: `Captured ${info.name} (${formatBytes(info.size_bytes)})`,
      });
      setManualLabel("");
      await refresh();
    } catch (err) {
      console.error("createSnapshot failed:", err);
      showToast({
        variant: "ember",
        kicker: "Snapshot failed",
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleRunPrune() {
    if (!projectDir || !projectSettings) return;
    setBusy("prune");
    try {
      const removed = await pruneSnapshots(
        projectDir,
        Math.max(1, projectSettings.snapshot_keep_count || 10),
      );
      showToast({
        variant: "astral",
        kicker: "Pruned",
        message: removed > 0 ? `Removed ${removed} old auto snapshot${removed === 1 ? "" : "s"}` : "Nothing to prune",
      });
      await refresh();
    } catch (err) {
      showToast({
        variant: "ember",
        kicker: "Prune failed",
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleRestore(info: SnapshotInfo) {
    if (!projectDir) return;
    setPendingRestore(null);
    setBusy(`restore:${info.path}`);
    try {
      const count = await restoreSnapshot(projectDir, info.path);
      showToast({
        variant: "ember",
        kicker: "Restored",
        message: `Extracted ${count} file${count === 1 ? "" : "s"}. A safety snapshot was created first. Reload the project to see changes.`,
      });
      await refresh();
    } catch (err) {
      showToast({
        variant: "ember",
        kicker: "Restore failed",
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(info: SnapshotInfo) {
    if (!projectDir) return;
    setPendingDelete(null);
    setBusy(`delete:${info.path}`);
    try {
      await deleteSnapshot(projectDir, info.path);
      await refresh();
    } catch (err) {
      showToast({
        variant: "ember",
        kicker: "Delete failed",
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleExportBackup(includeAssets: boolean) {
    if (!projectDir || !project) return;
    const stamp = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[-:T]/g, "")
      .replace(/^(\d{8})(\d{6})$/, "$1-$2");
    const defaultName = `${project.name || "arcanum"}-backup-${stamp}.zip`;
    const target = await saveDialog({
      title: "Export backup archive",
      defaultPath: defaultName,
      filters: [{ name: "Zip archive", extensions: ["zip"] }],
    });
    if (!target) return;
    setBusy("export");
    try {
      const size = await exportBackup(projectDir, target as string, includeAssets);
      showToast({
        variant: "astral",
        kicker: "Backup saved",
        message: `${formatBytes(size)} written to ${target}`,
      });
    } catch (err) {
      showToast({
        variant: "ember",
        kicker: "Export failed",
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleImportBackup() {
    const zip = await openDialog({
      title: "Choose backup archive",
      multiple: false,
      filters: [{ name: "Zip archive", extensions: ["zip"] }],
    });
    if (!zip || Array.isArray(zip)) return;
    const target = await openDialog({
      title: "Choose empty destination folder",
      directory: true,
      multiple: false,
    });
    if (!target || Array.isArray(target)) return;
    setBusy("import");
    try {
      const { importBackup } = await import("@/lib/backup");
      const count = await importBackup(zip as string, target as string);
      showToast({
        variant: "astral",
        kicker: "Backup imported",
        message: `Extracted ${count} file${count === 1 ? "" : "s"} to ${target}. Open the folder as a new project to continue.`,
      });
    } catch (err) {
      showToast({
        variant: "ember",
        kicker: "Import failed",
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(null);
    }
  }

  if (!project) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-sm text-text-muted">
        Open a project to manage backups.
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 overflow-y-auto px-6 py-6">
        <div>
          <h2 className="font-display text-xl uppercase tracking-wide-ui text-aurum">Backups & Snapshots</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Automatic safety net beyond git. Periodic autosave keeps unsaved edits from evaporating; snapshots zip your world so you can roll back a bad refactor or export a full archive.
          </p>
        </div>

        {/* ── Automatic section ───────────────────────────────────── */}
        <Section title="Automatic" description="Background timers that run while this project is open.">
          <FieldRow label="Autosave" hint={`Saves every dirty zone, config, and lore on an interval. Equivalent to pressing Ctrl+S. Requires: ${projectSettings?.autosave_enabled ? "on" : "off"}.`}>
            <div className="flex items-center gap-4">
              <CheckboxInput
                checked={projectSettings?.autosave_enabled ?? false}
                onCommit={(v) => void updateSettings({ autosave_enabled: v })}
                label="Enabled"
              />
              <label className="flex items-center gap-2 text-xs text-text-muted">
                Interval
                <div className="w-20">
                  <NumberInput
                    dense
                    min={1}
                    max={120}
                    value={projectSettings?.autosave_interval_minutes ?? 5}
                    onCommit={(v) => void updateSettings({ autosave_interval_minutes: Math.max(1, Math.min(120, v ?? 5)) })}
                  />
                </div>
                min
              </label>
            </div>
          </FieldRow>

          <FieldRow label="Snapshots" hint="Periodic zip of the whole project. Old auto snapshots are pruned automatically.">
            <div className="flex flex-wrap items-center gap-4">
              <CheckboxInput
                checked={projectSettings?.snapshot_enabled ?? false}
                onCommit={(v) => void updateSettings({ snapshot_enabled: v })}
                label="Enabled"
              />
              <label className="flex items-center gap-2 text-xs text-text-muted">
                Every
                <div className="w-20">
                  <NumberInput
                    dense
                    min={5}
                    max={1440}
                    value={projectSettings?.snapshot_interval_minutes ?? 60}
                    onCommit={(v) => void updateSettings({ snapshot_interval_minutes: Math.max(5, Math.min(1440, v ?? 60)) })}
                  />
                </div>
                min
              </label>
              <label className="flex items-center gap-2 text-xs text-text-muted">
                Keep last
                <div className="w-16">
                  <NumberInput
                    dense
                    min={1}
                    max={100}
                    value={projectSettings?.snapshot_keep_count ?? 10}
                    onCommit={(v) => void updateSettings({ snapshot_keep_count: Math.max(1, Math.min(100, v ?? 10)) })}
                  />
                </div>
              </label>
              <CheckboxInput
                checked={projectSettings?.snapshot_include_assets ?? false}
                onCommit={(v) => void updateSettings({ snapshot_include_assets: v })}
                label="Include images (larger)"
              />
            </div>
          </FieldRow>
        </Section>

        {/* ── Snapshots list ──────────────────────────────────────── */}
        <Section
          title={`Snapshots (${snapshots.length})`}
          description={snapshots.length > 0 ? `Total ${formatBytes(totalSize)} on disk.` : "No snapshots yet."}
          actions={
            <div className="flex items-center gap-1.5">
              <ActionButton size="sm" variant="ghost" onClick={() => void refresh()} disabled={loading}>
                Refresh
              </ActionButton>
              <ActionButton size="sm" variant="ghost" onClick={() => void handleRunPrune()} disabled={busy === "prune"}>
                {busy === "prune" ? <Spinner /> : "Prune now"}
              </ActionButton>
            </div>
          }
        >
          <div className="mb-3 flex flex-wrap items-end gap-3 rounded-lg border border-border-muted bg-[var(--chrome-fill-soft)] p-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="font-display text-2xs uppercase tracking-wide-ui text-text-muted">Manual snapshot</span>
              <TextInput
                dense
                value={manualLabel}
                onCommit={setManualLabel}
                placeholder="Optional label (e.g. before_tuning_pass)"
              />
            </div>
            <CheckboxInput
              checked={manualIncludeAssets}
              onCommit={setManualIncludeAssets}
              label="Include images"
            />
            <ActionButton
              size="sm"
              variant="primary"
              onClick={() => void handleCreateSnapshot()}
              disabled={busy === "snapshot"}
            >
              {busy === "snapshot" ? <Spinner /> : "Create snapshot"}
            </ActionButton>
          </div>

          {snapshots.length === 0 ? (
            <p className="text-xs text-text-muted">No snapshots yet. Create one now, or enable automatic snapshots above.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {snapshots.map((s) => (
                <li
                  key={s.path}
                  className="flex flex-wrap items-center gap-3 rounded-md border border-border-muted bg-bg-primary/40 px-3 py-2"
                >
                  <KindBadge kind={s.kind} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-mono text-xs text-text-primary">
                      {formatSnapshotTimestamp(s.created_at) || s.name}
                    </span>
                    <span className="truncate text-2xs text-text-muted">
                      {s.label ? `${s.label} · ` : ""}
                      {formatBytes(s.size_bytes)}
                    </span>
                  </div>
                  <ActionButton
                    size="sm"
                    variant="ghost"
                    onClick={() => setPendingRestore(s)}
                    disabled={busy !== null}
                    title="Replace current project files with this snapshot (a safety snapshot is created first)"
                  >
                    {busy === `restore:${s.path}` ? <Spinner /> : "Restore"}
                  </ActionButton>
                  <ActionButton
                    size="sm"
                    variant="danger"
                    onClick={() => setPendingDelete(s)}
                    disabled={busy !== null}
                  >
                    {busy === `delete:${s.path}` ? <Spinner /> : "Delete"}
                  </ActionButton>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* ── Archive section ─────────────────────────────────────── */}
        <Section
          title="Archive"
          description="Portable zip archives for moving a world between machines, handing it off, or cold storage."
        >
          <div className="flex flex-wrap gap-2">
            <ActionButton
              variant="secondary"
              size="sm"
              onClick={() => void handleExportBackup(false)}
              disabled={busy === "export"}
              title="Export YAML + config + lore. Excludes generated images."
            >
              Export backup (YAML only)
            </ActionButton>
            <ActionButton
              variant="secondary"
              size="sm"
              onClick={() => void handleExportBackup(true)}
              disabled={busy === "export"}
              title="Export everything including generated images. Can be very large."
            >
              Export full backup (with images)
            </ActionButton>
            <ActionButton
              variant="ghost"
              size="sm"
              onClick={() => void handleImportBackup()}
              disabled={busy === "import"}
              title="Extract a backup archive into an empty folder, then open it as a new project."
            >
              Import backup archive…
            </ActionButton>
          </div>
        </Section>
      </div>

      {pendingRestore && (
        <ConfirmDialog
          title="Restore snapshot?"
          message={`This will extract ${pendingRestore.name} over the current project files. A safety snapshot of the current state will be created first, so you can walk back. Close and reopen the project after restore completes.`}
          confirmLabel="Restore"
          destructive
          onConfirm={() => void handleRestore(pendingRestore)}
          onCancel={() => setPendingRestore(null)}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete snapshot?"
          message={`Permanently delete ${pendingDelete.name}? This cannot be undone.`}
          confirmLabel="Delete"
          destructive
          onConfirm={() => void handleDelete(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  );
}
