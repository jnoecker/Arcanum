import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useOpenProject } from "@/lib/useOpenProject";
import { useConfigStore } from "@/stores/configStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useProjectStore } from "@/stores/projectStore";
import { parseAppConfigYaml } from "@/lib/loader";
import { saveProjectConfig } from "@/lib/saveConfig";
import { addRecentProject } from "@/lib/uiPersistence";
import { zoneFilePath } from "@/lib/projectPaths";
import { parseDocument } from "yaml";
import type { WorldFile } from "@/types/world";

export type ImportStage =
  | "idle"
  | "fetching"
  | "creating_project"
  | "writing_data"
  | "done"
  | "error";

interface ImportState {
  stage: ImportStage;
  error: string | null;
  zoneCount: number;
}

interface R2ImportResult {
  config_yaml: string;
  zones: Array<{ zone_id: string; yaml: string }>;
}

export function useImportFromR2() {
  const [state, setState] = useState<ImportState>({
    stage: "idle",
    error: null,
    zoneCount: 0,
  });
  const { openDir } = useOpenProject();
  const updateConfig = useConfigStore((s) => s.updateConfig);
  const loadZone = useZoneStore((s) => s.loadZone);

  const importFromR2 = useCallback(
    async (targetDir: string, projectName: string) => {
      setState({ stage: "fetching", error: null, zoneCount: 0 });

      try {
        // Step 1: Fetch config + zones from R2
        const result = await invoke<R2ImportResult>("import_from_r2");

        // Step 2: Parse the config YAML
        const config = parseAppConfigYaml(result.config_yaml);

        // Step 3: Create standalone project directory
        setState({ stage: "creating_project", error: null, zoneCount: result.zones.length });
        const mudDir = await invoke<string>("create_standalone_project", {
          targetDir,
          projectName,
        });

        // Step 4: Open the project
        const openResult = await openDir(mudDir, "standalone");
        if (!openResult.success) {
          setState({
            stage: "error",
            error: openResult.errors?.join(", ") ?? "Failed to open project",
            zoneCount: 0,
          });
          return;
        }

        // Step 5: Apply the imported config
        setState({ stage: "writing_data", error: null, zoneCount: result.zones.length });
        updateConfig(config);

        // Step 6: Write zone files
        const project = useProjectStore.getState().project;
        if (project) {
          for (const zone of result.zones) {
            await invoke("create_zone_directory", {
              projectDir: mudDir,
              zoneId: zone.zone_id,
            });
            const filePath = zoneFilePath(project, zone.zone_id);
            await writeTextFile(filePath, zone.yaml);

            // Parse and load zone into store
            try {
              const doc = parseDocument(zone.yaml);
              const data = doc.toJS() as WorldFile;
              if (data.zone && data.rooms) {
                loadZone(data.zone, filePath, data);
              }
            } catch (err) {
              console.error(`Failed to parse zone ${zone.zone_id}:`, err);
            }
          }

          // Step 7: Save split config to disk
          await saveProjectConfig(project);
        }

        addRecentProject(mudDir, projectName);
        setState({ stage: "done", error: null, zoneCount: result.zones.length });
      } catch (err) {
        setState({
          stage: "error",
          error: err instanceof Error ? err.message : String(err),
          zoneCount: 0,
        });
      }
    },
    [openDir, updateConfig, loadZone],
  );

  const reset = useCallback(() => {
    setState({ stage: "idle", error: null, zoneCount: 0 });
  }, []);

  return { ...state, importFromR2, reset };
}
