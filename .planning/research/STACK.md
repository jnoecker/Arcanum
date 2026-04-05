# Technology Stack: Tuning Wizard

**Project:** Arcanum Tuning Wizard
**Researched:** 2026-04-04
**Mode:** Ecosystem (stack dimension for new milestone in existing app)

## Context

The tuning wizard adds a game balance preset/comparison system to an existing Tauri 2 desktop app. The app already has React 19, Zustand 5, Tailwind CSS 4, and a comprehensive configStore managing 300+ gameplay values across 45+ panels. This research covers **only new dependencies** needed for the wizard -- not the existing stack.

## Recommended Additions

### Charting / Visualization

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Recharts | ^3.8 | Radar charts, bar charts, line charts for before/after comparison | React-native component API, supports RadarChart (perfect for stat profiles), BarChart (side-by-side metric comparison), LineChart (XP/scaling curves). Lightweight SVG-based. React 19 compatibility resolved in 3.x series. Already used by shadcn/ui charts. |

**Confidence:** HIGH -- Recharts 3.8.1 published March 2026, actively maintained, React 19 support confirmed in 3.x line.

**Why Recharts over alternatives:**
- **Nivo**: Beautiful charts but React 19 support is incomplete (issue #2618 only partially resolved in 0.98+). Heavier bundle due to full D3 dependency. Overkill for the 3-4 chart types we need.
- **Chart.js / react-chartjs-2**: Canvas-based rendering looks foreign in the Arcanum SVG/DOM UI. Theming is harder to match with CSS custom properties.
- **Victory**: Stalled development, React 19 compatibility unverified.
- **Custom D3**: Unnecessary complexity for standard chart types. Recharts already wraps D3 with a React-friendly API.

**Chart types needed:**
- **RadarChart**: Compare preset stat profiles (STR/DEX/CON/INT/WIS/CHA emphasis across presets)
- **BarChart**: Side-by-side comparison of discrete values (mob HP per tier, gold rewards, etc.)
- **LineChart**: Visualize scaling curves (XP required per level, HP growth, damage scaling)
- **ComposedChart**: Overlay current vs. preset values on a single chart

### Object Diffing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| deep-object-diff | ^1.1 | Compute structured diffs between current config and preset values | Returns `{ added, deleted, updated }` via `detailedDiff()`. Handles nested objects (critical -- config has nested sections like `mobTiers.normal.hpBase`). Zero dependencies. 2M+ weekly downloads. |

**Confidence:** HIGH -- stable library, simple API, no dependencies, well-tested for nested objects.

**Why deep-object-diff over alternatives:**
- **deep-diff**: Lower-level API, returns patch-style operations instead of clean diff objects. Harder to render in a comparison table.
- **Manual diffing**: Config objects are deeply nested with 45+ sections. Manual comparison is error-prone and tedious to maintain as config evolves.
- **JSON patch (RFC 6902)**: Overkill -- we need human-readable diffs for display, not machine-applicable patches.

### Formula Visualization (No New Library Needed)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Plain TypeScript functions | N/A | Evaluate MUD game formulas for preview charts | The formulas are fixed and known (XP curve, stat scaling, damage calculation). They're documented in the Kotlin reference code. Implementing 5-10 pure TS functions is simpler and more maintainable than pulling in mathjs (700KB+ bundle) for expression parsing we don't need. |

**Confidence:** HIGH -- the formulas are deterministic and documented in `reference/`.

**Key formulas to implement as TS functions:**
- `xpForLevel(level, base, exponent, linear, multiplier)` -- XP curve
- `hpAtLevel(level, baseHp, hpPerLevel)` -- HP growth
- `damageFromStat(statValue, divisor)` -- Stat-to-damage conversion
- `mobHpAtLevel(level, tier, hpBase, hpPerLevel)` -- Mob HP scaling
- `goldReward(level, tier, goldBase, goldPerLevel)` -- Economy scaling

These feed directly into Recharts line/bar charts to show "here's what your XP curve looks like at level 1-100."

## Explicitly NOT Adding

| Category | Rejected | Why Not |
|----------|----------|---------|
| Text diff viewer | react-diff-viewer, git-diff-view | This is numeric config comparison, not text/code diffing. A custom table with color-coded cells (red for decrease, green for increase, gold for unchanged) fits the Arcanum design system and is more readable for game balance values. |
| Formula parser | mathjs, expr-eval | 700KB+ for mathjs. The MUD formulas are fixed, not user-defined. Plain TS functions are smaller, type-safe, and testable. |
| Full dashboard framework | Grafana embeds, Metabase | Massive overkill. We need 3-4 chart types in a wizard flow, not a general-purpose dashboard. |
| State management | Additional stores | Wizard state lives in a new Zustand store (tuningStore) following the existing pattern. No new state management library needed. |
| Animation library | framer-motion, react-spring | Recharts has built-in animations. Tailwind CSS transitions handle the rest. No need for a separate animation library. |
| Preset storage format | JSON Schema, Zod presets | Presets are TypeScript objects conforming to existing config interfaces. The type system handles validation. No schema library needed. |

## Alternatives Considered (Full Matrix)

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| Charts | Recharts ^3.8 | Nivo ^0.99 | React 19 support incomplete, heavier bundle, more chart types than we need |
| Charts | Recharts ^3.8 | react-chartjs-2 | Canvas-based (harder to theme with CSS vars), visual mismatch with Arcanum UI |
| Object diff | deep-object-diff ^1.1 | deep-diff ^1.0 | Patch-style output harder to render in comparison tables |
| Object diff | deep-object-diff ^1.1 | Manual lodash comparison | Error-prone with 45+ nested config sections, maintenance burden |
| Formulas | Plain TS | mathjs ^14 | 700KB bundle for 5 formulas we can write in 50 lines of TS |

## Installation

```bash
cd creator

# New dependencies for tuning wizard
bun add recharts deep-object-diff

# No new dev dependencies needed
```

**Bundle impact estimate:**
- Recharts: ~180KB minified (tree-shakeable -- only import used chart types)
- deep-object-diff: ~2KB minified
- Total: ~182KB added (should be code-split into wizard chunk via Vite manual chunks)

**Vite chunk configuration** (add to existing `manualChunks` in `vite.config.ts`):
```typescript
tuning: ['recharts'],
```

## Integration with Existing Stack

| Existing Tech | How Wizard Uses It |
|---------------|-------------------|
| configStore (Zustand) | Reads current config values; writes accepted preset changes via existing `saveConfigSection` |
| TypeScript config interfaces | Preset objects typed to same interfaces; compiler catches incompatibilities |
| Tailwind CSS 4 | All wizard UI styled with existing design tokens (`bg-bg-primary`, `text-accent`, etc.) |
| Panel registry | Wizard registered as new top-level tab, not a config panel |
| YAML round-trip (CST mode) | Unchanged -- configStore handles YAML persistence, wizard just calls store methods |
| Vitest | Formula functions are pure and highly testable; add tests for XP curve, damage calc, etc. |

## Recharts Theming for Arcanum

Recharts supports custom colors via props. Map to Arcanum design tokens:

```typescript
// Arcanum chart theme constants
const CHART_THEME = {
  current: 'hsl(var(--accent))',        // aurum-gold for current values
  preset: 'hsl(var(--info))',           // blue for preset values
  increase: 'hsl(var(--success))',      // green for increases
  decrease: 'hsl(var(--error))',        // red for decreases
  grid: 'hsl(var(--border-default))',   // subtle grid lines
  text: 'hsl(var(--text-secondary))',   // axis labels
  background: 'transparent',            // charts float on panel background
};
```

## Sources

- [Recharts npm](https://www.npmjs.com/package/recharts) -- v3.8.1, March 2026
- [Recharts React 19 issue #4558](https://github.com/recharts/recharts/issues/4558) -- resolved in 3.x
- [Recharts 3.0 migration guide](https://github.com/recharts/recharts/wiki/3.0-migration-guide)
- [Nivo React 19 issue #2618](https://github.com/plouc/nivo/issues/2618) -- partially resolved
- [deep-object-diff npm](https://www.npmjs.com/package/deep-object-diff) -- v1.1, 2M+ weekly downloads
- [deep-object-diff vs deep-diff comparison](https://npm-compare.com/deep-diff,deep-object-diff,object-diff)
- [mathjs.org](https://mathjs.org/) -- considered and rejected for bundle size
- [Recharts RadarChart API](https://recharts.org/?p=%2Fen-US%2Fapi%2FRadar)
- [Nivo vs Recharts comparison](https://www.speakeasy.com/blog/nivo-vs-recharts)

---

*Stack analysis: 2026-04-04*
