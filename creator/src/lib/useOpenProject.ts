import { useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useProjectStore } from "@/stores/projectStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useConfigStore } from "@/stores/configStore";
import { loadAllZones, loadAppConfig } from "@/lib/loader";
import type { Project } from "@/types/project";

interface ValidationResult {
  valid: boolean;
  errors: string[];
  gradle_wrapper: string;
}

export function useOpenProject() {
  const setProject = useProjectStore((s) => s.setProject);
  const loadZone = useZoneStore((s) => s.loadZone);
  const clearZones = useZoneStore((s) => s.clearZones);
  const setConfig = useConfigStore((s) => s.setConfig);
  const clearConfig = useConfigStore((s) => s.clearConfig);

  return useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected) return;

    const mudDir = selected as string;

    // Validate directory structure
    const result = await invoke<ValidationResult>("validate_mud_dir", {
      path: mudDir,
    });

    if (!result.valid) {
      // TODO: replace with proper error dialog
      console.error("Invalid AmbonMUD directory:", result.errors);
      return;
    }

    // Clear previous state
    clearZones();
    clearConfig();

    // Load zones
    const zones = await loadAllZones(mudDir);
    for (const [zoneId, { filePath, data }] of Object.entries(zones)) {
      loadZone(zoneId, filePath, data);
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
  }, [setProject, loadZone, clearZones, setConfig, clearConfig]);
}
