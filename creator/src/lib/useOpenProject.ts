import { useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useProjectStore } from "@/stores/projectStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useConfigStore } from "@/stores/configStore";
import { loadAllZones, loadAppConfig } from "@/lib/loader";
import { loadUIState } from "@/lib/uiPersistence";
import type { Project, Tab } from "@/types/project";

interface ValidationResult {
  valid: boolean;
  errors: string[];
  gradle_wrapper: string;
}

export interface OpenProjectResult {
  success: boolean;
  errors?: string[];
}

export function useOpenProject() {
  const setProject = useProjectStore((s) => s.setProject);
  const restoreTabs = useProjectStore((s) => s.restoreTabs);
  const loadZone = useZoneStore((s) => s.loadZone);
  const clearZones = useZoneStore((s) => s.clearZones);
  const setConfig = useConfigStore((s) => s.setConfig);
  const clearConfig = useConfigStore((s) => s.clearConfig);

  const openDir = useCallback(async (mudDir: string): Promise<OpenProjectResult> => {
    // Validate directory structure
    const result = await invoke<ValidationResult>("validate_mud_dir", {
      path: mudDir,
    });

    if (!result.valid) {
      return { success: false, errors: result.errors };
    }

    // Clear previous state
    clearZones();
    clearConfig();

    // Load zones
    const zones = await loadAllZones(mudDir);
    const zoneIds = new Set<string>();
    for (const [zoneId, { filePath, data }] of Object.entries(zones)) {
      loadZone(zoneId, filePath, data);
      zoneIds.add(zoneId);
    }

    // Load config
    const config = await loadAppConfig(mudDir);
    if (config) {
      setConfig(config);
    }

    // Create project
    const project: Project = {
      version: 1,
      name: mudDir.split(/[\\/]/).pop() ?? "AmbonMUD",
      mudDir,
      openZones: [],
    };

    setProject(project);

    // Restore previously saved tabs (filter out stale zone refs)
    const saved = loadUIState();
    if (saved && saved.lastProjectPath === mudDir && saved.tabs.length > 0) {
      const validTabs = saved.tabs.filter((tab: Tab) => {
        if (tab.kind === "zone") {
          const zoneId = tab.id.replace(/^zone:/, "");
          return zoneIds.has(zoneId);
        }
        return true; // config, console tabs always valid
      });
      if (validTabs.length > 0) {
        const activeStillExists = validTabs.some(
          (t: Tab) => t.id === saved.activeTabId,
        );
        restoreTabs(
          validTabs,
          activeStillExists
            ? saved.activeTabId
            : validTabs[validTabs.length - 1]!.id,
        );
      }
    }

    return { success: true };
  }, [setProject, restoreTabs, loadZone, clearZones, setConfig, clearConfig]);

  const openWithPicker = useCallback(async (): Promise<OpenProjectResult | null> => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected) return null; // User cancelled
    return openDir(selected as string);
  }, [openDir]);

  return { openWithPicker, openDir };
}
