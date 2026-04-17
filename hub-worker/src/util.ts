// ─── JSON response helpers ───────────────────────────────────────────

export interface CorsOpts {
  /** Origin to allow. Defaults to "*" for public endpoints. */
  origin?: string;
  /** Allowed methods. Defaults to "GET, POST, PUT, DELETE, OPTIONS". */
  methods?: string;
  /** Allowed headers. Defaults to "Authorization, Content-Type, X-Admin-Key". */
  headers?: string;
}

export function corsHeaders(opts: CorsOpts = {}): HeadersInit {
  return {
    "Access-Control-Allow-Origin": opts.origin ?? "*",
    "Access-Control-Allow-Methods": opts.methods ?? "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": opts.headers ?? "Authorization, Content-Type, X-Admin-Key",
    "Access-Control-Max-Age": "86400",
  };
}

export function json(data: unknown, init: ResponseInit = {}, cors?: CorsOpts): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (cors) {
    for (const [k, v] of Object.entries(corsHeaders(cors))) {
      headers.set(k, v as string);
    }
  }
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function error(status: number, message: string, cors?: CorsOpts): Response {
  return json({ error: message }, { status }, cors);
}

export function preflight(cors: CorsOpts = {}): Response {
  return new Response(null, { status: 204, headers: corsHeaders(cors) });
}

// ─── Slug validation ─────────────────────────────────────────────────

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

/**
 * Subdomain names a world owner can't claim — they belong to the
 * hub itself. `api` is handled specially upstream of parseHost, but
 * it's also listed here so the reservation is all in one place.
 */
export const RESERVED_SUBDOMAINS = new Set([
  "api",
  "admin",
  "www",
  "hub",
  "mail",
  "ftp",
  "ns1",
  "ns2",
]);

export function isValidSlug(slug: string): boolean {
  if (RESERVED_SUBDOMAINS.has(slug)) return false;
  return SLUG_RE.test(slug);
}

/** Slug validator that skips the reserved list — used when we've
 * already established the subdomain is meant for a world (e.g. in
 * admin-side validation) and just want the shape check. */
export function isValidSlugShape(slug: string): boolean {
  return SLUG_RE.test(slug);
}

// ─── Hash helpers ────────────────────────────────────────────────────

export async function sha256Hex(input: string | ArrayBuffer): Promise<string> {
  const data = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generate a new API key. Returns both the plain text (shown once)
 * and its SHA-256 hash (stored).
 *
 * The tier is encoded in the prefix (`hubk_full_…`, `hubk_pub_…`,
 * `hubk_demo_…`, `hubk_play_…`) so the creator can auto-detect
 * capability without a round-trip. The prefix is purely a UX hint —
 * the worker still looks up the authoritative tier in D1 on every
 * request. Legacy `hub_<random>` keys (no tier segment) from before
 * the tier feature keep working; they're all tagged `tier='full'`
 * by migration 0002.
 */
export async function generateApiKey(
  tier: "full" | "publish" | "demo" | "playtester",
): Promise<{ plain: string; hash: string }> {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const tail = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const segment =
    tier === "publish"
      ? "pub"
      : tier === "demo"
        ? "demo"
        : tier === "playtester"
          ? "play"
          : "full";
  const plain = `hubk_${segment}_${tail}`;
  const hash = await sha256Hex(plain);
  return { plain, hash };
}

/**
 * Generate a zero-padded 6-digit verification code. Uses
 * crypto.getRandomValues for uniform distribution across 000000-999999.
 */
export function generateVerificationCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const n =
    ((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0;
  return (n % 1_000_000).toString().padStart(6, "0");
}

/**
 * Very small email shape check. Not RFC-5322 — just enough to reject
 * obvious garbage before we send a code to it.
 */
export function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  const trimmed = email.trim();
  if (trimmed !== email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Strip obvious whitespace and lowercase so email uniqueness is stable. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Client IP for rate-limiting. Falls back to "unknown" off-CF. */
export function clientIp(req: Request): string {
  return req.headers.get("CF-Connecting-IP") ?? req.headers.get("X-Forwarded-For") ?? "unknown";
}

// ─── ID generation ───────────────────────────────────────────────────

export function newId(): string {
  // 16 bytes of entropy → base32-ish short ID
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Host parsing ────────────────────────────────────────────────────

export interface HostInfo {
  /** The full hostname (e.g. "mystara.arcanum-hub.com"). */
  host: string;
  /** The root domain (e.g. "arcanum-hub.com"). */
  rootDomain: string;
  /** "api" for api.<root>, "root" for the bare root, "world" for <slug>.<root>, "unknown" otherwise. */
  kind: "api" | "root" | "world" | "unknown";
  /** The world slug, if kind === "world". */
  slug?: string;
}

export function parseHost(host: string, rootDomain: string): HostInfo {
  const h = host.toLowerCase().split(":")[0] ?? "";
  const root = rootDomain.toLowerCase();

  if (h === root) return { host: h, rootDomain: root, kind: "root" };
  if (h === `api.${root}`) return { host: h, rootDomain: root, kind: "api" };

  if (h.endsWith(`.${root}`)) {
    const slug = h.slice(0, h.length - root.length - 1);
    // Avoid misclassifying sub-subdomains like "foo.bar.arcanum-hub.com".
    if (slug && !slug.includes(".") && isValidSlug(slug)) {
      return { host: h, rootDomain: root, kind: "world", slug };
    }
  }

  return { host: h, rootDomain: root, kind: "unknown" };
}
