# Multiplicative Scaling — AmbonMUD Server Migration Spec

Arcanum has switched mob and player level scaling from additive `*PerLevel`
fields to multiplicative `*ScalingRate` fields. The server-side Kotlin code
needs to match or projects will fail to load.

The motivation: player damage already scales as `1.1×/level` (combat scaling
rate). Mob HP was growing linearly, so by L30 mobs were ~10× weaker than the
"same shape of fight at every level" target. Multiplicative mob scaling closes
that gap.

## Field renames

### `MobTierConfig.kt`

| Old | New | Type change |
|---|---|---|
| `hpPerLevel: Int` | `hpScalingRate: Double` | Int → Double |
| `damagePerLevel: Int` | `damageScalingRate: Double` | Int → Double |
| `xpRewardPerLevel: Int` | `xpScalingRate: Double` | Int → Double |
| `goldPerLevel: Int` | `goldScalingRate: Double` | Int → Double |

Unchanged: `baseHp, baseMinDamage, baseMaxDamage, baseArmor, baseXpReward,
baseGoldMin, baseGoldMax`.

### `LevelRewardsConfig.kt` (or equivalent inside the progression block)

| Old | New | Type change |
|---|---|---|
| `hpPerLevel: Int` | `hpScalingRate: Double` | Int → Double |
| `manaPerLevel: Int` | `manaScalingRate: Double` | Int → Double |

Unchanged: `baseHp, baseMana, fullHealOnLevelUp, fullManaOnLevelUp`.

### `ClassDefinitionConfig.kt`

| Old | New | Type change |
|---|---|---|
| `hpPerLevel: Int` | `hpScalingRate: Double` | Int → Double |
| `manaPerLevel: Int` | `manaScalingRate: Double` | Int → Double |

## Kotlin defaults

Use `1.0` as the Kotlin data-class default for every new rate field. A rate of
`1.0` means "no growth, every level equals base", so YAML that's missing the
field will load to a flat baseline rather than silently inheriting the previous
additive behavior. **Authored content must always supply the rate explicitly.**

```kotlin
data class MobTierConfig(
    val baseHp: Int = 5,
    val hpScalingRate: Double = 1.0,
    val baseMinDamage: Int = 1,
    val baseMaxDamage: Int = 2,
    val damageScalingRate: Double = 1.0,
    val baseArmor: Int = 0,
    val baseXpReward: Int = 15,
    val xpScalingRate: Double = 1.0,
    val baseGoldMin: Int = 1,
    val baseGoldMax: Int = 3,
    val goldScalingRate: Double = 1.0,
)
```

## Formula change

Anywhere the engine currently computes `base + perLevel × (level - 1)`, switch
to `floor(base × scalingRate^(level - 1))`. The most likely sites are inside
`WorldLoader` or a `ResolvedMobStats` helper — wherever mob HP, damage, kill
XP, and gold drops are resolved at load time. Example (the names may differ):

```kotlin
// Before
private fun mobHpAtLevel(tier: MobTierConfig, level: Int): Int =
    tier.baseHp + tier.hpPerLevel * (level - 1).coerceAtLeast(0)

// After
private fun mobHpAtLevel(tier: MobTierConfig, level: Int): Int {
    val steps = (level - 1).coerceAtLeast(0)
    return floor(tier.baseHp * tier.hpScalingRate.pow(steps)).toInt()
}
```

Apply the same shape to:

- `mobMinDamageAtLevel`, `mobMaxDamageAtLevel` — use `damageScalingRate`
- `mobXpRewardAtLevel` — use `xpScalingRate`
- `mobGoldMinAtLevel`, `mobGoldMaxAtLevel` — use `goldScalingRate`
- `playerHpAtLevel` — use `LevelRewardsConfig.hpScalingRate` (or, when a class
  is present, `ClassDefinitionConfig.hpScalingRate`). Stat-derived HP bonuses
  remain additive on top of the multiplicative base.
- `playerManaAtLevel` — same treatment with `manaScalingRate`.

Always `floor` the result, matching Arcanum's preview math, so the client and
server agree on the integer the player sees.

If the server combines global progression HP and class HP, the cleanest model
is to pick a single effective rate per character: either replace
`progression.rewards.hpScalingRate` with the class's `hpScalingRate` whenever
the class supplies one (Arcanum's `simulateEncounter` does exactly this), or
multiply the two rates together. The Arcanum side currently uses
"class-rate-overrides-global", so pick that for consistency.

## Migration

- **YAML content**: all `*PerLevel` fields in `application.yaml`, zone files,
  and any other authored content must be renamed and re-typed (`Int` →
  `Double`). The old field names will fail to deserialize.
- **No automatic migration is shipped**. Project content is currently
  placeholder, so a one-time hand rewrite is acceptable.
- **Document the breaking change** in the server changelog so anyone with a
  fork updates before pulling.

## Test impact

Any Kotlin test that constructs `MobTierConfig`, `LevelRewardsConfig`, or
`ClassDefinitionConfig` literals needs the field rename. Numeric expectations
in tests that assert resolved stats at level N also change: `base + perLevel ×
(N - 1)` becomes `floor(base × rate^(N - 1))`. For tests that hard-code an
expected resolved HP, rewrite the expected value using the new formula.

A reasonable migration check: pick a representative tier (e.g. balanced
standard), pick `rate = 1.1`, and confirm the engine produces
`floor(150 × 1.1^29) = 2391` for a level-30 standard mob.
