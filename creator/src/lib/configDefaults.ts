// ─── Canonical MUD defaults ─────────────────────────────────────────
//
// These mirror the defaults shipped with the AmbonMUD server
// (AppConfig companion objects and the canonical shipped
// application.yaml). When a new (or empty) project
// loads a config section with no user data, we fill in the MUD's
// canonical values so the editors have something useful to show —
// the server itself would apply the same defaults if it saw an empty
// map, so this keeps Creator and server behavior in lockstep.
//
// Important: some of these registries (statusEffects, commands) are
// "data-driven" on the surface but referenced by hardcoded logic in
// the server (ability implementations, command handlers). Removing
// the defaults breaks the running game, so treat this list as a
// baseline that should generally only be *added to* per project, not
// trimmed away.

import type { AppConfig, EnvironmentTheme, EnvironmentConfig } from "@/types/config";

/** Canonical defaults for the Akathavae pacifist path (mirrors the server's
 *  AkathavaeConfig). Used to seed the parser and to omit an unchanged block on save. */
export const DEFAULT_AKATHAVAE: AppConfig["akathavae"] = {
  enabled: true,
  renounceCostGold: 2500,
  repledgeCooldownMs: 86_400_000,
  illuminateBaseSuccessPct: 70,
  successStat: "INT",
  successPerStatPoint: 2.0,
  levelGapPenaltyPct: 8.0,
  gapReliefStat: "STR",
  gapReliefPerStatPoint: 0.5,
  minSuccessPct: 5,
  maxSuccessPct: 95,
  failRetryCooldownMs: 30_000,
  escapeStat: "CHA",
  escapePerStatPoint: 3.0,
  xpStat: "WIS",
  xpBonusPerStatPoint: 0.02,
  repeatXpFraction: 0.2,
  repeatXpCooldownMs: 300_000,
  roomDiscoveryXp: 15,
  roomDiscoveryXpPerZoneLevel: 5,
  itemDiscoveryXp: 25,
  observeNpcXp: 10,
  discoveryXpThrottleMs: 1_500,
  zoneCompletionXpPerRoom: 50,
  zoneCompletionGold: 500,
  unpledgedSuccessMultiplier: 0.5,
  unpledgedXpMultiplier: 0.25,
  sketchMsPerEstimatedRound: 1_000,
  sketchMinMs: 2_000,
  sketchMaxMs: 10_000,
  observeSketchMs: 2_000,
};

/** Canonical defaults for flight masters (mirrors the server's FlightConfig).
 *  Used to seed the parser and to omit an unchanged block on save. */
export const DEFAULT_FLIGHT: AppConfig["flight"] = {
  baseCost: 25,
  costPerRoom: 4,
  minCost: 25,
  maxCost: 5000,
  unreachableCost: 500,
  messages: {
    combatBlocked: "You can't take flight in the middle of a battle!",
    notAtFlightMaster: "You need to be at a flight master to do that.",
    noDestinations: "You haven't discovered any other flight points yet. Explore to find more!",
    unknownDestination: "The flight master doesn't recognize that destination.",
    alreadyHere: "You're already at that flight point.",
    notEnoughGold: "That flight costs {cost} gold, but you only have {gold}.",
    discovered: "[Flight] You commit this flight point to memory — you can now fly here from afar.",
    departNotice: "leaps skyward and soars away.",
    arriveNotice: "descends from the sky and alights gracefully.",
    depart: "You climb aboard and take to the skies, bound for {dest}...",
    arrival: "You alight at {dest}. (-{cost} gold)",
  },
};

/** Canonical defaults for boat docks (mirrors the server's BoatConfig).
 *  Used to seed the parser and to omit an unchanged block on save. */
export const DEFAULT_BOAT: AppConfig["boat"] = {
  messages: {
    combatBlocked: "You can't set sail in the middle of a battle!",
    notAtDock: "You need to be at a boat dock to do that.",
    noRoutes: "No boats are berthed here. This dock has no routes.",
    unknownDestination: "The harbor master doesn't sail to that destination.",
    alreadyHere: "You're already at that dock.",
    notEnoughGold: "That voyage costs {cost} gold, but you only have {gold}.",
    departNotice: "casts off and sails away across the water.",
    arriveNotice: "sails in and steps ashore from the deck.",
    depart: "You board the boat and cast off, bound for {dest}...",
    arrival: "You step ashore at {dest}. (-{cost} gold)",
  },
};

// ─── Registries with simple map shapes ─────────────────────────────

export const DEFAULT_ACHIEVEMENT_CATEGORIES: AppConfig["achievementCategories"] = {
  combat: { displayName: "Combat" },
  exploration: { displayName: "Exploration" },
  social: { displayName: "Social" },
  crafting: { displayName: "Crafting" },
  class: { displayName: "Class" },
};

/**
 * Achievement criterion types. The MUD companion default is only the
 * first three ({kill, reach_level, quest_complete}), but the example
 * zones reference the broader set and the server's achievement
 * listener handles all of
 * these. We ship the superset so authors can wire up crafting, gathering,
 * dungeon, and guild achievements without editing the taxonomy first.
 */
export const DEFAULT_ACHIEVEMENT_CRITERION_TYPES: AppConfig["achievementCriterionTypes"] = {
  kill: { displayName: "Kill", progressFormat: "{current}/{required}" },
  reach_level: { displayName: "Reach Level", progressFormat: "level {current}/{required}" },
  quest_complete: { displayName: "Quest Complete", progressFormat: "{current}/{required}" },
  craft: { displayName: "Craft", progressFormat: "{current}/{required}" },
  gather: { displayName: "Gather", progressFormat: "{current}/{required}" },
  dungeon_complete: { displayName: "Complete Dungeon", progressFormat: "{current}/{required}" },
  dungeon_complete_full_party: {
    displayName: "Complete Dungeon (Full Party)",
    progressFormat: "{current}/{required}",
  },
  guild_create: { displayName: "Create Guild", progressFormat: "{current}/{required}" },
};

/**
 * Zone-level quest objective types. The MUD companion default is just
 * {kill, collect}, but the daily-quest pool references the broader set
 * ({kill, collect, gather, dungeon, craft, pvpKill}) and those verbs
 * are handled by the engine. We ship the broader set so authors can
 * build any of the supported objective shapes without manually adding
 * the registry entries first.
 */
export const DEFAULT_QUEST_OBJECTIVE_TYPES: AppConfig["questObjectiveTypes"] = {
  kill: { displayName: "Kill" },
  collect: { displayName: "Collect" },
  gather: { displayName: "Gather" },
  craft: { displayName: "Craft" },
  dungeon: { displayName: "Dungeon" },
  pvpKill: { displayName: "PvP Kill" },
};

export const DEFAULT_QUEST_COMPLETION_TYPES: AppConfig["questCompletionTypes"] = {
  auto: { displayName: "Automatic" },
  npc_turn_in: { displayName: "NPC Turn-In" },
};

// ─── Status-effect subsystem defaults ──────────────────────────────
//
// These three registries describe *how* a status effect behaves
// (ticking damage, modifying stats, stacking) and are hardcoded in the
// MUD's status-effect engine. They come from the server's AppConfig
// companion objects. Creator needs them present so the Condition
// designer dropdowns are populated even before the user opens a full
// MUD config.

export const DEFAULT_STATUS_EFFECT_TYPES: AppConfig["statusEffectTypes"] = {
  dot: { displayName: "Damage Over Time", ticksDamage: true },
  hot: { displayName: "Heal Over Time", ticksHealing: true },
  stat_buff: { displayName: "Stat Buff", modifiesStats: true },
  stat_debuff: { displayName: "Stat Debuff", modifiesStats: true },
  stun: { displayName: "Stun" },
  root: { displayName: "Root" },
  shield: { displayName: "Shield", absorbsDamage: true },
};

export const DEFAULT_STACK_BEHAVIORS: AppConfig["stackBehaviors"] = {
  refresh: { displayName: "Refresh" },
  stack: { displayName: "Stack" },
  none: { displayName: "None" },
};

export const DEFAULT_ABILITY_TARGET_TYPES: AppConfig["abilityTargetTypes"] = {
  enemy: { displayName: "Enemy" },
  self: { displayName: "Self" },
  ally: { displayName: "Ally" },
  pet: { displayName: "Pet" },
};

// ─── Canonical status effects ("conditions") ───────────────────────
//
// Thirty-six buff/debuff/shield/DoT/HoT definitions from the shipping
// server application.yaml. Many of these are referenced by
// name from hardcoded ability implementations on the server, so
// projects that don't define them will have broken abilities — we
// ship them as a baseline so the Condition designer starts populated.

export const DEFAULT_STATUS_EFFECTS: AppConfig["statusEffects"] = {
  ignite: {
    displayName: "Ignite",
    effectType: "DOT",
    durationMs: 6000,
    tickIntervalMs: 2000,
    stackBehavior: "REFRESH",
  },
  poison: {
    displayName: "Poison",
    effectType: "DOT",
    durationMs: 10000,
    tickIntervalMs: 2000,
    stackBehavior: "STACK",
    maxStacks: 3,
  },
  shield_of_faith: {
    displayName: "Shield of Faith",
    effectType: "SHIELD",
    durationMs: 30000,
    shieldAmount: 20,
    stackBehavior: "NONE",
  },
  battle_shout: {
    displayName: "Battle Shout",
    effectType: "STAT_BUFF",
    durationMs: 60000,
    stackBehavior: "REFRESH",
  },
  rejuvenation: {
    displayName: "Rejuvenation",
    effectType: "HOT",
    durationMs: 10000,
    tickIntervalMs: 2000,
    stackBehavior: "REFRESH",
  },
  frost_grip: {
    displayName: "Frost Grip",
    effectType: "ROOT",
    durationMs: 4000,
    stackBehavior: "NONE",
  },
  concuss: {
    displayName: "Concuss",
    effectType: "STUN",
    durationMs: 2000,
    stackBehavior: "NONE",
  },
  whirlwind_rage: {
    displayName: "Whirlwind Rage",
    effectType: "STAT_BUFF",
    durationMs: 8000,
    tickIntervalMs: 1000,
    stackBehavior: "REFRESH",
  },
  berserker_state: {
    displayName: "Berserker State",
    effectType: "STAT_BUFF",
    durationMs: 10000,
    stackBehavior: "REFRESH",
  },
  thornhide_armor: {
    displayName: "Thornhide Armor",
    effectType: "SHIELD",
    durationMs: 15000,
    shieldAmount: 30,
    stackBehavior: "REFRESH",
  },
  weakened: {
    displayName: "Weakened",
    effectType: "STAT_DEBUFF",
    durationMs: 8000,
    stackBehavior: "REFRESH",
  },
  mana_shield: {
    displayName: "Mana Shield",
    effectType: "SHIELD",
    durationMs: 20000,
    shieldAmount: 25,
    stackBehavior: "REFRESH",
  },
  flame_armor: {
    displayName: "Flame Armor",
    effectType: "STAT_BUFF",
    durationMs: 12000,
    stackBehavior: "REFRESH",
  },
  frost_armor: {
    displayName: "Frost Armor",
    effectType: "SHIELD",
    durationMs: 12000,
    shieldAmount: 28,
    stackBehavior: "REFRESH",
  },
  frozen: {
    displayName: "Frozen",
    effectType: "STUN",
    durationMs: 3000,
    stackBehavior: "NONE",
  },
  chilled: {
    displayName: "Chilled",
    effectType: "STAT_DEBUFF",
    durationMs: 6000,
    stackBehavior: "REFRESH",
  },
  arcane_burn: {
    displayName: "Arcane Burn",
    effectType: "DOT",
    durationMs: 8000,
    tickIntervalMs: 2000,
    stackBehavior: "STACK",
    maxStacks: 2,
  },
  holy_light: {
    displayName: "Holy Light",
    effectType: "HOT",
    durationMs: 12000,
    tickIntervalMs: 2000,
    stackBehavior: "REFRESH",
  },
  divine_blessing: {
    displayName: "Divine Blessing",
    effectType: "STAT_BUFF",
    durationMs: 15000,
    stackBehavior: "REFRESH",
  },
  consecrated_ground: {
    displayName: "Consecrated Ground",
    effectType: "HOT",
    durationMs: 20000,
    tickIntervalMs: 2000,
    stackBehavior: "REFRESH",
  },
  purified: {
    displayName: "Purified",
    effectType: "STAT_BUFF",
    durationMs: 10000,
    stackBehavior: "REFRESH",
  },
  shadow_veil: {
    displayName: "Shadow Veil",
    effectType: "SHIELD",
    durationMs: 10000,
    shieldAmount: 15,
    stackBehavior: "REFRESH",
  },
  venomous: {
    displayName: "Venomous",
    effectType: "DOT",
    durationMs: 12000,
    tickIntervalMs: 2000,
    stackBehavior: "STACK",
    maxStacks: 4,
  },
  shadow_mark: {
    displayName: "Shadow Mark",
    effectType: "STAT_DEBUFF",
    durationMs: 8000,
    stackBehavior: "REFRESH",
  },
  death_mark: {
    displayName: "Death Mark",
    effectType: "STAT_DEBUFF",
    durationMs: 10000,
    stackBehavior: "REFRESH",
  },
  blinded: {
    displayName: "Blinded",
    effectType: "STAT_DEBUFF",
    durationMs: 5000,
    stackBehavior: "NONE",
  },
  camouflage_stance: {
    displayName: "Camouflage",
    effectType: "STAT_BUFF",
    durationMs: 4000,
    stackBehavior: "REFRESH",
    dexMod: 4,
  },
  hunters_mark: {
    displayName: "Hunter's Mark",
    effectType: "STAT_DEBUFF",
    durationMs: 10000,
    stackBehavior: "REFRESH",
    strMod: -2,
    dexMod: -2,
  },
  natures_grasp: {
    displayName: "Nature's Grasp",
    effectType: "ROOT",
    durationMs: 4000,
    stackBehavior: "NONE",
  },
  nature_bond_hot: {
    displayName: "Nature Bond",
    effectType: "HOT",
    durationMs: 8000,
    tickIntervalMs: 2000,
    stackBehavior: "REFRESH",
  },
  rend_bleed: {
    displayName: "Rend",
    effectType: "DOT",
    durationMs: 12000,
    tickIntervalMs: 2000,
    stackBehavior: "REFRESH",
  },
  ice_barrier: {
    displayName: "Ice Barrier",
    effectType: "SHIELD",
    durationMs: 15000,
    shieldAmount: 35,
    stackBehavior: "REFRESH",
  },
  rallying_cry_buff: {
    displayName: "Rallying Cry",
    effectType: "STAT_BUFF",
    durationMs: 15000,
    stackBehavior: "REFRESH",
    strMod: 3,
    conMod: 3,
  },
  shield_wall_buff: {
    displayName: "Shield Wall",
    effectType: "SHIELD",
    durationMs: 10000,
    shieldAmount: 50,
    stackBehavior: "REFRESH",
  },
  last_stand_buff: {
    displayName: "Last Stand",
    effectType: "SHIELD",
    durationMs: 8000,
    shieldAmount: 80,
    stackBehavior: "REFRESH",
  },
  frozen_orb_dot: {
    displayName: "Frozen Orb",
    effectType: "DOT",
    durationMs: 8000,
    tickIntervalMs: 2000,
    stackBehavior: "REFRESH",
  },
};

// ─── Canonical player + staff commands ─────────────────────────────
//
// Sourced from the server's CommandsConfig.defaultCommandEntries().
// The server's command dispatcher looks up
// handlers by these IDs, so projects that strip the list down below
// the hardcoded set will have broken commands. We ship the full list
// as a baseline.

export const DEFAULT_COMMANDS: AppConfig["commands"] = {
  help: { usage: "help/?", description: "Show this help", category: "utility", staff: false },
  look: { usage: "look/l [target|direction]", description: "Look around, at a target, or in a direction", category: "navigation", staff: false },
  move: { usage: "n/s/e/w/u/d", description: "Move in a direction", category: "navigation", staff: false },
  exits: { usage: "exits/ex", description: "List available exits", category: "navigation", staff: false },
  recall: { usage: "recall", description: "Teleport to your recall point (set by resting at an inn)", category: "navigation", staff: false },
  say: { usage: "say <msg> or '<msg>", description: "Speak to the room", category: "communication", staff: false },
  emote: { usage: "emote <msg>", description: "Perform an emote", category: "communication", staff: false },
  pose: { usage: "pose <msg>", description: "Strike a pose", category: "communication", staff: false },
  who: { usage: "who", description: "List online players", category: "communication", staff: false },
  tell: { usage: "tell/t <player> <msg>", description: "Private message a player", category: "communication", staff: false },
  whisper: { usage: "whisper/wh <player> <msg>", description: "Whisper to a player", category: "communication", staff: false },
  gossip: { usage: "gossip/gs <msg>", description: "Global chat channel", category: "communication", staff: false },
  shout: { usage: "shout/sh <msg>", description: "Shout to your zone", category: "communication", staff: false },
  ooc: { usage: "ooc <msg>", description: "Out-of-character channel", category: "communication", staff: false },
  inventory: { usage: "inventory/inv/i", description: "View your inventory", category: "items", staff: false },
  equipment: { usage: "equipment/eq", description: "View worn equipment", category: "items", staff: false },
  wear: { usage: "wear/equip <item>", description: "Equip an item", category: "items", staff: false },
  remove: { usage: "remove/unequip <slot>", description: "Unequip from a slot", category: "items", staff: false },
  get: { usage: "get/take/pickup <item>", description: "Pick up an item", category: "items", staff: false },
  drop: { usage: "drop <item>", description: "Drop an item", category: "items", staff: false },
  use: { usage: "use <item>", description: "Use a consumable item", category: "items", staff: false },
  give: { usage: "give <item> <player>", description: "Give an item to a player", category: "items", staff: false },
  talk: { usage: "talk <npc>", description: "Start a conversation with an NPC", category: "social", staff: false },
  kill: { usage: "kill <mob>", description: "Attack a mob", category: "combat", staff: false },
  flee: { usage: "flee", description: "Attempt to flee combat", category: "combat", staff: false },
  cast: { usage: "cast/c <spell> [target]", description: "Cast a spell or ability", category: "combat", staff: false },
  spells: { usage: "spells/abilities/skills", description: "List your abilities", category: "progression", staff: false },
  effects: { usage: "effects/buffs/debuffs", description: "View active status effects", category: "progression", staff: false },
  score: { usage: "score/sc", description: "View your character sheet", category: "progression", staff: false },
  balance: { usage: "gold/balance", description: "Check the gold you are carrying", category: "shops", staff: false },
  currencies: { usage: "currencies/currency/wallet", description: "View secondary currencies", category: "progression", staff: false },
  shop_list: { usage: "list/shop", description: "Browse a shop's wares", category: "shops", staff: false },
  buy: { usage: "buy <item>", description: "Purchase from a shop", category: "shops", staff: false },
  sell: { usage: "sell <item>", description: "Sell to a shop", category: "shops", staff: false },
  quest_log: { usage: "quest log/list", description: "View active quests", category: "quests", staff: false },
  quest_info: { usage: "quest info <name>", description: "Quest details", category: "quests", staff: false },
  quest_abandon: { usage: "quest abandon <name>", description: "Abandon a quest", category: "quests", staff: false },
  accept: { usage: "accept <quest>", description: "Accept a quest from an NPC", category: "quests", staff: false },
  bounty: { usage: "bounty / quest auto", description: "Request an auto-generated bounty quest", category: "quests", staff: false },
  bounty_info: { usage: "bounty info / quest auto info", description: "View active bounty progress", category: "quests", staff: false },
  bounty_abandon: { usage: "bounty abandon / quest auto abandon", description: "Abandon active bounty", category: "quests", staff: false },
  achievements: { usage: "achievements/ach", description: "View achievements", category: "quests", staff: false },
  daily: { usage: "daily/dailies", description: "View daily quest board", category: "quests", staff: false },
  weekly: { usage: "weekly", description: "View weekly quest board", category: "quests", staff: false },
  gquest: { usage: "gquest/gq/global", description: "View active global quest status", category: "quests", staff: false },
  group_invite: { usage: "group invite <player>", description: "Invite to your group", category: "groups", staff: false },
  group_accept: { usage: "group accept", description: "Accept a group invite", category: "groups", staff: false },
  group_leave: { usage: "group leave", description: "Leave your group", category: "groups", staff: false },
  group_kick: { usage: "group kick <player>", description: "Kick from group", category: "groups", staff: false },
  group_list: { usage: "group list (or just 'group')", description: "List group members", category: "groups", staff: false },
  gtell: { usage: "gtell/gt <message>", description: "Group chat", category: "groups", staff: false },
  guild_create: { usage: "guild create <name> <tag>", description: "Create a guild", category: "guilds", staff: false },
  guild_disband: { usage: "guild disband", description: "Disband your guild", category: "guilds", staff: false },
  guild_invite: { usage: "guild invite <player>", description: "Invite to guild", category: "guilds", staff: false },
  guild_accept: { usage: "guild accept", description: "Accept a guild invite", category: "guilds", staff: false },
  guild_leave: { usage: "guild leave", description: "Leave your guild", category: "guilds", staff: false },
  guild_kick: { usage: "guild kick <player>", description: "Remove from guild", category: "guilds", staff: false },
  guild_promote: { usage: "guild promote <player>", description: "Promote a member", category: "guilds", staff: false },
  guild_demote: { usage: "guild demote <player>", description: "Demote a member", category: "guilds", staff: false },
  guild_motd: { usage: "guild motd <message>", description: "Set guild message of the day", category: "guilds", staff: false },
  guild_roster: { usage: "guild roster", description: "View guild members", category: "guilds", staff: false },
  guild_info: { usage: "guild info (or just 'guild')", description: "Guild overview", category: "guilds", staff: false },
  gchat: { usage: "gchat/g <message>", description: "Guild chat", category: "guilds", staff: false },
  gather: { usage: "gather/harvest/mine <node>", description: "Gather from a resource node", category: "crafting", staff: false },
  craft: { usage: "craft/make <recipe>", description: "Craft an item from a recipe", category: "crafting", staff: false },
  recipes: { usage: "recipes [filter]", description: "Browse available recipes", category: "crafting", staff: false },
  craftskills: { usage: "craftskills/professions", description: "View crafting skill levels", category: "crafting", staff: false },
  house: { usage: "house [status]", description: "View your house info", category: "housing", staff: false },
  house_list: { usage: "house list", description: "Browse available room templates", category: "housing", staff: false },
  house_buy: { usage: "house buy", description: "Purchase your house (at broker)", category: "housing", staff: false },
  house_expand: { usage: "house expand <template> <direction>", description: "Add a room to your house", category: "housing", staff: false },
  house_describe: { usage: "house describe [title|desc] <text>", description: "Customize room title or description", category: "housing", staff: false },
  house_invite: { usage: "house invite <player>", description: "Invite a player to your house", category: "housing", staff: false },
  house_kick: { usage: "house kick <player>", description: "Remove a visitor from your house", category: "housing", staff: false },
  house_guests: { usage: "house guests", description: "List visitors in your house", category: "housing", staff: false },
  open: { usage: "open <door|container>", description: "Open a door or container", category: "world", staff: false },
  close: { usage: "close <door|container>", description: "Close a door or container", category: "world", staff: false },
  unlock: { usage: "unlock <door|container>", description: "Unlock with a key", category: "world", staff: false },
  lock: { usage: "lock <door|container>", description: "Lock with a key", category: "world", staff: false },
  search: { usage: "search <container>", description: "Search a container for its contents", category: "world", staff: false },
  get_from: { usage: "get <item> from <container>", description: "Take an item from a container", category: "world", staff: false },
  put_in: { usage: "put <item> <container>", description: "Place an item in a container", category: "world", staff: false },
  pull: { usage: "pull <lever>", description: "Pull a lever or object", category: "world", staff: false },
  read: { usage: "read <sign>", description: "Read a sign or inscription", category: "world", staff: false },
  title: { usage: "title <titleName> | title clear", description: "Set or clear your title", category: "progression", staff: false },
  gender: { usage: "gender <option>", description: "Set your gender", category: "progression", staff: false },
  sprite: { usage: "sprite list | set <id> | default", description: "Manage your character sprite", category: "progression", staff: false },
  friend: { usage: "friend list | add <player> | remove <player>", description: "Manage your friends list", category: "social", staff: false },
  mail: { usage: "mail list | read <n> | send <player> | delete <n>", description: "Manage mail", category: "social", staff: false },
  lottery: { usage: "lottery [info] | lottery buy [count]", description: "View the lottery or buy tickets (buying requires a tavern)", category: "social", staff: false },
  gamble: { usage: "gamble/dice <amount>", description: "Roll d100 against the house (requires a tavern)", category: "social", staff: false },
  ansi: { usage: "ansi on/off", description: "Toggle color output", category: "utility", staff: false },
  screenreader: { usage: "screenreader [on/off]", description: "Toggle screen reader mode", category: "utility", staff: false },
  colors: { usage: "colors", description: "Preview ANSI color palette", category: "utility", staff: false },
  clear: { usage: "clear", description: "Clear the terminal", category: "utility", staff: false },
  quit: { usage: "quit/exit", description: "Disconnect", category: "utility", staff: false },
  phase: { usage: "phase/layer [instance]", description: "Switch zone instance", category: "utility", staff: false },
  rest: { usage: "rest", description: "Rest at an inn to make it your recall point.", category: "navigation", staff: false },
  depart: { usage: "depart", description: "Leave the death sanctum and return to the world", category: "navigation", staff: false },
  run: { usage: "run <directions> (e.g. 5n3e)", description: "Move along a sequence of directions. Numeric prefixes repeat — '5n3e' walks five north then three east.", category: "navigation", staff: false },
  areas: { usage: "areas [<minLevel> [<maxLevel>]]", description: "List known areas. With one level, shows areas covering that level; with two, shows areas overlapping the range.", category: "navigation", staff: false },
  quickheal: { usage: "quickheal/qh", description: "Auto-use best healing potion", category: "combat", staff: false },
  quickmana: { usage: "quickmana/qm", description: "Auto-use best mana potion", category: "combat", staff: false },
  bye: { usage: "bye/goodbye", description: "End the current NPC conversation", category: "social", staff: false },
  consider: { usage: "consider/con <mob>", description: "Estimate your odds against a mob before attacking", category: "combat", staff: false },
  wimpy: { usage: "wimpy [off | 0-95]", description: "View or set the HP percent where you auto-flee combat", category: "combat", staff: false },
  duel: { usage: "duel <player> | duel accept | duel decline", description: "Challenge another player to a PvP duel", category: "combat", staff: false },
  reputation: { usage: "reputation/rep/factions", description: "View your faction standings", category: "progression", staff: false },
  bank: { usage: "bank", description: "View bank balance and vault contents (requires a bank)", category: "shops", staff: false },
  deposit: { usage: "deposit <amount|item>", description: "Deposit gold or an item into your bank vault", category: "shops", staff: false },
  withdraw: { usage: "withdraw <amount|item>", description: "Withdraw gold or an item from your bank vault", category: "shops", staff: false },
  auction: { usage: "auction", description: "Browse auction house listings", category: "shops", staff: false },
  auction_sell: { usage: "auction sell <item> <price>", description: "List an item on the auction house", category: "shops", staff: false },
  auction_buy: { usage: "auction buy <#>", description: "Buy an auction listing by number", category: "shops", staff: false },
  auction_cancel: { usage: "auction cancel <#>", description: "Cancel your listing and reclaim the item", category: "shops", staff: false },
  trade: { usage: "trade <player> | trade accept | trade cancel | trade status", description: "Trade items and gold with another player", category: "items", staff: false },
  trade_offer: { usage: "trade offer <item> | trade offer <amount> gold", description: "Add an item or gold to the active trade", category: "items", staff: false },
  trade_remove: { usage: "trade remove <item>", description: "Remove an item from your trade offer", category: "items", staff: false },
  quest_turnin: { usage: "quest turnin <name>", description: "Turn in a completed quest to its giver NPC", category: "quests", staff: false },
  qoffers: { usage: "qoffers <mob>", description: "List the quests an NPC has to offer", category: "quests", staff: false },
  guild_hall: { usage: "guild hall [buy | expand <template> <direction> | enter | leave]", description: "View, buy, expand, and visit your guild hall", category: "guilds", staff: false },
  specialize: { usage: "specialize/spec [profession]", description: "View or choose a crafting specialization", category: "crafting", staff: false },
  enchant: { usage: "enchant <item> [enchantment]", description: "Enchant an item with a known enchantment", category: "crafting", staff: false },
  enchantments: { usage: "enchantments", description: "List available enchantments", category: "crafting", staff: false },
  answer: { usage: "answer <text>", description: "Answer a riddle in the room", category: "world", staff: false },
  dungeon: { usage: "dungeon enter <name> [difficulty] | dungeon leave", description: "Enter or leave an instanced dungeon", category: "world", staff: false },
  describe: { usage: "describe <text> | describe clear | describe check <player>", description: "Set, clear, or view a character description", category: "progression", staff: false },
  train: { usage: "train [list] | train learn <ability> | train unlock <class> | train reset", description: "Learn abilities, unlock classes, or respec at a class trainer", category: "progression", staff: false },
  prestige: { usage: "prestige | prestige info", description: "Reset at max level for permanent prestige perks", category: "progression", staff: false },
  leaderboard: { usage: "leaderboard/top [category]", description: "View player leaderboards", category: "progression", staff: false },
  stylist: { usage: "stylist", description: "View race-change options and fee (requires a stylist)", category: "progression", staff: false },
  pledge: { usage: "pledge", description: "Take the Akathavae pledge at a shrine — forsake combat, level through illumination", category: "progression", staff: false },
  renounce: { usage: "renounce [confirm]", description: "Renounce the Akathavae pledge at a shrine (costs gold)", category: "progression", staff: false },
  illuminate: { usage: "illuminate <creature>", description: "Record a creature in your Arcanum — the Akathavae's replacement for attacking", category: "progression", staff: false },
  arcanum: { usage: "arcanum [rooms|mobs|items]", description: "Leaf through your Arcanum journal of recorded places, creatures, and items", category: "progression", staff: false },
  wardrobe: { usage: "wardrobe [item]", description: "Conjure and wear equipment recorded in your Arcanum (Akathavae only)", category: "progression", staff: false },
  changerace: { usage: "changerace <race>", description: "Pay the stylist to change your race", category: "progression", staff: false },
  pet: { usage: "pet [status] | pet name <name> | pet skills | pet <skill> | pet dismiss", description: "Manage your pet and trigger its skills", category: "progression", staff: false },
  autoloot: { usage: "autoloot on/off/status", description: "Auto-loot mob corpses when enabled", category: "utility", staff: false },
  autopeek: { usage: "autopeek on/off/status", description: "Append adjacent room names below room descriptions", category: "utility", staff: false },
  time: { usage: "time", description: "Show the in-game time of day", category: "utility", staff: false },
  claim: { usage: "claim <password> | claim <newname> <password>", description: "Save a demo character as a permanent account", category: "utility", staff: false },
  // Staff commands
  goto: { usage: "goto <zone:room | room | zone:>", description: "Teleport to a room", category: "admin", staff: true },
  transfer: { usage: "transfer <player> <room>", description: "Move a player", category: "admin", staff: true },
  spawn: { usage: "spawn <mob-template>", description: "Spawn a mob", category: "admin", staff: true },
  smite: { usage: "smite <player|mob>", description: "Instantly kill a target", category: "admin", staff: true },
  staff_kick: { usage: "kick <player>", description: "Disconnect a player", category: "admin", staff: true },
  dispel: { usage: "dispel <player|mob>", description: "Remove all effects", category: "admin", staff: true },
  setlevel: { usage: "setlevel <player> <level>", description: "Set a player's level", category: "admin", staff: true },
  shutdown: { usage: "shutdown", description: "Shut down the server", category: "admin", staff: true },
  reload: { usage: "reload [scope]", description: "Reload world data", category: "admin", staff: true },
  possess: { usage: "possess/switch <mob>", description: "Take control of a mob", category: "admin", staff: true },
  return: { usage: "return/unpossess", description: "Release a possessed mob", category: "admin", staff: true },
  invis: { usage: "invis", description: "Toggle staff invisibility", category: "admin", staff: true },
  broadcast: { usage: "broadcast <message>", description: "Send a server-wide announcement", category: "admin", staff: true },
  heal: { usage: "heal [player]", description: "Fully restore a player's HP and mana", category: "admin", staff: true },
  pinfo: { usage: "pinfo <player>", description: "Inspect a player's state", category: "admin", staff: true },
  setstaff: { usage: "setstaff/grantstaff <player> | revokestaff <player>", description: "Grant or revoke staff access", category: "admin", staff: true },
  setgold: { usage: "setgold <player> <amount>", description: "Set a player's gold", category: "admin", staff: true },
  setrace: { usage: "setrace <player> <race>", description: "Set a player's race", category: "admin", staff: true },
  setclass: { usage: "setclass <player> <class>", description: "Set a player's class", category: "admin", staff: true },
  setgender: { usage: "setgender <player> <gender>", description: "Set a player's gender", category: "admin", staff: true },
  setxp: { usage: "setxp <player> <xp>", description: "Set a player's XP", category: "admin", staff: true },
};

// ─── Canonical emote presets ───────────────────────────────────────
//
// Twelve quick-action emotes that the MUD ships as the default player
// emote menu. Sourced from EmotePresetsConfig.defaultEmotePresets().

export const DEFAULT_EMOTE_PRESETS: AppConfig["emotePresets"] = {
  presets: [
    { label: "Wave", emoji: "\uD83D\uDC4B", action: "waves." },
    { label: "Nod", emoji: "\uD83D\uDE42", action: "nods." },
    { label: "Laugh", emoji: "\uD83D\uDE02", action: "laughs." },
    { label: "Bow", emoji: "\uD83D\uDE4F", action: "bows respectfully." },
    { label: "Cheer", emoji: "\uD83C\uDF89", action: "cheers!" },
    { label: "Shrug", emoji: "\uD83E\uDD37", action: "shrugs." },
    { label: "Clap", emoji: "\uD83D\uDC4F", action: "claps." },
    { label: "Dance", emoji: "\uD83D\uDC83", action: "dances." },
    { label: "Think", emoji: "\uD83E\uDD14", action: "thinks carefully." },
    { label: "Facepalm", emoji: "\uD83E\uDD26", action: "facepalms." },
    { label: "Salute", emoji: "\uD83E\uDEE1", action: "salutes." },
    { label: "Cry", emoji: "\uD83D\uDE22", action: "cries." },
  ],
};

// ─── Weather type defaults ───────────────────────────────────────
//
// Config-driven weather types. The server selects weather by weighted
// random from this registry. Each type can specify a particleHint
// for the web client's particle renderer.

export const DEFAULT_WEATHER_TYPES: AppConfig["weather"]["types"] = {
  CLEAR: { displayName: "Clear", weight: 3.0, particleHint: "", icon: "\u2600\uFE0F" },
  RAIN: { displayName: "Rain", weight: 2.0, particleHint: "rain", icon: "\u2614" },
  STORM: { displayName: "Storm", weight: 0.5, particleHint: "storm", icon: "\u26C8\uFE0F" },
  FOG: { displayName: "Fog", weight: 1.0, particleHint: "fog", icon: "\uD83C\uDF2B\uFE0F" },
  SNOW: { displayName: "Snow", weight: 0.8, particleHint: "snow", icon: "\u2744\uFE0F" },
  WIND: { displayName: "Wind", weight: 1.0, particleHint: "wind", icon: "\uD83D\uDCA8" },
};

// ─── Environment theme defaults ──────────────────────────────────

export const DEFAULT_ENVIRONMENT_THEME: EnvironmentTheme = {
  moteColors: [
    { core: "#c8b8e8", glow: "#a897d2" },
  ],
  skyGradients: {
    DAWN: { top: "#2a1a3a", bottom: "#c88060" },
    DAY: { top: "#4a6ea0", bottom: "#87ceeb" },
    DUSK: { top: "#3a2040", bottom: "#c86848" },
    NIGHT: { top: "#0a0c14", bottom: "#1a1c2e" },
  },
  transitionColors: ["#c8b8e8", "#a897d2", "#8caec9"],
  weatherParticleOverrides: {},
};

export const DEFAULT_ENVIRONMENT_CONFIG: EnvironmentConfig = {
  defaultTheme: DEFAULT_ENVIRONMENT_THEME,
  zones: {},
};
