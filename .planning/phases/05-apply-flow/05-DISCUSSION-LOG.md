# Phase 5: Apply Flow - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 05-apply-flow
**Areas discussed:** Section acceptance UX, Apply/Undo/Reset controls, Health check presentation, State flow and edge cases

---

## Section Acceptance UX

| Option | Description | Selected |
|--------|-------------|----------|
| Checkbox on section headers | Each ParameterSection header gets a checkbox. All checked by default. | ✓ |
| Summary checklist panel | Separate panel listing all 4 sections with toggles. | |
| Per-field checkboxes | Individual checkboxes on each ParameterRow. | |

**User's choice:** Checkbox on section headers
**Notes:** Follows existing collapsible header pattern

| Option | Description | Selected |
|--------|-------------|----------|
| All checked by default | Preset selection checks all 4 sections. | ✓ |
| All unchecked by default | Builders must explicitly opt-in. | |
| Only changed sections checked | Auto-check only sections with diffs. | |

**User's choice:** All checked by default

| Option | Description | Selected |
|--------|-------------|----------|
| Dim unchecked sections | Reduce opacity on unchecked section content. | ✓ |
| Collapse unchecked sections | Auto-collapse when unchecked. | |
| No visual change | Checkbox state only. | |

**User's choice:** Dim unchecked sections

---

## Apply/Undo/Reset Controls

| Option | Description | Selected |
|--------|-------------|----------|
| Sticky footer bar | Fixed bar at bottom, always visible. | ✓ |
| Inline below metric cards | Between metrics and parameter browser. | |
| Toolbar/header area | In wizard header alongside title. | |

**User's choice:** Sticky footer bar

| Option | Description | Selected |
|--------|-------------|----------|
| Single-level snapshot | One undo point: config before last apply. | ✓ |
| Multi-level undo stack | Full undo history with redo. | |
| No undo — confirmation dialog | Confirm before applying, no undo after. | |

**User's choice:** Single-level snapshot

| Option | Description | Selected |
|--------|-------------|----------|
| "Apply N sections" with count | Dynamic label showing checked section count. | ✓ |
| "Apply Preset" with confirmation | Static label with confirmation dialog. | |
| "Apply" simple button | Plain button, minimal UI. | |

**User's choice:** "Apply N sections" with count

| Option | Description | Selected |
|--------|-------------|----------|
| Clear all wizard state | Deselect preset, clear checkboxes, filters, return to initial view. | ✓ |
| Reset only section selections | Keep preset, re-check all checkboxes. | |
| Reset config to pre-wizard state | Revert application.yaml to before wizard opened. | |

**User's choice:** Clear all wizard state

---

## Health Check Presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Inline warning banner | Warning banner at top of wizard, non-blocking. | ✓ |
| Modal dialog on apply | Blocking modal listing all issues. | |
| Toast notifications | Brief toast messages, disappear after seconds. | |

**User's choice:** Inline warning banner

| Option | Description | Selected |
|--------|-------------|----------|
| Tuning-specific metric checks | Use computeMetrics() to detect imbalanced combinations. | ✓ |
| Full validateConfig() suite | Run comprehensive structural validation. | |
| Both tuning metrics + full validation | Run both sets of checks. | |

**User's choice:** Tuning-specific metric checks only

---

## State Flow and Edge Cases

| Option | Description | Selected |
|--------|-------------|----------|
| Reset checkboxes to all-checked | New preset = fresh start, all checked. | ✓ |
| Preserve checkbox state | Keep unchecked sections across preset switches. | |
| Ask before switching | Confirmation dialog before preset swap. | |

**User's choice:** Reset checkboxes to all-checked

| Option | Description | Selected |
|--------|-------------|----------|
| Stay in wizard, show success + updated comparison | Brief success indicator, comparison refreshes. | ✓ |
| Auto-navigate to config panels | Wizard closes, switch to config view. | |
| Summary dialog | Modal summarizing what changed. | |

**User's choice:** Stay in wizard, show success + updated comparison

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, single undo covers last apply only | Sequential applies allowed, undo reverts last one. | ✓ |
| Yes, but warn about overwrite | Warning before stacking applies. | |
| No, must undo or reset first | Block apply until undo/reset. | |

**User's choice:** Yes, single undo covers last apply only

---

## Claude's Discretion

- Success indicator animation/style details
- Exact health check metric thresholds and warning messages
- Footer bar internal layout and spacing
- Checkbox component styling within section header

## Deferred Ideas

None — discussion stayed within phase scope
