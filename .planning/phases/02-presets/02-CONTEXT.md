# Phase 2: Presets - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Three themed presets (Casual, Balanced, Hardcore) stored as `DeepPartial<AppConfig>` overlays. Each preset covers all 137 tunable fields from FIELD_METADATA across all gameplay systems. Presets are pure data -- no UI, no store integration. Downstream phases (wizard workspace, comparison view) consume these presets.

</domain>

<decisions>
## Implementation Decisions

### Coverage Depth
- **D-01:** Every preset defines values for ALL tunable fields in FIELD_METADATA (~137 fields). No field is left to fall through to defaults.
- **D-02:** Low-impact fields (weather timing, navigation cooldowns, friend limits) may share the same value across presets. Only fields that shape gameplay feel need to differ between Casual/Balanced/Hardcore.

### Preset Philosophy
- **D-03:** The "Balanced" preset is NOT identical to Kotlin server defaults. It is a distinct opinionated configuration. Server defaults are essentially untuned and should not be treated as a reference baseline.
- **D-04:** All 3 presets are standalone opinionated overlays representing a gameplay philosophy. Casual softens the experience, Balanced provides a well-tuned middle ground, Hardcore increases challenge. Comparisons are always against the user's current config, not against server defaults.
- **D-05:** No DEFAULT_CONFIG constant is needed. The server defaults are not a meaningful baseline. Presets are self-contained overlays applied over whatever the user currently has.

### Claude's Discretion
- Preset numeric values: Claude should author values that produce sensible derived metrics via computeMetrics() -- e.g., Casual should show lower XP requirements, higher gold drops, lower mob damage vs Hardcore.
- Preset structure: Claude decides whether to use a single file or split across files, and what metadata (name, description, theme tags) each preset carries.
- Validation approach: Claude decides how to verify preset quality -- metric assertions in tests, cross-field consistency checks, and/or existing validateConfig integration.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 Artifacts (Dependencies)
- `creator/src/lib/tuning/types.ts` -- DeepPartial, TuningSection, FieldMeta, DiffEntry, MetricSnapshot, REPRESENTATIVE_LEVELS
- `creator/src/lib/tuning/formulas.ts` -- computeMetrics() and all formula evaluators for validating preset balance
- `creator/src/lib/tuning/fieldMetadata.ts` -- FIELD_METADATA constant with all 137 tunable field entries (defines which fields presets must cover)
- `creator/src/lib/tuning/diffEngine.ts` -- computeDiff() for testing preset coverage

### Config Type System
- `creator/src/types/config.ts` -- Full AppConfig interface (the type presets overlay)
- `creator/src/lib/templates.ts` -- Existing DeepPartial<AppConfig> overlay pattern and applyTemplate() deep merge

### Server Reference
- `reference/config/AppConfig.kt` -- Kotlin config DTOs with default values (note: defaults are untuned, not a reference baseline)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DeepPartial<AppConfig>` in `types.ts` -- exact type for preset overlays
- `computeMetrics()` in `formulas.ts` -- can evaluate derived metrics for any config to verify preset balance
- `computeDiff()` in `diffEngine.ts` -- can verify preset coverage (diff preset against empty object should show all 137 fields)
- `FIELD_METADATA` in `fieldMetadata.ts` -- source of truth for which fields presets must cover
- `ProjectTemplate` in `templates.ts` -- existing pattern for `configOverrides: DeepPartial<AppConfig>` with name/description metadata

### Established Patterns
- Pure utility functions in `creator/src/lib/tuning/` with co-located `__tests__/`
- Vitest for data-layer testing
- UPPER_SNAKE_CASE for constant data objects
- `interface` for shapes, `type` for aliases

### Integration Points
- New preset files go in `creator/src/lib/tuning/` alongside existing modules
- Presets will be imported by the wizard workspace store and comparison view in later phases
- Tests can use computeMetrics() to assert presets produce sensible balance

</code_context>

<specifics>
## Specific Ideas

- Preset values should be authored to produce meaningfully different computeMetrics() snapshots -- e.g., Casual XP-per-level should be noticeably lower than Hardcore at level 20+
- Each preset should have a name, description, and per-section description explaining the philosophy for that section
- Coverage can be verified by testing that every key in FIELD_METADATA appears in each preset's overlay

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 02-presets*
*Context gathered: 2026-04-05*
