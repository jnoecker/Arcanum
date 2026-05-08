import { useMemo, useState } from "react";
import type { Article } from "@/types/lore";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import { Section, FieldRow, TextInput } from "@/components/ui/FormWidgets";
import {
  getArticlePrompt,
  getArticleContext,
  getArticleFraming,
  resolveSceneSubjects,
  TEMPLATE_ASSET_TYPE,
} from "@/lib/loreArtPrompts";
import { extractMentionCounts } from "@/lib/loreRelations";
import { useImageSrc } from "@/lib/useImageSrc";
import { useLoreStore } from "@/stores/loreStore";
import type { AssetContext } from "@/types/assets";

const SCENE_SUBJECT_MAX = 3;

function SceneSubjectsPicker({
  article,
  onChange,
}: {
  article: Article;
  onChange: (subjects: string[]) => void;
}) {
  const articles = useLoreStore((s) => s.lore?.articles);
  const counts = useMemo(() => extractMentionCounts(article.content), [article.content]);
  const sorted = useMemo(
    () => Array.from(counts.entries()).sort((a, b) => b[1] - a[1]),
    [counts],
  );

  if (sorted.length === 0) return null;

  const effective = new Set(resolveSceneSubjects(article));
  const limitReached = effective.size >= SCENE_SUBJECT_MAX;

  const toggle = (id: string) => {
    const next = new Set(effective);
    if (next.has(id)) {
      next.delete(id);
    } else if (next.size < SCENE_SUBJECT_MAX) {
      next.add(id);
    } else {
      return;
    }
    onChange(Array.from(next));
  };

  return (
    <div className="flex flex-col gap-1">
      <p className="text-2xs font-medium uppercase tracking-ui text-text-muted">
        Scene subjects
      </p>
      <p className="text-3xs text-text-muted/80">
        Mentioned characters visually depicted in this image. Others stay as backstory references. Max {SCENE_SUBJECT_MAX}.
      </p>
      <div className="flex flex-wrap gap-1 pt-1">
        {sorted.map(([id, count]) => {
          const subject = articles?.[id];
          if (!subject) return null;
          const active = effective.has(id);
          const disabled = !active && limitReached;
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              disabled={disabled}
              title={
                disabled
                  ? `Maximum ${SCENE_SUBJECT_MAX} subjects — deselect another first`
                  : `${subject.title} (${subject.template})`
              }
              className={`rounded-full border px-2 py-0.5 text-2xs transition disabled:opacity-40 ${
                active
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-[var(--chrome-stroke)] text-text-secondary hover:border-[var(--chrome-stroke-strong)] hover:text-text-primary"
              }`}
            >
              {active ? "✓ " : ""}
              {subject.title}
              {count > 1 ? ` ×${count}` : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GalleryThumbnail({
  filename,
  onRemove,
  onPromote,
}: {
  filename: string;
  onRemove: () => void;
  onPromote: () => void;
}) {
  const src = useImageSrc(filename);

  return (
    <div className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-[var(--chrome-stroke)] bg-[var(--chrome-fill-strong)]">
      {src ? (
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-2xs text-text-muted">...</div>
      )}
      <div className="absolute inset-0 flex items-center justify-center gap-1 bg-[var(--chrome-fill-soft)] opacity-0 transition group-hover:opacity-100">
        <button
          onClick={onPromote}
          className="rounded-full bg-[var(--chrome-highlight-strong)] p-1 text-3xs text-text-primary hover:bg-[var(--chrome-highlight-strong)]"
          title="Set as primary image"
          aria-label="Set as primary image"
        >
          ★
        </button>
        <button
          onClick={onRemove}
          className="rounded-full bg-[var(--chrome-highlight-strong)] p-1 text-3xs text-status-danger hover:bg-status-danger/30"
          title="Remove from gallery"
          aria-label="Remove from gallery"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function ArticleArtSection({
  article,
  onImageChange,
  onGalleryChange,
  onSubjectsChange,
}: {
  article: Article;
  onImageChange: (image: string | undefined) => void;
  onGalleryChange: (gallery: string[] | undefined) => void;
  onSubjectsChange: (subjects: string[]) => void;
}) {
  const [showGalleryGenerator, setShowGalleryGenerator] = useState(false);
  const assetType = TEMPLATE_ASSET_TYPE[article.template] ?? "lore_location";
  const context: AssetContext = {
    zone: "lore",
    entity_type: `lore_${article.template}`,
    entity_id: article.id,
  };
  const galleryContext: AssetContext = {
    ...context,
    entity_id: `${article.id}_gallery`,
  };

  const gallery = article.gallery ?? [];

  const handleAddToGallery = (filename: string) => {
    onGalleryChange([...gallery, filename]);
  };

  const handleRemoveFromGallery = (index: number) => {
    const next = gallery.filter((_, i) => i !== index);
    onGalleryChange(next.length > 0 ? next : undefined);
  };

  const handlePromote = (index: number) => {
    const promoted = gallery[index];
    if (!promoted) return;
    const next = [...gallery];
    if (article.image) {
      next[index] = article.image;
    } else {
      next.splice(index, 1);
    }
    onImageChange(promoted);
    onGalleryChange(next.length > 0 ? next : undefined);
  };

  return (
    <Section title="Art" defaultExpanded={false}>
      <div className="flex flex-col gap-3">
        {/* Primary image */}
        <FieldRow label="Primary image">
          <TextInput
            value={article.image ?? ""}
            onCommit={(v) => onImageChange(v || undefined)}
            placeholder="None"
          />
        </FieldRow>
        <SceneSubjectsPicker article={article} onChange={onSubjectsChange} />
        <EntityArtGenerator
          getPrompt={(style) => getArticlePrompt(article, style)}
          entityContext={getArticleContext(article)}
          framingHint={getArticleFraming(article)}
          currentImage={article.image}
          onAccept={(filePath) => onImageChange(filePath)}
          assetType={assetType}
          context={context}
          surface="lore"
        />

        {/* Gallery */}
        <div className="mt-2 border-t border-[var(--chrome-stroke)] pt-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-2xs font-medium uppercase tracking-ui text-text-muted">
              Gallery{gallery.length > 0 ? ` (${gallery.length})` : ""}
            </p>
            <button
              onClick={() => setShowGalleryGenerator((v) => !v)}
              aria-expanded={showGalleryGenerator}
              className="rounded-full border border-[var(--chrome-stroke)] px-2 py-0.5 text-2xs text-text-secondary transition hover:border-[var(--chrome-stroke-strong)] hover:bg-[var(--chrome-highlight-strong)] hover:text-text-primary"
            >
              {showGalleryGenerator ? "Hide" : "Add Art"}
            </button>
          </div>

          {gallery.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {gallery.map((filename, i) => (
                <GalleryThumbnail
                  key={`${filename}-${i}`}
                  filename={filename}
                  onRemove={() => handleRemoveFromGallery(i)}
                  onPromote={() => handlePromote(i)}
                />
              ))}
            </div>
          )}

          {showGalleryGenerator && (
            <EntityArtGenerator
              getPrompt={(style) => getArticlePrompt(article, style)}
              entityContext={getArticleContext(article)}
              framingHint={getArticleFraming(article)}
              currentImage={undefined}
              onAccept={handleAddToGallery}
              assetType={assetType}
              context={galleryContext}
              surface="lore"
            />
          )}

          {gallery.length === 0 && !showGalleryGenerator && (
            <p className="text-2xs text-text-muted/60">
              No additional art. Click "Add Art" to generate gallery images.
            </p>
          )}
        </div>
      </div>
    </Section>
  );
}
