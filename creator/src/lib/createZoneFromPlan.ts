import { invoke } from "@tauri-apps/api/core";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { stringify } from "yaml";
import { useZoneStore } from "@/stores/zoneStore";
import { useProjectStore } from "@/stores/projectStore";
import { zoneFilePath } from "@/lib/projectPaths";
import type { Project } from "@/types/project";
import type { ZonePlan } from "@/types/lore";
import type { WorldFile } from "@/types/world";

const YAML_OPTS = {
  lineWidth: 120,
  defaultKeyType: "PLAIN" as const,
  defaultStringType: "PLAIN" as const,
};

/**
 * Convert a ZonePlan name into a valid zone id (lowercase, underscores,
 * starts with a letter). Returns null if a usable id cannot be derived.
 */
export function slugifyZoneId(name: string): string | null {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  if (!slug) return null;
  // Must start with a letter to satisfy the existing zone-id grammar.
  return /^[a-z]/.test(slug) ? slug : `z_${slug}`;
}

/**
 * Find a free zone id by appending _2, _3, ... if the base id is taken.
 * Checks both already-loaded zones and existing files via the project store.
 */
export function findFreeZoneId(base: string): string {
  const zones = useZoneStore.getState().zones;
  let candidate = base;
  let counter = 2;
  while (zones.has(candidate)) {
    candidate = `${base}_${counter}`;
    counter++;
  }
  return candidate;
}

/**
 * Build a starter WorldFile from a ZonePlan, seeding the entrance room
 * description from the plan's blurb and hooks.
 */
export function buildWorldFileFromPlan(
  plan: ZonePlan,
  zoneId: string,
): WorldFile {
  const startRoom = "entrance";
  const descParts: string[] = [];
  if (plan.blurb.trim()) descParts.push(plan.blurb.trim());
  if (plan.hooks && plan.hooks.length > 0) {
    descParts.push("");
    descParts.push("Hooks:");
    for (const h of plan.hooks) descParts.push(`- ${h}`);
  }
  const description = descParts.length > 0
    ? descParts.join("\n")
    : "A new room.";

  return {
    zone: zoneId,
    startRoom,
    rooms: {
      [startRoom]: {
        title: plan.name,
        description,
      },
    },
  };
}

export interface CreateZoneFromPlanResult {
  zoneId: string;
  filePath: string;
  world: WorldFile;
}

/**
 * Scaffold a real zone YAML file from a ZonePlan, register it in the
 * zoneStore, and open a tab for it. Returns the resolved zoneId so the
 * caller can patch the plan's `zoneId` field.
 *
 * Throws if the project is missing or the plan name can't be slugified.
 */
export async function createZoneFromPlan(
  plan: ZonePlan,
  project: Project,
): Promise<CreateZoneFromPlanResult> {
  const base = slugifyZoneId(plan.name);
  if (!base) {
    throw new Error(`Cannot derive a zone id from plan name "${plan.name}".`);
  }
  const zoneId = findFreeZoneId(base);

  const world = buildWorldFileFromPlan(plan, zoneId);

  if (project.format === "standalone") {
    await invoke("create_zone_directory", {
      projectDir: project.mudDir,
      zoneId,
    });
  }

  const filePath = zoneFilePath(project, zoneId);
  const yaml = stringify(world, YAML_OPTS);
  await writeTextFile(filePath, yaml);

  // Register in the in-memory store and open the tab.
  const { loadZone } = useZoneStore.getState();
  const { openTab } = useProjectStore.getState();
  loadZone(zoneId, filePath, world);
  openTab({ id: `zone:${zoneId}`, kind: "zone", label: zoneId });

  return { zoneId, filePath, world };
}
