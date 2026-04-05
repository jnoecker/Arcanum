---
phase: 5
slug: apply-flow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `creator/vitest.config.ts` |
| **Quick run command** | `bun run test` |
| **Full suite command** | `bun run test && bunx tsc --noEmit` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun run test`
- **After every plan wave:** Run `bun run test && bunx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | APPLY-01 | unit | `bun run test src/lib/tuning/__tests__/applyPreset.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | APPLY-02 | unit | `bun run test src/lib/tuning/__tests__/applyPreset.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | APPLY-03, APPLY-04 | typecheck | `bunx tsc --noEmit && bun run test` | ✅ | ⬜ pending |
| 05-02-02 | 02 | 2 | UI-06 | typecheck | `bunx tsc --noEmit && bun run test` | ✅ | ⬜ pending |
| 05-03-01 | 03 | 2 | APPLY-05 | unit | `bun run test src/lib/tuning/__tests__/healthCheck.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-02 | 03 | 2 | APPLY-05 | visual | `bunx tsc --noEmit && bun run test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `creator/src/lib/tuning/__tests__/applyPreset.test.ts` — stubs for APPLY-01, APPLY-02 (section filtering, snapshot/undo)
- [ ] `creator/src/lib/tuning/__tests__/healthCheck.test.ts` — stubs for APPLY-05 (metric imbalance detection)

*Existing vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sticky footer bar visibility | UI-06 | CSS sticky positioning requires visual verification | Scroll parameter browser, verify footer remains fixed |
| Section dimming on uncheck | APPLY-01 | Opacity change requires visual verification | Uncheck a section checkbox, verify 40-50% dim effect |
| Success flash after apply | APPLY-03 | Animation requires visual verification | Click Apply, verify brief green flash indicator |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
