# Phase 6: Visualizations - Research

**Researched:** 2026-04-05
**Domain:** Recharts data visualization in React 19 + Tailwind dark theme
**Confidence:** HIGH

## Summary

Phase 6 adds three chart-based visualizations to the Tuning Wizard: an XP curve line chart (levels 1-50), a mob tier grouped bar chart (HP/damage/armor/XP at a selectable level), and a stat profile radar chart comparing current vs preset stat bindings. All three use Recharts 3.8.1, which is the current stable release with full React 19 support and built-in TypeScript types.

The existing codebase already has all the data computation functions needed (`xpForLevel`, `mobHpAtLevel`, `computeMetrics`, etc.) in `formulas.ts`. The primary implementation work is: (1) installing Recharts and adding it to Vite manual chunks, (2) creating data transformation functions that convert `MetricSnapshot` + raw config into Recharts-compatible array formats, (3) building three chart card components that follow the existing card styling pattern (`bg-bg-tertiary rounded-lg border border-border-muted p-4`), and (4) inserting a `ChartRow` component into `TuningWizard.tsx` between `MetricSectionCards` and `HealthCheckBanner`.

**Primary recommendation:** Build chart data preparation as pure functions in `lib/tuning/chartData.ts` (testable), chart components in `components/tuning/charts/`, and a single `ChartRow` container that conditionally renders when a preset is selected.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use Recharts for all 3 charts. React-native SVG charts with declarative JSX API (LineChart, RadarChart, BarChart). Tree-shakeable. Install `recharts` as a dependency. Add to Vite manual chunks for code splitting.
- **D-02:** Charts appear below the metric summary cards and above the search/parameter browser. Natural flow: preset -> metrics -> charts -> raw fields.
- **D-03:** Three chart cards side by side in a single row (`grid-cols-3`). Each card ~33% width with chart title and visualization. All 3 visible at once without scrolling.
- **D-04:** Charts appear only when a preset is selected. Before selection, the wizard shows preset cards and parameter browser (no charts). Matches Phase 4's pattern where comparison features appear after selection.
- **D-05:** Current config data series uses muted/secondary tone (`text-text-secondary` or `border-muted` equivalent hex). Preset series uses the warm aurum-gold accent color. Preset visually dominates -- it's what the builder is evaluating.
- **D-06:** Subtle 300ms ease-out transition animation on data change (Recharts built-in `isAnimationActive`). Lines morph, bars resize smoothly when switching presets.
- **D-07:** Chart backgrounds transparent/matching `bg-bg-tertiary`. Axis labels in `font-sans` (Crimson Pro), chart titles in `font-display` (Cinzel). Grid lines in `border-muted` equivalent. Dark theme throughout.
- **D-08:** XP curve chart plots all levels 1-50. Extend computeMetrics or create a dedicated function to compute xpForLevel at all 50 levels for both current and preset configs.
- **D-09:** Mob tier chart has a dropdown selector with 4 preset levels: Lv10, Lv20, Lv30, Lv50. Default to Lv30. Shows all mob tiers (Standard, Strong, Elite, Boss) as grouped bars for HP, damage, armor, XP.
- **D-10:** Stat profile radar chart compares current vs preset stat scaling effectiveness across all stat bindings defined in config.
- **D-11:** Recharts default hover tooltips showing exact values. No custom tooltip styling needed for v1.

### Claude's Discretion
- Exact Recharts component configuration and prop choices
- Chart card internal padding and sizing
- Radar chart axis labels and stat ordering
- Mob chart bar color palette for different stats
- Legend placement and styling
- Responsive behavior if wizard is narrow

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VIZ-01 | XP curve chart (Recharts) showing XP-per-level for current vs preset config | Recharts `LineChart` + `Line` components; `xpForLevel()` called for levels 1-50; data as array of `{ level, current, preset }` objects |
| VIZ-02 | Mob tier power chart showing HP, damage, armor, XP across tiers at selectable levels | Recharts `BarChart` + `Bar` with grouped bars; `mobHpAtLevel()`, `mobAvgDamageAtLevel()` computed per tier at selected level; dropdown state in component |
| VIZ-03 | Stat profile radar chart comparing current vs preset stat scaling effectiveness | Recharts `RadarChart` + `Radar`; stat binding divisor/multiplier values normalized for comparison; `PolarGrid` + `PolarAngleAxis` for labels |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | 3.8.1 | SVG chart rendering (Line, Bar, Radar) | Most popular React chart library, declarative JSX API, built-in TypeScript types, React 19 compatible [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-is | ^16.8.0+ | Recharts peer dependency | Already present in lockfile via hoist-non-react-statics [VERIFIED: bun.lock] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts | Victory | Victory has more customization but heavier API surface; Recharts JSX composition is simpler |
| Recharts | Nivo | Nivo is beautiful but opinionated theming conflicts with custom dark theme |
| Recharts | visx (Airbnb) | visx is low-level primitives; much more code for same result |

**Installation:**
```bash
bun add recharts
```

Note: `react-is` is a peer dependency but already satisfied in the lockfile (v16.13.1). [VERIFIED: bun.lock]

**Version verification:**
- `recharts@3.8.1` -- latest stable as of 2026-04-05 [VERIFIED: npm registry]
- Peer deps: `react ^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0` -- project uses React 19 [VERIFIED: npm view recharts@3.8.1 peerDependencies]

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/tuning/
    chartData.ts          # Pure data transformation functions (testable)
  components/tuning/
    charts/
      ChartRow.tsx        # Container: grid-cols-3, conditional render
      XpCurveChart.tsx    # LineChart for VIZ-01
      MobTierChart.tsx    # BarChart for VIZ-02
      StatRadarChart.tsx  # RadarChart for VIZ-03
```

### Pattern 1: Pure Data Transformers
**What:** Separate data preparation from chart rendering. Each chart gets its data as a flat array of objects.
**When to use:** Always -- keeps chart components purely visual and data functions testable.
**Example:**
```typescript
// Source: project convention (formulas.ts pattern)
// lib/tuning/chartData.ts

import type { AppConfig } from "@/types/config";
import { xpForLevel } from "./formulas";

interface XpCurvePoint {
  level: number;
  current: number;
  preset: number;
}

/** Generate XP curve data for levels 1-50. */
export function buildXpCurveData(
  currentConfig: AppConfig,
  presetConfig: AppConfig,
): XpCurvePoint[] {
  const points: XpCurvePoint[] = [];
  for (let level = 1; level <= 50; level++) {
    points.push({
      level,
      current: xpForLevel(level, currentConfig.progression.xp),
      preset: xpForLevel(level, presetConfig.progression.xp),
    });
  }
  return points;
}
```

### Pattern 2: Recharts Dark Theme Integration
**What:** Pass hex color values directly to Recharts `stroke`, `fill`, and tick style props rather than CSS classes (Recharts renders SVG, not DOM elements).
**When to use:** All chart components -- Tailwind classes do not work on SVG elements.
**Example:**
```typescript
// Source: Recharts API docs + project CSS tokens
// The Arcanum theme hex values extracted from index.css:

/** Chart color constants derived from Arcanum CSS tokens. */
export const CHART_COLORS = {
  // Series colors (D-05)
  currentSeries: "#aebada",   // text-text-secondary
  presetSeries: "#c8a46a",    // warm (aurum-gold)
  
  // Grid and axes (D-07)
  grid: "#39455f",            // border-muted
  axisText: "#95a0bf",        // text-muted
  axisLine: "#56617d",        // border-default
  
  // Mob stat bar colors (discretion)
  barHp: "#c05060",           // chart-hp
  barDamage: "#dbb8b8",       // status-error (warm red)
  barArmor: "#8caec9",        // stellar-blue
  barXp: "#a3c48e",           // status-success (green)
} as const;
```

### Pattern 3: ResponsiveContainer Wrapper
**What:** Every chart must be wrapped in `<ResponsiveContainer>` with explicit height and `width="100%"` to fill its card container.
**When to use:** All three charts.
**Example:**
```typescript
// Source: Recharts official API [CITED: recharts.github.io/en-US/api/ResponsiveContainer/]
<ResponsiveContainer width="100%" height={220}>
  <LineChart data={data}>
    {/* children */}
  </LineChart>
</ResponsiveContainer>
```

### Pattern 4: Conditional Render in TuningWizard
**What:** ChartRow follows the same `{selectedPresetId && <Component />}` pattern used by MetricSectionCards.
**When to use:** Insertion point in TuningWizard.tsx.
**Example:**
```typescript
// Source: TuningWizard.tsx existing pattern (line 201)
{selectedPresetId && currentMetrics && activePresetMetrics && presetConfig && (
  <ChartRow
    currentConfig={config}
    presetConfig={presetConfig}
    currentMetrics={currentMetrics}
    presetMetrics={activePresetMetrics}
  />
)}
```

### Anti-Patterns to Avoid
- **Tailwind classes on SVG elements:** Recharts renders SVG; use inline `stroke`, `fill`, `style` props with hex values, not Tailwind utility classes.
- **Hardcoded chart dimensions:** Never set fixed `width` on charts; always use `ResponsiveContainer` with `width="100%"` and a fixed `height`.
- **Data computation in render:** Never call `xpForLevel` in a loop inside a component body; always use `useMemo` wrapping pure data functions.
- **Using deprecated Recharts 2.x patterns:** In v3, `accessibilityLayer` defaults to `true` (was `false`). CartesianGrid may need explicit `xAxisId`/`yAxisId` if multiple axes. Do NOT use removed `CategoricalChartState`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG line/bar/radar charts | Custom SVG path math | Recharts `<LineChart>`, `<BarChart>`, `<RadarChart>` | Axis scaling, hover tooltips, animation, responsive sizing are extremely complex |
| Responsive chart sizing | Manual ResizeObserver + state | Recharts `<ResponsiveContainer>` | Handles debouncing, ResizeObserver lifecycle, and re-render on container size changes |
| Tooltip on hover | Custom mouse tracking | Recharts built-in `<Tooltip />` | Handles cursor position, data point snapping, multi-series display |
| Chart animation | CSS transitions on SVG | Recharts `isAnimationActive` + `animationDuration` | Built-in morphing transitions for line paths, bar heights, radar shapes |
| Deep merge config | Manual recursive merge | Existing `deepMerge()` from `merge.ts` | Already implemented and tested in Phase 3 |

**Key insight:** Recharts' declarative JSX composition means each chart is ~30-50 lines of JSX. The real work is in data preparation functions, not chart rendering.

## Common Pitfalls

### Pitfall 1: ResponsiveContainer Requires Explicit Parent Height
**What goes wrong:** Chart renders as 0px height because ResponsiveContainer's `height="100%"` has no resolved parent height.
**Why it happens:** ResponsiveContainer uses ResizeObserver on its parent. If the parent has no explicit height (e.g., just `flex-1` without `min-h-0`), the container computes 0.
**How to avoid:** Use a fixed pixel height on ResponsiveContainer (`height={220}`) rather than percentage, OR ensure the chart card has an explicit min-height.
**Warning signs:** Chart area is blank but data is correct in console.

### Pitfall 2: SVG Text Styling Differences
**What goes wrong:** Axis labels and tick marks ignore Tailwind classes; text appears in default browser font and color.
**Why it happens:** Recharts renders SVG `<text>` elements. CSS utility classes target HTML elements. SVG text needs explicit `fill`, `fontSize`, `fontFamily` via the `tick` or `style` props.
**How to avoid:** Pass `tick={{ fill: "#95a0bf", fontSize: 12, fontFamily: "'Crimson Pro', Georgia, serif" }}` to `<XAxis>` and `<YAxis>`.
**Warning signs:** Axis labels appear in sans-serif or wrong color on dark background.

### Pitfall 3: Recharts 3.x CartesianGrid Axis ID Requirement
**What goes wrong:** CartesianGrid throws warnings or doesn't render properly when multiple axes exist.
**Why it happens:** Recharts 3.0 breaking change requires `xAxisId` and `yAxisId` on CartesianGrid matching corresponding axis components.
**How to avoid:** Since our charts each have a single X and Y axis, this is not critical -- but if errors appear, add `xAxisId={0}` and `yAxisId={0}` explicitly. [CITED: github.com/recharts/recharts/wiki/3.0-migration-guide]
**Warning signs:** Console warnings about axis IDs.

### Pitfall 4: Mob Tier Key Mismatch
**What goes wrong:** Bar chart shows "weak" and "standard" but CONTEXT.md says "Standard, Strong, Elite, Boss".
**Why it happens:** The config type `MobTiersConfig` has keys `weak`, `standard`, `elite`, `boss`. The display labels in D-09 say "Standard, Strong, Elite, Boss" which doesn't match the actual key names.
**How to avoid:** Use the actual config keys (`weak`, `standard`, `elite`, `boss`) for data, but display human-readable labels. Map: `weak` -> "Weak", `standard` -> "Standard", `elite` -> "Elite", `boss` -> "Boss".
**Warning signs:** Missing data for a tier because of key name confusion.

### Pitfall 5: Large Number Formatting on Y-Axis
**What goes wrong:** XP values at level 50 can be 250,000+ which makes Y-axis labels overlap or look cluttered.
**Why it happens:** Default number formatting doesn't abbreviate large numbers.
**How to avoid:** Use a custom `tickFormatter` on YAxis: `tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)}`.
**Warning signs:** Y-axis labels overflow or overlap on the XP curve chart.

### Pitfall 6: Radar Chart with Zero Values
**What goes wrong:** Radar chart axes collapse to center when all values are zero or very small.
**Why it happens:** RadarChart auto-scales from data min to max. If a stat binding is 0, the axis disappears.
**How to avoid:** Normalize stat values or set explicit `domain` on PolarRadiusAxis.
**Warning signs:** Radar shape looks like a single point or line instead of a polygon.

## Code Examples

### XP Curve LineChart (VIZ-01)
```typescript
// Source: Recharts API [CITED: recharts.github.io/en-US/api/LineChart/]
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { CHART_COLORS } from "./chartColors";

interface XpCurveChartProps {
  data: Array<{ level: number; current: number; preset: number }>;
}

export function XpCurveChart({ data }: XpCurveChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
        <XAxis
          dataKey="level"
          tick={{ fill: CHART_COLORS.axisText, fontSize: 12, fontFamily: "'Crimson Pro', Georgia, serif" }}
          stroke={CHART_COLORS.axisLine}
        />
        <YAxis
          tick={{ fill: CHART_COLORS.axisText, fontSize: 12, fontFamily: "'Crimson Pro', Georgia, serif" }}
          stroke={CHART_COLORS.axisLine}
          tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
        />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="current"
          name="Current"
          stroke={CHART_COLORS.currentSeries}
          strokeWidth={2}
          dot={false}
          isAnimationActive={true}
          animationDuration={300}
          animationEasing="ease-out"
        />
        <Line
          type="monotone"
          dataKey="preset"
          name="Preset"
          stroke={CHART_COLORS.presetSeries}
          strokeWidth={2}
          dot={false}
          isAnimationActive={true}
          animationDuration={300}
          animationEasing="ease-out"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

### Mob Tier Grouped BarChart (VIZ-02)
```typescript
// Source: Recharts API [CITED: recharts.github.io/en-US/api/BarChart/]
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";

// Data shape: one object per mob tier
// { tier: "Standard", hp: 120, damage: 34, armor: 1, xp: 330 }

// Grouped bars: 4 <Bar> elements, each with a different dataKey and fill color
<BarChart data={tierData} barCategoryGap="20%">
  <Bar dataKey="hp" name="HP" fill={CHART_COLORS.barHp} />
  <Bar dataKey="damage" name="Damage" fill={CHART_COLORS.barDamage} />
  <Bar dataKey="armor" name="Armor" fill={CHART_COLORS.barArmor} />
  <Bar dataKey="xp" name="XP" fill={CHART_COLORS.barXp} />
</BarChart>
```

### Stat Profile RadarChart (VIZ-03)
```typescript
// Source: Recharts API [CITED: recharts.github.io/en-US/api/RadarChart/]
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

// Data shape: one object per stat dimension
// { stat: "Melee Dmg", current: 3.3, preset: 5.0 }

<ResponsiveContainer width="100%" height={220}>
  <RadarChart data={statData} cx="50%" cy="50%" outerRadius="70%">
    <PolarGrid stroke={CHART_COLORS.grid} />
    <PolarAngleAxis
      dataKey="stat"
      tick={{ fill: CHART_COLORS.axisText, fontSize: 11, fontFamily: "'Crimson Pro', Georgia, serif" }}
    />
    <PolarRadiusAxis tick={false} axisLine={false} />
    <Radar
      name="Current"
      dataKey="current"
      stroke={CHART_COLORS.currentSeries}
      fill={CHART_COLORS.currentSeries}
      fillOpacity={0.15}
      isAnimationActive={true}
      animationDuration={300}
    />
    <Radar
      name="Preset"
      dataKey="preset"
      stroke={CHART_COLORS.presetSeries}
      fill={CHART_COLORS.presetSeries}
      fillOpacity={0.25}
      isAnimationActive={true}
      animationDuration={300}
    />
    <Tooltip />
    <Legend />
  </RadarChart>
</ResponsiveContainer>
```

### Stat Binding Normalization for Radar Chart
```typescript
// Source: project codebase [VERIFIED: creator/src/types/config.ts StatBindings interface]
// The StatBindings interface has these numeric effectiveness fields:
// - meleeDamageDivisor: lower = more damage per stat point (invert for chart)
// - dodgePerPoint: higher = more dodge per stat point (direct)
// - maxDodgePercent: cap on dodge (direct)
// - spellDamageDivisor: lower = more spell damage (invert for chart)
// - hpScalingDivisor: lower = more HP per stat point (invert for chart)
// - manaScalingDivisor: lower = more mana per stat point (invert for chart)
// - hpRegenMsPerPoint: higher = faster regen (direct)
// - manaRegenMsPerPoint: higher = faster regen (direct)
// - xpBonusPerPoint: higher = more XP bonus (direct)
//
// For radar chart: normalize divisors by inverting (1/divisor) so "bigger = better"
// This makes the radar shape intuitive -- larger polygon = more powerful scaling

interface StatRadarPoint {
  stat: string;
  current: number;
  preset: number;
}

export function buildStatRadarData(
  currentBindings: StatBindings,
  presetBindings: StatBindings,
): StatRadarPoint[] {
  return [
    { stat: "Melee Dmg", current: 1 / currentBindings.meleeDamageDivisor, preset: 1 / presetBindings.meleeDamageDivisor },
    { stat: "Spell Dmg", current: 1 / currentBindings.spellDamageDivisor, preset: 1 / presetBindings.spellDamageDivisor },
    { stat: "HP Scaling", current: 1 / currentBindings.hpScalingDivisor, preset: 1 / presetBindings.hpScalingDivisor },
    { stat: "Mana Scaling", current: 1 / currentBindings.manaScalingDivisor, preset: 1 / presetBindings.manaScalingDivisor },
    { stat: "Dodge", current: currentBindings.dodgePerPoint, preset: presetBindings.dodgePerPoint },
    { stat: "HP Regen", current: currentBindings.hpRegenMsPerPoint, preset: presetBindings.hpRegenMsPerPoint },
    { stat: "Mana Regen", current: currentBindings.manaRegenMsPerPoint, preset: presetBindings.manaRegenMsPerPoint },
    { stat: "XP Bonus", current: currentBindings.xpBonusPerPoint, preset: presetBindings.xpBonusPerPoint },
  ];
}
```

### Vite Manual Chunks Update
```typescript
// Source: project codebase [VERIFIED: creator/vite.config.ts]
// Add after the yaml chunk line:
if (id.includes("recharts")) return "vendor-charts";
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| recharts 2.x with react-smooth dep | recharts 3.x with internal animations | 3.0 release | Smaller bundle, no external animation dep [CITED: github.com/recharts/recharts/wiki/3.0-migration-guide] |
| `accessibilityLayer={false}` default | `accessibilityLayer={true}` default | 3.0 | Charts are keyboard-accessible by default |
| CategoricalChartState passed to children | Hooks-based internal state | 3.0 | Custom components use hooks instead of props |
| recharts-scale external dep | Scale utilities internal | 3.0 | One fewer dependency |

**Deprecated/outdated:**
- `CategoricalChartState`: Removed in 3.0 -- do not reference in custom components
- `react-smooth`: No longer a dependency -- animations handled internally
- `activeIndex` prop on Scatter/Bar/Pie: Removed -- use Tooltip patterns instead

## Assumptions Log

> List all claims tagged `[ASSUMED]` in this research. The planner and discuss-phase use this
> section to identify decisions that need user confirmation before execution.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Radar chart stat normalization should invert divisors (1/divisor) so "bigger = more powerful" | Code Examples | If inverted incorrectly, radar shape would be counterintuitive -- larger polygon meaning weaker scaling. Low risk: easily adjustable. |
| A2 | Chart card height of 220px will fit well in the layout without scrolling | Architecture Patterns | If too tall, the 3 cards plus metric cards might push below fold. Easily adjustable during implementation. |
| A3 | D-09 "Strong" tier label is a naming discrepancy -- actual config key is "standard" | Pitfalls | If the user actually wants a "Strong" tier that doesn't exist in config, data will be missing. Very likely just a label choice. |

**If this table is empty:** N/A -- three assumptions noted above.

## Open Questions

1. **Mob tier naming: "Standard" vs "Strong"**
   - What we know: Config has `weak`, `standard`, `elite`, `boss` (4 tiers). D-09 says "Standard, Strong, Elite, Boss".
   - What's unclear: Whether "Strong" was meant to be a display label for `standard` or if there's a missing tier.
   - Recommendation: Use `weak`, `standard`, `elite`, `boss` from config and map to readable display labels. The 4 tier keys in `MobTiersConfig` are the source of truth.

2. **Radar chart value ranges differ wildly**
   - What we know: `dodgePerPoint` ranges 1-3, `hpRegenMsPerPoint` ranges 150-250, and divisors range 2-6.
   - What's unclear: Whether raw values or normalized values look better on the radar.
   - Recommendation: Normalize all values to a 0-1 scale (min-max normalization across both current and preset) so the radar shape is meaningful. Alternatively, display raw inverted-divisor values and let the scale auto-adjust. Start with raw values (simpler) and normalize only if the shape is unreadable.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `creator/vitest.config.ts` |
| Quick run command | `bun run test` |
| Full suite command | `bun run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VIZ-01 | buildXpCurveData returns 50 data points with correct values | unit | `bun run test -- src/lib/tuning/__tests__/chartData.test.ts` | No -- Wave 0 |
| VIZ-02 | buildMobTierData returns correct grouped bar data at each level | unit | `bun run test -- src/lib/tuning/__tests__/chartData.test.ts` | No -- Wave 0 |
| VIZ-03 | buildStatRadarData returns correct normalized stat points | unit | `bun run test -- src/lib/tuning/__tests__/chartData.test.ts` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `bun run test`
- **Per wave merge:** `bun run test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/tuning/__tests__/chartData.test.ts` -- covers VIZ-01, VIZ-02, VIZ-03 data preparation
- No framework gaps -- Vitest already configured and working

## Security Domain

This phase adds a pure frontend visualization library rendering SVG charts from locally-computed data. No user input is sent to external services, no authentication, no data persistence.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A |
| V5 Input Validation | No | All data is locally computed from existing config store |
| V6 Cryptography | No | N/A |

No security concerns for this phase. Recharts renders SVG from in-memory data; no external data ingestion or network calls.

## Sources

### Primary (HIGH confidence)
- npm registry -- `recharts@3.8.1` version verification, peer dependencies, TypeScript types
- Project codebase -- `formulas.ts`, `types.ts`, `TuningWizard.tsx`, `MetricCard.tsx`, `presets.ts`, `config.ts`, `index.css`, `vite.config.ts`, `vitest.config.ts`

### Secondary (MEDIUM confidence)
- [Recharts API docs: LineChart](https://recharts.github.io/en-US/api/LineChart/) -- Component props and children
- [Recharts API docs: RadarChart](https://recharts.github.io/en-US/api/RadarChart/) -- Polar chart composition
- [Recharts API docs: BarChart](https://recharts.github.io/en-US/api/BarChart/) -- Grouped bar configuration
- [Recharts API docs: ResponsiveContainer](https://recharts.github.io/en-US/api/ResponsiveContainer/) -- Auto-sizing wrapper
- [Recharts 3.0 Migration Guide](https://github.com/recharts/recharts/wiki/3.0-migration-guide) -- Breaking changes from 2.x

### Tertiary (LOW confidence)
- None -- all findings verified against official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Recharts version and React 19 compatibility verified against npm registry
- Architecture: HIGH -- Patterns derived from existing codebase conventions and Recharts official docs
- Pitfalls: HIGH -- Verified against Recharts 3.0 migration guide and SVG rendering behavior

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (Recharts is mature/stable; 30-day validity)
