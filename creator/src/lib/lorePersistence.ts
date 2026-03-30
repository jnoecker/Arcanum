import { exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { parseDocument, stringify } from "yaml";
import { useLoreStore } from "@/stores/loreStore";
import { DEFAULT_WORLD_LORE } from "@/types/lore";
import type { WorldLore } from "@/types/lore";
import type { Project } from "@/types/project";

const YAML_OPTS = {
  lineWidth: 120,
  defaultKeyType: "PLAIN" as const,
  defaultStringType: "PLAIN" as const,
};

export function lorePath(project: Project): string {
  return project.format === "standalone"
    ? `${project.mudDir}/lore.yaml`
    : `${project.mudDir}/src/main/resources/lore.yaml`;
}

export async function loadLore(project: Project): Promise<WorldLore> {
  const path = lorePath(project);
  try {
    if (!(await exists(path))) return { ...DEFAULT_WORLD_LORE };
    const content = await readTextFile(path);
    const doc = parseDocument(content);
    const raw = (doc.toJS() ?? {}) as Record<string, unknown>;
    return {
      setting: (raw.setting as WorldLore["setting"]) ?? {},
      factions: (raw.factions as WorldLore["factions"]) ?? {},
      codex: (raw.codex as WorldLore["codex"]) ?? {},
    };
  } catch {
    return { ...DEFAULT_WORLD_LORE };
  }
}

export async function saveLore(project: Project): Promise<void> {
  const state = useLoreStore.getState();
  const lore = state.lore;
  if (!lore) return;

  const path = lorePath(project);
  await writeTextFile(path, stringify(lore, YAML_OPTS));
  state.markClean();
}
