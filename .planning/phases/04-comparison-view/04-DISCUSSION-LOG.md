# Phase 4: Comparison View - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the Q&A flow.

**Date:** 2026-04-05
**Phase:** 04-comparison-view
**Mode:** discuss (interactive)
**Areas discussed:** Derived Metrics Presentation, Comparison Layout Flow, Context-Aware Color Coding, Tooltip Design

## Prior Context Applied

- 4 TuningSection groups from Phase 1 D-01
- Formulas evaluate at levels 1, 5, 10, 20, 30, 50 from Phase 1 D-03/D-04
- Comparisons against user's current config from Phase 2 D-04
- Parameter browser with basic diff highlighting from Phase 3 D-11–D-14

## Discussion Flow

### Derived Metrics Presentation

| Question | Options Presented | Selected |
|----------|------------------|----------|
| How should derived metrics be displayed? | Summary cards with key levels; Full comparison tables; Narrative delta summary | Summary cards with key levels |
| Which representative levels to highlight? | Lv10/30/50; Lv5/20/50; Single level with selector | Lv10, Lv30, Lv50 |
| Which mob tier for combat examples? | Normal only; All 4 tiers; Normal + Boss | Normal tier only |
| How many headline metrics per card? | 2-3 per card; All computed; 1 signature metric | 2-3 metrics per card |

### Comparison Layout Flow

| Question | Options Presented | Selected |
|----------|------------------|----------|
| Where should metric cards appear? | Between presets and browser; Replace browser; Side-by-side | Between preset cards and parameter browser |
| When should metric cards appear? | Only after preset; Always with current; Always, grayed until preset | Only after preset selection |
| Raw field section default state? | Collapsed; Expanded; Collapsed except changed | Collapsed by default |

### Context-Aware Color Coding

| Question | Options Presented | Selected |
|----------|------------------|----------|
| How should color convey better/worse? | Direction-only no judgment; Context-aware per-field hints; Preset-philosophy-aware | Direction-only, no judgment |
| Should percentage delta be shown? | Arrow + percentage; Arrow only; Arrow + absolute delta | Arrow + percentage |

### Tooltip Design

| Question | Options Presented | Selected |
|----------|------------------|----------|
| How should tooltips be triggered? | Hover popover on label; Info icon click; Inline expansion | Hover popover on field label |
| What info in each tooltip? | Description + interaction + impact; Description only; Description + interaction + range | Description + interaction note + impact badge |
| Tooltips on derived metric rows? | Yes, explain formula; No, self-explanatory; You decide | Yes, explain the formula |

## Corrections Made

No corrections — all recommended options confirmed.

---

*Discussion completed: 2026-04-05*
