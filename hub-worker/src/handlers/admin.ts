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
  updateUserApiKeyHash,
  type UserRow,
  type WorldRow,
} from "../db";
import { corsHeaders, error, generateApiKey, json, newId, preflight } from "../util";

// ─── Shape returned to the admin dashboard ───────────────────────────

interface AdminUserView {
  id: string;
  displayName: string;
  email: string | null;
  createdAt: number;
  lastPublishAt: number | null;
  worlds: { slug: string; listed: boolean; lastPublishAt: number | null; bytesUsed: number }[];
}

function cors(env: Env) {
  return { origin: env.ADMIN_ORIGIN };
}

function toUserView(user: UserRow, worlds: WorldRow[]): AdminUserView {
  return {
    id: user.id,
    displayName: user.display_name,
    email: user.email,
    createdAt: user.created_at,
    lastPublishAt: user.last_publish_at,
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
  if (req.method === "OPTIONS") return preflight(cors(env));

  // /admin/users
  if (pathname === "/admin/users") {
    if (req.method === "GET") return await adminListUsers(env);
    if (req.method === "POST") return await adminCreateUser(req, env);
    return error(405, "Method not allowed", cors(env));
  }

  // /admin/users/<id>
  const userMatch = /^\/admin\/users\/([^/]+)$/.exec(pathname);
  if (userMatch && userMatch[1]) {
    const id = userMatch[1];
    if (req.method === "DELETE") return await adminDeleteUser(env, id);
    return error(405, "Method not allowed", cors(env));
  }

  // /admin/users/<id>/regenerate-key
  const regenMatch = /^\/admin\/users\/([^/]+)\/regenerate-key$/.exec(pathname);
  if (regenMatch && regenMatch[1]) {
    const id = regenMatch[1];
    if (req.method === "POST") return await adminRegenerateKey(env, id);
    return error(405, "Method not allowed", cors(env));
  }

  // /admin/worlds
  if (pathname === "/admin/worlds") {
    if (req.method === "GET") return await adminListWorlds(env);
    return error(405, "Method not allowed", cors(env));
  }

  // /admin/worlds/<slug>
  const worldMatch = /^\/admin\/worlds\/([^/]+)$/.exec(pathname);
  if (worldMatch && worldMatch[1]) {
    const slug = worldMatch[1];
    if (req.method === "DELETE") return await adminDeleteWorld(env, slug);
    return error(405, "Method not allowed", cors(env));
  }

  return error(404, "Not found", cors(env));
}

// ─── Handlers ────────────────────────────────────────────────────────

async function adminListUsers(env: Env): Promise<Response> {
  const users = await listUsers(env);
  const views: AdminUserView[] = [];
  for (const user of users) {
    const worlds = await listWorldsForUser(env, user.id);
    views.push(toUserView(user, worlds));
  }
  return json({ users: views }, {}, cors(env));
}

async function adminCreateUser(req: Request, env: Env): Promise<Response> {
  let body: { displayName?: string; email?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return error(400, "Invalid JSON body", cors(env));
  }
  const displayName = (body.displayName ?? "").trim();
  if (!displayName) return error(400, "displayName is required", cors(env));
  const email = (body.email ?? "").trim() || null;

  const { plain, hash } = await generateApiKey();
  const id = newId();
  try {
    await createUser(env, { id, display_name: displayName, email, api_key_hash: hash });
  } catch (e) {
    return error(500, `Failed to create user: ${String(e)}`, cors(env));
  }

  const user = await getUserById(env, id);
  if (!user) return error(500, "User created but not readable", cors(env));

  return json(
    {
      user: toUserView(user, []),
      apiKey: plain, // shown once
    },
    { status: 201 },
    cors(env),
  );
}

async function adminDeleteUser(env: Env, id: string): Promise<Response> {
  const user = await getUserById(env, id);
  if (!user) return error(404, "User not found", cors(env));

  // Wipe the user's worlds from R2 before the DB cascade removes them.
  const worlds = await listWorldsForUser(env, id);
  for (const world of worlds) {
    await deleteWorldFromR2(env, world.slug);
  }
  await deleteUser(env, id);
  return json({ ok: true, deletedWorlds: worlds.length }, {}, cors(env));
}

async function adminRegenerateKey(env: Env, id: string): Promise<Response> {
  const user = await getUserById(env, id);
  if (!user) return error(404, "User not found", cors(env));
  const { plain, hash } = await generateApiKey();
  await updateUserApiKeyHash(env, id, hash);
  return json({ apiKey: plain }, {}, cors(env));
}

async function adminListWorlds(env: Env): Promise<Response> {
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
    cors(env),
  );
}

async function adminDeleteWorld(env: Env, slug: string): Promise<Response> {
  const world = await getWorldBySlug(env, slug);
  if (!world) return error(404, "World not found", cors(env));
  await deleteWorldFromR2(env, slug);
  await deleteWorld(env, slug);
  return json({ ok: true }, {}, cors(env));
}

// ─── Shared R2 wipe ──────────────────────────────────────────────────

async function deleteWorldFromR2(env: Env, slug: string): Promise<void> {
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

export const adminCorsHeaders = (env: Env) => corsHeaders(cors(env));
