# Phase 6: Visualizations - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Chart-based visualizations that make formula interactions intuitive — XP curves, mob power scaling, and stat effectiveness become visual instead of numeric. Three charts added to the Tuning Wizard comparison view.

</domain>

<decisions>
## Implementation Decisions

### Chart Library
- **D-01:** Use Recharts for all 3 charts. React-native SVG charts with declarative JSX API (LineChart, RadarChart, BarChart). Tree-shakeable. Install `recharts` as a dependency. Add to Vite manual chunks for code splitting.

### Placement and Layout
- **D-02:** Charts appear below the metric summary cards and above the search/parameter browser. Natural flow: preset → metrics → charts → raw fields.
- **D-03:** Three chart cards side by side in a single row (`grid-cols-3`). Each card ~33% width with chart title and visualization. All 3 visible at once without scrolling.
- **D-04:** Charts appear only when a preset is selected. Before selection, the wizard shows preset cards and parameter browser (no charts). Matches Phase 4's pattern where comparison features appear after selection.

### Styling and Theming
- **D-05:** Current config data series uses muted/secondary tone (`text-text-secondary` or `border-muted` equivalent hex). Preset series uses the warm aurum-gold accent color. Preset visually dominates — it's what the builder is evaluating.
- **D-06:** Subtle 300ms ease-out transition animation on data change (Recharts built-in `isAnimationActive`). Lines morph, bars resize smoothly when switching presets.
- **D-07:** Chart backgrounds transparent/matching `bg-bg-tertiary`. Axis labels in `font-sans` (Crimson Pro), chart titles in `font-display` (Cinzel). Grid lines in `border-muted` equivalent. Dark theme throughout.

### Data Range and Interactivity
- **D-08:** XP curve chart plots all levels 1-50. Extend computeMetrics or create a dedicated function to compute xpForLevel at all 50 levels for both current and preset configs.
- **D-09:** Mob tier chart has a dropdown selector with 4 preset levels: Lv10, Lv20, Lv30, Lv50. Default to Lv30. Shows all mob tiers (Standard, Strong, Elite, Boss) as grouped bars for HP, damage, armor, XP.
- **D-10:** Stat profile radar chart compares current vs preset stat scaling effectiveness across all stat bindings defined in config.
- **D-11:** Recharts default hover tooltips showing exact values (e.g., "Lv30: Current 4500 XP, Preset 3200 XP"). No custom tooltip styling needed for v1.

### Claude's Discretion
- Exact Recharts component configuration and prop choices
- Chart card internal padding and sizing
- Radar chart axis labels and stat ordering
- Mob chart bar color palette for different stats
- Legend placement and styling
- Responsive behavior if wizard is narrow

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above

### Existing Code (source of truth)
- `creator/src/lib/tuning/formulas.ts` — computeMetrics() and xpForLevel() for chart data computation
- `creator/src/lib/tuning/types.ts` — MetricSnapshot interface, REPRESENTATIVE_LEVELS, TuningSection
- `creator/src/components/tuning/TuningWizard.tsx` — Main wizard layout, insertion point for chart row
- `creator/src/components/tuning/MetricSectionCards.tsx` — Metric cards above charts (placement reference)
- `creator/src/stores/tuningWizardStore.ts` — selectedPresetId state for conditional chart rendering
- `creator/src/stores/configStore.ts` — current AppConfig for chart data
- `creator/src/lib/tuning/presets.ts` — preset data for comparison chart series
- `creator/src/types/config.ts` — AppConfig type with progression, combat, stats sections

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `computeMetrics(config)`: Already computes xpPerLevel, mobHp, mobDamageAvg, mobGoldAvg, playerHp, dodgeChance at representative levels. Extend for chart data.
- `xpForLevel(level, xpConfig)`: Pure function computing XP for a single level. Call for levels 1-50 directly.
- `MetricSnapshot`: Already has the data shape needed for all 3 charts.
- `REPRESENTATIVE_LEVELS`: [1, 5, 10, 20, 30, 50] — reuse for mob tier dropdown options.

### Established Patterns
- Chart row follows same conditional render pattern as MetricSectionCards: `{selectedPresetId && <ChartRow ... />}`
- Card styling: `bg-bg-tertiary rounded-lg border border-border-muted p-4` (from MetricCard pattern)
- Vite manual chunks: Add `recharts` to vite.config.ts chunks

### Integration Points
- TuningWizard.tsx: Insert chart row between MetricSectionCards and SearchFilterBar
- computeMetrics: May need a variant that computes all 50 levels for XP curve (current only does representative levels)
- No existing charting code or SVG patterns in the codebase — Recharts is a fresh addition

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-visualizations*
*Context gathered: 2026-04-05*
