import { useState, useMemo } from "react";
import { useLoreStore } from "@/stores/loreStore";
import { useStoryStore } from "@/stores/storyStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useImageSrc } from "@/lib/useImageSrc";
import { DialogShell, ActionButton, Spinner } from "@/components/ui/FormWidgets";
import { AssetPickerModal } from "@/components/ui/AssetPickerModal";
import type { ArticleTemplate } from "@/types/lore";

interface NewStoryDialogProps {
  onClose: () => void;
}

/** Thumbnail preview for the selected cover image. */
function CoverThumb({ fileName }: { fileName: string }) {
  const src = useImageSrc(fileName);
  if (!src) return <Spinner />;
  return <img src={src} alt="Cover preview" className="h-full w-full rounded-lg object-cover" />;
}

export function NewStoryDialog({ onClose }: NewStoryDialogProps) {
  const [title, setTitle] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [coverImage, setCoverImage] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zones = useZoneStore((s) => s.zones);

  const zoneOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    for (const [id, state] of zones.entries()) {
      opts.push({ value: id, label: state.data.zone || id });
    }
    opts.sort((a, b) => a.label.localeCompare(b.label));
    return opts;
  }, [zones]);

  const canCreate = title.trim().length > 0 && zoneId.length > 0;

  const handleCreate = () => {
    if (!canCreate || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      // Generate story ID from slug + random suffix (T-07-05: safe character set)
      const slug = title
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "");
      const suffix = Math.random().toString(36).substring(2, 6);
      const storyId = "story_" + slug + "_" + suffix;

      const now = new Date().toISOString();

      // Create article stub in loreStore
      useLoreStore.getState().createArticle({
        id: storyId,
        template: "story" as ArticleTemplate,
        title: title.trim(),
        fields: { storyId, zoneId },
        content: "",
        image: coverImage,
        createdAt: now,
        updatedAt: now,
      });

      // Create empty story in storyStore
      useStoryStore.getState().setStory({
        id: storyId,
        title: title.trim(),
        zoneId,
        coverImage,
        scenes: [],
        createdAt: now,
        updatedAt: now,
      });

      // Select the new story article
      useLoreStore.getState().selectArticle(storyId);

      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <>
      <DialogShell
        titleId="new-story-dialog-title"
        title="Create Story"
        widthClassName="max-w-lg"
        onClose={onClose}
        footer={
          <div className="flex items-center justify-end gap-2">
            <ActionButton variant="ghost" onClick={onClose} disabled={submitting}>
              Never Mind
            </ActionButton>
            <ActionButton
              variant="primary"
              onClick={handleCreate}
              disabled={!canCreate || submitting}
              className={!canCreate ? "opacity-45 cursor-not-allowed" : ""}
            >
              {submitting ? (
                <span className="flex items-center gap-1.5">
                  <Spinner /> Creating...
                </span>
              ) : (
                "Create Story"
              )}
            </ActionButton>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="story-title" className="text-xs text-text-muted">
              Story Title
            </label>
            <input
              id="story-title"
              type="text"
              placeholder="The Dark Awakening"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canCreate) handleCreate();
              }}
              disabled={submitting}
              className="w-full rounded-lg border border-border-default bg-bg-elevated px-3 py-2 font-body text-text-primary placeholder:text-text-muted/50 focus:border-accent focus:outline-none disabled:opacity-60"
            />
          </div>

          {/* Zone */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="story-zone" className="text-xs text-text-muted">
              Linked Zone
            </label>
            {zoneOptions.length === 0 ? (
              <select
                id="story-zone"
                disabled
                className="w-full rounded-lg border border-border-default bg-bg-elevated px-3 py-2 font-body text-text-muted/60"
              >
                <option>Load a zone to create a story</option>
              </select>
            ) : (
              <select
                id="story-zone"
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                disabled={submitting}
                className="w-full rounded-lg border border-border-default bg-bg-elevated px-3 py-2 font-body text-text-primary focus:border-accent focus:outline-none disabled:opacity-60"
              >
                <option value="">Select a zone</option>
                {zoneOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Cover Image */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-text-muted">Cover Image</span>
            <div className="flex items-center gap-3">
              {coverImage ? (
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border-default">
                  <CoverThumb fileName={coverImage} />
                </div>
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-border-default">
                  <span className="text-3xs text-text-muted">No image</span>
                </div>
              )}
              <ActionButton
                variant="secondary"
                size="sm"
                onClick={() => setShowAssetPicker(true)}
                disabled={submitting}
              >
                {coverImage ? "Change Image" : "Choose Image"}
              </ActionButton>
              {coverImage && (
                <ActionButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setCoverImage(undefined)}
                  disabled={submitting}
                >
                  Remove
                </ActionButton>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-status-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </DialogShell>

      {/* Asset Picker */}
      {showAssetPicker && (
        <AssetPickerModal
          onSelect={(fileName) => {
            setCoverImage(fileName);
            setShowAssetPicker(false);
          }}
          onClose={() => setShowAssetPicker(false)}
        />
      )}
    </>
  );
}
