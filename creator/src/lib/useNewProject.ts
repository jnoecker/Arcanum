import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { stringify } from "yaml";
import { useOpenProject } from "@/lib/useOpenProject";
import { useConfigStore } from "@/stores/configStore";
import { useZoneStore } from "@/stores/zoneStore";
import { saveConfig } from "@/lib/saveConfig";
import { addRecentProject } from "@/lib/uiPersistence";
import { applyTemplate, type ProjectTemplate } from "@/lib/templates";

export type WizardStage =
  | "idle"
  | "checking_git"
  | "cloning"
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
      setState({ stage: "checking_git", error: null });

      try {
        // Step 1: Check git
        await invoke<string>("check_git_installed");

        // Step 2: Clone
        setState({ stage: "cloning", error: null });
        const mudDir = await invoke<string>("clone_mud_project", {
          targetDir,
          projectName,
        });

        // Step 3: Setup
        setState({ stage: "setting_up", error: null });
        await invoke<number>("clear_world_zones", { mudDir });

        // Open the project
        const result = await openDir(mudDir);
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
        if (template.starterZones) {
          const worldDir = `${mudDir}/src/main/resources/world`;
          for (const zone of template.starterZones) {
            const filePath = `${worldDir}/${zone.zone}.yaml`;
            await writeTextFile(filePath, stringify(zone));
            loadZone(zone.zone, filePath, zone);
          }
        }

        // Save config to disk
        if (config) {
          await saveConfig(mudDir);
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
