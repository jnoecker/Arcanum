---
phase: 8
slug: story-editor
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 8 — Validation Strategy

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
| TBD | TBD | TBD | STORY-02 | — | N/A | unit | `cd creator && bun run test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | STORY-03 | — | N/A | unit | `cd creator && bun run test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | STORY-04 | — | N/A | unit | `cd creator && bun run test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | STORY-07 | — | N/A | unit | `cd creator && bun run test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `creator/src/stores/__tests__/storyStore.test.ts` — extend with scene CRUD + reorder tests
- [ ] Existing test infrastructure covers framework needs (vitest already configured)

*Existing infrastructure covers framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-and-drop scene reordering | STORY-02 | dnd-kit requires browser interaction | Drag a scene card left/right, verify order updates |
| Right-click context menu | STORY-02 | Requires browser context menu event | Right-click scene card, verify menu appears |
| LoreEditor narration editing | STORY-03 | TipTap requires DOM rendering | Type in narration editor, verify content saves |
| DM notes collapsible section | STORY-04 | Visual/interaction verification | Toggle DM notes section, verify collapse behavior |
| Template application with confirmation | STORY-07 | Dialog interaction required | Apply template to scene with content, verify confirmation dialog |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
