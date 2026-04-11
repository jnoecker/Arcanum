import type { Env } from "../env";
import type { UserRow } from "../db";
import {
  createWorld,
  getWorldBySlug,
  listWorldsForUser,
  touchUserPublish,
  updateWorldPublish,
} from "../db";
import { corsHeaders, error, isValidSlug, json, sha256Hex } from "../util";

// ─── POST /publish/check-existing ────────────────────────────────────
// Body: { slug, hashes: ["<sha256hex>.webp", ...] }
// Returns: { existing: [...], missing: [...] }
export async function checkExisting(req: Request, env: Env, user: UserRow): Promise<Response> {
  let body: { slug?: string; hashes?: string[] };
  try {
    body = (await req.json()) as { slug?: string; hashes?: string[] };
  } catch {
    return error(400, "Invalid JSON body", { origin: "*" });
  }

  const slug = body.slug?.trim() ?? "";
  if (!isValidSlug(slug)) return error(400, "Invalid slug", { origin: "*" });
  const ownership = await assertOwnership(env, user, slug);
  if (ownership) return ownership;

  const hashes = Array.isArray(body.hashes) ? body.hashes : [];
  const existing: string[] = [];
  const missing: string[] = [];

  for (const name of hashes) {
    if (typeof name !== "string") continue;
    if (!/^[a-f0-9]{64}\.webp$/.test(name)) {
      missing.push(name);
      continue;
    }
    const key = `worlds/${slug}/images/${name}`;
    const head = await env.BUCKET.head(key);
    if (head) existing.push(name);
    else missing.push(name);
  }

  return json({ existing, missing }, {}, { origin: "*" });
}

// ─── PUT /publish/image/<hash>.webp ──────────────────────────────────
// Query: ?slug=<slug>
// Body: raw image bytes (image/webp)
export async function uploadImage(req: Request, env: Env, user: UserRow): Promise<Response> {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug")?.trim() ?? "";
  if (!isValidSlug(slug)) return error(400, "Invalid or missing ?slug", { origin: "*" });
  const ownership = await assertOwnership(env, user, slug);
  if (ownership) return ownership;

  const last = url.pathname.split("/").pop() ?? "";
  if (!/^[a-f0-9]{64}\.webp$/.test(last)) {
    return error(400, "Image filename must be <sha256>.webp", { origin: "*" });
  }

  const contentType = req.headers.get("Content-Type") ?? "";
  if (!contentType.startsWith("image/webp")) {
    return error(415, "Content-Type must be image/webp", { origin: "*" });
  }

  const bytes = await req.arrayBuffer();
  if (bytes.byteLength === 0) return error(400, "Empty body", { origin: "*" });
  if (bytes.byteLength > 8 * 1024 * 1024) {
    return error(413, "Image exceeds 8 MB hub limit", { origin: "*" });
  }

  // Verify the filename matches the content hash — prevents a compromised
  // client from spraying arbitrary files under fake hash names.
  const actualHash = await sha256Hex(bytes);
  const claimedHash = last.slice(0, 64);
  if (actualHash !== claimedHash) {
    return error(400, "Filename does not match content hash", { origin: "*" });
  }

  const key = `worlds/${slug}/images/${last}`;
  await env.BUCKET.put(key, bytes, {
    httpMetadata: { contentType: "image/webp" },
  });

  return json({ ok: true, size: bytes.byteLength }, {}, { origin: "*" });
}

// ─── POST /publish/manifest ──────────────────────────────────────────
// Body: { slug, listed, displayName?, tagline?, showcase: <ShowcaseData JSON> }
export async function uploadManifest(req: Request, env: Env, user: UserRow): Promise<Response> {
  let body: {
    slug?: string;
    listed?: boolean;
    displayName?: string;
    tagline?: string;
    showcase?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return error(400, "Invalid JSON body", { origin: "*" });
  }

  const slug = body.slug?.trim() ?? "";
  if (!isValidSlug(slug)) {
    return error(400, "Invalid slug (a-z0-9-, 3-32 chars)", { origin: "*" });
  }
  if (!body.showcase || typeof body.showcase !== "object") {
    return error(400, "Missing showcase payload", { origin: "*" });
  }

  // Upsert world record; if slug is taken by another user, reject.
  const existing = await getWorldBySlug(env, slug);
  if (existing && existing.user_id !== user.id) {
    return error(409, `Slug "${slug}" is taken`, { origin: "*" });
  }
  if (!existing) {
    await createWorld(env, {
      slug,
      user_id: user.id,
      display_name: body.displayName ?? null,
    });
  }

  const json_text = JSON.stringify(body.showcase);
  const bytes = new TextEncoder().encode(json_text);

  await env.BUCKET.put(`worlds/${slug}/showcase.json`, bytes, {
    httpMetadata: { contentType: "application/json" },
  });

  // bytes_used is a coarse estimate — just the manifest size for now.
  // A follow-up could sum R2 listing for worlds/<slug>/ but listing is pricey.
  await updateWorldPublish(env, slug, {
    listed: Boolean(body.listed),
    tagline: body.tagline ?? null,
    display_name: body.displayName ?? null,
    bytes_used: bytes.byteLength,
  });
  await touchUserPublish(env, user.id);

  return json(
    {
      ok: true,
      slug,
      url: `https://${slug}.${env.HUB_ROOT_DOMAIN}/`,
    },
    {},
    { origin: "*" },
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

async function assertOwnership(env: Env, user: UserRow, slug: string): Promise<Response | null> {
  const world = await getWorldBySlug(env, slug);
  if (world && world.user_id !== user.id) {
    return error(403, `You do not own world "${slug}"`, { origin: "*" });
  }
  // If world doesn't exist yet, allow it — the manifest upload will claim it.
  // But for image uploads before manifest, check that the user isn't over a
  // sane per-user world cap.
  if (!world) {
    const owned = await listWorldsForUser(env, user.id);
    const MAX_WORLDS_PER_USER = 10;
    if (owned.length >= MAX_WORLDS_PER_USER) {
      return error(
        403,
        `User already owns ${MAX_WORLDS_PER_USER} worlds; cannot claim another slug`,
        { origin: "*" },
      );
    }
  }
  return null;
}

export const publishCorsHeaders = () => corsHeaders({ origin: "*" });
