import type { Project } from "@/types/project";

/** Directory containing config files. */
export function configDir(project: Project): string {
  return project.format === "standalone"
    ? `${project.mudDir}/config`
    : `${project.mudDir}/src/main/resources`;
}

/** Directory containing zones. */
export function zonesDir(project: Project): string {
  return project.format === "standalone"
    ? `${project.mudDir}/zones`
    : `${project.mudDir}/src/main/resources/world`;
}

/** Path to a specific zone's YAML file. */
export function zoneFilePath(project: Project, zoneId: string): string {
  return project.format === "standalone"
    ? `${project.mudDir}/zones/${zoneId}/zone.yaml`
    : `${project.mudDir}/src/main/resources/world/${zoneId}.yaml`;
}

/** Path to the zone's assets directory (standalone only). */
export function zoneAssetsDir(project: Project, zoneId: string): string | null {
  return project.format === "standalone"
    ? `${project.mudDir}/zones/${zoneId}/assets`
    : null;
}

/** Names of the split config files used by standalone projects. */
export const CONFIG_FILES = [
  "classes",
  "races",
  "abilities",
  "status-effects",
  "stats",
  "equipment",
  "combat",
  "crafting",
  "progression",
  "world",
  "assets",
] as const;

export type ConfigFileName = (typeof CONFIG_FILES)[number];
