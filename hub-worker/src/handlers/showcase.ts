import type { Env } from "../env";
import { listListedWorlds } from "../db";
import { error, json } from "../util";

// ─── GET /showcase.json (called on <slug>.arcanum-hub.com) ───────────
export async function serveShowcaseJson(env: Env, slug: string): Promise<Response> {
  const obj = await env.BUCKET.get(`worlds/${slug}/showcase.json`);
  if (!obj) return error(404, `No showcase published for "${slug}"`, { origin: "*" });

  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Cache-Control", "public, max-age=60, s-maxage=300");
  const etag = obj.httpEtag;
  if (etag) headers.set("ETag", etag);

  return new Response(obj.body, { status: 200, headers });
}

// ─── GET /worlds/<slug>/images/<hash>.webp ───────────────────────────
// Served by the Worker (or by R2 custom domain, if configured). The
// multi-tenant showcase SPA references images via the hub's custom
// domain, so this is a fallback when running on wrangler dev.
export async function serveImage(env: Env, slug: string, filename: string): Promise<Response> {
  if (!/^[a-f0-9]{64}\.webp$/.test(filename)) {
    return error(400, "Invalid image filename", { origin: "*" });
  }
  const obj = await env.BUCKET.get(`worlds/${slug}/images/${filename}`);
  if (!obj) return error(404, "Image not found", { origin: "*" });

  const headers = new Headers();
  headers.set("Content-Type", "image/webp");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  const etag = obj.httpEtag;
  if (etag) headers.set("ETag", etag);
  return new Response(obj.body, { status: 200, headers });
}

// ─── GET /api/index (public — for the hub landing page) ─────────────
export async function serveHubIndex(env: Env): Promise<Response> {
  const worlds = await listListedWorlds(env);
  return json(
    {
      worlds: worlds.map((w) => {
        // Tags are stored as a JSON string; parse defensively so a
        // malformed row can't crash the whole directory fetch.
        let tags: string[] = [];
        if (w.tags) {
          try {
            const parsed = JSON.parse(w.tags);
            if (Array.isArray(parsed)) {
              tags = parsed.filter((t): t is string => typeof t === "string");
            }
          } catch {
            tags = [];
          }
        }
        const coverImageUrl = w.cover_image_hash
          ? `https://${w.slug}.${env.HUB_ROOT_DOMAIN}/images/${w.cover_image_hash}.webp`
          : null;
        return {
          slug: w.slug,
          displayName: w.display_name ?? w.slug,
          tagline: w.tagline,
          lastPublishAt: w.last_publish_at,
          url: `https://${w.slug}.${env.HUB_ROOT_DOMAIN}/`,
          articleCount: w.article_count,
          mapCount: w.map_count,
          imageCount: w.image_count,
          coverImageUrl,
          tags,
          authorDisplayName: w.author_display_name,
          description: w.description,
        };
      }),
    },
    {},
    { origin: "*" },
  );
}
