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
  help: { usage: "help/?", category: "utility", staff: false },
  look: { usage: "look/l [target|direction]", category: "navigation", staff: false },
  move: { usage: "n/s/e/w/u/d", category: "navigation", staff: false },
  exits: { usage: "exits/ex", category: "navigation", staff: false },
  recall: { usage: "recall", category: "navigation", staff: false },
  say: { usage: "say <msg> or '<msg>", category: "communication", staff: false },
  emote: { usage: "emote <msg>", category: "communication", staff: false },
  pose: { usage: "pose <msg>", category: "communication", staff: false },
  who: { usage: "who", category: "communication", staff: false },
  tell: { usage: "tell/t <player> <msg>", category: "communication", staff: false },
  whisper: { usage: "whisper/wh <player> <msg>", category: "communication", staff: false },
  gossip: { usage: "gossip/gs <msg>", category: "communication", staff: false },
  shout: { usage: "shout/sh <msg>", category: "communication", staff: false },
  ooc: { usage: "ooc <msg>", category: "communication", staff: false },
  inventory: { usage: "inventory/inv/i", category: "items", staff: false },
  equipment: { usage: "equipment/eq", category: "items", staff: false },
  wear: { usage: "wear/equip <item>", category: "items", staff: false },
  remove: { usage: "remove/unequip <slot>", category: "items", staff: false },
  get: { usage: "get/take/pickup <item>", category: "items", staff: false },
  drop: { usage: "drop <item>", category: "items", staff: false },
  use: { usage: "use <item>", category: "items", staff: false },
  give: { usage: "give <item> <player>", category: "items", staff: false },
  talk: { usage: "talk <npc>", category: "social", staff: false },
  kill: { usage: "kill <mob>", category: "combat", staff: false },
  flee: { usage: "flee", category: "combat", staff: false },
  cast: { usage: "cast/c <spell> [target]", category: "combat", staff: false },
  spells: { usage: "spells/abilities/skills", category: "progression", staff: false },
  effects: { usage: "effects/buffs/debuffs", category: "progression", staff: false },
  score: { usage: "score/sc", category: "progression", staff: false },
  balance: { usage: "gold/balance", category: "shops", staff: false },
  currencies: { usage: "currencies/currency/wallet", category: "progression", staff: false },
  shop_list: { usage: "list/shop", category: "shops", staff: false },
  buy: { usage: "buy <item>", category: "shops", staff: false },
  sell: { usage: "sell <item>", category: "shops", staff: false },
  quest_log: { usage: "quest log/list", category: "quests", staff: false },
  quest_info: { usage: "quest info <name>", category: "quests", staff: false },
  quest_abandon: { usage: "quest abandon <name>", category: "quests", staff: false },
  accept: { usage: "accept <quest>", category: "quests", staff: false },
  bounty: { usage: "bounty / quest auto", category: "quests", staff: false },
  bounty_info: { usage: "bounty info / quest auto info", category: "quests", staff: false },
  bounty_abandon: { usage: "bounty abandon / quest auto abandon", category: "quests", staff: false },
  achievements: { usage: "achievements/ach", category: "quests", staff: false },
  daily: { usage: "daily/dailies", category: "quests", staff: false },
  weekly: { usage: "weekly", category: "quests", staff: false },
  gquest: { usage: "gquest/gq/global", category: "quests", staff: false },
  group_invite: { usage: "group invite <player>", category: "groups", staff: false },
  group_accept: { usage: "group accept", category: "groups", staff: false },
  group_leave: { usage: "group leave", category: "groups", staff: false },
  group_kick: { usage: "group kick <player>", category: "groups", staff: false },
  group_list: { usage: "group list (or just 'group')", category: "groups", staff: false },
  gtell: { usage: "gtell/gt <message>", category: "groups", staff: false },
  guild_create: { usage: "guild create <name> <tag>", category: "guilds", staff: false },
  guild_disband: { usage: "guild disband", category: "guilds", staff: false },
  guild_invite: { usage: "guild invite <player>", category: "guilds", staff: false },
  guild_accept: { usage: "guild accept", category: "guilds", staff: false },
  guild_leave: { usage: "guild leave", category: "guilds", staff: false },
  guild_kick: { usage: "guild kick <player>", category: "guilds", staff: false },
  guild_promote: { usage: "guild promote <player>", category: "guilds", staff: false },
  guild_demote: { usage: "guild demote <player>", category: "guilds", staff: false },
  guild_motd: { usage: "guild motd <message>", category: "guilds", staff: false },
  guild_roster: { usage: "guild roster", category: "guilds", staff: false },
  guild_info: { usage: "guild info (or just 'guild')", category: "guilds", staff: false },
  gchat: { usage: "gchat/g <message>", category: "guilds", staff: false },
  gather: { usage: "gather/harvest/mine <node>", category: "crafting", staff: false },
  craft: { usage: "craft/make <recipe>", category: "crafting", staff: false },
  recipes: { usage: "recipes [filter]", category: "crafting", staff: false },
  craftskills: { usage: "craftskills/professions", category: "crafting", staff: false },
  house: { usage: "house [status]", category: "housing", staff: false },
  house_list: { usage: "house list", category: "housing", staff: false },
  house_buy: { usage: "house buy", category: "housing", staff: false },
  house_expand: { usage: "house expand <template> <direction>", category: "housing", staff: false },
  house_describe: { usage: "house describe [title|desc] <text>", category: "housing", staff: false },
  house_invite: { usage: "house invite <player>", category: "housing", staff: false },
  house_kick: { usage: "house kick <player>", category: "housing", staff: false },
  house_guests: { usage: "house guests", category: "housing", staff: false },
  open: { usage: "open <door|container>", category: "world", staff: false },
  close: { usage: "close <door|container>", category: "world", staff: false },
  unlock: { usage: "unlock <door|container>", category: "world", staff: false },
  lock: { usage: "lock <door|container>", category: "world", staff: false },
  search: { usage: "search <container>", category: "world", staff: false },
  get_from: { usage: "get <item> from <container>", category: "world", staff: false },
  put_in: { usage: "put <item> <container>", category: "world", staff: false },
  pull: { usage: "pull <lever>", category: "world", staff: false },
  read: { usage: "read <sign>", category: "world", staff: false },
  title: { usage: "title <titleName> | title clear", category: "progression", staff: false },
  gender: { usage: "gender <option>", category: "progression", staff: false },
  sprite: { usage: "sprite list | set <id> | default", category: "progression", staff: false },
  friend: { usage: "friend list | add <player> | remove <player>", category: "social", staff: false },
  mail: { usage: "mail list | read <n> | send <player> | delete <n>", category: "social", staff: false },
  lottery: { usage: "lottery [info] | lottery buy [count]", category: "social", staff: false },
  gamble: { usage: "gamble/dice <amount>", category: "social", staff: false },
  ansi: { usage: "ansi on/off", category: "utility", staff: false },
  screenreader: { usage: "screenreader [on/off]", category: "utility", staff: false },
  colors: { usage: "colors", category: "utility", staff: false },
  clear: { usage: "clear", category: "utility", staff: false },
  quit: { usage: "quit/exit", category: "utility", staff: false },
  phase: { usage: "phase/layer [instance]", category: "utility", staff: false },
  // Staff commands
  goto: { usage: "goto <zone:room | room | zone:>", category: "admin", staff: true },
  transfer: { usage: "transfer <player> <room>", category: "admin", staff: true },
  spawn: { usage: "spawn <mob-template>", category: "admin", staff: true },
  smite: { usage: "smite <player|mob>", category: "admin", staff: true },
  staff_kick: { usage: "kick <player>", category: "admin", staff: true },
  dispel: { usage: "dispel <player|mob>", category: "admin", staff: true },
  setlevel: { usage: "setlevel <player> <level>", category: "admin", staff: true },
  shutdown: { usage: "shutdown", category: "admin", staff: true },
  reload: { usage: "reload [scope]", category: "admin", staff: true },
  possess: { usage: "possess/switch <mob>", category: "admin", staff: true },
  return: { usage: "return/unpossess", category: "admin", staff: true },
  invis: { usage: "invis", category: "admin", staff: true },
  broadcast: { usage: "broadcast <message>", category: "admin", staff: true },
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
