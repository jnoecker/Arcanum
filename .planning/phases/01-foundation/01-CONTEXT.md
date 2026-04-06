# Phase 1: Foundation - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Pure-function infrastructure for the Tuning Wizard: types, diff engine, formula evaluator, and field metadata catalog. No UI components, no React code, no Zustand stores. Everything in `src/lib/tuning/` with full Vitest coverage. Downstream phases (presets, comparison, apply, visualization) consume these functions.

</domain>

<decisions>
## Implementation Decisions

### Tuning Sections
- **D-01:** 4 coarse sections for grouping fields, presets, and accept/reject:
  1. **Combat & Stats** — mob tiers, damage formulas, stat bindings, dodge mechanics
  2. **Economy & Crafting** — gold drops, shop multipliers, crafting costs, gambling, lottery
  3. **Progression & Quests** — XP curve, level-up rewards, bounties, dailies, prestige, skill points
  4. **World & Social** — day/night cycle, weather, groups, guilds, factions, regen
- **D-02:** Section assignment is a property of each field in the metadata catalog. Every gameplay field maps to exactly one section.

### Formula Scope
- **D-03:** Implement all 4 derived metric categories in Phase 1:
  - XP-to-level curve (baseXp, exponent, linearXp, multiplier)
  - Combat output (player damage per hit using stat bindings, mob HP/damage at level using tier config)
  - Gold economy (gold per mob kill at level, shop price with multipliers)
  - Survivability (player HP at level, regen rate, dodge chance)
- **D-04:** Formulas should reference Kotlin source in `reference/config/AppConfig.kt` for accuracy. Evaluate formulas at representative levels (1, 5, 10, 20, 30, 50) for comparison snapshots.

### Claude's Discretion
- Formula accuracy: Claude judges per-formula what level of fidelity is practical. Close approximation preferred over exact server match when deeper Kotlin domain model would be needed. Document any known deviations in code comments.
- Diff engine granularity: Claude decides between flat field-level diffs vs tree structure based on what best serves the comparison view. Both options are acceptable.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Config Type System
- `creator/src/types/config.ts` -- Full AppConfig interface with 40+ sub-interfaces, all field definitions
- `creator/src/lib/templates.ts` -- Existing DeepPartial<AppConfig> type, applyTemplate() deep merge function

### Server Formula Reference
- `reference/config/AppConfig.kt` -- Kotlin config DTOs with validation rules, default values, XP formulas, mob tier defaults, stat binding defaults

### Existing Test Patterns
- `creator/src/lib/__tests__/` -- Vitest test patterns for pure-function testing

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DeepPartial<AppConfig>` type already defined in `creator/src/lib/templates.ts` -- can be reused or re-exported for tuning types
- `applyTemplate()` deep merge function in `templates.ts` -- pattern for merging partial configs into full AppConfig
- `AppConfig` interface (678+ lines) in `creator/src/types/config.ts` -- complete type coverage of all config fields

### Established Patterns
- Pure utility functions in `creator/src/lib/` with co-located `__tests__/` directories
- Vitest for data-layer testing (no UI tests)
- Path alias `@/` maps to `src/`
- `interface` for object shapes, `type` for aliases/unions
- camelCase functions, PascalCase types, UPPER_SNAKE_CASE constants

### Integration Points
- New code goes in `creator/src/lib/tuning/` (new directory)
- Types can extend or import from `creator/src/types/config.ts`
- Tests in `creator/src/lib/tuning/__tests__/`
- No store integration in this phase -- pure functions only

</code_context>

<specifics>
## Specific Ideas

### Field Metadata Richness
- **D-05:** Rich metadata for ALL gameplay fields (~300+), not just preset fields:
  - Human-readable label
  - 1-sentence description
  - Valid range (min/max)
  - Interaction notes (e.g., "affects damage output via stat binding divisor")
  - Gameplay impact tag (high/medium/low)
- This ensures comprehensive coverage for search/filter and tooltips in later phases, even for fields not directly in presets.

### Derived Metrics at Key Levels
- Formulas evaluate at representative player levels: 1, 5, 10, 20, 30, 50
- Output structured data that charts and comparison tables can consume directly

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-04-04*
