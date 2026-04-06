---
phase: 10
slug: cinematic-renderer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | creator/vitest.config.ts |
| **Quick run command** | `cd creator && bun run test` |
| **Full suite command** | `cd creator && bun run test` |
| **Estimated runtime** | ~10 seconds |

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
| 10-01-01 | 01 | 1 | SCENE-06 | — | N/A | unit | `cd creator && bun run test` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | SCENE-07 | — | N/A | unit | `cd creator && bun run test` | ❌ W0 | ⬜ pending |
| 10-01-03 | 01 | 1 | PRES-03 | — | N/A | unit | `cd creator && bun run test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `creator/src/lib/__tests__/movementPresets.test.ts` — stubs for SCENE-06 movement path presets
- [ ] `creator/src/lib/__tests__/typewriterTiming.test.ts` — stubs for SCENE-07 narration timing
- [ ] `creator/src/lib/__tests__/transitionConfig.test.ts` — stubs for PRES-03 transition configuration

*Existing vitest infrastructure covers framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Entity movement path animation plays correctly | SCENE-06 | Visual animation verification | Open story editor, add entity with entrance path, click Preview, confirm entity animates along path |
| Word-by-word narration reveal timing | SCENE-07 | Visual timing verification | Open story editor, add narration text, click Preview, confirm words appear sequentially |
| Crossfade transition between scenes | PRES-03 | Visual transition verification | Open story with 2+ scenes, click Preview or enter presentation mode, advance scenes, confirm crossfade |
| Renderer portability (no Tauri deps) | SC-4 | Import analysis | Verify CinematicRenderer imports contain no @tauri-apps references |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
