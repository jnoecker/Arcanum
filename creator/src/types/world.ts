/**
 * Dynamic stat map: stat ID -> numeric value.
 *
 * Two flavors of key are accepted:
 *
 * - **Concrete** stat IDs (lowercase by convention, e.g. `strength`,
 *   `dexterity`) must be defined in `application.yaml::stats.definitions`.
 *   These apply uniformly to anyone wearing the item.
 *
 * - **Archetypal** stat IDs ({@link ARCHETYPAL_STATS}) are uppercase placeholders
 *   that resolve at equip time against the wearer's active class
 *   `statPriorities`:
 *     PRIMARY   → statPriorities[0]
 *     SECONDARY → statPriorities[1]
 *     TERTIARY  → statPriorities[2]
 *
 *   Items can mix both — `{ PRIMARY: 3, dexterity: 1 }` gives flat DEX to
 *   everyone plus 3 to the wearer's primary stat. When the active class has
 *   no priority slot for the archetypal key, the server silently drops it.
 */
export type StatMap = Record<string, number>;

/** Archetypal stat keys that resolve to a concrete stat at equip time
 *  via the wearer's class `statPriorities`. */
export const ARCHETYPAL_STATS = ["PRIMARY", "SECONDARY", "TERTIARY"] as const;
export type ArchetypalStat = (typeof ARCHETYPAL_STATS)[number];

/** True if `key` is one of `PRIMARY`/`SECONDARY`/`TERTIARY`. */
export function isArchetypalStat(key: string): key is ArchetypalStat {
  return (ARCHETYPAL_STATS as readonly string[]).includes(key);
}

// ─── Zone-level types (mirror world-yaml-dtos) ──────────────────────

/**
 * Controls how the engine resolves mob and quest levels at runtime.
 * - "static" — author-authored levels are used verbatim (default).
 * - "bounded" — content scales to the highest-level player in the zone,
 *   clamped to `levelRange`. Keeps progression gates intact while letting
 *   mixed-level parties play the same zone.
 * - "player" — content tracks the reference player's level directly,
 *   no bounds. Intended for tutorial zones and endgame social hubs.
 */
export type ScalingMode = "static" | "bounded" | "player";

export interface ZoneScaling {
  mode: ScalingMode;
  /** Inclusive [min, max] band. Required when mode is "bounded"; ignored otherwise. */
  levelRange?: [number, number];
}

export interface WorldFile {
  zone: string;
  lifespan?: number;
  startRoom: string;
  terrain?: string;
  graphical?: boolean;
  pvpEnabled?: boolean;
  /** Dynamic level-scaling config. Omit for static (authored levels) behaviour. */
  scaling?: ZoneScaling;
  /** Intended level range for this zone. Drives the Rebalance Zone feature. */
  levelBand?: { min: number; max: number };
  /** Intended difficulty profile — informs rebalance stat targets. */
  difficultyHint?: "casual" | "standard" | "challenging";
  /**
   * The zone's rectangle on the painted world map, in percent (0–100) of the
   * image from its top-left corner. Written by the Map overlay's "Publish to
   * Game" action; the MUD serves it to the web client's World Map atlas tab
   * via `World.Areas`.
   */
  worldMap?: { x: number; y: number; w: number; h: number };
  /** Controlling faction ID (references FactionConfig.definitions). Drives "hostile territory" reactions. */
  faction?: string;
  puzzles?: Record<string, PuzzleFile>;
  image?: ZoneImageDefaults;
  audio?: ZoneAudioDefaults;
  /** Zone intro cinematic — a content-addressed video filename the server
   *  resolves under the videos base URL. Auto-plays on a player's first entry
   *  to the zone and is replayable from the World Map. */
  video?: string;
  /** Prose vision narrated to text/screen-reader clients in place of the video.
   *  The server frames it as a vision ("a vision rises before your eyes…") and
   *  shows it verbatim as the transcript under the video in the web client.
   *  Valid without a `video` — that makes a text-only vision. */
  videoText?: string;
  /** Total seconds the text vision plays out over for text clients. With a block
   *  literal `videoText`, each line is revealed evenly across this window. Omit or
   *  ≤ 0 shows it all at once. Sensible default: the video's runtime. */
  videoTextSeconds?: number;
  rooms: Record<string, RoomFile>;
  mobs?: Record<string, MobFile>;
  items?: Record<string, ItemFile>;
  shops?: Record<string, ShopFile>;
  quests?: Record<string, QuestFile>;
  gatheringNodes?: Record<string, GatheringNodeFile>;
  recipes?: Record<string, RecipeFile>;
  dungeon?: DungeonFile;
}

/** Reputation gate: player must have `min ≤ rep ≤ max` with `faction` to use. */
export interface ReputationRequirement {
  faction: string;
  min?: number;
  max?: number;
}

export interface ZoneImageDefaults {
  room?: string;
  mob?: string;
  item?: string;
  zoneMap?: string;
}

export interface ZoneAudioDefaults {
  music?: string;
  ambient?: string;
}

export interface RoomFile {
  title: string;
  description: string;
  exits?: Record<string, string | ExitValue>;
  features?: Record<string, FeatureFile>;
  terrain?: string;
  station?: string;
  bank?: boolean;
  tavern?: boolean;
  dungeon?: boolean;
  auction?: boolean;
  stylist?: boolean;
  housingBroker?: boolean;
  /** True if this room is an inn. Players can `rest` here to set their recall point. */
  inn?: boolean;
  /** True if this room holds an Akathavae shrine. Enables the `pledge`/`renounce`
   *  commands for the pacifist explorer path. */
  akathavaeShrine?: boolean;
  /** True if this room has a flight master. Enables the `flights`/`fly`
   *  fast-travel commands and the in-world kiosk badge. */
  flightMaster?: boolean;
  /** Flight-map pin: percent across the Ambon flight map, 0 (left) to 100
   *  (right). Paired with {@link flightMapY}. The web client seats a griffin
   *  hotspot at this point. Leave both unset to keep the roost "unmapped" —
   *  it still works but is listed textually under the map instead of pinned.
   *  The server fails to load if either value is outside 0..100. */
  flightMapX?: number;
  /** Flight-map pin: percent down the Ambon flight map, 0 (top) to 100
   *  (bottom). See {@link flightMapX}. */
  flightMapY?: number;
  /** True if this room is a boat dock. Enables the `voyages`/`sail`
   *  fast-travel commands and the in-world harbor kiosk badge. Unlike a flight
   *  master, boat routes are authored (see {@link boatRoutes}) rather than
   *  discovered, and charge a flat author-set fare on every trip. */
  boatDock?: boolean;
  /** Boat-map pin: percent across the Ambon world map, 0 (left) to 100
   *  (right). Paired with {@link boatMapY}. Shares the flight map by default
   *  (`boat_map` global asset). Doubles as the destination pin for any route
   *  whose `to` is this room. Leave both unset to keep the dock "unmapped" —
   *  it still works but is listed textually instead of pinned. Only meaningful
   *  when {@link boatDock} is true; the server fails to load if either value is
   *  outside 0..100. */
  boatMapX?: number;
  /** Boat-map pin: percent down the Ambon world map, 0 (top) to 100
   *  (bottom). See {@link boatMapX}. */
  boatMapY?: number;
  /** Authored boat passages leaving this dock — the fixed routes players can
   *  buy. Each is a flat author-set fare to a destination room. Only meaningful
   *  when {@link boatDock} is true. */
  boatRoutes?: BoatRouteFile[];
  image?: string;
  video?: string;
  /** Prose vision narrated to text/screen-reader clients in place of the video.
   *  Valid without a `video` — that makes a text-only vision. */
  videoText?: string;
  /** Seconds the text vision plays out over; lines of a block literal reveal
   *  evenly across this window. Omit or ≤ 0 shows it all at once. */
  videoTextSeconds?: number;
  music?: string;
  ambient?: string;
  /** Bare song list — non-empty means the room has a jukebox. */
  jukebox?: JukeboxSongFile[];
  /** A single song — present means the room has a music box (a free, player-scoped
   *  one-song miniature of the jukebox). */
  musicBox?: MusicBoxFile;
  /** Explicit minimap grid pin (server contract, AmbonMUD #1401): integer grid
   *  column within the zone's own frame, +x = east. Written for every room by
   *  the zone editor's "Save Layout"; the server seats pinned rooms exactly
   *  here and BFS-places unpinned rooms around them. Must be paired with
   *  {@link mapY} — the server fails to load a half-specified pin, and fails if
   *  two rooms in one zone share a cell on the same floor. */
  mapX?: number;
  /** Explicit minimap grid pin: integer grid row, +y = south. See {@link mapX}. */
  mapY?: number;
  /** Minimap floor for the pin: 0 = ground, positive = upstairs. Only valid
   *  alongside {@link mapX}/{@link mapY}; defaults to 0 when omitted. */
  mapZ?: number;
  /** Legacy Arcanum-only alias; stripped on output. */
  audio?: string;
}

/** Server contract (AmbonMUD #1316). `title` and `durationSeconds` are
 *  required by the server loader but optional here because in-editor
 *  entries are bare `{ file }` refs until save-time enrichment. */
export interface JukeboxSongFile {
  title?: string;
  file: string;
  durationSeconds?: number;
  cost?: number;
  artist?: string;
  description?: string;
  lyrics?: string[];
}

/** Server contract (AmbonMUD #1336). A room's one-song music box — like a
 *  {@link JukeboxSongFile} but always free (no `cost`). `title`/`durationSeconds`
 *  are required by the server loader but optional here until save-time enrichment. */
export interface MusicBoxFile {
  title?: string;
  file: string;
  durationSeconds?: number;
  artist?: string;
  description?: string;
  /** Optional art for the lyric-sheet keepsake minted on the first play
   *  (AmbonMUD #1341). An image filename resolved against the zone images base
   *  (like room/item art); omit to fall back to the client's generic item default. */
  image?: string;
  lyrics?: string[];
}

/**
 * One authored boat passage from a {@link RoomFile.boatDock}: a fixed
 * fast-travel route to {@link to} for a flat, author-set {@link price} in gold
 * (no distance scaling, paid each trip). `to` is a destination room id — local
 * (`room`) or cross-zone (`zone:room`), like an exit target. The destination's
 * world-map pin is read from the `to` room's own `boatMapX`/`boatMapY`.
 */
export interface BoatRouteFile {
  to: string;
  price: number;
}

export interface ExitValue {
  to: string;
  door?: DoorFile;
  /** Achievement ID the player must hold for the exit to be traversable. */
  requiresAchievement?: string;
  /** Shown when the player tries to take a gated exit they don't qualify for. */
  lockedMessage?: string;
}

export interface DoorFile {
  initialState?: string;
  keyItemId?: string;
  keyConsumed?: boolean;
  resetWithZone?: boolean;
  /**
   * Per-door respawn timer in seconds. When set, the door's state resets on
   * this individual cadence instead of waiting for the full zone reset. Blank
   * = only resets with the zone.
   */
  respawnSeconds?: number;
  /**
   * Door art (layered, procedurally animated — the "Warded Threshold"). The
   * leaf sprite swings on its hinge between closed (0°) and `openAngle`; the
   * static frame sprite is drawn behind it and never moves. The world-default
   * `door_lock` seal overlay renders on top while locked. All optional;
   * renderers fall back to `door_frame`/`door_leaf` globals, then a CSS card.
   */
  /** Static frame/portal sprite, drawn behind the leaf (optional). */
  frameImage?: string;
  /** Swinging leaf sprite, drawn closed in a neutral upright pose (optional). */
  leafImage?: string;
  /** Which edge the leaf is hinged on. Default "right". */
  hinge?: "left" | "right";
  /** Leaf rotation in degrees when the door is open. Closed is always 0. Default 60. */
  openAngle?: number;
  /**
   * Leaf size as a fraction (0..1) of the frame box, so the leaf sits inside
   * the frame's opening rather than overflowing it. Ornate frames have a small
   * central opening, so this is usually < 1. Default 0.76.
   */
  leafScale?: number;
  /**
   * Vertical placement of the leaf within the frame as a fraction (-1..1) of
   * the box; positive nudges down so the leaf rests on the threshold. Default 0.09.
   */
  leafOffsetY?: number;
  /** Legacy alias; normalized to `initialState` on output. */
  closed?: boolean;
  /** Legacy alias; normalized to `initialState` on output. */
  locked?: boolean;
  /** Legacy alias; normalized to `keyItemId` on output. */
  key?: string;
}

/** Room feature: container, lever, or sign. */
export interface FeatureFile {
  type: string; // "CONTAINER" | "LEVER" | "SIGN"
  displayName: string;
  keyword: string;
  /** "open" | "closed" | "locked" for CONTAINER; "up" | "down" for LEVER. */
  initialState?: string;
  keyItemId?: string;
  keyConsumed?: boolean;
  resetWithZone?: boolean;
  /**
   * Per-feature respawn timer in seconds. When set, the feature's state — and a
   * CONTAINER's contents — reset on this individual cadence instead of waiting
   * for the full zone reset. Blank = only resets with the zone. CONTAINER and
   * LEVER only.
   */
  respawnSeconds?: number;
  /** Initial item IDs inside a CONTAINER. */
  items?: string[];
  /** Text content for SIGN type. */
  text?: string;
  /**
   * Optional per-feature backdrop. Works on all three feature types
   * (CONTAINER / LEVER / SIGN). The web client renders this behind the
   * feature card — the container's contents list, the sign's text, or the
   * lever's plate+handle sit on top. Content-addressed filename, resolved
   * against the world image base. Resolution order per feature:
   * `backgroundImage` → `<type>_bg` global asset → polished CSS fallback.
   */
  backgroundImage?: string;
  /**
   * LEVER art (layered, procedurally animated). The handle sprite rotates
   * around `leverPivot` between `upAngle` and `downAngle`; the optional plate
   * sprite is drawn behind it and never moves. All LEVER-only; renderers fall
   * back to a built-in vector lever when `handleImage` is unset.
   */
  /** Static base/housing sprite filename, drawn behind the handle (optional). */
  plateImage?: string;
  /** Rotating handle sprite filename, drawn in a neutral upright pose (optional). */
  handleImage?: string;
  /** Pivot on the handle sprite as fractions [0..1] of its width/height. Default { x: 0.5, y: 0.94 }. */
  leverPivot?: { x: number; y: number };
  /** Handle rotation in degrees when the lever is "up" (ready). Default -28. */
  upAngle?: number;
  /** Handle rotation in degrees when the lever is "down" (pulled). Default 28. */
  downAngle?: number;
}

/**
 * Classifies what a mob is *for*, independent of how tough it is. Gates
 * which behaviours the engine exposes — combatants can be attacked and award
 * XP; vendors/quest-givers/dialog mobs surface their social affordances but
 * refuse combat; props are examine-only set dressing.
 */
export type MobRole = "combat" | "vendor" | "quest_giver" | "trainer" | "dialog" | "prop";

export const MOB_ROLES: MobRole[] = ["combat", "vendor", "quest_giver", "trainer", "dialog", "prop"];

export const MOB_ROLE_LABELS: Record<MobRole, string> = {
  combat: "Combat",
  vendor: "Vendor",
  quest_giver: "Quest Giver",
  trainer: "Trainer",
  dialog: "Dialog",
  prop: "Prop",
};

export const MOB_ROLE_DESCRIPTIONS: Record<MobRole, string> = {
  combat: "Can be attacked, fights back, awards XP and loot.",
  vendor: "Shopkeeper. Cannot be attacked.",
  quest_giver: "Offers and accepts quests. Cannot be attacked.",
  trainer: "Teaches class abilities. Marks each spawn room as a training room.",
  dialog: "Conversational NPC. Cannot be attacked.",
  prop: "Examine-only flavour entity. No interaction beyond look.",
};

/**
 * One placement of a mob template in the world. A mob can have multiple
 * spawn entries; each entry may produce `count` runtime instances. The
 * legacy single-room `room` field on `MobFile` is no longer authored —
 * loaders normalize it into `spawns: [{ room }]` on read.
 */
export interface SpawnEntry {
  room: string;
  count?: number;
}

/** Times of day a conditional mob may appear. Mirrors the server's `TimePeriod`. */
export type SpawnTimePeriod = "DAWN" | "DAY" | "DUSK" | "NIGHT";

/** Seasons a conditional mob may appear in. Mirrors the server's `Season`. */
export type SpawnSeason = "SPRING" | "SUMMER" | "AUTUMN" | "WINTER";

/**
 * Gates when a mob appears in the world. Facets are AND-ed together; values
 * within a facet are OR-ed. An omitted/empty facet means "any". A condition
 * whose facets are all empty and whose `chance` is 1.0 behaves like no
 * condition at all. Mirrors the server's `SpawnConditionFile`.
 */
export interface SpawnCondition {
  /** Times of day. Empty = any time. */
  time?: SpawnTimePeriod[];
  /** Weather type ids (e.g. CLEAR, RAIN, STORM). Empty = any weather. */
  weather?: string[];
  /** Seasons. Empty = any season. */
  seasons?: SpawnSeason[];
  /** World-event flags, any one of which activates the condition. Empty = none required. */
  events?: string[];
  /** Per-opportunity appearance probability (0.0–1.0). Defaults to 1.0. */
  chance?: number;
}

export interface MobFile {
  name: string;
  description?: string;
  /**
   * Where this mob template gets placed in the zone. New content always
   * uses `spawns`; the loader synthesizes a single-entry list for legacy
   * mobs that still have a top-level `room` shorthand, then drops `room`.
   */
  spawns?: SpawnEntry[];
  /** @deprecated Legacy single-room placement — loaders migrate to `spawns`. */
  room?: string;
  /**
   * What this mob is *for*. Omitted/missing defaults to "combat" to preserve
   * legacy behaviour. Non-combat roles refuse attack commands server-side.
   */
  role?: MobRole;
  tier?: string;
  level?: number;
  category?: string;
  hp?: number;
  minDamage?: number;
  maxDamage?: number;
  armor?: number;
  xpReward?: number;
  goldMin?: number;
  goldMax?: number;
  /**
   * Power-user multiplier on tier+level HP baseline. 1.0 = no change.
   * Authors typically use `toughness` instead, which writes through to all
   * four mults. Range (0, 10].
   */
  hpMult?: number;
  /** Power-user multiplier on tier+level damage baseline. */
  dmgMult?: number;
  /** Power-user multiplier on tier+level XP-reward baseline. */
  xpMult?: number;
  /** Power-user multiplier on tier+level gold baseline. */
  goldMult?: number;
  /**
   * Single-dial difficulty knob. Maps to all four mults at once. Arcanum-side
   * convenience: server only sees the resolved mults. Range -2 to +2.
   */
  toughness?: -2 | -1 | 0 | 1 | 2;
  drops?: MobDropFile[];
  respawnSeconds?: number;
  /**
   * Whether the server may spawn rare cosmetic variants of this mob (tint +
   * overlay + name prefix + modest stat bump). Defaults to true server-side;
   * set false to opt a mob out — e.g. unique named bosses or strictly-themed
   * creatures whose appearance should never be altered. Omit to keep the
   * default (true).
   */
  rareVariants?: boolean;
  /**
   * Optional spawn condition gating when this mob appears (time of day,
   * weather, season, world-event flags, and/or a random `chance`). When set to
   * a non-trivial condition, the mob is not placed at world start; its entire
   * spawn lifecycle is owned by the server's conditional spawn handler.
   */
  condition?: SpawnCondition;
  behavior?: BehaviorFile;
  dialogue?: Record<string, DialogueNodeFile>;
  quests?: string[];
  faction?: string;
  spells?: Record<string, MobSpellFile>;
  defaultAttack?: string;
  image?: string;
  video?: string;
  /** Prose vision narrated to text/screen-reader clients in place of the video.
   *  Valid without a `video` — that makes a text-only vision. */
  videoText?: string;
  /** Seconds the text vision plays out over; lines of a block literal reveal
   *  evenly across this window. Omit or ≤ 0 shows it all at once. */
  videoTextSeconds?: number;
  /**
   * When `role === "trainer"`, the class IDs this NPC teaches. One entry =
   * single-class trainer; two or more = multi-class trainer. Each spawn room
   * becomes a training room for these classes on save. Empty/missing on
   * non-trainer mobs.
   */
  trainerClasses?: string[];
}

export interface MobSpellFile {
  displayName: string;
  message: string;
  roomMessage?: string;
  minDamage?: number;
  maxDamage?: number;
  healMin?: number;
  healMax?: number;
  cooldownMs?: number;
  weight?: number;
  statusEffectId?: string;
}

export interface MobDropFile {
  itemId: string;
  chance: number;
}

export interface BehaviorFile {
  template?: string;
  params?: BehaviorParams;
  tree?: BtNodeFile;
}

export interface BehaviorParams {
  patrolRoute?: string[];
  fleeHpPercent?: number;
  aggroMessage?: string;
  fleeMessage?: string;
  maxWanderDistance?: number;
}

export type BtNodeType =
  | "selector" | "sequence" | "inverter" | "cooldown"
  | "is_in_combat" | "is_player_in_room" | "is_hp_below"
  | "stationary" | "aggro" | "flee" | "say" | "patrol" | "wander";

export interface BtNodeFile {
  type: BtNodeType;
  children?: BtNodeFile[];
  /** cooldown node: cooldown duration in ms */
  cooldownMs?: number;
  /** cooldown node: unique key for cooldown tracking */
  key?: string;
  /** is_hp_below node: HP threshold percent (default 20) */
  percent?: number;
  /** say node: message text */
  message?: string;
  /** patrol node: ordered list of room IDs */
  route?: string[];
  /** wander node: max rooms from origin (default 3) */
  maxDistance?: number;
}

/**
 * Broad server-assigned item category. When omitted, the server infers it from
 * slot / consumable / basePrice. `questItem: true` always resolves to "quest"
 * regardless of this field.
 *
 * `keepsake` is a souvenir category: soulbound like a quest item (cannot be
 * dropped, sold, traded, banked, or mailed) but shelved under its own
 * "Keepsakes" heading in the inventory rather than "Quest". The server mints
 * these automatically — e.g. a lyric sheet on the first play of a music-box
 * song — but they can also be authored by hand here.
 */
export type ItemType = "equipment" | "consumable" | "quest" | "treasure" | "keepsake" | "mount" | "misc";

export const ITEM_TYPES: readonly ItemType[] = [
  "equipment",
  "consumable",
  "quest",
  "treasure",
  "keepsake",
  "mount",
  "misc",
] as const;

export interface ItemFile {
  displayName: string;
  description?: string;
  keyword?: string;
  slot?: string;
  damage?: number;
  armor?: number;
  stats?: StatMap;
  consumable?: boolean;
  charges?: number;
  onUse?: ItemOnUse;
  room?: string;
  mob?: string;
  /**
   * Ground-item respawn timer in seconds. When this item is placed on the
   * ground (`room` set), it respawns this many seconds after being looted
   * instead of waiting for the full zone reset. Blank = only repops on zone
   * reset. Ignored for equipment, loot-table, and container-content items.
   */
  respawnSeconds?: number;
  matchByKey?: boolean;
  basePrice?: number;
  image?: string;
  video?: string;
  /** Prose vision narrated to text/screen-reader clients in place of the video.
   *  Valid without a `video` — that makes a text-only vision. */
  videoText?: string;
  /** Seconds the text vision plays out over; lines of a block literal reveal
   *  evenly across this window. Omit or ≤ 0 shows it all at once. */
  videoTextSeconds?: number;
  /**
   * Explicit server-side category. Leave unset to let the server infer from
   * other fields. Values are lowercase to match the server's `ItemType.label()`.
   */
  itemType?: ItemType;
  /**
   * Mount unlock id, required when `itemType` is "mount" and forbidden
   * otherwise. Buying the item never enters the inventory: the server records
   * this id on the character permanently, which unlocks the mount sprite
   * whose `{type: "mount", mountId}` requirement matches and enables map
   * fast travel.
   */
  mountId?: string;
  /**
   * Soulbound flag: quest items cannot be dropped, sold, traded, given, or
   * stored in containers. Always resolves to the "quest" category server-side.
   */
  questItem?: boolean;
  /**
   * When false, the item is fixed scenery — it can't be picked up, moved, or
   * removed from its room. Useful for flavor objects players can examine but
   * not loot. Server default is true; only persist when explicitly false.
   */
  takeable?: boolean;
  /** Intended player level. Drives the level multiplier in budget derivation. */
  level?: number;
  /** Rarity tier. Drives the tier multiplier in budget derivation. */
  tier?:
    | "trash"
    | "common"
    | "uncommon"
    | "rare"
    | "epic"
    | "legendary";
  /** Budget split: damage / armor / balanced / stat. Accessory slots force "stat". */
  archetype?: "damage" | "armor" | "balanced" | "stat";
  /** Primary stat: receives the largest share of the stat-budget. */
  primaryStat?: string;
  /** Secondary stat: receives the middle share of the stat-budget. */
  secondaryStat?: string;
  /** Tertiary stat: receives the smallest share of the stat-budget. */
  tertiaryStat?: string;
  /**
   * When true, the tertiary slot is dropped entirely and the stat budget is
   * split 60/40 between primary and secondary instead of the default 50/30/20.
   * Use for items that should only carry two stat bonuses.
   */
  disableTertiary?: boolean;
  /**
   * Class restriction. When non-empty, only players whose `playerClass` matches
   * one of these IDs can equip the item. Null/absent = unrestricted. Mirrors
   * AmbonMUD's `ItemFile.classes` field; the server's equip handler enforces
   * the wall. Loader normalizes entries to uppercase.
   */
  classes?: string[];
}

export interface ItemOnUse {
  healHp?: number;
  healMana?: number;
  grantXp?: number;
}

export interface ShopFile {
  name: string;
  room: string;
  items?: string[];
  image?: string;
  /** Rep gate. Shop refuses to trade when the requirement fails. */
  requiredReputation?: ReputationRequirement;
}

export interface QuestFile {
  name: string;
  description?: string;
  giver: string;
  completionType?: string;
  objectives?: QuestObjectiveFile[];
  rewards?: QuestRewardsFile;
  /** Rep gate. Giver will not offer the quest when the requirement fails. */
  requiredReputation?: ReputationRequirement;
  /**
   * Intended player level. When set, XP rewards are scaled by the same
   * diminishing-returns curve used for kills — players who have out-levelled
   * the quest receive reduced XP rather than the flat reward. Omit to keep
   * legacy flat-award behaviour.
   */
  level?: number;
  /**
   * Engine-driven difficulty tier. When set and `rewards.xp` is absent/0, the
   * engine computes XP from the progression config's quest baseline × the
   * tier's multiplier. An explicit positive `rewards.xp` always wins.
   */
  difficulty?: import("./config").QuestDifficulty;
  /**
   * Optional dialogue-flag gate. When set, the quest stays hidden from
   * `qoffers`, the canvas Quest indicator, and `accept` until the player has
   * the named flag in their dialogueFlags set. Flags are added by dialogue
   * choice actions of the form `unlock_flag:<name>` and are global strings,
   * so the unlocking conversation can be on any NPC in any zone.
   */
  requiresDialogueFlag?: string;
  /**
   * Optional override for the NPC that accepts turn-ins. Bare mob keyword
   * (e.g. `headmaster_aldric`); the loader qualifies it with the zone id.
   * Defaults to `giver` when null/empty.
   */
  turnInMob?: string;
}

export interface QuestObjectiveFile {
  type: string;
  targetKey: string;
  count?: number;
  description?: string;
}

export interface QuestRewardsFile {
  xp?: number;
  gold?: number;
  currencies?: Record<string, number>;
  /**
   * Items spawned into the player's inventory on quest completion. Each entry
   * is `{ itemId, count? }` where `itemId` is a bare ID for same-zone refs and
   * `zone:itemId` for cross-zone. `count` defaults to 1 server-side.
   */
  items?: QuestItemReward[];
}

export interface QuestItemReward {
  itemId: string;
  count?: number;
}

export interface DialogueNodeFile {
  text: string;
  choices?: DialogueChoiceFile[];
}

export interface DialogueChoiceFile {
  text: string;
  next?: string;
  minLevel?: number;
  requiredClass?: string;
  action?: string;
}

export interface GatheringNodeFile {
  displayName: string;
  keyword?: string;
  image?: string;
  skill: string;
  skillRequired?: number;
  yields: GatheringYieldFile[];
  rareYields?: RareYieldFile[];
  respawnSeconds?: number;
  xpReward?: number;
  room: string;
}

export interface GatheringYieldFile {
  itemId: string;
  minQuantity?: number;
  maxQuantity?: number;
}

export interface RareYieldFile {
  itemId: string;
  quantity?: number;
  dropChance: number;
}

export interface RecipeFile {
  displayName: string;
  skill: string;
  skillRequired?: number;
  levelRequired?: number;
  materials: RecipeMaterialFile[];
  outputItemId: string;
  outputQuantity?: number;
  station?: string;
  stationBonus?: number;
  xpReward?: number;
  image?: string;
}

export interface RecipeMaterialFile {
  itemId: string;
  quantity: number;
}

// ─── Dungeon template types ────────────────────────────────────────

export interface DungeonMobPool {
  common?: string[];
  elite?: string[];
  boss?: string[];
}

export interface DungeonRoomTemplate {
  title: string;
  description: string;
  image?: string;
}

export interface DungeonLootTable {
  mobDrops?: string[];
  completionRewards?: string[];
}

export interface DungeonFile {
  name: string;
  description?: string;
  image?: string;
  minLevel?: number;
  roomCountMin?: number;
  roomCountMax?: number;
  portalRoom?: string;
  roomTemplates?: Record<string, DungeonRoomTemplate[]>;
  mobPools?: DungeonMobPool;
  lootTables?: Record<string, DungeonLootTable>;
}

// ─── Puzzles ──────────────────────────────────────────────────────

export interface PuzzleReward {
  type: string; // "unlock_exit" | "give_item" | "give_gold" | "give_xp"
  exitDirection?: string;
  targetRoom?: string;
  itemId?: string;
  gold?: number;
  xp?: number;
  /** Legacy alias used by older creator code; normalized on output. */
  amount?: number;
}

export interface PuzzleStep {
  feature: string;
  action: string;
}

export interface PuzzleFile {
  type: string; // "riddle" | "sequence"
  mobId?: string;
  roomId: string;
  question?: string;
  answer?: string;
  acceptableAnswers?: string[];
  steps?: PuzzleStep[];
  reward: PuzzleReward;
  failMessage?: string;
  successMessage?: string;
  cooldownMs?: number;
  resetOnFail?: boolean;
  /**
   * Optional backdrop for the puzzle card (the "Conundrum Codex" tome). The
   * web client renders it behind the riddle page; the question text and the
   * answer input sit on top. Content-addressed filename, resolved against the
   * world image base. Resolution order: `backgroundImage` → `puzzle_bg` global
   * asset → polished CSS fallback.
   */
  backgroundImage?: string;
}
