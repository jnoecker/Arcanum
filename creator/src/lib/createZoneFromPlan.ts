import { invoke } from "@tauri-apps/api/core";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { stringify } from "yaml";
import { useZoneStore } from "@/stores/zoneStore";
import { useProjectStore } from "@/stores/projectStore";
import { zoneFilePath } from "@/lib/projectPaths";
import {
  extractMentions,
  plainTextToTiptap,
  tiptapToPlainText,
} from "@/lib/loreRelations";
import type { Project } from "@/types/project";
import type { Article, ZonePlan } from "@/types/lore";
import type { WorldFile } from "@/types/world";
import { YAML_OPTS } from "@/lib/yamlOpts";

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
  if (plan.description?.trim()) {
    descParts.push("");
    descParts.push(plan.description.trim());
  }
  if (plan.inhabitants && plan.inhabitants.length > 0) {
    descParts.push("");
    descParts.push("Inhabitants:");
    for (const i of plan.inhabitants) descParts.push(`- ${i}`);
  }
  if (plan.landmarks && plan.landmarks.length > 0) {
    descParts.push("");
    descParts.push("Landmarks:");
    for (const l of plan.landmarks) descParts.push(`- ${l}`);
  }
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

// ─── Prefill for the rich zone generator wizard ─────────────────────

export interface ZonePlanPrefill {
  /** Suggested zone id, already deduplicated against loaded zones. */
  zoneId: string;
  /** TipTap JSON document seeded from the plan's blurb/description/inhabitants/landmarks/hooks. */
  description: string;
  /** Plain-text context the LLM sees alongside the description. */
  backgroundNotes: string;
}

/** Max number of referenced articles the LLM will see in backgroundNotes. */
const MAX_REFERENCED_ARTICLES = 10;
/** Max chars per article excerpt (after TipTap → plain text). */
const MAX_ARTICLE_EXCERPT = 300;

function planDescriptionToPlainText(plan: ZonePlan): string {
  const raw = plan.description ?? "";
  if (!raw.trim()) return "";
  return tiptapToPlainText(raw).trim();
}

function buildDescriptionProse(plan: ZonePlan): string {
  const parts: string[] = [];
  if (plan.blurb.trim()) parts.push(plan.blurb.trim());
  const descText = planDescriptionToPlainText(plan);
  if (descText) parts.push(descText);
  if (plan.inhabitants && plan.inhabitants.length > 0) {
    parts.push(
      `Inhabitants: ${plan.inhabitants.filter(Boolean).join(", ")}.`,
    );
  }
  if (plan.landmarks && plan.landmarks.length > 0) {
    parts.push(
      `Notable landmarks: ${plan.landmarks.filter(Boolean).join(", ")}.`,
    );
  }
  if (plan.hooks && plan.hooks.length > 0) {
    const hooks = plan.hooks.filter((h) => h.trim()).join("; ");
    if (hooks) parts.push(`Story hooks: ${hooks}.`);
  }
  return parts.join("\n\n");
}

/**
 * Collect article IDs referenced by the plan — both explicit linkedArticles
 * and @mentions inside the description — deduped, preserving declaration order.
 */
function collectReferencedArticleIds(plan: ZonePlan): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const id of plan.linkedArticles ?? []) {
    if (id && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }

  if (plan.description) {
    for (const rel of extractMentions(plan.description)) {
      if (rel.targetId && !seen.has(rel.targetId)) {
        seen.add(rel.targetId);
        ids.push(rel.targetId);
      }
    }
  }

  return ids;
}

function buildArticleReferenceLine(article: Article): string {
  const excerpt = tiptapToPlainText(article.content)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_ARTICLE_EXCERPT);
  return excerpt
    ? `- [${article.template}] ${article.title} — ${excerpt}`
    : `- [${article.template}] ${article.title}`;
}

function buildReferencedLoreBlock(
  plan: ZonePlan,
  articles: Record<string, Article>,
): string {
  const ids = collectReferencedArticleIds(plan).slice(0, MAX_REFERENCED_ARTICLES);
  const lines = ids
    .map((id) => articles[id])
    .filter((a): a is Article => !!a)
    .map(buildArticleReferenceLine);
  if (lines.length === 0) return "";
  return ["Referenced lore:", ...lines].join("\n");
}

function buildBackgroundNotes(
  plan: ZonePlan,
  allPlans: ZonePlan[],
  articles: Record<string, Article>,
): string {
  const blocks: string[] = [];

  const parent = plan.parentId
    ? allPlans.find((p) => p.id === plan.parentId)
    : null;
  if (parent) {
    const parentBlurb = parent.blurb?.trim();
    blocks.push(
      parentBlurb
        ? `Parent region: ${parent.name} — ${parentBlurb}`
        : `Parent region: ${parent.name}`,
    );
  }

  if (plan.borders && plan.borders.length > 0) {
    const neighbors = plan.borders
      .map((id) => allPlans.find((p) => p.id === id)?.name)
      .filter((n): n is string => !!n);
    if (neighbors.length > 0) {
      blocks.push(`Borders: ${neighbors.join(", ")}.`);
    }
  }

  if (plan.levelRange) {
    blocks.push(
      `Target level range: ${plan.levelRange.min}-${plan.levelRange.max}.`,
    );
  }

  const loreBlock = buildReferencedLoreBlock(plan, articles);
  if (loreBlock) blocks.push(loreBlock);

  return blocks.join("\n\n");
}

/**
 * Build the initial state for NewZoneDialog so the rich zone generator
 * opens pre-filled with everything we know from the world plan. Linked
 * articles and @mentions in the description are resolved into a
 * "Referenced lore:" block in backgroundNotes.
 */
export function buildPlanPrefill(
  plan: ZonePlan,
  allPlans: ZonePlan[],
  articles: Record<string, Article>,
): ZonePlanPrefill {
  const base = slugifyZoneId(plan.name) ?? "new_zone";
  const zoneId = findFreeZoneId(base);
  const prose = buildDescriptionProse(plan);
  return {
    zoneId,
    description: prose ? plainTextToTiptap(prose) : "",
    backgroundNotes: buildBackgroundNotes(plan, allPlans, articles),
  };
}
