import type { Env } from "../env";
import {
  createUser,
  deleteUser,
  deleteWorld,
  getUserById,
  getWorldBySlug,
  listAllWorlds,
  listUsers,
  listWorldsForUser,
  resetUserUsage,
  setUserQuotas,
  updateUserApiKeyHash,
  updateUserTierAndKey,
  type UserRow,
  type UserTier,
  type WorldRow,
} from "../db";
import { corsHeaders, error, generateApiKey, json, newId, preflight } from "../util";

// ─── Shape returned to the admin dashboard ───────────────────────────

interface AdminUserView {
  id: string;
  displayName: string;
  email: string | null;
  emailVerified: boolean;
  createdAt: number;
  lastPublishAt: number | null;
  tier: UserTier;
  usage: {
    imagesUsed: number;
    imagesQuota: number;
    promptsUsed: number;
    promptsQuota: number;
  };
  worlds: { slug: string; listed: boolean; lastPublishAt: number | null; bytesUsed: number }[];
}

function parseTier(raw: unknown): UserTier | null {
  if (raw === "full" || raw === "publish" || raw === "demo" || raw === "playtester") return raw;
  return null;
}

/**
 * Resolve which origin (from the comma-separated ADMIN_ORIGIN
 * allowlist) to echo back in Access-Control-Allow-Origin. If the
 * request's Origin header matches one of the allowlisted origins we
 * echo it back verbatim; otherwise we fall back to the first entry,
 * which effectively refuses CORS for any other browser-originated
 * caller.
 */
function cors(env: Env, req: Request) {
  const allowlist = (env.ADMIN_ORIGIN ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const requestOrigin = req.headers.get("Origin") ?? "";
  const matched = allowlist.find((o) => o === requestOrigin);
  return { origin: matched ?? allowlist[0] ?? "*" };
}

function toUserView(user: UserRow, worlds: WorldRow[]): AdminUserView {
  return {
    id: user.id,
    displayName: user.display_name,
    email: user.email,
    emailVerified: Boolean(user.email_verified),
    createdAt: user.created_at,
    lastPublishAt: user.last_publish_at,
    tier: user.tier,
    usage: {
      imagesUsed: user.images_used,
      imagesQuota: user.images_quota,
      promptsUsed: user.prompts_used,
      promptsQuota: user.prompts_quota,
    },
    worlds: worlds.map((w) => ({
      slug: w.slug,
      listed: Boolean(w.listed),
      lastPublishAt: w.last_publish_at,
      bytesUsed: w.bytes_used,
    })),
  };
}

// ─── Router ──────────────────────────────────────────────────────────

export async function handleAdmin(req: Request, env: Env, pathname: string): Promise<Response> {
  const c = cors(env, req);
  if (req.method === "OPTIONS") return preflight(c);

  // /admin/users
  if (pathname === "/admin/users") {
    if (req.method === "GET") return await adminListUsers(env, c);
    if (req.method === "POST") return await adminCreateUser(req, env, c);
    return error(405, "Method not allowed", c);
  }

  // /admin/users/<id>
  const userMatch = /^\/admin\/users\/([^/]+)$/.exec(pathname);
  if (userMatch && userMatch[1]) {
    const id = userMatch[1];
    if (req.method === "DELETE") return await adminDeleteUser(env, id, c);
    return error(405, "Method not allowed", c);
  }

  // /admin/users/<id>/regenerate-key
  const regenMatch = /^\/admin\/users\/([^/]+)\/regenerate-key$/.exec(pathname);
  if (regenMatch && regenMatch[1]) {
    const id = regenMatch[1];
    if (req.method === "POST") return await adminRegenerateKey(env, id, c);
    return error(405, "Method not allowed", c);
  }

  // /admin/users/<id>/tier
  const tierMatch = /^\/admin\/users\/([^/]+)\/tier$/.exec(pathname);
  if (tierMatch && tierMatch[1]) {
    const id = tierMatch[1];
    if (req.method === "POST") return await adminSetTier(req, env, id, c);
    return error(405, "Method not allowed", c);
  }

  // /admin/users/<id>/quotas
  const quotaMatch = /^\/admin\/users\/([^/]+)\/quotas$/.exec(pathname);
  if (quotaMatch && quotaMatch[1]) {
    const id = quotaMatch[1];
    if (req.method === "POST") return await adminUpdateQuotas(req, env, id, c);
    return error(405, "Method not allowed", c);
  }

  // /admin/users/<id>/reset-usage
  const resetMatch = /^\/admin\/users\/([^/]+)\/reset-usage$/.exec(pathname);
  if (resetMatch && resetMatch[1]) {
    const id = resetMatch[1];
    if (req.method === "POST") return await adminResetUsage(env, id, c);
    return error(405, "Method not allowed", c);
  }

  // /admin/worlds
  if (pathname === "/admin/worlds") {
    if (req.method === "GET") return await adminListWorlds(env, c);
    return error(405, "Method not allowed", c);
  }

  // /admin/worlds/<slug>
  const worldMatch = /^\/admin\/worlds\/([^/]+)$/.exec(pathname);
  if (worldMatch && worldMatch[1]) {
    const slug = worldMatch[1];
    if (req.method === "DELETE") return await adminDeleteWorld(env, slug, c);
    return error(405, "Method not allowed", c);
  }

  return error(404, "Not found", c);
}

// ─── Handlers ────────────────────────────────────────────────────────

type Cors = ReturnType<typeof cors>;

async function adminListUsers(env: Env, c: Cors): Promise<Response> {
  const users = await listUsers(env);
  const views: AdminUserView[] = [];
  for (const user of users) {
    const worlds = await listWorldsForUser(env, user.id);
    views.push(toUserView(user, worlds));
  }
  return json({ users: views }, {}, c);
}

async function adminCreateUser(req: Request, env: Env, c: Cors): Promise<Response> {
  let body: { displayName?: string; email?: string; tier?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return error(400, "Invalid JSON body", c);
  }
  const displayName = (body.displayName ?? "").trim();
  if (!displayName) return error(400, "displayName is required", c);
  const email = (body.email ?? "").trim() || null;
  // Tier defaults to "playtester" — admin-invited users are trusted,
  // so they get high quotas and unrestricted image models. Older
  // admin UIs that send no tier field inherit this default.
  const tier: UserTier = parseTier(body.tier) ?? "playtester";

  const { plain, hash } = await generateApiKey(tier);
  const id = newId();
  try {
    await createUser(env, {
      id,
      display_name: displayName,
      email,
      api_key_hash: hash,
      tier,
      // Admin-minted users are trusted — no need to make them verify
      // an email before publishing.
      email_verified: true,
    });
  } catch (e) {
    return error(500, `Failed to create user: ${String(e)}`, c);
  }

  const user = await getUserById(env, id);
  if (!user) return error(500, "User created but not readable", c);

  return json(
    {
      user: toUserView(user, []),
      apiKey: plain, // shown once
    },
    { status: 201 },
    c,
  );
}

async function adminDeleteUser(env: Env, id: string, c: Cors): Promise<Response> {
  const user = await getUserById(env, id);
  if (!user) return error(404, "User not found", c);

  // Wipe the user's worlds from R2 before the DB cascade removes them.
  const worlds = await listWorldsForUser(env, id);
  for (const world of worlds) {
    await deleteWorldFromR2(env, world.slug);
  }
  await deleteUser(env, id);
  return json({ ok: true, deletedWorlds: worlds.length }, {}, c);
}

async function adminRegenerateKey(env: Env, id: string, c: Cors): Promise<Response> {
  const user = await getUserById(env, id);
  if (!user) return error(404, "User not found", c);
  // Mint the new key with a prefix that matches the user's current
  // tier so the creator's auto-detection stays consistent with D1.
  // Rotation only invalidates the leaked key — usage counters are
  // preserved. Use /admin/users/<id>/reset-usage to grant a fresh
  // allowance.
  const { plain, hash } = await generateApiKey(user.tier);
  await updateUserApiKeyHash(env, id, hash);
  return json({ apiKey: plain }, {}, c);
}

async function adminResetUsage(env: Env, id: string, c: Cors): Promise<Response> {
  const user = await getUserById(env, id);
  if (!user) return error(404, "User not found", c);
  await resetUserUsage(env, id);
  const fresh = await getUserById(env, id);
  if (!fresh) return error(500, "User disappeared after reset", c);
  return json({ user: toUserView(fresh, []) }, {}, c);
}

async function adminSetTier(req: Request, env: Env, id: string, c: Cors): Promise<Response> {
  const user = await getUserById(env, id);
  if (!user) return error(404, "User not found", c);

  let body: { tier?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return error(400, "Invalid JSON body", c);
  }
  const tier = parseTier(body.tier);
  if (!tier) return error(400, "tier must be \"full\", \"playtester\", or \"publish\"", c);

  // No-op if the requested tier matches. We still return the user
  // view so the admin UI can refresh, but skip rotation — rotating
  // on a no-op would needlessly kill a working key.
  if (tier === user.tier) {
    return json({ user: toUserView(user, []), apiKey: null, unchanged: true }, {}, c);
  }

  // Tier change always auto-rotates the key so the prefix stays in
  // sync with the stored tier and any key that leaked under the old
  // tier is immediately invalidated.
  const { plain, hash } = await generateApiKey(tier);
  await updateUserTierAndKey(env, id, tier, hash);

  const fresh = await getUserById(env, id);
  if (!fresh) return error(500, "User disappeared after update", c);
  return json({ user: toUserView(fresh, []), apiKey: plain }, {}, c);
}

async function adminUpdateQuotas(
  req: Request,
  env: Env,
  id: string,
  c: Cors,
): Promise<Response> {
  const user = await getUserById(env, id);
  if (!user) return error(404, "User not found", c);

  let body: { imagesQuota?: number; promptsQuota?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return error(400, "Invalid JSON body", c);
  }

  const updates: { images_quota?: number; prompts_quota?: number } = {};
  if (typeof body.imagesQuota === "number" && body.imagesQuota >= 0) {
    updates.images_quota = Math.floor(body.imagesQuota);
  }
  if (typeof body.promptsQuota === "number" && body.promptsQuota >= 0) {
    updates.prompts_quota = Math.floor(body.promptsQuota);
  }
  if (!updates.images_quota && !updates.prompts_quota) {
    return error(400, "Nothing to update", c);
  }

  await setUserQuotas(env, id, updates);
  const fresh = await getUserById(env, id);
  if (!fresh) return error(500, "User disappeared after update", c);
  return json({ user: toUserView(fresh, []) }, {}, c);
}

async function adminListWorlds(env: Env, c: Cors): Promise<Response> {
  const worlds = await listAllWorlds(env);
  return json(
    {
      worlds: worlds.map((w) => ({
        slug: w.slug,
        userId: w.user_id,
        displayName: w.display_name,
        listed: Boolean(w.listed),
        tagline: w.tagline,
        lastPublishAt: w.last_publish_at,
        bytesUsed: w.bytes_used,
        createdAt: w.created_at,
      })),
    },
    {},
    c,
  );
}

async function adminDeleteWorld(env: Env, slug: string, c: Cors): Promise<Response> {
  const world = await getWorldBySlug(env, slug);
  if (!world) return error(404, "World not found", c);
  await deleteWorldFromR2(env, slug);
  await deleteWorld(env, slug);
  return json({ ok: true }, {}, c);
}

// ─── Shared R2 wipe ──────────────────────────────────────────────────

export async function deleteWorldFromR2(env: Env, slug: string): Promise<void> {
  // List + delete in batches. R2 list returns up to 1000 objects per call.
  let cursor: string | undefined;
  do {
    const opts: R2ListOptions = { prefix: `worlds/${slug}/`, limit: 1000 };
    if (cursor) opts.cursor = cursor;
    const listing = await env.BUCKET.list(opts);
    if (listing.objects.length > 0) {
      await env.BUCKET.delete(listing.objects.map((o) => o.key));
    }
    cursor = listing.truncated ? listing.cursor : undefined;
  } while (cursor);
}

export const adminCorsHeaders = (env: Env, req: Request) => corsHeaders(cors(env, req));
