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

export function isValidSlug(slug: string): boolean {
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

/** Generate a new API key. Returns both the plain text (shown once) and its SHA-256 hash (stored). */
export async function generateApiKey(): Promise<{ plain: string; hash: string }> {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const tail = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const plain = `hub_${tail}`;
  const hash = await sha256Hex(plain);
  return { plain, hash };
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
  /** The full hostname (e.g. "mystara.hub.arcanum.app"). */
  host: string;
  /** The root domain (e.g. "hub.arcanum.app"). */
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
    // Avoid misclassifying sub-subdomains like "foo.bar.hub.arcanum.app".
    if (slug && !slug.includes(".") && isValidSlug(slug)) {
      return { host: h, rootDomain: root, kind: "world", slug };
    }
  }

  return { host: h, rootDomain: root, kind: "unknown" };
}
