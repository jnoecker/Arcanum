// ─── Showcase metadata extractor ────────────────────────────────────
//
// On each publish the hub re-reads the uploaded showcase.json and
// derives discovery metadata — article/map/image counts, tags, a
// representative cover image hash, and a short description. The
// results are written to the `worlds` row so the landing page and
// OG-tag injector can read them without re-parsing every manifest.
//
// Runs on the worker after the manifest is uploaded to R2. The input
// is the same payload the creator sent in `POST /publish/manifest`,
// loosely typed because we validate fields defensively before use.

const MAX_TAGS = 20;
const MAX_DESCRIPTION_LEN = 280;

export interface ExtractedMetadata {
  article_count: number;
  map_count: number;
  image_count: number;
  cover_image_hash: string | null;
  tags: string | null;
  description: string | null;
}

/**
 * Pull the `<hash>` from any URL of the form
 * `.../images/<64-hex>.webp`. Returns null for anything else so that
 * legacy absolute URLs (e.g. from self-hosted builds re-published to
 * the hub) don't poison the metadata.
 */
function extractImageHash(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const m = /\/images\/([a-f0-9]{64})\.webp(?:[?#].*)?$/i.exec(url);
  return m && m[1] ? m[1].toLowerCase() : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/**
 * Strip HTML tags and collapse whitespace to produce a plain-text
 * snippet for card descriptions / OG meta. We do the bare minimum —
 * removing tags and decoding a handful of common entities — because
 * the source is already sanitized HTML from TipTap.
 */
function htmlToPlain(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > max - 40 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trimEnd()}…`;
}

export function extractMetadata(showcase: unknown): ExtractedMetadata {
  const root = asRecord(showcase) ?? {};
  const articles = asArray(root.articles);
  const maps = asArray(root.maps);
  const meta = asRecord(root.meta) ?? {};
  const branding = asRecord(meta.showcase) ?? {};

  // ─── Counts ──────────────────────────────────────────────────────
  const article_count = articles.length;
  const map_count = maps.length;

  // ─── Image set ───────────────────────────────────────────────────
  // Collect every content-addressed hash referenced by the manifest.
  // `image_count` is the unique-hash count, not the number of URLs,
  // so articles that share an image don't inflate the number.
  const imageHashes = new Set<string>();
  for (const art of articles) {
    const a = asRecord(art);
    if (!a) continue;
    const primary = extractImageHash(a.imageUrl);
    if (primary) imageHashes.add(primary);
    for (const g of asArray(a.galleryUrls)) {
      const h = extractImageHash(g);
      if (h) imageHashes.add(h);
    }
  }
  for (const m of maps) {
    const mr = asRecord(m);
    if (!mr) continue;
    const h = extractImageHash(mr.imageUrl);
    if (h) imageHashes.add(h);
  }
  const bannerHash = extractImageHash(branding.bannerImage);
  if (bannerHash) imageHashes.add(bannerHash);
  const image_count = imageHashes.size;

  // ─── Cover image ─────────────────────────────────────────────────
  // Priority: explicit banner > first article image > first map image.
  // Null when the world has no usable image — the landing page falls
  // back to a placeholder card in that case.
  let cover_image_hash: string | null = bannerHash;
  if (!cover_image_hash) {
    for (const art of articles) {
      const a = asRecord(art);
      if (!a) continue;
      const h = extractImageHash(a.imageUrl);
      if (h) {
        cover_image_hash = h;
        break;
      }
    }
  }
  if (!cover_image_hash) {
    for (const m of maps) {
      const mr = asRecord(m);
      if (!mr) continue;
      const h = extractImageHash(mr.imageUrl);
      if (h) {
        cover_image_hash = h;
        break;
      }
    }
  }

  // ─── Tags ────────────────────────────────────────────────────────
  // Aggregate article tags (case-insensitive dedupe, cap at MAX_TAGS).
  // Order is first-seen — common tags from world_setting / character
  // articles tend to appear first, which is the ordering we want.
  const seen = new Set<string>();
  const tagList: string[] = [];
  for (const art of articles) {
    const a = asRecord(art);
    if (!a) continue;
    for (const t of asArray(a.tags)) {
      if (typeof t !== "string") continue;
      const trimmed = t.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tagList.push(trimmed);
      if (tagList.length >= MAX_TAGS) break;
    }
    if (tagList.length >= MAX_TAGS) break;
  }
  const tags = tagList.length > 0 ? JSON.stringify(tagList) : null;

  // ─── Description ─────────────────────────────────────────────────
  // Prefer meta.tagline (the creator's intentional one-liner). Fall
  // back to the first world_setting article's rendered content, then
  // any article with content. Always truncated.
  let description: string | null = asString(meta.tagline);
  if (!description) {
    const pickFrom = (predicate: (a: Record<string, unknown>) => boolean): string | null => {
      for (const art of articles) {
        const a = asRecord(art);
        if (!a || !predicate(a)) continue;
        const html = asString(a.contentHtml);
        if (!html) continue;
        const plain = htmlToPlain(html);
        if (plain) return truncate(plain, MAX_DESCRIPTION_LEN);
      }
      return null;
    };
    description =
      pickFrom((a) => a.template === "world_setting") ?? pickFrom(() => true);
  } else {
    description = truncate(description, MAX_DESCRIPTION_LEN);
  }

  return {
    article_count,
    map_count,
    image_count,
    cover_image_hash,
    tags,
    description,
  };
}
