import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { stringify } from "yaml";
import { useOpenProject } from "@/lib/useOpenProject";
import { useProjectStore } from "@/stores/projectStore";
import { useConfigStore } from "@/stores/configStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useVibeStore } from "@/stores/vibeStore";
import { saveProjectConfig } from "@/lib/saveConfig";
import { addRecentProject } from "@/lib/uiPersistence";
import { applyTemplate, TEMPLATES } from "@/lib/templates";
import { zoneFilePath } from "@/lib/projectPaths";

export type WizardStage =
  | "idle"
  | "creating"
  | "done"
  | "error";

export interface WizardData {
  projectName: string;
  parentDir: string;
  templateId: string;
  worldTheme: string;
  zoneTheme: string;
  telnetPort: number;
  webPort: number;
}

const DEFAULT_DATA: WizardData = {
  projectName: "",
  parentDir: "",
  templateId: "classic_fantasy",
  worldTheme: "",
  zoneTheme: "",
  telnetPort: 4000,
  webPort: 8080,
};

export function useProjectWizard() {
  const [data, setData] = useState<WizardData>(() => {
    const template = TEMPLATES.find((t) => t.id === "classic_fantasy");
    return {
      ...DEFAULT_DATA,
      worldTheme: template?.defaultWorldTheme ?? "",
      zoneTheme: template?.defaultZoneTheme ?? "",
    };
  });

  const [stage, setStage] = useState<WizardStage>("idle");
  const [error, setError] = useState<string | null>(null);

  const { openDir } = useOpenProject();
  const updateConfig = useConfigStore((s) => s.updateConfig);
  const loadZone = useZoneStore((s) => s.loadZone);

  const update = useCallback((partial: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  }, []);

  const selectTemplate = useCallback((templateId: string) => {
    const template = TEMPLATES.find((t) => t.id === templateId);
    setData((prev) => ({
      ...prev,
      templateId,
      worldTheme: template?.defaultWorldTheme ?? "",
      zoneTheme: template?.defaultZoneTheme ?? "",
    }));
  }, []);

  const create = useCallback(async () => {
    setStage("creating");
    setError(null);

    try {
      const template = TEMPLATES.find((t) => t.id === data.templateId);

      // Create standalone project directory
      const mudDir = await invoke<string>("create_standalone_project", {
        targetDir: data.parentDir,
        projectName: data.projectName,
      });

      // Open the project
      const result = await openDir(mudDir, "standalone");
      if (!result.success) {
        setStage("error");
        setError(result.errors?.join(", ") ?? "Failed to open project");
        return;
      }

      // Apply template config overrides
      const config = useConfigStore.getState().config;
      if (config && template) {
        const merged = applyTemplate(config, {
          ...template.configOverrides,
          server: {
            ...template.configOverrides.server,
            telnetPort: data.telnetPort,
            webPort: data.webPort,
          },
        });
        updateConfig(merged);
      }

      // Write starter zones
      const project = useProjectStore.getState().project;
      const starterZone = template?.starterZones?.[0];
      if (starterZone && project) {
        await invoke("create_zone_directory", {
          projectDir: mudDir,
          zoneId: starterZone.zone,
        });
        const filePath = zoneFilePath(project, starterZone.zone);
        await writeTextFile(filePath, stringify(starterZone));
        loadZone(starterZone.zone, filePath, starterZone);

        // Set zone vibe from the world/zone theme
        const vibeText = [data.worldTheme, data.zoneTheme]
          .filter(Boolean)
          .join("\n\n");
        if (vibeText) {
          useVibeStore.getState().saveVibe(starterZone.zone, vibeText).catch(() => {});
        }

        // Open the zone tab so the user lands on the map
        useProjectStore.getState().openTab({
          id: `zone:${starterZone.zone}`,
          kind: "zone",
          label: starterZone.zone,
        });
      }

      // Save config to disk
      if (config && project) {
        await saveProjectConfig(project);
      }

      addRecentProject(mudDir, data.projectName);
      setStage("done");
    } catch (err) {
      setStage("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [data, openDir, updateConfig, loadZone]);

  const reset = useCallback(() => {
    setStage("idle");
    setError(null);
  }, []);

  return {
    data,
    update,
    selectTemplate,
    stage,
    error,
    create,
    reset,
  };
}
