---
phase: 3
slug: wizard-workspace
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-04
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x |
| **Config file** | `creator/vitest.config.ts` |
| **Quick run command** | `cd creator && bun run test` |
| **Full suite command** | `cd creator && bun run test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd creator && bun run test`
- **After every plan wave:** Run `cd creator && bun run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | UI-01 | unit | `cd creator && bunx vitest run src/lib/__tests__/panelRegistry.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | UI-05 | unit | `cd creator && bunx vitest run src/lib/tuning/__tests__/searchFilter.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | UI-02 | manual-only | Visual inspection | N/A | ⬜ pending |
| 03-02-02 | 02 | 1 | UI-03 | manual-only | Visual inspection | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `creator/src/lib/__tests__/panelRegistry.test.ts` — verify tuningWizard registered in PANEL_MAP with host="command", group="world"
- [ ] `creator/src/lib/tuning/__tests__/searchFilter.test.ts` — verify search across label, description, path; verify section filtering

*Existing test infrastructure (Vitest) is already configured. Only test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Arcanum design system compliance | UI-02 | Visual styling (colors, fonts, spacing) requires visual inspection | Open Tuning Wizard tab, verify dark indigo bg, aurum-gold accents, Cinzel headings, Crimson Pro body |
| Preset cards render with themed styling | UI-03 | Card layout, accent colors, glow effects are visual | Select each preset card, verify name/description/metrics display, verify selection glow |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
