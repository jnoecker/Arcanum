import { useState } from "react";
import type { Article } from "@/types/lore";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import { Section, FieldRow, TextInput } from "@/components/ui/FormWidgets";
import { getArticlePrompt, getArticleContext, TEMPLATE_ASSET_TYPE } from "@/lib/loreArtPrompts";
import { useImageSrc } from "@/lib/useImageSrc";
import type { AssetContext } from "@/types/assets";

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
    <div className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/20">
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-2xs text-text-muted">...</div>
      )}
      <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/60 opacity-0 transition group-hover:opacity-100">
        <button
          onClick={onPromote}
          className="rounded-full bg-white/15 p-1 text-3xs text-text-primary hover:bg-white/25"
          title="Set as primary image"
          aria-label="Set as primary image"
        >
          ★
        </button>
        <button
          onClick={onRemove}
          className="rounded-full bg-white/15 p-1 text-3xs text-status-danger hover:bg-status-danger/30"
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
}: {
  article: Article;
  onImageChange: (image: string | undefined) => void;
  onGalleryChange: (gallery: string[] | undefined) => void;
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
        <EntityArtGenerator
          getPrompt={(style) => getArticlePrompt(article, style)}
          entityContext={getArticleContext(article)}
          currentImage={article.image}
          onAccept={(filePath) => onImageChange(filePath)}
          assetType={assetType}
          context={context}
        />

        {/* Gallery */}
        <div className="mt-2 border-t border-white/8 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-2xs font-medium uppercase tracking-ui text-text-muted">
              Gallery{gallery.length > 0 ? ` (${gallery.length})` : ""}
            </p>
            <button
              onClick={() => setShowGalleryGenerator((v) => !v)}
              className="rounded-full border border-white/8 px-2 py-0.5 text-2xs text-text-secondary transition hover:border-white/14 hover:bg-white/8 hover:text-text-primary"
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
              currentImage={undefined}
              onAccept={handleAddToGallery}
              assetType={assetType}
              context={galleryContext}
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
