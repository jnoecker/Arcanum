import type {
  Article,
  ArticleSection,
  ArticleSectionType,
  RichTextSection,
  ImageSection,
  GallerySection,
} from "@/types/lore";

/** Generate a stable-ish section id. */
export function newSectionId(): string {
  return `sec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Return the article's sections, synthesizing a default layout from the
 * legacy single-blob `content` + article-level `image`/`gallery` when the
 * article was created before the section model existed.
 *
 * This is a pure read helper — it does not mutate the article. Callers that
 * need to persist the migrated layout should set `article.sections` once on
 * first edit (see `ensureSections` below).
 */
export function getEffectiveSections(article: Article): ArticleSection[] {
  if (article.sections && article.sections.length > 0) {
    return article.sections;
  }
  return synthesizeLegacySections(article);
}

/**
 * One-time migration: ensure `article.sections` is populated and contains a
 * required Visage image section. If sections already exist but no Visage is
 * present (e.g. an article created before the Visage requirement landed),
 * a Visage section is prepended.
 */
export function ensureSections(article: Article): Article {
  if (!article.sections || article.sections.length === 0) {
    return { ...article, sections: synthesizeLegacySections(article) };
  }
  const hasVisage = article.sections.some((s) => s.type === "image" && s.required);
  if (hasVisage) return article;
  const visage: ImageSection = {
    id: newSectionId(),
    type: "image",
    title: "Visage",
    required: true,
    ...(article.image ? { primary: article.image } : {}),
  };
  return { ...article, sections: [visage, ...article.sections] };
}

function synthesizeLegacySections(article: Article): ArticleSection[] {
  const sections: ArticleSection[] = [];

  sections.push({
    id: newSectionId(),
    type: "image",
    title: "Visage",
    required: true,
    ...(article.image ? { primary: article.image } : {}),
  });

  if (article.content && article.content.trim()) {
    sections.push({
      id: newSectionId(),
      type: "richtext",
      title: "Overview",
      body: article.content,
    });
  } else {
    sections.push({
      id: newSectionId(),
      type: "richtext",
      title: "Overview",
      body: "",
    });
  }

  if (article.gallery && article.gallery.length > 0) {
    sections.push({
      id: newSectionId(),
      type: "gallery",
      title: "Gallery",
      images: [...article.gallery],
      primary: article.gallery[0],
    });
  }

  if (article.privateNotes && article.privateNotes.trim()) {
    sections.push({
      id: newSectionId(),
      type: "richtext",
      title: "Creator's Notes",
      body: article.privateNotes,
      private: true,
    });
  }

  return sections;
}

/** Construct a new empty section of the given type. */
export function makeSection(type: ArticleSectionType): ArticleSection {
  const id = newSectionId();
  if (type === "richtext") {
    const s: RichTextSection = { id, type: "richtext", title: "New Section", body: "" };
    return s;
  }
  if (type === "image") {
    const s: ImageSection = { id, type: "image", title: "New Visage" };
    return s;
  }
  const s: GallerySection = { id, type: "gallery", title: "New Gallery", images: [] };
  return s;
}

/**
 * Strip HTML tags from TipTap-rendered content for word-counting / preview
 * purposes. Cheap and lossy — fine for rail meta lines.
 */
export function plainTextFromBody(body: string): string {
  if (!body) return "";
  // TipTap content might be JSON or HTML; both contain text we can extract.
  const stripped = body
    .replace(/<[^>]+>/g, " ")
    .replace(/[{}\[\]"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped;
}

/** Word count across all richtext sections (skips private sections). */
export function totalWordCount(sections: ArticleSection[]): number {
  let n = 0;
  for (const s of sections) {
    if (s.private) continue;
    if (s.type !== "richtext") continue;
    const text = plainTextFromBody(s.body);
    if (text) n += text.split(/\s+/).length;
  }
  return n;
}

/** All image filenames referenced by sections (primary + gallery). */
export function collectSectionImages(sections: ArticleSection[]): string[] {
  const out: string[] = [];
  for (const s of sections) {
    if (s.type === "image" && s.primary) out.push(s.primary);
    if (s.type === "gallery") out.push(...s.images);
  }
  return out;
}
