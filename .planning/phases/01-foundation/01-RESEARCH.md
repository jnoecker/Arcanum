# Phase 1: Foundation - Research

**Researched:** 2026-04-04
**Domain:** TypeScript pure-function infrastructure (types, diff engine, formula evaluator, field metadata)
**Confidence:** HIGH

## Summary

Phase 1 builds the pure-function data layer for the Tuning Wizard. No UI, no stores, no React -- just TypeScript modules in `creator/src/lib/tuning/` with Vitest tests. The work breaks into four deliverables: (1) tuning types based on the existing `DeepPartial<AppConfig>`, (2) a formula evaluator that computes derived metrics matching the Kotlin server reference, (3) a diff engine for structured field-level change detection, and (4) a field metadata catalog covering ~300+ tunable fields.

The existing codebase provides strong foundations: `DeepPartial<AppConfig>` is already defined in `templates.ts`, the `AppConfig` interface is comprehensive (745 lines, 40+ sub-interfaces), and the Kotlin reference in `reference/config/AppConfig.kt` provides exact default values and validation rules for all formulas. The Vitest infrastructure is already configured with path aliases.

**Primary recommendation:** Reuse the existing `DeepPartial<AppConfig>` type from `templates.ts`, implement formula functions as pure stateless evaluators referencing Kotlin defaults, build the diff engine as a generic recursive object comparison, and define field metadata as a typed constant map keyed by dot-path config keys.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 4 coarse sections for grouping fields, presets, and accept/reject:
  1. **Combat & Stats** -- mob tiers, damage formulas, stat bindings, dodge mechanics
  2. **Economy & Crafting** -- gold drops, shop multipliers, crafting costs, gambling, lottery
  3. **Progression & Quests** -- XP curve, level-up rewards, bounties, dailies, prestige, skill points
  4. **World & Social** -- day/night cycle, weather, groups, guilds, factions, regen
- **D-02:** Section assignment is a property of each field in the metadata catalog. Every gameplay field maps to exactly one section.
- **D-03:** Implement all 4 derived metric categories in Phase 1:
  - XP-to-level curve (baseXp, exponent, linearXp, multiplier)
  - Combat output (player damage per hit using stat bindings, mob HP/damage at level using tier config)
  - Gold economy (gold per mob kill at level, shop price with multipliers)
  - Survivability (player HP at level, regen rate, dodge chance)
- **D-04:** Formulas should reference Kotlin source in `reference/config/AppConfig.kt` for accuracy. Evaluate formulas at representative levels (1, 5, 10, 20, 30, 50) for comparison snapshots.
- **D-05:** Rich metadata for ALL gameplay fields (~300+): human-readable label, 1-sentence description, valid range (min/max), interaction notes, gameplay impact tag (high/medium/low).

### Claude's Discretion
- Formula accuracy: Close approximation preferred over exact server match when deeper Kotlin domain model would be needed. Document any known deviations in code comments.
- Diff engine granularity: Flat field-level diffs vs tree structure -- decide based on what best serves the comparison view.

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | Tuning wizard types defined as DeepPartial<AppConfig> organized into tuning sections | Existing `DeepPartial<AppConfig>` in `templates.ts` can be re-exported. Section type uses the 4 locked section names from D-01. |
| FOUND-02 | Formula evaluator implements key server formulas in TypeScript (damage, XP curve, mob stats, regen, dodge) | Kotlin defaults extracted from `AppConfig.kt`: XP formula fields, mob tier defaults, stat binding defaults, regen config. Formulas documented below. |
| FOUND-03 | Diff engine computes structured field-level changes between current config and preset | Generic recursive object diff with dot-path keys. Groups by section using metadata catalog. |
| FOUND-04 | Field metadata catalog provides human-readable labels, descriptions, and grouping for all tunable fields | ~300+ fields across AppConfig sub-interfaces. Section mapping per D-01/D-02. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.8.0 | Language for all pure functions | Already configured in project |
| Vitest | ^3.0.0 | Test runner for pure-function tests | Already configured in project |

### Supporting
No additional libraries needed. This phase is pure TypeScript with no external dependencies. All code uses existing project types and patterns.

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
creator/src/lib/tuning/
  types.ts           # TuningSection enum, TuningPreset, DiffEntry, MetricSnapshot, re-export DeepPartial
  formulas.ts        # Pure formula evaluators (xpForLevel, mobHpAtLevel, dodgeChance, etc.)
  diffEngine.ts      # Recursive config diff with dot-path keys, grouped by section
  fieldMetadata.ts   # FIELD_METADATA constant map: config path -> label, description, section, range, impact
  __tests__/
    formulas.test.ts
    diffEngine.test.ts
    fieldMetadata.test.ts
```

### Pattern 1: Pure Formula Evaluators
**What:** Stateless functions that compute derived metrics from config values
**When to use:** Every derived metric the wizard needs to display
**Example:**
```typescript
// Source: reference/config/AppConfig.kt XpCurveConfig defaults
interface XpCurveParams {
  baseXp: number;
  exponent: number;
  linearXp: number;
  multiplier: number;
}

/**
 * XP required to reach a given level.
 * Formula: (baseXp * level^exponent + linearXp * level) * multiplier
 * Kotlin reference: XpCurveConfig in AppConfig.kt (lines 1712-1718)
 */
export function xpForLevel(level: number, params: XpCurveParams): number {
  return Math.floor(
    (params.baseXp * Math.pow(level, params.exponent) + params.linearXp * level) * params.multiplier
  );
}
```

### Pattern 2: Field Metadata as Typed Constant Map
**What:** A single source of truth mapping every config dot-path to its metadata
**When to use:** Labels, descriptions, tooltips, section grouping, search/filter
**Example:**
```typescript
export const enum TuningSection {
  CombatStats = "Combat & Stats",
  EconomyCrafting = "Economy & Crafting",
  ProgressionQuests = "Progression & Quests",
  WorldSocial = "World & Social",
}

export interface FieldMeta {
  label: string;
  description: string;
  section: TuningSection;
  min?: number;
  max?: number;
  impact: "high" | "medium" | "low";
  interactionNote?: string;
}

export const FIELD_METADATA: Record<string, FieldMeta> = {
  "progression.xp.baseXp": {
    label: "Base XP",
    description: "Base experience points used in the XP curve formula",
    section: TuningSection.ProgressionQuests,
    min: 1,
    impact: "high",
    interactionNote: "Core multiplier in XP curve -- affects all leveling speed",
  },
  // ... ~300+ entries
};
```

### Pattern 3: Recursive Diff Engine
**What:** Generic deep comparison producing flat diff entries with dot-path keys
**When to use:** Comparing current config against a preset overlay
**Example:**
```typescript
export interface DiffEntry {
  path: string;           // e.g. "mobTiers.weak.baseHp"
  label: string;          // from FIELD_METADATA
  section: TuningSection; // from FIELD_METADATA
  oldValue: unknown;
  newValue: unknown;
}

export function computeDiff(
  current: Record<string, unknown>,
  preset: Record<string, unknown>,
  prefix?: string,
): DiffEntry[] {
  // Recursive traversal, only leaf values that differ
  // Looks up FIELD_METADATA for label/section
}
```

### Pattern 4: Metric Snapshot at Representative Levels
**What:** Evaluate all formulas at fixed levels to produce structured comparison data
**When to use:** Generating before/after data for charts and tables
**Example:**
```typescript
export const REPRESENTATIVE_LEVELS = [1, 5, 10, 20, 30, 50] as const;

export interface MetricSnapshot {
  xpPerLevel: Record<number, number>;           // level -> XP required
  mobHp: Record<string, Record<number, number>>; // tier -> level -> HP
  mobDamageAvg: Record<string, Record<number, number>>;
  mobGoldAvg: Record<string, Record<number, number>>;
  playerDamageBonus: Record<number, number>;     // level -> bonus from stat
  playerHp: Record<number, number>;              // level -> total HP
  dodgeChance: Record<number, number>;           // level -> dodge %
  regenInterval: Record<number, number>;         // level -> ms between ticks
}

export function computeMetrics(config: AppConfig): MetricSnapshot { ... }
```

### Anti-Patterns to Avoid
- **Coupling to stores:** These are pure functions. Do NOT import from any Zustand store. Accept config data as parameters.
- **Mutating config objects:** Always return new objects. Never modify input parameters.
- **Hardcoding defaults:** Use the AppConfig values passed in, not hardcoded numbers. The Kotlin defaults are only for test assertions.
- **Over-engineering the diff:** The diff engine compares leaf values only. Don't diff Record<string, ComplexObject> entries (abilities, classes, etc.) -- those are definition registries, not tunable scalars.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deep partial type | Custom recursive partial | `DeepPartial<AppConfig>` from `templates.ts` | Already exists, tested in template system |
| Deep merge | Custom merge logic | `applyTemplate()` from `templates.ts` | Already handles deep merge correctly |
| Object path traversal | Custom dot-path walker | Simple recursive function | The diff engine IS the walker -- no library needed for this scale |

**Key insight:** The existing `templates.ts` already solves the type and merge problems. The formula evaluator and diff engine are straightforward enough to be custom code -- no libraries needed.

## Common Pitfalls

### Pitfall 1: XP Formula Precision
**What goes wrong:** JavaScript floating-point arithmetic produces slightly different results than Kotlin's Long/Double math
**Why it happens:** The Kotlin server uses `Long` for XP values. JavaScript has only `number` (IEEE 754 double).
**How to avoid:** Use `Math.floor()` on all XP calculations to match integer truncation. For values up to level 50 with default exponent 2.0, precision is not an issue (max XP ~250,000 fits cleanly in a double).
**Warning signs:** Test assertions failing by +/- 1 on large values.

### Pitfall 2: Missing Kotlin Formula Source
**What goes wrong:** The XP formula computation is NOT in `reference/config/AppConfig.kt` -- it's in the game engine code (not included in reference/).
**Why it happens:** AppConfig.kt only defines the config shape and defaults, not the runtime computation.
**How to avoid:** Infer the formula from the field names: `(baseXp * level^exponent + linearXp * level) * multiplier`. This is the standard MUD XP curve pattern and matches the field semantics exactly. Document the inference in code comments.
**Warning signs:** None -- this is a known gap.

### Pitfall 3: Diff Engine Scope Creep
**What goes wrong:** Trying to diff complex nested objects like ability definitions, class definitions, race definitions.
**Why it happens:** These are definition registries (Record<string, ComplexObject>), not tunable scalar values.
**How to avoid:** The diff engine should only operate on "tunable" fields -- fields that have entries in FIELD_METADATA. Skip any path not in the metadata catalog. This naturally excludes definitions, commands, and other non-tunable structures.
**Warning signs:** Diff producing hundreds of entries for ability/class/race definitions.

### Pitfall 4: Field Metadata Completeness
**What goes wrong:** Missing fields in the metadata catalog causes gaps in the wizard UI.
**Why it happens:** AppConfig has 40+ sub-interfaces with hundreds of fields. Easy to miss some.
**How to avoid:** Systematically enumerate every leaf field in every sub-interface that contains a tunable numeric/boolean value. Use the TypeScript interface definitions as the source of truth. Non-tunable fields (server ports, display names, descriptions, string IDs) should be excluded.
**Warning signs:** Downstream phases discovering fields without metadata.

### Pitfall 5: Section Assignment Ambiguity
**What goes wrong:** Some fields could logically belong to multiple sections (e.g., "group XP bonus" is both social and progression).
**Why it happens:** The 4-section model is intentionally coarse.
**How to avoid:** Follow D-01 definitions strictly. When ambiguous, prefer the section where the field's PRIMARY effect is felt. Group XP bonus -> World & Social (because it's a group mechanic). Document borderline decisions in the metadata's `interactionNote`.

## Code Examples

### Kotlin Default Values (verified from AppConfig.kt)

```typescript
// XP Curve defaults (lines 1712-1718)
const DEFAULT_XP_CURVE = {
  baseXp: 100,
  exponent: 2.0,
  linearXp: 0,
  multiplier: 1.0,
  defaultKillXp: 50,
};

// Mob Tier defaults (lines 1743-1799)
const DEFAULT_MOB_TIERS = {
  weak:     { baseHp: 5,  hpPerLevel: 2,  baseMinDamage: 1, baseMaxDamage: 2, damagePerLevel: 0, baseArmor: 0, baseXpReward: 15,  xpRewardPerLevel: 5,  baseGoldMin: 1,  baseGoldMax: 3,   goldPerLevel: 1 },
  standard: { baseHp: 10, hpPerLevel: 3,  baseMinDamage: 1, baseMaxDamage: 4, damagePerLevel: 1, baseArmor: 0, baseXpReward: 30,  xpRewardPerLevel: 10, baseGoldMin: 2,  baseGoldMax: 8,   goldPerLevel: 2 },
  elite:    { baseHp: 20, hpPerLevel: 5,  baseMinDamage: 2, baseMaxDamage: 6, damagePerLevel: 1, baseArmor: 1, baseXpReward: 75,  xpRewardPerLevel: 20, baseGoldMin: 10, baseGoldMax: 25,  goldPerLevel: 5 },
  boss:     { baseHp: 50, hpPerLevel: 10, baseMinDamage: 3, baseMaxDamage: 8, damagePerLevel: 2, baseArmor: 3, baseXpReward: 200, xpRewardPerLevel: 50, baseGoldMin: 50, baseGoldMax: 100, goldPerLevel: 15 },
};

// Stat Bindings defaults (lines 1640-1658)
const DEFAULT_STAT_BINDINGS = {
  meleeDamageStat: "STR",
  meleeDamageDivisor: 3,
  dodgeStat: "DEX",
  dodgePerPoint: 2,
  maxDodgePercent: 30,
  spellDamageStat: "INT",
  spellDamageDivisor: 3,
  hpScalingStat: "CON",
  hpScalingDivisor: 5,
  manaScalingStat: "INT",
  manaScalingDivisor: 5,
  hpRegenStat: "CON",
  hpRegenMsPerPoint: 200,
  manaRegenStat: "WIS",
  manaRegenMsPerPoint: 200,
  xpBonusStat: "CHA",
  xpBonusPerPoint: 0.005,
};

// Level Rewards defaults (lines 1720-1727)
const DEFAULT_LEVEL_REWARDS = {
  hpPerLevel: 2,
  manaPerLevel: 5,
  fullHealOnLevelUp: true,
  fullManaOnLevelUp: true,
  baseHp: 10,
  baseMana: 20,
};

// Regen defaults (lines 1830-1842)
const DEFAULT_REGEN = {
  maxPlayersPerTick: 50,
  baseIntervalMillis: 5000,
  minIntervalMillis: 1000,
  regenAmount: 1,
  mana: {
    baseIntervalMillis: 3000,
    minIntervalMillis: 1000,
    regenAmount: 1,
  },
};

// Economy defaults (lines 725-728)
const DEFAULT_ECONOMY = {
  buyMultiplier: 1.0,
  sellMultiplier: 0.5,
};

// Combat defaults (lines 1817-1823)
const DEFAULT_COMBAT = {
  maxCombatsPerTick: 20,
  tickMillis: 2000,
  minDamage: 1,
  maxDamage: 4,
};
```

### Formula Implementations

```typescript
// Source: Inferred from XpCurveConfig field semantics + standard MUD pattern
// Note: Exact Kotlin computation not in reference/ -- formula inferred from config fields
export function xpForLevel(level: number, xp: XpCurveConfig): number {
  return Math.floor(
    (xp.baseXp * Math.pow(level, xp.exponent) + xp.linearXp * level) * xp.multiplier
  );
}

// Source: reference/config/AppConfig.kt MobTierConfig (lines 1729-1741)
// mob HP at level = baseHp + hpPerLevel * level
export function mobHpAtLevel(tier: MobTierConfig, level: number): number {
  return tier.baseHp + tier.hpPerLevel * level;
}

// mob avg damage at level = ((baseMinDamage + baseMaxDamage) / 2) + damagePerLevel * level
export function mobAvgDamageAtLevel(tier: MobTierConfig, level: number): number {
  return (tier.baseMinDamage + tier.baseMaxDamage) / 2 + tier.damagePerLevel * level;
}

// mob gold at level (average) = ((baseGoldMin + baseGoldMax) / 2) + goldPerLevel * level
export function mobAvgGoldAtLevel(tier: MobTierConfig, level: number): number {
  return (tier.baseGoldMin + tier.baseGoldMax) / 2 + tier.goldPerLevel * level;
}

// Source: reference/DATA_DRIVEN_STATS_PLAN.md line 80-81
// statBonus = floor(statValue / divisor)
// melee damage bonus = statBonus(stat, meleeDamageDivisor)
export function statBonus(statValue: number, divisor: number): number {
  return Math.floor(statValue / divisor);
}

// dodge chance = min(dodgePerPoint * statBonus(dodgeStat, 1), maxDodgePercent)
// Note: dodgeStat divisor is 1 per DATA_DRIVEN_STATS_PLAN.md line 81
export function dodgeChance(dodgeStatValue: number, bindings: StatBindings): number {
  return Math.min(bindings.dodgePerPoint * dodgeStatValue, bindings.maxDodgePercent);
}

// player HP at level = baseHp + (rewards.hpPerLevel + classHpPerLevel) * level
//   + statBonus(hpScalingStat, hpScalingDivisor) * level
// Note: This is an approximation. Exact server formula involves class-specific HP
// and stat scaling that requires the full player model.
export function playerHpAtLevel(
  level: number,
  rewards: LevelRewardsConfig,
  classHpPerLevel: number,
  hpScalingStat: number,
  hpScalingDivisor: number,
): number {
  const statHpBonus = statBonus(hpScalingStat, hpScalingDivisor);
  return rewards.baseHp + (rewards.hpPerLevel + classHpPerLevel + statHpBonus) * level;
}

// regen interval = max(baseIntervalMillis - hpRegenMsPerPoint * statValue, minIntervalMillis)
export function regenIntervalMs(
  statValue: number,
  regen: RegenConfig,
  hpRegenMsPerPoint: number,
): number {
  return Math.max(
    regen.baseIntervalMillis - hpRegenMsPerPoint * statValue,
    regen.minIntervalMillis,
  );
}
```

### Tunable Field Enumeration Strategy

The following AppConfig sub-interfaces contain tunable numeric/boolean fields. Fields marked with "definitions" or "Record<string, ...>" patterns are definition registries and should be excluded from tuning.

**Tunable sub-interfaces (include in metadata):**
- `combat` (CombatConfig) -- 4 numeric fields
- `mobTiers` (MobTiersConfig) -- 4 tiers x 11 fields = 44 fields
- `progression` (ProgressionConfig) -- maxLevel + 5 XP fields + 6 reward fields = 12 fields
- `economy` (EconomyConfig) -- 2 fields
- `regen` (RegenConfig) -- 7 fields (including mana sub-object)
- `crafting` (CraftingConfig) -- 5 fields
- `stats.bindings` (StatBindings) -- 13 numeric fields (excluding stat name strings)
- `group` (GroupConfig) -- 3 fields
- `navigation.recall` (RecallConfig) -- 1 numeric field (cooldownMs)
- `worldTime` (WorldTimeConfig) -- 5 fields
- `weather` (WeatherConfig) -- 2 fields
- `friends` (FriendsConfig) -- 1 field
- `guild` (GuildConfig) -- 2 numeric fields
- `bank` (BankConfig) -- 1 field
- `housing` (HousingConfig) -- 1 boolean + entryExitDirection string
- `skillPoints` (SkillPointsConfig) -- 1 field
- `multiclass` (MulticlassConfig) -- 2 fields
- `characterCreation` (CharacterCreationConfig) -- 1 numeric field (startingGold)
- `prestige` (PrestigeConfig) -- 4 fields (enabled, xpCostBase, xpCostMultiplier, maxRank)
- `respec` (RespecConfig) -- 2 fields
- `lottery` (LotteryConfig) -- 4 fields
- `gambling` (GamblingConfig) -- 5 fields
- `autoQuests` (AutoQuestsConfig) -- ~8 fields
- `dailyQuests` (DailyQuestsConfig) -- 3 fields (enabled, resetTimeUtc, streakBonusPercent)
- `globalQuests` (GlobalQuestsConfig) -- 3 fields
- `guildHalls` (GuildHallsConfig) -- 2 fields
- `leaderboard` (LeaderboardConfig) -- 2 fields
- `factions` (FactionConfig) -- 3 numeric fields (defaultReputation, killPenalty, killBonus)
- `enchanting` (EnchantingConfig) -- 1 field (maxEnchantmentsPerItem)

**Estimated total tunable fields:** ~140-160 scalar fields. With D-05 requesting metadata for "ALL gameplay fields (~300+)", this likely includes class-level fields (hpPerLevel, manaPerLevel per class) and per-tier mob fields, which pushes the count higher when expanded across tiers/classes.

**Exclude from tuning (definition registries):**
- `stats.definitions` -- stat names/descriptions, not tunable numbers
- `abilities` -- ability definitions, too complex for scalar tuning
- `statusEffects` -- effect definitions
- `classes` -- except hpPerLevel/manaPerLevel which ARE tunable
- `races` -- trait definitions
- `commands` -- command metadata
- `equipmentSlots`, `genders`, `achievementCategories`, etc. -- structural definitions
- `server`, `admin`, `observability`, `logging` -- infrastructure, not gameplay
- `images`, `world` -- non-gameplay config

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `creator/vitest.config.ts` |
| Quick run command | `cd creator && bun run test` |
| Full suite command | `cd creator && bun run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUND-01 | DeepPartial<AppConfig> organized into tuning sections | unit | `cd creator && bunx vitest run src/lib/tuning/__tests__/types.test.ts -x` | Wave 0 |
| FOUND-02a | XP-to-level formula matches Kotlin defaults | unit | `cd creator && bunx vitest run src/lib/tuning/__tests__/formulas.test.ts -x` | Wave 0 |
| FOUND-02b | Mob HP/damage/gold at level formulas correct | unit | `cd creator && bunx vitest run src/lib/tuning/__tests__/formulas.test.ts -x` | Wave 0 |
| FOUND-02c | Dodge chance, regen rate, player HP formulas | unit | `cd creator && bunx vitest run src/lib/tuning/__tests__/formulas.test.ts -x` | Wave 0 |
| FOUND-02d | MetricSnapshot computed at representative levels | unit | `cd creator && bunx vitest run src/lib/tuning/__tests__/formulas.test.ts -x` | Wave 0 |
| FOUND-03a | Diff detects changed scalar values | unit | `cd creator && bunx vitest run src/lib/tuning/__tests__/diffEngine.test.ts -x` | Wave 0 |
| FOUND-03b | Diff groups changes by section | unit | `cd creator && bunx vitest run src/lib/tuning/__tests__/diffEngine.test.ts -x` | Wave 0 |
| FOUND-03c | Diff ignores unchanged values and non-tunable paths | unit | `cd creator && bunx vitest run src/lib/tuning/__tests__/diffEngine.test.ts -x` | Wave 0 |
| FOUND-04a | Every tunable field has metadata entry | unit | `cd creator && bunx vitest run src/lib/tuning/__tests__/fieldMetadata.test.ts -x` | Wave 0 |
| FOUND-04b | Field metadata has valid section assignment | unit | `cd creator && bunx vitest run src/lib/tuning/__tests__/fieldMetadata.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd creator && bun run test`
- **Per wave merge:** `cd creator && bun run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `creator/src/lib/tuning/__tests__/formulas.test.ts` -- covers FOUND-02
- [ ] `creator/src/lib/tuning/__tests__/diffEngine.test.ts` -- covers FOUND-03
- [ ] `creator/src/lib/tuning/__tests__/fieldMetadata.test.ts` -- covers FOUND-04

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded stat names (STR, DEX, etc.) | Data-driven stat bindings via config | Per DATA_DRIVEN_STATS_PLAN.md | Formulas must use binding config, not hardcoded stat names |
| Direct stat access in formulas | `statBonus(effectiveStats[bindings.meleeDamageStat], bindings.meleeDamageDivisor)` | Same migration | Formula evaluator must accept stat bindings as parameter |

## Open Questions

1. **Exact XP formula computation**
   - What we know: Config fields are `baseXp`, `exponent`, `linearXp`, `multiplier`. The standard formula `(baseXp * level^exponent + linearXp * level) * multiplier` matches field semantics.
   - What's unclear: The actual Kotlin computation code is not in the `reference/` directory. The engine code that computes `xpForLevel()` is not available.
   - Recommendation: Use the inferred formula. It matches standard MUD XP curve patterns and the field names are self-documenting. Add a code comment noting the inference. LOW risk of deviation.

2. **Player HP formula complexity**
   - What we know: HP involves `baseHp + (rewards.hpPerLevel + class.hpPerLevel) * level + statBonus(hpScalingStat, hpScalingDivisor) * level`. The stat scaling component references `PlayerProgression.kt` lines 87-93.
   - What's unclear: Whether stat bonus is applied per-level or as a flat bonus. Whether equipment stat bonuses are included.
   - Recommendation: Implement the simplified formula (stat bonus scales per level). Document as approximation. Per Claude's discretion: close approximation is acceptable.

3. **Tunable field count**
   - What we know: ~140-160 scalar fields in direct AppConfig sub-interfaces. D-05 mentions "~300+".
   - What's unclear: Whether the ~300+ includes per-class fields (hpPerLevel, manaPerLevel for each class) or is accounting for future growth.
   - Recommendation: Start with all scalar gameplay fields in fixed-structure sub-interfaces. Per-class and per-tier fields are included when the interface defines them (like mob tiers with 4 tiers x 11 fields = 44). The metadata catalog will naturally grow as more fields are identified.

## Sources

### Primary (HIGH confidence)
- `reference/config/AppConfig.kt` -- All default values, validation rules, config structure (directly read)
- `creator/src/types/config.ts` -- Full AppConfig TypeScript interface (directly read)
- `creator/src/lib/templates.ts` -- DeepPartial type and applyTemplate function (directly read)
- `reference/DATA_DRIVEN_STATS_PLAN.md` -- Stat binding formula patterns (directly read)

### Secondary (MEDIUM confidence)
- `reference/config/AppConfig.kt` validation functions -- Validation constraints (min/max values) for all config fields (directly read)

### Tertiary (LOW confidence)
- XP formula: Inferred from field names, not from actual Kotlin computation code. Standard MUD pattern strongly supports this inference.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, uses existing project infrastructure
- Architecture: HIGH -- follows established patterns from `creator/src/lib/` and `__tests__/`
- Formulas: HIGH for mob/economy/regen (direct from Kotlin defaults), MEDIUM for XP curve (inferred formula)
- Pitfalls: HIGH -- identified from direct code analysis

**Research date:** 2026-04-04
**Valid until:** Indefinite (pure-function infrastructure, no external dependency versioning concerns)
