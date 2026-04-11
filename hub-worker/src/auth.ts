import type { Env } from "./env";
import { getUserByApiKeyHash, type UserRow } from "./db";
import { sha256Hex } from "./util";

/** Pulls `Authorization: Bearer <key>` and resolves it to a user. Returns null if invalid. */
export async function authenticateUser(req: Request, env: Env): Promise<UserRow | null> {
  const header = req.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/.exec(header);
  if (!match || !match[1]) return null;
  const key = match[1].trim();
  if (!key) return null;
  const hash = await sha256Hex(key);
  return await getUserByApiKeyHash(env, hash);
}

/** Checks the X-Admin-Key header against HUB_ADMIN_KEY. Constant-time-ish compare. */
export function isAdmin(req: Request, env: Env): boolean {
  const provided = req.headers.get("X-Admin-Key") ?? "";
  const expected = env.HUB_ADMIN_KEY ?? "";
  if (!provided || !expected || provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
