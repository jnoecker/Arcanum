import type { Env } from "./env";
import { authenticateUser, isAdmin } from "./auth";
import { handleAdmin, adminCorsHeaders } from "./handlers/admin";
import { checkExisting, uploadImage, uploadManifest } from "./handlers/publish";
import { serveHubIndex, serveImage, serveShowcaseJson } from "./handlers/showcase";
import { corsHeaders, error, parseHost, preflight } from "./util";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const host = parseHost(url.hostname, env.HUB_ROOT_DOMAIN);

    // ─── Development fallback ────────────────────────────────────────
    // When running on wrangler dev or any non-hub host, fall back to
    // path-based routing so everything is reachable from 127.0.0.1:8787.
    //
    //   /api/*                → api handlers
    //   /dev/world/<slug>/... → world handlers
    //   /api/index            → listed worlds (landing data)
    //   /                     → "it works" page
    if (host.kind === "unknown") {
      return await routeDev(req, env, url);
    }

    // ─── Production routing by host ──────────────────────────────────
    if (host.kind === "api") {
      return await routeApi(req, env, url.pathname);
    }

    if (host.kind === "root") {
      // Landing page: the Worker serves the showcase SPA bundle from
      // the ASSETS binding. `/api/index` is intercepted here so the
      // SPA can fetch the listed-worlds directory.
      if (url.pathname === "/api/index") {
        if (req.method === "OPTIONS") return preflight({ origin: "*" });
        return await serveHubIndex(env);
      }
      return await env.ASSETS.fetch(req);
    }

    if (host.kind === "world" && host.slug) {
      if (url.pathname === "/showcase.json") {
        if (req.method === "OPTIONS") return preflight({ origin: "*" });
        return await serveShowcaseJson(env, host.slug);
      }
      const imageMatch = /^\/images\/([a-f0-9]{64}\.webp)$/.exec(url.pathname);
      if (imageMatch && imageMatch[1]) {
        return await serveImage(env, host.slug, imageMatch[1]);
      }
      // Everything else on <slug>.arcanum.ambon.dev is an SPA route —
      // the bundled index.html boots the showcase app, which then
      // fetches /showcase.json from this same origin.
      return await env.ASSETS.fetch(req);
    }

    return error(404, "Unknown host", { origin: "*" });
  },
} satisfies ExportedHandler<Env>;

// ─── /api/* router (production: api.hub.arcanum.app) ───────────────

async function routeApi(req: Request, env: Env, pathname: string): Promise<Response> {
  // Admin endpoints
  if (pathname.startsWith("/admin/")) {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: adminCorsHeaders(env) });
    }
    if (!isAdmin(req, env)) {
      return error(401, "Admin key required", { origin: env.ADMIN_ORIGIN });
    }
    return await handleAdmin(req, env, pathname);
  }

  // Publish endpoints
  if (pathname.startsWith("/publish/")) {
    if (req.method === "OPTIONS") return preflight({ origin: "*" });
    const user = await authenticateUser(req, env);
    if (!user) return error(401, "API key required", { origin: "*" });

    if (pathname === "/publish/check-existing" && req.method === "POST") {
      return await checkExisting(req, env, user);
    }
    if (pathname === "/publish/manifest" && req.method === "POST") {
      return await uploadManifest(req, env, user);
    }
    if (pathname.startsWith("/publish/image/") && req.method === "PUT") {
      return await uploadImage(req, env, user);
    }
    return error(404, "Not found", { origin: "*" });
  }

  // Public endpoints
  if (pathname === "/index" || pathname === "/") {
    if (req.method === "OPTIONS") return preflight({ origin: "*" });
    return await serveHubIndex(env);
  }

  return error(404, "Not found", { origin: "*" });
}

// ─── Development (wrangler dev) fallback router ─────────────────────

async function routeDev(req: Request, env: Env, url: URL): Promise<Response> {
  const p = url.pathname;

  if (p.startsWith("/api/")) {
    return await routeApi(req, env, p.slice(4)); // strip "/api"
  }

  const devWorld = /^\/dev\/world\/([^/]+)(\/.*)?$/.exec(p);
  if (devWorld && devWorld[1]) {
    const slug = devWorld[1];
    const sub = devWorld[2] ?? "/";
    if (sub === "/showcase.json") return await serveShowcaseJson(env, slug);
    const imageMatch = /^\/images\/([a-f0-9]{64}\.webp)$/.exec(sub);
    if (imageMatch && imageMatch[1]) return await serveImage(env, slug, imageMatch[1]);
    return error(404, "Not found", { origin: "*" });
  }

  if (p === "/" || p === "") {
    const body = `Arcanum Hub worker is running.

Production host layout:
  - api.${env.HUB_ROOT_DOMAIN}/        publish + admin API
  - ${env.HUB_ROOT_DOMAIN}/             landing index (served by showcase SPA)
  - <slug>.${env.HUB_ROOT_DOMAIN}/      per-world showcase (SPA + /showcase.json)

Dev shortcuts:
  - /api/publish/*   (path-prefixed)
  - /api/admin/*     (path-prefixed)
  - /dev/world/<slug>/showcase.json
  - /dev/world/<slug>/images/<hash>.webp
`;
    return new Response(body, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders({ origin: "*" }) },
    });
  }

  return error(404, "Not found", { origin: "*" });
}
