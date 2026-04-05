# Phase 7: Story Foundation - Research

**Researched:** 2026-04-05
**Domain:** Zustand store design, JSON persistence, lore system integration, panel routing
**Confidence:** HIGH

## Summary

Phase 7 introduces stories as a new lore type: a thin `Article` stub with `template="story"` in the existing lore system, backed by a separate `storyStore` with independent undo/redo and per-story JSON file persistence. This is a data-layer and integration phase -- no animation, no scene composition, no cinematic effects.

The technical risk is LOW. Every pattern needed already exists in the codebase: the `loreStore` manual undo/redo pattern (structuredClone + 50-entry history stack), the `lorePersistence.ts` load/save via `@tauri-apps/plugin-fs`, the panel registry routing, and the ArticleTree rendering. The work is primarily connecting these established patterns in a new context (storyStore + storyPersistence + StoryEditorPanel) and extending the existing lore type system with a `"story"` template variant.

**Primary recommendation:** Follow the existing patterns exactly -- mirror `loreStore` undo/redo for `storyStore`, mirror `lorePersistence.ts` for `storyPersistence.ts`, and register a new `storyEditor` panel in the same panel registry. The data model types should be defined upfront with optional fields for Phase 8+ features, preventing data migrations later.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Stories use a thin article stub pattern -- a real `Article` with `template="story"` lives in `loreStore`/`lore.yaml`, holding only title, zone link, cover image, tags, and a `storyId` pointer. Actual scene data lives in `storyStore` backed by separate JSON files.
- **D-02:** Add `"story"` to the `ArticleTemplate` union type in `types/lore.ts`.
- **D-03:** When a story article is selected in the lore browser, `LorePanelHost` routes to a dedicated `StoryEditorPanel` (registered in panel registry as `host="lore"`, group `"lore"`). The existing `ArticleEditor` is not used for stories.
- **D-04:** Stories appear mixed with other articles in the article tree, with a distinctive icon (film/clapperboard). Filterable by the "story" template like any other type.
- **D-05:** "New Story" uses a zone-first creation flow: button in article tree toolbar opens a modal with title, zone dropdown (loaded zones), and optional cover image. Creates both the stub article in `loreStore` and the empty story JSON in `storyStore`, then opens `StoryEditorPanel`.
- **D-06:** Define the full `Story` and `Scene` type hierarchy upfront in Phase 7. Scene fields for Phase 8+ (narration, dmNotes, template, entities, transition, effects) are defined as optional properties now, preventing data migration later.
- **D-07:** `Story` interface: `id`, `title`, `zoneId`, `coverImage?`, `scenes: Scene[]`, `createdAt`, `updatedAt`.
- **D-08:** `Scene` interface: `id`, `title`, `sortOrder`, `roomId?`, `narration?` (TipTap JSON string), `dmNotes?`, `template?: SceneTemplate`, `entities?: SceneEntity[]`, `transition?: TransitionConfig`, `effects?: EffectConfig`.
- **D-09:** `SceneTemplate` type: `"establishing_shot" | "encounter" | "discovery"`.
- **D-10:** `SceneEntity`, `TransitionConfig`, and `EffectConfig` are defined as placeholder interfaces in Phase 7, filled out when Phase 9-10 need them.
- **D-11:** `storyStore` uses the same manual undo pattern as `loreStore` -- `structuredClone` snapshots with a 50-entry history stack and `snapshotStory()` helper. Does not use zundo middleware.
- **D-12:** Story undo/redo is fully independent from lore undo/redo -- undoing a scene change never affects article content and vice versa.
- **D-13:** One JSON file per story in a `stories/` subdirectory alongside `lore.yaml`. Path: `{mudDir}/stories/{storyId}.json` (standalone) or `{mudDir}/src/main/resources/stories/{storyId}.json` (multi-module).
- **D-14:** `storyPersistence.ts` handles load/save with `readTextFile`/`writeTextFile` from `@tauri-apps/plugin-fs`. JSON.stringify with 2-space indent for readability.
- **D-15:** Save triggers on dirty flag -- same pattern as `lorePersistence.ts` (tab close, project close, Ctrl+S, periodic auto-save timer).

### Claude's Discretion
- Story ID generation scheme (UUID, slug-based, or prefixed)
- Exact icon choice for story articles in the tree
- StoryEditorPanel layout for Phase 7 (minimal -- just metadata editing + empty scene list placeholder)
- Error handling for missing/corrupt story JSON files
- Whether to load all stories eagerly on project open or lazily on selection

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STORY-01 | Builder can create a new story as a lore article type linked to a single zone | Story type system (D-02, D-06-D-10), article stub creation (D-01, D-05), panel routing (D-03), ArticleTree integration (D-04) |
| STORY-05 | Stories persist with full undo/redo support | storyStore with manual undo (D-11, D-12), storyPersistence.ts with JSON files (D-13, D-14, D-15) |
| STORY-06 | Builder can set a cover image for the story | `coverImage` field on Story (D-07), story article stub `image` field, existing asset pipeline integration |
</phase_requirements>

## Standard Stack

### Core (No new dependencies)

This phase requires **zero new npm packages**. Everything is built on the existing stack.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | ^5.0.0 | storyStore state management | Already installed, all stores use it | [VERIFIED: creator/package.json]
| @tauri-apps/plugin-fs | ^2 | Story JSON file I/O | Already installed, lorePersistence uses same APIs | [VERIFIED: creator/package.json]
| react | ^19.0.0 | StoryEditorPanel UI | Already installed | [VERIFIED: creator/package.json]
| vitest | ^3.0.0 | Unit tests for storyStore and persistence | Already installed with config | [VERIFIED: creator/vitest.config.ts]

### Supporting (Existing, reused)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-arborist | ^3.4.3 | ArticleTree already renders articles | Story articles appear via existing tree -- add icon differentiation | [VERIFIED: creator/package.json]
| yaml | ^2.7.0 | lore.yaml serialization | Only for lore article stub persistence (not story JSON) | [VERIFIED: creator/package.json]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual undo (structuredClone) | zundo middleware | Locked decision D-11: manual pattern matches loreStore. zundo is used by zoneStore but CONTEXT.md explicitly chose manual undo for storyStore to match loreStore pattern. |
| Per-story JSON files | Inline in lore.yaml | Locked decision D-13: separate files avoid bloating lore.yaml with dense scene data, enable independent git diffs. |
| Eager story loading | Lazy on selection | Discretion area -- research recommends lazy loading (see Architecture Patterns). |

**Installation:** No new packages needed.

## Architecture Patterns

### Recommended Project Structure

```
creator/src/
  types/
    lore.ts              # Add "story" to ArticleTemplate, add storyId to article fields
    story.ts             # NEW: Story, Scene, SceneTemplate, SceneEntity, TransitionConfig, EffectConfig
  stores/
    storyStore.ts        # NEW: Zustand store with manual undo/redo, story CRUD
  lib/
    storyPersistence.ts  # NEW: Load/save story JSON files
  components/
    lore/
      StoryEditorPanel.tsx    # NEW: Minimal story metadata editor
      NewStoryDialog.tsx      # NEW: Zone-first creation modal
      ArticleTree.tsx         # MODIFY: Add story icon, story template color
      ArticleBrowser.tsx      # MODIFY: Route story selection to StoryEditorPanel (or LorePanelHost handles it)
    Sidebar.tsx               # No changes needed (ArticleTree handles icons internally)
  lib/
    panelRegistry.ts     # MODIFY: Register storyEditor panel
    lorePersistence.ts   # MODIFY: Load stories on project open
    loreTemplates.ts     # MODIFY: Add story template schema
```

### Pattern 1: Article Stub with Separate Store (D-01)

**What:** A lightweight Article object lives in `loreStore` and `lore.yaml` for sidebar visibility, search, tags, and the lore ecosystem. The actual story data (scenes, transitions, effects) lives in a separate `storyStore` backed by per-story JSON files.

**When to use:** When a lore entity has dense, independently-mutable data that would bloat the lore YAML and needs independent undo/redo.

**Implementation:**

```typescript
// In types/lore.ts -- extend ArticleTemplate
export type ArticleTemplate =
  | "world_setting"
  | "character"
  | "location"
  // ... existing ...
  | "freeform"
  | "story";    // NEW

// Article stub for story -- uses existing Article interface
// Fields used: template="story", title, image (cover), tags
// Additional field in Article.fields: { storyId: string, zoneId: string }
```

[VERIFIED: types/lore.ts line 6-17 shows ArticleTemplate union, Article interface at line 31-47]

**Key insight:** The `Article.fields` record is `Record<string, unknown>`, so `storyId` and `zoneId` can be stored there without modifying the Article interface. This is the same pattern used by all templates (e.g., character stores `fullName`, `race`, `class` in `fields`).

### Pattern 2: Manual Undo/Redo Store (D-11)

**What:** Clone entire state before each mutation, maintain past/future stacks, cap at 50 entries.

**When to use:** For storyStore -- mirrors loreStore exactly.

**Example (from loreStore, to be replicated):**

```typescript
// Source: creator/src/stores/loreStore.ts lines 29-34
const MAX_STORY_HISTORY = 50;

function snapshotStory(state: StoryState): Pick<StoryState, "storyPast" | "storyFuture"> {
  if (!state.stories) return { storyPast: state.storyPast, storyFuture: state.storyFuture };
  const past = [...state.storyPast, structuredClone(state.stories)];
  if (past.length > MAX_STORY_HISTORY) past.shift();
  return { storyPast: past, storyFuture: [] };
}
```

[VERIFIED: loreStore.ts lines 29-34 shows exact snapshotLore implementation]

**Critical detail:** `structuredClone` handles deep copies of nested scene data. The snapshot captures `stories` (a `Map<string, Story>` or `Record<string, Story>`), and each mutation spreads `...snapshotStory(s)` before applying changes. The `dirty` flag per story tracks which files need saving.

### Pattern 3: JSON File Persistence (D-13, D-14)

**What:** One JSON file per story, stored alongside `lore.yaml`.

**When to use:** For all story save/load operations.

**Example (mirroring lorePersistence.ts):**

```typescript
// Source: Adapted from creator/src/lib/lorePersistence.ts lines 1-20
import { exists, readTextFile, writeTextFile, mkdir, readDir } from "@tauri-apps/plugin-fs";
import type { Project } from "@/types/project";
import type { Story } from "@/types/story";

export function storiesDir(project: Project): string {
  return project.format === "standalone"
    ? `${project.mudDir}/stories`
    : `${project.mudDir}/src/main/resources/stories`;
}

export function storyPath(project: Project, storyId: string): string {
  return `${storiesDir(project)}/${storyId}.json`;
}

export async function loadStory(project: Project, storyId: string): Promise<Story | null> {
  const path = storyPath(project, storyId);
  try {
    if (!(await exists(path))) return null;
    const content = await readTextFile(path);
    return JSON.parse(content) as Story;
  } catch {
    console.error(`Failed to load story ${storyId}`);
    return null;
  }
}

export async function saveStory(project: Project, story: Story): Promise<void> {
  const dir = storiesDir(project);
  // Ensure stories directory exists
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
  const path = storyPath(project, story.id);
  await writeTextFile(path, JSON.stringify(story, null, 2));
}

export async function loadAllStoryIds(project: Project): Promise<string[]> {
  const dir = storiesDir(project);
  try {
    if (!(await exists(dir))) return [];
    const entries = await readDir(dir);
    return entries
      .filter((e) => e.name?.endsWith(".json"))
      .map((e) => e.name!.replace(/\.json$/, ""));
  } catch {
    return [];
  }
}
```

[VERIFIED: lorePersistence.ts uses readTextFile/writeTextFile/exists from @tauri-apps/plugin-fs]

### Pattern 4: Panel Registry Integration (D-03)

**What:** Register storyEditor in the panel registry so LorePanelHost can route to it.

**When to use:** For the story editor panel definition.

**Example:**

```typescript
// In panelRegistry.ts LORE_PANELS array -- add new entry
{ id: "storyEditor", label: "Story Editor", group: "lore", host: "lore",
  kicker: "Narrative", title: "Story editor",
  description: "Compose cinematic zone stories with scenes and narration.",
  maxWidth: "max-w-7xl" },
```

[VERIFIED: panelRegistry.ts lines 86-97 shows LORE_PANELS structure, all host: "lore"]

**However**, the storyEditor panel is not navigated to directly from the sidebar. It is invoked when a story article is selected in the ArticleBrowser, via LorePanelHost routing. The panel registration is needed for the `PANEL_MAP` lookup (used by `LorePanelHost` line 95 for `def` metadata like `maxWidth`).

**LorePanelHost routing change:**

```typescript
// In LorePanelHost.tsx renderPanel function
// Source: creator/src/components/lore/LorePanelHost.tsx lines 22-47
function renderPanel(panelId: string): ReactNode {
  switch (panelId) {
    case "lore":
      return <ArticleBrowser />;
    // ... existing cases ...
    // No new case needed here -- the ArticleBrowser handles routing to StoryEditorPanel
  }
}
```

The routing happens inside `ArticleBrowser`. When `selectedArticleId` points to a story article, `ArticleBrowser` renders `StoryEditorPanel` instead of `ArticleEditor`.

[VERIFIED: ArticleBrowser.tsx lines 16-18 shows the selectedArticleId conditional rendering]

### Pattern 5: Lazy Loading Strategy (Claude's Discretion)

**Recommendation:** Load story IDs eagerly on project open (for validation -- ensure stub articles have matching JSON files), but load full story JSON lazily when a story article is selected.

**Rationale:**
- Story JSON can grow large with many scenes (TipTap JSON, entity arrays, movement paths)
- Most sessions won't open every story
- Eager ID scan is cheap (readDir + filter .json files)
- lorePersistence loads all lore eagerly (acceptable because lore.yaml is a single file), but stories are multiple files

**Implementation pattern:**

```typescript
// In storyStore
interface StoryState {
  stories: Record<string, Story>;      // Loaded stories (lazy, on-demand)
  storyIds: string[];                  // All known story IDs (loaded eagerly)
  dirty: Record<string, boolean>;      // Per-story dirty flags
  storyPast: Record<string, Story>[];  // Undo stack
  storyFuture: Record<string, Story>[]; // Redo stack
}
```

### Pattern 6: Story ID Generation (Claude's Discretion)

**Recommendation:** Use prefixed slug-based IDs: `story_{slugified_title}_{4_char_random}`.

**Rationale:**
- Matches existing article ID pattern (title-based slugs: `title.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")`)
- `story_` prefix distinguishes story files from other potential JSON in the directory
- 4-character random suffix prevents collisions without full UUID overhead
- Human-readable in file system: `stories/story_the_dark_awakening_a3f2.json`
- UUIDs are harder to identify in the filesystem and don't match the existing article ID convention

[VERIFIED: ArticleTree.tsx line 212 shows existing ID generation: `title.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")`]

### Anti-Patterns to Avoid

- **Storing scene data in lore.yaml:** Locked decision D-01/D-13 explicitly separates story data. Scene arrays with TipTap JSON would bloat lore.yaml and make git diffs unreadable.
- **Using zundo for storyStore:** Locked decision D-11. The manual snapshot pattern is chosen for consistency with loreStore. zundo uses a different approach (patches) that doesn't match.
- **Modifying the Article interface:** The `storyId` and `zoneId` fields go in `Article.fields` (the generic record), NOT as new top-level properties on the `Article` interface. This preserves backward compatibility.
- **Coupling story undo to lore undo:** D-12 is explicit -- separate stacks. A scene edit creating a snapshot in storyStore must NOT push to loreStore.lorePast.
- **Loading all story JSON on project open:** Scene data is dense. Lazy load individual stories when selected.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File I/O | Custom file system access | `@tauri-apps/plugin-fs` (readTextFile, writeTextFile, exists, mkdir, readDir) | Already used by lorePersistence, handles Tauri security scoping | [VERIFIED: lorePersistence.ts imports]
| State management | Context + useReducer | Zustand `create()` | Project standard, all stores use it | [VERIFIED: all stores in creator/src/stores/]
| Deep cloning for undo | Manual recursive clone | `structuredClone()` | Built-in browser API, used by loreStore.snapshotLore | [VERIFIED: loreStore.ts line 31]
| Tree rendering | Custom tree component | react-arborist `<Tree>` | Already rendering ArticleTree, story articles appear there automatically | [VERIFIED: ArticleTree.tsx]
| YAML serialization | Custom YAML writer | `yaml` package stringify | Only for lore.yaml (article stub), not for story JSON | [VERIFIED: lorePersistence.ts]

**Key insight:** This phase is almost entirely "assemble existing patterns in a new configuration." The only truly new code is the data model types and the StoryEditorPanel UI (which is minimal in Phase 7).

## Common Pitfalls

### Pitfall 1: ArticleTemplate Type Narrowing Breaks

**What goes wrong:** Adding `"story"` to `ArticleTemplate` may cause TypeScript exhaustiveness errors in switch statements and Record types that enumerate all templates.
**Why it happens:** `TEMPLATE_SCHEMAS` is typed as `Record<ArticleTemplate, TemplateSchema>` (line 24 of loreTemplates.ts) and `TEMPLATE_DOT_COLORS` in ArticleTree.tsx is `Record<ArticleTemplate, string>`. Adding a new variant to the union requires updating ALL such exhaustive records.
**How to avoid:** After adding `"story"` to the union, run `bunx tsc --noEmit` to find every location that needs updating. Update TEMPLATE_SCHEMAS, TEMPLATE_DOT_COLORS, and any switch statements.
**Warning signs:** TypeScript errors about missing property `"story"` in type.

[VERIFIED: loreTemplates.ts line 24 uses Record<ArticleTemplate, TemplateSchema>, ArticleTree.tsx line 10 uses Record<ArticleTemplate, string>]

### Pitfall 2: Undo Stack Memory with structuredClone

**What goes wrong:** If story data is large (many scenes with TipTap JSON), 50 snapshots of the entire stories record can consume significant memory.
**Why it happens:** `structuredClone` creates a full deep copy. With 10 stories of 20 scenes each, 50 history entries could be 50 * N MB.
**How to avoid:** Snapshot only the **currently edited story**, not the entire stories record. This is a design choice for storyStore -- unlike loreStore which snapshots all lore (single YAML file), storyStore should snapshot per-story.
**Warning signs:** Browser memory climbing during extended story editing sessions.

### Pitfall 3: Orphaned Story JSON Files

**What goes wrong:** Deleting a story article in loreStore without deleting the corresponding JSON file leaves orphan files on disk.
**Why it happens:** The article stub and story data live in different stores with different persistence mechanisms.
**How to avoid:** When deleting a story article from loreStore, also call a cleanup function in storyStore that removes the story from state AND deletes the JSON file from disk (using `@tauri-apps/plugin-fs` `remove`).
**Warning signs:** JSON files accumulating in the stories/ directory with no corresponding article stubs.

### Pitfall 4: Stale storyId Reference After Lore Undo

**What goes wrong:** User creates a story (creates stub article + JSON), then undoes in loreStore. The article stub is removed from lore, but the story JSON still exists in storyStore and on disk.
**Why it happens:** D-12 makes undo stacks independent. Lore undo doesn't notify storyStore.
**How to avoid:** This is acceptable behavior -- the JSON file becomes orphaned but harmless. On next project open, the story ID scan can detect orphans (story files with no matching article stub). Phase 7 should document this edge case but not necessarily fix it.
**Warning signs:** Story files on disk without corresponding article stubs.

### Pitfall 5: stories/ Directory Not Created

**What goes wrong:** `writeTextFile` fails because the `stories/` directory doesn't exist yet.
**Why it happens:** First story creation on a project that's never had stories.
**How to avoid:** Always `mkdir(storiesDir, { recursive: true })` before first write. Check `exists()` first to avoid unnecessary operations.
**Warning signs:** "File not found" or "Directory not found" errors on first story save.

### Pitfall 6: ArticleBrowser Doesn't Route Stories

**What goes wrong:** Clicking a story article in the tree opens `ArticleEditor` instead of `StoryEditorPanel`.
**Why it happens:** `ArticleBrowser` currently unconditionally renders `<ArticleEditor articleId={selectedArticleId} />` when an article is selected.
**How to avoid:** Check the selected article's template. If `template === "story"`, render `<StoryEditorPanel>` instead.
**Warning signs:** Story articles open the generic article editor with wrong fields.

[VERIFIED: ArticleBrowser.tsx lines 16-18 shows unconditional ArticleEditor rendering]

### Pitfall 7: Template Schema Missing for "story"

**What goes wrong:** `getTemplateSchema("story")` returns `undefined`, breaking any code that expects a schema for every template.
**Why it happens:** `TEMPLATE_SCHEMAS` only has built-in schemas. If "story" is added to `ArticleTemplate` but not to `TEMPLATE_SCHEMAS`, lookups fail.
**How to avoid:** Add a minimal `story` entry to `TEMPLATE_SCHEMAS` with fields for `zoneId` and `storyId` (both read-only references). The story schema is minimal because stories don't use the standard field editor -- they have their own StoryEditorPanel.
**Warning signs:** Undefined errors when template resolution runs for story articles.

## Code Examples

### Story and Scene Type Definitions (D-06 through D-10)

```typescript
// Source: New file creator/src/types/story.ts
// Based on decisions D-06 through D-10

export type SceneTemplate = "establishing_shot" | "encounter" | "discovery";

/** Placeholder -- filled out in Phase 9 */
export interface SceneEntity {
  id: string;
  entityType: "mob" | "item" | "npc";
  entityId: string;
  position?: { x: number; y: number };
  movementPath?: string; // SVG d attribute
}

/** Placeholder -- filled out in Phase 10 */
export interface TransitionConfig {
  type: "crossfade" | "fade_black" | "slide";
  duration?: number;
}

/** Placeholder -- filled out in Phase 10 */
export interface EffectConfig {
  particles?: string; // preset name
  parallaxLayers?: number;
  parallaxDepth?: number;
}

export interface Scene {
  id: string;
  title: string;
  sortOrder: number;
  roomId?: string;
  narration?: string;       // TipTap JSON string
  dmNotes?: string;
  template?: SceneTemplate;
  entities?: SceneEntity[];
  transition?: TransitionConfig;
  effects?: EffectConfig;
}

export interface Story {
  id: string;
  title: string;
  zoneId: string;
  coverImage?: string;      // Asset ID
  scenes: Scene[];
  createdAt: string;        // ISO 8601
  updatedAt: string;        // ISO 8601
}
```

### StoryStore Skeleton

```typescript
// Source: Adapted from creator/src/stores/loreStore.ts pattern
import { create } from "zustand";
import type { Story, Scene } from "@/types/story";

const MAX_STORY_HISTORY = 50;

// Stable empty references (prevent re-render loops)
const EMPTY_STORIES: Record<string, Story> = {};
const EMPTY_SCENE_LIST: Scene[] = [];

interface StoryState {
  stories: Record<string, Story>;
  dirty: Record<string, boolean>;
  activeStoryId: string | null;
  storyPast: Record<string, Story>[];
  storyFuture: Record<string, Story>[];
}

function snapshotStory(state: StoryState): Pick<StoryState, "storyPast" | "storyFuture"> {
  const past = [...state.storyPast, structuredClone(state.stories)];
  if (past.length > MAX_STORY_HISTORY) past.shift();
  return { storyPast: past, storyFuture: [] };
}

// Store interface includes: setStory, updateStory, deleteStory, 
// updateScene, addScene, removeScene, reorderScenes,
// undoStory, redoStory, canUndoStory, canRedoStory,
// markClean, clearStories
```

### New Story Creation Flow (D-05)

```typescript
// Pseudo-code for NewStoryDialog creation handler
function handleCreateStory(title: string, zoneId: string, coverImage?: string) {
  const slug = title.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  const suffix = Math.random().toString(36).substring(2, 6);
  const storyId = `story_${slug}_${suffix}`;
  const now = new Date().toISOString();

  // 1. Create article stub in loreStore
  loreStore.getState().createArticle({
    id: storyId,
    template: "story" as ArticleTemplate,
    title,
    fields: { storyId, zoneId },
    content: "",
    image: coverImage,
    createdAt: now,
    updatedAt: now,
  });

  // 2. Create empty story in storyStore
  storyStore.getState().setStory({
    id: storyId,
    title,
    zoneId,
    coverImage,
    scenes: [],
    createdAt: now,
    updatedAt: now,
  });

  // 3. Select the article to open StoryEditorPanel
  loreStore.getState().selectArticle(storyId);
}
```

### ArticleBrowser Story Routing

```typescript
// Source: Modify creator/src/components/lore/ArticleBrowser.tsx
// Add story template check before rendering editor
const articles = useLoreStore(selectArticles);
const selectedArticle = selectedArticleId ? articles[selectedArticleId] : null;

{selectedArticle?.template === "story" ? (
  <StoryEditorPanel storyId={selectedArticle.fields.storyId as string} />
) : selectedArticleId ? (
  <ArticleEditor articleId={selectedArticleId} />
) : (
  // Empty state JSX
)}
```

### Template Color for Story

```css
/* Source: Add to creator/src/index.css alongside other --color-template-* vars */
--color-template-story: #c98fb8;  /* Rose-mauve -- distinct from existing palette */
```

[VERIFIED: index.css lines 109-119 shows existing template color variables]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single lore.yaml for everything | Separate JSON files for dense data (stories) | v1.1 (this phase) | Cleaner git diffs, independent persistence |
| All lore undo in one stack | Per-domain undo stacks (lore vs story) | v1.1 (this phase) | Story undo doesn't pollute lore history |

**Deprecated/outdated:**
- No deprecations relevant to this phase. All APIs used are current.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@tauri-apps/plugin-fs` `mkdir` supports `recursive: true` option | Architecture Patterns / Persistence | LOW -- if not, need manual recursive directory creation. Can verify with Tauri docs. |
| A2 | `@tauri-apps/plugin-fs` `readDir` returns entries with `.name` property for filtering JSON files | Architecture Patterns / Persistence | LOW -- API shape may differ slightly; verify at implementation time. |
| A3 | `structuredClone` handles TipTap JSON strings within Scene objects without issues | Architecture Patterns / Undo | VERY LOW -- structuredClone handles all JSON-serializable data. TipTap JSON is stored as a string, not as DOM objects. |
| A4 | Story template color `#c98fb8` is visually distinct from existing palette | Code Examples / Template Color | VERY LOW -- aesthetic choice, easily changed. |

## Open Questions

1. **Story deletion cascade**
   - What we know: Deleting a story article stub from loreStore should also delete the story JSON file.
   - What's unclear: Should this be handled via a subscription/listener between stores, or explicitly in a delete handler?
   - Recommendation: Explicit handler in a `deleteStory()` function that calls both `loreStore.deleteArticle()` and `storyStore.deleteStory()` + file deletion. Avoid cross-store subscriptions (complexity, race conditions).

2. **Auto-save timer scope**
   - What we know: LorePanelHost has a 3-second debounced auto-save timer for lore.
   - What's unclear: Should stories share the same timer, have their own timer in StoryEditorPanel, or use a different interval?
   - Recommendation: Own timer in StoryEditorPanel (or a `useStoryAutoSave` hook) with the same 3-second debounce. This keeps story persistence independent from lore persistence per D-12.

3. **Cover image source**
   - What we know: D-07 includes `coverImage?: string` as an optional field. The Article stub also has `image?: string`.
   - What's unclear: Is `coverImage` an asset ID from the asset manifest, a filename, or a direct path? Should it be kept in sync between the Article stub and the Story JSON?
   - Recommendation: Use asset ID (consistent with existing `Article.image` which stores asset IDs). Keep the Article stub's `image` field synced with Story's `coverImage` -- when one changes, update the other. The stub's `image` enables the existing asset gallery features (ArticleArtSection).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^3.0.0 |
| Config file | `creator/vitest.config.ts` |
| Quick run command | `cd creator && bun run test` |
| Full suite command | `cd creator && bun run test` |

[VERIFIED: creator/vitest.config.ts, creator/package.json scripts.test = "vitest run"]

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STORY-01 | Story type definitions compile correctly | unit | `cd creator && bunx tsc --noEmit` | N/A (type check) |
| STORY-01 | Story article stub creation with correct fields | unit | `cd creator && bun run test -- src/stores/__tests__/storyStore.test.ts` | Wave 0 |
| STORY-01 | storyStore.setStory adds story to state | unit | `cd creator && bun run test -- src/stores/__tests__/storyStore.test.ts` | Wave 0 |
| STORY-05 | storyStore undo restores previous state | unit | `cd creator && bun run test -- src/stores/__tests__/storyStore.test.ts` | Wave 0 |
| STORY-05 | storyStore redo re-applies undone changes | unit | `cd creator && bun run test -- src/stores/__tests__/storyStore.test.ts` | Wave 0 |
| STORY-05 | storyStore undo stack caps at 50 entries | unit | `cd creator && bun run test -- src/stores/__tests__/storyStore.test.ts` | Wave 0 |
| STORY-05 | Story persistence serializes/deserializes correctly | unit | `cd creator && bun run test -- src/lib/__tests__/storyPersistence.test.ts` | Wave 0 |
| STORY-06 | Story coverImage field round-trips through JSON | unit | `cd creator && bun run test -- src/lib/__tests__/storyPersistence.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `cd creator && bun run test`
- **Per wave merge:** `cd creator && bun run test && bunx tsc --noEmit`
- **Phase gate:** Full suite green + tsc clean before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `creator/src/stores/__tests__/storyStore.test.ts` -- covers STORY-01, STORY-05 (store CRUD + undo/redo)
- [ ] `creator/src/lib/__tests__/storyPersistence.test.ts` -- covers STORY-05, STORY-06 (JSON serialization round-trip)

Note: storyPersistence tests will need to mock `@tauri-apps/plugin-fs` since Vitest runs in Node, not in the Tauri webview. The existing test suite does not mock Tauri APIs (tests focus on pure logic), so persistence tests should test the serialization format, not the actual file I/O.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A -- local desktop app |
| V3 Session Management | No | N/A -- local desktop app |
| V4 Access Control | No | N/A -- single-user desktop app |
| V5 Input Validation | Yes | Validate storyId format (slug pattern), validate zoneId references exist, validate JSON structure on load |
| V6 Cryptography | No | N/A -- no secrets in story data |

### Known Threat Patterns for Tauri + JSON Persistence

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed JSON injection via corrupt story file | Tampering | JSON.parse in try/catch with fallback to null; never eval() | [VERIFIED: lorePersistence.ts uses try/catch]
| Path traversal in storyId | Tampering | Validate storyId contains only `[a-z0-9_]` before constructing file path |
| Oversized story file causing OOM | Denial of Service | Not a realistic concern for a single-user desktop app -- no mitigation needed |

## Sources

### Primary (HIGH confidence)
- `creator/src/stores/loreStore.ts` -- snapshotLore undo pattern, store structure, stable empty references
- `creator/src/lib/lorePersistence.ts` -- file I/O pattern, project path resolution, load/save flow
- `creator/src/types/lore.ts` -- ArticleTemplate union, Article interface, WorldLore container
- `creator/src/lib/loreTemplates.ts` -- TEMPLATE_SCHEMAS record, template schema structure
- `creator/src/lib/panelRegistry.ts` -- PanelDef structure, LORE_PANELS array, host routing
- `creator/src/components/lore/LorePanelHost.tsx` -- renderPanel routing, auto-save timer pattern
- `creator/src/components/lore/ArticleBrowser.tsx` -- article selection rendering, editor routing
- `creator/src/components/lore/ArticleTree.tsx` -- template dot colors, tree node rendering, ID generation
- `creator/src/components/Sidebar.tsx` -- ArticleTree integration, workspace routing
- `creator/src/lib/useOpenProject.ts` -- project open flow, lore loading integration point
- `creator/src/index.css` -- template color CSS variables
- `creator/package.json` -- dependency versions
- `creator/vitest.config.ts` -- test configuration

### Secondary (MEDIUM confidence)
- `creator/src/types/project.ts` -- Project interface, ProjectFormat type (standalone vs legacy)

### Tertiary (LOW confidence)
- None -- all findings verified from codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all verified from package.json
- Architecture: HIGH -- all patterns directly observed in existing codebase
- Pitfalls: HIGH -- identified from code inspection, not theoretical

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable -- no external API dependencies, no fast-moving libraries)
