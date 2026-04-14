import { useEffect, useRef } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useAssetStore } from "@/stores/assetStore";
import { useZoneStore, selectDirtyCount } from "@/stores/zoneStore";
import { useConfigStore } from "@/stores/configStore";
import { useLoreStore } from "@/stores/loreStore";
import { saveEverything } from "@/lib/saveAll";
import { saveLore } from "@/lib/lorePersistence";
import { createSnapshot, pruneSnapshots } from "@/lib/backup";

const MS_PER_MINUTE = 60_000;

function anyDirty(): boolean {
  const zones = selectDirtyCount(useZoneStore.getState());
  const config = useConfigStore.getState().dirty;
  const lore = useLoreStore.getState().dirty;
  return zones > 0 || config || lore;
}

/**
 * Background autosave + periodic snapshot manager. Reads cadence from
 * project settings. Reacts to toggles and interval changes without
 * requiring an app restart.
 */
export function useAutoBackup() {
  const project = useProjectStore((s) => s.project);
  const projectSettings = useAssetStore((s) => s.projectSettings);
  const autosaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const snapshotTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const autosaveInFlight = useRef(false);
  const snapshotInFlight = useRef(false);

  useEffect(() => {
    if (autosaveTimer.current) {
      clearInterval(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    if (!project || !projectSettings?.autosave_enabled) return;

    const minutes = Math.max(1, projectSettings.autosave_interval_minutes || 5);
    const intervalMs = minutes * MS_PER_MINUTE;

    autosaveTimer.current = setInterval(() => {
      if (autosaveInFlight.current) return;
      if (!anyDirty()) return;
      autosaveInFlight.current = true;
      (async () => {
        try {
          await saveEverything();
          // Lore has its own debounced save but in case it has a pending
          // buffer we force a flush so the autosave interval reflects
          // the full project state.
          if (useLoreStore.getState().dirty && project) {
            await saveLore(project);
          }
        } catch (err) {
          console.error("[autosave] failed:", err);
        } finally {
          autosaveInFlight.current = false;
        }
      })();
    }, intervalMs);

    return () => {
      if (autosaveTimer.current) {
        clearInterval(autosaveTimer.current);
        autosaveTimer.current = null;
      }
    };
  }, [project, projectSettings?.autosave_enabled, projectSettings?.autosave_interval_minutes]);

  useEffect(() => {
    if (snapshotTimer.current) {
      clearInterval(snapshotTimer.current);
      snapshotTimer.current = null;
    }
    if (!project || !projectSettings?.snapshot_enabled) return;

    const minutes = Math.max(5, projectSettings.snapshot_interval_minutes || 60);
    const keep = Math.max(1, projectSettings.snapshot_keep_count || 10);
    const includeAssets = projectSettings.snapshot_include_assets ?? false;
    const intervalMs = minutes * MS_PER_MINUTE;

    snapshotTimer.current = setInterval(() => {
      if (snapshotInFlight.current) return;
      // Only snapshot if something has changed since the last save.
      // We snapshot the *saved* state, so we check whether any work has
      // been persisted recently by looking at whether anything is dirty
      // OR whether the project mtime has changed. Simpler: just run on
      // interval when the project is active and let the zip diff be a
      // no-op for users who walked away.
      snapshotInFlight.current = true;
      (async () => {
        try {
          await createSnapshot(project.mudDir, "auto", null, includeAssets);
          await pruneSnapshots(project.mudDir, keep);
        } catch (err) {
          console.error("[snapshot] failed:", err);
        } finally {
          snapshotInFlight.current = false;
        }
      })();
    }, intervalMs);

    return () => {
      if (snapshotTimer.current) {
        clearInterval(snapshotTimer.current);
        snapshotTimer.current = null;
      }
    };
  }, [
    project,
    projectSettings?.snapshot_enabled,
    projectSettings?.snapshot_interval_minutes,
    projectSettings?.snapshot_keep_count,
    projectSettings?.snapshot_include_assets,
  ]);
}
