---
phase: 9
slug: scene-composition
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `creator/vitest.config.ts` |
| **Quick run command** | `cd creator && bun run test` |
| **Full suite command** | `cd creator && bun run test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd creator && bun run test`
- **After every plan wave:** Run `cd creator && bun run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | SCENE-01 | — | N/A | unit | `cd creator && bun run test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SCENE-02 | — | N/A | unit | `cd creator && bun run test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SCENE-03 | — | N/A | unit | `cd creator && bun run test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SCENE-04 | — | N/A | unit | `cd creator && bun run test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SCENE-05 | — | N/A | unit | `cd creator && bun run test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `creator/src/lib/__tests__/sceneLayout.test.ts` — stubs for preset slot logic
- [ ] Existing test infrastructure covers framework needs (vitest already configured)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Entity picker sidebar with zone data tabs | SCENE-01 | Requires running app with loaded zone | Open story, expand entity picker, verify rooms/mobs/items tabs populate |
| Room background auto-populates in preview | SCENE-03 | IPC image loading, visual rendering | Select a room with art, verify 16:9 preview shows room image |
| Entity drag-to-position in preview | SCENE-05 | Pointer interaction in rendered preview | Drag an entity sprite, verify position updates and persists |
| Live preview with all layers | SCENE-04 | Visual composition verification | Add room + entities + narration, verify layered preview |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
