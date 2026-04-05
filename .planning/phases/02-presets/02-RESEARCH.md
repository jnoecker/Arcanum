# Phase 2: Presets - Research

**Researched:** 2026-04-04
**Domain:** Game balance preset data authoring + TypeScript data structure design
**Confidence:** HIGH

## Summary

Phase 2 is a pure data phase -- no UI, no store integration, no Rust changes. The deliverable is three `DeepPartial<AppConfig>` overlay objects (Casual, Balanced, Hardcore) covering all 137 tunable scalar fields cataloged in FIELD_METADATA, plus metadata (name, description, per-section philosophy notes). The existing Phase 1 infrastructure provides everything needed: `DeepPartial<T>` type, `computeMetrics()` for balance validation, `computeDiff()` for coverage verification, and `FIELD_METADATA` as the authoritative field list.

The main challenge is game design authoring -- choosing numeric values across 9+ gameplay systems that produce internally consistent and meaningfully differentiated `MetricSnapshot` outputs. The presets must satisfy both structural requirements (type-safe overlay, full coverage, validation-clean) and design requirements (Casual feels easy, Hardcore feels punishing, Balanced sits in a well-tuned middle).

**Primary recommendation:** Create a single `presets.ts` file in `creator/src/lib/tuning/` exporting three typed preset constants, plus a `presets.test.ts` that uses `computeMetrics()` to assert meaningful differentiation and `FIELD_METADATA` to assert full coverage.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Every preset defines values for ALL tunable fields in FIELD_METADATA (~137 fields). No field is left to fall through to defaults.
- **D-02:** Low-impact fields (weather timing, navigation cooldowns, friend limits) may share the same value across presets. Only fields that shape gameplay feel need to differ between Casual/Balanced/Hardcore.
- **D-03:** The "Balanced" preset is NOT identical to Kotlin server defaults. It is a distinct opinionated configuration. Server defaults are essentially untuned and should not be treated as a reference baseline.
- **D-04:** All 3 presets are standalone opinionated overlays representing a gameplay philosophy. Casual softens the experience, Balanced provides a well-tuned middle ground, Hardcore increases challenge. Comparisons are always against the user's current config, not against server defaults.
- **D-05:** No DEFAULT_CONFIG constant is needed. The server defaults are not a meaningful baseline. Presets are self-contained overlays applied over whatever the user currently has.

### Claude's Discretion
- Preset numeric values: Claude should author values that produce sensible derived metrics via computeMetrics() -- e.g., Casual should show lower XP requirements, higher gold drops, lower mob damage vs Hardcore.
- Preset structure: Claude decides whether to use a single file or split across files, and what metadata (name, description, theme tags) each preset carries.
- Validation approach: Claude decides how to verify preset quality -- metric assertions in tests, cross-field consistency checks, and/or existing validateConfig integration.

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRES-01 | 3 themed presets defined: Casual, Balanced, Hardcore | Preset interface and constant structure documented below; all 3 exported from single file |
| PRES-02 | Each preset covers all gameplay systems: combat, mob tiers, progression, stats, economy, crafting, quests, social, world timing | FIELD_METADATA has 137 fields across all these systems; coverage test verifies completeness |
| PRES-03 | Presets stored as partial overlays (DeepPartial<AppConfig>) to survive schema evolution | `DeepPartial<T>` already defined in `types.ts`; overlay pattern proven in `templates.ts` |
| PRES-04 | Preset values validated against existing config validation rules | `validateConfig()` can be called after merging preset with a mock full config via `applyTemplate()` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.8.0 | Preset data definition | Already in project |
| Vitest | ^3.0.0 | Preset validation tests | Already configured in project |

### Supporting
No new libraries needed. This phase is pure data authoring using existing types and utilities.

**Installation:** None required.

## Architecture Patterns

### Recommended Project Structure
```
creator/src/lib/tuning/
  types.ts            # (existing) DeepPartial, FieldMeta, MetricSnapshot, etc.
  fieldMetadata.ts    # (existing) FIELD_METADATA -- 137 field catalog
  formulas.ts         # (existing) computeMetrics()
  diffEngine.ts       # (existing) computeDiff()
  presets.ts          # NEW -- TuningPreset interface + 3 preset constants
  __tests__/
    presets.test.ts   # NEW -- coverage, differentiation, validation tests
```

### Pattern 1: Preset Data Shape
**What:** Each preset is a typed constant with metadata + a `DeepPartial<AppConfig>` overlay.
**When to use:** All three presets follow this exact shape.
**Example:**
```typescript
// Source: Project convention from templates.ts + CONTEXT.md decisions
interface TuningPreset {
  id: string;
  name: string;
  description: string;
  sectionDescriptions: Record<string, string>;  // per-TuningSection philosophy
  config: DeepPartial<AppConfig>;
}

export const CASUAL_PRESET: TuningPreset = { ... };
export const BALANCED_PRESET: TuningPreset = { ... };
export const HARDCORE_PRESET: TuningPreset = { ... };

export const TUNING_PRESETS: TuningPreset[] = [CASUAL_PRESET, BALANCED_PRESET, HARDCORE_PRESET];
```

### Pattern 2: Coverage Verification via FIELD_METADATA
**What:** Test that walks every key in FIELD_METADATA and verifies it exists in each preset's config overlay using dot-path traversal.
**When to use:** As a test assertion to guarantee PRES-02 (full system coverage).
**Example:**
```typescript
// Walk dot-path to check preset has value for every tunable field
for (const path of Object.keys(FIELD_METADATA)) {
  const val = getNestedValue(preset.config as Record<string, unknown>, path);
  expect(val, `${preset.id} missing field: ${path}`).not.toBeUndefined();
}
```

### Pattern 3: Metric Differentiation Assertions
**What:** Use `computeMetrics()` on a full mock config merged with each preset to verify Casual < Balanced < Hardcore for challenge metrics (mob HP, damage, XP requirements) and Casual > Balanced > Hardcore for reward/ease metrics (gold drops, regen speed).
**When to use:** Test suite to validate preset game design intent.
**Example:**
```typescript
const casualMetrics = computeMetrics(applyTemplate(baseConfig, CASUAL_PRESET.config));
const hardcoreMetrics = computeMetrics(applyTemplate(baseConfig, HARDCORE_PRESET.config));
// Casual XP requirements should be lower than Hardcore
expect(casualMetrics.xpPerLevel[20]).toBeLessThan(hardcoreMetrics.xpPerLevel[20]);
// Casual mob damage should be lower than Hardcore
expect(casualMetrics.mobDamageAvg["standard"]![20]).toBeLessThan(hardcoreMetrics.mobDamageAvg["standard"]![20]);
```

### Anti-Patterns to Avoid
- **Referencing server defaults as "baseline":** Per D-03/D-04, Kotlin defaults are untuned. All presets are standalone opinionated configs.
- **Splitting presets across many files:** 137 fields per preset is substantial but manageable in a single file with clear section comments. Splitting adds import complexity for no real benefit.
- **Using arrays for presets:** Use named constants (`CASUAL_PRESET`, etc.) for direct import in later phases. Also export an array for iteration.
- **Omitting optional config sections:** Fields like `prestige`, `gambling`, `lottery`, `guildHalls`, `autoQuests`, `dailyQuests`, `globalQuests`, `leaderboard`, `respec` are optional (`?`) on `AppConfig`. Presets MUST include values for them since FIELD_METADATA catalogs their tunable fields.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deep merge of preset onto config | Custom merge function | `applyTemplate()` from `templates.ts` | Already handles recursive object merge correctly |
| Coverage checking | Manual field list | `FIELD_METADATA` keys + `getNestedValue()` from `diffEngine.ts` | Authoritative list of all 137 tunable paths |
| Balance validation | Manual metric calculation | `computeMetrics()` from `formulas.ts` | Already implements all server formulas |
| Config validation | Custom validation | `validateConfig()` from `validateConfig.ts` | Already mirrors Kotlin server validation |

**Key insight:** All infrastructure for verifying preset correctness already exists from Phase 1. The only new code is the preset data itself and a test file.

## Common Pitfalls

### Pitfall 1: Optional Config Sections
**What goes wrong:** Preset omits a section like `prestige` or `gambling` because it's marked `?` on AppConfig, but FIELD_METADATA includes fields for it. Coverage test fails.
**Why it happens:** TypeScript won't error on missing optional properties.
**How to avoid:** The coverage test (walking all FIELD_METADATA keys) catches this. Author all sections explicitly.
**Warning signs:** Test reporting "missing field: prestige.xpCostBase" etc.

### Pitfall 2: Field Path Mismatch Between FIELD_METADATA and AppConfig
**What goes wrong:** FIELD_METADATA uses paths like `gambling.minBet` but the TypeScript interface might name it differently (Kotlin uses `diceMinBet`).
**Why it happens:** TypeScript config interface was manually translated from Kotlin and may use simplified names.
**How to avoid:** Use the TypeScript `AppConfig` interface field names (not Kotlin names). FIELD_METADATA already uses the TypeScript paths. Cross-reference: `GamblingConfig.minBet`, `GamblingConfig.maxBet`, `GamblingConfig.winChance`, `GamblingConfig.winMultiplier`.
**Warning signs:** Dot-path traversal returns `undefined` for fields you believe you defined.

### Pitfall 3: Metrics Don't Differentiate Meaningfully
**What goes wrong:** Casual and Balanced presets produce nearly identical MetricSnapshot values because the numeric differences are too small.
**Why it happens:** Using conservative value changes (e.g., XP exponent 1.9 vs 2.0) produces negligible differences at representative levels.
**How to avoid:** Use `computeMetrics()` during authoring to verify meaningful spread at levels [1, 5, 10, 20, 30, 50]. XP differences should be 2-3x between Casual and Hardcore at level 30+. Mob HP should differ by 50%+.
**Warning signs:** Metric comparison tests pass but with very small deltas.

### Pitfall 4: applyTemplate Needs a Full Config Base
**What goes wrong:** `computeMetrics()` requires a full `AppConfig` (not partial). Applying a preset overlay onto an empty object leaves fields undefined, causing runtime errors.
**Why it happens:** `applyTemplate()` deep-merges onto target. If target is empty, you get the preset's partial values only.
**How to avoid:** Tests must construct a reasonable full `AppConfig` mock (or borrow the existing mockConfig pattern from `formulas.test.ts`) and merge the preset onto that.
**Warning signs:** "Cannot read property of undefined" in `computeMetrics()`.

### Pitfall 5: Boolean and Enabled Fields
**What goes wrong:** FIELD_METADATA includes boolean fields like `gambling.enabled`, `lottery.enabled`, `housing.enabled`, `prestige.enabled`. These need explicit boolean values in the preset, not just the numeric tuning fields.
**Why it happens:** Easy to focus on numeric values and forget the system enable/disable toggles.
**How to avoid:** Coverage test catches it. Casual might enable more player-friendly systems (housing, dailyQuests) while Hardcore might disable some convenience features.
**Warning signs:** Coverage test reports missing boolean fields.

## Code Examples

### Preset Interface Definition
```typescript
// Source: Derived from templates.ts ProjectTemplate pattern + CONTEXT.md
import type { AppConfig } from "@/types/config";
import type { DeepPartial, TuningSection } from "./types";

export interface TuningPreset {
  /** Unique identifier for the preset */
  id: string;
  /** Display name shown in the wizard */
  name: string;
  /** Short description of the preset philosophy */
  description: string;
  /** Per-section explanation of what this preset does to each area */
  sectionDescriptions: Partial<Record<TuningSection, string>>;
  /** The partial config overlay */
  config: DeepPartial<AppConfig>;
}
```

### Coverage Test Pattern
```typescript
// Source: Derived from diffEngine.ts getNestedValue
import { FIELD_METADATA } from "@/lib/tuning/fieldMetadata";
import { TUNING_PRESETS } from "@/lib/tuning/presets";

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>(
    (acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined),
    obj,
  );
}

describe("preset coverage", () => {
  const fieldPaths = Object.keys(FIELD_METADATA);

  for (const preset of TUNING_PRESETS) {
    it(`${preset.id} covers all ${fieldPaths.length} tunable fields`, () => {
      for (const path of fieldPaths) {
        const val = getNestedValue(preset.config as Record<string, unknown>, path);
        expect(val, `missing: ${path}`).not.toBeUndefined();
      }
    });
  }
});
```

### Kotlin Default Values Reference (for authoring context, NOT as baseline)
Key server defaults (presets should NOT copy these verbatim per D-03):
```
combat.tickMillis: 2000, combat.maxCombatsPerTick: 20, combat.minDamage: 1, combat.maxDamage: 4
mobTiers.weak: baseHp=5, hpPerLevel=2, baseMinDamage=1, baseMaxDamage=2
mobTiers.standard: baseHp=10, hpPerLevel=3, baseMinDamage=1, baseMaxDamage=4
mobTiers.elite: baseHp=20, hpPerLevel=5, baseMinDamage=2, baseMaxDamage=6
mobTiers.boss: baseHp=50, hpPerLevel=10, baseMinDamage=3, baseMaxDamage=8
progression.maxLevel: 50, xp.baseXp: 100, xp.exponent: 2.0, xp.multiplier: 1.0
progression.rewards: baseHp=10, hpPerLevel=2, baseMana=20, manaPerLevel=5
stats.bindings: meleeDamageDivisor=3, dodgePerPoint=2, maxDodgePercent=30
economy: buyMultiplier=1.0, sellMultiplier=0.5
regen: baseIntervalMillis=5000, minIntervalMillis=1000, regenAmount=1
```

### Preset Philosophy Guidance
```
CASUAL:
  - XP curve: lower exponent (~1.6), higher multiplier reduction → faster leveling
  - Mob HP/damage: 30-50% lower than Balanced → quicker kills, less danger
  - Gold drops: 50-100% higher → easier economy
  - Regen: faster base interval → less downtime
  - Stat scaling: more generous (lower divisors) → stats feel impactful sooner

BALANCED:
  - XP curve: moderate (~1.8 exponent) → steady but not grindy
  - Mob HP/damage: tuned for 3-5 hit kills on standard mobs → satisfying combat
  - Gold: calibrated buy/sell spread for healthy economy
  - Regen: moderate → some resource management
  - All systems enabled

HARDCORE:
  - XP curve: steep (~2.2 exponent) → significant late-game grind
  - Mob HP/damage: 50-100% higher than Balanced → deadly encounters
  - Gold: tighter economy (higher buy, lower sell multiplier)
  - Regen: slower → force potion/healer dependency
  - Prestige: higher costs, more ranks → extended endgame
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single file with all presets | Still recommended | N/A | 137 fields x 3 presets is large but navigable with section comments |
| Kotlin defaults as reference | Standalone opinionated presets (D-03) | Design decision | Presets are independently authored, not derived from defaults |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3 |
| Config file | `creator/vitest.config.ts` |
| Quick run command | `cd creator && bun run test -- --run src/lib/tuning/__tests__/presets.test.ts` |
| Full suite command | `cd creator && bun run test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRES-01 | 3 presets defined with correct IDs | unit | `cd creator && bun run test -- --run src/lib/tuning/__tests__/presets.test.ts` | Wave 0 |
| PRES-02 | Each preset covers all 137 FIELD_METADATA paths | unit | same | Wave 0 |
| PRES-03 | Presets typed as DeepPartial<AppConfig> (compile-time) | unit | `cd creator && bunx tsc --noEmit` | N/A (type check) |
| PRES-04 | Preset values pass validateConfig when merged onto full config | unit | same test file | Wave 0 |

### Additional Quality Tests (not requirement-mapped but high value)
| Behavior | Test Type | Rationale |
|----------|-----------|-----------|
| Casual XP < Balanced XP < Hardcore XP at representative levels | unit | Verifies game design intent |
| Casual mob HP < Balanced < Hardcore | unit | Verifies difficulty scaling |
| Casual gold drops > Balanced > Hardcore | unit | Verifies economy philosophy |
| All presets have non-empty name, description, sectionDescriptions | unit | Downstream UI depends on metadata |

### Sampling Rate
- **Per task commit:** `cd creator && bun run test -- --run src/lib/tuning/__tests__/presets.test.ts`
- **Per wave merge:** `cd creator && bun run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `creator/src/lib/tuning/__tests__/presets.test.ts` -- covers PRES-01, PRES-02, PRES-04 + differentiation
- [ ] Full mock `AppConfig` needed in test (extend existing `mockConfig` from `formulas.test.ts` to cover all sections)

## Open Questions

1. **GuildHalls.baseCost vs purchaseCost naming**
   - What we know: Kotlin uses `purchaseCost`, TypeScript config uses `baseCost`. FIELD_METADATA uses `guildHalls.baseCost`.
   - What's unclear: Nothing -- just follow the TypeScript/FIELD_METADATA naming.
   - Recommendation: Use `guildHalls.baseCost` in preset overlay. The coverage test will catch any mismatch.

2. **autoQuests.rewardScaling field**
   - What we know: This field exists in TypeScript `AutoQuestsConfig` and FIELD_METADATA but has no direct Kotlin equivalent (Kotlin uses separate `rewardGoldBase`, `rewardXpBase` etc.)
   - What's unclear: What numeric range `rewardScaling` expects.
   - Recommendation: Treat as a multiplier (1.0 = normal). Casual: 1.5, Balanced: 1.0, Hardcore: 0.75.

3. **Full mock AppConfig for testing**
   - What we know: `formulas.test.ts` has a partial mock. Testing presets with `validateConfig()` needs a fuller mock including sections like `server`, `statusEffects`, `classes`.
   - What's unclear: How extensive the mock needs to be.
   - Recommendation: Build a minimal-but-complete mock that satisfies `validateConfig()`. Only the fields validated need real values. Use the test to discover which fields are required.

## Sources

### Primary (HIGH confidence)
- `creator/src/lib/tuning/types.ts` -- DeepPartial type, TuningSection enum, MetricSnapshot interface
- `creator/src/lib/tuning/fieldMetadata.ts` -- All 137 tunable field paths (verified: exactly 137 entries)
- `creator/src/lib/tuning/formulas.ts` -- computeMetrics() implementation
- `creator/src/lib/tuning/diffEngine.ts` -- computeDiff(), getNestedValue() helper
- `creator/src/lib/templates.ts` -- applyTemplate() deep merge, ProjectTemplate pattern
- `creator/src/lib/validateConfig.ts` -- Config validation rules
- `creator/src/types/config.ts` -- Full AppConfig interface (TypeScript field names)
- `reference/config/AppConfig.kt` -- Kotlin server defaults (for reference, not baseline)
- `creator/src/lib/tuning/__tests__/formulas.test.ts` -- Existing test patterns, mockConfig shape

### Secondary (MEDIUM confidence)
- Game design guidance for preset values (derived from formula analysis and server defaults)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, all infrastructure exists
- Architecture: HIGH - Single file + test file, following established patterns
- Pitfalls: HIGH - All identified from code analysis, verified against actual source
- Preset values: MEDIUM - Game design judgment required, but computeMetrics() provides objective validation

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable -- Phase 1 artifacts are frozen)
