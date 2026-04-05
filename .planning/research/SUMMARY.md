# Project Research Summary

**Project:** Arcanum Tuning Wizard
**Domain:** Game balance tuning wizard for MUD world builder (new milestone in existing Tauri desktop app)
**Researched:** 2026-04-04
**Confidence:** HIGH

## Executive Summary

The Arcanum Tuning Wizard is a preset-driven balance configuration tool layered onto an existing desktop app with 300+ gameplay parameters across 45+ config panels. The research consensus is clear: this is a read-compare-apply workflow, not another editing surface. Experts build game balance tools around derived metrics (time-to-kill, XP-to-level, gold/hour) rather than raw numeric diffs, because raw numbers are meaningless without formula context. The wizard's value comes from making those formulas visible.

The recommended approach adds only two new dependencies (Recharts for visualization, deep-object-diff for structured diffing) and implements 5-10 pure TypeScript formula functions mirroring the Kotlin server's calculations. The architecture is deliberately lightweight: four pure-function modules (presets, diff engine, formula evaluator, field labels) plus a UI workspace using local React state. No new Zustand store is needed. The wizard integrates via the existing `host: "command"` panel pattern and writes to configStore through the established save pipeline.

The primary risk is presets producing broken or incoherent game configurations. This happens when preset values are authored per-section without cross-section validation, or when users cherry-pick sections that were designed to work together. Mitigation is straightforward but non-negotiable: build the derived metrics engine before authoring presets, validate every preset against those metrics, and show a post-apply health check when users mix sections. Secondary risks include comparison view noise (showing 300 raw fields instead of leading with metrics) and the absence of undo in configStore (snapshot-before-apply solves this without adding full undo/redo).

## Key Findings

### Recommended Stack

The existing stack (React 19, Zustand 5, Tailwind 4, Tauri 2) handles 95% of the wizard's needs. Only two small additions are required, plus a set of hand-written formula functions.

**New dependencies:**
- **Recharts ^3.8**: SVG-based charting with React-native API. Needed for RadarChart (stat profiles), BarChart (mob tier comparison), LineChart (XP/scaling curves), ComposedChart (before/after overlays). React 19 compatible in 3.x. ~180KB tree-shakeable, code-split into a wizard chunk.
- **deep-object-diff ^1.1**: Structured nested object diffing via `detailedDiff()`. Returns `{ added, deleted, updated }` for deeply nested config objects. ~2KB, zero dependencies.
- **Plain TypeScript formula functions**: 5-10 pure functions implementing XP curve, HP scaling, damage calculation, mob stats, and gold economy formulas from the Kotlin reference code. No math library needed -- the formulas are fixed and deterministic.

**Total bundle impact:** ~182KB, isolated in a lazy-loaded wizard chunk.

### Expected Features

**Must have (table stakes):**
- Themed presets (start with 3: Casual, Balanced, Hardcore) with clear design philosophy statements
- Before/after comparison view leading with derived metrics, not raw field diffs
- Per-section accept/reject with related sections grouped together
- Contextual tooltips explaining what each value does and what it interacts with
- Reset to pre-wizard state (snapshot before apply, one-click revert)
- System grouping matching existing config panel categories
- Value validation reusing existing `validateConfig.ts`
- Search/filter across 300+ parameter names

**Should have (differentiators):**
- XP curve visualization (interactive line chart with live parameter response)
- Mob tier power chart (bar chart across tiers at sample levels)
- Computed metrics panel (concrete scenarios: "level 20 warrior deals X DPS")
- Custom preset save/load (JSON export/import to `.arcanum/`)
- "What changed" summary (natural-language changelog after applying)

**Defer to v2+:**
- LLM holistic analysis (explicitly v2 per PROJECT.md, needs metrics infrastructure first)
- Balance warnings (rule-based, needs real usage data to prioritize rules)
- Economy flow summary (high aggregation effort, medium payoff)
- Preset blending (per-section accept/reject covers the mix-and-match use case)
- Level-by-level data table (charts cover the key levels sufficiently)
- Dependency highlighting (polish feature for after core is solid)

### Architecture Approach

The wizard is a self-contained workspace with four pure-function modules and a thin UI layer. It reads from configStore, computes diffs and metrics locally, and writes back only on explicit user confirmation. All wizard working state (selected preset, section toggles, preview config) lives in local React state, not a Zustand store, because it is transient and single-consumer.

**Major components:**
1. **Preset Definitions** (`src/lib/tuning/presets.ts`) -- Static `DeepPartial<AppConfig>` objects organized into tuning sections. TypeScript-typed to match config interfaces. Start with 3 presets, expand to 5-6 later.
2. **Diff Engine** (`src/lib/tuning/diffEngine.ts`) -- Pure function computing per-section field-level diffs between current config and a preset. Only emits changes for fields that actually differ.
3. **Formula Evaluator** (`src/lib/tuning/formulaEvaluator.ts`) -- Pure function computing derived game metrics (HP, DPS, XP-to-level, gold/hour, TTK) at sample levels from any AppConfig snapshot.
4. **Field Labels** (`src/lib/tuning/fieldLabels.ts`) -- Human-readable labels, descriptions, and field-tier classifications (Critical/Important/Minor) for config paths.
5. **Wizard Workspace** (`src/components/tuning/TuningWizard.tsx`) -- Top-level command panel with preset selector, section cards, comparison tables, and sticky apply/cancel footer.
6. **Section Card** (`src/components/tuning/SectionCard.tsx`) -- Per-section UI showing field changes, before/after metrics, and accept/reject toggle.

### Critical Pitfalls

1. **Preset values produce broken formulas** -- Config fields form an interconnected formula graph. Presets must be authored as complete, internally-consistent snapshots validated against derived metrics. Build the metrics engine before authoring presets.
2. **Partial apply creates Frankenstein configs** -- Cherry-picking sections breaks cross-section consistency. Group related sections (Combat + Stats as one unit), show post-apply health check with derived metrics, and flag outlier combinations.
3. **Comparison view shows noise instead of signal** -- 300 raw field diffs are useless. Lead with derived metrics ("TTK: 45s -> 120s"), tier fields by importance, collapse Minor fields by default.
4. **No undo after preset apply** -- configStore has no undo/redo. Snapshot current config before any apply, offer one-click "revert to pre-wizard state". Do not add full undo to configStore (overkill).
5. **Presets go stale as config schema evolves** -- Use `DeepPartial<AppConfig>` overlays, not full snapshots. Apply logic merges preset values over current config, leaving unset fields untouched. Flag uncovered sections in the UI.

## Implications for Roadmap

Based on research, the wizard decomposes into 4 phases with clear dependency ordering.

### Phase 1: Foundation (Types, Formulas, Presets)
**Rationale:** Everything downstream depends on the data model, formula accuracy, and preset content. The diff engine, comparison view, and charts all consume these outputs. Building them first also validates the core assumption: can we compute meaningful derived metrics from AppConfig?
**Delivers:** TypeScript interfaces for presets/diffs/metrics, formula evaluator with 5-10 server-mirroring functions, field labels registry, 3 validated presets (Casual, Balanced, Hardcore), diff engine, and comprehensive Vitest coverage for all pure functions.
**Addresses:** Themed presets, system grouping, value validation, contextual tooltips (data layer)
**Avoids:** Pitfall 1 (broken formula interactions) by building metrics before presets. Pitfall 5 (stale presets) by using DeepPartial overlay model. Pitfall 8 (too many presets) by shipping 3 first.

### Phase 2: Core Wizard UI (Comparison + Apply)
**Rationale:** With the data layer proven, build the primary user workflow: select preset, see comparison, accept/reject sections, apply. This is the wizard's entire value proposition.
**Delivers:** TuningWizard workspace, PresetSelector, SectionCard, ComparisonTable, FieldChangeRow, ApplyFooter, snapshot-before-apply undo mechanism, panel registry integration, MainArea routing.
**Addresses:** Before/after comparison, per-section accept/reject, reset/undo, search/filter
**Avoids:** Pitfall 3 (noise) by leading with derived metrics. Pitfall 4 (no undo) by implementing snapshot before apply. Pitfall 7 (scope creep) by keeping wizard read-compare-apply only. Pitfall 9 (YAML corruption) by using existing save pipeline.

### Phase 3: Visualizations (Charts + Computed Metrics)
**Rationale:** Charts transform the wizard from "useful" to "insightful." They depend on the formula evaluator (Phase 1) and the wizard workspace (Phase 2) being functional. Recharts is code-split into this phase's chunk.
**Delivers:** XP curve line chart, mob tier bar chart, stat profile radar chart, computed metrics panel with concrete scenarios, before/after chart overlays.
**Addresses:** XP curve visualization, mob tier power chart, computed metrics panel
**Avoids:** Pitfall 6 (wrong metrics) by labeling formula fidelity and referencing Kotlin server code.

### Phase 4: Polish + Expansion (Remaining Presets, UX, Custom Presets)
**Rationale:** With the core tool working and validated, add the remaining 2-3 genre presets, custom preset save/load, "what changed" summary, and UX refinements like better onboarding and navigation guidance.
**Delivers:** 2-3 additional presets (Grindy MMO, Fast PvP, Story-focused), custom preset save/load to `.arcanum/`, natural-language change summary, sidebar callout for new users, level-by-level data table (if warranted).
**Addresses:** Full preset suite, custom preset save/load, "what changed" summary
**Avoids:** Pitfall 2 (Frankenstein configs) by adding post-apply health check warnings. Pitfall 11 (navigation confusion) by adding onboarding guidance.

### Phase Ordering Rationale

- **Phase 1 before Phase 2:** The diff engine and formula evaluator are consumed by every UI component. Building UI first would require mocking all data, and the data model decisions (partial overlay vs full snapshot, section grouping, metric selection) constrain every UI decision.
- **Phase 2 before Phase 3:** Charts are enhancement, not core workflow. The wizard is useful with tables alone; charts make it better. Separating them also isolates the Recharts dependency.
- **Phase 3 before Phase 4:** Visualizations validate whether the formula evaluator is accurate enough before expanding to more presets. If metrics are wrong, fixing them with 3 presets is easier than with 6.
- **Phase 4 last:** Additional presets and custom save/load are content and convenience features that benefit from the core tool being battle-tested first.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Preset Authoring):** The actual numeric values for presets require careful game design work. Research the Kotlin reference code in `reference/` to extract exact formula implementations. The formula evaluator must match the server's calculations closely enough for derived metrics to be directionally correct.
- **Phase 3 (Visualizations):** Recharts 3.x API and theming with CSS custom properties needs validation during implementation. The specific chart configurations (radar axis mapping, composed chart overlays) benefit from prototyping.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Core Wizard UI):** Follows established command panel pattern from the codebase (PlayerSpriteManager, AdminDashboard). Comparison table and section card are straightforward presentational components. Well-documented in ARCHITECTURE.md.
- **Phase 4 (Polish + Expansion):** JSON file I/O for custom presets is trivial. Additional presets follow the same authoring pattern as Phase 1.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Only 2 small, well-maintained dependencies. Recharts 3.x React 19 compatibility confirmed. Existing stack handles everything else. |
| Features | MEDIUM-HIGH | Table stakes are clear and well-researched. Differentiator prioritization is sound. MUD-specific tuning tooling is niche, but game balance tool patterns are well-established. |
| Architecture | HIGH | Component boundaries are clean, follow existing codebase patterns exactly, and the data flow is straightforward. The pure-function approach is proven in this codebase. |
| Pitfalls | HIGH | Pitfalls are specific, actionable, and tied to concrete codebase characteristics (configStore lacking undo, YAML round-trip requirements, AppConfig nesting depth). |

**Overall confidence:** HIGH

### Gaps to Address

- **Exact formula implementations:** The formula evaluator approximates server calculations. During Phase 1 implementation, cross-reference every formula against the Kotlin source in `reference/` to ensure directional accuracy. Label any simplifications explicitly in the UI.
- **Preset numeric values:** Research identifies the preset structure and philosophy, but the actual numeric values (what HP multiplier makes "Hardcore" feel hardcore?) require game design judgment and iteration. Plan for at least one round of playtesting or review after initial preset authoring.
- **Recharts theming specifics:** The Arcanum design system uses CSS custom properties. Recharts 3.x supports custom colors via props but the exact integration pattern (reading CSS vars at render time vs static constants) needs validation during Phase 3.
- **Post-apply health check thresholds:** Pitfall 2 mitigation calls for flagging outlier metric combinations, but the specific thresholds ("TTK below 1 second is broken") require game design knowledge. Start with conservative thresholds and adjust based on feedback.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `creator/src/types/config.ts`, `creator/src/stores/configStore.ts`, `creator/src/lib/panelRegistry.ts`, `creator/src/components/MainArea.tsx`
- [Recharts npm](https://www.npmjs.com/package/recharts) -- v3.8.1, March 2026, React 19 confirmed
- [deep-object-diff npm](https://www.npmjs.com/package/deep-object-diff) -- v1.1, 2M+ weekly downloads
- `.planning/codebase/ARCHITECTURE.md` and `.planning/codebase/CONCERNS.md` -- existing app patterns and tech debt

### Secondary (MEDIUM confidence)
- [Machinations.io](https://machinations.io/) -- game balance simulation patterns, informed anti-feature decisions
- [RPG Level-Based Progression - Davide Aversa](https://www.davideaversa.it/blog/gamedesign-math-rpg-level-based-progression/) -- XP curve formulas
- [Economy Balancing Using Spreadsheets - Game Developer](https://www.gamedeveloper.com/design/my-approach-to-economy-balancing-using-spreadsheets) -- income vs sink analysis
- [Wizard UI Design Best Practices - Lollypop Design](https://lollypop.design/blog/2026/january/wizard-ui-design/) -- wizard UX patterns

### Tertiary (LOW confidence)
- MUD-specific tuning tooling documentation is sparse. The patterns are inferred from general game balance tool design and adapted to the MUD domain. Preset philosophies and balance thresholds will need validation through use.

---
*Research completed: 2026-04-04*
*Ready for roadmap: yes*
