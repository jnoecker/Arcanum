# Phase 6: Visualizations - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 06-visualizations
**Areas discussed:** Chart library choice, Chart placement and layout, Chart styling and theming, Data range and interactivity

---

## Chart Library Choice

| Option | Description | Selected |
|--------|-------------|----------|
| Recharts | React-native SVG, declarative JSX, tree-shakeable ~40KB | ✓ |
| Raw SVG with custom hooks | Zero dependency, full control | |
| Chart.js + react-chartjs-2 | Canvas-based, ~60KB | |
| Lightweight SVG (visx) | D3-based primitives | |

**User's choice:** Recharts

---

## Chart Placement and Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Below metric cards, above parameter browser | Natural flow: preset → metrics → charts → raw fields | ✓ |
| Inside expandable metric cards | Compact, on-demand detail | |
| Dedicated visualization tab/panel | Separate navigation | |

**User's choice:** Below metric cards, above parameter browser

| Option | Description | Selected |
|--------|-------------|----------|
| Horizontal row of 3 cards | grid-cols-3, all visible at once | ✓ |
| Stacked vertically | Full-width, more detail | |
| Tabbed chart panel | One at a time with tab buttons | |

**User's choice:** Horizontal row of 3 cards

| Option | Description | Selected |
|--------|-------------|----------|
| Only when preset is selected | Matches Phase 4 pattern | ✓ |
| Always visible with current config only | More upfront info | |

**User's choice:** Only when preset is selected

---

## Chart Styling and Theming

| Option | Description | Selected |
|--------|-------------|----------|
| Current = muted, Preset = aurum-gold accent | Preset visually dominates | ✓ |
| Current = gold, Preset = contrasting color | Equal visual weight | |
| Current = dashed, Preset = solid (same color) | Line style differentiation | |

**User's choice:** Current = muted, Preset = aurum-gold accent

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle transition animation | 300ms ease-out on data change | ✓ |
| No animation | Instant swap | |
| Entrance animation only | Unfurl-in style, instant updates | |

**User's choice:** Subtle transition animation

---

## Data Range and Interactivity

| Option | Description | Selected |
|--------|-------------|----------|
| Levels 1-50, all plotted | Full progression curve | ✓ |
| Representative levels only (6 points) | Less smooth, no new computation | |
| Configurable range with slider | Flexible but complex UI | |

**User's choice:** Levels 1-50, all plotted

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown selector with Lv10/20/30/50 | 4 preset levels, default Lv30 | ✓ |
| Slider for any level 1-50 | Continuous, more granular | |
| Fixed at Lv30 | Simplest, no interaction | |

**User's choice:** Dropdown selector with preset levels

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, Recharts default tooltips | Exact values on hover | ✓ |
| No tooltips | Purely visual | |
| Custom styled tooltips | Arcanum-themed Tippy match | |

**User's choice:** Recharts default tooltips

---

## Claude's Discretion

- Exact Recharts component configuration and prop choices
- Chart card internal padding and sizing
- Radar chart axis labels and stat ordering
- Mob chart bar color palette for different stats
- Legend placement and styling
- Responsive behavior if wizard is narrow

## Deferred Ideas

None — discussion stayed within phase scope
