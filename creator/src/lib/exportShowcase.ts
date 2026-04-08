import type { WorldLore, Article, ArticleRelation } from "@/types/lore";
import type { Story } from "@/types/story";
import { extractMentions } from "@/lib/loreRelations";

// ─── Showcase data types ───────────────────────────────────────────

export interface ShowcaseData {
  meta: {
    worldName: string;
    tagline?: string;
    exportedAt: string;
    imageBaseUrl: string;
    showcase?: {
      navLogoText?: string;
      bannerTitle?: string;
      bannerSubtitle?: string;
      bannerImage?: string;
      faviconUrl?: string;
      accentColor?: string;
      bgColor?: string;
      footerText?: string;
    };
  };
  articles: ShowcaseArticle[];
  maps: ShowcaseMap[];
  calendarSystems: WorldLore["calendarSystems"];
  timelineEvents: WorldLore["timelineEvents"];
  colorLabels: WorldLore["colorLabels"];
  stories?: ShowcaseStory[];
}

export interface ShowcaseArticle {
  id: string;
  template: Article["template"];
  title: string;
  fields: Record<string, unknown>;
  contentHtml: string;
  tags: string[];
  relations: ArticleRelation[];
  imageUrl?: string;
  galleryUrls?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ShowcaseMap {
  id: string;
  title: string;
  imageUrl: string;
  width: number;
  height: number;
  pins: {
    id: string;
    articleId?: string;
    position: [number, number];
    label?: string;
    color?: string;
  }[];
}

// ─── TipTap JSON → HTML converter ─────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

function wrapMarks(html: string, marks?: TipTapMark[]): string {
  if (!marks || marks.length === 0) return html;
  let result = html;
  for (const mark of marks) {
    switch (mark.type) {
      case "bold":
        result = `<strong>${result}</strong>`;
        break;
      case "italic":
        result = `<em>${result}</em>`;
        break;
      case "code":
        result = `<code>${result}</code>`;
        break;
      case "link": {
        const href = escapeHtml(String(mark.attrs?.href ?? ""));
        const target = href.startsWith("http") ? ' target="_blank" rel="noopener noreferrer"' : "";
        result = `<a href="${href}"${target}>${result}</a>`;
        break;
      }
    }
  }
  return result;
}

function nodeToHtml(node: Record<string, unknown>): string {
  const type = node.type as string;
  const attrs = node.attrs as Record<string, unknown> | undefined;
  const content = node.content as Record<string, unknown>[] | undefined;
  const childrenHtml = content ? content.map(nodeToHtml).join("") : "";

  switch (type) {
    case "doc":
      return childrenHtml;

    case "paragraph":
      return `<p>${childrenHtml}</p>`;

    case "heading": {
      const level = Math.min(Math.max(Number(attrs?.level ?? 2), 1), 6);
      return `<h${level}>${childrenHtml}</h${level}>`;
    }

    case "text": {
      const text = escapeHtml(String(node.text ?? ""));
      return wrapMarks(text, node.marks as TipTapMark[] | undefined);
    }

    case "mention": {
      const id = String(attrs?.id ?? "");
      const label = escapeHtml(String(attrs?.label ?? id));
      return `<a href="/articles/${encodeURIComponent(id)}" class="mention">${label}</a>`;
    }

    case "bulletList":
      return `<ul>${childrenHtml}</ul>`;

    case "orderedList":
      return `<ol>${childrenHtml}</ol>`;

    case "listItem":
      return `<li>${childrenHtml}</li>`;

    case "blockquote":
      return `<blockquote>${childrenHtml}</blockquote>`;

    case "horizontalRule":
      return "<hr />";

    case "hardBreak":
      return "<br />";

    default:
      return childrenHtml;
  }
}

export function tiptapToHtml(content: string): string {
  if (!content) return "";
  if (!content.startsWith("{")) {
    // Plain text fallback — wrap in paragraphs
    return content
      .split(/\n\n+/)
      .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
      .join("");
  }
  try {
    const doc = JSON.parse(content);
    return nodeToHtml(doc);
  } catch {
    return `<p>${escapeHtml(content)}</p>`;
  }
}

// ─── Showcase story types ─────────────────────────────────────────

export interface ShowcaseSceneEntity {
  id: string;
  entityType: "mob" | "item" | "npc";
  entityId: string;
  name: string;
  imageUrl?: string;
  slot?: string;
  position?: { x: number; y: number };
  entrancePath?: string;
  exitPath?: string;
}

export interface ShowcaseScene {
  id: string;
  title: string;
  sortOrder: number;
  roomImageUrl?: string;
  narration?: string;
  narrationHtml?: string;
  transition?: { type: "crossfade" | "fade_black" };
  narrationSpeed?: "slow" | "normal" | "fast";
  entities: ShowcaseSceneEntity[];

  // ─── Lore links (showcase resolves these against its own article list) ──
  /** Featured article IDs — showcase looks them up in `articles[]`. */
  linkedArticleIds?: string[];
  linkedLocationArticleId?: string;
  linkedMapId?: string;
  linkedPinId?: string;
  linkedTimelineEventId?: string;

  // ─── Visual overlays ──────────────────────────────────────────────────
  titleCard?: { text: string; style?: "location" | "year" | "subtitle" | "character" };
  effects?: { particles?: string; parallaxLayers?: number; parallaxDepth?: number };
}

export interface ShowcaseStory {
  id: string;
  title: string;
  zoneId: string;
  zoneName?: string;
  coverImageUrl?: string;
  sceneCount: number;
  scenes: ShowcaseScene[];
  narrationSpeed?: "slow" | "normal" | "fast";
  createdAt: string;
  updatedAt: string;

  // ─── Story metadata ──────────────────────────────────────────────────
  synopsis?: string;
  tags?: string[];
  // draft is excluded from showcase by definition

  // ─── Story-level lore links ──────────────────────────────────────────
  linkedArticleIds?: string[];
  featuredCharacterIds?: string[];
  primaryMapId?: string;
  primaryCalendarId?: string;

  // ─── Exported cinematic (MP4 on R2) ──────────────────────────────────
  cinematicUrl?: string;
}

// ─── Story export context ─────────────────────────────────────────

export interface StoryExportContext {
  story: Story;
  zoneName: string;
  resolveRoomImage: (roomId: string) => string | undefined;
  resolveEntityName: (entityType: string, entityId: string) => string;
  resolveEntityImage: (entityType: string, entityId: string) => string | undefined;
}

/** Export stories to showcase format with resolved URLs and entity data. */
export function exportStories(
  contexts: StoryExportContext[],
  imageBaseUrl: string,
): ShowcaseStory[] {
  const baseUrl = imageBaseUrl.replace(/\/+$/, "");

  function resolveImageUrl(filename: string | undefined): string | undefined {
    if (!filename) return undefined;
    if (filename.startsWith("http")) return filename;
    return `${baseUrl}/${filename}`;
  }

  return contexts
    .filter(({ story }) => !story.draft) // Exclude drafts from showcase
    .map(({ story, zoneName, resolveRoomImage, resolveEntityName, resolveEntityImage }) => {
      const scenes: ShowcaseScene[] = story.scenes
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((scene) => ({
          id: scene.id,
          title: scene.title,
          sortOrder: scene.sortOrder,
          roomImageUrl: scene.roomId ? resolveImageUrl(resolveRoomImage(scene.roomId)) : undefined,
          narration: scene.narration,
          narrationHtml: scene.narration ? tiptapToHtml(scene.narration) : undefined,
          transition: scene.transition ? { type: scene.transition.type } : undefined,
          narrationSpeed: scene.narrationSpeed,
          entities: (scene.entities ?? []).map((e) => ({
            id: e.id,
            entityType: e.entityType,
            entityId: e.entityId,
            name: resolveEntityName(e.entityType, e.entityId),
            imageUrl: resolveImageUrl(resolveEntityImage(e.entityType, e.entityId)),
            slot: e.slot,
            position: e.position,
            entrancePath: e.entrancePath,
            exitPath: e.exitPath,
          })),
          // Lore links — showcase resolves IDs against articles[]/maps[]/timelineEvents[]
          linkedArticleIds: scene.linkedArticleIds,
          linkedLocationArticleId: scene.linkedLocationArticleId,
          linkedMapId: scene.linkedMapId,
          linkedPinId: scene.linkedPinId,
          linkedTimelineEventId: scene.linkedTimelineEventId,
          titleCard: scene.titleCard,
          effects: scene.effects,
        }));

      return {
        id: story.id,
        title: story.title,
        zoneId: story.zoneId,
        zoneName,
        coverImageUrl: resolveImageUrl(story.coverImage),
        sceneCount: scenes.length,
        scenes,
        narrationSpeed: story.narrationSpeed,
        createdAt: story.createdAt,
        updatedAt: story.updatedAt,
        synopsis: story.synopsis,
        tags: story.tags,
        linkedArticleIds: story.linkedArticleIds,
        featuredCharacterIds: story.featuredCharacterIds,
        primaryMapId: story.primaryMapId,
        primaryCalendarId: story.primaryCalendarId,
        cinematicUrl: story.cinematicUrl,
      };
    });
}

// ─── Export pipeline ───────────────────────────────────────────────

export function exportShowcaseData(
  lore: WorldLore,
  imageBaseUrl: string,
  stories?: ShowcaseStory[],
): ShowcaseData {
  const baseUrl = imageBaseUrl.replace(/\/+$/, "");

  function resolveImage(filename: string | undefined): string | undefined {
    if (!filename) return undefined;
    if (filename.startsWith("http")) return filename;
    return `${baseUrl}/${filename}`;
  }

  // Extract world metadata from world_setting article
  const ws = Object.values(lore.articles).find((a) => a.template === "world_setting");
  const worldName = (ws?.fields?.name as string) ?? ws?.title ?? "Untitled World";
  const tagline = (ws?.fields?.tagline as string) ?? undefined;

  // Convert articles (exclude drafts)
  const draftIds = new Set(
    Object.values(lore.articles).filter((a) => a.draft).map((a) => a.id),
  );
  const articles: ShowcaseArticle[] = Object.values(lore.articles)
    .filter((a) => !a.draft)
    .map((a) => {
    // Merge explicit relations + extracted mentions (strip refs to draft articles)
    const explicit = (a.relations ?? []).filter((r) => !draftIds.has(r.targetId));
    const mentions = extractMentions(a.content).filter((r) => !draftIds.has(r.targetId));
    const seenTargets = new Set(explicit.map((r) => `${r.targetId}:${r.type}`));
    const merged = [...explicit];
    for (const m of mentions) {
      const key = `${m.targetId}:${m.type}`;
      if (!seenTargets.has(key)) {
        seenTargets.add(key);
        merged.push(m);
      }
    }

    return {
      id: a.id,
      template: a.template,
      title: a.title,
      fields: a.fields,
      contentHtml: tiptapToHtml(a.content),
      tags: a.tags ?? [],
      relations: merged,
      imageUrl: resolveImage(a.image),
      galleryUrls: a.gallery?.length ? a.gallery.map(resolveImage).filter((u): u is string => !!u) : undefined,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  });

  // Convert maps
  const maps: ShowcaseMap[] = (lore.maps ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    imageUrl: resolveImage(m.imageAsset) ?? "",
    width: m.width,
    height: m.height,
    pins: m.pins.map((p) => ({
      id: p.id,
      articleId: p.articleId,
      position: p.position,
      label: p.label,
      color: p.color,
    })),
  }));

  return {
    meta: {
      worldName,
      tagline,
      exportedAt: new Date().toISOString(),
      imageBaseUrl: baseUrl,
      showcase: lore.showcaseSettings ? {
        ...lore.showcaseSettings,
        // Resolve asset filenames to full R2 URLs
        faviconUrl: resolveImage(lore.showcaseSettings.faviconUrl),
        bannerImage: resolveImage(lore.showcaseSettings.bannerImage),
      } : undefined,
    },
    articles,
    maps,
    calendarSystems: lore.calendarSystems,
    timelineEvents: (lore.timelineEvents ?? []).map(({ image, ...event }) => ({
      ...event,
      imageUrl: resolveImage(image),
    })),
    colorLabels: lore.colorLabels,
    stories,
  };
}
