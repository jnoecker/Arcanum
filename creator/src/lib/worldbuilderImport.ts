import type { Article, ArticleTemplate } from "@/types/lore";
import type {
  AppConfig,
  RaceDefinitionConfig,
  ClassDefinitionConfig,
  AbilityDefinitionConfig,
  StatusEffectDefinitionConfig,
  PetDefinitionConfig,
} from "@/types/config";
import type {
  WorldFile,
  MobFile,
  ItemFile,
  ShopFile,
  QuestFile,
  RecipeFile,
  GatheringNodeFile,
} from "@/types/world";
import type { ZoneState } from "@/stores/zoneStore";

// ─── Source tracking ──────────────────────────────────────────────

export type SourceKind =
  | "race"
  | "class"
  | "ability"
  | "statusEffect"
  | "pet"
  | "mob"
  | "item"
  | "shop"
  | "quest"
  | "recipe"
  | "gatheringNode";

export const CONFIG_KINDS: SourceKind[] = ["race", "class", "ability", "statusEffect", "pet"];
export const ZONE_KINDS: SourceKind[] = ["mob", "item", "shop", "quest", "recipe", "gatheringNode"];

export const KIND_LABELS: Record<SourceKind, string> = {
  race: "Race",
  class: "Class",
  ability: "Ability",
  statusEffect: "Status Effect",
  pet: "Pet",
  mob: "Mob",
  item: "Item",
  shop: "Shop",
  quest: "Quest",
  recipe: "Recipe",
  gatheringNode: "Gathering Node",
};

export const DEFAULT_TEMPLATE_BY_KIND: Record<SourceKind, ArticleTemplate> = {
  race: "species",
  class: "profession",
  ability: "ability",
  statusEffect: "ability",
  pet: "species",
  mob: "species",
  item: "item",
  shop: "location",
  quest: "event",
  recipe: "freeform",
  gatheringNode: "location",
};

// Metadata keys stored in Article.fields to track worldbuilder origin.
export const SOURCE_TYPE_KEY = "_sourceType";
export const SOURCE_KIND_KEY = "_sourceKind";
export const SOURCE_ID_KEY = "_sourceId";
export const SOURCE_ZONE_KEY = "_sourceZoneId";
export const SOURCE_TYPE_VALUE = "worldbuilder";

export interface ImportSourceRef {
  kind: SourceKind;
  sourceId: string;
  zoneId?: string;
}

// ─── Candidate model ──────────────────────────────────────────────

export interface WorldbuilderCandidate {
  /** Lore article id that will be created (or overwritten). */
  loreId: string;
  title: string;
  template: ArticleTemplate;
  fields: Record<string, unknown>;
  /** TipTap JSON content as a string. */
  content: string;
  source: ImportSourceRef;
  /** Existing article id if a matching source ref was found, else null. */
  existingArticleId: string | null;
  /** Whether this row is selected for import. */
  selected: boolean;
}

export interface WorldbuilderSelection {
  config: Record<Extract<SourceKind, "race" | "class" | "ability" | "statusEffect" | "pet">, boolean>;
  /** Per-zone map of which entity kinds to pull. Missing zone = all-false. */
  zones: Record<string, Partial<Record<Extract<SourceKind, "mob" | "item" | "shop" | "quest" | "recipe" | "gatheringNode">, boolean>>>;
}

export const EMPTY_SELECTION: WorldbuilderSelection = {
  config: { race: false, class: false, ability: false, statusEffect: false, pet: false },
  zones: {},
};

// ─── TipTap builders ──────────────────────────────────────────────

type TipTapNode = Record<string, unknown>;

function textNode(text: string): TipTapNode {
  return { type: "text", text };
}

function paragraph(text: string): TipTapNode {
  return { type: "paragraph", content: [textNode(text)] };
}

function heading(level: number, text: string): TipTapNode {
  return { type: "heading", attrs: { level }, content: [textNode(text)] };
}

function bulletList(items: string[]): TipTapNode {
  return {
    type: "bulletList",
    content: items.map((t) => ({
      type: "listItem",
      content: [paragraph(t)],
    })),
  };
}

function buildDoc(nodes: TipTapNode[]): string {
  if (nodes.length === 0) return "";
  return JSON.stringify({ type: "doc", content: nodes });
}

// ─── Helpers ──────────────────────────────────────────────────────

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "") || "untitled"
  );
}

function makeLoreId(kind: SourceKind, title: string, zoneId?: string): string {
  const slug = slugify(title);
  if (zoneId) return `${kind}_${slugify(zoneId)}_${slug}`;
  return `${kind}_${slug}`;
}

function sourceFields(ref: ImportSourceRef): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    [SOURCE_TYPE_KEY]: SOURCE_TYPE_VALUE,
    [SOURCE_KIND_KEY]: ref.kind,
    [SOURCE_ID_KEY]: ref.sourceId,
  };
  if (ref.zoneId) fields[SOURCE_ZONE_KEY] = ref.zoneId;
  return fields;
}

/** Find an existing article that was previously imported from the same source ref. */
export function findExistingBySourceRef(
  articles: Record<string, Article>,
  ref: ImportSourceRef,
): string | null {
  for (const [articleId, article] of Object.entries(articles)) {
    const f = article.fields ?? {};
    if (
      f[SOURCE_TYPE_KEY] === SOURCE_TYPE_VALUE &&
      f[SOURCE_KIND_KEY] === ref.kind &&
      f[SOURCE_ID_KEY] === ref.sourceId &&
      (f[SOURCE_ZONE_KEY] ?? undefined) === ref.zoneId
    ) {
      return articleId;
    }
  }
  return null;
}

// ─── Config converters ───────────────────────────────────────────

function convertRace(id: string, race: RaceDefinitionConfig): Omit<WorldbuilderCandidate, "existingArticleId" | "selected"> {
  const title = race.displayName || id;
  const nodes: TipTapNode[] = [];
  if (race.description) nodes.push(paragraph(race.description));
  if (race.backstory) {
    nodes.push(heading(2, "Backstory"));
    nodes.push(paragraph(race.backstory));
  }
  if (race.bodyDescription) {
    nodes.push(heading(2, "Physical form"));
    nodes.push(paragraph(race.bodyDescription));
  }

  const fields: Record<string, unknown> = {
    temperament: (race.traits ?? []).join(", "),
    abilities: race.abilities ?? [],
  };

  return {
    loreId: makeLoreId("race", title),
    title,
    template: DEFAULT_TEMPLATE_BY_KIND.race,
    fields,
    content: buildDoc(nodes),
    source: { kind: "race", sourceId: id },
  };
}

function convertClass(id: string, cls: ClassDefinitionConfig): Omit<WorldbuilderCandidate, "existingArticleId" | "selected"> {
  const title = cls.displayName || id;
  const nodes: TipTapNode[] = [];
  if (cls.description) nodes.push(paragraph(cls.description));
  if (cls.backstory) {
    nodes.push(heading(2, "Backstory"));
    nodes.push(paragraph(cls.backstory));
  }

  const statBits: string[] = [];
  statBits.push(`HP per level: ${cls.hpPerLevel}`);
  statBits.push(`Mana per level: ${cls.manaPerLevel}`);
  if (cls.threatMultiplier !== undefined) statBits.push(`Threat multiplier: ${cls.threatMultiplier}`);
  nodes.push(heading(2, "Progression"));
  nodes.push(bulletList(statBits));

  const fields: Record<string, unknown> = {
    primaryStat: cls.primaryStat ?? "",
    playstyle: cls.description ?? "",
  };

  return {
    loreId: makeLoreId("class", title),
    title,
    template: DEFAULT_TEMPLATE_BY_KIND.class,
    fields,
    content: buildDoc(nodes),
    source: { kind: "class", sourceId: id },
  };
}

function convertAbility(id: string, ability: AbilityDefinitionConfig): Omit<WorldbuilderCandidate, "existingArticleId" | "selected"> {
  const title = ability.displayName || id;
  const nodes: TipTapNode[] = [];
  if (ability.description) nodes.push(paragraph(ability.description));

  const mechBits: string[] = [];
  mechBits.push(`Mana cost: ${ability.manaCost}`);
  mechBits.push(`Cooldown: ${ability.cooldownMs} ms`);
  mechBits.push(`Level required: ${ability.levelRequired}`);
  mechBits.push(`Target: ${ability.targetType}`);
  if (ability.requiredClass) mechBits.push(`Class: ${ability.requiredClass}`);
  nodes.push(heading(2, "Mechanics"));
  nodes.push(bulletList(mechBits));

  const fields: Record<string, unknown> = {
    abilityType: "spell",
    resource_cost: `${ability.manaCost} mana`,
    cooldown: `${ability.cooldownMs} ms`,
    effect: ability.description ?? "",
  };
  if (ability.requiredClass) fields.profession = ability.requiredClass;

  return {
    loreId: makeLoreId("ability", title),
    title,
    template: DEFAULT_TEMPLATE_BY_KIND.ability,
    fields,
    content: buildDoc(nodes),
    source: { kind: "ability", sourceId: id },
  };
}

function convertStatusEffect(id: string, se: StatusEffectDefinitionConfig): Omit<WorldbuilderCandidate, "existingArticleId" | "selected"> {
  const title = se.displayName || id;
  const nodes: TipTapNode[] = [];
  nodes.push(paragraph(`A ${se.effectType} status effect lasting ${se.durationMs} ms.`));

  const bits: string[] = [];
  if (se.tickIntervalMs) bits.push(`Ticks every ${se.tickIntervalMs} ms`);
  if (se.shieldAmount) bits.push(`Shield amount: ${se.shieldAmount}`);
  if (se.stackBehavior) bits.push(`Stack behavior: ${se.stackBehavior}`);
  if (se.maxStacks) bits.push(`Max stacks: ${se.maxStacks}`);
  if (bits.length > 0) {
    nodes.push(heading(2, "Mechanics"));
    nodes.push(bulletList(bits));
  }

  return {
    loreId: makeLoreId("statusEffect", title),
    title,
    template: DEFAULT_TEMPLATE_BY_KIND.statusEffect,
    fields: {
      abilityType: "passive",
      effect: `${se.effectType} effect lasting ${se.durationMs} ms.`,
    },
    content: buildDoc(nodes),
    source: { kind: "statusEffect", sourceId: id },
  };
}

function convertPet(id: string, pet: PetDefinitionConfig): Omit<WorldbuilderCandidate, "existingArticleId" | "selected"> {
  const title = pet.name || id;
  const nodes: TipTapNode[] = [];
  if (pet.description) nodes.push(paragraph(pet.description));

  nodes.push(heading(2, "Combat"));
  nodes.push(
    bulletList([
      `HP: ${pet.hp}`,
      `Damage: ${pet.minDamage}–${pet.maxDamage}`,
      `Armor: ${pet.armor}`,
    ]),
  );

  return {
    loreId: makeLoreId("pet", title),
    title,
    template: DEFAULT_TEMPLATE_BY_KIND.pet,
    fields: {
      temperament: "companion",
    },
    content: buildDoc(nodes),
    source: { kind: "pet", sourceId: id },
  };
}

// ─── Zone converters ─────────────────────────────────────────────

function convertMob(id: string, mob: MobFile, zoneId: string): Omit<WorldbuilderCandidate, "existingArticleId" | "selected"> {
  const title = mob.name || id;
  const nodes: TipTapNode[] = [];
  if (mob.description) nodes.push(paragraph(mob.description));

  const bits: string[] = [];
  if (mob.tier) bits.push(`Tier: ${mob.tier}`);
  if (mob.level !== undefined) bits.push(`Level: ${mob.level}`);
  if (mob.category) bits.push(`Category: ${mob.category}`);
  if (mob.faction) bits.push(`Faction: ${mob.faction}`);
  if (mob.hp !== undefined) bits.push(`HP: ${mob.hp}`);
  if (mob.minDamage !== undefined || mob.maxDamage !== undefined) {
    bits.push(`Damage: ${mob.minDamage ?? "?"}–${mob.maxDamage ?? "?"}`);
  }
  if (bits.length > 0) {
    nodes.push(heading(2, "Stats"));
    nodes.push(bulletList(bits));
  }

  const fields: Record<string, unknown> = {};
  if (mob.faction) fields.habitat = mob.faction;
  if (mob.tier) fields.rarity = mob.tier;

  return {
    loreId: makeLoreId("mob", title, zoneId),
    title,
    template: DEFAULT_TEMPLATE_BY_KIND.mob,
    fields,
    content: buildDoc(nodes),
    source: { kind: "mob", sourceId: id, zoneId },
  };
}

function convertItem(id: string, item: ItemFile, zoneId: string): Omit<WorldbuilderCandidate, "existingArticleId" | "selected"> {
  const title = item.displayName || id;
  const nodes: TipTapNode[] = [];
  if (item.description) nodes.push(paragraph(item.description));

  const bits: string[] = [];
  if (item.slot) bits.push(`Slot: ${item.slot}`);
  if (item.damage !== undefined) bits.push(`Damage: ${item.damage}`);
  if (item.armor !== undefined) bits.push(`Armor: ${item.armor}`);
  if (item.basePrice !== undefined) bits.push(`Base price: ${item.basePrice}`);
  if (item.consumable) bits.push(`Consumable${item.charges ? ` (${item.charges} charges)` : ""}`);
  if (bits.length > 0) {
    nodes.push(heading(2, "Properties"));
    nodes.push(bulletList(bits));
  }

  // Infer itemType from slot / damage / armor
  let itemType: string = "treasure";
  if (item.damage !== undefined && item.damage > 0) itemType = "weapon";
  else if (item.armor !== undefined && item.armor > 0) itemType = "armor";
  else if (item.consumable) itemType = "consumable";

  return {
    loreId: makeLoreId("item", title, zoneId),
    title,
    template: DEFAULT_TEMPLATE_BY_KIND.item,
    fields: {
      itemType,
      rarity: "common",
      properties: item.description ?? "",
    },
    content: buildDoc(nodes),
    source: { kind: "item", sourceId: id, zoneId },
  };
}

function convertShop(id: string, shop: ShopFile, zoneId: string): Omit<WorldbuilderCandidate, "existingArticleId" | "selected"> {
  const title = shop.name || id;
  const nodes: TipTapNode[] = [];
  nodes.push(paragraph(`A shop located in ${shop.room}.`));
  if (shop.items && shop.items.length > 0) {
    nodes.push(heading(2, "Wares"));
    nodes.push(bulletList(shop.items));
  }

  return {
    loreId: makeLoreId("shop", title, zoneId),
    title,
    template: DEFAULT_TEMPLATE_BY_KIND.shop,
    fields: {
      locationType: "building",
      population: "merchant and customers",
    },
    content: buildDoc(nodes),
    source: { kind: "shop", sourceId: id, zoneId },
  };
}

function convertQuest(id: string, quest: QuestFile, zoneId: string): Omit<WorldbuilderCandidate, "existingArticleId" | "selected"> {
  const title = quest.name || id;
  const nodes: TipTapNode[] = [];
  if (quest.description) nodes.push(paragraph(quest.description));

  if (quest.objectives && quest.objectives.length > 0) {
    nodes.push(heading(2, "Objectives"));
    nodes.push(
      bulletList(
        quest.objectives.map((o) => o.description || `${o.type} ${o.targetKey}${o.count ? ` x${o.count}` : ""}`),
      ),
    );
  }

  const rewardBits: string[] = [];
  if (quest.rewards?.xp) rewardBits.push(`${quest.rewards.xp} XP`);
  if (quest.rewards?.gold) rewardBits.push(`${quest.rewards.gold} gold`);
  if (quest.rewards?.currencies) {
    for (const [k, v] of Object.entries(quest.rewards.currencies)) {
      rewardBits.push(`${v} ${k}`);
    }
  }
  const outcome = rewardBits.length > 0 ? `Rewards: ${rewardBits.join(", ")}.` : "";

  return {
    loreId: makeLoreId("quest", title, zoneId),
    title,
    template: DEFAULT_TEMPLATE_BY_KIND.quest,
    fields: {
      participants: quest.giver,
      outcome,
    },
    content: buildDoc(nodes),
    source: { kind: "quest", sourceId: id, zoneId },
  };
}

function convertRecipe(id: string, recipe: RecipeFile, zoneId: string): Omit<WorldbuilderCandidate, "existingArticleId" | "selected"> {
  const title = recipe.displayName || id;
  const nodes: TipTapNode[] = [];
  nodes.push(paragraph(`A ${recipe.skill} recipe producing ${recipe.outputItemId}.`));

  if (recipe.materials && recipe.materials.length > 0) {
    nodes.push(heading(2, "Materials"));
    nodes.push(bulletList(recipe.materials.map((m) => `${m.quantity}× ${m.itemId}`)));
  }

  const bits: string[] = [];
  if (recipe.skillRequired !== undefined) bits.push(`Skill required: ${recipe.skillRequired}`);
  if (recipe.levelRequired !== undefined) bits.push(`Level required: ${recipe.levelRequired}`);
  if (recipe.station) bits.push(`Station: ${recipe.station}`);
  if (bits.length > 0) {
    nodes.push(heading(2, "Requirements"));
    nodes.push(bulletList(bits));
  }

  return {
    loreId: makeLoreId("recipe", title, zoneId),
    title,
    template: DEFAULT_TEMPLATE_BY_KIND.recipe,
    fields: {},
    content: buildDoc(nodes),
    source: { kind: "recipe", sourceId: id, zoneId },
  };
}

function convertGatheringNode(id: string, node: GatheringNodeFile, zoneId: string): Omit<WorldbuilderCandidate, "existingArticleId" | "selected"> {
  const title = node.displayName || id;
  const nodes: TipTapNode[] = [];
  nodes.push(paragraph(`A ${node.skill} gathering node located in ${node.room}.`));

  if (node.yields && node.yields.length > 0) {
    nodes.push(heading(2, "Yields"));
    nodes.push(
      bulletList(
        node.yields.map((y) => {
          const qty =
            y.minQuantity !== undefined || y.maxQuantity !== undefined
              ? ` (${y.minQuantity ?? 1}–${y.maxQuantity ?? y.minQuantity ?? 1})`
              : "";
          return `${y.itemId}${qty}`;
        }),
      ),
    );
  }
  if (node.rareYields && node.rareYields.length > 0) {
    nodes.push(heading(2, "Rare yields"));
    nodes.push(
      bulletList(
        node.rareYields.map((y) => `${y.itemId} (${Math.round(y.dropChance * 100)}% chance)`),
      ),
    );
  }

  const resources: string[] = [];
  for (const y of node.yields ?? []) resources.push(y.itemId);

  return {
    loreId: makeLoreId("gatheringNode", title, zoneId),
    title,
    template: DEFAULT_TEMPLATE_BY_KIND.gatheringNode,
    fields: {
      locationType: "wilderness",
      resources,
    },
    content: buildDoc(nodes),
    source: { kind: "gatheringNode", sourceId: id, zoneId },
  };
}

// ─── Candidate builder ───────────────────────────────────────────

/**
 * Walk the selection and produce a flat list of import candidates, annotated
 * with existing-article matches from the current lore articles.
 */
export function buildCandidates(
  config: AppConfig | null,
  zones: Map<string, ZoneState>,
  selection: WorldbuilderSelection,
  articles: Record<string, Article>,
): WorldbuilderCandidate[] {
  const out: WorldbuilderCandidate[] = [];
  const push = (
    base: Omit<WorldbuilderCandidate, "existingArticleId" | "selected">,
  ) => {
    const existingArticleId = findExistingBySourceRef(articles, base.source);
    out.push({ ...base, existingArticleId, selected: existingArticleId === null });
  };

  if (config) {
    if (selection.config.race) {
      for (const [id, race] of Object.entries(config.races ?? {})) {
        push(convertRace(id, race));
      }
    }
    if (selection.config.class) {
      for (const [id, cls] of Object.entries(config.classes ?? {})) {
        push(convertClass(id, cls));
      }
    }
    if (selection.config.ability) {
      for (const [id, ability] of Object.entries(config.abilities ?? {})) {
        push(convertAbility(id, ability));
      }
    }
    if (selection.config.statusEffect) {
      for (const [id, se] of Object.entries(config.statusEffects ?? {})) {
        push(convertStatusEffect(id, se));
      }
    }
    if (selection.config.pet) {
      for (const [id, pet] of Object.entries(config.pets ?? {})) {
        push(convertPet(id, pet));
      }
    }
  }

  for (const [zoneId, zoneState] of zones.entries()) {
    const zoneSel = selection.zones[zoneId];
    if (!zoneSel) continue;
    const data: WorldFile = zoneState.data;

    if (zoneSel.mob) {
      for (const [id, mob] of Object.entries(data.mobs ?? {})) {
        push(convertMob(id, mob, zoneId));
      }
    }
    if (zoneSel.item) {
      for (const [id, item] of Object.entries(data.items ?? {})) {
        push(convertItem(id, item, zoneId));
      }
    }
    if (zoneSel.shop) {
      for (const [id, shop] of Object.entries(data.shops ?? {})) {
        push(convertShop(id, shop, zoneId));
      }
    }
    if (zoneSel.quest) {
      for (const [id, quest] of Object.entries(data.quests ?? {})) {
        push(convertQuest(id, quest, zoneId));
      }
    }
    if (zoneSel.recipe) {
      for (const [id, recipe] of Object.entries(data.recipes ?? {})) {
        push(convertRecipe(id, recipe, zoneId));
      }
    }
    if (zoneSel.gatheringNode) {
      for (const [id, node] of Object.entries(data.gatheringNodes ?? {})) {
        push(convertGatheringNode(id, node, zoneId));
      }
    }
  }

  return out;
}

// ─── Article materialization ─────────────────────────────────────

/**
 * Turn a candidate into an Article ready to be persisted via loreStore.createArticle.
 * Merges source-tracking fields into the candidate's fields.
 */
export function candidateToArticle(c: WorldbuilderCandidate, loreId: string): Article {
  const now = new Date().toISOString();
  return {
    id: loreId,
    template: c.template,
    title: c.title,
    fields: { ...c.fields, ...sourceFields(c.source) },
    content: c.content,
    draft: true,
    createdAt: now,
    updatedAt: now,
  };
}

/** Generate a lore id that doesn't collide with existing ones, preferring the candidate's default. */
export function uniqueLoreId(
  preferred: string,
  used: Set<string>,
): string {
  if (!used.has(preferred)) return preferred;
  let suffix = 2;
  while (used.has(`${preferred}_${suffix}`)) suffix++;
  return `${preferred}_${suffix}`;
}
