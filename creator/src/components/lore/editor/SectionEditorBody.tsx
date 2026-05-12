import { useMemo, useState } from "react";
import type {
  Article,
  ArticleSection,
  GallerySection,
  ImageSection,
  RichTextSection,
} from "@/types/lore";
import { useImageSrc } from "@/lib/useImageSrc";
import { LoreEditor, type LoreEditorAction } from "@/components/lore/LoreEditor";
import { EntityArtGenerator } from "@/components/ui/EntityArtGenerator";
import { buildRagContext } from "@/lib/rag/loreContext";
import { buildWorldContext } from "@/lib/loreGeneration";
import { getCodexGeneratePrompt } from "@/lib/lorePrompts";
import {
  getArticlePrompt,
  getArticleContext,
  getArticleFraming,
  TEMPLATE_ASSET_TYPE,
} from "@/lib/loreArtPrompts";
import type { AssetContext } from "@/types/assets";

interface SectionEditorBodyProps {
  article: Article;
  section: ArticleSection;
  onChange: (patch: Partial<ArticleSection>) => void;
  onPick: (mode: "single" | "multi") => void;
  onTogglePrivate: () => void;
}

/**
 * Build an RAG-backed context callback scoped to the article and section.
 * The query varies by action so retrieval targets the right neighborhood
 * of lore: "Write the X section of article Y" for generate, the prose
 * itself for enhance/continue. Falls back to the legacy world summary
 * when the index is empty or retrieval errors.
 */
function makeSectionContextProvider(
  article: Article,
  sectionTitle: string,
): (action: LoreEditorAction, text: string) => Promise<string> {
  return async (action, text) => {
    const query =
      action === "generate"
        ? `${article.title} — ${sectionTitle || "section"}`
        : (text.slice(0, 800) || article.title);
    const { context } = await buildRagContext({
      query,
      excludeSourceIds: [article.id],
      fallback: () => buildWorldContext().slice(0, 1500),
    });
    return context;
  };
}

function labelForType(t: ArticleSection["type"]): string {
  if (t === "richtext") return "Rich Text";
  if (t === "image") return "Image · Caption";
  return "Gallery";
}

// ─── Rich text variant ─────────────────────────────────────────────

function RichTextSectionEditor({
  article,
  section,
  onChange,
}: {
  article: Article;
  section: RichTextSection;
  onChange: (patch: Partial<RichTextSection>) => void;
}) {
  const getContext = useMemo(
    () => makeSectionContextProvider(article, section.title || ""),
    [article, section.title],
  );
  return (
    <div className="ae-prose">
      <LoreEditor
        value={section.body}
        onCommit={(json) => onChange({ body: json })}
        placeholder={`Write the ${section.title || "section"}...`}
        generateSystemPrompt={getCodexGeneratePrompt()}
        generateUserPrompt={`Write the "${section.title || "Untitled"}" section of the lore article titled "${article.title}".`}
        getActionContext={getContext}
      />
    </div>
  );
}

// ─── Image · Caption variant ───────────────────────────────────────

function ImageThumb({ filename }: { filename: string }) {
  const src = useImageSrc(filename);
  if (!src) return null;
  return <img src={src} alt="" loading="lazy" />;
}

function ImageSectionEditor({
  article,
  section,
  onChange,
  onPick,
}: {
  article: Article;
  section: ImageSection;
  onChange: (patch: Partial<ImageSection>) => void;
  onPick: (mode: "single" | "multi") => void;
}) {
  const [forgeOpen, setForgeOpen] = useState(false);
  const assetType = TEMPLATE_ASSET_TYPE[article.template] ?? "lore_location";
  const context: AssetContext = {
    zone: "lore",
    entity_type: `lore_${article.template}`,
    entity_id: article.id,
  };

  const hasImage = !!section.primary;
  return (
    <div className="ae-imgsec">
      <div
        className="ae-imgsec__art"
        data-empty={!hasImage || undefined}
        // Only the empty-state behaves as one big click target. With an image
        // set, the overlay's two explicit buttons handle the action.
        onClick={!hasImage ? () => onPick("single") : undefined}
        role={!hasImage ? "button" : undefined}
        tabIndex={!hasImage ? 0 : undefined}
        aria-label={!hasImage ? "Choose image from archive" : undefined}
        onKeyDown={
          !hasImage
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onPick("single");
                }
              }
            : undefined
        }
      >
        {hasImage ? (
          <ImageThumb filename={section.primary!} />
        ) : (
          <div className="ae-imgsec__empty">
            <span className="ae-imgsec__empty__sigil" aria-hidden>◇</span>
            <span>Awaiting your command</span>
            <span className="ae-imgsec__empty__sub">
              Click to choose an image from the Forge's archive, or conjure a new one below.
            </span>
          </div>
        )}
        <div className="ae-imgsec__art__overlay">
          {hasImage ? (
            <>
              <button
                type="button"
                className="ae-imgsec__art__action"
                onClick={(e) => {
                  e.stopPropagation();
                  onPick("single");
                }}
              >
                From Archive
              </button>
              <button
                type="button"
                className="ae-imgsec__art__action"
                onClick={(e) => {
                  e.stopPropagation();
                  setForgeOpen(true);
                }}
              >
                Conjure New
              </button>
            </>
          ) : (
            <span className="ae-imgsec__art__cta">Choose from archive</span>
          )}
        </div>
      </div>

      <input
        type="text"
        className="ae-imgsec__caption"
        value={section.caption ?? ""}
        placeholder="A line of caption — what is shown, who painted it, what it means."
        onChange={(e) => onChange({ caption: e.target.value || undefined })}
        aria-label="Image caption"
      />

      <div className="ae-aibar ae-aibar--flush">
        <span className="ae-aibar__label">The Forge</span>
        <span className="ae-aibar__copy">
          {section.primary
            ? "Image set. Replace from the archive, conjure a new one, or clear it."
            : "No image yet. Pick one already summoned, or conjure a new one in the Forge."}
        </span>
        <button type="button" onClick={() => onPick("single")}>
          {section.primary ? "Replace" : "From Archive"}
        </button>
        <button
          type="button"
          onClick={() => setForgeOpen((v) => !v)}
          aria-expanded={forgeOpen}
        >
          {forgeOpen ? "Close Forge" : "Conjure New"}
        </button>
        {section.primary && (
          <button type="button" onClick={() => onChange({ primary: undefined })}>
            Clear
          </button>
        )}
      </div>

      {forgeOpen && (
        <div className="ae-forge-panel">
          <div className="ae-forge-panel__head">
            <span className="ae-forge-panel__title">The Forge</span>
            <button
              type="button"
              className="ae-forge-panel__close"
              onClick={() => setForgeOpen(false)}
              aria-label="Close Forge"
            >
              ×
            </button>
          </div>
          <EntityArtGenerator
            getPrompt={(style) => getArticlePrompt(article, style)}
            entityContext={getArticleContext(article)}
            framingHint={getArticleFraming(article)}
            currentImage={section.primary}
            onAccept={(filePath) => onChange({ primary: filePath })}
            assetType={assetType}
            context={context}
            surface="lore"
          />
        </div>
      )}
    </div>
  );
}

// ─── Gallery variant ───────────────────────────────────────────────

function GalleryTile({
  filename,
  isPrimary,
  onSetPrimary,
  onRemove,
}: {
  filename: string;
  isPrimary: boolean;
  onSetPrimary: () => void;
  onRemove: () => void;
}) {
  const src = useImageSrc(filename);
  return (
    <div
      className="ae-gtile"
      data-primary={isPrimary || undefined}
      onClick={onSetPrimary}
      role="button"
      tabIndex={0}
      title={isPrimary ? "Primary image" : "Click to make primary"}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSetPrimary();
        }
      }}
    >
      {src ? <img src={src} alt="" loading="lazy" /> : null}
      {isPrimary && <span className="ae-gtile__primary">Primary</span>}
      <button
        type="button"
        className="ae-gtile__remove"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label="Remove from gallery"
        title="Remove from this gallery (image stays in archive)"
      >
        ×
      </button>
    </div>
  );
}

function GallerySectionEditor({
  article,
  section,
  onChange,
  onPick,
}: {
  article: Article;
  section: GallerySection;
  onChange: (patch: Partial<GallerySection>) => void;
  onPick: (mode: "single" | "multi") => void;
}) {
  const [forgeOpen, setForgeOpen] = useState(false);
  const assetType = TEMPLATE_ASSET_TYPE[article.template] ?? "lore_location";
  // Gallery images bucket under a separate entity_id so they don't collide
  // with the article's "primary" art for variant grouping.
  const galleryContext: AssetContext = {
    zone: "lore",
    entity_type: `lore_${article.template}`,
    entity_id: `${article.id}_${section.id}`,
  };

  const images = section.images;
  const setPrimary = (filename: string) => onChange({ primary: filename });
  const remove = (filename: string) => {
    const next = images.filter((x) => x !== filename);
    onChange({
      images: next,
      primary: section.primary === filename ? (next[0] ?? undefined) : section.primary,
    });
  };
  const append = (filename: string) => {
    if (images.includes(filename)) return;
    const next = [...images, filename];
    onChange({ images: next, primary: section.primary ?? next[0] });
  };

  return (
    <div>
      {images.length === 0 ? (
        <div className="ae-gallery__empty">
          <div className="ae-gallery__empty__title">The Gallery is Empty</div>
          <p className="ae-gallery__empty__copy">
            Choose images already summoned for this world. The same image can sit in many sections at once.
          </p>
          <button
            className="ae-btn"
            data-variant="ember"
            type="button"
            onClick={() => onPick("multi")}
          >
            Open Archive
          </button>
        </div>
      ) : (
        <div className="ae-gallery">
          {images.map((filename) => (
            <GalleryTile
              key={filename}
              filename={filename}
              isPrimary={section.primary === filename}
              onSetPrimary={() => setPrimary(filename)}
              onRemove={() => remove(filename)}
            />
          ))}
          <button
            type="button"
            className="ae-gallery__add"
            onClick={() => onPick("multi")}
          >
            <span className="ae-gallery__add__plus">+</span>
            From Archive
          </button>
        </div>
      )}

      {images.length > 0 && (
        <div className="ae-aibar">
          <span className="ae-aibar__label">Gallery</span>
          <span className="ae-aibar__copy">
            <em>{images.length}</em> {images.length === 1 ? "image" : "images"}.
            {section.primary && (
              <>
                {" "}First on export: <em>{section.primary}</em>.
              </>
            )}
            {" "}Click any tile to set primary.
          </span>
          <button type="button" onClick={() => onPick("multi")}>Add More</button>
          <button
            type="button"
            onClick={() => setForgeOpen((v) => !v)}
            aria-expanded={forgeOpen}
          >
            {forgeOpen ? "Close Forge" : "Conjure New"}
          </button>
        </div>
      )}

      {forgeOpen && (
        <div className="ae-forge-panel">
          <div className="ae-forge-panel__head">
            <span className="ae-forge-panel__title">The Forge — Gallery</span>
            <button
              type="button"
              className="ae-forge-panel__close"
              onClick={() => setForgeOpen(false)}
              aria-label="Close Forge"
            >
              ×
            </button>
          </div>
          <EntityArtGenerator
            getPrompt={(style) => getArticlePrompt(article, style)}
            entityContext={getArticleContext(article)}
            framingHint={getArticleFraming(article)}
            currentImage={undefined}
            onAccept={(filePath) => append(filePath)}
            assetType={assetType}
            context={galleryContext}
            surface="lore"
          />
        </div>
      )}
    </div>
  );
}

// ─── Router ────────────────────────────────────────────────────────

export function SectionEditorBody({
  article,
  section,
  onChange,
  onPick,
  onTogglePrivate,
}: SectionEditorBodyProps) {
  return (
    <div className="ae-editor ae-fade-in" key={section.id}>
      <div className="ae-editor__head">
        <div className="ae-trunc-flex">
          <div className="ae-editor__pretitle">
            <span>Section</span>
            <span className="ae-editor__pretitle__sep">·</span>
            <span className="ae-editor__pretitle__type">{labelForType(section.type)}</span>
          </div>
          <input
            className="ae-editor__title"
            value={section.title ?? ""}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Untitled section"
            aria-label="Section title"
          />
        </div>
        <button
          type="button"
          className="ae-editor__visibility"
          data-private={section.private || undefined}
          onClick={onTogglePrivate}
          title="Toggle whether this section appears on the showcase"
        >
          {section.private ? "Creator's eyes only" : "Published to showcase"}
        </button>
      </div>

      {section.type === "richtext" && (
        <RichTextSectionEditor
          article={article}
          section={section}
          onChange={onChange as (patch: Partial<RichTextSection>) => void}
        />
      )}
      {section.type === "image" && (
        <ImageSectionEditor
          article={article}
          section={section}
          onChange={onChange as (patch: Partial<ImageSection>) => void}
          onPick={onPick}
        />
      )}
      {section.type === "gallery" && (
        <GallerySectionEditor
          article={article}
          section={section}
          onChange={onChange as (patch: Partial<GallerySection>) => void}
          onPick={onPick}
        />
      )}
    </div>
  );
}
