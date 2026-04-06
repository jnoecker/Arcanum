---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-04
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `creator/vite.config.ts` (vitest config section) |
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
| 01-01-01 | 01 | 1 | FOUND-01 | unit | `cd creator && bun run test` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | FOUND-02 | unit | `cd creator && bun run test` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 1 | FOUND-03 | unit | `cd creator && bun run test` | ❌ W0 | ⬜ pending |
| 01-04-01 | 04 | 1 | FOUND-04 | unit | `cd creator && bun run test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `creator/src/lib/__tests__/tuningTypes.test.ts` — stubs for FOUND-01 (DeepPartial, TunableSection)
- [ ] `creator/src/lib/__tests__/formulaEvaluator.test.ts` — stubs for FOUND-02 (formula evaluations)
- [ ] `creator/src/lib/__tests__/diffEngine.test.ts` — stubs for FOUND-03 (config diff computation)
- [ ] `creator/src/lib/__tests__/fieldRegistry.test.ts` — stubs for FOUND-04 (field metadata registry)

*Existing vitest infrastructure covers framework setup — only test files need creation.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
