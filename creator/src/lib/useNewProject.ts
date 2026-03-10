import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { stringify } from "yaml";
import { useOpenProject } from "@/lib/useOpenProject";
import { useProjectStore } from "@/stores/projectStore";
import { useConfigStore } from "@/stores/configStore";
import { useZoneStore } from "@/stores/zoneStore";
import { saveProjectConfig } from "@/lib/saveConfig";
import { addRecentProject } from "@/lib/uiPersistence";
import { zoneFilePath } from "@/lib/projectPaths";
import { applyTemplate, type ProjectTemplate } from "@/lib/templates";

export type WizardStage =
  | "idle"
  | "creating_structure"
  | "setting_up"
  | "done"
  | "error";

interface WizardState {
  stage: WizardStage;
  error: string | null;
}

export function useNewProject() {
  const [state, setState] = useState<WizardState>({
    stage: "idle",
    error: null,
  });
  const { openDir } = useOpenProject();
  const updateConfig = useConfigStore((s) => s.updateConfig);
  const loadZone = useZoneStore((s) => s.loadZone);

  const create = useCallback(
    async (
      targetDir: string,
      projectName: string,
      template: ProjectTemplate,
      ports: { telnet: number; web: number },
    ) => {
      setState({ stage: "creating_structure", error: null });

      try {
        // Step 1: Create standalone project directory
        const mudDir = await invoke<string>("create_standalone_project", {
          targetDir,
          projectName,
        });

        // Step 2: Setup
        setState({ stage: "setting_up", error: null });

        // Open the project (format override since config files don't exist yet)
        const result = await openDir(mudDir, "standalone");
        if (!result.success) {
          setState({
            stage: "error",
            error: result.errors?.join(", ") ?? "Failed to open project",
          });
          return;
        }

        // Apply template config overrides
        const config = useConfigStore.getState().config;
        if (config) {
          const merged = applyTemplate(config, {
            ...template.configOverrides,
            server: {
              ...template.configOverrides.server,
              telnetPort: ports.telnet,
              webPort: ports.web,
            },
          });
          updateConfig(merged);
        }

        // Write starter zones
        const project = useProjectStore.getState().project;
        if (template.starterZones && project) {
          for (const zone of template.starterZones) {
            await invoke("create_zone_directory", {
              projectDir: mudDir,
              zoneId: zone.zone,
            });
            const filePath = zoneFilePath(project, zone.zone);
            await writeTextFile(filePath, stringify(zone));
            loadZone(zone.zone, filePath, zone);
          }
        }

        // Save config to disk
        if (config && project) {
          await saveProjectConfig(project);
        }

        addRecentProject(mudDir, projectName);
        setState({ stage: "done", error: null });
      } catch (err) {
        setState({
          stage: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [openDir, updateConfig, loadZone],
  );

  const reset = useCallback(() => {
    setState({ stage: "idle", error: null });
  }, []);

  return { ...state, create, reset };
}
