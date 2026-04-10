import { invoke } from "@tauri-apps/api/core";
import { exportMudFormat, buildMonolithicConfig, generateSpritesYaml } from "@/lib/exportMud";
import { YAML_OPTS } from "@/lib/yamlOpts";
import { saveProjectConfig } from "@/lib/saveConfig";
import { saveAllZones } from "@/lib/saveZone";
import { useSpriteDefinitionStore } from "@/stores/spriteDefinitionStore";
import { validateConfig } from "@/lib/validateConfig";
import { validateAllZones, type ValidationIssue } from "@/lib/validateZone";
import { useAssetStore } from "@/stores/assetStore";
import { useConfigStore } from "@/stores/configStore";
import { useValidationStore } from "@/stores/validationStore";
import { useZoneStore } from "@/stores/zoneStore";
import type { Project } from "@/types/project";
import type { SyncProgress, SyncScope } from "@/types/assets";

export interface ValidationSummary {
  results: Map<string, ValidationIssue[]>;
  errorCount: number;
  warningCount: number;
  zonesWithIssues: number;
}

export interface SaveWorkspaceResult {
  savedZones: string[];
  configSaved: boolean;
  resourcesUpdated: boolean;
}

function buildWorldResources(): string[] {
  return Array.from(useZoneStore.getState().zones.keys())
    .sort()
    .map((id) => `world/${id}.yaml`);
}

export function syncWorldResourcesIntoConfig(): { resources: string[]; updated: boolean } {
  const configState = useConfigStore.getState();
  const config = configState.config;
  const resources = buildWorldResources();

  if (!config) {
    return { resources, updated: false };
  }

  const current = config.world.resources ?? [];
  const unchanged =
    current.length === resources.length &&
    current.every((value, index) => value === resources[index]);

  if (unchanged) {
    return { resources, updated: false };
  }

  configState.updateConfig({
    ...config,
    world: {
      ...config.world,
      resources,
    },
  });

  return { resources, updated: true };
}

export async function saveWorkspace(project: Project): Promise<SaveWorkspaceResult> {
  const { updated } = syncWorldResourcesIntoConfig();
  const savedZones = await saveAllZones();
  const configDirty = useConfigStore.getState().dirty;

  if (configDirty) {
    await saveProjectConfig(project);
  }

  const spriteStore = useSpriteDefinitionStore.getState();
  if (spriteStore.dirty) {
    await spriteStore.saveDefinitions(project);
  }

  return {
    savedZones,
    configSaved: configDirty,
    resourcesUpdated: updated,
  };
}

export function runWorkspaceValidation(): ValidationSummary {
  const zones = useZoneStore.getState().zones;
  const config = useConfigStore.getState().config;
  const validClasses = config?.classes
    ? new Set(Object.keys(config.classes).map((k) => k.toUpperCase()))
    : undefined;
  const results = validateAllZones(zones, config?.equipmentSlots, validClasses);

  if (config) {
    const configIssues = validateConfig(config);
    if (configIssues.length > 0) {
      results.set("Config", configIssues);
    }
  }

  let errorCount = 0;
  let warningCount = 0;
  for (const issues of results.values()) {
    for (const issue of issues) {
      if (issue.severity === "error") {
        errorCount += 1;
      } else {
        warningCount += 1;
      }
    }
  }

  useValidationStore.getState().setResults(results);

  return {
    results,
    errorCount,
    warningCount,
    zonesWithIssues: results.size,
  };
}

export function openValidationResults(): void {
  useValidationStore.getState().openPanel();
}

export async function exportRuntimeBundle(outputDir: string) {
  return exportMudFormat(outputDir);
}

export async function publishCuratedAssets(scope: SyncScope = "approved"): Promise<SyncProgress> {
  return useAssetStore.getState().syncToR2(scope);
}

export async function publishGlobalAssets(): Promise<SyncProgress> {
  const config = useConfigStore.getState().config;
  return invoke<SyncProgress>("deploy_global_assets_to_r2", {
    globalAssets: config?.globalAssets ?? {},
  });
}

export async function publishPlayerSprites(): Promise<SyncProgress> {
  const spritesYaml = generateSpritesYaml();
  return invoke<SyncProgress>("deploy_sprites_to_r2", { spritesYaml });
}

export async function deployRuntimeAchievements(): Promise<string> {
  const config = useConfigStore.getState().config;
  const { stringify } = await import("yaml");
  const content = stringify(
    { achievements: config?.achievementDefs ?? {} },
    YAML_OPTS,
  );
  return invoke<string>("deploy_achievements_to_r2", { achievementsContent: content });
}

export async function deployRuntimeConfig(project: Project): Promise<string> {
  const configContent = project.format === "standalone"
    ? buildMonolithicConfig()
    : undefined;

  return invoke<string>("deploy_config_to_r2", {
    mudDir: project.mudDir,
    configContent,
  });
}

export async function deployRuntimeZones(project: Project): Promise<SyncProgress> {
  await saveAllZones();
  syncWorldResourcesIntoConfig();
  if (useConfigStore.getState().dirty) {
    await saveProjectConfig(project);
  }

  return invoke<SyncProgress>("deploy_zones_to_r2", {
    mudDir: project.mudDir,
    format: project.format,
  });
}
