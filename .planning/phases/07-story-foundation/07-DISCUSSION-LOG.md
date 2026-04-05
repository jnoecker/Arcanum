# Phase 7: Story Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 07-Story Foundation
**Areas discussed:** Story-Lore Bridge, Lore Browser UX, Data Model Shape, Persistence Format

---

## Story-Lore Bridge

### How should stories bridge into the lore system?

| Option | Description | Selected |
|--------|-------------|----------|
| Thin article stub | Real Article with template="story" in loreStore holds only metadata; scene data in storyStore/JSON | ✓ |
| Virtual lore entry | Stories exist only in storyStore; adapter injects them into browser as virtual entries | |
| Full article storage | All data including scenes in lore.yaml as regular articles | |

**User's choice:** Thin article stub
**Notes:** Preserves article features (tags, relations, tree positioning) while keeping heavy scene data separate per STATE.md decision.

### When a story article is selected, what should happen?

| Option | Description | Selected |
|--------|-------------|----------|
| Open story editor panel | Dedicated StoryEditorPanel via panel registry, LorePanelHost routes template="story" | ✓ |
| Open article editor with story tab | Existing ArticleEditor gets a new "Scenes" tab for stories | |
| You decide | Claude picks routing approach | |

**User's choice:** Open story editor panel
**Notes:** Clean separation — story editor is its own panel, not crammed into the article editor.

---

## Lore Browser UX

### How should stories appear in the article tree?

| Option | Description | Selected |
|--------|-------------|----------|
| Mixed with articles | Same tree, distinctive icon, filterable by template | ✓ |
| Separate stories section | Own collapsible section in the tree | |
| Dedicated stories tab | New sidebar tab just for stories | |

**User's choice:** Mixed with articles
**Notes:** Unified tree keeps stories contextual alongside the locations/characters they reference.

### How should the builder create a new story?

| Option | Description | Selected |
|--------|-------------|----------|
| Zone-first flow | "New Story" prompts for zone selection first, then creates stub + empty JSON | ✓ |
| Create-then-link | Create without zone, link later | |
| You decide | Claude picks creation flow | |

**User's choice:** Zone-first flow
**Notes:** Zone link established at creation time, matching STORY-01 requirement.

---

## Data Model Shape

### How much scene structure should the Phase 7 data model define?

| Option | Description | Selected |
|--------|-------------|----------|
| Full scene type now | Complete Scene interface with optional fields for Phase 8-10 | ✓ |
| Minimal now, evolve later | Only Story basics, Scene as unknown[] | |
| You decide | Claude designs type hierarchy | |

**User's choice:** Full scene type now
**Notes:** Prevents data migration across phases. Optional fields filled in by later phases.

### Should storyStore undo/redo follow loreStore pattern?

| Option | Description | Selected |
|--------|-------------|----------|
| Same pattern as loreStore | Manual structuredClone snapshots, 50-entry history, snapshotStory() helper | ✓ |
| Zundo middleware | Automatic history via zundo like zoneStore | |
| You decide | Claude picks approach | |

**User's choice:** Same pattern as loreStore
**Notes:** Consistent with lore undo pattern. Scene data per-story is small enough that cloning is cheap.

---

## Persistence Format

### Where should story JSON files live?

| Option | Description | Selected |
|--------|-------------|----------|
| stories/ subdirectory | `{mudDir}/stories/{storyId}.json` alongside lore.yaml | ✓ |
| Inside .arcanum/ | `{project}/.arcanum/stories/` as app metadata | |
| Single stories.json | One file with all stories | |

**User's choice:** stories/ subdirectory
**Notes:** Clean separation, git-friendly, easy to browse in file explorer.

### When should story files auto-save?

| Option | Description | Selected |
|--------|-------------|----------|
| On dirty flag, like lore | Dirty flag + save on tab close, project close, Ctrl+S, auto-save timer | ✓ |
| Immediate save on every mutation | Write to disk on every change | |
| You decide | Claude picks save strategy | |

**User's choice:** On dirty flag, like lore
**Notes:** Consistent with lorePersistence.ts pattern.

---

## Claude's Discretion

- Story ID generation scheme
- Exact icon for story articles
- StoryEditorPanel layout for Phase 7
- Error handling for missing/corrupt story JSON
- Eager vs lazy story loading on project open

## Deferred Ideas

None — discussion stayed within phase scope.
