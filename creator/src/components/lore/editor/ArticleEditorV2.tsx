import { useCallback, useEffect, useMemo, useState } from "react";
import { useLoreStore } from "@/stores/loreStore";
import type { Article, ArticleSection } from "@/types/lore";
import { TEMPLATE_SCHEMAS, templateTint } from "@/lib/loreTemplates";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { RewriteDialog } from "@/components/lore/RewriteDialog";
import type { RewriteResult } from "@/lib/loreRewrite";
import { ScaffoldGameplayDialog } from "./ScaffoldGameplayDialog";
import { useConfigStore } from "@/stores/configStore";
import { SectionRail } from "./SectionRail";
import { SectionEditorBody } from "./SectionEditorBody";
import { Inspector } from "./Inspector";
import { ArchivePickerModal, type ArchivePickerMode } from "./ArchivePickerModal";

interface PickerState {
  sectionId: string;
  mode: ArchivePickerMode;
}

export function ArticleEditorV2({ articleId }: { articleId: string }) {
  // ─── Store wiring ───────────────────────────────────────────────
  const article = useLoreStore((s) => s.lore?.articles[articleId] ?? null);
  const updateArticle = useLoreStore((s) => s.updateArticle);
  const renameArticle = useLoreStore((s) => s.renameArticle);
  const deleteArticle = useLoreStore((s) => s.deleteArticle);
  const duplicateArticle = useLoreStore((s) => s.duplicateArticle);
  const ensureArticleSections = useLoreStore((s) => s.ensureArticleSections);
  const addSection = useLoreStore((s) => s.addSection);
  const updateSection = useLoreStore((s) => s.updateSection);
  const deleteSection = useLoreStore((s) => s.deleteSection);
  const reorderSections = useLoreStore((s) => s.reorderSections);
  const selectSection = useLoreStore((s) => s.selectSection);
  const selectedSectionId = useLoreStore((s) => s.selectedSectionId);

  // ─── Local UI state ─────────────────────────────────────────────
  const [showRail, setShowRail] = useState(true);
  const [showInspector, setShowInspector] = useState(true);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [showRewrite, setShowRewrite] = useState(false);
  const [showScaffold, setShowScaffold] = useState<null | "class" | "race">(null);
  const config = useConfigStore((s) => s.config);
  const updateConfig = useConfigStore((s) => s.updateConfig);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Migrate legacy articles into the section model on first open.
  useEffect(() => {
    if (!articleId) return;
    ensureArticleSections(articleId);
  }, [articleId, ensureArticleSections]);

  // Auto-select first section when there's no selection or selection is stale.
  const sections = article?.sections ?? [];
  useEffect(() => {
    if (!sections.length) return;
    const stillThere = selectedSectionId && sections.some((s) => s.id === selectedSectionId);
    if (!stillThere) selectSection(sections[0]!.id);
  }, [sections, selectedSectionId, selectSection]);

  const activeSection: ArticleSection | undefined = useMemo(
    () => sections.find((s) => s.id === selectedSectionId),
    [sections, selectedSectionId],
  );

  // ─── Patches ────────────────────────────────────────────────────
  const patchArticle = useCallback(
    (p: Partial<Article>) => updateArticle(articleId, p),
    [articleId, updateArticle],
  );

  const handleSectionPatch = useCallback(
    (patch: Partial<ArticleSection>) => {
      if (!activeSection) return;
      updateSection(articleId, activeSection.id, patch);
    },
    [activeSection, articleId, updateSection],
  );

  const handleFieldChange = useCallback(
    (key: string, value: unknown) => {
      if (!article) return;
      patchArticle({ fields: { ...article.fields, [key]: value } });
    },
    [article, patchArticle],
  );

  const handleRewriteAccept = useCallback(
    (result: RewriteResult) => {
      if (!article) return;
      // Update fields and keep the legacy `content` field in sync (used by
      // exporters and the section-migration path), but the source of truth
      // for what the editor renders is the richtext section bodies.
      const merged: Partial<Article> = {};
      if (result.content) merged.content = result.content;
      if (Object.keys(result.fields).length > 0) {
        merged.fields = { ...article.fields, ...result.fields };
      }
      updateArticle(article.id, merged);

      if (result.content) {
        const firstRichtext = sections.find(
          (s) => s.type === "richtext" && !s.private,
        );
        if (firstRichtext) {
          updateSection(article.id, firstRichtext.id, { body: result.content });
        }
      }
    },
    [article, sections, updateArticle, updateSection],
  );

  // ─── Picker plumbing ────────────────────────────────────────────
  const openPicker = (mode: ArchivePickerMode) => {
    if (!activeSection) return;
    setPicker({ sectionId: activeSection.id, mode });
  };

  const alreadySelected = useMemo(() => {
    if (!picker || picker.mode !== "multi") return [];
    const sec = sections.find((s) => s.id === picker.sectionId);
    if (!sec || sec.type !== "gallery") return [];
    return sec.images;
  }, [picker, sections]);

  const handleConfirmPick = (chosen: string | string[]) => {
    if (!picker) return;
    const sec = sections.find((s) => s.id === picker.sectionId);
    if (!sec) return;

    if (sec.type === "image") {
      const file = Array.isArray(chosen) ? chosen[0] : chosen;
      if (file) updateSection(articleId, sec.id, { primary: file });
    } else if (sec.type === "gallery") {
      const adds = (Array.isArray(chosen) ? chosen : [chosen]).filter(Boolean);
      const existing = sec.images;
      const merged = [...existing, ...adds.filter((id) => !existing.includes(id))];
      updateSection(articleId, sec.id, {
        images: merged,
        primary: sec.primary ?? merged[0],
      });
    }
    setPicker(null);
  };

  // ─── Keyboard nav ───────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.matches("input, textarea, select") || target.isContentEditable)
      ) {
        return;
      }
      if (!sections.length) return;
      const idx = sections.findIndex((s) => s.id === selectedSectionId);
      const isUp = e.key === "ArrowUp" || e.key === "k";
      const isDown = e.key === "ArrowDown" || e.key === "j";

      // Alt + ↑/↓ reorders the selected section. Skip required (anchor)
      // sections so we don't fight the loreSections invariants.
      if ((isUp || isDown) && e.altKey && idx >= 0) {
        const current = sections[idx]!;
        if (current.required) return;
        if (isUp && idx > 0) {
          e.preventDefault();
          reorderSections(articleId, current.id, sections[idx - 1]!.id);
        } else if (isDown && idx < sections.length - 1) {
          e.preventDefault();
          // dropBeforeId = section after the next one; "" pushes to end.
          const after = sections[idx + 2]?.id ?? "";
          reorderSections(articleId, current.id, after);
        }
        return;
      }

      if (isDown && idx < sections.length - 1) {
        e.preventDefault();
        selectSection(sections[idx + 1]!.id);
      } else if (isUp && idx > 0) {
        e.preventDefault();
        selectSection(sections[idx - 1]!.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sections, selectedSectionId, selectSection, reorderSections, articleId]);

  if (!article) {
    return (
      <div className="flex min-h-[28rem] flex-1 items-center justify-center text-sm text-text-muted">
        Select an article to start editing.
      </div>
    );
  }

  const schema = TEMPLATE_SCHEMAS[article.template];
  const tplLabel = schema?.label ?? article.template;
  const tplTint = templateTint(article.template);

  // Save indicator: derived from updatedAt; "saved X ago"
  const savedLabel = formatRelativeTime(article.updatedAt);

  const draftLabel = article.draft
    ? "Draft — not yet published"
    : "Published to showcase";
  const draftClass = article.draft ? "var(--color-status-warning)" : "var(--color-status-success)";

  const slugSummary = `${article.id} · ${sections.length} ${sections.length === 1 ? "section" : "sections"} · ${savedLabel}`;
  const privateCount = sections.filter((s) => s.private).length;

  return (
    <div
      className="ae-app"
      data-rail={showRail}
      data-inspector={showInspector}
      style={{ ["--ae-tpl-color" as string]: tplTint }}
    >
      {/* ─── Topbar ─── */}
      <header className="ae-topbar">
        <div className="ae-topbar__crumb">
          <span className="ae-tplbadge">{tplLabel}</span>
          {renaming ? (
            <form
              className="ae-row"
              onSubmit={(e) => {
                e.preventDefault();
                const id = renameDraft
                  .trim()
                  .toLowerCase()
                  .replace(/\s+/g, "_")
                  .replace(/[^a-z0-9_]/g, "");
                if (id && id !== articleId) renameArticle(articleId, id);
                setRenaming(false);
              }}
            >
              <input
                autoFocus
                className="ae-field__inp ae-rename-input"
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setRenaming(false)}
                aria-label="New article id"
              />
              <button type="submit" className="ae-topbar__btn">Rename</button>
              <button
                type="button"
                className="ae-topbar__btn"
                onClick={() => setRenaming(false)}
              >
                Cancel
              </button>
            </form>
          ) : (
            <>
              <span className="ae-topbar__title">{article.title || "Untitled"}</span>
              <button
                type="button"
                className="ae-topbar__slug"
                onClick={() => {
                  setRenameDraft(article.id);
                  setRenaming(true);
                }}
                title="Rename — changes this article's id and showcase URL"
              >
                {slugSummary}
              </button>
            </>
          )}
        </div>

        <div className="ae-topbar__spacer" />

        <label className="ae-topbar__check">
          <input
            type="checkbox"
            checked={article.draft ?? false}
            onChange={() => patchArticle({ draft: !article.draft })}
          />
          <span className="ae-topbar__check__box" />
          Draft
        </label>

        <div className="ae-topbar__group">
          <button
            type="button"
            className="ae-topbar__btn"
            onClick={() => setShowRewrite(true)}
            title="Rewrite article with specific instructions"
          >
            Rewrite
          </button>
          {article && article.template === "class" && config && (
            <button
              type="button"
              className="ae-topbar__btn"
              onClick={() => setShowScaffold("class")}
              title="Scaffold a gameplay class from this article — adds a row to application.yaml::classes"
            >
              Scaffold class
            </button>
          )}
          {article && article.template === "ancestry" && config && (
            <button
              type="button"
              className="ae-topbar__btn"
              onClick={() => setShowScaffold("race")}
              title="Scaffold a gameplay race from this article — adds a row to application.yaml::races"
            >
              Scaffold race
            </button>
          )}
          <button
            type="button"
            className="ae-topbar__btn"
            onClick={() => duplicateArticle(articleId)}
            title="Duplicate article"
          >
            Duplicate
          </button>
          <button
            type="button"
            className="ae-topbar__btn"
            data-variant="danger"
            onClick={() => setConfirmDelete(true)}
            title="Delete article"
          >
            Delete
          </button>
        </div>
      </header>

      {/* ─── Section rail ─── */}
      <SectionRail
        sections={sections}
        activeId={selectedSectionId}
        onSelect={selectSection}
        onAdd={(type) => addSection(articleId, type)}
        onDelete={(id) => deleteSection(articleId, id)}
        onReorder={(dragId, dropBeforeId) => reorderSections(articleId, dragId, dropBeforeId)}
        onCollapse={() => setShowRail(false)}
        onExpand={() => setShowRail(true)}
      />

      {/* ─── Canvas (article header + active section) ─── */}
      <main className="ae-canvas">
        <div className="ae-headblock">
          <div className="ae-headblock__kicker">
            <span>Lore Article</span>
            <span className="ae-dot" />
            <span>{tplLabel}</span>
            <span className="ae-dot" />
            <span style={{ color: draftClass }}>{draftLabel}</span>
          </div>
          <input
            className="ae-headblock__title"
            value={article.title}
            onChange={(e) => patchArticle({ title: e.target.value })}
            placeholder="Untitled article"
            aria-label="Article title"
          />
          <input
            className="ae-headblock__sub"
            value={article.tagline ?? ""}
            onChange={(e) => patchArticle({ tagline: e.target.value || undefined })}
            placeholder="A line that frames the article — a tagline, a stanza, a single image."
            aria-label="Article tagline"
          />
        </div>

        {activeSection ? (
          <SectionEditorBody
            article={article}
            section={activeSection}
            onChange={handleSectionPatch}
            onPick={openPicker}
            onTogglePrivate={() =>
              updateSection(articleId, activeSection.id, {
                private: !activeSection.private,
              } as Partial<ArticleSection>)
            }
          />
        ) : (
          <div className="ae-editor ae-empty-note">
            No section selected. Add one from the rail.
          </div>
        )}
      </main>

      {/* ─── Inspector ─── */}
      <Inspector
        article={article}
        onFieldChange={handleFieldChange}
        onTemplateChange={(template) => patchArticle({ template })}
        onTagsChange={(tags) => patchArticle({ tags })}
        onRelationsChange={(relations) => patchArticle({ relations })}
        onCollapse={() => setShowInspector(false)}
        onExpand={() => setShowInspector(true)}
      />

      {/* ─── Status bar ─── */}
      <footer className="ae-statusbar">
        <span>{sections.length} {sections.length === 1 ? "section" : "sections"}</span>
        {privateCount > 0 && (
          <>
            <span className="ae-statusbar__sep">·</span>
            <span>{privateCount} private</span>
          </>
        )}
        <span className="ae-statusbar__sep">·</span>
        <span>{savedLabel}</span>
        <span className="ae-statusbar__right">
          <span className="ae-statusbar__kbd"><b>↑</b> <b>↓</b> step</span>
          <span className="ae-statusbar__kbd"><b>Alt</b> + <b>↑</b> <b>↓</b> reorder</span>
        </span>
      </footer>

      {/* ─── Library / archive picker ─── */}
      <ArchivePickerModal
        open={!!picker}
        mode={picker?.mode ?? "single"}
        alreadySelected={alreadySelected}
        onClose={() => setPicker(null)}
        onConfirm={handleConfirmPick}
      />

      {/* ─── Dialogs ─── */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete article"
          message={`Delete "${article.title}"? This cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Keep it"
          destructive
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            deleteArticle(articleId);
          }}
        />
      )}
      {showScaffold && article && config && (
        <ScaffoldGameplayDialog
          kind={showScaffold}
          article={article}
          config={config}
          onAccept={(next) => updateConfig(next)}
          onClose={() => setShowScaffold(null)}
        />
      )}
      {showRewrite && (
        <RewriteDialog
          article={article}
          onAccept={handleRewriteAccept}
          onClose={() => setShowRewrite(false)}
        />
      )}
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diff = Math.max(0, now - then);
    if (diff < 30_000) return "saved just now";
    if (diff < 60 * 60_000) return `saved ${Math.round(diff / 60_000)} min ago`;
    if (diff < 24 * 60 * 60_000) return `saved ${Math.round(diff / (60 * 60_000))} h ago`;
    return `saved ${new Date(iso).toLocaleDateString()}`;
  } catch {
    return "";
  }
}
