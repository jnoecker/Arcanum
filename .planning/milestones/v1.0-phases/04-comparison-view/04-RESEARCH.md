# Phase 4: Comparison View - Research

**Researched:** 2026-04-05
**Domain:** React UI — derived metrics dashboard, Tippy.js tooltips, diff color-coding, Zustand state extension
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Summary cards with 2-3 curated headline metrics per section. Each card shows current vs preset side-by-side with delta arrows and percentage change. Cards are grouped in a 2x2 grid (one per TuningSection).

**D-02:** Highlight metrics at three representative levels: Lv10, Lv30, Lv50 — spanning early, mid, and late game milestones.

**D-03:** Combat metric cards use Normal mob tier only. Other tiers (Strong, Elite, Boss) are visible when drilling into raw field diffs below.

**D-04:** Curated metrics per section card (not exhaustive). Combat gets Mob HP + Player Damage + Dodge; Progression gets XP-to-Level + Player HP; Economy gets Gold/Kill + shop multiplier; World gets regen interval + relevant timing.

**D-05:** Metric summary cards appear between preset cards and the parameter browser. Top-down flow: choose preset → see metric impact → drill into field details. Preset cards stay at top, search/filter bar and parameter browser remain below metrics.

**D-06:** Metric cards only appear after a preset is selected. Before selection, the parameter browser is the main content (matching Phase 3's pattern).

**D-07:** Raw field sections default to collapsed after preset selection. Metric cards are the star; builders expand sections only to drill into specific field changes.

**D-08:** Direction-only coloring with no value judgment. Green for increase, red for decrease, muted for unchanged. No attempt to assess "better vs worse".

**D-09:** Show arrow + percentage delta alongside values (e.g., "▼ 15.6%"). Helps builders gauge magnitude at a glance without mental math.

**D-10:** Hover popovers on field labels using the existing Tippy.js dependency.

**D-11:** Each tooltip shows: field description (always present), interaction note (when available in FieldMeta), and a colored impact badge (HIGH / MEDIUM / LOW).

**D-12:** Derived metric rows in summary cards also get formula tooltips. Hovering a metric explains the calculation.

### Claude's Discretion

- Exact metric selection per section card (which 2-3 of the available metrics are most informative)
- Metric card visual design (internal layout, spacing, typography within the card pattern)
- Tooltip positioning and styling within Tippy.js configuration
- Transition/animation when metric cards appear after preset selection
- Whether to show a "changes count" badge on collapsed section headers

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMP-01 | Before/after comparison view showing current config vs selected preset | `computeMetrics()` + `deepMerge()` in TuningWizard already produce both configs; MetricSectionCards component consumes both snapshots |
| COMP-02 | Comparison organized by system grouping (combat, economy, progression, stats) | `TuningSection` enum provides 4 groups; 2x2 card grid maps one card per section |
| COMP-03 | Derived metrics shown prominently (time-to-kill, XP-to-level, gold-per-hour at key levels) | `computeMetrics()` already returns all 8 metric types at 6 representative levels; D-04 curates which 2-3 show per section |
| COMP-04 | Raw field diffs available in expandable sections below derived metrics | `ParameterSection` already implements collapse/expand; D-07 changes default state to collapsed when preset selected |
| COMP-05 | Color-coded changes: increases, decreases, unchanged — direction-only | `ParameterRow.diffColor()` extended with `text-status-success`/`text-status-error` + arrow + percentage delta |
| UI-04 | Contextual tooltips on every tunable field explaining what it does and what it interacts with | Tippy.js already in project; `FIELD_METADATA` has `description`, `interactionNote`, `impact` for every field |
</phase_requirements>

---

## Summary

Phase 4 adds the Comparison View to the existing TuningWizard workspace built in Phase 3. The work is entirely frontend: no new Rust commands, no YAML changes, no new library installs. All infrastructure is in place — `computeMetrics()` evaluates formulas at representative levels, `FIELD_METADATA` holds tooltip copy for all 137 fields, and Tippy.js is already a project dependency.

The two primary deliverables are: (1) a `MetricSectionCards` component showing a 2x2 grid of before/after KPI cards, inserted into `TuningWizard.tsx` between the preset row and the search bar, and (2) tooltip enhancement on `ParameterRow` using Tippy.js directly (not the React wrapper). The `ParameterRow` also needs its diff display upgraded from simple color-coded values to arrow + percentage delta format.

The main state concern is the default-collapsed behavior: when a preset is selected, all `ParameterSection` instances should default to collapsed. The `tuningWizardStore` needs a `collapseAll()` action triggered from `TuningWizard.tsx`'s preset selection handler.

**Primary recommendation:** Build MetricSectionCards as a standalone new component. Enhance ParameterRow and ParameterSection in-place. Add `collapseAll()` to tuningWizardStore. All changes are additive — no rearchitecting required.

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tippy.js | ^6.3.7 | Hover popovers for field tooltips | Already in project; used in LoreEditor for @mention popups |
| React 19 | ^19.0.0 | Component rendering | Project standard |
| Zustand 5 | ^5.0.0 | tuningWizardStore state extension | Project standard |
| Tailwind CSS 4 | ^4.0.0 | All visual styling | Project standard |

[VERIFIED: grep of creator/package.json and creator/src/components/lore/LoreEditor.tsx]

### No New Installs Needed

The `@tippyjs/react` React wrapper is NOT installed and NOT needed. The existing project uses the vanilla `tippy.js` import directly (as seen in LoreEditor). Phase 4 should follow the same pattern: `import tippy from "tippy.js"` used imperatively via `useEffect` or `useRef`. [VERIFIED: LoreEditor.tsx line 8]

---

## Architecture Patterns

### Recommended File Structure for New Code

```
creator/src/
└── components/
    └── tuning/
        ├── TuningWizard.tsx       — insert MetricSectionCards + collapseAll trigger
        ├── MetricSectionCards.tsx  — NEW: 2x2 grid of MetricCard components
        ├── MetricCard.tsx          — NEW: single KPI card for one TuningSection
        ├── ParameterSection.tsx    — MODIFIED: changes-count badge on header
        └── ParameterRow.tsx        — MODIFIED: Tippy tooltip + arrow/percentage delta
```

### Pattern 1: MetricSectionCards — 2x2 KPI Card Grid

**What:** A row of 4 cards, one per TuningSection, each showing 2-3 derived metrics comparing current config vs merged preset config at Lv10, Lv30, Lv50.

**When to use:** Rendered in TuningWizard between the preset row and the SearchFilterBar, only when `selectedPresetId !== null`.

**Key data flow:**
- `TuningWizard` already has `presetMetrics: Map<string, MetricSnapshot>` from Phase 3
- `TuningWizard` already has `config` from configStore (current values)
- Compute `currentMetrics = useMemo(() => computeMetrics(config), [config])` — new addition
- Pass both `currentMetrics` and `presetMetrics.get(selectedPresetId)` to MetricSectionCards
- MetricSectionCards extracts the 2-3 curated values per section, computes delta

**Component signature:**
```typescript
// Source: design from 04-CONTEXT.md D-01, D-04
interface MetricSectionCardsProps {
  currentMetrics: MetricSnapshot;
  presetMetrics: MetricSnapshot;
}

export function MetricSectionCards({ currentMetrics, presetMetrics }: MetricSectionCardsProps)
```

**Grid layout:** `grid grid-cols-2 gap-4 px-6 mt-6 mb-6` — 2x2 with generous gap.

### Pattern 2: MetricCard — Single Section KPI Card

**What:** One card for a TuningSection. Shows section name, 2-3 curated before/after metric rows, each with arrow + percentage delta.

**Curated metrics by section (D-04):**

| Section | Metric 1 | Metric 2 | Metric 3 |
|---------|----------|----------|----------|
| Combat & Stats | Mob HP (Standard, Lv10) | Mob HP (Standard, Lv30) | Dodge Chance |
| Progression & Quests | XP to Lv10 | XP to Lv30 | Player HP (Lv10) |
| Economy & Crafting | Gold/Kill (Standard, Lv10) | Gold/Kill (Standard, Lv30) | — (2 metrics) |
| World & Social | Regen Interval | — (1-2 metrics) | — |

Note: Economy lacks a "shop multiplier" metric in MetricSnapshot — shop multipliers are raw field values, not derived. The planner should use Gold/Kill (from `mobGoldAvg["standard"]`) for Economy metrics, and note that buy/sell multipliers are visible in the raw diff rows below. [ASSUMED — depends on what MetricSnapshot actually computes; verified that `mobGoldAvg` exists in MetricSnapshot]

**Delta calculation:**
```typescript
// Source: D-09 from 04-CONTEXT.md
function computeDelta(current: number, preset: number): { pct: string; direction: "up" | "down" | "same" } {
  if (current === preset) return { pct: "0%", direction: "same" };
  const pct = ((preset - current) / Math.abs(current)) * 100;
  return {
    pct: `${Math.abs(pct).toFixed(1)}%`,
    direction: pct > 0 ? "up" : "down",
  };
}
```

**Color rules (D-08):**
- Increase: `text-status-success` (#a3c48e) — green
- Decrease: `text-status-error` (#dbb8b8) — muted red
- No change: `text-text-muted`

**Arrow + percentage format (D-09):** `"▲ 12.5%"` or `"▼ 8.3%"` or `"—"` for unchanged.

**Formula tooltip on metric rows (D-12):** Each metric row in a card wraps the label in a Tippy tooltip explaining what formula drives that number.

### Pattern 3: Tippy.js Tooltip on ParameterRow

**What:** Each field label in ParameterRow gets a hover tooltip showing description, optional interactionNote, and impact badge.

**How:** The existing project uses `tippy.js` directly, not the React wrapper. The correct pattern is:

```typescript
// Source: LoreEditor.tsx line 191 shows vanilla tippy usage
import tippy from "tippy.js";
import "tippy.js/dist/tippy.css";  // May already be imported globally; verify

// In ParameterRow, use a ref on the label span and attach in useEffect
const labelRef = useRef<HTMLSpanElement>(null);

useEffect(() => {
  if (!labelRef.current) return;
  const instance = tippy(labelRef.current, {
    content: tooltipContent,  // HTML string or DOM node
    placement: "top-start",
    theme: "arcanum",         // Custom theme via CSS (see Anti-Patterns)
    delay: [200, 100],
    interactive: false,
  });
  return () => instance.destroy();
}, [tooltipContent]);
```

**Tooltip HTML content:** Build as a string with the three data pieces from FieldMeta:
- `meta.description` — always present
- `meta.interactionNote` — render when defined
- `meta.impact` — color-coded badge: high = `text-status-error`, medium = `text-status-warning`, low = `text-text-muted`

**Tooltip theming concern:** Tippy.js applies its own default light theme. The project will need a custom Tippy CSS theme override or use `allowHTML: true` with inline styles to match the Arcanum dark color system. See Pitfalls section.

### Pattern 4: Collapsed-by-Default After Preset Selection

**What:** When a preset is first selected (or changed), all ParameterSections collapse. Builder can expand individually to drill in.

**Store change required:** Add `collapseAll()` action to `tuningWizardStore`:

```typescript
// Source: 04-CONTEXT.md code_context + D-07
collapseAll: () =>
  set({
    collapsedSections: new Set([
      TuningSection.CombatStats,
      TuningSection.EconomyCrafting,
      TuningSection.ProgressionQuests,
      TuningSection.WorldSocial,
    ]),
  }),
```

**Trigger point in TuningWizard:** In the `handleSelect` function, call `collapseAll()` after `selectPreset(preset.id)`. When deselecting (toggling off), do NOT collapse — restore expanded state.

**Nuance:** If user has already expanded sections, selecting a different preset should re-collapse everything to focus attention on the new metric cards. This is safe because sections remain expandable.

### Pattern 5: Enhanced ParameterRow Diff Display

**What:** Replace the existing simple colored value in the preset column with arrow + percentage delta.

**Current state:** `ParameterRow` shows `presetValue` in `diffColor()` style (text-status-warning for increase, text-status-info for decrease). No percentage. [VERIFIED: ParameterRow.tsx lines 27-34]

**New state:** Show both the preset value and a `"▲ X.X%"` or `"▼ X.X%"` badge when `isChanged` is true and both values are numeric.

**Column layout adjustment:** The current `grid-cols-[1.2fr_100px_100px_1.5fr]` for the preset case may need a small tweak to accommodate the badge — consider `grid-cols-[1.2fr_80px_120px_1.5fr]` or nest the preset value and badge in a single cell.

**Color alignment with D-08:** Current ParameterRow uses `text-status-warning` for increase and `text-status-info` for decrease. D-08 mandates green for increase and red for decrease. Update to `text-status-success` (green) and `text-status-error` (muted red). [VERIFIED: index.css color tokens — status-success is #a3c48e, status-error is #dbb8b8]

### Pattern 6: Changes-Count Badge on Collapsed Section Headers

**What:** (Claude's discretion) When a section is collapsed and a preset is active, show a badge with the count of changed fields. Helps builders decide which sections to drill into.

**Implementation:** In `ParameterSection`, count `fields.filter(([path]) => diffMap.has(path)).length` and show alongside the existing total-field badge when `hasPreset` is true and `isCollapsed` is true.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tooltip positioning logic | Custom CSS position calculation | Tippy.js | Handles viewport clipping, arrow positioning, scroll, z-index |
| Percentage formatting edge cases | Custom formatter | `toFixed(1)` + guard for zero denominator | Divide-by-zero when current value is 0; need explicit guard |
| Deep merge of preset onto config | Custom merge utility | `deepMerge()` in TuningWizard.tsx | Already exists, tested, handles nested objects |
| MetricSnapshot for current config | Re-implement formula calls | `computeMetrics(config)` | Already covers all 8 metric types at all 6 levels |

**Key insight:** Almost all the hard work is done. This phase assembles existing primitives into new UI shapes, not new logic.

---

## Common Pitfalls

### Pitfall 1: Tippy Default Theme Clashes with Dark UI

**What goes wrong:** Tippy's default theme uses a light popover background. On the Arcanum dark UI, the default Tippy tooltip looks completely out of place.

**Why it happens:** Tippy.js ships with its own `tippy.css` which defines background color and text color for `.tippy-box`. The defaults are light-themed.

**How to avoid:** Add a Tippy theme override in `creator/src/index.css` using the `[data-theme~='arcanum']` CSS selector:

```css
/* Arcanum Tippy theme -- add to index.css */
[data-theme~='arcanum'] .tippy-box {
  background-color: var(--color-bg-elevated);
  border: 1px solid var(--color-border-default);
  color: var(--color-text-primary);
  font-family: var(--font-sans);
  font-size: 14px;
}
[data-theme~='arcanum'] .tippy-box[data-placement^='top'] > .tippy-arrow::before {
  border-top-color: var(--color-bg-elevated);
}
/* repeat for other placements */
```

Then use `theme: "arcanum"` in the `tippy()` call. [ASSUMED — Tippy CSS theming API; standard documented approach but unverified against Tippy 6.3.7 specifically. HIGH likelihood based on known Tippy API patterns]

**Warning signs:** White tooltip boxes on dark background — immediately visible on first render.

### Pitfall 2: Tippy CSS Import Duplication

**What goes wrong:** Importing `tippy.js/dist/tippy.css` in both `LoreEditor.tsx` and the new component causes duplicate CSS injection (harmless but adds noise).

**Why it happens:** Each component that imports the CSS file gets it bundled.

**How to avoid:** Import `tippy.js/dist/tippy.css` only once, in `creator/src/index.css` via `@import "tippy.js/dist/tippy.css"`, or in `main.tsx`. Check if LoreEditor already imports it — if so, a single global import is cleaner. [ASSUMED — need to verify if LoreEditor already imports tippy CSS before deciding where to put global import]

**Warning signs:** Inspect bundle in dev tools — watch for duplicate `tippy` CSS rules.

### Pitfall 3: Percentage Delta Division by Zero

**What goes wrong:** When `currentValue === 0`, computing `(preset - current) / Math.abs(current)` produces `Infinity` or `NaN`.

**Why it happens:** Some config fields legitimately default to 0 (e.g., `factions.defaultReputation`). The diff engine will report a change, but percentage calculation will fail.

**How to avoid:**
```typescript
function pctDelta(oldVal: number, newVal: number): string {
  if (oldVal === 0) return newVal > 0 ? "+new" : newVal < 0 ? "-new" : "—";
  const pct = ((newVal - oldVal) / Math.abs(oldVal)) * 100;
  return `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(1)}%`;
}
```

**Warning signs:** "▲ Infinity%" or "▲ NaN%" in the diff column.

### Pitfall 4: collapseAll Called on Every Render

**What goes wrong:** If `collapseAll` is triggered inside the render function or an effect without proper dependencies, sections collapse every time config updates.

**Why it happens:** `config` changes when the user edits any field in other panels. If collapse is tied to `selectedPresetId !== null` without gating on selection change, it collapses unexpectedly.

**How to avoid:** Only call `collapseAll()` in the `handleSelect` handler when a new preset is being selected (not deselected, not on re-render). Use a `useEffect` only if strictly necessary — prefer the event handler approach.

### Pitfall 5: MetricSnapshot currentMetrics Re-Computed Unnecessarily

**What goes wrong:** Computing `computeMetrics(config)` on every render is expensive if `config` changes frequently.

**Why it happens:** `computeMetrics` iterates over 6 levels and all mob tiers — not trivial.

**How to avoid:** `const currentMetrics = useMemo(() => computeMetrics(config), [config])` — already the pattern for `presetMetrics` in TuningWizard.tsx. Apply the same discipline.

### Pitfall 6: Conditional useEffect with Tippy Refs

**What goes wrong:** The `labelRef` for Tippy is on a conditionally rendered element — when `hasPreset` is false, the element may not exist when the effect runs.

**Why it happens:** ParameterRow renders differently when `hasPreset` is false.

**How to avoid:** Tippy is attached to the label span, which is always rendered (not conditional on `hasPreset`). The tooltip content can be set regardless of preset state — tooltips on field labels are always valuable. Only the percentage delta column is conditional.

---

## Code Examples

### Metric Row in MetricCard

```typescript
// Pattern for a before/after metric row with delta badge
// Source: D-01, D-09 from 04-CONTEXT.md

interface MetricRowProps {
  label: string;
  current: number;
  preset: number;
  format: (n: number) => string;
  formulaTooltip?: string;
}

function MetricRow({ label, current, preset, format, formulaTooltip }: MetricRowProps) {
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!labelRef.current || !formulaTooltip) return;
    const t = tippy(labelRef.current, { content: formulaTooltip, theme: "arcanum", delay: [200, 100] });
    return () => t.destroy();
  }, [formulaTooltip]);

  const delta = computeDelta(current, preset);

  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <span ref={labelRef} className="font-sans text-sm text-text-secondary cursor-default">
        {label}
      </span>
      <span className="font-mono text-sm text-text-muted">{format(current)}</span>
      <span className={`font-mono text-sm ${deltaColor(delta.direction)}`}>
        {format(preset)} {delta.direction !== "same" ? `${delta.direction === "up" ? "▲" : "▼"} ${delta.pct}` : "—"}
      </span>
    </div>
  );
}
```

### Tippy Tooltip on ParameterRow Label

```typescript
// Source: LoreEditor.tsx line 191 (vanilla tippy usage pattern)
// Source: 04-CONTEXT.md D-10, D-11

useEffect(() => {
  if (!labelRef.current) return;
  const parts = [meta.description];
  if (meta.interactionNote) parts.push(`Interacts with: ${meta.interactionNote}`);
  const impactLabel = meta.impact === "high" ? "HIGH IMPACT" : meta.impact === "medium" ? "MEDIUM IMPACT" : "LOW IMPACT";
  const content = `${parts.join("\n\n")}\n\n${impactLabel}`;
  const instance = tippy(labelRef.current, {
    content,
    theme: "arcanum",
    placement: "top-start",
    delay: [250, 100],
    maxWidth: 280,
  });
  return () => instance.destroy();
}, [meta.description, meta.interactionNote, meta.impact]);
```

### Collapse All on Preset Selection

```typescript
// Source: tuningWizardStore.ts + 04-CONTEXT.md D-07

// In store:
collapseAll: () =>
  set({
    collapsedSections: new Set(Object.values(TuningSection) as TuningSection[]),
  }),

// In TuningWizard.tsx handleSelect:
function handleSelect(preset: TuningPreset) {
  if (selectedPresetId === preset.id) {
    selectPreset(null);
    // do NOT collapseAll on deselect — preserve user's drill-in state
  } else {
    selectPreset(preset.id);
    collapseAll(); // collapse to bring metric cards into focus
  }
}
```

### Changes-Count Badge in ParameterSection Header

```typescript
// Source: ParameterSection.tsx + D-07 Claude's discretion

// Inside ParameterSection, before rendering rows:
const changedCount = useMemo(
  () => fields.filter(([path]) => diffMap.has(path)).length,
  [fields, diffMap]
);

// In header JSX, after existing field count badge:
{hasPreset && changedCount > 0 && (
  <span className="rounded-full bg-status-success/[0.14] px-2 py-0.5 font-sans text-sm text-status-success">
    {changedCount} changed
  </span>
)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Simple value coloring (warning/info) | Arrow + percentage delta + direction colors | Phase 4 | Magnitude visible at a glance |
| Sections expanded by default | Sections collapsed when preset selected | Phase 4 | Metric cards get visual priority |
| No tooltip on field labels | Tippy tooltip with description + interaction + impact | Phase 4 | UI-04 requirement fulfilled |
| No derived metrics panel | 2x2 MetricSectionCards between preset row and browser | Phase 4 | COMP-03 requirement fulfilled |

**Deprecated/outdated in Phase 4:**
- `diffColor()` in ParameterRow uses `text-status-warning` (orange) and `text-status-info` (blue) — these are semantically wrong for increase/decrease. Phase 4 updates to `text-status-success` and `text-status-error` to match D-08.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Tippy.js custom theme uses `[data-theme~='arcanum']` CSS selector pattern | Architecture Patterns (Tooltip theming), Common Pitfalls #1 | Tooltip theming would need a different approach; easy to fix on first render |
| A2 | Tippy CSS not already globally imported (only in LoreEditor) | Common Pitfalls #2 | If already global, adding a second import is harmless redundancy |
| A3 | Economy card should show Gold/Kill (mob gold) rather than raw buy/sell multipliers | Standard Stack / D-04 | Economy card may feel less useful if multipliers are the more informative metric; planner should validate choice |
| A4 | `selectPreset(null)` on deselect should NOT re-collapse sections | Architecture Patterns #4 | If user deselects and expects sections to stay as-is, this is correct; if they expect reset, needs adjustment |

---

## Open Questions

1. **Tippy CSS global import location**
   - What we know: LoreEditor imports `tippy.js` imperatively but may not import the CSS. The CSS needs to be imported exactly once.
   - What's unclear: Is `tippy.js/dist/tippy.css` imported anywhere currently?
   - Recommendation: The planner should include a Wave 0 task to verify and add the CSS import to `creator/src/index.css` or `main.tsx` if absent.

2. **Economy MetricCard content**
   - What we know: `MetricSnapshot.mobGoldAvg["standard"]` has gold-per-kill at levels; `MetricSnapshot` has no buy/sell multiplier field (those are raw config values not derived formulas).
   - What's unclear: Whether gold-per-kill meaningfully represents "Economy" or whether showing buy/sell multiplier raw values as pseudo-metrics would be more understandable.
   - Recommendation: Use `mobGoldAvg["standard"]` at Lv10 and Lv30 for Economy card; mention that buy/sell multipliers are visible in the raw field section below.

3. **World & Social MetricCard content**
   - What we know: `MetricSnapshot.regenInterval` has regen interval at each level. Beyond that, World/Social fields are mostly booleans, cooldowns, and integer limits — not amenable to "before/after" derived metrics in the same way as combat/XP.
   - What's unclear: Whether regen interval is sufficient for 2-3 metrics or if the card should show 1 metric + a "X fields changed" count.
   - Recommendation: Show regen interval at base stat value for current vs preset. If only 1 meaningful metric exists, use 1 metric + a "Y other fields changed" note rather than padding with uninformative values.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — all required libraries are already installed in node_modules; no new installs needed; no CLI tools, databases, or services required for this phase).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3 |
| Config file | `creator/vitest.config.ts` |
| Quick run command | `bun run test` (runs all 685 tests in ~1.6s) |
| Full suite command | `bun run test` |

[VERIFIED: vitest.config.ts, bun run test output — 685 tests passing]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMP-01 | Before/after metric values computed correctly | unit | `bun run test src/lib/tuning/__tests__/formulas.test.ts` | ✅ (existing) |
| COMP-02 | Metrics grouped by TuningSection correctly | unit | `bun run test src/lib/tuning/__tests__/diffEngine.test.ts` | ✅ (existing) |
| COMP-03 | `computeMetrics()` returns correct values at Lv10/30/50 | unit | `bun run test src/lib/tuning/__tests__/formulas.test.ts` | ✅ (existing) |
| COMP-04 | computeDiff + groupDiffBySection produce correct section buckets | unit | `bun run test src/lib/tuning/__tests__/diffEngine.test.ts` | ✅ (existing) |
| COMP-05 | Percentage delta calculation handles edge cases (zero denominator) | unit | `bun run test src/lib/tuning/__tests__/metricDelta.test.ts` | ❌ Wave 0 |
| UI-04 | Tooltip content built correctly from FieldMeta fields | unit | `bun run test src/lib/tuning/__tests__/tooltipContent.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `bun run test`
- **Per wave merge:** `bun run test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `creator/src/lib/tuning/__tests__/metricDelta.test.ts` — Tests `pctDelta()` helper: zero-denominator guard, positive delta, negative delta, identical values (covers COMP-05)
- [ ] `creator/src/lib/tuning/__tests__/tooltipContent.test.ts` — Tests tooltip string builder: description-only, description + interactionNote, all three fields present, impact badge labels (covers UI-04)

Both test files can be pure unit tests with no DOM — they test pure functions extracted from component logic. The planner should extract `pctDelta()` and `buildTooltipContent()` as standalone exported utilities in `src/lib/tuning/` so they're testable without a React environment.

---

## Security Domain

Step skipped — `security_enforcement` is not present in `.planning/config.json` and this phase involves no authentication, no user data, no network calls, no file I/O, and no input validation surfaces beyond pure TypeScript UI logic. No ASVS categories apply to a read-only metric display component.

---

## Sources

### Primary (HIGH confidence)

- `creator/src/lib/tuning/types.ts` — MetricSnapshot, TuningSection, FieldMeta, DiffEntry interfaces verified
- `creator/src/lib/tuning/formulas.ts` — computeMetrics(), all formula functions verified
- `creator/src/lib/tuning/diffEngine.ts` — computeDiff(), groupDiffBySection() verified
- `creator/src/lib/tuning/fieldMetadata.ts` — FIELD_METADATA structure verified (137 entries, description/interactionNote/impact fields present)
- `creator/src/lib/tuning/presets.ts` — TuningPreset interface, all 3 presets verified
- `creator/src/components/tuning/TuningWizard.tsx` — deepMerge(), presetMetrics memoization, diffMap computation verified
- `creator/src/components/tuning/ParameterRow.tsx` — diffColor(), current grid layout verified
- `creator/src/components/tuning/ParameterSection.tsx` — collapse/expand behavior, badge rendering verified
- `creator/src/stores/tuningWizardStore.ts` — collapsedSections: Set<TuningSection>, toggleCollapsed action verified
- `creator/src/components/lore/LoreEditor.tsx` — vanilla tippy.js usage pattern verified
- `creator/src/index.css` — color tokens verified (status-success, status-error, text-muted)
- `bun run test` — 685 tests passing; existing tuning test coverage verified

### Secondary (MEDIUM confidence)

- `ARCANUM_STYLE_GUIDE.md` — Design system principles applied to card layout and color use
- `.planning/phases/04-comparison-view/04-CONTEXT.md` — All locked decisions (D-01 through D-12) verified

### Tertiary (LOW confidence — flagged in Assumptions Log)

- Tippy.js v6 custom theme CSS API (`[data-theme~='arcanum']` selector) — based on training knowledge of Tippy 6 theming, not verified against current docs. Low risk: easy to diagnose and fix on first render.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries verified in package.json and node_modules
- Architecture: HIGH — all Phase 1-3 source read and understood; integration points precisely identified
- Pitfalls: HIGH for code-level pitfalls; MEDIUM for Tippy theming (external API)
- Test coverage: HIGH — existing infrastructure confirmed working; two new test files identified

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable stack, no time-sensitive external dependencies)
