# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-04
**Phase:** 01-foundation
**Areas discussed:** Tuning Sections, Formula Scope, Field Metadata

---

## Tuning Sections

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror config panels | Match existing 8 panel groups | |
| Coarser grouping | Fewer, broader sections (4 groups) | ✓ |
| Finer grouping | More granular sections | |

**User's choice:** Coarser grouping -- 4 broad sections
**Follow-up:** Confirmed 4-section split: Combat & Stats, Economy & Crafting, Progression & Quests, World & Social

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, 4 sections | Combat & Stats / Economy & Crafting / Progression & Quests / World & Social | ✓ |
| 5 sections | Split Stats from Combat | |
| You decide | Claude picks | |

**User's choice:** Yes, 4 sections as proposed

---

## Formula Scope

| Option | Description | Selected |
|--------|-------------|----------|
| XP-to-level curve | XP needed at each level | ✓ |
| Combat output | Player damage, mob stats at level | ✓ |
| Gold economy | Gold per kill, shop prices | ✓ |
| Survivability | Player HP, regen, dodge at level | ✓ |

**User's choice:** All four metric categories (multiSelect)

| Option | Description | Selected |
|--------|-------------|----------|
| Close approximation | Match AppConfig.kt formulas | |
| Exact match | Cross-reference Kotlin domain model | |
| You decide | Claude judges per formula | ✓ |

**User's choice:** You decide -- Claude judges accuracy level per formula

---

## Field Metadata

| Option | Description | Selected |
|--------|-------------|----------|
| Labels + descriptions | Name and 1-sentence description | |
| Rich metadata | Labels + descriptions + ranges + interactions + impact tags | ✓ |
| Progressive | Start minimal, add richness later | |

**User's choice:** Rich metadata from the start

| Option | Description | Selected |
|--------|-------------|----------|
| Preset fields only | ~100-150 gameplay fields | |
| All gameplay fields | All 300+ gameplay fields | ✓ |
| You decide | Claude scopes | |

**User's choice:** All gameplay fields -- comprehensive coverage

---

## Claude's Discretion

- Formula accuracy per-function (close approximation vs exact match)
- Diff engine structure (flat vs tree)

## Deferred Ideas

None
