# Phase 2: Presets - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 02-presets
**Areas discussed:** Coverage depth

---

## Coverage Depth

### Field Count

| Option | Description | Selected |
|--------|-------------|----------|
| High-impact only (~30-40 fields) | Cover fields that most dramatically affect gameplay feel. Leave low-impact fields at defaults. | |
| High + medium (~80-100 fields) | Cover fields that meaningfully shape the experience. Skip only cosmetic/timing fields. | |
| All tunable fields (~137) | Every field in FIELD_METADATA gets a preset value. Maximum opinionated presets. | ✓ |

**User's choice:** All tunable fields (~137)
**Notes:** User wants maximally opinionated presets covering every tunable field.

### Divergence Between Presets

| Option | Description | Selected |
|--------|-------------|----------|
| Shared where sensible | Low-impact fields can share values across presets. Only gameplay-feel fields need to differ. | ✓ |
| Every field unique per preset | All 3 presets have intentionally different values for every field. | |

**User's choice:** Shared where sensible
**Notes:** Low-impact fields like weather timing can share values. Only fields that shape gameplay feel need to differ.

### Balanced Preset Identity

| Option | Description | Selected |
|--------|-------------|----------|
| Match Kotlin defaults | Balanced = server's built-in defaults. Zero diff when comparing against unmodified config. | |
| Distinct from defaults | Balanced is its own opinionated configuration, separate from server defaults. | ✓ |

**User's choice:** Distinct from defaults
**Notes:** User clarified that "the server defaults are essentially random, they haven't been tuned at all." So Balanced should be a properly tuned middle ground, not a mirror of server defaults.

### Baseline Config Constant

| Option | Description | Selected |
|--------|-------------|----------|
| Export Kotlin defaults as constant | Create DEFAULT_CONFIG for comparison and testing baseline. | |
| Always use user's current config | No default constant. Comparisons always against live configStore. | ✓ |

**User's choice:** Always use user's current config (via explanation that server defaults are untuned)
**Notes:** No DEFAULT_CONFIG constant needed. Server defaults are meaningless as a baseline.

---

## Claude's Discretion

- Preset numeric values (authoring sensible balance)
- Preset file structure (single vs split files, metadata shape)
- Validation approach (metric assertions, coverage checks, validateConfig integration)

## Deferred Ideas

None -- discussion stayed within phase scope.
