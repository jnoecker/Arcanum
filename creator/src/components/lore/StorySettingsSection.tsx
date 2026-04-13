// ─── StorySettingsSection ────────────────────────────────────────────
// Story-level metadata: cover, synopsis, tags, draft, lore links,
// featured characters, primary map, primary calendar.

import { useState, useCallback, useId, type ReactNode } from "react";
import { useStoryStore } from "@/stores/storyStore";
import { useLoreStore, selectMaps, selectCalendars } from "@/stores/loreStore";
import { useImageSrc } from "@/lib/useImageSrc";
import { AssetPickerModal } from "@/components/ui/AssetPickerModal";
import { Spinner } from "@/components/ui/FormWidgets";
import { ArticleMultiPicker } from "./LoreLinkPicker";
import type { Story } from "@/types/story";

// ─── Cover image thumbnail (mirrors StoryEditorPanel) ──────────────

function CoverImage({
  fileName,
  onChangeClick,
}: {
  fileName: string;
  onChangeClick: () => void;
}) {
  const src = useImageSrc(fileName);
  return (
    <button
      type="button"
      onClick={onChangeClick}
      className="group relative w-full max-w-[200px] overflow-hidden rounded-xl border border-border-default"
    >
      {src ? (
        <img src={src} alt="Story cover" loading="lazy" className="w-full object-cover" />
      ) : (
        <div className="flex h-[140px] w-full items-center justify-center">
          <Spinner />
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-[var(--chrome-fill-strong)] opacity-0 transition-opacity group-hover:opacity-100">
        <span className="text-sm font-medium text-text-primary">Change</span>
      </div>
    </button>
  );
}

// ─── Inline tag list ───────────────────────────────────────────────

function TagList({
  items,
  onChange,
}: {
  items: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const add = useCallback(() => {
    const v = draft.trim();
    if (!v || items.includes(v)) return;
    onChange([...items, v]);
    setDraft("");
  }, [draft, items, onChange]);

  return (
    <div>
      {items.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {items.map((t, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-0.5 rounded-full border border-border-muted bg-bg-tertiary px-2 py-0.5 text-2xs text-text-secondary"
            >
              {t}
              <button
                type="button"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="ml-0.5 leading-none text-text-muted hover:text-status-error"
                aria-label={`Remove ${t}`}
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <input
          className="flex-1 rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none focus:border-accent/50"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add tag and press Enter..."
          aria-label="Add tag"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="rounded border border-border-default px-2 py-0.5 text-xs text-text-secondary hover:bg-bg-tertiary disabled:opacity-40"
          aria-label="Add tag"
        >
          +
        </button>
      </div>
    </div>
  );
}

// ─── Field row ─────────────────────────────────────────────────────

function Field({
  label,
  labelFor,
  groupLabel,
  children,
}: {
  label: string;
  labelFor?: string;
  groupLabel?: boolean;
  children: ReactNode;
}) {
  const labelId = useId();

  return (
    <div className="flex flex-col gap-1">
      {labelFor ? (
        <label
          htmlFor={labelFor}
          className="font-display text-2xs uppercase tracking-[0.15em] text-text-muted"
        >
          {label}
        </label>
      ) : (
        <div
          id={labelId}
          className="font-display text-2xs uppercase tracking-[0.15em] text-text-muted"
        >
          {label}
        </div>
      )}
      {groupLabel ? <div aria-labelledby={labelId}>{children}</div> : children}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────

interface StorySettingsSectionProps {
  story: Story;
}

export function StorySettingsSection({ story }: StorySettingsSectionProps) {
  const updateStory = useStoryStore((s) => s.updateStory);
  const maps = useLoreStore(selectMaps);
  const calendars = useLoreStore(selectCalendars);
  const synopsisId = useId();
  const primaryMapId = useId();
  const primaryCalendarId = useId();

  const [showSettings, setShowSettings] = useState(false);
  const [showAssetPicker, setShowAssetPicker] = useState(false);

  // ─── Handlers ──────────────────────────────────────────────────

  const handleCoverImageSelect = useCallback(
    (fileName: string) => {
      updateStory(story.id, { coverImage: fileName });
      useLoreStore.getState().updateArticle(story.id, {
        image: fileName,
        updatedAt: new Date().toISOString(),
      });
      setShowAssetPicker(false);
    },
    [story.id, updateStory],
  );

  const patch = useCallback(
    (p: Partial<Story>) => updateStory(story.id, p),
    [story.id, updateStory],
  );

  return (
    <div>
      <button
        type="button"
        onClick={() => setShowSettings(!showSettings)}
        aria-expanded={showSettings}
        className="flex items-center gap-2 text-2xs text-text-muted hover:text-text-primary transition-colors"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={`transform transition-transform duration-200 ${showSettings ? "rotate-180" : ""}`}
        >
          <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Story Settings
        {story.draft && (
          <span className="rounded-full border border-warm/30 bg-warm/10 px-1.5 py-0 text-[9px] uppercase tracking-wider text-warm">
            draft
          </span>
        )}
      </button>

      <div
        className={`grid overflow-hidden transition-[grid-template-rows] duration-300 ${
          showSettings ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
        style={{ transitionTimingFunction: "var(--ease-unfurl)" }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="grid grid-cols-1 gap-4 pt-3 md:grid-cols-[200px,1fr]">
            {/* Cover image */}
            <div>
              {story.coverImage ? (
                <CoverImage
                  fileName={story.coverImage}
                  onChangeClick={() => setShowAssetPicker(true)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAssetPicker(true)}
                  className="flex h-[140px] w-full max-w-[200px] cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border-default transition-colors hover:border-accent/40 hover:bg-bg-tertiary"
                >
                  <span className="text-sm text-text-muted">Add a cover image</span>
                </button>
              )}
            </div>

            {/* Right column: synopsis + meta + lore links */}
            <div className="flex flex-col gap-3">
              <Field label="Synopsis" labelFor={synopsisId}>
                <textarea
                  id={synopsisId}
                  value={story.synopsis ?? ""}
                  onChange={(e) => patch({ synopsis: e.target.value || undefined })}
                  placeholder="A short logline or pitch for this story..."
                  rows={3}
                  className="rounded border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent/50 resize-none"
                />
              </Field>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Tags" groupLabel>
                  <TagList
                    items={story.tags ?? []}
                    onChange={(tags) => patch({ tags: tags.length > 0 ? tags : undefined })}
                  />
                </Field>

                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-2 text-xs text-text-secondary">
                    <input
                      type="checkbox"
                      checked={story.draft ?? false}
                      onChange={(e) => patch({ draft: e.target.checked || undefined })}
                      className="rounded border-border-default"
                    />
                    Draft (excluded from showcase)
                  </label>

                  <Field label="Primary map" labelFor={primaryMapId}>
                    <select
                      id={primaryMapId}
                      className="rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-secondary outline-none focus:border-accent/50"
                      value={story.primaryMapId ?? ""}
                      onChange={(e) => patch({ primaryMapId: e.target.value || undefined })}
                    >
                      <option value="">— none —</option>
                      {maps.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Primary calendar" labelFor={primaryCalendarId}>
                    <select
                      id={primaryCalendarId}
                      className="rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-secondary outline-none focus:border-accent/50"
                      value={story.primaryCalendarId ?? ""}
                      onChange={(e) => patch({ primaryCalendarId: e.target.value || undefined })}
                    >
                      <option value="">— none —</option>
                      {calendars.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>

              <Field label="Featured characters" groupLabel>
                <ArticleMultiPicker
                  selected={story.featuredCharacterIds ?? []}
                  onChange={(ids) =>
                    patch({ featuredCharacterIds: ids.length > 0 ? ids : undefined })
                  }
                  templateFilter="character"
                  placeholder="Add character"
                  ariaLabel="Featured characters"
                />
              </Field>

              <Field label="Featured lore" groupLabel>
                <ArticleMultiPicker
                  selected={story.linkedArticleIds ?? []}
                  onChange={(ids) =>
                    patch({ linkedArticleIds: ids.length > 0 ? ids : undefined })
                  }
                  placeholder="Link article"
                  ariaLabel="Featured lore"
                />
              </Field>
            </div>
          </div>
        </div>
      </div>

      {showAssetPicker && (
        <AssetPickerModal
          onSelect={handleCoverImageSelect}
          onClose={() => setShowAssetPicker(false)}
        />
      )}
    </div>
  );
}
