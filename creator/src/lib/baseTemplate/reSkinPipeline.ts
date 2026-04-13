import type { WorldFile } from "@/types/world";
import type {
  ClassDefinitionConfig,
  AbilityDefinitionConfig,
  StatusEffectDefinitionConfig,
  RaceDefinitionConfig,
  PetDefinitionConfig,
} from "@/types/config";
import { invoke } from "@tauri-apps/api/core";
import {
  BASE_ACADEMY_ZONE,
} from "./baseZone";
import {
  BASE_CLASSES,
  BASE_ABILITIES,
  BASE_STATUS_EFFECTS,
  BASE_RACES,
  BASE_PETS,
} from "./baseConfig";

// ─── Public types ─────────────────────────────────────────────────

export interface ReSkinProgress {
  classesAndAbilities: "pending" | "done" | "failed";
  races: "pending" | "done" | "failed";
  rooms: "pending" | "done" | "failed";
  entities: "pending" | "done" | "failed";
  artStyle: "pending" | "done" | "failed";
  worldLore: "pending" | "done" | "failed";
}

export interface ReSkinResults {
  zone: WorldFile;
  classes: Record<string, ClassDefinitionConfig>;
  abilities: Record<string, AbilityDefinitionConfig>;
  statusEffects: Record<string, StatusEffectDefinitionConfig>;
  races: Record<string, RaceDefinitionConfig>;
  pets: Record<string, PetDefinitionConfig>;
  artStyle: {
    name: string;
    basePrompt: string;
    surfaces?: { worldbuilding?: string; lore?: string };
  };
  academyName: string;
}

// ─── Helpers ──────────────────────────────────────────────────────

function extractJson(raw: string): unknown {
  // Try markdown code fence first
  const fenced = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenced) {
    return JSON.parse(fenced[1]!.trim());
  }

  // Try raw parse
  try {
    return JSON.parse(raw.trim());
  } catch {
    // Model may have added text around the JSON — find the outermost { }
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
    throw new Error(`Could not find JSON in LLM response (${raw.length} chars): ${raw.slice(0, 200)}...`);
  }
}

function deepClone<T>(obj: T): T {
  return structuredClone(obj);
}

function llm(systemPrompt: string, userPrompt: string, maxTokens = 4096): Promise<string> {
  // DeepSeek V3.2 generates ~25-50 tok/s. A 6K-token response at
  // 25 tok/s takes ~240s. Give 5 minutes so large calls can finish.
  const call = invoke<string>("llm_complete", { systemPrompt, userPrompt, maxTokens });
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("LLM call timed out")), 300_000),
  );
  return Promise.race([call, timeout]);
}

// ─── Input builders ───────────────────────────────────────────────
// Only send text fields the LLM needs to re-skin — omit mechanical values.

function buildClassesInput() {
  const out: Record<string, { displayName: string; description: string; backstory: string; outfitDescription: string }> = {};
  for (const [id, c] of Object.entries(BASE_CLASSES)) {
    out[id] = {
      displayName: c.displayName,
      description: c.description ?? "",
      backstory: c.backstory ?? "",
      outfitDescription: c.outfitDescription ?? "",
    };
  }
  return out;
}

function buildAbilitiesInput() {
  const out: Record<string, { displayName: string; description: string; requiredClass: string }> = {};
  for (const [id, a] of Object.entries(BASE_ABILITIES)) {
    out[id] = {
      displayName: a.displayName,
      description: a.description ?? "",
      requiredClass: a.requiredClass ?? "",
    };
  }
  return out;
}

function buildRacesInput() {
  const out: Record<string, { displayName: string; description: string; backstory: string; traits: string[]; bodyDescription: string }> = {};
  for (const [id, r] of Object.entries(BASE_RACES)) {
    out[id] = {
      displayName: r.displayName,
      description: r.description ?? "",
      backstory: r.backstory ?? "",
      traits: r.traits ?? [],
      bodyDescription: r.bodyDescription ?? "",
    };
  }
  return out;
}

function buildRoomsInput(): Record<string, { title: string; description: string }> {
  const out: Record<string, { title: string; description: string }> = {};
  for (const [id, room] of Object.entries(BASE_ACADEMY_ZONE.rooms)) {
    if (id === "mob_templates") continue;
    out[id] = { title: room.title, description: room.description };
  }
  return out;
}

interface MobTextInput {
  name: string;
  role?: string;
  category?: string;
}

interface ItemTextInput {
  displayName: string;
  description: string;
  keyword: string;
}

function buildEntitiesInput() {
  const mobs: Record<string, MobTextInput> = {};
  const baseMobs = BASE_ACADEMY_ZONE.mobs ?? {};
  const roleMap: Record<string, string> = {
    headmaster_aldric: "Headmaster NPC, quest giver",
    scholar_elara: "Scholar NPC, lore teacher",
    quartermaster_bren: "Shopkeeper NPC",
    instructor_valence: "Combat instructor NPC",
    groundskeeper_thorne: "Groundskeeper NPC, quest giver",
    puzzlewright: "Riddle gargoyle NPC",
    artificer_wren: "Crafting instructor NPC",
    stylist_maren: "Stylist NPC",
  };
  for (const [id, mob] of Object.entries(baseMobs)) {
    mobs[id] = {
      name: mob.name,
      ...(roleMap[id] ? { role: roleMap[id] } : { category: mob.category ?? "creature" }),
    };
  }

  const items: Record<string, ItemTextInput> = {};
  const baseItems = BASE_ACADEMY_ZONE.items ?? {};
  for (const [id, item] of Object.entries(baseItems)) {
    items[id] = {
      displayName: item.displayName,
      description: item.description ?? "",
      keyword: item.keyword ?? "",
    };
  }

  const shops: Record<string, { name: string }> = {};
  const baseShops = BASE_ACADEMY_ZONE.shops ?? {};
  for (const [id, shop] of Object.entries(baseShops)) {
    shops[id] = { name: shop.name };
  }

  const quests: Record<string, { name: string; description: string }> = {};
  const baseQuests = BASE_ACADEMY_ZONE.quests ?? {};
  for (const [id, quest] of Object.entries(baseQuests)) {
    quests[id] = { name: quest.name, description: quest.description ?? "" };
  }

  const pets: Record<string, { name: string; description: string }> = {};
  for (const [id, pet] of Object.entries(BASE_PETS)) {
    pets[id] = { name: pet.name, description: pet.description ?? "" };
  }

  return { mobs, items, shops, quests, pets };
}

// ─── System prompts ───────────────────────────────────────────────

function classesSystemPrompt(seedPrompt: string): string {
  return `You are a creative writer re-skinning game content for a themed MUD (text-based RPG). Your task is to take the base classes and abilities and transform their names, descriptions, backstories, and outfit descriptions to match a specific world theme, while keeping all mechanical game values (damage, HP, mana costs, cooldowns, levels, stat references) completely unchanged.

WORLD THEME:
${seedPrompt}

INSTRUCTIONS:
- Re-skin each class: change displayName, description, backstory, and outfitDescription to fit the theme.
- Re-skin each ability: change displayName and description to fit the theme.
- Backstories should be 1 short paragraph (3-5 sentences) explaining where this archetype comes from in the themed world. Keep it concise.
- Outfit descriptions should be vivid, specific, and visually distinctive — they are used to generate character art.
- Ability descriptions should be concise (1-2 sentences) and evocative.
- Maintain the same mechanical role for each class (tank, DPS caster, healer, stealth DPS, pet summoner).
- Abilities must still clearly convey their mechanical function (damage, heal, stun, shield, taunt, summon, etc.) even with new names.
- The requiredClass field in the response should use the ORIGINAL class key (WARRIOR, MAGE, etc.), not the re-skinned name.
- Return ONLY valid JSON. Do not include any explanation, commentary, or markdown formatting outside the JSON object.`;
}

function racesSystemPrompt(seedPrompt: string): string {
  return `You are a creative writer re-skinning game content for a themed MUD (text-based RPG). Your task is to take the base playable races and transform their names, descriptions, backstories, physical descriptions, and traits to match a specific world theme, while keeping all mechanical values (stat modifiers) completely unchanged.

WORLD THEME:
${seedPrompt}

INSTRUCTIONS:
- Re-skin each race: change displayName, description, backstory, traits, and bodyDescription.
- The re-skinned races should fill the same narrative niche as the originals: HUMAN is the versatile generalist, SYLVAN is the agile/magical archetype, STONEHEART is the tough/resilient archetype.
- Backstories should be 1 short paragraph (3-5 sentences) rooted in the theme. Keep it concise.
- Traits should be 2-3 short trait names (single words or two-word phrases) that capture the race's identity in the themed world.
- bodyDescription should be a detailed physical description suitable for generating character art — skin, build, features, hair, eyes, distinguishing marks.
- Return ONLY valid JSON. Do not include any explanation, commentary, or markdown formatting outside the JSON object.`;
}

function roomsSystemPrompt(seedPrompt: string): string {
  return `You are a creative writer re-skinning room descriptions for a themed MUD (text-based RPG). Your task is to rewrite room titles and descriptions to match a specific world theme while preserving the tutorial/instructional text that teaches players how to play the game.

WORLD THEME:
${seedPrompt}

INSTRUCTIONS:
- The zone is a tutorial academy/school for new players. Re-imagine it as the themed equivalent (e.g., a hidden dojo, a space station training deck, a druid's grove, etc.).
- Rewrite each room's title and description to fit the theme.
- CRITICAL: Each room description contains tutorial instructions inside quoted text (signs, plaques, notices, manuals). You MUST preserve the exact instructional content of these quoted passages — the UI panel names, gameplay mechanics, and feature explanations must remain accurate. Rephrase the framing (e.g., "a bronze plaque" becomes "a holographic display") but keep the actual instructions intact.
- Room descriptions should be 2-3 paragraphs: atmospheric description, then the tutorial text in a themed container.
- Provide a "zoneName" field with a thematic name for the academy zone as a whole.
- Do not include the room "mob_templates" — skip it entirely.
- Return ONLY valid JSON. Do not include any explanation, commentary, or markdown formatting outside the JSON object.`;
}

function entitiesSystemPrompt(seedPrompt: string): string {
  return `You are a creative writer re-skinning game entity names for a themed MUD (text-based RPG). Transform names and short descriptions to match the theme.

WORLD THEME:
${seedPrompt}

INSTRUCTIONS:
- For each mob: provide a re-skinned "name" that fits the theme and the mob's role.
- For each item: provide a re-skinned "displayName", "description" (1 sentence), and "keyword" (single word).
- For each shop: provide a re-skinned "name".
- For each quest: provide a re-skinned "name" and "description" (1-2 sentences).
- For each pet: provide a re-skinned "name" and "description" (1 sentence).
- Return ONLY valid JSON. No explanation or markdown.`;
}

function artStyleSystemPrompt(seedPrompt: string): string {
  return `You are a creative director defining a visual art style for a themed game world. Your task is to generate a comprehensive art style definition that will be used to generate all images (character portraits, room backgrounds, item icons, creature illustrations) for this world.

WORLD THEME:
${seedPrompt}

INSTRUCTIONS:
- Create a "name" — a short, evocative name for the art style (2-4 words).
- Create a "basePrompt" — a detailed description (100-200 words) of the visual aesthetic. This text is appended to every image generation prompt, so it should describe: color palette, lighting style, texture qualities, artistic medium/influence, mood, level of detail, and any distinctive visual motifs. Be specific — "warm candlelit tones" is better than "warm colors."
- Optionally create "surfaces" with overrides:
  - "worldbuilding": additional context for game sprites, room backgrounds, and UI elements (50-100 words)
  - "lore": additional context for portrait illustrations and lore article images (50-100 words)
- The style should be coherent, distinctive, and well-suited to the world theme. Avoid generic descriptions — lean into the specific aesthetic of this world.
- Return ONLY valid JSON. Do not include any explanation, commentary, or markdown formatting outside the JSON object.`;
}

// ─── Merge functions ──────────────────────────────────────────────

function mergeClasses(
  base: Record<string, ClassDefinitionConfig>,
  skinned: Record<string, { displayName?: string; description?: string; backstory?: string; outfitDescription?: string }>,
): Record<string, ClassDefinitionConfig> {
  const result = deepClone(base);
  for (const [id, overrides] of Object.entries(skinned)) {
    if (result[id]) {
      if (overrides.displayName) result[id].displayName = overrides.displayName;
      if (overrides.description) result[id].description = overrides.description;
      if (overrides.backstory) result[id].backstory = overrides.backstory;
      if (overrides.outfitDescription) result[id].outfitDescription = overrides.outfitDescription;
    }
  }
  return result;
}

function mergeAbilities(
  base: Record<string, AbilityDefinitionConfig>,
  skinned: Record<string, { displayName?: string; description?: string }>,
): Record<string, AbilityDefinitionConfig> {
  const result = deepClone(base);
  for (const [id, overrides] of Object.entries(skinned)) {
    if (result[id]) {
      if (overrides.displayName) result[id].displayName = overrides.displayName;
      if (overrides.description) result[id].description = overrides.description;
    }
  }
  return result;
}

function mergeRaces(
  base: Record<string, RaceDefinitionConfig>,
  skinned: Record<string, { displayName?: string; description?: string; backstory?: string; traits?: string[]; bodyDescription?: string }>,
): Record<string, RaceDefinitionConfig> {
  const result = deepClone(base);
  for (const [id, overrides] of Object.entries(skinned)) {
    if (result[id]) {
      if (overrides.displayName) result[id].displayName = overrides.displayName;
      if (overrides.description) result[id].description = overrides.description;
      if (overrides.backstory) result[id].backstory = overrides.backstory;
      if (overrides.traits) result[id].traits = overrides.traits;
      if (overrides.bodyDescription) result[id].bodyDescription = overrides.bodyDescription;
    }
  }
  return result;
}

function mergePets(
  base: Record<string, PetDefinitionConfig>,
  skinned: Record<string, { name?: string; description?: string }>,
): Record<string, PetDefinitionConfig> {
  const result = deepClone(base);
  for (const [id, overrides] of Object.entries(skinned)) {
    if (result[id]) {
      if (overrides.name) result[id].name = overrides.name;
      if (overrides.description) result[id].description = overrides.description;
    }
  }
  return result;
}

function mergeZone(
  base: WorldFile,
  roomsSkinned: Record<string, { title?: string; description?: string }> | undefined,
  entitiesSkinned: {
    mobs?: Record<string, { name?: string }>;
    items?: Record<string, { displayName?: string; description?: string; keyword?: string }>;
    shops?: Record<string, { name?: string }>;
    quests?: Record<string, { name?: string; description?: string }>;
  } | undefined,
): WorldFile {
  const result = deepClone(base);

  if (roomsSkinned) {
    for (const [id, overrides] of Object.entries(roomsSkinned)) {
      if (result.rooms[id]) {
        if (overrides.title) result.rooms[id].title = overrides.title;
        if (overrides.description) result.rooms[id].description = overrides.description;
      }
    }
  }

  if (entitiesSkinned?.mobs && result.mobs) {
    for (const [id, overrides] of Object.entries(entitiesSkinned.mobs)) {
      if (result.mobs[id]) {
        if (overrides.name) result.mobs[id].name = overrides.name;
      }
    }
  }

  if (entitiesSkinned?.items && result.items) {
    for (const [id, overrides] of Object.entries(entitiesSkinned.items)) {
      if (result.items[id]) {
        if (overrides.displayName) result.items[id].displayName = overrides.displayName;
        if (overrides.description) result.items[id].description = overrides.description;
        if (overrides.keyword) {
          result.items[id].keyword = overrides.keyword;
        }
      }
    }
  }

  if (entitiesSkinned?.shops && result.shops) {
    for (const [id, overrides] of Object.entries(entitiesSkinned.shops)) {
      if (result.shops[id]) {
        if (overrides.name) result.shops[id].name = overrides.name;
      }
    }
  }

  if (entitiesSkinned?.quests && result.quests) {
    for (const [id, overrides] of Object.entries(entitiesSkinned.quests)) {
      if (result.quests[id]) {
        if (overrides.name) result.quests[id].name = overrides.name;
        if (overrides.description) result.quests[id].description = overrides.description;
      }
    }
  }

  return result;
}

// ─── Pipeline ─────────────────────────────────────────────────────

export async function startReSkin(
  seedPrompt: string,
  onProgress: (progress: ReSkinProgress) => void,
): Promise<ReSkinResults> {
  const progress: ReSkinProgress = {
    classesAndAbilities: "pending",
    races: "pending",
    rooms: "pending",
    entities: "pending",
    artStyle: "pending",
    worldLore: "pending",
  };

  const report = () => onProgress({ ...progress });

  // Fallback results from base template
  let skinnedClasses = deepClone(BASE_CLASSES);
  let skinnedAbilities = deepClone(BASE_ABILITIES);
  let skinnedRaces = deepClone(BASE_RACES);
  let skinnedPets = deepClone(BASE_PETS);
  let roomsSkinned: Record<string, { title?: string; description?: string }> | undefined;
  let entitiesSkinned: {
    mobs?: Record<string, { name?: string }>;
    items?: Record<string, { displayName?: string; description?: string; keyword?: string }>;
    shops?: Record<string, { name?: string }>;
    quests?: Record<string, { name?: string; description?: string }>;
  } | undefined;
  let artStyleResult: ReSkinResults["artStyle"] = {
    name: "Classic Fantasy",
    basePrompt: "Rich oil painting aesthetic with warm candlelit tones, detailed medieval textures, and dramatic chiaroscuro lighting.",
  };
  let zoneName = "";

  // Wrap each call so parse failures log the raw response for debugging.
  async function callAndParse<T>(label: string, systemPrompt: string, userPrompt: string, maxTokens: number): Promise<T> {
    const raw = await llm(systemPrompt, userPrompt, maxTokens);
    try {
      return extractJson(raw) as T;
    } catch (e) {
      console.error(`Re-skin [${label}] JSON parse failed. Raw response (first 500 chars):`, raw.slice(0, 500));
      throw e;
    }
  }

  // Fire all 5 calls in parallel
  const [classesResult, racesResult, roomsResult, entitiesResult, artResult] = await Promise.allSettled([
    callAndParse<{
      classes?: Record<string, { displayName?: string; description?: string; backstory?: string; outfitDescription?: string }>;
      abilities?: Record<string, { displayName?: string; description?: string }>;
    }>("classes+abilities", classesSystemPrompt(seedPrompt), JSON.stringify({
      classes: buildClassesInput(),
      abilities: buildAbilitiesInput(),
    }), 4096),

    callAndParse<{
      races?: Record<string, { displayName?: string; description?: string; backstory?: string; traits?: string[]; bodyDescription?: string }>;
    }>("races", racesSystemPrompt(seedPrompt), JSON.stringify({ races: buildRacesInput() }), 4096),

    callAndParse<{
      zoneName?: string;
      rooms?: Record<string, { title?: string; description?: string }>;
    }>("rooms", roomsSystemPrompt(seedPrompt), JSON.stringify({ rooms: buildRoomsInput() }), 8192),

    callAndParse<{
      mobs?: Record<string, { name?: string }>;
      items?: Record<string, { displayName?: string; description?: string; keyword?: string }>;
      shops?: Record<string, { name?: string }>;
      quests?: Record<string, { name?: string; description?: string }>;
      pets?: Record<string, { name?: string; description?: string }>;
    }>("entities", entitiesSystemPrompt(seedPrompt), JSON.stringify(buildEntitiesInput()), 4096),

    callAndParse<{
      name?: string;
      basePrompt?: string;
      surfaces?: { worldbuilding?: string; lore?: string };
    }>("art-style", artStyleSystemPrompt(seedPrompt), "Generate an art style definition for this world theme.", 1024),
  ]);

  // ── Process Call 1: Classes + Abilities ────────────────────────────
  if (classesResult.status === "fulfilled") {
    try {
      const data = classesResult.value;
      if (data.classes) {
        skinnedClasses = mergeClasses(BASE_CLASSES, data.classes);
      }
      if (data.abilities) {
        skinnedAbilities = mergeAbilities(BASE_ABILITIES, data.abilities);
      }
      progress.classesAndAbilities = "done";
    } catch (e) {
      console.warn("Re-skin: classes/abilities merge failed, using base template", e);
      progress.classesAndAbilities = "failed";
    }
  } else {
    console.warn("Re-skin: classes/abilities LLM call failed", classesResult.reason);
    progress.classesAndAbilities = "failed";
  }
  report();

  // ── Process Call 2: Races ─────────────────────────────────────────
  if (racesResult.status === "fulfilled") {
    try {
      const data = racesResult.value;
      if (data.races) {
        skinnedRaces = mergeRaces(BASE_RACES, data.races);
      }
      progress.races = "done";
    } catch (e) {
      console.warn("Re-skin: races merge failed, using base template", e);
      progress.races = "failed";
    }
  } else {
    console.warn("Re-skin: races LLM call failed", racesResult.reason);
    progress.races = "failed";
  }
  report();

  // ── Process Call 3: Zone Rooms ────────────────────────────────────
  if (roomsResult.status === "fulfilled") {
    try {
      const data = roomsResult.value;
      roomsSkinned = data.rooms;
      zoneName = data.zoneName ?? "";
      progress.rooms = "done";
    } catch (e) {
      console.warn("Re-skin: rooms merge failed, using base template", e);
      progress.rooms = "failed";
    }
  } else {
    console.warn("Re-skin: rooms LLM call failed", roomsResult.reason);
    progress.rooms = "failed";
  }
  report();

  // ── Process Call 4: Entities ──────────────────────────────────────
  if (entitiesResult.status === "fulfilled") {
    try {
      const data = entitiesResult.value;
      entitiesSkinned = {
        mobs: data.mobs,
        items: data.items,
        shops: data.shops,
        quests: data.quests,
      };
      if (data.pets) {
        skinnedPets = mergePets(BASE_PETS, data.pets);
      }
      progress.entities = "done";
    } catch (e) {
      console.warn("Re-skin: entities merge failed, using base template", e);
      progress.entities = "failed";
    }
  } else {
    console.warn("Re-skin: entities LLM call failed", entitiesResult.reason);
    progress.entities = "failed";
  }
  report();

  // ── Process Call 5: Art Style ─────────────────────────────────────
  if (artResult.status === "fulfilled") {
    try {
      const data = artResult.value;
      if (data.name && data.basePrompt) {
        artStyleResult = {
          name: data.name,
          basePrompt: data.basePrompt,
          surfaces: data.surfaces,
        };
      }
      progress.artStyle = "done";
    } catch (e) {
      console.warn("Re-skin: art style merge failed, using default", e);
      progress.artStyle = "failed";
    }
  } else {
    console.warn("Re-skin: art style LLM call failed", artResult.reason);
    progress.artStyle = "failed";
  }
  report();

  // ── Assemble final zone ───────────────────────────────────────────
  const zone = mergeZone(BASE_ACADEMY_ZONE, roomsSkinned, entitiesSkinned);

  // Derive academy name from zoneName or the re-skinned gate room title
  let academyName = zoneName;
  if (!academyName && roomsSkinned?.academy_gates?.title) {
    academyName = roomsSkinned.academy_gates.title;
  }
  if (!academyName) {
    academyName = "The Academy";
  }

  return {
    zone,
    classes: skinnedClasses,
    abilities: skinnedAbilities,
    statusEffects: deepClone(BASE_STATUS_EFFECTS),
    races: skinnedRaces,
    pets: skinnedPets,
    artStyle: artStyleResult,
    academyName,
  };
}
