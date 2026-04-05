# Phase 7: Story Foundation - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Builders can create, persist, and manage stories as a new lore type linked to zones. This phase delivers the data model, story store with undo/redo, JSON persistence, and lore system integration. Scene editing, composition, cinematic effects, and presentation are separate phases (8-12).

</domain>

<decisions>
## Implementation Decisions

### Story-Lore Bridge
- **D-01:** Stories use a thin article stub pattern — a real `Article` with `template="story"` lives in `loreStore`/`lore.yaml`, holding only title, zone link, cover image, tags, and a `storyId` pointer. Actual scene data lives in `storyStore` backed by separate JSON files.
- **D-02:** Add `"story"` to the `ArticleTemplate` union type in `types/lore.ts`.
- **D-03:** When a story article is selected in the lore browser, `LorePanelHost` routes to a dedicated `StoryEditorPanel` (registered in panel registry as `host="lore"`, group `"lore"`). The existing `ArticleEditor` is not used for stories.

### Lore Browser UX
- **D-04:** Stories appear mixed with other articles in the article tree, with a distinctive icon (film/clapperboard). Filterable by the "story" template like any other type.
- **D-05:** "New Story" uses a zone-first creation flow: button in article tree toolbar opens a modal with title, zone dropdown (loaded zones), and optional cover image. Creates both the stub article in `loreStore` and the empty story JSON in `storyStore`, then opens `StoryEditorPanel`.

### Data Model Shape
- **D-06:** Define the full `Story` and `Scene` type hierarchy upfront in Phase 7. Scene fields for Phase 8+ (narration, dmNotes, template, entities, transition, effects) are defined as optional properties now, preventing data migration later.
- **D-07:** `Story` interface: `id`, `title`, `zoneId`, `coverImage?`, `scenes: Scene[]`, `createdAt`, `updatedAt`.
- **D-08:** `Scene` interface: `id`, `title`, `sortOrder`, `roomId?`, `narration?` (TipTap JSON string), `dmNotes?`, `template?: SceneTemplate`, `entities?: SceneEntity[]`, `transition?: TransitionConfig`, `effects?: EffectConfig`.
- **D-09:** `SceneTemplate` type: `"establishing_shot" | "encounter" | "discovery"`.
- **D-10:** `SceneEntity`, `TransitionConfig`, and `EffectConfig` are defined as placeholder interfaces in Phase 7, filled out when Phase 9-10 need them.

### Undo/Redo
- **D-11:** `storyStore` uses the same manual undo pattern as `loreStore` — `structuredClone` snapshots with a 50-entry history stack and `snapshotStory()` helper. Does not use zundo middleware.
- **D-12:** Story undo/redo is fully independent from lore undo/redo — undoing a scene change never affects article content and vice versa.

### Persistence Format
- **D-13:** One JSON file per story in a `stories/` subdirectory alongside `lore.yaml`. Path: `{mudDir}/stories/{storyId}.json` (standalone) or `{mudDir}/src/main/resources/stories/{storyId}.json` (multi-module).
- **D-14:** `storyPersistence.ts` handles load/save with `readTextFile`/`writeTextFile` from `@tauri-apps/plugin-fs`. JSON.stringify with 2-space indent for readability.
- **D-15:** Save triggers on dirty flag — same pattern as `lorePersistence.ts` (tab close, project close, Ctrl+S, periodic auto-save timer).

### Claude's Discretion
- Story ID generation scheme (UUID, slug-based, or prefixed)
- Exact icon choice for story articles in the tree
- StoryEditorPanel layout for Phase 7 (minimal — just metadata editing + empty scene list placeholder)
- Error handling for missing/corrupt story JSON files
- Whether to load all stories eagerly on project open or lazily on selection

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Lore system (integration target)
- `creator/src/types/lore.ts` — Article type, ArticleTemplate union, WorldLore container — story template must be added here
- `creator/src/stores/loreStore.ts` — Undo/redo pattern (snapshotLore), article CRUD operations — storyStore follows same pattern
- `creator/src/lib/lorePersistence.ts` — Load/save pattern, project path resolution — storyPersistence mirrors this
- `creator/src/lib/loreTemplates.ts` — Template schemas, custom template support — story template schema needed

### Panel routing
- `creator/src/lib/panelRegistry.ts` — Panel definitions, SidebarGroup/PanelDef types, host routing — new storyEditor panel registered here
- `creator/src/components/lore/LorePanelHost.tsx` — Routes template to editor component — needs story template routing
- `creator/src/components/lore/ArticleBrowser.tsx` — Article tree rendering, template filtering — story icon and "New Story" button

### Existing patterns
- `creator/src/stores/zoneStore.ts` — Alternative undo pattern (zundo) for comparison
- `creator/src/lib/exportShowcase.ts` — ShowcaseData types — stories will extend this in Phase 12
- `creator/src/types/project.ts` — Project type, format field (standalone vs multi-module) — affects story file paths

### Requirements
- `.planning/REQUIREMENTS.md` — STORY-01 (create story linked to zone), STORY-05 (persist with undo/redo), STORY-06 (cover image)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `loreStore.ts` snapshotLore pattern: Copy for storyStore undo/redo implementation
- `lorePersistence.ts` load/save: Mirror for storyPersistence.ts with JSON instead of YAML
- `panelRegistry.ts` PanelDef structure: Register storyEditor panel with same pattern
- `ArticleBrowser.tsx`: Add "New Story" button and story icon rendering
- `LorePanelHost.tsx`: Add template routing for `"story"` → `StoryEditorPanel`

### Established Patterns
- Zustand stores with manual undo (loreStore) — storyStore follows this exactly
- `@tauri-apps/plugin-fs` for async file I/O — storyPersistence uses same APIs
- Panel registry with host-based routing — story editor uses `host: "lore"`
- Stable empty references for selectors (EMPTY_ARTICLES pattern) — storyStore needs same

### Integration Points
- `ArticleTemplate` union in `types/lore.ts` — add `"story"` variant
- `loreStore.createArticle()` — called during "New Story" flow to create stub
- `LorePanelHost` template routing — branch on `template === "story"`
- `ArticleBrowser` toolbar — add "New Story" creation button
- Project open flow — load stories alongside lore data

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches that follow the established patterns captured in decisions above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-story-foundation*
*Context gathered: 2026-04-05*
