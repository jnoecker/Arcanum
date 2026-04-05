import { useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useProjectStore } from "@/stores/projectStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useConfigStore } from "@/stores/configStore";
import { useLoreStore } from "@/stores/loreStore";
import { loadProjectZones, loadProjectConfig } from "@/lib/loader";
import { loadLore } from "@/lib/lorePersistence";
import { useSpriteDefinitionStore } from "@/stores/spriteDefinitionStore";
import { useStoryStore } from "@/stores/storyStore";
import { loadAllStoryIds } from "@/lib/storyPersistence";
import { loadUIState, addRecentProject } from "@/lib/uiPersistence";
import type { Project, ProjectFormat, Tab } from "@/types/project";

interface ProjectValidation {
  valid: boolean;
  format: string;
  errors: string[];
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

  const openDir = useCallback(async (mudDir: string, formatOverride?: ProjectFormat): Promise<OpenProjectResult> => {
    // Validate directory structure (auto-detect format)
    const result = await invoke<ProjectValidation>("validate_project", {
      path: mudDir,
    });

    if (!result.valid) {
      return { success: false, errors: result.errors };
    }

    const format = (formatOverride ?? result.format) as ProjectFormat;

    // Clear previous state
    clearZones();
    clearConfig();
    useLoreStore.getState().clearLore();
    useStoryStore.getState().clearStories();

    // Create project
    const project: Project = {
      version: 1,
      name: mudDir.split(/[\\/]/).pop() ?? "Project",
      mudDir,
      format,
      openZones: [],
    };

    // Load zones
    const zones = await loadProjectZones(project);
    const zoneIds = new Set<string>();
    for (const [zoneId, { filePath, data }] of Object.entries(zones)) {
      loadZone(zoneId, filePath, data);
      zoneIds.add(zoneId);
    }

    // Load config
    const config = await loadProjectConfig(project);
    if (config) {
      setConfig(config);
    }

    // Load lore (creator-only, not deployed)
    loadLore(project)
      .then((lore) => useLoreStore.getState().setLore(lore))
      .catch(() => {});

    // Scan story IDs (lazy -- full stories loaded on selection)
    loadAllStoryIds(project)
      .then(() => {
        // Stories loaded lazily when selected in StoryEditorPanel
      })
      .catch(() => {});

    setProject(project);
    addRecentProject(mudDir, project.name);

    // Load achievement sprite definitions
    useSpriteDefinitionStore.getState().loadDefinitions(project).catch(() => {});


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
