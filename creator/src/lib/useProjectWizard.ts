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
import { applyTemplate, TEMPLATES } from "@/lib/templates";
import { zoneFilePath } from "@/lib/projectPaths";
import type { ArtStyle } from "@/lib/arcanumPrompts";
import type {
  StatDefinition,
  StatBindings,
  ClassDefinitionConfig,
  RaceDefinitionConfig,
  EquipmentSlotDefinition,
} from "@/types/config";
import type { WorldFile } from "@/types/world";

export type WizardStage =
  | "idle"
  | "creating_structure"
  | "setting_up"
  | "done"
  | "error";

export interface WizardData {
  // Step 1
  projectName: string;
  parentDir: string;
  // Step 2
  templateId: string;
  artStyle: ArtStyle;
  // Step 3
  worldTheme: string;
  telnetPort: number;
  webPort: number;
  // Step 4
  stats: Record<string, StatDefinition>;
  statBindings: Partial<StatBindings>;
  classes: Record<string, ClassDefinitionConfig>;
  races: Record<string, RaceDefinitionConfig>;
  equipmentSlots: Record<string, EquipmentSlotDefinition>;
  // Step 5
  maxLevel: number;
  xpCurve: { baseXp: number; exponent: number; linearXp: number; multiplier: number };
  levelRewards: { hpPerLevel: number; manaPerLevel: number; baseHp: number; baseMana: number };
  startingGold: number;
  buyMultiplier: number;
  sellMultiplier: number;
  // Step 6
  demoZone: WorldFile | null;
  zoneName: string;
  zoneTheme: string;
  roomCount: number;
  mobCount: number;
  itemCount: number;
}

const DEFAULT_DATA: WizardData = {
  projectName: "",
  parentDir: "",
  templateId: "classic_fantasy",
  artStyle: "gentle_magic",
  worldTheme: "",
  telnetPort: 4000,
  webPort: 8080,
  stats: {},
  statBindings: {},
  classes: {},
  races: {},
  equipmentSlots: {},
  maxLevel: 50,
  xpCurve: { baseXp: 100, exponent: 1.5, linearXp: 50, multiplier: 1.0 },
  levelRewards: { hpPerLevel: 5, manaPerLevel: 5, baseHp: 100, baseMana: 100 },
  startingGold: 100,
  buyMultiplier: 1.0,
  sellMultiplier: 0.5,
  demoZone: null,
  zoneName: "town_square",
  zoneTheme: "",
  roomCount: 4,
  mobCount: 2,
  itemCount: 2,
};

function hydrateFromTemplate(templateId: string): Partial<WizardData> {
  const template = TEMPLATES.find((t) => t.id === templateId);
  if (!template) return {};

  const overrides = template.configOverrides;
  const result: Partial<WizardData> = {};

  if (overrides.stats?.definitions) {
    result.stats = overrides.stats.definitions as Record<string, StatDefinition>;
  }
  if (overrides.stats?.bindings) {
    result.statBindings = overrides.stats.bindings as Partial<StatBindings>;
  }
  if (overrides.classes) {
    result.classes = overrides.classes as Record<string, ClassDefinitionConfig>;
  }
  if (overrides.races) {
    result.races = overrides.races as Record<string, RaceDefinitionConfig>;
  }
  if (overrides.equipmentSlots) {
    result.equipmentSlots = overrides.equipmentSlots as Record<string, EquipmentSlotDefinition>;
  }
  if (overrides.progression) {
    if (overrides.progression.maxLevel != null) {
      result.maxLevel = overrides.progression.maxLevel;
    }
    if (overrides.progression.xp) {
      result.xpCurve = {
        ...DEFAULT_DATA.xpCurve,
        ...(overrides.progression.xp as Partial<WizardData["xpCurve"]>),
      };
    }
    if (overrides.progression.rewards) {
      result.levelRewards = {
        ...DEFAULT_DATA.levelRewards,
        ...(overrides.progression.rewards as Partial<WizardData["levelRewards"]>),
      };
    }
  }
  if (overrides.characterCreation?.startingGold != null) {
    result.startingGold = overrides.characterCreation.startingGold;
  }
  if (overrides.economy) {
    if (overrides.economy.buyMultiplier != null) {
      result.buyMultiplier = overrides.economy.buyMultiplier;
    }
    if (overrides.economy.sellMultiplier != null) {
      result.sellMultiplier = overrides.economy.sellMultiplier;
    }
  }

  // Seed zone name + theme from template
  if (template.defaultZoneTheme) {
    result.zoneTheme = template.defaultZoneTheme;
  }
  if (template.defaultWorldTheme) {
    result.worldTheme = template.defaultWorldTheme;
  }

  // Use starter zone name if available
  if (template.starterZones?.[0]) {
    result.zoneName = template.starterZones[0].zone;
  }

  // Pre-populate demo zone from template starter zones
  if (template.starterZones?.[0]) {
    result.demoZone = template.starterZones[0];
  }

  return result;
}

export function useProjectWizard() {
  const [data, setData] = useState<WizardData>(() => ({
    ...DEFAULT_DATA,
    ...hydrateFromTemplate("classic_fantasy"),
  }));

  const [stage, setStage] = useState<WizardStage>("idle");
  const [error, setError] = useState<string | null>(null);

  const { openDir } = useOpenProject();
  const updateConfig = useConfigStore((s) => s.updateConfig);
  const loadZone = useZoneStore((s) => s.loadZone);

  const update = useCallback((partial: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  }, []);

  const selectTemplate = useCallback((templateId: string) => {
    const hydrated = hydrateFromTemplate(templateId);
    setData((prev) => ({
      ...prev,
      ...hydrated,
      templateId,
      // Clear generated demo zone when switching templates
      demoZone: hydrated.demoZone ?? null,
    }));
  }, []);

  const create = useCallback(async () => {
    setStage("creating_structure");
    setError(null);

    try {
      // Step 1: Create standalone project directory
      const mudDir = await invoke<string>("create_standalone_project", {
        targetDir: data.parentDir,
        projectName: data.projectName,
      });

      // Step 2: Setup
      setStage("setting_up");

      // Open the project (format override since config files don't exist yet)
      const result = await openDir(mudDir, "standalone");
      if (!result.success) {
        setStage("error");
        setError(result.errors?.join(", ") ?? "Failed to open project");
        return;
      }

      // Apply template config overrides
      const template = TEMPLATES.find((t) => t.id === data.templateId);
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

        // Apply wizard customizations on top
        merged.stats.definitions = data.stats;
        if (Object.keys(data.statBindings).length > 0) {
          merged.stats.bindings = {
            ...merged.stats.bindings,
            ...data.statBindings,
          } as typeof merged.stats.bindings;
        }
        merged.classes = data.classes;
        merged.races = data.races;
        merged.equipmentSlots = data.equipmentSlots;
        merged.progression.maxLevel = data.maxLevel;
        merged.progression.xp = {
          ...merged.progression.xp,
          ...data.xpCurve,
        };
        merged.progression.rewards = {
          ...merged.progression.rewards,
          ...data.levelRewards,
        };
        merged.characterCreation.startingGold = data.startingGold;
        merged.economy.buyMultiplier = data.buyMultiplier;
        merged.economy.sellMultiplier = data.sellMultiplier;

        // Clean up demo-polluted sections
        merged.abilities = template.configOverrides.abilities as typeof merged.abilities ?? {};
        merged.statusEffects = template.configOverrides.statusEffects as typeof merged.statusEffects ?? {};
        merged.classStartRooms = {};

        updateConfig(merged);
      }

      // Write demo zone
      const project = useProjectStore.getState().project;
      const zoneToWrite = data.demoZone;
      if (zoneToWrite && project) {
        await invoke("create_zone_directory", {
          projectDir: mudDir,
          zoneId: zoneToWrite.zone,
        });
        const filePath = zoneFilePath(project, zoneToWrite.zone);
        await writeTextFile(filePath, stringify(zoneToWrite));
        loadZone(zoneToWrite.zone, filePath, zoneToWrite);
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
