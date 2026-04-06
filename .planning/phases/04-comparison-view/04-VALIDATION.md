---
phase: 4
slug: comparison-view
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3 |
| **Config file** | `creator/vitest.config.ts` |
| **Quick run command** | `bun run test` |
| **Full suite command** | `bun run test` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun run test`
- **After every plan wave:** Run `bun run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | COMP-05 | — | N/A | unit | `bun run test src/lib/tuning/__tests__/metricDelta.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | UI-04 | — | N/A | unit | `bun run test src/lib/tuning/__tests__/tooltipContent.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | COMP-01 | — | N/A | unit | `bun run test src/lib/tuning/__tests__/formulas.test.ts` | ✅ | ⬜ pending |
| 04-02-02 | 02 | 1 | COMP-02 | — | N/A | unit | `bun run test src/lib/tuning/__tests__/diffEngine.test.ts` | ✅ | ⬜ pending |
| 04-02-03 | 02 | 1 | COMP-03 | — | N/A | unit | `bun run test src/lib/tuning/__tests__/formulas.test.ts` | ✅ | ⬜ pending |
| 04-02-04 | 02 | 1 | COMP-04 | — | N/A | unit | `bun run test src/lib/tuning/__tests__/diffEngine.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `creator/src/lib/tuning/__tests__/metricDelta.test.ts` — Tests `pctDelta()` helper: zero-denominator guard, positive delta, negative delta, identical values (covers COMP-05)
- [ ] `creator/src/lib/tuning/__tests__/tooltipContent.test.ts` — Tests tooltip string builder: description-only, description + interactionNote, all three fields, impact badge labels (covers UI-04)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Color coding visually correct (green increase, red decrease, muted unchanged) | COMP-04 | Visual rendering requires browser | Inspect ParameterRow with preset selected; verify Tailwind classes applied correctly |
| Tooltip positioning and readability | UI-04 | Tippy.js rendering requires browser | Hover field labels; verify popover appears with description, interaction note, impact badge |
| Metric cards layout in 2x2 grid | COMP-01 | Visual layout verification | Select preset; verify 4 section cards appear in grid between preset row and parameter browser |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
