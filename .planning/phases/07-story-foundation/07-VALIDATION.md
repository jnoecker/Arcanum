---
phase: 7
slug: story-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `creator/vitest.config.ts` |
| **Quick run command** | `cd creator && bun run test` |
| **Full suite command** | `cd creator && bun run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd creator && bun run test`
- **After every plan wave:** Run `cd creator && bun run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | STORY-01 | — | N/A | unit | `cd creator && bun run test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | STORY-05 | — | N/A | unit | `cd creator && bun run test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | STORY-06 | — | N/A | unit | `cd creator && bun run test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `creator/src/stores/__tests__/storyStore.test.ts` — stubs for STORY-01, STORY-05, STORY-06
- [ ] `creator/src/lib/__tests__/storyPersistence.test.ts` — persistence round-trip tests

*Existing vitest infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Story visible in lore browser | STORY-01 | UI rendering requires running app | Open app, create story, verify it appears in article tree |
| Cover image displays | STORY-06 | Visual verification | Create story with cover image, verify image renders |
| Undo/redo isolation | STORY-05 | Cross-store interaction | Edit story, undo, verify lore undo stack unchanged |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
