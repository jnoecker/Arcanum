# Multiplicative Scaling — migration complete

This was a cross-repo migration spec for switching mob and player level
scaling from additive `*PerLevel` fields to multiplicative `*ScalingRate`
fields. **It has shipped on both sides** and is retained only as a stub:

- **Arcanum** writes the `*ScalingRate` (Double) fields.
- **AmbonMUD** consumes them — `MobTierConfig`, `LevelRewardsConfig`, and
  `ClassDefinitionConfig` now carry `hpScalingRate` / `damageScalingRate` /
  `xpScalingRate` / `goldScalingRate` / `manaScalingRate`, and stats resolve
  via `floor(base × rate^(level-1))` (see the server's `ResolvedMobStats`).

The full original specification is preserved in this file's git history.
Current scaling behavior lives in the code; see
[`DERIVED_STATS.md`](DERIVED_STATS.md) for the item/mob authoring model that
builds on it.
