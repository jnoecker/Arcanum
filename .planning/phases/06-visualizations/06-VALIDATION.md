---
phase: 6
slug: visualizations
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 6 — Validation Strategy

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
| 06-01-01 | 01 | 1 | VIZ-01 | unit | `bun run test src/lib/tuning/__tests__/chartData.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | VIZ-02, VIZ-03 | unit | `bun run test src/lib/tuning/__tests__/chartData.test.ts` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | VIZ-01, VIZ-02, VIZ-03 | typecheck | `bunx tsc --noEmit && bun run test` | ✅ | ⬜ pending |
| 06-02-02 | 02 | 2 | VIZ-01, VIZ-02, VIZ-03 | visual | `bunx tsc --noEmit && bun run test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `creator/src/lib/tuning/__tests__/chartData.test.ts` — stubs for VIZ-01, VIZ-02, VIZ-03 (data transformation functions)

*Existing vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| XP curve line chart renders | VIZ-01 | Recharts SVG rendering requires browser | Select preset, verify dual-line XP chart appears |
| Mob tier bar chart with level selector | VIZ-02 | Recharts + dropdown interaction | Select preset, change level dropdown, verify bars update |
| Stat radar chart renders | VIZ-03 | Recharts radar rendering | Select preset, verify radar polygon comparison |
| Chart animations on preset switch | D-06 | 300ms transition requires visual check | Switch presets, verify smooth line morphing |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
