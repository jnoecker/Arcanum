// ─── OpenGraph / Twitter meta injection ─────────────────────────────
//
// Crawlers (Discord, Slack, Twitter, etc.) render the link preview
// from the `<meta property="og:*">` tags they find in the first HTTP
// response. They don't execute JavaScript, so whatever the SPA puts
// in the DOM later is invisible to them. This module intercepts the
// showcase SPA's HTML response and rewrites the static meta tags
// with world-specific (or article-specific) values using Workers'
// HTMLRewriter streaming API.
//
// Runs only on world-mode hosts (`<slug>.<root>`). The landing page
// at the apex keeps its static meta tags — the hub directory itself
// doesn't need per-URL previews.
//
// Two tiers of detail:
//   - World root (`/`) and unrecognised SPA paths: data from D1.
//     Fast, no R2 read.
//   - Article routes (`/articles/<id>`): fetch showcase.json once
//     to resolve the article's title and image. Crawlers hit these
//     at low QPS and Cloudflare caches the manifest anyway, so the
//     added latency is acceptable.

import type { Env } from "./env";
import type { WorldRow } from "./db";

interface OgMeta {
  title: string;
  description: string;
  imageUrl: string | null;
  url: string;
  type: "website" | "article";
  siteName: string;
}

/**
 * Escape a string for safe embedding inside an HTML attribute value.
 * Only the characters that can break out of a double-quoted attribute
 * need handling — the output is always placed in `content="..."`.
 */
function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const slice = s.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > max - 40 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trimEnd()}…`;
}

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

// ─── Meta builders ──────────────────────────────────────────────────

function buildWorldMeta(env: Env, world: WorldRow): OgMeta {
  const name = world.display_name ?? world.slug;
  const description =
    world.description ??
    world.tagline ??
    `Explore ${name} — a world built in Arcanum.`;
  const imageUrl = world.cover_image_hash
    ? `https://${world.slug}.${env.HUB_ROOT_DOMAIN}/images/${world.cover_image_hash}.webp`
    : null;
  return {
    title: name,
    description: truncate(description, 280),
    imageUrl,
    url: `https://${world.slug}.${env.HUB_ROOT_DOMAIN}/`,
    type: "website",
    siteName: "Arcanum Hub",
  };
}

interface ShowcaseArticleShape {
  id?: unknown;
  title?: unknown;
  contentHtml?: unknown;
  imageUrl?: unknown;
  fields?: unknown;
}

async function buildArticleMeta(
  env: Env,
  world: WorldRow,
  articleId: string,
): Promise<OgMeta> {
  const fallback = buildWorldMeta(env, world);
  try {
    const obj = await env.BUCKET.get(`worlds/${world.slug}/showcase.json`);
    if (!obj) return fallback;
    const data = (await obj.json()) as { articles?: unknown };
    const articles = Array.isArray(data.articles) ? data.articles : [];
    const article = articles.find(
      (a): a is ShowcaseArticleShape =>
        a != null && typeof a === "object" && (a as ShowcaseArticleShape).id === articleId,
    );
    if (!article) return fallback;

    const title = typeof article.title === "string" ? article.title : fallback.title;
    const contentHtml = typeof article.contentHtml === "string" ? article.contentHtml : "";
    const plain = htmlToPlain(contentHtml);
    const description = plain
      ? truncate(plain, 280)
      : `An article from ${fallback.title}.`;
    const articleImage =
      typeof article.imageUrl === "string" && article.imageUrl.length > 0
        ? article.imageUrl
        : fallback.imageUrl;

    return {
      title: `${title} — ${fallback.title}`,
      description,
      imageUrl: articleImage,
      url: `https://${world.slug}.${env.HUB_ROOT_DOMAIN}/articles/${articleId}`,
      type: "article",
      siteName: "Arcanum Hub",
    };
  } catch {
    return fallback;
  }
}

// ─── Rewriter ───────────────────────────────────────────────────────

/**
 * Entry point used by the Worker for every world-mode request that
 * isn't `/showcase.json` or `/images/*`. Returns the original
 * response unchanged when it isn't HTML or when the world isn't
 * known (so SPA routes for unpublished slugs still render).
 */
export async function injectOgForWorld(
  req: Request,
  env: Env,
  world: WorldRow,
): Promise<Response> {
  const response = await env.ASSETS.fetch(req);
  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().includes("text/html")) return response;

  const url = new URL(req.url);
  const articleMatch = /^\/articles\/([a-zA-Z0-9_-]+)\/?$/.exec(url.pathname);
  const meta = articleMatch && articleMatch[1]
    ? await buildArticleMeta(env, world, articleMatch[1])
    : buildWorldMeta(env, world);

  return rewriteMeta(response, meta);
}

function rewriteMeta(response: Response, meta: OgMeta): Response {
  const injected = buildMetaBlock(meta);

  const rewriter = new HTMLRewriter()
    // Replace <title> contents directly so tab titles and crawler
    // fallbacks both pick up the world/article name.
    .on("title", {
      element(el) {
        el.setInnerContent(escapeText(meta.title));
      },
    })
    // Strip any pre-existing og:*, twitter:*, and description meta
    // tags from the shipped index.html. The appended block below is
    // authoritative so we don't end up with conflicting values.
    .on('meta[name="description"]', {
      element(el) {
        el.remove();
      },
    })
    .on('meta[property^="og:"]', {
      element(el) {
        el.remove();
      },
    })
    .on('meta[name^="twitter:"]', {
      element(el) {
        el.remove();
      },
    })
    .on("head", {
      element(el) {
        el.append(injected, { html: true });
      },
    });

  // Build fresh headers — HTMLRewriter streams the body, and we want
  // to bust any cache that might have stored the pre-rewrite bytes.
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "public, max-age=60, s-maxage=300");
  headers.delete("ETag");
  headers.delete("Last-Modified");

  return rewriter.transform(
    new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    }),
  );
}

function buildMetaBlock(meta: OgMeta): string {
  const cardType = meta.imageUrl ? "summary_large_image" : "summary";
  const parts: string[] = [
    `<meta name="description" content="${escapeAttr(meta.description)}" />`,
    `<meta property="og:site_name" content="${escapeAttr(meta.siteName)}" />`,
    `<meta property="og:title" content="${escapeAttr(meta.title)}" />`,
    `<meta property="og:description" content="${escapeAttr(meta.description)}" />`,
    `<meta property="og:url" content="${escapeAttr(meta.url)}" />`,
    `<meta property="og:type" content="${meta.type}" />`,
    `<meta name="twitter:card" content="${cardType}" />`,
    `<meta name="twitter:title" content="${escapeAttr(meta.title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(meta.description)}" />`,
  ];
  if (meta.imageUrl) {
    parts.push(`<meta property="og:image" content="${escapeAttr(meta.imageUrl)}" />`);
    parts.push(`<meta name="twitter:image" content="${escapeAttr(meta.imageUrl)}" />`);
  }
  return parts.join("\n");
}
