# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Tuning Wizard

**Shipped:** 2026-04-05
**Phases:** 6 | **Plans:** 13 | **Tasks:** 23

### What Was Built
- Complete tuning wizard with 3 themed presets (Casual/Balanced/Hardcore) covering 137 tunable fields
- Before/after comparison view with derived metric KPI cards and color-coded parameter diffs
- Per-section accept/reject apply flow with undo, reset, and health check warnings
- Three Recharts visualizations: XP curve, mob tier power, stat radar chart
- Searchable parameter browser with section filtering and collapsible groups

### What Worked
- TDD-first approach for data layer (formulas, presets, diff engine) caught issues early
- Pure-function architecture made each phase independently testable
- Session-only Zustand store avoided persistence complexity
- Phases 5 and 6 ran in parallel (both depended on Phase 4, not each other)
- Quality model profile (Opus for research/roadmap) produced detailed, accurate plans

### What Was Inefficient
- ROADMAP.md and REQUIREMENTS.md bookkeeping fell behind for phases 4-6 (checkboxes not updated)
- Some summary one-liner extraction was noisy (empty fields, bug references instead of descriptions)
- Phase 3 current-state snapshot in PROJECT.md wasn't updated after phases 4-6

### Patterns Established
- `command` host type in panel registry for wizard-style workflows (distinct from config panels)
- deepMerge utility kept local to single consumer (TuningWizard.tsx) rather than shared lib
- Map instead of Record for diff structures to satisfy noUncheckedIndexedAccess
- ParameterRow even/odd prop for alternating stripes (works with filtered lists, unlike CSS nth-child)
- Chart data functions as pure transformers, separate from Recharts components

### Key Lessons
1. Formula accuracy requires cross-referencing Kotlin source — budget time for reference/ reading
2. Preset differentiation needs testing at multiple levels (20 and 50) with quantitative thresholds
3. Health check tier key mismatches are easy to introduce — validate tier enums at type level
4. DeepPartial type needs NonNullable wrapping for optional object properties

### Cost Observations
- Model mix: 100% Opus (quality profile)
- Sessions: ~6 (one per phase + planning)
- Notable: Entire milestone completed in 2 days with automated GSD workflow

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~6 | 6 | First GSD milestone — established baseline |

### Cumulative Quality

| Milestone | Tests | Coverage | Files Changed |
|-----------|-------|----------|---------------|
| v1.0 | 685+ | Data layer | 222 |

### Top Lessons (Verified Across Milestones)

1. TDD-first for data layers pays off — catches formula bugs before UI work begins
2. Keep bookkeeping artifacts (ROADMAP.md checkboxes, REQUIREMENTS.md status) updated at phase boundaries
