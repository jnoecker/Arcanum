import { invoke } from "@tauri-apps/api/core";

export interface SnapshotInfo {
  path: string;
  name: string;
  kind: string;
  label: string | null;
  created_at: string;
  size_bytes: number;
  include_assets: boolean;
}

export type SnapshotKind = "auto" | "manual" | "pre-restore";

export async function createSnapshot(
  projectDir: string,
  kind: SnapshotKind,
  label: string | null,
  includeAssets: boolean,
): Promise<SnapshotInfo> {
  return await invoke<SnapshotInfo>("snapshot_create", {
    projectDir,
    kind,
    label,
    includeAssets,
  });
}

export async function listSnapshots(projectDir: string): Promise<SnapshotInfo[]> {
  return await invoke<SnapshotInfo[]>("snapshot_list", { projectDir });
}

export async function deleteSnapshot(
  projectDir: string,
  snapshotPath: string,
): Promise<void> {
  await invoke("snapshot_delete", { projectDir, snapshotPath });
}

export async function restoreSnapshot(
  projectDir: string,
  snapshotPath: string,
): Promise<number> {
  return await invoke<number>("snapshot_restore", { projectDir, snapshotPath });
}

export async function pruneSnapshots(
  projectDir: string,
  keepCount: number,
): Promise<number> {
  return await invoke<number>("snapshot_prune", { projectDir, keepCount });
}

export async function exportBackup(
  projectDir: string,
  targetPath: string,
  includeAssets: boolean,
): Promise<number> {
  return await invoke<number>("backup_export", {
    projectDir,
    targetPath,
    includeAssets,
  });
}

export async function importBackup(
  zipPath: string,
  targetDir: string,
): Promise<number> {
  return await invoke<number>("backup_import", { zipPath, targetDir });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export function formatSnapshotTimestamp(ts: string): string {
  // ts format: YYYY-MM-DD_HHMMSS
  const match = ts.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})(\d{2})$/);
  if (!match) return ts;
  const [, y, mo, d, h, mi, s] = match;
  const date = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s),
  );
  return date.toLocaleString();
}
